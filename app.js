// ===== Multi-subject quiz app =====
// Data: window.SUBJECTS (manifest) + window.SUBJECT_DATA[id] (lazy-loaded per subject).
// `questions` is the active subject's array; progress/bookmarks are keyed per subject.

let questions = [];              // active subject's questions (global; pdf_generator reads this)
let currentSubject = null;       // active subject id
let loadedSubjects = {};         // id -> true once its data file is injected

let currentIndex = 0;
let selectedOption = null;       // single-answer: index; SATA: unused (see selectedSet)
let selectedSet = new Set();     // SATA: set of selected option indices
let answered = {};               // per-subject: index -> stored answer (int, or "1,2" for SATA)
let bookmarks = {};
let shuffled = false;
let filteredIndices = null;
let filterPosition = 0;

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ---------- localStorage (per subject) ----------
function k(base) { return `mcq_${base}_${currentSubject}`; }
function saveProgress() {
    localStorage.setItem(k('answered'), JSON.stringify(answered));
    localStorage.setItem(k('currentIndex'), currentIndex);
    localStorage.setItem('mcq_subject', currentSubject);
}
function loadProgress() {
    try { return JSON.parse(localStorage.getItem(k('answered'))) || {}; } catch (e) { return {}; }
}
function loadCurrentIndex() {
    return parseInt(localStorage.getItem(k('currentIndex')) || '0', 10);
}
function saveBookmarks() { localStorage.setItem(k('bookmarks'), JSON.stringify(bookmarks)); }
function loadBookmarks() {
    try { return JSON.parse(localStorage.getItem(k('bookmarks'))) || {}; } catch (e) { return {}; }
}

// ---------- answer helpers (single + SATA) ----------
function correctLetters(q) { return q.correct.split(',').map(s => s.trim()).filter(Boolean); }
function isSATA(q) { return correctLetters(q).length > 1; }
function correctIndices(q) { return correctLetters(q).map(l => LETTERS.indexOf(l)).filter(i => i >= 0); }
// Stored answer -> array of chosen indices
function storedToIndices(val) {
    if (val === undefined || val === null) return null;
    if (typeof val === 'number') return [val];
    return String(val).split(',').filter(s => s !== '').map(Number);
}
function isAnswerCorrect(q, val) {
    const chosen = storedToIndices(val);
    if (!chosen) return false;
    const correct = correctIndices(q).slice().sort((a, b) => a - b);
    const got = chosen.slice().sort((a, b) => a - b);
    return correct.length === got.length && correct.every((v, i) => v === got[i]);
}

// ---------- DOM ----------
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
const filterPills = document.getElementById('filter-pills');
const subjectListEl = document.getElementById('subject-list');
const subjectDropdown = document.getElementById('subject-dropdown');
const subjectToggle = document.getElementById('subject-toggle');
const subjectToggleLabel = document.getElementById('subject-toggle-label');
let currentFilter = 'all';

function openSubjectDropdown(open) {
    subjectDropdown.classList.toggle('open', open);
    subjectToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}

// ---------- subject loading (lazy) ----------
function loadSubjectData(id) {
    return new Promise((resolve, reject) => {
        if (window.SUBJECT_DATA && window.SUBJECT_DATA[id]) { resolve(); return; }
        const meta = window.SUBJECTS.find(s => s.id === id);
        if (!meta) { reject(new Error('unknown subject ' + id)); return; }
        const script = document.createElement('script');
        script.src = meta.file;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('failed to load ' + meta.file));
        document.head.appendChild(script);
    });
}

async function switchSubject(id) {
    questionText.textContent = 'Loading…';
    optionsContainer.innerHTML = '';
    submitBtn.style.display = 'none';
    resultBox.style.display = 'none';
    try {
        await loadSubjectData(id);
    } catch (e) {
        questionText.textContent = 'Could not load this subject.';
        return;
    }
    currentSubject = id;
    questions = window.SUBJECT_DATA[id];
    answered = loadProgress();
    bookmarks = loadBookmarks();
    currentIndex = loadCurrentIndex();
    if (currentIndex >= questions.length) currentIndex = 0;
    shuffled = false;
    document.getElementById('shuffle-toggle').classList.remove('active');
    currentFilter = 'all';
    filterPills.querySelectorAll('.filter-pill').forEach(p =>
        p.classList.toggle('active', p.dataset.filter === 'all'));
    subjectListEl.querySelectorAll('.subject-item').forEach(li =>
        li.classList.toggle('active', li.dataset.subject === id));
    const meta = window.SUBJECTS.find(s => s.id === id);
    if (meta) subjectToggleLabel.textContent = `${meta.name} (${meta.count.toLocaleString()})`;
    localStorage.setItem('mcq_subject', id);
    updateSubjectHeading();
    buildSectionNav();
    applyFilter();
    // keep restored index if present in the filtered set
    if (filteredIndices) {
        const pos = filteredIndices.indexOf(currentIndex);
        filterPosition = pos !== -1 ? pos : 0;
        currentIndex = filteredIndices[filterPosition] ?? 0;
    }
    renderQuestion();
    updateProgress();
}

