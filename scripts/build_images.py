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
# Une syllabe peut porter l'accent sur la majuscule (« Ài ») : on regarde
# aussi la version minuscule du caractère.
TONE_MAP.update({k.upper(): v for k, v in TONE_MAP.items()})


def tone_of(pinyin: str) -> int:
    """Ton de la syllabe tonique (dernière syllabe) : 1 à 4."""
    for ch in reversed(pinyin or ""):
        if ch in TONE_MAP:
            return TONE_MAP[ch]
    return 0


# ---------------------------------------------------------------------------
# Quasi-doublons visuels
# ---------------------------------------------------------------------------
# L'unicité des fichiers ne dit rien de la ressemblance des images : deux
# fichiers différents peuvent montrer la même chose (c'est ce qui est arrivé
# avec 妹妹 et 孩子 — deux enfants en pied, indiscernables).
#
# On compare donc le *centre* de chaque image (la marge blanche est ignorée,
# sinon toutes les illustrations se ressemblent) :
#   - « structure » : écart moyen entre deux vignettes 16x16 en niveaux de gris
#   - « couleur »   : écart moyen entre les couleurs moyennes
#
# dHash a été essayé puis écarté : sur fond blanc il mesure surtout la
# marge, et déclarait les quatre « taches de peinture » (红/黑/绿/白) comme
# jumelles alors qu'elles sont parfaitement distinguables par leur couleur.
# Ces seuils ne servent qu'à signaler, la décision reste éditoriale :
# soit on déclare la paire dans CONFUSABLE, soit on change la scène.
STRUCT_MAX = 22        # même composition, quelle que soit la couleur
COLOR_MAX = 12         # même composition et quasi même couleur
STRUCT_STRICT = 14     # image presque identique


def _signature(path: str):
    from PIL import Image
    im = Image.open(path).convert("RGB")
    w, h = im.size
    im = im.crop((int(w * .15), int(h * .15), int(w * .85), int(h * .85)))
    im = im.resize((16, 16), Image.LANCZOS)
    px = list(im.get_flattened_data()) if hasattr(im, "get_flattened_data") else list(im.getdata())
    gray = [(0.299 * r + 0.587 * g + 0.114 * b) for r, g, b in px]
    n = len(px)
    mean = (sum(p[0] for p in px) // n,
            sum(p[1] for p in px) // n,
            sum(p[2] for p in px) // n)
    return gray, mean


def near_duplicates(entries):
    """Renvoie les paires d'images visuellement trop proches.

    `entries` : liste de (slug, chemin, confusables).
    Les paires volontairement confusables (déclarées dans CONFUSABLE)
    sont ignorées : leur ressemblance est un choix éditorial.
    """
    try:
        sigs = [(s, _signature(p)) for s, p, _c in entries]
    except Exception as exc:                      # PIL absent, image illisible
        print(f"  (quasi-doublons non vérifiés : {exc})")
        return []

    found = []
    for i in range(len(sigs)):
        s1, (g1, c1) = sigs[i]
        for j in range(i + 1, len(sigs)):
            s2, (g2, c2) = sigs[j]
            if s2 in entries[i][2] or s1 in entries[j][2]:
                continue                          # paire confondue : voulue
            gs = sum(abs(a - b) for a, b in zip(g1, g2)) / len(g1)
            dc = sum(abs(a - b) for a, b in zip(c1, c2)) / 3
            if gs <= STRUCT_STRICT or (gs <= STRUCT_MAX and dc <= COLOR_MAX):
                found.append((round(gs, 1), round(dc, 1), s1, s2))
    return sorted(found)


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
    warnings = []
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
    entries = []
    for lvl in index["levels"]:
        m = json.load(open(os.path.join(OUT_DIR, lvl["manifest"]), encoding="utf-8"))
        all_slugs += [w["slug"] for w in m["words"]]
        for w in m["words"]:
            p = os.path.join(OUT_DIR, f"hsk{lvl['id']}", w["image"])
            if os.path.exists(p):
                entries.append((w["slug"], p, w.get("confusable") or []))
    if len(set(all_slugs)) != len(all_slugs):
        problems.append("slugs dupliqués entre niveaux")

    # quasi-doublons visuels (non déclarés confusables)
    for gs, dc, s1, s2 in near_duplicates(entries):
        msg = (f"quasi-doublon visuel : {s1} ↔ {s2} (structure {gs}, couleur {dc}) — "
               f"images trop proches : déclarez la paire dans CONFUSABLE ou changez la scène")
        if gs <= STRUCT_STRICT:
            problems.append(msg)          # images quasi identiques : bloquant
        else:
            # Même cadrage (« une personne debout ») mais sujets différents :
            # à vérifier à l'œil, pas bloquant.
            warnings.append(msg)

    for p in problems:
        print("  !", p)
    for w in warnings:
        print("  ~", w)
    print(f"{total} mots vérifiés sur {len(index['levels'])} niveaux — "
          f"{len(problems)} problème(s), {len(warnings)} à vérifier")
    return 1 if problems else 0


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    if cmd == "manifest":
        sys.exit(build())
    if cmd == "check":
        sys.exit(check())
    raise SystemExit(f"commande inconnue : {cmd} (manifest|check)")
