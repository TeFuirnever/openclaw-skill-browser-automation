# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- User-level trusted domains configuration support
- Browser headless mode by default
- Ephemeral browser lifecycle (auto-close after each operation)
- Browser configuration via user config file

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [0.3.0] - 2024-03-11

### Added
- Initial release with MCP server support
- Chrome CDP attach-first connection with fallback launch
- Policy-driven security (HTTPS-only, domain allowlists)
- Query-first tools design optimized for LLM workflows
- Audit logging for security monitoring
- In-memory caches with configurable limits

### Tools Included
- `playwright_web_search` - Search the web
- `playwright_extract` - Extract readable text from pages
- `playwright_web_fetch` - HTTP GET with policy validation
- `playwright_policy_status` - Get policy status
- `playwright_add_domain` / `playwright_remove_domain` / `playwright_list_domains` - Domain management
