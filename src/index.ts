#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { chromium, Browser, Page } from 'playwright';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';
import { AllowlistManager } from './allowlist.js';
import { BrowserSkillError, ErrorCode, createUrlError } from './errors.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Tool definitions
const tools = [
  // Web Search Tool
  {
    name: 'browser_web_search',
    description: 'Run a web search using DuckDuckGo or Bing and return result links.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        engine: {
          type: 'string',
          enum: ['bing'],
          default: 'bing',
          description: 'Search engine to use',
        },
        limit: { type: 'number', default: 10, description: 'Max results to return' },
      },
      required: ['query'],
    },
  },
  // Web Fetch Tool
  {
    name: 'browser_web_fetch',
    description: 'Fetch page content via HTTP GET. Returns raw HTML/text content.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri', description: 'URL to fetch' },
        timeout: { type: 'number', default: 30000, description: 'Timeout in milliseconds' },
      },
      required: ['url'],
    },
  },
  // Extract Tool
  {
    name: 'browser_extract',
    description: 'Extract readable text content from a web page using Mozilla Readability.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri', description: 'URL to extract content from' },
        selector: { type: 'string', default: 'body', description: 'CSS selector for content area' },
      },
      required: ['url'],
    },
  },
  // Navigate Tool
  {
    name: 'browser_navigate',
    description: 'Navigate browser to a URL.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri', description: 'URL to navigate to' },
      },
      required: ['url'],
    },
  },
  // Snapshot Tool
  {
    name: 'browser_snapshot',
    description: 'Capture accessibility snapshot of the current page (preferred for AI).',
    inputSchema: { type: 'object', properties: {} },
  },
  // Click Tool
  {
    name: 'browser_click',
    description: 'Click an element on the page.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Element reference from snapshot' },
        element: { type: 'string', description: 'Element description' },
      },
      required: ['ref'],
    },
  },
  // Type Tool
  {
    name: 'browser_type',
    description: 'Type text into an element.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Element reference from snapshot' },
        text: { type: 'string', description: 'Text to type' },
        element: { type: 'string', description: 'Element description' },
      },
      required: ['ref', 'text'],
    },
  },
  // Screenshot Tool
  {
    name: 'browser_screenshot',
    description: 'Take a screenshot of the current page.',
    inputSchema: {
      type: 'object',
      properties: {
        fullPage: { type: 'boolean', default: false, description: 'Capture full scrollable page' },
      },
    },
  },
  // Wait For Tool
  {
    name: 'browser_wait_for',
    description: 'Wait for text or element to appear.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to wait for' },
        time: { type: 'number', description: 'Time to wait in seconds' },
      },
    },
  },
  // Attach Tab Tool - Connect to existing Chrome via CDP
  {
    name: 'browser_attach_tab',
    description:
      'Connect to an existing Chrome browser via Chrome DevTools Protocol. Requires Chrome to be started with --remote-debugging-port=9222. Returns list of available tabs.',
    inputSchema: {
      type: 'object',
      properties: {
        cdpEndpoint: {
          type: 'string',
          description: 'Chrome DevTools Protocol endpoint (default: http://localhost:9222)',
          default: 'http://localhost:9222',
        },
        tabIndex: {
          type: 'number',
          description:
            'Index of the tab to attach to (0-based). If not specified, attaches to the first available page.',
        },
        url: {
          type: 'string',
          description: 'URL pattern to match (e.g., "github.com" to attach to any GitHub tab)',
        },
      },
    },
  },
  // List Tabs Tool
  {
    name: 'browser_list_tabs',
    description:
      'List all available tabs in a Chrome instance connected via CDP. Use this to find the correct tab to attach.',
    inputSchema: {
      type: 'object',
      properties: {
        cdpEndpoint: {
          type: 'string',
          description: 'Chrome DevTools Protocol endpoint (default: http://localhost:9222)',
          default: 'http://localhost:9222',
        },
      },
    },
  },
  // Status Tool
  {
    name: 'browser_status',
    description:
      'Get current browser connection status. Shows whether connected, browser mode (CDP/Playwright), and current page URL.',
    inputSchema: { type: 'object', properties: {} },
  },
  // Close Tool
  {
    name: 'browser_close',
    description: 'Close the browser.',
    inputSchema: { type: 'object', properties: {} },
  },
];

