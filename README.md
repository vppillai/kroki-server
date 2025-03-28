# Kroki Diagram Server

A complete setup for running a local Kroki diagram rendering server with a custom interactive demo site.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/vppillai/kroki-server.git
cd kroki-server

# Start the server
./setup-kroki-server.sh start

# Access the demo site
# Open https://localhost:8443/ in your browser
```

## Overview

This project provides a complete solution for running a [Kroki](https://kroki.io/) diagram rendering server locally. It includes:

- A Docker Compose setup for running the Kroki server and its dependencies
- An interactive demo site for creating and previewing diagrams
- HTTPS support via self-signed certificates
- Comprehensive deployment scripts and utilities

## Architecture

The system consists of several containerized services:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Nginx    │     │    Core     │     │   Mermaid   │
│   Proxy     │────▶│   Kroki     │────▶│  Renderer   │
│  Container  │     │  Container  │     │  Container  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   │                   │
       │                   ▼                   │
       │            ┌─────────────┐            │
       │            │    BPMN     │            │
       │            │  Renderer   │            │
       │            │  Container  │            │
       │            └─────────────┘            │
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Demo Site  │     │ Excalidraw  │     │ DiagramsNet │
│  Container  │     │  Renderer   │     │  Renderer   │
└─────────────┘     └─────────────┘     └─────────────┘
```

- **Nginx**: Routes requests and serves HTTPS
- **Core Kroki**: Main service that coordinates diagram rendering
- **Renderers**: Specialized containers for different diagram types
- **Demo Site**: Custom UI for creating and previewing diagrams

## Deployment

### Requirements

- Docker
- Docker Compose
- Bash shell

### Setup Options

The [`setup-kroki-server.sh`](setup-kroki-server.sh) script provides several commands:

```bash
# Start the server
./setup-kroki-server.sh start

# Stop the server
./setup-kroki-server.sh stop

# Restart the server
./setup-kroki-server.sh restart

# Clean up all containers and data
./setup-kroki-server.sh clean

# View the container logs
./setup-kroki-server.sh logs

# Check container status
./setup-kroki-server.sh status

# Get help information
./setup-kroki-server.sh help
```

### Custom Hostname

By default, the server uses `localhost`. You can specify a custom hostname:

```bash
./setup-kroki-server.sh start --hostname your-domain.com
```

### Custom SSL Certificates

You can provide your own SSL certificates:

```bash
./setup-kroki-server.sh start --cert path/to/cert.crt --key path/to/key.key
```

## Demo Site

The demo site, accessible at https://localhost:8443/, provides an interactive interface for creating and previewing diagrams.

### Features

- Supports all diagram types provided by Kroki
- Real-time diagram preview
- Format conversion (SVG, PNG, PDF, etc.)
- Diagram code examples for all supported formats
- Download rendered diagrams
- URL sharing
- Encode/decode utilities for diagram text

### Supported Diagram Types

- PlantUML
- Mermaid
- GraphViz
- BPMN
- BlockDiag
- C4 (with PlantUML)
- DBM
- D2
- Excalidraw
- ERD
- And many more...

## How It Works

1. The user writes diagram code in the editor
2. The code is compressed and encoded using deflate and base64
3. A request is sent to the Kroki server
4. The appropriate renderer container processes the diagram
5. The result is returned to the browser and displayed

## Development

### Demo Site Structure

- [`demoSite/index.html`](demoSite/index.html) - Main HTML file
- [`demoSite/js/main.js`](demoSite/js/main.js) - JavaScript for the demo site
- [`demoSite/css/main.css`](demoSite/css/main.css) - Styling
- [`demoSite/examples`](demoSite/examples) - Example diagram code for each format

### Nginx Configuration

The Nginx proxy handles routing and SSL:
- Routes diagram requests to the core Kroki server
- Serves the demo site static files
- Manages SSL certificates

### Docker Compose Configuration

The [`docker-compose.yml`](docker-compose.yml) file defines the container relationships and networking.

## Debugging

### Common Issues

1. **Certificate Errors**: The default setup uses self-signed certificates, which will trigger browser warnings. Add an exception or provide trusted certificates.

2. **Port Conflicts**: If port 8443 is already in use, you can modify the [`docker-compose.yml`](docker-compose.yml) file to use a different port.

3. **Container Issues**: Check logs for more details if any service fails to start.

### Useful Debug Commands

```bash
# List status of docker compose images
docker-compose ps

# Get the demosite logs
docker-compose logs demosite

# Get logs for the core Kroki service
docker-compose logs core

# List networks
docker network list

# Inspect the Kroki network
docker network inspect kroki-server_kroki_network
```

## License

This project is available under the MIT License.

## Attribution

This project builds on top of [Kroki](https://github.com/yuzutech/kroki) by Yuzutech.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.