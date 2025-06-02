/**
 * Code History Manager for Kroki Diagram Editor
 * Manages undo/redo functionality for diagram code changes
 */

class CodeHistory {
    constructor() {
        this.history = [];
        this.currentIndex = -1;
        this.maxHistorySize = 50; // Limit history to prevent memory issues
        this.isNavigating = false; // Flag to prevent history updates during navigation
        this.pendingCode = null; // Code waiting for successful render

        this.init();
    }

    init() {
        this.createNavigationButtons();
        this.setupEventListeners();
    }

    createNavigationButtons() {
        // Find the editor header where we should place the navigation controls
        const editorHeader = document.querySelector('.editor-header');
        if (!editorHeader) {
            console.warn('CodeHistory: Could not find editor header for navigation buttons');
            return;
        }

        // Create navigation controls container
        const navContainer = document.createElement('div');
        navContainer.className = 'code-history-nav';
        navContainer.innerHTML = `
            <div class="code-history-controls">
                <button id="code-history-back" class="code-history-btn" title="Go back to previous version (Ctrl/Cmd+Z)" disabled>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="m15 18-6-6 6-6"/>
                    </svg>
                </button>
                <span class="code-history-indicator" id="code-history-indicator">1/1</span>
                <button id="code-history-forward" class="code-history-btn" title="Go forward to next version (Ctrl/Cmd+Y)" disabled>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="m9 18 6-6-6-6"/>
                    </svg>
                </button>
            </div>
        `;

        // Find the editor controls and add our navigation controls to it
        const editorControls = editorHeader.querySelector('.editor-controls');
        if (editorControls) {
            // Add navigation controls as first item in editor controls
            editorControls.insertBefore(navContainer, editorControls.firstChild);
        } else {
            // Fallback: add to editor header
            editorHeader.appendChild(navContainer);
        }

        // Store references
        this.backButton = document.getElementById('code-history-back');
        this.forwardButton = document.getElementById('code-history-forward');
        this.indicator = document.getElementById('code-history-indicator');
    }

    setupEventListeners() {
        // Navigation button handlers
        if (this.backButton) {
            this.backButton.addEventListener('click', () => this.goBack());
        }
        if (this.forwardButton) {
            this.forwardButton.addEventListener('click', () => this.goForward());
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
                e.preventDefault();
                this.goBack();
            } else if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') ||
                ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
                e.preventDefault();
                this.goForward();
            }
        });

        // Listen for successful diagram renders
        document.addEventListener('diagramRendered', (event) => {
            if (event.detail && event.detail.success && event.detail.code) {
                this.addToHistory(event.detail.code);
            }
        });

        // Listen for code changes (to detect manual edits)
        const codeTextarea = document.getElementById('code');
        if (codeTextarea) {
            let changeTimeout;
            codeTextarea.addEventListener('input', () => {
                // Debounce to avoid excessive history entries during typing
                clearTimeout(changeTimeout);
                changeTimeout = setTimeout(() => {
                    if (!this.isNavigating) {
                        this.pendingCode = codeTextarea.value;
                    }
                }, 1000);
            });
        }
    }

    addToHistory(code) {
        // Don't add if we're currently navigating or if code hasn't changed
        if (this.isNavigating || this.isDuplicate(code)) {
            return;
        }

        // Truncate history after current position (branch off)
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }

        // Add new entry
        const entry = {
            code: code,
            timestamp: Date.now(),
            id: this.generateId()
        };

        this.history.push(entry);
        this.currentIndex = this.history.length - 1;

        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.currentIndex--;
        }

        this.updateUI();
        this.clearPendingCode();
    }

    isDuplicate(code) {
        if (this.history.length === 0) return false;
        const lastEntry = this.history[this.currentIndex];
        return lastEntry && lastEntry.code === code;
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    goBack() {
        if (!this.canGoBack()) return;

        this.currentIndex--;
        this.navigateToCurrentEntry();
    }

    goForward() {
        if (!this.canGoForward()) return;

        this.currentIndex++;
        this.navigateToCurrentEntry();
    }

    navigateToCurrentEntry() {
        if (this.currentIndex < 0 || this.currentIndex >= this.history.length) {
            return;
        }

        const entry = this.history[this.currentIndex];
        this.isNavigating = true;

        // Add visual feedback
        const navContainer = document.querySelector('.code-history-nav');
        if (navContainer) {
            navContainer.classList.add('navigating');
            setTimeout(() => {
                navContainer.classList.remove('navigating');
            }, 300);
        }

        // Update the code editor
        const codeTextarea = document.getElementById('code');
        if (codeTextarea && entry.code !== codeTextarea.value) {
            codeTextarea.value = entry.code;

            // Trigger change event to update the diagram
            const changeEvent = new Event('change', { bubbles: true });
            codeTextarea.dispatchEvent(changeEvent);

            // Also trigger input event
            const inputEvent = new Event('input', { bubbles: true });
            codeTextarea.dispatchEvent(inputEvent);

            // Trigger diagram update if function exists
            if (typeof updateDiagram === 'function') {
                updateDiagram();
            }
        }

        this.updateUI();

        // Reset navigation flag after a short delay
        setTimeout(() => {
            this.isNavigating = false;
        }, 500);
    }

    canGoBack() {
        return this.currentIndex > 0;
    }

    canGoForward() {
        return this.currentIndex < this.history.length - 1;
    }

    updateUI() {
        // Update button states
        if (this.backButton) {
            this.backButton.disabled = !this.canGoBack();
        }
        if (this.forwardButton) {
            this.forwardButton.disabled = !this.canGoForward();
        }

        // Update indicator
        if (this.indicator) {
            const current = this.currentIndex + 1;
            const total = this.history.length;
            this.indicator.textContent = `${current}/${total}`;
        }
    }

    clearPendingCode() {
        this.pendingCode = null;
    }

    getCurrentCode() {
        if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
            return this.history[this.currentIndex].code;
        }
        return null;
    }

    getHistoryInfo() {
        return {
            current: this.currentIndex + 1,
            total: this.history.length,
            canGoBack: this.canGoBack(),
            canGoForward: this.canGoForward()
        };
    }

    // Initialize with current code if available
    initializeWithCurrentCode() {
        const codeTextarea = document.getElementById('code');
        if (codeTextarea && codeTextarea.value.trim()) {
            this.addToHistory(codeTextarea.value);
        }
    }

    // Clear history (useful for reset)
    clear() {
        this.history = [];
        this.currentIndex = -1;
        this.updateUI();
    }
}

// Export for use by main application
window.CodeHistory = CodeHistory;