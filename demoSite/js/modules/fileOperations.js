/**
 * File Operations Module
 * 
 * Handles all file-related operations including open, save, save as,
 * auto-save functionality, and file status management.
 * Supports both File System Access API and fallback methods.
 * 
 * @author Vysakh Pillai
 */

import { state, updateCurrentFile, updateAutoSaveTimer } from './state.js';
import { updateLineNumbers } from './utils.js';
import { updateDiagram } from './diagramOperations.js';

/**
 * Update file status display in UI
 * Updates file name, save status, and button states based on current file state
 * Handles visibility of file status elements when no file is open
 * 
 * @public
 */
export function updateFileStatus() {
    const fileNameElement = document.getElementById('file-name');
    const saveStatusElement = document.getElementById('save-status');
    const saveBtn = document.getElementById('save-file-btn');
    const autoSaveLabel = document.getElementById('auto-save-label');
    const fileStatusContainer = document.querySelector('.file-status');

    // Check if we have any content to work with (either open file or new file with content)
    const hasContent = state.currentFile.isOpen || state.currentFile.content;

    // Handle completely empty state - hide the entire file status area
    if (!hasContent) {
        if (fileStatusContainer) {
            fileStatusContainer.style.display = 'none';
        }
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.title = 'No file to save';
        }
        if (autoSaveLabel) {
            autoSaveLabel.style.display = 'none';
            autoSaveLabel.classList.remove('active');
        }
        return;
    }

    // Show the file status area when a file is open
    if (fileStatusContainer) {
        fileStatusContainer.style.display = 'block';
    }

    // Determine if this is truly a new file (no handle and not opened from disk)
    const isNewFile = !state.currentFile.handle && !state.currentFile.isOpen;

    // Show auto-save pill only when file has been saved at least once
    if (autoSaveLabel) {
        // For new files, always hide auto-save
        if (isNewFile) {
            autoSaveLabel.style.display = 'none';
            autoSaveLabel.classList.remove('active');
        } else if (state.currentFile.handle || !isFileSystemAccessSupported()) {
            // Show auto-save for files that have been saved
            autoSaveLabel.style.display = 'inline-flex';
            autoSaveLabel.classList.toggle('active', !!state.currentFile.autoSaveEnabled);
        } else {
            // Hide auto-save for other cases
            autoSaveLabel.style.display = 'none';
        }
    }

    // Add animation class for file name changes
    if (fileNameElement.textContent !== state.currentFile.name) {
        fileNameElement.classList.add('changed');
        setTimeout(() => fileNameElement.classList.remove('changed'), 300);
    }

    fileNameElement.textContent = state.currentFile.name || 'Untitled';

    if (isNewFile) {
        // New file - never show "Saved" status
        saveStatusElement.textContent = '';
        saveStatusElement.className = 'save-status';
        saveStatusElement.style.visibility = 'hidden'; // Hide the element completely
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.title = 'Save file (Ctrl+S)';
        }
    } else if (state.currentFile.saved) {
        saveStatusElement.textContent = 'Saved';
        saveStatusElement.className = 'save-status saved';
        saveStatusElement.style.visibility = 'visible';
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.title = 'File is saved';
        }
    } else {
        saveStatusElement.textContent = '• Unsaved changes';
        saveStatusElement.className = 'save-status';
        saveStatusElement.style.visibility = 'visible';
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.title = 'Save file (Ctrl+S)';
        }
    }
}

/**
 * Mark current file as modified
 * Updates UI to reflect unsaved changes and provides visual feedback
 * Only acts if a file is currently open and was previously saved
 * 
 * @public
 */
export function markFileAsModified() {
    // Mark as modified if we have content (either open file or new file)
    const hasContent = state.currentFile.isOpen || state.currentFile.content;
    if (hasContent && state.currentFile.saved) {
        updateCurrentFile({ saved: false });
        updateFileStatus();

        // Visual feedback for modification
        const editor = document.getElementById('code');
        if (editor) {
            editor.style.borderLeftColor = 'var(--warning-color)';
            setTimeout(() => {
                editor.style.borderLeftColor = '';
            }, 1000);
        }
    }
}

/**
 * Mark current file as saved
 * Updates file state and UI to reflect saved status with visual feedback
 * 
 * @public
 */
export function markFileAsSaved() {
    updateCurrentFile({ saved: true });
    updateFileStatus();

    // Visual feedback for save
    const saveStatusElement = document.getElementById('save-status');
    if (saveStatusElement) {
        saveStatusElement.style.transform = 'scale(1.1)';
        setTimeout(() => {
            saveStatusElement.style.transform = '';
        }, 200);
    }
}

/**
 * Check File System Access API support
 * Determines if the browser supports modern file system APIs
 * 
 * @returns {boolean} True if File System Access API is available
 * @public
 */
