// ============================================================
// game/ai.js - Q-Learning AI Logic
// ============================================================

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
        if (window.qTable[state][0] === window.qTable[state][1]) {
            action = Math.random() < 0.5 ? 0 : 1;
        } else {
            action = window.qTable[state][0] > window.qTable[state][1] ? 0 : 1;
        }
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
