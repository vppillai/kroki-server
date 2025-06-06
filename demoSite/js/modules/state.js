/**
 * State Management Module
 * 
 * Centralized state management for the Kroki diagram editor.
 * Manages application state including diagram data, user interactions,
 * file operations, and UI state.
 * 
 * @module state
 * @author Vysakh Pillai
 */

import { DEFAULT_DEBOUNCE_DELAY, DEFAULT_AUTO_SAVE_DELAY, defaultExample } from './constants.js';

// ========================================
// APPLICATION STATE
// ========================================

/**
 * Centralized application state object
 * All mutable state for the application is stored here
 * 
 * @constant {Object}
 */
export const state = {
    // ---- Content & Editing State ----
    /**
     * @property {boolean} userHasEditedContent - Whether user has modified content
     */
    userHasEditedContent: false,

    /**
     * @property {*} currentDiagramData - Cached diagram data (image URL or text)
     */
    currentDiagramData: null,

    // ---- Diagram Configuration ----
    /**
     * @property {string} currentDiagramType - Active diagram type (e.g., 'plantuml', 'mermaid')
     */
    currentDiagramType: 'plantuml',

    /**
     * @property {string} currentOutputFormat - Current output format (e.g., 'svg', 'png')
     */
    currentOutputFormat: 'svg',

    /**
     * @property {string} currentDiagramUrl - Generated Kroki URL for current diagram
     */
    currentDiagramUrl: '',

    // ---- Update & Timing State ----
    /**
     * @property {number|null} diagramUpdateTimer - Debounce timer ID
     */
    diagramUpdateTimer: null,

    /**
     * @property {boolean} autoRefreshEnabled - Whether auto-refresh is active
     */
    autoRefreshEnabled: true,

    /**
     * @property {number} DEBOUNCE_DELAY - Configurable debounce delay (ms)
     */
    DEBOUNCE_DELAY: DEFAULT_DEBOUNCE_DELAY,

    /**
     * @property {number} AUTO_SAVE_DELAY - Configurable auto-save delay (ms)
     */
    AUTO_SAVE_DELAY: DEFAULT_AUTO_SAVE_DELAY,

    // ---- Zoom & Pan State ----
    /**
     * @property {Object} zoomState - Zoom and pan interaction state
     */
    zoomState: {
        scale: 1,                    // Current zoom level
        translateX: 0,               // X-axis translation
        translateY: 0,               // Y-axis translation
        minScale: 0.1,              // Minimum allowed zoom
        maxScale: 5,                // Maximum allowed zoom
        scaleStep: 0.1,             // Zoom increment/decrement amount
        userHasInteracted: false    // Whether user manually zoomed/panned
    },

    // ---- File Management State ----
    /**
     * @property {Object} currentFile - Current file information and state
     */
    currentFile: {
        name: null,             // Filename
        content: '',            // File content
        saved: false,           // Save status
        handle: null,           // File System Access API handle
        isOpen: false,          // Whether a file is actually open
        autoSaveEnabled: false, // Auto-save toggle state
        autoReloadEnabled: true // Auto-reload toggle state (enabled by default)
    },

    /**
     * @property {number|null} autoSaveTimer - Auto-save interval timer ID
     */
    autoSaveTimer: null,

    // ---- File Monitoring State ----
    /**
     * @property {Object} fileMonitoring - File monitoring state and timers
     */
    fileMonitoring: {
        watchTimer: null,       // File watching interval timer ID
        lastModified: null,     // Last modification timestamp
        isWatching: false       // Whether file monitoring is active
    },

    // ---- Search State ----
    /**
     * @property {Object} searchState - Text search functionality state
     */
    searchState: {
        isVisible: false,       // Search bar visibility
        currentQuery: '',       // Current search term
        matches: [],            // Array of match objects
        currentIndex: -1,       // Current match index
        caseSensitive: false,   // Case sensitivity toggle
        lastSearchValue: ''     // Previous search for comparison
    }
};

// ========================================
// EXAMPLE CACHE
// ========================================

/**
 * Example code cache for diagram types
 * Prevents repeated network requests for example content
 * 
 * @private
 * @type {Object.<string, string>}
 */
const exampleCache = {
    plantuml: defaultExample
};

// ========================================
// STATE UPDATE FUNCTIONS
// ========================================

/**
 * Update user edit status
 * @param {boolean} value - Whether user has edited content
 */
export function updateUserHasEditedContent(value) {
    state.userHasEditedContent = value;
}

/**
 * Update cached diagram data
 * @param {*} data - Diagram data (URL or text content)
 */
export function updateCurrentDiagramData(data) {
    state.currentDiagramData = data;
}

/**
 * Update current diagram type
 * @param {string} type - Diagram type identifier
 */
export function updateCurrentDiagramType(type) {
    state.currentDiagramType = type;
}

/**
 * Update current output format
 * @param {string} format - Output format (svg, png, etc.)
 */
export function updateCurrentOutputFormat(format) {
    state.currentOutputFormat = format;
}

/**
 * Update current diagram URL
 * @param {string} url - Generated Kroki URL
 */
export function updateCurrentDiagramUrl(url) {
    state.currentDiagramUrl = url;
}

/**
 * Update diagram update timer
 * @param {number|null} timer - Timer ID or null
 */
export function updateDiagramUpdateTimer(timer) {
    state.diagramUpdateTimer = timer;
}

/**
 * Update auto-refresh enabled state
 * @param {boolean} enabled - Whether auto-refresh is enabled
 */
export function updateAutoRefreshEnabled(enabled) {
    state.autoRefreshEnabled = enabled;
}

/**
 * Update debounce delay
 * @param {number} delay - New debounce delay in milliseconds
 */
export function updateDebounceDelay(delay) {
    state.DEBOUNCE_DELAY = delay;
}

/**
 * Update auto-save delay
 * @param {number} delay - New auto-save delay in milliseconds
 */
export function updateAutoSaveDelay(delay) {
    state.AUTO_SAVE_DELAY = delay;
}

/**
 * Update auto-save timer
 * @param {number|null} timer - Timer ID or null
 */
export function updateAutoSaveTimer(timer) {
    state.autoSaveTimer = timer;
}

/**
 * Update current file state with partial updates
 * @param {Object} updates - Partial file state object to merge
 */
export function updateCurrentFile(updates) {
    Object.assign(state.currentFile, updates);
}

/**
 * Update zoom state with partial updates
 * @param {Object} updates - Partial zoom state object to merge
 */
export function updateZoomState(updates) {
    Object.assign(state.zoomState, updates);
}

/**
 * Update search state with partial updates
 * @param {Object} updates - Partial search state object to merge
 */
export function updateSearchState(updates) {
    Object.assign(state.searchState, updates);
}

/**
 * Update file monitoring state with partial updates
 * @param {Object} updates - Partial file monitoring state object to merge
 */
export function updateFileMonitoring(updates) {
    Object.assign(state.fileMonitoring, updates);
}

// ========================================
// EXAMPLE CACHE FUNCTIONS
// ========================================

/**
 * Get the entire example cache
 * @returns {Object.<string, string>} Example cache object
 */
export function getExampleCache() {
    return exampleCache;
}

/**
 * Set example code for a specific diagram type
 * @param {string} type - Diagram type identifier
 * @param {string} content - Example code content
 */
export function setExampleCache(type, content) {
    exampleCache[type] = content;
} 