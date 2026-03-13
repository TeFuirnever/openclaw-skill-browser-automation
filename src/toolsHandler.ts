import { chromium, Browser, Page } from 'playwright';
import { CallToolResult, TextContent, ImageContent } from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs';
import * as os from 'os';
import * as path from 'path';
import {
  loadPolicy,
  validateUrl,
  validateRedirectUrl,
  shouldAllowNavigationRequest,
  getHostFromUrl,
} from './policy.js';
import { buildToolError, toolErrorResult } from './toolErrors.js';
import { capabilityAllowed } from './capabilities.js';
import { writeAudit } from './audit.js';
import { createResourceStore, ResourceStore } from './resource-store.js';
import { isBrowserTool } from './tools.js';
import {
  addUserDomain,
  removeUserDomain,
  listUserDomains,
  getBrowserConfig,
} from './userConfig.js';
import type { PolicyDecision, ServerPolicy } from './policyTypes.js';

const CDP_ENDPOINT = 'http://localhost:9222';
const DEFAULT_VIEWPORT_WIDTH = 1920;
const DEFAULT_VIEWPORT_HEIGHT = 1080;
const defaultDownloadsPath = path.join(os.homedir(), 'Downloads');

type ViewportSize = {
  width?: number;
  height?: number;
};

type WaitUntil = 'domcontentloaded' | 'load' | 'networkidle' | 'commit';

export interface ToolHandlerOptions {
  policy?: ServerPolicy;
  resourceStore?: ResourceStore;
}

function createRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function toToolResult(payload: unknown, summary?: string): CallToolResult {
  const text = summary ?? JSON.stringify(payload, null, 2);
  return {
    isError: false,
    content: [{ type: 'text', text }],
    structuredContent: payload as Record<string, unknown>,
  };
}

function trimText(value: string, maxResponseChars: number): string {
  return value.length > maxResponseChars
    ? `${value.slice(0, maxResponseChars)}\n...[truncated]`
    : value;
}

function parseWaitUntil(rawValue: unknown): WaitUntil {
  if (
    rawValue === 'domcontentloaded' ||
    rawValue === 'networkidle' ||
    rawValue === 'commit' ||
    rawValue === 'load'
  ) {
    return rawValue;
  }
  return 'load';
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutRef: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutRef = setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutRef) {
      clearTimeout(timeoutRef);
    }
  }
}

function parseSearchEngine(engine: unknown): 'duckduckgo' | 'bing' {
  return engine === 'bing' ? 'bing' : 'duckduckgo';
}

function buildSearchUrl(query: string, engine: 'duckduckgo' | 'bing'): string {
  const encoded = encodeURIComponent(query);
  return engine === 'bing'
    ? `https://www.bing.com/search?q=${encoded}`
    : `https://duckduckgo.com/html/?q=${encoded}`;
}

