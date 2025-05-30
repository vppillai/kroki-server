// Application constants and configuration
const CONSTANTS = {
    // Default PlantUML example
    DEFAULT_EXAMPLE: `@startuml
Alice -> Bob: Hello
Bob --> Alice: Hi there
@enduml`,

    // Timing configurations
    DEBOUNCE_DELAY: 1000, // 1 second delay for diagram updates
    AUTO_SAVE_DELAY: 2000, // 2 seconds delay for auto-save

    // Zoom configuration
    ZOOM: {
        MIN_SCALE: 0.1,
        MAX_SCALE: 5,
        SCALE_STEP: 0.1,
        PADDING: 40 // 40px padding on each side for better spacing
    },

    // UI thresholds
    UI: {
        STACK_THRESHOLD: 350 // Width in pixels below which to stack controls
    }
};

// Supported formats for each diagram type
const FORMAT_COMPATIBILITY = {
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
    vega: ['png', 'svg', 'pdf'],
    vegalite: ['png', 'svg', 'pdf'],
    wavedrom: ['svg'],
    wireviz: ['png', 'svg']
};

// Display type for each format
const FORMAT_DISPLAY_TYPES = {
    svg: 'image',
    png: 'image',
    jpeg: 'image',
    pdf: 'download',
    txt: 'text',
    base64: 'text'
};

// File extensions mapping for different diagram types
const FILE_EXTENSIONS = {
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

export {
    CONSTANTS,
    FORMAT_COMPATIBILITY,
    FORMAT_DISPLAY_TYPES,
    FILE_EXTENSIONS
};
