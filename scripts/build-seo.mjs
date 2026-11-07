// Génère les pages statiques indexables par les moteurs de recherche :
//   mot/<pinyin>-<codepoints>.html   une page par mot (5 000+), contenu en dur dans le HTML
//   vocabulaire-hsk-<n>.html         la liste complète d'un niveau
//   sitemap-mots.xml                 toutes ces URLs
// Sans cela, le dictionnaire n'est qu'une coquille JavaScript : un moteur ne voit aucun mot.
// Les fichiers générés sont ignorés par git ; deploy.ps1 relance ce script avant chaque envoi.
//
//   node scripts/build-seo.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SITE = 'https://www.xuehanyu.org';
const LEVELS = [1, 2, 3, 4, 5, 6];
const TODAY = new Date().toISOString().slice(0, 10);
// Même paramètre de version que les pages de l'app : un nouveau déploiement contourne le cache de Cloudflare.
const V = (readFileSync(join(ROOT, 'quiz.html'), 'utf8').match(/style\.css\?v=(\w+)/) || [])[1] || TODAY.replace(/-/g, '');

const POS = {
  v: 'verbe', n: 'nom', vn: 'nom verbal', m: 'mesure', t: 'temps', b: 'attribut', r: 'pronom',
  a: 'adjectif', d: 'adverbe', p: 'préposition', c: 'conjonction', u: 'particule',
  e: 'exclamation', q: 'classificateur', s: 'lieu', f: 'direction', o: 'onomatopée',
  y: 'particule modale', k: 'suffixe', an: 'adjectif nominal', g: 'morphème', qt: 'classificateur de durée', nr: 'nom de personne', ad: 'adverbe adjectival', nz: 'nom propre', cc: 'conjonction', qv: 'classificateur verbal', tg: 'morphème de temps', mq: 'numéral-classificateur', ns: 'nom de lieu', l: 'expression figée', z: 'verbe d’état', h: 'préfixe', Mg: 'morphème numérique', nt: 'nom d’organisation',
};
const FR_TYPOS = { 'frêre aîné': 'frère aîné' };

const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fixFr = s => Object.entries(FR_TYPOS).reduce((o, [a, b]) => o.split(a).join(b), s);

/** « nǐ hǎo » -> « ni3-hao3 » : ASCII, une syllabe par segment. */
function numbered(pinyin) {
  return pinyin.trim().split(/[\s']+/).map(syl => {
    let tone = '';
    const letters = syl.normalize('NFD').replace(/[̀-̄̌]/g, m => {
      tone = { '̄': '1', '́': '2', '̌': '3', '̀': '4' }[m] || tone;
      return '';
    }).toLowerCase().replace(/ü|ü/g, 'v').replace(/[^a-z]/g, '');
    return letters + tone;
  }).filter(Boolean).join('-');
}
const hex = s => [...s].map(c => c.codePointAt(0).toString(16)).join('-');

function load() {
  const words = [];
  const used = new Set();
  for (const level of LEVELS) {
    const raw = JSON.parse(readFileSync(join(ROOT, 'data', `hsk${level}.json`), 'utf8').replace(/^﻿/, ''));
    for (const e of raw) {
      let slug = `${numbered(e.pinyin) || 'mot'}-${hex(e.simplified)}`;
      for (let i = 2; used.has(slug); i++) slug = `${numbered(e.pinyin)}-${hex(e.simplified)}-${i}`;
      used.add(slug);
      words.push({
        level, slug, char: e.simplified, trad: e.traditional, radical: e.radical, pinyin: e.pinyin,
        pos: e.pos || [], classifiers: e.classifiers || [],
        fr: (Array.isArray(e.french) ? e.french : [e.french]).filter(Boolean).map(fixFr),
        en: (Array.isArray(e.english) ? e.english : [e.english]).filter(Boolean),
      });
    }
  }
  return words;
}

const short = (arr, n) => arr.slice(0, n).join(' ; ');

// Les moteurs coupent les titres à ~580 px (≈ 58 caractères latins, un idéogramme compte double) et les
// descriptions à ~155 caractères : on raccourcit nous-mêmes plutôt que de laisser un « … » arbitraire.
const width = s => [...s].reduce((n, c) => n + (c.codePointAt(0) > 0x2e80 ? 2 : 1), 0);
function fit(text, max, measure = s => s.length) {
  if (measure(text) <= max) return text;
  const words = text.split(' ');
  while (words.length > 1 && measure(words.join(' ') + '…') > max) words.pop();
  return words.join(' ').replace(/[ ;,:—-]+$/, '') + '…';
}
const BRAND = ' | xuehanyu.org';
const titleOf = base => (width(base + BRAND) <= 58 ? base + BRAND : fit(base, 58, width));
const wordUrl = w => `/mot/${w.slug}.html`;
const deepLink = w => `/app.html?w=${encodeURIComponent(w.char)}&l=${w.level}`;

