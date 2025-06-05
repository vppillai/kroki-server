/**
 * Fullscreen Module
 * 
 * Provides fullscreen viewing mode for the diagram editor.
 * Manages fullscreen state, UI updates, and keyboard shortcuts.
 * 
 * @module fullscreen
 * @author Vysakh Pillai
 */

// ========================================
// FULLSCREEN MODE INITIALIZATION
// ========================================

/**
 * Initialize fullscreen mode functionality
 * Sets up fullscreen toggle, keyboard shortcuts, and notification system
 * Provides enhanced editing experience with full-screen diagram viewing
 * 
 * @function initializeFullscreenMode
 * @returns {Object} Object with toggle, enter, exit methods and isActive state
 * @public
 */
export function initializeFullscreenMode() {
    const fullscreenToggle = document.getElementById('fullscreen-toggle');
    const body = document.body;
    const notification = document.getElementById('fullscreen-notification');
    let isFullscreen = false;
    let notificationTimeout = null;

    // ========================================
    // NOTIFICATION SYSTEM
    // ========================================

    /**
     * Show fullscreen mode notification to user
     * Displays temporary notification with auto-hide timer
     * 
     * @function showNotification
     * @private
     */
    function showNotification() {
        if (notificationTimeout) {
            clearTimeout(notificationTimeout);
        }

        notification.classList.add('show');

        notificationTimeout = setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // ========================================
    // FULLSCREEN STATE MANAGEMENT
    // ========================================

    /**
     * Enter fullscreen mode
     * Activates fullscreen layout, updates controls, and prevents body scrolling
     * 
     * @function enterFullscreen
     * @private
     */
    function enterFullscreen() {
        isFullscreen = true;
        body.classList.add('fullscreen-mode');
        fullscreenToggle.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="4 14 10 14 10 20"></polyline>
                <polyline points="20 10 14 10 14 4"></polyline>
                <line x1="14" y1="10" x2="21" y2="3"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
        `;
        fullscreenToggle.title = 'Exit Fullscreen (F or Escape)';

        // Update zoom controls to fit the new layout
        setTimeout(() => {
            const zoomPanControls = window.diagramZoomPan;
            if (zoomPanControls) {
                zoomPanControls.resetZoom();
            }
        }, 100);

        showNotification();

        // Prevent body scrolling in fullscreen
        document.documentElement.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
    }

    /**
     * Exit fullscreen mode
     * Restores normal layout, updates controls, and re-enables body scrolling
     * 
     * @function exitFullscreen
     * @private
     */
    function exitFullscreen() {
        isFullscreen = false;
        body.classList.remove('fullscreen-mode');
        fullscreenToggle.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15,3 21,3 21,9"></polyline>
                <polyline points="9,21 3,21 3,15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
        `;
        fullscreenToggle.title = 'Toggle Fullscreen View (F or Escape)';

        // Update zoom controls to fit the new layout
        setTimeout(() => {
            const zoomPanControls = window.diagramZoomPan;
            if (zoomPanControls) {
                zoomPanControls.resetZoom();
            }
        }, 100);

        // Restore body scrolling
        document.documentElement.style.overflow = '';
        body.style.overflow = '';
    }

    /**
     * Toggle between fullscreen and normal mode
     * Switches fullscreen state based on current mode
     * 
     * @function toggleFullscreen
     * @private
     */
    function toggleFullscreen() {
        if (isFullscreen) {
            exitFullscreen();
        } else {
            enterFullscreen();
        }
    }

    // ========================================
    // EVENT HANDLERS
    // ========================================

    // Toggle button click handler
    fullscreenToggle.addEventListener('click', toggleFullscreen);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Only handle fullscreen shortcuts when not typing in text areas
        if (e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
            if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                if (!isFullscreen) {
                    enterFullscreen();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                if (isFullscreen) {
                    exitFullscreen();
                }
            }
        }
    });

    // Handle browser fullscreen API events
    document.addEventListener('fullscreenchange', () => {
        // If user exits browser fullscreen but we're still in our fullscreen mode
        if (!document.fullscreenElement && isFullscreen) {
            // Keep our fullscreen mode active
            // This allows our custom fullscreen to work independently of browser fullscreen
        }
    });

    // ========================================
    // PUBLIC API
    // ========================================

    return {
        toggle: toggleFullscreen,
        enter: enterFullscreen,
        exit: exitFullscreen,
        isActive: () => isFullscreen
    };
} 