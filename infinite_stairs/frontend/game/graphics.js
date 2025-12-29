// game/graphics.js - Background and Rendering
// ============================================================

// Global arrays for background objects
let buildings = [];
let clouds = [];
let planets = [];
let stars = [];
let minerals = [];
let time = 0;
let petRenderPos = { x: 0, y: 0 }; // Pet interpolation

window.initBackgroundObjects = function () {
    buildings.length = 0;
    for (let i = 0; i < 25; i++) {
        buildings.push({
            x: Math.random() * 3000 - 1500,
            width: 60 + Math.random() * 100,
            height: 150 + Math.random() * 400,
            color: `hsl(230, 25%, ${10 + Math.random() * 15}%)`,
            windows: Math.random() > 0.5
        });
    }
    clouds.length = 0;
    for (let i = 0; i < 40; i++) {
        clouds.push({
            x: Math.random() * 4000 - 2000,
            y: Math.random() * 800,
            size: 50 + Math.random() * 80,
            speed: (Math.random() - 0.5) * 0.8,
            opacity: 0.3 + Math.random() * 0.5
        });
    }
    planets.length = 0;
    const pColors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#e056fd'];
    for (let i = 0; i < 20; i++) {
        planets.push({
            x: Math.random() * 5000 - 2500,
            y: Math.random() * 4000,
            size: 15 + Math.random() * 80,
            color: pColors[Math.floor(Math.random() * pColors.length)],
            ring: Math.random() > 0.6,
            texture: Math.random() > 0.5
        });
    }
    stars.length = 0;
    for (let i = 0; i < 200; i++) {
        stars.push({
            x: Math.random() * 2000,
            y: Math.random() * 2000,
            size: Math.random() * 2,
            blinkSpeed: 0.05 + Math.random() * 0.1,
            phase: Math.random() * Math.PI * 2
        });
    }

    minerals.length = 0;
    const mColors = ['#9b59b6', '#3498db', '#2ecc71', '#f1c40f', '#e67e22'];
    for (let i = 0; i < 50; i++) {
        minerals.push({
            x: Math.random() * 3000 - 1500,
            y: Math.random() * 5000,
            size: 5 + Math.random() * 15,
            color: mColors[Math.floor(Math.random() * mColors.length)],
            angle: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.05
        });
    }
}

function lerpColor(a, b, t) {
    const ah = parseInt(a.replace('#', ''), 16);
    const ar = ah >> 16, ag = ah >> 8 & 0xff, ab = ah & 0xff;
    const bh = parseInt(b.replace('#', ''), 16);
    const br = bh >> 16, bg = bh >> 8 & 0xff, bb = bh & 0xff;
    const nr = ar + (br - ar) * t;
    const ng = ag + (bg - ag) * t;
    const nb = ab + (bb - ab) * t;
    return `rgb(${Math.floor(nr)}, ${Math.floor(ng)}, ${Math.floor(nb)})`;
}

// ============================================================
// Smooth Transition Utilities (연속 전환용 유틸리티)
// ============================================================

// Clamp value between min and max
function clamp(x, min, max) {
    return Math.max(min, Math.min(max, x));
}

// Smoothstep - 부드러운 S-curve 전환 (0에서 1로)
function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

// Get opacity for a phase based on score with smooth fade in/out
// phaseStart: phase가 시작되는 score
// phaseEnd: phase가 끝나는 score  
// blendRange: fade in/out에 걸리는 score 범위
function getPhaseOpacity(score, phaseStart, phaseEnd, blendRange) {
    if (score < phaseStart - blendRange) return 0;
    if (score > phaseEnd + blendRange) return 0;
    if (score < phaseStart) return smoothstep(phaseStart - blendRange, phaseStart, score);
    if (score > phaseEnd) return 1 - smoothstep(phaseEnd, phaseEnd + blendRange, score);
    return 1;
}

// Lerp for numbers
function lerp(a, b, t) {
    return a + (b - a) * clamp(t, 0, 1);
}

// ============================================================
// Desert Background Rendering
// ============================================================
function drawDesertBackground(camX, camY, score, w, h) {
    // Desert Sky Gradient (warm orange/yellow tones)
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#f39c12');    // Warm orange top
    grad.addColorStop(0.4, '#f1c40f');  // Golden middle
    grad.addColorStop(0.7, '#e67e22');  // Deep orange
    grad.addColorStop(1, '#d35400');    // Sandy bottom
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Blazing Sun
    const sunX = w * 0.75;
    const sunY = h * 0.15;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 120);
    sunGrad.addColorStop(0, 'rgba(255,255,200,1)');
    sunGrad.addColorStop(0.3, 'rgba(255,230,100,0.8)');
    sunGrad.addColorStop(1, 'rgba(255,200,50,0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff8dc';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 50, 0, Math.PI * 2);
    ctx.fill();

    // Distant Mountains/Dunes (parallax layer 1)
    const duneOffset1 = (camX * 0.05) % w;
    ctx.fillStyle = '#c0986a';
    ctx.beginPath();
    ctx.moveTo(-duneOffset1, h);
    for (let x = -duneOffset1; x < w + 200; x += 100) {
        const peakY = h * 0.6 + Math.sin(x * 0.01) * 50;
        ctx.quadraticCurveTo(x + 50, peakY - 80, x + 100, h * 0.7);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // === PYRAMID (Large, Center-Left) ===
    const pyramidX = w * 0.35 - (camX * 0.08) % (w * 0.5);
    const pyramidBase = h * 0.75;
    const pyramidHeight = 180;
    const pyramidWidth = 200;

    // Pyramid shadow
    ctx.fillStyle = '#8B7355';
    ctx.beginPath();
    ctx.moveTo(pyramidX, pyramidBase);
    ctx.lineTo(pyramidX + pyramidWidth / 2, pyramidBase - pyramidHeight);
    ctx.lineTo(pyramidX + pyramidWidth + 30, pyramidBase);
    ctx.closePath();
    ctx.fill();

    // Pyramid main
    ctx.fillStyle = '#d4a860';
    ctx.beginPath();
    ctx.moveTo(pyramidX, pyramidBase);
    ctx.lineTo(pyramidX + pyramidWidth / 2, pyramidBase - pyramidHeight);
    ctx.lineTo(pyramidX + pyramidWidth, pyramidBase);
    ctx.closePath();
    ctx.fill();

    // Pyramid brick lines
    ctx.strokeStyle = 'rgba(139,115,85,0.5)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
        const lineY = pyramidBase - (pyramidHeight / 8) * i;
        const ratio = i / 8;
        const leftX = pyramidX + (pyramidWidth / 2) * ratio;
        const rightX = pyramidX + pyramidWidth - (pyramidWidth / 2) * ratio;
        ctx.beginPath();
        ctx.moveTo(leftX, lineY);
        ctx.lineTo(rightX, lineY);
        ctx.stroke();
    }

    // === SPHINX (Right side) ===
    const sphinxX = w * 0.7 - (camX * 0.12) % (w * 0.3);
    const sphinxBase = h * 0.78;

    // Sphinx body (lying lion)
    ctx.fillStyle = '#c0986a';
    ctx.fillRect(sphinxX, sphinxBase - 40, 80, 40);

    // Sphinx head (human face)
    ctx.fillStyle = '#d4a860';
    ctx.beginPath();
    ctx.arc(sphinxX + 10, sphinxBase - 60, 25, 0, Math.PI * 2);
    ctx.fill();

    // Sphinx headdress
    ctx.fillStyle = '#1e3a5f';
    ctx.beginPath();
    ctx.moveTo(sphinxX - 15, sphinxBase - 55);
    ctx.lineTo(sphinxX + 10, sphinxBase - 90);
    ctx.lineTo(sphinxX + 35, sphinxBase - 55);
    ctx.closePath();
    ctx.fill();

    // === PHARAOH STATUE (Far right) ===
    const statueX = w * 0.9 - (camX * 0.1) % (w * 0.4);
    const statueBase = h * 0.76;

    // Statue body
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(statueX - 15, statueBase - 80, 30, 80);

    // Statue head with crown
    ctx.fillStyle = '#d4a860';
    ctx.beginPath();
    ctx.arc(statueX, statueBase - 95, 20, 0, Math.PI * 2);
    ctx.fill();

    // Pharaoh crown (double crown)
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(statueX - 15, statueBase - 100);
    ctx.lineTo(statueX, statueBase - 130);
    ctx.lineTo(statueX + 15, statueBase - 100);
    ctx.closePath();
    ctx.fill();

    // === FOREGROUND SAND DUNES ===
    const duneOffset2 = (camX * 0.2) % w;
    ctx.fillStyle = '#deb887';
    ctx.beginPath();
    ctx.moveTo(-duneOffset2 - 100, h);
    for (let x = -duneOffset2 - 100; x < w + 200; x += 150) {
        const peakY = h * 0.75 + Math.sin(x * 0.008 + 1) * 30;
        ctx.quadraticCurveTo(x + 75, peakY - 40, x + 150, h * 0.8);
    }
    ctx.lineTo(w + 100, h);
    ctx.closePath();
    ctx.fill();

    // Ground sand
    ctx.fillStyle = '#e0c090';
    ctx.fillRect(0, h * 0.85, w, h * 0.15);
}

