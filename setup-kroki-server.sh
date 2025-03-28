#!/bin/bash

# Set container names
KROKI_CONTAINER="kroki"
NGINX_CONTAINER="nginx-kroki"
CERTS_DIR="$(pwd)/nginx-certs"
NGINX_CONF="$(pwd)/nginx.conf"

# Function to generate ECDSA self-signed SSL certs
generate_certs() {
    if [ ! -d "$CERTS_DIR" ]; then
        mkdir -p "$CERTS_DIR"
    fi

    if [ ! -f "$CERTS_DIR/nginx.crt" ]; then
        echo "Generating ECDSA self-signed SSL certificate..."
        # Generate the private key using ECDSA
        openssl ecparam -name prime256v1 -genkey -noout -out "$CERTS_DIR/nginx.key"
        # Generate the self-signed certificate
        openssl req -new -key "$CERTS_DIR/nginx.key" -out "$CERTS_DIR/nginx.csr" -subj "/CN=localhost"
        openssl x509 -req -in "$CERTS_DIR/nginx.csr" -signkey "$CERTS_DIR/nginx.key" -out "$CERTS_DIR/nginx.crt"
        rm "$CERTS_DIR/nginx.csr"  # Clean up CSR file
    else
        echo "ECDSA SSL certificate already exists."
    fi
}

# Function to build demo site
build_demo_site() {
    echo "Building demosite container..."
    cd demoSite || exit 1
    docker build -t kroki-demosite:latest -f Dockerfile .
    if [ $? -ne 0 ]; then
        echo "Failed to build demosite container."
        exit 1
    fi
    cd ..
}

# Function to create Nginx config
create_nginx_config() {
    cat > "$NGINX_CONF" <<EOF
events{}
http {
    # Include basic MIME types
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Performance settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;

server {
    listen 0.0.0.0:8443 ssl;
    server_name localhost;

    ssl_certificate /etc/nginx/certs/nginx.crt;
    ssl_certificate_key /etc/nginx/certs/nginx.key;

    # Root path (serves the demo site index)
    location = / {
        proxy_pass http://demosite:8006/index.html;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # Static resources in static directories
    location ~* ^/(css|js|images|examples|fonts|resources)/ {
        proxy_pass http://demosite:8006\$uri;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        
        # Add caching headers for static assets
        expires 1d;
        add_header Cache-Control "public";
    }

    # Static files at root level
    location ~* ^/[^/]+\.(html|css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://demosite:8006\$uri;
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
        proxy_pass http://core:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # Fallback for any other paths
    location / {
        proxy_pass http://demosite:8006;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
}
EOF
}


# Main logic
case "$1" in
    start)
        generate_certs
        create_nginx_config
        build_demo_site
        echo "Starting services with Docker Compose..."
        docker-compose up -d
        echo "Kroki is available at https://localhost:8443"
        ;;
    stop)
        echo "Stopping services with Docker Compose..."
        docker-compose down
        ;;
    clean)
        echo "Cleaning up Docker containers and images..."
        docker-compose down --rmi all
        docker volume prune -f
        docker network prune -f
        rm -rf "$CERTS_DIR"
        rm -f "$NGINX_CONF"
        echo "Cleaned up Docker containers, images, and generated files."
        ;;
    restart)
        echo "Restarting services with Docker Compose..."
        docker-compose down
        build_demo_site
        generate_certs
        create_nginx_config
        echo "Starting services with Docker Compose..."
        docker-compose up -d
        echo "Kroki is available at https://localhost:8443"
        ;;
    logs)
        echo "Displaying logs for all services..."
        docker-compose logs -f
        ;;
    *)
        echo "Usage: $0 {start|stop|clean|restart|logs}"
        exit 1
        ;;
esac