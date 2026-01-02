// Flight Multiplayer - Room-based multiplayer using Firebase
// Uses Firestore for room management and Realtime Database for position sync

let flightRoomId = null;
let flightRoomUnsubscribe = null;
let positionSyncInterval = null;
let otherPlayersData = {};
const MAX_PLAYERS = 6;
const SYNC_INTERVAL_MS = 150; // ~6-7 times per second

// Get Firebase references
function getDb() {
    return window.db || firebase.firestore();
}

function getRtdb() {
    return window.rtdb || firebase.database();
}

// Create a new flight room
async function createFlightRoom() {
    if (!window.currentUser) return alert("로그인이 필요합니다.");

    const roomId = document.getElementById('flight-room-id').value ||
        Math.floor(1000 + Math.random() * 9000).toString();

    try {
        await getDb().collection('flightRooms').doc(roomId).set({
            host: window.currentUser.uid,
            status: 'waiting',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            players: {
                [window.currentUser.uid]: {
                    name: window.currentUser.displayName || '익명',
                    photo: window.currentUser.photoURL || '',
                    joinedAt: Date.now()
                }
            }
        });

        joinFlightRoom(roomId);
    } catch (e) {
        console.error(e);
        alert("방 생성 실패: " + e.message);
    }
}

// Join an existing flight room
async function joinFlightRoom(roomId) {
    if (!window.currentUser) return alert("로그인이 필요합니다.");
    if (!roomId) roomId = document.getElementById('flight-room-id').value;
    if (!roomId) return alert("방 코드를 입력하세요.");

    const docRef = getDb().collection('flightRooms').doc(roomId);

    try {
        await getDb().runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            if (!doc.exists) throw "존재하지 않는 방입니다.";

            const data = doc.data();
            const players = data.players || {};

            if (Object.keys(players).length >= MAX_PLAYERS && !players[window.currentUser.uid]) {
                throw "방이 꽉 찼습니다. (최대 6명)";
            }

            players[window.currentUser.uid] = {
                name: window.currentUser.displayName || '익명',
                photo: window.currentUser.photoURL || '',
                joinedAt: Date.now()
            };

            transaction.update(docRef, { players: players });
        });

        flightRoomId = roomId;

        // Update UI
        document.getElementById('flight-lobby').style.display = 'none';
        document.getElementById('flight-waiting').style.display = 'flex';
        document.getElementById('flight-display-room-id').innerText = roomId;

        // Listen for room changes
        if (flightRoomUnsubscribe) flightRoomUnsubscribe();
        flightRoomUnsubscribe = docRef.onSnapshot(snapshot => {
            if (snapshot.exists) syncFlightRoom(snapshot.data());
        });

    } catch (e) {
        alert("입장 실패: " + e);
    }
}

// Sync room state
function syncFlightRoom(data) {
    const isHost = data.host === window.currentUser.uid;
    const players = Object.entries(data.players || {}).sort((a, b) => a[1].joinedAt - b[1].joinedAt);

    // Update player list
    const playerList = document.getElementById('flight-players-ul');
    playerList.innerHTML = '';

    players.forEach(([uid, p]) => {
        const li = document.createElement('li');
        li.className = 'player-tag' + (uid === data.host ? ' is-host' : '');
        li.style.cssText = 'background:rgba(59,130,246,0.3); padding:8px 16px; border-radius:20px; color:#f1f5f9; font-weight:600;';
        li.innerText = (uid === data.host ? '👑 ' : '') + p.name;
        playerList.appendChild(li);
    });

    // Update player count
    document.getElementById('flight-player-count').innerText = `${players.length}/${MAX_PLAYERS} 플레이어`;

    // Show start button for host
    document.getElementById('flight-start-btn').style.display = isHost ? 'block' : 'none';

    // If game started, launch the game
    if (data.status === 'playing') {
        startFlightGame();
    }
}

// Start the game (host only)
async function hostStartFlightGame() {
    if (!flightRoomId) return;

    await getDb().collection('flightRooms').doc(flightRoomId).update({
        status: 'playing'
    });
}

