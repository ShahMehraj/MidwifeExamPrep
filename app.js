// App State
let currentIndex = loadCurrentIndex();
let selectedOption = null;
let answered = loadProgress();
let bookmarks = loadBookmarks();
let shuffled = false;
let filteredIndices = null; // null = show all
let filterPosition = 0;

// LocalStorage helpers
function saveProgress() {
    localStorage.setItem('mcq_answered', JSON.stringify(answered));
    localStorage.setItem('mcq_currentIndex', currentIndex);
}
function loadProgress() {
    try { return JSON.parse(localStorage.getItem('mcq_answered')) || {}; } catch(e) { return {}; }
}
function loadCurrentIndex() {
    return parseInt(localStorage.getItem('mcq_currentIndex') || '0', 10);
}
function saveBookmarks() {
    localStorage.setItem('mcq_bookmarks', JSON.stringify(bookmarks));
}
function loadBookmarks() {
    try { return JSON.parse(localStorage.getItem('mcq_bookmarks')) || {}; } catch(e) { return {}; }
}

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
const scoreText = document.getElementById('score-text');
const bookmarkBtn = document.getElementById('bookmark-btn');
const filterSelect = document.getElementById('filter-select');

// Initialize
function init() {
    buildSectionNav();
    applyFilter();
    renderQuestion();
    updateProgress();

    submitBtn.addEventListener('click', submitAnswer);
    prevBtn.addEventListener('click', () => navigate(-1));
    nextBtn.addEventListener('click', () => navigate(1));
    prevBtnBottom.addEventListener('click', () => navigate(-1));
    nextBtnBottom.addEventListener('click', () => navigate(1));
    bookmarkBtn.addEventListener('click', toggleBookmark);
    filterSelect.addEventListener('change', () => { applyFilter(); renderQuestion(); });

    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    loadTheme();

    // Stats modal
    document.getElementById('stats-toggle').addEventListener('click', showStats);
    document.getElementById('stats-close').addEventListener('click', () => {
        document.getElementById('stats-modal').style.display = 'none';
    });
    document.getElementById('stats-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
    });

    // Shuffle toggle
    document.getElementById('shuffle-toggle').addEventListener('click', toggleShuffle);

    // Reset
    document.getElementById('reset-btn').addEventListener('click', () => {
        if (confirm('Reset all progress? This cannot be undone.')) {
            answered = {};
            bookmarks = {};
            currentIndex = 0;
            filterPosition = 0;
            localStorage.removeItem('mcq_answered');
            localStorage.removeItem('mcq_currentIndex');
            localStorage.removeItem('mcq_bookmarks');
            applyFilter();
            renderQuestion();
            updateProgress();
        }
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (document.getElementById('stats-modal').style.display !== 'none') return;
        if (e.key === 'ArrowLeft') navigate(-1);
        if (e.key === 'ArrowRight') navigate(1);
        if (e.key === 'Enter' && !submitBtn.disabled) submitAnswer();
        if (e.key >= '1' && e.key <= '4') {
            const idx = parseInt(e.key) - 1;
            if (answered[currentIndex] === undefined && idx < 4) selectOption(idx);
        }
    });
}

