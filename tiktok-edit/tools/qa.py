#!/usr/bin/env python3
"""Checks for an edit before it goes to the user.

    python tools/qa.py sync edl/<slug>_main.json          # do the beats hit the cuts? (per section)
    python tools/qa.py grid analysis/<slug>_beatmap.json  # is the beat grid right across the whole song?
    python tools/qa.py crops edl/<slug>_main.json --sheet out/<slug>_crops.jpg   # is the subject in every crop?

sync/grid fold the audio's loudness envelope around every cut (or beat) and report
where the attack (steepest rise) lands: positive = the sound hits after the cut.
Viewers accept sound up to ~45 ms early or ~125 ms late; aim for -20..+40 ms.
A grid whose offset drifts between the start and end of the song has the wrong tempo.
"""
import argparse
import json
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 22050
OK_LO, OK_HI = -0.045, 0.060


def load_audio(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32)
    return np.sqrt(np.convolve(x ** 2, np.ones(22) / 22, mode="same"))        # ~1 ms RMS envelope


def attack_offset(env, times):
    """Steepest rise of the envelope averaged around `times` (s), searched in -80..+100 ms."""
    offs = np.arange(-0.08, 0.10, 0.002)
    times = [t for t in times if 0.1 < t < len(env) / SR - 0.15]
    if len(times) < 3:
        return None, 0.0
    t = np.array(times)
    prof = np.array([env[((t + o) * SR).astype(int)].mean() for o in offs])
    d = np.diff(prof)
    k = int(np.argmax(d))
    sharp = float(d[k] / (prof.mean() or 1))                                  # how clear the attack is
    return float(offs[k] + 0.001), sharp


def path_of(p):
    return p if os.path.isabs(p) else os.path.join(ROOT, p)


def verdict(o):
    return "ok" if o is not None and OK_LO <= o <= OK_HI else "CHECK"


def cmd_sync(a):
    edl = json.load(open(path_of(a.edl)))
    env = load_audio(path_of(edl["meta"]["song"]))
    shots = edl["shots"][1:]                                                 # cut points (not t=0)
    o, sh = attack_offset(env, [s["start"] for s in shots])
    print(f"{a.edl}: {len(shots)} cuts, attack {o * 1000:+.0f} ms after the cut (clarity {sh:.2f}) -> {verdict(o)}")
    secs = {}
    for s in shots:
        secs.setdefault(s.get("section", "?"), []).append(s["start"])
    bad = 0
    for name, ts in secs.items():
        o2, sh2 = attack_offset(env, ts)
        if o2 is None:
            txt = "too few cuts"
        else:
            txt = f"{o2 * 1000:+4.0f} ms (clarity {sh2:.2f}) {verdict(o2)}"
            if verdict(o2) != "ok" and sh2 >= 0.3:
                bad += 1
                txt += f"  -> plan nudge for '{name}': {o2 - 0.010:+.3f}" + (
                    "  (add to any current nudge)" if "nudge" in json.dumps(edl["meta"].get("audio_plan", {})) else "")
            elif verdict(o2) != "ok":
                txt += "  (weak beat here: drum-less? judge by ear)"
        print(f"  {name:16} {len(ts):3d} cuts  {txt}")
    return 0 if verdict(o) == "ok" and not bad else 1


def cmd_grid(a):
    """Attack offset per 8-bar window; windows without a clear beat (drum-less intros, bridges) are
    ignored, and the trend across the rest shows whether the tempo holds for the whole song."""
    bm = json.load(open(path_of(a.beatmap)))
    env = load_audio(path_of(bm["song"]))
    beats = np.arange(bm["first_beat"], bm["duration"], bm["beat"])
    rows = []
    for k in range(0, len(beats), 32):
        w = beats[k:k + 32]
        o, sh = attack_offset(env, w)
        if o is not None:
            rows.append((float(w[0]), o, sh))
    clear = [r for r in rows if r[2] >= 0.5 * np.median([r[2] for r in rows])]
    print(f"{a.beatmap}: {bm['bpm']} BPM; attack vs grid per 8 bars (ms after the beat):")
    for t, o, sh in rows:
        flag = "" if (t, o, sh) in clear else "   (no clear beat, ignored)"
        print(f"  {t:7.2f}s  {o * 1000:+5.0f} ms  clarity {sh:.2f}{flag}")
    if len(clear) < 2:
        print("  too few clear windows to judge")
        return 1
    ts, os_ = np.array([r[0] for r in clear]), np.array([r[1] for r in clear])
    slope = np.polyfit(ts, os_, 1)[0] if len(clear) > 2 else (os_[-1] - os_[0]) / (ts[-1] - ts[0])
    drift = slope * (ts[-1] - ts[0])
    mean = float(np.median(os_))
    print(f"  typical {mean * 1000:+.0f} ms, trend {drift * 1000:+.0f} ms from first to last clear window")
    if abs(drift) > 0.03:
        fix = bm["bpm"] * (1 - slope)
        print(f"  the beats drift {drift * 1000:+.0f} ms over the song. If the drift is gradual the tempo is off:\n"
              f"  rerun beatgrid.py with --bpm {fix:.3f}. If one window jumps, that stretch is shifted\n"
              f"  (spliced or live-played audio): avoid it, or plan around it with a segment there.")
        return 1
    if not (OK_LO <= mean <= OK_HI):
        print(f"  the phase is off by {mean * 1000:+.0f} ms: set the plan's audio_delay to {-mean:.3f}")
        return 1
    print("  steady: tempo and phase hold across the song")
    return 0


def cmd_crops(a):
    from PIL import Image, ImageDraw
    edl = json.load(open(path_of(a.edl)))
    video = a.video or os.path.join(ROOT, "out", os.path.splitext(os.path.basename(a.edl))[0] + ".mp4")
    rows = []
    for s in edl["shots"]:
        if s.get("fit", "crop") != "crop" or not os.path.exists(path_of(s.get("clip", ""))):
            continue
        ims = []
        for f in (0.1, 0.5, 0.9):
            t = s["start"] + f * (s["end"] - s["start"])
            raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", video, "-frames:v", "1",
                                  "-vf", "scale=135:240", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                                 capture_output=True, check=True).stdout
            ims.append(Image.frombytes("RGB", (135, 240), raw))
        row = Image.new("RGB", (3 * 137 + 40, 258), (15, 15, 15))
        for i, im in enumerate(ims):
            row.paste(im, (i * 137, 16))
        ImageDraw.Draw(row).text((2, 1), f"{s['id']} {s.get('moment', '')} x={s.get('focus_x')}", fill=(255, 220, 0))
        rows.append(row)
    if not rows:
        print("no crop shots with a clip on disk")
        return 1
    per_row = 6
    W, H = rows[0].width, rows[0].height
    sheet = Image.new("RGB", (per_row * W, ((len(rows) + per_row - 1) // per_row) * H), (0, 0, 0))
    for i, r in enumerate(rows):
        sheet.paste(r, ((i % per_row) * W, (i // per_row) * H))
    sheet.save(a.sheet, quality=85)
    print(f"{len(rows)} crop shots (start/middle/end frames) -> {a.sheet}")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0], epilog=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("sync"); p.add_argument("edl")
    p = sub.add_parser("grid"); p.add_argument("beatmap")
    p = sub.add_parser("crops"); p.add_argument("edl"); p.add_argument("--video"); p.add_argument("--sheet", required=True)
    a = ap.parse_args()
    sys.exit({"sync": cmd_sync, "grid": cmd_grid, "crops": cmd_crops}[a.cmd](a))


if __name__ == "__main__":
    main()
