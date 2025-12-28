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
window.qTable = {}; // Exposed for Save/Load
window.isTraining = false;
window.isAutoPlaying = false;
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
let isDataLoaded = false; // Persistence Guard
window.pharaohCrowns = parseInt(localStorage.getItem('pharaohCrowns') || 0);
window.snowCrystals = parseInt(localStorage.getItem('snowCrystals') || 0);

// Data Setter for Auth
window.setGameData = function (score, coins, skins, skin, stairSkins, sSkin, pets, cPet, maps, cMap, crowns, crystals) {
    aiHighScore = score;
    totalCoins = coins;
    ownedSkins = skins;
    currentSkin = skin;
    window.pharaohCrowns = crowns || 0;
    window.snowCrystals = crystals || 0;

    // Globals for shop
    window.totalCoins = coins;
    window.aiHighScore = score;
    window.ownedSkins = skins;
    window.currentSkin = skin;
    window.ownedStairSkins = stairSkins;
    window.currentStairSkin = sSkin;
    window.ownedPets = pets;
    window.currentPet = cPet;
    window.ownedMaps = maps;
    window.currentMap = cMap;

    if (highScoreEl) highScoreEl.innerText = aiHighScore;
    if (coinEl) coinEl.innerText = totalCoins;

    console.log("??Game Data Loaded:", { score, coins, crowns, crystals });
    isDataLoaded = true;
};

// Game Config
const STAIR_W = 100;
const STAIR_H = 25;
const PLAYER_R = 12;
const MAX_TIMER = 100;
const TIMER_DECAY = 0.3;
const TIMER_BONUS = 15;

window.gameState = {
    running: false,
    score: 0,
    coinCount: 0,
    playerDir: 1, // 1=Right, 0=Left
    stairs: [],
    gameOver: false,
    timer: 100,
    renderPlayer: { x: 0, y: 0 }
};

// --- GRAPHICS ASSETS ---
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

// --- Core Game Functions ---

function initGame() {
    window.gameState.score = 0;
    window.gameState.coinCount = 0;
    window.gameState.running = true;
    window.gameState.gameOver = false;
    window.gameState.playerDir = 1;
    window.gameState.stairs = [];
    window.gameState.timer = MAX_TIMER;
    particles.length = 0;

    menuOverlay.style.display = 'none';
    if (window.isTraining || window.isAutoPlaying) {
        stopBtn.style.display = 'inline-block';
    } else {
        stopBtn.style.display = 'none';
        timerBar.parentElement.style.opacity = 1;
    }

    // Init Object
    window.gameState.stairs.push({ x: 0, y: 0, dir: 1, hasCoin: false, coinVal: 0, hasItem: null });
    window.gameState.renderPlayer = { x: 0, y: 0 };

    for (let i = 0; i < 30; i++) {
        addStair();
    }
    initBackgroundObjects();

    scoreEl.innerText = 0;
    statusEl.innerText = "";

    // AI Trigger
    if (window.isTraining || window.isAutoPlaying) {
        if (window.isAutoPlaying) {
            statusEl.innerText = "Robot Playing...";
        }
        aiTick();
    }
}

window.stopGame = function () {
    window.gameState.running = false;
    window.isTraining = false;
    window.isAutoPlaying = false;
    menuOverlay.style.display = 'block';
    stopBtn.style.display = 'none';

    trainBtn.innerText = "?쭬 AI ?숈뒿?섍린";
    trainBtn.style.background = "#e67e22";
    autoPlayBtn.disabled = false;

    statusEl.innerText = "Ready";
    startBtn.style.display = 'inline-block';
}

