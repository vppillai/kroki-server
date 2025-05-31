/**
 * AI Assistant Module for Kroki Diagram Editor
 * Provides AI-powered diagram generation and editing assistance
 */

class AIAssistant {
    constructor(configManager = null) {
        this.isOpen = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.position = { x: 0, y: 0 };
        this.retryAttempts = 0;
        this.maxRetryAttempts = 3;
        this.chatHistory = [];
        this.configManager = configManager; // Store the config manager reference

        // Resize functionality state
        this.isResizing = false;
        this.resizeStartY = 0;
        this.initialInputHeight = 0;
        this.minInputHeight = 60; // Minimum height for input container
        this.maxInputHeight = 300; // Maximum height for input container

        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        this.createElements();
        this.setupEventListeners();
        this.loadConfiguration();
    }

    createElements() {
        // Create AI Assist button
        this.createAssistButton();
        // Create chat window
        this.createChatWindow();
    }

    createAssistButton() {
        const button = document.createElement('button');
        button.id = 'ai-assist-btn';
        button.className = 'ai-assist-btn';
        button.title = 'AI Assistant - Help with diagram generation';
        button.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
            </svg>
            <span class="ai-assist-label">AI</span>
        `;

        // Position the button at bottom-right of image pane
        const diagramContainer = document.getElementById('diagram-container');
        if (diagramContainer) {
            diagramContainer.appendChild(button);
        }

        this.assistButton = button;
    }

    createChatWindow() {
        const chatWindow = document.createElement('div');
        chatWindow.id = 'ai-chat-window';
        chatWindow.className = 'ai-chat-window';
        chatWindow.style.display = 'none';

        chatWindow.innerHTML = `
            <div class="ai-chat-header">
                <div class="ai-chat-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                        <path d="M2 17l10 5 10-5"/>
                        <path d="M2 12l10 5 10-5"/>
                    </svg>
                    <div class="ai-title-content">
                        <span>AI Assistant</span>
                        <span class="ai-backend-indicator" id="ai-backend-indicator"></span>
                    </div>
                </div>
                <div class="ai-chat-controls">
                    <button class="ai-chat-settings" title="Settings">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                        </svg>
                    </button>
                    <button class="ai-chat-minimize" title="Minimize">−</button>
                    <button class="ai-chat-close" title="Close">×</button>
                </div>
            </div>
            <div class="ai-chat-body">
                <div class="ai-chat-messages" id="ai-chat-messages">
                    <div class="ai-message system">
                        <div class="ai-message-content">
                            👋 Hi! I'm your AI diagram assistant. I can help you create or update your diagram code.
                            <div style="background: rgba(255, 193, 7, 0.1); padding: 8px; border-radius: 4px; margin-top: 10px; font-size: 12px;">
                                ⚠️ <strong>Note:</strong> Each request is independent - I only see your current message and the current diagram code, not our previous conversation history.
                            </div>
                        </div>
                    </div>
                </div>
                <div class="ai-chat-input-container">
                    <div class="ai-chat-resize-handle" id="ai-chat-resize-handle"></div>
                    <div class="ai-chat-status" id="ai-chat-status" style="display: none;">
                        <span class="ai-status-spinner"></span>
                        <span class="ai-status-text">Generating response...</span>
                    </div>
                    <div class="ai-chat-input-wrapper">
                        <textarea 
                            id="ai-chat-input" 
                            class="ai-chat-input" 
                            placeholder="Describe what you want to create or change..."
                            rows="2"
                        ></textarea>
                        <button id="ai-chat-send" class="ai-chat-send" title="Send message">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="22" y1="2" x2="11" y2="13"/>
                                <polygon points="22,2 15,22 11,13 2,9"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(chatWindow);
        this.chatWindow = chatWindow;

        // Get references to chat elements using the chatWindow context
        this.chatMessages = this.chatWindow.querySelector('#ai-chat-messages');
        this.chatInput = this.chatWindow.querySelector('#ai-chat-input');
        this.chatSend = this.chatWindow.querySelector('#ai-chat-send');
        this.chatStatus = this.chatWindow.querySelector('#ai-chat-status');
        this.chatResizeHandle = this.chatWindow.querySelector('#ai-chat-resize-handle');
        this.chatInputContainer = this.chatWindow.querySelector('.ai-chat-input-container');
        this.backendIndicator = this.chatWindow.querySelector('#ai-backend-indicator');

        // Validate that all elements were found
        if (!this.chatMessages || !this.chatInput || !this.chatSend || !this.chatStatus || !this.chatResizeHandle) {
            console.error('AI Assistant: Failed to find chat elements', {
                chatMessages: !!this.chatMessages,
                chatInput: !!this.chatInput,
                chatSend: !!this.chatSend,
                chatStatus: !!this.chatStatus,
                chatResizeHandle: !!this.chatResizeHandle
            });
        }
    }