// Theme
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('mcq_theme', next);
    document.getElementById('theme-toggle').textContent = next === 'dark' ? '☀️' : '🌙';
}
function loadTheme() {
    const saved = localStorage.getItem('mcq_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    document.getElementById('theme-toggle').textContent = saved === 'dark' ? '☀️' : '🌙';
}

// Shuffle
function toggleShuffle() {
    shuffled = !shuffled;
    document.getElementById('shuffle-toggle').classList.toggle('active', shuffled);
    applyFilter();
    filterPosition = 0;
    currentIndex = filteredIndices ? filteredIndices[0] : 0;
    renderQuestion();
}

// Filter
function applyFilter() {
    const filter = filterSelect.value;
    let indices = [];

    for (let i = 0; i < questions.length; i++) {
        if (filter === 'all') { indices.push(i); }
        else if (filter === 'unanswered' && answered[i] === undefined) { indices.push(i); }
        else if (filter === 'incorrect') {
            if (answered[i] !== undefined) {
                const correctIdx = ['A','B','C','D'].indexOf(questions[i].correct);
                if (answered[i] !== correctIdx) indices.push(i);
            }
        }
        else if (filter === 'bookmarked' && bookmarks[i]) { indices.push(i); }
    }

    if (shuffled) {
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
    }

    filteredIndices = indices;
    filterPosition = 0;
    if (indices.length > 0) {
        // Try to keep current question if it's in the filtered set
        const pos = indices.indexOf(currentIndex);
        if (pos !== -1) filterPosition = pos;
        else currentIndex = indices[0];
    }
}

// Navigation with filter
function navigate(direction) {
    if (!filteredIndices || filteredIndices.length === 0) return;
    filterPosition += direction;
    if (filterPosition < 0) filterPosition = 0;
    if (filterPosition >= filteredIndices.length) filterPosition = filteredIndices.length - 1;
    currentIndex = filteredIndices[filterPosition];
    renderQuestion();
    saveProgress();
}

// Build section navigation
function buildSectionNav() {
    const sections = [...new Set(questions.map(q => q.section))];
    sectionList.innerHTML = '';
    sections.forEach(section => {
        const li = document.createElement('li');
        li.textContent = section;
        li.dataset.section = section;
        li.addEventListener('click', () => {
            const firstQ = questions.findIndex(q => q.section === section);
            if (firstQ !== -1) {
                currentIndex = firstQ;
                if (filteredIndices) {
                    const pos = filteredIndices.indexOf(firstQ);
                    if (pos !== -1) filterPosition = pos;
                }
                renderQuestion();
                updateSectionNav();
                saveProgress();
            }
        });
        sectionList.appendChild(li);
    });
    updateSectionNav();
}

function updateSectionNav() {
    const currentSection = questions[currentIndex].section;
    document.querySelectorAll('.sidebar ul li').forEach(li => {
        li.classList.toggle('active', li.dataset.section === currentSection);
    });
}

// Render
function renderQuestion() {
    if (!filteredIndices || filteredIndices.length === 0) {
        questionText.textContent = 'No questions match the current filter.';
        optionsContainer.innerHTML = '';
        submitBtn.style.display = 'none';
        resultBox.style.display = 'none';
        sectionBadge.textContent = '';
        questionCounter.textContent = '0 of 0';
        return;
    }

    const q = questions[currentIndex];
    selectedOption = null;

    sectionBadge.textContent = q.section;
    questionText.textContent = `Q${currentIndex + 1}. ${q.question}`;

    // Bookmark state
    bookmarkBtn.textContent = bookmarks[currentIndex] ? '★' : '☆';
    bookmarkBtn.classList.toggle('bookmarked', !!bookmarks[currentIndex]);

    // Options
    optionsContainer.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];
    q.options.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = 'option';
        div.innerHTML = `<span class="option-letter">${letters[idx]}</span><span class="option-text">${opt}</span>`;
        div.addEventListener('click', () => selectOption(idx));
        optionsContainer.appendChild(div);
    });

    // Counter
    questionCounter.textContent = `Q${filterPosition + 1} of ${filteredIndices.length}`;

    // Nav buttons
    prevBtn.disabled = filterPosition === 0;
    nextBtn.disabled = filterPosition === filteredIndices.length - 1;
    prevBtnBottom.disabled = filterPosition === 0;
    nextBtnBottom.disabled = filterPosition === filteredIndices.length - 1;

    // Already answered?
    if (answered[currentIndex] !== undefined) {
        showResult(answered[currentIndex]);
    } else {
        resultBox.style.display = 'none';
        resultBox.className = 'result-box';
        submitBtn.style.display = 'block';
        submitBtn.disabled = true;
    }

    updateSectionNav();
}

// Select option
function selectOption(idx) {
    if (answered[currentIndex] !== undefined) return;
    selectedOption = idx;
    optionsContainer.querySelectorAll('.option').forEach((opt, i) => {
        opt.classList.toggle('selected', i === idx);
    });
    submitBtn.disabled = false;
}

// Submit
function submitAnswer() {
    if (selectedOption === null) return;
    answered[currentIndex] = selectedOption;
    showResult(selectedOption);
    updateProgress();
    saveProgress();

    // Confetti on correct
    const correctIdx = ['A','B','C','D'].indexOf(questions[currentIndex].correct);
    if (selectedOption === correctIdx) fireConfetti();
}