function updateSubjectHeading() {
    const meta = window.SUBJECTS.find(s => s.id === currentSubject);
    const el = document.getElementById('subject-heading');
    if (el && meta) el.textContent = `${meta.name} · ${meta.count.toLocaleString()} MCQs`;
}

// ---------- Init ----------
function init() {
    // Populate subject picker (styled list, not a native select) from manifest
    subjectListEl.innerHTML = '';
    window.SUBJECTS.forEach(s => {
        const li = document.createElement('li');
        li.className = 'subject-item';
        li.dataset.subject = s.id;
        li.title = s.name;
        li.innerHTML = `<span class="subject-name">${s.name}</span>` +
            `<span class="subject-count">${s.count.toLocaleString()}</span>`;
        li.addEventListener('click', () => {
            openSubjectDropdown(false);
            if (s.id !== currentSubject) switchSubject(s.id);
        });
        subjectListEl.appendChild(li);
    });

    // Dropdown open/close
    subjectToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        openSubjectDropdown(!subjectDropdown.classList.contains('open'));
    });
    document.addEventListener('click', (e) => {
        if (!subjectDropdown.contains(e.target)) openSubjectDropdown(false);
    });

    const saved = localStorage.getItem('mcq_subject');
    const startId = (saved && window.SUBJECTS.some(s => s.id === saved))
        ? saved : window.SUBJECTS[0].id;

    submitBtn.addEventListener('click', submitAnswer);
    prevBtn.addEventListener('click', () => navigate(-1));
    nextBtn.addEventListener('click', () => navigate(1));
    prevBtnBottom.addEventListener('click', () => navigate(-1));
    nextBtnBottom.addEventListener('click', () => navigate(1));
    bookmarkBtn.addEventListener('click', toggleBookmark);
    filterPills.addEventListener('click', (e) => {
        const pill = e.target.closest('.filter-pill');
        if (!pill) return;
        currentFilter = pill.dataset.filter;
        filterPills.querySelectorAll('.filter-pill').forEach(p =>
            p.classList.toggle('active', p === pill));
        applyFilter();
        renderQuestion();
    });

    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    loadTheme();

    document.getElementById('stats-toggle').addEventListener('click', showStats);
    document.getElementById('stats-close').addEventListener('click', () => {
        document.getElementById('stats-modal').style.display = 'none';
    });
    document.getElementById('stats-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
    });

    document.getElementById('shuffle-toggle').addEventListener('click', toggleShuffle);
    document.getElementById('export-pdf').addEventListener('click', exportToPDF);

    document.getElementById('reset-btn').addEventListener('click', () => {
        if (confirm('Reset progress for this subject? This cannot be undone.')) {
            answered = {};
            bookmarks = {};
            currentIndex = 0;
            filterPosition = 0;
            localStorage.removeItem(k('answered'));
            localStorage.removeItem(k('currentIndex'));
            localStorage.removeItem(k('bookmarks'));
            applyFilter();
            renderQuestion();
            updateProgress();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (document.getElementById('stats-modal').style.display !== 'none') return;
        if (e.key === 'ArrowLeft') navigate(-1);
        if (e.key === 'ArrowRight') navigate(1);
        if (e.key === 'Enter' && !submitBtn.disabled) submitAnswer();
        if (e.key >= '1' && e.key <= '6') {
            const idx = parseInt(e.key) - 1;
            const q = questions[currentIndex];
            if (q && answered[currentIndex] === undefined && idx < q.options.length) selectOption(idx);
        }
    });

    switchSubject(startId);
}

