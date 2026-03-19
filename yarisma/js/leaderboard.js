// ===== LEADERBOARD.JS =====

class Leaderboard {
    getCacheKey(month) {
        return `sonsuzyasam_leaderboard_cache_${month}`;
    }

    readCachedRows(month) {
        try {
            const raw = localStorage.getItem(this.getCacheKey(month));
            const parsed = JSON.parse(raw || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    writeCachedRows(month, rows) {
        try {
            localStorage.setItem(this.getCacheKey(month), JSON.stringify(Array.isArray(rows) ? rows : []));
        } catch (_) {}
    }

    withTimeout(promise, ms) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Leaderboard request timeout')), ms))
        ]);
    }

    renderRows(tbody, rows) {
        tbody.innerHTML = rows.map((item, index) => {
            const points = Number(item.points || 0);
            const value = (points * CONFIG.POINTS_SYSTEM.MULTIPLIER).toFixed(2);
            const rank = Number(item.rank || (index + 1));
            const name = item.name || item.email || 'Kullanici';
            return `<tr><td>${rank}</td><td>${name}</td><td>${points}</td><td>₺${value}</td></tr>`;
        }).join('');
    }

    getFallbackRows() {
        const month = CONFIG.getCurrentMonth();
        const cached = this.readCachedRows(month);
        if (cached.length) {
            return cached;
        }

        if (!window.app || !app.currentUser) {
            return [];
        }

        return [{
            rank: 1,
            name: 'sen (' + (app.currentUser.name || 'kullanici') + ')',
            email: app.currentUser.email,
            points: app.getUserMonthlyPoints()
        }];
    }

    async loadLeaderboard() {
        const tbody = document.getElementById('leaderboardBody');
        if (!tbody) return;

        const fallbackRows = this.getFallbackRows();
        if (fallbackRows.length) {
            this.renderRows(tbody, fallbackRows);
        } else {
            tbody.innerHTML = '<tr><td colspan="4">Puan tablosu yukleniyor...</td></tr>';
        }

        try {
            let rows = [];

            if (window.sheetsAPI && typeof sheetsAPI.getLeaderboard === 'function') {
                rows = await this.withTimeout(
                    sheetsAPI.getLeaderboard(CONFIG.getCurrentMonth()),
                    8000
                );
            }

            if (rows.length) {
                this.writeCachedRows(CONFIG.getCurrentMonth(), rows);
            }

            if (!rows.length && app.currentUser) {
                rows = this.getFallbackRows();
            }

            if (!rows.length) {
                tbody.innerHTML = '<tr><td colspan="4">Bu ay icin puan verisi bulunamadi.</td></tr>';
                return;
            }

            this.renderRows(tbody, rows);
        } catch (error) {
            if (!fallbackRows.length) {
                tbody.innerHTML = '<tr><td colspan="4">Puan tablosu su anda yuklenemiyor.</td></tr>';
            }
            console.warn('Leaderboard could not be loaded:', error);
        }
    }
}

window.leaderboard = new Leaderboard();
