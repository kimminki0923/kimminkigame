const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const aiBtn = document.getElementById('ai-btn');
const scoreEl = document.getElementById('score');
const statusEl = document.getElementById('status');
const timerBar = document.getElementById('timer-bar');
const coinEl = document.getElementById('coin-count');

// Mobile Buttons
const btnTurn = document.getElementById('btn-turn');
const btnJump = document.getElementById('btn-jump');

// Socket / AI
let ws = null;
let ortSession = null;
const useONNX = true; // Flag to force ONNX

// Init ONNX
async function initONNX() {
    try {
        statusEl.innerText = "AI 모델 로딩중...";
        ortSession = await ort.InferenceSession.create('./model.onnx');
        statusEl.innerText = "AI 준비됨 (Static)";
        console.log("ONNX Model Loaded");
    } catch (e) {
        console.error("ONNX Load Failed", e);
        statusEl.innerText = "AI 로드 실패: " + e.message;
    }
}

if (useONNX) {
    initONNX();
} else {
    // Legacy WebSocket
    try {
        ws = new WebSocket(`ws://${window.location.host}/ws/game`);
        ws.onopen = () => statusEl.innerText = "서버 연결됨";
        ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.action !== undefined && gameState.aiEnabled && gameState.running) {
                handleInput(data.action);
            }
        };
    } catch (e) {
        statusEl.innerText = "서버 미연결";
    }
}

// AI Loop for ONNX
setInterval(async () => {
    if (gameState.running && gameState.aiEnabled && ortSession) {
        await runInference();
    }
}, 100); // 100ms interval (10 FPS for AI)

async function runInference() {
    if (!ortSession) return;

    // Construct Observation: [next_1_dir, next_2_dir, next_3_dir, next_4_dir, next_5_dir]
    // 0 = Left, 1 = Right.
    // However, our backend trained on:
    // If stair.x > current.x -> target is 1 (Right)
    // If stair.x < current.x -> target is 0 (Left)
    // Actually the RL env used relative coords? 
    // Let's check env.py or recreate logic.
    // Backend env.py used: 
    // obs[i] = 1.0 if next_stairs[i].x > next_stairs[i-1].x else 0.0
    // Essentially: Is the NEXT step to the Right (1) or Left (0)?

    const obsData = [];
    const idx = gameState.score;
    // We need 5 steps ahead relative to current
    // Current stair is at idx.
    // Step 1: idx -> idx+1 direction
    for (let i = 0; i < 5; i++) {
        const s1 = gameState.stairs[idx + i];  // current (or prev)
        const s2 = gameState.stairs[idx + i + 1]; // next
        if (s1 && s2) {
            // 1 if Right, 0 if Left
            obsData.push(s2.x > s1.x ? 1 : 0);
        } else {
            obsData.push(0); // Padding
        }
    }

    // Prepare Tensor
    const inputTensor = new ort.Tensor('float32', Float32Array.from(obsData), [1, 5]);

    // Run
    const feeds = { input: inputTensor };
    const results = await ortSession.run(feeds);
    const output = results.output.data; // Logits [L, R]

    // Deterministic: Argmax
    // output[0] = Logit for 0 (Left)
    // output[1] = Logit for 1 (Right)
    const predictedAbsDir = output[1] > output[0] ? 1 : 0;

    // Convert Absolute Dir (0/1) to Relative Action (0=Jump, 1=Turn)
    // If Predicted == CurrentDir -> Jump (0)
    // If Predicted != CurrentDir -> Turn (1)

    const action = (predictedAbsDir === gameState.playerDir) ? 0 : 1;
    handleInput(action);
}


let gameState = {
    running: false,
    score: 0,
    coinCount: 0,
    playerDir: 1,
    stairs: [],
    gameOver: false,
    aiEnabled: false,
    timer: 100, // 0 to 100

    // Animation
    renderPlayer: { x: 0, y: 0 }
};

