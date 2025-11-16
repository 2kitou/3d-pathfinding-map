// --- Import Pathfinding Logic ---
import { findMultiStopPath } from './pathfinder_astar.js';
import { findMultiStopPathBFS } from './pathfinder_bfs.js';

// --- Import Three.js ---
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

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
const visitedNodeGeometry = new THREE.BoxGeometry(CELL_SIZE * 0.8, PATH_HEIGHT, CELL_SIZE * 0.8);

// Materials (re-used for efficiency)
const pathMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 1.0, metalness: 0.0 });
const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.0 });
const startMaterial = new THREE.MeshStandardMaterial({ color: 0x4CAF50, emissive: 0x4CAF50, emissiveIntensity: 0.5 });
const stopMaterial = new THREE.MeshStandardMaterial({ color: 0xF44336, emissive: 0xF44336, emissiveIntensity: 0.5 });
const stopCompleteMaterial = new THREE.MeshStandardMaterial({ color: 0x00E676, emissive: 0x00E676, emissiveIntensity: 0.8 }); // Bright green
const visitedMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x007bff, 
    emissive: 0x007bff, 
    emissiveIntensity: 0.4, 
    opacity: 0.6, 
    transparent: true 
});

const animatedPathMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x00BCD4, 
    emissive: 0x00BCD4, 
    emissiveIntensity: 0.7 
});

// --- NEW: Two sets of Three.js variables ---
let sceneAstar, cameraAstar, rendererAstar, controlsAstar, mapGroupAstar, labelRendererAstar;
let sceneBfs, cameraBfs, rendererBfs, controlsBfs, mapGroupBfs, labelRendererBfs;

let gridData = [];
let editorCells = [];

// Pathfinding State
let currentMode = "BUILD";
let startCoords = null;
let stopCoords = [];

// --- NEW: Scene-specific state ---
let startMarkerAstar = null, startMarkerBfs = null;
let stopMarkersAstar = [], stopMarkersBfs = [];
let stopLabelsAstar = [], stopLabelsBfs = [];
let pathMeshesAstar = [], pathMeshesBfs = [];
let visitedMeshesAstar = [], visitedMeshesBfs = [];

let isDrawing = false;
let drawingValue = 0;

// DOM Elements
const editorContainer = document.getElementById('grid-editor-container');
const modeButtons = document.querySelectorAll('.mode-btn');
const findPathButton = document.getElementById('find-path-btn');
const messageBox = document.getElementById('message-box');
const helpButton = document.getElementById('help-btn');
const demoCursor = document.getElementById('demo-cursor'); 

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
        text: 'Click the "Set Start" button to enter start placement mode.', 
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
        text: 'Click the "Add/Remove Stop" button to enter stop placement mode.', 
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
<<<<<<< HEAD
        text: 'Great! Now, click the "Find Route" button to see both algorithms run.', 
=======
        text: 'Great! Now, click the "Find Optimal Route" button to see the magic.', // MODIFIED: Updated text
        // REMOVED: demo: 'click-find-path',
>>>>>>> ab392d4471940dc1fbb1f5ec7cb65140d1bfa640
        waitFor: { type: 'click', element: '#find-path-btn' }
    },
    {
        element: '.visualization-container',
        title: 'All Done!',
        text: 'Watch the animations! You can orbit the 3D maps by clicking and dragging. Click "End" to finish the tutorial.',
        waitFor: null
    }
];


// --- INITIALIZATION ---

function init(rows, cols) {
    GRID_ROWS = rows;
    GRID_COLS = cols;

    createGridData();
    createEditorUI();
    
    // --- NEW: Init both scenes ---
    initThreeJS();
    
    generate3DMap(mapGroupAstar);
    generate3DMap(mapGroupBfs);
    
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
    } else {
        document.getElementById('startup-modal').style.display = 'none';
    }
}

