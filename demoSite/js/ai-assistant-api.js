/**
 * AI Assistant API Module
 *
 * Handles all API communication for the AI assistant:
 * custom API calls, proxy API calls, SSE streaming, model validation.
 *
 * @module AIAssistantAPI
 */

import { interpretSSEData } from './modules/aiStream.js';

const AI_API_MAX_TOKENS = window.APP_CONSTANTS ? window.APP_CONSTANTS.AI_MAX_TOKENS : 16000;
const AI_API_TEMPERATURE = window.APP_CONSTANTS ? window.APP_CONSTANTS.AI_TEMPERATURE : 0.7;

window.AIAssistantAPI = {
    /**
     * Call custom API endpoint
     * @param {string|Object} prompt
     * @param {Object} config
     * @param {AbortController} abortController
     * @param {Object} callbacks - { addStreamingMessage, updateStreamingMessage, scrollToBottom }
     * @returns {Promise<string|Object>}
     */
    async callCustomAPI(messages, config, abortController, callbacks) {
        const controller = abortController || new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), (config.timeout || 30) * 1000);

        try {
            const body = {
                model: config.model === 'custom' ? config.customModel : config.model,
                messages: messages,
                max_tokens: AI_API_MAX_TOKENS,
                temperature: AI_API_TEMPERATURE,
                stream: true
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
                throw new Error(this._getHttpErrorMessage(response.status));
            }

            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('text/event-stream')) {
                const streamingEl = callbacks.addStreamingMessage();
                const fullText = await this.readSSEStream(response, streamingEl, callbacks);
                if (streamingEl) {
                    const wrapper = streamingEl.closest('.ai-message');
                    if (wrapper) wrapper.remove();
                    else if (streamingEl.parentElement) streamingEl.parentElement.remove();
                }
                return fullText;
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError' || error.isProviderError) throw error;
            throw new Error(this.getErrorMessage(error));
        } finally {
            clearTimeout(timeoutId);
        }
    },

    /**
     * Call proxy API backend
     * @param {string|Object} prompt
     * @param {Object} config
     * @param {AbortController} abortController
     * @param {Object} callbacks
     * @returns {Promise<string|Object>}
     */
    async callProxyAPI(messages, config, abortController, callbacks) {
        // H1: structural impossibility guard — the BYOK key must never travel to
        // the DocCode origin. If the selector ever regresses, fail loud here.
        if (config.useCustomAPI && config.apiKey) {
            throw new Error('proxy path must not run in custom mode');
        }

        const controller = abortController || new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), (config.timeout || 30) * 1000);

        try {
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
                    max_tokens: AI_API_MAX_TOKENS,
                    stream: true,
                    // H1: never send endpoint or api_key to the DocCode origin —
                    // only the timeout is a valid server-side config parameter.
                    config: {
                        timeout: config.timeout
                    }
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                // Surface quota codes so the caller can render the right UI state
                if (errorData.code) {
                    const err = new Error(errorData.error || this._getHttpErrorMessage(response.status));
                    err.quotaCode = errorData.code;
                    err.retryAfter = errorData.retry_after;
                    throw err;
                }
                throw new Error(errorData.error || this._getHttpErrorMessage(response.status));
            }

            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('text/event-stream')) {
                const streamingEl = callbacks.addStreamingMessage();
                const fullText = await this.readSSEStream(response, streamingEl, callbacks);
                if (streamingEl) {
                    const wrapper = streamingEl.closest('.ai-message');
                    if (wrapper) wrapper.remove();
                    else if (streamingEl.parentElement) streamingEl.parentElement.remove();
                }
                return fullText;
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError' || error.isProviderError) throw error;
            throw new Error(this.getErrorMessage(error));
        } finally {
            clearTimeout(timeoutId);
        }
    },

    /**
     * Read an SSE stream and accumulate full response text
     * @param {Response} response
     * @param {HTMLElement} streamingElement
     * @param {Object} callbacks
     * @returns {Promise<string>}
     */
    async readSSEStream(response, streamingElement = null, callbacks = {}) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        // Interpret one raw SSE line; appends content, throws on a provider error.
        const handleLine = (line) => {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) return;
            const evt = interpretSSEData(trimmed.slice(5).trim());
            if (evt.kind === 'error') {
                throw Object.assign(new Error(evt.value), { isProviderError: true });
            }
            if (evt.kind === 'content') {
                fullText += evt.value;
                if (streamingElement && callbacks.updateStreamingMessage) {
                    callbacks.updateStreamingMessage(streamingElement, fullText);
                }
            }
        };

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();
                for (const line of lines) handleLine(line);
            }
            // Flush any final buffered line that did not end with a newline.
            buffer += decoder.decode();
            if (buffer.trim()) handleLine(buffer);
        } finally {
            reader.releaseLock();
        }

        return fullText;
    },

    /**
     * Fetch prompt templates from backend
     * @returns {Promise<Object>}
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
                system: window.AIAssistantPrompts.getDefaultSystemPrompt(),
                user: window.AIAssistantPrompts.getDefaultUserPrompt(),
                retry: window.AIAssistantPrompts.getDefaultRetryPrompt()
            };
        }
    },

    /**
     * Validate if a model is available
     * @param {string} modelName
     * @returns {Promise<boolean>}
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

            if (!response.ok) return false;
            const result = await response.json();
            return result.valid === true;
        } catch (error) {
            console.error('Model validation error:', error);
            return false;
        }
    },

    /**
     * Get available models from backend
     * @returns {Promise<Object>}
     */
    async getAvailableModels() {
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
    },

    /**
     * Get HTTP error message for status code
     * @param {number} status
     * @returns {string}
     * @private
     */
    _getHttpErrorMessage(status) {
        const messages = {
            401: 'Authentication failed. Please check your API key in settings.',
            403: 'Access forbidden. Please verify your API key permissions.',
            429: 'Rate limit exceeded. Please try again later.',
            500: 'Server error. Please try again later.',
            503: 'AI Assistant service is currently unavailable. Please try again later.'
        };
        return messages[status] || `API Error: ${status}`;
    },

    /**
     * Get user-friendly error message
     * @param {Error} error
     * @returns {string}
     */
    getErrorMessage(error) {
        const preservedMessages = [
            'Authentication failed', 'Access forbidden', 'service is currently unavailable',
            'Rate limit', 'server error', 'API Error', 'Client error'
        ];

        if (preservedMessages.some(msg => error.message.includes(msg))) {
            return error.message;
        }

        return 'Request timed out. Please try again or increase the timeout in settings.';
    }
};
