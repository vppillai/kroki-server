# DocCode at Public Scale: Architecture & Cost-Optimization Brainstorm

A deep, evidence-based brainstorm (no implementation) on whether the current stack survives a public launch, and how to keep operating costs near zero while it grows. All claims cite files/lines in the repo as of branch `fix/deep-analysis-findings`.

## Executive summary

DocCode today is a well-built **single-host, internal-network appliance**: one `docker-compose` bringing up Kroki core + four heavy companion renderers + a Flask app + an nginx TLS terminator (`docker-compose.yml:1-83`). The recent security branch (`513b204`, `180a78c`) closed the most dangerous public-launch holes — AI relay auth, param clamps, CORS allowlist, SSE leak fixes — so the app is *safe enough to think about going public*. But it is **not yet shaped to scale or to run cheaply under public load**, and three things stand out:

1. It runs the **Flask development server in production** (`server.py:726-731`, no gunicorn in `requirements.txt:1-6`). This is the single most important blocker.
2. **Nothing caches Kroki renders** despite renders being pure functions of input — `nginx.conf` has no `proxy_cache`, and the AI route explicitly sets `proxy_cache off` (`nginx.conf:88`). This is the single biggest *free* cost/scale win available.
3. The **AI relay is the only unbounded financial liability** — every `/api/ai-assist` call spends *your* OpenRouter key (`server.py:508-519`), and BYOK already exists client-side (`ai-assistant-api.js:24-70`) but is not the default.

The good news: the architecture decomposes cleanly into "static + cacheable render API" (trivially scalable/CDN-able) and "stateful AI relay" (the only hard part). The recommended posture is **lead with the self-host product, operate a deliberately-cheap hosted demo with BYOK-by-default**, and adopt render caching first.

---

## 1. Scale-readiness audit — what breaks first, and when

### 1.1 Single-host assumptions

Everything is one `docker-compose` on one box, one bridge network (`docker-compose.yml:81-83`), nginx published on a single host port (`docker-compose.yml:73-74`). There is no load balancer, no service discovery, no replica concept. `setup-kroki-server.sh` is explicitly a single-machine lifecycle script (`start/stop/restart/clean`, lines 448-519) that builds images locally and writes `nginx.conf` from a heredoc (lines 159-290). This is fine for a VPS; it is a hard ceiling — you scale only by making the box bigger.

### 1.2 Statefulness that breaks horizontal scaling

Two pieces of in-process state prevent running >1 app replica without changes:

- **Per-boot session secret.** `SESSION_SECRET = os.environ.get('SESSION_SECRET') or secrets.token_hex(32)` (`server.py:86`). If unset, each replica signs cookies with a *different* secret, so a session cookie minted by replica A (`_serve_index()` sets it, `server.py:677-685`) fails HMAC validation on replica B (`validate_session_token`, `server.py:418-422`) → AI requests 401. Already documented in `.env.example:30-32`. **Mitigation is trivial** (set a shared `SESSION_SECRET`), but it is a latent footgun for anyone who scales out without reading the comment.
- **In-memory rate limiter.** `Limiter(get_remote_address, app=app, default_limits=[])` (`server.py:72`) with `@limiter.limit("10/minute")` on the AI route (`server.py:444`). Flask-Limiter defaults to an **in-memory store**, so the `10/min` budget is *per-process*, not global. With N gunicorn workers or N replicas, the effective limit is `10·N`/min, and a restart resets it. Under any multi-worker deployment this silently multiplies your AI spend cap.

There is **no other server-side state** — no database, no session store, no file writes. All user data (config, history, custom API keys) lives in the browser via `localStorage` (`config.js:9, 175-205`; `code-history.js`). That statelessness is a *gift*: the render path and static path are embarrassingly parallel; only the rate limiter and session secret need externalizing (Redis) to scale the app tier.

### 1.3 Flask dev server — the first hard wall

