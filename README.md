# 学汉语 · xuehanyu.org

Learn Chinese, one character at a time.

A static web app for studying Mandarin Chinese vocabulary from HSK levels 1–6. Browse characters, see animated stroke order, search by character / pinyin / meaning, and practice tones with your microphone.

## Features

- **HSK 1–6 vocabulary** — 5,000+ characters with pinyin, French and English translations, radicals, classifiers, and part-of-speech tags
- **Animated stroke order** via [Hanzi Writer](https://hanziwriter.org)
- **Stroke quiz** — trace the character yourself
- **Text-to-speech** — hear the pronunciation
- **Tone detection** — record yourself and get real-time pitch feedback with tone sandhi support
- **Bilingual UI** — French / English

## Stack

Pure HTML + CSS + JavaScript. No build step, no framework, no server required.

External dependencies (CDN only):
- [Hanzi Writer](https://hanziwriter.org) — stroke order rendering
- [Font Awesome](https://fontawesome.com) — icons

Data sources:
- [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) (MIT)
- [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) (CC BY-SA 4.0)
- [CFDICT](https://chine.in/mandarin/open/CFDICT/) (CC BY-SA 3.0)
- [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) — stroke data (GPL)

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