function addStair() {
    const last = window.gameState.stairs[window.gameState.stairs.length - 1];

    // START CONSTRAINT
    if (window.gameState.stairs.length < 6) {
        window.gameState.stairs.push({
            x: last.x + 1, y: last.y + 1, dir: 1, hasCoin: false, coinVal: 0, hasItem: null
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

    let hasItem = null;
    // Rare Item Spawn Chance: 0.5% each
    if (!hasCoin) {
        const rItem = Math.random();
        if (rItem < 0.005) { hasItem = 'crown'; }
        else if (rItem < 0.01) { hasItem = 'snowflake'; }
    }

    window.gameState.stairs.push({
        x: last.x + (nextDir === 1 ? 1 : -1),
        y: last.y + 1,
        dir: nextDir,
        hasCoin: hasCoin,
        coinVal: coinVal,
        hasItem: hasItem
    });
}

function performAction(action) {
    if (!window.gameState.running) return -10;

    const idx = window.gameState.score;
    const curr = window.gameState.stairs[idx];
    const next = window.gameState.stairs[idx + 1];

    if (!next) { addStair(); return performAction(action); }

    const reqDir = (next.x > curr.x) ? 1 : 0;
    let myNextDir;

    if (action === 0) { // Jump
        myNextDir = window.gameState.playerDir;
    } else { // Turn
        myNextDir = (window.gameState.playerDir === 1) ? 0 : 1;
    }

    if (myNextDir === reqDir) {
        // Success
        window.gameState.score++;
        window.gameState.playerDir = myNextDir;
        scoreEl.innerText = window.gameState.score;
        addStair();
        window.gameState.timer = Math.min(MAX_TIMER, window.gameState.timer + TIMER_BONUS);

        // Update Skin Rotation
        updateSkinRotation();

        if (next.hasCoin) {
            window.gameState.coinCount += next.coinVal;

            if (!window.isTraining && !window.isAutoPlaying) {
                totalCoins += next.coinVal;
                coinEl.innerText = totalCoins;
                localStorage.setItem('infinite_stairs_coins', totalCoins);
                const shopGold = document.getElementById('shop-gold');
                if (shopGold) shopGold.innerText = totalCoins;
            } else {
                coinEl.innerText = "(AI)";
            }

            next.hasCoin = false;
            let col = '#ffd700'; if (next.coinVal === 5) col = '#00d2d3'; if (next.coinVal === 10) col = '#ff6b6b';
            particles.push({ type: 'text', val: '+' + next.coinVal, x: next.x, y: next.y, life: 1.0, color: col, dy: -3 });
        }

        if (next.hasItem) {
            if (next.hasItem === 'crown') {
                window.pharaohCrowns++;
                particles.push({ type: 'text', val: '?몣 +1', x: next.x, y: next.y - 10, life: 1.5, color: '#f1c40f', dy: -4 });
                window.gameState.coinCount += 50; // Bonus score for rare item
            } else if (next.hasItem === 'snowflake') {
                window.snowCrystals++;
                particles.push({ type: 'text', val: '?꾬툘 +1', x: next.x, y: next.y - 10, life: 1.5, color: '#00d2d3', dy: -4 });
                window.gameState.coinCount += 50;
            }
            next.hasItem = null;

            // Trigger Save
            if (!window.isTraining && !window.isAutoPlaying && window.saveData) {
                window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, window.ownedStairSkins, window.currentStairSkin, window.ownedPets, window.currentPet, window.ownedMaps, window.currentMap, window.pharaohCrowns, window.snowCrystals);
            }
        }
        return 10;
        return 10;
    } else {
        if (window.isTraining) {
            gameOver();
            return -50;
        }
        startFalling(myNextDir);
        return -50;
    }
}

function handleInput(action) {
    if (window.isTraining || window.isAutoPlaying) return;
    performAction(action);
}

// Fall Animation Logic
let isFalling = false;
let fallVelocity = 0;
let fallY = 0;
let fallX = 0;

function startFalling(wrongDir) {
    isFalling = true;
    window.gameState.running = false;
    fallVelocity = -5;
    fallY = 0;
    fallX = (wrongDir === 1) ? 1 : -1;
    window.gameState.playerDir = wrongDir;
}

function updateFall() {
    if (!isFalling) return;
    fallVelocity += 0.8;
    window.gameState.renderPlayer.y -= (fallVelocity * 0.05);
    window.gameState.renderPlayer.x += (fallX * 0.05);

    if (window.gameState.renderPlayer.y < window.gameState.stairs[window.gameState.score].y - 10) {
        isFalling = false;
        gameOver();
    }
}

function getStateKey() {
    const idx = window.gameState.score;
    const curr = window.gameState.stairs[idx];
    const next = window.gameState.stairs[idx + 1];
    if (!curr || !next) return "Straight";

    const reqAbsDir = (next.x > curr.x) ? 1 : 0;
    const myAbsDir = window.gameState.playerDir;
    return (reqAbsDir === myAbsDir) ? "Straight" : "Turn";
}

function aiTick() {
    if (!window.gameState.running) return;

    const state = getStateKey();
    let action;
    if (window.isTraining && Math.random() < epsilon) {
        action = Math.floor(Math.random() * 2);
    } else {
        if (!window.qTable[state]) window.qTable[state] = [0, 0];
        if (window.qTable[state][0] === window.qTable[state][1]) action = Math.random() < 0.5 ? 0 : 1;
        else action = window.qTable[state][0] > window.qTable[state][1] ? 0 : 1;
    }

    const reward = performAction(action);
    const nextState = window.gameState.running ? getStateKey() : "Dead";

    if (window.isTraining) {
        if (!window.qTable[state]) window.qTable[state] = [0, 0];
        if (!window.qTable[nextState]) window.qTable[nextState] = [0, 0];
        let maxNext = Math.max(...window.qTable[nextState]);
        let oldVal = window.qTable[state][action];
        window.qTable[state][action] = oldVal + ALPHA * (reward + GAMMA * maxNext - oldVal);
    }

    let delay = window.isTraining ? 5 : 150;
    if (window.gameState.running) setTimeout(aiTick, delay);
}

// --- GRAPHICS ---
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
    const score = window.gameState.score;
    const w = canvas.width;
    const h = canvas.height;
    const time = Date.now() * 0.001;

    // 1. SKY GRADIENT
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
    const sunY = h * 0.2 + (score * 0.5);
    if (sunY < h + 100 && score < 8000) {
        const sunGrad = ctx.createRadialGradient(w / 2, sunY, 0, w / 2, sunY, 150);
        sunGrad.addColorStop(0, 'rgba(255, 255, 200, 0.4)');
        sunGrad.addColorStop(1, 'rgba(255, 255, 200, 0)');
        ctx.fillStyle = sunGrad;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffde7d';
        ctx.beginPath(); ctx.arc(w / 2, sunY, 60, 0, Math.PI * 2); ctx.fill();
    }

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

    const buildAlpha = Math.max(0, 1 - score / 150);
    if (buildAlpha > 0) {
        ctx.globalAlpha = buildAlpha;
        buildings.forEach(b => {
            // Optimization: Cull buildings outside of view
            const bx = (camX * 0.3 + b.x + 50000) % 3000 - 1000;
            if (bx > w + 100 || bx + b.width < -100) return;

            const by = h - b.height + (score * 3);
            ctx.fillStyle = b.color;
            ctx.fillRect(bx, by, b.width, b.height);
            if (b.windows) {
                ctx.fillStyle = 'rgba(255,255,200,0.3)';
                for (let wy = by + 10; wy < by + b.height; wy += 20) {
                    for (let wx = bx + 5; wx < bx + b.width - 5; wx += 15) {
                        ctx.fillRect(wx, wy, 8, 12);
                    }
                }
            }
        });
        ctx.globalAlpha = 1;
    }

    const cloudAlpha = score < 600 ? 1 : Math.max(0, 1 - (score - 600) / 200);
    if (cloudAlpha > 0) {
        ctx.globalAlpha = cloudAlpha * 0.7;
        clouds.forEach(c => {
            // Optimization: Cull clouds
            const cx = (camX * 0.1 + c.x + time * c.speed * 50 + 50000) % 4000 - 1000;
            const cy = h * 0.5 + c.y + (score * 2) - 300;
            if (cx > w + 100 || cx + c.size * 2 < -100) return;

            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(cx, cy, c.size, 0, Math.PI * 2);
            ctx.arc(cx + c.size * 0.7, cy - c.size * 0.5, c.size * 0.8, 0, Math.PI * 2);
            ctx.arc(cx - c.size * 0.7, cy - c.size * 0.3, c.size * 0.6, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    const planetAlpha = score < 9500 ? Math.max(0, Math.min(1, (score - 800) / 200)) : Math.max(0, 1 - (score - 9500) / 500);
    if (planetAlpha > 0) {
        ctx.globalAlpha = planetAlpha;
        planets.forEach((p) => {
            // Optimization: Cull planets
            const px = (camX * 0.02 + p.x) % 5000 - 1000;
            if (px > w + 200 || px < -200) return;

            const py = p.y - (score * 1.0) + 1000;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2); ctx.fill();
            if (p.texture) {
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                ctx.beginPath(); ctx.arc(px, py, p.size * 0.8, 0, Math.PI, false); ctx.fill();
            }
            if (p.ring) {
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth = 4;
                ctx.beginPath(); ctx.ellipse(px, py, p.size * 2.2, p.size * 0.5, -0.3, 0, Math.PI * 2); ctx.stroke();
            }
        });
        ctx.globalAlpha = 1;
    }
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const target = window.gameState.stairs[window.gameState.score] || { x: 0, y: 0 };
    if (window.gameState.stairs.length > 0) {
        window.gameState.renderPlayer.x += (target.x - window.gameState.renderPlayer.x) * 0.2;
        window.gameState.renderPlayer.y += (target.y - window.gameState.renderPlayer.y) * 0.2;
    }
    const camX = -window.gameState.renderPlayer.x * STAIR_W + canvas.width / 2;
    const camY = window.gameState.renderPlayer.y * STAIR_H + canvas.height / 2 + 100;

    drawBackground(camX, camY);

    window.gameState.stairs.forEach((s, i) => {
        if (i < window.gameState.score - 5 || i > window.gameState.score + 18) return;
        const sx = camX + s.x * STAIR_W;
        const sy = camY - s.y * STAIR_H;

        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(sx - STAIR_W / 2 + 8, sy + 8, STAIR_W, STAIR_H);

        const grad = ctx.createLinearGradient(sx, sy, sx, sy + STAIR_H);
        if (i === window.gameState.score) {
            grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#dfe6e9');
        } else {
            grad.addColorStop(0, '#a29bfe'); grad.addColorStop(1, '#6c5ce7');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(sx - STAIR_W / 2, sy, STAIR_W, STAIR_H);

        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(sx - STAIR_W / 2, sy, STAIR_W, 4);

        if (s.hasCoin) {
            let col = '#f1c40f';
            if (s.coinVal === 5) col = '#00d2d3'; if (s.coinVal === 10) col = '#ff6b6b';
            ctx.fillStyle = col;
            ctx.beginPath(); ctx.arc(sx, sy - 30, 10, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        }

        if (s.hasItem) {
            ctx.font = "28px Script";
            ctx.textAlign = "center";
            ctx.shadowBlur = 10; ctx.shadowColor = 'white';
            if (s.hasItem === 'crown') {
                ctx.fillText("?몣", sx, sy - 25);
            } else if (s.hasItem === 'snowflake') {
                ctx.fillText("?꾬툘", sx, sy - 25);
            }
            ctx.shadowBlur = 0;
        }
    });

    const px = camX + window.gameState.renderPlayer.x * STAIR_W;
    const py = camY - window.gameState.renderPlayer.y * STAIR_H;
    drawPlayerWithSkin(ctx, px, py, window.gameState.playerDir);

    ctx.fillStyle = '#ffeaa7';
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.shadowBlur = 4; ctx.shadowColor = 'black';
    const bounce = Math.sin(Date.now() / 150) * 4;
    ctx.fillText(window.gameState.playerDir === 1 ? "?? : "??, px, py - 45 + bounce);
    ctx.shadowBlur = 0;

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

function loop() {
    // Only run loop if page is active
    if (!document.getElementById('page-stairs').classList.contains('active')) {
        requestAnimationFrame(loop);
        return;
    }

    if (window.gameState.running) {
        let currentDecay = TIMER_DECAY + (Math.log(window.gameState.score + 10) * 0.08);
        currentDecay = Math.min(currentDecay, 1.2);
        window.gameState.timer -= currentDecay;
        if (window.gameState.timer <= 0) { window.gameState.timer = 0; gameOver(); }
        timerBar.style.width = `${window.gameState.timer}%`;
        let col = '#ffeb3b';
        if (window.gameState.timer < 30) col = '#f44336'; else if (window.gameState.timer < 60) col = '#ff9800';
        else col = 'linear-gradient(90deg, #ffeb3b, #ff9800, #f44336)';
        timerBar.style.background = col;
    }
    if (isFalling) updateFall();
    render();
    requestAnimationFrame(loop);
}

// Event Listeners
startBtn.addEventListener('click', () => { window.isTraining = false; window.isAutoPlaying = false; initGame(); });
trainBtn.addEventListener('click', () => {
    window.isTraining = !window.isTraining;
    window.isAutoPlaying = false;
    if (window.isTraining) {
        trainBtn.innerText = "?뱄툘 ?숈뒿 以묒?";
        trainBtn.style.background = "#c0392b";
        initGame();
    } else {
        stopGame();
    }
});
autoPlayBtn.addEventListener('click', () => { window.isAutoPlaying = true; window.isTraining = false; initGame(); });
resetAiBtn.addEventListener('click', () => {
    if (confirm("AI Reset?")) {
        window.qTable = {}; episode = 0; epsilon = 1.0; aiHighScore = 0;
        episodeCountEl.innerText = 0; highScoreEl.innerText = 0;
    }
});
stopBtn.addEventListener('click', stopGame);

const SKIN_DATA = {
    default: { name: '湲곕낯 (?먰삎)', icon: '??, type: 'circle' },
    skin_square: { name: '?ш컖??, icon: '?윧', type: 'square', price: 1000 },
    skin_triangle: { name: '?쇨컖??, icon: '?뵼', type: 'triangle', price: 5000 },
    skin_diamond: { name: '?ㅼ씠?꾨が??, icon: '?뭿', type: 'diamond', price: 10000 },
    skin_ruby: { name: '?뚮씪?ㅼ쓽 猷⑤퉬', icon: '?뵶', type: 'ruby', price: 20000 },
    skin_pentagon: { name: '?ㅺ컖??(怨좎닔??', icon: '燧?, type: 'pentagon', price: 0, requirement: 1000 },
    skin_cosmic: { name: '肄붿뒪誘??ㅽ?', icon: '?뙚', type: 'cosmic', price: 1000000 }
};

// Explicit Shop Logic (Separated for reliability)
function bindShopEvents() {
    // Open Button
    const openBtn = document.getElementById('shop-open-btn');
    if (openBtn) {
        openBtn.onclick = () => {
            const overlay = document.getElementById('shop-overlay');
            if (overlay) {
                overlay.style.display = 'flex';
                updateShopUI();
                // Re-bind buy/equip buttons every time shop opens
                bindBuyEquipButtons();
            }
        };
    }

    // Close Button (ID based - top)
    const closeBtn = document.getElementById('close-shop-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            const overlay = document.getElementById('shop-overlay');
            if (overlay) overlay.style.display = 'none';
        };
    }

    // Close Button (ID based - bottom)
    const closeBtnBottom = document.getElementById('close-shop-btn-bottom');
    if (closeBtnBottom) {
        closeBtnBottom.onclick = () => {
            const overlay = document.getElementById('shop-overlay');
            if (overlay) overlay.style.display = 'none';
        };
    }
}

// Separate function to bind buy/equip buttons (called when shop opens)
function bindBuyEquipButtons() {
    // Buy Buttons
    document.querySelectorAll('.buy-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.stopPropagation();
            const skinId = this.dataset.id;
            const price = parseInt(this.dataset.price);
            console.log('[Shop] Buy clicked:', skinId, price);

            if (ownedSkins.includes(skinId)) {
                equipSkin(skinId);
                return;
            }

            if (totalCoins >= price) {
                totalCoins -= price;
                ownedSkins.push(skinId);
                if (coinEl) coinEl.innerText = totalCoins;
                updateShopUI();
                if (window.saveData) {
                    window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin);
                }
                alert(`??${SKIN_DATA[skinId]?.name || skinId} 援щℓ ?꾨즺!`);
                equipSkin(skinId);
                bindBuyEquipButtons(); // Re-bind after class changes
            } else {
                alert(`??怨⑤뱶媛 遺議깊빀?덈떎! (蹂댁쑀: ${totalCoins}G / ?꾩슂: ${price}G)`);
            }
        };
    });

    // Equip Buttons
    document.querySelectorAll('.equip-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.stopPropagation();
            const skinId = this.dataset.skin || this.dataset.id;
            console.log('[Shop] Equip clicked:', skinId);
            equipSkin(skinId);
        };
    });
}

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
            btn.innerText = currentSkin === skinId ? '???μ갑以? : '?μ갑?섍린';
            btn.style.background = currentSkin === skinId ? '#7f8c8d' : '#2ecc71';
            btn.disabled = currentSkin === skinId;
            btn.classList.add('equip-btn');
            btn.classList.remove('buy-btn');
        }
    });

    document.querySelectorAll('.equip-btn').forEach(btn => {
        const skinId = btn.dataset.skin || btn.dataset.id;
        if (skinId === currentSkin) {
            btn.innerText = '???μ갑以?;
            btn.style.background = '#7f8c8d';
            btn.disabled = true;
        } else if (ownedSkins.includes(skinId)) {
            btn.innerText = '?μ갑?섍린';
            btn.style.background = '#2ecc71';
            btn.disabled = false;
        }
    });
}

// Call initially
bindShopEvents();

// Global Click Handler regarding Shop (Dynamic elements like Buy/Equip)
document.addEventListener('click', (e) => {
    console.log('[Shop Click] Target:', e.target.id, e.target.className, e.target.tagName);

    // Overlay outside click close
    if (e.target.id === 'shop-overlay') {
        e.target.style.display = 'none';
        return;
    }

    // Any close button (top or bottom)
    if (e.target.id === 'close-shop-btn' || e.target.id === 'close-shop-btn-bottom' || e.target.closest('.close-btn-x')) {
        const overlay = document.getElementById('shop-overlay');
        if (overlay) overlay.style.display = 'none';
        return;
    }

    // Buy Button
    const buyBtn = e.target.closest('.buy-btn');
    if (buyBtn) {
        console.log('[Shop] Buy button clicked:', buyBtn.dataset.id, buyBtn.dataset.price);
        const skinId = buyBtn.dataset.id;
        const price = parseInt(buyBtn.dataset.price);

        if (ownedSkins.includes(skinId)) {
            equipSkin(skinId);
            return;
        }

        if (totalCoins >= price) {
            totalCoins -= price;
            ownedSkins.push(skinId);

            // Update UI
            if (coinEl) coinEl.innerText = totalCoins;
            updateShopUI();

            // SAVE
            if (window.saveData) {
                window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin);
            }

            alert(`??${SKIN_DATA[skinId]?.name || skinId} 援щℓ ?꾨즺!`);
            equipSkin(skinId);
        } else {
            alert(`??怨⑤뱶媛 遺議깊빀?덈떎! (蹂댁쑀: ${totalCoins}G / ?꾩슂: ${price}G)`);
        }
        return;
    }

    // Equip Button
    const equipBtn = e.target.closest('.equip-btn');
    if (equipBtn) {
        console.log('[Shop] Equip button clicked:', equipBtn.dataset.skin || equipBtn.dataset.id);
        const skinId = equipBtn.dataset.skin || equipBtn.dataset.id;
        equipSkin(skinId);
        return;
    }
});


function equipSkin(skinId) {
    currentSkin = skinId;
    localStorage.setItem('currentSkin', skinId);
    updateShopUI();
    console.log(`Equipped skin: ${skinId}`);
    if (window.saveData) { window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin); }
}

