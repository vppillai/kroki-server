/**
 * Configuration Settings UI Component
 *
 * Core class: constructor, init, event handling, tab switching,
 * config save/load, import/export.
 *
 * Template creation is delegated to config-ui-templates.js.
 * Model loading is delegated to config-ui-models.js.
 *
 * @class ConfigUI
 */
class ConfigUI {
    /**
     * Initialize the Configuration UI component
     * @param {Object} configManager - The configuration manager instance
     */
    constructor(configManager) {
        this.configManager = configManager;
        this.tempConfig = {};
        this.modal = null;
        this.activeTab = 'general';
        this.unsavedChanges = false;
        this.init();
    }

    init() {
        this.createModal();
        this.setupEventListeners();
    }

    // ========================================
    // UI CREATION — delegates to ConfigUITemplates
    // ========================================

    createModal() {
        const modalHTML = window.ConfigUITemplates.getModalHTML();
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('config-modal');
    }

    // ========================================
    // EVENT HANDLING
    // ========================================

    setupEventListeners() {
        document.getElementById('config-modal-close').addEventListener('click', () => this.close());
        document.getElementById('config-cancel')?.addEventListener('click', () => this.close());

        document.querySelectorAll('.config-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        document.querySelectorAll('[data-config]').forEach(element => {
            if (element.type === 'checkbox') {
                element.addEventListener('change', (e) => this.handleConfigChange(e));
            } else if (element.type === 'range') {
                element.addEventListener('input', (e) => this.handleConfigChange(e));
            } else {
                element.addEventListener('change', (e) => this.handleConfigChange(e));
            }
        });

