// ============================================================
// game/shop.js - Shop UI and Purchase Logic
// ============================================================

const STAIR_SKIN_DATA = {
    default: { name: '기본 계단', icon: '🏢' },
    stair_glass: { name: '유리 계단', icon: '🧊', price: 3000, type: 'glass' },
    stair_pharaoh: { name: '파라오의 황금 계단', icon: '👑', price: 3000, type: 'pharaoh' },
    stair_ice: { name: '눈부신 얼음 계단', icon: '❄️', price: 3000, type: 'ice' }
};
window.STAIR_SKIN_DATA = STAIR_SKIN_DATA;

const PET_DATA = {
    none: { name: '없음', icon: '❌' },
    pet_dog: { name: '강아지', icon: '🐕', price: 1000, type: 'ground' },
    pet_cat: { name: '고양이', icon: '🐈', price: 3000, type: 'ground' },
    pet_eagle: { name: '독수리', icon: '🦅', price: 10000, type: 'air' },
    pet_pig: { name: '황금돼지', icon: '🐷', price: 10000, type: 'ground' },
    pet_sphinx: { name: '스핑크스', icon: '🦁', price: 0, type: 'ground', requirement: 'crowns', requirementCount: 15, desc: '파라오의 왕관 15개 수집 시 해금!' },
    pet_polarbear: { name: '북극곰', icon: '🐻‍❄️', price: 0, type: 'ground', requirement: 'snowcrystals', requirementCount: 15, desc: '❄️ 눈결정 15개 수집 시 해금! | 골드 x5 | 타이머 1.5배 느려짐' },
    pet_penguin: { name: '펭귄', icon: '🐧', price: 10000, type: 'ground', desc: '🛡️ 체력 감소 1.5배 느려짐' }
};
window.PET_DATA = PET_DATA;


