"""Generate the Sugar & Smoke print textures once (riso grain, watercolour
washes, smoke clouds, gold foil, rubber-stamp mask).

    python3 tools/make_textures.py   # writes video/public/tex/*.png

Everything is seeded, so re-running gives identical files.
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

OUT = Path(__file__).resolve().parent.parent / "video" / "public" / "tex"
OUT.mkdir(parents=True, exist_ok=True)


def hex_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def fractal(shape, seed, octaves=5, base_sigma=64.0, persistence=0.55):
    rng = np.random.default_rng(seed)
    acc = np.zeros(shape, np.float32)
    amp, total, sigma = 1.0, 0.0, base_sigma
    for _ in range(octaves):
        layer = gaussian_filter(rng.standard_normal(shape).astype(np.float32), sigma, mode="wrap")
        layer /= layer.std() + 1e-6
        acc += amp * layer
        total += amp
        amp *= persistence
        sigma /= 2.0
    acc /= total
    acc = (acc - acc.min()) / (acc.max() - acc.min() + 1e-6)
    return acc


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def border_fade(h, w, frac=0.1):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.minimum(np.minimum(xx, w - 1 - xx), np.minimum(yy, h - 1 - yy))
    return smoothstep(0, frac * min(h, w), d)


def save_rgba(rgb, alpha, name):
    arr = np.dstack([np.clip(rgb, 0, 255), np.clip(alpha * 255, 0, 255)]).astype(np.uint8)
    Image.fromarray(arr, "RGBA").save(OUT / name, optimize=True)


def grain():
    """Full-frame riso paper: warm fibres + ink speckle. Used with multiply."""
    h, w = 1920, 1080
    rng = np.random.default_rng(7)
    fine = rng.standard_normal((h, w)).astype(np.float32)
    fine = gaussian_filter(fine, 0.6)
    cloud = fractal((h, w), 11, octaves=4, base_sigma=90) - 0.5
    fibres = gaussian_filter(rng.standard_normal((h, w)).astype(np.float32), (0.5, 7.0))
    lum = 247 + fine * 3.2 + cloud * 7 + fibres * 2.2
    speck = rng.random((h, w)) > 0.9993
    speck = gaussian_filter(speck.astype(np.float32), 0.7) * 5
    lum = lum - np.clip(speck, 0, 1) * 70
    rgb = np.dstack([lum, lum - 2.5, lum - 6.0])
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB").save(OUT / "grain.png", optimize=True)


def wash(name, color, seed, size=1300, strength=0.85):
    """A watercolour wash with soft organic edge, pigment pooling at the rim and granulation."""
    h = w = size
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    base = np.zeros((h, w), np.float32)
    for _ in range(7):
        cx, cy = rng.uniform(0.25, 0.75) * w, rng.uniform(0.25, 0.75) * h
        r = rng.uniform(0.12, 0.26) * w
        base += np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * r * r))
    base /= base.max()
    n = fractal((h, w), seed + 1, octaves=6, base_sigma=110)
    field = base * 0.75 + n * 0.45
    m = smoothstep(0.42, 0.50, field) * border_fade(h, w)
    pool = np.clip(m - gaussian_filter(m, 9), 0, 1)
    body = fractal((h, w), seed + 2, octaves=5, base_sigma=60)
    gran = fractal((h, w), seed + 3, octaves=2, base_sigma=1.4)
    dens = m * (0.45 + 0.4 * body) + pool * 2.2
    dens *= 0.78 + 0.22 * gran
    alpha = np.clip(dens, 0, 1) * strength
    rgb = np.ones((h, w, 3), np.float32) * hex_rgb(color)
    # pigment darkens where it pools
    rgb *= (1 - 0.18 * np.clip(pool * 3, 0, 1))[..., None]
    save_rgba(rgb, alpha, name)


def smoke(name, seed, w=1000, h=760):
    """Grey watercolour smoke, like the single's cover: puffy, speckled, darker at the rim."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    base = np.zeros((h, w), np.float32)
    for _ in range(11):
        cx, cy = rng.uniform(0.2, 0.8) * w, rng.uniform(0.3, 0.7) * h
        r = rng.uniform(0.08, 0.17) * w
        base += np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * r * r))
    base /= base.max()
    n = fractal((h, w), seed + 5, octaves=6, base_sigma=70)
    field = base * 0.8 + n * 0.4
    m = smoothstep(0.40, 0.52, field) * border_fade(h, w)
    pool = np.clip(m - gaussian_filter(m, 7), 0, 1)
    body = fractal((h, w), seed + 6, octaves=5, base_sigma=40)
    blotch = smoothstep(0.45, 0.8, fractal((h, w), seed + 7, octaves=4, base_sigma=55))
    dens = m * (0.28 + 0.5 * body + 0.35 * blotch) + pool * 1.8
    cluster = smoothstep(0.55, 0.85, fractal((h, w), seed + 8, octaves=3, base_sigma=45))
    speck = (rng.random((h, w)) > 0.994 - 0.02 * cluster).astype(np.float32)
    speck = gaussian_filter(speck, 0.9) * 5 * m * (0.25 + cluster)
    alpha = np.clip(dens * 0.8 + speck, 0, 1)
    grey = hex_rgb("#A7B0B2")
    rgb = np.ones((h, w, 3), np.float32) * grey
    rgb *= (1 - 0.35 * np.clip(pool * 2 + speck, 0, 1))[..., None]
    save_rgba(rgb, alpha, name)


