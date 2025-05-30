// Diagram management module
import { FORMAT_COMPATIBILITY, FORMAT_DISPLAY_TYPES, CONSTANTS } from '../config/constants.js';
import appState from '../core/state.js';
import DOMUtils from '../utils/dom.js';
import EncodingUtils from '../utils/encoding.js';

class DiagramManager {
    constructor() {
        this.loadingMessages = {
            scheduled: 'Diagram update scheduled...',
            generating: 'Generating diagram...'
        };
    }

    /**
     * Update format dropdown based on selected diagram type
     */
    updateFormatDropdown() {
        const diagramType = DOMUtils.getValue('diagramType');
        const supportedFormats = FORMAT_COMPATIBILITY[diagramType] || ['svg'];
        const currentFormat = DOMUtils.getValue('outputFormat');

        // Clear and rebuild format dropdown
        const formatDropdown = DOMUtils.getElementById('outputFormat');
        if (formatDropdown) {
            formatDropdown.innerHTML = '';

            supportedFormats.forEach(format => {
                const option = DOMUtils.createElement('option', {
                    attributes: { value: format },
                    textContent: format.toUpperCase()
                });
                formatDropdown.appendChild(option);
            });

            // Set appropriate format
            if (supportedFormats.includes(currentFormat)) {
                DOMUtils.setValue('outputFormat', currentFormat);
            } else if (supportedFormats.includes('svg')) {
                DOMUtils.setValue('outputFormat', 'svg');
            } else {
                DOMUtils.setValue('outputFormat', supportedFormats[0]);
            }

            appState.setOutputFormat(DOMUtils.getValue('outputFormat'));
        }
    }

    /**
     * Load example for a specific diagram type
     * @param {string} type - Diagram type
     * @returns {Promise<string>} Example content
     */
    async loadExampleForDiagramType(type) {
        const examples = appState.examples;
        if (examples[type]) {
            return examples[type];
        }

        DOMUtils.toggleDisplay('loadingMessage', true);

        try {
            const response = await fetch(`/examples/${type}.txt`);

            if (response.ok) {
                const text = await response.text();
                appState.addExample(type, text);
                return text;
            } else {
                return `Enter your ${type} diagram code here...`;
            }
        } catch (error) {
            console.warn(`Could not load example for ${type}:`, error);
            return `Enter your ${type} diagram code here...`;
        } finally {
            DOMUtils.toggleDisplay('loadingMessage', false);
        }
    }

    /**
     * Show image error banner
     * @param {string} message - Error message to display
     */
    showImageErrorBanner(message) {
        DOMUtils.setTextContent('error-banner-message', message);
        DOMUtils.toggleDisplay('image-error-banner', true);
    }

    /**
     * Hide image error banner
     */
    hideImageErrorBanner() {
        DOMUtils.toggleDisplay('image-error-banner', false);
    }

    /**
     * Update the image link display
     */
    updateImageLink() {
        const format = appState.outputFormat;
        const isImage = FORMAT_DISPLAY_TYPES[format] === 'image';

        if (isImage) {
            DOMUtils.setValue('image-link-text', appState.diagramUrl);
            DOMUtils.toggleDisplay('image-link-row', true, 'flex');
        } else {
            DOMUtils.toggleDisplay('image-link-row', false);
        }
    }

    /**
     * Update URL with current diagram state
     */
    updateUrl() {
        const diagramType = DOMUtils.getValue('diagramType');
        const outputFormat = DOMUtils.getValue('outputFormat');
        const code = DOMUtils.getValue('code');

        const url = new URL(window.location.href);

        url.searchParams.set('diag', diagramType);
        url.searchParams.set('fmt', outputFormat);

        if (code.trim() === '') {
            url.searchParams.delete('im');
        } else {
            try {
                const encodedDiagram = EncodingUtils.encodeKrokiDiagram(code);
                url.searchParams.set('im', encodedDiagram);
            } catch (error) {
                console.warn('Failed to encode diagram for URL:', error);
                url.searchParams.delete('im');
            }
        }

        window.history.replaceState({}, '', url);
    }

    /**
     * Debounce diagram updates to avoid excessive API calls
     */
    debounceUpdateDiagram() {
        appState.clearDiagramUpdateTimer();

        DOMUtils.setTextContent('loadingMessage', this.loadingMessages.scheduled);
        DOMUtils.addClass('loadingMessage', 'loading-pulse');
        DOMUtils.toggleDisplay('loadingMessage', true);

        const timer = setTimeout(() => {
            appState.setDiagramUpdateTimer(null);
            this.updateDiagram();
        }, CONSTANTS.DEBOUNCE_DELAY);

        appState.setDiagramUpdateTimer(timer);
    }