const STAIR_W = 100;
const STAIR_H = 25;
const PLAYER_R = 12;
const MAX_TIMER = 100;
const TIMER_DECAY = 0.3; // Frame 당 감소량
const TIMER_BONUS = 15; // 성공시 충전량

// Background Objects
const buildings = [];
const clouds = [];
const planets = [];
const stars = [];
const particles = []; // For floating text and effects

function initBackgroundObjects() {
    buildings.length = 0;
    for (let i = 0; i < 25; i++) {
        buildings.push({
            x: Math.random() * 3000 - 1500,
            width: 60 + Math.random() * 100,
            height: 150 + Math.random() * 400,
            color: `hsl(230, 25%, ${10 + Math.random() * 15}%)`, // Darker, sleeker buildings
            windows: Math.random() > 0.5
        });
    }
    clouds.length = 0;
    for (let i = 0; i < 40; i++) {
        clouds.push({
            x: Math.random() * 4000 - 2000,
            y: Math.random() * 800,
            size: 50 + Math.random() * 80,
            speed: (Math.random() - 0.5) * 0.8,
            opacity: 0.3 + Math.random() * 0.5
        });
    }
    planets.length = 0;
    const pColors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#e056fd'];
    for (let i = 0; i < 20; i++) {
        planets.push({
            x: Math.random() * 5000 - 2500,
            y: Math.random() * 4000,
            size: 15 + Math.random() * 80,
            color: pColors[Math.floor(Math.random() * pColors.length)],
            ring: Math.random() > 0.6,
            texture: Math.random() > 0.5
        });
    }
    stars.length = 0;
    for (let i = 0; i < 200; i++) {
        stars.push({
            x: Math.random() * 2000,
            y: Math.random() * 2000,
            size: Math.random() * 2,
            blinkSpeed: 0.05 + Math.random() * 0.1,
            phase: Math.random() * Math.PI * 2
        });
    }
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();


function initGame() {
    gameState.score = 0;
    gameState.coinCount = 0;
    gameState.running = true;
    gameState.gameOver = false;
    gameState.playerDir = 1;
    gameState.stairs = [];
    gameState.timer = MAX_TIMER;
    particles.length = 0;

    startBtn.style.display = 'none';
    aiBtn.style.display = 'none';
    timerBar.parentElement.style.opacity = 1;

    let cx = 0, cy = 0;
    gameState.stairs.push({ x: cx, y: cy, dir: 1, hasCoin: false, coinVal: 0 });
    gameState.renderPlayer = { x: cx, y: cy };

    for (let i = 0; i < 30; i++) {
        addStair();
    }
    initBackgroundObjects();

    scoreEl.innerText = 0;
    if (coinEl) coinEl.innerText = 0;
    statusEl.innerText = "";
    sendState();
    loop();
}

function showButtons() {
    startBtn.style.display = 'inline-block';
    aiBtn.style.display = 'inline-block';
}

function addStair() {
    const last = gameState.stairs[gameState.stairs.length - 1];

    // START CONSTRAINT: Force straight for first 5 steps
    if (gameState.stairs.length < 6) {
        gameState.stairs.push({
            x: last.x + 1,
            y: last.y + 1,
            dir: 1,
            hasCoin: false,
            coinVal: 0
        });
        return;
    }

    let nextDir;
    if (Math.random() < 0.7) {
        nextDir = last.dir; // Straight
    } else {
        nextDir = last.dir === 1 ? 0 : 1; // Turn
    }

    // COIN GENERATION
    let hasCoin = false;
    let coinVal = 0;

    if (Math.random() < 0.3) {
        hasCoin = true;
        const r = Math.random();
        if (r < 0.6) coinVal = 1;      // 60% Small
        else if (r < 0.9) coinVal = 5; // 30% Medium
        else coinVal = 10;             // 10% Large
    }

    gameState.stairs.push({
        x: last.x + (nextDir === 1 ? 1 : -1),
        y: last.y + 1,
        dir: nextDir,
        hasCoin: hasCoin,
        coinVal: coinVal
    });
}

function handleInput(action) {
    if (!gameState.running) return;

    const currentStairIndex = gameState.score;
    const currPos = gameState.stairs[currentStairIndex];
    const targetPos = gameState.stairs[currentStairIndex + 1];

    if (!targetPos) {
        addStair();
        return handleInput(action);
    }

    const requiredDir = (targetPos.x > currPos.x) ? 1 : 0;
    let chosenDir;

    // 0: J (Forward), 1: F (Turn)
    if (action === 0) {
        chosenDir = gameState.playerDir;
    } else {
        chosenDir = gameState.playerDir === 1 ? 0 : 1;
    }

    if (chosenDir === requiredDir) {
        gameState.score++;
        gameState.playerDir = chosenDir;
        scoreEl.innerText = gameState.score;

        // Coin Collection
        if (targetPos.hasCoin) {
            gameState.coinCount += targetPos.coinVal;
            if (coinEl) coinEl.innerText = gameState.coinCount;
            targetPos.hasCoin = false; // Collected

            // Effect
            let col = '#ffd700';
            if (targetPos.coinVal === 5) col = '#00d2d3'; // Silver/Cyan
            if (targetPos.coinVal === 10) col = '#ff6b6b'; // Red/Gem

            particles.push({
                type: 'text',
                val: '+' + targetPos.coinVal,
                x: targetPos.x,
                y: targetPos.y,
                life: 1.0,
                color: col,
                dy: -2
            });
        }

        addStair();

        // Refill Timer
        gameState.timer = Math.min(MAX_TIMER, gameState.timer + TIMER_BONUS);

        sendState();
    } else {
        gameOver();
    }
}

function gameOver() {
    gameState.running = false;
    gameState.gameOver = true;
    statusEl.innerText = "Game Over!";
    showButtons();

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: "game_over", score: gameState.score }));
    }
}

