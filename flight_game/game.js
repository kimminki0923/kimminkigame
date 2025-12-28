// Game State
const GAME_STATE = {
    MENU: 0,
    TAKEOFF: 1,
    FLYING: 2,
    CRASHED: 3
};

const state = {
    mode: GAME_STATE.MENU,
    running: false,
    score: 0,
    speed: 0,
    plane: {
        mesh: null,
        propeller: null,
        velocity: new THREE.Vector3(0, 0, 0),
        rotationVelocity: new THREE.Vector3(0, 0, 0),
        throttle: 0,
        altitude: 0
    },
    keys: { w: false, a: false, s: false, d: false },
    rings: [],
    clouds: []
};

// Three.js Variables
let scene, camera, renderer;
let ringsGroup;

// Constants
const WORLD_SIZE = 5000;
const RUNWAY_LENGTH = 1000;
const TAKEOFF_SPEED = 120; // km/h needed to lift off
const MAX_SPEED = 350;

// Initialization
function init() {
    try {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87CEEB);
        scene.fog = new THREE.Fog(0x87CEEB, 200, 2000);

        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
        camera.position.set(0, 10, -20);

        renderer = new THREE.WebGLRenderer({
            antialias: false,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: false,
            alpha: false,
            depth: true,
            stencil: false
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('game-container').appendChild(renderer.domElement);
    } catch (e) {
        document.getElementById('game-container').innerHTML = '<div style="color:white; text-align:center; padding-top:20%; font-size:24px;">⚠️ WebGL Error.<br>Please enable "Hardware Acceleration" in browser settings.<br>브라우저 설정에서 하드웨어 가속을 켜주세요.</div>';
        console.error("WebGL Creation Failed:", e);
        return;
    }

    // Lights
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xFFFFFF, 0.8);
    sunLight.position.set(100, 500, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    createEnvironment();
    createDetailedPlane();

    ringsGroup = new THREE.Group();
    scene.add(ringsGroup);

    // Initial Camera Setup - Look at the plane!
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('keydown', (e) => handleKey(e, true), false);
    document.addEventListener('keyup', (e) => handleKey(e, false), false);
    document.getElementById('start-btn').addEventListener('click', startGame);

    animate();
}

function createEnvironment() {
    // 1. Endless Ground
    const groundGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x3cb371 }); // Medium Sea Green
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    scene.add(ground);

    // 2. Runway
    const runwayGeo = new THREE.PlaneGeometry(30, RUNWAY_LENGTH);
    const runwayMat = new THREE.MeshPhongMaterial({ color: 0x333333 });
    const runway = new THREE.Mesh(runwayGeo, runwayMat);
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(0, 0, RUNWAY_LENGTH / 2 - 50); // Start at 0, go far forward
    runway.receiveShadow = true;
    scene.add(runway);

    // Runway markings
    const markingGeo = new THREE.PlaneGeometry(2, 40);
    const markingMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    for (let i = 0; i < RUNWAY_LENGTH; i += 80) {
        const mark = new THREE.Mesh(markingGeo, markingMat);
        mark.rotation.x = -Math.PI / 2;
        mark.position.set(0, 0.05, i + 10 - 50);
        scene.add(mark);
    }

    // 3. Clouds
    for (let i = 0; i < 80; i++) {
        const cloud = createCloud();
        cloud.position.set(
            (Math.random() - 0.5) * WORLD_SIZE * 0.8,
            Math.random() * 200 + 100,
            (Math.random() - 0.5) * WORLD_SIZE * 0.8
        );
        scene.add(cloud);
        state.clouds.push(cloud);
    }
}

function createCloud() {
    const cloudGroup = new THREE.Group();
    const geom = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF, opacity: 0.9, transparent: true });

    const nBlobs = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < nBlobs; i++) {
        const m = new THREE.Mesh(geom, mat);
        m.position.set(Math.random() * 10, Math.random() * 5, Math.random() * 5);
        m.scale.setScalar(Math.random() * 10 + 5);
        m.castShadow = true;
        cloudGroup.add(m);
    }
    return cloudGroup;
}

