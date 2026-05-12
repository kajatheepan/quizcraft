// ── PARSER ─────────────────────────────────────────────────────────────────

const DEMO_QUIZ = `===QUIZCRAFT FORMAT===

Q1. Which sublayer of the Data Link Layer is responsible for flow control and error detection?
TYPE: MCQ
A) Physical Layer
B) LLC (Logical Link Control)
C) MAC (Media Access Control)
D) Network Layer
ANSWER: B
EXPLANATION: The LLC sublayer handles flow control, error detection, and provides a uniform interface to the network layer regardless of the transmission medium.

Q2. The MAC address is ___ bits long.
TYPE: FILL
ANSWER: 48
EXPLANATION: MAC addresses are 48 bits (6 bytes) long, typically represented as six groups of two hexadecimal digits separated by colons or hyphens.

Q3. CSMA/CD can completely eliminate frame collisions on a network.
TYPE: TF
ANSWER: FALSE
EXPLANATION: CSMA/CD (Carrier Sense Multiple Access with Collision Detection) detects collisions after they occur and initiates retransmission, but it cannot prevent collisions from happening in the first place.

Q4. Which of the following is a characteristic of the Data Link Layer?
TYPE: MCQ
A) Routes packets across multiple networks
B) Converts data to electrical signals
C) Provides node-to-node data delivery
D) Assigns IP addresses to devices
ANSWER: C
EXPLANATION: The Data Link Layer (Layer 2) is responsible for node-to-node (hop-to-hop) delivery of frames between directly connected devices on the same network segment.

Q5. In CSMA/CD, after a collision is detected, each device waits a random amount of time before retransmitting.
TYPE: TF
ANSWER: TRUE
EXPLANATION: After detecting a collision, CSMA/CD uses a backoff algorithm — each device waits a random time interval before attempting to retransmit, reducing the chance of another immediate collision.

===END===`;

function parseQuiz(rawText) {
  const errors = [];
  const questions = [];

  if (!rawText || !rawText.trim()) {
    return { questions: [], errors: ['Input is empty.'] };
  }

  let text = rawText.trim();

  // Remove header/footer markers if present
  text = text.replace(/===QUIZCRAFT FORMAT===/gi, '').replace(/===END===/gi, '').trim();

  // Split into question blocks by Q\d+.
  const blocks = text.split(/(?=Q\d+\.)/g).map(b => b.trim()).filter(b => b.length > 0);

  if (blocks.length === 0) {
    return { questions: [], errors: ['No questions found. Make sure questions start with Q1., Q2., etc.'] };
  }

  blocks.forEach((block, idx) => {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    const qMatch = lines[0].match(/^Q(\d+)\.\s*(.+)/);
    if (!qMatch) {
      errors.push(`Block ${idx + 1}: Could not parse question number.`);
      return;
    }

    const qNum = parseInt(qMatch[1]);
    const questionText = qMatch[2].trim();

    let type = null;
    let options = {};
    let answer = null;
    let explanation = '';

    lines.slice(1).forEach(line => {
      const typeMatch = line.match(/^TYPE:\s*(.+)/i);
      if (typeMatch) { type = typeMatch[1].trim().toUpperCase(); return; }

      const optMatch = line.match(/^([A-D])\)\s*(.+)/);
      if (optMatch) { options[optMatch[1]] = optMatch[2].trim(); return; }

      const ansMatch = line.match(/^ANSWER:\s*(.+)/i);
      if (ansMatch) { answer = ansMatch[1].trim(); return; }

      const expMatch = line.match(/^EXPLANATION:\s*([\s\S]+)/i);
      if (expMatch) { explanation = expMatch[1].trim(); return; }
    });

    // Normalize type
    if (type === 'MCQ' || type === 'MULTIPLE CHOICE') type = 'MCQ';
    else if (type === 'FILL' || type === 'FILL IN THE BLANK' || type === 'FIB') type = 'FILL';
    else if (type === 'TF' || type === 'TRUE/FALSE' || type === 'TRUEFALSE') type = 'TF';

    // Validate
    if (!type) {
      errors.push(`Q${qNum}: Missing TYPE field.`);
      return;
    }
    if (!answer) {
      errors.push(`Q${qNum}: Missing ANSWER field.`);
      return;
    }
    if (type === 'MCQ' && Object.keys(options).length < 2) {
      errors.push(`Q${qNum}: MCQ requires at least 2 answer options (A, B, C, D).`);
      return;
    }
    if (type === 'TF') {
      const norm = answer.toUpperCase();
      if (norm !== 'TRUE' && norm !== 'FALSE') {
        errors.push(`Q${qNum}: TF answer must be TRUE or FALSE.`);
        return;
      }
      answer = norm;
    }
    if (type === 'MCQ') {
      answer = answer.toUpperCase();
      if (!options[answer]) {
        errors.push(`Q${qNum}: ANSWER "${answer}" does not match any option.`);
        return;
      }
    }

    questions.push({
      id: qNum,
      type,
      question: questionText,
      options: type === 'MCQ' ? options : {},
      answer,
      explanation,
      userAnswer: null,
      isCorrect: null,
    });
  });

  return { questions, errors };
}

