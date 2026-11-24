"""Derive tileable normal maps (OpenGL / +Y convention) from the baked colour textures.

Run after make_textures.py:  python3 tools/make_normals.py
Grout lines and dark veins read as recessed; strength is tuned per material.
"""
import os

import numpy as np
from PIL import Image, ImageFilter

T = os.path.join(os.path.dirname(__file__), "..", "textures")
STRENGTH = {
    "floor_greige": 5, "floor_graphite": 5, "floor_original": 3, "floor_herringbone": 4, "floor_ivory": 4,
    "floor_terrazzo": 2.5, "wall_veincut": 3, "shower_greige": 5, "shower_mosaic_original": 6, "mosaic_taupe": 7,
    "zellige_white": 3.5, "tile_sage": 4, "oak_fluted": 10, "floor_oak_bedroom": 3,
}
for name, k in STRENGTH.items():
    im = Image.open(os.path.join(T, name + ".jpg")).convert("L")
    if im.width > 1024:
        im = im.resize((1024, 1024), Image.LANCZOS)
    h = np.asarray(im.filter(ImageFilter.GaussianBlur(1.1)), np.float32) / 255.0
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    n = np.dstack([-dx * k * 10, dy * k * 10, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8)).save(os.path.join(T, name + "_n.jpg"), quality=92)
    print("wrote", name + "_n.jpg")
