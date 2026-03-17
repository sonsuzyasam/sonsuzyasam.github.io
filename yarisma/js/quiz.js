// ===== QUIZ.JS =====

class Quiz {
    startExam(examId) {
        const exam = CONFIG.EXAMS.find((item) => item.id === examId);
        if (!exam) {
            app.showNotification('Sinav bulunamadi.', 'error');
            return;
        }

        const pass = confirm(`${exam.name} baslatilsin mi?\nBu surumde demo sinav puani verilecektir.`);
        if (!pass) return;

        const points = Math.floor(Math.random() * 41) + 10;
        app.addPoints(points);
        app.showNotification(`${exam.name} tamamlandi. +${points} puan`, 'success');
        app.closeModal('examModal');
    }
}

window.quiz = new Quiz();