function sendState() {
    if (ws && ws.readyState === WebSocket.OPEN && gameState.running) {
        const view = 5;
        const idx = gameState.score;
        let obs = [];
        for (let i = 0; i < view; i++) {
            const s1 = gameState.stairs[idx + i];
            const s2 = gameState.stairs[idx + i + 1];
            if (s1 && s2) {
                obs.push(s2.x > s1.x ? 1 : 0);
            } else obs.push(0);
        }
        ws.send(JSON.stringify({
            event: "state",
            obs: obs,
            playerDir: gameState.playerDir,
            score: gameState.score,
            ai_active: gameState.aiEnabled
        }));
    }
}

// Color Utility
function lerpColor(a, b, t) {
    const ah = parseInt(a.replace('#', ''), 16);
    const ar = ah >> 16, ag = ah >> 8 & 0xff, ab = ah & 0xff;
    const bh = parseInt(b.replace('#', ''), 16);
    const br = bh >> 16, bg = bh >> 8 & 0xff, bb = bh & 0xff;

    const nr = ar + (br - ar) * t;
    const ng = ag + (bg - ag) * t;
    const nb = ab + (bb - ab) * t;

    return `rgb(${Math.floor(nr)}, ${Math.floor(ng)}, ${Math.floor(nb)})`;
}