def foil():
    """Tileable gold foil: mottled crinkle with bright creases."""
    s = 512
    n1 = fractal((s, s), 21, octaves=5, base_sigma=40)
    n2 = fractal((s, s), 22, octaves=4, base_sigma=12)
    crease = np.abs(np.gradient(gaussian_filter(n1, 3, mode="wrap"))[0]) * 40
    t = np.clip(0.55 * n1 + 0.3 * n2 + crease * 0.6, 0, 1)
    lo, mid, hi = hex_rgb("#8C6A2E"), hex_rgb("#C9A15A"), hex_rgb("#F6E1A6")
    t3 = t[..., None]
    rgb = np.where(t3 < 0.5, lo + (mid - lo) * (t3 / 0.5), mid + (hi - mid) * ((t3 - 0.5) / 0.5))
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB").save(OUT / "foil.png", optimize=True)


def stamp_mask():
    """White = ink lands, black = rubber gap. Used as a luminance mask for stamps."""
    h, w = 512, 1024
    rng = np.random.default_rng(31)
    n = fractal((h, w), 32, octaves=5, base_sigma=18)
    coarse = fractal((h, w), 33, octaves=3, base_sigma=80)
    holes = rng.random((h, w)) > 0.985
    holes = gaussian_filter(holes.astype(np.float32), 1.2) * 4
    v = smoothstep(0.18, 0.42, n * 0.7 + coarse * 0.5) - np.clip(holes, 0, 1)
    v = np.clip(v, 0, 1) * 255
    Image.fromarray(v.astype(np.uint8), "L").save(OUT / "stamp-mask.png", optimize=True)


if __name__ == "__main__":
    grain()
    wash("wash-pink-1.png", "#F2A5C0", 101)
    wash("wash-pink-2.png", "#EE8FB2", 102)
    wash("wash-aqua-1.png", "#8ED3C9", 201)
    wash("wash-aqua-2.png", "#9FDCD3", 202)
    wash("wash-gold-1.png", "#E9C77A", 301, strength=0.9)
    for i in range(1, 5):
        smoke(f"smoke-{i}.png", 400 + i)
    foil()
    stamp_mask()
    for p in sorted(OUT.glob("*.png")):
        print(p.name, p.stat().st_size // 1024, "KB")
