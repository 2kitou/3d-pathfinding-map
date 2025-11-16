// --- Import Pathfinding Logic ---
import { findMultiStopPath } from './pathfinder_astar.js';
import { findMultiStopPathBFS }from './pathfinder_bfs.js';
import { findMultiStopPathGA } from './pathfinder_ga.js'; // CORRECTED: Changed import name from pathfinder_gs.js

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
const stopCompleteMaterial = new THREE.MeshStandardMaterial({ color: 0x00E676, emissive: 0x00E676, emissiveIntensity: 0.8 });
const visitedMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x007bff, 
    emissive: 0x007bff, 
    emissiveIntensity: 0.4, 
    opacity: 0.6, 
    transparent: true 
});
const visitedMaterialGA = new THREE.MeshStandardMaterial({ 
    color: 0x9C27B0, // Purple
    emissive: 0x9C27B0, 
    emissiveIntensity: 0.4, 
    opacity: 0.6, 
    transparent: true 
});

const animatedPathMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x00BCD4, 
    emissive: 0x00BCD4, 
    emissiveIntensity: 0.7 
});

// --- Three sets of Three.js variables ---
let sceneAstar, cameraAstar, rendererAstar, controlsAstar, mapGroupAstar, labelRendererAstar;
let sceneBfs, cameraBfs, rendererBfs, controlsBfs, mapGroupBfs, labelRendererBfs;
let sceneGa, cameraGa, rendererGa, controlsGa, mapGroupGa, labelRendererGa;

let gridData = [];
let editorCells = [];

// Pathfinding State
let currentMode = "BUILD";
let startCoords = null;
let stopCoords = [];

// --- Scene-specific state ---
let startMarkerAstar = null, startMarkerBfs = null, startMarkerGa = null;
let stopMarkersAstar = [], stopMarkersBfs = [], stopMarkersGa = [];
let stopLabelsAstar = [], stopLabelsBfs = [], stopLabelsGa = [];
let pathMeshesAstar = [], pathMeshesBfs = [], pathMeshesGa = [];
let visitedMeshesAstar = [], visitedMeshesBfs = [], visitedMeshesGa = [];

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
let currentTutorialWait = null;
let tutorialClickListener = null;

const tutorialSteps = [
    {
        element: '#grid-editor-container',
        title: 'Welcome! The 2D Grid',
        text: 'This is the 2D "Pixel Block" Editor. We will build our map here. Click "Next".',
        waitFor: null
    },
    {
        element: '#grid-editor-container',
        title: '1. Build Obstacles',
        text: 'First, watch this demo on how to "paint" buildings.',
        demo: 'build',
        waitFor: { type: 'custom', event: 'build' }
    },
    {
        element: '#grid-editor-container',
        title: 'Erase Obstacles',
        text: 'Great! Now, watch how to "erase" buildings.',
        demo: 'erase',
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
        text: 'Watch this demo of placing the Start point.',
        demo: 'place-start',
        waitFor: { type: 'custom', event: 'set_start' }
    },
    {
        element: '#btn-stop',
        title: '3. Add Checkpoints',
        text: 'Click the "Add/Remove Checkpoint" button to enter checkpoint placement mode.', 
        waitFor: { type: 'click', element: '#btn-stop' }
    },
    {
        element: '#grid-editor-container',
        title: 'Place Checkpoints',
        text: 'You can add multiple checkpoints. Watch this demo. Click "Next" when you\'re ready to try.',
        demo: 'place-checkpoints',
        waitFor: null
    },
    {
        element: '#find-path-btn',
        title: '4. Find Route!',
        text: 'Great! Now, click the "Find Route" button to see all three algorithms run.', 
        waitFor: { type: 'click', element: '#find-path-btn' }
    },
    {
        element: '.visualization-container',
        title: 'All Done!',
        text: 'Watch the animations! A*/BFS use a simple "Nearest Neighbor" logic. GA tries to find a smarter *order* to visit the stops (TSP).',
        waitFor: null
    }
];


// --- INITIALIZATION ---

