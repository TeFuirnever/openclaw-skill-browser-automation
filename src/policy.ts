import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_POLICY, PolicyDecision, ServerPolicy } from './policyTypes.js';
import { listUserDomains } from './userConfig.js';

const DEFAULT_POLICY_PATH = path.join(process.cwd(), 'config', 'policy.json');

function normalizeDomain(hostname: string): string {
  return hostname.trim().toLowerCase();
}

export function isDomainAllowed(hostname: string, policy: ServerPolicy): boolean {
  const normalizedHost = normalizeDomain(hostname);

  // Check server whitelist
  if (policy.security.allowedDomains.includes(normalizedHost)) {
    return true;
  }

  // Check user-configured domains
  const userDomains = listUserDomains();
  return userDomains.includes(normalizedHost);
}

export function getHostFromUrl(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function validateUrl(rawUrl: string, policy: ServerPolicy): PolicyDecision {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: 'INVALID_URL' };
  }

  if (policy.security.httpsOnly && parsed.protocol !== 'https:') {
    return { allowed: false, reason: 'HTTPS_ONLY' };
  }

  if (!isDomainAllowed(parsed.hostname, policy)) {
    return { allowed: false, reason: 'DOMAIN_NOT_ALLOWED' };
  }

  return { allowed: true };
}

export function validateRedirectUrl(
  rawUrl: string,
  location: string,
  policy: ServerPolicy
): PolicyDecision & { resolvedUrl?: string } {
  let resolvedUrl: string;
  try {
    resolvedUrl = new URL(location, rawUrl).toString();
  } catch {
    return { allowed: false, reason: 'INVALID_URL' };
  }

  const decision = validateUrl(resolvedUrl, policy);
  return decision.allowed ? { allowed: true, resolvedUrl } : { ...decision, resolvedUrl };
}

export function shouldAllowNavigationRequest(
  rawUrl: string,
  isMainFrameNavigation: boolean,
  policy: ServerPolicy
): PolicyDecision {
  if (!isMainFrameNavigation) {
    return { allowed: true };
  }

  return validateUrl(rawUrl, policy);
}

function mergePolicy(partial: Partial<ServerPolicy>): ServerPolicy {
  return {
    version: partial.version ?? DEFAULT_POLICY.version,
    security: {
      httpsOnly: partial.security?.httpsOnly ?? DEFAULT_POLICY.security.httpsOnly,
      allowedDomains: Array.isArray(partial.security?.allowedDomains)
        ? partial
            .security!.allowedDomains.filter((v): v is string => typeof v === 'string')
            .map(v => v.trim().toLowerCase())
            .filter(v => v.length > 0)
        : DEFAULT_POLICY.security.allowedDomains,
      revalidateAfterRedirect:
        partial.security?.revalidateAfterRedirect ??
        DEFAULT_POLICY.security.revalidateAfterRedirect,
    },
    capabilities: {
      webSearch: partial.capabilities?.webSearch ?? DEFAULT_POLICY.capabilities.webSearch,
      extract: partial.capabilities?.extract ?? DEFAULT_POLICY.capabilities.extract,
      webFetch: partial.capabilities?.webFetch ?? DEFAULT_POLICY.capabilities.webFetch,
      advancedBrowserOps:
        partial.capabilities?.advancedBrowserOps ?? DEFAULT_POLICY.capabilities.advancedBrowserOps,
      evalScript: partial.capabilities?.evalScript ?? DEFAULT_POLICY.capabilities.evalScript,
      download: partial.capabilities?.download ?? DEFAULT_POLICY.capabilities.download,
    },
    limits: {
      requestTimeoutMs: partial.limits?.requestTimeoutMs ?? DEFAULT_POLICY.limits.requestTimeoutMs,
      maxConcurrentRequests:
        partial.limits?.maxConcurrentRequests ?? DEFAULT_POLICY.limits.maxConcurrentRequests,
      maxResultItems: partial.limits?.maxResultItems ?? DEFAULT_POLICY.limits.maxResultItems,
      maxResponseChars: partial.limits?.maxResponseChars ?? DEFAULT_POLICY.limits.maxResponseChars,
      maxRedirectHops: partial.limits?.maxRedirectHops ?? DEFAULT_POLICY.limits.maxRedirectHops,
    },
    audit: {
      enabled: partial.audit?.enabled ?? DEFAULT_POLICY.audit.enabled,
      logLevel: partial.audit?.logLevel ?? DEFAULT_POLICY.audit.logLevel,
      redactSensitiveFields:
        partial.audit?.redactSensitiveFields ?? DEFAULT_POLICY.audit.redactSensitiveFields,
    },
  };
}

export function loadPolicy(policyPath?: string): ServerPolicy {
  const resolvedPath =
    policyPath ?? process.env.MCP_PLAYWRIGHT_CDP_POLICY_PATH ?? DEFAULT_POLICY_PATH;
  if (!fs.existsSync(resolvedPath)) {
    return DEFAULT_POLICY;
  }

  try {
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ServerPolicy>;
    return mergePolicy(parsed);
  } catch {
    return DEFAULT_POLICY;
  }
}
