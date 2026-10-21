/**
 * tests/synth.mjs — Générateur de signaux vocaux synthétiques
 * -------------------------------------------------------------
 * Produit des « syllabes » mandarinES réalistes (source glottale additive
 * avec formants, enveloppe d'attaque/release, bruit de fond) afin de
 * valider la chaîne complète : capture → YIN → VAD → classification.
 *
 * Aucune dépendance : uniquement les modules natifs de Node.
 */

import { readFileSync } from 'node:fs';
import ToneDSP from '../tone-dsp.js';

export { ToneDSP };

// ---------------------------------------------------------------------------
// Aléatoire déterministe
// ---------------------------------------------------------------------------

/** PRNG mulberry32 — rapide, reproductible d'une exécution à l'autre. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Contours de tons
// ---------------------------------------------------------------------------
// Chaque contour est une liste de points [t, offset en demi-tons] interpolée
// linéairement. t ∈ [0, 1] sur la durée de la syllabe.

export const CONTOURS = {
  // ton 1 — plat, à la hauteur de référence
  1: [[0, 0], [0.3, 0.15], [0.6, -0.1], [1, 0.05]],

  // ton 2 — montant
  2: [[0, 0], [0.2, 0.3], [0.5, 1.8], [0.8, 3.2], [1, 4.0]],

  // ton 3 — creusé (creux puis remontée)
  3: [[0, 1.5], [0.2, 0.2], [0.5, -2.0], [0.75, -1.0], [1, 0]],

  // « demi-ton 3 » — creux médian sans remontée finale (très fréquent)
  '3-half': [[0, 1.5], [0.2, 0.2], [0.5, -2.0], [0.75, -1.9], [1, -1.7]],

  // ton 4 — tombant, onset haut
  4: [[0, 3.5], [0.15, 3.2], [0.4, 1.0], [0.7, -1.5], [1, -3.0]],

  // ton 5 — neutre, plat et court
  5: [[0, 0], [0.5, 0.1], [1, 0]]
};

/** Interpolation linéaire d'un contour. */
export function contourValue(points, t) {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [t0, v0] = points[i - 1];
    const [t1, v1] = points[i];
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0 || 1);
      return v0 + (v1 - v0) * k;
    }
  }
  return points[points.length - 1][1];
}

// ---------------------------------------------------------------------------
// Synthèse vocale
// ---------------------------------------------------------------------------

/** Formants approximatifs d'une voyelle chinoise (/a/). */
const FORMANTS = [
  { f: 800, bw: 90, gain: 1.0 },
  { f: 1200, bw: 110, gain: 0.55 },
  { f: 2600, bw: 160, gain: 0.28 }
];

/**
 * Synthétise une syllabe voisée.
 *
 * @param {object} opts
 * @param {Array}  opts.contour     Points [t, demi-tons] du contour de F0.
 * @param {number} opts.f0           Fréquence de base (Hz) au départ.
 * @param {number} opts.sampleRate
 * @param {number} opts.durationMs
 * @param {number} opts.level        RMS cible de la syllabe.
 * @param {number} opts.jitterSemis  Gigue de suivi (± demi-tons).
 * @param {number} opts.seed
 * @returns {Float32Array}
 */
export function synthVoice(opts) {
  const {
    contour,
    f0 = 150,
    sampleRate = 48000,
    durationMs = 400,
    level = 0.08,
    jitterSemis = 0.12,
    seed = 1,
    harmonics = 16
  } = opts;

  const rng = mulberry32(seed);
  const n = Math.max(1, Math.round(sampleRate * durationMs / 1000));
  const out = new Float32Array(n);

  const K = Math.max(2, Math.min(harmonics, Math.floor(0.45 * sampleRate / f0)));

  // Amplitudes harmoniques : source glottale (≈ 1/k^1.2) + formants
  const amps = new Float64Array(K + 1);
  for (let k = 1; k <= K; k++) {
    let a = Math.pow(k, -1.2);
    for (const fm of FORMANTS) {
      const d = (k * f0 - fm.f) / fm.bw;
      a *= 1 + fm.gain * Math.exp(-d * d);
    }
    amps[k] = a;
  }

  const phases = new Float64Array(K + 1);
  for (let k = 1; k <= K; k++) phases[k] = rng() * Math.PI * 2;

  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const st = contourValue(contour, t) + (rng() - 0.5) * 2 * jitterSemis;
    const inst = f0 * Math.pow(2, st / 12);
    phase += (2 * Math.PI * inst) / sampleRate;
    if (phase > 1e6) phase -= 1e6;

    let s = 0;
    for (let k = 1; k <= K; k++) s += amps[k] * Math.sin(k * phase + phases[k]);
    out[i] = s;
  }

  // Enveloppe : attaque et release en cosinus surélevé
  const attack = Math.max(1, Math.round(sampleRate * 0.025));
  const release = Math.max(1, Math.round(sampleRate * 0.045));
  for (let i = 0; i < n; i++) {
    let env = 1;
    if (i < attack) env = 0.5 - 0.5 * Math.cos((Math.PI * i) / attack);
    const fromEnd = n - 1 - i;
    if (fromEnd < release) env = Math.min(env, 0.5 - 0.5 * Math.cos((Math.PI * fromEnd) / release));
    out[i] *= env;
  }

  // Normalisation au RMS cible
  let energy = 0;
  for (let i = 0; i < n; i++) energy += out[i] * out[i];
  const rms = Math.sqrt(energy / n) || 1;
  const gain = level / rms;
  for (let i = 0; i < n; i++) out[i] *= gain;

  return out;
}

