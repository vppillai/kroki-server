/**
 * AI Assistant Module for Kroki Diagram Editor
 * Provides AI-powered diagram generation and editing assistance
 * 
 * Class Organization:
 * - INITIALIZATION METHODS: Setup and DOM creation
 * - EVENT HANDLING METHODS: User interaction handlers
 * - DRAG AND DROP FUNCTIONALITY: Window positioning
 * - RESIZE FUNCTIONALITY: Chat window resizing
 * - CHAT MANAGEMENT: Window state and history management
 * - MESSAGE HANDLING: Chat message display and navigation
 * - API COMMUNICATION: AI service integration
 * - VALIDATION METHODS: Diagram code validation
 * - UTILITY METHODS: Parsing and encoding helpers
 * - PROMPT COMPOSITION: AI prompt generation
 * - CONFIGURATION METHODS: Settings and configuration
 */

// Configuration constants
const AI_MAX_TOKENS = 16000; // Token limit for AI responses

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
        this.maxMessageHistory = 50;
        this.currentDraftMessage = '';

        // Resize functionality state
        this.isResizing = false;
        this.resizeStartY = 0;
        this.initialInputHeight = 0;
        this.minInputHeight = 60;
        this.maxInputHeight = 300;

        // Configuration
        this.configManager = configManager;

        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    // ========================================
    // INITIALIZATION METHODS
    // ========================================

    /**
     * Initialize the AI Assistant
     */
    init() {
        this.createElements();
        this.setupEventListeners();
        this.loadConfiguration();
    }

    /**
     * Create all UI elements
     */
    createElements() {
        // Create AI Assist button
        this.createAssistButton();
        // Create chat window
        this.createChatWindow();
    }

    /**
     * Create the AI assistant button
     */
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

    /**
     * Create the floating chat window
     */
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
                        <span>AI Assistant <span class="ai-beta-badge">BETA</span></span>
                        <button class="ai-model-indicator" id="ai-model-indicator" title="Click to change AI model"></button>
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
        this.modelIndicator = this.chatWindow.querySelector('#ai-model-indicator');

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

    // ========================================
    // EVENT HANDLING METHODS
    // ========================================

    /**
     * Set up all event listeners for the UI elements
     */
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
        
        // Model indicator click to open AI settings
        this.chatWindow.querySelector('.ai-model-indicator').addEventListener('click', () => this.openAISettings());

        // Send message
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
                // User is typing something other than navigation keys - reset navigation
                this.messageHistoryIndex = -1;
            }
            // Allow Shift+Enter for new lines (default behavior)
        });

        // Auto-resize chat input and reset message history navigation on manual input
        this.chatInput.addEventListener('input', () => {
            this.autoResizeInput();
            // Reset navigation state when user manually types (unless we're navigating)
            if (this.messageHistoryIndex !== -1) {
                // User is manually editing while navigating - update the current message
                this.currentDraftMessage = this.chatInput.value;
            }
        });

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

    // ========================================
    // DRAG AND DROP FUNCTIONALITY
    // ========================================

    /**
     * Set up drag functionality for the chat window
     * Allows users to move the chat window around the screen
     */
    setupDragging() {
        const header = this.chatWindow.querySelector('.ai-chat-header');

        header.addEventListener('mousedown', (e) => this.startDrag(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.endDrag());

        // Prevent text selection during drag
        header.style.userSelect = 'none';
        header.style.cursor = 'move';
    }

    /**
     * Start dragging the chat window
     * @param {MouseEvent} e - Mouse event
     */
    startDrag(e) {
        if (e.target.closest('button')) return; // Don't drag when clicking buttons

        this.isDragging = true;
        const rect = this.chatWindow.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;

        this.chatWindow.style.cursor = 'grabbing';
    }

    /**
     * Handle drag movement
     * @param {MouseEvent} e - Mouse event
     */
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

    /**
     * End dragging operation
     */
    endDrag() {
        this.isDragging = false;
        this.chatWindow.style.cursor = '';
    }

    /**
     * Update chat window position on screen
     */
    updatePosition() {
        this.chatWindow.style.left = `${this.position.x}px`;
        this.chatWindow.style.top = `${this.position.y}px`;
    }

    // ========================================
    // RESIZE FUNCTIONALITY
    // ========================================

    /**
     * Set up resize functionality for the chat input area
     */
    setupResizing() {
        if (!this.chatResizeHandle) {
            console.warn('AI Assistant: Resize handle not found');
            return;
        }

        this.chatResizeHandle.addEventListener('mousedown', (e) => this.startResize(e));
        document.addEventListener('mousemove', (e) => this.resize(e));
        document.addEventListener('mouseup', () => this.endResize());
    }

    /**
     * Start resizing the chat input area
     * @param {MouseEvent} e - Mouse event
     */
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

    /**
     * Handle resize movement
     * @param {MouseEvent} e - Mouse event
     */
    resize(e) {
        if (!this.isResizing) return;

        e.preventDefault();

        const deltaY = this.resizeStartY - e.clientY; // Inverted because we're resizing up
        const newHeight = Math.max(
            this.minInputHeight,
            Math.min(this.maxInputHeight, this.initialInputHeight + deltaY)
        );

        this.chatInputContainer.style.height = `${newHeight}px`;

        // Calculate available height for textarea
        const wrapperPadding = 24; // 12px padding top + 12px padding bottom
        const textareaAvailableHeight = newHeight - wrapperPadding;
        const textareaHeight = Math.max(40, Math.min(textareaAvailableHeight, this.chatInput.scrollHeight || 40));

        // Update both max-height and actual height
        this.chatInput.style.maxHeight = `${textareaAvailableHeight}px`;
        this.chatInput.style.height = `${textareaHeight}px`;
    }

    /**
     * End resizing operation
     */
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

    /**
     * Toggle chat window open/closed state
     */
    toggleChat() {
        if (this.isOpen) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }

    /**
     * Open chat window
     */
    openChat() {
        this.isOpen = true;
        this.assistButton.style.display = 'none';
        this.chatWindow.style.display = 'block';

        // Position chat window near the button initially
        this.positionChatWindow();

        // Update model indicator
        this.updateModelIndicator();

        this.chatInput.focus();

        // Ensure we're scrolled to bottom when opening
        this.scrollToBottom();
    }

    /**
     * Close chat window and clear history
     */
    closeChat() {
        this.isOpen = false;
        this.chatWindow.style.display = 'none';
        this.assistButton.style.display = 'flex';

        // Clear chat history when closing
        this.clearChatHistory();
        this.clearMessageHistory();
    }

    /**
     * Clear chat message history while preserving system messages
     */
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

    /**
     * Clear message history for up/down arrow navigation
     */
    clearMessageHistory() {
        this.messageHistory = [];
        this.messageHistoryIndex = -1;
        this.currentDraftMessage = '';
    }

    /**
     * Minimize chat window without clearing history
     */
    minimizeChat() {
        this.isOpen = false;
        this.chatWindow.style.display = 'none';
        this.assistButton.style.display = 'flex';
        // Don't clear history on minimize, only on close
    }

    /**
     * Position chat window in optimal location
     */
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

    /**
     * Check if chat window or its elements have focus
     * @returns {boolean} True if chat is focused
     */
    isChatInFocus() {
        // Check if the chat window or any of its elements has focus
        const activeElement = document.activeElement;
        return this.chatWindow.contains(activeElement) || activeElement === this.chatWindow;
    }

    /**
     * Auto-resize chat input based on content
     */
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

    // ========================================
    // MESSAGE HANDLING
    // ========================================

    /**
     * Add a message to the message history for navigation
     */
    addToMessageHistory(message) {
        if (!message || !message.trim()) return;

        // Remove duplicate if it exists
        const existingIndex = this.messageHistory.indexOf(message);
        if (existingIndex !== -1) {
            this.messageHistory.splice(existingIndex, 1);
        }

        // Add to end of history
        this.messageHistory.push(message);

        // Limit history size
        if (this.messageHistory.length > this.maxMessageHistory) {
            this.messageHistory = this.messageHistory.slice(-this.maxMessageHistory);
        }
    }

    /**
     * Navigate through message history with up/down arrows
     */
    navigateMessageHistory(direction) {
        if (this.messageHistory.length === 0) return;

        // If we're starting navigation, store the current draft
        if (this.messageHistoryIndex === -1) {
            this.currentDraftMessage = this.chatInput.value;
        }

        if (direction === 'up') {
            // Navigate backwards through history (newer to older)
            if (this.messageHistoryIndex < this.messageHistory.length - 1) {
                this.messageHistoryIndex++;
                const historyMessage = this.messageHistory[this.messageHistory.length - 1 - this.messageHistoryIndex];
                this.chatInput.value = historyMessage;
                this.autoResizeInput();
                // Move cursor to end
                this.chatInput.setSelectionRange(historyMessage.length, historyMessage.length);
            }
        } else if (direction === 'down') {
            // Navigate forwards through history (older to newer)
            if (this.messageHistoryIndex > 0) {
                this.messageHistoryIndex--;
                const historyMessage = this.messageHistory[this.messageHistory.length - 1 - this.messageHistoryIndex];
                this.chatInput.value = historyMessage;
                this.autoResizeInput();
                // Move cursor to end
                this.chatInput.setSelectionRange(historyMessage.length, historyMessage.length);
            } else if (this.messageHistoryIndex === 0) {
                // Return to the draft message
                this.messageHistoryIndex = -1;
                this.chatInput.value = this.currentDraftMessage;
                this.autoResizeInput();
                // Move cursor to end
                this.chatInput.setSelectionRange(this.currentDraftMessage.length, this.currentDraftMessage.length);
            }
        }
    }

    /**
     * Add a message to the chat window
     * @param {string} type - Message type ('user', 'assistant', 'system', etc.)
     * @param {string} text - Message content
     * @param {boolean} rawHtml - Whether to render text as HTML
     */
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
            // Preserve whitespace and line breaks for user messages
            if (type === 'user') {
                contentElement.style.whiteSpace = 'pre-wrap';
                contentElement.textContent = text;
            } else {
                contentElement.textContent = text;
            }
        }

        messageElement.appendChild(contentElement);
        this.chatMessages.appendChild(messageElement);

        // Store message in history
        this.chatHistory.push({ type, text, rawHtml, timestamp: new Date() });
        // Limit history size
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

    /**
     * Scroll chat messages to bottom
     */
    scrollToBottom() {
        if (this.chatMessages) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }

    /**
     * Show status message in chat window
     * @param {string} message - Status message to display
     */
    showStatus(message) {
        if (!this.chatStatus) return;
        const statusText = this.chatStatus.querySelector('.ai-status-text');
        if (statusText) {
            statusText.textContent = message;
        }
        this.chatStatus.style.display = 'flex';

        // Add class to input container for visual feedback
        if (this.chatInputContainer) {
            this.chatInputContainer.classList.add('status-visible');
        }

        // Add class to chat body to adjust messages area
        if (this.chatWindow) {
            const chatBody = this.chatWindow.querySelector('.ai-chat-body');
            if (chatBody) {
                chatBody.classList.add('status-active');
            }
        }

        // Adjust messages area to prevent overlap
        if (this.chatMessages) {
            this.chatMessages.style.marginBottom = '45px';
            // Force scroll to bottom to ensure last message is visible
            setTimeout(() => this.scrollToBottom(), 100);
        }

        // Add subtle pulse animation to status text
        if (statusText) {
            statusText.style.animation = 'statusTextPulse 2s ease-in-out infinite';
        }
    }

    /**
     * Hide status message from chat window
     */
    hideStatus() {
        if (!this.chatStatus) return;

        // Add fade out animation before hiding
        this.chatStatus.style.animation = 'statusSlideOut 0.2s ease-in';

        setTimeout(() => {
            this.chatStatus.style.display = 'none';
            this.chatStatus.style.animation = '';

            // Remove class from input container
            if (this.chatInputContainer) {
                this.chatInputContainer.classList.remove('status-visible');
            }

            // Remove class from chat body
            if (this.chatWindow) {
                const chatBody = this.chatWindow.querySelector('.ai-chat-body');
                if (chatBody) {
                    chatBody.classList.remove('status-active');
                }
            }

            // Reset messages area margin
            if (this.chatMessages) {
                this.chatMessages.style.marginBottom = '10px';
            }

            // Remove text animation
            const statusText = this.chatStatus.querySelector('.ai-status-text');
            if (statusText) {
                statusText.style.animation = '';
            }
        }, 200);
    }

    /**
     * Display a message with appropriate styling
     * @param {string} message - Message content
     * @param {string} messageType - Message type for styling
     */
    displayMessage(message, messageType = 'ai') {
        // Map message types to appropriate CSS classes
        const typeMap = {
            'ai': 'assistant',
            'ai success': 'assistant-success',
            'ai warning': 'assistant-warning',
            'ai error': 'assistant-error',
            'success': 'assistant-success',
            'warning': 'assistant-warning',
            'error': 'assistant-error'
        };

        const cssClass = typeMap[messageType] || 'assistant';
        this.addMessage(cssClass, message);
    }

    /**
     * Set the state of the send button (loading/normal)
     * @param {boolean} isLoading - Whether request is in progress
     */
    setSendButtonState(isLoading) {
        if (!this.chatSend) return;

        if (isLoading) {
            this.chatSend.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
            `;
            this.chatSend.title = 'Cancel request';
            this.chatSend.style.background = 'rgb(239, 68, 68)';
        } else {
            this.chatSend.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22,2 15,22 11,13 2,9"/>
                </svg>
            `;
            this.chatSend.title = 'Send message';
            this.chatSend.style.background = 'rgb(59, 130, 246)';
        }
    }

    /**
     * Cancel current AI request
     */
    cancelRequest() {
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
        }

        this.isRequestInProgress = false;
        this.retryAttempts = 0; // Reset retry counter
        this.setSendButtonState(false);
        this.hideStatus();

        this.addMessage('system', '🚫 Request cancelled by user');
    }

    /**
     * Send user message to AI assistant
     */
    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message || this.isRequestInProgress) return;

        // Store message in history for up/down arrow navigation
        this.addToMessageHistory(message);

        // Add user message to chat
        this.addMessage('user', message);
        this.chatInput.value = '';
        this.autoResizeInput();

        // Reset message history navigation
        this.messageHistoryIndex = -1;
        this.currentDraftMessage = '';

        // Set up request cancellation
        this.isRequestInProgress = true;
        this.currentAbortController = new AbortController();
        this.setSendButtonState(true);

        // Show loading status
        this.showStatus('Generating response...');

        try {
            // Get current diagram context
            const currentCode = document.getElementById('code')?.value || '';
            const diagramType = document.getElementById('diagramType')?.value || 'plantuml';

            // Send to AI API
            await this.sendToAI(message, currentCode, diagramType);

        } catch (error) {
            if (error.name === 'AbortError') {
                // Request was cancelled, no need to show error
                return;
            }
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
    // API COMMUNICATION
    // ========================================

    /**
     * Send user prompt to AI with context
     * @param {string} userPrompt - User's request
     * @param {string} currentCode - Current diagram code
     * @param {string} diagramType - Type of diagram
     */
    async sendToAI(userPrompt, currentCode, diagramType) {
        // Get AI configuration
        const aiConfig = this.getAIConfig();

        // Check if AI is enabled
        if (!aiConfig.enabled) {
            this.addMessage('system', '⚠️ AI Assistant is disabled. Please enable it in the settings.');
            return;
        }

        // Validate selected model
        const selectedModel = aiConfig.model === 'custom' ? aiConfig.customModel : aiConfig.model;
        if (!selectedModel) {
            this.addMessage('system', '⚠️ No AI model selected. Please choose a model in the <button onclick="window.aiAssistant?.openSettings()">settings</button>.', true);
            return;
        }

        // Validate configuration based on mode
        if (aiConfig.useCustomAPI) {
            if (!aiConfig.endpoint || !aiConfig.apiKey) {
                this.addMessage('system', '⚠️ Direct API configuration is incomplete. Please set up your API endpoint and key in the <button onclick="window.aiAssistant?.openSettings()">settings</button>.', true);
                return;
            }
        }
        // Backend proxy mode requires no user configuration - it uses server config

        // Validate model availability (always try to validate)
        try {
            const isValidModel = await this.validateModel(selectedModel);
            if (!isValidModel) {
                this.addMessage('system', `⚠️ Model "${selectedModel}" is not available. Please select a different model in the <button onclick="window.aiAssistant?.openSettings()">settings</button>.`, true);
                return;
            }
        } catch (error) {
            console.warn('Model validation failed:', error);
            // Continue anyway - validation failure shouldn't block the request
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
            await this.makeAIRequest(composedPrompt, diagramType, currentCode, aiConfig, userPrompt);

        } catch (error) {
            console.error('AI Assistant error:', error);
            this.addMessage('system', `❌ Error: ${error.message}`);
        }
    }

    /**
     * Fetch prompt templates from backend
     * @returns {Object} Prompt templates object
     */
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
                user: this.getDefaultUserPrompt(),
                retry: this.getDefaultRetryPrompt()
            };
        }
    }

    /**
     * Make AI request with retry logic
     * @param {string|Object} prompt - Composed prompt
     * @param {string} diagramType - Type of diagram
     * @param {string} originalCode - Original diagram code
     * @param {Object} aiConfig - AI configuration
     * @param {string} originalUserPrompt - Original user request
     */
    async makeAIRequest(prompt, diagramType, originalCode, aiConfig, originalUserPrompt = '') {
        try {
            let rawResponseContent;

            // Show retry indicator if this is a retry attempt
            if (this.retryAttempts > 0) {
                this.showStatus(`🔄 Retrying (attempt ${this.retryAttempts + 1}/${aiConfig.maxRetryAttempts + 1})...`);
            }

            if (aiConfig.useCustomAPI && aiConfig.endpoint && aiConfig.apiKey) {
                // Use direct API endpoint
                rawResponseContent = await this.callCustomAPI(prompt, aiConfig, diagramType);
            } else {
                // Use backend proxy (default)
                rawResponseContent = await this.callProxyAPI(prompt, aiConfig, diagramType);
            }

            if (rawResponseContent.error) {
                throw new Error(rawResponseContent.error);
            }

            const aiParsedResponse = this.parseAIResponse(rawResponseContent);
            const { diagramCode, explanation } = aiParsedResponse;

            // Removed old validation logic - now using validateAndApplyDiagramCode instead

            // Update diagram code if it contains valid diagram code
            if (diagramCode && diagramCode.trim() && diagramCode !== "No diagram generated") {
                // Check if auto-validation is enabled
                if (aiConfig.autoValidate) {
                    // Try to apply and validate the diagram code
                    const validationResult = await this.validateAndApplyDiagramCode(diagramCode, diagramType);

                    if (validationResult.success) {
                        // Filter out error-fixing language from retry attempts for better user experience
                        let userFriendlyExplanation = explanation;
                        if (this.retryAttempts > 0) {
                            userFriendlyExplanation = this.makeRetryExplanationUserFriendly(explanation, originalUserPrompt);
                        }
                        this.displayMessage(`✅ ${userFriendlyExplanation}`, 'ai success');
                    } else if (this.retryAttempts < aiConfig.maxRetryAttempts) {
                        // Check if request was cancelled before retrying
                        if (!this.isRequestInProgress) {
                            return; // Request was cancelled, stop processing
                        }

                        // Retry with validation error feedback
                        this.retryAttempts++;
                        this.showStatus(`🔧 Diagram rendering failed, refining response (attempt ${this.retryAttempts + 1}/${aiConfig.maxRetryAttempts + 1})...`);

                        const retryPrompt = await this.composeRetryPrompt(
                            prompt,
                            diagramCode,
                            `The diagram code failed to render: ${validationResult.error}. Please fix the syntax and ensure it's valid ${diagramType} code.`,
                            originalUserPrompt,
                            diagramType,
                            originalCode
                        );
                        await this.makeAIRequest(retryPrompt, diagramType, originalCode, aiConfig, originalUserPrompt);
                        return;
                    } else {
                        // Max retries reached, apply code anyway but show warning
                        this.updateDiagramCode(diagramCode);

                        // Ensure code history is saved even when max retries reached
                        if (window.codeHistory && typeof window.codeHistory.addToHistory === 'function') {
                            window.codeHistory.addToHistory(diagramCode);
                        }

                        this.displayMessage(`⚠️ ${explanation} (Note: Diagram may have rendering issues)`, 'ai warning');
                    }
                } else {
                    // Auto-validation is disabled, apply code directly without validation
                    this.updateDiagramCode(diagramCode);

                    // Ensure code history is saved even when auto-validation is disabled
                    if (window.codeHistory && typeof window.codeHistory.addToHistory === 'function') {
                        window.codeHistory.addToHistory(diagramCode);
                    }

                    // Filter out error-fixing language from retry attempts for better user experience
                    let userFriendlyExplanation = explanation;
                    if (this.retryAttempts > 0) {
                        userFriendlyExplanation = this.makeRetryExplanationUserFriendly(explanation, originalUserPrompt);
                    }
                    this.displayMessage(`✅ ${userFriendlyExplanation}`, 'ai success');
                }
            } else if (!explanation) {
                this.addMessage('system', '⚠️ AI did not provide diagram code or an explanation.');
            } else {
                // AI provided explanation but no diagram code
                this.addMessage('assistant', explanation);
            }

        } catch (error) {
            // Check if request was cancelled before handling errors
            if (!this.isRequestInProgress) {
                return; // Request was cancelled, stop processing
            }

            if (this.retryAttempts < aiConfig.maxRetryAttempts) {
                // Check again before retrying
                if (!this.isRequestInProgress) {
                    return; // Request was cancelled, stop processing
                }

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

                // Use rawHtml=true when the message contains HTML button
                const hasHtml = errorMessage.includes('<button');
                this.addMessage('system', `❌ ${errorMessage}`, hasHtml);
                throw error;
            }
        }
    }

    // ========================================
    // VALIDATION METHODS
    // ========================================

    /**
     * Validate and apply diagram code
     * @param {string} diagramCode - Code to validate
     * @param {string} diagramType - Type of diagram
     * @returns {Object} Validation result
     */
    async validateAndApplyDiagramCode(diagramCode, diagramType) {
        try {
            const codeTextarea = document.getElementById('code');
            const originalCode = codeTextarea ? codeTextarea.value : '';

            // Apply the new diagram code temporarily
            this.updateDiagramCode(diagramCode);

            // Give the diagram rendering system time to process
            await new Promise(resolve => setTimeout(resolve, 500));

            // Check for validation errors
            const validationResult = this.checkDiagramValidation();

            if (!validationResult.success) {
                // Rollback to original code
                if (codeTextarea) {
                    codeTextarea.value = originalCode;
                    this.updateDiagramCode(originalCode);
                }
                return {
                    success: false,
                    error: validationResult.error
                };
            }

            return { success: true, error: null };

        } catch (error) {
            console.warn('Validation error:', error);
            return {
                success: false,
                error: `Validation process failed: ${error.message}`
            };
        }
    }

    /**
     * Check if the current diagram has validation errors
     */
    checkDiagramValidation() {
        // Check for visible error indicators
        const errorElements = document.querySelectorAll('.error, .error-message, [class*="error"]');
        const hasVisibleErrors = Array.from(errorElements).some(el =>
            el.offsetParent !== null &&
            el.textContent.trim() !== '' &&
            !el.textContent.toLowerCase().includes('no errors')
        );

        if (hasVisibleErrors) {
            return { success: false, error: 'Diagram contains syntax errors visible in the UI' };
        }

        // Check if diagram image loaded successfully
        const diagramImage = document.querySelector('#diagram-img, .diagram-image, [id*="diagram"] img');
        if (diagramImage) {
            const imgSrc = diagramImage.src;
            if (imgSrc.includes('error') || imgSrc.includes('invalid') ||
                diagramImage.naturalWidth <= 1 || diagramImage.naturalHeight <= 1) {
                return { success: false, error: 'Diagram image failed to load properly' };
            }
        }

        // Test diagram encoding
        try {
            if (window.encodeKrokiDiagram) {
                const codeTextarea = document.getElementById('code');
                const diagramCode = codeTextarea ? codeTextarea.value : '';
                window.encodeKrokiDiagram(diagramCode);
            }
        } catch (encodingError) {
            return { success: false, error: 'Diagram code encoding failed' };
        }

        return { success: true, error: null };
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    /**
     * Parse AI response to extract diagram code and explanation
     * @param {string|Object} responseContent - AI response
     * @returns {Object} Parsed response with diagramCode and explanation
     */
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

            // Try to extract JSON from the response if it's buried in other text
            let jsonString = actualStringToParse.trim();

            // Clean up markdown code blocks if present
            jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
            jsonString = jsonString.trim();

            // First try to parse as-is
            try {
                const parsed = JSON.parse(jsonString);
                if (typeof parsed.diagramCode === 'string' && typeof parsed.explanation === 'string') {
                    return { diagramCode: parsed.diagramCode, explanation: parsed.explanation };
                }
            } catch (e) {
                // Continue with extraction methods
            }

            // Try to extract JSON from markdown code blocks
            const jsonCodeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)```/g;
            const jsonMatches = [...jsonString.matchAll(jsonCodeBlockRegex)];

            if (jsonMatches.length > 0) {
                try {
                    const parsed = JSON.parse(jsonMatches[0][1].trim());
                    if (typeof parsed.diagramCode === 'string' && typeof parsed.explanation === 'string') {
                        return { diagramCode: parsed.diagramCode, explanation: parsed.explanation };
                    }
                } catch (e) {
                    // Continue with other extraction methods
                }
            }

            // Try to find JSON object anywhere in the text
            const jsonObjectRegex = /\{[\s\S]*?"diagramCode"[\s\S]*?"explanation"[\s\S]*?\}/g;
            const objectMatches = [...jsonString.matchAll(jsonObjectRegex)];

            for (const match of objectMatches) {
                try {
                    const parsed = JSON.parse(match[0]);
                    if (typeof parsed.diagramCode === 'string' && typeof parsed.explanation === 'string') {
                        return { diagramCode: parsed.diagramCode, explanation: parsed.explanation };
                    }
                } catch (e) {
                    // Continue with next match
                }
            }

            // Fallback: if AI failed to produce JSON, try to extract code from the actualStringToParse.
            const extractedCode = this._fallbackExtractCode(actualStringToParse);

            if (extractedCode) {
                return {
                    diagramCode: extractedCode.diagramCode,
                    explanation: extractedCode.explanation
                };
            }

            throw new Error('No valid JSON or extractable diagram code found in AI response');
        } catch (e) {
            console.error('Failed to parse AI response as JSON:', e.message, '\nAttempted to parse string:', actualStringToParse, '\nOriginal responseContent object was:', responseContent);
            throw new Error(`AI response was not valid JSON and diagram code could not be extracted. Parsing error: ${e.message}`);
        }
    }

    /**
     * Fallback method to extract diagram code from text response
     * @param {string} responseText - Raw response text
     * @returns {Object} Extracted code and explanation
     */
    _fallbackExtractCode(responseText) {
        if (typeof responseText !== 'string') return { diagramCode: '', explanation: 'Invalid response format from AI.' };

        // Try to extract code blocks from markdown format
        const codeBlockRegex = /```(?:plantuml|mermaid|dot|graphviz|uml|text)?\s*\n?([\s\S]*?)```/g;
        const matches = [...responseText.matchAll(codeBlockRegex)];

        if (matches.length > 0) {
            // Find the longest code block
            let longestMatch = matches[0];
            for (const match of matches) {
                if (match[1].trim().length > longestMatch[1].trim().length) {
                    longestMatch = match;
                }
            }
            return {
                diagramCode: longestMatch[1].trim(),
                explanation: "AI response was not in the expected JSON format. Extracted diagram code from markdown code block."
            };
        }

        // If no code blocks, look for typical diagram syntax patterns
        const lines = responseText.split('\n');
        const diagramLines = [];
        let inDiagram = false;
        let diagramStart = -1;

        // Extended keywords for different diagram types
        const startKeywords = [
            '@startuml', '@startmindmap', '@startsalt', '@startgantt',
            'graph', 'digraph', 'strict digraph', 'strict graph',
            'sequenceDiagram', 'classDiagram', 'stateDiagram', 'gantt', 'pie',
            'flowchart', 'gitgraph', 'erDiagram', 'journey', 'quadrantChart',
            'timeline', 'mindmap', 'block-beta',
            'digraph', 'subgraph', 'graph {'
        ];

        const endKeywords = ['@enduml', '@endmindmap', '@endsalt', '@endgantt', '}'];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (!inDiagram && startKeywords.some(kw => line.startsWith(kw))) {
                inDiagram = true;
                diagramStart = i;
            }

            if (inDiagram) {
                diagramLines.push(lines[i]);

                if (endKeywords.some(kw => line.endsWith(kw))) {
                    break; // Found complete diagram
                }
            }
        }

        const extractedCode = diagramLines.join('\n').trim();
        if (extractedCode) {
            return {
                diagramCode: extractedCode,
                explanation: "AI response was not in the expected JSON format. Extracted diagram code directly from response text."
            };
        }

        // Last resort: look for any multi-line structured content that looks like code
        const structuredContentRegex = /(\w+\s*{\s*[\s\S]*?}|\@\w+[\s\S]*?\@\w+)/g;
        const structuredMatches = [...responseText.matchAll(structuredContentRegex)];

        if (structuredMatches.length > 0) {
            return {
                diagramCode: structuredMatches[0][0].trim(),
                explanation: "AI response was not in the expected JSON format. Extracted structured content that might be diagram code."
            };
        }

        return {
            diagramCode: '',
            explanation: 'AI response was not in valid JSON format and no recognizable diagram code could be extracted. Please try rephrasing your request.'
        };
    }

    /**
     * Call custom API endpoint
     * @param {string|Object} prompt - Prompt to send
     * @param {Object} config - API configuration
     * @param {string} diagramType - Type of diagram for token sizing
     * @returns {Object} API response
     */
    async callCustomAPI(prompt, config, diagramType = 'plantuml') {
        const controller = this.currentAbortController || new AbortController();
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
                max_tokens: AI_MAX_TOKENS,
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
                // Get more detailed error information
                let errorMessage = `API Error: ${response.status} ${response.statusText}`;

                // Handle specific HTTP status codes with user-friendly messages
                if (response.status === 401) {
                    errorMessage = 'Authentication failed. Please check your API key in settings.';
                } else if (response.status === 403) {
                    errorMessage = 'Access forbidden. Please verify your API key permissions.';
                } else if (response.status === 429) {
                    errorMessage = 'Rate limit exceeded. Please try again later.';
                } else if (response.status === 500) {
                    errorMessage = 'Server error. Please try again later.';
                } else if (response.status >= 400 && response.status < 500) {
                    errorMessage = 'Client error. Please check your request configuration.';
                }

                throw new Error(errorMessage);
            }

            const data = await response.json();
            return data; // Return the full response object
        } catch (error) {
            if (error.name === 'AbortError') {
                throw error; // Re-throw abort errors to be handled upstream
            }

            // Handle specific error types with user-friendly messages
            const errorMessage = this.getErrorMessage(error);
            throw new Error(errorMessage);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Call proxy API backend
     * @param {string|Object} prompt - Prompt to send
     * @param {Object} config - API configuration
     * @param {string} diagramType - Type of diagram for token sizing
     * @returns {Object} API response
     */
    async callProxyAPI(prompt, config, diagramType = 'plantuml') {
        const controller = this.currentAbortController || new AbortController();
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
                    maxRetryAttempts: config.maxRetryAttempts,
                    max_tokens: AI_MAX_TOKENS,
                    config: {
                        use_custom_api: config.useCustomAPI,
                        endpoint: config.endpoint,
                        api_key: config.apiKey,
                        timeout: config.timeout
                    }
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                let errorMessage = errorData.error || `API Error: ${response.status} ${response.statusText}`;

                // Handle specific HTTP status codes with user-friendly messages
                if (response.status === 401) {
                    errorMessage = 'Authentication failed. The backend proxy is not properly configured with valid API credentials.';
                } else if (response.status === 403) {
                    errorMessage = 'Access forbidden by the backend proxy. Please contact the administrator.';
                } else if (response.status === 503) {
                    errorMessage = 'AI Assistant service is currently unavailable. Please try again later.';
                } else if (response.status === 429) {
                    errorMessage = 'Rate limit exceeded. Please try again later.';
                } else if (response.status === 500) {
                    errorMessage = 'Backend server error. Please try again later.';
                }

                throw new Error(errorMessage);
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw error; // Re-throw abort errors to be handled upstream
            }

            // Handle specific error types with user-friendly messages
            const errorMessage = this.getErrorMessage(error);
            throw new Error(errorMessage);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Validate diagram with Kroki server directly
     * @param {string} code - Diagram code
     * @param {string} diagramType - Type of diagram
     * @returns {boolean} Whether validation passed
     */
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

    /**
     * Encode diagram text for Kroki
     * @param {string} text - Diagram code to encode
     * @returns {string} Encoded diagram
     */
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

    // ========================================
    // PROMPT COMPOSITION
    // ========================================

    /**
     * Compose prompt from templates and variables
     * @param {Object} promptTemplates - Template objects
     * @param {Object} variables - Variables to substitute
     * @returns {string|Object} Composed prompt
     */
    async composePrompt(promptTemplates, variables) {
        const { diagramType, currentCode, userPrompt, useCustomAPI, userPromptTemplate } = variables;

        let systemPrompt = promptTemplates.system || this.getDefaultSystemPrompt();
        let userPromptText;

        if (useCustomAPI && userPromptTemplate && userPromptTemplate.trim()) {
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
            // Backend proxy expects simple string format
            return `${systemPrompt}\n\n${userPromptText}`;
        }

        // Direct API expects structured format
        return {
            system: systemPrompt,
            user: userPromptText
        };
    }

    /**
     * Get default system prompt template
     * @returns {string} Default system prompt
     */
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

    /**
     * Get default user prompt template
     * @returns {string} Default user prompt
     */
    getDefaultUserPrompt() {
        return `Please help me with this diagram request: {{userPrompt}}

