/**
 * tests/tone-3.test.mjs — Tests spécialisés sur la détection du ton 3 (creusé)
 * ---------------------------------------------------------------------------
 * Le ton 3 (上声) est le plus difficile à reconnaître : sa forme dépend de la
 * manière de parler (citation, mot, parole rapide), il se confond avec le
 * ton 4 (« demi-ton 3 ») et avec le ton 1 mal tenu.
 *
 * Ces tests s'appuient sur un corpus de contours RÉALISTES
 * (`tests/fixtures/real-contours.mjs`) : formes de tons du mandarin
 * telles qu'on les observe sur un enregistrement, avec leurs accidents
 * (plateau bas, remontée finale, tête d'attaque, etc.).
 *
 * Lancement :  node --test tests/tone-3.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import ToneDSP from '../tone-dsp.js';
import {
  REAL,
  REAL_KEYS,
  TONE3_KEYS,
  NOT_TONE3_KEYS,
  contourFrames,
  toPoints
} from './fixtures/real-contours.mjs';
import { synthVoice, analyzeSignal, mulberry32 } from './synth.mjs';

const SR = 48000;
const HOP = 16;

// ===========================================================================
// OUTILS
// ===========================================================================

/** Classifie un contour idéal (trames parfaites, sans bruit). */
function classifyContour(values, opts = {}) {
  const frames = contourFrames(values, opts);
  const res = ToneDSP.analyze(frames, { hopMs: HOP });
  return res;
}

/** Synthétise un contour réaliste et renvoie le résultat de l'analyse. */
function analyzeSynth(values, opts = {}) {
  const {
    f0 = 150,
    durationMs = 480,
    level = 0.08,
    noiseRms = 0.0015,
    jitterSemis = 0.15,
    seed = 1,
    sampleRate = SR,
    windowSize = 2048,
    octaveError = null
  } = opts;

  const voiced = synthVoice({
    contour: toPoints(values),
    f0, sampleRate, durationMs, level, jitterSemis, seed
  });

  const pad = Math.round(sampleRate * 0.15);
  const signal = new Float32Array(pad + voiced.length + pad);
  const rng = mulberry32(seed + 7919);
  for (let i = 0; i < signal.length; i++) signal[i] = (rng() - 0.5) * 2 * noiseRms * 1.8;
  signal.set(voiced, pad);

  const frames = analyzeSignal(signal, { sampleRate, windowSize, hopMs: HOP });
  if (octaveError) {
    const from = Math.floor(frames.length * octaveError.fromRatio);
    const to = Math.floor(frames.length * octaveError.toRatio);
    for (let i = from; i < to && i < frames.length; i++) {
      if (frames[i].freq) frames[i].freq *= octaveError.ratio;
    }
  }
  return ToneDSP.analyze(frames, { hopMs: HOP });
}

/** Nom lisible d'un résultat. */
function label(res) {
  return `ton ${res.tone} (${res.reason})`;
}

// ===========================================================================
// 1. CORPUS RÉALISTE — LE CLASSEUR SEUL (trames parfaites)
// ===========================================================================

test('corpus : chaque contour a une fiche et un ton attendu', () => {
  assert.ok(REAL_KEYS.length >= 15, 'corpus trop pauvre');
  assert.ok(TONE3_KEYS.length >= 7, 'il faut plusieurs variantes de ton 3');
  for (const key of REAL_KEYS) {
    const c = REAL[key];
    assert.ok(c.values.length >= 8, `${key} : contour trop court`);
    assert.ok(c.label && c.chao, `${key} : métadonnées manquantes`);
    assert.ok([1, 2, 3, 4, 5].includes(c.tone), `${key} : ton attendu invalide`);
  }
});

test('corpus : tous les tons 3 réalistes sont reconnus comme ton 3', () => {
  for (const key of TONE3_KEYS) {
    const res = classifyContour(REAL[key].values);
    assert.equal(res.tone, 3, `${key} (${REAL[key].chao}) : ${label(res)}`);
    assert.ok(
      res.reason === 'dipping' || res.reason === 'half-dipping',
      `${key} : raison inattendue ${res.reason}`
    );
    assert.ok(res.confidence >= 0.45, `${key} : confiance trop faible ${res.confidence}`);
  }
});

test('corpus : aucun ton 1/2/4/5 réaliste n’est pris pour un ton 3', () => {
  for (const key of NOT_TONE3_KEYS) {
    const res = classifyContour(REAL[key].values);
    assert.notEqual(res.tone, 3, `${key} (${REAL[key].chao}) : ${label(res)}`);
  }
});

