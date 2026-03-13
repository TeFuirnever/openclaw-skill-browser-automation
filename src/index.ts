#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createResourceStore } from './resource-store.js';
import { createToolDefinitions } from './tools.js';
import { createToolHandler } from './toolsHandler.js';
import { setupRequestHandlers } from './requestHandler.js';

async function runServer() {
  const server = new Server(
    {
      name: 'matrix-mcp-playwright',
      version: '0.3.0',
    },
    {
      capabilities: {
        resources: { listChanged: true },
        tools: {},
      },
    }
  );

  const tools = createToolDefinitions();
  const resourceStore = createResourceStore();
  const { handleToolCall } = createToolHandler({ resourceStore });

  setupRequestHandlers(server, tools, {
    handleToolCall,
    resourceStore,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch(console.error);
