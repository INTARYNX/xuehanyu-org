# -*- coding: utf-8 -*-
"""Seconde passe : isole le sujet principal et efface cadres, ombres et filets.

Méthode (sans scipy) :
  1. masque « sujet » = pixels saturés ou sombres
  2. érosion du masque  -> élimine les filets et bords fins (frame, ombre)
  3. dilatation         -> restitue l'épaisseur du sujet
  4. les pixels restants trop clairs (>= 250) sont effacés
  5. recadrage + recomposition sur blanc pur à échelle constante
"""
import glob
import os
import sys
import numpy as np
from PIL import Image

SAT_MIN = 0.18
VAL_MAX = 0.62
NEAR_WHITE = 250
CANVAS = 512
FILL = 0.88


def shift_or(mask, dy, dx, fill=False):
    out = np.full_like(mask, fill)
    ys0 = max(0, dy); ys1 = min(mask.shape[0], mask.shape[0] + dy)
    xs0 = max(0, dx); xs1 = min(mask.shape[1], mask.shape[1] + dx)
    oy0 = ys0 - dy; oy1 = ys1 - dy
    ox0 = xs0 - dx; ox1 = xs1 - dx
    out[oy0:oy1, ox0:ox1] = mask[ys0:ys1, xs0:xs1]
    return out


def dilate(mask, r):
    out = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= shift_or(mask, dy, dx)
    return out


def erode(mask, r):
    out = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out &= shift_or(mask, dy, dx)
    return out


def clean(path: str, out: str) -> dict:
    im = Image.open(path).convert("RGB")
    a = np.array(im)
    hsv = np.array(im.convert("HSV"))
    sat = hsv[..., 1] / 255.0
    val = hsv[..., 2] / 255.0
    mask = (sat > SAT_MIN) | (val < VAL_MAX)

    core = erode(mask, 2)
    if core.sum() < 50:                      # repli si l'érosion détruit tout
        core = mask
    alpha = dilate(core, 3)

    # les résidus quasi blancs (filets, halos) sont effacés
    alpha &= (a.min(axis=2) < NEAR_WHITE)

    ys, xs = np.where(alpha)
    if len(xs) == 0:
        return {"path": path, "skipped": True}

    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    crop = im.crop((x0, y0, x1 + 1, y1 + 1))
    m = alpha[y0:y1 + 1, x0:x1 + 1]

    rgba = np.array(crop.convert("RGBA"))
    rgba[..., 3] = np.where(m, 255, 0).astype(np.uint8)
    crop = Image.fromarray(rgba, "RGBA")

    cw, ch = crop.size
    scale = (CANVAS * FILL) / max(cw, ch)
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    if scale > 1.03:                          # on n'agrandit pas : évite le flou
        crop = crop.resize((nw, nh), Image.LANCZOS)
    else:
        nw, nh = cw, ch

    out_im = Image.new("RGB", (CANVAS, CANVAS), (255, 255, 255))
    out_im.paste(crop, ((CANVAS - nw) // 2, (CANVAS - nh) // 2), crop)
    out_im.save(out, "WEBP", quality=86, method=6)
    return {"path": path, "size": (nw, nh), "bytes": os.path.getsize(out)}


if __name__ == "__main__":
    src_dir = sys.argv[1]
    dst_dir = sys.argv[2] if len(sys.argv) > 2 else src_dir
    for f in sorted(glob.glob(f"{src_dir}/*.webp")):
        r = clean(f, os.path.join(dst_dir, os.path.basename(f)))
        print(f"{os.path.basename(f):14} {r.get('size','')} {r.get('bytes',0)//1024:>3} Ko")