test('corpus : chaque contour est rapporté avec son ton attendu', () => {
  for (const key of REAL_KEYS) {
    const c = REAL[key];
    const res = classifyContour(c.values, { n: c.tone === 5 ? 14 : 40 });
    assert.equal(res.tone, c.tone, `${key} (${c.chao}) : ${label(res)}`);
  }
});

// ===========================================================================
// 2. CORPUS RÉALISTE — BOUCLE COMPLÈTE (signal synthétisé)
// ===========================================================================

test('bout en bout : tous les tons 3 réalistes sont détectés sur le signal', () => {
  for (const key of TONE3_KEYS) {
    const res = analyzeSynth(REAL[key].values, { seed: 3 });
    assert.equal(res.tone, 3, `${key} (${REAL[key].chao}) : ${label(res)}`);
  }
});

test('bout en bout : aucun ton 1/2/4/5 réaliste n’est pris pour un ton 3', () => {
  for (const key of NOT_TONE3_KEYS) {
    if (REAL[key].tone === 5) continue; // le ton 5 est bref : traité plus bas
    const res = analyzeSynth(REAL[key].values, { seed: 3 });
    assert.notEqual(res.tone, 3, `${key} (${REAL[key].chao}) : ${label(res)}`);
  }
});

test('bout en bout : le ton 3 est détecté quel que soit le registre', () => {
  for (const f0 of [95, 140, 210]) {
    for (const key of TONE3_KEYS) {
      const res = analyzeSynth(REAL[key].values, { f0, seed: 5 });
      assert.equal(res.tone, 3, `${key} @ ${f0} Hz : ${label(res)}`);
    }
  }
});

test('bout en bout : le ton 3 est détecté quelle que soit la durée', () => {
  for (const durationMs of [260, 380, 620]) {
    for (const key of TONE3_KEYS) {
      const res = analyzeSynth(REAL[key].values, { durationMs, seed: 5 });
      assert.equal(res.tone, 3, `${key} @ ${durationMs} ms : ${label(res)}`);
    }
  }
});

test('bout en bout : le ton 3 survit au bruit de fond', () => {
  for (const noiseRms of [0.0008, 0.004]) {
    for (const key of TONE3_KEYS) {
      const res = analyzeSynth(REAL[key].values, { noiseRms, seed: 5 });
      assert.equal(res.tone, 3, `${key} @ bruit ${noiseRms} : ${label(res)}`);
    }
  }
});

test('bout en bout : le ton 3 survit à une erreur d’octave du détecteur', () => {
  for (const key of TONE3_KEYS) {
    const res = analyzeSynth(REAL[key].values, {
      seed: 5,
      octaveError: { fromRatio: 0.3, toRatio: 0.7, ratio: 2 }
    });
    assert.equal(res.tone, 3, `${key} + octave : ${label(res)}`);
  }
});

test('bout en bout : le ton 3 est détecté avec la fenêtre courte du navigateur', () => {
  // Profil retenu par l'application : 16 kHz, fftSize 512 (32 ms).
  for (const key of TONE3_KEYS) {
    const res = analyzeSynth(REAL[key].values, {
      sampleRate: 16000, windowSize: 512, seed: 5
    });
    assert.equal(res.tone, 3, `${key} @ 16 kHz/512 : ${label(res)}`);
  }
});

// ===========================================================================
// 3. RÉGRESSIONS — LES CAS QUI ÉCHOUAIENT AVANT
// ===========================================================================

test('régression : un ton 3 au creux tardif n’est PAS rapporté « ton 4 »', () => {
  // Le creux est atteint vers 70 % de la syllabe, la fin remonte un peu.
  // L'ancienne règle « minimum très tard = ton 4 » le classait ton 4.
  const values = [
    2.0, 1.5, 0.9, 0.2, -0.6, -1.3, -1.9, -2.2, -2.3, -2.4, -2.1, -1.9,
    -1.7, -1.5, -1.3, -1.1, -0.9, -0.7, -0.5, -0.3, -0.1, 0.1, 0.3, 0.5
  ];
  const res = classifyContour(values);
  assert.equal(res.tone, 3, label(res));
});

