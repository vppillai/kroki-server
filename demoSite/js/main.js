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

// Zoom and pan state
let zoomState = {
    scale: 1,
    translateX: 0,
    translateY: 0,
    minScale: 0.1,
    maxScale: 5,
    scaleStep: 0.1,
    userHasInteracted: false // Track if user has manually zoomed/panned
};

// Cache for loaded examples
const exampleCache = {
    plantuml: defaultExample
};

// File operations state
let currentFile = {
    name: null,
    path: null,
    content: '',
    saved: false,
    handle: null, // For File System Access API
    isOpen: false // Track if we actually have a file open
};

// File operations functionality
function updateFileStatus() {
    const fileNameElement = document.getElementById('file-name');
    const saveStatusElement = document.getElementById('save-status');
    const saveBtn = document.getElementById('save-file-btn');

    // Handle no file open state
    if (!currentFile.isOpen) {
        fileNameElement.textContent = 'No file open';
        saveStatusElement.textContent = '';
        saveStatusElement.className = 'save-status';
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.title = 'No file to save';
        }
        return;
    }

    // Add animation class for file name changes
    if (fileNameElement.textContent !== currentFile.name) {
        fileNameElement.classList.add('changed');
        setTimeout(() => fileNameElement.classList.remove('changed'), 300);
    }

    fileNameElement.textContent = currentFile.name || 'Untitled';

    if (currentFile.saved) {
        saveStatusElement.textContent = 'Saved';
        saveStatusElement.className = 'save-status saved';
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.title = 'File is saved';
        }
    } else {
        saveStatusElement.textContent = '• Unsaved changes';
        saveStatusElement.className = 'save-status';
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.title = 'Save file (Ctrl+S)';
        }
    }
}

function markFileAsModified() {
    if (currentFile.isOpen && currentFile.saved) {
        currentFile.saved = false;
        updateFileStatus();

        // Visual feedback for modification
        const editor = document.getElementById('code');
        if (editor) {
            editor.style.borderLeftColor = 'var(--warning-color)';
            setTimeout(() => {
                editor.style.borderLeftColor = '';
            }, 1000);
        }
    }
}

function markFileAsSaved() {
    currentFile.saved = true;
    updateFileStatus();

    // Visual feedback for save
    const saveStatusElement = document.getElementById('save-status');
    if (saveStatusElement) {
        saveStatusElement.style.transform = 'scale(1.1)';
        setTimeout(() => {
            saveStatusElement.style.transform = '';
        }, 200);
    }
}

// Check if File System Access API is supported
function isFileSystemAccessSupported() {
    return 'showOpenFilePicker' in window;
}

// Open file using File System Access API or fallback to input
async function openFile() {
    try {
        if (isFileSystemAccessSupported()) {
            const [fileHandle] = await window.showOpenFilePicker({
                types: [{
                    description: 'Diagram files',
                    accept: {
                        'text/*': ['.puml', '.plantuml', '.uml', '.txt', '.md', '.py', '.js', '.json', '.xml', '.yaml', '.yml', '.dot', '.gv', '.mmd', '.mermaid', '.d2', '.bpmn', '.erd', '.tikz', '.svg', '.drawio']
                    }
                }]
            });

            const file = await fileHandle.getFile();
            const content = await file.text();

            currentFile.name = file.name;
            currentFile.handle = fileHandle;
            currentFile.content = content;
            currentFile.saved = true;
            currentFile.isOpen = true;

            const codeTextarea = document.getElementById('code');
            codeTextarea.value = content;
            updateLineNumbers();
            updateDiagram();
            updateFileStatus();

            // Detect diagram type from content or filename
            detectDiagramType(content, file.name);

        } else {
            // Fallback to file input
            const fileInput = document.getElementById('file-input');
            fileInput.click();
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error opening file:', error);
            showErrorMessage('Failed to open file: ' + error.message);
        }
    }
}

