// =========================================================================
// LEÇONS DE CONVERSATION — HSK 1
// Chaque réplique n'emploie que des mots du vocabulaire HSK 1 (294 entrées).
// Aucune dépendance, aucun build step. Données : lessons/hsk1.json
// =========================================================================

// -------------------------------------------------------------------------
// I18N
// -------------------------------------------------------------------------
// Escapes a value before it is interpolated into an HTML template.
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const I18N = {
  fr: {
    navHome:      'Accueil',
    navDict:      'Dictionnaire',
    navQuiz:      'Quiz d\'images',
    navLessons:   'Leçons',
    tagline: 'apprendre le chinois, un caractère à la fois',
    back: "← Retour à l'app",
    navTitle: 'Leçons de conversation',
    navNote: 'vocabulaire HSK 1 uniquement',
    pinyin: 'Pinyin',
    trans: 'Traduction',
    playAll: 'Écouter',
    stop: 'Arrêter',
    markReviewed: 'Marquer comme revu',
    markUnreviewed: 'À revoir',
    vocab: 'Vocabulaire de la leçon',
    grammar: 'Grammaire de la leçon',
    tagNew: 'Nouveau',
    tagReuse: 'Nouvel emploi',
    tagReuseHint: 'Ce mot est déjà apparu dans une leçon précédente, avec un autre emploi.',
    listenExample: 'Écouter l’exemple',
    home: 'Accueil',
    footerNote: 'Dialogues restreints au vocabulaire HSK 1',
    lines: 'répliques',
    lessons: 'leçons',
    words: 'mots',
    reviewed: 'revu',
    nextLesson: 'Leçon suivante',
    upNext: 'À suivre',
    pathCount: (n, total) => `${n} / ${total} revues`,
  },
  en: {
    navHome:      'Home',
    navDict:      'Dictionary',
    navQuiz:      'Image quiz',
    navLessons:   'Lessons',
    tagline: 'learn Chinese, one character at a time',
    back: '← Back to the app',
    navTitle: 'Conversation lessons',
    navNote: 'HSK 1 vocabulary only',
    pinyin: 'Pinyin',
    trans: 'Translation',
    playAll: 'Listen',
    stop: 'Stop',
    markReviewed: 'Mark as reviewed',
    markUnreviewed: 'Needs review',
    vocab: 'Lesson vocabulary',
    grammar: 'Grammar of the lesson',
    tagNew: 'New',
    tagReuse: 'New use',
    tagReuseHint: 'This word appeared in an earlier lesson, with a different use.',
    listenExample: 'Listen to the example',
    home: 'Home',
    footerNote: 'Dialogues restricted to HSK 1 vocabulary',
    lines: 'lines',
    lessons: 'lessons',
    words: 'words',
    reviewed: 'reviewed',
    nextLesson: 'Next lesson',
    upNext: 'Up next',
    pathCount: (n, total) => `${n} / ${total} reviewed`,
  },
};

let lang = 'fr';
const t = (k) => (I18N[lang] && I18N[lang][k]) || k;



// -------------------------------------------------------------------------
// TON — sandhi : la logique vit dans lessons-pinyin.js (partagé avec les tests)
// -------------------------------------------------------------------------
const { phrasePinyin } = window.LessonsPinyin;

// -------------------------------------------------------------------------
// SPEECH — voir speech.js (voix chinoise du système, message clair si elle manque)
// -------------------------------------------------------------------------
const speak = (text, opts) => Speech.speak(text, opts);
/** Fichier audio d'une réplique (voir scripts/build_audio.py). */
const lineSrc = (lesson, i) => `audio/l/${lesson.id}-${i}.mp3`;
const stopSpeech = () => Speech.stop();

// -------------------------------------------------------------------------
// DATA
// -------------------------------------------------------------------------
const LESSONS_URL = 'lessons/hsk1.json';
const VOCAB_URL   = 'lessons/hsk1-vocab.json';
const GRAMMAR_URL = 'lessons/hsk1-grammar.json';
const STORE_KEY   = 'xuehanyu.lessons.v1';

