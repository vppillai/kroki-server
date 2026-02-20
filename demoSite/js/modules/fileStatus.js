/**
 * File Status Module
 *
 * Manages file status display, modification tracking, and user feedback
 * for file operations (success/error messages, banners).
 *
 * @module fileStatus
 */

import { state, updateCurrentFile } from './state.js';
import { ERROR_DISPLAY_MS, ANIMATION_DELAY_MS } from './constants.js';

/**
 * Check File System Access API support
 * @returns {boolean}
 */
function isFileSystemAccessSupported() {
    return 'showOpenFilePicker' in window;
}

/**
 * Update file status display in UI
 */
export function updateFileStatus() {
    const fileNameElement = document.getElementById('file-name');
    const saveStatusElement = document.getElementById('save-status');
    const saveBtn = document.getElementById('save-file-btn');
    const autoSaveLabel = document.getElementById('auto-save-label');
    const autoReloadLabel = document.getElementById('auto-reload-label');
    const fileStatusContainer = document.querySelector('.file-status');

    const hasContent = state.currentFile.isOpen || state.currentFile.content;

    if (!hasContent) {
        if (fileStatusContainer) fileStatusContainer.style.display = 'none';
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.title = 'No file to save';
        }
        if (autoSaveLabel) {
            autoSaveLabel.style.display = 'none';
            autoSaveLabel.classList.remove('active');
        }
        if (autoReloadLabel) {
            autoReloadLabel.style.display = 'none';
            autoReloadLabel.classList.remove('active');
        }
        return;
    }

    if (fileStatusContainer) fileStatusContainer.style.display = 'block';

    const isNewFile = !state.currentFile.handle && !state.currentFile.isOpen;

    if (autoSaveLabel) {
        if (isNewFile) {
            autoSaveLabel.style.display = 'none';
            autoSaveLabel.classList.remove('active');
        } else if (state.currentFile.handle || !isFileSystemAccessSupported()) {
            autoSaveLabel.style.display = 'inline-flex';
            autoSaveLabel.classList.toggle('active', !!state.currentFile.autoSaveEnabled);
        } else {
            autoSaveLabel.style.display = 'none';
        }
    }

    if (autoReloadLabel) {
        if (isNewFile) {
            autoReloadLabel.style.display = 'none';
            autoReloadLabel.classList.remove('active');
        } else if (state.currentFile.handle && isFileSystemAccessSupported()) {
            autoReloadLabel.style.display = 'inline-flex';
            autoReloadLabel.classList.toggle('active', !!state.currentFile.autoReloadEnabled);
        } else if (state.currentFile.isOpen) {
            autoReloadLabel.style.display = 'inline-flex';
            autoReloadLabel.classList.toggle('active', !!state.currentFile.autoReloadEnabled);
            autoReloadLabel.title = 'Auto-reload requires File System Access API (not available)';
        } else {
            autoReloadLabel.style.display = 'none';
            autoReloadLabel.classList.remove('active');
        }
    }

    if (fileNameElement.textContent !== state.currentFile.name) {
        fileNameElement.classList.add('changed');
        setTimeout(() => fileNameElement.classList.remove('changed'), ANIMATION_DELAY_MS);
    }

    fileNameElement.textContent = state.currentFile.name || 'Untitled';

    if (isNewFile) {
        saveStatusElement.textContent = '';
        saveStatusElement.className = 'save-status';
        saveStatusElement.style.visibility = 'hidden';
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
 */
export function markFileAsModified() {
    const hasContent = state.currentFile.isOpen || state.currentFile.content;
    if (hasContent && state.currentFile.saved) {
        updateCurrentFile({ saved: false });
        updateFileStatus();

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
 */
export function markFileAsSaved() {
    updateCurrentFile({ saved: true });
    updateFileStatus();

    const saveStatusElement = document.getElementById('save-status');
    if (saveStatusElement) {
        saveStatusElement.style.transform = 'scale(1.1)';
        setTimeout(() => {
            saveStatusElement.style.transform = '';
        }, 200);
    }
}

/**
 * Display success message
 * @param {string} message
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
 * Display error message
 * @param {string} message
 */
export function showErrorMessage(message) {
    const errorElement = document.getElementById('errorMessage');
    errorElement.textContent = message;
    errorElement.style.display = 'block';

    setTimeout(() => {
        errorElement.style.display = 'none';
    }, ERROR_DISPLAY_MS);
}

