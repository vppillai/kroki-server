/**
 * User Configuration System for Kroki Diagram Editor
 * Provides persistent storage and management of user preferences
 */

// Default configuration values
const DEFAULT_CONFIG = {
    // Theme and UI preferences
    theme: 'light', // 'light', 'dark', 'auto'
    autoRefresh: true,
    
    // Editor behavior
    editor: {
        tabSize: 4,
        autoSave: false,
        autoSaveDelay: 2000, // milliseconds
        debounceDelay: 1000, // milliseconds for diagram updates
        showLineNumbers: true,
        wordWrap: false,
        fontSize: 14
    },
    
    // Zoom and pan settings
    zoom: {
        minScale: 0.1,
        maxScale: 5.0,
        scaleStep: 0.1,
        resetPadding: 40, // padding when fitting to screen
        preserveStateOnUpdate: true
    },
    
    // Layout preferences
    layout: {
        editorWidth: 33, // percentage of total width
        showToolbar: true,
        showZoomControls: true,
        showFileStatus: true,
        fullscreenExitOnEscape: true
    },
    
    // File operations
    file: {
        defaultDiagramType: 'plantuml',
        defaultOutputFormat: 'svg',
        autoDetectDiagramType: true,
        warnOnUnsavedChanges: true
    },
    
    // Notifications and feedback
    ui: {
        showNotifications: true,
        notificationDuration: 3000, // milliseconds
        animationDuration: 300, // milliseconds for UI animations
        showTooltips: true,
        enableKeyboardShortcuts: true
    },
    
    // Performance settings
    performance: {
        enableDiagramCaching: true,
        maxCacheSize: 50, // number of cached diagrams
        imagePreloadTimeout: 10000 // milliseconds
    },
    
    // AI Assistant settings
    ai: {
        endpoint: '', // Custom API endpoint (optional)
        apiKey: '', // Custom API key (optional)
        model: 'gpt-4o', // AI model to use
        maxRetryAttempts: 3, // Maximum retry attempts for failed requests
        promptTheme: `You are an expert diagram assistant for the Kroki diagram server. 

Current diagram type: {{diagramType}}
Current diagram code:
\`\`\`
{{currentCode}}
\`\`\`

User request: {{userPrompt}}

Please help the user by:
1. If they want to create a new diagram, generate appropriate {{diagramType}} code
2. If they want to modify existing code, provide the updated version
3. If they want to fix errors, provide corrected code
4. Always ensure the code follows proper {{diagramType}} syntax

Provide your response with the diagram code in a code block, and include brief explanations if helpful.`
    }
};

/**
 * Configuration Manager Class
 */
class ConfigManager {
    constructor() {
        this.config = { ...DEFAULT_CONFIG };
        this.listeners = new Map();
        this.storageKey = 'kroki-user-config';
        this.load();
    }

