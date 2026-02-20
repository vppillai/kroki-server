/**
 * Diagram Download Module
 *
 * Handles downloading diagrams in various formats and the decode button functionality.
 *
 * @module diagramDownload
 */

import { state } from './state.js';
import { formatDisplayTypes } from './constants.js';
import { BLOB_CLEANUP_DELAY_MS } from './constants.js';
import { createTrackedBlobUrl, revokeBlobUrl } from './dom.js';
import { fetchDiagramViaPost } from './diagramApi.js';
import { decodeKrokiDiagram, updateDiagram } from './diagramOperations.js';

/**
 * Download current diagram to user's device.
 * Creates appropriate download based on output format (text blob or direct URL).
 */
export function downloadDiagram() {
    if (!state.currentDiagramData) return;

    const displayType = formatDisplayTypes[state.currentOutputFormat] || 'download';
    const format = state.currentOutputFormat.toLowerCase();
    const filename = `diagram.${format}`;

    const a = document.createElement('a');

    if (displayType === 'text') {
        const blob = new Blob([state.currentDiagramData], { type: 'text/plain' });
        a.href = createTrackedBlobUrl(blob);
    } else if (state.currentDiagramData.startsWith('POST:')) {
        // Handle POST-generated diagrams — need to re-generate for download
        const [, diagramPath] = state.currentDiagramData.split('POST:');
        const [diagramType, outputFormat] = diagramPath.split('/');
        const code = document.getElementById('code').value;

        fetchDiagramViaPost(diagramType, outputFormat, code, 'blob')
            .then(blob => {
                const downloadUrl = createTrackedBlobUrl(blob);
                a.href = downloadUrl;
                a.download = filename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => revokeBlobUrl(downloadUrl), BLOB_CLEANUP_DELAY_MS);
            })
            .catch(error => {
                console.error('Download failed:', error);
                alert(`Download failed: ${error.message}`);
            });
        return;
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
 * Handle decode button functionality.
 * Decodes Kroki-encoded diagram text and loads it into the editor.
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

        updateDiagram();

        encodedTextInput.value = '';
    } catch (error) {
        const errorMessage = document.getElementById('errorMessage');
        errorMessage.textContent = `Decode Error: ${error.message}`;
        errorMessage.style.display = 'block';
    }
}
