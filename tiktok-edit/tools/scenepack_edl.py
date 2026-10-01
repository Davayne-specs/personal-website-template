#!/usr/bin/env python3
"""Cut the scene pack to the song: writes edl/sp_story.json and edl/sp_short.json.

    python tools/scenepack_edl.py
    python render.py edl/sp_story.json --contact-sheet

Timing, effects and lyric captions come from edl/story.json and edl/short.json
(cut on the song's beat grid by build_edl.py). This casts scene-pack shots
(research/scenepack.json) into those slots by mood, picks each in-point from the
footage's motion, retimes for the Twixtor slow-mo source, and drops the old
storyline text. Edit CAST below to change who goes where.
"""
import json
import os
import subprocess

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 30

# Scene ids per section, in order. Must match the template's shot count per section.
INTRO = ["S01", "S13", "S04", "S11"]
BUILD = ["S40", "S31", "S13", "S01", "S26", "S17"]
CLIMAX = ["S21", "S16", "S09", "S36", "S46", "S10", "S20", "S23", "S06", "S44", "S37", "S22", "S05", "S18",
          "S29", "S16", "S21", "S09", "S07", "S45", "S36", "S10", "S20", "S46", "S06", "S23", "S37", "S42"]
CAST = {
    "story": {
        "drop-out 1": INTRO,
        "verse1": ["S02", "S03", "S15", "S12", "S05", "S06", "S29", "S37", "S19", "S20", "S08", "S36",
                   "S17", "S07", "S28", "S27", "S34", "S33"],
        # lyric hooks land on 0 (RAIN ON ME: knee slide), 7 (RAIN ON ME), 14 (RAIN ON ME), 17 (BRING IT DOWN)
        "chorus": ["S16", "S21", "S23", "S06", "S22", "S20", "S18", "S46", "S36", "S45", "S05", "S42",
                   "S37", "S24", "S09", "S29", "S32", "S10", "S21", "S23", "S07", "S16", "S12", "S20"],
        "drop-out 2": ["S38", "S39"],
        # settle down babe / my child / you worry too much x2 / fight the whole crowd x2 /
        # run at your pace / don't think about them x2 / running at the stars
        "bridge": ["S43", "S30", "S24", "S33", "S35", "S09", "S07", "S34", "S41", "S14"],
        "drop-out 4": ["S42"],            # they can catch them
        "break / build": BUILD,
        "climax": CLIMAX,
        "end": ["S44"],                   # 304
    },
    "short": {
        "drop-out 1": INTRO,
        "verse1": ["S02", "S05", "S03", "S06", "S20", "S36"],
        "break / build": BUILD,
        "climax": CLIMAX,
        "end": ["S44"],
    },
}
ACTIVE = {"action", "celebration"}       # in-point follows the motion peak; others sit mid-shot


def motion_curve(path):
    """Mean absolute frame-to-frame change (64x36 grey), lightly smoothed."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", "scale=64:36,format=gray",
                          "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, 36 * 64).astype(np.float32)
    d = np.r_[0.0, np.abs(np.diff(fr, axis=0)).mean(1)]
    return np.convolve(d, np.ones(5) / 5, mode="same")


def pace(section, dur, ramp):
    """Speed / ramp for the Twixtor source: never below 1x (it is already slow-mo)."""
    if ramp:
        return None, {"from": 2.0, "to": 1.0, "at": ramp["at"]}
    if section in ("chorus", "climax"):
        return 1.5, None
    if section in ("verse1", "break / build"):
        return (1.0 if dur >= 1.0 else 1.5), None
    return 1.0, None


def source_span(dur, speed, ramp):
    if ramp:
        return dur * ramp["at"] * ramp["from"] + dur * (1 - ramp["at"]) * ramp["to"]
    return dur * speed


def grade_for(section, kind, k, n):
    if section == "drop-out 1":
        return "cold"
    if section == "drop-out 2":
        return "bw"
    if section == "bridge":
        return "warm" if k >= n - 2 else "cold"
    if section in ("drop-out 4", "end"):
        return "gold"
    if section in ("chorus", "climax") and kind == "celebration":
        return "warm"
    return None                           # meta default (teal_orange)


def pick_in(sc, span, motion, used):
    """Earliest source time for a window of `span` s inside the scene."""
    a, b = int(sc["start"] * FPS) + 2, int(sc["end"] * FPS) - 2
    w = int(round(span * FPS))
    starts = np.arange(a, max(a, b - w) + 1)
    if sc["kind"] in ACTIVE:
        score = np.array([motion[s:s + w].mean() for s in starts])
        score = score / (score.max() or 1)
    else:
        mid = (a + b) / 2
        score = 1 - np.abs(starts + w / 2 - mid) / max(b - a, 1)
    for ua, ub in used:                   # reuse a scene => prefer an unused stretch of it
        overlap = np.clip(np.minimum(starts + w, ub) - np.maximum(starts, ua), 0, None) / max(w, 1)
        score = score - 1.5 * overlap
    s = int(starts[int(np.argmax(score))])
    used.append((s, s + w))
    return s / FPS


def focus_at(sc, t):
    """Yamal's horizontal position at source time t (steady value or interpolated track)."""
    if "focus_track" in sc:
        ts, xs = zip(*sc["focus_track"])
        return round(float(np.interp(t, ts, xs)), 3)
    return sc.get("focus_x", 0.5)


