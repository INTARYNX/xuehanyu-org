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
import { readFile, readdir } from 'node:fs/promises';
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

async function open(name, size, init) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[size], serviceWorkers: 'block' });
  if (init) await ctx.addInitScript(init);
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

test('every app page extends under the safe areas (viewport-fit=cover) so no page background shows under the bottom bar', { skip }, async () => {
  for (const page of ['app.html', 'quiz.html', 'lessons.html']) {
    const { p, ctx } = await open(page, 'phone');
    try {
      assert.match(await p.getAttribute('meta[name="viewport"]', 'content'), /viewport-fit=cover/, page);
      const bg = await p.$eval('#paper-bg', e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), innerWidth, innerHeight]; });
      assert.deepEqual(bg, [bg[2], bg[3], bg[2], bg[3]], `${page}: the paper does not cover the viewport`);
    } finally { await ctx.close(); }
  }
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

test('lessons: playback waits for each line to finish before moving on', { skip }, async () => {
  // a fake voice that only ends when the test says so
  const { p, ctx, errors } = await open('lessons.html', 'desktop', () => {
    window.__spoken = []; window.__ends = [];
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    Object.defineProperty(window, 'speechSynthesis', { value: {
      getVoices: () => [{ lang: 'zh-CN' }],
      speak(u) { if (u.text.trim()) { window.__spoken.push(u.text); window.__ends.push(u.onend); } },   // ignore the silent unlock utterance
      cancel() {}, addEventListener() {}
    } });
  });
  try {
    const speaking = () => p.$$eval('.exchange.speaking', e => e.map(x => x.dataset.i));
    await p.click('#btnPlay');
    await p.waitForTimeout(2600);   // longer than the old fixed 1.9 s per line
    assert.equal(await p.evaluate(() => window.__spoken.length), 1, 'moved on before the voice ended');
    assert.deepEqual(await speaking(), ['0']);
    await p.evaluate(() => window.__ends[0]());
    await p.waitForTimeout(900);
    assert.equal(await p.evaluate(() => window.__spoken.length), 2, 'did not move on after the voice ended');
    assert.deepEqual(await speaking(), ['1']);
    await p.click('#btnPlay');      // stop
    assert.deepEqual(await speaking(), []);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

// ------------------------------------------------------------------ rappels / installation / SEO
const FAKE_PUSH = `
  const calls = (window.__push = { subscribed: 0, unsubscribed: 0 });
  // Headless Chromium starts with permission 'denied'; a real browser starts at 'default'.
  // Permission and subscription survive reloads through localStorage, like they do in a browser profile.
  const setPerm = v => Object.defineProperty(Notification, 'permission', { value: v, configurable: true });
  setPerm(localStorage.getItem('__perm') || 'default');
  const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/fake', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'k', auth: 'a' } }; },
                unsubscribe() { calls.unsubscribed++; localStorage.removeItem('__sub'); return Promise.resolve(true); } };
  const reg = { pushManager: {
    getSubscription() { return Promise.resolve(localStorage.getItem('__sub') ? sub : null); },
    subscribe(opts) { calls.subscribed++; calls.key = opts.applicationServerKey.length; localStorage.setItem('__sub', '1'); return Promise.resolve(sub); } } };
  Object.defineProperty(navigator, 'serviceWorker', { value: { ready: Promise.resolve(reg), register() { return Promise.resolve(reg); } } });
  Notification.requestPermission = () => { localStorage.setItem('__perm', 'granted'); setPerm('granted'); return Promise.resolve('granted'); };
`;
const VAPID_KEY = 'BI-BcM1NJWPwdIlLWojxAzOe2w7ATOYLYWEZ4TWjX0B89thp8-ORnpz9bYlrlvMcOSc0ULjItsiHM6F3FknVTIE';

test('quiz: the reminder card turns the daily reminder on and off against the push API', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: VIEWPORTS.phone, serviceWorkers: 'block' });
  await ctx.addInitScript(FAKE_PUSH);
  const p = await ctx.newPage();
  const posts = [];
  await p.route(u => !u.toString().startsWith(base), r => r.abort());
  await p.route('**/api/push/*', r => {
    if (r.request().method() === 'POST') posts.push([new URL(r.request().url()).pathname, r.request().postDataJSON()]);
    return r.fulfill({ json: { ok: true } });
  });
  await p.route('**/api/push/key', r => r.fulfill({ json: { key: VAPID_KEY } }));   // last registered wins
  try {
    await p.goto(`${base}/quiz.html`);
    await p.waitForTimeout(500);
    assert.equal(await p.isVisible('#remindCard'), true);
    assert.equal(await p.inputValue('#remindTime'), '19:00');
    assert.match(await p.textContent('#remindBtn'), /Activer le rappel/);

    await p.fill('#remindTime', '08:30');
    await p.click('#remindBtn');
    await p.waitForTimeout(500);
    const sent = posts.find(x => x[0] === '/api/push/subscribe');
    assert.ok(sent, 'no subscribe request');
    assert.equal(sent[1].time, '08:30');
    assert.equal(sent[1].subscription.endpoint, 'https://fcm.googleapis.com/fcm/send/fake');
    assert.ok(sent[1].tz.includes('/') || sent[1].tz === 'UTC', 'timezone missing');
    assert.equal(sent[1].lang, 'fr');
    assert.equal((await p.evaluate(() => window.__push)).key, 65, 'VAPID key must be the 65-byte uncompressed point');
    assert.match(await p.textContent('#remindBtn'), /Désactiver/);
    assert.match(await p.textContent('#remindText'), /08:30/);

    await p.reload();
    await p.waitForTimeout(500);
    assert.match(await p.textContent('#remindBtn'), /Désactiver/, 'state is restored after a reload');
    await p.click('#remindBtn');
    await p.waitForTimeout(400);
    assert.ok(posts.some(x => x[0] === '/api/push/unsubscribe'));
    assert.match(await p.textContent('#remindBtn'), /Activer le rappel/);
  } finally { await ctx.close(); }
});

