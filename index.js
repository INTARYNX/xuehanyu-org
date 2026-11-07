'use strict';

// ========================================================================
// I18N — every key maps to a [data-t] attribute. Values may contain HTML.
// ========================================================================
const COPY = {
  fr: {
    tagline:  'Apprendre le chinois mandarin,<br>un caractère à la fois.',
    cta:      'Commencer à pratiquer',
    ctaLessons: 'Leçons',
    ctaDict:  'Dictionnaire',
    scroll:   'Découvrir',
    label1:   'Le projet',
    h1:       "Un outil libre pour apprendre le chinois gratuitement",
    p1a:      'xuehanyu.org est une application web gratuite et open source pour apprendre le vocabulaire du mandarin. Elle couvre les niveaux HSK 1 à 6 — soit plus de 5 000 caractères — avec leur tracé animé, leur pinyin, leur traduction en français et en anglais, leur radical, leurs classificateurs et leur catégorie grammaticale.',
    p1b:      'Pensée pour les apprenants francophones et anglophones, l\'interface est entièrement bilingue. Aucun compte, aucune publicité, aucun abonnement.',
    label2:   'Fonctionnalités',
    h2:       'Tout ce qu\'il faut pour progresser',
    f1t:      'Tracé animé',
    f1b:      'Chaque caractère s\'anime trait par trait selon l\'ordre de tracé correct. Mode quiz pour s\'entraîner à le reproduire à la main.',
    f2t:      'Prononciation',
    f2b:      'Écoute la prononciation native grâce à la synthèse vocale. Entraîne-toi aux tons avec le détecteur de hauteur en temps réel.',
    f3t:      'Fiche complète',
    f3b:      'Pinyin avec tons, sens, forme traditionnelle, radical, catégorie grammaticale et classificateurs pour chaque entrée.',
    f4t:      'Recherche rapide',
    f4b:      'Cherche par caractère, pinyin ou sens. Filtre par niveau HSK. Résultats instantanés parmi plus de 5 000 entrées.',
    f5t:      'Quiz d\'images',
    f5b:      '145 mots HSK 1-2 appris par l\'image, en cartes ou en choix multiples. Les révisions sont planifiées en répétition espacée.',
    f6t:      'Leçons',
    f6b:      '25 dialogues HSK 1 qui n\'emploient que des mots HSK 1, avec pinyin tel qu\'il se prononce, traduction et audio. Tout fonctionne hors ligne après une première visite.',
    label3:   'À propos',
    h3:       'Un projet signé intarynx',
    p3a:      'xuehanyu.org est un projet développé par <a href="https://www.intarynx.com" target="_blank" rel="noopener">intarynx</a> — passionné par les langues, la calligraphie et l\'open source.',
    p3b:      'Le site repose sur des données libres : <a href="https://hanziwriter.org" target="_blank" rel="noopener">Hanzi Writer</a> pour les tracés, <a href="https://www.mdbg.net/chinese/dictionary?page=cc-cedict" target="_blank" rel="noopener">CC-CEDICT</a> et <a href="https://chine.in/mandarin/open/CFDICT/" target="_blank" rel="noopener">CFDICT</a> pour les dictionnaires, <a href="https://github.com/drkameleon/complete-hsk-vocabulary" target="_blank" rel="noopener">complete-hsk-vocabulary</a> pour le corpus HSK.',
    label4:   'Open source',
    h4:       'Libre, gratuit, sans données personnelles',
    p4a:      'Pas de compte requis. Pas de cookies de suivi. Tout le code est disponible librement. Le projet est conçu pour durer et rester accessible.',
    p4b:      'Contributions et retours bienvenus.',
        label5: "Vocabulaire",
    h5: "Le vocabulaire HSK 1 à 6, niveau par niveau",
    p5: "Chaque niveau du HSK a sa liste complète : caractères simplifiés, pinyin avec les tons, traduction française et anglaise. Parcourez la liste d'un niveau, ouvrez la fiche d'un mot, puis entraînez-vous à le tracer et à le prononcer.",
    vocab: "Vocabulaire",
    words: "mots",
    label6: "Méthode",
    h6: "Apprendre le chinois en ligne, pas à pas",
    s1t: "Commencez par le HSK 1",
    s1b: "Les mots les plus fréquents, appris par l'image avec le quiz. Dix mots par jour suffisent pour garder le rythme.",
    s2t: "Écoutez et répétez",
    s2b: "Chaque mot se prononce avec la synthèse vocale, et le détecteur de tons compare votre voix à la courbe attendue.",
    s3t: "Écrivez à la main",
    s3b: "Le tracé animé montre l'ordre des traits, puis vous le reproduisez vous-même. Les leçons de dialogue remettent les mots en contexte.",
    s4t: "Revenez chaque jour",
    s4b: "La répétition espacée vous représente les mots au bon moment, et un rappel facultatif vous prévient si vous n'avez pas encore pratiqué.",
    label7: "Questions fréquentes",
    h7: "Tout savoir avant de commencer",
    q1: "xuehanyu.org est-il gratuit ?",
    a1: "Oui, xuehanyu.org est entièrement gratuit, sans publicité, sans abonnement et sans compte requis.",
    q2: "Quels niveaux HSK sont couverts ?",
    a2: "Les niveaux HSK 1 à 6 sont couverts, soit plus de 5 000 mots avec pinyin, traduction française et anglaise, radical et classificateurs.",
    q3: "Peut-on apprendre à écrire les caractères ?",
    a3: "Oui, chaque caractère est animé trait par trait selon l'ordre de tracé correct, avec un mode quiz pour s'entraîner à l'écrire à la main.",
    q4: "Qu'est-ce que le HSK ?",
    a4: "Le HSK (Hanyu Shuiping Kaoshi) est l'examen officiel de chinois pour les non-natifs. Ses six niveaux, du plus simple au plus avancé, servent de repère pour choisir le vocabulaire à apprendre en premier.",
    q5: "Peut-on utiliser l'application hors ligne ?",
    a5: "Oui. Une fois une page visitée, l'application fonctionne sans connexion, et elle peut s'installer sur l'écran d'accueil de votre téléphone comme une application.",
    q6: "Comment fonctionne le rappel quotidien ?",
    a6: "Sur la page Quiz, choisissez une heure : vous recevez une notification seulement si vous n'avez pas encore pratiqué ce jour-là. Aucun compte n'est nécessaire et vous pouvez le désactiver à tout moment. Sur iPhone, il faut d'abord ajouter l'application à l'écran d'accueil.",
    shareLabel: "Partager",
    shareText: "Apprendre le chinois gratuitement",
    badge:    'un projet'
  },
  en: {
    tagline:  'Learn Mandarin Chinese,<br>one character at a time.',
    cta:      'Start practising',
    ctaLessons: 'Lessons',
    ctaDict:  'Dictionary',
    scroll:   'Discover',
    label1:   'The project',
    h1:       "A free tool to learn Chinese online",
    p1a:      'xuehanyu.org is a free, open-source web app for learning Mandarin vocabulary. It covers HSK levels 1 through 6 — over 5,000 characters — with animated stroke order, pinyin, French and English translations, radicals, classifiers and grammatical categories.',
    p1b:      'Designed for French and English learners, the interface is fully bilingual. No account, no ads, no subscription.',
    label2:   'Features',
    h2:       'Everything you need to make progress',
    f1t:      'Animated strokes',
    f1b:      'Every character animates stroke by stroke in the correct order. Quiz mode to practise writing it by hand.',
    f2t:      'Pronunciation',
    f2b:      'Listen to native pronunciation via speech synthesis. Practise tones with a real-time pitch detector.',
    f3t:      'Full detail card',
    f3b:      'Pinyin with tone marks, meaning, traditional form, radical, grammar category and classifiers for every entry.',
    f4t:      'Fast search',
    f4b:      'Search by character, pinyin, or meaning. Filter by HSK level. Instant results across 5,000+ entries.',
    f5t:      'Image quiz',
    f5b:      '145 HSK 1-2 words learned from pictures, as flashcards or multiple choice. Reviews are scheduled with spaced repetition.',
    f6t:      'Lessons',
    f6b:      '25 HSK 1 dialogues that only use HSK 1 words, with pinyin as pronounced, translation and audio. Everything works offline after a first visit.',
    label3:   'About',
    h3:       'A project by intarynx',
    p3a:      'xuehanyu.org is a project built by <a href="https://www.intarynx.com" target="_blank" rel="noopener">intarynx</a> — passionate about languages, calligraphy and open source.',
    p3b:      'The site is powered by open data: <a href="https://hanziwriter.org" target="_blank" rel="noopener">Hanzi Writer</a> for stroke data, <a href="https://www.mdbg.net/chinese/dictionary?page=cc-cedict" target="_blank" rel="noopener">CC-CEDICT</a> and <a href="https://chine.in/mandarin/open/CFDICT/" target="_blank" rel="noopener">CFDICT</a> for dictionaries, <a href="https://github.com/drkameleon/complete-hsk-vocabulary" target="_blank" rel="noopener">complete-hsk-vocabulary</a> for the HSK corpus.',
    label4:   'Open source',
    h4:       'Free, open, no personal data',
    p4a:      'No account required. No tracking cookies. All code is freely available. Built to last and stay accessible.',
    p4b:      'Contributions and feedback are welcome.',
        label5: "Vocabulary",
    h5: "HSK 1 to 6 vocabulary, level by level",
    p5: "Every HSK level has its complete list: simplified characters, pinyin with tones, French and English translations. Browse a level, open a word's page, then practise writing and pronouncing it.",
    vocab: "Vocabulary",
    words: "words",
    label6: "Method",
    h6: "Learn Chinese online, step by step",
    s1t: "Start with HSK 1",
    s1b: "The most frequent words, learned from pictures with the quiz. Ten words a day is enough to keep the pace.",
    s2t: "Listen and repeat",
    s2b: "Every word is spoken with speech synthesis, and the tone detector compares your voice with the expected pitch curve.",
    s3t: "Write by hand",
    s3b: "The animated strokes show the stroke order, then you reproduce it yourself. Dialogue lessons put the words back in context.",
    s4t: "Come back every day",
    s4b: "Spaced repetition shows you the words at the right moment, and an optional reminder tells you if you have not practised yet.",
    label7: "Frequently asked questions",
    h7: "Everything to know before you start",
    q1: "Is xuehanyu.org free?",
    a1: "Yes, xuehanyu.org is completely free, with no ads, no subscription and no account required.",
    q2: "Which HSK levels are covered?",
    a2: "HSK levels 1 to 6 are covered: over 5,000 words with pinyin, French and English translations, radical and classifiers.",
    q3: "Can I learn to write the characters?",
    a3: "Yes, every character is animated stroke by stroke in the correct order, with a quiz mode to practise writing it by hand.",
    q4: "What is the HSK?",
    a4: "The HSK (Hanyu Shuiping Kaoshi) is the official Chinese proficiency test for non-native speakers. Its six levels, from the simplest to the most advanced, are a guide to which vocabulary to learn first.",
    q5: "Can I use the app offline?",
    a5: "Yes. Once a page has been visited, the app works without a connection, and it can be installed on your phone's home screen like an app.",
    q6: "How does the daily reminder work?",
    a6: "On the Quiz page, choose a time: you get a notification only if you have not practised yet that day. No account is needed and you can turn it off at any time. On iPhone, add the app to the home screen first.",
    shareLabel: "Share",
    shareText: "Learn Chinese for free",
    badge:    'a project by'
  }
};

