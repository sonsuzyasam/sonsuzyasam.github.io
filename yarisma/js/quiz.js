// ===== QUIZ.JS =====

class Quiz {
    constructor() {
        this.currentExam = null;
        this.questions = [];
        this.currentIndex = 0;
        this.answers = {};
        this.timeLeft = 0;
        this.timerId = null;
        this.sessionStartedAt = null;
        this.announcedMilestones = {};
        this.streakBreakPrompted = false;
        this.isSubmitting = false;
        this.isAnswerLocked = false;
        this.startCooldownUntil = 0;
    }

    getMilestones() {
        return Array.isArray(CONFIG.POINTS_SYSTEM.SAFE_MILESTONES)
            ? CONFIG.POINTS_SYSTEM.SAFE_MILESTONES
            : [];
    }

    getSafeMilestone(correctStreak) {
        let safe = { correct: 0, points: 0, cashLabel: '0 TL' };
        this.getMilestones().forEach((milestone) => {
            if (correctStreak >= Number(milestone.correct || 0)) {
                safe = milestone;
            }
        });
        return safe;
    }

    getNextMilestone(correctStreak) {
        return this.getMilestones().find((milestone) => Number(milestone.correct || 0) > correctStreak) || null;
    }

    buildMilestoneLadder(activeCorrect = 0) {
        return this.getMilestones().map((milestone) => {
            const passed = activeCorrect >= Number(milestone.correct || 0);
            return `
                <div class="milestone-item ${passed ? 'passed' : ''}">
                    <strong>${milestone.correct}. soru</strong>
                    <span>${milestone.cashLabel}</span>
                </div>
            `;
        }).join('');
    }

    getSourceDestination(question) {
        const rawUrl = String(question && question.sourceUrl || '').trim();
        if (rawUrl && rawUrl !== 'https://www.arkeoloji.biz/' && rawUrl !== 'https://arkeoloji.biz/') {
            return rawUrl;
        }

        const query = encodeURIComponent(String(question.sourceTitle || question.topic || question.text || 'arkeoloji').trim());
        return `https://www.arkeoloji.biz/search?q=${query}`;
    }

    getSourceLabel(question) {
        const rawUrl = String(question && question.sourceUrl || '').trim();
        if (rawUrl && rawUrl !== 'https://www.arkeoloji.biz/' && rawUrl !== 'https://arkeoloji.biz/') {
            return this.toDisplayText(question.sourceTitle || 'İlgili kaynağa git');
        }
        return this.toDisplayText(`Arkeoloji.biz'de ara: ${question.topic || question.sourceTitle || 'Ilgili konu'}`);
    }

    toDisplayText(value) {
        const raw = String(value || '');
        if (!this.currentExam || this.currentExam.id !== 'arkeoloji') {
            return raw;
        }
        return this.restoreTurkishText(raw);
    }

