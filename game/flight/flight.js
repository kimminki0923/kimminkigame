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
const CHUNK_SIZE = 3500; // Larger chunks, fewer updates
const CHUNK_RENDER_RADIUS = 2; // 5x5 chunks (25 total) is enough for ~10km visibility
let chunksDirty = true;




window.applyFlightSettings = function () {
    const newMap  = window.flightMapSize  || 'small';
    const newMode = window.flightMode     || 'arcade';
    if (newMap !== activeMapSize || newMode !== activeFlightMode) {
        activeMapSize  = newMap;
        activeFlightMode = newMode;
        // Safety guard: only rebuild if game has actually started
        if (isStarted && scene) {
            rebuildWorld();
        }
    }
};

// Multiplayer - Other Players
window.otherPlayersInScene = {};

// Export player position for multiplayer sync
window.getPlayerPosition = function () {
    if (!isStarted || !airplaneContainer) return null;
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
const ACCEL = 1.5;         // units/sec
let BOOST_ACCEL = 6.0;   // Increased for better 체감
const DECEL = 1.0;         // units/sec



let verticalVel = 0;      // m/s downward or upward (m per unit frame)


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
    createCommonObjects(); // Always create stars, clouds, etc.
    if (activeMapSize === 'large') {
        createInfiniteCity();
    } else {
        createEnvironment();
    }
}

function createCommonObjects() {
    // 5. SPEED PARTICLES (larger spread)
    if (starsSystem) scene.remove(starsSystem);
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

    createClouds();
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

    // Large dark ground (extended for fixed map feel)
    const groundGeo = new THREE.PlaneGeometry(100000, 100000);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    cityRoot.add(ground);

    // Create Runway Mesh
    const runwayGeo = new THREE.PlaneGeometry(600, 8000);
    const runwayMat = new THREE.MeshStandardMaterial({ 
        color: 0x222222, 
        emissive: 0x111111,
        roughness: 0.4 
    });
    const runway = new THREE.Mesh(runwayGeo, runwayMat);
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(0, 0.5, 7000); // Runway from Z=3000 to Z=11000
    cityRoot.add(runway);

    // Runway Lines
    const lineGeo = new THREE.PlaneGeometry(40, 200);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 20; i++) {
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(0, 0.6, 3500 + i * 400);
        cityRoot.add(line);
    }


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
    const key = cx + "_" + cz;
    if (cityChunks[key]) return false;

    const group = new THREE.Group();
    group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    cityRoot.add(group);

    // Building EXCLUSION: No buildings near X=0 center strip (Runway zone)
    const isRunwayZone = (cx === 0 && cz >= 1 && cz <= 3);

    const rng = seededRandom(cx * 104729 + cz * 224737);

    
    // Clear Block Design: 3x3 blocks per chunk with wide roads
    const NUM_BLOCKS = 3;
    const blockSize = (CHUNK_SIZE / NUM_BLOCKS) * 0.75; // 25% space for roads
    const blockGap = (CHUNK_SIZE / NUM_BLOCKS) * 0.25;

    // Asphalt Floor for the whole chunk
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE), groundMat);
    ground.rotation.x = -Math.PI / 2;
    group.add(ground);

    const palette = [0x2c3e50, 0x34495e, 0x2c3e45, 0x7f8c8d, 0x2980b9, 0xc0392b, 0xbdc3c7, 0xecf0f1];

    for (let i = 0; i < NUM_BLOCKS; i++) {
        for (let j = 0; j < NUM_BLOCKS; j++) {
            // Center of each block
            const bx = (i - (NUM_BLOCKS-1)/2) * (blockSize + blockGap);
            const bz = (j - (NUM_BLOCKS-1)/2) * (blockSize + blockGap);
            
            // Create a Block Platform (Skip if runway zone)
            if (isRunwayZone && Math.abs(bx) < 600) continue;

            const blockMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.95 });
            const platform = new THREE.Mesh(new THREE.BoxGeometry(blockSize * 0.98, 10, blockSize * 0.98), blockMat);
            platform.position.set(bx, 5, bz);
            group.add(platform);


            // Populate buildings inside block
            const buildingsPerBlock = 2 + Math.floor(rng() * 4);
            for (let k = 0; k < buildingsPerBlock; k++) {
                const b_type = rng();
                const bw = blockSize * (0.2 + rng() * 0.3);
                const bd = blockSize * (0.2 + rng() * 0.3);
                const bh = 300 + rng() * 2000;
                
                const bpx = bx + (rng() - 0.5) * (blockSize * 0.6);
                const bpz = bz + (rng() - 0.5) * (blockSize * 0.6);
                
                const mat = new THREE.MeshStandardMaterial({ 
                    color: palette[Math.floor(rng() * palette.length)],
                    roughness: 0.3, metalness: 0.5
                });

                const bGroup = new THREE.Group();
                bGroup.position.set(bpx, 0, bpz);
                group.add(bGroup);

                if (b_type < 0.4) {
                    // L-SHAPED building
                    const b1 = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
                    b1.position.y = bh/2;
                    bGroup.add(b1);
                    const b2 = new THREE.Mesh(new THREE.BoxGeometry(bw, bh * 0.7, bd * 2), mat);
                    b2.position.set(bw/2, (bh*0.7)/2, bd/2);
                    bGroup.add(b2);
                } else if (b_type < 0.7) {
                    // TIERED CYLINDER
                    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(bw/2, bw/2, bh, 16), mat);
                    mesh.position.y = bh/2;
                    bGroup.add(mesh);
                    const tier = new THREE.Mesh(new THREE.CylinderGeometry(bw/3, bw/3, bh*0.2, 16), mat);
                    tier.position.y = bh + (bh*0.2)/2;
                    bGroup.add(tier);
                } else {
                    // TIERED BOX
                    const b1 = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
                    b1.position.y = bh/2;
                    bGroup.add(b1);
                    const b2 = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.6, bh * 0.4, bd * 0.6), mat);
                    b2.position.y = bh + (bh*0.4)/2;
                    bGroup.add(b2);
                }

                // Metadata for collision (World Positions)
                bGroup.userData.type = 'BUILDING';
                bGroup.userData.width = bw * 1.5;
                bGroup.userData.depth = bd * 1.5;
                bGroup.userData.height = bh * 1.5;
                
                bGroup.userData._wx = cx * CHUNK_SIZE + bpx;
                bGroup.userData._wz = cz * CHUNK_SIZE + bpz;
            }
        }
    }

    cityChunks[key] = group;
    return true;
}




