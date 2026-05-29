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
