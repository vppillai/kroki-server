/**
 * State Management Module
 * 
 * Centralized state management for the Kroki diagram editor.
 * Manages application state including diagram data, user interactions,
 * file operations, and UI state.
 * 
 * @author Vysakh Pillai
 */

import { DEFAULT_DEBOUNCE_DELAY, DEFAULT_AUTO_SAVE_DELAY, defaultExample } from './constants.js';

/**
 * Centralized application state
 */
export const state = {
    // User content modification tracking
    userHasEditedContent: false,

    // Current diagram data cache
    currentDiagramData: null,

    // Active diagram type identifier
    currentDiagramType: 'plantuml',

    // Current output format selection
    currentOutputFormat: 'svg',

    // Generated diagram URL for sharing and downloads
    currentDiagramUrl: '',

    // Debounce timer for diagram updates
    diagramUpdateTimer: null,

    // Auto-refresh feature state
    autoRefreshEnabled: true,

    // Configuration-driven timing constants
    DEBOUNCE_DELAY: DEFAULT_DEBOUNCE_DELAY,
    AUTO_SAVE_DELAY: DEFAULT_AUTO_SAVE_DELAY,

    // Zoom and pan interaction state
    zoomState: {
        scale: 1,
        translateX: 0,
        translateY: 0,
        minScale: 0.1,
        maxScale: 5,
        scaleStep: 0.1,
        userHasInteracted: false // Track if user has manually zoomed/panned
    },

    // File operations state management
    currentFile: {
        name: null,
        content: '',
        saved: false,
        handle: null, // For File System Access API
        isOpen: false, // Track if we actually have a file open
        autoSaveEnabled: false // Track auto-save state
    },

    // Auto-save timer reference
    autoSaveTimer: null,

    // Search state management
    searchState: {
        isVisible: false,
        currentQuery: '',
        matches: [],
        currentIndex: -1,
        caseSensitive: false,
        lastSearchValue: ''
    }
};

/**
 * Example code cache for diagram types
 * Prevents repeated network requests for example content
 */
const exampleCache = {
    plantuml: defaultExample
};

// State update functions
export function updateUserHasEditedContent(value) {
    state.userHasEditedContent = value;
}

export function updateCurrentDiagramData(data) {
    state.currentDiagramData = data;
}

export function updateCurrentDiagramType(type) {
    state.currentDiagramType = type;
}

export function updateCurrentOutputFormat(format) {
    state.currentOutputFormat = format;
}

export function updateCurrentDiagramUrl(url) {
    state.currentDiagramUrl = url;
}

export function updateDiagramUpdateTimer(timer) {
    state.diagramUpdateTimer = timer;
}

export function updateAutoRefreshEnabled(enabled) {
    state.autoRefreshEnabled = enabled;
}

export function updateDebounceDelay(delay) {
    state.DEBOUNCE_DELAY = delay;
}

export function updateAutoSaveDelay(delay) {
    state.AUTO_SAVE_DELAY = delay;
}

export function updateAutoSaveTimer(timer) {
    state.autoSaveTimer = timer;
}

export function updateCurrentFile(updates) {
    Object.assign(state.currentFile, updates);
}

export function updateZoomState(updates) {
    Object.assign(state.zoomState, updates);
}

export function updateSearchState(updates) {
    Object.assign(state.searchState, updates);
}

// Example cache functions
export function getExampleCache() {
    return exampleCache;
}

export function setExampleCache(type, content) {
    exampleCache[type] = content;
} 