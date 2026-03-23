# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-03-22

### Added
- **browser_web_search** - Web search using DuckDuckGo or Bing search engines
- **browser_web_fetch** - HTTP GET fetch for APIs and raw content (faster than browser)
- **browser_extract** - Extract readable text from web pages using Mozilla Readability
- Full MCP server implementation (`src/index.ts`) with all tool handlers
- Playwright, Readability, and JSDOM dependencies

### Changed
- Upgraded from pattern-only skill to standalone MCP server
- Can now be used as both skill documentation AND actual MCP server
- Restored web search/fetch capabilities from original matrix-mcp-playwright

### Migration

You can now use this as a standalone MCP server:

```json
{
  "mcpServers": {
    "browser-automation": {
      "command": "node",
      "args": ["/path/to/dist/index.js"]
    }
  }
}
```

## [1.0.0] - 2025-03-22

### Changed
- **BREAKING**: Converted from custom MCP server to OpenClaw skill
- Now uses official `@playwright/mcp@latest` instead of custom implementation
- Removed all source code (src/, tests/, dist/)
- Renamed package from `@matrix/mcp-playwright-server` to `@openclaw/skill-browser-automation`

### Added
- OpenClaw skill with proper SKILL.md format
- Browser automation patterns and best practices
- Core workflows: page analysis, form filling, data extraction

### Removed
- Custom MCP server implementation (use `@playwright/mcp` flags instead)
- Policy engine (use `@playwright/mcp` flags instead)
- Audit logging
- Server/user domain configuration
