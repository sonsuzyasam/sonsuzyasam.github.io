// ===== ADMIN.JS - Admin Approval Page =====

class AdminApp {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        this.bindUi();
        this.loadStoredUser();
    }

    bindUi() {
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                if (this.currentUser) {
                    this.logout();
                    return;
                }
                this.showModal('loginModal');
            });
        }

        document.querySelectorAll('.close').forEach((closeBtn) => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    }

    loadStoredUser() {
        const stored = localStorage.getItem(STORAGE_KEYS.USER);
        if (!stored) return;

        try {
            this.currentUser = JSON.parse(stored);
            this.updateUserUI();
            this.refreshAdminState();
        } catch (_) {
            localStorage.removeItem(STORAGE_KEYS.USER);
        }
    }

    onAuthUser(user) {
        this.currentUser = user;

        if (user) {
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
            this.closeModal('loginModal');
        } else {
            localStorage.removeItem(STORAGE_KEYS.USER);
        }

        this.updateUserUI();
        this.refreshAdminState();
    }

    isAdminUser() {
        if (!this.currentUser || !this.currentUser.email) return false;
        return (CONFIG.ADMIN_EMAILS || [])
            .map((item) => String(item).toLowerCase())
            .includes(String(this.currentUser.email).toLowerCase());
    }

    async refreshAdminState() {
        const message = document.getElementById('adminAccessMessage');
        const queue = document.getElementById('adminQueueList');

        if (!this.currentUser) {
            if (message) message.textContent = 'Bu sayfayı kullanmak için admin hesabıyla giriş yapın.';
            if (queue) queue.innerHTML = '<p>Henüz giriş yapılmadı.</p>';
            return;
        }

        if (!this.isAdminUser()) {
            if (message) message.textContent = 'Bu hesap admin listesinde değil. Lütfen yetkili hesapla giriş yapın.';
            if (queue) queue.innerHTML = '<p>Yetkisiz erişim.</p>';
            this.showNotification('Bu hesap admin yetkisine sahip değil.', 'error');
            return;
        }

        if (message) message.textContent = 'Admin doğrulandı. Talepler aşağıda listelenir.';
        await rewards.loadAdminQueue();
    }

    updateUserUI() {
        const userName = document.getElementById('userName');
        const loginBtn = document.getElementById('loginBtn');

        if (this.currentUser) {
            userName.textContent = this.currentUser.name || this.currentUser.email;
            loginBtn.textContent = 'Çıkış Yap';
        } else {
            userName.textContent = 'Admin Girişi';
            loginBtn.textContent = 'Giriş';
        }
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('show');
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('show');
    }

    async logout() {
        if (!confirm('Çıkış yapmak istediğinizden emin misiniz?')) return;

        if (window.authManager && typeof window.authManager.logout === 'function') {
            await authManager.logout();
        }

        this.onAuthUser(null);
        this.showNotification('Admin oturumu kapatıldı.', 'success');
    }

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
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new AdminApp();
    window.app = app;

    if (window.authManager && typeof window.authManager.attachApp === 'function') {
        window.authManager.attachApp(app);
    }
});
