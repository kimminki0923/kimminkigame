const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const statusEl = document.getElementById('status');
const timerBar = document.getElementById('timer-bar');
const coinEl = document.getElementById('coin-count');

// Menu & Buttons
const menuOverlay = document.getElementById('menu-overlay');
const startBtn = document.getElementById('start-btn');
const trainBtn = document.getElementById('train-btn');
const autoPlayBtn = document.getElementById('auto-play-btn');
const resetAiBtn = document.getElementById('reset-ai-btn');
const stopBtn = document.getElementById('stop-btn');

const learningStatusEl = document.getElementById('learning-status');
const episodeCountEl = document.getElementById('episode-count');
const highScoreEl = document.getElementById('high-score');

// Mobile Buttons
const btnTurn = document.getElementById('btn-turn');
const btnJump = document.getElementById('btn-jump');

// --- AI Logic (Q-Learning) ---
let qTable = {};
let isTraining = false;
let isAutoPlaying = false;
let epsilon = 1.0;
const EPSILON_DECAY = 0.995;
const ALPHA = 0.1;
const GAMMA = 0.9;
let episode = 0;
let aiHighScore = 0;
let autoRestartDelay = 50;

// Game Config
const STAIR_W = 100;
const STAIR_H = 25;
const PLAYER_R = 12;
const MAX_TIMER = 100;
const TIMER_DECAY = 0.3;
const TIMER_BONUS = 15;

let gameState = {
    running: false,
    score: 0,
    coinCount: 0,
    playerDir: 1, // 1=Right, 0=Left
    stairs: [],
    gameOver: false,
    timer: 100,
    renderPlayer: { x: 0, y: 0 }
};

// Backgrounds
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
        clouds.push({ x: Math.random() * 4000 - 2000, y: Math.random() * 800, size: 50 + Math.random() * 80, speed: (Math.random() - 0.5) * 0.8, opacity: 0.3 + Math.random() * 0.5 });
    }
    // Minimal init for others to prevent errors
    stars.length = 0;
    for (let i = 0; i < 100; i++) stars.push({ x: Math.random() * 2000, y: Math.random() * 2000, size: Math.random() * 2 });
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);

// --- Core Game Functions ---

function initGame() {
    gameState.score = 0;
    gameState.coinCount = 0;
    gameState.running = true;
    gameState.gameOver = false;
    gameState.playerDir = 1;
    gameState.stairs = [];
    gameState.timer = MAX_TIMER;
    particles.length = 0;

    // UI
    menuOverlay.style.display = 'none';
    stopBtn.style.display = 'inline-block';

    // Init Object
    gameState.stairs.push({ x: 0, y: 0, dir: 1, hasCoin: false, coinVal: 0 });
    gameState.renderPlayer = { x: 0, y: 0 };

    for (let i = 0; i < 30; i++) {
        addStair();
    }
    initBackgroundObjects();

    scoreEl.innerText = 0;

    // AI Trigger
    if (isTraining || isAutoPlaying) {
        aiTick();
    }
}

function stopGame() {
    gameState.running = false;
    isTraining = false;
    isAutoPlaying = false;
    menuOverlay.style.display = 'block';
    stopBtn.style.display = 'none';
    trainBtn.innerText = "🧠 AI 학습하기";
    trainBtn.style.background = "#e67e22";
}

function addStair() {
    const last = gameState.stairs[gameState.stairs.length - 1];
    if (gameState.stairs.length < 6) {
        gameState.stairs.push({
            x: last.x + 1, y: last.y + 1, dir: 1, hasCoin: false, coinVal: 0
        });
        return;
    }
    let nextDir = Math.random() < 0.7 ? last.dir : (last.dir === 1 ? 0 : 1);
    let hasCoin = Math.random() < 0.3;
    let coinVal = hasCoin ? (Math.random() < 0.6 ? 1 : 5) : 0;

    gameState.stairs.push({
        x: last.x + (nextDir === 1 ? 1 : -1),
        y: last.y + 1,
        dir: nextDir,
        hasCoin: hasCoin,
        coinVal: coinVal
    });
}

