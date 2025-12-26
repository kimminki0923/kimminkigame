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

// --- AI & Persistent State ---
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
let totalCoins = 0;
let currentSkin = localStorage.getItem('currentSkin') || 'default';
let ownedSkins = JSON.parse(localStorage.getItem('ownedSkins') || '["default"]');
let skinRotation = 0; // For animation

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
        // Success
        gameState.score++;
        gameState.playerDir = myNextDir;
        scoreEl.innerText = gameState.score;
        addStair();
        gameState.timer = Math.min(MAX_TIMER, gameState.timer + TIMER_BONUS);

        // Update Skin Rotation
        updateSkinRotation();

        if (next.hasCoin) {
            gameState.coinCount += next.coinVal; // Session count

            // Real-time Total Update (Only visual if AI, saved if Human)
            if (!isTraining && !isAutoPlaying) {
                totalCoins += next.coinVal;
                coinEl.innerText = totalCoins;

                // SAVE to Local immediately for crash protection
                localStorage.setItem('infinite_stairs_coins', totalCoins);

                // Sync Shop UI Gold if shop is open or about to open
                const shopGold = document.getElementById('shop-gold');
                if (shopGold) shopGold.innerText = totalCoins;
            } else {
                coinEl.innerText = "(AI)";
            }

            next.hasCoin = false;

            let col = '#ffd700'; if (next.coinVal === 5) col = '#00d2d3'; if (next.coinVal === 10) col = '#ff6b6b';
            particles.push({ type: 'text', val: '+' + next.coinVal, x: next.x, y: next.y, life: 1.0, color: col, dy: -3 });
        }
        return 10;
    } else {
        // Optimization: Skip animation during training for speed
        if (isTraining) {
            gameOver();
            return -50;
        }

        // Fail -> Trigger Fall Animation (Only for humans or watching AI)
        startFalling(myNextDir);
        return -50;
    }
}

function handleInput(action) {
    if (isTraining || isAutoPlaying) return;
    performAction(action);
}

// Fall Animation Logic
let isFalling = false;
let fallVelocity = 0;
let fallY = 0;
let fallX = 0;

function startFalling(wrongDir) {
    isFalling = true;
    gameState.running = false; // Stop game logic (timer, input)

    // Setup initial fall relative pos
    fallVelocity = -5; // Jump up slightly first
    fallY = 0;

    // Move character visually to the wrong side (Air)
    // wrongDir is abs direction (0 or 1).
    // stairs[score] is current.
    // If wrongDir is 1 (Right), x + 1. If 0 (Left), x - 1.
    const curr = gameState.stairs[gameState.score];
    fallX = (wrongDir === 1) ? 1 : -1;

    // Point player to wrong dir
    gameState.playerDir = wrongDir;
}

function updateFall() {
    if (!isFalling) return;

    // Physics
    fallVelocity += 0.8; // Gravity
    fallY -= fallVelocity; // y is inverted in render (up is +y in logic, but checks need care)
    // Actually our render uses: camY - s.y * STAIR_H
    // So positive fallY should mean 'dropping down'.
    // Let's adjust:
    // renderPlayer.y will be modified.

    gameState.renderPlayer.y -= (fallVelocity * 0.05); // Drop coordinate
    gameState.renderPlayer.x += (fallX * 0.05); // Drift away

    // If dropped enough, trigger real game over
    if (gameState.renderPlayer.y < gameState.stairs[gameState.score].y - 10) {
        isFalling = false;
        gameOver();
    }
}

// (Duplicate gameOver at 311 removed - using improved version at 984)

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

    drawPlayerWithSkin(ctx, px, py, gameState.playerDir);

    // 5. Arrow (Moving Arrow below Player display)
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
        // Dynamic Difficulty (Logarithmic Decay)
        // Base decay: 0.3
        // As score increases, decay accelerates.
        // Formula: 0.3 + (Math.log(score + 1) * 0.05)
        // Max limit to prevent impossible game at very high scores.
        let currentDecay = TIMER_DECAY + (Math.log(gameState.score + 10) * 0.08);
        currentDecay = Math.min(currentDecay, 1.2); // Cap max speed

        gameState.timer -= currentDecay;
        if (gameState.timer <= 0) { gameState.timer = 0; gameOver(); }
        timerBar.style.width = `${gameState.timer}%`;

        // Progress Bar Color
        let col = '#ffeb3b';
        if (gameState.timer < 30) col = '#f44336'; else if (gameState.timer < 60) col = '#ff9800';
        else col = 'linear-gradient(90deg, #ffeb3b, #ff9800, #f44336)';
        timerBar.style.background = col;
    }

    if (isFalling) updateFall(); // Process Animation

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

// Redundant skin declarations removed (already at top)

const SKIN_DATA = {
    default: { name: '기본 (원형)', icon: '⚪', type: 'circle' },
    skin_square: { name: '사각형', icon: '🟧', type: 'square', price: 150 },
    skin_triangle: { name: '삼각형', icon: '🔺', type: 'triangle', price: 200 },
    skin_diamond: { name: '다이아몬드', icon: '💎', type: 'diamond', price: 500 }
};

// Open Shop
document.getElementById('shop-open-btn')?.addEventListener('click', () => {
    const overlay = document.getElementById('shop-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        updateShopUI();
    }
});

// Close Shop
document.getElementById('close-shop-btn')?.addEventListener('click', () => {
    const overlay = document.getElementById('shop-overlay');
    if (overlay) overlay.style.display = 'none';
});

// Shop Interaction Logic (Drag-to-Scroll + Click)
const shopScrollArea = document.getElementById('shop-scroll-area');
let isDragging = false;
let startY, startScrollTop;

function initShopInteractions() {
    if (!shopScrollArea) return;

    const startDrag = (pageY) => {
        isDragging = true;
        shopScrollArea.classList.add('active');
        startY = pageY;
        startScrollTop = shopScrollArea.scrollTop;
    };

    const moveDrag = (pageY) => {
        if (!isDragging) return;
        const delta = (pageY - startY) * 1.4; // Slightly faster scroll
        shopScrollArea.scrollTop = startScrollTop - delta;
    };

    const endDrag = () => {
        isDragging = false;
        shopScrollArea.classList.remove('active');
    };

    // Mouse Events
    shopScrollArea.addEventListener('mousedown', (e) => startDrag(e.pageY));
    window.addEventListener('mousemove', (e) => moveDrag(e.pageY));
    window.addEventListener('mouseup', endDrag);

    // Touch Events
    shopScrollArea.addEventListener('touchstart', (e) => startDrag(e.touches[0].pageY), { passive: true });
    window.addEventListener('touchmove', (e) => {
        if (isDragging) {
            moveDrag(e.touches[0].pageY);
            if (e.cancelable) e.preventDefault();
        }
    }, { passive: false });
    window.addEventListener('touchend', endDrag);
}
initShopInteractions();

