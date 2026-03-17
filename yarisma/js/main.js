// ===== MAIN.JS - Ana Uygulama Mantığı =====

class App {
    constructor() {
        this.currentUser = null;
        this.currentMonth = CONFIG.getCurrentMonth();
        this.pointsCache = {};
        this.init();
    }

    init() {
        this.loadUser();
        this.setupEventListeners();
        this.loadExams();
        this.updateDashboard();
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

        // Settings
        document.getElementById('notificationToggle').addEventListener('change', (e) => {
            this.saveSetting('notifications', e.target.checked);
        });

        document.getElementById('privacyToggle').addEventListener('change', (e) => {
            this.saveSetting('public', e.target.checked);
        });
    }

    // === User Management ===
    loadUser() {
        const stored = localStorage.getItem(STORAGE_KEYS.USER);
        if (stored) {
            this.currentUser = JSON.parse(stored);
            this.updateUserUI();
        }
    }

    onAuthUser(user) {
        this.currentUser = user;

        if (user) {
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
            if (window.sheetsAPI && typeof window.sheetsAPI.appendUser === 'function') {
                sheetsAPI.appendUser(user);
            }
            this.closeModal('loginModal');
            this.refreshMonthlyPointsFromServer();
        } else {
            localStorage.removeItem(STORAGE_KEYS.USER);
            this.pointsCache = {};
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
            this.showNotification('Basariyla cikis yaptiniz!', 'success');
        }
    }

    updateUserUI() {
        if (this.currentUser) {
            document.getElementById('userName').textContent = this.currentUser.name;
            document.getElementById('loginBtn').textContent = 'Çıkış Yap';
            document.getElementById('profileName').textContent = this.currentUser.name;
            document.getElementById('profileEmail').textContent = this.currentUser.email;
            document.getElementById('profilePhone').textContent = this.currentUser.phone;
        } else {
            document.getElementById('userName').textContent = 'Misafir';
            document.getElementById('loginBtn').textContent = 'Başla';
            document.getElementById('profileName').textContent = '-';
            document.getElementById('profileEmail').textContent = '-';
            document.getElementById('profilePhone').textContent = '-';
        }
    }

    isAdminUser() {
        if (!this.currentUser || !this.currentUser.email) return false;
        const allowed = CONFIG.ADMIN_EMAILS || [];
        return allowed.map((item) => String(item).toLowerCase()).includes(String(this.currentUser.email).toLowerCase());
    }

    // === Navigation ===
    goToPage(pageName) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        
        document.getElementById(pageName).classList.add('active');

        const activeButton = document.querySelector(`.nav-btn[data-page="${pageName}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }

        // Sayfa yüklendiğinde verileri güncelle
        if (pageName === 'leaderboard') {
            leaderboard.loadLeaderboard();
        } else if (pageName === 'rewards') {
            rewards.loadRewardHistory();
        } else if (pageName === 'dashboard') {
            this.updateDashboard();
        }
    }

    // === Exams ===
    loadExams() {
        const grid = document.getElementById('examsGrid');
        grid.innerHTML = '';
        
        CONFIG.EXAMS.forEach(exam => {
            const card = document.createElement('div');
            card.className = 'exam-card';
            card.innerHTML = `
                <h3>📝 ${exam.name}</h3>
                <p class="exam-details">${exam.description}</p>
                <div class="exam-details">
                    <span>⏱️ ${exam.duration} dk</span>
                    <span>📊 ${exam.questions} soru</span>
                </div>
                <div class="exam-details">
                    <span>📈 Zorluk: ${exam.difficulty}</span>
                </div>
                <button class="exam-button" onclick="app.startExam('${exam.id}')">Sınava Başla</button>
            `;
            grid.appendChild(card);
        });
    }

    startExam(examId) {
        if (!this.currentUser) {
            this.showModal('loginModal');
            return;
        }
        quiz.startExam(examId);
    }

    // === Dashboard ===
    updateDashboard() {
        if (!this.currentUser) {
            document.getElementById('monthPoints').textContent = '--';
            document.getElementById('rewardValue').textContent = '₺--';
            return;
        }

        const points = this.getUserMonthlyPoints();
        const value = (points * CONFIG.POINTS_SYSTEM.MULTIPLIER).toFixed(2);

        document.getElementById('monthPoints').textContent = points;
        document.getElementById('rewardValue').textContent = `₺${value}`;
        document.getElementById('currentPoints').textContent = points;
        document.getElementById('availableReward').textContent = `₺${value}`;
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
            return;
        }

        try {
            const points = await sheetsAPI.getMonthlyPoints(this.currentMonth);
            this.pointsCache[this.currentMonth] = Number(points || 0);
            this.updateDashboard();
        } catch (error) {
            console.warn('Monthly points could not be loaded from server:', error);
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
    alert('Profil düzenleme özelliği yakında gelecek!');
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
