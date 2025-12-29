// ============================================================
// mafia_game.js - Mafia Game Logic (Multiplayer with Special Roles)
// ============================================================

// --- Game State Constants ---
const MAFIA_ROLES = {
    CITIZEN: { name: '시민', icon: '🙂', desc: '낮에 토론하고 투표하여 마피아를 찾으세요.', team: 'CITIZEN' },
    MAFIA: { name: '마피아', icon: '🔫', desc: '밤에 시민을 죽이고 정체를 숨기세요.', team: 'MAFIA' },
    DOCTOR: { name: '의사', icon: '🩺', desc: '밤에 한 명을 선택하여 치료합니다.', team: 'CITIZEN' },
    POLICE: { name: '경찰', icon: '👮', desc: '밤에 한 명의 직업을 조사합니다.', team: 'CITIZEN' },
    FRAUDSTER: { name: '사기꾼', icon: '🤡', desc: '투표로 처형당하면 단독 승리합니다.', team: 'NEUTRAL' }, // New Role
    BROKEN_GUNMAN: { name: '고장난 총잡이', icon: '🤠', desc: '낮에 한 명을 쏠 수 있습니다. (시민 사격 시 본인도 사망)', team: 'CITIZEN' } // New Role
};

let mafiaState = {
    roomId: null,
    isHost: false,
    myId: null,
    myName: null,
    players: [], // { id, name, role, isAlive, isReady }
    phase: 'LOBBY', // LOBBY, DAY, NIGHT, VOTE, END
    dayCount: 0,
    timer: 0,
    votes: {}, // { targetId: count } or { voterId: targetId }
    nightActions: {}, // { role: { actorId: targetId } }
    gunmanUsed: false, // Track if Broken Gunman used ability today
    chatLog: [],
    winner: null
};

// --- Firebase References ---
let mafiaRoomRef = null;
let mafiaUnsubscribe = null;

// ============================================================
// 1. Room Management (Lobby)
// ============================================================

function generateRandomId() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

document.getElementById('mafia-create-btn')?.addEventListener('click', createMafiaRoom);
document.getElementById('mafia-join-btn')?.addEventListener('click', joinMafiaRoom);
document.getElementById('mafia-start-btn')?.addEventListener('click', startMafiaGame);
document.getElementById('mafia-leave-btn')?.addEventListener('click', leaveMafiaRoom);
document.getElementById('mafia-add-bots-btn')?.addEventListener('click', addMafiaBots);
document.getElementById('mafia-chat-send-btn')?.addEventListener('click', sendMafiaChat);

// Rules Toggle
document.getElementById('toggle-mafia-rules-btn')?.addEventListener('click', () => {
    const rules = document.getElementById('mafia-game-rules');
    if (rules) rules.style.display = rules.style.display === 'none' ? 'block' : 'none';
});

// Enter key for chat input
document.getElementById('mafia-chat-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMafiaChat();
});

function createMafiaRoom() {
    if (!db) return alert("데이터베이스 연결 중입니다... 잠시 후 다시 시도해주세요.");
    const roomId = document.getElementById('mafia-room-id').value.toUpperCase() || generateRandomId();
    const user = firebase.auth().currentUser;
    const userName = user ? user.displayName : `Player-${Math.floor(Math.random() * 1000)}`;
    const userId = user ? user.uid : `guest-${Date.now()}`;

    mafiaRoomRef = db.collection('mafia_rooms').doc(roomId);

    mafiaRoomRef.set({
        hostId: userId,
        phase: 'LOBBY',
        dayCount: 0,
        players: [{ id: userId, name: userName, isAlive: true, role: null }],
        chatLog: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        enterMafiaLobby(roomId, userId, userName, true);
    });
}

function joinMafiaRoom() {
    const roomId = document.getElementById('mafia-room-id').value.toUpperCase();
    if (!roomId) return alert("방 코드를 입력하세요!");

    const user = firebase.auth().currentUser;
    const userName = user ? user.displayName : `Player-${Math.floor(Math.random() * 1000)}`;
    const userId = user ? user.uid : `guest-${Date.now()}`;

    mafiaRoomRef = db.collection('mafia_rooms').doc(roomId);

    db.runTransaction(async (t) => {
        const doc = await t.get(mafiaRoomRef);
        if (!doc.exists) throw "방이 존재하지 않습니다.";
        const data = doc.data();
        if (data.phase !== 'LOBBY') throw "이미 게임이 진행 중입니다.";

        const newPlayers = [...data.players, { id: userId, name: userName, isAlive: true, role: null }];
        t.update(mafiaRoomRef, { players: newPlayers });
    }).then(() => {
        enterMafiaLobby(roomId, userId, userName, false);
    }).catch(err => alert(err));
}