export function isFileSystemAccessSupported() {
    return 'showOpenFilePicker' in window;
}

/**
 * Open file dialog and load file content
 * Uses File System Access API when available, falls back to file input
 * Handles file content loading, diagram type detection, and UI updates
 * 
 * @async
 * @public
 */
export async function openFile() {
    try {
        if (isFileSystemAccessSupported()) {
            const [fileHandle] = await window.showOpenFilePicker({
                types: [{
                    description: 'Diagram files',
                    accept: {
                        'text/*': ['.puml', '.plantuml', '.uml', '.txt', '.md', '.py', '.js', '.json', '.xml', '.yaml', '.yml', '.dot', '.gv', '.mmd', '.mermaid', '.d2', '.bpmn', '.erd', '.tikz', '.svg', '.drawio']
                    }
                }]
            });

            const file = await fileHandle.getFile();
            const content = await file.text();

            updateCurrentFile({
                name: file.name,
                handle: fileHandle,
                content: content,
                saved: true,
                isOpen: true
                // Note: auto-save state is preserved if it was previously set
            });

            const codeTextarea = document.getElementById('code');
            codeTextarea.value = content;
            updateLineNumbers();
            updateDiagram();
            updateFileStatus();

            // Detect diagram type from content or filename
            detectDiagramType(content, file.name);

        } else {
            // Fallback to file input
            const fileInput = document.getElementById('file-input');
            fileInput.click();
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error opening file:', error);
            showErrorMessage('Failed to open file: ' + error.message);
        }
    }
}

/**
 * Handle file input change for fallback file loading
 * Processes file selection from traditional file input element
 * Updates application state and detects diagram type
 * 
 * @param {Event} event - File input change event
 * @public
 */
export function handleFileInputChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const content = e.target.result;

        updateCurrentFile({
            name: file.name,
            handle: null,
            content: content,
            saved: true,
            isOpen: true
            // Note: no handle means limited file operations (no auto-save with File System Access)
        });

        const codeTextarea = document.getElementById('code');
        codeTextarea.value = content;
        updateLineNumbers();
        updateDiagram();
        updateFileStatus();

        // Detect diagram type from content or filename
        detectDiagramType(content, file.name);
    };
    reader.readAsText(file);

    // Reset the input
    event.target.value = '';
}

/**
 * Detect diagram type from file content or filename
 * Analyzes content patterns and file extensions to determine diagram type
 * Updates diagram type dropdown and format options
 * 
 * @param {string} content - File content to analyze
 * @param {string} filename - Original filename for extension detection
 * @public
 */
export function detectDiagramType(content, filename) {
    const diagramTypeSelect = document.getElementById('diagramType');
    const lowerContent = content.toLowerCase();
    const lowerFilename = filename.toLowerCase();

    // Try to detect from content
    if (lowerContent.includes('@startuml') || lowerContent.includes('@enduml')) {
        diagramTypeSelect.value = 'plantuml';
    } else if (lowerContent.includes('graph') && (lowerContent.includes('mermaid') || lowerFilename.includes('.mmd'))) {
        diagramTypeSelect.value = 'mermaid';
    } else if (lowerContent.includes('digraph') || lowerFilename.includes('.dot') || lowerFilename.includes('.gv')) {
        diagramTypeSelect.value = 'graphviz';
    } else if (lowerFilename.includes('.d2')) {
        diagramTypeSelect.value = 'd2';
    } else if (lowerFilename.includes('.py')) {
        diagramTypeSelect.value = 'structurizr';
    }

    // Update format dropdown and trigger diagram update
    import('./diagramOperations.js').then(module => {
        module.updateFormatDropdown();
    });
    import('./state.js').then(module => {
        module.updateCurrentDiagramType(diagramTypeSelect.value);
    });
}

/**
 * Save current file content
 * Uses existing file handle when available, prompts for save location otherwise
 * Handles File System Access API and fallback download methods
 * 
 * @async
 * @public
 */
export async function saveFile() {
    const content = document.getElementById('code').value;

    try {
        if (state.currentFile.handle && isFileSystemAccessSupported()) {
            // Use existing file handle
            const writable = await state.currentFile.handle.createWritable();
            await writable.write(content);
            await writable.close();

            updateCurrentFile({
                content: content,
                saved: true
            });
            updateFileStatus();
            showSuccessMessage('File saved successfully!');
        } else {
            // No handle available, prompt for save as
            await saveAsFile();
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error saving file:', error);
            showErrorMessage('Failed to save file: ' + error.message);
        }
    }
}

/**
 * Save file with new name or location
 * Always prompts user for save location regardless of existing file handle
 * Creates new file handle for future save operations
 * 
 * @async
 * @public
 */
