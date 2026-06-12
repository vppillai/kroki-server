# DocCode Public Demo — Hosting Runbook

This runbook covers provisioning, deploying, and operating the public DocCode demo
on a Hetzner CAX11 ARM instance. Self-hosters on other clouds can follow the same
procedure — skip the Hetzner-specific steps and adapt the firewall rules to your
provider's equivalent.

The closed-network default (`./setup-kroki-server.sh start`, self-signed TLS, full
companion set, AI relay on your own key) is **unchanged** by this runbook. Only the
demo box adds public-profile limits, ACME TLS, and the OpenRouter free-mode relay.

---

## Monthly cost (June 2026, excl. VAT unless noted)

| Item | Hetzner CAX11 (recommended) | Hetzner CX22 (x86 fallback) | netcup VPS 500 G12 |
|---|---|---|---|
| Instance | EUR 4.49 (2 vCPU ARM / 4 GB / 40 GB NVMe) | EUR 7.99 (2 vCPU / 4 GB) | EUR 5.91 incl. VAT (2 vCPU / 4 GB / 128 GB) |
| Traffic | 20 TB included, ~EUR 1/TB over | 20 TB included | unlimited (fair use) |
| IPv4 | ~EUR 0.50 add-on (verify at order) | ~EUR 0.50 | included |
| Auto-backups | +20% = EUR 0.90 (7 retained) | +EUR 1.60 | snapshots included |
| Domain (.com at-cost, amortized) | ~EUR 0.92 (~EUR 11/yr) | same | same |
| AI (OpenRouter `:free`) | EUR 0 (one-time $10 credit) | same | same |
| Monitoring | EUR 0 | EUR 0 | EUR 0 |
| **Total** | **~EUR 6.80/mo (~$8) + one-time $10** | ~EUR 11.00 | ~EUR 7.00 |

Confirm CAX11 and IPv4 prices in the Hetzner console at order time — the
April 2026 price adjustment is recent and third-party calculators may lag.

---

## 1. Provision the server

### Hetzner Cloud Firewall (authoritative — set this FIRST)

Create a Hetzner Cloud Firewall (free) and attach it to the server before it boots.
Docker publishes ports via iptables and **bypasses ufw entirely**, so the Cloud
Firewall is the only reliable perimeter on this stack. Rules:

| Direction | Protocol | Port | Source |
|---|---|---|---|
| Inbound | TCP | 22 | Operator IPs only (restrict this) |
| Inbound | TCP | 80 | Any (ACME HTTP-01 challenge + HTTP→HTTPS redirect) |
| Inbound | TCP | 443 | Any |
| Inbound | ICMP | — | Any |

Enable auto-backups (+20% = ~EUR 0.90/mo, 7 retained). A stateless box makes
auto-backups cheap insurance for fast rebuilds — the only state to preserve is `.env`.

### Server provisioning via cloud-init (recommended)

Paste `docs/cloud-init-demo.yaml` into the Hetzner "User data" field at server
creation. It handles everything below automatically. Then skip to §2 (DNS).

If provisioning manually (without cloud-init):

```sh
# --- run as root on a fresh Ubuntu 24.04 box ---

# Create the deploy user (--disabled-password skips the interactive password
# prompt; use SSH keys only, consistent with the sshd hardening below).
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy

# Copy root's authorized_keys so SSH key logins work as deploy immediately.
install -d -m 700 /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy: /home/deploy/.ssh

# SSH hardening: use a drop-in so it takes effect even if 50-cloud-init.conf
# or 60-cloudimg-settings.conf are already present in sshd_config.d/
# (sshd uses FIRST-match-wins: the 01- prefix sorts before 50-cloud-init.conf
# and 60-cloudimg-settings.conf, so our settings take precedence).
printf 'PasswordAuthentication no\nPermitRootLogin no\n' \
    > /etc/ssh/sshd_config.d/01-doccode.conf
systemctl reload ssh
# Verify: sshd -T | grep -E "passwordauthentication|permitrootlogin"

# Packages (fail2ban optional but recommended on internet-facing boxes).
apt-get update && apt-get -y upgrade
apt-get install -y git fail2ban unattended-upgrades curl

# Docker — official install script (verifies GPG, adds the apt repo).
curl -fsSL https://get.docker.com | sh
# Add the deploy user to the docker group AFTER docker is installed
# (the group must exist first).
usermod -aG docker deploy

# 2 GB swapfile (cushion for the JVM core under burst; not a RAM substitute).
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Clone the repo.
git clone https://github.com/vppillai/kroki-server.git /opt/kroki-server
chown -R deploy: /opt/kroki-server
```

