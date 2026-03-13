# Deployment Guide

This guide covers various deployment options for the MCP Playwright Server.

## Table of Contents

- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Production Considerations](#production-considerations)
- [Environment Variables](#environment-variables)
- [Monitoring and Logging](#monitoring-and-logging)

---

## Local Development

### Quick Start

```bash
# Clone and install
git clone https://github.com/TeFuirnever/mcp-playwright-server.git
cd mcp-playwright-server
npm install
npm run build

# Run locally
node dist/index.js
```

### Development Mode

```bash
# Watch mode - auto-rebuild on changes
npm run watch

# Run tests
npm test
```

---

## Docker Deployment

### Using the Official Image

```bash
# Pull and run
docker run -p 3000:3000 \
  -v $(pwd)/config:/app/config:ro \
  ghcr.io/tefuirnever/mcp-playwright-server:latest
```

### Building from Source

```bash
# Build the image
docker build -t mcp-playwright-server .

# Run the container
docker run -p 3000:3000 \
  -v $(pwd)/config:/app/config:ro \
  mcp-playwright-server
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  mcp-playwright:
    image: ghcr.io/tefuirnever/mcp-playwright-server:latest
    ports:
      - "3000:3000"
    volumes:
      - ./config:/app/config:ro
      - mcp-data:/home/node/.config/mcp-playwright-server
    environment:
      - PLAYWRIGHT_HEADLESS=true
    restart: unless-stopped

volumes:
  mcp-data:
```

### Multi-stage Dockerfile

The project includes a production-ready Dockerfile with:

- Multi-stage build (builder + release)
- Non-root user for security
- Playwright browsers pre-installed
- Minimal image size

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts
COPY src ./src
RUN npm run build

# Release stage
FROM mcr.microsoft.com/playwright:v1.50.0-jammy
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
RUN useradd -m mcpuser && chown -R mcpuser:mcpuser /app
USER mcpuser
ENTRYPOINT ["node", "dist/index.js"]
```

---

## Production Considerations

### Security Checklist

- [ ] Enable HTTPS-only in policy (`httpsOnly: true`)
- [ ] Configure domain allowlist
- [ ] Disable risky capabilities (`evalScript: false`)
- [ ] Set appropriate timeouts
- [ ] Configure concurrent request limits
- [ ] Enable audit logging

### Recommended Production Policy

```json
{
  "version": 1,
  "security": {
    "httpsOnly": true,
    "allowedDomains": ["your-domain.com"],
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
  },
  "audit": {
    "enabled": true,
    "logLevel": "info",
    "redactSensitiveFields": true
  }
}
```

### Resource Limits

For production deployments, consider:

| Resource | Recommended Limit |
|----------|-------------------|
| Memory | 512MB - 1GB |
| CPU | 0.5 - 1 core |
| Concurrent Requests | 3 |
| Request Timeout | 15s |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PLAYWRIGHT_HEADLESS` | `true` | Run browser in headless mode |
| `PLAYWRIGHT_DEVTOOLS` | `false` | Open DevTools in headed mode |
| `MCP_PLAYWRIGHT_CDP_URL` | - | Remote Chrome CDP URL |

### Setting Environment Variables

**Docker:**
```bash
docker run -e PLAYWRIGHT_HEADLESS=false mcp-playwright-server
```

**Docker Compose:**
```yaml
environment:
  - PLAYWRIGHT_HEADLESS=true
  - MCP_PLAYWRIGHT_CDP_URL=http://remote-host:9222
```

---

## Monitoring and Logging

### Audit Logs

The server outputs structured JSON logs to stderr:

```json
{
  "ts": "2024-03-11T12:00:00.000Z",
  "requestId": "req-123",
  "tool": "playwright_web_search",
  "host": "www.bing.com",
  "decision": "allow",
  "code": "OK",
  "latencyMs": 150
}
```

### Log Levels

Configure via `config/policy.json`:

```json
{
  "audit": {
    "enabled": true,
    "logLevel": "info"  // "info" | "warn" | "error"
  }
}
```

### Collecting Logs

**Docker:**
```bash
docker logs -f mcp-playwright-server 2>&1 | jq '.'
```

**Docker Compose:**
```bash
docker compose logs -f mcp-playwright-server
```

### Health Checks

For container orchestration, the server responds to stdin/stdout. For HTTP health checks, consider adding a reverse proxy:

```nginx
# Nginx configuration
location /health {
    return 200 '{"status":"healthy"}\n';
    add_header Content-Type application/json;
}
```

---

## Troubleshooting

### Browser Won't Launch

1. Check if Playwright browsers are installed
2. Verify sufficient system resources
3. Check for conflicting processes on port 9222

### Domain Not Allowed

1. Add domain to server policy (`config/policy.json`)
2. Or add domain via `playwright_add_domain` tool

### Timeout Errors

1. Increase `requestTimeoutMs` in policy
2. Check network connectivity
3. Verify target website is accessible

### Memory Issues

1. Reduce `maxConcurrentRequests`
2. Enable headless mode
3. Clear screenshot cache periodically

---

## Integration with Claude Desktop

### Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "node",
      "args": ["/path/to/mcp-playwright-server/dist/index.js"]
    }
  }
}
```

### Docker Integration

```json
{
  "mcpServers": {
    "playwright": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-v", "/path/to/config:/app/config:ro",
        "ghcr.io/tefuirnever/mcp-playwright-server:latest"
      ]
    }
  }
}
```