test('régression : un « demi-ton 3 » qui dérive lentement reste un ton 3', () => {
  // Chute franche au début (c'est le ton « checked »), puis le niveau bas
  // se maintient en dérivant un peu. L'ancien test exigeait une fin
  // parfaitement stable et le classifiait « ambigu ».
  const values = [
    1.5, 1.1, 0.6, 0.0, -0.6, -1.1, -1.5, -1.7, -1.8, -1.8, -1.8, -1.9,
    -2.0, -2.1, -2.2, -2.3, -2.3, -2.4, -2.4, -2.5, -2.5, -2.6, -2.6, -2.7
  ];
  const res = classifyContour(values);
  assert.equal(res.tone, 3, label(res));
});

test('régression : un ton 1 avec un creux médian n’est PAS rapporté « ton 3 »', () => {
  // Le creux est peu profond et la fin ne remonte pas : c'est un ton 1.
  const values = [
    1.2, 1.0, 0.7, 0.4, 0.1, -0.2, -0.4, -0.5, -0.5, -0.4, -0.3, -0.2,
    -0.1, 0.0, 0.1, 0.1, 0.0, -0.1, -0.2, -0.3, -0.3, -0.4, -0.4, -0.5
  ];
  const res = classifyContour(values);
  assert.notEqual(res.tone, 3, `un ton 1 a été rapporté ${label(res)}`);
});

test('régression : un ton 1 tremblant n’est PAS rapporté « ton 3 »', () => {
  const values = [
    0.0, 1.4, 0.2, 1.2, 0.1, 0.4, 0.9, 0.3, 1.1, 0.2, 0.5, 1.0,
    0.3, 0.8, 0.2, 0.6, 0.9, 0.3, 0.5, 0.2, 0.4, 0.1, 0.3, 0.2
  ];
  const res = classifyContour(values);
  assert.notEqual(res.tone, 3, `un ton tremblant a été rapporté ${label(res)}`);
});

test('régression : un ton 4 à palier final n’est PAS rapporté « ton 3 »', () => {
  // La chute s'arrête net sur le dernier tiers : c'est un ton 4.
  const values = [
    4.2, 3.9, 3.4, 2.8, 2.1, 1.3, 0.5, -0.3, -1.0, -1.6, -2.1, -2.5,
    -2.8, -3.0, -3.1, -3.1, -3.1, -3.1, -3.0, -3.0, -2.9, -2.9, -2.8, -2.8
  ];
  const res = classifyContour(values);
  assert.equal(res.tone, 4, label(res));
});

test('régression : un ton 4 à chute rapide n’est PAS rapporté « ton 3 »', () => {
  const values = [
    4.2, 3.4, 2.4, 1.3, 0.2, -0.8, -1.7, -2.4, -2.9, -3.2, -3.4, -3.5,
    -3.5, -3.5, -3.4, -3.3, -3.2, -3.1, -3.0, -2.9, -2.8, -2.7, -2.6, -2.5
  ];
  const res = classifyContour(values);
  assert.equal(res.tone, 4, label(res));
});

test('régression : un ton 2 qui commence par un creux reste un ton 2', () => {
  const values = [
    -0.6, -0.9, -1.1, -1.2, -1.1, -0.9, -0.6, -0.2, 0.2, 0.6, 1.0, 1.4,
    1.7, 2.0, 2.2, 2.4, 2.5, 2.5, 2.5, 2.4, 2.3, 2.2, 2.1, 2.0
  ];
  const res = classifyContour(values);
  assert.equal(res.tone, 2, label(res));
});

// ===========================================================================
// 4. EXTRACTION DES CARACTÉRISTIQUES
// ===========================================================================

test('extractFeatures : le creux est situé au milieu de la syllabe', () => {
  const features = ToneDSP.extractFeatures(contourFrames(REAL['3-214-canonical'].values), { hopMs: HOP });
  assert.ok(features);
  assert.ok(features.minReachPos > 0.15 && features.minReachPos < 0.5,
    `position du creux : ${features.minReachPos}`);
  assert.ok(features.dipDepth > 2, `profondeur du creux : ${features.dipDepth}`);
  assert.ok(features.endRise > 1, `remontée finale : ${features.endRise}`);
});

test('extractFeatures : le creux domine les autres creux du contour', () => {
  // Un « demi-ton 3 » a un fond plat : le creux y est large mais unique.
  const features = ToneDSP.extractFeatures(contourFrames(REAL['3-211-half'].values), { hopMs: HOP });
  assert.ok(features.nValleys <= 1, `creux locaux : ${features.nValleys}`);
  assert.ok(features.valleyDominance === Infinity || features.valleyDominance > 0.8);
});