// Actually start the flight game
function startFlightGame() {
    document.getElementById('flight-lobby').style.display = 'none';
    document.getElementById('flight-waiting').style.display = 'none';
    document.getElementById('flight-game-container').style.display = 'block';

    // Import and start the flight simulator
    import('./flight.js?v=3.3').then(m => {
        m.startFlightSimulator();
        m.focusFlight();

        // Start position sync
        startPositionSync();

        // Listen for other players' positions
        listenForOtherPlayers();
    });
}

// Start solo mode (no multiplayer)
function startSoloFlight() {
    document.getElementById('flight-lobby').style.display = 'none';
    document.getElementById('flight-waiting').style.display = 'none';
    document.getElementById('flight-game-container').style.display = 'block';

    import('./flight.js?v=3.3').then(m => {
        m.startFlightSimulator();
        m.focusFlight();
    });
}

// Leave the flight room
async function leaveFlightRoom() {
    if (flightRoomUnsubscribe) flightRoomUnsubscribe();
    stopPositionSync();

    if (flightRoomId && window.currentUser) {
        const update = {};
        update[`players.${window.currentUser.uid}`] = firebase.firestore.FieldValue.delete();
        await getDb().collection('flightRooms').doc(flightRoomId).update(update).catch(() => { });

        // Remove from realtime database
        getRtdb().ref(`flightPositions/${flightRoomId}/${window.currentUser.uid}`).remove().catch(() => { });
    }

    flightRoomId = null;
    otherPlayersData = {};

    document.getElementById('flight-lobby').style.display = 'flex';
    document.getElementById('flight-waiting').style.display = 'none';
    document.getElementById('flight-game-container').style.display = 'none';
}

// Position Sync Functions
function startPositionSync() {
    if (!flightRoomId || !window.currentUser) return;

    positionSyncInterval = setInterval(() => {
        const pos = window.getPlayerPosition ? window.getPlayerPosition() : null;
        if (!pos) return;

        getRtdb().ref(`flightPositions/${flightRoomId}/${window.currentUser.uid}`).set({
            name: window.currentUser.displayName || '익명',
            x: Math.round(pos.x),
            y: Math.round(pos.y),
            z: Math.round(pos.z),
            rx: Math.round(pos.rx * 100) / 100,
            ry: Math.round(pos.ry * 100) / 100,
            rz: Math.round(pos.rz * 100) / 100,
            ts: firebase.database.ServerValue.TIMESTAMP
        });
    }, SYNC_INTERVAL_MS);
}

function stopPositionSync() {
    if (positionSyncInterval) {
        clearInterval(positionSyncInterval);
        positionSyncInterval = null;
    }
}

function listenForOtherPlayers() {
    if (!flightRoomId) return;

    getRtdb().ref(`flightPositions/${flightRoomId}`).on('value', (snapshot) => {
        const data = snapshot.val() || {};

        Object.entries(data).forEach(([uid, posData]) => {
            if (uid === window.currentUser?.uid) return; // Skip self

            otherPlayersData[uid] = posData;

            // Update airplane in scene
            if (window.updateOtherPlayer) {
                window.updateOtherPlayer(uid, posData);
            }
        });

        // Remove players who left
        if (window.removeOtherPlayer) {
            Object.keys(window.otherPlayersInScene || {}).forEach(uid => {
                if (!data[uid]) {
                    window.removeOtherPlayer(uid);
                }
            });
        }
    });
}

// Event Listeners
document.getElementById('flight-create-btn')?.addEventListener('click', createFlightRoom);
document.getElementById('flight-join-btn')?.addEventListener('click', () => joinFlightRoom());
document.getElementById('flight-solo-btn')?.addEventListener('click', startSoloFlight);
document.getElementById('flight-start-btn')?.addEventListener('click', hostStartFlightGame);
document.getElementById('flight-leave-btn')?.addEventListener('click', leaveFlightRoom);

// Export for use from flight.js
window.flightMultiplayer = {
    getRoomId: () => flightRoomId,
    getOtherPlayers: () => otherPlayersData
};
