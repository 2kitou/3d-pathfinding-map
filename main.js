import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// Import pathfinding logic
import { findMultiStopPath } from './pathfinder_astar.js';

// --- GLOBAL SETTINGS ---
let GRID_ROWS;
let GRID_COLS;
const CELL_SIZE = 1;
const PATH_HEIGHT = 0.2;
const BUILDING_HEIGHT = 2;
const clock = new THREE.Clock(); // For animation delta time

// Geometries (re-used for efficiency)
const pathGeometry = new THREE.BoxGeometry(CELL_SIZE, PATH_HEIGHT, CELL_SIZE);
const buildingGeometry = new THREE.BoxGeometry(CELL_SIZE, BUILDING_HEIGHT, CELL_SIZE);
const markerGeometry = new THREE.BoxGeometry(CELL_SIZE, PATH_HEIGHT * 2, CELL_SIZE);
const pathNodeGeometry = new THREE.BoxGeometry(CELL_SIZE * 0.5, PATH_HEIGHT * 1.5, CELL_SIZE * 0.5);
const agentGeometry = new THREE.SphereGeometry(CELL_SIZE * 0.3, 16, 16); // Agent geometry

// Materials (re-used for efficiency)
const pathMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 1.0, metalness: 0.0 });
const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.0 });
const startMaterial = new THREE.MeshStandardMaterial({ color: 0x4CAF50, emissive: 0x4CAF50, emissiveIntensity: 0.5 });
const stopMaterial = new THREE.MeshStandardMaterial({ color: 0xF44336, emissive: 0xF44336, emissiveIntensity: 0.5 });
const stopCompleteMaterial = new THREE.MeshStandardMaterial({ color: 0x00E676, emissive: 0x00E676, emissiveIntensity: 0.8 }); // Bright green
const agentMaterial = new THREE.MeshStandardMaterial({ color: 0x00BFFF, emissive: 0x00BFFF, emissiveIntensity: 1.0 }); // Agent material

const segmentMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x00BCD4, emissive: 0x00BCD4, emissiveIntensity: 0.7 }), // Cyan
    new THREE.MeshStandardMaterial({ color: 0xFF9800, emissive: 0xFF9800, emissiveIntensity: 0.7 }), // Orange
    new THREE.MeshStandardMaterial({ color: 0x9C27B0, emissive: 0x9C27B0, emissiveIntensity: 0.7 }), // Purple
    new THREE.MeshStandardMaterial({ color: 0xFFEB3B, emissive: 0xFFEB3B, emissiveIntensity: 0.7 })  // Yellow
];

let scene, camera, renderer, controls, mapGroup;
let labelRenderer;
let gridData = [];
let editorCells = [];

// Pathfinding State
let currentMode = "BUILD";
let startCoords = null;
let stopCoords = [];
let startMarker = null;
let stopMarkers = [];
let stopLabels = [];
let pathMeshes = [];
let isDrawing = false;
let drawingValue = 0;

// --- Animation State ---
let agent = null; // The 3D mesh for the agent
let isAnimating = false;
let animationPath = []; // Array of THREE.Vector3 positions
let animationFullPath = []; // Array of {r, c} coords for logic
let animationStopOrder = []; // Array of {r, c} coords for logic
let currentPathIndex = 0;
let animationProgress = 0;
const AGENT_SPEED = 2.0; // Units (cells) per second

// DOM Elements
const canvas = document.getElementById('three-canvas');
const editorContainer = document.getElementById('grid-editor-container');
const modeButtons = document.querySelectorAll('.mode-btn');
const findPathButton = document.getElementById('find-path-btn');
const messageBox = document.getElementById('message-box');
const helpButton = document.getElementById('help-btn');
const demoCursor = document.getElementById('demo-cursor'); // NEW: Demo cursor

// --- Tutorial Elements ---
const tutorialOverlay = document.getElementById('tutorial-overlay');
const tutorialStepBox = document.getElementById('tutorial-step');
const tutorialTitle = document.getElementById('tutorial-title');
const tutorialText = document.getElementById('tutorial-text');
const tutorialCounter = document.getElementById('tutorial-counter');
const tutorialPrev = document.getElementById('tutorial-prev');
const tutorialNext = document.getElementById('tutorial-next');
const tutorialEnd = document.getElementById('tutorial-end');
let currentTutorialStep = 0;
let highlightedElement = null;

// --- Tutorial Logic Flags ---
let isTutorialActive = false;
let currentTutorialWait = null; // Stores the current 'waitFor' condition
let tutorialClickListener = null; // Stores the 'click' listener to remove it

