// Help modal functionality module
import DOMUtils from '../utils/dom.js';

class HelpManager {
    constructor() {
        this.setupEventListeners();
    }

    /**
     * Show the help modal
     */
    showHelp() {
        DOMUtils.toggleDisplay('help-modal', true, 'flex');
    }

    /**
     * Hide the help modal
     */
    hideHelp() {
        DOMUtils.toggleDisplay('help-modal', false);
    }

    /**
     * Toggle help modal visibility
     */
    toggleHelp() {
        const modal = DOMUtils.getElementById('help-modal');
        if (modal) {
            const isVisible = DOMUtils.isVisible('help-modal');
            if (isVisible) {
                this.hideHelp();
            } else {
                this.showHelp();
            }
        }
    }

    /**
     * Set up event listeners for help modal
     */
    setupEventListeners() {
        // Help button click
        DOMUtils.addEventListener('zoom-help', 'click', () => this.showHelp());

        // Close button click
        DOMUtils.addEventListener('close-help', 'click', () => this.hideHelp());

        // Click outside modal to close
        DOMUtils.addEventListener('help-modal', 'click', (e) => {
            const modal = DOMUtils.getElementById('help-modal');
            if (e.target === modal) {
                this.hideHelp();
            }
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && DOMUtils.isVisible('help-modal')) {
                this.hideHelp();
            }
        });
    }
}

export default HelpManager;
