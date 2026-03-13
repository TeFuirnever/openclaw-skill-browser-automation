import { ServerPolicy } from './policyTypes.js';
import { getToolMetadata } from './tools.js';

export function capabilityAllowed(toolName: string, policy: ServerPolicy): boolean {
  const metadata = getToolMetadata(toolName);
  if (!metadata || metadata.capability === 'always') {
    return true;
  }

  if (metadata.capability === 'advancedBrowserOpsOrDownload') {
    return policy.capabilities.advancedBrowserOps || policy.capabilities.download;
  }

  return policy.capabilities[metadata.capability];
}