function createDetailedPlane() {
    const plane = new THREE.Group();

    // Materials
    const redMat = new THREE.MeshPhongMaterial({ color: 0xE74C3C, flatShading: true });
    const whiteMat = new THREE.MeshPhongMaterial({ color: 0xF5F5F5, flatShading: true });
    const greyMat = new THREE.MeshPhongMaterial({ color: 0x555555, flatShading: true });
    const darkMat = new THREE.MeshPhongMaterial({ color: 0x222222, flatShading: true });
    const glassMat = new THREE.MeshPhongMaterial({ color: 0x87CEEB, opacity: 0.6, transparent: true });

    // 1. Fuselage (Body)
    const fuselageGeo = new THREE.BoxGeometry(1.2, 1.2, 5);
    // Taper front and back manually slightly or just use box for low poly style
    const fuselage = new THREE.Mesh(fuselageGeo, redMat);
    fuselage.position.y = 1;
    plane.add(fuselage);

    // 2. Cockpit
    const cockpitGeo = new THREE.BoxGeometry(1, 0.8, 1.5);
    const cockpit = new THREE.Mesh(cockpitGeo, glassMat);
    cockpit.position.set(0, 1.6, 0.5);
    plane.add(cockpit);

    // 3. Wings (Biplane Style)
    const wingGeo = new THREE.BoxGeometry(10, 0.2, 2);
    // Top Wing
    const topWing = new THREE.Mesh(wingGeo, redMat);
    topWing.position.set(0, 2.5, 1);
    plane.add(topWing);
    // Bottom Wing
    const botWing = new THREE.Mesh(wingGeo, whiteMat);
    botWing.position.set(0, 1, 1);
    plane.add(botWing);

    // Struts
    const strutGeo = new THREE.BoxGeometry(0.1, 1.5, 0.1);
    const strutL = new THREE.Mesh(strutGeo, greyMat);
    strutL.position.set(-3, 1.75, 1);
    plane.add(strutL);
    const strutR = new THREE.Mesh(strutGeo, greyMat);
    strutR.position.set(3, 1.75, 1);
    plane.add(strutR);

    // 4. Tail
    const vStabGeo = new THREE.BoxGeometry(0.2, 1.5, 1.5);
    const vStab = new THREE.Mesh(vStabGeo, redMat);
    vStab.position.set(0, 1.8, -2);
    plane.add(vStab);

    const hStabGeo = new THREE.BoxGeometry(3, 0.2, 1.2);
    const hStab = new THREE.Mesh(hStabGeo, redMat);
    hStab.position.set(0, 1.2, -2);
    plane.add(hStab);

    // 5. Propeller
    const spinnerGeo = new THREE.ConeGeometry(0.4, 0.5, 16);
    spinnerGeo.rotateX(Math.PI / 2);
    const spinner = new THREE.Mesh(spinnerGeo, greyMat);
    spinner.position.set(0, 1, 2.6);

    const bladeGeo = new THREE.BoxGeometry(0.1, 3.5, 0.3);
    const blade = new THREE.Mesh(bladeGeo, darkMat);
    blade.position.set(0, 0, 0.2);

    // Group propeller parts to spin them
    state.plane.propeller = new THREE.Group();
    state.plane.propeller.add(spinner);
    state.plane.propeller.add(blade);
    state.plane.propeller.position.y = 1; // Align with engine
    state.plane.propeller.position.z = 2.6; // Stick out front
    plane.add(state.plane.propeller);

    // 6. Wheels (Landing Gear)
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelL = new THREE.Mesh(wheelGeo, darkMat);
    wheelL.position.set(-1, 0.4, 1.5);
    const wheelR = new THREE.Mesh(wheelGeo, darkMat);
    wheelR.position.set(1, 0.4, 1.5);

    // Rear wheel
    const wheelB = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8).rotateZ(Math.PI / 2), darkMat);
    wheelB.position.set(0, 0.2, -2);

    const gearStrutGeo = new THREE.BoxGeometry(0.1, 0.8, 0.1);
    const gearL = new THREE.Mesh(gearStrutGeo, greyMat);
    gearL.position.set(-1, 0.7, 1.5);
    gearL.rotateZ(0.2);

    const gearR = new THREE.Mesh(gearStrutGeo, greyMat);
    gearR.position.set(1, 0.7, 1.5);
    gearR.rotateZ(-0.2);

    plane.add(wheelL);
    plane.add(wheelR);
    plane.add(wheelB);
    plane.add(gearL);
    plane.add(gearR);

    // Shadow
    plane.castShadow = true;
    plane.traverse(c => c.castShadow = true);

    state.plane.mesh = plane;
    scene.add(plane);
}

