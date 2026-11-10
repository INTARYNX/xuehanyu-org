# -*- coding: utf-8 -*-
"""Génère l'audio des mots d'UN SEUL caractère (HSK 1-2) avec une voix neuronale Microsoft via edge-tts.

Pourquoi pas Kokoro (scripts/build_audio.py) : il ne sait pas dire un caractère isolé (fin coupée ou syllabe
parasite devant : « do yu » pour yǔ). Voix choisie à l'oreille : zh-TW-HsiaoYuNeural, +10 % de vitesse.
Service en ligne non officiel (voir la licence d'edge-tts : LGPLv3 pour le code ; les droits sur l'audio
dépendent des conditions de Microsoft, site non commercial) : les MP3 sont générés ici, jamais appelés
depuis le navigateur du visiteur.

    .venv-tts\\Scripts\\pip install edge-tts soundfile
    .venv-tts\\Scripts\\python scripts\\build_audio_single.py

Sorties : audio/w/<codepoint>.mp3 + mise à jour de audio/index.json (mots disponibles).
"""
import asyncio
import io
import json
import os
import sys

import edge_tts
import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "audio")
VOICE = "zh-TW-HsiaoYuNeural"
RATE = "+10%"
LEVELS = (1, 2)
TRIES = 4
PARALLEL = 4
TIMEOUT = 20              # s par essai : le service peut ne jamais répondre (cas de 问, bloqué sans fin)


def single_chars():
    seen, chars = set(), []
    for level in LEVELS:
        with open(os.path.join(ROOT, "data", f"hsk{level}.json"), encoding="utf-8-sig") as f:
            for e in json.load(f):
                w = e["simplified"]
                if len(w) == 1 and w not in seen:
                    seen.add(w)
                    chars.append(w)
    return chars


def trim(wav, sr, pad_ms=80, tail_ms=150, floor=0.01):
    """Le service rallonge chaque fichier de silence (~1,9 s au total) : on le retire, sinon le quiz attend."""
    loud = np.flatnonzero(np.abs(wav) > floor)
    if not len(loud):
        return None
    return wav[max(0, loud[0] - int(sr * pad_ms / 1000)): loud[-1] + int(sr * tail_ms / 1000)]


async def fetch(text):
    """MP3 du service, ou une exception ; le service renvoie parfois « aucun son » (NoAudioReceived)."""
    buf = bytearray()
    async for chunk in edge_tts.Communicate(text, VOICE, rate=RATE).stream():
        if chunk["type"] == "audio":
            buf += chunk["data"]
    if not buf:
        raise RuntimeError("aucun son")
    return bytes(buf)


async def make(text, sem):
    path = os.path.join(OUT, "w", f"{ord(text):x}.mp3")
    if os.path.exists(path) and "--force" not in sys.argv:
        return text, True                                      # déjà fait (relancer ne refait que les manquants)
    async with sem:
        for _ in range(TRIES):
            try:
                wav, sr = sf.read(io.BytesIO(await asyncio.wait_for(fetch(text), TIMEOUT)))
                wav = trim(wav, sr)
                if wav is None or len(wav) / sr < 0.15:
                    continue                                   # silence ou presque : on réessaie
                sf.write(path, wav.astype(np.float32), sr, format="MP3")
                return text, True
            except Exception:
                await asyncio.sleep(1)
        return text, False


async def main():
    os.makedirs(os.path.join(OUT, "w"), exist_ok=True)
    sem = asyncio.Semaphore(PARALLEL)
    results = await asyncio.gather(*(make(c, sem) for c in single_chars()))
    failed = [c for c, ok in results if not ok]

    index_path = os.path.join(OUT, "index.json")
    with open(index_path, encoding="utf-8") as f:
        index = json.load(f)
    words = {w for w in index["words"] if "-" in w}            # mots de plusieurs caractères : inchangés (Kokoro)
    words |= {f"{ord(c):x}" for c, ok in results if ok}
    index["words"] = sorted(words)
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(results) - len(failed)}/{len(results)} caractères générés ; échecs : {''.join(failed) or 'aucun'}")


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
