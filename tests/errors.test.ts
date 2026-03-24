import { describe, it, expect } from 'vitest';
import { ErrorCode, BrowserSkillError, createUrlError, withErrorHandling } from '../src/errors.js';

describe('ErrorCode enum', () => {
  it('should have all required URL validation error codes', () => {
    expect(ErrorCode.URL_REQUIRED).toBe('URL_REQUIRED');
    expect(ErrorCode.URL_INVALID_FORMAT).toBe('URL_INVALID_FORMAT');
    expect(ErrorCode.URL_SCHEME_NOT_ALLOWED).toBe('URL_SCHEME_NOT_ALLOWED');
    expect(ErrorCode.URL_DOMAIN_NOT_ALLOWED).toBe('URL_DOMAIN_NOT_ALLOWED');
    expect(ErrorCode.URL_IP_NOT_ALLOWED).toBe('URL_IP_NOT_ALLOWED');
    expect(ErrorCode.URL_REDIRECT_BLOCKED).toBe('URL_REDIRECT_BLOCKED');
  });

  it('should have all required parameter error codes', () => {
    expect(ErrorCode.PARAM_REQUIRED).toBe('PARAM_REQUIRED');
    expect(ErrorCode.PARAM_INVALID).toBe('PARAM_INVALID');
  });

  it('should have all required browser error codes', () => {
    expect(ErrorCode.BROWSER_LAUNCH_FAILED).toBe('BROWSER_LAUNCH_FAILED');
    expect(ErrorCode.BROWSER_PAGE_LOAD_FAILED).toBe('BROWSER_PAGE_LOAD_FAILED');
    expect(ErrorCode.BROWSER_ELEMENT_NOT_FOUND).toBe('BROWSER_ELEMENT_NOT_FOUND');
    expect(ErrorCode.BROWSER_TIMEOUT).toBe('BROWSER_TIMEOUT');
    expect(ErrorCode.BROWSER_CLOSED).toBe('BROWSER_CLOSED');
  });

  it('should have all required network error codes', () => {
    expect(ErrorCode.NETWORK_REQUEST_FAILED).toBe('NETWORK_REQUEST_FAILED');
    expect(ErrorCode.NETWORK_TIMEOUT).toBe('NETWORK_TIMEOUT');
  });

  it('should have all required content error codes', () => {
    expect(ErrorCode.CONTENT_EXTRACTION_FAILED).toBe('CONTENT_EXTRACTION_FAILED');
    expect(ErrorCode.CONTENT_TOO_LARGE).toBe('CONTENT_TOO_LARGE');
  });

  it('should have all required security error codes', () => {
    expect(ErrorCode.SECURITY_PAGE_NOT_ALLOWED).toBe('SECURITY_PAGE_NOT_ALLOWED');
    expect(ErrorCode.SECURITY_OPERATION_BLOCKED).toBe('SECURITY_OPERATION_BLOCKED');
  });

  it('should have UNKNOWN_ERROR code', () => {
    expect(ErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
  });
});

describe('BrowserSkillError', () => {
  describe('constructor', () => {
    it('should create error with required fields', () => {
      const error = new BrowserSkillError(ErrorCode.URL_REQUIRED, 'URL is required');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BrowserSkillError);
      expect(error.name).toBe('BrowserSkillError');
      expect(error.code).toBe(ErrorCode.URL_REQUIRED);
      expect(error.userMessage).toBe('URL is required');
      expect(error.details).toBeUndefined();
      expect(error.isRecoverable).toBe(false);
    });

    it('should create error with all optional fields', () => {
      const cause = new Error('Original error');
      const error = new BrowserSkillError(
        ErrorCode.NETWORK_REQUEST_FAILED,
        'Network request failed',
        {
          details: { url: 'https://example.com', status: 500 },
          isRecoverable: true,
          cause,
        }
      );

      expect(error.code).toBe(ErrorCode.NETWORK_REQUEST_FAILED);
      expect(error.userMessage).toBe('Network request failed');
      expect(error.details).toEqual({ url: 'https://example.com', status: 500 });
      expect(error.isRecoverable).toBe(true);
      expect(error.cause).toBe(cause);
    });
  });

  describe('toMcpResponse', () => {
    it('should format error for MCP response', () => {
      const error = new BrowserSkillError(ErrorCode.URL_REQUIRED, 'URL is required');

      const response = error.toMcpResponse();

      expect(response.isError).toBe(true);
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('text');
      expect(response.content[0].text).toContain('URL_REQUIRED');
      expect(response.content[0].text).toContain('URL is required');
    });

    it('should include details in MCP response when present', () => {
      const error = new BrowserSkillError(ErrorCode.URL_DOMAIN_NOT_ALLOWED, 'Domain not allowed', {
        details: { domain: 'blocked.com' },
      });

      const response = error.toMcpResponse();

      expect(response.content[0].text).toContain('blocked.com');
      expect(response.content[0].text).toContain('Details:');
    });

    it('should not include details section when not present', () => {
      const error = new BrowserSkillError(ErrorCode.BROWSER_TIMEOUT, 'Operation timed out');

      const response = error.toMcpResponse();

      expect(response.content[0].text).not.toContain('Details:');
    });
  });

  describe('fromUnknown', () => {
    it('should return same error if already BrowserSkillError', () => {
      const originalError = new BrowserSkillError(ErrorCode.BROWSER_CLOSED, 'Browser was closed');

      const result = BrowserSkillError.fromUnknown(originalError);

      expect(result).toBe(originalError);
    });

    it('should wrap Error instances', () => {
      const originalError = new Error('Something went wrong');

      const result = BrowserSkillError.fromUnknown(originalError);

      expect(result).toBeInstanceOf(BrowserSkillError);
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(result.userMessage).toBe('Something went wrong');
      expect(result.cause).toBe(originalError);
    });

    it('should wrap non-Error values', () => {
      const result = BrowserSkillError.fromUnknown('String error');

      expect(result).toBeInstanceOf(BrowserSkillError);
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(result.userMessage).toBe('String error');
      expect(result.cause).toBeUndefined();
    });

    it('should add context to error message', () => {
      const originalError = new Error('Failed');
      const result = BrowserSkillError.fromUnknown(originalError, 'Navigation');

      expect(result.userMessage).toBe('Navigation: Failed');
    });

    it('should handle null/undefined errors', () => {
      const resultNull = BrowserSkillError.fromUnknown(null);
      const resultUndefined = BrowserSkillError.fromUnknown(undefined);

      expect(resultNull.userMessage).toBe('null');
      expect(resultUndefined.userMessage).toBe('undefined');
    });

    it('should handle object errors', () => {
      const objError = { message: 'Object error', code: 500 };
      const result = BrowserSkillError.fromUnknown(objError);

      expect(result.details).toBe(objError);
    });
  });
});

