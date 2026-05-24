// =========================================================================
// DATA
// =========================================================================
const HSK_LEVELS = [1, 2, 3, 4, 5, 6];
const HSK_DATA = {};
const loadingState = {};

async function loadLevel(level) {
  if (HSK_DATA[level]) return HSK_DATA[level];
  if (loadingState[level] === 'loading') return null;
  loadingState[level] = 'loading';
  try {
    const res = await fetch(`data/hsk${level}.json`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const raw = await res.json();
    HSK_DATA[level] = raw.map(e => ({
      char:        e.simplified,
      traditional: e.traditional,
      radical:     e.radical,
      frequency:   e.frequency,
      pos:         e.pos || [],
      pinyin:      e.pinyin,
      classifiers: e.classifiers || [],
      en:          Array.isArray(e.english) ? e.english.join('; ') : (e.english || ''),
      fr:          Array.isArray(e.french)  ? e.french.join('; ')  : (e.french  || '')
    }));
    loadingState[level] = 'loaded';
  } catch (err) {
    console.error('Erreur chargement HSK', level, err);
    loadingState[level] = 'error';
    HSK_DATA[level] = [];
  }
  return HSK_DATA[level];
}

// =========================================================================
// I18N
// =========================================================================
const I18N = {
  fr: {
    tagline:      'apprendre le chinois, un caractère à la fois',
    empty:        'Sélectionnez un caractère pour voir son tracé',
    search:       'Rechercher…',
    pinyin:       'pinyin',
    meaning:      'sens',
    traditional:  'traditionnel',
    radical:      'radical',
    frequency:    'fréquence',
    pos:          'grammaire',
    classifiers:  'classificateurs',
    level:        'niveau',
    redraw:       'Rejouer',
    quiz:         'Tracer',
    speak:        'Écouter',
    tone:         'Ton',
    filterAll:    'tout',
    filterChar:   'caractère',
    filterPinyin: 'pinyin',
    filterMeaning:'sens',
    loading:      'Chargement…',
    error:        'Erreur de chargement',
    none:         'Aucun caractère ne correspond',
    resultsCount: (n, t) => `${n} / ${t} caractères`,
    recording:    'Enregistrement…',
    sayWord:      'Prononcez',
    analyzing:    'Analyse…'
  },
  en: {
    tagline:      'learn Chinese, one character at a time',
    empty:        'Select a character to see its stroke order',
    search:       'Search…',
    pinyin:       'pinyin',
    meaning:      'meaning',
    traditional:  'traditional',
    radical:      'radical',
    frequency:    'frequency',
    pos:          'grammar',
    classifiers:  'classifiers',
    level:        'level',
    redraw:       'Replay',
    quiz:         'Trace',
    speak:        'Listen',
    tone:         'Tone',
    filterAll:    'all',
    filterChar:   'character',
    filterPinyin: 'pinyin',
    filterMeaning:'meaning',
    loading:      'Loading…',
    error:        'Loading error',
    none:         'No characters match',
    resultsCount: (n, t) => `${n} / ${t} characters`,
    recording:    'Recording…',
    sayWord:      'Say',
    analyzing:    'Analyzing…'
  }
};

let currentLang   = 'fr';
let currentLevel  = 1;
let currentChar   = null;
let currentWriter = null;
let currentCharIndex = 0;
let searchQuery   = '';
let searchFilter  = 'all';

// =========================================================================
// PAPER BACKGROUND
// =========================================================================
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
    pctx.fillStyle = `rgba(110,80,50,${0.04+Math.random()*.05})`;
    pctx.beginPath(); pctx.arc(x+.3, y+.3, sz, 0, Math.PI*2); pctx.fill();
    pctx.fillStyle = `rgba(255,240,200,${0.1+Math.random()*.1})`;
    pctx.beginPath(); pctx.arc(x-.25, y-.25, sz*.85, 0, Math.PI*2); pctx.fill();
  }

  const patchCount = Math.floor(W*H/30000);
  for (let i = 0; i < patchCount; i++) {
    const x = Math.random()*W, y = Math.random()*H, r = 30+Math.random()*70;
    const pg = pctx.createRadialGradient(x,y,0,x,y,r);
    pg.addColorStop(0, `rgba(180,130,70,${0.05+Math.random()*.06})`);
    pg.addColorStop(1, 'rgba(180,130,70,0)');
    pctx.fillStyle = pg;
    pctx.beginPath(); pctx.arc(x, y, r, 0, Math.PI*2); pctx.fill();
  }

  const speckCount = Math.floor(W*H/25000);
  for (let i = 0; i < speckCount; i++) {
    pctx.fillStyle = `rgba(120,70,30,${0.25+Math.random()*.3})`;
    pctx.beginPath(); pctx.arc(Math.random()*W, Math.random()*H, 0.5+Math.random()*.9, 0, Math.PI*2); pctx.fill();
  }

  const vig = pctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.35,W/2,H/2,Math.max(W,H)*.75);
  vig.addColorStop(0, 'rgba(80,50,20,0)');
  vig.addColorStop(1, 'rgba(60,35,15,0.22)');
  pctx.fillStyle = vig;
  pctx.fillRect(0, 0, W, H);
}

