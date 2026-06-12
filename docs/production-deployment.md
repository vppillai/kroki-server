# Production / Public Deployment Guide

This guide is for self-hosters putting DocCode on the public internet. The default
`./setup-kroki-server.sh start` is safe for closed networks but is not hardened for
public exposure. Read this guide before opening port 443 to the world.

---

## Threat model in one minute

**AI relay spend.** When `AI_PROXY_API_KEY` is set and `AI_ENABLED=true`, every
`/api/ai-assist` call charges the operator's key. The default closed-network
configuration leaves this wide open intentionally (trusted users only). On a public
host, an anonymous visitor can exhaust your monthly AI budget in minutes. Mitigate
with `AI_MODEL_ALLOWLIST="*:free"` (free-tier models only), `AI_DAILY_LIMIT_PER_IP`
(per-IP cap — note: in-memory per worker, see §7), `AI_ACCESS_TOKEN` (shared bearer
token gates the relay), or leave `AI_PROXY_API_KEY` empty to run in BYOK mode
(zero relay cost; users bring their own key).

**Kroki SSRF via PlantUML includes.** Without `KROKI_SAFE_MODE=secure`, PlantUML
`!include` and `!includeurl` directives can fetch arbitrary URLs from the render
container — including cloud metadata endpoints (`http://169.254.169.254/`). The
core image default is `secure`; the `.env.example` comment confirms this. Never
run `KROKI_SAFE_MODE=unsafe` on an internet-facing instance.

**Render CPU/RAM DoS.** A single IP can submit arbitrarily large diagram sources
and hammer the render pipeline. The `DEPLOY_PROFILE=public` setting activates
nginx-level rate limits (10 r/s, burst 30, conn 20), a 1 MB body cap on render
routes, and 30 s proxy timeouts. The render cache absorbs repeat/burst traffic.
On a closed network these limits are deliberately relaxed to not block CI pipelines.

---

## Quick recipe (public host)

Copy this block into your `.env`, fill in the placeholders, then run
`./setup-kroki-server.sh restart`:

```bash
# --- Identity / TLS ---
HOSTNAME=your.domain.com          # public DNS name — no trailing slash
HTTPS_PORT=443
TLS_MODE=acme
ACME_EMAIL=ops@example.com        # Let's Encrypt expiry notices

# --- Render hardening ---
DEPLOY_PROFILE=public             # activates rate limits, 1m body cap, 30s timeouts
RENDER_CACHE_ENABLED=true         # absorb repeat traffic; flush on core upgrade
RENDER_CACHE_MAX_SIZE=500m
RENDER_CACHE_TTL=24h
RENDER_CACHE_INACTIVE=7d

# --- Kroki core ---
KROKI_SAFE_MODE=secure            # already the image default — now explicitly pinned
KROKI_BODY_LIMIT=1048576          # 1 MB defense-in-depth behind nginx limit

# --- Footprint (trimmed: core + mermaid + demosite + nginx) ---
COMPOSE_PROFILES=                 # empty = no companion renderers
DISABLED_DIAGRAM_TYPES=bpmn,excalidraw,diagramsnet

# --- App server ---
GUNICORN_WORKERS=2                # ≈ CPU cores
GUNICORN_THREADS=8                # concurrent SSE/AI streams per worker
SESSION_SECRET=                   # see §6 — optional for single-container deployments

# --- AI posture (choose one) ---
# Option A: relay on free-tier models only
AI_ENABLED=true
AI_PROXY_API_KEY=sk-or-v1-your-key
AI_MODEL_ALLOWLIST="*:free"
AI_MODEL=openai/gpt-4o-mini
AI_DAILY_LIMIT_PER_IP="10/minute;30/day"

# Option B: BYOK only (zero relay cost)
# AI_ENABLED=true
# AI_PROXY_API_KEY=              # empty → byok mode

# Option C: AI fully off
# AI_ENABLED=false
```

---

## TLS

See **[docs/acme-tls.md](acme-tls.md)** for the full staging-first procedure,
rate-limit guidance, and rollback instructions.

**TLS_MODE** accepts three values:

| Value | Behaviour |
|---|---|
| `selfsigned` (default) | Self-signed ECDSA cert generated in `./nginx-certs`. Browser shows a warning. Fine for closed networks. |
| `acme` | Real Let's Encrypt certificate via certbot sidecar. Requires: `HOSTNAME` set to your public DNS name, `HTTPS_PORT=443`, host ports 80 and 443 reachable from the internet, and `ACME_EMAIL` set. First run issues the cert standalone (nginx stops briefly). Renewal runs every 12 h automatically; nginx reloads new certs every 6 h. |
| `selfsigned` + `--cert`/`--key` flags | Provide your own certificate: `./setup-kroki-server.sh start --cert path/to/cert.crt --key path/to/key.key`. |