`server.py:726-731` calls `app.run(host=..., threaded=True)`. This is the **Werkzeug development server**, which the Werkzeug docs explicitly warn is not for production: it is single-process, has no robust worker model, poor keep-alive/backpressure handling, and serves SSE streams (`server.py:549-566`) and 300s-timeout proxy requests on Python threads. `requirements.txt:1-6` contains **no gunicorn/uvicorn/waitress** — there is no production WSGI server in the image at all.

Concrete failure mode: each streaming AI request holds a Werkzeug thread for the *entire* upstream completion (up to `AI_TIMEOUT_MAX=300s`, `server.py:75`). The GIL plus the dev server's thread model mean a few dozen concurrent SSE streams, or a handful of slow renders proxied through, will saturate the app process and stall *static file serving too* (the same Flask process serves `index.html`, JS, CSS — `server.py:703-716`). This is the first thing that falls over.

### 1.4 Kroki container resource profiles

The render tier is heavy and the heaviness is uneven:

- **`core`** (`docker-compose.yml:2-21`) is a **JVM** Kroki server bundling PlantUML, Graphviz/Dot, and many native renderers — this is a multi-hundred-MB image (the build is "Maven server jar + Rust/Go/Deno/pkg native renderers", `build-kroki-core.sh:11-13`) with a JVM baseline RSS of several hundred MB idle, spiking under PlantUML/Graphviz layout.
- **`mermaid`, `bpmn`, `excalidraw`** (`docker-compose.yml:23-45`) are **headless-Chromium / Node** renderers. Each runs a browser to rasterize; Chromium baseline is ~150-300 MB *idle per container*, and each render spawns/holds a page context that spikes CPU and memory.
- **`diagramsnet`** (`docker-compose.yml:47-53`) is likewise a JS/browser-backed renderer.

So a bare boot is roughly: JVM core (~300-500 MB) + 3-4 Chromium/Node companions (~150-300 MB each) ≈ **1.2-2 GB RAM committed before a single user arrives**, plus nginx and Flask. On a $5 (1 GB) VPS this **OOMs at idle**; you realistically need ~2-4 GB just to hold the full companion set warm. This is the dominant fixed cost and the prime target for "lazy/optional companions" (see §5).

### 1.5 No horizontal scaling story, no CDN, self-signed TLS, no observability

- **No horizontal scaling.** No replica/HPA concept; `setup-kroki-server.sh` is single-host. Covered above.
- **No CDN.** Static assets are proxied *through* nginx → Flask (`nginx.conf:46-75` → `demosite:8006`), with `expires -1` forcing revalidation on every load (`nginx.conf:58, 74`). Every static asset hit and every render touches your origin. There is no edge caching layer despite renders being ideal CDN objects.
- **Self-signed TLS.** `generate_certs()` mints an ECDSA self-signed cert (`setup-kroki-server.sh:88-104`). Public browsers will hard-fail this — you need real ACME/Let's Encrypt certs for any public host. This is a launch blocker, not a scale issue.
- **No observability.** Logging is `logging.basicConfig(level=INFO)` to stdout (`server.py:46`); health is a static `/api/health` JSON (`server.py:627-634`). There are no metrics (request rate, render latency, AI spend, error rate), no tracing, no alerting. Under public load you'd be blind to *why* it fell over, and — critically — blind to a runaway AI bill until the invoice arrives.

### 1.6 What breaks first, in order (rough traffic estimates)

These are order-of-magnitude, single 2-vCPU/4 GB VPS, full companion set warm:

1. **AI cost, not capacity (immediate).** A single motivated user (or a script that solved the session-cookie gate, §4) can run the 10/min limit continuously. At GPT-4o-class pricing that is a **multi-dollar-per-hour** burn from one IP. No traffic "level" needed — this breaks on day one if the relay is on with your key.
2. **Flask dev server concurrency (~dozens of concurrent users).** A few dozen simultaneous AI streams or slow renders saturate the single Flask process and stall static serving too (§1.3). Realistically the app tier wobbles in the **low tens of concurrent active sessions**.
3. **Render CPU/RAM (tens of req/s of heavy diagrams).** PlantUML/Graphviz/Chromium renders are CPU- and memory-heavy and *uncached* (§2). A modest burst of large PlantUML/Graphviz inputs (each allowed up to 10 MB body, `nginx.conf:15`, 300s timeout, `nginx.conf:104-118`) pins cores and can OOM companions. Tens of heavy renders/second is enough.
4. **RAM at idle on small instances (zero traffic).** As in §1.4, the full companion set won't even boot on a 1 GB box.

