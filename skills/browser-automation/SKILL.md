---
name: browser_automation
description: Browser automation patterns using @playwright/mcp for web scraping, form filling, and navigation
metadata:
  openclaw:
    requires:
      bins: ["npx"]
---

# Browser Automation with Playwright MCP

Use `@playwright/mcp` tools for browser automation tasks.

## Available Tools

| Tool | Purpose |
|------|---------|
| `browser_navigate` | Navigate to URL |
| `browser_snapshot` | Get accessibility tree (PREFERRED for AI) |
| `browser_click` | Click element by ref |
| `browser_type` | Type text into element |
| `browser_fill_form` | Fill multiple form fields |
| `browser_screenshot` | Take screenshot |
| `browser_wait_for` | Wait for text/element |
| `browser_tabs` | Manage browser tabs |
| `browser_evaluate` | Execute JavaScript |
| `browser_file_upload` | Upload files |
| `browser_drag` | Drag and drop |
| `browser_select_option` | Select dropdown option |
| `browser_press_key` | Press keyboard key |
| `browser_hover` | Hover over element |
| `browser_close` | Close browser |

## Core Patterns

### 1. Page Analysis (Always Use Snapshot)

```
browser_navigate(url) → browser_snapshot() → analyze accessibility tree
```

**Why:** Snapshot returns structured text (accessibility tree). Screenshot returns image. Text is 10x faster/cheaper for AI.

### 2. Form Filling

```
browser_snapshot() → browser_fill_form(fields) → browser_click(submit)
```

### 3. Data Extraction

```
browser_navigate(url) → browser_snapshot() → browser_evaluate(extraction_script)
```

### 4. Login Flow

```
browser_navigate(login_url) → browser_type(credentials) → browser_click(login) → browser_wait_for(success)
```

### 5. Multi-Page Navigation

```
browser_navigate(url) → browser_click(link) → browser_snapshot() → browser_navigate_back()
```

## Best Practices

1. **Use `browser_snapshot`** for understanding page state (not screenshot)
2. **Batch form fills** with `browser_fill_form` instead of multiple `browser_type`
3. **Wait explicitly** with `browser_wait_for` for dynamic content
4. **Use refs from snapshot** for element interactions (click, type, hover)
5. **Close browser** when task is complete

## Element Selection

Tools use `ref` from snapshot output:
1. First call `browser_snapshot` to get page structure
2. Each element has a `ref` attribute
3. Use that `ref` in `browser_click`, `browser_type`, etc.

## Example Workflow

```
User: "Go to example.com and extract all product names"

1. browser_navigate("https://example.com/products")
2. browser_snapshot() → get page structure with refs
3. browser_evaluate(`
   Array.from(document.querySelectorAll('.product-name'))
     .map(el => el.textContent)
   `)
4. browser_close()
```
