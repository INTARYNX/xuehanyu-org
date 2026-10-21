/**
 * tests/tone-dsp.test.mjs — Tests unitaires du moteur de détection de ton
 * --------------------------------------------------------------------------
 * Lancement :  node --test tests/
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ToneDSP,
  makeCase,
  synthVoice,
  contourValue,
  CONTOURS,
  mulberry32
} from './synth.mjs';

const SR = 48000;

/** Écart en cents entre deux fréquences. */
function cents(f, ref) {
  return 1200 * Math.log2(f / ref);
}

/** Sinus pur. */
function sine(freq, n, sampleRate = SR, phase = 0) {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) buf[i] = 0.5 * Math.sin((2 * Math.PI * freq * i) / sampleRate + phase);
  return buf;
}

/** Bruit blanc de niveau RMS donné. */
function whiteNoise(n, rms, seed = 42) {
  const rng = mulberry32(seed);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) buf[i] = (rng() - 0.5) * 2 * rms * 1.73;
  return buf;
}

/** Construit des trames à partir d'un contour en demi-tons. */
function contourFrames(points, { n = 24, hopMs = 16, level = 150, clarity = 0.92 } = {}) {
  const frames = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const st = contourValue(points, t);
    frames.push({
      t: i * hopMs,
      freq: level * Math.pow(2, st / 12),
      clarity,
      rms: 0.06
    });
  }
  return frames;
}

/** Classifie un contour synthétique. */
function classifyContour(points, opts = {}) {
  const frames = contourFrames(points, opts);
  const features = ToneDSP.extractFeatures(frames, { hopMs: opts.hopMs || 16 });
  return ToneDSP.classifyTone(features);
}

// ===========================================================================
// 1. YIN
// ===========================================================================

test('YIN : sinus pur à 200 Hz détecté à moins d’un cent', () => {
  const res = ToneDSP.yin(sine(200, 2048), SR);
  assert.ok(res, 'aucun résultat');
  assert.ok(Math.abs(cents(res.frequency, 200)) < 1, `écart : ${cents(res.frequency, 200).toFixed(3)} cents`);
  assert.ok(res.clarity > 0.9, `clarity trop faible : ${res.clarity}`);
});

test('YIN : voix grave (95 Hz) détectée', () => {
  const res = ToneDSP.yin(sine(95, 2048), SR);
  assert.ok(res);
  assert.ok(Math.abs(cents(res.frequency, 95)) < 1, `écart : ${cents(res.frequency, 95).toFixed(3)} cents`);
});

test('YIN : voix haute (400 Hz) détectée', () => {
  const res = ToneDSP.yin(sine(400, 2048), SR);
  assert.ok(res);
  assert.ok(Math.abs(cents(res.frequency, 400)) < 1);
});

test('YIN : le silence ne renvoie rien', () => {
  assert.equal(ToneDSP.yin(new Float32Array(2048), SR), null);
});

test('YIN : un souffle très faible ne renvoie rien (porte RMS)', () => {
  assert.equal(ToneDSP.yin(whiteNoise(2048, 0.002), SR), null);
});

test('YIN : la composante continue est retirée', () => {
  const buf = sine(200, 2048);
  for (let i = 0; i < buf.length; i++) buf[i] += 0.4; // forte composante DC
  const res = ToneDSP.yin(buf, SR);
  assert.ok(res);
  assert.ok(Math.abs(cents(res.frequency, 200)) < 1);
});

test('YIN : le bruit blanc pur n’est pas accepté comme voix', () => {
  const res = ToneDSP.yin(whiteNoise(2048, 0.25, 7), SR);
  if (res) assert.ok(res.clarity < 0.55, `clarity trop haute pour du bruit : ${res.clarity}`);
});

