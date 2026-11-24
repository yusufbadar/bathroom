"""Bake the tileable surface textures used by the 3D tour.

Run:  python3 tools/make_textures.py
Writes JPGs into ./textures. Each texture covers a known physical size
(see TEXTURE_SIZES_FT in js/tour.js) so tiles render at true scale.
"""
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "textures")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)
random.seed(7)


def smooth_noise(h, w, scale, octaves=4, seed=0):
    """Tileable fractal value noise in [0,1]."""
    r = np.random.default_rng(abs(int(seed)))
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        gh = max(2, int(h / scale * 2 ** o))
        gw = max(2, int(w / scale * 2 ** o))
        g = r.random((gh, gw)).astype(np.float32)
        img = Image.fromarray((g * 255).astype(np.uint8))
        # wrap-pad so the upscaled noise tiles seamlessly
        big = Image.new("L", (gw * 3, gh * 3))
        for i in range(3):
            for j in range(3):
                big.paste(img, (i * gw, j * gh))
        big = big.resize((w * 3, h * 3), Image.BICUBIC)
        arr = np.asarray(big, np.float32)[h:2 * h, w:2 * w] / 255.0
        out += arr * amp
        tot += amp
        amp *= 0.5
    return out / tot


def save(arr, name, q=90):
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name), quality=q)
    print("wrote", name)


def colorize(base_rgb, field, strength):
    base = np.array(base_rgb, np.float32)[None, None, :]
    return base * (1 + (field[..., None] - 0.5) * strength)


# ---------------------------------------------------------------- greige 24x48 large-format porcelain (8 ft square)
def greige():
    N = 2048  # 8 ft -> 256 px/ft
    ppf = N / 8
    n1 = smooth_noise(N, N, 220, 5, 1)
    n2 = smooth_noise(N, N, 40, 3, 2)
    img = colorize((198, 189, 176), n1 * 0.7 + n2 * 0.3, 0.12)
    # fine speckle
    img += (rng.random((N, N, 1)) - 0.5) * 6
    tw, th = int(2 * ppf), int(4 * ppf)  # long side along v (parallel to vanity)
    for cx in range(0, N, tw):
        for cy in range(0, N, th):
            img[cy:cy + th, cx:cx + tw] *= 1 + rng.uniform(-0.025, 0.025)
    grout = np.array((166, 157, 145), np.float32)
    g = 3
    for cx in range(0, N, tw):
        img[:, cx:cx + g] = grout
    for cy in range(0, N, th):
        img[cy:cy + g, :] = grout
    save(img, "floor_greige.jpg")


# ---------------------------------------------------------------- graphite concrete 32x32 (8 ft square)
def graphite():
    N = 2048
    ppf = N / 8
    n1 = smooth_noise(N, N, 160, 5, 3)
    n2 = smooth_noise(N, N, 18, 2, 4)
    img = colorize((92, 92, 90), n1 * 0.75 + n2 * 0.25, 0.28)
    img += (rng.random((N, N, 1)) - 0.5) * 8
    t = int(N / 3)
    for cx in range(0, N, t):
        for cy in range(0, N, t):
            img[cy:cy + t, cx:cx + t] *= 1 + rng.uniform(-0.04, 0.04)
    grout = np.array((70, 70, 69), np.float32)
    for c in range(0, N, t):
        img[:, c:c + 2] = grout
        img[c:c + 2, :] = grout
    save(img, "floor_graphite.jpg")


# ---------------------------------------------------------------- vein-cut stone (the existing material)
def vein_field(h, w, seed):
    r = np.random.default_rng(abs(int(seed)))
    y = np.arange(h, dtype=np.float32)[:, None]
    x = np.arange(w, dtype=np.float32)[None, :]
    wob = smooth_noise(h, w, 180, 3, seed) * 14
    f = np.zeros((h, w), np.float32)
    for _ in range(26):
        freq = r.uniform(0.02, 0.35)
        ph = r.uniform(0, 6.28)
        f += np.sin((y + wob) * freq + ph + x * r.uniform(-0.0015, 0.0015)) * r.uniform(0.2, 1.0) / (1 + freq * 3)
    f = (f - f.min()) / (f.max() - f.min())
    f = f ** 1.4
    return f