// ---------- Theme ----------
function toggleTheme() {
    const html = document.documentElement;
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('mcq_theme', next);
    document.getElementById('theme-toggle').textContent = next === 'dark' ? '☀️' : '🌙';
}
function loadTheme() {
    const saved = localStorage.getItem('mcq_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    document.getElementById('theme-toggle').textContent = saved === 'dark' ? '☀️' : '🌙';
}

// ---------- Shuffle ----------
function toggleShuffle() {
    shuffled = !shuffled;
    document.getElementById('shuffle-toggle').classList.toggle('active', shuffled);
    applyFilter();
    filterPosition = 0;
    currentIndex = filteredIndices && filteredIndices.length ? filteredIndices[0] : 0;
    renderQuestion();
}

// ---------- Filter ----------
function applyFilter() {
    const filter = currentFilter;
    let indices = [];
    for (let i = 0; i < questions.length; i++) {
        if (filter === 'all') indices.push(i);
        else if (filter === 'unanswered' && answered[i] === undefined) indices.push(i);
        else if (filter === 'incorrect') {
            if (answered[i] !== undefined && !isAnswerCorrect(questions[i], answered[i])) indices.push(i);
        }
        else if (filter === 'bookmarked' && bookmarks[i]) indices.push(i);
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
        const pos = indices.indexOf(currentIndex);
        if (pos !== -1) filterPosition = pos;
        else currentIndex = indices[0];
    }
}

// ---------- Navigation ----------
function navigate(direction) {
    if (!filteredIndices || filteredIndices.length === 0) return;
    filterPosition += direction;
    if (filterPosition < 0) filterPosition = 0;
    if (filterPosition >= filteredIndices.length) filterPosition = filteredIndices.length - 1;
    currentIndex = filteredIndices[filterPosition];
    renderQuestion();
    saveProgress();
}

// ---------- Section nav ----------
function buildSectionNav() {
    const sections = [...new Set(questions.map(q => q.section))];
    sectionList.innerHTML = '';
    sections.forEach(section => {
        const li = document.createElement('li');
        li.textContent = section;
        li.dataset.section = section;
        li.title = section;
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
    if (!questions[currentIndex]) return;
    const currentSection = questions[currentIndex].section;
    document.querySelectorAll('.sidebar ul li').forEach(li => {
        li.classList.toggle('active', li.dataset.section === currentSection);
    });
}

// ---------- Render ----------
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
    selectedSet = new Set();

    const sata = isSATA(q);
    sectionBadge.textContent = q.section;
    questionText.textContent = `Q${currentIndex + 1}. ${q.question}` + (sata ? '  (Select all that apply)' : '');

    bookmarkBtn.textContent = bookmarks[currentIndex] ? '★' : '☆';
    bookmarkBtn.classList.toggle('bookmarked', !!bookmarks[currentIndex]);

    optionsContainer.innerHTML = '';
    q.options.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = 'option' + (sata ? ' sata' : '');
        div.innerHTML = `<span class="option-letter">${LETTERS[idx] || '?'}</span><span class="option-text">${opt}</span>`;
        div.addEventListener('click', () => selectOption(idx));
        optionsContainer.appendChild(div);
    });

    questionCounter.textContent = `Q${filterPosition + 1} of ${filteredIndices.length}`;
    prevBtn.disabled = prevBtnBottom.disabled = filterPosition === 0;
    nextBtn.disabled = nextBtnBottom.disabled = filterPosition === filteredIndices.length - 1;

    if (answered[currentIndex] !== undefined) {
        showResult(answered[currentIndex]);
    } else {
        resultBox.style.display = 'none';
        resultBox.className = 'result-box';
        submitBtn.style.display = 'block';
        submitBtn.textContent = sata ? 'Submit (Select all)' : 'Submit Answer';
        submitBtn.disabled = true;
    }
    updateSectionNav();
}

// ---------- Select ----------
function selectOption(idx) {
    if (answered[currentIndex] !== undefined) return;
    const q = questions[currentIndex];
    if (isSATA(q)) {
        if (selectedSet.has(idx)) selectedSet.delete(idx); else selectedSet.add(idx);
        optionsContainer.querySelectorAll('.option').forEach((opt, i) => {
            opt.classList.toggle('selected', selectedSet.has(i));
        });
        submitBtn.disabled = selectedSet.size === 0;
    } else {
        selectedOption = idx;
        optionsContainer.querySelectorAll('.option').forEach((opt, i) => {
            opt.classList.toggle('selected', i === idx);
        });
        submitBtn.disabled = false;
    }
}

// ---------- Submit ----------
function submitAnswer() {
    const q = questions[currentIndex];
    let stored;
    if (isSATA(q)) {
        if (selectedSet.size === 0) return;
        stored = [...selectedSet].sort((a, b) => a - b).join(',');
    } else {
        if (selectedOption === null) return;
        stored = selectedOption;
    }
    answered[currentIndex] = stored;
    showResult(stored);
    updateProgress();
    saveProgress();
    if (isAnswerCorrect(q, stored)) fireConfetti();
}

