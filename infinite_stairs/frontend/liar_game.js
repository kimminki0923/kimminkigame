const liarTopics = {
    food: ["사과", "바나나", "포도", "피자", "치킨", "햄버거", "초밥", "라면", "파스타", "도넛", "삼겹살", "떡볶이", "마라탕"],
    animal: ["코끼리", "기린", "펭귄", "호랑이", "사자", "토끼", "강아지", "고양이", "햄스터", "판다", "악어", "독수리", "공룡"],
    object: ["컴퓨터", "스마트폰", "텔레비전", "냉장고", "세탁기", "의자", "책상", "연필", "지우개", "안경", "시계", "침대", "거울"],
    sports: ["축구", "농구", "야구", "배구", "수영", "테니스", "골프", "볼링", "양궁", "태권도", "마라톤", "스케이트", "펜싱"],
    place: ["학교", "병원", "경찰서", "공원", "바다", "산", "서울", "미국", "공항", "도서관", "영화관", "백화점", "박물관"]
};

let currentRoomId = null;
let roomUnsubscribe = null;
let chatUnsubscribe = null;

function isMyTurn(data) {
    return data.status === 'turn_based' && data.turnOrder[data.currentTurnIndex] === currentUser.uid;
}

async function createLiarRoom() {
    if (!currentUser) return alert("로그인이 필요합니다.");
    const roomId = document.getElementById('liar-room-id').value || Math.floor(1000 + Math.random() * 9000).toString();
    const maxScore = parseInt(document.getElementById('liar-max-score').value) || 3;

    try {
        await db.collection('rooms').doc(roomId).set({
            host: currentUser.uid,
            status: 'lobby',
            players: { [currentUser.uid]: { name: currentUser.displayName, photo: currentUser.photoURL, joinedAt: Date.now() } },
            scores: { [currentUser.uid]: 0 },
            maxScore: maxScore,
            topic: 'random',
            liarId: null, word: "", revealed: false, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        joinLiarRoom(roomId);
    } catch (e) {
        console.error(e); alert("방 생성 실패: " + e.message);
    }
}

async function joinLiarRoom(roomId) {
    if (!currentUser) return alert("로그인이 필요합니다.");
    if (!roomId) roomId = document.getElementById('liar-room-id').value;
    if (!roomId) return alert("방 코드를 입력하세요.");

    const docRef = db.collection('rooms').doc(roomId);

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            if (!doc.exists) throw "존재하지 않는 방입니다.";
            const data = doc.data();
            const players = data.players || {};

            if (Object.keys(players).length >= 30 && !players[currentUser.uid]) throw "방이 꽉 찼습니다.";

            players[currentUser.uid] = { name: currentUser.displayName, photo: currentUser.photoURL, joinedAt: Date.now() };
            const scores = data.scores || {};
            if (scores[currentUser.uid] === undefined) scores[currentUser.uid] = 0;

            transaction.update(docRef, { players: players, scores: scores });
        });

        currentRoomId = roomId;
        document.getElementById('liar-entry').style.display = 'none';
        document.getElementById('liar-lobby').style.display = 'block';
        document.getElementById('display-room-id').innerText = roomId;
        document.getElementById('liar-chat-section').style.display = 'block';

        if (roomUnsubscribe) roomUnsubscribe();
        roomUnsubscribe = docRef.onSnapshot(snapshot => { if (snapshot.exists) syncLiarRoom(snapshot.data()); });

        if (chatUnsubscribe) chatUnsubscribe();
        const chatList = document.getElementById('liar-chat-messages');
        chatList.innerHTML = '';
        chatUnsubscribe = docRef.collection('messages').orderBy('timestamp').onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const msg = change.doc.data();
                    const isMine = msg.uid === currentUser.uid;
                    const div = document.createElement('div');
                    div.className = 'chat-wrapper' + (isMine ? ' mine' : '');
                    div.innerHTML = `<div class="chat-msg ${isMine ? 'mine' : ''}"><div class="chat-name">${msg.name}</div><div class="chat-text">${msg.text}</div></div>`;
                    chatList.appendChild(div);
                    chatList.scrollTop = chatList.scrollHeight;
                }
            });
        });
    } catch (e) { alert("입장 실패: " + e); }
}

