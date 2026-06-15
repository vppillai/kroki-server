/**
 * CSP inline-handler regression guard.
 *
 * The deployment CSP (both the nginx server build and the Lite <meta> build) uses
 * `script-src 'self' '<hash>'` with NO 'unsafe-inline'. Inline event-handler
 * attributes (onclick=, onsubmit=, ...) are therefore BLOCKED by the browser —
 * hashes do not apply to event handlers. Any inline handler in app-authored HTML
 * (static or injected via innerHTML) silently fails.
 *
 * These tests assert the app-authored files contain no inline handler attributes
 * and that the AI message buttons are wired via delegated data-ai-action instead.
 * (Vendored bundles in js/vendor/ are third-party and out of scope.)
 */
import { test, expect } from 'bun:test';
import { join } from 'path';
import { readFileSync } from 'fs';

const jsDir = join(import.meta.dir, '..', 'js');

// App-authored files that build HTML strings or static markup.
const APP_FILES = [
    'ai-assistant.js',
    'config-ui-templates.js',
    'config-ui.js',
    'modules/drawioIntegration.js',
    'config-ui-models.js',
];

// Matches an inline handler ATTRIBUTE (on<event>="...") but not a JS property
// assignment (el.onclick = fn — which has a space before '=' and/or a leading dot).
const INLINE_HANDLER = /\bon(click|submit|change|input|load|error|mouse[a-z]+|key[a-z]+|focus|blur)=["']/;

for (const rel of APP_FILES) {
    test(`${rel} has no CSP-blocked inline event-handler attributes`, () => {
        const src = readFileSync(join(jsDir, rel), 'utf8');
        const offenders = src.split('\n')
            .map((line, i) => ({ line: line.trim(), n: i + 1 }))
            .filter(({ line }) => INLINE_HANDLER.test(line));
        expect(offenders, `inline handler(s) in ${rel}: ${JSON.stringify(offenders)}`).toEqual([]);
    });
}

test('AI message buttons are wired via delegated data-ai-action', () => {
    const src = readFileSync(join(jsDir, 'ai-assistant.js'), 'utf8');
    // The injected buttons declare data-ai-action ...
    expect(src).toContain('data-ai-action="open-settings"');
    expect(src).toContain('data-ai-action="open-openrouter-settings"');
    // ... and a single delegated listener resolves them.
    expect(src).toContain("closest('[data-ai-action]')");
});

test('about-panel favicon uses a relative src (resolves under any base path)', () => {
    const src = readFileSync(join(jsDir, 'config-ui-templates.js'), 'utf8');
    expect(src).not.toContain('src="/favicon.ico"');
    expect(src).toContain('src="favicon.ico"');
});
