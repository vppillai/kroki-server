// File operations module
import { CONSTANTS, FILE_EXTENSIONS } from '../config/constants.js';
import appState from '../core/state.js';
import DOMUtils from '../utils/dom.js';

class FileOperations {
    constructor() {
        this.initializeEventListeners();
    }

    /**
     * Check if File System Access API is supported
     * @returns {boolean} Whether the API is supported
     */
    isFileSystemAccessSupported() {
        return 'showOpenFilePicker' in window;
    }

    /**        // Attach auto-save toggle event
        DOMUtils.addEventListener('auto-save-label', 'click', () => {
    /**
     * Update file status display in the UI
     */
    updateFileStatus() {
        const file = appState.file;
        const currentContent = DOMUtils.getValue('code');
        const hasContent = currentContent && currentContent.trim().length > 0;

        // Add animation class for file name changes
        const fileNameElement = DOMUtils.getElementById('file-name');
        if (fileNameElement && fileNameElement.textContent !== file.name) {
            DOMUtils.addClass('file-name', 'changed');
            setTimeout(() => DOMUtils.removeClass('file-name', 'changed'), 300);
        }

        // Determine what to show as file name
        if (file.isOpen) {
            DOMUtils.setTextContent('file-name', file.name || 'Untitled');
        } else {
            DOMUtils.setTextContent('file-name', hasContent ? 'Untitled' : 'No file open');
        }

        // Determine save button and status based on content and file state
        if (file.saved && (!hasContent || currentContent === file.content)) {
            // File is saved or no meaningful content
            DOMUtils.setTextContent('save-status', file.isOpen ? 'Saved' : '');
            DOMUtils.addClass('save-status', 'saved');
            DOMUtils.setAttributes('save-file-btn', {
                disabled: true,
                title: file.isOpen ? 'File is saved' : 'No content to save'
            });

            // Hide auto-save toggle when file is saved (no need to auto-save)
            DOMUtils.toggleDisplay('auto-save-label', false);
        } else {
            // There are unsaved changes (either new content or modified file)
            DOMUtils.setTextContent('save-status', '• Unsaved changes');
            DOMUtils.removeClass('save-status', 'saved');
            DOMUtils.setAttributes('save-file-btn', {
                disabled: false,
                title: file.isOpen ? 'Save file (Ctrl+S)' : 'Save As file (Ctrl+S)'
            });

            // Show auto-save toggle only when there's an open file with file handle and unsaved changes
            // This prevents auto-save from triggering downloads for files without handles
            if (file.isOpen && file.handle) {
                DOMUtils.toggleDisplay('auto-save-label', true, 'inline-flex');
                DOMUtils.toggleClass('auto-save-label', 'active', file.autoSaveEnabled);
            } else {
                DOMUtils.toggleDisplay('auto-save-label', false);
            }
        }
    }

    /**
     * Mark file as modified
     */
    markFileAsModified() {
        const file = appState.file;
        if (file.isOpen && file.saved) {
            appState.updateFileState({ saved: false });
            this.updateFileStatus();

            // Visual feedback for modification
            const editor = DOMUtils.getElementById('code');
            if (editor) {
                editor.style.borderLeftColor = 'var(--warning-color)';
                setTimeout(() => {
                    editor.style.borderLeftColor = '';
                }, 1000);
            }
        }
    }

    /**
     * Mark file as saved
     */
    markFileAsSaved() {
        appState.updateFileState({ saved: true });
        this.updateFileStatus();

        // Visual feedback for save
        const saveStatusElement = DOMUtils.getElementById('save-status');
        if (saveStatusElement) {
            saveStatusElement.style.transform = 'scale(1.1)';
            setTimeout(() => {
                saveStatusElement.style.transform = '';
            }, 200);
        }
    }

    /**
     * Get default filename based on current diagram type
     * @returns {string} Default filename with appropriate extension
     */
    getDefaultFileName() {
        const extension = FILE_EXTENSIONS[appState.diagramType] || '.txt';
        return `diagram${extension}`;
    }

