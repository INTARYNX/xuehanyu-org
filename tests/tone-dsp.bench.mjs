/**
 * tests/tone-dsp.bench.mjs — Banc d'essai de la détection de ton
 * -------------------------------------------------------------------
 * Génère une batterie de cas (tons × registres × durées × niveaux de bruit
 * × fautes d'octave), fait passer chaque cas dans la chaîne complète
 * (capture → YIN → VAD → réparation d'octave → classification) et produit :
 *
 *   - la matrice de confusion
 *   - le taux de réussite global et par ton
 *   - le taux de « non détecté / ambigu »
 *   - le taux de faux positifs sur bruit pur
 *
 * Lancement :  node tests/tone-dsp.bench.mjs
 * Code de sortie 1 si les critères d'acceptation ne sont pas tenus.
 */

import { ToneDSP, makeCase, mulberry32 } from './synth.mjs';

// ---------------------------------------------------------------------------
// Profils de capture
// ---------------------------------------------------------------------------

const PROFILES = [
  {
    id: '48k-1024',
    label: '48 kHz · fenêtre 21 ms (intégration 10,7 ms) — contre-exemple',
    sampleRate: 48000,
    windowSize: 1024,
    hopMs: 16,
    minFreq: 60,
    maxFreq: 800,
    counterExample: true
  },
  {
    id: '48k-2048',
    label: '48 kHz · fenêtre 43 ms (intégration 21 ms) — hérité',
    sampleRate: 48000,
    windowSize: 2048,
    hopMs: 16,
    minFreq: 60,
    maxFreq: 800
  },
  {
    id: '48k-4096',
    label: '48 kHz · fenêtre 85 ms (intégration 43 ms)',
    sampleRate: 48000,
    windowSize: 4096,
    hopMs: 16,
    minFreq: 60,
    maxFreq: 800
  },
  {
    id: '16k-512',
    label: '16 kHz · fenêtre 32 ms (intégration 16 ms)',
    sampleRate: 16000,
    windowSize: 512,
    hopMs: 16,
    minFreq: 60,
    maxFreq: 800
  },
  {
    id: '16k-1024',
    label: '16 kHz · fenêtre 64 ms (intégration 32 ms)',
    sampleRate: 16000,
    windowSize: 1024,
    hopMs: 16,
    minFreq: 60,
    maxFreq: 800
  }
];

// ---------------------------------------------------------------------------
// Matrice de génération
// ---------------------------------------------------------------------------

const SHAPES = [
  { key: 1, expected: 1, label: 'ton 1 plat' },
  { key: 2, expected: 2, label: 'ton 2 montant' },
  { key: 3, expected: 3, label: 'ton 3 creusé' },
  { key: '3-half', expected: 3, label: 'demi-ton 3' },
  { key: 4, expected: 4, label: 'ton 4 tombant' },
  { key: 5, expected: 5, label: 'ton 5 neutre' }
];

const REGISTERS = [95, 140, 210];   // voix grave / moyenne / haute
const DURATIONS = [320, 520];        // ms
const NOISES = [0.0008, 0.003];      // RMS du bruit de fond
const OCTAVE_ERRORS = [
  { fromRatio: 0.35, toRatio: 0.75, ratio: 2 },
  { fromRatio: 0.5, toRatio: 0.9, ratio: 0.5 }
];

