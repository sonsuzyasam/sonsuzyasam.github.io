// ===== REWARDS.JS =====

class Rewards {
    constructor() {
        this.historyKey = 'sonsuzyasam_reward_history';
        this.processedKey = 'sonsuzyasam_processed_approvals';
        this.bindForm();
        this.bindAdmin();
    }

    bindAdmin() {
        const refreshBtn = document.getElementById('refreshAdminQueueBtn');
        if (!refreshBtn) return;

        refreshBtn.addEventListener('click', async () => {
            await this.loadAdminQueue();
        });
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
            const rewardValue = points * Number(CONFIG.POINTS_SYSTEM.MULTIPLIER || 0);
            const requestId = this.createRequestId();
            const createdAt = new Date().toISOString();

            if (rewardValue < Number(CONFIG.REWARD_POLICY.MIN_REQUEST_TL || 0)) {
                app.showNotification(`Odul talebi icin en az ₺${Number(CONFIG.REWARD_POLICY.MIN_REQUEST_TL || 0).toFixed(2)} deger birikmeli.`, 'error');
                return;
            }

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
                const result = await sheetsAPI.saveRewardRequest(app.currentUser.email, rewardType, details, points, {
                    requestId,
                    createdAt,
                    month: CONFIG.getCurrentMonth()
                });

                if (result && typeof result.acceptedPoints === 'number') {
                    entry.points = Number(result.acceptedPoints || 0);
                }
            }

            await this.loadRewardHistory();
            form.reset();
            app.showNotification('Odul talebin kaydedildi. Gereksiz kisisel veri girmediginizden emin olun.', 'success');
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
                processedMap[next.requestId] = true;
                app.showNotification('Odul talebin onaylandi. Puan bakiyenden dusuldu.', 'success');
            }

            return next;
        });

        localStorage.setItem(this.processedKey, JSON.stringify(processedMap));
        localStorage.setItem(this.historyKey, JSON.stringify(merged));
        if (typeof app.refreshMonthlyPointsFromServer === 'function') {
            await app.refreshMonthlyPointsFromServer();
        }
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

    async loadAdminQueue() {
        const container = document.getElementById('adminQueueList');
        if (!container) return;

        if (!app || typeof app.isAdminUser !== 'function' || !app.isAdminUser()) {
            container.innerHTML = '<p>Bu alan sadece admin hesaplar icindir.</p>';
            return;
        }

        container.innerHTML = '<p>Talep listesi yukleniyor...</p>';
        const requests = await sheetsAPI.getAllRewardRequests();

        if (!requests.length) {
            container.innerHTML = '<p>Bekleyen veya islenmis talep bulunamadi.</p>';
            return;
        }

        container.innerHTML = requests.map((item) => {
            const statusKey = this.getStatusClass(item.status);
            const canApprove = statusKey !== 'approved';
            const canReject = statusKey !== 'rejected';

            return `
                <div class="admin-queue-item" data-row-index="${item.rowIndex}">
                    <div class="admin-queue-header">
                        <div class="admin-queue-meta">
                            <p><strong>${item.rewardType}</strong></p>
                            <p>${item.email}</p>
                            <p>${item.dateISO || '-'}</p>
                            <p>${item.details || '-'}</p>
                            <p>Puan: ${item.points}</p>
                        </div>
                        <span class="status-chip ${statusKey}">${item.status}</span>
                    </div>

                    <div class="admin-actions">
                        <button class="btn-primary admin-approve-btn" type="button" data-row-index="${item.rowIndex}" ${canApprove ? '' : 'disabled'}>Onayla</button>
                        <button class="btn-danger admin-reject-btn" type="button" data-row-index="${item.rowIndex}" ${canReject ? '' : 'disabled'}>Reddet</button>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.admin-approve-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                await this.updateAdminStatus(Number(btn.dataset.rowIndex), 'Onaylı');
            });
        });

        container.querySelectorAll('.admin-reject-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                await this.updateAdminStatus(Number(btn.dataset.rowIndex), 'Reddedildi');
            });
        });
    }

    async updateAdminStatus(rowIndex, status) {
        if (!rowIndex) return;

        try {
            const result = await sheetsAPI.updateRewardStatus(rowIndex, status);

            if (result && result.transport === 'no-cors') {
                app.showNotification('Durum guncelleme istegi gonderildi. Liste 2-5 sn icinde yenilenecek.', 'info');
            } else {
                app.showNotification(`Talep durumu ${status} olarak guncellendi.`, 'success');
            }

            await new Promise((resolve) => setTimeout(resolve, 1200));
            await this.loadAdminQueue();
        } catch (error) {
            app.showNotification(`Durum guncellenemedi: ${error.message}`, 'error');
        }
    }

    getStatusClass(status) {
        const value = String(status || '').toLowerCase();
        if (value === 'onayli' || value === 'onaylı' || value === 'approved') return 'approved';
        if (value === 'reddedildi' || value === 'rejected') return 'rejected';
        return 'pending';
    }
}

window.rewards = new Rewards();