const MAP_DATA = {
    default: { name: '기본 하늘', icon: '🌅' },
    map_desert: { name: '사막 피라미드', icon: '🏜️', price: 5000, desc: '피라미드, 스핑크스, 파라오와 함께!', previewImg: 'assets/desert_map_preview.png' },
    map_winter: { name: '겨울 왕국', icon: '❄️', price: 5000, desc: '눈 내리는 북극과 아름다운 오로라!', previewImg: 'assets/winter_map_preview.png' }
};
window.MAP_DATA = MAP_DATA;

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

    // 스핑크스 펫 특별 처리 - 왕관 수집 진행도 표시
    let requirementDisplay = '';
    if (id === 'pet_sphinx') {
        const crowns = window.pharaohCrowns || 0;
        const needed = 15;
        const canUnlock = crowns >= needed;
        requirementDisplay = `<div style="color: ${canUnlock ? '#2ecc71' : '#e67e22'}; font-size: 12px; margin-bottom: 5px;">👑 ${crowns}/${needed}</div>`;
    } else if (id === 'pet_polarbear') {
        const crystals = window.snowCrystals || 0;
        const needed = 15;
        const canUnlock = crystals >= needed;
        requirementDisplay = `<div style="color: ${canUnlock ? '#2ecc71' : '#00d2d3'}; font-size: 12px; margin-bottom: 5px;">❄️ ${crystals}/${needed}</div>`;
    }

    // 특수 효과 표시
    let effectDisplay = '';
    if (id === 'pet_sphinx') {
        effectDisplay = '<div style="color: #f39c12; font-size: 11px; margin-top: 5px;">⚡ 골드 x10</div>';
    } else if (id === 'pet_polarbear') {
        effectDisplay = '<div style="color: #00d2d3; font-size: 11px; margin-top: 5px;">⚡ 골드 x5 | 🛡️ 체력 감소 1.5배 느려짐</div>';
    } else if (id === 'pet_pig') {
        effectDisplay = '<div style="color: #f39c12; font-size: 11px; margin-top: 5px;">⚡ 골드 x2</div>';
    } else if (id === 'pet_penguin') {
        effectDisplay = '<div style="color: #74b9ff; font-size: 11px; margin-top: 5px;">🛡️ 체력 감소 1.5배 느려짐</div>';
    }


    let previewImgTag = '';
    if (data.previewImg) {
        previewImgTag = `<img src="${data.previewImg}" alt="${data.name} preview" style="width: 100%; height: auto; border-radius: 4px; margin-bottom: 8px;"/>`;
    }
    const currentLevel = window.skinLevels?.[id] || 1;
    // Cost doubles each level: 5000 -> 10000 -> 20000 -> 40000
    const enhanceCost = 5000 * Math.pow(2, currentLevel - 1);
    // Success rates: Lv1->2: 100%, Lv2->3: 80%, Lv3->4: 50%, Lv4->5: 10%
    const successRates = [100, 80, 50, 10, 0];
    const nextSuccessRate = successRates[currentLevel - 1] || 0;

    div.innerHTML = `
        ${previewImgTag}
        <div style="font-size: 40px; margin-bottom: 5px;">${data.icon}</div>
        <div style="font-weight: bold; margin-bottom: 2px;">${data.name}</div>
        ${isOwned && category === 'char' ? `<div style="color: #2ecc71; font-size: 14px; font-weight: bold; margin-bottom: 5px;">Lv. ${currentLevel}</div>` : ''}
        ${requirementDisplay}
        ${!isOwned && data.price ? `<div style="color: #f1c40f; font-size: 14px; margin-bottom: 8px;">💰 ${data.price}</div>` : ''}
        ${effectDisplay}
        <div style="display: flex; gap: 5px; margin-top: 8px;">
            <button id="btn-${id}" 
                class="${isOwned ? 'equip-btn' : 'buy-btn'}"
                style="flex: 2; padding: 8px; border-radius: 6px; cursor: pointer; border: none; font-weight: bold; background: ${isOwned ? (isEquipped ? '#555' : '#27ae60') : (data.price ? '#e67e22' : '#7f8c8d')}; color: #fff;">
                ${isOwned ? (isEquipped ? '장착됨' : '장착하기') : (data.price ? '구매하기' : '잠김')}
            </button>
            ${category === 'char' ? (
            isOwned && currentLevel < 5 ? `
                <button class="enhance-btn" data-id="${id}"
                    style="flex: 1.2; padding: 8px 5px; border-radius: 8px; cursor: pointer; border: 2px solid #f1c40f; background: linear-gradient(135deg, #f1c40f, #f39c12); color: #000; font-size: 10px; font-weight: 900; box-shadow: 0 0 12px rgba(241, 196, 15, 0.6);">
                    강화<br>${enhanceCost}G<br><span style="font-size:9px; color:#333;">(${nextSuccessRate}%)</span>
                </button>` : (isOwned && currentLevel >= 5 ? `<div style="flex: 1; font-size: 10px; color: #f1c40f; display: flex; align-items: center; justify-content: center; font-weight: bold;">✨MAX</div>` : `<div style="flex: 1; font-size: 10px; color: #666; display: flex; align-items: center; justify-content: center;">구매 후<br>강화가능</div>`)
        ) : ''}
        </div>
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
        'char': { data: window.SKIN_DATA, containerId: 'shop-items-char', category: 'char' },
        'stair': { data: STAIR_SKIN_DATA, containerId: 'shop-items-stair', category: 'stair' },
        'pet': { data: PET_DATA, containerId: 'shop-items-pet', category: 'pet' },
        'map': { data: MAP_DATA, containerId: 'shop-items-map', category: 'map' }
    };

    // Update Current Equipped Displays
    const skinDisplay = document.getElementById('current-skin-display');
    if (skinDisplay && window.SKIN_DATA[window.currentSkin]) skinDisplay.innerText = window.SKIN_DATA[window.currentSkin].icon + ' ' + window.SKIN_DATA[window.currentSkin].name;

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

    // Enhancement Overlay Events
    bindEnhanceEvents();
}

// ============================================================
// Enhancement Overlay Functions
// ============================================================
function bindEnhanceEvents() {
    const openBtn = document.getElementById('enhance-open-btn');
    const overlay = document.getElementById('enhance-overlay');
    const closeBtns = [document.getElementById('close-enhance-btn'), document.getElementById('close-enhance-btn-bottom')];

    if (openBtn) {
        openBtn.onclick = () => {
            overlay.style.display = 'flex';
            updateEnhanceUI();
        };
    }

    closeBtns.forEach(btn => {
        if (btn) btn.onclick = () => overlay.style.display = 'none';
    });
}

function updateEnhanceUI() {
    // Update gold display
    const goldDisplay = document.getElementById('enhance-gold-display');
    if (goldDisplay) goldDisplay.innerText = window.totalCoins;

    // Update skin list
    const skinList = document.getElementById('enhance-skin-list');
    if (!skinList) return;

    skinList.innerHTML = '';

    window.ownedSkins.forEach(id => {
        const skinData = window.SKIN_DATA?.[id];
        if (!skinData) return;

        const currentLevel = window.skinLevels?.[id] || 1;
        const isMaxLevel = currentLevel >= 5;
        const cost = 5000 * Math.pow(2, currentLevel - 1);
        const successRates = [100, 80, 50, 10];
        const successRate = successRates[currentLevel - 1] || 0;

        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = 'display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; border:1px solid rgba(255,255,255,0.1);';

        itemDiv.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px;">
                <span style="font-size:32px;">${skinData.icon}</span>
                <div>
                    <div style="color:#fff; font-weight:bold; font-size:14px;">${skinData.name}</div>
                    <div style="color:#2ecc71; font-size:13px; font-weight:bold;">Lv. ${currentLevel}${isMaxLevel ? ' <span style="color:#f1c40f;">✨MAX</span>' : ''}</div>
                </div>
            </div>
            ${isMaxLevel ?
                '<div style="color:#f1c40f; font-weight:bold; font-size:12px;">최대 레벨!</div>' :
                `<button class="enhance-action-btn" data-id="${id}" 
                    style="background:linear-gradient(135deg, #f1c40f, #f39c12); color:#000; border:none; padding:10px 15px; border-radius:10px; cursor:pointer; font-weight:900; font-size:12px; box-shadow: 0 0 10px rgba(241, 196, 15, 0.4);">
                    강화<br>${cost}G (${successRate}%)
                </button>`
            }
        `;

        skinList.appendChild(itemDiv);
    });

    // Bind enhance action buttons
    document.querySelectorAll('.enhance-action-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            performEnhancement(id);
        };
    });
}

