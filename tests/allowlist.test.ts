import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AllowlistManager } from '../src/allowlist.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

// Mock file system operations
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

describe('AllowlistManager', () => {
  let manager: AllowlistManager;
  const testConfigPath = '/tmp/test-allowlist.json';

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new AllowlistManager(testConfigPath);
  });

  describe('loadConfig', () => {
    it('should load default config when file does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdirSync).mockImplementation(() => '/tmp');

      await manager.loadConfig();

      const config = manager.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.defaultAction).toBe('deny'); // Security: default to deny
      expect(config.domains.length).toBeGreaterThan(0);
      expect(config.domains.find(d => d.domain === 'duckduckgo.com')).toBeDefined();
    });

    it('should load existing config from file', async () => {
      const existingConfig = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'deny' as const,
        domains: [
          { domain: 'example.com', description: 'Test domain' },
        ],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(existingConfig));

      await manager.loadConfig();

      const config = manager.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.defaultAction).toBe('deny');
      expect(config.domains).toHaveLength(1);
      expect(config.domains[0].domain).toBe('example.com');
    });

    it('should handle invalid JSON gracefully', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('invalid json');

      await expect(manager.loadConfig()).resolves.not.toThrow();

      const config = manager.getConfig();
      expect(config.enabled).toBe(false);
    });

    it('should handle missing required fields', async () => {
      const invalidConfig = {
        version: '1.0.0',
        // missing enabled, defaultAction, domains
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(invalidConfig));

      await manager.loadConfig();

      const config = manager.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.defaultAction).toBe('deny'); // Security: default to deny
      expect(config.domains).toBeInstanceOf(Array);
    });
  });

  describe('reloadConfig', () => {
    it('should reload config from file', async () => {
      const initialConfig = {
        version: '1.0.0',
        enabled: false,
        defaultAction: 'allow' as const,
        domains: [],
      };

      const reloadedConfig = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'deny' as const,
        domains: [{ domain: 'newdomain.com' }],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync)
        .mockReturnValueOnce(JSON.stringify(initialConfig))
        .mockReturnValueOnce(JSON.stringify(reloadedConfig));

      await manager.loadConfig();
      expect(manager.getConfig().enabled).toBe(false);

      await manager.reloadConfig();
      expect(manager.getConfig().enabled).toBe(true);
      expect(manager.getConfig().defaultAction).toBe('deny');
    });
  });

  describe('matchWildcard', () => {
    it('should match exact domain', () => {
      expect(manager.matchWildcard('example.com', 'example.com')).toBe(true);
    });

    it('should match wildcard subdomain', () => {
      expect(manager.matchWildcard('*.example.com', 'sub.example.com')).toBe(true);
      expect(manager.matchWildcard('*.example.com', 'deep.sub.example.com')).toBe(true);
    });

    it('should not match wildcard with wrong domain', () => {
      expect(manager.matchWildcard('*.example.com', 'other.com')).toBe(false);
      expect(manager.matchWildcard('*.example.com', 'example.org')).toBe(false);
    });

    it('should match leading wildcard only', () => {
      expect(manager.matchWildcard('*.com', 'example.com')).toBe(true);
      expect(manager.matchWildcard('*.gov', 'site.gov')).toBe(true);
    });

    it('should handle empty strings', () => {
      expect(manager.matchWildcard('', 'example.com')).toBe(false);
      expect(manager.matchWildcard('*.com', '')).toBe(false);
    });

    it('should handle special characters', () => {
      expect(manager.matchWildcard('*.test.com', 'sub_test.test.com')).toBe(true);
      expect(manager.matchWildcard('*.test.com', 'sub-test.test.com')).toBe(true);
    });

    it('should handle Unicode domains', () => {
      expect(manager.matchWildcard('*.测试.com', '子域名.测试.com')).toBe(true);
    });
  });

  describe('isDomainAllowed', () => {
    beforeEach(async () => {
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
      await manager.loadConfig();
    });

    it('should allow exact domain match', () => {
      expect(manager.isDomainAllowed('allowed.com')).toBe(true);
    });

    it('should allow wildcard subdomain match', () => {
      expect(manager.isDomainAllowed('sub.trusted.org')).toBe(true);
      expect(manager.isDomainAllowed('deep.sub.trusted.org')).toBe(true);
    });

    it('should deny non-matching domain when defaultAction is deny', () => {
      expect(manager.isDomainAllowed('blocked.com')).toBe(false);
    });

    it('should allow when disabled regardless of domain', async () => {
      const disabledConfig = {
        version: '1.0.0',
        enabled: false,
        defaultAction: 'deny' as const,
        domains: [],
      };

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(disabledConfig));
      await manager.reloadConfig();

      expect(manager.isDomainAllowed('anydomain.com')).toBe(true);
    });

    it('should allow all when defaultAction is allow', async () => {
      const allowAllConfig = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'allow' as const,
        domains: [],
      };

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(allowAllConfig));
      await manager.reloadConfig();

      expect(manager.isDomainAllowed('anydomain.com')).toBe(true);
    });

    it('should handle null/undefined hostname', () => {
      expect(manager.isDomainAllowed(null as any)).toBe(false);
      expect(manager.isDomainAllowed(undefined as any)).toBe(false);
    });

    it('should handle empty string hostname', () => {
      expect(manager.isDomainAllowed('')).toBe(false);
    });

    it('should handle invalid hostname format', () => {
      expect(manager.isDomainAllowed('not a valid hostname')).toBe(false);
      expect(manager.isDomainAllowed('..')).toBe(false);
    });
  });

  describe('validateUrl', () => {
    beforeEach(async () => {
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
      await manager.loadConfig();
    });

    it('should allow valid URL with allowed domain', () => {
      const result = manager.validateUrl('https://allowed.com/page');
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny URL with blocked domain', () => {
      const result = manager.validateUrl('https://blocked.com/page');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('blocked.com');
    });

    it('should handle invalid URLs', () => {
      const result = manager.validateUrl('not a url');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should handle URLs with query parameters', () => {
      const result = manager.validateUrl('https://allowed.com/page?param=value');
      expect(result.allowed).toBe(true);
    });

    it('should handle URLs with fragments', () => {
      const result = manager.validateUrl('https://allowed.com/page#section');
      expect(result.allowed).toBe(true);
    });

    it('should handle URLs with ports', () => {
      const result = manager.validateUrl('https://allowed.com:8080/page');
      expect(result.allowed).toBe(true);
    });

    it('should handle URLs with authentication', () => {
      const result = manager.validateUrl('https://user:pass@allowed.com/page');
      expect(result.allowed).toBe(true);
    });

    it('should allow when disabled', async () => {
      const disabledConfig = {
        version: '1.0.0',
        enabled: false,
        defaultAction: 'deny' as const,
        domains: [],
      };

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(disabledConfig));
      await manager.reloadConfig();

      const result = manager.validateUrl('https://anydomain.com/page');
      expect(result.allowed).toBe(true);
    });

    it('should handle null/undefined URL', () => {
      const result1 = manager.validateUrl(null as any);
      expect(result1.allowed).toBe(false);
      expect(result1.reason).toBeDefined();

      const result2 = manager.validateUrl(undefined as any);
      expect(result2.allowed).toBe(false);
      expect(result2.reason).toBeDefined();
    });

    it('should handle empty string URL', () => {
      const result = manager.validateUrl('');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should handle URLs with special characters', () => {
      const result = manager.validateUrl('https://allowed.com/path%20with%20spaces');
      expect(result.allowed).toBe(true);
    });

    it('should block IPv4 addresses for SSRF protection', async () => {
      const ipConfig = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'allow' as const,
        domains: [],
      };

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(ipConfig));
      await manager.reloadConfig();

      // Security: IP addresses should be blocked to prevent SSRF
      const result = manager.validateUrl('https://192.168.1.1/page');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('IP addresses are not allowed');
    });

    it('should block localhost URLs for SSRF protection', async () => {
      const localhostConfig = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'allow' as const,
        domains: [],
      };

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(localhostConfig));
      await manager.reloadConfig();

      // Security: localhost should be blocked to prevent SSRF
      const result = manager.validateUrl('http://localhost:3000/page');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not in the allowlist');
    });

    it('should prevent subdomain bypass via malicious TLD', async () => {
      const bypassConfig = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'deny' as const,
        domains: [{ domain: 'example.com' }],
      };

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(bypassConfig));
      await manager.reloadConfig();

      // Security: example.com.evil.com should NOT match example.com
      const result = manager.validateUrl('http://example.com.evil.com');
      expect(result.allowed).toBe(false);
    });

    it('should prevent bypass via decimal IP', async () => {
      const config = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'allow' as const,
        domains: [],
      };

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));
      await manager.reloadConfig();

      // Security: decimal IP (2130706433 = 127.0.0.1) should be blocked
      const result = manager.validateUrl('http://2130706433');
      expect(result.allowed).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return current config', async () => {
      const config = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'deny' as const,
        domains: [{ domain: 'test.com' }],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));
      await manager.loadConfig();

      const result = manager.getConfig();
      expect(result).toEqual(config);
    });

    it('should return copy not reference', async () => {
      const config = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'deny' as const,
        domains: [{ domain: 'test.com' }],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));
      await manager.loadConfig();

      const result1 = manager.getConfig();
      const result2 = manager.getConfig();

      expect(result1).not.toBe(result2);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle concurrent reload operations', async () => {
      const config = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'deny' as const,
        domains: [],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));
      await manager.loadConfig();

      const promises = [
        manager.reloadConfig(),
        manager.reloadConfig(),
        manager.reloadConfig(),
      ];

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('should handle very long domain names', async () => {
      const longDomain = 'a'.repeat(200) + '.com';
      const config = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'allow' as const,
        domains: [],
      };

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));
      await manager.reloadConfig();

      const result = manager.isDomainAllowed(longDomain);
      expect(result).toBe(true);
    });

    it('should handle domains with many subdomains', async () => {
      const deepSubdomain = 'a.b.c.d.e.f.g.h.i.j.example.com';
      const config = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'allow' as const,
        domains: [],
      };

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));
      await manager.reloadConfig();

      const result = manager.isDomainAllowed(deepSubdomain);
      expect(result).toBe(true);
    });

    it('should handle config with many domain entries', async () => {
      const domains = Array.from({ length: 1000 }, (_, i) => ({
        domain: `domain${i}.com`,
        description: `Domain ${i}`,
      }));

      const config = {
        version: '1.0.0',
        enabled: true,
        defaultAction: 'deny' as const,
        domains,
      };

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));
      await manager.reloadConfig();

      expect(manager.isDomainAllowed('domain500.com')).toBe(true);
      expect(manager.isDomainAllowed('unknown.com')).toBe(false);
    });
  });
});
