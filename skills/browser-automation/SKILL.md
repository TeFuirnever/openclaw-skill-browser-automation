---
name: browser_automation
description: Browser automation with web search, fetch, and extraction capabilities using Playwright
metadata:
  openclaw:
    requires:
      bins: ["npx"]
---

# Browser Automation Skill

Comprehensive browser automation with web search, fetch, and content extraction.

## Available Tools

### Web Search & Fetch

| Tool | Purpose |
|------|---------|
| `browser_web_search` | Search the web using DuckDuckGo or Bing |
| `browser_web_fetch` | Fetch page content via HTTP GET |
| `browser_extract` | Extract readable text from any web page |

### Browser Automation

| Tool | Purpose |
|------|---------|
| `browser_navigate` | Navigate to URL |
| `browser_snapshot` | Get accessibility tree (PREFERRED for AI) |
| `browser_click` | Click element by ref |
| `browser_type` | Type text into element |
| `browser_screenshot` | Take screenshot |
| `browser_wait_for` | Wait for text/element |
| `browser_close` | Close browser |

## Tool Details

### browser_web_search

Run a web search and get structured results.

```json
{
  "query": "MCP protocol documentation",
  "engine": "duckduckgo",  // or "bing"
  "limit": 10
}
```

Returns:
```
1. MCP Protocol Specification
   URL: https://modelcontextprotocol.io/
   The Model Context Protocol (MCP) is an open standard...

2. ...
```

### browser_web_fetch

Fetch raw content from any URL.

```json
{
  "url": "https://example.com/api/data",
  "timeout": 30000
}
```

Returns:
- Status code
- Content-Type header
- Raw body (HTML, JSON, or text)

### browser_extract

Extract clean, readable text from web pages using Mozilla Readability.

```json
{
  "url": "https://example.com/article",
  "selector": "body"  // optional CSS selector
}
```

Returns:
- Page title
- Extracted main content (strips ads, navigation, etc.)

## Core Patterns

### 1. Web Search → Navigate → Extract

```
browser_web_search(query) → browser_navigate(url) → browser_extract(url)
```

### 2. Fetch API Data

```
browser_web_fetch(api_url) → parse JSON response
```

### 3. Page Analysis (Always Use Snapshot)

```
browser_navigate(url) → browser_snapshot() → analyze accessibility tree
```

**Why:** Snapshot returns structured text. Screenshot returns image. Text is 10x faster/cheaper for AI.

### 4. Form Filling

```
browser_snapshot() → browser_type(ref, text) → browser_click(submit_ref)
```

### 5. Login Flow

```
browser_navigate(login_url) → browser_type(credentials) → browser_click(login) → browser_wait_for("Welcome")
```

## Best Practices

1. **Use `browser_web_search`** for finding information (not manual navigation to search engines)
2. **Use `browser_web_fetch`** for API calls and raw content (faster than browser)
3. **Use `browser_extract`** for reading articles/blog posts (clean output)
4. **Use `browser_snapshot`** for understanding page state (not screenshot)
5. **Close browser** when task is complete to free resources

## Example Workflows

### Search and Summarize

```
User: "Search for latest TypeScript features and summarize"

1. browser_web_search({ query: "TypeScript 5.0 new features", limit: 5 })
2. browser_extract({ url: first_result.url })
3. Summarize extracted content
```

### Fetch API and Process

```
User: "Get user data from the API"

1. browser_web_fetch({ url: "https://api.example.com/users" })
2. Parse JSON response
3. Process data as needed
```

### Web Scraping

```
User: "Go to example.com and extract all product names"

1. browser_navigate({ url: "https://example.com/products" })
2. browser_snapshot() → get page structure
3. browser_extract({ url: "https://example.com/products" })
4. browser_close()
```
