// Service worker: makes the app usable offline once visited.
// - same-origin pages, scripts, styles and data: network first, cache as fallback
// - images and pinned CDN assets: cache first (they never change in place)
// Bump VERSION to drop every cached file.
const VERSION = 'v20';
const CACHE = 'xuehanyu-' + VERSION;
const SHELL = [
  './', 'app.html', 'quiz.html', 'lessons.html',
  'style.css', 'quiz.css', 'lessons.css',
  'app.js', 'word-detail.js', 'quiz.js', 'lessons.js', 'lessons-pinyin.js', 'srs.js', 'progress.js', 'pwa.js', 'speech.js', 'tone-dsp.js'
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
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && url.pathname.startsWith('/api/')) return;   // backend des rappels : jamais en cache
  if (url.hostname === 'analytics.mintaka.cc') return;          // mesure d'audience : toujours la version du serveur

  const audioFile = sameOrigin && /^\/audio\/[lw]\//.test(url.pathname);
  if (!sameOrigin || req.destination === 'image' || audioFile) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => store(req, res))));
    return;
  }
  e.respondWith(
    fetch(req).then(res => store(req, res)).catch(() => caches.match(req, { ignoreSearch: true }))
  );
});

// ---------------------------------------------------------------- push (rappel quotidien)
// Le serveur envoie { title, body, url }. iOS et Chrome exigent qu'une notification soit
// affichée à chaque push reçu (userVisibleOnly), sinon l'abonnement est révoqué.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil(self.registration.showNotification(d.title || '学汉语', {
    body: d.body || '',
    icon: '/android-chrome-192x192.png',
    tag: 'daily-reminder',
    data: { url: d.url || '/quiz.html' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || '/quiz.html', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.startsWith(self.location.origin));
    if (open) return open.navigate(target).then(c => (c || open).focus()).catch(() => self.clients.openWindow(target));
    return self.clients.openWindow(target);
  }));
});

// Le navigateur a renouvelé l'abonnement : on prévient le serveur pour ne pas perdre le rappel.
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil((async () => {
    const { key } = await (await fetch('/api/push/key')).json();
    const pad = '='.repeat((4 - (key.length % 4)) % 4);
    const bytes = Uint8Array.from(atob((key + pad).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
    await fetch('/api/push/resubscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old: e.oldSubscription && e.oldSubscription.endpoint, subscription: sub.toJSON() }),
    });
  })().catch(() => {}));
});
