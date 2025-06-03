# Kroki Diagram Server

A complete setup for running a local Kroki diagram rendering server with a custom interactive demo site.

![](./images/demoSite.png)

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

## DemoSite

The demo site, accessible at https://localhost:8443/, provides an interactive interface for creating and previewing diagrams.

### Features

- Supports all diagram types provided by Kroki
- Real-time diagram preview
- Format conversion (SVG, PNG, PDF, etc.)
- Diagram code examples for all supported formats
- Download rendered diagrams
- Line numbers in the editor
- Responsive design for different screen sizes
- **Interactive zoom and pan for diagram images**
  - Mouse wheel zoom with precise cursor positioning
  - Click and drag to pan around large diagrams
  - Touch support for mobile devices (pinch to zoom, drag to pan)
  - Keyboard shortcuts (Ctrl/Cmd + +/- for zoom, Ctrl/Cmd + 0 to reset)
  - Zoom controls with visual feedback
  - **Zoom state preservation** - maintains zoom level and position when updating diagram code
  - Double-click to reset zoom to fit
  - Help modal with detailed usage instructions
- **File Operations and Local File Support**
  - Create new diagrams with automatic type detection
  - Open local diagram files directly from your file system
  - Save diagrams to local files with proper extensions
  - Save As functionality for creating new files
  - Keyboard shortcuts for all file operations (Ctrl/Cmd + N/O/S)
  - Automatic file type detection from content and extensions
  - File modification tracking with unsaved changes warnings
  - Support for multiple diagram file formats (.puml, .mmd, .dot, .d2, etc.)
  - Modern File System Access API with fallback for older browsers

### URL Parameter Functionality

The demo site supports URL parameters for sharing and bookmarking diagrams:

- `diag` - Sets the diagram type (e.g., plantuml, mermaid, graphviz)
- `fm`t  - Sets the output format (e.g., svg, png, pdf)
- `im`   - Contains the encoded diagram content

These URL parameters work seamlessly:

- When changing diagram types in the UI, the URL is automatically updated
- If an empty editor is loaded with a diagram type, the default example is shown
- When you edit diagram code, the URL updates in real-time for sharing
- If you specify an unsupported format for a diagram type, it automatically defaults to a supported one
- When the code editor is emptied, the im parameter is removed from the URL

Formats are preserved when switching diagram types if the format is supported

Example URL:

```
https://localhost:8443/?fmt=svg&diag=svgbob&im=eJyFjzEOgzAMRXdO4Y0gYbMjhYsAslQlQ4dyAh--P0aAaKv0D06i__ztEH1KuA9EXc_S4KWqKIcTLqxzf4a_WjRinoqZX4-cUk7PbSvMjuopdAzjOJCpudPeEoVb5PA0q4hoKbQ2X_uhSYLDP7xDyzXZjwqKPMz0fYwsRquxLiuxYHH7y-K7-4fV3rbfQbI%3D
```

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

And many more...

### Supported Output Formats

Format support varies by diagram type, but generally includes:

- `SVG` - Scalable Vector Graphics
- `PNG` - Portable Network Graphics
- `PDF` - Portable Document Format
- `JPEG` - For selected diagram types
- `TXT` - Text output (for selected diagram types)
- `Base64` - Encoded output (for selected diagram types)

### Interactive Tools

- `Code Editor`: Create and edit diagram code with line numbering
- `Format Selector`: Choose output format based on diagram type
- `Live Preview`: See your diagram update as you type (with debouncing)
- `Download Button`: Save generated diagrams in various formats
- `Image Link Copying`: Easily share direct links to generated images
- `Decoder Tool`: Convert encoded diagrams back to source code
- `Zoom and Pan Controls`: Interactive viewing for large diagrams
  - **Mouse Controls**: Wheel to zoom, click-drag to pan, double-click to reset
  - **Touch Controls**: Pinch to zoom, single-finger drag to pan
  - **Keyboard Shortcuts**: 
    - `Ctrl/Cmd + +`: Zoom in
    - `Ctrl/Cmd + -`: Zoom out  
    - `Ctrl/Cmd + 0`: Reset zoom
  - **Smart State Management**: Zoom level and position are preserved when updating diagram code
  - **Visual Feedback**: Real-time zoom percentage display
  - **Help System**: Built-in help modal with usage instructions

## Using File Operations

The demo site includes comprehensive file operations that make it work like a standalone diagram editor:

### Creating and Managing Files

- **New File**: Click the "📄 New" button or use `Ctrl/Cmd + N` to create a new diagram
- **Open File**: Click the "📁 Open" button or use `Ctrl/Cmd + O` to open existing diagram files
- **Save File**: Click the "💾 Save" button or use `Ctrl/Cmd + S` to save your work
- **Save As**: Click the "📄 Save As" button or use `Ctrl/Cmd + Shift + S` to save with a new name

### Supported File Formats

The editor automatically detects diagram types from file content and extensions:

- **PlantUML**: `.puml`, `.plantuml`, `.uml`, `.txt`
- **Mermaid**: `.mmd`, `.mermaid`
- **GraphViz**: `.dot`, `.gv`
- **D2**: `.d2`
- **DBML**: `.dbml`
- **BPMN**: `.bpmn`
- **ERD**: `.erd`
- **TikZ**: `.tikz`
- **And more**: `.md`, `.py`, `.js`, `.json`, `.xml`, `.yaml`, `.yml`, `.svg`

### File Status Indicators

