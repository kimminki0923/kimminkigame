// ============================================================
// game/player.js - Player Drawing, Skins, and Animations
// Geometry Dash style - grounded on stairs, rolling animation
// ============================================================

// Animation state for smooth rolling
let targetSkinRotation = 0;
let currentSkinRotation = 0;

function updateSkinRotation() {
    const skin = window.SKIN_DATA[currentSkin] || window.SKIN_DATA.default;
    if (skin.type === 'circle') {
        targetSkinRotation = 0;
    } else if (skin.type === 'square') {
        // 90 degree rotation per step (like Geometry Dash cube)
        targetSkinRotation += Math.PI / 2;
    } else if (skin.type === 'triangle') {
        // 120 degree rotation for triangle (3 sides)
        targetSkinRotation += Math.PI * 2 / 3;
    } else if (skin.type === 'diamond' || skin.type === 'ruby' || skin.type === 'cosmic') {
        // Floating skins, no rolling rotation
        targetSkinRotation = 0;
    } else if (skin.type === 'pentagon') {
        // Pentagonal rotation (72 degrees)
        targetSkinRotation += Math.PI * 2 / 5;
    }
}

function equipSkin(skinId) {
    console.log('[Player] Equipping skin:', skinId);
    currentSkin = skinId;
    localStorage.setItem('currentSkin', skinId);
    localStorage.setItem('ownedSkins', JSON.stringify(ownedSkins));
    // Reset rotation when changing skins
    targetSkinRotation = 0;
    currentSkinRotation = 0;
    updateShopUI();
    if (window.saveData) {
        window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin, ownedPets, currentPet, ownedMaps, currentMap);
    }
}

// Flash/Glow Intensity for "Speed = Brightness" effect
window.playerFlash = 0;

