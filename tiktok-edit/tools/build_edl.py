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
    """'14.3.5' → song seconds (bar 14, beat 3, + half a beat); '@92.07' → 92.07."""
    if str(spec).startswith("@"):
        return float(spec[1:])
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
            return round(off + t - s["from"], 4) + 0.0   # no -0.0
        off += s["to"] - s["from"]
    raise ValueError(f"song time {t:.3f}s falls outside the audio plan")


def section_at(t_song):
    for sec in BM["sections"]:
        if sec["start"] - 1e-3 <= t_song < sec["end"] - 1e-3:
            return sec["name"]
    return ""


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
            "section": row.get("section", section_at(pos(row["at"]))),
            "moment": row["m"],
            "clip": f"clips/{row['m']}.{'jpg' if m.get('kind') == 'image' else 'mp4'}",
            "in": 0.0,
            "speed": speed,
            "focus_x": row.get("focus_x", m.get("focus_x", 0.5)),
            "focus_y": row.get("focus_y", m.get("focus_y", 0.5)),
            "fit": row.get("fit", m.get("fit", "crop")),
            "fx": row.get("fx", []),
            "placeholder": placeholder(m),
        }
        hit = m.get("hit", 3.0) + row.get("hit_offset", 0.0)
        if row.get("sync", "hit") == "hit":
            lead = row.get("hit_beat", 0) * BEAT       # seconds into the shot the hit lands
            shot["in"] = round(max(0.0, hit - lead * speed), 3)
        for k in ("ramp", "zoom", "grade"):
            if k in row:
                shot[k] = row[k]
        if "text" in row:
            text = dict(row["text"])
            if "at" in text:       # song position → seconds into the shot
                text["in"] = round(max(0.0, pos(text.pop("at")) - pos(row["at"])), 3)
            if "until" in text:
                text["out"] = round(pos(text.pop("until")) - pos(row["at"]), 3)
            shot["text"] = text
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
                           "gain_db": 1.0,    # ~-14 LUFS for TikTok
                           "delay": 0.05},    # beats measured ~50 ms ahead of the cuts
        },
        "shots": shots,
        "overlays": ov,
    }


def _seg_ends(plan):
    off = 0.0
    for s in plan:
        off += s["to"] - s["from"]
        yield round(off, 4)


def lyric_at(t_song):
    for ly in BM["lyrics"]:
        if ly["start"] <= t_song < ly["end"]:
            return ly["text"]
    return ""


def mmss(t):
    return f"{int(t // 60)}:{t % 60:05.2f}"


def write_docs(edls):
    """CLIPS.md (what to collect) and SHOTLIST.md (every cut, for CapCut/manual editing)."""
    used = {}
    for name, edl in edls.items():
        for sh in edl["shots"]:
            used.setdefault(sh["moment"], set()).add(name)
    order = list(dict.fromkeys(sh["moment"] for e in edls.values() for sh in e["shots"]))
    L = ["# Clips to collect", "",
         "Save each clip in `clips/` with the file name shown (one key action per clip).",
         "Trim each video to **about 8 seconds with its key action exactly 3.0 s in**, or note the",
         "actual second in `research/moments.json` → `hit`. Missing clips render as title cards,",
         "so you can render at any point and fill the gaps as you go.", "",
         "Sources came from web search and were **not opened** from this environment: treat them as",
         "leads, prefer official uploads (FC Barcelona, LaLiga, UEFA, FIFA, SEFUTBOL, ballondor.com),",
         "and see `research/edit-craft.md` §3 for scenepack channels.", "",
         "| # | File | Moment | Key action (put it at 3.0 s) | Used in | Lead |",
         "|---|------|--------|------------------------------|---------|------|"]
    for i, mid in enumerate(order, 1):
        m = MOMENTS[mid]
        ext = "jpg" if m["kind"] == "image" else "mp4"
        lead = ""
        if m["sources"]:
            f = m["sources"][0]
            lead = f"[{f['title'][:48]}]({f['url']})" if f["url"] else f["title"][:48]
        elif m.get("search"):
            lead = f"search: _{m['search']}_"
        trim = m["trim"].replace("|", "/")
        L.append(f"| {i} | `{mid}.{ext}` | **{m['title']}** — {m['sub']} | {trim} | "
                 f"{', '.join(sorted(used[mid]))} | {lead} |")
    open(os.path.join(ROOT, "CLIPS.md"), "w").write("\n".join(L) + "\n")

    S = ["# Shot lists", "",
         "Every cut, generated from `edl/*.json`. Times are on the finished edit (mm:ss.ss).",
         "\"Clip @\" is where to start inside the clip file (with the 3.0 s key-action convention).",
         "Use it to assemble the edit by hand in CapCut if you prefer; the soundtrack is",
         "`song/edit_<cut>.wav` (build it with `python tools/make_audio.py edl/<cut>.json`).", ""]
    for name, edl in edls.items():
        plan = edl["meta"]["audio_plan"]["segments"]
        S += [f"## {name} cut — {edl['meta']['song_end']:.1f} s, {len(edl['shots'])} shots", "",
              "Audio: " + " + ".join(f"song {s['from']:.2f}–{s['to']:.2f} s" for s in plan), "",
              "| Shot | Time | Len | Section | Clip | Clip @ | Speed | Lyric under it | On screen | FX |",
              "|------|------|-----|---------|------|--------|-------|----------------|-----------|----|"]
        for sh in edl["shots"]:
            # edit time → song time, for the lyric column
            off, song_t = 0.0, None
            for s in plan:
                d = s["to"] - s["from"]
                mid = (sh["start"] + sh["end"]) / 2
                if off <= mid < off + d:
                    song_t = s["from"] + mid - off
                off += d
            txt = sh.get("text", {}).get("content", "").replace("\n", " / ")
            S.append(f"| {sh['id']} | {mmss(sh['start'])} | {sh['end'] - sh['start']:.2f} | "
                     f"{sh.get('section', '')} | `{sh['moment']}` {MOMENTS[sh['moment']]['title']} | "
                     f"{sh['in']:.2f} | {sh['speed']}{' ramp' if 'ramp' in sh else ''} | "
                     f"{lyric_at(song_t) if song_t is not None else ''} | {txt} | {' '.join(sh['fx'])} |")
        if edl["overlays"]:
            S += ["", "Text overlays:", ""]
            S += [f"- {mmss(o['start'])}–{mmss(o['end'])} · {o['style']} · \"{o['content']}\"" for o in edl["overlays"]]
        S.append("")
    open(os.path.join(ROOT, "SHOTLIST.md"), "w").write("\n".join(S) + "\n")


def main():
    from cuts import SHEETS  # cut sheets live next to this file
    os.makedirs(os.path.join(ROOT, "edl"), exist_ok=True)
    edls = {}
    for name, (sheet, overlays) in SHEETS.items():
        edl = edls[name] = build(name, sheet, overlays, PLANS[name])
        path = os.path.join(ROOT, "edl", f"{name}.json")
        json.dump(edl, open(path, "w"), indent=1, ensure_ascii=False)
        n = len(edl["shots"])
        print(f"wrote {path}: {n} shots, {edl['meta']['song_end']:.2f}s, "
              f"{n / edl['meta']['song_end']:.2f} cuts/s")
    write_docs(edls)
    print("wrote CLIPS.md and SHOTLIST.md")


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    main()
