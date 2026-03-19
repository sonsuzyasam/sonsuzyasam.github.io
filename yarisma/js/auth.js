// ===== AUTH.JS - Firebase Email/Password Auth =====

class AuthManager {
    constructor() {
        this.auth = null;
        this.mode = 'login';
        this.pendingAuthUser = undefined;
        this.init();
    }

    init() {
        if (!window.firebase || !CONFIG.FIREBASE || CONFIG.FIREBASE.apiKey === 'YOUR_FIREBASE_API_KEY') {
            console.warn('Firebase config missing. Auth disabled until configured.');
            return;
        }

        firebase.initializeApp(CONFIG.FIREBASE);
        this.auth = firebase.auth();

        this.setupUi();
        this.bindEvents();
        this.watchAuthState();
    }

    setupUi() {
        this.form = document.getElementById('loginForm');
        this.title = document.getElementById('authTitle');
        this.hint = document.getElementById('authHint');
        this.submitBtn = document.getElementById('authSubmitBtn');
        this.toggleBtn = document.getElementById('toggleAuthModeBtn');
        this.resendBtn = document.getElementById('resendVerificationBtn');
        this.googleBtn = document.getElementById('googleSignInBtn');
        this.nameInput = document.getElementById('loginName');
        this.emailInput = document.getElementById('loginEmail');
        this.passwordInput = document.getElementById('loginPassword');
        this.passwordConfirmInput = document.getElementById('loginPasswordConfirm');
        this.kvkkConsentInput = document.getElementById('kvkkConsent');
        this.termsConsentInput = document.getElementById('termsConsent');
        this.consentGroup = document.getElementById('legalConsentGroup');

        this.applyMode();
    }