window.addEventListener('resize', buildPaper);
buildPaper();

// =========================================================================
// ELEMENTS
// =========================================================================
const levelsEl      = document.getElementById('levels');
const charListEl    = document.getElementById('charList');
const detailEl      = document.getElementById('detail');
const detailEmptyEl = document.getElementById('detailEmpty');
const searchInput   = document.getElementById('search');
const filtersEl     = document.getElementById('filters');
const resultsCountEl= document.getElementById('resultsCount');
const popupOverlay  = document.getElementById('popupOverlay');
const popupBody     = document.getElementById('popupBody');
const popupTitle    = document.getElementById('popupTitle');

// =========================================================================
// LEVELS
// =========================================================================
function buildLevels() {
  levelsEl.innerHTML = '';
  for (const lvl of HSK_LEVELS) {
    const btn = document.createElement('button');
    btn.className = 'level-btn' + (lvl === currentLevel ? ' active' : '');
    btn.textContent = 'HSK ' + lvl;
    btn.addEventListener('click', async () => {
      currentLevel = lvl;
      buildLevels();
      await ensureLevelLoaded(lvl);
      buildCharList();
    });
    levelsEl.appendChild(btn);
  }
}

async function ensureLevelLoaded(level) {
  if (HSK_DATA[level]) return;
  charListEl.innerHTML = '';
  const loader = document.createElement('div');
  loader.className = 'empty';
  loader.textContent = I18N[currentLang].loading;
  charListEl.appendChild(loader);
  resultsCountEl.textContent = '';
  await loadLevel(level);
}

// =========================================================================
// FILTERS
// =========================================================================
function buildFilters() {
  const t = I18N[currentLang];
  const labels = { all: t.filterAll, char: t.filterChar, pinyin: t.filterPinyin, meaning: t.filterMeaning };
  filtersEl.querySelectorAll('button').forEach(btn => {
    btn.textContent = labels[btn.dataset.filter];
    btn.classList.toggle('active', btn.dataset.filter === searchFilter);
  });
}

filtersEl.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => {
    searchFilter = btn.dataset.filter;
    buildFilters();
    buildCharList();
  });
});

searchInput.addEventListener('input', e => {
  searchQuery = e.target.value;
  buildCharList();
});

// =========================================================================
// CHAR LIST
// =========================================================================
function matchesSearch(item, q) {
  if (!q) return true;
  const ql = q.toLowerCase();
  const inChar    = item.char.includes(q);
  const pinyinND  = (item.pinyin || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const inPinyin  = (item.pinyin || '').toLowerCase().includes(ql) || pinyinND.includes(ql);
  const inMeaning = (item.fr || '').toLowerCase().includes(ql) || (item.en || '').toLowerCase().includes(ql);
  switch (searchFilter) {
    case 'char':    return inChar;
    case 'pinyin':  return inPinyin;
    case 'meaning': return inMeaning;
    default:        return inChar || inPinyin || inMeaning;
  }
}

function buildCharList() {
  const list = HSK_DATA[currentLevel] || [];
  const q = searchQuery.trim();
  const filtered = list.filter(c => matchesSearch(c, q));

  resultsCountEl.textContent = I18N[currentLang].resultsCount(filtered.length, list.length);
  charListEl.innerHTML = '';

  if (list.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'empty';
    msg.textContent = loadingState[currentLevel] === 'error'
      ? I18N[currentLang].error : I18N[currentLang].loading;
    charListEl.appendChild(msg);
    return;
  }
  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = I18N[currentLang].none;
    charListEl.appendChild(empty);
    return;
  }

  const MAX = 300;
  const frag = document.createDocumentFragment();
  for (const item of filtered.slice(0, MAX)) {
    const row = document.createElement('div');
    row.className = 'char-row' + (currentChar?.char === item.char ? ' active' : '');
    row.innerHTML = `
      <div class="char-row-char">${item.char}</div>
      <div class="char-row-meta">
        <div class="char-row-pinyin">${item.pinyin}</div>
        <div class="char-row-meaning">${item[currentLang]}</div>
      </div>`;
    row.addEventListener('click', () => selectChar(item));
    frag.appendChild(row);
  }
  charListEl.appendChild(frag);

  if (filtered.length > MAX) {
    const more = document.createElement('div');
    more.className = 'empty';
    more.style.fontSize = '0.78rem';
    more.textContent = currentLang === 'fr'
      ? `+ ${filtered.length - MAX} autres — affinez la recherche`
      : `+ ${filtered.length - MAX} more — refine your search`;
    charListEl.appendChild(more);
  }
}

function selectChar(item) {
  currentChar = item;
  currentCharIndex = 0;
  buildCharList();
  if (window.innerWidth <= 800) openPopup();
  else renderDetail(detailEl);
}

// =========================================================================
// SHARED RENDER
// =========================================================================
const POS_LABELS = {
  v:'verbe', n:'nom', vn:'nom verbal', m:'mesure', t:'temps', b:'attribut',
  r:'pronom', a:'adjectif', d:'adverbe', p:'préposition', c:'conjonction',
  u:'particule', e:'exclamation', q:'classificateur', s:'lieu', f:'direction', o:'onomatopée'
};

