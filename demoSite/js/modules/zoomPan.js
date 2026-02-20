/**
 * Zoom and Pan Module
 * 
 * Provides interactive zoom and pan controls for diagram viewing.
 * Supports mouse wheel zoom, drag-to-pan, touch gestures, and keyboard shortcuts.
 * 
 * @module zoomPan
 * @author Vysakh Pillai
 */

import { state, updateZoomState } from './state.js';
import { DOUBLE_CLICK_THRESHOLD_MS, ZOOM_FIT_PADDING_PX } from './constants.js';

// ========================================
// ZOOM AND PAN INITIALIZATION
// ========================================

/**
 * Initialize zoom and pan functionality for diagram viewing
 * Sets up interactive navigation controls, mouse/wheel events, and zoom state management
 * Provides zoom in/out, reset, and pan capabilities with proper bounds checking
 * 
 * @function initializeZoomPan
 * @returns {Object} Object with resetZoom and updateTransform methods
 * @public
 */
export function initializeZoomPan() {
    const viewport = document.getElementById('diagram-viewport');
    const canvas = document.getElementById('diagram-canvas');
    const diagram = document.getElementById('diagram');
    const zoomControls = document.getElementById('zoom-controls');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const resetZoomBtn = document.getElementById('reset-zoom');
    const zoomLevelSpan = document.getElementById('zoom-level');

    // Check if all required elements exist
    if (!viewport || !canvas || !diagram || !zoomControls || !zoomInBtn || !zoomOutBtn || !resetZoomBtn || !zoomLevelSpan) {
        console.error('Zoom Pan: Missing required elements', {
            viewport: !!viewport,
            canvas: !!canvas,
            diagram: !!diagram,
            zoomControls: !!zoomControls,
            zoomInBtn: !!zoomInBtn,
            zoomOutBtn: !!zoomOutBtn,
            resetZoomBtn: !!resetZoomBtn,
            zoomLevelSpan: !!zoomLevelSpan
        });
        return { resetZoom: () => { }, updateTransform: () => { } };
    }

    let isPanning = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let lastClickTime = 0;

    // ========================================
    // TRANSFORM MANAGEMENT
    // ========================================

    /**
     * Update canvas transform based on current zoom state
     * Applies scale and translation transformations to diagram canvas
     * Updates zoom level display indicator
     * 
     * @function updateTransform
     * @private
     */
    function updateTransform() {
        canvas.style.transform = `translate(${state.zoomState.translateX}px, ${state.zoomState.translateY}px) scale(${state.zoomState.scale})`;
        zoomLevelSpan.textContent = Math.round(state.zoomState.scale * 100) + '%';
    }

    /**
     * Reset zoom and pan to fit image in viewport
     * Calculates optimal scale and positioning to center diagram
     * Respects configuration padding and prevents upscaling beyond 100%
     * 
     * @function resetZoom
     * @private
     */
    function resetZoom() {
        if (!diagram.naturalWidth || !diagram.naturalHeight) {
            // If image dimensions aren't available yet, try again after a short delay
            setTimeout(() => resetZoom(), 50);
            return;
        }

        const viewportRect = viewport.getBoundingClientRect();
        const viewportWidth = viewportRect.width;
        const viewportHeight = viewportRect.height;
        const imageWidth = diagram.naturalWidth;
        const imageHeight = diagram.naturalHeight;

        // Calculate scale to fit image in viewport with some padding
        const padding = window.configManager ? window.configManager.get('zoom.resetPadding') : ZOOM_FIT_PADDING_PX;
        const availableWidth = viewportWidth - (padding * 2);
        const availableHeight = viewportHeight - (padding * 2);

        const scaleX = availableWidth / imageWidth;
        const scaleY = availableHeight / imageHeight;
        const fitScale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%

        // Calculate center position manually
        // The scaled image dimensions
        const scaledImageWidth = imageWidth * fitScale;
        const scaledImageHeight = imageHeight * fitScale;

        // Calculate the offset needed to center the image
        const centerX = (viewportWidth - scaledImageWidth) / 2;
        const centerY = (viewportHeight - scaledImageHeight) / 2;

        updateZoomState({
            scale: fitScale,
            translateX: centerX,
            translateY: centerY,
            userHasInteracted: false // Reset interaction flag
        });

        updateTransform();
    }

    // ========================================
    // ZOOM OPERATIONS
    // ========================================

    /**
     * Zoom at specific screen coordinates
     * Performs zoom operation while keeping the point under cursor/mouse in place
     * Applies zoom bounds checking and updates interaction state
     * 
     * @function zoomAt
     * @param {number} clientX - Screen X coordinate for zoom center
     * @param {number} clientY - Screen Y coordinate for zoom center  
     * @param {number} delta - Zoom change amount (positive for zoom in, negative for zoom out)
     * @private
     */
    function zoomAt(clientX, clientY, delta) {
        const viewportRect = viewport.getBoundingClientRect();
        const offsetX = clientX - viewportRect.left;
        const offsetY = clientY - viewportRect.top;

        // Calculate the point relative to the current transform
        const pointX = (offsetX - state.zoomState.translateX) / state.zoomState.scale;
        const pointY = (offsetY - state.zoomState.translateY) / state.zoomState.scale;

        // Calculate new scale
        const newScale = Math.min(Math.max(state.zoomState.scale + delta, state.zoomState.minScale), state.zoomState.maxScale);
        const scaleDelta = newScale - state.zoomState.scale;

        // Adjust translation to keep the point under the mouse
        updateZoomState({
            translateX: state.zoomState.translateX - (pointX * scaleDelta),
            translateY: state.zoomState.translateY - (pointY * scaleDelta),
            scale: newScale,
            userHasInteracted: true // Mark that user has interacted
        });

        updateTransform();
    }

    // ========================================
    // MOUSE EVENT HANDLERS
    // ========================================

    // Mouse wheel zoom — scale proportionally to deltaY for smooth increments
    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        // Normalize deltaY: line mode (~100 per notch) vs pixel mode (trackpad, varies)
        const normalizedDelta = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
        // Use a fraction of scaleStep proportional to the scroll amount
        // A typical notch (~100px) maps to the full scaleStep; smaller deltas scale down
        const factor = Math.min(Math.abs(normalizedDelta) / 100, 1);
        const delta = (normalizedDelta > 0 ? -1 : 1) * state.zoomState.scaleStep * factor;
        zoomAt(e.clientX, e.clientY, delta);
    });

    // Mouse pan
    viewport.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Left mouse button
            const currentTime = new Date().getTime();
            const timeSinceLastClick = currentTime - lastClickTime;

            // Check for double click
            if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD_MS) {
                e.preventDefault();
                resetZoom();
                return;
            }

            lastClickTime = currentTime;

            isPanning = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            viewport.classList.add('panning');
            e.preventDefault();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isPanning) {
            const deltaX = e.clientX - lastMouseX;
            const deltaY = e.clientY - lastMouseY;

            updateZoomState({
                translateX: state.zoomState.translateX + deltaX,
                translateY: state.zoomState.translateY + deltaY,
                userHasInteracted: true // Mark that user has interacted
            });

            lastMouseX = e.clientX;
            lastMouseY = e.clientY;

            updateTransform();
        }
    });

    document.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            viewport.classList.remove('panning');
        }
    });

    // ========================================
    // TOUCH EVENT HANDLERS
    // ========================================

    let touchStartDistance = 0;
    let touchStartScale = 1;
    let touches = [];

    viewport.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touches = Array.from(e.touches);

        if (touches.length === 1) {
            // Single touch - start panning
            isPanning = true;
            lastMouseX = touches[0].clientX;
            lastMouseY = touches[0].clientY;
            viewport.classList.add('panning');
        } else if (touches.length === 2) {
            // Two finger touch - start pinch zoom
            isPanning = false;
            viewport.classList.remove('panning');

            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            touchStartDistance = Math.sqrt(dx * dx + dy * dy);
            touchStartScale = state.zoomState.scale;
        }
    });

    viewport.addEventListener('touchmove', (e) => {
        e.preventDefault();
        touches = Array.from(e.touches);

        if (touches.length === 1 && isPanning) {
            // Single touch - pan
            const deltaX = touches[0].clientX - lastMouseX;
            const deltaY = touches[0].clientY - lastMouseY;

            updateZoomState({
                translateX: state.zoomState.translateX + deltaX,
                translateY: state.zoomState.translateY + deltaY
            });

            lastMouseX = touches[0].clientX;
            lastMouseY = touches[0].clientY;

            updateTransform();
        } else if (touches.length === 2) {
            // Two finger touch - pinch zoom
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            const currentDistance = Math.sqrt(dx * dx + dy * dy);

            if (touchStartDistance > 0) {
                const scaleChange = currentDistance / touchStartDistance;
                const newScale = Math.min(Math.max(touchStartScale * scaleChange, state.zoomState.minScale), state.zoomState.maxScale);

                // Get center point between fingers
                const centerX = (touches[0].clientX + touches[1].clientX) / 2;
                const centerY = (touches[0].clientY + touches[1].clientY) / 2;

                // Apply zoom at center point
                const viewportRect = viewport.getBoundingClientRect();
                const offsetX = centerX - viewportRect.left;
                const offsetY = centerY - viewportRect.top;

                const pointX = (offsetX - state.zoomState.translateX) / state.zoomState.scale;
                const pointY = (offsetY - state.zoomState.translateY) / state.zoomState.scale;

                const scaleDelta = newScale - state.zoomState.scale;

                updateZoomState({
                    translateX: state.zoomState.translateX - (pointX * scaleDelta),
                    translateY: state.zoomState.translateY - (pointY * scaleDelta),
                    scale: newScale,
                    userHasInteracted: true
                });

                updateTransform();
            }
        }
    });

    viewport.addEventListener('touchend', () => {
        isPanning = false;
        viewport.classList.remove('panning');
        touchStartDistance = 0;
    });

    // ========================================
    // BUTTON CONTROLS
    // ========================================

    // Zoom in button
    zoomInBtn.addEventListener('click', () => {
        const viewportRect = viewport.getBoundingClientRect();
        const centerX = viewportRect.left + viewportRect.width / 2;
        const centerY = viewportRect.top + viewportRect.height / 2;
        zoomAt(centerX, centerY, state.zoomState.scaleStep);
    });

    // Zoom out button
    zoomOutBtn.addEventListener('click', () => {
        const viewportRect = viewport.getBoundingClientRect();
        const centerX = viewportRect.left + viewportRect.width / 2;
        const centerY = viewportRect.top + viewportRect.height / 2;
        zoomAt(centerX, centerY, -state.zoomState.scaleStep);
    });

    // Reset zoom button
    resetZoomBtn.addEventListener('click', resetZoom);

    // ========================================
    // PUBLIC API
    // ========================================

    return {
        resetZoom,
        updateTransform
    };
} 