test('YIN : la voix de synthèse est correctement suivie', () => {
  const sig = synthVoice({ contour: CONTOURS[1], f0: 160, sampleRate: SR, durationMs: 300, level: 0.1 });
  const res = ToneDSP.yin(sig.subarray(5000, 5000 + 2048), SR);
  assert.ok(res);
  assert.ok(Math.abs(cents(res.frequency, 160)) < 20, `écart : ${cents(res.frequency, 160).toFixed(1)} cents`);
});

// ===========================================================================
// 2. CORRECTION D'OCTAVE
// ===========================================================================

test('repairOctaves : un saut d’octave isolé est corrigé', () => {
  const frames = contourFrames([[0, 0], [1, 0]], { n: 9 });
  frames[4].freq *= 2; // erreur d'octave
  const fixed = ToneDSP.repairOctaves(frames);
  const ratio = fixed[4].freq / fixed[3].freq;
  assert.ok(ratio > 0.8 && ratio < 1.25, `le saut d'octave n'a pas été corrigé (ratio ${ratio.toFixed(2)})`);
});

test('repairOctaves : une vraie montée de 7 demi-tons n’est PAS aplatie', () => {
  // Régression : l’ancienne règle « médiane globale » divisait la crête par 2.
  const frames = contourFrames([[0, 0], [1, 7]], { n: 12 });
  const fixed = ToneDSP.repairOctaves(frames);
  const rise = 12 * Math.log2(fixed[11].freq / fixed[0].freq);
  assert.ok(rise > 6, `la montée a été écrasée : ${rise.toFixed(2)} demi-tons au lieu de 7`);
});

test('repairOctaves : une portion entière à l’octave supérieur est ramenée', () => {
  const frames = contourFrames([[0, 0], [1, 0]], { n: 15 });
  for (let i = 5; i < 10; i++) frames[i].freq *= 2;
  const fixed = ToneDSP.repairOctaves(frames);
  const mid = 12 * Math.log2(fixed[7].freq / fixed[2].freq);
  assert.ok(Math.abs(mid) < 3, `la portion à l'octave n'a pas été ramenée (${mid.toFixed(2)} demi-tons)`);
});

// ===========================================================================
// 3. SEGMENTATION
// ===========================================================================

test('segmentVoiced : isole le segment vocal entre deux silences', () => {
  const frames = [
    { t: 0, freq: null, clarity: 0, rms: 0.001 },
    { t: 16, freq: null, clarity: 0, rms: 0.001 },
    { t: 32, freq: 150, clarity: 0.9, rms: 0.05 },
    { t: 48, freq: 150, clarity: 0.9, rms: 0.05 },
    { t: 64, freq: 150, clarity: 0.9, rms: 0.05 },
    { t: 80, freq: 150, clarity: 0.9, rms: 0.05 },
    { t: 96, freq: 150, clarity: 0.9, rms: 0.05 },
    { t: 112, freq: null, clarity: 0, rms: 0.001 }
  ];
  const seg = ToneDSP.segmentVoiced(frames);
  assert.ok(seg);
  assert.equal(seg.start, 2);
  assert.equal(seg.end, 6);
});

test('segmentVoiced : le bruit de fond seul ne produit aucun segment', () => {
  const frames = Array.from({ length: 30 }, (_, i) => ({
    t: i * 16, freq: 120, clarity: 0.9, rms: 0.0012
  }));
  assert.equal(ToneDSP.segmentVoiced(frames), null);
});

test('segmentVoiced : une trame peu périodique est rejetée', () => {
  const frames = Array.from({ length: 20 }, (_, i) => ({
    t: i * 16, freq: 120, clarity: i === 5 ? 0.2 : 0.9, rms: 0.05
  }));
  const seg = ToneDSP.segmentVoiced(frames);
  assert.ok(seg);
  assert.ok(seg.start !== 5 && seg.end !== 5, 'la trame non périodique n’a pas été exclue');
});

// ===========================================================================
// 4. CLASSIFICATION
// ===========================================================================

