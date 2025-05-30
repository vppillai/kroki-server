// Application state management
class AppState {
    constructor() {
        this.userHasEditedContent = false;
        this.currentDiagramData = null;
        this.currentDiagramType = 'plantuml';
        this.currentOutputFormat = 'svg';
        this.currentDiagramUrl = '';
        this.diagramUpdateTimer = null;

        // Zoom and pan state
        this.zoomState = {
            scale: 1,
            translateX: 0,
            translateY: 0,
            minScale: 0.1,
            maxScale: 5,
            scaleStep: 0.1,
            userHasInteracted: false // Track if user has manually zoomed/panned
        };

        // Cache for loaded examples
        this.exampleCache = {
            plantuml: `@startuml
Alice -> Bob: Hello
Bob --> Alice: Hi there
@enduml`
        };

        // File operations state
        this.currentFile = {
            name: null,
            path: null,
            content: '',
            saved: false,
            handle: null, // For File System Access API
            isOpen: false, // Track if we actually have a file open
            autoSaveEnabled: false // Track auto-save state
        };

        // Auto-save timer
        this.autoSaveTimer = null;
    }

    // Getters for read-only access to state
    get userEdited() { return this.userHasEditedContent; }
    get diagramData() { return this.currentDiagramData; }
    get diagramType() { return this.currentDiagramType; }
    get outputFormat() { return this.currentOutputFormat; }
    get diagramUrl() { return this.currentDiagramUrl; }
    get zoom() { return { ...this.zoomState }; }
    get file() { return { ...this.currentFile }; }
    get examples() { return { ...this.exampleCache }; }

    // Setters with validation
    setUserEdited(value) {
        this.userHasEditedContent = Boolean(value);
    }

    setDiagramData(data) {
        this.currentDiagramData = data;
    }

    setDiagramType(type) {
        if (typeof type === 'string' && type.trim()) {
            this.currentDiagramType = type;
        }
    }

    setOutputFormat(format) {
        if (typeof format === 'string' && format.trim()) {
            this.currentOutputFormat = format;
        }
    }

    setDiagramUrl(url) {
        this.currentDiagramUrl = url || '';
    }

    updateZoomState(updates) {
        this.zoomState = { ...this.zoomState, ...updates };
    }

    updateFileState(updates) {
        this.currentFile = { ...this.currentFile, ...updates };
    }

    addExample(type, content) {
        if (typeof type === 'string' && typeof content === 'string') {
            this.exampleCache[type] = content;
        }
    }

    setDiagramUpdateTimer(timer) {
        this.diagramUpdateTimer = timer;
    }

    clearDiagramUpdateTimer() {
        if (this.diagramUpdateTimer) {
            clearTimeout(this.diagramUpdateTimer);
            this.diagramUpdateTimer = null;
        }
    }

    setAutoSaveTimer(timer) {
        this.autoSaveTimer = timer;
    }

    clearAutoSaveTimer() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    // Reset state to defaults
    reset() {
        this.userHasEditedContent = false;
        this.currentDiagramData = null;
        this.currentDiagramType = 'plantuml';
        this.currentOutputFormat = 'svg';
        this.currentDiagramUrl = '';
        this.clearDiagramUpdateTimer();
        this.clearAutoSaveTimer();

        this.zoomState = {
            scale: 1,
            translateX: 0,
            translateY: 0,
            minScale: 0.1,
            maxScale: 5,
            scaleStep: 0.1,
            userHasInteracted: false
        };

        this.currentFile = {
            name: null,
            path: null,
            content: '',
            saved: false,
            handle: null,
            isOpen: false,
            autoSaveEnabled: false
        };
    }
}

// Create and export singleton instance
const appState = new AppState();
export default appState;
