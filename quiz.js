// =========================================================================
// QUIZ D'IMAGES — vocabulaire HSK 1
// Trois modes : flashcards, image → mot, mot → image.
// Aucune dépendance, aucun build step. Données : assets/img/index.json + assets/img/hsk<n>/manifest.json
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
    tagline:       'apprendre le chinois, un caractère à la fois',
    back:          '← Retour à l’app',
    lessonsLink:   'Leçons',
    home:          'Accueil',
    footerNote:    'Illustrations générées pour ce projet · vocabulaire HSK 1',
    modeCards:     'Cartes',
    modeImg2Word:  'Image → Mot',
    modeWord2Img:  'Mot → Image',
    loading:       'Chargement…',
    error:         'Erreur de chargement',
    listen:        'Écouter',
    correct:       'Correct !',
    wrong:         'Pas tout à fait',
    next:          'Suivant',
    again:         'Recommencer',
    backToCards:   'Retour aux cartes',
    knew:          'Je connais',
    review:        'À revoir',
    known:         'connu',
    toReview:      'à revoir',
    cardsHint:     'Faites défiler pour voir la traduction',
    score:         'Score',
    done:          'Terminé',
    summaryTitle:  'Session terminée',
    summaryScore:  (n, t) => `${n} / ${t}`,
    summaryGood:   'Très bien !',
    summaryMid:    'Bien joué, continuez.',
    summaryLow:    'Recommencez les cartes à revoir.',
    onlyReview:    'À revoir seulement',
    allWords:      'Tous les mots',
    wordCount:     (n) => `${n} mots`,
    tapToHear:     'Touchez pour entendre',
    correctIs:     (w) => `${w.char} — ${w.fr}`,
    tryAgain:      'Réessayer',
    noWords:       'Aucun mot à réviser pour l’instant.',
    due:           'Révisions',
    noDue:         'Rien à réviser pour le moment — reviens plus tard.',
    pickImage:     'Choisissez l’image qui correspond',
    pickWord:      'Choisissez le mot qui correspond',
  },
  en: {
    navHome:      'Home',
    navDict:      'Dictionary',
    navQuiz:      'Image quiz',
    navLessons:   'Lessons',
    tagline:       'learn Chinese, one character at a time',
    back:          '← Back to the app',
    lessonsLink:   'Lessons',
    home:          'Home',
    footerNote:    'Illustrations generated for this project · HSK 1 vocabulary',
    modeCards:     'Cards',
    modeImg2Word:  'Image → Word',
    modeWord2Img:  'Word → Image',
    loading:       'Loading…',
    error:         'Loading error',
    listen:        'Listen',
    correct:       'Correct!',
    wrong:         'Not quite',
    next:          'Next',
    again:         'Start over',
    backToCards:   'Back to cards',
    knew:          'I know it',
    review:        'Review',
    known:         'known',
    toReview:      'to review',
    cardsHint:     'Scroll down to see the translation',
    score:         'Score',
    done:          'Done',
    summaryTitle:  'Session complete',
    summaryScore:  (n, t) => `${n} / ${t}`,
    summaryGood:   'Excellent!',
    summaryMid:    'Well done, keep going.',
    summaryLow:    'Go back over the cards to review.',
    onlyReview:    'To review only',
    allWords:      'All words',
    wordCount:     (n) => `${n} words`,
    tapToHear:     'Tap to hear',
    correctIs:     (w) => `${w.char} — ${w.en}`,
    tryAgain:      'Try again',
    noWords:       'Nothing to review yet.',
    due:           'Due',
    noDue:         'Nothing due right now — come back later.',
    pickImage:     'Choose the matching image',
    pickWord:      'Choose the matching word',
  }
};

let lang = 'fr';
const t = () => I18N[lang];

/** Version du quiz — affichée dans le pied de page (repère de déploiement). */
const QUIZ_VERSION = '1.2';

function setVersion() {
  document.documentElement.dataset.quizVersion = QUIZ_VERSION;
  const v = document.getElementById('quizVersion');
  if (v) v.textContent = 'v' + QUIZ_VERSION;
  const n = document.getElementById('footerNote');
  if (n) {
    n.textContent = lang === 'fr'
      ? `Illustrations générées pour ce projet · vocabulaire HSK ${currentLevel}`
      : `Illustrations generated for this project · HSK ${currentLevel} vocabulary`;
  }
}

