// flight.js – Visual Masterpiece & Precision Collision
// Features: 700km/h, Fly-through Rings, Speed Lines, Infinite Grid, Laser

import * as THREE from "three";

// --- GLOBAL STATE ---
let renderer, scene, camera;
let airplaneContainer;
let airplaneMesh;
let flames = [];
let missiles = [];
let explosions = [];
let clouds = [];

// ... (other globals)

// Explosion FX
function createExplosion(position) {
    const particleCount = 20;
    const geo = new THREE.BufferGeometry();
    const pos = [];
    const vel = [];

    for (let i = 0; i < particleCount; i++) {
        pos.push(0, 0, 0);
        vel.push((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50);
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffaa00, size: 4, transparent: true });
    const mesh = new THREE.Points(geo, mat);
    mesh.position.copy(position);
    scene.add(mesh);

    explosions.push({ mesh: mesh, velocities: vel, life: 0.5 });
}

function fireMissile() {
    const geo = new THREE.CylinderGeometry(0.2, 0.2, 12, 6);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff0044 }); // Neon Red
    const m = new THREE.Mesh(geo, mat);

    const pos = airplaneContainer.position.clone();
    pos.y -= 1.0;
    m.position.copy(pos);
    m.quaternion.copy(airplaneContainer.quaternion);
    scene.add(m);

    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(m.quaternion);

    // Speed inheritance: Base 1000 + Plane Speed * 200 (approx unit/sec)
    // Actually currentSpeed is factor. moveDist = currentSpeed * 200 * dt.
    // So plane velocity is currentSpeed * 200.
    const missileSpeed = 1000 + (currentSpeed * 200);

    missiles.push({ mesh: m, dir: fwd, life: 2.0, speed: missileSpeed });
}
let starsSystem; // Particle system for speed
let isStarted = false;
let lastTime = 0;
let allObjects = [];

// === GAME MODE / MAP CONFIG ===
// Read from window globals set by index.html buttons
let activeMapSize = 'small'; // 'small' | 'large'
let activeFlightMode = 'arcade'; // 'arcade' | 'real'

// Infinite City State
let cityChunks = {}; // key = "cx_cz", value = THREE.Group
let arenaConstraintEnabled = true; // disabled in large map
const CHUNK_SIZE = 2000;
const CHUNK_RENDER_RADIUS = 2; // chunks to keep loaded in each direction

window.applyFlightSettings = function () {
    const newMap  = window.flightMapSize  || 'small';
    const newMode = window.flightMode     || 'arcade';
    if (newMap !== activeMapSize || newMode !== activeFlightMode) {
        activeMapSize  = newMap;
        activeFlightMode = newMode;
        rebuildWorld();
    }
};

// Multiplayer - Other Players
window.otherPlayersInScene = {};

// Export player position for multiplayer sync
window.getPlayerPosition = function () {
    if (!airplaneContainer) return null;
    return {
        x: airplaneContainer.position.x,
        y: airplaneContainer.position.y,
        z: airplaneContainer.position.z,
        rx: airplaneContainer.rotation.x,
        ry: airplaneContainer.rotation.y,
        rz: airplaneContainer.rotation.z
    };
};

// Update other player's airplane
window.updateOtherPlayer = function (uid, data) {
    if (!scene) return;

    if (!window.otherPlayersInScene[uid]) {
        // Create new airplane for this player
        const otherPlane = createSimpleAirplane(data.name);
        otherPlane.userData.uid = uid;
        scene.add(otherPlane);
        window.otherPlayersInScene[uid] = otherPlane;
    }

    const plane = window.otherPlayersInScene[uid];
    // Smooth interpolation
    plane.position.lerp(new THREE.Vector3(data.x, data.y, data.z), 0.3);
    plane.rotation.x += (data.rx - plane.rotation.x) * 0.3;
    plane.rotation.y += (data.ry - plane.rotation.y) * 0.3;
    plane.rotation.z += (data.rz - plane.rotation.z) * 0.3;
};

// Remove other player's airplane
window.removeOtherPlayer = function (uid) {
    if (window.otherPlayersInScene[uid]) {
        scene.remove(window.otherPlayersInScene[uid]);
        delete window.otherPlayersInScene[uid];
    }
};

// Create simplified airplane for other players
function createSimpleAirplane(name) {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.CylinderGeometry(1, 1.5, 10, 8);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff6600, metalness: 0.5, roughness: 0.4 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // Wings
    const wingGeo = new THREE.BoxGeometry(15, 0.3, 3);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xffaa00 });
    const wings = new THREE.Mesh(wingGeo, wingMat);
    group.add(wings);

    // Tail
    const tailGeo = new THREE.BoxGeometry(5, 0.3, 2);
    const tail = new THREE.Mesh(tailGeo, wingMat);
    tail.position.z = 4;
    group.add(tail);

    // Name label (using sprite)
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(name || '???', 128, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.y = 5;
    sprite.scale.set(10, 2.5, 1);
    group.add(sprite);

    return group;
}

// Flight Parameters
let currentSpeed = 0;
// Speed limits per mode (set dynamically)
let BASE_MAX_SPEED  = 3.0;  // arcade: 300 km/h
let BOOST_MAX_SPEED = 6.0;  // arcade: 600 km/h
const ACCEL = 0.03;
const BOOST_ACCEL = 0.08;
const DECEL = 0.015;

// Stall state (Realistic mode)
let isStalling = false;    // true during stall/tailslide
let stallTimer = 0;        // counts down the stall duration

// Physics
const GRAVITY = 15.0;

// Controls
let pitchVel = 0, rollVel = 0, yawVel = 0;
const ROT_DAMPING = 0.96;
const keys = { w: false, s: false, a: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false, " ": false, shift: false, q: false };
let lastQ = false;

export function startFlightSimulator() {
    if (isStarted) return;
    const container = document.getElementById("flight-game-container");
    const canvas = document.getElementById("flightCanvas");
    if (!container || container.clientWidth === 0) { setTimeout(startFlightSimulator, 100); return; }

    // Sync mode/map from HTML globals (set before game loads)
    activeMapSize   = window.flightMapSize  || 'small';
    activeFlightMode = window.flightMode    || 'arcade';

    initGraphics(container, canvas);
    buildWorld();
    createHeroAirplane();
    setupInputs();

    isStarted = true;
    lastTime = performance.now();
    requestAnimationFrame(animate);
}

function buildWorld() {
    applyModeSpeedLimits();
    if (activeMapSize === 'large') {
        createInfiniteCity();
    } else {
        createEnvironment();
    }
}

// ===================================================
// INFINITE CITY MAP (Large Map mode)
// ===================================================
let cityRoot = null;

