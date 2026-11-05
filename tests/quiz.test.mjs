/**
 * tests/quiz.test.mjs — Tests du quiz d'images (vocabulaire HSK 1)
 * ------------------------------------------------------------------------
 * 1. Intégrité du manifeste : schéma, unicité, présence des fichiers image
 * 2. Logique de sélection des distracteurs (le cœur du quiz)
 *
 * Lancement :  node --test tests/quiz.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const IMG_DIR = path.join(ROOT, 'assets', 'img');

const index = JSON.parse(readFileSync(path.join(IMG_DIR, 'index.json'), 'utf8'));

/** Tous les mots de tous les niveaux (pool global de distracteurs). */
const allWords = index.levels.flatMap(lvl => {
  const m = JSON.parse(readFileSync(path.join(IMG_DIR, lvl.manifest), 'utf8'));
  return m.words.map(w => ({ ...w, level: lvl.id }));
});

/** Un niveau donné. */
function levelWords(id) {
  const lvl = index.levels.find(l => l.id === id);
  if (!lvl) return [];
  const m = JSON.parse(readFileSync(path.join(IMG_DIR, lvl.manifest), 'utf8'));
  return m.words.map(w => ({ ...w, level: lvl.id }));
}

const manifest = { count: allWords.length, words: allWords };

// ---------------------------------------------------------------------------
// DOM simulé (même approche que tests/app-tone.test.mjs)
// ---------------------------------------------------------------------------
function makeCtx() {
  const state = {};
  return new Proxy({}, {
    get(_t, prop) {
      if (prop in state) return state[prop];
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
        return () => ({ addColorStop() {} });
      }
      if (prop === 'getImageData') {
        return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)) });
      }
      if (prop === 'measureText') return () => ({ width: 0 });
      return () => {};
    },
    set(_t, prop, value) { state[prop] = value; return true; }
  });
}

function makeElement(id) {
  const el = {
    id, className: '', textContent: '', style: {}, clientWidth: 300,
    width: 320, height: 90, children: [], dataset: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); }
    },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener() {}, removeEventListener() {},
    querySelector() { return makeElement(''); },
    querySelectorAll() { return []; },
    getContext() { return makeCtx(); },
    focus() {}, setAttribute() {}, getAttribute() { return null; }
  };
  let html = '';
  Object.defineProperty(el, 'innerHTML', {
    get() { return html; },
    set(v) {
      html = String(v);
      for (const m of html.matchAll(/id="([^"]+)"/g)) registry.set(m[1], makeElement(m[1]));
    }
  });
  return el;
}

const registry = new Map();
const document = {
  getElementById(id) {
    if (!registry.has(id)) registry.set(id, makeElement(id));
    return registry.get(id);
  },
  querySelector() { return makeElement(''); },
  querySelectorAll() { return []; },
  createElement(tag) { return makeElement(tag); },
  addEventListener() {},
  body: makeElement('body'),
  documentElement: makeElement('html')
};

const store = new Map();
const sandbox = {
  document, console,
  speechSynthesis: { getVoices: () => [], speak() {}, addEventListener() {} },
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  setTimeout: () => 0,
  clearTimeout: () => {},
  fetch: () => Promise.reject(new Error('offline')),
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k)
  },
  window: {
    innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1,
    addEventListener() {}, requestAnimationFrame: () => 0,
    scrollTo() {}
  }
};
sandbox.window.document = document;
sandbox.globalThis = sandbox;

const source = readFileSync(path.join(ROOT, 'srs.js'), 'utf8')
  + readFileSync(path.join(ROOT, 'quiz.js'), 'utf8');
const exposed = `
globalThis.__quiz = {
  pickDistractors, shuffle, buildDeck, isConfusable,
  get words() { return WORDS; },
  setWords(w) { WORDS = w; },
  get levelWords() { return LEVEL_WORDS; },
  setLevelWords(lv, w) { LEVEL_WORDS[lv] = w; },
  get currentLevel() { return currentLevel; },
  setCurrentLevel(lv) { currentLevel = lv; },
  get deck() { return deck; },
  get known() { return known; },
  setKnown(s) { known = new Set(s); },
  get onlyReview() { return onlyReview; },
  setOnlyReview(v) { onlyReview = v; },
  get cards() { return cards; },
  setCards(c) { cards = c; },
  setOnlyDue(v) { onlyDue = v; },
  gradeWord
};`;

vm.createContext(sandbox);
vm.runInContext(source + exposed, sandbox, { filename: 'srs.js+quiz.js' });

const quiz = sandbox.__quiz;