function getChars() { return currentChar ? [...currentChar.char] : []; }

function buildControls(container) {
  const t = I18N[currentLang];
  container.innerHTML = `
    <div class="char-display">
      <div id="writer-host"></div>
      <div class="char-nav" id="charNav">
        <button class="btn" id="charNavPrev"><i class="fa-solid fa-chevron-left"></i></button>
        <div class="char-nav-dots" id="charNavDots"></div>
        <button class="btn" id="charNavNext"><i class="fa-solid fa-chevron-right"></i></button>
      </div>
      <div class="controls">
        <button class="ctrl-btn primary" id="btnReplay">
          <i class="fa-solid fa-rotate-right"></i>
          <span class="ctrl-label">${t.redraw}</span>
        </button>
        <button class="ctrl-btn" id="btnQuiz">
          <i class="fa-solid fa-pen"></i>
          <span class="ctrl-label">${t.quiz}</span>
        </button>
        <button class="ctrl-btn" id="btnSpeak">
          <i class="fa-solid fa-volume-high"></i>
          <span class="ctrl-label">${t.speak}</span>
        </button>
        <button class="ctrl-btn" id="btnTone">
          <i class="fa-solid fa-microphone"></i>
          <span class="ctrl-label">${t.tone}</span>
        </button>
      </div>
      <div class="tone-section" id="toneSection"></div>
    </div>`;

  const t2 = I18N[currentLang];
  const posBadges = (currentChar.pos || [])
    .map(p => `<span class="pos-badge">${POS_LABELS[p] || p}</span>`).join('');
  const classifiers = currentChar.classifiers?.length ? currentChar.classifiers.join(', ') : '—';
  const trad = currentChar.traditional !== currentChar.char ? currentChar.traditional : '—';

  container.innerHTML += `
    <div class="info">
      <div class="info-row"><span class="info-label">${t2.pinyin}</span><span class="info-value pinyin">${currentChar.pinyin}</span></div>
      <div class="info-row"><span class="info-label">${t2.meaning}</span><span class="info-value">${currentLang === 'fr' ? currentChar.fr : currentChar.en || '—'}</span></div>
      <div class="info-row"><span class="info-label">${t2.traditional}</span><span class="info-value">${trad}</span></div>
      <div class="info-row"><span class="info-label">${t2.radical}</span><span class="info-value">${currentChar.radical || '—'}</span></div>
      <div class="info-row"><span class="info-label">${t2.pos}</span><span class="info-value">${posBadges || '—'}</span></div>
      <div class="info-row"><span class="info-label">${t2.classifiers}</span><span class="info-value">${classifiers}</span></div>
      <div class="info-row"><span class="info-label">${t2.frequency}</span><span class="info-value">${currentChar.frequency ?? '—'}</span></div>
      <div class="info-row"><span class="info-label">${t2.level}</span><span class="info-value"><span class="level-badge">HSK ${currentLevel}</span></span></div>
    </div>`;

  document.getElementById('btnReplay').addEventListener('click', animateChar);
  document.getElementById('btnQuiz').addEventListener('click', quizChar);
  document.getElementById('btnSpeak').addEventListener('click', speakChar);
  document.getElementById('btnTone').addEventListener('click', () => startToneDetection(currentChar.pinyin));
  document.getElementById('charNavPrev').addEventListener('click', () => {
    if (currentCharIndex > 0) { currentCharIndex--; buildCharNav(); animateChar(); }
  });
  document.getElementById('charNavNext').addEventListener('click', () => {
    if (currentCharIndex < getChars().length - 1) { currentCharIndex++; buildCharNav(); animateChar(); }
  });

  buildCharNav();
  animateChar();
}

function buildCharNav() {
  const chars = getChars();
  const nav  = document.getElementById('charNav');
  const dots = document.getElementById('charNavDots');
  if (!nav || !dots) return;

  if (chars.length <= 1) { nav.classList.remove('visible'); return; }
  nav.classList.add('visible');

  document.getElementById('charNavPrev').disabled = currentCharIndex === 0;
  document.getElementById('charNavNext').disabled = currentCharIndex === chars.length - 1;

  dots.innerHTML = chars.map((c, i) => `
    <span data-idx="${i}" style="
      display:inline-flex;align-items:center;justify-content:center;
      width:1.8rem;height:1.8rem;border-radius:50%;cursor:pointer;
      font-family:'STKaiti','Kaiti SC',serif;font-size:0.9rem;
      background:${i === currentCharIndex ? 'var(--ink)' : 'rgba(60,35,15,0.1)'};
      color:${i === currentCharIndex ? 'var(--paper-light)' : 'var(--ink-soft)'};
      transition:all 0.15s;">${c}</span>`).join('');

  dots.querySelectorAll('span').forEach(s =>
    s.addEventListener('click', () => { currentCharIndex = +s.dataset.idx; buildCharNav(); animateChar(); })
  );
}

function renderDetail(container) {
  if (!currentChar) {
    container.innerHTML = '';
    container.appendChild(detailEmptyEl);
    return;
  }
  container.innerHTML = '';
  buildControls(container);
}