function updateInfiniteCity(planePos) {
    if (!cityRoot || activeMapSize !== 'large') return;

    const pcx = Math.round(planePos.x / CHUNK_SIZE);
    const pcz = Math.round(planePos.z / CHUNK_SIZE);

    let changed = false;
    for (let cx = pcx - CHUNK_RENDER_RADIUS; cx <= pcx + CHUNK_RENDER_RADIUS; cx++) {
        for (let cz = pcz - CHUNK_RENDER_RADIUS; cz <= pcz + CHUNK_RENDER_RADIUS; cz++) {
            if (spawnCityChunk(cx, cz)) {
                changed = true;
            }
        }
    }

    // Cull far chunks
    for (const key of Object.keys(cityChunks)) {
        const [kcx, kcz] = key.split('_').map(Number);
        if (Math.abs(kcx - pcx) > CHUNK_RENDER_RADIUS + 1 || Math.abs(kcz - pcz) > CHUNK_RENDER_RADIUS + 1) {
            if (cityRoot) cityRoot.remove(cityChunks[key]);
            delete cityChunks[key];
            changed = true;
        }
    }

    if (changed) chunksDirty = true;
    
    if (chunksDirty) {
        // Rebuild collision list only when needed
        allObjects = [];
        for (const group of Object.values(cityChunks)) {
            group.children.forEach(child => {
                if (child.userData.type === 'BUILDING') {
                    allObjects.push(child);
                }
            });
        }
        chunksDirty = false;
    }
}