**ACME_STAGING=1** uses the Let's Encrypt staging CA (no rate limits, untrusted cert).
Always test with staging first; delete `./letsencrypt` and remove `ACME_STAGING` before
going to production.

**HSTS:** `TLS_MODE=acme` emits `Strict-Transport-Security: max-age=86400`. Raise
to `max-age=31536000` one week after a stable launch.

---

## Render plane (DEPLOY_PROFILE, RENDER_*, cache)

`DEPLOY_PROFILE` switches nginx render-route behaviour:

| Profile | Rate limit | Burst | Conn | Body | Timeout |
|---|---|---|---|---|---|
| `private` (default) | 100 r/s | 200 | 100 | 10 MB | 300 s |
| `public` | 10 r/s | 30 | 20 | 1 MB | 30 s |

Individual knobs can be overridden regardless of profile:

| Variable | Default (`public`) | Effect |
|---|---|---|
| `RENDER_RATE` | `10r/s` | nginx limit_req zone rate |
| `RENDER_BURST` | `30` | burst queue depth |
| `RENDER_CONN_LIMIT` | `20` | per-IP simultaneous connections |
| `RENDER_BODY_LIMIT` | `1m` | max diagram source on render routes |
| `RENDER_TIMEOUT` | `30` | proxy send/read timeout (seconds) |

**Render cache** (`RENDER_CACHE_ENABLED`): GET requests to `/<type>/<format>/<encoded>`
are deterministic, making them safe to cache. POST and `/api/` routes are never cached.
After a core image upgrade, cached renders serve old-renderer output for up to
`RENDER_CACHE_TTL`. **Flush procedure:**

```bash
docker compose down
docker volume rm $(docker volume ls -q | grep nginx_cache)
./setup-kroki-server.sh start
```

| Variable | Default | Effect |
|---|---|---|
| `RENDER_CACHE_ENABLED` | `true` | Enable/disable the nginx proxy cache |
| `RENDER_CACHE_MAX_SIZE` | `500m` | Maximum disk used by the cache |
| `RENDER_CACHE_TTL` | `24h` | Time a 200 response stays valid |
| `RENDER_CACHE_INACTIVE` | `7d` | Evict entries not accessed within this window |

---

## Deployment footprint (COMPOSE_PROFILES, resource limits, DISABLED_DIAGRAM_TYPES)

`COMPOSE_PROFILES` controls which optional renderer containers start alongside
`core + mermaid + demosite + nginx`:

| Value | Extra containers | Idle RAM | Image disk |
|---|---|---|---|
| `companions` (default) | bpmn + excalidraw + diagramsnet | +0.5–1 GB | +4.7 GB |
| `` (empty) | none — core + mermaid only | baseline | baseline |
| `bpmn` or `bpmn,excalidraw` | individual renderers | proportional | proportional |

Set `DISABLED_DIAGRAM_TYPES` to match what you trim — the UI will hide those types
from the dropdown:

```bash
COMPOSE_PROFILES=                                    # trimmed
DISABLED_DIAGRAM_TYPES=bpmn,excalidraw,diagramsnet   # match the above
```

**Sizing table** (recommended for a 2 vCPU / 4 GB public box):

| Service | Memory limit | CPU limit |
|---|---|---|
| core (JVM) | 1536M | 1.5 |
| mermaid (Chromium) | 1024M | 1.0 |
| demosite (gunicorn) | 256M | 0.5 |
| nginx | 128M | 0.5 |
| bpmn (Chromium, companions only) | 768M | 0.75 |
| excalidraw (Chromium, companions only) | 768M | 0.75 |
| diagramsnet (Chromium, companions only) | 768M | 0.75 |

Uncomment the `*_MEM_LIMIT` / `*_CPU_LIMIT` block in `.env` to apply these ceilings.
On a 1 GB box the full companion set will not boot. On 2 GB the trimmed set
(core + mermaid) works with the limits above. On 4 GB the full companion set fits.

---

## App server (GUNICORN_*, SESSION_SECRET)

The DocCode container runs **gunicorn** with gthread workers
(`GUNICORN_WORKERS × GUNICORN_THREADS` in-flight requests). Each streaming AI
request holds one thread for up to `AI_TIMEOUT_MAX` seconds.

