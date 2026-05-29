/**
 * Keyboard helpers.
 *
 * The single source of truth for "is the user currently typing into an
 * editable surface?" — used by every global keyboard shortcut so that
 * bare-key shortcuts never hijack characters meant for the editor.
 *
 * CodeMirror 6 renders into a contenteditable <div class="cm-content">
 * inside .cm-editor, so a plain tagName check is NOT enough.
 *
 * @module keyboard
 */

/**
 * Return true if the given element (or the active element) is an editable
 * typing surface: an <input>, <textarea>, any contenteditable element, or
 * anything inside a CodeMirror editor.
 *
 * @param {EventTarget|null} [target] - Usually event.target; falls back to document.activeElement.
 * @returns {boolean}
 */
export function isTypingContext(target) {
    const node = target || (typeof document !== 'undefined' ? document.activeElement : null);
    if (!node) return false;

    const tag = node.tagName;
    // INPUT/TEXTAREA accept typed text; SELECT uses letter keys for type-ahead,
    // so a bare-key shortcut must not steal those either.
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (node.isContentEditable) return true;
    if (typeof node.closest === 'function' && node.closest('.cm-editor')) return true;

    return false;
}
