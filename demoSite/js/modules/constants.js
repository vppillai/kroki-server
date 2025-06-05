/**
 * Constants and Configuration Module
 * 
 * Centralized constants, default values, and format mappings for the Kroki diagram editor.
 * This module defines supported diagram types, output formats, and display behaviors.
 */

/**
 * Default diagram example code
 * @constant {string}
 */
export const defaultExample = `@startuml
Alice -> Bob: Hello
Bob --> Alice: Hi there
@enduml`;

/**
 * Supported output formats for each diagram type
 * Maps diagram types to their compatible export formats
 * @constant {Object.<string, string[]>}
 */
export const formatCompatibility = {
    blockdiag: ['png', 'svg', 'pdf'],
    bpmn: ['svg'],
    bytefield: ['svg'],
    seqdiag: ['png', 'svg', 'pdf'],
    actdiag: ['png', 'svg', 'pdf'],
    nwdiag: ['png', 'svg', 'pdf'],
    packetdiag: ['png', 'svg', 'pdf'],
    rackdiag: ['png', 'svg', 'pdf'],
    c4plantuml: ['png', 'svg', 'pdf', 'txt', 'base64'],
    d2: ['svg'],
    dbml: ['svg'],
    ditaa: ['png', 'svg'],
    diagramsnet: ['png', 'svg'],
    erd: ['png', 'svg', 'jpeg', 'pdf'],
    excalidraw: ['svg'],
    graphviz: ['png', 'svg', 'jpeg', 'pdf'],
    mermaid: ['png', 'svg'],
    nomnoml: ['svg'],
    pikchr: ['svg'],
    plantuml: ['png', 'svg', 'pdf', 'txt', 'base64'],
    structurizr: ['png', 'svg', 'pdf', 'txt', 'base64'],
    svgbob: ['svg'],
    symbolator: ['svg'],
    tikz: ['png', 'svg', 'jpeg', 'pdf'],
    //umlet: ['png', 'svg', 'jpeg'],
    vega: ['png', 'svg', 'pdf'],
    vegalite: ['png', 'svg', 'pdf'],
    wavedrom: ['svg'],
    wireviz: ['png', 'svg']
};

/**
 * Display behavior mapping for output formats
 * Defines how each format should be presented to the user
 * @constant {Object.<string, string>}
 */
export const formatDisplayTypes = {
    svg: 'image',
    png: 'image',
    jpeg: 'image',
    pdf: 'download',
    txt: 'text',
    base64: 'text'
};

/**
 * Default timing constants (can be overridden by configuration)
 */
export const DEFAULT_DEBOUNCE_DELAY = 1000; // Milliseconds delay for diagram updates
export const DEFAULT_AUTO_SAVE_DELAY = 2000; // Milliseconds delay for auto-save

// Re-export for backward compatibility
export const DEBOUNCE_DELAY = DEFAULT_DEBOUNCE_DELAY;
export const AUTO_SAVE_DELAY = DEFAULT_AUTO_SAVE_DELAY; 