// ── QUIZ ENGINE ─────────────────────────────────────────────────────────────

const QuizEngine = (() => {
  let state = {
    questions: [],
    original: [],
    current: 0,
    correct: 0,
    wrong: 0,
    skipped: 0,
    startTime: null,
    settings: {
      shuffle: true,
      shuffleOptions: true,
      explanationTiming: 'after',
      timer: false,
      timerSeconds: 30,
    },
    timerInterval: null,
    timerRemaining: 0,
    answered: false,
  };

  function fisherYates(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function shuffleOptions(q) {
    if (q.type !== 'MCQ') return q;
    const letters = Object.keys(q.options);
    const shuffled = fisherYates(letters);
    const newOptions = {};
    const letterMap = ['A', 'B', 'C', 'D'];
    shuffled.forEach((origLetter, i) => {
      newOptions[letterMap[i]] = q.options[origLetter];
    });
    // Remap answer
    const origAnswerText = q.options[q.answer];
    const newAnswerLetter = Object.keys(newOptions).find(k => newOptions[k] === origAnswerText);
    return { ...q, options: newOptions, answer: newAnswerLetter };
  }

  function start(questions, settings) {
    state.settings = { ...state.settings, ...settings };
    state.original = questions.map(q => ({ ...q }));

    let qs = questions.map(q => ({ ...q, userAnswer: null, isCorrect: null }));
    if (state.settings.shuffle) qs = fisherYates(qs);
    if (state.settings.shuffleOptions) qs = qs.map(q => shuffleOptions(q));

    state.questions = qs;
    state.current = 0;
    state.correct = 0;
    state.wrong = 0;
    state.skipped = 0;
    state.startTime = Date.now();
    state.answered = false;
  }

  function currentQuestion() {
    return state.questions[state.current] || null;
  }

  function answer(response) {
    const q = currentQuestion();
    if (!q || state.answered) return false;
    state.answered = true;
    clearTimerInterval();

    q.userAnswer = response;

    if (q.type === 'MCQ') {
      q.isCorrect = response.toUpperCase() === q.answer.toUpperCase();
    } else if (q.type === 'TF') {
      q.isCorrect = response.toUpperCase() === q.answer.toUpperCase();
    } else if (q.type === 'FILL') {
      q.isCorrect = response.trim().toLowerCase() === q.answer.trim().toLowerCase();
    }

    if (q.isCorrect) state.correct++;
    else state.wrong++;

    return q.isCorrect;
  }

  function skip() {
    const q = currentQuestion();
    if (!q || state.answered) return;
    state.answered = true;
    clearTimerInterval();
    q.userAnswer = null;
    q.isCorrect = null;
    state.skipped++;
  }

  function next() {
    if (state.current < state.questions.length - 1) {
      state.current++;
      state.answered = false;
      return true;
    }
    return false;
  }

  function finish() {
    clearTimerInterval();
    return {
      questions: state.questions,
      correct: state.correct,
      wrong: state.wrong,
      skipped: state.skipped,
      total: state.questions.length,
      percentage: Math.round((state.correct / state.questions.length) * 100),
    };
  }

  function retry() {
    start(state.original, state.settings);
  }

  function startTimer(onTick, onExpire) {
    clearTimerInterval();
    state.timerRemaining = state.settings.timerSeconds;
    onTick(state.timerRemaining);
    state.timerInterval = setInterval(() => {
      state.timerRemaining--;
      onTick(state.timerRemaining);
      if (state.timerRemaining <= 0) {
        clearTimerInterval();
        onExpire();
      }
    }, 1000);
  }

  function clearTimerInterval() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function getState() { return state; }

  return { start, currentQuestion, answer, skip, next, finish, retry, startTimer, clearTimerInterval, getState };
})();

// ── LOCAL STORAGE ────────────────────────────────────────────────────────────

const Store = (() => {
  const KEY = 'quizcraft';

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch { return {}; }
  }

  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
  }

  function getAll() { return load(); }

  function getHistory() { return load().history || []; }

  function saveHistory(entry) {
    const data = load();
    const history = data.history || [];
    history.unshift(entry);
    if (history.length > 10) history.pop();
    save({ ...data, history });
  }

  function saveLastQuizText(text) {
    const data = load();
    save({ ...data, lastQuizText: text });
  }

  function getLastQuizText() { return load().lastQuizText || ''; }

  function savePreferences(prefs) {
    const data = load();
    save({ ...data, preferences: { ...(data.preferences || {}), ...prefs } });
  }

  function getPreferences() { return load().preferences || {}; }

  return { getAll, getHistory, saveHistory, saveLastQuizText, getLastQuizText, savePreferences, getPreferences };
})();

