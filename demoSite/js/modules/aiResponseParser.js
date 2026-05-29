/**
 * Robust extraction of the {diagramCode, explanation} object from an AI
 * model's text response. Models frequently wrap output in markdown fences
 * despite instructions, and diagram code routinely contains '}' characters,
 * so naive regex extraction fails. This does a string-aware brace-balanced
 * scan that ignores braces inside JSON string values.
 *
 * @module aiResponseParser
 */

/** Validate the shape we require. */
function isValidShape(obj) {
    return obj && typeof obj.diagramCode === 'string' && typeof obj.explanation === 'string';
}

/** Strip leading/trailing markdown code fences (```json ... ```). */
function stripFences(text) {
    return text
        .replace(/^\s*```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
}

/**
 * Find every top-level, complete, brace-balanced object substring, ignoring
 * braces inside double-quoted strings. Returns them in document order so the
 * caller can try each (a model may emit a decoy/example object before the real
 * answer).
 *
 * @param {string} text
 * @returns {string[]}
 */
function findBalancedObjects(text) {
    const objects = [];
    let i = 0;

    while (i < text.length) {
        const start = text.indexOf('{', i);
        if (start === -1) break;

        let depth = 0;
        let inString = false;
        let escaped = false;
        let closed = false;

        for (let j = start; j < text.length; j++) {
            const ch = text[j];
            if (inString) {
                if (escaped) { escaped = false; }
                else if (ch === '\\') { escaped = true; }
                else if (ch === '"') { inString = false; }
                continue;
            }
            if (ch === '"') { inString = true; continue; }
            if (ch === '{') { depth++; }
            else if (ch === '}') {
                depth--;
                if (depth === 0) {
                    objects.push(text.slice(start, j + 1));
                    i = j + 1;
                    closed = true;
                    break;
                }
            }
        }

        // Unbalanced from this '{' to end of text — skip past it and keep scanning.
        if (!closed) { i = start + 1; }
    }

    return objects;
}

/**
 * Extract and validate the {diagramCode, explanation} object from raw text.
 *
 * @param {string} raw - The raw text content from the model.
 * @returns {{diagramCode: string, explanation: string}|null} Parsed object, or null if none found.
 */
export function extractDiagramJson(raw) {
    if (typeof raw !== 'string') return null;
    const text = stripFences(raw);

    // 1. Direct parse of the (de-fenced) text.
    try {
        const parsed = JSON.parse(text);
        if (isValidShape(parsed)) return parsed;
    } catch { /* fall through */ }

    // 2. Substring from first '{' to last '}' (covers a single object surrounded by prose).
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first !== -1 && last > first) {
        try {
            const parsed = JSON.parse(text.slice(first, last + 1));
            if (isValidShape(parsed)) return parsed;
        } catch { /* fall through */ }
    }

    // 3. String-aware brace-balanced scan: try EACH top-level object and return
    //    the first one with the required shape (skips decoy/example objects the
    //    model may emit before the real answer).
    for (const candidate of findBalancedObjects(text)) {
        try {
            const parsed = JSON.parse(candidate);
            if (isValidShape(parsed)) return parsed;
        } catch { /* try next candidate */ }
    }

    return null;
}
