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
    try {
        if (typeof firebase === 'undefined') {
            console.error("Firebase SDK not loaded");
            loadLocalData();
            return;
        }

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        auth = firebase.auth();
        db = firebase.firestore();

        // Settings to avoid warnings
        db.settings({ experimentalForceLongPolling: true, merge: true });

        isCloudEnabled = true;
        console.log("🔥 Firebase Initialized");

        auth.onAuthStateChanged((user) => {
            if (user) {
                currentUser = user;
                console.log("✅ Logged in as:", user.displayName);
                updateUI_LoggedIn(user);
                loadCloudData(user.uid);

                // Save user info
                db.collection('users').doc(user.uid).set({
                    displayName: user.displayName || 'Anonymous',
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
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

    // Liar Game UI updates
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

    // Liar Game UI updates
    const liarAuth = document.getElementById('liar-auth-request');
    const liarControls = document.getElementById('liar-game-controls');
    if (liarAuth) liarAuth.style.display = 'block';
    if (liarControls) liarControls.style.display = 'none';

    const leaderboard = document.getElementById('leaderboard');
    if (leaderboard) leaderboard.style.display = 'none';
}

// --- Actions ---
function loginWithGoogle() {
    if (!auth) {
        alert("⚠️ Firebase가 아직 초기화되지 않았거나 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
        initAuth(); // Try initializing again
        return;
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch((error) => {
        console.error("Login Error:", error);
        alert("로그인 실패: " + error.message);
    });
}

function logout() {
    if (auth) auth.signOut();
}

// --- Data Management ---
async function loadCloudData(uid) {
    if (!db) return;
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists) {
            const data = doc.data();
            applyGameData(
                data.highScore || 0,
                data.coinCount || 0,
                data.ownedSkins || ['default'],
                data.currentSkin || 'default'
            );
            console.log("☁️ Cloud Data Loaded");
        } else {
            console.log("☁️ New User");
            saveCloudData(0, 0, ['default'], 'default');
        }
    } catch (e) {
        console.error("Cloud Load Error:", e);
    }
}

function loadLocalData() {
    const savedScore = parseInt(localStorage.getItem('infinite_stairs_highScore') || 0);
    const savedCoins = parseInt(localStorage.getItem('infinite_stairs_coins') || 0);
    const savedSkins = JSON.parse(localStorage.getItem('ownedSkins') || '["default"]');
    const savedCurrentSkin = localStorage.getItem('currentSkin') || 'default';

    applyGameData(savedScore, savedCoins, savedSkins, savedCurrentSkin);
}

function applyGameData(score, coins, skins, currentSkin) {
    // Retry to set data if game script is not ready
    if (window.setGameData) {
        window.setGameData(score, coins, skins, currentSkin);
    } else {
        setTimeout(() => applyGameData(score, coins, skins, currentSkin), 500);
    }
}

function saveCloudData(score, coins, skins, currentSkin) {
    if (!db || !currentUser) return;
    db.collection('users').doc(currentUser.uid).set({
        highScore: score,
        coinCount: coins,
        ownedSkins: skins,
        currentSkin: currentSkin,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(console.error);
}

// Global Save Hook
window.saveData = function (score, coins, skins, currentSkin) {
    localStorage.setItem('infinite_stairs_highScore', score);
    localStorage.setItem('infinite_stairs_coins', coins);
    if (skins) localStorage.setItem('ownedSkins', JSON.stringify(skins));
    if (currentSkin) localStorage.setItem('currentSkin', currentSkin);

    if (currentUser && isCloudEnabled) {
        saveCloudData(score, coins, skins, currentSkin);
    }
}

// Listeners
if (loginBtn) loginBtn.addEventListener('click', loginWithGoogle);
document.getElementById('logout-btn')?.addEventListener('click', logout);
document.getElementById('liar-login-btn')?.addEventListener('click', loginWithGoogle);

// Leaderboard
async function loadLeaderboard() {
    if (!db) return;
    const listEl = document.getElementById('leaderboard-list');
    if (!listEl) return;
    try {
        const snapshot = await db.collection('users').orderBy('highScore', 'desc').limit(10).get();
        listEl.innerHTML = '';
        if (snapshot.empty) {
            listEl.innerHTML = '<li>기록 없음</li>';
            return;
        }
        let rank = 1;
        snapshot.forEach(doc => {
            const d = doc.data();
            const li = document.createElement('li');
            li.innerHTML = `<span>${rank}. ${d.displayName || 'Anon'}</span> <span style="float:right">${d.highScore || 0}</span>`;
            listEl.appendChild(li);
            rank++;
        });
    } catch {
        listEl.innerHTML = '<li>로드 실패</li>';
    }
}

// Initialize immediately
initAuth();
window.initAuth = initAuth; // Expose for external calls if needed