// ── UI / VIEW MANAGER ────────────────────────────────────────────────────────

const Views = (() => {
  const historyStack = [];
  let currentView = null;

  function showView(name, pushHistory = true) {
    const all = document.querySelectorAll('[data-view]');
    const target = document.querySelector(`[data-view="${name}"]`);
    if (!target) return;

    if (currentView && pushHistory && currentView !== name) {
      historyStack.push(currentView);
    }

    all.forEach(v => {
      v.classList.remove('active');
    });

    target.style.opacity = '0';
    target.classList.add('active');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        target.style.opacity = '1';
      });
    });

    currentView = name;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function back(fallback = 'home') {
    const prev = historyStack.pop() || fallback;
    showView(prev, false);
  }

  function getCurrent() { return currentView; }

  return { showView, back, getCurrent, historyStack };
})();

// ── TOAST ────────────────────────────────────────────────────────────────────

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
  }, 2000);
}

// ── PROMPT GENERATOR ─────────────────────────────────────────────────────────

const PromptGen = (() => {
  let debounceTimer = null;
  let activeTypes = new Set(['MCQ', 'FILL', 'TF']);
  let difficulty = 'Medium';
  let count = 20;

  function buildPrompt(subject, countVal, types, diff, focus) {
    const subjectStr = subject.trim() || '[YOUR TOPIC]';
    const typeList = [...types].join(', ') || 'MCQ';
    const focusStr = focus.trim();

    return `You are a quiz generator. Create a practice quiz in EXACTLY the format below. Do not deviate from this format.

Topic: ${subjectStr}
Number of questions: ${countVal}
Question types: ${typeList}
Difficulty: ${diff}${focusStr ? `\nFocus areas: ${focusStr}` : ''}

OUTPUT FORMAT (follow exactly):

===QUIZCRAFT FORMAT===

Q1. [Question text here]
TYPE: MCQ
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
ANSWER: [A/B/C/D]
EXPLANATION: [Brief explanation of the correct answer]

Q2. [Question text here]
TYPE: FILL
ANSWER: [Exact answer — single word or short phrase]
EXPLANATION: [Brief explanation]

Q3. [Question text here]
TYPE: TF
ANSWER: [TRUE or FALSE]
EXPLANATION: [Brief explanation]

[Continue for all ${countVal} questions...]

===END===

RULES:
- Every question MUST have TYPE, ANSWER, and EXPLANATION fields
- MCQ questions MUST have exactly 4 options: A, B, C, D
- FILL answers should be concise (1-3 words max)
- TF answers must be exactly TRUE or FALSE (uppercase)
- No extra text outside the format
- Number questions sequentially: Q1, Q2, Q3...`;
  }

  function renderPrompt() {
    const subject = document.getElementById('prompt-subject').value;
    const focus = document.getElementById('prompt-focus').value;
    const prompt = buildPrompt(subject, count, activeTypes, difficulty, focus);

    const box = document.getElementById('prompt-preview-box');
    // Highlight dynamic parts
    const highlighted = prompt
      .replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(
        /(Topic:|Number of questions:|Question types:|Difficulty:|Focus areas:)\s*(.+)/g,
        (_, label, val) => `${label} <span class="prompt-highlight">${val}</span>`
      );
    box.innerHTML = highlighted;
  }

  function debouncedRender() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(renderPrompt, 150);
  }

  function init() {
    // Subject / focus
    document.getElementById('prompt-subject').addEventListener('input', debouncedRender);
    document.getElementById('prompt-focus').addEventListener('input', debouncedRender);

    // Slider
    const slider = document.getElementById('prompt-count');
    const pill = document.getElementById('slider-pill');
    slider.addEventListener('input', () => {
      count = parseInt(slider.value);
      pill.textContent = `${count} questions`;
      debouncedRender();
    });

    // Type chips
    document.getElementById('type-chips').addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const t = chip.dataset.type;
      if (activeTypes.has(t)) {
        if (activeTypes.size > 1) {
          activeTypes.delete(t);
          chip.classList.remove('active');
        }
      } else {
        activeTypes.add(t);
        chip.classList.add('active');
      }
      debouncedRender();
    });

    // Difficulty segmented
    document.getElementById('difficulty-seg').addEventListener('click', e => {
      const btn = e.target.closest('.seg-btn');
      if (!btn) return;
      document.querySelectorAll('#difficulty-seg .seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      difficulty = btn.dataset.val;
      debouncedRender();
    });

    // Copy button
    document.getElementById('copy-prompt-btn').addEventListener('click', () => {
      const subject = document.getElementById('prompt-subject').value;
      const focus = document.getElementById('prompt-focus').value;
      const prompt = buildPrompt(subject, count, activeTypes, difficulty, focus);
      navigator.clipboard.writeText(prompt).then(() => {
        const btn = document.getElementById('copy-prompt-btn');
        btn.textContent = '✓ Copied!';
        setTimeout(() => { btn.textContent = 'Copy Prompt'; }, 2000);
        showToast('Prompt copied to clipboard');
      }).catch(() => {
        showToast('Copy failed — try selecting the text manually');
      });
    });

    // Go to input
    document.getElementById('go-to-input-from-prompt').addEventListener('click', e => {
      e.preventDefault();
      Views.showView('input');
    });

    renderPrompt();
  }

  return { init, renderPrompt };
})();