function drawBackground(camX, camY) {
    // High-Quality Anti-Aliasing Enforcement
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Debug Map State (Throttle logs)
    if (Math.random() < 0.01) console.log('[Graphics] Drawing Background. Current Map:', window.currentMap);

    const score = window.gameState.score;
    const w = canvas.width;
    const h = canvas.height;

    // Check if using Winter Map
    if (typeof window.currentMap !== 'undefined' && window.currentMap === 'map_winter') {
        drawWinterBackground(camX, camY, score, w, h);
        return;
    }

    // Check if using Desert Map
    if (typeof window.currentMap !== 'undefined' && window.currentMap === 'map_desert') {
        drawDesertBackgroundArtistic(camX, camY, score, w, h);
        return;
    }

    // Uses global time updated in render()

    // Sky Gradient (Score-based progression)
    let keys = [
        { scores: 0, top: '#ff9a9e', bot: '#fecfef' },
        { scores: 200, top: '#89f7fe', bot: '#66a6ff' },
        { scores: 500, top: '#2c3e50', bot: '#fd746c' },
        { scores: 800, top: '#0f2027', bot: '#203a43' },
        { scores: 1000, top: '#000000', bot: '#1c1c1c' },
        { scores: 10000, top: '#ffffff', bot: '#dcdde1' }
    ];

    // Version 2: Reverse Mode Specific Themes
    if (window.gameState.isReverseMode) {
        keys = [
            { scores: 0, top: '#2c3e50', bot: '#4a69bd' },   // Surface (Subterranean vibe start)
            { scores: 100, top: '#5d4037', bot: '#3e2723' }, // Entering Soil
            { scores: 500, top: '#212121', bot: '#000000' }, // Deep Underground
            { scores: 800, top: '#e64a19', bot: '#bf360c' }, // Outer Core (Lava)
            { scores: 1200, top: '#ffeb3b', bot: '#f57f17' }, // Inner Core (White Hot)
            { scores: 1500, top: '#0f0c29', bot: '#302b63' }, // Emerging Other Side (Space)
            { scores: 10000, top: '#00d2ff', bot: '#3a7bd5' } // Blue Sky again?
        ];
    }

    let k1 = keys[0], k2 = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) {
        if (score >= keys[i].scores && score <= keys[i + 1].scores) {
            k1 = keys[i]; k2 = keys[i + 1]; break;
        } else if (score > keys[i].scores) { k1 = keys[i]; }
    }
    let t = (score - k1.scores) / (k2.scores - k1.scores + 0.001);
    t = Math.max(0, Math.min(1, t));

    const curTop = lerpColor(k1.top, k2.top, t);
    const curBot = lerpColor(k1.bot, k2.bot, t);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, curTop); grad.addColorStop(1, curBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Sun
    const sunMove = window.gameState.isReverseMode ? -(score * 0.5) : (score * 0.5);
    const sunY = h * 0.2 + sunMove;
    if (sunY < h + 100 && score < 8000) {
        const sunGrad = ctx.createRadialGradient(w / 2, sunY, 0, w / 2, sunY, 150);
        sunGrad.addColorStop(0, 'rgba(255, 255, 200, 0.4)');
        sunGrad.addColorStop(1, 'rgba(255, 255, 200, 0)');
        ctx.fillStyle = sunGrad;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffde7d';
        ctx.beginPath();
        ctx.arc(w / 2, sunY, 60, 0, Math.PI * 2);
        ctx.fill();
    }

    // Stars
    let starOpacity = score < 9500 ? Math.max(0, Math.min(1, (score - 600) / 400)) : Math.max(0, 1 - (score - 9500) / 500);
    if (window.gameState.isReverseMode) {
        if (score < 800) starOpacity = 0; // No stars in early descent
        else if (score >= 800 && score < 1500) starOpacity = 0; // No stars in Core
        else if (score >= 1500) starOpacity = Math.min(1, (score - 1500) / 500); // Emerging to space
    }
    if (starOpacity > 0) {
        ctx.globalAlpha = starOpacity;
        ctx.fillStyle = '#ffffff';
        stars.forEach(s => {
            const sx = (camX * 0.05 + s.x) % w;
            const sy = (camY * 0.05 + s.y) % h;
            const size = s.size + Math.sin(time * 5 + s.phase) * 0.5;
            ctx.beginPath(); ctx.arc(sx, sy, Math.max(0, size), 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    // Buildings
    const buildAlpha = Math.max(0, 1 - score / 150);
    if (buildAlpha > 0) {
        ctx.globalAlpha = buildAlpha;
        buildings.forEach(b => {
            const bx = (camX * 0.3 + b.x + 50000) % 3000 - 1000;
            const buildYMove = window.gameState.isReverseMode ? -(score * 3) : (score * 3);
            const by = h - b.height + buildYMove;
            ctx.fillStyle = b.color;
            ctx.fillRect(bx, by, b.width, b.height);
            if (b.windows) {
                ctx.fillStyle = 'rgba(255,255,200,0.3)';
                for (let wy = by + 10; wy < by + b.height; wy += 20) {
                    for (let wx = bx + 5; wx < bx + b.width - 5; wx += 15) {
                        if (Math.random() > 0.3) ctx.fillRect(wx, wy, 8, 12);
                    }
                }
            }
        });
        ctx.globalAlpha = 1;
    }

    // Clouds
    let cloudAlpha = score < 600 ? 1 : Math.max(0, 1 - (score - 600) / 200);
    if (window.gameState.isReverseMode) {
        cloudAlpha = Math.max(0, 1 - score / 150); // Faster fadeout in Reverse (disappear by 150)
    }
    if (cloudAlpha > 0) {
        ctx.globalAlpha = cloudAlpha * 0.7;
        clouds.forEach(c => {
            const cx = (camX * 0.1 + c.x + time * c.speed * 50 + 50000) % 4000 - 1000;
            const cloudYMove = window.gameState.isReverseMode ? -(score * 2) : (score * 2);
            const cy = h * 0.5 + c.y + cloudYMove - 300;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(cx, cy, c.size, 0, Math.PI * 2);
            ctx.arc(cx + c.size * 0.7, cy - c.size * 0.5, c.size * 0.8, 0, Math.PI * 2);
            ctx.arc(cx - c.size * 0.7, cy - c.size * 0.3, c.size * 0.6, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    // Planets
    const planetAlpha = score < 9500 ? Math.max(0, Math.min(1, (score - 800) / 200)) : Math.max(0, 1 - (score - 9500) / 500);
    if (planetAlpha > 0) {
        ctx.globalAlpha = planetAlpha;
        planets.forEach((p) => {
            const px = (camX * 0.02 + p.x) % 5000 - 1000;
            const planetYMove = window.gameState.isReverseMode ? (score * 1.0) : -(score * 1.0);
            const py = p.y + planetYMove + 1000;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(px, py, p.size, 0, Math.PI * 2);
            ctx.fill();
            if (p.texture) {
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                ctx.beginPath();
                ctx.arc(px, py, p.size * 0.8, 0, Math.PI, false);
                ctx.fill();
            }
            if (p.ring) {
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.ellipse(px, py, p.size * 2.2, p.size * 0.5, -0.3, 0, Math.PI * 2);
                ctx.stroke();
            }
        });
        ctx.globalAlpha = 1;
    }

    // Minerals (Underground Version 2)
    let mineralAlpha = 0;
    if (window.gameState.isReverseMode) {
        if (score > 150 && score < 800) {
            mineralAlpha = Math.min(1, (score - 150) / 100);
            if (score > 700) mineralAlpha = Math.max(0, 1 - (score - 700) / 100); // Fade out as core arrives
        }
    }
    if (mineralAlpha > 0) {
        ctx.globalAlpha = mineralAlpha;
        minerals.forEach(m => {
            const mx = (camX * 0.15 + m.x + 5000) % 3000 - 1500;
            const mineralYMove = -(score * 4); // Fast upward move for minerals
            const my = (m.y + mineralYMove + 10000) % 5000;

            ctx.save();
            ctx.translate(mx, my);
            ctx.rotate(time * 0.5 + m.angle);

            // Draw a crystalline shape
            ctx.fillStyle = m.color;
            ctx.beginPath();
            ctx.moveTo(0, -m.size);
            ctx.lineTo(m.size * 0.8, 0);
            ctx.lineTo(0, m.size);
            ctx.lineTo(-m.size * 0.8, 0);
            ctx.closePath();
            ctx.fill();

            // Shininess
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath();
            ctx.moveTo(0, -m.size);
            ctx.lineTo(m.size * 0.4, 0);
            ctx.lineTo(0, m.size * 0.2);
            ctx.fill();

            ctx.restore();
        });
        ctx.globalAlpha = 1;
    }
}

// Premium Pet Drawing - detailed graphics version
// Export as window.premiumDrawPet to avoid overwrite by player.js
function drawPet(ctx, px, py, petType, playerDir) {
    if (!petType || petType === 'none') return;

    ctx.save();
    ctx.globalAlpha = 1.0; // FORCE full opacity immediately

    // Target position calculation
    let targetX, targetY;

    if (petType === 'pet_eagle') {
        // Eagle: Hover directly above player's current render position
        targetX = window.gameState.renderPlayer.x;
        targetY = window.gameState.renderPlayer.y + 1.8; // Clearly above head
    } else {
        // Ground Pets: Follow exactly one step behind
        const prevIdx = Math.max(0, window.gameState.score - 1);
        const prevStair = window.gameState.stairs[prevIdx] || { x: 0, y: 0 };
        targetX = prevStair.x;
        targetY = prevStair.y + 0.1; // Slightly above the stair surface
    }

    // Initialize if jump
    if (Math.abs(petRenderPos.x - targetX) > 5) {
        petRenderPos.x = targetX;
        petRenderPos.y = targetY;
    }

    petRenderPos.x += (targetX - petRenderPos.x) * 0.15;
    petRenderPos.y += (targetY - petRenderPos.y) * 0.15;

    const petX = px + (petRenderPos.x - window.gameState.renderPlayer.x) * STAIR_W;
    const petY = py - (petRenderPos.y - window.gameState.renderPlayer.y) * STAIR_H;

    ctx.translate(petX, petY);

    // Flip pet to face the direction of movement
    // playerDir === 1 means facing RIGHT, playerDir === 0 means facing LEFT
    // Most emojis (🦅🐕🐈🐷) naturally face LEFT, so we flip horizontally when going RIGHT
    if (playerDir === 1) {
        ctx.scale(-1, 1);
    }

    const bounce = Math.sin(time * 10) * 3;

    // LARGER SIZE: 48px to match character
    ctx.font = "48px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw shadow for pet
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 20, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Special rendering for Golden Pig - draw as actual golden shape
    if (petType === 'pet_pig') {
        // Pulsing golden glow
        ctx.shadowBlur = 20 + Math.sin(time * 5) * 10;
        ctx.shadowColor = '#ffd700';

        // Golden body (main circle)
        const gradient = ctx.createRadialGradient(0, bounce, 5, 0, bounce, 20);
        gradient.addColorStop(0, '#fff7cc'); // Light gold center
        gradient.addColorStop(0.5, '#ffd700'); // Gold
        gradient.addColorStop(1, '#cc9900'); // Dark gold edge

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, bounce, 18, 0, Math.PI * 2);
        ctx.fill();

        // Snout (pink circle)
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffb6c1';
        ctx.beginPath();
        ctx.ellipse(12, bounce + 2, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Nostrils
        ctx.fillStyle = '#ff69b4';
        ctx.beginPath();
        ctx.arc(10, bounce + 1, 2, 0, Math.PI * 2);
        ctx.arc(14, bounce + 1, 2, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-5, bounce - 5, 3, 0, Math.PI * 2);
        ctx.fill();

        // Eye shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-4, bounce - 6, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Ears (golden triangles)
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(-12, bounce - 15);
        ctx.lineTo(-8, bounce - 8);
        ctx.lineTo(-16, bounce - 8);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(2, bounce - 15);
        ctx.lineTo(6, bounce - 8);
        ctx.lineTo(-2, bounce - 8);
        ctx.closePath();
        ctx.fill();

        // Sparkle effect
        ctx.fillStyle = '#fff';
        const sparkleSize = 3 + Math.sin(time * 8) * 2;
        ctx.beginPath();
        ctx.arc(-15, bounce - 10, sparkleSize, 0, Math.PI * 2);
        ctx.fill();
    } else if (petType === 'pet_sphinx') {
        // ============================================================
        // SPHINX PET (스핑크스 펫) - 파라오의 왕관 15개 해금
        // ============================================================
        const sphinxBounce = bounce * 0.3; // 덜 튀는 움직임

        // 신비로운 황금빛 아우라
        ctx.shadowBlur = 15 + Math.sin(time * 4) * 8;
        ctx.shadowColor = '#d4af37';

        // 몸통 (누운 사자 모양)
        const bodyGrad = ctx.createLinearGradient(-20, 0, 20, 0);
        bodyGrad.addColorStop(0, '#c4a35a');
        bodyGrad.addColorStop(0.5, '#d4b06a');
        bodyGrad.addColorStop(1, '#b8956a');

        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.ellipse(0, sphinxBounce + 5, 22, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // 앞다리
        ctx.fillStyle = '#c4a35a';
        ctx.fillRect(-18, sphinxBounce + 12, 8, 12);
        ctx.fillRect(10, sphinxBounce + 12, 8, 12);

        // 머리
        ctx.fillStyle = '#d4b06a';
        ctx.beginPath();
        ctx.arc(-20, sphinxBounce - 5, 12, 0, Math.PI * 2);
        ctx.fill();

        // 네메스 머리장식 (파라오 두건)
        ctx.fillStyle = '#1e3a5f';
        ctx.beginPath();
        ctx.moveTo(-30, sphinxBounce - 8);
        ctx.lineTo(-20, sphinxBounce - 20);
        ctx.lineTo(-10, sphinxBounce - 8);
        ctx.closePath();
        ctx.fill();

        // 머리장식 줄무늬
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-27, sphinxBounce - 12);
        ctx.lineTo(-13, sphinxBounce - 12);
        ctx.stroke();

        // 눈 (신비로운 푸른빛)
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#00d2d3';
        ctx.fillStyle = '#00d2d3';
        ctx.beginPath();
        ctx.ellipse(-23, sphinxBounce - 6, 3, 2, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // 눈동자
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-23, sphinxBounce - 6, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // 꼬리
        ctx.fillStyle = '#b8956a';
        ctx.beginPath();
        ctx.moveTo(20, sphinxBounce + 5);
        ctx.quadraticCurveTo(30, sphinxBounce - 5, 25, sphinxBounce - 12);
        ctx.lineTo(23, sphinxBounce - 10);
        ctx.quadraticCurveTo(27, sphinxBounce - 3, 19, sphinxBounce + 6);
        ctx.fill();

        // 황금 빛 파티클
        for (let sp = 0; sp < 3; sp++) {
            const spAngle = time * 2 + sp * (Math.PI * 2 / 3);
            const spDist = 30 + Math.sin(time * 5 + sp) * 5;
            const spX = Math.cos(spAngle) * spDist * 0.8;
            const spY = Math.sin(spAngle) * spDist * 0.3 + sphinxBounce;

            ctx.fillStyle = `rgba(212, 175, 55, ${0.4 + Math.sin(time * 3 + sp) * 0.2})`;
            ctx.beginPath();
            ctx.arc(spX, spY, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (petType === 'pet_polarbear') {
        // ============================================================
        // POLAR BEAR PET (북극곰 펫) - 눈결정 15개 해금
        // ============================================================
        const bearBounce = bounce * 0.4;

        // 차가운 얼음 아우라
        ctx.shadowBlur = 15 + Math.sin(time * 3) * 5;
        ctx.shadowColor = '#81ecec';

        // 몸통 (흰색)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(0, bearBounce + 5, 24, 16, 0, 0, Math.PI * 2);
        ctx.fill();

        // 다리 (4개)
        ctx.beginPath();
        ctx.arc(-14, bearBounce + 16, 6, 0, Math.PI * 2);
        ctx.arc(14, bearBounce + 16, 6, 0, Math.PI * 2);
        ctx.arc(-8, bearBounce + 18, 6, 0, Math.PI * 2);
        ctx.arc(8, bearBounce + 18, 6, 0, Math.PI * 2);
        ctx.fill();

        // 머리
        ctx.beginPath();
        ctx.arc(-18, bearBounce - 8, 14, 0, Math.PI * 2);
        ctx.fill();

        // 귀 (둥근 귀)
        ctx.beginPath();
        ctx.arc(-26, bearBounce - 16, 5, 0, Math.PI * 2);
        ctx.arc(-10, bearBounce - 16, 5, 0, Math.PI * 2);
        ctx.fill();

        // 코와 입
        ctx.fillStyle = '#2d3436';
        ctx.beginPath();
        ctx.ellipse(-28, bearBounce - 6, 4, 3, 0, 0, Math.PI * 2); // 코
        ctx.fill();

        // 눈
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-22, bearBounce - 10, 1.5, 0, Math.PI * 2);
        ctx.arc(-14, bearBounce - 10, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // 붉은 목도리 (포인트)
        ctx.fillStyle = '#ff7675';
        ctx.beginPath();
        ctx.rect(-10, bearBounce + 2, 20, 6);
        ctx.fill();
        // 목도리 끝자락
        ctx.beginPath();
        ctx.moveTo(8, bearBounce + 4);
        ctx.lineTo(16, bearBounce + 12);
        ctx.lineTo(12, bearBounce + 16);
        ctx.lineTo(4, bearBounce + 8);
        ctx.fill();

        // 눈송이 파티클
        for (let sp = 0; sp < 3; sp++) {
            const spAngle = time * 1.5 + sp * (Math.PI * 2 / 3);
            const spDist = 32 + Math.sin(time * 3 + sp) * 4;
            const spX = Math.cos(spAngle) * spDist;
            const spY = Math.sin(spAngle) * spDist * 0.5 + bearBounce;

            ctx.fillStyle = `rgba(223, 249, 251, ${0.6 + Math.sin(time * 5 + sp) * 0.3})`;
            ctx.beginPath();
            ctx.arc(spX, spY, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (petType === 'pet_penguin') {
        // ============================================================
        // PENGUIN PET (펭귄 펫) - 체력 감소 1.5배 느려짐
        // ============================================================
        const penguinBounce = bounce * 0.5;

        // 몸통 (검정)
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.ellipse(0, penguinBounce + 5, 16, 20, 0, 0, Math.PI * 2);
        ctx.fill();

        // 배 (흰색)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(0, penguinBounce + 8, 10, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // 머리
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.arc(0, penguinBounce - 12, 12, 0, Math.PI * 2);
        ctx.fill();

        // 눈 (흰자)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-5, penguinBounce - 14, 4, 0, Math.PI * 2);
        ctx.arc(5, penguinBounce - 14, 4, 0, Math.PI * 2);
        ctx.fill();

        // 눈동자
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-5, penguinBounce - 14, 2, 0, Math.PI * 2);
        ctx.arc(5, penguinBounce - 14, 2, 0, Math.PI * 2);
        ctx.fill();

        // 부리 (주황)
        ctx.fillStyle = '#e67e22';
        ctx.beginPath();
        ctx.moveTo(0, penguinBounce - 10);
        ctx.lineTo(-4, penguinBounce - 6);
        ctx.lineTo(4, penguinBounce - 6);
        ctx.closePath();
        ctx.fill();

        // 발 (주황)
        ctx.fillStyle = '#e67e22';
        ctx.beginPath();
        ctx.ellipse(-6, penguinBounce + 22, 5, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(6, penguinBounce + 22, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // 날개 (파닥파닥)
        const wingAngle = Math.sin(time * 8) * 0.3;
        ctx.fillStyle = '#34495e';
        ctx.save();
        ctx.translate(-14, penguinBounce + 5);
        ctx.rotate(-wingAngle);
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.translate(14, penguinBounce + 5);
        ctx.rotate(wingAngle);
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    } else {


        // Other pets: use emoji icon
        const petIcon = PET_DATA[petType]?.icon || '❓';
        ctx.fillStyle = "#ffffff";
        ctx.fillText(petIcon, 0, bounce);
    }

    // Reset shadow
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    ctx.restore();
}
// Export premium pet drawing function
window.premiumDrawPet = drawPet;

// ============================================================
// Desert Background Rendering (Premium Art Version)
// ============================================================
// 개연성 있는 수직 연속성:
// - 피라미드와 사막이 항상 아래에 보이며 점점 멀어짐 (작아짐)
// - 하늘이 점점 높아지며 석양 → 밤하늘로 전환
// - 우주까지 가지 않고 이집트 밤하늘에서 마무리
// ============================================================
function drawDesertBackgroundArtistic(camX, camY, score, w, h) {
    const isReverse = window.gameState.isReverseMode;

    if (isReverse) {
        drawDesertPhaseTomb(ctx, camX, camY, w, h);
        return;
    }

    const altitude = Math.max(0, score);
    const time = Date.now() * 0.001;

    // ============================================================
    // 1. SKY: 연속적으로 변하는 하늘 (사막 낮 → 석양 → 밤)
    // ============================================================
    const skyProgress = clamp(altitude / 600, 0, 1); // 600에서 완전한 밤

    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    // 낮 → 석양 → 밤 그라데이션
    const topColor = lerpColor(
        lerpColor('#1e90ff', '#ff6b35', clamp(skyProgress * 2, 0, 1)),
        '#0a0a23',
        clamp((skyProgress - 0.5) * 2, 0, 1)
    );
    const midColor = lerpColor(
        lerpColor('#87ceeb', '#ff8c42', clamp(skyProgress * 2, 0, 1)),
        '#1a1a3e',
        clamp((skyProgress - 0.5) * 2, 0, 1)
    );
    const botColor = lerpColor('#fad390', '#2d3436', skyProgress);

    skyGrad.addColorStop(0, topColor);
    skyGrad.addColorStop(0.5, midColor);
    skyGrad.addColorStop(1, botColor);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // ============================================================
    // 2. SUN/MOON: 태양이 지고 달이 뜸
    // ============================================================
    // 태양 (점점 내려감)
    const sunOpacity = clamp(1 - skyProgress * 1.5, 0, 1);
    if (sunOpacity > 0) {
        const sunY = lerp(h * 0.15, h * 0.7, clamp(skyProgress * 2, 0, 1));
        const sunX = w * 0.75;

        ctx.globalAlpha = sunOpacity;
        const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 80);
        sunGrad.addColorStop(0, '#fff7ae');
        sunGrad.addColorStop(0.3, '#ffd700');
        sunGrad.addColorStop(1, 'rgba(255, 140, 0, 0)');
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 80, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // 달과 별 (밤이 되면 나타남)
    const nightOpacity = clamp((skyProgress - 0.4) * 2.5, 0, 1);
    if (nightOpacity > 0) {
        ctx.globalAlpha = nightOpacity;

        // 달
        const moonX = w * 0.2;
        const moonY = h * 0.15;
        ctx.fillStyle = '#f5f5dc';
        ctx.beginPath();
        ctx.arc(moonX, moonY, 40, 0, Math.PI * 2);
        ctx.fill();

        // 별들
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 80; i++) {
            const sx = (Math.sin(i * 127) * 0.5 + 0.5) * w;
            const sy = (Math.cos(i * 53) * 0.4) * h;
            const twinkle = (Math.sin(time * 3 + i) * 0.5 + 0.5) * 2 + 1;
            ctx.beginPath();
            ctx.arc(sx, sy, twinkle, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ============================================================
    // 3. GROUND ELEMENTS: 항상 아래에 보이며 점점 작아짐/멀어짐
    // ============================================================
    // 스케일: 1.0 → 0.1 (멀어짐)
    const groundScale = lerp(1.0, 0.15, clamp(altitude / 400, 0, 1));
    // Y 위치: 화면 아래 → 더 아래로 (시야에서 멀어짐)
    const groundY = h + altitude * 1.5;
    // 투명도: 가까울때 1.0, 멀어질수록 살짝 흐려짐
    const groundAlpha = lerp(1.0, 0.6, clamp(altitude / 500, 0, 1));

    ctx.save();
    ctx.globalAlpha = groundAlpha;

    // 패럴랙스
    const p1 = (camX * 0.05) % w;
    const p2 = (camX * 0.1) % w;

    // 먼 산/모래언덕 (항상 보이는 배경)
    const duneY = lerp(h * 0.6, h * 0.9, clamp(altitude / 300, 0, 1));
    ctx.fillStyle = lerpColor('#d4a574', '#8b7355', skyProgress);
    ctx.beginPath();
    ctx.moveTo(-100, h);
    for (let x = -100; x < w + 200; x += 100) {
        const peakY = duneY + Math.sin((x + p2) * 0.01) * 30 * groundScale;
        ctx.quadraticCurveTo(x + 50, peakY - 50 * groundScale, x + 100, duneY);
    }
    ctx.lineTo(w + 100, h);
    ctx.closePath();
    ctx.fill();

    // 피라미드들 (원근감 적용)
    const pyramidBaseY = groundY;
    const pyramidScale = groundScale;

    // 큰 피라미드 (뒤쪽)
    if (pyramidScale > 0.05) {
        drawScaledPyramid(ctx,
            (w * 0.3 + p1 * 0.5) % w,
            pyramidBaseY,
            350 * pyramidScale,
            300 * pyramidScale,
            '#b8860b', '#8b6914'
        );

        // 작은 피라미드들
        drawScaledPyramid(ctx,
            (w * 0.6 + p1 * 0.3) % w,
            pyramidBaseY,
            200 * pyramidScale,
            180 * pyramidScale,
            '#daa520', '#b8860b'
        );

        drawScaledPyramid(ctx,
            (w * 0.8 + p1 * 0.4) % w,
            pyramidBaseY,
            150 * pyramidScale,
            130 * pyramidScale,
            '#cd853f', '#a0522d'
        );
    }

    // 스핑크스 (원근감 적용)
    if (pyramidScale > 0.1) {
        const sphinxX = (w * 0.5 + (camX * 0.2) % (w * 0.5)) % w;
        const sphinxY = pyramidBaseY - 20 * pyramidScale;
        drawScaledSphinx(ctx, sphinxX, sphinxY, pyramidScale * 0.8);
    }

    // Pharaoh Statue (New addition)
    if (pyramidScale > 0.15) {
        const statueX = (w * 0.85 + (camX * 0.15) % (w * 0.4)) % w;
        // Position it on the ground layer
        const statueY = pyramidBaseY;
        drawScaledPharaohStatue(ctx, statueX, statueY, pyramidScale * 0.9);
    }

    // 전경 모래 (가까운 모래언덕)
    if (altitude < 200) {
        const foregroundAlpha = clamp(1 - altitude / 200, 0, 1);
        ctx.globalAlpha = groundAlpha * foregroundAlpha;
        ctx.fillStyle = '#e6c987';
        ctx.beginPath();
        ctx.moveTo(-50, h);
        for (let x = -50; x < w + 100; x += 80) {
            const peakY = h * 0.85 + Math.sin((x + p1 * 2) * 0.015) * 20;
            ctx.quadraticCurveTo(x + 40, peakY - 30, x + 80, h * 0.88);
        }
        ctx.lineTo(w + 50, h);
        ctx.closePath();
        ctx.fill();
    }

    ctx.restore();

    // ============================================================
    // 4. ATMOSPHERIC EFFECTS: 높이에 따른 대기 효과
    // ============================================================
    // 높이 올라갈수록 공기가 희박해지는 느낌 (약간의 안개)
    if (altitude > 100) {
        const hazeAlpha = clamp((altitude - 100) / 400, 0, 0.3);
        const hazeGrad = ctx.createLinearGradient(0, h * 0.5, 0, h);
        hazeGrad.addColorStop(0, `rgba(200, 180, 150, ${hazeAlpha})`);
        hazeGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = hazeGrad;
        ctx.fillRect(0, h * 0.5, w, h * 0.5);
    }
}

// 스케일 적용된 피라미드
function drawScaledPyramid(ctx, x, baseY, width, height, colorLight, colorDark) {
    if (x < -width || x > ctx.canvas.width + width) return;
    if (height < 5) return; // 너무 작으면 그리지 않음

    // 어두운 면
    ctx.fillStyle = colorDark;
    ctx.beginPath();
    ctx.moveTo(x - width / 2, baseY);
    ctx.lineTo(x, baseY - height);
    ctx.lineTo(x + width / 2, baseY);
    ctx.closePath();
    ctx.fill();

    // 밝은 면
    ctx.fillStyle = colorLight;
    ctx.beginPath();
    ctx.moveTo(x - width / 2, baseY);
    ctx.lineTo(x, baseY - height);
    ctx.lineTo(x, baseY);
    ctx.closePath();
    ctx.fill();
}

// 스케일 적용된 스핑크스
function drawScaledSphinx(ctx, x, y, scale) {
    if (x < -100 || x > ctx.canvas.width + 100) return;
    if (scale < 0.1) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // 몸통 (누운 사자)
    ctx.fillStyle = '#c4a35a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 80, 30, 0, 0, Math.PI * 2);
    ctx.fill();

    // 머리
    ctx.fillStyle = '#d4b06a';
    ctx.beginPath();
    ctx.arc(-50, -30, 25, 0, Math.PI * 2);
    ctx.fill();

    // 머리 장식
    ctx.fillStyle = '#1e3a5f';
    ctx.beginPath();
    ctx.moveTo(-70, -35);
    ctx.lineTo(-50, -60);
    ctx.lineTo(-30, -35);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}



// --- Phase 1: Ground ---
function drawDesertPhaseGround(ctx, camX, camY, w, h, t) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#0a3d62');
    skyGrad.addColorStop(1, '#fad390');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Parallax
    const p1 = (camX * 0.05) % w;
    const p2 = (camX * 0.15) % w;
    const p3 = (camX * 0.3) % w;

    // Transitioning Y: Objects sink as we climb
    const sink = t * h * 0.5;

    drawArtisticPyramid(ctx, (w * 0.2 + p1 + w) % w, h + sink, 400, 350, '#535c68', '#2f3542');
    drawCalculusDunes(ctx, p2, h + sink, w, '#cd6133', 100, 0.003);

    const pSphinx = (camX * 0.4) % (w * 2);
    drawArtisticSphinx(ctx, (w * 0.5 + pSphinx + w * 2) % (w * 2) - w * 0.5, h * 0.82 + sink, 0.9);
    // New desert elements
    drawOasis(ctx, (w * 0.6 + camX * 0.2) % w, h - 80, 1.0);
    drawCamels(ctx, camX, camY, w, h, altitude);
    drawHieroglyphs(ctx, camX, w, h);

    drawCalculusDunes(ctx, p3, h + 20 + sink, w + 200, '#e58e26', 150, 0.005);
}

// --- Phase 2: Ascent (Scaling the side) ---
function drawDesertPhaseAscent(ctx, camX, camY, w, h, t, altitude) {
    // Darker Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#051937');
    skyGrad.addColorStop(1, '#004d7a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Draw Giant Pyramid Surface
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(0, 0, w, h);

    // Stone Brick Pattern Parallax
    const brickW = 120;
    const brickH = 60;
    const offX = (camX * 0.8) % brickW;
    const offY = (altitude * 5) % brickH; // Vertical movement feel

    ctx.strokeStyle = 'rgba(255,215,0,0.1)';
    ctx.lineWidth = 2;
    for (let i = -2; i < w / brickW + 2; i++) {
        for (let j = -2; j < h / brickH + 2; j++) {
            let px = i * brickW + offX;
            let py = j * brickH + offY;
            ctx.strokeRect(px, py, brickW, brickH);
            // Texture inside
            if ((i + j) % 7 === 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.02)';
                ctx.fillRect(px + 5, py + 5, brickW - 10, brickH - 10);
            }
        }
    }

    // Atmospheric "Looking Down" Fading at bottom
    const fade = ctx.createLinearGradient(0, h * 0.7, 0, h);
    fade.addColorStop(0, 'transparent');
    fade.addColorStop(1, 'rgba(250, 211, 144, ' + (1 - t) + ')');
    ctx.fillStyle = fade;
    ctx.fillRect(0, h * 0.7, w, h * 0.3);
}

// --- Phase 3: Summit ---
function drawDesertPhaseSummit(ctx, camX, camY, w, h, t, altitude) {
    // Epic Twilight Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#2c3e50');
    skyGrad.addColorStop(1, '#000000');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // The Golden Point (Apex)
    const apexY = h * 0.4 + (1 - t) * h * 0.3;
    const pX = (camX * 0.1) % w;

    // Glowing Capstone
    const grad = ctx.createRadialGradient(w / 2, apexY, 0, w / 2, apexY, w * 0.8);
    grad.addColorStop(0, 'rgba(255, 215, 0, 0.2)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(w / 2, apexY, w * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Draw the actual point below stairs
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 200, h);
    ctx.lineTo(w / 2, apexY);
    ctx.lineTo(w / 2 + 200, h);
    ctx.closePath();
    ctx.fill();

    // Distant Earth/Desert Curve at bottom
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(w / 2, h + 100, w * 1.5, 300, 0, 0, Math.PI * 2);
    ctx.fill();
}

// --- Phase 4: Celestial ---
function drawDesertPhaseCelestial(ctx, camX, camY, w, h, t, altitude) {
    // Space Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // Nebulae (Artistic Clouds)
    const time = Date.now() * 0.0005;
    for (let i = 0; i < 3; i++) {
        let x = w * (0.5 + Math.sin(time + i) * 0.3);
        let y = h * (0.4 + Math.cos(time * 0.8 + i) * 0.2);
        const grad = ctx.createRadialGradient(x, y, 0, x, y, 400);
        grad.addColorStop(0, i === 0 ? 'rgba(155, 89, 182, 0.1)' : 'rgba(41, 128, 185, 0.1)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, 400, 0, Math.PI * 2);
        ctx.fill();
    }

    // Pharaoh Constellations (Golden Lines)
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.lineWidth = 1;
    const cx = w / 2;
    const cy = h / 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        let ang = (i * Math.PI * 2 / 6) + time * 0.1;
        ctx.moveTo(cx + Math.cos(ang) * 200, cy + Math.sin(ang) * 200);
        ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // Twinkling Stars
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 100; i++) {
        let rx = (Math.sin(i * 99) * 0.5 + 0.5) * w;
        let ry = (Math.cos(i * 44) * 0.5 + 0.5) * h;
        let s = (Math.sin(time * 2 + i) * 0.5 + 0.5) * 2;
        ctx.fillRect(rx, ry, s, s);
    }
}

// --- REVERSE MODE: The Hidden Tomb ---
function drawDesertPhaseTomb(ctx, camX, camY, w, h) {
    // Deep Dark Walls
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    // Wall Hieroglyphs Pattern
    const pX = (camX * 1.2) % 400;
    const pY = (score * 5) % 400;

    ctx.fillStyle = 'rgba(255, 215, 0, 0.05)';
    ctx.font = '40px Arial';
    for (let i = -1; i < w / 200 + 1; i++) {
        for (let j = -1; j < h / 200 + 1; j++) {
            ctx.fillText('𓀀 𓋹 𓅓', i * 200 + pX, j * 200 + pY);
        }
    }

    // Torch Lighting (Flickering)
    const flicker = Math.sin(Date.now() * 0.01) * 20;
    const torchX = w * 0.5;
    const torchY = h * 0.5;
    const light = ctx.createRadialGradient(torchX, torchY, 50, torchX, torchY, 600 + flicker);
    light.addColorStop(0, 'rgba(255, 100, 0, 0.2)');
    light.addColorStop(0.5, 'rgba(100, 50, 0, 0.05)');
    light.addColorStop(1, 'transparent');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, w, h);

    // Gold Piles at the edges
    drawTombGold(ctx, 0, h, 300, 200);
    drawTombGold(ctx, w, h, -300, 200);
}

function drawTombGold(ctx, x, y, width, height) {
    ctx.fillStyle = '#d4af37'; // Antique Gold
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + width * 0.5, y - height, x + width, y);
    ctx.closePath();
    ctx.fill();
    // Shiny bits
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = 0; i < 10; i++) {
        ctx.fillRect(x + Math.random() * width, y - Math.random() * height * 0.5, 4, 4);
    }
}

function drawArtisticPyramid(ctx, x, y, width, height, colorLight, colorDark) {
    if (x < -width || x > ctx.canvas.width + width) return;
    const baseY = y * 0.85;

    // Dark side
    ctx.fillStyle = colorDark;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x + width / 2, baseY - height);
    ctx.lineTo(x + width, baseY);
    ctx.closePath();
    ctx.fill();

    // Light side
    ctx.fillStyle = colorLight;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x + width / 2, baseY - height);
    ctx.lineTo(x + width / 2, baseY);
    ctx.closePath();
    ctx.fill();

    // Golden Capstone
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.moveTo(x + width / 2 - 15, baseY - height + 30);
    ctx.lineTo(x + width / 2, baseY - height);
    ctx.lineTo(x + width / 2 + 15, baseY - height + 30);
    ctx.closePath();
    ctx.fill();
}

function drawArtisticDunes(ctx, startX, bottomY, width, color, waveHeight, waveFreq) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(startX - 200, bottomY);
    const endX = startX + width + 400;
    for (let x = startX - 200; x < endX; x += 50) {
        const y = bottomY * 0.85 - Math.sin(x * 0.005) * waveHeight + Math.cos(x * 0.02) * (waveHeight * 0.3);
        ctx.lineTo(x, y);
    }
    ctx.lineTo(endX, bottomY);
    ctx.lineTo(startX - 200, bottomY);
    ctx.closePath();
    ctx.fill();
}

function drawArtisticSphinx(ctx, x, y, scale = 1) {
    if (x < -300 || x > ctx.canvas.width + 300) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Body
    ctx.fillStyle = '#b3844f';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(20, -40, 90, -40, 110, 0);
    ctx.lineTo(130, 0);
    ctx.lineTo(130, 40);
    ctx.lineTo(-20, 40);
    ctx.closePath();
    ctx.fill();

    // Paws
    ctx.fillStyle = '#d6a86d';
    ctx.fillRect(-20, 20, 50, 20);

    // Head
    ctx.fillStyle = '#d6a86d';
    ctx.beginPath();
    ctx.arc(0, -35, 28, 0, Math.PI * 2);
    ctx.fill();

    // Nemes
    ctx.fillStyle = '#273c75';
    ctx.beginPath();
    ctx.moveTo(-28, -45);
    ctx.lineTo(28, -45);
    ctx.lineTo(40, 15);
    ctx.lineTo(-40, 15);
    ctx.closePath();
    ctx.fill();

    // Face Detail
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.arc(0, -33, 18, 0, Math.PI, false);
    ctx.fill();

    // Cobra
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(0, -50, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// ============================================================
// Helper Functions (Global Scope)
// ============================================================

// New helper: Oasis with palm trees
function drawOasis(ctx, x, y, scale) {
    if (x < -200 || x > ctx.canvas.width + 200) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    // Water rectangle
    ctx.fillStyle = '#3b83bd';
    ctx.fillRect(-80, -20, 160, 40);
    // Palm trunk
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(-5, -20, 10, 30);
    // Palm leaves
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.bezierCurveTo(-30, -50, -30, -70, 0, -90);
    ctx.bezierCurveTo(30, -70, 30, -50, 0, -20);
    ctx.fill();
    ctx.restore();
}

// New helper: Camels moving slowly
function drawCamels(ctx, camX, camY, w, h, altitude) {
    const count = 3;
    for (let i = 0; i < count; i++) {
        const baseX = ((camX * 0.03) + i * 200) % w;
        const baseY = h - 50 - (altitude * 0.2) % 30;
        ctx.save();
        ctx.translate(baseX, baseY);
        ctx.scale(0.6, 0.6);
        ctx.fillStyle = '#c2b280';
        // Body
        ctx.beginPath();
        ctx.ellipse(0, 0, 30, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        // Humps
        ctx.beginPath();
        ctx.arc(-15, -10, 8, 0, Math.PI * 2);
        ctx.arc(15, -10, 8, 0, Math.PI * 2);
        ctx.fill();
        // Legs
        ctx.fillRect(-20, 10, 8, 12);
        ctx.fillRect(12, 10, 8, 12);
        ctx.restore();
    }
}

// New helper: Hieroglyphic wall pattern
function drawHieroglyphs(ctx, camX, w, h) {
    const spacing = 200;
    const offsetX = (camX * 0.5) % spacing;
    ctx.fillStyle = 'rgba(255,215,0,0.07)';
    ctx.font = '30px serif';
    const symbols = ['𓀀', '𓋹', '𓅓'];
    for (let x = -spacing; x < w + spacing; x += spacing) {
        for (let y = h * 0.3; y < h; y += spacing) {
            const sym = symbols[(Math.floor(x / spacing) + Math.floor(y / spacing)) % symbols.length];
            ctx.fillText(sym, x + offsetX, y);
        }
    }
}

// ============================================================
// WINTER WONDERLAND MAP - Arctic Theme with Aurora
// ============================================================
function initSnowParticles() {
    if (snowParticles.length === 0) {
        for (let i = 0; i < 150; i++) {
            snowParticles.push({
                x: Math.random() * 2000,
                y: Math.random() * 2000,
                size: 2 + Math.random() * 4,
                speed: 1 + Math.random() * 2,
                drift: (Math.random() - 0.5) * 0.5,
                opacity: 0.5 + Math.random() * 0.5
            });
        }
    }
}

function drawWinterBackground(camX, camY, score, w, h) {
    initSnowParticles();

    // ============================================================
    // 개연성 있는 수직 연속성:
    // - 펭귄, 이글루, 눈산이 항상 아래에 보이며 점점 멀어짐 (작아짐)
    // - 하늘이 점점 어두워지며 낮 → 저녁 → 밤으로 전환
    // - 오로라가 서서히 나타남 (밤하늘에서 자연스럽게)
    // ============================================================

    const altitude = Math.max(0, score);
    const time = Date.now() * 0.001;

    // ============================================================
    // 1. SKY: 연속적으로 변하는 하늘 (맑은 낮 → 저녁 → 밤)
    // ============================================================
    const skyProgress = clamp(altitude / 500, 0, 1); // 500에서 완전한 밤

    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    // 낮 → 저녁 → 밤 그라데이션
    const topColor = lerpColor(
        lerpColor('#87ceeb', '#5d6d7e', clamp(skyProgress * 2, 0, 1)),
        '#0a0a23',
        clamp((skyProgress - 0.5) * 2, 0, 1)
    );
    const midColor = lerpColor(
        lerpColor('#b0e0e6', '#8e99a4', clamp(skyProgress * 2, 0, 1)),
        '#1a1a3e',
        clamp((skyProgress - 0.5) * 2, 0, 1)
    );
    const botColor = lerpColor('#e0f7fa', '#2d3436', skyProgress);

    skyGrad.addColorStop(0, topColor);
    skyGrad.addColorStop(0.5, midColor);
    skyGrad.addColorStop(1, botColor);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // ============================================================
    // 2. STARS & AURORA: 밤이 되면 별과 오로라 출현
    // ============================================================
    const nightOpacity = clamp((skyProgress - 0.3) * 1.5, 0, 1);
    if (nightOpacity > 0) {
        ctx.save();
        ctx.globalAlpha = nightOpacity;

        // 별들
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 100; i++) {
            const sx = (Math.sin(i * 99) * 0.5 + 0.5) * w;
            const sy = (Math.cos(i * 44) * 0.35) * h;
            const twinkle = (Math.sin(time * 3 + i) * 0.5 + 0.5) * 2.5 + 0.5;
            ctx.beginPath();
            ctx.arc(sx, sy, twinkle, 0, Math.PI * 2);
            ctx.fill();
        }

        // 오로라 (밤이 깊어질수록 강해짐)
        const auroraIntensity = clamp((skyProgress - 0.5) * 2, 0, 1);
        if (auroraIntensity > 0) {
            drawAuroraBorealis(ctx, w, h, time, auroraIntensity * nightOpacity);
        }

        ctx.restore();
    }

    // ============================================================
    // 3. GROUND ELEMENTS: 항상 아래에 보이며 점점 작아짐/멀어짐
    // ============================================================
    // 스케일: 1.0 → 0.15 (멀어짐)
    const groundScale = lerp(1.0, 0.15, clamp(altitude / 400, 0, 1));
    // Y 위치: 화면 아래 → 더 아래로
    const groundY = h + altitude * 1.2;
    // 투명도: 가까울때 1.0, 멀어질수록 살짝 흐려짐
    const groundAlpha = lerp(1.0, 0.5, clamp(altitude / 500, 0, 1));

    ctx.save();
    ctx.globalAlpha = groundAlpha;

    const p1 = (camX * 0.05) % w;
    const p2 = (camX * 0.08) % w;

    // 먼 산 (항상 보이는 배경) - 높이에 따라 내려감
    const mountainY = lerp(h * 0.4, h * 0.75, clamp(altitude / 300, 0, 1));
    const mountainColor = lerpColor('#a8d4e6', '#5d6d7e', skyProgress);

    ctx.fillStyle = mountainColor;
    ctx.beginPath();
    ctx.moveTo(-100, h);
    for (let x = -100; x < w + 200; x += 120) {
        const peakY = mountainY + Math.sin((x + p1) * 0.008) * 60 * groundScale;
        ctx.lineTo(x + 60, peakY);
        ctx.lineTo(x + 120, mountainY + 30 * groundScale);
    }
    ctx.lineTo(w + 100, h);
    ctx.closePath();
    ctx.fill();

    // 산 위의 눈
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-100, mountainY + 20 * groundScale);
    for (let x = -100; x < w + 200; x += 120) {
        const peakY = mountainY + Math.sin((x + p1) * 0.008) * 60 * groundScale;
        ctx.lineTo(x + 60, peakY);
        ctx.lineTo(x + 80, peakY + 20 * groundScale);
    }
    ctx.lineTo(w + 100, mountainY + 20 * groundScale);
    ctx.closePath();
    ctx.fill();

    // 이글루들 (원근감 적용)
    if (groundScale > 0.15) {
        const iglooBaseY = groundY;
        const iglooOffset = (camX * 0.15) % (w * 2);

        // 큰 이글루
        drawScaledIgloo(ctx,
            (w * 0.25 + iglooOffset) % w,
            iglooBaseY,
            groundScale * 0.9
        );

        // 작은 이글루
        drawScaledIgloo(ctx,
            (w * 0.7 + iglooOffset * 0.7) % w,
            iglooBaseY,
            groundScale * 0.6
        );
    }

    // 펭귄들 (원근감 적용)
    if (groundScale > 0.2) {
        const penguinOffset = (camX * 0.2) % (w * 3);
        for (let i = 0; i < 5; i++) {
            const px = (w * 0.12 * i + penguinOffset + w) % w;
            const py = groundY - 10 * groundScale;
            const waddle = Math.sin(time * 3 + i) * 2;
            drawScaledPenguin(ctx, px + waddle, py, groundScale * (0.5 + (i % 3) * 0.15));
        }
    }

    // Polar Bears (New addition)
    if (groundScale > 0.25) {
        const bearOffset = (camX * 0.08) % (w * 4);
        for (let i = 0; i < 2; i++) {
            // Place them sparsely
            const bx = (w * 0.4 * i + bearOffset + w * 2.5) % w;
            const by = groundY - 5 * groundScale;
            // Slow breathing animation
            const breathe = Math.sin(time * 1 + i) * 0.5;
            drawScaledPolarBear(ctx, bx, by + breathe, groundScale * 0.8);
        }
    }

    // 전경 눈밭 (가까운 눈)
    if (altitude < 200) {
        const foregroundAlpha = clamp(1 - altitude / 200, 0, 1);
        ctx.globalAlpha = groundAlpha * foregroundAlpha;
        ctx.fillStyle = '#f0f8ff';
        ctx.fillRect(0, h * 0.88, w, h * 0.12);

        // 눈 반짝임
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        for (let i = 0; i < 20; i++) {
            const sx = (i * 137 + camX * 0.5) % w;
            const sy = h * 0.89 + (i * 7) % 40;
            const sparkle = Math.sin(time * 5 + i) * 0.5 + 0.5;
            ctx.globalAlpha = sparkle * foregroundAlpha;
            ctx.fillRect(sx, sy, 3, 3);
        }
    }

    ctx.restore();

    // ============================================================
    // 4. ATMOSPHERIC EFFECTS: 높이에 따른 대기 효과
    // ============================================================
    // 높이 올라갈수록 찬 공기 느낌
    if (altitude > 100) {
        const hazeAlpha = clamp((altitude - 100) / 400, 0, 0.2);
        const hazeGrad = ctx.createLinearGradient(0, h * 0.6, 0, h);
        hazeGrad.addColorStop(0, `rgba(200, 220, 255, ${hazeAlpha})`);
        hazeGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = hazeGrad;
        ctx.fillRect(0, h * 0.6, w, h * 0.4);
    }

    // ============================================================
    // ALWAYS: Falling Snow (눈이 항상 내림)
    // ============================================================
    drawFallingSnow(ctx, camX, camY, w, h, score);
}

// ============================================================
// Falling Snow Effect for Winter Map
// ============================================================
function drawFallingSnow(ctx, camX, camY, w, h, score) {
    const snowParticles = window.snowParticles || [];
    const time = Date.now() * 0.001;

    ctx.fillStyle = '#ffffff';
    snowParticles.forEach((p, i) => {
        // Update position
        p.y += p.speed;
        p.x += p.drift + Math.sin(time + i) * 0.5;

        // Wrap around
        if (p.y > h) {
            p.y = -10;
            p.x = Math.random() * w;
        }
        if (p.x > w) p.x = 0;
        if (p.x < 0) p.x = w;

        // Draw snowflake
        ctx.globalAlpha = p.opacity * (1 - score / 1000);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

// 스케일 적용된 이글루
function drawScaledIgloo(ctx, x, y, scale) {
    if (x < -100 || x > ctx.canvas.width + 100) return;
    if (scale < 0.1) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // 돔
    ctx.fillStyle = '#f5f5f5';
    ctx.beginPath();
    ctx.arc(0, 0, 60, Math.PI, 0, false);
    ctx.lineTo(60, 0);
    ctx.lineTo(-60, 0);
    ctx.closePath();
    ctx.fill();

    // 얼음 블록 라인
    ctx.strokeStyle = 'rgba(173, 216, 230, 0.5)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, 60, Math.PI + (i * 0.15), -i * 0.15, false);
        ctx.stroke();
    }

    // 입구
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.arc(0, 0, 20, Math.PI, 0, false);
    ctx.lineTo(20, 0);
    ctx.lineTo(-20, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

// 스케일 적용된 펭귄
function drawScaledPenguin(ctx, x, y, scale) {
    if (x < -50 || x > ctx.canvas.width + 50) return;
    if (scale < 0.1) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // 몸통 (검은색)
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    // 배 (흰색)
    ctx.fillStyle = '#f8f9fa';
    ctx.beginPath();
    ctx.ellipse(0, 5, 12, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // 부리 (주황색)
    ctx.fillStyle = '#ff9500';
    ctx.beginPath();
    ctx.moveTo(-5, -15);
    ctx.lineTo(0, -10);
    ctx.lineTo(5, -15);
    ctx.closePath();
    ctx.fill();

    // 눈
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-6, -18, 4, 0, Math.PI * 2);
    ctx.arc(6, -18, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-6, -18, 2, 0, Math.PI * 2);
    ctx.arc(6, -18, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}



// --- Phase 1: Ground Level (Penguins, Igloos) ---
function drawWinterPhaseGround(ctx, camX, camY, w, h, score) {
    // Sky gradient - cold winter day
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#87ceeb'); // Light blue top
    skyGrad.addColorStop(0.5, '#b0e0e6'); // Powder blue
    skyGrad.addColorStop(1, '#e0f7fa'); // Ice white bottom
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Distant mountains
    const mountainOffset = (camX * 0.05) % w;
    ctx.fillStyle = '#a8d4e6';
    ctx.beginPath();
    ctx.moveTo(-mountainOffset - 100, h);
    for (let x = -mountainOffset - 100; x < w + 200; x += 150) {
        const peakY = h * 0.5 + Math.sin(x * 0.008) * 80;
        ctx.lineTo(x + 75, peakY);
        ctx.lineTo(x + 150, h * 0.65);
    }
    ctx.lineTo(w + 100, h);
    ctx.closePath();
    ctx.fill();

    // Snow caps on mountains
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-mountainOffset - 100, h * 0.55);
    for (let x = -mountainOffset - 100; x < w + 200; x += 150) {
        const peakY = h * 0.5 + Math.sin(x * 0.008) * 80;
        ctx.lineTo(x + 75, peakY);
        ctx.lineTo(x + 100, peakY + 30);
    }
    ctx.lineTo(w + 100, h * 0.55);
    ctx.closePath();
    ctx.fill();

    // Draw Igloos
    const iglooOffset = (camX * 0.15) % (w * 2);
    drawIgloo(ctx, (w * 0.2 + iglooOffset + w * 2) % (w * 2) - w * 0.3, h * 0.78, 1.0);
    drawIgloo(ctx, (w * 0.7 + iglooOffset + w * 2) % (w * 2) - w * 0.3, h * 0.80, 0.7);

    // Draw Penguins
    const penguinOffset = (camX * 0.2) % (w * 3);
    const time = Date.now() * 0.003;
    for (let i = 0; i < 5; i++) {
        const px = (w * 0.15 * i + penguinOffset + w * 3) % (w * 3) - w * 0.5;
        const py = h * 0.82 + Math.sin(time + i) * 3;
        drawPenguin(ctx, px, py, 0.6 + (i % 3) * 0.15);
    }

    // Ground snow
    ctx.fillStyle = '#f0f8ff';
    ctx.fillRect(0, h * 0.85, w, h * 0.15);

    // Snow sparkles
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 30; i++) {
        const sx = (i * 137 + camX * 0.5) % w;
        const sy = h * 0.86 + (i * 7) % 50;
        const sparkle = Math.sin(Date.now() * 0.01 + i) * 0.5 + 0.5;
        ctx.globalAlpha = sparkle;
        ctx.fillRect(sx, sy, 3, 3);
    }
    ctx.globalAlpha = 1;
}

// --- Phase 2: Mountain Climb (Pine Trees, Heavy Snow) ---
function drawWinterPhaseMountain(ctx, camX, camY, w, h, score) {
    const t = (score - 200) / 300;

    // Darker sky as we climb
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, lerpColor('#87ceeb', '#2c3e50', t));
    skyGrad.addColorStop(1, lerpColor('#e0f7fa', '#5d6d7e', t));
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Big snowy peaks
    const peakOffset = (camX * 0.03) % w;
    ctx.fillStyle = '#d5dbdb';
    ctx.beginPath();
    ctx.moveTo(-peakOffset - 200, h);
    for (let x = -peakOffset - 200; x < w + 300; x += 200) {
        const peakY = h * 0.3 + Math.sin(x * 0.005) * 100;
        ctx.lineTo(x + 100, peakY);
        ctx.lineTo(x + 200, h * 0.5);
    }
    ctx.lineTo(w + 200, h);
    ctx.closePath();
    ctx.fill();

    // Snow on peaks
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-peakOffset - 200, h * 0.35);
    for (let x = -peakOffset - 200; x < w + 300; x += 200) {
        const peakY = h * 0.3 + Math.sin(x * 0.005) * 100;
        ctx.lineTo(x + 100, peakY);
        ctx.lineTo(x + 130, peakY + 40);
    }
    ctx.lineTo(w + 200, h * 0.35);
    ctx.closePath();
    ctx.fill();

    // Pine trees
    const treeOffset = (camX * 0.1) % (w * 2);
    for (let i = 0; i < 8; i++) {
        const tx = (w * 0.12 * i + treeOffset + w * 2) % (w * 2) - w * 0.3;
        const ty = h * 0.7 + (i % 3) * 30;
        drawPineTree(ctx, tx, ty, 0.8 + (i % 4) * 0.2);
    }

    // Ground
    ctx.fillStyle = '#ecf0f1';
    ctx.fillRect(0, h * 0.8, w, h * 0.2);
}

// --- Phase 3: Aurora Borealis (Stars, Northern Lights) ---
function drawWinterPhaseAurora(ctx, camX, camY, w, h, score) {
    const t = Math.min(1, (score - 500) / 300);
    const time = Date.now() * 0.001;

    // Night sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#0a0a23');
    skyGrad.addColorStop(0.5, '#1a1a3e');
    skyGrad.addColorStop(1, '#2d3436');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 100; i++) {
        const sx = (Math.sin(i * 99) * 0.5 + 0.5) * w;
        const sy = (Math.cos(i * 44) * 0.5 + 0.3) * h;
        const twinkle = (Math.sin(time * 3 + i) * 0.5 + 0.5) * 3;
        ctx.beginPath();
        ctx.arc(sx, sy, twinkle, 0, Math.PI * 2);
        ctx.fill();
    }

    // AURORA BOREALIS - The main attraction!
    drawAuroraBorealis(ctx, w, h, time, t);

    // Distant snowy ground
    ctx.fillStyle = '#1a252f';
    ctx.fillRect(0, h * 0.85, w, h * 0.15);

    // Snow glow from below
    const glowGrad = ctx.createLinearGradient(0, h * 0.85, 0, h);
    glowGrad.addColorStop(0, 'rgba(100, 200, 255, 0.1)');
    glowGrad.addColorStop(1, 'rgba(100, 200, 255, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, h * 0.85, w, h * 0.15);
}

// --- Aurora Borealis Effect ---
function drawAuroraBorealis(ctx, w, h, time, intensity) {
    const colors = [
        'rgba(0, 255, 127, 0.15)',   // Green
        'rgba(64, 224, 208, 0.12)',  // Turquoise
        'rgba(138, 43, 226, 0.10)',  // Purple
        'rgba(0, 191, 255, 0.12)'    // Deep sky blue
    ];

    for (let layer = 0; layer < 4; layer++) {
        ctx.beginPath();
        ctx.moveTo(0, h * 0.2);

        for (let x = 0; x <= w; x += 10) {
            const wave1 = Math.sin(x * 0.01 + time * 0.5 + layer) * 50;
            const wave2 = Math.sin(x * 0.02 + time * 0.3 + layer * 2) * 30;
            const wave3 = Math.sin(x * 0.005 + time * 0.8) * 80;
            const y = h * 0.25 + wave1 + wave2 + wave3 + layer * 40;
            ctx.lineTo(x, y);
        }

        ctx.lineTo(w, h * 0.6);
        ctx.lineTo(0, h * 0.6);
        ctx.closePath();

        ctx.fillStyle = colors[layer];
        ctx.fill();
    }

    // Shimmering particles in aurora
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (let i = 0; i < 30; i++) {
        const px = (Math.sin(i * 77 + time) * 0.5 + 0.5) * w;
        const py = h * 0.2 + Math.sin(time * 2 + i) * 100 + i * 5;
        const size = Math.sin(time * 5 + i) * 2 + 2;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// --- Falling Snow ---
function drawFallingSnow(ctx, camX, camY, w, h, score) {
    const time = Date.now() * 0.001;
    const intensity = score > 200 ? 1.5 : 1.0; // Heavier snow at altitude

    ctx.fillStyle = '#ffffff';
    snowParticles.forEach((s, i) => {
        // Update position
        s.y += s.speed * intensity;
        s.x += s.drift + Math.sin(time + i) * 0.5;

        // Wrap around
        if (s.y > h + 10) { s.y = -10; s.x = Math.random() * w; }
        if (s.x < -10) s.x = w + 10;
        if (s.x > w + 10) s.x = -10;

        ctx.globalAlpha = s.opacity;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

// --- Helper: Draw Igloo ---
function drawIgloo(ctx, x, y, scale) {
    if (x < -200 || x > ctx.canvas.width + 200) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Dome
    ctx.fillStyle = '#f5f5f5';
    ctx.beginPath();
    ctx.arc(0, 0, 60, Math.PI, 0, false);
    ctx.lineTo(60, 0);
    ctx.lineTo(-60, 0);
    ctx.closePath();
    ctx.fill();

    // Ice block lines
    ctx.strokeStyle = 'rgba(173, 216, 230, 0.5)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, 60, Math.PI + (i * 0.15), -i * 0.15, false);
        ctx.stroke();
    }

    // Entrance
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.arc(0, 0, 20, Math.PI, 0, false);
    ctx.lineTo(20, 0);
    ctx.lineTo(-20, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

// --- Helper: Draw Penguin ---
function drawPenguin(ctx, x, y, scale) {
    if (x < -100 || x > ctx.canvas.width + 100) return;

    const time = Date.now() * 0.005;
    const waddle = Math.sin(time + x) * 3;

    ctx.save();
    ctx.translate(x + waddle, y);
    ctx.scale(scale, scale);

    // Body (black)
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly (white)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 5, 12, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.arc(0, -25, 14, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-5, -27, 4, 0, Math.PI * 2);
    ctx.arc(5, -27, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(-5, -27, 2, 0, Math.PI * 2);
    ctx.arc(5, -27, 2, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(-5, -20);
    ctx.lineTo(5, -20);
    ctx.closePath();
    ctx.fill();

    // Feet
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(-12, 20, 8, 5);
    ctx.fillRect(4, 20, 8, 5);

    ctx.restore();
}

// --- Helper: Draw Pine Tree ---
function drawPineTree(ctx, x, y, scale) {
    if (x < -100 || x > ctx.canvas.width + 100) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Trunk
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(-8, 0, 16, 30);

    // Snowy layers
    for (let i = 0; i < 4; i++) {
        const layerY = -i * 25;
        const layerWidth = 50 - i * 10;

        // Green part
        ctx.fillStyle = '#1b5e20';
        ctx.beginPath();
        ctx.moveTo(0, layerY - 35);
        ctx.lineTo(-layerWidth, layerY);
        ctx.lineTo(layerWidth, layerY);
        ctx.closePath();
        ctx.fill();

        // Snow on top
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, layerY - 35);
        ctx.lineTo(-layerWidth * 0.6, layerY - 15);
        ctx.lineTo(layerWidth * 0.6, layerY - 15);
        ctx.closePath();
        ctx.fill();
    }

    ctx.restore();
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    time = Date.now() * 0.001;

    // Camera & Player Interpolation (버터 스무스)
    const target = window.gameState.stairs[window.gameState.score] || { x: 0, y: 0 };
    if (window.gameState.stairs.length > 0 && !isFalling) {
        // 매우 부드러운 이동: 낮은 lerp = 더 부드러움
        const smoothness = 0.03; // 극강 버터 스무스
        window.gameState.renderPlayer.x += (target.x - window.gameState.renderPlayer.x) * smoothness;
        window.gameState.renderPlayer.y += (target.y - window.gameState.renderPlayer.y) * smoothness;
    }
    const camX = -window.gameState.renderPlayer.x * STAIR_W + canvas.width / 2;
    const offset = window.gameState.isReverseMode ? 0 : 100; // Center camera for Reverse Mode
    const camY = window.gameState.renderPlayer.y * STAIR_H + canvas.height / 2 + offset;

    // Background
    if (typeof window.currentMap !== 'undefined' && window.currentMap === 'map_desert') {
        drawDesertBackgroundArtistic(camX, camY, window.gameState.score, canvas.width, canvas.height);
    } else if (typeof window.currentMap !== 'undefined' && window.currentMap === 'map_winter') {
        drawWinterBackground(camX, camY, window.gameState.score, canvas.width, canvas.height);
    } else {
        drawBackground(camX, camY);
    }

    // Stairs
    window.gameState.stairs.forEach((s, i) => {
        if (i < window.gameState.score - 5 || i > window.gameState.score + 18) return;
        const sx = camX + s.x * STAIR_W;
        const sy = camY - s.y * STAIR_H;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(sx - STAIR_W / 2 + 8, sy + 8, STAIR_W, STAIR_H);

        // Draw Stair Body
        drawStair(ctx, sx, sy, currentStairSkin, i);

        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(sx - STAIR_W / 2, sy, STAIR_W, 4);

        // Coin / Mineral / Crown
        if (s.hasCoin) {
            // ============================================================
            // PHARAOH'S CROWN (파라오의 왕관) - 특별 아이템
            // ============================================================
            if (s.hasCrown) {
                ctx.save();
                ctx.translate(sx, sy - 50); // 더 높이 올림

                // 빛나는 아우라 (더 큰 펄스)
                const pulse = 1.2 + Math.sin(time * 5) * 0.15;
                ctx.scale(pulse * 1.8, pulse * 1.8); // 1.8배 크기 증가

                // 황금 빛 효과 (더 강하게)
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 40 + Math.sin(time * 8) * 20;

                // 왕관 베이스 (황금) - 더 크게
                ctx.fillStyle = '#ffd700';
                ctx.beginPath();
                ctx.moveTo(-22, 12);
                ctx.lineTo(-22, 0);
                ctx.lineTo(-15, -12);
                ctx.lineTo(-7, 0);
                ctx.lineTo(0, -20);
                ctx.lineTo(7, 0);
                ctx.lineTo(15, -12);
                ctx.lineTo(22, 0);
                ctx.lineTo(22, 12);
                ctx.closePath();
                ctx.fill();

                // 왕관 테두리 (더 두껍게)
                ctx.strokeStyle = '#b8860b';
                ctx.lineWidth = 3;
                ctx.stroke();

                // 보석들 (루비, 사파이어, 에메랄드) - 더 크게
                ctx.shadowBlur = 15;

                // 중앙 루비 (더 크게)
                ctx.shadowColor = '#e74c3c';
                ctx.fillStyle = '#e74c3c';
                ctx.beginPath();
                ctx.arc(0, -10, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#c0392b';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // 좌측 사파이어 (더 크게)
                ctx.shadowColor = '#3498db';
                ctx.fillStyle = '#3498db';
                ctx.beginPath();
                ctx.arc(-12, -3, 4, 0, Math.PI * 2);
                ctx.fill();

                // 우측 에메랄드 (더 크게)
                ctx.shadowColor = '#2ecc71';
                ctx.fillStyle = '#2ecc71';
                ctx.beginPath();
                ctx.arc(12, -3, 4, 0, Math.PI * 2);
                ctx.fill();

                ctx.shadowBlur = 0;

                // 하이라이트 (반짝임) - 더 크게
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.beginPath();
                ctx.arc(-4, -12, 2.5, 0, Math.PI * 2);
                ctx.fill();

                // 회전하는 스파클 파티클 (더 많이, 더 크게)
                for (let p = 0; p < 6; p++) {
                    const angle = time * 3 + (p * Math.PI / 3);
                    const dist = 35 + Math.sin(time * 5 + p) * 8;
                    const px = Math.cos(angle) * dist;
                    const py = Math.sin(angle) * dist * 0.4;

                    ctx.fillStyle = `rgba(255, 215, 0, ${0.7 + Math.sin(time * 4 + p) * 0.3})`;
                    ctx.beginPath();
                    ctx.arc(px, py - 5, 3, 0, Math.PI * 2);
                    ctx.fill();
                }

                // 추가: 빛줄기 효과
                ctx.globalAlpha = 0.3 + Math.sin(time * 6) * 0.2;
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 2;
                for (let r = 0; r < 8; r++) {
                    const rayAngle = time * 2 + (r * Math.PI / 4);
                    ctx.beginPath();
                    ctx.moveTo(0, -5);
                    ctx.lineTo(Math.cos(rayAngle) * 50, Math.sin(rayAngle) * 50 - 5);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1.0;

                ctx.restore();
            } else if (s.hasSnowCrystal) {
                // ============================================================
                // WINTER SNOW CRYSTAL (눈결정) - 특별 아이템
                // ============================================================
                ctx.save();
                ctx.translate(sx, sy - 35);

                // 차가운 아우라
                const pulse = 1 + Math.sin(time * 4) * 0.1;
                ctx.scale(pulse, pulse);

                ctx.shadowColor = '#00d2d3';
                ctx.shadowBlur = 20 + Math.sin(time * 6) * 10;

                // 육각형 눈결정
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';

                for (let k = 0; k < 6; k++) {
                    ctx.save();
                    ctx.rotate(k * Math.PI / 3);

                    // 메인 가지
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(0, -18);
                    ctx.stroke();

                    // 서브 가지
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(0, -10);
                    ctx.lineTo(-6, -16);
                    ctx.moveTo(0, -10);
                    ctx.lineTo(6, -16);

                    ctx.moveTo(0, -6);
                    ctx.lineTo(-4, -10);
                    ctx.moveTo(0, -6);
                    ctx.lineTo(4, -10);
                    ctx.stroke();

                    ctx.restore();
                }

                // 중앙 보석 (사파이어)
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#74b9ff';
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fill();

                // 반짝임 효과
                ctx.fillStyle = '#fff';
                const sparkleOp = 0.5 + Math.sin(time * 10) * 0.5;
                ctx.globalAlpha = sparkleOp;
                ctx.beginPath();
                ctx.arc(-5, -10, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.arc(8, 2, 1.5, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            } else if (window.gameState.isReverseMode) {

                // Draw Mineral
                let mCol = '#9b59b6'; // 10
                if (s.coinVal >= 50) mCol = '#3498db'; // 50
                if (s.coinVal >= 100) mCol = '#f1c40f'; // 100
                if (s.coinVal >= 500) mCol = '#ffffff'; // Super Diamond (White/Cyan)

                const mSize = s.coinVal >= 500 ? 18 : 12; // Larger for super diamond

                ctx.save();
                ctx.translate(sx, sy - 30);
                const rot = (time * 2 + i) % (Math.PI * 2);
                ctx.rotate(rot);

                ctx.fillStyle = mCol;
                ctx.beginPath();
                ctx.moveTo(0, -mSize);
                ctx.lineTo(mSize * 0.8, 0);
                ctx.lineTo(0, mSize);
                ctx.lineTo(-mSize * 0.8, 0);
                ctx.closePath();
                ctx.fill();

                if (s.coinVal >= 500) {
                    // Extra glow for super diamond
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = '#00d2d3';
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }

                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.beginPath();
                ctx.moveTo(0, -12);
                ctx.lineTo(5, 0);
                ctx.lineTo(0, 4);
                ctx.fill();
                ctx.restore();
            } else {
                // Draw Original Coin
                let col = '#f1c40f';
                if (s.coinVal === 5) col = '#00d2d3';
                if (s.coinVal === 10) col = '#ff6b6b';
                ctx.fillStyle = col;
                ctx.beginPath(); ctx.arc(sx, sy - 30, 10, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx - 3, sy - 33, 2, 0, Math.PI * 2); ctx.fill();
            }
        }
    });

    // Player
    const px = camX + window.gameState.renderPlayer.x * STAIR_W;
    const py = camY - window.gameState.renderPlayer.y * STAIR_H;

    // Pet (using premium graphics.js version)
    if (typeof window.premiumDrawPet === 'function') {
        window.premiumDrawPet(ctx, px, py, currentPet, window.gameState.playerDir);
    }

    // Player
    ctx.globalAlpha = 1.0; // Ensure full opacity for player
    drawPlayerWithSkin(ctx, px, py, window.gameState.playerDir);

    // Direction Arrow
    ctx.fillStyle = '#ffeaa7';
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.shadowBlur = 4; ctx.shadowColor = 'black';
    const bounce = Math.sin(Date.now() / 150) * 4;
    ctx.fillText(window.gameState.playerDir === 1 ? "→" : "←", px, py - 45 + bounce);
    ctx.shadowBlur = 0;

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.life -= 0.02;
        p.y += p.dy * p.life;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        const ppx = camX + p.x * STAIR_W;
        const ppy = camY - p.y * STAIR_H - 50;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.font = "bold 20px Arial";
        ctx.fillText(p.val, ppx, ppy);
        ctx.globalAlpha = 1.0;
    }

    // Render Environment Effects (Heat, Frost, etc.)
    drawEnvironmentEffects(ctx, canvas.width, canvas.height, time);
}

// ============================================================
// ENVIRONMENT EFFECTS (스크린 이펙트)
// ============================================================
function drawEnvironmentEffects(ctx, w, h, time) {
    // 1. Pharaoh Effects (Heat Haze & Fire Particles)
    if (typeof window.currentMap !== 'undefined' && window.currentMap === 'map_desert') {
        // Warm Overlay (Vignette)
        const gradient = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.8);
        gradient.addColorStop(0, 'rgba(255, 100, 0, 0)');
        gradient.addColorStop(1, 'rgba(255, 60, 0, 0.15)'); // Orange/Red edges

        ctx.fillStyle = gradient;
        ctx.globalCompositeOperation = 'screen'; // Additive blending for heat
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over'; // Reset

        // Heat Waves (Rising distortion lines)
        ctx.save();
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = '#ffcc00';
        for (let i = 0; i < 5; i++) {
            const yPos = (time * 50 + i * 150) % h;
            const waveH = 50;
            ctx.fillRect(0, h - yPos, w, waveH);
        }
        ctx.restore();
    }

    // 2. Winter Effects (Frost & Coldness)
    if (typeof window.currentMap !== 'undefined' && window.currentMap === 'map_winter') {
        // Cold Overlay (Blueish Vignette)
        const gradient = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.8);
        gradient.addColorStop(0, 'rgba(0, 200, 255, 0)');
        gradient.addColorStop(1, 'rgba(135, 206, 250, 0.2)'); // Light Blue edges

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);

        // Frost Crystals at corners
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        // Top Left
        ctx.moveTo(0, 0); ctx.lineTo(100, 0); ctx.quadraticCurveTo(50, 50, 0, 100); ctx.fill();
        // Top Right
        ctx.moveTo(w, 0); ctx.lineTo(w - 100, 0); ctx.quadraticCurveTo(w - 50, 50, w, 100); ctx.fill();
        // Bottom Left
        ctx.moveTo(0, h); ctx.lineTo(100, h); ctx.quadraticCurveTo(50, h - 50, 0, h - 100); ctx.fill();
        // Bottom Right
        ctx.moveTo(w, h); ctx.lineTo(w - 100, h); ctx.quadraticCurveTo(w - 50, h - 50, w, h - 100); ctx.fill();
    }
}

// Helper: Detailed Stair Drawing
function drawStair(ctx, x, y, skinId, index) {
    const isCurrent = (index === window.gameState.score);
    const left = x - STAIR_W / 2;
    const top = y;

    if (skinId === 'stair_glass') {
        // Glass Skin: Transparent with cyan/white border
        ctx.fillStyle = 'rgba(150, 240, 255, 0.25)';
        ctx.strokeStyle = '#00d2d3';
        ctx.lineWidth = 2;
        ctx.fillRect(left, top, STAIR_W, STAIR_H);
        ctx.strokeRect(left, top, STAIR_W, STAIR_H);

        // Inner shine for glass
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.moveTo(left + 10, top + 10);
        ctx.lineTo(left + STAIR_W - 10, top + 10);
        ctx.stroke();
    }
    else if (skinId === 'stair_pharaoh') {
        // ============================================================
        // PHARAOH'S GOLDEN STAIR (파라오의 황금 계단) - Premium Design
        // ============================================================

        // Golden Gradient Base
        const goldGrad = ctx.createLinearGradient(x, y, x, y + STAIR_H);
        goldGrad.addColorStop(0, '#ffd700');   // Bright gold top
        goldGrad.addColorStop(0.3, '#f1c40f'); // Rich gold
        goldGrad.addColorStop(0.7, '#d4a70a'); // Deep gold
        goldGrad.addColorStop(1, '#b8860b');   // Dark gold bottom
        ctx.fillStyle = goldGrad;
        ctx.fillRect(left, top, STAIR_W, STAIR_H);

        // Metallic Gold Trim with Glow
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = '#fff8dc';
        ctx.lineWidth = 3;
        ctx.strokeRect(left, top, STAIR_W, STAIR_H);
        ctx.shadowBlur = 0;

        // Inner Gold Border
        ctx.strokeStyle = '#b8860b';
        ctx.lineWidth = 1;
        ctx.strokeRect(left + 3, top + 3, STAIR_W - 6, STAIR_H - 6);

        // Hieroglyphic Pattern (Larger, Glowing)
        ctx.shadowColor = '#3498db';
        ctx.shadowBlur = 4;
        ctx.fillStyle = 'rgba(52, 152, 219, 0.8)';
        ctx.font = 'bold 16px serif';
        ctx.textAlign = 'center';
        const symbols = ['𓋹', '𓂀', '𓅓', '𓃭', '𓆣'];
        const sym = symbols[index % symbols.length];
        ctx.fillText(sym, x, y + STAIR_H / 2 + 5);
        ctx.shadowBlur = 0;

        // Top Highlight (Metallic Shine)
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(left + 5, top + 2, STAIR_W - 10, 3);

        // Decorative Corner Gems
        const gemColors = ['#e74c3c', '#3498db', '#2ecc71'];
        const gemColor = gemColors[index % 3];
        ctx.fillStyle = gemColor;
        ctx.beginPath();
        ctx.arc(left + 8, top + STAIR_H / 2, 3, 0, Math.PI * 2);
        ctx.arc(left + STAIR_W - 8, top + STAIR_H / 2, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    else if (skinId === 'stair_ice') {
        // Ice Skin: Cold Frosty Blue
        const iceGrad = ctx.createLinearGradient(x, y, x, y + STAIR_H);
        iceGrad.addColorStop(0, '#dff9fb');
        iceGrad.addColorStop(1, '#c7ecee');
        ctx.fillStyle = iceGrad;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(left, top, STAIR_W, STAIR_H);
        ctx.globalAlpha = 1.0;

        // Frosty edges
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(left, top, STAIR_W, STAIR_H);
        ctx.setLineDash([]);

        // Snowflake pattern
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(x, y + STAIR_H / 2, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    else {
        // Default Skin
        const sGrad = ctx.createLinearGradient(x, y, x, y + STAIR_H);
        if (isCurrent) {
            sGrad.addColorStop(0, '#ffffff'); sGrad.addColorStop(1, '#dfe6e9');
        } else {
            sGrad.addColorStop(0, '#a29bfe'); sGrad.addColorStop(1, '#6c5ce7');
        }
        ctx.fillStyle = sGrad;
        ctx.fillRect(left, top, STAIR_W, STAIR_H);
    }
}

// Helper: Calculus-based Smooth Dunes (Cubic Bezier)
function drawCalculusDunes(ctx, startX, bottomY, width, color, waveHeight, frequency) {
    ctx.fillStyle = color;
    ctx.beginPath();
    // Start well before screen to ensure continuity
    const ext = 600;
    const step = 40; // Sampling step for derivatives
    const startObj = startX - ext;
    const endX = startX + width + ext;

    ctx.moveTo(startObj, bottomY);

    // Initial Point
    let px = startObj;
    // f(x) = bottomY * 0.85 - sin(freq*x)*H + cos(freq*2.5*x)*(H*0.2)
    // We use numeric points for Bezier, but conceptually this models a smooth function
    let py = bottomY * 0.85 - Math.sin(px * frequency) * waveHeight + Math.cos(px * frequency * 2.5) * (waveHeight * 0.2);

    ctx.lineTo(px, py);

    for (let x = px + step; x <= endX; x += step) {
        let ny = bottomY * 0.85 - Math.sin(x * frequency) * waveHeight + Math.cos(x * frequency * 2.5) * (waveHeight * 0.2);

        // Control Points using Catmull-Rom like tension (0.5)
        // Or simple midpoint for smooth quadratic-like cubic
        let cp1x = px + step * 0.5;
        let cp1y = py;
        let cp2x = x - step * 0.5;
        let cp2y = ny;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, ny);

        px = x;
        py = ny;
    }

    ctx.lineTo(endX, bottomY);
    ctx.lineTo(startObj, bottomY);
    ctx.closePath();
    ctx.fill();
}

// Scale-ready Pharaoh Statue
function drawScaledPharaohStatue(ctx, x, y, scale) {
    if (x < -100 || x > ctx.canvas.width + 100) return;
    if (scale < 0.1) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Body
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(-15, -80, 30, 80);

    // Head
    ctx.fillStyle = '#d4a860';
    ctx.beginPath();
    ctx.arc(0, -95, 20, 0, Math.PI * 2);
    ctx.fill();

    // Crown
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(-15, -100);
    ctx.lineTo(0, -130);
    ctx.lineTo(15, -100);
    ctx.closePath();
    ctx.fill();

    // Beard/Details
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.2;
    ctx.fillRect(-5, -85, 10, 10);
    ctx.globalAlpha = 1.0;

    ctx.restore();
}

// Scale-ready Polar Bear
function drawScaledPolarBear(ctx, x, y, scale) {
    if (x < -100 || x > ctx.canvas.width + 100) return;
    if (scale < 0.1) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Flip if near left edge for variety (optional, but keep simple for now)

    // Body (White)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 35, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(-25, -15, 15, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.beginPath();
    ctx.arc(-15, 15, 8, 0, Math.PI * 2);
    ctx.arc(15, 15, 8, 0, Math.PI * 2);
    ctx.fill();

    // Eye/Nose
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.arc(-30, -18, 2, 0, Math.PI * 2); // Eye
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-38, -15, 3, 2, 0, 0, Math.PI * 2); // Nose
    ctx.fill();

    ctx.restore();
}


// ============================================================
// drawGameState - Main Game Rendering Function
// Called by core.js every frame to render the entire game
// Delegates to the premium render() function for high-quality graphics
// ============================================================
function drawGameState() {
    // Use the premium render() function which includes:
    // - Map-specific backgrounds (desert, winter, default)
    // - Detailed coin/crown/crystal rendering
    // - Environment effects
    // - Premium pet and player rendering
    render();
}
