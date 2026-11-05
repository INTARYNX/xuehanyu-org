// Service worker: makes the app usable offline once visited.
// - same-origin pages, scripts, styles and data: network first, cache as fallback
// - images and pinned CDN assets: cache first (they never change in place)
// Bump VERSION to drop every cached file.
const VERSION = 'v1';
const CACHE = 'xuehanyu-' + VERSION;
const SHELL = [
  './', 'app.html', 'quiz.html', 'lessons.html',
  'style.css', 'quiz.css', 'lessons.css',
  'app.js', 'quiz.js', 'lessons.js', 'lessons-pinyin.js', 'srs.js', 'tone-dsp.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function store(req, res) {
  if (res && (res.ok || res.type === 'opaque')) (await caches.open(CACHE)).put(req, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  const sameOrigin = new URL(req.url).origin === self.location.origin;

  if (!sameOrigin || req.destination === 'image') {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => store(req, res))));
    return;
  }
  e.respondWith(
    fetch(req).then(res => store(req, res)).catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