function applyModeSpeedLimits() {
    if (activeFlightMode === 'real') {
        BASE_MAX_SPEED  = 5.0;  // base 500 km/h — can grav-dive past this
        BOOST_MAX_SPEED = 12.0; // 1200 km/h
    } else {
        BASE_MAX_SPEED  = 3.5;
        BOOST_MAX_SPEED = 9.0; // 900 km/h
    }

}


function rebuildWorld() {
    // Clear old scene objects (keep airplane & renderer)
    applyModeSpeedLimits();

    // 1. Remove specific tracked objects from scene
    allObjects.forEach(obj => { if (obj.parent) obj.parent.remove(obj); });
    allObjects = [];

    missiles.forEach(m => { if (m.mesh.parent) m.mesh.parent.remove(m.mesh); });
    missiles = [];

    explosions.forEach(e => { if (e.mesh.parent) e.mesh.parent.remove(e.mesh); });
    explosions = [];

    // Clear city chunks
    clearInfiniteCity();

    // 2. Remove old groups by name
    const toRemove = [];
    scene.traverse(obj => {
        if (obj.name === 'arenaRoot' || obj.name === 'cityRoot' || obj.name === 'cloudRoot') {
            toRemove.push(obj);
        }
    });
    toRemove.forEach(g => {
        if (g.parent) g.parent.remove(g);
    });

    // 3. Reset internal state
    verticalVel = 0;
    currentSpeed = 0;
    pitchVel = 0; rollVel = 0; yawVel = 0;
    
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
    arenaGroup.name = 'arenaRoot';
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
        cloudGroup.name = 'cloudRoot';
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
    
    if (activeMapSize === 'large') {
        // Start on runway at 0 altitude
        airplaneContainer.position.set(0, 6, 3500); 
    } else {
        airplaneContainer.position.set(0, 500, 4000); 
    }
    
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
        // 1. MOVEMENT & PHYSICS (Sub-stepping)
        // ===================================================
        const targetMax = keys.shift ? BOOST_MAX_SPEED : BASE_MAX_SPEED;
        const accelVal = keys.shift ? BOOST_ACCEL : ACCEL;
        
        if (activeFlightMode === 'real') {
            // ---- REALISTIC AERODYNAMICS (Lift & Weight Model) ----
            const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(airplaneContainer.quaternion);
            const pitchSin = fwd.y; // Nose pitch angle sin
            const cosPitch = Math.max(0.01, Math.sqrt(1 - pitchSin * pitchSin));

            // A. Engine Power
            if (keys['w']) {
                if (currentSpeed < targetMax) currentSpeed += (accelVal * 0.3) * subDt; // Slower engine accel
            }
            if (keys['s']) currentSpeed -= DECEL * 4 * subDt;

            // B. Lift Calculation
            const liftCoeff = 0.45; 
            const speedSq = Math.max(0, currentSpeed * currentSpeed);
            const liftForce = speedSq * liftCoeff * cosPitch * 100.0; // Scaled up

            // C. Gravity Exchange (Pitch affects speed)
            currentSpeed -= pitchSin * 2.5 * subDt; // Climbing slows, diving speeds up
            
            const dragCoeff = 0.04;
            const gravityForce = 45.0; // Static gravity pull

            // Apply total vertical acceleration
            verticalVel += (liftForce - GRAVITY * 80.0) * subDt; // Scaled gravity/lift
            
            // Atmospheric damping
            verticalVel *= Math.pow(0.98, subDt * 60);

            if (currentSpeed < 0) currentSpeed = 0;
            if (currentSpeed > BOOST_MAX_SPEED + 10) currentSpeed = BOOST_MAX_SPEED + 10; 

            // Movement
            airplaneContainer.translateZ(-currentSpeed * subDt * 60);
            airplaneContainer.position.y += verticalVel * subDt * 60;
        } else {
            // Arcade Mode
            if (keys['w']) {
                if (currentSpeed < targetMax) currentSpeed += accelVal * subDt;
            } else if (keys['s']) {
                currentSpeed -= DECEL * 4 * subDt;
            } else {
                if (currentSpeed > 2.0) currentSpeed -= DECEL * 0.5 * subDt;
                if (currentSpeed < 2.0) currentSpeed += ACCEL * 0.5 * subDt;
            }
            if (currentSpeed < 0) currentSpeed = 0;

            airplaneContainer.translateZ(-currentSpeed * subDt * 60);
            verticalVel = 0;
        }

        // Final NaN guard
        if (isNaN(currentSpeed)) currentSpeed = 0;
        if (isNaN(verticalVel)) verticalVel = 0;

        // ===================================================
        // 2. MOUSE AIM & ROTATION (Sub-stepping)
        // ===================================================
        const TURN_RATE = 2.8;   
        
        let targetWS;
        if (isFreeLook && window._lockedTargetWS) {
            targetWS = window._lockedTargetWS.clone();
        } else {
            const cursorNDC = new THREE.Vector3(aimX, -aimY, 0.5);
            cursorNDC.unproject(camera);
            const aimDir = cursorNDC.sub(camera.position).normalize();
            const REACH = 2000;
            targetWS = camera.position.clone().addScaledVector(aimDir, REACH);
            window._lastTargetWS = targetWS.clone();
        }

        const toTargetLocal = targetWS.clone()
            .sub(airplaneContainer.position)
            .applyQuaternion(airplaneContainer.quaternion.clone().invert());

        const pitchErr = Math.atan2(toTargetLocal.y, -toTargetLocal.z); 
        const yawErr   = Math.atan2(toTargetLocal.x, -toTargetLocal.z); 

        // Rotation control relies on airflow (speed)
        const controlAuth = Math.min(1.0, currentSpeed / 1.0); 
        pitchVel += pitchErr * TURN_RATE * subDt * controlAuth;
        yawVel   -= yawErr   * TURN_RATE * subDt * 0.4 * controlAuth;

        // Auto-bank / Auto-level
        const planeFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(airplaneContainer.quaternion);
        let unrolledRight = planeFwd.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
        if (unrolledRight.lengthSq() < 0.001) unrolledRight.set(1, 0, 0); 
        
        const toTargetWorld = targetWS.clone().sub(airplaneContainer.position);
        const unrolledYawErr = Math.atan2(toTargetWorld.dot(unrolledRight), toTargetWorld.dot(planeFwd)); 
        
        const localWorldUp = new THREE.Vector3(0, 1, 0)
            .applyQuaternion(airplaneContainer.quaternion.clone().invert());
        const currentRoll = Math.atan2(localWorldUp.x, localWorldUp.y);
        
        const maxBank = Math.PI * 0.45; 
        const targetRoll = -Math.max(-1, Math.min(1, unrolledYawErr * 2.5)) * maxBank;
        
        let rollError = targetRoll - currentRoll;
        while (rollError > Math.PI) rollError -= Math.PI * 2;
        while (rollError < -Math.PI) rollError += Math.PI * 2;
        
        const isLeft  = keys['a'] || keys['arrowleft'];
        const isRight = keys['d'] || keys['arrowright'];

        if (isLeft || isRight) {
            if (isLeft)  rollVel += subDt * 10 * controlAuth;
            if (isRight) rollVel -= subDt * 10 * controlAuth;
        } else {
            rollVel += rollError * TURN_RATE * subDt * 3.0 * controlAuth;
        }

        pitchVel = Math.max(-2, Math.min(2, pitchVel));
        yawVel   = Math.max(-1, Math.min(1, yawVel));
        rollVel  = Math.max(-3, Math.min(3, rollVel));

        pitchVel *= Math.pow(ROT_DAMPING, 1 / steps);
        rollVel  *= Math.pow(ROT_DAMPING, 1 / steps);
        yawVel   *= Math.pow(ROT_DAMPING, 1 / steps);

        airplaneContainer.rotateX(pitchVel * subDt);
        airplaneContainer.rotateZ(rollVel * subDt);
        airplaneContainer.rotateY(yawVel * subDt);

        // ===================================================
        // 3. COLLISION (Sub-stepping - Optimized to check only local chunks)
        // ===================================================
        if (arenaConstraintEnabled) {
            const PADDING = 100;
            if (airplaneContainer.position.x < -3000 + PADDING) airplaneContainer.position.x = -3000 + PADDING;
            if (airplaneContainer.position.x >  3000 - PADDING) airplaneContainer.position.x =  3000 - PADDING;
            if (airplaneContainer.position.z < -6000 + PADDING) airplaneContainer.position.z = -6000 + PADDING;
            if (airplaneContainer.position.z >  6000 - PADDING) airplaneContainer.position.z =  6000 - PADDING;
            if (airplaneContainer.position.y > 30000 - PADDING) airplaneContainer.position.y = 30000 - PADDING;
        }

        const planePos = airplaneContainer.position;
        const pcx = Math.round(planePos.x / CHUNK_SIZE);
        const pcz = Math.round(planePos.z / CHUNK_SIZE);

        const worldPoints = [
            new THREE.Vector3(0, 0, -8).applyMatrix4(airplaneContainer.matrixWorld),
            new THREE.Vector3(0, 0, 0).applyMatrix4(airplaneContainer.matrixWorld),
            new THREE.Vector3(7, 0, 0).applyMatrix4(airplaneContainer.matrixWorld),
            new THREE.Vector3(-7, 0, 0).applyMatrix4(airplaneContainer.matrixWorld),
            new THREE.Vector3(0, 1, 0).applyMatrix4(airplaneContainer.matrixWorld)
        ];

        let crash = false;
        // Search only in neighboring chunks (9 chunks total)
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const chunk = cityChunks[(pcx + dx) + "_" + (pcz + dz)];
                if (!chunk) continue;
                
                for (let obj of chunk.children) {
                    if (obj.userData.type !== 'BUILDING') continue;
                    
                    const bW = (obj.userData.width || 100) / 2;
                    const bD = (obj.userData.depth || 100) / 2;
                    const bH = obj.userData.height || 100;

                    const objX = obj.userData._wx;
                    const objZ = obj.userData._wz;

                    // Broad phase
                    if (Math.abs(planePos.x - objX) > bW + 20 || Math.abs(planePos.z - objZ) > bD + 20) continue;

                    for (let wp of worldPoints) {
                        if (Math.abs(wp.x - objX) < bW && Math.abs(wp.z - objZ) < bD) {
                            if (wp.y < bH) { crash = true; break; }
                        }
                    }
                    if (crash) break;
                }
                if (crash) break;
            }
            if (crash) break;
        }

        if (crash) {

            if (!scene.userData.crashCooldown) {

                scene.userData.crashCooldown = 0.5;
                currentSpeed = 0.2;
                verticalVel = -2;
                airplaneContainer.translateZ(30);
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

    if (airplaneContainer.position.y < 6.1) {
        airplaneContainer.position.y = 6.0;
        // Subtle ground drag if not accelerating
        if (!keys['w']) {
            if (currentSpeed > 0.1) currentSpeed -= 1.0 * dt; 
        }
        if (pitchVel < 0) pitchVel *= 0.8; // Resistance to pitching down into ground
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

    // Boost FX: Shake & FOV Zoom
    let targetFOV = 60;
    if (keys.shift && currentSpeed > 2.0) {
        // Reduced shake intensity
        const sh = 0.15;
        camIdeal.x += (Math.random() - 0.5) * sh;
        camIdeal.y += (Math.random() - 0.5) * sh * 0.2;
        
        // Speed-based FOV increase (Zoom out feeling)
        const boostFactor = (currentSpeed - BASE_MAX_SPEED) / (BOOST_MAX_SPEED - BASE_MAX_SPEED);
        targetFOV = 60 + Math.max(0, boostFactor) * 25;
    }
    
    // Smoothly interpolate FOV
    if (camera.fov !== targetFOV) {
        camera.fov += (targetFOV - camera.fov) * 0.1;
        camera.updateProjectionMatrix();
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