function init(rows, cols, loadedGrid = null) {
    GRID_ROWS = rows;
    GRID_COLS = cols;

    if (loadedGrid) {
        gridData = loadedGrid.map(row => [...row]);
    } else {
        createGridData();
    }
    
    createEditorUI();
    
    initThreeJS();
    
    generate3DMap(mapGroupAstar);
    generate3DMap(mapGroupBfs);
    generate3DMap(mapGroupGa);
    
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
            endTutorial();
        }
    });
    // --- End Tutorial Listeners ---

    // --- Comparison Modal Listeners ---
    const comparisonModal = document.getElementById('comparison-modal');
    const closeComparisonBtn = document.getElementById('close-comparison-btn');
    
    closeComparisonBtn.addEventListener('click', () => {
        comparisonModal.style.display = 'none';
    });
    
    comparisonModal.addEventListener('click', (e) => {
        if (e.target.id === 'comparison-modal') {
            comparisonModal.style.display = 'none';
        }
    });
    // --- End Comparison Modal Listeners ---

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
    editorContainer.innerHTML = '';
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

// --- Generic scene creator ---
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

// --- Init all three scenes ---
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
    
    // GA Scene
    const canvasGa = document.getElementById('three-canvas-ga');
    const labelContainerGa = document.getElementById('label-container-ga');
    const sceneGaData = createScene(canvasGa, labelContainerGa);
    sceneGa = sceneGaData.scene;
    cameraGa = sceneGaData.camera;
    rendererGa = sceneGaData.renderer;
    controlsGa = sceneGaData.controls;
    mapGroupGa = sceneGaData.mapGroup;
    labelRendererGa = sceneGaData.labelRenderer;

    // --- Auto-fit camera ---
    const maxDim = Math.max(GRID_ROWS, GRID_COLS) * CELL_SIZE;
    const fov = 40; 
    const distance = (maxDim / 2) / Math.tan(THREE.MathUtils.degToRad(fov / 2));
    
    const camZ = Math.max(distance * 1.8, 15); 
    const camY = Math.max(distance * 2.1, 19); 

    cameraAstar.position.set(0, camY, camZ);
    cameraBfs.position.set(0, camY, camZ);
    cameraGa.position.set(0, camY, camZ);
    
    // --- Sync Controls ---
    let isSyncing = false;
    const syncControls = (sourceControls, targetControls1, targetControls2) => {
         if (isSyncing) return;
         isSyncing = true;
         targetControls1.object.position.copy(sourceControls.object.position);
         targetControls1.object.quaternion.copy(sourceControls.object.quaternion);
         targetControls1.target.copy(sourceControls.target);
         targetControls1.update();
         
         targetControls2.object.position.copy(sourceControls.object.position);
         targetControls2.object.quaternion.copy(sourceControls.object.quaternion);
         targetControls2.target.copy(sourceControls.target);
         targetControls2.update();
         isSyncing = false;
    };

    controlsAstar.addEventListener('change', () => syncControls(controlsAstar, controlsBfs, controlsGa));
    controlsBfs.addEventListener('change', () => syncControls(controlsBfs, controlsAstar, controlsGa));
    controlsGa.addEventListener('change', () => syncControls(controlsGa, controlsAstar, controlsBfs));
    // --- End Sync Controls ---

    window.addEventListener('resize', onWindowResize);
    onWindowResize(); 
}

// --- EVENT HANDLERS ---