    restoreTurkishText(text) {
        if (!text) return '';

        let out = String(text);
        const dictionary = {
            'asagidakilerden': 'aşağıdakilerden',
            'asagidaki': 'aşağıdaki',
            'asagi': 'aşağı',
            'Asagidakilerden': 'Aşağıdakilerden',
            'Asagidaki': 'Aşağıdaki',
            'Asagi': 'Aşağı',
            'cag': 'çağ',
            'Cag': 'Çağ',
            'cagi': 'çağı',
            'Cagi': 'Çağı',
            'donem': 'dönem',
            'Donem': 'Dönem',
            'donemi': 'dönemi',
            'Donemi': 'Dönemi',
            'donemde': 'dönemde',
            'Donemde': 'Dönemde',
            'yontem': 'yöntem',
            'Yontem': 'Yöntem',
            'yontemi': 'yöntemi',
            'Yontemi': 'Yöntemi',
            'yontemleri': 'yöntemleri',
            'Yontemleri': 'Yöntemleri',
            'yerlesik': 'yerleşik',
            'Yerlesik': 'Yerleşik',
            'yerlesim': 'yerleşim',
            'Yerlesim': 'Yerleşim',
            'yerlesimi': 'yerleşimi',
            'Yerlesimi': 'Yerleşimi',
            'kullanim': 'kullanım',
            'Kullanim': 'Kullanım',
            'kullanilan': 'kullanılan',
            'Kullanilan': 'Kullanılan',
            'kullanilir': 'kullanılır',
            'Kullanilir': 'Kullanılır',
            'kultur': 'kültür',
            'Kultur': 'Kültür',
            'olcum': 'ölçüm',
            'Olcum': 'Ölçüm',
            'olcu': 'ölçü',
            'Olcu': 'Ölçü',
            'baglam': 'bağlam',
            'Baglam': 'Bağlam',
            'cik': 'çık',
            'Cik': 'Çık',
            'cikis': 'çıkış',
            'Cikis': 'Çıkış',
            'giris': 'giriş',
            'Giris': 'Giriş',
            'saglar': 'sağlar',
            'Saglar': 'Sağlar',
            'degisim': 'değişim',
            'Degisim': 'Değişim',
            'ogesi': 'ögesi',
            'Ogesi': 'Ögesi',
            'ozellik': 'özellik',
            'Ozellik': 'Özellik',
            'ozelligi': 'özelliği',
            'Ozelligi': 'Özelliği',
            'ozel': 'özel',
            'Ozel': 'Özel',
            'ogren': 'öğren',
            'Ogren': 'Öğren',
            'soru': 'soru',
            'Sinav': 'Sınav',
            'sinav': 'sınav',
            'yanlis': 'yanlış',
            'Yanlis': 'Yanlış',
            'dogru': 'doğru',
            'Dogru': 'Doğru',
            'yazi': 'yazı',
            'Yazi': 'Yazı',
            'yazit': 'yazıt',
            'Yazit': 'Yazıt',
            'agirlik': 'ağırlık',
            'Agirlik': 'Ağırlık',
            'cografi': 'coğrafi',
            'Cografi': 'Coğrafi',
            'ticari': 'ticari',
            'yuksek': 'yüksek',
            'Yuksek': 'Yüksek',
            'kuzey-guney': 'kuzey-güney',
            'dogu-bati': 'doğu-batı',
            'gore': 'göre',
            'Gore': 'Göre',
            'uzerinden': 'üzerinden',
            'Uzerinden': 'Üzerinden',
            'uzeri': 'üzeri',
            'Uzeri': 'Üzeri',
            'guney': 'güney',
            'Guney': 'Güney',
            'dunya': 'dünya',
            'Dunya': 'Dünya',
            'surec': 'süreç',
            'Surec': 'Süreç',
            'olusturur': 'oluşturur',
            'Olusturur': 'Oluşturur',
            'olusturan': 'oluşturan',
            'Olusturan': 'Oluşturan',
            'ust': 'üst',
            'Ust': 'Üst'
        };

        Object.keys(dictionary).forEach((key) => {
            out = out.replace(new RegExp(`\\b${key}\\b`, 'g'), dictionary[key]);
        });

        return out
            .replace(/\bcivi\b/g, 'çivi')
            .replace(/\bCivi\b/g, 'Çivi')
            .replace(/\bucgen\b/g, 'üçgen')
            .replace(/\bucgensel\b/g, 'üçgensel')
            .replace(/\bUcgen\b/g, 'Üçgen')
            .replace(/\bkiyi\b/g, 'kıyı')
            .replace(/\bKiyi\b/g, 'Kıyı')
            .replace(/\bicerik\b/g, 'içerik')
            .replace(/\bIcerik\b/g, 'İçerik')
            .replace(/\bicerigine\b/g, 'içeriğine')
            .replace(/\bozdeslesir\b/g, 'özdeşleşir')
            .replace(/\bozdeslesmis\b/g, 'özdeşleşmiş')
            .replace(/\bcogunlukla\b/g, 'çoğunlukla')
            .replace(/\bcok\b/g, 'çok')
            .replace(/\bCok\b/g, 'Çok')
            .replace(/\bhangi\b/g, 'hangi');
    }

    getArkeolojiFunFact(questionNumber) {
        const facts = [
            'İlginç bilgi: Göbeklitepe, Stonehenge\'den binlerce yıl daha eskidir.',
            'İlginç bilgi: Roma betonunun deniz suyuyla dayanıklılığı zamanla artabiliyor.',
            'İlginç bilgi: Çatalhöyük\'te sokak yerine damdan girişli evler öne çıkar.',
            'İlginç bilgi: Hattuşa tablet arşivi, Hitit diplomasisini okumamızı sağlar.',
            'İlginç bilgi: Amphora kulpları, taşıma kadar mühürleme ve kimliklendirmede de işlevliydi.',
            'İlginç bilgi: Bir mozaikteki tessera boyutu, atölye tekniğine dair ipucu verebilir.',
            'İlginç bilgi: Stratigrafide en küçük karışma, tarihleme yorumunu tamamen değiştirebilir.',
            'İlginç bilgi: Arkeobotanik, kömürleşmiş tohumlardan antik mutfağı yeniden kurabilir.',
            'İlginç bilgi: Deneysel arkeoloji, eski teknikleri birebir deneyerek bilgi üretir.',
            'İlginç bilgi: Bir sikkedeki darp izi, ekonomik kriz dönemlerini bile ele verebilir.'
        ];

        const index = Math.max(0, (Number(questionNumber) || 1) - 1) % facts.length;
        return this.toDisplayText(facts[index]);
    }

