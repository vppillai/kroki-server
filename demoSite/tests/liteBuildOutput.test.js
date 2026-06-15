/**
 * DocCode Lite — build-output verification tests.
 *
 * Run AFTER `bun scripts/build-lite.mjs`:
 *   bun scripts/build-lite.mjs && bun test tests/liteBuildOutput.test.js
 *
 * These tests:
 *  (i)  Assert the meta CSP hash in _site/index.html EXACTLY matches the
 *       SHA-256 of the post-rewrite importmap text (drift sentinel).
 *  (ii) Assert lite-config.js sets krokiBase=https://kroki.io and aiMode=byok.
 *  (iii) Assert no server-only files are present in _site/.
 *  (iv) Assert .nojekyll is present.
 *  (v)  Assert importmap paths are relative (no /js/vendor/).
 *  (vi) Assert lite-config.js script tag is injected before the importmap.
 */

import { test, expect } from 'bun:test';
import { join, resolve } from 'path';
import { existsSync, readdirSync, statSync } from 'fs';

const repoRoot = resolve(join(import.meta.dir, '..', '..'));
const siteDir  = join(repoRoot, '_site');
const indexPath = join(siteDir, 'index.html');

// Skip gracefully if _site/ does not exist (build not yet run in this context).
const siteExists = existsSync(siteDir) && existsSync(indexPath);

test('_site/ directory and index.html exist (run build-lite.mjs first)', () => {
    expect(siteExists).toBe(true);
});

if (siteExists) {
    const html = await Bun.file(indexPath).text();

    // -----------------------------------------------------------------------
    // (i) CSP hash drift sentinel
    // -----------------------------------------------------------------------
    test('meta CSP hash matches SHA-256 of the rewritten importmap', () => {
        // Extract the rewritten importmap text
        const mapMatch = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
        expect(mapMatch).not.toBeNull();
        const mapText = mapMatch[1];

        // Recompute the expected hash
        const expected = 'sha256-' + new Bun.CryptoHasher('sha256').update(mapText).digest('base64');

        // Extract the declared hash from the meta CSP tag
        const cspMatch = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
        expect(cspMatch).not.toBeNull();
        const cspContent = cspMatch[1];

        // The script-src directive must contain exactly the expected hash
        const scriptSrcMatch = cspContent.match(/script-src\s+'self'\s+'([^']+)'/);
        expect(scriptSrcMatch).not.toBeNull();
        const declaredHash = scriptSrcMatch[1];

        expect(declaredHash).toBe(expected);
    });

    // -----------------------------------------------------------------------
    // (ii) importmap uses relative paths (no absolute /js/vendor/)
    // -----------------------------------------------------------------------
    test('importmap in _site/index.html uses relative js/vendor/ paths', () => {
        expect(html).not.toContain('"/js/vendor/');
        expect(html).toContain('"js/vendor/');
    });

    // -----------------------------------------------------------------------
    // (iii) lite-config.js script tag appears before the importmap
    // -----------------------------------------------------------------------
    test('lite-config.js script tag is injected before the importmap', () => {
        const litePos = html.indexOf('src="lite-config.js"');
        const mapPos  = html.indexOf('<script type="importmap">');
        expect(litePos).toBeGreaterThan(-1);
        expect(mapPos).toBeGreaterThan(-1);
        expect(litePos).toBeLessThan(mapPos);
    });

    // -----------------------------------------------------------------------
    // (iv) lite-config.js content
    // -----------------------------------------------------------------------
    test('lite-config.js sets krokiBase=https://kroki.io and aiMode=byok', async () => {
        const liteConfigPath = join(siteDir, 'lite-config.js');
        expect(existsSync(liteConfigPath)).toBe(true);
        const content = await Bun.file(liteConfigPath).text();
        expect(content).toContain('krokiBase: "https://kroki.io"');
        expect(content).toContain('aiMode: "byok"');
        expect(content).toContain('window.__DOCCODE_LITE__');
    });

    // -----------------------------------------------------------------------
    // (v) lite-config.js version matches .env.example VERSION
    // -----------------------------------------------------------------------
    test('lite-config.js version matches .env.example VERSION', async () => {
        const envExample = await Bun.file(join(repoRoot, '.env.example')).text();
        const versionMatch = envExample.match(/^VERSION=(.+)$/m);
        expect(versionMatch).not.toBeNull();
        const expectedVersion = versionMatch[1].trim();

        const liteConfig = await Bun.file(join(siteDir, 'lite-config.js')).text();
        expect(liteConfig).toContain(`version: "${expectedVersion}"`);
    });

    // -----------------------------------------------------------------------
    // (vi) No server-only files leaked into _site/
    // -----------------------------------------------------------------------
    test('no server-only files present in _site/', () => {
        const serverOnlyNames = [
            'server.py', 'gunicorn.conf.py', 'Dockerfile', '.dockerignore',
            'requirements.txt', 'requirements-dev.txt', 'conftest.py', 'ai-models.json',
        ];

        function collectFiles(dir) {
            const results = [];
            for (const entry of readdirSync(dir)) {
                const full = join(dir, entry);
                if (statSync(full).isDirectory()) {
                    results.push(...collectFiles(full));
                } else {
                    results.push(full);
                }
            }
            return results;
        }

        const allFiles = collectFiles(siteDir);

        for (const filePath of allFiles) {
            const name = filePath.split('/').pop();
            expect(serverOnlyNames, `server-only file leaked: ${filePath}`).not.toContain(name);
            expect(name.endsWith('.py'), `Python file leaked: ${filePath}`).toBe(false);
        }
    });

    // -----------------------------------------------------------------------
    // (vii) .nojekyll is present
    // -----------------------------------------------------------------------
    test('.nojekyll is present in _site/', () => {
        expect(existsSync(join(siteDir, '.nojekyll'))).toBe(true);
    });

    // -----------------------------------------------------------------------
    // (viii) Core assets present: css/, js/vendor/, favicon.ico
    // Note: images/ lives at the repo root, not inside demoSite/, so it is
    // not part of the demoSite static bundle.
    // -----------------------------------------------------------------------
    test('core static assets are present in _site/', () => {
        expect(existsSync(join(siteDir, 'favicon.ico'))).toBe(true);
        expect(existsSync(join(siteDir, 'css'))).toBe(true);
        expect(existsSync(join(siteDir, 'js', 'vendor'))).toBe(true);
    });
}
