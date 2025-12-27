// --- Global Settings ---
window.sfxEnabled = localStorage.getItem('sfx_enabled') !== 'false';

// --- Page Switching Logic ---
window.showPage = function (pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add('active');

    const navBtn = document.getElementById('nav-' + pageId.replace('page-', ''));
    if (navBtn) navBtn.classList.add('active');

    // Pause Infinite Stairs if not on its page
    if (pageId !== 'page-stairs') {
        if (window.gameState) window.gameState.running = false;
        if (typeof stopGame === 'function' && (window.isTraining || window.isAutoPlaying)) stopGame();
        // Hide mobile controls on other pages
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) mobileControls.style.display = 'none';
    } else {
        // Show mobile controls if on mobile and on stairs page
        if (window.innerWidth <= 768) {
            const mobileControls = document.getElementById('mobile-controls');
            if (mobileControls) mobileControls.style.display = 'flex';
        }
    }
}
