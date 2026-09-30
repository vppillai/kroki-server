/**
 * Map a Kroki error message to the 1-based source line it refers to.
 * Formats observed from the Kroki renderers (see tests/errorLines.test.js):
 *   plantuml  "... (line: 2)"                         0-based
 *   graphviz  "syntax error in line 3 near ';'"       1-based
 *   mermaid   "Parse error on line 3:"                1-based
 *   d2        "-:2:6: maps must be terminated"        1-based
 *   erd       "(line 2, column 5)"                    1-based
 *   nomnoml   "Parse error at line 1 column 6"        1-based
 * Returns null when no line can be found.
 */
const PATTERNS = [
    { re: /\(line:\s*(\d+)\)/, offset: 1 },                 // PlantUML (0-based)
    { re: /syntax error in line\s+(\d+)/i, offset: 0 },     // Graphviz
    { re: /parse error on line\s+(\d+)/i, offset: 0 },      // Mermaid
    { re: /(?:^|\s)-:(\d+):\d+:/, offset: 0 },              // D2
    { re: /\(line\s+(\d+),\s*column\s+\d+\)/i, offset: 0 }, // erd / parsec
    { re: /\bat line\s+(\d+)/i, offset: 0 },                // nomnoml and others
    { re: /\bline[\s:]+(\d+)/i, offset: 0 },                // generic fallback
];

export function errorLineFromMessage(message) {
    const text = String(message || '');
    for (const { re, offset } of PATTERNS) {
        const m = text.match(re);
        if (m) {
            const line = parseInt(m[1], 10) + offset;
            return line >= 1 ? line : null;
        }
    }
    return null;
}