// Handle file input change (fallback method)
function handleFileInputChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const content = e.target.result;

        currentFile.name = file.name;
        currentFile.handle = null;
        currentFile.content = content;
        currentFile.saved = true;
        currentFile.isOpen = true;

        const codeTextarea = document.getElementById('code');
        codeTextarea.value = content;
        updateLineNumbers();
        updateDiagram();
        updateFileStatus();

        // Detect diagram type from content or filename
        detectDiagramType(content, file.name);
    };
    reader.readAsText(file);

    // Reset the input
    event.target.value = '';
}

// Detect diagram type from content or filename
function detectDiagramType(content, filename) {
    const diagramTypeSelect = document.getElementById('diagramType');
    const lowerContent = content.toLowerCase();
    const lowerFilename = filename.toLowerCase();

    // Try to detect from content
    if (lowerContent.includes('@startuml') || lowerContent.includes('@enduml')) {
        diagramTypeSelect.value = 'plantuml';
    } else if (lowerContent.includes('graph') && (lowerContent.includes('mermaid') || lowerFilename.includes('.mmd'))) {
        diagramTypeSelect.value = 'mermaid';
    } else if (lowerContent.includes('digraph') || lowerFilename.includes('.dot') || lowerFilename.includes('.gv')) {
        diagramTypeSelect.value = 'graphviz';
    } else if (lowerFilename.includes('.d2')) {
        diagramTypeSelect.value = 'd2';
    } else if (lowerFilename.includes('.py')) {
        diagramTypeSelect.value = 'structurizr';
    }

    // Update format dropdown and trigger diagram update
    updateFormatDropdown();
    currentDiagramType = diagramTypeSelect.value;
}

// Save file using File System Access API or fallback to download
async function saveFile() {
    const content = document.getElementById('code').value;

    try {
        if (currentFile.handle && isFileSystemAccessSupported()) {
            // Use existing file handle
            const writable = await currentFile.handle.createWritable();
            await writable.write(content);
            await writable.close();

            currentFile.content = content;
            markFileAsSaved();
            showSuccessMessage('File saved successfully!');
        } else {
            // No handle available, prompt for save as
            await saveAsFile();
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error saving file:', error);
            showErrorMessage('Failed to save file: ' + error.message);
        }
    }
}

// Save as new file
async function saveAsFile() {
    const content = document.getElementById('code').value;

    try {
        if (isFileSystemAccessSupported()) {
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: getDefaultFileName(),
                types: [{
                    description: 'Diagram files',
                    accept: {
                        'text/plain': ['.puml', '.plantuml', '.uml', '.txt', '.md', '.py', '.js', '.json', '.xml', '.yaml', '.yml', '.dot', '.gv', '.mmd', '.mermaid', '.d2', '.bpmn', '.erd', '.tikz', '.svg', '.drawio']
                    }
                }]
            });

            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();

            currentFile.name = fileHandle.name || getDefaultFileName();
            currentFile.handle = fileHandle;
            currentFile.content = content;
            currentFile.isOpen = true;
            markFileAsSaved();
            updateFileStatus();
            showSuccessMessage('File saved successfully!');
        } else {
            // Fallback to download
            downloadAsFile(content);
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error saving file:', error);
            showErrorMessage('Failed to save file: ' + error.message);
        }
    }
}

// Get default filename based on diagram type
function getDefaultFileName() {
    const extensions = {
        plantuml: '.puml',
        mermaid: '.mmd',
        graphviz: '.dot',
        d2: '.d2',
        structurizr: '.py',
        ditaa: '.txt',
        erd: '.erd',
        pikchr: '.txt',
        kroki: '.txt'
    };

    const extension = extensions[currentDiagramType] || '.txt';
    return `diagram${extension}`;
}

// Fallback download function
function downloadAsFile(content) {
    const filename = getDefaultFileName();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Update current file info
    currentFile.name = filename;
    currentFile.content = content;
    currentFile.isOpen = true;
    markFileAsSaved();
    updateFileStatus();
    showSuccessMessage('File downloaded successfully!');
}