The encouraging part: items 2 and 3 are mostly solved by *caching* and a *real WSGI server* — cheap, well-understood fixes. Item 1 is solved by changing the AI default (§3).

---

## 2. Deployment architecture options by cost tier

A reusable mental model: split the app into three planes —
- **Static plane** (HTML/JS/CSS): pure CDN material.
- **Render plane** (Kroki GET/POST): *stateless, deterministic, cacheable*. Encoded-diagram GET URLs (`nginx.conf:110` matches `/<type>/<format>/<encoded>`) are pure functions of input → ideal CDN/edge objects.
- **AI plane** (`/api/ai-assist`): stateful (auth, spend), the only hard-to-scale and only expensive piece.

### Tier (a) — Hobby / free-tier (~$5-20/mo)

**Goal:** one small box, AI off or BYOK-only, renders cached so the box survives bursts.

- **Host:** single Hetzner CX22 (~$4-5/mo, 2 vCPU/4 GB) or Fly.io with scale-to-zero. 4 GB is the floor to hold core + companions warm (§1.4).
- **Required app changes:**
  - Run **gunicorn** (e.g. `gunicorn -k gthread -w 2 --threads 8 server:app`) instead of `app.run` (`server.py:726-731`); add it to `requirements.txt`. Set a fixed `SESSION_SECRET` (`server.py:86`).
  - **Disable the server AI relay** by default (`AI_ENABLED=false`, honored at `server.py:457-458`) → push users to BYOK (§3). Or require `AI_ACCESS_TOKEN` (`server.py:92, 432-437`).
  - **Drop heavy companions you don't need** from `docker-compose.yml` (excalidraw/bpmn/diagramsnet are the prime cuts — §5). PlantUML/Graphviz/Mermaid cover the vast majority of usage.
  - **Add nginx `proxy_cache`** on the two render locations (`nginx.conf:95-118`) keyed on the request URI. Renders being deterministic, even a small disk cache turns repeat loads into ~free 200s.
  - Real **ACME TLS** (Caddy as the terminator, or certbot) replacing self-signed (`setup-kroki-server.sh:88-104`).
- **Cost characteristics:** fixed ~$5/mo box; **$0 marginal** render cost once cached; **$0 AI** (BYOK). Fly scale-to-zero can make an idle demo cost cents.

### Tier (b) — Growing (~$50-200/mo)

**Goal:** handle real concurrency, keep AI spend bounded, start seeing what's happening.

- **Host:** a larger VM (4-8 vCPU/8-16 GB) *or* split planes: app+nginx on one node, render companions on another. Add an external **Redis** for the rate limiter + session store.
- **Required app changes:**
  - Externalize Flask-Limiter to **Redis** (`server.py:72`) so the 10/min cap is *global*, not per-worker (§1.2). This also lets you add **per-IP daily budgets** and **per-session budgets** (§3).
  - Put renders behind a **CDN** (Cloudflare in front of nginx). Render GET URLs cache at edge for free on Cloudflare's tier; origin only sees cache misses. Static plane served from CDN too.
  - **Structured logging + metrics**: emit render latency, AI token spend, 4xx/5xx, per-IP counts; ship to a cheap stack (Grafana Cloud free tier / Better Stack). Add an **AI spend alarm** (§3).
  - Tune **gunicorn workers** to cores; cap per-worker threads to bound concurrent SSE streams (§5).
- **Cost characteristics:** ~$50-150 compute + Redis; CDN likely free tier; AI bounded by server-side caps (or $0 if BYOK). The variable cost is now *controlled*, not unbounded.

### Tier (c) — Popular (CDN + autoscaling)

**Goal:** elastic capacity, edge-cached renders, AI as an opt-in metered feature.