function enterMafiaLobby(roomId, userId, userName, isHost) {
    mafiaState.roomId = roomId;
    mafiaState.myId = userId;
    mafiaState.myName = userName;
    mafiaState.isHost = isHost;

    document.getElementById('mafia-entry').style.display = 'none';
    document.getElementById('mafia-lobby').style.display = 'block';
    document.getElementById('mafia-display-room-id').innerText = roomId;

    if (isHost) document.getElementById('mafia-host-controls').style.display = 'flex';

    // Subscribe to room updates
    mafiaUnsubscribe = mafiaRoomRef.onSnapshot(snapshot => {
        if (!snapshot.exists) return;
        const data = snapshot.data();
        mafiaState.players = data.players;
        mafiaState.phase = data.phase;
        mafiaState.chatLog = data.chatLog || [];

        updateMafiaLobbyUI();
        syncMafiaGameState(data);
    });
}

function leaveMafiaRoom() {
    if (mafiaUnsubscribe) mafiaUnsubscribe();
    location.reload(); // Simple reload to reset
}

function updateMafiaLobbyUI() {
    const list = document.getElementById('mafia-player-list');
    list.innerHTML = "";
    mafiaState.players.forEach(p => {
        const li = document.createElement('li');
        li.innerText = `${p.name} ${p.id === mafiaState.myId ? '(나)' : ''}`;
        list.appendChild(li);
    });

    // Update waiting message
    const waitingMsg = document.getElementById('mafia-waiting-msg');
    waitingMsg.innerText = `현재 ${mafiaState.players.length}명 대기 중...`;
}

// ============================================================
// 2. Role Assignment & Game Start
// ============================================================

function addMafiaBots() {
    if (mafiaState.players.length >= 8) return alert("최대 인원입니다.");
    const botId = `bot-${Date.now()}`;
    const botName = `Bot-${Math.floor(Math.random() * 100)}`;

    // Check if host
    if (!mafiaState.isHost) return;

    const newPlayers = [...mafiaState.players, { id: botId, name: botName, isAlive: true, role: null }];
    mafiaRoomRef.update({ players: newPlayers });
}

function startMafiaGame() {
    // Allow single player for testing (removed 4-player minimum)

    const assignedPlayers = assignRoles([...mafiaState.players]);

    mafiaRoomRef.update({
        players: assignedPlayers,
        phase: 'DAY', // Start with Day for discussion
        dayCount: 1,
        nightActions: {},
        votes: {},
        mafiaChat: [],
        doctorChat: [],
        policeChat: []
    });
}

function assignRoles(players) {
    // Read custom role counts from UI (host settings)
    const mafiaCount = parseInt(document.getElementById('role-mafia-count')?.value || 1);
    const doctorCount = parseInt(document.getElementById('role-doctor-count')?.value || 1);
    const policeCount = parseInt(document.getElementById('role-police-count')?.value || 1);
    const fraudsterCount = parseInt(document.getElementById('role-fraudster-count')?.value || 0);
    const gunmanCount = parseInt(document.getElementById('role-gunman-count')?.value || 0);

    let roles = [];

    // Add specified roles
    for (let i = 0; i < mafiaCount; i++) roles.push('MAFIA');
    for (let i = 0; i < doctorCount; i++) roles.push('DOCTOR');
    for (let i = 0; i < policeCount; i++) roles.push('POLICE');
    for (let i = 0; i < fraudsterCount; i++) roles.push('FRAUDSTER');
    for (let i = 0; i < gunmanCount; i++) roles.push('BROKEN_GUNMAN');

    // Fill remaining with Citizens
    const remainingCount = players.length - roles.length;
    for (let i = 0; i < remainingCount; i++) roles.push('CITIZEN');

    // Validate: must have at least 1 mafia and total roles should match player count
    if (roles.length > players.length) {
        alert(`직업 수(${roles.length})가 플레이어 수(${players.length})보다 많습니다! 설정을 조정해주세요.`);
        return null;
    }

    // Shuffle roles
    roles = roles.sort(() => Math.random() - 0.5);

    // Assign to players
    return players.map((p, i) => {
        const rKey = roles[i] || 'CITIZEN';
        return { ...p, role: rKey, isAlive: true };
    });
}

// ============================================================
// 3. Game Loop & UI Sync
// ============================================================

