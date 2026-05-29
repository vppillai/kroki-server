import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretSSEData } from '../js/modules/aiStream.js';

test('[DONE] sentinel', () => {
    assert.deepEqual(interpretSSEData('[DONE]'), { kind: 'done' });
});

test('content delta', () => {
    const d = JSON.stringify({ choices: [{ delta: { content: 'Hel' } }] });
    assert.deepEqual(interpretSSEData(d), { kind: 'content', value: 'Hel' });
});

test('nested error frame surfaces the provider message', () => {
    const d = JSON.stringify({ error: { message: 'rate limited' } });
    assert.deepEqual(interpretSSEData(d), { kind: 'error', value: 'rate limited' });
});

test('string error frame', () => {
    const d = JSON.stringify({ error: 'boom' });
    assert.deepEqual(interpretSSEData(d), { kind: 'error', value: 'boom' });
});

test('finish_reason error', () => {
    const d = JSON.stringify({ choices: [{ finish_reason: 'error', delta: {} }] });
    assert.equal(interpretSSEData(d).kind, 'error');
});

test('non-JSON payload is skipped, not fatal', () => {
    assert.deepEqual(interpretSSEData('not json'), { kind: 'skip' });
});

test('empty/absent content delta is skipped', () => {
    const d = JSON.stringify({ choices: [{ delta: { role: 'assistant' } }] });
    assert.deepEqual(interpretSSEData(d), { kind: 'skip' });
});

test('reasoning-only delta (no content) is skipped', () => {
    const d = JSON.stringify({ choices: [{ delta: { reasoning: 'thinking' } }] });
    assert.deepEqual(interpretSSEData(d), { kind: 'skip' });
});
