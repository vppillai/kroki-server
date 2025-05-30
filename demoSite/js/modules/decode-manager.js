// Decode functionality module
import DOMUtils from '../utils/dom.js';
import EncodingUtils from '../utils/encoding.js';
import appState from '../core/state.js';

class DecodeManager {
    constructor() {
        this.setupEventListeners();
    }

    /**
     * Handle decode button click
     */
    handleDecode() {
        const encodedText = DOMUtils.getValue('encoded-text');
        if (!encodedText.trim()) return;

        try {
            const decodedText = EncodingUtils.decodeKrokiDiagram(encodedText);
            DOMUtils.setValue('code', decodedText);

            // Update line numbers and diagram
            if (window.editorManager) {
                window.editorManager.updateLineNumbers();
            }
            if (window.diagramManager) {
                window.diagramManager.updateDiagram();
            }

            appState.setUserEdited(true);

            // Clear the encoded text input
            DOMUtils.setValue('encoded-text', '');

        } catch (error) {
            console.error('Failed to decode diagram:', error);
            // Could show an error message to user here
            alert('Failed to decode the diagram. Please check the encoded text.');
        }
    }

    /**
     * Set up event listeners for decode functionality
     */
    setupEventListeners() {
        // Decode button click
        DOMUtils.addEventListener('decode-btn', 'click', () => this.handleDecode());

        // Enter key in encoded text input
        DOMUtils.addEventListener('encoded-text', 'keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleDecode();
            }
        });
    }
}

export default DecodeManager;
