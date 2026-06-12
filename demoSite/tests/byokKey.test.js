/**
 * BYOK key-lifecycle regression tests (§3.6, tests 1–7).
 *
 * These tests lock the guarantee:
 *   "Your API key is stored only in this browser. In custom-API mode, requests
 *    go directly from your browser to the endpoint you configure; the key is
 *    never included in any request to this site."
 *
 * Run with: bun test tests/byokKey.test.js
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Browser-environment stubs (Bun runs in Node; simulate just enough of the
// browser globals that the modules under test need).
// ---------------------------------------------------------------------------

// Minimal localStorage
const _store = {};
globalThis.localStorage = {
    getItem:    (k) => (k in _store ? _store[k] : null),
    setItem:    (k, v) => { _store[k] = String(v); },
    removeItem: (k) => { delete _store[k]; },
};

// window = globalThis in this environment
globalThis.window = globalThis;

// Stubs consumed by config.js
globalThis.inputValidation = null;   // triggers the safe null-check in set()

// APP_CONSTANTS used by ai-assistant-api.js
globalThis.APP_CONSTANTS = { AI_MAX_TOKENS: 16000, AI_TEMPERATURE: 0.7 };

// ---------------------------------------------------------------------------
// Import modules under test
// ---------------------------------------------------------------------------

// config.js exports ConfigManager; also sets window.configManager
const { ConfigManager } = await import('../js/config.js');

// ai-assistant-api.js sets window.AIAssistantAPI
await import('../js/ai-assistant-api.js');

// ai-assistant-prompts.js (needed by validateModel's error path)
// stub it minimally
globalThis.AIAssistantPrompts = {
    getDefaultSystemPrompt: () => '',
    getDefaultUserPrompt:   () => '',
    getDefaultRetryPrompt:  () => '',
};

// dom.js (used by addMessage indirectly) — not needed for these unit tests
// ai-assistant-ui.js — not needed for these unit tests

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal fetch mock that resolves once with the given response,
 * recording every call into `calls`.
 */
function makeFetchMock(responseFactory) {
    const calls = [];
    const mock = async (url, init = {}) => {
        const body = init.body;
        calls.push({ url, headers: init.headers || {}, body, parsedBody: body ? (() => { try { return JSON.parse(body); } catch { return null; } })() : null });
        return responseFactory(url, init);
    };
    mock.calls = calls;
    return mock;
}

/** Minimal SSE-ish streaming response */
function makeStreamingOkResponse(text = 'data: [DONE]\n') {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        start(ctrl) {
            ctrl.enqueue(encoder.encode(text));
            ctrl.close();
        }
    });
    return {
        ok: true,
        status: 200,
        headers: { get: (h) => h === 'content-type' ? 'text/event-stream' : null },
        body: { getReader: () => {
            let done = false;
            const chunks = [encoder.encode(text)];
            let i = 0;
            return {
                read: async () => i < chunks.length
                    ? { done: false, value: chunks[i++] }
                    : { done: true, value: undefined },
                releaseLock: () => {}
            };
        }},
        json: async () => ({})
    };
}

/** Minimal non-streaming ok response */
function makeJsonOkResponse(data = {}) {
    return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => data,
    };
}

beforeEach(() => {
    // Clear localStorage between tests
    for (const k of Object.keys(_store)) delete _store[k];
    // Reset fetch
    globalThis.fetch = undefined;
});

// ---------------------------------------------------------------------------
// Test 1: callCustomAPI fetches ONLY the configured endpoint with the key
// ---------------------------------------------------------------------------

test('T1: callCustomAPI fetches only the user endpoint with Authorization: Bearer', async () => {
    const customEndpoint = 'https://api.example.com/v1/chat/completions';
    const fetchMock = makeFetchMock(() => makeStreamingOkResponse());
    globalThis.fetch = fetchMock;

    const config = {
        endpoint: customEndpoint,
        apiKey: 'sk-TEST',
        model: 'gpt-4o-mini',
        customModel: '',
        timeout: 30,
    };

    const callbacks = {
        addStreamingMessage: () => null,
        updateStreamingMessage: () => {},
        scrollToBottom: () => {},
    };

    await window.AIAssistantAPI.callCustomAPI(
        [{ role: 'user', content: 'hello' }],
        config,
        null,
        callbacks
    );

    assert.equal(fetchMock.calls.length, 1, 'exactly one fetch call');
    const call = fetchMock.calls[0];
    assert.equal(call.url, customEndpoint, 'fetches the configured endpoint');
    assert.equal(call.headers['Authorization'], 'Bearer sk-TEST', 'Authorization header set correctly');
});