// ── QUIZ UI ──────────────────────────────────────────────────────────────────

const QuizUI = (() => {
  let parsedQuestions = [];
  let settings = {};
  let resultData = null;
  let reviewFilter = 'all';
  let lastQuizRawText = '';

  function getSettings() {
    return {
      shuffle: document.getElementById('toggle-shuffle').checked,
      shuffleOptions: document.getElementById('toggle-shuffle-opts').checked,
      explanationTiming: document.querySelector('[data-seg="explain"].active')?.dataset.val || 'after',
      timer: document.getElementById('toggle-timer').checked,
      timerSeconds: parseInt(document.getElementById('timer-seconds-input').value) || 30,
    };
  }

  function updateProgress() {
    const state = QuizEngine.getState();
    const pct = ((state.current) / state.questions.length) * 100;
    document.getElementById('quiz-progress-bar-inner').style.width = pct + '%';
  }

  function updateHeader() {
    const state = QuizEngine.getState();
    const q = QuizEngine.currentQuestion();
    if (!q) return;
    document.getElementById('quiz-counter').textContent = `${state.current + 1} / ${state.questions.length}`;
    document.getElementById('quiz-type-badge').textContent = q.type === 'FILL' ? 'Fill' : q.type;
    document.getElementById('quiz-score').textContent = `✓ ${state.correct}  ✗ ${state.wrong}`;
  }

  function renderQuestion() {
    const q = QuizEngine.currentQuestion();
    if (!q) return;

    document.getElementById('question-text').textContent = q.question;

    // Hide all answer areas
    document.getElementById('mcq-options').classList.add('hidden');
    document.getElementById('fill-area').classList.add('hidden');
    document.getElementById('tf-options').classList.add('hidden');
    document.getElementById('explanation-panel').classList.remove('visible', 'shown');
    document.getElementById('explanation-panel').style.display = 'none';
    document.getElementById('next-btn-area').classList.remove('visible');

    // Reset fill
    document.getElementById('fill-input').value = '';
    document.getElementById('fill-input').className = '';
    document.getElementById('fill-feedback').textContent = '';
    document.getElementById('fill-feedback').className = '';
    document.getElementById('fill-input').disabled = false;
    document.getElementById('fill-submit-btn').disabled = false;

    if (q.type === 'MCQ') renderMCQ(q);
    else if (q.type === 'FILL') renderFill();
    else if (q.type === 'TF') renderTF();

    updateHeader();
    updateProgress();
    startTimerIfEnabled();
  }

  function renderMCQ(q) {
    const container = document.getElementById('mcq-options');
    container.classList.remove('hidden');
    container.innerHTML = '';
    const letters = Object.keys(q.options);
    letters.forEach(letter => {
      const btn = document.createElement('button');
      btn.className = 'mcq-option';
      btn.dataset.val = letter;
      btn.setAttribute('aria-label', `Option ${letter}: ${q.options[letter]}`);
      btn.innerHTML = `<span class="option-letter">${letter}</span><span>${q.options[letter]}</span>`;
      btn.addEventListener('click', () => handleMCQAnswer(letter));
      container.appendChild(btn);
    });
  }

  function renderFill() {
    document.getElementById('fill-area').classList.remove('hidden');
    document.getElementById('fill-input').focus();
  }

  function renderTF() {
    document.getElementById('tf-options').classList.remove('hidden');
    document.getElementById('tf-true').classList.remove('correct', 'wrong', 'dimmed');
    document.getElementById('tf-false').classList.remove('correct', 'wrong', 'dimmed');
    document.getElementById('tf-true').disabled = false;
    document.getElementById('tf-false').disabled = false;
  }

  function handleMCQAnswer(letter) {
    if (QuizEngine.getState().answered) return;
    const isCorrect = QuizEngine.answer(letter);
    const q = QuizEngine.currentQuestion();
    const options = document.querySelectorAll('.mcq-option');

    options.forEach(btn => {
      btn.disabled = true;
      const val = btn.dataset.val;
      if (val === q.answer) {
        btn.classList.add('correct');
        btn.querySelector('.option-letter').textContent = '✓';
      } else if (val === letter && !isCorrect) {
        btn.classList.add('wrong');
        btn.querySelector('.option-letter').textContent = '✗';
      } else if (val !== letter && val !== q.answer) {
        btn.classList.add('dimmed');
      }
    });

    showPostAnswer(q);
  }

  function handleTFAnswer(val) {
    if (QuizEngine.getState().answered) return;
    const isCorrect = QuizEngine.answer(val);
    const q = QuizEngine.currentQuestion();
    const trueBtn = document.getElementById('tf-true');
    const falseBtn = document.getElementById('tf-false');
    trueBtn.disabled = true;
    falseBtn.disabled = true;

    const selectedBtn = val === 'TRUE' ? trueBtn : falseBtn;
    const otherBtn = val === 'TRUE' ? falseBtn : trueBtn;

    if (isCorrect) {
      selectedBtn.classList.add('correct');
    } else {
      selectedBtn.classList.add('wrong');
      // Show correct
      const correctBtn = q.answer === 'TRUE' ? trueBtn : falseBtn;
      correctBtn.classList.add('correct');
    }
    otherBtn.classList.add('dimmed');

    showPostAnswer(q);
  }

  function handleFillSubmit() {
    if (QuizEngine.getState().answered) return;
    const input = document.getElementById('fill-input');
    const val = input.value.trim();
    if (!val) return;

    const isCorrect = QuizEngine.answer(val);
    const q = QuizEngine.currentQuestion();
    input.disabled = true;
    document.getElementById('fill-submit-btn').disabled = true;

    const feedback = document.getElementById('fill-feedback');
    if (isCorrect) {
      input.classList.add('correct');
      feedback.textContent = '✓ Correct';
      feedback.className = 'correct';
    } else {
      input.classList.add('wrong');
      feedback.textContent = `✗ Answer: ${q.answer}`;
      feedback.className = 'wrong';
    }

    showPostAnswer(q);
  }

  function showPostAnswer(q) {
    const s = settings;
    if (s.explanationTiming === 'after' && q.explanation) {
      const panel = document.getElementById('explanation-panel');
      panel.style.display = 'block';
      document.getElementById('explanation-text').textContent = q.explanation;
      panel.classList.add('visible');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { panel.classList.add('shown'); });
      });
    }
    showNextBtn();
  }

  function showNextBtn() {
    const state = QuizEngine.getState();
    const area = document.getElementById('next-btn-area');
    area.classList.add('visible');
    const isLast = state.current === state.questions.length - 1;
    document.getElementById('next-btn').textContent = isLast ? 'See results →' : 'Next question →';
  }

  function advanceQuiz() {
    const canNext = QuizEngine.next();
    if (!canNext) {
      finishQuiz();
      return;
    }
    renderQuestion();
  }

  function finishQuiz() {
    resultData = QuizEngine.finish();

    // Save history
    const subject = (() => {
      const q = resultData.questions[0];
      if (!q) return 'Quiz';
      const words = q.question.split(' ').slice(0, 4).join(' ');
      return words;
    })();
    Store.saveHistory({
      date: new Date().toLocaleDateString(),
      topic: subject,
      score: resultData.correct,
      total: resultData.total,
      percentage: resultData.percentage,
    });

    renderResults(resultData);
    Views.showView('results');
  }

  function startTimerIfEnabled() {
    const timerEl = document.getElementById('quiz-timer');
    if (!settings.timer) {
      timerEl.classList.add('hidden');
      return;
    }
    timerEl.classList.remove('hidden');
    timerEl.classList.remove('warning');
    QuizEngine.startTimer(
      (remaining) => {
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
        if (remaining <= 10) timerEl.classList.add('warning');
        else timerEl.classList.remove('warning');
      },
      () => {
        // Time expired — auto-advance
        QuizEngine.skip();
        showNextBtn();
        timerEl.textContent = '0:00';
      }
    );
  }

  function renderResults(data) {
    document.getElementById('score-fraction').textContent = `${data.correct}/${data.total}`;
    document.getElementById('score-percent').textContent = `${data.percentage}%`;

    let msg = '';
    if (data.percentage >= 90) msg = 'Excellent work.';
    else if (data.percentage >= 70) msg = 'Good job — nearly there.';
    else if (data.percentage >= 50) msg = 'Keep reviewing.';
    else msg = 'More practice needed.';
    document.getElementById('score-message').textContent = msg;

    // Pills
    const pills = document.getElementById('stats-pills');
    pills.innerHTML = `
      <span class="stat-pill">✓ ${data.correct} correct</span>
      <span class="stat-pill">✗ ${data.wrong} wrong</span>
      <span class="stat-pill">— ${data.skipped} skipped</span>
    `;

    // Animate progress bar
    const fill = document.getElementById('results-progress-fill');
    fill.innerHTML = '';
    fill.style.width = '0%';
    const correctPct = (data.correct / data.total) * 100;
    const wrongPct = (data.wrong / data.total) * 100;
    const skipPct = (data.skipped / data.total) * 100;

    const c = document.createElement('div');
    c.className = 'rp-correct';
    c.style.width = correctPct + '%';
    const w = document.createElement('div');
    w.className = 'rp-wrong';
    w.style.width = wrongPct + '%';
    const sk = document.createElement('div');
    sk.className = 'rp-skip';
    sk.style.width = skipPct + '%';
    fill.appendChild(c); fill.appendChild(w); fill.appendChild(sk);

    setTimeout(() => {
      fill.style.width = '100%';
    }, 50);

    renderReview(data.questions, reviewFilter = 'all');
    document.querySelector('[data-filter="all"]').classList.add('active');
    document.querySelector('[data-filter="wrong"]').classList.remove('active');
  }

  function renderReview(questions, filter) {
    const list = document.getElementById('review-list');
    list.innerHTML = '';
    const filtered = filter === 'wrong'
      ? questions.filter(q => !q.isCorrect)
      : questions;

    filtered.forEach((q, idx) => {
      const isCorrect = q.isCorrect === true;
      const item = document.createElement('div');
      item.className = `review-item ${isCorrect ? 'correct' : 'wrong'}`;

      let userAnswerDisplay = '';
      if (q.type === 'MCQ' && q.userAnswer && q.options[q.userAnswer]) {
        userAnswerDisplay = `${q.userAnswer}) ${q.options[q.userAnswer]}`;
      } else if (q.userAnswer) {
        userAnswerDisplay = q.userAnswer;
      } else {
        userAnswerDisplay = '(skipped)';
      }

      let correctDisplay = '';
      if (!isCorrect) {
        if (q.type === 'MCQ' && q.options[q.answer]) {
          correctDisplay = `${q.answer}) ${q.options[q.answer]}`;
        } else {
          correctDisplay = q.answer;
        }
      }

      const explId = `explain-${idx}`;
      item.innerHTML = `
        <div class="review-item-header">
          <span class="review-icon ${isCorrect ? 'correct' : 'wrong'}">${isCorrect ? '✓' : '✗'}</span>
          <div>
            <p class="review-question">Q${q.id}. ${q.question}</p>
            <div class="review-answers">
              <div>Your answer: ${userAnswerDisplay}</div>
              ${!isCorrect ? `<div class="review-correct-ans">Correct: ${correctDisplay}</div>` : ''}
            </div>
            ${q.explanation ? `
              <button class="review-explain-toggle" data-target="${explId}">▾ Show explanation</button>
              <div class="review-explanation" id="${explId}">${q.explanation}</div>
            ` : ''}
          </div>
        </div>
      `;
      list.appendChild(item);
    });

    // Explanation toggles
    list.querySelectorAll('.review-explain-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.target);
        if (!target) return;
        const isOpen = target.classList.contains('open');
        target.classList.toggle('open', !isOpen);
        btn.textContent = isOpen ? '▾ Show explanation' : '▴ Hide explanation';
      });
    });
  }

  function startQuiz(raw) {
    lastQuizRawText = raw;
    const { questions, errors } = parseQuiz(raw);
    if (errors.length > 0 || questions.length === 0) return;
    parsedQuestions = questions;
    settings = getSettings();
    QuizEngine.start(questions, settings);
    Views.showView('quiz');
    renderQuestion();
  }

  function retryQuiz() {
    QuizEngine.retry();
    settings = getSettings();
    QuizEngine.getState().settings = settings;
    Views.showView('quiz');
    renderQuestion();
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (Views.getCurrent() !== 'quiz') return;
    if (QuizEngine.getState().answered) {
      if (e.key === 'Enter') { e.preventDefault(); advanceQuiz(); }
      return;
    }
    const q = QuizEngine.currentQuestion();
    if (!q) return;
    if (q.type === 'MCQ') {
      const map = { a: 'A', b: 'B', c: 'C', d: 'D' };
      const letter = map[e.key.toLowerCase()];
      if (letter && q.options[letter]) { handleMCQAnswer(letter); }
      if (e.key === 'Enter') { e.preventDefault(); }
    } else if (q.type === 'TF') {
      if (e.key.toLowerCase() === 't') handleTFAnswer('TRUE');
      if (e.key.toLowerCase() === 'f') handleTFAnswer('FALSE');
    } else if (q.type === 'FILL') {
      if (e.key === 'Enter') { e.preventDefault(); handleFillSubmit(); }
      if (e.key === 'Backspace') { document.getElementById('fill-input').value = ''; }
    }
  });

  return {
    startQuiz,
    retryQuiz,
    advanceQuiz,
    handleTFAnswer,
    handleFillSubmit,
    renderResults,
    renderReview,
    getResultData: () => resultData,
    getLastRaw: () => lastQuizRawText,
    getParsedQuestions: () => parsedQuestions,
  };
})();