let LESSONS = [];
let VOCAB = {};
let GRAMMAR = [];
let currentLesson = 0;
let showPinyin = true;
let showTrans = true;
let reviewed = new Set();
let playing = false;
let playToken = 0;

// -------------------------------------------------------------------------
// PERSISTANCE — leçons revues
// -------------------------------------------------------------------------
function loadReviewed() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) reviewed = new Set(JSON.parse(raw).reviewed || []);
  } catch {}
}
function saveReviewed() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ reviewed: [...reviewed] }));
  } catch {}
}

// -------------------------------------------------------------------------
// RENDU
// -------------------------------------------------------------------------
const lessonList = document.getElementById('lessonList');
const dialogue   = document.getElementById('dialogue');
const vocabBox   = document.getElementById('vocab');
const grammarBox = document.getElementById('grammar');
const lessonSelect = document.getElementById('lessonSelect');
lessonSelect.addEventListener('change', () => selectLesson(Number(lessonSelect.value)));

/** First lesson not yet reviewed — the one to do next (-1 when all are done). */
function nextLessonIndex() {
  return LESSONS.findIndex(l => !reviewed.has(l.id));
}

function renderList() {
  const next = nextLessonIndex();
  const doneCount = LESSONS.filter(l => reviewed.has(l.id)).length;
  document.getElementById('pathCount').textContent = t('pathCount')(doneCount, LESSONS.length);
  document.getElementById('pathFill').style.width = (LESSONS.length ? (doneCount / LESSONS.length) * 100 : 0) + '%';

  lessonList.innerHTML = LESSONS.map((l, i) => {
    const done = reviewed.has(l.id);
    const cls = [i === currentLesson ? 'active' : '', done ? 'done' : '', i === next ? 'next' : ''].filter(Boolean).join(' ');
    return `<button type="button" class="lesson-item ${cls}" data-i="${i}"${i === currentLesson ? ' aria-current="true"' : ''}>
      <span class="lesson-node">${done ? '<i class="fa-solid fa-check"></i>' : i + 1}</span>
      <span class="lesson-item-title">${esc(l.title[lang])}</span>
      <span class="lesson-item-meta">${l.exchanges.length} ${t('lines')}${i === next ? `<span class="lesson-item-tag">${t('upNext')}</span>` : ''}</span>
    </button>`;
  }).join('');
  lessonSelect.innerHTML = LESSONS.map((l, i) =>
    `<option value="${i}"${i === currentLesson ? ' selected' : ''}>${String(i + 1).padStart(2, '0')} · ${esc(l.title[lang])}${reviewed.has(l.id) ? ' ✓' : ''}</option>`).join('');
  lessonList.querySelectorAll('.lesson-item').forEach(b =>
    b.addEventListener('click', () => selectLesson(Number(b.dataset.i))));
}

function renderDialogue() {
  const l = LESSONS[currentLesson];
  document.getElementById('lessonTitle').textContent = l.title[lang];
  const used = new Set(l.exchanges.flatMap(e => e.words));
  document.getElementById('lessonSub').textContent =
    `${l.exchanges.length} ${t('lines')} · ${used.size} ${t('words')} HSK 1`;

  dialogue.innerHTML = l.exchanges.map((e, i) => `
    <div class="exchange ${e.who === 'B' ? 'b' : 'a'}" data-i="${i}">
      <div class="exchange-who" aria-hidden="true">${esc(e.who)}</div>
      <div class="exchange-bubble">
        <div class="exchange-body">
          <div class="exchange-hanzi" lang="zh">${esc(e.hanzi)}</div>
          <div class="exchange-pinyin${showPinyin ? '' : ' hidden'}">${esc(phrasePinyin(e.pinyin))}</div>
          <div class="exchange-tr${showTrans ? '' : ' hidden'}">${esc(e[lang])}</div>
          <div class="exchange-chips">${e.words.map(w =>
            `<button type="button" class="chip" data-w="${esc(w)}">${esc(w)}</button>`).join('')}</div>
        </div>
        <button type="button" class="speak-btn" data-speak="${i}" title="${t('playAll')}" aria-label="${t('playAll')}">
          <i class="fa-solid fa-volume-high"></i>
        </button>
      </div>
    </div>`).join('');

  dialogue.querySelectorAll('[data-speak]').forEach(b =>
    b.addEventListener('click', () => {
      const lesson = LESSONS[currentLesson], i = Number(b.dataset.speak);
      speak(lesson.exchanges[i].hanzi, { src: lineSrc(lesson, i) });
    }));
  dialogue.querySelectorAll('.chip').forEach(c =>
    c.addEventListener('mouseenter', ev => showWordPop(ev, c.dataset.w)));
  dialogue.querySelectorAll('.chip').forEach(c =>
    c.addEventListener('mouseleave', hideWordPop));
  dialogue.querySelectorAll('.chip').forEach(c =>
    c.addEventListener('click', ev => { ev.stopPropagation(); showWordPop(ev, c.dataset.w, true); }));
}

