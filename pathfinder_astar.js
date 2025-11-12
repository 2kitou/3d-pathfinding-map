/**
 * A* Pathfinding Algorithm Module
 * * Exports a function to find the optimal multi-stop path using a greedy
 * approach combined with the A* (A-star) algorithm.
 */

/**
 * Calculates the Manhattan distance heuristic.
 * @param {object} a - First node {r, c}
 * @param {object} b - Second node {r, c}
 * @returns {number} The Manhattan distance
 */
function heuristic(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

/**
 * Finds the shortest path between two points using the A* algorithm.
 * @param {Array<Array<number>>} grid - The 2D grid data.
 * @param {object} start - Start node {r, c}
 * @param {object} end - End node {r, c}
 * @param {number} GRID_ROWS - Total rows in the grid
 * @param {number} GRID_COLS - Total columns in the grid
 * @returns {object} An object { path, distance }
 */
function findShortestPathAStar(grid, start, end, GRID_ROWS, GRID_COLS) {
    const openSet = []; 
    const closedSet = new Set();
    const scores = new Map(); 
    
    const startKey = `${start.r},${start.c}`;
    scores.set(startKey, { g: 0, f: heuristic(start, end), cameFrom: null });
    openSet.push({ ...start, f: scores.get(startKey).f });

    while (openSet.length > 0) {
        let lowestFIndex = 0;
        for (let i = 1; i < openSet.length; i++) {
            if (openSet[i].f < openSet[lowestFIndex].f) {
                lowestFIndex = i;
            }
        }
        
        const current = openSet.splice(lowestFIndex, 1)[0];
        const currentKey = `${current.r},${current.c}`;

        if (current.r === end.r && current.c === end.c) {
            // Path found! Reconstruct it.
            const path = [];
            let temp = current;
            let tempKey = currentKey;
            while (temp) {
                path.push({ r: temp.r, c: temp.c });
                const cameFromNode = scores.get(tempKey).cameFrom;
                temp = cameFromNode;
                if(temp) tempKey = `${temp.r},${temp.c}`;
            }
            return { path: path.reverse(), distance: scores.get(currentKey).g };
        }

        closedSet.add(currentKey);

        const neighbors = [
            { r: current.r + 1, c: current.c }, { r: current.r - 1, c: current.c },
            { r: current.r, c: current.c + 1 }, { r: current.r, c: current.c - 1 },
        ];

        for (const neighbor of neighbors) {
            const nKey = `${neighbor.r},${neighbor.c}`;

            // Check if neighbor is valid
            if (neighbor.r < 0 || neighbor.r >= GRID_ROWS || 
                neighbor.c < 0 || neighbor.c >= GRID_COLS ||
                grid[neighbor.r][neighbor.c] === 1 || // Is it an obstacle?
                closedSet.has(nKey)) {
                continue;
            }

            const tentativeGScore = scores.get(currentKey).g + 1;

            if (!scores.has(nKey) || tentativeGScore < scores.get(nKey).g) {
                // This is a better path to this neighbor
                scores.set(nKey, {
                    g: tentativeGScore,
                    f: tentativeGScore + heuristic(neighbor, end),
                    cameFrom: current
                });

                // Add to open set if not already there
                let inOpenSet = false;
                for(let i=0; i < openSet.length; i++) {
                    if(openSet[i].r === neighbor.r && openSet[i].c === neighbor.c) {
                        inOpenSet = true;
                        openSet[i].f = scores.get(nKey).f; // Update f-score
                        break;
                    }
                }
                if (!inOpenSet) {
                    openSet.push({ ...neighbor, f: scores.get(nKey).f });
                }
            }
        }
    }

    // No path found
    return { path: null, distance: Infinity };
}

/**
 * Finds the shortest multi-stop path using a greedy approach.
 * It finds the A* path to the *nearest* remaining target.
 * @param {Array<Array<number>>} grid - The 2D grid data.
 * @param {object} start - Start node {r, c}
 * @param {Array<object>} targets - Array of stop nodes [{r, c}, ...]
 * @param {number} GRID_ROWS - Total rows in the grid
 * @param {number} GRID_COLS - Total columns in the grid
 * @returns {object} An object { fullPath, stopOrder, totalDistance }
 */
export function findMultiStopPath(grid, start, targets, GRID_ROWS, GRID_COLS) {
    let currentPos = start;
    let remainingTargets = [...targets];
    let fullPath = [start];
    let totalDistance = 0;
    let stopOrder = [start];

    while (remainingTargets.length > 0) {
        let bestNextTarget = null;
        let minDistance = Infinity;
        let shortestSegment = null;

        // Find the *nearest* remaining target
        for (const target of remainingTargets) {
            const { path, distance } = findShortestPathAStar(grid, currentPos, target, GRID_ROWS, GRID_COLS);
            if (path && distance < minDistance) {
                minDistance = distance;
                bestNextTarget = target;
                shortestSegment = path;
            }
        }

        if (bestNextTarget === null) {
            // No path found to any of the remaining targets
            return { fullPath: null, stopOrder, totalDistance: Infinity };
        }

        // Add the best segment to our full path
        fullPath.push(...shortestSegment.slice(1)); // .slice(1) to avoid duplicating nodes
        totalDistance += minDistance;
        stopOrder.push(bestNextTarget);
        currentPos = bestNextTarget;
        remainingTargets = remainingTargets.filter(t => t !== bestNextTarget);
    }

    return { fullPath, stopOrder, totalDistance };
}