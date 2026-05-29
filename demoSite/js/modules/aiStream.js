/**
 * SSE (server-sent events) frame interpretation for streamed AI responses.
 *
 * Interprets a single `data:` payload from an OpenAI-style stream. The previous
 * reader silently skipped everything it couldn't read as a content delta, so
 * provider error frames and empty responses surfaced downstream as a misleading
 * "not valid JSON" error. This classifies each frame explicitly.
 *
 * @module aiStream
 */

/**
 * @typedef {{kind:'done'}|{kind:'content',value:string}|{kind:'error',value:string}|{kind:'skip'}} SSEEvent
 */

/**
 * Interpret one SSE `data:` payload (already stripped of the "data:" prefix).
 *
 * @param {string} dataStr
 * @returns {SSEEvent}
 */
export function interpretSSEData(dataStr) {
    if (dataStr === '[DONE]') return { kind: 'done' };

    let parsed;
    try {
        parsed = JSON.parse(dataStr);
    } catch {
        return { kind: 'skip' };
    }

    // Provider error frame (top-level or nested message).
    if (parsed && parsed.error) {
        const msg = typeof parsed.error === 'string'
            ? parsed.error
            : (parsed.error.message || 'AI provider returned an error');
        return { kind: 'error', value: msg };
    }

    const choice = parsed && parsed.choices && parsed.choices[0];
    if (choice && choice.finish_reason === 'error') {
        return { kind: 'error', value: 'AI provider reported a generation error' };
    }

    const content = choice && choice.delta && choice.delta.content;
    if (typeof content === 'string' && content.length > 0) {
        return { kind: 'content', value: content };
    }

    return { kind: 'skip' };
}
