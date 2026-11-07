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
    HSK_DATA[level] = raw.map(toWordItem);
    loadingState[level] = 'loaded';
  } catch (err) {
    console.error('Erreur chargement HSK', level, err);
    loadingState[level] = 'error';
  }
  return HSK_DATA[level] || [];
}

// =========================================================================
// I18N
// =========================================================================
const I18N = {
  fr: {
    navHome:      'Accueil',
    navDict:      'Dictionnaire',
    navQuiz:      'Quiz d\'images',
    navLessons:   'Leçons',
    tagline:      'apprendre le chinois, un caractère à la fois',
    h1:           'Dictionnaire de chinois HSK 1 à 6',
    empty:        'Sélectionnez un caractère pour voir son tracé',
    search:       'Rechercher…',
    pinyin:       'pinyin',
    meaning:      'sens',
    pos:          'grammaire',
    level:        'niveau',
    filterAll:    'tout',
    filterChar:   'caractère',
    filterPinyin: 'pinyin',
    filterMeaning:'sens',
    loading:      'Chargement…',
    error:        'Erreur de chargement',
    none:         'Aucun caractère ne correspond',
    resultsCount: (n, t) => `${n} / ${t} caractères`,
    quizLink:     'Quiz d\'images',
    lessonsLink:  'Leçons'
  },
  en: {
    navHome:      'Home',
    navDict:      'Dictionary',
    navQuiz:      'Image quiz',
    navLessons:   'Lessons',
    tagline:      'learn Chinese, one character at a time',
    h1:           'Chinese dictionary, HSK 1 to 6',
    empty:        'Select a character to see its stroke order',
    search:       'Search…',
    pinyin:       'pinyin',
    meaning:      'meaning',
    pos:          'grammar',
    level:        'level',
    filterAll:    'all',
    filterChar:   'character',
    filterPinyin: 'pinyin',
    filterMeaning:'meaning',
    loading:      'Loading…',
    error:        'Loading error',
    none:         'No characters match',
    resultsCount: (n, t) => `${n} / ${t} characters`,
    quizLink:     'Image quiz',
    lessonsLink:  'Lessons'
  }
};
// Les chaînes de la fiche d'un mot vivent dans word-detail.js (partagées avec les leçons).
for (const l of ['fr', 'en']) Object.assign(I18N[l], DETAIL_I18N[l]);

let searchQuery   = '';
let searchFilter  = 'all';



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
    row.dataset.len = Math.min([...item.char].length, 5);
    row.innerHTML = `
      <div class="char-row-char">${esc(item.char)}</div>
      <div class="char-row-meta">
        <div class="char-row-pinyin">${esc(item.pinyin)}</div>
        <div class="char-row-meaning">${esc(item[currentLang])}</div>
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
  stopToneSession();                 // libère le micro si un essai était en cours
  currentChar = item;
  currentCharIndex = 0;
  buildCharList();
  if (window.innerWidth <= 800) openPopup();
  else renderDetail(detailEl);
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
  stopToneSession();                 // ne pas laisser le micro ouvert
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
// Lien direct depuis les pages statiques (SEO) : app.html?w=学&l=1 ouvre ce mot.
const deepLink = (() => {
  const p = new URLSearchParams(location.search);
  const lvl = Number(p.get('l'));
  return { word: p.get('w'), level: HSK_LEVELS.includes(lvl) ? lvl : null };
})();
if (deepLink.level) currentLevel = deepLink.level;

buildLevels();
applyI18n();
(async () => {
  await ensureLevelLoaded(currentLevel);
  buildCharList();
  const list = HSK_DATA[currentLevel] || [];
  const wanted = deepLink.word && list.find(it => it.char === deepLink.word);
  if (wanted) selectChar(wanted);
  else if (window.innerWidth > 800 && list.length) selectChar(list[0]);
})();