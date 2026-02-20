/**
 * Config UI Models Module
 *
 * Handles loading available AI models from the backend,
 * populating model select dropdowns, and updating backend service info.
 *
 * @module ConfigUIModels
 */

window.ConfigUIModels = {
    /**
     * Load available models from the backend API
     * @param {Object} configManager - Config manager instance
     * @param {boolean} forceRefresh - Whether to force refresh
     */
    async loadAvailableModels(configManager, forceRefresh = false) {
        const modelSelect = document.getElementById('ai-model-select');
        const refreshBtn = document.getElementById('refresh-models-btn');
        const modelDescription = document.getElementById('model-description');

        if (!modelSelect) return;

        if (refreshBtn) {
            refreshBtn.style.opacity = '0.5';
            refreshBtn.disabled = true;
        }

        try {
            const response = await fetch('/api/available-models', {
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': window.location.origin
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.populateModelSelect(modelSelect, data, configManager);

            if (modelDescription) {
                modelDescription.textContent = 'Choose the AI model to use for diagram assistance';
            }

            this.updateBackendServiceInfo(data);

        } catch (error) {
            console.error('Failed to load available models:', error);
            this.populateModelSelectFallback(modelSelect, configManager);

            if (modelDescription) {
                modelDescription.textContent = 'Choose the AI model to use for diagram assistance (using fallback list)';
            }

            this.updateBackendServiceInfo(null);
        } finally {
            if (refreshBtn) {
                refreshBtn.style.opacity = '1';
                refreshBtn.disabled = false;
            }
        }
    },

    /**
     * Populate model select dropdown from API data
     * @param {HTMLSelectElement} selectElement
     * @param {Object} data - API response data
     * @param {Object} configManager
     */
    populateModelSelect(selectElement, data, configManager) {
        selectElement.innerHTML = '';

        const currentModel = configManager.get('ai.model') || data.default_model || 'openai/gpt-4o';

        const availableModelIds = new Set();
        const models = data.models;
        for (const providerModels of Object.values(models)) {
            for (const modelId of Object.keys(providerModels)) {
                availableModelIds.add(modelId);
            }
        }

        let foundCurrent = false;
        for (const [provider, providerModels] of Object.entries(models)) {
            if (Object.keys(providerModels).length === 0) continue;

            const optgroup = document.createElement('optgroup');
            optgroup.label = provider.charAt(0).toUpperCase() + provider.slice(1);

            for (const [modelId] of Object.entries(providerModels)) {
                const option = document.createElement('option');
                option.value = modelId;
                option.textContent = modelId;

                if (modelId === currentModel) {
                    option.selected = true;
                    foundCurrent = true;
                }

                optgroup.appendChild(option);
            }

            selectElement.appendChild(optgroup);
        }

        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = 'Custom Model';
        selectElement.appendChild(customOption);

        if (!foundCurrent && currentModel !== 'custom') {
            const fallbackModel = data.default_model && availableModelIds.has(data.default_model)
                ? data.default_model
                : availableModelIds.values().next().value;

            if (fallbackModel) {
                selectElement.value = fallbackModel;
                configManager.set('ai.model', fallbackModel);
                console.info(`AI model "${currentModel}" not available, switched to "${fallbackModel}"`);
            }
        }
    },

    /**
     * Populate model select with fallback list
     * @param {HTMLSelectElement} selectElement
     * @param {Object} configManager
     */
    populateModelSelectFallback(selectElement, configManager) {
        const fallbackModels = {
            'OpenAI': [
                { value: 'gpt-4o', text: 'GPT-4o' },
                { value: 'gpt-4o-mini', text: 'GPT-4o Mini' },
                { value: 'gpt-4-turbo', text: 'GPT-4 Turbo' },
                { value: 'gpt-4', text: 'GPT-4' },
                { value: 'gpt-3.5-turbo', text: 'GPT-3.5 Turbo' },
                { value: 'o1-preview', text: 'O1 Preview' },
                { value: 'o1-mini', text: 'O1 Mini' }
            ],
            'Anthropic': [
                { value: 'claude-3-5-sonnet-20241022', text: 'Claude 3.5 Sonnet' },
                { value: 'claude-3-5-haiku-20241022', text: 'Claude 3.5 Haiku' },
                { value: 'claude-3-opus-20240229', text: 'Claude 3 Opus' },
                { value: 'claude-3-sonnet-20240229', text: 'Claude 3 Sonnet' },
                { value: 'claude-3-haiku-20240307', text: 'Claude 3 Haiku' }
            ],
            'Google': [
                { value: 'gemini-1.5-pro', text: 'Gemini 1.5 Pro' },
                { value: 'gemini-1.5-flash', text: 'Gemini 1.5 Flash' },
                { value: 'gemini-1.0-pro', text: 'Gemini 1.0 Pro' }
            ],
            'Meta': [
                { value: 'llama-3.1-405b', text: 'Llama 3.1 405B' },
                { value: 'llama-3.1-70b', text: 'Llama 3.1 70B' },
                { value: 'llama-3.1-8b', text: 'Llama 3.1 8B' }
            ],
            'Mistral': [
                { value: 'mistral-large', text: 'Mistral Large' },
                { value: 'mistral-medium', text: 'Mistral Medium' },
                { value: 'mistral-small', text: 'Mistral Small' }
            ],
            'OpenRouter': [
                { value: 'openrouter/auto', text: 'OpenRouter Auto' },
                { value: 'anthropic/claude-3.5-sonnet', text: 'Claude 3.5 Sonnet (OR)' },
                { value: 'openai/gpt-4o', text: 'GPT-4o (OR)' },
                { value: 'meta-llama/llama-3.1-8b-instruct:free', text: 'Llama 3.1 8B (Free)' }
            ]
        };

        selectElement.innerHTML = '';
        const currentModel = configManager.get('ai.model') || 'openai/gpt-4o';

        for (const [provider, models] of Object.entries(fallbackModels)) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = provider;
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.value;
                option.textContent = model.text;
                if (model.value === currentModel) option.selected = true;
                optgroup.appendChild(option);
            });
            selectElement.appendChild(optgroup);
        }

        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = 'Custom Model';
        if (currentModel === 'custom') customOption.selected = true;
        selectElement.appendChild(customOption);
    },

    /**
     * Update backend service information display
     * @param {Object} data - Response data from available-models API
     */
    updateBackendServiceInfo(data) {
        const backendServiceUrl = document.getElementById('backend-service-url');
        if (!backendServiceUrl) return;

        if (data && data.proxy_url) {
            let serviceName = data.proxy_name || 'AI Proxy';
            let serviceUrl = data.proxy_url;

            try {
                const url = new URL(serviceUrl);
                backendServiceUrl.textContent = `${serviceName} (${url.hostname})`;
                backendServiceUrl.title = serviceUrl;
            } catch {
                backendServiceUrl.textContent = `${serviceName} (${serviceUrl})`;
                backendServiceUrl.title = serviceUrl;
            }
        } else {
            backendServiceUrl.textContent = 'Unavailable';
            backendServiceUrl.title = 'Backend service information not available';
        }
    }
};
