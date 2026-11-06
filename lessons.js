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
    hideTrans: 'Masquer la traduction',
    showTrans: 'Afficher la traduction',
    playAll: 'Écouter',
    stop: 'Arrêter',
    markReviewed: 'Marquer comme revu',
    markUnreviewed: 'À revoir',
    vocab: 'Vocabulaire de la leçon',
    home: 'Accueil',
    footerNote: 'Dialogues restreints au vocabulaire HSK 1',
    lines: 'répliques',
    lessons: 'leçons',
    words: 'mots',
    reviewed: 'revu',
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
    hideTrans: 'Hide translation',
    showTrans: 'Show translation',
    playAll: 'Listen',
    stop: 'Stop',
    markReviewed: 'Mark as reviewed',
    markUnreviewed: 'Needs review',
    vocab: 'Lesson vocabulary',
    home: 'Home',
    footerNote: 'Dialogues restricted to HSK 1 vocabulary',
    lines: 'lines',
    lessons: 'lessons',
    words: 'words',
    reviewed: 'reviewed',
  },
};

let lang = 'fr';
const t = (k) => (I18N[lang] && I18N[lang][k]) || k;

// -------------------------------------------------------------------------
// PAPER BACKGROUND — identique à app.js / quiz.js (texture papier)
// -------------------------------------------------------------------------
const paperCanvas = document.getElementById('paper-bg');
const pctx = paperCanvas.getContext('2d');

function buildPaper() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  paperCanvas.width  = W * dpr;
  paperCanvas.height = H * dpr;
  paperCanvas.style.width  = W + 'px';
  paperCanvas.style.height = H + 'px';
  pctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const grad = pctx.createRadialGradient(W*.45, H*.4, W*.1, W/2, H/2, Math.max(W,H)*.85);
  grad.addColorStop(0,   '#f0e4c5');
  grad.addColorStop(0.6, '#e3d2a8');
  grad.addColorStop(1,   '#c9b582');
  pctx.fillStyle = grad;
  pctx.fillRect(0, 0, W, H);

  const img = pctx.getImageData(0, 0, W*dpr, H*dpr);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random()-.5)*8;
    d[i]   = Math.max(0, Math.min(255, d[i]   + n));
    d[i+1] = Math.max(0, Math.min(255, d[i+1] + n));
    d[i+2] = Math.max(0, Math.min(255, d[i+2] + n*.85));
  }
  pctx.putImageData(img, 0, 0);

  const diag = Math.sqrt(W*W + H*H);
  for (const angle of [Math.PI/4, -Math.PI/4]) {
    const sy = angle > 0 ? -diag : diag;
    for (let dd = -diag; dd < diag; dd += 4) {
      const j = (Math.random()-.5)*1.8;
      pctx.strokeStyle = `rgba(140,110,70,${0.03+Math.random()*0.05})`;
      pctx.lineWidth = 1;
      pctx.beginPath();
      pctx.moveTo(dd, sy);
      pctx.lineTo(dd + diag * Math.tan(angle), sy + diag);
      pctx.stroke();
    }
  }
}
window.addEventListener('resize', buildPaper);
buildPaper();

// -------------------------------------------------------------------------
// TON — sandhi : la logique vit dans lessons-pinyin.js (partagé avec les tests)
// -------------------------------------------------------------------------
const { phrasePinyin } = window.LessonsPinyin;

// -------------------------------------------------------------------------
// SPEECH — même approche que quiz.js
// -------------------------------------------------------------------------
let speechUnlocked = false;
function unlockSpeech() {
  if (speechUnlocked) return;
  speechUnlocked = true;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch {}
}
['pointerdown', 'touchstart', 'keydown'].forEach(ev =>
  document.addEventListener(ev, unlockSpeech, { once: true, passive: true })
);

function speak(text) {
  const say = () => {
    const voices = speechSynthesis.getVoices();
    const zh = voices.find(v => v.lang && v.lang.startsWith('zh'));
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 0.8;
    if (zh) u.voice = zh;
    try { speechSynthesis.speak(u); } catch {}
  };
  if (speechSynthesis.getVoices().length) say();
  else {
    speechSynthesis.addEventListener('voiceschanged', say, { once: true });
    setTimeout(say, 1200);
  }
}
function stopSpeech() { try { speechSynthesis.cancel(); } catch {} }

