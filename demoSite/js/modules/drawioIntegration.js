/**
 * Draw.io Integration Module
 * Handles visual editing of diagrams.net diagrams through embedded Draw.io editor
 * 
 * @author Vysakh Pillai
 */

class DrawioIntegration {
    constructor() {
        this.isOpen = false;
        this.isDrawioReady = false;
        this.iframe = null;
        this.modal = null;
        this.drawioServerUrl = 'https://embed.diagrams.net/embed'; // Default, will be overridden

        // Setup event handlers immediately
        this.setupEventHandlers();
        // Load config in parallel
        this.loadConfig();
    }

    /**
     * Load configuration from backend
     */
    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            const config = await response.json();
            if (config.drawio && config.drawio.server_url) {
                this.drawioServerUrl = config.drawio.server_url;
                // Visual editor server URL configured
                this.updateServerInfo();
            }
        } catch (error) {
            console.warn('Could not load visual editor config, using default URL:', error);
            this.updateServerInfo();
        }
    }

    /**
     * Update server info display in modal header
     */
    updateServerInfo() {
        const serverInfoElement = document.getElementById('drawio-server-info');
        if (serverInfoElement) {
            try {
                const url = new URL(this.drawioServerUrl);
                const hostname = url.hostname;
                // Show a clean, user-friendly server indication
                serverInfoElement.textContent = `using ${hostname}`;
            } catch (error) {
                serverInfoElement.textContent = 'using configured server';
            }
        }
    }

    /**
     * Setup event handlers for Draw.io communication and modal interactions
     */
    setupEventHandlers() {
        // PostMessage listener for Draw.io communication
        window.addEventListener('message', (event) => {
            // PostMessage communication active

            // Very permissive for now - like the reference implementation
            this.handleDrawioMessage(event.data);
        }, false);

        // Escape key to close modal
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isOpen) {
                this.closeModal();
            }
        });
    }

    /**
     * Handle messages from Draw.io iframe
     */
    handleDrawioMessage(data) {
        // Processing visual editor message

        // Handle XML data from Draw.io (save/export)
        if (typeof data === 'string' && (data.includes('<mxfile') || data.includes('<mxGraphModel'))) {
            this.updateCodeEditor(data);
            this.updateStatus('Diagram updated from visual editor', 'ready');
            return;
        }

        // Handle Draw.io events
        if (data && data.event) {
            switch (data.event) {
                case 'ready':
                    this.isDrawioReady = true;
                    this.updateStatus('Visual editor ready', 'ready');
                    setTimeout(() => {
                        this.sendCurrentXmlToDrawio();
                    }, 500);
                    break;

                case 'save':
                    if (data.xml) {
                        this.updateCodeEditor(data.xml);
                        this.updateStatus('Diagram saved', 'ready');
                        // Close modal after save
                        setTimeout(() => {
                            this.closeModal();
                        }, 1000);
                    }
                    break;

                case 'export':
                    if (data.xml) {
                        this.updateCodeEditor(data.xml);
                        this.updateStatus('Diagram exported', 'ready');
                    }
                    break;

                case 'exit':
                    this.updateStatus('Editor closed', '');
                    this.closeModal();
                    break;

                default:
                // Unhandled visual editor event: ignoring
            }
        } else if (data === 'ready') {
            // Handle simple ready message
            this.isDrawioReady = true;
            this.updateStatus('Visual editor ready', 'ready');
            setTimeout(() => {
                this.sendCurrentXmlToDrawio();
            }, 500);
        }
    }

    /**
     * Open the Draw.io modal editor
     */
    openModal() {
        if (this.isOpen) return;

        this.modal = document.getElementById('drawio-modal');
        this.iframe = document.getElementById('drawio-iframe');

        if (!this.modal || !this.iframe) {
            console.error('Visual editor modal elements not found');
            return;
        }

        // Opening visual editor modal

        // Reset state
        this.isDrawioReady = false;
        this.updateStatus('Loading visual editor...', '');
        this.updateServerInfo();

        // Show modal
        this.modal.style.display = 'flex';
        this.isOpen = true;

        // Setup iframe
        this.setupIframe();

        // Setup close button
        const closeBtn = document.getElementById('drawio-close-btn');
        if (closeBtn) {
            closeBtn.onclick = () => this.closeModal();
        }

        // Focus the modal container to ensure it can capture key events
        this.modal.focus();

        // Add modal-specific keydown handler for better Escape key handling
        this.modalKeyHandler = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.closeModal();
            }
        };
        this.modal.addEventListener('keydown', this.modalKeyHandler);

        // Disable body scroll
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close the Draw.io modal
     */
    closeModal() {
        if (!this.isOpen) return;

        // Closing visual editor modal

        if (this.modal) {
            this.modal.style.display = 'none';

            // Remove modal-specific keydown handler
            if (this.modalKeyHandler) {
                this.modal.removeEventListener('keydown', this.modalKeyHandler);
                this.modalKeyHandler = null;
            }
        }

        // Reset iframe
        if (this.iframe) {
            this.iframe.style.display = 'none';
            this.iframe.src = '';
        }

        // Show loading for next time
        const loading = document.getElementById('drawio-loading');
        if (loading) {
            loading.style.display = 'block';
        }

        this.isOpen = false;
        this.isDrawioReady = false;

        // Re-enable body scroll
        document.body.style.overflow = '';
    }

    /**
     * Setup the Draw.io iframe with proper URL and event handlers
     */
    setupIframe() {
        // Ensure URL has trailing slash for proper parameter injection
        const baseUrl = this.drawioServerUrl.endsWith('/') ? this.drawioServerUrl : `${this.drawioServerUrl}/`;

        // Add required parameters to the embed URL
        const embedUrl = `${baseUrl}?embed=1&ui=atlas&libraries=1&spin=1&noExitBtn=1&returnbounds`;

        // Loading visual editor iframe
        this.iframe.src = embedUrl;

        this.iframe.onload = () => {
            this.updateStatus('Visual editor loaded, initializing...', '');
            // Visual editor iframe loaded successfully

            // Show iframe after load
            setTimeout(() => {
                const loading = document.getElementById('drawio-loading');
                if (loading) {
                    loading.style.display = 'none';
                }
                this.iframe.style.display = 'block';
            }, 1000);
        };

        this.iframe.onerror = () => {
            this.updateStatus('Failed to load visual editor', 'error');
            console.error('Failed to load visual editor iframe');

            const loading = document.getElementById('drawio-loading');
            if (loading) {
                loading.innerHTML = `
                    <div style="color: #e74c3c;">
                        <strong>Failed to load Visual Editor</strong><br>
                        Please check if visual editor server is running at:<br>
                        <code>${this.drawioServerUrl}</code>
                    </div>
                `;
            }
        };
    }

    /**
     * Send current XML content to Draw.io
     */
    sendCurrentXmlToDrawio() {
        if (!this.isDrawioReady || !this.iframe) {
            console.warn('Visual editor not ready, cannot send XML');
            return;
        }

        const codeTextarea = document.getElementById('code');
        if (!codeTextarea) {
            console.error('Code textarea not found');
            return;
        }

        let xml = codeTextarea.value.trim();

        // If empty or invalid, use default Draw.io XML
        if (!xml || (!xml.includes('<mxfile') && !xml.includes('<mxGraphModel'))) {
            xml = this.getDefaultXml();
            // Using default XML template
        }

        try {
            // Sending diagram data to visual editor
            const drawioOrigin = new URL(this.drawioServerUrl).origin;
            this.iframe.contentWindow.postMessage(xml, drawioOrigin);
            this.updateStatus('Diagram loaded in visual editor', 'ready');
        } catch (error) {
            console.error('Error sending XML to visual editor:', error);
            this.updateStatus('Error loading diagram', 'error');
        }
    }

    /**
     * Update the code editor with new XML content
     */
    updateCodeEditor(xml) {
        const codeTextarea = document.getElementById('code');
        if (codeTextarea && xml) {
            // Updating code editor from visual editor
            codeTextarea.value = xml;

            // Trigger change event to update diagram preview
            const event = new Event('input', { bubbles: true });
            codeTextarea.dispatchEvent(event);
        }
    }

    /**
     * Update status display in modal
     */
    updateStatus(message, type = '') {
        const statusElement = document.getElementById('drawio-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `drawio-status ${type}`;
        }
        // Visual editor status updated
    }

    /**
     * Get default Draw.io XML for new diagrams
     */
    getDefaultXml() {
        return `<mxfile><diagram id="default"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="Hello World" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="40" y="40" width="120" height="60" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`;
    }

    /**
     * Static method to check if visual editor should be available
     */
    static shouldShowDrawioButton() {
        const diagramType = document.getElementById('diagramType');
        return diagramType && diagramType.value === 'diagramsnet';
    }
}

// Export for use in main.js
export default DrawioIntegration;