function updateShopUI() {
    // Gold Display
    const shopGold = document.getElementById('shop-gold');
    if (shopGold) shopGold.innerText = totalCoins;

    // Current Skin Display
    const currentDisplay = document.getElementById('current-skin-display');
    if (currentDisplay && SKIN_DATA[currentSkin]) {
        currentDisplay.innerText = `${SKIN_DATA[currentSkin].icon} ${SKIN_DATA[currentSkin].name}`;
    }

    // Update Buy/Equip Buttons
    document.querySelectorAll('.buy-btn').forEach(btn => {
        const skinId = btn.dataset.id;
        if (ownedSkins.includes(skinId)) {
            // Already owned - show equip button
            btn.innerText = currentSkin === skinId ? '✓ 장착중' : '장착하기';
            btn.style.background = currentSkin === skinId ? '#7f8c8d' : '#2ecc71';
            btn.disabled = currentSkin === skinId;
            btn.classList.add('equip-btn');
            btn.classList.remove('buy-btn');
        }
    });

    document.querySelectorAll('.equip-btn').forEach(btn => {
        const skinId = btn.dataset.skin || btn.dataset.id;
        if (skinId === currentSkin) {
            btn.innerText = '✓ 장착중';
            btn.style.background = '#7f8c8d';
            btn.disabled = true;
        } else if (ownedSkins.includes(skinId)) {
            btn.innerText = '장착하기';
            btn.style.background = '#2ecc71';
            btn.disabled = false;
        }
    });
}

// Global Shop Click Handler (Combined)
document.addEventListener('click', (e) => {
    // 1. Close Button
    if (e.target.closest('#close-shop-btn') || e.target.closest('[onclick*="shop-overlay"]')) {
        document.getElementById('shop-overlay').style.display = 'none';
        return;
    }

    // 2. Buy Button
    const buyBtn = e.target.closest('.buy-btn');
    if (buyBtn) {
        const skinId = buyBtn.dataset.id;
        const price = parseInt(buyBtn.dataset.price);

        if (ownedSkins.includes(skinId)) {
            equipSkin(skinId);
            return;
        }

        if (totalCoins >= price) {
            totalCoins -= price;
            ownedSkins.push(skinId);

            // UI Update
            if (coinEl) coinEl.innerText = totalCoins;

            // SAVE ALL
            if (window.saveData) {
                window.saveData(aiHighScore, totalCoins, ownedSkins, skinId);
            }

            alert(`✅ ${SKIN_DATA[skinId]?.name || skinId} 구매 완료!`);
            equipSkin(skinId);
            updateShopUI();
        } else {
            alert(`❌ 골드가 부족합니다! (보유: ${totalCoins}G / 필요: ${price}G)`);
        }
        return;
    }

    // 3. Equip Button
    const equipBtn = e.target.closest('.equip-btn');
    if (equipBtn) {
        const skinId = equipBtn.dataset.skin || equipBtn.dataset.id;
        if (ownedSkins.includes(skinId) || skinId === 'default') {
            equipSkin(skinId);
            if (window.saveData) {
                window.saveData(aiHighScore, totalCoins, ownedSkins, skinId);
            }
        }
        return;
    }
});

function equipSkin(skinId) {
    currentSkin = skinId;
    localStorage.setItem('currentSkin', skinId);
    updateShopUI();
    console.log(`Equipped skin: ${skinId}`);

    // Save immediately on equip
    if (window.saveData) {
        window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin);
    }
}

function updateSkinRotation() {
    const skin = SKIN_DATA[currentSkin] || SKIN_DATA.default;
    if (skin.type !== 'circle') {
        skinRotation += Math.PI / 4; // 45 degrees per move
    } else {
        skinRotation = 0;
    }
}