function renderVocab() {
  const l = LESSONS[currentLesson];
  const seen = new Set();
  const items = [];
  for (const e of l.exchanges) {
    for (const w of e.words) {
      if (seen.has(w)) continue;
      seen.add(w);
      const v = VOCAB[w] || {};
      items.push(`<div class="vocab-item">
        <span class="vocab-char">${esc(w)}</span>
        <span class="vocab-pinyin">${esc(v.p)}</span>
        <span class="vocab-fr">${esc((v.fr || v.en || '').split(';')[0])}</span>
      </div>`);
    }
  }
  vocabBox.innerHTML = `<div class="lesson-vocab-title">${t('vocab')}</div>
    <div class="vocab-grid">${items.join('')}</div>`;
}

// -------------------------------------------------------------------------
// GRAMMAIRE — les points de la leçon, avec une phrase du dialogue pour exemple
// Données : lessons/hsk1-grammar.json (chaque exemple est vérifié par les tests : la phrase existe bien dans la leçon).
// « Nouveau » = aucune leçon précédente ne contient la construction ; sinon « Nouvel emploi ».
// -------------------------------------------------------------------------
/** Le mot-clé du point (regex `rx`) apparaît-il dans une leçon précédente ? null si le point n'a pas de repère. */
function grammarSeenBefore(point, lessonIndex) {
  if (!point.rx) return null;
  const rx = new RegExp(point.rx);
  return LESSONS.slice(0, lessonIndex).some(l => l.exchanges.some(e => rx.test(e.hanzi)));
}

/** La phrase avec la partie étudiée en évidence (échappée : le balisage est le nôtre). */
function highlightMark(hanzi, mark) {
  const i = hanzi.indexOf(mark);
  if (!mark || i < 0) return esc(hanzi);
  return esc(hanzi.slice(0, i)) + '<mark>' + esc(mark) + '</mark>' + esc(hanzi.slice(i + mark.length));
}

function renderGrammar() {
  const lesson = LESSONS[currentLesson];
  const points = lesson ? GRAMMAR.filter(p => p.lesson === lesson.id) : [];
  grammarBox.hidden = points.length === 0;
  if (!points.length) { grammarBox.innerHTML = ''; return; }
  grammarBox.innerHTML = `<div class="lesson-grammar-title" id="grammarTitle">${t('grammar')} <span class="count">${points.length}</span></div>
    <div class="grammar-list">${points.map(p => {
      const e = lesson.exchanges[p.line];
      const seen = grammarSeenBefore(p, currentLesson);
      const tag = seen === null ? '' : seen
        ? `<span class="gp-tag reuse" title="${esc(t('tagReuseHint'))}">${t('tagReuse')}</span>`
        : `<span class="gp-tag new">${t('tagNew')}</span>`;
      return `<article class="gp" data-gp="${esc(p.id)}">
        <div class="gp-head"><span class="gp-pattern" lang="zh">${esc(p.pattern)}</span>${tag}</div>
        <h3 class="gp-title">${esc(p.title[lang])}</h3>
        <p class="gp-text">${esc(p.text[lang])}</p>
        <button type="button" class="gp-example" data-line="${p.line}" aria-label="${esc(t('listenExample'))}">
          <i class="fa-solid fa-volume-high" aria-hidden="true"></i>
          <span class="gp-ex-body">
            <span class="gp-hanzi" lang="zh">${highlightMark(e.hanzi, p.mark)}</span>
            <span class="gp-pinyin${showPinyin ? '' : ' hidden'}">${esc(phrasePinyin(e.pinyin))}</span>
            <span class="gp-tr${showTrans ? '' : ' hidden'}">${esc(e[lang])}</span>
          </span>
        </button>
      </article>`;
    }).join('')}</div>`;

  grammarBox.querySelectorAll('.gp-example').forEach(b => b.addEventListener('click', () => {
    const i = Number(b.dataset.line);
    speak(lesson.exchanges[i].hanzi, { src: lineSrc(lesson, i) });
    // la même réplique dans le dialogue, brièvement en évidence
    dialogue.querySelectorAll('.exchange.speaking').forEach(el => el.classList.remove('speaking'));
    const row = dialogue.querySelector(`.exchange[data-i="${i}"]`);
    if (row) {
      row.classList.add('speaking');
      setTimeout(() => row.classList.remove('speaking'), 2200);
    }
  }));
}

