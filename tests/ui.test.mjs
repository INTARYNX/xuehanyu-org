/**
 * tests/ui.test.mjs — Layout smoke tests in a real browser (Playwright)
 * ------------------------------------------------------------------------
 * Serves the repository root, opens the dictionary, the image quiz and the
 * lessons at phone and desktop width and checks what the eye would notice:
 * no sideways overflow, no stray scrollbar, one active tab in the shared
 * navigation, filters on one row, multi-character words on one line.
 *
 * External hosts (CDNs) are blocked so the run is deterministic, and the
 * dictionary data (git-ignored) is replaced by a small fixture.
 * Skipped when Playwright is not installed.
 *
 * Run:  node --test tests/ui.test.mjs
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

let playwright = null;
try { playwright = createRequire(import.meta.url)('playwright'); } catch { /* not installed */ }
const skip = playwright ? false : 'playwright is not installed';

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/json'
};

const entry = (simplified, pinyin, english) => ({
  simplified, traditional: simplified, radical: simplified[0], frequency: 1, pos: ['n'],
  pinyin, classifiers: [], english: [english], french: [english]
});
const DICTIONARY = [
  entry('爱', 'ài', 'to love'), entry('八', 'bā', 'eight'), entry('爸爸', 'bà ba', 'father'),
  entry('白天', 'bái tiān', 'daytime'), entry('电影院', 'diàn yǐng yuàn', 'cinema')
];

let server, browser, base;

before(async () => {
  if (skip) return;
  server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x').pathname;
    if (url === '/data/hsk1.json') {
      res.writeHead(200, { 'content-type': TYPES['.json'] });
      return res.end(JSON.stringify(DICTIONARY));
    }
    try {
      const file = path.join(ROOT, url === '/' ? 'index.html' : url);
      if (!file.startsWith(ROOT)) throw new Error('outside root');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404); res.end();
    }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await playwright.chromium.launch();
});

after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(r => server.close(r));
});

const VIEWPORTS = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
const NAV = [['index.html', 'Accueil'], ['app.html', 'Dictionnaire'], ['quiz.html', "Quiz d'images"], ['lessons.html', 'Leçons']];

async function open(name, size) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[size], serviceWorkers: 'block' });
  const p = await ctx.newPage();
  await p.route(u => !u.toString().startsWith(base), r => r.abort());
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  await p.goto(`${base}/${name}`);
  await p.waitForTimeout(800);
  return { p, ctx, errors };
}

