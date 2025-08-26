# AI Assistant Feature Specification for Kroki Diagram Editor - Enhanced Version

## Overview

The AI Assistant provides comprehensive diagram intelligence and editing capabilities integrated directly into the Kroki diagram editor web application. Based on user feedback and expanded use cases, it has evolved from a simple editing assistant to a multi-modal diagram creation, understanding, and optimization platform that supports natural language interactions for creating, explaining, modifying, and improving diagrams.

### Expanded Use Cases

Users have demonstrated three primary interaction patterns:
1. **Diagram Creation**: "Generate a sequence diagram for user authentication"
2. **Diagram Understanding**: "Explain what this architecture diagram shows" 
3. **Iterative Editing**: "Add error handling to this flowchart"
4. **Domain Expertise**: "Make this compliant with BPMN 2.0 standards"

The enhanced AI Assistant addresses all these scenarios with intelligent context awareness and specialized capabilities.

## Enhanced Core Requirements

### Multi-Agent Architecture

The AI Assistant implements a multi-agent system with specialized agents for different interaction patterns:

1. **Agent Types**
   ```javascript
   const AI_AGENTS = {
       CREATOR: {
           name: "Diagram Creator",
           icon: "✨",
           specialization: "Creating new diagrams from descriptions",
           prompt: "creator-system-prompt"
       },
       EXPLAINER: {
           name: "Diagram Explainer", 
           icon: "🔍",
           specialization: "Understanding and explaining diagrams",
           prompt: "explainer-system-prompt"
       },
       EDITOR: {
           name: "Diagram Editor",
           icon: "✏️", 
           specialization: "Modifying and improving existing diagrams",
           prompt: "editor-system-prompt"
       },
       VALIDATOR: {
           name: "Standards Expert",
           icon: "✅",
           specialization: "Standards compliance and best practices",
           prompt: "validator-system-prompt"
       }
   };
   ```

2. **Intent Classification**
   - Automatic detection of user intent from natural language
   - Route requests to appropriate specialized agent
   - Fallback to general-purpose agent for ambiguous requests

3. **Context-Aware Processing**
   - Maintain conversation history across interactions
   - Track diagram evolution over time
   - Remember user preferences and patterns

### Enhanced Prompt Processing

Send composed prompts to the configured AI backend API with rich context:

1. **Advanced Prompt Templates**
   - Agent-specific system prompts for specialized responses
   - Dynamic context injection based on conversation history
   - User-customizable prompt templates for power users
   - Environment-configurable backend prompts via .env file

2. **Rich Context Inclusion**
   - Current diagram type and code
   - Conversation history and previous interactions
   - User preferences and workflow patterns
   - Diagram complexity and quality metrics
   - Related diagrams and project context

3. **Response Formats**
   - Standard JSON: `{"diagramCode": "...", "explanation": "..."}`
   - Enhanced JSON: `{"diagramCode": "...", "explanation": "...", "suggestions": [...], "metadata": {...}}`
   - Analysis responses: `{"analysis": "...", "insights": [...], "recommendations": [...]}`

### Enhanced User Interface

1. **Intelligent Chat Interface**
   - Floating, draggable chat window with agent indicator
   - Active agent display with icon and specialization
   - Resizable input area with drag handle (60px-300px height range)
   - Sticky input positioning at bottom of chat window
   - Proper scrolling for message history
   - Clear visual distinction between user and AI messages
   - Agent switching animations and context preservation

2. **Quick Action System**
   - Context-aware quick action buttons
   - Smart suggestions based on current diagram state
   - One-click common operations
   ```javascript
   const QUICK_ACTIONS = {
       EMPTY_STATE: [
           { text: "✨ Create from description", action: "create-from-text" },
           { text: "📋 Choose template", action: "show-templates" },
           { text: "🎯 Start with example", action: "load-example" }
       ],
       WITH_DIAGRAM: [
           { text: "🔍 Explain this diagram", action: "explain-current" },
           { text: "✏️ Suggest improvements", action: "suggest-improvements" },
           { text: "📱 Make responsive", action: "optimize-layout" }
       ]
   };
   ```

3. **Conversation Modes**
   - **Guided Mode**: Step-by-step assistance with prompts
   - **Expert Mode**: Direct, technical responses
   - **Collaborative Mode**: Back-and-forth ideation

2. **Input Handling**
   - Enter key sends messages
   - Shift+Enter creates new lines
   - Auto-resize input area based on content
   - Send button for mouse/touch users
   - Escape key minimizes chat when focused

3. **Visual Integration**
   - Match application theme (light/dark mode)
   - Consistent styling with main application
   - Professional animations and transitions
   - Mobile-friendly responsive design