describe('createUrlError', () => {
  it('should create URL_REQUIRED error', () => {
    const error = createUrlError(ErrorCode.URL_REQUIRED, '');

    expect(error.code).toBe(ErrorCode.URL_REQUIRED);
    expect(error.userMessage).toBe('URL is required');
    expect(error.details).toEqual({ url: '', reason: undefined });
  });

  it('should create URL_INVALID_FORMAT error with URL in message', () => {
    const error = createUrlError(ErrorCode.URL_INVALID_FORMAT, 'not-a-url');

    expect(error.code).toBe(ErrorCode.URL_INVALID_FORMAT);
    expect(error.userMessage).toContain('not-a-url');
    expect(error.userMessage).toContain('Invalid URL format');
  });

  it('should create URL_SCHEME_NOT_ALLOWED error', () => {
    const error = createUrlError(ErrorCode.URL_SCHEME_NOT_ALLOWED, 'ftp://example.com');

    expect(error.code).toBe(ErrorCode.URL_SCHEME_NOT_ALLOWED);
    expect(error.userMessage).toContain('ftp://example.com');
    expect(error.userMessage).toContain('Only http and https');
  });

  it('should create URL_DOMAIN_NOT_ALLOWED error with reason', () => {
    const error = createUrlError(
      ErrorCode.URL_DOMAIN_NOT_ALLOWED,
      'https://blocked.com',
      'Domain not in allowlist'
    );

    expect(error.code).toBe(ErrorCode.URL_DOMAIN_NOT_ALLOWED);
    expect(error.userMessage).toContain('blocked.com');
    expect(error.userMessage).toContain('Domain not in allowlist');
  });

  it('should create URL_IP_NOT_ALLOWED error', () => {
    const error = createUrlError(ErrorCode.URL_IP_NOT_ALLOWED, 'https://192.168.1.1');

    expect(error.code).toBe(ErrorCode.URL_IP_NOT_ALLOWED);
    expect(error.userMessage).toContain('192.168.1.1');
    expect(error.userMessage).toContain('IP addresses are not allowed');
  });

  it('should create URL_REDIRECT_BLOCKED error', () => {
    const error = createUrlError(
      ErrorCode.URL_REDIRECT_BLOCKED,
      'https://malicious.com',
      'Redirect target not in allowlist'
    );

    expect(error.code).toBe(ErrorCode.URL_REDIRECT_BLOCKED);
    expect(error.userMessage).toContain('malicious.com');
    expect(error.userMessage).toContain('Redirect blocked');
    expect(error.userMessage).toContain('Redirect target not in allowlist');
  });

  it('should include URL and reason in details', () => {
    const error = createUrlError(
      ErrorCode.URL_DOMAIN_NOT_ALLOWED,
      'https://test.com',
      'Test reason'
    );

    expect(error.details).toEqual({
      url: 'https://test.com',
      reason: 'Test reason',
    });
  });
});

