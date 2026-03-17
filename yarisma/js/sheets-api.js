// ===== SHEETS-API.JS =====

class SheetsAPI {
    constructor() {
        this.baseUrl = CONFIG.ENDPOINTS.APPEND_VALUES;
        this.appsScriptUrl = CONFIG.APPS_SCRIPT_WEBAPP_URL || '';
        this.warned = false;
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
        if (this.appsScriptUrl) {
            return this.appendRowsWithAppsScript(sheetName, values);
        }

        try {
            const range = encodeURIComponent(`${sheetName}!A1`);
            const url = `${this.baseUrl}/${CONFIG.SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS&key=${CONFIG.SHEETS_API_KEY}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ values })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Sheets API ${response.status}: ${errorText}`);
            }

            return true;
        } catch (error) {
            console.warn('Sheets write failed:', error);
            this.notifyWriteFailure();
            return false;
        }
    }

    async appendRowsWithAppsScript(sheetName, values) {
        try {
            const response = await fetch(this.appsScriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'append',
                    sheetName,
                    values
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Apps Script ${response.status}: ${errorText}`);
            }

            return true;
        } catch (error) {
            console.warn('Apps Script write failed:', error);
            this.notifyWriteFailure();
            return false;
        }
    }

    notifyWriteFailure() {
        if (this.warned) return;
        this.warned = true;

        if (window.app && typeof window.app.showNotification === 'function') {
            window.app.showNotification('Google Sheets yazma hatasi: su an veriler sadece bu cihazda saklaniyor.', 'error');
        }
    }

    async getLeaderboard() {
        return [];
    }
}

window.sheetsAPI = new SheetsAPI();
