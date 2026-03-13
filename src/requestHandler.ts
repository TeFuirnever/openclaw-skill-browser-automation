import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ErrorCode,
  McpError,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
  CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { ResourceStore } from './resource-store.js';

export interface RequestHandlerDependencies {
  handleToolCall(name: string, rawArgs: unknown, server: unknown): Promise<CallToolResult>;
  resourceStore: ResourceStore;
}

export function setupRequestHandlers(
  server: Server,
  tools: Tool[],
  dependencies: RequestHandlerDependencies
) {
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: dependencies.resourceStore.listResources(),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async request => {
    const uri = request.params.uri.toString();
    const contents = dependencies.resourceStore.readResource(uri);

    if (!contents) {
      throw new McpError(ErrorCode.InvalidParams, `Resource not found: ${uri}`);
    }

    return { contents };
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async request =>
    dependencies.handleToolCall(request.params.name, request.params.arguments ?? {}, server)
  );
}
