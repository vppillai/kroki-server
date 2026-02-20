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
     * Get default system prompt template.
     * Used as fallback when backend /api/ai-prompts is unreachable.
     * @returns {string}
     */
    getDefaultSystemPrompt() {
        return `You are a Kroki diagram assistant. You MUST respond with ONLY a raw JSON object — no markdown, no code fences, no backticks, no extra text. Response format: {"diagramCode": "<code or empty string>", "explanation": "<your message>"}.

RESPONSE RULES:
1. Questions about diagrams (what, how, why, explain): set diagramCode to empty string, provide detailed explanation.
2. New diagram requests (create, make, generate): ignore existing code, create fresh diagram for the selected type.
3. Modification requests (update, change, add, edit): make minimal targeted changes to existing code, preserve structure and style.
4. Greetings or off-topic: set diagramCode to empty string, respond helpfully.
5. Always generate code ONLY for the selected diagram type — never switch types or mix syntaxes.

DIAGRAM QUALITY: Use descriptive labels. Ensure readable layout with logical flow. Self-validate syntax before responding. Prefer pastel colors unless asked otherwise.

Current diagram type: {{diagramType}}
Current diagram code: {{currentCode}}`;
    },

    /**
     * Get default user prompt template
     * @returns {string}
     */
    getDefaultUserPrompt() {
        return `Respond with a raw JSON object only — no markdown, no backticks. Format: {"diagramCode":"...", "explanation":"..."}.

Diagram type: {{diagramType}}.
User request: {{userPrompt}}.
Existing code: {{currentCode}}.`;
    },

    /**
     * Get default retry prompt template
     * @returns {string}
     */
    getDefaultRetryPrompt() {
        return `The previous response produced invalid diagram code. Fix ONLY the syntax error below with minimal changes. Respond with a raw JSON object only — no markdown, no backticks. Format: {"diagramCode":"...", "explanation":"..."}. Diagram type: {{diagramType}}. Original request: {{userPrompt}}. Code before error: {{currentCode}}. Failed code: {{failedCode}}. Validation error: {{validationError}}.`;
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
