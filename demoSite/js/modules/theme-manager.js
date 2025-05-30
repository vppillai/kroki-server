// Theme management module
import DOMUtils from '../utils/dom.js';

class ThemeManager {
    constructor() {
        this.themes = ['light', 'dark', 'auto'];
        this.currentTheme = 'light'; // Default to light mode
        this.storageKey = 'kroki-theme';
    }

    /**
     * Initialize theme system
     */
    init() {
        // Load saved theme or default to light
        this.currentTheme = localStorage.getItem(this.storageKey) || 'light';
        this.applyTheme(this.currentTheme);
        this.setupToggleButton();
    }

    /**
     * Apply a theme to the document
     * @param {string} theme - Theme to apply ('light', 'dark', or 'auto')
     */
    applyTheme(theme) {
        const body = document.body;

        // Remove existing theme classes
        body.classList.remove('light-theme', 'dark-theme');

        // Apply new theme
        if (theme === 'light') {
            body.classList.add('light-theme');
        } else if (theme === 'dark') {
            body.classList.add('dark-theme');
        }
        // 'auto' theme uses neither class, relying on CSS media queries

        this.currentTheme = theme;
        this.updateToggleButton();

        // Save theme preference
        localStorage.setItem(this.storageKey, theme);
    }

    /**
     * Get the next theme in the cycle
     * @returns {string} Next theme name
     */
    getNextTheme() {
        const currentIndex = this.themes.indexOf(this.currentTheme);
        return this.themes[(currentIndex + 1) % this.themes.length];
    }

    /**
     * Toggle to the next theme
     */
    toggleTheme() {
        const nextTheme = this.getNextTheme();
        this.applyTheme(nextTheme);
    }

    /**
     * Update the toggle button tooltip and state
     */
    updateToggleButton() {
        const button = DOMUtils.getElementById('theme-toggle');
        if (button) {
            const themeNames = {
                light: 'Light Mode',
                dark: 'Dark Mode',
                auto: 'Auto (System)'
            };

            const nextTheme = this.getNextTheme();
            const tooltip = `Current: ${themeNames[this.currentTheme]} - Click for ${themeNames[nextTheme]}`;
            DOMUtils.setAttributes('theme-toggle', { title: tooltip });
        }
    }

    /**
     * Set up the theme toggle button event listener
     */
    setupToggleButton() {
        DOMUtils.addEventListener('theme-toggle', 'click', () => {
            this.toggleTheme();
        });

        // Update initial tooltip
        this.updateToggleButton();
    }

    /**
     * Get current theme
     * @returns {string} Current theme name
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    /**
     * Set theme programmatically
     * @param {string} theme - Theme to set
     * @returns {boolean} Whether the theme was successfully set
     */
    setTheme(theme) {
        if (this.themes.includes(theme)) {
            this.applyTheme(theme);
            return true;
        }
        console.warn(`Invalid theme: ${theme}. Valid themes are: ${this.themes.join(', ')}`);
        return false;
    }

    /**
     * Get all available themes
     * @returns {string[]} Array of available theme names
     */
    getAvailableThemes() {
        return [...this.themes];
    }

    /**
     * Check if a theme is valid
     * @param {string} theme - Theme to check
     * @returns {boolean} Whether the theme is valid
     */
    isValidTheme(theme) {
        return this.themes.includes(theme);
    }
}

export default ThemeManager;
