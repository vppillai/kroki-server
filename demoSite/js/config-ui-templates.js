/**
 * Config UI Templates Module
 *
 * Contains the modal HTML template and tab content generators
 * for the configuration settings UI.
 *
 * @module ConfigUITemplates
 */

window.ConfigUITemplates = {
    /**
     * Generate the full config modal HTML template
     * @returns {string} Modal HTML string
     */
    getModalHTML() {
        // SAFE: developer-controlled template - no user input interpolated
        return `
            <div id="config-modal" class="config-modal">
                <div class="config-modal-content">
                    <div class="config-modal-header">
                        <h3>Settings & Preferences</h3>
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

                        ${this.getGeneralTabHTML()}
                        ${this.getEditorTabHTML()}
                        ${this.getZoomTabHTML()}
                        ${this.getLayoutTabHTML()}
                        ${this.getAITabHTML()}
                        ${this.getAdvancedTabHTML()}
                        ${this.getAboutTabHTML()}
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
            </div>`;
    },

    getGeneralTabHTML() {
        return `
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
        </div>`;
    },

    getEditorTabHTML() {
        return `
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
        </div>`;
    },

    getZoomTabHTML() {
        return `
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
        </div>`;
    },

    getLayoutTabHTML() {
        return `
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
        </div>`;
    },

    getAITabHTML() {
        return `
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
                <h4 class="config-section-title">Model Selection</h4>
                <div class="config-group">
                    <div class="config-field">
                        <label class="config-label">AI Model</label>
                        <div class="model-selection-container">
                            <select class="config-select" data-config="ai.model" id="ai-model-select">
                                <option value="">Loading models...</option>
                            </select>
                            <button type="button" class="refresh-models-btn" id="refresh-models-btn" title="Refresh available models">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M23 4v6h-6"/>
                                    <path d="M1 20v-6h6"/>
                                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10"/>
                                    <path d="M3.51 15A9 9 0 0 0 18.36 18.36L23 14"/>
                                </svg>
                            </button>
                        </div>
                        <div class="config-description" id="model-description">Choose the AI model to use for diagram assistance</div>
                        <div class="backend-service-info" id="backend-service-info">
                            <div class="backend-service-indicator">
                                <span class="backend-service-icon">🌐</span>
                                <span class="backend-service-text">Backend Service: <span id="backend-service-url">Loading...</span></span>
                            </div>
                        </div>
                    </div>
                    <div class="config-field" id="custom-model-field" style="display: none;">
                        <label class="config-label">Custom Model Name</label>
                        <input type="text" class="config-input" data-config="ai.customModel" placeholder="Enter custom model name">
                        <div class="config-description">Specify the exact model name for custom models</div>
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
                            <span class="config-checkbox-label">Use Direct API (Override Backend Proxy)</span>
                        </label>
                        <div class="config-description">Enable to use direct API calls from frontend. By default, the backend proxy is used (recommended).</div>
                    </div>
                    <div class="config-field" data-depends="ai.useCustomAPI">
                        <label class="config-label">AI API URL</label>
                        <input type="text" class="config-input" data-config="ai.endpoint" placeholder="https://api.openai.com/v1/chat/completions">
                        <div class="config-description">Direct API endpoint for AI chat completions</div>
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
                        <div class="config-description">Your direct API key</div>
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
                        <textarea class="config-input config-textarea" data-config="ai.userPromptTemplate" rows="6"
                            placeholder="Use {{diagramType}}, {{currentCode}}, and {{userPrompt}} as placeholders"></textarea>
                        <div class="config-description">Template for AI prompts. Only available when using direct API calls.</div>
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
        </div>`;
    },

    getAdvancedTabHTML() {
        return `
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
                            <span class="config-range-value">4096</span>
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
        </div>`;
    },

    getAboutTabHTML() {
        return `
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
                            Kroki Documentation
                        </a>
                        <a href="https://github.com/vppillai/kroki-server" target="_blank" class="about-link">
                            DocCode GitHub Repository
                        </a>
                        <a href="/api/health" target="_blank" class="about-link">
                            Server Health Check
                        </a>
                    </div>
                </div>
            </div>
        </div>`;
    }
};
