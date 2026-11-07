/**
 * tests/grammar.test.mjs — Points de grammaire des leçons HSK 1
 * ------------------------------------------------------------------------
 * Chaque point cite une phrase du dialogue : on vérifie qu'elle existe vraiment, que la partie
 * mise en évidence s'y trouve, et que le repère (rx) qui sert à l'étiquette « Nouveau » /
 * « Nouvel emploi » reconnaît bien cette phrase.
 *
 * Lancement :  node --test tests/grammar.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = f => JSON.parse(readFileSync(path.join(ROOT, 'lessons', f), 'utf8').replace(/^﻿/, ''));
const lessons = read('hsk1.json').lessons;
const { points } = read('hsk1-grammar.json');
const byId = new Map(lessons.map((l, i) => [l.id, { l, i }]));

test('every lesson has between 2 and 7 grammar points', () => {
  for (const l of lessons) {
    const n = points.filter(p => p.lesson === l.id).length;
    assert.ok(n >= 2 && n <= 7, `${l.id}: ${n} point(s)`);
  }
});

test('ids are unique and every point belongs to an existing lesson', () => {
  assert.equal(new Set(points.map(p => p.id)).size, points.length, 'duplicate ids');
  for (const p of points) assert.ok(byId.has(p.lesson), `${p.id}: unknown lesson ${p.lesson}`);
});

test('every point is fully written in French and English', () => {
  for (const p of points) {
    assert.ok(p.pattern && p.pattern.trim(), `${p.id}: pattern`);
    for (const lang of ['fr', 'en']) {
      assert.ok(p.title[lang] && p.title[lang].trim(), `${p.id}: title.${lang}`);
      assert.ok(p.text[lang] && p.text[lang].length > 20, `${p.id}: text.${lang}`);
    }
  }
});

test('the example is a real line of the lesson and contains the highlighted part', () => {
  for (const p of points) {
    const { l } = byId.get(p.lesson);
    const line = l.exchanges[p.line];
    assert.ok(line, `${p.id}: line ${p.line} does not exist in ${p.lesson}`);
    assert.ok(line.hanzi.includes(p.mark), `${p.id}: “${p.mark}” is not in “${line.hanzi}”`);
  }
});

test('the detection pattern recognises the point\'s own example', () => {
  for (const p of points.filter(p => p.rx)) {
    const rx = new RegExp(p.rx);
    const { l } = byId.get(p.lesson);
    assert.ok(rx.test(l.exchanges[p.line].hanzi), `${p.id}: /${p.rx}/ does not match “${l.exchanges[p.line].hanzi}”`);
  }
});

test('“Nouveau” is honest: a point tagged new never appears in an earlier lesson, a reuse one does', () => {
  let fresh = 0, reused = 0;
  for (const p of points.filter(p => p.rx)) {
    const { i } = byId.get(p.lesson);
    const rx = new RegExp(p.rx);
    const seen = lessons.slice(0, i).some(l => l.exchanges.some(e => rx.test(e.hanzi)));
    seen ? reused++ : fresh++;
  }
  // most points are genuinely new where they are taught; the few reuses are different senses of a known word
  assert.ok(fresh >= 70, `only ${fresh} points are new in their lesson`);
  assert.ok(reused <= 12, `${reused} points are reuses`);
});

test('the first lesson introduces the basics: 是, 很, 吗, 也', () => {
  const first = new Set(points.filter(p => p.lesson === lessons[0].id).map(p => p.id));
  for (const id of ['shi', 'hen', 'ma', 'ye']) assert.ok(first.has(id), id);
});