// ---------------------------------------------------------------------------
// 1. Intégrité du manifeste
// ---------------------------------------------------------------------------
test('le manifeste est cohérent', () => {
  assert.ok(manifest.words.length > 0, 'aucun mot dans le manifeste');
  assert.equal(manifest.count, manifest.words.length, 'count != words.length');
  assert.ok(index.levels.length >= 1, 'aucun niveau déclaré dans index.json');
  for (const lvl of index.levels) {
    assert.ok(levelWords(lvl.id).length > 0, `niveau HSK ${lvl.id} vide`);
  }
});

test('chaque mot a tous les champs requis', () => {
  for (const w of manifest.words) {
    assert.ok(w.char && w.slug && w.pinyin, `champ manquant sur ${w.slug}`);
    assert.ok(w.en, `sens anglais manquant sur ${w.slug}`);
    assert.ok(w.fr, `sens français manquant sur ${w.slug}`);
    assert.ok(w.cat, `catégorie manquante sur ${w.slug}`);
    assert.ok(w.image.endsWith('.webp'), `image non webp pour ${w.slug}`);
    assert.ok([1, 2, 3, 4].includes(w.tone), `ton invalide pour ${w.slug}: ${w.tone}`);
  }
});

test('les slugs et les images sont uniques', () => {
  const slugs = manifest.words.map(w => w.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'slugs dupliqués');
  const imgs = manifest.words.map(w => w.image);
  assert.equal(new Set(imgs).size, imgs.length, 'images dupliquées');
});

test('tous les fichiers image existent sur le disque', () => {
  for (const w of manifest.words) {
    const p = path.join(IMG_DIR, `hsk${w.level}`, w.image);
    assert.ok(existsSync(p), `image manquante: hsk${w.level}/${w.image}`);
  }
});

test('chaque mot appartient bien à son niveau HSK', () => {
  for (const lvl of index.levels) {
    const upstream = JSON.parse(
      readFileSync(path.join(ROOT, 'tests', 'fixtures', `hsk${lvl.id}-upstream.json`), 'utf8')
    );
    const known = new Set(upstream.map(e => e.simplified));
    const words = levelWords(lvl.id);
    assert.ok(words.length > 0, `niveau HSK ${lvl.id} vide`);
    for (const w of words) {
      assert.ok(known.has(w.char), `${w.char} n'est pas dans le HSK ${lvl.id} amont`);
    }
  }
});

test('les slugs sont uniques tous niveaux confondus', () => {
  const slugs = manifest.words.map(w => w.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'slugs dupliqués entre niveaux');
});

test('chaque niveau a son propre manifeste et son index est cohérent', () => {
  assert.ok(index.levels.length >= 2, 'au moins deux niveaux attendus');
  for (const lvl of index.levels) {
    const m = JSON.parse(readFileSync(path.join(IMG_DIR, lvl.manifest), 'utf8'));
    assert.equal(m.level, lvl.id, `niveau du manifeste incohérent pour HSK ${lvl.id}`);
    assert.equal(m.count, m.words.length, `count incohérent pour HSK ${lvl.id}`);
    assert.equal(m.words.length, lvl.count, `index incohérent pour HSK ${lvl.id}`);
  }
});

// ---------------------------------------------------------------------------
// 2. Logique des distracteurs
// ---------------------------------------------------------------------------
test('shuffle conserve tous les éléments', () => {
  const input = manifest.words.map(w => w.slug);
  const out = quiz.shuffle(input);
  assert.equal(out.length, input.length);
  assert.deepEqual([...out].sort(), [...input].sort());
});

test('pickDistractors renvoie 3 mots distincts, différents de la cible', () => {
  quiz.setWords(manifest.words);
  for (const target of manifest.words) {
    const d = quiz.pickDistractors(target, 3);
    assert.equal(d.length, 3, `nombre de distracteurs incorrect pour ${target.slug}`);
    assert.ok(!d.some(x => x.slug === target.slug), `la cible est dans ses propres distracteurs (${target.slug})`);
    assert.equal(new Set(d.map(x => x.slug)).size, 3, `distracteurs dupliqués pour ${target.slug}`);
  }
});

test('pickDistractors privilégie la même catégorie', () => {
  quiz.setWords(manifest.words);
  // Un mot dont la catégorie contient au moins 3 autres membres.
  const counts = {};
  for (const w of manifest.words) counts[w.cat] = (counts[w.cat] || 0) + 1;
  const target = manifest.words.find(w => counts[w.cat] >= 4);
  assert.ok(target, 'aucune catégorie assez fournie pour le test');

  // 40 trials : les distracteurs doivent majoritairement être de la même catégorie.
  let sameCat = 0;
  const trials = 40;
  for (let i = 0; i < trials; i++) {
    const d = quiz.pickDistractors(target, 3);
    sameCat += d.filter(x => x.cat === target.cat).length;
  }
  const total = trials * 3;
  assert.ok(sameCat / total > 0.6,
    `les distracteurs devraient être de la même catégorie (${sameCat}/${total})`);
});

