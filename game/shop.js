// ============================================================
// game/shop.js - Shop UI and Purchase Logic
// ============================================================

const STAIR_SKIN_DATA = {
    default: { name: '기본 계단', icon: '🏢' },
    stair_glass: { name: '유리 계단', icon: '🧊', price: 1000, type: 'glass' }
};

function switchShopTab(tab) {
    const charTab = document.getElementById('tab-char');
    const stairTab = document.getElementById('tab-stair');
    const charSec = document.getElementById('shop-section-char');
    const stairSec = document.getElementById('shop-section-stair');

    if (!charTab || !stairTab || !charSec || !stairSec) return;

    if (tab === 'char') {
        charSec.style.display = 'block';
        stairSec.style.display = 'none';
        charTab.style.background = '#f1c40f';
        charTab.style.color = '#000';
        stairTab.style.background = '#333';
        stairTab.style.color = '#fff';
    } else {
        charSec.style.display = 'none';
        stairSec.style.display = 'block';
        charTab.style.background = '#333';
        charTab.style.color = '#fff';
        stairTab.style.background = '#f1c40f';
        stairTab.style.color = '#000';
    }
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
                    window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin);
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
                    window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin);
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
        if (skinId === currentSkin) {
            btn.innerText = '✓ 장착중';
            btn.style.background = '#7f8c8d';
            btn.disabled = true;
        } else if (ownedSkins.includes(skinId)) {
            btn.innerText = '장착하기';
            btn.style.background = '#2ecc71';
            btn.disabled = false;
        }
    });

    // Stair Skins UI update
    document.querySelectorAll('.buy-stair-btn').forEach(btn => {
        const stairId = btn.dataset.id;
        if (ownedStairSkins.includes(stairId)) {
            btn.innerText = currentStairSkin === stairId ? '✓ 장착중' : '장착하기';
            btn.style.background = currentStairSkin === stairId ? '#7f8c8d' : '#2ecc71';
            btn.disabled = currentStairSkin === stairId;
            btn.classList.add('equip-stair-btn');
            btn.classList.remove('buy-stair-btn');
        }
    });

    document.querySelectorAll('.equip-stair-btn').forEach(btn => {
        const stairId = btn.dataset.stair || btn.dataset.id;
        if (stairId === currentStairSkin) {
            btn.innerText = '✓ 장착중';
            btn.style.background = '#7f8c8d';
            btn.disabled = true;
        } else if (ownedStairSkins.includes(stairId)) {
            btn.innerText = '장착하기';
            btn.style.background = '#2ecc71';
            btn.disabled = false;
        }
    });
}