    /**
     * Generate Kroki URL for current diagram
     * @param {string} code - Diagram code
     * @param {string} diagramType - Type of diagram
     * @param {string} outputFormat - Output format
     * @returns {string} Generated Kroki URL
     */
    generateKrokiUrl(code, diagramType, outputFormat) {
        const encodedDiagram = EncodingUtils.encodeKrokiDiagram(code);
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        const port = window.location.port ? `:${window.location.port}` : '';

        return `${protocol}//${hostname}${port}/${diagramType}/${outputFormat}/${encodedDiagram}`;
    }

    /**
     * Handle image display for diagram
     * @param {string} url - Diagram URL
     * @param {Object} zoomPanControls - Zoom/pan controls instance
     * @returns {Promise<void>}
     */
    async handleImageDisplay(url, zoomPanControls) {
        const diagramImg = DOMUtils.getElementById('diagram');
        const diagramViewport = DOMUtils.getElementById('diagram-viewport');
        const zoomControls = DOMUtils.getElementById('zoom-controls');

        if (!diagramImg) return;

        DOMUtils.addClass('diagram', 'loading');
        this.hideImageErrorBanner();

        // Preserve zoom state if user has interacted
        const shouldPreserveZoom = zoomPanControls && zoomPanControls.hasUserInteracted();
        const savedZoomState = shouldPreserveZoom ? zoomPanControls.preserveZoomState() : null;

        try {
            // Fetch and validate response
            const response = await fetch(url);

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}`;
                try {
                    const errorText = await response.text();
                    if (errorText && errorText.trim()) {
                        errorMessage += `: ${errorText}`;
                    } else {
                        errorMessage += `: ${response.statusText || 'Unknown error'}`;
                    }
                } catch (textError) {
                    errorMessage += `: ${response.statusText || 'Unknown error'}`;
                }

                this.showImageErrorBanner(errorMessage);
                DOMUtils.removeClass('diagram', 'loading');
                DOMUtils.toggleDisplay('diagram-viewport', true);
                DOMUtils.toggleDisplay('zoom-controls', true, 'flex');

                // Keep previous image if available
                if (!diagramImg.src) {
                    // Show a placeholder for error state
                    const placeholderSvg = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
                        <rect width="100%" height="100%" fill="#f8f9fa" stroke="#dee2e6" stroke-width="1"/>
                        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="Arial" font-size="14">
                            Previous diagram (error occurred)
                        </text>
                    </svg>`;
                    diagramImg.src = 'data:image/svg+xml;base64,' + btoa(placeholderSvg);
                }
                return;
            }

            // Response is OK, load the image
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);

            // Preload image to get dimensions
            const tempImg = new Image();
            tempImg.onload = () => {
                diagramImg.src = imageUrl;
                DOMUtils.removeClass('diagram', 'loading');
                DOMUtils.addClass('diagram', 'loaded');
                DOMUtils.toggleDisplay('diagram-viewport', true);
                DOMUtils.toggleDisplay('zoom-controls', true, 'flex');

                // Handle zoom state restoration
                const checkImageReady = () => {
                    if (diagramImg.complete && diagramImg.naturalWidth > 0) {
                        if (savedZoomState && shouldPreserveZoom) {
                            zoomPanControls.restoreZoomState(savedZoomState);
                        } else if (zoomPanControls) {
                            zoomPanControls.resetZoom();
                        }
                    } else {
                        setTimeout(checkImageReady, 50);
                    }
                };

                setTimeout(checkImageReady, 10);
            };

            tempImg.onerror = () => {
                DOMUtils.removeClass('diagram', 'loading');
                this.showImageErrorBanner('Failed to load image data');
                DOMUtils.toggleDisplay('diagram-viewport', true);
                DOMUtils.toggleDisplay('zoom-controls', true, 'flex');
            };

            tempImg.src = imageUrl;

        } catch (networkError) {
            DOMUtils.removeClass('diagram', 'loading');
            this.showImageErrorBanner(`Network error: ${networkError.message}`);
            DOMUtils.toggleDisplay('diagram-viewport', true);
            DOMUtils.toggleDisplay('zoom-controls', true, 'flex');
        }
    }

    /**
     * Handle text display for diagram
     * @param {string} url - Diagram URL
     * @returns {Promise<string>} Text content
     */
    async handleTextDisplay(url) {
        const response = await fetch(url);
        const text = await response.text();
        DOMUtils.setTextContent('text-preview', text);
        DOMUtils.toggleDisplay('text-preview', true);
        return text;
    }

    /**
     * Handle download placeholder display
     * @param {string} url - Diagram URL
     * @param {string} format - Output format
     */
    handleDownloadDisplay(url, format) {
        DOMUtils.toggleDisplay('placeholder-container', true, 'flex');
        DOMUtils.setAttributes('placeholder-download', {
            href: url,
            download: `diagram.${format}`
        });
    }

    /**
     * Update the diagram display
     * @param {Object} zoomPanControls - Zoom/pan controls instance (optional)
     */
    async updateDiagram(zoomPanControls = null) {
        const code = DOMUtils.getValue('code');
        const diagramType = DOMUtils.getValue('diagramType');
        const outputFormat = DOMUtils.getValue('outputFormat');

        // Update app state
        appState.setDiagramType(diagramType);
        appState.setOutputFormat(outputFormat);

        // Clear any pending updates
        appState.clearDiagramUpdateTimer();

        // Show loading indicator
        DOMUtils.setTextContent('loadingMessage', this.loadingMessages.generating);
        DOMUtils.addClass('loadingMessage', 'loading-pulse');
        DOMUtils.toggleDisplay('loadingMessage', true);

        try {
            const url = this.generateKrokiUrl(code, diagramType, outputFormat);
            appState.setDiagramUrl(url);

            const displayType = FORMAT_DISPLAY_TYPES[outputFormat] || 'download';

            // Hide all display elements first
            DOMUtils.toggleDisplay('diagram-viewport', false);
            DOMUtils.toggleDisplay('text-preview', false);
            DOMUtils.toggleDisplay('placeholder-container', false);
            DOMUtils.toggleDisplay('zoom-controls', false);

            let diagramData = url;

            // Handle different display types
            switch (displayType) {
                case 'image':
                    await this.handleImageDisplay(url, zoomPanControls);
                    break;
                case 'text':
                    diagramData = await this.handleTextDisplay(url);
                    break;
                default: // download
                    this.handleDownloadDisplay(url, outputFormat);
                    break;
            }

            appState.setDiagramData(diagramData);
            this.updateImageLink();
            this.updateUrl();

            // Hide loading and error indicators
            DOMUtils.toggleDisplay('loadingMessage', false);
            DOMUtils.removeClass('loadingMessage', 'loading-pulse');
            DOMUtils.toggleDisplay('errorMessage', false);

        } catch (error) {
            // Hide loading indicator and show error
            DOMUtils.toggleDisplay('loadingMessage', false);
            DOMUtils.removeClass('loadingMessage', 'loading-pulse');

            DOMUtils.setTextContent('errorMessage', `Error: ${error.message}`);
            DOMUtils.toggleDisplay('errorMessage', true);

            console.error('Diagram update error:', error);
        }
    }

    /**
     * Download the current diagram
     */
    downloadDiagram() {
        const diagramData = appState.diagramData;
        const format = appState.outputFormat;

        if (!diagramData) return;

        const displayType = FORMAT_DISPLAY_TYPES[format] || 'download';
        const filename = `diagram.${format.toLowerCase()}`;

        const a = document.createElement('a');

        if (displayType === 'text') {
            const blob = new Blob([diagramData], { type: 'text/plain' });
            a.href = URL.createObjectURL(blob);
        } else {
            a.href = diagramData;
        }

        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Clean up blob URL if created
        if (displayType === 'text') {
            URL.revokeObjectURL(a.href);
        }
    }

    /**
     * Initialize diagram type dropdown
     */
    initializeDiagramTypeDropdown() {
        const dropdown = DOMUtils.getElementById('diagramType');
        if (!dropdown) {
            console.error('Diagram type dropdown not found');
            return;
        }

        dropdown.innerHTML = '';

        const diagramTypes = Object.keys(FORMAT_COMPATIBILITY);
        diagramTypes.sort();

        diagramTypes.forEach(type => {
            const option = DOMUtils.createElement('option', {
                attributes: { value: type },
                textContent: type
            });
            dropdown.appendChild(option);
        });

        // Set default value
        if (diagramTypes.includes('plantuml')) {
            DOMUtils.setValue('diagramType', 'plantuml');
        } else {
            DOMUtils.setValue('diagramType', diagramTypes[0]);
        }
    }
}

export default DiagramManager;
