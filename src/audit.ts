import { AuditEvent, ServerPolicy } from './policyTypes.js';

function redactDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const redacted = { ...details };
  const sensitiveKeys = ['authorization', 'cookie', 'token', 'apikey', 'apiKey', 'password'];
  for (const key of Object.keys(redacted)) {
    if (sensitiveKeys.includes(key)) {
      redacted[key] = '[REDACTED]';
    }
  }
  return redacted;
}

export function writeAudit(policy: ServerPolicy, event: AuditEvent): void {
  if (!policy.audit.enabled) return;

  const payload: AuditEvent = {
    ...event,
    details: policy.audit.redactSensitiveFields ? redactDetails(event.details) : event.details,
  };

  process.stderr.write(`${JSON.stringify(payload)}\n`);
}
