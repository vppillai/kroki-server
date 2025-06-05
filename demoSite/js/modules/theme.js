/**
 * Theme Module
 * 
 * Manages visual appearance themes for the diagram editor.
 * Supports light, dark, and auto (system) themes with persistent preferences.
 */

/**
 * Theme management system for visual appearance control
 * Handles light, dark, and auto themes with persistent user preferences
 * Provides theme switching functionality and UI updates
 * 
 * @constant
 * @public
 */
export const ThemeManager = {
    themes: ['light', 'dark', 'auto'],
    currentTheme: 'light', // Default to light mode

    init() {
        // Load saved theme or default to light
        this.currentTheme = localStorage.getItem('kroki-theme') || 'light';
        this.applyTheme(this.currentTheme);
        this.setupToggleButton();
    },

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
        localStorage.setItem('kroki-theme', theme);
    },

    getNextTheme() {
        const currentIndex = this.themes.indexOf(this.currentTheme);
        return this.themes[(currentIndex + 1) % this.themes.length];
    },

    toggleTheme() {
        const nextTheme = this.getNextTheme();
        this.applyTheme(nextTheme);
    },

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