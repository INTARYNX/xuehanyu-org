# -*- coding: utf-8 -*-
"""Génère l'audio du site : une réplique par fichier pour les 25 leçons, un fichier par mot HSK 1-2.

Pourquoi : la prononciation passait par la voix chinoise du système, absente de la plupart des
PC Windows et Linux. Ces fichiers sont lus en priorité ; la voix du système ne sert plus qu'en secours.

Modèle : Kokoro v1.1-zh (hexgrad), poids sous licence Apache 2.0 ; les données chinoises ont été
cédées librement par LongMaoData (voir la fiche du modèle). Voix : zf_003 (A) et zm_012 (B).
Tourne en local, sans compte ni clé, sur CPU.

    py -3.10 -m venv .venv-tts
    .venv-tts\\Scripts\\pip install "kokoro>=0.9.4" "misaki[zh]" soundfile
    .venv-tts\\Scripts\\python scripts\\build_audio.py            # ne refait que ce qui manque
    .venv-tts\\Scripts\\python scripts\\build_audio.py --force    # tout refaire
    .venv-tts\\Scripts\\python scripts\\build_audio.py --only lessons|words

Sorties (dans audio/) :
    l/<id de leçon>-<n>.mp3     une réplique (n = rang dans le dialogue)
    w/<codepoints>.mp3          un mot ; nom = codepoints hexadécimaux séparés par « - » (爱 -> 7231)
    index.json                  voix, modèle et liste des mots disponibles
"""
import argparse
import json
import os
import sys
import time

import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "audio")
REPO = "hexgrad/Kokoro-82M-v1.1-zh"
VOICES = {"A": "zf_003", "B": "zm_012"}
SAMPLE_RATE = 24000
LEVELS = (1, 2)             # niveaux dont chaque mot a son fichier
# Mots que le moteur lit mal ISOLÉS : plusieurs lectures possibles et il prend la mauvaise pour le sens HSK
# (长 : cháng « long », pas zhǎng « grandir »). Pas de fichier : le site retombe sur la voix du système.
SKIP_WORDS = {"长"}


def word_file(text):
    return "w/" + "-".join(f"{ord(c):x}" for c in text) + ".mp3"


def speed(len_ps):
    """Kokoro s'emballe sur les longues phrases : on ralentit un peu (fonction de la fiche du modèle)."""
    s = 0.8
    if len_ps <= 83:
        s = 1
    elif len_ps < 183:
        s = 1 - (len_ps - 83) / 500
    return s * 1.1


def load_words():
    seen, words = set(), []
    for level in LEVELS:
        with open(os.path.join(ROOT, "data", f"hsk{level}.json"), encoding="utf-8-sig") as f:
            for e in json.load(f):
                w = e["simplified"]
                if w not in seen and w not in SKIP_WORDS:
                    seen.add(w)
                    words.append(w)
    return words


def load_lines():
    with open(os.path.join(ROOT, "lessons", "hsk1.json"), encoding="utf-8-sig") as f:
        lessons = json.load(f)["lessons"]
    return [(f"l/{l['id']}-{i}.mp3", e["hanzi"], e["who"]) for l in lessons for i, e in enumerate(l["exchanges"])]


def trim(wav, pad_ms=120, tail_ms=250, floor=0.003):
    """Retire le silence de tête et de queue. Seuil bas et marges larges : un mot d'un seul caractère
    s'éteint doucement (ton descendant) et le seuil précédent (0,01) en rognait la fin et l'attaque."""
    loud = np.flatnonzero(np.abs(wav) > floor)
    if not len(loud):
        return wav
    pad = int(SAMPLE_RATE * pad_ms / 1000)
    tail = int(SAMPLE_RATE * tail_ms / 1000)
    out = wav[max(0, loud[0] - pad): loud[-1] + tail]
    fade = min(len(out), int(SAMPLE_RATE * 0.06))     # fondu de sortie : jamais de coupure sèche
    out = out.copy()
    out[-fade:] *= np.linspace(1, 0, fade)
    return out


def end_level(wav, floor=0.003):
    """Amplitude des derniers 50 ms du son : forte = le moteur a coupé le mot en plein milieu."""
    loud = np.flatnonzero(np.abs(wav) > floor)
    return float(np.abs(wav[:loud[-1] + 1][-int(SAMPLE_RATE * 0.05):]).max()) if len(loud) else 0.0


SINGLE_CHAR_SPEED = 0.55    # moitié de la vitesse normale (1.1) : un caractère isolé était trop rapide à l'oreille


def synth(pipe, text, voice):
    """Kokoro tronque souvent la fin d'un mot d'un seul caractère : on essaie avec « ， » / « 。 » en
    plus et on garde la version dont la fin est la plus douce."""
    def run(t):
        chunks = [r.audio for r in pipe(t, voice=voice, speed=SINGLE_CHAR_SPEED if len(text) == 1 else speed)]
        return np.concatenate([c.numpy() if hasattr(c, "numpy") else c for c in chunks])
    variants = [text] if len(text) > 1 else [text, text + "，", text + "。"]
    return min((run(t) for t in variants), key=end_level)


def write_mp3(path, wav):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    # réglages par défaut de libsndfile : ~ 16-24 kbit/s en mono à 24 kHz, la voix reste nette
    sf.write(path, wav.astype(np.float32), SAMPLE_RATE, format="MP3")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--only", choices=("lessons", "words"))
    ap.add_argument("--limit", type=int, help="n'en faire que n (essai)")
    args = ap.parse_args()

    import torch
    from kokoro import KModel, KPipeline

    en = KPipeline(lang_code="a", repo_id=REPO, model=False)
    model = KModel(repo_id=REPO).to("cuda" if torch.cuda.is_available() else "cpu").eval()
    pipe = KPipeline(lang_code="z", repo_id=REPO, model=model, en_callable=lambda t: next(en(t)).phonemes)

    jobs = []
    if args.only != "words":
        jobs += [(os.path.join(OUT, rel), text, VOICES[who]) for rel, text, who in load_lines()]
    words = load_words()
    if args.only != "lessons":
        jobs += [(os.path.join(OUT, word_file(w)), w, VOICES["A"]) for w in words]
    if args.limit:
        jobs = jobs[:args.limit]

    t0, done, skipped = time.time(), 0, 0
    for i, (path, text, voice) in enumerate(jobs, 1):
        if os.path.exists(path) and not args.force:
            skipped += 1
            continue
        wav = trim(synth(pipe, text, voice))
        write_mp3(path, wav)
        done += 1
        if done % 25 == 0:
            print(f"{i}/{len(jobs)}  {done} faits, {skipped} déjà là, {time.time() - t0:.0f}s", flush=True)

    index = {
        "model": REPO, "license": "Apache-2.0", "voices": VOICES,
        "words": sorted(f[2:-4] for f in (word_file(w) for w in words) if os.path.exists(os.path.join(OUT, f))),
    }
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    print(f"terminé : {done} générés, {skipped} déjà présents, {len(index['words'])} mots dans l'index")


if __name__ == "__main__":
    sys.exit(main())
