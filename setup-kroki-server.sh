#!/bin/bash
set -e  # Exit on error

# Set container names and paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="${SCRIPT_DIR}/nginx-certs"
NGINX_CONF="${SCRIPT_DIR}/nginx.conf"
DOCKER_COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"

# Default configuration
CUSTOM_CERT_KEY=""
CUSTOM_CERT_CRT=""

# Load environment variables
# Function to display help message (removed duplicate - using detailed version below)

# Bootstrap .env from the example on first run. .env is intentionally untracked
# (it holds secrets) but docker-compose requires it, so fresh clones / CI need a
# copy. Edit the created .env to add your AI_PROXY_API_KEY.
if [ ! -f "${SCRIPT_DIR}/.env" ] && [ -f "${SCRIPT_DIR}/.env.example" ]; then
    echo "No .env found — creating one from .env.example. Edit it to add your AI_PROXY_API_KEY."
    cp "${SCRIPT_DIR}/.env.example" "${SCRIPT_DIR}/.env"
fi

# Load configuration from .env file if it exists
if [ -f "${SCRIPT_DIR}/.env" ]; then
    set -a
    # shellcheck source=/dev/null
    source "${SCRIPT_DIR}/.env"
    set +a
    echo "Loaded configuration from .env file"
    DEFAULT_HTTP_PORT="${HTTP_PORT:-8000}"
    DEFAULT_HTTPS_PORT="${HTTPS_PORT:-8443}"
    DEFAULT_HOSTNAME="${HOSTNAME:-localhost}"
else
    DEFAULT_HOSTNAME="localhost"
    DEFAULT_HTTP_PORT="8000"
    DEFAULT_HTTPS_PORT="8443"
    DEMOSITE_CONTAINER_PORT="8006"
    echo "No .env file found, using default configuration"
fi

# ---------------------------------------------------------------------------
# Deployment parameter block — ONE insertion point for all future params.
# This block runs unconditionally after .env loading (never inside a branch).
# Future PRs add their params here in the order listed below.
# ---------------------------------------------------------------------------

# Compose profiles: non-colon form is deliberate — empty string (COMPOSE_PROFILES="")
# means "core stack only" and must be distinguishable from unset.
# PR-4 (compose-footprint) enables the companions profile by default.
export COMPOSE_PROFILES="${COMPOSE_PROFILES-companions}"

# TLS mode: selfsigned (default, closed-network) or acme (PR-7).
TLS_MODE="${TLS_MODE:-selfsigned}"

# ACME/Let's Encrypt paths and options (only used when TLS_MODE=acme).
LETSENCRYPT_DIR="${SCRIPT_DIR}/letsencrypt"
CERTBOT_WEBROOT_DIR="${SCRIPT_DIR}/certbot-webroot"
ACME_HTTP_PORT="${ACME_HTTP_PORT:-80}"

# Deployment profile: private (default, closed-network) or public (PR-5).
DEPLOY_PROFILE="${DEPLOY_PROFILE:-private}"

# Draw.io embed origin for the CSP frame-src directive, derived from the
# deployment's DRAWIO_SERVER_URL so custom draw.io servers keep working.
DRAWIO_ORIGIN=$(echo "${DRAWIO_SERVER_URL:-https://embed.diagrams.net/}" | sed -E 's#^(https?://[^/]+).*#\1#')

# SHA-256 of the inline import map's exact text content in demoSite/index.html.
# Inline import maps are CSP script elements: without this hash (or
# 'unsafe-inline'), script-src 'self' blocks the import map and the editor
# fails to load. The hash is whitespace-exact; tests/cspImportmapHash.test.js
# recomputes it from index.html and fails CI on drift.
IMPORTMAP_SHA256="sha256-LvNDiZbbhmyHUBohi9wADi3l/thqDrW+o+NEgB+bZVY="

# NGINX_SECURITY_HEADERS — baseline security headers + CSP.
# Rule: emitted at http level AND must be restated verbatim inside every
# location that declares its own add_header (nginx cancels http-level
# add_header inheritance per location). Never add a bare add_header in a
# location — always include ${NGINX_SECURITY_HEADERS} alongside it.
# CSP notes: script-src is the key-theft guard (same-origin + the import-map
# hash only); connect-src 'self' https: deliberately allows BYOK posts to any
# HTTPS endpoint; frame-src allows the configured draw.io embed.
NGINX_SECURITY_HEADERS="    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection \"1; mode=block\";
    add_header X-Frame-Options SAMEORIGIN;
    add_header Content-Security-Policy \"default-src 'self'; script-src 'self' '${IMPORTMAP_SHA256}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https:; frame-src 'self' ${DRAWIO_ORIGIN}; object-src 'none'; base-uri 'self'; frame-ancestors 'self'\" always;"
