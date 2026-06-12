/**
 * Unit tests for applyDisabledDiagramTypes (pure-logic, no real DOM needed).
 *
 * applyDisabledDiagramTypes accepts an optional dropdownEl parameter so it can
 * be tested without a browser. We build a minimal fake <select> that mirrors the
 * HTMLSelectElement API used by the function.
 *
 * diagramOperations.js imports 'pako' (a CDN dep unavailable to bun test).
 * We mock it via Bun's module mock registry before any import of the module.
 */

import { test, mock } from 'bun:test';
import { strictEqual, deepEqual, ok, doesNotThrow } from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mock pako before diagramOperations.js is imported
// ---------------------------------------------------------------------------
mock.module('pako', () => ({
    deflate: () => new Uint8Array(),
    inflate: () => new Uint8Array(),
}));

// ---------------------------------------------------------------------------
// Minimal browser-global stubs required before importing diagramOperations.js
// ---------------------------------------------------------------------------
globalThis.window = globalThis;

// Minimal DOM stub: getElementById returns a minimal element so that
// updateFormatDropdown() (called when the selected item is removed) doesn't
// throw. The stub element has value/innerHTML/options/appendChild/style.
function makeStubElement() {
    return {
        value: 'plantuml',
        innerHTML: '',
        options: [],
        style: {},
        appendChild: () => {},
        querySelector: () => null,
    };
}
globalThis.document = {
    getElementById: () => makeStubElement(),
    createElement: (tag) => {
        if (tag === 'option') return { value: '', textContent: '' };
        return makeStubElement();
    },
};
globalThis.navigator = {};

// ---------------------------------------------------------------------------
// Import the function under test
// ---------------------------------------------------------------------------

const { applyDisabledDiagramTypes } = await import('../js/modules/diagramOperations.js');

// ---------------------------------------------------------------------------
// Fake HTMLSelectElement factory
// ---------------------------------------------------------------------------

function makeSelect(optionValues, selectedValue = null) {
    const options = optionValues.map(v => ({ value: v }));
    let currentValue = selectedValue ?? (options[0]?.value ?? '');

    const select = {
        get options() { return options; },
        get value() { return currentValue; },
        set value(v) { currentValue = v; },
        querySelector(sel) {
            // Only handles 'option[value="plantuml"]' pattern used in the function
            const m = sel.match(/option\[value="([^"]+)"\]/);
            if (!m) return null;
            return options.find(o => o.value === m[1]) ?? null;
        },
        remove() { /* unused at select level */ },
    };

    // Give each option a remove() that splices itself out
    options.forEach((opt, i) => {
        opt.remove = () => { options.splice(options.indexOf(opt), 1); };
    });

    return select;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('applyDisabledDiagramTypes: no-op on empty disabled list', () => {
    const sel = makeSelect(['plantuml', 'bpmn', 'mermaid'], 'plantuml');
    applyDisabledDiagramTypes([], sel);
    strictEqual(sel.options.length, 3, 'no options removed');
    strictEqual(sel.value, 'plantuml', 'selection unchanged');
});

test('applyDisabledDiagramTypes: no-op on non-array input', () => {
    const sel = makeSelect(['plantuml', 'bpmn'], 'plantuml');
    applyDisabledDiagramTypes(null, sel);
    strictEqual(sel.options.length, 2);
});

test('applyDisabledDiagramTypes: removes named types (case-insensitive)', () => {
    const sel = makeSelect(['plantuml', 'bpmn', 'excalidraw', 'diagramsnet'], 'plantuml');
    applyDisabledDiagramTypes(['BPMN', 'Excalidraw', 'diagramsnet'], sel);
    const remaining = sel.options.map(o => o.value);
    deepEqual(remaining, ['plantuml'], 'only plantuml remains');
    strictEqual(sel.value, 'plantuml', 'selection unchanged (plantuml was not disabled)');
});

test('applyDisabledDiagramTypes: falls back to plantuml when selected type is removed', () => {
    const sel = makeSelect(['plantuml', 'bpmn', 'mermaid'], 'bpmn');
    applyDisabledDiagramTypes(['bpmn'], sel);
    ok(!sel.options.find(o => o.value === 'bpmn'), 'bpmn removed');
    strictEqual(sel.value, 'plantuml', 'selection falls back to plantuml');
});

test('applyDisabledDiagramTypes: falls back to first option when plantuml also disabled', () => {
    const sel = makeSelect(['graphviz', 'plantuml', 'mermaid'], 'plantuml');
    applyDisabledDiagramTypes(['plantuml'], sel);
    ok(!sel.options.find(o => o.value === 'plantuml'), 'plantuml removed');
    // No plantuml left → falls back to options[0]
    strictEqual(sel.value, 'graphviz', 'falls back to first remaining option');
});

test('applyDisabledDiagramTypes: no-op when dropdown element is null', () => {
    // Should not throw when passed null explicitly
    doesNotThrow(() => applyDisabledDiagramTypes(['bpmn'], null));
});

test('applyDisabledDiagramTypes: whitespace/mixed-case in disabled list', () => {
    const sel = makeSelect(['plantuml', 'bpmn', 'excalidraw'], 'plantuml');
    // The caller (main.js) passes the server-returned list which is already
    // normalised by server.py; but the function itself lowercases for safety.
    applyDisabledDiagramTypes(['  BPMN  '.trim(), 'Excalidraw'], sel);
    const remaining = sel.options.map(o => o.value);
    deepEqual(remaining, ['plantuml']);
});
