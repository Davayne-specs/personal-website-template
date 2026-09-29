"""Storyboard contact sheet: one frame from every scene of a rendered episode, labelled.

    python3 tools/contact_sheet.py episodes/ep02-with-you video/out/with-you-9x16.mp4 video/out/with-you-storyboard.png
"""
import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FPS = 30
LEAD = 0.15
COLS, W, H, BAR = 10, 216, 384, 40
INK, CANDY, COTTON = (35, 27, 46), (242, 165, 192), (251, 243, 234)


def frame_at(t):
    return math.floor(t * FPS + 0.5)  # JavaScript's Math.round, as the timeline uses


def slots(ep):
    """The episode's scene slots, laid out the way video/src/lib/timeline.ts lays them out.

    The storyboard lists slots in screen order, so it says where the title card (n=0) sits
    and whether there is an end card (n=-1).
    """
    timing = json.load(open(ep / "timing.json"))
    board = json.load(open(ep / "storyboard.json"))
    story = {s["n"]: s for s in board}
    order = [s["n"] for s in board]
    total = json.load(open(ep / "audio-features.json"))["frames"]
    title_first = order[0] == 0
    title_after = order[order.index(0) - 1] if 0 in order and not title_first else None
    starts = [(0, 0)] if title_first else []
    for k, ln in enumerate(timing):
        n = k + 1
        starts.append((n, 0 if n == 1 and not title_first else frame_at(ln["start"] - LEAD)))
        if n == title_after:
            starts.append((0, frame_at(ln["end"] + 0.05)))
    if -1 in story:
        starts.append((-1, frame_at(timing[-1]["end"] + 0.35)))
    out = []
    for i, (n, a) in enumerate(starts):
        b = starts[i + 1][1] if i + 1 < len(starts) else total
        out.append((n, a, b, story[n]["tag"]))
    return out


def font(size):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"]:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


if __name__ == "__main__":
    import imageio_ffmpeg

    ep, video, out = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
    ss = slots(ep)
    rows = (len(ss) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * W, rows * (H + BAR)), COTTON)
    d = ImageDraw.Draw(sheet)
    f_num, f_tag = font(15), font(13)
    with tempfile.TemporaryDirectory() as tmp:
        for i, (n, a, b, tag) in enumerate(ss):
            t = (a + (b - a) * 0.62) / FPS
            png = Path(tmp) / f"{i}.png"
            subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-loglevel", "error", "-ss", f"{t:.3f}", "-i", video, "-frames:v", "1", "-y", str(png)], check=True)
            im = Image.open(png).convert("RGB").resize((W, H))
            x, y = (i % COLS) * W, (i // COLS) * (H + BAR)
            sheet.paste(im, (x, y + BAR))
            d.rectangle([x, y, x + W - 1, y + BAR - 1], fill=CANDY)
            d.text((x + 8, y + 4), "Title" if n == 0 else "Fin." if n < 0 else f"No. {n:02d}", fill=INK, font=f_num)
            d.text((x + 8, y + 22), tag[:28], fill=INK, font=f_tag)
    sheet.save(out)
    print(out, sheet.size)
