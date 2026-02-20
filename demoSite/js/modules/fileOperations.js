/**
 * File Operations Module
 *
 * Core file operations: open, save, save-as, new, keyboard shortcuts.
 * Status display, auto-save, and file monitoring are delegated to sub-modules.
 *
 * @author Vysakh Pillai
 */

import { state, updateCurrentFile, updateUserHasEditedContent, updateCurrentDiagramType } from './state.js';
import { debounceUpdateDiagram, updateFormatDropdown } from './diagramOperations.js';

import {
    updateFileStatus, markFileAsModified, markFileAsSaved,
    showSuccessMessage, showErrorMessage
} from './fileStatus.js';
import { toggleAutoSave, startAutoSave, stopAutoSave } from './autoSave.js';
import { toggleAutoReload, startFileMonitoring, stopFileMonitoring, restartFileMonitoring } from './fileMonitoring.js';

// Re-export from sub-modules
export {
    updateFileStatus, markFileAsModified, markFileAsSaved,
    showSuccessMessage, showErrorMessage
} from './fileStatus.js';
export { toggleAutoSave, startAutoSave, stopAutoSave } from './autoSave.js';
export { toggleAutoReload, startFileMonitoring, stopFileMonitoring, restartFileMonitoring } from './fileMonitoring.js';

/**
 * Check File System Access API support
 * @returns {boolean}
 */
export function isFileSystemAccessSupported() {
    return 'showOpenFilePicker' in window;
}

/**
 * Open file dialog and load file content
 * @async
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
            });

            const codeTextarea = document.getElementById('code');
            codeTextarea.value = content;

            debounceUpdateDiagram();
            updateFileStatus();

            detectDiagramType(content, file.name);

            if (state.currentFile.autoReloadEnabled) {
                startFileMonitoring();
            }

        } else {
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
 * @param {Event} event
 */
export function handleFileInputChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file before processing
    if (window.inputValidation) {
        const validation = window.inputValidation.validateFile(file);
        if (!validation.valid) {
            showErrorMessage(validation.error);
            event.target.value = '';
            return;
        }
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const content = e.target.result;

        updateCurrentFile({
            name: file.name,
            handle: null,
            content: content,
            saved: true,
            isOpen: true
        });

        const codeTextarea = document.getElementById('code');
        codeTextarea.value = content;
        debounceUpdateDiagram();
        updateFileStatus();

        detectDiagramType(content, file.name);
    };
    reader.readAsText(file);

    event.target.value = '';
}

/**
 * Detect diagram type from content or filename
 * @param {string} content
 * @param {string} filename
 */
export function detectDiagramType(content, filename) {
    const diagramTypeSelect = document.getElementById('diagramType');
    const lowerContent = content.toLowerCase();
    const lowerFilename = filename.toLowerCase();

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

    updateFormatDropdown();
    updateCurrentDiagramType(diagramTypeSelect.value);
}

/**
 * Save current file content
 * @async
 */
export async function saveFile() {
    const content = document.getElementById('code').value;

    try {
        if (state.currentFile.handle && isFileSystemAccessSupported()) {
            const writable = await state.currentFile.handle.createWritable();
            await writable.write(content);
            await writable.close();

            updateCurrentFile({ content: content, saved: true });
            updateFileStatus();
            showSuccessMessage('File saved successfully!');
        } else {
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
 * @async
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
                isOpen: true,
                saved: true
            });
            updateFileStatus();
            showSuccessMessage('File saved successfully!');
        } else {
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
 * @returns {string}
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
 * Fallback download function
 * @param {string} content
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

    updateCurrentFile({
        name: filename,
        content: content,
        isOpen: true,
        saved: true,
        handle: null
    });
    updateFileStatus();
    showSuccessMessage('File downloaded successfully!');
}

/**
 * Create new file with example content
 * @async
 */
export async function newFile() {
    const hasUnsavedChanges = (state.currentFile.isOpen && !state.currentFile.saved) ||
        (state.userHasEditedContent && document.getElementById('code').value.trim() !== '');

    if (hasUnsavedChanges) {
        if (!confirm('You have unsaved changes. Are you sure you want to create a new file?')) {
            return;
        }
    }

    const diagramType = document.getElementById('diagramType').value;
    const { loadExampleForDiagramType } = await import('./diagramOperations.js');
    const exampleCode = await loadExampleForDiagramType(diagramType);

    if (state.currentFile.autoSaveEnabled) {
        stopAutoSave();
    }

    if (state.fileMonitoring.isWatching) {
        stopFileMonitoring();
    }

    updateCurrentFile({
        name: null,
        handle: null,
        content: exampleCode,
        saved: true,
        isOpen: false,
        autoSaveEnabled: false,
        autoReloadEnabled: true
    });

    const codeTextarea = document.getElementById('code');
    codeTextarea.value = exampleCode;

    updateUserHasEditedContent(false);

    debounceUpdateDiagram();
    updateFileStatus();
}

/**
 * Handle keyboard shortcuts for file operations
 * @param {KeyboardEvent} event
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
 * Initialize file operations system
 */
export function initializeFileOperations() {
    const newBtn = document.getElementById('new-file-btn');
    const openBtn = document.getElementById('open-file-btn');
    const saveBtn = document.getElementById('save-file-btn');
    const saveAsBtn = document.getElementById('save-as-btn');
    const autoSaveLabel = document.getElementById('auto-save-label');
    const autoReloadLabel = document.getElementById('auto-reload-label');
    const fileInput = document.getElementById('file-input');

    if (newBtn) newBtn.addEventListener('click', newFile);
    if (openBtn) openBtn.addEventListener('click', openFile);
    if (saveBtn) saveBtn.addEventListener('click', saveFile);
    if (saveAsBtn) saveAsBtn.addEventListener('click', saveAsFile);
    if (autoSaveLabel) autoSaveLabel.addEventListener('click', toggleAutoSave);
    if (autoReloadLabel) autoReloadLabel.addEventListener('click', toggleAutoReload);
    if (fileInput) fileInput.addEventListener('change', handleFileInputChange);

    document.addEventListener('keydown', handleFileShortcuts);
    updateFileStatus();
}
