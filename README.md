# 学汉语 · xuehanyu.org

A free, static web app to learn Mandarin vocabulary (HSK 1–6). No account, no build step, no backend.

- **Dictionary** — ~5,000 words with pinyin, French and English meanings, radical, classifiers and part of speech. Search by character, pinyin or meaning.
- **Stroke order** — animated, plus a mode where you trace the character yourself ([Hanzi Writer](https://hanziwriter.org)).
- **Tone practice** — record yourself and see the pitch contour of what you said next to the target tone. The analysis runs entirely in the browser.
- **Image quiz** — 106 concrete HSK 1–2 words learned from pictures, with flashcards and two multiple-choice modes. Answers are scheduled with spaced repetition.
- **Lessons** — 25 short HSK 1 dialogues that only use HSK 1 words, with pinyin as pronounced (tone sandhi applied), translations and text-to-speech.

The UI is in French and English. Once a page has been visited it works offline.

## Run it

The word data (`data/`) is not in the repo. Fetch it once:

```powershell
.\scripts\download_data.ps1      # builds data/hsk1.json … hsk6.json from upstream sources
```

or, without PowerShell, copy it from the live site:

```bash
mkdir -p data
for i in 1 2 3 4 5 6; do curl -sL -o "data/hsk$i.json" "https://www.xuehanyu.org/data/hsk$i.json"; done
```

Then serve the folder (`fetch()` does not work from `file://`):

```bash
python3 -m http.server 8080
```

## Tests

```bash
node --test tests/*.test.mjs        # needs Node 20+
node tests/tone-dsp.bench.mjs       # tone detection benchmark (generated audio)
```

`tests/ui.test.mjs` opens the pages in a real browser (Playwright, skipped when it is not installed) to check the layout at phone and desktop width.

CI runs the same on every push. The suites cover the tone classifier (including a corpus of realistic tone-3 contours), the lessons (every line must segment into HSK 1 words only), the image quiz (manifest integrity, distractor selection), the spaced-repetition scheduler, the daily progress and streak, and the HTML escaping helper.

## How it works

**Tone detection** (`tone-dsp.js`, no dependencies). Pitch is tracked with YIN, octave errors are repaired, voiced segments are found with an adaptive gate, and the contour is turned into features in semitones relative to the speaker's own median pitch, so the thresholds do not depend on register. The classifier tries tone 3, 4, 2, 5, 1 in that order and returns *ambiguous* rather than forcing a label. Tone 3 is judged on its shape (an early, dominant valley of the right depth), not on slope, so a flat contour that sags in the middle is not a tone 3. Thresholds live in `DEFAULTS.tone`; the `strict`, `default` and `tolerant` presets trade missed tone 3s against false ones. Capture is 16 kHz with a 1024-sample window, which the benchmark found to be accurate and about 4.5× cheaper than 48 kHz / 2048.

**Image quiz** (`quiz.js`, data in `assets/img/`). The deck is the current level; distractors come from the current and earlier levels, preferably from the same category. Words that cannot be told apart from a picture (e.g. a university building and a primary school) are declared in `CONFUSABLE` in `scripts/image_words.py` and are never offered together. Illustrations are generated, normalised to a white background and committed (`assets/img/hsk<n>/*.webp`). To add a word, add a line to `scripts/image_words.py`, then:

```bash
python3 scripts/generate_images.py        # needs the mcode-tools CLI; skips images that exist
python3 scripts/build_images.py manifest  # rebuilds manifests and index.json
python3 scripts/build_images.py check
```

**Practice sessions and streak** (`quiz.js`, `progress.js`). A session is 10 cards, due words first, then new ones; a missed word comes back once before the summary. `progress.js` counts words practised per local day (daily goal 10: 1 per answered card or question, all the distinct words of a lesson when it is marked reviewed) and derives the streak; it is pure logic with `localStorage` as a thin wrapper.

**Spaced repetition** (`srs.js`). A simplified SM-2 with right/wrong grades: a correct answer is due again in 1 day, then 3, then the interval grows by the ease factor; a miss brings the word back in 10 minutes. A correct answer on a word that is not yet due changes nothing. The *Due* button builds a deck from every word that is due. State is kept in `localStorage`.

**Lessons** (`lessons/`). `lessons/source.json` is the hand-edited source; `python3 scripts/build_lessons.py` validates it (each line is segmented by longest match against the HSK 1 list and the build fails on any out-of-scope word) and writes `lessons/hsk1.json`. 们, which only exists attached to a pronoun, is the one HSK 1 word not used.

**Offline.** `sw.js` caches pages, scripts, data and images. Bump `VERSION` in it to flush the cache after a breaking change.

## Credits and licenses

Source code: MIT.

Illustrations (`assets/img/`): generated with an AI image model by the author and released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

Data and assets keep their own licenses:

- [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) — word lists (MIT)
- [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) — English meanings (CC BY-SA 4.0)
- [CFDICT](https://chine.in/mandarin/open/CFDICT/) — French meanings (CC BY-SA 3.0)
- [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) — stroke data, via Hanzi Writer (GPL)
- [Hanzi Writer](https://hanziwriter.org) (MIT) and [Font Awesome](https://fontawesome.com) are loaded from a CDN.