    /**
     * Load configuration from localStorage
     */
    load() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const parsedConfig = JSON.parse(stored);
                this.config = this.mergeConfig(DEFAULT_CONFIG, parsedConfig);
            }
        } catch (error) {
            console.warn('Failed to load user configuration:', error);
            this.config = { ...DEFAULT_CONFIG };
        }
        
        // Migrate old settings
        this.migrateOldSettings();
    }

    /**
     * Save configuration to localStorage
     */
    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.config));
        } catch (error) {
            console.error('Failed to save user configuration:', error);
        }
    }

    /**
     * Migrate old localStorage settings to new config system
     */
    migrateOldSettings() {
        let hasChanges = false;

        // Migrate theme setting
        const oldTheme = localStorage.getItem('kroki-theme');
        if (oldTheme && oldTheme !== this.config.theme) {
            this.config.theme = oldTheme;
            hasChanges = true;
        }

        // Migrate auto-refresh setting
        const oldAutoRefresh = localStorage.getItem('kroki-auto-refresh');
        if (oldAutoRefresh !== null) {
            const autoRefreshValue = oldAutoRefresh === 'true';
            if (autoRefreshValue !== this.config.autoRefresh) {
                this.config.autoRefresh = autoRefreshValue;
                hasChanges = true;
            }
        }

        if (hasChanges) {
            this.save();
        }
    }

    /**
     * Deep merge configuration objects
     */
    mergeConfig(defaultConfig, userConfig) {
        const result = { ...defaultConfig };
        
        for (const [key, value] of Object.entries(userConfig)) {
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                result[key] = this.mergeConfig(defaultConfig[key] || {}, value);
            } else {
                result[key] = value;
            }
        }
        
        return result;
    }

    /**
     * Get a configuration value by path (e.g., 'editor.tabSize')
     */
    get(path) {
        const keys = path.split('.');
        let current = this.config;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                // Fallback to default value
                const defaultKeys = path.split('.');
                let defaultCurrent = DEFAULT_CONFIG;
                for (const defaultKey of defaultKeys) {
                    if (defaultCurrent && typeof defaultCurrent === 'object' && defaultKey in defaultCurrent) {
                        defaultCurrent = defaultCurrent[defaultKey];
                    } else {
                        return undefined;
                    }
                }
                return defaultCurrent;
            }
        }
        
        return current;
    }

    /**
     * Set a configuration value by path (e.g., 'editor.tabSize', 4)
     */
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = this.config;
        
        // Navigate to the parent object
        for (const key of keys) {
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        // Set the value
        const oldValue = current[lastKey];
        current[lastKey] = value;
        
        // Save changes
        this.save();
        
        // Notify listeners
        this.notifyListeners(path, value, oldValue);
    }

    /**
     * Get multiple configuration values
     */
    getAll(paths) {
        const result = {};
        for (const path of paths) {
            result[path] = this.get(path);
        }
        return result;
    }

    /**
     * Set multiple configuration values
     */
    setAll(configs) {
        for (const [path, value] of Object.entries(configs)) {
            this.set(path, value);
        }
    }

    /**
     * Reset configuration to defaults
     */
    reset() {
        this.config = { ...DEFAULT_CONFIG };
        this.save();
        
        // Clear old localStorage entries
        localStorage.removeItem('kroki-theme');
        localStorage.removeItem('kroki-auto-refresh');
        
        // Notify all listeners
        for (const [path] of this.listeners) {
            this.notifyListeners(path, this.get(path), undefined);
        }
    }

    /**
     * Export configuration as JSON
     */
    export() {
        return JSON.stringify(this.config, null, 2);
    }

    /**
     * Import configuration from JSON
     */
    import(jsonString) {
        try {
            const importedConfig = JSON.parse(jsonString);
            this.config = this.mergeConfig(DEFAULT_CONFIG, importedConfig);
            this.save();
            
            // Notify all listeners
            for (const [path] of this.listeners) {
                this.notifyListeners(path, this.get(path), undefined);
            }
            
            return true;
        } catch (error) {
            console.error('Failed to import configuration:', error);
            return false;
        }
    }

    /**
     * Add a listener for configuration changes
     */
    addListener(path, callback) {
        if (!this.listeners.has(path)) {
            this.listeners.set(path, new Set());
        }
        this.listeners.get(path).add(callback);
        
        // Return unsubscribe function
        return () => {
            const pathListeners = this.listeners.get(path);
            if (pathListeners) {
                pathListeners.delete(callback);
                if (pathListeners.size === 0) {
                    this.listeners.delete(path);
                }
            }
        };
    }

    /**
     * Notify listeners of configuration changes
     */
    notifyListeners(path, newValue, oldValue) {
        const pathListeners = this.listeners.get(path);
        if (pathListeners) {
            for (const callback of pathListeners) {
                try {
                    callback(newValue, oldValue, path);
                } catch (error) {
                    console.error('Error in config listener:', error);
                }
            }
        }
    }

    /**
     * Get configuration schema for UI generation
     */
    getSchema() {
        return {
            theme: {
                type: 'select',
                label: 'Theme',
                options: [
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                    { value: 'auto', label: 'Auto (System)' }
                ],
                description: 'Choose the color theme for the editor'
            },
            autoRefresh: {
                type: 'boolean',
                label: 'Auto-refresh Diagrams',
                description: 'Automatically update diagrams as you type'
            },
            'editor.tabSize': {
                type: 'number',
                label: 'Tab Size',
                min: 1,
                max: 8,
                description: 'Number of spaces for tab indentation'
            },
            'editor.autoSave': {
                type: 'boolean',
                label: 'Auto-save Files',
                description: 'Automatically save file changes'
            },
            'editor.autoSaveDelay': {
                type: 'number',
                label: 'Auto-save Delay (ms)',
                min: 500,
                max: 10000,
                step: 500,
                description: 'Time to wait before auto-saving changes'
            },
            'editor.debounceDelay': {
                type: 'number',
                label: 'Diagram Update Delay (ms)',
                min: 100,
                max: 5000,
                step: 100,
                description: 'Time to wait before updating diagram while typing'
            },
            'editor.fontSize': {
                type: 'number',
                label: 'Editor Font Size',
                min: 10,
                max: 24,
                description: 'Font size for the code editor'
            },
            'zoom.minScale': {
                type: 'number',
                label: 'Minimum Zoom',
                min: 0.05,
                max: 1.0,
                step: 0.05,
                description: 'Minimum zoom level for diagrams'
            },
            'zoom.maxScale': {
                type: 'number',
                label: 'Maximum Zoom',
                min: 2.0,
                max: 10.0,
                step: 0.5,
                description: 'Maximum zoom level for diagrams'
            },
            'zoom.scaleStep': {
                type: 'number',
                label: 'Zoom Step',
                min: 0.05,
                max: 0.5,
                step: 0.05,
                description: 'Amount to zoom in/out per step'
            },
            'layout.editorWidth': {
                type: 'number',
                label: 'Editor Width (%)',
                min: 20,
                max: 80,
                description: 'Width of the editor panel as percentage'
            },
            'file.defaultDiagramType': {
                type: 'select',
                label: 'Default Diagram Type',
                options: [
                    { value: 'plantuml', label: 'PlantUML' },
                    { value: 'mermaid', label: 'Mermaid' },
                    { value: 'graphviz', label: 'Graphviz' },
                    { value: 'ditaa', label: 'Ditaa' }
                ],
                description: 'Default diagram type for new files'
            },
            'ui.notificationDuration': {
                type: 'number',
                label: 'Notification Duration (ms)',
                min: 1000,
                max: 10000,
                step: 500,
                description: 'How long to show notifications'
            },
            'ai.endpoint': {
                type: 'text',
                label: 'AI API Endpoint',
                description: 'Custom AI API endpoint (optional, leave empty to use proxy backend)'
            },
            'ai.apiKey': {
                type: 'password',
                label: 'API Key',
                description: 'API key for custom endpoint (optional)'
            },
            'ai.model': {
                type: 'select',
                label: 'AI Model',
                options: [
                    { value: 'gpt-4o', label: 'GPT-4o' },
                    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
                    { value: 'gpt-4', label: 'GPT-4' },
                    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
                    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
                    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' }
                ],
                description: 'AI model to use for diagram generation'
            },
            'ai.maxRetryAttempts': {
                type: 'number',
                label: 'Maximum Retry Attempts',
                min: 1,
                max: 10,
                description: 'Maximum retry attempts for failed AI requests'
            },
            'ai.promptTheme': {
                type: 'textarea',
                label: 'Prompt Theme',
                rows: 8,
                description: 'Template for AI prompts. Use {{diagramType}}, {{currentCode}}, and {{userPrompt}} as placeholders.'
            }
        };
    }
}

// Create global configuration manager instance
window.configManager = new ConfigManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ConfigManager, DEFAULT_CONFIG };
}
