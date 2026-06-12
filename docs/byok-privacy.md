# BYOK Key Privacy Guarantee

This document explains exactly what happens to your API key when you use the
"Use Direct API" (Bring Your Own Key) mode in DocCode, and how you can verify
the guarantee yourself.

## The guarantee

> Your API key is stored only in this browser (localStorage). In custom-API
> mode, requests go directly from your browser to the endpoint you configure.
> The key is never included in any request to the DocCode server, never
> received by the DocCode backend, and never logged. This is structurally
> enforced in code, locked by regression tests, and verifiable yourself in
> DevTools.

## How it works, code pointer by code pointer

| What | Where |
|---|---|
| Mode selector: routes to `callCustomAPI` when `useCustomAPI && endpoint && apiKey` | `demoSite/js/ai-assistant.js:587` |
| Direct send: key goes only to `config.endpoint` as `Authorization: Bearer` | `demoSite/js/ai-assistant-api.js:24-45` |
| H1 structural guard: proxy request body never includes `api_key` or `endpoint`; hard assert at top of `callProxyAPI` throws if custom mode leaks in | `demoSite/js/ai-assistant-api.js:80-84` |
| Server forces its own key: ignores any client-supplied key/endpoint; H6 pops them before any code path that could log | `demoSite/server.py` — `api_key = AI_PROXY_API_KEY` and H6 pop |
| Export strips the key | `demoSite/js/config.js:427-429` |
| Key stored in localStorage under `kroki-user-config` | `demoSite/js/config.js:152, 203-205` |

## Verifying it yourself in DevTools

1. Open DocCode in Chrome/Firefox.
2. Open **DevTools → Network** (filter: `api`).
3. Go to **Settings → AI Assistant**, enable "Use Direct API", enter any HTTPS
   endpoint (e.g. `https://api.openai.com/v1/chat/completions`) and a test key
   (e.g. `sk-test`), then click **Save**.
4. Send a chat message.
5. In the Network panel you will see **one** request carrying
   `Authorization: Bearer sk-test` — it goes to **your endpoint**, not to
   `localhost:8443` or the DocCode origin.
6. Inspect the request to `/api/ai-assist` (if any appears — in custom mode
   none should): confirm its body contains no `api_key` field and no `sk-`
   string.

## localStorage

The key is stored **plaintext** under `kroki-user-config` in your browser's
localStorage. It is visible to any script running on the page (which is why
H3/H4 — Content-Security-Policy and vendored CDN bundles — matter for the
theft-protection leg of the guarantee). The key is:

- **Never exported** via the Settings → Export button (`config.js:427-429`
  sets `ai.apiKey = ''` in the export).
- **Never included** in shareable diagram URLs (those contain only the diagram
  source code).
- **Cleared** when you clear browser data or localStorage.

## Regression tests that lock this guarantee

| Test | What it locks |
|---|---|
| `byokKey.test.js` T1 | `callCustomAPI` fetches only the user endpoint with the correct `Authorization: Bearer` header |
| `byokKey.test.js` T2 | `callCustomAPI` never targets the DocCode origin / `/api/ai-assist` |
| `byokKey.test.js` T3 (H1 sentinel) | `callProxyAPI` body contains no `api_key`, no `endpoint`, no `sk-` string |
| `byokKey.test.js` T4 | Mode selector stays on custom under retry — no fallback to proxy |
| `byokKey.test.js` T5 | `configManager.export()` strips the key |
| `byokKey.test.js` T6 | `chatHistory` / `getConversationHistory()` entries contain no key or endpoint |
| `byokKey.test.js` T7 (H2) | XSS payload in customModel is entity-escaped; `window.__pwned` stays undefined |
| `test_server.py` T8 | Server uses its own key, not any client-supplied key |
| `test_server.py` T9 | `sk-CANARY` never appears in any log record at DEBUG level |