// --- MODIFIED: New interactive tutorial steps with DEMO property ---
const tutorialSteps = [
    {
        element: '#grid-editor-container',
        title: 'Welcome! The 2D Grid',
        text: 'This is the 2D "Pixel Block" Editor. We will build our map here. Click "Next".',
        waitFor: null // User just clicks "Next"
    },
    {
        element: '#grid-editor-container',
        title: '1. Build Obstacles',
        text: 'First, watch this demo on how to "paint" buildings.', // New text
        demo: 'build', // New property
        waitFor: { type: 'custom', event: 'build' }
    },
    {
        element: '#grid-editor-container',
        title: 'Erase Obstacles',
        text: 'Great! Now, watch how to "erase" buildings.', // New text
        demo: 'erase', // New property
        waitFor: { type: 'custom', event: 'erase' }
    },
    {
        element: '#btn-start',
        title: '2. Set Start',
        // MODIFIED: Removed demo and updated text
        text: 'Click the "Set Start" button to enter start placement mode.', 
        // REMOVED: demo: 'click-set-start', 
        waitFor: { type: 'click', element: '#btn-start' }
    },
    {
        element: '#grid-editor-container',
        title: 'Place Start Point',
        text: 'Watch this demo of placing the Start point.', // New text
        demo: 'place-start', // New property
        waitFor: { type: 'custom', event: 'set_start' }
    },
    {
        element: '#btn-stop',
        title: '3. Add Stops',
        // MODIFIED: Removed demo and updated text
        text: 'Click the "Add/Remove Stop" button to enter stop placement mode.', 
        // REMOVED: demo: 'click-set-stop', 
        waitFor: { type: 'click', element: '#btn-stop' }
    },
    {
        element: '#grid-editor-container',
        title: 'Place Stops',
        text: 'You can add multiple stops. Watch this demo. Click "Next" when you\'re ready to try.', // New text
        demo: 'place-stops', // New property
        waitFor: null // User will add their own, then click Next
    },
    {
        element: '#find-path-btn',
        title: '4. Find Route!',
        text: 'Watch how to calculate the final route.', // New text
        demo: 'click-find-path', // New property
        waitFor: { type: 'click', element: '#find-path-btn' }
    },
    {
        element: '.canvas-container',
        title: 'All Done!',
        text: 'Watch the animation! You can orbit the 3D map by clicking and dragging. Click "End" to finish the tutorial.',
        waitFor: null
    }
];


// --- INITIALIZATION ---

function init(rows, cols) {
    GRID_ROWS = rows;
    GRID_COLS = cols;

    createGridData();
    createEditorUI();
    initThreeJS();
    generate3DMap();
    
    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });
    findPathButton.addEventListener('click', onFindPathClick);

    editorContainer.addEventListener('mousedown', onGridMouseDown);
    editorContainer.addEventListener('mousemove', onGridMouseMove);
    editorContainer.addEventListener('mouseup', onGridMouseUp);
    editorContainer.addEventListener('mouseleave', onGridMouseUp);
    
    helpButton.addEventListener('click', startTutorial);
    
    // --- Tutorial Event Listeners ---
    tutorialNext.addEventListener('click', nextTutorialStep);
    tutorialPrev.addEventListener('click', prevTutorialStep);
    tutorialEnd.addEventListener('click', endTutorial);
    tutorialOverlay.addEventListener('click', (e) => {
        if(e.target === tutorialOverlay) {
            endTutorial(); // End if clicking on the dark background
        }
    });
    // --- End Tutorial Listeners ---

    animate();
    
    // --- Check for first visit ---
    if (!localStorage.getItem('hasVisitedMapEditor')) {
        localStorage.setItem('hasVisitedMapEditor', 'true');
        // --- NEW: Wait for modal to close before starting tutorial ---
        // (This is now handled in the 'START' section at the bottom)
    } else {
        // Remove modal immediately if not first visit
        document.getElementById('startup-modal').style.display = 'none';
    }
}

function createGridData() {
    gridData = [];
    for (let r = 0; r < GRID_ROWS; r++) {
        const row = [];
        for (let c = 0; c < GRID_COLS; c++) {
            // Start with an empty map (all 0s)
            row.push(0);
        }
        gridData.push(row);
    }
}

function createEditorUI() {
    editorContainer.innerHTML = ''; // Clear previous
    editorCells = [];
    editorContainer.style.gridTemplateColumns = `repeat(${GRID_COLS}, 1fr)`;

    for (let r = 0; r < GRID_ROWS; r++) {
        editorCells.push([]);
        for (let c = 0; c < GRID_COLS; c++) {
            const cell = document.createElement('div');
            cell.classList.add('grid-cell');
            cell.dataset.r = r;
            cell.dataset.c = c;
            cell.dataset.type = gridData[r][c];
            
            editorContainer.appendChild(cell);
            editorCells[r].push(cell);
        }
    }
}

function initThreeJS() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222); 
    
    mapGroup = new THREE.Group();
    scene.add(mapGroup);

    const aspect = canvas.clientWidth / canvas.clientHeight;
    camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 1000); 
    camera.position.set(0, 25, 25); 
    
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const labelContainer = document.getElementById('label-container');
    labelRenderer = new CSS2DRenderer({ element: labelContainer });
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); 
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8); 
    directionalLight.position.set(30, 40, 20); 
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    scene.add(directionalLight);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.update();

    window.addEventListener('resize', onWindowResize);
    onWindowResize(); 
}

// --- EVENT HANDLERS ---

