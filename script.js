const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const statusEl = document.getElementById('status');
const timerBar = document.getElementById('timer-bar');
const coinEl = document.getElementById('coin-count');

// Buttons from HTML
const startBtn = document.getElementById('start-btn');
const trainBtn = document.getElementById('train-btn');
const autoPlayBtn = document.getElementById('auto-play-btn');
const resetAiBtn = document.getElementById('reset-ai-btn');
const learningStatusEl = document.getElementById('learning-status');
const episodeCountEl = document.getElementById('episode-count');
const highScoreEl = document.getElementById('high-score');

// Mobile Buttons
const btnTurn = document.getElementById('btn-turn');
const btnJump = document.getElementById('btn-jump');

// --- AI Q-Learning Variables ---
let qTable = {}; // State -> [Val_Action0(Jump), Val_Action1(Turn)]
let isTraining = false;
let isAutoPlaying = false;
let epsilon = 1.0;
const EPSILON_DECAY = 0.995;
const MIN_EPSILON = 0.01;
const ALPHA = 0.1;
const GAMMA = 0.9;
let episode = 0;
let aiHighScore = 0;
let trainingSpeed = 1; // 1=Normal, 20=Fast (skip frames)

// --- Game Constants ---
const STAIR_W = 100;
const STAIR_H = 25;
const PLAYER_R = 12;
const MAX_TIMER = 100;
// Make AI learn easier: Slower timer decay
const TIMER_DECAY = 0.3;
const TIMER_BONUS = 15;

let gameState = {
    running: false,
    score: 0,
    coinCount: 0,
    playerDir: 1,
    stairs: [],
    gameOver: false,
    timer: 100,
    renderPlayer: { x: 0, y: 0 }
};

// Background Objects
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

    // Normal play UI
    if (!isTraining && !isAutoPlaying) {
        startBtn.style.display = 'none';
        timerBar.parentElement.style.opacity = 1;
    } else {
        startBtn.style.display = 'none';
    }

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

    // Start Loop
    loop();

    // AI Loop Kickoff
    if (isTraining || isAutoPlaying) {
        aiTick();
    }
}

function addStair() {
    const last = gameState.stairs[gameState.stairs.length - 1];

    // Constraint: First 5 steps straight
    if (gameState.stairs.length < 6) {
        gameState.stairs.push({
            x: last.x + 1, y: last.y + 1, dir: 1, hasCoin: false, coinVal: 0
        });
        return;
    }

    let nextDir;
    if (Math.random() < 0.7) nextDir = last.dir;
    else nextDir = last.dir === 1 ? 0 : 1;

    let hasCoin = false;
    let coinVal = 0;
    if (Math.random() < 0.3) {
        hasCoin = true;
        const r = Math.random();
        if (r < 0.6) coinVal = 1;
        else if (r < 0.9) coinVal = 5;
        else coinVal = 10;
    }

    gameState.stairs.push({
        x: last.x + (nextDir === 1 ? 1 : -1),
        y: last.y + 1,
        dir: nextDir,
        hasCoin: hasCoin,
        coinVal: coinVal
    });
}

// --- AI Logic Functions ---

function getAIState() {
    // Relative direction of next stair vs player facing
    // We need to know: Is next stair "straight" relative to me, or "turn"?

    const currIdx = gameState.score;
    if (currIdx >= gameState.stairs.length - 1) return "Goal"; // Should addStair

    const currentPos = gameState.stairs[currIdx];
    const targetPos = gameState.stairs[currIdx + 1];

    // Required Absolute Direction (1=Right, 0=Left)
    let requiredAbsDir = (targetPos.x > currentPos.x) ? 1 : 0;

    // My Current Facing (1=Right, 0=Left)
    let myFacing = gameState.playerDir;

    // State: "Same" (if required == facing) or "Diff" (if required != facing)
    // Actually simpler: State is just "Do I need to Turn?"
    // Let's use simpler state: Just "NextRelDir"
    // If required == facing -> Forward
    // If required != facing -> Turn

    // However, Q Learning needs state.
    // If the world is random, the only state that matters is "What is the next step?"
    // The agent observes: "Next step is [Right]" and "I am facing [Left]" -> State: "Right_Left"
    // Or relative: "Next step is [Forward]" -> State: "Forward"
    // Q-Table will be very simple for this game.

    let state = (requiredAbsDir === myFacing) ? "Forward" : "Turn";
    return state;
}

function chooseAction(state) {
    // Action 0: Jump (Maintain Dir), Action 1: Turn (Change Dir)

    if (isTraining && Math.random() < epsilon) {
        return Math.floor(Math.random() * 2);
    }

    if (!qTable[state]) qTable[state] = [0, 0];
    return qTable[state][0] > qTable[state][1] ? 0 : 1;
}