    setupEventListeners() {
        // Validate elements exist before setting up listeners
        if (!this.assistButton || !this.chatWindow || !this.chatSend || !this.chatInput) {
            console.error('AI Assistant: Required elements not found for event listeners');
            return;
        }

        // Assist button click
        this.assistButton.addEventListener('click', () => this.toggleChat());

        // Chat window controls
        this.chatWindow.querySelector('.ai-chat-close').addEventListener('click', () => this.closeChat());
        this.chatWindow.querySelector('.ai-chat-minimize').addEventListener('click', () => this.minimizeChat());
        this.chatWindow.querySelector('.ai-chat-settings').addEventListener('click', () => this.openSettings());

        // Send message
        this.chatSend.addEventListener('click', () => this.sendMessage());

        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
            // Allow Shift+Enter for new lines (default behavior)
        });

        // Auto-resize chat input
        this.chatInput.addEventListener('input', () => this.autoResizeInput());

        // Escape key to minimize chat
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen && this.isChatInFocus()) {
                e.preventDefault();
                this.minimizeChat();
            }
        });

        // Dragging functionality
        this.setupDragging();

        // Resize functionality
        this.setupResizing();
    }

    setupDragging() {
        const header = this.chatWindow.querySelector('.ai-chat-header');

        header.addEventListener('mousedown', (e) => this.startDrag(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.endDrag());

        // Prevent text selection during drag
        header.style.userSelect = 'none';
        header.style.cursor = 'move';
    }

    startDrag(e) {
        if (e.target.closest('button')) return; // Don't drag when clicking buttons

        this.isDragging = true;
        const rect = this.chatWindow.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;

        this.chatWindow.style.cursor = 'grabbing';
    }

    drag(e) {
        if (!this.isDragging) return;

        e.preventDefault();

        const newX = e.clientX - this.dragOffset.x;
        const newY = e.clientY - this.dragOffset.y;

        // Keep window within viewport bounds
        const maxX = window.innerWidth - this.chatWindow.offsetWidth;
        const maxY = window.innerHeight - this.chatWindow.offsetHeight;

        this.position.x = Math.max(0, Math.min(newX, maxX));
        this.position.y = Math.max(0, Math.min(newY, maxY));

        this.updatePosition();
    }

    endDrag() {
        this.isDragging = false;
        this.chatWindow.style.cursor = '';
    }

    updatePosition() {
        this.chatWindow.style.left = `${this.position.x}px`;
        this.chatWindow.style.top = `${this.position.y}px`;
    }

    setupResizing() {
        if (!this.chatResizeHandle) {
            console.warn('AI Assistant: Resize handle not found');
            return;
        }

        this.chatResizeHandle.addEventListener('mousedown', (e) => this.startResize(e));
        document.addEventListener('mousemove', (e) => this.resize(e));
        document.addEventListener('mouseup', () => this.endResize());
    }

    startResize(e) {
        e.preventDefault();
        e.stopPropagation(); // Prevent triggering drag

        this.isResizing = true;
        this.resizeStartY = e.clientY;
        this.initialInputHeight = this.chatInputContainer.offsetHeight;

        this.chatResizeHandle.classList.add('resizing');
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
    }

    resize(e) {
        if (!this.isResizing) return;

        e.preventDefault();

        const deltaY = this.resizeStartY - e.clientY; // Inverted because we're resizing up
        const newHeight = Math.max(
            this.minInputHeight,
            Math.min(this.maxInputHeight, this.initialInputHeight + deltaY)
        );

        this.chatInputContainer.style.height = `${newHeight}px`;

        // Calculate available height for textarea (account for padding and margins)
        const wrapperPadding = 24; // 12px padding top + 12px padding bottom
        const textareaAvailableHeight = newHeight - wrapperPadding;
        const textareaHeight = Math.max(40, Math.min(textareaAvailableHeight, this.chatInput.scrollHeight || 40));

        // Update both max-height and actual height
        this.chatInput.style.maxHeight = `${textareaAvailableHeight}px`;
        this.chatInput.style.height = `${textareaHeight}px`;
    }

    endResize() {
        if (!this.isResizing) return;

        this.isResizing = false;
        this.chatResizeHandle.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }

    toggleChat() {
        if (this.isOpen) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }

    openChat() {
        this.isOpen = true;
        this.assistButton.style.display = 'none';
        this.chatWindow.style.display = 'block';

        // Position chat window near the button initially
        this.positionChatWindow();

        // Update backend indicator
        this.updateBackendIndicator();

        this.chatInput.focus();

        // Ensure we're scrolled to bottom when opening
        this.scrollToBottom();
    }

    closeChat() {
        this.isOpen = false;
        this.chatWindow.style.display = 'none';
        this.assistButton.style.display = 'flex';

        // Clear chat history when closing
        this.clearChatHistory();
    }

    clearChatHistory() {
        // Clear the chat messages except system message
        const systemMessage = this.chatMessages.querySelector('.ai-message.system');
        this.chatMessages.innerHTML = '';
        if (systemMessage) {
            this.chatMessages.appendChild(systemMessage);
        }

        // Clear history array but keep system messages
        this.chatHistory = this.chatHistory.filter(msg => msg.type === 'system');
    }

    minimizeChat() {
        this.isOpen = false;
        this.chatWindow.style.display = 'none';
        this.assistButton.style.display = 'flex';
        // Don't clear history on minimize, only on close
    }

    positionChatWindow() {
        const diagramContainer = document.getElementById('diagram-container');
        if (!diagramContainer) return;

        const containerRect = diagramContainer.getBoundingClientRect();

        // Position at bottom-right of container, but with some margin
        const margin = 20;
        const chatWidth = 400;
        const chatHeight = 500;

        this.position.x = containerRect.right - chatWidth - margin;
        this.position.y = containerRect.bottom - chatHeight - margin;

        // Ensure it's within viewport
        this.position.x = Math.max(margin, Math.min(this.position.x, window.innerWidth - chatWidth - margin));
        this.position.y = Math.max(margin, Math.min(this.position.y, window.innerHeight - chatHeight - margin));

        this.updatePosition();
    }

    isChatInFocus() {
        // Check if the chat window or any of its elements has focus
        const activeElement = document.activeElement;
        return this.chatWindow.contains(activeElement) || activeElement === this.chatWindow;
    }

    autoResizeInput() {
        const input = this.chatInput;

        // Reset height to auto to get accurate scrollHeight
        input.style.height = 'auto';

        // Get the current container height and calculate available space
        const containerHeight = this.chatInputContainer.offsetHeight;
        const wrapperPadding = 24; // 12px padding top + 12px padding bottom
        const maxAllowedHeight = containerHeight - wrapperPadding;

        // Calculate the new height, constrained by container size and content
        const contentHeight = input.scrollHeight;
        const newHeight = Math.min(Math.max(contentHeight, 40), maxAllowedHeight);
        input.style.height = newHeight + 'px';

        // If input is empty, reset to min height but respect container limits
        if (!input.value.trim()) {
            const minHeight = Math.min(40, maxAllowedHeight);
            input.style.height = minHeight + 'px';
        }

        // Force a reflow to prevent scrollbar glitches
        input.offsetHeight;
    }

    updateBackendIndicator() {
        if (!this.backendIndicator) return;

        // Ensure configManager is available before calling getAIConfig
        if (!this.configManager && !window.configManager) {
            console.warn("AI Assistant: Config manager not available for updateBackendIndicator.");
            this.backendIndicator.textContent = 'Config Loading...';
            this.backendIndicator.className = 'ai-backend-indicator loading';
            return;
        }

        const config = this.getAIConfig();
        if (config.useCustomAPI && config.endpoint && config.apiKey) {
            this.backendIndicator.textContent = 'Using Custom API';
            this.backendIndicator.className = 'ai-backend-indicator custom';
        } else {
            this.backendIndicator.textContent = 'Using Default Backend';
            this.backendIndicator.className = 'ai-backend-indicator default';
        }
    }

    addMessage(type, text, rawHtml = false) {
        if (!this.chatMessages) {
            console.error("AI Assistant: chatMessages element not found, cannot add message.");
            return;
        }

        const messageElement = document.createElement('div');
        messageElement.classList.add('ai-message', type);

        const contentElement = document.createElement('div');
        contentElement.classList.add('ai-message-content');

        if (rawHtml) {
            contentElement.innerHTML = text;
        } else {
            contentElement.textContent = text;
        }

        messageElement.appendChild(contentElement);
        this.chatMessages.appendChild(messageElement);

        // Store message in history (optional, if needed for other features)
        this.chatHistory.push({ type, text, rawHtml, timestamp: new Date() });
        // Limit history size if specified by spec (e.g., 100 messages)
        const maxHistoryLength = 100;
        if (this.chatHistory.length > maxHistoryLength) {
            this.chatHistory.splice(0, this.chatHistory.length - maxHistoryLength);
            // Also remove from DOM if necessary, though simple append/scroll handles visual
            if (this.chatMessages.children.length > maxHistoryLength) {
                // Keep the first system message if it exists
                const systemMessage = this.chatMessages.querySelector('.ai-message.system:first-child');
                let messagesToRemove = this.chatMessages.children.length - maxHistoryLength;
                let currentChild = systemMessage ? systemMessage.nextElementSibling : this.chatMessages.firstElementChild;

                while (currentChild && messagesToRemove > 0) {
                    const nextChild = currentChild.nextElementSibling;
                    if (currentChild !== systemMessage) { // Don't remove the initial system message
                        this.chatMessages.removeChild(currentChild);
                        messagesToRemove--;
                    }
                    currentChild = nextChild;
                }
            }
        }

        this.scrollToBottom();
    }

    scrollToBottom() {
        if (this.chatMessages) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }

    showStatus(message) {
        if (!this.chatStatus) return;
        const statusText = this.chatStatus.querySelector('.ai-status-text');
        if (statusText) {
            statusText.textContent = message;
        }
        this.chatStatus.style.display = 'flex';
    }

    hideStatus() {
        if (!this.chatStatus) return;
        this.chatStatus.style.display = 'none';
    }

    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message) return;

        // Add user message to chat
        this.addMessage('user', message);
        this.chatInput.value = '';
        this.autoResizeInput();

        // Show loading status
        this.showStatus('Generating response...');

        try {
            // Get current diagram context
            const currentCode = document.getElementById('code')?.value || '';
            const diagramType = document.getElementById('diagramType')?.value || 'plantuml';

            // Send to AI API
            await this.sendToAI(message, currentCode, diagramType);

        } catch (error) {
            console.error('AI Assistant error:', error);
            this.addMessage('system', `Error: ${error.message}`);
        } finally {
            this.hideStatus();
        }
    }

    async sendToAI(userPrompt, currentCode, diagramType) {
        // Get AI configuration
        const aiConfig = this.getAIConfig();

        // Check if AI is enabled
        if (!aiConfig.enabled) {
            this.addMessage('system', '⚠️ AI Assistant is disabled. Please enable it in the settings.');
            return;
        }

        // Check configuration based on mode
        if (aiConfig.useCustomAPI) {
            if (!aiConfig.endpoint || !aiConfig.apiKey) {
                this.addMessage('system', '⚠️ Custom API configuration is incomplete. Please set up your API endpoint and key in the <button onclick="window.aiAssistant?.openSettings()">settings</button>.');
                return;
            }
        }

        try {
            // Fetch prompt templates from backend
            const promptTemplates = await this.fetchPromptTemplates();

            // Compose the prompt using the templates
            const composedPrompt = await this.composePrompt(promptTemplates, {
                diagramType,
                currentCode,
                userPrompt,
                useCustomAPI: aiConfig.useCustomAPI,
                userPromptTemplate: aiConfig.userPromptTemplate
            });

            this.retryAttempts = 0;
            await this.makeAIRequest(composedPrompt, diagramType, currentCode, aiConfig);

        } catch (error) {
            console.error('AI Assistant error:', error);
            this.addMessage('system', `❌ Error: ${error.message}`);
        }
    }

    async fetchPromptTemplates() {
        try {
            const response = await fetch('/api/ai-prompts', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': window.location.origin
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch prompt templates: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.warn('Failed to fetch prompt templates, using defaults:', error);
            return {
                system: this.getDefaultSystemPrompt(),
                user: this.getDefaultUserPrompt()
            };
        }
    }

    async makeAIRequest(prompt, diagramType, originalCode, aiConfig) {
        try {
            let rawResponseContent;

            // Show retry indicator if this is a retry attempt
            if (this.retryAttempts > 0) {
                this.showStatus(`🔄 Retrying (attempt ${this.retryAttempts + 1}/${aiConfig.maxRetryAttempts + 1})...`);
            }

            if (aiConfig.useCustomAPI && aiConfig.endpoint && aiConfig.apiKey) {
                // Use custom API endpoint
                rawResponseContent = await this.callCustomAPI(prompt, aiConfig);
            } else {
                // Use proxy backend
                rawResponseContent = await this.callProxyAPI(prompt, aiConfig);
            }

            if (rawResponseContent.error) {
                throw new Error(rawResponseContent.error);
            }

            // Log the raw response for debugging
            console.log('Raw AI Response Content:', rawResponseContent);

            const aiParsedResponse = this.parseAIResponse(rawResponseContent);
            const { diagramCode, explanation } = aiParsedResponse;

            // Validate the generated code if auto-validation is enabled
            let isValid = true;
            if (aiConfig.autoValidate && diagramCode && diagramCode.trim() && diagramCode !== "No diagram generated") { // Added check for "No diagram generated"
                isValid = await this.validateWithKroki(diagramCode, diagramType);

                if (!isValid && this.retryAttempts < aiConfig.maxRetryAttempts) {
                    this.retryAttempts++;
                    this.showStatus(`🔧 Validation failed for diagram code, refining response (attempt ${this.retryAttempts + 1}/${aiConfig.maxRetryAttempts + 1})...`);

                    // Retry with error feedback
                    const retryPrompt = this.composeRetryPrompt(prompt, diagramCode, 'The provided diagramCode failed Kroki validation. Please fix it and ensure the response is a valid JSON object with \'diagramCode\' and \'explanation\'. If the original request is impossible, explain why in the \'explanation\' and set \'diagramCode\' to an empty string.');
                    await this.makeAIRequest(retryPrompt, diagramType, originalCode, aiConfig);
                    return;
                }
            }

            // Add AI explanation to chat
            this.addMessage('assistant', explanation || 'AI provided a response.');

            // Update diagram code if it contains valid diagram code
            // and is not the placeholder for impossible requests
            if (diagramCode && diagramCode.trim() && diagramCode !== "No diagram generated") {
                if (!aiConfig.autoValidate || isValid) {
                    this.updateDiagramCode(diagramCode);
                } else {
                    this.addMessage('system', '⚠️ Generated diagram code failed validation. Please review and modify manually if needed. The AI explanation was: ' + (explanation || 'No explanation provided.'));
                }
            } else if (!explanation) { // If diagramCode is empty/placeholder AND no explanation
                this.addMessage('system', '⚠️ AI did not provide diagram code or an explanation.');
            } else if (diagramCode === "No diagram generated" && explanation) {
                // This is the case where AI correctly stated it cannot generate a diagram.
                // The explanation is already added, so no further action here.
                // console.log("AI correctly handled an impossible request with explanation.");
            }

        } catch (error) {
            if (this.retryAttempts < aiConfig.maxRetryAttempts) {
                this.retryAttempts++;
                this.showStatus(`🔄 Network error, retrying (attempt ${this.retryAttempts + 1}/${aiConfig.maxRetryAttempts + 1})...`);

                // Exponential backoff for retries
                const delay = Math.min(1000 * Math.pow(2, this.retryAttempts - 1), 5000);
                await new Promise(resolve => setTimeout(resolve, delay));
                await this.makeAIRequest(prompt, diagramType, originalCode, aiConfig);
            } else {
                const errorMessage = error.message.toLowerCase().includes('configuration')
                    ? `${error.message} Check your <button onclick="window.aiAssistant?.openSettings()">AI settings</button>.`
                    : `${error.message}`;

                this.addMessage('system', `❌ ${errorMessage}`);
                throw error;
            }
        }
    }

    parseAIResponse(responseContent) {
        let actualStringToParse;

        if (typeof responseContent === 'string') {
            actualStringToParse = responseContent;
        } else if (typeof responseContent === 'object' && responseContent !== null) {
            if (responseContent.choices && Array.isArray(responseContent.choices) && responseContent.choices.length > 0 && responseContent.choices[0].message && typeof responseContent.choices[0].message.content === 'string') {
                actualStringToParse = responseContent.choices[0].message.content;
            } else if (typeof responseContent.content === 'string') {
                actualStringToParse = responseContent.content; // For proxy or direct content if simplified
            } else {
                console.warn('AI response is an object but not in a recognized structure to extract content string:', responseContent);
                // actualStringToParse will be undefined here, leading to an error in the try block, which is handled.
            }
        } else {
            console.warn('AI response is not a string or a recognized object structure:', responseContent);
            // actualStringToParse will be undefined here.
        }

        try {
            if (typeof actualStringToParse !== 'string') {
                // This case handles when actualStringToParse is undefined or not a string due to unexpected responseContent structure
                throw new Error('Content to parse from AI response is not a string.');
            }

            const parsed = JSON.parse(actualStringToParse);

            // Allow diagramCode to be empty or a placeholder string if explanation is present
            if (!(typeof parsed.diagramCode === 'string') || typeof parsed.explanation !== 'string') {
                console.error('AI response JSON does not contain required fields \'diagramCode\' (string) and \'explanation\' (string):', parsed, '\nAttempted to parse:', actualStringToParse);
                throw new Error('AI response JSON format is invalid. Expected \'diagramCode\' and \'explanation\' strings.');
            }
            return { diagramCode: parsed.diagramCode, explanation: parsed.explanation };
        } catch (e) {
            console.error('Failed to parse AI response as JSON:', e.message, '\nAttempted to parse string:', actualStringToParse, '\nOriginal responseContent object was:', responseContent);

            // Fallback: if AI failed to produce JSON, try to extract code from the actualStringToParse.
            const extractedCode = this._fallbackExtractCode(actualStringToParse);

            if (extractedCode) {
                return {
                    diagramCode: extractedCode.diagramCode,
                    explanation: extractedCode.explanation
                };
            }
            // Add the original error message to the new error for more context
            throw new Error(`AI response was not valid JSON and diagram code could not be extracted. Parsing error: ${e.message}`);
        }
    }

    _fallbackExtractCode(responseText) {
        if (typeof responseText !== 'string') return { diagramCode: '', explanation: 'Invalid response format from AI.' }; // Return object
        // Try to extract code blocks from markdown format
        const codeBlockRegex = /```(?:\w+)?\s*\n?([\s\S]*?)```/g;
        const matches = [...responseText.matchAll(codeBlockRegex)];

        if (matches.length > 0) {
            return { diagramCode: matches[0][1].trim(), explanation: "AI response was not in the expected JSON format. Attempted to extract diagram code from markdown." };
        }
        // If no code blocks, look for typical diagram syntax (very basic)
        const lines = responseText.split('\n');
        const diagramLines = [];
        let inDiagram = false;
        const startKeywords = ['@startuml', 'graph', 'digraph', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'gantt', 'pie'];
        const endKeywords = ['@enduml', '}'];

        for (const line of lines) {
            if (startKeywords.some(kw => line.trim().startsWith(kw))) {
                inDiagram = true;
            }
            if (inDiagram) {
                diagramLines.push(line);
            }
            if (inDiagram && endKeywords.some(kw => line.trim().endsWith(kw))) {
                if (line.includes('@enduml') || line.trim() === '}') { // Ensure it's a proper end
                    inDiagram = false; // Stop after the first complete block
                    break;
                }
            }
        }
        const extractedCode = diagramLines.join('\n').trim();
        if (extractedCode) {
            return { diagramCode: extractedCode, explanation: "AI response was not in the expected JSON format. Attempted to extract diagram code directly." };
        }
        return { diagramCode: '', explanation: 'AI response was not valid JSON and no diagram code could be extracted.' }; // Return object
    }

    async callCustomAPI(prompt, config) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), (config.timeout || 30) * 1000);

        try {
            let messages;
            if (typeof prompt === 'object' && prompt.system && prompt.user) {
                // Use system/user message structure
                messages = [
                    { role: 'system', content: prompt.system },
                    { role: 'user', content: prompt.user }
                ];
            } else {
                // Fallback to single user message
                messages = [{ role: 'user', content: prompt }];
            }

            const body = {
                model: config.model === 'custom' ? config.customModel : config.model,
                messages: messages,
                max_tokens: 2000,
                temperature: 0.7
            };

            const response = await fetch(config.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify(body),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data; // Return the full response object
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timed out. Please try again or increase the timeout in settings.');
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async callProxyAPI(prompt, config) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), (config.timeout || 30) * 1000);

        try {
            let messages = [];
            if (typeof prompt === 'object' && prompt.system && prompt.user) {
                messages = [
                    { role: 'system', content: prompt.system },
                    { role: 'user', content: prompt.user }
                ];
            } else if (typeof prompt === 'string') {
                messages = [{ role: 'user', content: prompt }];
            } else {
                console.error('Invalid prompt format for proxy API:', prompt);
                throw new Error('Invalid prompt format for proxy API');
            }

            const response = await fetch('/api/ai-assist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': window.location.origin
                },
                body: JSON.stringify({
                    messages: messages,
                    model: config.model === 'custom' ? config.customModel : config.model,
                    maxRetryAttempts: config.maxRetryAttempts
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `API Error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timed out. Please try again or increase the timeout in settings.');
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async validateWithKroki(code, diagramType) {
        if (!code || !code.trim()) return false;

        try {
            const response = await fetch('/api/validate-diagram', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': window.location.origin
                },
                body: JSON.stringify({
                    code: code,
                    diagramType: diagramType
                })
            });

            if (!response.ok) {
                console.warn('Diagram validation failed:', response.status, response.statusText);
                return false;
            }

            const result = await response.json();
            return result.valid === true;

        } catch (error) {
            console.warn('Diagram validation error:', error);
            return await this.validateWithKrokiDirect(code, diagramType);
        }
    }

    async validateWithKrokiDirect(code, diagramType) {
        try {
            const encodedDiagram = window.encodeKrokiDiagram ? window.encodeKrokiDiagram(code) : this.encodeKrokiDiagram(code);

            const protocol = window.location.protocol;
            const hostname = window.location.hostname;
            const port = window.location.port ? `:${window.location.port}` : '';
            const url = `${protocol}//${hostname}${port}/${diagramType}/svg/${encodedDiagram}`;

            const response = await fetch(url);
            return response.ok;
        } catch (error) {
            console.warn('Direct Kroki validation failed:', error);
            return false;
        }
    }

    encodeKrokiDiagram(text) {
        if (window.encodeKrokiDiagram) {
            return window.encodeKrokiDiagram(text);
        }

        if (typeof pako !== 'undefined') {
            const bytes = new TextEncoder().encode(text);
            const compressed = pako.deflate(bytes);
            const base64 = btoa(String.fromCharCode.apply(null, compressed));
            return base64.replace(/\+/g, '-').replace(/\//g, '_');
        }

        return btoa(text).replace(/\+/g, '-').replace(/\//g, '_');
    }

    async composePrompt(promptTemplates, variables) {
        const { diagramType, currentCode, userPrompt, useCustomAPI, userPromptTemplate } = variables;

        let systemPrompt = promptTemplates.system || this.getDefaultSystemPrompt();
        let userPromptText;

        if (useCustomAPI && userPromptTemplate) {
            userPromptText = userPromptTemplate;
        } else {
            userPromptText = promptTemplates.user || this.getDefaultUserPrompt();
        }

        systemPrompt = systemPrompt
            .replace(/\{\{diagramType\}\}/g, diagramType)
            .replace(/\{\{currentCode\}\}/g, currentCode || 'No existing code');

        userPromptText = userPromptText
            .replace(/\{\{diagramType\}\}/g, diagramType)
            .replace(/\{\{currentCode\}\}/g, currentCode || 'No existing code')
            .replace(/\{\{userPrompt\}\}/g, userPrompt);

        if (!useCustomAPI) {
            return `${systemPrompt}\n\n${userPromptText}`;
        }

        return {
            system: systemPrompt,
            user: userPromptText
        };
    }

    getDefaultSystemPrompt() {
        return `You are an expert diagram assistant for the Kroki diagram server. You help users create and modify diagrams using various diagram languages supported by Kroki.

Current diagram type: {{diagramType}}
Current diagram code: {{currentCode}}

Your role is to:
1. Generate correct diagram code in the specified format
2. Modify existing code based on user requests  
3. Fix syntax errors and improve diagram structure
4. Provide helpful explanations when needed

Always ensure your code follows proper syntax for the diagram type and is compatible with Kroki.`;
    }

    getDefaultUserPrompt() {
        return `Please help me with this diagram request: {{userPrompt}}

Current diagram type: {{diagramType}}
Current code: {{currentCode}}

Please provide the updated or new diagram code in a code block, along with a brief explanation of the changes.`;
    }

    composeRetryPrompt(originalPrompt, failedCode, validationError) {
        // Ensure originalPrompt is an object with system and user properties
        let systemContent = this.getDefaultSystemPrompt(); // Fallback
        let userContent = '';

        if (typeof originalPrompt === 'object' && originalPrompt.system && originalPrompt.user) {
            systemContent = originalPrompt.system;
            userContent = originalPrompt.user;
        } else if (typeof originalPrompt === 'string') { // If originalPrompt was just a string
            userContent = originalPrompt;
        } else if (typeof originalPrompt === 'object' && originalPrompt.user) { // If it was an object with only user
            userContent = originalPrompt.user;
        }

        const retryUserPrompt = `The previous attempt to generate diagram code resulted in an error or invalid output.
Original user request: ${userContent.includes("Original user request:") ? userContent.split("Original user request:")[1].split("Current diagram code:")[0].trim() : userContent}
Current diagram code was: ${userContent.includes("Current diagram code:") ? userContent.split("Current diagram code:")[1].split("Diagram type:")[0].trim() : 'Not available'}
Diagram type: ${userContent.includes("Diagram type:") ? userContent.split("Diagram type:")[1].trim() : 'Not available'}
The AI previously generated this code:
\`\`\`
${failedCode}
\`\`\`
This code failed validation with the error: "${validationError}"

Please analyze the original request, the previous code, and the validation error.
Then, provide a corrected response.
Your response MUST be a JSON object string in the 'content' field of your message, with 'diagramCode' and 'explanation' keys.
If the original request is impossible or cannot be fixed, set 'diagramCode' to an empty string or a message like 'No diagram generated' and explain why in the 'explanation' field.
Example of the exact string required for the 'content' field: '{"diagramCode": "corrected diagram code", "explanation": "Explanation of the fix or why it cannot be fixed."}'
Do NOT include ANY other text, introductions, or conversational phrases in the 'content' field. The 'content' field of your message must be *exclusively* this JSON string.`;

        return {
            system: systemContent, // Reuse the original system prompt that enforces JSON output
            user: retryUserPrompt
        };
    }

    getAIConfig() {
        const manager = this.configManager || window.configManager;
        if (manager && typeof manager.get === 'function') {
            const aiConfig = manager.get('ai');
            if (aiConfig) {
                return {
                    enabled: aiConfig.enabled !== undefined ? aiConfig.enabled : true,
                    useCustomAPI: aiConfig.useCustomAPI !== undefined ? aiConfig.useCustomAPI : !aiConfig.useProxy, // Assuming useProxy is the inverse
                    endpoint: aiConfig.endpoint || '',
                    apiKey: aiConfig.apiKey || '',
                    model: aiConfig.model || 'gpt-4o',
                    customModel: aiConfig.customModel || '',
                    maxRetryAttempts: aiConfig.maxRetryAttempts !== undefined ? aiConfig.maxRetryAttempts : 3,
                    userPromptTemplate: aiConfig.userPromptTemplate || '',
                    autoValidate: aiConfig.autoValidate !== undefined ? aiConfig.autoValidate : true,
                    timeout: aiConfig.timeout !== undefined ? aiConfig.timeout : 30
                };
            }
        }
        // Return default config if manager or 'ai' config is not found
        console.warn("AI Assistant: AI config not found, using defaults for getAIConfig.");
        return {
            enabled: true,
            useCustomAPI: false,
            endpoint: '',
            apiKey: '',
            model: 'gpt-4o',
            customModel: '',
            maxRetryAttempts: 3,
            userPromptTemplate: '',
            autoValidate: true,
            timeout: 30
        };
    }

    loadConfiguration() {
        if (window.configManager) {
            this.applyConfiguration();
        } else {
            document.addEventListener('configSystemReady', () => {
                this.applyConfiguration();
            });
        }
    }

    openSettings() {
        if (window.configUI) {
            window.configUI.open();
            window.configUI.switchTab('ai');
        } else {
            console.warn('Configuration UI not available yet');
            this.addMessage('system', '⚠️ Settings are loading. Please try again in a moment.');
        }
    }

    applyConfiguration() {
        const manager = this.configManager || window.configManager; // Use local first, then global
        if (!manager) {
            console.warn("AI Assistant: ConfigManager not available for applyConfiguration.");
            return;
        }
        // If this.configManager was not set by constructor, set it now if window.configManager is available
        if (!this.configManager && window.configManager) {
            this.configManager = window.configManager;
        }

        try {
            const aiConfig = this.getAIConfig();
            this.maxRetryAttempts = aiConfig.maxRetryAttempts;

            this.updateBackendIndicator();

        } catch (error) {
            console.warn('AI Assistant: Error applying configuration:', error);
        }
    }
}

// Export for use by main.js - but don't auto-initialize
// Initialization is handled by main.js after all dependencies are loaded
