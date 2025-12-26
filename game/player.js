// ============================================================
// game/player.js - Player Drawing, Skins, and Animations
// ============================================================

const SKIN_DATA = {
    default: { name: '기본 (원형)', icon: '⚪', type: 'circle' },
    skin_square: { name: '사각형', icon: '🟧', type: 'square', price: 150 },
    skin_triangle: { name: '삼각형', icon: '🔺', type: 'triangle', price: 200 },
    skin_diamond: { name: '다이아몬드', icon: '💎', type: 'diamond', price: 500 }
};

function updateSkinRotation() {
    const skin = SKIN_DATA[currentSkin] || SKIN_DATA.default;
    if (skin.type !== 'circle') {
        skinRotation += Math.PI / 4;
    } else {
        skinRotation = 0;
    }
}

function equipSkin(skinId) {
    currentSkin = skinId;
    localStorage.setItem('currentSkin', skinId);
    updateShopUI();
    console.log(`Equipped skin: ${skinId}`);
    if (window.saveData) {
        window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin);
    }
}

function drawPlayerWithSkin(ctx, px, py, dir) {
    const skin = SKIN_DATA[currentSkin] || SKIN_DATA.default;
    const time = Date.now() * 0.001;

    ctx.save();
    ctx.translate(px, py - 20);

    // Rotation for non-circle skins
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
            // Enhanced 3D Cube with gradient
            const size = PLAYER_R * 1.8;
            const cubeGrad = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
            cubeGrad.addColorStop(0, '#f39c12');
            cubeGrad.addColorStop(0.5, '#e67e22');
            cubeGrad.addColorStop(1, '#d35400');

            // Glow effect
            ctx.shadowColor = '#f39c12';
            ctx.shadowBlur = 15;

            ctx.fillStyle = cubeGrad;
            ctx.fillRect(-size / 2, -size / 2, size, size);

            // Inner highlight
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillRect(-size / 2 + 3, -size / 2 + 3, size / 3, size / 3);

            // Outline
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.strokeRect(-size / 2, -size / 2, size, size);
            break;

        case 'triangle':
            // Enhanced Pyramid with gradient
            const triGrad = ctx.createLinearGradient(0, -PLAYER_R * 1.8, 0, PLAYER_R * 0.6);
            triGrad.addColorStop(0, '#ff6b6b');
            triGrad.addColorStop(0.5, '#ee5253');
            triGrad.addColorStop(1, '#b33939');

            // Glow
            ctx.shadowColor = '#ff6b6b';
            ctx.shadowBlur = 15;

            ctx.fillStyle = triGrad;
            ctx.beginPath();
            ctx.moveTo(0, -PLAYER_R * 1.8);
            ctx.lineTo(-PLAYER_R * 1.2, PLAYER_R * 0.6);
            ctx.lineTo(PLAYER_R * 1.2, PLAYER_R * 0.6);
            ctx.closePath();
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Inner shine
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath();
            ctx.moveTo(0, -PLAYER_R * 1.2);
            ctx.lineTo(-PLAYER_R * 0.4, PLAYER_R * 0.2);
            ctx.lineTo(PLAYER_R * 0.4, PLAYER_R * 0.2);
            ctx.closePath();
            ctx.fill();
            break;

        case 'diamond':
            // Enhanced sparkling diamond
            const diaGrad = ctx.createLinearGradient(0, -PLAYER_R * 1.8, 0, PLAYER_R);
            diaGrad.addColorStop(0, '#74b9ff');
            diaGrad.addColorStop(0.3, '#0984e3');
            diaGrad.addColorStop(0.7, '#6c5ce7');
            diaGrad.addColorStop(1, '#a29bfe');

            // Multi-color glow
            ctx.shadowColor = '#74b9ff';
            ctx.shadowBlur = 20;

            ctx.fillStyle = diaGrad;
            ctx.beginPath();
            ctx.moveTo(0, -PLAYER_R * 1.8);
            ctx.lineTo(-PLAYER_R * 1.2, 0);
            ctx.lineTo(0, PLAYER_R);
            ctx.lineTo(PLAYER_R * 1.2, 0);
            ctx.closePath();
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Sparkle effects
            const sparkleCount = 3;
            for (let i = 0; i < sparkleCount; i++) {
                const angle = time * 2 + (i * Math.PI * 2 / sparkleCount);
                const sparkX = Math.cos(angle) * PLAYER_R * 0.5;
                const sparkY = Math.sin(angle) * PLAYER_R * 0.3 - 5;
                const sparkSize = 2 + Math.sin(time * 5 + i) * 1;

                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.beginPath();
                ctx.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2);
                ctx.fill();
            }
            break;

        default:
            // Enhanced default circle with gradient
            const pGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, PLAYER_R * 1.2);
            pGrad.addColorStop(0, '#81ecec');
            pGrad.addColorStop(0.5, '#00cec9');
            pGrad.addColorStop(1, '#00b894');

            // Glow
            ctx.shadowColor = '#00cec9';
            ctx.shadowBlur = 12;

            ctx.fillStyle = pGrad;
            ctx.beginPath();
            ctx.arc(0, 0, PLAYER_R, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Eyes
            ctx.fillStyle = '#2d3436';
            const lookDir = dir === 1 ? 1 : -1;
            ctx.beginPath();
            ctx.arc(lookDir * 4, -2, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Eye shine
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(lookDir * 4 + 1, -3, 1.5, 0, Math.PI * 2);
            ctx.fill();
    }

    ctx.restore();
}