- **Architecture:**
  - **CDN (Cloudflare/Fastly)** fronts everything. Static + render GET responses cached at edge globally → origin sees a tiny fraction of render traffic.
  - **Render tier autoscales** (k8s Deployment / Fly machines / ECS) as stateless replicas of core + the *needed* companions, behind the LB. Because renders are stateless, this is pure horizontal scale-out — the easy part.
  - **App tier** (Flask under gunicorn) autoscales independently; shared **Redis** for limits/sessions; shared `SESSION_SECRET`.
  - **AI plane** is its own small, tightly-budgeted service: BYOK for most, optional metered server key with hard global spend caps and queueing.
- **Required app changes:** a real packaging story (Helm chart or Compose-per-plane), readiness/liveness probes beyond the static `/api/health`, render-cache headers emitted by Kroki/nginx so the CDN caches aggressively, per-tenant/per-key AI accounting.
- **Cost characteristics:** With edge caching, **render cost per user approaches zero** at scale (CDN absorbs hits); compute scales with *miss* traffic + AI. The bill is dominated by AI (if you offer a server key) and baseline render replicas. This is where "operate a hosted instance" becomes a real cost-center decision (§6).

### Trade-offs across tiers

| Option | Pros | Cons |
|--------|------|------|
| (a) Single small VPS, AI off/BYOK, render cache | Cheapest (~$5/mo), simplest, $0 AI risk, matches current single-host design | No HA; one box = SPOF; manual ops; capacity ceiling |
| (b) Bigger box + Redis + CDN + metrics | Bounded AI cost, real concurrency, visibility, still cheap | Added moving parts (Redis, CDN config), needs limiter/observability work |
| (c) CDN + autoscaling planes | Elastic, edge-cached renders ≈ free at scale, HA | Most engineering (Helm/probes/accounting); AI spend is the dominant variable cost |

---

## 3. AI cost control — the biggest operational liability

**Why this dominates:** `/api/ai-assist` proxies to `f"{AI_PROXY_URL}/chat/completions"` using the **server's** `AI_PROXY_API_KEY` (`server.py:508-519`). Every successful call spends *your* money. The current guardrails are real but insufficient for a public app:

- Auth gate: session cookie or `AI_ACCESS_TOKEN` (`server.py:425-437`). The session cookie is mintable by any client that does one GET of `/` (`_serve_index`, `server.py:671-685`) — it only blocks dumb scripts, not a determined abuser who replays the cookie.
- Rate limit: `10/minute` per IP (`server.py:444`), but **in-memory/per-process** (§1.2) and per-IP (trivially defeated by rotating IPs / a botnet).
- Token clamp: `max_tokens` clamped to `AI_MAX_TOKENS=16000` (`build_ai_payload`, `server.py:168-174`) and timeout clamped to `AI_TIMEOUT_MAX=300` (`server.py:484`). Good — bounds *per-request* cost but not *aggregate* spend.
- Model allowlist: requests validated against `AVAILABLE_MODELS` (`server.py:486-503`), but that list is fetched live from the proxy `/models` (`fetch_models_from_proxy`, `server.py:191-257`) — i.e. it **allows every model the proxy exposes, including the most expensive ones**, with default `openai/gpt-4o` (`.env.example:23`), a high-cost model.

**Options, roughly in order of leverage:**

