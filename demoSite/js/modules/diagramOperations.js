/**
 * Diagram Operations Module
 *
 * Core diagram operations: debounce, format dropdown, example loading,
 * encoding/decoding, and image link management.
 * Rendering, download, and API functions are delegated to sub-modules.
 *
 * @author Vysakh Pillai
 */

import {
    state,
    updateCurrentOutputFormat,
    updateDiagramUpdateTimer,
    getExampleCache,
    setExampleCache
} from './state.js';
import { formatCompatibility, formatDisplayTypes } from './constants.js';
import { textEncode, uint8ArrayToString } from './utils.js';

// Re-export from sub-modules
export { shouldUsePostForCurrentDiagram } from './diagramApi.js';
export { downloadDiagram, handleDecode } from './diagramDownload.js';
export { updateDiagram } from './diagramRenderer.js';

/**
 * Debounce diagram updates to prevent excessive API calls
 */
export function debounceUpdateDiagram() {
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

    const timer = setTimeout(async () => {
        updateDiagramUpdateTimer(null);
        const { updateDiagram } = await import('./diagramRenderer.js');
        updateDiagram();
    }, state.DEBOUNCE_DELAY);

    updateDiagramUpdateTimer(timer);
}

/**
 * Update format dropdown based on selected diagram type
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
 * @param {string} type - Diagram type identifier
 * @returns {Promise<string>} Example content
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
 * @param {string} text - Diagram source code
 * @returns {string} URL-safe encoded diagram string
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
 * @param {string} encodedString - URL-safe encoded diagram string
 * @returns {string} Original diagram source code
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
 */
export function updateImageLink() {
    const imageLinkText = document.getElementById('image-link-text');
    const imageLinkRow = document.getElementById('image-link-row');

    if (formatDisplayTypes[state.currentOutputFormat] === 'image') {
        if (state.currentDiagramUrl.includes('[POST request - URL sharing not available]')) {
            imageLinkText.value = '[POST request - URL sharing not available]';
            imageLinkText.style.fontStyle = 'italic';
            imageLinkText.style.color = '#666';
        } else if (state.currentDiagramUrl.includes('[diagram-too-large-for-url]')) {
            imageLinkText.value = '[Diagram too large for URL - using POST request]';
            imageLinkText.style.fontStyle = 'italic';
            imageLinkText.style.color = '#666';
        } else {
            imageLinkText.value = state.currentDiagramUrl;
            imageLinkText.style.fontStyle = 'normal';
            imageLinkText.style.color = '';
        }
        imageLinkRow.style.display = 'flex';
    } else {
        imageLinkRow.style.display = 'none';
    }
}

/**
 * Initialize diagram type dropdown
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