    /**
     * Show success message
     * @param {string} message - Success message to show
     */
    showSuccessMessage(message) {
        const saveStatus = DOMUtils.getElementById('save-status');
        if (!saveStatus) return;

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
     * Show error message
     * @param {string} message - Error message to show
     */
    showErrorMessage(message) {
        DOMUtils.setTextContent('errorMessage', message);
        DOMUtils.toggleDisplay('errorMessage', true);

        setTimeout(() => {
            DOMUtils.toggleDisplay('errorMessage', false);
        }, 5000);
    }

    /**
     * Detect diagram type from content or filename
     * @param {string} content - File content
     * @param {string} filename - File name
     */
    detectDiagramType(content, filename) {
        const lowerContent = content.toLowerCase();
        const lowerFilename = filename.toLowerCase();
        let detectedType = 'plantuml'; // default

        // Try to detect from content patterns
        if (lowerContent.includes('@startuml') || lowerContent.includes('@enduml')) {
            detectedType = 'plantuml';
        } else if (lowerContent.includes('graph') && (lowerContent.includes('mermaid') || lowerFilename.includes('.mmd'))) {
            detectedType = 'mermaid';
        } else if (lowerContent.includes('digraph') || lowerFilename.includes('.dot') || lowerFilename.includes('.gv')) {
            detectedType = 'graphviz';
        } else if (lowerFilename.includes('.d2')) {
            detectedType = 'd2';
        } else if (lowerFilename.includes('.py')) {
            detectedType = 'structurizr';
        }

        DOMUtils.setValue('diagramType', detectedType);
        appState.setDiagramType(detectedType);

        // Trigger update of format dropdown and diagram
        if (window.updateFormatDropdown) {
            window.updateFormatDropdown();
        }
    }

    /**
     * Open file using File System Access API or fallback
     */
    async openFile() {
        try {
            if (this.isFileSystemAccessSupported()) {
                // Try to use the File System Access API
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

                appState.updateFileState({
                    name: file.name,
                    handle: fileHandle,
                    content: content,
                    saved: true,
                    isOpen: true
                });

                DOMUtils.setValue('code', content);
                if (window.updateLineNumbers) window.updateLineNumbers();
                if (window.updateDiagram) window.updateDiagram();
                this.updateFileStatus();

                this.detectDiagramType(content, file.name);

            } else {
                // Fallback to file input
                this.triggerFileInput();
            }
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                // Silently fall back to file input - no need to spam console
                this.triggerFileInput();
            } else if (error.name !== 'AbortError') {
                console.error('Error opening file:', error);
                this.showErrorMessage('Failed to open file: ' + error.message);
            }
        }
    }

    /**
     * Trigger the file input as fallback
     */
    triggerFileInput() {
        const fileInput = DOMUtils.getElementById('file-input');
        if (fileInput) {
            fileInput.click();
        }
    }

    /**
     * Handle file input change (fallback method)
     * @param {Event} event - File input change event
     */
    handleFileInputChange(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;

            appState.updateFileState({
                name: file.name,
                handle: null,
                content: content,
                saved: true,
                isOpen: true
            });

            DOMUtils.setValue('code', content);
            if (window.updateLineNumbers) window.updateLineNumbers();
            if (window.updateDiagram) window.updateDiagram();
            this.updateFileStatus();

            this.detectDiagramType(content, file.name);
        };
        reader.readAsText(file);

