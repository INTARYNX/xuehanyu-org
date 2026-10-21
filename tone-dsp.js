/*!
 * tone-dsp.js — Détection de la hauteur (F0) et classification du ton du mandarin
 * ---------------------------------------------------------------------------
 * Module pur, sans DOM et sans dépendance externe. Utilisable :
 *   - dans le navigateur : window.ToneDSP
 *   - dans Node         : require('./tone-dsp.js')  /  import ToneDSP from './tone-dsp.js'
 *
 * Format d'une trame d'analyse (frame) :
 *   { t: <ms depuis le début>, freq: <Hz | null>, clarity: <0..1>, rms: <0..1> }
 *
 * Le pipeline complet est `analyze(frames, opts)` :
 *   frames → segmentVoiced → repairOctaves → smoothMedian → extractFeatures → classifyTone
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ToneDSP = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // =========================================================================
  // CONSTANTES & VALEURS PAR DÉFAUT
  // =========================================================================

  /** Seuils par défaut — tous en demi-tons sauf `duration` (ms). */
  const DEFAULTS = {
    yin: {
      threshold: 0.12,   // seuil absolu sur la différence normalisée d'(τ)
      minFreq: 60,       // borne basse de la bande vocale (Hz)
      maxFreq: 800,      // borne haute de la bande vocale (Hz)
      rmsGate: 0.008,    // niveau minimal (RMS) pour considérer la trame comme-voix
      windowSize: 0      // 0 = auto (N/2)
    },
    segment: {
      minClarity: 0.50,  // périodicité minimale exigée pour une trame « voix »
      noiseFactor: 3,    // plancher × noiseFactor
      peakFactor: 0.25,  // pic × peakFactor
      minRms: 0.008,     // plancher de bruit minimal
      minFrames: 4,      // durée minimale du segment (trames)
      maxGap: 2          // trous de non-voix tolérés à l'intérieur du segment (trames)
    },
    octave: {
      semitones: 12,     // amplitude d'une octave
      tolerance: 3,      // tolérance de détection d'un saut d'octave (demi-tons)
      historySize: 3,    // nombre de trames pour calculer la référence locale
    },
    smooth: {
      size: 3            // taille du filtre médian (trames)
    },
    shape: {
      valleySmooth: 3,   // taille de la médiane glissante du contour (trames)
      valleyBand: 0.6,   // semi-tons : bande de tolérance autour du creux/sommet
      valleyProminence: 0.3 // semi-tons : profondeur min d'un creux local « réel »
    },
    tone: {
      // --- TON 4 : tombant -----------------------------------------------
      fallMin: 2.5,      // semi-tons : chute nette (début → fin)
      fallRateMin: 4.0,  // semi-tons/syllabe : la chute doit être franche
      endRecovery: 0.8,  // semi-tons : la fin ne remonte pas au-dessus du creux
      // --- TON 2 : montant ------------------------------------------------
      riseMin: 2.0,      // semi-tons : montée nette
      riseMaxPos: 0.40,  // position du minimum (la montée commence tôt)
      // --- TON 3 : creusé -------------------------------------------------
      // Un ton 3 (上声) se reconnaît à sa STRUCTURE : la hauteur tombe
      // rapidement dès l'attaque (« ton checked »), atteint un creux, puis
      // remonte (214) ou reste au fond (211).
      dipMin: 1.1,       // semi-tons : profondeur minimale du creux
      dipRise: 0.5,      // semi-tons : remontée finale exigée (ton 3 « complet »)
      dipDominance: 0.8, // semi-tons : le creux doit dominer les autres creux
      onsetFall: 0.30,   // part de la chute accomplishue dès le 1er tiers
      fallMax: 4.6,      // semi-tons : amplitude MAX du creux d'un ton 3
      fallNetMax: 4.5,   // semi-tons : chute nette MAX d'un ton 3 (début → fin)
      halfDipMin: 1.5,   // semi-tons : creux minimal du « demi-ton 3 »
      halfTailFlat: 1.2, // semi-tons : la fin reste au niveau du creux
      halfEndFall: -0.8, // semi-tons : la fin ne plonge pas
      // --- position du creux ----------------------------------------------
      valleyMinPos: 0.15,// le creux est atteint après le début de la syllabe
      valleyMaxPos: 0.60,// ... et avant la fin : la chute est achevée à mi-syllabe
      // --- tons plats ------------------------------------------------------
      flatSlope: 2.0,    // semi-tons : |pente| max pour un ton plat
      flatRange: 2.5,    // semi-tons : étendue max pour un ton plat
      neutralDur: 280,   // ms : durée sous laquelle un ton plat est un ton 5
      neutralRange: 2.0, // semi-tons : étendue max pour un ton 5
      minConfidence: 0.45 // en dessous → résultat « incertain »
    }
  };

  // =========================================================================
  // UTILITAIRES
  // =========================================================================

  /** Médiane d'un tableau de nombres. */
  function median(values) {
    if (!values || !values.length) return NaN;
    const s = Float64Array.from(values);
    s.sort();
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /** Borne une valeur dans [lo, hi]. */
  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }


  /** Conversion Hz → semi-tons (relatifs à `refHz`). */
  function toSemitones(hz, refHz) {
    return 12 * Math.log2(hz / refHz);
  }

  /** Moyenne d'un tableau de nombres. */
  function mean(values) {
    if (!values || !values.length) return NaN;
    let s = 0;
    for (let i = 0; i < values.length; i++) s += values[i];
    return s / values.length;
  }

  /**
   * Médiane glissante centrée : supprime les pics isolés (erreurs ponctuelles
   * de F0) tout en conservant la forme d'ensemble du contour.
   *
   * @param {number[]} values
   * @param {number} size  taille de la fenêtre (trames), impaire de préférence
   * @returns {number[]} Nouveau tableau (même longueur).
   */
  function smoothSeries(values, size) {
    const w = Math.max(1, size | 0);
    if (w < 2 || values.length < 2) return values.slice();
    const half = w >> 1;
    const out = new Array(values.length);
    for (let i = 0; i < values.length; i++) {
      // Fenêtre de taille CONSTANTE : aux bords, elle est décalée vers
      // l'intérieur plutôt que tronquée. Une fenêtre tronquée n'aurait
      // qu'un ou deux échantillons — et sa médiane laisserait passer un pic
      // isolé (typiquement la trame d'attaque, très parasite).
      let lo = i - half;
      let hi = i + half;
      if (lo < 0) { lo = 0; hi = w - 1; }
      if (hi > values.length - 1) { lo = values.length - w; hi = values.length - 1; }
      const win = [];
      for (let j = lo; j <= hi; j++) win.push(values[j]);
      out[i] = median(win);
    }
    return out;
  }

  /**
   * Extrémum robuste d'un contour, avec sa POSITION.
   *
   * Deux positions sont renvoyées :
   *   - `pos`     : le centre de la « bande » des indices qui atteignent
   *                 l'extrême. Un creux large (palier bas) donne ainsi son
   *                 MILIEU et non son bord ; un creux pointu donne son sommet.
   *   - `reachPos`: la position du PREMIER indice qui atteint l'extrême.
   *                 C'est la position à laquelle la hauteur a fini de
   *                 descendre : elle distingue un creux médian (atteint
   *                 tôt) d'une chute qui se poursuit jusqu'au bout.
   *
   * @param {number[]} series  contour lissé
   * @param {string}  kind    'min' | 'max'
   * @param {number}  band    tolérance (semi-tons) autour de l'extrême
   */
  function robustExtremum(series, kind, band) {
    let idx = 0;
    for (let i = 1; i < series.length; i++) {
      if (kind === 'min' ? series[i] < series[idx] : series[i] > series[idx]) idx = i;
    }
    const value = series[idx];
    const hit = [];
    for (let i = 0; i < series.length; i++) {
      if (Math.abs(series[i] - value) <= band) hit.push(i);
    }
    const last = Math.max(1, series.length - 1);
    const center = hit.length ? hit[Math.floor((hit.length - 1) / 2)] : idx;
    const first = hit.length ? hit[0] : idx;
    return {
      value,
      index: idx,
      pos: center / last,
      reachPos: first / last
    };
  }

  /**
   * Creux locaux « réels » d'un contour, du plus profond au moins profond.
   *
   * Un creux ne compte que s'il descend d'au moins `minDepth` semi-tons
   * sous ses deux voisins : un simple palier plat (profondeur nulle) et un
   * tremblement de faible amplitude sont ainsi écartés.
   *
   * @param {number[]} series  contour lissé
   * @param {number}   minDepth  profondeur minimale (semi-tons)
   * @returns {Array<{index:number, value:number, depth:number}>}
   */
  function localMinima(series, minDepth) {
    const out = [];
    for (let i = 1; i < series.length - 1; i++) {
      const v = series[i];
      if (v > series[i - 1] || v > series[i + 1]) continue; // pas un minimum local
      const depth = Math.min(series[i - 1], series[i + 1]) - v;
      if (depth < minDepth) continue;
      out.push({ index: i, value: v, depth });
    }
    out.sort((a, b) => a.value - b.value);
    return out;
  }

  /**
   * Pente par moindres carrés sur une plage d'indices.
   * @param {number[]} rel  Valeurs relatives (semi-tons).
   * @param {number} from   Premier indice.
   * @param {number} to     Dernier indice.
   * @returns {number} Pente en semi-tons sur toute la plage.
   */
  function regressionSlope(rel, from, to) {
    const n = to - from + 1;
    if (n < 3) return 0;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (let i = from; i <= to; i++) {
      const x = (i - from) / (n - 1);
      const y = rel[i];
      sx += x; sy += y; sxy += x * y; sxx += x * x;
    }
    const den = n * sxx - sx * sx;
    if (Math.abs(den) < 1e-9) return 0;
    return (n * sxy - sx * sy) / den;
  }

  // =========================================================================
  // 1. YIN — détection de la fréquence fondamentale
  // =========================================================================
  /**
   * Détecte la fréquence fondamentale d'un bloc audio.
   *
   * Étapes : fonction de différence → CMND → seuil absolu + descente au
   * minimum local → repli sur le minimum global → interpolation parabolique.
   *
   * @param {Float32Array|number[]} buf        Samples audio (float [-1, 1]).
   * @param {number} sampleRate                Fréquence d'échantillonnage (Hz).
   * @param {object} [opts]                    Surcharge de DEFAULTS.yin.
   * @returns {{frequency:number, clarity:number, rms:number, tau:number, viaFallback:boolean}|null}
   */
  function yin(buf, sampleRate, opts) {
    const o = Object.assign({}, DEFAULTS.yin, opts || {});
    if (!buf || buf.length < 64 || !sampleRate) return null;

    const N = buf.length;

    // --- Retrait de la composante continue + niveau RMS -------------------
    let mean = 0;
    for (let i = 0; i < N; i++) mean += buf[i];
    mean /= N;

    let energy = 0;
    for (let i = 0; i < N; i++) {
      const v = buf[i] - mean;
      energy += v * v;
    }
    const rms = Math.sqrt(energy / N);
    if (rms < o.rmsGate) return null; // silence ou souffle trop faible

    const x = new Float64Array(N);
    for (let i = 0; i < N; i++) x[i] = buf[i] - mean;

    // --- Bornes de la recherche ------------------------------------------
    const W = Math.min(N >> 1, o.windowSize > 0 ? o.windowSize : (N >> 1));
    const tauMin = Math.max(2, Math.floor(sampleRate / o.maxFreq));
    const tauMax = Math.min(W - 1, Math.ceil(sampleRate / o.minFreq));
    if (tauMax <= tauMin) return null;

    // --- Étape 1 : fonction de différence d(τ) ----------------------------
    const d = new Float64Array(tauMax + 1);
    for (let tau = 1; tau <= tauMax; tau++) {
      let s = 0;
      for (let i = 0; i < W; i++) {
        const diff = x[i] - x[i + tau];
        s += diff * diff;
      }
      d[tau] = s;
    }

    // --- Étape 2 : différence normalisée cumulée d'(τ) ---------------------
    const cmnd = new Float64Array(tauMax + 1);
    let running = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      running += d[tau];
      cmnd[tau] = running > 0 ? (d[tau] * tau) / running : 1;
    }

    // --- Étape 3 : seuil absolu puis descente au minimum local --------------
    let tau = -1;
    for (let t = tauMin; t <= tauMax; t++) {
      if (cmnd[t] < o.threshold) { tau = t; break; }
    }

    let viaFallback = false;
    if (tau === -1) {
      // Repli : minimum global de d'(τ) (signal bruité mais encore périodique)
      viaFallback = true;
      let best = Infinity;
      for (let t = tauMin; t <= tauMax; t++) {
        if (cmnd[t] < best) { best = cmnd[t]; tau = t; }
      }
      if (tau === -1) return null;
    } else {
      while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;
      // Raffinement local : on prend le minimum sur ±2 trames (robustesse
      // aux micro-oscillations de d' autour du creux)
      let best = tau;
      for (let t = Math.max(tauMin, tau - 2); t <= Math.min(tauMax, tau + 2); t++) {
        if (cmnd[t] < cmnd[best]) best = t;
      }
      tau = best;
    }

    // --- Étape 4 : interpolation parabolique (résolution sous-échantillon) --
    let refined = tau;
    if (tau > tauMin && tau < tauMax) {
      const s0 = cmnd[tau - 1];
      const s1 = cmnd[tau];
      const s2 = cmnd[tau + 1];
      const denom = 2 * (2 * s1 - s2 - s0);
      if (denom !== 0) {
        const shift = (s2 - s0) / denom;
        if (shift > -1 && shift < 1) refined = tau + shift;
      }
    }

    const frequency = sampleRate / refined;
    if (!isFinite(frequency) || frequency < o.minFreq || frequency > o.maxFreq) return null;

    // --- Score de périodicité : 1 − d'(τ) ----------------------------------
    const clarity = clamp(1 - cmnd[tau], 0, 1);

    return { frequency, clarity, rms, tau: refined, viaFallback };
  }

  // =========================================================================
  // 2. CORRECTION D'OCTAVE LOCALE
  // =========================================================================
  /**
   * Corrige les erreurs d'octave (YIN renvoie parfois 2× ou 0,5× la vraie F0)
   * **sans aplatir les vraies excursions du contour**.
   *
   * Principe : la référence est la médiane des trames *voisines* (fenêtre
   * glissante), pas la médiane globale de la syllabe. Un écart de ±12 demi-tons
   * par rapport à ce voisinage est un saut d'octave ; une vraie montée de 7
   * demi-tons (ton 2) ne l'est pas.
   *
   * @param {Array} frames  Trames `{ t, freq, clarity, rms }`.
   * @param {object} [opts]  Surcharge de DEFAULTS.octave.
   * @returns {Array} Nouvelle liste de trames (fréquences corrigées).
   */
  function repairOctaves(frames, opts) {
    const o = Object.assign({}, DEFAULTS.octave, opts || {});
    const out = frames.map(f => Object.assign({}, f));
    const history = [];

    for (let i = 0; i < out.length; i++) {
      const f = out[i];
      if (!f.freq) { history.length = 0; continue; }

      let s = 12 * Math.log2(f.freq);

      if (history.length >= 2) {
        const ref = median(history);
        const diff = s - ref;
        if (Math.abs(diff - o.semitones) <= o.tolerance) {
          s -= o.semitones;              // trame une octave trop haut
        } else if (Math.abs(diff + o.semitones) <= o.tolerance) {
          s += o.semitones;              // trame une octave trop bas
        }
        f.freq = Math.pow(2, s / 12);
      }

      history.push(12 * Math.log2(f.freq));
      if (history.length > o.historySize) history.shift();
    }

    return out;
  }

  // =========================================================================
  // 3. LISSAGE MÉDIAN (3 trames)
  // =========================================================================
  /**
   * Filtre médian glissant : supprime les pics isolés tout en préservant les
   * fronts (un front de hauteur n'est pas atténué, contrairement à une
   * moyenne mobile).
   *
   * @param {Array} frames Trames `{ t, freq, clarity, rms }`.
   * @param {object} [opts] Surcharge de DEFAULTS.smooth.
   * @returns {Array} Nouvelle liste de trames.
   */
  function smoothMedian(frames, opts) {
    const o = Object.assign({}, DEFAULTS.smooth, opts || {});
    const size = Math.max(1, o.size | 0);
    if (size < 2) return frames.map(f => Object.assign({}, f));

    const out = frames.map(f => Object.assign({}, f));
    const half = size >> 1;

    for (let i = 0; i < out.length; i++) {
      if (!out[i].freq) continue;
      const win = [];
      for (let j = Math.max(0, i - half); j <= Math.min(out.length - 1, i + half); j++) {
        if (out[j].freq) win.push(12 * Math.log2(out[j].freq));
      }
      if (win.length < 2) continue;
      out[i].freq = Math.pow(2, median(win) / 12);
    }

    return out;
  }

  // =========================================================================
  // 4. SEGMENTATION VOIX / SILENCE (VAD)
  // =========================================================================
  /**
   * Isole le segment vocal principal à partir des trames analysées.
   *
   * Une trame est « voix » si :
   *   - elle porte une fréquence (YIN a réussi), et
   *   - son RMS dépasse max(minRms, noiseFactor × plancher de bruit), et
   *   - sa périodicité (clarity) dépasse minClarity.
   *
   * Les trous de non-voix courts (≤ maxGap trames) sont recollés.
   *
   * @param {Array} frames Trames `{ t, freq, clarity, rms }`.
   * @param {object} [opts] Surcharge de DEFAULTS.segment.
   * @returns {{start:number, end:number}|null} Index de début/fin (inclus).
   */
  function segmentVoiced(frames, opts) {
    const o = Object.assign({}, DEFAULTS.segment, opts || {});
    if (!frames || !frames.length) return null;

    // Seuil d-energy adaptatif. On combine deux références :
    //   - le plancher de bruit (10e percentile des RMS),
    //   - le niveau de parole (90e percentile des RMS).
    // Le seuil retenu est le plus STRICT des deux, mais jamais au-delà de
    // 25 % du niveau de parole : sans cela, un enregistrement entièrement
    // voisé (pas une seule seconde de silence) verrait son seuil placé
    // au-dessus de la voix et aucun segment ne serait trouvé.
    const rmsList = frames.map(f => f.rms || 0).filter(v => v > 0).sort((a, b) => a - b);
    const pct = q => (rmsList.length
      ? rmsList[Math.min(rmsList.length - 1, Math.floor(rmsList.length * q))]
      : 0);
    const floor = pct(0.1);
    const peak = pct(0.9);
    const gate = Math.max(o.minRms, Math.min(floor * o.noiseFactor, peak * o.peakFactor));

    const voiced = frames.map(f =>
      !!f.freq &&
      (f.rms || 0) >= gate &&
      (f.clarity === undefined || f.clarity === null ? 1 : f.clarity) >= o.minClarity
    );

    // Recollage des trous courts
    const merged = voiced.slice();
    for (let i = 0; i < merged.length; i++) {
      if (merged[i]) continue;
      let j = i;
      while (j < merged.length && !merged[j]) j++;
      const gap = j - i;
      if (gap > 0 && gap <= o.maxGap && i > 0 && j < merged.length) {
        for (let k = i; k < j; k++) merged[k] = true;
      }
      i = j - 1;
    }

    // Plus long segment continu
    let best = null;
    let start = -1;
    for (let i = 0; i <= merged.length; i++) {
      if (i < merged.length && merged[i]) {
        if (start < 0) start = i;
        continue;
      }
      if (start >= 0) {
        const len = i - start;
        if (!best || len > best.end - best.start + 1) best = { start, end: i - 1 };
        start = -1;
      }
    }

    if (!best || (best.end - best.start + 1) < o.minFrames) return null;
    return best;
  }

  // =========================================================================
  // 5. EXTRACTION DES CARACTÉRISTIQUES
  // =========================================================================
  /**
   * Calcule les caractéristiques de forme du contour, **en demi-tons** et
   * relatives à la médiane de la syllabe (indépendant du registre du locuteur).
   *
   * @param {Array} frames  Trames du segment vocal (ou toutes les trames).
   * @param {object} [opts] `{ hopMs }` pour la durée.
   * @returns {object|null} Caractéristiques, ou null si segment trop court.
   */
  function extractFeatures(frames, opts) {
    const o = Object.assign({}, DEFAULTS.shape, opts || {});
    const voiced = frames.filter(f => f && f.freq);
    if (voiced.length < 3) return null;

    const n = voiced.length;
    const abs = voiced.map(f => 12 * Math.log2(f.freq));
    const level = median(abs);              // F0 médiane de la syllabe (semi-tons)
    const rel = abs.map(v => v - level);     // relatives à la médiane

    // Contour lissé : la médiane glissante supprime les pics isolés (erreurs
    // ponctuelles de F0) sans effacer la forme d'ensemble.
    const smooth = smoothSeries(rel, o.valleySmooth);

    // Extrémités : médiane des 20 % extrêmes (robuste aux pics résiduels)
    const edge = Math.max(1, Math.round(n * 0.2));
    const fStart = median(smooth.slice(0, edge));
    const fEnd = median(smooth.slice(n - edge));

    // Creux et sommet : position par le CENTRE de la bande (un palier bas
    // donne son milieu) et position d'ATTEINTE (le moment où la hauteur a
    // fini de descendre).
    const low = robustExtremum(smooth, 'min', o.valleyBand);
    const high = robustExtremum(smooth, 'max', o.valleyBand);
    const fMin = low.value;
    const fMax = high.value;
    const minPos = low.pos;
    const maxPos = high.pos;
    const minReachPos = low.reachPos;

    // Pentes des extrémités (30 % début / 30 % fin) : c'est ce qui distingue
    // un ton 4 (la chute continue jusqu'au bout) d'un « demi-ton 3 »
    // (creux médian puis palier final).
    const band = Math.max(2, Math.round(n * 0.3));
    const startSlope = regressionSlope(smooth, 0, Math.min(n - 1, band - 1));
    const endSlope = regressionSlope(smooth, Math.max(0, n - band), n - 1);

    // Creux locaux : sert à distinguer un V réel d'un contour tremblant
    // (plusieurs creux de profondeur comparable).
    const valleys = localMinima(smooth, o.valleyProminence);
    const deepest = valleys.length ? valleys[0].value : fMin;
    const runnerUp = valleys.length > 1 ? valleys[1].value : null;
    // Écart entre le creux dominant et le deuxième creux : un creux unique
    // et franc donne un écart infini.
    const valleyDominance = runnerUp === null ? Infinity : runnerUp - deepest;

    // Fraction de la chute déjà accomplie au milieu de la syllabe.
    // Un ton 3 est « checked » : la hauteur TOMBE vite et tôt. Un ton 4 est
    // au contraire une glisse progressive : à mi-syllabe, la chute n'est
    // qu'à moitié faite.
    const midLo = Math.floor(n * 0.4);
    const midHi = Math.max(midLo + 1, Math.ceil(n * 0.6));
    const midLevel = median(smooth.slice(midLo, midHi));
    const fall = fStart - fMin;
    const descentFraction = fall > 0.25 ? clamp((fStart - midLevel) / fall, 0, 1) : 0;

    // Même mesure, mais au premier tiers : c'est le signe d'un ton 3
    // (« checked »). Un contour plat qui s'affaisse au milieu, lui, n'a
    // encore rien perdu au premier tiers. La mesure est PROPORTIONNELLE :
    // elle ne dépend pas de l'amplitude de la chute.
    const onsetLevel = smooth[Math.min(n - 1, band - 1)];
    const onsetFallFraction = fall > 0.25 ? clamp((fStart - onsetLevel) / fall, 0, 1) : 0;

    // Vitesse de la chute, en demi-tons par syllabe : c'est la mesure qui
    // sépare le ton 4 (glisse franche : 6 à 12 semi-tons par syllabe) d'un
    // ton 1 mal tenu (dérive lente : 2 à 4).
    const fallRate = fall / Math.max(0.10, low.reachPos);

    // Niveau moyen du dernier quart : un « demi-ton 3 » se TERMINE au
    // niveau de son creux, là où un ton 4 continue de descendre.
    const tailLevel = mean(smooth.slice(Math.max(0, Math.floor(n * 0.75))));

    const hopMs = o.hopMs || 0;
    const durationMs = Math.max(0, (voiced[n - 1].t - voiced[0].t) + hopMs);

    return {
      frames: n,
      level,                                  // F0 médiane en semi-tons (absolu)
      levelHz: Math.pow(2, level / 12),      // F0 médiane en Hz
      fStart,                                 // début (semi-tons relatifs)
      fEnd,                                   // fin (semi-tons relatifs)
      fStartHz: Math.pow(2, (level + fStart) / 12),
      fEndHz: Math.pow(2, (level + fEnd) / 12),
      fMin, fMax,
      minPos, maxPos,                         // centre du creux / du sommet
      minReachPos,                            // moment où le niveau bas est atteint
      slope: fEnd - fStart,                   // tendance globale
      // Étendue du contour BRUT : elle rend compte des oscillations que le
      // lissage amortirait. Les pics isolés, eux, ont déjà été écartés par
      // le filtre médian de la chaîne de traitement.
      range: Math.max.apply(null, rel) - Math.min.apply(null, rel),
      // Creux mesuré sous le point de DÉPART : c'est la seule définition qui
      // reste valable pour le « demi-ton 3 » (creux médian sans remontée,
      // où la fin est au niveau du creux).
      dipDepth: fStart - fMin,
      endRise: fEnd - fMin,                   // remontée finale au-dessus du creux
      startSlope,                            // pente sur le premier tiers
      endSlope,                              // pente sur le dernier tiers
      descentFraction,                       // part de la chute accomplie à mi-syllabe
      onsetFallFraction,                     // part de la chute accomplie au 1er tiers
      fallRate,                              // vitesse de la chute (semi-tons/syllabe)
      valleyDominance,                       // le creux domine-t-il les autres ?
      nValleys: valleys.length,              // nombre de creux locaux significatifs
      tailLevel,                             // niveau moyen du dernier quart
      durationMs,
      rel,                                   // contour relatif (semi-tons), 1 valeur / trame
      times: voiced.map(f => f.t)            // horodatage des trames (ms)
    };
  }

  // =========================================================================
  // 6. CLASSIFICATION DU TON
  // =========================================================================
  /**
   * Classe le contour en ton 1/2/3/4/5 (ou `null` = ambigu).
   *
   * Règles ordonnées (seuils en demi-tons) :
   *   3  creux intérieur franc : la hauteur TOMBE dès l'attaque, atteint un
   *      creux, puis remonte (213) ou reste au fond (211 = « demi-ton 3 »)
   *   4  chute nette dont le point bas est atteint à la fin, sans remontée
   *   2  montée nette, minimum tôt
   *   5  plat **et court** (< neutralDur ms)
   *   1  plat
   *   →  aucune règle ne correspond : ambigu (pas de ton forcé)
   *
   * Le ton 3 est testé EN PREMIER : il se reconnaît à sa structure (un creux)
   * et non à sa tendance globale, ce qui le rend compatible avec une fin de
   * syllabe plus basse que le début (cas très fréquent du « demi-ton 3 »).
   *
   * @param {object} features  Sortie de `extractFeatures`.
   * @param {object} [opts]    Surcharge de DEFAULTS.tone.
   * @returns {{tone:number|null, confidence:number, reason:string, features:object|null}}
   */
  function classifyTone(features, opts) {
    const o = Object.assign({}, DEFAULTS.tone, opts || {});

    if (!features) {
      return { tone: null, confidence: 0, reason: 'no-signal', features: null };
    }

    const f = features;
    const margin = (value, threshold) => clamp((Math.abs(value) - threshold) / threshold, 0, 1);

    // --- TON 3 : creusé --------------------------------------------------
    // Un ton 3 (上声) est un ton « checked » : la hauteur décroît dès
    // l'attaque, atteint un creux, puis remonte (214) ou reste au fond
    // (211, le « demi-ton 3 »). On ne juge donc pas la tendance globale mais
    // la STRUCTURE du contour. Les conditions ci-dessous :
    //   1. le creux est intérieur et atteint tôt : la chute est achevée
    //      avant la fin de la syllabe (un ton 4, lui, descend jusqu'au bout),
    //   2. la hauteur descend dès l'attaque : ce n'est pas un contour plat
    //      qui s'affaisse au milieu,
    //   3. le creux est franc : il domine les autres creux du contour
    //      (sinon c'est un tremblement, pas un ton),
    //   4. le creux a une profondeur réelle (amplitude du ton 3),
    //   5. l'amplitude reste celle d'un ton 3 : un « demi-ton 3 » descend
    //      d'un ou deux degrés (2 à 4 demi-tons), un ton 4 de quatre degrés
    //      (8 à 10 demi-tons). Au-delà, c'est un ton 4.
    const interior = f.minReachPos >= o.valleyMinPos && f.minReachPos <= o.valleyMaxPos;
    const onsetFall = f.onsetFallFraction >= o.onsetFall;
    const cleanValley = f.valleyDominance >= o.dipDominance;
    const deepEnough = f.dipDepth >= o.dipMin;
    const modest = f.dipDepth <= o.fallMax && f.slope >= -o.fallNetMax;

    if (interior && onsetFall && cleanValley && deepEnough && modest) {
      if (f.endRise >= o.dipRise) {
        // creusement complet : creux puis remontée
        return {
          tone: 3,
          confidence: 0.5 + 0.5 * margin(f.dipDepth, o.dipMin),
          reason: 'dipping',
          features: f
        };
      }
      // « demi-ton 3 » (211) : le creux est atteint, la syllabe s'y achève
      // sans remonter franchement. La fin doit rester AU NIVEAU du creux
      // (et non plonger), sinon il s'agit d'un ton 4.
      const flatTail = Math.abs(f.tailLevel - f.fMin) <= o.halfTailFlat;
      const noPlunge = f.endSlope >= o.halfEndFall;
      if (f.dipDepth >= o.halfDipMin && flatTail && noPlunge) {
        return {
          tone: 3,
          confidence: 0.45 + 0.3 * margin(f.dipDepth, o.halfDipMin),
          reason: 'half-dipping',
          features: f
        };
      }
    }

    // --- TON 4 : tombant -------------------------------------------------
    // Chute franche : la hauteur plonge et reste au fond. On exige une
    // chute VITE (le ton 4 est une glisse, pas une dérive lente de ton 1)
    // et une fin qui ne remonte pas.
    if (f.slope <= -o.fallMin && f.fallRate >= o.fallRateMin && f.endRise <= o.endRecovery) {
      return {
        tone: 4,
        confidence: 0.5 + 0.5 * margin(f.slope, o.fallMin),
        reason: 'falling',
        features: f
      };
    }

    // --- TON 2 : montant -------------------------------------------------
    if (f.slope >= o.riseMin && f.minReachPos <= o.riseMaxPos) {
      return {
        tone: 2,
        confidence: 0.5 + 0.5 * margin(f.slope, o.riseMin),
        reason: 'rising',
        features: f
      };
    }

    // --- TON 5 : neutre (plat ET court) ----------------------------------
    // Testé AVANT le ton 1 : c'est la durée qui distingue le ton neutre.
    if (f.durationMs < o.neutralDur && f.range < o.neutralRange && Math.abs(f.slope) < o.flatSlope) {
      return {
        tone: 5,
        confidence: 0.45 + 0.3 * clamp((o.neutralDur - f.durationMs) / o.neutralDur, 0, 1),
        reason: 'neutral',
        features: f
      };
    }

    // --- TON 1 : plat ----------------------------------------------------
    if (Math.abs(f.slope) < o.flatSlope && f.range < o.flatRange) {
      return {
        tone: 1,
        confidence: 0.5 + 0.5 * clamp((o.flatRange - f.range) / o.flatRange, 0, 1),
        reason: 'flat',
        features: f
      };
    }

    // --- AMBIGU ----------------------------------------------------------
    // On ne force plus un ton : un ton 1 tremblant ne doit pas être rapporté
    // « ton 4 » (l'ancien repli `slope > 0 ? 2 : 4` produisait cette erreur).
    return { tone: null, confidence: 0, reason: 'ambiguous', features: f };
  }

  // =========================================================================
  // 7. PIPELINE COMPLET
  // =========================================================================
  /**
   * Analyse une série de trames et renvoie le ton détecté.
   *
   * @param {Array} frames  Trames `{ t, freq, clarity, rms }`.
   * @param {object} [opts] `{ hopMs, expectedTone, ... }`.
   * @returns {{tone:number|null, confidence:number, reason:string, features:object|null, segment:object|null, frames:Array}}
   */
  function analyze(frames, opts) {
    const o = opts || {};
    if (!frames || !frames.length) {
      return { tone: null, confidence: 0, reason: 'no-frames', features: null, segment: null, frames: [] };
    }

    const segment = segmentVoiced(frames, o.segment);
    if (!segment) {
      return { tone: null, confidence: 0, reason: 'no-voice', features: null, segment: null, frames: frames.slice() };
    }

    const sliced = frames.slice(segment.start, segment.end + 1);
    const repaired = repairOctaves(sliced, o.octave);
    const smoothed = smoothMedian(repaired, o.smooth);

    const features = extractFeatures(smoothed, Object.assign({ hopMs: o.hopMs }, o.shape));
    if (!features) {
      return { tone: null, confidence: 0, reason: 'too-short', features: null, segment, frames: smoothed };
    }

    const result = classifyTone(features, o.tone);
    result.segment = segment;
    result.frames = smoothed;
    return result;
  }

  // =========================================================================
  // PRÉRÉGLAGES DE SENSIBILITÉ
  // =========================================================================
  /**
   * Préréglages du classifieur, pour adapter le compromis
   * « on préfère rater un ton 3 » ↔ « on préfère risquer un faux ton 3 ».
   *
   * Un logiciel d'apprentissage tolère qu'un ton ambigu soit signalé
   * « incertain » ; en revanche, annoncer « ton 3 » à quelqu'un qui vient
   * de produire un ton 1 est pénalisant. On part donc d'un réglage
   * intermédiaire, et l'on laisse le choix à l'appelant.
   *
   *   strict    : on n'annonce un ton 3 que si le creux est net.
   *               Risque : un ton 3 doux ou bref est rapporté « plat ».
   *   default   : compromis (valeurs de `DEFAULTS.tone`).
   *   tolerant  : on accepte des creux peu marqués.
   *               Risque : un ton 1 mal tenu peut être pris pour un ton 3.
   *
   * Utilisation :
   *   ToneDSP.analyze(frames, { tone: ToneDSP.TONE_PRESETS.tolerant })
   */
  const TONE_PRESETS = {
    strict: {
      dipMin: 1.8,
      halfDipMin: 2.2,
      dipDominance: 1.2,
      onsetFall: 0.40,
      valleyMaxPos: 0.55,
      fallMax: 3.0,
      endRecovery: 0.6
    },
    default: {},
    tolerant: {
      dipMin: 0.9,
      halfDipMin: 1.2,
      dipDominance: 0.4,
      onsetFall: 0.20,
      valleyMaxPos: 0.70,
      fallMax: 4.5,
      endRecovery: 1.0
    }
  };

  /**
   * Construit un jeu d'options de classification en combinant un
   * préréglage et des surcharges ponctuelles.
   *
   * @param {string} [preset]  'strict' | 'default' | 'tolerant'
   * @param {object} [over]    surcharges `{ ...préréglage, ...over }`
   * @returns {object} options prêtes pour `analyze(frames, { tone })`.
   */
  function toneOptions(preset, over) {
    const base = Object.assign({}, DEFAULTS.tone, TONE_PRESETS[preset] || TONE_PRESETS.default);
    return Object.assign(base, over || {});
  }

  // =========================================================================
  // EXPORTS
  // =========================================================================
  return {
    DEFAULTS,
    TONE_PRESETS,
    toneOptions,
    median,
    mean,
    clamp,
    toSemitones,
    smoothSeries,
    robustExtremum,
    localMinima,
    yin,
    repairOctaves,
    smoothMedian,
    segmentVoiced,
    extractFeatures,
    classifyTone,
    analyze
  };
});
