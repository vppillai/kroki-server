/**
 * Configuration Settings UI Component
 * Provides a user interface for managing Kroki editor configuration
 */

class ConfigUI {
    constructor(configManager) {
        this.configManager = configManager;
        this.modal = null;
        this.activeTab = 'general';
        this.unsavedChanges = false;
        this.tempConfig = {};
        
        this.init();
    }

    init() {
        this.createModal();
        this.setupEventListeners();
    }

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
                            <button class="config-tab" data-tab="advanced">Advanced</button>
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
                    <div id="config-status" class="config-status"></div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('config-modal');
    }

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
    }

    open() {
        this.loadCurrentConfig();
        this.modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

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
    }

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
        
        this.unsavedChanges = false;
    }

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

    save() {
        try {
            // Apply all temporary configuration changes
            for (const [path, value] of Object.entries(this.tempConfig)) {
                this.configManager.set(path, value);
            }
            
            this.showStatus('Settings saved successfully!', 'success');
            this.unsavedChanges = false;
            this.tempConfig = {};
            
            // Update save button state
            const saveBtn = document.getElementById('config-save');
            saveBtn.textContent = 'Saved ✓';
            saveBtn.classList.remove('primary');
            
            setTimeout(() => {
                saveBtn.textContent = 'Save Changes';
            }, 2000);
            
        } catch (error) {
            console.error('Failed to save configuration:', error);
            this.showStatus('Failed to save settings!', 'error');
        }
    }

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
            
            this.showStatus('Settings reset to defaults', 'success');
        }
    }

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
            
            this.showStatus('Settings exported successfully!', 'success');
        } catch (error) {
            console.error('Failed to export configuration:', error);
            this.showStatus('Failed to export settings!', 'error');
        }
    }

    import() {
        document.getElementById('config-file-input').click();
    }

    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const success = this.configManager.import(e.target.result);
                if (success) {
                    this.loadCurrentConfig();
                    this.showStatus('Settings imported successfully!', 'success');
                } else {
                    this.showStatus('Failed to import settings - invalid format!', 'error');
                }
            } catch (error) {
                console.error('Failed to import configuration:', error);
                this.showStatus('Failed to import settings!', 'error');
            }
        };
        reader.readAsText(file);
        
        // Reset file input
        event.target.value = '';
    }

    showStatus(message, type) {
        const status = document.getElementById('config-status');
        status.textContent = message;
        status.className = `config-status ${type} show`;
        
        setTimeout(() => {
            status.classList.remove('show');
        }, 3000);
    }
}

// Note: Manual initialization in main.js
