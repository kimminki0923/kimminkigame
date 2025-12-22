/**
 * Infinite Stairs Game with In-Browser Q-Learning AI
 * 
 * State Representation:
 * [Next Step Direction (Left/Right), Current Facing (Left/Right)]
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const timerBar = document.getElementById('timer-bar');
const statusEl = document.getElementById('status');
const learningStatusEl = document.getElementById('learning-status');
const coinCountEl = document.getElementById('coin-count');
const episodeCountEl = document.getElementById('episode-count');
const highScoreEl = document.getElementById('high-score');

// Buttons
const btnTurn = document.getElementById('btn-turn');
const btnJump = document.getElementById('btn-jump');
const startBtn = document.getElementById('start-btn');
const trainBtn = document.getElementById('train-btn');
const autoPlayBtn = document.getElementById('auto-play-btn');
const resetAiBtn = document.getElementById('reset-ai-btn');

// Game Constants
const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 640;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const STAIR_WIDTH = 80;
const STAIR_HEIGHT = 40;
const CHARACTER_SIZE = 60;
const MAX_TIME = 10; // seconds

// Game State
let stairs = [];
let character = { x: 0, y: 0, facing: 'right', state: 'idle' }; // facing: 'left', 'right'
let score = 0;
let coins = 0;
let timeLeft = MAX_TIME;
let gameLoopId = null;
let lastTime = 0;
let isGameOver = true;
let stairIndex = 0;

// AI State
let qTable = {}; // State -> [Value_Climb, Value_Turn]
let isTraining = false;
let isAutoPlaying = false;
let epsilon = 1.0; // Exploration rate (1.0 = 100% random at start)
const EPSILON_DECAY = 0.995;
const MIN_EPSILON = 0.01;
const ALPHA = 0.1; // Learning rate
const GAMMA = 0.9; // Discount factor
let episode = 0;
let aiHighScore = 0;
let trainingSpeed = 1; // 1 = Normal, 50 = Super Fast

// --- Q-Learning Engine ---

function getAIState() {
    // Look ahead to the next stair relative to current position
    // We need to know: Do I need to go same direction or turn?

    if (stairIndex >= stairs.length - 1) return "Goal";

    const currentStair = stairs[stairIndex];
    const nextStair = stairs[stairIndex + 1];

    // Determine required direction for next step
    let nextStairDirection = 'right';
    if (nextStair.x < currentStair.x) nextStairDirection = 'left';
    else if (nextStair.x > currentStair.x) nextStairDirection = 'right';
    else nextStairDirection = currentStair.type === 'left' ? 'left' : 'right';

    const state = `${nextStairDirection}_${character.facing}`;
    return state;
}

function getBestAction(state) {
    if (!qTable[state]) {
        qTable[state] = [0, 0]; // [Climb, Turn]
    }
    return qTable[state][0] > qTable[state][1] ? 0 : 1; // 0=Climb, 1=Turn
}

function chooseAction(state) {
    if (isTraining && Math.random() < epsilon) {
        return Math.floor(Math.random() * 2); // Explore
    }
    return getBestAction(state); // Exploit
}

function updateQTable(state, action, reward, nextState) {
    if (!qTable[state]) qTable[state] = [0, 0];
    if (!qTable[nextState]) qTable[nextState] = [0, 0];

    const oldValue = qTable[state][action];
    const nextMax = Math.max(...qTable[nextState]);

    // Q Learning Formula
    const newValue = oldValue + ALPHA * (reward + GAMMA * nextMax - oldValue);
    qTable[state][action] = newValue;
}

// --- Game Logic ---

function initGame() {
    stairs = [];
    stairIndex = 0;
    score = 0;
    timeLeft = MAX_TIME;
    isGameOver = false;

    // Initial Stairs (Random walk)
    let currentX = CANVAS_WIDTH / 2 - STAIR_WIDTH / 2;
    let currentY = CANVAS_HEIGHT - 100;

    // Ground
    stairs.push({ x: currentX, y: currentY, type: 'start' });

    for (let i = 0; i < 20; i++) {
        addStair();
    }

    character = {
        x: stairs[0].x + 10,
        y: stairs[0].y - CHARACTER_SIZE + 10,
        facing: 'right',
        state: 'idle'
    };

    // Re-draw immediately
    render();
}

function addStair() {
    const lastStair = stairs[stairs.length - 1];
    let nextX = lastStair.x;
    let nextY = lastStair.y - STAIR_HEIGHT;

    // Random direction
    const direction = Math.random() < 0.5 ? 'left' : 'right';

    if (direction === 'left') {
        nextX -= STAIR_WIDTH / 2;
    } else {
        nextX += STAIR_WIDTH / 2;
    }

    stairs.push({ x: nextX, y: nextY, type: direction });
}

function gameOver() {
    isGameOver = true;
    statusEl.innerText = "Game Over!";
    startBtn.style.display = 'block';

    if (score > aiHighScore) {
        aiHighScore = score;
        highScoreEl.innerText = aiHighScore;
    }

    // AI Training Loop
    if (isTraining) {
        episode++;
        episodeCountEl.innerText = episode;

        // Decay Epsilon
        if (epsilon > MIN_EPSILON) epsilon *= EPSILON_DECAY;

        // Update Status
        learningStatusEl.innerText = `AI 상태: 학습 진행중 (탐험률: ${(epsilon * 100).toFixed(0)}%)`;

        setTimeout(startTrainingEpisode, 50 / trainingSpeed); // Super fast restart
    } else if (isAutoPlaying) {
        statusEl.innerText = "AI 실패. 재시도...";
        setTimeout(() => {
            startGame();
            isAutoPlaying = true;
            statusEl.innerText = "AI 실행중...";
            aiTick();
        }, 1000);
    }
}

function actionClimb() {
    if (isGameOver) return -10;

    const currentState = getAIState();
    const currentStair = stairs[stairIndex];
    const nextStair = stairs[stairIndex + 1];

    let reward = 0;

    // Determine correct direction
    let requiredDirection = 'right';
    if (nextStair.x < currentStair.x) requiredDirection = 'left';
    else if (nextStair.x > currentStair.x) requiredDirection = 'right';
    else requiredDirection = character.facing; // Should not happen based on generation logic

    if (character.facing === requiredDirection) {
        // Correct Move
        stairIndex++;
        score++;
        timeLeft = Math.min(timeLeft + 1, MAX_TIME); // Bonus time
        addStair(); // Infinite generation
        reward = 10; // Positive reward

        // Update visual position
        character.x = nextStair.x + 10;
        character.y = nextStair.y - CHARACTER_SIZE + 10;

    } else {
        // Wrong move (Fell off)
        reward = -100; // Big penalty
        gameOver();
    }

    // Q-Learning Update
    if (isTraining) {
        const nextState = isGameOver ? "Dead" : getAIState();
        updateQTable(currentState, 0, reward, nextState);
    }

    return reward;
}

function actionTurn() {
    if (isGameOver) return -10;

    const currentState = getAIState();

    // Turn changes facing
    character.facing = character.facing === 'left' ? 'right' : 'left';

    // Turn cost (small penalty to prevent infinite spinning)
    let reward = -0.1;

    // Q-Learning Update
    if (isTraining) {
        // Next state is same stair, different facing
        // We need to re-evaluate state because facing changed
        const nextState = getAIState();
        updateQTable(currentState, 1, reward, nextState);
    }

    return reward;
}

// --- Main Loop ---

function gameLoop(timestamp) {
    if (isGameOver && !isTraining) return;

    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (!isGameOver) {
        timeLeft -= dt;
        if (timeLeft <= 0) {
            timeLeft = 0;
            if (isTraining) {
                // Time out penalty
                // Force game over logic handled in next check or explicit
                gameOver();
            } else {
                gameOver();
            }
        }
    }

    render();

    if (!isGameOver) {
        requestAnimationFrame(gameLoop);
    }
}

function render() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Camera follow
    let cameraY = 0;
    if (character.y < CANVAS_HEIGHT / 2) {
        cameraY = CANVAS_HEIGHT / 2 - character.y;
    }

    ctx.save();
    ctx.translate(0, cameraY);

    // Draw Stairs
    stairs.forEach((s, i) => {
        if (i < stairIndex - 5) return; // Optimization
        ctx.fillStyle = i === stairIndex ? '#e74c3c' : '#3498db';
        ctx.fillRect(s.x, s.y, STAIR_WIDTH, STAIR_HEIGHT);
    });

    // Draw Character
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(character.x, character.y, CHARACTER_SIZE / 2, CHARACTER_SIZE);

    // Draw Eyes
    ctx.fillStyle = 'white';
    if (character.facing === 'right') {
        ctx.fillRect(character.x + 20, character.y + 10, 5, 5);
    } else {
        ctx.fillRect(character.x + 5, character.y + 10, 5, 5);
    }

    ctx.restore();

    // UI Update
    scoreEl.innerText = score;
    timerBar.style.width = `${(timeLeft / MAX_TIME) * 100}%`;
    coinCountEl.innerText = coins;
}

// --- Interaction ---

function startGame() {
    initGame();
    lastTime = performance.now();
    startBtn.style.display = 'none';
    statusEl.innerText = "Playing...";
    requestAnimationFrame(gameLoop);
}

// --- AI Runner ---

function aiTick() {
    if (isGameOver) return;

    let delay = isTraining ? (20) : 200; // Super fast training, normal playing

    const state = getAIState();
    const action = chooseAction(state); // 0=Climb, 1=Turn

    if (action === 0) actionClimb();
    else actionTurn();

    render(); // Force render update for visual

    if (!isGameOver) {
        setTimeout(aiTick, delay);
    }
}

function startTrainingEpisode() {
    if (!isTraining) return;
    initGame();
    lastTime = performance.now();
    // Do not run gameLoop for animation frame to save performance? 
    // Or run it to see. Let's run it.
    requestAnimationFrame(gameLoop);
    aiTick();
}

// --- Event Listeners ---

btnTurn.addEventListener('touchstart', (e) => { e.preventDefault(); actionTurn(); });
btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); actionClimb(); });
btnTurn.addEventListener('click', actionTurn);
btnJump.addEventListener('click', actionClimb);

startBtn.addEventListener('click', startGame);

trainBtn.addEventListener('click', () => {
    isTraining = !isTraining;
    isAutoPlaying = false;

    if (isTraining) {
        trainBtn.innerText = "⏹️ 학습 중지";
        trainBtn.style.backgroundColor = "#e74c3c";
        statusEl.innerText = "AI 학습중...";
        autoPlayBtn.disabled = true;
        startTrainingEpisode();
    } else {
        trainBtn.innerText = "🧠 AI 학습하기";
        trainBtn.style.backgroundColor = "#e67e22";
        statusEl.innerText = "학습 중지됨";
        learningStatusEl.innerText = "AI 상태: 학습 완료 (지식 보유중)";
        autoPlayBtn.disabled = false;

        // Stop the loop
        isGameOver = true;
    }
});

autoPlayBtn.addEventListener('click', () => {
    isAutoPlaying = true;
    isTraining = false;
    statusEl.innerText = "AI 실행중...";
    startGame();
    aiTick();
});

resetAiBtn.addEventListener('click', () => {
    if (confirm("정말 AI의 지식을 초기화하시겠습니까?")) {
        qTable = {};
        episode = 0;
        epsilon = 1.0;
        aiHighScore = 0;
        episodeCountEl.innerText = 0;
        highScoreEl.innerText = 0;
        learningStatusEl.innerText = "AI 상태: 리셋됨";
    }
});

// Initial Setup
initGame();
