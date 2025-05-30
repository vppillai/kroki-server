// Message display functionality module
import DOMUtils from '../utils/dom.js';

class MessageManager {
    constructor() {
        // No initialization needed for now
    }

    /**
     * Show success message
     * @param {string} message - Success message to display
     */
    showSuccessMessage(message) {
        const saveStatus = DOMUtils.getElementById('save-status');
        if (!saveStatus) return;

        const originalClass = saveStatus.className;
        const originalText = saveStatus.textContent;

        DOMUtils.setTextContent('save-status', message);
        saveStatus.className = 'save-status saved';

        setTimeout(() => {
            DOMUtils.setTextContent('save-status', originalText);
            saveStatus.className = originalClass;
        }, 2000);
    }

    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    showErrorMessage(message) {
        DOMUtils.setTextContent('errorMessage', message);
        DOMUtils.toggleDisplay('errorMessage', true);

        setTimeout(() => {
            DOMUtils.toggleDisplay('errorMessage', false);
        }, 5000);
    }

    /**
     * Show temporary notification
     * @param {string} message - Notification message
     * @param {string} type - Type of notification ('success', 'error', 'info')
     * @param {number} duration - Duration in milliseconds
     */
    showNotification(message, type = 'info', duration = 3000) {
        // Create notification element if it doesn't exist
        let notification = DOMUtils.getElementById('notification');
        if (!notification) {
            notification = DOMUtils.createElement('div', {
                id: 'notification',
                className: 'notification',
                style: {
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    padding: '12px 16px',
                    borderRadius: '4px',
                    zIndex: '9999',
                    maxWidth: '300px',
                    fontSize: '14px',
                    fontWeight: '500',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    transform: 'translateX(100%)',
                    transition: 'transform 0.3s ease'
                }
            });
            document.body.appendChild(notification);
        }

        // Set message and type-specific styling
        notification.textContent = message;
        notification.className = `notification ${type}`;

        // Show notification
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);

        // Hide notification after duration
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
        }, duration);
    }

    /**
     * Clear all messages
     */
    clearMessages() {
        DOMUtils.toggleDisplay('errorMessage', false);
        DOMUtils.toggleDisplay('loadingMessage', false);
    }
}

export default MessageManager;
