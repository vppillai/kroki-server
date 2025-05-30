// URL parameter handling module
import appState from '../core/state.js';
import DOMUtils from '../utils/dom.js';
import EncodingUtils from '../utils/encoding.js';
import { FORMAT_COMPATIBILITY } from '../config/constants.js';

class URLHandler {
    /**
     * Parse URL parameters
     * @returns {Object} Parsed URL parameters
     */
    getUrlParameters() {
        const params = new URLSearchParams(window.location.search);
        return {
            diag: params.get('diag'),
            fmt: params.get('fmt'),
            im: params.get('im')
        };
    }

    /**
     * Process URL parameters and update UI accordingly
     * @param {Function} loadDefaultExample - Function to load default example
     * @param {Function} updateFormatDropdown - Function to update format dropdown
     * @param {Function} updateLineNumbers - Function to update line numbers
     */
    processUrlParameters(loadDefaultExample, updateFormatDropdown, updateLineNumbers) {
        const params = this.getUrlParameters();

        // Set diagram type if specified in URL and valid
        if (params.diag && FORMAT_COMPATIBILITY[params.diag]) {
            DOMUtils.setValue('diagramType', params.diag);
            appState.setDiagramType(params.diag);
            if (updateFormatDropdown) updateFormatDropdown();
        }

        // Get current diagram type and its supported formats
        const diagramType = DOMUtils.getValue('diagramType');
        const supportedFormats = FORMAT_COMPATIBILITY[diagramType] || ['svg'];

        // Set format if specified in URL and compatible with diagram type
        if (!params.fmt || !supportedFormats.includes(params.fmt)) {
            // Use default format if not specified or not supported
            const defaultFormat = supportedFormats.includes('svg') ? 'svg' : supportedFormats[0];
            DOMUtils.setValue('outputFormat', defaultFormat);
            appState.setOutputFormat(defaultFormat);

            // Update URL with the correct format
            const url = new URL(window.location.href);
            url.searchParams.set('fmt', defaultFormat);
            window.history.replaceState({}, '', url);
        } else {
            DOMUtils.setValue('outputFormat', params.fmt);
            appState.setOutputFormat(params.fmt);
        }

        // Set diagram code if encoded content is provided
        if (params.im) {
            try {
                const decodedText = EncodingUtils.decodeKrokiDiagram(params.im);
                DOMUtils.setValue('code', decodedText);
                if (updateLineNumbers) updateLineNumbers();
                appState.setUserEdited(true);
            } catch (error) {
                console.error('Failed to decode diagram from URL:', error);
                if (loadDefaultExample) loadDefaultExample(diagramType);
            }
        } else {
            if (loadDefaultExample) loadDefaultExample(diagramType);
        }
    }

    /**
     * Update the URL with current diagram state
     * @param {string} diagramType - Current diagram type
     * @param {string} outputFormat - Current output format
     * @param {string} code - Current diagram code
     */
    updateUrl(diagramType, outputFormat, code) {
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
}

export default URLHandler;
