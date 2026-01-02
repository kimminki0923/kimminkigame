// flight.js – Visual Masterpiece & Precision Collision
// Features: 700km/h, Fly-through Rings, Speed Lines, Infinite Grid, Laser

import * as THREE from "three";

// --- GLOBAL STATE ---
let renderer, scene, camera;
let airplaneContainer;
let airplaneMesh;
let flames = [];
let missiles = [];
let starsSystem; // Particle system for speed
let isStarted = false;
let lastTime = 0;
let allObjects = [];

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
const BASE_MAX_SPEED = 3.0;   // 300 km/h display
const BOOST_MAX_SPEED = 6.0;  // 600 km/h display
const ACCEL = 0.03;
const BOOST_ACCEL = 0.08;
const DECEL = 0.015;

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

    initGraphics(container, canvas);
    createEnvironment();
    createHeroAirplane();
    setupInputs();

    isStarted = true;
    lastTime = performance.now();
    requestAnimationFrame(animate);
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

    // Boundary Walls (30000 height - complete box cage)\n    const wallHeight = 30000;\n    const wallThickness = 100;\n    const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.9 });\n\n    // Front/Back Walls\n    const fbWallGeo = new THREE.BoxGeometry(arenaWidth + wallThickness * 2, wallHeight, wallThickness);\n    const wallBack = new THREE.Mesh(fbWallGeo, wallMat);\n    wallBack.position.set(0, wallHeight / 2, -arenaLength / 2 - wallThickness / 2);\n    wallBack.receiveShadow = true;\n    wallBack.castShadow = true;\n    wallBack.userData.type = \"WALL\";\n    wallBack.userData.width = arenaWidth + wallThickness * 2;\n    wallBack.userData.height = wallHeight;\n    wallBack.userData.depth = wallThickness;\n    arenaGroup.add(wallBack);\n    allObjects.push(wallBack);\n\n    const wallFront = new THREE.Mesh(fbWallGeo, wallMat);\n    wallFront.position.set(0, wallHeight / 2, arenaLength / 2 + wallThickness / 2);\n    wallFront.receiveShadow = true;\n    wallFront.castShadow = true;\n    wallFront.userData.type = \"WALL\";\n    wallFront.userData.width = arenaWidth + wallThickness * 2;\n    wallFront.userData.height = wallHeight;\n    wallFront.userData.depth = wallThickness;\n    arenaGroup.add(wallFront);\n    allObjects.push(wallFront);\n\n    // Side Walls\n    const sideWallGeo = new THREE.BoxGeometry(wallThickness, wallHeight, arenaLength);\n    const wallLeft = new THREE.Mesh(sideWallGeo, wallMat);\n    wallLeft.position.set(-arenaWidth / 2 - wallThickness / 2, wallHeight / 2, 0);\n    wallLeft.receiveShadow = true;\n    wallLeft.castShadow = true;\n    wallLeft.userData.type = \"WALL\";\n    wallLeft.userData.width = wallThickness;\n    wallLeft.userData.height = wallHeight;\n    wallLeft.userData.depth = arenaLength;\n    arenaGroup.add(wallLeft);\n    allObjects.push(wallLeft);\n\n    const wallRight = new THREE.Mesh(sideWallGeo, wallMat);\n    wallRight.position.set(arenaWidth / 2 + wallThickness / 2, wallHeight / 2, 0);\n    wallRight.receiveShadow = true;\n    wallRight.castShadow = true;\n    wallRight.userData.type = \"WALL\";\n    wallRight.userData.width = wallThickness;\n    wallRight.userData.height = wallHeight;\n    wallRight.userData.depth = arenaLength;\n    arenaGroup.add(wallRight);\n    allObjects.push(wallRight);\n\n    // CEILING (Top of the box)\n    const ceilingGeo = new THREE.PlaneGeometry(arenaWidth, arenaLength);\n    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x87ceeb, side: THREE.DoubleSide }); // Sky blue\n    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);\n    ceiling.rotation.x = Math.PI / 2;\n    ceiling.position.y = wallHeight;\n    ceiling.userData.type = \"CEILING\";\n    ceiling.userData.height = wallHeight;\n    arenaGroup.add(ceiling);\n    allObjects.push(ceiling);\n\n    // 2. THE RIVER (10x scale)
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
    towerGroup.userData.width = baseSize * 2;
    towerGroup.userData.depth = baseSize * 2;
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

function setupInputs() {
    window.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true;
        if (e.key === "Shift") keys.shift = true;
        if (e.key === " ") currentSpeed = 0;
    });
    window.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = false;
        if (e.key === "Shift") keys.shift = false;
    });
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
    missiles.push({ mesh: m, dir: fwd, life: 2.0 });
}