function onGridMouseDown(event) {
    if (isTutorialActive) {
        // --- NEW LOGIC ---
        const step = tutorialSteps[currentTutorialStep];

        // 1. If step is waiting for a custom grid event
        if (currentTutorialWait && currentTutorialWait.type === 'custom') {
            const cell = event.target.closest('.grid-cell');
            if (!cell) return;
            
            const r = parseInt(cell.dataset.r);
            const c = parseInt(cell.dataset.c);

            if (currentMode === "BUILD") {
                if (currentTutorialWait.event !== 'build' && currentTutorialWait.event !== 'erase') return;
                isDrawing = true;
                drawingValue = gridData[r][c] === 1 ? 0 : 1;
                applyDrawing(r, c);
            } 
            else { // Assumes SET_START or SET_STOP
                handlePathfindingClick(r, c);
                
                if (currentTutorialWait.event === 'set_start' && startCoords) {
                    nextTutorialStep();
                }
            }
            return; // Prevent normal logic
        }
        
        // 2. If step is "Place Stops" (index 6) which has no 'waitFor' but needs grid interaction
        if (step.demo === 'place-stops' && currentMode === 'SET_STOP') {
            const cell = event.target.closest('.grid-cell');
            if (!cell) return;
            const r = parseInt(cell.dataset.r);
            const c = parseInt(cell.dataset.c);
            handlePathfindingClick(r, c); // Allow placing stops
            return; // Prevent normal logic
        }
        
        // 3. For any other tutorial step, block grid interaction
        return; 
        // --- END NEW LOGIC ---
    }

    // --- Normal logic (if tutorial is not active) ---
    stopAnimation(); // Stop animation on any grid interaction
    clearPath();
    messageBox.textContent = '';

    const cell = event.target.closest('.grid-cell');
    if (!cell) return;
    
    const r = parseInt(cell.dataset.r);
    const c = parseInt(cell.dataset.c);

    if (currentMode === "BUILD") {
        isDrawing = true;
        drawingValue = gridData[r][c] === 1 ? 0 : 1;
        applyDrawing(r, c);
    } 
    else {
        handlePathfindingClick(r, c);
    }
}

function onGridMouseMove(event) {
    if (isTutorialActive) {
        // If tutorial is active, ONLY allow drawing if it's waiting for build/erase
        if (!isDrawing || currentMode !== "BUILD" || (currentTutorialWait?.event !== 'build' && currentTutorialWait?.event !== 'erase')) {
            return;
        }
        // It IS waiting and drawing
        const cell = event.target.closest('.grid-cell');
        if (!cell) return;
        const r = parseInt(cell.dataset.r);
        const c = parseInt(cell.dataset.c);
        applyDrawing(r, c);
        return; // Prevent normal logic from running
    }

    // --- Normal logic (if tutorial is not active) ---
    if (!isDrawing || currentMode !== "BUILD") return;
    const cell = event.target.closest('.grid-cell');
    if (!cell) return;
    const r = parseInt(cell.dataset.r);
    const c = parseInt(cell.dataset.c);
    applyDrawing(r, c);
}

function onGridMouseUp(event) {
    if (isTutorialActive) {
         // --- MODIFIED: Tutorial check for building/erasing ---
         if (isDrawing && currentTutorialWait) { // Check if we *were* drawing
            if (currentTutorialWait.type === 'custom' && currentTutorialWait.event === 'build' && drawingValue === 1) {
                redraw3DMap(); // Redraw *after* drag
                nextTutorialStep();
            } else if (currentTutorialWait.type === 'custom' && currentTutorialWait.event === 'erase' && drawingValue === 0) {
                redraw3DMap(); // Redraw *after* drag
                nextTutorialStep();
            }
        }
        // --- End Tutorial check ---
        isDrawing = false; // Still need to stop drawing
        return;
    }

    if (isDrawing) {
        isDrawing = false;
        redraw3DMap();
    }
}

function applyDrawing(r, c) {
    if (startCoords && startCoords.r === r && startCoords.c === c) return;
    if (stopCoords.some(stop => stop.r === r && stop.c === c)) return;

    if (gridData[r][c] !== drawingValue) {
        gridData[r][c] = drawingValue;
        editorCells[r][c].dataset.type = drawingValue;
    }
}

function handlePathfindingClick(r, c) {
    if (startCoords && startCoords.r === r && startCoords.c === c) {
        startCoords = null;
        clearMarkers();
    }
    let stopIndex = stopCoords.findIndex(stop => stop.r === r && stop.c === c);
    if (stopIndex > -1) {
        stopCoords.splice(stopIndex, 1);
        clearMarkers();
    }

    if (currentMode === "SET_START") {
        if (gridData[r][c] === 1) {
            showMessage("Cannot place Start on an obstacle!");
            return;
        }
        startCoords = { r, c };
    } 
    else if (currentMode === "SET_STOP") {
        if (gridData[r][c] === 1) {
            showMessage("Cannot place Stop on an obstacle!");
            return;
        }
        if (stopIndex === -1) {
            stopCoords.push({ r, c });
        }
    }
    updateAllMarkers();
}

/**
 * Sets the current interaction mode.
 */
function setMode(mode) {
    stopAnimation(); // Stop animation when changing modes
    currentMode = mode;
    modeButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    if (!isTutorialActive) {
        showMessage(`Mode set to: ${mode}`);
    }
}