    decorateOptionText(question, optionText, optionIndex) {
        const base = this.toDisplayText(optionText);
        if (!this.currentExam || this.currentExam.id !== 'arkeoloji') return base;
        if (!question || Number(optionIndex) === Number(question.correctIndex)) return base;

        const key = `${question.id || this.currentIndex}-${optionIndex}`;
        const twists = [
            ' (ama bu biraz Indiana Jones etkisi olabilir)',
            ' (güzel tahmin ama kazı defteri ikna olmadı)',
            ' (kulağa havalı geliyor, arkeoloji biraz nazlı davranıyor)',
            ' (yaklaştın, fakat stratigrafi kaşlarını kaldırdı)'
        ];
        const useTwist = (this.hashString(key) % 5) === 0;
        return useTwist ? `${base}${twists[this.hashString(`${key}:twist`) % twists.length]}` : base;
    }

    setExamInteractionDisabled(disabled) {
        ['answerQuestionBtn', 'finishExamBtn', 'nextQuestionBtn', 'prevQuestionBtn'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.disabled = Boolean(disabled);
        });
    }

    getSearchUrlByText(raw, fallbackQuestion) {
        const queryText = String(raw || '').trim();
        if (queryText) {
            return `https://www.arkeoloji.biz/search?q=${encodeURIComponent(queryText)}`;
        }
        const question = fallbackQuestion || {};
        const query = encodeURIComponent(String(question.sourceTitle || question.topic || question.text || 'arkeoloji').trim());
        return `https://www.arkeoloji.biz/search?q=${query}`;
    }

    getContiguousStreak(maxIndex) {
        const limit = Math.min(Number(maxIndex), this.questions.length - 1);
        if (limit < 0) return 0;

        let streak = 0;
        for (let i = 0; i <= limit; i += 1) {
            const answer = this.answers[i];
            if (answer === undefined) break;
            const q = this.questions[i];
            if (!q) break;
            if (Number(answer) === Number(q.correctIndex) && streak === i) {
                streak += 1;
            } else {
                break;
            }
        }

        return streak;
    }

    getLastOrderKey(examId) {
        return `${STORAGE_KEYS.LAST_EXAM_ORDER_PREFIX}${examId}`;
    }

    getDailyAttemptPlanKey(examId) {
        return `${this.getLastOrderKey(examId)}:daily-plan:${this.getCurrentDayKey()}`;
    }

    getDailyPlanSignatureKey(examId) {
        return `${this.getLastOrderKey(examId)}:daily-signature:${this.getCurrentDayKey()}`;
    }

    getCurrentDayKey() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    hashString(input) {
        let hash = 0;
        const text = String(input || '');
        for (let i = 0; i < text.length; i += 1) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    seededShuffle(list, seedText) {
        let seed = this.hashString(seedText) || 1;
        const nextRandom = () => {
            seed = (seed * 1664525 + 1013904223) % 4294967296;
            return seed / 4294967296;
        };

        const clone = [...list];
        for (let i = clone.length - 1; i > 0; i -= 1) {
            const j = Math.floor(nextRandom() * (i + 1));
            [clone[i], clone[j]] = [clone[j], clone[i]];
        }
        return clone;
    }

    getPlannedAttemptIndex() {
        const used = Number(window.app && app.dailyQuota ? app.dailyQuota.used || 0 : 0);
        return Math.max(0, used);
    }

    getQuestionSetWithVariedOrder(examId, bank, requiredQuestions) {
        const neededForDailyUniqueRuns = requiredQuestions * Number(CONFIG.QUIZ_POLICY.DAILY_ATTEMPT_LIMIT || 5);
        if (bank.length >= neededForDailyUniqueRuns) {
            const attemptIndex = this.getPlannedAttemptIndex();
            const key = this.getDailyAttemptPlanKey(examId);
            const signatureKey = this.getDailyPlanSignatureKey(examId);
            const seed = `${examId}:${this.getCurrentDayKey()}`;
            const bankSignature = bank.map((item) => String(item.id || '')).join('|');
            const storedSignature = localStorage.getItem(signatureKey) || '';
            let plannedIds = [];

            try {
                plannedIds = JSON.parse(localStorage.getItem(key) || '[]');
            } catch (_) {
                plannedIds = [];
            }

            if (storedSignature !== bankSignature) {
                plannedIds = [];
            }

            if (!Array.isArray(plannedIds) || !plannedIds.length) {
                const shuffled = this.seededShuffle(bank, seed);
                plannedIds = shuffled.map((item) => item.id || '');
                localStorage.setItem(key, JSON.stringify(plannedIds));
                localStorage.setItem(signatureKey, bankSignature);
            }

            const orderedBank = plannedIds
                .map((id) => bank.find((item) => String(item.id) === String(id)))
                .filter(Boolean);
            const sliceStart = attemptIndex * requiredQuestions;
            const sliceEnd = sliceStart + requiredQuestions;
            const sliced = orderedBank.slice(sliceStart, sliceEnd);
            if (sliced.length === requiredQuestions) {
                return sliced;
            }
        }

        const key = this.getLastOrderKey(examId);
        const lastOrder = localStorage.getItem(key) || '';
        let selected = [];
        let nextOrder = '';

        for (let attempt = 0; attempt < 6; attempt += 1) {
            const candidate = this.shuffle([...bank]).slice(0, requiredQuestions);
            const candidateOrder = candidate.map((item) => item.id || '').join('|');
            selected = candidate;
            nextOrder = candidateOrder;
            if (candidateOrder !== lastOrder) {
                break;
            }
        }

        if (nextOrder) {
            localStorage.setItem(key, nextOrder);
        }

        return selected;
    }

    buildShareActions(examName, correct, total, milestoneLabel) {
        const isArkeoloji = this.currentExam && this.currentExam.id === 'arkeoloji';
        const text = isArkeoloji
            ? `Arkeoloji Biz Quiz yarışında ${correct}/${total} yaptım. Güvenli kasam: ${milestoneLabel}. Sen de dene! Bir kişi 1 lira kazanırken, 1 milyon kişi bir fabrika kurar. Hem bilginizi sınayın, hem de linki sevdiklerinizle paylaşarak dijital imeceye katkıda bulunun.`
            : `${examName} yarışında ${correct}/${total} yaptım. Güvenli kasam: ${milestoneLabel}. Sen de dene!`;
        const url = isArkeoloji
            ? 'https://www.arkeoloji.biz/2026/03/dunyayi-kurtarmak.html'
            : `${window.location.origin}${window.location.pathname}`;
        const encodedText = encodeURIComponent(text);
        const encodedUrl = encodeURIComponent(url);

        return `
            <div>
                <h3 style="margin-bottom: 1rem;">Sonuçları Paylaş</h3>
                <div class="share-buttons">
                    <a class="share-btn" href="https://wa.me/?text=${encodedText}%20${encodedUrl}" target="_blank" rel="noopener noreferrer">
                        <span>📱</span> WhatsApp
                    </a>
                    <a class="share-btn facebook" href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}" target="_blank" rel="noopener noreferrer">
                        <span>f</span> Facebook
                    </a>
                    <a class="share-btn twitter" href="https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}" target="_blank" rel="noopener noreferrer">
                        <span>𝕏</span> X
                    </a>
                    <a class="share-btn linkedin" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}" target="_blank" rel="noopener noreferrer">
                        <span>in</span> LinkedIn
                    </a>
                    <button class="share-btn copy copy-share-link-btn" type="button">
                        <span>📋</span> Kopyala
                    </button>
                </div>
            </div>
        `;
    }

    startExam(examId) {
        if (Date.now() < this.startCooldownUntil) {
            return;
        }
        this.startCooldownUntil = Date.now() + 1200;

        const exam = CONFIG.EXAMS.find((item) => item.id === examId);
        if (!exam) {
            app.showNotification('Sinav bulunamadi.', 'error');
            return;
        }

        const bank = (window.QUESTION_BANKS && window.QUESTION_BANKS[exam.id]) || [];
        if (!bank.length) {
            app.showNotification('Bu sinav icin soru bankasi bulunamadi.', 'error');
            return;
        }

        const requiredQuestions = Number(exam.questions || CONFIG.QUIZ_POLICY.QUESTIONS_PER_GAME || 10);
        if (bank.length < requiredQuestions) {
            app.showNotification(`Bu yarisma icin en az ${requiredQuestions} onayli soru gerekli. Su an ${bank.length} soru var.`, 'error');
            return;
        }

        // Show loading state during question preparation
        this.showLoadingOverlay('Sorular yükleniyor...');

        // Use setTimeout to allow UI update before heavy processing
        setTimeout(() => {
            this.resetSession();

            this.currentExam = exam;
            this.questions = this.getQuestionSetWithVariedOrder(exam.id, bank, requiredQuestions);
            this.currentIndex = 0;
            this.timeLeft = (Number(exam.duration) || 60) * 60;
            this.sessionStartedAt = new Date().toISOString();
            this.announcedMilestones = {};
            this.streakBreakPrompted = false;
            this.isSubmitting = false;
            this.isAnswerLocked = false;

            this.hideLoadingOverlay();
            this.renderExamShell();
            this.renderQuestion();
            this.startTimer();
            app.showModal('examModal');
        }, 100);
    }

    renderExamShell() {
        const container = document.getElementById('examContainer');
        if (!container || !this.currentExam) return;

        container.innerHTML = `
            <div class="exam-header">
                <h2>${this.currentExam.name} Sinavi</h2>
                <p>${this.currentExam.description} - ${this.questions.length} soru</p>
                <div id="examTimer" class="exam-timer">Süre: 00:00</div>
            </div>

            <div class="milestone-ladder">
                ${this.buildMilestoneLadder(0)}
            </div>

            <div class="exam-progress">
                <div id="examProgressBar" class="exam-progress-bar" style="width:0%"></div>
            </div>

            <div class="question-container">
                <p id="questionNumber" class="question-number"></p>
                <div id="questionPassage" class="question-passage" style="display:none;"></div>
                <div id="questionMeta" class="exam-details"></div>
                <div id="questionEngagement"></div>
                <h3 id="questionText" class="question-text"></h3>
                <div id="questionOptions" class="options"></div>
            </div>

            <div class="exam-navigation">
                <button id="answerQuestionBtn" class="btn-next" type="button">Cevabı Onayla</button>
                <button id="nextQuestionBtn" class="btn-next" type="button" style="display:none;">Ileri</button>
                <button id="finishExamBtn" class="btn-finish" type="button" style="display:none;">Sinavi Bitir</button>
            </div>
            <div id="examTimerBottom" class="exam-timer exam-timer-bottom">Süre: 00:00</div>
        `;

        document.getElementById('answerQuestionBtn').addEventListener('click', () => this.submitAnswer());
        document.getElementById('nextQuestionBtn').addEventListener('click', () => this.changeQuestion(1));
        document.getElementById('finishExamBtn').addEventListener('click', () => this.finishExam(false));
        this.updateTimerText();
    }

    renderQuestion() {
        const question = this.questions[this.currentIndex];
        if (!question) return;

        const numberEl = document.getElementById('questionNumber');
        const passageEl = document.getElementById('questionPassage');
        const textEl = document.getElementById('questionText');
        const metaEl = document.getElementById('questionMeta');
        const engagementEl = document.getElementById('questionEngagement');
        const optionsEl = document.getElementById('questionOptions');
        const progressEl = document.getElementById('examProgressBar');
        const ladderEl = document.querySelector('.milestone-ladder');

        numberEl.textContent = `Soru ${this.currentIndex + 1} / ${this.questions.length}`;

        if (question.passage) {
            passageEl.style.display = 'block';
            passageEl.textContent = this.toDisplayText(question.passage);
        } else {
            passageEl.style.display = 'none';
            passageEl.textContent = '';
        }

        textEl.textContent = `Soru ${this.currentIndex + 1}: ${this.toDisplayText(question.text)}`;
        metaEl.textContent = `${this.toDisplayText(question.topic || '-')} | Zorluk: ${this.toDisplayText(question.difficulty || '-')}`;
        if (engagementEl) {
            engagementEl.innerHTML = this.getEngagementPrompt(question, this.currentIndex + 1);

            const searchInput = document.getElementById('engagementSearchInput');
            const searchBtn = document.getElementById('engagementSearchBtn');
            const openSearch = () => {
                const url = this.getSearchUrlByText(searchInput ? searchInput.value : '', question);
                window.open(url, '_blank', 'noopener');
            };

            if (searchBtn) {
                searchBtn.addEventListener('click', openSearch);
            }
            if (searchInput) {
                searchInput.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        openSearch();
                    }
                });
            }
        }
        if (ladderEl) {
            ladderEl.innerHTML = this.buildMilestoneLadder(this.currentIndex);
        }

        const labels = ['A', 'B', 'C', 'D', 'E'];
        const selected = this.answers[this.currentIndex];

        optionsEl.innerHTML = question.options.map((opt, idx) => {
            const checked = selected === idx ? 'checked' : '';
            const selectedClass = selected === idx ? 'selected' : '';
            return `
                <label class="option ${selectedClass}" data-index="${idx}">
                    <input type="radio" name="questionOption" value="${idx}" ${checked}>
                    <strong>${labels[idx] || idx + 1})</strong> ${this.decorateOptionText(question, opt, idx)}
                </label>
            `;
        }).join('');

        optionsEl.querySelectorAll('.option').forEach((optEl) => {
            optEl.addEventListener('click', () => {
                const index = Number(optEl.dataset.index);
                this.answers[this.currentIndex] = index;
                this.renderQuestion();
            });
        });

        const percent = ((this.currentIndex + 1) / this.questions.length) * 100;
        progressEl.style.width = `${percent}%`;

        const nextBtn = document.getElementById('nextQuestionBtn');
        const answerBtn = document.getElementById('answerQuestionBtn');
        const finishBtn = document.getElementById('finishExamBtn');
        nextBtn.style.display = 'none';
        finishBtn.style.display = 'none';
        answerBtn.style.display = 'inline-block';
        answerBtn.disabled = selected === undefined || this.isSubmitting;
    }

    changeQuestion(step) {
        const next = this.currentIndex + step;
        if (next < 0 || next >= this.questions.length) return;
        this.currentIndex = next;
        this.renderQuestion();
    }

    startTimer() {
        this.stopTimer();
        this.timerId = setInterval(() => {
            this.timeLeft -= 1;
            this.updateTimerText();

            if (this.timeLeft <= 0) {
                this.finishExam(true);
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }

    updateTimerText() {
        const timerTop = document.getElementById('examTimer');
        const timerBottom = document.getElementById('examTimerBottom');
        if (!timerTop && !timerBottom) return;

        const safe = Math.max(0, this.timeLeft);
        const min = String(Math.floor(safe / 60)).padStart(2, '0');
        const sec = String(safe % 60).padStart(2, '0');
        if (timerTop) timerTop.textContent = `Süre: ${min}:${sec}`;
        if (timerBottom) timerBottom.textContent = `Süre: ${min}:${sec}`;
    }

    async finishExam(autoFinish) {
        if (!this.currentExam || !this.questions.length || this.isSubmitting) return;

        this.isSubmitting = true;
        this.setExamInteractionDisabled(true);

        this.stopTimer();

        let correctStreak = 0;
        let correct = 0;
        let wrong = 0;
        let blank = 0;
        let failedAt = null;

        this.questions.forEach((q, idx) => {
            const answer = this.answers[idx];
            if (answer === undefined) {
                blank += 1;
                if (failedAt === null && correctStreak === idx) {
                    failedAt = idx + 1;
                }
                return;
            }
            if (Number(answer) === Number(q.correctIndex)) {
                correct += 1;
                if (failedAt === null && correctStreak === idx) {
                    correctStreak += 1;
                }
            } else {
                wrong += 1;
                if (failedAt === null && correctStreak === idx) {
                    failedAt = idx + 1;
                }
            }
        });

        const total = this.questions.length;
        const net = correct - wrong;
        const safeMilestone = this.getSafeMilestone(correctStreak);
        const nextMilestone = this.getNextMilestone(correctStreak);
        let pointsEarned = 0;
        let serverScored = false;
        let dailyQuota = null;

        // Show submitting state
        this.showLoadingOverlay('Sonuçlar gönderiliyor...');

        if (window.sheetsAPI && typeof sheetsAPI.submitExamResult === 'function') {
            try {
                const answersPayload = this.questions.map((q, idx) => ({
                    questionId: q.id || `${this.currentExam.id}-${idx + 1}`,
                    selectedIndex: this.answers[idx] !== undefined ? Number(this.answers[idx]) : null
                }));

                const result = await sheetsAPI.submitExamResult(this.currentExam.id, answersPayload, {
                    startedAt: this.sessionStartedAt,
                    finishedAt: new Date().toISOString(),
                    durationSeconds: ((Number(this.currentExam.duration) || 60) * 60) - this.timeLeft,
                    month: CONFIG.getCurrentMonth()
                });

                pointsEarned = Number(result.awardedPoints || 0);
                serverScored = true;
                correctStreak = Number(result.correctStreak || correctStreak);
                dailyQuota = {
                    used: Number(result.dailyAttemptsUsed || 0),
                    remaining: Number(result.dailyAttemptsRemaining || 0),
                    limit: Number(result.dailyAttemptLimit || CONFIG.QUIZ_POLICY.DAILY_ATTEMPT_LIMIT)
                };

                if (window.app) {
                    app.dailyQuota = dailyQuota;
                }

                if (typeof app.refreshMonthlyPointsFromServer === 'function') {
                    await app.refreshMonthlyPointsFromServer();
                }
                if (typeof app.refreshDailyQuizQuota === 'function') {
                    await app.refreshDailyQuizQuota();
                }
            } catch (error) {
                app.showNotification(`Sunucu puan kaydi basarisiz: ${error.message}`, 'error');
            }
        }

        const effectiveSafeMilestone = this.getSafeMilestone(correctStreak);
        const effectiveNextMilestone = this.getNextMilestone(correctStreak);
        const questionReview = this.questions.map((question, idx) => {
            const selected = this.answers[idx];
            const isCorrect = Number(selected) === Number(question.correctIndex);
            const status = selected === undefined ? 'Bos' : (isCorrect ? 'Dogru' : 'Yanlis');
            const labels = ['A', 'B', 'C', 'D', 'E'];
            return `
                <div class="result-item ${isCorrect ? 'correct' : selected === undefined ? 'blank' : 'incorrect'}">
                    <p><strong>${idx + 1}. soru:</strong> ${this.toDisplayText(question.text)}</p>
                    <p>Senin cevabin: ${selected === undefined ? '-' : labels[selected]}</p>
                    <p>Dogru cevap: ${labels[question.correctIndex]}</p>
                    <p>${this.toDisplayText(question.rationale || '')}</p>
                    <a href="${question.sourceUrl || 'https://www.arkeoloji.biz/'}" target="_blank" rel="noopener noreferrer">${this.toDisplayText(question.sourceTitle || 'Arkeoloji.biz kaynagina git')}</a>
                </div>
            `;
        }).join('');

        const container = document.getElementById('examContainer');
        container.innerHTML = `
            <div class="exam-header">
                <h2>${this.currentExam.name} Sonucu</h2>
                <p>${autoFinish ? 'Süre doldu, sınav otomatik bitirildi.' : 'Sınav tamamlandı.'}</p>
            </div>

            <div class="milestone-ladder results-ladder">
                ${this.buildMilestoneLadder(correctStreak)}
            </div>

            <div class="card" style="margin-bottom: 1rem;">
                <p><strong>Ilk hata/terk noktasi:</strong> ${failedAt || 'Tum sorular gecildi'}</p>
                <p><strong>Kesintisiz dogru:</strong> ${correctStreak}</p>
                <p><strong>Toplam dogru:</strong> ${correct}</p>
                <p><strong>Yanlis:</strong> ${wrong}</p>
                <p><strong>Bos:</strong> ${blank}</p>
                <p><strong>Net deneyim puani:</strong> ${net}</p>
                <p><strong>Guvenli kasa:</strong> ${effectiveSafeMilestone.cashLabel}</p>
                <p><strong>Siradaki baraj:</strong> ${effectiveNextMilestone ? `${effectiveNextMilestone.correct}. soru / ${effectiveNextMilestone.cashLabel}` : 'Tum barajlar tamamlandi'}</p>
                <p><strong>Kazanilan Puan:</strong> ${pointsEarned}</p>
                <p><strong>Puan Kaynagi:</strong> ${serverScored ? 'Sunucu dogrulamasi' : 'Kaydedilemedi'}</p>
                <p><strong>Gunluk kalan hak:</strong> ${dailyQuota ? dailyQuota.remaining : (app.dailyQuota ? app.dailyQuota.remaining : CONFIG.QUIZ_POLICY.DAILY_ATTEMPT_LIMIT)}</p>
                ${this.buildShareActions(this.currentExam.name, correct, total, effectiveSafeMilestone.cashLabel)}
            </div>

            <div class="result-review-list">${questionReview}</div>

            ${this.buildShareActions(this.currentExam.name, correct, total, effectiveSafeMilestone.cashLabel)}

            <button id="closeExamResultBtn" class="btn-primary" type="button">Kapat</button>
        `;

        this.hideLoadingOverlay();

        const msgType = pointsEarned > 0 ? 'success' : 'info';
        const msg = serverScored
            ? `${this.currentExam.name} tamamlandi. Kasan ${effectiveSafeMilestone.cashLabel}, +${pointsEarned} puan kaydedildi.`
            : `${this.currentExam.name} tamamlandi. Puanin sunucuya yazilmasi icin altyapiyi kontrol et.`;
        app.showNotification(msg, msgType);

        document.getElementById('closeExamResultBtn').addEventListener('click', () => {
            app.closeModal('examModal');
            this.resetSession();
        });
        const copyShareLinkButtons = document.querySelectorAll('.copy-share-link-btn');
        if (copyShareLinkButtons.length) {
            copyShareLinkButtons.forEach((copyShareLinkBtn) => {
                copyShareLinkBtn.addEventListener('click', async () => {
                const isArkeoloji = this.currentExam && this.currentExam.id === 'arkeoloji';
                const text = isArkeoloji
                    ? `Arkeoloji Biz Quiz yarışında ${correct}/${total} yaptım. Güvenli kasam: ${effectiveSafeMilestone.cashLabel}. Sen de dene! Bir kişi 1 lira kazanırken, 1 milyon kişi bir fabrika kurar. Hem bilginizi sınayın, hem de linki sevdiklerinizle paylaşarak dijital imeceye katkıda bulunun. https://www.arkeoloji.biz/2026/03/dunyayi-kurtarmak.html`
                    : `${this.currentExam.name} yarışında ${correct}/${total} yaptım. Güvenli kasam: ${effectiveSafeMilestone.cashLabel}. ${window.location.origin}${window.location.pathname}`;
                try {
                    await navigator.clipboard.writeText(text);
                    app.showNotification('Paylaşım metni panoya kopyalandı.', 'success');
                } catch (_) {
                    app.showNotification('Pano kopyalama başarısız oldu.', 'error');
                }
            });
            });
        }
    }

    getEngagementPrompt(question, questionNumber) {
        const prompts = CONFIG.QUIZ_POLICY.ENGAGEMENT_PROMPTS || [];
        const basePrompt = prompts[(questionNumber - 1) % Math.max(prompts.length, 1)] || 'İpuçları için arkeoloji.biz içeriklerine göz at.';
        const sourceUrl = this.getSourceDestination(question);
        const fact = this.toDisplayText(question.funFact || this.getArkeolojiFunFact(questionNumber));

        return `
            <div class="engagement-panel card">
                <p class="eyebrow">Arkeoloji.biz Uyarısı</p>
                <p>${this.toDisplayText(basePrompt)}</p>
                <p style="margin-top:0.5rem; padding:0.55rem 0.7rem; border-radius:8px; background:rgba(200,161,58,0.15); border:1px solid rgba(200,161,58,0.35);"><strong>İlginç Bilgi:</strong> ${fact}</p>
                <a class="btn-outline-link" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">${this.getSourceLabel(question)}</a>
                <div class="engagement-search" style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.75rem;">
                    <input id="engagementSearchInput" type="text" placeholder="Aramak istediğiniz kelime" style="flex:1; min-width:200px; padding:0.55rem 0.7rem; border-radius:8px; border:1px solid rgba(200,161,58,0.35); background:#111; color:#f3ebd5;">
                    <button id="engagementSearchBtn" type="button" class="btn-secondary">Arkeoloji.biz'de Ara</button>
                </div>
            </div>
        `;
    }

    submitAnswer() {
        if (this.isAnswerLocked || this.isSubmitting) return;

        const selected = this.answers[this.currentIndex];
        if (selected === undefined) {
            app.showNotification('Lütfen bir seçenek işaretleyin.', 'error');
            return;
        }

        this.isAnswerLocked = true;

        const previousStreak = this.getContiguousStreak(this.currentIndex - 1);
        const previousMilestone = this.getSafeMilestone(previousStreak);
        const question = this.questions[this.currentIndex];
        const isCorrect = Number(selected) === Number(question.correctIndex);

        const optionsEl = document.getElementById('questionOptions');
        if (optionsEl) {
            optionsEl.querySelectorAll('.option').forEach((optEl) => {
                const idx = Number(optEl.dataset.index);
                optEl.classList.remove('correct', 'incorrect');
                if (idx === Number(question.correctIndex)) {
                    optEl.classList.add('correct');
                }
                if (idx === Number(selected) && !isCorrect) {
                    optEl.classList.add('incorrect');
                }
            });
        }

        const currentStreak = this.getContiguousStreak(this.currentIndex);
        const currentMilestone = this.getSafeMilestone(currentStreak);
        const isLast = this.currentIndex >= this.questions.length - 1;

        if (!isLast && currentMilestone.correct > previousMilestone.correct && !this.announcedMilestones[currentMilestone.correct]) {
            this.announcedMilestones[currentMilestone.correct] = true;
            const shouldContinue = window.confirm(
                `Tebrikler! ${currentMilestone.correct}. barajı geçtiniz. Güvenli kasanız: ${currentMilestone.cashLabel}.\n\nDevam etmek için Tamam'a, yarışmayı bitirmek için İptal'e basın.`
            );
            if (!shouldContinue) {
                this.finishExam(false);
                this.isAnswerLocked = false;
                return;
            }
        }

        if (!isLast && previousStreak === this.currentIndex && !isCorrect && !this.streakBreakPrompted) {
            this.streakBreakPrompted = true;
            app.showNotification(`Yanlış cevap geldi. Yarışma ${previousMilestone.cashLabel} güvenli kasayla bitirildi.`, 'info');
            this.finishExam(false);
            this.isAnswerLocked = false;
            return;
        }

        if (isLast) {
            this.finishExam(false);
            this.isAnswerLocked = false;
            return;
        }

        this.changeQuestion(1);
        this.isAnswerLocked = false;
    }

    onModalClosed() {
        this.stopTimer();
        this.resetSession();
    }

    resetSession() {
        this.stopTimer();
        this.currentExam = null;
        this.questions = [];
        this.currentIndex = 0;
        this.answers = {};
        this.timeLeft = 0;
        this.sessionStartedAt = null;
        this.isSubmitting = false;
        this.isAnswerLocked = false;
    }

    shuffle(list) {
        for (let i = list.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
    }

    showLoadingOverlay(message = 'Yükleniyor...') {
        let overlay = document.getElementById('loadingOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-spinner"></div>
                <div class="loading-text">${message}</div>
                <div class="loading-progress">
                    <div class="loading-progress-bar"></div>
                </div>
            `;
            document.body.appendChild(overlay);
        } else {
            overlay.style.display = 'flex';
            const textEl = overlay.querySelector('.loading-text');
            if (textEl) textEl.textContent = message;
        }
    }

    hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
}

window.quiz = new Quiz();