# ACME mode: append HSTS to the shared fragment so it is inherited everywhere
# (http-level add_header is inherited only when a location/server defines none;
# the shared fragment is restated inside every location that adds its own
# add_header, so HSTS is covered everywhere in acme mode). Initial max-age=86400
# (1 day) for rollback safety — raise to 31536000 a week after launch.
if [ "$TLS_MODE" = "acme" ]; then
    NGINX_SECURITY_HEADERS="${NGINX_SECURITY_HEADERS}
    add_header Strict-Transport-Security \"max-age=86400\" always;"
fi

# --- Render-plane profile: cache + abuse limits (PR-6) ----------------------
# DEPLOY_PROFILE=private (default): behavior-preserving for closed networks —
#   zones are always emitted but NO per-location limit_req/limit_conn directives,
#   so batch pipelines and CI runners are never 429'd. Body 10m, timeouts 300s.
# DEPLOY_PROFILE=public: strict limits for an internet-facing instance.
#   10r/s burst 30, conn 20, body 1m, timeouts 30s.
# Every value is individually overridable via env (RENDER_RATE, RENDER_BURST, …).
if [ "$DEPLOY_PROFILE" = "public" ]; then
    RENDER_RATE="${RENDER_RATE:-10r/s}"
    RENDER_BURST="${RENDER_BURST:-30}"
    RENDER_CONN_LIMIT="${RENDER_CONN_LIMIT:-20}"
    RENDER_BODY_LIMIT="${RENDER_BODY_LIMIT:-1m}"
    RENDER_TIMEOUT="${RENDER_TIMEOUT:-30}"
    RENDER_CONNECT_TIMEOUT="${RENDER_CONNECT_TIMEOUT:-10}"
    # Under public profile, emit per-location limit directives.
    NGINX_RENDER_LIMITS="            limit_req zone=render_req burst=${RENDER_BURST} nodelay;
            limit_conn render_conn ${RENDER_CONN_LIMIT};"
else
    RENDER_RATE="${RENDER_RATE:-100r/s}"
    RENDER_BURST="${RENDER_BURST:-200}"
    RENDER_CONN_LIMIT="${RENDER_CONN_LIMIT:-100}"
    RENDER_BODY_LIMIT="${RENDER_BODY_LIMIT:-10m}"
    RENDER_TIMEOUT="${RENDER_TIMEOUT:-300}"
    RENDER_CONNECT_TIMEOUT="${RENDER_CONNECT_TIMEOUT:-300}"
    # Under private profile, zones exist but directives are omitted — no behavior change.
    NGINX_RENDER_LIMITS=""
fi

RENDER_CACHE_ENABLED="${RENDER_CACHE_ENABLED:-true}"
RENDER_CACHE_MAX_SIZE="${RENDER_CACHE_MAX_SIZE:-500m}"
RENDER_CACHE_TTL="${RENDER_CACHE_TTL:-24h}"
RENDER_CACHE_INACTIVE="${RENDER_CACHE_INACTIVE:-7d}"

if [ "$RENDER_CACHE_ENABLED" = "true" ]; then
    NGINX_CACHE_PATH_BLOCK="
    # Render cache: GET /<type>/<format>/<encoded> is a pure function of the URL.
    # Worst case after a core image upgrade: RENDER_CACHE_TTL (${RENDER_CACHE_TTL}) of
    # old-renderer output. Flush with: docker compose down && docker volume rm <proj>_nginx_cache
    proxy_cache_path /var/cache/nginx/kroki levels=1:2 keys_zone=kroki_render:10m
                     max_size=${RENDER_CACHE_MAX_SIZE} inactive=${RENDER_CACHE_INACTIVE} use_temp_path=off;"
    # add_header in a location cancels http-level add_header inheritance (nginx
    # documented behaviour). The security headers MUST be restated here alongside
    # X-Cache-Status — never add a lone add_header without the full set.
    # Use a heredoc to avoid quote-collision with NGINX_SECURITY_HEADERS content.
    NGINX_CACHE_LOCATION_BLOCK=$(cat <<CACHE_BLOCK

            proxy_cache kroki_render;
            # \$request_method in the key guards against future proxy_cache_convert_head off
            # configs where a HEAD could land as a separate cache entry.
            proxy_cache_key "\$request_method\$request_uri";
            proxy_ignore_headers Cache-Control Expires;
            proxy_cache_valid 200 ${RENDER_CACHE_TTL};
            proxy_cache_valid 400 404 1m;
            proxy_cache_lock on;
            proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
            # Restate security headers: add_header in this location cancels http-level inheritance.
${NGINX_SECURITY_HEADERS}
            add_header X-Cache-Status \$upstream_cache_status always;
CACHE_BLOCK
)
else
    NGINX_CACHE_PATH_BLOCK=""
    NGINX_CACHE_LOCATION_BLOCK=""