/**
 * Handles click on the "Find Path" button.
 */
function onFindPathClick() {
    // --- NEW: Tutorial check for finding path ---
    // We check this *before* the pathfinding starts
    let wasTutorialWaiting = false;
    if (isTutorialActive && currentTutorialWait) {
        if (currentTutorialWait.type === 'custom' && currentTutorialWait.event === 'find_path') {
            wasTutorialWaiting = true;
        }
    }
    // --- End Tutorial check ---
    
    stopAnimation(); // Stop any previous animation
    clearPath();
    
    if (!startCoords || stopCoords.length === 0) {
        showMessage("Please set a Start and at least one Stop point.");
        return;
    }

    showMessage("Calculating optimal route...");
    setUIEnabled(false); // Disable UI
    
    setTimeout(() => {
        // Use the imported function
        const { fullPath, stopOrder, totalDistance } = findMultiStopPath(gridData, startCoords, stopCoords, GRID_ROWS, GRID_COLS);
        
        if (fullPath && fullPath.length > 0) {
            drawPath(fullPath, stopOrder);
            
            for (let i = 1; i < stopOrder.length; i++) {
                const stop = stopOrder[i];
                const orderNumber = i;
                const originalIndex = stopCoords.findIndex(s => s.r === stop.r && s.c === stop.c);
                
                if (originalIndex > -1) {
                    const markerMesh = stopMarkers[originalIndex];
                    const labelDiv = document.createElement('div');
                    labelDiv.className = 'stop-label';
                    labelDiv.textContent = `${orderNumber}`;
                    const label = new CSS2DObject(labelDiv);
                    label.position.set(0, 0.5, 0);
                    markerMesh.add(label);
                    stopLabels.push(label);
                }
            }

            const orderText = stopOrder.map((stop, i) => {
                if (i === 0) return 'Start';
                // Find the *calculated* order index for the stop
                const orderNum = stopOrder.findIndex(s => s.r === stop.r && s.c === stop.c);
                return `Stop ${orderNum}`;
            }).join(' -> ');

            showMessage(`Route found! Order: ${orderText}. Length: ${totalDistance} steps.`);
            
            // --- Start animation ---
            startAnimation(fullPath, stopOrder); // Pass stopOrder
            // UI will be re-enabled by stopAnimation()
            
            // --- NEW: Advance tutorial if it was waiting ---
            if (wasTutorialWaiting) {
                nextTutorialStep();
            }

        } else {
            showMessage("No path found to one or more stops!");
            setUIEnabled(true); // Re-enable UI on failure
        }
    }, 10);
}

/**
 * Handles window resize.
 */
function onWindowResize() {
    const container = canvas.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    labelRenderer.setSize(width, height);
}

// --- 3D MAP GENERATION ---

function redraw3DMap() {
    while (mapGroup.children.length > 0) {
        mapGroup.remove(mapGroup.children[0]);
    }
    generate3DMap();
    drawMarkers();
}

function generate3DMap() {
    const offset_c = (GRID_COLS * CELL_SIZE) / 2 - CELL_SIZE / 2;
    const offset_r = (GRID_ROWS * CELL_SIZE) / 2 - CELL_SIZE / 2;
    
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const x = c * CELL_SIZE - offset_c;
            const z = r * CELL_SIZE - offset_r;

            let mesh;
            const type = gridData[r][c];

            if (type === 1) {
                // REVERTED: Use the global, fixed building geometry and material
                mesh = new THREE.Mesh(buildingGeometry, buildingMaterial);
                mesh.position.set(x, BUILDING_HEIGHT / 2, z);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            } else {
                mesh = new THREE.Mesh(pathGeometry, pathMaterial);
                mesh.position.set(x, PATH_HEIGHT / 2, z);
                mesh.receiveShadow = true; 
            }
            mapGroup.add(mesh);
        }
    }
}

// --- PATHFINDING AND VISUALIZATION ---

function get3DPos(r, c, y) {
    const offset_c = (GRID_COLS * CELL_SIZE) / 2 - CELL_SIZE / 2;
    const offset_r = (GRID_ROWS * CELL_SIZE) / 2 - CELL_SIZE / 2;
    const x = c * CELL_SIZE - offset_c;
    const z = r * CELL_SIZE - offset_r;
    return { x, y, z };
}

function updateAllMarkers() {
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const stopIndex = stopCoords.findIndex(stop => stop.r === r && stop.c === c);
            if (startCoords && startCoords.r === r && startCoords.c === c) {
                editorCells[r][c].dataset.type = "start";
            } else if (stopIndex > -1) {
                editorCells[r][c].dataset.type = "stop";
            } else if (gridData[r][c] === 0 || gridData[r][c] === 1) {
                editorCells[r][c].dataset.type = gridData[r][c];
            }
        }
    }
    drawMarkers();
}

function clearMarkers() {
    if (startMarker) {
        mapGroup.remove(startMarker);
        startMarker = null;
    }
    stopMarkers.forEach(marker => mapGroup.remove(marker));
    stopMarkers = [];
    stopLabels.forEach(label => {
        if(label.parent) {
            label.parent.remove(label);
        }
    });
    stopLabels = [];
}

