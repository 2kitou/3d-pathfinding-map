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
 * @returns {object} An object { path, distance, visitedNodes }
 */
export function findShortestPathAStar(grid, start, end, GRID_ROWS, GRID_COLS) {
    const openSet = []; 
    const closedSet = new Set();
    const visitedNodesOrder = []; 
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
            // Path found, reconstruct
            let path = [];
            let temp = current;
            let tempKey = currentKey;
            while (scores.get(tempKey).cameFrom) {
                path.push(temp);
                temp = scores.get(tempKey).cameFrom;
                tempKey = `${temp.r},${temp.c}`;
            }
            path.push(start);
            return { path: path.reverse(), distance: scores.get(currentKey).g, visitedNodes: visitedNodesOrder };
        }

        closedSet.add(currentKey);
        visitedNodesOrder.push(currentKey);

        const neighbors = [
            { r: current.r + 1, c: current.c }, { r: current.r - 1, c: current.c },
            { r: current.r, c: current.c + 1 }, { r: current.r, c: current.c - 1 },
        ];

        for (const neighbor of neighbors) {
            const nKey = `${neighbor.r},${neighbor.c}`;

            // Check if neighbor is valid
            if (neighbor.r < 0 || neighbor.r >= GRID_ROWS || 
                neighbor.c < 0 || neighbor.c >= GRID_COLS ||
                grid[neighbor.r][neighbor.c] === 1 ||
                closedSet.has(nKey)) {
                continue;
            }

            const currentScore = scores.get(currentKey);
            const tentativeGScore = (currentScore ? currentScore.g : Infinity) + 1;


            const existingScore = scores.get(nKey);
            
            if (!existingScore || tentativeGScore < existingScore.g) {
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
                        openSet[i].f = scores.get(nKey).f;
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
    return { path: null, distance: Infinity, visitedNodes: visitedNodesOrder };
}

/**
 * Finds the shortest multi-stop path (A* Nearest Neighbor).
 * @returns {object} An object { fullPath, stopOrder, totalDistance, allVisitedNodes }
 */
export function findMultiStopPath(grid, start, targets, GRID_ROWS, GRID_COLS) {
    let currentPos = start;
    let remainingTargets = [...targets];
    let fullPath = [start];
    let totalDistance = 0;
    let stopOrder = [start];
    let allVisitedNodes = new Set(); 

    while (remainingTargets.length > 0) {
        let bestNextTarget = null;
        let minDistance = Infinity;
        let shortestSegment = null;
        let segmentVisitedNodes = []; 

        // Find the *nearest* remaining target
        for (const target of remainingTargets) {
            const { path, distance, visitedNodes } = findShortestPathAStar(grid, currentPos, target, GRID_ROWS, GRID_COLS);
            
            if (path && distance < minDistance) {
                minDistance = distance;
                bestNextTarget = target;
                shortestSegment = path;
                segmentVisitedNodes = visitedNodes;
            }
        }

        if (bestNextTarget === null) {
            // No path found to any of the remaining targets
            return { fullPath: null, stopOrder, totalDistance: Infinity, allVisitedNodes };
        }

        segmentVisitedNodes.forEach(nodeKey => allVisitedNodes.add(nodeKey));

        fullPath.push(...shortestSegment.slice(1));
        totalDistance += minDistance;
        stopOrder.push(bestNextTarget);
        currentPos = bestNextTarget;
        // CORRECTED: Use r/c coordinates for reliable filtering of target objects
        remainingTargets = remainingTargets.filter(t => t.r !== bestNextTarget.r || t.c !== bestNextTarget.c);
    }

    return { fullPath, stopOrder, totalDistance, allVisitedNodes };
}