function createInfiniteCity() {
    arenaConstraintEnabled = false;
    cityRoot = new THREE.Group();
    cityRoot.name = 'cityRoot';
    scene.add(cityRoot);

    // Large dark ground
    const groundGeo = new THREE.PlaneGeometry(80000, 80000);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    cityRoot.add(ground);

    cityChunks = {};
    for (let cx = -CHUNK_RENDER_RADIUS; cx <= CHUNK_RENDER_RADIUS; cx++) {
        for (let cz = -CHUNK_RENDER_RADIUS; cz <= CHUNK_RENDER_RADIUS; cz++) {
            spawnCityChunk(cx, cz);
        }
    }
}

function clearInfiniteCity() {
    if (cityRoot) { scene.remove(cityRoot); cityRoot = null; }
    cityChunks = {};
    arenaConstraintEnabled = true;
}

function seededRandom(seed) {
    let s = seed;
    return function() {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
}

function spawnCityChunk(cx, cz) {
    const key = `${cx}_${cz}`;
    if (cityChunks[key]) return;

    const group = new THREE.Group();
    group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    if (cityRoot) cityRoot.add(group);

    const rng = seededRandom(cx * 7919 + cz * 6571);
    const COLS = 3, ROWS = 3;
    const cellW = CHUNK_SIZE / COLS;
    const cellD = CHUNK_SIZE / ROWS;
    const roadGap = 180;

    const palette = [0x445566, 0x334455, 0x556677, 0x8899aa, 0x222233, 0x333344, 0x667788, 0x2a3a4a];

    for (let col = 0; col < COLS; col++) {
        for (let row = 0; row < ROWS; row++) {
            const bw = cellW - roadGap;
            const bd = cellD - roadGap;
            const bh = 300 + rng() * 1500;
            const bx = (col + 0.5) * cellW - CHUNK_SIZE / 2;
            const bz = (row + 0.5) * cellD - CHUNK_SIZE / 2;

            const mat = new THREE.MeshStandardMaterial({
                color: palette[Math.floor(rng() * palette.length)],
                roughness: 0.5, metalness: 0.4
            });
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
            mesh.position.set(bx, bh / 2, bz);
            mesh.castShadow = true;
            mesh.userData.type = 'BUILDING';
            mesh.userData.width = bw;
            mesh.userData.depth = bd;
            mesh.userData.height = bh;
            group.add(mesh);

            // Emissive window strip (simulates lit windows at night)
            const winMat = new THREE.MeshBasicMaterial({ color: 0xffee55, transparent: true, opacity: 0.5 });
            const win = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.7, bh * 0.7), winMat);
            win.position.set(bx, bh / 2, bz + bd / 2 + 0.5);
            group.add(win);
        }
    }

    cityChunks[key] = group;
}

function updateInfiniteCity(planePos) {
    if (!cityRoot || activeMapSize !== 'large') return;

    const pcx = Math.round(planePos.x / CHUNK_SIZE);
    const pcz = Math.round(planePos.z / CHUNK_SIZE);

    for (let cx = pcx - CHUNK_RENDER_RADIUS; cx <= pcx + CHUNK_RENDER_RADIUS; cx++) {
        for (let cz = pcz - CHUNK_RENDER_RADIUS; cz <= pcz + CHUNK_RENDER_RADIUS; cz++) {
            spawnCityChunk(cx, cz);
        }
    }

    // Cull far chunks
    for (const key of Object.keys(cityChunks)) {
        const [kcx, kcz] = key.split('_').map(Number);
        if (Math.abs(kcx - pcx) > CHUNK_RENDER_RADIUS + 1 || Math.abs(kcz - pcz) > CHUNK_RENDER_RADIUS + 1) {
            if (cityRoot) cityRoot.remove(cityChunks[key]);
            delete cityChunks[key];
        }
    }

    // Rebuild collision list from active chunks
    allObjects = [];
    for (const group of Object.values(cityChunks)) {
        group.children.forEach(child => {
            if (child.userData.type === 'BUILDING') {
                // Store world position for collision
                const wp = new THREE.Vector3();
                child.getWorldPosition(wp);
                child.userData._wx = wp.x;
                child.userData._wy = wp.y;
                child.userData._wz = wp.z;
                allObjects.push(child);
            }
        });
    }
}


function applyModeSpeedLimits() {
    if (activeFlightMode === 'real') {
        BASE_MAX_SPEED  = 5.0;  // base 500 km/h — can grav-dive past this
        BOOST_MAX_SPEED = 10.0; // 1000 km/h
    } else {
        BASE_MAX_SPEED  = 3.0;
        BOOST_MAX_SPEED = 6.0;
    }
}


function rebuildWorld() {
    // Clear old scene objects (keep airplane & renderer)
    applyModeSpeedLimits();

    // Remove all tracked collision objects
    allObjects.forEach(obj => { if (obj.parent) obj.parent.remove(obj); });
    allObjects = [];

    // Clear city chunks
    clearInfiniteCity();

    // Remove arena groups (anything named arenaGroup-like)
    const toRemove = [];
    scene.traverse(obj => {
        if (obj.name === 'arenaRoot' || obj.name === 'cityRoot') toRemove.push(obj);
    });
    toRemove.forEach(g => scene.remove(g));

    buildWorld();
}

function initGraphics(container, canvas) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue background

    // Camera with extended far plane for 30000 height arena
    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 1, 50000);

    const sun = new THREE.DirectionalLight(0xffffff, 3.0);
    sun.position.set(100, 500, 100);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    const d = 3000;
    sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
    sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
    scene.add(sun);
    scene.userData.sun = sun;

    const fillLight = new THREE.DirectionalLight(0xffaa00, 1.0); // Warm fill
    fillLight.position.set(-100, 100, -200);
    scene.add(fillLight);
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));

    window.addEventListener('resize', () => {
        if (!container) return;
        renderer.setSize(container.clientWidth, container.clientHeight);
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
    });
}