function drawMarkers() {
    clearMarkers();
    if (startCoords) {
        startMarker = new THREE.Mesh(markerGeometry, startMaterial);
        const pos = get3DPos(startCoords.r, startCoords.c, PATH_HEIGHT + 0.1);
        startMarker.position.set(pos.x, pos.y, pos.z);
        mapGroup.add(startMarker);
    }
    stopCoords.forEach((stop, index) => {
        const marker = new THREE.Mesh(markerGeometry, stopMaterial);
        const pos = get3DPos(stop.r, stop.c, PATH_HEIGHT + 0.1);
        marker.position.set(pos.x, pos.y, pos.z);
        mapGroup.add(marker);
        stopMarkers.push(marker);
    });
}

function clearPath() {
    stopAnimation(); // Stop animation when clearing path
    pathMeshes.forEach(mesh => mapGroup.remove(mesh));
    pathMeshes = [];
    stopLabels.forEach(label => {
        if(label.parent) {
            label.parent.remove(label);
        }
    });
    stopLabels = [];

    // Reset stop marker colors
    stopMarkers.forEach(marker => {
        marker.material = stopMaterial;
    });
}

function drawPath(fullPath, stopOrder) {
    clearPath();
    let pathCurrentIndex = 0;
    for (let i = 1; i < stopOrder.length; i++) {
        const currentStop = stopOrder[i];
        const color = segmentMaterials[(i-1) % segmentMaterials.length];
        let stopIndexInPath = -1;
        for (let j = pathCurrentIndex; j < fullPath.length; j++) {
            if (fullPath[j].r === currentStop.r && fullPath[j].c === currentStop.c) {
                stopIndexInPath = j;
                break;
            }
        }
        if (stopIndexInPath === -1) continue;
        const segment = fullPath.slice(pathCurrentIndex, stopIndexInPath + 1);
        for (let j = 1; j < segment.length - 1; j++) {
            const node = segment[j];
            const mesh = new THREE.Mesh(pathNodeGeometry, color);
            const pos = get3DPos(node.r, node.c, PATH_HEIGHT + 0.05);
            mesh.position.set(pos.x, pos.y, pos.z);
            mapGroup.add(mesh);
            pathMeshes.push(mesh);
        }
        pathCurrentIndex = stopIndexInPath;
    }
}

function showMessage(msg) {
    messageBox.textContent = msg;
}

// --- ANIMATION FUNCTIONS ---

/**
 * Disables/Enables UI elements during animation.
 */
function setUIEnabled(enabled) {
    modeButtons.forEach(btn => btn.disabled = !enabled);
    findPathButton.disabled = !enabled;
    // MODIFIED: Use classlist for disabled state
    if (enabled) {
        editorContainer.classList.remove('disabled');
    } else {
        editorContainer.classList.add('disabled');
    }
}

/**
 * Starts the agent animation.
 */
function startAnimation(path, stopOrder) { // Added stopOrder
    stopAnimation(); // Clear any existing
    
    // Create agent
    agent = new THREE.Mesh(agentGeometry, agentMaterial);
    mapGroup.add(agent);

    // Store path data for logic
    animationFullPath = path;
    animationStopOrder = stopOrder;

    // Convert grid path to 3D vector path
    animationPath = path.map(node => {
        const pos = get3DPos(node.r, node.c, PATH_HEIGHT + 0.25); // Slightly above path
        return new THREE.Vector3(pos.x, pos.y, pos.z);
    });
    
    if (animationPath.length > 0) {
        agent.position.copy(animationPath[0]);
        isAnimating = true;
        currentPathIndex = 0;
        animationProgress = 0;
        setUIEnabled(false); // Disable UI
    } else {
        stopAnimation();
    }
}

/**
 * Stops the agent animation and cleans up.
 */
function stopAnimation() {
    if (isAnimating) {
        showMessage("Animation finished!");
    }
    isAnimating = false;
    if (agent) {
        mapGroup.remove(agent);
        agent = null;
    }
    animationPath = [];
    animationFullPath = [];
    animationStopOrder = [];
    currentPathIndex = 0;
    animationProgress = 0;
    setUIEnabled(true); // Re-enable UI
}

/**
 * Updates agent position every frame.
 */
function updateAnimation(delta) {
    if (!isAnimating || !agent || animationPath.length < 2) {
        stopAnimation();
        return;
    }

    // Move progress forward
    animationProgress += AGENT_SPEED * delta;

    // Check if we reached the next node
    if (animationProgress >= 1.0) {
        animationProgress = 0; // Reset progress
        currentPathIndex++;    // Move to next segment
        
        // --- Check if we arrived at a stop ---
        const arrivedNode = animationFullPath[currentPathIndex];
        // Check if this node is a stop (and not the start point)
        const stopIndexInOrder = animationStopOrder.findIndex(stop => stop.r === arrivedNode.r && stop.c === arrivedNode.c);
        
        if (stopIndexInOrder > 0) { // Found a stop (index 0 is start)
            // Find the corresponding 3D marker in the original stopMarkers array
            const markerIndex = stopCoords.findIndex(stop => stop.r === arrivedNode.r && stop.c === arrivedNode.c);
            if (markerIndex > -1 && stopMarkers[markerIndex]) {
                stopMarkers[markerIndex].material = stopCompleteMaterial;
            }
        }
        // --- End of new check ---

        // Check if animation is finished
        if (currentPathIndex >= animationPath.length - 1) {
            agent.position.copy(animationPath[animationPath.length - 1]); // Snap to end
            stopAnimation();
            return;
        }
    }
    
    const currentPos = animationPath[currentPathIndex];
    const nextPos = animationPath[currentPathIndex + 1];
    
    // Linearly interpolate agent's position
    agent.position.lerpVectors(currentPos, nextPos, animationProgress);
}