// -------------------------------------------------------------------------
// POPUP MOT (signification d'un mot du vocabulaire)
// -------------------------------------------------------------------------
let pop = null;
function showWordPop(ev, w, sticky = false) {
  const v = VOCAB[w] || {};
  hideWordPop();
  pop = document.createElement('div');
  pop.className = 'word-pop';
  const meaning = (lang === 'fr' ? v.fr : v.en) || '';
  pop.innerHTML = `<b>${esc(w)}</b> ${v.p ? '· ' + esc(v.p) : ''}${meaning ? '<br>' + esc(meaning) : ''}`;
  document.body.appendChild(pop);
  const r = pop.getBoundingClientRect();
  const x = Math.min(Math.max(8, ev.clientX - r.width / 2), window.innerWidth - r.width - 8);
  const y = ev.clientY - r.height - 10 < 8 ? ev.clientY + 16 : ev.clientY - r.height - 10;
  pop.style.left = x + 'px';
  pop.style.top = y + 'px';
  if (sticky) {
    setTimeout(hideWordPop, 2600);
  }
}
function hideWordPop() {
  if (pop) { pop.remove(); pop = null; }
}

// -------------------------------------------------------------------------
// NAVIGATION / ACTIONS
// -------------------------------------------------------------------------
function selectLesson(i) {
  currentLesson = i;
  stopSpeech();
  playing = false;
  playToken++;
  updatePlayButton();
  renderList();
  renderDialogue();
  renderGrammar();
  renderVocab();
  updateReviewButton();
}

function updatePlayButton() {
  const btn = document.getElementById('btnPlay');
  btn.querySelector('span').textContent = playing ? t('stop') : t('playAll');
  btn.querySelector('i').className = playing ? 'fa-solid fa-stop' : 'fa-solid fa-play';
}

