# -*- coding: utf-8 -*-
"""Génère l'audio de TOUS les mots HSK 1-2 avec une voix neuronale Microsoft via edge-tts.

Pourquoi pas Kokoro (scripts/build_audio.py, resté pour les dialogues) : il ne sait pas dire un caractère isolé
(fin coupée ou syllabe parasite devant : « do yu » pour yǔ). Voix choisie à l'oreille : zh-TW-HsiaoYuNeural,
+10 % de vitesse. Volume ramené au niveau des dialogues.
Service en ligne non officiel (voir la licence d'edge-tts : LGPLv3 pour le code ; les droits sur l'audio
dépendent des conditions de Microsoft, site non commercial) : les MP3 sont générés ici, jamais appelés
depuis le navigateur du visiteur.

    .venv-tts\\Scripts\\pip install edge-tts soundfile
    .venv-tts\\Scripts\\python scripts\\build_audio_words.py

Sorties : audio/w/<codepoints>.mp3 (même nom que Kokoro : codepoints hexadécimaux séparés par « - ») + audio/index.json.
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
TARGET_RMS_DB = -19.8     # niveau moyen des 363 répliques de dialogue (audio/l), mesuré sur les passages sonores
PEAK_MAX = 0.89           # crête maximale (-1 dBFS) : jamais d'écrêtage
TIMEOUT = 20              # s par essai : le service peut ne jamais répondre (cas de 问, bloqué sans fin)


SKIP_WORDS = {"长"}       # plusieurs lectures (cháng « long » / zhǎng « grandir ») : pas de fichier, voix du système


def word_key(text):
    return "-".join(f"{ord(c):x}" for c in text)


def all_words():
    seen, chars = set(), []
    for level in LEVELS:
        with open(os.path.join(ROOT, "data", f"hsk{level}.json"), encoding="utf-8-sig") as f:
            for e in json.load(f):
                w = e["simplified"]
                if w not in seen and w not in SKIP_WORDS:
                    seen.add(w)
                    chars.append(w)
    return chars


def trim(wav, sr, pad_ms=80, tail_ms=150, floor=0.01):
    """Le service rallonge chaque fichier de silence (~1,9 s au total) : on le retire, sinon le quiz attend."""
    loud = np.flatnonzero(np.abs(wav) > floor)
    if not len(loud):
        return None
    return wav[max(0, loud[0] - int(sr * pad_ms / 1000)): loud[-1] + int(sr * tail_ms / 1000)]


def normalize(wav):
    """Amène le niveau moyen au niveau des dialogues (les fichiers du service vont de -24 à -14 dBFS)."""
    voiced = np.abs(wav) > 0.02
    rms = float(np.sqrt(np.mean(wav[voiced] ** 2)))
    gain = min(10 ** (TARGET_RMS_DB / 20) / rms, PEAK_MAX / float(np.abs(wav).max()))
    return wav * gain


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
    path = os.path.join(OUT, "w", f"{word_key(text)}.mp3")
    if os.path.exists(path) and "--force" not in sys.argv:
        return text, True                                      # déjà fait (relancer ne refait que les manquants)
    async with sem:
        for _ in range(TRIES):
            try:
                wav, sr = sf.read(io.BytesIO(await asyncio.wait_for(fetch(text), TIMEOUT)))
                wav = trim(wav, sr)
                if wav is None or len(wav) / sr < 0.15:
                    continue                                   # silence ou presque : on réessaie
                sf.write(path, normalize(wav).astype(np.float32), sr, format="MP3")
                return text, True
            except Exception:
                await asyncio.sleep(1)
        return text, False


async def main():
    os.makedirs(os.path.join(OUT, "w"), exist_ok=True)
    sem = asyncio.Semaphore(PARALLEL)
    results = await asyncio.gather(*(make(c, sem) for c in all_words()))
    failed = [c for c, ok in results if not ok]

    index_path = os.path.join(OUT, "index.json")
    with open(index_path, encoding="utf-8") as f:
        index = json.load(f)
    index["words"] = sorted(word_key(c) for c, ok in results if ok)
    index["voice_words"] = f"edge-tts {VOICE} {RATE}"
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(results) - len(failed)}/{len(results)} mots générés ; échecs : {''.join(failed) or 'aucun'}")


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
