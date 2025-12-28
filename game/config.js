// ============================================================
// game/config.js - Game Constants and State Initialization
// ============================================================

// Game Constants
const STAIR_W = 100;
const STAIR_H = 25;
const PLAYER_R = 12;
const MAX_TIMER = 100;
const TIMER_DECAY = 0.3;
const TIMER_BONUS = 15;

// Player Skins Data
window.SKIN_DATA = {
    default: { name: '기본 (원형)', icon: '⚪', type: 'circle' },
    skin_square: { name: '사각형', icon: '🟧', type: 'square', price: 1000 },
    skin_triangle: { name: '삼각형', icon: '🔺', type: 'triangle', price: 5000 },
    skin_diamond: { name: '다이아몬드', icon: '💎', type: 'diamond', price: 10000 },
    skin_ruby: { name: '파라오의 루비', icon: '🔴', type: 'ruby', price: 20000 },
    skin_pentagon: { name: '오각형 (고수용)', icon: '⬠', type: 'pentagon', price: 0, requirement: 1000 },
    skin_cosmic: { name: '코스믹 스타', icon: '🌟', type: 'cosmic', price: 1000000 }
};

// AI Constants
const EPSILON_DECAY = 0.999;
const MIN_EPSILON = 0.01;
const ALPHA = 0.1;
const GAMMA = 0.9;

// Global Game State
window.gameState = {
    running: false,
    score: 0,
    coinCount: 0,
    playerDir: 1, // 1=Right, 0=Left
    stairs: [],
    gameOver: false,
    timer: 100,
    renderPlayer: { x: 0, y: 0 },
    isReverseMode: false // New: Version 2
};

// AI State
window.qTable = {};
window.isTraining = false;
window.isAutoPlaying = false;

// Graphics Asset Arrays
// Graphics Asset Arrays
window.buildings = window.buildings || [];
window.clouds = window.clouds || [];
window.planets = window.planets || [];
window.stars = window.stars || [];
window.particles = window.particles || [];
window.minerals = window.minerals || []; // Underground objects
window.snowParticles = window.snowParticles || []; // Winter map snow

// Persistent State (loaded from storage/Firebase)
// Persistent State (loaded from storage/Firebase)
window.epsilon = 1.0;
window.episode = 0;
window.aiHighScore = parseInt(localStorage.getItem('infinite_stairs_highScore') || 0);
window.reverseHighScore = parseInt(localStorage.getItem('infinite_stairs_reverseHighScore') || 0);
window.totalCoins = parseInt(localStorage.getItem('infinite_stairs_coins') || 0);
window.currentSkin = localStorage.getItem('currentSkin') || 'default';
window.ownedSkins = JSON.parse(localStorage.getItem('ownedSkins') || '["default"]');
window.currentStairSkin = localStorage.getItem('currentStairSkin') || 'default';
window.ownedStairSkins = JSON.parse(localStorage.getItem('ownedStairSkins') || '["default"]');
window.currentPet = localStorage.getItem('currentPet') || 'none';
window.ownedPets = JSON.parse(localStorage.getItem('ownedPets') || '["none"]');
window.currentMap = localStorage.getItem('currentMap') || 'default';
window.ownedMaps = JSON.parse(localStorage.getItem('ownedMaps') || '["default"]');
window.skinRotation = 0;
window.isDataLoaded = false;

// Pharaoh's Crown Collection (파라오 왕관 수집)
window.pharaohCrowns = parseInt(localStorage.getItem('infinite_stairs_crowns') || 0);

// Winter Kingdom Snow Crystal Collection (겨울왕국 눈결정 수집)
window.snowCrystals = parseInt(localStorage.getItem('infinite_stairs_snowcrystals') || 0);



// Fall Animation State
let isFalling = false;
let fallVelocity = 0;
let fallY = 0;
let fallX = 0;
