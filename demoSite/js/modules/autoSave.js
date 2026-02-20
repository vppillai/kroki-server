/**
 * Auto-Save Module
 *
 * Manages automatic file saving with configurable intervals.
 *
 * @module autoSave
 */

import { state, updateCurrentFile, updateAutoSaveTimer } from './state.js';
import { saveFile } from './fileOperations.js';

/**
 * Toggle auto-save functionality
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
 * Start auto-save timer
 */
export function startAutoSave() {
    stopAutoSave();
    const timer = setInterval(() => {
        if (state.currentFile.isOpen && !state.currentFile.saved && state.currentFile.handle) {
            saveFile();
        }
    }, state.AUTO_SAVE_DELAY);
    updateAutoSaveTimer(timer);
}

/**
 * Stop auto-save timer
 */
export function stopAutoSave() {
    if (state.autoSaveTimer) {
        clearInterval(state.autoSaveTimer);
        updateAutoSaveTimer(null);
    }
}
