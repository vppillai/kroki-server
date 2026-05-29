# Critical Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six critical correctness bugs in the DocCode Kroki editor without regressing existing behavior.

**Architecture:** Framework-free native-ESM frontend (`demoSite/js/`, no build step, deps via import map + esm.sh). Fixes are surgical and follow existing codebase patterns. New pure logic is extracted into small importable modules so it can be unit-tested with Node's built-in test runner (no new dependencies).

**Tech Stack:** Vanilla ES modules, CodeMirror 6, pako, Flask backend (untouched here), `node --test` for unit tests.

**Spec:** `docs/superpowers/specs/2026-05-28-critical-bug-fixes-design.md`

**File-conflict note (for parallel execution):** All six bugs touch mostly disjoint files. The ONLY shared file is `index.html` (Task 3 edits the editor pane; Task 6 edits the `<head>` import map). Tasks 1, 2, 4, 5, 6 are mutually file-disjoint and may run in parallel; **Task 3 must run after Task 6** (or sequentially with it) to avoid an `index.html` conflict.

---

## Task 0: Test harness setup

**Files:**
- Modify: `demoSite/package.json`
- Create: `demoSite/tests/.gitkeep`

- [ ] **Step 1: Add a test script to package.json**

Add a `"scripts"` block (the file currently has none). New `package.json` keeps all existing keys and adds:

```json
"scripts": {
    "test": "node --test tests/"
},
```

Insert it right after the `"license": "MIT",` line.

- [ ] **Step 2: Create the tests directory**

Create empty file `demoSite/tests/.gitkeep`.

- [ ] **Step 3: Verify the runner works**

Run: `cd demoSite && node --test tests/`
Expected: exits 0 with "tests 0 / pass 0" (no tests yet).

- [ ] **Step 4: Commit**

```bash
git add demoSite/package.json demoSite/tests/.gitkeep
git commit -m "test: add node --test harness for frontend unit tests"
```

---

## Task 1: Keyboard shortcut hijack + shared isTypingContext() guard

**Files:**
- Create: `demoSite/js/modules/keyboard.js`
- Test: `demoSite/tests/keyboard.test.js`
- Modify: `demoSite/js/modules/fullscreen.js:149-164`
- Modify: `demoSite/js/modules/eventBindings.js:186-190`
- Modify: `demoSite/js/code-history.js:118-119`

- [ ] **Step 1: Write the failing test**

Create `demoSite/tests/keyboard.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTypingContext } from '../js/modules/keyboard.js';

// Minimal element stub matching the DOM surface isTypingContext uses.
function el({ tagName = 'DIV', isContentEditable = false, cmEditor = false } = {}) {
    return {
        tagName,
        isContentEditable,
        closest(sel) { return sel === '.cm-editor' && cmEditor ? {} : null; },
    };
}

test('plain div is not a typing context', () => {
    assert.equal(isTypingContext(el({ tagName: 'DIV' })), false);
});

test('textarea is a typing context', () => {
    assert.equal(isTypingContext(el({ tagName: 'TEXTAREA' })), true);
});

test('input is a typing context', () => {
    assert.equal(isTypingContext(el({ tagName: 'INPUT' })), true);
});

test('contenteditable element is a typing context', () => {
    assert.equal(isTypingContext(el({ isContentEditable: true })), true);
});

test('element inside CodeMirror (.cm-editor) is a typing context', () => {
    assert.equal(isTypingContext(el({ tagName: 'DIV', cmEditor: true })), true);
});

test('null target is not a typing context', () => {
    assert.equal(isTypingContext(null), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd demoSite && node --test tests/keyboard.test.js`
Expected: FAIL — cannot find module `../js/modules/keyboard.js`.

- [ ] **Step 3: Create the keyboard.js module**

Create `demoSite/js/modules/keyboard.js`:

