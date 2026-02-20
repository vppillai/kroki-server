/**
 * Main Application Controller for Kroki Diagram Editor
 *
 * Thin orchestration module that imports and coordinates all modular
 * components of the application. Event bindings are delegated to
 * the eventBindings module.
 *
 * @author Vysakh Pillai
 * @version 2.0.0
 */

// ========================================
// MODULE IMPORTS
// ========================================

// State management
import {
    state,
    updateAutoRefreshEnabled
} from './modules/state.js';

// File operations
import { initializeFileOperations } from './modules/fileOperations.js';

// Utility functions
import { initializeResizeHandle, adjustControlsLayout } from './modules/utils.js';

// CodeMirror 6 editor bridge
import { initializeEditor } from './modules/editorBridge.js';

// URL handling and parameters
import { processUrlParameters } from './modules/urlHandler.js';

// Diagram operations
import {
    updateFormatDropdown,
    updateDiagram,
    initializeDiagramTypeDropdown
} from './modules/diagramOperations.js';

// UI features
import { initializeZoomPan } from './modules/zoomPan.js';
import DrawioIntegration from './modules/drawioIntegration.js';
import { initializeFullscreenMode } from './modules/fullscreen.js';
import { ThemeManager } from './modules/theme.js';

// Configuration system
import { initializeConfigurationSystem } from './modules/configuration.js';

// DOM utilities
import { toggle } from './modules/dom.js';

// Event bindings
import { bindEvents } from './modules/eventBindings.js';

// ========================================
// AUTO-REFRESH FUNCTIONALITY
// ========================================

/**
 * Handle auto-refresh toggle button click
 * @private
 */
function handleAutoRefreshToggle() {
    const autoRefreshBtn = document.getElementById('auto-refresh-btn');
    const autoRefreshEnabled = state.autoRefreshEnabled;

    updateAutoRefreshEnabled(!autoRefreshEnabled);

    // Update configuration to keep settings in sync
    if (window.configManager) {
        window.configManager.set('autoRefresh', !autoRefreshEnabled);
    }

    if (autoRefreshBtn) {
        autoRefreshBtn.classList.toggle('active', state.autoRefreshEnabled);
        autoRefreshBtn.title = state.autoRefreshEnabled ? 'Auto-refresh enabled' : 'Auto-refresh disabled';
    }

    // If enabling auto-refresh, update the diagram immediately
    if (state.autoRefreshEnabled) {
        updateDiagram();
    }
}

/**
 * Handle manual refresh button click
 * @private
 */
function handleManualRefresh() {
    const manualRefreshBtn = document.getElementById('manual-refresh-btn');

    // Add visual feedback
    if (manualRefreshBtn) {
        manualRefreshBtn.classList.add('refreshing');
        setTimeout(() => {
            manualRefreshBtn.classList.remove('refreshing');
        }, 300);
    }

    // Force update the diagram
    updateDiagram();
}

/**
 * Update Draw.io button visibility based on current diagram type
 * @private
 */
function updateDrawioButtonVisibility() {
    const drawioEditBtn = document.getElementById('drawio-edit-btn');
    if (drawioEditBtn) {
        toggle(drawioEditBtn, DrawioIntegration.shouldShowDrawioButton());
    }
}

/**
 * Initialize auto-refresh functionality
 * @private
 */
function initializeAutoRefresh() {
    const autoRefreshBtn = document.getElementById('auto-refresh-btn');
    const autoRefreshCheckbox = document.getElementById('auto-refresh-checkbox');
    const manualRefreshBtn = document.getElementById('manual-refresh-btn');

    if (autoRefreshBtn) {
        autoRefreshBtn.classList.toggle('active', state.autoRefreshEnabled);
        autoRefreshBtn.title = state.autoRefreshEnabled ? 'Auto-refresh enabled' : 'Auto-refresh disabled';
        autoRefreshBtn.addEventListener('click', handleAutoRefreshToggle);
    }

    if (autoRefreshCheckbox) {
        autoRefreshCheckbox.checked = state.autoRefreshEnabled;
        autoRefreshCheckbox.addEventListener('change', function() {
            const newValue = this.checked;
            updateAutoRefreshEnabled(newValue);
            if (window.configManager) {
                window.configManager.set('autoRefresh', newValue);
            }
        });
    }

    if (manualRefreshBtn) {
        manualRefreshBtn.addEventListener('click', handleManualRefresh);
        manualRefreshBtn.title = 'Refresh diagram (Ctrl+Enter)';
    }

    // Keyboard shortcut for manual refresh
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleManualRefresh();
        }
    });
}

