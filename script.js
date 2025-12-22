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
const useONNX = true;

async function initONNX() {
    try {
        statusEl.innerText = "AI 모델 로딩중...";
        // Intentionally failing or placeholder if file missing, handled by catch
        ortSession = await ort.InferenceSession.create('./model.onnx');
        statusEl.innerText = "AI 준비됨";
    } catch (e) {
        console.error("ONNX Load Failed", e);
        // Do not alert, just log. Setup game anyway.
        statusEl.innerText = "AI 로드 실패(게임은 가능)";
    }
}

if (useONNX) {
    initONNX();
}

let gameState = {
    running: false,
    score: 0,
    coinCount: 0,
    playerDir: 1,
    stairs: [],
    gameOver: false,
    aiEnabled: false,
    timer: 100,
    renderPlayer: { x: 0, y: 0 }
};

const STAIR_W = 100;
const STAIR_H = 25;
const PLAYER_R = 12;
const MAX_TIMER = 100;
const TIMER_DECAY = 0.3;
const TIMER_BONUS = 15;

const buildings = [];
const clouds = [];
const planets = [];
const stars = [];
const particles = [];

function initBackgroundObjects() {
    buildings.length = 0;
    for (let i = 0; i < 25; i++) {
        buildings.push({
            x: Math.random() * 3000 - 1500,
            width: 60 + Math.random() * 100,
            height: 150 + Math.random() * 400,
            color: `hsl(230, 25%, ${10 + Math.random() * 15}%)`,
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

    // Core Fix: Must loop to render
    loop();
}

function showButtons() {
    startBtn.style.display = 'inline-block';
    aiBtn.style.display = 'none'; // Keep AI hidden for now
}

function addStair() {
    const last = gameState.stairs[gameState.stairs.length - 1];
    if (gameState.stairs.length < 6) {
        gameState.stairs.push({ x: last.x + 1, y: last.y + 1, dir: 1, hasCoin: false, coinVal: 0 });
        return;
    }
    let nextDir;
    if (Math.random() < 0.7) { nextDir = last.dir; } else { nextDir = last.dir === 1 ? 0 : 1; }
    let hasCoin = false;
    let coinVal = 0;
    if (Math.random() < 0.3) {
        hasCoin = true;
        const r = Math.random();
        if (r < 0.6) coinVal = 1; else if (r < 0.9) coinVal = 5; else coinVal = 10;
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

    if (!targetPos) { addStair(); return handleInput(action); }

    const requiredDir = (targetPos.x > currPos.x) ? 1 : 0;
    let chosenDir;
    if (action === 0) { chosenDir = gameState.playerDir; } else { chosenDir = gameState.playerDir === 1 ? 0 : 1; }

    if (chosenDir === requiredDir) {
        gameState.score++;
        gameState.playerDir = chosenDir;
        scoreEl.innerText = gameState.score;
        if (targetPos.hasCoin) {
            gameState.coinCount += targetPos.coinVal;
            if (coinEl) coinEl.innerText = gameState.coinCount;
            targetPos.hasCoin = false;
            let col = '#ffd700'; if (targetPos.coinVal === 5) col = '#00d2d3'; if (targetPos.coinVal === 10) col = '#ff6b6b';
            particles.push({ type: 'text', val: '+' + targetPos.coinVal, x: targetPos.x, y: targetPos.y, life: 1.0, color: col, dy: -2 });
        }
        addStair();
        gameState.timer = Math.min(MAX_TIMER, gameState.timer + TIMER_BONUS);
    } else {
        gameOver();
    }
}

function gameOver() {
    gameState.running = false;
    gameState.gameOver = true;
    statusEl.innerText = "Game Over!";
    showButtons();
}

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
    const keys = [
        { scores: 0, top: '#ff9a9e', bot: '#fecfef' },
        { scores: 200, top: '#89f7fe', bot: '#66a6ff' },
        { scores: 500, top: '#2c3e50', bot: '#fd746c' },
        { scores: 800, top: '#0f2027', bot: '#203a43' },
        { scores: 1000, top: '#000000', bot: '#1c1c1c' },
        { scores: 10000, top: '#ffffff', bot: '#dcdde1' }
    ];
    let k1 = keys[0], k2 = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) {
        if (score >= keys[i].scores && score <= keys[i + 1].scores) { k1 = keys[i]; k2 = keys[i + 1]; break; } else if (score > keys[i].scores) { k1 = keys[i]; }
    }
    let t = (score - k1.scores) / (k2.scores - k1.scores + 0.001);
    t = Math.max(0, Math.min(1, t));
    const curTop = lerpColor(k1.top, k2.top, t);
    const curBot = lerpColor(k1.bot, k2.bot, t);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, curTop); grad.addColorStop(1, curBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // (Omitted detailed background objects for reliability, just simple gradient first)
}

function loop() {
    // Original Loop Logic
    if (!gameState.running && !gameState.gameOver) return;

    if (gameState.running) {
        gameState.timer -= TIMER_DECAY;
        if (gameState.timer <= 0) { gameState.timer = 0; gameOver(); }
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
    const camY = gameState.renderPlayer.y * STAIR_H + canvas.height / 2 + 100;

    drawBackground(camX, camY);

    gameState.stairs.forEach((s, i) => {
        if (i < gameState.score - 5 || i > gameState.score + 18) return;
        const sx = camX + s.x * STAIR_W;
        const sy = camY - s.y * STAIR_H;

        const grad = ctx.createLinearGradient(sx, sy, sx, sy + STAIR_H);
        if (i === gameState.score) { grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#dfe6e9'); }
        else { grad.addColorStop(0, '#a29bfe'); grad.addColorStop(1, '#6c5ce7'); }
        ctx.fillStyle = grad;
        ctx.fillRect(sx - STAIR_W / 2, sy, STAIR_W, STAIR_H);

        if (s.hasCoin) {
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath(); ctx.arc(sx, sy - 30, 10, 0, Math.PI * 2); ctx.fill();
        }
    });

    const px = camX + gameState.renderPlayer.x * STAIR_W;
    const py = camY - gameState.renderPlayer.y * STAIR_H;

    // Player
    ctx.fillStyle = '#55efc4';
    ctx.beginPath(); ctx.arc(px, py - 20, PLAYER_R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

    // Arrow
    ctx.fillStyle = '#ffeaa7';
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(gameState.playerDir === 1 ? "→" : "←", px, py - 45);

    if (gameState.running) requestAnimationFrame(loop);
}

startBtn.addEventListener('click', initGame);
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyJ') handleInput(0);
    if (e.code === 'KeyF') handleInput(1);
    if (e.code === 'Space' && !gameState.running) initGame();
});

// Mobile Controls
btnTurn.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(1); });
btnTurn.addEventListener('mousedown', (e) => { e.preventDefault(); handleInput(1); });
btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(0); });
btnJump.addEventListener('mousedown', (e) => { e.preventDefault(); handleInput(0); });

// Force Init Call to render cover frame
resize();
gameState.stairs = [];
for (let i = 0; i < 30; i++) gameState.stairs.push({ x: 0, y: 0, hasCoin: false, coinVal: 0 });
// Fake init game to draw at least once
gameState.running = true; // Temporary
gameState.renderPlayer = { x: 0, y: 0 };
// Render ONE frame then stop
ctx.clearRect(0, 0, canvas.width, canvas.height);
drawBackground(canvas.width / 2, canvas.height / 2 + 100);
// Reset for real usage
gameState.running = false;
