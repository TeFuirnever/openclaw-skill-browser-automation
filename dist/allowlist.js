import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
/**
 * Default allowlist configuration
 */
const DEFAULT_CONFIG = {
    version: '1.1.0',
    enabled: false,
    defaultAction: 'deny',
    domains: [
        { domain: 'duckduckgo.com', description: 'Privacy-focused search engine' },
        { domain: '*.duckduckgo.com', description: 'DuckDuckGo subdomains' },
        { domain: 'bing.com', description: 'Microsoft search engine' },
        { domain: '*.bing.com', description: 'Bing subdomains' },
        { domain: '*.wikipedia.org', description: 'Wikipedia sites' },
        { domain: 'github.com', description: 'Software development platform' },
        { domain: '*.github.com', description: 'GitHub subdomains' },
        { domain: '*.github.io', description: 'GitHub Pages' },
    ],
};
/**
 * Manager for website allowlist configuration
 * Security: Validates URLs against allowed domains, blocks IPs by default
 */
export class AllowlistManager {
    configPath;
    config;
    constructor(configPath) {
        this.configPath = configPath;
        this.config = { ...DEFAULT_CONFIG };
    }
    /**
     * Load configuration from file or use defaults
     */
    async loadConfig() {
        try {
            if (existsSync(this.configPath)) {
                const fileContent = readFileSync(this.configPath, 'utf-8');
                const loadedConfig = JSON.parse(fileContent);
                this.config = this.validateAndMergeConfig(loadedConfig);
            }
            else {
                // Create default config file
                const dir = dirname(this.configPath);
                if (!existsSync(dir)) {
                    mkdirSync(dir, { recursive: true });
                }
                writeFileSync(this.configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
                this.config = { ...DEFAULT_CONFIG };
            }
        }
        catch (error) {
            // If loading fails, use default config (security: fail closed)
            console.error('[AllowlistManager] Failed to load config file:', this.configPath, 'Error:', error instanceof Error ? error.message : String(error));
            this.config = { ...DEFAULT_CONFIG };
        }
    }
    /**
     * Reload configuration from file
     */
    async reloadConfig() {
        return this.loadConfig();
    }
    /**
     * Validate and merge loaded config with defaults
     */
    validateAndMergeConfig(loaded) {
        const l = loaded;
        const config = {
            version: typeof l.version === 'string' ? l.version : '1.0.0',
            enabled: typeof l.enabled === 'boolean' ? l.enabled : false,
            defaultAction: l.defaultAction === 'allow' ? 'allow' : 'deny',
            domains: Array.isArray(l.domains)
                ? l.domains
                    .map((d) => {
                    const entry = d;
                    return {
                        domain: typeof entry.domain === 'string' ? entry.domain : '',
                        description: typeof entry.description === 'string' ? entry.description : undefined,
                    };
                })
                    .filter((d) => d.domain.length > 0)
                : [],
        };
        return config;
    }
    /**
     * Match a domain pattern against a hostname
     * Supports wildcard patterns like *.example.com
     *
     * Security: Non-wildcard patterns match ONLY the exact domain
     * Wildcard patterns (*.example.com) match subdomains only
     * This prevents bypass via malicious TLD registration (e.g., example.com.evil.com)
     */
    matchWildcard(pattern, hostname) {
        if (!pattern || !hostname) {
            return false;
        }
        // Remove leading/trailing whitespace and normalize to lowercase
        pattern = pattern.trim().toLowerCase();
        hostname = hostname.trim().toLowerCase();
        // Handle exact match
        if (pattern === hostname) {
            return true;
        }
        // Handle wildcard patterns (*.example.com)
        if (pattern.startsWith('*.')) {
            const suffix = pattern.slice(2); // Remove '*.'
            // Hostname must be a subdomain (end with .suffix but not equal to suffix)
            if (hostname.endsWith(`.${suffix}`)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Check if a domain is allowed
     */
    isDomainAllowed(hostname) {
        // Validate input
        if (!hostname || typeof hostname !== 'string') {
            return false;
        }
        // Check if allowlist is enabled
        if (!this.config.enabled) {
            return true;
        }
        // Trim and validate hostname
        hostname = hostname.trim();
        if (hostname.length === 0) {
            return false;
        }
        // Security: Block all IP addresses to prevent SSRF
        if (this.isIPAddress(hostname)) {
            return false;
        }
        // Basic hostname validation
        if (!this.isValidHostname(hostname)) {
            return false;
        }
        // Check against allowlist
        for (const entry of this.config.domains) {
            if (this.matchWildcard(entry.domain, hostname)) {
                return true;
            }
        }
        // Apply default action (security: default to deny)
        return this.config.defaultAction === 'allow';
    }
    /**
     * Validate a complete URL
     */
    validateUrl(url) {
        // Validate input
        if (!url || typeof url !== 'string') {
            return {
                allowed: false,
                reason: 'Invalid URL: URL is required',
            };
        }
        url = url.trim();
        if (url.length === 0) {
            return {
                allowed: false,
                reason: 'Invalid URL: Empty URL',
            };
        }
        // Parse URL
        let hostname;
        try {
            const urlObj = new URL(url);
            hostname = urlObj.hostname;
            // Security: Only allow http and https schemes
            if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
                return {
                    allowed: false,
                    reason: `Invalid URL scheme: ${urlObj.protocol}. Only http and https are allowed.`,
                };
            }
        }
        catch (error) {
            console.error('[AllowlistManager] URL parsing failed:', url, 'Error:', error instanceof Error ? error.message : String(error));
            return {
                allowed: false,
                reason: 'Invalid URL format',
            };
        }
        // Security: Block IP addresses
        if (this.isIPAddress(hostname)) {
            return {
                allowed: false,
                reason: `IP addresses are not allowed: ${hostname}`,
            };
        }
        // Check domain
        if (!this.isDomainAllowed(hostname)) {
            return {
                allowed: false,
                reason: `Domain "${hostname}" is not in the allowlist`,
            };
        }
        return {
            allowed: true,
        };
    }
    /**
     * Validate a redirect URL (additional check after fetch)
     */
    validateRedirectUrl(originalUrl, redirectUrl) {
        const redirectValidation = this.validateUrl(redirectUrl);
        if (!redirectValidation.allowed) {
            return {
                allowed: false,
                reason: `Redirect blocked: ${redirectValidation.reason}. Original URL: ${originalUrl}`,
            };
        }
        return redirectValidation;
    }
    /**
     * Basic hostname validation
     */
    isValidHostname(hostname) {
        // Check for obviously invalid hostnames
        if (hostname.includes(' ') || hostname.includes('..') || hostname.startsWith('.')) {
            return false;
        }
        // Check for at least one dot (for domains)
        if (!hostname.includes('.')) {
            return false;
        }
        // Check length constraints (RFC 1035)
        if (hostname.length > 253) {
            return false;
        }
        return true;
    }
    /**
     * Check if hostname is an IP address (v4 or v6)
     * Security: Block IP addresses to prevent SSRF attacks
     */
    isIPAddress(hostname) {
        // IPv4 pattern: x.x.x.x where x is 0-255
        const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        const match = hostname.match(ipv4Pattern);
        if (match) {
            // Validate each octet is 0-255
            const octets = match.slice(1, 5).map(Number);
            if (octets.every((o) => o >= 0 && o <= 255)) {
                return true;
            }
        }
        // IPv6 pattern: brackets indicate IPv6 address
        if (hostname.startsWith('[') && hostname.endsWith(']')) {
            return true;
        }
        // Decimal IP pattern: large number representing IP (e.g., 2130706433 = 127.0.0.1)
        if (/^\d{8,15}$/.test(hostname)) {
            return true;
        }
        return false;
    }
    /**
     * Check if IP address is internal/private (SSRF protection)
     */
    isInternalIP(hostname) {
        const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        const match = hostname.match(ipv4Pattern);
        if (match) {
            const octets = match.slice(1, 5).map(Number);
            // 10.0.0.0/8 - Private network
            if (octets[0] === 10)
                return true;
            // 172.16.0.0/12 - Private network
            if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
                return true;
            // 192.168.0.0/16 - Private network
            if (octets[0] === 192 && octets[1] === 168)
                return true;
            // 127.0.0.0/8 - Loopback
            if (octets[0] === 127)
                return true;
            // 169.254.0.0/16 - Link-local
            if (octets[0] === 169 && octets[1] === 254)
                return true;
            // 0.0.0.0/8 - Current network
            if (octets[0] === 0)
                return true;
        }
        // IPv6 loopback
        if (hostname === '::1' || hostname === '[::1]')
            return true;
        // IPv6 private networks (unique local addresses)
        if (hostname.startsWith('fc') || hostname.startsWith('fd'))
            return true;
        if (hostname.startsWith('[fc') || hostname.startsWith('[fd'))
            return true;
        // IPv6 link-local
        if (hostname.startsWith('fe80') || hostname.startsWith('[fe80'))
            return true;
        return false;
    }
    /**
     * Get current configuration (returns a copy)
     */
    getConfig() {
        return JSON.parse(JSON.stringify(this.config));
    }
}
