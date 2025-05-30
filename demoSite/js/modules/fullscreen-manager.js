// Fullscreen mode functionality module
import DOMUtils from '../utils/dom.js';

class FullscreenManager {
    constructor() {
        this.isFullscreen = false;
        this.notificationTimeout = null;
        this.setupEventListeners();
    }

    /**
     * Show fullscreen notification
     */
    showNotification() {
        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
        }

        DOMUtils.addClass('fullscreen-notification', 'show');

        this.notificationTimeout = setTimeout(() => {
            DOMUtils.removeClass('fullscreen-notification', 'show');
        }, 3000);
    }

    /**
     * Enter fullscreen mode
     */
    enterFullscreen() {
        this.isFullscreen = true;
        DOMUtils.addClass('body', 'fullscreen-mode');

        this.updateToggleButton();
        this.showNotification();

        // Update zoom controls to fit the new layout
        setTimeout(() => {
            if (window.diagramZoomPan) {
                window.diagramZoomPan.resetZoom();
            }
        }, 100);

        // Prevent body scrolling in fullscreen
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
    }

    /**
     * Exit fullscreen mode
     */
    exitFullscreen() {
        this.isFullscreen = false;
        DOMUtils.removeClass('body', 'fullscreen-mode');

        this.updateToggleButton();

        // Update zoom controls to fit the new layout
        setTimeout(() => {
            if (window.diagramZoomPan) {
                window.diagramZoomPan.resetZoom();
            }
        }, 100);

        // Restore body scrolling
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
    }

    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
        if (this.isFullscreen) {
            this.exitFullscreen();
        } else {
            this.enterFullscreen();
        }
    }

    /**
     * Update the fullscreen toggle button
     */
    updateToggleButton() {
        const button = DOMUtils.getElementById('fullscreen-toggle');
        if (!button) return;

        if (this.isFullscreen) {
            button.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="4 14 10 14 10 20"></polyline>
                    <polyline points="20 10 14 10 14 4"></polyline>
                    <line x1="14" y1="10" x2="21" y2="3"></line>
                    <line x1="3" y1="21" x2="10" y2="14"></line>
                </svg>
            `;
            DOMUtils.setAttributes('fullscreen-toggle', { title: 'Exit Fullscreen (F or Escape)' });
        } else {
            button.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="15,3 21,3 21,9"></polyline>
                    <polyline points="9,21 3,21 3,15"></polyline>
                    <line x1="21" y1="3" x2="14" y2="10"></line>
                    <line x1="3" y1="21" x2="10" y2="14"></line>
                </svg>
            `;
            DOMUtils.setAttributes('fullscreen-toggle', { title: 'Toggle Fullscreen View (F or Escape)' });
        }
    }

    /**
     * Handle keyboard shortcuts for fullscreen
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyboardShortcuts(event) {
        // Only handle fullscreen shortcuts when not typing in text areas
        if (event.target.tagName !== 'TEXTAREA' && event.target.tagName !== 'INPUT') {
            if (event.key === 'f' || event.key === 'F') {
                event.preventDefault();
                if (!this.isFullscreen) {
                    this.enterFullscreen();
                }
            } else if (event.key === 'Escape') {
                event.preventDefault();
                if (this.isFullscreen) {
                    this.exitFullscreen();
                }
            }
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Toggle button click handler
        DOMUtils.addEventListener('fullscreen-toggle', 'click', () => {
            this.toggleFullscreen();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Handle browser fullscreen API events
        document.addEventListener('fullscreenchange', () => {
            // If user exits browser fullscreen but we're still in our fullscreen mode
            if (!document.fullscreenElement && this.isFullscreen) {
                // Keep our fullscreen mode active
                // This allows our custom fullscreen to work independently of browser fullscreen
            }
        });

        // Initial button update
        this.updateToggleButton();
    }

    /**
     * Check if currently in fullscreen mode
     * @returns {boolean} Whether in fullscreen mode
     */
    isActive() {
        return this.isFullscreen;
    }

    /**
     * Force enter fullscreen mode
     */
    enter() {
        if (!this.isFullscreen) {
            this.enterFullscreen();
        }
    }

    /**
     * Force exit fullscreen mode
     */
    exit() {
        if (this.isFullscreen) {
            this.exitFullscreen();
        }
    }
}

export default FullscreenManager;
