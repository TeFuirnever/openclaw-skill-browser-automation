# Matrix Playwright MCP Server

[![npm version](https://img.shields.io/npm/v/@matrix/mcp-playwright-server.svg)](https://www.npmjs.com/package/@matrix/mcp-playwright-server)
[![smithery badge](https://smithery.ai/badge/@matrix/mcp-playwright-server)](https://smithery.ai/server/@matrix/mcp-playwright-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js Version](https://img.shields.io/badge/Node.js-18%20%7C%2020%20%7C%2022-green.svg)](./package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](./package.json)
[![Playwright](https://img.shields.io/badge/Playwright-1.58-orange.svg)](./package.json)
[![MCP SDK](https://img.shields.io/badge/MCP-1.27-purple.svg)](./package.json)
[![CI](https://github.com/TeFuirnever/mcp-playwright-server/actions/workflows/ci.yml/badge.svg)](https://github.com/TeFuirnever/mcp-playwright-server/actions)
[![codecov](https://codecov.io/gh/TeFuirnever/mcp-playwright-server/branch/main/graph/badge.svg)](https://codecov.io/gh/TeFuirnever/mcp-playwright-server)

**MCP server for web automation** with Playwright - featuring query-first tools, policy-driven security, and two-level domain whitelisting.

## Features

- 🔌 **Chrome CDP Attach-First** - Connects to existing Chrome instance (`localhost:9222`) with automatic fallback launch
- 🔒 **Policy-Driven Security** - HTTPS-only, domain allowlists, redirect revalidation, capability gates
- 👤 **User-Level Domains** - Per-user trusted domain configuration alongside server policy
- 📊 **Query-First Design** - Optimized for LLM workflows with structured tool outputs
- 📝 **Audit Logging** - Structured audit events for security monitoring
- 🗄️ **Bounded Caches** - In-memory caches for logs and screenshots with configurable limits
- 🌐 **Headless by Default** - Runs in background without opening browser window
- 🔄 **Ephemeral Browser** - Browser auto-closes after each operation for security/isolation

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Tools](#tools)
- [Security](#security)
- [Development](#development)
- [Contributing](#contributing)
- [FAQ](#faq)
- [License](#license)

## Installation

### Smithery (Recommended)

```bash
npx -y @smithery/cli install @matrix/mcp-playwright-server --client claude
```

### npm

```bash
npm install @matrix/mcp-playwright-server
```

### Local Build

```bash
git clone https://github.com/TeFuirnever/mcp-playwright-server.git
cd mcp-playwright-server
npm install
npm run build
```

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "matrix-mcp-playwright": {
      "command": "node",
      "args": ["/path/to/mcp-playwright-server/dist/index.js"]
    }
  }
}
```

### Server Policy

Configure `config/policy.json`:

```json
{
  "version": 1,
  "security": {
    "httpsOnly": true,
    "allowedDomains": ["example.com", "api.example.org"],
    "revalidateAfterRedirect": true
  },
  "capabilities": {
    "webSearch": true,
    "extract": true,
    "webFetch": true,
    "advancedBrowserOps": false,
    "evalScript": false,
    "download": false
  },
  "limits": {
    "requestTimeoutMs": 15000,
    "maxConcurrentRequests": 3,
    "maxRedirectHops": 5
  }
}
```

### User-Level Domains

Users can manage their own trusted domains via MCP tools:

```bash
# Add a trusted domain
playwright_add_domain(domain: "my-internal-api.company.com")

# List all trusted domains
playwright_list_domains()

# Remove a domain
playwright_remove_domain(domain: "my-internal-api.company.com")
```

User configuration stored at: `~/.config/mcp-playwright-server/allowed-domains.json`

### Browser Configuration

Configure browser launch options in user config file:

```json
{
  "allowedDomains": ["example.com"],
  "browser": {
    "headless": true,
    "devtools": false
  }
}
```

**Configuration Priority** (highest to lowest):
1. Environment variable `PLAYWRIGHT_HEADLESS`
2. User config `browser.headless`
3. Default: `true` (headless mode)

**Environment Variables:**
- `PLAYWRIGHT_HEADLESS=true` - Headless mode (default)
- `PLAYWRIGHT_HEADLESS=false` - Headed mode (visible browser)
- `PLAYWRIGHT_DEVTOOLS=true` - Open DevTools in headed mode

**Browser Lifecycle:**
- Browser opens automatically when a tool requires it
- Browser closes automatically after each tool call completes
- This ephemeral pattern provides better security and isolation

### Optional: Chrome CDP Setup

For local development with an existing Chrome instance:

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222

# Linux
google-chrome --remote-debugging-port=9222
```

## Tools

### Query Tools (Default Enabled)

| Tool | Description |
|------|-------------|
| `playwright_policy_status` | Get effective security policy and runtime diagnostics |
| `playwright_web_search` | Search the web via DuckDuckGo or Bing |
| `playwright_extract` | Extract readable text from a web page |
| `playwright_web_fetch` | HTTP GET with policy validation |

### Domain Management Tools

| Tool | Description |
|------|-------------|
| `playwright_add_domain` | Add domain to user's trusted list |
| `playwright_remove_domain` | Remove domain from user's list |
| `playwright_list_domains` | List all trusted domains (server + user) |

### Advanced Tools (Policy-Gated)

| Tool | Description | Capability |
|------|-------------|------------|
| `playwright_navigate` | Navigate browser to URL | `advancedBrowserOps` |
| `playwright_screenshot` | Capture page screenshot | `advancedBrowserOps` or `download` |
| `playwright_click` | Click element by selector | `advancedBrowserOps` |
| `playwright_fill` | Fill input field | `advancedBrowserOps` |
| `playwright_select` | Select option in dropdown | `advancedBrowserOps` |
| `playwright_hover` | Hover over element | `advancedBrowserOps` |
| `playwright_evaluate` | Execute JavaScript | `evalScript` |

## Security

### Two-Level Domain Whitelist

1. **Server-Level**: Configured in `config/policy.json` by administrator
2. **User-Level**: Managed via MCP tools, stored in `~/.config/`

Effective allowed domains = Server whitelist ∪ User domains

### Security Features

- ✅ HTTPS-only enforcement
- ✅ Domain allowlisting (case-insensitive)
- ✅ Redirect URL revalidation
- ✅ Capability gates for high-risk operations
- ✅ Request timeout limits
- ✅ Concurrent request limiting
- ✅ Structured audit logging

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run watch

# Run tests
npm test
```

## Contributing

We welcome contributions! Feel free to submit issues and pull requests.

## FAQ

<details>
<summary><strong>Why is my domain being rejected?</strong></summary>

Check the following:
1. Ensure the domain is in either server policy or user configuration
2. Verify HTTPS is being used (or disable `httpsOnly` in policy)
3. Check for typos - domains are case-insensitive but must match exactly
4. Use `playwright_list_domains` to see all trusted domains
</details>

<details>
<summary><strong>How do I enable advanced browser operations?</strong></summary>

Set `capabilities.advancedBrowserOps: true` in your `config/policy.json`:

```json
{
  "capabilities": {
    "advancedBrowserOps": true
  }
}
```
</details>

<details>
<summary><strong>Can I use this with a remote Chrome instance?</strong></summary>

Yes! Set the `MCP_PLAYWRIGHT_CDP_URL` environment variable to your remote Chrome debugging URL:

```json
{
  "mcpServers": {
    "matrix-mcp-playwright": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "MCP_PLAYWRIGHT_CDP_URL": "http://remote-host:9222"
      }
    }
  }
}
```
</details>

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

<p align="center">
  Made with ❤️ by the Matrix team
</p>