4. chat history must be cleared when the user closes the chat window. The chat history must not be persisted across sessions.
5. chat history must be limited to 100 messages, with the oldest messages being removed when the limit is reached.
6. chat history must be displayed in a scrollable area, with the most recent messages at the bottom.
7. chat messages must be displayed in a chat bubble format, with user messages on the right and AI messages on the left.
8. the chat window must show an indicator for the AI response when it is being generated, or error retrys are in progress and the indicator must be removed when the response is received.
9. An indication of whether the system default AI backendo is being used or a user provided API endpoint is being used must be shown in the chat window. This should be a small label at the top of the chat window that indicates "Using Default AI Backend" or "Using User Provided API Endpoint" based on the user's configuration.
10. If the user is using a custom API endpoint, and there are communication errors or unfixable errors with the backend, the chat window must display a clear error message indicating that the AI Assistant is unable to communicate with the backend and include a suggestion to check the API endpoint and key configuration in the settings. The error message must also show a link to the settings modal where the user can update their API endpoint and key configuration. This is not an additional settings requirement, but rather an error handling requirement for the chat window. So just show the same global settings modal that is already implemented in the application.


### additional Ai assistant Settings Panel Requirements

Add a new "AI Assistant" tab in the settings UI with the following configurable options:

1. **API Configuration**
   - checkbox to enable/disable custom API key and endpoint configuration by the user. IF a user does not enable this, the app will use the default backend proxy API. using the backend proxy API is the default behavior.
   - AI Enabled Toggle (default: true)
   - AI Endpoint URL Input (default: https://api.openai.com/v1/chat/completions). enabled only if the user has enabled custom API configuration.
   - API Key Input (default: empty, enabled only if the user has enabled custom API configuration)
   - Model Selector (Default: gpt-4o). enabled only if the user has enabled custom API configuration.
     - Dropdown for selecting AI model
     - Default to "gpt-4o" if available, otherwise fallback to "gpt-4" or "gpt-3.5 Turbo"
     - Allow custom text input for unsupported models
    - Dynamic model loading from backend via `/api/available-models`
    - Models organized by provider (OpenAI, Anthropic, Google, Meta, Mistral)
    - Real-time validation via AI proxy when enabled
    - Fallback to static model list when proxy unavailable
    - Options include:
        - **OpenAI**: GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-4, GPT-3.5 Turbo, O1 Preview, O1 Mini
        - **Anthropic**: Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus, Claude 3 Sonnet, Claude 3 Haiku  
        - **Google**: Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 1.0 Pro
        - **Meta**: Llama 3.1 405B, Llama 3.1 70B, Llama 3.1 8B
        - **Mistral**: Mistral Large, Mistral Medium, Mistral Small
        - **Custom**: User-defined model name

2. **Behavior Settings**
   - Maximum Retry Attempts (default: 3, applies to all users)
   - Custom user Prompt Template Editor (appears when "Custom" is selected)
   - Auto-validate Generated Code (toggle)

3. **Privacy Options**
   
   - Timeout Setting (seconds, default: 30)

These settings apply to both direct and proxied (backend) API usage.

## Backend Support

### AI Proxy Integration (Recommended)

The system supports AI proxies (LiteLLM, OpenRouter, etc.) for unified access to multiple AI providers:

#### Benefits of AI Proxy
- **Multi-Provider Support**: Access OpenAI, Anthropic, Google, Meta, Mistral models through single endpoint
- **Cost Optimization**: Load balancing and routing based on cost/performance preferences  
- **Rate Limiting**: Built-in rate limiting and quota management
- **Failover**: Automatic fallback between providers
- **Monitoring**: Comprehensive logging and analytics
- **Security**: Centralized API key management

#### Configuration
**For LiteLLM:**
```env
AI_PROXY_ENABLED=true
AI_PROXY_URL=http://localhost:4000
AI_PROXY_API_KEY=proxy-key
```

**For OpenRouter:**
```env
AI_PROXY_ENABLED=true
AI_PROXY_URL=https://openrouter.ai/api/v1
AI_PROXY_API_KEY=sk-or-v1-your-key-here
```

#### Dynamic Model Discovery
- Backend fetches available models from proxy via `/v1/models` endpoint
- Frontend receives validated model list with availability status
- Real-time model validation prevents failed requests
- Graceful fallback to static model list if proxy unavailable

### Default API Usage (No User Configuration)

If the user does not configure their own endpoint or API key, the app must send requests to a proxy backend API (AI proxy such as LiteLLM or OpenRouter).

This proxy will:

- Use its own API keys (not exposed to the frontend)
- Handle rate limiting and error management
- Provide enhanced security and logging
- sends responses back to the frontend 
- uses system and user prompt templates from the .env file, which can be updated without modifying the code in the docker-based build system.
- uses API endpoint, model and key from the .env file, which can be updated without modifying the code in the docker-based build system.
- Validate diagram code using Kroki before sending to AI
- Recieves the current diagram type, code and user request as input, and returns a response with the generated code and any error messages.
- provide appropriate error messages for API failures, authentication errors, and other issues.
- support fetching the system prompt and user prompt templates so that it can be used in the frontend when the user is configuring their own API endpoint and key.
    - In this case, the frontend must not allow the user to modify the system prompt template, but it must allow the user to modify the user prompt template.

### Proxy Server Requirements
- Implemented in Python using Flask
- Handle CORS for frontend requests
- allowed domains are configured in the .env file
- Validate request origins to prevent unauthorized access


### Custom API Support

When users configure their own API endpoint and key:
- Send requests directly to the specified endpoint 
    - Fetch the system and user prompt templates from teh proxy server but do not use the proxy server to send requests to the AI provider.
    - In this case, the frontend must not allow the user to modify the system prompt template, but it must allow the user to modify the user prompt template.
- Store credentials securely (not in plain localStorage)
- do not show the API key in plain text unless the user explicitly requests it.
- Handle API responses and errors gracefully
- Validate inputs before sending requests
- Provide appropriate error messages for API failures

## Handling AI responses
- The system and user prompts must be setup in such a way that the AI response is always in the form of a valid JSON object: `{"diagramCode": "...", "explanation": "..."}`.
  - The `diagramCode` field must contain only the raw diagram code, without any additional text or markdown code fences.
  - The `explanation` field should contain a brief, user-friendly summary of the changes made by the AI. This explanation will be displayed in the chat window.
  - The current diagram type and code must be included in the prompt to ensure the AI understands the context. Use prompt templates to ensure the AI requests are formatted correctly and the context is included.
  - If the user asks for something that the AI cannot do, the AI must respond with an appropriate error message in the `explanation` field, and the `diagramCode` field should be empty or contain a message indicating that no code was generated.
- When the AI response (expected as a JSON object) is received, either from the proxy server or directly from the AI provider, the response must first be checked for errors and valid JSON structure.
- The `diagramCode` from the JSON response must be validated to ensure it is valid diagram code. Do this by sending the `diagramCode` to the Kroki API for validation. if a non-200 response is received, the `diagramCode` must be considered invalid.
- The `explanation` from the JSON response should be displayed as an AI message in the chat window.
- in case of an invalid `diagramCode`, the AI Assistant must retry the request by including the original code, the invalid `diagramCode` provided by the AI, the user prompt, and the Kroki validation error message in the prompt. This will help the AI understand what went wrong and how to fix it. The retry request must also ask for the same JSON structured response.
    - this means there must be an additional prompt template for retrying the request, which includes the original code, new code provided by the AI, and the user prompt and kroki validation error message.
- Use the retry count to limit the number of retries for invalid responses.
- The retry indication must be shown in the chat window, so that the user can see how many times the AI has tried to generate a valid response.

## Advanced Features (Phase 2+)

### Diagram Intelligence System

1. **Semantic Analysis**
   ```javascript
   class DiagramIntelligence {
       analyzeDiagram(diagramCode, diagramType) {
           return {
               complexity: this.calculateComplexity(diagramCode),
               components: this.extractComponents(diagramCode),
               relationships: this.analyzeRelationships(diagramCode),
               businessMeaning: this.extractBusinessMeaning(diagramCode),
               recommendations: this.generateRecommendations(diagramCode)
           };
       }
   }
   ```

2. **Multi-Step Diagram Creation**
   - Guided wizards for complex diagrams
   - Step-by-step diagram building with contextual prompts
   - Template-based starting points with customization

3. **Cross-Diagram Operations**
   - Compare multiple diagrams for consistency
   - Merge diagram components intelligently
   - Extract sub-diagrams from complex systems

### Advanced Workflow Features

1. **Documentation Generation**
   - Auto-generate user guides from diagrams
   - Create technical specifications from architecture diagrams
   - Generate process documentation from flowcharts

2. **Quality Assurance**
   - Best practice validation for diagram types
   - Standards compliance checking (BPMN 2.0, UML, etc.)
   - Accessibility and readability optimization

3. **Collaboration Enhancements**
   - Diagram review and commenting system
   - Change impact analysis between versions
   - Team workflow templates and patterns

### Voice and Visual Integration

1. **Voice Commands**
   ```javascript
   class VoiceIntegration {
       processVoiceCommand(audioData) {
           // "Create a flowchart for user onboarding"
           // "Explain the database connections in this diagram"
       }
   }
   ```

2. **Visual Context Processing**
   - Upload sketches or images for diagram inspiration
   - Convert whiteboard photos to structured diagrams
   - Analyze existing visual assets for diagram generation

## Technical Implementation

### Frontend Components

1. **AI Assistant Class**
   - Implement as a self-contained ES6 class
   - Support configuration via config manager or fallback
   - Handle element selection using proper context
   - Provide comprehensive error handling

2. **Chat Window Layout**
   - Use flexbox with proper constraints
   - Implement sticky positioning for input container
   - Ensure scrollable message area with fixed input
   - Support resizable input area via drag handle

3. **Keyboard Navigation**
   - Enter key sends messages (no shift key)
   - Shift+Enter creates new lines
   - Escape key minimizes chat when focused
   - Tab navigation for accessibility

### Backend Components

1. **Proxy Server**
   - Implement in Python using Flask
   - Provide proper CORS handling
   - Validate request origins for security
   - Implement rate limiting and error handling
   - Support environment variable configuration

2. **API Integration**
   - Multiple AI providedr support will be facilitatted with litelllm proxy . 
   - Properly format prompts with context
   - Validate diagram code with Kroki

## Configuration & Environment

### Environment Variables

The backend should support configuration via environment variables:

```env
# Core AI Configuration
AI_ENABLED=true
AI_MODEL=gpt-4o
AI_TIMEOUT=30
AI_MAX_TOKENS=16000

# AI Proxy Configuration (LiteLLM, OpenRouter, etc. - Recommended)
AI_PROXY_ENABLED=true
AI_PROXY_URL=http://localhost:4000
AI_PROXY_API_KEY=proxy-key

# Direct API Configuration (Alternative)
AI_ENDPOINT=https://api.openai.com/v1/chat/completions
AI_API_KEY=your_api_key_here
```

### Model Configuration

Available AI models are defined in `ai-models.json` for easy maintenance and updates. The backend loads this JSON file at startup to populate the available models list. To add new models or providers:

1. Edit `/demoSite/ai-models.json`
2. Add provider and model definitions with metadata (name, context, cost)
3. Restart the server to apply changes
4. The frontend will automatically show new models in the dropdown

### Frontend Configuration

The frontend should store user preferences in the application's configuration system:

```javascript
{
  ai: {
    enabled: true,
    endpoint: "API_ENDPOINT_URL",
    apiKey: "USER_API_KEY", 
    model: "gpt-4o",
    maxRetryAttempts: 3,
    promptTheme: "default",
    autoValidate: true,
    useProxy: true,
    persistHistory: false,
    timeout: 30
  }
}
```

## User Experience Guidelines

1. **First-time Experience**
   - Provide a clear welcome message
   - Explain chat history limitations
   - Suggest example prompts for getting started

2. **Error Handling**
   - Show clear error messages for API failures
   - Provide suggestions for fixing configuration issues
   - Degrade gracefully when backend is unavailable

3. **Performance**
   - Show loading indicators during API requests
   - Maintain responsive UI during heavy operations
   - Implement request timeouts and cancellation

## Security Considerations

1. **API Key Protection**
   - Never expose backend API keys to frontend
   - Securely store user-provided keys
   - Validate origins for all API requests

2. **Input Validation**
   - Sanitize all user inputs
   - Limit request sizes
   - Prevent injection attacks

3. **Data Privacy**
   - Clearly communicate data handling practices
   - Allow users to opt out of persistence
   - Provide options for local-only operation

## Testing Requirements

1. **Layout Testing**
   - Verify input stays at bottom across all scenarios
   - Test with many messages to ensure scrolling works
   - Validate resize functionality within constraints

2. **Functionality Testing**
   - Verify Enter/Shift+Enter behavior
   - Test settings integration and persistence
   - Validate API interactions and error handling

3. **Integration Testing**
   - Ensure compatibility with main application
   - Test configuration system integration
   - Verify theme consistency and responsiveness

## Documentation

Include comprehensive documentation covering:

1. **User Guide**
   - How to access and use the AI Assistant
   - Available prompt patterns and examples
   - Configuration options explained

2. **Technical Documentation**
   - Architecture and component descriptions
   - API endpoints and request formats
   - Configuration schema and options

3. **Developer Guide**
   - How to extend or modify the AI Assistant
   - Integration points with the main application
   - Security and performance considerations

## Starting and Stopping the server for test

you can restart the server with all the changes re-built with the following command:
sudo ./setup-kroki-server.sh restart

the site will be available in https://localhost:8443/ (default port, configurable in .env file)

The Makefile or docker compose files might have to be updated if new files are genrated to make sure they are included in the update