> **Note on GHCR access:** `ghcr.io/vppillai/kroki-core` is a public package —
> no `docker login` is needed. If a pull fails with "denied", check package
> visibility in the GitHub repo Settings → Packages.

> **ufw:** installing ufw is belt-and-braces only; it does NOT protect
> Docker-published ports. The Hetzner Cloud Firewall is the authoritative
> perimeter. If you install ufw anyway, `ufw default deny incoming &&
> ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable`.

---

## 2. DNS and domain

1. Register a domain at an at-cost registrar (Porkbun / Cloudflare Registrar),
   ~EUR 11/yr for a `.com`.
2. **A record:** `<DEMO_DOMAIN>` → server IPv4 (TTL 300 during setup; raise to
   3600 after everything is stable).
3. **AAAA record (optional):** only add if it also points at this box — Let's
   Encrypt prefers IPv6 and uses it if present. A mispointed AAAA causes ACME
   failures even when IPv4 is correct.
4. **CAA record (recommended):** `<DEMO_DOMAIN>. CAA 0 issue "letsencrypt.org"`
5. Do **not** enable Cloudflare proxying yet — that is a Phase 2 CDN item.
6. DNS **must** propagate before the first `./setup-kroki-server.sh start` in
   acme mode. `check_services` in the script curls `https://<DEMO_DOMAIN>/api/health`
   from inside the box; it loops for ~60 s and reports failure if DNS has not
   propagated yet.

---

## 3. OpenRouter provisioning (operator — one time)

The demo AI relay uses OpenRouter `:free` models. The entire AI budget is a
one-time $10 credit.

1. Create an account at [openrouter.ai](https://openrouter.ai) (email or Google,
   no credit card required).
2. **Buy the one-time $10 credit** — this lifts the shared daily cap from 50 to
   1000 `:free` requests/day. Credits never expire. This is the entire AI budget:
   $0/month after this purchase.
3. In **Settings → Privacy**, enable the "training/logging" toggle so that
   `:free` endpoints are accessible. Without this toggle, `:free` model requests
   return "No endpoints found matching your data policy".
