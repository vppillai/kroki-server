/**
 * AI chat message assembly.
 *
 * Builds the OpenAI-style `messages` array sent to the model: a system message,
 * the recent conversation history (user/assistant turns only, capped to bound
 * tokens), and finally the current user message. Sending a real system role and
 * prior turns lets the model follow instructions and remember context — the old
 * code concatenated everything into a single user string with no history.
 *
 * @module aiMessages
 */

/** Default number of prior history messages to include (≈5 exchanges). */
export const DEFAULT_HISTORY_CAP = 10;

/**
 * Map raw chat-history entries ({type, text}) to role messages, keeping only
 * user/assistant turns (system/status lines are dropped), capped to the last N.
 *
 * @param {Array<{type:string,text:string}>} history
 * @param {number} cap - Max number of history messages to keep (0 = none).
 * @returns {Array<{role:string,content:string}>}
 */
export function mapHistory(history, cap = DEFAULT_HISTORY_CAP) {
    // 'assistant-success' / 'assistant-warning' / 'assistant-error' are styled
    // assistant turns (see displayMessage's typeMap) — the model must see them.
    const isAssistant = (t) => typeof t === 'string' && t.startsWith('assistant');
    const turns = (history || [])
        .filter(m => m && (m.type === 'user' || isAssistant(m.type)) && typeof m.text === 'string' && m.text.trim())
        .map(m => ({ role: isAssistant(m.type) ? 'assistant' : 'user', content: m.text }));
    return cap > 0 ? turns.slice(-cap) : turns;
}

/**
 * Build the full messages array for an AI request.
 *
 * @param {string} systemPrompt - System instructions (omitted if empty).
 * @param {string} currentUserPrompt - The current user turn's prompt text.
 * @param {Array<{type:string,text:string}>} [history] - Prior turns (current turn excluded by the caller).
 * @param {number} [cap] - Max history messages to include.
 * @returns {Array<{role:string,content:string}>}
 */
export function buildMessages(systemPrompt, currentUserPrompt, history = [], cap = DEFAULT_HISTORY_CAP) {
    const messages = [];
    if (systemPrompt && systemPrompt.trim()) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    for (const turn of mapHistory(history, cap)) {
        messages.push(turn);
    }
    messages.push({ role: 'user', content: currentUserPrompt });
    return messages;
}
