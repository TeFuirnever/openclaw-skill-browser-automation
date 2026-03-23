import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AllowlistManager } from '../src/allowlist.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// Mock file system for allowlist config
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
  };
});

describe('Allowlist Integration', () => {
  let allowlistManager: AllowlistManager;

  beforeEach(() => {
    vi.clearAllMocks();
    allowlistManager = new AllowlistManager('/tmp/test-allowlist.json');
  });

  describe('URL Validation in Tool Handlers', () => {
    it('should allow URLs from allowlisted domains', async () => {
      const config = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'deny' as const,
        domains: [
          { domain: 'allowed.com', description: 'Allowed domain' },
          { domain: '*.trusted.org', description: 'Trusted subdomains' },
        ],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));
      await allowlistManager.loadConfig();

      // Test various URLs that should be allowed
      expect(allowlistManager.validateUrl('https://allowed.com/page').allowed).toBe(true);
      expect(allowlistManager.validateUrl('https://allowed.com/page?param=value').allowed).toBe(true);
      expect(allowlistManager.validateUrl('https://sub.trusted.org/page').allowed).toBe(true);
      expect(allowlistManager.validateUrl('https://deep.sub.trusted.org/page#section').allowed).toBe(true);
    });

    it('should deny URLs from blocked domains', async () => {
      const config = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'deny' as const,
        domains: [
          { domain: 'allowed.com', description: 'Allowed domain' },
        ],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));
      await allowlistManager.loadConfig();

      // Test URLs that should be blocked
      const result = allowlistManager.validateUrl('https://blocked.com/page');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('blocked.com');
    });

    it('should allow all URLs when allowlist is disabled', async () => {
      const config = {
        version: '1.0.0',
        enabled: false,
        defaultAction: 'deny' as const,
        domains: [],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));
      await allowlistManager.loadConfig();

      // Even blocked domains should be allowed when disabled
      expect(allowlistManager.validateUrl('https://anydomain.com/page').allowed).toBe(true);
      expect(allowlistManager.validateUrl('https://blocked.com/page').allowed).toBe(true);
    });

    it('should allow all URLs when defaultAction is allow', async () => {
      const config = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'allow' as const,
        domains: [],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));
      await allowlistManager.loadConfig();

      // All domains should be allowed
      expect(allowlistManager.validateUrl('https://anydomain.com/page').allowed).toBe(true);
      expect(allowlistManager.validateUrl('https://blocked.com/page').allowed).toBe(true);
    });

    it('should handle search engine URLs correctly', async () => {
      const config = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'deny' as const,
        domains: [
          { domain: 'duckduckgo.com', description: 'Privacy search' },
          { domain: '*.duckduckgo.com', description: 'DuckDuckGo subdomains' },
          { domain: 'bing.com', description: 'Microsoft search' },
          { domain: '*.bing.com', description: 'Bing subdomains' },
        ],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));
      await allowlistManager.loadConfig();

      // Search URLs should be allowed
      expect(allowlistManager.validateUrl('https://duckduckgo.com/?q=test').allowed).toBe(true);
      expect(allowlistManager.validateUrl('https://www.bing.com/search?q=test').allowed).toBe(true);
    });
  });

  describe('Error Handling in Integration', () => {
    it('should handle invalid URLs gracefully', async () => {
      const config = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'allow' as const,
        domains: [],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));
      await allowlistManager.loadConfig();

      // Invalid URLs should be rejected
      expect(allowlistManager.validateUrl('not a url').allowed).toBe(false);
      expect(allowlistManager.validateUrl('http://').allowed).toBe(false);
      expect(allowlistManager.validateUrl('').allowed).toBe(false);
    });

    it('should handle null/undefined URLs', async () => {
      const config = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'allow' as const,
        domains: [],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));
      await allowlistManager.loadConfig();

      // Null/undefined should be rejected
      expect(allowlistManager.validateUrl(null as any).allowed).toBe(false);
      expect(allowlistManager.validateUrl(undefined as any).allowed).toBe(false);
    });

    it('should handle malformed domain names', async () => {
      const config = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'allow' as const,
        domains: [],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));
      await allowlistManager.loadConfig();

      // Malformed domains should be handled
      expect(allowlistManager.validateUrl('https://..com/page').allowed).toBe(false);
      expect(allowlistManager.validateUrl('https://.example.com/page').allowed).toBe(false);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle common web search scenario', async () => {
      const config = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'deny' as const,
        domains: [
          { domain: 'duckduckgo.com', description: 'Privacy search' },
          { domain: 'bing.com', description: 'Microsoft search' },
          { domain: '*.wikipedia.org', description: 'Wikipedia subdomains' },
        ],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));
      await allowlistManager.loadConfig();

      // User searches on DuckDuckGo - allowed
      const searchUrl = 'https://duckduckgo.com/?q=typescript+tutorial';
      expect(allowlistManager.validateUrl(searchUrl).allowed).toBe(true);

      // User clicks Wikipedia result - allowed (via wildcard)
      const wikiUrl = 'https://en.wikipedia.org/wiki/TypeScript';
      expect(allowlistManager.validateUrl(wikiUrl).allowed).toBe(true);

      // User tries to visit unknown site - blocked
      const unknownUrl = 'https://unknown-site.com/page';
      const result = allowlistManager.validateUrl(unknownUrl);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('unknown-site.com');
    });

    it('should handle development workflow scenario', async () => {
      const config = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'deny' as const,
        domains: [
          { domain: 'github.com', description: 'Code hosting' },
          { domain: 'stackoverflow.com', description: 'Stack Overflow' },
          { domain: '*.npmjs.com', description: 'npm subdomains' },
        ],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));
      await allowlistManager.loadConfig();

      // Developer checks GitHub repo - allowed
      expect(allowlistManager.validateUrl('https://github.com/user/repo').allowed).toBe(true);

      // Developer searches Stack Overflow - allowed (exact match)
      expect(allowlistManager.validateUrl('https://stackoverflow.com/questions/123').allowed).toBe(true);

      // Developer installs package from npm - allowed (via wildcard)
      expect(allowlistManager.validateUrl('https://www.npmjs.com/package/lodash').allowed).toBe(true);
    });
  });

  describe('Config Reload Integration', () => {
    it('should handle config reload during operation', async () => {
      const initialConfig = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'deny' as const,
        domains: [
          { domain: 'allowed.com' },
        ],
      };

      const updatedConfig = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'deny' as const,
        domains: [
          { domain: 'allowed.com' },
          { domain: 'newdomain.com' },
        ],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync)
        .mockReturnValueOnce(JSON.stringify(initialConfig))
        .mockReturnValueOnce(JSON.stringify(updatedConfig));

      await allowlistManager.loadConfig();

      // Initially blocked
      expect(allowlistManager.validateUrl('https://newdomain.com/page').allowed).toBe(false);

      // Reload config
      await allowlistManager.reloadConfig();

      // Now allowed after reload
      expect(allowlistManager.validateUrl('https://newdomain.com/page').allowed).toBe(true);
    });
  });
});