def build(name, cast, catalog, motion):
    tpl = json.load(open(os.path.join(ROOT, "edl", f"{name}.json")))
    scenes, src = catalog["scenes"], catalog["source"]
    by_sec = {}
    for s in tpl["shots"]:
        by_sec.setdefault(s["section"], []).append(s)
    for sec, shots in by_sec.items():
        if len(cast.get(sec, [])) != len(shots):
            raise SystemExit(f"{name}: section '{sec}' has {len(shots)} shots, CAST lists {len(cast.get(sec, []))}")

    used, out = {}, []
    for sec, shots in by_sec.items():
        for k, (t, sid) in enumerate(zip(shots, cast[sec])):
            sc = scenes[sid]
            dur = t["end"] - t["start"]
            speed, ramp = pace(sec, dur, t.get("ramp"))
            span = source_span(dur, speed, ramp)
            room = sc["end"] - sc["start"] - 0.15
            if span > room:               # scene too short for this pace: slow it to fit
                f = room / span
                speed, ramp = (speed * f if speed else None), ({**ramp, "from": ramp["from"] * f,
                                                               "to": ramp["to"] * f} if ramp else None)
                span = room
            t_in = round(pick_in(sc, span, motion, used.setdefault(sid, [])), 3)
            shot = {"id": t["id"], "start": t["start"], "end": t["end"], "section": sec, "moment": sid,
                    "clip": src, "in": t_in, "fit": sc["fit"], "focus_x": focus_at(sc, t_in + span / 2),
                    "focus_y": 0.5, "fx": list(t.get("fx", []))}
            if ramp:
                shot["ramp"] = {k_: round(v, 3) for k_, v in ramp.items()}
            else:
                shot["speed"] = round(speed, 3)
            if t.get("zoom"):
                z = dict(t["zoom"])
                if sc["fit"] == "crop":   # 360p source: keep punch-ins gentle when already cropped
                    z = {"from": min(z["from"], 1.15), "to": min(z["to"], 1.15)}
                shot["zoom"] = z
            g = grade_for(sec, sc["kind"], k, len(shots))
            if g:
                shot["grade"] = g
            if t.get("text", {}).get("style") == "lyric":
                shot["text"] = t["text"]
            if sec == "end":
                shot["text"] = {"content": "LAMINE YAMAL", "style": "title", "pos": "upper", "in": 0.35}
            out.append(shot)

    meta = dict(tpl["meta"])
    meta["title"] = f"Lamine Yamal — I Feel It Coming (scene pack, {name} cut)"
    overlays = [o for o in tpl.get("overlays", []) if o.get("style") == "whisper"]   # sung lines only
    path = os.path.join(ROOT, "edl", f"sp_{name}.json")
    with open(path, "w") as f:
        json.dump({"meta": meta, "shots": out, "overlays": overlays}, f, indent=1, ensure_ascii=False)
        f.write("\n")
    uses = {}
    for s in out:
        uses[s["moment"]] = uses.get(s["moment"], 0) + 1
    print(f"wrote {os.path.relpath(path, ROOT)}: {len(out)} shots from {len(uses)} scenes, "
          f"most reused {max(uses.values())}x")


def main():
    catalog = json.load(open(os.path.join(ROOT, "research", "scenepack.json")))
    src = os.path.join(ROOT, catalog["source"])
    if not os.path.exists(src):
        raise SystemExit(f"missing {catalog['source']}: put the scene pack video there")
    motion = motion_curve(src)
    for name, cast in CAST.items():
        build(name, cast, catalog, motion)


if __name__ == "__main__":
    main()