fi
# ---------------------------------------------------------------------------

# Check if docker is installed
check_dependencies() {
    echo "Checking dependencies..."
    if ! command -v docker &> /dev/null; then
        echo "Error: Docker is not installed. Please install Docker first."
        exit 1
    fi

    # Prefer Docker Compose v2 plugin; enforce >= 2.24.0 (required for
    # --profile '*', overlay merge, and deploy.resources.limits used in
    # later PRs). Legacy v1 docker-compose is not supported — a clear
    # actionable error is shown instead of a silent fallback.
    if docker compose version &> /dev/null 2>&1; then
        _compose_version=$(docker compose version --short 2>/dev/null || docker compose version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        _compose_version="${_compose_version#v}"  # some builds emit a leading 'v'
        _major=$(echo "$_compose_version" | cut -d. -f1)
        _minor=$(echo "$_compose_version" | cut -d. -f2)
        if [ "$_major" -gt 2 ] || { [ "$_major" -eq 2 ] && [ "$_minor" -ge 24 ]; }; then
            DOCKER_COMPOSE="docker compose"
            echo "Using: docker compose v${_compose_version}"
        else
            echo "Error: docker compose v${_compose_version} is too old."
            echo "  Upgrade to Docker Compose >= 2.24.0 (needed for --profile '*',"
            echo "  overlay merge, and deploy.resources.limits)."
            echo "  See: https://docs.docker.com/compose/install/"
            exit 1
        fi
    elif command -v docker-compose &> /dev/null; then
        echo "Error: Legacy docker-compose v1 is not supported."
        echo "  Install the Docker Compose v2 plugin (>= 2.24.0) instead."
        echo "  See: https://docs.docker.com/compose/install/"
        exit 1
    else
        echo "Error: Docker Compose not found. Please install Docker Compose >= 2.24.0."
        echo "  See: https://docs.docker.com/compose/install/"
        exit 1
    fi

    # DOCKER_COMPOSE always carries its -f file list so every subcommand
    # (start/stop/restart/clean/logs/status) sees the same file set.
    DOCKER_COMPOSE="$DOCKER_COMPOSE -f $DOCKER_COMPOSE_FILE"
    if [ "$TLS_MODE" = "acme" ]; then
        DOCKER_COMPOSE="$DOCKER_COMPOSE -f ${SCRIPT_DIR}/docker-compose.acme.yml"
    fi
}

# Function to generate ECDSA self-signed SSL certs or use existing ones
generate_certs() {
    echo "Checking SSL certificates..."
    if [ ! -d "$CERTS_DIR" ]; then
        mkdir -p "$CERTS_DIR"
        echo "Created certificates directory: $CERTS_DIR"
    fi

    # If custom certificates were provided, use them
    if [ -n "$CUSTOM_CERT_KEY" ] && [ -n "$CUSTOM_CERT_CRT" ]; then
        if [ -f "$CUSTOM_CERT_KEY" ] && [ -f "$CUSTOM_CERT_CRT" ]; then
            echo "Using provided SSL certificates"
            cp "$CUSTOM_CERT_KEY" "$CERTS_DIR/nginx.key"
            cp "$CUSTOM_CERT_CRT" "$CERTS_DIR/nginx.crt"
            # Set proper permissions for private key
            chmod 600 "$CERTS_DIR/nginx.key"
            return 0
        else
            echo "Warning: Specified certificate files not found. Falling back to self-signed certificates."
        fi
    fi

    # Generate self-signed certificate if needed
    if [ ! -f "$CERTS_DIR/nginx.crt" ]; then
        echo "Generating ECDSA self-signed SSL certificate..."
        # Use the first hostname as CN, ensure it doesn't exceed 64 chars
        local cert_cn="${DEFAULT_HOSTNAME}"
        if [ ${#cert_cn} -gt 64 ]; then
            cert_cn="${cert_cn:0:64}"
            echo "Warning: Hostname too long, truncating CN to 64 characters."
        fi
        # Generate the private key using ECDSA
        openssl ecparam -name prime256v1 -genkey -noout -out "$CERTS_DIR/nginx.key"
        chmod 600 "$CERTS_DIR/nginx.key"
        # Generate the self-signed certificate with CN that doesn't exceed 64 chars
        openssl req -new -key "$CERTS_DIR/nginx.key" -out "$CERTS_DIR/nginx.csr" -subj "/CN=${cert_cn}"
        openssl x509 -req -days 365 -in "$CERTS_DIR/nginx.csr" -signkey "$CERTS_DIR/nginx.key" -out "$CERTS_DIR/nginx.crt"
        rm "$CERTS_DIR/nginx.csr"  # Clean up CSR file
        echo "SSL certificate generated successfully."
    else
        echo "SSL certificate already exists."
    fi
}

# Validate ACME configuration: called from start/restart when TLS_MODE=acme.
# Requirements: literal ^HOSTNAME= in .env (never trust bash builtin HOSTNAME —
# bash sets it unconditionally to the machine hostname); HOSTNAME must be a
# public FQDN (not localhost, not dotless); ACME_EMAIL must be set.
validate_acme_config() {
    # Require a literal HOSTNAME= line in .env — the bash builtin can shadow it
    if [ ! -f "${SCRIPT_DIR}/.env" ] || ! grep -q '^HOSTNAME=' "${SCRIPT_DIR}/.env"; then
        echo "Error: TLS_MODE=acme requires HOSTNAME to be set explicitly in .env (not just the shell environment)."
        echo "  Add a line like: HOSTNAME=demo.example.com"
        exit 1
    fi
    if [ "${DEFAULT_HOSTNAME}" = "localhost" ] || ! echo "${DEFAULT_HOSTNAME}" | grep -q '\.'; then
        echo "Error: TLS_MODE=acme requires HOSTNAME to be a public DNS name (got '${DEFAULT_HOSTNAME}')."
        echo "  HOSTNAME must contain at least one dot and must not be 'localhost'."
        exit 1
    fi
    if [ -z "${ACME_EMAIL:-}" ]; then
        echo "Error: TLS_MODE=acme requires ACME_EMAIL to be set in .env."
        exit 1
    fi
    if [ "${DEFAULT_HTTPS_PORT}" != "443" ]; then
        echo "Warning: TLS_MODE=acme expects HTTPS_PORT=443 for public ACME; the HTTP->HTTPS redirect assumes the standard port."
        echo "  Current HTTPS_PORT=${DEFAULT_HTTPS_PORT}. Proceeding, but browsers may not hit the redirect correctly."
    fi
}

# Issue a Let's Encrypt certificate via certbot standalone (first issuance only).
# Skipped when the certificate already exists (avoid hitting LE duplicate-cert limits).
# ECDSA key type is mandatory: the nginx cipher list is ECDSA-only (ECDHE-ECDSA-*);
# an RSA cert would fail every TLS handshake.
ensure_acme_cert() {
    mkdir -p "$LETSENCRYPT_DIR" "$CERTBOT_WEBROOT_DIR"
    if [ -f "${LETSENCRYPT_DIR}/live/${DEFAULT_HOSTNAME}/fullchain.pem" ]; then
        echo "ACME certificate for ${DEFAULT_HOSTNAME} already present — skipping issuance."
        return 0
    fi
    echo "Issuing Let's Encrypt certificate for ${DEFAULT_HOSTNAME} (standalone, host port ${ACME_HTTP_PORT})..."
    echo "  Note: nginx cannot start until the cert exists; certbot binds port ${ACME_HTTP_PORT} directly."
    # Stop our own nginx if it is already running so certbot can bind the port
    $DOCKER_COMPOSE stop nginx >/dev/null 2>&1 || true
    local staging_flag=""
    if [ -n "${ACME_STAGING:-}" ] && [ "${ACME_STAGING}" != "0" ]; then
        staging_flag="--staging"
        echo "  ACME_STAGING=1 — using Let's Encrypt STAGING CA (untrusted cert, generous limits)."
    fi
    docker run --rm -p "${ACME_HTTP_PORT}:80" \
        -v "${LETSENCRYPT_DIR}:/etc/letsencrypt" \
        -v "${CERTBOT_WEBROOT_DIR}:/var/www/certbot" \
        certbot/certbot:v4.0.0 certonly --standalone \
        --key-type ecdsa --elliptic-curve secp256r1 \
        -d "${DEFAULT_HOSTNAME}" \
        --email "${ACME_EMAIL}" \
        --agree-tos --no-eff-email --non-interactive \
        ${staging_flag}
    echo "Certificate issued successfully."
}

# Function to build demo site
build_demo_site() {
    echo "Building demo site container..."
    if [ ! -d "${SCRIPT_DIR}/demoSite" ]; then
        echo "Error: demoSite directory not found. Are you in the correct directory?"
        exit 1
    fi

    cd "${SCRIPT_DIR}/demoSite" || exit 1
    if docker build -t kroki-demosite:latest -f Dockerfile .; then
        echo "Demo site container built successfully."
    else
        echo "Error: Failed to build demo site container."
        exit 1
    fi
    cd "${SCRIPT_DIR}" || exit 1
}

# Ensure the Kroki "core" image (built from main, includes GoAT) is available.
# Prefers pulling the published GHCR image; falls back to a one-time local build.
ensure_kroki_core() {
    local img="${KROKI_CORE_IMAGE:-ghcr.io/vppillai/kroki-core:goat}"
    if docker image inspect "$img" >/dev/null 2>&1; then
        return 0
    fi
    echo "Kroki core image '$img' not present locally; attempting to pull..."
    if docker pull "$img" >/dev/null 2>&1; then
        echo "Pulled $img"
        return 0
    fi
    echo "Pull failed for '$img'."
    # CI / constrained environments can set KROKI_SKIP_CORE_BUILD=1 (and usually
    # KROKI_CORE_IMAGE to a stock pullable core) to avoid the heavy source build.
    if [ -n "${KROKI_SKIP_CORE_BUILD:-}" ]; then
        echo "Error: core image unavailable and KROKI_SKIP_CORE_BUILD is set."
        exit 1
    fi
    echo "Building Kroki core from source (one-time, ~15-30 min)..."
    if "${SCRIPT_DIR}/build-kroki-core.sh"; then
        echo "Kroki core image built."
    else
        echo "Error: failed to build Kroki core image (see output above)."
        exit 1
    fi
}

# Function to create Nginx config
create_nginx_config() {
    echo "Creating Nginx configuration..."
    # Compute TLS-mode-dependent locals BEFORE the heredoc.
    # In acme mode: cert paths point into ./letsencrypt/live/<hostname>/;
    # the ACME_HTTP_SERVER fragment adds the :8080 HTTP-01 challenge listener.
    # In selfsigned mode: paths and fragment are identical to main's output
    # (byte-for-byte regression guarantee).
    local ssl_cert="/etc/nginx/certs/nginx.crt"
    local ssl_key="/etc/nginx/certs/nginx.key"
    local acme_http_server=""
    if [ "$TLS_MODE" = "acme" ]; then
        ssl_cert="/etc/letsencrypt/live/${DEFAULT_HOSTNAME}/fullchain.pem"
        ssl_key="/etc/letsencrypt/live/${DEFAULT_HOSTNAME}/privkey.pem"
        # Note: \$host and \$request_uri below are nginx runtime variables;
        # they are escaped here so they pass through the heredoc unexpanded
        # and reach nginx.conf as literal $host / $request_uri.
        acme_http_server="
    # ACME HTTP-01 challenge listener + HTTP->HTTPS redirect.
    # Certbot renewal webroot requests are served from /var/www/certbot
    # (mounted from ./certbot-webroot by docker-compose.acme.yml).
    server {
        listen 0.0.0.0:8080;
        server_name ${DEFAULT_HOSTNAME};

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://\$host\$request_uri;
        }
    }
"
    fi
    cat > "$NGINX_CONF" <<EOF
events {
    worker_connections 1024;
}

http {
    # Include basic MIME types
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Performance settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    client_max_body_size 10M;  # Allow larger diagram requests
${NGINX_CACHE_PATH_BLOCK}
    # Per-IP abuse limits on render routes; values chosen by DEPLOY_PROFILE.
    # Zones always emitted (both profiles); per-location directives only under public.
    # 10m zone ≈ tens of thousands of tracked client IPs.
    limit_req_zone \$binary_remote_addr zone=render_req:10m rate=${RENDER_RATE};
    limit_conn_zone \$binary_remote_addr zone=render_conn:10m;
    limit_req_status 429;
    limit_conn_status 429;
    limit_req_log_level warn;

    # Security headers
${NGINX_SECURITY_HEADERS}

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384';
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
EOF
    # Conditionally inject the ACME HTTP-01 server block BEFORE the HTTPS server.
    # In selfsigned mode acme_http_server is empty and nothing is appended here,
    # preserving byte-identical output with the pre-acme baseline.
    if [ -n "$acme_http_server" ]; then
        printf '%s' "$acme_http_server" >> "$NGINX_CONF"
    fi
    cat >> "$NGINX_CONF" <<EOF

    server {
        listen 0.0.0.0:8443 ssl;
        server_name ${DEFAULT_HOSTNAME};

        ssl_certificate ${ssl_cert};
        ssl_certificate_key ${ssl_key};

        # Root path (serves the demo site index)
        location = / {
            proxy_pass http://demosite:${DEMOSITE_CONTAINER_PORT}/index.html;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }

        # Static resources in static directories
        location ~* ^/(css|js|examples)/ {
            proxy_pass http://demosite:${DEMOSITE_CONTAINER_PORT}\$uri;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;

            # Revalidate via ETag instead of hard-caching. These assets are
            # un-versioned (no content hash in the filename), so a 1-day cache
            # meant deploys didn't reach returning users. "expires -1" emits
            # Cache-Control: no-cache -> the browser revalidates and gets a fast
            # 304 when unchanged, but always picks up a changed asset next load.
            expires -1;
        }

        # Static files at root level
        location ~* ^/[^/]+\.(html|ico|svg|png|jpg|jpeg|gif)$ {
            proxy_pass http://demosite:${DEMOSITE_CONTAINER_PORT}\$uri;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;

            # Revalidate via ETag instead of hard-caching. These assets are
            # un-versioned (no content hash in the filename), so a 1-day cache
            # meant deploys didn't reach returning users. "expires -1" emits
            # Cache-Control: no-cache -> the browser revalidates and gets a fast
            # 304 when unchanged, but always picks up a changed asset next load.
            expires -1;
        }

        # Demo site API endpoints (must come before Kroki patterns)
        location /api/ {
            proxy_pass http://demosite:${DEMOSITE_CONTAINER_PORT};
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;

            # AI responses stream as SSE: disable buffering so tokens reach the
            # browser as they arrive, and allow long-running completions.
            proxy_buffering off;
            proxy_cache off;
            proxy_read_timeout 300;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
        }

        # Kroki API POST requests (diagram-type/format) - exclude /api/ paths
        # POST render path: limits/timeouts only; NEVER proxy_cache (POST not idempotent).
        location ~* ^/(?!api/)([^/]+)/([^/]+)$ {
            limit_except GET POST {
                deny all;
            }
${NGINX_RENDER_LIMITS}
            client_max_body_size ${RENDER_BODY_LIMIT};
            proxy_pass http://core:${DEFAULT_HTTP_PORT};
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_connect_timeout ${RENDER_CONNECT_TIMEOUT};
            proxy_send_timeout ${RENDER_TIMEOUT};
            proxy_read_timeout ${RENDER_TIMEOUT};
        }

        # Match Kroki API pattern (diagram-type/format/encoded-diagram) - exclude /api/ paths
        # GET render path: cached (when RENDER_CACHE_ENABLED=true). limit_req runs in
        # the preaccess phase, so cache HITs also count against the per-IP rate (desired).
        location ~* ^/(?!api/)[^/]+/[^/]+/[^/]+$ {
${NGINX_RENDER_LIMITS}
            client_max_body_size ${RENDER_BODY_LIMIT};
            proxy_pass http://core:${DEFAULT_HTTP_PORT};
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_connect_timeout ${RENDER_CONNECT_TIMEOUT};
            proxy_send_timeout ${RENDER_TIMEOUT};
            proxy_read_timeout ${RENDER_TIMEOUT};
${NGINX_CACHE_LOCATION_BLOCK}
        }

        # Fallback for any other paths
        location / {
            proxy_pass http://demosite:${DEMOSITE_CONTAINER_PORT};
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }
    }
}
EOF
    echo "Nginx configuration created."
}

# Function to check if services are running
check_services() {
    local max_attempts=30
    local attempt=1
    local sleep_time=2

    echo "Checking if services are up and running..."
    while [ $attempt -le $max_attempts ]; do
        if curl -k -s -o /dev/null -w "%{http_code}" "https://${DEFAULT_HOSTNAME}:${DEFAULT_HTTPS_PORT}" | grep -q "200"; then
            echo "Services are up and running!"
            return 0
        fi
        echo "Waiting for services to start - attempt $attempt of $max_attempts..."
        sleep $sleep_time
        attempt=$((attempt + 1))
    done

    # Hairpin-NAT fallback for acme mode: some cloud providers do not loop the
    # public IP back to the same host (no hairpin/NAT loopback). If the public
    # hostname check failed, retry via 127.0.0.1 with --resolve so TLS SNI
    # still matches the real hostname.
    if [ "$TLS_MODE" = "acme" ]; then
        echo "Public hostname check failed — trying hairpin-NAT fallback via 127.0.0.1..."
        if curl -k -s -o /dev/null -w "%{http_code}" \
            --resolve "${DEFAULT_HOSTNAME}:${DEFAULT_HTTPS_PORT}:127.0.0.1" \
            "https://${DEFAULT_HOSTNAME}:${DEFAULT_HTTPS_PORT}" | grep -q "200"; then
            echo "Services are up and running (reachable via 127.0.0.1 — hairpin-NAT not available on this host)!"
            return 0
        fi
    fi

    echo "Error: Services did not start properly. Check logs with '$0 logs'"
    return 1
}

# Function to perform comprehensive health check on all host/port combinations
health_check_all() {
    echo "Performing comprehensive health check on all configured endpoints..."
    local total_tests=0
    local successful_tests=0

    # Define arrays for hostnames and ports
    local HOSTNAMES=("${DEFAULT_HOSTNAME:-localhost}")
    local HTTPS_PORTS=("${DEFAULT_HTTPS_PORT:-8443}")

    for hostname in "${HOSTNAMES[@]}"; do
        for https_port in "${HTTPS_PORTS[@]}"; do
            total_tests=$((total_tests + 1))
            echo -n "Testing https://${hostname}:${https_port}... "

            if curl -k -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "https://${hostname}:${https_port}" | grep -q "200"; then
                echo "✓ OK"
                successful_tests=$((successful_tests + 1))
            else
                echo "✗ FAILED"
            fi
        done
    done

    echo ""
    echo "Health Check Summary:"
    echo "  Total endpoints tested: ${total_tests}"
    echo "  Successful: ${successful_tests}"
    echo "  Failed: $((total_tests - successful_tests))"

    if [ $successful_tests -eq $total_tests ]; then
        echo "  Status: All endpoints are healthy ✓"
        return 0
    else
        echo "  Status: Some endpoints failed ✗"
        return 1
    fi
}

# Function to check AI model loading status from demosite container
check_ai_models() {
    local container_name
    container_name=$($DOCKER_COMPOSE ps -q demosite 2>/dev/null)
    if [ -z "$container_name" ]; then
        return
    fi

    local logs
    logs=$(docker logs "$container_name" 2>&1)

    if echo "$logs" | grep -q "Failed to fetch models from LLM proxy"; then
        echo ""
        echo -e "\033[1;31m╔══════════════════════════════════════════════════════════════════════╗\033[0m"
        echo -e "\033[1;31m║  WARNING: Failed to fetch AI models from LLM proxy at startup!       ║\033[0m"
        echo -e "\033[1;31m║  The AI assistant is using the static fallback model list.           ║\033[0m"
        echo -e "\033[1;31m║  Check AI_PROXY_URL and AI_PROXY_API_KEY in .env                     ║\033[0m"
        echo -e "\033[1;31m╚══════════════════════════════════════════════════════════════════════╝\033[0m"
        echo ""
    elif echo "$logs" | grep -q "Fetched.*chat models from proxy"; then
        local model_count
        model_count=$(echo "$logs" | grep -o "Fetched [0-9]* chat models" | tail -1)
        echo -e "\033[1;32mAI Models: ${model_count:-loaded} from LLM proxy ✓\033[0m"
    fi
}

# Function to show status of containers
show_status() {
    echo "Current status of Kroki services:"
    $DOCKER_COMPOSE ps
}

# Function to parse command-line arguments
parse_args() {
    local POSITIONAL=()
    while [[ $# -gt 0 ]]; do
        key="$1"
        case $key in
            --hostname)
                HOSTNAME="$2"
                shift 2
                ;;
            --cert)
                CUSTOM_CERT_CRT="$2"
                shift 2
                ;;
            --key)
                CUSTOM_CERT_KEY="$2"
                shift 2
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                POSITIONAL+=("$1")
                shift
                ;;
        esac
    done
    set -- "${POSITIONAL[@]}"
    COMMAND="$1"
}

# Function to display help message
show_help() {
    echo "╔════════════════════════════════════════════════════════════════════╗"
    echo "║                     Kroki Server Management                        ║"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    echo "Usage: $0 [options] {start|stop|restart|status|logs|clean|health|genconfig}"
    echo ""
    echo "Options:"
    echo "  --hostname <name>  Set the hostname for SSL certificate and Nginx config"
    echo "  --cert <path>      Path to SSL certificate file"
    echo "  --key <path>       Path to SSL private key file"
    echo "  --help             Show this help message"
    echo ""
    echo "Commands:"
    echo "  start     - Start the Kroki server"
    echo "  stop      - Stop all services"
    echo "  restart   - Restart all services"
    echo "  status    - Show status of services"
    echo "  logs      - Show logs from all services"
    echo "  clean     - Remove all containers, images, and generated files"
    echo "  health    - Run health checks on all configured hostname/port combinations"
    echo "  genconfig - Generate nginx.conf only (no docker/cert/stack operations);"
    echo "              prints resolved TLS_MODE, DEPLOY_PROFILE, COMPOSE_PROFILES"
    echo ""
    echo "Deployment parameters (set via .env or environment):"
    echo "  TLS_MODE             selfsigned (default) | acme"
    echo "  DEPLOY_PROFILE       private (default) | public"
    echo "  COMPOSE_PROFILES     companions (default) | empty for core-only"
    echo "  RENDER_CACHE_ENABLED true (default) | false"
    echo "  RENDER_CACHE_MAX_SIZE 500m (default)"
    echo "  RENDER_CACHE_TTL     24h (default)"
    echo "  RENDER_CACHE_INACTIVE 7d (default)"
    echo "  RENDER_RATE/BURST/CONN_LIMIT/BODY_LIMIT/TIMEOUT — per-profile render limits"
    echo ""
    echo "ACME/Let's Encrypt parameters (TLS_MODE=acme only):"
    echo "  ACME_EMAIL           Contact email for Let's Encrypt (required)"
    echo "  ACME_STAGING         Set to 1 to use the LE staging CA (test first!)"
    echo "  ACME_HTTP_PORT       Host port for HTTP-01 challenge/redirect (default: 80)"
    echo "  CERT_ALERT_WEBHOOK   Optional webhook URL for scripts/check-cert-expiry.sh"
    echo ""
}

# Main logic

# Parse command-line arguments first
parse_args "$@"

# genconfig is a config-only entry point (used by CI) — it must work without
# docker/compose installed, so dependency checks are skipped for it.
if [ "$COMMAND" != "genconfig" ]; then
    check_dependencies
fi

case "$COMMAND" in
    start)
        if [ "$TLS_MODE" = "acme" ]; then
            validate_acme_config
            ensure_acme_cert
        else
            generate_certs
        fi
        create_nginx_config
        build_demo_site
        ensure_kroki_core
        echo "Starting services with Docker Compose..."

        if [ -f "$DOCKER_COMPOSE_FILE" ]; then
            $DOCKER_COMPOSE up -d
            echo "Waiting for services to start..."
            sleep 5
            check_services
            echo "Kroki is available at https://${HOSTNAME}:${HTTPS_PORT}"
            if [ "$HOSTNAME" != "localhost" ]; then
                echo "Configured with hostname: $HOSTNAME - you may need to add it to your hosts file"
            fi
            sleep 5
            show_status
            check_ai_models
        else
            echo "Error: docker-compose.yml file not found at $DOCKER_COMPOSE_FILE"
            exit 1
        fi
        ;;
    stop)
        echo "Stopping services with Docker Compose..."
        $DOCKER_COMPOSE --profile '*' down --remove-orphans
        echo "Services stopped."
        ;;
    clean)
        echo "Cleaning up Docker containers and images..."
        $DOCKER_COMPOSE --profile '*' down --rmi all -v --remove-orphans
        echo "Removing Docker networks..."
        docker network prune -f
        echo "Removing generated files..."
        rm -rf "$CERTS_DIR"
        rm -f "$NGINX_CONF"
        # ./letsencrypt is intentionally NOT removed: Let's Encrypt enforces a
        # duplicate-certificate limit of 5 certs/week for the same name set.
        # Re-issuing after every clean would exhaust this quota quickly.
        # Delete ./letsencrypt manually only when you genuinely need a fresh cert.
        # WARNING: never run 'git clean -xdf' in a production checkout — it would
        # delete ./letsencrypt alongside other untracked files.
        if [ -d "${LETSENCRYPT_DIR}" ]; then
            echo "Preserving ./letsencrypt (Let's Encrypt rate limits) — delete manually if you really mean it."
        fi
        if [ -d "${CERTBOT_WEBROOT_DIR}" ]; then
            echo "Preserving ./certbot-webroot — delete manually if needed."
        fi
        echo "Cleaned up Docker containers, images, and generated files."
        ;;
    restart)
        echo "Restarting services with Docker Compose..."
        $DOCKER_COMPOSE --profile '*' down --remove-orphans
        build_demo_site
        if [ "$TLS_MODE" = "acme" ]; then
            validate_acme_config
            ensure_acme_cert
        else
            generate_certs
        fi
        create_nginx_config
        ensure_kroki_core
        echo "Starting services with Docker Compose..."
        $DOCKER_COMPOSE up -d
        sleep 5
        check_services
        echo "Kroki is available at https://${HOSTNAME}:${HTTPS_PORT}"
        if [ "$HOSTNAME" != "localhost" ]; then
            echo "Configured with hostname: $HOSTNAME - you may need to add it to your hosts file"
        fi
        sleep 5
        show_status
        check_ai_models
        ;;
    logs)
        echo "Displaying logs for all services..."
        $DOCKER_COMPOSE logs -f
        ;;
    status)
        show_status
        ;;
    health)
        echo "Running health checks on all configured endpoints..."
        health_check_all
        ;;
    genconfig)
        # Generate nginx.conf only — no docker checks, no cert generation,
        # no stack operations. Safe to run in CI without any running stack.
        echo "TLS_MODE=${TLS_MODE}" >&2
        echo "DEPLOY_PROFILE=${DEPLOY_PROFILE}" >&2
        echo "COMPOSE_PROFILES=${COMPOSE_PROFILES}" >&2
        create_nginx_config
        ;;
    *)
        show_help
        exit 1
        ;;
esac
