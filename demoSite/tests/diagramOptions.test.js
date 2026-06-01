import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagramOptionsQuery, diagramOptionsObject } from '../js/modules/diagramOptions.js';

// GoAT emits a prefers-color-scheme-adaptive SVG that renders white in OS dark
// mode, colliding with the editor's dark-mode handling (it showed as a black
// square in production). We force GoAT's dark-scheme color to black via Kroki's
// `svg-color-dark-scheme` render option so it renders like every other diagram.

test('goat gets svg-color-dark-scheme forced to black, URL-encoded', () => {
    assert.equal(diagramOptionsQuery('goat'), '?svg-color-dark-scheme=%23000000');
});

test('the # in the color is URL-encoded as %23 (must not break the URL)', () => {
    assert.ok(diagramOptionsQuery('goat').includes('%23'));
    assert.ok(!diagramOptionsQuery('goat').includes('#'));
});

test('types without special options get no query string', () => {
    for (const t of ['plantuml', 'graphviz', 'mermaid', 'd2', 'bpmn']) {
        assert.equal(diagramOptionsQuery(t), '', `${t} should have no options`);
    }
});

test('diagramOptionsObject returns the options map for goat (JSON POST body)', () => {
    assert.deepEqual(diagramOptionsObject('goat'), { 'svg-color-dark-scheme': '#000000' });
});

test('diagramOptionsObject returns null for types without options', () => {
    assert.equal(diagramOptionsObject('plantuml'), null);
    assert.equal(diagramOptionsObject('graphviz'), null);
});