        document.getElementById('config-save').addEventListener('click', () => this.save());
        document.getElementById('config-reset').addEventListener('click', () => this.reset());
        document.getElementById('config-export').addEventListener('click', () => this.export());
        document.getElementById('config-import').addEventListener('click', () => this.import());
        document.getElementById('config-file-input').addEventListener('change', (e) => this.handleFileImport(e));

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        document.addEventListener('keydown', (e) => {
            if (this.modal.style.display === 'block') {
                if (e.key === 'Escape') this.close();
                else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) this.save();
            }
        });

        this.setupAIConfigLogic();
        this.setupPasswordToggle();
    }

    setupAIConfigLogic() {
        const customApiCheckbox = document.getElementById('ai-use-custom-api');
        const modelSelect = document.querySelector('[data-config="ai.model"]');
        const customModelField = document.getElementById('custom-model-field');
        const refreshModelsBtn = document.getElementById('refresh-models-btn');

        if (customApiCheckbox) {
            customApiCheckbox.addEventListener('change', () => this.toggleDependentFields());
        }

        if (modelSelect) {
            modelSelect.addEventListener('change', (e) => {
                if (customModelField) {
                    customModelField.style.display = e.target.value === 'custom' ? 'block' : 'none';
                }
            });
        }

        if (refreshModelsBtn) {
            refreshModelsBtn.addEventListener('click', () => {
                window.ConfigUIModels.loadAvailableModels(this.configManager, true);
            });
        }

        window.ConfigUIModels.loadAvailableModels(this.configManager);
        this.toggleDependentFields();
    }

    setupPasswordToggle() {
        const toggleBtn = document.getElementById('api-key-toggle');
        const passwordInput = document.getElementById('ai-api-key-input');
        if (!toggleBtn || !passwordInput) return;

        const eyeIcon = toggleBtn.querySelector('.eye-icon');
        const eyeSlashIcon = toggleBtn.querySelector('.eye-slash-icon');

        if (eyeIcon && eyeSlashIcon) {
            this.resetPasswordVisibility();

            toggleBtn.addEventListener('click', () => {
                const isPassword = passwordInput.type === 'password';
                passwordInput.type = isPassword ? 'text' : 'password';

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

    resetPasswordVisibility() {
        const passwordInput = document.getElementById('ai-api-key-input');
        const toggleBtn = document.getElementById('api-key-toggle');
        const eyeIcon = toggleBtn?.querySelector('.eye-icon');
        const eyeSlashIcon = toggleBtn?.querySelector('.eye-slash-icon');

        if (passwordInput && toggleBtn && eyeIcon && eyeSlashIcon) {
            passwordInput.type = 'password';
            eyeIcon.style.display = 'block';
            eyeSlashIcon.style.display = 'none';
            toggleBtn.setAttribute('aria-label', 'Show password');
            toggleBtn.title = 'Show password';
        }
    }

    toggleDependentFields() {
        const customApiCheckbox = document.getElementById('ai-use-custom-api');
        const isCustom = customApiCheckbox && customApiCheckbox.checked;

        document.querySelectorAll('[data-depends="ai.useCustomAPI"]').forEach(field => {
            const inputs = field.querySelectorAll('input, select, textarea');
            inputs.forEach(input => { input.disabled = !isCustom; });
            field.style.opacity = isCustom ? '1' : '0.5';
        });
    }

    // ========================================
    // MODAL CONTROL
    // ========================================

    open() {
        this.loadCurrentConfig();
        this.resetPasswordVisibility();
        this.modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    close() {
        if (this.unsavedChanges) {
            if (!confirm('You have unsaved changes. Are you sure you want to close?')) return;
        }
        this.modal.style.display = 'none';
        document.body.style.overflow = '';
        this.unsavedChanges = false;
        this.tempConfig = {};
    }

    // ========================================
    // TAB MANAGEMENT
    // ========================================

    switchTab(tabName) {
        document.querySelectorAll('.config-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        document.querySelectorAll('.config-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `config-tab-${tabName}`);
        });
        this.activeTab = tabName;
        if (tabName === 'about') this.loadAboutInfo();
    }

    // ========================================
    // CONFIGURATION MANAGEMENT
    // ========================================

    loadCurrentConfig() {
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

        this.toggleDependentFields();

        const modelSelect = document.querySelector('[data-config="ai.model"]');
        const customModelField = document.getElementById('custom-model-field');
        if (modelSelect && customModelField) {
            customModelField.style.display = modelSelect.value === 'custom' ? 'block' : 'none';
        }

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

        this.tempConfig[configPath] = value;
        this.unsavedChanges = true;

        if (this.shouldApplyImmediately(configPath)) {
            this.configManager.set(configPath, value);
        }

        const saveBtn = document.getElementById('config-save');
        saveBtn.textContent = 'Save Changes';
        saveBtn.classList.add('primary');
    }

    updateRangeDisplay(rangeElement, value) {
        const valueDisplay = rangeElement.parentElement.querySelector('.config-range-value');
        if (!valueDisplay) return;

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

    save() {
        try {
            for (const [path, value] of Object.entries(this.tempConfig)) {
                this.configManager.set(path, value);
            }

            this.unsavedChanges = false;
            this.tempConfig = {};

            const saveBtn = document.getElementById('config-save');
            saveBtn.textContent = 'Saved';
            saveBtn.classList.remove('primary');

            setTimeout(() => {
                saveBtn.textContent = 'Save Changes';
                saveBtn.classList.add('primary');
            }, 2000);
        } catch (error) {
            console.error('Failed to save configuration:', error);
            alert('Failed to save settings!');
        }
    }

    async reset() {
        if (!confirm('Are you sure you want to reset all settings to their default values? This cannot be undone.')) return;

        let serverDefaults = {};
        try {
            const response = await fetch('/api/available-models');
            if (response.ok) {
                const data = await response.json();
                serverDefaults = { ai: { model: data.default_model } };
            }
        } catch (error) {
            console.warn('Could not fetch server defaults:', error);
        }

        this.configManager.reset(serverDefaults);
        this.loadCurrentConfig();

        setTimeout(() => {
            const zoomPanControls = window.diagramZoomPan;
            if (zoomPanControls) zoomPanControls.resetZoom();
        }, 100);
    }

    // ========================================
    // IMPORT/EXPORT
    // ========================================

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
        } catch (error) {
            console.error('Failed to export configuration:', error);
            alert('Failed to export settings!');
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
                } else {
                    alert('Failed to import settings - invalid format!');
                }
            } catch (error) {
                console.error('Failed to import configuration:', error);
                alert('Failed to import settings!');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    // ========================================
    // ABOUT TAB
    // ========================================

    async loadAboutInfo() {
        try {
            const response = await fetch('/api/version');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const versionInfo = await response.json();

            document.getElementById('about-app-name').textContent = versionInfo.name || 'DocCode - The Kroki Server Frontend';
            document.getElementById('about-version').textContent = versionInfo.version || '1.0.0';
            document.getElementById('about-author').textContent = versionInfo.author || 'Unknown';
            document.getElementById('about-description').textContent = versionInfo.description || 'Interactive diagram editor and server';
            document.getElementById('about-build-date').textContent = versionInfo.build_date || 'Unknown';

            const serverInfo = versionInfo.server_info || {};
            document.getElementById('about-server-info').textContent =
                `${serverInfo.hostname || 'localhost'}:${serverInfo.https_port || '8443'}`;

            const aiInfo = serverInfo.ai_enabled
                ? `Enabled (${serverInfo.ai_model || 'Unknown model'})`
                : 'Disabled';
            document.getElementById('about-ai-info').textContent = aiInfo;

            // Features list — use safe DOM API to avoid XSS
            const featuresContainer = document.getElementById('about-features');
            featuresContainer.textContent = '';
            if (versionInfo.features && versionInfo.features.length > 0) {
                versionInfo.features.forEach(feature => {
                    const item = document.createElement('div');
                    item.className = 'about-feature-item';
                    item.textContent = feature;
                    featuresContainer.appendChild(item);
                });
            } else {
                featuresContainer.textContent = 'No features information available';
            }
        } catch (error) {
            console.error('Failed to load version information:', error);
            document.getElementById('about-app-name').textContent = 'DocCode - The Kroki Server Frontend';
            document.getElementById('about-version').textContent = 'Unknown';
            document.getElementById('about-author').textContent = 'Unknown';
            document.getElementById('about-description').textContent = 'A comprehensive interactive frontend for Kroki diagram rendering server';
            document.getElementById('about-build-date').textContent = 'Unknown';
            document.getElementById('about-server-info').textContent = 'Connection failed';
            document.getElementById('about-ai-info').textContent = 'Unknown';
            document.getElementById('about-features').textContent = 'Unable to load feature information';
        }
    }

    updateConfigField(configPath, value) {
        if (this.modal.style.display !== 'block') return;
        const element = document.querySelector(`[data-config="${configPath}"]`);
        if (!element) return;

        if (element.type === 'checkbox') element.checked = value;
        else if (element.type === 'range') { element.value = value; this.updateRangeDisplay(element, value); }
        else element.value = value;
    }

    shouldApplyImmediately(configPath) {
        return ['autoRefresh', 'theme', 'layout.showToolbar', 'layout.showZoomControls', 'layout.showFileStatus'].includes(configPath);
    }
}

window.ConfigUI = ConfigUI;