/** Construit la liste complète des cas pour un profil. */
function buildCases(profile) {
  const cases = [];
  let seed = 1000;

  for (const shape of SHAPES) {
    for (const f0 of REGISTERS) {
      for (const durationMs of DURATIONS) {
        for (const noiseRms of NOISES) {
          // Le ton 5 est par nature bref : on impose une durée courte.
          const dur = shape.key === 5 ? 200 : durationMs;
          cases.push({
            profile,
            shape,
            expected: shape.expected,
            opts: { tone: shape.key, f0, durationMs: dur, noiseRms, seed: seed++ }
          });
        }
      }
    }
  }

  // Variantes avec faute d'octave du détecteur
  for (const shape of SHAPES) {
    for (const f0 of REGISTERS) {
      for (const octaveError of OCTAVE_ERRORS) {
        const dur = shape.key === 5 ? 200 : 400;
        cases.push({
          profile,
          shape,
          expected: shape.expected,
          faulty: true,
          opts: {
            tone: shape.key, f0, durationMs: dur, noiseRms: 0.0015,
            seed: seed++, octaveError
          }
        });
      }
    }
  }

  // Bruit pur (faux positifs attendus : aucun)
  for (let i = 0; i < 12; i++) {
    cases.push({
      profile,
      shape: null,
      expected: null,
      noiseOnly: true,
      opts: {
        tone: 1, f0: 150, durationMs: 400, noiseRms: 0.02,
        level: 0.00005, seed: seed++
      }
    });
  }

  return cases;
}

// ---------------------------------------------------------------------------
// Exécution
// ---------------------------------------------------------------------------

function runCase(c) {
  const { frames } = makeCase({
    ...c.opts,
    sampleRate: c.profile.sampleRate,
    windowSize: c.profile.windowSize,
    hopMs: c.profile.hopMs,
    minFreq: c.profile.minFreq,
    maxFreq: c.profile.maxFreq
  });
  return ToneDSP.analyze(frames, { hopMs: c.profile.hopMs });
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}

function padStart(s, n) {
  s = String(s);
  return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}

function printMatrix(matrix) {
  const tones = [1, 2, 3, 4, 5];
  const head = '  attendu →   ' + tones.map(t => padStart(t, 5)).join('') + padStart('?', 6);
  console.log(head);
  for (const t of tones) {
    const row = tones.map(c => padStart(matrix[t][c], 5)).join('') + padStart(matrix[t]['?'], 6);
    console.log('  ton ' + t + '        ' + row);
  }
}

function buildMatrix(results) {
  const tones = [1, 2, 3, 4, 5];
  const m = {};
  for (const e of tones) {
    m[e] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, '?': 0 };
  }
  for (const r of results) {
    if (r.expected === null) continue;
    m[r.expected][r.detected === null ? '?' : r.detected]++;
  }
  return m;
}

// ---------------------------------------------------------------------------
// Programme
// ---------------------------------------------------------------------------

const ALL_RESULTS = [];
let totalCases = 0;
let failures = 0;

for (const profile of PROFILES) {
  const cases = buildCases(profile);
  totalCases += cases.length;

  const results = [];
  const t0 = Date.now();
  for (const c of cases) {
    const res = runCase(c);
    results.push({
      expected: c.expected,
      detected: res.tone,
      reason: res.reason,
      confidence: res.confidence,
      faulty: !!c.faulty,
      noiseOnly: !!c.noiseOnly
    });
  }
  const elapsed = Date.now() - t0;

  // --- Cas de parole -----------------------------------------------------
  const speech = results.filter(r => !r.noiseOnly);
  const matrix = buildMatrix(speech);
  const correct = speech.filter(r => r.detected === r.expected).length;
  const accuracy = (correct / speech.length) * 100;
  const unresolved = speech.filter(r => r.detected === null).length;
  const unresolvedPct = (unresolved / speech.length) * 100;

  console.log('');
  console.log('═'.repeat(72));
  console.log(`PROFIL ${profile.id} — ${profile.label}`);
  console.log('═'.repeat(72));
  console.log(`Cas : ${cases.length}  ·  durée : ${elapsed} ms  ·  ${(elapsed / cases.length).toFixed(1)} ms/case`);
  console.log('');
  console.log('Matrice de confusion :');
  printMatrix(matrix);
  console.log('');
  console.log(`  réussite globale   : ${accuracy.toFixed(1)} %  (${correct}/${speech.length})`);
  for (const t of [1, 2, 3, 4, 5]) {
    const total = speech.filter(r => r.expected === t).length;
    const ok = speech.filter(r => r.expected === t && r.detected === t).length;
    const pct = total ? (ok / total) * 100 : 0;
    console.log(`    ton ${t} : ${padStart(pct.toFixed(1), 5)} %  (${ok}/${total})`);
  }
  console.log(`  non détecté/ambigu  : ${unresolvedPct.toFixed(1)} %  (${unresolved}/${speech.length})`);

  // --- Cas avec faute d'octave -------------------------------------------
  const faulty = results.filter(r => r.faulty);
  if (faulty.length) {
    const okF = faulty.filter(r => r.detected === r.expected).length;
    console.log(`  robustesse octave   : ${((okF / faulty.length) * 100).toFixed(1)} %  (${okF}/${faulty.length})`);
  }

  // --- Faux positifs sur bruit pur ---------------------------------------
  const noise = results.filter(r => r.noiseOnly);
  const fp = noise.filter(r => r.detected !== null).length;
  const fpPct = (fp / noise.length) * 100;
  console.log(`  faux positifs bruit : ${fpPct.toFixed(1)} %  (${fp}/${noise.length})`);

  ALL_RESULTS.push({ profile, results, accuracy, matrix, unresolvedPct, fpPct });

  // --- Classement : réussite d'abord, coût ensuite ----------------------
  ALL_RESULTS.push({ profile, results, accuracy, matrix, unresolvedPct, fpPct });
}