function performAction(action) {
    // 0: Jump, 1: Turn
    if (!gameState.running) return -10;

    const idx = gameState.score;
    const curr = gameState.stairs[idx];
    const next = gameState.stairs[idx + 1];

    if (!next) { addStair(); return performAction(action); }

    const reqDir = (next.x > curr.x) ? 1 : 0;
    let myNextDir = (action === 0) ? gameState.playerDir : (gameState.playerDir === 1 ? 0 : 1);

    if (myNextDir === reqDir) {
        // Success
        gameState.score++;
        gameState.playerDir = myNextDir;
        scoreEl.innerText = gameState.score;
        addStair();
        gameState.timer = Math.min(MAX_TIMER, gameState.timer + TIMER_BONUS);

        if (next.hasCoin) {
            gameState.coinCount += next.coinVal;
            coinEl.innerText = gameState.coinCount;
            next.hasCoin = false;
            particles.push({ val: '+' + next.coinVal, x: next.x, y: next.y, life: 1.0, color: '#ffd700', dy: -2 });
        }
        return 10;
    } else {
        // Fail
        gameOver();
        return -50;
    }
}

function handleInput(action) {
    if (isTraining || isAutoPlaying) return;
    performAction(action);
}

function gameOver() {
    gameState.running = false;
    gameState.gameOver = true;

    if (gameState.score > aiHighScore) {
        aiHighScore = gameState.score;
        highScoreEl.innerText = aiHighScore;
    }

    if (isTraining) {
        episode++;
        episodeCountEl.innerText = episode;
        learningStatusEl.innerText = `Ep: ${episode} (Score: ${gameState.score})`;
        if (epsilon > 0.01) epsilon *= EPSILON_DECAY;
        setTimeout(initGame, autoRestartDelay);
    } else if (isAutoPlaying) {
        setTimeout(initGame, 1000);
    } else {
        // Human Player Died
        stopGame();
        statusEl.innerText = "Game Over!";
    }
}

// --- AI Loop ---
function getStateKey() {
    // Simple state: "Forward" (reqDir == myDir) or "Turn" (reqDir != myDir)
    const idx = gameState.score;
    const curr = gameState.stairs[idx];
    const next = gameState.stairs[idx + 1];
    if (!next) return "Forward";
    const reqDir = (next.x > curr.x) ? 1 : 0;
    return (reqDir === gameState.playerDir) ? "Forward" : "Turn";
}

function aiTick() {
    if (!gameState.running) return;

    const state = getStateKey();

    // Choose Action
    let action;
    if (isTraining && Math.random() < epsilon) {
        action = Math.floor(Math.random() * 2);
    } else {
        if (!qTable[state]) qTable[state] = [0, 0];
        action = qTable[state][0] > qTable[state][1] ? 0 : 1;
    }

    // Act
    const reward = performAction(action);
    const nextState = gameState.running ? getStateKey() : "Dead";

    // Learn
    if (isTraining) {
        if (!qTable[state]) qTable[state] = [0, 0];
        if (!qTable[nextState]) qTable[nextState] = [0, 0]; // if dead, maybe all 0

        let maxNext = Math.max(...qTable[nextState]);
        let oldVal = qTable[state][action];
        qTable[state][action] = oldVal + ALPHA * (reward + GAMMA * maxNext - oldVal);
    }

    // Loop
    let delay = isTraining ? 10 : 150; // Fast training
    setTimeout(aiTick, delay);
}