// ---------- Result ----------
function showResult(userVal) {
    const q = questions[currentIndex];
    const correct = new Set(correctIndices(q));
    const chosen = new Set(storedToIndices(userVal));
    const isCorrect = isAnswerCorrect(q, userVal);

    optionsContainer.querySelectorAll('.option').forEach((opt, i) => {
        opt.classList.add('disabled');
        opt.classList.remove('selected');
        if (correct.has(i)) opt.classList.add('correct');
        if (chosen.has(i) && !correct.has(i)) opt.classList.add('incorrect');
    });

    resultBox.style.display = 'block';
    if (isCorrect) {
        resultBox.className = 'result-box correct';
        resultHeader.textContent = '✅ Correct!';
    } else {
        resultBox.className = 'result-box incorrect';
        resultHeader.textContent = `❌ Incorrect. Correct answer: ${q.correct}.`;
    }
    rationaleEl.textContent = q.rationale;
    submitBtn.style.display = 'none';
}

// ---------- Bookmark ----------
function toggleBookmark() {
    bookmarks[currentIndex] = !bookmarks[currentIndex];
    if (!bookmarks[currentIndex]) delete bookmarks[currentIndex];
    bookmarkBtn.textContent = bookmarks[currentIndex] ? '★' : '☆';
    bookmarkBtn.classList.toggle('bookmarked', !!bookmarks[currentIndex]);
    saveBookmarks();
}

// ---------- Progress ----------
function updateProgress() {
    const total = questions.length;
    const answeredCount = Object.keys(answered).length;
    progressFill.style.width = `${total ? (answeredCount / total) * 100 : 0}%`;
    progressText.textContent = `${answeredCount} / ${total} answered`;

    let correct = 0;
    for (const [idx, val] of Object.entries(answered)) {
        if (questions[idx] && isAnswerCorrect(questions[idx], val)) correct++;
    }
    scoreText.textContent = answeredCount > 0
        ? `${correct}/${answeredCount} correct (${Math.round(correct / answeredCount * 100)}%)` : '';
}

// ---------- Stats ----------
function showStats() {
    const total = questions.length;
    const answeredCount = Object.keys(answered).length;
    let correct = 0;
    for (const [idx, val] of Object.entries(answered)) {
        if (questions[idx] && isAnswerCorrect(questions[idx], val)) correct++;
    }
    const incorrect = answeredCount - correct;
    const unanswered = total - answeredCount;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-correct').textContent = correct;
    document.getElementById('stat-incorrect').textContent = incorrect;
    document.getElementById('stat-unanswered').textContent = unanswered;
    document.getElementById('stat-percentage').textContent = answeredCount > 0
        ? `${Math.round(correct / answeredCount * 100)}% accuracy` : 'No answers yet';

    const sections = [...new Set(questions.map(q => q.section))];
    const breakdown = document.getElementById('section-breakdown');
    breakdown.innerHTML = '';
    sections.forEach(sec => {
        let secCorrect = 0, secAnswered = 0;
        questions.forEach((q, i) => {
            if (q.section !== sec) return;
            if (answered[i] !== undefined) {
                secAnswered++;
                if (isAnswerCorrect(q, answered[i])) secCorrect++;
            }
        });
        const pct = secAnswered > 0 ? Math.round(secCorrect / secAnswered * 100) : 0;
        const row = document.createElement('div');
        row.className = 'breakdown-row';
        row.innerHTML = `
            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${sec}">${sec}</span>
            <span style="margin-left:0.5rem;white-space:nowrap;">${secCorrect}/${secAnswered}</span>
            <div class="breakdown-bar"><div class="breakdown-fill" style="width:${pct}%"></div></div>`;
        breakdown.appendChild(row);
    });
    document.getElementById('stats-modal').style.display = 'flex';
}

// ---------- Confetti ----------
function fireConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = [];
    const colors = ['#00a86b', '#004d99', '#ffc107', '#dc3545', '#6f42c1', '#ff6b6b'];
    for (let i = 0; i < 80; i++) {
        particles.push({
            x: Math.random() * canvas.width, y: -10,
            vx: (Math.random() - 0.5) * 8, vy: Math.random() * 4 + 2,
            size: Math.random() * 8 + 4, color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360, rotSpeed: (Math.random() - 0.5) * 10, life: 1
        });
    }
    let frame = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        particles.forEach(p => {
            if (p.life <= 0) return;
            alive = true;
            p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.rotation += p.rotSpeed; p.life -= 0.012;
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation * Math.PI / 180);
            ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6); ctx.restore();
        });
        frame++;
        if (alive && frame < 120) requestAnimationFrame(animate);
        else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    animate();
}

document.addEventListener('DOMContentLoaded', init);
