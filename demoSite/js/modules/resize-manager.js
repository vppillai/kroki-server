// Resize handle functionality module
import DOMUtils from '../utils/dom.js';

class ResizeManager {
    constructor() {
        this.isResizing = false;
        this.startX = 0;
        this.startWidth = 0;
        this.setupEventListeners();
    }

    /**
     * Start resizing operation
     * @param {MouseEvent} e - Mouse event
     */
    startResize(e) {
        this.isResizing = true;
        this.startX = e.clientX;

        const editor = DOMUtils.getElementById('editor') || document.querySelector('.editor');
        if (editor) {
            this.startWidth = editor.offsetWidth;
        }

        DOMUtils.addClass('resize-handle', 'dragging');

        // Prevent text selection during resize
        document.body.style.userSelect = 'none';
    }

    /**
     * Handle resize movement
     * @param {MouseEvent} e - Mouse event
     */
    handleResize(e) {
        if (!this.isResizing) return;

        const width = this.startWidth + (e.clientX - this.startX);
        const container = document.querySelector('.container');
        const editor = DOMUtils.getElementById('editor') || document.querySelector('.editor');

        if (!container || !editor) return;

        const containerWidth = container.offsetWidth;

        // Limit resize to reasonable bounds (10% to 90% of container)
        const minWidth = containerWidth * 0.1;
        const maxWidth = containerWidth * 0.9;

        if (width >= minWidth && width <= maxWidth) {
            editor.style.width = width + 'px';

            // Update line numbers after resize
            if (window.editorManager) {
                window.editorManager.updateLineNumbers();
            }

            // Check if controls need to be rearranged
            this.adjustControlsLayout();
        }
    }

    /**
     * Stop resizing operation
     */
    stopResize() {
        if (this.isResizing) {
            this.isResizing = false;
            DOMUtils.removeClass('resize-handle', 'dragging');
            document.body.style.userSelect = '';
        }
    }

    /**
     * Adjust controls layout based on available width
     */
    adjustControlsLayout() {
        const controls = document.querySelectorAll('.controls, .diagram-controls');

        controls.forEach(control => {
            const controlsWidth = control.offsetWidth;
            const containerWidth = control.parentElement ? control.parentElement.offsetWidth : 0;

            if (controlsWidth > containerWidth * 0.9) {
                DOMUtils.addClass(control.id || 'controls', 'compact');
            } else {
                DOMUtils.removeClass(control.id || 'controls', 'compact');
            }
        });
    }

    /**
     * Set up event listeners for resize functionality
     */
    setupEventListeners() {
        // Mouse down on resize handle
        DOMUtils.addEventListener('resize-handle', 'mousedown', (e) => this.startResize(e));

        // Mouse move for resizing
        document.addEventListener('mousemove', (e) => this.handleResize(e));

        // Mouse up to stop resizing
        document.addEventListener('mouseup', () => this.stopResize());

        // Window resize listener
        window.addEventListener('resize', () => this.adjustControlsLayout());
    }

    /**
     * Initialize resize functionality
     */
    initialize() {
        // Initial layout adjustment
        this.adjustControlsLayout();
    }
}

export default ResizeManager;
