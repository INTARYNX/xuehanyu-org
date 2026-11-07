/**
 * tests/esc.test.mjs — the HTML escaping helper (word-detail.js is shared by the dictionary and the lessons; quiz.js has its own)
 * Run:  node --test tests/esc.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// app.js and lessons.js no longer carry a copy: they use the one of word-detail.js, loaded before them (checked below)
for (const file of ['word-detail.js', 'quiz.js']) {
  const src = readFileSync(path.join(ROOT, file), 'utf8');
  const match = src.match(/function esc\(v\) \{[\s\S]*?\n\}/);

  test(`${file} defines esc()`, () => assert.ok(match, 'esc() not found'));

  test(`${file}: esc() neutralises markup and keeps text`, () => {
    const esc = vm.runInNewContext(`(${match[0]})`);
    assert.equal(esc('<img src=x onerror="a()">'), '&lt;img src=x onerror=&quot;a()&quot;&gt;');
    assert.equal(esc(`a & b's`), 'a &amp; b&#39;s');
    assert.equal(esc(null), '');
    assert.equal(esc(0), '0');
    assert.equal(esc('学汉语 nǐ hǎo'), '学汉语 nǐ hǎo');
  });
}

// A page that renders data through innerHTML without loading the helper would throw (or worse, skip escaping).
for (const [page, script] of [['app.html', 'app.js'], ['lessons.html', 'lessons.js']]) {
  test(`${page} loads word-detail.js (esc) before ${script}`, () => {
    const html = readFileSync(path.join(ROOT, page), 'utf8');
    const at = name => html.indexOf(`<script src="${name}?`);
    assert.ok(at('word-detail.js') >= 0, 'word-detail.js is not loaded');
    assert.ok(at('word-detail.js') < at(script), `word-detail.js must come before ${script}`);
    assert.doesNotMatch(readFileSync(path.join(ROOT, script), 'utf8'), /function esc\(/, `${script} defines its own esc()`);
  });
}