function syncLiarRoom(data) {
    const isHost = data.host === currentUser.uid;
    const players = Object.entries(data.players || {}).sort((a, b) => a[1].joinedAt - b[1].joinedAt);

    const scoreList = document.getElementById('score-list');
    scoreList.innerHTML = '';
    const scores = data.scores || {};
    let maxScoreReached = false;
    let grandWinnerName = "";

    players.forEach(([uid, p]) => {
        const score = scores[uid] || 0;
        const li = document.createElement('li');
        li.innerText = `${p.name}: ${score}점`;
        if (score >= data.maxScore) { li.style.color = '#f1c40f'; maxScoreReached = true; grandWinnerName = p.name; }
        scoreList.appendChild(li);
    });
    document.getElementById('score-limit').innerText = `(목표: ${data.maxScore}점)`;
    document.getElementById('scoreboard').style.display = 'block';

    const playerList = document.getElementById('player-list');
    playerList.innerHTML = '';
    players.forEach(([uid, p]) => {
        const li = document.createElement('li');
        li.className = 'player-tag' + (uid === data.host ? ' is-host' : '');
        li.innerText = p.name;
        playerList.appendChild(li);
    });

    const settingsDiv = document.getElementById('room-settings');
    if (isHost) { settingsDiv.style.display = 'block'; } else { settingsDiv.style.display = 'none'; }

    document.getElementById('liar-start-multi-btn').style.display = (isHost && data.status === 'lobby') ? 'inline-block' : 'none';
    document.getElementById('waiting-msg').style.display = (data.status === 'lobby') ? 'block' : 'none';
    document.getElementById('display-max-score').innerText = data.maxScore || 3;

    const lobbyDiv = document.getElementById('liar-lobby');
    const gameDiv = document.getElementById('liar-game-play');
    const resultDiv = document.getElementById('liar-result');
    const chatSection = document.getElementById('liar-chat-section');
    const descLog = document.getElementById('description-log');
    const voteSection = document.getElementById('liar-vote-section');
    const guessSection = document.getElementById('liar-guess-section');
    const overlay = document.getElementById('turn-overlay');

    document.getElementById('liar-host-controls-play').style.display = 'none';
    document.getElementById('liar-discussion-msg').style.display = 'none';
    document.getElementById('liar-reveal-multi-btn').style.display = 'none';
    voteSection.style.display = 'none';
    guessSection.style.display = 'none';
    descLog.style.display = 'none';
    overlay.style.display = 'none';
    chatSection.style.display = (data.status === 'voting' || data.status === 'liar_guess') ? 'none' : 'block';

    if (data.descriptions && data.descriptions.length > 0) {
        descLog.style.display = 'block';
        const descList = document.getElementById('description-list');
        descList.innerHTML = '';
        data.descriptions.forEach(desc => {
            const row = document.createElement('div');
            row.className = 'desc-row';
            row.innerHTML = `<span class="desc-name">${desc.name}</span><span class="desc-text">${desc.text}</span>`;
            descList.appendChild(row);
        });
    }

    if (data.status === 'lobby') {
        lobbyDiv.style.display = 'block'; gameDiv.style.display = 'none'; resultDiv.style.display = 'none';
    } else if (data.status === 'playing') {
        lobbyDiv.style.display = 'none'; gameDiv.style.display = 'block'; resultDiv.style.display = 'none';
        const card = document.getElementById('liar-card');
        const topicTxt = data.topicName ? `주제: ${data.topicName}` : "";
        if (data.liarId === currentUser.uid) {
            card.dataset.word = '당신은 라이어입니다!';
            document.getElementById('liar-card-topic').innerText = topicTxt;
        } else {
            card.dataset.word = `제시어: ${data.word}`;
            document.getElementById('liar-card-topic').innerText = topicTxt;
        }
        document.getElementById('liar-host-controls-play').style.display = isHost ? 'block' : 'none';

        if (isHost && !document.getElementById('liar-next-state-turn')) {
            const btn = document.createElement('button');
            btn.id = 'liar-next-state-turn';
            btn.className = 'primary-btn';
            btn.innerText = "모두 확인 완료 (설명 시작)";
            btn.onclick = () => db.collection('rooms').doc(currentRoomId).update({ status: 'turn_based' });
            document.getElementById('liar-host-controls-play').appendChild(btn);
        }
    } else if (data.status === 'turn_based') {
        lobbyDiv.style.display = 'none'; gameDiv.style.display = 'block'; resultDiv.style.display = 'none';
        const currentTurnPlayer = data.players[data.turnOrder[data.currentTurnIndex]];
        overlay.style.display = 'block';
        if (data.turnOrder[data.currentTurnIndex] === currentUser.uid) {
            document.getElementById('overlay-msg').innerText = "🎤 당신의 차례입니다!";
            document.getElementById('my-turn-input').style.display = 'block';
        } else {
            document.getElementById('overlay-msg').innerText = `👂 ${currentTurnPlayer.name} 님의 차례`;
            document.getElementById('my-turn-input').style.display = 'none';
        }
    } else if (data.status === 'discussion') {
        lobbyDiv.style.display = 'none'; gameDiv.style.display = 'block';
        document.getElementById('liar-discussion-msg').style.display = 'block';
        document.getElementById('liar-reveal-multi-btn').style.display = isHost ? 'inline-block' : 'none';
        document.getElementById('liar-reveal-multi-btn').innerText = "투표 시작";
    } else if (data.status === 'voting') {
        lobbyDiv.style.display = 'none'; gameDiv.style.display = 'block'; voteSection.style.display = 'block';
        const voteBtns = document.getElementById('vote-buttons');
        voteBtns.innerHTML = '';
        players.forEach(([uid, p]) => {
            const btn = document.createElement('button');
            btn.className = 'vote-btn'; btn.innerText = p.name;
            if (data.votes && data.votes[currentUser.uid] === uid) btn.classList.add('selected');
            btn.onclick = () => voteForPlayer(uid);
            voteBtns.appendChild(btn);
        });
    } else if (data.status === 'liar_guess') {
        lobbyDiv.style.display = 'none'; gameDiv.style.display = 'block'; guessSection.style.display = 'block';
        const votedName = data.players[data.votedOutId].name;
        document.querySelector('#liar-guess-section h3').innerText = `🕵️ ${votedName} (라이어) 지목!`;
        if (data.liarId === currentUser.uid) {
            document.getElementById('liar-word-input').style.display = 'inline-block';
            document.getElementById('liar-guess-btn').style.display = 'inline-block';
        } else {
            document.getElementById('liar-word-input').style.display = 'none';
            document.getElementById('liar-guess-btn').style.display = 'none';
        }
    } else if (data.status === 'result') {
        lobbyDiv.style.display = 'none'; gameDiv.style.display = 'none'; resultDiv.style.display = 'block';
        const liarName = data.players[data.liarId]?.name || "알 수 없음";
        document.getElementById('liar-winner').innerText = data.roundWinner === 'liar' ? "👿 라이어 승리!" : "😇 시민 승리!";
        document.getElementById('liar-identity-reveal').innerText = `라이어는 [${liarName}] 이었습니다!`;
        document.getElementById('liar-word-reveal').innerText = `제시어: ${data.word}`;
        document.getElementById('liar-next-round-btn').style.display = (isHost && !maxScoreReached) ? 'inline-block' : 'none';
        document.getElementById('liar-restart-multi-btn').style.display = (isHost && maxScoreReached) ? 'inline-block' : 'none';
    }

    if (typeof handleBotAutomation === 'function') handleBotAutomation(data);
}

