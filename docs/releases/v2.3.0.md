# Kroki Server v2.3.0

This release includes significant enhancements to the DocCode frontend, configuration system improvements, and better development experience. This release focuses on user interface improvements, auto-refresh functionality, and comprehensive configuration management.

## Changelog

### New Features

• **Enhanced Auto-Refresh System**: Complete redesign of auto-refresh functionality with proper UI synchronization across toolbar button, main page checkbox, and settings modal
• **About Tab**: New about tab in settings with version, build date, author information, and system details including API endpoint information
• **Comprehensive API Documentation**: Added detailed API usage documentation for both GET and POST requests with examples and supported diagram types
• **Advanced Configuration System**: Implemented sophisticated configuration UI with tabs for general settings, editor preferences, zoom controls, layout options, and AI assistant configuration
• **Kroki API Configuration**: Added configuration options for POST requests including URL length threshold and timeout settings
• **Version Management**: Manual version management system via .env file with configurable version, build date, and author information

### Improvements

• **Port Configuration**: Simplified port configuration in README, server script, and Docker setup for single port usage with support for multiple HTTP and HTTPS ports
• **SSL Certificate Generation**: Enhanced SSL certificate generation with proper hostname handling and CN length validation (max 64 characters)
• **Development Experience**: Streamlined setup script with improved .env configuration and removed Docker Compose override template
• **CORS Enhancement**: Enhanced allowed origins for development by adding localhost variants when HOSTNAME is not localhost
• **Health Check**: Added health check functionality for better monitoring and service reliability
• **Configuration Management**: Centralized auto-refresh UI synchronization with better state management and reduced code duplication

### Infrastructure

• **Docker Compose**: Removed redundant networks declaration for nginx service and streamlined container configuration
• **Environment Configuration**: Enhanced .env configuration for multiple ports with dynamic port handling
• **CI/CD**: Updated GitHub Actions workflow configuration for better build processes
• **Git Configuration**: Improved .gitignore with additional patterns for better development experience

### Documentation

• **README**: Comprehensive updates to README with improved port configuration documentation, setup instructions, and API usage examples
• **Contributing**: Updated contributing guidelines and project documentation
• **AI Assistant**: Updated AI assistant specification and documentation

### Bug Fixes

• **Auto-Refresh Synchronization**: Fixed issue where auto-refresh checkbox in settings modal and toolbar button were not properly synchronized
• **Configuration Loading**: Resolved configuration loading issues and improved error handling
• **State Management**: Fixed state management inconsistencies in auto-refresh functionality
• **URL Handling**: Improved URL parameter handling and diagram code encoding/decoding

### Code Quality

• **Modular Architecture**: Better separation of concerns with centralized configuration management
• **Error Handling**: Improved error handling throughout the application
• **Code Deduplication**: Reduced code duplication with centralized UI update functions
• **Documentation**: Enhanced inline code documentation and comments

## Breaking Changes

• Manual version management now required via .env file (removed update-version.sh script)
• Configuration structure changes may require clearing browser local storage for existing users

## Migration Guide

For users upgrading from v2.2.0:

1. **Version Management**: The automatic version update script has been removed. Manually edit the `.env` file to update version, build date, and author information.

2. **Configuration Reset**: Clear browser local storage if experiencing configuration issues:
   ```javascript
   localStorage.clear();
   ```

3. **Port Configuration**: Review and update port configuration in `.env` file using the new simplified format.

## Contributors

[@vpillai](https://github.com/vpillai)

**Full Changelog**: [v2.2.0...v2.3.0](https://github.com/yuzutech/kroki-server/compare/v2.2.0...v2.3.0)

---

This release represents a significant step forward in making the Kroki Server frontend more user-friendly, configurable, and maintainable. The enhanced auto-refresh system and comprehensive configuration management provide a much better user experience, while the improved development setup makes it easier for contributors to get started.

Special thanks to all users who provided feedback and suggestions that helped shape this release!
