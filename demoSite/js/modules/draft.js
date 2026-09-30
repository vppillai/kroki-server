/**
 * Draft persistence: keeps the last edited diagram in localStorage so a reload,
 * a closed tab or a diagram too large for a URL (POST mode) is not lost.
 * Restored only when the page is opened without a diagram in the URL.
 */

const DRAFT_KEY = 'doccode-draft';
const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
let saveTimer = null;

function readForm() {
    return {
        code: document.getElementById('code')?.value ?? '',
        diag: document.getElementById('diagramType')?.value ?? '',
        fmt: document.getElementById('outputFormat')?.value ?? '',
        savedAt: Date.now(),
    };
}

/** Debounced save of the current editor contents. */
export function saveDraft() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try {
            const draft = readForm();
            if (draft.code.trim()) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch { /* storage full or disabled: drafts are best-effort */ }
    }, 800);
}

/** Return a recent draft, or null. */
export function loadDraft() {
    try {
        const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (!draft || typeof draft.code !== 'string' || !draft.code.trim()) return null;
        if (!draft.savedAt || Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) return null;
        return draft;
    } catch {
        return null;
    }
}