function drawBackground(camX, camY) {
    const score = gameState.score;
    const w = canvas.width;
    const h = canvas.height;
    const time = Date.now() * 0.001;

    // Progression:
    const keys = [
        { scores: 0, top: '#ff9a9e', bot: '#fecfef' },    // Lovely Sunset
        { scores: 200, top: '#89f7fe', bot: '#66a6ff' },   // Clear Day
        { scores: 500, top: '#2c3e50', bot: '#fd746c' },   // Stratosphere Dusk
        { scores: 800, top: '#0f2027', bot: '#203a43' },   // Orbit
        { scores: 1000, top: '#000000', bot: '#1c1c1c' },  // Deep Space
        { scores: 9900, top: '#000000', bot: '#1c1c1c' },  // Still Deep Space
        { scores: 10000, top: '#ffffff', bot: '#dcdde1' }  // HEAVEN (White/Silver)
    ];

    let k1 = keys[0], k2 = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) {
        if (score >= keys[i].scores && score <= keys[i + 1].scores) {
            k1 = keys[i];
            k2 = keys[i + 1];
            break;
        } else if (score > keys[i].scores) {
            k1 = keys[i];
        }
    }

    let t = (score - k1.scores) / (k2.scores - k1.scores + 0.001);
    t = Math.max(0, Math.min(1, t));

    const curTop = lerpColor(k1.top, k2.top, t);
    const curBot = lerpColor(k1.bot, k2.bot, t);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, curTop);
    grad.addColorStop(1, curBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // --- HEAVEN PARTICLES ---
    if (score > 9000) {
        const heavenAlpha = Math.max(0, Math.min(1, (score - 9000) / 1000));
        if (heavenAlpha > 0) {
            ctx.globalAlpha = heavenAlpha * 0.5;
            ctx.fillStyle = '#fff';
            // Simple feather/angel dust
            for (let i = 0; i < 50; i++) {
                const fx = (i * 100 + time * 20) % w;
                const fy = (i * 200 + time * 10) % h;
                ctx.beginPath();
                ctx.arc(fx, fy, 4, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            // Divine Light
            const lightGrad = ctx.createRadialGradient(w / 2, 0, 0, w / 2, 0, h);
            lightGrad.addColorStop(0, `rgba(255, 255, 255, ${heavenAlpha * 0.3})`);
            lightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = lightGrad;
            ctx.fillRect(0, 0, w, h);
        }
    }

    // --- CELESTIAL BODIES ---
    // Sun / Moon depending on height
    const sunY = h * 0.2 + (score * 0.5);
    if (sunY < h + 100 && score < 8000) {
        // Sun Glow
        const sunGrad = ctx.createRadialGradient(w / 2, sunY, 0, w / 2, sunY, 150);
        sunGrad.addColorStop(0, 'rgba(255, 255, 200, 0.4)');
        sunGrad.addColorStop(1, 'rgba(255, 255, 200, 0)');
        ctx.fillStyle = sunGrad;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#ffde7d';
        ctx.beginPath();
        ctx.arc(w / 2, sunY, 60, 0, Math.PI * 2);
        ctx.fill();
    }

    // Stars (Visible at high altitudes)
    const starOpacity = score < 9500 ? Math.max(0, Math.min(1, (score - 600) / 400)) : Math.max(0, 1 - (score - 9500) / 500); // Fade out in Heaven
    if (starOpacity > 0) {
        ctx.globalAlpha = starOpacity;
        ctx.fillStyle = '#ffffff';
        stars.forEach(s => {
            const sx = (camX * 0.05 + s.x) % w;
            const sy = (camY * 0.05 + s.y) % h;
            const size = s.size + Math.sin(time * 5 + s.phase) * 0.5;
            ctx.beginPath();
            ctx.arc(sx, sy, Math.max(0, size), 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    // --- BUILDINGS --- (Fade out quickly)
    const buildAlpha = Math.max(0, 1 - score / 150);
    if (buildAlpha > 0) {
        ctx.globalAlpha = buildAlpha;
        buildings.forEach(b => {
            // Parallax
            const bx = (camX * 0.3 + b.x + 50000) % 3000 - 1000;
            const by = h - b.height + (score * 3);

            ctx.fillStyle = b.color;
            ctx.fillRect(bx, by, b.width, b.height);

            if (b.windows) {
                ctx.fillStyle = 'rgba(255,255,200,0.3)';
                for (let wy = by + 10; wy < by + b.height; wy += 20) {
                    for (let wx = bx + 5; wx < bx + b.width - 5; wx += 15) {
                        if (Math.random() > 0.3) ctx.fillRect(wx, wy, 8, 12);
                    }
                }
            }
        });
        ctx.globalAlpha = 1;
    }

    // --- CLOUDS ---
    const cloudAlpha = score < 600 ? 1 : Math.max(0, 1 - (score - 600) / 200);
    if (cloudAlpha > 0) {
        ctx.globalAlpha = cloudAlpha * 0.7;
        clouds.forEach((c) => {
            const cx = (camX * 0.1 + c.x + time * c.speed * 50 + 50000) % 4000 - 1000;
            const cy = h * 0.5 + c.y + (score * 2) - 300;

            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(cx, cy, c.size, 0, Math.PI * 2);
            ctx.arc(cx + c.size * 0.7, cy - c.size * 0.5, c.size * 0.8, 0, Math.PI * 2);
            ctx.arc(cx - c.size * 0.7, cy - c.size * 0.3, c.size * 0.6, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    // --- PLANETS --- (Space Only)
    const planetAlpha = score < 9500 ? Math.max(0, Math.min(1, (score - 800) / 200)) : Math.max(0, 1 - (score - 9500) / 500);
    if (planetAlpha > 0) {
        ctx.globalAlpha = planetAlpha;
        planets.forEach((p, i) => {
            const px = (camX * 0.02 + p.x) % 5000 - 1000;
            const py = p.y - (score * 1.0) + 1000;

            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(px, py, p.size, 0, Math.PI * 2);
            ctx.fill();

            if (p.texture) {
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                ctx.beginPath();
                ctx.arc(px, py, p.size * 0.8, 0, Math.PI, false);
                ctx.fill();
            }

            if (p.ring) {
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.ellipse(px, py, p.size * 2.2, p.size * 0.5, -0.3, 0, Math.PI * 2);
                ctx.stroke();
            }
        });
        ctx.globalAlpha = 1;
    }
}

function loop() {
    if (!gameState.running && !gameState.gameOver) return;

    // 1. Timer Logic
    if (gameState.running) {
        gameState.timer -= TIMER_DECAY;
        if (gameState.timer <= 0) {
            gameState.timer = 0;
            gameOver();
        }
        timerBar.style.width = `${gameState.timer}%`;

        if (gameState.timer < 30) timerBar.style.background = '#f44336';
        else if (gameState.timer < 60) timerBar.style.background = '#ff9800';
        else timerBar.style.background = 'linear-gradient(90deg, #ffeb3b, #ff9800, #f44336)';
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const targetPlayerPos = gameState.stairs[gameState.score] || { x: 0, y: 0 };

    gameState.renderPlayer.x += (targetPlayerPos.x - gameState.renderPlayer.x) * 0.2;
    gameState.renderPlayer.y += (targetPlayerPos.y - gameState.renderPlayer.y) * 0.2;

    const camX = -gameState.renderPlayer.x * STAIR_W + canvas.width / 2;

    // CAMERA OFFSET FIX (Lower the character)
    // Old: + canvas.height/2 - 200;
    // New: + canvas.height/2 + 50; (Lower is higher Y in current coord logic? Wait.)
    // Logic: camY subtraction moves objects UP.
    // sy = camY - s.y * STAIR_H
    // If we want objects LOWER on screen, sy must be larger.
    // So camY must be larger.
    const camY = gameState.renderPlayer.y * STAIR_H + canvas.height / 2 + 100;

    drawBackground(camX, camY);

    // Stairs
    gameState.stairs.forEach((s, i) => {
        if (i < gameState.score - 5 || i > gameState.score + 18) return;

        const sx = camX + s.x * STAIR_W;
        const sy = camY - s.y * STAIR_H;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(sx - STAIR_W / 2 + 8, sy + 8, STAIR_W, STAIR_H);

        // Body with Gradient
        const grad = ctx.createLinearGradient(sx, sy, sx, sy + STAIR_H);
        if (i === gameState.score) {
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(1, '#dfe6e9');
        } else {
            // HEAVEN STAIRS?
            if (gameState.score > 10000) {
                grad.addColorStop(0, '#fdcb6e'); // Gold
                grad.addColorStop(1, '#e17055');
            } else {
                grad.addColorStop(0, '#a29bfe');
                grad.addColorStop(1, '#6c5ce7');
            }
        }
        ctx.fillStyle = grad;
        ctx.fillRect(sx - STAIR_W / 2, sy, STAIR_W, STAIR_H);

        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(sx - STAIR_W / 2, sy, STAIR_W, 4);

        // COINS
        if (s.hasCoin) {
            const time = Date.now() * 0.005;
            const cy = sy - 40 + Math.sin(time) * 5;

            // Size based on Value
            let size = 10;
            let col = '#f1c40f'; // 1
            if (s.coinVal === 5) { size = 15; col = '#00d2d3'; }
            if (s.coinVal === 10) { size = 20; col = '#ff6b6b'; }

            ctx.fillStyle = col;
            ctx.strokeStyle = '#fff';
            ctx.beginPath();
            ctx.arc(sx, cy, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.stroke();

            // Text?
            ctx.fillStyle = '#000';
            ctx.font = "bold 10px Arial";
            ctx.textAlign = "center";
            ctx.fillText(s.coinVal, sx, cy + 3);

            // Sparkle
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(sx - size * 0.3, cy - size * 0.3, size * 0.2, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // Particles (Coins text)
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.life -= 0.02;
        p.y += p.dy * p.life; // Slow down
        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        const px = camX + p.x * STAIR_W;
        const py = camY - p.y * STAIR_H - 50;

        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.font = "bold 24px Arial";
        ctx.fillText(p.val || p.text, px, py);
        ctx.globalAlpha = 1;
    }

    // Player
    const px = camX + gameState.renderPlayer.x * STAIR_W;
    const py = camY - gameState.renderPlayer.y * STAIR_H;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(px, py + 5, PLAYER_R, PLAYER_R * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const pGrad = ctx.createRadialGradient(px - 4, py - 24, 2, px, py - 20, PLAYER_R);
    if (gameState.score > 10000) {
        pGrad.addColorStop(0, '#ffffff');
        pGrad.addColorStop(1, '#dfe6e9');
    } else {
        pGrad.addColorStop(0, '#55efc4');
        pGrad.addColorStop(1, '#00b894');
    }
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(px, py - 20, PLAYER_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#000';
    const lookDir = gameState.playerDir === 1 ? 1 : -1;
    ctx.beginPath();
    ctx.arc(px + lookDir * 4, py - 22, 3, 0, Math.PI * 2);
    ctx.fill();

    // Arrow
    ctx.fillStyle = '#ffeaa7';
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'black';
    const arrow = gameState.playerDir === 1 ? "→" : "←";
    const bounce = Math.sin(Date.now() / 150) * 4;
    ctx.fillText(arrow, px, py - 45 + bounce);
    ctx.shadowBlur = 0;

    if (gameState.running) requestAnimationFrame(loop);
}
// Controls
startBtn.addEventListener('click', initGame);
aiBtn.addEventListener('click', () => {
    gameState.aiEnabled = !gameState.aiEnabled;
    aiBtn.innerText = gameState.aiEnabled ? "AI: ON" : "AI: OFF";
    aiBtn.style.background = gameState.aiEnabled ? "#f44336" : "#2196f3";
});
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyJ') handleInput(0);
    if (e.code === 'KeyF') handleInput(1);
    if (e.code === 'Space' && !gameState.running) initGame();
});

// Init
resize();
initGame();
gameState.running = false;
gameState.gameOver = false;
startBtn.style.display = 'inline-block';
statusEl.innerText = "Press Start";

// Force one render to show background
requestAnimationFrame(loop);