- **File Name**: Displayed in the editor header
- **Modified Indicator**: An asterisk (*) appears next to the file name when there are unsaved changes
- **Save Button State**: Automatically enabled/disabled based on file status
- **Unsaved Changes Warning**: Browser warns before leaving with unsaved changes

### Browser Compatibility

- **Modern Browsers** (Chrome 86+, Edge 86+): Full File System Access API support for direct file system integration
- **Other Browsers** (Firefox, Safari): Automatic fallback to download/upload methods

## AI Assistant Features

The demo site includes an integrated AI assistant that can help you create, modify, and understand diagrams. The AI assistant supports multiple models and can be configured to use either the server's backend or your own API credentials.

### AI Model Support

The AI assistant supports a wide range of modern language models:

**GPT Models:**
- `gpt-4.1` - Latest GPT-4.1 model
- `gpt-4.1-mini` - Optimized GPT-4.1 for faster responses
- `gpt-4.1-nano` - Lightweight GPT-4.1 variant
- `gpt-4.5-preview` - Preview of GPT-4.5 capabilities
- `gpt-4o` - GPT-4 Omni model
- `gpt-4o-mini` - Compact GPT-4 Omni variant

**O-Series Models:**
- `o4-mini` - OpenAI's o4-mini reasoning model
- `o3` - OpenAI's o3 reasoning model
- `o3-mini` - Compact o3 reasoning model

**Custom Models:**
- `custom` - Use your own model name with custom API configuration

### AI Assistant Interface

The AI assistant is accessible through:

- **Chat Window**: Click the "🤖 AI Assistant" button to open the interactive chat interface
- **Backend Indicator**: A badge showing the current AI backend configuration:
  - `Server Backend` - Using the server's default AI configuration
  - `ModelName (Custom)` - Using your custom API settings with the specified model

### AI Configuration Options

#### Using Server Backend (Default)

By default, the AI assistant uses the server's configured AI backend. No additional setup is required from the user.

#### Using Custom API Configuration

You can configure your own AI API credentials through the settings:

1. **Access Settings**: Click the gear icon (⚙️) in the AI assistant window
2. **Configure API**: Enter your custom settings:
   - **API Key**: Your OpenAI or compatible API key
   - **Base URL**: Custom API endpoint (optional, defaults to OpenAI)
   - **Model**: Select from supported models or choose "custom" to specify your own
   - **Custom Model Name**: When "custom" is selected, specify your model name

3. **Save Settings**: Settings are automatically saved and persisted locally

### AI Capabilities

The AI assistant can help you with:

#### Diagram Creation and Modification
- **Generate Diagrams**: Create new diagrams from natural language descriptions
- **Modify Existing**: Update and enhance existing diagram code
- **Format Conversion**: Help convert between different diagram formats
- **Best Practices**: Suggest improvements and follow diagram-specific conventions

#### Diagram Understanding
- **Code Explanation**: Explain what existing diagram code does
- **Troubleshooting**: Help debug diagram rendering issues
- **Optimization**: Suggest ways to improve diagram clarity and structure

#### Interactive Features
- **Context Awareness**: The AI can see your current diagram code and provide relevant suggestions
- **Real-time Assistance**: Get help while actively editing diagrams
- **Multi-turn Conversations**: Build on previous interactions for complex diagram development

### AI Usage Examples

#### Creating a New Diagram
```
User: "Create a PlantUML sequence diagram showing a user login flow"
AI: [Generates appropriate PlantUML code for a login sequence diagram]
```

#### Modifying Existing Diagrams
```
User: "Add error handling to this sequence diagram"
AI: [Analyzes current diagram and adds error handling flows]
```

#### Understanding Complex Diagrams
```
User: "Explain what this GraphViz diagram represents"
AI: [Provides detailed explanation of the diagram structure and relationships]
```

### Privacy and Security

- **Local Storage**: Custom API settings are stored locally in your browser
- **No Server Storage**: When using custom API configuration, your credentials are not sent to the server
- **Secure Communication**: All API communications use HTTPS encryption
- **Optional Feature**: The AI assistant is completely optional and can be ignored if not needed

### Troubleshooting AI Features

#### Common Issues

1. **"Server Backend" Not Working**
   - Ensure the server is configured with AI credentials (see `.env` file)
   - Check server logs for AI service availability

2. **Custom API Configuration Issues**
   - Verify your API key is valid and has sufficient credits
   - Check that the base URL is correct for your API provider
   - Ensure the selected model is available with your API key

3. **Model Not Responding**
   - Try switching to a different model
   - Check your internet connection
   - Verify API rate limits haven't been exceeded

#### Settings Management

- **Reset Settings**: Clear your browser's local storage to reset AI configuration
- **Export/Import**: Settings can be manually exported from browser developer tools if needed
- **Multiple Configurations**: Each browser/device maintains its own AI settings

### Integration with Diagram Workflow

The AI assistant seamlessly integrates with the diagram creation workflow:

- **Context Preservation**: AI understands your current diagram type and content
- **Format Awareness**: Suggestions are tailored to your selected diagram format
- **Real-time Updates**: Changes suggested by AI can be immediately applied and previewed
- **File Operations**: AI-generated content works with all file operations (save, load, etc.)

## Architecture

The system consists of several containerized services:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Nginx      │     │  Core       │     │  Mermaid    │
│  Proxy      │────▶│  Kroki      │────▶│  Renderer   │
│  Container  │     │  Container  │     │  Container  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   │                   │
       │                   ▼                   │
       │            ┌─────────────┐            │
       │            │  BPMN       │            │
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
