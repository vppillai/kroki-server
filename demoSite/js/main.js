/**
 * Main Application Controller for Kroki Diagram Editor
 * 
 * Central orchestration module for the Kroki diagram editor application.
 * This file now serves as the entry point that imports and coordinates
 * all the modular components of the application.
 * 
 * @author Vysakh Pillai
 * @version 2.0.0
 */

// ========================================
// MODULE IMPORTS
// ========================================

// Core constants and configuration
import {
    defaultExample,
    formatCompatibility,
    formatDisplayTypes,
    DEBOUNCE_DELAY,
    AUTO_SAVE_DELAY
} from './modules/constants.js';

// State management
import {
    state,
    updateUserHasEditedContent,
    updateCurrentDiagramData,
    updateCurrentDiagramType,
    updateCurrentOutputFormat,
    updateCurrentDiagramUrl,
    updateDiagramUpdateTimer,
    updateAutoRefreshEnabled,
    updateZoomState,
    updateCurrentFile,
    updateAutoSaveTimer,
    updateSearchState,
    getExampleCache,
    setExampleCache
} from './modules/state.js';

// File operations
import {
    updateFileStatus,
    markFileAsModified,
    markFileAsSaved,
    isFileSystemAccessSupported,
    openFile,
    handleFileInputChange,
    detectDiagramType,
    saveFile,
    saveAsFile,
    getDefaultFileName,
    downloadAsFile,
    showSuccessMessage,
    showErrorMessage,
    newFile,
    handleFileShortcuts,
    initializeFileOperations,
    toggleAutoSave,
    startAutoSave,
    stopAutoSave,
    toggleAutoReload,
    startFileMonitoring,
    stopFileMonitoring,
    showImageErrorBanner,
    hideImageErrorBanner
} from './modules/fileOperations.js';

// Utility functions
import {
    textEncode,
    uint8ArrayToString,
    initializeResizeHandle,
    adjustControlsLayout,
    escapeHtml
} from './modules/utils.js';

// CodeMirror 6 editor bridge
import { initializeEditor } from './modules/editorBridge.js';

// URL handling and parameters
import {
    getUrlParameters,
    processUrlParameters,
    loadDefaultExample,
    updateUrl,
    clearUrlParameters
} from './modules/urlHandler.js';

// Diagram operations
import {
    debounceUpdateDiagram,
    updateFormatDropdown,
    loadExampleForDiagramType,
    encodeKrokiDiagram,
    decodeKrokiDiagram,
    updateImageLink,
    updateDiagram,
    downloadDiagram,
    handleDecode,
    shouldUsePostForCurrentDiagram,
    initializeDiagramTypeDropdown
} from './modules/diagramOperations.js';

// UI features
import { initializeZoomPan } from './modules/zoomPan.js';
import DrawioIntegration from './modules/drawioIntegration.js';
import {
    showSearchBar,
    hideSearchBar
} from './modules/search.js';
import { initializeFullscreenMode } from './modules/fullscreen.js';
import { ThemeManager } from './modules/theme.js';

// Configuration system
import {
    initializeConfigurationSystem,
    applyConfiguration,
    applyUIVisibilityConfig,
    setupConfigurationListeners
} from './modules/configuration.js';

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
        if (DrawioIntegration.shouldShowDrawioButton()) {
            drawioEditBtn.style.display = 'inline-flex';
        } else {
            drawioEditBtn.style.display = 'none';
        }
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
        // Set initial state
        autoRefreshBtn.classList.toggle('active', state.autoRefreshEnabled);
        autoRefreshBtn.title = state.autoRefreshEnabled ? 'Auto-refresh enabled' : 'Auto-refresh disabled';

        // Add click handler
        autoRefreshBtn.addEventListener('click', handleAutoRefreshToggle);
    }

    if (autoRefreshCheckbox) {
        // Set initial state
        autoRefreshCheckbox.checked = state.autoRefreshEnabled;

        // Add change handler
        autoRefreshCheckbox.addEventListener('change', function() {
            const newValue = this.checked;
            updateAutoRefreshEnabled(newValue);
            
            // Update configuration
            if (window.configManager) {
                window.configManager.set('autoRefresh', newValue);
            }
        });
    }

    if (manualRefreshBtn) {
        // Add click handler
        manualRefreshBtn.addEventListener('click', handleManualRefresh);
        manualRefreshBtn.title = 'Refresh diagram (Ctrl+Enter)';
    }

    // Add keyboard shortcut for manual refresh
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleManualRefresh();
        }
    });
}

// ========================================
// EVENT HANDLING AND INITIALIZATION
// ========================================

/**
 * Main DOMContentLoaded event handler - initializes all application systems
 * @private
 */
