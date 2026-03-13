import test from "node:test";
import assert from "node:assert/strict";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { setupRequestHandlers } from "../dist/requestHandler.js";

function createFakeServer() {
  const handlers = new Map();

  return {
    handlers,
    setRequestHandler(schema, handler) {
      handlers.set(schema, handler);
    },
  };
}

test("request handlers delegate tool calls and resource reads through injected dependencies", async () => {
  const tools = [{ name: "playwright_policy_status" }];
  const fakeServer = createFakeServer();
  const resourceStore = {
    listResources() {
      return [{ uri: "console://logs", mimeType: "text/plain", name: "Browser console logs" }];
    },
    readResource(uri) {
      if (uri === "console://logs") {
        return [{ uri, mimeType: "text/plain", text: "hello" }];
      }
      return null;
    },
  };

  const calls = [];
  setupRequestHandlers(fakeServer, tools, {
    resourceStore,
    handleToolCall: async (name, args) => {
      calls.push({ name, args });
      return { isError: false, content: [{ type: "text", text: "ok" }] };
    },
  });

  const listedTools = await fakeServer.handlers.get(ListToolsRequestSchema)();
  assert.deepEqual(listedTools.tools, tools);

  const listedResources = await fakeServer.handlers.get(ListResourcesRequestSchema)();
  assert.deepEqual(listedResources.resources, resourceStore.listResources());

  const readResource = await fakeServer.handlers.get(ReadResourceRequestSchema)({
    params: { uri: "console://logs" },
  });
  assert.equal(readResource.contents[0].text, "hello");

  const toolResult = await fakeServer.handlers.get(CallToolRequestSchema)({
    params: { name: "playwright_policy_status", arguments: { verbose: true } },
  });
  assert.equal(toolResult.isError, false);
  assert.deepEqual(calls, [{ name: "playwright_policy_status", args: { verbose: true } }]);
});
