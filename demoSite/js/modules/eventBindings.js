/**
 * Event Bindings Module
 *
 * Centralizes all DOM event listener registrations for toolbar buttons,
 * keyboard shortcuts, window events, and UI controls.
 *
 * @module eventBindings
 */

import { state, updateUserHasEditedContent, getExampleCache } from './state.js';
import {
    debounceUpdateDiagram, updateFormatDropdown, loadExampleForDiagramType,
    downloadDiagram, handleDecode, shouldUsePostForCurrentDiagram
} from './diagramOperations.js';
import { markFileAsModified, stopFileMonitoring } from './fileOperations.js';
import { updateUrl, clearUrlParameters } from './urlHandler.js';
import { show, hide } from './dom.js';

/**
 * Bind all event listeners.
 * Called after DOM and all modules are initialized.
 *
 * @param {Object} options - Dependencies
 * @param {Function} options.updateDrawioButtonVisibility - Draw.io button updater
 */
export function bindEvents({ updateDrawioButtonVisibility }) {
    const codeTextarea = document.getElementById('code');

    // ========================================
    // CODE TEXTAREA
    // ========================================

    if (codeTextarea) {
        codeTextarea.addEventListener('input', function () {
            const code = this.value.trim();
            if (code !== '') updateUserHasEditedContent(true);

            if (state.currentFile.isOpen && state.currentFile.saved && this.value !== state.currentFile.content) {
                markFileAsModified();
            }

            debounceUpdateDiagram();

            if (!shouldUsePostForCurrentDiagram()) {
                updateUrl();
            } else {
                clearUrlParameters();
            }
        });
    }

    // ========================================
    // DIAGRAM TYPE & FORMAT
    // ========================================

    const diagramTypeSelect = document.getElementById('diagramType');
    if (diagramTypeSelect) {
        diagramTypeSelect.addEventListener('change', async function () {
            const diagramType = this.value;
            const currentCode = codeTextarea.value;

            updateFormatDropdown();
            updateDrawioButtonVisibility();

            if (!shouldUsePostForCurrentDiagram()) {
                updateUrl();
            } else {
                clearUrlParameters();
            }

            if (window.editor) window.editor.setLanguage(diagramType);

            const isCodeEmpty = currentCode.trim() === '';
            const exampleCache = getExampleCache();
            const isCurrentCodeAnExample = Object.values(exampleCache).includes(currentCode);

            if (!state.userHasEditedContent || isCurrentCodeAnExample || isCodeEmpty) {
                const example = await loadExampleForDiagramType(diagramType);
                codeTextarea.value = example;
            }
            debounceUpdateDiagram();
        });
    }

    const outputFormatSelect = document.getElementById('outputFormat');
    if (outputFormatSelect) {
        outputFormatSelect.addEventListener('change', debounceUpdateDiagram);
    }

    // ========================================
    // TOOLBAR BUTTONS
    // ========================================

    const downloadBtn = document.getElementById('downloadButton');
    if (downloadBtn) downloadBtn.addEventListener('click', downloadDiagram);

    const copyLinkBtn = document.getElementById('copy-link-btn');
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', function () {
            const imageLinkText = document.getElementById('image-link-text');
            if (imageLinkText) {
                imageLinkText.select();
                document.execCommand('copy');
                const originalText = this.textContent;
                this.textContent = 'Copied!';
                setTimeout(() => { this.textContent = originalText; }, 1500);
            }
        });
    }

    // ========================================
    // DECODE UTILITY
    // ========================================

    const decodeBtn = document.getElementById('decode-btn');
    if (decodeBtn) decodeBtn.addEventListener('click', handleDecode);

    const encodedTextInput = document.getElementById('encoded-text');
    if (encodedTextInput) {
        encodedTextInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') handleDecode();
        });
    }

    // ========================================
    // HELP MODAL
    // ========================================

    const helpBtn = document.getElementById('zoom-help');
    const helpModal = document.getElementById('help-modal');
    const closeHelpBtn = document.getElementById('close-help');

    let previouslyFocusedElement = null;

    function openHelpModal() {
        previouslyFocusedElement = document.activeElement;
        show(helpModal);
        if (closeHelpBtn) closeHelpBtn.focus();
    }

    function closeHelpModal() {
        hide(helpModal);
        if (previouslyFocusedElement) {
            previouslyFocusedElement.focus();
            previouslyFocusedElement = null;
        }
    }

    if (helpBtn && helpModal && closeHelpBtn) {
        hide(helpModal);

        helpBtn.addEventListener('click', openHelpModal);
        closeHelpBtn.addEventListener('click', closeHelpModal);

        helpModal.addEventListener('click', function (e) {
            if (e.target === helpModal) closeHelpModal();
        });

        // Focus trapping
        helpModal.addEventListener('keydown', function (e) {
            if (e.key !== 'Tab') return;
            const focusable = helpModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });
    }

    // ========================================
    // GLOBAL KEYBOARD SHORTCUTS
    // ========================================

    document.addEventListener('keydown', function (e) {
        // Escape: close help modal
        if (e.key === 'Escape' && helpModal && !helpModal.classList.contains('hidden')) {
            closeHelpModal();
        }

        // '?': open help modal
        if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
            const tag = document.activeElement?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) return;
            openHelpModal();
        }

        // Ctrl/Cmd + K: toggle AI assistant
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (window.aiAssistant) window.aiAssistant.toggleChat();
        }
    });

    // ========================================
    // WINDOW BEFOREUNLOAD
    // ========================================

    window.addEventListener('beforeunload', function (e) {
        stopFileMonitoring();

        if (window.domUtils && window.domUtils.revokeAllBlobUrls) {
            window.domUtils.revokeAllBlobUrls();
        }

        if (window.aiAssistant && typeof window.aiAssistant.destroy === 'function') {
            window.aiAssistant.destroy();
        }

        if (state.currentFile.isOpen && !state.currentFile.saved) {
            e.preventDefault();
            e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            return 'You have unsaved changes. Are you sure you want to leave?';
        }
    });

    // ========================================
    // GLOBAL EXPORTS
    // ========================================

    window.showSearchBar = function () {
        if (window.editor) window.editor.openSearch();
    };
}
