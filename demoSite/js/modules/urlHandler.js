/**
 * URL Handler Module
 * 
 * Manages URL parameters for the Kroki diagram editor.
 * Handles parsing URL parameters, updating URL state, and synchronizing
 * application state with URL parameters for shareable links.
 * 
 * @module urlHandler
 * @author Vysakh Pillai
 */

import {
    updateCurrentDiagramType as setCurrentDiagramType,
    updateCurrentOutputFormat as setCurrentOutputFormat,
    updateUserHasEditedContent as setUserHasEditedContent
} from './state.js';
import { formatCompatibility } from './constants.js';
import { updateLineNumbers } from './utils.js';

// ========================================
// URL PARAMETER PARSING
// ========================================

/**
 * Parse URL parameters for application state
 * Extracts diagram type, format, and encoded content from query string
 * 
 * @function getUrlParameters
 * @returns {Object} Object containing parsed URL parameters
 * @property {string} [diag] - Diagram type identifier
 * @property {string} [fmt] - Output format
 * @property {string} [im] - Encoded diagram content
 * @public
 */
export function getUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    return {
        diag: params.get('diag'),
        fmt: params.get('fmt'),
        im: params.get('im')
    };
}

// ========================================
// URL PARAMETER PROCESSING
// ========================================

/**
 * Process URL parameters and update application state
 * Sets diagram type, format, and content based on URL query parameters
 * Handles format compatibility and provides fallbacks for invalid combinations
 * 
 * @function processUrlParameters
 * @public
 */
export function processUrlParameters() {
    const params = getUrlParameters();

    // Set diagram type if specified in URL
    if (params.diag && formatCompatibility[params.diag]) {
        document.getElementById('diagramType').value = params.diag;
        setCurrentDiagramType(params.diag);

        // Import and call updateFormatDropdown, then continue with processing
        import('./diagramOperations.js').then(module => {
            module.updateFormatDropdown();
            continueProcessing(params, module);
        });
    } else {
        // No diagram type in URL, continue with current type
        import('./diagramOperations.js').then(module => {
            continueProcessing(params, module);
        });
    }
}

/**
 * Continue processing URL parameters after diagram operations module is loaded
 * @private
 */
function continueProcessing(params, diagramModule) {
    // Get current diagram type and its supported formats
    const diagramType = document.getElementById('diagramType').value;
    const supportedFormats = formatCompatibility[diagramType] || ['svg'];

    // Set format if specified in URL and compatible with diagram type
    if (!params.fmt || !supportedFormats.includes(params.fmt)) {
        // Use default format if not specified or not supported
        const defaultFormat = supportedFormats.includes('svg') ? 'svg' : supportedFormats[0];
        document.getElementById('outputFormat').value = defaultFormat;
        setCurrentOutputFormat(defaultFormat);

        // Update URL with the correct format
        const url = new URL(window.location.href);
        url.searchParams.set('fmt', defaultFormat);
        window.history.replaceState({}, '', url);
    } else {
        document.getElementById('outputFormat').value = params.fmt;
        setCurrentOutputFormat(params.fmt);
    }

    // Set diagram code if encoded content is provided
    if (params.im) {
        try {
            const decodedText = diagramModule.decodeKrokiDiagram(params.im);
            document.getElementById('code').value = decodedText;
            updateLineNumbers();
            setUserHasEditedContent(true);
        } catch (error) {
            console.error('Failed to decode diagram from URL:', error);
            loadDefaultExample(diagramType);
        }
    } else {
        // No encoded content, load default example for current diagram type
        loadDefaultExample(diagramType);
    }
}

// ========================================
// DEFAULT CONTENT MANAGEMENT
// ========================================

/**
 * Load default example content for a diagram type
 * Loads and displays appropriate example code, with fallback handling
 * 
 * @function loadDefaultExample
 * @param {string} diagramType - Type of diagram to load example for
 * @public
 */
export function loadDefaultExample(diagramType) {
    import('./diagramOperations.js').then(module => {
        module.loadExampleForDiagramType(diagramType).then(example => {
            document.getElementById('code').value = example;
            updateLineNumbers();
            setUserHasEditedContent(false);
            import('./state.js').then(stateModule => {
                if (stateModule.state.autoRefreshEnabled) {
                    module.debounceUpdateDiagram();
                }
            });
        });
    });
}

// ========================================
// URL STATE SYNCHRONIZATION
// ========================================

/**
 * Update URL with current application state
 * Synchronizes URL parameters with current diagram type, format, and content
 * Enables shareable links and browser history support
 * 
 * @function updateUrl
 * @public
 */
export function updateUrl() {
    const diagramType = document.getElementById('diagramType').value;
    const outputFormat = document.getElementById('outputFormat').value;
    const code = document.getElementById('code').value;

    const url = new URL(window.location.href);

    url.searchParams.set('diag', diagramType);
    url.searchParams.set('fmt', outputFormat);

    if (code.trim() === '') {
        url.searchParams.delete('im');
    } else {
        // Import encode function dynamically to avoid circular dependency
        import('./diagramOperations.js').then(module => {
            const encodedDiagram = module.encodeKrokiDiagram(code);
            url.searchParams.set('im', encodedDiagram);
            window.history.replaceState({}, '', url);
        });
    }
} 

/**
 * Clear URL parameters to remove diagram-related query strings
 * Used when switching to POST requests where URL sharing is not applicable
 * 
 * @function clearUrlParameters
 * @public
 */
export function clearUrlParameters() {
    const url = new URL(window.location.href);
    
    // Remove all diagram-related parameters
    url.searchParams.delete('diag');
    url.searchParams.delete('fmt');
    url.searchParams.delete('im');
    
    // Update the browser URL without the parameters
    window.history.replaceState({}, '', url);
} 