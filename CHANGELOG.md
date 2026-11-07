# Changelog

## Unreleased — interface redesign

- New design system in `style.css`: solid surfaces on the paper backdrop, sans-serif UI, serif hanzi, tokens for colour, radius and spacing, visible keyboard focus, `prefers-reduced-motion`.
- Pinyin is no longer italic: italic Georgia drew the tone-3 mark (ǎ ǐ ǒ) detached from its letter.
- App shell: slim top bar with tabs on desktop, fixed bottom tab bar on phones.
- Practice (`quiz.html`) is now a hub plus focused 10-card sessions: streak, daily goal, words due, mastery bar; flashcards hide the answer until revealed; multiple-choice answers get immediate feedback with a continue bar; missed words come back once at the end; end-of-session summary. Keyboard: space to reveal, 1/2 to grade, 1–4 to choose.
- `progress.js` (new, with tests): words practised per day, goal (10 words) and streak, kept in `localStorage`. An answered card or question counts as 1 word, a reviewed lesson as all its distinct words; the hub says so.
- Lessons: a path with done / up-next states and overall progress, chat-style dialogue, switch-style Pinyin / Translation toggles, a sticky action bar, and a "next lesson" button. The page opens on the first lesson not reviewed yet.
- Dictionary: word hero (pinyin, meaning, badges) above a stroke grid, labelled actions, and only the facts that exist (no more rows of dashes).
- Illustrations: 140 images rebuilt from their originals by cropping only (the old pipeline erased pale parts such as grey hair and left stray dashes). Originals are kept in the git-ignored `assets/img-raw/`.
- Home: one primary call to action (practice) and two secondary ones.
- Installable app: richer manifest (id, shortcuts, maskable icon), install button on Android/desktop, step-by-step instructions on iPhone (where push only exists for apps added to the home screen).
- Daily reminder (Web Push): choose a time on the practice page; a notification is sent only if nothing was practised that day, and stops after 14 idle days. Small backend in `server/` (Python + SQLite, no account: the push subscription is the only identifier). See `server/push_server.py`; deployed with `scripts/deploy-push.ps1`.
- SEO: `scripts/build-seo.mjs` generates one static page per word (5,000+, content in the HTML, JSON-LD) and a list page per HSK level, plus `sitemap-mots.xml`; `deploy.ps1` runs it. Dictionary deep links (`app.html?w=学&l=1`). 301 (not 302) from the bare domain to `www`.
- Bottom tab bar: fixed height (no safe-area in the padding), the safe area is filled under it; the word sheet opens above it; tests check that nothing is hidden under the bar.

## 1.0.0 — 2026-11-06

First tagged release.

- Dictionary for HSK 1–6 with stroke order, stroke quiz and tone practice.
- Image quiz: 145 illustrated HSK 1–2 words, with spaced-repetition scheduling and a *Due* deck.
- 25 HSK 1 conversation lessons restricted to HSK 1 vocabulary.
- Offline support (service worker) and a proper web manifest.
- HTML escaping of all data rendered through `innerHTML`; CDN assets pinned with SRI.
- CI running the syntax check and the test suite.