function applyLang(l) {
  const t = COPY[l];
  if (!t) return;
  document.documentElement.lang = l;
  // Generic: fill every [data-t] node from the dictionary. No hardcoded ids.
  document.querySelectorAll('[data-t]').forEach(el => {
    const val = t[el.dataset.t];
    if (val !== undefined) el.innerHTML = val;
  });
  document.querySelectorAll('#langToggle button').forEach(b =>
    b.classList.toggle('active', b.dataset.lang === l)
  );
}

document.getElementById('langToggle').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (btn) applyLang(btn.dataset.lang);
});

applyLang('fr');

document.getElementById('scrollDown').addEventListener('click', () => {
  document.getElementById('start').scrollIntoView({ behavior: 'smooth' });
});

// ========================================================================
// PAPER BACKGROUND
// ========================================================================
const paperCanvas = document.getElementById('paper-bg');
const pctx = paperCanvas.getContext('2d');

function buildPaper() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  paperCanvas.width = W * dpr; paperCanvas.height = H * dpr;
  paperCanvas.style.width = W + 'px'; paperCanvas.style.height = H + 'px';
  pctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const grad = pctx.createRadialGradient(W*.45, H*.4, W*.1, W/2, H/2, Math.max(W,H)*.85);
  grad.addColorStop(0, '#f0e4c5'); grad.addColorStop(0.6, '#e3d2a8'); grad.addColorStop(1, '#c9b582');
  pctx.fillStyle = grad; pctx.fillRect(0, 0, W, H);

  const img = pctx.getImageData(0, 0, W*dpr, H*dpr);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random()-.5)*8;
    d[i] = Math.max(0, Math.min(255, d[i]+n));
    d[i+1] = Math.max(0, Math.min(255, d[i+1]+n));
    d[i+2] = Math.max(0, Math.min(255, d[i+2]+n*.85));
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

  const bc = Math.floor(W*H/20);
  for (let i = 0; i < bc; i++) {
    const x = Math.random()*W, y = Math.random()*H, sz = 0.4+Math.random()*1;
    pctx.fillStyle = `rgba(110,80,50,${0.04+Math.random()*.05})`;
    pctx.beginPath(); pctx.arc(x+.3, y+.3, sz, 0, Math.PI*2); pctx.fill();
    pctx.fillStyle = `rgba(255,240,200,${0.1+Math.random()*.1})`;
    pctx.beginPath(); pctx.arc(x-.25, y-.25, sz*.85, 0, Math.PI*2); pctx.fill();
  }

  const vig = pctx.createRadialGradient(W/2, H/2, Math.min(W,H)*.35, W/2, H/2, Math.max(W,H)*.75);
  vig.addColorStop(0, 'rgba(80,50,20,0)'); vig.addColorStop(1, 'rgba(60,35,15,0.22)');
  pctx.fillStyle = vig; pctx.fillRect(0, 0, W, H);
}

