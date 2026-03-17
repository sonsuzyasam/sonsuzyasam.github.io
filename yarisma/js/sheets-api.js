// ===== SHEETS-API.JS =====

class SheetsAPI {
    constructor() {
        this.baseUrl = CONFIG.ENDPOINTS.APPEND_VALUES;
    }

    isConfigured() {
        return Boolean(CONFIG.SHEETS_API_KEY && CONFIG.SPREADSHEET_ID && CONFIG.SHEETS_API_KEY !== 'YOUR_API_KEY_HERE' && CONFIG.SPREADSHEET_ID !== 'YOUR_SPREADSHEET_ID_HERE');
    }

    async appendUser(user) {
        if (!this.isConfigured()) return;
        const values = [[user.email || '', user.name || '', user.phone || '', new Date().toISOString(), 'true']];
        await this.appendRows(CONFIG.SHEETS.USERS, values);
    }

    async recordScore(email, points) {
        if (!this.isConfigured()) return;
        const values = [[new Date().toISOString(), email || '', 'monthly', points, '', '']];
        await this.appendRows(CONFIG.SHEETS.SCORES, values);
    }

    async saveRewardRequest(email, rewardType, details, points) {
        if (!this.isConfigured()) return;
        const values = [[new Date().toISOString(), email || '', 'Bekleme', rewardType || '', points || 0, details || '', CONFIG.getCurrentMonth()]];
        await this.appendRows(CONFIG.SHEETS.REWARDS, values);
    }

    async appendRows(sheetName, values) {
        try {
            const range = encodeURIComponent(`${sheetName}!A1`);
            const url = `${this.baseUrl}/${CONFIG.SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS&key=${CONFIG.SHEETS_API_KEY}`;
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ values })
            });
        } catch (error) {
            console.warn('Sheets write failed:', error);
        }
    }

    async getLeaderboard() {
        return [];
    }
}

window.sheetsAPI = new SheetsAPI();
