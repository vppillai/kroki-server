# Kroki Diagram Server

A complete setup for running a local Kroki diagram rendering server with a custom interactive demo site.

<blockquote style="background:#f9f9f9; border-left: 6px solid #ccc; padding: 1em; font-size: 0.95em;">
  <strong>Note:</strong><br>
  While the initial framework and specifications were manually crafted, over <strong>90%</strong> of the code in this repository was generated using AI tools. As such, the code quality and structure may not fully reflect best practices and have not undergone extensive manual review.<br><br>
  That said, I have been actively <em>dogfooding</em> the tool, and it is functional and working as intended in real-world usage.
</blockquote>


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
  - **Auto-reload file monitoring** with configurable delay (500-5000ms, default 1 second)
  - Real-time file change detection and automatic diagram updates
  - Smart file monitoring that activates only when needed

### URL Parameter Functionality

The demo site supports URL parameters for sharing and bookmarking diagrams:

- `diag` - Sets the diagram type (e.g., plantuml, mermaid, graphviz)
- `fmt`  - Sets the output format (e.g., svg, png, pdf)
- `im`   - Contains the encoded diagram content

These URL parameters work seamlessly with improved initialization:

- **Smart initialization order** ensures dropdowns are ready before URL processing
- When changing diagram types in the UI, the URL is automatically updated
- **Fixed URL loading**: Pages loaded with format parameters now properly show default examples
- When you edit diagram code, the URL updates in real-time for sharing
- If you specify an unsupported format for a diagram type, it automatically defaults to a supported one
- When the code editor is emptied, the im parameter is removed from the URL
- Formats are preserved when switching diagram types if the format is supported
- **Race condition fixes** ensure proper loading of content and format combinations

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

### Advanced Configuration

The demo site includes comprehensive configuration options accessible through Settings:

#### Editor Settings
- **Auto-reload Monitoring Delay**: Configurable file monitoring interval (500-5000ms, default 1000ms)
- **Auto-save**: Automatic saving of changes with configurable delay
- **Debounce Delay**: Diagram update delay for performance optimization
- **Code Editor**: Line numbers, word wrap, tab size, and other editor preferences
- **Theme Settings**: Dark/light mode with system preference detection

#### File Operations
- **Auto-save Toggle**: Enable/disable automatic file saving
- **Auto-reload Toggle**: Enable/disable automatic file monitoring and reloading
- **File Type Detection**: Automatic diagram type detection from file content

#### UI Preferences
- **Layout Options**: Responsive design settings and layout preferences
- **Zoom Settings**: Default zoom behavior and interaction preferences
- **Accessibility**: High contrast mode and keyboard navigation options

All configuration changes are applied in real-time and persist across browser sessions.

## Recent Improvements (June 2025)

### Auto-reload Configuration Enhancement
- **Configurable Monitoring Delay**: Auto-reload delay is now user-configurable (500-5000ms range, default 1000ms)
- **Settings Reorganization**: Auto-reload delay moved from File Operations to Editor Settings section for better organization
- **Real-time Updates**: Configuration changes immediately restart file monitoring with new delay settings
- **Performance Optimization**: Smart file monitoring that only activates when files are loaded

### URL Parameter Loading Fixes
- **Initialization Order Fix**: Resolved race condition where URL parameters were processed before dropdown initialization
- **Default Content Loading**: URLs with format parameters now properly load default examples when no content is specified
- **Improved Error Handling**: Better fallback behavior for invalid format/diagram type combinations
- **Seamless Integration**: URL processing now works reliably with dynamic imports and async operations

### Configuration System Improvements
- **Centralized Management**: Unified configuration system with proper state synchronization
- **Persistent Settings**: All user preferences are saved and restored across sessions
- **Real-time Application**: Configuration changes take effect immediately without requiring page refresh
- **Modular Architecture**: Clean separation between configuration UI, storage, and application logic

### Technical Enhancements
- **ES6 Module Structure**: Improved code organization with proper module dependencies
- **State Management**: Centralized application state with reactive updates
- **Error Recovery**: Enhanced error handling with user-friendly feedback
- **Performance**: Optimized file monitoring and diagram update processes

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

The demo site, accessible at https://localhost:8443/, provides a comprehensive interactive interface for creating and previewing diagrams with advanced features.

