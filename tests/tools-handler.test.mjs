import test from "node:test";
import assert from "node:assert/strict";
import { createResourceStore } from "../dist/resource-store.js";
import { createToolHandler, resolveScreenshotOptions } from "../dist/toolsHandler.js";

test("tool handler surfaces policy status and denies disabled browser actions without launching a browser", async () => {
  const resourceStore = createResourceStore();
  const { handleToolCall } = createToolHandler({ resourceStore });

  const statusResult = await handleToolCall("playwright_policy_status", {}, undefined);
  assert.equal(statusResult.isError, false);
  assert.equal(statusResult.structuredContent.policy.version, 1);
  assert.equal(statusResult.structuredContent.runtime.logsCount, 0);

  const deniedResult = await handleToolCall("playwright_click", { selector: "#submit" }, undefined);
  assert.equal(deniedResult.isError, true);
  const deniedPayload = JSON.parse(deniedResult.content[0].text);
  assert.equal(deniedPayload.error.code, "POLICY_DENIED");

  const invalidResult = await handleToolCall("playwright_web_fetch", {}, undefined);
  assert.equal(invalidResult.isError, true);
  const invalidPayload = JSON.parse(invalidResult.content[0].text);
  assert.equal(invalidPayload.error.code, "INVALID_INPUT");
});

test("resolveScreenshotOptions defaults to memory-only mode when downloads are disabled", () => {
  const withoutDownloads = resolveScreenshotOptions(
    {
      capabilities: { download: false },
    },
    {},
    "req_123"
  );
  assert.equal(withoutDownloads.savePng, false);
  assert.equal(withoutDownloads.storeBase64, true);
  assert.equal(withoutDownloads.screenshotName, "shot_req_123");

  const withDownloads = resolveScreenshotOptions(
    {
      capabilities: { download: true },
    },
    {},
    "req_456"
  );
  assert.equal(withDownloads.savePng, true);
});
