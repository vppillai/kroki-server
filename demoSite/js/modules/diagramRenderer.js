/**
 * Diagram Renderer Module
 *
 * Handles the core rendering logic for diagrams — image rendering, text preview,
 * and placeholder/download-only formats.
 *
 * @module diagramRenderer
 */

import {
    state,
    updateCurrentDiagramType,
    updateCurrentOutputFormat,
    updateCurrentDiagramUrl,
    updateDiagramUpdateTimer,
    updateCurrentDiagramData,
    updateZoomState
} from './state.js';
import { formatDisplayTypes, BLOB_CLEANUP_DELAY_MS } from './constants.js';
import { createTrackedBlobUrl, revokeBlobUrl } from './dom.js';
import { showBanner, hideBanner } from './errors.js';
import { encodeKrokiDiagram } from './diagramOperations.js';
import { generateDiagramWithPost, generateDiagramWithJsonPost, fetchDiagramViaPost } from './diagramApi.js';
import { updateUrl, clearUrlParameters } from './urlHandler.js';
import { api } from './api.js';

/**
 * Preserve current zoom state before diagram update
 * @returns {Object} Object containing scale, translateX, translateY
 * @private
 */
function preserveZoomState() {
    return {
        scale: state.zoomState.scale,
        translateX: state.zoomState.translateX,
        translateY: state.zoomState.translateY
    };
}

/**
 * Update and render the current diagram.
 * Processes diagram code, generates image/text output, handles errors and loading states.
 *
 * @async
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

    const shouldPreserveZoom = formatDisplayTypes[outputFormat] === 'image' && state.zoomState.userHasInteracted;
    const savedZoomState = shouldPreserveZoom ? preserveZoomState() : null;

    try {
        const alwaysUsePost = window.configManager ? window.configManager.get('kroki.alwaysUsePost') : false;
        const urlLengthThreshold = window.configManager ? window.configManager.get('kroki.urlLengthThreshold') : 4096;

        const encodedDiagram = encodeKrokiDiagram(code);

        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        const port = window.location.port ? `:${window.location.port}` : '';
        const url = `${protocol}//${hostname}${port}/${diagramType}/${outputFormat}/${encodedDiagram}`;

        const shouldUsePost = alwaysUsePost || url.length > urlLengthThreshold;

        if (shouldUsePost) {
            updateCurrentDiagramUrl('[POST request - URL sharing not available]');
        } else {
            updateCurrentDiagramUrl(url);
        }

        const displayType = formatDisplayTypes[outputFormat] || 'download';
        const diagramImg = document.getElementById('diagram');
        const textPreview = document.getElementById('text-preview');
        const placeholderContainer = document.getElementById('placeholder-container');
        const placeholderDownload = document.getElementById('placeholder-download');
        const zoomControls = document.getElementById('zoom-controls');
        const diagramViewport = document.getElementById('diagram-viewport');

        textPreview.style.display = 'none';
        placeholderContainer.style.display = 'none';

        if (displayType === 'image') {
            await renderImageDiagram(diagramImg, diagramViewport, zoomControls, url, diagramType, outputFormat, code, shouldUsePost, savedZoomState);
        } else if (displayType === 'text') {
            await renderTextDiagram(diagramViewport, zoomControls, textPreview, url, diagramType, outputFormat, code, shouldUsePost);
        } else {
            renderPlaceholderDiagram(diagramViewport, zoomControls, placeholderContainer, placeholderDownload, url, diagramType, outputFormat, code, shouldUsePost);
        }

        // Update image link
        const { updateImageLink } = await import('./diagramOperations.js');
        updateImageLink();

        if (!shouldUsePost) {
            updateUrl();
        } else {
            clearUrlParameters();
        }

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
 * Render an image diagram (SVG, PNG, JPEG)
 * @private
 */
