/**
 * AI Assistant Module for Kroki Diagram Editor
 *
 * Core class: constructor, init, event binding, drag/resize, sendMessage,
 * sendToAI, makeAIRequest, parseAIResponse, validateAndApplyDiagramCode,
 * config methods.
 *
 * UI creation, API communication, and prompt composition are delegated
 * to ai-assistant-ui.js, ai-assistant-api.js, and ai-assistant-prompts.js.
 */

class AIAssistant {
    /**
     * Create new AI Assistant instance
     * @param {Object} configManager - Configuration manager instance
     */
    constructor(configManager = null) {
        // UI State
        this.isOpen = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.position = { x: 0, y: 0 };

        // API Request State
        this.retryAttempts = 0;
        this.maxRetryAttempts = 3;
        this.currentAbortController = null;
        this.isRequestInProgress = false;

        // Chat State
        this.chatHistory = [];
        this.messageHistory = [];
        this.messageHistoryIndex = -1;
        this.maxMessageHistory = window.APP_CONSTANTS ? window.APP_CONSTANTS.MAX_MESSAGE_HISTORY : 50;
        this.currentDraftMessage = '';

        // Resize functionality state
        this.isResizing = false;
        this.resizeStartY = 0;
        this.initialInputHeight = 0;
        this.minInputHeight = window.APP_CONSTANTS ? window.APP_CONSTANTS.AI_MIN_INPUT_HEIGHT_PX : 60;
        this.maxInputHeight = 300;

        // Configuration
        this.configManager = configManager;

        // Event listener references for cleanup
        this._boundListeners = [];

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    // ========================================
    // INITIALIZATION METHODS
    // ========================================

    init() {
        this.createElements();
        this.setupEventListeners();
        this.loadConfiguration();
    }

    createElements() {
        this.assistButton = window.AIAssistantUI.createAssistButton();
        this.chatWindow = window.AIAssistantUI.createChatWindow();

        this.chatMessages = this.chatWindow.querySelector('#ai-chat-messages');
        this.chatInput = this.chatWindow.querySelector('#ai-chat-input');
        this.chatSend = this.chatWindow.querySelector('#ai-chat-send');
        this.chatStatus = this.chatWindow.querySelector('#ai-chat-status');
        this.chatResizeHandle = this.chatWindow.querySelector('#ai-chat-resize-handle');
        this.chatInputContainer = this.chatWindow.querySelector('.ai-chat-input-container');
        this.modelIndicator = this.chatWindow.querySelector('#ai-model-indicator');
    }

    // ========================================
    // EVENT HANDLING METHODS
    // ========================================

    setupEventListeners() {
        if (!this.assistButton || !this.chatWindow || !this.chatSend || !this.chatInput) {
            console.error('AI Assistant: Required elements not found for event listeners');
            return;
        }

        this.assistButton.addEventListener('click', () => this.toggleChat());

        this.chatWindow.querySelector('.ai-chat-close').addEventListener('click', () => this.closeChat());
        this.chatWindow.querySelector('.ai-chat-minimize').addEventListener('click', () => this.minimizeChat());
        this.chatWindow.querySelector('.ai-chat-settings').addEventListener('click', () => this.openSettings());
        this.chatWindow.querySelector('.ai-model-indicator').addEventListener('click', () => this.openAISettings());

        this.chatSend.addEventListener('click', () => {
            if (this.isRequestInProgress) {
                this.cancelRequest();
            } else {
                this.sendMessage();
            }
        });

        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (this.isRequestInProgress) {
                    this.cancelRequest();
                } else {
                    this.sendMessage();
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateMessageHistory('up');
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateMessageHistory('down');
            } else if (this.messageHistoryIndex !== -1 &&
                !['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
                this.messageHistoryIndex = -1;
            }
        });

        this.chatInput.addEventListener('input', () => {
            this.autoResizeInput();
            if (this.messageHistoryIndex !== -1) {
                this.currentDraftMessage = this.chatInput.value;
            }
        });

        const escapeHandler = (e) => {
            if (e.key === 'Escape' && this.isOpen && this.isChatInFocus()) {
                e.preventDefault();
                this.minimizeChat();
            }
        };
        document.addEventListener('keydown', escapeHandler);
        this._boundListeners.push({ target: document, event: 'keydown', handler: escapeHandler });

        this.setupDragging();
        this.setupResizing();
    }

