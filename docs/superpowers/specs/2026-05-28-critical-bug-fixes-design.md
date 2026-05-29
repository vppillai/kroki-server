# Critical Bug Fixes — Design Spec

**Date:** 2026-05-28
**Workstream:** 1 of 7 (Critical bug fixes)
**Status:** Approved (design), pending implementation plan
**Branch:** `fix/critical-bugs`

## Context

DocCode is a framework-free Kroki diagram editor: native-ESM frontend (`demoSite/js/`,
no build step, dependencies via `<script type="importmap">` + esm.sh) and a Flask proxy
backend (`demoSite/server.py`). A five-subsystem deep review identified six critical
correctness bugs. The user opted to fix **all six** in this first end-to-end workstream,
including the two more invasive ones (init-race gating, pako ESM conversion).

The recurring root cause behind several bugs is a half-finished migration to ES modules +
CodeMirror 6: the codebase straddles classic `window.*` globals and real ESM, and assumes
a `<textarea>` editor where CM6 now renders a `contenteditable <div>`. Bugs cluster on these
seams.

## Strategic approach

**Targeted fixes following existing codebase patterns**, plus one small shared helper
(`isTypingContext()`) to prevent the keyboard-class bug from recurring. We deliberately do
NOT do the full ESM migration here — converting `window.*` classes to real ESM exports
(which would make init ordering deterministic and remove the need for promise-gating) is the
separate "architecture cleanup" workstream. This pass keeps each change surgical and
independently verifiable.

## The six fixes

### 1. Keyboard shortcut hijack (reported bug)

- **Symptom:** Typing `f` in the editor triggers fullscreen instead of inserting the character.
- **Root cause:** `modules/fullscreen.js:151` guards bare-key shortcuts with
  `e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT'`. CM6 renders into a
  `contenteditable <div class="cm-content">`, so `tagName` is `"DIV"` and the guard passes.
- **Inconsistency:** Two other handlers already guard correctly but differently —
  `eventBindings.js:188` (`?`) uses `isContentEditable`; `code-history.js:119` (Ctrl+Z/Y)
  uses `closest('.cm-editor')`. Three guards, three implementations.
- **Fix:**
  - Add `isTypingContext(target)` to `modules/dom.js`. Returns `true` when `target` (or
    `document.activeElement`) is an `<input>`, `<textarea>`, has `isContentEditable`, or is
    within `closest('.cm-editor')`.
  - Route every global bare-key shortcut through it. Fix `fullscreen.js` (`f`). Refactor the
    correct-but-divergent guards in `eventBindings.js` (`?`) and `code-history.js` (Ctrl+Z/Y)
    to call the shared helper so all agree.
  - Audit modifier shortcuts (`main.js` Ctrl+Enter, `fileOperations.js` Ctrl+N/O/S,
    `eventBindings.js` Ctrl+K) to confirm correct behavior from editor focus; they are
    modifier-based so they don't insert characters, but verify no double-handling.
- **Files:** `modules/dom.js` (new helper), `modules/fullscreen.js`, `modules/eventBindings.js`,
  `code-history.js`.
- **Risk:** Low.

### 2. AI JSON parse fails on `}` in diagram code

- **Symptom:** AI responses fail with "not valid JSON" whenever the generated diagram code
  contains a closing brace (Graphviz `digraph{…}`, Mermaid, C4) — extremely common.
- **Root cause:** `ai-assistant.js:740` fallback regex
  `/\{[\s\S]*?"diagramCode"[\s\S]*?"explanation"[\s\S]*?\}/g` is non-greedy and stops at the
  first `}`, truncating the match.
