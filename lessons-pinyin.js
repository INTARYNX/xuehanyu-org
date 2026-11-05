// =========================================================================
// TON — pinyin « en phrase » (sandhi) — module partagé, testable
// -------------------------------------------------------------------------
// Mêmes règles que app.js :
//   • 3 + 3   → 2 + 3   (le premier ton 3 devient 2)
//   • 不 + 4  → bú       (2e ton)
//   • 一 + 4  → yí       (2e ton) ; sinon yì (4e ton)
// Le sandhi ne traverse PAS une ponctuation : « hǎo! hěn » reste hǎo hěn.
//
// Utilisable dans le navigateur (window.LessonsPinyin) et en Node
// (require('./lessons-pinyin.js')), sans build step.
// =========================================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LessonsPinyin = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TONE_MARKS = {
    a: 'āáǎà', o: 'ōóǒò', e: 'ēéěè',
    i: 'īíǐì', u: 'ūúǔù', 'ü': 'ǖǘǚǜ',
  };

  /** Ton d'une syllabe (1-4), 0 si neutre. */
  function toneOf(syllable) {
    const s = (syllable || '').toLowerCase();
    for (const [base, marks] of Object.entries(TONE_MARKS)) {
      for (let tn = 1; tn <= 4; tn++) if (s.includes(marks[tn - 1])) return tn;
    }
    return 0;
  }

  /** Réaccentue une syllabe avec le ton demandé. */
  function applyTone(syllable, tone) {
    if (!syllable || !tone || tone > 4) return syllable;
    let s = syllable.toLowerCase();
    for (const [base, marks] of Object.entries(TONE_MARKS)) {
      const plain = base === 'ü' ? 'v' : base;
      for (const m of marks) s = s.split(m).join(plain);
    }
    let idx = -1;
    if (s.includes('iu'))       idx = s.lastIndexOf('u');
    else if (s.includes('ui'))  idx = s.indexOf('i');
    else {
      for (const v of ['a', 'o', 'e']) { const i = s.indexOf(v); if (i >= 0) { idx = i; break; } }
      if (idx < 0) for (const v of ['i', 'u', 'v']) { const i = s.indexOf(v); if (i >= 0) { idx = i; break; } }
    }
    if (idx < 0) return syllable;
    const base = s[idx] === 'v' ? 'ü' : s[idx];
    const mark = TONE_MARKS[base][tone - 1];
    s = s.slice(0, idx) + mark + s.slice(idx + 1);
    return s.replace(/v/g, 'ü');
  }

  /** Forme « nue » d'une syllabe : sans diacritique, ü → v (bù → bu). */
  function base(syllable) {
    return (syllable || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ü/g, 'v');
  }

  /** Une syllabe terminée par de la ponctuation ferme le groupe de sandhi. */
  function closesGroup(syllable) {
    return /[.!?;,…:]$/.test(syllable || '');
  }

  /** Pinyin « en phrase » : renvoie la chaîne avec les tons réellement prononcés. */
  function phrasePinyin(pinyin) {
    const syllables = (pinyin || '').split(/\s+/).filter(Boolean);
    if (!syllables.length) return '';
    const tones = syllables.map(toneOf);
    const out = [...tones];

    const groups = [];
    let cur = [];
    syllables.forEach((s, i) => {
      cur.push(i);
      if (closesGroup(s)) { groups.push(cur); cur = []; }
    });
    if (cur.length) groups.push(cur);

    for (const g of groups) {
      for (let k = 0; k < g.length - 1; k++) {
        const i = g[k], j = g[k + 1];
        const syl = base(syllables[i]);
        if (tones[i] === 3 && tones[j] === 3) out[i] = 2;                 // 3+3 → 2+3
        if (syl === 'bu' && tones[i] === 4 && tones[j] === 4) out[i] = 2; // 不+4 → bú
        if (syl === 'yi' && tones[i] === 1) out[i] = tones[j] === 4 ? 2 : 4; // 一
      }
    }
    return syllables
      .map((s, i) => (out[i] !== tones[i] ? applyTone(s, out[i]) : s))
      .join(' ');
  }

  return { toneOf, applyTone, phrasePinyin, TONE_MARKS };
});