function createEnvironment() {
    arenaConstraintEnabled = true;
    // 1. ARENA BASICS - 10x SCALE
    const arenaWidth = 6000;
    const arenaLength = 12000;
    const arenaGroup = new THREE.Group();
    scene.add(arenaGroup);

    // Ground - Lush Green Grass
    const groundGeo = new THREE.PlaneGeometry(arenaWidth, arenaLength);
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0x2d5a27,
        roughness: 0.8,
        flatShading: true
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = "arena_floor";
    arenaGroup.add(ground);

    // Wall Border Visuals (Grey ring around floor)
    const borderGeo = new THREE.PlaneGeometry(arenaWidth + 200, arenaLength + 200);
    const borderMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 1.0 }); // Concrete grey
    const border = new THREE.Mesh(borderGeo, borderMat);
    border.rotation.x = -Math.PI / 2;
    border.position.y = 0.1; // Slightly above zero but below grass (z-fighting fix if grass is 0)
    // Actually grass is at 0. Let's put border at 0.05 and make it larger than ground
    // Ground is arenaWidth x arenaLength. Border should be slightly larger.
    // Let's make 4 strips instead to avoid z-fighting center.

    const borderWidth = 100;
    const borderMat2 = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 1.0 });
    // Top
    const bTop = new THREE.Mesh(new THREE.PlaneGeometry(arenaWidth + borderWidth * 2, borderWidth), borderMat2);
    bTop.rotation.x = -Math.PI / 2;
    bTop.position.set(0, 1, -arenaLength / 2 - borderWidth / 2);
    arenaGroup.add(bTop);
    // Bottom
    const bBot = new THREE.Mesh(new THREE.PlaneGeometry(arenaWidth + borderWidth * 2, borderWidth), borderMat2);
    bBot.rotation.x = -Math.PI / 2;
    bBot.position.set(0, 1, arenaLength / 2 + borderWidth / 2);
    arenaGroup.add(bBot);
    // Left
    const bLeft = new THREE.Mesh(new THREE.PlaneGeometry(borderWidth, arenaLength), borderMat2);
    bLeft.rotation.x = -Math.PI / 2;
    bLeft.position.set(-arenaWidth / 2 - borderWidth / 2, 1, 0);
    arenaGroup.add(bLeft);
    // Right
    const bRight = new THREE.Mesh(new THREE.PlaneGeometry(borderWidth, arenaLength), borderMat2);
    bRight.rotation.x = -Math.PI / 2;
    bRight.position.set(arenaWidth / 2 + borderWidth / 2, 1, 0);
    arenaGroup.add(bRight);

    // Boundary Walls (30000 height - complete box cage)
    const wallHeight = 30000;
    const wallThickness = 100;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.9 });

    // Front/Back Walls
    const fbWallGeo = new THREE.BoxGeometry(arenaWidth + wallThickness * 2, wallHeight, wallThickness);
    const wallBack = new THREE.Mesh(fbWallGeo, wallMat);
    wallBack.position.set(0, wallHeight / 2, -arenaLength / 2 - wallThickness / 2);
    wallBack.receiveShadow = true;
    wallBack.castShadow = true;
    wallBack.userData.type = "WALL";
    wallBack.userData.width = arenaWidth + wallThickness * 2;
    wallBack.userData.height = wallHeight;
    wallBack.userData.depth = wallThickness;
    arenaGroup.add(wallBack);
    allObjects.push(wallBack);

    const wallFront = new THREE.Mesh(fbWallGeo, wallMat);
    wallFront.position.set(0, wallHeight / 2, arenaLength / 2 + wallThickness / 2);
    wallFront.receiveShadow = true;
    wallFront.castShadow = true;
    wallFront.userData.type = "WALL";
    wallFront.userData.width = arenaWidth + wallThickness * 2;
    wallFront.userData.height = wallHeight;
    wallFront.userData.depth = wallThickness;
    arenaGroup.add(wallFront);
    allObjects.push(wallFront);

    // Side Walls
    const sideWallGeo = new THREE.BoxGeometry(wallThickness, wallHeight, arenaLength);
    const wallLeft = new THREE.Mesh(sideWallGeo, wallMat);
    wallLeft.position.set(-arenaWidth / 2 - wallThickness / 2, wallHeight / 2, 0);
    wallLeft.receiveShadow = true;
    wallLeft.castShadow = true;
    wallLeft.userData.type = "WALL";
    wallLeft.userData.width = wallThickness;
    wallLeft.userData.height = wallHeight;
    wallLeft.userData.depth = arenaLength;
    arenaGroup.add(wallLeft);
    allObjects.push(wallLeft);

    const wallRight = new THREE.Mesh(sideWallGeo, wallMat);
    wallRight.position.set(arenaWidth / 2 + wallThickness / 2, wallHeight / 2, 0);
    wallRight.receiveShadow = true;
    wallRight.castShadow = true;
    wallRight.userData.type = "WALL";
    wallRight.userData.width = wallThickness;
    wallRight.userData.height = wallHeight;
    wallRight.userData.depth = arenaLength;
    arenaGroup.add(wallRight);
    allObjects.push(wallRight);

    // CEILING (Top of the box)
    const ceilingGeo = new THREE.PlaneGeometry(arenaWidth, arenaLength);
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x87ceeb, side: THREE.DoubleSide }); // Sky blue
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = wallHeight;
    // Removed userData and allObjects.push here so we don't accidentally create an invisible 100x100 collision pillar at 0,Z,0
    arenaGroup.add(ceiling);

    // 2. THE RIVER (10x scale)
    const riverWidth = 800;
    const riverGeo = new THREE.PlaneGeometry(arenaWidth - 200, riverWidth);
    const riverMat = new THREE.MeshStandardMaterial({
        color: 0x3498db,
        emissive: 0x1a5276,
        emissiveIntensity: 0.5,
        roughness: 0.3,
        metalness: 0.5
    });
    const river = new THREE.Mesh(riverGeo, riverMat);
    river.rotation.x = -Math.PI / 2;
    river.position.y = 0.5;
    arenaGroup.add(river);

    // 3. BRIDGES (10x scale) - with collision
    const bridgeWidth = 1000;
    const bridgeLength = 1200;
    const bridgeHeight = 50;
    const bridgeGeo = new THREE.BoxGeometry(bridgeWidth, bridgeHeight, bridgeLength);
    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d });

    const bridgeL = new THREE.Mesh(bridgeGeo, bridgeMat);
    bridgeL.position.set(-arenaWidth / 4, bridgeHeight / 2, 0);
    bridgeL.castShadow = true;
    bridgeL.receiveShadow = true;
    bridgeL.userData.type = "BRIDGE";
    bridgeL.userData.width = bridgeWidth;
    bridgeL.userData.height = bridgeHeight;
    bridgeL.userData.depth = bridgeLength;
    arenaGroup.add(bridgeL);
    allObjects.push(bridgeL);

    const bridgeR = new THREE.Mesh(bridgeGeo, bridgeMat);
    bridgeR.position.set(arenaWidth / 4, bridgeHeight / 2, 0);
    bridgeR.castShadow = true;
    bridgeR.receiveShadow = true;
    bridgeR.userData.type = "BRIDGE";
    bridgeR.userData.width = bridgeWidth;
    bridgeR.userData.height = bridgeHeight;
    bridgeR.userData.depth = bridgeLength;
    arenaGroup.add(bridgeR);
    allObjects.push(bridgeR);

    // 4. TOWERS (10x scale)
    // Blue Side (North)
    createTower(0, 0, -5000, true, arenaGroup); // Blue King
    createTower(-1500, 0, -3500, false, arenaGroup); // Blue Princess L
    createTower(1500, 0, -3500, false, arenaGroup); // Blue Princess R

    // Red Side (South)
    createTower(0, 0, 5000, true, arenaGroup, true); // Red King
    createTower(-1500, 0, 3500, false, arenaGroup, true); // Red Princess L
    createTower(1500, 0, 3500, false, arenaGroup, true); // Red Princess R

    // 5. SPEED PARTICLES (larger spread)
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 2000;
    const posArray = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 20000;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, transparent: true, opacity: 0.4 });
    starsSystem = new THREE.Points(starsGeo, starsMat);
    scene.add(starsSystem);

    airplaneContainer = new THREE.Group();

    // Create Clouds
    createClouds();
}

