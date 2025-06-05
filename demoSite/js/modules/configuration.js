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
    updateAutoRefreshEnabled,
    updateZoomState
} from './state.js';
import { ThemeManager } from './theme.js';
import { startAutoSave } from './fileOperations.js';
import { updateLineNumbers, adjustControlsLayout } from './utils.js';

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
        const checkbox = document.getElementById('auto-refresh-checkbox');
        if (checkbox) {
            checkbox.checked = autoRefreshConfig;
            handleAutoRefreshToggle();
        }
    }

    // Apply editor configuration
    const codeTextarea = document.getElementById('code');
    if (codeTextarea) {
        const fontSize = config.get('editor.fontSize');
        codeTextarea.style.fontSize = `${fontSize}px`;
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
 * Handle auto-refresh checkbox toggle
 * Updates auto-refresh state, saves preference, and adjusts UI visibility
 * Controls whether diagrams update automatically or require manual refresh
 * 
 * @public
 */
export function handleAutoRefreshToggle() {
    const checkbox = document.getElementById('auto-refresh-checkbox');
    const refreshBtn = document.getElementById('manual-refresh-btn');

    if (!checkbox || !refreshBtn) return;

    const enabled = checkbox.checked;
    updateAutoRefreshEnabled(enabled);
    localStorage.setItem('kroki-auto-refresh', enabled.toString());

    // Show/hide manual refresh button based on auto-refresh state
    refreshBtn.style.display = enabled ? 'none' : 'inline-flex';
}

/**
 * Handle manual refresh button click
 * Triggers diagram update with visual feedback animation
 * Provides manual control when auto-refresh is disabled
 * 
 * @public
 */
export function handleManualRefresh() {
    const refreshBtn = document.getElementById('manual-refresh-btn');
    if (refreshBtn) {
        // Add spinning animation
        refreshBtn.classList.add('spinning');

        // Remove animation after a short delay
        setTimeout(() => {
            refreshBtn.classList.remove('spinning');
        }, 1000);
    }

    // Trigger diagram update
    import('./diagramOperations.js').then(module => {
        module.updateDiagram();
    });
}

/**
 * Initialize auto-refresh functionality and preferences
 * Sets up auto-refresh toggle, manual refresh button, and keyboard shortcuts
 * Loads saved user preferences and configures initial UI state
 * 
 * @public
 */
export function initializeAutoRefresh() {
    const checkbox = document.getElementById('auto-refresh-checkbox');
    const refreshBtn = document.getElementById('manual-refresh-btn');

    if (!checkbox || !refreshBtn) {
        console.warn('Auto-refresh elements not found');
        return;
    }

    // Load saved preference or default to true
    const savedPreference = localStorage.getItem('kroki-auto-refresh');
    const enabled = savedPreference !== null ? savedPreference === 'true' : true;
    updateAutoRefreshEnabled(enabled);
    checkbox.checked = enabled;

    // Set initial button state
    handleAutoRefreshToggle();

    // Add event listeners
    checkbox.addEventListener('change', handleAutoRefreshToggle);
    refreshBtn.addEventListener('click', handleManualRefresh);

    // Add keyboard shortcut for manual refresh (Alt/Cmd + Enter)
    document.addEventListener('keydown', function (e) {
        if ((e.altKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleManualRefresh();
        }
    });
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
        const checkbox = document.getElementById('auto-refresh-checkbox');
        if (checkbox) {
            checkbox.checked = newValue;
            handleAutoRefreshToggle();
        }
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
        const codeTextarea = document.getElementById('code');
        if (codeTextarea) {
            codeTextarea.style.fontSize = `${newValue}px`;
        }
    });

    // Listen for layout changes
    config.addListener('layout.editorWidth', (newValue) => {
        const editor = document.querySelector('.editor');
        if (editor) {
            editor.style.width = `${newValue}%`;
            // Trigger resize event to update line numbers
            updateLineNumbers();
            adjustControlsLayout();
        }
    });

    // Listen for UI visibility changes
    config.addListener('layout.showToolbar', () => applyUIVisibilityConfig());
    config.addListener('layout.showZoomControls', () => applyUIVisibilityConfig());
    config.addListener('layout.showFileStatus', () => applyUIVisibilityConfig());

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