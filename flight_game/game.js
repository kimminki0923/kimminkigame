// 2D Flight Game - Canvas API Implementation
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
document.getElementById('game-container').innerHTML = '';
document.getElementById('game-container').appendChild(canvas);

// Game State
const STATE = {
    MENU: 0,
    PLAYING: 1,
    GAMEOVER: 2
};

let gameState = {
    mode: STATE.MENU,
    score: 0,
    frames: 0,
    camera: { x: 0, y: 0 },
    keys: { w: false, a: false, s: false, d: false },
    webglStatus: "Checking..."
};

// WebGL Diagnostic
function checkWebGL() {
    try {
        const testCanvas = document.createElement('canvas');
        const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
        if (gl && gl instanceof WebGLRenderingContext) {
            gameState.webglStatus = "WebGL 1.0 OK";
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                console.log("WebGL Vendor:", vendor);
                console.log("WebGL Renderer:", renderer);
            }
        } else {
            gameState.webglStatus = "WebGL Blocked/Not Found";
        }
    } catch (e) {
        gameState.webglStatus = "Error: " + e.message;
    }
    console.log("3D Status:", gameState.webglStatus);
}

// Plane Physics
const plane = {
    x: 100,
    y: 0, // Will be set to ground level
    vx: 0,
    vy: 0,
    angle: 0,
    throttle: 0, // 0 to 1
    fuel: 100,
    // Physics Constants
    gravity: 0.15,
    liftCoeff: 0.05,
    dragCoeff: 0.02,
    thrustPower: 0.4,
    rotationSpeed: 0.05
};

// World
const rings = [];
const clouds = [];
const particles = [];
let terrainPoints = [];