- **Fix:** Replace fallback extraction with a robust pipeline in `parseAIResponse`:
  1. Strip code fences (handle leading prose before a ```` ```json ```` fence).
  2. Attempt `JSON.parse` on the substring from the first `{` to the **last** `}`.
  3. On failure, a string-aware brace-balanced scan from the first `{` (so braces inside
     string values are not miscounted).
  4. Only then fall back to field-level regex.
  - Also fix the **double-unescape** at `ai-assistant.js:805`: `JSON.parse` already unescaped
    the value, so re-running `.replace(/\\n/g,'\n')` corrupts literal `\n` in DOT/PlantUML
    labels. Apply unescaping only to non-JSON fallback-extracted code.
- **Files:** `ai-assistant.js`.
- **Risk:** Low (isolated to parsing). The brace-balanced extractor will be written as a pure
  function and unit-tested.

### 3. CM6 silently drops large pastes/files

- **Symptom:** Pasting or opening content that crosses the `maxTextSize` (default 1 MB) limit
  silently inserts nothing; opening a large file appears to open it empty.
- **Root cause:** `editorBridge.js:293` `EditorState.changeFilter` returns `false` for any
  transaction whose result exceeds `maxTextSize`, rejecting the whole change with no feedback.
- **Fix (decision: allow-and-warn, never lose data):** Remove the hard-reject. Allow the
  change and surface a visible, dismissible warning banner ("Content exceeds the {N}-byte
  limit; the diagram may fail to render or share via URL"). Reuse the existing
  `dataset.sizeWarning` mechanism/styling. Confirm `openFile` (`fileOperations.js:64`) no
  longer yields an empty editor.
- **Files:** `modules/editorBridge.js`, minor CSS.
- **Risk:** Low–medium.

### 4. ConfigManager mutates `DEFAULT_CONFIG`

- **Symptom:** Runtime `set()` corrupts the shared defaults that `get()` falls back to,
  causing non-reproducible settings behavior.
- **Root cause:** Shallow spread `{ ...DEFAULT_CONFIG }` at `config.js:149` (constructor),
  `:190` (load catch), and `:392` (`reset`) shares nested object references.
- **Fix:** Deep-clone defaults at every assignment via `structuredClone(DEFAULT_CONFIG)`
  (the config is JSON-safe). Apply server-default overrides to the clone, never the original.
- **Files:** `config.js`.
- **Risk:** Low. Unit-testable (clone, mutate, assert original unchanged).

### 5. Init race conditions (invasive)

- **Symptom:** Flaky "system still loading, try again" errors; first render can use stale config.
- **Root cause:** `main.js:239/287` use `setTimeout(150)` / `setTimeout(200)` to "wait for"
  `window.configManager`, `ConfigUI`, `AIAssistant`, `CodeHistory` to be defined.
- **Fix:** Replace timers with promise-based readiness. Each global-class module resolves a
  readiness promise when its class/instance is available; `main.js` `await`s the composed
  readiness, then constructs the UIs, then performs the first render. Await the `/api/config`
  fetch (which sets `editor.maxTextSize`) before the first render. Keep a bounded timeout
  fallback so a missing/failed module degrades gracefully instead of hanging.
- **Files:** `main.js`, `config.js`, `ai-assistant.js`, `code-history.js`, `config-ui.js`.
- **Risk:** Medium (touches startup). Primary manual-verification target.

### 6. `pako` global → ESM import (invasive)

- **Symptom:** Fragile load-order dependency; risk of `ReferenceError` on the shared-link
  (`?im=`) decode path which runs during `DOMContentLoaded`.
- **Root cause:** pako is loaded as a classic `<script src="js/pako.min.js" defer>` UMD global
  while all app code is ESM.
- **Fix (decision: CDN via import map, for consistency):** Add
  `"pako": "https://esm.sh/pako@2.1.0"` to the import map in `index.html` (matching how
  CodeMirror loads and the `package.json` `cdn-dependencies` manifest). `import { deflate,
  inflate } from 'pako'` in `modules/diagramOperations.js`. Remove the `<script defer>` tag and
  delete the vendored `js/pako.min.js`.
  - Note: the app already requires esm.sh connectivity for CodeMirror, so vendoring pako
    locally provides no real offline benefit today. If full offline support is desired later,
    all deps (CM6 + pako) would be vendored together — out of scope here.
- **Files:** `index.html`, `modules/diagramOperations.js`, delete `js/pako.min.js`.
- **Risk:** Medium (encoding path is central). Verify encode + decode + shared-link round-trip.

## Verification strategy

The project has no test framework. Hybrid approach:

- **Node tests** (`node --test`, no new dependencies) for newly-extracted pure logic:
  brace-balanced JSON extraction (#2) and config deep-clone (#4). Real TDD where feasible.
- **Manual test checklist + running the app** (`./setup-kroki-server.sh start`) for DOM/timing
  behaviors, with observed results reported (no "should work" claims):
  - Type `f`, `?`, then Ctrl+Z/Ctrl+Y in the editor — characters insert / undo defers to CM6.
  - `f`/`?` outside the editor still toggle fullscreen/help.
  - Paste >1 MB content — inserts with a visible warning, no data loss.
  - Fresh load with cleared localStorage — no "still loading" errors; settings/AI/history init.
  - Shared-link `?im=` round-trip — encode a diagram, copy URL, reload → decodes correctly.
  - Change a setting, reload — value persists and defaults are uncorrupted.

## Out of scope (deferred to later workstreams)

- Full ESM migration / removal of `globals-bridge.js` (architecture cleanup) — the true
  root-cause fix for init ordering.
- AI streaming/empty-response handling and prompt improvements (AI workstream).
- All security, new-diagram-type, backend-update, and UX/a11y items.

## Decisions log

- **#6 pako:** CDN via import map (consistent with CM6), not local vendoring.
- **#3 large paste:** allow-and-warn (never lose user data), not truncate or hard-reject.
- **Scope:** all six bugs in one pass, per user choice.