document.addEventListener('DOMContentLoaded', function () {
    // First initialize dropdown components to ensure proper state
    initializeDiagramTypeDropdown();
    updateFormatDropdown();
    
    // Then process URL parameters to set up initial state
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
    } else {
        console.error('Settings button not found in DOM');
    }

    // Setup Draw.io edit button
    const drawioEditBtn = document.getElementById('drawio-edit-btn');
    if (drawioEditBtn) {
        drawioEditBtn.addEventListener('click', () => {
            window.drawioIntegration.openModal();
        });
    } else {
        console.error('Draw.io edit button not found in DOM');
    }

    // Initialize configuration system
    setTimeout(() => {
        // Initialize ConfigUI manually
        if (window.configManager && typeof ConfigUI !== 'undefined') {
            try {
                window.configUI = new ConfigUI(window.configManager);
            } catch (error) {
                console.error('Error creating ConfigUI:', error);
            }
        } else {
            console.warn('ConfigManager or ConfigUI class not available');
        }

        // Initialize AI Assistant
        if (typeof AIAssistant !== 'undefined') {
            try {
                window.aiAssistant = new AIAssistant(window.configManager);
            } catch (error) {
                console.error('Error creating AI Assistant:', error);
            }
        } else {
            console.warn('AIAssistant class not available');
        }

        // Initialize Code History
        if (typeof CodeHistory !== 'undefined') {
            try {
                window.codeHistory = new CodeHistory();
                // Initialize with current code if available
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
    }, 150); // Slightly longer delay to ensure all scripts are loaded

    // Finally, update the diagram after all initialization is complete
    setTimeout(() => {
        // Only auto-update if auto-refresh is enabled
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

/**
 * Before unload event handler - warns about unsaved changes
 * @private
 */
window.addEventListener('beforeunload', function (e) {
    if (state.currentFile.isOpen && !state.currentFile.saved) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return 'You have unsaved changes. Are you sure you want to leave?';
    }
});

const codeTextarea = document.getElementById('code');

/**
 * Code textarea input event handler - handles content changes and updates
 * (CM6's update listener dispatches synthetic input events on the hidden textarea)
 * @private
 */
codeTextarea.addEventListener('input', function () {
    const code = this.value.trim();

    if (code !== '') {
        updateUserHasEditedContent(true);
    }

    // Check if file content has changed for file operations
    if (state.currentFile.isOpen && state.currentFile.saved && this.value !== state.currentFile.content) {
        markFileAsModified();
    }

    debounceUpdateDiagram();
    
    // Handle URL updates based on request method
    const shouldUpdateUrl = !shouldUsePostForCurrentDiagram();
    if (shouldUpdateUrl) {
        updateUrl();
    } else {
        clearUrlParameters();
    }
});

/**
 * Diagram type dropdown change handler - updates format options and loads examples
 * @private
 */
document.getElementById('diagramType').addEventListener('change', async function () {
    const diagramType = this.value;
    const currentCode = codeTextarea.value;

    updateFormatDropdown();
    
    // Update Draw.io button visibility
    updateDrawioButtonVisibility();
    
    // Handle URL updates based on request method
    const shouldUpdateUrl = !shouldUsePostForCurrentDiagram();
    if (shouldUpdateUrl) {
        updateUrl();
    } else {
        clearUrlParameters();
    }

    if (window.editor) {
        window.editor.setLanguage(diagramType);
    }

    const isCodeEmpty = currentCode.trim() === '';
    const exampleCache = getExampleCache();
    const isCurrentCodeAnExample = Object.values(exampleCache).includes(currentCode);

    if (!state.userHasEditedContent || isCurrentCodeAnExample || isCodeEmpty) {
        const example = await loadExampleForDiagramType(diagramType);
        codeTextarea.value = example;
        debounceUpdateDiagram();
    } else {
        debounceUpdateDiagram();
    }
});

/**
 * Output format dropdown change handler - updates diagram when format changes
 * @private
 */
document.getElementById('outputFormat').addEventListener('change', function () {
    debounceUpdateDiagram();
});

/**
 * Download button click handler - triggers diagram download
 * @private
 */
document.getElementById('downloadButton').addEventListener('click', downloadDiagram);

/**
 * Copy link button click handler - copies image link to clipboard
 * @private
 */
const copyLinkBtn = document.getElementById('copy-link-btn');
if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', function () {
        const imageLinkText = document.getElementById('image-link-text');
        if (imageLinkText) {
            imageLinkText.select();
            document.execCommand('copy');

            const originalText = this.textContent;
            this.textContent = 'Copied!';
            setTimeout(() => {
                this.textContent = originalText;
            }, 1500);
        }
    });
}

/**
 * Decode button click handler - handles diagram decoding functionality
 * @private
 */
const decodeBtn = document.getElementById('decode-btn');
if (decodeBtn) {
    decodeBtn.addEventListener('click', handleDecode);
}

/**
 * Encoded text input keypress handler - triggers decode on Enter key
 * @private
 */
const encodedTextInput = document.getElementById('encoded-text');
if (encodedTextInput) {
    encodedTextInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            handleDecode();
        }
    });
}

/**
 * Help modal event handlers - manages zoom help modal display and interaction
 * @private
 */
const helpBtn = document.getElementById('zoom-help');
const helpModal = document.getElementById('help-modal');
const closeHelpBtn = document.getElementById('close-help');

if (helpBtn && helpModal && closeHelpBtn) {
    helpBtn.addEventListener('click', function () {
        helpModal.style.display = 'flex';
    });

    closeHelpBtn.addEventListener('click', function () {
        helpModal.style.display = 'none';
    });

    // Close modal when clicking outside
    helpModal.addEventListener('click', function (e) {
        if (e.target === helpModal) {
            helpModal.style.display = 'none';
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && helpModal.style.display === 'flex') {
            helpModal.style.display = 'none';
        }
    });

    // Open help modal with '?' key (when not typing in an input/textarea)
    document.addEventListener('keydown', function (e) {
        if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
            const tag = document.activeElement?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) {
                return;
            }
            helpModal.style.display = 'flex';
        }
    });

    // Toggle AI Assistant with Ctrl/Cmd + K
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (window.aiAssistant) {
                window.aiAssistant.toggleChat();
            }
        }
    });
}

// Export functions that need to be globally accessible
window.showSearchBar = function () {
    if (window.editor) {
        window.editor.openSearch();
    }
};

