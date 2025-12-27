// ============================================================
// game/core.js - Main Game Loop and Logic
// ============================================================

// DOM Elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const statusEl = document.getElementById('status');
const timerBar = document.getElementById('timer-bar');
const coinEl = document.getElementById('coin-count');

const menuOverlay = document.getElementById('menu-overlay');
const startBtn = document.getElementById('start-btn');
const trainBtn = document.getElementById('train-btn');
const autoPlayBtn = document.getElementById('auto-play-btn');
const resetAiBtn = document.getElementById('reset-ai-btn');
const stopBtn = document.getElementById('stop-btn');

const learningStatusEl = document.getElementById('learning-status');
const episodeCountEl = document.getElementById('episode-count');
const highScoreEl = document.getElementById('high-score');

const btnTurn = document.getElementById('btn-turn');
const btnJump = document.getElementById('btn-jump');

// Canvas Resize
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);

// Initialize Game Environment (without starting)
function setupEnvironment(isReverse = false) {
    window.gameState.isReverseMode = isReverse;
    window.gameState.score = 0;
    window.gameState.coinCount = 0;
    window.gameState.running = false;
    window.gameState.gameOver = false;
    window.gameState.playerDir = 1;
    window.gameState.stairs = [];
    window.gameState.timer = MAX_TIMER;
    particles.length = 0;
    isFalling = false;

    // Handle Reverse Mode title/status
    if (window.gameState.isReverseMode) {
        statusEl.innerText = "REVERSE MODE";
        statusEl.style.color = "#a29bfe";
    } else {
        statusEl.innerText = "Normal Mode";
        statusEl.style.color = "white";
    }

    window.gameState.stairs.push({ x: 0, y: 0, dir: 1, hasCoin: false, coinVal: 0 });
    window.gameState.renderPlayer = { x: 0, y: 0 };

    for (let i = 0; i < 30; i++) {
        addStair();
    }
    initBackgroundObjects();

    scoreEl.innerText = 0;
    const currentHighScore = window.gameState.isReverseMode ? reverseHighScore : aiHighScore;
    if (highScoreEl) highScoreEl.innerText = currentHighScore;
    if (coinEl) coinEl.innerText = totalCoins;

    updateShopUI();
    updateUnlockStatus();
}

// Actual Game Start
function initGame(forceReverse = null) {
    if (forceReverse !== null) window.gameState.isReverseMode = forceReverse;

    // Reset state but keep mode
    const mode = window.gameState.isReverseMode;
    setupEnvironment(mode);

    window.gameState.running = true;
    menuOverlay.style.display = 'none';

    if (window.isTraining || window.isAutoPlaying) {
        stopBtn.style.display = 'inline-block';
    } else {
        stopBtn.style.display = 'none';
        timerBar.parentElement.style.opacity = 1;
    }

    if (window.isTraining || window.isAutoPlaying) {
        if (window.isAutoPlaying) {
            statusEl.innerText = mode ? "Reverse Robot..." : "Robot Playing...";
        }
        aiTick();
    }
}

function updateUnlockStatus() {
    const reverseBtn = document.getElementById('reverse-start-btn');
    if (reverseBtn) {
        if (aiHighScore >= 1000) {
            reverseBtn.disabled = false;
            reverseBtn.style.opacity = 1;
            // Only set default text if not already toggled or precisely defined
            const isReverse = window.gameState.isReverseMode;
            reverseBtn.innerText = isReverse ? "🔼 일반 모드 변경" : "🔽 리버스 모드 변경";
        } else {
            reverseBtn.disabled = true;
            reverseBtn.style.opacity = 0.5;
            reverseBtn.innerText = "🔽 리버스 모드 (Lv.1000 해금)";
        }
    }
}

function stopGame() {
    window.gameState.running = false;
    window.isTraining = false;
    window.isAutoPlaying = false;
    menuOverlay.style.display = 'block';
    stopBtn.style.display = 'none';

    trainBtn.innerText = "🧠 AI 학습하기";
    trainBtn.style.background = "#e67e22";
    autoPlayBtn.disabled = false;

    statusEl.innerText = "Ready";
    startBtn.style.display = 'inline-block';
}

