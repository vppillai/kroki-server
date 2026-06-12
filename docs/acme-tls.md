# Real TLS with Let's Encrypt (TLS_MODE=acme)

Add four lines to your `.env` to switch from the self-signed default to a real
Let's Encrypt certificate:

```bash
HOSTNAME=demo.example.com   # your public DNS name
HTTPS_PORT=443
TLS_MODE=acme
ACME_EMAIL=ops@example.com  # Let's Encrypt expiry notices
```

## Prerequisites checklist

Before running `./setup-kroki-server.sh start` in acme mode, verify:

1. **DNS A record** — `dig +short A demo.example.com` returns your box's public
   IPv4. If an AAAA record exists it **must** also point at this box (Let's
   Encrypt prefers IPv6 and will use it if present).
2. **Ports open** — host ports 80 and 443 are open in your cloud
   firewall/security group and not held by another service:
   `sudo ss -ltnp 'sport = :80 or sport = :443'` should show nothing (or only
   Docker's proxy process after the stack starts).
3. **No blocking CAA record** — `dig +short CAA example.com` is empty **or**
   includes `0 issue "letsencrypt.org"`.
4. **`.env` has a literal `HOSTNAME=` line** — acme mode reads HOSTNAME by
   parsing `.env` directly (the bash shell builtin `HOSTNAME` is always set to
   the machine hostname and is deliberately ignored).

## Staging-first procedure (strongly recommended)

Let's Encrypt staging has no rate limits; production has 5 duplicate-name certs
per week. **Always test with staging before going to production.**

```bash
# 1. Add to .env:
ACME_STAGING=1

# 2. Issue the staging cert and start the stack:
./setup-kroki-server.sh start

# 3. Verify the cert is from the STAGING CA:
curl -vk https://demo.example.com/ 2>&1 | grep -i "issuer"
# Expect: "(STAGING)" in the issuer string

# 4. Tear down staging cert and re-issue for production:
rm -rf ./letsencrypt
# Remove or comment out ACME_STAGING from .env
./setup-kroki-server.sh restart
```

## Let's Encrypt rate limits

| Limit | Value |
|-------|-------|
| Duplicate certs (same name set) | 5 per week |
| Failed validation attempts | 5 per account+hostname per hour |
| New orders per account | ~300 per 3 hours |

`./setup-kroki-server.sh clean` **deliberately preserves `./letsencrypt`** to
avoid burning the duplicate-cert quota on repeated clean+start cycles.

**WARNING:** never run `git clean -xdf` in the production checkout — it deletes
`./letsencrypt` (and `.env`) alongside other untracked files. Use
`git clean -xdf --exclude=letsencrypt --exclude=.env` if you must clean.

## Renewal mechanics

Renewal is fully automatic via three overlapping mechanisms:

1. **Certbot sidecar** (`docker-compose.acme.yml`): runs `certbot renew` every
   12 hours. Certbot renews when the cert has <30 days remaining.
2. **nginx graceful reload** (overlay `command`): runs `nginx -s reload` every
   6 hours, picking up the renewed cert without any downtime.
3. **Daily cron backstop** (`scripts/check-cert-expiry.sh`): alerts at <21 days
   remaining, giving ~9 days to intervene if both of the above have been failing.

Install the cron backstop as root (letsencrypt directories are 0700 root-only):

```bash
sudo crontab -e
# Add:
0 9 * * * /opt/kroki-server/scripts/check-cert-expiry.sh
```

Optional alert webhook (ntfy-compatible, e.g. `https://ntfy.sh/your-topic`):

```bash
CERT_ALERT_WEBHOOK=https://ntfy.sh/your-topic   # in .env
```

## Rollback: acme → selfsigned

If you need to revert to self-signed:

1. Change `TLS_MODE=acme` to `TLS_MODE=selfsigned` in `.env`
2. `./setup-kroki-server.sh restart`

**HSTS caveat:** acme mode emits `Strict-Transport-Security: max-age=86400`.
Browsers that received this header will refuse HTTP connections to your hostname
for up to 24 hours after rollback. The 86400 (1 day) initial value is deliberate
rollback safety — raise it to `max-age=31536000` in the NGINX_SECURITY_HEADERS
fragment a week after a successful public launch.

## Switching TLS_MODE on a running stack

Always stop the stack before switching `TLS_MODE` between `acme` and
`selfsigned`:

```bash
./setup-kroki-server.sh stop
# edit TLS_MODE in .env
./setup-kroki-server.sh start
```

Switching while the stack is running leaves the certbot container as an orphan
(compose only warns). The `--remove-orphans` flag in `restart` and `stop` cleans
these up automatically.