function syncMafiaGameState(data) {
    // Phase Transition Handling
    if (mafiaState.phase !== data.phase) {
        // Phase Changed logic (e.g., play sound, show alert)
    }

    // Role Info Display (Only for Me)
    const myPlayer = data.players.find(p => p.id === mafiaState.myId);
    if (myPlayer && myPlayer.role && mafiaState.phase !== 'LOBBY') {
        const rInfo = MAFIA_ROLES[myPlayer.role];
        document.getElementById('my-role-icon').innerText = rInfo.icon;
        document.getElementById('my-role-name').innerText = rInfo.name;
        document.getElementById('my-role-desc').innerText = rInfo.desc;

        // Color coding
        const card = document.getElementById('mafia-role-card');
        if (myPlayer.role === 'MAFIA') card.style.borderColor = '#e74c3c'; // Red
        else if (myPlayer.role === 'POLICE') card.style.borderColor = '#3498db'; // Blue
        else if (myPlayer.role === 'DOCTOR') card.style.borderColor = '#2ecc71'; // Green
        else card.style.borderColor = '#f1c40f'; // Yellow/Default
    }

    // Switch Screens based on Phase
    if (data.phase === 'LOBBY') {
        // Handled in enterLobby
    } else if (data.phase === 'VICTORY') {
        showMafiaResult(data);
    } else {
        document.getElementById('mafia-lobby').style.display = 'none';
        document.getElementById('mafia-game-play').style.display = 'block';
        updateGamePlayUI(data);
    }
}

function updateGamePlayUI(data) {
    const indicator = document.getElementById('game-phase-indicator');
    const nightUI = document.getElementById('night-action-ui');
    const voteUI = document.getElementById('mafia-vote-ui');
    const gunmanUI = document.getElementById('gunman-action-ui');

    // Reset UIs
    nightUI.style.display = 'none';
    voteUI.style.display = 'none';
    gunmanUI.style.display = 'none';

    // Dead Check
    const myPlayer = data.players.find(p => p.id === mafiaState.myId);
    const isDead = myPlayer && !myPlayer.isAlive;

    if (isDead) {
        indicator.innerText = "👻 당신은 사망했습니다... (관전 중)";
        indicator.style.background = "#555";
        return; // Spectator mode
    }

    // Phase Logic
    if (data.phase === 'NIGHT') {
        indicator.innerText = `🌙 ${data.dayCount}일차 밤`;
        indicator.style.background = "#2c3e50";
        document.getElementById('mafia-game-play').style.background = "#2c3e50"; // Dark BG

        // Role abilities
        if (['MAFIA', 'POLICE', 'DOCTOR'].includes(myPlayer.role)) {
            nightUI.style.display = 'block';
            renderTargetButtons('night-targets', data.players, handleNightAction);
        }

        // Show Role-Specific Night Chat Rooms
        document.getElementById('mafia-night-chat').style.display = myPlayer.role === 'MAFIA' ? 'block' : 'none';
        document.getElementById('doctor-night-chat').style.display = myPlayer.role === 'DOCTOR' ? 'block' : 'none';
        document.getElementById('police-night-chat').style.display = myPlayer.role === 'POLICE' ? 'block' : 'none';

        // Update private chat logs
        if (data.mafiaChat) updatePrivateChatLog('mafia-chat-log', data.mafiaChat);
        if (data.doctorChat) updatePrivateChatLog('doctor-chat-log', data.doctorChat);
        if (data.policeChat) updatePrivateChatLog('police-chat-log', data.policeChat);
    }
    else if (data.phase === 'DAY') {
        indicator.innerText = `☀️ ${data.dayCount}일차 낮 (토론)`;
        indicator.style.background = "#f39c12";
        document.getElementById('mafia-game-play').style.background = "#222";

        // Gunman Ability
        if (myPlayer.role === 'BROKEN_GUNMAN' && !data.gunmanUsed) {
            gunmanUI.style.display = 'block';
            renderTargetButtons('gunman-targets', data.players, handleGunmanShot);
        }

        // Host controls discussion timer/vote start
        if (mafiaState.isHost) {
            // Add a button to Start Vote
            if (!document.getElementById('start-vote-btn')) {
                const btn = document.createElement('button');
                btn.id = 'start-vote-btn';
                btn.className = 'primary-btn';
                btn.innerText = "🗳️ 투표 시작";
                btn.onclick = () => mafiaRoomRef.update({ phase: 'VOTE', votes: {} });
                document.getElementById('mafia-log-container').after(btn);
            }
        }
    }
    else if (data.phase === 'VOTE') {
        indicator.innerText = `🗳️ 투표 진행 중`;
        indicator.style.background = "#e74c3c";
        voteUI.style.display = 'block';
        renderTargetButtons('vote-targets', data.players, handleVoteAction);
    }

    // Chat Update
    updateChatLog(data.chatLog);
}

// ============================================================
// 4. Actions & Logic (Night/Day/Vote)
// ============================================================

function renderTargetButtons(containerId, players, callback) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    players.filter(p => p.isAlive && p.id !== mafiaState.myId).forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'secondary-btn';
        btn.innerText = p.name;
        btn.onclick = () => callback(p.id);
        container.appendChild(btn);
    });
}

