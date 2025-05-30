// Zoom and pan functionality module
import { CONSTANTS } from '../config/constants.js';
import appState from '../core/state.js';
import DOMUtils from '../utils/dom.js';

class ZoomPanControls {
    constructor() {
        this.isPanning = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Touch support variables
        this.touchStartDistance = 0;
        this.touchStartScale = 1;
        this.touches = [];

        this.initializeElements();
        this.setupEventListeners();
    }

    /**
     * Initialize DOM elements with error checking
     * @returns {boolean} Whether all required elements are available
     */
    initializeElements() {
        const elementIds = [
            'diagram-viewport', 'diagram-canvas', 'diagram', 'zoom-controls',
            'zoom-in', 'zoom-out', 'reset-zoom', 'zoom-level'
        ];

        this.elements = DOMUtils.getElementsByIds(elementIds, true);

        // Check if all required elements exist
        const missingElements = elementIds.filter(id => !this.elements[id]);
        if (missingElements.length > 0) {
            console.error('Zoom Pan: Missing required elements:', missingElements);
            return false;
        }

        return true;
    }

    /**
     * Update transform styles on the canvas
     */
    updateTransform() {
        const zoom = appState.zoom;
        if (this.elements['diagram-canvas']) {
            this.elements['diagram-canvas'].style.transform =
                `translate(${zoom.translateX}px, ${zoom.translateY}px) scale(${zoom.scale})`;
        }

        DOMUtils.setTextContent('zoom-level', Math.round(zoom.scale * 100) + '%');
    }

    /**
     * Reset zoom and pan to fit image optimally
     */
    resetZoom() {
        const diagramImg = this.elements.diagram;
        if (!diagramImg || !diagramImg.naturalWidth || !diagramImg.naturalHeight) {
            // If image dimensions aren't available yet, try again after a short delay
            setTimeout(() => this.resetZoom(), 50);
            return;
        }

        const viewport = this.elements['diagram-viewport'];
        const viewportRect = viewport.getBoundingClientRect();
        const viewportWidth = viewportRect.width;
        const viewportHeight = viewportRect.height;
        const imageWidth = diagramImg.naturalWidth;
        const imageHeight = diagramImg.naturalHeight;

        // Calculate scale to fit image in viewport with padding
        const availableWidth = viewportWidth - (CONSTANTS.ZOOM.PADDING * 2);
        const availableHeight = viewportHeight - (CONSTANTS.ZOOM.PADDING * 2);

        const scaleX = availableWidth / imageWidth;
        const scaleY = availableHeight / imageHeight;
        const fitScale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%

        // Calculate center position
        const scaledImageWidth = imageWidth * fitScale;
        const scaledImageHeight = imageHeight * fitScale;

        const centerX = (viewportWidth - scaledImageWidth) / 2;
        const centerY = (viewportHeight - scaledImageHeight) / 2;

        appState.updateZoomState({
            scale: fitScale,
            translateX: centerX,
            translateY: centerY,
            userHasInteracted: false // Reset interaction flag
        });

        this.updateTransform();
    }

    /**
     * Zoom at a specific point (mouse position)
     * @param {number} clientX - Mouse X coordinate
     * @param {number} clientY - Mouse Y coordinate  
     * @param {number} delta - Zoom delta (positive = zoom in)
     */
    zoomAt(clientX, clientY, delta) {
        const viewport = this.elements['diagram-viewport'];
        const viewportRect = viewport.getBoundingClientRect();
        const offsetX = clientX - viewportRect.left;
        const offsetY = clientY - viewportRect.top;

        const zoom = appState.zoom;

        // Calculate the point relative to the current transform
        const pointX = (offsetX - zoom.translateX) / zoom.scale;
        const pointY = (offsetY - zoom.translateY) / zoom.scale;

        // Calculate new scale with limits
        const newScale = Math.min(
            Math.max(zoom.scale + delta, CONSTANTS.ZOOM.MIN_SCALE),
            CONSTANTS.ZOOM.MAX_SCALE
        );
        const scaleDelta = newScale - zoom.scale;

        // Adjust translation to keep the point under the mouse
        const newTranslateX = zoom.translateX - pointX * scaleDelta;
        const newTranslateY = zoom.translateY - pointY * scaleDelta;

        appState.updateZoomState({
            scale: newScale,
            translateX: newTranslateX,
            translateY: newTranslateY,
            userHasInteracted: true
        });

        this.updateTransform();
    }