async function startLiarGame() {
    if (!currentRoomId) return;
    const docRef = db.collection('rooms').doc(currentRoomId);
    const snap = await docRef.get();
    const data = snap.data();
    const players = Object.keys(data.players);
    if (players.length < 1) return alert("플레이어가 부족합니다.");

    let selectedTopic = data.topic || 'random';
    if (selectedTopic === 'random') {
        const topics = Object.keys(liarTopics);
        selectedTopic = topics[Math.floor(Math.random() * topics.length)];
    }
    const wordList = liarTopics[selectedTopic];
    const word = wordList[Math.floor(Math.random() * wordList.length)];
    const liarId = players[Math.floor(Math.random() * players.length)];
    const topicNames = { food: '음식', animal: '동물', object: '사물', sports: '스포츠', place: '장소' };

    for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [players[i], players[j]] = [players[j], players[i]];
    }

    await docRef.update({
        status: 'playing', liarId: liarId, word: word, topicName: topicNames[selectedTopic],
        turnOrder: players, currentTurnIndex: 0, revealed: false, descriptions: [], votes: {}, votedOutId: null, roundWinner: null
    });
}

function leaveLiarRoom() {
    if (roomUnsubscribe) roomUnsubscribe();
    if (chatUnsubscribe) chatUnsubscribe();
    if (currentRoomId && currentUser) {
        const update = {};
        update[`players.${currentUser.uid}`] = firebase.firestore.FieldValue.delete();
        update[`votes.${currentUser.uid}`] = firebase.firestore.FieldValue.delete();
        db.collection('rooms').doc(currentRoomId).update(update);
    }
    currentRoomId = null;
    document.getElementById('liar-entry').style.display = 'block';
    document.getElementById('liar-lobby').style.display = 'none';
    document.getElementById('liar-game-play').style.display = 'none';
    document.getElementById('liar-result').style.display = 'none';
    document.getElementById('liar-chat-section').style.display = 'none';
    document.getElementById('scoreboard').style.display = 'none';
}