1. **BYOK-by-default in public mode (highest leverage, ~zero cost).** The client already supports it end-to-end: `callCustomAPI` posts directly to the user's `config.endpoint` with the user's key (`ai-assistant-api.js:24-70`), selected when `useCustomAPI && endpoint && apiKey` (`ai-assistant.js:585-586`). It **never touches your server or your key**. Make this the default for the hosted instance and you eliminate the entire AI cost line. The UI copy already frames proxy as "recommended" (`config-ui-templates.js:315-317`) — flip the default for public mode.
2. **Disable the relay entirely in "public mode" via config.** `AI_ENABLED=false` already short-circuits the endpoint (`server.py:457-458`, `.env.example:19`). A single `PUBLIC_MODE` flag that forces `AI_ENABLED=false` + BYOK UI is the cleanest "free hosted demo" switch.
3. **Cheap-default model allowlist.** Replace the live-proxy model list (`server.py:264-269`) with a *curated, capped* allowlist for public mode and default to a low-cost model (e.g. `gpt-4o-mini` / a cheap OpenRouter model). The allowlist plumbing already exists (`server.py:486-503`); just feed it a cheap, fixed set.
4. **Server-side aggregate spend cap.** New: track tokens/cost in Redis keyed by day and globally; refuse new relay calls past a daily ceiling (HTTP 503 with a "try BYOK" message). This is the safety net that prevents a surprise invoice. Pair with a metrics alarm (§2b).
5. **Per-session / per-IP budgets (not just rate).** Move from "10 requests/min" to "N requests *and* M tokens per session/IP/day" in Redis. Rate limits throttle burst; budgets cap total spend.

**Recommendation:** For any *you-operated* public instance, lead with **#1 + #2** (BYOK default, relay off) and keep #3-5 as the path for an optional, metered "we provide a key" tier. For self-hosters, ship the relay on but documented as "this spends your key — set `AI_ACCESS_TOKEN` and budgets before exposing it publicly."

---

## 4. Abuse & DoS surface for a public deployment

### 4.1 Rendering DoS

- **CPU bombs.** Kroki core runs PlantUML and Graphviz, both of which have pathological inputs (deeply nested/huge graphs, expensive layout) that consume large CPU/RAM per request. nginx allows **10 MB bodies** (`client_max_body_size 10M`, `nginx.conf:15`) and **300s timeouts** on render routes (`proxy_connect/send/read_timeout 300`, `nginx.conf:104-118`). A handful of concurrent 10 MB Graphviz/PlantUML inputs can pin every core/companion for minutes. There is **no per-IP rate limit on the render routes** — only the AI route is limited (`server.py:444`). This is the most accessible DoS vector.
  - **Mitigations:** add nginx `limit_req`/`limit_conn` on the render locations; lower `client_max_body_size` for renders (10 MB is generous — most diagrams are KB); lower render timeouts to ~10-30s; set Kroki resource limits (`KROKI_MAX_URI_LENGTH` is set to 8192 at `docker-compose.yml:12`, but body-size/element limits per diagram type are not constrained here); cache renders so repeats are free (§5); and CPU/memory `deploy.resources.limits` on the render containers (none set today in `docker-compose.yml`).
- **AI relay DoS / cost-DoS.** Covered in §3 — the relay is both a financial and a thread-exhaustion vector (each SSE stream holds a worker for up to 300s, `server.py:549-566`).

### 4.2 SSRF via Kroki features — **important and currently unverified in this deployment**

This is the highest-severity finding. Kroki/PlantUML/Graphviz have **file-include and remote-resource features** that are classic SSRF/LFI vectors:
- PlantUML `!include`/`!includeurl`, sprite/`!theme` fetches.
- Graphviz `image=`/`imagepath` references.
- These can be coerced into fetching `http://169.254.169.254/...` (cloud metadata) or internal services, or reading local files, **unless Kroki's SAFE mode is enabled.**

Kroki gates these behind `KROKI_SAFE_MODE` (values `unsafe`/`safe`/`secure`; default is `secure`/`safe` depending on version, which disables includes and remote fetches). **This deployment does not set `KROKI_SAFE_MODE` anywhere** — I grepped all yml/sh/py/env files and found no `SAFE_MODE`/`KROKI_SAFE`/`BLOCK_LOCAL` setting (only the unrelated "allowlist" comments in `server.py:68, 388`). The `core` service env (`docker-compose.yml:11-16`) sets only host wiring and URI length.

Because the default depends on the Kroki version — and this deployment uses a **custom core built from a pinned `main` commit** (`docker-compose.yml:10`, `build-kroki-core.sh:19`) — the safe posture is to **explicitly set `KROKI_SAFE_MODE=secure`** (and `KROKI_BLOCK_LOCAL_FILE_ACCESS=true` if supported by that build) rather than rely on the default. For a public deployment this should be treated as a launch blocker until verified against the actual running container. Even in SAFE/SECURE mode, validate that remote includes are disabled, since the core is a non-release build.

