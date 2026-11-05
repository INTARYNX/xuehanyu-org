# -*- coding: utf-8 -*-
"""Normalisation des illustrations : sujet centré, échelle constante, fond blanc pur.

Détection du sujet par saturation + valeur (le fond blanc et les ombres
portées grises sont désaturés, donc exclus).
"""
import os
import sys
import glob
import numpy as np
from PIL import Image

CANVAS = 512          # côté final
SUBJECT_FILL = 0.86   # part du sujet la plus grande dans le canvas
SAT_MIN = 0.18        # saturation minimale pour compter comme sujet
VAL_MAX = 0.62        # valeur max d'un pixel sombre (contours)


def subject_mask(im: Image.Image) -> np.ndarray:
    hsv = np.array(im.convert("HSV"))
    sat = hsv[..., 1] / 255.0
    val = hsv[..., 2] / 255.0
    return (sat > SAT_MIN) | (val < VAL_MAX)


def normalize(src: str, dst: str, canvas: int = CANVAS) -> dict:
    im = Image.open(src).convert("RGB")
    W, H = im.size
    mask = subject_mask(im)

    ys, xs = np.where(mask)
    if len(xs) == 0:                       # repli : tout l'image
        x0, y0, x1, y1 = 0, 0, W - 1, H - 1
    else:
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()

    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    # marge proportionnelle, bornée
    m = int(max(bw, bh) * 0.03)
    x0 = max(0, x0 - m); y0 = max(0, y0 - m)
    x1 = min(W - 1, x1 + m); y1 = min(H - 1, y1 + m)

    crop = im.crop((x0, y0, x1 + 1, y1 + 1))
    cw, ch = crop.size
    scale = (canvas * SUBJECT_FILL) / max(cw, ch)
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    crop = crop.resize((nw, nh), Image.LANCZOS)

    out = Image.new("RGB", (canvas, canvas), (255, 255, 255))
    out.paste(crop, ((canvas - nw) // 2, (canvas - nh) // 2))

    # le sujet ne doit pas déborder : on recolle en masquant le hors-sujet
    crop_mask = np.array(crop.convert("HSV"))
    csat = crop_mask[..., 1] / 255.0
    cval = crop_mask[..., 2] / 255.0
    m2 = (csat > SAT_MIN) | (cval < VAL_MAX)
    if m2.sum() > 0:
        rgba = crop.convert("RGBA")
        a = np.array(rgba)
        a[..., 3] = np.where(m2, 255, 0)
        crop = Image.fromarray(a, "RGBA")
        out.paste(crop, ((canvas - nw) // 2, (canvas - nh) // 2), crop)

    out.save(dst, "WEBP", quality=86, method=6)
    return {"src": src, "dst": dst, "size": out.size, "bytes": os.path.getsize(dst)}


if __name__ == "__main__":
    src_dir = sys.argv[1] if len(sys.argv) > 1 else "raw"
    dst_dir = sys.argv[2] if len(sys.argv) > 2 else "webp"
    os.makedirs(dst_dir, exist_ok=True)
    for f in sorted(glob.glob(f"{src_dir}/*.img")):
        name = os.path.basename(f).rsplit(".", 1)[0]
        r = normalize(f, f"{dst_dir}/{name}.webp")
        print(f"{name:10} -> {r['bytes']//1024:>3} Ko  {r['size']}")
