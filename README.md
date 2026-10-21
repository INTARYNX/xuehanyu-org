# 学汉语 · xuehanyu.org

Learn Chinese, one character at a time.

A static web app for studying Mandarin Chinese vocabulary from HSK levels 1–6. Browse characters, see animated stroke order, search by character / pinyin / meaning, and practice tones with your microphone.

## Features

- **HSK 1–6 vocabulary** — 5,000+ characters with pinyin, French and English translations, radicals, classifiers, and part-of-speech tags
- **Animated stroke order** via [Hanzi Writer](https://hanziwriter.org)
- **Stroke quiz** — trace the character yourself
- **Text-to-speech** — hear the pronunciation
- **Tone detection** — record yourself and get real-time pitch feedback: measured breakdown (F0 start → end, pitch change in semitones, duration, confidence) and the target tone shape drawn on the same semitone scale
- **Bilingual UI** — French / English

## Stack

Pure HTML + CSS + JavaScript. No build step, no framework, no server required.

External dependencies (CDN only):
- [Hanzi Writer](https://hanziwriter.org) — stroke order rendering
- [Font Awesome](https://fontawesome.com) — icons

The tone detection engine ([`tone-dsp.js`](tone-dsp.js)) is **self-contained**: no external library, no network call, no build step.

Data sources:
- [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) (MIT)
- [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) (CC BY-SA 4.0)
- [CFDICT](https://chine.in/mandarin/open/CFDICT/) (CC BY-SA 3.0)
- [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) — stroke data (GPL)

## Tone detection

[`tone-dsp.js`](tone-dsp.js) is a dependency-free DSP module (usable in the browser as `window.ToneDSP` and in Node via `require`/`import`):

| Export | Role |
| --- | --- |
| `yin(buffer, sampleRate, opts)` | YIN pitch detection with parabolic interpolation, global-minimum fallback and a `clarity` (periodicity) score |
| `repairOctaves(frames)` | Local octave-error repair (neighbourhood median) — preserves genuine contour excursions |
| `smoothMedian(frames)` | 3-frame median filter (removes isolated glitches, preserves edges) |
| `segmentVoiced(frames)` | Adaptive VAD (noise floor + peak based RMS gate, plus the periodicity gate) |
| `extractFeatures(frames)` | Shape features in **semitones** relative to the syllable's median F0 |
| `classifyTone(features)` | Tone 1–5 or `null` (ambiguous) with a confidence score |
| `analyze(frames, opts)` | The full pipeline |
| `TONE_PRESETS` / `toneOptions(preset, over)` | Sensitivity presets and threshold overrides |

The classifier works in semitones relative to the speaker's own median pitch, so the thresholds are register-independent.

### How the tones are told apart

Rules are applied in order: **tone 3 → tone 4 → tone 2 → tone 5 → tone 1 → *ambiguous***. **No tone is ever forced**: a contour that does not match any rule is reported as uncertain instead of being wrongly labelled.

The **dipping tone (3)** is the delicate one: it is not judged on its overall slope but on its *structure* — a real valley. A tone 3 is a *checked* tone: the pitch falls immediately from the onset, bottoms out, then either climbs back up (214) or stays at the bottom (211, the very frequent "half third tone"). Five conditions must hold:

1. the valley is interior and reached early — the fall is over before the end of the syllable;
2. the pitch is already falling in the first third (proportionally) — a flat contour that sags in the middle is *not* a tone 3;
3. the valley dominates the other valleys of the contour — a wobbling contour is not a tone;
4. the valley is deep enough (amplitude of the dip);
5. the amplitude stays within the tone-3 range — a 4-level fall (8–10 semitones) is a tone 4.

A tone 4, on the other hand, requires a *fast, sustained* fall whose low point is reached at the end of the syllable; a tone 1 is a flat contour with a slow drift; a tone 2 rises from its minimum.

### Sensitivity

Some contours are genuinely ambiguous (a soft tone 1 and a shallow tone 3 look alike; a "half third tone" that keeps sinking sounds like a tone 4). Every threshold lives in `DEFAULTS.tone` and can be overridden:

```js
ToneDSP.analyze(frames, { tone: ToneDSP.TONE_PRESETS.tolerant });
ToneDSP.analyze(frames, { tone: ToneDSP.toneOptions('default', { dipMin: 0.8 }) });
```

Preset | Behaviour | Risk |
--- | --- | --- |
`strict` | only announces a tone 3 when the valley is unmistakable | a soft or short tone 3 is reported as "flat" |
`default` | balanced (the values in `DEFAULTS.tone`) | — |
`tolerant` | accepts shallow valleys | a poorly held tone 1 may be reported as a tone 3 |

The app captures at **16 kHz** (`AudioContext({ sampleRate: 16000 })`) with a 1024-sample analyser window, which the benchmark identifies as one of the most accurate *and* the cheapest configurations (4.5× less CPU than the previous 48 kHz/2048 setup).

## Tests

```bash
node --test tests/tone-dsp.test.mjs tests/app-tone.test.mjs tests/tone-3.test.mjs   # 73 tests
node tests/tone-dsp.bench.mjs      # benchmark: 600 generated cases, confusion matrix
```

`tests/app-tone.test.mjs` loads `app.js` in a simulated DOM and checks the UI logic: the reference tone is the *cited* form, the sandhi is only shown as information, the grading (`perfect` / `close` / `wrong` / `unclear`) and the measurement banner.

`tests/tone-3.test.mjs` focuses on the dipping tone. It runs the **realistic contour corpus** (`tests/fixtures/real-contours.mjs`) — tone shapes as they are actually observed on a recording, with their accidents (low plateau, final rise, attack head) — through the classifier alone, then through the full audio chain, across registers, durations, noise levels, octave errors and capture windows. It also checks the regressions (a tone 3 with a late valley must not be reported as a tone 4, a half third tone that drifts must stay a tone 3, a flat tone with a mid-sag must not become a tone 3, …) and that the sensitivity presets really change the outcome.

`tests/synth.mjs` synthesises Mandarin-like syllables (glottal source + formants, attack/release envelope, background noise) for the five tones across three vocal registers, two durations, two noise levels, and with injected octave errors. The benchmark prints a confusion matrix, the success rate per tone and the false-positive rate on pure noise, and exits non-zero if the acceptance criteria are not met.

Real recordings can be plugged in the same way with `loadWav(path)` from `tests/synth.mjs`.

## Run locally

**1. Generate the data files** (requires PowerShell):

```powershell
.\scripts\download_data.ps1
```

This downloads and processes the HSK vocabulary into `data/hsk1.json` … `data/hsk6.json`.

**2. Serve the site** — because the app fetches `data/hsk*.json` via `fetch()`, you need a local server to avoid CORS errors:

```bash
# Python 3
python -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

## License

The source code (HTML, CSS, JS) is MIT. Data files retain their respective upstream licenses listed above.
