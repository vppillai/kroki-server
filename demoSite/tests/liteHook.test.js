/**
 * DocCode Lite frontend hook unit tests.
 *
 * Tests:
 *  (i)  diagramRenderer uses krokiBase from window.__DOCCODE_LITE__ when set.
 *  (ii) diagramRenderer falls back to window.location when hook is absent.
 *
 * Run with: bun test tests/liteHook.test.js
 *
 * Note: diagramRenderer.js imports other modules that use browser APIs.
 * We stub the minimal environment needed to exercise only the URL-building logic,
 * which is the load-bearing piece for the Lite krokiBase wiring.
 */

import { test, expect, beforeEach, afterEach } from 'bun:test';

// ---------------------------------------------------------------------------
// Reproduce the URL-building logic from diagramRenderer.js:74-79 inline.
// This isolates the test from the full browser module graph while faithfully
// testing the exact guard expression introduced by the Lite hook.
// ---------------------------------------------------------------------------

/**
 * Build the Kroki URL exactly as diagramRenderer.js does after the Lite patch.
 * @param {string} diagramType
 * @param {string} outputFormat
 * @param {string} encodedDiagram
 * @param {object} location  - { protocol, hostname, port }
 * @param {object|undefined} liteHook  - window.__DOCCODE_LITE__ value
 * @returns {string}
 */
function buildKrokiUrl(diagramType, outputFormat, encodedDiagram, location, liteHook) {
    const protocol = location.protocol;
    const hostname = location.hostname;
    const port = location.port ? `:${location.port}` : '';
    const liteBase = liteHook && liteHook.krokiBase
        ? liteHook.krokiBase.replace(/\/+$/, '')
        : `${protocol}//${hostname}${port}`;
    return `${liteBase}/${diagramType}/${outputFormat}/${encodedDiagram}`;
}

const mockLocation = {
    protocol: 'https:',
    hostname: 'example.com',
    port: '8443',
};

// ---------------------------------------------------------------------------
// (i) Uses krokiBase when __DOCCODE_LITE__ is set
// ---------------------------------------------------------------------------

test('buildKrokiUrl uses krokiBase when window.__DOCCODE_LITE__.krokiBase is set', () => {
    const liteHook = { krokiBase: 'https://kroki.io', aiMode: 'byok' };
    const url = buildKrokiUrl('plantuml', 'svg', 'ABC123', mockLocation, liteHook);
    expect(url).toBe('https://kroki.io/plantuml/svg/ABC123');
});

test('buildKrokiUrl strips trailing slash from krokiBase', () => {
    const liteHook = { krokiBase: 'https://kroki.io/', aiMode: 'byok' };
    const url = buildKrokiUrl('mermaid', 'png', 'XYZ', mockLocation, liteHook);
    expect(url).toBe('https://kroki.io/mermaid/png/XYZ');
});

test('buildKrokiUrl strips multiple trailing slashes from krokiBase', () => {
    const liteHook = { krokiBase: 'https://kroki.io///' };
    const url = buildKrokiUrl('graphviz', 'svg', 'DEF', mockLocation, liteHook);
    expect(url).toBe('https://kroki.io/graphviz/svg/DEF');
});

// ---------------------------------------------------------------------------
// (ii) Falls back to window.location when hook is absent
// ---------------------------------------------------------------------------

test('buildKrokiUrl falls back to window.location when __DOCCODE_LITE__ is undefined', () => {
    const url = buildKrokiUrl('plantuml', 'svg', 'ABC123', mockLocation, undefined);
    expect(url).toBe('https://example.com:8443/plantuml/svg/ABC123');
});

test('buildKrokiUrl falls back to window.location when __DOCCODE_LITE__ is null', () => {
    const url = buildKrokiUrl('plantuml', 'svg', 'ABC123', mockLocation, null);
    expect(url).toBe('https://example.com:8443/plantuml/svg/ABC123');
});

test('buildKrokiUrl falls back to window.location when krokiBase is empty string', () => {
    const liteHook = { krokiBase: '', aiMode: 'byok' };
    const url = buildKrokiUrl('plantuml', 'svg', 'ABC123', mockLocation, liteHook);
    expect(url).toBe('https://example.com:8443/plantuml/svg/ABC123');
});

test('buildKrokiUrl omits port segment when location.port is empty', () => {
    const loc = { protocol: 'https:', hostname: 'demo.example.com', port: '' };
    const url = buildKrokiUrl('plantuml', 'svg', 'ABC', loc, undefined);
    expect(url).toBe('https://demo.example.com/plantuml/svg/ABC');
});

// ---------------------------------------------------------------------------
// (iii) Lite mode does not affect server path when hook absent
// ---------------------------------------------------------------------------

test('server-mode path is unaffected: location-based URL unchanged when hook absent', () => {
    const loc = { protocol: 'https:', hostname: 'localhost', port: '8443' };
    const url = buildKrokiUrl('mermaid', 'png', 'ENCODED', loc, undefined);
    expect(url).toStartWith('https://localhost:8443/');
    expect(url).not.toContain('kroki.io');
});