function createClouds() {
    clouds = [];
    const cloudCount = 40;
    const cloudGeo = new THREE.BoxGeometry(1, 1, 1);
    const cloudMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        flatShading: true,
        transparent: true,
        opacity: 0.8
    });

    for (let i = 0; i < cloudCount; i++) {
        const cloudGroup = new THREE.Group();

        // Random cluster
        const blocks = Math.floor(Math.random() * 3) + 3;
        for (let j = 0; j < blocks; j++) {
            const mesh = new THREE.Mesh(cloudGeo, cloudMat);
            mesh.position.set(
                (Math.random() - 0.5) * 200,
                (Math.random() - 0.5) * 50,
                (Math.random() - 0.5) * 150
            );
            mesh.scale.set(
                Math.random() * 100 + 100,
                Math.random() * 50 + 50,
                Math.random() * 100 + 100
            );
            mesh.castShadow = true;
            cloudGroup.add(mesh);
        }

        // Position in sky
        cloudGroup.position.set(
            (Math.random() - 0.5) * 10000,
            2000 + Math.random() * 5000,
            (Math.random() - 0.5) * 20000
        );

        cloudGroup.userData.velocity = (Math.random() * 20 + 10); // Drift speed

        scene.add(cloudGroup);
        clouds.push(cloudGroup);
    }
}

function createTower(x, y, z, isKing, parent, isRed = false) {
    const color = isRed ? 0xe74c3c : 0x3498db;
    const towerGroup = new THREE.Group();
    towerGroup.position.set(x, y, z);
    parent.add(towerGroup);

    // 10x scale for towers
    const baseSize = isKing ? 600 : 400;
    const height = isKing ? 1000 : 700;

    const bodyGeo = new THREE.CylinderGeometry(baseSize * 0.8, baseSize, height, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xdcdde1 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    towerGroup.add(body);

    const topGeo = new THREE.CylinderGeometry(baseSize * 0.9, baseSize * 0.8, 150, 16);
    const topMat = new THREE.MeshStandardMaterial({ color: color });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = height + 75;
    top.castShadow = true;
    towerGroup.add(top);

    // Spire
    const spireGeo = new THREE.ConeGeometry(50, 300, 8);
    const spire = new THREE.Mesh(spireGeo, topMat);
    spire.position.y = height + 300;
    towerGroup.add(spire);

    towerGroup.userData.type = "BUILDING";
    towerGroup.userData.height = height + 450;
    // Set collision radius larger than visual size (1.5x)
    towerGroup.userData.width = baseSize * 3;
    towerGroup.userData.depth = baseSize * 3;
    towerGroup.userData.radius = baseSize * 1.5; // Explicit radius for cylinder collisions
    allObjects.push(towerGroup);
}

// Note: Landmark building logic removed for CR Arena

function createHeroAirplane() {
    airplaneContainer = new THREE.Group();
    airplaneContainer.position.set(0, 500, 4000); // Higher start, near red side, scaled
    scene.add(airplaneContainer);
    airplaneMesh = new THREE.Group();
    airplaneContainer.add(airplaneMesh);

    // === DETAILED HERO JET MODEL ===
    // Materials
    const matBody = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 0.6, roughness: 0.3 });
    const matAccent = new THREE.MeshStandardMaterial({ color: 0x0088ff, emissive: 0x0044ff, emissiveIntensity: 0.5, metalness: 0.8, roughness: 0.2 });
    const matDark = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.1 });
    const matCockpit = new THREE.MeshStandardMaterial({ color: 0x00aaff, transparent: true, opacity: 0.7, metalness: 0.9, roughness: 0.1 });
    const matFlame = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.9 });
    const matNeon = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

    // 1. FUSELAGE (Multi-part)
    const noseGeo = new THREE.ConeGeometry(0.8, 4, 8);
    const nose = new THREE.Mesh(noseGeo, matBody);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -8;
    airplaneMesh.add(nose);

    const bodyGeo = new THREE.CylinderGeometry(1.2, 1.5, 10, 8);
    const body = new THREE.Mesh(bodyGeo, matBody);
    body.rotation.x = -Math.PI / 2;
    body.position.z = -2;
    airplaneMesh.add(body);

    const tailGeo = new THREE.CylinderGeometry(1.5, 0.8, 6, 8);
    const tail = new THREE.Mesh(tailGeo, matBody);
    tail.rotation.x = -Math.PI / 2;
    tail.position.z = 5;
    airplaneMesh.add(tail);

    // 2. COCKPIT
    const cockpitGeo = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const cockpit = new THREE.Mesh(cockpitGeo, matCockpit);
    cockpit.rotation.x = -Math.PI / 2;
    cockpit.position.set(0, 0.8, -5);
    cockpit.scale.set(0.8, 1.2, 1.5);
    airplaneMesh.add(cockpit);

    // 3. MAIN WINGS (Swept Back)
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(7, -2);
    wingShape.lineTo(8, -1.5);
    wingShape.lineTo(8, -1);
    wingShape.lineTo(1, 1);
    wingShape.lineTo(0, 0);
    const wingExtrudeSettings = { depth: 0.15, bevelEnabled: false };
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);

    const leftWing = new THREE.Mesh(wingGeo, matBody);
    leftWing.position.set(0, 0, 0);
    leftWing.rotation.set(0, 0, Math.PI);
    airplaneMesh.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, matBody);
    rightWing.position.set(0, 0, 0);
    rightWing.rotation.set(Math.PI, 0, 0);
    airplaneMesh.add(rightWing);

    // 4. WINGLETS (Vertical tips)
    const wingletGeo = new THREE.BoxGeometry(0.1, 1.5, 1);
    const leftWinglet = new THREE.Mesh(wingletGeo, matAccent);
    leftWinglet.position.set(-7.5, 0.7, -1.5);
    airplaneMesh.add(leftWinglet);

    const rightWinglet = new THREE.Mesh(wingletGeo, matAccent);
    rightWinglet.position.set(7.5, 0.7, -1.5);
    airplaneMesh.add(rightWinglet);

    // 5. HORIZONTAL STABILIZERS
    const hStabGeo = new THREE.BoxGeometry(5, 0.1, 2);
    const hStabL = new THREE.Mesh(hStabGeo, matBody);
    hStabL.position.set(-2.5, 0, 7);
    airplaneMesh.add(hStabL);

    const hStabR = new THREE.Mesh(hStabGeo, matBody);
    hStabR.position.set(2.5, 0, 7);
    airplaneMesh.add(hStabR);

    // 6. VERTICAL STABILIZER
    const vStabGeo = new THREE.BoxGeometry(0.15, 3, 3);
    const vStab = new THREE.Mesh(vStabGeo, matBody);
    vStab.position.set(0, 1.5, 6);
    airplaneMesh.add(vStab);

    // NEON STRIPE on Stabilizer
    const stripeGeo = new THREE.BoxGeometry(0.2, 0.3, 3);
    const stripe = new THREE.Mesh(stripeGeo, matNeon);
    stripe.position.set(0, 2.8, 6);
    airplaneMesh.add(stripe);

    // 7. ENGINES (Under Wings)
    const engineBodyGeo = new THREE.CylinderGeometry(0.8, 1.0, 4, 12);
    const engineIntakeGeo = new THREE.TorusGeometry(0.9, 0.15, 8, 16);
    const engineNozzleGeo = new THREE.ConeGeometry(0.9, 1.5, 12);

    // Left Engine
    const engL = new THREE.Mesh(engineBodyGeo, matDark);
    engL.rotation.x = Math.PI / 2;
    engL.position.set(-3, -0.5, 2);
    airplaneMesh.add(engL);

    const intakeL = new THREE.Mesh(engineIntakeGeo, matAccent);
    intakeL.rotation.y = Math.PI / 2;
    intakeL.position.set(-3, -0.5, 0);
    airplaneMesh.add(intakeL);

    const nozzleL = new THREE.Mesh(engineNozzleGeo, matDark);
    nozzleL.rotation.x = Math.PI / 2;
    nozzleL.position.set(-3, -0.5, 4.5);
    airplaneMesh.add(nozzleL);

    // Right Engine
    const engR = new THREE.Mesh(engineBodyGeo, matDark);
    engR.rotation.x = Math.PI / 2;
    engR.position.set(3, -0.5, 2);
    airplaneMesh.add(engR);

    const intakeR = new THREE.Mesh(engineIntakeGeo, matAccent);
    intakeR.rotation.y = Math.PI / 2;
    intakeR.position.set(3, -0.5, 0);
    airplaneMesh.add(intakeR);

    const nozzleR = new THREE.Mesh(engineNozzleGeo, matDark);
    nozzleR.rotation.x = Math.PI / 2;
    nozzleR.position.set(3, -0.5, 4.5);
    airplaneMesh.add(nozzleR);

    // 8. BOOSTER FLAMES
    const flameGeo = new THREE.ConeGeometry(0.6, 6, 8);
    const flL = new THREE.Mesh(flameGeo, matFlame);
    flL.rotation.x = Math.PI / 2;
    flL.position.set(-3, -0.5, 7);
    airplaneMesh.add(flL);

    const flR = new THREE.Mesh(flameGeo, matFlame);
    flR.rotation.x = Math.PI / 2;
    flR.position.set(3, -0.5, 7);
    airplaneMesh.add(flR);

    flames = [flL, flR];
    flames.forEach(f => f.scale.set(0, 0, 0));

    // 9. NEON EDGE LINES (Body Accents)
    const lineGeoL = new THREE.BoxGeometry(0.05, 0.1, 14);
    const lineL = new THREE.Mesh(lineGeoL, matNeon);
    lineL.position.set(-1.3, 0.5, -1);
    airplaneMesh.add(lineL);

    const lineR = new THREE.Mesh(lineGeoL, matNeon);
    lineR.position.set(1.3, 0.5, -1);
    airplaneMesh.add(lineR);
}

