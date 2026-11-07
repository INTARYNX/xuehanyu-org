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
    next:          'Continuer',
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
    hubTitle:      'Pratique du jour',
    hubHint:       'Objectif : pratiquer 10 mots par jour. Chaque carte ou question répondue compte pour 1 mot ; une leçon revue compte pour tous ses mots. Pratique chaque jour pour garder ta série.',
    statStreak:    'jours de suite',
    statGoal:      'mots pratiqués aujourd’hui',
    statDue:       'mots à réviser',
    setupLevel:    'Niveau',
    setupMode:     'Exercice',
    modeCardsHint: 'Retrouve le mot, puis note-toi',
    modeImg2WordHint: 'Quel mot va avec l’image ?',
    modeWord2ImgHint: 'Quelle image va avec le mot ?',
    start:         'Commencer',
    dueTitle:      'Réviser maintenant',
    dueSub:        (n, total) => total > n ? `${n} mots sur ${total} en retard` : `${n} mots à revoir`,
    reveal:        'Afficher la réponse',
    keySpace:      'Espace',
    cardsPrompt:   'Tu reconnais ce mot ?',
    continue:      'Continuer',
    finish:        'Terminer',
    newSession:    'Nouvelle session',
    missedTitle:   'À retravailler',
    goalSub:       (n, g) => `${n} / ${g} mots aujourd’hui`,
    streakDays:    (n) => n === 1 ? '1 jour de suite' : `${n} jours de suite`,
    masteryText:   (n, total) => `${n} / ${total} connus`,
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
    next:          'Continue',
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
    hubTitle:      'Today’s practice',
    hubHint:       'Goal: practise 10 words a day. Each card or question answered counts as 1 word; a reviewed lesson counts all its words. Practise every day to keep your streak.',
    statStreak:    'day streak',
    statGoal:      'words practised today',
    statDue:       'words due',
    setupLevel:    'Level',
    setupMode:     'Exercise',
    modeCardsHint: 'Recall the word, then rate yourself',
    modeImg2WordHint: 'Which word matches the picture?',
    modeWord2ImgHint: 'Which picture matches the word?',
    start:         'Start',
    dueTitle:      'Review now',
    dueSub:        (n, total) => total > n ? `${n} of ${total} overdue words` : `${n} words to review`,
    reveal:        'Show answer',
    keySpace:      'Space',
    cardsPrompt:   'Do you know this word?',
    continue:      'Continue',
    finish:        'Finish',
    newSession:    'New session',
    missedTitle:   'To work on',
    goalSub:       (n, g) => `${n} / ${g} words today`,
    streakDays:    (n) => n === 1 ? '1 day streak' : `${n} day streak`,
    masteryText:   (n, total) => `${n} / ${total} known`,
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
/** À changer quand les illustrations sont refaites : Cloudflare et le service worker les gardent sous leur nom. */
const IMG_VERSION = '20261107e';
const imgUrl = w => `assets/img/hsk${w.level}/${w.image}?v=${IMG_VERSION}`;
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
  if (typeof updateHub === 'function') updateHub();
}

// -------------------------------------------------------------------------
// ACTIVITÉ — série, objectif du jour (progress.js ; absent dans les tests)
// -------------------------------------------------------------------------
const SESSION_SIZE = 10;

function noteActivity(n = 1) {
  if (typeof Progress !== 'undefined') Progress.add(n);
}

// -------------------------------------------------------------------------
// ÉTAT DE SESSION
// -------------------------------------------------------------------------
let view = 'hub';          // 'hub' | 'session'
let revealed = false;      // flashcard : réponse affichée ?
let sessionTotal = 0;      // taille initiale du deck (sans les mots remis en jeu)
let sessionDue = false;    // la session a été lancée depuis « Réviser maintenant »
let attempted = new Set(); // mots déjà répondus au moins une fois
let requeued = new Set();  // mots déjà remis en fin de session
let missed = [];           // mots ratés à la première tentative

