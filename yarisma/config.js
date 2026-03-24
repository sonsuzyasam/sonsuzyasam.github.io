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

    LEGAL: {
        CONSENT_VERSION: '2026-03-19',
        KVKK_NOTICE_URL: './kvkk-aydinlatma.html',
        PRIVACY_TERMS_URL: './gizlilik-ve-kullanim-kosullari.html'
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
        MULTIPLIER: 0.05,
        SAFE_MILESTONES: [
            { correct: 3, points: 3, cashLabel: '15 kurus' },
            { correct: 6, points: 6, cashLabel: '30 kurus' },
            { correct: 10, points: 10, cashLabel: '1 TL' }
        ]
    },

    REWARD_POLICY: {
        MIN_REQUEST_TL: 500,
        MIN_REQUEST_POINTS: 10000
    },

    QUIZ_POLICY: {
        QUESTIONS_PER_GAME: 10,
        DAILY_ATTEMPT_LIMIT: 5,
        ENGAGEMENT_PROMPTS: [
            'Ipuclari icin arkeoloji.biz sekmesini acik tut.',
            'Baraj sorularina gelmeden once arkeoloji.biz iceriklerinde hizli bir tur at.',
            'Sorunun kaynagini inceleyip geri donmek kasani buyutme sansini artirir.'
        ]
    },

    // Sınav Konfigurasyonu
    EXAMS: [
        {
            id: 'arkeoloji',
            name: 'Arkeoloji Biz Quiz',
            description: '10 soruluk, barajli ve odullu arkeoloji yarismasi',
            duration: 12,
            questions: 10,
            difficulty: 'Orta',
            category: 'Odullu Quiz'
        }
    ],

    // Ödül Kategorileri
    REWARD_CATEGORIES: [
        { value: 'gift-card', label: '🎁 Dijital Hediye Kartı' },
        { value: 'subscription', label: '🎬 Streaming Aboneliği' },
        { value: 'donation', label: '❤️ Hayır Kurumuna Bağış' },
        { value: 'book', label: '📚 Kitap / Eğitim Desteği' },
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
            C: 'Telefon_Legacy',
            D: 'ÜyeOluşTarihi',
            E: 'Aktif',
            F: 'KvkkAydinlatmaOnayi',
            G: 'KullanimKosullariOnayi',
            H: 'ConsentVersion',
            I: 'ConsentTs'
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
    SETTINGS: 'sonsuzyasam_settings',
    GUEST_ARCH_ORDER: 'sonsuzyasam_guest_arkeoloji_order',
    LAST_EXAM_ORDER_PREFIX: 'sonsuzyasam_last_exam_order_',
    CONSENT_DRAFT: 'sonsuzyasam_consent_draft'
};

console.log('✅ Config Loaded');
