/**
 * File Monitoring Module
 *
 * Manages file change monitoring for auto-reload functionality.
 * Uses efficient polling via File System Access API.
 *
 * @module fileMonitoring
 */

import { state, updateCurrentFile, updateFileMonitoring } from './state.js';
import { debounceUpdateDiagram } from './diagramOperations.js';
import { updateFileStatus, showSuccessMessage } from './fileStatus.js';

/**
 * Toggle auto-reload functionality
 */
export function toggleAutoReload() {
    updateCurrentFile({ autoReloadEnabled: !state.currentFile.autoReloadEnabled });
    const autoReloadLabel = document.getElementById('auto-reload-label');

    if (autoReloadLabel) {
        autoReloadLabel.classList.toggle('active', state.currentFile.autoReloadEnabled);
    }

    if (state.currentFile.autoReloadEnabled && state.currentFile.handle) {
        startFileMonitoring();
    } else {
        stopFileMonitoring();
    }
}

/**
 * Start file monitoring for auto-reload
 */
export function startFileMonitoring() {
    stopFileMonitoring();

    if (!state.currentFile.handle || !state.currentFile.autoReloadEnabled) {
        return;
    }

    const checkFileChanges = async () => {
        try {
            const file = await state.currentFile.handle.getFile();
            const currentModified = file.lastModified;

            if (state.fileMonitoring.lastModified === null) {
                updateFileMonitoring({ lastModified: currentModified });
                return;
            }

            if (currentModified > state.fileMonitoring.lastModified) {
                updateFileMonitoring({ lastModified: currentModified });
                const newContent = await file.text();
                if (newContent !== state.currentFile.content) {
                    await reloadFileContent(newContent);
                }
            }
        } catch (error) {
            console.warn('File monitoring error:', error);
            stopFileMonitoring();
        }
    };

    const timer = setInterval(checkFileChanges, state.AUTO_RELOAD_DELAY);
    updateFileMonitoring({
        watchTimer: timer,
        isWatching: true
    });
}

/**
 * Stop file monitoring
 */
export function stopFileMonitoring() {
    if (state.fileMonitoring.watchTimer) {
        clearInterval(state.fileMonitoring.watchTimer);
    }

    updateFileMonitoring({
        watchTimer: null,
        isWatching: false,
        lastModified: null
    });
}

/**
 * Restart file monitoring with updated delay
 */
export function restartFileMonitoring() {
    if (state.fileMonitoring.isWatching) {
        stopFileMonitoring();
        startFileMonitoring();
    }
}

/**
 * Reload file content when external changes detected
 * @param {string} newContent
 * @private
 */
async function reloadFileContent(newContent) {
    updateCurrentFile({
        content: newContent,
        saved: true
    });

    const codeTextarea = document.getElementById('code');
    if (codeTextarea) {
        const cursorPosition = codeTextarea.selectionStart;
        codeTextarea.value = newContent;
        if (cursorPosition <= newContent.length) {
            codeTextarea.setSelectionRange(cursorPosition, cursorPosition);
        }

        codeTextarea.style.borderLeftColor = 'var(--success-color)';
        setTimeout(() => {
            codeTextarea.style.borderLeftColor = '';
        }, 1000);
    }

    debounceUpdateDiagram();
    updateFileStatus();
    showSuccessMessage('File reloaded from disk');
}
