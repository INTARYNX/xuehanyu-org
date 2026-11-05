#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Construit et vérifie les manifestes du quiz d'images (assets/img/).

    python3 scripts/build_images.py manifest    # (re)génère les manifestes
    python3 scripts/build_images.py check       # vérifie manifestes ↔ fichiers

Un manifeste par niveau HSK, plus assets/img/index.json qui les liste.
Les illustrations sont produites par scripts/generate_images.py (CLI
`mcode-tools`), puis normalisées par normalize_images.py / clean_images.py.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from image_words import WORDS, CONFUSABLE

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "img")
LEVELS = (1, 2)

TONE_MAP = {
    "ā": 1, "á": 2, "ǎ": 3, "à": 4,
    "ē": 1, "é": 2, "ě": 3, "è": 4,
    "ī": 1, "í": 2, "ǐ": 3, "ì": 4,
    "ō": 1, "ó": 2, "ǒ": 3, "ò": 4,
    "ū": 1, "ú": 2, "ǔ": 3, "ù": 4,
    "ǖ": 1, "ǘ": 2, "ǚ": 3, "ǜ": 4,
}


def tone_of(pinyin: str) -> int:
    """Ton de la syllabe tonique (dernière syllabe) : 1 à 4."""
    for ch in reversed(pinyin or ""):
        if ch in TONE_MAP:
            return TONE_MAP[ch]
    return 0


def build() -> int:
    index = {"version": 2, "levels": []}
    missing = []

    for lvl in LEVELS:
        dest = os.path.join(OUT_DIR, f"hsk{lvl}")
        words = []
        for hanzi, slug, word_lvl, pinyin, freq, en, fr, cat, _scene in WORDS:
            if word_lvl != lvl:
                continue
            if not os.path.exists(os.path.join(dest, f"{slug}.webp")):
                missing.append(f"HSK{lvl} {hanzi} ({slug}) : image manquante")
                continue
            words.append({
                "char":      hanzi,
                "slug":      slug,
                "pinyin":    pinyin,
                "tone":      tone_of(pinyin),
                "freq":      freq,
                "en":        en,
                "fr":        fr,
                "cat":       cat,
                "image":     f"{slug}.webp",
                "confusable": CONFUSABLE.get(slug, []),
            })

        os.makedirs(dest, exist_ok=True)
        path = os.path.join(dest, "manifest.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"version": 2, "level": lvl, "count": len(words), "words": words},
                      f, ensure_ascii=False, indent=1)
        print(f"HSK{lvl} : {len(words)} mots -> {path}")
        index["levels"].append({
            "id": lvl,
            "label": f"HSK {lvl}",
            "manifest": f"hsk{lvl}/manifest.json",
            "count": len(words),
        })

    with open(os.path.join(OUT_DIR, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
    print(f"index   : {len(index['levels'])} niveaux -> {OUT_DIR}/index.json")

    for x in missing:
        print("  !", x)
    return 1 if missing else 0


def check() -> int:
    problems = []
    idx_path = os.path.join(OUT_DIR, "index.json")
    if not os.path.exists(idx_path):
        raise SystemExit("index.json absent — lancez d'abord : build_images.py manifest")
    index = json.load(open(idx_path, encoding="utf-8"))

    total = 0
    for lvl in index["levels"]:
        path = os.path.join(OUT_DIR, lvl["manifest"])
        if not os.path.exists(path):
            problems.append(f"manifest absent : {lvl['manifest']}")
            continue
        m = json.load(open(path, encoding="utf-8"))
        if m["count"] != len(m["words"]):
            problems.append(f"HSK{lvl['id']} : count != words.length")
        slugs = [w["slug"] for w in m["words"]]
        if len(set(slugs)) != len(slugs):
            problems.append(f"HSK{lvl['id']} : slugs dupliqués")
        for w in m["words"]:
            if not os.path.exists(os.path.join(OUT_DIR, f"hsk{lvl['id']}", w["image"])):
                problems.append(f"image manquante : hsk{lvl['id']}/{w['image']}")
            for f in ("char", "pinyin", "en", "fr", "cat", "image"):
                if not w.get(f):
                    problems.append(f"{w['slug']} : champ « {f} » vide")
            if w.get("tone") not in (1, 2, 3, 4):
                problems.append(f"{w['slug']} : ton invalide ({w.get('tone')})")
        total += len(m["words"])

    # les slugs doivent être uniques tous niveaux confondus
    all_slugs = []
    for lvl in index["levels"]:
        m = json.load(open(os.path.join(OUT_DIR, lvl["manifest"]), encoding="utf-8"))
        all_slugs += [w["slug"] for w in m["words"]]
    if len(set(all_slugs)) != len(all_slugs):
        problems.append("slugs dupliqués entre niveaux")

    for p in problems:
        print("  !", p)
    print(f"{total} mots vérifiés sur {len(index['levels'])} niveaux — {len(problems)} problème(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    if cmd == "manifest":
        sys.exit(build())
    if cmd == "check":
        sys.exit(check())
    raise SystemExit(f"commande inconnue : {cmd} (manifest|check)")
