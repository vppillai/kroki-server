/**
 * Utilities Module
 * 
 * Common utility functions used across the Kroki diagram editor.
 * Provides helper functions for UI updates, text encoding, and DOM manipulation.
 * 
 * @module utils
 * @author Vysakh Pillai
 */

// ========================================
// LINE NUMBER MANAGEMENT (handled by CodeMirror 6)
// ========================================

/** @deprecated Handled by CodeMirror 6 */
export function updateLineNumbers() { /* handled by CodeMirror */ }

/** @deprecated Handled by CodeMirror 6 */
export function initializeLineNumbers() { /* handled by CodeMirror */ }

// ========================================
// TEXT ENCODING UTILITIES
// ========================================

/**
 * Encode text to UTF-8 byte array
 * Converts string text to UTF-8 encoded byte array for diagram processing
 * Uses TextEncoder when available, falls back to manual encoding
 * 
 * @function textEncode
 * @param {string} str - Text string to encode
 * @returns {Uint8Array} UTF-8 encoded byte array
 * @public
 */
export function textEncode(str) {
    if (window.TextEncoder) {
        return new TextEncoder('utf-8').encode(str);
    }
    const utf8 = unescape(encodeURIComponent(str));
    const result = new Uint8Array(utf8.length);
    for (let i = 0; i < utf8.length; i++) {
        result[i] = utf8.charCodeAt(i);
    }
    return result;
}

/**
 * Convert Uint8Array to string representation
 * Transforms byte array back to string for base64 encoding
 * 
 * @param {Uint8Array} array - Byte array to convert
 * @returns {string} String representation of byte array
 * @public
 */
export function uint8ArrayToString(array) {
    let result = '';
    for (let i = 0; i < array.length; i++) {
        result += String.fromCharCode(array[i]);
    }
    return result;
}

// ========================================
// LAYOUT & UI UTILITIES
// ========================================

/**
 * Adjust controls layout based on available width
 * Switches between horizontal and stacked layout for diagram controls
 * Responsive design adaptation for narrow editor panels
 * 
 * @function adjustControlsLayout
 * @public
 */
export function adjustControlsLayout() {
    const controlsContainer = document.querySelector('.diagram-controls');
    const editor = document.querySelector('.editor');
    const STACK_THRESHOLD = 350; // Width in pixels below which to stack controls

    // Check if elements exist before accessing their properties
    if (!controlsContainer || !editor) {
        console.warn('adjustControlsLayout: Required elements not found', {
            controlsContainer: !!controlsContainer,
            editor: !!editor
        });
        return;
    }

    if (editor.offsetWidth < STACK_THRESHOLD) {
        controlsContainer.classList.add('stacked-controls');
    } else {
        controlsContainer.classList.remove('stacked-controls');
    }
}

/**
 * Initialize resize handle for editor panel
 * Sets up draggable resize functionality between editor and preview panels
 * Includes bounds checking and layout adjustment callbacks
 * 
 * @public
 */
export function initializeResizeHandle() {
    const container = document.querySelector('.container');
    const editor = document.querySelector('.editor');
    const handle = document.getElementById('resize-handle');
    let isResizing = false;
    let startX, startWidth;

    handle.addEventListener('mousedown', function (e) {
        isResizing = true;
        startX = e.clientX;
        startWidth = editor.offsetWidth;
        handle.classList.add('dragging');

        // Prevent text selection during resize
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', function (e) {
        if (!isResizing) return;

        const width = startWidth + (e.clientX - startX);
        const containerWidth = container.offsetWidth;

        // Limit resize to reasonable bounds (10% to 90% of container)
        const minWidth = containerWidth * 0.1;
        const maxWidth = containerWidth * 0.9;

        if (width >= minWidth && width <= maxWidth) {
            editor.style.width = width + 'px';
            // Adjust line numbers after resize
            updateLineNumbers();
            // Check if controls need to be rearranged
            adjustControlsLayout();
        }
    });

    document.addEventListener('mouseup', function () {
        if (isResizing) {
            isResizing = false;
            handle.classList.remove('dragging');
            document.body.style.userSelect = '';
        }
    });
}

// ========================================
// HTML UTILITIES
// ========================================

/**
 * Escape HTML special characters in text
 * Prevents XSS by converting special characters to HTML entities
 * 
 * @function escapeHtml
 * @param {string} text - Text to escape
 * @returns {string} HTML-escaped text
 * @public
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
} 