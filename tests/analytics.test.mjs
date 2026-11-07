import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = f => readFileSync(path.join(ROOT, f), 'utf8');
const TAG = /<script defer src="https:\/\/analytics\.mintaka\.cc\/script\.js" data-website-id="([0-9a-f-]{36})" data-domains="www\.xuehanyu\.org" data-do-not-track="true"><\/script>/;

test('every page carries the same Umami tag, limited to the real domain and honouring Do Not Track', () => {
  const ids = new Set();
  for (const page of ['index.html', 'app.html', 'quiz.html', 'lessons.html']) {
    const m = read(page).match(TAG);
    assert.ok(m, `${page}: Umami tag missing or altered`);
    ids.add(m[1]);
  }
  assert.equal(ids.size, 1, 'pages use different website ids');
});

test('the generated SEO pages carry it too (template in scripts/build-seo.mjs)', () => {
  const tpl = read('scripts/build-seo.mjs');
  assert.ok(TAG.test(tpl), 'build-seo.mjs template has no Umami tag');
  const sample = 'vocabulaire-hsk-1.html';
  if (existsSync(path.join(ROOT, sample))) assert.ok(TAG.test(read(sample)), `${sample}: tag missing (rebuild with scripts/build-seo.mjs)`);
});

test('the service worker never intercepts or caches the analytics script', () => {
  assert.match(read('sw.js'), /hostname === 'analytics\.mintaka\.cc'\) return/);
});

test('the home page says what is counted (and keeps the "no cookies" promise true)', () => {
  const js = read('index.js');
  assert.match(js, /Umami/);
  assert.doesNotMatch(read('index.html') + js, /Google Analytics|gtag\(|fbq\(/);
});