    bindEvents() {
        if (!this.form) return;

        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (this.mode === 'login') {
                await this.login();
                return;
            }
            await this.register();
        });

        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => {
                this.mode = this.mode === 'login' ? 'register' : 'login';
                this.applyMode();
            });
        }

        if (this.resendBtn) {
            this.resendBtn.addEventListener('click', async () => {
                await this.resendVerificationEmail();
            });
        }

        if (this.googleBtn) {
            this.googleBtn.addEventListener('click', async () => {
                await this.signInWithGoogle();
            });
        }
    }

    applyMode() {
        const isRegister = this.mode === 'register';
        this.title.textContent = isRegister ? 'Hesap Olustur' : 'Giris Yap';
        this.hint.textContent = isRegister
            ? 'Kayittan sonra dogrulama e-postasi gonderilir.'
            : 'Giris icin e-posta ve parola girin.';
        this.submitBtn.textContent = isRegister ? 'Kayit Ol' : 'Giris Yap';
        this.toggleBtn.textContent = isRegister ? 'Zaten Hesabim Var' : 'Yeni Hesap Olustur';

        this.nameInput.required = isRegister;
        this.passwordConfirmInput.required = isRegister;
        if (this.kvkkConsentInput) this.kvkkConsentInput.required = isRegister;
        if (this.termsConsentInput) this.termsConsentInput.required = isRegister;
        this.passwordConfirmInput.style.display = isRegister ? 'block' : 'none';
        this.nameInput.style.display = isRegister ? 'block' : 'none';
        if (this.consentGroup) this.consentGroup.style.display = isRegister ? 'block' : 'none';
        if (this.resendBtn) this.resendBtn.style.display = isRegister ? 'none' : 'inline-block';
        if (this.googleBtn) this.googleBtn.style.display = 'none';
    }

    async signInWithGoogle() {
        this.notify('Google ile giris gecici olarak kapatildi. Lutfen e-posta ve parola ile kayit olun.', 'info');
    }

    async register() {
        const name = this.nameInput.value.trim();
        const email = this.emailInput.value.trim();
        const password = this.passwordInput.value;
        const passwordConfirm = this.passwordConfirmInput.value;
        const kvkkApproved = Boolean(this.kvkkConsentInput && this.kvkkConsentInput.checked);
        const termsApproved = Boolean(this.termsConsentInput && this.termsConsentInput.checked);

        if (password !== passwordConfirm) {
            this.notify('Parola tekrar alani eslesmiyor.', 'error');
            return;
        }

        if (!kvkkApproved || !termsApproved) {
            this.notify('Kayit icin KVKK aydinlatma metni ve kullanim kosullarini onaylaman gerekiyor.', 'error');
            return;
        }

        try {
            const approvedAt = new Date().toISOString();
            const cred = await this.auth.createUserWithEmailAndPassword(email, password);
            await cred.user.updateProfile({ displayName: name });
            await cred.user.sendEmailVerification();

            if (window.sheetsAPI && typeof window.sheetsAPI.appendUser === 'function') {
                await sheetsAPI.appendUser({
                    email,
                    name,
                    verified: cred.user.emailVerified,
                    consents: {
                        kvkkNoticeApproved: true,
                        termsAccepted: true,
                        version: CONFIG.LEGAL.CONSENT_VERSION,
                        approvedAt
                    }
                });
            }

            await this.auth.signOut();
            this.mode = 'login';
            this.applyMode();
            this.form.reset();
            this.notify('Kayit tamamlandi. E-postani dogrulayip giris yap.', 'success');
        } catch (err) {
            this.notify(this.mapAuthError(err), 'error');
        }
    }

    async login() {
        const email = this.emailInput.value.trim();
        const password = this.passwordInput.value;

        try {
            const cred = await this.auth.signInWithEmailAndPassword(email, password);

            if (CONFIG.AUTH.REQUIRE_EMAIL_VERIFICATION && !cred.user.emailVerified) {
                await this.auth.signOut();
                this.notify('E-posta dogrulamasi olmadan giris yapamazsin.', 'error');
                return;
            }

            this.notify('Giris basarili.', 'success');
            this.closeLoginModal();
        } catch (err) {
            this.notify(this.mapAuthError(err), 'error');
        }
    }

    async resendVerificationEmail() {
        const email = this.emailInput.value.trim();
        const password = this.passwordInput.value;

        if (!email || !password) {
            this.notify('E-posta ve parola girin, sonra tekrar deneyin.', 'error');
            return;
        }

        try {
            const cred = await this.auth.signInWithEmailAndPassword(email, password);
            await cred.user.sendEmailVerification();
            await this.auth.signOut();
            this.notify('Dogrulama e-postasi tekrar gonderildi.', 'success');
        } catch (err) {
            this.notify(this.mapAuthError(err), 'error');
        }
    }

    watchAuthState() {
        this.auth.onAuthStateChanged((user) => {
            if (!user) {
                this.dispatchAuthUser(null);
                return;
            }

            this.dispatchAuthUser({
                uid: user.uid,
                name: user.displayName || 'Kullanici',
                email: user.email,
                verified: user.emailVerified
            });
        });
    }

    attachApp(appInstance) {
        if (!appInstance || typeof appInstance.onAuthUser !== 'function') return;
        if (this.pendingAuthUser !== undefined) {
            appInstance.onAuthUser(this.pendingAuthUser);
            this.pendingAuthUser = undefined;
        }
    }

    dispatchAuthUser(userData) {
        if (window.app && typeof window.app.onAuthUser === 'function') {
            window.app.onAuthUser(userData);
            return;
        }
        this.pendingAuthUser = userData;
    }

    closeLoginModal() {
        const modal = document.getElementById('loginModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    async logout() {
        if (!this.auth) return;
        await this.auth.signOut();
    }

    async getAuthContext(forceRefresh = false) {
        if (!this.auth || !this.auth.currentUser) {
            return { uid: '', email: '', idToken: '' };
        }

        const u = this.auth.currentUser;
        const idToken = await u.getIdToken(Boolean(forceRefresh));
        return {
            uid: u.uid,
            email: u.email || '',
            idToken
        };
    }

    notify(message, type) {
        if (window.app && typeof window.app.showNotification === 'function') {
            window.app.showNotification(message, type);
        }
    }

    mapAuthError(err) {
        const code = err && err.code ? err.code : '';
        if (code === 'auth/email-already-in-use') return 'Bu e-posta zaten kayitli.';
        if (code === 'auth/invalid-email') return 'Gecersiz e-posta adresi.';
        if (code === 'auth/weak-password') return 'Parola en az 6 karakter olmalidir.';
        if (code === 'auth/user-not-found') return 'Bu e-posta ile hesap bulunamadi.';
        if (code === 'auth/wrong-password') return 'Parola hatali.';
        if (code === 'auth/too-many-requests') return 'Cok fazla deneme yapildi. Daha sonra tekrar deneyin.';
        if (code === 'auth/popup-closed-by-user') return 'Google giris penceresi kapatildi.';
        if (code === 'auth/popup-blocked') return 'Tarayici popup engelledi. Izin verip tekrar dene.';
        if (code === 'auth/account-exists-with-different-credential') return 'Bu e-posta farkli bir yontem ile kayitli.';
        return 'Islem tamamlanamadi. Lutfen tekrar deneyin.';
    }
}

window.authManager = new AuthManager();
