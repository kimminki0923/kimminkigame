// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyBK0urj5DBiDtJlVFXazt_phEwWONsAXx4",
    authDomain: "infinite-stairs-913f1.firebaseapp.com",
    projectId: "infinite-stairs-913f1",
    storageBucket: "infinite-stairs-913f1.firebasestorage.app",
    messagingSenderId: "149017516724",
    appId: "1:149017516724:web:c9787b547f48d84babd5e1",
    measurementId: "G-P6H7Z574G7"
};

// --- System State ---
let isCloudEnabled = false;
let db = null;
let auth = null;
let currentUser = null;

// --- Initialize ---
function initAuth() {
    // Check if config is filled (Primitive check)
    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        console.log("🔥 Firebase Config not found. Using LocalStorage mode.");
        loadLocalData();
        updateUI_LoggedOut();
        return;
    }

    try {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        isCloudEnabled = true;

        // Auth State Listener
        auth.onAuthStateChanged((user) => {
            if (user) {
                // Logged In
                currentUser = user;
                console.log("✅ Logged in as:", user.displayName);
                updateUI_LoggedIn(user);
                loadCloudData(user.uid);
            } else {
                // Logged Out
                currentUser = null;
                console.log("👋 Logged out");
                updateUI_LoggedOut();
                loadLocalData(); // Fallback
            }
        });
    } catch (e) {
        console.error("Firebase Init Error:", e);
        alert("Firebase 설정 오류! 콘솔을 확인하세요.");
        loadLocalData();
    }
}

// --- UI Functions ---
const loginBtn = document.getElementById('login-btn');
const userInfoEl = document.getElementById('user-info');
const userNameEl = document.getElementById('user-name');
const userImgEl = document.getElementById('user-img');

function updateUI_LoggedIn(user) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userInfoEl) userInfoEl.style.display = 'flex';
    if (userNameEl) userNameEl.innerText = user.displayName;
    if (userImgEl) userImgEl.src = user.photoURL;

    // Liar Game UI
    const liarAuth = document.getElementById('liar-auth-request');
    const liarControls = document.getElementById('liar-game-controls');
    if (liarAuth) liarAuth.style.display = 'none';
    if (liarControls) liarControls.style.display = 'block';

    // Leaderboard
    const leaderboard = document.getElementById('leaderboard');
    if (leaderboard) leaderboard.style.display = 'block';
    loadLeaderboard();
}

function updateUI_LoggedOut() {
    if (loginBtn) loginBtn.style.display = 'inline-block';
    if (userInfoEl) userInfoEl.style.display = 'none';
    if (userImgEl) userImgEl.src = "";
    if (userNameEl) userNameEl.innerText = "";

    // Liar Game UI
    const liarAuth = document.getElementById('liar-auth-request');
    const liarControls = document.getElementById('liar-game-controls');
    if (liarAuth) liarAuth.style.display = 'block';
    if (liarControls) liarControls.style.display = 'none';

    // Leaderboard
    const leaderboard = document.getElementById('leaderboard');
    if (leaderboard) leaderboard.style.display = 'none';
}

// --- Actions ---
function loginWithGoogle() {
    if (!isCloudEnabled) {
        alert("⚠️ Firebase 설정이 필요합니다!\nFIREBASE_SETUP.md 파일을 확인해서 설정 코드(apiKey 등)를 붙여넣어 주세요.");
        return;
    }
    const provider = new firebase.auth.GoogleAuthProvider();

    // 모바일 브라우저는 팝업을 차단하는 경우가 많으므로 Redirect 방식을 권장합니다.
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        console.log("📱 Mobile detected, using signInWithRedirect");
        auth.signInWithRedirect(provider);
    } else {
        auth.signInWithPopup(provider).catch((error) => {
            console.error("Login Failed:", error);
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
                console.log("🔄 Popup blocked, switching to Redirect...");
                auth.signInWithRedirect(provider);
            } else if (error.code === 'auth/unauthorized-domain') {
                alert("❌ 승인되지 않은 도메인입니다!\nFirebase 콘솔 -> Authentication -> 설정 -> 승인된 도메인에 현재 접속한 주소(IP)를 추가해야 합니다.");
            } else {
                alert("로그인 실패: " + error.message);
            }
        });
    }
}