| Variable | Default | Effect |
|---|---|---|
| `GUNICORN_WORKERS` | `2` | Worker processes (≈ CPU cores) |
| `GUNICORN_THREADS` | `8` | Threads per worker |
| `GUNICORN_TIMEOUT` | `30` | Worker silent timeout (seconds) |
| `GUNICORN_GRACEFUL_TIMEOUT` | `30` | Drain window on SIGTERM |
| `GUNICORN_KEEPALIVE` | `5` | Keep-alive seconds |
| `GUNICORN_LOG_LEVEL` | `info` | Log verbosity |

**SESSION_SECRET** signs the per-browser session cookie required by `/api/ai-assist`.

With `preload_app=True` (set in `demoSite/gunicorn.conf.py`), all workers in a
single container share the master process's per-boot secret automatically —
`SESSION_SECRET` is **optional for single-container deployments regardless of
worker count**. It is only required for multi-container or replica deployments
(where workers in different containers would otherwise each generate independent
secrets, breaking session validation across containers).

If you set `SESSION_SECRET`, generate the value with `openssl rand -hex 32` and
paste the literal output into `.env`. **Do not write
`SESSION_SECRET=$(openssl rand -hex 32)`** — `env_file` passes values literally
(no shell substitution) and your containers will get the unexpanded string as
their session key.

---

## AI posture (relay / byok / off)

The server advertises one of three AI modes depending on your `.env`:

| Mode | Condition | Behaviour |
|---|---|---|
| `relay` | `AI_ENABLED=true` + `AI_PROXY_API_KEY` set | Server proxies requests on its API key. Spends the operator's budget. |
| `byok` | `AI_ENABLED=true` + `AI_PROXY_API_KEY` empty | Relay off; users bring their own key in the UI. Requests go browser → provider. Key never reaches the server. |
| `off` | `AI_ENABLED=false` | Assistant button hidden. |

**Free-tier relay recipe** (`AI_MODEL_ALLOWLIST="*:free"` on OpenRouter):

```bash
AI_ENABLED=true
AI_PROXY_URL=https://openrouter.ai/api/v1
AI_PROXY_API_KEY=sk-or-v1-your-key
AI_MODEL_ALLOWLIST="*:free"          # only expose free-tier models
AI_MODEL=openai/gpt-4o-mini
AI_MODEL_FALLBACKS="meta-llama/llama-3.3-70b-instruct:free,openai/gpt-oss-120b:free"
AI_DAILY_LIMIT_PER_IP="10/minute;30/day"
```

**AI_DAILY_LIMIT_PER_IP caveat:** the limit is stored per-worker in-memory (resets
on deploy or gunicorn restart). The effective cap is approximately
`GUNICORN_WORKERS × configured_limit`. For example, with 2 workers and
`10/minute`, a single IP can make ~20 AI requests per minute. Redis-backed limiting
is a future Phase 2 item.

**AI_ACCESS_TOKEN:** when set, every `/api/ai-assist` call must present
`Authorization: Bearer <token>`. Use this to lock down the relay on publicly
reachable deployments without disabling AI entirely.

**BYOK privacy guarantee:** in `byok` mode (or when users enable "Use Direct API"
in Settings), the API key is stored only in the browser and sent only to the endpoint
the user configures — never to the DocCode server. See
[docs/byok-privacy.md](byok-privacy.md) for the full guarantee and DevTools
verification steps.

---

## Full environment-variable reference

Every variable in this table exists in `docker-compose.yml`, `setup-kroki-server.sh`,
`demoSite/gunicorn.conf.py`, or `demoSite/server.py`.

