// ===== AUTH.JS - Firebase Email/Password Auth =====

class AuthManager {
    constructor() {
        this.auth = null;
        this.mode = 'login';
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
        this.phoneInput = document.getElementById('loginPhone');
        this.passwordInput = document.getElementById('loginPassword');
        this.passwordConfirmInput = document.getElementById('loginPasswordConfirm');

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

        this.toggleBtn.addEventListener('click', () => {
            this.mode = this.mode === 'login' ? 'register' : 'login';
            this.applyMode();
        });

        this.resendBtn.addEventListener('click', async () => {
            await this.resendVerificationEmail();
        });

        this.googleBtn.addEventListener('click', async () => {
            await this.signInWithGoogle();
        });
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
        this.phoneInput.required = isRegister;
        this.passwordConfirmInput.required = isRegister;
        this.passwordConfirmInput.style.display = isRegister ? 'block' : 'none';
        this.nameInput.style.display = isRegister ? 'block' : 'none';
        this.phoneInput.style.display = isRegister ? 'block' : 'none';
        this.resendBtn.style.display = isRegister ? 'none' : 'inline-block';
    }

    async signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            const cred = await this.auth.signInWithPopup(provider);

            if (cred && cred.additionalUserInfo && cred.additionalUserInfo.isNewUser) {
                this.savePhoneByUid(cred.user.uid, '-');
            }

            this.notify('Google ile giris basarili.', 'success');
            if (window.app) {
                window.app.closeModal('loginModal');
            }
        } catch (err) {
            this.notify(this.mapAuthError(err), 'error');
        }
    }

    async register() {
        const name = this.nameInput.value.trim();
        const email = this.emailInput.value.trim();
        const phone = this.phoneInput.value.trim();
        const password = this.passwordInput.value;
        const passwordConfirm = this.passwordConfirmInput.value;

        if (password !== passwordConfirm) {
            this.notify('Parola tekrar alani eslesmiyor.', 'error');
            return;
        }

        try {
            const cred = await this.auth.createUserWithEmailAndPassword(email, password);
            await cred.user.updateProfile({ displayName: name });
            await cred.user.sendEmailVerification();
            this.savePhoneByUid(cred.user.uid, phone);

            await this.auth.signOut();
            this.mode = 'login';
            this.applyMode();
            this.notify('Kayit tamamlandi. E-postani dogrulayıp giris yap.', 'success');
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
            if (window.app) {
                window.app.closeModal('loginModal');
            }
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
            if (!window.app) return;

            if (!user) {
                window.app.onAuthUser(null);
                return;
            }

            const phone = this.getPhoneByUid(user.uid);
            window.app.onAuthUser({
                uid: user.uid,
                name: user.displayName || 'Kullanici',
                email: user.email,
                phone: phone,
                verified: user.emailVerified
            });
        });
    }

    async logout() {
        if (!this.auth) return;
        await this.auth.signOut();
    }

    notify(message, type) {
        if (window.app && typeof window.app.showNotification === 'function') {
            window.app.showNotification(message, type);
        }
    }

    savePhoneByUid(uid, phone) {
        const key = 'sonsuzyasam_phone_map';
        const map = JSON.parse(localStorage.getItem(key) || '{}');
        map[uid] = phone;
        localStorage.setItem(key, JSON.stringify(map));
    }

    getPhoneByUid(uid) {
        const key = 'sonsuzyasam_phone_map';
        const map = JSON.parse(localStorage.getItem(key) || '{}');
        return map[uid] || '-';
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