// Browser state - unified management
let browser: Browser | null = null;
let page: Page | null = null;
let browserMode: 'cdp' | 'playwright' | null = null;
const DEFAULT_CDP_ENDPOINT = 'http://localhost:9222';
const MAX_REDIRECT_DEPTH = 5;

/**
 * Validate CDP endpoint URL to prevent SSRF attacks.
 * Only allows localhost connections for security.
 */
function validateCdpEndpoint(cdpEndpoint: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(cdpEndpoint);

    // Only allow http/https schemes
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, error: 'Invalid protocol. Only http and https are allowed.' };
    }

    // Only allow localhost addresses to prevent SSRF
    const allowedHosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
    const hostname = url.hostname.toLowerCase();

    if (!allowedHosts.includes(hostname)) {
      return {
        valid: false,
        error:
          `CDP endpoint must be localhost. Got: ${hostname}. ` +
          'For security, only local Chrome instances are supported.',
      };
    }

    // Validate port range (typically 9222, but allow any non-privileged port)
    const port = parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80);
    if (port < 1024 || port > 65535) {
      return { valid: false, error: `Invalid port: ${port}. Must be between 1024-65535.` };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: `Invalid URL format: ${cdpEndpoint}` };
  }
}

// Initialize allowlist manager
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const defaultConfigPath = join(__dirname, '..', 'config.json');
const allowlistManager = new AllowlistManager(defaultConfigPath);

// Help message for Chrome setup
const CHROME_SETUP_GUIDE = `
📱 Browser Setup Required

This skill requires Chrome with remote debugging enabled.

Quick Setup (one-time):
────────────────────────
Linux:    google-chrome --remote-debugging-port=9222
macOS:    /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222
Windows:  chrome.exe --remote-debugging-port=9222

Why? This allows the skill to control your Chrome browser safely.
`;

/**
 * Try to connect to local Chrome via CDP.
 * Returns true if successful, false otherwise.
 */
async function tryConnectToChrome(): Promise<boolean> {
  try {
    const cdpBrowser = await chromium.connectOverCDP(DEFAULT_CDP_ENDPOINT);
    const contexts = cdpBrowser.contexts();
    if (contexts.length > 0) {
      const pages = contexts[0].pages();
      if (pages.length > 0) {
        browser = cdpBrowser;
        page = pages[0];
        browserMode = 'cdp';
        console.error('[Browser] Connected to local Chrome via CDP');
        return true;
      }
      // Create new page if none exists
      page = await contexts[0].newPage();
      browser = cdpBrowser;
      browserMode = 'cdp';
      console.error('[Browser] Connected to local Chrome via CDP (new page)');
      return true;
    }
    await cdpBrowser.close();
  } catch {
    // Chrome not available via CDP
  }
  return false;
}

/**
 * Ensure browser is available.
 * Requires local Chrome with remote debugging - no auto-download.
 */
async function ensureBrowser(): Promise<Page> {
  if (browser && page) {
    return page;
  }

  // Try local Chrome first
  const chromeConnected = await tryConnectToChrome();
  if (chromeConnected) {
    return page!;
  }

  // No Chrome available - show helpful error
  throw new Error(
    `Browser not available.${CHROME_SETUP_GUIDE}` + `After starting Chrome, retry your command.`
  );
}

/**
 * Get current browser status
 */
function getBrowserStatus(): { connected: boolean; mode: string | null } {
  return {
    connected: browser !== null && page !== null,
    mode: browserMode,
  };
}

/**
 * Validate that the current page URL is allowed by the allowlist.
 * This prevents bypass via in-page navigation (clicking links).
 */
async function validateCurrentPageUrl(): Promise<void> {
  const currentPage = await ensureBrowser();
  const currentUrl = currentPage.url();

  // Skip validation for blank pages
  if (currentUrl === 'about:blank' || currentUrl === 'chrome://newtab/') {
    return;
  }

  const validation = allowlistManager.validateUrl(currentUrl);
  if (!validation.allowed) {
    // Navigate to blank page to clear the disallowed content
    await currentPage.goto('about:blank');
    throw new Error(
      `Security: Current page URL "${currentUrl}" is not in the allowlist. ` +
        `Reason: ${validation.reason || 'Domain not allowed'}`
    );
  }
}

function buildSearchUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  return `https://www.bing.com/search?q=${encoded}`;
}

