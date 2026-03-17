// ===== REWARDS.JS =====

class Rewards {
    constructor() {
        this.historyKey = 'sonsuzyasam_reward_history';
        this.bindForm();
    }

    bindForm() {
        const form = document.getElementById('rewardRequestForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!app.currentUser) {
                app.showNotification('Odul talebi icin once giris yapin.', 'error');
                return;
            }

            const rewardType = document.getElementById('rewardType').value;
            const details = document.getElementById('rewardDetails').value.trim();
            const points = app.getUserMonthlyPoints();

            const entry = {
                date: new Date().toLocaleString('tr-TR'),
                rewardType,
                details,
                points,
                status: 'Beklemede'
            };

            const list = JSON.parse(localStorage.getItem(this.historyKey) || '[]');
            list.unshift(entry);
            localStorage.setItem(this.historyKey, JSON.stringify(list));

            if (window.sheetsAPI && typeof window.sheetsAPI.saveRewardRequest === 'function') {
                await sheetsAPI.saveRewardRequest(app.currentUser.email, rewardType, details, points);
            }

            this.loadRewardHistory();
            form.reset();
            app.showNotification('Odul talebin kaydedildi.', 'success');
        });
    }

    loadRewardHistory() {
        const container = document.getElementById('historyList');
        if (!container) return;

        const list = JSON.parse(localStorage.getItem(this.historyKey) || '[]');
        if (!list.length) {
            container.innerHTML = '<p>Henuz odul talebi yok.</p>';
            return;
        }

        container.innerHTML = list.map((item) => `
            <div class="card" style="margin-bottom: 10px;">
                <p><strong>${item.rewardType}</strong> - ${item.status}</p>
                <p>${item.details}</p>
                <p>${item.date}</p>
            </div>
        `).join('');
    }
}

window.rewards = new Rewards();
