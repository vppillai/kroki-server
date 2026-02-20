/**
 * CodeMirror 6 Editor Bridge Module
 *
 * Creates a CM6 EditorView and provides a compatibility shim so that
 * all existing code using document.getElementById('code').value
 * continues to work unchanged.
 *
 * @module editorBridge
 */

import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, openSearchPanel, closeSearchPanel } from '@codemirror/search';
import { bracketMatching, indentOnInput, foldGutter, foldKeymap, syntaxHighlighting, HighlightStyle, StreamLanguage } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { highlightSelectionMatches } from '@codemirror/search';
import { tags as t } from '@lezer/highlight';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { verilog } from '@codemirror/legacy-modes/mode/verilog';
import { clojure } from '@codemirror/legacy-modes/mode/clojure';
import { mermaid } from 'codemirror-lang-mermaid';
import { dot } from '@viz-js/lang-dot';
import { latex } from 'codemirror-lang-latex';
import { DEFAULT_MAX_TEXT_SIZE } from './constants.js';

/** @type {EditorView|null} */
let view = null;

/** Compartment for dynamic font-size changes */
const fontSizeCompartment = new Compartment();

/** Compartment for dynamic syntax-highlighting language */
const languageCompartment = new Compartment();

/** Simple PlantUML stream parser for syntax highlighting */
const plantumlParser = {
    startState() {
        return { inBlock: false, afterColon: false };
    },
    token(stream, state) {
        // Label text after colon (e.g., "Alice -> Bob: Hello World" or ":Action;")
        if (state.afterColon) {
            // Semicolon ends activity labels — highlight it as punctuation, exit label mode
            if (stream.peek() === ';') {
                state.afterColon = false;
                stream.next();
                return 'punctuation';
            }
            // Consume rest of line as label text
            stream.skipToEnd();
            state.afterColon = false;
            return 'string';
        }
        // Strings
        if (stream.match(/"[^"]*"/)) return 'string';
        // Line comments
        if (stream.match(/'/)) { stream.skipToEnd(); return 'comment'; }
        // Block comment start
        if (stream.match(/\/'/)) { state.inBlock = true; return 'comment'; }
        if (state.inBlock) {
            if (stream.match(/'\//)) { state.inBlock = false; return 'comment'; }
            stream.next();
            return 'comment';
        }
        // Preprocessor directives
        if (stream.match(/!(?:include|define|ifdef|ifndef|else|endif|pragma|theme|unquoted)\b/))
            return 'meta';
        // Start/end markers
        if (stream.match(/@start(?:uml|ditaa|salt|gantt|mindmap|wbs|json|yaml|ebnf|regex|chronology|board)\b/) ||
            stream.match(/@end(?:uml|ditaa|salt|gantt|mindmap|wbs|json|yaml|ebnf|regex|chronology|board)\b/))
            return 'keyword';
        // Arrows (must be before operator check)
        if (stream.match(/(?:<|<\||\*|o|#|x|\\\\|\/)?-+(?:right|left|up|down|-)*(?:\[(?:#[0-9a-fA-F]{3,6}|[a-zA-Z]+)\])?-*(?:>|\|>|\*|o|#|x|\\\\|\/)?/))
            return 'operator';
        if (stream.match(/\.+(?:>|\|>)?/) || stream.match(/(?:<\|?)?\.+/))
            return 'operator';
        // Colon — marks start of a label; highlight the colon as punctuation
        if (stream.peek() === ':') {
            stream.next();
            state.afterColon = true;
            return 'punctuation';
        }
        // Keywords
        if (stream.match(/\b(?:actor|agent|artifact|boundary|card|circle|cloud|collections|component|control|database|diamond|entity|enum|file|folder|frame|hexagon|interface|json|label|map|node|object|package|participant|person|queue|rectangle|stack|state|storage|usecase|abstract|annotation|class|struct|together|namespace|partition|title|header|footer|legend|note|end\s*note|caption|newpage|left|right|center|as|is|of|on|over|end|top|bottom|up|down|if|then|else|elseif|endif|repeat|while|endwhile|fork|again|end\s*fork|split|end\s*split|detach|kill|start|stop|floating|ref|skinparam|hide|show|remove|autonumber|activate|deactivate|destroy|create|return|group|loop|alt|opt|break|par|critical|box|end\s*box)\b/))
            return 'keyword';
        // C4 macros
        if (stream.match(/\b(?:Person|Person_Ext|System|System_Ext|System_Boundary|Enterprise_Boundary|Container|Container_Ext|Container_Boundary|Component|Component_Ext|Deployment_Node|Rel|Rel_D|Rel_U|Rel_L|Rel_R|Rel_Back|BiRel|Lay_D|Lay_U|Lay_L|Lay_R|AddElementTag|AddRelTag|SHOW_LEGEND|LAYOUT_WITH_LEGEND|LAYOUT_TOP_DOWN|LAYOUT_LEFT_RIGHT|SetPropertyHeader|WithoutPropertyHeader|AddProperty|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|UpdateElementStyle|UpdateRelStyle|Boundary|SystemDb|SystemQueue|ContainerDb|ContainerQueue|ComponentDb|ComponentQueue)\b/))
            return 'typeName';
        // Color literals
        if (stream.match(/#[0-9a-fA-F]{3,8}\b/)) return 'color';
        // Numbers
        if (stream.match(/\b\d+\b/)) return 'number';
        // Stereotypes
        if (stream.match(/<<[^>]*>>/)) return 'annotation';
        // Skip word characters
        if (stream.match(/\w+/)) return null;
        stream.next();
        return null;
    },
};

/** Diagram type → CM6 language extension mapping */
const languageMap = {
    vega: json,
    vegalite: json,
    wavedrom: json,
    excalidraw: json,
    bpmn: xml,
    diagramsnet: xml,
    wireviz: yaml,
    symbolator: () => StreamLanguage.define(verilog),
    mermaid,
    graphviz: dot,
    tikz: latex,
    bytefield: () => StreamLanguage.define(clojure),
    plantuml: () => StreamLanguage.define(plantumlParser),
    c4plantuml: () => StreamLanguage.define(plantumlParser),
};

/** Theme-aware syntax highlight style using CSS variables */
const syntaxColors = HighlightStyle.define([
    { tag: t.keyword, color: 'var(--syntax-keyword)' },
    { tag: t.string, color: 'var(--syntax-string)' },
    { tag: [t.number, t.integer, t.float], color: 'var(--syntax-number)' },
    { tag: [t.bool, t.atom], color: 'var(--syntax-bool)' },
    { tag: t.null, color: 'var(--syntax-null)' },
    { tag: [t.propertyName, t.definition(t.propertyName)], color: 'var(--syntax-property)' },
    { tag: t.tagName, color: 'var(--syntax-tag)' },
    { tag: t.attributeName, color: 'var(--syntax-attribute)' },
    { tag: t.attributeValue, color: 'var(--syntax-string)' },
    { tag: t.comment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
    { tag: [t.punctuation, t.separator, t.bracket], color: 'var(--syntax-punctuation)' },
    { tag: t.operator, color: 'var(--syntax-keyword)' },
    { tag: t.meta, color: 'var(--syntax-attribute)' },
    { tag: t.typeName, color: 'var(--syntax-tag)' },
    { tag: t.annotation, color: 'var(--syntax-comment)' },
    { tag: t.color, color: 'var(--syntax-number)' },
]);

/** Current font size in px */
let currentFontSize = 13;

/**
 * Build a CM6 theme that reads from CSS variables so dark/light
 * adapts automatically.
 */
function buildTheme(fontSize) {
    return EditorView.theme({
        '&': {
            height: '100%',
            fontSize: `${fontSize}px`,
        },
        '.cm-scroller': {
            overflow: 'auto',
            fontFamily: "'JetBrains Mono', 'Monaco', 'Menlo', monospace",
        },
        '.cm-content': {
            caretColor: 'var(--text-primary)',
            color: 'var(--text-primary)',
            fontFamily: "'JetBrains Mono', 'Monaco', 'Menlo', monospace",
            fontSize: `${fontSize}px`,
            lineHeight: '1.5',
        },
        '.cm-gutters': {
            backgroundColor: 'var(--background-tertiary)',
            color: 'var(--text-muted)',
            borderRight: '1px solid var(--border-color)',
            fontFamily: "'JetBrains Mono', 'Monaco', 'Menlo', monospace",
            fontSize: `${fontSize}px`,
        },
        '.cm-activeLineGutter': {
            backgroundColor: 'var(--background-secondary)',
        },
        '.cm-activeLine': {
            backgroundColor: 'color-mix(in srgb, var(--background-tertiary) 40%, transparent)',
        },
        '.cm-cursor': {
            borderLeftColor: 'var(--text-primary)',
        },
        '.cm-selectionBackground': {
            backgroundColor: 'color-mix(in srgb, var(--primary-color) 30%, transparent) !important',
        },
        '&.cm-focused .cm-selectionBackground': {
            backgroundColor: 'color-mix(in srgb, var(--primary-color) 30%, transparent) !important',
        },
        '.cm-searchMatch': {
            backgroundColor: 'rgba(255, 235, 59, 0.4)',
            outline: '1px solid rgba(255, 235, 59, 0.7)',
        },
        '.cm-searchMatch.cm-searchMatch-selected': {
            backgroundColor: 'rgba(255, 193, 7, 0.6)',
            outline: '1px solid rgba(255, 193, 7, 0.9)',
        },
        '.cm-panels': {
            backgroundColor: 'var(--background-secondary)',
            color: 'var(--text-primary)',
            borderBottom: '1px solid var(--border-color)',
        },
        '.cm-panels.cm-panels-top': {
            borderBottom: '1px solid var(--border-color)',
        },
        '.cm-panel.cm-search': {
            padding: '8px',
        },
        '.cm-panel.cm-search input': {
            backgroundColor: 'var(--background-primary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            padding: '4px 8px',
            fontFamily: "'JetBrains Mono', 'Monaco', 'Menlo', monospace",
            fontSize: '13px',
        },
        '.cm-panel.cm-search button': {
            backgroundColor: 'var(--background-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: 'pointer',
        },
        '.cm-panel.cm-search label': {
            color: 'var(--text-secondary)',
        },
        '.cm-foldPlaceholder': {
            backgroundColor: 'var(--background-tertiary)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border-color)',
        },
        '.cm-tooltip': {
            backgroundColor: 'var(--background-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
        },
    });
}

/**
 * Initialize the CM6 editor.
 *
 * @param {HTMLElement} [mountEl] - Element to mount the editor into (defaults to #code-editor-mount)
 * @param {string} [initialContent] - Initial content (defaults to hidden textarea value)
 * @returns {EditorView} The created EditorView
 */
export function initializeEditor(mountEl, initialContent) {
    const mount = mountEl || document.getElementById('code-editor-mount');
    const hiddenTextarea = document.getElementById('code');

    if (!mount) {
        console.error('editorBridge: #code-editor-mount not found');
        return null;
    }

    const content = initialContent ?? (hiddenTextarea ? hiddenTextarea.value : '');
    const fontSize = window.configManager
        ? window.configManager.get('editor.fontSize') || 13
        : 13;
    currentFontSize = fontSize;

    const startState = EditorState.create({
        doc: content,
        extensions: [
            lineNumbers(),
            highlightActiveLineGutter(),
            highlightSpecialChars(),
            history(),
            foldGutter(),
            drawSelection(),
            dropCursor(),
            EditorState.allowMultipleSelections.of(true),
            indentOnInput(),
            bracketMatching(),
            closeBrackets(),
            rectangularSelection(),
            crosshairCursor(),
            highlightActiveLine(),
            highlightSelectionMatches(),
            keymap.of([
                indentWithTab,
                ...closeBracketsKeymap,
                ...defaultKeymap,
                ...searchKeymap,
                ...historyKeymap,
                ...foldKeymap,
            ]),
            syntaxHighlighting(syntaxColors),
            languageCompartment.of([]),
            fontSizeCompartment.of(buildTheme(fontSize)),
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
            // Update listener: sync hidden textarea + dispatch input event + size warning
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    if (hiddenTextarea) {
                        const inputEvent = new Event('input', { bubbles: true });
                        hiddenTextarea.dispatchEvent(inputEvent);
                    }
                    // Update size limit warning
                    const maxSize = window.configManager
                        ? window.configManager.get('editor.maxTextSize') || DEFAULT_MAX_TEXT_SIZE
                        : DEFAULT_MAX_TEXT_SIZE;
                    const docLen = update.state.doc.length;
                    const cmEditor = update.view.dom;
                    if (docLen >= maxSize) {
                        cmEditor.dataset.sizeWarning = 'limit';
                    } else if (docLen >= maxSize * 0.9) {
                        cmEditor.dataset.sizeWarning = 'near';
                    } else {
                        delete cmEditor.dataset.sizeWarning;
                    }
                }
            }),
        ],
    });

    view = new EditorView({
        state: startState,
        parent: mount,
    });

    // ── Compatibility shim on hidden textarea ──
    if (hiddenTextarea) {
        shimTextarea(hiddenTextarea);
    }

    // ── Expose global editor API ──
    window.editor = {
        getValue() {
            return view.state.doc.toString();
        },
        setValue(text) {
            view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: text },
            });
        },
        getCursorPosition() {
            return view.state.selection.main.head;
        },
        setSelection(from, to) {
            view.dispatch({ selection: { anchor: from, head: to } });
        },
        getView() {
            return view;
        },
        openSearch() {
            openSearchPanel(view);
        },
        closeSearch() {
            closeSearchPanel(view);
        },
        setFontSize(px) {
            currentFontSize = px;
            view.dispatch({
                effects: fontSizeCompartment.reconfigure(buildTheme(px)),
            });
        },
        setLanguage(diagramType) {
            const langFn = languageMap[diagramType];
            view.dispatch({
                effects: languageCompartment.reconfigure(langFn ? langFn() : []),
            });
        },
        focus() {
            view.focus();
        },
    };

    return view;
}

// ────────────────────────────────────────────
// Hidden textarea compatibility shim
// ────────────────────────────────────────────

/**
 * Override .value, .selectionStart, .setSelectionRange(), .focus(),
 * and style.borderLeftColor on the hidden textarea to route through CM6.
 */
function shimTextarea(textarea) {
    // Override .value
    Object.defineProperty(textarea, 'value', {
        get() {
            return view ? view.state.doc.toString() : '';
        },
        set(text) {
            if (view) {
                view.dispatch({
                    changes: { from: 0, to: view.state.doc.length, insert: text },
                });
            }
        },
        configurable: true,
    });

    // Override .selectionStart
    Object.defineProperty(textarea, 'selectionStart', {
        get() {
            return view ? view.state.selection.main.head : 0;
        },
        set(_val) {
            // no-op; use setSelectionRange
        },
        configurable: true,
    });

    // Override .selectionEnd
    Object.defineProperty(textarea, 'selectionEnd', {
        get() {
            return view ? view.state.selection.main.head : 0;
        },
        set(_val) {
            // no-op
        },
        configurable: true,
    });

    // Override .setSelectionRange()
    textarea.setSelectionRange = function (from, to) {
        if (view) {
            view.dispatch({ selection: { anchor: from, head: to } });
        }
    };

    // Override .focus()
    textarea.focus = function () {
        if (view) {
            view.focus();
        }
    };

    // Override style.borderLeftColor to apply to .cm-editor
    const originalStyle = textarea.style;
    const styleProxy = new Proxy(originalStyle, {
        set(target, prop, value) {
            if (prop === 'borderLeftColor') {
                const cmEditor = view?.dom;
                if (cmEditor) {
                    cmEditor.style.borderLeftColor = value;
                    cmEditor.style.borderLeftWidth = value ? '3px' : '';
                    cmEditor.style.borderLeftStyle = value ? 'solid' : '';
                }
                return true;
            }
            if (prop === 'fontSize') {
                // Font size changes should go through the CM6 compartment
                const px = parseInt(value, 10);
                if (!isNaN(px) && window.editor) {
                    window.editor.setFontSize(px);
                }
                return true;
            }
            target[prop] = value;
            return true;
        },
        get(target, prop) {
            if (prop === 'borderLeftColor') {
                const cmEditor = view?.dom;
                return cmEditor ? cmEditor.style.borderLeftColor : '';
            }
            const val = target[prop];
            if (typeof val === 'function') {
                return val.bind(target);
            }
            return val;
        },
    });

    Object.defineProperty(textarea, 'style', {
        get() {
            return styleProxy;
        },
        configurable: true,
    });
}
