// Editor functionality module
import DOMUtils from '../utils/dom.js';

class EditorManager {
    constructor() {
        this.setupEventListeners();
    }

    /**
     * Update line numbers in the editor
     */
    updateLineNumbers() {
        const codeLines = DOMUtils.getValue('code').split('\n');
        const lineCount = codeLines.length;

        let lineNumbersHtml = '';
        for (let i = 1; i <= lineCount; i++) {
            lineNumbersHtml += i + '<br>';
        }

        DOMUtils.setHTMLContent('lineNumbers', lineNumbersHtml);
    }

    /**
     * Synchronize line numbers scroll with code editor scroll
     */
    syncLineNumbersScroll() {
        const codeElement = DOMUtils.getElementById('code');
        const lineNumbersElement = DOMUtils.getElementById('lineNumbers');

        if (codeElement && lineNumbersElement) {
            lineNumbersElement.scrollTop = codeElement.scrollTop;
        }
    }

    /**
     * Set up event listeners for editor functionality
     */
    setupEventListeners() {
        // Sync line numbers scroll with code editor
        DOMUtils.addEventListener('code', 'scroll', () => {
            this.syncLineNumbersScroll();
        });

        // Update line numbers on input
        DOMUtils.addEventListener('code', 'input', () => {
            this.updateLineNumbers();
        });
    }

    /**
     * Initialize editor with content
     * @param {string} content - Initial content for the editor
     */
    initializeEditor(content = '') {
        DOMUtils.setValue('code', content);
        this.updateLineNumbers();
    }

    /**
     * Get current editor content
     * @returns {string} Current editor content
     */
    getContent() {
        return DOMUtils.getValue('code');
    }

    /**
     * Set editor content
     * @param {string} content - Content to set in the editor
     */
    setContent(content) {
        DOMUtils.setValue('code', content);
        this.updateLineNumbers();
    }

    /**
     * Focus the editor
     */
    focus() {
        const codeElement = DOMUtils.getElementById('code');
        if (codeElement) {
            codeElement.focus();
        }
    }

    /**
     * Get cursor position in the editor
     * @returns {Object} Cursor position with start and end
     */
    getCursorPosition() {
        const codeElement = DOMUtils.getElementById('code');
        if (codeElement) {
            return {
                start: codeElement.selectionStart,
                end: codeElement.selectionEnd
            };
        }
        return { start: 0, end: 0 };
    }

    /**
     * Set cursor position in the editor
     * @param {number} start - Start position
     * @param {number} end - End position (optional, defaults to start)
     */
    setCursorPosition(start, end = start) {
        const codeElement = DOMUtils.getElementById('code');
        if (codeElement) {
            codeElement.setSelectionRange(start, end);
            codeElement.focus();
        }
    }

    /**
     * Insert text at current cursor position
     * @param {string} text - Text to insert
     */
    insertText(text) {
        const codeElement = DOMUtils.getElementById('code');
        if (codeElement) {
            const start = codeElement.selectionStart;
            const end = codeElement.selectionEnd;
            const value = codeElement.value;

            const newValue = value.substring(0, start) + text + value.substring(end);
            codeElement.value = newValue;

            // Set cursor position after inserted text
            const newCursorPos = start + text.length;
            codeElement.setSelectionRange(newCursorPos, newCursorPos);

            // Update line numbers and trigger input event
            this.updateLineNumbers();
            codeElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    /**
     * Replace selected text or insert at cursor
     * @param {string} text - Text to replace/insert
     */
    replaceSelection(text) {
        const codeElement = DOMUtils.getElementById('code');
        if (codeElement) {
            const start = codeElement.selectionStart;
            const end = codeElement.selectionEnd;

            // Replace selection or insert at cursor
            this.insertText(text);
        }
    }

    /**
     * Get selected text
     * @returns {string} Selected text
     */
    getSelectedText() {
        const codeElement = DOMUtils.getElementById('code');
        if (codeElement) {
            const start = codeElement.selectionStart;
            const end = codeElement.selectionEnd;
            return codeElement.value.substring(start, end);
        }
        return '';
    }

    /**
     * Select all text in the editor
     */
    selectAll() {
        const codeElement = DOMUtils.getElementById('code');
        if (codeElement) {
            codeElement.select();
        }
    }

    /**
     * Clear the editor content
     */
    clear() {
        this.setContent('');
    }

    /**
     * Check if editor has content
     * @returns {boolean} Whether editor has content
     */
    hasContent() {
        return this.getContent().trim().length > 0;
    }

    /**
     * Get line count
     * @returns {number} Number of lines in the editor
     */
    getLineCount() {
        return this.getContent().split('\n').length;
    }

    /**
     * Go to specific line
     * @param {number} lineNumber - Line number to go to (1-based)
     */
    goToLine(lineNumber) {
        const content = this.getContent();
        const lines = content.split('\n');

        if (lineNumber < 1 || lineNumber > lines.length) {
            return; // Invalid line number
        }

        // Calculate character position for the start of the line
        let position = 0;
        for (let i = 0; i < lineNumber - 1; i++) {
            position += lines[i].length + 1; // +1 for the newline character
        }

        this.setCursorPosition(position);
    }

    /**
     * Get current line number (1-based)
     * @returns {number} Current line number
     */
    getCurrentLineNumber() {
        const content = this.getContent();
        const cursorPos = this.getCursorPosition().start;
        const textBeforeCursor = content.substring(0, cursorPos);
        return textBeforeCursor.split('\n').length;
    }
}

export default EditorManager;
