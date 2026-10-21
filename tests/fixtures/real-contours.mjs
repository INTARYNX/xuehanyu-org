/**
 * tests/fixtures/real-contours.mjs — Contours de ton « réalistes »
 * ---------------------------------------------------------------------------
 * Corpus de contours de F0 inspirés de la phonétique du mandarin.
 *
 * Les contours sont exprimés en **demi-tons relatifs à la médiane de la
 * syllabe** — exactement l'échelle sur laquelle travaille le classifieur
 * (`extractFeatures`). Ils décrivent la forme de la hauteur telle qu'on
 * l'obtient sur un enregistrement réel, et non des figures de style
 * idéalisées : on y retrouve les accidents de la parole (plateau bas du
 * « demi-ton 3 », remontée finale, tête d'attaque, etc.).
 *
 * Notation de Chao (5 degrés) rappelée pour chaque contour :
 *   1 = 55 (haut, plat)      2 = 35 (montant)     3 = 214 (creusé)
 *   4 = 51 (tombant)         5 = 33 (neutre, bref)
 *
 * Les valeurs sont données à pas régulier (1 point ≈ 20 ms pour une
 * syllabe de ~480 ms) : c'est la résolution d'un suivi de F0 par fenêtre
 * glissante.
 */

/**
 * Convertit une suite de valeurs (demi-tons) en points [t, st] utilisables
 * par le synthétiseur de `tests/synth.mjs`.
 *
 * @param {number[]} values
 * @returns {Array<[number, number]>}
 */
export function toPoints(values) {
  const n = values.length;
  return values.map((v, i) => [n === 1 ? 0 : i / (n - 1), v]);
}

/**
 * Trames « parfaites » construites à partir des valeurs du contour :
 * la F0 suit exactement le contour, sans bruit ni erreur de mesure.
 * Sert à tester le CLASSEUR seul, indépendamment de YIN.
 *
 * @param {number[]} values    contour en demi-tons
 * @param {object}  [opts]
 * @param {number}  [opts.n]       nombre de trames
 * @param {number}  [opts.level]   F0 médiane (Hz)
 * @param {number}  [opts.hopMs]   pas de temps (ms)
 * @returns {Array<{t:number, freq:number, clarity:number, rms:number}>}
 */
export function contourFrames(values, opts = {}) {
  const { n = Math.max(12, values.length * 2), level = 150, hopMs = 16 } = opts;
  const frames = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const k = t * (values.length - 1);
    const i0 = Math.min(values.length - 1, Math.floor(k));
    const i1 = Math.min(values.length - 1, i0 + 1);
    const st = values[i0] + (values[i1] - values[i0]) * (k - i0);
    frames.push({
      t: i * hopMs,
      freq: level * Math.pow(2, st / 12),
      clarity: 0.92,
      rms: 0.06
    });
  }
  return frames;
}

