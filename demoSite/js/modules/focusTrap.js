/**
 * Minimal focus-trap helpers for modal dialogs.
 *
 * Keeps Tab/Shift+Tab cycling inside an open modal so keyboard and screen-reader
 * users can't tab into the inert page behind it. Pair with focus restoration on
 * close (capture document.activeElement before opening, .focus() it after).
 *
 * @module focusTrap
 */

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), ' +
    'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Visible, focusable elements within a container, in DOM order.
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
export function getFocusable(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll(FOCUSABLE))
        .filter(el => el.offsetParent !== null || el === document.activeElement);
}

/**
 * On a Tab keydown, wrap focus within the container. No-op for other keys.
 * @param {KeyboardEvent} e
 * @param {HTMLElement} container
 */
export function handleTabTrap(e, container) {
    if (e.key !== 'Tab') return;
    const items = getFocusable(container);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
}
