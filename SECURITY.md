# Security Policy

## Supported Versions

Currently, we support security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you believe you've found a security vulnerability in our project, please follow these steps:

1. **Do Not** disclose the vulnerability publicly
2. Email us at [vysakhpillai@embeddedinn.com](mailto:vysakhpillai@embeddedinn.md) with details about the vulnerability
3. Allow us time to investigate and address the vulnerability
4. We will coordinate with you on the disclosure timeline

## Security Measures

This project implements several security measures:

- HTTPS support with TLS 1.2/1.3
- Secure Nginx configuration with hardened headers
- Docker containers run with non-root users where possible
- Regular dependency updates via Dependabot

## Docker Security

We follow Docker security best practices:
- Running containers with limited privileges
- Using official base images
- Regularly updating base images
- Scanning for vulnerabilities in our containers