// -------------------------------------------------------------------------
// PAPER BACKGROUND — identique à app.js (texture papier)
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
      pctx.lineWidth = 0.4 + Math.random()*.4;
      pctx.beginPath();
      pctx.moveTo(dd+j, sy);
      pctx.lineTo(dd+j+Math.cos(angle)*diag*2, sy+Math.sin(angle)*diag*2);
      pctx.stroke();
    }
  }

  const bumpCount = Math.floor(W*H/20);
  for (let i = 0; i < bumpCount; i++) {
    const x = Math.random()*W, y = Math.random()*H, sz = 0.4+Math.random()*1.0;
    pctx.fillStyle = `rgba(110,80,50,${0.04+Math.random()*0.05})`;
    pctx.beginPath(); pctx.arc(x+.3, y+.3, sz, 0, Math.PI*2); pctx.fill();
    pctx.fillStyle = `rgba(255,240,200,${0.1+Math.random()*0.1})`;
    pctx.beginPath(); pctx.arc(x-.25, y-.25, sz*.85, 0, Math.PI*2); pctx.fill();
  }

  const patchCount = Math.floor(W*H/30000);
  for (let i = 0; i < patchCount; i++) {
    const x = Math.random()*W, y = Math.random()*H, r = 30+Math.random()*70;
    const pg = pctx.createRadialGradient(x,y,0,x,y,r);
    pg.addColorStop(0, `rgba(180,130,70,${0.05+Math.random()*0.06})`);
    pg.addColorStop(1, 'rgba(180,130,70,0)');
    pctx.fillStyle = pg;
    pctx.beginPath(); pctx.arc(x,y,r,0,Math.PI*2); pctx.fill();
  }

  const speckCount = Math.floor(W*H/25000);
  for (let i = 0; i < speckCount; i++) {
    pctx.fillStyle = `rgba(120,70,30,${0.25+Math.random()*0.3})`;
    pctx.beginPath(); pctx.arc(Math.random()*W, Math.random()*H, 0.5+Math.random()*0.9, 0, Math.PI*2); pctx.fill();
  }

  const vig = pctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.35,W/2,H/2,Math.max(W,H)*.75);
  vig.addColorStop(0, 'rgba(80,50,20,0)');
  vig.addColorStop(1, 'rgba(60,35,15,0.22)');
  pctx.fillStyle = vig;
  pctx.fillRect(0, 0, W, H);
}

window.addEventListener('resize', buildPaper);
buildPaper();

// -------------------------------------------------------------------------
// DATA
// -------------------------------------------------------------------------
const INDEX_URL   = 'assets/img/index.json';
const STORE_KEY   = 'xuehanyu.quiz.v1';
const SRS_KEY     = 'xuehanyu.srs.v1';

let LEVELS      = [];       // [{id, label, manifest, count}]
let LEVEL_WORDS = {};       // { 1: [...], 2: [...] }
let WORDS       = [];       // tous les mots — réserve de distracteurs
let deck  = [];
let idx   = 0;
let score = 0;
let mode  = 'cards';
let currentLevel = 1;
let answered = false;
let onlyReview = false;
let onlyDue = false;      // deck = every word whose review is due
let known = new Set();   // slugs que l'apprenant maîtrise
let cards = {};          // slug -> carte de répétition espacée (srs.js)

const stage   = document.getElementById('quizStage');
const progFill = document.getElementById('progressFill');
const progText = document.getElementById('progressText');
const scoreText = document.getElementById('scoreText');

function shuffle(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/**
 * Vivier des distracteurs : le niveau courant PLUS les niveaux précédents.
 * Le deck, lui, ne contient que les mots du niveau courant — mais les
 * distracteurs peuvent venir des niveaux déjà connus, ce qui les rend plus
 * discriminants et évite de tourner en rond sur un deck court.
 */
function pool() {
  const out = [];
  for (const lvl of LEVELS) {
    if (lvl.id > currentLevel) continue;
    out.push(...(LEVEL_WORDS[lvl.id] || []));
  }
  return out.length ? out : WORDS;
}

/** Mots du niveau courant : c'est le deck du quiz. */
function levelPool() {
  return LEVEL_WORDS[currentLevel] || pool();
}

/** Deux mots que l'apprenant ne peut pas distinguer sur l'image seule. */
function isConfusable(a, b) {
  if (!a || !b) return false;
  return (a.confusable || []).includes(b.slug) || (b.confusable || []).includes(a.slug);
}

/** Distracteurs : même catégorie d'abord (plus discriminant), jamais de paire indiscernable. */
function pickDistractors(word, n = 3) {
  const others  = pool().filter(w => w.slug !== word.slug && !isConfusable(word, w));
  const sameCat = others.filter(w => w.cat === word.cat);
  const rest    = others.filter(w => w.cat !== word.cat);
  // file prioritaire : la même catégorie d'abord, le reste complète si besoin
  const poolOrdered = shuffle(sameCat).concat(shuffle(rest));

  const picked = [];
  for (const w of poolOrdered) {
    // jamais deux options indiscernables l'une de l'autre dans le même jeu
    if (picked.some(p => isConfusable(p, w))) continue;
    picked.push(w);
    if (picked.length === n) break;
  }
  return picked;
}

// -------------------------------------------------------------------------
// SPEECH — même approche que app.js (synthèse vocale zh-CN)
//
// Sur iOS, speechSynthesis refuse de parler tant que l'utilisateur n'a pas
// interagi avec la page. On déverrouille donc la synthèse au premier geste
// (tap, clic, touche) : la lecture automatique fonctionne ensuite à chaque
// question. Le bouton « Écouter » fonctionne de toute façon.
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
    try {
      speechSynthesis.speak(u);
    } catch {}
  };
  if (speechSynthesis.getVoices().length) say();
  else {
    // les voix peuvent arriver tard : on écoute l'événement, avec un filet
    speechSynthesis.addEventListener('voiceschanged', say, { once: true });
    setTimeout(say, 1200);
  }
}