// Show success message
function showSuccessMessage(message) {
    const saveStatus = document.getElementById('save-status');
    const originalClass = saveStatus.className;
    const originalText = saveStatus.textContent;

    saveStatus.textContent = message;
    saveStatus.className = 'save-status saved';

    setTimeout(() => {
        saveStatus.textContent = originalText;
        saveStatus.className = originalClass;
    }, 2000);
}

// Show error message
function showErrorMessage(message) {
    const errorElement = document.getElementById('errorMessage');
    errorElement.textContent = message;
    errorElement.style.display = 'block';

    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

// New file function
function newFile() {
    if (currentFile.isOpen && !currentFile.saved) {
        if (!confirm('You have unsaved changes. Are you sure you want to create a new file?')) {
            return;
        }
    }

    currentFile.name = 'Untitled';
    currentFile.handle = null;
    currentFile.content = defaultExample;
    currentFile.saved = false;
    currentFile.isOpen = true;

    const codeTextarea = document.getElementById('code');
    codeTextarea.value = defaultExample;
    updateLineNumbers();
    updateDiagram();
    updateFileStatus();
}

// Keyboard shortcuts for file operations
function handleFileShortcuts(event) {
    if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
            case 'o':
                event.preventDefault();
                openFile();
                break;
            case 's':
                event.preventDefault();
                if (event.shiftKey) {
                    saveAsFile();
                } else {
                    saveFile();
                }
                break;
            case 'n':
                event.preventDefault();
                newFile();
                break;
        }
    }
}

// Initialize file operations
function initializeFileOperations() {
    // Set up event listeners
    const newBtn = document.getElementById('new-file-btn');
    const openBtn = document.getElementById('open-file-btn');
    const saveBtn = document.getElementById('save-file-btn');
    const saveAsBtn = document.getElementById('save-as-btn');
    const fileInput = document.getElementById('file-input');

    if (newBtn) {
        newBtn.addEventListener('click', newFile);
    }

    if (openBtn) {
        openBtn.addEventListener('click', openFile);
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', saveFile);
    }

    if (saveAsBtn) {
        saveAsBtn.addEventListener('click', saveAsFile);
    }

    if (fileInput) {
        fileInput.addEventListener('change', handleFileInputChange);
    }

    // Add keyboard shortcuts
    document.addEventListener('keydown', handleFileShortcuts);

    // Initial file status update
    updateFileStatus();

    // Track content changes
    const codeTextarea = document.getElementById('code');
    if (codeTextarea) {
        codeTextarea.addEventListener('input', function () {
            if (currentFile.isOpen && currentFile.saved && this.value !== currentFile.content) {
                markFileAsModified();
            }
        });
    }
}

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

