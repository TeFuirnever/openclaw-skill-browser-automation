const DEFAULT_MAX_CONSOLE_LOGS = 500;
const DEFAULT_MAX_SCREENSHOTS = 100;
const CONSOLE_LOGS_URI = 'console://logs';
const SCREENSHOT_URI_PREFIX = 'screenshot://';

export interface ResourceDescriptor {
  uri: string;
  mimeType: string;
  name: string;
}

export interface ResourceContent {
  uri: string;
  mimeType: string;
  text?: string;
  blob?: string;
}

export interface ResourceStoreStats {
  logsCount: number;
  screenshotsCount: number;
}

export interface ResourceStore {
  addConsoleLog(entry: string): void;
  addScreenshot(name: string, base64Data: string): void;
  listResources(): ResourceDescriptor[];
  readResource(uri: string): ResourceContent[] | null;
  getStats(): ResourceStoreStats;
}

export interface ResourceStoreOptions {
  maxConsoleLogs?: number;
  maxScreenshots?: number;
}

export function createResourceStore(options: ResourceStoreOptions = {}): ResourceStore {
  const maxConsoleLogs = options.maxConsoleLogs ?? DEFAULT_MAX_CONSOLE_LOGS;
  const maxScreenshots = options.maxScreenshots ?? DEFAULT_MAX_SCREENSHOTS;
  const consoleLogs: string[] = [];
  const screenshots = new Map<string, string>();

  function addConsoleLog(entry: string): void {
    consoleLogs.push(entry);
    if (consoleLogs.length > maxConsoleLogs) {
      consoleLogs.splice(0, consoleLogs.length - maxConsoleLogs);
    }
  }

  function addScreenshot(name: string, base64Data: string): void {
    screenshots.set(name, base64Data);
    if (screenshots.size > maxScreenshots) {
      const oldestKey = screenshots.keys().next().value;
      if (oldestKey) {
        screenshots.delete(oldestKey);
      }
    }
  }

  function listResources(): ResourceDescriptor[] {
    return [
      {
        uri: CONSOLE_LOGS_URI,
        mimeType: 'text/plain',
        name: 'Browser console logs',
      },
      ...Array.from(screenshots.keys()).map(name => ({
        uri: `${SCREENSHOT_URI_PREFIX}${name}`,
        mimeType: 'image/png',
        name: `Screenshot: ${name}`,
      })),
    ];
  }

  function readResource(uri: string): ResourceContent[] | null {
    if (uri === CONSOLE_LOGS_URI) {
      return [
        {
          uri,
          mimeType: 'text/plain',
          text: consoleLogs.join('\n'),
        },
      ];
    }

    if (!uri.startsWith(SCREENSHOT_URI_PREFIX)) {
      return null;
    }

    const name = uri.slice(SCREENSHOT_URI_PREFIX.length);
    const screenshot = screenshots.get(name);
    if (!screenshot) {
      return null;
    }

    return [
      {
        uri,
        mimeType: 'image/png',
        blob: screenshot,
      },
    ];
  }

  function getStats(): ResourceStoreStats {
    return {
      logsCount: consoleLogs.length,
      screenshotsCount: screenshots.size,
    };
  }

  return {
    addConsoleLog,
    addScreenshot,
    listResources,
    readResource,
    getStats,
  };
}
