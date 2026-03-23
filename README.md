# OpenClaw Browser Automation Skill

Browser automation skill for OpenClaw using `@playwright/mcp`.

## Installation

### Option 1: Clone to OpenClaw skills directory

```bash
git clone https://github.com/openclaw/skill-browser-automation.git ~/.openclaw/skills/browser-automation
```

### Option 2: Add to project skills

Copy the `skills/browser-automation` folder to your project's `/skills/` directory.

## Prerequisites

Configure `@playwright/mcp` in your OpenClaw MCP config:

```json
{
  "playwright": {
    "command": "npx",
    "args": ["@playwright/mcp@latest", "--headless"]
  }
}
```

## What This Skill Provides

This skill teaches OpenClaw agents how to use browser automation tools:

| Tool | Purpose |
|------|---------|
| `browser_navigate` | Navigate to URL |
| `browser_snapshot` | Get accessibility tree (PREFERRED) |
| `browser_click` | Click element |
| `browser_type` | Type text |
| `browser_fill_form` | Fill multiple fields |
| `browser_screenshot` | Take screenshot |
| `browser_wait_for` | Wait for conditions |
| `browser_tabs` | Manage tabs |
| `browser_evaluate` | Run JavaScript |
| `browser_file_upload` | Upload files |
| `browser_close` | Close browser |

## Core Patterns

### Page Analysis

```
browser_navigate(url) → browser_snapshot() → analyze
```

### Form Filling

```
browser_snapshot() → browser_fill_form(fields) → browser_click(submit)
```

### Data Extraction

```
browser_navigate(url) → browser_evaluate(extraction_script)
```

## Best Practices

1. Use `browser_snapshot` instead of `browser_screenshot` for AI analysis
2. Batch form fills with `browser_fill_form`
3. Use element refs from snapshot for interactions
4. Close browser when task is complete

## Security

Recommended configuration with security flags:

```json
{
  "playwright": {
    "command": "npx",
    "args": [
      "@playwright/mcp@latest",
      "--headless",
      "--block-service-workers",
      "--isolated",
      "--allowed-origins", "https://trusted-site.com"
    ]
  }
}
```

## License

MIT
