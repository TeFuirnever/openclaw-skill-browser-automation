# Contributing to MCP Playwright Server

Thank you for your interest in contributing to MCP Playwright Server!

## Code of Conduct

Please read and follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

1. Search existing issues to confirm it's not a duplicate
2. Use the bug report template to create an issue
3. Provide reproduction steps and environment details

### Suggesting Features

1. Search existing issues and PRs
2. Use the feature request template
3. Clearly describe the use case

### Submitting Code

1. Fork the project
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Follow the code style (run `npm run lint`)
4. Write tests covering new code
5. Commit and push: `git commit -m 'feat: add amazing feature'`
6. Open a Pull Request

## Development Setup

```bash
git clone https://github.com/TeFuirnever/mcp-playwright-server.git
cd mcp-playwright-server
npm install
npm run build
npm test
```

## Code Standards

- Use ESLint for code checking
- Use Prettier for formatting
- Follow TypeScript best practices
- Maintain 80%+ test coverage

## Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>

[optional body]
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

Example:
```
feat: add user-level domain management

Add support for users to manage their own trusted domains
via MCP tools instead of only server-level configuration.
```

## Review Process

1. Automated checks must pass (lint, build, test)
2. At least one maintainer reviews
3. Address all review comments

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