// --- NEW: TUTORIAL FUNCTIONS (Heavily Modified) ---

function startTutorial() {
    // Clear any old state
    clearMarkers();
    clearPath();
    gridData.forEach(row => row.fill(0));
    redraw3DMap();
    startCoords = null;
    stopCoords = [];
    
    setMode('BUILD'); // Set default mode
    
    currentTutorialStep = 0;
    isTutorialActive = true; 
    tutorialOverlay.style.display = 'block';
    tutorialStepBox.style.display = 'block';
    
    // Disable main UI
    editorContainer.classList.add('disabled');
    
    showTutorialStep(0);
}

function endTutorial() {
    isTutorialActive = false; 
    currentTutorialWait = null; 
    tutorialOverlay.style.display = 'none';
    tutorialStepBox.style.display = 'none';
    
    // Hide demo cursor
    demoCursor.style.display = 'none';
    demoCursor.style.opacity = '0';
    
    if (highlightedElement) {
        highlightedElement.classList.remove('tutorial-highlight');
        highlightedElement = null;
    }
    if (tutorialClickListener) {
        tutorialClickListener.element.removeEventListener('click', tutorialClickListener.handler);
        tutorialClickListener = null;
    }
    // Re-enable main UI
    editorContainer.classList.remove('disabled');
    setUIEnabled(true);
}

function nextTutorialStep() {
    if (currentTutorialStep < tutorialSteps.length - 1) {
        currentTutorialStep++;
        showTutorialStep(currentTutorialStep);
    }
}

function prevTutorialStep() {
    if (currentTutorialStep > 0) {
        currentTutorialStep--;
        showTutorialStep(currentTutorialStep);
    }
}

async function showTutorialStep(index) {
    // Clear any previous click listener
    if (tutorialClickListener) {
        tutorialClickListener.element.removeEventListener('click', tutorialClickListener.handler);
        tutorialClickListener = null;
    }
    
    // Remove highlight from previous
    if (highlightedElement) {
        highlightedElement.classList.remove('tutorial-highlight');
    }
    
    const step = tutorialSteps[index];
    currentTutorialWait = null; // Clear wait by default
    const element = document.querySelector(step.element);
    
    if (!element) {
        console.warn(`Tutorial element not found: ${step.element}`);
        return;
    }
    
    // Add highlight to current
    element.classList.add('tutorial-highlight');
    highlightedElement = element;
    
    // Scroll element into view
    element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
    });

    // Update text
    tutorialTitle.textContent = step.title;
    tutorialText.textContent = step.text;
    tutorialCounter.textContent = `${index + 1} / ${tutorialSteps.length}`;
    
    // Disable all nav buttons first
    tutorialPrev.disabled = true;
    tutorialNext.disabled = true;
    
    // Position the step box (with timeout for scroll)
    setTimeout(() => {
        const rect = element.getBoundingClientRect();
        let top = rect.top;
        let left = rect.right + 20; 
        
        if (left + 300 > window.innerWidth) {
            left = rect.left - 300 - 20;
        }
        if (top + tutorialStepBox.offsetHeight > window.innerHeight) {
            top = window.innerHeight - tutorialStepBox.offsetHeight - 20;
        }
        if (top < 0) {
            top = 20;
        }
        if (left < 0) {
            left = (window.innerWidth / 2) - 150;
        }
        
        tutorialStepBox.style.top = `${top}px`;
        tutorialStepBox.style.left = `${left}px`;
    }, 300);

    // --- NEW: Demo Logic ---
    if (step.demo) {
        // This step has a demo. Run it.
        // User cannot do anything until demo is over.
        await runTutorialDemo(step.demo);
        
        // Demo finished. Update text and set up wait.
        if (step.waitFor) {
            if (step.waitFor.type === 'click') {
                tutorialText.textContent = `Now, you click the highlighted button.`;
                const targetElement = document.querySelector(step.waitFor.element);
                if (targetElement) {
                    const handler = () => {
                        // We also need to manually call setMode if it's a mode button
                        if (targetElement.dataset.mode) {
                            setMode(targetElement.dataset.mode);
                        }
                        if (targetElement.id === 'find-path-btn') {
                            onFindPathClick(); // Manually trigger
                        }
                        nextTutorialStep();
                    };
                    targetElement.addEventListener('click', handler, { once: true });
                    tutorialClickListener = { element: targetElement, handler: handler };
                }
            } else if (step.waitFor.type === 'custom') {
                tutorialText.textContent = `Now you try it on the grid. We'll wait...`;
                currentTutorialWait = step.waitFor; // Now we wait for the user
                editorContainer.classList.remove('disabled'); // Enable grid for user
            }
        } else {
            // No 'waitFor' after demo (e.g., "Place Stops")
            tutorialText.textContent = `Now you try it. Add as many stops as you like, then click "Next".`;
            tutorialNext.disabled = false; // Manually enable next
            editorContainer.classList.remove('disabled'); // Enable grid for user
        }
        
        // Enable 'Prev' button
        if (index > 0) tutorialPrev.disabled = false;

    } else {
        // No demo for this step.
        // Enable 'Prev' button
        if (index > 0) tutorialPrev.disabled = false;
        
        // Check wait condition
        if (!step.waitFor) {
            // If no wait condition, enable "Next"
            tutorialNext.disabled = false;
        } else if (step.waitFor.type === 'click') {
            const targetElement = document.querySelector(step.waitFor.element);
            if (targetElement) {
                const handler = () => {
                     if (targetElement.dataset.mode) {
                        setMode(targetElement.dataset.mode);
                    }
                    if (targetElement.id === 'find-path-btn') {
                        onFindPathClick(); // Manually trigger
                    }
                    nextTutorialStep();
                };
                targetElement.addEventListener('click', handler, { once: true });
                tutorialClickListener = { element: targetElement, handler: handler };
            }
        } else if (step.waitFor.type === 'custom') {
            currentTutorialWait = step.waitFor; // Wait for user
            editorContainer.classList.remove('disabled'); // Enable grid for user
        }
    }
    // --- End Demo Logic ---
}