    /**
     * Start panning operation
     * @param {number} clientX - Starting X coordinate
     * @param {number} clientY - Starting Y coordinate
     */
    startPanning(clientX, clientY) {
        this.isPanning = true;
        this.lastMouseX = clientX;
        this.lastMouseY = clientY;
        DOMUtils.addClass('diagram-viewport', 'panning');
    }

    /**
     * Update panning during drag
     * @param {number} clientX - Current X coordinate
     * @param {number} clientY - Current Y coordinate
     */
    updatePanning(clientX, clientY) {
        if (!this.isPanning) return;

        const deltaX = clientX - this.lastMouseX;
        const deltaY = clientY - this.lastMouseY;

        const zoom = appState.zoom;
        appState.updateZoomState({
            translateX: zoom.translateX + deltaX,
            translateY: zoom.translateY + deltaY,
            userHasInteracted: true
        });

        this.lastMouseX = clientX;
        this.lastMouseY = clientY;

        this.updateTransform();
    }

    /**
     * Stop panning operation
     */
    stopPanning() {
        if (this.isPanning) {
            this.isPanning = false;
            DOMUtils.removeClass('diagram-viewport', 'panning');
        }
    }

    /**
     * Setup all event listeners for zoom and pan functionality
     */
    setupEventListeners() {
        if (!this.initializeElements()) {
            return; // Exit if required elements are missing
        }

        const viewport = this.elements['diagram-viewport'];

        // Mouse wheel zoom
        viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -CONSTANTS.ZOOM.SCALE_STEP : CONSTANTS.ZOOM.SCALE_STEP;
            this.zoomAt(e.clientX, e.clientY, delta);
        });

        // Mouse pan events
        viewport.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left mouse button
                this.startPanning(e.clientX, e.clientY);
                e.preventDefault();
            }
        });

        document.addEventListener('mousemove', (e) => {
            this.updatePanning(e.clientX, e.clientY);
        });

        document.addEventListener('mouseup', () => {
            this.stopPanning();
        });

        // Touch support for mobile
        viewport.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.touches = Array.from(e.touches);

            if (this.touches.length === 1) {
                // Single touch - start panning
                this.startPanning(this.touches[0].clientX, this.touches[0].clientY);
            } else if (this.touches.length === 2) {
                // Two finger touch - start pinch zoom
                this.stopPanning();

                const dx = this.touches[0].clientX - this.touches[1].clientX;
                const dy = this.touches[0].clientY - this.touches[1].clientY;
                this.touchStartDistance = Math.sqrt(dx * dx + dy * dy);
                this.touchStartScale = appState.zoom.scale;
            }
        });

        viewport.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.touches = Array.from(e.touches);

            if (this.touches.length === 1 && this.isPanning) {
                // Single touch - pan
                this.updatePanning(this.touches[0].clientX, this.touches[0].clientY);
            } else if (this.touches.length === 2) {
                // Two finger touch - pinch zoom
                const dx = this.touches[0].clientX - this.touches[1].clientX;
                const dy = this.touches[0].clientY - this.touches[1].clientY;
                const currentDistance = Math.sqrt(dx * dx + dy * dy);

                if (this.touchStartDistance > 0) {
                    const scaleChange = currentDistance / this.touchStartDistance;
                    const newScale = Math.min(
                        Math.max(this.touchStartScale * scaleChange, CONSTANTS.ZOOM.MIN_SCALE),
                        CONSTANTS.ZOOM.MAX_SCALE
                    );

                    // Get center point between fingers
                    const centerX = (this.touches[0].clientX + this.touches[1].clientX) / 2;
                    const centerY = (this.touches[0].clientY + this.touches[1].clientY) / 2;

                    // Apply zoom at center point
                    const viewportRect = viewport.getBoundingClientRect();
                    const offsetX = centerX - viewportRect.left;
                    const offsetY = centerY - viewportRect.top;

                    const zoom = appState.zoom;
                    const pointX = (offsetX - zoom.translateX) / zoom.scale;
                    const pointY = (offsetY - zoom.translateY) / zoom.scale;

                    const scaleDelta = newScale - zoom.scale;

                    appState.updateZoomState({
                        scale: newScale,
                        translateX: zoom.translateX - pointX * scaleDelta,
                        translateY: zoom.translateY - pointY * scaleDelta,
                        userHasInteracted: true
                    });

                    this.updateTransform();
                }
            }
        });

        viewport.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                this.stopPanning();
                this.touchStartDistance = 0;
            }
        });

        // Zoom control buttons
        DOMUtils.addEventListener('zoom-in', 'click', () => {
            const viewportRect = viewport.getBoundingClientRect();
            const centerX = viewportRect.left + viewportRect.width / 2;
            const centerY = viewportRect.top + viewportRect.height / 2;
            this.zoomAt(centerX, centerY, CONSTANTS.ZOOM.SCALE_STEP);
        });

        DOMUtils.addEventListener('zoom-out', 'click', () => {
            const viewportRect = viewport.getBoundingClientRect();
            const centerX = viewportRect.left + viewportRect.width / 2;
            const centerY = viewportRect.top + viewportRect.height / 2;
            this.zoomAt(centerX, centerY, -CONSTANTS.ZOOM.SCALE_STEP);
        });

        DOMUtils.addEventListener('reset-zoom', 'click', () => this.resetZoom());

        // Double click to reset zoom
        viewport.addEventListener('dblclick', () => this.resetZoom());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when the viewport area is focused/active
            if (document.activeElement === document.body || viewport.contains(document.activeElement)) {
                if (e.ctrlKey || e.metaKey) { // Ctrl on Windows/Linux, Cmd on Mac
                    const viewportRect = viewport.getBoundingClientRect();
                    const centerX = viewportRect.left + viewportRect.width / 2;
                    const centerY = viewportRect.top + viewportRect.height / 2;

                    switch (e.key) {
                        case '=':
                        case '+':
                            e.preventDefault();
                            this.zoomAt(centerX, centerY, CONSTANTS.ZOOM.SCALE_STEP);
                            break;
                        case '-':
                            e.preventDefault();
                            this.zoomAt(centerX, centerY, -CONSTANTS.ZOOM.SCALE_STEP);
                            break;
                        case '0':
                            e.preventDefault();
                            this.resetZoom();
                            break;
                    }
                }
            }
        });
    }

    /**
     * Preserve current zoom state (for diagram updates)
     * @returns {Object} Current zoom state
     */
    preserveZoomState() {
        const zoom = appState.zoom;
        return {
            scale: zoom.scale,
            translateX: zoom.translateX,
            translateY: zoom.translateY
        };
    }

    /**
     * Restore previously saved zoom state
     * @param {Object} savedState - Previously saved zoom state
     */
    restoreZoomState(savedState) {
        if (savedState) {
            appState.updateZoomState(savedState);

            // Apply the transform after a short delay to ensure image is loaded
            setTimeout(() => {
                this.updateTransform();
            }, 100);
        }
    }

    /**
     * Check if user has manually interacted with zoom/pan
     * @returns {boolean} Whether user has interacted
     */
    hasUserInteracted() {
        return appState.zoom.userHasInteracted;
    }
}

export default ZoomPanControls;
