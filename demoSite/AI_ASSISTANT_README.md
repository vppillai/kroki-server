# AI Assistant Feature for Kroki Diagram Editor

This document describes the AI Assistant feature implementation for the Kroki Diagram Editor.

## Overview

The AI Assistant provides intelligent diagram generation and editing capabilities by integrating with various AI services like OpenAI GPT, Anthropic Claude, Google Gemini, or local LLM instances.

## Features

### Core Functionality
- **Natural Language Diagram Generation**: Create diagrams using plain English descriptions
- **Code Assistance**: Get help fixing diagram syntax errors or improving existing diagrams
- **Multiple AI Providers**: Support for OpenAI, Anthropic, Google, and local LLMs
- **Diagram Validation**: Automatic validation of AI-generated code against Kroki
- **Smart Retry Logic**: Automatically retry and fix failed diagram generations

### User Interface
- **Floating AI Button**: Easily accessible AI assist button in the bottom-right corner
- **Draggable Chat Window**: Resizable and repositionable chat interface
- **Chat History**: Persistent conversation history within sessions
- **Theme Support**: Matches the editor's light/dark theme
- **Responsive Design**: Works on desktop and mobile devices

### Security & Privacy
- **Proxy API**: Route requests through the Kroki server for enhanced security
- **Origin Validation**: Prevent unauthorized API access
- **API Key Protection**: Secure handling of API credentials
- **Request Sanitization**: Validate and sanitize all user inputs

## Configuration

### Environment Variables

Create a `.env` file in the `demoSite` directory with your AI configuration:

```bash
# Enable/disable AI Assistant
AI_ENABLED=true

# AI API Configuration
AI_ENDPOINT=https://api.openai.com/v1/chat/completions
AI_API_KEY=your_api_key_here
AI_MODEL=gpt-3.5-turbo
AI_TIMEOUT=30
```

### Supported AI Providers

#### OpenAI
```bash
AI_ENDPOINT=https://api.openai.com/v1/chat/completions
AI_MODEL=gpt-4o  # or gpt-3.5-turbo
```

#### Anthropic Claude
```bash
AI_ENDPOINT=https://api.anthropic.com/v1/messages
AI_MODEL=claude-3-sonnet-20240229
```

#### Local LLM (Ollama)
```bash
AI_ENDPOINT=http://localhost:11434/v1/chat/completions
AI_MODEL=llama2
AI_API_KEY=dummy_key_for_local
```

### Frontend Configuration

Users can configure AI settings through the Settings panel:

1. Click the Settings (⚙️) button in the toolbar
2. Navigate to the "AI Assistant" tab
3. Configure:
   - AI endpoint URL
   - API key
   - Model selection
   - Behavior settings
   - Privacy options

## File Structure

```
demoSite/
├── js/
│   ├── ai-assistant.js       # Core AI Assistant functionality
│   ├── config.js             # Configuration with AI settings
│   ├── config-ui.js          # Settings UI with AI tab
│   └── main.js               # Integration and initialization
├── css/
│   └── ai-assistant.css      # AI Assistant styling
├── server.py                 # Backend with AI proxy API
├── requirements.txt          # Python dependencies
└── .env.example             # Example environment configuration
```

## API Endpoints

### `/api/ai-assist` (POST)
Proxy endpoint for AI chat completions.

**Request:**
```json
{
  "messages": [
    {"role": "user", "content": "Create a simple PlantUML sequence diagram"}
  ],
  "config": {
    "endpoint": "https://api.openai.com/v1/chat/completions",
    "api_key": "sk-...",
    "model": "gpt-3.5-turbo"
  }
}
```

**Response:**
```json
{
  "choices": [
    {
      "message": {
        "content": "Here's a simple PlantUML sequence diagram:\n\n```plantuml\n@startuml\nAlice -> Bob: Hello\nBob --> Alice: Hi\n@enduml\n```"
      }
    }
  ]
}
```

### `/api/config` (GET)
Get server AI configuration status.

### `/api/health` (GET)
Health check with AI service status.

## Implementation Details

### AI Assistant Class (`ai-assistant.js`)

The main `AIAssistant` class provides:

- **Chat Management**: Message handling, history management
- **API Integration**: Configurable endpoints and providers
- **UI Components**: Draggable chat window, floating button
- **Validation**: Kroki diagram code validation and retry logic
- **Configuration**: Integration with the configuration system

Key methods:
- `sendMessage()`: Send user messages to AI
- `validateDiagramCode()`: Validate generated code with Kroki
- `updateDiagramCode()`: Update the editor with new code
- `toggleChat()`: Show/hide chat interface

### Backend Proxy (`server.py`)

Flask-based server providing:

- **Static File Serving**: Host the demo site files
- **AI API Proxy**: Secure proxy for AI requests
- **CORS Support**: Cross-origin request handling
- **Error Handling**: Comprehensive error responses
- **Security**: Origin validation and request sanitization

### Configuration System

Extended configuration system with AI-specific settings:

- **Multiple Models**: Support for various AI models
- **Security Options**: Proxy vs direct API access
- **Behavior Settings**: Prompt themes and retry logic
- **Privacy Controls**: Data handling preferences

## Usage Examples

### Creating a New Diagram
1. Click the AI Assistant button (🤖)
2. Type: "Create a flowchart showing a user login process"
3. The AI will generate appropriate diagram code
4. Code is automatically validated and inserted into the editor

### Fixing Diagram Errors
1. Select existing diagram code with errors
2. Ask: "Fix the syntax errors in this PlantUML diagram"
3. AI analyzes the code and provides corrections
4. Choose to apply the fixes or modify further

### Modifying Existing Diagrams
1. With diagram code in the editor, ask: "Add error handling to this sequence diagram"
2. AI understands the context and adds appropriate elements
3. Review and apply the changes

## Security Considerations

### API Key Protection
- Never commit API keys to version control
- Use environment variables or `.env` files
- Consider using the proxy API for additional security

### Request Validation
- All requests are validated for size and format
- Origin checking prevents unauthorized access
- Input sanitization prevents injection attacks

### Privacy
- Chat history is not persistent by default
- Configure data retention policies as needed
- Consider using local LLMs for sensitive diagrams

## Troubleshooting

### Common Issues

**AI Assistant not appearing:**
- Check that `AI_ENABLED=true` in configuration
- Verify JavaScript files are loaded correctly
- Check browser console for errors

**API requests failing:**
- Verify API key is correctly configured
- Check network connectivity to AI service
- Review server logs for error details

**Diagram validation errors:**
- Ensure Kroki server is accessible
- Check that diagram syntax is correct
- Try the retry mechanism for temporary failures

### Debug Mode
Enable debug logging by setting browser console verbosity and checking:
- AI Assistant initialization logs
- API request/response details
- Configuration loading status

## Contributing

When contributing to the AI Assistant feature:

1. Follow the existing code style and patterns
2. Add appropriate error handling and logging
3. Update tests for new functionality
4. Document any new configuration options
5. Consider security implications of changes

## License

This AI Assistant feature is part of the Kroki Diagram Editor and follows the same licensing terms.
