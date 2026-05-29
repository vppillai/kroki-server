import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTypingContext } from '../js/modules/keyboard.js';

// Minimal element stub matching the DOM surface isTypingContext uses.
function el({ tagName = 'DIV', isContentEditable = false, cmEditor = false } = {}) {
    return {
        tagName,
        isContentEditable,
        closest(sel) { return sel === '.cm-editor' && cmEditor ? {} : null; },
    };
}

test('plain div is not a typing context', () => {
    assert.equal(isTypingContext(el({ tagName: 'DIV' })), false);
});

test('textarea is a typing context', () => {
    assert.equal(isTypingContext(el({ tagName: 'TEXTAREA' })), true);
});

test('input is a typing context', () => {
    assert.equal(isTypingContext(el({ tagName: 'INPUT' })), true);
});

test('contenteditable element is a typing context', () => {
    assert.equal(isTypingContext(el({ isContentEditable: true })), true);
});

test('element inside CodeMirror (.cm-editor) is a typing context', () => {
    assert.equal(isTypingContext(el({ tagName: 'DIV', cmEditor: true })), true);
});

test('select is a typing context (letter keys drive type-ahead)', () => {
    assert.equal(isTypingContext(el({ tagName: 'SELECT' })), true);
});

test('null target is not a typing context', () => {
    assert.equal(isTypingContext(null), false);
});
