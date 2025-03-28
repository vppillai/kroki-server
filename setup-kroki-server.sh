#!/bin/bash

# Set container names
KROKI_CONTAINER="kroki"
NGINX_CONTAINER="nginx-kroki"

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

# Main logic
case "$1" in
    start)
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
        ;;
    logs)
        echo "Displaying logs for Kroki and Nginx containers..."
        docker-compose logs -f
        ;;
    restart)
        echo "Restarting services with Docker Compose..."
        docker-compose down
        build_demo_site
        docker-compose up -d
        ;;
    *)
        echo "Usage: $0 {start|stop|clean|logs|restart}"
        exit 1
        ;;
esac