const hubEl     = document.getElementById('hub');
const sessionEl = document.getElementById('session');
const dockEl    = document.getElementById('dock');
const progTrack = document.getElementById('progressTrack');
const hubNote   = document.getElementById('hubNote');

function speakButton() {
  return `<button class="speak-btn" id="speakBtn" type="button">
            <i class="fa-solid fa-volume-high"></i><span>${t().listen}</span>
          </button>`;
}

/** Remplit le bandeau du bas (révéler / noter / retour / continuer). */
function setDock(html, cls = '') {
  dockEl.className = 'dock' + (cls ? ' ' + cls : '');
  dockEl.innerHTML = html ? `<div class="dock-inner">${html}</div>` : '';
}

function updateProgress() {
  const total = deck.length || 1;
  const done = Math.min(deck.length, idx + (answered ? 1 : 0));
  const pct = Math.round((done / total) * 100);
  progFill.style.width = pct + '%';
  progTrack.setAttribute('aria-valuenow', String(pct));
  progText.textContent = `${Math.min(idx + 1, deck.length)} / ${deck.length}`;
  scoreText.textContent = '';
}

// -------------------------------------------------------------------------
// HUB — série, objectif, révisions, maîtrise du niveau
// -------------------------------------------------------------------------
function updateHub() {
  const st = typeof Progress !== 'undefined' ? Progress.load() : { goal: 10, days: {} };
  const streak = typeof Progress !== 'undefined' ? Progress.streak(st) : 0;
  const today = typeof Progress !== 'undefined' ? Progress.today(st) : 0;
  const goal = st.goal || 10;
  const ratio = Math.min(1, today / goal);
  const due = SRS.dueCount(cards);

  document.getElementById('statStreak').textContent = String(streak);
  document.querySelector('.stat-icon.flame')?.classList.toggle('off', streak === 0);

  const ring = document.getElementById('goalRing');
  ring.setAttribute('style', `--p:${Math.round(ratio * 100)}`);
  ring.classList.toggle('done', ratio >= 1);
  document.getElementById('goalText').textContent = ratio >= 1 ? '✓' : String(today);
  document.getElementById('goalSub').textContent = `${Math.min(today, goal)} / ${goal}`;

  document.getElementById('statDue').textContent = String(due);
  const dueBtn = document.getElementById('dueBtn');
  dueBtn.hidden = due === 0;
  document.getElementById('dueBtnTitle').textContent = t().dueTitle;
  document.getElementById('dueBtnSub').textContent = t().dueSub(Math.min(due, SESSION_SIZE), due);

  const words = LEVEL_WORDS[currentLevel] || [];
  const mastered = words.filter(w => known.has(w.slug)).length;
  document.getElementById('masteryFill').style.width = (words.length ? (mastered / words.length) * 100 : 0) + '%';
  document.getElementById('masteryText').textContent = t().masteryText(mastered, words.length);

  document.getElementById('startBtnLabel').textContent = t().start;
  const lbl = document.getElementById('reviewToggleLabel');
  if (lbl) lbl.textContent = t().onlyReview;
  reviewToggle.classList.toggle('active', onlyReview);
  reviewToggle.setAttribute('aria-checked', String(onlyReview));
}

// -------------------------------------------------------------------------
// FLASHCARDS — retrouver le mot, révéler, se noter
// -------------------------------------------------------------------------
function renderCards() {
  const w = deck[idx];
  revealed = false;
  stage.innerHTML = `
    <div class="q-card card-flash">
      <div class="flash-image-wrap">
        <img src="${esc(imgUrl(w))}" alt="" class="q-image" loading="eager">
        ${speakButton()}
      </div>
      <div class="flash-reveal" id="flashReveal"><span class="flash-q" aria-hidden="true">?</span><span class="flash-hint">${t().cardsPrompt}</span></div>
    </div>`;
  setDock(`<button class="btn primary big" id="btnReveal" type="button">${t().reveal} <span class="kbd-hint">${t().keySpace}</span></button>`);

  document.getElementById('speakBtn').addEventListener('click', () => speak(w.char));
  document.getElementById('btnReveal').addEventListener('click', revealCard);
}