// Draw Player with Skin
function drawPlayerWithSkin(ctx, px, py, dir) {
    const skin = SKIN_DATA[currentSkin] || SKIN_DATA.default;

    ctx.save();
    ctx.translate(px, py - 20);

    // Rotation animation for non-default skins
    if (skin.type !== 'circle') {
        ctx.rotate(skinRotation);
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 25, PLAYER_R, PLAYER_R * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    switch (skin.type) {
        case 'square':
            // Rotating cube
            const size = PLAYER_R * 1.5;
            ctx.fillStyle = '#e67e22';
            ctx.fillRect(-size / 2, -size / 2, size, size);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(-size / 2, -size / 2, size, size);
            // 3D effect lines
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath();
            ctx.moveTo(-size / 2, -size / 2);
            ctx.lineTo(0, -size);
            ctx.moveTo(size / 2, -size / 2);
            ctx.lineTo(0, -size);
            ctx.stroke();
            break;

        case 'triangle':
            // Rotating pyramid
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.moveTo(0, -PLAYER_R * 1.5);
            ctx.lineTo(-PLAYER_R, PLAYER_R * 0.5);
            ctx.lineTo(PLAYER_R, PLAYER_R * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            break;

        case 'diamond':
            // Sparkling diamond
            ctx.fillStyle = '#3498db';
            ctx.beginPath();
            ctx.moveTo(0, -PLAYER_R * 1.5);
            ctx.lineTo(-PLAYER_R, 0);
            ctx.lineTo(0, PLAYER_R * 0.8);
            ctx.lineTo(PLAYER_R, 0);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Sparkle
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.beginPath();
            ctx.arc(-PLAYER_R * 0.3, -PLAYER_R * 0.5, 3, 0, Math.PI * 2);
            ctx.fill();
            break;

        default:
            // Default circle
            const pGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, PLAYER_R);
            pGrad.addColorStop(0, '#55efc4');
            pGrad.addColorStop(1, '#00b894');
            ctx.fillStyle = pGrad;
            ctx.beginPath();
            ctx.arc(0, 0, PLAYER_R, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Eyes
            ctx.fillStyle = '#000';
            const lookDir = dir === 1 ? 1 : -1;
            ctx.beginPath();
            ctx.arc(lookDir * 4, -2, 3, 0, Math.PI * 2);
            ctx.fill();
    }

    ctx.restore();
}

// Update skin rotation on each step
function updateSkinRotation() {
    if (SKIN_DATA[currentSkin]?.type !== 'circle') {
        skinRotation += Math.PI / 2; // 90 degree rotation per step
    }
}


// --- File I/O (JSON "Pickle" style) ---
const saveFileBtn = document.getElementById('save-file-btn');
const loadFileBtn = document.getElementById('load-file-btn');
const fileInput = document.getElementById('file-input');

if (saveFileBtn) {
    saveFileBtn.addEventListener('click', () => {
        const data = {
            highScore: aiHighScore,
            coins: gameState.coinCount,
            qTable: qTable, // Save AI Brain
            episode: episode,
            epsilon: epsilon,
            timestamp: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `infinite_stairs_save_${new Date().getTime()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert("💾 게임 데이터가 파일로 저장되었습니다!");
    });
}

if (loadFileBtn) {
    loadFileBtn.addEventListener('click', () => {
        fileInput.click();
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                // Restore Game Data
                aiHighScore = data.highScore || 0;
                highScoreEl.innerText = aiHighScore;

                gameState.coinCount = data.coins || 0;
                coinEl.innerText = gameState.coinCount;

                // Restore AI Brain
                if (data.qTable) {
                    qTable = data.qTable;
                    episode = data.episode || 0;
                    epsilon = data.epsilon || 1.0;
                    episodeCountEl.innerText = episode;
                    learningStatusEl.innerText = `Loaded! Ep: ${episode}`;
                    autoPlayBtn.disabled = false; // Enable AI play if loaded
                }

                alert("📂 데이터 불러오기 성공!\n점수, 코인, AI 지능이 복구되었습니다.");
            } catch (err) {
                console.error(err);
                alert("❌ 파일 형식이 잘못되었습니다.");
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset
    });
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyJ') handleInput(0);
    if (e.code === 'KeyF') handleInput(1);
    if (e.code === 'Space' && !gameState.running && !isTraining) initGame();
});

btnTurn.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(1); });
btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(0); });
btnTurn.addEventListener('mousedown', (e) => { e.preventDefault(); handleInput(1); });
btnJump.addEventListener('mousedown', (e) => { e.preventDefault(); handleInput(0); });

// --- Data State ---
// Redirect redundant totalCoins declaration

// --- Data Bridge (Connected to auth.js) ---
window.setGameData = function (score, coins, skins, cSkin) {
    console.log(`Loaded Game Data: Score ${score}, Coins ${coins}, Skins ${skins?.length}`);
    aiHighScore = score;
    if (highScoreEl) highScoreEl.innerText = aiHighScore;

    totalCoins = coins;
    if (coinEl) coinEl.innerText = totalCoins;

    if (skins) ownedSkins = skins;
    if (cSkin) currentSkin = cSkin;

    updateShopUI();
}

function gameOver() {
    gameState.running = false;
    gameState.gameOver = true;

    // 1. AI Training/Autoplay Logic
    if (isTraining) {
        // AI Logic: No Saving
        if (gameState.score > aiHighScore) aiHighScore = gameState.score;
        episode++;
        episodeCountEl.innerText = episode;
        learningStatusEl.innerText = `Learning... Ep: ${episode} | Best: ${aiHighScore}`;
        if (epsilon > MIN_EPSILON) epsilon *= EPSILON_DECAY;
        setTimeout(initGame, 20);
        return; // EXIT
    }

    if (isAutoPlaying) {
        // AI Logic: No Saving
        statusEl.innerText = "Robot Failed. Retry...";
        setTimeout(initGame, 1000);
        return; // EXIT
    }

    // 2. Human Logic: Save Data
    if (gameState.score > aiHighScore) {
        aiHighScore = gameState.score;
        highScoreEl.innerText = aiHighScore;
    }

    // TRIGGER SAVE (Only for human)
    if (window.saveData) {
        window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin);
    }

    statusEl.innerText = "Game Over!";
    menuOverlay.style.display = 'block';
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';

    document.getElementById('high-score').innerText = aiHighScore;
}

// Ensure saving on tab close/refresh
window.addEventListener('beforeunload', () => {
    if (window.saveData && !isTraining && !isAutoPlaying) {
        window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin);
    }
});

// In performAction: Handle totalCoins update
// We need to inject this Logic into performAction function, wait...
// I will modify performAction separately or include it here if simple.
// Since performAction is large, let's do it in separate chunk or rely on gameState.coinCount for session and add to totalCoins at end? 
// BETTER: Update totalCoins immediately for UI feedback.

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

// Call Init Auth
if (window.initAuth) window.initAuth();

// --- Page Switching Logic ---
window.showPage = function (pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add('active');

    const navBtn = document.getElementById('nav-' + pageId.replace('page-', ''));
    if (navBtn) navBtn.classList.add('active');

    // Pause Infinite Stairs if not on its page
    if (pageId !== 'page-stairs') {
        gameState.running = false;
        if (isTraining || isAutoPlaying) stopGame();
        // Hide mobile controls on other pages
        document.getElementById('mobile-controls').style.display = 'none';
    } else {
        // Show mobile controls if on mobile and on stairs page
        if (window.innerWidth <= 768) {
            document.getElementById('mobile-controls').style.display = 'flex';
        }
    }
}

// --- Liar Game Logic (Multiplayer with Firebase) ---
const liarTopics = {
    food: ["사과", "바나나", "포도", "피자", "치킨", "햄버거", "초밥", "라면", "파스타", "도넛", "삼겹살", "떡볶이", "마라탕"],
    animal: ["코끼리", "기린", "펭귄", "호랑이", "사자", "토끼", "강아지", "고양이", "햄스터", "판다", "악어", "독수리", "공룡"],
    object: ["컴퓨터", "스마트폰", "텔레비전", "냉장고", "세탁기", "의자", "책상", "연필", "지우개", "안경", "시계", "침대", "거울"],
    sports: ["축구", "농구", "야구", "배구", "수영", "테니스", "골프", "볼링", "양궁", "태권도", "마라톤", "스케이트", "펜싱"],
    place: ["학교", "병원", "경찰서", "공원", "바다", "산", "서울", "미국", "공항", "도서관", "영화관", "백화점", "박물관"]
};

let currentRoomId = null;
let roomUnsubscribe = null;
let chatUnsubscribe = null;

// Helper to check if it's my turn
function isMyTurn(data) {
    return data.status === 'turn_based' && data.turnOrder[data.currentTurnIndex] === currentUser.uid;
}

async function createLiarRoom() {
    if (!currentUser) return alert("로그인이 필요합니다. G Google 로그인을 먼저 해주세요.");
    const roomId = document.getElementById('liar-room-id').value || Math.floor(1000 + Math.random() * 9000).toString();
    const maxScore = parseInt(document.getElementById('liar-max-score').value) || 3;

    try {
        await db.collection('rooms').doc(roomId).set({
            host: currentUser.uid,
            status: 'lobby',
            players: {
                [currentUser.uid]: { name: currentUser.displayName, photo: currentUser.photoURL, joinedAt: Date.now() }
            },
            scores: { [currentUser.uid]: 0 }, // Init Score
            maxScore: maxScore,
            topic: 'random',
            liarId: null,
            word: "",
            revealed: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        joinLiarRoom(roomId);
    } catch (e) {
        console.error("Room Create Error:", e);
        alert("방 생성 실패: " + e.message);
    }
}

async function joinLiarRoom(roomId) {
    if (!currentUser) return alert("로그인이 필요합니다.");
    if (!roomId) roomId = document.getElementById('liar-room-id').value;
    if (!roomId) return alert("방 코드를 입력하세요.");

    const docRef = db.collection('rooms').doc(roomId);

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            if (!doc.exists) throw "존재하지 않는 방입니다.";

            const data = doc.data();
            const players = data.players || {};

            // Limit check (30 players)
            if (Object.keys(players).length >= 30 && !players[currentUser.uid]) {
                throw "방이 꽉 찼습니다 (최대 30명).";
            }

            players[currentUser.uid] = {
                name: currentUser.displayName,
                photo: currentUser.photoURL,
                joinedAt: Date.now()
            };

            const scores = data.scores || {};
            if (scores[currentUser.uid] === undefined) {
                scores[currentUser.uid] = 0;
            }

            transaction.update(docRef, { players: players, scores: scores });
        });

        currentRoomId = roomId;

        // UI Transition
        document.getElementById('liar-entry').style.display = 'none';
        document.getElementById('liar-lobby').style.display = 'block';
        document.getElementById('display-room-id').innerText = roomId;
        document.getElementById('liar-chat-section').style.display = 'block';

        // Sync Listener
        if (roomUnsubscribe) roomUnsubscribe();
        roomUnsubscribe = docRef.onSnapshot(snapshot => {
            if (snapshot.exists) syncLiarRoom(snapshot.data());
        }, error => {
            console.error("Room Sync Error:", error);
        });

        // Chat Listener
        if (chatUnsubscribe) chatUnsubscribe();
        const chatList = document.getElementById('liar-chat-messages');
        chatList.innerHTML = '';
        chatUnsubscribe = docRef.collection('messages').orderBy('timestamp').onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const msg = change.doc.data();
                    const name = (msg.name || "Anonymous").substring(0, 10);
                    const isMine = msg.uid === currentUser.uid;
                    const div = document.createElement('div');
                    div.className = 'chat-wrapper' + (isMine ? ' mine' : '');
                    div.innerHTML = `
                        <div class="chat-msg ${isMine ? 'mine' : ''}">
                            <div class="chat-name">${name}</div>
                            <div class="chat-text">${msg.text}</div>
                        </div>
                    `;
                    chatList.appendChild(div);
                    chatList.scrollTop = chatList.scrollHeight;
                }
            });
        }, error => {
            console.error("Chat Sync Error:", error);
        });

    } catch (e) {
        console.error("Join Error:", e);
        alert("입장 실패: " + e);
    }
}

function syncLiarRoom(data) {
    const isHost = data.host === currentUser.uid;
    const players = Object.entries(data.players || {}).sort((a, b) => a[1].joinedAt - b[1].joinedAt);

    // --- 1. Scoreboard Update ---
    const scoreList = document.getElementById('score-list');
    scoreList.innerHTML = '';
    const scores = data.scores || {};
    let maxScoreReached = false;
    let grandWinnerName = "";

    players.forEach(([uid, p]) => {
        const score = scores[uid] || 0;
        const li = document.createElement('li');
        li.innerText = `${p.name}: ${score}점`;
        if (score >= data.maxScore) {
            li.style.color = '#f1c40f';
            li.style.fontWeight = 'bold';
            maxScoreReached = true;
            grandWinnerName = p.name;
        }
        scoreList.appendChild(li);
    });
    document.getElementById('score-limit').innerText = `(목표: ${data.maxScore}점)`;
    document.getElementById('scoreboard').style.display = 'block';

    // --- 2. Lobby & Settings ---
    const playerList = document.getElementById('player-list');
    playerList.innerHTML = '';
    players.forEach(([uid, p]) => {
        const li = document.createElement('li');
        li.className = 'player-tag' + (uid === data.host ? ' is-host' : '');
        li.innerText = p.name;
        playerList.appendChild(li);
    });

    const settingsDiv = document.getElementById('room-settings');
    const topicSelect = document.getElementById('liar-topic-select');

    if (isHost) {
        settingsDiv.style.display = 'block';
        if (document.activeElement !== topicSelect) {
            topicSelect.value = data.topic || 'random';
        }
    } else {
        settingsDiv.style.display = 'none';
    }

    document.getElementById('liar-start-multi-btn').style.display = (isHost && data.status === 'lobby') ? 'inline-block' : 'none';
    document.getElementById('liar-host-controls').style.display = (isHost && data.status === 'lobby') ? 'block' : 'none';
    const guestLeaveRef = document.getElementById('liar-leave-guest-btn');
    if (guestLeaveRef) {
        guestLeaveRef.style.display = (!isHost && data.status === 'lobby') ? 'block' : 'none';
    }
    document.getElementById('waiting-msg').style.display = (data.status === 'lobby') ? 'block' : 'none';

    // Update max score display in lobby
    document.getElementById('display-max-score').innerText = data.maxScore || 3;

    // --- 3. View Management ---
    const lobbyDiv = document.getElementById('liar-lobby');
    const gameDiv = document.getElementById('liar-game-play');
    const resultDiv = document.getElementById('liar-result');
    const chatSection = document.getElementById('liar-chat-section');
    const descLog = document.getElementById('description-log');
    const descList = document.getElementById('description-list');
    const voteSection = document.getElementById('liar-vote-section');
    const voteBtns = document.getElementById('vote-buttons');
    const guessSection = document.getElementById('liar-guess-section');
    const overlay = document.getElementById('turn-overlay');

    // Default Hidden
    document.getElementById('liar-host-controls-play').style.display = 'none'; // Replaced old ID
    document.getElementById('liar-discussion-msg').style.display = 'none';
    document.getElementById('liar-reveal-multi-btn').style.display = 'none';
    voteSection.style.display = 'none';
    guessSection.style.display = 'none';
    descLog.style.display = 'none';
    overlay.style.display = 'none';

    // Keep Chat visible unless Voting/Guessing
    chatSection.style.display = (data.status === 'voting' || data.status === 'liar_guess') ? 'none' : 'block';

    // Render Description Log
    if (data.descriptions && data.descriptions.length > 0) {
        descLog.style.display = 'block';
        descList.innerHTML = '';
        data.descriptions.forEach(desc => {
            const row = document.createElement('div');
            row.className = 'desc-row';
            row.innerHTML = `<span class="desc-name">${desc.name}</span><span class="desc-text">${desc.text}</span>`;
            descList.appendChild(row);
        });
    }

    if (data.status === 'lobby') {
        lobbyDiv.style.display = 'block';
        gameDiv.style.display = 'none';
        resultDiv.style.display = 'none';

        const card = document.getElementById('liar-card');
        card.className = 'card-back';
        document.getElementById('liar-card-topic').innerText = "";
        document.getElementById('liar-card-word').innerText = "클릭하여 확인";

    } else if (data.status === 'playing') {
        lobbyDiv.style.display = 'none';
        gameDiv.style.display = 'block';
        resultDiv.style.display = 'none';

        const card = document.getElementById('liar-card');
        const cardTopic = document.getElementById('liar-card-topic');
        const cardWord = document.getElementById('liar-card-word');

        // Topic Help for Liar
        const topicTxt = data.topicName ? `주제: ${data.topicName}` : "";

        if (data.liarId === currentUser.uid) {
            card.dataset.role = 'liar';
            card.dataset.word = '당신은 라이어입니다!'; // Store for click reveal
            cardTopic.innerText = topicTxt; // Show Topic to Liar too
            cardWord.innerText = card.classList.contains('revealed') ? '당신은 라이어입니다!' : '클릭하여 확인';
        } else {
            card.dataset.role = 'player';
            card.dataset.word = `제시어: ${data.word}`; // Store for click reveal
            cardTopic.innerText = topicTxt;
            cardWord.innerText = card.classList.contains('revealed') ? `제시어: ${data.word}` : '클릭하여 확인';
        }

        document.getElementById('liar-host-controls-play').style.display = isHost ? 'block' : 'none';
        // Add button if missing
        if (isHost && !document.getElementById('liar-next-state-turn')) {
            const btn = document.createElement('button');
            btn.id = 'liar-next-state-turn';
            btn.className = 'primary-btn';
            btn.innerText = "모두 확인 완료 (설명 시작)";
            btn.onclick = () => db.collection('rooms').doc(currentRoomId).update({ status: 'turn_based' });
            document.getElementById('liar-host-controls-play').appendChild(btn);
        }

    } else if (data.status === 'turn_based') {
        lobbyDiv.style.display = 'none';
        gameDiv.style.display = 'block';
        resultDiv.style.display = 'none';

        const currentTurnPlayerId = data.turnOrder[data.currentTurnIndex];
        const currentTurnPlayer = data.players[currentTurnPlayerId];
        const myTurnInput = document.getElementById('my-turn-input');

        overlay.style.display = 'block';
        if (currentTurnPlayerId === currentUser.uid) {
            document.getElementById('overlay-msg').innerText = "🎤 당신의 차례입니다!";
            myTurnInput.style.display = 'block';
            document.getElementById('description-input').focus();
        } else {
            document.getElementById('overlay-msg').innerText = `👂 ${currentTurnPlayer.name} 님의 차례`;
            myTurnInput.style.display = 'none';
        }

    } else if (data.status === 'discussion') {
        lobbyDiv.style.display = 'none';
        gameDiv.style.display = 'block';
        resultDiv.style.display = 'none';

        document.getElementById('liar-discussion-msg').style.display = 'block';
        document.getElementById('liar-reveal-multi-btn').style.display = isHost ? 'inline-block' : 'none';
        document.getElementById('liar-reveal-multi-btn').innerText = "투표 시작";

    } else if (data.status === 'voting') {
        lobbyDiv.style.display = 'none';
        gameDiv.style.display = 'block';
        resultDiv.style.display = 'none';
        voteSection.style.display = 'block';

        voteBtns.innerHTML = '';
        players.forEach(([uid, p]) => {
            const btn = document.createElement('button');
            btn.className = 'vote-btn';
            btn.innerText = p.name;
            if (data.votes && data.votes[currentUser.uid] === uid) {
                btn.classList.add('selected');
            }
            btn.onclick = () => voteForPlayer(uid);
            voteBtns.appendChild(btn);
        });

        const votedCount = Object.keys(data.votes || {}).length;
        const totalCount = players.length;
        document.getElementById('vote-status').innerText = `투표 현황: ${votedCount} / ${totalCount}`;

    } else if (data.status === 'liar_guess') {
        lobbyDiv.style.display = 'none';
        gameDiv.style.display = 'block';
        resultDiv.style.display = 'none';
        guessSection.style.display = 'block';

        const votedName = data.players[data.votedOutId].name;
        document.querySelector('#liar-guess-section h3').innerText = `🕵️ ${votedName} (라이어) 지목!`;

        if (data.liarId === currentUser.uid) {
            document.getElementById('liar-word-input').style.display = 'inline-block';
            document.getElementById('liar-guess-btn').style.display = 'inline-block';
        } else {
            document.getElementById('liar-word-input').style.display = 'none';
            document.getElementById('liar-guess-btn').style.display = 'none';
            document.querySelector('#liar-guess-section p').innerText = "라이어가 역전 기회를 노리고 있습니다...";
        }

    } else if (data.status === 'result') {
        lobbyDiv.style.display = 'none';
        gameDiv.style.display = 'none';
        resultDiv.style.display = 'block';

        const liarName = data.players[data.liarId]?.name || "알 수 없음";
        let title = "";
        let color = "";

        if (data.roundWinner === 'liar') {
            title = "👿 라이어 승리!";
            color = "#e74c3c";
        } else {
            title = "😇 시민 승리!";
            color = "#2ecc71";
        }

        if (maxScoreReached) {
            title = `🏆 최종 우승: ${grandWinnerName}!`;
            color = "#f1c40f";
            document.getElementById('liar-next-round-btn').style.display = 'none';
            document.getElementById('liar-restart-multi-btn').style.display = isHost ? 'inline-block' : 'none';
        } else {
            document.getElementById('liar-next-round-btn').style.display = isHost ? 'inline-block' : 'none';
            document.getElementById('liar-next-round-btn').innerText = "다음 라운드 시작";
            document.getElementById('liar-restart-multi-btn').style.display = 'none';
        }

        document.getElementById('liar-winner').innerText = title;
        document.getElementById('liar-winner').style.color = color;

        document.getElementById('liar-identity-reveal').innerText = `라이어는 [${liarName}] 이었습니다!`;
        document.getElementById('liar-word-reveal').innerText = `주제: ${data.topicName}\n제시어: ${data.word}`;
    }

    // Trigger Bot Logic (if host)
    if (typeof handleBotAutomation === 'function') {
        handleBotAutomation(data);
    }
}

async function startLiarGame() {
    // This is now "Start Round"
    if (!currentRoomId) return;
    const docRef = db.collection('rooms').doc(currentRoomId);
    const snap = await docRef.get();
    const data = snap.data();
    const players = Object.keys(data.players);
    if (players.length < 1) return alert("플레이어가 부족합니다.");

    let selectedTopic = data.topic || 'random';
    if (selectedTopic === 'random') {
        const topics = Object.keys(liarTopics);
        selectedTopic = topics[Math.floor(Math.random() * topics.length)];
    }

    const wordList = liarTopics[selectedTopic];
    const word = wordList[Math.floor(Math.random() * wordList.length)];
    const liarId = players[Math.floor(Math.random() * players.length)];
    const topicNames = { food: '음식', animal: '동물', object: '사물', sports: '스포츠', place: '장소' };

    // Shuffle turn order
    for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [players[i], players[j]] = [players[j], players[i]];
    }

    await docRef.update({
        status: 'playing',
        liarId: liarId,
        word: word,
        topicName: topicNames[selectedTopic],
        turnOrder: players,
        currentTurnIndex: 0,
        revealed: false,
        descriptions: [],
        votes: {},
        votedOutId: null,
        roundWinner: null
    });
}

function leaveLiarRoom() {
    if (roomUnsubscribe) roomUnsubscribe();
    if (chatUnsubscribe) chatUnsubscribe();
    if (currentRoomId && currentUser) {
        const update = {};
        update[`players.${currentUser.uid}`] = firebase.firestore.FieldValue.delete();
        update[`votes.${currentUser.uid}`] = firebase.firestore.FieldValue.delete();
        db.collection('rooms').doc(currentRoomId).update(update);
    }
    currentRoomId = null;
    document.getElementById('liar-entry').style.display = 'block';
    document.getElementById('liar-lobby').style.display = 'none';
    document.getElementById('liar-game-play').style.display = 'none';
    document.getElementById('liar-result').style.display = 'none';
    document.getElementById('liar-chat-section').style.display = 'none';
    document.getElementById('scoreboard').style.display = 'none';
}

async function sendLiarMessage() {
    console.log("Sending chat message...");
    if (!currentRoomId) { console.error("No Room ID"); return; }
    if (!currentUser) { console.error("No User"); return; }

    const input = document.getElementById('liar-chat-input');
    const text = input.value.trim();
    if (!text) return;

    try {
        await db.collection('rooms').doc(currentRoomId).collection('messages').add({
            uid: currentUser.uid,
            name: currentUser.displayName,
            text: text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        input.value = '';
        console.log("Chat sent successfully");
    } catch (e) {
        console.error("Chat Error:", e);
        alert("채팅 전송 실패: " + e.message);
    }
}

// 설명 전송 함수 (차례일 때만)
async function sendDescription() {
    console.log("Sending description...");
    if (!currentRoomId || !currentUser) return;
    const input = document.getElementById('description-input');
    const text = input.value.trim();
    if (!text) return;

    try {
        const docRef = db.collection('rooms').doc(currentRoomId);
        const snap = await docRef.get();
        const data = snap.data();

        if (data.status !== 'turn_based') {
            console.warn("Not turn based");
            return;
        }

        const currentTurnPlayerId = data.turnOrder[data.currentTurnIndex];
        if (currentTurnPlayerId !== currentUser.uid) {
            alert("지금은 당신의 차례가 아닙니다!");
            return;
        }

        // Save description
        const newDesc = {
            uid: currentUser.uid,
            name: currentUser.displayName,
            text: text
        };
        const updatedDescriptions = [...(data.descriptions || []), newDesc];

        // Advance Turn
        let nextIndex = data.currentTurnIndex + 1;
        let nextStatus = 'turn_based';
        if (nextIndex >= data.turnOrder.length) {
            nextStatus = 'discussion'; // All turns done
        }

        await docRef.update({
            descriptions: updatedDescriptions,
            currentTurnIndex: nextIndex,
            status: nextStatus
        });

        input.value = '';
        document.getElementById('my-turn-input').style.display = 'none';
        console.log("Description saved");
    } catch (e) {
        console.error("Description Error:", e);
        alert("설명 전송 실패: " + e.message);
    }
}

async function voteForPlayer_deprecated(targetUid) {
    if (!currentRoomId || !currentUser) return;
    const docRef = db.collection('rooms').doc(currentRoomId);

    // Save locally to prevent early trigger
    await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);
        if (!doc.exists) return;

        const data = doc.data();
        const players = Object.keys(data.players);
        const votes = data.votes || {};

        // Add my vote
        votes[currentUser.uid] = targetUid;
        transaction.update(docRef, { votes: votes });

        // Check completion
        if (Object.keys(votes).length === players.length) {
            const voteCounts = {};
            Object.values(votes).forEach(v => {
                voteCounts[v] = (voteCounts[v] || 0) + 1;
            });

            let maxVotes = 0;
            let candidates = [];
            for (const [uid, count] of Object.entries(voteCounts)) {
                if (count > maxVotes) {
                    maxVotes = count;
                    candidates = [uid];
                } else if (count === maxVotes) {
                    candidates.push(uid);
                }
            }

            if (candidates.length > 1) {
                // Tie: Back to discussion
                transaction.update(docRef, { status: 'discussion', votes: {} });
            } else {
                const eliminatedId = candidates[0];
                if (eliminatedId === data.liarId) {
                    // Liar Caught -> Liar Guess Phase
                    transaction.update(docRef, {
                        status: 'liar_guess',
                        votedOutId: eliminatedId,
                        // Update Score: Civilians +1
                    });

                    // Increment Civilians Score
                    // We can't do complex logic inside atomic update easily for all, so we do it in next step or here.
                    // Doing separate update for simplicity as transaction limit is strict.
                } else {
                    // Liar Win (Immediate)
                    transaction.update(docRef, {
                        status: 'result',
                        winner: 'liar',
                        roundWinner: 'liar',
                        votedOutId: eliminatedId
                    });
                    // Liar +1
                    // scores[data.liarId] += 1;
                }
            }
        }
    });


}

async function voteForPlayer(targetUid) {
    if (!currentRoomId || !currentUser) return;
    const docRef = db.collection('rooms').doc(currentRoomId);

    const buttons = document.querySelectorAll('#vote-buttons button');
    buttons.forEach(btn => btn.disabled = true);
    document.getElementById('vote-status').innerText = "투표 처리 중...";

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            if (!doc.exists) throw "Room does not exist!";
            const data = doc.data();

            if (data.status !== 'voting') throw "Not voting time!";
            if (data.votes && data.votes[currentUser.uid]) throw "Already voted!";

            const votes = data.votes || {};
            votes[currentUser.uid] = targetUid;
            const players = Object.keys(data.players);
            let updateData = { votes: votes };

            if (Object.keys(votes).length === players.length) {
                const voteCounts = {};
                Object.values(votes).forEach(v => { voteCounts[v] = (voteCounts[v] || 0) + 1; });
                let maxVotes = 0; let candidates = [];
                for (const [uid, count] of Object.entries(voteCounts)) {
                    if (count > maxVotes) { maxVotes = count; candidates = [uid]; }
                    else if (count === maxVotes) candidates.push(uid);
                }

                if (candidates.length > 1) {
                    updateData.status = 'discussion'; updateData.votes = {};
                } else {
                    const eliminatedId = candidates[0];
                    const scores = data.scores || {};
                    if (eliminatedId === data.liarId) {
                        // Liar caught: Civilians +1
                        players.forEach(uid => { if (uid !== data.liarId) scores[uid] = (scores[uid] || 0) + 1; });
                        updateData.status = 'liar_guess'; updateData.votedOutId = eliminatedId; updateData.scores = scores;
                    } else {
                        // Liar win: Liar +1
                        scores[data.liarId] = (scores[data.liarId] || 0) + 1;
                        updateData.status = 'result'; updateData.winner = 'liar'; updateData.roundWinner = 'liar'; updateData.votedOutId = eliminatedId; updateData.scores = scores; updateData.votes = {};
                    }
                }
            }
            transaction.update(docRef, updateData);
        });
    } catch (e) {
        console.error("Vote Error:", e);
        document.querySelectorAll('#vote-buttons button').forEach(btn => btn.disabled = false);
        document.getElementById('vote-status').innerText = "투표 실패: " + e;
    }
}

async function submitLiarGuess() {
    if (!currentRoomId || !currentUser) return;
    const input = document.getElementById('liar-word-input');
    const guess = input.value.trim();
    if (!guess) return;

    const docRef = db.collection('rooms').doc(currentRoomId);
    const snap = await docRef.get();
    const data = snap.data();

    if (data.status !== 'liar_guess') return;

    const correct = data.word.trim();
    const scores = data.scores || {};
    let winner = 'civilian'; // Default if fail

    if (guess === correct) {
        // Liar guessed right -> Liar +1 (Total 2 possible if they won earlier, but here they lost vote)
        // Rule: If Liar caught but guesses, Liar gets 1 pt. Civilians alrdy got 1 pt.
        scores[data.liarId] = (scores[data.liarId] || 0) + 1;
        winner = 'liar'; // Symbolically Liar "won" the guess
    }

    await docRef.update({
        status: 'result',
        winner: winner,
        roundWinner: winner, // Just for display
        scores: scores
    });
}

// UI Event Listeners
document.getElementById('liar-card').addEventListener('click', function () {
    this.classList.toggle('revealed');
    if (this.classList.contains('revealed')) {
        this.querySelector('#liar-card-word').innerText = this.dataset.word;
    } else {
        this.querySelector('#liar-card-word').innerText = '클릭하여 확인';
    }
});

document.getElementById('liar-create-btn').addEventListener('click', createLiarRoom);
document.getElementById('liar-join-btn').addEventListener('click', () => joinLiarRoom());
document.getElementById('liar-start-multi-btn').addEventListener('click', startLiarGame);
const leaveBtn = document.getElementById('liar-leave-btn');
if (leaveBtn) leaveBtn.addEventListener('click', leaveLiarRoom);

const leaveGuestBtn = document.getElementById('liar-leave-guest-btn');
if (leaveGuestBtn) leaveGuestBtn.addEventListener('click', leaveLiarRoom);
document.getElementById('liar-topic-select').addEventListener('change', (e) => {
    if (currentRoomId) db.collection('rooms').doc(currentRoomId).update({ topic: e.target.value });
});
// Host manually moves from card reveal to turn-based speaking
// This button is dynamically added in syncLiarRoom now.
// document.getElementById('liar-next-state-btn').addEventListener('click', () => {
//     db.collection('rooms').doc(currentRoomId).update({ status: 'turn_based' });
// });
document.getElementById('liar-reveal-multi-btn').addEventListener('click', () => {
    // Check status to decide next step
    // If status is discussion, move to 'voting'
    db.collection('rooms').doc(currentRoomId).update({ status: 'voting' });
});
document.getElementById('liar-next-round-btn').addEventListener('click', startLiarGame);
document.getElementById('liar-restart-multi-btn').addEventListener('click', () => {
    // Full Reset
    db.collection('rooms').doc(currentRoomId).update({
        status: 'lobby',
        scores: {}, // Reset Scores
        liarId: null, word: "", revealed: false, descriptions: [], votes: {}
    });
});

// Description Input (자기 차례 설명용)
document.getElementById('description-send-btn').addEventListener('click', sendDescription);
document.getElementById('description-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendDescription();
});

// Chat Input (일반 채팅용)
document.getElementById('liar-chat-send-btn').addEventListener('click', sendLiarMessage);
document.getElementById('liar-chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendLiarMessage();
});
document.getElementById('liar-guess-btn').addEventListener('click', submitLiarGuess);

// Toggle Game Rules
document.getElementById('toggle-rules-btn')?.addEventListener('click', function () {
    const rules = document.getElementById('game-rules');
    if (rules.style.display === 'none') {
        rules.style.display = 'block';
        this.innerHTML = '🔼 규칙 접기';
    } else {
        rules.style.display = 'none';
        this.innerHTML = '📜 게임 규칙 보기';
    }
});

// --- Test Bot Logic ---
document.getElementById('liar-add-bots-btn')?.addEventListener('click', addTestBots);

async function addTestBots() {
    if (!currentRoomId) return;
    const docRef = db.collection('rooms').doc(currentRoomId);

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            if (!doc.exists) return;
            const data = doc.data();
            const players = data.players || {};
            const scores = data.scores || {};

            // Add 10 bots
            for (let i = 1; i <= 10; i++) {
                const botId = `bot_${Date.now()}_${i}`;
                if (Object.keys(players).length >= 30) break;

                players[botId] = {
                    name: `🤖 Bot ${i}`,
                    photo: `https://api.dicebear.com/7.x/bottts/svg?seed=${botId}`, // Random Robot Avatar
                    joinedAt: Date.now() + i,
                    isBot: true
                };
                scores[botId] = 0;
            }
            transaction.update(docRef, { players: players, scores: scores });
        });
    } catch (e) {
        alert("봇 추가 실패: " + e);
    }
}