// Init
function init() {
    resize();
    window.addEventListener('resize', resize);

    checkWebGL(); // Start diagnosis

    // Input Handling
    window.addEventListener('keydown', e => {
        const k = e.key.toLowerCase();
        if (gameState.keys.hasOwnProperty(k)) gameState.keys[k] = true;
    });
    window.addEventListener('keyup', e => {
        const k = e.key.toLowerCase();
        if (gameState.keys.hasOwnProperty(k)) gameState.keys[k] = false;
    });

    document.getElementById('start-btn').addEventListener('click', startGame);

    // Initial Terrain
    generateTerrain();

    // Loop
    requestAnimationFrame(loop);
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function startGame() {
    document.getElementById('message-overlay').style.display = 'none';
    gameState.mode = STATE.PLAYING;
    gameState.score = 0;

    // Reset Plane
    plane.x = 200;
    plane.y = getTerrainHeight(200) - 25; // Sit on runway
    plane.vx = 0;
    plane.vy = 0;
    plane.angle = -0.1; // Slightly nose up
    plane.throttle = 0;

    // Reset World
    rings.length = 0;
    generateRings();
}

// ----------------------
// LOGIC
// ----------------------

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

function update() {
    gameState.frames++;

    if (gameState.mode === STATE.MENU) {
        // Aesthetic Auto-Pan in Menu
        gameState.camera.x += 2;
        // Keep plane on ground
        plane.y = getTerrainHeight(plane.x) - 25;
        return;
    }

    if (gameState.mode === STATE.PLAYING) {
        // 1. Controls (Synced with HUD)
        // W: Increase Throttle + Pitch Down
        if (gameState.keys.w) {
            plane.throttle = Math.min(plane.throttle + 0.01, 1);
            plane.angle += 0.03;
        }
        // S: Decrease Throttle + Pitch Up
        if (gameState.keys.s) {
            plane.throttle = Math.max(plane.throttle - 0.01, 0);
            plane.angle -= 0.03;
        }

        // A / D: Banking / Horizontal Tilt (Visual + subtle movement)
        if (gameState.keys.a) plane.vx -= 0.2;
        if (gameState.keys.d) plane.vx += 0.2;

        // 2. Physics Model

        // Thrust Vector
        const thrust = plane.throttle * plane.thrustPower;
        const ax = Math.cos(plane.angle) * thrust;
        const ay = Math.sin(plane.angle) * thrust;

        // Velocity (add thrust)
        plane.vx += ax;
        plane.vy += ay;

        // Speed squared for Lift/Drag
        const speedSq = plane.vx * plane.vx + plane.vy * plane.vy;
        const speed = Math.sqrt(speedSq);

        // Drag (Opposite to velocity)
        if (speed > 0.1) {
            plane.vx -= plane.dragCoeff * plane.vx;
            plane.vy -= plane.dragCoeff * plane.vy;
        }

        // Lift (Perpendicular to velocity, approximated by simple "Up" force based on horizontal speed + angle of attack)
        // Simplified Arcade Lift: Speed * LiftCoeff * cos(angle)
        // This makes it so if you fly level fast, you stay up.
        plane.vy -= speed * plane.liftCoeff * Math.cos(plane.angle);

        // Gravity
        plane.vy += plane.gravity;

        // Update Position
        plane.x += plane.vx;
        plane.y += plane.vy;

        // 3. Collision with Ground
        const groundY = getTerrainHeight(plane.x);
        if (plane.y > groundY - 10) {
            // Crash or Landing?
            if (speed > 10 || Math.abs(plane.angle) > 0.5) {
                // Hard Crash
                // Reset for now
                plane.y = groundY - 10;
                plane.vy = -plane.vy * 0.5; // Bounce dampen
                plane.vx *= 0.5; // Friction
            } else {
                // Safe Landing / Taxiing
                plane.y = groundY - 10;
                plane.vy = 0;
                // Align to ground normal approximately (force level)
                plane.angle = plane.angle * 0.9;
            }
        }

        // 4. Camera Follow
        // Target: Plane is 1/3 from left, centered Y
        const targetCamX = plane.x - canvas.width * 0.3;
        const targetCamY = plane.y - canvas.height * 0.5;

        // Smooth lerp
        gameState.camera.x += (targetCamX - gameState.camera.x) * 0.1;
        gameState.camera.y += (targetCamY - gameState.camera.y) * 0.1;

        // 5. World Generation
        if (gameState.camera.x + canvas.width > terrainPoints.length * 50 - 100) {
            generateTerrainChunks(); // Infinite ground
        }

        // Rings Check
        checkCollisions();

        // UI Updates
        document.getElementById('speed-display').innerText = `SPEED: ${Math.floor(speed * 10)} km/h`;
        document.getElementById('speed-bar-fill').style.width = `${plane.throttle * 100}%`;
        document.getElementById('score-display').innerText = `SCORE: ${gameState.score}`;
    }
}

// ----------------------
// RENDER
// ----------------------

function draw() {
    // Sky Background (Dynamic gradient based on height?)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGrad.addColorStop(0, "#2980b9"); // Darker blue at top
    skyGrad.addColorStop(0.5, "#87CEEB"); // Lighter blue
    skyGrad.addColorStop(1, "#E0F7FA"); // horizon
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Camera Transform (Smooth vertical parallax)
    ctx.translate(-gameState.camera.x, -gameState.camera.y);

    // 1. Distant Mountains (Deep Parallax)
    drawMountains();

    // 2. Clouds
    drawClouds();

    // 3. Terrain
    drawTerrain();

    // 4. Rings
    drawRings();

    // 5. Plane
    drawPlane();

    ctx.restore();
}

function drawMountains() {
    const startX = gameState.camera.x * 0.95; // Very slow movement
    ctx.fillStyle = "#7f8c8d"; // Grey-blue mountains
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    for (let i = 0; i < 20; i++) {
        const x = startX + i * 400;
        ctx.moveTo(x, canvas.height * 0.5);
        ctx.lineTo(x + 200, canvas.height * 0.3);
        ctx.lineTo(x + 400, canvas.height * 0.5);
    }
    ctx.fill();
    ctx.globalAlpha = 1.0;
}

function drawPlane() {
    ctx.save();

    // Shadow on ground
    const groundY = getTerrainHeight(plane.x);
    const altitude = groundY - plane.y;
    const shadowScale = Math.max(0.2, 1 - altitude / 1000);
    const horizonY = canvas.height * 0.45;

    // Draw shadow if not too high
    if (altitude < 1000) {
        ctx.save();
        ctx.translate(plane.x, groundY);
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.scale(1.5 * shadowScale, 0.4 * shadowScale);
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    ctx.translate(plane.x, plane.y);

    // BANKING / PERSPECTIVE SKEW
    // As we turn or move, the plane should tilt into the screen
    const bank = Math.sin(gameState.frames * 0.05) * 0.05; // Gentle bobbing
    const turnBank = plane.vx * 0.02; // Bank into turn
    ctx.rotate(plane.angle + bank);
    ctx.scale(1, 1 - Math.abs(turnBank)); // Vertical squeeze for banking feel
    ctx.transform(1, turnBank, 0, 1, 0, 0); // Skew

    // Biplane Design
    // Body (with slight 3D shading)
    ctx.fillStyle = "#E74C3C";
    ctx.fillRect(-20, -10, 50, 20);
    ctx.fillStyle = "#C0392B"; // Darker side
    ctx.fillRect(-20, 0, 50, 10);

    // Tail
    ctx.fillStyle = "#C0392B";
    ctx.beginPath();
    ctx.moveTo(-20, -10);
    ctx.lineTo(-35, -25);
    ctx.lineTo(-20, 0);
    ctx.fill();

    // Wings (Top & Bottom)
    ctx.fillStyle = "#ECF0F1";
    ctx.fillRect(-12, -18, 35, 6); // Top Wing
    ctx.fillRect(-12, 8, 35, 4);  // Bot Wing

    // Cockpit
    ctx.fillStyle = "#3498DB";
    ctx.beginPath();
    ctx.arc(5, -10, 10, Math.PI, 0);
    ctx.fill();

    // Propeller (Blur effect if fast)
    ctx.fillStyle = "rgba(50, 50, 50, 0.5)";
    const propS = Math.sin(gameState.frames * 0.8) * 15;
    ctx.fillRect(30, -propS, 3, propS * 2);

    ctx.restore();
}

function drawTerrain() {
    // PERSPECTIVE GROUND (Trapezoidal view for "Slow" 3D feel)
    const horizonY = canvas.height * 0.45; // Sky ends here
    const groundBottom = canvas.height;

    // Gradient sky-to-ground blending
    const groundGrad = ctx.createLinearGradient(0, horizonY, 0, groundBottom);
    groundGrad.addColorStop(0, "#27ae60");
    groundGrad.addColorStop(1, "#2ecc71");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, horizonY, canvas.width, groundBottom - horizonY);

    // Drawing Grid/Hills with perspective
    const startIdx = Math.floor(gameState.camera.x / 100);
    const endIdx = startIdx + 20;

    for (let i = startIdx; i < endIdx; i++) {
        const xWorld = i * 100;
        const xScreen = xWorld - gameState.camera.x;

        // Pseudo-3D Mapping
        const drawH = getTerrainHeight(xWorld);
        const yRel = (drawH - gameState.camera.y) * 0.4;

        ctx.fillStyle = (i % 2 === 0) ? "rgba(39, 174, 96, 0.8)" : "rgba(46, 204, 113, 0.8)";

        // Trapezoid calculation: Center focus
        const x1 = xScreen;
        const x2 = xScreen + 100;
        const yTop = horizonY + yRel;

        // Perspective factor: closer to center horizon is narrower
        const p1 = (canvas.width / 2 - x1) * 0.5;
        const p2 = (canvas.width / 2 - x2) * 0.5;

        ctx.beginPath();
        ctx.moveTo(x1, groundBottom);
        ctx.lineTo(x1 + p1, yTop);
        ctx.lineTo(x2 + p2, yTop);
        ctx.lineTo(x2, groundBottom);
        ctx.fill();

        // Draw Runway check
        if (xWorld < 2000) {
            ctx.fillStyle = "rgba(85, 85, 85, 0.5)";
            ctx.beginPath();
            ctx.moveTo(x1 + p1, yTop);
            ctx.lineTo(x2 + p2, yTop);
            ctx.lineTo(x2, groundBottom);
            ctx.lineTo(x1, groundBottom);
            ctx.fill();
        }
    }
}

function drawRings() {
    ctx.strokeStyle = "#F1C40F";
    ctx.lineWidth = 5;

    for (const r of rings) {
        if (r.active) {
            ctx.beginPath();
            ctx.arc(r.x, r.y, 40, 0, Math.PI * 2);
            ctx.stroke();

            // Sparkle
            if (gameState.frames % 60 < 30) {
                ctx.strokeStyle = "#FFF";
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.strokeStyle = "#F1C40F";
                ctx.lineWidth = 5;
            }
        }
    }
}

function drawClouds() {
    for (const c of clouds) {
        // PARALLAX: Clouds move slower than terrain
        const px = c.x * 0.8;
        const py = c.y - gameState.camera.y * 0.2;

        ctx.fillStyle = `rgba(255, 255, 255, ${c.opacity})`;
        ctx.beginPath();
        ctx.arc(px, py, c.size, 0, Math.PI * 2);
        ctx.arc(px + c.size * 0.5, py - c.size * 0.2, c.size * 0.8, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ----------------------
// GENERATION
// ----------------------

function generateTerrain() {
    terrainPoints = [];
    let y = 500;
    // Flat runway first 20 points (1000px)
    for (let i = 0; i < 20; i++) {
        terrainPoints.push(y);
    }
    generateTerrainChunks();
}

function generateTerrainChunks() {
    // Extend terrain
    let lastY = terrainPoints[terrainPoints.length - 1];
    for (let i = 0; i < 100; i++) {
        // Random rolling hills
        lastY += (Math.random() - 0.5) * 30;
        // Clamp mainly
        if (lastY < 200) lastY = 200; // Sky limit
        if (lastY > 800) lastY = 800; // Deep floor
        terrainPoints.push(lastY);

        // Add clouds randomly with more properties
        if (Math.random() < 0.15) {
            clouds.push({
                x: (terrainPoints.length - 1) * 50,
                y: Math.random() * 400 - 100,
                size: 40 + Math.random() * 60,
                opacity: 0.3 + Math.random() * 0.4
            });
        }
    }
}

function getTerrainHeight(xWorld) {
    const idx = Math.floor(xWorld / 50);
    if (idx < 0) return 500;
    if (idx >= terrainPoints.length) return 500;

    // Linear interpolate
    const p1 = terrainPoints[idx];
    const p2 = terrainPoints[idx + 1] || p1;
    const ratio = (xWorld % 50) / 50;
    return p1 + (p2 - p1) * ratio;
}

function generateRings() {
    for (let i = 0; i < 50; i++) {
        rings.push({
            x: 1500 + i * 800, // Distance between rings
            y: 200 + (Math.random() - 0.5) * 400,
            active: true
        });
    }
}

function checkCollisions() {
    // Ring Collection
    for (const r of rings) {
        if (r.active) {
            const dx = plane.x - r.x;
            const dy = plane.y - r.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 50) { // Hit radius
                r.active = false;
                gameState.score += 100;
                // Add particles effect
            }
        }
    }
}

// Start
init();
