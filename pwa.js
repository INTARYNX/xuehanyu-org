// =========================================================================
// PWA — installation de l'app et rappel quotidien (notifications push).
// Logique pure en haut (testée dans tests/pwa.test.mjs), DOM et réseau en bas.
//
// iPhone/iPad : le push web n'existe QUE pour une app ajoutée à l'écran d'accueil
// (iOS 16.4+). Dans un onglet Safari il n'y a ni `PushManager` ni invite d'installation :
// on montre donc les étapes à la main, puis le rappel devient disponible une fois
// l'app ouverte depuis son icône.
// Le serveur (server/push_server.py) ne reçoit que l'abonnement push, l'heure choisie,
// le fuseau, la langue et l'activité du jour — ni compte, ni identité.
// =========================================================================
const Pwa = (() => {
  const API = '/api/push';
  const STORE = 'xuehanyu.remind.v1';
  const DEFAULT_TIME = '19:00';

  const isIOS = (ua = '', platform = '', touchPoints = 0) =>
    /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && touchPoints > 1);
  const isAndroid = (ua = '') => /Android/i.test(ua);

  /**
   * Ce que l'écran doit proposer.
   *   install : 'done' (déjà installée) | 'prompt' (bouton natif) | 'ios' (étapes manuelles)
   *             | 'menu' (Android sans invite : menu du navigateur) | 'none'
   *   push    : 'needs-install' (iOS, onglet Safari) | 'unsupported' | 'denied' | 'on' | 'off'
   */
  function decide(env) {
    const ios = isIOS(env.ua, env.platform, env.touchPoints);
    let install = 'none';
    if (env.standalone) install = 'done';
    else if (env.canPrompt) install = 'prompt';
    else if (ios) install = 'ios';
    else if (isAndroid(env.ua)) install = 'menu';

    let push;
    if (ios && !env.standalone) push = 'needs-install';
    else if (!(env.hasSW && env.hasPush && env.hasNotification)) push = 'unsupported';
    else if (env.permission === 'denied') push = 'denied';
    else if (env.permission === 'granted' && env.subscribed) push = 'on';
    else push = 'off';

    return { ios, install, push, visible: install !== 'none' && install !== 'done' || push !== 'unsupported' };
  }

  /** Clé publique VAPID (base64url) -> Uint8Array pour pushManager.subscribe. */
  function urlB64ToBytes(b64) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  }

  const validTime = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(v || '');

  const T = {
    fr: {
      title: 'Rappel quotidien',
      intro: "Une notification à l'heure de ton choix, seulement si tu n'as pas encore pratiqué aujourd'hui.",
      installBtn: "Installer l'app",
      installMenu: "Pour installer l'app : menu ⋮ du navigateur, puis « Installer l'application » ou « Ajouter à l'écran d'accueil ».",
      iosTitle: "Sur iPhone, installe d'abord l'app :",
      iosStep1: 'Touche <b>Partager</b> <i class="fa-solid fa-arrow-up-from-bracket"></i> en bas de Safari',
      iosStep2: 'Choisis <b>Sur l\'écran d\'accueil</b> <i class="fa-regular fa-square-plus"></i>',
      iosStep3: "Ouvre 学汉语 depuis son icône : le rappel s'active alors ici",
      time: 'Heure du rappel',
      enable: 'Activer le rappel',
      disable: 'Désactiver',
      on: 'Rappel actif tous les jours à',
      denied: "Les notifications sont bloquées pour ce site. Autorise-les dans les réglages du navigateur, puis reviens ici.",
      error: "Impossible d'activer le rappel pour le moment. Réessaie plus tard.",
      done: 'Rappel activé.',
      off: 'Rappel désactivé.',
    },
    en: {
      title: 'Daily reminder',
      intro: "A notification at the time you choose, only if you haven't practised yet today.",
      installBtn: 'Install the app',
      installMenu: 'To install the app: browser menu ⋮, then “Install app” or “Add to Home screen”.',
      iosTitle: 'On iPhone, install the app first:',
      iosStep1: 'Tap <b>Share</b> <i class="fa-solid fa-arrow-up-from-bracket"></i> at the bottom of Safari',
      iosStep2: 'Choose <b>Add to Home Screen</b> <i class="fa-regular fa-square-plus"></i>',
      iosStep3: 'Open 学汉语 from its icon: the reminder can then be enabled here',
      time: 'Reminder time',
      enable: 'Turn on the reminder',
      disable: 'Turn off',
      on: 'Reminder on, every day at',
      denied: 'Notifications are blocked for this site. Allow them in the browser settings, then come back.',
      error: "Couldn't turn the reminder on right now. Please try again later.",
      done: 'Reminder on.',
      off: 'Reminder off.',
    },
  };

  return { decide, urlB64ToBytes, validTime, isIOS, T, API, STORE, DEFAULT_TIME };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Pwa;