test('classifyTone : contour plat → ton 1', () => {
  const res = classifyContour([[0, 0], [0.3, 0.15], [0.6, -0.1], [1, 0.05]]);
  assert.equal(res.tone, 1);
  assert.equal(res.reason, 'flat');
});

test('classifyTone : contour montant → ton 2', () => {
  const res = classifyContour([[0, 0], [0.2, 0.3], [0.5, 1.8], [0.8, 3.2], [1, 4]]);
  assert.equal(res.tone, 2);
  assert.equal(res.reason, 'rising');
});

test('classifyTone : contour creusé → ton 3', () => {
  const res = classifyContour([[0, 1.5], [0.2, 0.2], [0.5, -2], [0.75, -1], [1, 0]]);
  assert.equal(res.tone, 3);
  assert.equal(res.reason, 'dipping');
});

test('classifyTone : « demi-ton 3 » (creux sans remontée) → ton 3', () => {
  const res = classifyContour([[0, 1.5], [0.2, 0.2], [0.5, -2], [0.75, -1.9], [1, -1.7]]);
  assert.equal(res.tone, 3, `obtenu ${res.tone} (${res.reason})`);
});

test('classifyTone : contour tombant → ton 4', () => {
  const res = classifyContour([[0, 3.5], [0.15, 3.2], [0.4, 1], [0.7, -1.5], [1, -3]]);
  assert.equal(res.tone, 4);
  assert.equal(res.reason, 'falling');
});

test('classifyTone : contour plat et court → ton 5 (neutre)', () => {
  const res = classifyContour([[0, 0], [0.5, 0.1], [1, 0]], { n: 9 });
  assert.equal(res.tone, 5);
  assert.equal(res.reason, 'neutral');
});

test('classifyTone : un contour plat et long reste un ton 1', () => {
  const res = classifyContour([[0, 0], [0.3, 0.15], [0.6, -0.1], [1, 0.05]], { n: 24 });
  assert.equal(res.tone, 1);
});

test('classifyTone : un ton 1 tremblant n’est PAS rapporté « ton 4 »', () => {
  // Régression : l'ancien repli `slope > 0 ? 2 : 4` classait un ton plat
  // et instable en ton 4.
  const res = classifyContour([[0, 0], [0.2, 1.4], [0.4, 0.2], [0.6, 1.2], [0.8, 0.1], [1, 0.4]], { n: 24 });
  assert.notEqual(res.tone, 4, `un ton plat a été rapporté ton 4 (${res.reason})`);
});

test('classifyTone : une forme non concluante donne « ambigu », pas un ton forcé', () => {
  const res = classifyContour([[0, 0], [0.2, 3], [0.4, 1], [0.6, 4], [0.8, 0.5], [1, 3.5]], { n: 24 });
  assert.equal(res.tone, null);
  assert.equal(res.reason, 'ambiguous');
});

test('classifyTone : aucune feature → aucun ton', () => {
  const res = ToneDSP.classifyTone(null);
  assert.equal(res.tone, null);
  assert.equal(res.reason, 'no-signal');
});

// ---------------------------------------------------------------------------
// Confiance : features construites à la main (indépendantes de l'extraction)
// ---------------------------------------------------------------------------

/** Features neutres, à surcharger selon le cas testé. */
function features(over = {}) {
  return Object.assign({
    slope: 0, endSlope: 0, endRise: 0, dipDepth: 0,
    minPos: 0.5, maxPos: 0.5, range: 1, durationMs: 400
  }, over);
}

test('classifyTone : un ton 1 plus plat a une confiance plus haute', () => {
  const plat  = ToneDSP.classifyTone(features({ range: 0.3 }));
  const moins = ToneDSP.classifyTone(features({ range: 2.0 }));
  assert.equal(plat.tone, 1);
  assert.equal(moins.tone, 1);
  assert.ok(plat.confidence > moins.confidence, `${plat.confidence} ≤ ${moins.confidence}`);
});