test('quiz: practising while subscribed tells the server (silences the reminder of the day)', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: VIEWPORTS.phone, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {   // a returning subscriber: permission granted, subscription kept, reminder on
    localStorage.setItem('__perm', 'granted'); localStorage.setItem('__sub', '1');
    localStorage.setItem('xuehanyu.remind.v1', JSON.stringify({ on: true, time: '19:00' }));
  });
  await ctx.addInitScript(FAKE_PUSH);   // after the storage setup: it reads __perm / __sub
  const p = await ctx.newPage();
  const posts = [];
  await p.route(u => !u.toString().startsWith(base), r => r.abort());
  await p.route('**/api/push/*', r => {
    if (r.request().method() === 'POST') posts.push([new URL(r.request().url()).pathname, r.request().postDataJSON()]);
    return r.fulfill({ json: { ok: true, key: VAPID_KEY } });
  });
  try {
    await p.goto(`${base}/quiz.html`);
    await p.waitForTimeout(500);
    assert.match(await p.textContent('#remindBtn'), /Désactiver/);
    await p.evaluate(() => Progress.add(3));
    await p.waitForTimeout(2200);
    const act = posts.find(x => x[0] === '/api/push/activity');
    assert.ok(act, 'no activity request after practising');
    assert.equal(act[1].endpoint, 'https://fcm.googleapis.com/fcm/send/fake');
    assert.equal(act[1].today, 3);
    assert.match(act[1].day, /^\d{4}-\d{2}-\d{2}$/);
  } finally { await ctx.close(); }
});