// Normalized mouse position: -1 (left/top) to +1 (right/bottom)
let aimX = 0;   // positive = cursor right of center -> plane banks right
let aimY = 0;   // positive = cursor below center  -> plane noses down

// Free-look (C key) camera orbit
let isFreeLook = false;
let flOrbitYaw = 0;
let flOrbitPitch = 0;

function createWTUI() {
    if (window._wtUICreated) return;
    window._wtUICreated = true;
    const container = document.getElementById('flight-game-container');
    if (!container) return;

    // Aim cursor (white circle = where you want to go)
    const aim = document.createElement('div');
    aim.id = 'aim-cursor';
    aim.style.cssText = 'position:absolute;top:0;left:0;width:30px;height:30px;border:2px solid rgba(255,255,255,0.9);border-radius:50%;pointer-events:none;z-index:1000;transform:translate(-50%,-50%);';
    const aimDot = document.createElement('div');
    aimDot.style.cssText = 'position:absolute;top:50%;left:50%;width:4px;height:4px;background:white;border-radius:50%;transform:translate(-50%,-50%);';
    aim.appendChild(aimDot);
    container.appendChild(aim);
    window.aimCursorEl = aim;

    // Gun cross (green cross = where plane nose points)
    const cross = document.createElement('div');
    cross.id = 'nose-cross';
    cross.style.cssText = 'position:absolute;top:0;left:0;width:44px;height:44px;pointer-events:none;z-index:999;transform:translate(-50%,-50%);';
    const ch = document.createElement('div');
    ch.style.cssText = 'position:absolute;top:50%;left:0;width:100%;height:2px;background:rgba(0,255,136,0.95);transform:translateY(-50%);';
    const cv = document.createElement('div');
    cv.style.cssText = 'position:absolute;top:0;left:50%;width:2px;height:100%;background:rgba(0,255,136,0.95);transform:translateX(-50%);';
    cross.appendChild(ch); cross.appendChild(cv);
    container.appendChild(cross);
    window.noseCrossEl = cross;

    container.style.cursor = 'none';
}