    // ========================================
    // DRAG AND DROP FUNCTIONALITY
    // ========================================

    setupDragging() {
        const header = this.chatWindow.querySelector('.ai-chat-header');

        const startDragHandler = (e) => this.startDrag(e);
        const dragHandler = (e) => this.drag(e);
        const endDragHandler = () => this.endDrag();

        header.addEventListener('mousedown', startDragHandler);
        document.addEventListener('mousemove', dragHandler);
        document.addEventListener('mouseup', endDragHandler);

        this._boundListeners.push(
            { target: document, event: 'mousemove', handler: dragHandler },
            { target: document, event: 'mouseup', handler: endDragHandler }
        );

        header.style.userSelect = 'none';
        header.style.cursor = 'move';
    }

    startDrag(e) {
        if (e.target.closest('button')) return;
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

    // ========================================
    // RESIZE FUNCTIONALITY
    // ========================================

    setupResizing() {
        if (!this.chatResizeHandle) return;

        const startResizeHandler = (e) => this.startResize(e);
        const resizeHandler = (e) => this.resize(e);
        const endResizeHandler = () => this.endResize();

        this.chatResizeHandle.addEventListener('mousedown', startResizeHandler);
        document.addEventListener('mousemove', resizeHandler);
        document.addEventListener('mouseup', endResizeHandler);

        this._boundListeners.push(
            { target: document, event: 'mousemove', handler: resizeHandler },
            { target: document, event: 'mouseup', handler: endResizeHandler }
        );
    }

    startResize(e) {
        e.preventDefault();
        e.stopPropagation();
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
        const deltaY = this.resizeStartY - e.clientY;
        const newHeight = Math.max(this.minInputHeight, Math.min(this.maxInputHeight, this.initialInputHeight + deltaY));
        this.chatInputContainer.style.height = `${newHeight}px`;
        const wrapperPadding = 24;
        const textareaAvailableHeight = newHeight - wrapperPadding;
        const textareaHeight = Math.max(40, Math.min(textareaAvailableHeight, this.chatInput.scrollHeight || 40));
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

    // ========================================
    // CHAT MANAGEMENT
    // ========================================

    toggleChat() {
        this.isOpen ? this.closeChat() : this.openChat();
    }

    openChat() {
        this.isOpen = true;
        this.assistButton.style.display = 'none';
        this.chatWindow.style.display = 'block';
        this.positionChatWindow();
        this.updateModelIndicator();
        this.chatInput.focus();
        this.scrollToBottom();
    }

    closeChat() {
        this.isOpen = false;
        this.chatWindow.style.display = 'none';
        this.assistButton.style.display = 'flex';
        this.clearChatHistory();
        this.clearMessageHistory();
    }

    clearChatHistory() {
        const systemMessage = this.chatMessages.querySelector('.ai-message.system');
        this.chatMessages.innerHTML = '';
        if (systemMessage) this.chatMessages.appendChild(systemMessage);
        this.chatHistory = this.chatHistory.filter(msg => msg.type === 'system');
    }

    clearMessageHistory() {
        this.messageHistory = [];
        this.messageHistoryIndex = -1;
        this.currentDraftMessage = '';
    }

    minimizeChat() {
        this.isOpen = false;
        this.chatWindow.style.display = 'none';
        this.assistButton.style.display = 'flex';
    }

    positionChatWindow() {
        const diagramContainer = document.getElementById('diagram-container');
        if (!diagramContainer) return;
        const containerRect = diagramContainer.getBoundingClientRect();
        const margin = 20;
        const chatWidth = 400;
        const chatHeight = 500;
        this.position.x = containerRect.right - chatWidth - margin;
        this.position.y = containerRect.bottom - chatHeight - margin;
        this.position.x = Math.max(margin, Math.min(this.position.x, window.innerWidth - chatWidth - margin));
        this.position.y = Math.max(margin, Math.min(this.position.y, window.innerHeight - chatHeight - margin));
        this.updatePosition();
    }

    isChatInFocus() {
        const activeElement = document.activeElement;
        return this.chatWindow.contains(activeElement) || activeElement === this.chatWindow;
    }

    autoResizeInput() {
        const input = this.chatInput;
        input.style.height = 'auto';
        const containerHeight = this.chatInputContainer.offsetHeight;
        const wrapperPadding = 24;
        const maxAllowedHeight = containerHeight - wrapperPadding;
        const contentHeight = input.scrollHeight;
        const newHeight = Math.min(Math.max(contentHeight, 40), maxAllowedHeight);
        input.style.height = newHeight + 'px';
        if (!input.value.trim()) {
            input.style.height = Math.min(40, maxAllowedHeight) + 'px';
        }
        input.offsetHeight; // Force reflow
    }

    // ========================================
    // MESSAGE HANDLING — delegates to AIAssistantUI
    // ========================================

    addToMessageHistory(message) {
        if (!message || !message.trim()) return;
        const existingIndex = this.messageHistory.indexOf(message);
        if (existingIndex !== -1) this.messageHistory.splice(existingIndex, 1);
        this.messageHistory.push(message);
        if (this.messageHistory.length > this.maxMessageHistory) {
            this.messageHistory = this.messageHistory.slice(-this.maxMessageHistory);
        }
    }

    navigateMessageHistory(direction) {
        if (this.messageHistory.length === 0) return;
        if (this.messageHistoryIndex === -1) this.currentDraftMessage = this.chatInput.value;

        if (direction === 'up') {
            if (this.messageHistoryIndex < this.messageHistory.length - 1) {
                this.messageHistoryIndex++;
                const msg = this.messageHistory[this.messageHistory.length - 1 - this.messageHistoryIndex];
                this.chatInput.value = msg;
                this.autoResizeInput();
                this.chatInput.setSelectionRange(msg.length, msg.length);
            }
        } else if (direction === 'down') {
            if (this.messageHistoryIndex > 0) {
                this.messageHistoryIndex--;
                const msg = this.messageHistory[this.messageHistory.length - 1 - this.messageHistoryIndex];
                this.chatInput.value = msg;
                this.autoResizeInput();
                this.chatInput.setSelectionRange(msg.length, msg.length);
            } else if (this.messageHistoryIndex === 0) {
                this.messageHistoryIndex = -1;
                this.chatInput.value = this.currentDraftMessage;
                this.autoResizeInput();
                this.chatInput.setSelectionRange(this.currentDraftMessage.length, this.currentDraftMessage.length);
            }
        }
    }

    addMessage(type, text, rawHtml = false) {
        window.AIAssistantUI.addMessage(this.chatMessages, type, text, rawHtml);
        this.chatHistory.push({ type, text, rawHtml, timestamp: new Date() });
        const maxHistoryLength = 100;
        if (this.chatHistory.length > maxHistoryLength) {
            this.chatHistory.splice(0, this.chatHistory.length - maxHistoryLength);
        }
        this.scrollToBottom();
    }

    scrollToBottom() {
        window.AIAssistantUI.scrollToBottom(this.chatMessages);
    }

    showStatus(message) {
        window.AIAssistantUI.showStatus(this.chatStatus, this.chatInputContainer, this.chatWindow, this.chatMessages, message);
    }

    hideStatus() {
        window.AIAssistantUI.hideStatus(this.chatStatus, this.chatInputContainer, this.chatWindow, this.chatMessages);
    }

    displayMessage(message, messageType = 'ai') {
        const typeMap = {
            'ai': 'assistant', 'ai success': 'assistant-success',
            'ai warning': 'assistant-warning', 'ai error': 'assistant-error',
            'success': 'assistant-success', 'warning': 'assistant-warning', 'error': 'assistant-error'
        };
        this.addMessage(typeMap[messageType] || 'assistant', message);
    }

    addStreamingMessage() {
        return window.AIAssistantUI.addStreamingMessage(this.chatMessages);
    }

    updateStreamingMessage(element, text) {
        if (!element) return;
        element.textContent = text;
        this.scrollToBottom();
    }

    setSendButtonState(isLoading) {
        if (!this.chatSend) return;
        if (isLoading) {
            // SAFE: developer-controlled template
            this.chatSend.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
            this.chatSend.title = 'Cancel request';
            this.chatSend.style.background = 'rgb(239, 68, 68)';
        } else {
            // SAFE: developer-controlled template
            this.chatSend.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>`;
            this.chatSend.title = 'Send message';
            this.chatSend.style.background = 'rgb(59, 130, 246)';
        }
    }

    cancelRequest() {
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
        }
        this.isRequestInProgress = false;
        this.retryAttempts = 0;
        this.setSendButtonState(false);
        this.hideStatus();
        this.addMessage('system', 'Request cancelled by user');
    }

    // ========================================
    // SEND MESSAGE
    // ========================================

    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message || this.isRequestInProgress) return;

        this.addToMessageHistory(message);
        this.addMessage('user', message);
        this.chatInput.value = '';
        this.autoResizeInput();
        this.messageHistoryIndex = -1;
        this.currentDraftMessage = '';

        this.isRequestInProgress = true;
        this.currentAbortController = new AbortController();
        this.setSendButtonState(true);
        this.showStatus('Generating response...');

        try {
            const currentCode = document.getElementById('code')?.value || '';
            const diagramType = document.getElementById('diagramType')?.value || 'plantuml';
            await this.sendToAI(message, currentCode, diagramType);
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error('AI Assistant error:', error);
            this.addMessage('system', `Error: ${error.message}`);
        } finally {
            this.isRequestInProgress = false;
            this.setSendButtonState(false);
            this.hideStatus();
            this.currentAbortController = null;
        }
    }

    // ========================================
    // API COMMUNICATION — delegates to AIAssistantAPI
    // ========================================

    async sendToAI(userPrompt, currentCode, diagramType) {
        const aiConfig = this.getAIConfig();

        if (!aiConfig.enabled) {
            this.addMessage('system', 'AI Assistant is disabled. Please enable it in the settings.');
            return;
        }

        const selectedModel = aiConfig.model === 'custom' ? aiConfig.customModel : aiConfig.model;
        if (!selectedModel) {
            this.addMessage('system', 'No AI model selected. Please choose a model in the <button onclick="window.aiAssistant?.openSettings()">settings</button>.', true);
            return;
        }

        if (aiConfig.useCustomAPI && (!aiConfig.endpoint || !aiConfig.apiKey)) {
            this.addMessage('system', 'Direct API configuration is incomplete. Please set up your API endpoint and key in the <button onclick="window.aiAssistant?.openSettings()">settings</button>.', true);
            return;
        }

        try {
            const isValidModel = await window.AIAssistantAPI.validateModel(selectedModel);
            if (!isValidModel) {
                this.addMessage('system', `Model "${selectedModel}" is not available. Please select a different model in the <button onclick="window.aiAssistant?.openSettings()">settings</button>.`, true);
                return;
            }
        } catch (error) {
            console.warn('Model validation failed:', error);
        }

        try {
            const promptTemplates = await window.AIAssistantAPI.fetchPromptTemplates();
            const composedPrompt = window.AIAssistantPrompts.composePrompt(promptTemplates, {
                diagramType, currentCode, userPrompt,
                useCustomAPI: aiConfig.useCustomAPI,
                userPromptTemplate: aiConfig.userPromptTemplate
            });

            this.retryAttempts = 0;
            await this.makeAIRequest(composedPrompt, diagramType, currentCode, aiConfig, userPrompt);
        } catch (error) {
            console.error('AI Assistant error:', error);
            this.addMessage('system', `Error: ${error.message}`);
        }
    }

    async makeAIRequest(prompt, diagramType, originalCode, aiConfig, originalUserPrompt = '') {
        try {
            let rawResponseContent;

            if (this.retryAttempts > 0) {
                this.showStatus(`Retrying (attempt ${this.retryAttempts + 1}/${aiConfig.maxRetryAttempts + 1})...`);
            }

            const callbacks = {
                addStreamingMessage: () => this.addStreamingMessage(),
                updateStreamingMessage: (el, text) => this.updateStreamingMessage(el, text),
                scrollToBottom: () => this.scrollToBottom()
            };

            if (aiConfig.useCustomAPI && aiConfig.endpoint && aiConfig.apiKey) {
                rawResponseContent = await window.AIAssistantAPI.callCustomAPI(prompt, aiConfig, this.currentAbortController, callbacks);
            } else {
                rawResponseContent = await window.AIAssistantAPI.callProxyAPI(prompt, aiConfig, this.currentAbortController, callbacks);
            }

            if (rawResponseContent.error) throw new Error(rawResponseContent.error);

            const aiParsedResponse = this.parseAIResponse(rawResponseContent);
            const { diagramCode, explanation } = aiParsedResponse;

            if (diagramCode && diagramCode.trim() && diagramCode !== "No diagram generated") {
                if (aiConfig.autoValidate) {
                    const validationResult = await this.validateAndApplyDiagramCode(diagramCode, diagramType);

                    if (validationResult.success) {
                        let msg = explanation;
                        if (this.retryAttempts > 0) msg = this.makeRetryExplanationUserFriendly(explanation, originalUserPrompt);
                        this.displayMessage(`${msg}`, 'ai success');
                    } else if (this.retryAttempts < aiConfig.maxRetryAttempts) {
                        if (!this.isRequestInProgress) return;
                        this.retryAttempts++;
                        this.showStatus(`Diagram rendering failed, refining response (attempt ${this.retryAttempts + 1}/${aiConfig.maxRetryAttempts + 1})...`);

                        const promptTemplates = await window.AIAssistantAPI.fetchPromptTemplates();
                        const retryPrompt = window.AIAssistantPrompts.composeRetryPrompt(
                            prompt, diagramCode,
                            `The diagram code failed to render: ${validationResult.error}. Please fix the syntax.`,
                            originalUserPrompt, diagramType, originalCode, promptTemplates
                        );
                        await this.makeAIRequest(retryPrompt, diagramType, originalCode, aiConfig, originalUserPrompt);
                        return;
                    } else {
                        this.updateDiagramCode(diagramCode);
                        if (window.codeHistory && typeof window.codeHistory.addToHistory === 'function') {
                            window.codeHistory.addToHistory(diagramCode);
                        }
                        this.displayMessage(`${explanation} (Note: Diagram may have rendering issues)`, 'ai warning');
                    }
                } else {
                    this.updateDiagramCode(diagramCode);
                    if (window.codeHistory && typeof window.codeHistory.addToHistory === 'function') {
                        window.codeHistory.addToHistory(diagramCode);
                    }
                    let msg = explanation;
                    if (this.retryAttempts > 0) msg = this.makeRetryExplanationUserFriendly(explanation, originalUserPrompt);
                    this.displayMessage(`${msg}`, 'ai success');
                }
            } else if (!explanation) {
                this.addMessage('system', 'AI did not provide diagram code or an explanation.');
            } else {
                this.addMessage('assistant', explanation);
            }
        } catch (error) {
            if (!this.isRequestInProgress) return;

            if (this.retryAttempts < aiConfig.maxRetryAttempts) {
                if (!this.isRequestInProgress) return;
                this.retryAttempts++;
                this.showStatus(`Network error, retrying (attempt ${this.retryAttempts + 1}/${aiConfig.maxRetryAttempts + 1})...`);
                const delay = Math.min(1000 * Math.pow(2, this.retryAttempts - 1), 5000);
                await new Promise(resolve => setTimeout(resolve, delay));
                await this.makeAIRequest(prompt, diagramType, originalCode, aiConfig);
            } else {
                const errorMessage = error.message.toLowerCase().includes('configuration')
                    ? `${error.message} Check your <button onclick="window.aiAssistant?.openSettings()">AI settings</button>.`
                    : `${error.message}`;
                const hasHtml = errorMessage.includes('<button');
                this.addMessage('system', `${errorMessage}`, hasHtml);
                throw error;
            }
        }
    }

    // ========================================
    // VALIDATION METHODS
    // ========================================

    async validateAndApplyDiagramCode(diagramCode, diagramType) {
        try {
            const codeTextarea = document.getElementById('code');
            const originalCode = codeTextarea ? codeTextarea.value : '';
            this.updateDiagramCode(diagramCode);
            await new Promise(resolve => setTimeout(resolve, 500));
            const validationResult = this.checkDiagramValidation();

            if (!validationResult.success) {
                if (codeTextarea) {
                    codeTextarea.value = originalCode;
                    this.updateDiagramCode(originalCode);
                }
                return { success: false, error: validationResult.error };
            }
            return { success: true, error: null };
        } catch (error) {
            return { success: false, error: `Validation process failed: ${error.message}` };
        }
    }

    checkDiagramValidation() {
        const errorElements = document.querySelectorAll('.error, .error-message, [class*="error"]');
        const hasVisibleErrors = Array.from(errorElements).some(el =>
            el.offsetParent !== null && el.textContent.trim() !== '' &&
            !el.textContent.toLowerCase().includes('no errors')
        );
        if (hasVisibleErrors) return { success: false, error: 'Diagram contains syntax errors visible in the UI' };

        const diagramImage = document.querySelector('#diagram-img, .diagram-image, [id*="diagram"] img');
        if (diagramImage) {
            const imgSrc = diagramImage.src;
            if (imgSrc.includes('error') || imgSrc.includes('invalid') ||
                diagramImage.naturalWidth <= 1 || diagramImage.naturalHeight <= 1) {
                return { success: false, error: 'Diagram image failed to load properly' };
            }
        }

        try {
            if (window.encodeKrokiDiagram) {
                const codeTextarea = document.getElementById('code');
                window.encodeKrokiDiagram(codeTextarea ? codeTextarea.value : '');
            }
        } catch {
            return { success: false, error: 'Diagram code encoding failed' };
        }

        return { success: true, error: null };
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    parseAIResponse(responseContent) {
        let actualStringToParse;

        if (typeof responseContent === 'string') {
            actualStringToParse = responseContent;
        } else if (typeof responseContent === 'object' && responseContent !== null) {
            if (responseContent.choices?.[0]?.message?.content) {
                actualStringToParse = responseContent.choices[0].message.content;
            } else if (typeof responseContent.content === 'string') {
                actualStringToParse = responseContent.content;
            }
        }

        try {
            if (typeof actualStringToParse !== 'string') {
                throw new Error('Content to parse from AI response is not a string.');
            }

            let jsonString = actualStringToParse.trim()
                .replace(/^```json\s*/, '').replace(/\s*```$/, '')
                .replace(/^```\s*/, '').replace(/\s*```$/, '').trim();

            // Try direct parse
            try {
                const parsed = JSON.parse(jsonString);
                if (typeof parsed.diagramCode === 'string' && typeof parsed.explanation === 'string') {
                    return parsed;
                }
            } catch { /* continue */ }

            // Try JSON from code blocks
            const jsonCodeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)```/g;
            for (const match of jsonString.matchAll(jsonCodeBlockRegex)) {
                try {
                    const parsed = JSON.parse(match[1].trim());
                    if (typeof parsed.diagramCode === 'string' && typeof parsed.explanation === 'string') {
                        return parsed;
                    }
                } catch { /* continue */ }
            }

            // Try finding JSON object in text
            const jsonObjectRegex = /\{[\s\S]*?"diagramCode"[\s\S]*?"explanation"[\s\S]*?\}/g;
            for (const match of jsonString.matchAll(jsonObjectRegex)) {
                try {
                    const parsed = JSON.parse(match[0]);
                    if (typeof parsed.diagramCode === 'string' && typeof parsed.explanation === 'string') {
                        return parsed;
                    }
                } catch { /* continue */ }
            }

            // Fallback extraction
            const extractedCode = this._fallbackExtractCode(actualStringToParse);
            if (extractedCode) return extractedCode;

            throw new Error('No valid JSON or extractable diagram code found');
        } catch (e) {
            throw new Error(`AI response was not valid JSON and diagram code could not be extracted. ${e.message}`);
        }
    }

    _fallbackExtractCode(responseText) {
        if (typeof responseText !== 'string') return { diagramCode: '', explanation: 'Invalid response format from AI.' };

        const codeBlockRegex = /```(?:plantuml|mermaid|dot|graphviz|uml|text)?\s*\n?([\s\S]*?)```/g;
        const matches = [...responseText.matchAll(codeBlockRegex)];

        if (matches.length > 0) {
            let longestMatch = matches[0];
            for (const match of matches) {
                if (match[1].trim().length > longestMatch[1].trim().length) longestMatch = match;
            }
            return { diagramCode: longestMatch[1].trim(), explanation: "Extracted diagram code from markdown code block." };
        }

        const lines = responseText.split('\n');
        const diagramLines = [];
        let inDiagram = false;
        const startKeywords = ['@startuml', '@startmindmap', '@startsalt', '@startgantt', 'graph', 'digraph', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'gantt', 'pie', 'flowchart', 'gitgraph', 'erDiagram', 'journey', 'quadrantChart', 'timeline', 'mindmap', 'block-beta'];
        const endKeywords = ['@enduml', '@endmindmap', '@endsalt', '@endgantt', '}'];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!inDiagram && startKeywords.some(kw => trimmed.startsWith(kw))) inDiagram = true;
            if (inDiagram) {
                diagramLines.push(line);
                if (endKeywords.some(kw => trimmed.endsWith(kw))) break;
            }
        }

        const extractedCode = diagramLines.join('\n').trim();
        if (extractedCode) return { diagramCode: extractedCode, explanation: "Extracted diagram code from response text." };

        const structuredContentRegex = /(\w+\s*{\s*[\s\S]*?}|\@\w+[\s\S]*?\@\w+)/g;
        const structuredMatches = [...responseText.matchAll(structuredContentRegex)];
        if (structuredMatches.length > 0) {
            return { diagramCode: structuredMatches[0][0].trim(), explanation: "Extracted structured content from response." };
        }

        return { diagramCode: '', explanation: 'No recognizable diagram code could be extracted. Please try rephrasing.' };
    }

