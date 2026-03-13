import test from "node:test";
import assert from "node:assert/strict";
import { loadPolicy, validateUrl, isDomainAllowed, validateRedirectUrl, shouldAllowNavigationRequest } from "../dist/policy.js";
import { DEFAULT_POLICY } from "../dist/policyTypes.js";
import { capabilityAllowed } from "../dist/capabilities.js";

test("loadPolicy falls back to default when file is missing", () => {
  const policy = loadPolicy("./config/non-existent.json");
  assert.deepEqual(policy, DEFAULT_POLICY);
});

test("validateUrl rejects non-https url when httpsOnly is enabled", () => {
  const policy = {
    ...DEFAULT_POLICY,
    security: {
      ...DEFAULT_POLICY.security,
      allowedDomains: ["example.com"],
      httpsOnly: true,
    },
  };

  const result = validateUrl("http://example.com/path", policy);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "HTTPS_ONLY");
});

test("validateUrl rejects host not in allowlist", () => {
  const policy = {
    ...DEFAULT_POLICY,
    security: {
      ...DEFAULT_POLICY.security,
      allowedDomains: ["example.com"],
    },
  };

  const result = validateUrl("https://not-allowed.com", policy);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "DOMAIN_NOT_ALLOWED");
});

test("isDomainAllowed only allows exact configured host", () => {
  const policy = {
    ...DEFAULT_POLICY,
    security: {
      ...DEFAULT_POLICY.security,
      allowedDomains: ["example.com"],
    },
  };

  assert.equal(isDomainAllowed("example.com", policy), true);
  assert.equal(isDomainAllowed("sub.example.com", policy), false);
});

test("capability guard keeps advanced/eval disabled by default", () => {
  assert.equal(capabilityAllowed("playwright_policy_status", DEFAULT_POLICY), true);
  assert.equal(capabilityAllowed("playwright_web_search", DEFAULT_POLICY), true);
  assert.equal(capabilityAllowed("playwright_extract", DEFAULT_POLICY), true);
  assert.equal(capabilityAllowed("playwright_web_fetch", DEFAULT_POLICY), true);
  assert.equal(capabilityAllowed("playwright_evaluate", DEFAULT_POLICY), false);
  assert.equal(capabilityAllowed("playwright_click", DEFAULT_POLICY), false);
});

test("validateRedirectUrl rejects redirect targets outside the allowlist before following", () => {
  const policy = {
    ...DEFAULT_POLICY,
    security: {
      ...DEFAULT_POLICY.security,
      allowedDomains: ["example.com"],
    },
  };

  const result = validateRedirectUrl("https://example.com/start", "https://forbidden.test/next", policy);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "DOMAIN_NOT_ALLOWED");
});

test("shouldAllowNavigationRequest blocks disallowed main-frame navigations but ignores subresource requests", () => {
  const policy = {
    ...DEFAULT_POLICY,
    security: {
      ...DEFAULT_POLICY.security,
      allowedDomains: ["example.com"],
    },
  };

  const blocked = shouldAllowNavigationRequest("https://forbidden.test/next", true, policy);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "DOMAIN_NOT_ALLOWED");

  const allowedSubresource = shouldAllowNavigationRequest("https://forbidden.test/asset.js", false, policy);
  assert.equal(allowedSubresource.allowed, true);
});