function performEnhancement(id) {
    const currentLevel = window.skinLevels[id] || 1;

    if (currentLevel >= 5) {
        return alert('✨ 이미 최대 레벨(Lv.5)입니다!');
    }

    const cost = 5000 * Math.pow(2, currentLevel - 1);
    const successRates = [100, 80, 50, 10];
    const successRate = successRates[currentLevel - 1] || 0;

    if (window.totalCoins < cost) {
        return alert(`❌ 골드가 부족합니다! (필요: ${cost}G)`);
    }

    const skinName = window.SKIN_DATA?.[id]?.name || id;
    if (confirm(`${skinName} 스킨을 Lv.${currentLevel + 1}로 강화하시겠습니까?\n\n비용: ${cost}G\n성공확률: ${successRate}%\n\n⚠️ 실패 시 골드만 소모됩니다!`)) {
        // Deduct gold first
        window.totalCoins -= cost;
        localStorage.setItem('infinite_stairs_coins', window.totalCoins);

        // Roll for success
        const roll = Math.random() * 100;
        const success = roll < successRate;

        if (success) {
            window.skinLevels[id] = currentLevel + 1;
            localStorage.setItem('skinLevels', JSON.stringify(window.skinLevels));
            alert(`✨ 강화 성공! ${skinName} Lv.${window.skinLevels[id]} 달성!`);
        } else {
            alert(`💥 강화 실패... (${cost}G 소모)\n다음에 다시 도전해보세요!`);
        }

        // Sync and Update UI
        if (window.saveData) {
            window.saveData(window.aiHighScore, window.totalCoins, window.ownedSkins, window.currentSkin, window.ownedStairSkins, window.currentStairSkin, window.ownedPets, window.currentPet, window.ownedMaps, window.currentMap, window.pharaohCrowns, window.snowCrystals, window.skinLevels);
        }
        updateEnhanceUI();
        updateShopUI();
    }
}


function equipStairSkin(id) {
    console.log('[Shop] Equipping stair skin:', id);
    currentStairSkin = id;
    localStorage.setItem('currentStairSkin', id);
    localStorage.setItem('ownedStairSkins', JSON.stringify(ownedStairSkins));
    if (window.saveData) {
        window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin, ownedPets, currentPet, ownedMaps, currentMap, window.pharaohCrowns, window.snowCrystals);
    }
    updateShopUI();
}

function equipPet(id) {
    console.log('[Shop] Equipping pet:', id);
    currentPet = id;
    localStorage.setItem('currentPet', id);
    localStorage.setItem('ownedPets', JSON.stringify(ownedPets));
    if (window.saveData) {
        window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin, ownedPets, currentPet, ownedMaps, currentMap, window.pharaohCrowns, window.snowCrystals);
    }
    updateShopUI();
}

function equipMap(id) {
    console.log('[Shop] Equipping map:', id);
    window.currentMap = id;
    localStorage.setItem('currentMap', id);
    localStorage.setItem('ownedMaps', JSON.stringify(window.ownedMaps));
    if (window.saveData) {
        window.saveData(window.aiHighScore, window.totalCoins, window.ownedSkins, window.currentSkin, window.ownedStairSkins, window.currentStairSkin, window.ownedPets, window.currentPet, window.ownedMaps, window.currentMap, window.pharaohCrowns, window.snowCrystals);
    }
    updateShopUI();
}