async function sendLiarMessage() {
    if (!currentRoomId || !currentUser) return;
    const input = document.getElementById('liar-chat-input');
    const text = input.value.trim();
    if (!text) return;
    try {
        await db.collection('rooms').doc(currentRoomId).collection('messages').add({
            uid: currentUser.uid, name: currentUser.displayName, text: text, timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        input.value = '';
    } catch (e) { alert("채팅 전송 실패"); }
}

async function sendDescription() {
    if (!currentRoomId || !currentUser) return;
    const input = document.getElementById('description-input');
    const text = input.value.trim();
    if (!text) return;

    try {
        const docRef = db.collection('rooms').doc(currentRoomId);
        const snap = await docRef.get();
        const data = snap.data();
        if (data.status !== 'turn_based') return;
        if (data.turnOrder[data.currentTurnIndex] !== currentUser.uid) return alert("당신의 차례가 아닙니다.");

        const newDesc = { uid: currentUser.uid, name: currentUser.displayName, text: text };
        let nextIndex = data.currentTurnIndex + 1;
        let nextStatus = nextIndex >= data.turnOrder.length ? 'discussion' : 'turn_based';

        await docRef.update({ descriptions: [...(data.descriptions || []), newDesc], currentTurnIndex: nextIndex, status: nextStatus });
        input.value = '';
        document.getElementById('my-turn-input').style.display = 'none';
    } catch (e) { alert("설명 전송 실패: " + e.message); }
}

async function voteForPlayer(targetUid) {
    if (!currentRoomId || !currentUser) return;
    const docRef = db.collection('rooms').doc(currentRoomId);
    document.querySelectorAll('#vote-buttons button').forEach(btn => btn.disabled = true);

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            if (!doc.exists) throw "Err";
            const data = doc.data();
            if (data.status !== 'voting' || (data.votes && data.votes[currentUser.uid])) throw "Err";

            const votes = data.votes || {};
            votes[currentUser.uid] = targetUid;
            let updateData = { votes: votes };

            if (Object.keys(votes).length === Object.keys(data.players).length) {
                const voteCounts = {};
                Object.values(votes).forEach(v => { voteCounts[v] = (voteCounts[v] || 0) + 1; });
                let maxVotes = 0; let candidates = [];
                for (const [uid, count] of Object.entries(voteCounts)) {
                    if (count > maxVotes) { maxVotes = count; candidates = [uid]; }
                    else if (count === maxVotes) candidates.push(uid);
                }

                if (candidates.length > 1) {
                    updateData.status = 'discussion'; updateData.votes = {};
                } else {
                    const eliminatedId = candidates[0];
                    const scores = data.scores || {};
                    if (eliminatedId === data.liarId) {
                        Object.keys(data.players).forEach(uid => { if (uid !== data.liarId) scores[uid] = (scores[uid] || 0) + 1; });
                        updateData.status = 'liar_guess'; updateData.votedOutId = eliminatedId; updateData.scores = scores;
                    } else {
                        scores[data.liarId] = (scores[data.liarId] || 0) + 1;
                        updateData.status = 'result'; updateData.winner = 'liar'; updateData.roundWinner = 'liar'; updateData.votedOutId = eliminatedId; updateData.scores = scores; updateData.votes = {};
                    }
                }
            }
            transaction.update(docRef, updateData);
        });
    } catch (e) { document.querySelectorAll('#vote-buttons button').forEach(btn => btn.disabled = false); }
}

