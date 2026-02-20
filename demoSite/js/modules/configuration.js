/**
 * Configuration Module
 * 
 * Manages configuration integration for the Kroki diagram editor.
 * Handles applying configuration values and setting up change listeners
 * for reactive configuration updates.
 * 
 * @author Vysakh Pillai
 */

import {
    state,
    updateDebounceDelay,
    updateAutoSaveDelay,
    updateAutoReloadDelay,
    updateAutoRefreshEnabled,
    updateZoomState
} from './state.js';
import { ThemeManager } from './theme.js';
import { startAutoSave, restartFileMonitoring } from './fileOperations.js';
import { adjustControlsLayout } from './utils.js';

/**
 * Initialize configuration system integration
 * Sets up configuration manager integration and applies initial settings
 * Coordinates between configuration UI and application state
 * 
 * @public
 */
export function initializeConfigurationSystem() {
    if (!window.configManager) {
        console.warn('Configuration manager not available');
        return;
    }

    // Apply initial configuration values
    applyConfiguration();

    // Set up configuration change listeners
    setupConfigurationListeners();
}

/**
 * Apply configuration values to application state
 * Updates debounce delays, zoom settings, theme, and UI preferences
 * Ensures application state matches current configuration
 * 
 * @public
 */
export function applyConfiguration() {
    const config = window.configManager;

    // Apply configuration-driven values
    updateDebounceDelay(config.get('editor.debounceDelay'));
    updateAutoSaveDelay(config.get('editor.autoSaveDelay'));
    updateAutoReloadDelay(config.get('editor.autoReloadDelay'));

    // Update zoom state with configuration values
    updateZoomState({
        minScale: config.get('zoom.minScale'),
        maxScale: config.get('zoom.maxScale'),
        scaleStep: config.get('zoom.scaleStep')
    });

    // Apply theme configuration
    const themeConfig = config.get('theme');
    if (themeConfig !== ThemeManager.currentTheme) {
        ThemeManager.applyTheme(themeConfig);
    }

    // Apply auto-refresh configuration
    const autoRefreshConfig = config.get('autoRefresh');
    if (autoRefreshConfig !== state.autoRefreshEnabled) {
        updateAutoRefreshEnabled(autoRefreshConfig);
        updateAutoRefreshUI(autoRefreshConfig);
    }

    // Apply editor font size via CodeMirror bridge
    const fontSize = config.get('editor.fontSize');
    if (window.editor) {
        window.editor.setFontSize(fontSize);
    }

    // Apply layout configuration
    const editorWidth = config.get('layout.editorWidth');
    const editor = document.querySelector('.editor');
    if (editor) {
        editor.style.width = `${editorWidth}%`;
    }

    // Apply UI element visibility
    applyUIVisibilityConfig();
}

/**
 * Apply UI element visibility configuration
 * Shows or hides toolbar, zoom controls, and file status based on settings
 * Provides customizable interface layout options
 * 
 * @public
 */
export function applyUIVisibilityConfig() {
    const config = window.configManager;

    // Show/hide toolbar
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) {
        toolbar.style.display = config.get('layout.showToolbar') ? 'flex' : 'none';
    }

    // Show/hide zoom controls
    const zoomControls = document.getElementById('zoom-controls');
    if (zoomControls) {
        zoomControls.style.display = config.get('layout.showZoomControls') ? 'flex' : 'none';
    }

    // Show/hide file status
    const fileStatus = document.querySelector('.file-status');
    if (fileStatus) {
        fileStatus.style.display = config.get('layout.showFileStatus') ? 'block' : 'none';
    }
}

/**
 * Update all auto-refresh UI elements
 * Centralizes synchronization of all auto-refresh controls
 * 
 * @param {boolean} enabled - Whether auto-refresh is enabled
 * @private
 */
function updateAutoRefreshUI(enabled) {
    // Update toolbar button state
    const autoRefreshBtn = document.getElementById('auto-refresh-btn');
    if (autoRefreshBtn) {
        autoRefreshBtn.classList.toggle('active', enabled);
        autoRefreshBtn.title = enabled ? 'Auto-refresh enabled' : 'Auto-refresh disabled';
    }
    
    // Update main page checkbox
    const autoRefreshCheckbox = document.getElementById('auto-refresh-checkbox');
    if (autoRefreshCheckbox) {
        autoRefreshCheckbox.checked = enabled;
    }
    
    // Update settings modal if it's open
    if (window.configUI) {
        window.configUI.updateConfigField('autoRefresh', enabled);
    }
}

