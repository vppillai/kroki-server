/**
 * DocCode Lite — build-output verification tests.
 *
 * Self-contained: builds _site/ via scripts/build-lite.mjs in beforeAll, so
 * these run identically in CI (where _site/ is gitignored and absent) and
 * locally. They assert:
 *  (i)   the meta CSP hash in _site/index.html EXACTLY matches the SHA-256 of
 *        the post-rewrite importmap text (drift sentinel);
 *  (ii)  importmap paths are relative (no /js/vendor/);
 *  (iii) lite-config.js is injected before the importmap;
 *  (iv)  lite-config.js sets krokiBase=https://kroki.io and aiMode=byok;
 *  (v)   lite-config.js version matches .env.example VERSION;
 *  (vi)  no server-only files leaked into _site/;
 *  (vii) .nojekyll is present;
 *  (viii) core static assets are present.
 */

import { test, expect, beforeAll } from 'bun:test';
import { join, resolve } from 'path';
import { existsSync, readdirSync, statSync, readFileSync } from 'fs';

const repoRoot = resolve(join(import.meta.dir, '..', '..'));
const siteDir = join(repoRoot, '_site');
const indexPath = join(siteDir, 'index.html');

let html;

// Build _site/ before any assertion so the tests are self-contained and never
// depend on a prior manual `bun scripts/build-lite.mjs`.
beforeAll(() => {
    const r = Bun.spawnSync(['bun', 'scripts/build-lite.mjs'], {
        cwd: repoRoot, stdout: 'pipe', stderr: 'pipe',
    });
    if (r.exitCode !== 0) {
        throw new Error('build-lite.mjs failed:\n' + r.stderr.toString());
    }
    html = readFileSync(indexPath, 'utf8');
});

test('_site/ directory and index.html exist after build', () => {
    expect(existsSync(siteDir)).toBe(true);
    expect(existsSync(indexPath)).toBe(true);
});

// (i) CSP hash drift sentinel ------------------------------------------------
test('meta CSP hash matches SHA-256 of the rewritten importmap', () => {
    const mapMatch = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
    expect(mapMatch).not.toBeNull();
    const mapText = mapMatch[1];

    const expected = 'sha256-' + new Bun.CryptoHasher('sha256').update(mapText).digest('base64');

    const cspMatch = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
    expect(cspMatch).not.toBeNull();
    const cspContent = cspMatch[1];

    const scriptSrcMatch = cspContent.match(/script-src\s+'self'\s+'([^']+)'/);
    expect(scriptSrcMatch).not.toBeNull();
    const declaredHash = scriptSrcMatch[1];

    expect(declaredHash).toBe(expected);
});

// (ii) importmap uses relative paths -----------------------------------------
test('importmap in _site/index.html uses relative js/vendor/ paths', () => {
    expect(html).not.toContain('"/js/vendor/');
    expect(html).toContain('"js/vendor/');
});

// (iii) lite-config.js script tag appears before the importmap ---------------
test('lite-config.js script tag is injected before the importmap', () => {
    const litePos = html.indexOf('src="lite-config.js"');
    const mapPos = html.indexOf('<script type="importmap">');
    expect(litePos).toBeGreaterThan(-1);
    expect(mapPos).toBeGreaterThan(-1);
    expect(litePos).toBeLessThan(mapPos);
});

// (iv) lite-config.js content ------------------------------------------------
test('lite-config.js sets krokiBase=https://kroki.io and aiMode=byok', async () => {
    const liteConfigPath = join(siteDir, 'lite-config.js');
    expect(existsSync(liteConfigPath)).toBe(true);
    const content = await Bun.file(liteConfigPath).text();
    expect(content).toContain('krokiBase: "https://kroki.io"');
    expect(content).toContain('aiMode: "byok"');
    expect(content).toContain('window.__DOCCODE_LITE__');
});

// (v) lite-config.js version matches .env.example VERSION --------------------
test('lite-config.js version matches .env.example VERSION', async () => {
    const envExample = await Bun.file(join(repoRoot, '.env.example')).text();
    const versionMatch = envExample.match(/^VERSION=(.+)$/m);
    expect(versionMatch).not.toBeNull();
    const expectedVersion = versionMatch[1].trim();

    const liteConfig = await Bun.file(join(siteDir, 'lite-config.js')).text();
    expect(liteConfig).toContain(`version: "${expectedVersion}"`);
});

// (vi) No server-only files leaked into _site/ -------------------------------
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

    for (const filePath of collectFiles(siteDir)) {
        const name = filePath.split('/').pop();
        expect(serverOnlyNames, `server-only file leaked: ${filePath}`).not.toContain(name);
        expect(name.endsWith('.py'), `Python file leaked: ${filePath}`).toBe(false);
    }
});

// (vii) .nojekyll is present -------------------------------------------------
test('.nojekyll is present in _site/', () => {
    expect(existsSync(join(siteDir, '.nojekyll'))).toBe(true);
});

// (viii) Core assets present (images/ lives at repo root, not in the bundle) -
test('core static assets are present in _site/', () => {
    expect(existsSync(join(siteDir, 'favicon.ico'))).toBe(true);
    expect(existsSync(join(siteDir, 'css'))).toBe(true);
    expect(existsSync(join(siteDir, 'js', 'vendor'))).toBe(true);
});