function addStair() {
    const last = window.gameState.stairs[window.gameState.stairs.length - 1];
    const isReverse = window.gameState.isReverseMode;
    const yInc = isReverse ? -1 : 1;

    if (window.gameState.stairs.length < 6) {
        window.gameState.stairs.push({
            x: last.x + 1, y: last.y + yInc, dir: 1, hasCoin: false, coinVal: 0
        });
        return;
    }

    let nextDir;
    if (Math.random() < 0.7) { nextDir = last.dir; } else { nextDir = last.dir === 1 ? 0 : 1; }

    const currentScore = window.gameState.score + (window.gameState.stairs.length - window.gameState.score);
    let hasCoin = false;
    let coinVal = 0;

    if (isReverse) {
        // --- Reverse Mode: Mineral Economy ---
        if (currentScore < 800) {
            // Earth Crust & Mantle
            const rRare = Math.random();
            if (rRare < 0.005) { // 0.5% chance for Super Diamond
                hasCoin = true;
                coinVal = 500;
            } else if (Math.random() < 0.15 + (currentScore / 4000)) {
                hasCoin = true;
                const r = Math.random();
                // Prices inflated 10x as requested. Deeper = more expensive.
                if (currentScore < 300) {
                    if (r < 0.8) coinVal = 10; else coinVal = 50;
                } else if (currentScore < 600) {
                    if (r < 0.5) coinVal = 10; else if (r < 0.9) coinVal = 50; else coinVal = 100;
                } else {
                    if (r < 0.3) coinVal = 50; else if (r < 0.8) coinVal = 100; else coinVal = 200;
                }
            }
        } else if (currentScore >= 1500) {
            // Emerging to other side / Space gems
            if (Math.random() < 0.1) {
                hasCoin = true;
                coinVal = 200;
            }
        }
    } else {
        // --- Normal Mode: Standard Coins ---
        if (Math.random() < 0.3) {
            hasCoin = true;
            const r = Math.random();
            if (r < 0.6) coinVal = 1; else if (r < 0.9) coinVal = 5; else coinVal = 10;
        }
    }

    window.gameState.stairs.push({
        x: last.x + (nextDir === 1 ? 1 : -1),
        y: last.y + yInc,
        dir: nextDir,
        hasCoin: hasCoin,
        coinVal: coinVal
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

    if (action === 0) {
        myNextDir = window.gameState.playerDir;
    } else {
        myNextDir = (window.gameState.playerDir === 1) ? 0 : 1;
    }

    if (myNextDir === reqDir) {
        window.gameState.score++;
        window.gameState.playerDir = myNextDir;
        scoreEl.innerText = window.gameState.score;
        addStair();
        window.gameState.timer = Math.min(MAX_TIMER, window.gameState.timer + TIMER_BONUS);
        updateSkinRotation();
        if (window.playerFlash !== undefined) window.playerFlash = Math.min(window.playerFlash + 0.3, 1.5);

        // PLAY SOUND (SFX)
        if (window.playStepSound) {
            const skinType = (typeof SKIN_DATA !== 'undefined' && SKIN_DATA[currentSkin]) ? SKIN_DATA[currentSkin].type : 'circle';
            console.log(`[CORE] reqSound: ${skinType}`);
            window.playStepSound(skinType);
        }

        if (next.hasCoin) {
            window.gameState.coinCount += next.coinVal;
            if (!window.isTraining && !window.isAutoPlaying) {
                totalCoins += next.coinVal;
                coinEl.innerText = totalCoins;
                localStorage.setItem('infinite_stairs_coins', totalCoins);
                const shopGold = document.getElementById('shop-gold');
                if (shopGold) shopGold.innerText = totalCoins;
                // Immediate cloud save for coins
                if (window.saveData && isDataLoaded) {
                    window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin);
                }
            } else {
                coinEl.innerText = "(AI)";
            }
            next.hasCoin = false;
            let col = '#ffd700';
            if (next.coinVal === 5) col = '#00d2d3';
            if (next.coinVal === 10) col = '#ff6b6b';
            particles.push({ type: 'text', val: '+' + next.coinVal, x: next.x, y: next.y, life: 1.0, color: col, dy: -3 });
        }
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

function startFalling(wrongDir) {
    isFalling = true;
    window.gameState.running = false;
    fallVelocity = -2; // Reduced from -5 (less jump up)
    fallY = 0;
    const curr = window.gameState.stairs[window.gameState.score];
    fallX = (wrongDir === 1) ? 1 : -1;
    window.gameState.playerDir = wrongDir;
}

function updateFall() {
    if (!isFalling) return;
    fallVelocity += 0.3; // Reduced from 0.8 (slower gravity)
    window.gameState.renderPlayer.y -= (fallVelocity * 0.05);
    window.gameState.renderPlayer.x += (fallX * 0.05);
    if (window.gameState.renderPlayer.y < window.gameState.stairs[window.gameState.score].y - 10) {
        isFalling = false;
        gameOver();
    }
}

function gameOver() {
    window.gameState.running = false;
    window.gameState.gameOver = true;

    if (window.isTraining) {
        const isReverse = window.gameState.isReverseMode;
        const currentScore = window.gameState.score;

        if (isReverse) {
            if (currentScore > reverseHighScore) reverseHighScore = currentScore;
        } else {
            if (currentScore > aiHighScore) aiHighScore = currentScore;
        }

        episode++;
        episodeCountEl.innerText = episode;
        learningStatusEl.innerText = `Learning... Ep: ${episode} | Best: ${isReverse ? reverseHighScore : aiHighScore}`;
        if (epsilon > MIN_EPSILON) epsilon *= EPSILON_DECAY;
        setTimeout(initGame, 20);
        return;
    }

    if (window.isAutoPlaying) {
        statusEl.innerText = "Robot Failed. Retry...";
        setTimeout(initGame, 1000);
        return;
    }

    const isReverse = window.gameState.isReverseMode;
    const currentScore = window.gameState.score;

    if (isReverse) {
        if (currentScore > reverseHighScore) {
            reverseHighScore = currentScore;
            localStorage.setItem('infinite_stairs_reverseHighScore', reverseHighScore);
        }
    } else {
        if (currentScore > aiHighScore) {
            aiHighScore = currentScore;
            localStorage.setItem('infinite_stairs_highScore', aiHighScore);
        }
    }

    if (highScoreEl) {
        highScoreEl.innerText = isReverse ? reverseHighScore : aiHighScore;
    }

    if (window.saveData && isDataLoaded) {
        // Update: saveData also needs to handle reverseHighScore if we want cloud sync
        // For now, let's keep it primarily local for the new mode unless we update auth.js
        window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin);

        // Let's also save reverse score to a separate field if we can, 
        // but for now local storage is safer since saveData signature is fixed.
    }

    statusEl.innerText = "Game Over!";
    menuOverlay.style.display = 'block';
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    updateUnlockStatus(); // Check if newly achieved 1000 unlocks Reverse Mode
}

// Main Game Loop
function loop() {
    if (window.gameState.running) {
        let currentDecay = TIMER_DECAY + (Math.log(window.gameState.score + 10) * 0.08);
        currentDecay = Math.min(currentDecay, 1.2);

        window.gameState.timer -= currentDecay;
        if (window.gameState.timer <= 0) { window.gameState.timer = 0; gameOver(); }
        timerBar.style.width = `${window.gameState.timer}%`;

        let col = '#ffeb3b';
        if (window.gameState.timer < 30) col = '#f44336';
        else if (window.gameState.timer < 60) col = '#ff9800';
        timerBar.style.background = col;
    }

    if (isFalling) updateFall();
    render();
    requestAnimationFrame(loop);
}

// Event Listeners
startBtn.addEventListener('click', () => {
    if (window.resumeAudio) window.resumeAudio();
    window.isTraining = false;
    window.isAutoPlaying = false;
    initGame(); // Uses currently selected mode in window.gameState.isReverseMode
});

trainBtn.addEventListener('click', () => {
    window.isTraining = !window.isTraining;
    window.isAutoPlaying = false;
    if (window.isTraining) {
        trainBtn.innerText = "⏹️ 학습 중지";
        trainBtn.style.background = "#c0392b";
        initGame();
    } else {
        stopGame();
    }
});

autoPlayBtn.addEventListener('click', () => {
    window.isAutoPlaying = true;
    window.isTraining = false;
    initGame();
});

document.getElementById('reverse-start-btn').addEventListener('click', () => {
    const nextMode = !window.gameState.isReverseMode;
    console.log(`[Mode] Switching to ${nextMode ? 'REVERSE' : 'NORMAL'}`);
    setupEnvironment(nextMode);

    // Update button text to show what's selected
    const btn = document.getElementById('reverse-start-btn');
    if (btn) {
        btn.innerText = nextMode ? "🔼 일반 모드로 변경" : "🔽 리버스 모드 변경";
    }
});
resetAiBtn.addEventListener('click', () => {
    if (confirm("AI Reset?")) {
        window.qTable = {}; episode = 0; epsilon = 1.0; aiHighScore = 0;
        episodeCountEl.innerText = 0; highScoreEl.innerText = 0;
    }
});
stopBtn.addEventListener('click', stopGame);

// Cheat Code System
let cheatBuffer = "";
window.addEventListener('keydown', (e) => {
    // Collect keys for cheat code
    if (e.key.length === 1) {
        cheatBuffer += e.key.toLowerCase();
        if (cheatBuffer.length > 20) cheatBuffer = cheatBuffer.slice(-20);

        if (cheatBuffer.endsWith('kimminki')) {
            console.log("🛠️ Debug: Cheat code 'kimminki' activated! Teleporting to 1000...");
            if (window.gameState.running) {
                // Bulk add stairs to prevent crash
                const needed = 1000 - window.gameState.score;
                if (needed > 0) {
                    for (let i = 0; i < needed; i++) addStair();
                    window.gameState.score = 1000;
                    scoreEl.innerText = window.gameState.score;
                    window.gameState.timer = MAX_TIMER;
                }
            }
            cheatBuffer = "";
        }
    }

    // Use custom key bindings from settings
    const jumpKey = window.getKeyBinding ? window.getKeyBinding('jump') : 'KeyJ';
    const turnKey = window.getKeyBinding ? window.getKeyBinding('turn') : 'KeyF';

    if (e.code === jumpKey) handleInput(0);
    if (e.code === turnKey) handleInput(1);
    if (e.code === 'Space' && !window.gameState.running && !window.isTraining) initGame();
});

btnTurn.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(1); });
btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(0); });
btnTurn.addEventListener('mousedown', (e) => { e.preventDefault(); handleInput(1); });
btnJump.addEventListener('mousedown', (e) => { e.preventDefault(); handleInput(0); });