async function submitLiarGuess() {
    if (!currentRoomId || !currentUser) return;
    const input = document.getElementById('liar-word-input');
    const guess = input.value.trim();
    if (!guess) return;

    const docRef = db.collection('rooms').doc(currentRoomId);
    const snap = await docRef.get();
    const data = snap.data();
    if (data.status !== 'liar_guess') return;

    const scores = data.scores || {};
    let winner = 'civilian';
    if (guess === data.word.trim()) { scores[data.liarId] = (scores[data.liarId] || 0) + 1; winner = 'liar'; }

    await docRef.update({ status: 'result', winner: winner, roundWinner: winner, scores: scores });
}

document.getElementById('liar-card').addEventListener('click', function () {
    this.classList.toggle('revealed');
    if (this.classList.contains('revealed')) { this.querySelector('#liar-card-word').innerText = this.dataset.word; }
    else { this.querySelector('#liar-card-word').innerText = '클릭하여 확인'; }
});
document.getElementById('liar-create-btn').addEventListener('click', createLiarRoom);
document.getElementById('liar-join-btn').addEventListener('click', () => joinLiarRoom());
document.getElementById('liar-start-multi-btn').addEventListener('click', startLiarGame);
document.getElementById('liar-leave-btn')?.addEventListener('click', leaveLiarRoom);
document.getElementById('liar-leave-guest-btn')?.addEventListener('click', leaveLiarRoom);
document.getElementById('liar-topic-select').addEventListener('change', (e) => { if (currentRoomId) db.collection('rooms').doc(currentRoomId).update({ topic: e.target.value }); });
document.getElementById('liar-reveal-multi-btn').addEventListener('click', () => { db.collection('rooms').doc(currentRoomId).update({ status: 'voting' }); });
document.getElementById('liar-next-round-btn').addEventListener('click', startLiarGame);
document.getElementById('liar-restart-multi-btn').addEventListener('click', () => { db.collection('rooms').doc(currentRoomId).update({ status: 'lobby', scores: {}, liarId: null, word: "", revealed: false, descriptions: [], votes: {} }); });
document.getElementById('description-send-btn').addEventListener('click', sendDescription);
document.getElementById('description-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendDescription(); });
document.getElementById('liar-chat-send-btn').addEventListener('click', sendLiarMessage);
document.getElementById('liar-chat-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendLiarMessage(); });
document.getElementById('liar-guess-btn').addEventListener('click', submitLiarGuess);
document.getElementById('toggle-rules-btn')?.addEventListener('click', function () {
    const rules = document.getElementById('game-rules');
    if (rules.style.display === 'none') { rules.style.display = 'block'; this.innerHTML = '🔼 규칙 접기'; } else { rules.style.display = 'none'; this.innerHTML = '📜 게임 규칙 보기'; }
});
document.getElementById('liar-add-bots-btn')?.addEventListener('click', addTestBots);

async function addTestBots() {
    if (!currentRoomId) return;
    const docRef = db.collection('rooms').doc(currentRoomId);
    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            if (!doc.exists) return;
            const data = doc.data();
            const players = data.players || {};
            const scores = data.scores || {};
            for (let i = 1; i <= 10; i++) {
                const botId = `bot_${Date.now()}_${i}`;
                if (Object.keys(players).length >= 30) break;
                players[botId] = { name: `🤖 Bot ${i}`, photo: `https://api.dicebear.com/7.x/bottts/svg?seed=${botId}`, joinedAt: Date.now() + i, isBot: true };
                scores[botId] = 0;
            }
            transaction.update(docRef, { players: players, scores: scores });
        });
    } catch (e) { alert("봇 추가 실패: " + e); }
}