function handleKey(event, isDown) {
    const k = event.key.toLowerCase();
    if (state.keys.hasOwnProperty(k)) state.keys[k] = isDown;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function startGame() {
    document.getElementById('message-overlay').style.display = 'none';
    state.mode = GAME_STATE.TAKEOFF;
    state.running = true;
    state.score = 0;
    state.speed = 0;
    state.plane.throttle = 0;

    // Position on Runway
    state.plane.mesh.position.set(0, 0, 0);
    state.plane.mesh.rotation.set(0, 0, 0);

    // Generate rings
    ringsGroup.clear();
    state.rings = [];
    for (let i = 1; i <= 20; i++) {
        createRing(300 + i * 150); // Start rings after runway takeoff area
    }
}

function createRing(zPos) {
    const geometry = new THREE.TorusGeometry(8, 1, 16, 32);
    const material = new THREE.MeshPhongMaterial({ color: 0xf1c40f, emissive: 0xaa6600 });
    const ring = new THREE.Mesh(geometry, material);

    const yPos = 30 + Math.random() * 50;
    const xPos = (Math.random() - 0.5) * 100;

    ring.position.set(xPos, yPos, zPos);
    ring.userData = { passed: false };

    ringsGroup.add(ring);
    state.rings.push(ring);
}

function updatePhysics() {
    const dt = 0.016;
    const p = state.plane.mesh;

    // MENU Mode: Rotate camera around plane for visual effect
    if (state.mode === GAME_STATE.MENU) {
        state.plane.propeller.rotation.z += 0.1; // Spin propeller
        const time = Date.now() * 0.0005;
        camera.position.x = Math.sin(time) * 20;
        camera.position.z = Math.cos(time) * 20;
        camera.position.y = 5;
        camera.lookAt(0, 2, 0); // Look at plane
        return; // Skip physics
    }

    if (state.mode === GAME_STATE.CRASHED) return;

    // --- Controls ---
    // Throttle (W/S)
    if (state.keys.w) state.plane.throttle += 0.01;
    if (state.keys.s) state.plane.throttle -= 0.01;
    state.plane.throttle = Math.max(0, Math.min(1, state.plane.throttle));

    // Target Speed based on Throttle
    const targetSpeed = state.plane.throttle * MAX_SPEED;
    // Accelerate/Decelerate smoothly
    if (state.speed < targetSpeed) state.speed += 1;
    if (state.speed > targetSpeed) state.speed -= 1;

    // Display Speed
    const speedKmh = Math.floor(state.speed);
    document.getElementById('speed-display').innerText = `SPEED: ${speedKmh} km/h`;
    document.getElementById('speed-bar-fill').style.width = `${(speedKmh / MAX_SPEED) * 100}%`;

    // Propeller Visuals
    state.plane.propeller.rotation.z += (state.speed * 0.05) + 0.1;

    // --- Movement Physics ---
    const worldSpeed = state.speed * 0.01; // Scale down for world units

    // Pitch & Roll Inputs
    let pitchInput = 0;
    let rollInput = 0;

    if (state.keys.w) pitchInput = 1; // Down (Dive) - BUT logic handled by throttle mostly? 
    // Wait, arcade controls: W=Pitch Down/Accel? 
    // User requested "WASD to drive".
    // Let's refine: W = Throttle UP (handled) + Pitch Down? No, separate throttle is weird on W.
    // Let's make: W = Pitch Down, S = Pitch Up. A/D = Roll. Auto-Throttle? or Shift/Ctrl?
    // Let's stick to Arcade: W = Pitch Down (Push Nose), S = Pitch Up (Pull Nose). 
    // BUT we need speed. Auto-accelerate if airborne?
    // Start Sequence: Need throttle. Let's make W also increase speed if on ground.

    if (state.mode === GAME_STATE.TAKEOFF) {
        // On Ground
        if (state.keys.w) state.plane.throttle += 0.05; // W is gas on ground

        // Lift off logic
        if (state.speed > TAKEOFF_SPEED && state.keys.s) { // Pull up (S) to takeoff
            state.mode = GAME_STATE.FLYING;
            p.position.y += 0.5; // Jump up
        }
    } else if (state.mode === GAME_STATE.FLYING) {
        // Airborne
        if (state.keys.w) pitchInput = 1;  // Nose Down
        if (state.keys.s) pitchInput = -1; // Nose Up (Pull)
        if (state.keys.a) rollInput = 1;   // Bank Left
        if (state.keys.d) rollInput = -1;  // Bank Right

        // Constant throttle in air, but maybe W/S modulates slightly?
        // Let's keep throttle high in air for simplicity
        state.plane.throttle = 0.8;
    }

    // Apply Rotation
    const turnSpeed = 0.03;
    if (state.mode === GAME_STATE.FLYING) {
        p.rotateX(pitchInput * turnSpeed);
        p.rotateZ(rollInput * turnSpeed);

        // Bank-to-Turn Logic
        // If banked (Z rotation), yaw (Y rotation)
        // Access Rotation z (approximate)
        // We really should use Quaternion math but simple Euler is okay for small angles
        // p.rotation.y += p.rotation.z * 0.01; // Simple coordination

        // Actually simpler: Simply rotate Y based on Roll Input for arcade feel
        p.rotateY(rollInput * turnSpeed * 0.5);
    }

    // Move Forward
    p.translateZ(worldSpeed);

    // Gravity & Ground Collision
    if (state.mode === GAME_STATE.FLYING) {
        if (p.position.y < 0.5) {
            // Crash or Land?
            // Bounce
            p.position.y = 0.5;
            // Reset rot?
            p.rotation.x = 0;
            p.rotation.z = 0;
            state.mode = GAME_STATE.TAKEOFF; // Landed
        }
    }

    // Camera Chase
    // Position camera behind and above relative to plane
    const camOffset = new THREE.Vector3(0, 5, -12); // Saved behind (-z is behind locally? wait, plane moves +z or -z? THREE default is -z forward. I used +z? 
    // Let's check: p.translateZ(worldSpeed). If worldSpeed +, it moves local +Z. 
    // Standard THREE is -Z forward. If I built plane facing +Z? 
    // Let's assume plane faces typical way.
    // Actually in `createDetailedPlane`, cockpit is z=0.5, tail is z=-2? Wait.
    // Propeller z=2.6. So +Z is FRONT.
    // So translateZ is Forward.
    // Camera should be at -Z (Behind).

    // Wait, earlier I set Propeller Z=2.6. Tail Z=-2. So Front is +Z.
    // Camera should be at -Z relative.
    const relativeCam = new THREE.Vector3(0, 8, -20);
    const cameraTargetPos = relativeCam.applyMatrix4(p.matrixWorld);
    camera.position.lerp(cameraTargetPos, 0.1);
    camera.lookAt(p.position);

    // Ring Collision
    checkRings();
}

function checkRings() {
    const p = state.plane.mesh;

    for (let i = state.rings.length - 1; i >= 0; i--) {
        const ring = state.rings[i];
        const dist = p.position.distanceTo(ring.position);

        if (dist < 8) { // Ring radius
            if (!ring.userData.passed) {
                ring.userData.passed = true;
                state.score += 100;
                document.getElementById('score-display').innerText = `SCORE: ${state.score}`;

                // Visual feedback (Scale up and vanish)
                ring.scale.multiplyScalar(1.2);
                ring.material.color.setHex(0x2ecc71); // Green

                // Remove logic later
                ringsGroup.remove(ring);
                state.rings.splice(i, 1);
                createRing(p.position.z + 2000); // Infinite generation
            }
        }

        // Cleanup missed rings
        // Need to calculate distance along forward vector? Or just absolute distance
        if (p.position.distanceTo(ring.position) > 200 && ring.position.z < p.position.z) {
            // Basic culling not perfect for loop-backs but ok for infinite runner style
            // Ignoring cleanup for now to simplify
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    updatePhysics();
    renderer.render(scene, camera);
}

// Start
init();
