// ============================================================
// game/shop.js - Shop UI and Purchase Logic
// ============================================================

function bindShopEvents() {
    // Open Button
    const openBtn = document.getElementById('shop-open-btn');
    if (openBtn) {
        openBtn.onclick = () => {
            const overlay = document.getElementById('shop-overlay');
            if (overlay) {
                overlay.style.display = 'flex';
                updateShopUI();
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

function bindBuyEquipButtons() {
    // Buy Buttons
    document.querySelectorAll('.buy-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.stopPropagation();
            const skinId = this.dataset.id;
            const price = parseInt(this.dataset.price);
            console.log('[Shop] Buy clicked:', skinId, price);

            if (ownedSkins.includes(skinId)) {
                equipSkin(skinId);
                return;
            }

            const skin = SKIN_DATA[skinId];
            const isRequirementMet = skin && (!skin.requirement || aiHighScore >= skin.requirement);

            if (totalCoins >= price && isRequirementMet) {
                if (price > 0) totalCoins -= price;
                ownedSkins.push(skinId);
                if (coinEl) coinEl.innerText = totalCoins;
                updateShopUI();
                if (window.saveData) {
                    window.saveData(aiHighScore, totalCoins, ownedSkins, currentSkin);
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

    // Equip Buttons
    document.querySelectorAll('.equip-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.stopPropagation();
            const skinId = this.dataset.skin || this.dataset.id;
            console.log('[Shop] Equip clicked:', skinId);
            equipSkin(skinId);
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

    document.querySelectorAll('.buy-btn').forEach(btn => {
        const skinId = btn.dataset.id;
        const skin = SKIN_DATA[skinId];

        if (ownedSkins.includes(skinId)) {
            btn.innerText = currentSkin === skinId ? '✓ 장착중' : '장착하기';
            btn.style.background = currentSkin === skinId ? '#7f8c8d' : '#2ecc71';
            btn.disabled = currentSkin === skinId;
            btn.classList.add('equip-btn');
            btn.classList.remove('buy-btn');
        } else if (skin && skin.requirement) {
            const isUnlocked = aiHighScore >= skin.requirement;
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
}