// =========================================================================
// POPUP
// =========================================================================
document.getElementById('popupClose').addEventListener('click', closePopup);
popupOverlay.addEventListener('click', e => { if (e.target === popupOverlay) closePopup(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePopup(); });

function openPopup() {
  popupTitle.textContent = currentChar.char;
  popupBody.innerHTML = '';
  popupOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => buildControls(popupBody));
}

function closePopup() {
  popupOverlay.classList.remove('open');
  document.body.style.overflow = '';
  currentWriter = null;
}

// =========================================================================
// HANZI WRITER
// =========================================================================
function animateChar() {
  const host = document.getElementById('writer-host');
  if (!host || !currentChar) return;
  host.innerHTML = '';
  const ch   = getChars()[currentCharIndex] || currentChar.char;
  const size = host.clientWidth;
  try {
    currentWriter = HanziWriter.create(host, ch, {
      width: size, height: size, padding: 8,
      strokeColor: '#1a1310', radicalColor: '#b8211f',
      strokeAnimationSpeed: 1.0, delayBetweenStrokes: 200,
      showOutline: true, outlineColor: 'rgba(60,35,15,0.15)', showCharacter: false
    });
    currentWriter.animateCharacter();
  } catch {
    host.innerHTML = `<div style="font-size:${size*.65}px;font-family:'STKaiti','Kaiti SC',serif;color:#1a1310;text-align:center;line-height:${size}px">${ch}</div>`;
  }
}

function quizChar() {
  const host = document.getElementById('writer-host');
  if (!host || !currentChar) return;
  host.innerHTML = '';
  const ch   = getChars()[currentCharIndex] || currentChar.char;
  const size = host.clientWidth;
  try {
    currentWriter = HanziWriter.create(host, ch, {
      width: size, height: size, padding: 8,
      strokeColor: '#1a1310', radicalColor: '#b8211f',
      strokeAnimationSpeed: 1.0, delayBetweenStrokes: 200,
      showOutline: true, outlineColor: 'rgba(60,35,15,0.2)',
      showCharacter: false, drawingColor: '#b8211f', highlightColor: '#b8211f'
    });
    currentWriter.quiz({ onMistake:()=>{}, onCorrectStroke:()=>{}, onComplete:()=>{} });
  } catch {}
}

// =========================================================================
// SPEECH
// =========================================================================
function speakChar() {
  const speak = () => {
    const voices = speechSynthesis.getVoices();
    const zh = voices.find(v => v.lang.startsWith('zh'));
    const u = new SpeechSynthesisUtterance(currentChar.char);
    u.lang = 'zh-CN'; u.rate = 0.8;
    if (zh) u.voice = zh;
    speechSynthesis.speak(u);
  };
  if (speechSynthesis.getVoices().length) speak();
  else speechSynthesis.addEventListener('voiceschanged', speak, { once: true });
}

// =========================================================================
// TONE DETECTION — sequential, syllable by syllable, real-time feedback
// =========================================================================
const TONE_FEEDBACK = {
  novoice: { fr: 'Aucune voix détectée — réessayez', en: 'No voice detected — try again' },
  noperm:  { fr: 'Microphone non autorisé',          en: 'Microphone not allowed' }
};

const TONE_NAMES = {
  1: { fr: 'plat',    en: 'flat',    symbol: '¯' },
  2: { fr: 'montant', en: 'rising',  symbol: '/' },
  3: { fr: 'creusé',  en: 'dipping', symbol: 'v' },
  4: { fr: 'tombant', en: 'falling', symbol: '\\' },
  5: { fr: 'neutre',  en: 'neutral', symbol: '·' }
};

function extractToneNumber(syllable) {
  const map = {
    'ā':1,'á':2,'ǎ':3,'à':4,'ē':1,'é':2,'ě':3,'è':4,
    'ī':1,'í':2,'ǐ':3,'ì':4,'ō':1,'ó':2,'ǒ':3,'ò':4,
    'ū':1,'ú':2,'ǔ':3,'ù':4,'ǖ':1,'ǘ':2,'ǚ':3,'ǜ':4
  };
  for (const ch of syllable) if (map[ch]) return map[ch];
  return 5;
}

function splitPinyin(pinyin) {
  if (!pinyin) return [];
  return pinyin.split(/\s+/).filter(Boolean);
}

function getExpectedTones(pinyin) {
  return splitPinyin(pinyin).map(s => ({ syllable: s, tone: extractToneNumber(s) }));
}

// Tone sandhi
function applySandhi(expected) {
  const tones = expected.map(e => e.tone);
  const syllables = expected.map(e => e.syllable);
  const result = [...tones];

  for (let i = result.length - 2; i >= 0; i--) {
    if (result[i] === 3 && result[i + 1] === 3) result[i] = 2;
  }
  for (let i = 0; i < result.length - 1; i++) {
    const syl = syllables[i].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (syl === 'bu' && result[i] === 4 && result[i + 1] === 4) result[i] = 2;
  }
  for (let i = 0; i < result.length - 1; i++) {
    const syl = syllables[i].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (syl === 'yi' && tones[i] === 1) {
      result[i] = result[i + 1] === 4 ? 2 : 4;
    }
  }
  return expected.map((e, i) => ({ syllable: e.syllable, tone: result[i], original: tones[i] }));
}