// --- NEW: Tutorial Demo Functions ---

// Helper: sleep
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// *** NEW HELPER ***
/**
 * Finds the first available empty cell (path) for demos.
 * Starts from the middle and spirals outwards.
 * @returns {object} {r, c} or null if no cell is found.
 */
function findEmptyCell() {
    const rMid = Math.floor(GRID_ROWS / 2);
    const cMid = Math.floor(GRID_COLS / 2);

    if (gridData[rMid][cMid] === 0) return { r: rMid, c: cMid };

    for (let radius = 1; radius < Math.max(rMid, cMid); radius++) {
        for (let r = rMid - radius; r <= rMid + radius; r++) {
            for (let c = cMid - radius; c <= cMid + radius; c++) {
                // Only check the "border" of this radius
                if (Math.abs(r - rMid) === radius || Math.abs(c - cMid) === radius) {
                    if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS && gridData[r][c] === 0) {
                        return { r, c };
                    }
                }
            }
        }
    }
    return null; // Should be rare
}

// Helper: Move cursor to an element
async function moveCursorTo(element) {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    demoCursor.style.transform = `translate(${x - 10}px, ${y - 3}px)`; // Offset for pointer tip
    await sleep(500); // Time to move
}

// Helper: Move cursor to specific grid cell
async function moveCursorToCell(r, c) {
    if (!editorCells[r] || !editorCells[r][c]) return;
    const cell = editorCells[r][c];
    await moveCursorTo(cell);
}

// Helper: Simulate click
async function demoClick(element, duration = 200) {
    await moveCursorTo(element);
    demoCursor.classList.add('mousedown');
    await sleep(duration);
    demoCursor.classList.remove('mousedown');
    await sleep(200);
}

// Helper: Simulate drag
async function demoDrag(r1, c1, r2, c2, val) {
    await moveCursorToCell(r1, c1);
    demoCursor.classList.add('mousedown');
    drawingValue = val; // Set drawing value for demo
    applyDrawing(r1, c1); // Apply first click
    await sleep(200);
    
    const rStep = (r2 > r1) ? 1 : (r2 < r1) ? -1 : 0;
    const cStep = (c2 > c1) ? 1 : (c2 < c1) ? -1 : 0;
    
    let r = r1;
    let c = c1;
    
    while (r !== r2 || c !== c2) {
        if (r !== r2) r += rStep;
        if (c !== c2) c += cStep;
        
        r = Math.max(0, Math.min(GRID_ROWS - 1, r));
        c = Math.max(0, Math.min(GRID_COLS - 1, c));
        
        // Failsafe: if target is blocked, don't draw over it
        if (gridData[r][c] !== 0 && val === 1) { 
             // skip
        } else {
            await moveCursorToCell(r, c);
            applyDrawing(r,c); // Apply drawing during drag
            await sleep(100); // Drag speed
        }
    }
    
    demoCursor.classList.remove('mousedown');
    redraw3DMap(); // Redraw map at the end
    await sleep(200);
}

