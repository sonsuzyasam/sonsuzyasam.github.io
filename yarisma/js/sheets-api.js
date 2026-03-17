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

    async saveRewardRequest(email, rewardType, details, points, meta = {}) {
        if (!this.isConfigured()) return;

        const requestId = meta.requestId || `req_${Date.now()}`;
        const createdAt = meta.createdAt || new Date().toISOString();
        const month = meta.month || CONFIG.getCurrentMonth();
        const detailsWithId = `[RID:${requestId}] ${details || ''}`;
        const values = [[createdAt, email || '', 'Bekleme', rewardType || '', points || 0, detailsWithId, month]];
        await this.appendRows(CONFIG.SHEETS.REWARDS, values);
    }

    async getRewardRequestsByEmail(email) {
        if (!this.isConfigured() || !email) return [];

        try {
            const range = encodeURIComponent(`${CONFIG.SHEETS.REWARDS}!A:G`);
            const url = `${CONFIG.ENDPOINTS.GET_VALUES}/${CONFIG.SPREADSHEET_ID}/values/${range}?key=${CONFIG.SHEETS_API_KEY}`;
            const response = await fetch(url);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Sheets read ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            const rows = data.values || [];
            if (rows.length <= 1) return [];

            return rows.slice(1)
                .map((row, index) => this.mapRewardRow(row, index + 2))
                .filter((item) => item.email.toLowerCase() === String(email).toLowerCase())
                .sort((a, b) => String(b.dateISO).localeCompare(String(a.dateISO)));
        } catch (error) {
            console.warn('Reward status read failed:', error);
            return [];
        }
    }

    async getAllRewardRequests() {
        if (!this.isConfigured()) return [];

        try {
            const range = encodeURIComponent(`${CONFIG.SHEETS.REWARDS}!A:G`);
            const url = `${CONFIG.ENDPOINTS.GET_VALUES}/${CONFIG.SPREADSHEET_ID}/values/${range}?key=${CONFIG.SHEETS_API_KEY}`;
            const response = await fetch(url);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Sheets read ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            const rows = data.values || [];
            if (rows.length <= 1) return [];

            return rows.slice(1)
                .map((row, index) => this.mapRewardRow(row, index + 2))
                .sort((a, b) => String(b.dateISO).localeCompare(String(a.dateISO)));
        } catch (error) {
            console.warn('Admin reward queue read failed:', error);
            return [];
        }
    }

    async updateRewardStatus(rowIndex, status) {
        if (!this.appsScriptUrl) {
            throw new Error('Apps Script URL tanimli degil.');
        }

        const payload = {
            action: 'updateRewardStatus',
            rowIndex,
            status
        };

        return this.callAppsScript(payload);
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
        const sheetNameForScript = this.toScriptSheetName(sheetName);

        const payload = {
            action: 'append',
            sheetName: sheetNameForScript,
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

    async callAppsScript(payload) {
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
                data = null;
            }

            if (data && data.ok === false) {
                throw new Error(data.error || 'Apps Script returned an application error.');
            }

            return data || { ok: true };
        } catch (error) {
            throw error;
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

    toScriptSheetName(sheetName) {
        const map = {
            'Kullanıcılar': 'Kullanicilar',
            'Ödüller': 'Oduller',
            'Ödül_Talepleri': 'Odul_Talepleri',
            'Aylık_Puanlar': 'Aylik_Puanlar'
        };

        return map[sheetName] || sheetName;
    }

    mapRewardRow(row, rowIndex) {
        const rawDetails = row[5] || '';
        const ridMatch = rawDetails.match(/\[RID:([^\]]+)\]/i);
        const requestId = ridMatch ? ridMatch[1] : '';
        const cleanDetails = rawDetails.replace(/\[RID:[^\]]+\]\s*/i, '');

        return {
            rowIndex,
            requestId,
            dateISO: row[0] || '',
            email: row[1] || '',
            status: row[2] || 'Bekleme',
            rewardType: row[3] || '',
            points: Number(row[4] || 0),
            details: cleanDetails,
            month: row[6] || ''
        };
    }

    async getLeaderboard() {
        return [];
    }
}

window.sheetsAPI = new SheetsAPI();