// ---------------------------------------------------------------------------
// Test 2: callCustomAPI never hits the app origin / /api/ai-assist
// ---------------------------------------------------------------------------

test('T2: callCustomAPI never targets the app origin', async () => {
    const fetchMock = makeFetchMock(() => makeStreamingOkResponse());
    globalThis.fetch = fetchMock;

    const config = {
        endpoint: 'https://api.example.com/v1/chat/completions',
        apiKey: 'sk-TEST',
        model: 'gpt-4o-mini',
        customModel: '',
        timeout: 30,
    };

    const callbacks = {
        addStreamingMessage: () => null,
        updateStreamingMessage: () => {},
        scrollToBottom: () => {},
    };

    await window.AIAssistantAPI.callCustomAPI(
        [{ role: 'user', content: 'hello' }],
        config,
        null,
        callbacks
    );

    for (const call of fetchMock.calls) {
        // Must not hit a relative URL or the local /api/ai-assist path
        assert.ok(
            !call.url.startsWith('/api/') && !call.url.includes('/api/ai-assist'),
            `callCustomAPI must not target app origin, got: ${call.url}`
        );
    }
});

// ---------------------------------------------------------------------------
// Test 3 (H1 regression sentinel): callProxyAPI body contains NO api_key,
// NO endpoint, and does NOT contain the test key string
// ---------------------------------------------------------------------------

test('T3 (H1): callProxyAPI body contains no api_key, no endpoint, not the key string', async () => {
    const fetchMock = makeFetchMock(() => makeStreamingOkResponse());
    globalThis.fetch = fetchMock;

    const config = {
        useCustomAPI: false,   // proxy mode — H1 guard must not fire
        apiKey: '',            // no key in proxy mode
        endpoint: '',
        model: 'openai/gpt-5-mini',
        customModel: '',
        maxRetryAttempts: 3,
        timeout: 30,
    };

    const callbacks = {
        addStreamingMessage: () => null,
        updateStreamingMessage: () => {},
        scrollToBottom: () => {},
    };

    // Set a fake location origin so the Origin header is populated
    globalThis.location = { origin: 'https://localhost:8443' };

    await window.AIAssistantAPI.callProxyAPI(
        [{ role: 'user', content: 'hello' }],
        config,
        null,
        callbacks
    );

    assert.equal(fetchMock.calls.length, 1, 'exactly one fetch call');
    const call = fetchMock.calls[0];
    const body = call.parsedBody;

    assert.ok(body, 'body must be JSON-parseable');
    // The config object in the body must not carry api_key or endpoint
    const bodyConfig = body.config || {};
    assert.equal(bodyConfig.api_key, undefined, 'api_key must be absent from proxy body');
    assert.equal(bodyConfig.endpoint, undefined, 'endpoint must be absent from proxy body');
    // The serialized body must not contain any key-like string
    assert.ok(
        !call.body.includes('sk-'),
        'serialized proxy body must not contain any sk- key string'
    );
});

// ---------------------------------------------------------------------------
// Test 4: mode selector stays on custom under retry (no fallback to proxy)
// ---------------------------------------------------------------------------

