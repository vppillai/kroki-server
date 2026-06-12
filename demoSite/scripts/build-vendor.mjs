#!/usr/bin/env bun
/**
 * Vendor bundle builder for DocCode demoSite.
 *
 * Strategy: "external-chain" bundling to preserve the @codemirror/state singleton.
 *   - Leaf packages (no CM deps) → self-contained bundles.
 *   - @codemirror/state → bundles its own source, marks @lezer/common external.
 *   - Higher-level CM packages → mark state + all shared leaves external so
 *     the importmap routes them to the single already-bundled copy.
 *   - All lang extensions → mark every core CM package external.
 *   - pako → self-contained bundle.
 *
 * Every --external specifier matches an importmap key in index.html, so the
 * browser resolves them to the correct vendored file with a single instance.
 */

import { build } from "bun";
import { mkdir, writeFile, unlink } from "fs/promises";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";

// When run from this script's location (demoSite/scripts/), OUT resolves to
// demoSite/js/vendor/. When copied to a throwaway dir, set OUT env var to override.
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.VENDOR_OUT ?? resolve(SCRIPT_DIR, "../js/vendor");
const TMP = process.env.VENDOR_TMP ?? "/tmp/cm-vendor-build/entries";

await mkdir(OUT, { recursive: true });
await mkdir(TMP, { recursive: true });

// Shared externals — packages that MUST be singletons and get their own bundle.
// Any package that depends on these marks them external so the importmap
// resolves to the single vendored copy.
const LEAF_EXTERNALS = [
  "@lezer/common",
  "@lezer/highlight",
  "@lezer/lr",
  "style-mod",
  "w3c-keyname",
  "crelt",
  "@marijn/find-cluster-break",
];

// @codemirror/state is the root singleton — everything that depends on it marks it external.
const STATE_EXTERNALS = [...LEAF_EXTERNALS, "@codemirror/state"];

// Core CM packages that higher-level packages depend on.
// Note: when bundling @codemirror/autocomplete or @codemirror/lint,
// do NOT mark themselves as external — only mark their dependencies.
const CORE_CM = [
  "@codemirror/view",
  "@codemirror/commands",
  "@codemirror/search",
  "@codemirror/language",
  "@codemirror/autocomplete",
  "@codemirror/lint",
];

// Externals for lang extensions that depend on core CM packages
const LANG_EXTERNALS = [
  ...STATE_EXTERNALS,
  ...CORE_CM,
  "codemirror",
];

// Lezer sub-packages (used by lang extensions)
const LEZER_LANG = ["@lezer/json", "@lezer/xml", "@lezer/yaml"];

let entryCount = 0;

async function bundle(pkgSpecifier, outfile, external = [], entryContent = null) {
  const entryFile = join(TMP, `entry-${entryCount++}.mjs`);
  const content = entryContent ?? `export * from ${JSON.stringify(pkgSpecifier)};\n`;
  await writeFile(entryFile, content);

  console.log(`Building ${outfile}...`);
  const result = await build({
    entrypoints: [entryFile],
    outdir: OUT,
    format: "esm",
    naming: outfile,
    minify: true,
    external,
    sourcemap: "none",
  });
  await unlink(entryFile).catch(() => {});
  if (!result.success) {
    console.error(`Failed: ${outfile}`);
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
  console.log(`  OK → ${outfile}`);
}

// ── Leaf packages (self-contained, no CM deps) ──────────────────────────────
await bundle("@lezer/common",              "lezer-common.js",              []);
await bundle("@lezer/lr",                  "lezer-lr.js",                  ["@lezer/common"]);
await bundle("@lezer/highlight",           "lezer-highlight.js",           ["@lezer/common"]);
await bundle("@lezer/json",                "lezer-json.js",                ["@lezer/common", "@lezer/lr"]);
await bundle("@lezer/xml",                 "lezer-xml.js",                 ["@lezer/common", "@lezer/lr"]);
await bundle("@lezer/yaml",                "lezer-yaml.js",                ["@lezer/common", "@lezer/lr"]);
await bundle("style-mod",                  "style-mod.js",                 []);
await bundle("w3c-keyname",                "w3c-keyname.js",               []);
// crelt only has a default export — use explicit re-export
await bundle("crelt",                      "crelt.js",                     [],
  `export { default } from "crelt";\n`);
await bundle("@marijn/find-cluster-break", "marijn-find-cluster-break.js", []);
await bundle("pako",                       "pako.js",                      []);

// ── Core CodeMirror packages ────────────────────────────────────────────────
// @codemirror/state is the singleton root — bundle it with only leaf externals
await bundle("@codemirror/state",
  "codemirror-state.js",
  LEAF_EXTERNALS);

// @codemirror/view depends on state + leaves — mark those external
await bundle("@codemirror/view",
  "codemirror-view.js",
  STATE_EXTERNALS);

// @codemirror/commands depends on state + leaves
await bundle("@codemirror/commands",
  "codemirror-commands.js",
  STATE_EXTERNALS);

// @codemirror/search depends on state + view + leaves
await bundle("@codemirror/search",
  "codemirror-search.js",
  [...STATE_EXTERNALS, "@codemirror/view"]);

// @codemirror/language depends on state + view + lezer
await bundle("@codemirror/language",
  "codemirror-language.js",
  [...STATE_EXTERNALS, "@codemirror/view"]);

// @codemirror/autocomplete depends on state + view + language + search
await bundle("@codemirror/autocomplete",
  "codemirror-autocomplete.js",
  [...STATE_EXTERNALS, "@codemirror/view", "@codemirror/language", "@codemirror/search"]);

// @codemirror/lint depends on state + view
await bundle("@codemirror/lint",
  "codemirror-lint.js",
  [...STATE_EXTERNALS, "@codemirror/view"]);

// ── Top-level codemirror package (re-exports from core packages) ────────────
await bundle("codemirror",
  "codemirror.js",
  [...STATE_EXTERNALS, ...CORE_CM]);

// ── Language extensions ─────────────────────────────────────────────────────
await bundle("@codemirror/lang-json",
  "codemirror-lang-json.js",
  [...LANG_EXTERNALS, "@lezer/json"]);

await bundle("@codemirror/lang-xml",
  "codemirror-lang-xml.js",
  [...LANG_EXTERNALS, "@lezer/xml"]);

await bundle("@codemirror/lang-yaml",
  "codemirror-lang-yaml.js",
  [...LANG_EXTERNALS, "@lezer/yaml"]);

// legacy-modes: bundle each used sub-path module separately
await bundle("@codemirror/legacy-modes/mode/verilog",
  "codemirror-legacy-verilog.js",
  LANG_EXTERNALS);

await bundle("@codemirror/legacy-modes/mode/clojure",
  "codemirror-legacy-clojure.js",
  LANG_EXTERNALS);

// ── Third-party CM language extensions ─────────────────────────────────────
await bundle("codemirror-lang-mermaid",
  "codemirror-lang-mermaid.js",
  [...LANG_EXTERNALS, ...LEZER_LANG]);

await bundle("@viz-js/lang-dot",
  "viz-lang-dot.js",
  [...LANG_EXTERNALS, ...LEZER_LANG]);

await bundle("codemirror-lang-latex",
  "codemirror-lang-latex.js",
  [...LANG_EXTERNALS, ...LEZER_LANG]);

console.log("\nAll vendor bundles built successfully.");
