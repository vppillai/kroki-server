// DOM utility functions for clean element access and manipulation
class DOMUtils {
    /**
     * Get element by ID with error handling
     * @param {string} id - Element ID
     * @param {boolean} required - Whether the element is required (logs error if missing)
     * @returns {HTMLElement|null}
     */
    static getElementById(id, required = false) {
        const element = document.getElementById(id);
        if (required && !element) {
            console.error(`Required element with ID '${id}' not found`);
        }
        return element;
    }

    /**
     * Get multiple elements by their IDs
     * @param {string[]} ids - Array of element IDs
     * @param {boolean} required - Whether all elements are required
     * @returns {Object} Object with id keys and element values
     */
    static getElementsByIds(ids, required = false) {
        const elements = {};
        const missing = [];

        ids.forEach(id => {
            const element = document.getElementById(id);
            elements[id] = element;
            if (required && !element) {
                missing.push(id);
            }
        });

        if (required && missing.length > 0) {
            console.error(`Required elements not found: ${missing.join(', ')}`);
        }

        return elements;
    }

    /**
     * Safely set text content of an element
     * @param {string} id - Element ID
     * @param {string} text - Text content to set
     * @returns {boolean} Success status
     */
    static setTextContent(id, text) {
        const element = this.getElementById(id);
        if (element) {
            element.textContent = text;
            return true;
        }
        return false;
    }

    /**
     * Safely set HTML content of an element
     * @param {string} id - Element ID
     * @param {string} html - HTML content to set
     * @returns {boolean} Success status
     */
    static setHTMLContent(id, html) {
        const element = this.getElementById(id);
        if (element) {
            element.innerHTML = html;
            return true;
        }
        return false;
    }

    /**
     * Safely set element value
     * @param {string} id - Element ID
     * @param {string} value - Value to set
     * @returns {boolean} Success status
     */
    static setValue(id, value) {
        const element = this.getElementById(id);
        if (element) {
            element.value = value;
            return true;
        }
        return false;
    }

    /**
     * Safely get element value
     * @param {string} id - Element ID
     * @returns {string} Element value or empty string
     */
    static getValue(id) {
        const element = this.getElementById(id);
        return element ? element.value : '';
    }

    /**
     * Toggle element display
     * @param {string} id - Element ID
     * @param {boolean} show - Whether to show the element
     * @param {string} displayType - CSS display value when showing
     */
    static toggleDisplay(id, show, displayType = 'block') {
        const element = this.getElementById(id);
        if (element) {
            element.style.display = show ? displayType : 'none';
        }
    }

    /**
     * Add CSS class to element
     * @param {string} id - Element ID
     * @param {string} className - Class name to add
     * @returns {boolean} Success status
     */
    static addClass(id, className) {
        const element = this.getElementById(id);
        if (element) {
            element.classList.add(className);
            return true;
        }
        return false;
    }

    /**
     * Remove CSS class from element
     * @param {string} id - Element ID
     * @param {string} className - Class name to remove
     * @returns {boolean} Success status
     */
    static removeClass(id, className) {
        const element = this.getElementById(id);
        if (element) {
            element.classList.remove(className);
            return true;
        }
        return false;
    }

    /**
     * Toggle CSS class on element
     * @param {string} id - Element ID
     * @param {string} className - Class name to toggle
     * @param {boolean} force - Force add (true) or remove (false)
     * @returns {boolean} Whether class is present after toggle
     */
    static toggleClass(id, className, force = undefined) {
        const element = this.getElementById(id);
        if (element) {
            return element.classList.toggle(className, force);
        }
        return false;
    }

    /**
     * Add event listener to element with error handling
     * @param {string} id - Element ID
     * @param {string} event - Event type
     * @param {Function} handler - Event handler function
     * @param {boolean} required - Whether element is required
     * @returns {boolean} Success status
     */
    static addEventListener(id, event, handler, required = false) {
        const element = this.getElementById(id, required);
        if (element) {
            element.addEventListener(event, handler);
            return true;
        }
        return false;
    }

    /**
     * Set multiple attributes on an element
     * @param {string} id - Element ID
     * @param {Object} attributes - Object with attribute key-value pairs
     * @returns {boolean} Success status
     */
    static setAttributes(id, attributes) {
        const element = this.getElementById(id);
        if (element) {
            Object.entries(attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
            return true;
        }
        return false;
    }

    /**
     * Create and configure a new element
     * @param {string} tagName - Element tag name
     * @param {Object} config - Configuration object
     * @param {string} config.id - Element ID
     * @param {string} config.className - CSS class name
     * @param {string} config.textContent - Text content
     * @param {string} config.innerHTML - HTML content
     * @param {Object} config.attributes - Attributes to set
     * @param {Object} config.style - Style properties to set
     * @returns {HTMLElement} Created element
     */
    static createElement(tagName, config = {}) {
        const element = document.createElement(tagName);

        if (config.id) element.id = config.id;
        if (config.className) element.className = config.className;
        if (config.textContent) element.textContent = config.textContent;
        if (config.innerHTML) element.innerHTML = config.innerHTML;

        if (config.attributes) {
            Object.entries(config.attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }

        if (config.style) {
            Object.entries(config.style).forEach(([key, value]) => {
                element.style[key] = value;
            });
        }

        return element;
    }

    /**
     * Check if element exists and is visible
     * @param {string} id - Element ID
     * @returns {boolean} Whether element exists and is visible
     */
    static isVisible(id) {
        const element = this.getElementById(id);
        if (!element) return false;

        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }

    /**
     * Smooth scroll to element
     * @param {string} id - Element ID
     * @param {Object} options - Scroll options
     */
    static scrollTo(id, options = { behavior: 'smooth', block: 'center' }) {
        const element = this.getElementById(id);
        if (element) {
            element.scrollIntoView(options);
        }
    }
}

export default DOMUtils;