/** Coupe toute lecture en cours (changement de question). */
function stopSpeech() {
  try { speechSynthesis.cancel(); } catch {}
}

// -------------------------------------------------------------------------
// PERSISTANCE — mots maîtrisés (localStorage)
// -------------------------------------------------------------------------
function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (Array.isArray(d.known)) known = new Set(d.known);
  } catch {}
  try {
    const raw = localStorage.getItem(SRS_KEY);
    if (raw) cards = JSON.parse(raw) || {};
    // first run with the scheduler: words already marked as known join it
    else if (known.size) cards = SRS.seedFromKnown(known);
  } catch {}
}
function saveStore() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ known: [...known] }));
    localStorage.setItem(SRS_KEY, JSON.stringify(cards));
  } catch {}
}

/** Records one review of a word in the scheduler. */
function gradeWord(word, ok) {
  cards[word.slug] = SRS.grade(cards[word.slug], ok);
  saveStore();
  updateDueToggle();
}

// -------------------------------------------------------------------------
// RENDU
// -------------------------------------------------------------------------
function updateProgress() {
  const total = deck.length || 1;
  progFill.style.width = Math.min(100, (idx / total) * 100) + '%';
  progText.textContent = `${Math.min(idx + 1, deck.length)} / ${deck.length}`;
  scoreText.textContent = mode === 'cards' ? '' : `${t().score} ${score}`;
}

function speakButton(word, extraClass = '') {
  return `<button class="speak-btn ${extraClass}" id="speakBtn" title="${t().listen}">
            <i class="fa-solid fa-volume-high"></i><span>${t().listen}</span>
          </button>`;
}

function renderCards() {
  const w = deck[idx];
  const isKnown = known.has(w.slug);
  stage.innerHTML = `
    <div class="q-card card-flash">
      <div class="flash-image-wrap">
        <img src="assets/img/hsk${w.level}/${w.image}" alt="${esc(w.char)}" class="q-image" loading="eager">
        ${speakButton(w)}
      </div>
      <div class="flash-body">
        <div class="flash-hanzi">${esc(w.char)}</div>
        <div class="flash-pinyin">${esc(w.pinyin)}</div>
        <div class="flash-meaning">${esc(lang === 'fr' ? w.fr : w.en)}</div>
        <div class="flash-actions">
          <button class="q-btn ghost" id="btnReview">${t().review}</button>
          <button class="q-btn primary" id="btnKnew">${t().knew}</button>
        </div>
        <div class="flash-status">${isKnown
          ? `<i class="fa-solid fa-check"></i> ${t().known}`
          : `<i class="fa-solid fa-rotate-left"></i> ${t().toReview}`}</div>
      </div>
    </div>
    <div class="q-nav">
      <button class="q-btn" id="btnPrev"><i class="fa-solid fa-chevron-left"></i></button>
      <button class="q-btn" id="btnNext"><i class="fa-solid fa-chevron-right"></i></button>
    </div>`;

  document.getElementById('speakBtn').addEventListener('click', e => { e.stopPropagation(); speak(w.char); });
  document.getElementById('btnKnew').addEventListener('click', () => { known.add(w.slug); gradeWord(w, true); renderCards(); });
  document.getElementById('btnReview').addEventListener('click', () => { known.delete(w.slug); gradeWord(w, false); renderCards(); });
  document.getElementById('btnPrev').addEventListener('click', () => go(-1));
  document.getElementById('btnNext').addEventListener('click', () => go(1));
}