// ========================================================================
// HERO CALLIGRAPHY ANIMATION
// ========================================================================
const CONFIG = {
  chars:        ['福','禄','寿','喜','財','富','吉','祥','安','康','順','和','愛','美','德','貴','榮','恩','緣','心','夢','靜','禪','永','龍','鳳','春','光','道','茶'],
  centralPool:  ['福','禄','寿','喜','財','吉','祥','安','康','富'],
  inks:         ['#1a1310','#1f1815','#161210','#231a14','#1c1410'],
  lifetimeMs:   4500,
  fadeMs:       1400,
  spawnMinMs:   900,
  spawnMaxMs:   1600,
  retryMs:      200,
  targetVisible:6,
  centralChangeMs: 9000,
  exclusionFrac:0.31
};

const hanziHost = document.getElementById('hanzi-host');
const sealEl = document.getElementById('central-seal');
const sealHanzi = document.getElementById('central-seal-hanzi');

let W = window.innerWidth, H = window.innerHeight;
let chars = [];
let centralChar = '福';
let centralBusy = false;

// ---- central seal ----
function buildCentralSeal() {
  const s = Math.min(W, H) * 0.48;
  const hw = s * 0.6;
  sealEl.style.width = s + 'px';
  sealEl.style.height = s + 'px';
  sealHanzi.style.left = (s - hw) / 2 + 'px';
  sealHanzi.style.top = (s - hw) / 2 + 'px';
  sealHanzi.style.width = hw + 'px';
  sealHanzi.style.height = hw + 'px';
  sealHanzi.style.opacity = '1';
  drawCentral(centralChar);
}

