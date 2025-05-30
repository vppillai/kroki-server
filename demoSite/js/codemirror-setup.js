// CodeMirror 6 setup with syntax highlighting for diagram languages
import { EditorView, basicSetup } from 'https://esm.sh/@codemirror/basic-setup@0.20.0';
import { EditorState } from 'https://esm.sh/@codemirror/state@6.2.1';
import { oneDark } from 'https://esm.sh/@codemirror/theme-one-dark@6.1.2';
import { javascript } from 'https://esm.sh/@codemirror/lang-javascript@6.2.1';
import { json } from 'https://esm.sh/@codemirror/lang-json@6.0.1';
import { xml } from 'https://esm.sh/@codemirror/lang-xml@6.0.2';
import { yaml } from 'https://esm.sh/@codemirror/lang-yaml@6.0.0';
import { python } from 'https://esm.sh/@codemirror/lang-python@6.1.3';
import { sql } from 'https://esm.sh/@codemirror/lang-sql@6.5.4';

// Language definitions for diagram types
const diagramLanguages = {
    plantuml: () => import('https://esm.sh/@codemirror/lang-java@6.0.1').then(m => m.java()), // PlantUML uses Java-like syntax
    mermaid: () => import('https://esm.sh/@codemirror/lang-javascript@6.2.1').then(m => m.javascript()), // Mermaid is JS-like
    graphviz: () => import('https://esm.sh/@codemirror/lang-cpp@6.0.2').then(m => m.cpp()), // DOT language is C-like
    d2: () => import('https://esm.sh/@codemirror/lang-javascript@6.2.1').then(m => m.javascript()), // D2 is JS-like
    structurizr: () => python(), // Structurizr uses Python
    dbml: () => sql(), // DBML is SQL-like
    bpmn: () => xml(), // BPMN is XML
    json: () => json(),
    xml: () => xml(),
    yaml: () => yaml(),
    javascript: () => javascript(),
    python: () => python(),
    default: () => null // Plain text
};

// Global CodeMirror instance
let editorView = null;
let currentLanguage = 'plantuml';

// Initialize CodeMirror editor
export function initializeCodeMirror(container, initialValue = '', language = 'plantuml') {
    currentLanguage = language;

    const extensions = [
        basicSetup,
        EditorView.theme({
            '&': {
                fontSize: '14px',
                fontFamily: '"JetBrains Mono", "Monaco", "Menlo", monospace'
            },
            '.cm-content': {
                padding: '12px',
                minHeight: '300px'
            },
            '.cm-focused': {
                outline: 'none'
            },
            '.cm-editor': {
                borderRadius: '6px',
                border: '1px solid var(--border-color)'
            },
            '.cm-scroller': {
                fontFamily: '"JetBrains Mono", "Monaco", "Menlo", monospace'
            }
        }),
        EditorView.updateListener.of((update) => {
            if (update.docChanged) {
                // Trigger the existing update logic
                if (window.handleCodeChange) {
                    window.handleCodeChange();
                }
            }
        })
    ];

    // Add language support if available
    const langExtension = getLanguageExtension(language);
    if (langExtension) {
        extensions.push(langExtension);
    }

    const state = EditorState.create({
        doc: initialValue,
        extensions
    });

    editorView = new EditorView({
        state,
        parent: container
    });

    return editorView;
}

// Get language extension for diagram type
function getLanguageExtension(language) {
    switch (language) {
        case 'plantuml':
        case 'c4plantuml':
            // Custom PlantUML-like highlighting
            return getPlantUMLExtension();
        case 'mermaid':
            return getMermaidExtension();
        case 'graphviz':
        case 'dot':
            return getGraphvizExtension();
        case 'd2':
            return getD2Extension();
        case 'structurizr':
            return python();
        case 'dbml':
            return sql();
        case 'bpmn':
        case 'diagramsnet':
            return xml();
        case 'json':
            return json();
        case 'xml':
            return xml();
        case 'yaml':
        case 'yml':
            return yaml();
        case 'javascript':
        case 'js':
            return javascript();
        case 'python':
        case 'py':
            return python();
        default:
            return null;
    }
}

