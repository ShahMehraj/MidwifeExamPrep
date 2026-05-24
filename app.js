// App State
let currentIndex = 0;
let selectedOption = null;
let answered = {};

// DOM Elements
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const submitBtn = document.getElementById('submit-btn');
const resultBox = document.getElementById('result-box');
const resultHeader = document.getElementById('result-header');
const rationaleEl = document.getElementById('rationale');
const sectionBadge = document.getElementById('section-badge');
const questionCounter = document.getElementById('question-counter');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const prevBtnBottom = document.getElementById('prev-btn-bottom');
const nextBtnBottom = document.getElementById('next-btn-bottom');
const sectionList = document.getElementById('section-list');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

// Initialize
function init() {
    buildSectionNav();
    renderQuestion();
    updateProgress();

    // Event listeners
    submitBtn.addEventListener('click', submitAnswer);
    prevBtn.addEventListener('click', () => navigate(-1));
    nextBtn.addEventListener('click', () => navigate(1));
    prevBtnBottom.addEventListener('click', () => navigate(-1));
    nextBtnBottom.addEventListener('click', () => navigate(1));

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') navigate(-1);
        if (e.key === 'ArrowRight') navigate(1);
        if (e.key === 'Enter' && !submitBtn.disabled) submitAnswer();
        if (e.key >= '1' && e.key <= '4') {
            const idx = parseInt(e.key) - 1;
            if (!answered[currentIndex] && idx < 4) selectOption(idx);
        }
    });
}

// Build section navigation
function buildSectionNav() {
    const sections = [...new Set(questions.map(q => q.section))];
    sectionList.innerHTML = '';
    sections.forEach((section, idx) => {
        const li = document.createElement('li');
        li.textContent = section;
        li.dataset.section = section;
        li.addEventListener('click', () => {
            const firstQ = questions.findIndex(q => q.section === section);
            if (firstQ !== -1) {
                currentIndex = firstQ;
                renderQuestion();
                updateSectionNav();
            }
        });
        sectionList.appendChild(li);
    });
    updateSectionNav();
}

// Update active section in nav
function updateSectionNav() {
    const currentSection = questions[currentIndex].section;
    document.querySelectorAll('.sidebar ul li').forEach(li => {
        li.classList.toggle('active', li.dataset.section === currentSection);
    });
}

// Render current question
function renderQuestion() {
    const q = questions[currentIndex];
    selectedOption = null;

    // Section badge
    sectionBadge.textContent = q.section;

    // Question text
    questionText.textContent = `Q${currentIndex + 1}. ${q.question}`;

    // Options
    optionsContainer.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];
    q.options.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = 'option';
        div.innerHTML = `
            <span class="option-letter">${letters[idx]}</span>
            <span class="option-text">${opt}</span>
        `;
        div.addEventListener('click', () => selectOption(idx));
        optionsContainer.appendChild(div);
    });

    // Counter
    questionCounter.textContent = `Q${currentIndex + 1} of ${questions.length}`;

    // Navigation buttons
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === questions.length - 1;
    prevBtnBottom.disabled = currentIndex === 0;
    nextBtnBottom.disabled = currentIndex === questions.length - 1;

    // Check if already answered
    if (answered[currentIndex] !== undefined) {
        showResult(answered[currentIndex]);
    } else {
        resultBox.style.display = 'none';
        resultBox.className = 'result-box';
        submitBtn.style.display = 'block';
        submitBtn.disabled = true;
    }

    updateSectionNav();
    // Scroll to top of question
    document.querySelector('.question-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Select an option
function selectOption(idx) {
    if (answered[currentIndex] !== undefined) return;

    selectedOption = idx;
    const options = optionsContainer.querySelectorAll('.option');
    options.forEach((opt, i) => {
        opt.classList.toggle('selected', i === idx);
    });
    submitBtn.disabled = false;
}

// Submit answer
function submitAnswer() {
    if (selectedOption === null) return;

    const q = questions[currentIndex];
    answered[currentIndex] = selectedOption;
    showResult(selectedOption);
    updateProgress();
}

// Show result
function showResult(userChoice) {
    const q = questions[currentIndex];
    const correctIdx = ['A', 'B', 'C', 'D'].indexOf(q.correct);
    const isCorrect = userChoice === correctIdx;

    // Disable options
    const options = optionsContainer.querySelectorAll('.option');
    options.forEach((opt, i) => {
        opt.classList.add('disabled');
        opt.classList.remove('selected');
        if (i === correctIdx) {
            opt.classList.add('correct');
        }
        if (i === userChoice && !isCorrect) {
            opt.classList.add('incorrect');
        }
    });

    // Show result box
    resultBox.style.display = 'block';
    if (isCorrect) {
        resultBox.className = 'result-box correct';
        resultHeader.textContent = '\u2705 Correct!';
    } else {
        resultBox.className = 'result-box incorrect';
        resultHeader.textContent = `\u274C Incorrect. The correct answer is ${q.correct}.`;
    }
    rationaleEl.textContent = q.rationale;

    // Hide submit button
    submitBtn.style.display = 'none';
}

// Navigate
function navigate(direction) {
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < questions.length) {
        currentIndex = newIndex;
        renderQuestion();
    }
}

// Update progress
function updateProgress() {
    const total = questions.length;
    const answeredCount = Object.keys(answered).length;
    const percent = (answeredCount / total) * 100;
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${answeredCount} / ${total} answered`;
}

// Start
document.addEventListener('DOMContentLoaded', init);