4. Under **Keys**, create an API key and copy it into `.env` as `AI_PROXY_API_KEY`.
5. **Never create additional accounts** to multiply limits — that is the ToS red
   line ("making additional accounts for purposes of bypassing or circumventing
   use limits" is explicitly prohibited).

Capacity math: 1000 `:free` req/day shared across all demo users ≈ 70–200
user-sessions/day at 5–15 AI calls each. A viral spike exhausts the pool until
the daily reset (UTC midnight) — the per-IP cap and the quota-exhausted UX
handle that gracefully.

---

## 4. TLS — ACME (Let's Encrypt)

See `docs/acme-tls.md` for the full staging-first procedure. The short version:

Add these four lines to `.env`:

```bash
HOSTNAME=<DEMO_DOMAIN>
HTTPS_PORT=443
TLS_MODE=acme
ACME_EMAIL=<ops-email>
```

Then run the staging-first sequence:

```sh
# Step 1: staging dry-run (uses the Let's Encrypt STAGING CA — untrusted but no
#          rate limits; verifies the full cert-issuance path).
# In .env: set ACME_STAGING=1
./setup-kroki-server.sh start
# Verify the staging cert:
curl -vk https://<DEMO_DOMAIN>/ 2>&1 | grep -i "issuer\|STAGING"

# Step 2: switch to production (real cert).
# Delete the staging cert data, remove ACME_STAGING from .env.
rm -rf ./letsencrypt
# In .env: remove or comment out ACME_STAGING=1
./setup-kroki-server.sh restart

# Step 3: verify the production cert is trusted.
curl -s https://<DEMO_DOMAIN>/api/health
```

Renewal is handled automatically by the `certbot` sidecar container (every 12 h);
nginx reloads the new cert every 6 h. The daily `check-cert-expiry.sh` cron job
(§6) is the backstop if renewal silently fails.

---

## 5. First deploy (as the deploy user)

```sh
cd /opt/kroki-server

# Create .env from the template and fill in the launch bundle below.
cp .env.example .env
# Edit .env — fill every <placeholder> in the "LAUNCH BUNDLE" block (§8).

./setup-kroki-server.sh start
```

After the stack is up, run the acceptance smoke:

```sh
curl -fsS "https://<DEMO_DOMAIN>/api/health"
curl -fsS "https://<DEMO_DOMAIN>/api/config" | python3 -m json.tool
```

`/api/health` must return JSON containing `"healthy"`.
`/api/config` must show `"mode": "relay"` under the `ai` key (if the operator
key is set) and list `bpmn`, `excalidraw`, `diagramsnet` under
`kroki.disabledDiagramTypes`.

---

## 6. Upgrades

```sh
cd /opt/kroki-server
git pull --ff-only

# REQUIRED: ensure_kroki_core() in the setup script short-circuits when the
# image exists locally, so an explicit pull is the only way to pick up the new
# :goat build. The demosite image is always rebuilt locally by the script.
docker compose pull core nginx

# Reconcile .env against .env.example: sync VERSION/BUILD_DATE and any new
# keys added since the last deploy. Technique:
#   diff <(grep -v '^#' .env.example | grep -v '^$') \
#        <(grep -v '^#' .env        | grep -v '^$')
# Add any missing keys; do NOT overwrite secret values.

./setup-kroki-server.sh restart

# Upgrade acceptance: version must show the new release.
curl -fsS "https://<DEMO_DOMAIN>/api/version"
```

> **No watchtower.** `kroki-demosite:latest` is built locally by the setup script
> on every `start`/`restart` and cannot be updated by watchtower. `nginx.conf`
> is regenerated from the script's heredoc. Watchtower is not installed.

> **Core digest pinning (sign-off #7):** after each `docker compose pull core`,
> get the new digest and update `.env`:
> `docker inspect ghcr.io/vppillai/kroki-core:goat --format '{{index .RepoDigests 0}}'`
> then set `KROKI_CORE_IMAGE=ghcr.io/vppillai/kroki-core@sha256:<new-digest>`.
> This prevents an unattended upstream regression on a public box.

> **Never `git clean -x`** on the prod checkout — it deletes `.env`, `nginx.conf`,
> `nginx-certs/`, and `letsencrypt/`.

---

## 7. Backups

The server is **stateless**: no database, no compose volumes, all user state in
browser localStorage. Everything except `.env` is reproducible from git and the
setup script.

What to back up:

- **`.env`** (secrets: `AI_PROXY_API_KEY`, `SESSION_SECRET` if set, `AI_ACCESS_TOKEN`
  if set, the `CERT_ALERT_WEBHOOK` topic). Keep a copy in your password manager.
- **Hetzner auto-backups** (enabled at provisioning, +EUR 0.90/mo): fast full-box
  restore path. Optional but cheap insurance.

TLS certs (`./letsencrypt/`) need no backup — re-issuable in minutes via ACME.
`nginx.conf` and `nginx-certs/` are regenerated by the setup script.

---

## 8. Monitoring

### UptimeRobot (free)

Create a free account at [uptimerobot.com](https://uptimerobot.com).

- **Monitor type:** HTTP(S)
- **URL:** `https://<DEMO_DOMAIN>/api/health`
- **Interval:** 5 minutes
- **Keyword:** `healthy` (confirms the JSON body, not just HTTP 200)
- **Alert contact:** your operator email

> Note: SSL-certificate-expiry alerts are a **paid** UptimeRobot feature. Use the
> `check-cert-expiry.sh` cron job (below) for the free cert-expiry backstop.

### Cron jobs (root)

Install the certificate-expiry backstop via root's crontab:

```sh
sudo crontab -e
# Add this line:
# 0 9 * * * /opt/kroki-server/scripts/check-cert-expiry.sh
```

Install the ops health check via `/etc/cron.d`:

```sh
sudo tee /etc/cron.d/doccode-ops << 'EOF'
# DocCode demo ops — hourly health + weekly image prune
# All logic is in the script (never inline here — cron expands unescaped % as newline).
0 * * * * root /opt/kroki-server/scripts/doccode-ops.sh
EOF
```

Both scripts POST alerts to `CERT_ALERT_WEBHOOK` / `OPS_ALERT_WEBHOOK` (same
ntfy.sh topic URL — set both in `.env`). Install the
[ntfy app](https://ntfy.sh) on the operator's phone and subscribe to the topic.

### Optional: Netdata agent

Netdata gives richer system metrics but uses 150–300 MB RSS on a 4 GB box.
Skip by default; add it if you need more than UptimeRobot + ntfy.

---

## 9. Abuse response

Signs of abuse: sustained 429s on render routes in the nginx log, rapid exhaustion
of the OpenRouter daily quota, or disk fill from abnormal log growth.

```sh
# Check render 429 rates in real time (adjust date pattern as needed):
docker compose logs nginx --since 10m | grep ' 429 '

# Check AI quota exhaustion events:
docker compose logs demosite | grep free_quota_exhausted

# Ban an abusive IP via the Hetzner Cloud Firewall (authoritative):
# In the Hetzner console → Firewalls → your firewall → add an inbound DROP rule
# for the offending IP on ports 80 and 443. Takes effect in seconds.
```

Published abuse contact: the `<ops-email>` in the demo's ACME config and any
public-facing about page. Respond to abuse reports within 48 hours.

---

## 10. The exact `.env` launch bundle

Fill in every `<placeholder>` before running `./setup-kroki-server.sh start`.
Lines without a placeholder are ready to use as-is.

```bash
# ============================================================
# FILL IN AT LAUNCH — replace every <placeholder> below
# ============================================================

# --- identity / TLS ---
HOSTNAME=<DEMO_DOMAIN>
HTTPS_PORT=443
TLS_MODE=acme
ACME_EMAIL=<ops-email>
# Uncomment for the staging dry-run; remove + delete ./letsencrypt for prod:
# ACME_STAGING=1

# --- footprint (trimmed set: core + mermaid + demosite + nginx) ---
COMPOSE_PROFILES=
DISABLED_DIAGRAM_TYPES=bpmn,excalidraw,diagramsnet
DEPLOY_PROFILE=public

# --- resource limits (4 GB / 2 vCPU box) ---
CORE_MEM_LIMIT=1536M
CORE_CPU_LIMIT=1.5
MERMAID_MEM_LIMIT=1024M
MERMAID_CPU_LIMIT=1.0
DEMOSITE_MEM_LIMIT=256M
DEMOSITE_CPU_LIMIT=0.5
NGINX_MEM_LIMIT=128M
NGINX_CPU_LIMIT=0.5

# --- render cache (defaults are fine; explicit for the record) ---
# RENDER_CACHE_ENABLED=true
# RENDER_CACHE_MAX_SIZE=500m
# RENDER_CACHE_TTL=24h
# KROKI_SAFE_MODE=secure   (compose-enforced default — already set)

# --- AI: OpenRouter free-mode hybrid ---
AI_ENABLED=true
AI_PROXY_URL=https://openrouter.ai/api/v1
AI_PROXY_API_KEY=<operator-openrouter-key>
AI_MODEL_ALLOWLIST="*:free"
AI_MODEL=qwen/qwen3-coder:free
AI_MODEL_FALLBACKS="meta-llama/llama-3.3-70b-instruct:free,openai/gpt-oss-120b:free"
AI_DAILY_LIMIT_PER_IP="10/minute;30/day"

# --- ops ---
CERT_ALERT_WEBHOOK=https://ntfy.sh/<private-topic>
OPS_ALERT_WEBHOOK=https://ntfy.sh/<private-topic>
# Pin the core image to the verified digest (sign-off #7). After each deploy:
#   docker inspect ghcr.io/vppillai/kroki-core:goat --format '{{index .RepoDigests 0}}'
# and update this line:
KROKI_CORE_IMAGE=ghcr.io/vppillai/kroki-core@sha256:<pinned-digest>

# --- SESSION_SECRET (optional for single-container deployments) ---
# With preload_app=True (gunicorn.conf.py), all workers in one container
# automatically share the master's per-boot secret — SESSION_SECRET is only
# required to persist sessions across restarts or in multi-replica setups.
# If you set it: run  openssl rand -hex 32  once and paste the LITERAL OUTPUT.
# DO NOT write SESSION_SECRET=$(openssl rand -hex 32) — docker compose passes
# env_file values literally (no shell substitution) and your containers would
# all get the string "$(openssl rand -hex 32)" as their session key.
# SESSION_SECRET=<paste-literal-hex-output-here>

# ============================================================
# END FILL-IN BLOCK
# ============================================================
```

---

## 11. Launch checklist (deferred — run when domain + OpenRouter are ready)

These steps are deferred because the domain and OpenRouter account do not yet
exist. Execute them in order when ready to go live.

- [ ] Register domain → set DNS A record (and AAAA only if also pointing at this
      box) → optional CAA record. Wait for propagation:
      `dig +short A <DEMO_DOMAIN>` returns box IPv4.
- [ ] Create OpenRouter account → buy $10 credit → Settings → Privacy enable
      free endpoints → create API key.
- [ ] Fill all `<placeholder>` values in `.env` (§10 above).
- [ ] **ACME staging dry-run:** set `ACME_STAGING=1` in `.env` →
      `./setup-kroki-server.sh start` → verify staging cert issuer contains
      "STAGING" → `rm -rf ./letsencrypt` → remove `ACME_STAGING=1` →
      `./setup-kroki-server.sh restart`.
- [ ] **Acceptance set (run live with the full bundle):**
  - [ ] `curl -fsS https://<DEMO_DOMAIN>/api/health` → 200 with `"healthy"`
  - [ ] `curl -IsS https://<DEMO_DOMAIN>/` → security headers present:
        `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`,
        `Strict-Transport-Security` (HSTS max-age=86400), `doccode_session` cookie
  - [ ] `curl -ks https://<DEMO_DOMAIN>/` → `doccode_session` cookie in
        Set-Cookie header
  - [ ] Two GET renders of the same plantuml diagram → first `X-Cache-Status: MISS`,
        second `X-Cache-Status: HIT`; both responses carry all security headers
        including CSP (the shared-fragment cross-product check)
  - [ ] 60-way concurrent render burst → mix of 200 and 429 (public-profile limit)
  - [ ] POST render → 200, no `X-Cache-Status` header (POST is never cached)
  - [ ] `curl -fsS https://<DEMO_DOMAIN>/api/config | python3 -m json.tool` →
        `ai.mode == "relay"`, `kroki.disabledDiagramTypes` contains bpmn/excalidraw/
        diagramsnet
  - [ ] Attempt a bpmn render → friendly 503 message body (not a raw 502)
  - [ ] AI relay end-to-end with a `:free` model (use a real diagram prompt)
  - [ ] Simulate quota exhaustion → `free_quota_exhausted` UI state appears with
        the OpenRouter BYOK guidance and Settings button pre-filled with
        `https://openrouter.ai/api/v1`
  - [ ] Per-IP cap trip (31st request) → `per_ip_quota` UI state
  - [ ] BYOK flow with a fresh OpenRouter key: add key in AI Settings → send a
        prompt → DevTools Network confirms the request goes directly to
        `openrouter.ai`, not to the demo origin (key-privacy guarantee)
  - [ ] Confirm the privacy-toggle gotcha: a key from an account without the
        "training/logging" Privacy setting gets "No endpoints found…"; enabling
        the toggle fixes it
  - [ ] `docker inspect <demosite-container> | python3 -m json.tool | grep Memory`
        shows non-zero (resource limit applied)
  - [ ] `docker top <demosite-container>` shows gunicorn master + 2 workers
  - [ ] `docker compose logs demosite | tail -5` shows gunicorn access-log format
        (Apache-style lines ending with request seconds)
- [ ] Raise HSTS max-age to 31536000 one week after a stable launch:
      set `TLS_MODE=acme` stays, update the `Strict-Transport-Security` header
      value in the param block, `./setup-kroki-server.sh restart`
- [ ] Set up UptimeRobot monitor (§8) — do this last so it only monitors a
      genuinely live stack
