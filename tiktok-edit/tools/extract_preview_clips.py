#!/usr/bin/env python3
"""Rebuild clips/v2/P01–P18.mp4 from the scenepack preview video.

    python tools/extract_preview_clips.py /path/to/videoplayback-2.mp4

The preview ("Lamine Yamal scenepack 4K 2026", 640x360, 54 s) plays each clip in a
148x186 window at x=272, y=43 of a screen recording. This crops that window and cuts
it into the 18 shots by exact frame number, reproducing the clips the edit was cut
from, so every in-point in edl/spot_valley.json lines up.
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WINDOW = "crop=148:186:272:43"
# (first frame, frame count) of each shot inside the preview, 30 fps; one frame is
# dropped at each shot change so no frame of a neighbouring shot leaks in
SHOTS = [(358, 73), (433, 49), (484, 43), (529, 49), (580, 55), (637, 58), (697, 68), (767, 60),
         (829, 63), (895, 65), (962, 46), (1010, 27), (1039, 48), (1090, 45), (1138, 29),
         (1169, 40), (1211, 37), (1250, 43)]


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    out_dir = os.path.join(ROOT, "clips", "v2")
    os.makedirs(out_dir, exist_ok=True)
    for i, (first, n) in enumerate(SHOTS, 1):
        out = os.path.join(out_dir, f"P{i:02d}.mp4")
        vf = f"{WINDOW},trim=start_frame={first}:end_frame={first + n},setpts=PTS-STARTPTS"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", vf, "-c:v", "libx264", "-crf", "10",
                        "-preset", "slow", "-pix_fmt", "yuv420p", "-an", out], check=True)
        print(f"P{i:02d}  frames {first}–{first + n - 1}  → {os.path.relpath(out, ROOT)}")


if __name__ == "__main__":
    main()
