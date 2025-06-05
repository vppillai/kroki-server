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
    showImageErrorBanner,
    hideImageErrorBanner
} from './modules/fileOperations.js';

// Utility functions
import {
    updateLineNumbers,
    initializeLineNumbers,
    textEncode,
    uint8ArrayToString,
    initializeResizeHandle,
    adjustControlsLayout,
    escapeHtml
} from './modules/utils.js';

// URL handling and parameters
import {
    getUrlParameters,
    processUrlParameters,
    loadDefaultExample,
    updateUrl
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
    initializeDiagramTypeDropdown
} from './modules/diagramOperations.js';

// UI features
import { initializeZoomPan } from './modules/zoomPan.js';
import {
    showSearchBar,
    hideSearchBar,
    performSearch,
    clearSearchHighlights,
    highlightSearchResults,
    scrollToCurrentMatch,
    goToNextMatch,
    goToPreviousMatch,
    toggleCaseSensitive,
    initializeSearchFunctionality
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
 * Initialize auto-refresh functionality
 * @private
 */
function initializeAutoRefresh() {
    const autoRefreshBtn = document.getElementById('auto-refresh-btn');
    const manualRefreshBtn = document.getElementById('manual-refresh-btn');

    if (autoRefreshBtn) {
        // Set initial state
        autoRefreshBtn.classList.toggle('active', state.autoRefreshEnabled);
        autoRefreshBtn.title = state.autoRefreshEnabled ? 'Auto-refresh enabled' : 'Auto-refresh disabled';

        // Add click handler
        autoRefreshBtn.addEventListener('click', handleAutoRefreshToggle);
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
    // First process URL parameters to set up initial state
    processUrlParameters();

    // Then initialize UI components
    initializeDiagramTypeDropdown();
    updateFormatDropdown();
    initializeLineNumbers();
    initializeResizeHandle();
    adjustControlsLayout();

    // Initialize zoom and pan functionality
    window.diagramZoomPan = initializeZoomPan();

    // Initialize fullscreen mode functionality
    window.fullscreenMode = initializeFullscreenMode();

    // Initialize file operations
    initializeFileOperations();

    // Initialize search functionality
    initializeSearchFunctionality();

    // Initialize theme system
    ThemeManager.init();

    // Initialize auto-refresh functionality
    initializeAutoRefresh();

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
    }, 150); // Slightly longer delay to ensure all scripts are loaded

    // Finally, update the diagram after all initialization is complete
    setTimeout(() => {
        updateDiagram();
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
 * Code textarea tab key handler - provides proper indentation support
 * @private
 */
codeTextarea.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
        e.preventDefault();

        const start = this.selectionStart;
        const end = this.selectionEnd;
        const value = this.value;

        if (e.shiftKey) {
            // Shift + Tab: Remove indentation
            const lineStart = value.lastIndexOf('\n', start - 1) + 1;
            const lineEnd = value.indexOf('\n', end);
            const actualLineEnd = lineEnd === -1 ? value.length : lineEnd;

            if (start !== end) {
                // Multiple lines selected
                const selectedLines = value.substring(lineStart, actualLineEnd);
                const lines = selectedLines.split('\n');

                const dedentedLines = lines.map(line => {
                    if (line.startsWith('    ')) {
                        return line.substring(4); // Remove 4 spaces
                    } else if (line.startsWith('\t')) {
                        return line.substring(1); // Remove 1 tab
                    }
                    return line;
                });

                const newValue = value.substring(0, lineStart) + dedentedLines.join('\n') + value.substring(actualLineEnd);
                const removedChars = selectedLines.length - dedentedLines.join('\n').length;

                this.value = newValue;
                this.selectionStart = Math.max(lineStart, start - Math.min(4, removedChars));
                this.selectionEnd = Math.max(this.selectionStart, end - removedChars);
            } else {
                // Single line
                const currentLine = value.substring(lineStart, actualLineEnd);
                if (currentLine.startsWith('    ')) {
                    const newValue = value.substring(0, lineStart) + currentLine.substring(4) + value.substring(actualLineEnd);
                    this.value = newValue;
                    this.selectionStart = this.selectionEnd = Math.max(lineStart, start - 4);
                } else if (currentLine.startsWith('\t')) {
                    const newValue = value.substring(0, lineStart) + currentLine.substring(1) + value.substring(actualLineEnd);
                    this.value = newValue;
                    this.selectionStart = this.selectionEnd = Math.max(lineStart, start - 1);
                }
            }
        } else {
            // Tab: Add indentation
            if (start !== end) {
                // Multiple lines selected - indent each line
                const lineStart = value.lastIndexOf('\n', start - 1) + 1;
                const lineEnd = value.indexOf('\n', end);
                const actualLineEnd = lineEnd === -1 ? value.length : lineEnd;

                const selectedLines = value.substring(lineStart, actualLineEnd);
                const lines = selectedLines.split('\n');
                const indentedLines = lines.map(line => '    ' + line); // Add 4 spaces to each line

                const newValue = value.substring(0, lineStart) + indentedLines.join('\n') + value.substring(actualLineEnd);

                this.value = newValue;
                this.selectionStart = start + 4; // Move cursor past the added indentation
                this.selectionEnd = end + (lines.length * 4); // Adjust end selection
            } else {
                // Single cursor position - insert tab (4 spaces)
                const newValue = value.substring(0, start) + '    ' + value.substring(end);
                this.value = newValue;
                this.selectionStart = this.selectionEnd = start + 4;
            }
        }

        // Trigger input event to update line numbers and diagram
        const inputEvent = new Event('input', { bubbles: true });
        this.dispatchEvent(inputEvent);
    }
});

/**
 * Code textarea input event handler - handles content changes and updates
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

    updateLineNumbers();
    debounceUpdateDiagram();
    updateUrl();
});

/**
 * Diagram type dropdown change handler - updates format options and loads examples
 * @private
 */
document.getElementById('diagramType').addEventListener('change', async function () {
    const diagramType = this.value;
    const currentCode = codeTextarea.value;

    updateFormatDropdown();
    updateUrl();

    const isCodeEmpty = currentCode.trim() === '';
    const exampleCache = getExampleCache();
    const isCurrentCodeAnExample = Object.values(exampleCache).includes(currentCode);

    if (!state.userHasEditedContent || isCurrentCodeAnExample || isCodeEmpty) {
        const example = await loadExampleForDiagramType(diagramType);
        codeTextarea.value = example;
        updateLineNumbers();
        if (state.autoRefreshEnabled) {
            updateDiagram();
        }
    } else {
        debounceUpdateDiagram();
    }
});

/**
 * Output format dropdown change handler - updates diagram when format changes
 * @private
 */
document.getElementById('outputFormat').addEventListener('change', function () {
    if (state.autoRefreshEnabled) {
        updateDiagram();
    }
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
}

// Export functions that need to be globally accessible
window.showSearchBar = showSearchBar;

