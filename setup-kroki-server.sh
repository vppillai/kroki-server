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
# Function to display help message
show_help() {
    echo "Usage: $0 [options] {start|stop|restart|status|logs|clean|health}"
    echo ""
    echo "Options:"
    echo "  --hostname <n>  Set the hostname for SSL certificate and Nginx config"
    echo "  --cert <path>      Path to SSL certificate file"
    echo "  --key <path>       Path to SSL private key file"
    echo "  --help             Show this help message"
    echo ""
    echo "Commands:"
    echo "  start    - Start the Kroki server"
    echo "  stop     - Stop all services"
    echo "  restart  - Restart all services"
    echo "  status   - Show status of services"
    echo "  logs     - Show logs from all services"
    echo "  clean    - Remove all containers, images, and generated files"
    echo "  health   - Run health checks on all configured hostname/port combinations"
}

# Load configuration from .env file if it exists
if [ -f "${SCRIPT_DIR}/.env" ]; then
    set -a
    source "${SCRIPT_DIR}/.env"
    set +a
    echo "Loaded configuration from .env file"
    DEFAULT_HTTP_PORT="$HTTP_PORT"
    DEFAULT_HTTPS_PORT="$HTTPS_PORT"
    DEFAULT_HOSTNAME="$HOSTNAME"
else
    DEFAULT_HOSTNAME="localhost"
    DEFAULT_HTTP_PORT="8000"
    DEFAULT_HTTPS_PORT="8443"
    DEMOSITE_CONTAINER_PORT="8006"
    echo "No .env file found, using default configuration"
fi

# Check if docker is installed
check_dependencies() {
    echo "Checking dependencies..."
    if ! command -v docker &> /dev/null; then
        echo "Error: Docker is not installed. Please install Docker first."
        exit 1
    fi

    # Check for docker-compose or docker compose
    if ! command -v docker-compose &> /dev/null; then
        if command -v docker &> /dev/null && docker compose version &> /dev/null; then
            DOCKER_COMPOSE="docker compose"
            echo "Using: docker compose"
        else
            echo "Error: Neither docker-compose nor docker compose plugin found. Please install Docker Compose."
            exit 1
        fi
    else
        DOCKER_COMPOSE="docker-compose"
        echo "Using: docker-compose"
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

# Function to generate Docker Compose override file
generate_compose_override() {
    echo "Generating Docker Compose override file..."
    local override_file="${SCRIPT_DIR}/docker-compose.override.yml"
    
    cat > "$override_file" <<EOF
# This file is automatically generated by setup-kroki-server.sh
# It contains port mappings based on the configuration in .env
# DO NOT EDIT MANUALLY - it will be overwritten on restart

services:
  nginx:
    ports:
      - "${DEFAULT_HTTPS_PORT}:8443"

  core:
    ports:
      - "${DEFAULT_HTTP_PORT}:8000"
EOF
    echo "Docker Compose override file created with port mappings."
}

# Function to create Nginx config
create_nginx_config() {
    echo "Creating Nginx configuration..."
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

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Frame-Options SAMEORIGIN;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384';
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    server {
        listen 0.0.0.0:8443 ssl;
        server_name ${DEFAULT_HOSTNAME};

        ssl_certificate /etc/nginx/certs/nginx.crt;
        ssl_certificate_key /etc/nginx/certs/nginx.key;

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
            
            # Add caching headers for static assets
            expires 1d;
            add_header Cache-Control "public";
        }

        # Static files at root level
        location ~* ^/[^/]+\.(html|ico|svg|png|jpg|jpeg|gif)$ {
            proxy_pass http://demosite:${DEMOSITE_CONTAINER_PORT}\$uri;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            
            # Add caching headers for static assets
            expires 1d;
            add_header Cache-Control "public";
        }

        # Match Kroki API pattern (diagram-type/format/encoded-diagram)
        location ~* ^/[^/]+/[^/]+/[^/]+$ {
            proxy_pass http://core:${DEFAULT_HTTP_PORT};
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_connect_timeout 300;
            proxy_send_timeout 300;
            proxy_read_timeout 300;
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
        if curl -k -s -o /dev/null -w "%{http_code}" https://${DEFAULT_HOSTNAME}:${DEFAULT_HTTPS_PORT} | grep -q "200"; then
            echo "Services are up and running!"
            return 0
        fi
        echo "Waiting for services to start - attempt $attempt of $max_attempts..."
        sleep $sleep_time
        attempt=$((attempt + 1))
    done
    
    echo "Error: Services did not start properly. Check logs with '$0 logs'"
    return 1
}

# Function to perform comprehensive health check on all host/port combinations
health_check_all() {
    echo "Performing comprehensive health check on all configured endpoints..."
    local total_tests=0
    local successful_tests=0
    
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
    echo "Usage: $0 [options] {start|stop|restart|status|logs|clean|health}"
    echo ""
    echo "Options:"
    echo "  --hostname <name>  Set the hostname for SSL certificate and Nginx config"
    echo "  --cert <path>      Path to SSL certificate file"
    echo "  --key <path>       Path to SSL private key file"
    echo "  --help             Show this help message"
    echo ""
    echo "Commands:"
    echo "  start    - Start the Kroki server"
    echo "  stop     - Stop all services"
    echo "  restart  - Restart all services"
    echo "  status   - Show status of services"
    echo "  logs     - Show logs from all services"
    echo "  clean    - Remove all containers, images, and generated files"
    echo "  health   - Run health checks on all configured hostname/port combinations"
    echo ""
}

# Main logic
check_dependencies

# Parse command-line arguments first
parse_args "$@"

case "$COMMAND" in
    start)
        generate_certs
        create_nginx_config
        build_demo_site
        generate_compose_override
        echo "Starting services with Docker Compose..."
        
        if [ -f "$DOCKER_COMPOSE_FILE" ]; then
            $DOCKER_COMPOSE -f "$DOCKER_COMPOSE_FILE" up -d
            echo "Waiting for services to start..."
            sleep 5
            check_services
            echo "Kroki is available at https://${HOSTNAME}:${HTTPS_PORT}"
            if [ "$HOSTNAME" != "localhost" ]; then
                echo "Configured with hostname: $HOSTNAME - you may need to add it to your hosts file"
            fi
            sleep 5
            show_status
        else
            echo "Error: docker-compose.yml file not found at $DOCKER_COMPOSE_FILE"
            exit 1
        fi
        ;;
    stop)
        echo "Stopping services with Docker Compose..."
        $DOCKER_COMPOSE down
        echo "Services stopped."
        ;;
    clean)
        echo "Cleaning up Docker containers and images..."
        $DOCKER_COMPOSE down --rmi all
        echo "Removing Docker volumes..."
        docker volume prune -f
        echo "Removing Docker networks..."
        docker network prune -f
        echo "Removing generated files..."
        rm -rf "$CERTS_DIR"
        rm -f "$NGINX_CONF"
        echo "Cleaned up Docker containers, images, and generated files."
        ;;
    restart)
        echo "Restarting services with Docker Compose..."
        $DOCKER_COMPOSE down
        build_demo_site
        generate_certs
        create_nginx_config
        generate_compose_override
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
    *)
        show_help
        exit 1
        ;;
esac