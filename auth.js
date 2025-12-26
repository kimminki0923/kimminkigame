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

// --- Global State ---
let isCloudEnabled = false;
let db = null;
let auth = null;
let currentUser = null;

// --- Initialize Firebase ---
function initAuth() {
    if (typeof firebase === 'undefined') {
        console.error("Firebase SDK not loaded yet.");
        return;
    }

    if (firebase.apps.length === 0) {
        try {
            firebase.initializeApp(firebaseConfig);
            console.log("🔥 Firebase Initialized");
        } catch (e) {
            console.error("Firebase Init Error:", e);
            return;
        }
    }

    auth = firebase.auth();
    db = firebase.firestore();

    db.settings({ merge: true });

    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
            isCloudEnabled = true;
        })
        .catch((error) => {
            console.error("Persistence Error:", error);
        });

    // Handle Redirect Result (Mobile Login)
    auth.getRedirectResult()
        .then((result) => {
            if (result.user) {
                console.log("✅ Redirect Login Success:", result.user.displayName);
            }
        }).catch((error) => {
            console.error("Redirect Login Error:", error);
        });

    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            console.log("✅ Logged in:", user.displayName);
            updateUI_LoggedIn(user);
            loadCloudData(user.uid);

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
}

// --- Login Action ---
function loginWithGoogle() {
    if (!auth) {
        initAuth();
        if (!auth) return alert("Firebase 연결 실패. 페이지를 새로고침 해주세요.");
    }

    const provider = new firebase.auth.GoogleAuthProvider();

    // Check if mobile/tablet
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
        auth.signInWithRedirect(provider);
    } else {
        auth.signInWithPopup(provider)
            .then((result) => {
                console.log("Login Success");
            })
            .catch((error) => {
                console.error("Login CMD Error:", error);
                if (error.code === 'auth/popup-closed-by-user') return;
                if (error.code === 'auth/unauthorized-domain') {
                    alert("⚠️ 도메인 승인 오류\nFirebase 콘솔 > Authentication > Settings > Authorized Domains에 현재 도메인을 추가해야 합니다.");
                    return;
                }
                alert("로그인 에러: " + error.message);
            });
    }
}

function logout() {
    if (auth) auth.signOut();
}

// --- Data Sync (Cloud) ---
async function loadCloudData(uid) {
    if (!db) return;
    try {
        const doc = await db.collection('users').doc(uid).get();

        // Local Cache (Truth)
        const localScore = parseInt(localStorage.getItem('infinite_stairs_highScore') || 0);
        const localCoins = parseInt(localStorage.getItem('infinite_stairs_coins') || 0);
        const localSkins = JSON.parse(localStorage.getItem('ownedSkins') || '["default"]');
        const localSkin = localStorage.getItem('currentSkin') || 'default';

        let finalScore = localScore;
        let finalCoins = localCoins;
        let finalSkins = localSkins;
        let finalSkin = localSkin;
        let needSync = false;

        if (doc.exists) {
            const data = doc.data();
            const cloudScore = data.highScore || 0;
            const cloudCoins = data.coinCount || 0;
            const cloudSkins = data.ownedSkins || ['default'];

            // Merge Strategy: MAX
            if (cloudScore > finalScore) finalScore = cloudScore;
            if (cloudCoins > finalCoins) finalCoins = cloudCoins;

            // Merge Skins (Union)
            const skinSet = new Set([...finalSkins, ...cloudSkins]);
            finalSkins = Array.from(skinSet);

            // Prefer Cloud Skin if different, unless local changed recently? 
            // Stick to cloud skin to be safe, or local? 
            // If cloud has a skin we don't own locally, we should probably equip it if cloud says so.
            // But usually user wants 'current' state. Let's trust local skin if it's in the owned list.
            if (data.currentSkin && finalSkins.includes(data.currentSkin)) {
                finalSkin = data.currentSkin;
            }

            // If Local was ahead, or we merged, we might want to sync back later?
            // Actually, if Local < Cloud, we update Local.
            // If Local > Cloud, we MUST update Cloud immediately.
            if (localScore > cloudScore || localCoins > cloudCoins || finalSkins.length > cloudSkins.length) {
                needSync = true;
            }
        } else {
            // New user on cloud, but has local data -> Sync up!
            needSync = true;
        }

        if (needSync) {
            console.log("☁️ Syncing Local Progress to Cloud...");
            saveCloudData(finalScore, finalCoins, finalSkins, finalSkin);
        }

        applyGameData(finalScore, finalCoins, finalSkins, finalSkin);

    } catch (e) {
        console.error("Load Cloud Error:", e);
    }
}

