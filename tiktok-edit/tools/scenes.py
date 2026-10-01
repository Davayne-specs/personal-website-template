#!/usr/bin/env python3
"""Break a scene pack into shots, and check a high-quality copy against it.

    python tools/scenes.py split sources/<slug>.mp4 --catalog research/<slug>_scenes.json --sheets out/<slug>_sheets
    python tools/scenes.py tracks sources/<slug>.mp4 --catalog research/<slug>_scenes.json --sheets out/<slug>_sheets
    python tools/scenes.py verify sources/<slug>.mp4 --catalog research/<slug>_scenes.json     # run on the 4K copy

split   detects the hard cuts, writes a draft catalogue (one entry per shot, kind "?"),
        and contact sheets (start / middle / end frame of every shot) to fill it in from.
tracks  for every crop shot, 5 timestamped frames with a tenths ruler (and face boxes when
        OpenCV is installed) to read the subject's horizontal position for focus_x / focus_track.
verify  re-detects the cuts in another copy (e.g. the 4K download) and checks they match the
        catalogue within 2 frames, so an edit planned on the low-quality copy renders the same.
"""
import argparse
import json
import os
import subprocess
import sys

import numpy as np

from editlib import detect_cuts, probe

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def p_(p):
    return p if os.path.isabs(p) else os.path.join(ROOT, p)


def frame_at(video, t, w, h):
    from PIL import Image
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{max(t, 0):.3f}", "-i", video, "-frames:v", "1",
                          "-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True, check=True).stdout
    return Image.frombytes("RGB", (w, h), raw)


