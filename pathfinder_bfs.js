/**
 * Finds the shortest path between two points using Breadth-First Search (BFS).
 * @param {Array<Array<number>>} grid - The 2D grid data.
 * @param {object} start - Start node {r, c}
 * @param {object} end - End node {r, c}
 * @param {number} GRID_ROWS - Total rows in the grid
 * @param {number} GRID_COLS - Total columns in the grid
 * @returns {object} An object { path, distance, visitedNodes }
 */
function findShortestPathBFS(grid, start, end, GRID_ROWS, GRID_COLS) {
    const queue = []; // This is our openSet, used as a FIFO queue
    const cameFrom = new Map(); // To reconstruct path
    const visited = new Set(); // This is our closedSet
    const visitedNodesOrder = []; // For animation

    const startKey = `${start.r},${start.c}`;
    queue.push(start);
    visited.add(startKey);
    cameFrom.set(startKey, null); // Start has no predecessor

    while (queue.length > 0) {
        const current = queue.shift(); // Get from the front (FIFO)
        const currentKey = `${current.r},${current.c}`;
        
        visitedNodesOrder.push(currentKey); // Add to animation list

        if (current.r === end.r && current.c === end.c) {
            // Path found, reconstruct
            let path = [];
            let temp = current;
            while (temp) {
                path.push(temp);
                const tempKey = `${temp.r},${temp.c}`;
                temp = cameFrom.get(tempKey);
            }
            path.reverse();
            return { path: path, distance: path.length - 1, visitedNodes: visitedNodesOrder };
        }

        const neighbors = [
            { r: current.r + 1, c: current.c }, { r: current.r - 1, c: current.c },
            { r: current.r, c: current.c + 1 }, { r: current.r, c: current.c - 1 },
        ];

        for (const neighbor of neighbors) {
            const nKey = `${neighbor.r},${neighbor.c}`;

            if (neighbor.r < 0 || neighbor.r >= GRID_ROWS || 
                neighbor.c < 0 || neighbor.c >= GRID_COLS ||
                grid[neighbor.r][neighbor.c] === 1 || // Is it an obstacle?
                visited.has(nKey)) { // Already visited?
                continue;
            }

            visited.add(nKey); // Mark as visited
            cameFrom.set(nKey, current); // Record path
            queue.push(neighbor); // Add to end of queue
        }
    }

    // No path found
    return { path: null, distance: Infinity, visitedNodes: visitedNodesOrder };
}

/**
 * Finds the shortest multi-stop path (BFS).
 * @returns {object} An object { fullPath, stopOrder, totalDistance, allVisitedNodes }
 */
export function findMultiStopPathBFS(grid, start, targets, GRID_ROWS, GRID_COLS) {
    let currentPos = start;
    let remainingTargets = [...targets];
    let fullPath = [start];
    let totalDistance = 0;
    let stopOrder = [start];
    let allVisitedNodes = new Set(); // Use a Set for unique nodes, preserves insertion order

    while (remainingTargets.length > 0) {
        let bestNextTarget = null;
        let minDistance = Infinity;
        let shortestSegment = null;
        let segmentVisitedNodes = []; // Array for animation order

        // Find the *nearest* remaining target using BFS
        for (const target of remainingTargets) {
            const { path, distance, visitedNodes } = findShortestPathBFS(grid, currentPos, target, GRID_ROWS, GRID_COLS); // <--- Call BFS

            if (path && distance < minDistance) {
                minDistance = distance;
                bestNextTarget = target;
                shortestSegment = path;
                segmentVisitedNodes = visitedNodes; // Store this segment's visited nodes
            }
        }

        if (bestNextTarget === null) {
            // No path found
            return { fullPath: null, stopOrder, totalDistance: Infinity, allVisitedNodes };
        }

        // Add the best segment's visited nodes (in order)
        segmentVisitedNodes.forEach(nodeKey => allVisitedNodes.add(nodeKey));

        // Add the best segment to our full path
        fullPath.push(...shortestSegment.slice(1));
        totalDistance += minDistance;
        stopOrder.push(bestNextTarget);
        currentPos = bestNextTarget;
        remainingTargets = remainingTargets.filter(t => t !== bestNextTarget);
    }

    return { fullPath, stopOrder, totalDistance, allVisitedNodes };
}