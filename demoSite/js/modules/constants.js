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
// UI DIMENSION CONSTANTS
// ========================================

/** Width threshold (px) below which diagram controls stack vertically */
export const CONTROLS_STACK_THRESHOLD_PX = 350;

/** Padding (px) around diagram when fitting to screen */
export const ZOOM_FIT_PADDING_PX = 40;

// ========================================
// ZOOM CONSTANTS
// ========================================

/** Minimum zoom scale */
export const MIN_SCALE = 0.1;

/** Maximum zoom scale */
export const MAX_SCALE = 5;

/** Zoom increment/decrement step */
export const SCALE_STEP = 0.1;

/** Double-click detection threshold in milliseconds */
export const DOUBLE_CLICK_THRESHOLD_MS = 300;

// ========================================
// AI CONSTANTS
// ========================================

/** Token limit for AI responses */
export const AI_MAX_TOKENS = 16000;

/** Default AI temperature */
export const AI_TEMPERATURE = 0.7;

/** Maximum retry attempts for AI requests */
export const AI_MAX_RETRY_ATTEMPTS = 3;

/** Maximum number of messages to keep in chat history */
export const MAX_MESSAGE_HISTORY = 50;

/** Minimum input height for AI chat input (px) */
export const AI_MIN_INPUT_HEIGHT_PX = 60;

// ========================================
// FILE CONSTANTS
// ========================================

/** Maximum file size in bytes (10 MB) */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Default max text size for editor (1 MB, matches Kroki's default POST body limit) */
export const DEFAULT_MAX_TEXT_SIZE = 1048576;

// ========================================
// UI FEEDBACK TIMING CONSTANTS
// ========================================

/** Duration to show success feedback messages (ms) */
export const SUCCESS_FEEDBACK_MS = 1500;

/** Duration to show error display messages (ms) */
export const ERROR_DISPLAY_MS = 5000;

/** General animation delay (ms) */
export const ANIMATION_DELAY_MS = 300;

/** Delay before cleaning up blob URLs (ms) */
export const BLOB_CLEANUP_DELAY_MS = 1000;

// ========================================
// CONFIG CONSTANTS
// ========================================

/** Maximum length for config string values */
export const MAX_CONFIG_STRING_LENGTH = 10000;