```js
/**
 * Keyboard helpers.
 *
 * The single source of truth for "is the user currently typing into an
 * editable surface?" — used by every global keyboard shortcut so that
 * bare-key shortcuts never hijack characters meant for the editor.
 *
 * CodeMirror 6 renders into a contenteditable <div class="cm-content">
 * inside .cm-editor, so a plain tagName check is NOT enough.
 *
 * @module keyboard
 */

/**
 * Return true if the given element (or the active element) is an editable
 * typing surface: an <input>, <textarea>, any contenteditable element, or
 * anything inside a CodeMirror editor.
 *
 * @param {EventTarget|null} [target] - Usually event.target; falls back to document.activeElement.
 * @returns {boolean}
 */
export function isTypingContext(target) {
    const node = target || (typeof document !== 'undefined' ? document.activeElement : null);
    if (!node) return false;

    const tag = node.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
    if (node.isContentEditable) return true;
    if (typeof node.closest === 'function' && node.closest('.cm-editor')) return true;

    return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd demoSite && node --test tests/keyboard.test.js`
Expected: PASS — 6 tests pass.

- [ ] **Step 5: Fix fullscreen.js to use the shared guard**

In `demoSite/js/modules/fullscreen.js`, add to the imports at the very top of the file (after the file's opening doc comment, the file currently has no imports):

```js
import { isTypingContext } from './keyboard.js';
```

Replace the keyboard handler at lines 149-164:

```js
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Only handle fullscreen shortcuts when not typing in text areas
        if (e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
            if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                if (!isFullscreen) {
                    enterFullscreen();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                if (isFullscreen) {
                    exitFullscreen();
                }
            }
        }
    });
```

with:

```js
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape always exits fullscreen, even from the editor (Escape is not a typed character).
        if (e.key === 'Escape') {
            if (isFullscreen) {
                e.preventDefault();
                exitFullscreen();
            }
            return;
        }
        // 'f' toggles fullscreen ONLY when the user is not typing into an editable surface.
        if ((e.key === 'f' || e.key === 'F') && !isTypingContext(e.target)) {
            e.preventDefault();
            if (!isFullscreen) {
                enterFullscreen();
            }
        }
    });
```

- [ ] **Step 6: Fix eventBindings.js `?` handler to use the shared guard**

In `demoSite/js/modules/eventBindings.js`, add `isTypingContext` to the existing dom import. Change line 17:

```js
import { show, hide } from './dom.js';
```

to:

```js
import { show, hide } from './dom.js';
import { isTypingContext } from './keyboard.js';
```

Replace the `?` block at lines 186-190:

```js
        // '?': open help modal
        if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
            const tag = document.activeElement?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) return;
            openHelpModal();
        }
```

with:

```js
        // '?': open help modal (not while typing into an editable surface)
        if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
            if (isTypingContext(e.target)) return;
            openHelpModal();
        }
```

- [ ] **Step 7: Refactor code-history.js to use the shared guard**

In `demoSite/js/code-history.js`, this is loaded as a module (ends with `window.CodeHistory = CodeHistory`). Add an import at the very top of the file (before the class / opening doc comment content, as the first line):

```js
import { isTypingContext } from './modules/keyboard.js';
```

Replace line 119:

```js
            if (document.activeElement?.closest('.cm-editor')) return;
```

with:

```js
            if (isTypingContext(e.target)) return;
```

(Note: `e.target` for a document-level keydown while editing is the `.cm-content` element, which `isTypingContext` matches via `.cm-editor`. Behavior is unchanged but now consistent with all other handlers.)

- [ ] **Step 8: Manual verification (run the app)**

Run: `cd /home/vpillai/temp/kroki-server && ./setup-kroki-server.sh start` (or `restart` if already running), open `https://localhost:8443/`.
Verify, with the cursor in the code editor:
- Typing `f` / `F` inserts the character (does NOT toggle fullscreen).
- Typing `?` inserts the character (does NOT open help).
- `Ctrl/Cmd+Z` undoes the last text edit (CodeMirror), not a history jump.
Verify, with focus OUTSIDE the editor (click the diagram pane, then press):
- `f` toggles fullscreen; `Escape` exits it; `?` opens help.

- [ ] **Step 9: Commit**

```bash
git add demoSite/js/modules/keyboard.js demoSite/tests/keyboard.test.js \
        demoSite/js/modules/fullscreen.js demoSite/js/modules/eventBindings.js \
        demoSite/js/code-history.js
git commit -m "fix: stop keyboard shortcuts hijacking input in CodeMirror editor

Add shared isTypingContext() guard used by all global bare-key shortcuts.
CodeMirror 6 is a contenteditable div, so the old tagName==='TEXTAREA' guard
let 'f' trigger fullscreen and '?' open help while typing. Unifies the three
divergent guards (fullscreen, help, undo/redo) on one helper."
```

---

## Task 2: AI JSON parse fails on `}` in diagram code

**Files:**
- Create: `demoSite/js/modules/aiResponseParser.js`
- Test: `demoSite/tests/aiResponseParser.test.js`
- Modify: `demoSite/js/ai-assistant.js:698-758` (parseAIResponse), `:805-810` (updateDiagramCode)

- [ ] **Step 1: Write the failing test**

Create `demoSite/tests/aiResponseParser.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractDiagramJson } from '../js/modules/aiResponseParser.js';

test('parses plain JSON', () => {
    const out = extractDiagramJson('{"diagramCode":"A->B","explanation":"hi"}');
    assert.equal(out.diagramCode, 'A->B');
    assert.equal(out.explanation, 'hi');
});

test('parses JSON whose diagramCode contains closing braces (the core bug)', () => {
    const code = 'digraph { a -> b; subgraph { c } }';
    const raw = JSON.stringify({ diagramCode: code, explanation: 'a graph' });
    const out = extractDiagramJson(raw);
    assert.equal(out.diagramCode, code);
    assert.equal(out.explanation, 'a graph');
});

test('strips ```json code fences', () => {
    const raw = '```json\n{"diagramCode":"x{y}","explanation":"e"}\n```';
    const out = extractDiagramJson(raw);
    assert.equal(out.diagramCode, 'x{y}');
});