// ---------------------------------------------------------------------------
// Analyse
// ---------------------------------------------------------------------------

/** RMS d'un buffer. */
export function rmsOf(buf) {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

/**
 * Reproduit la boucle de capture de l'application : des fenêtres glissantes
 * analysées par YIN, une trame par pas de temps.
 *
 * @returns {Array} trames `{ t, freq, clarity, rms }`
 */
export function analyzeSignal(samples, opts = {}) {
  const {
    sampleRate = 48000,
    windowSize = 1024,
    hopMs = 16,
    minFreq = 60,
    maxFreq = 800
  } = opts;

  const hop = Math.max(1, Math.round(sampleRate * hopMs / 1000));
  const frames = [];

  for (let start = 0; start + windowSize <= samples.length; start += hop) {
    const slice = samples.subarray(start, start + windowSize);
    const res = ToneDSP.yin(slice, sampleRate, { minFreq, maxFreq });
    frames.push({
      t: (start / sampleRate) * 1000,
      freq: res ? res.frequency : null,
      clarity: res ? res.clarity : 0,
      rms: rmsOf(slice)
    });
  }

  return frames;
}

/**
 * Simule une erreur d'octave du détecteur (YIN renvoie 2× la F0 réelle)
 * sur une portion des trames.
 */
export function injectOctaveError(frames, opts = {}) {
  const { fromRatio = 0.3, toRatio = 0.7, ratio = 2 } = opts;
  const n = frames.length;
  const from = Math.floor(n * fromRatio);
  const to = Math.floor(n * toRatio);
  for (let i = from; i < to && i < n; i++) {
    if (frames[i].freq) frames[i].freq *= ratio;
  }
  return frames;
}

// ---------------------------------------------------------------------------
// Cas de test complet
// ---------------------------------------------------------------------------

/**
 * Construit un cas complet : signal audio + trames analysées.
 *
 * @param {object} opts
 * @param {number|string} opts.tone    Ton attendu (1..5, ou '3-half').
 * @returns {{frames:Array, expected:number|null, signal:Float32Array, meta:object}}
 */
export function makeCase(opts = {}) {
  const {
    tone = 1,
    variant = null,
    f0 = 150,
    durationMs = 400,
    sampleRate = 48000,
    windowSize = 1024,
    hopMs = 16,
    level = 0.08,
    noiseRms = 0.0015,
    seed = 1,
    padBeforeMs = 200,
    padAfterMs = 200,
    jitterSemis = 0.12,
    octaveError = null,
    minFreq = 60,
    maxFreq = 800
  } = opts;

  const key = variant || tone;
  const contour = CONTOURS[key];
  if (!contour) throw new Error(`Contour inconnu : ${key}`);

  const voiced = synthVoice({ contour, f0, sampleRate, durationMs, level, jitterSemis, seed });

  const padBefore = Math.round((sampleRate * padBeforeMs) / 1000);
  const padAfter = Math.round((sampleRate * padAfterMs) / 1000);
  const total = padBefore + voiced.length + padAfter;
  const signal = new Float32Array(total);

  // Bruit de fond sur toute la durée (silence + syllabe)
  const rng = mulberry32(seed + 7919);
  for (let i = 0; i < total; i++) signal[i] = (rng() - 0.5) * 2 * noiseRms * 1.8;
  signal.set(voiced, padBefore);

  const frames = analyzeSignal(signal, { sampleRate, windowSize, hopMs, minFreq, maxFreq });
  if (octaveError) injectOctaveError(frames, octaveError);

  const expected = typeof tone === 'number' ? tone : 3;

  return {
    frames,
    expected,
    signal,
    meta: { tone: key, f0, durationMs, sampleRate, windowSize, hopMs, level, noiseRms, seed, octaveError }
  };
}

// ---------------------------------------------------------------------------
// Lecture de vrais enregistrements (validation terrain)
// ---------------------------------------------------------------------------

/**
 * Lit un fichier WAV PCM 16 bits (mono ou stéréo → mono).
 * @param {string} path
 * @returns {{samples:Float32Array, sampleRate:number}}
 */
export function loadWav(path) {
  const buf = readFileSync(path);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`Fichier WAV invalide : ${path}`);
  }

  let pos = 12;
  let sampleRate = 44100;
  let channels = 1;
  let bits = 16;
  let data = null;

  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;

    if (id === 'fmt ') {
      channels = buf.readUInt16LE(body + 2);
      sampleRate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
    } else if (id === 'data') {
      data = buf.subarray(body, Math.min(body + size, buf.length));
    }
    pos = body + size + (size % 2);
  }

  if (!data) throw new Error(`Aucune tranche de données dans ${path}`);
  if (bits !== 16) throw new Error(`Seul le PCM 16 bits est géré (reçu : ${bits})`);

  const count = Math.floor(data.length / 2 / channels);
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let acc = 0;
    for (let c = 0; c < channels; c++) acc += data.readInt16LE((i * channels + c) * 2) / 32768;
    samples[i] = acc / channels;
  }

  return { samples, sampleRate };
}