function updateSkinRotation() {
    const skin = SKIN_DATA[currentSkin] || SKIN_DATA.default;
    if (skin.type !== 'circle') { skinRotation += Math.PI / 4; } else { skinRotation = 0; }
}

function drawPlayerWithSkin(ctx, px, py, dir) {
    const skin = SKIN_DATA[currentSkin] || SKIN_DATA.default;
    ctx.save();
    ctx.translate(px, py - 20);
    if (skin.type !== 'circle') { ctx.rotate(skinRotation); }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 25, PLAYER_R, PLAYER_R * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    switch (skin.type) {
        case 'square':
            const size = PLAYER_R * 1.5;
            ctx.fillStyle = '#e67e22';
            ctx.fillRect(-size / 2, -size / 2, size, size);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(-size / 2, -size / 2, size, size);
            break;
        case 'triangle':
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
            break;
        default:
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
            ctx.fillStyle = '#000';
            const lookDir = dir === 1 ? 1 : -1;
            ctx.beginPath();
            ctx.arc(lookDir * 4, -2, 3, 0, Math.PI * 2);
            ctx.fill();
    }
    ctx.restore();
}

function gameOver() {
    window.gameState.running = false;
    window.gameState.gameOver = true;
    if (window.isTraining) {
        if (window.gameState.score > aiHighScore) aiHighScore = window.gameState.score;
        episode++;
        episodeCountEl.innerText = episode;
        learningStatusEl.innerText = `Learning... Ep: ${episode} | Best: ${aiHighScore}`;
        if (epsilon > MIN_EPSILON) epsilon *= EPSILON_DECAY;
        setTimeout(initGame, 20);
        return;
    }
    if (window.isAutoPlaying) {
        statusEl.innerText = "Robot Failed. Retry...";
        setTimeout(initGame, 1000);
        return;
    }
    if (window.gameState.score > aiHighScore) {
        aiHighScore = window.gameState.score;
        highScoreEl.innerText = aiHighScore;
    }
    if (window.saveData && isDataLoaded) {
        window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin);
    }
    statusEl.innerText = "Game Over!";
    menuOverlay.style.display = 'block';
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    document.getElementById('high-score').innerText = aiHighScore;
}