function bindBuyEquipButtons() {
    document.querySelectorAll('.shop-item button').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const category = btn.dataset.category;
            const price = parseInt(btn.dataset.price);

            const isOwned = checkOwnership(id, category);

            if (isOwned) {
                // Equip flow
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
                    // Check requirement
                    if (category === 'char') {
                        const item = window.SKIN_DATA[id];
                        if (item && item.requirement && aiHighScore < item.requirement) {
                            return alert(`🔒 기록이 부족합니다! (${item.requirement}계단 필요)`);
                        }
                    } else if (category === 'pet') {
                        const item = PET_DATA[id];
                        if (item && item.requirement) {
                            if (item.requirement === 'crowns') {
                                if ((window.pharaohCrowns || 0) < item.requirementCount) {
                                    return alert(`🔒 파라오의 왕관이 부족합니다! (${window.pharaohCrowns || 0}/${item.requirementCount})`);
                                }
                            } else if (item.requirement === 'snowcrystals') {
                                if ((window.snowCrystals || 0) < item.requirementCount) {
                                    return alert(`🔒 눈결정이 부족합니다! (${window.snowCrystals || 0}/${item.requirementCount})`);
                                }
                            }
                        }
                    }
                    // Else free, proceed to buy (add to owned)
                    // For price 0 items, we treat them as "buyable" for 0 gold after requirement check
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
                        window.saveData(window.aiHighScore, window.totalCoins, window.ownedSkins, window.currentSkin, window.ownedStairSkins, window.currentStairSkin, window.ownedPets, window.currentPet, window.ownedMaps, window.currentMap, window.pharaohCrowns, window.snowCrystals);
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

    // Enhance Button Clicks
    document.querySelectorAll('.enhance-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            enhanceSkin(id);
        };
    });
}

function enhanceSkin(id) {
    const currentLevel = window.skinLevels[id] || 1;

    if (currentLevel >= 5) {
        return alert('✨ 이미 최대 레벨(Lv.5)입니다!');
    }

    // Cost doubles each level: 5000 -> 10000 -> 20000 -> 40000
    const cost = 5000 * Math.pow(2, currentLevel - 1);
    // Success rates: Lv1->2: 100%, Lv2->3: 80%, Lv3->4: 50%, Lv4->5: 10%
    const successRates = [100, 80, 50, 10];
    const successRate = successRates[currentLevel - 1] || 0;

    if (window.totalCoins < cost) {
        return alert(`❌ 골드가 부족합니다! (필요: ${cost}G)`);
    }

    const skinName = window.SKIN_DATA?.[id]?.name || id;
    if (confirm(`${skinName} 스킨을 Lv.${currentLevel + 1}로 강화하시겠습니까?\n\n비용: ${cost}G\n성공확률: ${successRate}%\n\n⚠️ 실패 시 골드만 소모됩니다!`)) {
        // Deduct gold first
        window.totalCoins -= cost;
        localStorage.setItem('infinite_stairs_coins', window.totalCoins);

        // Roll for success
        const roll = Math.random() * 100;
        const success = roll < successRate;

        if (success) {
            window.skinLevels[id] = currentLevel + 1;
            localStorage.setItem('skinLevels', JSON.stringify(window.skinLevels));
            alert(`✨ 강화 성공! ${skinName} Lv.${window.skinLevels[id]} 달성!`);
        } else {
            alert(`💥 강화 실패... (${cost}G 소모)\n다음에 다시 도전해보세요!`);
        }

        // Sync and Update UI
        if (window.saveData) {
            window.saveData(window.aiHighScore, window.totalCoins, window.ownedSkins, window.currentSkin, window.ownedStairSkins, window.currentStairSkin, window.ownedPets, window.currentPet, window.ownedMaps, window.currentMap, window.pharaohCrowns, window.snowCrystals, window.skinLevels);
        }
        updateShopUI();
    }
}

// ============================================================
// Enhancement Overlay Functions
// ============================================================

function bindEnhanceOverlayEvents() {
    const openBtn = document.getElementById('enhance-open-btn');
    const closeBtn = document.getElementById('close-enhance-btn');
    const overlay = document.getElementById('enhance-overlay');

    if (openBtn) {
        openBtn.onclick = () => {
            updateEnhanceUI();
            overlay.style.display = 'flex';
        };
    }

    if (closeBtn) {
        closeBtn.onclick = () => {
            overlay.style.display = 'none';
        };
    }

    // Clicking outside the content closes the overlay
    if (overlay) {
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.style.display = 'none';
            }
        };
    }

    console.log('[Shop] Enhancement overlay events bound.');
}