### 4.3 Other surface

- **No CSRF token** on `/api/ai-assist`, but `SameSite=Strict` on the session cookie (`server.py:683`) + Origin allowlist with `require=True` (`server.py:451`, `validate_origin` 387-405) is a reasonable defense for a JSON API. Adequate.
- **Static path traversal** is handled — `static_files` blocks `.py`, `requirements*.txt`, Dockerfile, `__pycache__`, `tests` (`server.py:699-716`), and `send_from_directory` constrains the root.
- **The render proxy is open to the world** for any `/<type>/<format>/<encoded>` (`nginx.conf:110`). That's by design (it's the product), but it means *anyone* can use you as a free Kroki render farm. Caching (§5) plus render rate limits convert this from a liability into a cheap, bounded service.

---

## 5. Cost-optimization levers, ranked by effort/impact

| # | Lever | Effort | Impact | Evidence / where |
|---|-------|--------|--------|------------------|
| 1 | **Render caching** (nginx `proxy_cache` now, CDN later) on `/<type>/<format>/<encoded>` GETs | Low | **Very high** — renders are deterministic; repeats become ~free, slashing CPU/RAM and protecting against repeat-render DoS | No cache today: `nginx.conf:95-118` has none; AI route `proxy_cache off` at `:88`. Render URL is pure function of input (`nginx.conf:110`) |
| 2 | **Default AI to BYOK / relay off** in public mode | Low | **Very high** — removes the only unbounded cost line | `AI_ENABLED` honored `server.py:457-458`; BYOK fully client-side `ai-assistant-api.js:24-70` |
| 3 | **Disable/lazy-load heavy companions** (excalidraw, bpmn, diagramsnet; keep core+mermaid) | Low | **High** — each Chromium/Node companion is ~150-300 MB idle; cutting 3 frees ~0.5-1 GB and shrinks the instance you must pay for | `docker-compose.yml:23-53`; all `restart: unless-stopped` so all boot eagerly |
| 4 | **Run gunicorn + tune workers/threads** instead of dev server | Low | **High** — real concurrency, bounded SSE thread pool, stops static serving from stalling | `app.run(...)` `server.py:726-731`; no WSGI server in `requirements.txt:1-6` |
| 5 | **Right-size render timeouts & body limits** | Low | Medium-high — shrinks DoS blast radius and per-request worst case | `client_max_body_size 10M` `nginx.conf:15`; `*_timeout 300` `nginx.conf:104-118` |
| 6 | **Static asset CDN + content-hash filenames** (enable real caching instead of `expires -1`) | Medium | Medium — offloads all static hits from origin; the `expires -1` revalidation (`nginx.conf:58,74`) exists only because assets are unversioned | `nginx.conf:46-75` |
| 7 | **Image-size reduction** for the custom core; multi-arch already done | Medium | Medium — smaller images = faster autoscale/cold-start, lower registry/egress; demosite is already slim `python:3.12-alpine` (`Dockerfile:2`) | `build-kroki-core.sh` heavy multi-stage build |
| 8 | **ARM instances** (Hetzner/Graviton); multi-arch core already built (`f13253f`) | Low | Medium — ARM is ~20-40% cheaper for the same throughput, and the core image is already multi-arch | commit `f13253f` "build multi-arch (amd64+arm64)" |
| 9 | **Scale-to-zero** for a hobby demo (Fly machines / Cloud Run-style) | Medium | Medium — idle demo costs ≈ $0; cold start is the trade (JVM core warmup) | stateless app (no server datastore) makes this viable |
| 10 | **Redis-backed global rate limit + spend cap** | Medium | Medium (cost-safety) — converts per-process 10/min into a real global budget | `server.py:72` in-memory limiter |

**The 80/20:** levers **1-4** are all *low effort* and collectively neutralize the four "breaks first" items from §1.6. Do those first.

---