// Custom PlantUML syntax highlighting
function getPlantUMLExtension() {
    return javascript().configure({
        // Basic PlantUML keywords highlighting
        keywords: [
            '@startuml', '@enduml', '@startmindmap', '@endmindmap',
            'participant', 'actor', 'boundary', 'control', 'entity', 'database',
            'activate', 'deactivate', 'note', 'left', 'right', 'over',
            'title', 'header', 'footer', 'legend', 'end legend',
            'if', 'else', 'endif', 'while', 'endwhile',
            'alt', 'else', 'end', 'opt', 'loop', 'par',
            'class', 'interface', 'abstract', 'enum',
            'package', 'namespace', 'component', 'node'
        ]
    });
}

// Custom Mermaid syntax highlighting
function getMermaidExtension() {
    return javascript().configure({
        keywords: [
            'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram',
            'gantt', 'pie', 'journey', 'gitgraph', 'erDiagram',
            'TD', 'TB', 'BT', 'RL', 'LR',
            'participant', 'actor', 'note', 'loop', 'alt', 'else', 'opt', 'par',
            'title', 'dateFormat', 'axisFormat',
            'class', 'click', 'callback'
        ]
    });
}

// Custom Graphviz/DOT syntax highlighting
function getGraphvizExtension() {
    return javascript().configure({
        keywords: [
            'digraph', 'graph', 'subgraph', 'node', 'edge',
            'strict', 'rankdir', 'size', 'ratio', 'label',
            'shape', 'style', 'color', 'fillcolor', 'fontcolor',
            'fontsize', 'fontname', 'penwidth', 'arrowhead', 'arrowtail'
        ]
    });
}

// Custom D2 syntax highlighting
function getD2Extension() {
    return javascript().configure({
        keywords: [
            'shape', 'style', 'label', 'icon', 'constraint',
            'direction', 'near', 'vars', 'scenarios', 'steps'
        ]
    });
}

// Update editor language
export function updateEditorLanguage(language) {
    if (!editorView) return;

    currentLanguage = language;
    const langExtension = getLanguageExtension(language);

    // Get current content
    const currentContent = editorView.state.doc.toString();

    // Create new state with updated language
    const extensions = [
        basicSetup,
        EditorView.theme({
            '&': {
                fontSize: '14px',
                fontFamily: '"JetBrains Mono", "Monaco", "Menlo", monospace'
            },
            '.cm-content': {
                padding: '12px',
                minHeight: '300px'
            },
            '.cm-focused': {
                outline: 'none'
            },
            '.cm-editor': {
                borderRadius: '6px',
                border: '1px solid var(--border-color)'
            },
            '.cm-scroller': {
                fontFamily: '"JetBrains Mono", "Monaco", "Menlo", monospace'
            }
        }),
        EditorView.updateListener.of((update) => {
            if (update.docChanged) {
                if (window.handleCodeChange) {
                    window.handleCodeChange();
                }
            }
        })
    ];

    if (langExtension) {
        extensions.push(langExtension);
    }

    const newState = EditorState.create({
        doc: currentContent,
        extensions
    });

    editorView.setState(newState);
}

// Get editor content
export function getEditorContent() {
    return editorView ? editorView.state.doc.toString() : '';
}

// Set editor content
export function setEditorContent(content) {
    if (!editorView) return;

    const transaction = editorView.state.update({
        changes: {
            from: 0,
            to: editorView.state.doc.length,
            insert: content
        }
    });

    editorView.dispatch(transaction);
}

// Get current language
export function getCurrentLanguage() {
    return currentLanguage;
}

// Clean up editor
export function destroyEditor() {
    if (editorView) {
        editorView.destroy();
        editorView = null;
    }
}

// Focus editor
export function focusEditor() {
    if (editorView) {
        editorView.focus();
    }
}

// Export for global access
window.CodeMirrorEditor = {
    initializeCodeMirror,
    updateEditorLanguage,
    getEditorContent,
    setEditorContent,
    getCurrentLanguage,
    destroyEditor,
    focusEditor
};