// Bot Automation Hook (Called in syncLiarRoom by Host)
let botActionTimer = null;
function handleBotAutomation(data) {
    if (!data || !currentUser) return;
    const isHost = data.host === currentUser.uid;
    if (!isHost) return; // Only host runs bot logic to prevent conflicts

    // 1. Description Turn
    if (data.status === 'turn_based') {
        const currentTurnUid = data.turnOrder?.[data.currentTurnIndex];
        const currentPlayer = data.players[currentTurnUid];

        if (currentPlayer && currentPlayer.isBot && !botActionTimer) {
            console.log(`🤖 Bot ${currentTurnUid} turn...`);
            botActionTimer = setTimeout(async () => {
                const descriptions = data.descriptions || [];
                const randomMsg = ["음... 어렵네요.", "맛있는 것 같아요!", "평소에 자주 봅니다.", "저는 잘 모르겠어요.", "확실히 생물은 아니에요."];
                const msg = randomMsg[Math.floor(Math.random() * randomMsg.length)];

                const newDesc = {
                    uid: currentTurnUid,
                    name: currentPlayer.name,
                    text: msg + " (자동응답)"
                };

                let nextIndex = data.currentTurnIndex + 1;
                let nextStatus = 'turn_based';
                if (nextIndex >= data.turnOrder.length) nextStatus = 'discussion';

                await db.collection('rooms').doc(currentRoomId).update({
                    descriptions: [...descriptions, newDesc],
                    currentTurnIndex: nextIndex,
                    status: nextStatus
                });
                botActionTimer = null;
            }, 3000); // 3 seconds delay
        }
    }
    // 2. Voting
    else if (data.status === 'voting') {
        // Find bots who haven't voted
        const votes = data.votes || {};
        const bots = Object.entries(data.players || {}).filter(([uid, p]) => p.isBot);
        const players = Object.keys(data.players);

        const pendingBots = bots.filter(([uid]) => !votes[uid]);

        if (pendingBots.length > 0 && !botActionTimer) {
            botActionTimer = setTimeout(async () => {
                // All remaining bots vote randomly
                const updates = {};
                pendingBots.forEach(([botUid]) => {
                    const target = players[Math.floor(Math.random() * players.length)];
                    votes[botUid] = target;
                });

                // Check completion inside here locally to duplicate logic? 
                // Or just update votes and let the last human trigger completion?
                // But if all are bots?
                // We should just update votes map. The sync logic or vote function checks completion.
                // But wait, our voteForPlayer function uses transaction and triggers state change.
                // We can simply update the 'votes' field map directly. 
                // But we need to trigger state change if vote is done.
                // Simpler: Just update votes. If all voted, Host (current logic) needs a trigger.
                // Let's rely on standard logic: The last vote should trigger state change.
                // We will update votes field. And we need to check if complete.

                const totalVotes = Object.keys(votes).length;
                let updatePayload = { votes: votes };

                // Simple completion check
                if (totalVotes === players.length) {
                    // Start simplified calculation logic (duplicated for bots safety)
                    const voteCounts = {};
                    Object.values(votes).forEach(v => { voteCounts[v] = (voteCounts[v] || 0) + 1; });
                    let maxVotes = 0; let candidates = [];
                    for (const [uid, count] of Object.entries(voteCounts)) {
                        if (count > maxVotes) { maxVotes = count; candidates = [uid]; }
                        else if (count === maxVotes) candidates.push(uid);
                    }
                    if (candidates.length > 1) {
                        updatePayload.status = 'discussion'; updatePayload.votes = {};
                    } else {
                        const eliminatedId = candidates[0];
                        const scores = data.scores || {};
                        if (eliminatedId === data.liarId) {
                            Object.keys(data.players).forEach(uid => { if (uid !== data.liarId) scores[uid] = (scores[uid] || 0) + 1; });
                            updatePayload.status = 'liar_guess'; updatePayload.votedOutId = eliminatedId; updatePayload.scores = scores;
                        } else {
                            scores[data.liarId] = (scores[data.liarId] || 0) + 1;
                            updatePayload.status = 'result'; updatePayload.winner = 'liar'; updatePayload.roundWinner = 'liar'; updatePayload.votedOutId = eliminatedId; updatePayload.scores = scores; updatePayload.votes = {};
                        }
                    }
                }

                await db.collection('rooms').doc(currentRoomId).update(updatePayload);
                botActionTimer = null;
            }, 3000);
        }
    }
    // Reset timer if state changed effectively
    else {
        if (botActionTimer && (data.status !== 'turn_based' && data.status !== 'voting')) {
            clearTimeout(botActionTimer);
            botActionTimer = null;
        }
    }
}

