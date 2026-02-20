/**
 * Globals Bridge Module
 *
 * ES6 module that imports infrastructure modules and exposes them on `window`
 * so that non-module <script> files (config.js, config-ui.js, ai-assistant.js,
 * code-history.js) can access them.
 *
 * Loaded as the first <script type="module"> in index.html.
 *
 * @module globals-bridge
 */

import { api, apiFetch, createTimeoutController } from './api.js';
import { AppError, ErrorCodes, ErrorStrategy, handleError } from './errors.js';
import {
    show, hide, toggle, escapeHtml,
    renderMarkdownContent,
    createTrackedBlobUrl, revokeBlobUrl, revokeAllBlobUrls
} from './dom.js';
import { validateFile, validateConfigValue, sanitizeString } from './validation.js';
import * as constants from './constants.js';
import { encodeKrokiDiagram } from './diagramOperations.js';

// ========================================
// EXPOSE ON WINDOW
// ========================================

window.appApi = { api, apiFetch, createTimeoutController };

window.AppError = AppError;
window.ErrorCodes = ErrorCodes;
window.ErrorStrategy = ErrorStrategy;
window.handleError = handleError;

window.domUtils = {
    show, hide, toggle, escapeHtml,
    renderMarkdownContent,
    createTrackedBlobUrl, revokeBlobUrl, revokeAllBlobUrls
};

window.inputValidation = { validateFile, validateConfigValue, sanitizeString };

window.APP_CONSTANTS = constants;

window.encodeKrokiDiagram = encodeKrokiDiagram;
