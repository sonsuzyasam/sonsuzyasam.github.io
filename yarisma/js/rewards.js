// ===== REWARDS.JS =====

class Rewards {
    constructor() {
        this.historyKey = 'sonsuzyasam_reward_history';
        this.processedKey = 'sonsuzyasam_processed_approvals';
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
            const requestId = this.createRequestId();
            const createdAt = new Date().toISOString();

            const entry = {
                requestId,
                dateISO: createdAt,
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
                await sheetsAPI.saveRewardRequest(app.currentUser.email, rewardType, details, points, {
                    requestId,
                    createdAt,
                    month: CONFIG.getCurrentMonth()
                });
            }

            await this.loadRewardHistory();
            form.reset();
            app.showNotification('Odul talebin kaydedildi.', 'success');
        });
    }

    async loadRewardHistory() {
        const container = document.getElementById('historyList');
        if (!container) return;

        let list = JSON.parse(localStorage.getItem(this.historyKey) || '[]');
        list = await this.syncApprovalStatus(list);

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

    async syncApprovalStatus(localList) {
        if (!app.currentUser || !window.sheetsAPI || typeof sheetsAPI.getRewardRequestsByEmail !== 'function') {
            return localList;
        }

        const remoteList = await sheetsAPI.getRewardRequestsByEmail(app.currentUser.email);
        if (!remoteList.length) return localList;

        const processedMap = JSON.parse(localStorage.getItem(this.processedKey) || '{}');
        const merged = localList.map((entry) => {
            const remote = this.findRemoteMatch(entry, remoteList);
            if (!remote) return entry;

            const next = {
                ...entry,
                requestId: entry.requestId || remote.requestId,
                status: remote.status || entry.status
            };

            const normalized = String(next.status).toLowerCase();
            const isApproved = normalized === 'onayli' || normalized === 'onaylı' || normalized === 'approved';

            if (isApproved && next.requestId && !processedMap[next.requestId]) {
                app.deductPoints(Number(next.points || 0));
                processedMap[next.requestId] = true;
                app.showNotification('Odul talebin onaylandi. Puan bakiyenden dusuldu.', 'success');
            }

            return next;
        });

        localStorage.setItem(this.processedKey, JSON.stringify(processedMap));
        localStorage.setItem(this.historyKey, JSON.stringify(merged));
        return merged;
    }

    findRemoteMatch(localEntry, remoteList) {
        if (localEntry.requestId) {
            const byId = remoteList.find((item) => item.requestId && item.requestId === localEntry.requestId);
            if (byId) return byId;
        }

        return remoteList.find((item) =>
            item.rewardType === localEntry.rewardType &&
            Number(item.points || 0) === Number(localEntry.points || 0) &&
            String(item.details || '').trim() === String(localEntry.details || '').trim()
        );
    }

    createRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
}

window.rewards = new Rewards();
