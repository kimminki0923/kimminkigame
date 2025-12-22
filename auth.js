// --- Firebase Configuration ---
// 나중에 Firebase 콘솔에서 복사한 값을 여기에 채워넣으세요!
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID"
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

// --- Data Management (Unified) ---

// 1. Load
async function loadData() {
    if (currentUser && isCloudEnabled) {
        // Cloud load is handled by auth listener, but exposing this if needed
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
            updateGameData(data.highScore, data.coinCount);
            console.log("☁️ Data Loaded from Cloud:", data);
        } else {
            console.log("☁️ No cloud data found, creating new.");
            saveCloudData(0, 0); // Init
        }
    } catch (e) {
        console.error("Cloud Load Error:", e);
    }
}

function loadLocalData() {
    const savedScore = localStorage.getItem('infinite_stairs_highScore') || 0;
    const savedCoins = localStorage.getItem('infinite_stairs_coins') || 0;
    updateGameData(parseInt(savedScore), parseInt(savedCoins));
    console.log("💾 Data Loaded from LocalStorage");
}

// 2. Save
function saveData(highScore, coinCount) {
    // Always save local first (backup)
    localStorage.setItem('infinite_stairs_highScore', highScore);
    localStorage.setItem('infinite_stairs_coins', coinCount);

    if (currentUser && isCloudEnabled) {
        saveCloudData(highScore, coinCount);
    }
}

function saveCloudData(score, coins) {
    db.collection('users').doc(currentUser.uid).set({
        highScore: score,
        coinCount: coins,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(() => {
        console.log("☁️ Cloud Save Success");
    }).catch((e) => {
        console.error("Cloud Save Failed:", e);
    });
}

// Bridge to script.js
function updateGameData(score, coins) {
    // Defined in script.js (We will add this bridge)
    if (window.setGameData) {
        window.setGameData(score, coins);
    }
}

// Bind Events
if (loginBtn) loginBtn.addEventListener('click', loginWithGoogle);
document.getElementById('logout-btn').addEventListener('click', logout);
