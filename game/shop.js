// ============================================================
// game/shop.js - Shop UI and Purchase Logic
// ============================================================

const STAIR_SKIN_DATA = {
    default: { name: '기본 계단', icon: '🏢' },
    stair_glass: { name: '유리 계단', icon: '🧊', price: 3000, type: 'glass' },
    stair_pharaoh: { name: '파라오의 황금 계단', icon: '👑', price: 3000, type: 'pharaoh' },
    stair_ice: { name: '눈부신 얼음 계단', icon: '❄️', price: 3000, type: 'ice' }
};

const PET_DATA = {
    none: { name: '없음', icon: '❌' },
    pet_dog: { name: '강아지', icon: '🐕', price: 1000, type: 'ground' },
    pet_cat: { name: '고양이', icon: '🐈', price: 3000, type: 'ground' },
    pet_eagle: { name: '독수리', icon: '🦅', price: 10000, type: 'air' },
    pet_pig: { name: '황금돼지', icon: '🐷', price: 10000, type: 'ground' }
};

const MAP_DATA = {
    default: { name: '기본 하늘', icon: '🌅' },
    map_desert: { name: '사막 피라미드', icon: '🏜️', price: 5000, desc: '피라미드, 스핑크스, 파라오와 함께!' },
    map_winter: { name: '겨울 왕국', icon: '❄️', price: 5000, desc: '눈 내리는 북극과 아름다운 오로라!' }
};

console.log('[Shop] Initialized. MAP_DATA:', MAP_DATA);

// Component Generator for Shop Items
function createShopItemElement(id, data, category) {
    const isOwned = checkOwnership(id, category);
    const isEquipped = checkEquipped(id, category);

    const div = document.createElement('div');
    div.className = 'shop-item card-3d';
    div.style.padding = '15px';
    div.style.margin = '10px';
    div.style.background = isEquipped ? '#f1c40f22' : '#222';
    div.style.border = isEquipped ? '2px solid #f1c40f' : '1px solid #444';
    div.style.borderRadius = '12px';
    div.style.position = 'relative';
    div.style.minWidth = '140px';
    div.style.textAlign = 'center';

    div.innerHTML = `
        <div style="font-size: 40px; margin-bottom: 10px;">${data.icon}</div>
        <div style="font-weight: bold; margin-bottom: 5px;">${data.name}</div>
        ${!isOwned && data.price ? `<div style="color: #f1c40f; font-size: 14px; margin-bottom: 10px;">💰 ${data.price}</div>` : ''}
        <button id="btn-${id}" 
            class="${isOwned ? 'equip-btn' : 'buy-btn'}"
            style="width: 100%; padding: 8px; border-radius: 6px; cursor: pointer; border: none; font-weight: bold;
            background: ${isOwned ? (isEquipped ? '#555' : '#27ae60') : (data.price ? '#e67e22' : '#7f8c8d')};
            color: #fff;">
            ${isOwned ? (isEquipped ? '장착됨' : '장착하기') : (data.price ? '구매하기' : '잠김')}
        </button>
    `;

    return div;
}

function checkOwnership(id, category) {
    if (category === 'char') return window.ownedSkins.includes(id);
    if (category === 'stair') return window.ownedStairSkins.includes(id);
    if (category === 'pet') return window.ownedPets.includes(id);
    if (category === 'map') return window.ownedMaps.includes(id);
    return false;
}

function checkEquipped(id, category) {
    if (category === 'char') return window.currentSkin === id;
    if (category === 'stair') return window.currentStairSkin === id;
    if (category === 'pet') return window.currentPet === id;
    if (category === 'map') return window.currentMap === id;
    return false;
}

