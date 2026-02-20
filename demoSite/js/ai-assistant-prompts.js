/**
 * AI Assistant Prompts Module
 *
 * Contains all default prompt templates and prompt composition logic
 * for the AI assistant.
 *
 * @module AIAssistantPrompts
 */

window.AIAssistantPrompts = {
    /**
     * Get default system prompt template
     * @returns {string}
     */
    getDefaultSystemPrompt() {
        return `You are an expert diagram assistant for the Kroki diagram server. You help users create and modify diagrams using various diagram languages supported by Kroki.

Current diagram type: {{diagramType}}
Current diagram code: {{currentCode}}

Your role is to:
1. Generate correct diagram code in the specified format
2. Modify existing code based on user requests
3. Fix syntax errors and improve diagram structure
4. Provide helpful explanations when needed

Always ensure your code follows proper syntax for the diagram type and is compatible with Kroki.`;
    },

    /**
     * Get default user prompt template
     * @returns {string}
     */
    getDefaultUserPrompt() {
        return `Please help me with this diagram request: {{userPrompt}}

Current diagram type: {{diagramType}}
Current code: {{currentCode}}

Please provide the updated or new diagram code in a code block, along with a brief explanation of the changes.`;
    },

    /**
     * Get default retry prompt template
     * @returns {string}
     */
    getDefaultRetryPrompt() {
        return `The previous diagram code failed validation. Original request: {{userPrompt}}. Type: {{diagramType}}. Original code: {{currentCode}}. Failed code: {{failedCode}}. Error: {{validationError}}. Fix the code and respond with ONLY the JSON object. No other text.`;
    },

    /**
     * Compose prompt from templates and variables
     * @param {Object} promptTemplates - Template objects from backend
     * @param {Object} variables - Variables to substitute
     * @returns {string|Object} Composed prompt
     */
    composePrompt(promptTemplates, variables) {
        const { diagramType, currentCode, userPrompt, useCustomAPI, userPromptTemplate } = variables;

        let systemPrompt = promptTemplates.system || this.getDefaultSystemPrompt();
        let userPromptText;

        if (useCustomAPI && userPromptTemplate && userPromptTemplate.trim()) {
            userPromptText = userPromptTemplate;
        } else {
            userPromptText = promptTemplates.user || this.getDefaultUserPrompt();
        }

        systemPrompt = systemPrompt
            .replace(/\{\{diagramType\}\}/g, diagramType)
            .replace(/\{\{currentCode\}\}/g, currentCode || 'No existing code');

        userPromptText = userPromptText
            .replace(/\{\{diagramType\}\}/g, diagramType)
            .replace(/\{\{currentCode\}\}/g, currentCode || 'No existing code')
            .replace(/\{\{userPrompt\}\}/g, userPrompt);

        if (!useCustomAPI) {
            return `${systemPrompt}\n\n${userPromptText}`;
        }

        return { system: systemPrompt, user: userPromptText };
    },

    /**
     * Compose retry prompt for failed validation
     * @param {string|Object} originalPrompt
     * @param {string} failedCode
     * @param {string} validationError
     * @param {string} originalUserPrompt
     * @param {string} diagramType
     * @param {string} currentCode
     * @param {Object} promptTemplates
     * @returns {Object}
     */
    composeRetryPrompt(originalPrompt, failedCode, validationError, originalUserPrompt, diagramType, currentCode, promptTemplates) {
        let systemContent = this.getDefaultSystemPrompt();
        if (typeof originalPrompt === 'object' && originalPrompt.system) {
            systemContent = originalPrompt.system;
        }

        let retryTemplate = (promptTemplates && promptTemplates.retry) || this.getDefaultRetryPrompt();

        const retryUserPrompt = retryTemplate
            .replace(/\{\{userPrompt\}\}/g, originalUserPrompt || 'No original request available')
            .replace(/\{\{diagramType\}\}/g, diagramType || 'Unknown')
            .replace(/\{\{currentCode\}\}/g, currentCode || 'No existing code')
            .replace(/\{\{failedCode\}\}/g, failedCode || 'No failed code available')
            .replace(/\{\{validationError\}\}/g, validationError || 'Unknown validation error');

        return { system: systemContent, user: retryUserPrompt };
    }
};
