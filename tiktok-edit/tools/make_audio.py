#!/usr/bin/env python3
"""Build the edit's soundtrack from bar-aligned pieces of the song.

Reads `meta.audio_plan` from an EDL and writes the file named by `meta.song`.

    python tools/make_audio.py edl/story.json

audio_plan:
    {
      "source": "song/song.mp3",
      "stems": {"vocals": "song/stems/vocals.wav",
                "instrumental": "song/stems/instrumental.wav"},   # optional
      "segments": [
        {"from": 13.027, "to": 47.31,           # song seconds (cut on downbeats)
         "vocals_from": 13.0,                   # optional: start vocals earlier (pickup)
         "vocals_to": 47.85,                    # optional: let a word ring past the cut
         "mute_vocals": [[a, b], ...]}          # optional: silence vocal bleed (song seconds)
      ],
      "gain_db": 1.0,                           # optional: overall gain (song is ~-15 LUFS)
      "delay": 0.05                             # optional: shift the track later (s), same length
    }

With stems, the instrumental is cut hard on the grid (short crossfade) while
vocals can carry a pickup or tail across the splice, so words are never chopped.
Without stems it falls back to crossfading the full mix.
"""
import json
import os
import subprocess
import sys

import numpy as np
import soundfile as sf

XFADE = 0.012       # instrumental crossfade at each splice (s)
VOX_FADE = 0.015    # fade at vocal piece edges (s)
MUTE_RAMP = 0.025   # ramp in/out of muted vocal ranges (s)


def load(path, sr=None):
    if path.lower().endswith((".wav", ".flac")):
        data, rate = sf.read(path, always_2d=True, dtype="float32")
    else:
        rate = sr or 44100
        raw = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(rate), "-"],
            check=True, capture_output=True).stdout
        data = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)
    if sr and rate != sr:
        sys.exit(f"{path}: sample rate {rate} != {sr}; regenerate stems at the same rate")
    return data, rate


def ramp(n, up=True):
    r = np.linspace(0.0, 1.0, max(n, 1), dtype=np.float32)
    return (r if up else r[::-1])[:, None]


def take(src, sr, a, b):
    """src[a:b] in seconds, zero-padded where the range leaves the file."""
    ia, ib = int(round(a * sr)), int(round(b * sr))
    out = np.zeros((ib - ia, src.shape[1]), dtype=np.float32)
    lo, hi = max(ia, 0), min(ib, len(src))
    if hi > lo:
        out[lo - ia:hi - ia] = src[lo:hi]
    return out


def place(buf, piece, at, sr):
    i = int(round(at * sr))
    lo = max(i, 0)
    hi = min(i + len(piece), len(buf))
    if hi > lo:
        buf[lo:hi] += piece[lo - i:hi - i]


def build(plan, root):
    src_path = os.path.join(root, plan["source"])
    stems = plan.get("stems") or {}
    v_path = os.path.join(root, stems["vocals"]) if stems.get("vocals") else None
    i_path = os.path.join(root, stems["instrumental"]) if stems.get("instrumental") else None
    use_stems = bool(v_path and i_path and os.path.exists(v_path) and os.path.exists(i_path))

    if use_stems:
        inst, sr = load(i_path)
        vox, _ = load(v_path, sr)
    else:
        print("note: stems not found — crossfading the full mix (vocal carry/mute ignored)")
        inst, sr = load(src_path)
        vox = None

    segs = plan["segments"]
    total = sum(s["to"] - s["from"] for s in segs)
    buf = np.zeros((int(round(total * sr)) + 1, 2), dtype=np.float32)
    nx = int(XFADE * sr)

    pos = 0.0
    for k, s in enumerate(segs):
        a, b = s["from"], s["to"]
        first, last = k == 0, k == len(segs) - 1
        # instrumental (or full mix): extend by half a crossfade each side and fade
        pa = a if first else a - XFADE / 2
        pb = b if last else b + XFADE / 2
        piece = take(inst, sr, pa, pb)
        if not first:
            piece[:nx] *= ramp(nx, True)
        if not last:
            piece[-nx:] *= ramp(nx, False)
        place(buf, piece, pos + (pa - a), sr)

        if vox is not None:
            va, vb = s.get("vocals_from", a), s.get("vocals_to", b)
            vp = take(vox, sr, va, vb)
            idx = np.arange(len(vp))
            nr = int(MUTE_RAMP * sr)
            for ma, mb in s.get("mute_vocals", []):
                ia, ib = int((ma - va) * sr), int((mb - va) * sr)
                gain = np.clip(np.maximum((ia - idx) / nr, (idx - ib) / nr), 0, 1).astype(np.float32)
                vp *= gain[:, None]
            nv = int(VOX_FADE * sr)
            if not (first and va == a):
                vp[:nv] *= ramp(nv, True)
            if not (last and vb == b):
                vp[-nv:] *= ramp(nv, False)
            place(buf, vp, pos + (va - a), sr)
        pos += b - a

    # delay: silence in front, drop the same amount off the tail, so cuts stay on the grid
    nd = int(round(plan.get("delay", 0.0) * sr))
    if nd > 0:
        buf = np.concatenate([np.zeros((nd, 2), dtype=np.float32), buf[:-nd]])

    buf *= 10 ** (plan.get("gain_db", 0.0) / 20)
    peak = float(np.abs(buf).max())
    if peak > 0.999:
        buf *= 0.999 / peak
    return buf[: int(round(total * sr))], sr, total, use_stems


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    edl_path = sys.argv[1]
    root = os.path.dirname(os.path.dirname(os.path.abspath(edl_path)))
    edl = json.load(open(edl_path))
    meta = edl["meta"]
    plan = meta.get("audio_plan")
    if not plan:
        sys.exit("EDL has no meta.audio_plan — nothing to build")
    out = os.path.join(root, meta["song"])
    buf, sr, total, stems = build(plan, root)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sf.write(out, buf, sr, subtype="PCM_24")
    print(f"wrote {out}  {total:.3f}s  {len(plan['segments'])} pieces  stems={'yes' if stems else 'no'}")


if __name__ == "__main__":
    main()
