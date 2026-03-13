export type ErrorCode =
  | 'POLICY_DENIED'
  | 'INVALID_INPUT'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_ERROR';

export interface ToolError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  requestId: string;
  details?: Record<string, unknown>;
}

export interface CapabilityPolicy {
  webSearch: boolean;
  extract: boolean;
  webFetch: boolean;
  advancedBrowserOps: boolean;
  evalScript: boolean;
  download: boolean;
}

export interface SecurityPolicy {
  httpsOnly: boolean;
  allowedDomains: string[];
  revalidateAfterRedirect: boolean;
}

export interface LimitsPolicy {
  requestTimeoutMs: number;
  maxConcurrentRequests: number;
  maxResultItems: number;
  maxResponseChars: number;
  maxRedirectHops: number;
}

export interface AuditPolicy {
  enabled: boolean;
  logLevel: 'info' | 'warn' | 'error';
  redactSensitiveFields: boolean;
}

export interface ServerPolicy {
  version: number;
  security: SecurityPolicy;
  capabilities: CapabilityPolicy;
  limits: LimitsPolicy;
  audit: AuditPolicy;
}

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
}

export interface AuditEvent {
  ts: string;
  requestId: string;
  tool: string;
  host?: string;
  decision: 'allow' | 'deny' | 'error';
  code: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export const DEFAULT_POLICY: ServerPolicy = {
  version: 1,
  security: {
    httpsOnly: true,
    allowedDomains: ['www.bing.com', 'www.google.com', 'bing.com', 'google.com'],
    revalidateAfterRedirect: true,
  },
  capabilities: {
    webSearch: true,
    extract: true,
    webFetch: true,
    advancedBrowserOps: false,
    evalScript: false,
    download: false,
  },
  limits: {
    requestTimeoutMs: 15000,
    maxConcurrentRequests: 3,
    maxResultItems: 10,
    maxResponseChars: 20000,
    maxRedirectHops: 5,
  },
  audit: {
    enabled: true,
    logLevel: 'info',
    redactSensitiveFields: true,
  },
};