// Zoom and Pan functionality
function initializeZoomPan() {
    const viewport = document.getElementById('diagram-viewport');
    const canvas = document.getElementById('diagram-canvas');
    const diagram = document.getElementById('diagram');
    const zoomControls = document.getElementById('zoom-controls');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const resetZoomBtn = document.getElementById('reset-zoom');
    const zoomLevelSpan = document.getElementById('zoom-level');

    // Check if all required elements exist
    if (!viewport || !canvas || !diagram || !zoomControls || !zoomInBtn || !zoomOutBtn || !resetZoomBtn || !zoomLevelSpan) {
        console.error('Zoom Pan: Missing required elements', {
            viewport: !!viewport,
            canvas: !!canvas,
            diagram: !!diagram,
            zoomControls: !!zoomControls,
            zoomInBtn: !!zoomInBtn,
            zoomOutBtn: !!zoomOutBtn,
            resetZoomBtn: !!resetZoomBtn,
            zoomLevelSpan: !!zoomLevelSpan
        });
        return { resetZoom: () => { }, updateTransform: () => { } };
    }

    let isPanning = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    // Update transform
    function updateTransform() {
        canvas.style.transform = `translate(${zoomState.translateX}px, ${zoomState.translateY}px) scale(${zoomState.scale})`;
        zoomLevelSpan.textContent = Math.round(zoomState.scale * 100) + '%';
    }

    // Reset zoom and pan to fit image
    function resetZoom() {
        if (!diagram.naturalWidth || !diagram.naturalHeight) {
            // If image dimensions aren't available yet, try again after a short delay
            setTimeout(() => resetZoom(), 50);
            return;
        }

        const viewportRect = viewport.getBoundingClientRect();
        const viewportWidth = viewportRect.width;
        const viewportHeight = viewportRect.height;
        const imageWidth = diagram.naturalWidth;
        const imageHeight = diagram.naturalHeight;

        // Calculate scale to fit image in viewport with some padding
        const padding = 40; // 40px padding on each side for better spacing
        const availableWidth = viewportWidth - (padding * 2);
        const availableHeight = viewportHeight - (padding * 2);

        const scaleX = availableWidth / imageWidth;
        const scaleY = availableHeight / imageHeight;
        const fitScale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%

        // Calculate center position manually
        // The scaled image dimensions
        const scaledImageWidth = imageWidth * fitScale;
        const scaledImageHeight = imageHeight * fitScale;

        // Calculate the offset needed to center the image
        const centerX = (viewportWidth - scaledImageWidth) / 2;
        const centerY = (viewportHeight - scaledImageHeight) / 2;

        zoomState.scale = fitScale;
        zoomState.translateX = centerX;
        zoomState.translateY = centerY;
        zoomState.userHasInteracted = false; // Reset interaction flag

        updateTransform();
    }

    // Zoom at a specific point
    function zoomAt(clientX, clientY, delta) {
        const viewportRect = viewport.getBoundingClientRect();
        const offsetX = clientX - viewportRect.left;
        const offsetY = clientY - viewportRect.top;

        // Calculate the point relative to the current transform
        const pointX = (offsetX - zoomState.translateX) / zoomState.scale;
        const pointY = (offsetY - zoomState.translateY) / zoomState.scale;

        // Calculate new scale
        const newScale = Math.min(Math.max(zoomState.scale + delta, zoomState.minScale), zoomState.maxScale);
        const scaleDelta = newScale - zoomState.scale;

        // Adjust translation to keep the point under the mouse
        zoomState.translateX -= pointX * scaleDelta;
        zoomState.translateY -= pointY * scaleDelta;
        zoomState.scale = newScale;
        zoomState.userHasInteracted = true; // Mark that user has interacted

        updateTransform();
    }

    // Mouse wheel zoom
    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -zoomState.scaleStep : zoomState.scaleStep;
        zoomAt(e.clientX, e.clientY, delta);
    });

    // Mouse pan
    viewport.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Left mouse button
            isPanning = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            viewport.classList.add('panning');
            e.preventDefault();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isPanning) {
            const deltaX = e.clientX - lastMouseX;
            const deltaY = e.clientY - lastMouseY;

            zoomState.translateX += deltaX;
            zoomState.translateY += deltaY;

            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            zoomState.userHasInteracted = true; // Mark that user has interacted

            updateTransform();
        }
    });

    document.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            viewport.classList.remove('panning');
        }
    });

    // Touch support for mobile
    let touchStartDistance = 0;
    let touchStartScale = 1;
    let touches = [];

    viewport.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touches = Array.from(e.touches);

        if (touches.length === 1) {
            // Single touch - start panning
            isPanning = true;
            lastMouseX = touches[0].clientX;
            lastMouseY = touches[0].clientY;
            viewport.classList.add('panning');
        } else if (touches.length === 2) {
            // Two finger touch - start pinch zoom
            isPanning = false;
            viewport.classList.remove('panning');

            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            touchStartDistance = Math.sqrt(dx * dx + dy * dy);
            touchStartScale = zoomState.scale;
        }
    });

    viewport.addEventListener('touchmove', (e) => {
        e.preventDefault();
        touches = Array.from(e.touches);

        if (touches.length === 1 && isPanning) {
            // Single touch - pan
            const deltaX = touches[0].clientX - lastMouseX;
            const deltaY = touches[0].clientY - lastMouseY;

            zoomState.translateX += deltaX;
            zoomState.translateY += deltaY;

            lastMouseX = touches[0].clientX;
            lastMouseY = touches[0].clientY;

            updateTransform();
        } else if (touches.length === 2) {
            // Two finger touch - pinch zoom
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            const currentDistance = Math.sqrt(dx * dx + dy * dy);

            if (touchStartDistance > 0) {
                const scaleChange = currentDistance / touchStartDistance;
                const newScale = Math.min(Math.max(touchStartScale * scaleChange, zoomState.minScale), zoomState.maxScale);

                // Get center point between fingers
                const centerX = (touches[0].clientX + touches[1].clientX) / 2;
                const centerY = (touches[0].clientY + touches[1].clientY) / 2;

                // Apply zoom at center point
                const viewportRect = viewport.getBoundingClientRect();
                const offsetX = centerX - viewportRect.left;
                const offsetY = centerY - viewportRect.top;

                const pointX = (offsetX - zoomState.translateX) / zoomState.scale;
                const pointY = (offsetY - zoomState.translateY) / zoomState.scale;

                const scaleDelta = newScale - zoomState.scale;
                zoomState.translateX -= pointX * scaleDelta;
                zoomState.translateY -= pointY * scaleDelta;
                zoomState.scale = newScale;

                updateTransform();
            }
        }
    });

    viewport.addEventListener('touchend', (e) => {
        if (e.touches.length === 0) {
            isPanning = false;
            viewport.classList.remove('panning');
            touchStartDistance = 0;
        }
    });

    // Zoom controls
    zoomInBtn.addEventListener('click', () => {
        const viewportRect = viewport.getBoundingClientRect();
        const centerX = viewportRect.left + viewportRect.width / 2;
        const centerY = viewportRect.top + viewportRect.height / 2;
        zoomAt(centerX, centerY, zoomState.scaleStep);
    });

    zoomOutBtn.addEventListener('click', () => {
        const viewportRect = viewport.getBoundingClientRect();
        const centerX = viewportRect.left + viewportRect.width / 2;
        const centerY = viewportRect.top + viewportRect.height / 2;
        zoomAt(centerX, centerY, -zoomState.scaleStep);
    });

    resetZoomBtn.addEventListener('click', resetZoom);

    // Double click to reset zoom
    viewport.addEventListener('dblclick', resetZoom);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Only handle shortcuts when the viewport area is focused/active
        if (document.activeElement === document.body || viewport.contains(document.activeElement)) {
            if (e.ctrlKey || e.metaKey) { // Ctrl on Windows/Linux, Cmd on Mac
                switch (e.key) {
                    case '=':
                    case '+':
                        e.preventDefault();
                        const centerRect = viewport.getBoundingClientRect();
                        const centerX = centerRect.left + centerRect.width / 2;
                        const centerY = centerRect.top + centerRect.height / 2;
                        zoomAt(centerX, centerY, zoomState.scaleStep);
                        break;
                    case '-':
                        e.preventDefault();
                        const centerRect2 = viewport.getBoundingClientRect();
                        const centerX2 = centerRect2.left + centerRect2.width / 2;
                        const centerY2 = centerRect2.top + centerRect2.height / 2;
                        zoomAt(centerX2, centerY2, -zoomState.scaleStep);
                        break;
                    case '0':
                        e.preventDefault();
                        resetZoom();
                        break;
                }
            }
        }
    });

    return { resetZoom, updateTransform };
}