## 6. "Self-host" vs "you operate a hosted instance" — two different products

These have fundamentally different cost and risk profiles:

**Self-hosted (the natural fit for this repo today).**
- Cost profile: **$0 to the project owner.** The user runs their own box, their own key, their own bill. The repo's job is *packaging and docs*.
- Risk profile: low for you; the user owns abuse/SSRF/cost risk.
- What the repo needs:
  - A **one-command path that already exists** (`setup-kroki-server.sh start`) — but it bakes in self-signed TLS and the dev server. Add a documented "public/production profile" (gunicorn, ACME TLS, `KROKI_SAFE_MODE=secure`, AI off or token-gated, render cache, companion subset).
  - **One-click deploy buttons** (Fly.io, Railway, Render, "Deploy to Hetzner") and a trimmed `docker-compose.public.yml`.
  - A **Helm chart** for the k8s crowd (renders as a scalable Deployment; app+Redis).
  - **Docs** that make the AI cost/SSRF trade-offs explicit (none of this is in `README.md` today — grep found no deploy/scale/public sections).

**You-operate-a-hosted-instance (a service, not a repo).**
- Cost profile: **you pay compute + (optionally) AI.** With render caching + CDN, render compute trends toward a fixed baseline; AI is the swing factor and must be BYOK-default or hard-capped (§3).
- Risk profile: you own abuse, SSRF, runaway spend, uptime, and TLS. This is an operational commitment.
- What it needs: everything in tiers (b)/(c) — Redis-backed limits, spend caps, observability, real TLS, autoscaling, an on-call story.

**Recommendation: lead with self-host, operate a deliberately-cheap reference demo.** The codebase is already shaped for self-hosting (single compose, fully client-persisted state, BYOK built in). Position DocCode as "the open-source diagram editor you self-host," and run *one* hosted demo on a single cheap box with **AI relay off (BYOK only), render caching on, companion set trimmed, real TLS, SAFE mode on**. That demo costs ~$5-20/mo and carries near-zero financial-abuse risk, while the self-host docs/Helm/deploy-buttons drive adoption without you owning anyone's bill.

---

## 7. Recommended phased roadmap

**Phase 0 — Prerequisites (already in flight on `fix/deep-analysis-findings`).** Done/landing: AI relay auth (session cookie + optional `AI_ACCESS_TOKEN`, `server.py:425-437`), client-param clamps (tokens/timeout, `server.py:168-174, 484`), CORS allowlist + `ProxyFix` (`server.py:70-71`), Origin `require=True` on the relay (`server.py:451`), SSE leak/interruption fixes (`server.py:549-566`), `restart: unless-stopped` + pinned `nginx:1.28-alpine` (compose diff), CI + Dependabot + tests (`180a78c`). These make a public launch *safe to contemplate*.