async function playConversation() {
  if (playing) { stopPlayback(); return; }
  playing = true;
  const token = ++playToken;
  updatePlayButton();
  const lines = LESSONS[currentLesson].exchanges;
  for (let i = 0; i < lines.length; i++) {
    if (token !== playToken) return;
    dialogue.querySelectorAll('.exchange').forEach(el => el.classList.remove('speaking'));
    const row = dialogue.querySelector(`.exchange[data-i="${i}"]`);
    if (row) {
      row.classList.add('speaking');
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    // wait for the voice to finish, then a short beat, before moving on and scrolling
    const spoken = await speak(lines[i].hanzi, { src: lineSrc(LESSONS[currentLesson], i) });
    if (token !== playToken) return;
    if (spoken === 'no-voice') { stopPlayback(); return; }   // inutile de dérouler tout le dialogue en silence
    await new Promise(r => setTimeout(r, 450));
  }
  if (token === playToken) {
    playing = false;
    updatePlayButton();
    dialogue.querySelectorAll('.exchange').forEach(el => el.classList.remove('speaking'));
  }
}
function stopPlayback() {
  playing = false;
  playToken++;
  stopSpeech();
  updatePlayButton();
  dialogue.querySelectorAll('.exchange').forEach(el => el.classList.remove('speaking'));
}

function toggleReviewed() {
  const id = LESSONS[currentLesson].id;
  if (reviewed.has(id)) reviewed.delete(id);
  else {
    reviewed.add(id);
    // counts toward today's goal (in words) and the streak: every distinct word of the lesson
    if (typeof Progress !== 'undefined') {
      const l = LESSONS[currentLesson];
      Progress.add(new Set(l.exchanges.flatMap(e => e.words)).size);
    }
  }
  saveReviewed();
  renderList();
  updateReviewButton();
}
function updateReviewButton() {
  const btn = document.getElementById('btnReview');
  const done = reviewed.has(LESSONS[currentLesson].id);
  btn.querySelector('span').textContent = done ? t('reviewed') : t('markReviewed');
  btn.classList.toggle('active', done);
  btn.classList.toggle('done', done);
  btn.setAttribute('aria-pressed', String(done));
  btn.querySelector('i').className = done ? 'fa-solid fa-circle-check' : 'fa-solid fa-check';
  // offer the way forward once this lesson is done
  const next = document.getElementById('btnNext');
  next.hidden = !(done && currentLesson < LESSONS.length - 1);
}

// -------------------------------------------------------------------------
// LANGUE
// -------------------------------------------------------------------------
function setLang(l) {
  lang = l;
  document.documentElement.lang = l;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = I18N[l][el.dataset.i18n];
    if (v) el.textContent = v;
  });
  document.querySelectorAll('.lang-switch button').forEach(b =>
    b.classList.toggle('active', b.dataset.lang === l));
  document.getElementById('footerNote').textContent = t('footerNote');
  renderList();
  renderDialogue();
  renderGrammar();
  renderVocab();
  updateReviewButton();
}

// -------------------------------------------------------------------------
// INIT
// -------------------------------------------------------------------------
async function init() {
  loadReviewed();
  try {
    const [lr, vr, gr] = await Promise.all([
      fetch(LESSONS_URL).then(r => r.json()),
      fetch(VOCAB_URL).then(r => r.json()),
      fetch(GRAMMAR_URL).then(r => r.json()).catch(() => ({ points: [] })),   // la grammaire est un plus : sans elle, la leçon reste complète
    ]);
    LESSONS = lr.lessons || [];
    VOCAB = vr.words || {};
    GRAMMAR = gr.points || [];
    document.getElementById('lessonVersion').textContent =
      `${LESSONS.length} ${t('lessons')} · ${Object.keys(VOCAB).length} ${t('words')} HSK 1`;
  } catch (err) {
    dialogue.innerHTML = `<div class="loading">${lang === 'fr' ? 'Chargement impossible.' : 'Could not load.'}</div>`;
    return;
  }
  // resume where the learner left off: the first lesson not reviewed yet
  const start = nextLessonIndex();
  if (start > 0) currentLesson = start;
  renderList();
  renderDialogue();
  renderGrammar();
  renderVocab();
  updateReviewButton();
}

document.getElementById('btnNext').addEventListener('click', () => {
  selectLesson(currentLesson + 1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
document.getElementById('btnPinyin').addEventListener('click', e => {
  showPinyin = !showPinyin;
  e.currentTarget.classList.toggle('active', showPinyin);
  e.currentTarget.setAttribute('aria-pressed', showPinyin);
  renderDialogue();
  renderGrammar();
});
document.getElementById('btnTrans').addEventListener('click', e => {
  showTrans = !showTrans;
  e.currentTarget.classList.toggle('active', showTrans);
  e.currentTarget.setAttribute('aria-pressed', showTrans);
  renderDialogue();
  renderGrammar();
});
document.getElementById('btnPlay').addEventListener('click', playConversation);
document.getElementById('btnReview').addEventListener('click', toggleReviewed);
document.querySelectorAll('.lang-switch button').forEach(b =>
  b.addEventListener('click', () => setLang(b.dataset.lang)));

init();
