import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Stub the browser globals config.js touches before importing it.
globalThis.window = undefined;
const store = {};
globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
};

const { ConfigManager, DEFAULT_CONFIG } = await import('../js/config.js');

beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

test('setting a nested value does not mutate DEFAULT_CONFIG', () => {
    const original = DEFAULT_CONFIG.editor.fontSize;
    const cm = new ConfigManager();
    cm.set('editor.fontSize', original + 7);
    assert.equal(DEFAULT_CONFIG.editor.fontSize, original,
        'DEFAULT_CONFIG.editor.fontSize must be unchanged after set()');
});

test('reset() does not mutate DEFAULT_CONFIG.ai.model', () => {
    const original = DEFAULT_CONFIG.ai.model;
    const cm = new ConfigManager();
    cm.reset({ ai: { model: 'some/other-model' } });
    assert.equal(DEFAULT_CONFIG.ai.model, original,
        'DEFAULT_CONFIG.ai.model must be unchanged after reset() with server defaults');
});

test('PARTIAL stored config (mergeConfig path) does not share refs with DEFAULT_CONFIG', () => {
    // Reproduces the surviving bug: a partial stored config leaves nested
    // defaults as live references unless mergeConfig deep-clones the base.
    const original = DEFAULT_CONFIG.editor.fontSize;
    store[ 'kroki-user-config' ] = JSON.stringify({ theme: 'dark' });
    const cm = new ConfigManager();
    assert.notEqual(cm.config.editor, DEFAULT_CONFIG.editor,
        'cm.config.editor must be a clone, not the same object as DEFAULT_CONFIG.editor');
    cm.set('editor.fontSize', original + 50);
    assert.equal(DEFAULT_CONFIG.editor.fontSize, original,
        'DEFAULT_CONFIG.editor.fontSize must be unchanged after a partial-load + set()');
});

test('set() with a string value does not throw when window is undefined', () => {
    const cm = new ConfigManager();
    assert.doesNotThrow(() => cm.set('theme', 'dark'));
    assert.equal(cm.get('theme'), 'dark');
});
