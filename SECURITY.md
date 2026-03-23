# Security Policy

## Reporting Security Vulnerabilities

Report security issues to security@openclaw.ai instead of opening a public issue.

## Security Features

This skill uses `@playwright/mcp@latest` which provides:

- **Domain restrictions**: Use `--allowed-origins` flag
- **Isolation mode**: Use `--isolated` flag
- **Service worker blocking**: Use `--block-service-workers` flag

## Recommended Configuration

```json
{
  "playwright": {
    "command": "npx",
    "args": [
      "@playwright/mcp@latest",
      "--headless",
      "--block-service-workers",
      "--isolated"
    ]
  }
}
```

## Security Best Practices

### For Users

- Restrict allowed origins with `--allowed-origins`
- Use `--isolated` for memory-only sessions
- Block service workers with `--block-service-workers`
- Close browser when task is complete

### For Contributors

- Never include credentials in skill examples
- Validate user input before passing to tools
- Follow secure browser automation patterns

## Update Policy

Security updates will be released in the skill documentation.
