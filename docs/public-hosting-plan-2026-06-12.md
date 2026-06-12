# DocCode Public Hosting — Consolidated Implementation Plan (2026-06-12)

Status: **plan of record** for Phase 1 ("take DocCode public").
Supersedes the Phase-1 list in `docs/scale-cost-brainstorm-2026-06-12.md` §7.
Deep reference (full specs, critiques, audits): `.omc/planning-2026-06-12/` (local, untracked — see Appendix).

How to read this document: §2 is what the owner must decide before/while work proceeds; §3 is the revised AI design (the largest delta vs the planning archive); §4 is the build order with per-PR scope, snippets, and acceptance; §5-§6 are the contracts (env vars, shared mechanics, the demo's exact `.env` + ops); §7 records what was consciously deferred. An implementer should be able to build Phase 1 from this document alone, dropping into the archive only for full evidence trails and verbatim spec text.

---

## 1. Executive summary

This plan delivers two things:

1. **A publicly hostable DocCode.** Every change ships in the open-source repo and works for self-hosters: real ACME TLS (`TLS_MODE=acme`), gunicorn replacing the Flask dev server, an nginx render cache + profile-driven abuse limits (`DEPLOY_PROFILE=public`), compose profiles to trim the companion renderers, an explicit `KROKI_SAFE_MODE=secure` pin, a three-state AI posture (`relay`/`byok`/`off`), and a hardened, **verifiable BYOK key-privacy guarantee**. The closed-network default (`./setup-kroki-server.sh start`, self-signed TLS, full companion set, relay on) remains behavior-preserving with one reviewed exception (the always-on render cache, which adds an `X-Cache-Status` header and a 1-minute 400/404 TTL).
2. **A hosted public demo at ~EUR 5-7/mo.** A Hetzner CAX11 ARM box (EUR 4.49/mo) running the trimmed stack behind Let's Encrypt, with the AI assistant **working out of the box** via the OpenRouter free-mode hybrid: the relay stays ON using the operator's key restricted to `:free` models (operator cost: a one-time $10 credit, $0/month thereafter), per-IP daily caps protect the shared pool, and quota exhaustion degrades gracefully into guided BYOK with the user's own free OpenRouter key.

**How this plan was produced.** Seven parallel workstream specs (app-server, tls-acme, render-cache-abuse, public-mode-ai, compose-footprint, hosting-cost, docs-packaging), each adversarially critiqued, then an integration review that resolved 10 cross-workstream conflicts and defined the shared components and PR sequence. Two targeted investigations followed: a BYOK key-lifecycle security audit (verdict + H1-H7 hardening + 10-test regression plan) and an OpenRouter free-tier research report (verified limits, ToS posture, hybrid recommendation). Where a critique flagged a blocker/major and the integration review endorsed the fix, the fixed version is the plan of record here.

**Two user directives override the earlier integration rulings** (both of which assumed "public = relay off / BYOK-only"):

- The public demo's default AI posture is the **free-mode hybrid** (relay ON, `AI_MODEL_ALLOWLIST="*:free"`, fallback chain, per-IP daily cap, friendly quota-exhausted UX into BYOK). The `PUBLIC_MODE` flag is **dropped entirely**; the public posture is an explicit, documented `.env` bundle (§6).
- The **BYOK privacy guarantee is a Phase-1 deliverable**: the byok-audit hardening H1-H7 and its regression tests are in scope, split across PR-3 (guarantee) and a new PR-4 (key-theft hardening: CSP + vendored CDN deps).

Relationship to the brainstorm: `docs/scale-cost-brainstorm-2026-06-12.md` remains the architectural rationale (planes model, cost tiers, levers). Its §7 Phase-1 roadmap is replaced by §4 below; its Phase 2/3 items carry forward in §8.

---

## 2. Decisions requiring user sign-off

| # | Decision | Recommendation | Why |
|---|----------|----------------|-----|
| 1 | **Demo domain name** | User picks (subdomain of an existing domain, or a new `doccode.*` purchase ~EUR 11/yr at Porkbun/Cloudflare). All copy uses `<DEMO_DOMAIN>` placeholder until resolved; pre-tag grep gate blocks release while it remains. | External brand/budget decision; everything else is parameterized via `HOSTNAME`. Blocks PR-7 end-to-end test and PR-8/PR-9. |
| 2 | **OpenRouter one-time $10 credit purchase** | **Yes.** Buy once on the operator account before launch. | Lifts the shared `:free` pool from 50 → 1000 requests/day (verified, lifetime — credits never expire) and prevents 402 errors from a zero/negative balance. This is the entire recurring AI budget: $0/month after the one-time $10. |
| 3 | **Default free model + fallback chain (demo box)** | `AI_MODEL=qwen/qwen3-coder:free`, `AI_MODEL_FALLBACKS="meta-llama/llama-3.3-70b-instruct:free,openai/gpt-oss-120b:free"` | qwen3-coder is code-tuned with 1M context (good fit for diagram DSLs) and a long-lived free survivor; llama-3.3-70b has been free since early 2025. The roster churns monthly, hence the server-side fallback walk at startup. |
| 4 | **Per-IP AI cap value** | `AI_DAILY_LIMIT_PER_IP="10/minute;30/day"` | 30/day ≈ 2-6 assistant sessions per user; bounds one IP at 3% of the 1000/day shared pool. Tunable in `.env` post-launch by observing 429 rates. |
| 5 | **Release version: v2.8.0 vs v3.0.0** | **v2.8.0** (plan of record per integration ruling) | The two "breaking" claims dissolved under verification: `KROKI_SAFE_MODE=secure` is already the pinned image's default (the pin is a confirmation, not a flip), and gunicorn is behavior-equivalent. The private render profile is made truly behavior-preserving (PR-6). v3.0.0 stays available for a future deliberate break. |
| 6 | **Initial HSTS max-age = 86400 (1 day)** | **Yes**, raise to 31536000 a week after launch. | Rollback safety: if `TLS_MODE=acme` must be reverted to selfsigned on a live box, browsers that received a year-long HSTS header hard-fail for the whole max-age. One day caps the blast radius of an early rollback. |
| 7 | **KROKI_CORE_IMAGE digest pinning on the demo box** | **Yes** — pin `KROKI_CORE_IMAGE=ghcr.io/vppillai/kroki-core@sha256:...` in the demo `.env`, bump deliberately at deploy time. | `:goat` is a moving tag rebuilt weekly from upstream main (`build-kroki-core.yml:22-23`); an unattended upstream regression on a public box is otherwise unauditable. The safe-mode verification (§4 PR-6) is digest-specific. |
| 8 | **Security contact for SECURITY.md** | GitHub Private Vulnerability Reporting as primary; user supplies a secondary email + acknowledgment SLA (suggest 7 days). | Current `SECURITY.md:16` mailto is broken (text says embeddedinn.com, href says `.md`). PVR needs no email exposure and gives CVE workflow for free. Personal commitment → user's call. |
| 9 | **Hosting provider/instance** | **Hetzner CAX11** (2 vCPU Ampere ARM, 4 GB, 40 GB NVMe, 20 TB traffic, EUR 4.49/mo) + auto-backups (+EUR 0.90/mo), Falkenstein DE, Ubuntu 24.04, 2 GB swap. | Cheapest 4 GB box that holds the trimmed stack; entire image set verified multi-arch (core GHCR manifest + all yuzutech 0.30.1 companions + nginx + on-box demosite build). Confirm CAX11/IPv4 prices in the Hetzner console at order time (Apr-2026 price adjustment). |
| 10 | **Public render-limit values** (`DEPLOY_PROFILE=public`: 10 r/s burst 30, conn 20, 1m body, 30s timeouts) | Accept as specced; monitor 429s after launch. | Sized for an interactive editor (debounced preview ≈ 1-2 renders/s/user; burst 30 absorbs page loads and shared NATs). The **private** profile is now behavior-preserving (zones emitted, no limit directives, 300s timeouts kept), so only the public values need blessing. |
| 11 | **Key-less relay → `byok` mode** (behavior change) | **Yes.** `AI_ENABLED=true` with empty `AI_PROXY_API_KEY` now yields working BYOK guidance instead of a request-time 400 (`server.py:511-512`). | Converts a guaranteed runtime failure into a guided path. Alters a documented failure mode and flips `ai.enabled`/`ai_enabled` advertisements to false on key-less deployments — call out in release notes. |
| 12 | **Shipped default `AI_MODEL`: gpt-4o → gpt-4o-mini** (`.env.example:23`, `server.py:103`) | **Yes.** | Brainstorm flags gpt-4o as a high-cost default footgun for relay self-hosters. Only fresh installs see the change (prod preserves `.env`); the demo box overrides with the free model anyway. Release-note item. |
| 13 | **Repo naming: keep `kroki-server` slug, brand as DocCode** | Keep the slug; rebrand via description/topics/README. Optional rename to `doccode` later as a deliberate separate change. | Renaming mid-launch churns ghcr image paths (`release.yml:34`), the `/opt/kroki-server` prod checkout, and every clone URL. |
| 14 | **GitHub repo description/topics wording** | Adopt the docs-packaging draft ("DocCode — self-hostable diagram editor with optional AI…", topics: diagram-editor, kroki, plantuml, mermaid, self-hosted, …). Enable Private Vulnerability Reporting in Settings → Security. | Positioning copy; needs the owner's voice check. |

---

## 3. AI posture (revised)

### 3.1 What changed and why

The original public-mode-ai spec and the integration review set the public demo to "relay off, BYOK-only" behind a `PUBLIC_MODE` flag. **Overridden by user directive**: the demo's AI must work out of the box. The OpenRouter research verified that a free-tier hybrid does this at $0/month marginal cost with a defensible ToS posture. `PUBLIC_MODE` is dropped — it existed only to force the relay off, and the demo no longer wants that. No single flag makes a deployment public-safe; the public posture is the explicit `.env` bundle in §6, and the docs must say so.

### 3.2 Verified OpenRouter facts (as of 2026-06-12)

| Fact | Value | Status |
|---|---|---|
| `:free` model pricing | $0 prompt / $0 completion (22 models live today, of 337 total) | VERIFIED (live `/api/v1/models` pull) |
| Rate limit, `:free` variants | **20 requests/minute** per account | VERIFIED (official limits doc, rendered values) |
| Daily cap, < $10 lifetime credits | **50 `:free` requests/day** | VERIFIED |
| Daily cap, ≥ $10 lifetime credits | **1000 `:free` requests/day**; the $10 is one-time, credits never expire | VERIFIED |
| Pooling scope | **Per account**, not per key/user: "making additional accounts or API keys will not affect your rate limits" — all relayed demo users share ONE pool | VERIFIED |
| Quota exhaustion | HTTP **429**, OpenAI-style body with `X-RateLimit-Reset` (epoch ms) in metadata; `Retry-After` may be present | VERIFIED |
| Second 429 flavor | Upstream free-capacity exhaustion ("temporarily rate-limited upstream") — can fire below your own quota | VERIFIED |
| Negative balance | **402** errors, including on free models | VERIFIED |
| BYOK signup friction | Email or Google, **no credit card**, key works immediately; ~2 minutes. Each no-credit user gets their own 50/day, 20 rpm | VERIFIED |
| BYOK gotcha | Many free endpoints require the account privacy toggle ("Enable training and logging"), else "No endpoints found matching your data policy" — instructions must mention it | VERIFIED |
| OAuth PKCE | "Connect OpenRouter" one-click key exchange exists (`/api/v1/auth/keys`) — Phase-2 UX upgrade | VERIFIED (exists; not built here) |
| Free-roster churn | Fast and real: month-to-month cycling; DeepSeek R1/Gemini Flash/Kimi K2/Mistral free variants gone since the last guide update. Survivors: `meta-llama/llama-3.3-70b-instruct:free`, `qwen/qwen3-coder:free` | VERIFIED (live diff) |
| ToS posture | Reselling API access and multi-account quota circumvention are prohibited; serving your own app's users through a server key is the documented standard pattern. Single-key relay restricted to `:free` + own per-IP limits = low risk; "many anonymous users on one free key" is the residual gray zone | Quotes VERIFIED; interpretation INFERRED |

Capacity math (inferred): 1000/day ≈ 70-200 user-sessions/day at 5-15 AI calls each — fine for launch traffic; a viral spike exhausts the pool until the daily reset, which is exactly the state the quota UX handles. The 20 rpm global ceiling bites first under concurrency; the upstream-429 mapping covers it.

### 3.3 The mode model: `relay` | `byok` | `off`

`compute_ai_mode()` from public-mode-ai survives, minus the `PUBLIC_MODE` input:

```python
def compute_ai_mode(ai_enabled, has_proxy_key):
    if not ai_enabled:
        return 'off'      # assistant hidden entirely (AI_ENABLED=false)
    if not has_proxy_key:
        return 'byok'     # relay unusable; UI guides users to their own key
    return 'relay'        # server proxies on its own key (closed-network default AND the public demo)
```

- **`relay`** — what the public demo runs: `AI_ENABLED=true` + operator key + `AI_MODEL_ALLOWLIST="*:free"` + per-IP caps. Also the unchanged closed-network default.
- **`byok`** — what self-hosters without a key (or who deliberately leave `AI_PROXY_API_KEY=""`) get: relay endpoint 503s with a machine-readable mode, assistant UI stays visible and guides custom-key setup. This replaces today's request-time 400.
- **`off`** — `AI_ENABLED=false`: assistant button hidden; true kill switch.

All plumbing from the public-mode-ai spec is retained: module-level `AI_MODE`, the mode gate in `ai_assist()` ordered Origin → mode (503 + `{'mode': ...}`) → session auth (`server.py:451-458` today), `ai.mode` in `/api/config` (with `ai.enabled == (mode=='relay')` for back-compat), mode fields in `/api/available-models` (nulling `proxy_url`/`proxy_name` in non-relay modes — no proxy leak), `/api/health`, `/api/version`, and the frontend `applyServerMode()` with all five critique fixes (see PR-3). `/api/ai-prompts` **must stay un-gated in byok mode** — the BYOK client path calls `fetchPromptTemplates()` before `callCustomAPI` (`ai-assistant.js:547`); add a test asserting it.

### 3.4 The free-mode hybrid (relay configuration for the demo)

Env contract (full bundle in §6):

```bash
AI_ENABLED=true
AI_PROXY_URL=https://openrouter.ai/api/v1
AI_PROXY_API_KEY="<operator key>"        # $10 banked once → 1000 free req/day
AI_MODEL_ALLOWLIST="*:free"              # comma-separated globs; empty = allow all (current behavior)
AI_MODEL=qwen/qwen3-coder:free
AI_MODEL_FALLBACKS="meta-llama/llama-3.3-70b-instruct:free,openai/gpt-oss-120b:free"
AI_DAILY_LIMIT_PER_IP="10/minute;30/day"
```

Server design (all in `demoSite/server.py`, consistent with existing code):

1. **Allowlist = glob filter on the live model list.** In `fetch_models_from_proxy()` (~line 226), after the `NON_CHAT_MODEL_KEYWORDS` filter, drop models not matching any `AI_MODEL_ALLOWLIST` pattern (`fnmatch`); apply the same filter to the `load_available_models()` static fallback. Because both `/api/available-models` (line 333) and the relay's injection check (lines 486-503) read `AVAILABLE_MODELS`, **one filter point secures the UI list and the relay**. This supersedes the public-mode-ai spec's `build_models_from_allowlist()` exact-ID design (a glob matches exact IDs too, so it strictly generalizes).
2. **Startup default-model self-heal.** If `AI_MODEL` is absent from the filtered `AVAILABLE_MODELS`, walk `AI_MODEL_FALLBACKS` in order and log loudly which one won (extends the request-time validation at lines 501-503 to a startup fix — required because the free roster churns).
3. **Upstream quota mapping.** When the proxy returns 429 (either flavor) or a 402, respond `429` with `{"error": <shared-pool copy>, "code": "free_quota_exhausted", "retry_after": <from Retry-After / X-RateLimit-Reset when present>}` so the client can branch.
4. **Per-IP daily cap.** Add `AI_DAILY_LIMIT_PER_IP` as a second flask-limiter decoration on `/api/ai-assist` (alongside the existing `@limiter.limit("10/minute")` at line 444; ProxyFix at line 71 makes it genuinely per-IP behind nginx). Register a 429 handler so the limiter's rejection returns `{"code": "per_ip_quota", "error": <per-IP copy>}` — distinct from the shared-pool state.

**Honest caveat (state in docs and `.env.example`):** flask-limiter's store is in-memory per gunicorn worker (`server.py:72`), so with `GUNICORN_WORKERS=2` the effective per-IP cap is ~2× the configured value and resets on deploy. Acceptable for Phase 1; the Redis store is Phase 2. Do not silently lower the configured limits to compensate.

### 3.5 Quota UX (frontend, two distinct states)

`applyServerMode` work from public-mode-ai is retained and extended. On a relay 429, the client branches on `code`:

**`free_quota_exhausted` (shared pool / upstream free capacity) — system message with a button opening the existing custom-API settings panel pre-filled with `https://openrouter.ai/api/v1`:**

> **The shared free AI quota for this demo is used up for today.**
> This demo runs on OpenRouter's free tier, which everyone here shares. It resets daily — or you can keep going right now with your own free key:
> 1. Sign up at openrouter.ai (email or Google — no credit card).
> 2. Create a key under **Keys**, and in **Settings → Privacy**, enable free endpoints ("training/logging") so `:free` models work.
> 3. Paste the key in **AI Settings → Use my own API key**. Your key stays in your browser — it is never sent to our server.
> You'll get your own 50 free requests/day. Everything else in DocCode works without AI.

**`per_ip_quota` (this user hit the per-IP cap):**

> You've hit this demo's per-user AI limit for today. Add your own free OpenRouter key in AI Settings to continue without limits.

The "never sent to our server" line in that copy is a published promise — which is why the BYOK hardening below is in scope.

### 3.6 BYOK privacy guarantee — audit verdict and hardening

**Audit verdict (read-only lifecycle trace, `.omc/planning-2026-06-12/byok-audit-report.md`):** overall risk **MEDIUM**.
- *"Never sent to the DocCode backend"*: **holds today, but as a runtime guard, not a structural impossibility** — the selector at `ai-assistant.js:587` routes custom-mode requests to `callCustomAPI` (`ai-assistant-api.js:24-45`, key goes only to the user's endpoint as `Authorization: Bearer`), and the retry loop never falls back to the proxy; but `callProxyAPI` wires the live key into the proxy request body regardless of mode (`ai-assistant-api.js:100`), so one regression in the guard silently leaks it. The server ignores and never reads a client key (`server.py:508-509`).
- *"Never logged"*: **holds today** — no body/header logging anywhere in `server.py` (only endpoint/model/timings at :514, :524, :578, :605; Origin value only at :400/:403).
- *"Reasonably protected from theft"*: **PARTIAL — the weakest leg.** No CSP anywhere (`setup-kroki-server.sh:177-179`; none in `index.html`); CodeMirror + pako load from esm.sh with no SRI (`index.html:14-46`) — the single most realistic theft path; a self-XSS sink where user-controlled `customModel` reaches `innerHTML` unescaped (`ai-assistant.js:539` → `ai-assistant-ui.js:134`) because `sanitizeString` only truncates (`validation.js:82-87`) — combined with config import (`config-ui.js:365-385`) that becomes one-click key theft.

**Hardening H1-H7 (all Phase 1; H1/H2/H5/H6/H7 in PR-3, H3/H4 in PR-4):**

| # | Fix | Target |
|---|-----|--------|
| H1 | Remove `endpoint`/`api_key` from the proxy request body (pure deletion — server already ignores them); optional loud assert at the top of `callProxyAPI` | `demoSite/js/ai-assistant-api.js:91-103` (esp. `:100`) |
| H2 | Escape `selectedModel` before the `rawHtml=true` system message; make `sanitizeString` strip `<>` in addition to truncating; validate `ai.customModel`/`ai.endpoint` on config import | `demoSite/js/ai-assistant.js:539`; `demoSite/js/modules/validation.js:82-87`; `demoSite/js/config.js:442-458` |
| H3 | Content-Security-Policy via the `NGINX_SECURITY_HEADERS` fragment: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'` — `connect-src 'self' https:` keeps BYOK frictionless (browser→any-HTTPS-endpoint) while blocking http:/ws: exfiltration; provider allowlist is the Phase-2 stricter follow-up | `setup-kroki-server.sh` param block (the shared fragment, §5) |
| H4 | Vendor the pinned CodeMirror/pako ESM bundles into `demoSite/js/vendor/` (deterministic from `package.json` `cdn-dependencies`), drop esm.sh from the importmap, tighten to `script-src 'self'` — removes the supply-chain theft path entirely | `demoSite/index.html:14-46`; new `demoSite/js/vendor/` |
| H5 | In-UI provenance note under the key field: "🔒 Stored only in this browser (localStorage) and sent only to the AI API URL above — never to the DocCode server", linking the verification doc | `demoSite/js/config-ui-templates.js:319-340` |
| H6 | Server-side belt-and-suspenders: pop `config.api_key`/`config.endpoint` from the parsed request body before anything could ever log it | `demoSite/server.py` near `:466` |
| H7 | User-verifiable doc (guarantee text, DevTools verification steps, code pointers to `ai-assistant.js:587`, `ai-assistant-api.js:24-45`, `server.py:508-509`, `config.js:427-429`, localStorage note) | new `docs/byok-privacy.md` (or `.html`), linked from H5 and README |

**Regression tests (10, locking the guarantee):**

bun — new `demoSite/tests/byokKey.test.js`:
1. `callCustomAPI` fetches only the configured endpoint, with `Authorization: Bearer sk-TEST` (locks `ai-assistant-api.js:37-44`).
2. No fetch in custom mode ever targets the app origin / `/api/ai-assist`.
3. Post-H1: the serialized `callProxyAPI` body contains no `api_key`, no `endpoint`, and not the test key string — **the regression sentinel for the latent leak**.
4. The mode selector stays on custom under retry (reject-once-then-resolve fetch mock; locks the no-fallback property, `ai-assistant.js:652-663`).
5. `configManager.export()` strips the key (locks `config.js:427-429`).
6. No key in `chatHistory` / `getConversationHistory()` entries (`ai-assistant.js:467-476`).
7. Post-H2: the customModel XSS payload renders escaped (`window.__pwned` undefined); `renderMarkdownContent` yields no `script`/`img` elements (locks `dom.js:71-127` safety).

pytest — extend the existing `post_ai` harness in `test_server.py`:
8. Server ignores client-supplied `api_key`/`endpoint`: the captured upstream call uses the server's `AI_PROXY_URL`/`AI_PROXY_API_KEY`, never `sk-CLIENT`/`evil.example` (locks `server.py:508-509`).
9. `sk-CANARY` in `config.api_key` never appears in any log record at DEBUG (locks "never logged" + H6).
10. Documented N/A: "server never sees the key in custom mode" is untestable server-side — no request arrives at all; that negative is covered by JS tests 2/3.

**The guarantee we can honestly publish (after PR-3 + PR-4):**

> Your API key is stored only in this browser (localStorage). In custom-API mode, requests go directly from your browser to the endpoint you configure; the key is never included in any request to this site, never received by the DocCode server, and never logged. This is structurally enforced in code (the proxy request cannot carry it), locked by regression tests, and verifiable yourself in DevTools — see docs/byok-privacy.md.

Before PR-4 lands, the theft-protection clause must not be published — CSP and CDN integrity are what make "reasonably protected from theft" true.

---

## 4. Implementation sequence

Nine PRs (renumbered from integration.md's eight: the new key-theft-hardening PR slots in as PR-4; everything downstream shifts by one).

```
PR-1 foundation ──┬── PR-2 gunicorn          (parallel)
                  ├── PR-3 AI posture + BYOK (parallel; trivial get_config merge with PR-5)
                  ├── PR-4 key-theft hardening (parallel; one-line fragment edit, trivial rebase vs PR-6/7)
                  ├── PR-5 compose profiles + limits (parallel)
                  └── PR-6 render cache + safe-mode ──► PR-7 TLS/ACME   (STRICTLY SERIALIZED: same heredoc)
PR-1..7 ──► PR-8 staging dry-run + runbook
PR-8 (+ drafting earlier) ──► PR-9 docs + release v2.8.0 (merges last)
```

Serialization rules: the nginx-heredoc pair **PR-6 → PR-7** is the only hard ordering (render-cache restructures the location bodies first; tls-acme's edits — param-block locals, `${ssl_cert}`/`${acme_http_server}` injection, overlay — are orthogonal after rebase). PR-4 also touches generator output (the fragment variable) but is a one-line append; land it whenever, rebase is mechanical. PR-3 and PR-5 both add a field to `get_config` — coordinate that one merge.

### PR-1 — Foundation: script/CI plumbing (behavior-preserving)

**Scope** (`setup-kroki-server.sh`, `.github/workflows/ci.yml`):
- Flip compose detection (`:52-63`) to prefer `docker compose` v2 with a **>= 2.24.0** guard and a clear error for older (needed for `--profile '*'`, overlay merge, `deploy.resources.limits`). The script currently prefers legacy v1 — verified, and `--profile '*'` hard-breaks under `set -e` on v1.
- Canonical lifecycle: `DOCKER_COMPOSE` always carries its `-f` list (base; + `docker-compose.acme.yml` when `TLS_MODE=acme`); `stop`/`restart` → `$DOCKER_COMPOSE --profile '*' down --remove-orphans`; `clean` → `--profile '*' down --rmi all -v --remove-orphans` (down `-v` removes the future `nginx_cache` named volume — `docker volume prune` does NOT, verified on Docker ≥23; `./letsencrypt` is a bind dir and survives). All flags are safe no-ops today.
- Single param block inserted **after the entire `.env` if/else** (after line 41, not inside the if-branch), in fixed order: `export COMPOSE_PROFILES="${COMPOSE_PROFILES-companions}"`; `TLS_MODE="${TLS_MODE:-selfsigned}"` + dirs; `DEPLOY_PROFILE="${DEPLOY_PROFILE:-private}"` + `RENDER_*` defaults; `NGINX_SECURITY_HEADERS` / cache-fragment / `acme_http_server` computation. All later nginx-adjacent PRs write into this one block.
- `NGINX_SECURITY_HEADERS` refactor (§5) with **byte-identical default output** (golden-diff test). Shape of the fragment (PR-1 ships the three existing lines; PR-4 appends CSP; PR-7 appends HSTS under acme):

```bash
# --- shared security-headers fragment (param block) -------------------------
# Emitted at http level AND restated verbatim in every location that declares
# its own add_header (nginx cancels http-level inheritance per location).
NGINX_SECURITY_HEADERS='
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Frame-Options SAMEORIGIN;'
# PR-4 appends: add_header Content-Security-Policy "..." always;
# PR-7 appends (TLS_MODE=acme only):
#   add_header Strict-Transport-Security "max-age=86400" always;
```
- `genconfig` subcommand: runs only `create_nginx_config` + prints resolved TLS/profile params, no stack start. New CI job: generate nginx.conf for {default, public, acme+public} and run `nginx -t` in `nginx:1.28-alpine` against dummy certs.
- Widen ci.yml shellcheck from scandir `./setup-kroki-server.sh` to also cover `scripts/` (currently the only file linted — `ci.yml:20-23`).

**Precondition:** ssh prod (`/opt/kroki-server`) and confirm its compose version ≥ 2.24 before merge; write the upgrade note for the existing prod `.env` (expected answer: "no new vars required").
**Acceptance:** `genconfig` default output byte-identical to main; `nginx -t` green for all three CI configs; shellcheck green; `start/stop/restart/clean` behave identically on the current stack.
**Parallelism:** everything else rebases on this. Small PR; land first.

### PR-2 — App server: gunicorn (parallel after PR-1)

**Scope:**
- New `demoSite/gunicorn.conf.py` — essentials:

```python
worker_class = "gthread"
workers  = int(env("GUNICORN_WORKERS", "2"))    # env() = os.environ.get(name) or default — empty-string tolerant
threads  = int(env("GUNICORN_THREADS", "8"))
timeout  = int(env("GUNICORN_TIMEOUT", "30"))   # liveness heartbeat, NOT a per-request limit: 300s SSE survives (verified)
graceful_timeout = int(env("GUNICORN_GRACEFUL_TIMEOUT", "30"))  # must stay below compose stop_grace_period
preload_app = True       # master imports server.py once → all workers share the per-boot SESSION_SECRET
                         # (without preload: 2 workers = 2 secrets = intermittent 401s; reproduced empirically)
worker_tmp_dir = "/dev/shm"
accesslog = "-"; errorlog = "-"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(L)ss'
```

- `demoSite/requirements.txt`: `gunicorn==26.0.0` (verified: pure-Python, boots the real app, 21/21 pytest green; fallback pin 25.3.0 if staging misbehaves; fastest rollback = revert Dockerfile CMD to `python server.py`).
- `demoSite/Dockerfile`: COPY `gunicorn.conf.py`; HEALTHCHECK start-period 10s → 30s (covers the pre-existing import-time proxy `/models` fetch, `server.py:264`, 10s timeout — **critique fix**: not a preload-specific cost); CMD → `["gunicorn", "--config", "/app/gunicorn.conf.py", "server:app"]`.
- `docker-compose.yml` demosite: `stop_grace_period: 35s` (else docker SIGKILLs at 10s, making graceful_timeout moot).
- `.env.example` GUNICORN_* commented block + per-worker limiter-multiplication warning; `server.py` __main__ marked dev-only (comment); README dev-vs-prod note.

**Critique fixes (plan of record):** acceptance session-loop ≤16 requests (30 trips the 2×10/min limiter); keepalive comment softened (no nginx upstream keepalive block exists, the setting is inert as justified); empty-env-tolerant `env()` helper (an uncommented-but-empty var must not crash-loop the container).
**Acceptance:**
- pytest 21/21 and bun suites unchanged; image runs 1 gunicorn master + 2 workers (`ps` in the container); `/api/health` → 200.
- Cross-worker session check: **≤16 POSTs** (30 trips the per-worker 10/min limiter and pollutes the tally with 429s — critique-reproduced), zero 401s; negative control with `preload_app=False` MUST show intermittent 401s.
- SSE stream >30s survives `timeout=30` and arrives unbuffered (verified empirically in the spec; re-runnable).
- Graceful stop logs "Worker exiting"/"Shutting down: Master" rather than SIGKILL; full-stack CI smoke (`start` + curl :8443) unchanged.
- Access logs show the Apache-style line ending in `%(L)s` request seconds.
**Note (directive consequence):** the public demo now runs the relay ON, so SSE streams DO hold threads (up to 300s each, 16-thread ceiling) and the per-worker limiter multiplication is live on the demo — both documented, both acceptable at this scale; Redis is Phase 2.
**Parallelism:** no nginx/profile coupling — fully parallel with PR-3/4/5.

### PR-3 — AI posture + BYOK guarantee (parallel after PR-1)

**Scope — server (`demoSite/server.py`):**
- `compute_ai_mode(ai_enabled, has_proxy_key)` + module-level `AI_MODE` (monkeypatchable; §3.3). No `PUBLIC_MODE` anywhere.
- Mode gate in `ai_assist()` between Origin check and `authorize_ai_request` (503 + `{'mode': ...}` body, replacing the old enabled-check at `:457-458`):

```python
if not validate_origin(request, require=True):
    return jsonify({'error': 'Unauthorized origin'}), 403
if AI_MODE != 'relay':
    return jsonify({'error': 'The AI relay is disabled on this server. Add your own '
                             'OpenAI-compatible endpoint and API key in Settings → AI Assistant.',
                    'mode': AI_MODE}), 503
if not authorize_ai_request(request):
    return jsonify({'error': 'Unauthorized. Please reload the page and try again.'}), 401
```

- `AI_MODEL_ALLOWLIST` glob filter — the one filter point (§3.4) securing both the UI list and the relay (both read `AVAILABLE_MODELS`; no change needed at `:486-503`):

```python
import fnmatch
AI_MODEL_ALLOWLIST = [p.strip() for p in env('AI_MODEL_ALLOWLIST', '').split(',') if p.strip()]

def apply_model_allowlist(grouped):
    """Filter the {provider: {model_id: info}} dict by allowlist globs. Empty list = allow all."""
    if not AI_MODEL_ALLOWLIST:
        return grouped
    out = {}
    for provider, models in grouped.items():
        kept = {mid: info for mid, info in models.items()
                if any(fnmatch.fnmatch(mid, pat) for pat in AI_MODEL_ALLOWLIST)}
        if kept:
            out[provider] = kept
    return out
# call sites: end of fetch_models_from_proxy() (~:226, after NON_CHAT_MODEL_KEYWORDS)
#             and on the load_available_models() static fallback
```

- `AI_MODEL_FALLBACKS` startup walk when `AI_MODEL` is filtered out / absent (extends the request-time validation at `:501-503` to a startup self-heal; log loudly which model won).
- Upstream quota mapping in the relay error path: proxy 429 (both flavors) or 402 →

```python
return jsonify({'error': FREE_QUOTA_COPY, 'code': 'free_quota_exhausted',
                'retry_after': retry_after}), 429   # retry_after from Retry-After / X-RateLimit-Reset if present
```

- Per-IP daily cap: second flask-limiter decoration on `/api/ai-assist` — `@limiter.limit(lambda: AI_DAILY_LIMIT_PER_IP, ...)` active only when the var is set — plus a 429 error handler emitting `{'code': 'per_ip_quota', 'error': PER_IP_COPY}` so the client can distinguish it from the shared-pool state.
- `/api/config` `ai.mode` (+ back-compat `enabled == (mode=='relay')`), `/api/available-models` mode fields with proxy-leak nulling (`proxy_url`/`proxy_name` null outside relay), `/api/health` + `/api/version` `ai_mode`, startup log line.
- **H6** body-pop near `:466`; explicit non-gating of `/api/ai-prompts` in byok mode (+ test).

**Scope — frontend (`demoSite/js/`):**
- `applyServerMode(mode)` with all critique fixes: in `off`, `closeChat()` **before** hiding the button (closeChat re-shows it at `ai-assistant.js:277`) and guard `openChat/minimizeChat` on `serverAIMode`; in `byok`, also `configManager.set('ai.useCustomAPI', true)` and re-run `toggleDependentFields()` (programmatic `.checked` fires no change event — the state-desync fix); one-time onboarding system message.
- BYOK model-validation blocker fix: wrap the server `validateModel` call in `if (!aiConfig.useCustomAPI)` (`ai-assistant.js:536-544`) — without it every BYOK send is blocked client-side.
- config-ui-models.js byok branch (custom-only dropdown, un-hide custom-model field, BYOK copy, "None — bring your own key" backend line); `id="custom-api-description"` in templates.
- Quota states: parse `code` from relay 429s (`ai-assistant-api.js:108-109` already surfaces `errorData.error`; extend to carry `code`/`retry_after`); render the two §3.5 messages; button opens settings pre-filled with `https://openrouter.ai/api/v1`.
- **H1** — the structural fix for the latent key leak (pure deletion; server already ignores both fields at `server.py:508-509`):

```js
// ai-assistant-api.js ~91-103 — BEFORE: config: { use_custom_api: ..., endpoint: config.endpoint,
//                                                api_key: config.apiKey, timeout: config.timeout }
// AFTER — never put the BYOK key (or endpoint) in a request to our own origin:
body: JSON.stringify({
    messages, model: ..., maxRetryAttempts: config.maxRetryAttempts,
    max_tokens: AI_API_MAX_TOKENS, stream: true,
    config: { timeout: config.timeout } }),
// plus, top of callProxyAPI — fail loud if the mode selector ever regresses:
if (config.useCustomAPI && config.apiKey) throw new Error('proxy path must not run in custom mode');
```

- **H2** (escape `selectedModel` with an `&<>"'` entity helper before the `rawHtml=true` message; `sanitizeString` strips `<>` in addition to truncating; import-time validation of `ai.customModel`/`ai.endpoint`) and **H5** (provenance note under the key field, linking H7's doc).

**Scope — tests/docs/env:** conftest pops for `AI_MODEL_ALLOWLIST`, `AI_MODEL_FALLBACKS`, `AI_DAILY_LIMIT_PER_IP`, `DISABLED_DIAGRAM_TYPES` (one hygiene change, coordinated with PR-5); the 8 public-mode pytests adapted to the new `compute_ai_mode` signature, plus allowlist-glob, fallback-walk, 429-mapping, ai-prompts-ungated tests; the byok-guarantee suite (§3.6 tests 1-9); **H7** `docs/byok-privacy.md`; `.env.example` AI block (new vars, gpt-4o-mini default, spend warning replacing the old PUBLIC_MODE pointer); README "AI assistant deployment modes" section.

**Acceptance:**
- All pytest + bun suites green; the existing 21 pytest tests pass unmodified (conftest keeps the test app in relay mode).
- byok-mode curl matrix: `/api/config` → `ai.mode=='byok'`, `enabled==false`; `/api/available-models` → `models=={}`, `proxy_url==null` (no proxy leak); POST `/api/ai-assist` with valid Origin but no session → **503 with `mode`, not 401**; `/api/ai-prompts` still 200.
- Allowlist curl matrix: with `AI_MODEL_ALLOWLIST="*:free"` against a live proxy, `/api/available-models` lists only `:free` IDs; a non-matching model POST → 400 without reaching upstream (assert via the test upstream fixture).
- Fallback walk: with `AI_MODEL` set to a filtered-out ID, startup logs the winning fallback and `/api/config` advertises it.
- Quota mapping: mocked upstream 429 (both body flavors) and 402 each → client-visible `429 {"code":"free_quota_exhausted"}` with `retry_after` when derivable; the 31st same-IP request in a day → `429 {"code":"per_ip_quota"}`.
- Relay-mode regression: behaviorally identical to v2.7.0 with only additive fields (`mode`, `ai_mode`); full restart on a default `.env` serves as the manual check.
- BYOK guarantee sentinels: bun tests 1-7 + pytest 8-9 green; test 3 (serialized proxy body contains no key/endpoint) is the regression sentinel for H1.
- Manual UI: byok onboarding message with working settings button; "Use Direct API" checked + persisted + dependent fields enabled (the state-sync fix); both quota states render with the §3.5 copy; DevTools confirms BYOK requests go only to the user's endpoint.

**Parallelism:** server/JS only — parallel with PR-2/4/5; coordinate the trivial `get_config` merge with PR-5.

### PR-4 — Key-theft hardening: CSP + vendored CDN deps (NEW; parallel after PR-1)

**Scope:**
- **H3**: append the CSP line to the `NGINX_SECURITY_HEADERS` fragment in PR-1's param block (one variable edit — automatically emitted at http level AND restated in any location with its own `add_header`, including PR-6's cached render location):

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'" always;
```

  `connect-src 'self' https:` is the deliberate, documented choice: it preserves bring-any-HTTPS-endpoint BYOK while blocking non-HTTPS exfiltration. The stricter provider allowlist (`EXTRA_AI_ORIGINS`-style) is the Phase-2 follow-up.
- **H4**: vendor CodeMirror + pako ESM bundles (pinned versions from `package.json` `cdn-dependencies`) into `demoSite/js/vendor/`, rewrite the importmap (`index.html:14-46`) to same-origin paths, remove esm.sh entirely — which is what allows `script-src 'self'` (no esm.sh exception, no SRI workarounds).
- Update PR-1's golden-config CI expectation (the CSP line is a reviewed, deliberate default-output delta — release-note item).

**Acceptance:**
- `curl -ksI https://localhost:8443/` shows the CSP header alongside the three legacy headers.
- A cached render URL (once PR-6 lands; re-checked in PR-8 staging) shows CSP + the other headers + `X-Cache-Status` (the fragment restatement at work).
- `grep esm.sh demoSite/index.html` → empty; the app loads with **zero third-party script requests** (DevTools network check).
- Editor (CodeMirror), compression/URL-sharing (pako), and all bun tests fully functional on the vendored bundles; vendored files byte-match the pinned versions in `package.json` `cdn-dependencies`.
- Importmap-under-CSP verified in a real browser (the inline `<script type="importmap">` is allowed under `script-src` by spec since it carries no executable JS — hash it if any browser blocks it, per the audit note).
**Parallelism:** parallel-ok after PR-1 (touches only the fragment variable + index.html/vendor; trivial rebase against PR-6/7). **This PR partially closes integration.md's "modern security headers" gap** — Referrer-Policy/Permissions-Policy remain Phase 2.

### PR-5 — Compose footprint: profiles + resource limits (parallel after PR-1)

**Scope (`docker-compose.yml`, `setup-kroki-server.sh` param block, `.env.example`, demoSite):**
- `profiles: ["companions", "<name>"]` on bpmn/excalidraw/diagramsnet; core/mermaid/demosite/nginx stay profile-less (always on). `COMPOSE_PROFILES=companions` in `.env.example`; script default `${COMPOSE_PROFILES-companions}` already landed in PR-1's param block (legacy `.env`s keep the full set; the public box sets it empty). **The default services must never carry a profile** — the docs spec's `COMPOSE_PROFILES=full` shape was a verified preserved-`.env` upgrade trap that drops all services.
- `deploy.resources.limits` with `${VAR:-0}` on all 6 services (verified: compose ≥2.24 honors them without swarm; `0` = unlimited = today's behavior). Commented 4 GB-box values in `.env.example` (core 1536M/1.5, mermaid 1024M/1.0, demosite 256M/0.5, nginx 128M/0.5, companions 768M/0.75 each).
- **Gap fix (one block per service):** json-file log rotation — bounds log growth on the 40 GB demo box (gunicorn logs every request; nothing bounds json-file today). Per-service pattern (bpmn shown; companions get profiles, all six get limits + logging):

```yaml
  bpmn:
    image: yuzutech/kroki-bpmn:0.30.1
    restart: unless-stopped
    profiles: ["companions", "bpmn"]
    deploy:
      resources:
        limits:
          cpus: "${BPMN_CPU_LIMIT:-0}"
          memory: "${BPMN_MEM_LIMIT:-0}"
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }
```
- `DISABLED_DIAGRAM_TYPES` plumbing: parse in server.py, expose as `kroki.disabledDiagramTypes` in `/api/config` (`:608-625`; coordinate the additive edit with PR-3); `applyDisabledDiagramTypes()` dropdown pruning in `diagramOperations.js` + main.js hook; **critique fix:** the friendly-503 rewrite centralized in the error path (`api.js:67-81` / error.status===503), not just `diagramRenderer.js`'s GET branch — POST renders (alwaysUsePost / URLs >4096 chars) leak the raw "Connection refused: /127.0.0.1:8002" otherwise.
- README sizing table (trimmed set saves ~4.7 GB images / ~0.5-1 GB idle RAM; measured figures from the spec).

**Acceptance:** `COMPOSE_PROFILES= docker compose config --services` = exactly {core, mermaid, demosite, nginx}; legacy `.env` (var removed) still boots all 6 via the script; teardown leaves no zombies after a full→trimmed switch (requires PR-1's `--profile '*'`); limits inert by default (`HostConfig.Memory=0`), applied when set; disabled-type render 503s fast with the friendly message; `docker inspect` shows the log-rotation options; pytest/bun green.
**Parallelism:** parallel with PR-2/3/4; depends on PR-1 (down flags, v2 floor).

### PR-6 — Render cache + safe-mode pin + abuse limits (serialized: before PR-7)

**Scope:**
- `docker-compose.yml` core: `KROKI_SAFE_MODE=${KROKI_SAFE_MODE:-secure}` + `KROKI_BODY_LIMIT=${KROKI_BODY_LIMIT:-10485760}` (core has NO body limit today — Vert.x default -1). The pin is a verified no-op confirmation: the pinned image (commit 1d20d1d, digest a4a3c55f9463) already defaults to secure — confirmed in source (`Plantuml.java:120`) and by empirical include/SSRF probes; the explicit pin guards future rebuilds. `KROKI_BLOCK_LOCAL_FILE_ACCESS` does not exist in Kroki — never set it. nginx service: `nginx_cache` named volume + top-level `volumes:` block.
- `setup-kroki-server.sh` heredoc via PR-1's param block — http-level fragments (note the `\$` escapes: nginx runtime variables must reach the file literally through the unquoted heredoc):

```nginx
# http level (after client_max_body_size):
proxy_cache_path /var/cache/nginx/kroki levels=1:2 keys_zone=kroki_render:10m
                 max_size=${RENDER_CACHE_MAX_SIZE} inactive=${RENDER_CACHE_INACTIVE} use_temp_path=off;
limit_req_zone  \$binary_remote_addr zone=render_req:10m rate=${RENDER_RATE};
limit_conn_zone \$binary_remote_addr zone=render_conn:10m;
limit_req_status 429;  limit_conn_status 429;  limit_req_log_level warn;
```

```nginx
# cached GET render location (/<type>/<format>/<encoded>); POST location gets
# limits + timeouts only, never proxy_cache. limit_req/limit_conn lines are
# emitted ONLY under DEPLOY_PROFILE=public.
limit_req zone=render_req burst=${RENDER_BURST} nodelay;
limit_conn render_conn ${RENDER_CONN_LIMIT};
client_max_body_size ${RENDER_BODY_LIMIT};
proxy_connect_timeout 10;  proxy_send_timeout ${RENDER_TIMEOUT};  proxy_read_timeout ${RENDER_TIMEOUT};
proxy_cache kroki_render;
proxy_cache_key "\$request_method\$request_uri";   # nginx always caches HEAD; keep it off the GET key
proxy_ignore_headers Cache-Control Expires;        # deterministic, env-tunable TTLs (Kroki sends max-age=432000)
proxy_cache_valid 200 ${RENDER_CACHE_TTL};
proxy_cache_valid 400 404 1m;                      # absorbs bad-input hammering; fixed inputs get new URLs
proxy_cache_lock on;
proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
${NGINX_SECURITY_HEADERS}                          # MUST be restated: add_header here cancels http-level headers
add_header X-Cache-Status \$upstream_cache_status always;
```

- **Critique fix = plan of record (the closed-network invariant):** `DEPLOY_PROFILE=private` (default) emits the zones but **omits** the per-location `limit_req`/`limit_conn` directives and keeps 300s connect/send/read timeouts — truly behavior-preserving. Strict values (`10r/s` burst 30, conn 20, 1m body, 30s timeouts, 10s connect) apply only under `DEPLOY_PROFILE=public`. The always-on cache is the one reviewed default delta (release-note item).
- `.env.example` render-plane block (DEPLOY_PROFILE, KROKI_SAFE_MODE, KROKI_BODY_LIMIT, RENDER_CACHE_*, RENDER_* — with a comment that the commented values shown are the PUBLIC ones).

**Acceptance:**
- `genconfig` diff private-vs-public shows only the limit directives + timeout values; private default contains **no** `limit_req`/`limit_conn` in render locations and keeps `proxy_read_timeout 300` (the invariant check).
- `docker compose exec core env | grep KROKI_SAFE_MODE` → `secure`; safe-mode probes: `!include /etc/passwd` and `!includeurl http://169.254.169.254/...` render clean (stripped, no error), `!include <C4/C4_Context>` stdlib still works — this is the canonical re-verification after any core image rebuild.
- Cache: first GET of an encoded render → `X-Cache-Status: MISS` **plus all security headers** (incl. CSP after PR-4); second → `HIT`. POST renders and `/api/` responses carry no `X-Cache-Status`.
- **Concurrent** rate-limit probe under public profile (`seq 1 60 | xargs -P 20 -I{} curl…` — sequential curls pay TLS handshake per call and stay under 10r/s, critique-verified) → 200/429 mix; 2 MB POST → 413.
- `RENDER_CACHE_ENABLED=false` regeneration: `! grep -q proxy_cache_path nginx.conf` (not `grep -c`, which exits 1 at count 0 under `set -e`).
- `clean` removes the `nginx_cache` named volume (PR-1's `down -v` — `docker volume prune` does not, verified Docker ≥23); pytest/bun/CI smoke green (CI runs the private profile, untouched).

**Parallelism:** can start once PR-1 merges; **strictly before PR-7** (owns the heredoc restructure).

### PR-7 — TLS/ACME (serialized: rebases on PR-6)

**Scope:**
- `TLS_MODE` branch in start/restart (selfsigned path byte-identical; `generate_certs` untouched); `validate_acme_config` (public DNS name check, `ACME_EMAIL` required, **literal `^HOSTNAME=` grep in `.env`** — the bash builtin HOSTNAME otherwise leaks a dotted machine FQDN past validation); `ensure_acme_cert` (certbot standalone first issuance, `--key-type ecdsa` — the generated cipher list is ECDSA-only, an RSA cert would fail every handshake; `ACME_STAGING=1` support).
- `docker-compose.acme.yml` overlay (committed; applied via PR-1's `DOCKER_COMPOSE` assembly). Compose-v2 merge semantics verified: ports/volumes append, `command` replaces. Essentials:

```yaml
services:
  nginx:
    ports:
      - "${ACME_HTTP_PORT:-80}:8080"          # base keeps ${HTTPS_PORT:-8443}:8443 → 443:8443 on the demo
    volumes:
      - ./letsencrypt:/etc/letsencrypt:ro
      - ./certbot-webroot:/var/www/certbot:ro
    # Graceful 6h reload picks up renewed certs (certbot renews ~30 days early).
    # NOTE: this command form skips the image's docker-entrypoint.d scripts.
    command: /bin/sh -c "(while :; do sleep 6h; nginx -s reload; done) & exec nginx -g 'daemon off;'"
  certbot:
    image: certbot/certbot:<pin current release tag>
    restart: unless-stopped
    volumes:
      - ./letsencrypt:/etc/letsencrypt
      - ./certbot-webroot:/var/www/certbot
    entrypoint: /bin/sh -c "trap exit TERM; while :; do certbot renew --webroot -w /var/www/certbot --quiet; sleep 12h & wait $$!; done"
    networks: [kroki_network]
```

- Generator: `ssl_cert`/`ssl_key` parameterization (`:192-193` → `/etc/letsencrypt/live/${HOSTNAME}/{fullchain,privkey}.pem` in acme mode), `${acme_http_server}` block emitted before the 8443 server (`:8080` listener: `location /.well-known/acme-challenge/ { root /var/www/certbot; }` + `return 301 https://\$host\$request_uri;` for everything else), **HSTS folded into `NGINX_SECURITY_HEADERS`** when `TLS_MODE=acme` — this fixes the critique's major header-loss bug at server level AND in PR-6's cached location in one move. **HSTS `max-age=86400` initially** (sign-off #6), raised post-launch.
- `clean` preserves `./letsencrypt` (LE duplicate-cert quota: 5/week) + prints the notice; `.gitignore` entries; `scripts/check-cert-expiry.sh` (parses HOSTNAME from `.env` via grep — never the bash builtin; **root crontab required**, letsencrypt dirs are 0700; POSTs to `CERT_ALERT_WEBHOOK` = ntfy topic, ntfy body format).
- **Critique fix:** hairpin-NAT fallback in `check_services` — in acme mode, fall back to `curl -k --resolve` against localhost so `start` doesn't abort on providers where the box can't reach its own public IP.
- Docs: 4-line `.env` diff, DNS/CAA/port checklist, **staging-first procedure** (ACME_STAGING=1 → verify → `rm -rf letsencrypt` → unset → restart), rate-limit warnings, acme→selfsigned rollback note (HSTS implication), "never `git clean -x` on the prod checkout".

**Acceptance:**
- Selfsigned regression with a stock `.env`: self-signed cert generated exactly as before, no port 80 published, no certbot service, generated config contains no `acme-challenge`/`letsencrypt`/`Strict-Transport-Security` strings, `curl -ks https://localhost:8443/` → 200.
- `docker compose config` overlay-merge check: nginx publishes both 443→8443 and 80→8080, all four bind volumes present, command replaced by the reload loop, certbot joins `kroki_network`.
- `genconfig` acme output contains the :8080 listener, the challenge location, the 301 redirect, the letsencrypt cert paths, and HSTS; passes `nginx -t` in `nginx:1.28-alpine` against a dummy ECDSA cert (no real DNS needed — this is what `genconfig` exists for).
- Validation guards: `HOSTNAME=localhost`, missing `ACME_EMAIL`, and missing literal `^HOSTNAME=` line in `.env` each exit non-zero with a clear error; `HTTPS_PORT!=443` warns but proceeds.
- Staging end-to-end on a throwaway box with real DNS: staging cert issued (issuer contains STAGING), `http://` → `301 https://`, `certbot renew --dry-run` succeeds through the :8080 webroot listener.
- `curl -ksI https://<domain>/` in acme mode shows **all** security headers + HSTS — the cross-product check that motivated the shared fragment; repeat on a cached render URL.
- `clean` preserves `./letsencrypt` and prints the notice; `check-cert-expiry.sh` exits 0 on the valid cert, exits 1 + syslogs + POSTs to a local listener on a `-days 5` dummy.

**Parallelism:** strictly after PR-6 (same heredoc); its param-block locals and overlay are orthogonal to PR-6's location bodies after rebase.

### PR-8 — Integration staging + hosting runbook/cloud-init

**Scope:**
- **Throwaway ARM VPS (CAX11) dry-run with the FULL §6 launch bundle** (`ACME_STAGING=1`) — the only place acme + public profile + trimmed companions + free-mode relay + gunicorn run together. The verification list:
  - all security headers + CSP + HSTS + `X-Cache-Status` present on a cached render response (the cross-product bug class that no single-workstream test catches);
  - render 429s under the public profile (concurrent probe) and 413 on oversized POST;
  - **AI relay serves a `:free` model end-to-end through the operator key**;
  - per-IP cap trip → `per_ip_quota` UI state with the §3.5 copy;
  - forced upstream 429 → `free_quota_exhausted` UI state with the settings button pre-filled;
  - BYOK flow with a real, fresh free OpenRouter key — including hitting the privacy-toggle gotcha and confirming the copy's step 2 resolves it; DevTools confirms the key never reaches the demo origin;
  - trimmed-type friendly 503s + dropdown pruning (`DISABLED_DIAGRAM_TYPES`);
  - `certbot renew --dry-run` through the running stack; teardown leaves no zombie companions; `docker stats` trimmed idle < 1 GB; gunicorn worker count and access-log format in `logs`.
- `docs/public-demo-hosting-runbook.md` rewritten per integration resolutions: TLS section = the 4-line `.env` diff (host-certbot procedure, renewal-hook script, and certbot in the package list are **deleted** — tls-acme is canonical and host-standalone renewals would fail on the :80 bind); AI section = the free-mode bundle + OpenRouter provisioning (below), replacing `AI_ENABLED=false`; `COMPOSE_PROFILES=` empty (no compose-file commenting); `SESSION_SECRET` optional with "run `openssl rand -hex 32` once and paste the literal output" (the `$(...)`-in-env_file bug); scripts-based cron (no inline cron commands — the `%`-expansion bug); `adduser --disabled-password`, sshd drop-in (`/etc/ssh/sshd_config.d/99-doccode.conf` — Ubuntu 24.04 include precedence), cloud-init docker-group ordering fix; `.env`↔`.env.example` reconciliation step in upgrades + `/api/version` shows new VERSION as upgrade acceptance; GHCR-public note; digest-pin procedure (sign-off #7); **abuse-response subsection** (read 429/abuse patterns from nginx logs, ban an IP via Hetzner Cloud Firewall, published abuse contact = the demo's ops email).
- `docs/cloud-init-demo.yaml` (provisioning section as cloud-init, with the critique fixes).
- `scripts/doccode-ops.sh` (disk >85%, unhealthy containers, weekly image prune; logic in the script, `/etc/cron.d` only invokes it; alerts → ntfy).

**Acceptance:** dry-run checklist above all green on the throwaway box; runbook bash blocks shellcheck-clean; cloud-init YAML parses; `sshd -T` confirms password auth off; ops cron fires a test ntfy alert.
**Parallelism:** needs PRs 1-7 merged (drafting can start earlier).

### PR-9 — Docs + packaging + release v2.8.0 (merges last)

**Scope:**
- README restructure (DocCode-first H1/intro, "Try it: <DEMO_DOMAIN>", deployment-modes callout, **Production / Public Deployment** section linking `docs/production-deployment.md`, AI cost warning in the assistant section, stale VERSION example fixed, Contributing pointer with the real test commands).
- `docs/production-deployment.md` written against the **final shipped var names** from PRs 2-7 (the §5 contract — not the draft names from the docs spec); includes the threat model, quick recipe (= §6 bundle), TLS/safe-mode/cache/profiles/sizing/AI-posture sections, the full var reference table, and the SESSION_SECRET truth: **optional for single-container deployments of any worker count** (preload shares the per-boot secret — verified); set it only for multi-container/replica setups or to persist sessions across restarts.
- SECURITY.md rewrite (PVR primary, fixed mailto, real current posture incl. the BYOK guarantee pointer, deployment-security paragraph; the version table lands in the same final commit as the VERSION bump). CONTRIBUTING.md refresh (**`pip install -r requirements-dev.txt`** — `tests/requirements.txt` does not exist; real bun/pytest commands; generator/VERSION/env-parsing house rules incl. §5's empty-string convention).
- `docs/releases/` convention: move the two stray root release-notes files; write `docs/releases/v2.8.0.md` — KROKI_SAFE_MODE described as "now explicitly pinned (was already the default)", NOT breaking; call out: always-on render cache, CSP header, key-less→byok change, gpt-4o-mini default, esm.sh→vendored, dropped-PUBLIC_MODE-never-shipped note for anyone tracking the planning docs.
- Final commit (only here): `.env.example` `VERSION=2.8.0` / `BUILD_DATE`.

**Pre-tag checklist (procedural gate — release.yml runs zero tests and pushes `latest` on any `v*.*.*` tag):**
1. All workstream PRs merged; CI green on main (`gh run list --branch main --limit 1`).
2. Placeholder grep: `! grep -r 'DEMO_DOMAIN\|SECURITY-CONTACT' README.md SECURITY.md docs/`.
3. Release-gate cross-check: **every env var documented in production-deployment.md/.env.example grep-hits in docker-compose.yml, setup-kroki-server.sh, or server.py** (no vapor vars).
4. Both test suites pass locally (`pip install -r requirements-dev.txt && python -m pytest tests/test_server.py -q`; `bun test tests/`).
5. `docs/releases/v2.8.0.md` finalized; tag; paste curated notes above the auto-generated commit list.
6. Deploy prod (`/opt/kroki-server`: git pull, restart, `.env` reconciliation) and the demo box; `/api/version` shows 2.8.0 on both.

**Acceptance:** docs-vs-env var loop produces no MISSING output; SECURITY.md has no `1.x.x` claim and names PVR; CONTRIBUTING has the real commands and no `test` subcommand reference; stray root release-notes files relocated.
**Parallelism:** drafting parallel with PR-8; merges last.

---

## 5. Shared components & env-var contract

### Canonical env contract

Implementing workstreams define names; docs consume them. `PUBLIC_MODE` is **removed from the contract** (dropped by directive). House style: `VAR=""` empty strings are common — all parsers must tolerate them (below).

| Variable | Default | Introduced in | Effect |
|---|---|---|---|
| `TLS_MODE` | `selfsigned` | PR-7 | `selfsigned` \| `acme` |
| `HOSTNAME` | `localhost` | existing | **The only domain variable**: ACME domain, nginx server_name, self-signed CN, Origin allowlist (`server.py:59-66` portless `https://{HOSTNAME}` makes `HTTPS_PORT=443` zero-app-change). No `DOMAIN` var anywhere. acme validation and check-cert-expiry **must grep the literal `^HOSTNAME=` line in `.env`** — bash always sets the builtin |
| `ACME_EMAIL` / `ACME_STAGING` / `ACME_HTTP_PORT` | "" / "" / 80 | PR-7 | LE contact / staging CA toggle / challenge port |
| `CERT_ALERT_WEBHOOK` | "" | PR-7 | ntfy.sh topic URL for cert + ops alerts |
| `DEPLOY_PROFILE` | `private` | PR-6 | `private` = behavior-preserving (zones only, 300s timeouts); `public` = strict render limits |
| `RENDER_CACHE_ENABLED` / `RENDER_CACHE_MAX_SIZE` / `RENDER_CACHE_TTL` / `RENDER_CACHE_INACTIVE` | true / 500m / 24h / 7d | PR-6 | nginx render cache (GET render routes only) |
| `RENDER_RATE` / `RENDER_BURST` / `RENDER_CONN_LIMIT` / `RENDER_BODY_LIMIT` / `RENDER_TIMEOUT` | profile-derived | PR-6 | per-IP render limits (public: 10r/s / 30 / 20 / 1m / 30) |
| `COMPOSE_PROFILES` | `companions` (script-defaulted `${COMPOSE_PROFILES-companions}` — unset→full set, **explicitly empty→trimmed**) | PR-5 | which optional renderers run |
| `{CORE,MERMAID,DEMOSITE,NGINX,BPMN,EXCALIDRAW,DIAGRAMSNET}_{MEM,CPU}_LIMIT` | 0 (unlimited) | PR-5 | compose resource ceilings |
| `DISABLED_DIAGRAM_TYPES` | "" | PR-5 | hides types from the editor dropdown via `/api/config` |
| `KROKI_SAFE_MODE` / `KROKI_BODY_LIMIT` | secure / 10485760 (compose-level defaults; commented in .env.example) | PR-6 | render-plane safety pins |
| `KROKI_CORE_IMAGE` | `ghcr.io/vppillai/kroki-core:goat` | existing | digest-pinned on the demo box (sign-off #7) |
| `GUNICORN_WORKERS/THREADS/TIMEOUT/GRACEFUL_TIMEOUT/KEEPALIVE/LOG_LEVEL` | 2/8/30/30/5/info | PR-2 | app-server tuning |
| `SESSION_SECRET` | unset (per-boot) | existing | **optional** for single-container any-worker-count (preload); required only multi-container |
| `AI_ENABLED` | true | existing | false → mode `off` (assistant hidden) |
| `AI_PROXY_URL` / `AI_PROXY_API_KEY` | existing | existing | relay target + operator key; empty key → mode `byok` |
| `AI_MODEL` | `openai/gpt-4o-mini` (changed from gpt-4o; sign-off #12) | PR-3 | default relay model |
| `AI_MODEL_FALLBACKS` | "" | PR-3 | ordered startup fallbacks when AI_MODEL is filtered/absent |
| `AI_MODEL_ALLOWLIST` | "" (= allow all, current behavior) | PR-3 | comma-separated **globs** filtering the live model list (`"*:free"` on the demo) |
| `AI_DAILY_LIMIT_PER_IP` | "" (= no extra limit) | PR-3 | flask-limiter string, e.g. `"10/minute;30/day"`; per-worker in-memory until Redis (Phase 2) |
| `AI_ACCESS_TOKEN` | "" | existing | optional bearer gate on the relay (unused on the demo) |
| `VERSION` / `BUILD_DATE` | 2.7.0 → 2.8.0 | PR-9 only | bumped exactly once, in the final release commit |

### Shared mechanics (built once, consumed everywhere)

- **`NGINX_SECURITY_HEADERS` fragment** (PR-1; extended PR-4/PR-7): one shell variable computed in the param block — `X-Content-Type-Options nosniff`, `X-XSS-Protection "1; mode=block"`, `X-Frame-Options SAMEORIGIN`, + CSP (PR-4, always), + `Strict-Transport-Security max-age=86400` (PR-7, acme only). Emitted once at http level **and restated verbatim inside every location that uses `add_header`** (nginx cancels http-level add_header inheritance the moment a location declares its own — currently only the cached render location, which appends `X-Cache-Status`). Heredoc rule, documented in-file: *never add a bare `add_header` in a location — restate `${NGINX_SECURITY_HEADERS}`.*
- **Compose lifecycle & version baseline** (PR-1): prefer `docker compose` v2, enforce ≥ 2.24.0; `DOCKER_COMPOSE` always carries its `-f` list; `stop/restart` = `--profile '*' down --remove-orphans`; `clean` = `--profile '*' down --rmi all -v --remove-orphans` + preserve `./letsencrypt` and `.env`.
- **Single param block** (PR-1): after the entire `.env` if/else (after `setup-kroki-server.sh:41`), fixed ordering — all nginx-adjacent PRs write here instead of inventing insertion points.
- **`genconfig` subcommand** (PR-1): config-only entry point used by PR-6/PR-7 acceptance and the CI golden-config + `nginx -t` job ({default, public, acme+public}).
- **AI posture channel** (PR-3): `compute_ai_mode` → `AI_MODE` → `ai.mode` in `/api/config` is the single source of truth; all consumers (frontend, health, version, docs, runbook) read it; no other workstream invents an AI flag. `/api/config` also carries `kroki.disabledDiagramTypes` (PR-5) — one coordinated `get_config` merge, one conftest hygiene change.
- **Empty-string-tolerant env parsing**: Python helper `env(name, default)` = `os.environ.get(name) or default` (gunicorn.conf.py ints, AI/DISABLED list parsing); shell `${VAR:-default}` colon-form everywhere **except** the deliberate `${COMPOSE_PROFILES-companions}` (empty-vs-unset is semantic there). One sentence in CONTRIBUTING.md codifies it.
- **scripts/ + ops cron + CI lint**: `scripts/check-cert-expiry.sh` (root crontab) and `scripts/doccode-ops.sh` (invoked from `/etc/cron.d`, logic in the script — kills cron `%` pitfalls); both alert via ntfy; ci.yml shellcheck covers `setup-kroki-server.sh` + `scripts/*.sh`.
- **Release mechanics**: `VERSION`/`BUILD_DATE` bumped exactly once in PR-9's final commit; pre-tag placeholder grep; documented-var release gate; runbook upgrade section includes the `.env`↔`.env.example` reconciliation + `/api/version` acceptance.

---

## 6. Public demo launch contract

### The exact `.env` bundle

This file is what the PR-8 staging dry-run runs and what the runbook ships. Each flag is independent and documented as such — **there is no single "public" switch**.

```bash
# --- identity / TLS ---
HOSTNAME=<DEMO_DOMAIN>
HTTPS_PORT=443
TLS_MODE=acme
ACME_EMAIL=<ops email>
# ACME_STAGING=1                # set for the first staging run; remove + delete ./letsencrypt for prod issuance

# --- footprint ---
COMPOSE_PROFILES=               # empty = trimmed: core + mermaid + demosite + nginx
DISABLED_DIAGRAM_TYPES=bpmn,excalidraw,diagramsnet
DEPLOY_PROFILE=public           # strict render limits: 10r/s burst 30, conn 20, 1m body, 30s timeouts
CORE_MEM_LIMIT=1536M
CORE_CPU_LIMIT=1.5
MERMAID_MEM_LIMIT=1024M
MERMAID_CPU_LIMIT=1.0
DEMOSITE_MEM_LIMIT=256M
DEMOSITE_CPU_LIMIT=0.5
NGINX_MEM_LIMIT=128M
NGINX_CPU_LIMIT=0.5

# --- render plane (defaults are fine; explicit for the record) ---
# RENDER_CACHE_ENABLED=true  RENDER_CACHE_MAX_SIZE=500m  RENDER_CACHE_TTL=24h
# KROKI_SAFE_MODE=secure (compose-enforced default)

# --- AI: OpenRouter free-mode hybrid ---
AI_ENABLED=true
AI_PROXY_URL=https://openrouter.ai/api/v1
AI_PROXY_API_KEY=<operator OpenRouter key>
AI_MODEL_ALLOWLIST="*:free"
AI_MODEL=qwen/qwen3-coder:free
AI_MODEL_FALLBACKS="meta-llama/llama-3.3-70b-instruct:free,openai/gpt-oss-120b:free"
AI_DAILY_LIMIT_PER_IP="10/minute;30/day"

# --- ops ---
CERT_ALERT_WEBHOOK=https://ntfy.sh/<private-topic>
KROKI_CORE_IMAGE=ghcr.io/vppillai/kroki-core@sha256:<pinned digest>   # sign-off #7
# GUNICORN_WORKERS=2 GUNICORN_THREADS=8 — defaults, no override needed
# SESSION_SECRET — optional (single container, preload); set a pasted literal only to persist sessions across restarts
```

### Provisioning checklist

1. **Domain + DNS** (sign-off #1): register; A record → box IPv4 (AAAA only if it also points at the box — LE prefers IPv6); optional CAA `0 issue "letsencrypt.org"`. DNS must propagate **before** first `start` (check_services curls the domain).
2. **Hetzner CAX11**, Ubuntu 24.04, **Cloud Firewall** (authoritative — Docker bypasses ufw via iptables) allowing 22 (operator IPs)/80/443/ICMP; auto-backups on. Provision via `docs/cloud-init-demo.yaml` (deploy user, sshd drop-in, docker, 2 GB swap, clone to `/opt/kroki-server`).
3. **OpenRouter account (operator)**: create account; **buy the one-time $10 credit** (sign-off #2 — unlocks 1000 `:free` req/day, prevents 402s); in Settings → Privacy enable free endpoints ("training/logging" — `:free` models 404 without it); create the API key; never create additional accounts (ToS red line).
4. **`.env`**: the bundle above; pin `KROKI_CORE_IMAGE` to the current verified digest.
5. **TLS staging-first**: `ACME_STAGING=1` → `./setup-kroki-server.sh start` → verify → `rm -rf letsencrypt` → unset → `restart`.
6. **Cron**: root crontab `0 9 * * * /opt/kroki-server/scripts/check-cert-expiry.sh`; `/etc/cron.d/doccode-ops` invoking `scripts/doccode-ops.sh` hourly + weekly image prune.
7. **Monitoring**: UptimeRobot free monitor on `https://<DEMO_DOMAIN>/api/health` (keyword "healthy" — verify keyword monitors are still free-tier; else plain HTTP, see §7); ntfy app on the operator's phone subscribed to the topic.
8. **Deploys**: `cd /opt/kroki-server && git pull --ff-only && docker compose pull core nginx && ./setup-kroki-server.sh restart` + the `.env` reconciliation step. No watchtower (demosite is locally built; nginx.conf is generated). Core digest bumps are deliberate `.env` edits.

### Cost table (June 2026, excl. VAT)

| Item | Monthly |
|---|---|
| Hetzner CAX11 (2 vCPU ARM / 4 GB / 40 GB / 20 TB) | EUR 4.49 |
| IPv4 add-on | ~EUR 0.50 (verify at order) |
| Auto-backups (+20%) | EUR 0.90 |
| Domain (.com at-cost, amortized) | ~EUR 0.92 |
| AI (OpenRouter `:free` via operator key) | EUR 0 (one-time $10 credit) |
| Monitoring (UptimeRobot free + ntfy.sh) | EUR 0 |
| **Total** | **~EUR 6.80/mo (~$8)** + one-time $10 |

### Monitoring set

- UptimeRobot: `/api/health` up/down (5-min).
- `scripts/check-cert-expiry.sh` (daily, root): alert at <21 days remaining (certbot renews at <30 — firing means renewal failed for ~9 days) → ntfy.
- `scripts/doccode-ops.sh` (hourly): disk >85%, unhealthy containers → ntfy; weekly `docker image prune` (per-restart demosite builds accumulate).
- AI pool health (operator habit, not automated in Phase 1): `docker compose logs demosite | grep free_quota_exhausted` count per day, and nginx 429 rate — inputs for tuning `AI_DAILY_LIMIT_PER_IP` and the render limits.

---

## 7. Gaps accepted into the plan vs deferred

From integration.md's gap list, disposition:

**Now covered by this plan:**
- *No combined-configuration test* → PR-8's full-bundle staging dry-run + PR-1's CI genconfig golden-config + `nginx -t` job for {default, public, acme+public}.
- *No modern security headers / CSP* → **PR-4** ships CSP via the `NGINX_SECURITY_HEADERS` fragment (partially closes the gap; Referrer-Policy/Permissions-Policy deferred).
- *Supply-chain pinning undecided* → sign-off #7 (digest pin) + PR-8 bump procedure; additionally PR-4 removes the esm.sh runtime supply chain entirely.
- *Rollback gaps* → gunicorn rollback documented (PR-2); acme→selfsigned rollback risk capped by HSTS max-age 86400 (sign-off #6) + runbook note (PR-7).
- *Prod-box preconditions* → PR-1 precondition (ssh compose-version check + prod `.env` upgrade note).

**One-line Phase-1 additions (folded into PRs):**
- Docker log rotation: `logging: {max-size: 10m, max-file: 3}` on all services — **PR-5** (compose).
- Abuse-response path: runbook subsection (log patterns → Hetzner firewall ban → abuse contact) — **PR-8**.
- `/api/ai-prompts` must stay un-gated in byok mode (BYOK prompt composition depends on it) — explicit statement + regression test in **PR-3**.

**Explicitly deferred to Phase 2 (owners needed):**
- **GDPR / imprint / privacy posture**: an EU-hosted public service logging client IPs with user-submitted content (and now relaying AI prompts through OpenRouter `:free` endpoints, which may train/log per the privacy toggle) needs a privacy note, data-retention statement, no-SLA disclaimer, and an AI data-flow disclosure. Unowned; must be assigned before any marketing push. The AI-relay data-flow point is *stronger* now than under the old BYOK-only ruling — relayed prompts reach third-party free providers.
- **fail2ban** jail on nginx 429/403 patterns (Phase 1 ships the manual runbook procedure only).
- **Uptime-alert mechanism verification**: UptimeRobot keyword-monitor free-tier status unconfirmed (SSL-expiry alerting is confirmed paid and already replaced by the cert script); accept a plain HTTP monitor if keyword is paywalled, or move to a confirmed-free alternative.
- **Strict CSP connect-src provider allowlist** (`EXTRA_AI_ORIGINS`-style env-extendable list) — `'self' https:` is the deliberate Phase-1 default.
- **nginx-level limits for non-render `/api/` routes** (config/available-models/ai-prompts/static catch-all): low risk (cheap handlers; ai-assist has Flask limits), recorded as an explicit accepted non-decision.

---

## 8. Phase 2/3 outlook (from brainstorm §7, updated)

- **Redis-backed flask-limiter + session store** — makes the 10/min and `AI_DAILY_LIMIT_PER_IP` caps global across workers and restart-proof; precondition for any replica story. Highest-priority Phase-2 item now that the relay is ON publicly.
- **OAuth PKCE "Connect OpenRouter"** — the flagged UX upgrade: one-click user-key issuance (`/api/v1/auth/keys`) replaces key-pasting; each user gets their own 50/day with zero copy-paste. Verified to exist; design against H3's CSP.
- **Server-side aggregate spend/usage caps + alarms** — daily relay budget with 503-into-BYOK past the ceiling; pairs with metrics.
- **CDN (Cloudflare) in front** — edge-cache render GETs + static; requires real-IP handling for the limit zones (`$binary_remote_addr` would throttle the CDN) and keeping origin ACME (HTTP-01 still flows, or switch to dns-cloudflare).
- **Observability** — structured logs, render latency / AI usage / 429 / error metrics, alerting (Grafana Cloud free tier); replaces the grep-based pool-health habit.
- **Packaging** — Helm chart, multi-arch demosite release image (`release.yml` `platforms:`), one-click deploy buttons (Fly/Railway classified needs-work; Render not-worth-it), content-hashed static assets to replace `expires -1`.
- **Hardening tail** — Referrer-Policy/Permissions-Policy, CSP provider allowlist, fail2ban, release.yml test-gate job, repo rename decision.

---

## 9. Appendix: planning record

Full specs, adversarial critiques, and investigation reports live in `.omc/planning-2026-06-12/` (local, untracked — not shipped in the repo). This document is the consolidated plan of record; the archive is the deep "how" reference.

| Artifact | Content |
|---|---|
| `integration.md` | Cross-workstream conflict resolutions (10), shared components, original 8-PR sequence, gap list — authoritative over individual specs except where §1's user directives override it (AI posture, PUBLIC_MODE, PR renumbering) |
| `app-server.md` | gunicorn spec (gthread/preload, empirically verified SESSION_SECRET + SSE behavior) + critique (sound; 4 minors) |
| `tls-acme.md` | TLS_MODE=acme spec (certbot standalone+webroot, overlay, expiry script) + critique (needs-revision; HSTS header-loss major → fixed via the shared fragment) |
| `render-cache-abuse.md` | KROKI_SAFE_MODE verification (source + empirical probes at the pinned digest), nginx cache + DEPLOY_PROFILE limits + critique (needs-revision; private-profile invariant major → fixed) |
| `public-mode-ai.md` | AI mode/allowlist/BYOK-UI spec + critique (sound; state-sync + ordering minors) — PUBLIC_MODE portions superseded by the user directive |
| `compose-footprint.md` | Compose profiles + resource limits + DISABLED_DIAGRAM_TYPES + critique (sound; compose ≥2.24 floor major → PR-1) |
| `hosting-cost.md` | Hetzner CAX11 runbook/cost/monitoring + critique (needs-revision; cron-%, UptimeRobot-SSL, SESSION_SECRET-literal, VERSION-drift majors → all fixed in PR-8's rewrite) |
| `docs-packaging.md` | README/SECURITY/CONTRIBUTING/release packaging + critique (needs-revision; v3.0.0 rationale refuted → v2.8.0; COMPOSE_PROFILES=full trap → profiles contract fixed) |
| `byok-audit-report.md` | BYOK key-lifecycle audit: verdict (MEDIUM), H1-H7 hardening spec, 10-test regression plan — adopted wholesale into PR-3/PR-4 |
| `openrouter-free-report.md` | OpenRouter free-tier research (verified limits/pooling/churn/ToS) + Option-C hybrid recommendation — adopted as the demo AI posture per user directive |
| `docs/scale-cost-brainstorm-2026-06-12.md` | Predecessor brainstorm (committed): planes model, cost tiers, levers, phased roadmap — §7 Phase 1 superseded by §4 of this plan |

Provenance: 7 workstream specs each produced by a design agent and challenged by an independent adversarial critique with in-repo verification; integration review re-verified disputed claims against the repo (`server.py:71` ProxyFix, `ci.yml:20-23` shellcheck scope, `setup-kroki-server.sh:52-63` compose preference, `:448-498` lifecycle inconsistencies); the two targeted investigations (BYOK audit, OpenRouter research) ran with live external verification on 2026-06-12.
