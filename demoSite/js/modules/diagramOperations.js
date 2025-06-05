/**
 * Diagram Operations Module
 * 
 * Handles all diagram-related operations including rendering, encoding/decoding,
 * format management, and diagram type handling for the Kroki diagram editor.
 * 
 * @author Vysakh Pillai
 */

import {
    state,
    updateCurrentDiagramType,
    updateCurrentOutputFormat,
    updateCurrentDiagramUrl,
    updateDiagramUpdateTimer,
    updateCurrentDiagramData,
    updateUserHasEditedContent,
    updateZoomState,
    getExampleCache,
    setExampleCache
} from './state.js';
import { formatCompatibility, formatDisplayTypes } from './constants.js';
import { textEncode, uint8ArrayToString, updateLineNumbers } from './utils.js';
import { updateUrl } from './urlHandler.js';
import { showImageErrorBanner, hideImageErrorBanner } from './fileOperations.js';

/**
 * Debounce diagram updates to prevent excessive API calls
 * Delays diagram generation during rapid content changes
 * Only triggers updates when auto-refresh is enabled
 * 
 * @public
 */
export function debounceUpdateDiagram() {
    // Only auto-refresh if enabled
    if (!state.autoRefreshEnabled) {
        return;
    }

    if (state.diagramUpdateTimer) {
        clearTimeout(state.diagramUpdateTimer);
    }

    const loadingMessage = document.getElementById('loadingMessage');
    loadingMessage.textContent = 'Diagram update scheduled...';
    loadingMessage.classList.add('loading-pulse');
    loadingMessage.style.display = 'block';

    const timer = setTimeout(() => {
        updateDiagramUpdateTimer(null);
        updateDiagram();
    }, state.DEBOUNCE_DELAY);

    updateDiagramUpdateTimer(timer);
}

/**
 * Update format dropdown based on selected diagram type
 * Populates format options with compatible formats for current diagram type
 * Preserves current selection when possible, falls back to suitable defaults
 * 
 * @public
 */
export function updateFormatDropdown() {
    const diagramType = document.getElementById('diagramType').value;
    const formatDropdown = document.getElementById('outputFormat');
    const currentFormat = formatDropdown.value;

    const supportedFormats = formatCompatibility[diagramType] || ['svg'];

    formatDropdown.innerHTML = '';

    supportedFormats.forEach(format => {
        const option = document.createElement('option');
        option.value = format;
        option.textContent = format.toUpperCase();
        formatDropdown.appendChild(option);
    });

    if (supportedFormats.includes(currentFormat)) {
        formatDropdown.value = currentFormat;
    } else if (supportedFormats.includes('svg')) {
        formatDropdown.value = 'svg';
    } else {
        formatDropdown.value = supportedFormats[0];
    }

    updateCurrentOutputFormat(formatDropdown.value);
}

/**
 * Load example content for specific diagram type
 * Fetches example content from server, with caching and error handling
 * 
 * @param {string} type - Diagram type identifier
 * @returns {Promise<string>} Promise resolving to example content
 * @async
 * @public
 */
export async function loadExampleForDiagramType(type) {
    if (getExampleCache()[type]) {
        return getExampleCache()[type];
    }

    document.getElementById('loadingMessage').style.display = 'block';

    try {
        const response = await fetch(`/examples/${type}.txt`);

        if (response.ok) {
            const text = await response.text();
            setExampleCache(type, text);
            return text;
        } else {
            return `Enter your ${type} diagram code here...`;
        }
    } catch (error) {
        console.warn(`Could not load example for ${type}:`, error);
        return `Enter your ${type} diagram code here...`;
    } finally {
        document.getElementById('loadingMessage').style.display = 'none';
    }
}

/**
 * Encode diagram text for Kroki API
 * Compresses and encodes diagram source code for URL-safe transmission
 * Uses deflate compression and base64 encoding with URL-safe characters
 * 
 * @param {string} text - Diagram source code to encode
 * @returns {string} URL-safe encoded diagram string
 * @public
 */