test('classifyTone : un ton 5 plus court a une confiance plus haute', () => {
  const court = ToneDSP.classifyTone(features({ durationMs: 100 }));
  const long  = ToneDSP.classifyTone(features({ durationMs: 250 }));
  assert.equal(court.tone, 5);
  assert.equal(long.tone, 5);
  assert.ok(court.confidence > long.confidence, `${court.confidence} ≤ ${long.confidence}`);
});

test('classifyTone : un demi-ton 3 au seuil atteint la confiance minimale', () => {
  const res = ToneDSP.classifyTone(features({ dipDepth: 1.0, endRise: 0, endSlope: 0, slope: -0.5 }));
  assert.equal(res.tone, 3);
  assert.equal(res.reason, 'half-dipping');
  assert.ok(res.confidence >= 0.45, `confiance ${res.confidence}`);
});

// ===========================================================================
// 5. BOUCLE COMPLÈTE (capture → YIN → VAD → classification)
// ===========================================================================

test('bout en bout : ton 1 détecté sur une syllabe synthétisée', () => {
  const c = makeCase({ tone: 1, f0: 150, seed: 11 });
  const res = ToneDSP.analyze(c.frames, { hopMs: 16 });
  assert.equal(res.tone, 1, `obtenu ${res.tone} (${res.reason})`);
});

test('bout en bout : ton 2 détecté sur une syllabe synthétisée', () => {
  const c = makeCase({ tone: 2, f0: 150, seed: 12 });
  const res = ToneDSP.analyze(c.frames, { hopMs: 16 });
  assert.equal(res.tone, 2, `obtenu ${res.tone} (${res.reason})`);
});

test('bout en bout : ton 3 détecté sur une syllabe synthétisée', () => {
  const c = makeCase({ tone: 3, f0: 150, seed: 13 });
  const res = ToneDSP.analyze(c.frames, { hopMs: 16 });
  assert.equal(res.tone, 3, `obtenu ${res.tone} (${res.reason})`);
});

test('bout en bout : ton 4 détecté, onset haut conservé', () => {
  const c = makeCase({ tone: 4, f0: 150, seed: 14 });
  const res = ToneDSP.analyze(c.frames, { hopMs: 16 });
  assert.equal(res.tone, 4, `obtenu ${res.tone} (${res.reason})`);
});

test('bout en bout : ton 5 (neutre) détecté', () => {
  const c = makeCase({ tone: 5, f0: 150, durationMs: 200, seed: 15 });
  const res = ToneDSP.analyze(c.frames, { hopMs: 16 });
  assert.equal(res.tone, 5, `obtenu ${res.tone} (${res.reason})`);
});

test('bout en bout : un ton 2 reste montant malgré une erreur d’octave', () => {
  // Régression : la correction d'octave sur médiane globale aplatissait
  // la montée et le ton 2 était rapporté « plat ».
  const c = makeCase({ tone: 2, f0: 150, seed: 16, octaveError: { fromRatio: 0.45, toRatio: 0.85, ratio: 2 } });
  const res = ToneDSP.analyze(c.frames, { hopMs: 16 });
  assert.equal(res.tone, 2, `obtenu ${res.tone} (${res.reason})`);
});

test('bout en bout : une voix grave (95 Hz) est suivie', () => {
  const c = makeCase({ tone: 2, f0: 95, seed: 17 });
  const res = ToneDSP.analyze(c.frames, { hopMs: 16 });
  assert.equal(res.tone, 2, `obtenu ${res.tone} (${res.reason})`);
});

test('bout en bout : le bruit de fond seul ne produit aucun ton', () => {
  const c = makeCase({ tone: 1, f0: 150, noiseRms: 0.0005, level: 0.0002, seed: 18 });
  const res = ToneDSP.analyze(c.frames, { hopMs: 16 });
  assert.equal(res.tone, null, `un ton a été détecté dans le bruit (${res.reason})`);
});
