# Release Notes - DocCode v2.4.0

**Release Date**: August 8, 2025  
**Previous Version**: v2.3.0 (June 19, 2025)

This release introduces a revolutionary **Visual Editor Integration** for diagramsnet diagrams, bringing WYSIWYG editing capabilities to DocCode with seamless bidirectional synchronization between visual and code-based editing.

## 🎉 Major New Features

### 🎨 **Visual Editor Integration**

A comprehensive visual editing system for diagramsnet diagrams that provides an intuitive drag-and-drop interface with real-time code synchronization.

**Key Features**:
• **Near-Fullscreen Editor**: Modal uses 98% of viewport (98vw × 96vh) for maximum editing space
• **Bidirectional Sync**: Changes made in visual editor automatically sync back to code editor
• **Real-time Updates**: Diagram preview updates automatically when visual editor changes are applied
• **Smart Integration**: Only appears when "diagramsnet" diagram type is selected
• **Professional Modal Interface**: Compact header design with status indicators and server information
• **Keyboard Support**: Press Escape key to close the visual editor modal
• **PostMessage Communication**: Secure iframe-based communication with proper origin validation
• **Server Information Display**: Shows which Draw.io server is being used (e.g., "using embed.diagrams.net")

**Technical Implementation**:
• **Modular Architecture**: Complete `drawioIntegration.js` module with proper error handling
• **PostMessage API**: Secure communication between DocCode and embedded Draw.io editor
• **State Management**: Preserves editor state and handles connection status with visual feedback
• **Error Handling**: Graceful fallback with user-friendly error messages and loading indicators
• **Event Management**: Proper event listener cleanup and modal focus management

### 🏗️ **Local Draw.io Server Support**

Integration with self-hosted Draw.io servers for enhanced privacy and collaboration.

**Configuration Options**:
• **Public Service**: Default configuration uses `https://embed.diagrams.net/embed/`
• **Self-Hosted Servers**: Support for custom Draw.io server deployments
• **diagram-tools-hub Integration**: Seamless integration with the comprehensive diagram-tools-hub platform

**Benefits**:
• **Privacy & Security**: All editing happens locally without external dependencies
• **Collaboration**: Support for real-time multi-user editing when using diagram-tools-hub
• **Performance**: Faster loading and response times with local servers
• **Customization**: Full control over Draw.io configuration and features

## 🚀 **User Interface Enhancements**

### 🎯 **Ultra-Compact Modal Design**

Optimized modal interface that maximizes screen space for visual editing.

**Design Improvements**:
• **Compact Header**: Reduced from 50px to 36px height (28% smaller)
• **Optimized Typography**: Title (14px), server info (10px), status (12px)
• **Efficient Spacing**: Minimal padding and margins for maximum editor space
• **Professional Styling**: Clean design with proper theme integration

### 📊 **Server Information Display**

Clear indication of which visual editor server is being used.

**Features**:
• **Dynamic Detection**: Automatically extracts and displays hostname from server URL
• **User-Friendly Format**: Shows "using hostname" (e.g., "using embed.diagrams.net")
• **Configuration Transparency**: Users can immediately see which server they're connecting to
• **Fallback Handling**: Graceful handling of invalid URLs with generic message

## 🛠️ **Technical Improvements**

### 🔧 **Production Code Cleanup**

Comprehensive code cleanup and optimization for production deployment.

**Improvements**:
• **Debug Code Removal**: Cleaned up excessive console.log statements while maintaining essential error handling
• **Professional Error Messages**: User-friendly error messages throughout the visual editor integration
• **Code Quality**: Maintained essential error handling while removing debug noise

### 📚 **Enhanced Documentation**

Comprehensive documentation updates covering the new visual editor features.

**Documentation Updates**:
• **Visual Editor Guide**: Complete usage instructions and configuration options
• **Integration Examples**: Step-by-step setup for self-hosted servers
• **Technical Implementation**: Architecture details and security considerations
• **diagram-tools-hub Integration**: Instructions for using the comprehensive local diagram platform

### 🐚 **ShellCheck Compliance**

Complete shell script validation and compliance fixes.

**Script Improvements**:
• **Variable Validation**: Proper variable assignment with fallback values
• **Error Handling**: Enhanced error handling with robust fallback mechanisms
• **Code Quality**: Eliminated all ShellCheck warnings while maintaining functionality
• **Documentation**: Proper ShellCheck directives and code documentation

## 🎨 **Visual Editor Workflow**

### Usage Instructions

1. **Select Diagram Type**: Choose "diagramsnet" from the diagram type dropdown
2. **Open Visual Editor**: Click the "Visual Editor" button in the preview toolbar  
3. **Edit Visually**: Use the full Draw.io interface for diagram creation and editing
4. **Automatic Sync**: Changes are automatically synchronized to the code editor
5. **Close Editor**: Press Escape key or click the X button to close

### Configuration Examples

