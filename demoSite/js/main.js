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
let autoRefreshEnabled = true; // Auto-refresh state

// Configuration-driven constants (will be updated from config)
let DEBOUNCE_DELAY = 1000; // 1 second delay
let AUTO_SAVE_DELAY = 2000; // 2 seconds delay

// Zoom and pan state (will be updated from config)
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
    content: '',
    saved: false,
    handle: null, // For File System Access API
    isOpen: false, // Track if we actually have a file open
    autoSaveEnabled: false // Track auto-save state
};

// Auto-save timer
let autoSaveTimer = null;

// File operations functionality
function updateFileStatus() {
    const fileNameElement = document.getElementById('file-name');
    const saveStatusElement = document.getElementById('save-status');
    const saveBtn = document.getElementById('save-file-btn');
    const autoSaveLabel = document.getElementById('auto-save-label');
    const fileStatusContainer = document.querySelector('.file-status');

    // Handle no file open state - hide the entire file status area
    if (!currentFile.isOpen) {
        if (fileStatusContainer) {
            fileStatusContainer.style.display = 'none';
        }
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.title = 'No file to save';
        }
        if (autoSaveLabel) {
            autoSaveLabel.style.display = 'none';
            autoSaveLabel.classList.remove('active');
        }
        return;
    }

    // Show the file status area when a file is open
    if (fileStatusContainer) {
        fileStatusContainer.style.display = 'block';
    }

    // Show auto-save pill when file is open
    if (autoSaveLabel) {
        autoSaveLabel.style.display = 'inline-flex';
        autoSaveLabel.classList.toggle('active', !!currentFile.autoSaveEnabled);
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

// Show image error banner (non-dismissable banner at bottom of image pane)
function showImageErrorBanner(message) {
    const banner = document.getElementById('image-error-banner');
    const messageElement = document.getElementById('error-banner-message');

    if (banner && messageElement) {
        messageElement.textContent = message;
        banner.style.display = 'block';
    }
}

// Hide image error banner
function hideImageErrorBanner() {
    const banner = document.getElementById('image-error-banner');

    if (banner) {
        banner.style.display = 'none';
    }
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
            case 'f':
                event.preventDefault();
                showSearchBar();
                break;
            case ',':
                event.preventDefault();
                console.log('Settings keyboard shortcut triggered');
                if (window.configUI) {
                    console.log('ConfigUI available, showing settings');
                    window.configUI.open();
                } else {
                    console.warn('Configuration UI not available yet');
                    alert('Settings system is loading... Please try again in a moment.');
                }
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
    const autoSaveLabel = document.getElementById('auto-save-label');
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

    if (autoSaveLabel) {
        autoSaveLabel.addEventListener('click', toggleAutoSave);
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

// Toggle auto-save functionality
function toggleAutoSave() {
    currentFile.autoSaveEnabled = !currentFile.autoSaveEnabled;
    const autoSaveLabel = document.getElementById('auto-save-label');

    if (autoSaveLabel) {
        autoSaveLabel.classList.toggle('active', currentFile.autoSaveEnabled);
    }

    if (currentFile.autoSaveEnabled) {
        startAutoSave();
    } else {
        stopAutoSave();
    }
}

// Start auto-save timer
function startAutoSave() {
    stopAutoSave(); // Clear any existing timer
    autoSaveTimer = setInterval(() => {
        if (currentFile.isOpen && !currentFile.saved) {
            saveFile();
        }
    }, AUTO_SAVE_DELAY);
}

// Stop auto-save timer
function stopAutoSave() {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
        autoSaveTimer = null;
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
        if (autoRefreshEnabled) {
            updateDiagram();
        }
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
    // Only auto-refresh if enabled
    if (!autoRefreshEnabled) {
        return;
    }

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
    const utf8 = unescape(encodeURIComponent(str));
    const result = new Uint8Array(utf8.length);
    for (let i = 0; i < utf8.length; i++) {
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

// Initialize zoom and pan functionality
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
        const padding = window.configManager ? window.configManager.get('zoom.resetPadding') : 40;
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

        // Hide text preview and placeholder, but keep viewport visible for anti-flicker
        textPreview.style.display = 'none';
        placeholderContainer.style.display = 'none';

        if (displayType === 'image') {
            // Keep viewport and zoom controls visible for anti-flicker
            diagramViewport.style.display = 'block';
            zoomControls.style.display = 'flex';

            diagramImg.classList.add('loading');

            // Hide any existing error banner
            hideImageErrorBanner();

            try {
                // First, fetch the URL to check for HTTP errors
                const response = await fetch(url);

                if (!response.ok) {
                    // Handle non-200 responses
                    let errorMessage = `HTTP ${response.status}`;

                    try {
                        // Try to get error message from response body
                        const errorText = await response.text();
                        if (errorText && errorText.trim()) {
                            errorMessage += `: ${errorText}`;
                        } else {
                            errorMessage += `: ${response.statusText || 'Unknown error'}`;
                        }
                    } catch {
                        errorMessage += `: ${response.statusText || 'Unknown error'}`;
                    }

                    // Show error banner with server message
                    showImageErrorBanner(errorMessage);

                    // Remove loading state since we're keeping the previous image
                    diagramImg.classList.remove('loading');

                    // If there's a previous image, keep it; otherwise show placeholder
                    if (!diagramImg.src || diagramImg.src === '') {
                        // Show a minimal placeholder image for zoom/pan testing
                        const placeholderSvg = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
                            <rect width="100%" height="100%" fill="#f8f9fa" stroke="#dee2e6" stroke-width="1"/>
                            <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="Arial" font-size="14">
                                Previous diagram (error occurred)
                            </text>
                        </svg>`;
                        const placeholderDataUrl = 'data:image/svg+xml;base64,' + btoa(placeholderSvg);
                        diagramImg.style.display = 'block';
                        diagramImg.src = placeholderDataUrl;
                    }

                    currentDiagramData = url;
                    return; // Exit early, don't proceed with normal image loading
                }

                // Response is OK, proceed with normal image loading
                const blob = await response.blob();
                const imageUrl = URL.createObjectURL(blob);

                // Create a new image to preload and get dimensions
                const tempImg = new Image();
                tempImg.onload = function () {
                    // Define error handler first
                    const actualImageErrorHandler = function () {
                        diagramImg.classList.remove('loading');
                        showImageErrorBanner('Failed to load diagram image');
                        // Remove the event listeners to prevent them firing again
                        diagramImg.removeEventListener('load', actualImageLoadHandler);
                        diagramImg.removeEventListener('error', actualImageErrorHandler);
                    };

                    // Set up the actual diagram image load handler
                    const actualImageLoadHandler = function () {
                        diagramImg.classList.remove('loading');

                        // Wait for the image to be fully loaded and rendered in the DOM
                        const checkImageReady = () => {
                            if (diagramImg.complete && diagramImg.naturalWidth > 0) {
                                // Emit successful diagram render event for code history
                                document.dispatchEvent(new CustomEvent('diagramRendered', {
                                    detail: {
                                        success: true,
                                        code: code,
                                        diagramType: diagramType,
                                        outputFormat: outputFormat
                                    }
                                }));

                                // Restore zoom state or reset to fit
                                if (savedZoomState && zoomState.userHasInteracted) {
                                    // Apply saved zoom state
                                    zoomState.scale = savedZoomState.scale;
                                    zoomState.translateX = savedZoomState.translateX;
                                    zoomState.translateY = savedZoomState.translateY;
                                    const zoomPanControls = window.diagramZoomPan;
                                    if (zoomPanControls) {
                                        zoomPanControls.updateTransform();
                                    }
                                } else {
                                    // Reset zoom for new diagrams or when user hasn't interacted
                                    const zoomPanControls = window.diagramZoomPan;
                                    if (zoomPanControls) {
                                        zoomPanControls.resetZoom();
                                    }
                                }
                                // Remove the event listeners to prevent them firing again
                                diagramImg.removeEventListener('load', actualImageLoadHandler);
                                diagramImg.removeEventListener('error', actualImageErrorHandler);
                            } else {
                                // If image isn't ready yet, try again in a short while
                                setTimeout(checkImageReady, 50);
                            }
                        };

                        // Start checking if image is ready
                        setTimeout(checkImageReady, 10);
                    };

                    // Add event listeners to the actual diagram image
                    diagramImg.addEventListener('load', actualImageLoadHandler);
                    diagramImg.addEventListener('error', actualImageErrorHandler);

                    // Now set the source and make the image visible, which will trigger the load event when ready
                    diagramImg.style.display = 'block';
                    diagramImg.src = imageUrl;
                };

                tempImg.onerror = function () {
                    diagramImg.classList.remove('loading');
                    // This shouldn't happen since we already verified the response, but handle it gracefully
                    showImageErrorBanner('Failed to load image data');
                };

                tempImg.src = imageUrl;
                currentDiagramData = url;

            } catch (networkError) {
                // Handle network errors (no connection, timeout, etc.)
                diagramImg.classList.remove('loading');
                showImageErrorBanner(`Network error: ${networkError.message}`);

                // Keep previous image if available
                currentDiagramData = url;
            }
        } else if (displayType === 'text') {
            // Hide image viewport for text display
            diagramViewport.style.display = 'none';
            zoomControls.style.display = 'none';

            const response = await fetch(url);
            const text = await response.text();
            textPreview.textContent = text;
            textPreview.style.display = 'block';
            currentDiagramData = text;
        } else {
            // Hide image viewport for placeholder display
            diagramViewport.style.display = 'none';
            zoomControls.style.display = 'none';

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

// Initialize line numbers and scroll synchronization
function initializeLineNumbers() {
    const codeTextarea = document.getElementById('code');
    const lineNumbersDiv = document.getElementById('lineNumbers');

    if (!codeTextarea || !lineNumbersDiv) {
        console.warn('Line numbers: Missing required elements');
        return;
    }

    // Initial line numbers update
    updateLineNumbers();

    // Ensure scroll synchronization is working
    let isTextareaScrolling = false;
    let isLineNumbersScrolling = false;

    codeTextarea.addEventListener('scroll', function () {
        if (!isLineNumbersScrolling) {
            isTextareaScrolling = true;
            lineNumbersDiv.scrollTop = this.scrollTop;
            requestAnimationFrame(() => {
                isTextareaScrolling = false;
            });
        }
    });

    // Optional: sync textarea scroll when line numbers are scrolled
    // (though this is typically not needed for most use cases)
    lineNumbersDiv.addEventListener('scroll', function () {
        if (!isTextareaScrolling) {
            isLineNumbersScrolling = true;
            codeTextarea.scrollTop = this.scrollTop;
            requestAnimationFrame(() => {
                isLineNumbersScrolling = false;
            });
        }
    });

    // Also sync when the textarea is resized (e.g., by window resize)
    const resizeObserver = new ResizeObserver(() => {
        // Small delay to ensure the textarea has finished resizing
        setTimeout(() => {
            if (!isLineNumbersScrolling && !isTextareaScrolling) {
                lineNumbersDiv.scrollTop = codeTextarea.scrollTop;
            }
        }, 10);
    });

    resizeObserver.observe(codeTextarea);
}

// Update line numbers in the editor
function updateLineNumbers() {
    const codeTextarea = document.getElementById('code');
    const lineNumbersDiv = document.getElementById('lineNumbers');

    if (!codeTextarea || !lineNumbersDiv) {
        return;
    }

    const codeLines = codeTextarea.value.split('\n');
    const lineCount = Math.max(codeLines.length, 1); // Ensure at least 1 line

    let lineNumbersHtml = '';
    for (let i = 1; i <= lineCount; i++) {
        lineNumbersHtml += i + '<br>';
    }

    lineNumbersDiv.innerHTML = lineNumbersHtml;

    // Sync scroll position after updating line numbers
    // Use requestAnimationFrame to ensure DOM updates are complete
    requestAnimationFrame(() => {
        lineNumbersDiv.scrollTop = codeTextarea.scrollTop;
    });
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

// Handle auto-refresh checkbox toggle
function handleAutoRefreshToggle() {
    const checkbox = document.getElementById('auto-refresh-checkbox');
    const refreshBtn = document.getElementById('manual-refresh-btn');

    if (!checkbox || !refreshBtn) return;

    autoRefreshEnabled = checkbox.checked;
    localStorage.setItem('kroki-auto-refresh', autoRefreshEnabled.toString());

    // Show/hide manual refresh button based on auto-refresh state
    refreshBtn.style.display = autoRefreshEnabled ? 'none' : 'inline-flex';
}

// Handle manual refresh button click
function handleManualRefresh() {
    const refreshBtn = document.getElementById('manual-refresh-btn');
    if (refreshBtn) {
        // Add spinning animation
        refreshBtn.classList.add('spinning');

        // Remove animation after a short delay
        setTimeout(() => {
            refreshBtn.classList.remove('spinning');
        }, 1000);
    }

    // Trigger diagram update
    updateDiagram();
}

// Initialize auto-refresh functionality
function initializeAutoRefresh() {
    const checkbox = document.getElementById('auto-refresh-checkbox');
    const refreshBtn = document.getElementById('manual-refresh-btn');

    if (!checkbox || !refreshBtn) {
        console.warn('Auto-refresh elements not found');
        return;
    }

    // Load saved preference or default to true
    const savedPreference = localStorage.getItem('kroki-auto-refresh');
    autoRefreshEnabled = savedPreference !== null ? savedPreference === 'true' : true;
    checkbox.checked = autoRefreshEnabled;

    // Set initial button state
    handleAutoRefreshToggle();

    // Add event listeners
    checkbox.addEventListener('change', handleAutoRefreshToggle);
    refreshBtn.addEventListener('click', handleManualRefresh);

    // Add keyboard shortcut for manual refresh (Alt/Cmd + Enter)
    document.addEventListener('keydown', function (e) {
        if ((e.altKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleManualRefresh();
        }
    });
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
        fullscreenToggle.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="4 14 10 14 10 20"></polyline>
                <polyline points="20 10 14 10 14 4"></polyline>
                <line x1="14" y1="10" x2="21" y2="3"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
        `;
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
        fullscreenToggle.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15,3 21,3 21,9"></polyline>
                <polyline points="9,21 3,21 3,15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
        `;
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

// Configuration integration
function initializeConfigurationSystem() {
    if (!window.configManager) {
        console.warn('Configuration manager not available');
        return;
    }

    // Apply initial configuration values
    applyConfiguration();

    // Set up configuration change listeners
    setupConfigurationListeners();
}

function applyConfiguration() {
    const config = window.configManager;

    // Apply configuration-driven values
    DEBOUNCE_DELAY = config.get('editor.debounceDelay');
    AUTO_SAVE_DELAY = config.get('editor.autoSaveDelay');

    // Update zoom state with configuration values
    zoomState.minScale = config.get('zoom.minScale');
    zoomState.maxScale = config.get('zoom.maxScale');
    zoomState.scaleStep = config.get('zoom.scaleStep');

    // Apply theme configuration
    const themeConfig = config.get('theme');
    if (themeConfig !== ThemeManager.currentTheme) {
        ThemeManager.applyTheme(themeConfig);
    }

    // Apply auto-refresh configuration
    const autoRefreshConfig = config.get('autoRefresh');
    if (autoRefreshConfig !== autoRefreshEnabled) {
        autoRefreshEnabled = autoRefreshConfig;
        const checkbox = document.getElementById('auto-refresh-checkbox');
        if (checkbox) {
            checkbox.checked = autoRefreshEnabled;
            handleAutoRefreshToggle();
        }
    }

    // Apply editor configuration
    const codeTextarea = document.getElementById('code');
    if (codeTextarea) {
        const fontSize = config.get('editor.fontSize');
        codeTextarea.style.fontSize = `${fontSize}px`;
    }

    // Apply layout configuration
    const editorWidth = config.get('layout.editorWidth');
    const editor = document.querySelector('.editor');
    if (editor) {
        editor.style.width = `${editorWidth}%`;
    }

    // Apply UI element visibility
    applyUIVisibilityConfig();
}

function applyUIVisibilityConfig() {
    const config = window.configManager;

    // Show/hide toolbar
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) {
        toolbar.style.display = config.get('layout.showToolbar') ? 'flex' : 'none';
    }

    // Show/hide zoom controls
    const zoomControls = document.getElementById('zoom-controls');
    if (zoomControls) {
        zoomControls.style.display = config.get('layout.showZoomControls') ? 'flex' : 'none';
    }

    // Show/hide file status
    const fileStatus = document.querySelector('.file-status');
    if (fileStatus) {
        fileStatus.style.display = config.get('layout.showFileStatus') ? 'block' : 'none';
    }
}

function setupConfigurationListeners() {
    const config = window.configManager;

    // Listen for theme changes
    config.addListener('theme', (newTheme) => {
        ThemeManager.applyTheme(newTheme);
    });

    // Listen for auto-refresh changes
    config.addListener('autoRefresh', (newValue) => {
        autoRefreshEnabled = newValue;
        const checkbox = document.getElementById('auto-refresh-checkbox');
        if (checkbox) {
            checkbox.checked = newValue;
            handleAutoRefreshToggle();
        }
    });

    // Listen for debounce delay changes
    config.addListener('editor.debounceDelay', (newValue) => {
        DEBOUNCE_DELAY = newValue;
    });

    // Listen for auto-save delay changes
    config.addListener('editor.autoSaveDelay', (newValue) => {
        AUTO_SAVE_DELAY = newValue;
        // Restart auto-save timer if it's running
        if (currentFile.autoSaveEnabled) {
            startAutoSave();
        }
    });

    // Listen for zoom configuration changes
    config.addListener('zoom.minScale', (newValue) => {
        zoomState.minScale = newValue;
        // If current zoom is now outside the new limits, reset
        if (zoomState.scale < newValue || zoomState.scale > zoomState.maxScale) {
            const zoomPanControls = window.diagramZoomPan;
            if (zoomPanControls) {
                zoomPanControls.resetZoom();
            }
        }
    });

    config.addListener('zoom.maxScale', (newValue) => {
        zoomState.maxScale = newValue;
        // If current zoom is now outside the new limits, reset
        if (zoomState.scale < zoomState.minScale || zoomState.scale > newValue) {
            const zoomPanControls = window.diagramZoomPan;
            if (zoomPanControls) {
                zoomPanControls.resetZoom();
            }
        }
    });

    config.addListener('zoom.scaleStep', (newValue) => {
        zoomState.scaleStep = newValue;
    });

    // Listen for zoom reset padding changes
    config.addListener('zoom.resetPadding', (newValue) => {
        // This will be used next time resetZoom is called
        // No immediate action needed since padding is read dynamically
    });

    // Listen for zoom preserve state changes
    config.addListener('zoom.preserveStateOnUpdate', (newValue) => {
        // This affects diagram update behavior
        // No immediate action needed since it's read when updating
    });

    // Listen for editor font size changes
    config.addListener('editor.fontSize', (newValue) => {
        const codeTextarea = document.getElementById('code');
        if (codeTextarea) {
            codeTextarea.style.fontSize = `${newValue}px`;
        }
    });

    // Listen for layout changes
    config.addListener('layout.editorWidth', (newValue) => {
        const editor = document.querySelector('.editor');
        if (editor) {
            editor.style.width = `${newValue}%`;
            // Trigger resize event to update line numbers
            updateLineNumbers();
            adjustControlsLayout();
        }
    });

    // Listen for UI visibility changes
    config.addListener('layout.showToolbar', () => applyUIVisibilityConfig());
    config.addListener('layout.showZoomControls', () => applyUIVisibilityConfig());
    config.addListener('layout.showFileStatus', () => applyUIVisibilityConfig());

    // Listen for AI Assistant configuration changes
    const aiConfigPaths = [
        'ai.enabled', 'ai.endpoint', 'ai.apiKey', 'ai.model',
        'ai.maxRetryAttempts', 'ai.promptTheme', 'ai.autoValidate',
        'ai.persistHistory', 'ai.useProxy', 'ai.timeout'
    ];

    aiConfigPaths.forEach(path => {
        config.addListener(path, () => {
            if (window.aiAssistant) {
                window.aiAssistant.applyConfiguration();
            }
        });
    });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function () {
    initializeDiagramTypeDropdown();
    updateFormatDropdown();
    processUrlParameters();
    initializeLineNumbers(); // Initialize line numbers before other operations
    updateDiagram();
    initializeResizeHandle(); // Initialize the resize handle
    adjustControlsLayout(); // Initial layout adjustment

    // Initialize zoom and pan functionality
    window.diagramZoomPan = initializeZoomPan();

    // Initialize fullscreen mode functionality
    window.fullscreenMode = initializeFullscreenMode();

    // Initialize file operations
    initializeFileOperations();

    // Initialize search functionality
    initializeSearchFunctionality();

    // Initialize theme system
    ThemeManager.init();

    // Initialize auto-refresh functionality
    initializeAutoRefresh();

    // Initialize settings button
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        console.log('Settings button found, adding event listener');
        settingsBtn.addEventListener('click', () => {
            console.log('Settings button clicked');
            if (window.configUI) {
                console.log('ConfigUI available, showing settings');
                window.configUI.open();
            } else {
                console.warn('Configuration UI not available yet');
                alert('Settings system is loading... Please try again in a moment.');
            }
        });
    } else {
        console.error('Settings button not found in DOM');
    }

    // Initialize configuration system
    setTimeout(() => {
        console.log('Initializing configuration system...');
        console.log('configManager available:', !!window.configManager);

        // Initialize ConfigUI manually
        if (window.configManager && typeof ConfigUI !== 'undefined') {
            try {
                console.log('Creating ConfigUI instance...');
                window.configUI = new ConfigUI(window.configManager);
                console.log('ConfigUI created successfully');
            } catch (error) {
                console.error('Error creating ConfigUI:', error);
            }
        } else {
            console.warn('ConfigManager or ConfigUI class not available');
        }

        // Initialize AI Assistant
        if (typeof AIAssistant !== 'undefined') {
            try {
                console.log('Creating AI Assistant instance...');
                window.aiAssistant = new AIAssistant(window.configManager);
                console.log('AI Assistant created successfully');
            } catch (error) {
                console.error('Error creating AI Assistant:', error);
            }
        } else {
            console.warn('AIAssistant class not available');
        }

        // Initialize Code History
        if (typeof CodeHistory !== 'undefined') {
            try {
                console.log('Creating Code History instance...');
                window.codeHistory = new CodeHistory();
                // Initialize with current code if available
                setTimeout(() => {
                    window.codeHistory.initializeWithCurrentCode();
                }, 100);
                console.log('Code History created successfully');
            } catch (error) {
                console.error('Error creating Code History:', error);
            }
        } else {
            console.warn('CodeHistory class not available');
        }

        initializeConfigurationSystem();
        console.log('Configuration system initialized, configManager:', !!window.configManager, 'configUI:', !!window.configUI, 'aiAssistant:', !!window.aiAssistant);
    }, 150); // Slightly longer delay to ensure all scripts are loaded
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

// Add tab key handling for proper indentation
codeTextarea.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
        e.preventDefault();

        const start = this.selectionStart;
        const end = this.selectionEnd;
        const value = this.value;

        if (e.shiftKey) {
            // Shift + Tab: Remove indentation
            const lineStart = value.lastIndexOf('\n', start - 1) + 1;
            const lineEnd = value.indexOf('\n', end);
            const actualLineEnd = lineEnd === -1 ? value.length : lineEnd;

            if (start !== end) {
                // Multiple lines selected
                const selectedLines = value.substring(lineStart, actualLineEnd);
                const lines = selectedLines.split('\n');

                const dedentedLines = lines.map(line => {
                    if (line.startsWith('    ')) {
                        return line.substring(4); // Remove 4 spaces
                    } else if (line.startsWith('\t')) {
                        return line.substring(1); // Remove 1 tab
                    }
                    return line;
                });

                const newValue = value.substring(0, lineStart) + dedentedLines.join('\n') + value.substring(actualLineEnd);
                const removedChars = selectedLines.length - dedentedLines.join('\n').length;

                this.value = newValue;
                this.selectionStart = Math.max(lineStart, start - Math.min(4, removedChars));
                this.selectionEnd = Math.max(this.selectionStart, end - removedChars);
            } else {
                // Single line
                const currentLine = value.substring(lineStart, actualLineEnd);
                if (currentLine.startsWith('    ')) {
                    const newValue = value.substring(0, lineStart) + currentLine.substring(4) + value.substring(actualLineEnd);
                    this.value = newValue;
                    this.selectionStart = this.selectionEnd = Math.max(lineStart, start - 4);
                } else if (currentLine.startsWith('\t')) {
                    const newValue = value.substring(0, lineStart) + currentLine.substring(1) + value.substring(actualLineEnd);
                    this.value = newValue;
                    this.selectionStart = this.selectionEnd = Math.max(lineStart, start - 1);
                }
            }
        } else {
            // Tab: Add indentation
            if (start !== end) {
                // Multiple lines selected - indent each line
                const lineStart = value.lastIndexOf('\n', start - 1) + 1;
                const lineEnd = value.indexOf('\n', end);
                const actualLineEnd = lineEnd === -1 ? value.length : lineEnd;

                const selectedLines = value.substring(lineStart, actualLineEnd);
                const lines = selectedLines.split('\n');
                const indentedLines = lines.map(line => '    ' + line); // Add 4 spaces to each line

                const newValue = value.substring(0, lineStart) + indentedLines.join('\n') + value.substring(actualLineEnd);

                this.value = newValue;
                this.selectionStart = start + 4; // Move cursor past the added indentation
                this.selectionEnd = end + (lines.length * 4); // Adjust end selection
            } else {
                // Single cursor position - insert tab (4 spaces)
                const newValue = value.substring(0, start) + '    ' + value.substring(end);
                this.value = newValue;
                this.selectionStart = this.selectionEnd = start + 4;
            }
        }

        // Trigger input event to update line numbers and diagram
        const inputEvent = new Event('input', { bubbles: true });
        this.dispatchEvent(inputEvent);
    }
});

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
        if (autoRefreshEnabled) {
            updateDiagram();
        }
    } else {
        debounceUpdateDiagram();
    }
});

document.getElementById('outputFormat').addEventListener('change', function () {
    if (autoRefreshEnabled) {
        updateDiagram();
    }
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

// Search functionality for code editor
let searchState = {
    isVisible: false,
    currentQuery: '',
    matches: [],
    currentIndex: -1,
    caseSensitive: false,
    lastSearchValue: ''
};

// Show search bar
function showSearchBar() {
    const searchBar = document.getElementById('search-bar');
    const searchInput = document.getElementById('search-input');

    if (!searchBar || !searchInput) {
        console.warn('Search bar elements not found');
        return;
    }

    searchState.isVisible = true;
    searchBar.style.display = 'flex';
    searchInput.focus();
    searchInput.select();

    // If there's already text in the input, search immediately
    if (searchInput.value.trim()) {
        performSearch(searchInput.value);
    }
}

// Hide search bar
function hideSearchBar() {
    const searchBar = document.getElementById('search-bar');
    if (!searchBar) return;

    searchState.isVisible = false;
    searchBar.style.display = 'none';
    clearSearchHighlights();

    // Return focus to code textarea
    const codeTextarea = document.getElementById('code');
    if (codeTextarea) {
        codeTextarea.focus();
    }
}

// Perform search in code textarea
function performSearch(query) {
    const codeTextarea = document.getElementById('code');
    if (!codeTextarea || !query) {
        clearSearchHighlights();
        updateSearchCount(0, 0);
        return;
    }

    searchState.currentQuery = query;
    const text = codeTextarea.value;
    const flags = searchState.caseSensitive ? 'g' : 'gi';

    try {
        // Escape special regex characters in the query
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedQuery, flags);
        const matches = [];
        let match;

        while ((match = regex.exec(text)) !== null) {
            matches.push({
                index: match.index,
                length: match[0].length,
                text: match[0]
            });
        }

        searchState.matches = matches;

        if (matches.length > 0) {
            // If we don't have a current index or query changed, start from the beginning
            if (searchState.currentIndex === -1 || searchState.lastSearchValue !== query) {
                searchState.currentIndex = 0;
            }

            // Ensure current index is within bounds
            if (searchState.currentIndex >= matches.length) {
                searchState.currentIndex = 0;
            }

            highlightSearchResults();
            scrollToCurrentMatch();
        } else {
            searchState.currentIndex = -1;
            clearSearchHighlights();
        }

        searchState.lastSearchValue = query;
        updateSearchCount(searchState.currentIndex + 1, matches.length);
        updateSearchButtons();

    } catch (error) {
        // Invalid regex, clear results
        clearSearchHighlights();
        updateSearchCount(0, 0);
        console.warn('Invalid search pattern:', error);
    }
}

// Clear search highlights
function clearSearchHighlights() {
    // Clear any selection in the textarea
    const codeTextarea = document.getElementById('code');
    if (codeTextarea) {
        codeTextarea.setSelectionRange(0, 0);
    }

    // Clear the overlay
    const overlay = document.getElementById('search-highlight-overlay');
    if (overlay) {
        overlay.innerHTML = '';
    }
}

// Highlight search results with overlay
function highlightSearchResults() {
    const codeTextarea = document.getElementById('code');
    const overlay = document.getElementById('search-highlight-overlay');

    if (!codeTextarea || !overlay) {
        console.warn('Search highlighting: Missing textarea or overlay element');
        return;
    }

    if (searchState.matches.length === 0) {
        clearSearchHighlights();
        return;
    }

    try {
        const text = codeTextarea.value;
        let highlightedHTML = '';
        let lastIndex = 0;

        // Process each match and create highlighted spans
        searchState.matches.forEach((match, index) => {
            // Add text before this match (escaped)
            const beforeMatch = text.substring(lastIndex, match.index);
            highlightedHTML += escapeHtml(beforeMatch);

            // Add the highlighted match
            const isCurrent = index === searchState.currentIndex;
            const matchText = text.substring(match.index, match.index + match.length);
            const highlightClass = isCurrent ? 'search-highlight current' : 'search-highlight';
            highlightedHTML += `<span class="${highlightClass}">${escapeHtml(matchText)}</span>`;

            lastIndex = match.index + match.length;
        });

        // Add remaining text after last match
        if (lastIndex < text.length) {
            highlightedHTML += escapeHtml(text.substring(lastIndex));
        }

        // Set the overlay content
        overlay.innerHTML = highlightedHTML;

        // Force exact style matching
        const textareaStyles = window.getComputedStyle(codeTextarea);
        overlay.style.fontFamily = textareaStyles.fontFamily;
        overlay.style.fontSize = textareaStyles.fontSize;
        overlay.style.lineHeight = textareaStyles.lineHeight;
        overlay.style.letterSpacing = textareaStyles.letterSpacing;
        overlay.style.wordSpacing = textareaStyles.wordSpacing;
        overlay.style.padding = textareaStyles.padding;
        overlay.style.margin = textareaStyles.margin;
        overlay.style.border = textareaStyles.border;
        overlay.style.boxSizing = textareaStyles.boxSizing;

        // Ensure exact scroll synchronization
        overlay.scrollTop = codeTextarea.scrollTop;
        overlay.scrollLeft = codeTextarea.scrollLeft;

        // Also set selection on current match for additional feedback
        if (searchState.currentIndex >= 0 && searchState.currentIndex < searchState.matches.length) {
            const currentMatch = searchState.matches[searchState.currentIndex];
            codeTextarea.setSelectionRange(currentMatch.index, currentMatch.index + currentMatch.length);
        }

        console.log(`Search highlighting: Rendered ${searchState.matches.length} matches`);

    } catch (error) {
        console.error('Error in highlightSearchResults:', error);
        clearSearchHighlights();
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Debug function for search highlighting (available in console)
function debugSearchHighlighting() {
    const codeTextarea = document.getElementById('code');
    const overlay = document.getElementById('search-highlight-overlay');

    if (!codeTextarea || !overlay) {
        console.log('Debug: Missing elements');
        return;
    }

    const textareaRect = codeTextarea.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const textareaStyles = window.getComputedStyle(codeTextarea);
    const overlayStyles = window.getComputedStyle(overlay);

    console.log('=== Search Highlighting Debug ===');
    console.log('Textarea position:', textareaRect);
    console.log('Overlay position:', overlayRect);
    console.log('Position match:', {
        top: Math.abs(textareaRect.top - overlayRect.top) < 1,
        left: Math.abs(textareaRect.left - overlayRect.left) < 1,
        width: Math.abs(textareaRect.width - overlayRect.width) < 1,
        height: Math.abs(textareaRect.height - overlayRect.height) < 1
    });

    console.log('Font comparison:', {
        family: textareaStyles.fontFamily === overlayStyles.fontFamily,
        size: textareaStyles.fontSize === overlayStyles.fontSize,
        lineHeight: textareaStyles.lineHeight === overlayStyles.lineHeight,
        letterSpacing: textareaStyles.letterSpacing === overlayStyles.letterSpacing
    });

    console.log('Padding comparison:', {
        textarea: textareaStyles.padding,
        overlay: overlayStyles.padding,
        match: textareaStyles.padding === overlayStyles.padding
    });

    console.log('Current search state:', {
        query: searchState.currentQuery,
        matches: searchState.matches.length,
        currentIndex: searchState.currentIndex,
        isVisible: searchState.isVisible
    });

    if (searchState.matches.length > 0) {
        console.log('First match details:', searchState.matches[0]);
    }
}

// Make debug function globally available
window.debugSearchHighlighting = debugSearchHighlighting;

// Scroll to current match
function scrollToCurrentMatch() {
    const codeTextarea = document.getElementById('code');
    if (!codeTextarea || searchState.currentIndex === -1 || searchState.matches.length === 0) {
        return;
    }

    const match = searchState.matches[searchState.currentIndex];

    // Calculate line number to scroll to
    const textBeforeMatch = codeTextarea.value.substring(0, match.index);
    const lineNumber = textBeforeMatch.split('\n').length - 1;

    // Scroll textarea to make the match visible
    const lineHeight = parseInt(getComputedStyle(codeTextarea).lineHeight) || 20;
    const scrollTop = lineNumber * lineHeight;

    // Scroll to center the match in the visible area
    const textareaHeight = codeTextarea.clientHeight;
    const targetScroll = Math.max(0, scrollTop - textareaHeight / 2);

    codeTextarea.scrollTop = targetScroll;

    // Sync line numbers scroll
    const lineNumbersDiv = document.getElementById('lineNumbers');
    if (lineNumbersDiv) {
        lineNumbersDiv.scrollTop = targetScroll;
    }

    // Sync overlay scroll
    const overlay = document.getElementById('search-highlight-overlay');
    if (overlay) {
        overlay.scrollTop = targetScroll;
        overlay.scrollLeft = codeTextarea.scrollLeft;
    }
}

// Navigate to next match
function goToNextMatch() {
    if (searchState.matches.length === 0) return;

    searchState.currentIndex = (searchState.currentIndex + 1) % searchState.matches.length;
    highlightSearchResults(); // Update highlights to show new current match
    scrollToCurrentMatch();
    updateSearchCount(searchState.currentIndex + 1, searchState.matches.length);
}

// Navigate to previous match
function goToPreviousMatch() {
    if (searchState.matches.length === 0) return;

    searchState.currentIndex = searchState.currentIndex <= 0
        ? searchState.matches.length - 1
        : searchState.currentIndex - 1;
    highlightSearchResults(); // Update highlights to show new current match
    scrollToCurrentMatch();
    updateSearchCount(searchState.currentIndex + 1, searchState.matches.length);
}

// Toggle case sensitivity
function toggleCaseSensitive() {
    searchState.caseSensitive = !searchState.caseSensitive;
    const caseSensitiveBtn = document.getElementById('search-case');
    if (caseSensitiveBtn) {
        caseSensitiveBtn.classList.toggle('active', searchState.caseSensitive);
    }

    // Re-run search with new case sensitivity
    const searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value) {
        performSearch(searchInput.value);
    }
}

// Update search count display
function updateSearchCount(current, total) {
    const searchCount = document.getElementById('search-count');
    if (searchCount) {
        if (total === 0) {
            searchCount.textContent = 'No results';
        } else {
            searchCount.textContent = `${current} of ${total}`;
        }
    }
}

// Update search button states
function updateSearchButtons() {
    const prevBtn = document.getElementById('search-prev');
    const nextBtn = document.getElementById('search-next');
    const hasResults = searchState.matches.length > 0;

    if (prevBtn) {
        prevBtn.disabled = !hasResults;
    }

    if (nextBtn) {
        nextBtn.disabled = !hasResults;
    }
}

// Initialize search functionality
function initializeSearchFunctionality() {
    const searchInput = document.getElementById('search-input');
    const searchPrev = document.getElementById('search-prev');
    const searchNext = document.getElementById('search-next');
    const searchCase = document.getElementById('search-case');
    const searchClose = document.getElementById('search-close');

    if (!searchInput) {
        console.warn('Search input not found');
        return;
    }

    // Search input event handlers
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        if (query) {
            performSearch(query);
        } else {
            clearSearchHighlights();
            updateSearchCount(0, 0);
            updateSearchButtons();
        }
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                goToPreviousMatch();
            } else {
                goToNextMatch();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            hideSearchBar();
        }
    });

    // Navigation button handlers
    if (searchPrev) {
        searchPrev.addEventListener('click', goToPreviousMatch);
    }

    if (searchNext) {
        searchNext.addEventListener('click', goToNextMatch);
    }

    // Case sensitivity toggle
    if (searchCase) {
        searchCase.addEventListener('click', toggleCaseSensitive);
    }

    // Close button
    if (searchClose) {
        searchClose.addEventListener('click', hideSearchBar);
    }

    // Close search bar when clicking outside
    document.addEventListener('click', (e) => {
        const searchBar = document.getElementById('search-bar');
        if (searchState.isVisible && searchBar && !searchBar.contains(e.target)) {
            // Only close if not clicking on a search-related element
            const isSearchRelated = e.target.closest('.search-bar') !== null;
            if (!isSearchRelated) {
                hideSearchBar();
            }
        }
    });

    // Global escape key handler for search
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchState.isVisible) {
            e.preventDefault();
            hideSearchBar();
        }
    });

    // Sync scroll between textarea and highlight overlay
    const codeTextarea = document.getElementById('code');
    const overlay = document.getElementById('search-highlight-overlay');

    if (codeTextarea && overlay) {
        console.log('Search functionality: Initializing scroll synchronization');

        // Sync scroll position
        function syncScroll() {
            overlay.scrollTop = codeTextarea.scrollTop;
            overlay.scrollLeft = codeTextarea.scrollLeft;
        }

        codeTextarea.addEventListener('scroll', syncScroll);

        // Sync styles initially and on changes
        function syncStyles() {
            try {
                const textareaStyles = window.getComputedStyle(codeTextarea);
                overlay.style.fontFamily = textareaStyles.fontFamily;
                overlay.style.fontSize = textareaStyles.fontSize;
                overlay.style.lineHeight = textareaStyles.lineHeight;
                overlay.style.letterSpacing = textareaStyles.letterSpacing;
                overlay.style.wordSpacing = textareaStyles.wordSpacing;
                overlay.style.padding = textareaStyles.padding;
                overlay.style.margin = textareaStyles.margin;
                overlay.style.border = textareaStyles.border;
                overlay.style.boxSizing = textareaStyles.boxSizing;
                overlay.style.whiteSpace = textareaStyles.whiteSpace;
                overlay.style.wordWrap = textareaStyles.wordWrap;
                overlay.style.tabSize = textareaStyles.tabSize;
            } catch (error) {
                console.warn('Error syncing styles:', error);
            }
        }

        // Initial sync
        syncStyles();

        // Also sync on resize to ensure proper alignment
        const resizeObserver = new ResizeObserver(() => {
            if (searchState.matches.length > 0) {
                // Re-sync styles and re-render highlights after resize
                syncStyles();
                setTimeout(() => {
                    highlightSearchResults();
                }, 10);
            }
        });

        resizeObserver.observe(codeTextarea);

        // Periodic style sync to handle dynamic changes
        setInterval(syncStyles, 2000);

        console.log('Search functionality: Initialization complete');
    } else {
        console.warn('Search functionality: Missing textarea or overlay elements');
    }
}