test('aucun choix ne propose une paire indiscernable', () => {
  quiz.setWords(manifest.words);
  const confusable = w => new Set(w.confusable || []);

  for (const target of manifest.words) {
    const d = quiz.pickDistractors(target, 3);
    const options = [target, ...d];

    // 1. aucun distracteur ne doit être indiscernable de la bonne réponse
    for (const x of d) {
      assert.ok(!confusable(target).has(x.slug),
        `${x.slug} est indiscernable de ${target.slug} — ne doit jamais être proposé`);
      assert.ok(!confusable(x).has(target.slug),
        `paire non symétrique : ${target.slug} / ${x.slug}`);
    }

    // 2. deux distracteurs ne doivent pas être indiscernables entre eux
    for (let i = 0; i < d.length; i++) {
      for (let j = i + 1; j < d.length; j++) {
        assert.ok(!confusable(d[i]).has(d[j].slug),
          `${d[i].slug} et ${d[j].slug} sont indiscernables et proposés ensemble`);
      }
    }

    // 3. l'ensemble du jeu doit rester suffisant (3 distracteurs disponibles)
    assert.equal(d.length, 3, `pas assez de distracteurs pour ${target.slug}`);
  }
});

test('la liste des paires indiscernables est symétrique', () => {
  const present = new Set(manifest.words.map(w => w.slug));
  for (const w of manifest.words) {
    for (const other of w.confusable || []) {
      // une paire dont l'autre mot n'est pas encore publié n'est pas active
      if (!present.has(other)) continue;
      const o = manifest.words.find(x => x.slug === other);
      assert.ok((o.confusable || []).includes(w.slug),
        `paire non symétrique : ${w.slug} / ${other}`);
    }
  }
});

test('les distracteurs peuvent venir d’un niveau antérieur', () => {
  // HSK 2 est court : ses distracteurs doivent pouvoir venir du HSK 1,
  // sinon le quiz tourne en rond sur 13 mots.
  quiz.setLevelWords(1, levelWords(1));
  quiz.setLevelWords(2, levelWords(2));
  quiz.setCurrentLevel(2);

  const target = levelWords(2)[0];
  const d = quiz.pickDistractors(target, 3);
  assert.equal(d.length, 3, 'pas assez de distracteurs au niveau 2');
  const hsk1 = new Set(levelWords(1).map(w => w.slug));
  const fromL1 = d.filter(w => hsk1.has(w.slug));
  assert.ok(fromL1.length > 0,
    'aucun distracteur du niveau 1 alors que le niveau 2 est court');

  // le deck, lui, ne contient que les mots du niveau courant
  quiz.setOnlyReview(false);
  quiz.buildDeck();
  for (const w of quiz.deck) {
    assert.equal(w.level, 2, 'le deck mélange les niveaux');
  }
  quiz.setCurrentLevel(1);
});

test('buildDeck respecte le filtre « à revoir seulement »', () => {
  quiz.setCurrentLevel(1);
  quiz.setLevelWords(1, levelWords(1));
  const l1 = levelWords(1);
  quiz.setKnown(new Set(l1.slice(0, 10).map(w => w.slug)));

  quiz.setOnlyReview(false);
  quiz.buildDeck();
  assert.equal(quiz.deck.length, l1.length, 'deck complet attendu');

  quiz.setOnlyReview(true);
  quiz.buildDeck();
  assert.equal(quiz.deck.length, l1.length - 10, 'deck filtré attendu');
  for (const w of quiz.deck) {
    assert.ok(!quiz.known.has(w.slug), 'un mot déjà maîtrisé reste dans le deck filtré');
  }
  quiz.setOnlyReview(false);
});

// ---------------------------------------------------------------------------
// Spaced repetition
// ---------------------------------------------------------------------------
test('le deck « révisions » ne contient que les mots échus, tous niveaux confondus', () => {
  const [a, b, c] = allWords;
  quiz.setWords(allWords);
  quiz.setCards({
    [a.slug]: { ease: 2.5, interval: 1, reps: 1, lapses: 0, due: Date.now() - 1000 },
    [b.slug]: { ease: 2.5, interval: 1, reps: 1, lapses: 0, due: Date.now() + 86400000 }
  });
  quiz.setOnlyDue(true);
  quiz.buildDeck();
  quiz.setOnlyDue(false);
  assert.deepEqual(quiz.deck.map(w => w.slug), [a.slug]);
  assert.ok(c);
});

test('noter un mot crée sa carte et un échec la rend échue', () => {
  const w = allWords[0];
  quiz.setCards({});
  quiz.gradeWord(w, true);
  assert.equal(quiz.cards[w.slug].interval, 1);
  quiz.gradeWord(w, false);
  assert.equal(quiz.cards[w.slug].reps, 0);
});
