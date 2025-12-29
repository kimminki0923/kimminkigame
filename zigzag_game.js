// ============================================
// ZigZag Endless Runner Game
// 하이퍼 캐주얼 무한 런 게임
// ============================================

(function () {
    'use strict';

    // ========== 게임 설정 ==========
    const CONFIG = {
        // 캔버스 크기 (게임 내부 해상도)
        CANVAS_WIDTH: 400,
        CANVAS_HEIGHT: 600,

        // 캐릭터 설정
        CHAR_SIZE: 20,           // 캐릭터 크기
        CHAR_SPEED: 3,           // 기본 이동 속도 (픽셀/프레임)
        SPEED_INCREMENT: 0.3,    // 50점마다 속도 증가량

        // 길(발판) 설정
        TILE_WIDTH: 50,          // 발판 너비
        TILE_HEIGHT: 50,         // 발판 높이 (쿼터뷰)
        INITIAL_PATH_LENGTH: 15, // 시작 시 생성할 발판 수

        // 이동 방향 (대각선 - 쿼터뷰 느낌)
        DIR_RIGHT_UP: { x: 1, y: -1 },   // 오른쪽 위
        DIR_LEFT_UP: { x: -1, y: -1 },   // 왼쪽 위

        // 색상 설정 (미니멀리즘)
        COLORS: {
            BACKGROUND: '#2c3e50',
            BACKGROUND_GRADIENT_START: '#1a252f',
            BACKGROUND_GRADIENT_END: '#34495e',
            TILE_TOP: '#ecf0f1',
            TILE_LEFT: '#bdc3c7',
            TILE_RIGHT: '#95a5a6',
            CHARACTER: '#e74c3c',
            CHARACTER_SHADOW: '#c0392b',
            SCORE_TEXT: '#f39c12',
            GAMEOVER_BG: 'rgba(0, 0, 0, 0.85)'
        },

        // 파티클 설정
        PARTICLE_COUNT: 20,      // 사망 시 파편 수
        PARTICLE_SPEED: 8,       // 파편 속도
        PARTICLE_LIFETIME: 60    // 파편 수명 (프레임)
    };

    // ========== 게임 상태 변수 ==========
    let canvas, ctx;
    let gameState = 'idle';  // 'idle', 'playing', 'gameover'
    let score = 0;
    let highScore = parseInt(localStorage.getItem('zigzag_highscore')) || 0;
    let currentSpeed;

    // 캐릭터 상태
    let character = {
        x: 0,
        y: 0,
        direction: 1,  // 1: 오른쪽 위, -1: 왼쪽 위
        onGround: true
    };

    // 길(발판) 배열 - 각 발판의 월드 좌표 저장
    let path = [];
    let pathDirection = 1;  // 다음 발판 생성 방향 (1: 오른쪽, -1: 왼쪽)

    // 카메라 오프셋 (캐릭터를 화면 중앙에 유지)
    let cameraOffsetX = 0;
    let cameraOffsetY = 0;

    // 파티클 시스템 (사망 시 효과)
    let particles = [];

    // 애니메이션 ID
    let animationId;

    // ========== 초기화 함수 ==========
    function init() {
        canvas = document.getElementById('zigzagCanvas');
        if (!canvas) {
            console.error('ZigZag: 캔버스를 찾을 수 없습니다.');
            return;
        }

        ctx = canvas.getContext('2d');

        // 캔버스 크기 설정
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // 입력 이벤트 등록
        canvas.addEventListener('click', handleInput);
        canvas.addEventListener('touchstart', handleInput, { passive: true });
        document.addEventListener('keydown', handleKeyDown);

        // 초기 화면 렌더링
        renderIdleScreen();

        console.log('ZigZag Endless Runner 초기화 완료');
    }

    // 캔버스 크기 조정 (반응형)
    function resizeCanvas() {
        const container = canvas.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // 비율 유지하면서 크기 조정
        const ratio = CONFIG.CANVAS_WIDTH / CONFIG.CANVAS_HEIGHT;
        let width = containerWidth;
        let height = containerWidth / ratio;

        if (height > containerHeight) {
            height = containerHeight;
            width = containerHeight * ratio;
        }

        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        canvas.width = CONFIG.CANVAS_WIDTH;
        canvas.height = CONFIG.CANVAS_HEIGHT;
    }

    // ========== 입력 처리 ==========
    function handleInput(e) {
        e.preventDefault();

        if (gameState === 'idle') {
            startGame();
        } else if (gameState === 'playing') {
            // 방향 전환 (90도 꺾기)
            changeDirection();
        } else if (gameState === 'gameover') {
            // 게임오버 상태에서 클릭하면 재시작
            resetGame();
            startGame();
        }
    }

    function handleKeyDown(e) {
        // 스페이스바 또는 클릭과 동일한 동작
        if (e.code === 'Space' || e.key === ' ') {
            e.preventDefault();
            handleInput(e);
        }
    }

    // ========== 게임 시작 ==========
    function startGame() {
        gameState = 'playing';
        score = 0;
        currentSpeed = CONFIG.CHAR_SPEED;
        particles = [];

        // 길 생성 (발판 배열 초기화)
        generateInitialPath();

        // 캐릭터 시작 위치 설정 (첫 번째 발판 위)
        const startTile = path[0];
        character.x = startTile.x + CONFIG.TILE_WIDTH / 2;
        character.y = startTile.y;
        character.direction = 1;  // 오른쪽 위로 시작
        character.onGround = true;

        // 카메라 초기 위치
        cameraOffsetX = character.x - CONFIG.CANVAS_WIDTH / 2;
        cameraOffsetY = character.y - CONFIG.CANVAS_HEIGHT / 2;

        // 게임 루프 시작
        if (animationId) cancelAnimationFrame(animationId);
        gameLoop();
    }

    // ========== 게임 리셋 ==========
    function resetGame() {
        gameState = 'idle';
        score = 0;
        path = [];
        particles = [];
        character = { x: 0, y: 0, direction: 1, onGround: true };
        if (animationId) cancelAnimationFrame(animationId);
    }

    // ========== 방향 전환 ==========
    function changeDirection() {
        // 방향을 90도 꺾음 (왼쪽 위 ↔ 오른쪽 위)
        character.direction *= -1;

        // 점수 1점 추가
        score++;

        // 50점 단위로 속도 증가
        if (score > 0 && score % 50 === 0) {
            currentSpeed += CONFIG.SPEED_INCREMENT;
        }
    }

    // ========== 길(발판) 생성 ==========
    function generateInitialPath() {
        path = [];
        pathDirection = 1;

        // 시작점 (화면 중앙 하단)
        let currentX = CONFIG.CANVAS_WIDTH / 2 - CONFIG.TILE_WIDTH / 2;
        let currentY = CONFIG.CANVAS_HEIGHT / 2;

        for (let i = 0; i < CONFIG.INITIAL_PATH_LENGTH; i++) {
            path.push({
                x: currentX,
                y: currentY,
                falling: false,      // 떨어지는 중인지
                fallSpeed: 0,        // 떨어지는 속도
                alpha: 1             // 투명도 (사라질 때 사용)
            });

            // 다음 발판 위치 결정 (왼쪽 또는 오른쪽으로 랜덤)
            if (i < 3) {
                // 처음 3개는 같은 방향으로
                pathDirection = 1;
            } else {
                pathDirection = Math.random() > 0.5 ? 1 : -1;
            }

            currentX += pathDirection * CONFIG.TILE_WIDTH;
            currentY -= CONFIG.TILE_HEIGHT * 0.5;  // 쿼터뷰 느낌으로 위로
        }
    }

    // 새로운 발판 추가 (캐릭터가 전진할 때 호출)
    function addNewTile() {
        const lastTile = path[path.length - 1];

        // 다음 발판 방향 랜덤 결정
        pathDirection = Math.random() > 0.5 ? 1 : -1;

        const newTile = {
            x: lastTile.x + pathDirection * CONFIG.TILE_WIDTH,
            y: lastTile.y - CONFIG.TILE_HEIGHT * 0.5,
            falling: false,
            fallSpeed: 0,
            alpha: 1
        };

        path.push(newTile);

        // 캐릭터가 지나간 발판 정리 (떨어뜨리기 시작)
        if (path.length > 20) {
            const oldTile = path[0];
            oldTile.falling = true;
        }

        // 완전히 사라진 발판 제거
        path = path.filter(tile => tile.alpha > 0);
    }

    // ========== 게임 루프 ==========
    function gameLoop() {
        if (gameState !== 'playing') return;

        update();
        render();

        animationId = requestAnimationFrame(gameLoop);
    }

    // ========== 업데이트 로직 ==========
    function update() {
        // 캐릭터 이동 (대각선 방향으로)
        const dir = character.direction === 1 ? CONFIG.DIR_RIGHT_UP : CONFIG.DIR_LEFT_UP;
        character.x += dir.x * currentSpeed;
        character.y += dir.y * currentSpeed * 0.5;  // Y는 절반 속도 (쿼터뷰)

        // 카메라 부드럽게 따라가기
        const targetCamX = character.x - CONFIG.CANVAS_WIDTH / 2;
        const targetCamY = character.y - CONFIG.CANVAS_HEIGHT / 2;
        cameraOffsetX += (targetCamX - cameraOffsetX) * 0.1;
        cameraOffsetY += (targetCamY - cameraOffsetY) * 0.1;

        // 캐릭터가 발판 위에 있는지 확인
        checkCollision();

        // 새 발판 추가 체크 (캐릭터가 끝에서 2번째 발판 근처에 있으면)
        const lastTile = path[path.length - 1];
        const distToLast = Math.sqrt(
            Math.pow(character.x - (lastTile.x + CONFIG.TILE_WIDTH / 2), 2) +
            Math.pow(character.y - lastTile.y, 2)
        );

        if (distToLast < CONFIG.TILE_WIDTH * 3) {
            addNewTile();
        }

        // 떨어지는 발판 업데이트
        path.forEach(tile => {
            if (tile.falling) {
                tile.fallSpeed += 0.3;  // 중력
                tile.y += tile.fallSpeed;
                tile.alpha -= 0.02;
                if (tile.alpha < 0) tile.alpha = 0;
            }
        });

        // 파티클 업데이트
        updateParticles();
    }

    // ========== 충돌 검사 (발판 위에 있는지) ==========
    function checkCollision() {
        let onAnyTile = false;

        for (const tile of path) {
            if (tile.falling) continue;  // 떨어지는 발판은 무시

            // 마름모 형태의 발판 충돌 검사
            const tileCenter = {
                x: tile.x + CONFIG.TILE_WIDTH / 2,
                y: tile.y
            };

            // 캐릭터가 발판 범위 내에 있는지 (간단한 박스 충돌)
            const dx = Math.abs(character.x - tileCenter.x);
            const dy = Math.abs(character.y - tileCenter.y);

            // 마름모 형태 근사 (대각선 거리)
            const halfWidth = CONFIG.TILE_WIDTH / 2;
            const halfHeight = CONFIG.TILE_HEIGHT / 4;

            if (dx < halfWidth && dy < halfHeight) {
                onAnyTile = true;
                break;
            }
        }

        if (!onAnyTile) {
            // 발판 밖으로 떨어짐 - 게임 오버
            gameOver();
        }
    }

    // ========== 게임 오버 ==========
    function gameOver() {
        gameState = 'gameover';

        // 하이스코어 갱신
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('zigzag_highscore', highScore);
        }

        // 파티클 생성 (캐릭터가 떨어질 때 파편 효과)
        createDeathParticles();
    }

    // ========== 파티클 시스템 ==========
    function createDeathParticles() {
        for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
            const angle = (Math.PI * 2 / CONFIG.PARTICLE_COUNT) * i + Math.random() * 0.5;
            const speed = CONFIG.PARTICLE_SPEED * (0.5 + Math.random() * 0.5);

            particles.push({
                x: character.x,
                y: character.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 4 + Math.random() * 6,
                life: CONFIG.PARTICLE_LIFETIME,
                color: Math.random() > 0.5 ? CONFIG.COLORS.CHARACTER : CONFIG.COLORS.CHARACTER_SHADOW
            });
        }
    }

    function updateParticles() {
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.2;  // 중력
            p.life--;
            p.size *= 0.98;
        });

        particles = particles.filter(p => p.life > 0);
    }

    // ========== 렌더링 ==========
    function render() {
        // 배경 그라데이션
        const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.CANVAS_HEIGHT);
        gradient.addColorStop(0, CONFIG.COLORS.BACKGROUND_GRADIENT_START);
        gradient.addColorStop(1, CONFIG.COLORS.BACKGROUND_GRADIENT_END);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        // 발판 그리기
        ctx.save();
        path.forEach(tile => {
            drawIsometricTile(tile);
        });
        ctx.restore();

        // 캐릭터 그리기 (게임오버가 아닐 때만)
        if (gameState === 'playing') {
            drawCharacter();
        }

        // 파티클 그리기
        drawParticles();

        // UI 그리기
        drawUI();

        // 게임오버 화면
        if (gameState === 'gameover') {
            drawGameOverScreen();
        }
    }

    // 아이소메트릭 발판 그리기 (마름모 형태)
    function drawIsometricTile(tile) {
        const screenX = tile.x - cameraOffsetX;
        const screenY = tile.y - cameraOffsetY;

        ctx.save();
        ctx.globalAlpha = tile.alpha;

        const w = CONFIG.TILE_WIDTH;
        const h = CONFIG.TILE_HEIGHT * 0.5;  // 높이는 절반 (쿼터뷰)
        const depth = 15;  // 발판 두께

        // 상단면 (밝은 색)
        ctx.beginPath();
        ctx.moveTo(screenX + w / 2, screenY - h / 2);
        ctx.lineTo(screenX + w, screenY);
        ctx.lineTo(screenX + w / 2, screenY + h / 2);
        ctx.lineTo(screenX, screenY);
        ctx.closePath();
        ctx.fillStyle = CONFIG.COLORS.TILE_TOP;
        ctx.fill();
        ctx.strokeStyle = '#7f8c8d';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 왼쪽 측면
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(screenX + w / 2, screenY + h / 2);
        ctx.lineTo(screenX + w / 2, screenY + h / 2 + depth);
        ctx.lineTo(screenX, screenY + depth);
        ctx.closePath();
        ctx.fillStyle = CONFIG.COLORS.TILE_LEFT;
        ctx.fill();

        // 오른쪽 측면
        ctx.beginPath();
        ctx.moveTo(screenX + w, screenY);
        ctx.lineTo(screenX + w / 2, screenY + h / 2);
        ctx.lineTo(screenX + w / 2, screenY + h / 2 + depth);
        ctx.lineTo(screenX + w, screenY + depth);
        ctx.closePath();
        ctx.fillStyle = CONFIG.COLORS.TILE_RIGHT;
        ctx.fill();

        ctx.restore();
    }

    // 캐릭터 그리기 (간단한 큐브)
    function drawCharacter() {
        const screenX = character.x - cameraOffsetX;
        const screenY = character.y - cameraOffsetY;
        const size = CONFIG.CHAR_SIZE;

        // 그림자
        ctx.beginPath();
        ctx.ellipse(screenX, screenY + 5, size * 0.6, size * 0.3, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();

        // 캐릭터 (큐브 형태)
        const cubeH = size * 1.5;

        // 상단
        ctx.beginPath();
        ctx.moveTo(screenX, screenY - cubeH - size / 2);
        ctx.lineTo(screenX + size / 2, screenY - cubeH);
        ctx.lineTo(screenX, screenY - cubeH + size / 2);
        ctx.lineTo(screenX - size / 2, screenY - cubeH);
        ctx.closePath();
        ctx.fillStyle = '#f39c12';
        ctx.fill();

        // 왼쪽 면
        ctx.beginPath();
        ctx.moveTo(screenX - size / 2, screenY - cubeH);
        ctx.lineTo(screenX, screenY - cubeH + size / 2);
        ctx.lineTo(screenX, screenY - size / 2);
        ctx.lineTo(screenX - size / 2, screenY);
        ctx.closePath();
        ctx.fillStyle = CONFIG.COLORS.CHARACTER_SHADOW;
        ctx.fill();

        // 오른쪽 면
        ctx.beginPath();
        ctx.moveTo(screenX + size / 2, screenY - cubeH);
        ctx.lineTo(screenX, screenY - cubeH + size / 2);
        ctx.lineTo(screenX, screenY - size / 2);
        ctx.lineTo(screenX + size / 2, screenY);
        ctx.closePath();
        ctx.fillStyle = CONFIG.COLORS.CHARACTER;
        ctx.fill();
    }

    // 파티클 그리기
    function drawParticles() {
        particles.forEach(p => {
            const screenX = p.x - cameraOffsetX;
            const screenY = p.y - cameraOffsetY;

            ctx.globalAlpha = p.life / CONFIG.PARTICLE_LIFETIME;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(screenX, screenY, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    // UI 그리기
    function drawUI() {
        // 점수 표시 (화면 상단 중앙)
        ctx.font = 'bold 48px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.fillText(score, CONFIG.CANVAS_WIDTH / 2, 70);
        ctx.shadowBlur = 0;

        // 하이스코어 (작게)
        ctx.font = '14px Outfit, sans-serif';
        ctx.fillStyle = '#95a5a6';
        ctx.fillText('BEST: ' + highScore, CONFIG.CANVAS_WIDTH / 2, 95);
    }

    // 대기 화면
    function renderIdleScreen() {
        // 배경
        const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.CANVAS_HEIGHT);
        gradient.addColorStop(0, CONFIG.COLORS.BACKGROUND_GRADIENT_START);
        gradient.addColorStop(1, CONFIG.COLORS.BACKGROUND_GRADIENT_END);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        // 타이틀
        ctx.font = 'bold 42px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText('ZigZag', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 - 50);

        // 서브타이틀
        ctx.font = '18px Outfit, sans-serif';
        ctx.fillStyle = '#95a5a6';
        ctx.fillText('Endless Runner', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 - 15);

        // 시작 안내
        ctx.font = 'bold 16px Outfit, sans-serif';
        ctx.fillStyle = CONFIG.COLORS.SCORE_TEXT;
        ctx.fillText('클릭 또는 스페이스바로 시작', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 60);

        // 조작 설명
        ctx.font = '14px Outfit, sans-serif';
        ctx.fillStyle = '#7f8c8d';
        ctx.fillText('클릭/스페이스: 방향 전환', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 100);

        // 하이스코어
        if (highScore > 0) {
            ctx.font = 'bold 20px Outfit, sans-serif';
            ctx.fillStyle = '#f39c12';
            ctx.fillText('🏆 BEST: ' + highScore, CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 150);
        }

        // 데코 - 샘플 타일 그리기
        drawIsometricTile({ x: CONFIG.CANVAS_WIDTH / 2 - 25, y: CONFIG.CANVAS_HEIGHT - 100, alpha: 0.3 });
    }

    // 게임오버 화면
    function drawGameOverScreen() {
        // 어두운 오버레이
        ctx.fillStyle = CONFIG.COLORS.GAMEOVER_BG;
        ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        // 게임오버 텍스트
        ctx.font = 'bold 36px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e74c3c';
        ctx.fillText('GAME OVER', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 - 60);

        // 점수
        ctx.font = 'bold 64px Outfit, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(score, CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 10);

        // 하이스코어
        ctx.font = '18px Outfit, sans-serif';
        if (score >= highScore && score > 0) {
            ctx.fillStyle = '#f39c12';
            ctx.fillText('🎉 NEW BEST!', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 50);
        } else {
            ctx.fillStyle = '#95a5a6';
            ctx.fillText('BEST: ' + highScore, CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 50);
        }

        // 재시작 안내
        ctx.font = 'bold 16px Outfit, sans-serif';
        ctx.fillStyle = CONFIG.COLORS.SCORE_TEXT;
        ctx.fillText('TAP TO RESTART', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 110);
    }

    // ========== 페이지 전환 시 처리 ==========
    function pauseGame() {
        gameState = 'idle';
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    function resumeGame() {
        resizeCanvas();
        if (gameState === 'idle') {
            renderIdleScreen();
        }
    }

    // ========== 전역에 노출 ==========
    window.zigzagGame = {
        init: init,
        pause: pauseGame,
        resume: resumeGame
    };

    // DOM이 로드되었을 때 초기화
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOMContentLoaded가 이미 발생한 경우
        init();
    }

})();
