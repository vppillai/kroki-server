/**
 * Centralized Error Handling Module
 *
 * Provides structured error types, error codes, and unified error display
 * strategies for the entire application.
 *
 * @module errors
 */

import { ERROR_DISPLAY_MS, SUCCESS_FEEDBACK_MS } from './constants.js';

// ========================================
// ERROR CODES
// ========================================

/**
 * Enumeration of application error codes
 * @readonly
 * @enum {string}
 */
export const ErrorCodes = Object.freeze({
    NETWORK: 'NETWORK',
    TIMEOUT: 'TIMEOUT',
    HTTP_CLIENT: 'HTTP_CLIENT',
    HTTP_SERVER: 'HTTP_SERVER',
    VALIDATION: 'VALIDATION',
    FILE_IO: 'FILE_IO',
    AI_SERVICE: 'AI_SERVICE'
});

// ========================================
// APP ERROR CLASS
// ========================================

/**
 * Structured application error with code, details, and timestamp
 */
export class AppError extends Error {
    /**
     * @param {string} message - Human-readable error message
     * @param {string} code - Error code from ErrorCodes enum
     * @param {Object} [details={}] - Additional error details
     */
    constructor(message, code = ErrorCodes.NETWORK, details = {}) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.details = details;
        this.timestamp = Date.now();
    }

    /**
     * Create an AppError from an HTTP response status
     * @param {number} status - HTTP status code
     * @param {string} body - Response body text
     * @returns {AppError}
     */
    static fromHttpStatus(status, body) {
        const code = status >= 500 ? ErrorCodes.HTTP_SERVER : ErrorCodes.HTTP_CLIENT;
        const message = body ? `HTTP ${status}: ${body}` : `HTTP ${status}`;
        return new AppError(message, code, { status });
    }
}

// ========================================
// ERROR DISPLAY STRATEGIES
// ========================================

/**
 * Display strategies for errors
 * @readonly
 * @enum {string}
 */
export const ErrorStrategy = Object.freeze({
    BANNER: 'BANNER',       // #image-error-banner
    INLINE: 'INLINE',       // #errorMessage
    TOAST: 'TOAST',         // #save-status
    SILENT: 'SILENT'        // console only
});

/**
 * Show error banner in the diagram viewport
 * @param {string} msg - Error message to display
 */
export function showBanner(msg) {
    const banner = document.getElementById('image-error-banner');
    const messageElement = document.getElementById('error-banner-message');
    const copyBtn = document.getElementById('error-copy-btn');

    if (banner && messageElement) {
        messageElement.textContent = msg;
        banner.style.display = 'block';

        if (copyBtn) {
            const handler = () => {
                navigator.clipboard.writeText(msg).then(() => {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => {
                        // SAFE: developer-controlled template
                        copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy';
                    }, SUCCESS_FEEDBACK_MS);
                });
            };
            copyBtn.replaceWith(copyBtn.cloneNode(true));
            document.getElementById('error-copy-btn').addEventListener('click', handler);
        }
    }
}

/**
 * Hide error banner
 */
export function hideBanner() {
    const banner = document.getElementById('image-error-banner');
    if (banner) {
        banner.style.display = 'none';
    }
}

/**
 * Show inline error message in the editor area
 * @param {string} msg - Error message
 */
export function showInlineError(msg) {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.textContent = msg;
        errorElement.style.display = 'block';
    }
}

/**
 * Hide inline error message
 */
export function hideInlineError() {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

/**
 * Show a toast-style message in the save-status area
 * @param {string} msg - Message to display
 * @param {'success'|'error'|'info'} [type='info'] - Toast type
 * @param {number} [durationMs] - Auto-hide duration in ms
 */
export function showToast(msg, type = 'info', durationMs = SUCCESS_FEEDBACK_MS) {
    const saveStatus = document.getElementById('save-status');
    if (!saveStatus) return;

    const originalClass = saveStatus.className;
    const originalText = saveStatus.textContent;

    saveStatus.textContent = msg;
    saveStatus.className = type === 'success' ? 'save-status saved' : 'save-status';
    saveStatus.style.visibility = 'visible';

    setTimeout(() => {
        saveStatus.textContent = originalText;
        saveStatus.className = originalClass;
    }, durationMs);
}

/**
 * Central error handler with configurable display strategy
 * @param {Error} error - The error to handle
 * @param {string} [strategy] - Display strategy from ErrorStrategy enum
 */
export function handleError(error, strategy = ErrorStrategy.SILENT) {
    const message = error.message || 'An unexpected error occurred';

    switch (strategy) {
        case ErrorStrategy.BANNER:
            showBanner(message);
            break;
        case ErrorStrategy.INLINE:
            showInlineError(`Error: ${message}`);
            setTimeout(() => hideInlineError(), ERROR_DISPLAY_MS);
            break;
        case ErrorStrategy.TOAST:
            showToast(message, 'error', ERROR_DISPLAY_MS);
            break;
        case ErrorStrategy.SILENT:
        default:
            console.error('[AppError]', message, error);
            break;
    }
}
