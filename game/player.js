// ============================================================
// game/player.js - Player Drawing, Skins, and Animations
// Geometry Dash style - grounded on stairs, rolling animation
// ============================================================

const SKIN_DATA = {
    default: { name: '기본 (원형)', icon: '⚪', type: 'circle' },
    skin_square: { name: '사각형', icon: '🟧', type: 'square', price: 1000 },
    skin_triangle: { name: '삼각형', icon: '🔺', type: 'triangle', price: 5000 },
    skin_diamond: { name: '다이아몬드', icon: '💎', type: 'diamond', price: 10000 },
    skin_pentagon: { name: '오각형 (고수용)', icon: '⬠', type: 'pentagon', price: 0, requirement: 1000 }
};

// Animation state for smooth rolling
let targetSkinRotation = 0;
let currentSkinRotation = 0;

function updateSkinRotation() {
    const skin = SKIN_DATA[currentSkin] || SKIN_DATA.default;
    if (skin.type === 'circle') {
        targetSkinRotation = 0;
    } else if (skin.type === 'square') {
        // 90 degree rotation per step (like Geometry Dash cube)
        targetSkinRotation += Math.PI / 2;
    } else if (skin.type === 'triangle') {
        // 120 degree rotation for triangle (3 sides)
        targetSkinRotation += Math.PI * 2 / 3;
    } else if (skin.type === 'diamond') {
        // Diamond floats, no rolling rotation
        targetSkinRotation = 0;
    } else if (skin.type === 'pentagon') {
        // Pentagonal rotation (72 degrees)
        targetSkinRotation += Math.PI * 2 / 5;
    }
}

function equipSkin(skinId) {
    currentSkin = skinId;
    localStorage.setItem('currentSkin', skinId);
    // Reset rotation when changing skins
    targetSkinRotation = 0;
    currentSkinRotation = 0;
    updateShopUI();
    console.log(`Equipped skin: ${skinId}`);
    if (window.saveData) {
        window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin);
    }
}

// Flash/Glow Intensity for "Speed = Brightness" effect
window.playerFlash = 0;