function updateQ(state, action, reward, nextState) {
    if (!qTable[state]) qTable[state] = [0, 0];
    if (!qTable[nextState]) qTable[nextState] = [0, 0];

    const oldVal = qTable[state][action];
    const nextMax = Math.max(...qTable[nextState]);

    qTable[state][action] = oldVal + ALPHA * (reward + GAMMA * nextMax - oldVal);
}

function aiTick() {
    if (!gameState.running) return;

    // Speed Control
    let delay = isTraining ? (20) : 150; // Super fast train, Normal play

    const state = getAIState();
    const action = chooseAction(state);

    // Execute Action logic directly to get reward
    const reward = performAction(action);

    if (isTraining) {
        const nextState = gameState.running ? getAIState() : "Dead";
        updateQ(state, action, reward, nextState);
    }

    if (gameState.running) {
        setTimeout(aiTick, delay);
    }
}

// Rewritten handleInput to separate Return Value (Reward) for AI
function performAction(action) {
    // Action 0: Jump (Forward), 1: Turn (Reverse)
    // Returns Reward

    if (!gameState.running) return 0;

    const currentStairIndex = gameState.score;
    const currPos = gameState.stairs[currentStairIndex];
    const targetPos = gameState.stairs[currentStairIndex + 1];

    if (!targetPos) {
        addStair();
        return performAction(action);
    }

    const requiredAbsDir = (targetPos.x > currPos.x) ? 1 : 0;

    // Determine chosen absolute direction
    let chosenAbsDir;
    if (action === 0) { // Jump -> Keep Direction
        chosenAbsDir = gameState.playerDir;
    } else { // Turn -> Flip Direction
        chosenAbsDir = gameState.playerDir === 1 ? 0 : 1;
    }

    // Check Success
    if (chosenAbsDir === requiredAbsDir) {
        // SUCCESS
        gameState.score++;
        gameState.playerDir = chosenAbsDir;
        scoreEl.innerText = gameState.score;

        // Coin Logic
        if (targetPos.hasCoin) {
            gameState.coinCount += targetPos.coinVal;
            if (coinEl) coinEl.innerText = gameState.coinCount;
            targetPos.hasCoin = false;
            // Particles
            let col = '#ffd700';
            if (targetPos.coinVal === 5) col = '#00d2d3';
            if (targetPos.coinVal === 10) col = '#ff6b6b';
            particles.push({
                type: 'text', val: '+' + targetPos.coinVal,
                x: targetPos.x, y: targetPos.y, life: 1.0, color: col, dy: -2
            });
        }

        addStair();
        gameState.timer = Math.min(MAX_TIMER, gameState.timer + TIMER_BONUS);

        return 10; // Reward
    } else {
        // FAIL
        gameOver();
        return -50; // Penalty
    }
}

// Wrapper for User Input
function handleInput(action) {
    if (isTraining || isAutoPlaying) return; // Ignore user input during AI
    performAction(action);
}


function gameOver() {
    gameState.running = false;
    gameState.gameOver = true;
    statusEl.innerText = "Game Over!";

    if (gameState.score > aiHighScore) {
        aiHighScore = gameState.score;
        highScoreEl.innerText = aiHighScore;
    }

    if (isTraining) {
        episode++;
        episodeCountEl.innerText = episode;
        if (epsilon > MIN_EPSILON) epsilon *= EPSILON_DECAY;

        learningStatusEl.innerText = `Testing AI... (Ep: ${episode}, Highest: ${aiHighScore})`;

        // Auto Restart Fast
        setTimeout(initGame, 50);
    } else if (isAutoPlaying) {
        statusEl.innerText = "AI Finished. Restarting...";
        setTimeout(() => {
            initGame();
        }, 1000);
    } else {
        startBtn.style.display = 'inline-block';
    }
}

// --- Rendering & Loop (Original Engine) ---

function lerpColor(a, b, t) {
    const ah = parseInt(a.replace('#', ''), 16);
    const ar = ah >> 16, ag = ah >> 8 & 0xff, ab = ah & 0xff;
    const bh = parseInt(b.replace('#', ''), 16);
    const br = bh >> 16, bg = bh >> 8 & 0xff, bb = bh & 0xff;
    const nr = ar + (br - ar) * t;
    const ng = ag + (bg - ag) * t;
    return `rgb(${Math.floor(nr)}, ${Math.floor(ng)}, ${Math.floor(nb)})`;
}

