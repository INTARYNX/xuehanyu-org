/**
 * tests/srs.test.mjs — Spaced repetition scheduler (srs.js)
 * Run:  node --test tests/srs.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const SRS = createRequire(import.meta.url)('../srs.js');
const DAY = 86400000;
const T0 = 1_700_000_000_000;

test('a first success is due in 1 day, then 3, then grows by the ease', () => {
  let c = SRS.grade(undefined, true, T0);
  assert.equal(c.interval, 1);
  assert.equal(c.due, T0 + DAY);
  c = SRS.grade(c, true, c.due);
  assert.equal(c.interval, 3);
  c = SRS.grade(c, true, c.due);
  assert.equal(c.interval, Math.round(3 * 2.5));
  assert.equal(c.reps, 3);
});

test('a failure resets the card, lowers the ease and is due again in minutes', () => {
  let c = SRS.grade(undefined, true, T0);
  c = SRS.grade(c, false, T0 + DAY);
  assert.equal(c.reps, 0);
  assert.equal(c.interval, 0);
  assert.equal(c.lapses, 1);
  assert.ok(c.ease < 2.5);
  assert.ok(c.due - (T0 + DAY) < DAY);
  assert.equal(SRS.grade(c, true, c.due).interval, 1);
});

test('the ease never drops below its floor', () => {
  let c;
  for (let i = 0; i < 20; i++) c = SRS.grade(c, false, T0);
  assert.equal(c.ease, 1.3);
});

test('a success before the due date changes nothing', () => {
  const c = SRS.grade(undefined, true, T0);
  assert.deepEqual(SRS.grade(c, true, T0 + 1000), c);
});

test('grade does not mutate its input', () => {
  const c = SRS.grade(undefined, true, T0);
  const copy = { ...c };
  SRS.grade(c, false, T0);
  assert.deepEqual(c, copy);
});

test('isDue and dueCount', () => {
  const a = SRS.grade(undefined, true, T0);
  const b = SRS.grade(undefined, true, T0 + 5 * DAY);
  assert.equal(SRS.isDue(undefined, T0), false);
  assert.equal(SRS.isDue(a, T0), false);
  assert.equal(SRS.isDue(a, T0 + DAY), true);
  assert.equal(SRS.dueCount({ a, b }, T0 + 2 * DAY), 1);
});

test('known words are seeded as cards due in one day', () => {
  const cards = SRS.seedFromKnown(['chat', 'chien'], T0);
  assert.deepEqual(Object.keys(cards), ['chat', 'chien']);
  assert.equal(cards.chat.due, T0 + DAY);
  assert.equal(SRS.grade(cards.chat, true, T0 + DAY).interval, 3);
});
