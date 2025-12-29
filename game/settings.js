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

    updateSFXUI();
}

function updateSFXUI() {
    const sfxStatus = document.getElementById('sfx-status');
    const sfxBtn = document.getElementById('toggle-sfx-btn');

    if (sfxStatus && sfxBtn) {
        if (window.sfxEnabled) {
            sfxStatus.innerText = 'ON';
            sfxStatus.style.color = '#2ecc71';
            sfxBtn.innerText = '끄기';
            sfxBtn.style.background = '#e74c3c';
        } else {
            sfxStatus.innerText = 'OFF';
            sfxStatus.style.color = '#e74c3c';
            sfxBtn.innerText = '켜기';
            sfxBtn.style.background = '#2ecc71';
        }
    }
}

function toggleSFX() {
    window.sfxEnabled = !window.sfxEnabled;
    localStorage.setItem('sfx_enabled', window.sfxEnabled);
    updateSFXUI();
    console.log(`[Settings] SFX Toggled: ${window.sfxEnabled}`);
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

    // SFX toggle button
    const sfxBtn = document.getElementById('toggle-sfx-btn');
    if (sfxBtn) {
        // Use addEventListener for better reliability
        sfxBtn.onclick = null; // Clear any existing
        sfxBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[Settings] SFX Toggle Clicked');
            toggleSFX();
        });
    }

    // Key capture listener
    document.addEventListener('keydown', handleKeyCapture, true);

    // Touchpad Size Slider Logic
    const sizeSlider = document.getElementById('touchpad-size-slider');
    const sizeDisplay = document.getElementById('touchpad-size-display');

    if (sizeSlider && sizeDisplay) {
        // Init with current value
        sizeSlider.value = window.touchpadSize;
        sizeDisplay.innerText = window.touchpadSize + '%';
        applyTouchpadSize(window.touchpadSize);

        // On Change
        sizeSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            sizeDisplay.innerText = val + '%';
            window.touchpadSize = val;
            applyTouchpadSize(val);
        });

        // On Save
        sizeSlider.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            localStorage.setItem('touchpadSize', val);
            console.log(`[Settings] Touchpad Size Saved: ${val}%`);
        });
    }
}


function applyTouchpadSize(sizePercent) {
    const scale = sizePercent / 100;
    const baseSize = 80; // Base size for mobile buttons
    // Actually, let's just scale whatever the CSS default is.
    // CSS for #mobile-controls button is width: 100px / 120px depending on media query.
    // We will inject specific styles to override CSS.

    const jumpBtn = document.getElementById('btn-jump');
    const turnBtn = document.getElementById('btn-turn');

    if (jumpBtn && turnBtn) {
        // We need to adhere to the base size logic.
        // Let's assume a base size of 100px roughly.
        // It's better to use transform: scale() to avoid layout break
        // OR simply set width/height/fontSize inline.

        // Let's use specific Width/Height based on "Base Size 100px" as reference point
        // and let CSS media queries handle position.

        // Actually a better way: adjust transform scale on the buttons? No, that might affect hit area weirdly or position.
        // Best way: Set width/height explicitly.

        // Base size logic:
        // PC/Tablet Base: 120px
        // Mobile Base: 100px
        // Small Mobile Base: 85px

        // We can't easily know which media query is active in JS without checking window.innerWidth.
        // Simple approach: Use a CSS variable or just modify the style directly.

        // Let's use a scale factor relative to a nominal size, or just update CSS var if possible.
        // Since we don't have CSS vars defined for this, let's set inline styles.

        // However, user might be on PC resizing window.
        // Let's rely on a base size of roughly 100px for calculation simplicity.

        // Dynamic Base Size Check
        let base = 100;
        if (window.innerWidth <= 480) base = 85;
        else if (window.innerWidth <= 1024) base = 100;
        else base = 120;

        const newSize = base * scale;
        const newFontSize = (base * 0.22) * scale; // Roughly 22% of size

        [jumpBtn, turnBtn].forEach(btn => {
            btn.style.width = `${newSize}px`;
            btn.style.height = `${newSize}px`;
            btn.style.fontSize = `${newFontSize}px`;
        });
    }
}

// Ensure size is applied on resize too (to handle media query base changes)
window.addEventListener('resize', () => {
    if (window.touchpadSize) applyTouchpadSize(window.touchpadSize);
});