// Expected tone curve (normalized 0..1, x in 0..1)
function expectedToneCurve(tone) {
  // y is "height" 0=low, 1=high
  switch (tone) {
    case 1: return x => 0.85;                              // flat high
    case 2: return x => 0.35 + x * 0.55;                   // rising
    case 3: return x => 0.6 - 0.55 * (1 - (2*x - 1)**2);   // dip (V)
    case 4: return x => 0.9 - x * 0.75;                    // falling
    case 5: return x => 0.5;                               // neutral mid
    default: return x => 0.5;
  }
}

// Classify a recorded pitch sequence (array of frequencies, nulls allowed)
function classifyPitches(pitches) {
  const valid = pitches.filter(p => p !== null && p > 60 && p < 800);
  if (valid.length < 5) return null;

  // Octave correction
  const sorted = [...valid].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  let corrected = pitches.map(p => {
    if (p === null) return null;
    const r = p / median;
    if (r > 1.7 && r < 2.3) return p / 2;
    if (r > 0.4 && r < 0.6) return p * 2;
    if (r > 2.3 || r < 0.4) return null;
    return p;
  });

  // Keep only voiced frames (drop nulls)
  let voiced = corrected.filter(p => p !== null);
  if (voiced.length < 6) return null;

  // Trim 10% from start and end — keep more of the informative part (esp. for tone 4)
  const trim = Math.floor(voiced.length * 0.1);
  voiced = voiced.slice(trim, voiced.length - trim);
  if (voiced.length < 4) return null;

  // Median smoothing on the trimmed pitches
  const smoothed = voiced.map((v, i, a) => {
    const w = 1, s = Math.max(0, i - w), e = Math.min(a.length - 1, i + w);
    const win = a.slice(s, e + 1).sort((x, y) => x - y);
    return win[Math.floor(win.length / 2)];
  });

  const log = smoothed.map(p => Math.log2(p));
  const n = log.length;

  // Use small edge windows (~15%) to capture the true start/end pitch,
  // critical for tone 4 where the high onset is brief
  const edgeW = Math.max(2, Math.floor(n * 0.15));
  const start = log.slice(0, edgeW).reduce((a, b) => a + b, 0) / edgeW;
  const end   = log.slice(-edgeW).reduce((a, b) => a + b, 0) / edgeW;
  const min   = Math.min(...log);
  const max   = Math.max(...log);
  const range = max - min;
  const slope = end - start;

  const minIdx = log.indexOf(min);
  const maxIdx = log.indexOf(max);
  const minPos = minIdx / (n - 1);
  const maxPos = maxIdx / (n - 1);

  // TONE 4 — falling: strong negative slope + peak early + min late
  if (slope < -0.18 && start > end && maxPos < 0.35 && minPos > 0.45) {
    return 4;
  }

  // TONE 2 — rising: positive slope + min early
  if (slope > 0.15 && end > start && minPos < 0.5) {
    return 2;
  }

  // TONE 3 — dipping: min clearly in the middle, with at least one clear descent
  // Real connected-speech tone 3 often has a small excursion (~0.08-0.12 octave),
  // and the rise back up is often weak or absent ("half third tone")
  if (
    minPos > 0.20 && minPos < 0.80 &&
    (start - min) > 0.06 &&
    (end - min) > 0.03 &&
    Math.abs(slope) < 0.18
  ) {
    return 3;
  }

  // TONE 1 — flat
  if (range < 0.18 && Math.abs(slope) < 0.08) return 1;

  // TONE 5 — neutral (very small range)
  if (range < 0.12) return 5;

  // Fallback
  return slope > 0 ? 2 : 4;
}

function gradeTone(detected, expectedTone) {
  if (!detected) return 'wrong';
  if (detected === expectedTone) return 'perfect';
  // Most tone confusions are "close" — be generous
  const closePairs = {
    1: [5, 4],       // flat ↔ neutral, flat ↔ falling start
    2: [3, 5],       // rising ↔ dipping, rising ↔ neutral
    3: [2, 5],       // dipping ↔ rising, dipping ↔ neutral
    4: [1, 5],       // falling ↔ flat, falling ↔ neutral
    5: [1, 2, 3, 4]  // neutral close to anything (it's short/light)
  };
  if (closePairs[expectedTone]?.includes(detected)) return 'close';
  return 'wrong';
}

