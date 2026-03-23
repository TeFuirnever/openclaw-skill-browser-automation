import { describe, it, expect } from 'vitest';
import type { AllowlistEntry, AllowlistConfig, ValidationResult } from '../src/types.js';

describe('Types', () => {
  it('should allow AllowlistEntry with required fields', () => {
    const entry: AllowlistEntry = {
      domain: 'example.com',
    };
    expect(entry.domain).toBe('example.com');
  });

  it('should allow AllowlistEntry with optional description', () => {
    const entry: AllowlistEntry = {
      domain: 'example.com',
      description: 'Test domain',
    };
    expect(entry.domain).toBe('example.com');
    expect(entry.description).toBe('Test domain');
  });

  it('should allow AllowlistConfig with all fields', () => {
    const config: AllowlistConfig = {
      version: '1.0.0',
      enabled: true,
      defaultAction: 'allow',
      domains: [
        { domain: 'example.com' },
      ],
    };
    expect(config.version).toBe('1.0.0');
    expect(config.enabled).toBe(true);
    expect(config.defaultAction).toBe('allow');
    expect(config.domains).toHaveLength(1);
  });

  it('should allow ValidationResult with allowed true', () => {
    const result: ValidationResult = {
      allowed: true,
    };
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should allow ValidationResult with allowed false and reason', () => {
    const result: ValidationResult = {
      allowed: false,
      reason: 'Domain not allowed',
    };
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Domain not allowed');
  });

  it('should support both allow and deny default actions', () => {
    const allowConfig: AllowlistConfig = {
      version: '1.0.0',
      enabled: true,
      defaultAction: 'allow',
      domains: [],
    };

    const denyConfig: AllowlistConfig = {
      version: '1.0.0',
      enabled: true,
      defaultAction: 'deny',
      domains: [],
    };

    expect(allowConfig.defaultAction).toBe('allow');
    expect(denyConfig.defaultAction).toBe('deny');
  });
});