// --- Critères d'acceptation, évalués sur TOUS les profils -----------------
console.log('');
console.log('Critères d\'acceptation (par profil) :');
for (const r of ALL_RESULTS) {
  const speech = r.results.filter(x => !x.noiseOnly);
  const perTone = [1, 2, 3, 4, 5].every(t => {
    const total = speech.filter(x => x.expected === t).length;
    const ok = speech.filter(x => x.expected === t && x.detected === t).length;
    return total === 0 || (ok / total) * 100 >= 80;
  });
  const checks = [
    ['réussite globale ≥ 90 %', r.accuracy >= 90],
    ['réussite par ton ≥ 80 %', perTone],
    ['faux positifs sur bruit ≤ 5 %', r.fpPct <= 5]
  ];
  const bad = checks.filter(c => !c[1]);
  const tag = r.profile.counterExample ? '⚠' : (bad.length ? '✘' : '✔');
  const note = r.profile.counterExample ? ' (contre-exemple : fenêtre trop courte, non retenu)' : '';
  console.log(`  ${r.profile.id.padEnd(10)} ${tag} ${checks.map(c => c[0]).join(' · ')}${note}`);
  if (!r.profile.counterExample) failures += bad.length;
}

// --- Profil recommandé : le meilleur compromis réussite / coût -----------
const RECOMMENDED = ALL_RESULTS
  .filter(r => !r.profile.counterExample && r.accuracy >= 95 && r.fpPct <= 5)
  .sort((a, b) => (a.profile.windowSize * a.profile.sampleRate) - (b.profile.windowSize * b.profile.sampleRate));

if (RECOMMENDED.length) {
  const best = RECOMMENDED[0];
  console.log('');
  console.log(`Profil recommandé : ${best.profile.id} — ${best.profile.label}`);
  console.log(`  réussite ${best.accuracy.toFixed(1)} % · faux positifs ${best.fpPct.toFixed(1)} %`);
  console.log(`  → AudioContext({ sampleRate: ${best.profile.sampleRate} }) + analyser.fftSize = ${best.profile.windowSize}`);
}

console.log('');
console.log('═'.repeat(72));
console.log(`TOTAL : ${totalCases} cas générés sur ${PROFILES.length} profils de capture.`);
console.log('═'.repeat(72));

if (failures) {
  console.error(`\n${failures} critère(s) d'acceptation non tenu(s).`);
  process.exit(1);
}
console.log('\nTous les critères d\'acceptation sont tenus.');
