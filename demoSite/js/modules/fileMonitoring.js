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

    let checking = false;

    const checkFileChanges = async () => {
        if (checking) return; // avoid overlapping polls when a read is slow
        checking = true;
        try {
            const file = await state.currentFile.handle.getFile();
            const currentModified = file.lastModified;

            if (state.fileMonitoring.lastModified === null) {
                updateFileMonitoring({ lastModified: currentModified });
            } else if (currentModified > state.fileMonitoring.lastModified) {
                updateFileMonitoring({ lastModified: currentModified });
                const newContent = await file.text();
                if (newContent !== state.currentFile.content) {
                    await reloadFileContent(newContent);
                }
            }
        } catch (error) {
            console.warn('File monitoring error:', error);
            stopFileMonitoring();
            return;
        } finally {
            checking = false;
        }

        // Reschedule only after this check finishes (no overlap) and only while
        // monitoring is still active.
        if (state.fileMonitoring.isWatching) {
            const next = setTimeout(checkFileChanges, state.AUTO_RELOAD_DELAY);
            updateFileMonitoring({ watchTimer: next });
        }
    };

    updateFileMonitoring({ isWatching: true, lastModified: null });

    // Establish the baseline mtime up front so an edit during the first interval
    // is not swallowed by the first poll.
    state.currentFile.handle.getFile()
        .then(f => {
            if (state.fileMonitoring.isWatching && state.fileMonitoring.lastModified === null) {
                updateFileMonitoring({ lastModified: f.lastModified });
            }
        })
        .catch(() => { /* the first poll will establish the baseline */ });

    const timer = setTimeout(checkFileChanges, state.AUTO_RELOAD_DELAY);
    updateFileMonitoring({ watchTimer: timer });
}

/**
 * Stop file monitoring
 */
export function stopFileMonitoring() {
    if (state.fileMonitoring.watchTimer) {
        clearTimeout(state.fileMonitoring.watchTimer);
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