function updateShopUI() {
    const shopGold = document.getElementById('shop-gold');
    if (shopGold) shopGold.innerText = totalCoins;

    const coinDisplays = document.querySelectorAll('.total-coins-display');
    coinDisplays.forEach(el => el.innerText = totalCoins);

    // Dynamic Shop Sections
    const sections = {
        'char': { data: SKIN_DATA, containerId: 'shop-items-char', category: 'char' },
        'stair': { data: STAIR_SKIN_DATA, containerId: 'shop-items-stair', category: 'stair' },
        'pet': { data: PET_DATA, containerId: 'shop-items-pet', category: 'pet' },
        'map': { data: MAP_DATA, containerId: 'shop-items-map', category: 'map' }
    };

    // Update Current Equipped Displays
    const skinDisplay = document.getElementById('current-skin-display');
    if (skinDisplay && SKIN_DATA[window.currentSkin]) skinDisplay.innerText = SKIN_DATA[window.currentSkin].icon + ' ' + SKIN_DATA[window.currentSkin].name;

    const stairDisplay = document.getElementById('current-stair-display');
    if (stairDisplay && STAIR_SKIN_DATA[window.currentStairSkin]) stairDisplay.innerText = STAIR_SKIN_DATA[window.currentStairSkin].icon + ' ' + STAIR_SKIN_DATA[window.currentStairSkin].name;

    const petDisplay = document.getElementById('current-pet-display');
    if (petDisplay && PET_DATA[window.currentPet]) petDisplay.innerText = PET_DATA[window.currentPet].icon + ' ' + PET_DATA[window.currentPet].name;

    const mapDisplay = document.getElementById('current-map-display');
    if (mapDisplay && MAP_DATA[window.currentMap]) mapDisplay.innerText = MAP_DATA[window.currentMap].icon + ' ' + MAP_DATA[window.currentMap].name;

    for (const key in sections) {
        const config = sections[key];
        const container = document.getElementById(config.containerId);
        if (!container) continue;

        container.innerHTML = '';
        const listDiv = document.createElement('div');
        listDiv.style.display = 'flex';
        listDiv.style.flexWrap = 'wrap';
        listDiv.style.justifyContent = 'center';

        for (const id in config.data) {
            // Skip default for char if it's not useful to show twice (usually included)
            if (id === 'default' && config.category === 'char') {
                if (!ownedSkins.includes('default')) ownedSkins.push('default');
            }

            const itemEl = createShopItemElement(id, config.data[id], config.category);

            // Add attributes to buttons for binding
            const btn = itemEl.querySelector('button');
            btn.dataset.id = id;
            btn.dataset.category = config.category;
            btn.dataset.price = config.data[id].price || 0;

            listDiv.appendChild(itemEl);
        }
        container.appendChild(listDiv);
    }

    bindBuyEquipButtons();
}

function switchShopTab(tab) {
    const tabs = ['char', 'stair', 'pet', 'map'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        const sec = document.getElementById(`shop-section-${t}`);
        if (btn) {
            btn.style.background = (t === tab) ? '#f1c40f' : '#333';
            btn.style.color = (t === tab) ? '#000' : '#fff';
        }
        if (sec) sec.style.display = (t === tab) ? 'block' : 'none';
    });

    updateShopUI();
}

function bindShopEvents() {
    const openBtn = document.getElementById('shop-open-btn');
    const overlay = document.getElementById('shop-overlay');
    const closeBtns = [document.getElementById('close-shop-btn'), document.getElementById('close-shop-btn-bottom')];

    if (openBtn) {
        openBtn.onclick = () => {
            overlay.style.display = 'flex';
            updateShopUI();
            switchShopTab('char');
        };
    }

    closeBtns.forEach(btn => {
        if (btn) btn.onclick = () => overlay.style.display = 'none';
    });

    ['char', 'stair', 'pet', 'map'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (btn) btn.onclick = () => switchShopTab(t);
    });
}

function equipStairSkin(id) {
    console.log('[Shop] Equipping stair skin:', id);
    currentStairSkin = id;
    localStorage.setItem('currentStairSkin', id);
    localStorage.setItem('ownedStairSkins', JSON.stringify(ownedStairSkins));
    if (window.saveData) {
        window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin, ownedPets, currentPet, ownedMaps, currentMap);
    }
    updateShopUI();
}

function equipPet(id) {
    console.log('[Shop] Equipping pet:', id);
    currentPet = id;
    localStorage.setItem('currentPet', id);
    localStorage.setItem('ownedPets', JSON.stringify(ownedPets));
    if (window.saveData) {
        window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin, ownedPets, currentPet, ownedMaps, currentMap);
    }
    updateShopUI();
}

