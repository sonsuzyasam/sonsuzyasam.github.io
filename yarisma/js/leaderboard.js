// ===== LEADERBOARD.JS =====

class Leaderboard {
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
        if (!window.app || !app.currentUser) {
            return [];
        }

        return [{
            rank: 1,
            name: app.currentUser.name,
            email: app.currentUser.email,
            points: app.getUserMonthlyPoints()
        }];
    }

    async loadLeaderboard() {
        const tbody = document.getElementById('leaderboardBody');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="4">Puan tablosu yukleniyor...</td></tr>';

        try {
            let rows = [];

            if (window.sheetsAPI && typeof sheetsAPI.getLeaderboard === 'function') {
                rows = await sheetsAPI.getLeaderboard(CONFIG.getCurrentMonth());
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
            const fallbackRows = this.getFallbackRows();
            if (fallbackRows.length) {
                this.renderRows(tbody, fallbackRows);
            } else {
                tbody.innerHTML = '<tr><td colspan="4">Puan tablosu su anda yuklenemiyor.</td></tr>';
            }
            console.warn('Leaderboard could not be loaded:', error);
        }
    }
}

window.leaderboard = new Leaderboard();