function animate(time) {
    requestAnimationFrame(animate);
    if (!isStarted) return;
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    // MISSILE
    if (keys['q'] && !lastQ) { fireMissile(); lastQ = true; }
    if (!keys['q']) lastQ = false;
    for (let i = missiles.length - 1; i >= 0; i--) {
        missiles[i].life -= dt;
        missiles[i].mesh.position.add(missiles[i].dir.clone().multiplyScalar(1000 * dt));
        if (missiles[i].life <= 0) { scene.remove(missiles[i].mesh); missiles.splice(i, 1); }
    }

    // FLAME FX
    const fScale = keys.shift ? 1 : 0;
    flames.forEach(f => f.scale.lerp(new THREE.Vector3(fScale, fScale, fScale * 2), dt * 10));

    // --- PHYSICS SUB-STEPPING (Prevent tunneling) ---
    const steps = 4;
    const subDt = dt / steps;

    for (let s = 0; s < steps; s++) {
        // MOVEMENT
        const targetMax = keys.shift ? BOOST_MAX_SPEED : BASE_MAX_SPEED;
        const accel = keys.shift ? BOOST_ACCEL : ACCEL;
        if (keys['w']) { if (currentSpeed < targetMax) currentSpeed += accel; }
        if (keys['s']) currentSpeed -= DECEL;
        if (currentSpeed > targetMax) currentSpeed -= DECEL * 4;
        if (currentSpeed < 0) currentSpeed = 0; if (currentSpeed > targetMax + 0.1) currentSpeed = targetMax + 0.1;

        let turnForce = subDt * 4.0;
        if (keys['arrowup']) pitchVel += turnForce;
        if (keys['arrowdown']) pitchVel -= turnForce;
        const isLeft = keys['a'] || keys['arrowleft'];
        const isRight = keys['d'] || keys['arrowright'];
        if (isLeft) { rollVel += turnForce * 2.0; yawVel += turnForce * 0.8; }
        if (isRight) { rollVel -= turnForce * 2.0; yawVel -= turnForce * 0.8; }

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

        // --- HARD BOUNDARY CLAMP (Arena Box) ---
        // Arena is 6000x12000. X: [-3000, 3000], Z: [-6000, 6000]
        const PADDING = 100;
        let clamped = false;

        if (airplaneContainer.position.x < -3000 + PADDING) { airplaneContainer.position.x = -3000 + PADDING; clamped = true; }
        if (airplaneContainer.position.x > 3000 - PADDING) { airplaneContainer.position.x = 3000 - PADDING; clamped = true; }
        if (airplaneContainer.position.z < -6000 + PADDING) { airplaneContainer.position.z = -6000 + PADDING; clamped = true; }
        if (airplaneContainer.position.z > 6000 - PADDING) { airplaneContainer.position.z = 6000 - PADDING; clamped = true; }
        if (airplaneContainer.position.y > 30000 - PADDING) { airplaneContainer.position.y = 30000 - PADDING; clamped = true; }

        if (clamped && currentSpeed > 1) {
            currentSpeed = 0.5; // Slow down on wall hit
            airplaneContainer.translateZ(10); // Bounce slightly
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
                const dx = wp.x - obj.position.x;
                const dz = wp.z - obj.position.z;
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
                scene.userData.crashCooldown = 0.5;
                console.log("CRASH");
                currentSpeed = 0.1;
                airplaneContainer.translateZ(50); // Bounce back
            }
        }
    }

    // Update Sun & Stars outside loop
    const planePos = airplaneContainer.position;
    scene.userData.sun.position.set(planePos.x + 200, planePos.y + 500, planePos.z + 200);
    scene.userData.sun.target.position.copy(planePos);
    scene.userData.sun.target.updateMatrixWorld();
    starsSystem.position.copy(planePos);

    // Timer updates
    if (scene.userData.crashCooldown > 0) scene.userData.crashCooldown -= dt;

    if (airplaneContainer.position.y < 5.0) {
        airplaneContainer.position.y = 5.0;
        if (pitchVel < 0) pitchVel = 0;
        if (currentSpeed > 1.0) currentSpeed = 0.5; // Drag on ground
    }

    // Camera - DYNAMIC based on speed
    const baseCamHeight = 10;
    const baseCamDist = 30;

    // Speed-based camera zoom out (more distance at higher speed)
    const speedFactor = currentSpeed / BASE_MAX_SPEED;
    const dynamicHeight = baseCamHeight + speedFactor * 8;  // +8 at max normal speed
    const dynamicDist = baseCamDist + speedFactor * 25;     // +25 at max normal speed

    const camOffset = new THREE.Vector3(0, dynamicHeight, dynamicDist);
    camOffset.applyQuaternion(airplaneContainer.quaternion);
    const camPos = planePos.clone().add(camOffset);

    // Shake during boost
    if (keys.shift && currentSpeed > 2.0) {
        const shake = 0.5;
        camPos.x += (Math.random() - 0.5) * shake;
        camPos.y += (Math.random() - 0.5) * shake * 0.3;
        camPos.z += (Math.random() - 0.5) * shake;
    }

    // Smooth lerp - nearly instant camera follow
    camera.position.lerp(camPos, 0.8);

    // CAMERA ROLL SYNC - Screen tilts with airplane!
    // Get airplane's local up vector and apply to camera
    const planeUp = new THREE.Vector3(0, 1, 0).applyQuaternion(airplaneContainer.quaternion);
    camera.up.lerp(planeUp, 0.5); // Faster roll transition
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(airplaneContainer.quaternion);
    camera.lookAt(planePos.clone().add(fwd.clone().multiplyScalar(80))); // Look ahead further

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