function revealCard() {
  if (mode !== 'cards' || revealed || view !== 'session') return;
  const w = deck[idx];
  revealed = true;
  const box = document.getElementById('flashReveal');
  box.classList.add('shown');
  box.innerHTML = `
    <div class="flash-hanzi">${esc(w.char)}</div>
    <div class="flash-pinyin">${esc(w.pinyin)}</div>
    <div class="flash-meaning">${esc(lang === 'fr' ? w.fr : w.en)}</div>`;
  setDock(`<div class="dock-row">
      <button class="btn again" id="btnReview" type="button"><i class="fa-solid fa-rotate-left"></i> ${t().review} <span class="kbd-hint">1</span></button>
      <button class="btn know" id="btnKnew" type="button"><i class="fa-solid fa-check"></i> ${t().knew} <span class="kbd-hint">2</span></button>
    </div>`);
  document.getElementById('btnReview').addEventListener('click', () => rateCard(false));
  document.getElementById('btnKnew').addEventListener('click', () => rateCard(true));
  speak(w.char);
}

function rateCard(ok) {
  if (!revealed) return;
  const w = deck[idx];
  if (ok) known.add(w.slug); else known.delete(w.slug);
  gradeWord(w, ok);
  noteActivity();
  recordResult(w, ok);
  answered = true;
  updateProgress();
  go(1);
}

/** Compte le score à la première tentative ; remet un mot raté en fin de session (une fois). */
function recordResult(w, ok) {
  if (!attempted.has(w.slug)) {
    attempted.add(w.slug);
    if (ok) score++; else missed.push(w);
  }
  if (!ok && !requeued.has(w.slug)) {
    requeued.add(w.slug);
    deck.push(w);
  }
}

// -------------------------------------------------------------------------
// QUIZ À CHOIX — image → mot, mot → image
// -------------------------------------------------------------------------
function choiceKey(i) {
  return `<span class="choice-key" aria-hidden="true">${i + 1}</span>`;
}

