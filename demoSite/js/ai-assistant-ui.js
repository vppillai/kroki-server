/**
 * AI Assistant UI Module
 *
 * Handles UI creation, message display, and visual feedback for the AI assistant.
 * Uses safe DOM APIs to prevent XSS when rendering AI content.
 *
 * @module AIAssistantUI
 */

window.AIAssistantUI = {
    /**
     * Create the AI assistant button
     * @returns {HTMLElement}
     */
    createAssistButton() {
        const button = document.createElement('button');
        button.id = 'ai-assist-btn';
        button.className = 'ai-assist-btn';
        button.title = 'AI Assistant - Help with diagram generation';
        // SAFE: developer-controlled template
        button.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
            </svg>
            <span class="ai-assist-label">AI</span>
        `;

        const diagramContainer = document.getElementById('diagram-container');
        if (diagramContainer) {
            diagramContainer.appendChild(button);
        }

        return button;
    },

    /**
     * Create the floating chat window
     * @returns {HTMLElement}
     */
    createChatWindow() {
        const chatWindow = document.createElement('div');
        chatWindow.id = 'ai-chat-window';
        chatWindow.className = 'ai-chat-window';
        chatWindow.style.display = 'none';

        // SAFE: developer-controlled template
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
                    <button class="ai-chat-minimize" title="Minimize">\u2212</button>
                    <button class="ai-chat-close" title="Close">\u00d7</button>
                </div>
            </div>
            <div class="ai-chat-body">
                <div class="ai-chat-messages" id="ai-chat-messages">
                    <div class="ai-message system">
                        <div class="ai-message-content">
                            <p>Hi! I'm your AI diagram assistant. I can help you create or update your diagram code.</p>
                            <div style="background: rgba(255, 193, 7, 0.1); padding: 8px; border-radius: 4px; margin-top: 10px; font-size: 12px;">
                                <strong>Note:</strong> Each request is independent - I only see your current message and the current diagram code, not our previous conversation history.
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
        return chatWindow;
    },

    /**
     * Add a message to the chat window.
     * Uses safe DOM APIs for AI content to prevent XSS.
     *
     * @param {HTMLElement} chatMessages - Chat messages container
     * @param {string} type - Message type
     * @param {string} text - Message content
     * @param {boolean} rawHtml - Whether to render as raw HTML (only for developer-controlled content)
     * @returns {HTMLElement} The message element
     */
    addMessage(chatMessages, type, text, rawHtml = false) {
        if (!chatMessages) return null;

        const messageElement = document.createElement('div');
        messageElement.classList.add('ai-message', type);

        const contentElement = document.createElement('div');
        contentElement.classList.add('ai-message-content');

        if (rawHtml) {
            // SAFE: only used for developer-controlled HTML (e.g., settings buttons)
            contentElement.innerHTML = text;
        } else if (type === 'assistant' || type === 'assistant-success' || type === 'assistant-warning') {
            // Use safe markdown rendering for AI content
            if (window.domUtils && window.domUtils.renderMarkdownContent) {
                window.domUtils.renderMarkdownContent(contentElement, text);
            } else {
                contentElement.textContent = text;
            }
        } else if (type === 'user') {
            contentElement.style.whiteSpace = 'pre-wrap';
            contentElement.textContent = text;
        } else {
            contentElement.textContent = text;
        }

        messageElement.appendChild(contentElement);
        chatMessages.appendChild(messageElement);

        return messageElement;
    },

    /**
     * Create a streaming message element
     * @param {HTMLElement} chatMessages
     * @returns {HTMLElement} Content element to update
     */
    addStreamingMessage(chatMessages) {
        if (!chatMessages) return null;

        const messageElement = document.createElement('div');
        messageElement.classList.add('ai-message', 'assistant');

        const contentElement = document.createElement('div');
        contentElement.classList.add('ai-message-content');
        contentElement.textContent = '';

        messageElement.appendChild(contentElement);
        chatMessages.appendChild(messageElement);

        return contentElement;
    },

    /**
     * Show status message in chat
     * @param {HTMLElement} chatStatus
     * @param {HTMLElement} chatInputContainer
     * @param {HTMLElement} chatWindow
     * @param {HTMLElement} chatMessages
     * @param {string} message
     */
    showStatus(chatStatus, chatInputContainer, chatWindow, chatMessages, message) {
        if (!chatStatus) return;
        const statusText = chatStatus.querySelector('.ai-status-text');
        if (statusText) {
            statusText.textContent = message;
            statusText.style.animation = 'statusTextPulse 2s ease-in-out infinite';
        }
        chatStatus.style.display = 'flex';

        if (chatInputContainer) chatInputContainer.classList.add('status-visible');
        if (chatWindow) {
            const chatBody = chatWindow.querySelector('.ai-chat-body');
            if (chatBody) chatBody.classList.add('status-active');
        }
        if (chatMessages) {
            chatMessages.style.marginBottom = '45px';
            setTimeout(() => {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }, 100);
        }
    },

    /**
     * Hide status message
     * @param {HTMLElement} chatStatus
     * @param {HTMLElement} chatInputContainer
     * @param {HTMLElement} chatWindow
     * @param {HTMLElement} chatMessages
     */
    hideStatus(chatStatus, chatInputContainer, chatWindow, chatMessages) {
        if (!chatStatus) return;

        chatStatus.style.animation = 'statusSlideOut 0.2s ease-in';

        setTimeout(() => {
            chatStatus.style.display = 'none';
            chatStatus.style.animation = '';

            if (chatInputContainer) chatInputContainer.classList.remove('status-visible');
            if (chatWindow) {
                const chatBody = chatWindow.querySelector('.ai-chat-body');
                if (chatBody) chatBody.classList.remove('status-active');
            }
            if (chatMessages) chatMessages.style.marginBottom = '10px';

            const statusText = chatStatus.querySelector('.ai-status-text');
            if (statusText) statusText.style.animation = '';
        }, 200);
    },

    /**
     * Scroll chat messages to bottom
     * @param {HTMLElement} chatMessages
     */
    scrollToBottom(chatMessages) {
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
};
