import { CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { ErrorCode, ToolError } from './policyTypes.js';

export function buildToolError(
  code: ErrorCode,
  message: string,
  requestId: string,
  retryable: boolean,
  details?: Record<string, unknown>
): ToolError {
  return {
    code,
    message,
    requestId,
    retryable,
    details,
  };
}

export function toolErrorResult(error: ToolError): CallToolResult {
  const content: TextContent[] = [
    {
      type: 'text',
      text: JSON.stringify({ ok: false, error }, null, 2),
    },
  ];
  return { isError: true, content };
}
