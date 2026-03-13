import test from "node:test";
import assert from "node:assert/strict";
import { createToolDefinitions, getToolMetadata, isBrowserTool } from "../dist/tools.js";

test("tool metadata keeps schemas, capability gates, and runtime classification aligned", () => {
  const definitions = createToolDefinitions();
  const toolNames = new Set(definitions.map((tool) => tool.name));

  const searchMetadata = getToolMetadata("playwright_web_search");
  assert.ok(searchMetadata);
  assert.equal(searchMetadata.capability, "webSearch");
  assert.equal(isBrowserTool("playwright_web_search"), true);
  assert.equal(isBrowserTool("playwright_web_fetch"), false);
  assert.equal(isBrowserTool("playwright_unknown_tool"), false);
  assert.equal(toolNames.has("playwright_web_search"), true);
  assert.equal(toolNames.has("playwright_web_fetch"), true);
});
