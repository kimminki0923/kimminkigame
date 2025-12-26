// ============================================================
// game/settings.js - Custom Key Bindings & Settings UI
// ============================================================

// Default Key Bindings
const DEFAULT_KEYS = {
    jump: 'KeyJ',  // Climb (straight)
    turn: 'KeyF'   // Turn direction
};

// Load from localStorage or use defaults
let keyBindings = JSON.parse(localStorage.getItem('infinite_stairs_keys') || JSON.stringify(DEFAULT_KEYS));

// Getter for current keys (used by core.js)
window.getKeyBinding = function (action) {
    return keyBindings[action] || DEFAULT_KEYS[action];
};

// Key code to display name
function keyCodeToName(code) {
    if (!code) return '???';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code === 'Space') return '스페이스';
    if (code === 'ArrowUp') return '↑';
    if (code === 'ArrowDown') return '↓';
    if (code === 'ArrowLeft') return '←';
    if (code === 'ArrowRight') return '→';
    if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
    if (code === 'ControlLeft' || code === 'ControlRight') return 'Ctrl';
    return code;
}

// Update settings UI display
function updateSettingsUI() {
    const jumpKeyDisplay = document.getElementById('current-jump-key');
    const turnKeyDisplay = document.getElementById('current-turn-key');
    if (jumpKeyDisplay) jumpKeyDisplay.innerText = keyCodeToName(keyBindings.jump);
    if (turnKeyDisplay) turnKeyDisplay.innerText = keyCodeToName(keyBindings.turn);
}

// Start listening for a new key
let listeningFor = null; // 'jump' or 'turn'

function startKeyListen(action) {
    listeningFor = action;
    const btn = document.getElementById(`rebind-${action}-btn`);
    if (btn) {
        btn.innerText = '키를 누르세요...';
        btn.style.background = '#e74c3c';
    }
}

function handleKeyCapture(e) {
    if (!listeningFor) return;
    e.preventDefault();
    e.stopPropagation();

    // Ignore modifier-only keys
    if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].includes(e.code)) {
        return;
    }

    keyBindings[listeningFor] = e.code;
    localStorage.setItem('infinite_stairs_keys', JSON.stringify(keyBindings));
    console.log(`[Settings] Rebound ${listeningFor} to ${e.code}`);

    const btn = document.getElementById(`rebind-${listeningFor}-btn`);
    if (btn) {
        btn.innerText = '변경하기';
        btn.style.background = '#9b59b6';
    }

    listeningFor = null;
    updateSettingsUI();
}

// Reset to defaults
function resetKeyBindings() {
    keyBindings = { ...DEFAULT_KEYS };
    localStorage.setItem('infinite_stairs_keys', JSON.stringify(keyBindings));
    updateSettingsUI();
    console.log('[Settings] Reset to default keys');
}

// Bind settings panel events
function bindSettingsEvents() {
    // Open Button
    const openBtn = document.getElementById('settings-open-btn');
    if (openBtn) {
        openBtn.onclick = (e) => {
            e.stopPropagation();
            const overlay = document.getElementById('settings-overlay');
            if (overlay) {
                overlay.style.display = 'flex';
                overlay.style.pointerEvents = 'auto';
                updateSettingsUI();
            }
        };
    }

    // Close Buttons
    const closeBtns = ['close-settings-btn', 'close-settings-btn-bottom'];
    closeBtns.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                document.getElementById('settings-overlay').style.display = 'none';
            };
        }
    });

    // Rebind buttons
    const jumpBtn = document.getElementById('rebind-jump-btn');
    if (jumpBtn) jumpBtn.onclick = (e) => {
        e.stopPropagation();
        startKeyListen('jump');
    };

    const turnBtn = document.getElementById('rebind-turn-btn');
    if (turnBtn) turnBtn.onclick = (e) => {
        e.stopPropagation();
        startKeyListen('turn');
    };

    // Reset button
    const resetBtn = document.getElementById('reset-keys-btn');
    if (resetBtn) resetBtn.onclick = (e) => {
        e.stopPropagation();
        resetKeyBindings();
        alert('키 설정이 초기화되었습니다.');
    };

    // Key capture listener
    document.addEventListener('keydown', handleKeyCapture, true);
}
