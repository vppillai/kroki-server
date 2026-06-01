/**
 * Per-diagram-type Kroki render options.
 *
 * Some Kroki renderers need a fixed render option to display correctly in the
 * editor. GoAT emits a prefers-color-scheme-adaptive SVG: its content is drawn
 * with `currentColor`, which it sets to white under `@media (prefers-color-scheme:
 * dark)`. In a dark-mode OS that makes GoAT render white, which collides with the
 * editor's dark-mode diagram handling (white backdrop + invert) and shows as a
 * black square. Forcing the dark-scheme color to black makes GoAT render black
 * like every other (black-on-transparent) diagram, so the app's theming works
 * uniformly. GoAT is the only Kroki renderer that adapts to the OS scheme.
 *
 * This module has no browser or third-party dependencies so it stays unit-testable.
 *
 * @module diagramOptions
 */

/** @type {Object.<string, Object.<string,string>>} */
const DIAGRAM_OPTIONS = {
    goat: { 'svg-color-dark-scheme': '#000000' },
};

/**
 * Kroki render options for a type as a URL query string (e.g. "?k=v"), or "".
 * Values are URL-encoded (e.g. "#000000" -> "%23000000").
 * @param {string} diagramType
 * @returns {string}
 */
export function diagramOptionsQuery(diagramType) {
    const opts = DIAGRAM_OPTIONS[diagramType];
    if (!opts) return '';
    return '?' + Object.entries(opts).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

/**
 * Kroki render options for a type as an object (for the JSON POST body), or null.
 * @param {string} diagramType
 * @returns {Object|null}
 */
export function diagramOptionsObject(diagramType) {
    return DIAGRAM_OPTIONS[diagramType] || null;
}