// Show result
function showResult(userChoice) {
    const q = questions[currentIndex];
    const correctIdx = ['A','B','C','D'].indexOf(q.correct);
    const isCorrect = userChoice === correctIdx;

    optionsContainer.querySelectorAll('.option').forEach((opt, i) => {
        opt.classList.add('disabled');
        opt.classList.remove('selected');
        if (i === correctIdx) opt.classList.add('correct');
        if (i === userChoice && !isCorrect) opt.classList.add('incorrect');
    });

    resultBox.style.display = 'block';
    if (isCorrect) {
        resultBox.className = 'result-box correct';
        resultHeader.textContent = '✅ Correct!';
    } else {
        resultBox.className = 'result-box incorrect';
        resultHeader.textContent = `❌ Incorrect. The correct answer is ${q.correct}.`;
    }
    rationaleEl.textContent = q.rationale;
    submitBtn.style.display = 'none';
}

// Bookmark
function toggleBookmark() {
    bookmarks[currentIndex] = !bookmarks[currentIndex];
    if (!bookmarks[currentIndex]) delete bookmarks[currentIndex];
    bookmarkBtn.textContent = bookmarks[currentIndex] ? '★' : '☆';
    bookmarkBtn.classList.toggle('bookmarked', !!bookmarks[currentIndex]);
    saveBookmarks();
}

// Progress
function updateProgress() {
    const total = questions.length;
    const answeredCount = Object.keys(answered).length;
    const percent = (answeredCount / total) * 100;
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${answeredCount} / ${total} answered`;

    // Score
    let correct = 0;
    for (const [idx, choice] of Object.entries(answered)) {
        const correctIdx = ['A','B','C','D'].indexOf(questions[idx].correct);
        if (choice === correctIdx) correct++;
    }
    if (answeredCount > 0) {
        scoreText.textContent = `${correct}/${answeredCount} correct (${Math.round(correct/answeredCount*100)}%)`;
    } else {
        scoreText.textContent = '';
    }
}

// Stats Modal
function showStats() {
    const total = questions.length;
    const answeredCount = Object.keys(answered).length;
    let correct = 0;
    for (const [idx, choice] of Object.entries(answered)) {
        const correctIdx = ['A','B','C','D'].indexOf(questions[idx].correct);
        if (choice === correctIdx) correct++;
    }
    const incorrect = answeredCount - correct;
    const unanswered = total - answeredCount;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-correct').textContent = correct;
    document.getElementById('stat-incorrect').textContent = incorrect;
    document.getElementById('stat-unanswered').textContent = unanswered;
    document.getElementById('stat-percentage').textContent = answeredCount > 0
        ? `${Math.round(correct/answeredCount*100)}% accuracy`
        : 'No answers yet';

    // Section breakdown
    const sections = [...new Set(questions.map(q => q.section))];
    const breakdown = document.getElementById('section-breakdown');
    breakdown.innerHTML = '';
    sections.forEach(sec => {
        const secQuestions = questions.map((q, i) => ({...q, idx: i})).filter(q => q.section === sec);
        let secCorrect = 0, secAnswered = 0;
        secQuestions.forEach(q => {
            if (answered[q.idx] !== undefined) {
                secAnswered++;
                const ci = ['A','B','C','D'].indexOf(q.correct);
                if (answered[q.idx] === ci) secCorrect++;
            }
        });
        const pct = secAnswered > 0 ? Math.round(secCorrect/secAnswered*100) : 0;
        const row = document.createElement('div');
        row.className = 'breakdown-row';
        row.innerHTML = `
            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${sec}</span>
            <span style="margin-left:0.5rem;white-space:nowrap;">${secCorrect}/${secAnswered}</span>
            <div class="breakdown-bar"><div class="breakdown-fill" style="width:${pct}%"></div></div>
        `;
        breakdown.appendChild(row);
    });

    document.getElementById('stats-modal').style.display = 'flex';
}

// Confetti
function fireConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#00a86b', '#004d99', '#ffc107', '#dc3545', '#6f42c1', '#ff6b6b'];

    for (let i = 0; i < 80; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: -10,
            vx: (Math.random() - 0.5) * 8,
            vy: Math.random() * 4 + 2,
            size: Math.random() * 8 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 10,
            life: 1
        });
    }

    let frame = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        particles.forEach(p => {
            if (p.life <= 0) return;
            alive = true;
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15;
            p.rotation += p.rotSpeed;
            p.life -= 0.012;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size * 0.6);
            ctx.restore();
        });
        frame++;
        if (alive && frame < 120) requestAnimationFrame(animate);
        else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    animate();
}

// Start
document.addEventListener('DOMContentLoaded', init);
