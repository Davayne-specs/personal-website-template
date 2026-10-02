#!/usr/bin/env python3
"""Render the Spot Valley Road 50 edit on your own computer, in one command.

    python tools/render_spot_valley.py              # full quality → out/spot_valley.mp4
    python tools/render_spot_valley.py --preview    # quick 540x960 draft first
    python tools/render_spot_valley.py --video ~/Downloads/videoplayback-2.mp4 --wav ~/Downloads/edit_spot_valley.wav

It finds the two files you need, whatever they ended up being called, in Downloads,
Desktop, Documents and Movies:
  - the soundtrack you were sent (edit_spot_valley.wav: a WAV about 2:00.5 long)
  - the scenepack preview video (an .mp4/.mov that is 640x360 and about 54 s long)
then copies the soundtrack into song/, rebuilds clips/v2/P01–P18 from the video, and
renders. Pass --video / --wav if they live somewhere else.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEARCH = ["Downloads", "Desktop", "Documents", "Movies"]
WAV_DUR = 120.53          # length of the edited soundtrack (s)
VIDEO = (640, 360, 54.17)  # the scenepack preview: width, height, seconds
VIDEO_EXTS = (".mp4", ".mov", ".m4v", ".webm", ".mkv")


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format",
                          "-show_streams", path], capture_output=True, text=True)
    if out.returncode:
        return None
    info = json.loads(out.stdout or "{}")
    dur = float(info.get("format", {}).get("duration") or 0)
    v = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), None)
    return {"dur": dur, "w": v and v.get("width"), "h": v and v.get("height")}


def candidates(exts, max_mb):
    home = os.path.expanduser("~")
    for top in SEARCH:
        base = os.path.join(home, top)
        for dirpath, dirnames, filenames in os.walk(base):
            depth = dirpath[len(base):].count(os.sep)
            dirnames[:] = [d for d in dirnames if not d.startswith(".") and depth < 3
                           and d not in ("node_modules", "Library")]
            for f in filenames:
                p = os.path.join(dirpath, f)
                if f.lower().endswith(exts) and os.path.getsize(p) < max_mb * 1e6:
                    yield p


def is_wav(path):
    info = probe(path)
    return info is not None and abs(info["dur"] - WAV_DUR) < 0.3


def is_preview(path):
    info = probe(path)
    return (info is not None and (info["w"], info["h"]) == VIDEO[:2]
            and abs(info["dur"] - VIDEO[2]) < 1.0)


def find(kind, given, test, exts, max_mb, prefer):
    if given:
        path = os.path.expanduser(given)
        if not os.path.exists(path):
            sys.exit(f"{kind}: {path} doesn't exist")
        if not test(path):
            sys.exit(f"{kind}: {path} isn't the right file (check it's the one you were sent)")
        return path
    found = sorted(candidates(exts, max_mb), key=lambda p: prefer not in os.path.basename(p).lower())
    for p in found:
        if test(p):
            return p
    sys.exit(f"Couldn't find the {kind} in {', '.join('~/' + s for s in SEARCH)}.\n"
             f"Run again with --{'wav' if kind == 'soundtrack' else 'video'} /path/to/the/file")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--video", help="the scenepack preview video (videoplayback-2.mp4)")
    ap.add_argument("--wav", help="the soundtrack you were sent (edit_spot_valley.wav)")
    ap.add_argument("--preview", action="store_true", help="quick 540x960 draft")
    ap.add_argument("--rebuild-clips", action="store_true", help="re-cut clips/v2 even if present")
    args = ap.parse_args()

    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            sys.exit(f"{tool} isn't installed. On a Mac: brew install ffmpeg   (then run this again)")

    os.chdir(ROOT)
    edl = os.path.join("edl", "spot_valley.json")
    if not os.path.exists(edl):
        sys.exit("edl/spot_valley.json is missing: update the project first "
                 "(git pull origin claude/serene-hopper-mmnd3c)")

    # 1. soundtrack
    wav = os.path.join("song", "edit_spot_valley.wav")
    if args.wav or not (os.path.exists(wav) and is_wav(wav)):
        src = find("soundtrack", args.wav, is_wav, (".wav",), 200, "spot_valley")
        os.makedirs("song", exist_ok=True)
        shutil.copyfile(src, wav)
        print(f"soundtrack: {src} → {wav}")
    else:
        print(f"soundtrack: {wav} (already in place)")

    # 2. clips
    clips = [os.path.join("clips", "v2", f"P{i:02d}.mp4") for i in range(1, 19)]
    if args.video or args.rebuild_clips or not all(os.path.exists(c) for c in clips):
        src = find("preview video", args.video, is_preview, VIDEO_EXTS, 60, "videoplayback")
        print(f"clips: cutting the 18 shots out of {src}")
        subprocess.run([sys.executable, os.path.join("tools", "extract_preview_clips.py"), src], check=True)
    else:
        print("clips: clips/v2/P01–P18 (already in place)")

    # 3. render
    out = os.path.join("out", "spot_valley_preview.mp4" if args.preview else "spot_valley.mp4")
    cmd = [sys.executable, "render.py", edl, "--out", out] + (["--preview"] if args.preview else [])
    print("rendering (a full render takes several minutes)…\n")
    code = subprocess.run(cmd).returncode
    if code:
        sys.exit(code)
    print(f"\nDone: {os.path.join(ROOT, out)}")
    if sys.platform == "darwin":
        print(f"Open it with:  open \"{os.path.join(ROOT, out)}\"")


if __name__ == "__main__":
    main()
