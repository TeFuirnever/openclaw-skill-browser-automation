# Architecture Documentation

This document describes the system architecture of the MCP Playwright Server.

## Overview

The MCP Playwright Server is a Model Context Protocol (MCP) server that provides browser automation capabilities through a secure, policy-driven interface. It is designed to work with AI assistants like Claude.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCP Client                                 │
│                    (Claude Desktop, etc.)                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │ JSON-RPC over stdio
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Request Handler                             │
│                   (src/requestHandler.ts)                        │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │ JSON-RPC    │  │ Tool         │  │ Server              │   │
│  │ Parser      │──▶ │ Dispatcher   │──▶ │ Initialization     │   │
│  └─────────────┘  └──────────────┘  └─────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Tools Handler                                │
│                   (src/toolsHandler.ts)                         │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │ Tool        │  │ Browser      │  │ Resource            │   │
│  │ Executor    │──▶ │ Manager      │──▶ │ Store              │   │
│  └─────────────┘  └──────────────┘  └─────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│     Policy Engine      │     │    Audit Logger        │
│     (src/policy.ts)    │     │    (src/audit.ts)     │
│  ┌─────────────────┐   │     └─────────────────────────┘
│  │ Domain          │   │
│  │ Validator       │   │
│  └─────────────────┘   │
└─────────────────────────┘
```

## Core Components

### 1. Request Handler (`src/requestHandler.ts`)

**Responsibilities:**
- Initialize MCP server with tool definitions
- Handle JSON-RPC requests from clients
- Route tool calls to the tools handler
- Manage server lifecycle

**Key Functions:**
- `createServer()` - Initialize MCP server
- Request/response parsing

### 2. Tools Handler (`src/toolsHandler.ts`)

**Responsibilities:**
- Execute tool calls
- Manage browser lifecycle
- Enforce policy checks
- Handle errors and responses

**Key Functions:**
- `handleToolCall()` - Main entry point for tool execution
- `ensureBrowser()` - Launch/attach browser
- `closeBrowser()` - Clean up browser resources

### 3. Policy Engine (`src/policy.ts`)

**Responsibilities:**
- Validate URLs against domain allowlists
- Check HTTPS requirements
- Validate redirects
- Enforce capability gates

**Key Functions:**
- `validateUrl()` - Main URL validation
- `validateRedirectUrl()` - Post-redirect validation
- `checkCapability()` - Verify tool capability is enabled

### 4. Audit Logger (`src/audit.ts`)

**Responsibilities:**
- Log all tool requests and decisions
- Redact sensitive fields
- Output structured JSON logs

**Key Functions:**
- `logAuditEvent()` - Log audit event

### 5. Resource Store (`src/resource-store.ts`)

**Responsibilities:**
- Manage in-memory caches for screenshots and logs
- Enforce size limits
- Handle cleanup

**Key Functions:**
- `storeScreenshot()` - Store screenshot in cache
- `getScreenshot()` - Retrieve screenshot
- `storeLog()` - Store log entry
- `getLogs()` - Retrieve logs

## Security Architecture

### Two-Level Domain Whitelist

```
┌─────────────────────────────────────────────────────────────┐
│                    Request Flow                              │
├─────────────────────────────────────────────────────────────┤
│  1. Client sends URL                                        │
│  2. Extract domain from URL                                 │
│  3. Check Server Policy (config/policy.json)               │
│  4. Check User Policy (~/.config/...)                      │
│  5. Union of both = Effective Allowlist                    │
│  6. If domain in allowlist → ALLOW                         │
│  7. Otherwise → DENY                                       │
└─────────────────────────────────────────────────────────────┘
```

### Security Layers

| Layer | Description |
|-------|-------------|
| HTTPS Enforcement | Block HTTP requests by default |
| Domain Allowlist | Only allow requests to trusted domains |
| Redirect Revalidation | Re-check domain after redirects |
| Capability Gates | Require explicit enablement for risky tools |
| Request Timeout | Prevent resource exhaustion |
| Concurrent Limits | Prevent abuse |

### Capability System

Tools are gated by capabilities defined in policy:

| Capability | Tools |
|------------|-------|
| `always` | `add_domain`, `remove_domain`, `list_domains`, `policy_status` |
| `webSearch` | `web_search` |
| `extract` | `extract` |
| `webFetch` | `web_fetch` |
| `advancedBrowserOps` | `navigate`, `screenshot`, `click`, `fill`, `select`, `hover` |
| `evalScript` | `evaluate` (disabled by default) |

## Browser Lifecycle

### Ephemeral Browser Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                   Tool Call Execution                        │
├─────────────────────────────────────────────────────────────┤
│  1. Tool request received                                  │
│  2. Check if browser needed                                 │
│  3. If needed:                                             │
│     a. Check for existing browser connection               │
│     b. If none: Launch new browser or attach via CDP      │
│  4. Execute tool operation                                 │
│  5. Return result                                          │
│  6. Close browser (auto-cleanup)                           │
└─────────────────────────────────────────────────────────────┘
```

**Browser Launch Options:**
1. **CDP Attach** - Connect to existing Chrome at `localhost:9222`
2. **Launch** - Start new browser process (fallback)

### Configuration Priority

Browser mode is determined by (highest to lowest):

1. Environment variable: `PLAYWRIGHT_HEADLESS`
2. User config: `~/.config/mcp-playwright-server/allowed-domains.json`
3. Default: `true` (headless)

## Data Flow

### Tool Execution Flow

```
Client Request
     │
     ▼
┌─────────────┐
│ Request     │
│ Handler     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Policy      │◀── Validate URL/domain
│ Check       │
└──────┬──────┘
       │
       ▼ (if allowed)
┌─────────────┐
│ Tools       │
│ Handler     │
└──────┬──────┘
       │
       ├──────────────────┬──────────────────┐
       ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐   ┌─────────────┐
│ Browser     │    │ HTTP Fetch  │   │ User Config │
│ Operations  │    │ (web_fetch) │   │ (domains)   │
└──────┬──────┘    └──────┬──────┘   └──────┬──────┘
       │                  │                  │
       └──────────────────┴──────────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │ Audit       │──▶ Log to stderr
                   │ Logger      │
                   └─────────────┘
                          │
                          ▼
                   Response to Client
```

## Configuration Files

### Server Policy (`config/policy.json`)

```json
{
  "version": 1,
  "security": {
    "httpsOnly": true,
    "allowedDomains": ["example.com"],
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
    "maxResultItems": 10,
    "maxResponseChars": 20000,
    "maxRedirectHops": 5
  }
}
```

### User Config (`~/.config/mcp-playwright-server/allowed-domains.json`)

```json
{
  "allowedDomains": ["example.com"],
  "browser": {
    "headless": true,
    "devtools": false
  }
}
```

## Extension Points

### Adding New Tools

1. Define tool metadata in `src/tools.ts`
2. Add handler case in `src/toolsHandler.ts`
3. Add capability check if needed
4. Update documentation

### Adding New Policy Rules

1. Add rule logic in `src/policy.ts`
2. Update policy types in `src/policyTypes.ts`
3. Update default policy
4. Update documentation

## Performance Considerations

- **Browser Reuse**: Browser instances are reused across requests when possible
- **In-Memory Cache**: Screenshots and logs stored in memory with size limits
- **Concurrent Limits**: Maximum 3 concurrent requests (configurable)
- **Timeout Protection**: Default 15-second timeout per request