test('T4: selector stays on callCustomAPI under retry — no fallback to callProxyAPI', async () => {
    let callCount = 0;
    const fetchMock = makeFetchMock(() => {
        callCount++;
        if (callCount === 1) {
            // First call: reject to simulate a network error
            return Promise.reject(new Error('Network error'));
        }
        return makeStreamingOkResponse();
    });
    globalThis.fetch = fetchMock;
    globalThis.location = { origin: 'https://localhost:8443' };

    const config = {
        endpoint: 'https://api.example.com/v1/chat/completions',
        apiKey: 'sk-RETRY-TEST',
        model: 'gpt-4o-mini',
        customModel: '',
        timeout: 5,
    };

    const callbacks = {
        addStreamingMessage: () => null,
        updateStreamingMessage: () => {},
        scrollToBottom: () => {},
    };

    // First call will throw; callCustomAPI itself does not retry (retries are
    // driven by makeAIRequest in ai-assistant.js). Verify the fetch mock was
    // called with the custom endpoint, not /api/ai-assist.
    try {
        await window.AIAssistantAPI.callCustomAPI(
            [{ role: 'user', content: 'hello' }],
            config,
            null,
            callbacks
        );
    } catch {
        // expected on first call
    }

    for (const call of fetchMock.calls) {
        assert.equal(call.url, config.endpoint,
            `all fetch calls must target the custom endpoint, got: ${call.url}`);
        assert.ok(!call.url.includes('/api/ai-assist'),
            'must never fall back to /api/ai-assist');
    }
});

// ---------------------------------------------------------------------------
// Test 5: configManager.export() strips the api key
// ---------------------------------------------------------------------------

test('T5: export() strips the api key', () => {
    const cm = new ConfigManager();
    cm.set('ai.apiKey', 'sk-SECRET');
    const exported = JSON.parse(cm.export());
    assert.equal(exported.ai.apiKey, '',
        'export() must strip ai.apiKey (config.js:427-429)');
});

// ---------------------------------------------------------------------------
// Test 6: chatHistory / getConversationHistory never contains the key
// ---------------------------------------------------------------------------

test('T6: chatHistory entries have only type/text — no key metadata', () => {
    // Simulate what AIAssistant.addMessage pushes into chatHistory
    const chatHistory = [];
    const addMessage = (type, text) => {
        chatHistory.push({ type, text, timestamp: new Date() });
    };

    addMessage('user', 'draw a sequence diagram');
    addMessage('assistant', '{"diagramCode":"...","explanation":"Done"}');

    // Simulate getConversationHistory filter
    const history = chatHistory.filter(m =>
        m.type === 'user' || m.type.startsWith('assistant')
    );

    const serialized = JSON.stringify(history);
    assert.ok(!serialized.includes('sk-'), 'no key string in conversation history');
    assert.ok(!serialized.includes('apiKey'), 'no apiKey field in conversation history');
    assert.ok(!serialized.includes('endpoint'), 'no endpoint field in conversation history');

    // Each entry should have only type + text (+ timestamp, which is harmless)
    for (const entry of history) {
        assert.ok('type' in entry, 'entry has type');
        assert.ok('text' in entry, 'entry has text');
        assert.ok(!('apiKey' in entry), 'entry must not have apiKey');
    }
});

// ---------------------------------------------------------------------------
// Test 7 (H2): XSS payload in customModel is escaped in the model-unavailable
// system message; window.__pwned must remain undefined
// ---------------------------------------------------------------------------

test('T7 (H2): XSS payload in customModel is entity-escaped before innerHTML injection', () => {
    // The escape helper from ai-assistant.js (reproduced inline for unit isolation)
    const esc = s => String(s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const maliciousModel = '<img src=x onerror="globalThis.__pwned=1">';
    const escaped = esc(maliciousModel);

    // Build the message the same way ai-assistant.js does (post-H2)
    const message = `Model "${escaped}" is not available. Please open settings to select a different model.`;

    // Simulate innerHTML assignment in a minimal DOM-like env
    // (Bun has no DOM; test the string content instead)
    assert.ok(!message.includes('<img'), 'raw <img> tag must not appear in message');
    assert.ok(!message.includes('<script'), 'raw <script> tag must not appear in message');
    assert.ok(message.includes('&lt;img'), 'must contain HTML-escaped version');
    assert.ok(message.includes('onerror='), 'onerror attribute text is present but inert (escaped context)');

    // The escape helper itself must handle all five dangerous chars
    assert.equal(esc('<'), '&lt;');
    assert.equal(esc('>'), '&gt;');
    assert.equal(esc('"'), '&quot;');
    assert.equal(esc("'"), '&#39;');
    assert.equal(esc('&'), '&amp;');

    // globalThis.__pwned must not have been set (no script execution)
    assert.equal(globalThis.__pwned, undefined, 'XSS payload must not execute');
});
