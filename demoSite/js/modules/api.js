/**
 * Centralized API Layer
 *
 * Single fetch wrapper with AbortController timeout, structured error handling,
 * and convenience methods for all HTTP operations.
 *
 * @module api
 */

import { DEFAULT_POST_REQUEST_TIMEOUT } from './constants.js';

/**
 * Create an AbortController with a timeout
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {{ controller: AbortController, clear: Function }}
 */
export function createTimeoutController(timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return {
        controller,
        clear() {
            clearTimeout(timeoutId);
        }
    };
}

/**
 * Central fetch wrapper with timeout, structured error handling, and response parsing.
 *
 * @param {string} url - URL to fetch
 * @param {Object} [options={}] - Options
 * @param {number} [options.timeout] - Request timeout in ms (default: DEFAULT_POST_REQUEST_TIMEOUT)
 * @param {'json'|'text'|'blob'|'response'} [options.parseAs='response'] - How to parse the response
 * @param {AbortSignal} [options.signal] - External abort signal
 * @param {Object} [options.fetchOptions] - Additional fetch options (method, headers, body, etc.)
 * @returns {Promise<*>} Parsed response
 * @throws {Error} On network error, timeout, or HTTP error
 */
export async function apiFetch(url, options = {}) {
    const {
        timeout = DEFAULT_POST_REQUEST_TIMEOUT,
        parseAs = 'response',
        signal: externalSignal,
        ...fetchOptions
    } = options;

    const { controller, clear } = createTimeoutController(timeout);

    // If an external signal is provided, abort our controller when it aborts
    if (externalSignal) {
        if (externalSignal.aborted) {
            controller.abort();
        } else {
            externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
        }
    }

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal
        });

        clear();

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            try {
                const errorText = await response.text();
                if (errorText && errorText.trim()) {
                    errorMessage += `: ${errorText}`;
                } else {
                    errorMessage += `: ${response.statusText || 'Unknown error'}`;
                }
            } catch {
                errorMessage += `: ${response.statusText || 'Unknown error'}`;
            }
            const error = new Error(errorMessage);
            error.status = response.status;
            error.statusText = response.statusText;
            throw error;
        }

        switch (parseAs) {
            case 'json':
                return await response.json();
            case 'text':
                return await response.text();
            case 'blob':
                return await response.blob();
            case 'response':
            default:
                return response;
        }
    } catch (error) {
        clear();
        if (error.name === 'AbortError') {
            throw new Error('Request timeout - the request took too long');
        }
        throw error;
    }
}

/**
 * Convenience API methods
 */
export const api = {
    /**
     * GET request expecting JSON response
     * @param {string} url
     * @param {Object} [options]
     * @returns {Promise<Object>}
     */
    getJSON(url, options = {}) {
        return apiFetch(url, { ...options, parseAs: 'json' });
    },

    /**
     * GET request expecting text response
     * @param {string} url
     * @param {Object} [options]
     * @returns {Promise<string>}
     */
    getText(url, options = {}) {
        return apiFetch(url, { ...options, parseAs: 'text' });
    },

    /**
     * GET request expecting blob response
     * @param {string} url
     * @param {Object} [options]
     * @returns {Promise<Blob>}
     */
    getBlob(url, options = {}) {
        return apiFetch(url, { ...options, parseAs: 'blob' });
    },

    /**
     * POST request with JSON body expecting JSON response
     * @param {string} url
     * @param {Object} body - JSON body
     * @param {Object} [options]
     * @returns {Promise<Object>}
     */
    postJSON(url, body, options = {}) {
        return apiFetch(url, {
            ...options,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            },
            body: JSON.stringify(body),
            parseAs: options.parseAs || 'json'
        });
    },

    /**
     * POST request with text body expecting text response
     * @param {string} url
     * @param {string} body - Text body
     * @param {Object} [options]
     * @returns {Promise<string>}
     */
    postText(url, body, options = {}) {
        return apiFetch(url, {
            ...options,
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
                ...(options.headers || {})
            },
            body,
            parseAs: options.parseAs || 'text'
        });
    },

    /**
     * POST request with text body expecting blob response
     * @param {string} url
     * @param {string} body - Text body
     * @param {Object} [options]
     * @returns {Promise<Blob>}
     */
    postBlob(url, body, options = {}) {
        return apiFetch(url, {
            ...options,
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
                ...(options.headers || {})
            },
            body,
            parseAs: 'blob'
        });
    }
};
