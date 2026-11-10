// =========================================================================
// SPEECH — synthèse vocale chinoise (Web Speech API), partagée par le dictionnaire,
// le quiz et les leçons.
//
// La voix n'est PAS fournie par le site : c'est celle du système. Les téléphones
// (Android, iPhone) et les Mac en ont une chinoise d'office ; Windows et Linux non,
// tant qu'on n'a pas installé le pack de langue chinois. Sans voix chinoise, le
// navigateur lit les caractères avec une voix anglaise ou française, c'est-à-dire
// rien d'utile : on le dit à l'utilisateur au lieu de rester muet.
// =========================================================================
const Speech = (() => {
  const LANG_RX = /^(zh|cmn|yue)([-_]|$)/i;
  const NAME_RX = /chinese|mandarin|putonghua|中文|普通话|國語|国语|huihui|yaoyao|kangkang|xiaoxiao|xiaoyi|yunxi|yunyang|ting-?ting|mei-?jia|sin-?ji/i;

  const isChinese = v => !!v && (LANG_RX.test(v.lang || '') || NAME_RX.test(v.name || ''));

  /** La meilleure voix chinoise : zh-CN d'abord, puis n'importe quelle voix chinoise. */
  function pickVoice(voices) {
    const zh = (voices || []).filter(isChinese);
    return zh.find(v => /CN|Hans/i.test(v.lang || '')) || zh[0] || null;
  }

  /**
   * Verdict sur la liste de voix : 'ok' (une voix chinoise), 'none' (des voix, mais aucune chinoise :
   * rien d'utile à dire), 'unknown' (liste vide : certains navigateurs ne l'exposent pas et parlent
   * quand même avec `lang = zh-CN`, on essaie).
   */
  function verdict(voices) {
    if (!voices || !voices.length) return 'unknown';
    return pickVoice(voices) ? 'ok' : 'none';
  }

  const T = {
    fr: {
      title: 'Aucune voix chinoise sur cet appareil',
      intro: "La prononciation utilise la voix chinoise du système, et il n'y en a pas ici : elle ne peut donc pas être lue.",
      windows: 'Windows : Paramètres › Heure et langue › Langue et région › Ajouter une langue › Chinois (simplifié), puis « Options de langue » › installer la synthèse vocale. Redémarrez ensuite le navigateur.',
      mac: 'Mac : Réglages Système › Accessibilité › Contenu énoncé › Voix du système › Gérer les voix › Chinois.',
      linux: "Linux : installez une voix chinoise pour speech-dispatcher (par exemple espeak-ng avec la voix « cmn »), puis redémarrez le navigateur.",
      ios: 'iPhone : Réglages › Accessibilité › Contenu énoncé › Voix › Chinois.',
      android: 'Android : Réglages › Langues et saisie › Synthèse vocale › Moteur Google › installer les données vocales chinoises.',
      other: 'Installez une voix chinoise dans les réglages de synthèse vocale de votre système.',
      tip: 'Sur téléphone, la prononciation fonctionne directement.',
      close: 'Fermer',
    },
    en: {
      title: 'No Chinese voice on this device',
      intro: 'Pronunciation uses the system’s Chinese voice, and this device has none: it cannot be read aloud.',
      windows: 'Windows: Settings › Time & language › Language & region › Add a language › Chinese (Simplified), then “Language options” › install text-to-speech. Restart the browser afterwards.',
      mac: 'Mac: System Settings › Accessibility › Spoken Content › System Voice › Manage Voices › Chinese.',
      linux: 'Linux: install a Chinese voice for speech-dispatcher (for example espeak-ng with the “cmn” voice), then restart the browser.',
      ios: 'iPhone: Settings › Accessibility › Spoken Content › Voices › Chinese.',
      android: 'Android: Settings › Language & input › Text-to-speech › Google engine › install the Chinese voice data.',
      other: 'Install a Chinese voice in your system’s text-to-speech settings.',
      tip: 'On a phone, pronunciation works out of the box.',
      close: 'Close',
    },
  };

  /** Quel paragraphe d'aide afficher selon le système. */
  function platformOf(ua = '', platform = '', touchPoints = 0) {
    if (/iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && touchPoints > 1)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    if (/Win/i.test(platform) || /Windows/i.test(ua)) return 'windows';
    if (/Mac/i.test(platform) || /Macintosh/i.test(ua)) return 'mac';
    if (/Linux|X11|CrOS/i.test(ua + platform)) return 'linux';
    return 'other';
  }

  /** Nom de fichier d'un mot : ses codepoints en hexadécimal, séparés par « - » (爱 -> 7231). Même règle que scripts/build_audio.py. */
  const audioKey = text => [...String(text)].map(c => c.codePointAt(0).toString(16)).join('-');

  /** Téléphone : la voix native (Android, iPhone) est bonne et ne coûte aucun téléchargement : on la prend pour les mots, le fichier MP3 ne sert qu'en secours. */
  const nativeFirst = os => os === 'ios' || os === 'android';

  return { isChinese, pickVoice, verdict, platformOf, nativeFirst, audioKey, T };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Speech;

// ------------------------------------------------------------------ navigateur
if (typeof window !== 'undefined' && typeof document !== 'undefined') (() => {
  const synth = window.speechSynthesis || null;     // absente de certains navigateurs : les fichiers audio marchent quand même
  let unlocked = false;

  // iOS : la synthèse refuse de parler avant un premier geste de l'utilisateur ; on la déverrouille.
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); } catch {}   // (sans synth : exception, ignorée)
  }
  ['pointerdown', 'touchstart', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, { once: true, passive: true }));

  /** Les voix arrivent parfois tard (Chrome) : on attend l'événement, avec un filet. */
  function voices() {
    return new Promise(resolve => {
      if (!synth) return resolve([]);
      const now = synth.getVoices();
      if (now.length) return resolve(now);
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(synth.getVoices()); } };
      synth.addEventListener('voiceschanged', finish, { once: true });
      setTimeout(finish, 1200);
    });
  }

  let notice = null;
  let dismissed = false;          // fermé par l'utilisateur : on ne le remontre pas à chaque question
  function showNotice() {
    if (notice || dismissed) return;
    const lang = document.documentElement.lang === 'en' ? 'en' : 'fr';
    const t = Speech.T[lang];
    const os = Speech.platformOf(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
    notice = document.createElement('div');
    notice.className = 'speech-notice';
    notice.setAttribute('role', 'alert');
    notice.innerHTML = `<button type="button" class="speech-notice-close" aria-label="${t.close}">×</button>
      <b>${t.title}</b><p>${t.intro}</p><p>${t[os] || t.other}</p><p class="speech-notice-tip">${t.tip}</p>`;
    notice.querySelector('button').addEventListener('click', () => { notice.remove(); notice = null; dismissed = true; });
    document.body.appendChild(notice);
  }

  // ---- fichiers audio (voix Kokoro, voir scripts/build_audio.py) : lus en priorité -------------------
  // Un seul élément <audio> réutilisé : sur iOS, il n'est autorisé à jouer qu'après avoir été « débloqué »
  // par un geste, puis il peut enchaîner les lectures (quiz, dialogues) sans nouveau geste.
  const player = new Audio();
  const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
  ['pointerdown', 'touchstart', 'keydown'].forEach(ev => document.addEventListener(ev, () => {
    if (player.dataset.unlocked) return;
    player.dataset.unlocked = '1';
    try { player.src = SILENCE; const p = player.play(); if (p && p.catch) p.catch(() => {}); } catch {}
  }, { once: true, passive: true }));

  let words = null;                       // mots disponibles en audio (audio/index.json)
  const indexReady = fetch('audio/index.json').then(r => (r.ok ? r.json() : null))
    .then(j => { if (j && Array.isArray(j.words)) words = new Set(j.words); }).catch(() => {});

  const wordSrc = text => (words && words.has(Speech.audioKey(text)) ? `audio/w/${Speech.audioKey(text)}.mp3` : null);

  let cancelAudio = null;                 // coupe la lecture en cours et résout sa promesse
  async function playFile(src) {
    // fetch + blob (et non src=URL) : le service worker met le fichier en cache sans souci de requêtes « Range » (Safari)
    const res = await fetch(src);
    if (!res.ok) throw new Error('audio ' + res.status);
    const url = URL.createObjectURL(await res.blob());
    try {
      return await new Promise((resolve, reject) => {
        cancelAudio = () => { try { player.pause(); } catch {} resolve('stopped'); };
        player.onended = () => resolve('spoken');
        player.onerror = () => reject(new Error('audio'));
        player.src = url;
        const p = player.play();
        if (p && p.catch) p.catch(reject);
      });
    } finally { cancelAudio = null; URL.revokeObjectURL(url); }
  }

  /**
   * Prononce `text`. Le fichier audio d'abord (`src`, ou celui du mot s'il existe), puis la voix du système.
   * La promesse se résout à la fin de la lecture : 'spoken' | 'stopped' | 'no-voice' | 'error'.
   */
  let seq = 0;                            // une lecture plus récente annule les secours de la précédente

  async function speak(text, { rate = 0.8, src = null } = {}) {
    stop();
    const mine = ++seq;
    const isWord = !src;                  // sans `src` : un mot isolé ; les répliques de dialogue portent le leur
    if (isWord) { await Promise.race([indexReady, new Promise(r => setTimeout(r, 600))]); src = wordSrc(text); }

    // Mot sur téléphone : voix native d'abord, silencieusement ; le MP3 seulement si elle manque ou échoue.
    if (isWord && Speech.nativeFirst(Speech.platformOf(navigator.userAgent, navigator.platform, navigator.maxTouchPoints))) {
      const r = await speakWithSystemVoice(text, rate, false);
      if (mine !== seq) return 'stopped';           // une autre lecture a pris le relais pendant l'attente
      if (r === 'spoken') return r;
      if (src) { try { return await playFile(src); } catch { /* fichier absent ou illisible */ } }
      if (r === 'no-voice') showNotice();
      return r;
    }

    if (src) { try { return await playFile(src); } catch { /* fichier absent ou illisible : voix du système */ } }
    return speakWithSystemVoice(text, rate);
  }

  /** La voix chinoise du système ; un message explique quand il n'y en a pas (sauf `notify = false`). */
  async function speakWithSystemVoice(text, rate, notify = true) {
    const warn = () => { if (notify) showNotice(); };
    if (!synth) { warn(); return 'no-voice'; }
    const list = await voices();
    const v = Speech.verdict(list);
    if (v === 'none') { warn(); return 'no-voice'; }
    return new Promise(resolve => {
      let finished = false;
      let safety;
      const finish = result => { if (finished) return; finished = true; clearTimeout(safety); resolve(result); };
      safety = setTimeout(() => finish('error'), Math.max(4000, [...String(text)].length * 700 + 2500));
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = rate;
      const voice = Speech.pickVoice(list);
      if (voice) u.voice = voice;
      u.onend = () => finish('spoken');
      u.onerror = e => {
        if (e && e.error === 'language-unavailable') { warn(); finish('no-voice'); } else finish('error');
      };
      try { synth.speak(u); } catch { finish('error'); }
    });
  }

  /** Coupe toute lecture en cours (fichier ou voix du système). */
  function stop() {
    if (cancelAudio) cancelAudio();
    try { if (synth) synth.cancel(); } catch {}
  }

  window.Speech = Object.assign(Speech, { speak, stop });
})();
