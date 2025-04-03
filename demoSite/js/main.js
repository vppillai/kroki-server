// Default PlantUML example
const defaultExample = `@startuml
Alice -> Bob: Hello
Bob --> Alice: Hi there
@enduml`;

        // Supported formats for each diagram type
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
            diagramsnet: ['png', 'svg'],
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

        // Display type for each format
        const formatDisplayTypes = {
            svg: 'image',
            png: 'image',
            jpeg: 'image',
            pdf: 'download',
            txt: 'text',
            base64: 'text'
        };

        // State variables
        let userHasEditedContent = false;
        let currentDiagramData = null;
        let currentDiagramType = 'plantuml';
        let currentOutputFormat = 'svg';
        let currentDiagramUrl = '';
        let diagramUpdateTimer = null;
        const DEBOUNCE_DELAY = 1000; // 1 second delay

        // Cache for loaded examples
        const exampleCache = {
            plantuml: defaultExample
        };

        // Parse URL parameters
        function getUrlParameters() {
            const params = new URLSearchParams(window.location.search);
            return {
                diag: params.get('diag'),
                fmt: params.get('fmt'),
                im: params.get('im')
            };
        }

        // Process URL parameters and update UI
        function processUrlParameters() {
            const params = getUrlParameters();
            
            // Set diagram type if specified in URL
            if (params.diag && formatCompatibility[params.diag]) {
                document.getElementById('diagramType').value = params.diag;
                currentDiagramType = params.diag;
                updateFormatDropdown();
            }
            
            // Get current diagram type and its supported formats
            const diagramType = document.getElementById('diagramType').value;
            const supportedFormats = formatCompatibility[diagramType] || ['svg'];
            
            // Set format if specified in URL and compatible with diagram type
            if (!params.fmt || !supportedFormats.includes(params.fmt)) {
                // Use default format if not specified or not supported
                const defaultFormat = supportedFormats.includes('svg') ? 'svg' : supportedFormats[0];
                document.getElementById('outputFormat').value = defaultFormat;
                currentOutputFormat = defaultFormat;
                
                // Update URL with the correct format
                const url = new URL(window.location.href);
                url.searchParams.set('fmt', defaultFormat);
                window.history.replaceState({}, '', url);
            } else {
                document.getElementById('outputFormat').value = params.fmt;
                currentOutputFormat = params.fmt;
            }
            
            // Set diagram code if encoded content is provided
            if (params.im) {
                try {
                    const decodedText = decodeKrokiDiagram(params.im);
                    document.getElementById('code').value = decodedText;
                    updateLineNumbers();
                    userHasEditedContent = true;
                } catch (error) {
                    console.error('Failed to decode diagram from URL:', error);
                    loadDefaultExample(diagramType);
                }
            } else {
                loadDefaultExample(diagramType);
            }
        }

        // Load the default example for a diagram type
        function loadDefaultExample(diagramType) {
            loadExampleForDiagramType(diagramType).then(example => {
                document.getElementById('code').value = example;
                updateLineNumbers();
                userHasEditedContent = false;
                updateDiagram();
            });
        }

        // Update the URL with current diagram state
        function updateUrl() {
            const diagramType = document.getElementById('diagramType').value;
            const outputFormat = document.getElementById('outputFormat').value;
            const code = document.getElementById('code').value;
            
            const url = new URL(window.location.href);
            
            url.searchParams.set('diag', diagramType);
            url.searchParams.set('fmt', outputFormat);
            
            if (code.trim() === '') {
                url.searchParams.delete('im');
            } else {
                const encodedDiagram = encodeKrokiDiagram(code);
                url.searchParams.set('im', encodedDiagram);
            }
            
            window.history.replaceState({}, '', url);
        }

        // Debounce diagram updates
        function debounceUpdateDiagram() {
            if (diagramUpdateTimer) {
                clearTimeout(diagramUpdateTimer);
            }
            
            const loadingMessage = document.getElementById('loadingMessage');
            loadingMessage.textContent = 'Diagram update scheduled...';
            loadingMessage.classList.add('loading-pulse');
            loadingMessage.style.display = 'block';
            
            diagramUpdateTimer = setTimeout(() => {
                diagramUpdateTimer = null;
                updateDiagram();
            }, DEBOUNCE_DELAY);
        }

        // Update format dropdown based on selected diagram type
        function updateFormatDropdown() {
            const diagramType = document.getElementById('diagramType').value;
            const formatDropdown = document.getElementById('outputFormat');
            const currentFormat = formatDropdown.value;
            
            const supportedFormats = formatCompatibility[diagramType] || ['svg'];
            
            formatDropdown.innerHTML = '';
            
            supportedFormats.forEach(format => {
                const option = document.createElement('option');
                option.value = format;
                option.textContent = format.toUpperCase();
                formatDropdown.appendChild(option);
            });
            
            if (supportedFormats.includes(currentFormat)) {
                formatDropdown.value = currentFormat;
            } else if (supportedFormats.includes('svg')) {
                formatDropdown.value = 'svg';
            } else {
                formatDropdown.value = supportedFormats[0];
            }
            
            currentOutputFormat = formatDropdown.value;
        }

        // Load example for a diagram type
        async function loadExampleForDiagramType(type) {
            if (exampleCache[type]) {
                return exampleCache[type];
            }

            document.getElementById('loadingMessage').style.display = 'block';

            try {
                const response = await fetch(`/examples/${type}.txt`);

                if (response.ok) {
                    const text = await response.text();
                    exampleCache[type] = text;
                    return text;
                } else {
                    return `Enter your ${type} diagram code here...`;
                }
            } catch (error) {
                console.warn(`Could not load example for ${type}:`, error);
                return `Enter your ${type} diagram code here...`;
            } finally {
                document.getElementById('loadingMessage').style.display = 'none';
            }
        }

        // Encode text to UTF-8
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

        // Convert Uint8Array to string
        function uint8ArrayToString(array) {
            let result = '';
            for (let i = 0; i < array.length; i++) {
                result += String.fromCharCode(array[i]);
            }
            return result;
        }

        // Encode diagram text for Kroki
        function encodeKrokiDiagram(text) {
            const bytes = textEncode(text);
            const compressed = pako.deflate(bytes);
            const strData = uint8ArrayToString(compressed);
            return btoa(strData)
                .replace(/\+/g, '-')
                .replace(/\//g, '_');
        }

        // Decode a Kroki diagram string
        function decodeKrokiDiagram(encodedString) {
            try {
                const base64String = encodedString
                    .replace(/-/g, '+')
                    .replace(/_/g, '/');
                
                const binaryString = atob(base64String);
                
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                const decompressed = pako.inflate(bytes);
                
                const decoder = new TextDecoder('utf-8');
                return decoder.decode(decompressed);
            } catch (error) {
                throw new Error(`Failed to decode: ${error.message}`);
            }
        }

        // Update the image link text
        function updateImageLink() {
            const imageLinkText = document.getElementById('image-link-text');
            const imageLinkRow = document.getElementById('image-link-row');
            
            if (formatDisplayTypes[currentOutputFormat] === 'image') {
                imageLinkText.value = currentDiagramUrl;
                imageLinkRow.style.display = 'flex';
            } else {
                imageLinkRow.style.display = 'none';
            }
        }

        // Update the diagram
        async function updateDiagram() {
            const code = document.getElementById('code').value;
            const diagramType = document.getElementById('diagramType').value;
            const outputFormat = document.getElementById('outputFormat').value;
            
            currentDiagramType = diagramType;
            currentOutputFormat = outputFormat;

            if (diagramUpdateTimer) {
                clearTimeout(diagramUpdateTimer);
                diagramUpdateTimer = null;
            }

            const loadingMessage = document.getElementById('loadingMessage');
            loadingMessage.textContent = 'Generating diagram...';
            loadingMessage.classList.add('loading-pulse');
            loadingMessage.style.display = 'block';
            
            try {
                const encodedDiagram = encodeKrokiDiagram(code);
                
                const protocol = window.location.protocol;
                const hostname = window.location.hostname;
                const port = window.location.port ? `:${window.location.port}` : '';
                
                const url = `${protocol}//${hostname}${port}/${diagramType}/${outputFormat}/${encodedDiagram}`;
                currentDiagramUrl = url;
                
                const displayType = formatDisplayTypes[outputFormat] || 'download';
                const diagramImg = document.getElementById('diagram');
                const textPreview = document.getElementById('text-preview');
                const placeholderContainer = document.getElementById('placeholder-container');
                const placeholderDownload = document.getElementById('placeholder-download');
                
                diagramImg.style.display = 'none';
                textPreview.style.display = 'none';
                placeholderContainer.style.display = 'none';
                
                if (displayType === 'image') {
                    diagramImg.src = url;
                    diagramImg.style.display = 'block';
                    currentDiagramData = url;
                } else if (displayType === 'text') {
                    const response = await fetch(url);
                    const text = await response.text();
                    textPreview.textContent = text;
                    textPreview.style.display = 'block';
                    currentDiagramData = text;
                } else {
                    placeholderContainer.style.display = 'flex';
                    placeholderDownload.href = url;
                    placeholderDownload.download = `diagram.${outputFormat}`;
                    currentDiagramData = url;
                }

                updateImageLink();
                updateUrl();

                loadingMessage.style.display = 'none';
                loadingMessage.classList.remove('loading-pulse');
                document.getElementById('errorMessage').style.display = 'none';
            } catch (error) {
                loadingMessage.style.display = 'none';
                loadingMessage.classList.remove('loading-pulse');
                const errorMessage = document.getElementById('errorMessage');
                errorMessage.textContent = `Error: ${error.message}`;
                errorMessage.style.display = 'block';
            }
        }

        // Download the current diagram
        function downloadDiagram() {
            if (!currentDiagramData) return;
            
            const displayType = formatDisplayTypes[currentOutputFormat] || 'download';
            const format = currentOutputFormat.toLowerCase();
            const filename = `diagram.${format}`;
            
            const a = document.createElement('a');
            
            if (displayType === 'text') {
                const blob = new Blob([currentDiagramData], { type: 'text/plain' });
                a.href = URL.createObjectURL(blob);
            } else {
                a.href = currentDiagramData;
            }
            
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        // Update line numbers in the editor
        function updateLineNumbers() {
            const codeLines = document.getElementById('code').value.split('\n');
            const lineCount = codeLines.length;
            const lineNumbersDiv = document.getElementById('lineNumbers');

            let lineNumbersHtml = '';
            for (let i = 1; i <= lineCount; i++) {
                lineNumbersHtml += i + '<br>';
            }

            lineNumbersDiv.innerHTML = lineNumbersHtml;
        }

        // Handle the decode button click
        function handleDecode() {
            const encodedTextInput = document.getElementById('encoded-text');
            const encodedText = encodedTextInput.value.trim();
            
            if (!encodedText) return;
            
            try {
                let encodedDiagram = encodedText;
                if (encodedText.includes('/')) {
                    encodedDiagram = encodedText.split('/').pop();
                }
                
                const decodedText = decodeKrokiDiagram(encodedDiagram);
                
                document.getElementById('code').value = decodedText;
                userHasEditedContent = true;
                
                updateLineNumbers();
                updateDiagram();
                
                encodedTextInput.value = '';
            } catch (error) {
                const errorMessage = document.getElementById('errorMessage');
                errorMessage.textContent = `Decode Error: ${error.message}`;
                errorMessage.style.display = 'block';
            }
        }

        // Initialize diagram type dropdown
        function initializeDiagramTypeDropdown() {
            const diagramTypeDropdown = document.getElementById('diagramType');
            if (!diagramTypeDropdown) {
                console.error('Diagram type dropdown not found');
                return;
            }
            
            diagramTypeDropdown.innerHTML = '';
            
            const diagramTypes = Object.keys(formatCompatibility);
            diagramTypes.sort();
            
            diagramTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                diagramTypeDropdown.appendChild(option);
            });
            
            if (diagramTypes.includes('plantuml')) {
                diagramTypeDropdown.value = 'plantuml';
            } else {
                diagramTypeDropdown.value = diagramTypes[0];
            }
        }

        // Resize functionality
        function initializeResizeHandle() {
            const container = document.querySelector('.container');
            const editor = document.querySelector('.editor');
            const handle = document.getElementById('resize-handle');
            const preview = document.querySelector('.preview');
            let isResizing = false;
            let startX, startWidth;

            handle.addEventListener('mousedown', function(e) {
                isResizing = true;
                startX = e.clientX;
                startWidth = editor.offsetWidth;
                handle.classList.add('dragging');
                
                // Prevent text selection during resize
                document.body.style.userSelect = 'none';
            });

            document.addEventListener('mousemove', function(e) {
                if (!isResizing) return;
                
                const width = startWidth + (e.clientX - startX);
                const containerWidth = container.offsetWidth;
                
                // Limit resize to reasonable bounds (10% to 90% of container)
                const minWidth = containerWidth * 0.1;
                const maxWidth = containerWidth * 0.9;
                
                if (width >= minWidth && width <= maxWidth) {
                    editor.style.width = width + 'px';
                    // Adjust line numbers after resize
                    updateLineNumbers();
                    // Check if controls need to be rearranged
                    adjustControlsLayout();
                }
            });

            document.addEventListener('mouseup', function() {
                if (isResizing) {
                    isResizing = false;
                    handle.classList.remove('dragging');
                    document.body.style.userSelect = '';
                }
            });
        }

        // Function to adjust controls layout based on available width
        function adjustControlsLayout() {
            const controlsContainer = document.querySelector('.controls');
            const editor = document.querySelector('.editor');
            const STACK_THRESHOLD = 350; // Width in pixels below which to stack controls
            
            if (editor.offsetWidth < STACK_THRESHOLD) {
                controlsContainer.classList.add('stacked-controls');
            } else {
                controlsContainer.classList.remove('stacked-controls');
            }
        }

        // Event Listeners
        document.addEventListener('DOMContentLoaded', function() {
            initializeDiagramTypeDropdown();
            updateFormatDropdown();
            processUrlParameters();
            updateLineNumbers();
            updateDiagram();
            initializeResizeHandle(); // Initialize the resize handle
            adjustControlsLayout(); // Initial layout adjustment
        });

        // Add window resize listener
        window.addEventListener('resize', function() {
            adjustControlsLayout();
        });

        const codeTextarea = document.getElementById('code');

        codeTextarea.addEventListener('input', function () {
            const code = this.value.trim();
            
            if (code !== '') {
                userHasEditedContent = true;
            }
            
            updateLineNumbers();
            debounceUpdateDiagram();
            updateUrl();
        });

        codeTextarea.addEventListener('scroll', function () {
            document.getElementById('lineNumbers').scrollTop = this.scrollTop;
        });

        document.getElementById('diagramType').addEventListener('change', async function () {
            const diagramType = this.value;
            const currentCode = codeTextarea.value;

            updateFormatDropdown();
            updateUrl();

            const isCodeEmpty = currentCode.trim() === '';
            const isCurrentCodeAnExample = Object.values(exampleCache).includes(currentCode);

            if (!userHasEditedContent || isCurrentCodeAnExample || isCodeEmpty) {
                const example = await loadExampleForDiagramType(diagramType);
                codeTextarea.value = example;
                updateLineNumbers();
                updateDiagram();
            } else {
                debounceUpdateDiagram();
            }
        });

        document.getElementById('outputFormat').addEventListener('change', function() {
            updateDiagram();
        });

        document.getElementById('downloadButton').addEventListener('click', downloadDiagram);

        const copyLinkBtn = document.getElementById('copy-link-btn');
        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', function() {
                const imageLinkText = document.getElementById('image-link-text');
                if (imageLinkText) {
                    imageLinkText.select();
                    document.execCommand('copy');
                    
                    const originalText = this.textContent;
                    this.textContent = 'Copied!';
                    setTimeout(() => {
                        this.textContent = originalText;
                    }, 1500);
                }
            });
        }

        const decodeBtn = document.getElementById('decode-btn');
        if (decodeBtn) {
            decodeBtn.addEventListener('click', handleDecode);
        }

        const encodedTextInput = document.getElementById('encoded-text');
        if (encodedTextInput) {
            encodedTextInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    handleDecode();
                }
            });
        }