// Preserve zoom state when updating diagram
function preserveZoomState() {
    // Store current zoom state before updating
    return {
        scale: zoomState.scale,
        translateX: zoomState.translateX,
        translateY: zoomState.translateY
    };
}

function restoreZoomState(savedState) {
    if (savedState) {
        zoomState.scale = savedState.scale;
        zoomState.translateX = savedState.translateX;
        zoomState.translateY = savedState.translateY;

        // Apply the transform after a short delay to ensure image is loaded
        setTimeout(() => {
            const canvas = document.getElementById('diagram-canvas');
            const zoomLevelSpan = document.getElementById('zoom-level');
            if (canvas && zoomLevelSpan) {
                canvas.style.transform = `translate(${zoomState.translateX}px, ${zoomState.translateY}px) scale(${zoomState.scale})`;
                zoomLevelSpan.textContent = Math.round(zoomState.scale * 100) + '%';
            }
        }, 100);
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

    // Preserve zoom state if we're updating an image AND user has interacted with zoom/pan
    const shouldPreserveZoom = formatDisplayTypes[outputFormat] === 'image' && zoomState.userHasInteracted;
    const savedZoomState = shouldPreserveZoom ? preserveZoomState() : null;

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
        const zoomControls = document.getElementById('zoom-controls');
        const diagramViewport = document.getElementById('diagram-viewport');

        // Hide all display elements
        diagramViewport.style.display = 'none';
        textPreview.style.display = 'none';
        placeholderContainer.style.display = 'none';
        zoomControls.style.display = 'none';

        if (displayType === 'image') {
            diagramImg.classList.add('loading');

            // Create a new image to preload and get dimensions
            const tempImg = new Image();
            tempImg.onload = function () {
                diagramImg.src = url;
                diagramImg.classList.remove('loading');
                diagramImg.classList.add('loaded');
                diagramViewport.style.display = 'block';
                zoomControls.style.display = 'flex';

                // Wait for the image to be fully loaded and rendered in the DOM
                const checkImageReady = () => {
                    if (diagramImg.complete && diagramImg.naturalWidth > 0) {
                        // Restore zoom state or reset to fit
                        if (savedZoomState && zoomState.userHasInteracted) {
                            restoreZoomState(savedZoomState);
                        } else {
                            // Reset zoom for new diagrams or when user hasn't interacted
                            const zoomPanControls = window.diagramZoomPan;
                            if (zoomPanControls) {
                                zoomPanControls.resetZoom();
                            }
                        }
                    } else {
                        // If image isn't ready yet, try again in a short while
                        setTimeout(checkImageReady, 50);
                    }
                };

                // Start checking if image is ready
                setTimeout(checkImageReady, 10);
            };
            tempImg.onerror = function () {
                diagramImg.classList.remove('loading');
                // Provide a fallback test image when Kroki server is not available
                console.warn('Kroki server not available, using fallback test image');
                const fallbackSvg = `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100%" height="100%" fill="#f8f9fa" stroke="#dee2e6" stroke-width="2"/>
                    <text x="50%" y="40%" dominant-baseline="middle" text-anchor="middle" fill="#495057" font-family="Arial" font-size="24" font-weight="bold">
                        Kroki Server Test Image
                    </text>
                    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6c757d" font-family="Arial" font-size="16">
                        600x400 pixels - Test zoom and pan functionality
                    </text>
                    <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" fill="#6c757d" font-family="Arial" font-size="14">
                        Server offline - Using fallback image for testing
                    </text>
                    <circle cx="150" cy="200" r="40" fill="#e3f2fd" stroke="#2196f3" stroke-width="2"/>
                    <rect x="450" y="160" width="80" height="80" fill="#f3e5f5" stroke="#9c27b0" stroke-width="2"/>
                    <path d="M 190 200 L 450 200" stroke="#424242" stroke-width="2" marker-end="url(#arrow)"/>
                    <defs>
                        <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                            <path d="M 0,0 L 0,6 L 9,3 z" fill="#424242"/>
                        </marker>
                    </defs>
                </svg>`;
                const fallbackDataUrl = 'data:image/svg+xml;base64,' + btoa(fallbackSvg);
                diagramImg.src = fallbackDataUrl;
                diagramImg.classList.add('loaded');
                diagramViewport.style.display = 'block';
                zoomControls.style.display = 'flex';

                // Wait for fallback image to be ready
                const checkFallbackReady = () => {
                    if (diagramImg.complete && diagramImg.naturalWidth > 0) {
                        const zoomPanControls = window.diagramZoomPan;
                        if (zoomPanControls) {
                            zoomPanControls.resetZoom();
                        }
                    } else {
                        setTimeout(checkFallbackReady, 50);
                    }
                };
                setTimeout(checkFallbackReady, 10);
            };
            tempImg.src = url;
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

    handle.addEventListener('mousedown', function (e) {
        isResizing = true;
        startX = e.clientX;
        startWidth = editor.offsetWidth;
        handle.classList.add('dragging');

        // Prevent text selection during resize
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', function (e) {
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

    document.addEventListener('mouseup', function () {
        if (isResizing) {
            isResizing = false;
            handle.classList.remove('dragging');
            document.body.style.userSelect = '';
        }
    });
}

// Function to adjust controls layout based on available width
function adjustControlsLayout() {
    const controlsContainer = document.querySelector('.diagram-controls');
    const editor = document.querySelector('.editor');
    const STACK_THRESHOLD = 350; // Width in pixels below which to stack controls

    // Check if elements exist before accessing their properties
    if (!controlsContainer || !editor) {
        console.warn('adjustControlsLayout: Required elements not found', {
            controlsContainer: !!controlsContainer,
            editor: !!editor
        });
        return;
    }

    if (editor.offsetWidth < STACK_THRESHOLD) {
        controlsContainer.classList.add('stacked-controls');
    } else {
        controlsContainer.classList.remove('stacked-controls');
    }
}

// Fullscreen mode functionality
function initializeFullscreenMode() {
    const fullscreenToggle = document.getElementById('fullscreen-toggle');
    const body = document.body;
    const notification = document.getElementById('fullscreen-notification');
    let isFullscreen = false;
    let notificationTimeout = null;

    function showNotification() {
        if (notificationTimeout) {
            clearTimeout(notificationTimeout);
        }

        notification.classList.add('show');

        notificationTimeout = setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    function enterFullscreen() {
        isFullscreen = true;
        body.classList.add('fullscreen-mode');
        fullscreenToggle.innerHTML = '✕';
        fullscreenToggle.title = 'Exit Fullscreen (F or Escape)';

        // Update zoom controls to fit the new layout
        setTimeout(() => {
            const zoomPanControls = window.diagramZoomPan;
            if (zoomPanControls) {
                zoomPanControls.resetZoom();
            }
        }, 100);

        showNotification();

        // Prevent body scrolling in fullscreen
        document.documentElement.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
    }

    function exitFullscreen() {
        isFullscreen = false;
        body.classList.remove('fullscreen-mode');
        fullscreenToggle.innerHTML = '⛶';
        fullscreenToggle.title = 'Toggle Fullscreen View (F or Escape)';

        // Update zoom controls to fit the new layout
        setTimeout(() => {
            const zoomPanControls = window.diagramZoomPan;
            if (zoomPanControls) {
                zoomPanControls.resetZoom();
            }
        }, 100);

        // Restore body scrolling
        document.documentElement.style.overflow = '';
        body.style.overflow = '';
    }

    function toggleFullscreen() {
        if (isFullscreen) {
            exitFullscreen();
        } else {
            enterFullscreen();
        }
    }

    // Toggle button click handler
    fullscreenToggle.addEventListener('click', toggleFullscreen);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Only handle fullscreen shortcuts when not typing in text areas
        if (e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
            if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                if (!isFullscreen) {
                    enterFullscreen();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                if (isFullscreen) {
                    exitFullscreen();
                }
            }
        }
    });

    // Handle browser fullscreen API events
    document.addEventListener('fullscreenchange', () => {
        // If user exits browser fullscreen but we're still in our fullscreen mode
        if (!document.fullscreenElement && isFullscreen) {
            // Keep our fullscreen mode active
            // This allows our custom fullscreen to work independently of browser fullscreen
        }
    });

    // Return public API
    return {
        toggle: toggleFullscreen,
        enter: enterFullscreen,
        exit: exitFullscreen,
        isActive: () => isFullscreen
    };
}

// Theme system
const ThemeManager = {
    themes: ['light', 'dark', 'auto'],
    currentTheme: 'light', // Default to light mode

    init() {
        // Load saved theme or default to light
        this.currentTheme = localStorage.getItem('kroki-theme') || 'light';
        this.applyTheme(this.currentTheme);
        this.setupToggleButton();
    },

    applyTheme(theme) {
        const body = document.body;

        // Remove existing theme classes
        body.classList.remove('light-theme', 'dark-theme');

        // Apply new theme
        if (theme === 'light') {
            body.classList.add('light-theme');
        } else if (theme === 'dark') {
            body.classList.add('dark-theme');
        }
        // 'auto' theme uses neither class, relying on CSS media queries

        this.currentTheme = theme;
        this.updateToggleButton();

        // Save theme preference
        localStorage.setItem('kroki-theme', theme);
    },

    getNextTheme() {
        const currentIndex = this.themes.indexOf(this.currentTheme);
        return this.themes[(currentIndex + 1) % this.themes.length];
    },

    toggleTheme() {
        const nextTheme = this.getNextTheme();
        this.applyTheme(nextTheme);
    },

    updateToggleButton() {
        const button = document.getElementById('theme-toggle');
        if (button) {
            const themeNames = {
                light: 'Light Mode',
                dark: 'Dark Mode',
                auto: 'Auto (System)'
            };

            const nextTheme = this.getNextTheme();
            button.title = `Current: ${themeNames[this.currentTheme]} - Click for ${themeNames[nextTheme]}`;
        }
    },

    setupToggleButton() {
        const toggleButton = document.getElementById('theme-toggle');
        if (toggleButton) {
            toggleButton.addEventListener('click', () => {
                this.toggleTheme();
            });

            // Update initial tooltip
            this.updateToggleButton();
        }
    }
};

// Event Listeners
document.addEventListener('DOMContentLoaded', function () {
    initializeDiagramTypeDropdown();
    updateFormatDropdown();
    processUrlParameters();
    updateLineNumbers();
    updateDiagram();
    initializeResizeHandle(); // Initialize the resize handle
    adjustControlsLayout(); // Initial layout adjustment

    // Initialize zoom and pan functionality
    window.diagramZoomPan = initializeZoomPan();

    // Initialize fullscreen mode functionality
    window.fullscreenMode = initializeFullscreenMode();

    // Initialize file operations
    initializeFileOperations();

    // Initialize theme system
    ThemeManager.init();
});

// Add window resize listener
window.addEventListener('resize', function () {
    adjustControlsLayout();
});

// Warn about unsaved changes before page unload
window.addEventListener('beforeunload', function (e) {
    if (currentFile.isOpen && !currentFile.saved) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return 'You have unsaved changes. Are you sure you want to leave?';
    }
});

const codeTextarea = document.getElementById('code');

codeTextarea.addEventListener('input', function () {
    const code = this.value.trim();

    if (code !== '') {
        userHasEditedContent = true;
    }

    // Check if file content has changed for file operations
    if (currentFile.isOpen && currentFile.saved && this.value !== currentFile.content) {
        markFileAsModified();
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

document.getElementById('outputFormat').addEventListener('change', function () {
    updateDiagram();
});

document.getElementById('downloadButton').addEventListener('click', downloadDiagram);

const copyLinkBtn = document.getElementById('copy-link-btn');
if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', function () {
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
    encodedTextInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            handleDecode();
        }
    });
}

// Help modal controls
const helpBtn = document.getElementById('zoom-help');
const helpModal = document.getElementById('help-modal');
const closeHelpBtn = document.getElementById('close-help');

if (helpBtn && helpModal && closeHelpBtn) {
    helpBtn.addEventListener('click', function () {
        helpModal.style.display = 'flex';
    });

    closeHelpBtn.addEventListener('click', function () {
        helpModal.style.display = 'none';
    });

    // Close modal when clicking outside
    helpModal.addEventListener('click', function (e) {
        if (e.target === helpModal) {
            helpModal.style.display = 'none';
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && helpModal.style.display === 'flex') {
            helpModal.style.display = 'none';
        }
    });
}