for (const [pageName, active] of [['app.html', 'Dictionnaire'], ['quiz.html', "Quiz d'images"], ['lessons.html', 'Leçons']]) {
  for (const size of Object.keys(VIEWPORTS)) {
    test(`${pageName} (${size}): no overflow, no stray scrollbar, one active tab`, { skip }, async () => {
      const { p, ctx, errors } = await open(pageName, size);
      try {
        const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        assert.equal(overflow, false, 'page scrolls sideways');

        const scrollers = await p.evaluate(() => [...document.querySelectorAll('*')].filter(e => {
          const s = getComputedStyle(e);
          return /(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 1 && s.scrollbarWidth !== 'none';
        }).map(e => e.className || e.tagName));
        assert.deepEqual(scrollers, [], 'visible horizontal scrollbar');

        const links = await p.$$eval('.site-nav a', as => as.map(a => [a.getAttribute('href'), a.textContent.trim(), a.getAttribute('aria-current')]));
        assert.deepEqual(links.map(l => l.slice(0, 2)), NAV);
        assert.deepEqual(links.filter(l => l[2]).map(l => l[1]), [active]);

        assert.deepEqual(errors, [], 'uncaught page errors');
      } finally { await ctx.close(); }
    });
  }
}

test('quiz (phone): the hub puts the exercise choice and the start button above the fold', { skip }, async () => {
  const { p, ctx } = await open('quiz.html', 'phone');
  try {
    assert.equal(await p.isVisible('#hub'), true);
    assert.equal(await p.isVisible('#session'), false);
    assert.equal(await p.$$eval('#modeTabs .mode-tab', b => b.length), 3);
    const start = await p.$eval('#startBtn', e => e.getBoundingClientRect().bottom);
    const bar = await p.$eval('.site-nav', e => e.getBoundingClientRect().top);
    assert.ok(start <= bar, `start button (${start}) hides behind the tab bar (${bar})`);
  } finally { await ctx.close(); }
});

test('quiz (phone): the tab bar is fixed at the bottom and a session hides it', { skip }, async () => {
  const { p, ctx } = await open('quiz.html', 'phone');
  try {
    const box = await p.$eval('.site-nav', e => { const r = e.getBoundingClientRect(); return [r.bottom, innerHeight]; });
    assert.equal(Math.round(box[0]), box[1], 'tab bar is not at the bottom edge');
    await p.click('#startBtn');
    await p.waitForTimeout(200);
    assert.equal(await p.isVisible('.site-nav'), false, 'tab bar stays visible during a session');
  } finally { await ctx.close(); }
});

test('quiz (phone): in a card session the listen button is below the picture, not over it', { skip }, async () => {
  const { p, ctx } = await open('quiz.html', 'phone');
  try {
    await p.click('#startBtn');
    await p.waitForSelector('.q-image');
    const img = await p.$eval('.q-image', e => e.getBoundingClientRect().bottom);
    const btn = await p.$eval('.speak-btn', e => e.getBoundingClientRect().top);
    assert.ok(btn >= img - 1, `button (${btn}) overlaps the picture (${img})`);
  } finally { await ctx.close(); }
});

test('quiz: a card session hides the answer until revealed, then grades and advances', { skip }, async () => {
  const { p, ctx, errors } = await open('quiz.html', 'desktop');
  try {
    await p.click('#startBtn');
    await p.waitForSelector('#btnReveal');
    assert.equal(await p.$('.flash-hanzi'), null, 'the answer is visible before reveal');
    assert.match(await p.textContent('#progressText'), /^1 \/ 10$/);
    await p.click('#btnReveal');
    assert.ok(await p.$('.flash-hanzi'), 'no answer after reveal');
    await p.click('#btnKnew');
    await p.waitForSelector('#btnReveal');
    assert.match(await p.textContent('#progressText'), /^2 \/ 10$/);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('quiz: a multiple-choice session marks the answer and offers to continue', { skip }, async () => {
  const { p, ctx, errors } = await open('quiz.html', 'desktop');
  try {
    await p.click('.mode-tab[data-mode="img2word"]');
    await p.click('#startBtn');
    await p.waitForSelector('#choices .choice');
    assert.equal(await p.$$eval('#choices .choice', c => c.length), 4);
    await p.click('#choices .choice');
    await p.waitForSelector('#btnCont');
    assert.equal(await p.$$eval('#choices .choice.right', c => c.length), 1, 'exactly one right answer is shown');
    await p.click('#btnCont');
    await p.waitForSelector('#choices .choice:not(:disabled)');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('quiz: a finished session shows the summary and counts toward the daily goal', { skip }, async () => {
  const { p, ctx } = await open('quiz.html', 'desktop');
  try {
    await p.click('#startBtn');
    for (let i = 0; i < 10; i++) {
      await p.click('#btnReveal');
      await p.click('#btnKnew');
    }
    await p.waitForSelector('.summary-card');
    assert.match(await p.textContent('.summary-score'), /^10 \/ 10$/);
    await p.click('#btnFinish');
    assert.equal(await p.isVisible('#hub'), true);
    assert.equal(await p.textContent('#statStreak'), '1');
    assert.equal(await p.getAttribute('#goalRing', 'class'), 'ring done');
  } finally { await ctx.close(); }
});

test('dictionary (phone): multi-character words stay on one line', { skip }, async () => {
  const { p, ctx } = await open('app.html', 'phone');
  try {
    const rows = await p.$$eval('.char-row', els => els.map(row => {
      const c = row.querySelector('.char-row-char');
      return [row.dataset.len, c.getBoundingClientRect().height, parseFloat(getComputedStyle(c).fontSize)];
    }));
    assert.ok(rows.length >= 5, 'fixture rows not rendered');
    for (const [len, height, size] of rows) {
      assert.ok(height <= size * 1.3, `${len}-character word wraps (height ${height}, font ${size})`);
    }
  } finally { await ctx.close(); }
});

test('lessons (phone): a select replaces the lesson strip', { skip }, async () => {
  const { p, ctx } = await open('lessons.html', 'phone');
  try {
    assert.equal(await p.isVisible('#lessonSelect'), true);
    assert.equal(await p.isVisible('#lessonList'), false);
    assert.equal(await p.$$eval('#lessonSelect option', o => o.length), 25);
    await p.selectOption('#lessonSelect', '1');
    await p.waitForTimeout(200);
    assert.match(await p.textContent('#lessonTitle'), /restaurant/i);
  } finally { await ctx.close(); }
});

test('lessons (desktop): the lesson list is shown, the select is hidden', { skip }, async () => {
  const { p, ctx } = await open('lessons.html', 'desktop');
  try {
    assert.equal(await p.isVisible('#lessonList'), true);
    assert.equal(await p.isVisible('#lessonSelect'), false);
  } finally { await ctx.close(); }
});

test('lessons: pinyin and translation buttons reflect their state', { skip }, async () => {
  const { p, ctx } = await open('lessons.html', 'phone');
  try {
    for (const id of ['#btnPinyin', '#btnTrans']) {
      assert.equal(await p.getAttribute(id, 'aria-pressed'), 'true');
      await p.click(id);
      assert.equal(await p.getAttribute(id, 'aria-pressed'), 'false');
      assert.equal(await p.$eval(id, e => e.classList.contains('active')), false);
    }
  } finally { await ctx.close(); }
});

test('lessons (phone): the action bar sits above the tab bar', { skip }, async () => {
  const { p, ctx } = await open('lessons.html', 'phone');
  try {
    const dock = await p.$eval('.lesson-dock', e => e.getBoundingClientRect().bottom);
    const bar = await p.$eval('.site-nav', e => e.getBoundingClientRect().top);
    assert.ok(dock <= bar, `action bar (${dock}) is hidden by the tab bar (${bar})`);
  } finally { await ctx.close(); }
});

test('lessons: reviewing a lesson updates the path and offers the next lesson', { skip }, async () => {
  const { p, ctx } = await open('lessons.html', 'desktop');
  try {
    assert.equal(await p.isVisible('#btnNext'), false);
    assert.match(await p.textContent('#pathCount'), /^0 \/ 25/);
    await p.click('#btnReview');
    assert.equal(await p.isVisible('#btnNext'), true);
    assert.match(await p.textContent('#pathCount'), /^1 \/ 25/);
    assert.equal(await p.$$eval('.lesson-item.done', e => e.length), 1);
    await p.click('#btnNext');
    assert.match(await p.textContent('#lessonTitle'), /restaurant/i);
    assert.equal(await p.isVisible('#btnNext'), false, 'the next lesson is not reviewed yet');
  } finally { await ctx.close(); }
});

test('pinyin is never italic (italic broke the tone marks)', { skip }, async () => {
  const { p, ctx } = await open('lessons.html', 'desktop');
  try {
    const styles = await p.$$eval('.exchange-pinyin', els => els.map(e => getComputedStyle(e).fontStyle));
    assert.ok(styles.length > 0);
    assert.ok(styles.every(s => s === 'normal'), 'italic pinyin found');
  } finally { await ctx.close(); }
});
