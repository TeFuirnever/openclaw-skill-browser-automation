# OpenClaw Browser Automation Skill

Browser automation skill for OpenClaw with **web search, fetch, and extraction capabilities**.

## Installation

### Option 1: Clone to OpenClaw skills directory

```bash
git clone https://github.com/openclaw/skill-browser-automation.git ~/.openclaw/skills/browser-automation
```

### Option 2: Add to project skills

Copy the `skills/browser-automation` folder to your project's `/skills/` directory.

### Option 3: Use as MCP Server

```bash
npm install
npm run build
```

Add to your MCP config:

```json
{
  "browser-automation": {
    "command": "node",
    "args": ["/path/to/openclaw-skill-browser-automation/dist/index.js"]
  }
}
```

## Available Tools

### Web Search & Fetch

| Tool | Purpose |
|------|---------|
| `browser_web_search` | Search the web using DuckDuckGo or Bing |
| `browser_web_fetch` | Fetch page content via HTTP GET |
| `browser_extract` | Extract readable text from web pages |

### Browser Automation

| Tool | Purpose |
|------|---------|
| `browser_navigate` | Navigate to URL |
| `browser_snapshot` | Get accessibility tree (PREFERRED) |
| `browser_click` | Click element |
| `browser_type` | Type text |
| `browser_screenshot` | Take screenshot |
| `browser_wait_for` | Wait for conditions |
| `browser_close` | Close browser |

## Core Patterns

### Web Search

```
browser_web_search({ query: "MCP protocol docs", engine: "duckduckgo", limit: 10 })
```

Returns structured results with titles, URLs, and snippets.

### Fetch Content

```
browser_web_fetch({ url: "https://api.example.com/data" })
```

Fast HTTP fetch for APIs and raw content.

### Extract Readable Content

```
browser_extract({ url: "https://example.com/article" })
```

Uses Mozilla Readability to extract clean text (strips ads, navigation).

### Page Analysis

```
browser_navigate(url) → browser_snapshot() → analyze
```

### Form Filling

```
browser_snapshot() → browser_type(ref, text) → browser_click(submit_ref)
```

## Example Workflows

### Search and Summarize

```
1. browser_web_search({ query: "TypeScript 5.0 features" })
2. browser_extract({ url: first_result.url })
3. Summarize the extracted content
```

### API Integration

```
1. browser_web_fetch({ url: "https://api.github.com/repos/owner/repo" })
2. Parse JSON and process data
```

### Web Scraping

```
1. browser_navigate({ url: "https://example.com/products" })
2. browser_snapshot()
3. Extract data from page structure
4. browser_close()
```

## Best Practices

1. **Use `browser_web_search`** for finding information (not manual navigation)
2. **Use `browser_web_fetch`** for API calls (faster than browser)
3. **Use `browser_extract`** for reading articles (clean output)
4. **Use `browser_snapshot`** for page analysis (not screenshots)
5. **Close browser** when task is complete

## Prerequisites

For MCP server mode, install dependencies:

```bash
npm install
npx playwright install chromium
```

## License

MIT