async function extractSearchResults(page: Page, limit: number) {
  await page.waitForLoadState('domcontentloaded');

  const results = await page.evaluate(
    ({ limit }) => {
      const items: Array<{ title: string; url: string; snippet: string }> = [];
      const selectors = ['#b_results .b_algo', '.b_algo'];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          elements.forEach((el, i) => {
            if (i >= limit) return;
            const link = el.querySelector('a[href]');
            const titleEl = el.querySelector('h2, h3, .title');
            const snippetEl = el.querySelector('p, .snippet, .description');

            if (link && titleEl) {
              const href = link.getAttribute('href');
              if (href && !href.startsWith('javascript:')) {
                items.push({
                  title: titleEl.textContent?.trim() || '',
                  url: href,
                  snippet: snippetEl?.textContent?.trim() || '',
                });
              }
            }
          });
          if (items.length > 0) break;
        }
      }

      return items;
    },
    { limit }
  );

  return results;
}

async function handleWebSearch(args: Record<string, unknown>) {
  const query = args.query as string;
  const engine = (args.engine as string) || 'bing';
  const limit = Math.min((args.limit as number) || 10, 50);

  if (!query || query.trim().length === 0) {
    return { content: [{ type: 'text', text: 'Error: query is required' }], isError: true };
  }

  const currentPage = await ensureBrowser();
  const searchUrl = buildSearchUrl(query);

  // Validate search URL against allowlist
  const validation = allowlistManager.validateUrl(searchUrl);
  if (!validation.allowed) {
    return {
      content: [{ type: 'text', text: `Error: ${validation.reason}` }],
      isError: true,
    };
  }

  await currentPage.goto(searchUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });
  const results = await extractSearchResults(currentPage, limit);

  const output = results
    .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`)
    .join('\n\n');

  return {
    content: [
      {
        type: 'text',
        text: `Search results for "${query}" (${engine}):\n\n${output || 'No results found'}`,
      },
    ],
  };
}

async function handleWebFetch(
  args: Record<string, unknown>,
  redirectDepth: number = 0
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const url = args.url as string;
  const timeout = (args.timeout as number) || 30000;

  if (!url) {
    return createUrlError(ErrorCode.URL_REQUIRED, '').toMcpResponse();
  }

  // Validate URL against allowlist
  const validation = allowlistManager.validateUrl(url);
  if (!validation.allowed) {
    const errorCode = validation.reason?.includes('IP addresses')
      ? ErrorCode.URL_IP_NOT_ALLOWED
      : ErrorCode.URL_DOMAIN_NOT_ALLOWED;
    return createUrlError(errorCode, url, validation.reason).toMcpResponse();
  }

  // Security: Check redirect depth to prevent infinite loops
  if (redirectDepth >= MAX_REDIRECT_DEPTH) {
    return createUrlError(
      ErrorCode.URL_REDIRECT_BLOCKED,
      url,
      `Maximum redirect depth (${MAX_REDIRECT_DEPTH}) exceeded`
    ).toMcpResponse();
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Security: Disable automatic redirects to prevent bypass
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'manual', // Don't follow redirects automatically
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OpenClawBot/1.0)',
      },
    } as any);

    clearTimeout(timeoutId);

    // Handle redirect manually with allowlist validation
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        // Validate redirect URL against allowlist
        const redirectValidation = allowlistManager.validateRedirectUrl(url, location);
        if (!redirectValidation.allowed) {
          return createUrlError(
            ErrorCode.URL_REDIRECT_BLOCKED,
            location,
            redirectValidation.reason
          ).toMcpResponse();
        }
        // If redirect is allowed, follow it with incremented depth
        return handleWebFetch({ url: location, timeout }, redirectDepth + 1);
      }
    }

    const contentType = response.headers.get('content-type') || '';
    let body: string;

    if (contentType.includes('application/json')) {
      body = JSON.stringify(await response.json(), null, 2);
    } else {
      body = await response.text();
      // Truncate large responses
      if (body.length > 50000) {
        body = body.substring(0, 50000) + '\n\n[Content truncated...]';
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `Fetched: ${url}\nStatus: ${response.status}\nContent-Type: ${contentType}\n\n${body}`,
        },
      ],
    };
  } catch (error) {
    const skillError = BrowserSkillError.fromUnknown(error, `Failed to fetch ${url}`);
    return skillError.toMcpResponse();
  }
}

async function handleExtract(args: Record<string, unknown>) {
  const url = args.url as string;
  const selector = (args.selector as string) || 'body';

  if (!url) {
    return createUrlError(ErrorCode.URL_REQUIRED, '').toMcpResponse();
  }

  // Validate URL against allowlist
  const validation = allowlistManager.validateUrl(url);
  if (!validation.allowed) {
    const errorCode = validation.reason?.includes('IP addresses')
      ? ErrorCode.URL_IP_NOT_ALLOWED
      : ErrorCode.URL_DOMAIN_NOT_ALLOWED;
    return createUrlError(errorCode, url, validation.reason).toMcpResponse();
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OpenClawBot/1.0)',
      },
    } as any);

    const html = await response.text();

    // Use Readability to extract main content
    const doc = new JSDOM(html, { url });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    if (article) {
      return {
        content: [
          {
            type: 'text',
            text: `Extracted from: ${url}\nTitle: ${article.title}\n\n${article.textContent}`,
          },
        ],
      };
    }

    // Fallback: extract by selector
    const currentPage = await ensureBrowser();
    await currentPage.goto(url, { timeout: 30000, waitUntil: 'load' });
    const text = await currentPage.locator(selector).innerText();

    return {
      content: [
        {
          type: 'text',
          text: `Extracted from: ${url}\nSelector: ${selector}\n\n${text}`,
        },
      ],
    };
  } catch (error) {
    const skillError = BrowserSkillError.fromUnknown(error, `Failed to extract from ${url}`);
    return skillError.toMcpResponse();
  }
}

async function handleNavigate(args: Record<string, unknown>) {
  const url = args.url as string;

  // Validate URL against allowlist
  const validation = allowlistManager.validateUrl(url);
  if (!validation.allowed) {
    return {
      content: [{ type: 'text', text: `Error: ${validation.reason}` }],
      isError: true,
    };
  }

  const currentPage = await ensureBrowser();
  await currentPage.goto(url, { timeout: 30000, waitUntil: 'load' });
  return {
    content: [{ type: 'text', text: `Navigated to: ${currentPage.url()}` }],
  };
}

async function handleSnapshot() {
  try {
    await validateCurrentPageUrl();
    const currentPage = await ensureBrowser();
    const snapshot = await (currentPage as any).accessibility.snapshot();
    return {
      content: [{ type: 'text', text: JSON.stringify(snapshot, null, 2) }],
    };
  } catch (error) {
    return BrowserSkillError.fromUnknown(error).toMcpResponse();
  }
}

async function handleClick(args: Record<string, unknown>) {
  const ref = args.ref as string;

  try {
    const currentPage = await ensureBrowser();

    // Use ref as selector or aria-label
    try {
      await currentPage.click(`[aria-label="${ref}"]`);
    } catch {
      await currentPage.click(ref);
    }

    // Security: Validate URL after click to prevent navigation to disallowed pages
    await validateCurrentPageUrl();

    return {
      content: [{ type: 'text', text: `Clicked: ${ref}` }],
    };
  } catch (error) {
    return BrowserSkillError.fromUnknown(error, 'Click operation failed').toMcpResponse();
  }
}

async function handleType(args: Record<string, unknown>) {
  const ref = args.ref as string;
  const text = args.text as string;

  try {
    const currentPage = await ensureBrowser();

    try {
      await currentPage.fill(`[aria-label="${ref}"]`, text);
    } catch {
      await currentPage.fill(ref, text);
    }

    // Security: Validate URL after type to catch any JavaScript-initiated navigation
    await validateCurrentPageUrl();

    return {
      content: [{ type: 'text', text: `Typed into: ${ref}` }],
    };
  } catch (error) {
    return BrowserSkillError.fromUnknown(error, 'Type operation failed').toMcpResponse();
  }
}

async function handleScreenshot(args: Record<string, unknown>) {
  const fullPage = args.fullPage as boolean;

  try {
    await validateCurrentPageUrl();
    const currentPage = await ensureBrowser();
    const screenshot = await currentPage.screenshot({ fullPage, type: 'png' });
    const base64 = screenshot.toString('base64');

    return {
      content: [
        {
          type: 'image',
          data: base64,
          mimeType: 'image/png',
        },
      ],
    };
  } catch (error) {
    return BrowserSkillError.fromUnknown(error, 'Screenshot operation failed').toMcpResponse();
  }
}

async function handleWaitFor(args: Record<string, unknown>) {
  try {
    await validateCurrentPageUrl();
    const currentPage = await ensureBrowser();

    if (args.text) {
      await currentPage.waitForSelector(`text=${args.text}`, { timeout: 30000 });
    } else if (args.time) {
      await new Promise((resolve) => setTimeout(resolve, (args.time as number) * 1000));
    }

    return {
      content: [{ type: 'text', text: 'Wait complete' }],
    };
  } catch (error) {
    return BrowserSkillError.fromUnknown(error, 'Wait operation failed').toMcpResponse();
  }
}

// CDP types
interface CdpTarget {
  id: string;
  title: string;
  url: string;
  type: string;
}

async function fetchCdpTargets(cdpEndpoint: string): Promise<CdpTarget[]> {
  try {
    const response = await fetch(`${cdpEndpoint}/json/list`);
    if (!response.ok) {
      throw new Error(`CDP endpoint returned ${response.status}`);
    }
    const targets = (await response.json()) as CdpTarget[];
    return targets.filter((t) => t.type === 'page');
  } catch (error) {
    throw new Error(
      `Failed to connect to Chrome at ${cdpEndpoint}. ` +
        `Make sure Chrome is running with --remote-debugging-port=9222. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function handleListTabs(args: Record<string, unknown>) {
  const cdpEndpoint = (args.cdpEndpoint as string) || DEFAULT_CDP_ENDPOINT;

  // Security: Validate CDP endpoint to prevent SSRF
  const cdpValidation = validateCdpEndpoint(cdpEndpoint);
  if (!cdpValidation.valid) {
    return {
      content: [
        {
          type: 'text',
          text: `Security Error: ${cdpValidation.error}`,
        },
      ],
      isError: true,
    };
  }

  try {
    const targets = await fetchCdpTargets(cdpEndpoint);

    if (targets.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text:
              `No browser tabs found at ${cdpEndpoint}.\n\n` +
              `Make sure Chrome is running with remote debugging enabled:\n` +
              `  chrome --remote-debugging-port=9222\n` +
              `Or on macOS:\n` +
              `  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222`,
          },
        ],
      };
    }

    const tabList = targets
      .map((t, i) => `[${i}] ${t.title}\n    URL: ${t.url}\n    ID: ${t.id.substring(0, 8)}...`)
      .join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text:
            `Available tabs at ${cdpEndpoint}:\n\n${tabList}\n\n` +
            `Use browser_attach_tab with tabIndex or url pattern to attach.`,
        },
      ],
    };
  } catch (error) {
    return BrowserSkillError.fromUnknown(error, 'Failed to list tabs').toMcpResponse();
  }
}

