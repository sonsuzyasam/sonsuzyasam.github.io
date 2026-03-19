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

    getEngagementPrompt(question, questionNumber) {
        const prompts = CONFIG.QUIZ_POLICY.ENGAGEMENT_PROMPTS || [];
        const basePrompt = prompts[(questionNumber - 1) % Math.max(prompts.length, 1)] || 'Ipuclari icin arkeoloji.biz iceriklerine goz at.';
        const sourceTitle = question.sourceTitle || 'Arkeoloji.biz kaynagi';
        const sourceUrl = question.sourceUrl || 'https://www.arkeoloji.biz/';

        return `
            <div class="engagement-panel card">
                <p class="eyebrow">Arkeoloji.biz Uyarani</p>
                <p>${basePrompt}</p>
                <a class="btn-outline-link" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">${sourceTitle}</a>
            </div>
        `;
    }

    startExam(examId) {
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

        const requiredQuestions = Number(exam.questions || CONFIG.QUIZ_POLICY.QUESTIONS_PER_GAME || 20);
        if (bank.length < requiredQuestions) {
            app.showNotification(`Bu yarisma icin en az ${requiredQuestions} onayli soru gerekli. Su an ${bank.length} soru var.`, 'error');
            return;
        }

        const pass = confirm(`${exam.name} baslatilsin mi?\n20 soruluk bu oyunda guvenli barajlar: 3/10/15/20.`);
        if (!pass) return;

        this.resetSession();

        this.currentExam = exam;
        this.questions = this.shuffle([...bank]).slice(0, requiredQuestions);
        this.currentIndex = 0;
        this.timeLeft = (Number(exam.duration) || 60) * 60;
        this.sessionStartedAt = new Date().toISOString();

        this.renderExamShell();
        this.renderQuestion();
        this.startTimer();
        app.showModal('examModal');
    }

    renderExamShell() {
        const container = document.getElementById('examContainer');
        if (!container || !this.currentExam) return;

        container.innerHTML = `
            <div class="exam-header">
                <h2>${this.currentExam.name} Sinavi</h2>
                <p>${this.currentExam.description} - ${this.questions.length} soru</p>
                <div id="examTimer" class="exam-timer">Sure: 00:00</div>
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
                <h3 id="questionText" class="question-text"></h3>
                <div id="questionMeta" class="exam-details"></div>
                <div id="questionEngagement"></div>
                <div id="questionOptions" class="options"></div>
            </div>

            <div class="exam-navigation">
                <button id="prevQuestionBtn" class="btn-prev" type="button">Geri</button>
                <button id="nextQuestionBtn" class="btn-next" type="button">Ileri</button>
                <button id="finishExamBtn" class="btn-finish" type="button">Sinavi Bitir</button>
            </div>
        `;

        document.getElementById('prevQuestionBtn').addEventListener('click', () => this.changeQuestion(-1));
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
            passageEl.textContent = question.passage;
        } else {
            passageEl.style.display = 'none';
            passageEl.textContent = '';
        }

        textEl.textContent = question.text;
        metaEl.textContent = `${question.topic || '-'} | Zorluk: ${question.difficulty || '-'}`;
        if (engagementEl) {
            engagementEl.innerHTML = this.getEngagementPrompt(question, this.currentIndex + 1);
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
                    <strong>${labels[idx] || idx + 1})</strong> ${opt}
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

        const prevBtn = document.getElementById('prevQuestionBtn');
        const nextBtn = document.getElementById('nextQuestionBtn');
        prevBtn.disabled = this.currentIndex === 0;
        nextBtn.disabled = this.currentIndex >= this.questions.length - 1;
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
        const timerEl = document.getElementById('examTimer');
        if (!timerEl) return;

        const safe = Math.max(0, this.timeLeft);
        const min = String(Math.floor(safe / 60)).padStart(2, '0');
        const sec = String(safe % 60).padStart(2, '0');
        timerEl.textContent = `Sure: ${min}:${sec}`;
    }

    async finishExam(autoFinish) {
        if (!this.currentExam || !this.questions.length) return;

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
                    <p><strong>${idx + 1}. soru:</strong> ${question.text}</p>
                    <p>Senin cevabin: ${selected === undefined ? '-' : labels[selected]}</p>
                    <p>Dogru cevap: ${labels[question.correctIndex]}</p>
                    <p>${question.rationale || ''}</p>
                    <a href="${question.sourceUrl || 'https://www.arkeoloji.biz/'}" target="_blank" rel="noopener noreferrer">${question.sourceTitle || 'Arkeoloji.biz kaynagina git'}</a>
                </div>
            `;
        }).join('');

        const container = document.getElementById('examContainer');
        container.innerHTML = `
            <div class="exam-header">
                <h2>${this.currentExam.name} Sonucu</h2>
                <p>${autoFinish ? 'Sure doldu, sinav otomatik bitirildi.' : 'Sinav tamamlandi.'}</p>
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
            </div>

            <div class="result-review-list">${questionReview}</div>

            <button id="closeExamResultBtn" class="btn-primary" type="button">Kapat</button>
        `;

        const msgType = pointsEarned > 0 ? 'success' : 'info';
        const msg = serverScored
            ? `${this.currentExam.name} tamamlandi. Kasan ${effectiveSafeMilestone.cashLabel}, +${pointsEarned} puan kaydedildi.`
            : `${this.currentExam.name} tamamlandi. Puanin sunucuya yazilmasi icin altyapiyi kontrol et.`;
        app.showNotification(msg, msgType);

        document.getElementById('closeExamResultBtn').addEventListener('click', () => {
            app.closeModal('examModal');
            this.resetSession();
        });
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
    }

    shuffle(list) {
        for (let i = list.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
    }
}

window.quiz = new Quiz();
