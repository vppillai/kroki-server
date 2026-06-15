#!/usr/bin/env bun
/**
 * DocCode Lite static-site builder.
 *
 * Usage:  bun scripts/build-lite.mjs
 * Output: _site/  (gitignored; built fresh on every CI release)
 *
 * What it does:
 *  1. Copies demoSite static assets (index.html, css/, js/ incl. js/vendor/,
 *     images/, favicon.ico) into _site/; excludes all server-only files.
 *  2. In _site/index.html:
 *     a. Injects <script src="lite-config.js"></script> before the importmap.
 *     b. Rewrites the importmap's absolute /js/vendor/ specifiers to relative
 *        js/vendor/ so the bundle works under any base path.
 *     c. Computes the SHA-256 of the rewritten importmap text and injects a
 *        <meta http-equiv="Content-Security-Policy"> using that hash.
 *  3. Writes _site/lite-config.js with window.__DOCCODE_LITE__ values.
 *  4. Writes _site/.nojekyll so GitHub Pages serves _-prefixed paths.
 *  5. Prints a manifest: files, total bytes, computed hash, and leak check.
 */

import { join, relative } from 'path';
import { readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync, existsSync, rmSync } from 'fs';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const repoRoot = new URL('..', import.meta.url).pathname;
const srcDir   = join(repoRoot, 'demoSite');
const outDir   = join(repoRoot, '_site');