    updateDiagramCode(code) {
        const codeTextarea = document.getElementById('code');
        if (!codeTextarea) return;

        let processedCode = code
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, '\\');

        codeTextarea.value = processedCode;
        codeTextarea.dispatchEvent(new Event('change', { bubbles: true }));
        codeTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    makeRetryExplanationUserFriendly(explanation, originalUserPrompt) {
        let result = explanation;
        const errorFixingPhrases = [
            /Fixed the syntax error by\s*/gi, /Fixed syntax error at\s*/gi,
            /Fixed the error by\s*/gi, /Fixed syntax by\s*/gi,
            /Corrected the syntax error by\s*/gi, /Corrected the error by\s*/gi,
            /Fixed the specific syntax error\s*/gi, /Fixed validation errors?\s*/gi,
            /Resolved the syntax error by\s*/gi, /Fixed the diagram syntax by\s*/gi,
            /Fixed the rendering error by\s*/gi, /\s*to fix the syntax error/gi,
            /\s*to resolve the validation error/gi
        ];
        errorFixingPhrases.forEach(phrase => { result = result.replace(phrase, ''); });
        result = result.replace(/^\s*[.,;]\s*/g, '').replace(/\s+/g, ' ').trim();

        if (result.length < 10 || /^(updated?|created?|generated?|done?)\.?$/gi.test(result)) {
            if (originalUserPrompt) {
                const lp = originalUserPrompt.toLowerCase();
                if (lp.includes('create')) result = "Created the diagram as requested.";
                else if (lp.includes('update') || lp.includes('modify')) result = "Updated the diagram based on your request.";
                else if (lp.includes('add')) result = "Added the requested elements to the diagram.";
                else result = "Generated the diagram successfully.";
            } else {
                result = "Diagram updated successfully.";
            }
        }

        return result.charAt(0).toUpperCase() + result.slice(1);
    }

