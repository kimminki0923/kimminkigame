// ============================================================
// game/audio.js - Synthesized Sound Effects (SFX)
// ============================================================

const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

// SFX Toggle state
window.sfxEnabled = localStorage.getItem('sfx_enabled') !== 'false'; // Default to true

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    // Resume context if suspended (browser security)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

/**
 * Play a character-specific jump/step sound
 * @param {string} skinType - 'circle', 'square', 'triangle', 'diamond'
 */
window.playStepSound = function (skinType = 'circle') {
    if (!window.sfxEnabled) return; // Skip if disabled

    console.log(`[SFX] Playing: ${skinType}`);
    if (!audioCtx) initAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (skinType === 'circle') {
        // "Pyok Pyok" - High pitch sine with fast decay
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    }
    else if (skinType === 'square' || skinType === 'triangle') {
        // "Ttuk Ttuk" - Blunt triangle/square wave
        osc.type = skinType === 'square' ? 'square' : 'triangle';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(50, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    }
    else if (skinType === 'diamond') {
        // "Wind/Shuk" - Resonant resonant pass or white noise
        // Let's use a "Shing" sound with a high-pass filter for Diamond
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, now);
        osc.frequency.exponentialRampToValueAtTime(2000, now + 0.2);

        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(800, now);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        gain2.gain.setValueAtTime(0.05, now);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + 0.2);
        osc2.stop(now + 0.2);
    }
};

// Initialize on first user interaction to satisfy browser policy
document.addEventListener('mousedown', initAudio, { once: true });
document.addEventListener('keydown', initAudio, { once: true });
document.addEventListener('touchstart', initAudio, { once: true });