let botActionTimer = null;
function handleBotAutomation(data) {
    if (!data || !currentUser || data.host !== currentUser.uid) return;

    if (data.status === 'turn_based') {
        const currentTurnUid = data.turnOrder?.[data.currentTurnIndex];
        const currentPlayer = data.players[currentTurnUid];
        if (currentPlayer && currentPlayer.isBot && !botActionTimer) {
            botActionTimer = setTimeout(async () => {
                const randomMsg = ["음... 어렵네요.", "맛있는 것 같아요!", "평소에 자주 봅니다.", "저는 잘 모르겠어요.", "확실히 생물은 아니에요."];
                const msg = randomMsg[Math.floor(Math.random() * randomMsg.length)];
                let nextIndex = data.currentTurnIndex + 1;
                let nextStatus = nextIndex >= data.turnOrder.length ? 'discussion' : 'turn_based';
                await db.collection('rooms').doc(currentRoomId).update({ descriptions: [...(data.descriptions || []), { uid: currentTurnUid, name: currentPlayer.name, text: msg + " (자동응답)" }], currentTurnIndex: nextIndex, status: nextStatus });
                botActionTimer = null;
            }, 3000);
        }
    } else if (data.status === 'voting') {
        const votes = data.votes || {};
        const bots = Object.entries(data.players || {}).filter(([uid, p]) => p.isBot);
        const pendingBots = bots.filter(([uid]) => !votes[uid]);
        if (pendingBots.length > 0 && !botActionTimer) {
            botActionTimer = setTimeout(async () => {
                const players = Object.keys(data.players);
                pendingBots.forEach(([botUid]) => { votes[botUid] = players[Math.floor(Math.random() * players.length)]; });
                let updatePayload = { votes: votes };
                if (Object.keys(votes).length === players.length) {
                    const voteCounts = {};
                    Object.values(votes).forEach(v => { voteCounts[v] = (voteCounts[v] || 0) + 1; });
                    let maxVotes = 0; let candidates = [];
                    for (const [uid, count] of Object.entries(voteCounts)) {
                        if (count > maxVotes) { maxVotes = count; candidates = [uid]; }
                        else if (count === maxVotes) candidates.push(uid);
                    }
                    if (candidates.length > 1) { updatePayload.status = 'discussion'; updatePayload.votes = {}; }
                    else {
                        const eliminatedId = candidates[0];
                        const scores = data.scores || {};
                        if (eliminatedId === data.liarId) {
                            Object.keys(data.players).forEach(uid => { if (uid !== data.liarId) scores[uid] = (scores[uid] || 0) + 1; });
                            updatePayload.status = 'liar_guess'; updatePayload.votedOutId = eliminatedId; updatePayload.scores = scores;
                        } else {
                            scores[data.liarId] = (scores[data.liarId] || 0) + 1;
                            updatePayload.status = 'result'; updatePayload.winner = 'liar'; updatePayload.roundWinner = 'liar'; updatePayload.votedOutId = eliminatedId; updatePayload.scores = scores; updatePayload.votes = {};
                        }
                    }
                }
                await db.collection('rooms').doc(currentRoomId).update(updatePayload);
                botActionTimer = null;
            }, 3000);
        }
    } else {
        if (botActionTimer && (data.status !== 'turn_based' && data.status !== 'voting')) { clearTimeout(botActionTimer); botActionTimer = null; }
    }
}
