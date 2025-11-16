// Import A* function for distance calculation
import { findShortestPathAStar } from './pathfinder_astar.js';

// --- GA (TSP) Constants ---
const POPULATION_SIZE = 100;
const MAX_GENERATIONS = 150;
const MUTATION_RATE = 0.05; // 5% chance to swap two stops in an order
const TOURNAMENT_SIZE = 5;
const ELITISM_COUNT = 2; // Keep the top 2 best orders

/**
 * A* Distance Cache
 * We store the results of A* so we don't run it many times for the same two points.
 */
const distanceCache = new Map();

/**
 * Gets the A* path result between two points, using the cache.
 * @returns {object} The result from findShortestPathAStar { path, distance, visitedNodes }
 */
function getAStarResult(grid, a, b, GRID_ROWS, GRID_COLS) {
    // Create unique keys for cache
    const key1 = `${a.r},${a.c}:${b.r},${b.c}`;
    const key2 = `${b.r},${b.c}:${a.r},${a.c}`;

    if (distanceCache.has(key1)) {
        return distanceCache.get(key1);
    }
    if (distanceCache.has(key2)) {
        // Return reverse result if key2 exists (distance is the same)
        return distanceCache.get(key2);
    }

    // Not in cache, so run A* and store the result
    const result = findShortestPathAStar(grid, a, b, GRID_ROWS, GRID_COLS);
    distanceCache.set(key1, result);
    return result;
}

/**
 * Shuffles an array in place (Fisher-Yates).
 * @param {Array} array - The array to shuffle.
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Calculates the fitness (total distance) of a given order (chromosome).
 * @param {object} start - The start node {r, c}.
 * @param {Array<object>} targets - The full list of target nodes.
 * @param {Array<number>} order - An array of *indices*.
 * @returns {number} The total distance of this tour.
 */
function calculateFitness(grid, start, targets, order, GRID_ROWS, GRID_COLS) {
    let totalDistance = 0;
    
    // 1. Distance from Start to the first stop in the order
    let firstStop = targets[order[0]];
    const startToFirst = getAStarResult(grid, start, firstStop, GRID_ROWS, GRID_COLS);
    if (startToFirst.distance === Infinity) return Infinity;
    totalDistance += startToFirst.distance;

    // 2. Distance between all stops in the order
    for (let i = 0; i < order.length - 1; i++) {
        let stopA = targets[order[i]];
        let stopB = targets[order[i + 1]];
        const segment = getAStarResult(grid, stopA, stopB, GRID_ROWS, GRID_COLS);
        if (segment.distance === Infinity) return Infinity;
        totalDistance += segment.distance;
    }

    return totalDistance;
}

/**
 * Selects a parent using tournament selection.
 * @param {Array<object>} popWithFitness - Array of { order, fitness }.
* @returns {Array<number>} The winning order (chromosome).
 */
function tournamentSelection(popWithFitness) {
    let best = null;
    for (let i = 0; i < TOURNAMENT_SIZE; i++) {
        const randomIndividual = popWithFitness[Math.floor(Math.random() * popWithFitness.length)];
        if (best === null || randomIndividual.fitness < best.fitness) {
            best = randomIndividual;
        }
    }
    if (!best) {
         return popWithFitness[Math.floor(Math.random() * popWithFitness.length)].order;
    }
    return best.order;
}

/**
 * Performs Ordered Crossover (OX1).
 * @returns {Array<Array<number>>} A single new child (order).
 */
function crossover(parent1, parent2) {
    const len = parent1.length;
    
    const start = Math.floor(Math.random() * len);
    const end = Math.floor(Math.random() * (len - start)) + start;
    const child = new Array(len).fill(null);
    const slice = parent1.slice(start, end + 1);

    for (let i = start; i <= end; i++) {
        child[i] = parent1[i];
    }

    let parent2Index = 0;
    let childIndex = 0;
    const sliceSet = new Set(slice);
    
    while (childIndex < len) {
        if (childIndex >= start && childIndex <= end) {
            childIndex++;
            continue;
        }
        
        let item = parent2[parent2Index];
        while (sliceSet.has(item)) {
            parent2Index++;
            if(parent2Index >= parent2.length) {
                break; 
            }
            item = parent2[parent2Index];
        }

        if (parent2Index < parent2.length) {
            child[childIndex] = item;
        }
        
        childIndex++;
        parent2Index++;
    }
    
    const missingIndices = new Set(parent1);
    child.forEach(item => missingIndices.delete(item));
    
    let missingArray = Array.from(missingIndices);
    let missingIndex = 0;
    
    for(let i=0; i < child.length; i++) {
        if(child[i] === null) {
            if (missingIndex < missingArray.length) {
                child[i] = missingArray[missingIndex];
                missingIndex++;
            }
        }
    }

    return child;
}


