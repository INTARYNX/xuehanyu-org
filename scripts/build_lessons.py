#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Authoring + validation des leçons de conversation HSK 1.

Contrainte : chaque phrase doit se découper **uniquement** en mots présents
dans le vocabulaire HSK 1 (data/hsk1.json, 294 entrées). « 你好 » est donc
valide : il se découpe en 你 + 好, tous deux dans la liste.

Le script :
  1. charge le vocabulaire HSK 1 (mots + pinyin) ;
  2. segmente chaque réplique par appariement maximal ;
  3. signale tout mot hors vocabulaire ;
  4. génère le pinyin de la réplique à partir des mots segmentés ;
  5. écrit lessons/hsk1-vocab.json et lessons/hsk1.json.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "hsk1.json")
OUT = os.path.join(ROOT, "lessons")
os.makedirs(OUT, exist_ok=True)

# --------------------------------------------------------------------------
# Pinyin : le fichier du site porte parfois la lecture « nom de famille »
# (车 Chē, 说 shuì, 听 yǐn…) ou la lecture citationnelle. On corrige.
# --------------------------------------------------------------------------
PINYIN_FIX = {
    "车": "chē", "说": "shuō", "听": "tīng", "上": "shàng", "那": "nà",
    "水": "shuǐ", "国": "guó", "元": "yuán", "日": "rì", "号": "hào",
    "读": "dú", "要": "yào", "吗": "ma", "吧": "ba", "个": "gè",
    "都": "dōu", "百": "bǎi", "三": "sān", "书": "shū", "新": "xīn",
    "也": "yě", "坐": "zuò", "钱": "qián", "年": "nián", "能": "néng",
    "后": "hòu", "冷": "lěng", "大学": "dà xué", "中国": "zhōng guó",
    "中文": "zhōng wén", "汉语": "hàn yǔ", "星期日": "xīng qī rì",
    "星期天": "xīng qī tiān", "太": "tài", "少": "shǎo", "睡": "shuì",
    "了": "le", "的": "de", "呢": "ne", "们": "men", "儿": "r",
    "面": "miàn", "本": "běn", "长": "cháng", "少": "shǎo", "乐": "lè",
    "行": "xíng", "只": "zhī", "地": "dì", "得": "de", "着": "zhe",
    "雪": "xuě", "还": "hái", "太": "tài",
}

# --------------------------------------------------------------------------
# Les leçons : le contenu rédigé est dans lessons/source.json (source de
# vérité éditable). Ce script le valide puis produit lessons/hsk1.json.
# --------------------------------------------------------------------------
SOURCE = os.path.join(OUT, "source.json")


def load_source():
    src = json.load(open(SOURCE, encoding="utf-8"))
    return src["lessons"]


# Coquilles connues de CFDICT (corrigées aussi dans app.js).
FR_FIX = {"frêre aîné": "frère aîné"}


def fix_french(text):
    for bad, good in FR_FIX.items():
        text = text.replace(bad, good)
    return text


def join_glosses(value):
    """CFDICT renvoie soit une chaîne, soit une liste de sens.

    `"; ".join("papa")` découperait la chaîne en caractères — il faut
    distinguer les deux cas, comme le fait app.js.
    """
    if not value:
        return ""
    if isinstance(value, str):
        return value
    return "; ".join(value)


def load_vocab():
    """Mots HSK 1 : forme, pinyin corrigé, sens FR/EN (pour les infobulles)."""
    data = json.load(open(DATA, encoding="utf-8-sig"))
    vocab = {}
    for e in data:
        w = e["simplified"]
        p = PINYIN_FIX.get(w, e["pinyin"])
        fr = fix_french(join_glosses(e.get("french")))
        en = join_glosses(e.get("english"))
        vocab[w] = {"p": p, "fr": fr, "en": en}
    return vocab


PUNCT = "。！？，、…：；·\u3000"


def segment(hanzi, vocab):
    """Appariement maximal (longest match) sur le vocabulaire HSK 1.

    La ponctuation n'est pas un mot : elle est isolée telle quelle.
    Retourne (tokens, position_du_premier_echec) ; tokens = liste de
    ("w", mot) ou ("p", ponctuation).
    """
    out, i = [], 0
    while i < len(hanzi):
        if hanzi[i] in PUNCT:
            out.append(("p", hanzi[i]))
            i += 1
            continue
        hit = None
        for n in range(min(4, len(hanzi) - i), 0, -1):
            if hanzi[i:i + n] in vocab:
                hit = hanzi[i:i + n]
                break
        if hit is None:
            return None, i
        out.append(("w", hit))
        i += len(hit)
    return out, i


def main():
    vocab = load_vocab()
    print(f"vocabulaire HSK 1 : {len(vocab)} entrées")

    errors = 0
    lessons = []
    for les in load_source():
        exchanges = []
        for who, ln in zip("AB" * 40, les["lines"]):
            hanzi, fr, en = ln["hanzi"], ln["fr"], ln["en"]
            tokens, pos = segment(hanzi, vocab)
            if tokens is None:
                print(f"  ! hors vocabulaire : {hanzi}  (caractère {pos} : {hanzi[pos]})")
                errors += 1
                tokens = []
            words = [t for k, t in tokens if k == "w"]
            parts = []
            for kind, tok in tokens:
                if kind == "w":
                    parts.append(" " + vocab[tok]["p"])
                else:
                    parts.append({"。": ".", "！": "!", "？": "?", "，": ",",
                                  "、": ",", "…": "…", "：": ":", "；": ";"}.get(tok, tok))
            pinyin = "".join(parts).strip()
            exchanges.append({
                "who": who,
                "hanzi": hanzi,
                "pinyin": pinyin,
                "fr": fr,
                "en": en,
                "words": words,
            })
        lessons.append({
            "id": les["id"],
            "title": les["title"],
            "level": 1,
            "focus": les["focus"],
            "exchanges": exchanges,
        })

    if errors:
        print(f"\n{errors} réplique(s) à corriger — fichier NON écrit")
        return 1

    with open(os.path.join(OUT, "hsk1-vocab.json"), "w", encoding="utf-8") as f:
        json.dump({"level": 1, "source": "data/hsk1.json", "words": vocab},
                  f, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, "hsk1.json"), "w", encoding="utf-8") as f:
        json.dump({"version": 1, "level": 1, "lessons": lessons},
                  f, ensure_ascii=False, indent=1)

    n = sum(len(l["exchanges"]) for l in lessons)
    uniq = {w for l in lessons for e in l["exchanges"] for w in e["words"]}
    print(f"{len(lessons)} leçons, {n} répliques, {len(uniq)} mots HSK 1 distincts utilisés")
    print(f"  → lessons/hsk1.json et lessons/hsk1-vocab.json écrits")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
