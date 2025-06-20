/**
 * Configuration Settings UI Component
 * 
 * Manages the comprehensive settings interface for the Kroki diagram editor.
 * Provides tabbed configuration panels for different aspects of the application
 * including general settings, editor preferences, zoom controls, layout options,
 * AI assistant configuration, and advanced features.
 * 
 * Organization:
 * - INITIALIZATION METHODS: Constructor and setup logic
 * - UI CREATION METHODS: Modal HTML generation and structure
 * - EVENT HANDLING METHODS: User interaction handlers and listeners
 * - TAB MANAGEMENT: Tab switching and content organization
 * - CONFIGURATION MANAGEMENT: Loading, saving, and validation
 * - IMPORT/EXPORT FUNCTIONALITY: Settings backup and restore
 * - UI STATE MANAGEMENT: Visual feedback and status updates
 * - UTILITY METHODS: Helper functions and form handling
 * 
 * @class ConfigUI
 * @author Kroki Team
 * @version 1.0.0
 */
class ConfigUI {
    /**
     * Initialize the Configuration UI component
     * 
     * @param {Object} configManager - The configuration manager instance for persistent settings
     */
    constructor(configManager) {
        // ========================================
        // CONFIGURATION STATE
        // ========================================
        /** @type {Object} Configuration manager instance */
        this.configManager = configManager;

        /** @type {Object} Temporary configuration changes before saving */
        this.tempConfig = {};

        // ========================================
        // UI STATE
        // ========================================
        /** @type {HTMLElement|null} The modal dialog element */
        this.modal = null;

        /** @type {string} Currently active configuration tab */
        this.activeTab = 'general';

        /** @type {boolean} Flag indicating if there are unsaved changes */
        this.unsavedChanges = false;

        // Initialize the UI
        this.init();
    }

    // ========================================
    // INITIALIZATION METHODS
    // ========================================

    /**
     * Initialize the configuration UI component
     * Sets up the modal dialog and event listeners
     * 
     * @private
     */
    init() {
        this.createModal();
        this.setupEventListeners();
    }

    // ========================================
    // UI CREATION METHODS
    // ========================================

    /**
     * Create the modal dialog HTML structure
     * Generates the complete configuration interface with all tabs and settings
     * 
     * @private
     */