export async function saveAsFile() {
    const content = document.getElementById('code').value;

    try {
        if (isFileSystemAccessSupported()) {
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: getDefaultFileName(),
                types: [{
                    description: 'Diagram files',
                    accept: {
                        'text/plain': ['.puml', '.plantuml', '.uml', '.txt', '.md', '.py', '.js', '.json', '.xml', '.yaml', '.yml', '.dot', '.gv', '.mmd', '.mermaid', '.d2', '.bpmn', '.erd', '.tikz', '.svg', '.drawio']
                    }
                }]
            });

            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();

            updateCurrentFile({
                name: fileHandle.name || getDefaultFileName(),
                handle: fileHandle,
                content: content,
                isOpen: true,  // Now it's a "real" file
                saved: true
                // Note: auto-save state is preserved from current file
            });
            updateFileStatus();  // This will show auto-save button
            showSuccessMessage('File saved successfully!');
        } else {
            // Fallback to download
            downloadAsFile(content);
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error saving file:', error);
            showErrorMessage('Failed to save file: ' + error.message);
        }
    }
}

/**
 * Generate default filename based on current diagram type
 * Provides appropriate file extensions for different diagram formats
 * 
 * @returns {string} Default filename with appropriate extension
 * @public
 */
export function getDefaultFileName() {
    const extensions = {
        plantuml: '.puml',
        mermaid: '.mmd',
        graphviz: '.dot',
        d2: '.d2',
        structurizr: '.py',
        ditaa: '.txt',
        erd: '.erd',
        pikchr: '.txt',
        kroki: '.txt'
    };

    const extension = extensions[state.currentDiagramType] || '.txt';
    return `diagram${extension}`;
}

/**
 * Fallback download function for browsers without File System Access API
 * Creates and triggers download of file content using blob URLs
 * Updates file state and provides user feedback
 * 
 * @param {string} content - File content to download
 * @public
 */
export function downloadAsFile(content) {
    const filename = getDefaultFileName();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Update current file info
    updateCurrentFile({
        name: filename,
        content: content,
        isOpen: true,  // Treat downloaded files as "open"
        saved: true,
        handle: null  // Downloaded files don't have a handle
    });
    updateFileStatus();
    showSuccessMessage('File downloaded successfully!');
}

/**
 * Display success message to user
 * Shows temporary success feedback in the save status area
 * 
 * @param {string} message - Success message to display
 * @public
 */
export function showSuccessMessage(message) {
    const saveStatus = document.getElementById('save-status');
    const originalClass = saveStatus.className;
    const originalText = saveStatus.textContent;

    saveStatus.textContent = message;
    saveStatus.className = 'save-status saved';

    setTimeout(() => {
        saveStatus.textContent = originalText;
        saveStatus.className = originalClass;
    }, 2000);
}

/**
 * Display error message to user
 * Shows error feedback in the main error message area
 * 
 * @param {string} message - Error message to display
 * @public
 */
export function showErrorMessage(message) {
    const errorElement = document.getElementById('errorMessage');
    errorElement.textContent = message;
    errorElement.style.display = 'block';

    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

/**
 * Show non-dismissible error banner in diagram pane
 * Displays persistent error information at bottom of image area
 * 
 * @param {string} message - Error message to display in banner
 * @public
 */
export function showImageErrorBanner(message) {
    const banner = document.getElementById('image-error-banner');
    const messageElement = document.getElementById('error-banner-message');

    if (banner && messageElement) {
        messageElement.textContent = message;
        banner.style.display = 'block';
    }
}

/**
 * Hide image error banner
 * Removes error banner from diagram pane when error is resolved
 * 
 * @public
 */
export function hideImageErrorBanner() {
    const banner = document.getElementById('image-error-banner');

    if (banner) {
        banner.style.display = 'none';
    }
}

/**
 * Create new file with example content
 * Prompts user about unsaved changes, loads appropriate example for current diagram type
 * Resets file state and user edit tracking
 * 
 * @async
 * @public
 */
export async function newFile() {
    // Check for unsaved changes either in an open file or user-edited content
    const hasUnsavedChanges = (state.currentFile.isOpen && !state.currentFile.saved) ||
        (state.userHasEditedContent && document.getElementById('code').value.trim() !== '');

    if (hasUnsavedChanges) {
        if (!confirm('You have unsaved changes. Are you sure you want to create a new file?')) {
            return;
        }
    }

    // Get the current diagram type to load the appropriate example
    const diagramType = document.getElementById('diagramType').value;
    const { loadExampleForDiagramType } = await import('./diagramOperations.js');
    const exampleCode = await loadExampleForDiagramType(diagramType);

    // Stop auto-save if it's running (new files can't auto-save without a handle)
    if (state.currentFile.autoSaveEnabled) {
        stopAutoSave();
    }

    // Completely reset file state for new file
    updateCurrentFile({
        name: null,  // Will show as "Untitled" in UI
        handle: null,  // No file handle for new files
        content: exampleCode,
        saved: true,  // Start as "saved" since it's just the example
        isOpen: false,  // Not actually "open" from disk
        autoSaveEnabled: false  // Disable auto-save for new files
    });

    const codeTextarea = document.getElementById('code');
    codeTextarea.value = exampleCode;

    // Reset user edit tracking since we're starting fresh
    import('./state.js').then(module => {
        module.updateUserHasEditedContent(false);
    });

    updateLineNumbers();
    updateDiagram();
    updateFileStatus(); // This will handle auto-save UI properly
}

/**
 * Handle keyboard shortcuts for file operations
 * Processes Ctrl/Cmd key combinations for file operations and settings
 * 
 * @param {KeyboardEvent} event - Keyboard event to process
 * @public
 */
export function handleFileShortcuts(event) {
    if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
            case 'o':
                event.preventDefault();
                openFile();
                break;
            case 's':
                event.preventDefault();
                if (event.shiftKey) {
                    saveAsFile();
                } else {
                    saveFile();
                }
                break;
            case 'n':
                event.preventDefault();
                newFile();
                break;
            case 'f':
                event.preventDefault();
                import('./search.js').then(module => module.showSearchBar());
                break;
            case ',':
                event.preventDefault();
                if (window.configUI) {
                    window.configUI.open();
                } else {
                    console.warn('Configuration UI not available yet');
                    alert('Settings system is loading... Please try again in a moment.');
                }
                break;
        }
    }
}