/**
 * Mutates a chromosome using a "swap" mutation.
 */
function mutate(order) {
    if (Math.random() < MUTATION_RATE) {
        const i = Math.floor(Math.random() * order.length);
        const j = Math.floor(Math.random() * order.length);
        [order[i], order[j]] = [order[j], order[i]];
    }
}

/**
 * Main GA TSP Solver.
 * This finds the optimal order of stops, then constructs the path using A*
 * results from the cache.
 */
export function findMultiStopPathGA(grid, start, targets, GRID_ROWS, GRID_COLS) {
    distanceCache.clear();

    if (targets.length === 0) {
        return { fullPath: [start], stopOrder: [start], totalDistance: 0, allVisitedNodes: new Set() };
    }
    
    // --- 1. Pre-calculate all A* distances ---
    getAStarResult(grid, start, targets[0], GRID_ROWS, GRID_COLS);
    for (let i = 0; i < targets.length; i++) {
        getAStarResult(grid, start, targets[i], GRID_ROWS, GRID_COLS);
        for (let j = i + 1; j < targets.length; j++) {
            getAStarResult(grid, targets[i], targets[j], GRID_ROWS, GRID_COLS);
        }
    }

    // --- 2. Create Initial Population ---
    const baseOrder = targets.map((_, index) => index);
    let population = [];
    for (let i = 0; i < POPULATION_SIZE; i++) {
        population.push(shuffleArray([...baseOrder]));
    }

    let bestOverallOrder = null;
    let bestOverallFitness = Infinity;

    // --- 3. Run GA Generations ---
    for (let gen = 0; gen < MAX_GENERATIONS; gen++) {
        const popWithFitness = population.map(order => {
            const fitness = calculateFitness(grid, start, targets, order, GRID_ROWS, GRID_COLS);
            return { order, fitness };
        });

        const validPop = popWithFitness.filter(p => p.fitness !== Infinity);
        if (validPop.length === 0) {
            return { fullPath: null, stopOrder: [start], totalDistance: Infinity, allVisitedNodes: new Set() };
        }
        validPop.sort((a, b) => a.fitness - b.fitness);

        if (validPop[0].fitness < bestOverallFitness) {
            bestOverallFitness = validPop[0].fitness;
            bestOverallOrder = validPop[0].order;
        }

        // --- 4. Create New Population (Selection, Crossover, Mutation) ---
        const newPopulation = [];

        for (let i = 0; i < Math.min(ELITISM_COUNT, validPop.length); i++) {
            newPopulation.push(validPop[i].order);
        }
        
        while (newPopulation.length < POPULATION_SIZE) {
            const parent1 = tournamentSelection(validPop);
            const parent2 = tournamentSelection(validPop);

            const child = crossover(parent1, parent2);
            mutate(child);
            newPopulation.push(child);
        }
        population = newPopulation;
    }

    // --- 5. Reconstruct the Final Path ---
    if (!bestOverallOrder || bestOverallFitness === Infinity) {
        return { fullPath: null, stopOrder: [start], totalDistance: Infinity, allVisitedNodes: new Set() };
    }

    let fullPath = [start];
    let stopOrder = [start];
    let allVisitedNodes = new Set();
    let currentPos = start;

    for (const targetIndex of bestOverallOrder) {
        const nextStop = targets[targetIndex];
        const { path, visitedNodes } = getAStarResult(grid, currentPos, nextStop, GRID_ROWS, GRID_COLS);
        
        if (path === null) {
            return { fullPath: null, stopOrder, totalDistance: Infinity, allVisitedNodes };
        }

        fullPath.push(...path.slice(1));
        visitedNodes.forEach(nodeKey => allVisitedNodes.add(nodeKey));
        stopOrder.push(nextStop);
        currentPos = nextStop;
    }

    return { fullPath, stopOrder, totalDistance: bestOverallFitness, allVisitedNodes };
}