// Main demo animation function
async function runTutorialDemo(demoType) {
    demoCursor.style.display = 'block';
    await sleep(100);
    demoCursor.style.opacity = '1';
    
    // Center the cursor
    demoCursor.style.transform = `translate(${window.innerWidth / 2}px, ${window.innerHeight / 2}px)`;
    await sleep(500);

    // --- MODIFICATION: Find safe, empty cells for the demo ---
    let safeCoords = [];
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (gridData[r][c] === 0) {
                safeCoords.push({ r, c });
                if (safeCoords.length >= 5) break; // Need 5 for our demos
            }
        }
        if (safeCoords.length >= 5) break;
    }

    // Failsafe if grid is full (very unlikely)
    if (safeCoords.length < 5) {
        console.warn("Not enough empty space to run full demo.");
        // Fallback to center (original buggy behavior)
        const midR = Math.floor(GRID_ROWS / 2);
        const midC = Math.floor(GRID_COLS / 2);
        safeCoords = [
            { r: midR - 2, c: midC - 2 }, { r: midR - 2, c: midC + 2 },
            { r: midR, c: midC }, { r: midR - 3, c: midC }, { r: midR + 3, c: midC }
        ];
    }
    // --- END MODIFICATION ---

    switch (demoType) {
        case 'build':
            setMode('BUILD'); // Ensure correct mode
            // Use safe coords
            await demoDrag(safeCoords[0].r, safeCoords[0].c, safeCoords[1].r, safeCoords[1].c, 1); // 1 = build
            break;
        
        case 'erase':
            setMode('BUILD'); // Ensure correct mode
            // Use same safe coords to erase
            await demoDrag(safeCoords[0].r, safeCoords[0].c, safeCoords[1].r, safeCoords[1].c, 0); // 0 = erase
            break;
        
        case 'click-set-start':
            // This demo is removed, but we keep the case just in case
            await demoClick(document.getElementById('btn-start'));
            break;

        case 'place-start':
            setMode('SET_START'); // Ensure correct mode
            // Use 3rd safe coord
            await demoClick(editorCells[safeCoords[2].r][safeCoords[2].c]);
            handlePathfindingClick(safeCoords[2].r, safeCoords[2].c); // Simulate click
            break;

        case 'click-set-stop':
            // This demo is removed
            await demoClick(document.getElementById('btn-stop'));
            break;

        case 'place-stops':
            setMode('SET_STOP'); // Ensure correct mode
            // Use 4th and 5th safe coords
            await demoClick(editorCells[safeCoords[3].r][safeCoords[3].c]);
            handlePathfindingClick(safeCoords[3].r, safeCoords[3].c); // Simulate click
            await demoClick(editorCells[safeCoords[4].r][safeCoords[4].c]);
            handlePathfindingClick(safeCoords[4].r, safeCoords[4].c); // Simulate click
            break;

        case 'click-find-path':
            await demoClick(document.getElementById('find-path-btn'));
            // Don't actually run the pathfind, just demo the click
            break;
            
        case 'orbit-map': // NEW DEMO CASE
            {
                const canvasRect = canvas.getBoundingClientRect();
                const startX = canvasRect.left + canvasRect.width / 2;
                const startY = canvasRect.top + canvasRect.height / 2;
                const dragOffset = 80;

                // Move to center
                demoCursor.style.transform = `translate(${startX - 10}px, ${startY - 3}px)`;
                await sleep(500);
                
                // --- Simulate drag left ---
                demoCursor.classList.add('mousedown');
                await sleep(100);
                demoCursor.style.transform = `translate(${startX - dragOffset - 10}px, ${startY - 3}px)`;
                await sleep(500); // Hold drag
                demoCursor.classList.remove('mousedown');
                await sleep(300);

                // --- Simulate drag right ---
                demoCursor.classList.add('mousedown');
                await sleep(100);
                demoCursor.style.transform = `translate(${startX + dragOffset - 10}px, ${startY - 3}px)`;
                await sleep(500); // Hold drag
                demoCursor.classList.remove('mousedown');
                await sleep(300);

                // Reset to center
                demoCursor.style.transform = `translate(${startX - 10}px, ${startY - 3}px)`;
                await sleep(300);
            }
            break;
    }

    // Hide cursor
    demoCursor.style.opacity = '0';
    await sleep(300);
    demoCursor.style.display = 'none';
}

// --- END: Tutorial Demo Functions ---


// --- ANIMATION LOOP ---

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta(); // Get time since last frame
    
    if (isAnimating) {
        updateAnimation(delta); // Update animation
    }
    
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

// --- START ---

const modal = document.getElementById('startup-modal');
const startBtn = document.getElementById('start-btn');
const rowsInput = document.getElementById('input-rows');
const colsInput = document.getElementById('input-cols');

startBtn.addEventListener('click', () => {
    let rows = parseInt(rowsInput.value);
    let cols = parseInt(colsInput.value);
    rows = Math.min(Math.max(rows, 5), 50);
    cols = Math.min(Math.max(cols, 5), 50);

    // MODIFIED: Hide modal *before* init
    modal.style.display = 'none';
    init(rows, cols);

    // --- NEW: Check if we should start tutorial ---
    if (localStorage.getItem('hasVisitedMapEditor') === 'true') {
        // This is a bit of a workaround: 'hasVisitedMapEditor' is set in init()
        // but the check in init() is what *prevents* the modal from showing.
        // We know if we're *here*, the modal was shown, so it's the first visit.
        setTimeout(startTutorial, 500); // Wait for modal to close
    }
});
