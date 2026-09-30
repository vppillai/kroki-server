#!/usr/bin/env bash
# Entrypoint for the TLS_MODE=acmevaultpki nginx image.
#
# Flow (mirrors the reference tt-topsheet-generator setup, adapted to kroki's
# port scheme and ECDSA-only cipher list):
#   1. Drop an ECDSA self-signed bootstrap cert so nginx can start immediately
#      (the rendered nginx.conf uses an ECDSA-only cipher list, so the bootstrap
#      cert MUST be ECDSA too — an RSA cert would fail every TLS handshake).
#   2. Register an ACME account against the Vault PKI directory.
#   3. Once nginx is serving the HTTP-01 listener (:8080), issue the real cert in
#      webroot mode, install it over the bootstrap cert, and reload nginx.
#   4. Run acme.sh --cron daily to renew (Vault-issued certs are short-lived).
#
# nginx.conf itself is rendered on the host by setup-kroki-server.sh and mounted
# read-only, so this entrypoint does no template/envsubst processing.
set -euo pipefail

: "${FQDN:?FQDN must be set (maps to HOSTNAME from .env)}"
: "${ACME_DIRECTORY_URL:?ACME_DIRECTORY_URL must be set}"
: "${ACME_CONTACT:?ACME_CONTACT must be set}"
ACME_KEY_LENGTH="${ACME_KEY_LENGTH:-ec-256}"

CERT_DIR=/etc/nginx/certs
WEBROOT=/acme/webroot
mkdir -p "${CERT_DIR}" "${WEBROOT}/.well-known/acme-challenge"

# acme.sh stores EC certs under <domain>_ecc; RSA under <domain>. --install-cert
# needs --ecc for EC keys to resolve the right path.
ECC_FLAG=""
case "${ACME_KEY_LENGTH}" in
  ec-*) ECC_FLAG="--ecc" ;;
esac

# 1. Bootstrap ECDSA self-signed cert (only if we don't already have one on the
#    persisted volume) so nginx starts and can serve the HTTP-01 challenge.
if [ ! -s "${CERT_DIR}/nginx.crt" ] || [ ! -s "${CERT_DIR}/nginx.key" ]; then
  echo "[entrypoint] No cert found — generating ECDSA self-signed bootstrap cert for ${FQDN}"
  openssl ecparam -name prime256v1 -genkey -noout -out "${CERT_DIR}/nginx.key"
  openssl req -new -x509 -key "${CERT_DIR}/nginx.key" \
    -out "${CERT_DIR}/nginx.crt" -days 1 -subj "/CN=${FQDN}" >/dev/null 2>&1
  chmod 600 "${CERT_DIR}/nginx.key"
fi

# 2. Register the ACME account with the Vault PKI directory (idempotent).
/acme/acme.sh --register-account \
  --server "${ACME_DIRECTORY_URL}" \
  --accountemail "${ACME_CONTACT}" || true

# 3 + 4. Issue/install the real cert and then renew forever, in the background.
(
  # Wait for nginx to start serving the HTTP-01 listener on :8080.
  for _ in $(seq 1 30); do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/ 2>/dev/null)" != "000" ]; then
      break
    fi
    sleep 1
  done

  if [ ! -f "/acme/${FQDN}_ecc/${FQDN}.cer" ] && [ ! -f "/acme/${FQDN}/${FQDN}.cer" ]; then
    echo "[entrypoint] Issuing certificate for ${FQDN} via ${ACME_DIRECTORY_URL}"
    if ! /acme/acme.sh --issue \
      --server "${ACME_DIRECTORY_URL}" \
      -d "${FQDN}" \
      --webroot "${WEBROOT}" \
      --keylength "${ACME_KEY_LENGTH}"; then
      echo "[entrypoint] Initial cert issuance failed — keeping bootstrap cert; will retry via cron"
      exit 0
    fi

    # shellcheck disable=SC2086
    /acme/acme.sh --install-cert -d "${FQDN}" ${ECC_FLAG} \
      --key-file       "${CERT_DIR}/nginx.key" \
      --fullchain-file "${CERT_DIR}/nginx.crt" \
      --reloadcmd      "nginx -s reload || true"
  fi

  # Daily renewal check. Webroot mode → no port conflict with nginx; --install-cert
  # ran above wires the reload so renewed certs are picked up automatically.
  while true; do
    sleep 86400
    /acme/acme.sh --cron --server "${ACME_DIRECTORY_URL}" || true
  done
) &

exec "$@"