function drawCentral(char) {
  sealHanzi.innerHTML = '';
  centralBusy = true;
  const hw = parseFloat(sealHanzi.style.width) || 100;
  try {
    HanziWriter.create(sealHanzi, char, {
      width: hw, height: hw, padding: 5,
      strokeColor: '#b03020', strokeAnimationSpeed: 0.5,
      delayBetweenStrokes: 400, showOutline: false, showCharacter: false
    }).animateCharacter({ onComplete: () => { centralBusy = false; } });
  } catch (e) {
    sealHanzi.innerHTML = `<div style="font-size:${hw*.85}px;font-family:'STKaiti','Kaiti SC',serif;font-weight:bold;color:#b03020;text-align:center;line-height:${hw}px;">${char}</div>`;
    centralBusy = false;
  }
}

function changeCentral() {
  let next;
  do { next = CONFIG.centralPool[Math.floor(Math.random()*CONFIG.centralPool.length)]; }
  while (next === centralChar && CONFIG.centralPool.length > 1);
  centralChar = next;
  sealHanzi.style.opacity = '0';
  setTimeout(() => { drawCentral(next); sealHanzi.style.opacity = '1'; }, 600);
}

// ---- placement (best-candidate sampling) ----
function pickPosition(size) {
  const cx = W/2, cy = H/2;
  const excl = Math.min(W, H) * CONFIG.exclusionFrac;
  const margin = size * 0.55;
  let best = null, bestScore = -Infinity;
  for (let i = 0; i < 25; i++) {
    const x = margin + Math.random() * (W - margin*2);
    const y = margin + Math.random() * (H - margin*2);
    if (Math.hypot(x-cx, y-cy) - size*0.5 < excl) continue;
    let minD = Infinity, conflict = false;
    for (const c of chars) {
      const d = Math.hypot(x-c.x, y-c.y) - (size+c.size)*0.5;
      if (!c.fading && d < size*0.15) { conflict = true; break; }
      if (d < minD) minD = d;
    }
    if (conflict) continue;
    const edge = Math.min(x-margin, W-margin-x, y-margin, H-margin-y);
    const center = Math.hypot(x-cx, y-cy) - excl - size*0.5;
    const score = Math.min(minD, edge, center);
    if (score > bestScore) { bestScore = score; best = { x, y }; }
  }
  return best;
}