function setupInputs() {
    createWTUI();

    window.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true;
        if (e.key === 'Shift') keys.shift = true;
        if (e.key === ' ') currentSpeed = 0;
        if (e.code === 'KeyC') isFreeLook = true;
    });
    window.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = false;
        if (e.key === 'Shift') keys.shift = false;
        if (e.code === 'KeyC') {
            isFreeLook = false;
            flOrbitYaw = 0;
            flOrbitPitch = 0;
        }
    });

    const container = document.getElementById('flight-game-container');
    if (!container) return;

    // Track raw pixel position for UI cursor element - default to center!
    let rawPX = container.clientWidth / 2;
    let rawPY = container.clientHeight / 2;

    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        rawPX = e.clientX - rect.left;
        rawPY = e.clientY - rect.top;

        const nx = (rawPX / rect.width)  * 2 - 1;   // -1 left, +1 right
        const ny = (rawPY / rect.height) * 2 - 1;   // -1 top,  +1 bottom

        if (isFreeLook) {
            // Free-look: move camera without changing aim target
            flOrbitYaw   = -nx * Math.PI * 0.7; // up to ~126 deg side
            flOrbitPitch =  ny * Math.PI * 0.4; // up to ~72 deg up/down
            
            // Lock target immediately when free look starts if null
            if (!window._lockedTargetWS && window._lastTargetWS) {
                window._lockedTargetWS = window._lastTargetWS.clone();
            }
        } else {
            aimX = nx;
            aimY = ny;
            window._lockedTargetWS = null; // Release lock
        }

        if (window.aimCursorEl) {
            window.aimCursorEl.style.left = rawPX + 'px';
            window.aimCursorEl.style.top  = rawPY + 'px';
            window.aimCursorEl.style.transform = 'translate(-50%,-50%)';
        }
    });
}


