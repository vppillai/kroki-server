# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 2.8.x (latest release) | ✅ |
| < 2.8 | ❌ |

Security fixes are made against `main` and shipped in the next tagged release.
Only the latest release is supported.

## Reporting a Vulnerability

Please use **GitHub Private Vulnerability Reporting**: go to the repository's
*Security* tab and click *Report a vulnerability*. This gives you a private
channel, a CVE workflow if needed, and coordinated disclosure — no public
issue required.

Do not open public GitHub issues for security reports.

Direct link:
[github.com/vppillai/kroki-server/security/advisories/new](https://github.com/vppillai/kroki-server/security/advisories/new)

We aim to acknowledge reports within 7 days.

## Deployment Security

The default configuration (`./setup-kroki-server.sh start`) targets **closed
networks**: it generates a self-signed certificate, enables the AI relay with
the operator's API key, and applies no render rate limits. This is intentional
for trusted-network use and does not represent a gap in the security model for
that use case.

**Before exposing DocCode to the public internet**, read
[docs/production-deployment.md](docs/production-deployment.md). Key items:

- Enable real TLS (`TLS_MODE=acme`) — do not present a self-signed cert to
  public users.
- Understand the AI relay spend risk — the relay charges your `AI_PROXY_API_KEY`
  for every `/api/ai-assist` request from any visitor. Set `AI_MODEL_ALLOWLIST`,
  `AI_DAILY_LIMIT_PER_IP`, or `AI_ACCESS_TOKEN` before going public, or run in
  BYOK mode (`AI_PROXY_API_KEY` empty).
- `KROKI_SAFE_MODE=secure` is already the Kroki core image default and is now
  explicitly pinned in `docker-compose.yml`. Do not set `unsafe` on a public
  instance — it enables PlantUML `!include`/`!includeurl`, which can reach cloud
  metadata endpoints (SSRF).
- Set `DEPLOY_PROFILE=public` for nginx-level rate limits, a 1 MB body cap on
  render routes, and 30 s proxy timeouts.

## BYOK Key Privacy Guarantee

In BYOK mode (or when users enable "Use Direct API" in Settings), the user's API
key is stored only in the browser (localStorage) and is sent only to the endpoint
the user configures — it never reaches the DocCode server, is never received by
the backend, and is never logged. This is structurally enforced in code and locked
by regression tests.

See [docs/byok-privacy.md](docs/byok-privacy.md) for the full guarantee and
DevTools verification steps.

## AI Relay Spend Warning

When `AI_PROXY_API_KEY` is set and `AI_ENABLED=true`, every `/api/ai-assist`
call charges the operator's key. A single motivated user can trigger
multi-dollar-per-hour costs against an unprotected relay. Mitigate with
`AI_MODEL_ALLOWLIST="*:free"`, `AI_DAILY_LIMIT_PER_IP`, or `AI_ACCESS_TOKEN`
before any public exposure.

## Current Security Posture

- **TLS:** HTTPS with TLS 1.2/1.3; selfsigned (default) or Let's Encrypt (`acme`)
- **CSP:** Content-Security-Policy headers active; all JS/CSS is vendored locally
  (no external CDN fetches)
- **HSTS:** `Strict-Transport-Security` emitted in `acme` mode
- **AI relay auth:** HMAC session cookie + optional `AI_ACCESS_TOKEN` bearer gate
- **Origin enforcement:** POST render and AI endpoints validate the `Origin` header
- **Token/timeout clamps:** `AI_MAX_TOKENS` and `AI_TIMEOUT_MAX` hard-cap relay requests
- **Per-IP AI rate limit:** `AI_DAILY_LIMIT_PER_IP` (in-memory per worker; see
  production guide for the multi-worker caveat)
- **Kroki safe mode:** `KROKI_SAFE_MODE=secure` (image default, now explicitly pinned)
  blocks PlantUML SSRF/LFI
- **Non-root containers:** services run as non-root users where possible
- **Dependency updates:** Dependabot + CI (pytest + bun) on every PR to `main`