// ── INIT ─────────────────────────────────────────────────────────────────────

(function init() {

  // ── NAV ──
  const logo = document.getElementById('nav-logo');
  logo.addEventListener('click', () => {
    if (Views.getCurrent() === 'quiz') {
      if (confirm('Quit quiz? Your progress will be lost.')) {
        QuizEngine.clearTimerInterval();
        Views.showView('home');
        renderHome();
      }
    } else {
      Views.showView('home');
      renderHome();
    }
  });
  logo.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') logo.click();
  });

  document.getElementById('nav-prompt-link').addEventListener('click', () => {
    Views.showView('prompt');
    PromptGen.renderPrompt();
  });

  const dropBtn = document.getElementById('ai-dropdown-btn');
  const dropMenu = document.getElementById('ai-dropdown-menu');
  dropBtn.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = dropMenu.classList.contains('open');
    dropMenu.classList.toggle('open', !isOpen);
    dropBtn.setAttribute('aria-expanded', String(!isOpen));
  });

  document.getElementById('dropdown-prompt-link').addEventListener('click', e => {
    e.preventDefault();
    dropMenu.classList.remove('open');
    dropBtn.setAttribute('aria-expanded', 'false');
    Views.showView('prompt');
    PromptGen.renderPrompt();
  });

  document.addEventListener('click', () => {
    dropMenu.classList.remove('open');
    dropBtn.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      dropMenu.classList.remove('open');
      dropBtn.setAttribute('aria-expanded', 'false');
    }
  });

  // ── HOME ──
  function renderHome() {
    const history = Store.getHistory();
    const section = document.getElementById('recent-section');
    const list = document.getElementById('recent-list');
    if (history.length === 0) {
      section.classList.add('hidden');
      return;
    }
    section.classList.remove('hidden');
    list.innerHTML = '';
    history.slice(0, 3).forEach(entry => {
      const row = document.createElement('div');
      row.className = 'recent-row';
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.setAttribute('aria-label', `${entry.topic} — ${entry.percentage}% on ${entry.date}`);
      row.innerHTML = `
        <span class="recent-row-name">${entry.topic}</span>
        <span class="recent-row-meta">
          <span class="recent-row-score">${entry.percentage}%</span>
          <span class="recent-row-date">${entry.date}</span>
        </span>
      `;
      list.appendChild(row);
    });
  }

  document.getElementById('home-btn-paste').addEventListener('click', () => {
    Views.showView('input');
    const saved = Store.getLastQuizText();
    if (saved) {
      const ta = document.getElementById('quiz-textarea');
      ta.value = saved;
      validateTextarea(saved);
    }
    loadPreferences();
  });

  document.getElementById('home-generate-btn').addEventListener('click', () => {
    Views.showView('prompt');
    PromptGen.renderPrompt();
  });

  // ── INPUT VIEW ──
  function loadPreferences() {
    const prefs = Store.getPreferences();
    if (prefs.shuffle !== undefined) document.getElementById('toggle-shuffle').checked = prefs.shuffle;
    if (prefs.shuffleOptions !== undefined) document.getElementById('toggle-shuffle-opts').checked = prefs.shuffleOptions;
    if (prefs.explanationTiming) {
      document.querySelectorAll('[data-seg="explain"]').forEach(b => {
        b.classList.toggle('active', b.dataset.val === prefs.explanationTiming);
      });
    }
    if (prefs.timer !== undefined) {
      document.getElementById('toggle-timer').checked = prefs.timer;
      document.getElementById('timer-seconds-input').classList.toggle('visible', prefs.timer);
    }
    if (prefs.timerSeconds) document.getElementById('timer-seconds-input').value = prefs.timerSeconds;
  }

  document.getElementById('input-back-btn').addEventListener('click', () => {
    Views.back('home');
  });

  let validateDebounce = null;
  function validateTextarea(val) {
    const badge = document.getElementById('detection-badge');
    const status = document.getElementById('textarea-status');
    const startBtn = document.getElementById('input-start-btn');
    const ta = document.getElementById('quiz-textarea');

    if (!val.trim()) {
      badge.classList.remove('visible');
      ta.classList.remove('valid', 'invalid');
      status.textContent = '';
      status.className = '';
      startBtn.disabled = true;
      return;
    }

    const { questions, errors } = parseQuiz(val);

    if (questions.length > 0 && errors.length === 0) {
      badge.textContent = `✓ ${questions.length} question${questions.length !== 1 ? 's' : ''}`;
      badge.classList.add('visible');
      ta.classList.remove('invalid');
      ta.classList.add('valid');
      status.textContent = 'Format looks good';
      status.className = 'success';
      startBtn.disabled = false;
    } else if (errors.length > 0) {
      badge.classList.remove('visible');
      ta.classList.remove('valid');
      ta.classList.add('invalid');
      status.textContent = errors[0];
      status.className = 'error';
      startBtn.disabled = true;
    } else {
      badge.classList.remove('visible');
      ta.classList.remove('valid', 'invalid');
      status.textContent = '';
      startBtn.disabled = true;
    }
  }

  document.getElementById('quiz-textarea').addEventListener('input', e => {
    clearTimeout(validateDebounce);
    validateDebounce = setTimeout(() => {
      const val = e.target.value;
      Store.saveLastQuizText(val);
      validateTextarea(val);
    }, 300);
  });

  // Settings toggle
  const settingsToggle = document.getElementById('settings-toggle');
  const settingsBody = document.getElementById('settings-body');
  const chevron = document.getElementById('settings-chevron');
  settingsToggle.addEventListener('click', () => {
    const isOpen = settingsBody.classList.contains('open');
    settingsBody.classList.toggle('open', !isOpen);
    chevron.classList.toggle('open', !isOpen);
    settingsToggle.setAttribute('aria-expanded', String(!isOpen));
    settingsBody.setAttribute('aria-hidden', String(isOpen));
  });
  settingsToggle.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') settingsToggle.click();
  });

  // Segmented controls (general)
  document.querySelectorAll('[data-seg]').forEach(btn => {
    btn.addEventListener('click', () => {
      const seg = btn.dataset.seg;
      document.querySelectorAll(`[data-seg="${seg}"]`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Timer toggle
  document.getElementById('toggle-timer').addEventListener('change', e => {
    const secInput = document.getElementById('timer-seconds-input');
    secInput.classList.toggle('visible', e.target.checked);
  });

  // Save preferences on change
  ['toggle-shuffle', 'toggle-shuffle-opts', 'toggle-timer'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      Store.savePreferences({
        shuffle: document.getElementById('toggle-shuffle').checked,
        shuffleOptions: document.getElementById('toggle-shuffle-opts').checked,
        timer: document.getElementById('toggle-timer').checked,
        timerSeconds: parseInt(document.getElementById('timer-seconds-input').value) || 30,
      });
    });
  });
  document.querySelectorAll('[data-seg="explain"]').forEach(b => {
    b.addEventListener('click', () => {
      Store.savePreferences({ explanationTiming: b.dataset.val });
    });
  });

  // Start quiz
  document.getElementById('input-start-btn').addEventListener('click', () => {
    const raw = document.getElementById('quiz-textarea').value;
    QuizUI.startQuiz(raw);
  });

  // Demo quiz
  document.getElementById('load-demo-btn').addEventListener('click', () => {
    const ta = document.getElementById('quiz-textarea');
    ta.value = DEMO_QUIZ;
    Store.saveLastQuizText(DEMO_QUIZ);
    validateTextarea(DEMO_QUIZ);
    showToast('Demo quiz loaded');
  });

  // ── QUIZ VIEW ──
  document.getElementById('tf-true').addEventListener('click', () => QuizUI.handleTFAnswer('TRUE'));
  document.getElementById('tf-false').addEventListener('click', () => QuizUI.handleTFAnswer('FALSE'));
  document.getElementById('fill-submit-btn').addEventListener('click', () => QuizUI.handleFillSubmit());
  document.getElementById('fill-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); QuizUI.handleFillSubmit(); }
  });
  document.getElementById('next-btn').addEventListener('click', () => QuizUI.advanceQuiz());

  // ── RESULTS VIEW ──
  document.getElementById('results-retry').addEventListener('click', () => {
    QuizUI.retryQuiz();
  });

  document.getElementById('results-new').addEventListener('click', () => {
    document.getElementById('quiz-textarea').value = '';
    document.getElementById('detection-badge').classList.remove('visible');
    document.getElementById('textarea-status').textContent = '';
    document.getElementById('textarea-status').className = '';
    document.getElementById('quiz-textarea').classList.remove('valid', 'invalid');
    document.getElementById('input-start-btn').disabled = true;
    Views.showView('input');
  });

  document.getElementById('results-share').addEventListener('click', () => {
    const data = QuizUI.getResultData();
    if (!data) return;
    const msg = `I scored ${data.percentage}% on a quiz! (${data.correct}/${data.total} correct) — QuizCraft AI`;
    navigator.clipboard.writeText(msg).then(() => {
      const btn = document.getElementById('results-share');
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 1500);
      showToast('Copied to clipboard!');
    }).catch(() => showToast('Could not copy'));
  });

  // Review filter
  document.getElementById('review-filter').addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    const filter = btn.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const data = QuizUI.getResultData();
    if (data) QuizUI.renderReview(data.questions, filter);
  });

  // ── PROMPT VIEW ──
  document.getElementById('prompt-back-btn').addEventListener('click', () => {
    Views.back('home');
  });

  PromptGen.init();

  // ── INITIAL RENDER ──
  renderHome();
  Views.showView('home', false);

})();