    // ========================================
    // CONFIGURATION METHODS
    // ========================================

    getConfigManager() { return this.configManager || window.configManager; }

    getAIConfig() {
        const manager = this.getConfigManager();
        if (manager && typeof manager.get === 'function') {
            const aiConfig = manager.get('ai');
            if (aiConfig) {
                return {
                    enabled: aiConfig.enabled !== undefined ? aiConfig.enabled : true,
                    useCustomAPI: aiConfig.useCustomAPI !== undefined ? aiConfig.useCustomAPI : false,
                    endpoint: aiConfig.endpoint || '',
                    apiKey: aiConfig.apiKey || '',
                    model: aiConfig.model || 'openai/gpt-4o',
                    customModel: aiConfig.customModel || '',
                    maxRetryAttempts: aiConfig.maxRetryAttempts !== undefined ? aiConfig.maxRetryAttempts : 3,
                    userPromptTemplate: aiConfig.userPromptTemplate || '',
                    autoValidate: aiConfig.autoValidate !== undefined ? aiConfig.autoValidate : true,
                    timeout: aiConfig.timeout !== undefined ? aiConfig.timeout : 30
                };
            }
        }
        return {
            enabled: true, useCustomAPI: false, endpoint: '', apiKey: '',
            model: 'openai/gpt-4o', customModel: '', maxRetryAttempts: 3,
            userPromptTemplate: '', autoValidate: true, timeout: 30
        };
    }