function createGridData() {
    gridData = [];
    for (let r = 0; r < GRID_ROWS; r++) {
        const row = [];
        for (let c = 0; c < GRID_COLS; c++) {
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

// --- NEW: Generic scene creator ---
function createScene(canvas, labelContainer) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    const mapGroup = new THREE.Group();
    scene.add(mapGroup);

    const aspect = canvas.clientWidth / canvas.clientHeight;
    const camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 1000);
    camera.position.set(0, 25, 25);

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const labelRenderer = new CSS2DRenderer({ element: labelContainer });
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

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.update();

    return { scene, camera, renderer, controls, mapGroup, labelRenderer };
}

// --- NEW: Init both scenes ---
function initThreeJS() {
    // A* Scene
    const canvasAstar = document.getElementById('three-canvas-astar');
    const labelContainerAstar = document.getElementById('label-container-astar');
    const sceneAstarData = createScene(canvasAstar, labelContainerAstar);
    sceneAstar = sceneAstarData.scene;
    cameraAstar = sceneAstarData.camera;
    rendererAstar = sceneAstarData.renderer;
    controlsAstar = sceneAstarData.controls;
    mapGroupAstar = sceneAstarData.mapGroup;
    labelRendererAstar = sceneAstarData.labelRenderer;
    
    // BFS Scene
    const canvasBfs = document.getElementById('three-canvas-bfs');
    const labelContainerBfs = document.getElementById('label-container-bfs');
    const sceneBfsData = createScene(canvasBfs, labelContainerBfs);
    sceneBfs = sceneBfsData.scene;
    cameraBfs = sceneBfsData.camera;
    rendererBfs = sceneBfsData.renderer;
    controlsBfs = sceneBfsData.controls;
    mapGroupBfs = sceneBfsData.mapGroup;
    labelRendererBfs = sceneBfsData.labelRenderer;

    // --- NEW: Auto-fit camera ---
    // Determine the largest grid dimension
    const maxDim = Math.max(GRID_ROWS, GRID_COLS) * CELL_SIZE;
    // Calculate a suitable camera distance.
    // tan(fov/2) = (grid_radius) / distance
    // We use maxDim as the diameter.
    const fov = 40; // From createScene
    const distance = (maxDim / 2) / Math.tan(THREE.MathUtils.degToRad(fov / 2));
    
    // Add some padding (e.g., 50%) and set a minimum distance
    // MODIFIED: Further tuning to match user's screenshot (tight zoom + steeper angle)
    const camZ = Math.max(distance * 0.2, 10); // Z position (pull back) - Was 0.9
    const camY = Math.max(distance * 2.0, 25); // Y position (height) - Was 1.3

    cameraAstar.position.set(0, camY, camZ);
    cameraBfs.position.set(0, camY, camZ);
    // --- End auto-fit camera ---

    // --- NEW: Sync Controls ---
    let isSyncing = false;
    controlsAstar.addEventListener('change', () => {
        if (isSyncing) return;
        isSyncing = true;
        cameraBfs.position.copy(cameraAstar.position);
        cameraBfs.quaternion.copy(cameraAstar.quaternion);
        controlsBfs.target.copy(controlsAstar.target);
        isSyncing = false;
    });

    controlsBfs.addEventListener('change', () => {
        if (isSyncing) return;
        isSyncing = true;
        cameraAstar.position.copy(cameraBfs.position);
        cameraAstar.quaternion.copy(cameraBfs.quaternion);
        controlsAstar.target.copy(controlsBfs.target);
        isSyncing = false;
    });
    // --- End Sync Controls ---

    window.addEventListener('resize', onWindowResize);
    onWindowResize(); 
}

// --- EVENT HANDLERS ---

function onGridMouseDown(event) {
    if (isTutorialActive) {
        // ... (tutorial logic unchanged)
        const step = tutorialSteps[currentTutorialStep];
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
            else { 
                handlePathfindingClick(r, c);
                if (currentTutorialWait.event === 'set_start' && startCoords) {
                    nextTutorialStep();
                }
            }
            return; 
        }
        if (step.demo === 'place-stops' && currentMode === 'SET_STOP') {
            const cell = event.target.closest('.grid-cell');
            if (!cell) return;
            const r = parseInt(cell.dataset.r);
            const c = parseInt(cell.dataset.c);
            handlePathfindingClick(r, c); 
            return; 
        }
        return; 
    }

    // --- Normal logic ---
    clearAllPaths(); // MODIFIED
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
        // ... (tutorial logic unchanged)
         if (!isDrawing || currentMode !== "BUILD" || (currentTutorialWait?.event !== 'build' && currentTutorialWait?.event !== 'erase')) {
            return;
        }
        const cell = event.target.closest('.grid-cell');
        if (!cell) return;
        const r = parseInt(cell.dataset.r);
        const c = parseInt(cell.dataset.c);
        applyDrawing(r, c);
        return; 
    }

    if (!isDrawing || currentMode !== "BUILD") return;
    const cell = event.target.closest('.grid-cell');
    if (!cell) return;
    const r = parseInt(cell.dataset.r);
    const c = parseInt(cell.dataset.c);
    applyDrawing(r, c);
}