def font(size):
    from PIL import ImageFont
    for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "C:/Windows/Fonts/arialbd.ttf"):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def cmd_split(a):
    from PIL import Image, ImageDraw
    video = p_(a.video)
    fps, n, scenes = detect_cuts(video)
    dur, _, w, h = probe(video)
    cat = {"source": os.path.relpath(video, ROOT).replace(os.sep, "/"),
           "fps": round(fps, 3), "size": [w, h], "duration": round(dur, 3), "slowmo_source": False,
           "note": "Fill in per shot: kind (arrival | closeup | action | celebration | sad | skip), desc, and "
                   "framing: fit crop + focus_x (0..1 subject position) or focus_track [[t, x], ...], or fit blurfill "
                   "for wide action. Set slowmo_source true for Twixtor/slow-mo packs (never slowed below 1x).",
           "scenes": {}}
    for k, (f0, f1) in enumerate(scenes):
        cat["scenes"][f"S{k:02d}"] = {"start": round(f0 / fps, 3), "end": round(f1 / fps, 3), "kind": "?",
                                      "fit": "crop", "focus_x": 0.5, "desc": ""}
    os.makedirs(os.path.dirname(p_(a.catalog)), exist_ok=True)
    if os.path.exists(p_(a.catalog)) and not a.force:
        sys.exit(f"{a.catalog} exists (it may hold your notes); pass --force to overwrite")
    with open(p_(a.catalog), "w") as f:
        json.dump(cat, f, indent=1, ensure_ascii=False)
        f.write("\n")

    os.makedirs(p_(a.sheets), exist_ok=True)
    TW, TH = 256, int(256 * h / w)
    F = font(15)
    ids = list(cat["scenes"])
    per_sheet, per_row = 16, 2
    for s0 in range(0, len(ids), per_sheet):
        chunk = ids[s0:s0 + per_sheet]
        rows = (len(chunk) + per_row - 1) // per_row
        sheet = Image.new("RGB", (per_row * (3 * TW + 30), rows * (TH + 24)), (20, 20, 20))
        dr = ImageDraw.Draw(sheet)
        for k, sid in enumerate(chunk):
            sc = cat["scenes"][sid]
            x0, y0 = (k % per_row) * (3 * TW + 30), (k // per_row) * (TH + 24)
            span = sc["end"] - sc["start"]
            for j, t in enumerate((sc["start"] + 0.2, sc["start"] + span / 2, sc["end"] - 0.25)):
                sheet.paste(frame_at(video, t, TW, TH), (x0 + j * TW, y0 + 20))
            dr.text((x0 + 4, y0 + 2), f"{sid}  {sc['start']:.1f}-{sc['end']:.1f}s ({span:.1f}s)", fill=(255, 220, 0), font=F)
        out = os.path.join(p_(a.sheets), f"scenes_{s0 // per_sheet + 1}.jpg")
        sheet.save(out, quality=85)
    lens = [round(s["end"] - s["start"], 1) for s in cat["scenes"].values()]
    print(f"{len(ids)} shots ({fps:.3f} fps, {w}x{h}, {dur:.1f}s); lengths {min(lens)}-{max(lens)}s")
    print(f"wrote {a.catalog} and {(len(ids) + per_sheet - 1) // per_sheet} contact sheet(s) in {a.sheets}")
    long_ = [sid for sid, s in cat["scenes"].items() if s["end"] - s["start"] > 2 * np.median(lens)]
    if long_:
        print(f"check for missed cuts in unusually long shots: {', '.join(long_)}")


def cmd_tracks(a):
    from PIL import Image, ImageDraw
    video = p_(a.video)
    cat = json.load(open(p_(a.catalog)))
    try:
        import cv2
        front = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_alt2.xml")
        prof = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml")
        cap = cv2.VideoCapture(video)
    except Exception:
        cv2 = None
    _, _, w, h = probe(video)
    TW, TH = 240, int(240 * h / w)
    F = font(13)
    ids = [k for k, v in cat["scenes"].items() if v.get("fit") == "crop" and v.get("kind") != "skip"]
    rows = []
    for sid in ids:
        sc = cat["scenes"][sid]
        ts = np.linspace(sc["start"] + 0.1, sc["end"] - 0.1, 5)
        row = Image.new("RGB", (60 + 5 * (TW + 4), TH + 18), (15, 15, 15))
        d = ImageDraw.Draw(row)
        d.text((2, TH // 2 - 8), sid, fill=(255, 220, 0), font=F)
        for i, t in enumerate(ts):
            im = frame_at(video, t, TW, TH)
            di = ImageDraw.Draw(im)
            for x10 in range(1, 10):
                di.line([(x10 * TW / 10, TH - 8), (x10 * TW / 10, TH)], fill=(255, 255, 0) if x10 == 5 else (255, 255, 255))
            if cv2 is not None:
                cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
                ok, fr = cap.read()
                if ok:
                    g = cv2.equalizeHist(cv2.cvtColor(cv2.resize(fr, (1280, 720)), cv2.COLOR_BGR2GRAY))
                    for c, flip in ((front, False), (prof, False), (prof, True)):
                        img = cv2.flip(g, 1) if flip else g
                        for (x, y, bw, bh) in c.detectMultiScale(img, 1.1, 5, minSize=(48, 48)):
                            if flip:
                                x = 1280 - x - bw
                            di.rectangle([x * TW / 1280, y * TH / 720, (x + bw) * TW / 1280, (y + bh) * TH / 720],
                                         outline=(0, 255, 0), width=2)
            row.paste(im, (60 + i * (TW + 4), 16))
            d.text((60 + i * (TW + 4) + 2, 1), f"{t:.1f}s", fill=(200, 200, 200), font=F)
        rows.append(row)
    os.makedirs(p_(a.sheets), exist_ok=True)
    per = 13
    for k in range(0, len(rows), per):
        chunk = rows[k:k + per]
        sheet = Image.new("RGB", (chunk[0].width, sum(r.height for r in chunk)), (0, 0, 0))
        y = 0
        for r in chunk:
            sheet.paste(r, (0, y))
            y += r.height
        sheet.save(os.path.join(p_(a.sheets), f"tracks_{k // per + 1}.jpg"), quality=85)
    print(f"{len(ids)} crop shots -> {(len(rows) + per - 1) // per} track sheet(s) in {a.sheets}"
          + ("" if cv2 is not None else " (no face boxes: pip install \"opencv-python-headless<5\")"))
    print("Read x as (face centre - frame left) / frame width; ruler ticks are tenths, the yellow tick is 0.5.")


def cmd_verify(a):
    video = p_(a.video)
    cat = json.load(open(p_(a.catalog)))
    dur, fps, w, h = probe(video)
    made = (f" (catalogue made on {cat['size'][0]}x{cat['size'][1]}, {cat['fps']} fps, {cat['duration']}s)"
            if cat.get("size") else "")
    print(f"{a.video}: {w}x{h}, {fps:.3f} fps, {dur:.2f}s{made}")
    _, _, scenes = detect_cuts(video)
    found = np.array([f0 / fps for f0, _ in scenes])
    tol = 2.0 / min(fps, cat.get("fps") or fps)
    worst, missing = 0.0, []
    for sid, sc in cat["scenes"].items():
        if sc["start"] < 0.05:
            continue
        dev = float(np.min(np.abs(found - sc["start"])))
        worst = max(worst, dev)
        if dev > tol:
            missing.append(f"{sid} ({sc['start']:.2f}s, nearest cut {dev * 1000:.0f} ms away)")
    if abs(dur - (cat.get("duration") or dur)) > 0.5:
        print(f"  length differs by {dur - cat['duration']:+.2f}s")
    if missing:
        print(f"MISMATCH: {len(missing)} shot start(s) not found in this copy: " + "; ".join(missing[:6]))
        # same shots, just offset? try every shift implied by pairing an early catalogue cut with a found cut
        starts = np.array([sc["start"] for sc in cat["scenes"].values() if sc["start"] >= 0.05])
        shift, hits = 0.0, 0
        for cand in {round(f - t, 3) for t in starts[:5] for f in found}:
            n_ok = int(sum(np.min(np.abs(found - (t + cand))) <= tol for t in starts))
            if n_ok > hits:
                shift, hits = cand, n_ok
        if hits >= 0.9 * len(starts) and shift > 0:
            print(f"  The shots are all there, {shift:.2f}s later than in the planning copy (a longer intro).")
            print(f"  Trim the start to match, then verify again:\n"
                  f"    ffmpeg -ss {shift:.3f} -i <this file> -c:v libx264 -crf 14 -preset slow -c:a copy <trimmed file>")
        elif hits >= 0.9 * len(starts):
            print(f"  The shots are all there, {-shift:.2f}s earlier than in the planning copy: this copy is missing "
                  f"the start. Get the full upload, or re-plan on this copy.")
        else:
            print("  This is probably a different upload/edit of the pack. Use the exact same video, or re-plan on it.")
        sys.exit(1)
    print(f"OK: all {len(cat['scenes'])} shots line up (worst {worst * 1000:.0f} ms). Safe to render with this file.")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0], epilog=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("split"); p.add_argument("video"); p.add_argument("--catalog", required=True)
    p.add_argument("--sheets", required=True); p.add_argument("--force", action="store_true")
    p = sub.add_parser("tracks"); p.add_argument("video"); p.add_argument("--catalog", required=True)
    p.add_argument("--sheets", required=True)
    p = sub.add_parser("verify"); p.add_argument("video"); p.add_argument("--catalog", required=True)
    a = ap.parse_args()
    {"split": cmd_split, "tracks": cmd_tracks, "verify": cmd_verify}[a.cmd](a)


if __name__ == "__main__":
    main()
