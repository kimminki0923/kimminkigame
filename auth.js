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
    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        console.log("🔥 Firebase Config not found. Using LocalStorage mode.");
        loadLocalData();
        updateUI_LoggedOut();
        return;
    }

    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        auth = firebase.auth();
        db = firebase.firestore();

        // Suppress warning about overriding host
        db.settings({ experimentalForceLongPolling: true, merge: true });

        isCloudEnabled = true;

        auth.onAuthStateChanged((user) => {
            if (user) {
                currentUser = user;
                console.log("✅ Logged in as:", user.displayName);
                updateUI_LoggedIn(user);
                loadCloudData(user.uid);

                db.collection('users').doc(user.uid).set({
                    displayName: user.displayName || 'Anonymous'
                }, { merge: true });
            } else {
                currentUser = null;
                console.log("👋 Logged out");
                updateUI_LoggedOut();
                loadLocalData();
            }
        });
    } catch (e) {
        console.error("Firebase Init Error:", e);
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

    const liarAuth = document.getElementById('liar-auth-request');
    const liarControls = document.getElementById('liar-game-controls');
    if (liarAuth) liarAuth.style.display = 'none';
    if (liarControls) liarControls.style.display = 'block';

    const leaderboard = document.getElementById('leaderboard');
    if (leaderboard) leaderboard.style.display = 'block';
    loadLeaderboard();
}

function updateUI_LoggedOut() {
    if (loginBtn) loginBtn.style.display = 'inline-block';
    if (userInfoEl) userInfoEl.style.display = 'none';
    if (userImgEl) userImgEl.src = "";
    if (userNameEl) userNameEl.innerText = "";

    const liarAuth = document.getElementById('liar-auth-request');
    const liarControls = document.getElementById('liar-game-controls');
    if (liarAuth) liarAuth.style.display = 'block';
    if (liarControls) liarControls.style.display = 'none';

    const leaderboard = document.getElementById('leaderboard');
    if (leaderboard) leaderboard.style.display = 'none';
}

// --- Actions ---
function loginWithGoogle() {
    if (!isCloudEnabled) return alert("⚠️ Firebase 설정 필요");
    const provider = new firebase.auth.GoogleAuthProvider();
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        auth.signInWithRedirect(provider);
    } else {
        auth.signInWithPopup(provider).catch((error) => {
            if (error.code === 'auth/popup-blocked') auth.signInWithRedirect(provider);
            else alert("로그인 실패: " + error.message);
        });
    }
}

function logout() {
    if (auth) auth.signOut();
}

// --- Data Management ---
async function loadData() {
    if (currentUser && isCloudEnabled) return await loadCloudData(currentUser.uid);
    else return loadLocalData();
}

async function loadCloudData(uid) {
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists) {
            const data = doc.data();
            const savedScore = data.highScore || 0;
            const savedCoins = data.coinCount || 0;
            const savedSkins = data.ownedSkins || ['default'];
            const savedCurrentSkin = data.currentSkin || 'default';

            // Retry mechanism for setGameData if stairs_game.js isn't loaded yet
            attemptUpdateGameData(savedScore, savedCoins, savedSkins, savedCurrentSkin, 0);
            console.log("☁️ Cloud Data Loaded:", data);
        } else {
            console.log("☁️ New User, init data.");
            saveCloudData(0, 0, ['default'], 'default');
        }
    } catch (e) {
        console.error("Cloud Load Error:", e);
    }
}

function attemptUpdateGameData(score, coins, skins, currentSkin, attempts) {
    if (window.setGameData) {
        window.setGameData(score, coins, skins, currentSkin);
    } else {
        // Retry for up to 10 seconds (50 * 200ms)
        if (attempts < 50) {
            setTimeout(() => attemptUpdateGameData(score, coins, skins, currentSkin, attempts + 1), 200);
        } else {
            console.error("Failed to sync data to game: setGameData not found after 10 seconds");
        }
    }
}

function loadLocalData() {
    const savedScore = parseInt(localStorage.getItem('infinite_stairs_highScore') || 0);
    const savedCoins = parseInt(localStorage.getItem('infinite_stairs_coins') || 0);
    const savedSkins = JSON.parse(localStorage.getItem('ownedSkins') || '["default"]');
    const savedCurrentSkin = localStorage.getItem('currentSkin') || 'default';

    updateGameData(savedScore, savedCoins, savedSkins, savedCurrentSkin);
}

function saveCloudData(score, coins, skins, currentSkin) {
    if (!db || !currentUser) return;
    db.collection('users').doc(currentUser.uid).set({
        highScore: score,
        coinCount: coins,
        ownedSkins: skins,
        currentSkin: currentSkin,
        displayName: currentUser.displayName || 'Anonymous',
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(console.error);
}

function updateGameData(score, coins, skins, currentSkin) {
    if (window.setGameData) {
        window.setGameData(score, coins, skins, currentSkin);
    }
}

window.saveData = function (score, coins, skins, currentSkin) {
    localStorage.setItem('infinite_stairs_highScore', score);
    localStorage.setItem('infinite_stairs_coins', coins);
    if (skins) localStorage.setItem('ownedSkins', JSON.stringify(skins));
    if (currentSkin) localStorage.setItem('currentSkin', currentSkin);

    if (currentUser && isCloudEnabled) {
        saveCloudData(score, coins, skins || [], currentSkin || 'default');
    }
}

if (loginBtn) loginBtn.addEventListener('click', loginWithGoogle);
document.getElementById('logout-btn').addEventListener('click', logout);
const liarLoginBtn = document.getElementById('liar-login-btn');
if (liarLoginBtn) liarLoginBtn.addEventListener('click', loginWithGoogle);

async function loadLeaderboard() {
    if (!db || !isCloudEnabled) return;
    const listEl = document.getElementById('leaderboard-list');
    if (!listEl) return;

    try {
        const snapshot = await db.collection('users').orderBy('highScore', 'desc').limit(10).get();
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
        listEl.innerHTML = '<li style="color:#e74c3c;">로드 실패</li>';
    }
}