// --- Data Sync (Local) ---
function loadLocalData() {
    const s = parseInt(localStorage.getItem('infinite_stairs_highScore') || 0);
    const c = parseInt(localStorage.getItem('infinite_stairs_coins') || 0);
    const skins = JSON.parse(localStorage.getItem('ownedSkins') || '["default"]');
    const skin = localStorage.getItem('currentSkin') || 'default';
    applyGameData(s, c, skins, skin);
}

// --- Apply to Game (Bridge) ---
function applyGameData(score, coins, skins, currentSkin) {
    const trySet = (attempts = 0) => {
        if (window.setGameData) {
            window.setGameData(score || 0, coins || 0, skins || ['default'], currentSkin || 'default');
        } else if (attempts < 20) {
            setTimeout(() => trySet(attempts + 1), 200);
        }
    };
    trySet();
}

// --- Save Data ---
function saveCloudData(score, coins, skins, currentSkin) {
    if (!db || !currentUser) return;

    // Safety: Don't overwrite with empty/zero data if it looks like a reset error
    // (e.g., if we inadvertently try to save before loading)
    if (score === 0 && coins === 0 && (!skins || (skins.length === 1 && skins[0] === 'default'))) {
        // If it's a new user, this is fine. But if it's an existing user, it's bad.
        // We rely on 'merge: true' but that still overwrites fields.
        // We will trust the caller (core.js) which checks isDataLoaded.
    }

    db.collection('users').doc(currentUser.uid).set({
        highScore: score,
        coinCount: coins,
        ownedSkins: skins,
        currentSkin: currentSkin,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(() => {
        console.log("☁️ Cloud Save Success");
        // Trigger leaderboard refresh immediately after saving a score
        loadLeaderboard();
    }).catch(e => console.error("Cloud Save Failed", e));
}

window.saveData = function (score, coins, skins, currentSkin) {
    localStorage.setItem('infinite_stairs_highScore', score);
    localStorage.setItem('infinite_stairs_coins', coins);
    if (skins) localStorage.setItem('ownedSkins', JSON.stringify(skins));
    if (currentSkin) localStorage.setItem('currentSkin', currentSkin);

    if (currentUser && isCloudEnabled) {
        saveCloudData(score, coins, skins, currentSkin);
    }
}

// --- UI Helpers ---
function updateUI_LoggedIn(user) {
    const login = document.getElementById('login-btn');
    const info = document.getElementById('user-info');
    const name = document.getElementById('user-name');
    const img = document.getElementById('user-img');

    if (login) login.style.display = 'none';
    if (info) info.style.display = 'flex';
    if (name) name.innerText = user.displayName;
    if (img) img.src = user.photoURL;

    document.getElementById('liar-auth-request')?.setAttribute('style', 'display:none !important');
    document.getElementById('liar-game-controls')?.setAttribute('style', 'display:block !important');
    loadLeaderboard();
}

function updateUI_LoggedOut() {
    const login = document.getElementById('login-btn');
    const info = document.getElementById('user-info');

    if (login) login.style.display = 'inline-block';
    if (info) info.style.display = 'none';

    document.getElementById('liar-auth-request')?.setAttribute('style', 'display:block !important');
    document.getElementById('liar-game-controls')?.setAttribute('style', 'display:none !important');
}

async function loadLeaderboard() {
    if (!db) return;
    try {
        const snap = await db.collection('users').orderBy('highScore', 'desc').limit(10).get();
        const list = document.getElementById('leaderboard-list');
        if (list) {
            list.innerHTML = '';
            let rank = 1;
            snap.forEach(doc => {
                const d = doc.data();
                const li = document.createElement('li');
                li.innerText = `${rank}. ${d.displayName}: ${d.highScore}`;

                // Highlight current user
                if (currentUser && doc.id === currentUser.uid) {
                    li.style.color = '#2ecc71';
                    li.style.fontWeight = 'bold';
                    li.innerText += ' (나)';
                }

                list.appendChild(li);
                rank++;
            });
        }
    } catch (e) { }
}

// --- Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    document.getElementById('login-btn')?.addEventListener('click', loginWithGoogle);
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    document.getElementById('liar-login-btn')?.addEventListener('click', loginWithGoogle);
});

if (document.readyState === 'complete') initAuth();
window.initAuth = initAuth;
