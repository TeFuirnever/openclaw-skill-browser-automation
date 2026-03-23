#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { chromium, Browser, Page } from 'playwright';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';
import { AllowlistManager } from './allowlist.js';
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
          enum: ['duckduckgo', 'bing'],
          default: 'duckduckgo',
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
  // Close Tool
  {
    name: 'browser_close',
    description: 'Close the browser.',
    inputSchema: { type: 'object', properties: {} },
  },
];

// Browser state
let browser: Browser | null = null;
let page: Page | null = null;

// Initialize allowlist manager
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const defaultConfigPath = join(__dirname, '..', 'config.json');
const allowlistManager = new AllowlistManager(defaultConfigPath);

async function ensureBrowser() {
  if (!browser) {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  }
  return page!;
}

function buildSearchUrl(query: string, engine: string): string {
  const encoded = encodeURIComponent(query);
  switch (engine) {
    case 'bing':
      return `https://www.bing.com/search?q=${encoded}`;
    case 'duckduckgo':
    default:
      return `https://duckduckgo.com/?q=${encoded}`;
  }
}

async function extractSearchResults(page: Page, engine: string, limit: number) {
  await page.waitForLoadState('domcontentloaded');

  const results = await page.evaluate(({ engine, limit }) => {
    const items: Array<{ title: string; url: string; snippet: string }> = [];
    let selectors: string[];

    switch (engine) {
      case 'bing':
        selectors = ['#b_results .b_algo', '.b_algo'];
        break;
      case 'duckduckgo':
      default:
        selectors = ['#links .result', '.result', '[data-testid="result"]'];
    }

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
  }, { engine, limit });

  return results;
}

async function handleWebSearch(args: Record<string, unknown>) {
  const query = args.query as string;
  const engine = (args.engine as string) || 'duckduckgo';
  const limit = Math.min((args.limit as number) || 10, 50);

  if (!query || query.trim().length === 0) {
    return { content: [{ type: 'text', text: 'Error: query is required' }], isError: true };
  }

  const currentPage = await ensureBrowser();
  const searchUrl = buildSearchUrl(query, engine);

  // Validate search URL against allowlist
  const validation = allowlistManager.validateUrl(searchUrl);
  if (!validation.allowed) {
    return {
      content: [{ type: 'text', text: `Error: ${validation.reason}` }],
      isError: true,
    };
  }

  await currentPage.goto(searchUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });
  const results = await extractSearchResults(currentPage, engine, limit);

  const output = results
    .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`)
    .join('\n\n');

  return {
    content: [{
      type: 'text',
      text: `Search results for "${query}" (${engine}):\n\n${output || 'No results found'}`,
    }],
  };
}

async function handleWebFetch(args: Record<string, unknown>) {
  const url = args.url as string;
  const timeout = (args.timeout as number) || 30000;

  if (!url) {
    return { content: [{ type: 'text', text: 'Error: url is required' }], isError: true };
  }

  // Validate URL against allowlist
  const validation = allowlistManager.validateUrl(url);
  if (!validation.allowed) {
    return {
      content: [{ type: 'text', text: `Error: ${validation.reason}` }],
      isError: true,
    };
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
          return {
            content: [{ type: 'text', text: `Error: ${redirectValidation.reason}` }],
            isError: true,
          };
        }
        // If redirect is allowed, follow it
        return handleWebFetch({ url: location, timeout });
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
      content: [{
        type: 'text',
        text: `Fetched: ${url}\nStatus: ${response.status}\nContent-Type: ${contentType}\n\n${body}`,
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error fetching ${url}: ${error}` }],
      isError: true,
    };
  }
}

async function handleExtract(args: Record<string, unknown>) {
  const url = args.url as string;
  const selector = (args.selector as string) || 'body';

  if (!url) {
    return { content: [{ type: 'text', text: 'Error: url is required' }], isError: true };
  }

  // Validate URL against allowlist
  const validation = allowlistManager.validateUrl(url);
  if (!validation.allowed) {
    return {
      content: [{ type: 'text', text: `Error: ${validation.reason}` }],
      isError: true,
    };
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
        content: [{
          type: 'text',
          text: `Extracted from: ${url}\nTitle: ${article.title}\n\n${article.textContent}`,
        }],
      };
    }

    // Fallback: extract by selector
    const currentPage = await ensureBrowser();
    await currentPage.goto(url, { timeout: 30000, waitUntil: 'load' });
    const text = await currentPage.locator(selector).innerText();

    return {
      content: [{
        type: 'text',
        text: `Extracted from: ${url}\nSelector: ${selector}\n\n${text}`,
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error extracting from ${url}: ${error}` }],
      isError: true,
    };
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
  const currentPage = await ensureBrowser();
  const snapshot = await (currentPage as any).accessibility.snapshot();
  return {
    content: [{ type: 'text', text: JSON.stringify(snapshot, null, 2) }],
  };
}

async function handleClick(args: Record<string, unknown>) {
  const ref = args.ref as string;
  const currentPage = await ensureBrowser();

  // Use ref as selector or aria-label
  try {
    await currentPage.click(`[aria-label="${ref}"]`);
  } catch {
    await currentPage.click(ref);
  }

  return {
    content: [{ type: 'text', text: `Clicked: ${ref}` }],
  };
}

async function handleType(args: Record<string, unknown>) {
  const ref = args.ref as string;
  const text = args.text as string;
  const currentPage = await ensureBrowser();

  try {
    await currentPage.fill(`[aria-label="${ref}"]`, text);
  } catch {
    await currentPage.fill(ref, text);
  }

  return {
    content: [{ type: 'text', text: `Typed into: ${ref}` }],
  };
}

async function handleScreenshot(args: Record<string, unknown>) {
  const fullPage = args.fullPage as boolean;
  const currentPage = await ensureBrowser();
  const screenshot = await currentPage.screenshot({ fullPage, type: 'png' });
  const base64 = screenshot.toString('base64');

  return {
    content: [{
      type: 'image',
      data: base64,
      mimeType: 'image/png',
    }],
  };
}

async function handleWaitFor(args: Record<string, unknown>) {
  const currentPage = await ensureBrowser();

  if (args.text) {
    await currentPage.waitForSelector(`text=${args.text}`, { timeout: 30000 });
  } else if (args.time) {
    await new Promise(resolve => setTimeout(resolve, (args.time as number) * 1000));
  }

  return {
    content: [{ type: 'text', text: 'Wait complete' }],
  };
}

async function handleClose() {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
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
    tools: tools.map(t => ({
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