async function handleAttachTab(args: Record<string, unknown>) {
  const cdpEndpoint = (args.cdpEndpoint as string) || DEFAULT_CDP_ENDPOINT;
  const tabIndex = args.tabIndex as number | undefined;
  const urlPattern = args.url as string | undefined;

  // Security: Validate CDP endpoint to prevent SSRF
  const cdpValidation = validateCdpEndpoint(cdpEndpoint);
  if (!cdpValidation.valid) {
    return {
      content: [
        {
          type: 'text',
          text: `Security Error: ${cdpValidation.error}`,
        },
      ],
      isError: true,
    };
  }

  try {
    // Close existing browser if in standalone mode
    if (browser && browserMode !== 'cdp') {
      await browser.close();
      browser = null;
      page = null;
    }

    // Get available targets
    const targets = await fetchCdpTargets(cdpEndpoint);

    if (targets.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No tabs found. Open a tab in Chrome first, then try again.`,
          },
        ],
        isError: true,
      };
    }

    // Find the target to attach to
    let selectedTarget: CdpTarget | undefined;

    if (urlPattern) {
      // Match by URL pattern
      selectedTarget = targets.find((t) => t.url.toLowerCase().includes(urlPattern.toLowerCase()));
      if (!selectedTarget) {
        const availableUrls = targets.map((t) => t.url).join('\n  ');
        return {
          content: [
            {
              type: 'text',
              text: `No tab found matching URL pattern "${urlPattern}".\n\nAvailable URLs:\n  ${availableUrls}`,
            },
          ],
          isError: true,
        };
      }
    } else if (tabIndex !== undefined) {
      // Match by index
      if (tabIndex < 0 || tabIndex >= targets.length) {
        return {
          content: [
            {
              type: 'text',
              text: `Tab index ${tabIndex} out of range. Available: 0-${targets.length - 1}`,
            },
          ],
          isError: true,
        };
      }
      selectedTarget = targets[tabIndex];
    } else {
      // Default: attach to first tab
      selectedTarget = targets[0];
    }

    // Connect to Chrome via CDP
    browser = await chromium.connectOverCDP(cdpEndpoint);
    browserMode = 'cdp';

    // Get all contexts and find the page
    const contexts = browser.contexts();
    let foundPage: Page | null = null;

    for (const context of contexts) {
      const pages = context.pages();
      for (const p of pages) {
        if (p.url() === selectedTarget!.url) {
          foundPage = p;
          break;
        }
      }
      if (foundPage) break;
    }

    if (!foundPage) {
      // Fallback: use first available page
      for (const context of contexts) {
        const pages = context.pages();
        if (pages.length > 0) {
          foundPage = pages[0];
          break;
        }
      }
    }

    if (!foundPage) {
      return {
        content: [
          {
            type: 'text',
            text: `Connected to Chrome but could not find the target page.`,
          },
        ],
        isError: true,
      };
    }

    // Validate the page URL against allowlist
    const validation = allowlistManager.validateUrl(foundPage.url());
    if (
      !validation.allowed &&
      foundPage.url() !== 'about:blank' &&
      !foundPage.url().startsWith('chrome://')
    ) {
      return {
        content: [
          {
            type: 'text',
            text:
              `Security: Cannot attach to tab with URL "${foundPage.url()}" - ` +
              `${validation.reason || 'Domain not allowed'}`,
          },
        ],
        isError: true,
      };
    }

    page = foundPage;

    return {
      content: [
        {
          type: 'text',
          text:
            `✅ Successfully attached to tab!\n\n` +
            `Title: ${selectedTarget.title}\n` +
            `URL: ${selectedTarget.url}\n\n` +
            `You can now use browser_snapshot, browser_click, browser_type, etc. ` +
            `to interact with this page.`,
        },
      ],
    };
  } catch (error) {
    return BrowserSkillError.fromUnknown(error, 'Failed to attach to tab').toMcpResponse();
  }
}

async function handleStatus() {
  const status = getBrowserStatus();
  let currentUrl = '';

  if (page) {
    try {
      currentUrl = page.url();
    } catch {
      currentUrl = '(page unavailable)';
    }
  }

  const modeDescription = {
    cdp: 'Connected to local Chrome via CDP (reuses your Chrome)',
    playwright: 'Playwright Chromium (headless browser)',
    null: 'Not connected',
  };

  return {
    content: [
      {
        type: 'text',
        text:
          `Browser Status:\n` +
          `- Connected: ${status.connected ? 'Yes' : 'No'}\n` +
          `- Mode: ${status.mode || 'None'}\n` +
          `- Description: ${modeDescription[status.mode as keyof typeof modeDescription] || 'Unknown'}\n` +
          `- Current URL: ${currentUrl || 'N/A'}\n\n` +
          `To use local Chrome, start it with:\n` +
          `  google-chrome --remote-debugging-port=9222`,
      },
    ],
  };
}

async function handleClose() {
  if (browserMode === 'cdp' && browser) {
    // In CDP mode, disconnect but don't close the user's Chrome
    await browser.close(); // This disconnects without closing Chrome
    browser = null;
    page = null;
    browserMode = null;
    return {
      content: [{ type: 'text', text: 'Disconnected from Chrome (tab remains open)' }],
    };
  }

  if (browser) {
    await browser.close();
    browser = null;
    page = null;
    browserMode = null;
  }
  return {
    content: [{ type: 'text', text: 'Browser closed' }],
  };
}

// Tool handler
async function handleToolCall(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'browser_web_search':
      return handleWebSearch(args);
    case 'browser_web_fetch':
      return handleWebFetch(args);
    case 'browser_extract':
      return handleExtract(args);
    case 'browser_navigate':
      return handleNavigate(args);
    case 'browser_snapshot':
      return handleSnapshot();
    case 'browser_click':
      return handleClick(args);
    case 'browser_type':
      return handleType(args);
    case 'browser_screenshot':
      return handleScreenshot(args);
    case 'browser_wait_for':
      return handleWaitFor(args);
    case 'browser_attach_tab':
      return handleAttachTab(args);
    case 'browser_list_tabs':
      return handleListTabs(args);
    case 'browser_status':
      return handleStatus();
    case 'browser_close':
      return handleClose();
    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

// Create and run server
async function main() {
  // Load allowlist configuration
  await allowlistManager.loadConfig();

  const server = new Server(
    {
      name: 'openclaw-skill-browser-automation',
      version: '1.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, args || {});
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('OpenClaw Browser Automation MCP server running');
}

main().catch(console.error);
