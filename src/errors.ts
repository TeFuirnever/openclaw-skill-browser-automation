/**
 * Structured error types for browser automation skill
 *
 * Provides consistent error handling with error codes and user-friendly messages.
 */

/**
 * Error codes for browser automation operations
 */
export enum ErrorCode {
  // URL Validation Errors
  URL_REQUIRED = 'URL_REQUIRED',
  URL_INVALID_FORMAT = 'URL_INVALID_FORMAT',
  URL_SCHEME_NOT_ALLOWED = 'URL_SCHEME_NOT_ALLOWED',
  URL_DOMAIN_NOT_ALLOWED = 'URL_DOMAIN_NOT_ALLOWED',
  URL_IP_NOT_ALLOWED = 'URL_IP_NOT_ALLOWED',
  URL_REDIRECT_BLOCKED = 'URL_REDIRECT_BLOCKED',

  // Parameter Errors
  PARAM_REQUIRED = 'PARAM_REQUIRED',
  PARAM_INVALID = 'PARAM_INVALID',

  // Browser Errors
  BROWSER_LAUNCH_FAILED = 'BROWSER_LAUNCH_FAILED',
  BROWSER_PAGE_LOAD_FAILED = 'BROWSER_PAGE_LOAD_FAILED',
  BROWSER_ELEMENT_NOT_FOUND = 'BROWSER_ELEMENT_NOT_FOUND',
  BROWSER_TIMEOUT = 'BROWSER_TIMEOUT',
  BROWSER_CLOSED = 'BROWSER_CLOSED',

  // Network Errors
  NETWORK_REQUEST_FAILED = 'NETWORK_REQUEST_FAILED',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',

  // Content Errors
  CONTENT_EXTRACTION_FAILED = 'CONTENT_EXTRACTION_FAILED',
  CONTENT_TOO_LARGE = 'CONTENT_TOO_LARGE',

  // Security Errors
  SECURITY_PAGE_NOT_ALLOWED = 'SECURITY_PAGE_NOT_ALLOWED',
  SECURITY_OPERATION_BLOCKED = 'SECURITY_OPERATION_BLOCKED',

  // Unknown
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Custom error class for browser automation operations
 */
export class BrowserSkillError extends Error {
  public readonly code: ErrorCode;
  public readonly userMessage: string;
  public readonly details?: unknown;
  public readonly isRecoverable: boolean;

  constructor(
    code: ErrorCode,
    userMessage: string,
    options?: {
      details?: unknown;
      isRecoverable?: boolean;
      cause?: Error;
    }
  ) {
    super(userMessage, { cause: options?.cause });
    this.name = 'BrowserSkillError';
    this.code = code;
    this.userMessage = userMessage;
    this.details = options?.details;
    this.isRecoverable = options?.isRecoverable ?? false;
  }

  /**
   * Format error for MCP response
   */
  toMcpResponse() {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error [${this.code}]: ${this.userMessage}${
            this.details ? `\nDetails: ${JSON.stringify(this.details, null, 2)}` : ''
          }`,
        },
      ],
      isError: true,
    };
  }

  /**
   * Create from unknown error
   */
  static fromUnknown(error: unknown, context?: string): BrowserSkillError {
    if (error instanceof BrowserSkillError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    return new BrowserSkillError(
      ErrorCode.UNKNOWN_ERROR,
      context ? `${context}: ${message}` : message,
      { details: error, cause: error instanceof Error ? error : undefined }
    );
  }
}

/**
 * Create URL validation error
 */
export function createUrlError(code: ErrorCode, url: string, reason?: string): BrowserSkillError {
  const messages: Record<ErrorCode, string> = {
    [ErrorCode.URL_REQUIRED]: 'URL is required',
    [ErrorCode.URL_INVALID_FORMAT]: `Invalid URL format: "${url}"`,
    [ErrorCode.URL_SCHEME_NOT_ALLOWED]: `URL scheme not allowed: "${url}". Only http and https are supported.`,
    [ErrorCode.URL_DOMAIN_NOT_ALLOWED]: `Domain not allowed: "${url}"${reason ? `. ${reason}` : ''}`,
    [ErrorCode.URL_IP_NOT_ALLOWED]: `IP addresses are not allowed: "${url}"`,
    [ErrorCode.URL_REDIRECT_BLOCKED]: `Redirect blocked: "${url}"${reason ? `. ${reason}` : ''}`,
    [ErrorCode.PARAM_REQUIRED]: '',
    [ErrorCode.PARAM_INVALID]: '',
    [ErrorCode.BROWSER_LAUNCH_FAILED]: '',
    [ErrorCode.BROWSER_PAGE_LOAD_FAILED]: '',
    [ErrorCode.BROWSER_ELEMENT_NOT_FOUND]: '',
    [ErrorCode.BROWSER_TIMEOUT]: '',
    [ErrorCode.BROWSER_CLOSED]: '',
    [ErrorCode.NETWORK_REQUEST_FAILED]: '',
    [ErrorCode.NETWORK_TIMEOUT]: '',
    [ErrorCode.CONTENT_EXTRACTION_FAILED]: '',
    [ErrorCode.CONTENT_TOO_LARGE]: '',
    [ErrorCode.SECURITY_PAGE_NOT_ALLOWED]: '',
    [ErrorCode.SECURITY_OPERATION_BLOCKED]: '',
    [ErrorCode.UNKNOWN_ERROR]: '',
  };

  return new BrowserSkillError(code, messages[code], { details: { url, reason } });
}

/**
 * Wrap async handler with error handling
 */
export function withErrorHandling<T extends Record<string, unknown>, R>(
  handler: (args: T) => Promise<R>
): (args: T) => Promise<R | { content: Array<{ type: 'text'; text: string }>; isError: true }> {
  return async (args: T) => {
    try {
      return await handler(args);
    } catch (error) {
      const skillError = BrowserSkillError.fromUnknown(error);
      return skillError.toMcpResponse() as {
        content: Array<{ type: 'text'; text: string }>;
        isError: true;
      };
    }
  };
}
