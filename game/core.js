// ============================================================
// game/core.js - Main Game Loop and Logic
// ============================================================

// DOM Elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';
const scoreEl = document.getElementById('score');
const statusEl = document.getElementById('status');
const timerBar = document.getElementById('timer-bar');
const coinEl = document.getElementById('coin-count');

const menuOverlay = document.getElementById('menu-overlay');

// EXPOSE CANVAS GLOBALLY FOR RENDERER
window.canvas = canvas;
window.ctx = ctx;
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
// Actual Game Start
window.startGame = function (forceReverse = null) {
    if (forceReverse !== null) window.gameState.isReverseMode = forceReverse;

    // Reset state but keep mode
    const mode = window.gameState.isReverseMode;
    // Check if setupEnvironment exists, otherwise just log warning
    if (typeof setupEnvironment === 'function') {
        setupEnvironment(mode);
    } else {
        console.warn("setupEnvironment not found, skipping map setup");
    }

    window.gameState.running = true;

    // Safety check for UI elements
    const menuOverlay = document.getElementById('menu-overlay');
    if (menuOverlay) menuOverlay.style.display = 'none';

    // ============================================================
    // PHARAOH FULL SET CHECK (파라오 풀셋 보너스 알림)
    // ============================================================
    const isPharaohFullSet = (
        (typeof currentSkin !== 'undefined' && currentSkin === 'skin_ruby') &&
        (typeof currentMap !== 'undefined' && currentMap === 'map_desert') &&
        (typeof currentStairSkin !== 'undefined' && currentStairSkin === 'stair_pharaoh')
    );

    if (isPharaohFullSet && !window.isTraining && !window.isAutoPlaying) {
        if (typeof statusEl !== 'undefined' && statusEl) {
            statusEl.innerText = "👑 파라오 풀셋 보너스! 골드 100%!";
            statusEl.style.color = "#f1c40f";
        }
        console.log("[BONUS] Pharaoh Full Set Activated! 100% Gold Spawn + Better Coins!");
    }

    // ============================================================
    // WINTER FULL SET CHECK (겨울왕국 풀셋 보너스 알림)
    // ============================================================
    const isWinterFullSet = (
        (typeof currentSkin !== 'undefined' && currentSkin === 'skin_diamond') &&
        (typeof currentMap !== 'undefined' && currentMap === 'map_winter') &&
        (typeof currentStairSkin !== 'undefined' && currentStairSkin === 'stair_ice')
    );

    if (isWinterFullSet && !window.isTraining && !window.isAutoPlaying) {
        if (typeof statusEl !== 'undefined' && statusEl) {
            statusEl.innerText = "❄️ 겨울왕국 풀셋 보너스! 골드 100%!";
            statusEl.style.color = "#00d2d3";
        }
        console.log("[BONUS] Winter Full Set Activated! 100% Gold Spawn + Better Coins!");
    }

    if (window.isTraining || window.isAutoPlaying) {
        if (typeof stopBtn !== 'undefined' && stopBtn) stopBtn.style.display = 'inline-block';
    } else {
        if (typeof stopBtn !== 'undefined' && stopBtn) stopBtn.style.display = 'none';
        if (typeof timerBar !== 'undefined' && timerBar.parentElement) timerBar.parentElement.style.opacity = 1;
    }

    if (window.isTraining || window.isAutoPlaying) {
        if (window.isAutoPlaying) {
            if (typeof statusEl !== 'undefined' && statusEl) statusEl.innerText = mode ? "Reverse Robot..." : "Robot Playing...";
        }
        if (typeof aiTick === 'function') aiTick();
    }

    // Ensure Game Loop Starts
    if (!window.gameLoopStarted) {
        window.gameLoopStarted = true;
        requestAnimationFrame(gameLoop);
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
        // ============================================================
        // PHARAOH FULL SET BONUS (파라오 풀셋 보너스)
        // 조건: 파라오의 루비(skin_ruby) + 사막맵(map_desert) + 파라오 황금계단(stair_pharaoh)
        // 효과: 100% 골드 스폰!
        // ============================================================
        const isPharaohFullSet = (
            (typeof currentSkin !== 'undefined' && currentSkin === 'skin_ruby') &&
            (typeof currentMap !== 'undefined' && currentMap === 'map_desert') &&
            (typeof currentStairSkin !== 'undefined' && currentStairSkin === 'stair_pharaoh')
        );

        // ============================================================
        // WINTER FULL SET BONUS (겨울왕국 풀셋 보너스)
        // 조건: 다이아몬드(skin_diamond) + 겨울맵(map_winter) + 얼음계단(stair_ice)
        // 효과: 100% 골드 스폰!
        // ============================================================
        const isWinterFullSet = (
            (typeof currentSkin !== 'undefined' && currentSkin === 'skin_diamond') &&
            (typeof currentMap !== 'undefined' && currentMap === 'map_winter') &&
            (typeof currentStairSkin !== 'undefined' && currentStairSkin === 'stair_ice')
        );

        let coinChance = 0.3;
        if (isPharaohFullSet || isWinterFullSet) coinChance = 1.0;

        if (Math.random() < coinChance) {
            hasCoin = true;
            const r = Math.random();
            if (isPharaohFullSet || isWinterFullSet) {
                // 풀셋 보너스: 더 좋은 코인 확률!
                if (r < 0.4) coinVal = 5; else if (r < 0.8) coinVal = 10; else coinVal = 50;
            } else {
                // 일반: 1, 5, 10
                if (r < 0.6) coinVal = 1; else if (r < 0.9) coinVal = 5; else coinVal = 10;
            }
        }

        // ============================================================
        // PHARAOH'S CROWN (파라오의 왕관) - 10% 확률
        // 풀셋일 때만 등장! 15개 수집 시 스핑크스 펫 해금
        // ============================================================
        if (isPharaohFullSet && Math.random() < 0.00005) {
            hasCoin = true;
            coinVal = 1000; // 특별 코드: 왕관 = 1000
        }

        // ============================================================
        // WINTER SNOW CRYSTAL (눈결정) - 10% 확률
        // 겨울 풀셋일 때만 등장! 15개 수집 시 북극곰 펫 해금
        // ============================================================
        if (isWinterFullSet && Math.random() < 0.00005) {
            hasCoin = true;
            coinVal = 2000; // 특별 코드: 눈결정 = 2000
        }
    }

    // hasCrown flag 설정 (coinVal이 1000이면 왕관)
    const hasCrown = (coinVal === 1000);
    // hasSnowCrystal flag 설정 (coinVal이 2000이면 눈결정)
    const hasSnowCrystal = (coinVal === 2000);


    window.gameState.stairs.push({
        x: last.x + (nextDir === 1 ? 1 : -1),
        y: last.y + yInc,
        dir: nextDir,
        hasCoin: hasCoin,
        coinVal: coinVal,
        hasCrown: hasCrown,
        hasSnowCrystal: hasSnowCrystal
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
            // ============================================================
            // PHARAOH'S CROWN COLLECTION (파라오의 왕관 수집)
            // ============================================================
            if (next.hasCrown) {
                // 왕관 수집!
                window.pharaohCrowns++;
                localStorage.setItem('infinite_stairs_crowns', window.pharaohCrowns);
                console.log(`[CROWN] Pharaoh's Crown collected! Total: ${window.pharaohCrowns}/15`);

                // 15개 수집 시 스핑크스 펫 해금!
                if (window.pharaohCrowns >= 15 && !window.ownedPets.includes('pet_sphinx')) {
                    window.ownedPets.push('pet_sphinx');
                    localStorage.setItem('ownedPets', JSON.stringify(window.ownedPets));
                    console.log('[UNLOCK] Sphinx pet unlocked!');

                    // 해금 알림 파티클
                    particles.push({
                        type: 'text',
                        val: '🦁 스핑크스 펫 해금!',
                        x: next.x,
                        y: next.y - 1,
                        life: 2.0,
                        color: '#f1c40f',
                        dy: -2
                    });
                }

                // 왕관 수집 파티클
                particles.push({
                    type: 'text',
                    val: `👑 ${window.pharaohCrowns}/15`,
                    x: next.x,
                    y: next.y,
                    life: 1.5,
                    color: '#f1c40f',
                    dy: -3
                });

                next.hasCoin = false;
                next.hasCrown = false;
                return 10;
            }

            // ============================================================
            // WINTER SNOW CRYSTAL COLLECTION (눈결정 수집)
            // ============================================================
            if (next.hasSnowCrystal) {
                // 눈결정 수집!
                window.snowCrystals++;
                localStorage.setItem('infinite_stairs_snowcrystals', window.snowCrystals);
                console.log(`[SNOW] Snow Crystal collected! Total: ${window.snowCrystals}/15`);

                // 15개 수집 시 북극곰 펫 해금!
                if (window.snowCrystals >= 15 && !window.ownedPets.includes('pet_polarbear')) {
                    window.ownedPets.push('pet_polarbear');
                    localStorage.setItem('ownedPets', JSON.stringify(window.ownedPets));
                    console.log('[UNLOCK] Polar Bear pet unlocked!');

                    // 해금 알림 파티클
                    particles.push({
                        type: 'text',
                        val: '🐻‍❄️ 북극곰 펫 해금!',
                        x: next.x,
                        y: next.y - 1,
                        life: 2.0,
                        color: '#00d2d3',
                        dy: -2
                    });
                }

                // 눈결정 수집 파티클
                particles.push({
                    type: 'text',
                    val: `❄️ ${window.snowCrystals}/15`,
                    x: next.x,
                    y: next.y,
                    life: 1.5,
                    color: '#00d2d3',
                    dy: -3
                });

                next.hasCoin = false;
                next.hasSnowCrystal = false;
                return 10;
            }


            // ============================================================
            // NORMAL COIN COLLECTION (일반 코인 수집)
            // ============================================================
            let actualCoinVal = next.coinVal;
            const isPigActive = (typeof currentPet !== 'undefined' && currentPet === 'pet_pig');
            const isSphinxActive = (typeof currentPet !== 'undefined' && currentPet === 'pet_sphinx');
            const isPolarBearActive = (typeof currentPet !== 'undefined' && currentPet === 'pet_polarbear');

            // PET BONUS: 스핑크스 10배, 북극곰 5배, 황금돼지 2배
            let petMultiplier = 1;
            let bonusEmoji = '';
            if (isSphinxActive) {
                petMultiplier = 10;
                bonusEmoji = '🦁x10 ';
                console.log(`[BONUS] Sphinx x10 coin: ${next.coinVal} -> ${actualCoinVal * petMultiplier}`);
            } else if (isPolarBearActive) {
                petMultiplier = 5;
                bonusEmoji = '🐻‍❄️x5 ';
                console.log(`[BONUS] Polar Bear x5 coin: ${next.coinVal} -> ${actualCoinVal * petMultiplier}`);
            } else if (isPigActive) {
                petMultiplier = 2;
                bonusEmoji = '🐷x2 ';
                console.log(`[BONUS] Golden Pig x2 coin: ${next.coinVal} -> ${actualCoinVal * petMultiplier}`);
            }
            actualCoinVal *= petMultiplier;


            window.gameState.coinCount += actualCoinVal;
            if (!window.isTraining && !window.isAutoPlaying) {
                totalCoins += actualCoinVal;
                coinEl.innerText = totalCoins;
                localStorage.setItem('infinite_stairs_coins', totalCoins);
                const shopGold = document.getElementById('shop-gold');
                if (shopGold) shopGold.innerText = totalCoins;

                // Cloud save removed to save bandwidth - only local save here
            } else {
                coinEl.innerText = "(AI)";
            }
            next.hasCoin = false;

            let col = '#ffd700';
            if (next.coinVal === 5) col = '#00d2d3';
            if (next.coinVal === 10) col = '#ff6b6b';
            if (isSphinxActive) col = '#d4af37'; // 스핑크스: 황금빛
            else if (isPolarBearActive) col = '#81ecec'; // 북극곰: 얼음빛
            else if (isPigActive) col = '#f1c40f'; // 돼지: 밝은 황금


            particles.push({
                type: 'text',
                val: bonusEmoji + '+' + actualCoinVal,


                x: next.x,
                y: next.y,
                life: 1.0,
                color: col,
                dy: -3
            });
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
        setTimeout(startGame, 20);
        return;
    }

    if (window.isAutoPlaying) {
        statusEl.innerText = "Robot Failed. Retry...";
        setTimeout(startGame, 1000);
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
        window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin, ownedPets, currentPet, ownedMaps, currentMap);
    }

    statusEl.innerText = "Game Over!";
    menuOverlay.style.display = 'block';
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    updateUnlockStatus(); // Check if newly achieved 1000 unlocks Reverse Mode
}

