#!/bin/bash
# DocCode demo — hourly ops health checks and weekly image prune.
#
# Install via /etc/cron.d/doccode-ops (all logic is in this script;
# never put commands inline in the cron line — cron expands unescaped
# '%' as newline/stdin separators, silently breaking awk and printf):
#
#   sudo tee /etc/cron.d/doccode-ops << 'EOF'
#   # DocCode demo ops — hourly health + weekly image prune
#   0 * * * * root /opt/kroki-server/scripts/doccode-ops.sh
#   EOF
#
# Environment variables honoured (all optional):
#   OPS_ALERT_WEBHOOK   ntfy-compatible webhook URL (plain-text POST, Title header)
#
# The OPS_ALERT_WEBHOOK value is loaded from /opt/kroki-server/.env if present.
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
THRESHOLD_DISK=85
WEEKDAY_FOR_PRUNE=0   # 0 = Sunday (date +%w)

# ---------------------------------------------------------------------------
# Load .env for OPS_ALERT_WEBHOOK (and other env vars the .env may export).
# Unset bash's builtin HOSTNAME so the .env HOSTNAME= line takes effect.
# ---------------------------------------------------------------------------
unset HOSTNAME
# shellcheck source=/dev/null
if [ -f "${SCRIPT_DIR}/.env" ]; then
    set -a
    source "${SCRIPT_DIR}/.env"
    set +a
fi

# ---------------------------------------------------------------------------
# Alert helper — mirrors check-cert-expiry.sh pattern for consistency.
# ---------------------------------------------------------------------------
send_alert() {
    local msg="$1"
    logger -t doccode-ops "ALERT: ${msg}"
    if [ -n "${OPS_ALERT_WEBHOOK:-}" ]; then
        curl -fsS -m 10 \
            -H "Title: DocCode ops alert" \
            -d "${msg}" \
            "${OPS_ALERT_WEBHOOK}" || true
    fi
    echo "ALERT: ${msg}" >&2
}

# ---------------------------------------------------------------------------
# 1. Disk usage check (root filesystem).
# ---------------------------------------------------------------------------
DISK_USED="$(df -P / | awk 'NR==2{print int($5)}')"
if [ "${DISK_USED}" -ge "${THRESHOLD_DISK}" ]; then
    send_alert "DocCode demo: disk ${DISK_USED}% used (threshold ${THRESHOLD_DISK}%)"
fi

# ---------------------------------------------------------------------------
# 2. Unhealthy / restarting container check.
# ---------------------------------------------------------------------------
UNHEALTHY="$(docker ps --filter health=unhealthy --format '{{.Names}}' 2>/dev/null | tr '\n' ' ' | sed 's/ $//')"
RESTARTING="$(docker ps --filter status=restarting --format '{{.Names}}' 2>/dev/null | tr '\n' ' ' | sed 's/ $//')"

if [ -n "${UNHEALTHY}" ]; then
    send_alert "DocCode demo: unhealthy containers: ${UNHEALTHY}"
fi
if [ -n "${RESTARTING}" ]; then
    send_alert "DocCode demo: restarting containers: ${RESTARTING}"
fi

# ---------------------------------------------------------------------------
# 3. Weekly docker image prune (gate by weekday inside this script).
#    Per-restart demosite builds accumulate dangling images; prune weekly.
#    --filter until=168h = older than 7 days (avoids removing very recent images).
# ---------------------------------------------------------------------------
CURRENT_WEEKDAY="$(date +%w)"
if [ "${CURRENT_WEEKDAY}" -eq "${WEEKDAY_FOR_PRUNE}" ]; then
    docker image prune -af --filter "until=168h" > /dev/null 2>&1 || true
fi