function renderImg2Word() {
  const w = deck[idx];
  const choices = shuffle([w, ...pickDistractors(w, 3)]);
  stage.innerHTML = `
    <h2 class="q-prompt">${t().pickWord}</h2>
    <div class="q-card quiz-card">
      <div class="flash-image-wrap big">
        <img src="${esc(imgUrl(w))}" alt="" class="q-image">
        ${speakButton()}
      </div>
    </div>
    <div class="choices choices-text" id="choices"></div>`;
  setDock('');

  const box = document.getElementById('choices');
  choices.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice';
    b.dataset.slug = c.slug;
    b.innerHTML = `${choiceKey(i)}<span class="choice-body"><span class="choice-hanzi">${esc(c.char)}</span><span class="choice-pinyin">${esc(c.pinyin)}</span></span>`;
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
    <h2 class="q-prompt">${t().pickImage}</h2>
    <div class="q-card quiz-card">
      <div class="word-head">
        <div class="flash-hanzi">${esc(w.char)}</div>
        <div class="flash-pinyin">${esc(w.pinyin)}</div>
        ${speakButton()}
      </div>
    </div>
    <div class="choices choices-image" id="choices"></div>`;
  setDock('');

  const box = document.getElementById('choices');
  choices.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice choice-img';
    b.dataset.slug = c.slug;
    b.setAttribute('aria-label', String(i + 1));
    b.innerHTML = `<img src="${esc(imgUrl(c))}" alt="">`;
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
  noteActivity();
  recordResult(word, ok);
  box.classList.add('locked');
  box.querySelectorAll('.choice').forEach(c => { c.disabled = true; });
  btn.classList.add(ok ? 'right' : 'wrong');
  const right = box.querySelector(`.choice[data-slug="${word.slug}"]`);
  if (!ok && right) right.classList.add('right');
  if (right && right.scrollIntoView) right.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  updateProgress();

  setDock(`
    <div class="fb" role="status">
      <i class="fa-solid ${ok ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
      <div class="fb-text">
        <span class="fb-title">${ok ? t().correct : t().wrong}</span>
        <span class="fb-answer"><span class="hz">${esc(word.char)}</span> · ${esc(word.pinyin)} — ${esc(lang === 'fr' ? word.fr : word.en)}</span>
      </div>
    </div>
    <button class="btn primary big" id="btnCont" type="button">${t().next} <span class="kbd-hint">↵</span></button>`,
    ok ? 'ok' : 'ko');
  document.getElementById('btnCont').addEventListener('click', () => go(1));
  document.getElementById('btnCont').focus();
}

// -------------------------------------------------------------------------
// FIN DE SESSION
// -------------------------------------------------------------------------
function renderSummary() {
  const total = sessionTotal || deck.length;
  const ratio = total ? score / total : 0;
  const msg = ratio >= 0.8 ? t().summaryGood : ratio >= 0.5 ? t().summaryMid : t().summaryLow;
  const st = typeof Progress !== 'undefined' ? Progress.load() : { goal: 10, days: {} };
  const streak = typeof Progress !== 'undefined' ? Progress.streak(st) : 0;
  const today = typeof Progress !== 'undefined' ? Progress.today(st) : 0;
  const goal = st.goal || 10;

  const chips = [];
  if (streak > 0) chips.push(`<span class="sum-chip"><i class="fa-solid fa-fire"></i> ${t().streakDays(streak)}</span>`);
  chips.push(`<span class="sum-chip"><i class="fa-solid ${today >= goal ? 'fa-circle-check' : 'fa-bullseye'}" style="color:var(--good)"></i> ${t().goalSub(Math.min(today, goal), goal)}</span>`);

  const missedHtml = missed.length ? `
    <div class="missed">
      <h3 class="missed-h">${t().missedTitle}</h3>
      <div class="missed-list">${missed.map(w => `
        <div class="missed-item">
          <span class="hz">${esc(w.char)}</span><span class="py">${esc(w.pinyin)}</span>
          <span class="mn">${esc(lang === 'fr' ? w.fr : w.en)}</span>
        </div>`).join('')}</div>
    </div>` : '';

  stage.innerHTML = `
    <div class="q-card summary-card">
      <div class="summary-icon"><i class="fa-solid fa-trophy"></i></div>
      <h2>${t().summaryTitle}</h2>
      <div class="summary-score">${t().summaryScore(score, total)}</div>
      <p class="summary-msg">${msg}</p>
      <div class="summary-chips">${chips.join('')}</div>
      ${missedHtml}
    </div>`;
  setDock(`<div class="dock-row">
      <button class="btn" id="btnFinish" type="button">${t().finish}</button>
      <button class="btn primary" id="btnAgain" type="button"><i class="fa-solid fa-rotate-right"></i> ${t().newSession}</button>
    </div>`);
  progFill.style.width = '100%';
  progTrack.setAttribute('aria-valuenow', '100');
  progText.textContent = t().done;
  scoreText.textContent = '';
  document.getElementById('btnFinish').addEventListener('click', showHub);
  document.getElementById('btnAgain').addEventListener('click', () => startSession(sessionDue));
}

function render() {
  if (view !== 'session') return;
  if (!deck.length) { showHub(); return; }
  if (idx >= deck.length) { renderSummary(); return; }
  answered = false;
  updateProgress();
  if (mode === 'cards')         renderCards();
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

/** Ordre d'une session : mots échus, puis jamais vus, puis le reste. */
function prioritize(words) {
  const now = Date.now();
  const rank = w => SRS.isDue(cards[w.slug], now) ? 0 : (cards[w.slug] ? 2 : 1);
  return words.map((w, i) => [w, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(p => p[0]);
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

function startSession(due = false) {
  stopSpeech();
  sessionDue = due;
  onlyDue = due;
  buildDeck();
  onlyDue = false;
  if (!deck.length) {
    hubNote.textContent = due ? t().noDue : t().noWords;
    showHub();
    return;
  }
  deck = prioritize(deck).slice(0, SESSION_SIZE);
  sessionTotal = deck.length;
  idx = 0;
  score = 0;
  attempted = new Set();
  requeued = new Set();
  missed = [];
  view = 'session';
  hubNote.textContent = '';
  hubEl.hidden = true;
  sessionEl.hidden = false;
  document.body.classList.add('in-session');
  window.scrollTo({ top: 0 });
  render();
}

function showHub() {
  stopSpeech();
  view = 'hub';
  setDock('');
  sessionEl.hidden = true;
  hubEl.hidden = false;
  document.body.classList.remove('in-session');
  updateHub();
  window.scrollTo({ top: 0 });
}

function setMode(m) {
  mode = m;
  document.querySelectorAll('.mode-tab').forEach(b => {
    const on = b.dataset.mode === m;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

/** Change de niveau HSK : nouveau deck au prochain démarrage. */
function setLevel(level) {
  currentLevel = level;
  document.querySelectorAll('.level-tab').forEach(b =>
    b.classList.toggle('active', Number(b.dataset.level) === level));
  hubNote.textContent = '';
  setVersion();
  updateHub();
}

// -------------------------------------------------------------------------
// LANGUE
// -------------------------------------------------------------------------
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.dataset.i18n;
    if (typeof t()[k] === 'string') el.textContent = t()[k];
  });
  document.documentElement.lang = lang;
  setVersion();
  updateHub();
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

/** « À revoir seulement » : restreint le deck aux mots non maîtrisés. */
const reviewToggle = document.getElementById('reviewToggle');
reviewToggle.addEventListener('click', () => {
  onlyReview = !onlyReview;
  hubNote.textContent = '';
  updateHub();
});

document.getElementById('startBtn').addEventListener('click', () => startSession(false));
document.getElementById('dueBtn').addEventListener('click', () => startSession(true));
document.getElementById('sessionClose').addEventListener('click', showHub);

// Clavier : espace = révéler, 1 / 2 = noter, 1–4 = choisir, entrée = continuer
document.addEventListener('keydown', e => {
  if (view !== 'session' || e.ctrlKey || e.metaKey || e.altKey) return;
  const onButton = e.target && e.target.tagName === 'BUTTON';
  if (e.key === 'Escape') { showHub(); return; }
  if (mode === 'cards') {
    if (!revealed && (e.key === ' ' || e.key === 'Enter') && !onButton) { e.preventDefault(); revealCard(); }
    else if (revealed && (e.key === '1' || e.key === 'ArrowLeft')) rateCard(false);
    else if (revealed && (e.key === '2' || e.key === 'ArrowRight')) rateCard(true);
    return;
  }
  if (answered) {
    if ((e.key === 'Enter' || e.key === ' ') && !onButton) { e.preventDefault(); document.getElementById('btnCont')?.click(); }
    return;
  }
  const n = Number(e.key);
  if (n >= 1 && n <= 4) document.querySelectorAll('#choices .choice')[n - 1]?.click();
});

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
    <button type="button" class="level-tab${l.id === currentLevel ? ' active' : ''}" data-level="${l.id}">
      HSK ${l.id}<span class="level-count">${(LEVEL_WORDS[l.id] || []).length}</span>
    </button>`).join('');
}

(async function init() {
  try {
    await loadData();
    buildLevelTabs();
    buildDeck();
    applyI18n();          // langue + version + hub
  } catch (err) {
    console.error(err);
    hubNote.textContent = t().error;
    setVersion();
  }
})();