function logout() {
    if (auth) auth.signOut();
}

// --- Data Management (Refined) ---

// 1. Load
async function loadData() {
    if (currentUser && isCloudEnabled) {
        return await loadCloudData(currentUser.uid);
    } else {
        return loadLocalData();
    }
}

async function loadCloudData(uid) {
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists) {
            const data = doc.data();
            // Pass loaded data to game
            const savedScore = data.highScore || 0;
            const savedCoins = data.coinCount || 0;
            updateGameData(savedScore, savedCoins);
            console.log("☁️ Cloud Data Loaded:", data);
        } else {
            console.log("☁️ New User, init data.");
            saveCloudData(0, 0);
        }
    } catch (e) {
        console.error("Cloud Load Error:", e);
    }
}

function loadLocalData() {
    const savedScore = parseInt(localStorage.getItem('infinite_stairs_highScore') || 0);
    const savedCoins = parseInt(localStorage.getItem('infinite_stairs_coins') || 0);
    updateGameData(savedScore, savedCoins);
}

// 2. Save (Called from script.js)
// script.js determines WHAT to save (e.g. cumulative coins)
// auth.js just executes the save to backend
function saveCloudData(score, coins) {
    if (!db || !currentUser) return;

    // Using simple set with merge. 
    // Ideally for coins we might want atomic increment, but let's trust the client state for now.
    db.collection('users').doc(currentUser.uid).set({
        highScore: score,
        coinCount: coins,
        displayName: currentUser.displayName || 'Anonymous',
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(() => {
        console.log("☁️ Saved to Cloud: Score", score, "Coins", coins);
    }).catch((e) => {
        console.error("Cloud Save Failed:", e);
    });
}

// Bridge to script.js
function updateGameData(score, coins) {
    if (window.setGameData) {
        window.setGameData(score, coins);
    }
}

// Global Save Bridge
window.saveData = function (score, coins) {
    // Local Save
    localStorage.setItem('infinite_stairs_highScore', score);
    localStorage.setItem('infinite_stairs_coins', coins);

    // Cloud Save
    if (currentUser && isCloudEnabled) {
        saveCloudData(score, coins);
    }
}

// Bind Events
// Bind Events
if (loginBtn) loginBtn.addEventListener('click', loginWithGoogle);
document.getElementById('logout-btn').addEventListener('click', logout);
const liarLoginBtn = document.getElementById('liar-login-btn');
if (liarLoginBtn) liarLoginBtn.addEventListener('click', loginWithGoogle);

// --- Leaderboard ---
async function loadLeaderboard() {
    if (!db || !isCloudEnabled) return;

    const listEl = document.getElementById('leaderboard-list');
    if (!listEl) return;

    try {
        const snapshot = await db.collection('users')
            .orderBy('highScore', 'desc')
            .limit(10)
            .get();

        listEl.innerHTML = '';

        if (snapshot.empty) {
            listEl.innerHTML = '<li style="color:#aaa;">아직 기록이 없습니다</li>';
            return;
        }

        let rank = 1;
        snapshot.forEach(doc => {
            const data = doc.data();
            const name = data.displayName || data.email?.split('@')[0] || 'Anonymous';
            const score = data.highScore || 0;

            const li = document.createElement('li');
            li.style.color = rank === 1 ? '#f1c40f' : rank === 2 ? '#bdc3c7' : rank === 3 ? '#cd6133' : '#fff';
            li.innerHTML = `<span style="font-weight:${rank <= 3 ? 'bold' : 'normal'}">${name.substring(0, 8)}</span> <span style="float:right; color:#3498db;">${score}</span>`;
            listEl.appendChild(li);
            rank++;
        });
    } catch (e) {
        console.error("Leaderboard error:", e);
        listEl.innerHTML = '<li style="color:#e74c3c;">로드 실패</li>';
    }
}
