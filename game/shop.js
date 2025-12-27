// ============================================================
// game/shop.js - Shop UI and Purchase Logic
// ============================================================

const STAIR_SKIN_DATA = {
    default: { name: '기본 계단', icon: '🏢' },
    stair_glass: { name: '유리 계단', icon: '🧊', price: 1000, type: 'glass' }
};

const PET_DATA = {
    none: { name: '없음', icon: '❌' },
    pet_dog: { name: '강아지', icon: '🐕', price: 1000, type: 'ground' },
    pet_cat: { name: '고양이', icon: '🐈', price: 3000, type: 'ground' },
    pet_eagle: { name: '독수리', icon: '🦅', price: 10000, type: 'air' },
    pet_pig: { name: '황금돼지', icon: '🐷', price: 10000, type: 'ground' }
};

function switchShopTab(tab) {
    const charTab = document.getElementById('tab-char');
    const stairTab = document.getElementById('tab-stair');
    const petTab = document.getElementById('tab-pet');
    const charSec = document.getElementById('shop-section-char');
    const stairSec = document.getElementById('shop-section-stair');
    const petSec = document.getElementById('shop-section-pet');

    if (!charTab || !stairTab || !charSec || !stairSec || !petTab || !petSec) return;

    // Reset all
    [charSec, stairSec, petSec].forEach(s => s.style.display = 'none');
    [charTab, stairTab, petTab].forEach(t => { t.style.background = '#333'; t.style.color = '#fff'; });

    if (tab === 'char') {
        charSec.style.display = 'block';
        charTab.style.background = '#f1c40f';
        charTab.style.color = '#000';
    } else if (tab === 'stair') {
        stairSec.style.display = 'block';
        stairTab.style.background = '#f1c40f';
        stairTab.style.color = '#000';
    } else if (tab === 'pet') {
        petSec.style.display = 'block';
        petTab.style.background = '#f1c40f';
        petTab.style.color = '#000';
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

function equipPet(petId) {
    currentPet = petId;
    localStorage.setItem('currentPet', petId);
    updateShopUI();
    console.log(`Equipped pet: ${petId}`);
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
                    window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin, ownedPets, currentPet);
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
                    window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin, ownedPets, currentPet);
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
                    window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin, ownedStairSkins, currentStairSkin, ownedPets, currentPet);
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

    // Pet UI update
    document.querySelectorAll('.buy-pet-btn').forEach(btn => {
        const petId = btn.dataset.id;
        if (ownedPets.includes(petId)) {
            btn.innerText = currentPet === petId ? '✓ 장착중' : '장착하기';
            btn.style.background = currentPet === petId ? '#7f8c8d' : '#2ecc71';
            btn.disabled = currentPet === petId;
            btn.classList.add('equip-pet-btn');
            btn.classList.remove('buy-pet-btn');
        }
    });

    document.querySelectorAll('.equip-pet-btn').forEach(btn => {
        const petId = btn.dataset.pet || btn.dataset.id;
        if (petId === currentPet) {
            btn.innerText = '✓ 장착중';
            btn.style.background = '#7f8c8d';
            btn.disabled = true;
        } else if (ownedPets.includes(petId) || petId === 'none') {
            btn.innerText = '장착하기';
            btn.style.background = '#2ecc71';
            btn.disabled = false;
        }
    });
}