**Phase 1 — Make it publicly deployable & cheap (single box, ~$5-20/mo).** Low-effort, high-impact:
1. **Set `KROKI_SAFE_MODE=secure`** explicitly on `core` (`docker-compose.yml:11-16`) and verify includes/remote-fetch are blocked on the custom `main` build. *(Launch blocker — §4.2.)*
2. **Real ACME TLS** (Caddy or certbot) replacing self-signed (`setup-kroki-server.sh:88-104`). *(Launch blocker.)*
3. **gunicorn** in `requirements.txt` + CMD; fixed `SESSION_SECRET`. *(§1.3, §5 #4.)*
4. **nginx `proxy_cache`** on render routes. *(§5 #1 — biggest free win.)*
5. **Public-mode default: `AI_ENABLED=false` + BYOK UI default**, or require `AI_ACCESS_TOKEN`. *(§3.)*
6. **Trim companions** to core+mermaid (+plantuml/graphviz in core); make bpmn/excalidraw/diagramsnet opt-in. *(§5 #3.)*
7. **Add render `limit_req`/`limit_conn`, lower render body-size + timeouts.** *(§4.1.)*

**Phase 2 — Growing (bounded cost, visibility, ~$50-200/mo).**
1. **Redis-backed** rate limiter + session store → global limits across workers/replicas. *(§1.2, §3 #5.)*
2. **Server-side AI spend cap + alarm**; curated cheap-default model allowlist. *(§3 #3-4.)*
3. **CDN in front** (Cloudflare): edge-cache render GETs + static. *(§2b, §5 #6.)*
4. **Observability:** structured logs, render-latency + AI-spend + error metrics, alerting. *(§1.5.)*
5. **Content-hashed static assets** to enable true long-cache instead of `expires -1`. *(§5 #6.)*

**Phase 3 — Popular (elastic, edge-cached).**
1. **Stateless render tier autoscaling** (Helm Deployment / Fly machines) behind LB + CDN — the easy scale-out, since renders are pure functions. *(§2c.)*
2. **App tier autoscaling** with shared Redis + `SESSION_SECRET`.
3. **AI as a metered, BYOK-default opt-in tier** with per-key accounting.
4. **Packaging for self-hosters:** Helm chart, `docker-compose.public.yml`, one-click deploy buttons, production docs. *(§6.)*

---

## References

- `docker-compose.yml:2-53` — single-host stack; JVM core + 4 Chromium/Node companions, all eager `restart: unless-stopped`; no resource limits.
- `docker-compose.yml:11-16` — core env sets host wiring + `KROKI_MAX_URI_LENGTH` only; **no `KROKI_SAFE_MODE`** (SSRF surface, §4.2).
- `docker-compose.yml:10`, `build-kroki-core.sh:19` — custom core built from a pinned `main` commit (default SAFE behavior must not be assumed).
- `demoSite/server.py:726-731` — production runs the **Flask dev server** (`app.run`); `requirements.txt:1-6` has **no WSGI server**.
- `demoSite/server.py:72`, `:444` — **in-memory** Flask-Limiter, `10/minute` per-IP per-process AI cap.
- `demoSite/server.py:86`, `.env.example:30-32` — per-boot `SESSION_SECRET` (multi-replica footgun).
- `demoSite/server.py:425-437`, `:451` — AI relay auth (session cookie / `AI_ACCESS_TOKEN`) + Origin `require=True`.
- `demoSite/server.py:168-174`, `:484` — `max_tokens`/timeout clamps (per-request cost bound, not aggregate).
- `demoSite/server.py:191-257`, `:264-269`, `:486-503` — model allowlist sourced live from proxy `/models` (allows expensive models); default `openai/gpt-4o` (`.env.example:23`).
- `demoSite/server.py:457-458`, `.env.example:19` — `AI_ENABLED=false` short-circuits the relay (public-mode kill switch).
- `demoSite/server.py:508-519` — relay spends the **server's** `AI_PROXY_API_KEY` (the cost liability).
- `demoSite/js/ai-assistant-api.js:24-70`, `ai-assistant.js:585-586` — **BYOK** path posts directly to the user's endpoint, bypassing the server entirely.
- `nginx.conf:15` — `client_max_body_size 10M`; `nginx.conf:104-118` — render `*_timeout 300`; `nginx.conf:88` — `proxy_cache off`; **no `proxy_cache` anywhere** (no render caching).
- `nginx.conf:46-75`, `:58,:74` — static served via Flask with `expires -1` (revalidate every load; no CDN).
- `nginx.conf:95-118` — render routes open to the world, no per-IP `limit_req`/`limit_conn`.
- `setup-kroki-server.sh:88-104` — self-signed TLS (public launch blocker); `:448-519` — single-host lifecycle only.
- `demoSite/Dockerfile:2`, `:38-39` — slim Alpine app image, non-root, static `/api/health` only.
- `js/config.js:9, 175-205`, `code-history.js` — all user state in browser `localStorage` (server is stateless → easy horizontal scale once limiter/secret externalized).
- `README.md` — no deployment/scale/public-hosting guidance today (gap for §6).

One uncertainty worth flagging explicitly: I could not confirm the *runtime* Kroki SAFE-mode default for the specific pinned `main` build without starting the container; §4.2 should be verified against the running image before any public exposure — treat it as a launch blocker, not a maybe.