Current diagram type: {{diagramType}}
Current code: {{currentCode}}

Please provide the updated or new diagram code in a code block, along with a brief explanation of the changes.`;
    }

    /**
     * Get default retry prompt template
     * @returns {string} Default retry prompt
     */
    getDefaultRetryPrompt() {
        return `The previous diagram code failed validation. Original request: {{userPrompt}}. Type: {{diagramType}}. Original code: {{currentCode}}. Failed code: {{failedCode}}. Error: {{validationError}}. Fix the code and respond with ONLY the JSON object. No other text.`;
    }

    /**
     * Compose retry prompt for failed requests
     * @param {string|Object} originalPrompt - Original prompt
     * @param {string} failedCode - Code that failed
     * @param {string} validationError - Validation error message
     * @param {string} originalUserPrompt - Original user request
     * @param {string} diagramType - Type of diagram
     * @param {string} currentCode - Current diagram code
     * @returns {Object} Retry prompt object
     */
    async composeRetryPrompt(originalPrompt, failedCode, validationError, originalUserPrompt, diagramType, currentCode) {
        // Fetch the retry prompt template from backend
        const promptTemplates = await this.fetchPromptTemplates();

        let systemContent = this.getDefaultSystemPrompt(); // Fallback
        if (typeof originalPrompt === 'object' && originalPrompt.system) {
            systemContent = originalPrompt.system;
        }

        // Use the backend retry template
        let retryTemplate = promptTemplates.retry || this.getDefaultRetryPrompt();

        // Replace placeholders in the retry template
        const retryUserPrompt = retryTemplate
            .replace(/\{\{userPrompt\}\}/g, originalUserPrompt || 'No original request available')
            .replace(/\{\{diagramType\}\}/g, diagramType || 'Unknown')
            .replace(/\{\{currentCode\}\}/g, currentCode || 'No existing code')
            .replace(/\{\{failedCode\}\}/g, failedCode || 'No failed code available')
            .replace(/\{\{validationError\}\}/g, validationError || 'Unknown validation error');

        return {
            system: systemContent, // Reuse the original system prompt that enforces JSON output
            user: retryUserPrompt
        };
    }

    // ========================================
    // VALIDATION METHODS
    // ========================================

    /**
     * Validate if a model is available/supported
     * @param {string} modelName - Name of the model to validate
     * @returns {Promise<boolean>} True if model is valid
     */
    async validateModel(modelName) {
        if (!modelName) return false;
        
        try {
            const response = await fetch('/api/validate-model', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': window.location.origin
                },
                body: JSON.stringify({ model: modelName })
            });

            if (!response.ok) {
                return false;
            }

            const result = await response.json();
            return result.valid === true;
        } catch (error) {
            console.error('Model validation error:', error);
            return false;
        }
    }

    /**
     * Get list of available models from backend
     * @returns {Promise<Object>} Available models data
     */
    async getAvailableModels() {
        try {
            const response = await fetch('/api/available-models', {
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': window.location.origin
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to get available models:', error);
            throw error;
        }
    }

    // ========================================
    // CONFIGURATION METHODS
    // ========================================

    /**
     * Helper method to get config manager instance with fallback
     */
    getConfigManager() {
        return this.configManager || window.configManager;
    }

    /**
     * Get AI configuration with fallbacks
     * @returns {Object} AI configuration object
     */
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

        // Return default config if manager or 'ai' config is not found
        return {
            enabled: true,
            useCustomAPI: false,
            endpoint: '',
            apiKey: '',
            model: 'openai/gpt-4o',
            customModel: '',
            maxRetryAttempts: 3,
            userPromptTemplate: '',
            autoValidate: true,
            timeout: 30
        };
    }

    /**
     * Load configuration when system is ready
     */
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

    /**
     * Set up listeners for configuration changes
     */
    setupConfigurationListeners() {
        // Listen for AI configuration changes
        if (this.configManager && typeof this.configManager.on === 'function') {
            this.configManager.on('change', (key) => {
                if (key.startsWith('ai.')) {
                    this.updateModelIndicator();
                }
            });
        }

        // Also listen for custom events from the config UI
        document.addEventListener('aiConfigChanged', () => {
            this.updateModelIndicator();
        });
    }

    /**
     * Open settings dialog
     */
    openSettings() {
        if (window.configUI) {
            window.configUI.open();
            window.configUI.switchTab('ai');
        } else {
            console.warn('Configuration UI not available yet');
            this.addMessage('system', '⚠️ Settings are loading. Please try again in a moment.');
        }
    }

    /**
     * Open AI settings dialog directly
     */
    openAISettings() {
        if (window.configUI) {
            window.configUI.open();
            window.configUI.switchTab('ai');
        } else {
            console.warn('Configuration UI not available yet');
            this.addMessage('system', '⚠️ Settings are loading. Please try again in a moment.');
        }
    }

    /**
     * Apply configuration settings
     */
    applyConfiguration() {
        const manager = this.getConfigManager();
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

            this.updateModelIndicator();

        } catch (error) {
            console.warn('AI Assistant: Error applying configuration:', error);
        }
    }

    /**
     * Update model indicator to show current AI model
     */
    updateModelIndicator() {
        if (!this.modelIndicator) return;

        // Ensure configManager is available before calling getAIConfig
        const manager = this.getConfigManager();
        if (!manager) {
            console.warn("AI Assistant: Config manager not available for updateModelIndicator.");
            this.modelIndicator.textContent = '...';
            this.modelIndicator.className = 'ai-model-indicator loading';
            return;
        }

        try {
            const config = this.getAIConfig();
            let modelName = config.model || 'openai/gpt-4o';
            let displayName = modelName;
            let sourceIcon = '';
            
            // Handle custom model names
            if (config.model === 'custom' && config.customModel) {
                modelName = config.customModel;
                displayName = this.getShortModelName(modelName);
            } else {
                displayName = this.getShortModelName(modelName);
            }
            
            // Add source indicator
            if (config.useCustomAPI && config.endpoint && config.apiKey) {
                sourceIcon = '🔑'; // Direct API
            } else {
                sourceIcon = '🌐'; // Backend proxy (default)
            }
            
            this.modelIndicator.innerHTML = `${sourceIcon} ${displayName}`;
            this.modelIndicator.className = `ai-model-indicator ${config.useCustomAPI ? 'custom' : 'proxy'}`;
            this.modelIndicator.title = `Current model: ${modelName}${config.useCustomAPI ? ' (Direct API)' : ' (Backend Proxy)'}`;
            
        } catch (error) {
            console.warn("AI Assistant: Error updating model indicator:", error);
            this.modelIndicator.textContent = '⚠️';
            this.modelIndicator.className = 'ai-model-indicator error';
            this.modelIndicator.title = 'Error loading model information';
        }
    }

    /**
     * Get a shortened display name for a model
     * @param {string} modelName - Full model name
     * @returns {string} Shortened model name
     */
    getShortModelName(modelName) {
        if (!modelName) return 'Unknown';
        // Strip provider prefix: "azure/gpt-4o" -> "gpt-4o"
        const parts = modelName.split('/');
        return parts.length > 1 ? parts.slice(1).join('/') : modelName;
    }

    /**
     * Update diagram code in the editor
     * @param {string} code - New diagram code
     */
    updateDiagramCode(code) {
        const codeTextarea = document.getElementById('code');
        if (codeTextarea) {
            // Handle escaped characters properly
            let processedCode = code;

            // Convert escaped newlines to actual newlines
            processedCode = processedCode.replace(/\\n/g, '\n');

            // Convert escaped tabs to actual tabs
            processedCode = processedCode.replace(/\\t/g, '\t');

            // Convert escaped quotes
            processedCode = processedCode.replace(/\\"/g, '"');
            processedCode = processedCode.replace(/\\'/g, "'");

            // Convert escaped backslashes
            processedCode = processedCode.replace(/\\\\/g, '\\');

            codeTextarea.value = processedCode;

            // Trigger change event to update the diagram
            const event = new Event('change', { bubbles: true });
            codeTextarea.dispatchEvent(event);

            // Also trigger input event for any listeners
            const inputEvent = new Event('input', { bubbles: true });
            codeTextarea.dispatchEvent(inputEvent);

            // Input event will trigger auto-refresh if enabled
        } else {
            console.warn('AI Assistant: Could not find code textarea element');
        }
    }

    /**
     * Make retry explanation more user-friendly
     * @param {string} explanation - Original explanation
     * @param {string} originalUserPrompt - Original user request
     * @returns {string} User-friendly explanation
     */
    makeRetryExplanationUserFriendly(explanation, originalUserPrompt) {
        // Remove error-fixing language that confuses users who didn't see the original error
        let userFriendlyExplanation = explanation;

        // Remove common error-fixing phrases
        const errorFixingPhrases = [
            /Fixed the syntax error by\s*/gi,
            /Fixed syntax error at\s*/gi,
            /Fixed the error by\s*/gi,
            /Fixed syntax by\s*/gi,
            /Corrected the syntax error by\s*/gi,
            /Corrected the error by\s*/gi,
            /Fixed the specific syntax error\s*/gi,
            /Fixed validation errors?\s*/gi,
            /Resolved the syntax error by\s*/gi,
            /Fixed the diagram syntax by\s*/gi,
            /Fixed the rendering error by\s*/gi,
            /\s*to fix the syntax error/gi,
            /\s*to resolve the validation error/gi
        ];

        // Apply each regex to clean the explanation
        errorFixingPhrases.forEach(phrase => {
            userFriendlyExplanation = userFriendlyExplanation.replace(phrase, '');
        });

        // Clean up any remaining artifacts
        userFriendlyExplanation = userFriendlyExplanation
            .replace(/^\s*[.,;]\s*/g, '') // Remove leading punctuation
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();

        // If the explanation is now too short or generic, provide a better one
        if (userFriendlyExplanation.length < 10 ||
            /^(updated?|created?|generated?|done?)\.?$/gi.test(userFriendlyExplanation)) {

            // Create a better explanation based on the original request
            if (originalUserPrompt) {
                if (originalUserPrompt.toLowerCase().includes('create')) {
                    userFriendlyExplanation = "Created the diagram as requested.";
                } else if (originalUserPrompt.toLowerCase().includes('update') || originalUserPrompt.toLowerCase().includes('modify')) {
                    userFriendlyExplanation = "Updated the diagram based on your request.";
                } else if (originalUserPrompt.toLowerCase().includes('add')) {
                    userFriendlyExplanation = "Added the requested elements to the diagram.";
                } else {
                    userFriendlyExplanation = "Generated the diagram successfully.";
                }
            } else {
                userFriendlyExplanation = "Diagram updated successfully.";
            }
        }

        // Ensure it starts with a capital letter
        if (userFriendlyExplanation.length > 0) {
            userFriendlyExplanation = userFriendlyExplanation.charAt(0).toUpperCase() + userFriendlyExplanation.slice(1);
        }

        return userFriendlyExplanation;
    }

    /**
     * Get user-friendly error message based on error type and response
     * @param {Error} error - Error object
     * @param {Response} response - HTTP response object
     * @returns {string} User-friendly error message
     */
    getErrorMessage(error, response = null) {
        // Check for specific error messages that should be preserved
        if (error.message.includes('Authentication failed') ||
            error.message.includes('Access forbidden') ||
            error.message.includes('service is currently unavailable') ||
            error.message.includes('Rate limit') ||
            error.message.includes('server error') ||
            error.message.includes('API Error') ||
            error.message.includes('Client error')) {
            return error.message;
        }

        // Default timeout message for network errors
        return 'Request timed out. Please try again or increase the timeout in settings.';
    }
}

// Export for use by main.js - but don't auto-initialize
// Initialization is handled by main.js after all dependencies are loaded
