#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Génère les illustrations du quiz d'images via la CLI `mcode-tools`.

    mcode-tools connector call connector__matrix__generate_image --args-file ...

Ce script orchestre le cycle complet pour un lot de mots :
génération → téléchargement → normalisation (normalize_images.py) →
nettoyage du fond (clean_images.py) → écriture dans assets/img/hsk1/.

Prérequis : la CLI `mcode-tools` sur le PATH et ses identifiants configurés.

    python3 scripts/generate_images.py                # tous les mots manquants
    python3 scripts/generate_images.py 0 6            # seulement les 6 premiers
"""
import glob
import json
import os
import shutil
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from image_words import WORDS, build_prompt
from normalize_images import normalize
from clean_images import clean

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "img")
RAW = os.path.join(ROOT, ".img-raw")
GEN = "connector__matrix__generate_image"
BATCH = 4          # au-delà, la connexion échoue par intermittence


def sh(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"échec : {cmd}\n{(r.stderr or r.stdout)[:400]}")
    return r.stdout


def generate(batch, attempts=3):
    """Retourne {slug: node_id} ; réessaie en cas de panne du connecteur."""
    reqs = [{
        "prompt": build_prompt(scene),
        "aspect_ratio": "1:1",
        "resolution": "1K",
        "output_file": f"{slug}.png",
    } for _h, slug, _lvl, _p, _f, _en, _fr, _c, scene in batch]

    argsf = os.path.join(ROOT, ".img-args.json")
    json.dump({"requests": reqs}, open(argsf, "w", encoding="utf-8"), ensure_ascii=False)

    for attempt in range(1, attempts + 1):
        try:
            r = subprocess.run(f"mcode-tools connector call {GEN} --args-file {argsf}",
                               shell=True, capture_output=True, text=True, timeout=420)
        except subprocess.TimeoutExpired:
            print(f"  ! tentative {attempt}/{attempts} : délai dépassé", flush=True)
            time.sleep(5 * attempt)
            continue
        if r.returncode != 0:
            print(f"  ! tentative {attempt}/{attempts} : {(r.stderr or '')[:200]}")
            time.sleep(5 * attempt)
            continue
        res = json.loads(r.stdout)
        items = res.get("success_items") or []
        mapping = {}
        for it in items:
            stem = os.path.splitext(it.get("file_name", ""))[0]
            if stem:
                mapping[stem] = it["node_id"]
        missing = [s for _h, s, *_ in batch if s not in mapping]
        if not missing:
            return mapping
        print(f"  ! tentative {attempt}/{attempts} : manquants {missing}")
        time.sleep(5 * attempt)

    raise RuntimeError(f"lot en échec après {attempts} tentatives")


def download(slug, node_id):
    url = json.loads(sh(f"mcode-tools get_asset_url {node_id}"))["download_url"]
    ext = ".png" if url.split("?")[0].lower().endswith(".png") else ".jpg"
    dst = os.path.join(RAW, f"{slug}{ext}")
    sh(f'curl -sL -o "{dst}" "{url}"')
    return dst


def main():
    start = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    end = int(sys.argv[2]) if len(sys.argv) > 2 else len(WORDS)
    os.makedirs(RAW, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)

    todo = [w for w in WORDS[start:end]
            if not os.path.exists(os.path.join(OUT, f"hsk{w[2]}", w[1] + ".webp"))]
    for i in range(0, len(todo), BATCH):
        chunk = todo[i:i + BATCH]
        print(f"[lot {i + start}..{i + start + len(chunk)}] "
              + ", ".join(c[0] for c in chunk))
        mapping = generate(chunk)
        for hanzi, slug, lvl, *_rest in chunk:
            dest_dir = os.path.join(OUT, f"hsk{lvl}")
            os.makedirs(dest_dir, exist_ok=True)
            src = download(slug, mapping[slug])
            # L'original est conservé : c'est la seule source de vérité.
            # Le nettoyage qui suit est destructif (masque, érosion,
            # effacement, recadrage) — sans cet original, une illustration
            # abîmée est irrécupérable sans régénérer (donc : des crédits).
            keep = os.path.join(OUT, "img-raw", f"hsk{lvl}",
                                os.path.basename(src))
            os.makedirs(os.path.dirname(keep), exist_ok=True)
            shutil.copy2(src, keep)
            tmp = os.path.join(RAW, f"{slug}.webp")
            normalize(src, tmp)
            clean(tmp, os.path.join(dest_dir, f"{slug}.webp"))
            os.remove(src)
            if os.path.exists(tmp):
                os.remove(tmp)
            print(f"  {hanzi} {slug} (HSK{lvl}) -> "
                  f"{os.path.getsize(os.path.join(dest_dir, slug + '.webp')) // 1024} Ko", flush=True)
    print("terminé")


if __name__ == "__main__":
    main()
