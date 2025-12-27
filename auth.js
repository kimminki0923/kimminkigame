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
        const localStairSkins = JSON.parse(localStorage.getItem('ownedStairSkins') || '["default"]');
        const localStairSkin = localStorage.getItem('currentStairSkin') || 'default';
        const localPets = JSON.parse(localStorage.getItem('ownedPets') || '["none"]');
        const localPet = localStorage.getItem('currentPet') || 'none';

        let finalScore = localScore;
        let finalCoins = localCoins;
        let finalSkins = localSkins;
        let finalSkin = localSkin;
        let finalStairSkins = localStairSkins;
        let finalStairSkin = localStairSkin;
        let finalPets = localPets;
        let finalPet = localPet;
        let needSync = false;

        if (doc.exists) {
            const data = doc.data();
            const cloudScore = data.highScore || 0;
            const cloudCoins = data.coinCount || 0;
            const cloudSkins = data.ownedSkins || ['default'];
            const cloudStairSkins = data.ownedStairSkins || ['default'];
            const cloudPets = data.ownedPets || ['none'];

            // Merge Strategy: MAX
            if (cloudScore > finalScore) finalScore = cloudScore;
            if (cloudCoins > finalCoins) finalCoins = cloudCoins;

            // Merge Skins (Union)
            const skinSet = new Set([...finalSkins, ...cloudSkins]);
            finalSkins = Array.from(skinSet);

            const stairSkinSet = new Set([...finalStairSkins, ...cloudStairSkins]);
            finalStairSkins = Array.from(stairSkinSet);

            const petSet = new Set([...finalPets, ...cloudPets]);
            finalPets = Array.from(petSet);

            // Prefer Cloud if different
            if (data.currentSkin && finalSkins.includes(data.currentSkin)) {
                finalSkin = data.currentSkin;
            }
            if (data.currentStairSkin && finalStairSkins.includes(data.currentStairSkin)) {
                finalStairSkin = data.currentStairSkin;
            }
            if (data.currentPet && finalPets.includes(data.currentPet)) {
                finalPet = data.currentPet;
            }

            if (localScore > cloudScore || localCoins > cloudCoins || finalSkins.length > cloudSkins.length || finalStairSkins.length > cloudStairSkins.length || finalPets.length > cloudPets.length) {
                needSync = true;
            }
        } else {
            // New user on cloud, but has local data -> Sync up!
            needSync = true;
        }

        if (needSync) {
            console.log("☁️ Syncing Local Progress to Cloud...");
            saveCloudData(finalScore, finalCoins, finalSkins, finalSkin, finalStairSkins, finalStairSkin, finalPets, finalPet);
        }

        applyGameData(finalScore, finalCoins, finalSkins, finalSkin, finalStairSkins, finalStairSkin, finalPets, finalPet);

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
    const stairSkins = JSON.parse(localStorage.getItem('ownedStairSkins') || '["default"]');
    const stairSkin = localStorage.getItem('currentStairSkin') || 'default';
    const pets = JSON.parse(localStorage.getItem('ownedPets') || '["none"]');
    const pet = localStorage.getItem('currentPet') || 'none';
    applyGameData(s, c, skins, skin, stairSkins, stairSkin, pets, pet);
}

// --- Apply to Game (Bridge) ---
function applyGameData(score, coins, skins, currentSkin, stairSkins, currentStairSkin, pets, currentPet) {
    const trySet = (attempts = 0) => {
        if (window.setGameData) {
            window.setGameData(score || 0, coins || 0, skins || ['default'], currentSkin || 'default', stairSkins || ['default'], currentStairSkin || 'default', pets || ['none'], currentPet || 'none');
        } else if (attempts < 20) {
            setTimeout(() => trySet(attempts + 1), 200);
        }
    };
    trySet();
}

// --- Save Data ---
function saveCloudData(score, coins, skins, currentSkin, stairSkins, currentStairSkin, pets, currentPet) {
    if (!db || !currentUser) return;

    db.collection('users').doc(currentUser.uid).set({
        highScore: score,
        coinCount: coins,
        ownedSkins: skins,
        currentSkin: currentSkin,
        ownedStairSkins: stairSkins || ['default'],
        currentStairSkin: currentStairSkin || 'default',
        ownedPets: pets || ['none'],
        currentPet: currentPet || 'none',
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(() => {
        console.log("☁️ Cloud Save Success");
        loadLeaderboard();
    }).catch(e => console.error("Cloud Save Failed", e));
}

window.saveData = function (score, coins, skins, currentSkin, stairSkins, currentStairSkin, pets, currentPet) {
    localStorage.setItem('infinite_stairs_highScore', score);
    localStorage.setItem('infinite_stairs_coins', coins);
    if (skins) localStorage.setItem('ownedSkins', JSON.stringify(skins));
    if (currentSkin) localStorage.setItem('currentSkin', currentSkin);
    if (stairSkins) localStorage.setItem('ownedStairSkins', JSON.stringify(stairSkins));
    if (currentStairSkin) localStorage.setItem('currentStairSkin', currentStairSkin);
    if (pets) localStorage.setItem('ownedPets', JSON.stringify(pets));
    if (currentPet) localStorage.setItem('currentPet', currentPet);

    if (currentUser && isCloudEnabled) {
        saveCloudData(score, coins, skins, currentSkin, stairSkins, currentStairSkin, pets, currentPet);
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

    // --- Temporary Boost for Tester '김민기' ---
    if (user.displayName && user.displayName.includes('김민기')) {
        const currentHS = parseInt(localStorage.getItem('infinite_stairs_highScore') || 0);
        if (currentHS < 1000) {
            console.log("🛠️ Admin: Boosting highScore to 1000 for unlock test...");
            localStorage.setItem('infinite_stairs_highScore', '1000');
            if (window.saveData) {
                // This will sync to both localStorage and Firebase
                window.saveData(1000, parseInt(localStorage.getItem('infinite_stairs_coins') || 0), JSON.parse(localStorage.getItem('ownedSkins') || '["default"]'), localStorage.getItem('currentSkin') || 'default');
            }
            // Update local display if initialized
            const hsEl = document.getElementById('high-score');
            if (hsEl) hsEl.innerText = '1000';
            if (typeof updateUnlockStatus === 'function') updateUnlockStatus();
        }
    }

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
