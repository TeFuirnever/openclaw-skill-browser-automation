# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability, please send an email to support@matrix.com instead of opening a public issue.

We will acknowledge your report within 24 hours and provide a detailed fix plan within one week.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | :white_check_mark: |
| < 0.3   | :x:                |

## Security Best Practices

### For Users

- Run `npm audit` regularly to check for known vulnerabilities
- Keep dependencies up to date
- Use environment variables for sensitive configuration
- Follow the principle of least privilege when configuring allowed domains
- Review the security policy in `config/policy.json` before deployment

### For Developers

- Never hardcode secrets in source code
- Always validate user input
- Follow secure coding practices
- Use parameterized queries for any database operations
- Enable audit logging for production deployments

## Security Features

This project includes the following security features:

- **HTTPS-only enforcement**: Blocks HTTP requests by default
- **Domain allowlisting**: Only allows requests to trusted domains
- **Redirect revalidation**: Re-validates domain after redirects
- **Capability gates**: High-risk operations require explicit enablement
- **Request timeout limits**: Prevents resource exhaustion
- **Concurrent request limiting**: Prevents abuse

## Vulnerability Disclosure

We appreciate security researchers who responsibly disclose vulnerabilities. We thank contributors for their efforts to improve our security.

## Update Policy

Security updates will be released as patch versions and announced in the changelog.
