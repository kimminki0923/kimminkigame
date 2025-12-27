// game/graphics.js - Background and Rendering
// ============================================================

let time = 0;

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

function drawBackground(camX, camY) {
    const score = window.gameState.score;
    const w = canvas.width;
    const h = canvas.height;
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
