import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { CapabilityPolicy } from './policyTypes.js';

export type ToolCapability = keyof CapabilityPolicy | 'always' | 'advancedBrowserOpsOrDownload';

export interface ToolMetadata {
  capability: ToolCapability;
  definition: Tool;
  requiresBrowser: boolean;
}

const TOOL_METADATA: ToolMetadata[] = [
  {
    capability: 'always',
    requiresBrowser: false,
    definition: {
      name: 'playwright_add_domain',
      description: "Add a domain to user's trusted domains list.",
      inputSchema: {
        type: 'object',
        properties: {
          domain: { type: 'string', description: 'Domain to add (e.g., example.com)' },
        },
        required: ['domain'],
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
  },
  {
    capability: 'always',
    requiresBrowser: false,
    definition: {
      name: 'playwright_remove_domain',
      description: "Remove a domain from user's trusted domains list.",
      inputSchema: {
        type: 'object',
        properties: {
          domain: { type: 'string', description: 'Domain to remove' },
        },
        required: ['domain'],
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
  },
  {
    capability: 'always',
    requiresBrowser: false,
    definition: {
      name: 'playwright_list_domains',
      description: 'List all trusted domains (server + user configured).',
      inputSchema: { type: 'object', properties: {} },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
  },
  {
    capability: 'always',
    requiresBrowser: false,
    definition: {
      name: 'playwright_policy_status',
      description: 'Get effective security policy and runtime diagnostics for this MCP server.',
      inputSchema: { type: 'object', properties: {} },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
  },
  {
    capability: 'webSearch',
    requiresBrowser: true,
    definition: {
      name: 'playwright_web_search',
      description: 'Run a web search using a supported search engine and return result links.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', minLength: 1, description: 'Search query' },
          engine: {
            type: 'string',
            description: 'Search engine: duckduckgo|bing',
            enum: ['duckduckgo', 'bing'],
            default: 'duckduckgo',
          },
          limit: { type: 'number', minimum: 1, maximum: 50, description: 'Max results to return' },
          timeout: {
            type: 'number',
            minimum: 1000,
            maximum: 60000,
            description: 'Timeout in milliseconds',
          },
        },
        required: ['query'],
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
  },
  {
    capability: 'extract',
    requiresBrowser: true,
    definition: {
      name: 'playwright_extract',
      description: 'Extract readable text from an allowed web page.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri', description: 'Target URL to extract content from' },
          selector: { type: 'string', description: 'Optional CSS selector; default is body' },
          timeout: {
            type: 'number',
            minimum: 1000,
            maximum: 60000,
            description: 'Timeout in milliseconds',
          },
        },
        required: ['url'],
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
  },
  {
    capability: 'webFetch',
    requiresBrowser: false,
    definition: {
      name: 'playwright_web_fetch',
      description: 'Fetch page content via HTTP GET from an allowed domain.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri', description: 'URL to fetch' },
          timeout: {
            type: 'number',
            minimum: 1000,
            maximum: 60000,
            description: 'Timeout in milliseconds',
          },
        },
        required: ['url'],
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
  },
  {
    capability: 'advancedBrowserOps',
    requiresBrowser: true,
    definition: {
      name: 'playwright_navigate',
      description: 'Navigate browser page to a URL.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri' },
          width: {
            type: 'number',
            minimum: 320,
            maximum: 4096,
            description: 'Viewport width (default: 1920)',
          },
          height: {
            type: 'number',
            minimum: 240,
            maximum: 4096,
            description: 'Viewport height (default: 1080)',
          },
          timeout: {
            type: 'number',
            minimum: 1000,
            maximum: 60000,
            description: 'Navigation timeout in milliseconds',
          },
          waitUntil: {
            type: 'string',
            enum: ['domcontentloaded', 'load', 'networkidle', 'commit'],
            description: 'Navigation wait condition',
            default: 'load',
          },
        },
        required: ['url'],
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
  },
  {
    capability: 'advancedBrowserOpsOrDownload',
    requiresBrowser: true,
    definition: {
      name: 'playwright_screenshot',
      description: 'Take a screenshot of the current page or a specific element.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Optional screenshot name; default generated' },
          selector: { type: 'string', description: 'CSS selector for element screenshot' },
          width: {
            type: 'number',
            minimum: 320,
            maximum: 4096,
            description: 'Viewport width (default: 1920)',
          },
          height: {
            type: 'number',
            minimum: 240,
            maximum: 4096,
            description: 'Viewport height (default: 1080)',
          },
          storeBase64: {
            type: 'boolean',
            description: 'Store screenshot in memory (default: true)',
          },
          savePng: { type: 'boolean', description: 'Save screenshot as PNG file (default: true)' },
          downloadsDir: { type: 'string', description: 'Custom downloads directory path' },
          timeout: {
            type: 'number',
            minimum: 1000,
            maximum: 60000,
            description: 'Timeout in milliseconds',
          },
        },
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
  },
  {
    capability: 'advancedBrowserOps',
    requiresBrowser: true,
    definition: {
      name: 'playwright_click',
      description: 'Click an element on the page.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector for element to click' },
          timeout: {
            type: 'number',
            minimum: 1000,
            maximum: 60000,
            description: 'Timeout in milliseconds',
          },
        },
        required: ['selector'],
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
  },
  {
    capability: 'advancedBrowserOps',
    requiresBrowser: true,
    definition: {
      name: 'playwright_fill',
      description: 'Fill an input field.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector for input field' },
          value: { type: 'string', description: 'Value to fill' },
          timeout: {
            type: 'number',
            minimum: 1000,
            maximum: 60000,
            description: 'Timeout in milliseconds',
          },
        },
        required: ['selector', 'value'],
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
  },
  {
    capability: 'advancedBrowserOps',
    requiresBrowser: true,
    definition: {
      name: 'playwright_select',
      description: 'Select value in a select element.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector for select element' },
          value: { type: 'string', description: 'Value to select' },
          timeout: {
            type: 'number',
            minimum: 1000,
            maximum: 60000,
            description: 'Timeout in milliseconds',
          },
        },
        required: ['selector', 'value'],
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
  },
  {
    capability: 'advancedBrowserOps',
    requiresBrowser: true,
    definition: {
      name: 'playwright_hover',
      description: 'Hover an element on the page.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector for element to hover' },
          timeout: {
            type: 'number',
            minimum: 1000,
            maximum: 60000,
            description: 'Timeout in milliseconds',
          },
        },
        required: ['selector'],
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
  },
  {
    capability: 'evalScript',
    requiresBrowser: true,
    definition: {
      name: 'playwright_evaluate',
      description: 'Execute JavaScript in browser context (disabled by default policy).',
      inputSchema: {
        type: 'object',
        properties: {
          script: { type: 'string', description: 'JavaScript code to execute' },
          timeout: {
            type: 'number',
            minimum: 1000,
            maximum: 60000,
            description: 'Timeout in milliseconds',
          },
        },
        required: ['script'],
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
  },
];

const TOOL_METADATA_BY_NAME = new Map<string, ToolMetadata>(
  TOOL_METADATA.map(metadata => [metadata.definition.name, metadata])
);

export function createToolDefinitions(): Tool[] {
  return TOOL_METADATA.map(metadata => metadata.definition);
}

export function getToolMetadata(name: string): ToolMetadata | undefined {
  return TOOL_METADATA_BY_NAME.get(name);
}

export function isBrowserTool(name: string): boolean {
  return getToolMetadata(name)?.requiresBrowser ?? false;
}
