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
const EPSILON_DECAY = 0.999;
const MIN_EPSILON = 0.01;
const ALPHA = 0.1;
const GAMMA = 0.9;
let episode = 0;
let aiHighScore = 0;

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

// --- HIGH QUALITY GRAPHICS ASSETS (RESTORED) ---
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

    menuOverlay.style.display = 'none';
    if (isTraining || isAutoPlaying) {
        stopBtn.style.display = 'inline-block';
    } else {
        stopBtn.style.display = 'none';
        timerBar.parentElement.style.opacity = 1;
    }

    // Init Object
    gameState.stairs.push({ x: 0, y: 0, dir: 1, hasCoin: false, coinVal: 0 });
    gameState.renderPlayer = { x: 0, y: 0 };

    for (let i = 0; i < 30; i++) {
        addStair();
    }
    initBackgroundObjects();

    scoreEl.innerText = 0;
    statusEl.innerText = "";

    // AI Trigger
    if (isTraining || isAutoPlaying) {
        if (isAutoPlaying) {
            statusEl.innerText = "Robot Playing...";
        }
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
    autoPlayBtn.disabled = false;

    statusEl.innerText = "Ready";
    startBtn.style.display = 'inline-block';
}

function addStair() {
    const last = gameState.stairs[gameState.stairs.length - 1];

    // START CONSTRAINT
    if (gameState.stairs.length < 6) {
        gameState.stairs.push({
            x: last.x + 1, y: last.y + 1, dir: 1, hasCoin: false, coinVal: 0
        });
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

function performAction(action) {
    if (!gameState.running) return -10;

    const idx = gameState.score;
    const curr = gameState.stairs[idx];
    const next = gameState.stairs[idx + 1];

    if (!next) { addStair(); return performAction(action); }

    const reqDir = (next.x > curr.x) ? 1 : 0;
    let myNextDir;

    if (action === 0) { // Jump
        myNextDir = gameState.playerDir;
    } else { // Turn
        myNextDir = (gameState.playerDir === 1) ? 0 : 1;
    }

    if (myNextDir === reqDir) {
        gameState.score++;
        gameState.playerDir = myNextDir;
        scoreEl.innerText = gameState.score;
        addStair();
        gameState.timer = Math.min(MAX_TIMER, gameState.timer + TIMER_BONUS);

        if (next.hasCoin) {
            gameState.coinCount += next.coinVal;
            coinEl.innerText = gameState.coinCount;
            next.hasCoin = false;

            let col = '#ffd700'; if (next.coinVal === 5) col = '#00d2d3'; if (next.coinVal === 10) col = '#ff6b6b';
            particles.push({ type: 'text', val: '+' + next.coinVal, x: next.x, y: next.y, life: 1.0, color: col, dy: -3 });
        }
        return 10;
    } else {
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
        learningStatusEl.innerText = `Learning... Ep: ${episode} | Best: ${aiHighScore}`;
        if (epsilon > MIN_EPSILON) epsilon *= EPSILON_DECAY;
        setTimeout(initGame, 20);
    } else if (isAutoPlaying) {
        statusEl.innerText = "AI Failed. Retry...";
        setTimeout(initGame, 1000);
    } else {
        statusEl.innerText = "Game Over!";
        menuOverlay.style.display = 'block';
        startBtn.style.display = 'inline-block';
        stopBtn.style.display = 'none';
    }
}

// --- AI Loop ---
function getStateKey() {
    const idx = gameState.score;
    const curr = gameState.stairs[idx];
    const next = gameState.stairs[idx + 1];
    if (!curr || !next) return "Straight";

    const reqAbsDir = (next.x > curr.x) ? 1 : 0;
    const myAbsDir = gameState.playerDir;
    return (reqAbsDir === myAbsDir) ? "Straight" : "Turn";
}

function aiTick() {
    if (!gameState.running) return;

    const state = getStateKey();
    let action;
    if (isTraining && Math.random() < epsilon) {
        action = Math.floor(Math.random() * 2);
    } else {
        if (!qTable[state]) qTable[state] = [0, 0];
        if (qTable[state][0] === qTable[state][1]) action = Math.random() < 0.5 ? 0 : 1;
        else action = qTable[state][0] > qTable[state][1] ? 0 : 1;
    }

    const reward = performAction(action);
    const nextState = gameState.running ? getStateKey() : "Dead";

    if (isTraining) {
        if (!qTable[state]) qTable[state] = [0, 0];
        if (!qTable[nextState]) qTable[nextState] = [0, 0];
        let maxNext = Math.max(...qTable[nextState]);
        let oldVal = qTable[state][action];
        qTable[state][action] = oldVal + ALPHA * (reward + GAMMA * maxNext - oldVal);
    }

    let delay = isTraining ? 5 : 150;
    if (gameState.running) setTimeout(aiTick, delay);
}

// --- GRAPHICS: RESTORING FULL DETAIL ---

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

    // 1. SKY GRADIENT (Progression)
    const keys = [
        { scores: 0, top: '#ff9a9e', bot: '#fecfef' },    // Lovely Sunset
        { scores: 200, top: '#89f7fe', bot: '#66a6ff' },   // Clear Day
        { scores: 500, top: '#2c3e50', bot: '#fd746c' },   // Stratosphere Dusk
        { scores: 800, top: '#0f2027', bot: '#203a43' },   // Orbit
        { scores: 1000, top: '#000000', bot: '#1c1c1c' },  // Deep Space
        { scores: 10000, top: '#ffffff', bot: '#dcdde1' }  // Heaven
    ];

    let k1 = keys[0], k2 = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) {
        if (score >= keys[i].scores && score <= keys[i + 1].scores) {
            k1 = keys[i]; k2 = keys[i + 1]; break;
        } else if (score > keys[i].scores) { k1 = keys[i]; }
    }
    let t = (score - k1.scores) / (k2.scores - k1.scores + 0.001);
    t = Math.max(0, Math.min(1, t));

    const curTop = lerpColor(k1.top, k2.top, t);
    const curBot = lerpColor(k1.bot, k2.bot, t);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, curTop); grad.addColorStop(1, curBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 2. CELESTIAL BODIES
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
    const starOpacity = score < 9500 ? Math.max(0, Math.min(1, (score - 600) / 400)) : Math.max(0, 1 - (score - 9500) / 500);
    if (starOpacity > 0) {
        ctx.globalAlpha = starOpacity;
        ctx.fillStyle = '#ffffff';
        stars.forEach(s => {
            const sx = (camX * 0.05 + s.x) % w;
            const sy = (camY * 0.05 + s.y) % h;
            const size = s.size + Math.sin(time * 5 + s.phase) * 0.5;
            ctx.beginPath(); ctx.arc(sx, sy, Math.max(0, size), 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    // 3. BUILDINGS (Parallax)
    const buildAlpha = Math.max(0, 1 - score / 150);
    if (buildAlpha > 0) {
        ctx.globalAlpha = buildAlpha;
        buildings.forEach(b => {
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

    // 4. CLOUDS
    const cloudAlpha = score < 600 ? 1 : Math.max(0, 1 - (score - 600) / 200);
    if (cloudAlpha > 0) {
        ctx.globalAlpha = cloudAlpha * 0.7;
        clouds.forEach(c => {
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

    // 5. PLANETS (Space Only) - RESTORED
    // Visible when score > 800 (Space layer)
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

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Camera & Player Interp
    const target = gameState.stairs[gameState.score] || { x: 0, y: 0 };
    if (gameState.stairs.length > 0) {
        gameState.renderPlayer.x += (target.x - gameState.renderPlayer.x) * 0.2;
        gameState.renderPlayer.y += (target.y - gameState.renderPlayer.y) * 0.2;
    }
    const camX = -gameState.renderPlayer.x * STAIR_W + canvas.width / 2;
    // Lower the character slightly to match screenshot
    const camY = gameState.renderPlayer.y * STAIR_H + canvas.height / 2 + 100;

    // 2. Background (Full)
    drawBackground(camX, camY);

    // 3. Stairs
    gameState.stairs.forEach((s, i) => {
        if (i < gameState.score - 5 || i > gameState.score + 18) return;
        const sx = camX + s.x * STAIR_W;
        const sy = camY - s.y * STAIR_H;

        // Shadow (from screenshot)
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(sx - STAIR_W / 2 + 8, sy + 8, STAIR_W, STAIR_H);

        // Body Gradient
        const grad = ctx.createLinearGradient(sx, sy, sx, sy + STAIR_H);
        if (i === gameState.score) {
            grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#dfe6e9');
        } else {
            // Blue/Purple gradient from screenshot
            grad.addColorStop(0, '#a29bfe'); grad.addColorStop(1, '#6c5ce7');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(sx - STAIR_W / 2, sy, STAIR_W, STAIR_H);

        // Highlight stroke (White top)
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(sx - STAIR_W / 2, sy, STAIR_W, 4);

        if (s.hasCoin) {
            let col = '#f1c40f';
            if (s.coinVal === 5) col = '#00d2d3'; if (s.coinVal === 10) col = '#ff6b6b';

            // Coin Glow
            ctx.fillStyle = col;
            ctx.beginPath(); ctx.arc(sx, sy - 30, 10, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

            // Small sparkle
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx - 3, sy - 33, 2, 0, Math.PI * 2); ctx.fill();
        }
    });

    // 4. Player
    const px = camX + gameState.renderPlayer.x * STAIR_W;
    const py = camY - gameState.renderPlayer.y * STAIR_H;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(px, py + 5, PLAYER_R, PLAYER_R * 0.3, 0, 0, Math.PI * 2); ctx.fill();

    // Body
    const pGrad = ctx.createRadialGradient(px - 4, py - 24, 2, px, py - 20, PLAYER_R);
    pGrad.addColorStop(0, '#55efc4'); pGrad.addColorStop(1, '#00b894');
    ctx.fillStyle = pGrad;
    ctx.beginPath(); ctx.arc(px, py - 20, PLAYER_R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

    // Eyes
    ctx.fillStyle = '#000';
    const lookDir = gameState.playerDir === 1 ? 1 : -1;
    ctx.beginPath(); ctx.arc(px + lookDir * 4, py - 22, 3, 0, Math.PI * 2); ctx.fill();

    // Arrow
    ctx.fillStyle = '#ffeaa7';
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.shadowBlur = 4; ctx.shadowColor = 'black';
    const bounce = Math.sin(Date.now() / 150) * 4;
    ctx.fillText(gameState.playerDir === 1 ? "→" : "←", px, py - 45 + bounce);
    ctx.shadowBlur = 0;

    // 5. Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.life -= 0.02;
        p.y += p.dy * p.life;
        if (p.life <= 0) { particles.splice(i, 1); continue; }

        const ppx = camX + p.x * STAIR_W;
        const ppy = camY - p.y * STAIR_H - 50;

        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.font = "bold 20px Arial";
        ctx.fillText(p.val, ppx, ppy);
        ctx.globalAlpha = 1.0;
    }
}

// --- Main Loop ---
function loop() {
    if (gameState.running) {
        gameState.timer -= TIMER_DECAY;
        if (gameState.timer <= 0) { gameState.timer = 0; gameOver(); }
        timerBar.style.width = `${gameState.timer}%`;

        // Progress Bar Color
        let col = '#ffeb3b';
        if (gameState.timer < 30) col = '#f44336'; else if (gameState.timer < 60) col = '#ff9800';
        else col = 'linear-gradient(90deg, #ffeb3b, #ff9800, #f44336)';
        timerBar.style.background = col;
    }

    render(); // Always render
    requestAnimationFrame(loop);
}

// --- Event Listeners ---
startBtn.addEventListener('click', () => {
    isTraining = false; isAutoPlaying = false; initGame();
});

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
        episodeCountEl.innerText = 0; highScoreEl.innerText = 0;
    }
});
stopBtn.addEventListener('click', stopGame);

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyJ') handleInput(0);
    if (e.code === 'KeyF') handleInput(1);
    if (e.code === 'Space' && !gameState.running && !isTraining) initGame();
});

btnTurn.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(1); });
btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(0); });
btnTurn.addEventListener('mousedown', (e) => { e.preventDefault(); handleInput(1); });
btnJump.addEventListener('mousedown', (e) => { e.preventDefault(); handleInput(0); });

// Init
resize();
gameState.running = false;
gameState.stairs = [];
for (let i = 0; i < 30; i++) gameState.stairs.push({ x: 0, y: 0, hasCoin: false, coinVal: 0 });
// Fake init game to draw at least once
gameState.renderPlayer = { x: 0, y: 0 };
initBackgroundObjects();
render();
// Start Loop
loop();