/** Contours par identifiant. */
export const REAL = {
  // =========================================================================
  // TON 3 — 上声 (creusé). C'est le ton le plus varié : 213/214 complet,
  // 211 « demi-ton 3 », variantes avec attacke haute, creux tardif, etc.
  // =========================================================================

  /** 214 canonique : attacke médiane, creux vers 45 %, remontée jusqu'au bout. */
  '3-214-canonical': {
    tone: 3, chao: '214',
    label: 'ton 3 canonique : creux médian puis remontée complète',
    values: [
      1.6, 1.3, 0.8, 0.2, -0.4, -1.0, -1.5, -1.8, -1.9, -1.8, -1.5, -1.1,
      -0.6, -0.1, 0.4, 0.8, 1.1, 1.3, 1.4, 1.4, 1.3, 1.1, 0.9, 0.7
    ]
  },

  /** 214 avec le creux atteint tard (≈ 60 %) et une remontée partielle. */
  '3-214-late-valley': {
    tone: 3, chao: '214',
    label: 'ton 3 : creux tardif, remontée partielle',
    values: [
      1.9, 1.6, 1.1, 0.5, -0.2, -0.9, -1.4, -1.8, -2.0, -2.0, -1.9, -1.6,
      -1.2, -0.8, -0.4, 0.0, 0.3, 0.5, 0.6, 0.6, 0.5, 0.4, 0.3, 0.2
    ]
  },

  /** 211 « demi-ton 3 » : plateau bas sur la seconde moitié, sans remontée. */
  '3-211-half': {
    tone: 3, chao: '211',
    label: 'demi-ton 3 : plateau bas sans remontée finale',
    values: [
      1.8, 1.4, 0.9, 0.3, -0.4, -1.0, -1.4, -1.6, -1.6, -1.6, -1.6, -1.6,
      -1.5, -1.5, -1.5, -1.5, -1.5, -1.4, -1.4, -1.4, -1.3, -1.3, -1.3, -1.2
    ]
  },

  /** 211 avec le petit « tic » final (relèvement de la voix en fin de mot). */
  '3-211-half-tick': {
    tone: 3, chao: '211',
    label: 'demi-ton 3 : plateau bas suivi d’un petit relèvement final',
    values: [
      1.8, 1.4, 0.9, 0.3, -0.4, -1.0, -1.4, -1.6, -1.7, -1.7, -1.7, -1.7,
      -1.6, -1.6, -1.6, -1.5, -1.4, -1.3, -1.1, -0.9, -0.6, -0.3, 0.0, 0.3
    ]
  },

  /** Chute très rapide (« checked ») : le creux est atteint avant 35 %. */
  '3-fast-checked': {
    tone: 3, chao: '214',
    label: 'ton 3 très « checked » : la chute est achevée avant 35 %',
    values: [
      2.2, 1.6, 0.9, 0.2, -0.5, -1.1, -1.6, -1.9, -2.0, -1.9, -1.6, -1.2,
      -0.7, -0.2, 0.3, 0.7, 1.0, 1.2, 1.3, 1.3, 1.2, 1.0, 0.8, 0.6
    ]
  },

  /** Creux profond (≈ 5 demi-tons) avec un retour complet à la hauteur initiale. */
  '3-deep-dip': {
    tone: 3, chao: '214',
    label: 'ton 3 : creux très profond, retour à la hauteur de départ',
    values: [
      2.4, 1.9, 1.2, 0.4, -0.6, -1.4, -2.0, -2.4, -2.5, -2.4, -2.0, -1.5,
      -0.9, -0.2, 0.5, 1.1, 1.6, 1.9, 2.1, 2.1, 2.0, 1.8, 1.5, 1.2
    ]
  },

  /** Attaque haute (« yin shang ») : le ton 3 commence haut puis s'enfonce. */
  '3-high-onset': {
    tone: 3, chao: '214',
    label: 'ton 3 à attaque haute : le creux suit une attacke élevée',
    values: [
      3.4, 2.8, 2.0, 1.1, 0.2, -0.7, -1.5, -2.0, -2.2, -2.2, -2.0, -1.6,
      -1.1, -0.5, 0.1, 0.6, 1.0, 1.3, 1.4, 1.4, 1.3, 1.1, 0.9, 0.7
    ]
  },

  /** Creux peu marqué : ton 3 doux et bref. Cas limite (voir dipMin). */
  '3-shallow': {
    tone: 3, chao: '214',
    label: 'ton 3 peu marqué : creux d’environ 1,5 demi-ton',
    values: [
      1.5, 1.2, 0.8, 0.3, -0.2, -0.6, -0.9, -1.0, -1.0, -0.9, -0.7, -0.4,
      -0.1, 0.2, 0.4, 0.6, 0.7, 0.7, 0.6, 0.5, 0.3, 0.2, 0.0, -0.1
    ]
  },

  // =========================================================================
  // TON 4 — 去声 (tombant). Ce sont les principaux confusions du ton 3 :
  // la chute est progressive et le point bas est atteint à la fin.
  // =========================================================================

  /** 51 canonique : départ haut, glisse jusqu'au point bas. */
  '4-51-canonical': {
    tone: 4, chao: '51',
    label: 'ton 4 canonique : chute progressive jusqu’à la fin',
    values: [
      3.4, 3.2, 2.9, 2.5, 2.0, 1.4, 0.8, 0.1, -0.6, -1.2, -1.8, -2.3,
      -2.7, -3.0, -3.2, -3.4, -3.5, -3.6, -3.6, -3.6, -3.5, -3.4, -3.3, -3.2
    ]
  },

  /**
   * 51 avec palier final : la chute s'arrête net sur le dernier tiers.
   * L'amplitude reste celle d'un ton 4 (du degré 5 au degré 1) : c'est ce
   * qui le distingue d'un « demi-ton 3 », dont la chute est bien plus
   * courte.
   */
  '4-51-flat-tail': {
    tone: 4, chao: '51',
    label: 'ton 4 : la chute s’arrête sur un palier final',
    values: [
      4.2, 3.9, 3.4, 2.8, 2.1, 1.3, 0.5, -0.3, -1.0, -1.6, -2.1, -2.5,
      -2.8, -3.0, -3.1, -3.1, -3.1, -3.1, -3.0, -3.0, -2.9, -2.9, -2.8, -2.8
    ]
  },

  /** 51 à attacke très haute et chute rapide : confusion possible avec le ton 3. */
  '4-steep-fall': {
    tone: 4, chao: '51',
    label: 'ton 4 : chute rapide depuis une attacke très haute',
    values: [
      4.2, 3.4, 2.4, 1.3, 0.2, -0.8, -1.7, -2.4, -2.9, -3.2, -3.4, -3.5,
      -3.5, -3.5, -3.4, -3.3, -3.2, -3.1, -3.0, -2.9, -2.8, -2.7, -2.6, -2.5
    ]
  },

  // =========================================================================
  // TON 1 — 阴平 (haut, plat). Creux médian léger : le conteneur naturel
  // du faux « ton 3 ».
  // =========================================================================

  /** 55 canonique : niveau haut, légère dérive descendante (≈ 1,5 demi-ton). */
  '1-55-canonical': {
    tone: 1, chao: '55',
    label: 'ton 1 : niveau haut légèrement descendant',
    values: [
      0.8, 0.75, 0.6, 0.45, 0.3, 0.2, 0.1, 0.0, -0.1, -0.15, -0.2, -0.3,
      -0.35, -0.4, -0.45, -0.5, -0.55, -0.6, -0.65, -0.7, -0.7, -0.75, -0.75, -0.8
    ]
  },

  /** 55 avec creux médian et fin qui remonte légèrement. */
  '1-55-mid-dip': {
    tone: 1, chao: '55',
    label: 'ton 1 : creux médian léger, fin légèrement remontée',
    values: [
      1.2, 1.0, 0.7, 0.4, 0.1, -0.2, -0.4, -0.5, -0.5, -0.4, -0.3, -0.2,
      -0.1, 0.0, 0.1, 0.1, 0.0, -0.1, -0.2, -0.3, -0.3, -0.4, -0.4, -0.5
    ]
  },

  // =========================================================================
  // TON 2 — 阳平 (montant).
  // =========================================================================

  /** 35 canonique : départ médian-bas, montée franche. */
  '2-35-canonical': {
    tone: 2, chao: '35',
    label: 'ton 2 : montée franche depuis le niveau médian-bas',
    values: [
      -1.8, -1.7, -1.5, -1.2, -0.9, -0.5, -0.1, 0.3, 0.7, 1.1, 1.4, 1.7,
      1.9, 2.1, 2.3, 2.4, 2.5, 2.5, 2.5, 2.4, 2.3, 2.2, 2.1, 2.0
    ]
  },

  /** 35 avec un petit creux d'attaque (la montée démarre après un « bounce »). */
  '2-35-initial-dip': {
    tone: 2, chao: '35',
    label: 'ton 2 : petit creux d’attaque avant la montée',
    values: [
      -0.6, -0.9, -1.1, -1.2, -1.1, -0.9, -0.6, -0.2, 0.2, 0.6, 1.0, 1.4,
      1.7, 2.0, 2.2, 2.4, 2.5, 2.5, 2.5, 2.4, 2.3, 2.2, 2.1, 2.0
    ]
  },

  // =========================================================================
  // TON 5 — 轻声 (neutre, bref).
  // =========================================================================

  /** 33 : niveau médian, très bref, légère montée. */
  '5-33-canonical': {
    tone: 5, chao: '33',
    label: 'ton 5 : niveau médian bref, légère montée',
    values: [
      -0.3, -0.2, -0.1, 0.0, 0.1, 0.2, 0.3, 0.4, 0.4, 0.5, 0.5, 0.5
    ]
  }
};

/** Tous les contours du corpus, dans l'ordre. */
export const REAL_KEYS = Object.keys(REAL);

/** Les contours qui doivent être reconnus comme un ton 3. */
export const TONE3_KEYS = REAL_KEYS.filter(k => REAL[k].tone === 3);

/** Les contours qui ne doivent surtout PAS être reconnus comme un ton 3. */
export const NOT_TONE3_KEYS = REAL_KEYS.filter(k => REAL[k].tone !== 3);