// Main Game Loop
function gameLoop(timestamp) {
    if (window.gameState.running) {
        // 난이도 조절: 점수가 높을수록 시간이 더 빨리 줄어듦 (더 가파르게 수정)
        let currentDecay = TIMER_DECAY + (Math.log(window.gameState.score + 10) * 0.15);
        currentDecay = Math.min(currentDecay, 1.8); // 최대 감소량 제한도 증가

        // ============================================================
        // POLAR BEAR PET EFFECT (북극곰 펫 효과)
        // 효과: 강인한 체력으로 타이머 감소 속도 1.5배 완화
        // ============================================================
        if (typeof window.currentPet !== 'undefined' && window.currentPet === 'pet_polarbear') {
            currentDecay /= 1.5;
        }

        window.gameState.timer -= currentDecay;
        if (window.gameState.timer <= 0) { window.gameState.timer = 0; gameOver(); }
        timerBar.style.width = `${window.gameState.timer}%`;

        let col = '#ffeb3b';
        if (window.gameState.timer < 30) col = '#f44336';
        else if (window.gameState.timer < 60) col = '#ff9800';
        timerBar.style.background = col;
    }

    if (isFalling) updateFall();

    // ============================================================
    // ULTRA-SMOOTH SPRING ANIMATION (애니메이션처럼 부드러운 이동)
    // Uses spring physics with velocity for natural, fluid movement
    // ============================================================
    const target = window.gameState.stairs[window.gameState.score] || { x: 0, y: 0 };
    if (window.gameState.stairs.length > 0) {
        // Initialize velocity if not exists
        if (typeof window.playerVelocity === 'undefined') {
            window.playerVelocity = { x: 0, y: 0 };
        }

        // Spring physics constants
        const stiffness = 0.15;  // How quickly it moves toward target
        const damping = 0.75;    // How much velocity is retained (higher = smoother)

        // Calculate spring force
        const dx = target.x - window.gameState.renderPlayer.x;
        const dy = target.y - window.gameState.renderPlayer.y;

        // Apply spring force to velocity
        window.playerVelocity.x += dx * stiffness;
        window.playerVelocity.y += dy * stiffness;

        // Apply damping (friction)
        window.playerVelocity.x *= damping;
        window.playerVelocity.y *= damping;

        // Update position with velocity
        window.gameState.renderPlayer.x += window.playerVelocity.x;
        window.gameState.renderPlayer.y += window.playerVelocity.y;

        // Snap to target if very close (prevents micro-oscillations)
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
            window.gameState.renderPlayer.x = target.x;
            window.gameState.renderPlayer.y = target.y;
            window.playerVelocity.x = 0;
            window.playerVelocity.y = 0;
        }
    }

    drawGameState();
    // Start Loop
    requestAnimationFrame(gameLoop);
}