function onGridMouseDown(event) {
    if (isTutorialActive) {
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
        if (step.demo === 'place-checkpoints' && currentMode === 'SET_CHECKPOINT') {
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
    clearAllPaths();
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
        clearAllMarkers();
    }
    let stopIndex = stopCoords.findIndex(stop => stop.r === r && stop.c === c);
    if (stopIndex > -1) {
        stopCoords.splice(stopIndex, 1);
        clearAllMarkers();
    }

    if (currentMode === "SET_START") {
        if (gridData[r][c] === 1) {
            showMessage("Cannot place Start on an obstacle!");
            return;
        }
        startCoords = { r, c };
    } 
    else if (currentMode === "SET_CHECKPOINT") {
        if (gridData[r][c] === 1) {
            showMessage("Cannot place Checkpoint on an obstacle!");
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
    if (isTutorialActive && currentTutorialWait) {
        if (currentTutorialWait.type === 'click' && currentTutorialWait.element === '#find-path-btn') {
            wasTutorialWaiting = true;
        }
    }
    
    clearAllPaths();

    if (!startCoords || stopCoords.length === 0) {
        showMessage("Please set a Start and at least one Checkpoint.");
        return;
    }

    showMessage("Calculating routes... (GA may take a moment)");
    setUIEnabled(false);
    
    let algorithmsFinished = 0;
    const totalAlgorithms = 3;
    
    let results = { astar: null, bfs: null, ga: null };
    let perf = { astar: {}, bfs: {}, ga: {} };
    
    const onAlgoDone = () => {
        algorithmsFinished++;
        if (algorithmsFinished === totalAlgorithms) {
            setUIEnabled(true);
            if (wasTutorialWaiting) nextTutorialStep();
            showComparisonPopup(results);
        }
    };
    
    const updateMessage = () => {
        let msg = "";
        if (results.astar) msg += `A*: ${results.astar.totalDistance ? results.astar.totalDistance.toFixed(0) : 'Failed'} | `;
        if (results.bfs) msg += `BFS: ${results.bfs.totalDistance ? results.bfs.totalDistance.toFixed(0) : 'Failed'} | `;
        if (results.ga) msg += `GA: ${results.ga.totalDistance ? results.ga.totalDistance.toFixed(0) : 'Failed'}`;
        showMessage(msg.replace(/ \|\s*$/, ""));
    };

    setTimeout(() => {
        // --- RUN A* ---
        perf.astar.start = performance.now();
        const resultAstar = findMultiStopPath(gridData, startCoords, stopCoords, GRID_ROWS, GRID_COLS);
        perf.astar.end = performance.now();
        results.astar = resultAstar;
        results.astar.time = perf.astar.end - perf.astar.start;

        if (resultAstar.fullPath && resultAstar.fullPath.length > 0) {
            animateVisitedNodes(resultAstar.allVisitedNodes, mapGroupAstar, visitedMeshesAstar, visitedMaterial, () => {
                drawPath(resultAstar.fullPath, pathMeshesAstar); 
                animatePath(mapGroupAstar, pathMeshesAstar, () => {
                    addLabels(resultAstar.stopOrder, stopMarkersAstar, stopLabelsAstar);
                    onAlgoDone();
                });
            });
        } else {
            onAlgoDone();
        }
        
        // --- RUN BFS ---
        perf.bfs.start = performance.now();
        const resultBfs = findMultiStopPathBFS(gridData, startCoords, stopCoords, GRID_ROWS, GRID_COLS);
        perf.bfs.end = performance.now();
        results.bfs = resultBfs;
        results.bfs.time = perf.bfs.end - perf.bfs.start;
        
        if (resultBfs.fullPath && resultBfs.fullPath.length > 0) {
            animateVisitedNodes(resultBfs.allVisitedNodes, mapGroupBfs, visitedMeshesBfs, visitedMaterial, () => {
                drawPath(resultBfs.fullPath, pathMeshesBfs);
                animatePath(mapGroupBfs, pathMeshesBfs, () => {
                    addLabels(resultBfs.stopOrder, stopMarkersBfs, stopLabelsBfs);
                    onAlgoDone();
                });
            });
        } else {
            onAlgoDone();
        }
        
        // --- RUN GA ---
        setTimeout(() => {
            perf.ga.start = performance.now();
            const resultGa = findMultiStopPathGA(gridData, startCoords, stopCoords, GRID_ROWS, GRID_COLS);
            perf.ga.end = performance.now();
            results.ga = resultGa;
            results.ga.time = perf.ga.end - perf.ga.start;

            if (resultGa.fullPath && resultGa.fullPath.length > 0) {
                animateVisitedNodes(resultGa.allVisitedNodes, mapGroupGa, visitedMeshesGa, visitedMaterialGA, () => {
                    drawPath(resultGa.fullPath, pathMeshesGa);
                    animatePath(mapGroupGa, pathMeshesGa, () => {
                        addLabels(resultGa.stopOrder, stopMarkersGa, stopLabelsGa);
                        onAlgoDone();
                    });
                });
            } else {
                onAlgoDone();
            }
            updateMessage();
        }, 20);
        
        updateMessage();
        
    }, 10);
}

// --- Comparison Popup Function ---
function showComparisonPopup(results) {
    const modal = document.getElementById('comparison-modal');

    // --- A* Results ---
    const astarQuality = document.getElementById('astar-quality');
    const astarTime = document.getElementById('astar-time');
    const astarMemory = document.getElementById('astar-memory');
    const astarSuccess = document.getElementById('astar-success');
    
    if (results.astar && results.astar.totalDistance !== Infinity) {
        astarQuality.textContent = results.astar.totalDistance.toFixed(0);
        astarTime.textContent = results.astar.time.toFixed(2);
        astarMemory.textContent = results.astar.allVisitedNodes.size;
        astarSuccess.textContent = "Found Path";
    } else {
        astarQuality.textContent = "Failed";
        astarTime.textContent = results.astar?.time ? results.astar.time.toFixed(2) : 'N/A';
        astarMemory.textContent = results.astar?.allVisitedNodes ? results.astar.allVisitedNodes.size : 'N/A';
        astarSuccess.textContent = "Failed";
    }

    // --- BFS Results ---
    const bfsQuality = document.getElementById('bfs-quality');
    const bfsTime = document.getElementById('bfs-time');
    const bfsMemory = document.getElementById('bfs-memory');
    const bfsSuccess = document.getElementById('bfs-success');

    if (results.bfs && results.bfs.totalDistance !== Infinity) {
        bfsQuality.textContent = results.bfs.totalDistance.toFixed(0);
        bfsTime.textContent = results.bfs.time.toFixed(2);
        bfsMemory.textContent = results.bfs.allVisitedNodes.size;
        bfsSuccess.textContent = "Found Path";
    } else {
        bfsQuality.textContent = "Failed";
        bfsTime.textContent = results.bfs?.time ? results.bfs.time.toFixed(2) : 'N/A';
        bfsMemory.textContent = results.bfs?.allVisitedNodes ? results.bfs.allVisitedNodes.size : 'N/A';
        bfsSuccess.textContent = "Failed";
    }

    // --- GA Results ---
    const gaQuality = document.getElementById('ga-quality');
    const gaTime = document.getElementById('ga-time');
    const gaMemory = document.getElementById('ga-memory');
    const gaSuccess = document.getElementById('ga-success');

    if (results.ga && results.ga.totalDistance !== Infinity) {
        gaQuality.textContent = results.ga.totalDistance.toFixed(0);
        gaTime.textContent = results.ga.time.toFixed(2);
        gaMemory.textContent = results.ga.allVisitedNodes.size;
        gaSuccess.textContent = "Found Path";
    } else {
        gaQuality.textContent = "Failed";
        gaTime.textContent = results.ga?.time ? results.ga.time.toFixed(2) : 'N/A';
        gaMemory.textContent = results.ga?.allVisitedNodes ? results.ga.allVisitedNodes.size : 'N/A';
        gaSuccess.textContent = "Failed";
    }
    
    modal.style.display = 'flex';
}
// --- End Comparison Popup Function ---


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
    
    const containerGa = document.getElementById('canvas-container-ga');
    const widthGa = containerGa.clientWidth;
    const heightGa = containerGa.clientHeight;
    if (widthGa > 0 && heightGa > 0) {
        cameraGa.aspect = widthGa / heightGa;
        cameraGa.updateProjectionMatrix();
        rendererGa.setSize(widthGa, heightGa);
        labelRendererGa.setSize(widthGa, heightGa);
    }
}

// --- 3D MAP GENERATION ---

function redraw3DMap() {
    while (mapGroupAstar.children.length > 0) {
        mapGroupAstar.remove(mapGroupAstar.children[0]);
    }
    while (mapGroupBfs.children.length > 0) {
        mapGroupBfs.remove(mapGroupBfs.children[0]);
    }
    while (mapGroupGa.children.length > 0) {
        mapGroupGa.remove(mapGroupGa.children[0]);
    }
    generate3DMap(mapGroupAstar);
    generate3DMap(mapGroupBfs);
    generate3DMap(mapGroupGa);
    drawAllMarkers(); 
}

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
    drawAllMarkers();
}

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
     
     markers = clearMarkersForScene(startMarkerGa, stopMarkersGa, stopLabelsGa, mapGroupGa);
     startMarkerGa = markers.startMarker;
     stopMarkersGa = markers.stopMarkers;
     stopLabelsGa = markers.stopLabels;
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
    stopCoords.forEach((stop) => {
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
    
    markers = drawMarkersForScene(mapGroupGa);
    startMarkerGa = markers.startMarker;
    stopMarkersGa = markers.stopMarkers;
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
    
    cleared = clearPathForScene(pathMeshesGa, visitedMeshesGa, stopMarkersGa, stopLabelsGa, mapGroupGa);
    pathMeshesGa = cleared.pathMeshes;
    visitedMeshesGa = cleared.visitedMeshes;
    stopLabelsGa = cleared.stopLabels;
}

function drawPath(fullPath, pathMeshes) {
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

function addLabels(stopOrder, stopMarkers, stopLabels) {
    for (let i = 1; i < stopOrder.length; i++) {
        const stop = stopOrder[i];
        const orderNumber = i;
        const originalIndex = stopCoords.findIndex(s => s.r === stop.r && s.c === stop.c);
        
        if (originalIndex > -1 && stopMarkers[originalIndex]) {
            const markerMesh = stopMarkers[originalIndex];
            markerMesh.material = stopCompleteMaterial;

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
 */
function animateVisitedNodes(nodesSet, mapGroup, visitedMeshes, material, callback) {
    visitedMeshes.splice(0, visitedMeshes.length);

    let nodesArray = Array.from(nodesSet).map(key => {
        const [r, c] = key.split(',').map(Number);
        return { r, c };
    });

    let index = 0;
    const batchSize = 2; 
    const delay = 30;     

    function animateBatch() { 
        for (let i = 0; i < batchSize && index < nodesArray.length; i++, index++) { 
            const node = nodesArray[index];

            if (startCoords && node.r === startCoords.r && node.c === startCoords.c) continue;
            if (stopCoords.some(s => s.r === node.r && s.c === node.c)) continue;

            const mesh = new THREE.Mesh(visitedNodeGeometry, material);
            const pos = get3DPos(node.r, node.c, PATH_HEIGHT + 0.01); 
            mesh.position.set(pos.x, pos.y, pos.z);
            mapGroup.add(mesh);
            visitedMeshes.push(mesh);
        }

        if (index < nodesArray.length) {
            setTimeout(animateBatch, delay);
        } else {
            if (callback) callback();
        }
    }
    
    setTimeout(animateBatch, delay);
}

/**
 * Path Drawing Animation.
 */
function animatePath(mapGroup, pathMeshes, callback) {
    let index = 0;
    const delay = 75; 

    function animatePathBatch() {
        if (index < pathMeshes.length) {
            const mesh = pathMeshes[index];
            mapGroup.add(mesh);
            index++;
        }

        if (index < pathMeshes.length) {
            setTimeout(animatePathBatch, delay);
        } else {
            if (callback) callback();
        }
    }
    
    setTimeout(animatePathBatch, delay);
}

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

// --- TUTORIAL FUNCTIONS ---

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
                if (step.waitFor.event === 'build') {
                    tutorialText.textContent = `Now you try it! Click or drag on any empty (dark grey) squares to build obstacles.`;
                } else if (step.waitFor.event === 'erase') {
                    tutorialText.textContent = `Now you try it! Click or drag on any building (white) squares to erase them.`;
                } else if (step.waitFor.event === 'set_start') {
                    tutorialText.textContent = `Now you try it! Click any empty (dark grey) square to place your Start point.`;
                } else {
                    tutorialText.textContent = `Now you try it on the grid. We'll wait...`;
                }
                
                currentTutorialWait = step.waitFor; 
                editorContainer.classList.remove('disabled'); 
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

// --- Tutorial Demo Functions ---

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

        case 'click-set-checkpoint':
            await demoClick(document.getElementById('btn-stop'));
            break;

        case 'place-checkpoints':
            setMode('SET_CHECKPOINT'); 
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

// --- ANIMATION LOOP ---

function animate() {
    requestAnimationFrame(animate);
    
    if (controlsAstar) controlsAstar.update();
    if (rendererAstar) rendererAstar.render(sceneAstar, cameraAstar);
    if (labelRendererAstar) labelRendererAstar.render(sceneAstar, cameraAstar);
    
    if (controlsBfs) controlsBfs.update();
    if (rendererBfs) rendererBfs.render(sceneBfs, cameraBfs);
    if (labelRendererBfs) labelRendererBfs.render(sceneBfs, cameraBfs);
    
    if (controlsGa) controlsGa.update();
    if (rendererGa) rendererGa.render(sceneGa, cameraGa);
    if (labelRendererGa) labelRendererGa.render(sceneGa, cameraGa);
}

// --- START ---

const modal = document.getElementById('startup-modal');
const startBtn = document.getElementById('start-btn');
const rowsInput = document.getElementById('input-rows');
const colsInput = document.getElementById('input-cols');

// Listener for custom grid
startBtn.addEventListener('click', () => {
    let rows = parseInt(rowsInput.value);
    let cols = parseInt(colsInput.value);
    rows = Math.min(Math.max(rows, 5), 50);
    cols = Math.min(Math.max(cols, 5), 50);

    modal.style.display = 'none';
    // Initializes a clean grid since loadedGrid is null/undefined
    init(rows, cols); 

    if (localStorage.getItem('hasVisitedMapEditor') === 'true') {
        setTimeout(startTutorial, 500); 
    }
});

// --- Initial check in case modal is skipped by localstorage ---
if (document.getElementById('startup-modal').style.display === 'none') {
    let rows = parseInt(rowsInput.value);
    let cols = parseInt(colsInput.value);
    rows = Math.min(Math.max(rows, 5), 50);
    cols = Math.min(Math.max(cols, 5), 50);
    // Initializes a clean grid since loadedGrid is null/undefined
    init(rows, cols);
}