    createModal() {
        const modalHTML = `
            <div id="config-modal" class="config-modal">
                <div class="config-modal-content">
                    <div class="config-modal-header">
                        <h3>⚙️ Settings & Preferences</h3>
                        <button id="config-modal-close" class="config-modal-close">&times;</button>
                    </div>
                    <div class="config-modal-body">
                        <div class="config-tabs">
                            <button class="config-tab active" data-tab="general">General</button>
                            <button class="config-tab" data-tab="editor">Editor</button>
                            <button class="config-tab" data-tab="zoom">Zoom & Pan</button>
                            <button class="config-tab" data-tab="layout">Layout</button>
                            <button class="config-tab" data-tab="ai">AI Assistant</button>
                            <button class="config-tab" data-tab="advanced">Advanced</button>
                            <button class="config-tab" data-tab="about">About</button>
                        </div>
                        
                        <div id="config-tab-general" class="config-tab-content active">
                            <div class="config-section">
                                <h4 class="config-section-title">Appearance</h4>
                                <div class="config-group">
                                    <div class="config-field">
                                        <label class="config-label">Theme</label>
                                        <select class="config-select" data-config="theme">
                                            <option value="light">Light</option>
                                            <option value="dark">Dark</option>
                                            <option value="auto">Auto (System)</option>
                                        </select>
                                        <div class="config-description">Choose the color theme for the editor</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="config-section">
                                <h4 class="config-section-title">Behavior</h4>
                                <div class="config-group">
                                    <div class="config-field config-field-horizontal">
                                        <label class="config-label config-checkbox">
                                            <input type="checkbox" data-config="autoRefresh">
                                            <span class="config-checkbox-mark"></span>
                                            <span class="config-checkbox-label">Auto-refresh Diagrams</span>
                                        </label>
                                        <div class="config-description">Automatically update diagrams as you type</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div id="config-tab-editor" class="config-tab-content">
                            <div class="config-section">
                                <h4 class="config-section-title">Editor Settings</h4>
                                <div class="config-group">
                                    <div class="config-field">
                                        <label class="config-label">Tab Size</label>
                                        <div class="config-range">
                                            <input type="range" min="1" max="8" class="config-input" data-config="editor.tabSize">
                                            <span class="config-range-value">4</span>
                                        </div>
                                        <div class="config-description">Number of spaces for tab indentation</div>
                                    </div>
                                    
                                    <div class="config-field">
                                        <label class="config-label">Font Size</label>
                                        <div class="config-range">
                                            <input type="range" min="10" max="24" class="config-input" data-config="editor.fontSize">
                                            <span class="config-range-value">14px</span>
                                        </div>
                                        <div class="config-description">Font size for the code editor</div>
                                    </div>
                                    
                                    <div class="config-field">
                                        <label class="config-label">Diagram Update Delay</label>
                                        <div class="config-range">
                                            <input type="range" min="100" max="5000" step="100" class="config-input" data-config="editor.debounceDelay">
                                            <span class="config-range-value">1000ms</span>
                                        </div>
                                        <div class="config-description">Time to wait before updating diagram while typing</div>
                                    </div>
                                    
                                    <div class="config-field">
                                        <label class="config-label">Auto-reload Monitoring Delay</label>
                                        <div class="config-range">
                                            <input type="range" min="500" max="5000" step="250" class="config-input" data-config="editor.autoReloadDelay">
                                            <span class="config-range-value">1000ms</span>
                                        </div>
                                        <div class="config-description">Time between file change checks when auto-reload is enabled</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="config-section">
                                <h4 class="config-section-title">Auto-Save</h4>
                                <div class="config-group">
                                    <div class="config-field config-field-horizontal">
                                        <label class="config-label config-checkbox">
                                            <input type="checkbox" data-config="editor.autoSave">
                                            <span class="config-checkbox-mark"></span>
                                            <span class="config-checkbox-label">Enable Auto-save</span>
                                        </label>
                                        <div class="config-description">Automatically save file changes</div>
                                    </div>
                                    
                                    <div class="config-field">
                                        <label class="config-label">Auto-save Delay</label>
                                        <div class="config-range">
                                            <input type="range" min="500" max="10000" step="500" class="config-input" data-config="editor.autoSaveDelay">
                                            <span class="config-range-value">2000ms</span>
                                        </div>
                                        <div class="config-description">Time to wait before auto-saving changes</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div id="config-tab-zoom" class="config-tab-content">
                            <div class="config-section">
                                <h4 class="config-section-title">Zoom Settings</h4>
                                <div class="config-group">
                                    <div class="config-field">
                                        <label class="config-label">Minimum Zoom</label>
                                        <div class="config-range">
                                            <input type="range" min="0.05" max="1.0" step="0.05" class="config-input" data-config="zoom.minScale">
                                            <span class="config-range-value">10%</span>
                                        </div>
                                        <div class="config-description">Minimum zoom level for diagrams</div>
                                    </div>
                                    
                                    <div class="config-field">
                                        <label class="config-label">Maximum Zoom</label>
                                        <div class="config-range">
                                            <input type="range" min="2.0" max="10.0" step="0.5" class="config-input" data-config="zoom.maxScale">
                                            <span class="config-range-value">500%</span>
                                        </div>
                                        <div class="config-description">Maximum zoom level for diagrams</div>
                                    </div>
                                    
                                    <div class="config-field">
                                        <label class="config-label">Zoom Step</label>
                                        <div class="config-range">
                                            <input type="range" min="0.05" max="0.5" step="0.05" class="config-input" data-config="zoom.scaleStep">
                                            <span class="config-range-value">10%</span>
                                        </div>
                                        <div class="config-description">Amount to zoom in/out per step</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="config-section">
                                <h4 class="config-section-title">Pan Settings</h4>
                                <div class="config-group">
                                    <div class="config-field">
                                        <label class="config-label">Fit-to-Screen Padding</label>
                                        <div class="config-range">
                                            <input type="range" min="0" max="100" step="10" class="config-input" data-config="zoom.resetPadding">
                                            <span class="config-range-value">40px</span>
                                        </div>
                                        <div class="config-description">Padding around diagram when fitting to screen</div>
                                    </div>
                                    
                                    <div class="config-field config-field-horizontal">
                                        <label class="config-label config-checkbox">
                                            <input type="checkbox" data-config="zoom.preserveStateOnUpdate">
                                            <span class="config-checkbox-mark"></span>
                                            <span class="config-checkbox-label">Preserve Zoom on Update</span>
                                        </label>
                                        <div class="config-description">Keep zoom level and position when diagram updates</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div id="config-tab-layout" class="config-tab-content">
                            <div class="config-section">
                                <h4 class="config-section-title">Panel Layout</h4>
                                <div class="config-group">
                                    <div class="config-field">
                                        <label class="config-label">Editor Width</label>
                                        <div class="config-range">
                                            <input type="range" min="20" max="80" class="config-input" data-config="layout.editorWidth">
                                            <span class="config-range-value">33%</span>
                                        </div>
                                        <div class="config-description">Width of the editor panel as percentage</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="config-section">
                                <h4 class="config-section-title">UI Elements</h4>
                                <div class="config-group">
                                    <div class="config-field config-field-horizontal">
                                        <label class="config-label config-checkbox">
                                            <input type="checkbox" data-config="layout.showToolbar">
                                            <span class="config-checkbox-mark"></span>
                                            <span class="config-checkbox-label">Show Toolbar</span>
                                        </label>
                                    </div>
                                    
                                    <div class="config-field config-field-horizontal">
                                        <label class="config-label config-checkbox">
                                            <input type="checkbox" data-config="layout.showZoomControls">
                                            <span class="config-checkbox-mark"></span>
                                            <span class="config-checkbox-label">Show Zoom Controls</span>
                                        </label>
                                    </div>
                                    
                                    <div class="config-field config-field-horizontal">
                                        <label class="config-label config-checkbox">
                                            <input type="checkbox" data-config="layout.showFileStatus">
                                            <span class="config-checkbox-mark"></span>
                                            <span class="config-checkbox-label">Show File Status</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div id="config-tab-ai" class="config-tab-content">
                            <div class="config-section">
                                <h4 class="config-section-title">AI Assistant</h4>
                                <div class="config-group">
                                    <div class="config-field config-field-horizontal">
                                        <label class="config-label config-checkbox">
                                            <input type="checkbox" data-config="ai.enabled" checked>
                                            <span class="config-checkbox-mark"></span>
                                            <span class="config-checkbox-label">Enable AI Assistant</span>
                                        </label>
                                        <div class="config-description">Show the AI Assistant button and chat interface</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="config-section">
                                <h4 class="config-section-title">API Configuration</h4>
                                <div class="config-group">
                                    <div class="config-field config-field-horizontal">
                                        <label class="config-label config-checkbox">
                                            <input type="checkbox" data-config="ai.useCustomAPI" id="ai-use-custom-api">
                                            <span class="config-checkbox-mark"></span>
                                            <span class="config-checkbox-label">Use Custom API Configuration</span>
                                        </label>
                                        <div class="config-description">Enable to configure your own AI API endpoint and key. Otherwise, the default backend proxy will be used.</div>
                                    </div>
                                    
                                    <div class="config-field" data-depends="ai.useCustomAPI">
                                        <label class="config-label">AI Endpoint URL</label>
                                        <input type="text" class="config-input" data-config="ai.endpoint" placeholder="https://api.openai.com/v1/chat/completions">
                                        <div class="config-description">API endpoint for AI chat completions</div>
                                    </div>
                                    
                                    <div class="config-field" data-depends="ai.useCustomAPI">
                                        <label class="config-label">API Key</label>
                                        <div class="password-input-container">
                                            <input type="password" class="config-input" data-config="ai.apiKey" placeholder="sk-..." id="ai-api-key-input">
                                            <button type="button" class="password-toggle-btn" id="api-key-toggle" aria-label="Toggle password visibility">
                                                <svg class="eye-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/>
                                                </svg>
                                                <svg class="eye-slash-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: none;">
                                                    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" fill="currentColor"/>
                                                </svg>
                                            </button>
                                        </div>
                                        <div class="config-description">Your API key for the AI service</div>
                                    </div>
                                    
                                    <div class="config-field" data-depends="ai.useCustomAPI">
                                        <label class="config-label">AI Model</label>
                                        <select class="config-select" data-config="ai.model">
                                            <option value="gpt-4.1">GPT-4.1</option>
                                            <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                                            <option value="gpt-4.1-nano">GPT-4.1 Nano</option>
                                            <option value="gpt-4.5-preview">GPT-4.5 Preview</option>
                                            <option value="gpt-4o">GPT-4o</option>
                                            <option value="gpt-4o-mini">GPT-4o Mini</option>
                                            <option value="o4-mini">O4 Mini</option>
                                            <option value="o3">O3</option>
                                            <option value="o3-mini">O3 Mini</option>
                                            <option value="custom">Custom</option>
                                        </select>
                                        <div class="config-description">Choose the AI model to use for diagram assistance</div>
                                    </div>
                                    
                                    <div class="config-field" data-depends="ai.useCustomAPI" id="custom-model-field" style="display: none;">
                                        <label class="config-label">Custom Model Name</label>
                                        <input type="text" class="config-input" data-config="ai.customModel" placeholder="Enter custom model name">
                                        <div class="config-description">Specify the exact model name for custom models</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="config-section">
                                <h4 class="config-section-title">Behavior Settings</h4>
                                <div class="config-group">
                                    <div class="config-field">
                                        <label class="config-label">Maximum Retry Attempts</label>
                                        <div class="config-range">
                                            <input type="range" min="1" max="5" step="1" class="config-input" data-config="ai.maxRetryAttempts">
                                            <span class="config-range-value">3</span>
                                        </div>
                                        <div class="config-description">Number of times to retry failed diagram validation</div>
                                    </div>
                                    
                                    <div class="config-field config-field-horizontal">
                                        <label class="config-label config-checkbox">
                                            <input type="checkbox" data-config="ai.autoValidate" checked>
                                            <span class="config-checkbox-mark"></span>
                                            <span class="config-checkbox-label">Auto-validate Generated Code</span>
                                        </label>
                                        <div class="config-description">Automatically validate AI-generated diagram code with Kroki</div>
                                    </div>
                                    
                                    <div class="config-field" data-depends="ai.useCustomAPI">
                                        <label class="config-label">Custom User Prompt Template</label>
                                        <textarea 
                                            class="config-input config-textarea" 
                                            data-config="ai.userPromptTemplate" 
                                            rows="6"
                                            placeholder="Use {{diagramType}}, {{currentCode}}, and {{userPrompt}} as placeholders"
                                        ></textarea>
                                        <div class="config-description">Template for AI prompts. Only available when using custom API configuration.</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="config-section">
                                <h4 class="config-section-title">Privacy & Performance</h4>
                                <div class="config-group">
                                    <div class="config-field">
                                        <label class="config-label">Request Timeout (seconds)</label>
                                        <div class="config-range">
                                            <input type="range" min="10" max="120" step="5" class="config-input" data-config="ai.timeout">
                                            <span class="config-range-value">30</span>
                                        </div>
                                        <div class="config-description">Timeout for AI API requests</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div id="config-tab-advanced" class="config-tab-content">
                            <div class="config-section">
                                <h4 class="config-section-title">File Operations</h4>
                                <div class="config-group">
                                    <div class="config-field">
                                        <label class="config-label">Default Diagram Type</label>
                                        <select class="config-select" data-config="file.defaultDiagramType">
                                            <option value="plantuml">PlantUML</option>
                                            <option value="mermaid">Mermaid</option>
                                            <option value="graphviz">Graphviz</option>
                                            <option value="ditaa">Ditaa</option>
                                        </select>
                                        <div class="config-description">Default diagram type for new files</div>
                                    </div>
                                    
                                    <div class="config-field config-field-horizontal">
                                        <label class="config-label config-checkbox">
                                            <input type="checkbox" data-config="file.autoDetectDiagramType">
                                            <span class="config-checkbox-mark"></span>
                                            <span class="config-checkbox-label">Auto-detect Diagram Type</span>
                                        </label>
                                        <div class="config-description">Automatically detect diagram type from content</div>
                                    </div>
                                    
                                    <div class="config-field config-field-horizontal">
                                        <label class="config-label config-checkbox">
                                            <input type="checkbox" data-config="file.warnOnUnsavedChanges">
                                            <span class="config-checkbox-mark"></span>
                                            <span class="config-checkbox-label">Warn on Unsaved Changes</span>
                                        </label>
                                        <div class="config-description">Show warning when leaving with unsaved changes</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="config-section">
                                <h4 class="config-section-title">User Interface</h4>
                                <div class="config-group">
                                    <div class="config-field">
                                        <label class="config-label">Notification Duration</label>
                                        <div class="config-range">
                                            <input type="range" min="1000" max="10000" step="500" class="config-input" data-config="ui.notificationDuration">
                                            <span class="config-range-value">3000ms</span>
                                        </div>
                                        <div class="config-description">How long to show notifications</div>
                                    </div>
                                    
                                    <div class="config-field config-field-horizontal">
                                        <label class="config-label config-checkbox">
                                            <input type="checkbox" data-config="ui.showNotifications">
                                            <span class="config-checkbox-mark"></span>
                                            <span class="config-checkbox-label">Show Notifications</span>
                                        </label>
                                    </div>
                                    
                                    <div class="config-field config-field-horizontal">
                                        <label class="config-label config-checkbox">
                                            <input type="checkbox" data-config="ui.enableKeyboardShortcuts">
                                            <span class="config-checkbox-mark"></span>
                                            <span class="config-checkbox-label">Enable Keyboard Shortcuts</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="config-section">
                                <h4 class="config-section-title">Performance</h4>
                                <div class="config-group">
                                    <div class="config-field config-field-horizontal">
                                        <label class="config-label config-checkbox">
                                            <input type="checkbox" data-config="performance.enableDiagramCaching">
                                            <span class="config-checkbox-mark"></span>
                                            <span class="config-checkbox-label">Enable Diagram Caching</span>
                                        </label>
                                        <div class="config-description">Cache generated diagrams for faster loading</div>
                                    </div>
                                    
                                    <div class="config-field">
                                        <label class="config-label">Cache Size</label>
                                        <div class="config-range">
                                            <input type="range" min="10" max="100" step="5" class="config-input" data-config="performance.maxCacheSize">
                                            <span class="config-range-value">50</span>
                                        </div>
                                        <div class="config-description">Maximum number of cached diagrams</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="config-section">
                                <h4 class="config-section-title">Kroki API</h4>
                                <div class="config-group">
                                    <div class="config-field config-field-horizontal">
                                        <label class="config-label config-checkbox">
                                            <input type="checkbox" data-config="kroki.alwaysUsePost">
                                            <span class="config-checkbox-mark"></span>
                                            <span class="config-checkbox-label">Always Use POST Requests</span>
                                        </label>
                                        <div class="config-description">Always use POST requests to Kroki API instead of GET (prevents URL length issues)</div>
                                    </div>
                                    
                                    <div class="config-field">
                                        <label class="config-label">URL Length Threshold</label>
                                        <div class="config-range">
                                            <input type="range" min="1000" max="8192" step="256" class="config-input" data-config="kroki.urlLengthThreshold">
                                            <span class="config-range-value">2048</span>
                                        </div>
                                        <div class="config-description">URL length threshold to automatically switch from GET to POST requests</div>
                                    </div>
                                    
                                    <div class="config-field">
                                        <label class="config-label">POST Request Timeout</label>
                                        <div class="config-range">
                                            <input type="range" min="5000" max="60000" step="5000" class="config-input" data-config="kroki.postRequestTimeout">
                                            <span class="config-range-value">30000ms</span>
                                        </div>
                                        <div class="config-description">Timeout for POST requests in milliseconds</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div id="config-tab-about" class="config-tab-content">
                            <div class="config-section">
                                <div class="config-group">
                                    <div class="about-header">
                                        <div class="about-logo">
                                            <img src="/favicon.ico" alt="DocCode" class="about-favicon">
                                        </div>
                                        <div class="about-title">
                                            <h5 id="about-app-name">DocCode - The Kroki Server Frontend</h5>
                                            <div class="about-version">
                                                Version <span id="about-version">Loading...</span>
                                            </div>
                                            <div class="about-author">
                                                by <span id="about-author">Loading...</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="about-description" id="about-description">
                                        Loading application information...
                                    </div>
                                    
                                    <div class="about-info-grid">
                                        <div class="about-info-item">
                                            <div class="about-info-label">Build Date</div>
                                            <div class="about-info-value" id="about-build-date">-</div>
                                        </div>
                                        <div class="about-info-item">
                                            <div class="about-info-label">Server</div>
                                            <div class="about-info-value" id="about-server-info">-</div>
                                        </div>
                                        <div class="about-info-item">
                                            <div class="about-info-label">AI Assistant</div>
                                            <div class="about-info-value" id="about-ai-info">-</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="config-section">
                                <h4 class="config-section-title">Features</h4>
                                <div class="config-group">
                                    <div class="about-features" id="about-features">
                                        <div class="about-loading">Loading features...</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="config-section">
                                <h4 class="config-section-title">Resources</h4>
                                <div class="config-group">
                                    <div class="about-links">
                                        <a href="https://kroki.io/" target="_blank" class="about-link">
                                            🌐 Kroki Documentation
                                        </a>
                                        <a href="https://github.com/vppillai/kroki-server" target="_blank" class="about-link">
                                            📚 DocCode GitHub Repository
                                        </a>
                                        <a href="/api/health" target="_blank" class="about-link">
                                            ❤️ Server Health Check
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="config-modal-footer">
                        <div class="left-actions">
                            <button id="config-reset" class="config-btn danger">Reset to Defaults</button>
                            <div class="config-import-export">
                                <button id="config-export" class="config-btn">Export Settings</button>
                                <button id="config-import" class="config-btn">Import Settings</button>
                                <input type="file" id="config-file-input" class="config-file-input" accept=".json">
                            </div>
                        </div>
                        <div class="right-actions">
                            <button id="config-cancel" class="config-btn">Cancel</button>
                            <button id="config-save" class="config-btn primary">Save Changes</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('config-modal');
    }

    // ========================================
    // EVENT HANDLING METHODS
    // ========================================

    /**
     * Set up all event listeners for the configuration UI
     * Handles modal interactions, form changes, and keyboard shortcuts
     * 
     * @private
     */

    setupEventListeners() {
        // Modal close handlers
        document.getElementById('config-modal-close').addEventListener('click', () => this.close());
        document.getElementById('config-cancel').addEventListener('click', () => this.close());

        // Tab switching
        document.querySelectorAll('.config-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Config field handlers
        document.querySelectorAll('[data-config]').forEach(element => {
            if (element.type === 'checkbox') {
                element.addEventListener('change', (e) => this.handleConfigChange(e));
            } else if (element.type === 'range') {
                element.addEventListener('input', (e) => this.handleConfigChange(e));
            } else {
                element.addEventListener('change', (e) => this.handleConfigChange(e));
            }
        });

        // Footer buttons
        document.getElementById('config-save').addEventListener('click', () => this.save());
        document.getElementById('config-reset').addEventListener('click', () => this.reset());
        document.getElementById('config-export').addEventListener('click', () => this.export());
        document.getElementById('config-import').addEventListener('click', () => this.import());
        document.getElementById('config-file-input').addEventListener('change', (e) => this.handleFileImport(e));

        // Close on outside click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.modal.style.display === 'block') {
                if (e.key === 'Escape') {
                    this.close();
                } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    this.save();
                }
            }
        });

        // AI configuration conditional logic
        this.setupAIConfigLogic();

        // Password toggle functionality
        this.setupPasswordToggle();
    }

    /**
     * Set up AI configuration conditional logic
     * Handles visibility and interaction of AI-related configuration fields
     * 
     * @private
     */

    setupAIConfigLogic() {
        const customApiCheckbox = document.getElementById('ai-use-custom-api');
        const modelSelect = document.querySelector('[data-config="ai.model"]');
        const customModelField = document.getElementById('custom-model-field');

        // Handle custom API checkbox change
        if (customApiCheckbox) {
            customApiCheckbox.addEventListener('change', () => {
                this.toggleDependentFields();
            });
        }

        // Handle model selection change
        if (modelSelect) {
            modelSelect.addEventListener('change', (e) => {
                if (customModelField) {
                    customModelField.style.display = e.target.value === 'custom' ? 'block' : 'none';
                }
            });
        }

        // Initial setup
        this.toggleDependentFields();
    }

    /**
     * Set up password visibility toggle functionality
     * Configures the show/hide password button for API key input
     * 
     * @private
     */

    setupPasswordToggle() {
        const toggleBtn = document.getElementById('api-key-toggle');
        const passwordInput = document.getElementById('ai-api-key-input');
        const eyeIcon = toggleBtn.querySelector('.eye-icon');
        const eyeSlashIcon = toggleBtn.querySelector('.eye-slash-icon');

        if (toggleBtn && passwordInput && eyeIcon && eyeSlashIcon) {
            // Always start with password hidden when modal opens
            this.resetPasswordVisibility();

            toggleBtn.addEventListener('click', () => {
                const isPassword = passwordInput.type === 'password';

                // Toggle input type
                passwordInput.type = isPassword ? 'text' : 'password';

                // Toggle icon visibility
                if (isPassword) {
                    eyeIcon.style.display = 'none';
                    eyeSlashIcon.style.display = 'block';
                    toggleBtn.setAttribute('aria-label', 'Hide password');
                    toggleBtn.title = 'Hide password';
                } else {
                    eyeIcon.style.display = 'block';
                    eyeSlashIcon.style.display = 'none';
                    toggleBtn.setAttribute('aria-label', 'Show password');
                    toggleBtn.title = 'Show password';
                }
            });
        }
    }

    /**
     * Reset password input to hidden state
     * Ensures API key field starts in password mode when modal opens
     * 
     * @private
     */

    resetPasswordVisibility() {
        const passwordInput = document.getElementById('ai-api-key-input');
        const toggleBtn = document.getElementById('api-key-toggle');
        const eyeIcon = toggleBtn?.querySelector('.eye-icon');
        const eyeSlashIcon = toggleBtn?.querySelector('.eye-slash-icon');

        if (passwordInput && toggleBtn && eyeIcon && eyeSlashIcon) {
            // Always start with password type (hidden)
            passwordInput.type = 'password';

            // Show eye icon, hide eye-slash icon
            eyeIcon.style.display = 'block';
            eyeSlashIcon.style.display = 'none';

            // Set appropriate aria-label and title
            toggleBtn.setAttribute('aria-label', 'Show password');
            toggleBtn.title = 'Show password';
        }
    }

    /**
     * Toggle visibility of fields that depend on custom AI API configuration
     * Enables/disables fields based on the custom API checkbox state
     * 
     * @private
     */
    toggleDependentFields() {
        const customApiCheckbox = document.getElementById('ai-use-custom-api');
        const isCustom = customApiCheckbox && customApiCheckbox.checked;

        // Enable/disable fields that depend on custom API
        document.querySelectorAll('[data-depends="ai.useCustomAPI"]').forEach(field => {
            const inputs = field.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                input.disabled = !isCustom;
            });
            field.style.opacity = isCustom ? '1' : '0.5';
        });
    }

    // ========================================
    // MODAL CONTROL METHODS
    // ========================================

    /**
     * Open the configuration modal
     * Loads current configuration and displays the modal dialog
     * 
     * @public
     */
    open() {
        this.loadCurrentConfig();
        // Always reset password visibility to hidden when modal opens
        this.resetPasswordVisibility();
        this.modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close the configuration modal
     * Checks for unsaved changes and closes the modal if confirmed
     * 
     * @public
     */
    close() {
        if (this.unsavedChanges) {
            if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
                return;
            }
        }
        this.modal.style.display = 'none';
        document.body.style.overflow = '';
        this.unsavedChanges = false;
        this.tempConfig = {};
    }

    // ========================================
    // TAB MANAGEMENT
    // ========================================

    /**
     * Switch between configuration tabs
     * Updates active tab display and content visibility
     * 
     * @param {string} tabName - The name of the tab to switch to
     * @public
     */
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.config-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.config-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `config-tab-${tabName}`);
        });

        this.activeTab = tabName;

        // Load version information when About tab is activated
        if (tabName === 'about') {
            this.loadAboutInfo();
        }
    }

    // ========================================
    // CONFIGURATION MANAGEMENT
    // ========================================

    /**
     * Load current configuration values into the form
     * Populates all form fields with values from the configuration manager
     * 
     * @private
     */
    loadCurrentConfig() {
        // Load all configuration values into the form
        document.querySelectorAll('[data-config]').forEach(element => {
            const configPath = element.dataset.config;
            const value = this.configManager.get(configPath);

            if (element.type === 'checkbox') {
                element.checked = value;
            } else if (element.type === 'range') {
                element.value = value;
                this.updateRangeDisplay(element, value);
            } else {
                element.value = value;
            }
        });

        // Handle AI-specific logic after loading config
        this.toggleDependentFields();

        // Handle custom model field visibility
        const modelSelect = document.querySelector('[data-config="ai.model"]');
        const customModelField = document.getElementById('custom-model-field');
        if (modelSelect && customModelField) {
            customModelField.style.display = modelSelect.value === 'custom' ? 'block' : 'none';
        }

        this.unsavedChanges = false;
    }

    /**
     * Handle configuration field changes
     * Processes user input and stores temporary changes
     * 
     * @param {Event} event - The change event from form elements
     * @private
     */
    handleConfigChange(event) {
        const element = event.target;
        const configPath = element.dataset.config;
        let value;

        if (element.type === 'checkbox') {
            value = element.checked;
        } else if (element.type === 'range' || element.type === 'number') {
            value = parseFloat(element.value);
            this.updateRangeDisplay(element, value);
        } else {
            value = element.value;
        }

        // Store in temporary config
        this.tempConfig[configPath] = value;
        this.unsavedChanges = true;

        // Update save button state
        const saveBtn = document.getElementById('config-save');
        saveBtn.textContent = 'Save Changes';
        saveBtn.classList.add('primary');
    }

    /**
     * Update the display value for range input controls
     * Formats values with appropriate units based on the configuration type
     * 
     * @param {HTMLElement} rangeElement - The range input element
     * @param {number} value - The current value to display
     * @private
     */
    updateRangeDisplay(rangeElement, value) {
        const valueDisplay = rangeElement.parentElement.querySelector('.config-range-value');
        if (valueDisplay) {
            const configPath = rangeElement.dataset.config;

            if (configPath.includes('Scale') || configPath.includes('Step')) {
                valueDisplay.textContent = Math.round(value * 100) + '%';
            } else if (configPath.includes('Delay') || configPath.includes('Duration') || configPath.includes('Timeout')) {
                valueDisplay.textContent = value + 'ms';
            } else if (configPath.includes('fontSize')) {
                valueDisplay.textContent = value + 'px';
            } else if (configPath.includes('Padding')) {
                valueDisplay.textContent = value + 'px';
            } else if (configPath.includes('Width')) {
                valueDisplay.textContent = value + '%';
            } else {
                valueDisplay.textContent = value;
            }
        }
    }

    /**
     * Save all configuration changes
     * Applies temporary changes to the configuration manager and provides user feedback
     * 
     * @public
     */
    save() {
        try {
            // Apply all temporary configuration changes
            for (const [path, value] of Object.entries(this.tempConfig)) {
                this.configManager.set(path, value);
            }

            this.unsavedChanges = false;
            this.tempConfig = {};

            // Update save button state with tick mark
            const saveBtn = document.getElementById('config-save');
            saveBtn.textContent = 'Saved ✓';
            saveBtn.classList.remove('primary');

            setTimeout(() => {
                saveBtn.textContent = 'Save Changes';
                saveBtn.classList.add('primary');
            }, 2000);

        } catch (error) {
            console.error('Failed to save configuration:', error);
            // For errors, could still show an alert or console error
            alert('Failed to save settings!');
        }
    }

    /**
     * Reset all configuration settings to default values
     * Prompts user for confirmation before resetting all settings
     * 
     * @public
     */
    reset() {
        if (confirm('Are you sure you want to reset all settings to their default values? This cannot be undone.')) {
            this.configManager.reset();
            this.loadCurrentConfig();

            // Reset zoom state to fit the current diagram
            setTimeout(() => {
                const zoomPanControls = window.diagramZoomPan;
                if (zoomPanControls) {
                    zoomPanControls.resetZoom();
                }
            }, 100);

            // Could show a brief confirmation in console or update button text
            console.log('Settings reset to defaults');
        }
    }

    // ========================================
    // IMPORT/EXPORT FUNCTIONALITY
    // ========================================

    /**
     * Export current configuration settings to a JSON file
     * Creates and downloads a JSON file containing all current settings
     * 
     * @public
     */
    export() {
        try {
            const config = this.configManager.export();
            const blob = new Blob([config], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'kroki-settings.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('Settings exported successfully to kroki-settings.json');
        } catch (error) {
            console.error('Failed to export configuration:', error);
            alert('Failed to export settings!');
        }
    }

    /**
     * Trigger file import dialog
     * Opens the file input dialog for importing configuration settings
     * 
     * @public
     */
    import() {
        document.getElementById('config-file-input').click();
    }

    /**
     * Handle file import from user selection
     * Processes uploaded JSON configuration file and applies settings
     * 
     * @param {Event} event - The file input change event
     * @private
     */
    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const success = this.configManager.import(e.target.result);
                if (success) {
                    this.loadCurrentConfig();
                    console.log('Settings imported successfully');
                } else {
                    alert('Failed to import settings - invalid format!');
                }
            } catch (error) {
                console.error('Failed to import configuration:', error);
                alert('Failed to import settings!');
            }
        };
        reader.readAsText(file);

        // Reset file input
        event.target.value = '';
    }

    // ========================================
    // UI STATE MANAGEMENT
    // ========================================

    /**
     * Load version and application information for the About tab
     * Fetches version data from the server API and populates the About tab content
     * 
     * @private
     */
    async loadAboutInfo() {
        try {
            const response = await fetch('/api/version');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const versionInfo = await response.json();

            // Update basic info
            document.getElementById('about-app-name').textContent = versionInfo.name || 'DocCode - The Kroki Server Frontend';
            document.getElementById('about-version').textContent = versionInfo.version || '1.0.0';
            document.getElementById('about-author').textContent = versionInfo.author || 'Unknown';
            document.getElementById('about-description').textContent = versionInfo.description || 'Interactive diagram editor and server';
            document.getElementById('about-build-date').textContent = versionInfo.build_date || 'Unknown';

            // Update server info
            const serverInfo = versionInfo.server_info || {};
            document.getElementById('about-server-info').textContent =
                `${serverInfo.hostname || 'localhost'}:${serverInfo.https_port || '8443'}`;

            // Update AI info
            const aiInfo = serverInfo.ai_enabled ?
                `Enabled (${serverInfo.ai_model || 'Unknown model'})` :
                'Disabled';
            document.getElementById('about-ai-info').textContent = aiInfo;

            // Update features list
            const featuresContainer = document.getElementById('about-features');
            if (versionInfo.features && versionInfo.features.length > 0) {
                featuresContainer.innerHTML = versionInfo.features
                    .map(feature => `<div class="about-feature-item">✓ ${feature}</div>`)
                    .join('');
            } else {
                featuresContainer.innerHTML = '<div class="about-loading">No features information available</div>';
            }

        } catch (error) {
            console.error('Failed to load version information:', error);

            // Show fallback information
            document.getElementById('about-app-name').textContent = 'DocCode - The Kroki Server Frontend';
            document.getElementById('about-version').textContent = 'Unknown';
            document.getElementById('about-author').textContent = 'Unknown';
            document.getElementById('about-description').textContent = 'A comprehensive interactive frontend for Kroki diagram rendering server';
            document.getElementById('about-build-date').textContent = 'Unknown';
            document.getElementById('about-server-info').textContent = 'Connection failed';
            document.getElementById('about-ai-info').textContent = 'Unknown';

            document.getElementById('about-features').innerHTML =
                '<div class="about-error">Unable to load feature information</div>';
        }
    }

}

// Note: Manual initialization in main.js