// Data Bridge for Firebase
// Data Bridge for Firebase
window.setGameData = function (score, coins, skins, cSkin, stairSkins, cStairSkin, pets, cPet) {
    console.log(`☁️ Firebase Data Applied: Score ${score}, Coins ${coins}`);
    aiHighScore = parseInt(score || 0);
    if (highScoreEl) highScoreEl.innerText = aiHighScore;
    totalCoins = parseInt(coins || 0);
    if (coinEl) coinEl.innerText = totalCoins;
    if (skins) ownedSkins = skins;
    if (cSkin) currentSkin = cSkin;
    if (stairSkins) ownedStairSkins = stairSkins;
    if (cStairSkin) currentStairSkin = cStairSkin;
    if (pets) ownedPets = pets;
    if (cPet) currentPet = cPet;
    isDataLoaded = true;
    updateShopUI();
    updateUnlockStatus(); // Fix: Ensure Reverse Mode button unlocks on refresh
}

// Initialize
resize();
window.gameState.running = false;
window.gameState.stairs = [];
for (let i = 0; i < 30; i++) window.gameState.stairs.push({ x: 0, y: 0, hasCoin: false, coinVal: 0 });
window.gameState.renderPlayer = { x: 0, y: 0 };
initBackgroundObjects();
render();
loop();

// Bind shop events
bindShopEvents();

// Bind settings events
if (typeof bindSettingsEvents === 'function') bindSettingsEvents();

// Init Auth
if (window.initAuth) window.initAuth();

// Save data when page closes/refreshes
window.addEventListener('beforeunload', () => {
    if (window.saveData && isDataLoaded && !window.isTraining && !window.isAutoPlaying) {
        window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin, ownedPets, currentPet);
    }
});

// Periodic save (every 30 seconds)
setInterval(() => {
    if (window.saveData && isDataLoaded && !window.isTraining && !window.isAutoPlaying) {
        window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin, ownedPets, currentPet);
    }
}, 30000);
