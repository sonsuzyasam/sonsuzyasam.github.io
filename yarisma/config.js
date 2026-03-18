// ===== CONFIG.JS - Google Sheets Integration =====
// Bu dosyayı Google Cloud Console'dan aldığınız bilgilerle güncelleyin

const CONFIG = {
    // Firebase Authentication Ayarlari
    FIREBASE: {
        apiKey: 'AIzaSyA_IijFTARQUObeu63BpM9QPGINUHjtJl8',
        authDomain: 'yarisma-edd25.firebaseapp.com',
        projectId: 'yarisma-edd25',
        appId: '1:988825882554:web:9e4f9ce4105c0dbe5bd783'
    },

    AUTH: {
        REQUIRE_EMAIL_VERIFICATION: true
    },

    ADMIN_EMAILS: [
        'sdoldur@gmail.com'
    ],

    // Google Sheets yazma icin onerilen yontem (Apps Script Web App)
    APPS_SCRIPT_WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbx6h2zr-VtskdLNGyJLSIDoZIyyDP0UNZxK9Ng7OnM-sc2gmmPRjk0DozZCDuwayyYm/exec',

    // Google Sheets API Ayarları
    // Keep empty in production. Client should not call Sheets API directly.
    SHEETS_API_KEY: '',
    SPREADSHEET_ID: '1_rCYk3xfD03qjR1BFfZ7rC94UHvTuPdvJB2pGj6796M',

    SECURITY: {
        ENFORCE_SERVER_SIDE_SCORING: true,
        ENFORCE_SERVER_SIDE_ADMIN_CHECK: true
    },
    
    // Sheet İsimleri
    SHEETS: {
        USERS: 'Kullanıcılar',
        SCORES: 'Puanlar',
        REWARDS: 'Ödüller',
        REQUESTS: 'Ödül_Talepleri',
        MONTHLY_POINTS: 'Aylık_Puanlar'
    },

    // Puan Sistemi
    POINTS_SYSTEM: {
        MULTIPLIER: 0.10, // 1 puan = 0.10 TL (10 kuruş)
        PASS_SCORE: 45, // Baraj puanı (ÖSYM standardı)
    },

    // Sınav Konfigurasyonu
    EXAMS: [
        {
            id: 'tyt',
            name: 'TYT',
            description: 'Türkçe-Matematik',
            duration: 180, // dakika
            questions: 120,
            difficulty: 'Orta',
            category: 'YKS'
        },
        {
            id: 'ayt',
            name: 'AYT',
            description: 'Seçmeli Dersler',
            duration: 180,
            questions: 120,
            difficulty: 'Zor',
            category: 'YKS'
        },
        {
            id: 'kpss',
            name: 'KPSS',
            description: 'Kamu Personel Seçim Sınavı',
            duration: 180,
            questions: 120,
            difficulty: 'Orta',
            category: 'Memur'
        },
        {
            id: 'english',
            name: 'İngilizce',
            description: 'İngilizce Dil Yeterliği',
            duration: 120,
            questions: 80,
            difficulty: 'Orta',
            category: 'Yabancı Dil'
        },
        {
            id: 'arkeoloji',
            name: 'Arkeoloji',
            description: 'Arkeoloji Bilimi & Antik Dünya',
            duration: 30,
            questions: 6,
            difficulty: 'Orta',
            category: 'Kültür'
        }
    ],

    // Ödül Kategorileri
    REWARD_CATEGORIES: [
        { value: 'phone-bill', label: '📱 Telefon Faturası Ödeme' },
        { value: 'internet', label: '🌐 İnternet Paketi' },
        { value: 'subscription', label: '🎬 Streaming Aboneliği' },
        { value: 'donation', label: '❤️ Hayır Kurumuna Bağış' },
        { value: 'custom', label: '✨ Diğer (Özel)' }
    ],

    // API Endpoint'leri
    ENDPOINTS: {
        APPEND_VALUES: 'https://sheets.googleapis.com/v4/spreadsheets',
        GET_VALUES: 'https://sheets.googleapis.com/v4/spreadsheets',
        BATCH_UPDATE: 'https://sheets.googleapis.com/v4/spreadsheets'
    },

    // Ay ve Yıl (Ödül hesaplama için)
    getCurrentMonth: function() {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    },

    // Sheet Column Mapping
    COLUMNS: {
        USERS: {
            A: 'Email',
            B: 'Ad',
            C: 'Telefon',
            D: 'ÜyeOluşTarihi',
            E: 'Aktif'
        },
        SCORES: {
            A: 'Tarih',
            B: 'Email',
            C: 'SınävID',
            D: 'Puan',
            E: 'SoruSayısı',
            F: 'DoğrularSayısı'
        },
        REWARDS: {
            A: 'Tarih',
            B: 'Email',
            C: 'TalepDurumu', // 'Bekleme', 'Onaylı', 'Reddedildi'
            D: 'ÖdülTürü',
            E: 'Puan',
            F: 'Detaylar',
            G: 'Ay'
        }
    }
};

// Local Storage Keys
const STORAGE_KEYS = {
    USER: 'sonsuzyasam_user',
    USER_POINTS: 'sonsuzyasam_points',
    EXAM_STATE: 'sonsuzyasam_exam_state',
    SETTINGS: 'sonsuzyasam_settings'
};

console.log('✅ Config Loaded');
