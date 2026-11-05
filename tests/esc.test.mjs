/**
 * tests/esc.test.mjs — the HTML escaping helper shared by app.js, lessons.js, quiz.js
 * Run:  node --test tests/esc.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

for (const file of ['app.js', 'lessons.js', 'quiz.js']) {
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