export function encodeKrokiDiagram(text) {
    const bytes = textEncode(text);
    const compressed = pako.deflate(bytes);
    const strData = uint8ArrayToString(compressed);
    return btoa(strData)
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

/**
 * Decode Kroki diagram string back to source text
 * Reverses the encoding process to retrieve original diagram code
 * Handles base64 decoding and deflate decompression with error handling
 * 
 * @param {string} encodedString - URL-safe encoded diagram string
 * @returns {string} Original diagram source code
 * @throws {Error} When decoding fails
 * @public
 */
export function decodeKrokiDiagram(encodedString) {
    try {
        const base64String = encodedString
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const binaryString = atob(base64String);

        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const decompressed = pako.inflate(bytes);

        const decoder = new TextDecoder('utf-8');
        return decoder.decode(decompressed);
    } catch (error) {
        throw new Error(`Failed to decode: ${error.message}`);
    }
}

/**
 * Update image link display and content
 * Shows or hides image link row based on output format type
 * Updates link text with current diagram URL for image formats
 * 
 * @public
 */
export function updateImageLink() {
    const imageLinkText = document.getElementById('image-link-text');
    const imageLinkRow = document.getElementById('image-link-row');

    if (formatDisplayTypes[state.currentOutputFormat] === 'image') {
        imageLinkText.value = state.currentDiagramUrl;
        imageLinkRow.style.display = 'flex';
    } else {
        imageLinkRow.style.display = 'none';
    }
}

/**
 * Preserve current zoom state before diagram update
 * Captures current scale and translation values for restoration after update
 * Used to maintain user's view position when refreshing diagrams
 * 
 * @returns {Object} Object containing scale, translateX, and translateY values
 * @private
 */
function preserveZoomState() {
    // Store current zoom state before updating
    return {
        scale: state.zoomState.scale,
        translateX: state.zoomState.translateX,
        translateY: state.zoomState.translateY
    };
}

/**
 * Update and render the current diagram
 * Processes diagram code, generates image/text output, handles errors and loading states
 * Manages zoom state preservation, format-specific display logic, and user feedback
 * Integrates with code history tracking and URL synchronization
 * 
 * @async
 * @public
 */
export async function updateDiagram() {
    const code = document.getElementById('code').value;
    const diagramType = document.getElementById('diagramType').value;
    const outputFormat = document.getElementById('outputFormat').value;

    updateCurrentDiagramType(diagramType);
    updateCurrentOutputFormat(outputFormat);

    if (state.diagramUpdateTimer) {
        clearTimeout(state.diagramUpdateTimer);
        updateDiagramUpdateTimer(null);
    }

    const loadingMessage = document.getElementById('loadingMessage');
    loadingMessage.textContent = 'Generating diagram...';
    loadingMessage.classList.add('loading-pulse');
    loadingMessage.style.display = 'block';

    // Preserve zoom state if we're updating an image AND user has interacted with zoom/pan
    const shouldPreserveZoom = formatDisplayTypes[outputFormat] === 'image' && state.zoomState.userHasInteracted;
    const savedZoomState = shouldPreserveZoom ? preserveZoomState() : null;

    try {
        const encodedDiagram = encodeKrokiDiagram(code);

        // Use the same protocol as the current page
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        const port = window.location.port ? `:${window.location.port}` : '';

        const url = `${protocol}//${hostname}${port}/${diagramType}/${outputFormat}/${encodedDiagram}`;
        updateCurrentDiagramUrl(url);

        const displayType = formatDisplayTypes[outputFormat] || 'download';
        const diagramImg = document.getElementById('diagram');
        const textPreview = document.getElementById('text-preview');
        const placeholderContainer = document.getElementById('placeholder-container');
        const placeholderDownload = document.getElementById('placeholder-download');
        const zoomControls = document.getElementById('zoom-controls');
        const diagramViewport = document.getElementById('diagram-viewport');

        // Hide text preview and placeholder, but keep viewport visible for anti-flicker
        textPreview.style.display = 'none';
        placeholderContainer.style.display = 'none';

        if (displayType === 'image') {
            // Keep viewport and zoom controls visible for anti-flicker
            diagramViewport.style.display = 'block';
            zoomControls.style.display = 'flex';

            diagramImg.classList.add('loading');

            // Hide any existing error banner
            hideImageErrorBanner();

            try {
                // First, fetch the URL to check for HTTP errors
                const response = await fetch(url);

                if (!response.ok) {
                    // Handle non-200 responses
                    let errorMessage = `HTTP ${response.status}`;

                    try {
                        // Try to get error message from response body
                        const errorText = await response.text();
                        if (errorText && errorText.trim()) {
                            errorMessage += `: ${errorText}`;
                        } else {
                            errorMessage += `: ${response.statusText || 'Unknown error'}`;
                        }
                    } catch {
                        errorMessage += `: ${response.statusText || 'Unknown error'}`;
                    }

                    // Show error banner with server message
                    showImageErrorBanner(errorMessage);

                    // Remove loading state since we're keeping the previous image
                    diagramImg.classList.remove('loading');

                    // If there's a previous image, keep it; otherwise show placeholder
                    if (!diagramImg.src || diagramImg.src === '') {
                        // Show a minimal placeholder image for zoom/pan testing
                        const placeholderSvg = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
                            <rect width="100%" height="100%" fill="#f8f9fa" stroke="#dee2e6" stroke-width="1"/>
                            <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="Arial" font-size="14">
                                Previous diagram (error occurred)
                            </text>
                        </svg>`;
                        const placeholderDataUrl = 'data:image/svg+xml;base64,' + btoa(placeholderSvg);
                        diagramImg.style.display = 'block';
                        diagramImg.src = placeholderDataUrl;
                    }

                    updateCurrentDiagramData(url);
                    return; // Exit early, don't proceed with normal image loading
                }

                // Response is OK, proceed with normal image loading
                const blob = await response.blob();
                const imageUrl = URL.createObjectURL(blob);

                // Create a new image to preload and get dimensions
                const tempImg = new Image();
                tempImg.onload = function () {
                    // Define error handler first
                    const actualImageErrorHandler = function () {
                        diagramImg.classList.remove('loading');
                        showImageErrorBanner('Failed to load diagram image');
                        // Remove the event listeners to prevent them firing again
                        diagramImg.removeEventListener('load', actualImageLoadHandler);
                        diagramImg.removeEventListener('error', actualImageErrorHandler);
                    };

                    // Set up the actual diagram image load handler
                    const actualImageLoadHandler = function () {
                        diagramImg.classList.remove('loading');

                        // Wait for the image to be fully loaded and rendered in the DOM
                        const checkImageReady = () => {
                            if (diagramImg.complete && diagramImg.naturalWidth > 0) {
                                // Emit successful diagram render event for code history
                                document.dispatchEvent(new CustomEvent('diagramRendered', {
                                    detail: {
                                        success: true,
                                        code: code,
                                        diagramType: diagramType,
                                        outputFormat: outputFormat
                                    }
                                }));

                                // Restore zoom state or reset to fit
                                if (savedZoomState && state.zoomState.userHasInteracted) {
                                    // Apply saved zoom state
                                    updateZoomState({
                                        scale: savedZoomState.scale,
                                        translateX: savedZoomState.translateX,
                                        translateY: savedZoomState.translateY
                                    });
                                    const zoomPanControls = window.diagramZoomPan;
                                    if (zoomPanControls) {
                                        zoomPanControls.updateTransform();
                                    }
                                } else {
                                    // Reset zoom for new diagrams or when user hasn't interacted
                                    const zoomPanControls = window.diagramZoomPan;
                                    if (zoomPanControls) {
                                        zoomPanControls.resetZoom();
                                    }
                                }
                                // Remove the event listeners to prevent them firing again
                                diagramImg.removeEventListener('load', actualImageLoadHandler);
                                diagramImg.removeEventListener('error', actualImageErrorHandler);
                            } else {
                                // If image isn't ready yet, try again in a short while
                                setTimeout(checkImageReady, 50);
                            }
                        };

                        // Start checking if image is ready
                        setTimeout(checkImageReady, 10);
                    };

                    // Add event listeners to the actual diagram image
                    diagramImg.addEventListener('load', actualImageLoadHandler);
                    diagramImg.addEventListener('error', actualImageErrorHandler);

                    // Now set the source and make the image visible, which will trigger the load event when ready
                    diagramImg.style.display = 'block';
                    diagramImg.src = imageUrl;
                };

                tempImg.onerror = function () {
                    diagramImg.classList.remove('loading');
                    // This shouldn't happen since we already verified the response, but handle it gracefully
                    showImageErrorBanner('Failed to load image data');
                };

                tempImg.src = imageUrl;
                updateCurrentDiagramData(url);

            } catch (networkError) {
                // Handle network errors (no connection, timeout, etc.)
                diagramImg.classList.remove('loading');
                showImageErrorBanner(`Network error: ${networkError.message}`);

                // Keep previous image if available
                updateCurrentDiagramData(url);
            }
        } else if (displayType === 'text') {
            // Hide image viewport for text display
            diagramViewport.style.display = 'none';
            zoomControls.style.display = 'none';

            const response = await fetch(url);
            const text = await response.text();
            textPreview.textContent = text;
            textPreview.style.display = 'block';
            updateCurrentDiagramData(text);
        } else {
            // Hide image viewport for placeholder display
            diagramViewport.style.display = 'none';
            zoomControls.style.display = 'none';

            placeholderContainer.style.display = 'flex';
            placeholderDownload.href = url;
            placeholderDownload.download = `diagram.${outputFormat}`;
            updateCurrentDiagramData(url);
        }

        updateImageLink();
        updateUrl();

        loadingMessage.style.display = 'none';
        loadingMessage.classList.remove('loading-pulse');
        document.getElementById('errorMessage').style.display = 'none';
    } catch (error) {
        loadingMessage.style.display = 'none';
        loadingMessage.classList.remove('loading-pulse');
        const errorMessage = document.getElementById('errorMessage');
        errorMessage.textContent = `Error: ${error.message}`;
        errorMessage.style.display = 'block';
    }
}

/**
 * Download current diagram to user's device
 * Creates appropriate download based on output format (text blob or direct URL)
 * Generates filename based on current output format
 * 
 * @public
 */
export function downloadDiagram() {
    if (!state.currentDiagramData) return;

    const displayType = formatDisplayTypes[state.currentOutputFormat] || 'download';
    const format = state.currentOutputFormat.toLowerCase();
    const filename = `diagram.${format}`;

    const a = document.createElement('a');

    if (displayType === 'text') {
        const blob = new Blob([state.currentDiagramData], { type: 'text/plain' });
        a.href = URL.createObjectURL(blob);
    } else {
        a.href = state.currentDiagramData;
    }

    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * Handle decode button functionality
 * Decodes Kroki-encoded diagram text and loads it into the editor
 * Supports both full URLs and encoded strings, with error handling
 * 
 * @public
 */
export function handleDecode() {
    const encodedTextInput = document.getElementById('encoded-text');
    const encodedText = encodedTextInput.value.trim();

    if (!encodedText) return;

    try {
        let encodedDiagram = encodedText;
        if (encodedText.includes('/')) {
            encodedDiagram = encodedText.split('/').pop();
        }

        const decodedText = decodeKrokiDiagram(encodedDiagram);

        document.getElementById('code').value = decodedText;
        import('./state.js').then(module => {
            module.updateUserHasEditedContent(true);
        });

        updateLineNumbers();
        updateDiagram();

        encodedTextInput.value = '';
    } catch (error) {
        const errorMessage = document.getElementById('errorMessage');
        errorMessage.textContent = `Decode Error: ${error.message}`;
        errorMessage.style.display = 'block';
    }
}

/**
 * Initialize diagram type dropdown with available formats
 * Populates dropdown with sorted diagram types from format compatibility
 * Sets default selection to PlantUML or first available type
 * 
 * @public
 */
export function initializeDiagramTypeDropdown() {
    const diagramTypeDropdown = document.getElementById('diagramType');
    if (!diagramTypeDropdown) {
        console.error('Diagram type dropdown not found');
        return;
    }

    diagramTypeDropdown.innerHTML = '';

    const diagramTypes = Object.keys(formatCompatibility);
    diagramTypes.sort();

    diagramTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        diagramTypeDropdown.appendChild(option);
    });

    if (diagramTypes.includes('plantuml')) {
        diagramTypeDropdown.value = 'plantuml';
    } else {
        diagramTypeDropdown.value = diagramTypes[0];
    }
} 