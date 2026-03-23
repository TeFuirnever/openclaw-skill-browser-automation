# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- Custom MCP server implementation (use `@playwright/mcp@latest` instead)
- Policy engine (use `@playwright/mcp` flags instead)
- Audit logging
- Server/user domain configuration

### Migration Guide

If you were using the custom MCP server, migrate to the official package:

**Before (custom):**
```json
{
  "mcpServers": {
    "matrix-mcp-playwright": {
      "command": "node",
      "args": ["/path/to/dist/index.js"]
    }
  }
}
```

**After (official):**
```json
{
  "playwright": {
    "command": "npx",
    "args": ["@playwright/mcp@latest", "--headless"]
  }
}
```

See README.md for more details.
