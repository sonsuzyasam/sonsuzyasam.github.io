// ===== SHEETS-API.JS =====

class SheetsAPI {
    constructor() {
        this.appsScriptUrl = CONFIG.APPS_SCRIPT_WEBAPP_URL || '';
        this.warned = false;
    }

    isConfigured() {
        return Boolean(this.appsScriptUrl);
    }

    async appendUser(user) {
        if (!this.isConfigured()) return;
        await this.callAppsScript({
            action: 'upsertUser',
            user: {
                email: user.email || '',
                name: user.name || '',
                phone: user.phone || '',
                verified: Boolean(user.verified)
            }
        });
    }

    async recordScore(email, points) {
        // Legacy method retained for backward compatibility.
        return this.callAppsScript({
            action: 'recordScore',
            email: email || '',
            points: Number(points || 0),
            month: CONFIG.getCurrentMonth()
        });
    }

    async saveRewardRequest(email, rewardType, details, points, meta = {}) {
        if (!this.isConfigured()) throw new Error('Apps Script URL tanimli degil.');

        return this.callAppsScript({
            action: 'createRewardRequest',
            email: email || '',
            rewardType: rewardType || '',
            details: details || '',
            requestedPoints: Number(points || 0),
            requestId: meta.requestId || `req_${Date.now()}`,
            createdAt: meta.createdAt || new Date().toISOString(),
            month: meta.month || CONFIG.getCurrentMonth()
        });
    }

    async getRewardRequestsByEmail(email) {
        if (!this.isConfigured() || !email) return [];
        const data = await this.callAppsScriptExpectJson({ action: 'listRewardRequests', email });
        return (data.items || []).map((item) => this.mapRewardRowFromObject(item));
    }

    async getAllRewardRequests() {
        if (!this.isConfigured()) return [];
        const data = await this.callAppsScriptExpectJson({ action: 'listRewardRequests' });
        return (data.items || []).map((item) => this.mapRewardRowFromObject(item));
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

    async submitExamResult(examId, answers, meta = {}) {
        if (!this.isConfigured()) {
            throw new Error('Apps Script URL tanimli degil.');
        }

        return this.callAppsScriptExpectJson({
            action: 'submitExamResult',
            examId: examId || '',
            answers: Array.isArray(answers) ? answers : [],
            startedAt: meta.startedAt || '',
            finishedAt: meta.finishedAt || new Date().toISOString(),
            durationSeconds: Number(meta.durationSeconds || 0),
            month: meta.month || CONFIG.getCurrentMonth()
        });
    }

    async getMonthlyPoints(month) {
        if (!this.isConfigured()) return 0;

        const data = await this.callAppsScriptExpectJson({
            action: 'getMonthlyPoints',
            month: month || CONFIG.getCurrentMonth()
        });

        return Number(data.points || 0);
    }

    async callAppsScript(payload) {
        try {
            const enriched = await this.withAuth(payload);
            const response = await fetch(this.appsScriptUrl, {
                method: 'POST',
                // text/plain avoids many browser preflight failures on Apps Script endpoints.
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(enriched)
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
            // Last-resort transport for browsers that still block cross-origin response reads.
            const enriched = await this.withAuth(payload);
            await fetch(this.appsScriptUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(enriched)
            });

            return { ok: true, transport: 'no-cors', note: error.message };
        }
    }

    async callAppsScriptExpectJson(payload) {
        const enriched = await this.withAuth(payload);
        const response = await fetch(this.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(enriched)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Apps Script ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        if (data && data.ok === false) {
            throw new Error(data.error || 'Apps Script action failed.');
        }

        return data || { ok: true };
    }

    async withAuth(payload) {
        const auth = await this.getAuthContext();
        return {
            ...payload,
            auth,
            origin: window.location.origin,
            clientTs: new Date().toISOString()
        };
    }

    async getAuthContext() {
        if (window.authManager && typeof window.authManager.getAuthContext === 'function') {
            return window.authManager.getAuthContext();
        }

        const current = window.firebase && firebase.auth && firebase.auth().currentUser;
        if (!current) {
            return { uid: '', email: '', idToken: '' };
        }

        const idToken = await current.getIdToken(false);
        return {
            uid: current.uid,
            email: current.email || '',
            idToken
        };
    }

    notifyWriteFailure(details) {
        if (this.warned) return;
        this.warned = true;

        if (window.app && typeof window.app.showNotification === 'function') {
            const extra = details ? ` (${details})` : '';
            window.app.showNotification(`Google Sheets yazma hatasi: su an veriler sadece bu cihazda saklaniyor.${extra}`, 'error');
        }
    }

    mapRewardRowFromObject(item) {
        const rawDetails = item.rawDetails || item.details || '';
        const ridMatch = rawDetails.match(/\[RID:([^\]]+)\]/i);
        const requestId = item.requestId || (ridMatch ? ridMatch[1] : '');
        const cleanDetails = item.details || rawDetails.replace(/\[RID:[^\]]+\]\s*/i, '');

        return {
            rowIndex: Number(item.rowIndex || 0),
            requestId,
            dateISO: item.dateISO || '',
            email: item.email || '',
            status: item.status || 'Bekleme',
            rewardType: item.rewardType || '',
            points: Number(item.points || 0),
            details: cleanDetails,
            month: item.month || ''
        };
    }

    async getLeaderboard() {
        return [];
    }
}

window.sheetsAPI = new SheetsAPI();
