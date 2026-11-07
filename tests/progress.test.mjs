/**
 * tests/progress.test.mjs — Daily activity, goal and streak (progress.js)
 * Run:  node --test tests/progress.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const Progress = createRequire(import.meta.url)('../progress.js');

// Noon on a local day, so the tests do not depend on the machine's timezone.
const at = (y, m, d) => new Date(y, m - 1, d, 12).getTime();

test('record adds to the day of the timestamp and never mutates its input', () => {
  const a = Progress.empty();
  const b = Progress.record(a, 3, at(2026, 11, 7));
  const c = Progress.record(b, 2, at(2026, 11, 7));
  assert.deepEqual(a.days, {});
  assert.equal(Progress.today(b, at(2026, 11, 7)), 3);
  assert.equal(Progress.today(c, at(2026, 11, 7)), 5);
  assert.equal(Progress.today(c, at(2026, 11, 8)), 0);
});

test('streak counts consecutive active days ending today', () => {
  let s = Progress.empty();
  for (const d of [5, 6, 7]) s = Progress.record(s, 1, at(2026, 11, d));
  assert.equal(Progress.streak(s, at(2026, 11, 7)), 3);
});

test('a streak stays alive until the end of the day after the last active one', () => {
  let s = Progress.empty();
  for (const d of [5, 6]) s = Progress.record(s, 1, at(2026, 11, d));
  assert.equal(Progress.streak(s, at(2026, 11, 7)), 2, 'nothing yet today, still alive');
  assert.equal(Progress.streak(s, at(2026, 11, 8)), 0, 'a full day was missed');
});

test('a gap breaks the streak', () => {
  let s = Progress.empty();
  for (const d of [1, 2, 3, 5, 6]) s = Progress.record(s, 1, at(2026, 11, d));
  assert.equal(Progress.streak(s, at(2026, 11, 6)), 2);
});

test('streaks cross month and year boundaries', () => {
  let s = Progress.empty();
  for (const [y, m, d] of [[2026, 12, 30], [2026, 12, 31], [2027, 1, 1]]) s = Progress.record(s, 1, at(y, m, d));
  assert.equal(Progress.streak(s, at(2027, 1, 1)), 3);
  assert.equal(Progress.prevDay('2026-03-01'), '2026-02-28');
});

test('goalRatio is capped at 1', () => {
  const s = Progress.record(Progress.empty(), 25, at(2026, 11, 7));
  assert.equal(Progress.goalRatio(s, at(2026, 11, 7)), 1);
  const half = Progress.record(Progress.empty(), Progress.DEFAULT_GOAL / 2, at(2026, 11, 7));
  assert.equal(Progress.goalRatio(half, at(2026, 11, 7)), 0.5);
});

test('old days are pruned', () => {
  let s = Progress.empty();
  for (let i = 0; i < 450; i++) s = Progress.record(s, 1, at(2025, 1, 1) + i * 86400000);
  assert.ok(Object.keys(s.days).length <= 400);
});

test('setOnSave is called with the new state after add, and a throwing listener is ignored', () => {
  const store = {};
  globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  try {
    let seen = null;
    Progress.setOnSave(s => { seen = s; });
    const s = Progress.add(3, at(2026, 11, 7));
    assert.equal(seen.days['2026-11-07'], 3);
    assert.deepEqual(seen, s);
    Progress.setOnSave(() => { throw new Error('boom'); });
    assert.doesNotThrow(() => Progress.add(1, at(2026, 11, 7)));
    assert.equal(Progress.load().days['2026-11-07'], 4);
  } finally {
    Progress.setOnSave(null);
    delete globalThis.localStorage;
  }
});
