// ===== MAIN.JS - Ana Uygulama Mantığı =====

class App {
    constructor() {
        this.currentUser = null;
        this.currentMonth = CONFIG.getCurrentMonth();
        this.pendingConsentUser = null;
        this.pointsCache = {};
        this.dailyQuota = {
            used: 0,
            remaining: CONFIG.QUIZ_POLICY.DAILY_ATTEMPT_LIMIT,
            limit: CONFIG.QUIZ_POLICY.DAILY_ATTEMPT_LIMIT
        };
        this.init();
    }

    init() {
        this.loadUser();
        this.setupEventListeners();
        this.loadExams();
        this.updateDashboard();
        this.reconcileStoredSession();
        if (this.currentUser) {
            this.refreshMonthlyPointsFromServer();
            this.refreshDailyQuizQuota();
        }
    }

    async claimGuestPendingPoints() {
        return 0;
    }
    // === Event Listeners ===
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.goToPage(e.currentTarget.dataset.page);
            });
        });

        // Login
        document.getElementById('loginBtn').addEventListener('click', () => {
            if (this.currentUser) {
                this.logout();
                return;
            }
            this.showModal('loginModal');
        });

        // Modal Close
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.closeModal(modal.id);
            });
        });

        // Consent modal buttons
        const consentConfirmBtn = document.getElementById('consentConfirmBtn');
        if (consentConfirmBtn) {
            consentConfirmBtn.addEventListener('click', () => this.submitConsent());
        }
        const consentDeclineBtn = document.getElementById('consentDeclineBtn');
        if (consentDeclineBtn) {
            consentDeclineBtn.addEventListener('click', () => {
                this.pendingConsentUser = null;
                this.closeModal('consentRequiredModal');
                if (window.authManager && typeof authManager.logout === 'function') authManager.logout();
            });
        }

        // Settings
        const notificationToggle = document.getElementById('notificationToggle');
        if (notificationToggle) {
            notificationToggle.addEventListener('change', (e) => {
                this.saveSetting('notifications', e.target.checked);
            });
        }
    }

    // === User Management ===
    loadUser() {
        const stored = localStorage.getItem(STORAGE_KEYS.USER);
        if (stored) {
            this.currentUser = JSON.parse(stored);
            this.updateUserUI();
        }
    }

    reconcileStoredSession() {
        setTimeout(() => {
            try {
                const firebaseUser = Boolean(window.authManager && window.authManager.auth && window.authManager.auth.currentUser);
                if (!firebaseUser && this.currentUser) {
                    this.onAuthUser(null);
                }
            } catch (error) {
                console.warn('Session reconciliation failed:', error);
            }
        }, 1200);
    }

    onAuthUser(user) {
        this.currentUser = user;

        if (user) {
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
            if (window.sheetsAPI && typeof window.sheetsAPI.appendUser === 'function') {
                Promise.resolve(sheetsAPI.appendUser(user)).catch((error) => {
                    const msg = String(error && error.message ? error.message : error);
                    if (msg.toLowerCase().includes('consent required')) {
                        this.handleConsentRequired(user);
                    } else {
                        console.warn('User profile could not be synced:', error);
                    }
                });
            }
            this.closeModal('loginModal');
            this.refreshMonthlyPointsFromServer();
            this.refreshDailyQuizQuota();
        } else {
            localStorage.removeItem(STORAGE_KEYS.USER);
            this.pointsCache = {};
            this.dailyQuota = {
                used: 0,
                remaining: CONFIG.QUIZ_POLICY.DAILY_ATTEMPT_LIMIT,
                limit: CONFIG.QUIZ_POLICY.DAILY_ATTEMPT_LIMIT
            };
        }

        this.updateUserUI();
        this.updateDashboard();
    }

    logout() {
        if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
            if (window.authManager && typeof window.authManager.logout === 'function') {
                authManager.logout();
            } else {
                this.onAuthUser(null);
            }
            this.goToPage('dashboard');
            this.showNotification('Başarıyla çıkış yaptınız!', 'success');
        }
    }

    updateUserUI() {
        if (this.currentUser) {
            document.getElementById('userName').textContent = this.currentUser.name;
            document.getElementById('loginBtn').textContent = 'Çıkış Yap';
            document.getElementById('profileName').textContent = this.currentUser.name;
            document.getElementById('profileEmail').textContent = this.currentUser.email;
        } else {
            document.getElementById('userName').textContent = 'Misafir';
            document.getElementById('loginBtn').textContent = 'Giriş Yap';
            document.getElementById('profileName').textContent = '-';
            document.getElementById('profileEmail').textContent = '-';
        }
        this.updateNavVisibility();
    }

    updateNavVisibility() {
        const rewardsBtn = document.querySelector('.nav-btn[data-page="rewards"]');
        const moreBtn = document.querySelector('.nav-btn[data-page="my-rewards"]');
        
        if (!this.currentUser) {
            if (rewardsBtn) rewardsBtn.style.display = 'none';
            if (moreBtn) moreBtn.style.display = 'none';
        } else {
            if (rewardsBtn) rewardsBtn.style.display = '';
            if (moreBtn) moreBtn.style.display = '';
        }
    }

    isAdminUser() {
        if (!this.currentUser || !this.currentUser.email) return false;
        const allowed = CONFIG.ADMIN_EMAILS || [];
        return allowed.map((item) => String(item).toLowerCase()).includes(String(this.currentUser.email).toLowerCase());
    }

    // === Navigation ===
    goToPage(pageName) {
        // Giriş yapılmamışsa ödül sayfalarına erişim yasla
        if (!this.currentUser && (pageName === 'rewards' || pageName === 'my-rewards')) {
            this.showNotification('Ödül sayfalarına erişmek için lütfen giriş yapınız.', 'warning');
            this.showModal('loginModal');
            return;
        }

        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        
        document.getElementById(pageName).classList.add('active');

        const activeButton = document.querySelector(`.nav-btn[data-page="${pageName}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }

        // Sayfa yüklendiğinde verileri güncelle
        if (pageName === 'leaderboard') {
            // Do not block leaderboard rendering on a network call.
            leaderboard.loadLeaderboard();
            this.refreshMonthlyPointsFromServer();
        } else if (pageName === 'rewards') {
            rewards.loadRewardHistory();
        } else if (pageName === 'dashboard') {
            this.updateDashboard();
        }
    }

    // === Exams ===
    loadExams() {
        const grid = document.getElementById('examsGrid');
        if (!grid) return;

        grid.innerHTML = '';

        CONFIG.EXAMS.forEach(exam => {
            const milestones = (CONFIG.POINTS_SYSTEM.SAFE_MILESTONES || []).map((item) => item.cashLabel).join(' / ');
            const card = document.createElement('div');
            card.className = 'exam-card';
            card.innerHTML = `
                <h3>${exam.name}</h3>
                <p class="exam-details">${exam.description}</p>
                <div class="exam-details">
                    <span>⏱️ ${exam.duration} dk</span>
                    <span>📊 ${exam.questions} soru</span>
                </div>
                <div class="exam-details">
                    <span>📈 Zorluk: ${exam.difficulty}</span>
                </div>
                <div class="exam-details">
                    <span>🏁 Barajlar: ${milestones}</span>
                </div>
                <div class="exam-details">
                    <span>🎯 Gunluk hak: ${CONFIG.QUIZ_POLICY.DAILY_ATTEMPT_LIMIT}</span>
                </div>
                <button class="exam-button" onclick="app.startExam('${exam.id}')">Soruları Cevapla</button>
            `;
            grid.appendChild(card);
        });

        const quickStartBtn = document.getElementById('examQuickStartBtn');
        if (quickStartBtn) {
            const primaryExam = CONFIG.EXAMS.find((item) => item.id === 'arkeoloji') || CONFIG.EXAMS[0] || null;
            if (!primaryExam) {
                quickStartBtn.style.display = 'none';
                return;
            }

            quickStartBtn.style.display = '';
            quickStartBtn.onclick = () => this.startExam(primaryExam.id);
        }
    }

    async startExam(examId) {
        if (!this.currentUser) {
            this.showModal('loginModal');
            return;
        }

        if (window.quiz && typeof window.quiz.showLoadingOverlay === 'function') {
            window.quiz.showLoadingOverlay('Sorular yükleniyor...');
        }

        try {
            const quota = await this.refreshDailyQuizQuota();
            if (quota && Number(quota.remaining || 0) <= 0) {
                if (window.quiz && typeof window.quiz.hideLoadingOverlay === 'function') {
                    window.quiz.hideLoadingOverlay();
                }
                this.showNotification('Bugünkü 5 yarışma hakkın doldu. Yarın tekrar dene.', 'error');
                return;
            }

            quiz.startExam(examId);
        } catch (error) {
            if (window.quiz && typeof window.quiz.hideLoadingOverlay === 'function') {
                window.quiz.hideLoadingOverlay();
            }
            this.showNotification('Yarışma başlatılamadı. Lütfen tekrar dene.', 'error');
            console.error('startExam failed:', error);
        }
    }

    // === Dashboard ===
    updateDashboard() {
        if (!this.currentUser) {
            document.getElementById('monthPoints').textContent = '--';
            document.getElementById('rewardValue').textContent = '₺--';
            const quotaEl = document.getElementById('dailyQuotaRemaining');
            if (quotaEl) quotaEl.textContent = '--';
            return;
        }

        const points = this.getUserMonthlyPoints();
        const value = (points * CONFIG.POINTS_SYSTEM.MULTIPLIER).toFixed(2);

        document.getElementById('monthPoints').textContent = points;
        document.getElementById('rewardValue').textContent = `₺${value}`;
        document.getElementById('currentPoints').textContent = points;
        document.getElementById('availableReward').textContent = `₺${value}`;
        const quotaEl = document.getElementById('dailyQuotaRemaining');
        if (quotaEl) {
            quotaEl.textContent = Number(this.dailyQuota.remaining || 0);
        }
    }

    getUserMonthlyPoints() {
        return Number(this.pointsCache[this.currentMonth] || 0);
    }

    addPoints(points) {
        // Disabled for security: points are server-authoritative.
        // Keep function for backward compatibility.
        console.warn('Client-side addPoints is disabled. Use server-side scoring.');
    }

    deductPoints(points) {
        // Disabled for security: points are server-authoritative.
        this.refreshMonthlyPointsFromServer();
    }

    async refreshMonthlyPointsFromServer() {
        if (!this.currentUser || !window.sheetsAPI || typeof sheetsAPI.getMonthlyPoints !== 'function') {
            return 0;
        }

        try {
            const points = await sheetsAPI.getMonthlyPoints(this.currentMonth);
            this.pointsCache[this.currentMonth] = Number(points || 0);
            this.updateDashboard();
            const leaderboardPage = document.getElementById('leaderboard');
            if (leaderboardPage && leaderboardPage.classList.contains('active') && window.leaderboard) {
                leaderboard.loadLeaderboard();
            }
            return this.pointsCache[this.currentMonth];
        } catch (error) {
            console.warn('Monthly points could not be loaded from server:', error);
            return 0;
        }
    }

    async refreshDailyQuizQuota() {
        if (!this.currentUser || !window.sheetsAPI || typeof sheetsAPI.getExamQuota !== 'function') {
            return this.dailyQuota;
        }

        try {
            const quota = await sheetsAPI.getExamQuota();
            this.dailyQuota = {
                used: Number(quota.used || 0),
                remaining: Number(quota.remaining || 0),
                limit: Number(quota.limit || CONFIG.QUIZ_POLICY.DAILY_ATTEMPT_LIMIT)
            };
            this.updateDashboard();
            return this.dailyQuota;
        } catch (error) {
            console.warn('Daily quiz quota could not be loaded:', error);
            return this.dailyQuota;
        }
    }

    // === Consent Flow ===
    handleConsentRequired(user) {
        this.pendingConsentUser = user;
        const kvkk = document.getElementById('consentKvkk');
        const terms = document.getElementById('consentTerms');
        if (kvkk) kvkk.checked = false;
        if (terms) terms.checked = false;
        this.showModal('consentRequiredModal');
    }

    async submitConsent() {
        const kvkk = document.getElementById('consentKvkk');
        const terms = document.getElementById('consentTerms');
        if (!kvkk || !kvkk.checked || !terms || !terms.checked) {
            this.showNotification('Devam etmek için her iki onay kutusunu da işaretleyin.', 'error');
            return;
        }
        const user = this.pendingConsentUser;
        if (!user) return;
        try {
            await sheetsAPI.appendUser({
                ...user,
                consents: {
                    kvkkNoticeApproved: true,
                    termsAccepted: true,
                    version: CONFIG.LEGAL.CONSENT_VERSION,
                    approvedAt: new Date().toISOString()
                }
            });
            this.pendingConsentUser = null;
            this.closeModal('consentRequiredModal');
            this.showNotification('Profiliniz başarıyla oluşturuldu.', 'success');
        } catch (err) {
            this.showNotification('Profil oluşturulamadı. Lütfen tekrar deneyin.', 'error');
        }
    }

    // === Modals ===
    showModal(modalId) {
        document.getElementById(modalId).classList.add('show');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('show');

        if (modalId === 'examModal' && window.quiz && typeof quiz.onModalClosed === 'function') {
            quiz.onModalClosed();
        }
    }

    // === Notifications ===
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#2ecc71' : type === 'error' ? '#e74c3c' : '#3498db'};
            color: white;
            border-radius: 6px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // === Settings ===
    saveSetting(key, value) {
        let settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
        settings[key] = value;
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    }

    getSetting(key, defaultValue = null) {
        const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
        return settings[key] !== undefined ? settings[key] : defaultValue;
    }
}

// Global Functions (HTML'den çağrılacak)
function goToPage(pageName) {
    app.goToPage(pageName);
}

function closeModal(modalId) {
    app.closeModal(modalId);
}

function logout() {
    app.logout();
}

function editProfile() {
    alert('Profil duzenleme ozelligi yakinda gelecek. Telefon verisi sistemden kaldirildi.');
}

// App başlat
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new App();
    window.app = app;

    if (window.authManager && typeof window.authManager.attachApp === 'function') {
        window.authManager.attachApp(app);
    }

    // CSS animasyonları ekle
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    console.log('✅ App Initialized');
});
