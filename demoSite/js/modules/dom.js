/**
 * Safe DOM Utilities Module
 *
 * Provides CSS-class-based visibility toggling, safe HTML escaping,
 * safe markdown rendering, and blob URL lifecycle management.
 *
 * @module dom
 */

// ========================================
// VISIBILITY HELPERS
// ========================================

/**
 * Show an element by removing the .hidden class
 * @param {HTMLElement} el - Element to show
 */
export function show(el) {
    if (el) {
        el.classList.remove('hidden');
    }
}

/**
 * Hide an element by adding the .hidden class
 * @param {HTMLElement} el - Element to hide
 */
export function hide(el) {
    if (el) {
        el.classList.add('hidden');
    }
}

/**
 * Toggle element visibility based on a boolean
 * @param {HTMLElement} el - Element to toggle
 * @param {boolean} visible - Whether to show (true) or hide (false)
 */
export function toggle(el, visible) {
    if (el) {
        el.classList.toggle('hidden', !visible);
    }
}

// ========================================
// HTML SAFETY
// ========================================

/**
 * Escape HTML special characters using DOM textContent (safe from XSS)
 * @param {string} text - Raw text to escape
 * @returns {string} HTML-escaped text
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// SAFE MARKDOWN RENDERING
// ========================================

/**
 * Safely render markdown-like content into a container.
 * Splits on code fences and builds DOM nodes safely (no innerHTML with untrusted content).
 *
 * @param {HTMLElement} container - Container to render into
 * @param {string} text - Markdown-like text to render
 */
export function renderMarkdownContent(container, text) {
    // Clear container
    container.textContent = '';

    if (!text) return;

    // Split on code fences (```language\n...\n```)
    const parts = text.split(/(```[\s\S]*?```)/g);

    for (const part of parts) {
        if (part.startsWith('```') && part.endsWith('```')) {
            // Code block
            const lines = part.slice(3, -3).split('\n');
            const lang = lines[0].trim();
            const code = lines.slice(lang ? 1 : 0).join('\n').trim();

            const pre = document.createElement('pre');
            const codeEl = document.createElement('code');
            if (lang) {
                codeEl.className = `language-${lang}`;
            }
            codeEl.textContent = code;
            pre.appendChild(codeEl);
            container.appendChild(pre);
        } else if (part.trim()) {
            // Regular text - split by newlines for paragraphs
            const paragraphs = part.split(/\n\n+/);
            for (const para of paragraphs) {
                if (para.trim()) {
                    const p = document.createElement('p');
                    // Handle inline code (`...`)
                    const inlineParts = para.split(/(`[^`]+`)/g);
                    for (const inlinePart of inlineParts) {
                        if (inlinePart.startsWith('`') && inlinePart.endsWith('`')) {
                            const code = document.createElement('code');
                            code.textContent = inlinePart.slice(1, -1);
                            p.appendChild(code);
                        } else {
                            // Handle bold (**...**)
                            const boldParts = inlinePart.split(/(\*\*[^*]+\*\*)/g);
                            for (const boldPart of boldParts) {
                                if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
                                    const strong = document.createElement('strong');
                                    strong.textContent = boldPart.slice(2, -2);
                                    p.appendChild(strong);
                                } else {
                                    p.appendChild(document.createTextNode(boldPart));
                                }
                            }
                        }
                    }
                    container.appendChild(p);
                }
            }
        }
    }
}

// ========================================
// BLOB URL LIFECYCLE MANAGEMENT
// ========================================

/** @type {Set<string>} Tracked blob URLs for cleanup */
const trackedBlobUrls = new Set();

/**
 * Create a blob URL and track it for later cleanup
 * @param {Blob} blob - Blob to create URL for
 * @returns {string} Blob URL
 */
export function createTrackedBlobUrl(blob) {
    const url = URL.createObjectURL(blob);
    trackedBlobUrls.add(url);
    return url;
}

/**
 * Revoke a tracked blob URL and remove from tracking set
 * @param {string} url - Blob URL to revoke
 */
export function revokeBlobUrl(url) {
    if (url && trackedBlobUrls.has(url)) {
        URL.revokeObjectURL(url);
        trackedBlobUrls.delete(url);
    }
}

/**
 * Revoke all tracked blob URLs (cleanup on unload)
 */
export function revokeAllBlobUrls() {
    for (const url of trackedBlobUrls) {
        URL.revokeObjectURL(url);
    }
    trackedBlobUrls.clear();
}