function shell({ title, desc, canonical, body, jsonld, extraHead = '' }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${SITE}${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="xuehanyu.org">
<meta property="og:url" content="${SITE}${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:locale" content="fr_FR">
<meta property="og:image" content="${SITE}/xuehanyu.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#fffbf2">
${extraHead}<link rel="stylesheet" href="/fonts/manrope.css?v=${V}">
<link rel="stylesheet" href="/style.css?v=${V}">
<link rel="stylesheet" href="/seo.css?v=${V}">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body class="seo-body">
<div id="paper-bg" aria-hidden="true"></div>
<div class="app">
  <header class="topbar">
    <a class="brand" href="/" aria-label="xuehanyu.org"><span class="zh" lang="zh-Hans">学汉语</span><span class="brand-name sr-only">xuehanyu.org</span></a>
  </header>
  <nav class="site-nav" aria-label="Navigation">
    <a href="/"><i class="fa-solid fa-house"></i><span>Accueil</span></a>
    <a href="/app.html"><i class="fa-solid fa-book-open"></i><span>Dictionnaire</span></a>
    <a href="/quiz.html"><i class="fa-solid fa-images"></i><span>Quiz d'images</span></a>
    <a href="/lessons.html"><i class="fa-solid fa-comments"></i><span>Leçons</span></a>
  </nav>
  <main class="seo-main">
${body}
  </main>
  <footer class="seo-footer">
    Données <a href="https://www.mdbg.net/chinese/dictionary?page=cc-cedict" rel="noopener">CC-CEDICT</a> et
    <a href="https://chine.in/mandarin/open/CFDICT/" rel="noopener">CFDICT</a> (CC BY-SA) ·
    <a href="/">xuehanyu.org</a>
  </footer>
</div>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" integrity="sha384-/o6I2CkkWC//PSjvWC/eYN7l3xM3tJm8ZzVkCOfp//W05QcE3mlGskpoHB6XqI+B" crossorigin="anonymous" referrerpolicy="no-referrer">
</body>
</html>
`;
}

function wordPage(w, i, list) {
  const prev = list[i - 1], next = list[i + 1];
  const meaning = short(w.fr, 3) || short(w.en, 3);
  const head = `${w.char} (${w.pinyin})`;
  const suffix = ` — chinois HSK ${w.level}`;
  const budget = 58 - width(head) - width(' : ') - width(suffix);
  const title = titleOf(`${head} : ${fit(short(w.fr, 2) || short(w.en, 2), Math.max(budget, 12))}${suffix}`);
  const tail = ` HSK ${w.level} : pinyin, traduction, ordre des traits${w.classifiers.length ? ', classificateurs' : ''}.`;
  const desc = `${head} en chinois : ${fit(meaning, 138 - head.length - tail.length)}.${tail}`;
  const canonical = wordUrl(w);
  const badges = [`<span class="level-badge">HSK ${w.level}</span>`]
    .concat(w.pos.map(p => `<span class="pos-badge">${esc(POS[p] || p)}</span>`)).join(' ');
  const facts = [
    w.trad && w.trad !== w.char ? ['Caractères traditionnels', `<span lang="zh-Hant">${esc(w.trad)}</span>`] : null,
    w.radical ? ['Radical', `<span lang="zh-Hans">${esc(w.radical)}</span>`] : null,
    w.classifiers.length ? ['Classificateurs', w.classifiers.map(c => `<span lang="zh-Hans">${esc(typeof c === 'string' ? c : c.simplified || '')}</span>`).join(', ')] : null,
  ].filter(Boolean);
  const body = `    <nav class="crumbs" aria-label="Fil d'Ariane"><a href="/">Accueil</a> › <a href="/vocabulaire-hsk-${w.level}.html">Vocabulaire HSK ${w.level}</a> › <span lang="zh-Hans">${esc(w.char)}</span></nav>
    <article class="card seo-word">
      <h1><span class="seo-hanzi" lang="zh-Hans">${esc(w.char)}</span> <span class="seo-pinyin">${esc(w.pinyin)}</span></h1>
      <p class="seo-badges">${badges}</p>
      <h2>Signification en français</h2>
      <ul>${w.fr.map(m => `<li>${esc(m)}</li>`).join('') || '<li>—</li>'}</ul>
      <h2>Meaning in English</h2>
      <ul lang="en">${w.en.map(m => `<li>${esc(m)}</li>`).join('') || '<li>—</li>'}</ul>
${facts.length ? `      <dl class="seo-facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>\n` : ''}      <p><a class="btn primary" href="${deepLink(w)}">Voir l'ordre des traits et s'entraîner à l'oral</a></p>
    </article>
    <nav class="seo-pager" aria-label="Mots voisins">
      ${prev ? `<a href="${wordUrl(prev)}" rel="prev">← <span lang="zh-Hans">${esc(prev.char)}</span> ${esc(prev.pinyin)}</a>` : '<span></span>'}
      <a href="/vocabulaire-hsk-${w.level}.html">Tout le HSK ${w.level}</a>
      ${next ? `<a href="${wordUrl(next)}" rel="next"><span lang="zh-Hans">${esc(next.char)}</span> ${esc(next.pinyin)} →</a>` : '<span></span>'}
    </nav>`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'DefinedTerm', name: w.char, alternateName: w.pinyin, inLanguage: 'zh-Hans',
        description: meaning, url: SITE + canonical,
        inDefinedTermSet: { '@type': 'DefinedTermSet', name: `Vocabulaire HSK ${w.level}`, url: `${SITE}/vocabulaire-hsk-${w.level}.html` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: `Vocabulaire HSK ${w.level}`, item: `${SITE}/vocabulaire-hsk-${w.level}.html` },
          { '@type': 'ListItem', position: 3, name: w.char, item: SITE + canonical },
        ],
      },
    ],
  };
  return shell({ title, desc, canonical, body, jsonld });
}

function levelPage(level, words) {
  const title = titleOf(`Vocabulaire HSK ${level} : ${words.length} mots chinois avec pinyin`);
  const desc = `Liste complète du vocabulaire HSK ${level} : ${words.length} mots chinois avec pinyin, traduction française et anglaise, ordre des traits et quiz. Gratuit.`;
  const canonical = `/vocabulaire-hsk-${level}.html`;
  const rows = words.map(w => `<tr><th scope="row" lang="zh-Hans"><a href="${wordUrl(w)}">${esc(w.char)}</a></th><td>${esc(w.pinyin)}</td><td>${esc(short(w.fr, 3) || '—')}</td><td lang="en">${esc(short(w.en, 2) || '—')}</td></tr>`).join('\n');
  const others = LEVELS.filter(l => l !== level).map(l => `<a href="/vocabulaire-hsk-${l}.html">HSK ${l}</a>`).join(' · ');
  const body = `    <nav class="crumbs" aria-label="Fil d'Ariane"><a href="/">Accueil</a> › Vocabulaire HSK ${level}</nav>
    <article class="card">
      <h1>Vocabulaire chinois HSK ${level}</h1>
      <p>${words.length} mots du niveau HSK ${level}, avec le pinyin et la traduction en français et en anglais. Touchez un mot pour sa fiche, puis ouvrez le dictionnaire pour voir l'ordre des traits.</p>
      <p class="seo-levels">Autres niveaux : ${others}</p>
      <div class="seo-table-wrap"><table class="seo-table">
        <thead><tr><th scope="col">Mot</th><th scope="col">Pinyin</th><th scope="col">Français</th><th scope="col">English</th></tr></thead>
        <tbody>
${rows}
        </tbody>
      </table></div>
    </article>`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: `Vocabulaire HSK ${level}`, url: SITE + canonical, inLanguage: 'fr', description: desc },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: `Vocabulaire HSK ${level}`, item: SITE + canonical },
        ],
      },
    ],
  };
  return shell({ title, desc, canonical, body, jsonld });
}

// ------------------------------------------------------------------ main
const words = load();
const outDir = join(ROOT, 'mot');
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const urls = [];
for (const level of LEVELS) {
  const list = words.filter(w => w.level === level);
  list.forEach((w, i) => {
    writeFileSync(join(outDir, `${w.slug}.html`), wordPage(w, i, list));
    urls.push({ loc: wordUrl(w), priority: level <= 2 ? '0.6' : '0.5' });
  });
  writeFileSync(join(ROOT, `vocabulaire-hsk-${level}.html`), levelPage(level, list));
  urls.unshift({ loc: `/vocabulaire-hsk-${level}.html`, priority: '0.8' });
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITE}${u.loc}</loc><lastmod>${TODAY}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`;
writeFileSync(join(ROOT, 'sitemap-mots.xml'), sitemap);
console.log(`${words.length} pages de mots, ${LEVELS.length} pages de niveau, ${urls.length} URLs dans sitemap-mots.xml`);
