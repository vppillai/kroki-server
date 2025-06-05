/**
 * Theme Module
 * 
 * Manages visual appearance themes for the diagram editor.
 * Supports light, dark, and auto (system) themes with persistent preferences.
 * 
 * @module theme
 * @author Vysakh Pillai
 */

// ========================================
// THEME MANAGER
// ========================================

/**
 * Theme management system for visual appearance control
 * Handles light, dark, and auto themes with persistent user preferences
 * Provides theme switching functionality and UI updates
 * 
 * @namespace ThemeManager
 * @constant
 * @public
 */
export const ThemeManager = {
    /**
     * Available theme options
     * @type {string[]}
     */
    themes: ['light', 'dark', 'auto'],

    /**
     * Currently active theme
     * @type {string}
     */
    currentTheme: 'light',

    /**
     * Initialize theme system
     * Loads saved preference from localStorage and sets up UI
     * 
     * @method init
     * @memberof ThemeManager
     */
    init() {
        // Load saved theme or default to light
        this.currentTheme = localStorage.getItem('kroki-theme') || 'light';
        this.applyTheme(this.currentTheme);
        this.setupToggleButton();
    },

    /**
     * Apply a specific theme to the document
     * Updates body classes and saves preference
     * 
     * @method applyTheme
     * @memberof ThemeManager
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
        // Note: 'auto' theme uses neither class, relying on CSS media queries

        this.currentTheme = theme;
        this.updateToggleButton();

        // Persist theme preference
        localStorage.setItem('kroki-theme', theme);
    },

    /**
     * Get the next theme in the rotation
     * Cycles through: light → dark → auto → light
     * 
     * @method getNextTheme
     * @memberof ThemeManager
     * @returns {string} Next theme name
     */
    getNextTheme() {
        const currentIndex = this.themes.indexOf(this.currentTheme);
        return this.themes[(currentIndex + 1) % this.themes.length];
    },

    /**
     * Toggle to the next theme in the rotation
     * 
     * @method toggleTheme
     * @memberof ThemeManager
     */
    toggleTheme() {
        const nextTheme = this.getNextTheme();
        this.applyTheme(nextTheme);
    },

    /**
     * Update theme toggle button tooltip
     * Shows current theme and what the next click will do
     * 
     * @method updateToggleButton
     * @memberof ThemeManager
     */
    updateToggleButton() {
        const button = document.getElementById('theme-toggle');
        if (button) {
            const themeNames = {
                light: 'Light Mode',
                dark: 'Dark Mode',
                auto: 'Auto (System)'
            };

            const nextTheme = this.getNextTheme();
            button.title = `Current: ${themeNames[this.currentTheme]} - Click for ${themeNames[nextTheme]}`;
        }
    },

    /**
     * Set up theme toggle button event listener
     * Initializes click handler and tooltip
     * 
     * @method setupToggleButton
     * @memberof ThemeManager
     */
    setupToggleButton() {
        const toggleButton = document.getElementById('theme-toggle');
        if (toggleButton) {
            toggleButton.addEventListener('click', () => {
                this.toggleTheme();
            });

            // Update initial tooltip
            this.updateToggleButton();
        }
    }
}; 