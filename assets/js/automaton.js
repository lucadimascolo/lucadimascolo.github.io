const canvas = document.getElementById('automaton');
const ctx = canvas.getContext('2d');

const cellSize = 8;
const fadeSpeed = 0.05;
let cols, rows;
let grid, nextState, opacity;
let exclusionZone = { x1: 0, y1: 0, x2: 0, y2: 0 };

// Store noise values per cell for consistent boundary randomness
let boundaryNoise = [];
let marginNoise = [];

const minMargin =  0;
const maxMargin =  cellSize * 20;

function initBoundaryNoise() {
    boundaryNoise = new Array(cols).fill(null).map(() =>
        new Array(rows).fill(null).map(() => Math.random())
    );
    marginNoise = new Array(cols).fill(null).map(() =>
        new Array(rows).fill(null).map(() => minMargin + Math.random() * (maxMargin - minMargin))
    );
}

function inExclusionZone(x, y) {
    const px = x * cellSize;
    const py = y * cellSize;

    // Get per-cell margin from noise (varies from point to point)
    const margin = marginNoise[x]?.[y] ?? (minMargin + Math.random() * (maxMargin - minMargin));

    // Check if clearly inside the core zone (with max margin for safety)
    const inCore = px >= exclusionZone.x1 + maxMargin && px <= exclusionZone.x2 - maxMargin &&
                   py >= exclusionZone.y1 + maxMargin && py <= exclusionZone.y2 - maxMargin;
    if (inCore) return true;

    // Check if clearly outside the extended zone
    const inExtended = px >= exclusionZone.x1 - maxMargin && px <= exclusionZone.x2 + maxMargin &&
                       py >= exclusionZone.y1 - maxMargin && py <= exclusionZone.y2 + maxMargin;
    if (!inExtended) return false;

    // In the boundary region - use noise to create irregular edges
    const noise = boundaryNoise[x]?.[y] ?? Math.random();

    // Calculate distance from each edge
    const distLeft = px - exclusionZone.x1;
    const distRight = exclusionZone.x2 - px;
    const distTop = py - exclusionZone.y1;
    const distBottom = exclusionZone.y2 - py;

    // Find minimum distance to any edge
    const minDist = Math.min(
        Math.abs(distLeft),
        Math.abs(distRight),
        Math.abs(distTop),
        Math.abs(distBottom)
    );

    // Probability of being in zone decreases near edges, using per-cell margin
    if (minDist < margin) {
        const probability = minDist / margin;
        return noise < probability;
    }

    return px >= exclusionZone.x1 && px <= exclusionZone.x2 &&
           py >= exclusionZone.y1 && py <= exclusionZone.y2;
}

function initGrid() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    cols = Math.ceil(canvas.width / cellSize);
    rows = Math.ceil(canvas.height / cellSize);

    // Define exclusion zone (centered, with padding)
    const zoneWidth = 580;
    const zoneHeight = 350;
    const padding = 40;
    exclusionZone = {
        x1: (canvas.width  - zoneWidth)  / 2 - padding,
        y1: (canvas.height - zoneHeight) / 2 ,
        x2: (canvas.width  + zoneWidth)  / 2 + padding,
        y2: (canvas.height + zoneHeight) / 2 + padding
    };

    initBoundaryNoise();

    grid = new Array(cols).fill(null).map((_, x) =>
        new Array(rows).fill(null).map((_, y) =>
            inExclusionZone(x, y) ? 0 : (Math.random() < 0.2 ? 1 : 0)
        )
    );
    nextState = new Array(cols).fill(null).map(() => new Array(rows).fill(0));
    opacity = new Array(cols).fill(null).map((_, x) =>
        new Array(rows).fill(null).map((_, y) => grid[x][y])
    );
}

function countNeighbors(x, y) {
    let count = 0;
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue;
            const nx = (x + i + cols) % cols;
            const ny = (y + j + rows) % rows;
            count += grid[nx][ny];
        }
    }
    return count;
}

function countActive() {
    let count = 0;
    for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
            count += grid[x][y];
        }
    }
    return count;
}

function update() {
    const total = cols * rows;
    const active = countActive();
    const ratio = active / total;

    const decayChance = Math.max(0, (ratio - 0.2) * 0.5);
    const birthChance = ratio < 0.05 ? 1 : Math.max(0.3, 1 - ratio * 2);

    for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
            // Force cells in exclusion zone to die
            if (inExclusionZone(x, y)) {
                nextState[x][y] = 0;
                continue;
            }

            const n = countNeighbors(x, y);

            if (grid[x][y] === 1) {
                if (Math.random() < decayChance) {
                    nextState[x][y] = 0;
                } else {
                    nextState[x][y] = (n >= 3) ? 1 : 0;
                }
            } else {
                if (n === 3 && Math.random() < birthChance) {
                    nextState[x][y] = 1;
                } else {
                    nextState[x][y] = 0;
                }
            }
        }
    }
    [grid, nextState] = [nextState, grid];
}

function updateOpacity() {
    for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
            const target = grid[x][y];
            if (opacity[x][y] < target) {
                opacity[x][y] = Math.min(1, opacity[x][y] + fadeSpeed);
            } else if (opacity[x][y] > target) {
                opacity[x][y] = Math.max(0, opacity[x][y] - fadeSpeed);
            }
        }
    }
}

function draw() {
    ctx.fillStyle = '#171717';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const maxRadius = (cellSize - 1) / 2;
    const center = cellSize / 2;
    for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
            const scale = opacity[x][y];
            if (scale > 0.01) {
                const radius = maxRadius * scale;
                ctx.fillStyle = 'rgba(60, 60, 60, 0.2)';
                ctx.beginPath();
                ctx.arc(x * cellSize + center, y * cellSize + center, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

function spawnPatch(cx, cy, value) {
    const size = 8;
    for (let i = -size; i <= size; i++) {
        for (let j = -size; j <= size; j++) {
            const dist = Math.sqrt(i * i + j * j);
            if (dist <= size && Math.random() < 0.6) {
                const nx = (cx + i + cols) % cols;
                const ny = (cy + j + rows) % rows;
                grid[nx][ny] = value;
            }
        }
    }
}

function sampleArea(cx, cy) {
    const size = 5;
    let count = 0;
    let total = 0;
    for (let i = -size; i <= size; i++) {
        for (let j = -size; j <= size; j++) {
            const nx = (cx + i + cols) % cols;
            const ny = (cy + j + rows) % rows;
            count += grid[nx][ny];
            total++;
        }
    }
    return count / total;
}

document.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') return;
    const cx = Math.floor(e.clientX / cellSize);
    const cy = Math.floor(e.clientY / cellSize);
    const density = sampleArea(cx, cy);
    spawnPatch(cx, cy, density > 0.5 ? 0 : 1);
});

let lastUpdate = 0;
const updateInterval = 200;

function animate(timestamp) {
    if (timestamp - lastUpdate >= updateInterval) {
        update();
        lastUpdate = timestamp;
    }
    updateOpacity();
    draw();
    requestAnimationFrame(animate);
}

initGrid();
requestAnimationFrame(animate);

window.addEventListener('resize', initGrid);