function stripTags(input: string): string {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSearchItems(html: string, limit: number): Array<{ title: string; url: string }> {
  const matches = Array.from(
    html.matchAll(/<a[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>(.*?)<\/a>/gis)
  );
  const items: Array<{ title: string; url: string }> = [];

  for (const match of matches) {
    const url = match[1];
    const title = stripTags(match[2]);
    if (!title || !url) {
      continue;
    }
    items.push({ title, url });
    if (items.length >= limit) {
      break;
    }
  }

  return items;
}

async function extractSearchItemsFromDom(
  browserPage: Page,
  engine: 'duckduckgo' | 'bing',
  limit: number
): Promise<Array<{ title: string; url: string }>> {
  const selectors =
    engine === 'bing'
      ? ['li.b_algo h2 a', 'h2 a']
      : ['a.result__a', 'h2 a', "a[data-testid='result-title-a']"];

  for (const selector of selectors) {
    const items = await browserPage.$$eval(
      selector,
      (anchors, max) =>
        anchors
          .map(anchor => {
            const href = anchor.getAttribute('href') ?? '';
            const title = (anchor.textContent ?? '').trim().replace(/\s+/g, ' ');
            return { title, url: href };
          })
          .filter(entry => entry.title.length > 0 && /^https?:\/\//i.test(entry.url))
          .slice(0, max),
      limit
    );

    if (items.length > 0) {
      return items;
    }
  }

  return [];
}

function getRedirectHopCount(
  response: { request: () => { redirectedFrom: () => unknown } } | null
): number {
  if (!response) {
    return 0;
  }

  let count = 0;
  let current: { redirectedFrom: () => unknown } | null = response.request();
  while (current && current.redirectedFrom()) {
    count += 1;
    const previous = current.redirectedFrom();
    if (!previous || typeof previous !== 'object' || !('redirectedFrom' in previous)) {
      break;
    }
    current = previous as { redirectedFrom: () => unknown };
  }
  return count;
}

async function manualWebFetch(
  url: string,
  timeoutMs: number,
  maxRedirectHops: number,
  validateRedirectTarget: (
    currentUrl: string,
    location: string
  ) => PolicyDecision & { resolvedUrl?: string }
): Promise<{ status: number; finalUrl: string; body: string; redirectHops: number }> {
  let currentUrl = url;
  let redirectHops = 0;

  while (redirectHops <= maxRedirectHops) {
    const response = await withTimeout(
      fetch(currentUrl, { method: 'GET', redirect: 'manual' }),
      timeoutMs
    );

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return { status: response.status, finalUrl: currentUrl, body: '', redirectHops };
      }
      const redirectDecision = validateRedirectTarget(currentUrl, location);
      if (!redirectDecision.allowed) {
        throw new Error(
          `REDIRECT_POLICY_DENIED|${redirectDecision.resolvedUrl ?? new URL(location, currentUrl).toString()}|${
            redirectDecision.reason ?? 'POLICY_DENIED'
          }`
        );
      }
      currentUrl = redirectDecision.resolvedUrl ?? new URL(location, currentUrl).toString();
      redirectHops += 1;
      continue;
    }

    const body = await withTimeout(response.text(), timeoutMs);
    return { status: response.status, finalUrl: currentUrl, body, redirectHops };
  }

  throw new Error('REDIRECT_HOPS_EXCEEDED');
}

function toArgs(args: unknown): Record<string, unknown> {
  if (args && typeof args === 'object') {
    return args as Record<string, unknown>;
  }
  return {};
}

function getNumberArg(args: Record<string, unknown>, key: string, fallback: number): number {
  const value = args[key];
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  return fallback;
}

function getStringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' ? value : undefined;
}

export function resolveScreenshotOptions(
  policy: Pick<ServerPolicy, 'capabilities'>,
  args: Record<string, unknown>,
  requestId: string
): { savePng: boolean; screenshotName: string; storeBase64: boolean } {
  return {
    screenshotName: getStringArg(args, 'name') ?? `shot_${requestId}`,
    storeBase64: args.storeBase64 !== false,
    savePng: typeof args.savePng === 'boolean' ? args.savePng : policy.capabilities.download,
  };
}

