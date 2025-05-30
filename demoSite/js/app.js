// Main application controller - orchestrates all modules
import { CONSTANTS } from './config/constants.js';
import appState from './core/state.js';
import DOMUtils from './utils/dom.js';

// Import all modules
import FileOperations from './modules/file-operations.js';
import ZoomPanControls from './modules/zoom-pan.js';
import DiagramManager from './modules/diagram-manager.js';
import URLHandler from './modules/url-handler.js';
import EditorManager from './modules/editor-manager.js';
import ThemeManager from './modules/theme-manager.js';
import FullscreenManager from './modules/fullscreen-manager.js';
import HelpManager from './modules/help-manager.js';
import DecodeManager from './modules/decode-manager.js';
import CopyLinkManager from './modules/copy-link-manager.js';
import ResizeManager from './modules/resize-manager.js';
import MessageManager from './modules/message-manager.js';

class KrokiApp {
    constructor() {
        this.modules = {};
        this.initialized = false;
    }

    /**
     * Initialize the application
     */
    async init() {
        if (this.initialized) {
            console.warn('KrokiApp already initialized');
            return;
        }

        try {
            console.log('Initializing Kroki application...');

            // Initialize core modules
            this.modules.messageManager = new MessageManager();
            this.modules.editorManager = new EditorManager();
            this.modules.diagramManager = new DiagramManager();
            this.modules.urlHandler = new URLHandler();
            this.modules.fileOperations = new FileOperations();
            this.modules.themeManager = new ThemeManager();

            // Initialize UI modules
            this.modules.zoomPanControls = new ZoomPanControls();
            this.modules.fullscreenManager = new FullscreenManager();
            this.modules.helpManager = new HelpManager();
            this.modules.decodeManager = new DecodeManager();
            this.modules.copyLinkManager = new CopyLinkManager();
            this.modules.resizeManager = new ResizeManager();

            // Make key modules globally available for backwards compatibility
            window.appState = appState;
            window.diagramManager = this.modules.diagramManager;
            window.editorManager = this.modules.editorManager;
            window.diagramZoomPan = this.modules.zoomPanControls;
            window.fullscreenMode = this.modules.fullscreenManager;
            window.messageManager = this.modules.messageManager;

            // Initialize app state and UI
            await this.initializeUI();
            this.setupGlobalEventListeners();

            this.initialized = true;
            console.log('Kroki application initialized successfully');

        } catch (error) {
            console.error('Failed to initialize Kroki application:', error);
            this.modules.messageManager?.showErrorMessage('Failed to initialize application');
        }
    }

    /**
     * Initialize UI components
     */
    async initializeUI() {
        // Initialize diagram type dropdown
        this.modules.diagramManager.initializeDiagramTypeDropdown();

        // Update format dropdown based on initial diagram type
        this.modules.diagramManager.updateFormatDropdown();

        // Process URL parameters
        this.modules.urlHandler.processUrlParameters(
            (type) => this.loadDefaultExample(type),
            () => this.modules.diagramManager.updateFormatDropdown(),
            () => this.modules.editorManager.updateLineNumbers()
        );

        // Initial UI setup
        this.modules.editorManager.updateLineNumbers();
        this.modules.resizeManager.initialize();

        // Load and display initial diagram
        await this.modules.diagramManager.updateDiagram(this.modules.zoomPanControls);

        // Initialize theme
        this.modules.themeManager.init();
    }

    /**
     * Load default example for diagram type
     * @param {string} diagramType - Type of diagram
     */
    async loadDefaultExample(diagramType) {
        try {
            const example = await this.modules.diagramManager.loadExampleForDiagramType(diagramType);
            this.modules.editorManager.setContent(example);
            appState.setUserEdited(false);
            await this.modules.diagramManager.updateDiagram(this.modules.zoomPanControls);
        } catch (error) {
            console.error('Failed to load default example:', error);
        }
    }

    /**
     * Set up global event listeners for the application
     */
    setupGlobalEventListeners() {
        // Editor content changes
        DOMUtils.addEventListener('code', 'input', () => this.handleEditorInput());

        // Editor scroll synchronization
        DOMUtils.addEventListener('code', 'scroll', () => {
            this.modules.editorManager.syncLineNumbersScroll();
        });

        // Diagram type changes
        DOMUtils.addEventListener('diagramType', 'change', async () => {
            await this.handleDiagramTypeChange();
        });

        // Output format changes
        DOMUtils.addEventListener('outputFormat', 'change', async () => {
            await this.modules.diagramManager.updateDiagram(this.modules.zoomPanControls);
        });

        // Download button
        DOMUtils.addEventListener('downloadButton', 'click', () => {
            this.modules.diagramManager.downloadDiagram();
        });

        // Page unload warning for unsaved changes
        window.addEventListener('beforeunload', (e) => {
            const file = appState.file;
            if (file.isOpen && !file.saved) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return 'You have unsaved changes. Are you sure you want to leave?';
            }
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.modules.resizeManager.adjustControlsLayout();
        });
    }

    /**
     * Handle editor input changes
     */
    handleEditorInput() {
        const code = DOMUtils.getValue('code').trim();
        const file = appState.file;

        // Mark content as edited if not empty
        if (code !== '') {
            appState.setUserEdited(true);
        }

        // Check if file content has changed
        if (file.isOpen && file.saved && DOMUtils.getValue('code') !== file.content) {
            this.modules.fileOperations.markFileAsModified();
        }

        // Update UI
        this.modules.editorManager.updateLineNumbers();
        this.modules.diagramManager.debounceUpdateDiagram();
        this.modules.diagramManager.updateUrl();
    }

    /**
     * Handle diagram type change
     */
    async handleDiagramTypeChange() {
        const diagramType = DOMUtils.getValue('diagramType');
        const currentCode = DOMUtils.getValue('code');

        // Update format dropdown
        this.modules.diagramManager.updateFormatDropdown();
        this.modules.diagramManager.updateUrl();

        // Load example if appropriate
        const isCodeEmpty = currentCode.trim() === '';
        const isCurrentCodeAnExample = Object.values(appState.examples).includes(currentCode);
        const userHasEdited = appState.userHasEditedContent;

        if (!userHasEdited || isCurrentCodeAnExample || isCodeEmpty) {
            await this.loadDefaultExample(diagramType);
        } else {
            this.modules.diagramManager.debounceUpdateDiagram();
        }
    }

    /**
     * Get module instance
     * @param {string} moduleName - Name of the module
     * @returns {Object} Module instance
     */
    getModule(moduleName) {
        return this.modules[moduleName];
    }

    /**
     * Check if application is initialized
     * @returns {boolean} Whether app is initialized
     */
    isInitialized() {
        return this.initialized;
    }
}

// Create and initialize the application
const krokiApp = new KrokiApp();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => krokiApp.init());
} else {
    // DOM is already ready
    krokiApp.init();
}

// Export for global access
window.krokiApp = krokiApp;
export default krokiApp;
