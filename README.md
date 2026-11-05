# 学汉语 · xuehanyu.org

Learn Chinese, one character at a time.

A static web app for studying Mandarin Chinese vocabulary from HSK levels 1–6. Browse characters, see animated stroke order, search by character / pinyin / meaning, and practice tones with your microphone.

## Features

- **HSK 1–6 vocabulary** — 5,000+ characters with pinyin, French and English translations, radicals, classifiers, and part-of-speech tags
- **Animated stroke order** via [Hanzi Writer](https://hanziwriter.org)
- **Stroke quiz** — trace the character yourself
- **Image quiz** — learn the 106 concrete HSK 1–2 words from illustrations, with three modes (see below)
- **Conversation lessons** — 25 HSK 1 dialogues built with **HSK 1 words only**, with pinyin (sandhi applied), translation and audio
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

## Image quiz

[`quiz.html`](quiz.html) teaches vocabulary by picture, the way a picture dictionary does. It covers the concrete words of **HSK 1 and HSK 2** — the nouns and simple verbs a learner can actually see: `苹果, 猫, 狗, 飞机, 火车, 医生, 面包, 饺子, 咖啡, 地铁, 眼睛, 鸟, 雨, 雪…`

The level selector at the top switches between HSK 1 and HSK 2. Each level has its own deck — a beginner never meets a word from a level they haven't reached — while the distractors are drawn from the current level **and the previous ones**, so the choices stay demanding even on a short level.

> **Current state:** HSK 1 is complete (55 words) and HSK 2 is complete (51 words) — 106 illustrations in all. The level selector shows the real count of each deck.

Three modes, all bilingual and fully static:

| Mode | What it does |
| --- | --- |
| **Cards** | Image + character + pinyin + meaning, with a speaker button. Mark each word *I know it* or *To review*. |
| **Image → Word** | One picture, four Chinese characters to choose from. The audio plays automatically. |
| **Word → Image** | One character and its pinyin, four pictures to choose from. |

A few design choices worth knowing:

- **Distractors are drawn from the same semantic category** when possible (`电话 / 电视 / 电脑 / 手机`), so the test discriminates meaning instead of guessing by topic.
- **Indistinguishable pairs are never offered together.** Some words are impossible to tell apart from the picture alone — at HSK 1 level a beginner has no way to know a university hall from a primary school. `scripts/image_words.py` declares those pairs in `CONFUSABLE`, and the quiz refuses to put two of them in the same set of choices. Declaring a pair is a deliberate editorial decision: it means *the image cannot carry the distinction*, not that the two words are similar.
- **No tone is ever forced** — the progress bar shows the position, the score is only counted for the two quiz modes.
- **Progress is remembered locally** (`localStorage`): the words you marked as known are kept out of the *To review only* filter.
- The illustrations are **versioned in the repository** (`assets/img/hsk<n>/*.webp`, ~20 kB each), so the page works offline and calls no external service.

### Lessons

[`lessons.html`](lessons.html) is a page of short conversations — **25 dialogues, 363 lines**, on everyday topics: introducing yourself, at the restaurant, shopping, asking the way, work, family, weather, at the clinic, leisure, meeting someone, the rhythm of a day, at home, on the phone, at school, reading and writing, dates, numbers and money.

Together they use **293 of the 294 HSK 1 words** — only 们 (the plural suffix, which only exists glued to a pronoun) is left out.

The point is the **vocabulary constraint**: every line is written with HSK 1 words only. The constraint is checked at the *word* level, not the dictionary level — 「你好」 is fine because it splits into 你 + 好, both of them HSK 1. `scripts/build_lessons.py` segments each line by longest match against the HSK 1 vocabulary and refuses to write the file if a single word is out of scope.

| File | Content |
| --- | --- |
| `lessons/source.json` | The authored content (hanzi + FR/EN translations) — the editable source of truth |
| `lessons/hsk1.json` | The built lessons: title, exchanges (hanzi, pinyin, FR and EN translation, HSK 1 words used) |
| `lessons/hsk1-vocab.json` | The 294 HSK 1 entries with pinyin and meaning — the reference the vocabulary check runs against |
| `lessons-pinyin.js` | Tone sandhi (3+3 → 2+3, 不+4 → bú, 一 → yí/yì), shared by the page and the tests |

```bash
python3 scripts/build_lessons.py   # validates lessons/source.json and rebuilds lessons/hsk1.json
```

The page shows the pinyin *as it is pronounced* (sandhi applied, and never across a full stop), hides or shows the translation, reads the whole conversation aloud, and keeps the reviewed lessons in `localStorage`. Clicking a word chip shows its meaning.

### Mobile

The quiz is built for the phone first:

- every interactive target is at least **44 × 44 px** (Apple HIG / Material);
- the layout is verified at 390 × 844 with real touch events — no horizontal overflow, nothing off-screen;
- `speechSynthesis` is **unlocked on the first user gesture**, because iOS refuses to speak before the user has interacted with the page; the speaker button works regardless;
- the bottom padding reserves `env(safe-area-inset-bottom)` so the home indicator never covers the footer.

### Versioning

The footer shows the quiz version (`v1.1`). Check it after a deployment: an old build cached by the browser will show an older number, and the pinyin alignment fix landed in `v1.1`.

### Data files

| File | Content |
| --- | --- |
| `assets/img/index.json` | Lists the available levels and their manifest |
| `assets/img/hsk1/manifest.json` | The HSK 1 words: character, pinyin, tone, frequency, EN and FR meaning, category, image file, confusable pairs |
| `assets/img/hsk2/manifest.json` | The same, for HSK 2 |
| `assets/img/hsk<n>/<slug>.webp` | The illustration, 512×512, white background |

The manifests live under `assets/` and **not** under `data/`: `data/` is git-ignored, so anything placed there would never be committed.

### Regenerating the illustrations

The images were produced with a text-to-image model from the scene descriptions in `scripts/image_words.py`, then normalised: the subject is isolated, re-centred and re-composed on a pure white background at a constant scale, so every illustration has the same framing and weight.

```bash
python3 scripts/generate_images.py          # requiert la CLI `mcode-tools`
python3 scripts/build_images.py manifest    # reconstruit les manifestes + index.json
python3 scripts/build_images.py check       # vérifie manifestes ↔ fichiers
```

`generate_images.py` skips the illustrations that already exist, so it can be interrupted and resumed: it only produces what is missing. The generator writes the words that are missing to the manifest as *not available*, and `build_images.py manifest` then publishes only the levels whose images are on disk.

`scripts/image_words.py` is the single source of truth: character, slug, **level**, pinyin, frequency, EN/FR meaning, category and the English scene description used as the image prompt. Adding a word means adding one line there, then regenerating.


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
node --test tests/tone-dsp.test.mjs tests/app-tone.test.mjs tests/tone-3.test.mjs tests/quiz.test.mjs tests/lessons.test.mjs   # 102 tests
node tests/tone-dsp.bench.mjs      # benchmark: 600 generated cases, confusion matrix
```

`tests/app-tone.test.mjs` loads `app.js` in a simulated DOM and checks the UI logic: the reference tone is the *cited* form, the sandhi is only shown as information, the grading (`perfect` / `close` / `wrong` / `unclear`) and the measurement banner.

`tests/tone-3.test.mjs` focuses on the dipping tone. It runs the **realistic contour corpus** (`tests/fixtures/real-contours.mjs`) — tone shapes as they are actually observed on a recording, with their accidents (low plateau, final rise, attack head) — through the classifier alone, then through the full audio chain, across registers, durations, noise levels, octave errors and capture windows. It also checks the regressions (a tone 3 with a late valley must not be reported as a tone 4, a half third tone that drifts must stay a tone 3, a flat tone with a mid-sag must not become a tone 3, …) and that the sensitivity presets really change the outcome.

`tests/lessons.test.mjs` checks the lessons: the data integrity (every line has a pinyin and both translations), and above all **the vocabulary constraint** — every line must segment into HSK 1 words only, and the word chips shown in the page must match that segmentation exactly. It also checks the tone sandhi (`3+3 → 2+3`, `不+4 → bú`, `一 → yí/yì`), that the sandhi never crosses a full stop, that no line contains a corrupted character (U+FFFD), that the lessons cover at least 95 % of the HSK 1 vocabulary, that the French uses a single register (tutoiement) and that the French/English glosses are not split character by character.

`tests/quiz.test.mjs` checks the image quiz: manifest integrity (schema, uniqueness, every image file present, every word really in HSK 1) and the distractor logic — the four choices offered are always distinct, never include the answer, and preferentially come from the same semantic category so the test discriminates meaning rather than topic. It also asserts that **no two indistinguishable words are ever offered in the same set of choices**, and that the `CONFUSABLE` declarations are symmetric.

`tests/synth.mjs` synthesises Mandarin-like syllables (glottal source + formants, attack/release envelope, background noise) for the five tones across three vocal registers, two durations, two noise levels, and with injected octave errors. The benchmark prints a confusion matrix, the success rate per tone and the false-positive rate on pure noise, and exits non-zero if the acceptance criteria are not met.

Real recordings can be plugged in the same way with `loadWav(path)` from `tests/synth.mjs`.

## Run locally

**1. Generate the data files** (requires PowerShell):

```powershell
.\scripts\download_data.ps1
```

This downloads and processes the HSK vocabulary into `data/hsk1.json` … `data/hsk6.json`.

The live site serves the very same files, so on a machine without PowerShell they can be fetched directly:

```bash
mkdir -p data
for i in 1 2 3 4 5 6; do
  curl -sL -o "data/hsk$i.json" "https://www.xuehanyu.org/data/hsk$i.json"
done
```

`data/` is git-ignored, so it never lands in a commit — but `scripts/build_lessons.py` needs `data/hsk1.json` to rebuild the lessons, while the page itself only reads the committed `lessons/` files.

**2. Serve the site** — because the app fetches `data/hsk*.json` via `fetch()`, you need a local server to avoid CORS errors:

```bash
# Python 3
python -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

## License

The source code (HTML, CSS, JS) is MIT. Data files retain their respective upstream licenses listed above.