function drawPlayerWithSkin(ctx, px, py, dir) {
    const skin = SKIN_DATA[currentSkin] || SKIN_DATA.default;
    const time = Date.now() * 0.001;

    // Smooth rotation interpolation (Geometry Dash style)
    const rotationSpeed = 0.25;
    currentSkinRotation += (targetSkinRotation - currentSkinRotation) * rotationSpeed;

    // Decay flash
    window.playerFlash *= 0.9;
    if (window.playerFlash < 0.01) window.playerFlash = 0;

    const flash = window.playerFlash;

    ctx.save();

    // Position ON the stair (not floating) - move down to touch stair
    const groundOffset = skin.type === 'circle' ? 5 : 0;

    // Special Floating Logic for Diamond
    let floatY = 0;
    if (skin.type === 'diamond') {
        floatY = Math.sin(time * 3) * 5; // Bobbing up and down
    }

    ctx.translate(px, py - groundOffset + floatY);

    // Apply rotation for non-circle skins (except Diamond which floats upright)
    if (skin.type !== 'circle' && skin.type !== 'diamond') {
        ctx.rotate(currentSkinRotation);
    }

    switch (skin.type) {
        case 'square':
            // BIG Geometry Dash style cube - grounded
            const size = 32; // Bigger size

            // Shadow on ground
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(-size / 2 + 4, size / 2, size, 6);

            // Main cube gradient
            const cubeGrad = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
            cubeGrad.addColorStop(0, '#f39c12');
            cubeGrad.addColorStop(0.5, '#e67e22');
            cubeGrad.addColorStop(1, '#d35400');

            // Glow + Flash
            ctx.shadowColor = '#f39c12';
            ctx.shadowBlur = 20 + (flash * 30);

            ctx.fillStyle = cubeGrad;
            ctx.fillRect(-size / 2, -size / 2, size, size);

            ctx.shadowBlur = 0;

            // 3D effect - top highlight
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillRect(-size / 2, -size / 2, size, 8);

            // Corner highlight
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillRect(-size / 2 + 3, -size / 2 + 3, 10, 10);

            // Thick outline
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 4;
            ctx.strokeRect(-size / 2, -size / 2, size, size);

            // Face
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(-5, -2, 4, 0, Math.PI * 2);
            ctx.arc(5, -2, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#2d3436';
            ctx.beginPath();
            ctx.arc(-5, -2, 2, 0, Math.PI * 2);
            ctx.arc(5, -2, 2, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'triangle':
            // BIG Pyramid - grounded, spinning
            const triSize = 36;

            // Ground shadow
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath();
            ctx.ellipse(0, triSize / 2 + 3, triSize * 0.8, 6, 0, 0, Math.PI * 2);
            ctx.fill();

            const triGrad = ctx.createLinearGradient(0, -triSize, 0, triSize / 2);
            triGrad.addColorStop(0, '#ff6b6b');
            triGrad.addColorStop(0.5, '#ee5253');
            triGrad.addColorStop(1, '#b33939');

            // Glow + Flash
            ctx.shadowColor = '#ff6b6b';
            ctx.shadowBlur = 20 + (flash * 30);

            ctx.fillStyle = triGrad;
            ctx.beginPath();
            ctx.moveTo(0, -triSize);
            ctx.lineTo(-triSize * 0.9, triSize / 2);
            ctx.lineTo(triSize * 0.9, triSize / 2);
            ctx.closePath();
            ctx.fill();

            ctx.shadowBlur = 0;

            // Edge highlight
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 4;
            ctx.stroke();

            // Inner shine
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.beginPath();
            ctx.moveTo(0, -triSize * 0.6);
            ctx.lineTo(-triSize * 0.35, triSize * 0.2);
            ctx.lineTo(triSize * 0.35, triSize * 0.2);
            ctx.closePath();
            ctx.fill();

            // Eye
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(0, -5, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#2d3436';
            ctx.beginPath();
            ctx.arc(0, -5, 3, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'pentagon':
            // Pentagon - grounded, rolling
            const pentSize = 34;

            // Ground shadow
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath();
            ctx.ellipse(0, pentSize / 2 + 5, pentSize * 0.9, 8, 0, 0, Math.PI * 2);
            ctx.fill();

            const pentGrad = ctx.createLinearGradient(0, -pentSize, 0, pentSize);
            pentGrad.addColorStop(0, '#2ecc71');
            pentGrad.addColorStop(0.5, '#27ae60');
            pentGrad.addColorStop(1, '#16a085');

            // Glow + Flash
            ctx.shadowColor = '#2ecc71';
            ctx.shadowBlur = 20 + (flash * 30);

            ctx.fillStyle = pentGrad;
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i * Math.PI * 2 / 5) - Math.PI / 2;
                const px_v = Math.cos(angle) * (pentSize * 0.9);
                const py_v = Math.sin(angle) * (pentSize * 0.9);
                if (i === 0) ctx.moveTo(px_v, py_v);
                else ctx.lineTo(px_v, py_v);
            }
            ctx.closePath();
            ctx.fill();

            ctx.shadowBlur = 0;

            // Edge highlight
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Eyes
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(-6, -6, 5, 0, Math.PI * 2);
            ctx.arc(6, -6, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#2d3436';
            ctx.beginPath();
            ctx.arc(-6, -6, 2, 0, Math.PI * 2);
            ctx.arc(6, -6, 2, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'diamond':
            // BIG sparkling diamond - Floating with Pulse & Flash
            const diaSize = 38;
            const pulse = 1 + Math.sin(time * 5) * 0.05 + (flash * 0.1); // Flash adds size pulse

            ctx.scale(pulse, pulse);

            // Floating Ground shadow
            ctx.save();
            ctx.translate(0, -floatY);
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            const shadowScale = 1 - (floatY + 5) * 0.05;
            ctx.beginPath();
            ctx.ellipse(0, diaSize * 0.6 + 10, diaSize * 0.6 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            const diaGrad = ctx.createLinearGradient(0, -diaSize, 0, diaSize * 0.5);
            diaGrad.addColorStop(0, '#74b9ff');
            diaGrad.addColorStop(0.3, '#0984e3');
            diaGrad.addColorStop(0.7, '#6c5ce7');
            diaGrad.addColorStop(1, '#a29bfe');

            // Magic Glow + Speed Flash
            ctx.shadowColor = '#00d2d3';
            ctx.shadowBlur = 30 + Math.sin(time * 8) * 10 + (flash * 50); // Huge glow on flash

            ctx.fillStyle = diaGrad;
            ctx.beginPath();
            ctx.moveTo(0, -diaSize);
            ctx.lineTo(-diaSize * 0.7, 0);
            ctx.lineTo(0, diaSize * 0.5);
            ctx.lineTo(diaSize * 0.7, 0);
            ctx.closePath();
            ctx.fill();

            // Flash Overlay (White-out effect)
            if (flash > 0.1) {
                ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.6})`;
                ctx.fill();
            }

            ctx.shadowBlur = 0;

            // Outline brightens with flash
            ctx.strokeStyle = `rgba(255,255,255,${0.9 + flash * 0.1})`;
            ctx.lineWidth = 4 + flash * 2;
            ctx.stroke();

            // Inner facets
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, -diaSize);
            ctx.lineTo(0, diaSize * 0.5);
            ctx.moveTo(-diaSize * 0.7, 0);
            ctx.lineTo(diaSize * 0.7, 0);
            ctx.stroke();

            // Magical Particles (Orbiting)
            for (let i = 0; i < 3; i++) {
                const angle = time * 4 + (i * Math.PI * 2 / 3) + (flash * 2); // Spin faster with flash
                const rx = diaSize * 0.8;
                const ry = diaSize * 0.3;
                const ox = Math.cos(angle) * rx;
                const oy = Math.sin(angle) * ry;

                ctx.fillStyle = `hsl(${time * 100 + i * 60}, 100%, 70%)`;
                ctx.beginPath();
                ctx.arc(ox, oy, 4 + flash * 2, 0, Math.PI * 2);
                ctx.fill();
            }
            break;

        default:
            // BIG bouncy circle - grounded
            const circleSize = 22;

            // Ground shadow
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath();
            ctx.ellipse(0, circleSize + 3, circleSize, 6, 0, 0, Math.PI * 2);
            ctx.fill();

            const pGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, circleSize * 1.2);
            pGrad.addColorStop(0, '#81ecec');
            pGrad.addColorStop(0.5, '#00cec9');
            pGrad.addColorStop(1, '#00b894');

            // Glow + Flash
            ctx.shadowColor = '#00cec9';
            ctx.shadowBlur = 15 + (flash * 30);

            ctx.fillStyle = pGrad;
            ctx.beginPath();
            ctx.arc(0, 0, circleSize, 0, Math.PI * 2);
            ctx.fill();

            // Flash Overlay
            if (flash > 0.1) {
                ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.5})`;
                ctx.fill();
            }

            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 4;
            ctx.stroke();

            // Big expressive eyes
            const lookDir = dir === 1 ? 1 : -1;
            // Eyes
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.ellipse(lookDir * 6, -3, 6, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#2d3436';
            ctx.beginPath();
            ctx.arc(lookDir * 7, -2, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(lookDir * 8, -4, 2, 0, Math.PI * 2);
            ctx.fill();
            // Smile
            ctx.strokeStyle = '#2d3436';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 4, 6, 0.2, Math.PI - 0.2);
            ctx.stroke();
    }

    ctx.restore();
}