function equipMap(id) {
    console.log('[Shop] Equipping map:', id);
    window.currentMap = id;
    localStorage.setItem('currentMap', id);
    localStorage.setItem('ownedMaps', JSON.stringify(window.ownedMaps));
    if (window.saveData) {
        window.saveData(window.aiHighScore, window.totalCoins, window.ownedSkins, window.currentSkin, window.ownedStairSkins, window.currentStairSkin, window.ownedPets, window.currentPet, window.ownedMaps, window.currentMap);
    }
    alert('맵이 변경되었습니다! 확인을 누르면 적용됩니다. ❄️');
    location.reload(); // Force reload to apply map changes cleanly
}

function bindBuyEquipButtons() {
    console.log('[Shop] Binding buy/equip buttons...');
    const buttons = document.querySelectorAll('.shop-item button');
    console.log('[Shop] Found buttons:', buttons.length);

    buttons.forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const category = btn.dataset.category;
            const price = parseInt(btn.dataset.price) || 0;

            console.log('[Shop] Button clicked!', { id, category, price, totalCoins: window.totalCoins });

            if (!id || !category) {
                console.error('[Shop] Missing data attributes!', btn);
                return;
            }

            const isOwned = checkOwnership(id, category);
            console.log('[Shop] Ownership check:', id, category, 'owned:', isOwned);

            if (isOwned) {
                // Equip flow
                console.log('[Shop] Equipping:', id);
                if (category === 'char') {
                    if (typeof equipSkin === 'function') equipSkin(id);
                } else if (category === 'stair') {
                    equipStairSkin(id);
                } else if (category === 'pet') {
                    equipPet(id);
                } else if (category === 'map') {
                    equipMap(id);
                }
            } else {
                // Buy flow
                if (price === 0) {
                    // Check requirement for pentagon
                    const item = (category === 'char') ? SKIN_DATA[id] : null;
                    if (item && item.requirement && aiHighScore < item.requirement) {
                        return alert(`🔒 기록이 부족합니다! (${item.requirement}계단 필요)`);
                    }
                    // Else free
                }

                if (window.totalCoins >= price) {
                    window.totalCoins -= price;
                    localStorage.setItem('infinite_stairs_coins', window.totalCoins);

                    // Update UI immediately
                    const coinEls = document.querySelectorAll('.total-coins-display');
                    coinEls.forEach(el => el.innerText = window.totalCoins);
                    const shopGold = document.getElementById('shop-gold');
                    if (shopGold) shopGold.innerText = window.totalCoins;

                    if (category === 'char') {
                        window.ownedSkins.push(id);
                        localStorage.setItem('ownedSkins', JSON.stringify(window.ownedSkins));
                    } else if (category === 'stair') {
                        window.ownedStairSkins.push(id);
                        localStorage.setItem('ownedStairSkins', JSON.stringify(window.ownedStairSkins));
                    } else if (category === 'pet') {
                        window.ownedPets.push(id);
                        localStorage.setItem('ownedPets', JSON.stringify(window.ownedPets));
                    } else if (category === 'map') {
                        console.log('[Shop] Buying map:', id);
                        window.ownedMaps.push(id);
                        localStorage.setItem('ownedMaps', JSON.stringify(window.ownedMaps));
                    }

                    if (window.saveData) {
                        window.saveData(window.aiHighScore, window.totalCoins, window.ownedSkins, window.currentSkin, window.ownedStairSkins, window.currentStairSkin, window.ownedPets, window.currentPet, window.ownedMaps, window.currentMap);
                    }

                    alert(`✅ ${id} 구매 완료!`);

                    // Force UI refresh
                    updateShopUI();
                    if (category === 'char') {
                        if (typeof equipSkin === 'function') equipSkin(id);
                    } else if (category === 'stair') {
                        equipStairSkin(id);
                    } else if (category === 'pet') {
                        equipPet(id);
                    } else if (category === 'map') {
                        equipMap(id);
                    }
                } else {
                    alert(`❌ 골드가 부족합니다! (${totalCoins}G / ${price}G)`);
                }
            }
        };
    });
}
