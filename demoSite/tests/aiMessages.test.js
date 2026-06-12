import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessages, mapHistory, DEFAULT_HISTORY_CAP } from '../js/modules/aiMessages.js';

test('builds [system, current-user] with no history', () => {
    const m = buildMessages('SYS', 'hello', []);
    assert.deepEqual(m, [
        { role: 'system', content: 'SYS' },
        { role: 'user', content: 'hello' },
    ]);
});

test('omits the system message when empty', () => {
    const m = buildMessages('', 'hi', []);
    assert.deepEqual(m, [{ role: 'user', content: 'hi' }]);
});

test('includes history in order and excludes system/status turns', () => {
    const history = [
        { type: 'user', text: 'first' },
        { type: 'assistant', text: 'reply1' },
        { type: 'system', text: 'Request cancelled' },
        { type: 'user', text: 'second' },
        { type: 'assistant', text: 'reply2' },
    ];
    const m = buildMessages('SYS', 'now', history);
    assert.deepEqual(m, [
        { role: 'system', content: 'SYS' },
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'reply1' },
        { role: 'user', content: 'second' },
        { role: 'assistant', content: 'reply2' },
        { role: 'user', content: 'now' },
    ]);
});

test('caps history to the last N messages', () => {
    const history = [];
    for (let i = 0; i < 30; i++) history.push({ type: i % 2 ? 'assistant' : 'user', text: `m${i}` });
    const m = buildMessages('SYS', 'now', history, 4);
    // system + 4 history + current = 6
    assert.equal(m.length, 6);
    assert.deepEqual(m.slice(1, 5).map(x => x.content), ['m26', 'm27', 'm28', 'm29']);
});

test('includes styled assistant turns (assistant-success/-warning/-error) as assistant role', () => {
    // Successful AI replies are stored as 'assistant-success' etc. via
    // displayMessage(); the model must still see its own prior answers.
    const history = [
        { type: 'user', text: 'draw a cat' },
        { type: 'assistant-success', text: 'Created the cat diagram.' },
        { type: 'user', text: 'add a dog' },
        { type: 'assistant-warning', text: 'Added the dog (may have issues).' },
        { type: 'assistant-error', text: 'Something failed.' },
    ];
    const mapped = mapHistory(history);
    assert.deepEqual(mapped, [
        { role: 'user', content: 'draw a cat' },
        { role: 'assistant', content: 'Created the cat diagram.' },
        { role: 'user', content: 'add a dog' },
        { role: 'assistant', content: 'Added the dog (may have issues).' },
        { role: 'assistant', content: 'Something failed.' },
    ]);
});

test('mapHistory drops blank and non-string turns', () => {
    const mapped = mapHistory([
        { type: 'user', text: '  ' },
        { type: 'user', text: 'ok' },
        { type: 'assistant', text: 42 },
    ]);
    assert.deepEqual(mapped, [{ role: 'user', content: 'ok' }]);
});

test('DEFAULT_HISTORY_CAP is a sane positive number', () => {
    assert.ok(DEFAULT_HISTORY_CAP > 0 && DEFAULT_HISTORY_CAP <= 50);
});