### Core Features

- **Full Diagram Support**: All diagram types provided by Kroki are supported
- **Real-time Preview**: Live diagram updates as you type with configurable debouncing
- **Multi-format Export**: SVG, PNG, PDF, and other format conversions
- **Code Examples**: Built-in examples for all supported diagram formats
- **Download & Sharing**: Export diagrams and share via URL parameters
- **Professional Editor**: Line numbers, syntax awareness, and code formatting
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices

### Advanced Workflow Features

- **File System Integration**: Native file operations with auto-save and auto-reload
- **Smart Configuration**: Comprehensive settings with real-time application
- **URL Parameter Support**: Seamless sharing and bookmarking with improved initialization
- **Interactive Zoom/Pan**: Professional image viewing with state preservation
- **AI-Powered Assistance**: Integrated AI for diagram creation and modification
- **Configuration Management**: Persistent settings with import/export capabilities

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

The demo site is built with a modular architecture for maintainability and extensibility:

- [`demoSite/index.html`](demoSite/index.html) - Main HTML structure with responsive layout
- [`demoSite/js/main.js`](demoSite/js/main.js) - Core application initialization and coordination
- [`demoSite/js/config.js`](demoSite/js/config.js) - Configuration definitions and defaults
- [`demoSite/js/config-ui.js`](demoSite/js/config-ui.js) - Settings interface and user preferences
- [`demoSite/js/modules/`](demoSite/js/modules/) - Modular JavaScript components:
  - `state.js` - Application state management
  - `constants.js` - Application constants and defaults
  - `configuration.js` - Configuration system integration
  - `fileOperations.js` - File handling and monitoring with auto-reload
  - `urlHandler.js` - URL parameter processing with improved initialization
  - `diagramOperations.js` - Diagram rendering and format management
  - `utils.js` - Utility functions and helpers
  - `theme.js` - Theme management and dark/light mode
  - `zoomPan.js` - Interactive image viewing controls
  - `fullscreen.js` - Fullscreen mode functionality
  - `search.js` - Code search and navigation
- [`demoSite/css/`](demoSite/css/) - Modular CSS with theme support
- [`demoSite/examples/`](demoSite/examples/) - Example diagram code for each format

### Key Implementation Features

- **Modular Architecture**: Clean separation of concerns with ES6 modules
- **State Management**: Centralized application state with reactive updates  
- **Configuration System**: Comprehensive settings with real-time application
- **File Monitoring**: Auto-reload functionality with configurable delays (500-5000ms)
- **URL Processing**: Fixed initialization order for proper parameter handling
- **Error Handling**: Robust error management with user-friendly feedback
- **Performance Optimization**: Debounced updates and efficient rendering

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

## Quick Reference

### New Feature Access

#### Auto-reload Configuration
1. Open Settings (⚙️ gear icon)
2. Navigate to Advanced → Editor Settings  
3. Adjust "Auto-reload Monitoring Delay" slider (500-5000ms)
4. Enable auto-reload toggle in the toolbar
5. Changes apply immediately to active file monitoring

#### URL Parameter Usage
- **Format-only URLs**: `https://localhost:8443/?format=plantuml` (loads PlantUML with default example)
- **Full URLs**: `https://localhost:8443/?format=svg&diag=mermaid&im=encoded_content`
- **Smart defaults**: Invalid format combinations automatically use supported alternatives

#### File Operations with Auto-reload
1. **Load a file**: File → Open or Ctrl/Cmd + O
2. **Enable auto-reload**: Toggle auto-reload button in toolbar  
3. **Configure delay**: Settings → Advanced → Editor Settings → Auto-reload Monitoring Delay
4. **Edit externally**: Modify the file in any external editor
5. **Automatic update**: Diagram updates automatically after the configured delay

#### Configuration Access
- **Settings Panel**: Click gear icon (⚙️) in the main interface
- **Advanced Settings**: Navigate to Advanced tab for developer options
- **Editor Settings**: File monitoring, auto-save, and editor preferences
- **File Operations**: Auto-save toggle and file handling options
- **UI Preferences**: Theme, layout, and visual settings

## License

This project is available under the MIT License.

## Attribution

This project builds on top of [Kroki](https://github.com/yuzutech/kroki) by Yuzutech.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
