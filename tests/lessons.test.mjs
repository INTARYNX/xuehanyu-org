/**
 * tests/lessons.test.mjs — Tests des leçons de conversation HSK 1
 * ------------------------------------------------------------------------
 * 1. Intégrité des données : schéma, unicité, traductions, pinyin
 * 2. LA CONTRAINTE CENTRALE : chaque réplique ne doit s'écrire qu'avec des
 *    mots du vocabulaire HSK 1 (segmentation par appariement maximal).
 *    « 你好 » est valide : il se découpe en 你 + 好, tous deux dans la liste.
 *
 * Lancement :  node --test tests/lessons.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const Pinyin = require(path.join(ROOT, 'lessons-pinyin.js'));
const lessons = JSON.parse(readFileSync(path.join(ROOT, 'lessons', 'hsk1.json'), 'utf8'));
const vocabFile = JSON.parse(readFileSync(path.join(ROOT, 'lessons', 'hsk1-vocab.json'), 'utf8'));

const VOCAB = vocabFile.words;
const PUNCT = '。！？，、…：；·';

/** Appariement maximal : découpe la phrase en mots du vocabulaire HSK 1. */
function segment(hanzi) {
  const out = [];
  let i = 0;
  while (i < hanzi.length) {
    if (PUNCT.includes(hanzi[i])) { out.push({ punct: hanzi[i] }); i++; continue; }
    let hit = null;
    for (let n = Math.min(4, hanzi.length - i); n > 0; n--) {
      if (VOCAB[hanzi.slice(i, i + n)]) { hit = hanzi.slice(i, i + n); break; }
    }
    if (!hit) return null;
    out.push({ w: hit });
    i += hit.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. Intégrité des données
// ---------------------------------------------------------------------------
test('leçons : structure et unicité', () => {
  assert.ok(lessons.lessons.length > 0, 'aucune leçon');
  const ids = new Set();
  for (const l of lessons.lessons) {
    assert.ok(l.id, 'leçon sans id');
    assert.ok(!ids.has(l.id), `id dupliqué : ${l.id}`);
    ids.add(l.id);
    assert.ok(l.title && l.title.fr && l.title.en, `titre incomplet : ${l.id}`);
    assert.ok(l.level === 1, `niveau inattendu : ${l.id}`);
    assert.ok(l.exchanges.length >= 4, `leçon trop courte : ${l.id}`);
  }
});

test('chaque réplique a un pinyin et les deux traductions', () => {
  for (const l of lessons.lessons) {
    for (const e of l.exchanges) {
      assert.ok(e.hanzi && e.hanzi.length > 1, `hanzi vide : ${l.id}`);
      assert.ok(e.pinyin && e.pinyin.trim(), `pinyin vide : ${e.hanzi}`);
      assert.ok(e.fr && e.fr.trim(), `traduction FR vide : ${e.hanzi}`);
      assert.ok(e.en && e.en.trim(), `traduction EN vide : ${e.hanzi}`);
      assert.ok(e.who === 'A' || e.who === 'B', `locuteur invalide : ${e.hanzi}`);
    }
  }
});

test('le pinyin ne contient que de la ponctuation ASCII et des syllabes', () => {
  for (const l of lessons.lessons) {
    for (const e of l.exchanges) {
      assert.ok(!/[一-鿿]/.test(e.pinyin), `hanzi dans le pinyin : ${e.hanzi}`);
      assert.ok(!/[。！？，]/.test(e.pinyin), `ponctuation chinoise dans le pinyin : ${e.pinyin}`);
    }
  }
});

// ---------------------------------------------------------------------------
// 2. LA CONTRAINTE : vocabulaire HSK 1 uniquement
// ---------------------------------------------------------------------------
test('CHAQUE RÉPLIQUE n\'emploie que des mots du vocabulaire HSK 1', () => {
  const failures = [];
  for (const l of lessons.lessons) {
    for (const e of l.exchanges) {
      const tokens = segment(e.hanzi);
      if (tokens === null) {
        failures.push(`${l.id} : « ${e.hanzi} » — mot hors vocabulaire HSK 1`);
        continue;
      }
      for (const tk of tokens) {
        if (tk.w && !VOCAB[tk.w]) {
          failures.push(`${l.id} : « ${e.hanzi} » — « ${tk.w} » absent de HSK 1`);
        }
      }
    }
  }
  assert.equal(failures.length, 0, failures.join('\n'));
});

test('les mots affichés (puces) correspondent à la segmentation', () => {
  for (const l of lessons.lessons) {
    for (const e of l.exchanges) {
      const tokens = segment(e.hanzi);
      assert.ok(tokens, `segmentation impossible : ${e.hanzi}`);
      const expected = tokens.filter(tk => tk.w).map(tk => tk.w);
      assert.deepEqual(e.words, expected, `puces désynchronisées : ${e.hanzi}`);
    }
  }
});

test('le vocabulaire publié couvre les mots utilisés', () => {
  const used = new Set(lessons.lessons.flatMap(l => l.exchanges.flatMap(e => e.words)));
  for (const w of used) {
    assert.ok(VOCAB[w], `mot utilisé absent du fichier vocabulaire : ${w}`);
    assert.ok(VOCAB[w].p, `pinyin manquant dans le vocabulaire : ${w}`);
  }
  assert.ok(used.size > 50, `vocabulaire suspiciously réduit : ${used.size} mots`);
});

test('le vocabulaire publié reste dans les 294 entrées HSK 1', () => {
  assert.equal(Object.keys(VOCAB).length, 294, 'le vocabulaire doit contenir les 294 entrées HSK 1');
  for (const [w, v] of Object.entries(VOCAB)) {
    assert.ok(v.p, `pinyin vide : ${w}`);
    assert.ok(typeof v.fr === 'string' && typeof v.en === 'string', `sens manquant : ${w}`);
  }
});

// ---------------------------------------------------------------------------
// 3. SANDHI — le pinyin affiché doit être le pinyin « en phrase »
// ---------------------------------------------------------------------------
test('sandhi : 3+3 → 2+3, 不+4 → bú, 一 → yí / yì', () => {
  const cas = [
    ['hěn hǎo.',        'hén hǎo.',        '3+3 → 2+3'],
    ['wǒ hěn hǎo.',    'wó hén hǎo.',    'trois 3e tons : les deux premiers deviennent 2e'],
    ['wǒ xiǎng hē shuǐ.', 'wó xiǎng hē shuǐ.', 'seule la paire 我想 est concernée'],
    ['bù yào mǐ fàn.',  'bú yào mǐ fàn.',  '不+4 → bú'],
    ['yī gè rén.',      'yí gè rén.',      '一+4 → yí'],
    ['yī tiān.',        'yì tiān.',        '一+1 → yì'],
    ['bù yī gè.',       'bù yí gè.',       '不 devant un 1er ton reste bù'],
  ];
  for (const [input, attendu, label] of cas) {
    assert.equal(Pinyin.phrasePinyin(input), attendu, `${label} : ${input}`);
  }
});

test('le sandhi ne traverse pas une ponctuation', () => {
  // « hǎo! » (3e ton) suivi de « hěn » (3e ton) : rien ne change.
  assert.equal(Pinyin.phrasePinyin('nín hǎo! hěn gāo xìng.'), 'nín hǎo! hěn gāo xìng.');
  assert.equal(Pinyin.phrasePinyin('nǐ hǎo ma?'), 'ní hǎo ma?');
});

test('chaque réplique a un pinyin « en phrase » sans syllabe vide', () => {
  for (const l of lessons.lessons) {
    for (const e of l.exchanges) {
      const p = Pinyin.phrasePinyin(e.pinyin);
      assert.ok(p.trim(), `pinyin vide : ${e.hanzi}`);
      assert.ok(!/\s{2,}/.test(p), `espaces multiples : ${e.hanzi}`);
      assert.ok(p.split(/\s+/).length === e.pinyin.split(/\s+/).length,
        `nombre de syllabes modifié : ${e.hanzi}`);
    }
  }
});

// ---------------------------------------------------------------------------
// 4. INTÉGRITÉ DU TEXTE ET COUVERTURE
// ---------------------------------------------------------------------------
test('aucun caractère corrompu (U+FFFD) dans les leçons', () => {
  for (const l of lessons.lessons) {
    for (const e of l.exchanges) {
      assert.ok(!e.hanzi.includes('�'), `caractère corrompu : ${e.hanzi}`);
      assert.ok(!e.fr.includes('�'), `caractère corrompu (FR) : ${e.fr}`);
      assert.ok(!e.en.includes('�'), `caractère corrompu (EN) : ${e.en}`);
      assert.ok(!e.pinyin.includes('�'), `caractère corrompu (pinyin) : ${e.pinyin}`);
    }
  }
});

test('les leçons couvrent presque tout le vocabulaire HSK 1', () => {
  const used = new Set(lessons.lessons.flatMap(l => l.exchanges.flatMap(e => e.words)));
  const ratio = used.size / Object.keys(VOCAB).length;
  assert.ok(ratio >= 0.95, `couverture insuffisante : ${(ratio * 100).toFixed(1)} %`);
  // 们 (plural suffix) et 生 (fragment) sont structurellement impossibles à
  // utiliser seuls : ils n'existent que soudés à un autre mot.
  const impossible = ['们', '生'];
  for (const w of Object.keys(VOCAB)) {
    if (impossible.includes(w)) continue;
    assert.ok(used.has(w), `mot HSK 1 jamais utilisé : ${w}`);
  }
});

// ---------------------------------------------------------------------------
// 5. REGISTRE ET GLOSSES
// ---------------------------------------------------------------------------
test('un seul registre en français : le tutoiement', () => {
  for (const l of lessons.lessons) {
    for (const e of l.exchanges) {
      assert.ok(
        !/\b(vous|votre|vos)\b/i.test(e.fr),
        `${l.id} : « vous » dans « ${e.fr} » — le registre doit être uniforme (tu)`
      );
      assert.ok(
        !/\b(vous|votre|vos)\b/i.test(e.en),
        `${l.id} : registre incohérent côté anglais : « ${e.en} »`
      );
      // Impératif à la 2e personne du pluriel (« Prenez », « Donnez »…).
      assert.ok(
        !/\b(prenez|donnez|regardez|parlez|ecoutez|attendez|cherchez|allez|venez|faites|dites)\b/i.test(e.fr),
        `${l.id} : impératif « vous » dans « ${e.fr} »`
      );
    }
  }
});

test('les sens FR/EN ne sont pas découpés caractère par caractère', () => {
  // Régression : "; ".join("papa") produit "p; a; p; a".
  for (const [w, v] of Object.entries(VOCAB)) {
    for (const field of ['fr', 'en']) {
      const parts = v[field].split(';');
      if (parts.length < 2) continue;
      // Signature exacte du bug : tous les fragments font un seul caractère.
      const allSingle = parts.every(p => p.length <= 1);
      assert.ok(
        !allSingle,
        `${w} : sens ${field} découpé en caractères (« ${v[field]} »)`
      );
    }
  }
});

test('chaque échange a une traduction FR et EN non vide', () => {
  for (const l of lessons.lessons) {
    for (const e of l.exchanges) {
      assert.ok(e.fr.trim().length > 0, `${l.id} : FR vide`);
      assert.ok(e.en.trim().length > 0, `${l.id} : EN vide`);
      assert.ok(e.fr.trim() !== e.en.trim() || e.hanzi.length <= 3,
        `${l.id} : FR et EN identiques sur une phrase longue`);
    }
  }
});