export function createToolHandler(options: ToolHandlerOptions = {}) {
  let browser: Browser | undefined;
  let page: Page | undefined;
  let activeRequests = 0;
  let activeBrowserRequests = 0;
  let lastBlockedNavigation: { reason: string; url: string } | null = null;
  const policy = options.policy ?? loadPolicy();
  const resourceStore = options.resourceStore ?? createResourceStore();

  function denyPolicy(
    requestId: string,
    toolName: string,
    reason: string,
    host?: string,
    extraDetails?: Record<string, unknown>
  ): CallToolResult {
    const details = { reason, ...extraDetails };
    writeAudit(policy, {
      ts: new Date().toISOString(),
      requestId,
      tool: toolName,
      host,
      decision: 'deny',
      code: 'POLICY_DENIED',
      details,
    });

    return toolErrorResult(
      buildToolError('POLICY_DENIED', `Policy denied request: ${reason}`, requestId, false, {
        tool: toolName,
        host,
        reason,
        ...extraDetails,
      })
    );
  }

  function auditAllow(
    requestId: string,
    tool: string,
    startedAt: number,
    host?: string,
    details?: Record<string, unknown>
  ): void {
    writeAudit(policy, {
      ts: new Date().toISOString(),
      requestId,
      tool,
      host,
      decision: 'allow',
      code: 'OK',
      latencyMs: Date.now() - startedAt,
      details,
    });
  }

  function validateFinalUrl(
    toolName: string,
    requestId: string,
    finalUrl: string,
    redirectHops = 0
  ): CallToolResult | null {
    if (redirectHops > policy.limits.maxRedirectHops) {
      return denyPolicy(
        requestId,
        toolName,
        'REDIRECT_HOPS_EXCEEDED',
        getHostFromUrl(finalUrl) ?? undefined,
        {
          redirectHops,
          maxRedirectHops: policy.limits.maxRedirectHops,
        }
      );
    }

    if (!policy.security.revalidateAfterRedirect) {
      return null;
    }

    const finalValidation = validateUrl(finalUrl, policy);
    if (!finalValidation.allowed) {
      return denyPolicy(
        requestId,
        toolName,
        finalValidation.reason ?? 'REDIRECT_POLICY_DENIED',
        getHostFromUrl(finalUrl) ?? undefined
      );
    }

    return null;
  }

  function validateUrlInput(name: string, requestId: string, url?: string): CallToolResult | null {
    if (!url) {
      return toolErrorResult(buildToolError('INVALID_INPUT', 'url is required', requestId, false));
    }

    const decision = validateUrl(url, policy);
    if (!decision.allowed) {
      return denyPolicy(
        requestId,
        name,
        decision.reason ?? 'POLICY_DENIED',
        getHostFromUrl(url) ?? undefined,
        {
          allowedDomains: policy.security.allowedDomains,
        }
      );
    }

    return null;
  }

  async function closeBrowser(): Promise<void> {
    if (page) {
      await page.close();
      page = undefined;
    }
    if (browser) {
      await browser.close();
      browser = undefined;
    }
  }

  async function ensureBrowser(viewport?: ViewportSize): Promise<Page> {
    if (!browser) {
      try {
        browser = await chromium.connectOverCDP(CDP_ENDPOINT);
      } catch {
        // Note: Docker detection available for future use
        // const isDocker = fs.existsSync('/.dockerenv');
        const userBrowserConfig = getBrowserConfig();

        // Config priority: env var > user config > default (headless)
        const headless =
          process.env.PLAYWRIGHT_HEADLESS !== undefined
            ? process.env.PLAYWRIGHT_HEADLESS === 'true'
            : (userBrowserConfig.headless ?? true);

        const launchOptions: { headless: boolean; args?: string[] } = { headless };

        // Enable DevTools in non-headless mode (devtools flag only works with headed mode)
        if (
          !headless &&
          (process.env.PLAYWRIGHT_DEVTOOLS === 'true' || userBrowserConfig.devtools)
        ) {
          launchOptions.args = ['--auto-open-devtools-for-tabs'];
        }

        browser = await chromium.launch(launchOptions);
      }

      const contexts = browser.contexts();
      const context =
        contexts[0] ||
        (await browser.newContext({
          viewport: {
            width: viewport?.width ?? DEFAULT_VIEWPORT_WIDTH,
            height: viewport?.height ?? DEFAULT_VIEWPORT_HEIGHT,
          },
          deviceScaleFactor: 1,
        }));

      page = await context.newPage();
      page.on('console', msg => {
        resourceStore.addConsoleLog(`[${msg.type()}] ${msg.text()}`);
      });
      await context.route('**/*', async route => {
        const request = route.request();
        const isMainFrameNavigation =
          request.isNavigationRequest() &&
          page !== undefined &&
          request.frame() === page.mainFrame();
        const decision = shouldAllowNavigationRequest(request.url(), isMainFrameNavigation, policy);
        if (!decision.allowed) {
          lastBlockedNavigation = {
            url: request.url(),
            reason: decision.reason ?? 'POLICY_DENIED',
          };
          await route.abort('blockedbyclient');
          return;
        }
        await route.continue();
      });
    }

    if (!page) {
      throw new Error('Failed to initialize browser page');
    }

    return page;
  }

  async function runBrowserAction(
    currentPage: Page,
    timeoutMs: number,
    selector: string,
    requestId: string,
    action: 'click' | 'hover' | 'fill' | 'select',
    value?: string
  ): Promise<CallToolResult> {
    await withTimeout(currentPage.waitForSelector(selector), timeoutMs);

    if (action === 'click') {
      await withTimeout(currentPage.click(selector), timeoutMs);
      return toToolResult({ ok: true, requestId, message: `Clicked: ${selector}` });
    }

    if (action === 'hover') {
      await withTimeout(currentPage.hover(selector), timeoutMs);
      return toToolResult({ ok: true, requestId, message: `Hovered: ${selector}` });
    }

    if (action === 'fill') {
      await withTimeout(currentPage.fill(selector, value ?? ''), timeoutMs);
      return toToolResult({ ok: true, requestId, message: `Filled: ${selector}` });
    }

    await withTimeout(currentPage.selectOption(selector, value ?? ''), timeoutMs);
    return toToolResult({ ok: true, requestId, message: `Selected: ${selector}` });
  }

  async function handleToolCall(
    name: string,
    rawArgs: unknown,
    server: unknown
  ): Promise<CallToolResult> {
    const requestId = createRequestId();
    const startedAt = Date.now();

    if (activeRequests >= policy.limits.maxConcurrentRequests) {
      return toolErrorResult(
        buildToolError('RATE_LIMITED', 'Too many concurrent requests', requestId, true, {
          tool: name,
        })
      );
    }

    const args = toArgs(rawArgs);
    const timeoutMs = Math.min(
      getNumberArg(args, 'timeout', policy.limits.requestTimeoutMs),
      policy.limits.requestTimeoutMs
    );
    const requiresBrowser = isBrowserTool(name);

    if (requiresBrowser && activeBrowserRequests >= 1) {
      return toolErrorResult(
        buildToolError(
          'RATE_LIMITED',
          'Browser tools are serialized to avoid page state conflicts',
          requestId,
          true,
          {
            tool: name,
          }
        )
      );
    }

    activeRequests += 1;
    if (requiresBrowser) {
      activeBrowserRequests += 1;
    }

    try {
      if (!capabilityAllowed(name, policy)) {
        return denyPolicy(requestId, name, 'CAPABILITY_DISABLED');
      }

      let currentPage: Page | undefined;
      if (requiresBrowser) {
        currentPage = await ensureBrowser({
          width: getNumberArg(args, 'width', DEFAULT_VIEWPORT_WIDTH),
          height: getNumberArg(args, 'height', DEFAULT_VIEWPORT_HEIGHT),
        });
      }

      switch (name) {
        case 'playwright_policy_status': {
          const runtimeStats = resourceStore.getStats();
          return toToolResult(
            {
              ok: true,
              requestId,
              policy: {
                version: policy.version,
                security: policy.security,
                capabilities: policy.capabilities,
                limits: policy.limits,
                audit: policy.audit,
              },
              runtime: {
                activeRequests,
                activeBrowserRequests,
                browserReady: Boolean(browser),
                pageReady: Boolean(page),
                logsCount: runtimeStats.logsCount,
                screenshotsCount: runtimeStats.screenshotsCount,
              },
            },
            'Policy and runtime status returned'
          );
        }

        case 'playwright_add_domain': {
          const domain = getStringArg(args, 'domain');
          if (!domain) {
            return toolErrorResult(
              buildToolError('INVALID_INPUT', 'domain is required', requestId, false)
            );
          }
          const result = addUserDomain(domain);
          auditAllow(requestId, name, startedAt, undefined, { domain, added: result.added });
          return toToolResult(
            { ok: true, requestId, ...result },
            result.added ? `Added domain: ${domain}` : `Domain already exists: ${domain}`
          );
        }

        case 'playwright_remove_domain': {
          const domain = getStringArg(args, 'domain');
          if (!domain) {
            return toolErrorResult(
              buildToolError('INVALID_INPUT', 'domain is required', requestId, false)
            );
          }
          const result = removeUserDomain(domain);
          auditAllow(requestId, name, startedAt, undefined, { domain, removed: result.removed });
          return toToolResult(
            { ok: true, requestId, ...result },
            result.removed ? `Removed domain: ${domain}` : `Domain not found: ${domain}`
          );
        }

        case 'playwright_list_domains': {
          const userDomains = listUserDomains();
          const serverDomains = policy.security.allowedDomains;
          auditAllow(requestId, name, startedAt);
          return toToolResult(
            {
              ok: true,
              requestId,
              serverDomains,
              userDomains,
              total: serverDomains.length + userDomains.length,
            },
            `Total ${serverDomains.length + userDomains.length} trusted domains`
          );
        }

        case 'playwright_web_search': {
          if (!currentPage) {
            return toolErrorResult(
              buildToolError('INTERNAL_ERROR', 'browser page unavailable', requestId, false)
            );
          }

          const query = getStringArg(args, 'query');
          if (!query || query.trim().length === 0) {
            return toolErrorResult(
              buildToolError('INVALID_INPUT', 'query is required', requestId, false)
            );
          }

          const engine = parseSearchEngine(args.engine);
          const searchUrl = buildSearchUrl(query, engine);
          const searchValidation = validateUrlInput(name, requestId, searchUrl);
          if (searchValidation) {
            return searchValidation;
          }

          lastBlockedNavigation = null;
          const response = await withTimeout(
            currentPage.goto(searchUrl, { timeout: timeoutMs, waitUntil: 'domcontentloaded' }),
            timeoutMs
          );

          const finalUrl = currentPage.url();
          const redirectCheck = validateFinalUrl(
            name,
            requestId,
            finalUrl,
            getRedirectHopCount(response)
          );
          if (redirectCheck) {
            return redirectCheck;
          }

          const requestedLimit = Math.trunc(
            getNumberArg(args, 'limit', policy.limits.maxResultItems)
          );
          const limit = Math.max(1, Math.min(requestedLimit, policy.limits.maxResultItems));

          let items = await withTimeout(
            extractSearchItemsFromDom(currentPage, engine, limit),
            timeoutMs
          );
          if (items.length === 0) {
            const html = await withTimeout(currentPage.content(), timeoutMs);
            items = extractSearchItems(html, limit);
          }

          auditAllow(requestId, name, startedAt, getHostFromUrl(finalUrl) ?? undefined, {
            results: items.length,
          });
          return toToolResult(
            { ok: true, requestId, engine, query, finalUrl, items },
            `Found ${items.length} results`
          );
        }

        case 'playwright_extract': {
          if (!currentPage) {
            return toolErrorResult(
              buildToolError('INTERNAL_ERROR', 'browser page unavailable', requestId, false)
            );
          }

          const url = getStringArg(args, 'url');
          const initialValidation = validateUrlInput(name, requestId, url);
          if (initialValidation) {
            return initialValidation;
          }

          lastBlockedNavigation = null;
          const response = await withTimeout(
            currentPage.goto(url!, { timeout: timeoutMs, waitUntil: 'load' }),
            timeoutMs
          );
          const finalUrl = currentPage.url();

          const redirectCheck = validateFinalUrl(
            name,
            requestId,
            finalUrl,
            getRedirectHopCount(response)
          );
          if (redirectCheck) {
            return redirectCheck;
          }

          const selector = getStringArg(args, 'selector') ?? 'body';
          const title = await withTimeout(currentPage.title(), timeoutMs);
          const text = await withTimeout(currentPage.locator(selector).innerText(), timeoutMs);

          auditAllow(requestId, name, startedAt, getHostFromUrl(finalUrl) ?? undefined, {
            selector,
          });
          return toToolResult(
            {
              ok: true,
              requestId,
              url: finalUrl,
              title,
              selector,
              text: trimText(text, policy.limits.maxResponseChars),
            },
            `Extracted content from ${finalUrl}`
          );
        }

        case 'playwright_web_fetch': {
          const url = getStringArg(args, 'url');
          const initialValidation = validateUrlInput(name, requestId, url);
          if (initialValidation) {
            return initialValidation;
          }

          const fetched = await manualWebFetch(
            url!,
            timeoutMs,
            policy.limits.maxRedirectHops,
            (currentUrl, location) => validateRedirectUrl(currentUrl, location, policy)
          );
          const redirectCheck = validateFinalUrl(
            name,
            requestId,
            fetched.finalUrl,
            fetched.redirectHops
          );
          if (redirectCheck) {
            return redirectCheck;
          }

          auditAllow(requestId, name, startedAt, getHostFromUrl(fetched.finalUrl) ?? undefined, {
            redirectHops: fetched.redirectHops,
            status: fetched.status,
          });

          return toToolResult(
            {
              ok: true,
              requestId,
              url: fetched.finalUrl,
              status: fetched.status,
              body: trimText(fetched.body, policy.limits.maxResponseChars),
              redirectHops: fetched.redirectHops,
            },
            `Fetched ${fetched.finalUrl} (${fetched.status})`
          );
        }

        case 'playwright_navigate': {
          if (!currentPage) {
            return toolErrorResult(
              buildToolError('INTERNAL_ERROR', 'browser page unavailable', requestId, false)
            );
          }

          const url = getStringArg(args, 'url');
          const initialValidation = validateUrlInput(name, requestId, url);
          if (initialValidation) {
            return initialValidation;
          }

          lastBlockedNavigation = null;
          const response = await withTimeout(
            currentPage.goto(url!, {
              timeout: timeoutMs,
              waitUntil: parseWaitUntil(args.waitUntil),
            }),
            timeoutMs
          );

          const finalUrl = currentPage.url();
          const redirectCheck = validateFinalUrl(
            name,
            requestId,
            finalUrl,
            getRedirectHopCount(response)
          );
          if (redirectCheck) {
            return redirectCheck;
          }

          auditAllow(requestId, name, startedAt, getHostFromUrl(finalUrl) ?? undefined);
          return toToolResult({
            ok: true,
            requestId,
            url: finalUrl,
            message: `Navigated to ${finalUrl}`,
          });
        }

        case 'playwright_screenshot': {
          if (!currentPage) {
            return toolErrorResult(
              buildToolError('INTERNAL_ERROR', 'browser page unavailable', requestId, false)
            );
          }

          const { screenshotName, storeBase64, savePng } = resolveScreenshotOptions(
            policy,
            args,
            requestId
          );

          if (!policy.capabilities.download && savePng) {
            return denyPolicy(requestId, name, 'DOWNLOAD_DISABLED');
          }

          const selector = getStringArg(args, 'selector');

          let screenshotBuffer: Buffer;
          if (selector) {
            const element = await currentPage.$(selector);
            if (!element) {
              return toolErrorResult(
                buildToolError('INVALID_INPUT', `Element not found: ${selector}`, requestId, false)
              );
            }
            screenshotBuffer = await element.screenshot({ type: 'png' });
          } else {
            screenshotBuffer = await currentPage.screenshot({
              type: 'png',
              fullPage: Boolean(args.fullPage),
            });
          }

          const base64Screenshot = screenshotBuffer.toString('base64');
          const responseContent: (TextContent | ImageContent)[] = [];

          if (savePng) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${screenshotName}-${timestamp}.png`;
            const downloadsDir = getStringArg(args, 'downloadsDir') ?? defaultDownloadsPath;
            if (!fs.existsSync(downloadsDir)) {
              fs.mkdirSync(downloadsDir, { recursive: true });
            }
            const filePath = path.join(downloadsDir, filename);
            await fs.promises.writeFile(filePath, screenshotBuffer);
            responseContent.push({ type: 'text', text: `Screenshot saved to: ${filePath}` });
          }

          if (storeBase64 && !process.argv.includes('--no-storebase64')) {
            resourceStore.addScreenshot(screenshotName, base64Screenshot);
            (server as { notification?: (payload: { method: string }) => void }).notification?.({
              method: 'notifications/resources/list_changed',
            });
            responseContent.push({
              type: 'image',
              data: base64Screenshot,
              mimeType: 'image/png',
            } as ImageContent);
          }

          auditAllow(requestId, name, startedAt, undefined, {
            selector: selector ?? null,
            storeBase64,
            savePng,
          });
          return { isError: false, content: responseContent };
        }

        case 'playwright_click': {
          if (!currentPage) {
            return toolErrorResult(
              buildToolError('INTERNAL_ERROR', 'browser page unavailable', requestId, false)
            );
          }
          const selector = getStringArg(args, 'selector');
          if (!selector) {
            return toolErrorResult(
              buildToolError('INVALID_INPUT', 'selector is required', requestId, false)
            );
          }
          const result = await runBrowserAction(
            currentPage,
            timeoutMs,
            selector,
            requestId,
            'click'
          );
          auditAllow(requestId, name, startedAt);
          return result;
        }

        case 'playwright_hover': {
          if (!currentPage) {
            return toolErrorResult(
              buildToolError('INTERNAL_ERROR', 'browser page unavailable', requestId, false)
            );
          }
          const selector = getStringArg(args, 'selector');
          if (!selector) {
            return toolErrorResult(
              buildToolError('INVALID_INPUT', 'selector is required', requestId, false)
            );
          }
          const result = await runBrowserAction(
            currentPage,
            timeoutMs,
            selector,
            requestId,
            'hover'
          );
          auditAllow(requestId, name, startedAt);
          return result;
        }

        case 'playwright_fill': {
          if (!currentPage) {
            return toolErrorResult(
              buildToolError('INTERNAL_ERROR', 'browser page unavailable', requestId, false)
            );
          }
          const selector = getStringArg(args, 'selector');
          if (!selector) {
            return toolErrorResult(
              buildToolError('INVALID_INPUT', 'selector is required', requestId, false)
            );
          }
          const result = await runBrowserAction(
            currentPage,
            timeoutMs,
            selector,
            requestId,
            'fill',
            getStringArg(args, 'value')
          );
          auditAllow(requestId, name, startedAt);
          return result;
        }

        case 'playwright_select': {
          if (!currentPage) {
            return toolErrorResult(
              buildToolError('INTERNAL_ERROR', 'browser page unavailable', requestId, false)
            );
          }
          const selector = getStringArg(args, 'selector');
          if (!selector) {
            return toolErrorResult(
              buildToolError('INVALID_INPUT', 'selector is required', requestId, false)
            );
          }
          const result = await runBrowserAction(
            currentPage,
            timeoutMs,
            selector,
            requestId,
            'select',
            getStringArg(args, 'value')
          );
          auditAllow(requestId, name, startedAt);
          return result;
        }

        case 'playwright_evaluate': {
          if (!currentPage) {
            return toolErrorResult(
              buildToolError('INTERNAL_ERROR', 'browser page unavailable', requestId, false)
            );
          }

          const script = getStringArg(args, 'script');
          if (!script) {
            return toolErrorResult(
              buildToolError('INVALID_INPUT', 'script is required', requestId, false)
            );
          }

          const result = await withTimeout(
            currentPage.evaluate(source => {
              const logs: string[] = [];
              const original = {
                log: console.log,
                info: console.info,
                warn: console.warn,
                error: console.error,
              };

              console.log = (...items: unknown[]) => logs.push(`[log] ${items.join(' ')}`);
              console.info = (...items: unknown[]) => logs.push(`[info] ${items.join(' ')}`);
              console.warn = (...items: unknown[]) => logs.push(`[warn] ${items.join(' ')}`);
              console.error = (...items: unknown[]) => logs.push(`[error] ${items.join(' ')}`);

              try {
                const evaluation = eval(source);
                return { evaluation, logs };
              } finally {
                console.log = original.log;
                console.info = original.info;
                console.warn = original.warn;
                console.error = original.error;
              }
            }, script),
            timeoutMs
          );

          auditAllow(requestId, name, startedAt);
          return toToolResult({ ok: true, requestId, result }, 'Script executed');
        }

        default:
          return toolErrorResult(
            buildToolError('INVALID_INPUT', `Unknown tool: ${name}`, requestId, false)
          );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith('REDIRECT_POLICY_DENIED|')) {
        const [, blockedUrl, reason] = message.split('|');
        return denyPolicy(
          requestId,
          name,
          reason ?? 'POLICY_DENIED',
          getHostFromUrl(blockedUrl) ?? undefined
        );
      }

      if (lastBlockedNavigation && message.includes('ERR_BLOCKED_BY_CLIENT')) {
        const blockedNavigation = lastBlockedNavigation;
        lastBlockedNavigation = null;
        return denyPolicy(
          requestId,
          name,
          blockedNavigation.reason,
          getHostFromUrl(blockedNavigation.url) ?? undefined
        );
      }

      const code =
        message === 'TIMEOUT'
          ? 'TIMEOUT'
          : message === 'REDIRECT_HOPS_EXCEEDED'
            ? 'POLICY_DENIED'
            : 'INTERNAL_ERROR';

      writeAudit(policy, {
        ts: new Date().toISOString(),
        requestId,
        tool: name,
        decision: 'error',
        code,
        latencyMs: Date.now() - startedAt,
        details: { message },
      });

      return toolErrorResult(
        buildToolError(
          code,
          code === 'TIMEOUT'
            ? 'Request timed out'
            : code === 'POLICY_DENIED'
              ? 'Redirect limit exceeded'
              : message,
          requestId,
          code === 'TIMEOUT',
          { tool: name }
        )
      );
    } finally {
      activeRequests -= 1;
      if (requiresBrowser) {
        activeBrowserRequests -= 1;
        // Auto-close browser after each tool call (best practice for security/isolation)
        await closeBrowser();
      }
    }
  }

  return {
    handleToolCall,
    resourceStore,
  };
}
