/**
 * Search Functionality Module
 *
 * Delegates search operations to CodeMirror 6's built-in search panel.
 *
 * @module search
 * @author Vysakh Pillai
 */

/**
 * Show search bar — opens CM6 search panel
 * @public
 */
export function showSearchBar() {
    if (window.editor) {
        window.editor.openSearch();
    }
}
