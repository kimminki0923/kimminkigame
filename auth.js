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
    if (!loginBtn) return;
    loginBtn.style.display = 'none';
    userInfoEl.style.display = 'flex';
    userNameEl.innerText = user.displayName;
    userImgEl.src = user.photoURL;
}

function updateUI_LoggedOut() {
    if (!loginBtn) return;
    loginBtn.style.display = 'inline-block';
    userInfoEl.style.display = 'none';
    userImgEl.src = "";
    userNameEl.innerText = "";
}

// --- Actions ---
function loginWithGoogle() {
    if (!isCloudEnabled) {
        alert("⚠️ Firebase 설정이 필요합니다!\n코드를 열어 'firebaseConfig' 부분을 채워주세요.");
        return;
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch((error) => {
        console.error("Login Failed:", error);
        alert("로그인 실패: " + error.message);
    });
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
if (loginBtn) loginBtn.addEventListener('click', loginWithGoogle);
document.getElementById('logout-btn').addEventListener('click', logout);