const HINTS = {
  fr: {
    '1->2': 'reste plus plat, ne monte pas',
    '1->3': 'reste plat, ne fléchis pas',
    '1->4': 'reste plat, ne descends pas',
    '1->5': 'un peu plus haut et soutenu',
    '2->1': 'monte un peu plus à la fin',
    '2->3': 'commence un peu plus haut',
    '2->4': 'tu descends, il faut monter',
    '2->5': 'monte plus nettement',
    '3->1': 'creuse plus au milieu',
    '3->2': 'descends au milieu avant de remonter',
    '3->4': 'remonte à la fin au lieu de descendre',
    '3->5': 'creuse et remonte plus nettement',
    '4->1': 'descends plus à la fin',
    '4->2': 'tu montes, il faut descendre',
    '4->3': 'descends plus franchement',
    '4->5': 'plus marqué et plus court',
    '5->1': 'plus court et léger',
    '5->2': 'plus court et neutre',
    '5->3': 'plus court et neutre',
    '5->4': 'plus court et neutre'
  },
  en: {
    '1->2': 'stay flatter, don\'t rise',
    '1->3': 'stay flat, don\'t dip',
    '1->4': 'stay flat, don\'t fall',
    '1->5': 'a bit higher and sustained',
    '2->1': 'rise more at the end',
    '2->3': 'start a bit higher',
    '2->4': 'you fell, it should rise',
    '2->5': 'rise more clearly',
    '3->1': 'dip more in the middle',
    '3->2': 'dip in the middle before rising',
    '3->4': 'rise at the end instead of falling',
    '3->5': 'dip and rise more clearly',
    '4->1': 'fall more at the end',
    '4->2': 'you rose, it should fall',
    '4->3': 'fall sharply',
    '4->5': 'sharper and shorter',
    '5->1': 'shorter and lighter',
    '5->2': 'shorter and neutral',
    '5->3': 'shorter and neutral',
    '5->4': 'shorter and neutral'
  }
};

function getHint(detected, expected, lang) {
  return HINTS[lang]?.[`${expected}->${detected}`] || '';
}

// =========================================================================
// SEQUENTIAL TONE PRACTICE STATE
// =========================================================================
let toneSession = null;

async function startToneDetection(pinyin) {
  const section = document.getElementById('toneSection');
  if (!section) return;

  // Toggle: if already visible, hide and stop session
  if (section.classList.contains('visible')) {
    section.classList.remove('visible');
    section.innerHTML = '';
    toneSession = null;
    return;
  }

  const expected = applySandhi(getExpectedTones(pinyin));
  if (expected.length === 0) return;

  section.classList.add('visible');

  toneSession = {
    expected,
    currentIdx: 0,
    results: [],
    isRecording: false,
    autoStart: false
  };

  renderTonePractice();
}

function renderTonePractice() {
  const section = document.getElementById('toneSection');
  if (!section || !toneSession) return;

  const { expected, currentIdx, results, autoStart } = toneSession;
  const t = currentLang === 'fr' ? {
    instruction: 'Prononcez',
    start: 'Commencer',
    next: 'Syllabe suivante',
    retry: 'Réessayer',
    finish: 'Terminé !',
    expected: 'attendu',
    yours: 'le tien',
    progress: (i, n) => `Syllabe ${i + 1} / ${n}`
  } : {
    instruction: 'Say',
    start: 'Start',
    next: 'Next syllable',
    retry: 'Try again',
    finish: 'Done!',
    expected: 'expected',
    yours: 'yours',
    progress: (i, n) => `Syllable ${i + 1} / ${n}`
  };

  if (currentIdx >= expected.length) {
    renderSessionSummary();
    return;
  }

  const cur = expected[currentIdx];
  const lastResult = results[currentIdx];
  const stepsHtml = expected.map((exp, i) => {
    let cls = 'tone-step';
    if (i < currentIdx) cls += ' done';
    else if (i === currentIdx) cls += ' current';
    if (results[i]) cls += ' grade-' + results[i].grade;
    return `<span class="${cls}">${exp.syllable}</span>`;
  }).join('');

  section.innerHTML = `
    <div class="tone-disclaimer">
      <i class="fa-solid fa-circle-info"></i>
      <span>${currentLang === 'fr'
        ? 'Outil d\'entraînement — exagère les tons pour mieux les ancrer'
        : 'Practice tool — exaggerate tones to better internalize them'}</span>
    </div>
    <div class="tone-progress">
      <div class="tone-progress-label">${t.progress(currentIdx, expected.length)}</div>
      <div class="tone-progress-steps">${stepsHtml}</div>
    </div>
    <div class="tone-syllable-display">
      <div class="tone-syllable-pinyin">${cur.syllable}</div>
      <div class="tone-syllable-info">
        <span class="tone-symbol">${TONE_NAMES[cur.tone].symbol}</span>
        <span class="tone-name">${TONE_NAMES[cur.tone][currentLang]}</span>
        ${cur.original !== cur.tone ? `<span class="sandhi-tag" title="sandhi: ${cur.original}→${cur.tone}">↩</span>` : ''}
      </div>
    </div>
    <canvas id="tone-canvas-live" width="320" height="90"></canvas>
    <div class="tone-status" id="toneStatus"></div>
    <div class="tone-actions" id="toneActions"></div>
  `;

  drawExpectedCurve(cur.tone);

  if (lastResult) {
    showResultFeedback(lastResult, cur, t);
    renderToneActions(t);
  } else if (autoStart) {
    // Triggered by retry/next: start recording immediately
    recordCurrentSyllable();
  } else {
    // First time: show Start button
    const actionsEl = document.getElementById('toneActions');
    actionsEl.innerHTML = `
      <button class="tone-action-btn primary" id="btnStartRec">
        <i class="fa-solid fa-microphone"></i> ${t.start}
      </button>`;
    document.getElementById('btnStartRec').addEventListener('click', recordCurrentSyllable);
  }
}