describe('withErrorHandling', () => {
  it('should return handler result on success', async () => {
    const handler = async (args: { value: number }) => ({ result: args.value * 2 });
    const wrappedHandler = withErrorHandling(handler);

    const result = await wrappedHandler({ value: 5 });

    expect(result).toEqual({ result: 10 });
  });

  it('should catch BrowserSkillError and return MCP response', async () => {
    const handler = async () => {
      throw new BrowserSkillError(ErrorCode.BROWSER_CLOSED, 'Browser was closed');
    };
    const wrappedHandler = withErrorHandling(handler);

    const result = await wrappedHandler({});

    expect(result).toHaveProperty('isError', true);
    expect(result).toHaveProperty('content');
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('BROWSER_CLOSED');
  });

  it('should wrap non-BrowserSkillError in BrowserSkillError', async () => {
    const handler = async () => {
      throw new Error('Unexpected error');
    };
    const wrappedHandler = withErrorHandling(handler);

    const result = await wrappedHandler({});

    expect(result).toHaveProperty('isError', true);
    expect(result.content[0].text).toContain('UNKNOWN_ERROR');
    expect(result.content[0].text).toContain('Unexpected error');
  });

  it('should preserve argument types', async () => {
    interface TestArgs {
      url: string;
      timeout: number;
    }

    const handler = async (args: TestArgs) => ({
      fetched: args.url,
      time: args.timeout,
    });
    const wrappedHandler = withErrorHandling(handler);

    const result = await wrappedHandler({ url: 'https://example.com', timeout: 5000 });

    expect(result).toEqual({
      fetched: 'https://example.com',
      time: 5000,
    });
  });

  it('should handle async errors', async () => {
    const handler = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      throw new Error('Async error');
    };
    const wrappedHandler = withErrorHandling(handler);

    const result = await wrappedHandler({});

    expect(result).toHaveProperty('isError', true);
    expect(result.content[0].text).toContain('Async error');
  });
});

describe('error serialization', () => {
  it('should serialize complex details in MCP response', () => {
    const error = new BrowserSkillError(ErrorCode.NETWORK_REQUEST_FAILED, 'Request failed', {
      details: {
        url: 'https://api.example.com/data',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { query: 'test' },
        nested: { deep: { value: 123 } },
      },
    });

    const response = error.toMcpResponse();
    const text = response.content[0].text;

    expect(text).toContain('https://api.example.com/data');
    expect(text).toContain('POST');
    expect(text).toContain('application/json');
    expect(text).toContain('123');
  });

  it('should handle circular references in details gracefully', () => {
    const circular: Record<string, unknown> = { name: 'test' };
    circular.self = circular;

    const error = new BrowserSkillError(ErrorCode.UNKNOWN_ERROR, 'Error with circular', {
      details: circular,
    });

    // Note: JSON.stringify throws on circular references by default
    // This test documents the current behavior - circular refs will throw
    // In production, we should use a safe serializer or avoid circular refs
    expect(() => error.toMcpResponse()).toThrow(TypeError);
    expect(() => error.toMcpResponse()).toThrow('circular');
  });
});

describe('error recoverability', () => {
  it('should mark timeout errors as recoverable', () => {
    const error = new BrowserSkillError(ErrorCode.BROWSER_TIMEOUT, 'Timeout', {
      isRecoverable: true,
    });

    expect(error.isRecoverable).toBe(true);
  });

  it('should mark security errors as non-recoverable by default', () => {
    const error = new BrowserSkillError(ErrorCode.SECURITY_OPERATION_BLOCKED, 'Operation blocked');

    expect(error.isRecoverable).toBe(false);
  });

  it('should allow overriding recoverability', () => {
    const error = new BrowserSkillError(ErrorCode.SECURITY_PAGE_NOT_ALLOWED, 'Page not allowed', {
      isRecoverable: true,
    });

    expect(error.isRecoverable).toBe(true);
  });
});