test('extractFeatures : un contour tremblant a plusieurs creux locaux', () => {
  const frames = contourFrames([
    0.0, 1.6, 0.1, 1.5, 0.0, 1.4, 0.1, 1.5, 0.0, 1.4, 0.1, 1.5,
    0.0, 1.4, 0.1, 1.5, 0.0, 1.4, 0.1, 1.5, 0.0, 1.4, 0.1, 1.5
  ], { n: 24 });
  const features = ToneDSP.extractFeatures(frames, { hopMs: HOP });
  assert.ok(features.nValleys >= 2, `creux locaux : ${features.nValleys}`);
  assert.ok(features.valleyDominance < 0.8,
    `le tremblement n’est pas détecté (dominance ${features.valleyDominance})`);
});

test('extractFeatures : la fenêtre de lissage écarte les pics isolés', () => {
  const values = REAL['3-214-canonical'].values.slice();
  const frames = contourFrames(values);
  // Un pic parasite sur une seule trame.
  frames[10].freq *= 4;
  const features = ToneDSP.extractFeatures(frames, { hopMs: HOP });
  assert.ok(Math.abs(features.dipDepth - 2.6) < 0.6,
    `la profondeur du creux a été perturbée : ${features.dipDepth}`);
});

// ===========================================================================
// 5. PARAMÉTRAGE — LA SENSIBILITÉ EST AJUSTABLE
// ===========================================================================

test('paramétrage : les seuils du classifieur sont surchargeables', () => {
  // Un contour à creux à peine marqué : refusé par défaut…
  const soft = REAL['3-shallow'].values;
  const strict = ToneDSP.analyze(contourFrames(soft), {
    hopMs: HOP, tone: ToneDSP.toneOptions('strict')
  });
  const tolerant = ToneDSP.analyze(contourFrames(soft), {
    hopMs: HOP, tone: ToneDSP.toneOptions('tolerant')
  });
  assert.equal(tolerant.tone, 3, `préréglage tolérant : ${label(tolerant)}`);
  assert.notEqual(strict.tone, 3, `préréglage strict : ${label(strict)}`);
});

test('paramétrage : une surcharge ponctuelle est prise en compte', () => {
  const values = REAL['1-55-mid-dip'].values;
  const defaut = ToneDSP.analyze(contourFrames(values), { hopMs: HOP });
  const permissif = ToneDSP.analyze(contourFrames(values), {
    hopMs: HOP, tone: ToneDSP.toneOptions('default', { dipMin: 0.5, halfDipMin: 0.5 })
  });
  assert.notEqual(defaut.tone, 3, `par défaut : ${label(defaut)}`);
  assert.equal(permissif.tone, 3, `avec dipMin = 0,5 : ${label(permissif)}`);
});

test('paramétrage : les trois préréglages sont exposés et complets', () => {
  for (const name of ['strict', 'default', 'tolerant']) {
    assert.ok(ToneDSP.TONE_PRESETS[name], `préréglage ${name} manquant`);
    const opts = ToneDSP.toneOptions(name);
    for (const key of Object.keys(ToneDSP.DEFAULTS.tone)) {
      assert.equal(typeof opts[key], 'number', `${name}.${key} manquant`);
    }
  }
});

test('paramétrage : le préréglage par défaut est bien celui de DEFAULTS', () => {
  const opts = ToneDSP.toneOptions('default');
  for (const [key, value] of Object.entries(ToneDSP.DEFAULTS.tone)) {
    assert.equal(opts[key], value, `${key} : ${opts[key]} ≠ ${value}`);
  }
});

// ===========================================================================
// 6. CAS LIMITES — CE QUI RESTE AMBIGU DOIT RESTER AMBIGU
// ===========================================================================

test('limites : une forme erratique n’est jamais forcée vers un ton', () => {
  const res = classifyContour([
    0, 3.5, 0.5, 4, 1, 3.5, 0.2, 2.8
  ], { n: 24 });
  assert.equal(res.tone, null, `une forme erratique a été forcée vers ${label(res)}`);
  assert.equal(res.reason, 'ambiguous');
});

test('limites : le ton 3 le plus faible reste détecté (valeur par défaut)', () => {
  // Le corpus contient un ton 3 à creux de ~1,5 demi-ton : c'est la limite
  // basse de ce qui est raisonnablement détectable.
  const res = classifyContour(REAL['3-shallow'].values);
  assert.equal(res.tone, 3, label(res));
});