// -------------------------------------------------------------------------
// DATA
// -------------------------------------------------------------------------
const LESSONS_URL = 'lessons/hsk1.json';
const VOCAB_URL   = 'lessons/hsk1-vocab.json';
const STORE_KEY   = 'xuehanyu.lessons.v1';

let LESSONS = [];
let VOCAB = {};
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

function renderList() {
  lessonList.innerHTML = LESSONS.map((l, i) => {
    const done = reviewed.has(l.id);
    return `<button class="lesson-item${i === currentLesson ? ' active' : ''}" data-i="${i}">
      <span class="lesson-item-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="lesson-item-title">${esc(l.title[lang])}</span>
      <span class="lesson-item-meta">${l.exchanges.length} ${t('lines')}</span>
      ${done ? `<span class="lesson-item-done">✓</span>` : ''}
    </button>`;
  }).join('');
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
      <div class="exchange-who">${esc(e.who)}</div>
      <div class="exchange-body">
        <div class="exchange-hanzi">${esc(e.hanzi)}</div>
        <div class="exchange-pinyin${showPinyin ? '' : ' hidden'}">${phrasePinyin(e.pinyin)}</div>
        <div class="exchange-tr${showTrans ? '' : ' hidden'}">${esc(e[lang])}</div>
        <div class="exchange-chips">${e.words.map(w =>
          `<span class="chip" data-w="${esc(w)}">${esc(w)}</span>`).join('')}</div>
      </div>
      <button class="speak-btn" data-speak="${i}" title="${t('playAll')}">
        <i class="fa-solid fa-volume-high"></i>
      </button>
    </div>`).join('');

  dialogue.querySelectorAll('[data-speak]').forEach(b =>
    b.addEventListener('click', () => { stopSpeech(); speak(LESSONS[currentLesson].exchanges[Number(b.dataset.speak)].hanzi); }));
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
  renderVocab();
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
    if (row) row.classList.add('speaking');
    speak(lines[i].hanzi);
    await new Promise(r => setTimeout(r, 1900));
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
  if (reviewed.has(id)) reviewed.delete(id); else reviewed.add(id);
  saveReviewed();
  renderList();
  updateReviewButton();
}
function updateReviewButton() {
  const btn = document.getElementById('btnReview');
  const done = reviewed.has(LESSONS[currentLesson].id);
  btn.querySelector('span').textContent = done ? t('markUnreviewed') : t('markReviewed');
  btn.classList.toggle('active', done);
  btn.querySelector('i').className = done ? 'fa-solid fa-rotate-left' : 'fa-solid fa-check';
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
  renderVocab();
  updateReviewButton();
}

// -------------------------------------------------------------------------
// INIT
// -------------------------------------------------------------------------
async function init() {
  loadReviewed();
  try {
    const [lr, vr] = await Promise.all([
      fetch(LESSONS_URL).then(r => r.json()),
      fetch(VOCAB_URL).then(r => r.json()),
    ]);
    LESSONS = lr.lessons || [];
    VOCAB = vr.words || {};
    document.getElementById('lessonVersion').textContent =
      `${LESSONS.length} ${t('lessons')} · ${Object.keys(VOCAB).length} ${t('words')} HSK 1`;
  } catch (err) {
    dialogue.innerHTML = `<div class="loading">${lang === 'fr' ? 'Chargement impossible.' : 'Could not load.'}</div>`;
    return;
  }
  renderList();
  renderDialogue();
  renderVocab();
  updateReviewButton();
}

document.getElementById('btnPinyin').addEventListener('click', e => {
  showPinyin = !showPinyin;
  e.currentTarget.classList.toggle('active', showPinyin);
  renderDialogue();
});
document.getElementById('btnTrans').addEventListener('click', e => {
  showTrans = !showTrans;
  e.currentTarget.classList.toggle('active', !showTrans);
  e.currentTarget.querySelector('span').textContent = showTrans ? t('hideTrans') : t('showTrans');
  renderDialogue();
});
document.getElementById('btnPlay').addEventListener('click', playConversation);
document.getElementById('btnReview').addEventListener('click', toggleReviewed);
document.querySelectorAll('.lang-switch button').forEach(b =>
  b.addEventListener('click', () => setLang(b.dataset.lang)));

init();
