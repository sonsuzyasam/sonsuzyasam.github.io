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
        const payload = {
            action: 'append',
            sheetName,
            values
        };

        try {
            const response = await fetch(this.appsScriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Apps Script ${response.status}: ${errorText}`);
            }

            let data = null;
            try {
                data = await response.json();
            } catch (_) {
                // Some deployments may return non-JSON output.
            }

            if (data && data.ok === false) {
                throw new Error(data.error || 'Apps Script returned an application error.');
            }

            return true;
        } catch (error) {
            // Some browsers block CORS on Apps Script even when request is valid.
            // Retry with no-cors so the request can still be delivered.
            try {
                await fetch(this.appsScriptUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload)
                });

                if (window.app && typeof window.app.showNotification === 'function') {
                    window.app.showNotification('Veri gonderildi. Sheets satiri 2-5 sn gecikmeli gorunebilir.', 'info');
                }

                return true;
            } catch (fallbackError) {
                console.warn('Apps Script write failed:', error);
                console.warn('Apps Script no-cors fallback failed:', fallbackError);
                this.notifyWriteFailure(error.message);
                return false;
            }
        }
    }

    notifyWriteFailure(details) {
        if (this.warned) return;
        this.warned = true;

        if (window.app && typeof window.app.showNotification === 'function') {
            const extra = details ? ` (${details})` : '';
            window.app.showNotification(`Google Sheets yazma hatasi: su an veriler sadece bu cihazda saklaniyor.${extra}`, 'error');
        }
    }

    async getLeaderboard() {
        return [];
    }
}

window.sheetsAPI = new SheetsAPI();