function animate(time) {
    requestAnimationFrame(animate);
    if (!isStarted) return;
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    // MISSILE
    if (keys['q'] && !lastQ) { fireMissile(); lastQ = true; }
    if (!keys['q']) lastQ = false;

    // Missile Update
    for (let i = missiles.length - 1; i >= 0; i--) {
        missiles[i].life -= dt;
        const speed = missiles[i].speed || 1000;
        missiles[i].mesh.position.add(missiles[i].dir.clone().multiplyScalar(speed * dt));

        let hit = false;
        // Check missile collision
        for (let obj of allObjects) {
            if (obj.userData.type === "RING" || obj.userData.type === "SQUARE") continue;

            let radius = (obj.userData.width || 200) / 2;
            if (obj.userData.type === "WALL") radius = 500;
            else if (obj.userData.type === "BUILDING") radius = (obj.userData.width || 800) / 2;

            if (missiles[i].mesh.position.distanceTo(obj.position) < radius) {
                hit = true;
                break;
            }
        }

        if (hit || missiles[i].life <= 0) {
            if (hit) createExplosion(missiles[i].mesh.position);
            scene.remove(missiles[i].mesh);
            missiles.splice(i, 1);
        }
    }

    // Explosion Update
    for (let i = explosions.length - 1; i >= 0; i--) {
        explosions[i].life -= dt;
        const positions = explosions[i].mesh.geometry.attributes.position.array;
        const vels = explosions[i].velocities;
        for (let j = 0; j < vels.length / 3; j++) {
            positions[j * 3] += vels[j * 3] * dt * 20;
            positions[j * 3 + 1] += vels[j * 3 + 1] * dt * 20;
            positions[j * 3 + 2] += vels[j * 3 + 2] * dt * 20;
        }
        explosions[i].mesh.geometry.attributes.position.needsUpdate = true;
        explosions[i].mesh.material.opacity = Math.max(0, explosions[i].life * 2);

        if (explosions[i].life <= 0) {
            scene.remove(explosions[i].mesh);
            explosions.splice(i, 1);
        }
    }

    // FLAME FX
    const fScale = keys.shift ? 1 : 0;
    flames.forEach(f => f.scale.lerp(new THREE.Vector3(fScale, fScale, fScale * 2), dt * 10));

    // Cloud Animation
    clouds.forEach(c => {
        c.position.z += c.userData.velocity * dt;
        if (c.position.z > 12000) c.position.z = -12000;
    });

    // --- PHYSICS SUB-STEPPING (Prevent tunneling) ---
    const steps = 4;
    const subDt = dt / steps;

    for (let s = 0; s < steps; s++) {
        // ===================================================
        // STALL CHECK (Realistic mode)
        // ===================================================
        if (activeFlightMode === 'real' && isStalling) {
            // During stall: disable instructor, let gravity pull tail down (plane flips nose up → tail slides)
            stallTimer -= subDt;
            // Push tail DOWN: apply angular momentum to rotate plane nose-up/backward
            pitchVel -= subDt * 1.5;   // pitch nose backward
            rollVel  *= 0.9;           // damp roll
            // Speed bleeds to 0 and slightly negative (falling)
            currentSpeed -= subDt * 2.0;
            if (currentSpeed < -1.5) currentSpeed = -1.5;
            if (stallTimer <= 0 && currentSpeed > -0.5) {
                // Recovery: if the plane has fallen enough and has some downward speed, exit stall
                isStalling = false;
            }
        } else {
        // ===================================================
        // MOVEMENT
        // ===================================================
        const targetMax = keys.shift ? BOOST_MAX_SPEED : BASE_MAX_SPEED;
        const accel = keys.shift ? BOOST_ACCEL : ACCEL;
        if (keys['w']) { if (currentSpeed < targetMax) currentSpeed += accel; }
        if (keys['s']) currentSpeed -= DECEL;

        if (activeFlightMode === 'real') {
            // ---- REALISTIC AERODYNAMICS ----
            // Get nose pitch angle vs horizontal world plane
            const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(airplaneContainer.quaternion);
            const sinPitch = fwd.y; // +1 = straight up, -1 = straight down

            // Climbing slows down (gravity component), diving speeds up
            const gravEffect = sinPitch * subDt * 3.5;
            currentSpeed -= gravEffect;

            // Hard cap at BOOST_MAX_SPEED
            if (currentSpeed > BOOST_MAX_SPEED) currentSpeed = BOOST_MAX_SPEED;

            // STALL: if speed drops near 0 and nose is up, enter stall
            if (currentSpeed < 0.2 && sinPitch > 0.3 && !isStalling) {
                isStalling = true;
                stallTimer = 2.0; // 2 seconds of uncontrolled stall
            }
        } else {
            // Arcade: soft cap
            if (currentSpeed > targetMax) currentSpeed -= DECEL * 4;
        }

        // Prevent reversing unless crash bounce
        if (!scene.userData.crashCooldown) {
            if (currentSpeed < 0) currentSpeed = 0;
        }
        } // end non-stall block

        // ===================================================
        // WAR THUNDER MOUSE AIM – UNPROJECT METHOD
        // ===================================================
        const TURN_RATE = 2.8;   // overall responsiveness
        
        let targetWS;
        if (isFreeLook && window._lockedTargetWS) {
            targetWS = window._lockedTargetWS.clone();
        } else {
            // 1. Get exact 3D target point based on screen cursor and current camera
            const cursorNDC = new THREE.Vector3(aimX, -aimY, 0.5);
            cursorNDC.unproject(camera);
            
            // Ray from camera through cursor
            const aimDir = cursorNDC.sub(camera.position).normalize();
            
            // Target is far out along that ray
            const REACH = 2000;
            targetWS = camera.position.clone().addScaledVector(aimDir, REACH);
            window._lastTargetWS = targetWS.clone();
        }

        // 2. Convert target to plane's local space for Pitch and Yaw elevators
        const toTargetLocal = targetWS.clone()
            .sub(airplaneContainer.position)
            .applyQuaternion(airplaneContainer.quaternion.clone().invert());

        // Angular errors (radians)  – local -Z is forward
        const pitchErr =  Math.atan2(toTargetLocal.y,  -toTargetLocal.z); // +ve = nose must go up
        const yawErr   =  Math.atan2(toTargetLocal.x,  -toTargetLocal.z); // +ve = nose must go right

        // 3. Drive pitch and yaw toward zero error (Local pitch/yaw physics)
        pitchVel += pitchErr * TURN_RATE * subDt;
        yawVel   -= yawErr   * TURN_RATE * subDt * 0.4;

        // 4. Auto-bank & Auto-level: War Thunder Style (Pilot Head Leveling)
        // We calculate "unrolled" yaw error—is the target to the true left or right 
        // regardless of how much the plane is currently rolling?
        const planeFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(airplaneContainer.quaternion);
        let unrolledRight = planeFwd.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
        if (unrolledRight.lengthSq() < 0.001) unrolledRight.set(1, 0, 0); // Anti-gimbal lock if completely vertical
        
        const toTargetWorld = targetWS.clone().sub(airplaneContainer.position);
        const unrolledYawErr = Math.atan2(toTargetWorld.dot(unrolledRight), toTargetWorld.dot(planeFwd)); // +ve = target is RIGHT
        
        // Calculate where the real "Sky" (World UP) is in the pilot's view to prevent staying upside down
        const localWorldUp = new THREE.Vector3(0, 1, 0)
            .applyQuaternion(airplaneContainer.quaternion.clone().invert());
        
        // currentRoll: 0 = level, +PI/2 = banked left, -PI/2 = banked right, +/-PI = upside down (belly up)
        const currentRoll = Math.atan2(localWorldUp.x, localWorldUp.y);
        
        // targetRoll: Bank right (negative roll) if target is right (positive unrolledYawErr)
        const maxBank = Math.PI * 0.45; // ~81 degrees max bank ensures pilot head looks into turn
        const targetRoll = -Math.max(-1, Math.min(1, unrolledYawErr * 2.5)) * maxBank;
        
        let rollError = targetRoll - currentRoll;
        // Normalize angle difference to [-PI, PI] to always roll the shortest way and instantly correct upside-down
        while (rollError > Math.PI) rollError -= Math.PI * 2;
        while (rollError < -Math.PI) rollError += Math.PI * 2;
        
        // 5. Manual roll override (A/D or arrow keys)
        const isLeft  = keys['a'] || keys['arrowleft'];
        const isRight = keys['d'] || keys['arrowright'];

        if (isLeft || isRight) {
            // --- 360-DEGREE FREE ROLL ---
            // Completely suppress the auto-level instructor when A/D is held.
            // This allows full barrel rolls without the instructor fighting back.
            if (isLeft)  rollVel += subDt * 10;
            if (isRight) rollVel -= subDt * 10;
            // Do NOT add rollError correction while key is held
        } else if (!isStalling) {
            // Apply auto-level only when not manually rolling and not stalling
            rollVel += rollError * TURN_RATE * subDt * 3.0;
        }

        // 6. Clamp velocities
        pitchVel = Math.max(-2, Math.min(2, pitchVel));
        yawVel   = Math.max(-1, Math.min(1, yawVel));
        rollVel  = Math.max(-3, Math.min(3, rollVel));

        // Damping adjusted for sub-steps
        pitchVel *= Math.pow(ROT_DAMPING, 1 / steps);
        rollVel *= Math.pow(ROT_DAMPING, 1 / steps);
        yawVel *= Math.pow(ROT_DAMPING, 1 / steps);

        airplaneContainer.rotateX(pitchVel * subDt);
        airplaneContainer.rotateZ(rollVel * subDt);
        airplaneContainer.rotateY(yawVel * subDt);

        // GRAVITY
        const lift = Math.max(0, currentSpeed) * 8.0 * subDt;
        airplaneContainer.position.y -= GRAVITY * subDt;
        airplaneContainer.position.y += lift * Math.cos(airplaneContainer.rotation.z);

        const moveDist = currentSpeed * 200 * subDt;
        airplaneContainer.translateZ(-moveDist);

        // --- HARD BOUNDARY CLAMP (Arena Box — only small map) ---
        if (arenaConstraintEnabled) {
            const PADDING = 100;
            let clamped = false;
            if (airplaneContainer.position.x < -3000 + PADDING) { airplaneContainer.position.x = -3000 + PADDING; clamped = true; }
            if (airplaneContainer.position.x >  3000 - PADDING) { airplaneContainer.position.x =  3000 - PADDING; clamped = true; }
            if (airplaneContainer.position.z < -6000 + PADDING) { airplaneContainer.position.z = -6000 + PADDING; clamped = true; }
            if (airplaneContainer.position.z >  6000 - PADDING) { airplaneContainer.position.z =  6000 - PADDING; clamped = true; }
            if (airplaneContainer.position.y > 30000 - PADDING) { airplaneContainer.position.y = 30000 - PADDING; clamped = true; }
            if (clamped && currentSpeed > 1) {
                currentSpeed = 0.5;
                airplaneContainer.translateZ(10);
            }
        }

        // Get plane position for collision
        const planePos = airplaneContainer.position;

        // COLLISION DETECTION
        const points = [
            new THREE.Vector3(0, 0, -8),   // Nose tip
            new THREE.Vector3(0, 0, 0),    // Center
            new THREE.Vector3(7, 0, 0),    // Left wing tip
            new THREE.Vector3(-7, 0, 0),   // Right wing tip
            new THREE.Vector3(0, 1, 0)     // Top center
        ];
        const worldPoints = points.map(p => p.clone().applyMatrix4(airplaneContainer.matrixWorld));

        let crash = false;
        for (let obj of allObjects) {
            if (obj.userData.type === "RING" || obj.userData.type === "SQUARE") continue;

            // Fast Building Check (Cylinder/Box approx)
            if (obj.userData.type === "BUILDING") {
                // Radius check first
                const radius = Math.max(obj.userData.width, obj.userData.depth) / 2;
                if (planePos.y > obj.userData.height) continue;

                const dist = Math.sqrt(Math.pow(planePos.x - obj.position.x, 2) + Math.pow(planePos.z - obj.position.z, 2));
                if (dist < radius + 10) {
                    crash = true;
                    break;
                }
                continue;
            }

            // Box Collision (Bridge, Wall, etc)
            let bW = obj.userData.width || 100;
            let bD = obj.userData.depth || 100;
            let bH = obj.userData.height || 100;
            if (obj.userData.type === "WALL") { bW += 50; bD += 50; }

            const halfW = bW / 2;
            const halfD = bD / 2;

            for (let wp of worldPoints) {
                // For city buildings, use the stored world-space position
                const objX = obj.userData._wx !== undefined ? obj.userData._wx : obj.position.x;
                const objZ = obj.userData._wz !== undefined ? obj.userData._wz : obj.position.z;
                const dx = wp.x - objX;
                const dz = wp.z - objZ;
                if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
                    if (wp.y < bH) {
                        crash = true;
                        break;
                    }
                }
            }
            if (crash) break;
        }

        if (crash) {
            if (!scene.userData.crashCooldown) {
                scene.userData.crashCooldown = 0.5; // 0.5 second cooldown
                console.log("CRASH - BOUNCE");

                // BOUNCE LOGIC (Reset speed positive to prevent infinite backward tumbling)
                currentSpeed = 0.5;
                pitchVel *= 0.2; // kill wild spins
                rollVel *= 0.2;
                yawVel *= 0.2;

                airplaneContainer.translateZ(30); // Immediate push to clear collider
            }
        }
    }

    // Update Sun & Stars outside loop
    const planePos = airplaneContainer.position;
    scene.userData.sun.position.set(planePos.x + 200, planePos.y + 500, planePos.z + 200);
    scene.userData.sun.target.position.copy(planePos);
    scene.userData.sun.target.updateMatrixWorld();
    starsSystem.position.copy(planePos);

    // Infinite city chunk streaming (large map mode)
    updateInfiniteCity(planePos);
    // Timer updates
    if (scene.userData.crashCooldown > 0) scene.userData.crashCooldown -= dt;

    if (airplaneContainer.position.y < 5.0) {
        airplaneContainer.position.y = 5.0;
        if (pitchVel < 0) pitchVel = 0;
        if (currentSpeed > 1.0) currentSpeed = 0.5; // Drag on ground
        if (currentSpeed < 0) currentSpeed = 0; // Prevent infinite backwards sliding
    }

    // ===================================================
    // CAMERA – Smooth Chase Cam (War Thunder Style)
    // ===================================================
    const planeFwdCam = new THREE.Vector3(0, 0, -1)
        .applyQuaternion(airplaneContainer.quaternion);

    // Speed-based zoom
    const speedFactor = currentSpeed / BASE_MAX_SPEED;
    const camDist   = 55 + speedFactor * 20;
    const camHeight = 15 + speedFactor * 6;

    // We want the camera to lag smoothly behind the plane's actual motion.
    let camIdeal = planePos.clone().addScaledVector(planeFwdCam, -camDist);
    camIdeal.y += camHeight; // Stay slightly above to look down the nose
    
    // Optional free-look offset (C key)
    if (isFreeLook) {
        const offset = camIdeal.clone().sub(planePos);
        const flQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(flOrbitPitch, flOrbitYaw, 0, 'YXZ'));
        offset.applyQuaternion(flQuat);
        camIdeal = planePos.clone().add(offset);
    }

    // Boost shake
    if (keys.shift && currentSpeed > 2.0) {
        const sh = 0.5;
        camIdeal.x += (Math.random() - 0.5) * sh;
        camIdeal.y += (Math.random() - 0.5) * sh * 0.2;
    }

    // Fast lerp gives a slight elastic feel but prevents tracking lag completely
    camera.position.lerp(camIdeal, 0.4);
    camera.up.set(0, 1, 0); // horizon always level
    
    // Look slightly ahead of the plane
    const lookTarget = planePos.clone().addScaledVector(planeFwdCam, 15);
    camera.lookAt(lookTarget);

    // Nose crosshair (green cross projected onto screen)
    if (window.noseCrossEl) {
        const noseWS = planePos.clone().addScaledVector(planeFwdCam, 2000);
        const ndc = noseWS.clone().project(camera);
        const rect = document.getElementById('flight-game-container').getBoundingClientRect();
        const px = (ndc.x * 0.5 + 0.5) * rect.width;
        const py = (-ndc.y * 0.5 + 0.5) * rect.height;
        if (ndc.z < 1) {
            window.noseCrossEl.style.display = 'block';
            window.noseCrossEl.style.left = px + 'px';
            window.noseCrossEl.style.top  = py + 'px';
            window.noseCrossEl.style.transform = 'translate(-50%,-50%)';
        } else {
            window.noseCrossEl.style.display = 'none';
        }
    }

    // Update speed display
    updateSpeedHUD();

    renderer.render(scene, camera);
}