function drawPlayerWithSkin(ctx, px, py, dir) {
    const skin = window.SKIN_DATA[currentSkin] || window.SKIN_DATA.default;
    const time = Date.now() * 0.001;

    // Smooth rotation interpolation (Geometry Dash style)
    const rotationSpeed = 0.25;
    currentSkinRotation += (targetSkinRotation - currentSkinRotation) * rotationSpeed;

    // Decay flash
    window.playerFlash *= 0.9;
    if (window.playerFlash < 0.01) window.playerFlash = 0;

    const flash = window.playerFlash;

    const skinLv = window.skinLevels?.[currentSkin] || 1;
    const lvScale = 1 + (skinLv - 1) * 0.02; // Slightly bigger per level

    ctx.save();

    // Position ON the stair (not touching) - move down to touch stair
    const groundOffset = skin.type === 'circle' ? 5 : 0;

    // Special Floating Logic for Floating Skins
    let floatY = 0;
    if (skin.type === 'diamond' || skin.type === 'ruby' || skin.type === 'cosmic') {
        floatY = Math.sin(time * 3) * 5; // Bobbing up and down
    }

    ctx.translate(px, py - groundOffset + floatY);
    ctx.scale(lvScale, lvScale);

    // ============================================================
    // ENHANCEMENT AURA (강화 오라)
    // ============================================================
    if (skinLv > 1) {
        ctx.save();
        const auraAlpha = 0.2 + Math.min(skinLv * 0.05, 0.5);
        const auraSize = 30 + (skinLv * 2);
        const auraHue = (time * 50 + (skinLv * 20)) % 360;

        ctx.shadowColor = `hsla(${auraHue}, 100%, 70%, ${auraAlpha})`;
        ctx.shadowBlur = auraSize + Math.sin(time * 4) * 10;

        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fillStyle = 'transparent';
        ctx.fill();
        ctx.restore();

        // Orbiting Level Particles
        const particleCount = Math.min(skinLv - 1, 8);
        for (let i = 0; i < particleCount; i++) {
            ctx.save();
            const orbitSpeed = 1 + (skinLv * 0.1);
            const angle = (time * orbitSpeed) + (i * Math.PI * 2 / particleCount);
            const dist = 35 + (skinLv * 1);
            const ox = Math.cos(angle) * dist;
            const oy = Math.sin(angle) * dist * 0.4;

            const pSize = 2 + (skinLv * 0.5);
            ctx.fillStyle = `hsl(${auraHue}, 100%, 80%)`;
            ctx.shadowColor = `hsl(${auraHue}, 100%, 50%)`;
            ctx.shadowBlur = 10;

            ctx.beginPath();
            ctx.arc(ox, oy, pSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // Apply rotation for non-circle skins (except Floating ones)
    if (skin.type !== 'circle' && skin.type !== 'diamond' && skin.type !== 'ruby' && skin.type !== 'cosmic') {
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

        case 'ruby':
            // BIG Pharaoh's Ruby - Floating, pulsing red light, huge size
            const rubySize = 42; // Even bigger than diamond
            const rubyPulse = 1 + Math.sin(time * 4) * 0.08 + (flash * 0.15);

            ctx.scale(rubyPulse, rubyPulse);

            // Ground shadow
            ctx.save();
            ctx.translate(0, -floatY);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            const rubyShadowScale = 1 - (floatY + 5) * 0.08;
            ctx.beginPath();
            ctx.ellipse(0, rubySize * 0.6 + 12, rubySize * 0.7 * rubyShadowScale, 8 * rubyShadowScale, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Ruby Gradient - Dark red to blood red
            const rubyGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, rubySize);
            rubyGrad.addColorStop(0, '#ff7675');
            rubyGrad.addColorStop(0.4, '#d63031');
            rubyGrad.addColorStop(1, '#811818');

            // Reddish Aura / Glow
            ctx.shadowColor = '#ff4d4d';
            ctx.shadowBlur = 35 + Math.sin(time * 6) * 15 + (flash * 60);

            ctx.fillStyle = rubyGrad;

            // Octagonal / Cut Ruby shape
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const angle = i * Math.PI / 4;
                const r = (i % 2 === 0) ? rubySize : rubySize * 0.85;
                const rx = Math.cos(angle) * r;
                const ry = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(rx, ry);
                else ctx.lineTo(rx, ry);
            }
            ctx.closePath();
            ctx.fill();

            // White highlight for "shine"
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 + flash * 0.2})`;
            ctx.lineWidth = 4;
            ctx.stroke();

            // Inner facets for that "premium" feel
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const angle = i * Math.PI / 4;
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(angle) * rubySize, Math.sin(angle) * rubySize);
            }
            ctx.stroke();

            // Floating Red Embers / Particles
            for (let i = 0; i < 4; i++) {
                const angle = time * 2.5 + (i * Math.PI / 2);
                const rx = rubySize * 1.1;
                const ry = rubySize * 0.4;
                const ox = Math.cos(angle) * rx;
                const oy = Math.sin(angle) * ry;

                ctx.fillStyle = `rgba(255, 0, 0, ${0.4 + Math.sin(time + i) * 0.3})`;
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(ox, oy, 5 + flash * 3, 0, Math.PI * 2);
                ctx.fill();
            }
            break;

        case 'cosmic':
            // ============================================================
            // COSMIC STAR (코스믹 스타) - 100만 골드 전설급 스킨
            // ============================================================
            const cosmicSize = 50; // 가장 큰 스킨
            const cosmicPulse = 1 + Math.sin(time * 6) * 0.1 + (flash * 0.2);
            const hue = (time * 30) % 360; // 색상 순환

            ctx.scale(cosmicPulse, cosmicPulse);

            // 플로팅 그림자
            ctx.save();
            ctx.translate(0, -floatY);
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            const cosmicShadowScale = 1 - (floatY + 5) * 0.1;
            ctx.beginPath();
            ctx.ellipse(0, cosmicSize * 0.6 + 15, cosmicSize * 0.8 * cosmicShadowScale, 10 * cosmicShadowScale, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // 코스믹 글로우 (무지개빛)
            ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
            ctx.shadowBlur = 60 + Math.sin(time * 8) * 20 + (flash * 80);

            // 별 모양 (8각 별)
            const cosmicGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, cosmicSize);
            cosmicGrad.addColorStop(0, '#fff');
            cosmicGrad.addColorStop(0.2, `hsl(${hue}, 100%, 70%)`);
            cosmicGrad.addColorStop(0.5, `hsl(${(hue + 60) % 360}, 100%, 50%)`);
            cosmicGrad.addColorStop(1, `hsl(${(hue + 120) % 360}, 80%, 30%)`);

            ctx.fillStyle = cosmicGrad;
            ctx.beginPath();
            for (let i = 0; i < 16; i++) {
                const angle = (i * Math.PI / 8) - Math.PI / 2;
                const r = (i % 2 === 0) ? cosmicSize : cosmicSize * 0.5;
                const rx = Math.cos(angle) * r;
                const ry = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(rx, ry);
                else ctx.lineTo(rx, ry);
            }
            ctx.closePath();
            ctx.fill();

            // 하이라이트
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 + flash * 0.1})`;
            ctx.lineWidth = 5;
            ctx.stroke();

            ctx.shadowBlur = 0;

            // 내부 코어 (빛나는 중심)
            const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 15);
            coreGrad.addColorStop(0, '#fff');
            coreGrad.addColorStop(0.5, `hsl(${hue}, 100%, 80%)`);
            coreGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = coreGrad;
            ctx.beginPath();
            ctx.arc(0, 0, 18, 0, Math.PI * 2);
            ctx.fill();

            // 회전하는 우주 입자 (6개)
            for (let i = 0; i < 6; i++) {
                const orbitAngle = time * (3 + i * 0.5) + (i * Math.PI / 3);
                const orbitR = cosmicSize * (0.8 + (i % 2) * 0.3);
                const ox = Math.cos(orbitAngle) * orbitR;
                const oy = Math.sin(orbitAngle) * orbitR * 0.4;

                ctx.fillStyle = `hsl(${(hue + i * 60) % 360}, 100%, 70%)`;
                ctx.shadowColor = `hsl(${(hue + i * 60) % 360}, 100%, 50%)`;
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.arc(ox, oy, 6 + flash * 3, 0, Math.PI * 2);
                ctx.fill();
            }

            // 스파클 이펙트
            ctx.fillStyle = '#fff';
            for (let i = 0; i < 8; i++) {
                const sparkleAngle = time * 5 + i * Math.PI / 4;
                const sparkleR = cosmicSize * 1.2 + Math.sin(time * 10 + i) * 10;
                const sx = Math.cos(sparkleAngle) * sparkleR;
                const sy = Math.sin(sparkleAngle) * sparkleR * 0.3;
                const sparkleSize = 2 + Math.sin(time * 8 + i) * 1.5;

                ctx.beginPath();
                ctx.arc(sx, sy, sparkleSize, 0, Math.PI * 2);
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

// ============================================================
// Pet Drawing Logic (Emoji Based - Restored Original Style)
// ============================================================
window.drawPet = function (ctx, playerX, playerY, petType, dir) {
    if (!petType || petType === 'none') return;

    // Check global PET_DATA first
    const petData = (window.PET_DATA && window.PET_DATA[petType])
        ? window.PET_DATA[petType]
        : { icon: '❓' }; // Fallback

    const icon = petData.icon;

    // Bobbing animation
    const time = Date.now() * 0.005;
    const bob = Math.sin(time * 2) * 5;

    // Position: Behind player
    const offsetDir = dir === 1 ? -1 : 1;
    const petX = playerX + (offsetDir * 35);
    const petY = playerY - 15 + bob;

    ctx.save();
    ctx.translate(petX, petY);

    // Floating animation rotation (light shake)
    const rot = Math.sin(time * 3) * 0.1;
    ctx.rotate(rot);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 20 - bob, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw Emoji
    ctx.font = "30px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Flip emoji if needed (scale X)
    ctx.scale(dir === 1 ? 1 : -1, 1);

    ctx.shadowColor = 'rgba(255,255,255,0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText(icon, 0, 0);
    ctx.shadowBlur = 0;

    ctx.restore();
};
