/**
 * Website allowlist configuration types
 */

export interface AllowlistEntry {
  /** Domain pattern (supports wildcards like *.example.com) */
  domain: string;
  /** Optional description of why this domain is allowed */
  description?: string;
}

export interface AllowlistConfig {
  /** Configuration version for migration support */
  version: string;
  /** Whether the allowlist is enabled */
  enabled: boolean;
  /** Default action for domains not in the list */
  defaultAction: 'allow' | 'deny';
  /** List of domain patterns */
  domains: AllowlistEntry[];
}

export interface ValidationResult {
  /** Whether the URL is allowed */
  allowed: boolean;
  /** Reason for denial if not allowed */
  reason?: string;
}