function randomSize() {
  const r = Math.random();
  if (r < 0.4) return Math.min(W, H) * (0.10 + Math.random()*0.06);
  if (r < 0.8) return Math.min(W, H) * (0.16 + Math.random()*0.10);
  return Math.min(W, H) * (0.24 + Math.random()*0.12);
}

function spawnChar(now) {
  const size = randomSize();
  const pos = pickPosition(size);
  if (!pos) return null;

  const char = CONFIG.chars[Math.floor(Math.random()*CONFIG.chars.length)];
  const ink = CONFIG.inks[Math.floor(Math.random()*CONFIG.inks.length)];

  const slot = document.createElement('div');
  slot.className = 'char-slot';
  slot.style.cssText =
    `width:${size}px;height:${size}px;left:${pos.x-size/2}px;top:${pos.y-size/2}px;` +
    `transform:rotate(${(Math.random()-.5)*0.35}rad);opacity:${(0.75+Math.random()*0.18).toFixed(2)};`;
  hanziHost.appendChild(slot);

  const obj = { slot, x: pos.x, y: pos.y, size, completed: false, completionTime: 0, fading: false };

  try {
    HanziWriter.create(slot, char, {
      width: size, height: size, padding: Math.max(2, size*0.04),
      strokeColor: ink, strokeAnimationSpeed: 100,
      delayBetweenStrokes: 80 + Math.random()*80,
      showOutline: false, showCharacter: false
    }).animateCharacter({
      onComplete: () => { obj.completed = true; obj.completionTime = performance.now(); }
    });
  } catch (e) {
    slot.innerHTML = `<div style="font-size:${size*.85}px;font-family:'STKaiti','Kaiti SC',serif;color:${ink};text-align:center;line-height:${size}px;">${char}</div>`;
    obj.completed = true; obj.completionTime = now;
  }

  chars.push(obj);
  return obj;
}

function fadeOut(obj) {
  if (obj.fading) return;
  obj.fading = true;
  obj.slot.classList.add('fading');
  obj.slot.style.opacity = '0';
  setTimeout(() => {
    obj.slot.remove();
    chars = chars.filter(c => c !== obj);
  }, CONFIG.fadeMs + 100);
}

// ---- main loop ----
let lastSpawn = 0, nextSpawnDelay = CONFIG.spawnMinMs, lastCentralChange = 0;

function loop(now) {
  if (!centralBusy && now - lastCentralChange > CONFIG.centralChangeMs) {
    changeCentral();
    lastCentralChange = now;
  }

  if (!chars.some(c => c.fading)) {
    let oldest = null;
    for (const c of chars) {
      if (!c.fading && c.completed && now - c.completionTime > CONFIG.lifetimeMs) {
        if (!oldest || c.completionTime < oldest.completionTime) oldest = c;
      }
    }
    if (oldest) fadeOut(oldest);
  }

  if (now - lastSpawn > nextSpawnDelay) {
    const fresh = chars.filter(c => !c.fading).length;
    if (fresh < CONFIG.targetVisible) {
      const spawned = spawnChar(now);
      nextSpawnDelay = spawned
        ? CONFIG.spawnMinMs + Math.random()*(CONFIG.spawnMaxMs - CONFIG.spawnMinMs)
        : CONFIG.retryMs;
    } else {
      nextSpawnDelay = 500;
    }
    lastSpawn = now;
  }

  requestAnimationFrame(loop);
}

// ---- init + resize ----
function onResize() {
  W = window.innerWidth;
  H = window.innerHeight;
  buildPaper();
  buildCentralSeal();
}
window.addEventListener('resize', onResize);

buildPaper();
buildCentralSeal();
requestAnimationFrame(loop);
