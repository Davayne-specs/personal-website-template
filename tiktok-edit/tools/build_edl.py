#!/usr/bin/env python3
"""Director: writes edl/story.json and edl/short.json from the cut sheets below.

    python tools/build_edl.py            # regenerate both EDLs
    python tools/make_audio.py edl/story.json
    python render.py edl/story.json

Shots are placed in musical time ("bar.beat" on the ORIGINAL song, e.g. "14.1"
is bar 14 beat 1, "14.3.5" is halfway through beat 3) and converted to the
edit timeline through the audio plan, so a cut always lands on the grid.

Each moment in research/moments.json has a `hit` — the second inside its clip
where the key action happens (ball leaves the boot, net ripples, fist pump).
A shot with `"sync": "hit"` puts that instant exactly on the shot's first frame
(or on `hit_beat` beats into the shot), whatever the clip's length.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BM = json.load(open(os.path.join(ROOT, "analysis/beatmap.json")))
MOMENTS = json.load(open(os.path.join(ROOT, "research/moments.json")))["moments"]
PH, BAR, BEAT = BM["first_downbeat"], BM["bar"], BM["beat"]
SONG_END = BM["duration"]


def B(k):
    return round(PH + k * BAR, 4)


def pos(spec):
    """'14.3.5' → song seconds (bar 14, beat 3, + half a beat)."""
    parts = [float(p) for p in str(spec).split(".")]
    bar, beat = parts[0], parts[1] if len(parts) > 1 else 1
    frac = parts[2] / 10 if len(parts) > 2 else 0
    return PH + bar * BAR + (beat - 1 + frac) * BEAT


STEMS = {"vocals": "song/stems/vocals.wav", "instrumental": "song/stems/instrumental.wav"}

PLANS = {
    "story": [
        {"label": "drop-out 'so damn close' → verse → chorus → 'still defeated'",
         "from": B(6), "to": B(22), "vocals_to": 47.86},
        {"label": "bridge 'Settle down, my child' → 'they can catch them'",
         "from": B(38), "to": B(46), "mute_vocals": [[81.3, 82.45]], "vocals_to": 98.80},
        {"label": "build 'Hey, I feel it coming' → climax → end",
         "from": B(60), "to": SONG_END},
    ],
    "short": [
        {"label": "drop-out 'so damn close' → 'right through my nose'",
         "from": B(6), "to": B(10), "mute_vocals": [[21.25, 21.70]]},
        {"label": "build → climax → end", "from": B(60), "to": SONG_END},
    ],
}


def edit_time(t, plan, end=False):
    """Song seconds → edit seconds. `end=True` also accepts a segment's end."""
    off = 0.0
    for s in plan:
        if s["from"] - 1e-3 <= t < s["to"] - 1e-3 or (end and abs(t - s["to"]) < 1e-3):
            return round(off + t - s["from"], 4)
        off += s["to"] - s["from"]
    raise ValueError(f"song time {t:.3f}s falls outside the audio plan")


def placeholder(m):
    return {"title": m["title"].upper(), "sub": m.get("sub", ""),
            "hint": m.get("hint", ""), "color": m.get("color", "#1d2b53")}


def build(name, sheet, overlays, plan):
    total = round(sum(s["to"] - s["from"] for s in plan), 4)
    shots = []
    for i, row in enumerate(sheet):
        t0 = edit_time(pos(row["at"]), plan)
        t1 = edit_time(pos(sheet[i + 1]["at"]), plan) if i + 1 < len(sheet) else total
        if t1 <= t0:
            sys.exit(f"{name}: row {i} ({row['at']}) does not move forward in time")
        m = MOMENTS[row["m"]]
        speed = row.get("speed", m.get("speed", 1.0))
        shot = {
            "id": f"s{i + 1:02d}",
            "start": t0,
            "end": round(t1, 4),
            "section": row.get("section", ""),
            "moment": row["m"],
            "clip": f"clips/{row['m']}.mp4",
            "in": 0.0,
            "speed": speed,
            "focus_x": row.get("focus_x", m.get("focus_x", 0.5)),
            "focus_y": row.get("focus_y", m.get("focus_y", 0.5)),
            "fit": row.get("fit", m.get("fit", "crop")),
            "fx": row.get("fx", []),
            "placeholder": placeholder(m),
        }
        hit = m.get("hit", 1.0) + row.get("hit_offset", 0.0)
        if row.get("sync", "hit") == "hit":
            lead = row.get("hit_beat", 0) * BEAT       # seconds into the shot the hit lands
            shot["in"] = round(max(0.0, hit - lead * speed), 3)
        for k in ("ramp", "zoom", "grade", "text"):
            if k in row:
                shot[k] = row[k]
        shots.append(shot)

    # every audio segment must open with a shot, so no shot spans a splice
    starts = {round(sh["start"], 3) for sh in shots}
    for seg_start in [0.0] + list(_seg_ends(plan))[:-1]:
        if round(seg_start, 3) not in starts:
            sys.exit(f"{name}: no shot starts on the splice at {seg_start:.3f}s")

    ov = []
    for o in overlays:
        o = dict(o)
        o["start"] = edit_time(pos(o["start"]), plan) if isinstance(o["start"], str) else o["start"]
        o["end"] = edit_time(pos(o["end"]), plan, end=True) if isinstance(o["end"], str) else o["end"]
        ov.append(o)

    return {
        "meta": {
            "title": f"Lamine Yamal — I Feel It Coming ({name} cut)",
            "song": f"song/edit_{name}.wav",
            "song_start": 0.0,
            "song_end": total,
            "fade_out": 0.0,
            "fps": 30,
            "width": 1080,
            "height": 1920,
            "default_grade": "teal_orange",
            "safe_zone": {"top": 130, "bottom": 484, "left": 60, "right": 140},
            "audio_plan": {"source": "song/song.mp3", "stems": STEMS, "segments": plan,
                           "gain_db": 1.0},   # ~-14 LUFS for TikTok
        },
        "shots": shots,
        "overlays": ov,
    }


def _seg_ends(plan):
    off = 0.0
    for s in plan:
        off += s["to"] - s["from"]
        yield round(off, 4)


def main():
    from cuts import SHEETS  # cut sheets live next to this file
    os.makedirs(os.path.join(ROOT, "edl"), exist_ok=True)
    for name, (sheet, overlays) in SHEETS.items():
        edl = build(name, sheet, overlays, PLANS[name])
        path = os.path.join(ROOT, "edl", f"{name}.json")
        json.dump(edl, open(path, "w"), indent=1, ensure_ascii=False)
        n = len(edl["shots"])
        print(f"wrote {path}: {n} shots, {edl['meta']['song_end']:.2f}s, "
              f"{n / edl['meta']['song_end']:.2f} cuts/s")


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    main()
