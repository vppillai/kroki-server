import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractDiagramJson } from '../js/modules/aiResponseParser.js';

test('parses plain JSON', () => {
    const out = extractDiagramJson('{"diagramCode":"A->B","explanation":"hi"}');
    assert.equal(out.diagramCode, 'A->B');
    assert.equal(out.explanation, 'hi');
});

test('parses JSON whose diagramCode contains closing braces (the core bug)', () => {
    const code = 'digraph { a -> b; subgraph { c } }';
    const raw = JSON.stringify({ diagramCode: code, explanation: 'a graph' });
    const out = extractDiagramJson(raw);
    assert.equal(out.diagramCode, code);
    assert.equal(out.explanation, 'a graph');
});

test('strips ```json code fences', () => {
    const raw = '```json\n{"diagramCode":"x{y}","explanation":"e"}\n```';
    const out = extractDiagramJson(raw);
    assert.equal(out.diagramCode, 'x{y}');
});

test('handles leading prose before a fenced object', () => {
    const raw = 'Here you go:\n```json\n{"diagramCode":"g{1}","explanation":"e"}\n```';
    const out = extractDiagramJson(raw);
    assert.equal(out.diagramCode, 'g{1}');
});

test('handles braces inside string values without miscounting', () => {
    const raw = '{"diagramCode":"label = \\"a{b}c\\"","explanation":"e"}';
    const out = extractDiagramJson(raw);
    assert.equal(out.diagramCode, 'label = "a{b}c"');
});

test('returns null when no usable object is present', () => {
    assert.equal(extractDiagramJson('sorry, I cannot help'), null);
});

test('skips a decoy/example object emitted before the real answer', () => {
    const raw = 'For example {"foo":1}. Here is your diagram:\n{"diagramCode":"digraph{a->b}","explanation":"done"}';
    const out = extractDiagramJson(raw);
    assert.equal(out.diagramCode, 'digraph{a->b}');
    assert.equal(out.explanation, 'done');
});

test('ignores brace-notation prose before the real object', () => {
    const raw = 'The set {a, b} is shown.\n{"diagramCode":"d{1}","explanation":"e"}';
    const out = extractDiagramJson(raw);
    assert.equal(out.diagramCode, 'd{1}');
});

test('skips a decoy fenced object before the real fenced JSON', () => {
    const raw = 'Example: ```json\n{"note":"ignore me"}\n``` Answer: ```json\n{"diagramCode":"g{2}","explanation":"ok"}\n```';
    const out = extractDiagramJson(raw);
    assert.equal(out.diagramCode, 'g{2}');
});
