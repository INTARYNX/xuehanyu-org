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

The classifier works in semitones relative to the speaker's own median pitch, so the thresholds are register-independent. Rules are applied in order: tone 4 → tone 2 → tone 3 (including the "half third tone") → tone 5 (short and flat) → tone 1 → *ambiguous*. **No tone is ever forced**: a contour that does not match any rule is reported as uncertain instead of being wrongly labelled.

The app captures at **16 kHz** (`AudioContext({ sampleRate: 16000 })`) with a 1024-sample analyser window, which the benchmark identifies as one of the most accurate *and* the cheapest configurations (4.5× less CPU than the previous 48 kHz/2048 setup).

## Tests

```bash
node --test tests/tone-dsp.test.mjs tests/app-tone.test.mjs   # 44 tests
node tests/tone-dsp.bench.mjs      # benchmark: 600 generated cases, confusion matrix
```

`tests/app-tone.test.mjs` loads `app.js` in a simulated DOM and checks the UI logic: the reference tone is the *cited* form, the sandhi is only shown as information, the grading (`perfect` / `close` / `wrong` / `unclear`) and the measurement banner.

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
