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
    map_desert: { name: '사막 피라미드', icon: '🏜️', price: 5000, desc: '피라미드, 스핑크스, 파라오와 함께!' }
};

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
        ${!isOwned ? `<div style="color: #f1c40f; font-size: 14px; margin-bottom: 10px;">💰 ${data.price}</div>` : ''}
        <button id="btn-${id}" 
            class="${isOwned ? 'equip-btn' : 'buy-btn'}"
            style="width: 100%; padding: 8px; border-radius: 6px; cursor: pointer; border: none; font-weight: bold;
            background: ${isOwned ? (isEquipped ? '#555' : '#27ae60') : '#e67e22'};
            color: #fff;">
            ${isOwned ? (isEquipped ? '장착됨' : '장착하기') : '구매하기'}
        </button>
    `;

    return div;
}

function checkOwnership(id, category) {
    if (category === 'stair') return ownedStairSkins.includes(id);
    if (category === 'pet') return ownedPets.includes(id);
    if (category === 'map') return ownedMaps.includes(id);
    if (category === 'char') return ownedSkins.includes(id);
    return false;
}

function checkEquipped(id, category) {
    if (category === 'stair') return currentStairSkin === id;
    if (category === 'pet') return currentPet === id;
    if (category === 'map') return currentMap === id;
    if (category === 'char') return currentSkin === id;
    return false;
}

let ownedMaps = ['default'];
let currentMap = 'default';

function updateShopUI() {
    // Dynamic Shop Sections
    const sections = {
        'char': { data: SKIN_DATA, containerId: 'shop-items-char', category: 'char' },
        'stair': { data: STAIR_SKIN_DATA, containerId: 'shop-items-stair', category: 'stair' },
        'pet': { data: PET_DATA, containerId: 'shop-items-pet', category: 'pet' },
        'map': { data: MAP_DATA, containerId: 'shop-items-map', category: 'map' }
    };

    // Update Current Equipped Displays
    const skinDisplay = document.getElementById('current-skin-display');
    if (skinDisplay) skinDisplay.innerText = SKIN_DATA[currentSkin]?.icon + ' ' + SKIN_DATA[currentSkin]?.name;

    const stairDisplay = document.getElementById('current-stair-display');
    if (stairDisplay) stairDisplay.innerText = STAIR_SKIN_DATA[currentStairSkin]?.icon + ' ' + STAIR_SKIN_DATA[currentStairSkin]?.name;

    const petDisplay = document.getElementById('current-pet-display');
    if (petDisplay) petDisplay.innerText = PET_DATA[currentPet]?.icon + ' ' + PET_DATA[currentPet]?.name;

    const mapDisplay = document.getElementById('current-map-display');
    if (mapDisplay) mapDisplay.innerText = MAP_DATA[currentMap]?.icon + ' ' + MAP_DATA[currentMap]?.name;

    for (const key in sections) {
        const section = sections[key];
        const container = document.getElementById(section.containerId);
        if (container) {
            container.innerHTML = ''; // Clear existing items
            for (const itemId in section.data) {
                if (itemId === 'default' && section.category !== 'stair' && section.category !== 'map') continue; // Skip 'default' for char/pet if it's not a real item
                if (itemId === 'none' && section.category !== 'pet') continue; // Skip 'none' for char/stair/map if it's not a real item

                const itemData = section.data[itemId];
                const itemElement = createShopItemElement(itemId, itemData, section.category);

                // Add dataset attributes for purchase/equip logic
                const button = itemElement.querySelector('button');
                if (button) {
                    button.dataset.id = itemId;
                    button.dataset.price = itemData.price || 0;
                    // Add specific classes for easier targeting in bindBuyEquipButtons
                    if (section.category === 'char') {
                        button.classList.add('buy-char-btn', 'equip-char-btn');
                    } else if (section.category === 'stair') {
                        button.classList.add('buy-stair-btn', 'equip-stair-btn');
                    } else if (section.category === 'pet') {
                        button.classList.add('buy-pet-btn', 'equip-pet-btn');
                    } else if (section.category === 'map') {
                        button.classList.add('buy-map-btn', 'equip-map-btn');
                    }
                }
                container.appendChild(itemElement);
            }
        }
    }
    bindBuyEquipButtons(); // Rebind buttons after updating UI
}

function switchShopTab(tab) {
    const charTab = document.getElementById('tab-char');
    const stairTab = document.getElementById('tab-stair');
    const petTab = document.getElementById('tab-pet');
    const mapTab = document.getElementById('tab-map');
    const charSec = document.getElementById('shop-section-char');
    const stairSec = document.getElementById('shop-section-stair');
    const petSec = document.getElementById('shop-section-pet');
    const mapSec = document.getElementById('shop-section-map');

    // Reset all
    [charSec, stairSec, petSec, mapSec].forEach(s => { if (s) s.style.display = 'none'; });
    [charTab, stairTab, petTab, mapTab].forEach(t => { if (t) { t.style.background = '#333'; t.style.color = '#fff'; } });

    if (tab === 'char' && charSec) {
        charSec.style.display = 'block';
        charTab.style.background = '#f1c40f';
        charTab.style.color = '#000';
    } else if (tab === 'stair' && stairSec) {
        stairSec.style.display = 'block';
        stairTab.style.background = '#f1c40f';
        stairTab.style.color = '#000';
    } else if (tab === 'pet' && petSec) {
        petSec.style.display = 'block';
        petTab.style.background = '#f1c40f';
        petTab.style.color = '#000';
    } else if (tab === 'map' && mapSec) {
        mapSec.style.display = 'block';
        mapTab.style.background = '#f1c40f';
        mapTab.style.color = '#000';
    }

    updateShopUI(); // Refresh items for selected tab
}

function bindShopEvents() {
    // Open Button
    const openBtn = document.getElementById('shop-open-btn');
    if (openBtn) {
        openBtn.onclick = () => {
            const overlay = document.getElementById('shop-overlay');
            if (overlay) {
                overlay.style.display = 'flex';
                updateShopUI();
                switchShopTab('char'); // Default to character tab
                bindBuyEquipButtons();
            }
        };
    }

    // Close Button (top)
    const closeBtn = document.getElementById('close-shop-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            const overlay = document.getElementById('shop-overlay');
            if (overlay) overlay.style.display = 'none';
        };
    }

    // Close Button (bottom)
    const closeBtnBottom = document.getElementById('close-shop-btn-bottom');
    if (closeBtnBottom) {
        closeBtnBottom.onclick = () => {
            const overlay = document.getElementById('shop-overlay');
            if (overlay) overlay.style.display = 'none';
        };
    }
}

function equipStairSkin(stairId) {
    currentStairSkin = stairId;
    localStorage.setItem('currentStairSkin', stairId);
    updateShopUI();
    console.log(`Equipped stair skin: ${stairId}`);
}

function equipPet(petId) {
    currentPet = petId;
    localStorage.setItem('currentPet', petId);
    updateShopUI();
    console.log(`Equipped pet: ${petId}`);
}

function equipMap(mapId) {
    currentMap = mapId;
    localStorage.setItem('currentMap', mapId);
    updateShopUI();
    console.log(`Equipped map: ${mapId}`);
    if (window.saveData) {
        window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin, ownedPets, currentPet, ownedMaps, currentMap);
    }
}

function bindBuyEquipButtons() {
    // Buy Character Skins
    document.querySelectorAll('.buy-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.stopPropagation();
            const skinId = this.dataset.id;
            const price = parseInt(this.dataset.price);

            if (ownedSkins.includes(skinId)) {
                equipSkin(skinId);
                return;
            }

            const skin = SKIN_DATA[skinId];
            const isRequirementMet = skin && (!skin.requirement || parseInt(aiHighScore) >= parseInt(skin.requirement));

            if (totalCoins >= price && isRequirementMet) {
                if (price > 0) totalCoins -= price;
                ownedSkins.push(skinId);
                if (coinEl) coinEl.innerText = totalCoins;
                updateShopUI();
                if (window.saveData) {
                    window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin, ownedPets, currentPet, ownedMaps, currentMap);
                }
                alert(`✅ ${SKIN_DATA[skinId]?.name || skinId} 획득 완료!`);
                equipSkin(skinId);
                bindBuyEquipButtons();
            } else if (!isRequirementMet) {
                alert(`🔒 아직 잠겨있습니다! (필요 기록: ${skin.requirement}계단)`);
            } else {
                alert(`❌ 골드가 부족합니다! (보유: ${totalCoins}G / 필요: ${price}G)`);
            }
        };
    });

    // Equip Character Skins
    document.querySelectorAll('.equip-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.stopPropagation();
            const skinId = this.dataset.skin || this.dataset.id;
            equipSkin(skinId);
        };
    });

    // Buy Stair Skins
    document.querySelectorAll('.buy-stair-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.stopPropagation();
            const stairId = this.dataset.id;
            const price = parseInt(this.dataset.price);

            if (ownedStairSkins.includes(stairId)) {
                equipStairSkin(stairId);
                return;
            }

            if (totalCoins >= price) {
                totalCoins -= price;
                ownedStairSkins.push(stairId);
                if (coinEl) coinEl.innerText = totalCoins;
                updateShopUI();
                if (window.saveData) {
                    window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin, ownedPets, currentPet, ownedMaps, currentMap);
                }
                alert(`✅ ${STAIR_SKIN_DATA[stairId]?.name || stairId} 구매 완료!`);
                equipStairSkin(stairId);
                bindBuyEquipButtons();
            } else {
                alert(`❌ 골드가 부족합니다! (보유: ${totalCoins}G / 필요: ${price}G)`);
            }
        };
    });

    // Equip Stair Skins
    document.querySelectorAll('.equip-stair-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.stopPropagation();
            const stairId = this.dataset.stair || this.dataset.id;
            equipStairSkin(stairId);
        };
    });

    // Buy Pets
    document.querySelectorAll('.buy-pet-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.stopPropagation();
            const petId = this.dataset.id;
            const price = parseInt(this.dataset.price);

            if (ownedPets.includes(petId)) {
                equipPet(petId);
                return;
            }

            if (totalCoins >= price) {
                totalCoins -= price;
                ownedPets.push(petId);
                if (coinEl) coinEl.innerText = totalCoins;
                updateShopUI();
                if (window.saveData) {
                    window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin, ownedPets, currentPet, ownedMaps, currentMap);
                }
                alert(`✅ ${PET_DATA[petId]?.name || petId} 입양 완료!`);
                equipPet(petId);
                bindBuyEquipButtons();
            } else {
                alert(`❌ 골드가 부족합니다! (보유: ${totalCoins}G / 필요: ${price}G)`);
            }
        };
    });

    // Equip Pets
    document.querySelectorAll('.equip-pet-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.stopPropagation();
            const petId = this.dataset.pet || this.dataset.id;
            equipPet(petId);
        };
    });

    // Buy Maps
    document.querySelectorAll('.buy-map-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.stopPropagation();
            const mapId = this.dataset.id;
            const price = parseInt(this.dataset.price);

            if (ownedMaps.includes(mapId)) {
                equipMap(mapId);
                return;
            }

            if (totalCoins >= price) {
                totalCoins -= price;
                ownedMaps.push(mapId);
                localStorage.setItem('ownedMaps', JSON.stringify(ownedMaps));
                if (coinEl) coinEl.innerText = totalCoins;
                updateShopUI();
                if (window.saveData) {
                    window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin, ownedPets, currentPet, ownedMaps, currentMap);
                }
                alert(`✅ ${MAP_DATA[mapId]?.name || mapId} 구매 완료!`);
                equipMap(mapId);
                bindBuyEquipButtons();
            } else {
                alert(`❌ 골드가 부족합니다! (보유: ${totalCoins}G / 필요: ${price}G)`);
            }
        };
    });

    // Equip Maps
    document.querySelectorAll('.equip-map-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.stopPropagation();
            const mapId = this.dataset.map || this.dataset.id;
            equipMap(mapId);
        };
    });
}

function updateShopUI() {
    const shopGold = document.getElementById('shop-gold');
    if (shopGold) shopGold.innerText = totalCoins;

    const currentDisplay = document.getElementById('current-skin-display');
    if (currentDisplay && SKIN_DATA[currentSkin]) {
        currentDisplay.innerText = `${SKIN_DATA[currentSkin].icon} ${SKIN_DATA[currentSkin].name}`;
    }

    const currentStairDisplay = document.getElementById('current-stair-display');
    if (currentStairDisplay && STAIR_SKIN_DATA[currentStairSkin]) {
        currentStairDisplay.innerText = `${STAIR_SKIN_DATA[currentStairSkin].icon} ${STAIR_SKIN_DATA[currentStairSkin].name}`;
    }

    const currentPetDisplay = document.getElementById('current-pet-display');
    if (currentPetDisplay && PET_DATA[currentPet]) {
        currentPetDisplay.innerText = `${PET_DATA[currentPet].icon} ${PET_DATA[currentPet].name}`;
    }

    // Character Skins UI update
    document.querySelectorAll('.char-section .buy-btn, #shop-section-char .buy-btn').forEach(btn => {
        const skinId = btn.dataset.id;
        const skin = SKIN_DATA[skinId];

        if (ownedSkins.includes(skinId)) {
            btn.innerText = currentSkin === skinId ? '✓ 장착중' : '장착하기';
            btn.style.background = currentSkin === skinId ? '#7f8c8d' : '#2ecc71';
            btn.disabled = currentSkin === skinId;
            btn.classList.add('equip-btn');
            btn.classList.remove('buy-btn');
        } else if (skin && skin.requirement) {
            const isUnlocked = parseInt(aiHighScore) >= parseInt(skin.requirement);
            if (isUnlocked) {
                btn.innerText = 'FREE 취득';
                btn.style.background = '#3498db';
                btn.disabled = false;
            } else {
                btn.innerText = `Locked (${skin.requirement})`;
                btn.style.background = '#7f8c8d';
                btn.disabled = true;
            }
        }
    });

    document.querySelectorAll('.equip-btn').forEach(btn => {
        const skinId = btn.dataset.skin || btn.dataset.id;
        const mapId = btn.dataset.map || btn.dataset.id;
        if (mapId === currentMap) {
            btn.innerText = '✓ 장착중';
            btn.style.background = '#7f8c8d';
            btn.disabled = true;
        } else if (ownedMaps.includes(mapId) || mapId === 'default') {
            btn.innerText = '장착하기';
            btn.style.background = '#2ecc71';
            btn.disabled = false;
        }
    });
}