test('handles leading prose before a fenced object', () => {
    const raw = 'Here you go:\n```json\n{"diagramCode":"g{1}","explanation":"e"}\n```';
    const out = extractDiagramJson(raw);
    assert.equal(out.diagramCode, 'g{1}');
});

test('handles braces inside string values without miscounting', () => {
    const raw = '{"diagramCode":"label = \\"a{b}c\\"","explanation":"e"}';
    const out = extractDiagramJson(raw);
    assert.equal(out.diagramCode, 'label = "a{b}c"');
});

test('returns null when no usable object is present', () => {
    assert.equal(extractDiagramJson('sorry, I cannot help'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd demoSite && node --test tests/aiResponseParser.test.js`
Expected: FAIL — cannot find module `aiResponseParser.js`.

- [ ] **Step 3: Create the parser module**

Create `demoSite/js/modules/aiResponseParser.js`:

```js
/**
 * Robust extraction of the {diagramCode, explanation} object from an AI
 * model's text response. Models frequently wrap output in markdown fences
 * despite instructions, and diagram code routinely contains '}' characters,
 * so naive regex extraction fails. This does a string-aware brace-balanced
 * scan that ignores braces inside JSON string values.
 *
 * @module aiResponseParser
 */

/** Validate the shape we require. */
function isValidShape(obj) {
    return obj && typeof obj.diagramCode === 'string' && typeof obj.explanation === 'string';
}

/** Strip leading/trailing markdown code fences (```json ... ```). */
function stripFences(text) {
    return text
        .replace(/^\s*```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
}

/**
 * Find the substring of the first complete, brace-balanced JSON object,
 * ignoring braces that appear inside double-quoted strings.
 *
 * @param {string} text
 * @returns {string|null}
 */
function findBalancedObject(text) {
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (escaped) { escaped = false; }
            else if (ch === '\\') { escaped = true; }
            else if (ch === '"') { inString = false; }
            continue;
        }
        if (ch === '"') { inString = true; continue; }
        if (ch === '{') { depth++; }
        else if (ch === '}') {
            depth--;
            if (depth === 0) return text.slice(start, i + 1);
        }
    }
    return null;
}

/**
 * Extract and validate the {diagramCode, explanation} object from raw text.
 *
 * @param {string} raw - The raw text content from the model.
 * @returns {{diagramCode: string, explanation: string}|null} Parsed object, or null if none found.
 */
export function extractDiagramJson(raw) {
    if (typeof raw !== 'string') return null;
    const text = stripFences(raw);

    // 1. Direct parse of the (de-fenced) text.
    try {
        const parsed = JSON.parse(text);
        if (isValidShape(parsed)) return parsed;
    } catch { /* fall through */ }

    // 2. Substring from first '{' to last '}'.
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first !== -1 && last > first) {
        try {
            const parsed = JSON.parse(text.slice(first, last + 1));
            if (isValidShape(parsed)) return parsed;
        } catch { /* fall through */ }
    }

    // 3. String-aware brace-balanced scan.
    const balanced = findBalancedObject(text);
    if (balanced) {
        try {
            const parsed = JSON.parse(balanced);
            if (isValidShape(parsed)) return parsed;
        } catch { /* fall through */ }
    }

    return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd demoSite && node --test tests/aiResponseParser.test.js`
Expected: PASS — 6 tests pass.

- [ ] **Step 5: Wire the parser into ai-assistant.js**

In `demoSite/js/ai-assistant.js`, add an import at the top of the file (it is a module ending in `window.AIAssistant = AIAssistant`). Add as the first line:

```js
import { extractDiagramJson } from './modules/aiResponseParser.js';
```

Replace the body of `parseAIResponse` (lines 698-758) — keep the input-normalization, replace the parsing pipeline — with:

```js
    parseAIResponse(responseContent) {
        let actualStringToParse;

        if (typeof responseContent === 'string') {
            actualStringToParse = responseContent;
        } else if (typeof responseContent === 'object' && responseContent !== null) {
            if (responseContent.choices?.[0]?.message?.content) {
                actualStringToParse = responseContent.choices[0].message.content;
            } else if (typeof responseContent.content === 'string') {
                actualStringToParse = responseContent.content;
            }
        }

        if (typeof actualStringToParse !== 'string') {
            throw new Error('Content to parse from AI response is not a string.');
        }

        // Robust, brace-balanced extraction (handles fences + '}' inside diagram code).
        const parsed = extractDiagramJson(actualStringToParse);
        if (parsed) return parsed;

        // Last-resort heuristic extraction of bare diagram code from prose/markdown.
        const extractedCode = this._fallbackExtractCode(actualStringToParse);
        if (extractedCode) return extractedCode;

        throw new Error('AI response was not valid JSON and diagram code could not be extracted.');
    }
```

- [ ] **Step 6: Fix the double-unescape in updateDiagramCode**

The `extractDiagramJson` path returns values already unescaped by `JSON.parse`. Re-running `.replace(/\\n/g,'\n')` on them corrupts literal `\n` in DOT/PlantUML labels. Only the `_fallbackExtractCode` path returns raw (non-JSON-parsed) strings that may need it.

Replace `updateDiagramCode` (lines 801-815):

```js
    updateDiagramCode(code) {
        const codeTextarea = document.getElementById('code');
        if (!codeTextarea) return;

        let processedCode = code
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, '\\');

        codeTextarea.value = processedCode;
        codeTextarea.dispatchEvent(new Event('change', { bubbles: true }));
        codeTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
```

with:

```js
    updateDiagramCode(code) {
        const codeTextarea = document.getElementById('code');
        if (!codeTextarea) return;

        // Values from JSON.parse are already unescaped — do NOT re-unescape them
        // (that corrupts literal "\n" in DOT/PlantUML labels). Callers pass already
        // correct strings; only legacy callers set _needsUnescape for raw extractions.
        codeTextarea.value = code;
        codeTextarea.dispatchEvent(new Event('change', { bubbles: true }));
        codeTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
```

Note: verify call sites of `updateDiagramCode` (grep `updateDiagramCode(` in `ai-assistant.js`). All current callers pass the value from the parsed object (already unescaped), so removing the re-unescape is correct. If any caller passes raw model text, leave that path to `_fallbackExtractCode` which already returns trimmed code.

- [ ] **Step 7: Run all tests**

Run: `cd demoSite && node --test tests/`
Expected: PASS — all keyboard + parser tests pass.

- [ ] **Step 8: Manual verification**

With the app running and AI configured, ask the AI to "create a graphviz diagram with nested subgraphs". Confirm the diagram code (which contains `}`) is applied to the editor and renders, with no "AI response was not valid JSON" error.

- [ ] **Step 9: Commit**

```bash
git add demoSite/js/modules/aiResponseParser.js demoSite/tests/aiResponseParser.test.js demoSite/js/ai-assistant.js
git commit -m "fix: robustly parse AI JSON containing braces in diagram code

Replace the non-greedy regex (stopped at first '}') with a string-aware
brace-balanced extractor. Fixes silent AI failures on Graphviz/Mermaid/C4.
Also removes a double-unescape that corrupted literal \\n in diagram labels."
```

---

## Task 3: CM6 silently drops large pastes/files (allow-and-warn)

> **Run after Task 6** (both edit `index.html`).

**Files:**
- Modify: `demoSite/index.html:204-213` (editor pane — add banner element)
- Modify: `demoSite/js/modules/editorBridge.js:292-322` (remove changeFilter reject; drive banner from updateListener)
- Modify: `demoSite/css/editor.css` (banner styles)

- [ ] **Step 1: Add a warning banner element to the editor pane**

In `demoSite/index.html`, after the `<div class="editor-container"> ... </div>` block (after line 210, before the `#loadingMessage` at line 211), add:

```html
            <div id="editor-size-banner" class="editor-size-banner" style="display:none;" aria-live="polite" role="status"></div>
```

- [ ] **Step 2: Remove the hard-reject changeFilter and drive the banner from the update listener**

In `demoSite/js/modules/editorBridge.js`, replace the `changeFilter` block (lines 292-301):

```js
            // Max text size filter: reject changes that would exceed the limit
            EditorState.changeFilter.of((tr) => {
                const maxSize = window.configManager
                    ? window.configManager.get('editor.maxTextSize') || DEFAULT_MAX_TEXT_SIZE
                    : DEFAULT_MAX_TEXT_SIZE;
                if (tr.newDoc.length > maxSize) {
                    return false;
                }
                return true;
            }),
```

Delete it entirely (allow all changes — never lose user data).

Then replace the `updateListener` block (lines 302-323) with one that also toggles the visible banner:

```js
            // Update listener: sync hidden textarea + dispatch input event + size warning
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    if (hiddenTextarea) {
                        const inputEvent = new Event('input', { bubbles: true });
                        hiddenTextarea.dispatchEvent(inputEvent);
                    }
                    const maxSize = window.configManager
                        ? window.configManager.get('editor.maxTextSize') || DEFAULT_MAX_TEXT_SIZE
                        : DEFAULT_MAX_TEXT_SIZE;
                    const docLen = update.state.doc.length;
                    const cmEditor = update.view.dom;
                    const banner = document.getElementById('editor-size-banner');
                    if (docLen > maxSize) {
                        cmEditor.dataset.sizeWarning = 'limit';
                        if (banner) {
                            banner.textContent = `Content is ${docLen.toLocaleString()} characters, ` +
                                `over the ${maxSize.toLocaleString()}-character limit. ` +
                                `The diagram may fail to render or cannot be shared via URL.`;
                            banner.style.display = 'block';
                        }
                    } else if (docLen >= maxSize * 0.9) {
                        cmEditor.dataset.sizeWarning = 'near';
                        if (banner) banner.style.display = 'none';
                    } else {
                        delete cmEditor.dataset.sizeWarning;
                        if (banner) banner.style.display = 'none';
                    }
                }
            }),
```

- [ ] **Step 3: Add banner styles**

Append to `demoSite/css/editor.css`:

```css
/* Editor over-size warning banner */
.editor-size-banner {
    margin-top: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: 0.8rem;
    color: #fff;
    background: var(--error-color);
    border-radius: var(--border-radius);
}
```

- [ ] **Step 4: Manual verification**

With the app running: lower `editor.maxTextSize` in Settings to a small value (e.g. 200), then paste/type more than that many characters. Confirm: the characters ARE inserted (no data loss), the red banner appears with the count, and clearing text below the limit hides the banner. Restore the setting.
Also: open a large file via the file picker and confirm the editor shows the content (not empty).

- [ ] **Step 5: Commit**

```bash
git add demoSite/index.html demoSite/js/modules/editorBridge.js demoSite/css/editor.css
git commit -m "fix: stop silently dropping large pastes; warn instead

CodeMirror changeFilter hard-rejected over-limit changes, silently losing
pasted/opened content. Now allow the change and show a visible size-limit
banner so the user understands render/URL-sharing may fail."
```

---

## Task 4: ConfigManager mutates DEFAULT_CONFIG

**Files:**
- Modify: `demoSite/js/config.js:149`, `:190`, `:392-399`, `:694`
- Test: `demoSite/tests/configClone.test.js`

- [ ] **Step 1: Make config.js Node-importable and export internals for testing**

In `demoSite/js/config.js`, the file currently ends at line 694 with:

```js
window.configManager = new ConfigManager();
```

Replace that line with a guarded assignment + named exports so the module can be imported under Node without a `window`:

```js
export { ConfigManager, DEFAULT_CONFIG };

if (typeof window !== 'undefined') {
    window.configManager = new ConfigManager();
}
```

(`DEFAULT_CONFIG` is the const defined near the top of the file; `ConfigManager` is the class. Both are in module scope, so `export { ... }` at the end is valid.)

- [ ] **Step 2: Write the failing test**

Create `demoSite/tests/configClone.test.js`:

```js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Stub the browser globals config.js touches before importing it.
globalThis.window = undefined;
const store = {};
globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
};

const { ConfigManager, DEFAULT_CONFIG } = await import('../js/config.js');

beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

test('setting a nested value does not mutate DEFAULT_CONFIG', () => {
    const original = DEFAULT_CONFIG.editor.fontSize;
    const cm = new ConfigManager();
    cm.set('editor.fontSize', original + 7);
    assert.equal(DEFAULT_CONFIG.editor.fontSize, original,
        'DEFAULT_CONFIG.editor.fontSize must be unchanged after set()');
});

test('reset() does not mutate DEFAULT_CONFIG.ai.model', () => {
    const original = DEFAULT_CONFIG.ai.model;
    const cm = new ConfigManager();
    cm.reset({ ai: { model: 'some/other-model' } });
    assert.equal(DEFAULT_CONFIG.ai.model, original,
        'DEFAULT_CONFIG.ai.model must be unchanged after reset() with server defaults');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd demoSite && node --test tests/configClone.test.js`
Expected: FAIL — DEFAULT_CONFIG mutated (shallow spread shares nested refs).

- [ ] **Step 4: Deep-clone defaults at every assignment**

In `demoSite/js/config.js`:

Line 149 (constructor): replace
```js
        this.config = { ...DEFAULT_CONFIG };
```
with
```js
        this.config = structuredClone(DEFAULT_CONFIG);
```

Line 190 (load catch): replace
```js
            this.config = { ...DEFAULT_CONFIG };
```
with
```js
            this.config = structuredClone(DEFAULT_CONFIG);
```

Lines 392-399 (reset): replace
```js
    reset(serverDefaults = {}) {
        // Merge server defaults with hardcoded defaults
        const effectiveDefaults = { ...DEFAULT_CONFIG };
        if (serverDefaults.ai && serverDefaults.ai.model) {
            effectiveDefaults.ai.model = serverDefaults.ai.model;
        }
        
        this.config = { ...effectiveDefaults };
        this.save();
```
with
```js
    reset(serverDefaults = {}) {
        // Deep-clone defaults so we never mutate the shared DEFAULT_CONFIG.
        const effectiveDefaults = structuredClone(DEFAULT_CONFIG);
        if (serverDefaults.ai && serverDefaults.ai.model) {
            effectiveDefaults.ai.model = serverDefaults.ai.model;
        }

        this.config = effectiveDefaults;
        this.save();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd demoSite && node --test tests/configClone.test.js`
Expected: PASS — both tests pass.

- [ ] **Step 6: Manual verification**

With the app running: change several settings, click "Reset to Defaults", then change settings again — confirm defaults are correct each time (no drift). Confirm no console errors on load.

- [ ] **Step 7: Commit**

```bash
git add demoSite/js/config.js demoSite/tests/configClone.test.js
git commit -m "fix: deep-clone DEFAULT_CONFIG so runtime set()/reset() can't mutate it

Shallow spreads shared nested object references, so set()/reset() corrupted
the very defaults get() falls back to. Use structuredClone; export internals
and guard the window assignment so the module is unit-testable under Node."
```

---

## Task 5: Init race conditions (deterministic sequencing)

**Files:**
- Modify: `demoSite/js/main.js:238-291`

**Rationale:** All feature modules are `<script type="module">` (deferred), so they execute in document order before `DOMContentLoaded`. `window.configManager`, `ConfigUI`, `AIAssistant`, `CodeHistory` are therefore already defined when `main.js`'s handler runs — the `setTimeout(150/200)` waits for nothing. Replace with deterministic, ordered init that awaits only the genuinely-async `/api/config` fetch before the first render.

- [ ] **Step 1: Replace the two setTimeout blocks with deterministic sequencing**

In `demoSite/js/main.js`, replace lines 238-291 (the `// Initialize configuration system (delayed...)` `setTimeout(..., 150)` block AND the `// Update diagram after...` `setTimeout(..., 200)` block) with:

```js
    // Initialize configuration system. Module scripts are deferred and run in
    // document order before DOMContentLoaded, so configManager / ConfigUI /
    // AIAssistant / CodeHistory are guaranteed defined here — no timer needed.
    if (window.configManager && typeof ConfigUI !== 'undefined') {
        try {
            window.configUI = new ConfigUI(window.configManager);
        } catch (error) {
            console.error('Error creating ConfigUI:', error);
        }
    } else {
        console.warn('ConfigManager or ConfigUI class not available');
    }

    if (typeof AIAssistant !== 'undefined') {
        try {
            window.aiAssistant = new AIAssistant(window.configManager);
        } catch (error) {
            console.error('Error creating AI Assistant:', error);
        }
    } else {
        console.warn('AIAssistant class not available');
    }

    if (typeof CodeHistory !== 'undefined') {
        try {
            window.codeHistory = new CodeHistory();
            window.codeHistory.initializeWithCurrentCode();
        } catch (error) {
            console.error('Error creating Code History:', error);
        }
    } else {
        console.warn('CodeHistory class not available');
    }

    initializeConfigurationSystem();

    // Fetch server config (sets editor.maxTextSize from the Kroki backend limit),
    // THEN do the first render so the size limit is correct on first paint.
    fetch('/api/config')
        .then(r => r.json())
        .then(config => {
            if (config.kroki && config.kroki.maxBodySize && window.configManager) {
                window.configManager.set('editor.maxTextSize', config.kroki.maxBodySize);
            }
        })
        .catch(() => { /* server config unavailable, use default */ })
        .finally(() => {
            if (state.autoRefreshEnabled) {
                updateDiagram();
            }
        });
```

- [ ] **Step 2: Manual verification (the key test for this task)**

Run the app. In the browser devtools:
- Open the console — confirm NO "Configuration UI not available yet" / "still loading" warnings on load.
- Run `localStorage.clear()` then hard-reload — confirm the editor, settings, AI button, and history controls all initialize, and the initial diagram renders, with no console errors.
- Open Settings immediately after load (fast click) — it opens (no "Settings system is loading" alert).

- [ ] **Step 3: Commit**

```bash
git add demoSite/js/main.js
git commit -m "fix: deterministic init instead of setTimeout(150/200) races

Module scripts are deferred and run before DOMContentLoaded, so the global
classes are already defined — the timers waited for nothing and could mis-order
the first render vs config. Sequence init directly and await /api/config before
the first render so editor.maxTextSize is correct on first paint."
```

---

## Task 6: pako global -> ESM import

> **Run before Task 3** (both edit `index.html`).

**Files:**
- Modify: `demoSite/index.html:14-47` (import map + remove pako script tag)
- Modify: `demoSite/js/modules/diagramOperations.js:19`, `:119`, `:144`
- Delete: `demoSite/js/pako.min.js`

- [ ] **Step 1: Add pako to the import map**

In `demoSite/index.html`, inside the `<script type="importmap">` `imports` object, add a `pako` entry. After the last existing entry (line 42, the clojure legacy mode), add a comma to that line and then:

```json
            "@codemirror/legacy-modes/mode/clojure": "https://esm.sh/*@codemirror/legacy-modes@6.5.2/mode/clojure",
            "pako": "https://esm.sh/pako@2.1.0"
```

- [ ] **Step 2: Remove the classic pako script tag**

In `demoSite/index.html`, delete lines 46-47:

```html
    <!-- Include pako library for deflate compression -->
    <script src="js/pako.min.js" defer></script>
```

- [ ] **Step 3: Import pako in diagramOperations.js and use named functions**

In `demoSite/js/modules/diagramOperations.js`, after line 19 (`import { textEncode, uint8ArrayToString } from './utils.js';`), add:

```js
import { deflate, inflate } from 'pako';
```

Change line 119 from:
```js
    const compressed = pako.deflate(bytes);
```
to:
```js
    const compressed = deflate(bytes);
```

Change line 144 from:
```js
        const decompressed = pako.inflate(bytes);
```
to:
```js
        const decompressed = inflate(bytes);
```

- [ ] **Step 4: Delete the vendored pako file**

```bash
git rm demoSite/js/pako.min.js
```

- [ ] **Step 5: Manual verification (encode + decode round-trip)**

Run the app:
- Type a diagram; confirm it renders (encode path via `deflate`).
- Confirm the "image link" / URL updates (encode).
- Copy the page URL (with `?im=...`), open it in a new tab — confirm the diagram source is restored in the editor (decode path via `inflate`, which runs during `DOMContentLoaded`).
- Confirm no `ReferenceError: pako is not defined` in the console.

- [ ] **Step 6: Commit**

```bash
git add demoSite/index.html demoSite/js/modules/diagramOperations.js
git commit -m "fix: load pako as ESM via import map instead of a global script

The classic <script defer> UMD global raced with the ESM app and risked a
ReferenceError on the shared-link (?im=) decode path that runs during
DOMContentLoaded. Import deflate/inflate from pako@2.1.0 via the import map,
consistent with CodeMirror, and remove the vendored UMD file."
```

---

## Final integration verification

- [ ] Run the full unit suite: `cd demoSite && node --test tests/` — all pass.
- [ ] Run the app (`./setup-kroki-server.sh restart`) and walk the combined checklist: keyboard (f/?/Ctrl+Z in & out of editor), AI graphviz-with-braces, large paste warning, settings reset, fresh-load init, `?im=` shared-link round-trip.
- [ ] `git log --oneline` shows one focused commit per task.
- [ ] Update `README.md` only if any documented behavior changed (none expected).

## Self-review notes

- **Spec coverage:** Task 1 ↔ bug #1, Task 2 ↔ #2, Task 3 ↔ #3, Task 4 ↔ #4, Task 5 ↔ #5, Task 6 ↔ #6. All six covered.
- **Init approach** intentionally differs from the spec's promise-registry sketch: deterministic sequencing is correct (module scripts run before DOMContentLoaded) and lower-risk. Meets the spec's intent (no setTimeout races; config applied before first render).
- **Type consistency:** `isTypingContext(target)` and `extractDiagramJson(raw)` signatures are used identically across tasks and tests.
- **No placeholders:** every code step contains complete code.