// ========================================
// INITIALIZATION
// ========================================

/**
 * Main DOMContentLoaded event handler - initializes all application systems
 * @private
 */
document.addEventListener('DOMContentLoaded', function () {
    // Initialize dropdown components
    initializeDiagramTypeDropdown();
    updateFormatDropdown();

    // Process URL parameters to set up initial state
    processUrlParameters();

    // Update Draw.io button visibility after URL processing
    updateDrawioButtonVisibility();

    // Initialize CodeMirror 6 editor
    initializeEditor();

    // Set initial syntax highlighting based on selected diagram type
    const initialDiagramType = document.getElementById('diagramType').value;
    if (window.editor && initialDiagramType) {
        window.editor.setLanguage(initialDiagramType);
    }

    // Initialize UI components
    initializeResizeHandle();
    adjustControlsLayout();

    // Initialize zoom and pan functionality
    window.diagramZoomPan = initializeZoomPan();

    // Initialize fullscreen mode functionality
    window.fullscreenMode = initializeFullscreenMode();

    // Initialize file operations
    initializeFileOperations();

    // Initialize theme system
    ThemeManager.init();

    // Initialize diagram invert toggle button
    const diagramInvertToggle = document.getElementById('diagram-invert-toggle');
    if (diagramInvertToggle) {
        diagramInvertToggle.addEventListener('click', () => {
            ThemeManager.toggleDiagramInversion();
        });
    }

    // Initialize auto-refresh functionality
    initializeAutoRefresh();

    // Initialize Draw.io integration
    window.drawioIntegration = new DrawioIntegration();

    // Initialize settings button
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            if (window.configUI) {
                window.configUI.open();
            } else {
                console.warn('Configuration UI not available yet');
                alert('Settings system is loading... Please try again in a moment.');
            }
        });
    }

    // Setup Draw.io edit button
    const drawioEditBtn = document.getElementById('drawio-edit-btn');
    if (drawioEditBtn) {
        drawioEditBtn.addEventListener('click', () => {
            window.drawioIntegration.openModal();
        });
    }

    // Bind all event listeners (textarea, dropdowns, toolbar, keyboard, etc.)
    bindEvents({ updateDrawioButtonVisibility });

    // Initialize configuration system (delayed to ensure all scripts are loaded)
    setTimeout(() => {
        if (window.configManager && typeof ConfigUI !== 'undefined') {
            try {
                window.configUI = new ConfigUI(window.configManager);
            } catch (error) {
                console.error('Error creating ConfigUI:', error);
            }
        } else {
            console.warn('ConfigManager or ConfigUI class not available');
        }

        if (typeof AIAssistant !== 'undefined') {
            try {
                window.aiAssistant = new AIAssistant(window.configManager);
            } catch (error) {
                console.error('Error creating AI Assistant:', error);
            }
        } else {
            console.warn('AIAssistant class not available');
        }

        if (typeof CodeHistory !== 'undefined') {
            try {
                window.codeHistory = new CodeHistory();
                setTimeout(() => {
                    window.codeHistory.initializeWithCurrentCode();
                }, 100);
            } catch (error) {
                console.error('Error creating Code History:', error);
            }
        } else {
            console.warn('CodeHistory class not available');
        }

        initializeConfigurationSystem();

        // Fetch server config to sync editor max text size with Kroki backend limit
        fetch('/api/config')
            .then(r => r.json())
            .then(config => {
                if (config.kroki && config.kroki.maxBodySize && window.configManager) {
                    window.configManager.set('editor.maxTextSize', config.kroki.maxBodySize);
                }
            })
            .catch(() => { /* server config unavailable, use default */ });
    }, 150);

    // Update diagram after all initialization is complete
    setTimeout(() => {
        if (state.autoRefreshEnabled) {
            updateDiagram();
        }
    }, 200);
});

/**
 * Window resize event handler - adjusts layout when viewport changes
 * @private
 */
window.addEventListener('resize', function () {
    adjustControlsLayout();
});