// --- RENDER ---
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Cam
    const target = gameState.stairs[gameState.score] || { x: 0, y: 0 };
    if (gameState.stairs.length > 0) {
        gameState.renderPlayer.x += (target.x - gameState.renderPlayer.x) * 0.2;
        gameState.renderPlayer.y += (target.y - gameState.renderPlayer.y) * 0.2;
    }
    const camX = -gameState.renderPlayer.x * STAIR_W + canvas.width / 2;
    const camY = gameState.renderPlayer.y * STAIR_H + canvas.height / 2 + 100;

    // Background Gradient
    const score = gameState.score;
    // Simple logic compared to before to ensure no errors
    let r = 255, g = 154, b = 158; // Sunsetish
    if (score > 50) { r = 137; g = 247; b = 254; }
    if (score > 100) { r = 0; g = 0; b = 0; }

    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stars
    ctx.fillStyle = '#FFF';
    stars.forEach(s => {
        ctx.fillRect((camX * 0.1 + s.x) % canvas.width, (camY * 0.1 + s.y) % canvas.height, s.size, s.size);
    });

    // Stairs
    gameState.stairs.forEach((s, i) => {
        if (i < gameState.score - 5 || i > gameState.score + 18) return;
        const sx = camX + s.x * STAIR_W;
        const sy = camY - s.y * STAIR_H;

        ctx.fillStyle = (i === gameState.score) ? '#dfe6e9' : '#6c5ce7';
        ctx.fillRect(sx - STAIR_W / 2, sy, STAIR_W, STAIR_H);

        if (s.hasCoin) {
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath(); ctx.arc(sx, sy - 30, 8, 0, Math.PI * 2); ctx.fill();
        }
    });

    // Player
    const px = camX + gameState.renderPlayer.x * STAIR_W;
    const py = camY - gameState.renderPlayer.y * STAIR_H;

    ctx.fillStyle = '#55efc4';
    ctx.beginPath(); ctx.arc(px, py - 20, PLAYER_R, 0, Math.PI * 2); ctx.fill();

    // Arrow
    ctx.fillStyle = '#000';
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.fillText(gameState.playerDir === 1 ? "→" : "←", px, py - 40);

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.life -= 0.05;
        p.y += p.dy;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.fillStyle = p.color;
        ctx.fillText(p.val, camX + p.x * STAIR_W, camY - p.y * STAIR_H - 40);
    }
}

// --- Main Loop ---
function loop() {
    // 1. Update Game Logic (Timer)
    if (gameState.running) {
        gameState.timer -= TIMER_DECAY;
        if (gameState.timer <= 0) {
            gameState.timer = 0;
            gameOver();
        }
        timerBar.style.width = `${gameState.timer}%`;
    }

    // 2. Render (ALWAYS)
    render();

    // 3. Loop
    requestAnimationFrame(loop);
}

// --- Event Listeners ---
startBtn.addEventListener('click', initGame);
stopBtn.addEventListener('click', stopGame);

trainBtn.addEventListener('click', () => {
    isTraining = !isTraining;
    isAutoPlaying = false;
    if (isTraining) {
        trainBtn.innerText = "⏹️ 학습 중지";
        trainBtn.style.background = "#c0392b";
        initGame();
    } else {
        stopGame();
    }
});

autoPlayBtn.addEventListener('click', () => {
    isAutoPlaying = true;
    isTraining = false;
    initGame();
});

resetAiBtn.addEventListener('click', () => {
    if (confirm("AI Reset?")) {
        qTable = {}; episode = 0; epsilon = 1.0; aiHighScore = 0;
        episodeCountEl.innerText = 0;
        highScoreEl.innerText = 0;
    }
});

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyJ') handleInput(0);
    if (e.code === 'KeyF') handleInput(1);
    if (e.code === 'Space' && (!gameState.running)) initGame();
});

btnTurn.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(1); });
btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(0); });
btnTurn.addEventListener('mousedown', (e) => { e.preventDefault(); handleInput(1); });
btnJump.addEventListener('mousedown', (e) => { e.preventDefault(); handleInput(0); });

// --- Boot ---
resize();
gameState.running = false;
initBackgroundObjects();
loop(); // START THE LOOP IMMEDIATELY
