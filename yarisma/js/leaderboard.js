// ===== LEADERBOARD.JS =====

class Leaderboard {
    async loadLeaderboard() {
        const tbody = document.getElementById('leaderboardBody');
        if (!tbody) return;

        const currentName = app.currentUser ? app.currentUser.name : 'Misafir';
        const currentPoints = app.currentUser ? app.getUserMonthlyPoints() : 0;

        const rows = [
            { rank: 1, name: currentName, points: currentPoints },
            { rank: 2, name: 'Ornek Kullanici', points: Math.max(0, currentPoints - 10) }
        ];

        tbody.innerHTML = rows.map((item) => {
            const value = (item.points * CONFIG.POINTS_SYSTEM.MULTIPLIER).toFixed(2);
            return `<tr><td>${item.rank}</td><td>${item.name}</td><td>${item.points}</td><td>₺${value}</td></tr>`;
        }).join('');
    }
}

window.leaderboard = new Leaderboard();
