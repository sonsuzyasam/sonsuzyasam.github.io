// ===== QUIZ.JS =====

class Quiz {
    constructor() {
        this.currentExam = null;
        this.questions = [];
        this.currentIndex = 0;
        this.answers = {};
        this.timeLeft = 0;
        this.timerId = null;
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

        const pass = confirm(`${exam.name} sinavi baslatilsin mi?\nToplam ${bank.length} soru cozeceksin.`);
        if (!pass) return;

        this.resetSession();

        this.currentExam = exam;
        this.questions = this.shuffle([...bank]);
        this.currentIndex = 0;
        this.timeLeft = (Number(exam.duration) || 60) * 60;

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

            <div class="exam-progress">
                <div id="examProgressBar" class="exam-progress-bar" style="width:0%"></div>
            </div>

            <div class="question-container">
                <p id="questionNumber" class="question-number"></p>
                <div id="questionPassage" class="question-passage" style="display:none;"></div>
                <h3 id="questionText" class="question-text"></h3>
                <div id="questionMeta" class="exam-details"></div>
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
        const optionsEl = document.getElementById('questionOptions');
        const progressEl = document.getElementById('examProgressBar');

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

    finishExam(autoFinish) {
        if (!this.currentExam || !this.questions.length) return;

        this.stopTimer();

        let correct = 0;
        let wrong = 0;

        this.questions.forEach((q, idx) => {
            const answer = this.answers[idx];
            if (answer === undefined) return;
            if (Number(answer) === Number(q.correctIndex)) {
                correct += 1;
            } else {
                wrong += 1;
            }
        });

        const total = this.questions.length;
        const blank = total - (correct + wrong);
        const net = correct - (wrong / 3);
        const score = Math.max(0, Math.min(100, ((net * 100) / total) + 50));
        const passed = score >= Number(CONFIG.POINTS_SYSTEM.PASS_SCORE || 45);
        const pointsEarned = passed ? Math.max(0, Math.round(score)) : 0;

        if (pointsEarned > 0) {
            app.addPoints(pointsEarned);
        }

        const container = document.getElementById('examContainer');
        container.innerHTML = `
            <div class="exam-header">
                <h2>${this.currentExam.name} Sonucu</h2>
                <p>${autoFinish ? 'Sure doldu, sinav otomatik bitirildi.' : 'Sinav tamamlandi.'}</p>
            </div>

            <div class="card" style="margin-bottom: 1rem;">
                <p><strong>Dogru:</strong> ${correct}</p>
                <p><strong>Yanlis:</strong> ${wrong}</p>
                <p><strong>Bos:</strong> ${blank}</p>
                <p><strong>Net:</strong> ${net.toFixed(2)}</p>
                <p><strong>Skor:</strong> ${score.toFixed(2)}</p>
                <p><strong>Baraj:</strong> ${passed ? 'Gecti' : 'Gecemedi'} (${CONFIG.POINTS_SYSTEM.PASS_SCORE})</p>
                <p><strong>Kazanilan Puan:</strong> ${pointsEarned}</p>
            </div>

            <button id="closeExamResultBtn" class="btn-primary" type="button">Kapat</button>
        `;

        const msgType = passed ? 'success' : 'info';
        const msg = passed
            ? `${this.currentExam.name} tamamlandi. +${pointsEarned} puan kazandin.`
            : `${this.currentExam.name} tamamlandi. Baraj alti kaldigin icin puan eklenmedi.`;
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
