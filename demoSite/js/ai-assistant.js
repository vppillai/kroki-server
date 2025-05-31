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
                    AI Assistant
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
                            👋 Hi! I'm your AI diagram assistant. I can help you create ot update your diagram code.
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
        this.chatInput.focus();
        
        // Ensure we're scrolled to bottom when opening
        this.scrollToBottom();
    }

    closeChat() {
        this.isOpen = false;
        this.chatWindow.style.display = 'none';
        this.assistButton.style.display = 'flex';
    }

    minimizeChat() {
        // For now, just close - could implement proper minimize later
        this.closeChat();
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
        const config = window.configManager;
        
        // Get AI configuration (with fallbacks)
        const aiConfig = this.getAIConfig();
        
        // If no endpoint or API key is configured, show a helpful message
        if (!aiConfig.endpoint && !aiConfig.apiKey) {
            this.addMessage('system', '⚠️ AI functionality requires configuration. Please set up your AI endpoint and API key in the settings.');
            return;
        }
        
        // Compose the prompt using the template
        const composedPrompt = this.composePrompt(aiConfig.promptTheme, {
            diagramType,
            currentCode,
            userPrompt
        });
        
        this.retryAttempts = 0;
        await this.makeAIRequest(composedPrompt, diagramType, currentCode);
    }

    async makeAIRequest(prompt, diagramType, originalCode) {
        const aiConfig = this.getAIConfig();
        
        try {
            let response;
            
            if (aiConfig.endpoint && aiConfig.apiKey) {
                // Use custom API endpoint
                response = await this.callCustomAPI(prompt, aiConfig);
            } else {
                // Use proxy backend
                response = await this.callProxyAPI(prompt, aiConfig);
            }
            
            if (response.error) {
                throw new Error(response.error);
            }
            
            const generatedCode = this.extractCodeFromResponse(response.content);
            
            // Validate the generated code with Kroki
            const isValid = await this.validateWithKroki(generatedCode, diagramType);
            
            if (!isValid && this.retryAttempts < this.maxRetryAttempts) {
                this.retryAttempts++;
                this.showStatus(`Refining response (attempt ${this.retryAttempts + 1}/${this.maxRetryAttempts + 1})...`);
                
                // Retry with error feedback
                const retryPrompt = this.composeRetryPrompt(prompt, generatedCode, 'Kroki validation failed');
                await this.makeAIRequest(retryPrompt, diagramType, originalCode);
                return;
            }
            
            // Add AI response to chat
            this.addMessage('assistant', response.content);
            
            // Update diagram code if it contains valid diagram code
            if (generatedCode && generatedCode.trim()) {
                this.updateDiagramCode(generatedCode);
            }
            
        } catch (error) {
            if (this.retryAttempts < this.maxRetryAttempts) {
                this.retryAttempts++;
                this.showStatus(`Retrying (attempt ${this.retryAttempts + 1}/${this.maxRetryAttempts + 1})...`);
                
                // Simple retry on network errors
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.makeAIRequest(prompt, diagramType, originalCode);
            } else {
                throw error;
            }
        }
    }

    async callCustomAPI(prompt, config) {
        const response = await fetch(config.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    { role: 'user', content: prompt }
                ],
                max_tokens: 2000,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return {
            content: data.choices?.[0]?.message?.content || data.content || 'No response generated'
        };
    }

    async callProxyAPI(prompt, config) {
        const response = await fetch('/api/ai-assist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': window.location.origin
            },
            body: JSON.stringify({
                prompt: prompt,
                model: config.model,
                maxRetryAttempts: config.maxRetryAttempts
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API Error: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
    }

    async validateWithKroki(code, diagramType) {
        if (!code || !code.trim()) return false;
        
        try {
            // Use the existing Kroki validation from main.js
            const encodedDiagram = window.encodeKrokiDiagram ? window.encodeKrokiDiagram(code) : this.encodeKrokiDiagram(code);
            
            const protocol = window.location.protocol;
            const hostname = window.location.hostname;
            const port = window.location.port ? `:${window.location.port}` : '';
            const url = `${protocol}//${hostname}${port}/${diagramType}/svg/${encodedDiagram}`;
            
            const response = await fetch(url);
            return response.ok;
        } catch (error) {
            console.warn('Kroki validation failed:', error);
            return false;
        }
    }

    // Fallback encoding function if main.js function is not available
    encodeKrokiDiagram(text) {
        if (window.encodeKrokiDiagram) {
            return window.encodeKrokiDiagram(text);
        }
        
        // Basic implementation - requires pako library
        if (typeof pako !== 'undefined') {
            const bytes = new TextEncoder().encode(text);
            const compressed = pako.deflate(bytes);
            const base64 = btoa(String.fromCharCode.apply(null, compressed));
            return base64.replace(/\+/g, '-').replace(/\//g, '_');
        }
        
        // Fallback to base64 only (less efficient)
        return btoa(text).replace(/\+/g, '-').replace(/\//g, '_');
    }

    composePrompt(template, variables) {
        let prompt = template;
        
        // Replace placeholders with actual values
        prompt = prompt.replace(/\{\{diagramType\}\}/g, variables.diagramType);
        prompt = prompt.replace(/\{\{currentCode\}\}/g, variables.currentCode);
        prompt = prompt.replace(/\{\{userPrompt\}\}/g, variables.userPrompt);
        
        return prompt;
    }

    composeRetryPrompt(originalPrompt, generatedCode, errorMessage) {
        return `${originalPrompt}

Previous attempt generated this code:
\`\`\`
${generatedCode}
\`\`\`

But it failed with error: ${errorMessage}

Please fix the issues and provide corrected diagram code.`;
    }

    extractCodeFromResponse(response) {
        // Try to extract code blocks from markdown format
        const codeBlockRegex = /```(?:\w+)?\s*\n?([\s\S]*?)```/g;
        const matches = [...response.matchAll(codeBlockRegex)];
        
        if (matches.length > 0) {
            return matches[0][1].trim();
        }
        
        // If no code blocks, look for typical diagram syntax
        const lines = response.split('\n');
        const diagramLines = [];
        let inDiagram = false;
        
        for (const line of lines) {
            if (line.includes('@startuml') || line.includes('graph') || line.includes('digraph')) {
                inDiagram = true;
            }
            
            if (inDiagram) {
                diagramLines.push(line);
            }
            
            if (line.includes('@enduml') || (inDiagram && line.trim() === '}')) {
                break;
            }
        }
        
        return diagramLines.join('\n').trim();
    }

    updateDiagramCode(code) {
        const codeTextarea = document.getElementById('code');
        if (codeTextarea) {
            codeTextarea.value = code;
            
            // Trigger the existing update mechanisms
            if (window.updateLineNumbers) {
                window.updateLineNumbers();
            }
            if (window.debounceUpdateDiagram) {
                window.debounceUpdateDiagram();
            }
            if (window.updateUrl) {
                window.updateUrl();
            }
            
            // Mark as modified for file operations
            if (window.markFileAsModified) {
                window.markFileAsModified();
            }
        }
    }

    addMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${type}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'ai-message-content';
        
        if (type === 'assistant' && content.includes('```')) {
            // Format code blocks
            messageContent.innerHTML = this.formatMessageContent(content);
        } else {
            messageContent.textContent = content;
        }
        
        messageDiv.appendChild(messageContent);
        this.chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom smoothly
        this.scrollToBottom();
        
        // Store in history
        this.chatHistory.push({ type, content, timestamp: Date.now() });
    }

    scrollToBottom() {
        // Use smooth scrolling to bottom
        requestAnimationFrame(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        });
    }

    formatMessageContent(content) {
        // Basic markdown-like formatting for code blocks
        return content.replace(/```(\w+)?\s*\n?([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><code>${this.escapeHtml(code.trim())}</code></pre>`;
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showStatus(message) {
        const statusText = this.chatStatus.querySelector('.ai-status-text');
        if (statusText) {
            statusText.textContent = message;
        }
        this.chatStatus.style.display = 'flex';
    }

    hideStatus() {
        this.chatStatus.style.display = 'none';
    }

    getAIConfig() {
        // Try to use the stored config manager reference first
        const config = this.configManager || window.configManager;
        if (!config) {
            // Return default config if system not ready
            return {
                endpoint: '',
                apiKey: '',
                model: 'gpt-4o',
                maxRetryAttempts: 3,
                promptTheme: this.getDefaultPromptTheme()
            };
        }
        
        // Handle different config manager structures
        let endpoint = '';
        let apiKey = '';
        let model = 'gpt-4o';
        let maxRetryAttempts = 3;
        let promptTheme = this.getDefaultPromptTheme();
        
        try {
            if (typeof config.get === 'function') {
                endpoint = config.get('ai.endpoint') || '';
                apiKey = config.get('ai.apiKey') || '';
                model = config.get('ai.model') || 'gpt-4o';
                maxRetryAttempts = config.get('ai.maxRetryAttempts') || 3;
                promptTheme = config.get('ai.promptTheme') || this.getDefaultPromptTheme();
            } else if (typeof config.getConfig === 'function') {
                const aiConfig = config.getConfig().ai || {};
                endpoint = aiConfig.endpoint || '';
                apiKey = aiConfig.apiKey || '';
                model = aiConfig.model || 'gpt-4o';
                maxRetryAttempts = aiConfig.maxRetryAttempts || 3;
                promptTheme = aiConfig.promptTheme || this.getDefaultPromptTheme();
            } else if (config.ai) {
                endpoint = config.ai.endpoint || '';
                apiKey = config.ai.apiKey || '';
                model = config.ai.model || 'gpt-4o';
                maxRetryAttempts = config.ai.maxRetryAttempts || 3;
                promptTheme = config.ai.promptTheme || this.getDefaultPromptTheme();
            }
        } catch (error) {
            console.warn('AI Assistant: Error accessing config, using defaults:', error);
        }
        
        return {
            endpoint,
            apiKey,
            model,
            maxRetryAttempts,
            promptTheme
        };
    }

    getDefaultPromptTheme() {
        return `You are an expert diagram assistant for the Kroki diagram server. 

Current diagram type: {{diagramType}}
Current diagram code:
\`\`\`
{{currentCode}}
\`\`\`

User request: {{userPrompt}}

Please help the user by:
1. If they want to create a new diagram, generate appropriate {{diagramType}} code
2. If they want to modify existing code, provide the updated version
3. If they want to fix errors, provide corrected code
4. Always ensure the code follows proper {{diagramType}} syntax

Provide your response with the diagram code in a code block, and include brief explanations if helpful.`;
    }

    loadConfiguration() {
        // Configuration will be loaded when config system is ready
        if (window.configManager) {
            this.applyConfiguration();
        } else {
            // Wait for config system to be ready
            document.addEventListener('configSystemReady', () => {
                this.applyConfiguration();
            });
        }
    }

    openSettings() {
        // Use the existing ConfigUI instead of custom settings modal
        if (window.configUI) {
            window.configUI.open();
            // Switch to the AI Assistant tab
            window.configUI.switchTab('ai');
        } else {
            console.warn('Configuration UI not available yet');
            this.addMessage('system', '⚠️ Settings are loading. Please try again in a moment.');
        }
    }

    applyConfiguration() {
        const config = this.configManager || window.configManager;
        if (!config) return;
        
        // Apply any visual configuration changes
        try {
            if (typeof config.get === 'function') {
                this.maxRetryAttempts = config.get('ai.maxRetryAttempts') || 3;
            } else if (typeof config.getConfig === 'function') {
                const aiConfig = config.getConfig().ai || {};
                this.maxRetryAttempts = aiConfig.maxRetryAttempts || 3;
            } else if (config.ai) {
                this.maxRetryAttempts = config.ai.maxRetryAttempts || 3;
            }
        } catch (error) {
            console.warn('AI Assistant: Error applying configuration:', error);
        }
    }
}

// Export for use by main.js - but don't auto-initialize
// Initialization is handled by main.js after all dependencies are loaded