// ------------------------------------------------------------------ DOM
if (typeof document !== 'undefined') (() => {
  const card = document.getElementById('remindCard');
  if (!card) return;
  const $ = id => document.getElementById(id);
  const els = {
    title: $('remindTitle'), text: $('remindText'), steps: $('remindSteps'),
    timeRow: $('remindTimeRow'), timeLabel: $('remindTimeLabel'), time: $('remindTime'),
    install: $('installBtn'), btn: $('remindBtn'), note: $('remindNote'),
  };

  let deferredPrompt = null;
  let subscribed = false;
  let busy = false;
  let message = '';

  const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'fr');
  const tr = () => Pwa.T[lang()];
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  function readStore() {
    try { return JSON.parse(localStorage.getItem(Pwa.STORE)) || {}; } catch { return {}; }
  }
  function writeStore(v) {
    try { localStorage.setItem(Pwa.STORE, JSON.stringify(v)); } catch {}
  }

  const env = () => ({
    ua: navigator.userAgent, platform: navigator.platform, touchPoints: navigator.maxTouchPoints,
    standalone: standalone(), canPrompt: !!deferredPrompt,
    hasSW: 'serviceWorker' in navigator, hasPush: 'PushManager' in window, hasNotification: 'Notification' in window,
    permission: 'Notification' in window ? Notification.permission : 'default',
    subscribed,
  });

  function render() {
    const t = tr();
    const d = Pwa.decide(env());
    card.hidden = !d.visible;
    if (!d.visible) return;

    els.title.textContent = t.title;
    const time = readStore().time || Pwa.DEFAULT_TIME;
    els.text.textContent = d.push === 'on' ? `${t.on} ${time}.` : t.intro;

    // étapes iPhone
    const showSteps = d.install === 'ios';
    els.steps.hidden = !showSteps;
    if (showSteps) {
      els.steps.innerHTML = `<p><b>${t.iosTitle}</b></p><ol><li>${t.iosStep1}</li><li>${t.iosStep2}</li><li>${t.iosStep3}</li></ol>`;
    } else if (d.install === 'menu') {
      els.steps.hidden = false;
      els.steps.innerHTML = `<p>${t.installMenu}</p>`;
    }

    els.install.hidden = d.install !== 'prompt';
    els.install.querySelector('span').textContent = t.installBtn;

    const canPush = d.push === 'off' || d.push === 'on' || d.push === 'denied';
    els.timeRow.hidden = !(d.push === 'off' || d.push === 'on');
    els.timeLabel.textContent = t.time;
    els.time.value = time;
    els.btn.hidden = !(d.push === 'off' || d.push === 'on');
    els.btn.disabled = busy;
    els.btn.querySelector('span').textContent = d.push === 'on' ? t.disable : t.enable;
    els.btn.classList.toggle('primary', d.push !== 'on');
    els.note.textContent = d.push === 'denied' ? t.denied : message;
    if (!canPush && d.push !== 'denied') els.note.textContent = message;
  }

  function activity() {
    if (typeof Progress === 'undefined') return {};
    const st = Progress.load();
    return { day: Progress.dayKey(), today: Progress.today(st), streak: Progress.streak(st) };
  }

  async function post(path, body, keepalive = false) {
    const res = await fetch(Pwa.API + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive,
    });
    if (!res.ok) throw new Error(path + ' ' + res.status);
    return res;
  }

  async function currentSub() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }

  async function register(sub, time) {
    await post('/subscribe', {
      subscription: sub.toJSON(), time,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone, lang: lang(), ...activity(),
    });
  }

  async function enable() {
    const t = tr();
    const time = Pwa.validTime(els.time.value) ? els.time.value : Pwa.DEFAULT_TIME;
    busy = true; message = ''; render();
    try {
      if ((await Notification.requestPermission()) !== 'granted') { busy = false; render(); return; }
      const reg = await navigator.serviceWorker.ready;
      const { key } = await (await fetch(Pwa.API + '/key')).json();
      let sub = await reg.pushManager.getSubscription();
      try {
        sub = sub || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Pwa.urlB64ToBytes(key) });
      } catch (err) {
        // clé serveur différente de celle de l'ancien abonnement : on repart de zéro
        const old = await reg.pushManager.getSubscription();
        if (old) await old.unsubscribe();
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Pwa.urlB64ToBytes(key) });
      }
      await register(sub, time);
      writeStore({ on: true, time });
      subscribed = true;
      message = t.done;
    } catch (err) {
      console.error('reminder', err);
      message = t.error;
    }
    busy = false; render();
  }

  async function disable() {
    busy = true; message = ''; render();
    try {
      const sub = await currentSub();
      if (sub) {
        await post('/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      writeStore({ ...readStore(), on: false });
      subscribed = false;
      message = tr().off;
    } catch (err) {
      console.error('reminder', err);
      message = tr().error;
    }
    busy = false; render();
  }

  els.btn.addEventListener('click', () => (subscribed ? disable() : enable()));

  els.time.addEventListener('change', async () => {
    if (!Pwa.validTime(els.time.value)) return;
    writeStore({ ...readStore(), time: els.time.value });
    if (subscribed) {
      try { const sub = await currentSub(); if (sub) await register(sub, els.time.value); } catch (err) { console.error(err); }
    }
    render();
  });

  els.install.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {});
    deferredPrompt = null;
    render();
  });

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; render(); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; render(); });
  window.addEventListener('langchange', async () => {
    render();
    if (subscribed) { try { const sub = await currentSub(); if (sub) await register(sub, readStore().time || Pwa.DEFAULT_TIME); } catch {} }
  });

  // L'activité du jour (une réponse suffit) coupe le rappel du jour : on la signale au serveur.
  let syncTimer = null;
  if (typeof Progress !== 'undefined') {
    Progress.setOnSave(() => {
      if (!subscribed) return;
      clearTimeout(syncTimer);
      syncTimer = setTimeout(async () => {
        try {
          const sub = await currentSub();
          if (sub) await post('/activity', { endpoint: sub.endpoint, ...activity() }, true);
        } catch {}
      }, 1500);
    });
  }

  render();
  currentSub().then(sub => {
    subscribed = !!sub && Notification.permission === 'granted' && readStore().on !== false;
    render();
  }).catch(() => {});
})();
