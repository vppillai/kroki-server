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
        return `You are DocCode's Kroki diagram assistant. Respond with ONLY a JSON object — no prose, no markdown, no code fences — exactly:
{"diagramCode":"<diagram source, or empty>","explanation":"<short friendly message>"}

How to respond:
- Create ("make/generate/draw a ..."): write a fresh, complete diagram for the selected type; ignore any existing code.
- Modify ("add/change/rename/remove ..."): start from the existing code; make the smallest change that satisfies the request; preserve the user's structure, names, ordering, and comments.
- Question/explain ("what/why/how/explain"): set diagramCode to "" and answer in explanation.
- Greeting/off-topic: set diagramCode to "" and reply briefly.

Rules:
- diagramCode MUST be valid {{diagramType}} syntax; never switch or mix diagram types.
- diagramCode contains ONLY diagram source — no backticks, no language label, no commentary.
- Use descriptive labels (not generic A, B, Node1) and a readable layout with logical flow; prefer soft/pastel colors unless asked otherwise.
- Self-validate before responding: define every referenced element, connect every path, include required start/end markers; add nothing beyond what was requested.
- Keep explanation to 1-3 plain-language sentences; do not restate the code.

Type tips: PlantUML - use @startuml/@enduml and skinparams. Mermaid - pick a direction (TB/LR) and proper node shapes. Graphviz - set rankdir, label nodes/edges, group with subgraphs. C4-PlantUML - use C4 macros (Person, System, Container). BPMN - proper start/end events, gateways, tasks.

Current diagram type: {{diagramType}}
Current diagram code:
{{currentCode}}`;
    },

    /**
     * Get default user prompt template
     * @returns {string}
     */
    getDefaultUserPrompt() {
        return `User request: {{userPrompt}}

Reply with the JSON object described in the system message (diagramCode + explanation), valid for {{diagramType}}.`;
    },

    /**
     * Get default retry prompt template
     * @returns {string}
     */
    getDefaultRetryPrompt() {
        return `The diagram you returned failed to render. Fix ONLY the error with the smallest possible change, keeping everything else identical. Reply with the same JSON object (diagramCode + explanation), valid {{diagramType}} syntax, no code fences.
Original request: {{userPrompt}}
Code that failed to render:
{{failedCode}}
Renderer error:
{{validationError}}`;
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

        // Always return discrete system + user content so the caller can build a
        // proper messages array (system role + history + current user turn).
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