test('quiz: on an iPhone Safari tab the card explains how to install the app instead of offering push', { skip }, async () => {
  const ctx = await browser.newContext({
    viewport: VIEWPORTS.phone, serviceWorkers: 'block',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
  });
  await ctx.addInitScript(() => { delete window.PushManager; });
  const p = await ctx.newPage();
  await p.route(u => !u.toString().startsWith(base), r => r.abort());
  try {
    await p.goto(`${base}/quiz.html`);
    await p.waitForTimeout(500);
    assert.equal(await p.isVisible('#remindCard'), true);
    assert.match(await p.textContent('#remindSteps'), /Partager/);
    assert.match(await p.textContent('#remindSteps'), /écran d'accueil/);
    assert.equal(await p.isVisible('#remindBtn'), false, 'push button must stay hidden until the app is installed');
    await p.click('.lang-switch [data-lang="en"]');
    assert.match(await p.textContent('#remindSteps'), /Add to Home Screen/);
  } finally { await ctx.close(); }
});

test('quiz: the reminder card stays out of the way when neither install nor push is possible', { skip }, async () => {
  const { p, ctx } = await open('quiz.html', 'desktop', () => { delete window.PushManager; });
  try { assert.equal(await p.isVisible('#remindCard'), false); } finally { await ctx.close(); }
});

test('dictionary: a ?w=…&l=1 link opens that word (deep link from the static SEO pages)', { skip }, async () => {
  const { p, ctx, errors } = await open('app.html?w=%E5%85%AB&l=1', 'desktop');
  try {
    assert.match(await p.textContent('#detail .word-pinyin'), /bā/);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('the manifest is installable: id, start_url, scope, 192 + 512 + maskable icons that exist', { skip }, async () => {
  const m = JSON.parse(await readFile(path.join(ROOT, 'site.webmanifest'), 'utf8'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.id, '/');
  assert.equal(m.start_url, '/quiz.html');
  assert.ok(m.icons.some(i => i.sizes === '192x192' && i.purpose === 'any'));
  assert.ok(m.icons.some(i => i.sizes === '512x512' && i.purpose === 'any'));
  assert.ok(m.icons.some(i => i.purpose === 'maskable'));
  for (const i of m.icons) await readFile(path.join(ROOT, i.src));
});

test('generated SEO page: content is in the HTML, with title, canonical, JSON-LD and a link into the app', { skip }, async () => {
  let files = [];
  try { files = (await readdir(path.join(ROOT, 'mot'))).filter(f => f.startsWith('ai4-')); } catch { return; }   // needs scripts/build-seo.mjs
  if (!files.length) return;
  const { p, ctx, errors } = await open(`mot/${files[0]}`, 'phone');
  try {
    assert.ok((await p.title()).endsWith('xuehanyu.org'));
    assert.ok((await p.getAttribute('link[rel=canonical]', 'href')).startsWith('https://www.xuehanyu.org/mot/ai4-'));
    assert.equal(await p.$$eval('h1', h => h.length), 1);
    assert.equal(await p.$$eval('script[type="application/ld+json"]', s => s.length), 1);
    assert.match(await p.getAttribute('.seo-word a.btn', 'href'), /^\/app\.html\?w=.+&l=\d$/);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'page scrolls sideways');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

// ------------------------------------------------------------------ rien sous la barre du bas
for (const page of ['quiz.html', 'app.html', 'lessons.html', 'mot/a1-554a.html', 'vocabulaire-hsk-1.html']) {
  test(`${page} (phone): scrolled to the end, no content is hidden under the bottom bar`, { skip }, async () => {
    const { p, ctx } = await open(page, 'phone');
    try {
      for (const lang of ['fr', 'en']) {
        if (lang === 'en') { const b = await p.$('.lang-switch [data-lang="en"]'); if (!b) break; await b.click(); await p.waitForTimeout(200); }
        await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await p.waitForTimeout(150);
        const m = await p.evaluate(() => {
          const nav = document.querySelector('.site-nav').getBoundingClientRect();
          const app = document.querySelector('.app');
          const end = app.getBoundingClientRect().bottom - parseFloat(getComputedStyle(app).paddingBottom);
          return { navTop: nav.top, navH: nav.height, end, reserved: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tabbar-h')) };
        });
        assert.ok(m.end <= m.navTop + 0.5, `${page} [${lang}]: content ends at ${m.end}, the bar starts at ${m.navTop}`);
        assert.ok(m.navH <= m.reserved + 0.5, `${page} [${lang}]: the bar is ${m.navH}px tall but only ${m.reserved}px (--tabbar-h) is reserved`);
      }
    } finally { await ctx.close(); }
  });
}

test('dictionary (phone): the word sheet opens above the bottom bar, nothing of it is covered', { skip }, async () => {
  const { p, ctx } = await open('app.html', 'phone');
  try {
    await p.click('.char-row');
    await p.waitForTimeout(500);
    const covered = await p.evaluate(() => {
      const x = innerWidth / 2, y = innerHeight - 8;                  // a point where the bar sits
      const top = document.elementFromPoint(x, y);
      return { inPopup: !!top.closest('.popup'), el: top.className || top.tagName };
    });
    assert.equal(covered.inPopup, true, `the bottom bar covers the word sheet (${covered.el})`);
  } finally { await ctx.close(); }
});

test('lessons (phone): the action bar clears the bottom bar by a visible gap', { skip }, async () => {
  const { p, ctx } = await open('lessons.html', 'phone');
  try {
    const g = await p.evaluate(() => ({ dock: document.querySelector('.lesson-dock').getBoundingClientRect().bottom, nav: document.querySelector('.site-nav').getBoundingClientRect().top }));
    assert.ok(g.nav - g.dock >= 4 && g.nav - g.dock <= 24, `gap between action bar and tab bar: ${g.nav - g.dock}px`);
  } finally { await ctx.close(); }
});

test('dictionary (phone): scrolled to the end, the last block of the word sheet is fully visible above the viewport edge', { skip }, async () => {
  const { p, ctx } = await open('app.html', 'phone');
  try {
    await p.click('.char-row');
    await p.waitForTimeout(500);
    await p.evaluate(() => { const s = document.querySelector('.popup'); s.scrollTop = s.scrollHeight; });
    await p.waitForTimeout(200);
    const m = await p.evaluate(() => {
      const last = [...document.querySelectorAll('.popup-body > *')].filter(e => e.getBoundingClientRect().height > 0).pop();
      const b = last.getBoundingClientRect();
      const bar = document.querySelector('.site-nav').getBoundingClientRect();
      const at = document.elementFromPoint(innerWidth / 2, Math.min(b.bottom - 2, innerHeight - 2));
      return { bottom: b.bottom, innerHeight, barTop: bar.top, coveredByBar: !!(at && at.closest('.site-nav')) };
    });
    assert.ok(m.bottom <= m.innerHeight, `last block ends at ${m.bottom}, below the viewport (${m.innerHeight})`);
    assert.equal(m.coveredByBar, false, 'the bottom bar covers the end of the word sheet');
  } finally { await ctx.close(); }
});

// ------------------------------------------------------------------ prononciation : voix chinoise du système
const STUB_SPEECH = voices => `
  window.__spoken = [];
  const list = ${JSON.stringify(voices)};
  Object.defineProperty(window, 'speechSynthesis', { value: {
    getVoices: () => list, addEventListener() {}, cancel() {},
    speak(u) { if (u.text.trim()) { window.__spoken.push({ text: u.text, lang: u.lang, voice: u.voice && u.voice.name }); setTimeout(() => u.onend && u.onend(), 20); } }
  } });
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };
`;
const EN_ONLY = [{ name: 'Microsoft George - English (United Kingdom)', lang: 'en-GB' }, { name: 'Microsoft Guillaume - French (Switzerland)', lang: 'fr-CH' }];

test('lessons: with no Chinese voice (a Windows PC without the language pack) the user is told, not left with silence', { skip }, async () => {
  const { p, ctx, errors } = await open('lessons.html', 'desktop', STUB_SPEECH(EN_ONLY));
  try {
    await p.click('[data-speak="0"]');
    await p.waitForTimeout(300);
    assert.equal(await p.isVisible('.speech-notice'), true, 'no message about the missing voice');
    assert.match(await p.textContent('.speech-notice'), /voix chinoise/i);
    assert.deepEqual(await p.evaluate(() => window.__spoken), [], 'an English voice must not read Chinese characters');
    await p.click('.speech-notice-close');
    await p.click('[data-speak="1"]');
    await p.waitForTimeout(300);
    assert.equal(await p.isVisible('.speech-notice'), false, 'the message came back after being closed');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('lessons: with a Chinese voice available it is the one used, in zh-CN, and no message is shown', { skip }, async () => {
  const voices = [...EN_ONLY, { name: 'Microsoft Huihui - Chinese (Simplified, PRC)', lang: 'zh-CN' }];
  const { p, ctx } = await open('lessons.html', 'desktop', STUB_SPEECH(voices));
  try {
    await p.click('[data-speak="0"]');
    await p.waitForTimeout(300);
    const spoken = await p.evaluate(() => window.__spoken);
    assert.equal(spoken.length, 1);
    assert.equal(spoken[0].lang, 'zh-CN');
    assert.match(spoken[0].voice, /Huihui/);
    assert.equal(await p.isVisible('.speech-notice'), false);
  } finally { await ctx.close(); }
});

test('lessons: a browser that hides its voice list still gets a try (lang=zh-CN), as phones do', { skip }, async () => {
  const { p, ctx } = await open('lessons.html', 'desktop', STUB_SPEECH([]));
  try {
    await p.click('[data-speak="0"]');
    await p.waitForTimeout(1600);   // the voice list is empty: speech.js waits for it, then tries anyway
    assert.equal((await p.evaluate(() => window.__spoken)).length, 1);
    assert.equal(await p.isVisible('.speech-notice'), false);
  } finally { await ctx.close(); }
});

test('quiz and dictionary use the same speech module (one message, one voice choice)', { skip }, async () => {
  for (const [page, click] of [['quiz.html', null], ['app.html', null]]) {
    const { p, ctx } = await open(page, 'desktop', STUB_SPEECH(EN_ONLY));
    try {
      assert.equal(await p.evaluate(() => typeof Speech.speak), 'function', `${page}: speech.js is not loaded`);
      assert.equal(await p.evaluate(() => Speech.verdict(speechSynthesis.getVoices())), 'none', page);
    } finally { await ctx.close(); }
  }
});
