// Default example (plantuml) to start with
const defaultExample = `@startuml
Alice -> Bob: Hello
Bob --> Alice: Hi there
@enduml`;

        // Format compatibility for each diagram type
        const formatCompatibility = {
            blockdiag: ['png', 'svg', 'pdf'],
            bpmn: ['svg'],
            bytefield: ['svg'],
            seqdiag: ['png', 'svg', 'pdf'],
            actdiag: ['png', 'svg', 'pdf'],
            nwdiag: ['png', 'svg', 'pdf'],
            packetdiag: ['png', 'svg', 'pdf'],
            rackdiag: ['png', 'svg', 'pdf'],
            c4plantuml: ['png', 'svg', 'pdf', 'txt', 'base64'],
            d2: ['svg'],
            dbml: ['svg'],
            ditaa: ['png', 'svg'],
            erd: ['png', 'svg', 'jpeg', 'pdf'],
            excalidraw: ['svg'],
            graphviz: ['png', 'svg', 'jpeg', 'pdf'],
            mermaid: ['png', 'svg'],
            nomnoml: ['svg'],
            pikchr: ['svg'],
            plantuml: ['png', 'svg', 'pdf', 'txt', 'base64'],
            structurizr: ['png', 'svg', 'pdf', 'txt', 'base64'],
            svgbob: ['svg'],
            symbolator: ['svg'],
            tikz: ['png', 'svg', 'jpeg', 'pdf'],
            //umlet: ['png', 'svg', 'jpeg'],
            vega: ['png', 'svg', 'pdf'],
            vegalite: ['png', 'svg', 'pdf'],
            wavedrom: ['svg'],
            wireviz: ['png', 'svg']
        };

        // Format display types
        const formatDisplayTypes = {
            svg: 'image',
            png: 'image',
            jpeg: 'image',
            pdf: 'download',
            txt: 'text',
            base64: 'text'
        };

        // Track if the user has edited the content
        let userHasEditedContent = false;

        // Cache for examples we've already loaded
        const exampleCache = {
            plantuml: defaultExample
        };

        // Current diagram data for download
        let currentDiagramData = null;
        let currentDiagramType = 'plantuml';
        let currentOutputFormat = 'svg';
        let currentDiagramUrl = '';

        // Variables for debouncing
        let diagramUpdateTimer = null;
        const DEBOUNCE_DELAY = 1000; // 1 second delay

        // Function to debounce the diagram updates
        function debounceUpdateDiagram() {
            // Clear any existing timer
            if (diagramUpdateTimer) {
                clearTimeout(diagramUpdateTimer);
            }
            
            // Show a subtle "waiting" indicator
            const loadingMessage = document.getElementById('loadingMessage');
            loadingMessage.textContent = 'Diagram update scheduled...';
            loadingMessage.classList.add('loading-pulse');
            loadingMessage.style.display = 'block';
            
            // Set a new timer
            diagramUpdateTimer = setTimeout(() => {
                // Reset the timer
                diagramUpdateTimer = null;
                
                // Update the diagram
                updateDiagram();
            }, DEBOUNCE_DELAY);
        }

        // Function to update the format dropdown based on the selected diagram type
        function updateFormatDropdown() {
            const diagramType = document.getElementById('diagramType').value;
            const formatDropdown = document.getElementById('outputFormat');
            const currentFormat = formatDropdown.value;
            
            // Get supported formats for the selected diagram type
            const supportedFormats = formatCompatibility[diagramType] || ['svg'];
            
            // Clear current options
            formatDropdown.innerHTML = '';
            
            // Add options for each supported format
            supportedFormats.forEach(format => {
                const option = document.createElement('option');
                option.value = format;
                option.textContent = format.toUpperCase();
                formatDropdown.appendChild(option);
            });
            
            // Always prefer SVG as default when changing diagram types
            if (supportedFormats.includes('svg')) {
                formatDropdown.value = 'svg';
            } else {
                formatDropdown.value = supportedFormats[0];
            }
        }

        // Function to load an example for a diagram type
        async function loadExampleForDiagramType(type) {
            // Check if we already have this example cached
            if (exampleCache[type]) {
                return exampleCache[type];
            }

            // Show loading message
            document.getElementById('loadingMessage').style.display = 'block';

            try {
                // Try to fetch the example from a file
                const response = await fetch(`/examples/${type}.txt`);

                if (response.ok) {
                    const text = await response.text();
                    // Cache the result
                    exampleCache[type] = text;
                    return text;
                } else {
                    // If file not found, return a generic placeholder
                    return `Enter your ${type} diagram code here...`;
                }
            } catch (error) {
                console.warn(`Could not load example for ${type}:`, error);
                return `Enter your ${type} diagram code here...`;
            } finally {
                // Hide loading message
                document.getElementById('loadingMessage').style.display = 'none';
            }
        }

        // Function to encode text to UTF-8
        function textEncode(str) {
            if (window.TextEncoder) {
                return new TextEncoder('utf-8').encode(str);
            }
            var utf8 = unescape(encodeURIComponent(str));
            var result = new Uint8Array(utf8.length);
            for (var i = 0; i < utf8.length; i++) {
                result[i] = utf8.charCodeAt(i);
            }
            return result;
        }

        // Function to convert Uint8Array to string
        function uint8ArrayToString(array) {
            let result = '';
            for (let i = 0; i < array.length; i++) {
                result += String.fromCharCode(array[i]);
            }
            return result;
        }

        // Function to encode the diagram text for Kroki
        function encodeKrokiDiagram(text) {
            // 1. Convert string to UTF-8 using the provided function
            const bytes = textEncode(text);

            // 2. Compress the UTF-8 encoded data with deflate
            const compressed = pako.deflate(bytes);

            // 3. Convert compressed data to string for base64 encoding
            const strData = uint8ArrayToString(compressed);

            // 4. Base64 encode and make URL safe
            return btoa(strData)
                .replace(/\+/g, '-')
                .replace(/\//g, '_');
        }

        // Function to decode a Kroki diagram string
        function decodeKrokiDiagram(encodedString) {
            try {
                // 1. Make the string base64 compatible again
                const base64String = encodedString
                    .replace(/-/g, '+')
                    .replace(/_/g, '/');
                
                // 2. Base64 decode
                const binaryString = atob(base64String);
                
                // 3. Convert binary string to Uint8Array
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                // 4. Inflate (decompress) the data
                const decompressed = pako.inflate(bytes);
                
                // 5. Convert to string
                const decoder = new TextDecoder('utf-8');
                return decoder.decode(decompressed);
            } catch (error) {
                throw new Error(`Failed to decode: ${error.message}`);
            }
        }

        // Function to update the image link text
        function updateImageLink() {
            const imageLinkText = document.getElementById('image-link-text');
            const imageLinkRow = document.getElementById('image-link-row');
            
            // Only show for image formats
            if (formatDisplayTypes[currentOutputFormat] === 'image') {
                // For a generic image link, we just use the URL directly
                imageLinkText.value = currentDiagramUrl;
                imageLinkRow.style.display = 'flex';
            } else {
                imageLinkRow.style.display = 'none';
            }
        }

        // Function to update the diagram
        async function updateDiagram() {
            const code = document.getElementById('code').value;
            const diagramType = document.getElementById('diagramType').value;
            const outputFormat = document.getElementById('outputFormat').value;
            
            currentDiagramType = diagramType;
            currentOutputFormat = outputFormat;

            // Clear any existing debounce timer
            if (diagramUpdateTimer) {
                clearTimeout(diagramUpdateTimer);
                diagramUpdateTimer = null;
            }

            // Update loading indicator
            const loadingMessage = document.getElementById('loadingMessage');
            loadingMessage.textContent = 'Generating diagram...';
            loadingMessage.classList.add('loading-pulse');
            loadingMessage.style.display = 'block';
            
            try {
                // Encode the diagram
                const encodedDiagram = encodeKrokiDiagram(code);
                
                // Get server from window location instead of hardcoding
                const protocol = window.location.protocol;
                const hostname = window.location.hostname;
                const port = window.location.port ? `:${window.location.port}` : '';
                
                // Construct URL using current server information
                const url = `${protocol}//${hostname}${port}/${diagramType}/${outputFormat}/${encodedDiagram}`;
                currentDiagramUrl = url;
                
                // Determine how to display the result based on the format
                const displayType = formatDisplayTypes[outputFormat] || 'download';
                const diagramImg = document.getElementById('diagram');
                const textPreview = document.getElementById('text-preview');
                const placeholderContainer = document.getElementById('placeholder-container');
                const placeholderDownload = document.getElementById('placeholder-download');
                
                // Hide all preview elements initially
                diagramImg.style.display = 'none';
                textPreview.style.display = 'none';
                placeholderContainer.style.display = 'none';
                
                if (displayType === 'image') {
                    // Display as image
                    diagramImg.src = url;
                    diagramImg.style.display = 'block';
                    currentDiagramData = url;
                } else if (displayType === 'text') {
                    // Fetch and display as text
                    const response = await fetch(url);
                    const text = await response.text();
                    textPreview.textContent = text;
                    textPreview.style.display = 'block';
                    currentDiagramData = text;
                } else {
                    // For download-only formats like PDF, show the placeholder with download link
                    placeholderContainer.style.display = 'flex';
                    placeholderDownload.href = url;
                    placeholderDownload.download = `diagram.${outputFormat}`;
                    currentDiagramData = url;
                }

                // Update image link
                updateImageLink();

                // Hide error message if any
                loadingMessage.style.display = 'none';
                loadingMessage.classList.remove('loading-pulse');
                document.getElementById('errorMessage').style.display = 'none';
            } catch (error) {
                // Show error message
                loadingMessage.style.display = 'none';
                loadingMessage.classList.remove('loading-pulse');
                const errorMessage = document.getElementById('errorMessage');
                errorMessage.textContent = `Error: ${error.message}`;
                errorMessage.style.display = 'block';
            }
        }

        // Function to download the current diagram
        function downloadDiagram() {
            if (!currentDiagramData) return;
            
            const displayType = formatDisplayTypes[currentOutputFormat] || 'download';
            const format = currentOutputFormat.toLowerCase();
            const filename = `diagram.${format}`;
            
            // Create a download link
            const a = document.createElement('a');
            
            if (displayType === 'text') {
                // For text content, create a blob and download
                const blob = new Blob([currentDiagramData], { type: 'text/plain' });
                a.href = URL.createObjectURL(blob);
            } else {
                // For images or other formats, use the URL directly
                a.href = currentDiagramData;
            }
            
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        // Function to update the line numbers
        function updateLineNumbers() {
            const codeLines = document.getElementById('code').value.split('\n');
            const lineCount = codeLines.length;
            const lineNumbersDiv = document.getElementById('lineNumbers');

            // Generate the line numbers
            let lineNumbersHtml = '';
            for (let i = 1; i <= lineCount; i++) {
                lineNumbersHtml += i + '<br>';
            }

            // Update the line numbers div
            lineNumbersDiv.innerHTML = lineNumbersHtml;
        }

        // Function to handle the decode button click
        function handleDecode() {
            const encodedTextInput = document.getElementById('encoded-text');
            const encodedText = encodedTextInput.value.trim();
            
            if (!encodedText) {
                return; // Nothing to decode
            }
            
            try {
                // Extract the last part of a URL if it's a full Kroki URL
                let encodedDiagram = encodedText;
                if (encodedText.includes('/')) {
                    encodedDiagram = encodedText.split('/').pop();
                }
                
                // Decode the diagram
                const decodedText = decodeKrokiDiagram(encodedDiagram);
                
                // Update the code textarea
                document.getElementById('code').value = decodedText;
                userHasEditedContent = true;
                
                // Update line numbers and preview
                updateLineNumbers();
                // Use immediate update here as this is a deliberate user action
                updateDiagram();
                
                // Clear the input field
                encodedTextInput.value = '';
            } catch (error) {
                // Show error message
                const errorMessage = document.getElementById('errorMessage');
                errorMessage.textContent = `Decode Error: ${error.message}`;
                errorMessage.style.display = 'block';
            }
        }

        /**
         * Initializes the diagram type dropdown with all available diagram types
         * from the formatCompatibility object
         */
        function initializeDiagramTypeDropdown() {
            const diagramTypeDropdown = document.getElementById('diagramType');
            if (!diagramTypeDropdown) {
                console.error('Diagram type dropdown not found');
                return;
            }
            
            // Clear current options
            diagramTypeDropdown.innerHTML = '';
            
            // Get all diagram types from formatCompatibility
            const diagramTypes = Object.keys(formatCompatibility);
            
            // Sort diagram types alphabetically for better UX
            diagramTypes.sort();
            
            // Add options for each diagram type
            diagramTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                diagramTypeDropdown.appendChild(option);
            });
            
            // Set default to PlantUML
            if (diagramTypes.includes('plantuml')) {
                diagramTypeDropdown.value = 'plantuml';
            } else {
                diagramTypeDropdown.value = diagramTypes[0];
            }
        }

        // Add event listeners
        const codeTextarea = document.getElementById('code');

        // Mark content as edited when user types
        codeTextarea.addEventListener('input', function () {
            userHasEditedContent = true;
            updateLineNumbers();
            // Use debounced update for diagram
            debounceUpdateDiagram();
        });

        codeTextarea.addEventListener('scroll', function () {
            // Sync line numbers scroll position with textarea
            document.getElementById('lineNumbers').scrollTop = this.scrollTop;
        });

        // Add diagram type change listener
        document.getElementById('diagramType').addEventListener('change', async function () {
            const diagramType = this.value;
            const currentCode = codeTextarea.value;

            // Update the format dropdown based on the selected diagram type
            updateFormatDropdown();

            // Check if the current code is one of our examples
            const isCurrentCodeAnExample = Object.values(exampleCache).includes(currentCode);

            // Only update if user hasn't edited or is viewing an example
            if (!userHasEditedContent || isCurrentCodeAnExample) {
                // Load the example for this diagram type
                const example = await loadExampleForDiagramType(diagramType);

                // Update textarea with the example
                codeTextarea.value = example;
                updateLineNumbers();
                // Use immediate update here since this is a deliberate change
                updateDiagram();
            } else {
                // Just update the diagram with the current code (use debounced version)
                debounceUpdateDiagram();
            }
        });

        // Add format change listener
        document.getElementById('outputFormat').addEventListener('change', updateDiagram); // Keep this immediate

        // Add download button listener
        document.getElementById('downloadButton').addEventListener('click', downloadDiagram);

        // Add copy button listener for image link
        const copyLinkBtn = document.getElementById('copy-link-btn');
        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', function() {
                const imageLinkText = document.getElementById('image-link-text');
                if (imageLinkText) {
                    imageLinkText.select();
                    document.execCommand('copy');
                    
                    // Give visual feedback
                    const originalText = this.textContent;
                    this.textContent = 'Copied!';
                    setTimeout(() => {
                        this.textContent = originalText;
                    }, 1500);
                }
            });
        }

        // Add decode button listener
        const decodeBtn = document.getElementById('decode-btn');
        if (decodeBtn) {
            decodeBtn.addEventListener('click', handleDecode);
        }

        // Allow decoding when pressing Enter in the encoded text input
        const encodedTextInput = document.getElementById('encoded-text');
        if (encodedTextInput) {
            encodedTextInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    handleDecode();
                }
            });
        }

        document.addEventListener('DOMContentLoaded', function() {
            // Initialize diagram type dropdown first
            initializeDiagramTypeDropdown();
            
            // Initialize format dropdown based on selected diagram type
            updateFormatDropdown();
            
            // Initialize line numbers and diagram
            updateLineNumbers();
            updateDiagram();
        });