function renderToneActions(t) {
  const { currentIdx, expected } = toneSession;
  const actionsEl = document.getElementById('toneActions');
  if (!actionsEl) return;
  const isLast = currentIdx === expected.length - 1;
  actionsEl.innerHTML = `
    <button class="tone-action-btn" id="btnRetry">
      <i class="fa-solid fa-rotate-right"></i> ${t.retry}
    </button>
    <button class="tone-action-btn primary" id="btnNext">
      ${isLast ? `<i class="fa-solid fa-flag-checkered"></i> ${t.finish}` : `<i class="fa-solid fa-arrow-right"></i> ${t.next}`}
    </button>`;
  document.getElementById('btnRetry').addEventListener('click', () => {
    toneSession.results[currentIdx] = null;
    toneSession.autoStart = true;
    renderTonePractice();
  });
  document.getElementById('btnNext').addEventListener('click', () => {
    toneSession.currentIdx++;
    toneSession.autoStart = true;
    renderTonePractice();
  });
}

function drawExpectedCurve(tone, livePitches = null, pitchRange = null) {
  const canvas = document.getElementById('tone-canvas-live');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const padX = 30, padY = 20;
  const xL = padX, xR = W - padX;
  const yT = padY, yB = H - padY;

  // Grid lines (high / mid / low)
  ctx.strokeStyle = 'rgba(60, 35, 15, 0.08)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);
  for (let i = 0; i <= 4; i++) {
    const y = yT + (yB - yT) * i / 4;
    ctx.beginPath(); ctx.moveTo(xL, y); ctx.lineTo(xR, y); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Expected tone curve
  const curve = expectedToneCurve(tone);
  ctx.strokeStyle = 'rgba(184, 33, 31, 0.35)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  const steps = 50;
  for (let i = 0; i <= steps; i++) {
    const x = i / steps;
    const y = curve(x);
    const px = xL + x * (xR - xL);
    const py = yB - y * (yB - yT);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Labels
  ctx.font = '10px Georgia, serif';
  ctx.fillStyle = 'rgba(60, 35, 15, 0.55)';
  ctx.textAlign = 'right';
  ctx.fillText('5', xL - 6, yT + 10);
  ctx.fillText('1', xL - 6, yB - 2);

  // Live user pitch curve — stretch voiced frames across full width
  if (livePitches && pitchRange) {
    const { min: pMin, max: pMax } = pitchRange;
    const logMin = Math.log2(pMin);
    const logMax = Math.log2(pMax);
    const span = logMax - logMin;

    const voiced = livePitches.filter(p => p !== null);
    if (voiced.length >= 2) {
      ctx.strokeStyle = 'rgba(26, 19, 16, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      voiced.forEach((p, i) => {
        const x = xL + (i / (voiced.length - 1)) * (xR - xL);
        const norm = Math.min(1, Math.max(0, (Math.log2(p) - logMin) / span));
        // Map into same 0.1..0.9 visual band as expected curves
        const yNorm = 0.1 + norm * 0.8;
        const y = yB - yNorm * (yB - yT);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }
}

async function recordCurrentSyllable() {
  if (!toneSession || toneSession.isRecording) return;
  const { expected, currentIdx } = toneSession;
  const cur = expected[currentIdx];
  const status = document.getElementById('toneStatus');
  const actionsEl = document.getElementById('toneActions');

  toneSession.isRecording = true;

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    status.innerHTML = `<i class="fa-solid fa-ban"></i> ${TONE_FEEDBACK.noperm[currentLang]}`;
    status.className = 'tone-status error';
    toneSession.isRecording = false;
    return;
  }

  const audioCtx = new AudioContext();
  const source   = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const detectPitch = PitchFinder.YIN({ sampleRate: audioCtx.sampleRate });
  const pitches = [];
  const buffer  = new Float32Array(analyser.fftSize);

  const RECORD_MS = 1500;
  const start = Date.now();

  // Visible countdown
  actionsEl.innerHTML = `<div class="recording-indicator"><span class="rec-dot"></span><span>0.0s</span></div>`;
  const countdownEl = actionsEl.querySelector('span:not(.rec-dot)');

  const tick = () => {
    analyser.getFloatTimeDomainData(buffer);
    const p = detectPitch(buffer);
    pitches.push((p && p > 60 && p < 800) ? p : null);

    const elapsed = Date.now() - start;
    if (countdownEl) countdownEl.textContent = ((RECORD_MS - elapsed) / 1000).toFixed(1) + 's';

    // Fixed display range: ±0.3 octave around the running median (≈minor third)
    const valid = pitches.filter(x => x !== null);
    if (valid.length > 3) {
      const sorted = [...valid].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const minP = median / Math.pow(2, 0.3);
      const maxP = median * Math.pow(2, 0.3);
      drawExpectedCurve(cur.tone, pitches, { min: minP, max: maxP });
    }

    if (elapsed < RECORD_MS) requestAnimationFrame(tick);
    else finish();
  };
  tick();

  function finish() {
    stream.getTracks().forEach(tr => tr.stop());
    audioCtx.close();
    toneSession.isRecording = false;

    const detected = classifyPitches(pitches);
    const grade = gradeTone(detected, cur.tone);
    const hint = (grade !== 'perfect' && detected) ? getHint(detected, cur.tone, currentLang) : '';

    toneSession.results[currentIdx] = { detected, grade, hint, pitches };
    renderTonePractice();
  }
}

function showResultFeedback(result, cur, t) {
  const status = document.getElementById('toneStatus');
  if (!status) return;
  const { detected, grade, hint } = result;

  const messages = {
    fr: {
      perfect: '🎉 Parfait !',
      close:   'Presque !',
      wrong:   'Pas tout à fait'
    },
    en: {
      perfect: '🎉 Perfect!',
      close:   'Almost!',
      wrong:   'Not quite'
    }
  };
  const msg = messages[currentLang][grade] || messages[currentLang].wrong;
  const detSym = detected ? TONE_NAMES[detected].symbol : '?';
  const expSym = TONE_NAMES[cur.tone].symbol;

  status.className = 'tone-status grade-' + grade;
  status.innerHTML = `
    <span class="result-msg">${msg}</span>
    <span class="result-tones">
      <span class="result-tone-label">${t.expected}: <strong>${expSym}</strong></span>
      <span class="result-tone-label">${t.yours}: <strong>${detSym}</strong></span>
    </span>
    ${hint ? `<span class="result-hint">${hint}</span>` : ''}
  `;

  // Re-draw with the recorded pitches so user can see what they did
  if (result.pitches) {
    const valid = result.pitches.filter(x => x !== null);
    if (valid.length > 3) {
      const sorted = [...valid].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const minP = median / Math.pow(2, 0.3);
      const maxP = median * Math.pow(2, 0.3);
      drawExpectedCurve(cur.tone, result.pitches, { min: minP, max: maxP });
    }
  }
}

function renderSessionSummary() {
  const section = document.getElementById('toneSection');
  if (!section || !toneSession) return;
  const { expected, results } = toneSession;

  const perfectCount = results.filter(r => r?.grade === 'perfect').length;
  const closeCount   = results.filter(r => r?.grade === 'close').length;
  const total = expected.length;

  const t = currentLang === 'fr' ? {
    title: 'Résultat',
    again: 'Tout recommencer',
    perfect: 'Excellent !',
    good: 'Bien joué',
    keepGoing: 'Continue à pratiquer'
  } : {
    title: 'Result',
    again: 'Start over',
    perfect: 'Excellent!',
    good: 'Well done',
    keepGoing: 'Keep practicing'
  };

  let summaryClass = 'try-again', summaryText = t.keepGoing;
  if (perfectCount === total) { summaryClass = 'all-ok'; summaryText = t.perfect; }
  else if (perfectCount + closeCount === total) { summaryClass = 'mostly-ok'; summaryText = t.good; }

  const stepsHtml = expected.map((exp, i) => {
    const r = results[i];
    const grade = r?.grade || 'wrong';
    const detSym = r?.detected ? TONE_NAMES[r.detected].symbol : '?';
    const expSym = TONE_NAMES[exp.tone].symbol;
    return `
      <div class="syl-result grade-${grade}">
        <span class="syl-pinyin">${exp.syllable}</span>
        <span class="syl-tone-mark expected">${expSym}</span>
        <span class="syl-arrow">→</span>
        <span class="syl-tone-mark detected">${detSym}</span>
      </div>`;
  }).join('');

  section.innerHTML = `
    <div class="syl-summary ${summaryClass}">
      <span class="summary-score">${perfectCount}/${total}</span>
      <span class="summary-text">${summaryText}</span>
    </div>
    <div class="syl-grid">${stepsHtml}</div>
    <div class="tone-actions">
      <button class="tone-action-btn primary" id="btnRestart">
        <i class="fa-solid fa-rotate-right"></i> ${t.again}
      </button>
    </div>
  `;
  document.getElementById('btnRestart').addEventListener('click', () => {
    startToneDetection(currentChar.pinyin);
  });
}

// =========================================================================
// LANGUAGE SWITCH
// =========================================================================
document.querySelectorAll('.lang-switch button').forEach(btn => {
  btn.addEventListener('click', () => {
    currentLang = btn.dataset.lang;
    document.querySelectorAll('.lang-switch button').forEach(b => b.classList.toggle('active', b === btn));
    document.documentElement.lang = currentLang;
    applyI18n();
    buildCharList();
    if (currentChar) {
      if (window.innerWidth <= 800) {
        // Only refresh popup if it's already open
        if (popupOverlay.classList.contains('open')) {
          popupBody.innerHTML = '';
          buildControls(popupBody);
        }
      } else {
        renderDetail(detailEl);
      }
    }
  });
});

function applyI18n() {
  const t = I18N[currentLang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    if (t[el.dataset.i18n]) el.textContent = t[el.dataset.i18n];
  });
  searchInput.placeholder = t.search;
  buildFilters();
}

// =========================================================================
// INIT
// =========================================================================
buildLevels();
applyI18n();
(async () => {
  await ensureLevelLoaded(currentLevel);
  buildCharList();
  if (window.innerWidth > 800 && HSK_DATA[currentLevel]?.length) {
    selectChar(HSK_DATA[currentLevel][0]);
  }
})();