/**
 * Set up configuration change listeners
 * Registers callbacks for configuration updates to apply changes in real-time
 * Handles theme, auto-refresh, zoom, editor, and layout configuration changes
 * 
 * @public
 */
export function setupConfigurationListeners() {
    const config = window.configManager;

    // Listen for theme changes
    config.addListener('theme', (newTheme) => {
        ThemeManager.applyTheme(newTheme);
    });

    // Listen for auto-refresh changes
    config.addListener('autoRefresh', (newValue) => {
        updateAutoRefreshEnabled(newValue);
        updateAutoRefreshUI(newValue);
    });

    // Listen for debounce delay changes
    config.addListener('editor.debounceDelay', (newValue) => {
        updateDebounceDelay(newValue);
    });

    // Listen for auto-save delay changes
    config.addListener('editor.autoSaveDelay', (newValue) => {
        updateAutoSaveDelay(newValue);
        // Restart auto-save timer if it's running
        if (state.currentFile.autoSaveEnabled) {
            startAutoSave();
        }
    });

    // Listen for auto-reload delay changes
    config.addListener('editor.autoReloadDelay', (newValue) => {
        updateAutoReloadDelay(newValue);
        // Restart file monitoring if it's active
        if (state.fileMonitoring.isWatching) {
            restartFileMonitoring();
        }
    });

    // Listen for zoom configuration changes
    config.addListener('zoom.minScale', (newValue) => {
        updateZoomState({ minScale: newValue });
        // If current zoom is now outside the new limits, reset
        if (state.zoomState.scale < newValue || state.zoomState.scale > state.zoomState.maxScale) {
            const zoomPanControls = window.diagramZoomPan;
            if (zoomPanControls) {
                zoomPanControls.resetZoom();
            }
        }
    });

    config.addListener('zoom.maxScale', (newValue) => {
        updateZoomState({ maxScale: newValue });
        // If current zoom is now outside the new limits, reset
        if (state.zoomState.scale < state.zoomState.minScale || state.zoomState.scale > newValue) {
            const zoomPanControls = window.diagramZoomPan;
            if (zoomPanControls) {
                zoomPanControls.resetZoom();
            }
        }
    });

    config.addListener('zoom.scaleStep', (newValue) => {
        updateZoomState({ scaleStep: newValue });
    });

    // Listen for zoom reset padding changes
    config.addListener('zoom.resetPadding', (newValue) => {
        // This will be used next time resetZoom is called
        // No immediate action needed since padding is read dynamically
    });

    // Listen for zoom preserve state changes
    config.addListener('zoom.preserveStateOnUpdate', (newValue) => {
        // This affects diagram update behavior
        // No immediate action needed since it's read when updating
    });

    // Listen for editor font size changes
    config.addListener('editor.fontSize', (newValue) => {
        if (window.editor) {
            window.editor.setFontSize(newValue);
        }
    });

    // Listen for layout changes
    config.addListener('layout.editorWidth', (newValue) => {
        const editor = document.querySelector('.editor');
        if (editor) {
            editor.style.width = `${newValue}%`;
            adjustControlsLayout();
        }
    });

    // Listen for UI visibility changes
    config.addListener('layout.showToolbar', () => applyUIVisibilityConfig());
    config.addListener('layout.showZoomControls', () => applyUIVisibilityConfig());
    config.addListener('layout.showFileStatus', () => applyUIVisibilityConfig());

    // Listen for Kroki API configuration changes
    config.addListener('kroki.alwaysUsePost', () => {
        // Configuration change will be applied on next diagram update
        // No immediate action needed since this affects diagram generation behavior
    });

    config.addListener('kroki.urlLengthThreshold', () => {
        // Configuration change will be applied on next diagram update
        // No immediate action needed since this affects diagram generation behavior
    });

    config.addListener('kroki.postRequestTimeout', () => {
        // Configuration change will be applied on next diagram update
        // No immediate action needed since this affects POST request timeout
    });

    // Listen for AI Assistant configuration changes
    const aiConfigPaths = [
        'ai.enabled', 'ai.endpoint', 'ai.apiKey', 'ai.model', 'ai.customModel',
        'ai.maxRetryAttempts', 'ai.autoValidate', 'ai.useCustomAPI', 'ai.userPromptTemplate', 'ai.timeout'
    ];

    aiConfigPaths.forEach(path => {
        config.addListener(path, () => {
            if (window.aiAssistant) {
                window.aiAssistant.applyConfiguration();
            }
        });
    });
}