    loadConfiguration() {
        if (window.configManager) {
            this.applyConfiguration();
            this.setupConfigurationListeners();
        } else {
            document.addEventListener('configSystemReady', () => {
                this.applyConfiguration();
                this.setupConfigurationListeners();
            });
        }
    }

    setupConfigurationListeners() {
        if (this.configManager && typeof this.configManager.on === 'function') {
            this.configManager.on('change', (key) => {
                if (key.startsWith('ai.')) this.updateModelIndicator();
            });
        }
        document.addEventListener('aiConfigChanged', () => this.updateModelIndicator());
    }

    openSettings() {
        if (window.configUI) { window.configUI.open(); window.configUI.switchTab('ai'); }
        else { this.addMessage('system', 'Settings are loading. Please try again in a moment.'); }
    }

    openAISettings() { this.openSettings(); }

    applyConfiguration() {
        const manager = this.getConfigManager();
        if (!manager) return;
        if (!this.configManager && window.configManager) this.configManager = window.configManager;
        try {
            const aiConfig = this.getAIConfig();
            this.maxRetryAttempts = aiConfig.maxRetryAttempts;
            this.updateModelIndicator();
        } catch (error) {
            console.warn('AI Assistant: Error applying configuration:', error);
        }
    }

    updateModelIndicator() {
        if (!this.modelIndicator) return;
        const manager = this.getConfigManager();
        if (!manager) {
            this.modelIndicator.textContent = '...';
            this.modelIndicator.className = 'ai-model-indicator loading';
            return;
        }

        try {
            const config = this.getAIConfig();
            let modelName = config.model || 'openai/gpt-4o';
            if (config.model === 'custom' && config.customModel) modelName = config.customModel;

            const displayName = this.getShortModelName(modelName);
            const sourceIcon = (config.useCustomAPI && config.endpoint && config.apiKey) ? '🔑' : '🌐';

            // SAFE: developer-controlled template with escaped display name
            this.modelIndicator.textContent = `${sourceIcon} ${displayName}`;
            this.modelIndicator.className = `ai-model-indicator ${config.useCustomAPI ? 'custom' : 'proxy'}`;
            this.modelIndicator.title = `Current model: ${modelName}${config.useCustomAPI ? ' (Direct API)' : ' (Backend Proxy)'}`;
        } catch (error) {
            this.modelIndicator.textContent = '';
            this.modelIndicator.className = 'ai-model-indicator error';
        }
    }

    getShortModelName(modelName) {
        if (!modelName) return 'Unknown';
        const parts = modelName.split('/');
        return parts.length > 1 ? parts.slice(1).join('/') : modelName;
    }

    /**
     * Clean up event listeners
     */
    destroy() {
        for (const { target, event, handler } of this._boundListeners) {
            target.removeEventListener(event, handler);
        }
        this._boundListeners = [];
    }
}

window.AIAssistant = AIAssistant;
