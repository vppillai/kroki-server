#!/bin/bash
# Daily cron backstop: alert when the Let's Encrypt certificate is <21 days from
# expiry. Certbot renews at <30 days, so firing means renewal has been failing
# for ~9 days — enough lead time to intervene before the cert expires.
#
# Install on the public box (must run as root — letsencrypt/live/ is 0700 root):
#   sudo crontab -e
#   0 9 * * * /opt/kroki-server/scripts/check-cert-expiry.sh
#
# Optional webhook (ntfy-compatible, plain-text POST with a Title header):
#   Add CERT_ALERT_WEBHOOK=https://ntfy.sh/your-topic to /opt/kroki-server/.env
#
# Environment variables honoured (all optional except HOSTNAME in .env):
#   CERT_ALERT_DAYS    Days threshold for the warning (default: 21)
#   CERT_ALERT_WEBHOOK Webhook URL to POST alerts to (ntfy-compatible)
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Load .env — but do NOT rely on the bash builtin HOSTNAME (bash always sets
# HOSTNAME to the machine hostname, which silently bypasses any .env value).
# Unset the builtin before sourcing so the .env HOSTNAME= line takes effect.
unset HOSTNAME
# shellcheck source=/dev/null
if [ -f "${SCRIPT_DIR}/.env" ]; then
    set -a
    source "${SCRIPT_DIR}/.env"
    set +a
fi

# Read HOSTNAME strictly from the .env file via grep (never from the environment)
# so a missing .env HOSTNAME= line is a config error, not a silent machine-name lookup.
if [ ! -f "${SCRIPT_DIR}/.env" ]; then
    echo "ERROR: .env not found at ${SCRIPT_DIR}/.env" >&2
    exit 1
fi

ENV_HOSTNAME="$(grep '^HOSTNAME=' "${SCRIPT_DIR}/.env" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
if [ -z "${ENV_HOSTNAME}" ]; then
    echo "ERROR: HOSTNAME is not set in ${SCRIPT_DIR}/.env — cannot locate certificate." >&2
    exit 1
fi

DOMAIN="${ENV_HOSTNAME}"
CERT="${SCRIPT_DIR}/letsencrypt/live/${DOMAIN}/fullchain.pem"
THRESHOLD_DAYS="${CERT_ALERT_DAYS:-21}"

fail() {
    local msg="$1"
    logger -t doccode-cert "ALERT: ${msg}"
    if [ -n "${CERT_ALERT_WEBHOOK:-}" ]; then
        curl -fsS -m 10 \
            -H "Title: DocCode TLS Alert (${DOMAIN})" \
            -d "DocCode TLS alert (${DOMAIN}): ${msg}" \
            "${CERT_ALERT_WEBHOOK}" || true
    fi
    echo "ALERT: ${msg}" >&2
    exit 1
}

if [ ! -f "${CERT}" ]; then
    fail "certificate file missing: ${CERT}"
fi

if ! openssl x509 -checkend "$((THRESHOLD_DAYS * 86400))" -noout -in "${CERT}"; then
    fail "certificate expires within ${THRESHOLD_DAYS} days — renewal is failing (check 'docker compose logs certbot' and that port 80 is reachable from the internet)"
fi

echo "OK: ${DOMAIN} cert valid for >${THRESHOLD_DAYS} days"