// Compatibility Alias (for buttons calling initGame)
window.initGame = window.startGame;

// Event Listeners
startBtn.addEventListener('click', () => {
    if (window.resumeAudio) window.resumeAudio();
    window.isTraining = false;
    window.isAutoPlaying = false;
    startGame(); // Uses currently selected mode in window.gameState.isReverseMode
});

trainBtn.addEventListener('click', () => {
    window.isTraining = !window.isTraining;
    window.isAutoPlaying = false;
    if (window.isTraining) {
        if (window.resumeAudio) window.resumeAudio();
        trainBtn.innerText = "⏹️ 학습 중지";
        trainBtn.style.background = "#c0392b";
        initGame();
    } else {
        stopGame();
    }
});

autoPlayBtn.addEventListener('click', () => {
    if (window.resumeAudio) window.resumeAudio();
    window.isAutoPlaying = true;
    window.isTraining = false;
    initGame();
});

document.getElementById('reverse-start-btn').addEventListener('click', () => {
    if (window.resumeAudio) window.resumeAudio();
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

        if (cheatBuffer.endsWith('kimminki') || cheatBuffer.endsWith('kimiminki')) {
            console.log("🛠️ Debug: Cheat code activated! Teleporting to 1000 + 1,000,000G + 15 Crowns + 15 Crystals!");

            // 1. Jump to 1000 steps
            const needed = 1000 - window.gameState.score;
            if (needed > 0) {
                for (let i = 0; i < needed; i++) addStair();
                window.gameState.score = 1000;
                if (scoreEl) scoreEl.innerText = window.gameState.score;
            }

            // 2. Update high score if new score is higher
            if (window.gameState.score > aiHighScore) {
                aiHighScore = window.gameState.score;
                localStorage.setItem('infinite_stairs_highScore', aiHighScore);
                const hsEl = document.getElementById('highscore-display');
                if (hsEl) hsEl.innerText = aiHighScore;
            }

            // 3. Grant 1,000,000 gold and save to localStorage
            totalCoins += 1000000;
            localStorage.setItem('infinite_stairs_coins', totalCoins);
            if (coinEl) coinEl.innerText = totalCoins;
            const shopGold = document.getElementById('shop-gold');
            if (shopGold) shopGold.innerText = totalCoins;

            // 4. Grant 15 Pharaoh Crowns and 15 Snow Crystals
            window.pharaohCrowns = (window.pharaohCrowns || 0) + 15;
            window.snowCrystals = (window.snowCrystals || 0) + 15;
            localStorage.setItem('infinite_stairs_crowns', window.pharaohCrowns);
            localStorage.setItem('infinite_stairs_snowcrystals', window.snowCrystals);

            // 5. UI feedback & Timer reset
            window.gameState.timer = MAX_TIMER;
            if (statusEl) statusEl.innerText = "✨ KIMMINKI POWER! ✨";

            // 6. Cloud Persistence (with crowns and crystals)
            if (window.saveData && isDataLoaded) {
                window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin, ownedPets, currentPet, ownedMaps, currentMap, window.pharaohCrowns, window.snowCrystals);
            }

            alert("🎁 이스터에그 발견!\n✅ 1000계단 점프\n✅ 1,000,000골드 획득\n✅ 파라오 왕관 15개 획득\n✅ 눈결정 15개 획득\n(모든 데이터가 저장되었습니다!)");
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
window.setGameData = function (score, coins, skins, cSkin, stairSkins, cStairSkin, pets, cPet, maps, cMap) {
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
    if (maps) ownedMaps = maps;
    if (cMap) currentMap = cMap;
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
drawGameState();
gameLoop();

// Bind shop events
bindShopEvents();

// Bind settings events
if (typeof bindSettingsEvents === 'function') bindSettingsEvents();

// Init Auth
if (window.initAuth) window.initAuth();

// Save data when page closes/refreshes
window.addEventListener('beforeunload', () => {
    window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin, ownedPets, currentPet, ownedMaps, currentMap);
});

// Periodic save (every 30 seconds)
setInterval(() => {
    window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin, ownedPets, currentPet, ownedMaps, currentMap);
}, 30000);
// --- Data Bridge (Connected to auth.js) ---
window.setGameData = function (score, coins, skins, cSkin, stairSkins, cStair, pets, cPet, maps, cMap, crowns, crystals) {
    console.log(`☁️ Firebase Data Applied: Score ${score}, Coins ${coins}`);
    window.aiHighScore = score;
    if (highScoreEl) highScoreEl.innerText = window.aiHighScore;

    window.totalCoins = coins;
    if (coinEl) coinEl.innerText = window.totalCoins;

    if (skins) window.ownedSkins = skins;
    if (cSkin) window.currentSkin = cSkin;

    // Sync Missing Data Types
    if (stairSkins) window.ownedStairSkins = stairSkins;
    if (cStair) window.currentStairSkin = cStair;

    if (pets) window.ownedPets = pets;
    if (cPet) window.currentPet = cPet;

    if (maps) window.ownedMaps = maps;
    if (cMap) window.currentMap = cMap;

    if (crowns !== undefined) window.pharaohCrowns = crowns;
    if (crystals !== undefined) window.snowCrystals = crystals;

    window.isDataLoaded = true; // Unlock saving
    updateShopUI();
    if (typeof updateUnlockStatus === 'function') updateUnlockStatus();
};
