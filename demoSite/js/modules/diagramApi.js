/**
 * Diagram API Module
 *
 * Handles POST requests to the Kroki API for diagram generation.
 *
 * @module diagramApi
 */

import { api } from './api.js';
import { createTrackedBlobUrl } from './dom.js';
import { DEFAULT_POST_REQUEST_TIMEOUT } from './constants.js';
import { encodeKrokiDiagram } from './diagramOperations.js';

/**
 * Build the base URL for Kroki API requests
 * @returns {string} Base URL (e.g., "https://localhost:8443")
 */
function getBaseUrl() {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    return `${protocol}//${hostname}${port}`;
}

/**
 * Get the configured POST request timeout
 * @returns {number} Timeout in milliseconds
 */
function getTimeout() {
    return window.configManager
        ? window.configManager.get('kroki.postRequestTimeout')
        : DEFAULT_POST_REQUEST_TIMEOUT;
}

/**
 * Generate diagram via POST with plain text body.
 * Uses POST request with diagram content in request body.
 * Returns a tracked blob URL for the generated diagram image.
 *
 * @param {string} diagramType - Type of diagram (plantuml, mermaid, etc.)
 * @param {string} outputFormat - Output format (svg, png, etc.)
 * @param {string} diagramCode - Diagram source code
 * @returns {Promise<string>} Blob URL for the diagram
 */
export async function generateDiagramWithPost(diagramType, outputFormat, diagramCode) {
    const postUrl = `${getBaseUrl()}/${diagramType}/${outputFormat}`;
    const blob = await api.postBlob(postUrl, diagramCode, { timeout: getTimeout() });
    return createTrackedBlobUrl(blob);
}

/**
 * Generate diagram via POST with JSON body.
 * Uses POST request with JSON body containing diagram_source, diagram_type, and output_format.
 *
 * @param {string} diagramType - Type of diagram
 * @param {string} outputFormat - Output format
 * @param {string} diagramCode - Diagram source code
 * @returns {Promise<string>} Blob URL for the diagram
 */
export async function generateDiagramWithJsonPost(diagramType, outputFormat, diagramCode) {
    const postUrl = `${getBaseUrl()}/`;
    const body = {
        diagram_source: diagramCode,
        diagram_type: diagramType,
        output_format: outputFormat
    };
    const blob = await api.postJSON(postUrl, body, { parseAs: 'blob', timeout: getTimeout() });
    return createTrackedBlobUrl(blob);
}

/**
 * Determine if POST should be used for the current diagram settings.
 * Checks configuration preferences and URL length.
 *
 * @returns {boolean} True if POST should be used
 */
export function shouldUsePostForCurrentDiagram() {
    const code = document.getElementById('code').value;
    const diagramType = document.getElementById('diagramType').value;
    const outputFormat = document.getElementById('outputFormat').value;

    const alwaysUsePost = window.configManager ? window.configManager.get('kroki.alwaysUsePost') : false;
    const urlLengthThreshold = window.configManager ? window.configManager.get('kroki.urlLengthThreshold') : 4096;

    const encodedDiagram = encodeKrokiDiagram(code);
    const url = `${getBaseUrl()}/${diagramType}/${outputFormat}/${encodedDiagram}`;

    return alwaysUsePost || url.length > urlLengthThreshold;
}

/**
 * Fetch diagram content via POST for text or download formats.
 *
 * @param {string} diagramType - Diagram type
 * @param {string} outputFormat - Output format
 * @param {string} code - Diagram source code
 * @param {'text'|'blob'} parseAs - How to parse the response
 * @returns {Promise<string|Blob>} Response content
 */
export async function fetchDiagramViaPost(diagramType, outputFormat, code, parseAs = 'text') {
    const postFormat = window.configManager ? window.configManager.get('kroki.postFormat') : 'plain';
    const timeout = getTimeout();

    if (postFormat === 'json') {
        const postUrl = `${getBaseUrl()}/`;
        const body = {
            diagram_source: code,
            diagram_type: diagramType,
            output_format: outputFormat
        };
        return api.postJSON(postUrl, body, { parseAs, timeout });
    } else {
        const postUrl = `${getBaseUrl()}/${diagramType}/${outputFormat}`;
        if (parseAs === 'blob') {
            return api.postBlob(postUrl, code, { timeout });
        }
        return api.postText(postUrl, code, { timeout });
    }
}
