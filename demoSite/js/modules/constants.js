/**
 * Constants and Configuration Module
 * 
 * Centralized constants, default values, and format mappings for the Kroki diagram editor.
 * This module defines supported diagram types, output formats, and display behaviors.
 * 
 * @module constants
 * @author Vysakh Pillai
 */

// ========================================
// DEFAULT VALUES
// ========================================

/**
 * Default diagram example code for new files
 * Shows a simple PlantUML sequence diagram
 * 
 * @constant {string}
 * @example
 * // Usage in other modules:
 * import { defaultExample } from './constants.js';
 * codeTextarea.value = defaultExample;
 */
export const defaultExample = `@startuml
Alice -> Bob: Hello
Bob --> Alice: Hi there
@enduml`;

// ========================================
// DIAGRAM TYPE CONFIGURATIONS
// ========================================

/**
 * Supported output formats for each diagram type
 * Maps diagram types to their compatible export formats
 * 
 * @constant {Object.<string, string[]>}
 * @property {string[]} blockdiag - Block diagram formats
 * @property {string[]} bpmn - Business Process Model formats
 * @property {string[]} plantuml - PlantUML formats
 * @property {string[]} mermaid - Mermaid diagram formats
 * // ... etc
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
    vega: ['png', 'svg', 'pdf'],
    vegalite: ['png', 'svg', 'pdf'],
    wavedrom: ['svg'],
    wireviz: ['png', 'svg']
};

// ========================================
// FORMAT DISPLAY CONFIGURATIONS
// ========================================

/**
 * Display behavior mapping for output formats
 * Defines how each format should be presented to the user
 * 
 * @constant {Object.<string, string>}
 * @property {'image'} svg - Display as image in viewport
 * @property {'image'} png - Display as image in viewport
 * @property {'image'} jpeg - Display as image in viewport
 * @property {'download'} pdf - Trigger download
 * @property {'text'} txt - Display as text preview
 * @property {'text'} base64 - Display as text preview
 */
export const formatDisplayTypes = {
    svg: 'image',
    png: 'image',
    jpeg: 'image',
    pdf: 'download',
    txt: 'text',
    base64: 'text'
};

// ========================================
// TIMING CONSTANTS
// ========================================

/**
 * Default debounce delay for diagram updates
 * Prevents excessive API calls during rapid typing
 * 
 * @constant {number} - Milliseconds
 * @default 1000
 */
export const DEFAULT_DEBOUNCE_DELAY = 1000;

/**
 * Default delay for auto-save operations
 * Time between automatic file saves when enabled
 * 
 * @constant {number} - Milliseconds
 * @default 2000
 */
export const DEFAULT_AUTO_SAVE_DELAY = 2000;

/**
 * Default delay for auto-reload file monitoring
 * Time between file change checks when auto-reload is enabled
 * 
 * @constant {number} - Milliseconds
 * @default 1000
 */
export const DEFAULT_AUTO_RELOAD_DELAY = 1000;

// Legacy exports for backward compatibility
export const DEBOUNCE_DELAY = DEFAULT_DEBOUNCE_DELAY;
export const AUTO_SAVE_DELAY = DEFAULT_AUTO_SAVE_DELAY;
export const AUTO_RELOAD_DELAY = DEFAULT_AUTO_RELOAD_DELAY;

// ========================================
// API CONSTANTS
// ========================================

/**
 * Default URL length threshold for switching to POST requests
 * When diagram URLs exceed this length, POST requests are used automatically
 * 
 * @constant {number} - Character count
 * @default 4096
 */
export const DEFAULT_URL_LENGTH_THRESHOLD = 4096;

/**
 * Default timeout for POST requests to Kroki API
 * Maximum time to wait for POST request completion
 * 
 * @constant {number} - Milliseconds
 * @default 30000
 */
export const DEFAULT_POST_REQUEST_TIMEOUT = 30000;

// ========================================