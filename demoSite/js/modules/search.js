/**
 * Search Functionality Module
 *
 * Now delegates all search operations to CodeMirror 6's built-in search panel.
 * Exported functions are kept as no-op stubs for backwards compatibility.
 *
 * @module search
 * @author Vysakh Pillai
 */

import { openSearchPanel, closeSearchPanel } from '@codemirror/search';

/**
 * Show search bar — opens CM6 search panel
 * @public
 */
export function showSearchBar() {
    if (window.editor) {
        window.editor.openSearch();
    }
}

/**
 * Hide search bar — closes CM6 search panel and refocuses editor
 * @public
 */
export function hideSearchBar() {
    if (window.editor) {
        window.editor.closeSearch();
        window.editor.focus();
    }
}

/** @deprecated Handled by CodeMirror 6 */
export function performSearch() {}

/** @deprecated Handled by CodeMirror 6 */
export function clearSearchHighlights() {}

/** @deprecated Handled by CodeMirror 6 */
export function highlightSearchResults() {}

/** @deprecated Handled by CodeMirror 6 */
export function scrollToCurrentMatch() {}

/** @deprecated Handled by CodeMirror 6 */
export function goToNextMatch() {}

/** @deprecated Handled by CodeMirror 6 */
export function goToPreviousMatch() {}

/** @deprecated Handled by CodeMirror 6 */
export function toggleCaseSensitive() {}

/**
 * Initialize search functionality — no-op, CM6 handles search natively
 * @public
 */
export function initializeSearchFunctionality() {}
