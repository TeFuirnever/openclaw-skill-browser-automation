import test from "node:test";
import assert from "node:assert/strict";
import { createResourceStore } from "../dist/resource-store.js";

test("resource store caps log and screenshot history while exposing MCP resources", () => {
  const store = createResourceStore({ maxConsoleLogs: 2, maxScreenshots: 1 });

  store.addConsoleLog("first");
  store.addConsoleLog("second");
  store.addConsoleLog("third");

  store.addScreenshot("first-shot", "Zmlyc3Q=");
  store.addScreenshot("second-shot", "c2Vjb25k");

  const resources = store.listResources();
  assert.deepEqual(
    resources.map((resource) => resource.uri),
    ["console://logs", "screenshot://second-shot"]
  );

  const consoleContents = store.readResource("console://logs");
  assert.equal(consoleContents?.[0]?.text, "second\nthird");

  const screenshotContents = store.readResource("screenshot://second-shot");
  assert.equal(screenshotContents?.[0]?.blob, "c2Vjb25k");
  assert.equal(store.readResource("screenshot://missing"), null);
});
