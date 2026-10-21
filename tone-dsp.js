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
    tone: {
      fallMin: 2.0,      // semi-tons : chute minimale pour un ton 4
      riseMin: 2.0,      // semi-tons : montée minimale pour un ton 2
      dipMin: 1.0,       // semi-tons : creux minimal sous les deux extrémités (ton 3)
      dipRise: 0.5,      // semi-tons : remontée finale exigée (ton 3 « complet »)
      halfDipMin: 1.0,   // semi-tons : creux du « demi-ton 3 » (sans remontée)
      endFallMax: 0.8,   // semi-tons : la fin doit encore descendre (sépare ton 4 / demi-ton 3)
      endFlatMax: 0.8,   // semi-tons : la fin doit être stable (détecte le « demi-ton 3 »)
      flatSlope: 1.0,    // semi-tons : |pente| max pour un ton plat
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
    const o = opts || {};
    const voiced = frames.filter(f => f && f.freq);
    if (voiced.length < 3) return null;

    const n = voiced.length;
    const abs = voiced.map(f => 12 * Math.log2(f.freq));
    const level = median(abs);              // F0 médiane de la syllabe (semi-tons)
    const rel = abs.map(v => v - level);     // relatives à la médiane

    // Extrémités : médiane des 20 % extrêmes (robuste aux pics résiduels)
    const edge = Math.max(1, Math.round(n * 0.2));
    const fStart = median(rel.slice(0, edge));
    const fEnd = median(rel.slice(n - edge));

    let fMin = Infinity, fMax = -Infinity, minIdx = 0, maxIdx = 0;
    for (let i = 0; i < n; i++) {
      if (rel[i] < fMin) { fMin = rel[i]; minIdx = i; }
      if (rel[i] > fMax) { fMax = rel[i]; maxIdx = i; }
    }

    const denom = n > 1 ? (n - 1) : 1;
    const minPos = minIdx / denom;
    const maxPos = maxIdx / denom;

    // Pentes des extrémités (30 % début / 30 % fin) : c'est ce qui distingue
    // un ton 4 (la chute continue jusqu'au bout) d'un « demi-ton 3 »
    // (creux médian puis palier final).
    const band = Math.max(2, Math.round(n * 0.3));
    const startSlope = regressionSlope(rel, 0, Math.min(n - 1, band - 1));
    const endSlope = regressionSlope(rel, Math.max(0, n - band), n - 1);

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
      minPos, maxPos,
      slope: fEnd - fStart,                   // tendance globale
      range: fMax - fMin,                     // étendue totale
      // Creux mesuré sous le point de DÉPART : c'est la seule définition qui
      // reste valable pour le « demi-ton 3 » (creux médian sans remontée,
      // où la fin est au niveau du creux).
      dipDepth: fStart - fMin,
      endRise: fEnd - fMin,                   // remontée finale au-dessus du creux
      startSlope,                            // pente sur le premier tiers
      endSlope,                              // pente sur le dernier tiers
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
   *   4  chute nette, maximum tôt, minimum tard
   *   2  montée nette, minimum tôt
   *   3  creux médian (avec ou sans remontée finale : « demi-ton 3 »)
   *   1  plat
   *   5  plat **et court** (< neutralDur ms)
   *   →  aucune règle ne correspond : ambigu (pas de ton forcé)
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

    // --- TON 4 : tombant -------------------------------------------------
    // Deux formulations : minimum très tard (chute franche) ou chute qui se
    // poursuit jusqu'au bout (endSlope négatif). La seconde condition est ce
    // qui empêche un « demi-ton 3 » d'être classé ton 4.
    if (f.slope <= -o.fallMin) {
      const lateMin = f.maxPos <= 0.40 && f.minPos >= 0.75;
      const stillFalling = f.maxPos <= 0.35 && f.minPos >= 0.40 && f.endSlope <= -o.endFallMax;
      if (lateMin || stillFalling) {
        return {
          tone: 4,
          confidence: 0.5 + 0.5 * margin(f.slope, o.fallMin),
          reason: 'falling',
          features: f
        };
      }
    }

    // --- TON 2 : montant -------------------------------------------------
    if (f.slope >= o.riseMin && f.minPos <= 0.40) {
      return {
        tone: 2,
        confidence: 0.5 + 0.5 * margin(f.slope, o.riseMin),
        reason: 'rising',
        features: f
      };
    }

    // --- TON 3 : creusé --------------------------------------------------
    if (f.minPos >= 0.20 && f.minPos <= 0.80 && f.dipDepth >= o.dipMin) {
      if (f.endRise >= o.dipRise) {
        // creusement complet : creux puis remontée
        return {
          tone: 3,
          confidence: 0.5 + 0.5 * margin(f.dipDepth, o.dipMin),
          reason: 'dipping',
          features: f
        };
      }
      // « demi-ton 3 » : creux médian, fin stable, pas de remontée
      if (f.dipDepth >= o.halfDipMin && Math.abs(f.endSlope) <= o.endFlatMax) {
        return {
          tone: 3,
          confidence: 0.45 + 0.3 * margin(f.dipDepth, o.halfDipMin),
          reason: 'half-dipping',
          features: f
        };
      }
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

    const features = extractFeatures(smoothed, o);
    if (!features) {
      return { tone: null, confidence: 0, reason: 'too-short', features: null, segment, frames: smoothed };
    }

    const result = classifyTone(features, o.tone);
    result.segment = segment;
    result.frames = smoothed;
    return result;
  }

  // =========================================================================
  // EXPORTS
  // =========================================================================
  return {
    DEFAULTS,
    median,
    clamp,
    toSemitones,
    yin,
    repairOctaves,
    smoothMedian,
    segmentVoiced,
    extractFeatures,
    classifyTone,
    analyze
  };
});
