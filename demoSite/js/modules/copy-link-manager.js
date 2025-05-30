// Copy link functionality module
import DOMUtils from '../utils/dom.js';

class CopyLinkManager {
    constructor() {
        this.setupEventListeners();
    }

    /**
     * Copy the image link to clipboard
     */
    copyImageLink() {
        const imageLinkText = DOMUtils.getElementById('image-link-text');
        if (!imageLinkText) return;

        try {
            imageLinkText.select();
            document.execCommand('copy');

            // Show feedback
            const button = DOMUtils.getElementById('copy-link-btn');
            if (button) {
                const originalText = button.textContent;
                button.textContent = 'Copied!';

                setTimeout(() => {
                    button.textContent = originalText;
                }, 1500);
            }
        } catch (error) {
            console.error('Failed to copy link:', error);
        }
    }

    /**
     * Set up event listeners for copy link functionality
     */
    setupEventListeners() {
        DOMUtils.addEventListener('copy-link-btn', 'click', () => this.copyImageLink());
    }
}

export default CopyLinkManager;
