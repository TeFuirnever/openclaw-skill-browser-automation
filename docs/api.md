# API Reference

This document provides detailed documentation for all MCP tools provided by the Playwright Server.

## Table of Contents

- [Domain Management Tools](#domain-management-tools)
- [Query Tools](#query-tools)
- [Browser Tools](#browser-tools)
- [Error Responses](#error-responses)

---

## Domain Management Tools

### playwright_add_domain

Add a domain to the user's trusted domains list.

**Capability:** Always available (no policy gate)

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| domain | string | Yes | Domain to add (e.g., `example.com`) |

**Example:**
```json
{
  "name": "playwright_add_domain",
  "arguments": {
    "domain": "my-internal-api.company.com"
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"added\":true,\"domains\":[\"example.com\",\"my-internal-api.company.com\"]}"
    }
  ]
}
```

---

### playwright_remove_domain

Remove a domain from the user's trusted domains list.

**Capability:** Always available

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| domain | string | Yes | Domain to remove |

**Example:**
```json
{
  "name": "playwright_remove_domain",
  "arguments": {
    "domain": "my-internal-api.company.com"
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"removed\":true,\"domains\":[\"example.com\"]}"
    }
  ]
}
```

---

### playwright_list_domains

List all trusted domains (server + user configured).

**Capability:** Always available

**Parameters:** None

**Example:**
```json
{
  "name": "playwright_list_domains",
  "arguments": {}
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"server\":[\"www.bing.com\",\"www.google.com\"],\"user\":[\"example.com\"],\"effective\":[\"www.bing.com\",\"www.google.com\",\"example.com\"]}"
    }
  ]
}
```

---

### playwright_policy_status

Get effective security policy and runtime diagnostics.

**Capability:** Always available

**Parameters:** None

**Example:**
```json
{
  "name": "playwright_policy_status",
  "arguments": {}
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"version\":1,\"security\":{\"httpsOnly\":true,\"allowedDomains\":[...]},\"capabilities\":{...}}"
    }
  ]
}
```

---

## Query Tools

### playwright_web_search

Run a web search and return result links.

**Capability:** `webSearch`

**Browser:** Required

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| query | string | Yes | - | Search query |
| engine | string | No | `duckduckgo` | Search engine: `duckduckgo` or `bing` |
| limit | number | No | 10 | Max results to return (1-50) |
| timeout | number | No | 15000 | Timeout in milliseconds (1000-60000) |

**Example:**
```json
{
  "name": "playwright_web_search",
  "arguments": {
    "query": "TypeScript best practices 2024",
    "engine": "bing",
    "limit": 5
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "[{\"title\":\"...\",\"url\":\"https://...\",\"snippet\":\"...\"}]"
    }
  ]
}
```

---

### playwright_extract

Extract readable text from a web page.

**Capability:** `extract`

**Browser:** Required

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| url | string | Yes | - | Target URL to extract content from |
| selector | string | No | `body` | CSS selector for specific content |
| timeout | number | No | 15000 | Timeout in milliseconds |

**Example:**
```json
{
  "name": "playwright_extract",
  "arguments": {
    "url": "https://www.example.com/article",
    "selector": "article.content"
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Extracted article content..."
    }
  ]
}
```

---

### playwright_web_fetch

Fetch page content via HTTP GET.

**Capability:** `webFetch`

**Browser:** Not required

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| url | string | Yes | - | URL to fetch |
| timeout | number | No | 15000 | Timeout in milliseconds |

**Example:**
```json
{
  "name": "playwright_web_fetch",
  "arguments": {
    "url": "https://api.example.com/data",
    "timeout": 10000
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"status\":200,\"headers\":{...},\"body\":\"...\"}"
    }
  ]
}
```

---

## Browser Tools

### playwright_navigate

Navigate browser to a URL.

**Capability:** `advancedBrowserOps`

**Browser:** Required

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| url | string | Yes | - | Target URL |
| width | number | No | 1920 | Viewport width (320-4096) |
| height | number | No | 1080 | Viewport height (240-4096) |
| timeout | number | No | 15000 | Navigation timeout (ms) |
| waitUntil | string | No | `load` | Wait condition: `domcontentloaded`, `load`, `networkidle`, `commit` |

**Example:**
```json
{
  "name": "playwright_navigate",
  "arguments": {
    "url": "https://www.example.com",
    "width": 1920,
    "height": 1080,
    "waitUntil": "networkidle"
  }
}
```

---

### playwright_screenshot

Take a screenshot of the current page.

**Capability:** `advancedBrowserOps` or `download`

**Browser:** Required

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| name | string | No | auto-generated | Screenshot name |
| selector | string | No | - | CSS selector for element screenshot |
| width | number | No | 1920 | Viewport width |
| height | number | No | 1080 | Viewport height |
| storeBase64 | boolean | No | true | Store in memory cache |
| savePng | boolean | No | true | Save as PNG file |
| downloadsDir | string | No | - | Custom downloads directory |
| timeout | number | No | 15000 | Timeout in milliseconds |

**Example:**
```json
{
  "name": "playwright_screenshot",
  "arguments": {
    "name": "homepage",
    "width": 1920,
    "height": 1080
  }
}
```

---

### playwright_click

Click an element on the page.

**Capability:** `advancedBrowserOps`

**Browser:** Required

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| selector | string | Yes | CSS selector for element to click |
| timeout | number | No | Timeout in milliseconds |

**Example:**
```json
{
  "name": "playwright_click",
  "arguments": {
    "selector": "button.submit",
    "timeout": 5000
  }
}
```

---

### playwright_fill

Fill an input field.

**Capability:** `advancedBrowserOps`

**Browser:** Required

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| selector | string | Yes | CSS selector for input field |
| value | string | Yes | Value to fill |
| timeout | number | No | Timeout in milliseconds |

**Example:**
```json
{
  "name": "playwright_fill",
  "arguments": {
    "selector": "input[name='email']",
    "value": "user@example.com"
  }
}
```

---

### playwright_select

Select option in a dropdown.

**Capability:** `advancedBrowserOps`

**Browser:** Required

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| selector | string | Yes | CSS selector for select element |
| value | string | Yes | Value to select |
| timeout | number | No | Timeout in milliseconds |

**Example:**
```json
{
  "name": "playwright_select",
  "arguments": {
    "selector": "select[name='country']",
    "value": "US"
  }
}
```

---

### playwright_hover

Hover over an element.

**Capability:** `advancedBrowserOps`

**Browser:** Required

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| selector | string | Yes | CSS selector for element to hover |
| timeout | number | No | Timeout in milliseconds |

**Example:**
```json
{
  "name": "playwright_hover",
  "arguments": {
    "selector": ".menu-item"
  }
}
```

---

### playwright_evaluate

Execute JavaScript in browser context.

**Capability:** `evalScript` (disabled by default)

**Browser:** Required

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| script | string | Yes | JavaScript code to execute |
| timeout | number | No | Timeout in milliseconds |

**Example:**
```json
{
  "name": "playwright_evaluate",
  "arguments": {
    "script": "document.title"
  }
}
```

**Note:** This tool is disabled by default for security reasons. Enable via policy configuration.

---

## Error Responses

All tools may return error responses in the following format:

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"error\":\"Domain not allowed\",\"code\":\"POLICY_DENIED\",\"requestId\":\"...\"}"
    },
    {
      "isError": true
    }
  ]
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `POLICY_DENIED` | Request denied by security policy |
| `INVALID_INPUT` | Invalid parameters provided |
| `TIMEOUT` | Request timed out |
| `RATE_LIMITED` | Too many requests |
| `UPSTREAM_ERROR` | External service error |
| `INTERNAL_ERROR` | Internal server error |

### Retryable Errors

- `TIMEOUT` - Can be retried
- `RATE_LIMITED` - Can be retried after delay
- `UPSTREAM_ERROR` - Can be retried

### Non-retryable Errors

- `POLICY_DENIED` - Policy must be changed
- `INVALID_INPUT` - Parameters must be fixed
- `INTERNAL_ERROR` - Requires investigation
