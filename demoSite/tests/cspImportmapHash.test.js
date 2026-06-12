/**
 * CSP import-map hash drift guard.
 *
 * nginx serves a Content-Security-Policy with script-src 'self' plus the
 * SHA-256 hash of the inline import map in index.html (inline import maps are
 * CSP script elements). The hash in setup-kroki-server.sh is a literal, so any
 * edit to the import map — even whitespace — must update it. These tests fail
 * the moment the two files disagree, before a browser ever sees a broken CSP.
 */
import { test, expect } from "bun:test";
import { join } from "path";

const repoRoot = join(import.meta.dir, "..", "..");
const indexHtml = await Bun.file(join(repoRoot, "demoSite", "index.html")).text();
const setupScript = await Bun.file(join(repoRoot, "setup-kroki-server.sh")).text();

function importmapContent() {
    const m = indexHtml.match(/<script type="importmap">([\s\S]*?)<\/script>/);
    expect(m).not.toBeNull();
    return m[1];
}

test("CSP hash in setup-kroki-server.sh matches the import map in index.html", () => {
    const expected =
        "sha256-" +
        new Bun.CryptoHasher("sha256").update(importmapContent()).digest("base64");
    const declared = setupScript.match(/IMPORTMAP_SHA256="([^"]+)"/);
    expect(declared).not.toBeNull();
    expect(declared[1]).toBe(expected);
});

test("CSP header line actually uses the IMPORTMAP_SHA256 variable", () => {
    expect(setupScript).toContain("script-src 'self' '${IMPORTMAP_SHA256}'");
});

test("the import map is the only inline script in index.html", () => {
    // script-src allows exactly 'self' + the import-map hash. Any new inline
    // script would be silently blocked by CSP — force the author here first.
    const tags = [...indexHtml.matchAll(/<script\b[^>]*>/g)].map((t) => t[0]);
    const inline = tags.filter((t) => !/\bsrc\s*=/.test(t));
    expect(inline).toEqual(['<script type="importmap">']);
});

test("import map references only same-origin vendored paths", () => {
    const imports = JSON.parse(importmapContent()).imports;
    for (const [specifier, target] of Object.entries(imports)) {
        expect(target.startsWith("/js/vendor/"), `${specifier} -> ${target}`).toBe(true);
    }
});