/**
 * Toggle auto-save functionality for current file
 * Enables or disables automatic file saving and updates UI indicators
 * 
 * @public
 */
export function toggleAutoSave() {
    updateCurrentFile({ autoSaveEnabled: !state.currentFile.autoSaveEnabled });
    const autoSaveLabel = document.getElementById('auto-save-label');

    if (autoSaveLabel) {
        autoSaveLabel.classList.toggle('active', state.currentFile.autoSaveEnabled);
    }

    if (state.currentFile.autoSaveEnabled) {
        startAutoSave();
    } else {
        stopAutoSave();
    }
}

/**
 * Start auto-save timer for current file
 * Initiates periodic automatic saving based on configuration delay
 * 
 * @public
 */
export function startAutoSave() {
    stopAutoSave(); // Clear any existing timer
    const timer = setInterval(() => {
        // Only auto-save if we have a file handle (can't show file picker without user interaction)
        if (state.currentFile.isOpen && !state.currentFile.saved && state.currentFile.handle) {
            saveFile();
        }
    }, state.AUTO_SAVE_DELAY);
    updateAutoSaveTimer(timer);
}

/**
 * Stop auto-save timer
 * Clears active auto-save interval to prevent further automatic saves
 * 
 * @public
 */
export function stopAutoSave() {
    if (state.autoSaveTimer) {
        clearInterval(state.autoSaveTimer);
        updateAutoSaveTimer(null);
    }
}

/**
 * Initialize file operations system
 * Sets up event listeners for file operation buttons and keyboard shortcuts
 * Establishes file content change tracking
 * 
 * @public
 */
export function initializeFileOperations() {
    // Set up event listeners
    const newBtn = document.getElementById('new-file-btn');
    const openBtn = document.getElementById('open-file-btn');
    const saveBtn = document.getElementById('save-file-btn');
    const saveAsBtn = document.getElementById('save-as-btn');
    const autoSaveLabel = document.getElementById('auto-save-label');
    const fileInput = document.getElementById('file-input');

    if (newBtn) {
        newBtn.addEventListener('click', newFile);
    }

    if (openBtn) {
        openBtn.addEventListener('click', openFile);
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', saveFile);
    }

    if (saveAsBtn) {
        saveAsBtn.addEventListener('click', saveAsFile);
    }

    if (autoSaveLabel) {
        autoSaveLabel.addEventListener('click', toggleAutoSave);
    }

    if (fileInput) {
        fileInput.addEventListener('change', handleFileInputChange);
    }

    // Add keyboard shortcuts
    document.addEventListener('keydown', handleFileShortcuts);

    // Initial file status update
    updateFileStatus();

    // Track content changes
    const codeTextarea = document.getElementById('code');
    if (codeTextarea) {
        codeTextarea.addEventListener('input', function () {
            // Check if content changed from what was loaded/saved
            const hasContent = state.currentFile.isOpen || state.currentFile.content;
            if (hasContent && state.currentFile.saved && this.value !== state.currentFile.content) {
                markFileAsModified();
            }
        });
    }
} 