def vein_tiles(N, tile_w_px, tile_h_px, stagger, base, light, seed, grout_rgb, horizontal=True):
    """Tiles of vein-cut stone; veins run along the tile's long side."""
    img = np.zeros((N, N, 3), np.float32)
    rows = range(0, N, tile_h_px)
    for ri, cy in enumerate(rows):
        off = int(tile_w_px * stagger) if ri % 2 else 0
        for cx in range(-tile_w_px, N + tile_w_px, tile_w_px):
            x0 = cx + off
            f = vein_field(tile_h_px, tile_w_px, seed + ri * 31 + cx)
            dark = np.array(base, np.float32)
            lite = np.array(light, np.float32)
            t = dark[None, None] * (1 - f[..., None]) + lite[None, None] * f[..., None]
            t *= 1 + rng.uniform(-0.05, 0.05)
            xs0, xs1 = max(0, x0), min(N, x0 + tile_w_px)
            if xs1 <= xs0:
                continue
            img[cy:cy + tile_h_px, xs0:xs1] = t[: min(tile_h_px, N - cy), xs0 - x0: xs1 - x0]
    g = np.array(grout_rgb, np.float32)
    for ri, cy in enumerate(rows):
        img[cy:cy + 2, :] = g
        off = int(tile_w_px * stagger) if ri % 2 else 0
        for cx in range(off % tile_w_px, N, tile_w_px):
            img[cy:cy + tile_h_px, cx:cx + 2] = g
    img += (rng.random((N, N, 1)) - 0.5) * 5
    if not horizontal:
        img = np.transpose(img, (1, 0, 2))
    return img


def original_floor():
    # 12x24 tiles, long side along the vanity, half-offset. 8 ft square.
    N = 2048
    ppf = N / 8
    img = vein_tiles(N, int(2 * ppf), int(1 * ppf), 0.5, (150, 146, 140), (205, 201, 194), 11, (170, 166, 160), horizontal=False)
    save(img, "floor_original.jpg")


def shower_wall():
    # 12x24 vein-cut, horizontal, offset. 8 ft square.
    N = 2048
    ppf = N / 8
    img = vein_tiles(N, int(2 * ppf), int(1 * ppf), 0.33, (156, 149, 140), (214, 208, 199), 21, (178, 172, 164))
    save(img, "wall_veincut.jpg")


def shower_wall_warm():
    N = 2048
    ppf = N / 8
    img = vein_tiles(N, int(2 * ppf), int(1 * ppf), 0.33, (170, 160, 147), (222, 214, 202), 21, (186, 178, 166))
    save(img, "wall_veincut_warm.jpg")


def mosaic_original():
    # small vein-cut strips (approx 2x6") random stagger, 4 ft square
    N = 1024
    ppf = N / 4
    w, h = int(0.5 * ppf), int(1 / 6 * ppf)
    img = np.zeros((N, N, 3), np.float32)
    for cy in range(0, N, h):
        off = random.randint(0, w)
        for cx in range(-w, N, w):
            x0 = cx + off
            c = rng.uniform(0.75, 1.15)
            f = vein_field(h, w, cx * 7 + cy)
            t = (np.array((150, 146, 140))[None, None] * (1 - f[..., None]) + np.array((210, 205, 198))[None, None] * f[..., None]) * c
            xs0, xs1 = max(0, x0), min(N, x0 + w)
            if xs1 > xs0:
                img[cy:cy + h, xs0:xs1] = t[: min(h, N - cy), xs0 - x0: xs1 - x0]
            if 0 <= x0 < N:
                img[cy:cy + h, x0:x0 + 2] = (120, 116, 110)
        img[cy:cy + 2, :] = (120, 116, 110)
    save(img, "shower_mosaic_original.jpg")


def shower_greige():
    # 12x24 greige pieces for the new shower floor, 4 ft square
    N = 1024
    ppf = N / 4
    n1 = smooth_noise(N, N, 120, 5, 9)
    img = colorize((200, 191, 178), n1, 0.13)
    img += (rng.random((N, N, 1)) - 0.5) * 6
    tw, th = int(2 * ppf), int(1 * ppf)
    for cy in range(0, N, th):
        img[cy:cy + 2, :] = (176, 167, 155)
    for cx in range(0, N, tw):
        img[:, cx:cx + 2] = (176, 167, 155)
    save(img, "shower_greige.jpg")