async function renderImageDiagram(diagramImg, diagramViewport, zoomControls, url, diagramType, outputFormat, code, shouldUsePost, savedZoomState) {
    diagramViewport.style.display = 'block';
    zoomControls.style.display = 'flex';
    diagramImg.classList.add('loading');
    hideBanner();

    try {
        let imageUrl;

        if (shouldUsePost) {
            const postFormat = window.configManager ? window.configManager.get('kroki.postFormat') : 'plain';
            if (postFormat === 'json') {
                imageUrl = await generateDiagramWithJsonPost(diagramType, outputFormat, code);
            } else {
                imageUrl = await generateDiagramWithPost(diagramType, outputFormat, code);
            }
        } else {
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
                } catch {
                    errorMessage += `: ${response.statusText || 'Unknown error'}`;
                }

                showBanner(errorMessage);
                diagramImg.classList.remove('loading');

                if (!diagramImg.src || diagramImg.src === '') {
                    // SAFE: developer-controlled template
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

                updateCurrentDiagramData(shouldUsePost ? `POST:${diagramType}/${outputFormat}` : url);
                return;
            }

            const blob = await response.blob();
            imageUrl = createTrackedBlobUrl(blob);
        }

        // Preload image to get dimensions
        const tempImg = new Image();
        tempImg.onload = function () {
            const actualImageErrorHandler = function () {
                diagramImg.classList.remove('loading');
                showBanner('Failed to load diagram image');
                diagramImg.removeEventListener('load', actualImageLoadHandler);
                diagramImg.removeEventListener('error', actualImageErrorHandler);
            };

            const actualImageLoadHandler = function () {
                diagramImg.classList.remove('loading');

                const checkImageReady = () => {
                    if (diagramImg.complete && diagramImg.naturalWidth > 0) {
                        document.dispatchEvent(new CustomEvent('diagramRendered', {
                            detail: {
                                success: true,
                                code: code,
                                diagramType: diagramType,
                                outputFormat: outputFormat
                            }
                        }));

                        if (savedZoomState && state.zoomState.userHasInteracted) {
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
                            const zoomPanControls = window.diagramZoomPan;
                            if (zoomPanControls) {
                                zoomPanControls.resetZoom();
                            }
                        }
                        diagramImg.removeEventListener('load', actualImageLoadHandler);
                        diagramImg.removeEventListener('error', actualImageErrorHandler);
                    } else {
                        setTimeout(checkImageReady, 50);
                    }
                };

                setTimeout(checkImageReady, 10);
            };

            diagramImg.addEventListener('load', actualImageLoadHandler);
            diagramImg.addEventListener('error', actualImageErrorHandler);

            diagramImg.style.display = 'block';
            diagramImg.src = imageUrl;
        };

        tempImg.onerror = function () {
            diagramImg.classList.remove('loading');
            showBanner('Failed to load image data');
        };

        tempImg.src = imageUrl;
        updateCurrentDiagramData(shouldUsePost ? `POST:${diagramType}/${outputFormat}` : url);

    } catch (networkError) {
        diagramImg.classList.remove('loading');
        showBanner(`Network error: ${networkError.message}`);
        updateCurrentDiagramData(shouldUsePost ? `POST:${diagramType}/${outputFormat}` : url);
    }
}

/**
 * Render a text-based diagram (txt, base64)
 * @private
 */
async function renderTextDiagram(diagramViewport, zoomControls, textPreview, url, diagramType, outputFormat, code, shouldUsePost) {
    diagramViewport.style.display = 'none';
    zoomControls.style.display = 'none';

    let textContent;

    if (shouldUsePost) {
        textContent = await fetchDiagramViaPost(diagramType, outputFormat, code, 'text');
    } else {
        textContent = await api.getText(url);
    }

    textPreview.textContent = textContent;
    textPreview.style.display = 'block';
    updateCurrentDiagramData(textContent);
}

/**
 * Render a placeholder for download-only formats (PDF)
 * @private
 */
function renderPlaceholderDiagram(diagramViewport, zoomControls, placeholderContainer, placeholderDownload, url, diagramType, outputFormat, code, shouldUsePost) {
    diagramViewport.style.display = 'none';
    zoomControls.style.display = 'none';
    placeholderContainer.style.display = 'flex';

    if (shouldUsePost) {
        placeholderDownload.onclick = async (e) => {
            e.preventDefault();
            try {
                const blob = await fetchDiagramViaPost(diagramType, outputFormat, code, 'blob');
                const downloadUrl = createTrackedBlobUrl(blob);

                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `diagram.${outputFormat}`;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                setTimeout(() => revokeBlobUrl(downloadUrl), BLOB_CLEANUP_DELAY_MS);
            } catch (error) {
                console.error('Download failed:', error);
                alert(`Download failed: ${error.message}`);
            }
        };
        placeholderDownload.href = '#';
    } else {
        placeholderDownload.href = url;
        placeholderDownload.onclick = null;
    }

    placeholderDownload.download = `diagram.${outputFormat}`;
    updateCurrentDiagramData(shouldUsePost ? `POST:${diagramType}/${outputFormat}` : url);
}
