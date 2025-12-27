// game/graphics.js - Background and Rendering
// ============================================================

let time = 0;
let petRenderPos = { x: 0, y: 0 }; // Pet interpolation

function initBackgroundObjects() {
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
    const score = window.gameState.score;
    const w = canvas.width;
    const h = canvas.height;

    // Check if using Desert Map
    if (typeof currentMap !== 'undefined' && currentMap === 'map_desert') {
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

// ============================================================
// Desert Background Rendering (Premium Art Version)
// ============================================================
function drawDesertBackgroundArtistic(camX, camY, score, w, h) {
    // 1. Mystical Sky Gradient (Royal Purple to Golden Sunset)
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, '#2c3e50');     // Midnight Blue (Top)
    grad.addColorStop(0.4, '#4a69bd');     // Deep Sky Blue
    grad.addColorStop(0.6, '#e58e26');     // Burnt Orange sunset
    grad.addColorStop(0.8, '#f6e58d');     // Pale Gold
    grad.addColorStop(1.0, '#d1ccc0');     // Hazy Horizon
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 2. Stars (Subtle twinkling)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (let i = 0; i < 20; i++) {
        const starX = (i * 137 + time * 0.5) % w;
        const starY = (i * 93) % (h * 0.4);
        const size = Math.random() * 1.5;
        ctx.globalAlpha = 0.5 + Math.sin(time + i) * 0.5;
        ctx.beginPath();
        ctx.arc(starX, starY, size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // 3. Huge Setting Sun (Bloom Effect)
    const sunX = w * 0.5;
    const sunY = h * 0.65;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 300);
    sunGrad.addColorStop(0, 'rgba(255, 100, 50, 0.4)');
    sunGrad.addColorStop(0.4, 'rgba(255, 200, 50, 0.1)');
    sunGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, w, h);

    // Sun Body
    ctx.fillStyle = '#eb4d4b';
    ctx.beginPath();
    ctx.arc(sunX, sunY + 50, 80, 0, Math.PI * 2);
    ctx.fill();

    // 4. Parallax Layer 1: Distant Silhouettes (Slower = More Stable)
    const p1 = (camX * 0.02) % w;
    ctx.save();
    ctx.translate(0, h * 0.05);

    // Distant Pyramid 1
    const dp1X = w * 0.2 - p1;
    drawArtisticPyramid(ctx, dp1X, h, 400, 350, '#535c68', '#2f3542');

    // Distant Pyramid 2
    const dp2X = w * 0.6 - p1;
    drawArtisticPyramid(ctx, dp2X, h, 250, 200, '#667687', '#2f3542');

    ctx.restore();

    // 5. Parallax Layer 2: Mid-Range Dunes (Smoother Motion)
    const p2 = (camX * 0.1) % w;
    drawCalculusDunes(ctx, -p2, h, w, '#cd6133', 100, 0.003);

    // 6. Featured Monuments (Detailed Sphinx)
    const p25 = (camX * 0.6) % (w * 1.5);
    const monX = w * 0.8 - p25;
    drawArtisticSphinx(ctx, monX, h * 0.82, 0.8);

    // 7. Parallax Layer 3: Foreground Dunes (Calculus Curves)
    const p3 = (camX * 0.25) % w;
    drawCalculusDunes(ctx, -p3, h + 20, w + 200, '#e58e26', 150, 0.005);

    // 8. Ground Detail
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < w; i += 4) {
        if (Math.random() > 0.5) ctx.fillRect(i, h * 0.85 + Math.random() * h * 0.15, 2, 2);
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

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    time = Date.now() * 0.001;

    // Camera & Player Interpolation
    const target = window.gameState.stairs[window.gameState.score] || { x: 0, y: 0 };
    if (window.gameState.stairs.length > 0 && !isFalling) {
        window.gameState.renderPlayer.x += (target.x - window.gameState.renderPlayer.x) * 0.2;
        window.gameState.renderPlayer.y += (target.y - window.gameState.renderPlayer.y) * 0.2;
    }
    const camX = -window.gameState.renderPlayer.x * STAIR_W + canvas.width / 2;
    const offset = window.gameState.isReverseMode ? 0 : 100; // Center camera for Reverse Mode
    const camY = window.gameState.renderPlayer.y * STAIR_H + canvas.height / 2 + offset;

    // Background
    drawBackground(camX, camY);

    // Stairs
    window.gameState.stairs.forEach((s, i) => {
        if (i < window.gameState.score - 5 || i > window.gameState.score + 18) return;
        const sx = camX + s.x * STAIR_W;
        const sy = camY - s.y * STAIR_H;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(sx - STAIR_W / 2 + 8, sy + 8, STAIR_W, STAIR_H);

        // Stair body
        const sGrad = ctx.createLinearGradient(sx, sy, sx, sy + STAIR_H);

        if (currentStairSkin === 'stair_glass') {
            // Glass Skin: Transparent with cyan/white border
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; // semi-transparent
            ctx.strokeStyle = '#00d2d3'; // cyan border
            ctx.lineWidth = 2;
            ctx.fillRect(sx - STAIR_W / 2, sy, STAIR_W, STAIR_H);
            ctx.strokeRect(sx - STAIR_W / 2, sy, STAIR_W, STAIR_H);

            // Inner shine for glass
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.moveTo(sx - STAIR_W / 2 + 5, sy + 5);
            ctx.lineTo(sx + STAIR_W / 2 - 5, sy + 5);
            ctx.stroke();
        } else {
            // Default Skin
            if (i === window.gameState.score) {
                sGrad.addColorStop(0, '#ffffff'); sGrad.addColorStop(1, '#dfe6e9');
            } else {
                sGrad.addColorStop(0, '#a29bfe'); sGrad.addColorStop(1, '#6c5ce7');
            }
            ctx.fillStyle = sGrad;
            ctx.fillRect(sx - STAIR_W / 2, sy, STAIR_W, STAIR_H);
        }

        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(sx - STAIR_W / 2, sy, STAIR_W, 4);

        // Coin / Mineral
        if (s.hasCoin) {
            if (window.gameState.isReverseMode) {
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

    // Pet
    drawPet(ctx, px, py, currentPet, window.gameState.playerDir);

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
