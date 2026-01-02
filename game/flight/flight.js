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

// Flight Parameters
let currentSpeed = 0;
const BASE_MAX_SPEED = 2.0;
const BOOST_MAX_SPEED = 3.5;
const ACCEL = 0.02;
const BOOST_ACCEL = 0.05;
const DECEL = 0.01;

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

    // BEAUTIFUL SKY GRADIENT
    // We create a large sphere with gradient shader
    const skyGeo = new THREE.SphereGeometry(6000, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: new THREE.Color(0x4488ff) },
            bottomColor: { value: new THREE.Color(0xffeedd) },
            offset: { value: 33 },
            exponent: { value: 0.5 }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize( vWorldPosition + offset ).y;
                gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h , 0.0), exponent ), 0.0 ) ), 1.0 );
            }
        `,
        side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // Add Fog matching horizon
    scene.fog = new THREE.FogExp2(0xffffff, 0.00025);

    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 15000);

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
    // 1. NYC Street Grid Floor
    const gridSize = 20000;
    const gridDivs = 100;
    const gridHelper = new THREE.GridHelper(gridSize, gridDivs, 0x333333, 0x222222);
    gridHelper.position.y = 0.1;
    gridHelper.name = "grid";
    scene.add(gridHelper);

    // Dark asphalt floor
    const floorGeo = new THREE.PlaneGeometry(20000, 20000);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.name = "floor";
    floor.receiveShadow = true;
    scene.add(floor);

    // 2. SPEED PARTICLES
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 1500;
    const posArray = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 4000;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0.4 });
    starsSystem = new THREE.Points(starsGeo, starsMat);
    scene.add(starsSystem);

    // 3. NYC BUILDINGS - Modern Skyscrapers
    const buildingColors = [
        0x2a2a3a, // Dark blue-gray
        0x3a3a4a, // Medium gray
        0x4a4a5a, // Light gray
        0x252535, // Dark purple-gray
        0x1f1f2f, // Very dark
        0x353545, // Steel gray
    ];

    const windowColor = 0xffee88; // Warm window lights

    const poolSize = 1500;
    const spread = 8000;
    const blockSize = 150; // City block size
    const streetWidth = 40;

    for (let i = 0; i < poolSize; i++) {
        // Building dimensions - NYC style tall and narrow
        const width = 30 + Math.random() * 60;
        const depth = 30 + Math.random() * 60;
        const height = 80 + Math.random() * 400; // Tall skyscrapers!

        // Main building body
        const buildingGeo = new THREE.BoxGeometry(width, height, depth);
        buildingGeo.translate(0, height / 2, 0); // Pivot at bottom

        const colorIndex = Math.floor(Math.random() * buildingColors.length);
        const buildingMat = new THREE.MeshStandardMaterial({
            color: buildingColors[colorIndex],
            roughness: 0.7,
            metalness: 0.3
        });

        const building = new THREE.Mesh(buildingGeo, buildingMat);

        // Position on city grid
        const gridX = Math.floor((Math.random() - 0.5) * spread / blockSize) * blockSize;
        const gridZ = Math.floor((Math.random() - 0.5) * spread / blockSize) * blockSize;

        // Avoid runway area
        if (Math.abs(gridX) < 400 && gridZ > -2000 && gridZ < 2000) {
            building.position.set(gridX + (gridX > 0 ? 400 : -400), 0, gridZ);
        } else {
            building.position.set(gridX, 0, gridZ);
        }

        building.userData.type = "BUILDING";
        building.userData.height = height;
        building.userData.width = width;
        building.userData.depth = depth;
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
        allObjects.push(building);

        // Add glowing windows (emissive strips on building faces)
        if (Math.random() > 0.3) {
            const windowRows = Math.floor(height / 15);
            const windowMat = new THREE.MeshBasicMaterial({ color: windowColor });

            for (let row = 0; row < Math.min(windowRows, 20); row++) {
                if (Math.random() > 0.4) { // Random lit windows
                    const wGeo = new THREE.PlaneGeometry(width * 0.8, 3);
                    const wMesh = new THREE.Mesh(wGeo, windowMat);
                    wMesh.position.set(0, 10 + row * 15, depth / 2 + 0.1);
                    building.add(wMesh);

                    // Back side windows
                    const wMesh2 = wMesh.clone();
                    wMesh2.position.z = -depth / 2 - 0.1;
                    wMesh2.rotation.y = Math.PI;
                    building.add(wMesh2);
                }
            }
        }

        // Some buildings get antenna/spire
        if (height > 300 && Math.random() > 0.5) {
            const spireGeo = new THREE.CylinderGeometry(1, 3, 40, 8);
            const spireMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8 });
            const spire = new THREE.Mesh(spireGeo, spireMat);
            spire.position.y = height + 20;
            building.add(spire);
        }
    }

    // 4. Add some landmark-style buildings (Empire State-like)
    for (let i = 0; i < 5; i++) {
        const landmark = createLandmarkBuilding();
        const angle = (i / 5) * Math.PI * 2;
        const dist = 2000 + Math.random() * 1500;
        landmark.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
        scene.add(landmark);
        allObjects.push(landmark);
    }

    airplaneContainer = new THREE.Group();
}

// Create iconic NYC-style landmark building
function createLandmarkBuilding() {
    const group = new THREE.Group();
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.6, metalness: 0.2 });

    // Base section
    const base = new THREE.Mesh(new THREE.BoxGeometry(80, 200, 80), baseMat);
    base.position.y = 100;
    group.add(base);

    // Middle section (narrower)
    const mid = new THREE.Mesh(new THREE.BoxGeometry(60, 200, 60), baseMat);
    mid.position.y = 300;
    group.add(mid);

    // Top section (even narrower)
    const top = new THREE.Mesh(new THREE.BoxGeometry(40, 150, 40), baseMat);
    top.position.y = 475;
    group.add(top);

    // Spire
    const spire = new THREE.Mesh(
        new THREE.ConeGeometry(5, 80, 8),
        new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9 })
    );
    spire.position.y = 590;
    group.add(spire);

    // Window lights
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xffee88 });
    for (let y = 20; y < 500; y += 20) {
        if (Math.random() > 0.3) {
            const size = y < 200 ? 70 : (y < 400 ? 50 : 30);
            const wGeo = new THREE.PlaneGeometry(size, 4);
            const w = new THREE.Mesh(wGeo, windowMat);
            w.position.set(0, y, (y < 200 ? 40.1 : (y < 400 ? 30.1 : 20.1)));
            group.add(w);
        }
    }

    group.userData.type = "BUILDING";
    group.userData.height = 600;
    group.userData.width = 80;
    group.userData.depth = 80;

    return group;
}

function initObject(mesh, spread) {
    const dist = Math.random() * spread;
    const angle = Math.random() * Math.PI * 2;
    let x = Math.cos(angle) * dist;
    let z = Math.sin(angle) * dist;

    if (Math.abs(x) < 300 && z > -2000 && z < 2000) x += 800;

    mesh.position.set(x, 0, z);
    mesh.rotation.set(0, 0, 0); // Static

    const s = 1.0;

    if (mesh.userData.type === "RING" || mesh.userData.type === "SQUARE") {
        const scale = 30 + Math.random() * 50;
        mesh.scale.set(scale, scale, scale);
        mesh.position.y = 50 + Math.random() * 400;
        // Random Yaw Only
        mesh.rotation.y = Math.random() * Math.PI;
    } else {
        // Blocks
        const scaleW = 40 + Math.random() * 60;
        const scaleH = 50 + Math.random() * 200;
        mesh.scale.set(scaleW, scaleH, scaleW);
    }
}

function createHeroAirplane() {
    airplaneContainer = new THREE.Group();
    airplaneContainer.position.set(0, 10, 0);
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

    // MOVEMENT
    const targetMax = keys.shift ? BOOST_MAX_SPEED : BASE_MAX_SPEED;
    const accel = keys.shift ? BOOST_ACCEL : ACCEL;
    if (keys['w']) { if (currentSpeed < targetMax) currentSpeed += accel; }
    if (keys['s']) currentSpeed -= DECEL;
    if (currentSpeed > targetMax) currentSpeed -= DECEL * 4;
    if (currentSpeed < 0) currentSpeed = 0; if (currentSpeed > targetMax + 0.1) currentSpeed = targetMax + 0.1;

    let turnForce = dt * 4.0;
    if (keys['arrowup']) pitchVel += turnForce;
    if (keys['arrowdown']) pitchVel -= turnForce;
    const isLeft = keys['a'] || keys['arrowleft'];
    const isRight = keys['d'] || keys['arrowright'];
    if (isLeft) { rollVel += turnForce * 2.0; yawVel += turnForce * 0.8; }
    if (isRight) { rollVel -= turnForce * 2.0; yawVel -= turnForce * 0.8; }

    pitchVel *= ROT_DAMPING; rollVel *= ROT_DAMPING; yawVel *= ROT_DAMPING;
    airplaneContainer.rotateX(pitchVel * dt);
    airplaneContainer.rotateZ(rollVel * dt);
    airplaneContainer.rotateY(yawVel * dt);

    // GRAVITY
    const lift = Math.max(0, currentSpeed) * 8.0 * dt;
    airplaneContainer.position.y -= GRAVITY * dt;
    airplaneContainer.position.y += lift * Math.cos(airplaneContainer.rotation.z);

    const moveDist = currentSpeed * 200 * dt;
    airplaneContainer.translateZ(-moveDist);

    // INFINITE SCROLL
    const planePos = airplaneContainer.position;
    const floor = scene.getObjectByName("floor");
    floor.position.x = planePos.x; floor.position.z = planePos.z;
    const grid = scene.getObjectByName("grid");
    // Grid Snap for illusion of ground movement
    const gridSize = 100; // sub-grid
    grid.position.x = Math.round(planePos.x / gridSize) * gridSize;
    grid.position.z = Math.round(planePos.z / gridSize) * gridSize;

    scene.userData.sun.position.set(planePos.x + 200, planePos.y + 500, planePos.z + 200);
    scene.userData.sun.target.position.copy(planePos);
    scene.userData.sun.target.updateMatrixWorld();

    // Star System Move
    starsSystem.position.copy(planePos);

    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(airplaneContainer.quaternion);
    allObjects.forEach(obj => {
        if (obj.position.distanceToSquared(planePos) > 6000 * 6000) respawnObject(obj, planePos, fwd);
    });

    // COLLISION FIX - More test points for robust detection
    const points = [
        new THREE.Vector3(0, 0, -8),   // Nose tip
        new THREE.Vector3(0, 0, -4),   // Nose mid
        new THREE.Vector3(0, 0, 0),    // Center
        new THREE.Vector3(0, 0, 5),    // Tail
        new THREE.Vector3(7, 0, 0),    // Left wing tip
        new THREE.Vector3(-7, 0, 0),   // Right wing tip
        new THREE.Vector3(3.5, 0, 0),  // Left wing mid
        new THREE.Vector3(-3.5, 0, 0), // Right wing mid
        new THREE.Vector3(0, 1, 0),    // Top center
        new THREE.Vector3(0, -1, 0),   // Bottom center
    ];
    const worldPoints = points.map(p => p.clone().applyMatrix4(airplaneContainer.matrixWorld));

    let crash = false;
    for (let obj of allObjects) {
        if (Math.abs(obj.position.x - planePos.x) > 500) continue;
        if (Math.abs(obj.position.z - planePos.z) > 500) continue;

        if (obj.userData.type === "RING" || obj.userData.type === "SQUARE") {
            // Precise Ring Logic
            // Transform world points to Ring Local Space
            // Ring is XY plane, Radius=userData.radius, Tube=userData.tube
            const invQuat = obj.quaternion.clone().invert();
            const objScale = obj.scale.x;
            const radius = obj.userData.radius;
            const tube = obj.userData.tube;

            for (let wp of worldPoints) {
                const lp = wp.clone().sub(obj.position).applyQuaternion(invQuat).divideScalar(objScale);
                // Dist from Center
                const dXY = Math.sqrt(lp.x * lp.x + lp.y * lp.y);
                const dZ = Math.abs(lp.z);

                // Hole is radius - tube
                // Hit Rim is radius - tube < dXY < radius + tube
                // And dZ < tube

                const holeSafe = radius - tube;
                // If outside hole AND dZ is small -> Hit
                if (dXY > holeSafe && dZ < tube) {
                    crash = true;
                }
            }
            if (crash) break;
            continue;
        }

        // BUILDING Collision Logic
        if (obj.userData.type === "BUILDING") {
            const bW = obj.userData.width || 50;
            const bD = obj.userData.depth || 50;
            const bH = obj.userData.height || 200;
            const halfW = bW / 2;
            const halfD = bD / 2;

            for (let wp of worldPoints) {
                const dx = wp.x - obj.position.x;
                const dz = wp.z - obj.position.z;
                // Check if inside building footprint
                if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
                    // Check height
                    if (wp.y > 0 && wp.y < bH) {
                        crash = true;
                        break;
                    }
                }
            }
            if (crash) break;
            continue;
        }

        // Generic Block Logic (fallback)
        let r = (obj.scale.x + obj.scale.z) * 0.45;
        const yMin = obj.position.y;
        const yTop = obj.position.y + obj.scale.y;

        for (let wp of worldPoints) {
            const dx = wp.x - obj.position.x;
            const dz = wp.z - obj.position.z;
            const d = Math.sqrt(dx * dx + dz * dz);
            if (d < r) {
                if (wp.y > yMin && wp.y < yTop) {
                    crash = true;
                    break;
                }
            }
        }
        if (crash) break;
    }

    if (crash && currentSpeed > 0.1 && !scene.userData.crashCooldown) {
        currentSpeed = 0.1; // Stop instead of reversing to prevent oscillation
        airplaneContainer.translateZ(50); // Push back
        scene.userData.crashCooldown = 0.5; // 0.5 second cooldown
        console.log("CRASH");
    }

    // Crash cooldown timer
    if (scene.userData.crashCooldown && scene.userData.crashCooldown > 0) {
        scene.userData.crashCooldown -= dt;
    }

    if (airplaneContainer.position.y < 3.0) { airplaneContainer.position.y = 3.0; if (pitchVel < 0) pitchVel = 0; }

    // Camera - COMPLETELY STABLE (Fixed offset, no zoom based on speed)
    const baseCamHeight = 10;
    const baseCamDist = 30;

    const camOffset = new THREE.Vector3(0, baseCamHeight, baseCamDist);
    camOffset.applyQuaternion(airplaneContainer.quaternion);
    const camPos = planePos.clone().add(camOffset);

    // Minimal shake only during boost
    if (keys.shift && currentSpeed > 0.5) {
        const shake = 0.2;
        camPos.x += (Math.random() - 0.5) * shake;
        camPos.y += (Math.random() - 0.5) * shake * 0.3;
        camPos.z += (Math.random() - 0.5) * shake;
    }

    // Smooth lerp
    camera.position.lerp(camPos, 0.08);

    // CAMERA ROLL SYNC - Screen tilts with airplane!
    // Get airplane's local up vector and apply to camera
    const planeUp = new THREE.Vector3(0, 1, 0).applyQuaternion(airplaneContainer.quaternion);
    camera.up.lerp(planeUp, 0.1); // Smooth roll transition
    camera.lookAt(planePos.clone().add(fwd.clone().multiplyScalar(50))); // Look ahead

    // Update speed display
    updateSpeedHUD();

    renderer.render(scene, camera);
}

function respawnObject(obj, center, fwd) {
    const angle = (Math.random() - 0.5) * Math.PI * 1.5;
    const dist = 4000 + Math.random() * 2000;
    const dir = fwd.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).normalize();
    obj.position.copy(center).add(dir.multiplyScalar(dist));

    // Building respawn - randomize height and ensure on ground
    if (obj.userData.type === "BUILDING") {
        obj.position.y = 0; // Buildings always on ground!
        const newHeight = 80 + Math.random() * 400;
        obj.userData.height = newHeight;
        // Update geometry if it's a simple mesh
        if (obj.geometry) {
            const w = obj.userData.width || 50;
            const d = obj.userData.depth || 50;
            obj.geometry.dispose();
            obj.geometry = new THREE.BoxGeometry(w, newHeight, d);
            obj.geometry.translate(0, newHeight / 2, 0);
        }
    }

    if (obj.userData.type === "RING" || obj.userData.type === "SQUARE") {
        obj.rotation.set(0, (Math.random() * Math.PI), 0);
    }
}

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