function onGridMouseUp(event) {
    if (isTutorialActive) {
        // ... (tutorial logic unchanged)
         if (isDrawing && currentTutorialWait) { 
            if (currentTutorialWait.type === 'custom' && currentTutorialWait.event === 'build' && drawingValue === 1) {
                redraw3DMap(); 
                nextTutorialStep();
            } else if (currentTutorialWait.type === 'custom' && currentTutorialWait.event === 'erase' && drawingValue === 0) {
                redraw3DMap(); 
                nextTutorialStep();
            }
        }
        isDrawing = false; 
        return;
    }

    if (isDrawing) {
        isDrawing = false;
        redraw3DMap(); // MODIFIED
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
        clearAllMarkers(); // MODIFIED
    }
    let stopIndex = stopCoords.findIndex(stop => stop.r === r && stop.c === c);
    if (stopIndex > -1) {
        stopCoords.splice(stopIndex, 1);
        clearAllMarkers(); // MODIFIED
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

function setMode(mode) {
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
    let wasTutorialWaiting = false;
    // ... (tutorial logic unchanged)
    if (isTutorialActive && currentTutorialWait) {
        if (currentTutorialWait.type === 'custom' && currentTutorialWait.event === 'find_path') {
            wasTutorialWaiting = true;
        }
        if (currentTutorialWait.type === 'click' && currentTutorialWait.element === '#find-path-btn') {
            wasTutorialWaiting = true;
        }
    }
    
    // --- FIX 1: Clear all previous animations ---
    clearAllPaths();
    // ------------------------------------------

    if (!startCoords || stopCoords.length === 0) {
        showMessage("Please set a Start and at least one Stop point.");
        return;
    }

    showMessage("Calculating routes...");
    setUIEnabled(false); // Disable UI
    
    setTimeout(() => {
        // --- RUN BOTH ALGORITHMS ---
        const resultAstar = findMultiStopPath(gridData, startCoords, stopCoords, GRID_ROWS, GRID_COLS);
        const resultBfs = findMultiStopPathBFS(gridData, startCoords, stopCoords, GRID_ROWS, GRID_COLS);
        
        // --- VISUALIZE A* ---
        if (resultAstar.fullPath && resultAstar.fullPath.length > 0) {
            animateVisitedNodes(resultAstar.allVisitedNodes, mapGroupAstar, visitedMeshesAstar, () => {
                drawPath(resultAstar.fullPath, pathMeshesAstar); 
                animatePath(mapGroupAstar, pathMeshesAstar, () => {
                    addLabels(resultAstar.stopOrder, stopMarkersAstar, stopLabelsAstar);
                    if (!resultBfs.fullPath) setUIEnabled(true); // Re-enable if BFS failed
                });
            });
        } else {
            showMessage("No path found for A*!");
            if (!resultBfs.fullPath) setUIEnabled(true);
        }
        
        // --- VISUALIZE BFS ---
        if (resultBfs.fullPath && resultBfs.fullPath.length > 0) {
            animateVisitedNodes(resultBfs.allVisitedNodes, mapGroupBfs, visitedMeshesBfs, () => {
                drawPath(resultBfs.fullPath, pathMeshesBfs);
                animatePath(mapGroupBfs, pathMeshesBfs, () => {
                    addLabels(resultBfs.stopOrder, stopMarkersBfs, stopLabelsBfs);
                    setUIEnabled(true); // Re-enable UI
                    if (wasTutorialWaiting) nextTutorialStep();
                });
            });
        } else {
            showMessage("No path found for BFS!");
            setUIEnabled(true);
            if (wasTutorialWaiting && !resultAstar.fullPath) nextTutorialStep();
        }
        
        // --- Handle message box ---
        if(resultAstar.fullPath && resultBfs.fullPath) {
            showMessage(`A* Length: ${resultAstar.totalDistance} | BFS Length: ${resultBfs.totalDistance}`);
        } else if (resultAstar.fullPath) {
            showMessage(`A* Length: ${resultAstar.totalDistance} | BFS failed.`);
        } else if (resultBfs.fullPath) {
            showMessage(`A* failed. | BFS Length: ${resultBfs.totalDistance}`);
        } else {
            showMessage("Both algorithms failed to find a path!");
        }
        
    }, 10);
}

/**
 * Handles window resize.
 */
function onWindowResize() {
    const containerAstar = document.getElementById('canvas-container-astar');
    const widthAstar = containerAstar.clientWidth;
    const heightAstar = containerAstar.clientHeight;
    if (widthAstar > 0 && heightAstar > 0) {
        cameraAstar.aspect = widthAstar / heightAstar;
        cameraAstar.updateProjectionMatrix();
        rendererAstar.setSize(widthAstar, heightAstar);
        labelRendererAstar.setSize(widthAstar, heightAstar);
    }
    
    const containerBfs = document.getElementById('canvas-container-bfs');
    const widthBfs = containerBfs.clientWidth;
    const heightBfs = containerBfs.clientHeight;
    if (widthBfs > 0 && heightBfs > 0) {
        cameraBfs.aspect = widthBfs / heightBfs;
        cameraBfs.updateProjectionMatrix();
        rendererBfs.setSize(widthBfs, heightBfs);
        labelRendererBfs.setSize(widthBfs, heightBfs);
    }
}

// --- 3D MAP GENERATION ---

// --- MODIFIED: Redraw both maps ---
function redraw3DMap() {
    while (mapGroupAstar.children.length > 0) {
        mapGroupAstar.remove(mapGroupAstar.children[0]);
    }
    while (mapGroupBfs.children.length > 0) {
        mapGroupBfs.remove(mapGroupBfs.children[0]);
    }
    generate3DMap(mapGroupAstar);
    generate3DMap(mapGroupBfs);
    drawAllMarkers(); // MODIFIED
}

// --- MODIFIED: Accepts a mapGroup ---
function generate3DMap(mapGroup) {
    const offset_c = (GRID_COLS * CELL_SIZE) / 2 - CELL_SIZE / 2;
    const offset_r = (GRID_ROWS * CELL_SIZE) / 2 - CELL_SIZE / 2;
    
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const x = c * CELL_SIZE - offset_c;
            const z = r * CELL_SIZE - offset_r;

            let mesh;
            const type = gridData[r][c];

            if (type === 1) {
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
    drawAllMarkers(); // MODIFIED
}

// --- NEW: Helper functions for clearing/drawing in a specific scene ---

function clearMarkersForScene(startMarker, stopMarkers, stopLabels, mapGroup) {
    if (startMarker) {
        mapGroup.remove(startMarker);
    }
    stopMarkers.forEach(marker => mapGroup.remove(marker));
    stopLabels.forEach(label => {
        if(label.parent) {
            label.parent.remove(label);
        }
    });
    return { startMarker: null, stopMarkers: [], stopLabels: [] };
}

function clearAllMarkers() {
     let markers = clearMarkersForScene(startMarkerAstar, stopMarkersAstar, stopLabelsAstar, mapGroupAstar);
     startMarkerAstar = markers.startMarker;
     stopMarkersAstar = markers.stopMarkers;
     stopLabelsAstar = markers.stopLabels;
     
     markers = clearMarkersForScene(startMarkerBfs, stopMarkersBfs, stopLabelsBfs, mapGroupBfs);
     startMarkerBfs = markers.startMarker;
     stopMarkersBfs = markers.stopMarkers;
     stopLabelsBfs = markers.stopLabels;
}

function drawMarkersForScene(mapGroup) {
    let startMarker = null;
    let stopMarkers = [];
    
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
    return { startMarker, stopMarkers };
}

function drawAllMarkers() {
    clearAllMarkers();
    let markers = drawMarkersForScene(mapGroupAstar);
    startMarkerAstar = markers.startMarker;
    stopMarkersAstar = markers.stopMarkers;
    
    markers = drawMarkersForScene(mapGroupBfs);
    startMarkerBfs = markers.startMarker;
    stopMarkersBfs = markers.stopMarkers;
}

function clearPathForScene(pathMeshes, visitedMeshes, stopMarkers, stopLabels, mapGroup) {
    pathMeshes.forEach(mesh => mapGroup.remove(mesh));
    visitedMeshes.forEach(mesh => mapGroup.remove(mesh));
    stopLabels.forEach(label => {
        if(label.parent) {
            label.parent.remove(label);
        }
    });
    stopMarkers.forEach(marker => {
        marker.material = stopMaterial;
    });
    return { pathMeshes: [], visitedMeshes: [], stopLabels: [] };
}

function clearAllPaths() {
    let cleared = clearPathForScene(pathMeshesAstar, visitedMeshesAstar, stopMarkersAstar, stopLabelsAstar, mapGroupAstar);
    pathMeshesAstar = cleared.pathMeshes;
    visitedMeshesAstar = cleared.visitedMeshes;
    stopLabelsAstar = cleared.stopLabels;
    
    cleared = clearPathForScene(pathMeshesBfs, visitedMeshesBfs, stopMarkersBfs, stopLabelsBfs, mapGroupBfs);
    pathMeshesBfs = cleared.pathMeshes;
    visitedMeshesBfs = cleared.visitedMeshes;
    stopLabelsBfs = cleared.stopLabels;
}

// MODIFIED: Accepts pathMeshes array
function drawPath(fullPath, pathMeshes) {
    // Clear old meshes
    pathMeshes.splice(0, pathMeshes.length);
    
    const color = animatedPathMaterial; 

    for (let i = 1; i < fullPath.length - 1; i++) { 
        const node = fullPath[i];
        if (stopCoords.some(s => s.r === node.r && s.c === node.c)) continue;

        const mesh = new THREE.Mesh(pathNodeGeometry, color);
        const pos = get3DPos(node.r, node.c, PATH_HEIGHT + 0.05);
        mesh.position.set(pos.x, pos.y, pos.z);
        
        pathMeshes.push(mesh);
    }
}

// NEW: Helper to add labels
function addLabels(stopOrder, stopMarkers, stopLabels) {
    for (let i = 1; i < stopOrder.length; i++) {
        const stop = stopOrder[i];
        const orderNumber = i;
        const originalIndex = stopCoords.findIndex(s => s.r === stop.r && s.c === stop.c);
        
        if (originalIndex > -1 && stopMarkers[originalIndex]) {
            const markerMesh = stopMarkers[originalIndex];
            markerMesh.material = stopCompleteMaterial; // Set as complete

            const labelDiv = document.createElement('div');
            labelDiv.className = 'stop-label';
            labelDiv.textContent = `${orderNumber}`;
            const label = new CSS2DObject(labelDiv);
            label.position.set(0, 0.5, 0);
            markerMesh.add(label);
            stopLabels.push(label);
        }
    }
}

function showMessage(msg) {
    messageBox.textContent = msg;
}

/**
 * Animates the appearance of the "visited" nodes.
 * MODIFIED: Accepts mapGroup and visitedMeshes array
 */
function animateVisitedNodes(nodesSet, mapGroup, visitedMeshes, callback) {
    // Clear old meshes
    visitedMeshes.splice(0, visitedMeshes.length);

    let nodesArray = Array.from(nodesSet).map(key => {
        const [r, c] = key.split(',').map(Number);
        return { r, c };
    });

    let index = 0;
    // --- FIX 2: Slow down animation ---
    const batchSize = 2; // How many nodes to draw at once
    const delay = 30;     // Millisecond delay between batches (WAS 20)

    function animateBatch() { 
        for (let i = 0; i < batchSize && index < nodesArray.length; i++, index++) { 
            const node = nodesArray[index];

            if (startCoords && node.r === startCoords.r && node.c === startCoords.c) continue;
            if (stopCoords.some(s => s.r === node.r && s.c === node.c)) continue;

            const mesh = new THREE.Mesh(visitedNodeGeometry, visitedMaterial);
            const pos = get3DPos(node.r, node.c, PATH_HEIGHT + 0.01); 
            mesh.position.set(pos.x, pos.y, pos.z);
            mapGroup.add(mesh);
            visitedMeshes.push(mesh);
        }

        if (index < nodesArray.length) {
            // Use setTimeout for a controllable delay
            setTimeout(animateBatch, delay);
        } else {
            if (callback) callback();
        }
    }
    
    // Start the animation
    setTimeout(animateBatch, delay);
}

// --- NEW: Path Drawing Animation ---
let pathAnimationIndexAstar = 0;
let pathAnimationIndexBfs = 0;
    
// MODIFIED: Accepts mapGroup, pathMeshes array, and callback
function animatePath(mapGroup, pathMeshes, callback) {
    let index = 0;
    // --- FIX 2: Slow down animation ---
    const delay = 75; // Millisecond delay between path segments (WAS 50)

    function animatePathBatch() {
        // Batch size is 1
        if (index < pathMeshes.length) {
            const mesh = pathMeshes[index];
            mapGroup.add(mesh);
            index++;
        }

        if (index < pathMeshes.length) {
            // Use setTimeout for a controllable delay
            setTimeout(animatePathBatch, delay);
        } else {
            if (callback) callback();
        }
    }
    
    // Start the animation
    setTimeout(animatePathBatch, delay);
}
// --- End Path Drawing Animation ---

// --- ANIMATION FUNCTIONS ---

function setUIEnabled(enabled) {
    modeButtons.forEach(btn => btn.disabled = !enabled);
    findPathButton.disabled = !enabled;
    if (enabled) {
        editorContainer.classList.remove('disabled');
    } else {
        editorContainer.classList.add('disabled');
    }
}

// --- NEW: TUTORIAL FUNCTIONS (Heavily Modified) ---

function startTutorial() {
    clearAllMarkers();
    clearAllPaths();
    gridData.forEach(row => row.fill(0));
    redraw3DMap();
    startCoords = null;
    stopCoords = [];
    
    setMode('BUILD'); 
    
    currentTutorialStep = 0;
    isTutorialActive = true; 
    tutorialOverlay.style.display = 'block';
    tutorialStepBox.style.display = 'block';
    
    editorContainer.classList.add('disabled');
    
    showTutorialStep(0);
}

function endTutorial() {
    isTutorialActive = false; 
    currentTutorialWait = null; 
    tutorialOverlay.style.display = 'none';
    tutorialStepBox.style.display = 'none';
    
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
    editorContainer.classList.remove('disabled');
    setUIEnabled(true);
}

function nextTutorialStep() {
    // Update the step counter based on the modified tutorialSteps array
    const totalSteps = tutorialSteps.length;
    if (currentTutorialStep < totalSteps - 1) {
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
    if (tutorialClickListener) {
        tutorialClickListener.element.removeEventListener('click', tutorialClickListener.handler);
        tutorialClickListener = null;
    }
    
    if (highlightedElement) {
        highlightedElement.classList.remove('tutorial-highlight');
    }
    
    const step = tutorialSteps[index];
    currentTutorialWait = null; 
    const element = document.querySelector(step.element);
    
    if (!element) {
        console.warn(`Tutorial element not found: ${step.element}`);
        return;
    }
    
    element.classList.add('tutorial-highlight');
    highlightedElement = element;
    
    element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
    });

    tutorialTitle.textContent = step.title;
    tutorialText.textContent = step.text;
    // Update counter to reflect new total
    tutorialCounter.textContent = `${index + 1} / ${tutorialSteps.length}`;
    
    tutorialPrev.disabled = true;
    tutorialNext.disabled = true;
    
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

    if (step.demo) {
        await runTutorialDemo(step.demo);
        
        if (step.waitFor) {
            if (step.waitFor.type === 'click') {
                tutorialText.textContent = `Now, you click the highlighted button.`;
                const targetElement = document.querySelector(step.waitFor.element);
                if (targetElement) {
                    const handler = () => {
                        if (targetElement.dataset.mode) {
                            setMode(targetElement.dataset.mode);
                        }
                        if (targetElement.id === 'find-path-btn') {
                            onFindPathClick(); 
                        }
                        nextTutorialStep();
                    };
                    targetElement.addEventListener('click', handler, { once: true });
                    tutorialClickListener = { element: targetElement, handler: handler };
                }
            } else if (step.waitFor.type === 'custom') {
<<<<<<< HEAD
=======
                // --- MODIFIED: More descriptive text ---
>>>>>>> ab392d4471940dc1fbb1f5ec7cb65140d1bfa640
                if (step.waitFor.event === 'build') {
                    tutorialText.textContent = `Now you try it! Click or drag on any empty (dark grey) squares to build obstacles.`;
                } else if (step.waitFor.event === 'erase') {
                    tutorialText.textContent = `Now you try it! Click or drag on any building (white) squares to erase them.`;
                } else if (step.waitFor.event === 'set_start') {
                    tutorialText.textContent = `Now you try it! Click any empty (dark grey) square to place your Start point.`;
                } else {
                    tutorialText.textContent = `Now you try it on the grid. We'll wait...`;
                }
<<<<<<< HEAD
                
                currentTutorialWait = step.waitFor; 
                editorContainer.classList.remove('disabled'); 
=======
                // --- END MODIFIED ---
                
                currentTutorialWait = step.waitFor; // Now we wait for the user
                editorContainer.classList.remove('disabled'); // Enable grid for user
>>>>>>> ab392d4471940dc1fbb1f5ec7cb65140d1bfa640
            }
        } else {
            tutorialText.textContent = `Now you try it. Add as many stops as you like, then click "Next".`;
            tutorialNext.disabled = false; 
            editorContainer.classList.remove('disabled'); 
        }
        
        if (index > 0) tutorialPrev.disabled = false;

    } else {
        if (index > 0) tutorialPrev.disabled = false;
        
        if (!step.waitFor) {
            tutorialNext.disabled = false;
        } else if (step.waitFor.type === 'click') {
            const targetElement = document.querySelector(step.waitFor.element);
            if (targetElement) {
                const handler = () => {
                    if (targetElement.dataset.mode) {
                        setMode(targetElement.dataset.mode);
                    }
                    if (targetElement.id === 'find-path-btn') {
                        onFindPathClick(); 
                    }
                    nextTutorialStep();
                };
                targetElement.addEventListener('click', handler, { once: true });
                tutorialClickListener = { element: targetElement, handler: handler };
            }
        } else if (step.waitFor.type === 'custom') {
            currentTutorialWait = step.waitFor; 
            editorContainer.classList.remove('disabled'); 
        }
    }
}

// --- NEW: Tutorial Demo Functions ---

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function moveCursorTo(element) {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    demoCursor.style.transform = `translate(${x - 10}px, ${y - 3}px)`; 
    await sleep(500); 
}

async function moveCursorToCell(r, c) {
    if (!editorCells[r] || !editorCells[r][c]) return;
    const cell = editorCells[r][c];
    await moveCursorTo(cell);
}

async function demoClick(element, duration = 200) {
    await moveCursorTo(element);
    demoCursor.classList.add('mousedown');
    await sleep(duration);
    demoCursor.classList.remove('mousedown');
    await sleep(200);
}

async function demoDrag(r1, c1, r2, c2, val) {
    await moveCursorToCell(r1, c1);
    demoCursor.classList.add('mousedown');
    drawingValue = val; 
    applyDrawing(r1, c1); 
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
        
        await moveCursorToCell(r, c);
        applyDrawing(r,c); 
        await sleep(100); 
    }
    
    demoCursor.classList.remove('mousedown');
    redraw3DMap(); 
    await sleep(200);
}

async function runTutorialDemo(demoType) {
    demoCursor.style.display = 'block';
    await sleep(100);
    demoCursor.style.opacity = '1';
    
    demoCursor.style.transform = `translate(${window.innerWidth / 2}px, ${window.innerHeight / 2}px)`;
    await sleep(500);

    const midR = Math.floor(GRID_ROWS / 2);
    const midC = Math.floor(GRID_COLS / 2);

    switch (demoType) {
        case 'build':
            setMode('BUILD'); 
            await demoDrag(midR - 2, midC - 2, midR - 2, midC + 2, 1); 
            break;
        
        case 'erase':
            setMode('BUILD'); 
            await demoDrag(midR - 2, midC - 2, midR - 2, midC + 2, 0); 
            break;
        
        case 'click-set-start':
            await demoClick(document.getElementById('btn-start'));
            break;

        case 'place-start':
            setMode('SET_START'); 
            await demoClick(editorCells[midR][midC]);
            handlePathfindingClick(midR, midC); 
            break;

        case 'click-set-stop':
            await demoClick(document.getElementById('btn-stop'));
            break;

        case 'place-stops':
            setMode('SET_STOP'); 
            await demoClick(editorCells[midR - 3][midC]);
            handlePathfindingClick(midR - 3, midC); 
            await demoClick(editorCells[midR + 3][midC]);
            handlePathfindingClick(midR + 3, midC); 
            break;

        case 'click-find-path':
            await demoClick(document.getElementById('find-path-btn'));
            break;
    }

    demoCursor.style.opacity = '0';
    await sleep(300);
    demoCursor.style.display = 'none';
}

// --- END: Tutorial Demo Functions ---


// --- ANIMATION LOOP ---

function animate() {
    requestAnimationFrame(animate);
    
    // --- NEW: Update and render both scenes ---
    if (controlsAstar) controlsAstar.update();
    if (rendererAstar) rendererAstar.render(sceneAstar, cameraAstar);
    if (labelRendererAstar) labelRendererAstar.render(sceneAstar, cameraAstar);
    
    if (controlsBfs) controlsBfs.update();
    if (rendererBfs) rendererBfs.render(sceneBfs, cameraBfs);
    if (labelRendererBfs) labelRendererBfs.render(sceneBfs, cameraBfs);
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

    modal.style.display = 'none';
    init(rows, cols);

    if (localStorage.getItem('hasVisitedMapEditor') === 'true') {
        setTimeout(startTutorial, 500); 
    }
});
<<<<<<< HEAD

// --- Initial check in case modal is skipped by localstorage ---
if (document.getElementById('startup-modal').style.display === 'none') {
    let rows = parseInt(rowsInput.value);
    let cols = parseInt(colsInput.value);
    rows = Math.min(Math.max(rows, 5), 50);
    cols = Math.min(Math.max(cols, 5), 50);
    init(rows, cols);
}
=======
>>>>>>> ab392d4471940dc1fbb1f5ec7cb65140d1bfa640