| Variable | Default | Effect |
|---|---|---|
| `HOSTNAME` | `localhost` | Public DNS name (acme mode: must be a dotted FQDN) |
| `HTTPS_PORT` | `8443` | Host-published HTTPS port |
| `HTTP_PORT` | `8000` | Kroki core container port (internal; used in nginx proxy_pass) |
| `TLS_MODE` | `selfsigned` | `selfsigned` / `acme` |
| `ACME_EMAIL` | — | Let's Encrypt expiry notices (required for acme mode) |
| `ACME_STAGING` | — | `1` = use Let's Encrypt staging CA (no rate limits) |
| `ACME_HTTP_PORT` | `80` | Host port for ACME HTTP-01 challenge listener |
| `CERT_ALERT_WEBHOOK` | — | ntfy-compatible URL for cert-expiry alerts |
| `DEPLOY_PROFILE` | `private` | `private` or `public` — sets render rate/body/timeout defaults |
| `RENDER_CACHE_ENABLED` | `true` | Enable nginx proxy cache for GET render routes |
| `RENDER_CACHE_MAX_SIZE` | `500m` | Maximum disk used by the cache |
| `RENDER_CACHE_TTL` | `24h` | Valid TTL for cached 200 responses |
| `RENDER_CACHE_INACTIVE` | `7d` | Eviction window for unaccessed entries |
| `RENDER_RATE` | profile-dependent | nginx limit_req zone rate |
| `RENDER_BURST` | profile-dependent | Burst queue depth |
| `RENDER_CONN_LIMIT` | profile-dependent | Per-IP simultaneous connections |
| `RENDER_BODY_LIMIT` | profile-dependent | Max body on render routes |
| `RENDER_TIMEOUT` | profile-dependent | Proxy send/read timeout (seconds) |
| `KROKI_SAFE_MODE` | `secure` | `secure` / `safe` / `unsafe` — PlantUML include/SSRF guard |
| `KROKI_BODY_LIMIT` | `10485760` | Kroki core body cap in bytes (defense-in-depth) |
| `COMPOSE_PROFILES` | `companions` | `companions` / empty / comma-separated renderer names |
| `DISABLED_DIAGRAM_TYPES` | — | Comma-separated types hidden from the UI dropdown |
| `CORE_MEM_LIMIT` | `0` (unlimited) | Memory ceiling for core container |
| `CORE_CPU_LIMIT` | `0` (unlimited) | CPU ceiling for core container |
| `MERMAID_MEM_LIMIT` | `0` | Memory ceiling for mermaid container |
| `MERMAID_CPU_LIMIT` | `0` | CPU ceiling for mermaid container |
| `DEMOSITE_MEM_LIMIT` | `0` | Memory ceiling for demosite container |
| `DEMOSITE_CPU_LIMIT` | `0` | CPU ceiling for demosite container |
| `NGINX_MEM_LIMIT` | `0` | Memory ceiling for nginx container |
| `NGINX_CPU_LIMIT` | `0` | CPU ceiling for nginx container |
| `GUNICORN_WORKERS` | `2` | Worker processes |
| `GUNICORN_THREADS` | `8` | Threads per worker |
| `GUNICORN_TIMEOUT` | `30` | Worker silent timeout (seconds) |
| `GUNICORN_GRACEFUL_TIMEOUT` | `30` | Drain window on SIGTERM |
| `GUNICORN_KEEPALIVE` | `5` | Keep-alive seconds |
| `GUNICORN_LOG_LEVEL` | `info` | Log verbosity |
| `SESSION_SECRET` | random per boot | Session-cookie signing key; required for multi-container deployments |
| `AI_ENABLED` | `true` | `true` / `false` — enables or kills the assistant |
| `AI_PROXY_URL` | `https://openrouter.ai/api/v1` | LLM proxy base URL |
| `AI_PROXY_API_KEY` | — | Operator API key; empty = byok mode |
| `AI_PROXY_NAME` | `OpenRouter` | Display name for the proxy in the UI |
| `AI_MODEL` | `openai/gpt-4o-mini` | Default model |
| `AI_MODEL_ALLOWLIST` | — | Comma-separated glob patterns; empty = allow all |
| `AI_MODEL_FALLBACKS` | — | Ordered fallback chain for startup model validation |
| `AI_MAX_TOKENS` | `16000` | Hard token ceiling per request |
| `AI_TIMEOUT` | `30` | Default AI request timeout (seconds) |
| `AI_TIMEOUT_MAX` | `300` | Hard ceiling for client-requested timeouts |
| `AI_DAILY_LIMIT_PER_IP` | — | flask-limiter format; empty = no extra cap |
| `AI_ACCESS_TOKEN` | — | Shared bearer token gating `/api/ai-assist` |
| `DRAWIO_SERVER_URL` | `https://embed.diagrams.net/embed` | Draw.io embed server URL |

---

## Updating

```bash
cd /opt/kroki-server
git pull --ff-only
docker compose pull core nginx   # pick up new images explicitly
./setup-kroki-server.sh restart  # .env is preserved
```

Note: `VERSION` in `.env` reflects the version string shown in the UI. After an
upgrade the prod instance reports the old version string until you update
`VERSION=` in `/opt/kroki-server/.env` to match the new release.
