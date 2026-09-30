import { test, expect } from 'bun:test';
import { errorLineFromMessage } from '../js/modules/errorLines.js';

// Messages captured from the production Kroki backends on 2026-09-30.
test.each([
    ['plantuml', 'Error 400: Syntax Error? (Assumed diagram type: sequence) (line: 2)', 3],
    ['graphviz', "Error 400: Error: <stdin>: syntax error in line 3 near ';'  (exit code 1)", 3],
    ['mermaid', 'Error 400: SyntaxError: Parse error on line 3: ...aph TD A-->B', 3],
    ['d2', 'Error 400: err: failed to compile -: -:2:1: connection missing destination', 2],
    ['erd', 'Error 400: "<stdin>" (line 2, column 5): unexpected \'b\'', 2],
    ['nomnoml', 'ParseError: Parse error at line 1 column 6, expected "]"', 1],
])('%s error maps to line %#', (_type, msg, line) => {
    expect(errorLineFromMessage(msg)).toBe(line);
});

test('no line number -> null', () => {
    expect(errorLineFromMessage('HTTP 503: service unavailable')).toBeNull();
    expect(errorLineFromMessage('')).toBeNull();
    expect(errorLineFromMessage(undefined)).toBeNull();
});
