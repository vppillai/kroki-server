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
// LINE NUMBER MANAGEMENT
// ========================================

/**
 * Update line numbers display in the code editor
 * Generates line numbers matching the current code content
 * Synchronizes scroll position between editor and line numbers
 * 
 * @function updateLineNumbers
 * @public
 */
export function updateLineNumbers() {
    const codeTextarea = document.getElementById('code');
    const lineNumbersDiv = document.getElementById('lineNumbers');

    if (!codeTextarea || !lineNumbersDiv) {
        return;
    }

    const codeLines = codeTextarea.value.split('\n');
    const lineCount = Math.max(codeLines.length, 1); // Ensure at least 1 line

    let lineNumbersHtml = '';
    for (let i = 1; i <= lineCount; i++) {
        lineNumbersHtml += i + '<br>';
    }

    lineNumbersDiv.innerHTML = lineNumbersHtml;

    // Sync scroll position after updating line numbers
    // Use requestAnimationFrame to ensure DOM updates are complete
    requestAnimationFrame(() => {
        lineNumbersDiv.scrollTop = codeTextarea.scrollTop;
    });
}

/**
 * Initialize line numbers display and scroll synchronization
 * Sets up bidirectional scroll synchronization between code editor and line numbers
 * Handles resize events and ensures proper alignment
 * 
 * @public
 */
export function initializeLineNumbers() {
    const codeTextarea = document.getElementById('code');
    const lineNumbersDiv = document.getElementById('lineNumbers');

    if (!codeTextarea || !lineNumbersDiv) {
        console.warn('Line numbers: Missing required elements');
        return;
    }

    // Initial line numbers update
    updateLineNumbers();

    // Ensure scroll synchronization is working
    let isTextareaScrolling = false;
    let isLineNumbersScrolling = false;

    codeTextarea.addEventListener('scroll', function () {
        if (!isLineNumbersScrolling) {
            isTextareaScrolling = true;
            lineNumbersDiv.scrollTop = this.scrollTop;
            requestAnimationFrame(() => {
                isTextareaScrolling = false;
            });
        }
    });

    // Optional: sync textarea scroll when line numbers are scrolled
    // (though this is typically not needed for most use cases)
    lineNumbersDiv.addEventListener('scroll', function () {
        if (!isTextareaScrolling) {
            isLineNumbersScrolling = true;
            codeTextarea.scrollTop = this.scrollTop;
            requestAnimationFrame(() => {
                isLineNumbersScrolling = false;
            });
        }
    });

    // Also sync when the textarea is resized (e.g., by window resize)
    const resizeObserver = new ResizeObserver(() => {
        // Small delay to ensure the textarea has finished resizing
        setTimeout(() => {
            if (!isLineNumbersScrolling && !isTextareaScrolling) {
                lineNumbersDiv.scrollTop = codeTextarea.scrollTop;
            }
        }, 10);
    });

    resizeObserver.observe(codeTextarea);
}

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