function updateEnhanceUI() {
    const goldDisplay = document.getElementById('enhance-gold-display');
    const listContainer = document.getElementById('enhance-skin-list');

    if (goldDisplay) {
        goldDisplay.textContent = (window.totalCoins || 0).toLocaleString();
    }

    if (!listContainer) return;

    // Clear and rebuild owned skins list
    listContainer.innerHTML = '';

    const ownedSkins = window.ownedSkins || ['default'];
    const skinData = window.SKIN_DATA || {};

    ownedSkins.forEach(skinId => {
        const data = skinData[skinId];
        if (!data) return;

        const currentLevel = (window.skinLevels && window.skinLevels[skinId]) || 1;
        const isMaxLevel = currentLevel >= 5;

        const item = document.createElement('div');
        item.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:15px; background:rgba(255,255,255,0.05); border-radius:12px; margin-bottom:10px; border:1px solid rgba(255,255,255,0.1);';

        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <span style="font-size:32px;">${data.icon || '⚪'}</span>
                <div>
                    <div style="color:#fff; font-weight:bold;">${data.name || skinId}</div>
                    <div style="color:#f1c40f; font-size:13px;">Lv.${currentLevel}</div>
                </div>
            </div>
            ${isMaxLevel
                ? '<span style="color:#2ecc71; font-weight:bold; font-size:18px;">✨MAX</span>'
                : `<button class="perform-enhance-btn" data-skin-id="${skinId}" style="background:linear-gradient(135deg, #f1c40f, #f39c12); color:#000; border:none; padding:10px 20px; border-radius:20px; font-weight:bold; cursor:pointer;">강화</button>`
            }
        `;

        listContainer.appendChild(item);
    });

    // Bind enhance button events
    listContainer.querySelectorAll('.perform-enhance-btn').forEach(btn => {
        btn.onclick = () => {
            const skinId = btn.dataset.skinId;
            performEnhancement(skinId);
        };
    });
}

function performEnhancement(skinId) {
    const currentLevel = (window.skinLevels && window.skinLevels[skinId]) || 1;

    if (currentLevel >= 5) {
        return alert('✨ 이미 최대 레벨(Lv.5)입니다!');
    }

    // Cost: 5000 -> 10000 -> 20000 -> 40000
    const cost = 5000 * Math.pow(2, currentLevel - 1);
    // Success rates: Lv1->2: 100%, Lv2->3: 80%, Lv3->4: 50%, Lv4->5: 10%
    const successRates = [100, 80, 50, 10];
    const successRate = successRates[currentLevel - 1] || 0;

    if ((window.totalCoins || 0) < cost) {
        return alert(`❌ 골드가 부족합니다! (필요: ${cost.toLocaleString()}G)`);
    }

    const skinName = (window.SKIN_DATA && window.SKIN_DATA[skinId] && window.SKIN_DATA[skinId].name) || skinId;
    if (confirm(`${skinName} 스킨을 Lv.${currentLevel + 1}로 강화하시겠습니까?\n\n비용: ${cost.toLocaleString()}G\n성공확률: ${successRate}%\n\n⚠️ 실패 시 골드만 소모됩니다!`)) {
        // Deduct gold
        window.totalCoins -= cost;
        localStorage.setItem('infinite_stairs_coins', window.totalCoins);

        // Roll for success
        const roll = Math.random() * 100;
        const success = roll < successRate;

        if (success) {
            if (!window.skinLevels) window.skinLevels = {};
            window.skinLevels[skinId] = currentLevel + 1;
            localStorage.setItem('skinLevels', JSON.stringify(window.skinLevels));
            alert(`✨ 강화 성공! ${skinName} Lv.${window.skinLevels[skinId]} 달성!`);
        } else {
            alert(`💥 강화 실패... (${cost.toLocaleString()}G 소모)\n다음에 다시 도전해보세요!`);
        }

        // Sync and Update UI
        if (window.saveData) {
            window.saveData(window.aiHighScore, window.totalCoins, window.ownedSkins, window.currentSkin, window.ownedStairSkins, window.currentStairSkin, window.ownedPets, window.currentPet, window.ownedMaps, window.currentMap, window.pharaohCrowns, window.snowCrystals, window.skinLevels);
        }
        updateEnhanceUI();
    }
}

// Auto-bind enhancement events when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEnhanceOverlayEvents);
} else {
    bindEnhanceOverlayEvents();
}