**Public Draw.io Service (Default)**:
```bash
DRAWIO_SERVER_URL="https://embed.diagrams.net/embed/"
```

**Self-Hosted Draw.io Server**:
```bash  
DRAWIO_SERVER_URL="https://your-server:port/drawio/embed/"
```

**diagram-tools-hub Integration**:
```bash
# Deploy diagram-tools-hub following their setup instructions
DRAWIO_SERVER_URL="https://your-tools-hub:port/drawio/embed/"
# Restart DocCode services
./setup-kroki-server.sh restart
```

## 🏗️ **Infrastructure Integration**

### diagram-tools-hub Platform Support

Seamless integration with the comprehensive diagram-tools-hub platform for enhanced local diagram editing.

**Platform Features**:
• **Multiple Diagram Tools**: Draw.io, Excalidraw, and TLDraw in one unified platform
• **Collaborative Features**: Real-time multi-user editing with live cursors and automatic synchronization  
• **Easy Deployment**: Single Docker setup with automatic HTTPS and reverse proxy configuration
• **Privacy & Security**: Completely local hosting with no external dependencies
• **Simple Management**: Easy configuration and management through provided scripts

**Integration Benefits**:
• **Enhanced Privacy**: All diagram editing happens on your infrastructure
• **Collaboration**: Support for real-time multi-user diagram editing
• **Performance**: Faster response times with local hosting
• **Customization**: Full control over the editing environment

## 🐛 **Bug Fixes**

### Visual Editor Issues
• **Fixed**: PostMessage origin mismatch causing loading screen hangs
• **Fixed**: Event handler setup order preventing proper communication
• **Fixed**: Escape key handling in modal context
• **Fixed**: URL parameter injection causing malformed embed URLs

### Shell Script Compliance  
• **Fixed**: ShellCheck warnings about variable assignments and source file handling
• **Fixed**: Proper fallback values for environment variables
• **Fixed**: Duplicate function definitions and unused code

### Production Readiness
• **Fixed**: Debug logging in production builds
• **Fixed**: Error message consistency and user-friendliness  
• **Fixed**: Modal sizing and spacing optimization

## 📊 **File Statistics**

• **New Modules**: Visual editor integration system with complete PostMessage handling
• **Major Updates**: Modal interface, configuration system, and documentation
• **Code Quality**: Production cleanup, ShellCheck compliance, and enhanced error handling
• **Documentation**: Comprehensive visual editor documentation and integration guides

## 🔧 **Breaking Changes**

**None** - This release maintains full backward compatibility with v2.3.0

## 📋 **Migration Guide**

### From v2.3.0 to v2.4.0

No migration steps required. All existing functionality continues to work as expected.

**New Feature Activation**:
1. **Visual Editor**: Select "diagramsnet" diagram type to access the Visual Editor button
2. **Server Configuration**: Optionally configure custom Draw.io servers via DRAWIO_SERVER_URL in .env
3. **diagram-tools-hub**: Consider deploying diagram-tools-hub for enhanced local editing capabilities

## 🏗️ **Development Environment**

### Setup Requirements
• Docker & Docker Compose
• Modern web browser (Chrome 86+, Edge 86+, Firefox, Safari)  
• Bash shell for setup scripts
• Optional: diagram-tools-hub for local Draw.io hosting

### Quick Start
```bash
# Clone and start
git clone https://github.com/vppillai/kroki-server.git
cd kroki-server
./setup-kroki-server.sh start

# Access DocCode with Visual Editor
open https://localhost:8443/

# Test visual editor (select "diagramsnet" type)
# Click "Visual Editor" button to access WYSIWYG editing
```

## 🙏 **Acknowledgments**

Special thanks to the community for requesting visual editing capabilities and providing feedback during development. The integration with diagram-tools-hub demonstrates the power of combining complementary open-source tools for enhanced diagram editing workflows.

## 🔗 **Resources**

• **DocCode Frontend**: [https://localhost:8443/](https://localhost:8443/) (after setup)
• **diagram-tools-hub**: [https://github.com/vppillai/diagram-tools-hub](https://github.com/vppillai/diagram-tools-hub)
• **Documentation**: [README.md](https://github.com/vppillai/kroki-server/blob/v2.4.0/README.md)
• **Issue Tracker**: [GitHub Issues](https://github.com/vppillai/kroki-server/issues)
• **Contributing**: [CONTRIBUTING.md](https://github.com/vppillai/kroki-server/blob/v2.4.0/CONTRIBUTING.md)

**Full Changelog**: [v2.3.0...v2.4.0](https://github.com/vppillai/kroki-server/compare/v2.3.0...v2.4.0)

---

This release represents a significant advancement in diagram editing capabilities, bringing professional visual editing tools directly into DocCode while maintaining the powerful code-based approach that makes DocCode unique. The seamless integration between visual and code editing creates a hybrid workflow that caters to different user preferences and editing scenarios.

Special thanks to all users who provided feedback on visual editing requirements and helped shape this comprehensive integration!