        // Reset the input
        event.target.value = '';
    }

    /**
     * Save current file
     */
    async saveFile() {
        const content = DOMUtils.getValue('code');
        const file = appState.file;

        try {
            if (file.handle && this.isFileSystemAccessSupported()) {
                // Use existing file handle
                const writable = await file.handle.createWritable();
                await writable.write(content);
                await writable.close();

                appState.updateFileState({ content: content });
                this.markFileAsSaved();
                this.showSuccessMessage('File saved successfully!');
            } else {
                // No handle available, prompt for save as
                await this.saveAsFile();
            }
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                // Silently fall back to save as - no need to spam console
                await this.saveAsFile();
            } else if (error.name !== 'AbortError') {
                console.error('Error saving file:', error);
                this.showErrorMessage('Failed to save file: ' + error.message);
            }
        }
    }

    /**
     * Save as new file
     */
    async saveAsFile() {
        const content = DOMUtils.getValue('code');

        try {
            if (this.isFileSystemAccessSupported()) {
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: this.getDefaultFileName(),
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

                appState.updateFileState({
                    name: fileHandle.name || this.getDefaultFileName(),
                    handle: fileHandle,
                    content: content,
                    isOpen: true
                });

                this.markFileAsSaved();
                this.updateFileStatus();
                this.showSuccessMessage('File saved successfully!');
            } else {
                // Fallback to download
                this.downloadAsFile(content);
            }
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                // Silently fall back to download - no need to spam console
                this.downloadAsFile(content);
            } else if (error.name !== 'AbortError') {
                console.error('Error saving file:', error);
                this.showErrorMessage('Failed to save file: ' + error.message);
            }
        }
    }

    /**
     * Download file as fallback method
     * @param {string} content - File content to download
     */
    downloadAsFile(content) {
        const filename = this.getDefaultFileName();
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
        appState.updateFileState({
            name: filename,
            content: content,
            isOpen: true
        });

        this.markFileAsSaved();
        this.updateFileStatus();
        this.showSuccessMessage('File downloaded successfully!');
    }

    /**
     * Create new file
     */
    newFile() {
        const file = appState.file;
        if (file.isOpen && !file.saved) {
            if (!confirm('You have unsaved changes. Are you sure you want to create a new file?')) {
                return;
            }
        }

        // Reset to initial state - no file is actually "open" until saved or loaded
        appState.updateFileState({
            name: 'Untitled',
            handle: null,
            content: CONSTANTS.DEFAULT_EXAMPLE,
            saved: true, // Consider new content as "saved" initially
            isOpen: false // No actual file is open yet
        });

        DOMUtils.setValue('code', CONSTANTS.DEFAULT_EXAMPLE);
        if (window.updateLineNumbers) window.updateLineNumbers();
        if (window.updateDiagram) window.updateDiagram();
        this.updateFileStatus();
    }

    /**
     * Toggle auto-save functionality
     */
    toggleAutoSave() {
        const currentState = appState.file.autoSaveEnabled;

        appState.updateFileState({ autoSaveEnabled: !currentState });
        DOMUtils.toggleClass('auto-save-label', 'active', !currentState);

        if (!currentState) {
            this.startAutoSave();
        } else {
            this.stopAutoSave();
        }
    }

    /**
     * Start auto-save timer
     */
    startAutoSave() {
        this.stopAutoSave(); // Clear any existing timer
        const timer = setInterval(() => {
            const file = appState.file;

            // Auto-save only if:
            // 1. A file is actually open (isOpen = true), AND
            // 2. The file has a valid file handle (from File System Access API), AND
            // 3. The file has unsaved changes
            if (file.isOpen && file.handle && !file.saved) {
                this.saveFile();
            }
        }, CONSTANTS.AUTO_SAVE_DELAY);

        appState.setAutoSaveTimer(timer);
    }

    /**
     * Stop auto-save timer
     */
    stopAutoSave() {
        appState.clearAutoSaveTimer();
    }

    /**
     * Handle keyboard shortcuts for file operations
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleFileShortcuts(event) {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 'o':
                    event.preventDefault();
                    this.openFile();
                    break;
                case 's':
                    event.preventDefault();
                    if (event.shiftKey) {
                        this.saveAsFile();
                    } else {
                        this.saveFile();
                    }
                    break;
                case 'n':
                    event.preventDefault();
                    this.newFile();
                    break;
            }
        }
    }

    /**
     * Initialize event listeners for file operations
     */
    initializeEventListeners() {
        // Button event listeners
        DOMUtils.addEventListener('new-file-btn', 'click', () => this.newFile());
        DOMUtils.addEventListener('open-file-btn', 'click', () => this.openFile());
        DOMUtils.addEventListener('save-file-btn', 'click', () => this.saveFile());
        DOMUtils.addEventListener('save-as-btn', 'click', () => this.saveAsFile());

        // Attach auto-save toggle event
        DOMUtils.addEventListener('auto-save-label', 'click', () => {
            this.toggleAutoSave();
        });

        DOMUtils.addEventListener('file-input', 'change', (e) => this.handleFileInputChange(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleFileShortcuts(e));

        // Track content changes
        DOMUtils.addEventListener('code', 'input', () => {
            const file = appState.file;
            const currentContent = DOMUtils.getValue('code');

            if (file.isOpen && file.saved && currentContent !== file.content) {
                // Handle modifications to opened files
                this.markFileAsModified();
            } else if (!file.isOpen && file.saved && currentContent !== file.content) {
                // Handle modifications to new content (no file open yet)
                // Mark as unsaved to enable save button, but keep isOpen=false to hide auto-save
                appState.updateFileState({ saved: false });
            }

            // Always update status to reflect current state
            this.updateFileStatus();
        });

        // Initial file status update
        this.updateFileStatus();
    }

    /**
     * Check for unsaved changes before page unload
     * @returns {string|undefined} Warning message if there are unsaved changes
     */
    checkUnsavedChanges() {
        const file = appState.file;
        if (file.isOpen && !file.saved) {
            return 'You have unsaved changes. Are you sure you want to leave?';
        }
    }
}

export default FileOperations;