// --- Easter Egg ---
let inputBuffer = "";
const EASTER_EGG_KEY = "kimminki";

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyJ') handleInput(0);
    if (e.code === 'KeyF') handleInput(1);
    if (e.code === 'Space' && !window.gameState.running && !window.isTraining) initGame();

    // Easter egg check
    if (e.key.length === 1) {
        inputBuffer += e.key.toLowerCase();
        if (inputBuffer.length > 20) inputBuffer = inputBuffer.substring(1);

        if (inputBuffer.includes(EASTER_EGG_KEY)) {
            inputBuffer = "";
            applyEasterEgg();
        }
    }
});

function applyEasterEgg() {
    if (!window.gameState.running) initGame();

    // 1. Jump to 1000 steps
    while (window.gameState.stairs.length <= 1005) {
        addStair();
    }
    window.gameState.score = 1000;
    window.gameState.renderPlayer.x = window.gameState.stairs[1000].x;
    window.gameState.renderPlayer.y = window.gameState.stairs[1000].y;
    scoreEl.innerText = window.gameState.score;

    // 2. Add 10000 gold
    totalCoins += 10000;
    coinEl.innerText = totalCoins;
    const shopGold = document.getElementById('shop-gold');
    if (shopGold) shopGold.innerText = totalCoins;

    if (window.saveData) {
        window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin, ownedPets, currentPet);
    }

    statusEl.innerText = "??KIMMINKI POWER! ??;
    particles.push({ type: 'text', val: 'SECRET UNLOCKED!', x: window.gameState.stairs[1000].x, y: window.gameState.stairs[1000].y, life: 2.0, color: '#f1c40f', dy: -5 });

    alert("?럞 ?댁뒪?곗뿉洹?諛쒓껄! 1000怨꾨떒 ?먰봽 + 10,000怨⑤뱶 ?띾뱷!");
}

btnTurn.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(1); });
btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(0); });
btnTurn.addEventListener('mousedown', (e) => { e.preventDefault(); handleInput(1); });
btnJump.addEventListener('mousedown', (e) => { e.preventDefault(); handleInput(0); });

// Update persistent state when Firebase loads
window.setGameData = function (score, coins, skins, cSkin) {
    console.log(`?곻툘 Firebase Data Applied: Score ${score}, Coins ${coins}`);
    aiHighScore = score;
    if (highScoreEl) highScoreEl.innerText = aiHighScore;
    totalCoins = coins;
    if (coinEl) coinEl.innerText = totalCoins;
    if (skins) ownedSkins = skins;
    if (cSkin) currentSkin = cSkin;
    isDataLoaded = true;
    updateShopUI();
}

// Start
resize();
window.gameState.running = false;
window.gameState.stairs = [];
for (let i = 0; i < 30; i++) window.gameState.stairs.push({ x: 0, y: 0, hasCoin: false, coinVal: 0 });
window.gameState.renderPlayer = { x: 0, y: 0 };
initBackgroundObjects();
render();
loop();

if (window.initAuth) window.initAuth();