function handleNightAction(targetId) {
    const myPlayer = mafiaState.players.find(p => p.id === mafiaState.myId);
    // Submit action to Firebase (simplified: overwrite for now)
    // Ideally, use a sub-collection or proper map update
    const actionKey = `nightActions.${myPlayer.role}`;
    // Using object update via dot notation in firestore
    let updateData = {};
    updateData[`nightActions.${myPlayer.role}`] = targetId;

    mafiaRoomRef.update(updateData).then(() => {
        alert("행동을 선택했습니다.");
        document.getElementById('night-action-ui').style.display = 'none';

        // If Host, check if all roles acted and process Night
        if (mafiaState.isHost) checkNightResolution();
    });
}

function handleGunmanShot(targetId) {
    // Implement Gunman logic directly here (Host logic usually better, but for simplicity)
    const target = mafiaState.players.find(p => p.id === targetId);

    if (target.role === 'MAFIA') {
        // Mafia dies
        killPlayer(targetId, "🤠 총잡이에 의해 마피아가 사살되었습니다!");
    } else {
        // Citizen mistake -> Both die
        killPlayer(targetId, "🤠 탕! 오발 사고! 무고한 시민이었습니다.");
        killPlayer(mafiaState.myId, "🤠 총잡이는 죄책감에 자결했습니다."); // Kill self
    }

    mafiaRoomRef.update({ gunmanUsed: true });
}

function handleVoteAction(targetId) {
    // Increment vote count for target
    // We need a transaction to safely increment votes
    // Simplified: Just pushing to an array or map
    // For this prototype, let's assume Host tallies votes or just simplified voting
    alert("투표했습니다. (로직 구현 필요)");
}

// ============================================================
// 5. Chat System
// ============================================================

function sendMafiaChat() {
    const input = document.getElementById('mafia-chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    // Check constraints (Dead/Night)
    const myPlayer = mafiaState.players.find(p => p.id === mafiaState.myId);
    if (!myPlayer.isAlive) return alert("죽은 자는 말이 없습니다.");
    // Night chat only for Mafia? For simplicity, allow all or restrict in real logic

    const chatMsg = { sender: mafiaState.myName, msg: msg, time: Date.now() };

    mafiaRoomRef.update({
        chatLog: firebase.firestore.FieldValue.arrayUnion(chatMsg)
    });
    input.value = "";
}

function updateChatLog(logs) {
    const container = document.getElementById('mafia-game-log');
    container.innerHTML = "";
    logs.forEach(l => {
        const div = document.createElement('div');
        div.innerHTML = `<span style="color:#f1c40f;">[${l.sender}]</span> ${l.msg}`;
        container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
}

function updatePrivateChatLog(containerId, logs) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    logs.forEach(l => {
        const div = document.createElement('div');
        div.style.marginBottom = "4px";
        div.innerHTML = `<span style="font-weight:bold; color:#fff;">[${l.sender}]</span> ${l.msg}`;
        container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
}

// Role-specific private chat send handlers
function sendPrivateChat(role, inputId, chatField) {
    const input = document.getElementById(inputId);
    const msg = input.value.trim();
    if (!msg) return;

    const myPlayer = mafiaState.players.find(p => p.id === mafiaState.myId);
    if (!myPlayer || myPlayer.role !== role) return alert("이 채팅방을 사용할 수 없습니다.");

    const chatMsg = { sender: mafiaState.myName, msg: msg, time: Date.now() };

    mafiaRoomRef.update({
        [chatField]: firebase.firestore.FieldValue.arrayUnion(chatMsg)
    });
    input.value = "";
}

// Event Listeners for Private Chats
document.getElementById('mafia-private-chat-send')?.addEventListener('click', () => {
    sendPrivateChat('MAFIA', 'mafia-private-chat-input', 'mafiaChat');
});
document.getElementById('doctor-private-chat-send')?.addEventListener('click', () => {
    sendPrivateChat('DOCTOR', 'doctor-private-chat-input', 'doctorChat');
});
document.getElementById('police-private-chat-send')?.addEventListener('click', () => {
    sendPrivateChat('POLICE', 'police-private-chat-input', 'policeChat');
});

// ============================================================
// 6. Win Conditions & Result
// ============================================================

function killPlayer(playerId, reasonMsg) {
    // Only Host should call this usually to update state
    // Or runTransaction to set isAlive: false
    // Also log the death message
}

function checkWinCondition() {
    // Mafia >= Citizens
    // Mafia == 0
    // Fraudster executed
}

function showMafiaResult(data) {
    document.getElementById('mafia-game-play').style.display = 'none';
    document.getElementById('mafia-result').style.display = 'block';

    /* display winner */
}