// Note: respawnObject removed as arena is fixed

// === SPEED HUD ===
let speedHUD = null;

function createSpeedHUD() {
    speedHUD = document.createElement('div');
    speedHUD.id = 'speed-hud';
    speedHUD.style.cssText = `
        position: absolute;
        bottom: 30px;
        left: 30px;
        color: #00ff88;
        font-family: 'Outfit', sans-serif;
        font-size: 28px;
        font-weight: bold;
        text-shadow: 0 0 10px #00ff88, 2px 2px 4px rgba(0,0,0,0.8);
        z-index: 100;
        pointer-events: none;
    `;
    const container = document.getElementById('flight-game-container');
    if (container) container.appendChild(speedHUD);
}

function updateSpeedHUD() {
    if (!speedHUD) createSpeedHUD();
    if (speedHUD) {
        const kmh = Math.round(currentSpeed * 100); // Convert to km/h display
        speedHUD.textContent = `${kmh} km/h`;
        // Color change based on speed
        if (keys.shift && currentSpeed > 2) {
            speedHUD.style.color = '#ff4444';
            speedHUD.style.textShadow = '0 0 15px #ff4444, 2px 2px 4px rgba(0,0,0,0.8)';
        } else {
            speedHUD.style.color = '#00ff88';
            speedHUD.style.textShadow = '0 0 10px #00ff88, 2px 2px 4px rgba(0,0,0,0.8)';
        }
    }
}

export function focusFlight() {
    window.focus();
    // Clear any stuck keys
    Object.keys(keys).forEach(k => keys[k] = false);
}

// Window resize handling
window.addEventListener('resize', () => {
    if (camera && renderer) {
        const container = document.getElementById('flight-game-container');
        if (container) {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    }
});