// ---------------------------------------------------------------------------
// Server-only files/directories to exclude (relative to demoSite/)
// ---------------------------------------------------------------------------
const EXCLUDE_NAMES = new Set([
    'server.py', 'gunicorn.conf.py', 'Dockerfile', '.dockerignore',
    'requirements.txt', 'requirements-dev.txt', 'conftest.py',
    'ai-models.json', 'ai-assistant-spec.md', 'package.json',
    '.omc',
]);
const EXCLUDE_DIRS = new Set(['tests', '__pycache__', '.omc', 'scripts']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isServerOnly(name) {
    if (EXCLUDE_NAMES.has(name)) return true;
    if (name.endsWith('.py')) return true;
    return false;
}

/**
 * Recursively copy srcPath → destPath, skipping excluded entries.
 * Returns array of { path, size } for each file written.
 */
function copyDir(srcPath, destPath) {
    const written = [];
    mkdirSync(destPath, { recursive: true });

    for (const entry of readdirSync(srcPath)) {
        if (isServerOnly(entry)) continue;
        const src  = join(srcPath, entry);
        const dest = join(destPath, entry);
        const st   = statSync(src);

        if (st.isDirectory()) {
            if (EXCLUDE_DIRS.has(entry)) continue;
            written.push(...copyDir(src, dest));
        } else {
            copyFileSync(src, dest);
            written.push({ path: relative(outDir, dest), size: st.size });
        }
    }
    return written;
}

// ---------------------------------------------------------------------------
// Read VERSION from .env.example
// ---------------------------------------------------------------------------
async function readVersion() {
    try {
        const envExample = Bun.file(join(repoRoot, '.env.example'));
        const text = await envExample.text();
        const m = text.match(/^VERSION=(.+)$/m);
        return m ? m[1].trim() : 'unknown';
    } catch {
        return 'unknown';
    }
}

// ---------------------------------------------------------------------------
// SHA-256 of a string → base64
// ---------------------------------------------------------------------------
function sha256base64(text) {
    return new Bun.CryptoHasher('sha256').update(text).digest('base64');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const version = await readVersion();

// 1. Clean and recreate _site/
console.log('Building DocCode Lite → _site/');
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// 2. Copy static assets
const manifest = copyDir(srcDir, outDir);

// 3. Rewrite _site/index.html
const indexPath = join(outDir, 'index.html');
let html = await Bun.file(indexPath).text();

// 3a. Inject lite-config.js BEFORE the importmap script tag
//     (must be before the importmap so __DOCCODE_LITE__ is set when modules load)
html = html.replace(
    /(<script type="importmap">)/,
    '<script src="lite-config.js"></script>\n    $1'
);

// 3b. Rewrite absolute /js/vendor/ paths to relative ./js/vendor/ in the importmap.
//     Import-map addresses MUST be a URL or begin with /, ./, or ../ — a bare
//     "js/vendor/x.js" is parsed as a bare specifier and ignored by the browser,
//     breaking module resolution. The leading ./ makes the map resolve correctly
//     under any base path (e.g. the /kroki-server/ project-pages subpath).
html = html.replace(
    /(<script type="importmap">)([\s\S]*?)(<\/script>)/,
    (_, open, content, close) => {
        const rel = content.replaceAll('"/js/vendor/', '"./js/vendor/');
        return `${open}${rel}${close}`;
    }
);

// 3c. Extract the (now-rewritten) importmap text for hashing
const importmapMatch = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
if (!importmapMatch) {
    console.error('ERROR: importmap not found in index.html');
    process.exit(1);
}
const importmapText = importmapMatch[1];
const importmapHash = `sha256-${sha256base64(importmapText)}`;

// 3d. Inject CSP meta tag into <head> (after <meta charset>)
const csp = [
    `default-src 'self'`,
    `script-src 'self' '${importmapHash}'`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: blob:`,
    `connect-src 'self' https:`,
    `frame-src 'self' https://embed.diagrams.net`,
    `object-src 'none'`,
    `base-uri 'self'`,
].join('; ');

const cspMeta = `    <meta http-equiv="Content-Security-Policy" content="${csp}">`;
html = html.replace(
    /(<meta charset="UTF-8">)/,
    `$1\n${cspMeta}`
);

writeFileSync(indexPath, html, 'utf8');

// Update manifest entry for index.html (size changed)
const idxEntry = manifest.find(e => e.path === 'index.html');
if (idxEntry) idxEntry.size = Buffer.byteLength(html, 'utf8');

// 4. Write lite-config.js
const liteConfigContent = `// DocCode Lite runtime hook — injected by scripts/build-lite.mjs
// Sets the render base to kroki.io and forces BYOK AI mode.
// The key is stored only in the browser and never sent to DocCode servers.
window.__DOCCODE_LITE__ = {
    krokiBase: "https://kroki.io",
    aiMode: "byok",
    version: "${version}"
};
`;
const liteConfigPath = join(outDir, 'lite-config.js');
writeFileSync(liteConfigPath, liteConfigContent, 'utf8');
manifest.push({ path: 'lite-config.js', size: Buffer.byteLength(liteConfigContent, 'utf8') });

// 5. Write .nojekyll
const nojekyllPath = join(outDir, '.nojekyll');
writeFileSync(nojekyllPath, '', 'utf8');
manifest.push({ path: '.nojekyll', size: 0 });

// ---------------------------------------------------------------------------
// Manifest & leak check
// ---------------------------------------------------------------------------
const totalBytes = manifest.reduce((s, e) => s + e.size, 0);
const serverOnlyPatterns = /\.(py)$|^(server\.py|gunicorn\.conf\.py|Dockerfile|requirements.*\.txt|conftest\.py|ai-models\.json)$/;

console.log('\n=== Build Manifest ===');
console.log(`Files: ${manifest.length}  Total: ${(totalBytes / 1024).toFixed(1)} KB`);
console.log(`Importmap SHA-256: ${importmapHash}`);
console.log(`Version: ${version}`);

// Leak check
const leaks = manifest.filter(e => serverOnlyPatterns.test(e.path));
if (leaks.length > 0) {
    console.error('\nERROR: server-only files leaked into _site/:');
    leaks.forEach(e => console.error(`  ${e.path}`));
    process.exit(1);
}

// Verify lite-config.js is present
if (!manifest.find(e => e.path === 'lite-config.js')) {
    console.error('ERROR: lite-config.js missing from _site/');
    process.exit(1);
}

// Verify .nojekyll
if (!manifest.find(e => e.path === '.nojekyll')) {
    console.error('ERROR: .nojekyll missing from _site/');
    process.exit(1);
}

// Verify importmap is relative in output
const builtHtml = await Bun.file(indexPath).text();
if (builtHtml.includes('"/js/vendor/')) {
    console.error('ERROR: _site/index.html still contains absolute /js/vendor/ paths');
    process.exit(1);
}
if (!builtHtml.includes('"./js/vendor/')) {
    console.error('ERROR: _site/index.html importmap does not contain relative ./js/vendor/ paths');
    process.exit(1);
}

// Verify CSP meta is present with correct hash
if (!builtHtml.includes(`'${importmapHash}'`)) {
    console.error('ERROR: CSP meta tag with importmap hash not found in _site/index.html');
    process.exit(1);
}

// Verify lite-config.js script tag is injected
if (!builtHtml.includes('src="lite-config.js"')) {
    console.error('ERROR: lite-config.js script tag not injected into _site/index.html');
    process.exit(1);
}

console.log('\n=== Checks ===');
console.log('  No server-only files leaked: PASS');
console.log('  Importmap is relative:       PASS');
console.log('  CSP hash injected:           PASS');
console.log('  lite-config.js present:      PASS');
console.log('  .nojekyll present:           PASS');
console.log('\nBuild complete: _site/');