function renderImg2Word() {
  const w = deck[idx];
  const choices = shuffle([w, ...pickDistractors(w, 3)]);
  stage.innerHTML = `
    <p class="q-prompt">${t().pickWord}</p>
    <div class="q-card quiz-card">
      <div class="flash-image-wrap big">
        <img src="assets/img/hsk${w.level}/${esc(w.image)}" alt="" class="q-image">
        ${speakButton(w)}
      </div>
      <div class="choices choices-text" id="choices"></div>
    </div>`;

  const box = document.getElementById('choices');
  choices.forEach(c => {
    const b = document.createElement('button');
    b.className = 'choice';
    b.innerHTML = `<span class="choice-hanzi">${esc(c.char)}</span><span class="choice-pinyin">${esc(c.pinyin)}</span>`;
    b.addEventListener('click', () => answer(b, c.slug === w.slug, w, box));
    box.appendChild(b);
  });

  document.getElementById('speakBtn').addEventListener('click', () => speak(w.char));
  setTimeout(() => speak(w.char), 350);
}

function renderWord2Img() {
  const w = deck[idx];
  const choices = shuffle([w, ...pickDistractors(w, 3)]);
  stage.innerHTML = `
    <p class="q-prompt">${t().pickImage}</p>
    <div class="q-card quiz-card">
      <div class="word-head">
        <div class="flash-hanzi">${esc(w.char)}</div>
        <div class="flash-pinyin">${esc(w.pinyin)}</div>
        ${speakButton(w)}
      </div>
      <div class="choices choices-image" id="choices"></div>
    </div>`;

  const box = document.getElementById('choices');
  choices.forEach(c => {
    const b = document.createElement('button');
    b.className = 'choice choice-img';
    b.innerHTML = `<img src="assets/img/hsk${c.level}/${esc(c.image)}" alt="">`;
    b.addEventListener('click', () => answer(b, c.slug === w.slug, w, box));
    box.appendChild(b);
  });

  document.getElementById('speakBtn').addEventListener('click', () => speak(w.char));
  setTimeout(() => speak(w.char), 350);
}

function answer(btn, ok, word, box) {
  if (answered) return;
  answered = true;
  gradeWord(word, ok);
  if (ok) {
    score++;
    btn.classList.add('right');
  } else {
    btn.classList.add('wrong');
    box.querySelectorAll('.choice').forEach(c => {
      if (c.querySelector('.choice-hanzi')?.textContent === word.char) c.classList.add('right');
    });
  }
  updateProgress();

  const fb = document.createElement('div');
  fb.className = 'feedback ' + (ok ? 'ok' : 'ko');
  fb.innerHTML = `
    <div class="fb-title"><i class="fa-solid ${ok ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
      ${ok ? t().correct : t().wrong}</div>
    <div class="fb-meaning">${esc(lang === 'fr' ? word.fr : word.en)}</div>
    <button class="q-btn primary" id="btnCont">${t().next} <i class="fa-solid fa-arrow-right"></i></button>`;
  stage.appendChild(fb);
  fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('btnCont').addEventListener('click', () => go(1));
}

function renderSummary() {
  const total = deck.length;
  const ratio = total ? score / total : 0;
  const msg = ratio >= 0.8 ? t().summaryGood : ratio >= 0.5 ? t().summaryMid : t().summaryLow;
  stage.innerHTML = `
    <div class="q-card summary-card">
      <div class="summary-icon"><i class="fa-solid fa-flag-checkered"></i></div>
      <h2>${t().summaryTitle}</h2>
      <div class="summary-score">${t().summaryScore(score, total)}</div>
      <p class="summary-msg">${msg}</p>
      <div class="summary-actions">
        <button class="q-btn primary" id="btnAgain"><i class="fa-solid fa-rotate-right"></i> ${t().again}</button>
        <button class="q-btn" id="btnCards">${t().backToCards}</button>
      </div>
    </div>`;
  progFill.style.width = '100%';
  progText.textContent = t().done;
  scoreText.textContent = `${t().score} ${score} / ${total}`;
  document.getElementById('btnAgain').addEventListener('click', restart);
  document.getElementById('btnCards').addEventListener('click', () => setMode('cards'));
}

function render() {
  if (!deck.length) {
    stage.innerHTML = `<div class="q-card summary-card"><p class="summary-msg">${onlyDue ? t().noDue : t().noWords}</p></div>`;
    return;
  }
  if (idx >= deck.length) { renderSummary(); return; }
  answered = false;
  updateProgress();
  if (mode === 'cards')       renderCards();
  else if (mode === 'img2word') renderImg2Word();
  else                          renderWord2Img();
}