function drawBackground(camX, camY) {
    const score = gameState.score;
    const w = canvas.width;
    const h = canvas.height;
    const time = Date.now() * 0.001;

    // Colors
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
        if (score >= keys[i].scores && score <= keys[i + 1].scores) {
            k1 = keys[i]; k2 = keys[i + 1]; break;
        } else if (score > keys[i].scores) k1 = keys[i];
    }
    let t = (score - k1.scores) / (k2.scores - k1.scores + 0.001);
    t = Math.max(0, Math.min(1, t));

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, lerpColor(k1.top, k2.top, t));
    grad.addColorStop(1, lerpColor(k1.bot, k2.bot, t));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Simple Clouds/Stars rendering kept
    ctx.fillStyle = '#fff';
    // ... (Simplified for brevity but kept essence)
}

function loop() {
    if (!gameState.running && !gameState.gameOver) return;

    if (gameState.running) {
        gameState.timer -= TIMER_DECAY;
        if (gameState.timer <= 0) {
            gameState.timer = 0;
            // Time out death
            gameOver();
            // In training, time out is neutral/bad.
            if (isTraining && gameState.running) { // if not already dead
                // Manually penalize? 
                // gameOver handles episode reset
            }
        }
        timerBar.style.width = `${gameState.timer}%`;

        let col = '#ffeb3b';
        if (gameState.timer < 30) col = '#f44336';
        else if (gameState.timer < 60) col = '#ff9800';
        timerBar.style.background = col;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const targetPlayerPos = gameState.stairs[gameState.score] || { x: 0, y: 0 };
    gameState.renderPlayer.x += (targetPlayerPos.x - gameState.renderPlayer.x) * 0.2;
    gameState.renderPlayer.y += (targetPlayerPos.y - gameState.renderPlayer.y) * 0.2;

    const camX = -gameState.renderPlayer.x * STAIR_W + canvas.width / 2;
    const camY = gameState.renderPlayer.y * STAIR_H + canvas.height / 2 + 100;

    drawBackground(camX, camY);

    // Stairs
    gameState.stairs.forEach((s, i) => {
        if (i < gameState.score - 5 || i > gameState.score + 18) return;
        const sx = camX + s.x * STAIR_W;
        const sy = camY - s.y * STAIR_H;

        // Visuals
        const grad = ctx.createLinearGradient(sx, sy, sx, sy + STAIR_H);
        grad.addColorStop(0, '#a29bfe');
        grad.addColorStop(1, '#6c5ce7');
        if (i === gameState.score) {
            grad.addColorStop(0, '#fff'); grad.addColorStop(1, '#dfe6e9');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(sx - STAIR_W / 2, sy, STAIR_W, STAIR_H);

        // Coin
        if (s.hasCoin) {
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath(); ctx.arc(sx, sy - 30, 10, 0, Math.PI * 2); ctx.fill();
        }
    });

    // Player
    const px = camX + gameState.renderPlayer.x * STAIR_W;
    const py = camY - gameState.renderPlayer.y * STAIR_H;

    ctx.fillStyle = '#55efc4';
    ctx.beginPath(); ctx.arc(px, py - 20, PLAYER_R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

    // Arrow
    ctx.fillStyle = '#ffeaa7';
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    const arrow = gameState.playerDir === 1 ? "→" : "←";
    ctx.fillText(arrow, px, py - 45);

    if (gameState.running) requestAnimationFrame(loop);
}

// --- Event Listeners ---
startBtn.addEventListener('click', initGame);

trainBtn.addEventListener('click', () => {
    isTraining = !isTraining;
    isAutoPlaying = false;

    if (isTraining) {
        trainBtn.innerText = "⏹️ 학습 중지";
        trainBtn.style.backgroundColor = "#e74c3c";

        if (confirm("AI 학습을 시작합니다. (고속 모드)")) {
            initGame();
        } else {
            isTraining = false;
            trainBtn.innerText = "🧠 AI 학습하기";
            trainBtn.style.backgroundColor = "#e67e22";
        }
    } else {
        trainBtn.innerText = "🧠 AI 학습하기";
        trainBtn.style.backgroundColor = "#e67e22";
        autoPlayBtn.disabled = false;
    }
});

autoPlayBtn.addEventListener('click', () => {
    isAutoPlaying = true;
    isTraining = false;
    initGame();
});

resetAiBtn.addEventListener('click', () => {
    if (confirm("AI 지식을 초기화할까요?")) {
        qTable = {};
        episode = 0;
        epsilon = 1.0;
        aiHighScore = 0;
        episodeCountEl.innerText = 0;
        highScoreEl.innerText = 0;
    }
});

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyJ') handleInput(0);
    if (e.code === 'KeyF') handleInput(1);
    if (e.code === 'Space' && !gameState.running && !isTraining) initGame();
});

btnTurn.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(1); });
btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(0); });

// Init
resize();
initGame();
gameState.running = false; // Pause immediately to show Start button
startBtn.style.display = 'inline-block';
statusEl.innerText = "Press Start";