# ---------------------------------------------------------------- oak (herringbone + bedroom straight plank)
def plank_img(L, W, seed, tone):
    r = np.random.default_rng(abs(int(seed)))
    y = np.arange(W, dtype=np.float32)[:, None]
    x = np.arange(L, dtype=np.float32)[None, :]
    wob = smooth_noise(W, L, 60, 2, seed) * 6
    f = np.zeros((W, L), np.float32)
    for _ in range(14):
        fr = r.uniform(0.15, 0.9)
        f += np.sin((y + wob + x * r.uniform(-0.01, 0.01)) * fr + r.uniform(0, 6)) * r.uniform(0.3, 1) / (1 + fr)
    f = (f - f.min()) / (f.max() - f.min() + 1e-6)
    base = np.array(tone, np.float32)
    k = r.uniform(0.88, 1.1)
    p = base[None, None] * (0.86 + 0.24 * f[..., None]) * k
    p += (r.random((W, L, 1)) - 0.5) * 6
    return Image.fromarray(np.clip(p, 0, 255).astype(np.uint8))


def herringbone():
    # 6" x 36" planks (n = 6), rotated 45 deg. Period = 6*sqrt2*plank width.
    N = 2048
    n = 6
    w = N / (n * math.sqrt(2))  # plank width in px
    canvas = Image.new("RGB", (N, N), (120, 90, 60))
    ang = math.radians(45)
    ca, sa = math.cos(ang), math.sin(ang)

    def rot(px, py):
        return (px * ca - py * sa) * w + N / 2, (px * sa + py * ca) * w + N / 2

    planks = []
    R = 26
    for k in range(-R, R):  # band shift (1,-1)
        for s in range(-R // 2, R // 2):  # staircase step (n,n)
            bx, by = k + s * n, -k + s * n
            planks.append((bx, by, n, 1))            # horizontal plank
            planks.append((bx + n - 1, by + 1, 1, n))  # vertical plank
    seed = 0
    for (x0, y0, ww, hh) in planks:
        corners = [rot(x0, y0), rot(x0 + ww, y0), rot(x0 + ww, y0 + hh), rot(x0, y0 + hh)]
        xs = [c[0] for c in corners]
        ys = [c[1] for c in corners]
        if max(xs) < -w * 8 or min(xs) > N + w * 8 or max(ys) < -w * 8 or min(ys) > N + w * 8:
            continue
        seed += 1
        Lp, Wp = int(round(n * w)), int(round(w))
        pl = plank_img(Lp, Wp, seed, (196, 158, 116))
        if hh > ww:
            pl = pl.rotate(90, expand=True)
        rot_img = pl.rotate(-45, expand=True, resample=Image.BICUBIC)
        mask = Image.new("L", pl.size, 255).rotate(-45, expand=True)
        cx, cy = sum(xs) / 4, sum(ys) / 4
        canvas.paste(rot_img, (int(round(cx - rot_img.width / 2)), int(round(cy - rot_img.height / 2))), mask)
    # seams
    d = ImageDraw.Draw(canvas)
    for (x0, y0, ww, hh) in planks:
        corners = [rot(x0, y0), rot(x0 + ww, y0), rot(x0 + ww, y0 + hh), rot(x0, y0 + hh)]
        if max(c[0] for c in corners) < -50 or min(c[0] for c in corners) > N + 50:
            continue
        d.polygon(corners, outline=(96, 72, 48))
    arr = np.asarray(canvas, np.float32)
    save(arr, "floor_herringbone.jpg")


def bedroom_oak():
    N = 1024  # 4 ft square, 5" planks
    canvas = Image.new("RGB", (N, N))
    pw = int(N / 4 * 5 / 12)
    y = 0
    s = 100
    while y < N:
        x = -random.randint(0, N)
        while x < N:
            L = random.randint(N // 2, N)
            s += 1
            canvas.paste(plank_img(L, pw, s, (172, 118, 70)), (x, y))
            ImageDraw.Draw(canvas).line([(x, y), (x, y + pw)], fill=(110, 72, 40), width=2)
            x += L
        ImageDraw.Draw(canvas).line([(0, y), (N, y)], fill=(110, 72, 40), width=2)
        y += pw
    save(np.asarray(canvas, np.float32), "floor_oak_bedroom.jpg")


def window_view():
    W, H = 512, 768
    sky = np.zeros((H, W, 3), np.float32)
    t = np.linspace(0, 1, H)[:, None]
    sky[:] = (np.array((205, 225, 240)) * (1 - t) + np.array((235, 240, 238)) * t)[:, None, :] if False else 0
    for i in range(H):
        sky[i, :] = np.array((200, 222, 240)) * (1 - i / H) + np.array((236, 240, 236)) * (i / H)
    leaves = smooth_noise(H, W, 40, 4, 33)
    m = np.clip((leaves - 0.42) * 4, 0, 1)[..., None]
    green = colorize((88, 128, 72), smooth_noise(H, W, 12, 2, 34), 0.6)
    img = sky * (1 - m) + green * m
    # outdoors is out of focus from inside the room
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(9))
    save(np.asarray(im, np.float32) * 0.92 + 20, "window_view.jpg")


if __name__ == "__main__":
    greige()
    graphite()
    original_floor()
    shower_wall()
    shower_wall_warm()
    mosaic_original()
    shower_greige()
    herringbone()
    bedroom_oak()
    window_view()


# ---------------------------------------------------------------- concept materials
def ivory():
    N = 2048  # 8 ft, 24x24 tiles
    ppf = N / 8
    n1 = smooth_noise(N, N, 260, 5, 41)
    n2 = smooth_noise(N, N, 30, 3, 42)
    img = colorize((228, 219, 203), n1 * 0.75 + n2 * 0.25, 0.10)
    img += (rng.random((N, N, 1)) - 0.5) * 5
    t = int(2 * ppf)
    for cx in range(0, N, t):
        for cy in range(0, N, t):
            img[cy:cy + t, cx:cx + t] *= 1 + rng.uniform(-0.02, 0.02)
    for c in range(0, N, t):
        img[:, c:c + 2] = (200, 190, 175)
        img[c:c + 2, :] = (200, 190, 175)
    save(img, "floor_ivory.jpg")


def terrazzo():
    N = 2048  # 8 ft, 24x24
    ppf = N / 8
    img = colorize((236, 232, 224), smooth_noise(N, N, 200, 4, 51), 0.05)
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    cols = [(196, 190, 180), (150, 146, 140), (196, 120, 84), (150, 170, 140), (120, 116, 110), (220, 205, 180)]
    for _ in range(5200):
        x, y = random.uniform(0, N), random.uniform(0, N)
        r = random.choice([2, 3, 3, 4, 5, 6, 8, 11])
        c = random.choice(cols)
        pts = [(x + r * math.cos(a) * random.uniform(.6, 1.3), y + r * math.sin(a) * random.uniform(.6, 1.3)) for a in np.linspace(0, 6.28, random.randint(4, 7), endpoint=False)]
        d.polygon(pts, fill=c)
    img = np.asarray(im, np.float32)
    t = int(2 * ppf)
    for c in range(0, N, t):
        img[:, c:c + 2] = (205, 200, 192)
        img[c:c + 2, :] = (205, 200, 192)
    save(img, "floor_terrazzo.jpg")


def mosaic_taupe():
    # fine organic micro-pattern stone mosaic, 2 ft square
    N = 1024
    base = colorize((196, 182, 166), smooth_noise(N, N, 120, 4, 61), 0.12)
    im = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    for _ in range(1800):
        x, y = random.uniform(0, N), random.uniform(0, N)
        L = random.uniform(10, 26)
        a = random.uniform(0, 6.28)
        d.line([(x, y), (x + L * math.cos(a), y + L * math.sin(a))], fill=(226, 216, 202), width=2)
    for _ in range(700):
        x, y = random.uniform(0, N), random.uniform(0, N)
        r = random.uniform(3, 7)
        d.arc([x - r, y - r, x + r, y + r], random.uniform(0, 300), 360, fill=(170, 156, 140), width=2)
    save(np.asarray(im, np.float32), "mosaic_taupe.jpg")


def vertical_stack(name, base, var, tw_in, th_in, glossy_edge, size_ft=4, seed=0):
    N = 1024
    ppf = N / size_ft
    tw, th = int(tw_in / 12 * ppf), int(th_in / 12 * ppf)
    r = np.random.default_rng(seed)
    img = np.zeros((N, N, 3), np.float32)
    for cx in range(0, N, tw):
        for cy in range(0, N, th):
            c = np.array(base, np.float32) * (1 + r.uniform(-var, var))
            f = smooth_noise(th, tw, 14, 2, int(r.integers(1e6)))
            tile = c[None, None] * (0.93 + 0.12 * f[..., None])
            # glazed pooling at edges
            yy, xx = np.mgrid[0:th, 0:tw]
            edge = np.minimum(np.minimum(xx, tw - 1 - xx), np.minimum(yy, th - 1 - yy)).astype(np.float32)
            tile *= (1 - glossy_edge * np.exp(-edge / 3.0))[..., None]
            img[cy:cy + th, cx:cx + tw] = tile[: N - cy, : N - cx]
    g = np.array(base, np.float32) * 0.82
    for cx in range(0, N, tw):
        img[:, cx:cx + 2] = g
    for cy in range(0, N, th):
        img[cy:cy + 2, :] = g
    save(img, name)


def oak_fluted():
    # vertical reeds ~3/4" wide on rift white oak, 2 ft square
    N = 1024
    ppf = N / 2
    p = np.asarray(plank_img(N, N, 77, (190, 152, 108)).rotate(90), np.float32)
    x = np.arange(N, dtype=np.float32)
    reed = 0.75 / 12 * ppf
    shade = 0.78 + 0.3 * np.sin((x % reed) / reed * math.pi)
    save(p * shade[None, :, None], "oak_fluted.jpg")


def shades():
    # linen roman shade with subtle woven abstract pattern
    W, H = 512, 512
    n = smooth_noise(H, W, 6, 2, 81)
    img = colorize((214, 202, 184), n, 0.18)
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    for _ in range(260):
        x, y = random.uniform(0, W), random.uniform(0, H)
        d.line([(x, y), (x + random.uniform(-30, 30), y + random.uniform(-30, 30))], fill=(160, 146, 126), width=2)
    for k in range(0, H, 128):  # fold shadows
        d.rectangle([0, k + 118, W, k + 128], fill=(170, 158, 140))
    save(np.asarray(im, np.float32), "shade_linen.jpg")
    # bamboo
    img = np.zeros((H, W, 3), np.float32)
    for y in range(0, H, 8):
        c = np.array((176, 140, 92)) * random.uniform(0.85, 1.1)
        img[y:y + 7] = c
        img[y + 7:y + 8] = (110, 84, 52)
    for x in (110, 400):
        img[:, x:x + 4] = (90, 70, 44)
    save(img, "shade_bamboo.jpg")
    img = colorize((242, 240, 234), smooth_noise(H, W, 8, 2, 83), 0.06)
    for k in range(0, H, 128):
        img[k + 116:k + 128] *= 0.9
    save(img, "shade_sheer.jpg")


def runner():
    W, H = 512, 1536
    img = colorize((196, 184, 168), smooth_noise(H, W, 20, 2, 91), 0.1)
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    for y in range(0, H, 40):
        for x in range(0, W, 40):
            d.arc([x, y, x + 40, y + 40], 0, 180, fill=(140, 126, 110), width=3)
    d.rectangle([0, 0, W - 1, H - 1], outline=(150, 136, 120), width=18)
    save(np.asarray(im, np.float32), "rug_runner.jpg")


if __name__ == "__main__":
    ivory()
    terrazzo()
    mosaic_taupe()
    vertical_stack("zellige_white.jpg", (238, 233, 222), 0.05, 2, 8, 0.18, seed=5)
    vertical_stack("tile_sage.jpg", (150, 170, 146), 0.06, 2, 10, 0.25, seed=6)
    oak_fluted()
    shades()
    runner()
