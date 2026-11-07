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

  return { isChinese, pickVoice, verdict, platformOf, T };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Speech;

// ------------------------------------------------------------------ navigateur
if (typeof window !== 'undefined' && typeof document !== 'undefined' && 'speechSynthesis' in window) (() => {
  const synth = window.speechSynthesis;
  let unlocked = false;

  // iOS : la synthèse refuse de parler avant un premier geste de l'utilisateur ; on la déverrouille.
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); } catch {}
  }
  ['pointerdown', 'touchstart', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, { once: true, passive: true }));

  /** Les voix arrivent parfois tard (Chrome) : on attend l'événement, avec un filet. */
  function voices() {
    return new Promise(resolve => {
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

  /**
   * Prononce `text`. La promesse se résout quand la voix a fini (ou échoué) :
   * 'spoken' | 'no-voice' | 'error'. Un navigateur qui ne déclenche jamais `end` est coupé par un
   * délai proportionnel à la longueur du texte.
   */
  async function speak(text, { rate = 0.8 } = {}) {
    const list = await voices();
    const v = Speech.verdict(list);
    if (v === 'none') { showNotice(); return 'no-voice'; }
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
        if (e && e.error === 'language-unavailable') { showNotice(); finish('no-voice'); } else finish('error');
      };
      try { synth.speak(u); } catch { finish('error'); }
    });
  }

  /** Coupe toute lecture en cours. */
  function stop() { try { synth.cancel(); } catch {} }

  window.Speech = Object.assign(Speech, { speak, stop });
})();