// -------------------------------------------------------------------------
// NAVIGATION
// -------------------------------------------------------------------------
function go(d) {
  stopSpeech();
  idx += d;
  if (idx < 0) idx = 0;
  render();
}

function restart() {
  idx = 0;
  score = 0;
  buildDeck();
  render();
}

function buildDeck() {
  if (onlyDue) {
    const now = Date.now();
    deck = shuffle(WORDS.filter(w => SRS.isDue(cards[w.slug], now)));
    return;
  }
  let words = levelPool();
  if (onlyReview) words = words.filter(w => !known.has(w.slug));
  deck = shuffle(words);
}

function setMode(m) {
  mode = m;
  idx = 0;
  score = 0;
  document.querySelectorAll('.mode-tab').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  buildDeck();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Change de niveau HSK : nouveau deck, nouveau score. */
function setLevel(level) {
  currentLevel = level;
  idx = 0;
  score = 0;
  document.querySelectorAll('.level-tab').forEach(b =>
    b.classList.toggle('active', Number(b.dataset.level) === level));
  buildDeck();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// -------------------------------------------------------------------------
// LANGUE
// -------------------------------------------------------------------------
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.dataset.i18n;
    if (t()[k]) el.textContent = t()[k];
  });
  document.documentElement.lang = lang;
  setVersion();
  updateReviewToggle();
  updateDueToggle();
  render();
}

document.querySelectorAll('.lang-switch button').forEach(btn => {
  btn.addEventListener('click', () => {
    lang = btn.dataset.lang;
    document.querySelectorAll('.lang-switch button').forEach(b => b.classList.toggle('active', b === btn));
    applyI18n();
  });
});

document.getElementById('modeTabs').addEventListener('click', e => {
  const btn = e.target.closest('.mode-tab');
  if (btn) setMode(btn.dataset.mode);
});

document.getElementById('levelTabs').addEventListener('click', e => {
  const btn = e.target.closest('.level-tab');
  if (btn) setLevel(Number(btn.dataset.level));
});

/** Filtre « à revoir seulement » : restreint ledeck aux mots non maîtrisés. */
const reviewToggle = document.getElementById('reviewToggle');
reviewToggle.addEventListener('click', () => {
  onlyReview = !onlyReview;
  reviewToggle.classList.toggle('active', onlyReview);
  restart();
});

const dueToggle = document.getElementById('dueToggle');
dueToggle.addEventListener('click', () => {
  onlyDue = !onlyDue;
  restart();
  updateDueToggle();
});

function updateDueToggle() {
  const lbl = document.getElementById('dueToggleLabel');
  if (lbl) lbl.textContent = `${t().due} (${SRS.dueCount(cards)})`;
  dueToggle.classList.toggle('active', onlyDue);
}

function updateReviewToggle() {
  const lbl = document.getElementById('reviewToggleLabel');
  if (lbl) lbl.textContent = onlyReview ? t().onlyReview : t().allWords;
  reviewToggle.classList.toggle('active', onlyReview);
}

// -------------------------------------------------------------------------
// INIT
// -------------------------------------------------------------------------
loadStore();

/** Charge l'index des niveaux puis le manifeste de chaque niveau. */
async function loadData() {
  const res = await fetch(INDEX_URL);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const index = await res.json();
  LEVELS = index.levels || [];

  for (const lvl of LEVELS) {
    const r = await fetch(`assets/img/${lvl.manifest}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const m = await r.json();
    LEVEL_WORDS[lvl.id] = (m.words || []).map(w => ({ ...w, level: lvl.id }));
  }
  WORDS = Object.values(LEVEL_WORDS).flat();
  if (!LEVEL_WORDS[currentLevel]) {
    currentLevel = LEVELS.length ? LEVELS[0].id : 1;
  }
}

/** Construit les onglets de niveau. */
function buildLevelTabs() {
  const box = document.getElementById('levelTabs');
  box.innerHTML = LEVELS.map(l => `
    <button class="level-tab${l.id === currentLevel ? ' active' : ''}" data-level="${l.id}">
      HSK ${l.id}<span class="level-count">${(LEVEL_WORDS[l.id] || []).length}</span>
    </button>`).join('');
}

(async function init() {
  try {
    await loadData();
    buildLevelTabs();
    buildDeck();
    applyI18n();          // langue + version + premier rendu
  } catch (err) {
    console.error(err);
    stage.innerHTML = `<div class="loading">${t().error}</div>`;
    setVersion();
  }
})();
