#!/usr/bin/env python3
"""Plan file -> beat-synced edit(s): spliced soundtrack + EDL with cast, in-points and effects.

    python tools/plan_edit.py plans/<slug>.json --slots     # grid only: shots per section, nothing written
    python tools/plan_edit.py plans/<slug>.json             # write edl/<slug>_<cut>.json for every cut
    python tools/plan_edit.py plans/<slug>.json --audio     # ... and build song/<slug>_<cut>.wav
    python render.py edl/<slug>_<cut>.json --preview --contact-sheet

A plan names the song, its beat map (tools/beatgrid.py), the scene-pack catalogue
(tools/scenes.py) and one or more cuts. Each cut is a list of song segments, taken in
order and spliced on downbeats; each segment has a pace that decides how it is cut:

  calm       2-beat shots, slow push-in                     intros, quiet verses
  verse      2 beats, tightening to 1 and then 1/2 beat     verses that build
  build      2,2,2,1,1/2,1/2 beats, white dip into a drop   pre-chorus, risers
  drop       ~4 cuts a bar (2,1,1 / 1,1,1,1/2,1/2),         chorus, drop, climax
             flash on every bar line, shake on the snares
  breakdown  2-beat shots, black and white, vignette        drop-outs, sad turns
  bridge     1-bar shots at the ends, 2 beats between,      bridges, slow sections
             glow / grain
  end        one held shot, gold, title                     last bar(s), loops to start

A segment can override the grid with "pattern" (beats per shot, summing to bars*4),
choose its footage with "cast" (scene ids, one per shot; missing ones are auto-cast
from the catalogue by mood), and shift its piece of song with "nudge" (seconds, as
suggested by tools/qa.py sync). See the skill's references/plan-format.md.
"""
import argparse
import json
import os
import sys

from editlib import focus_at, motion_curve, pick_in, probe, source_span

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# moods each pace casts from, in order of preference
PREFER = {
    "calm": ["arrival", "closeup"], "verse": ["closeup", "action", "arrival"], "build": ["arrival", "action", "closeup"],
    "drop": ["celebration", "action"], "breakdown": ["sad", "closeup"], "bridge": ["sad", "closeup"],
    "end": ["celebration", "closeup"],
}
GRADE = {"calm": "cold", "breakdown": "bw", "bridge": "cold", "end": "gold"}


def p_(p):
    return p if os.path.isabs(p) else os.path.join(ROOT, p)


def grid(pace, beats):
    """Beat lengths of the shots in a segment of `beats` beats.

    Tuned to the approved Yamal edit at 112 BPM: 2-beat shots in calm parts, verses
    tightening 2 -> 1 -> 1/2, builds 2,2,2,1,1/2,1/2, drops at about 4 cuts a bar.
    """
    out = []
    if pace in ("calm", "breakdown"):
        out = [2] * (beats // 2)
    elif pace == "bridge":
        if beats >= 16:
            mid = beats - 12
            out = [4, 4] + [2] * (mid // 2) + [4]
        else:
            out = [4] * (beats // 4)
    elif pace == "end":
        out = [beats]
    elif pace in ("verse", "build"):
        cut1, cut2 = (2 / 3, 11 / 12) if pace == "verse" else (3 / 4, 7 / 8)
        t = 0.0
        while t < beats - 1e-9:
            p = t / beats
            step = 2 if p < cut1 - 1e-9 else (1 if p < cut2 - 1e-9 else 0.5)
            out.append(step)
            t += step
    elif pace == "drop":
        for b in range(beats // 4):
            out += [2, 1, 1] if b % 2 == 0 else [1, 1, 1, 0.5, 0.5]
    else:
        raise SystemExit(f"unknown pace '{pace}' (use {', '.join(PREFER)})")
    rest = beats - sum(out)
    if rest > 1e-9:
        out.append(rest)
    return out


def styling(pace, k, n, beat_pos, length, slowmo):
    """Effects, speed, zoom and grade for shot k of n in a segment (beat_pos = beat within the bar)."""
    fx, zoom, speed, ramp = [], None, 1.0, None
    on_bar = abs(beat_pos) < 1e-6
    if pace in ("calm", "breakdown", "bridge"):
        zoom = {"from": 1.0, "to": 1.12} if pace == "calm" else {"from": 1.02, "to": 1.12}
        if pace == "breakdown":
            fx.append("vignette")
        if pace == "bridge":
            fx.append("glow" if k % 2 == 0 else "grain")
    elif pace == "verse":
        if on_bar and k % 2 == 0:
            fx.append("flash_in")
        if length <= 1 and abs(beat_pos % 2 - 1) < 1e-6:
            fx.append("shake")
        speed = 1.0 if length >= 2 else 1.5
    elif pace == "build":
        speed = 1.5
    elif pace == "drop":
        if on_bar:
            fx.append("flash_in")
        if abs(beat_pos % 2 - 1) < 1e-6:
            fx.append("shake")
        speed = 1.5
        if k == 0:
            ramp = {"from": 2.0, "to": 1.0, "at": 0.4}
    elif pace == "end":
        fx += ["flash_in", "glow"]
        zoom = {"from": 1.15, "to": 1.0}
    if not slowmo:              # real-time footage: no speed-ups, gentle slow-down on the drop's first hit
        speed = 1.0
        ramp = {"from": 1.0, "to": 0.7, "at": 0.5} if ramp else None
    return fx, zoom, speed, ramp, GRADE.get(pace)


def auto_cast(pace, scenes, uses, prev, n):
    """Pick n scene ids for a segment: moods taken in turn (e.g. celebration, action, celebration...),
    the least-used shot of that mood each time, never the same shot twice in a row."""
    order = list(scenes)
    kinds = [k for k in PREFER[pace] if any(s.get("kind") == k for s in scenes.values())]
    if not kinds:                     # catalogue moods not filled in yet: any shot will do
        kinds = sorted({s.get("kind") for s in scenes.values()} - {"skip", "?", None}) or [None]
    picks = []
    for i in range(n):
        kind = kinds[i % len(kinds)]
        pool = [sid for sid in order if kind is None or scenes[sid].get("kind") == kind] or order
        cands = sorted(pool, key=lambda sid: (uses.get(sid, 0), order.index(sid)))
        sid = next((c for c in cands if c != prev), cands[0])
        picks.append(sid)
        uses[sid] = uses.get(sid, 0) + 1
        prev = sid
    return picks


def build_cut(plan, name, cut, bm, cat, motion, fps, show_slots):
    bar, fd = bm["bar"], bm["first_downbeat"]
    beat = bar / 4                     # one grid: the stored beat and bar are rounded separately
    scenes = {k: v for k, v in cat["scenes"].items() if v.get("kind") != "skip"}
    slowmo = bool(cat.get("slowmo_source"))
    segs = cut["segments"]
    names = [s["name"] for s in segs]
    if len(set(names)) != len(names):
        raise SystemExit(f"cut '{name}': segment names must be unique ({names})")

    # audio: song ranges on bar lines, contiguous ranges merged so they play without a splice
    audio = []
    for s in segs:
        a = fd + s["from_bar"] * bar + s.get("nudge", 0.0)     # nudge: shift this piece of song (s), from qa.py sync
        b = a + s["bars"] * bar
        if b > bm["duration"] + 0.01:
            raise SystemExit(f"cut '{name}', segment '{s['name']}' runs past the end of the song")
        if audio and abs(audio[-1]["to"] - a) < 1e-3:
            audio[-1]["to"] = round(b, 4)
        else:
            audio.append({"from": round(a, 4), "to": round(b, 4)})
    total = sum(s["bars"] for s in segs) * bar

    shots, uses, prev, t_beats, used = [], {}, None, 0.0, {}
    slot_report = []
    for si, s in enumerate(segs):
        beats = s["bars"] * 4
        lens = s.get("pattern") or grid(s["pace"], beats)
        if abs(sum(lens) - beats) > 1e-6:
            raise SystemExit(f"segment '{s['name']}': pattern sums to {sum(lens)} beats, needs {beats}")
        cast = list(s.get("cast", []))[:len(lens)]
        bad = [c for c in cast if c not in scenes]
        if bad:
            raise SystemExit(f"segment '{s['name']}': unknown or skipped scene(s) {bad}")
        for c in cast:
            uses[c] = uses.get(c, 0) + 1
        if len(cast) < len(lens):
            cast += auto_cast(s["pace"], scenes, uses, cast[-1] if cast else prev, len(lens) - len(cast))
        slot_report.append((s["name"], s["pace"], s["bars"], t_beats * beat, len(lens), cast))
        pos = 0.0
        nxt = segs[si + 1]["pace"] if si + 1 < len(segs) else None
        for k, (L, sid) in enumerate(zip(lens, cast)):
            sc = scenes[sid]
            start, end = (t_beats + pos) * beat, (t_beats + pos + L) * beat
            fx, zoom, speed, ramp, grade = styling(s["pace"], k, len(lens), pos % 4, L, slowmo)
            if k == len(lens) - 1 and nxt in ("drop", "build") and s["pace"] != nxt:
                fx = [f for f in fx if f != "shake"] + ["dip_white"]
            if si == 0 and k == 0 and "flash_in" not in fx:
                fx.insert(0, "flash_in")
            if s["pace"] == "drop" and sc.get("kind") == "celebration":
                grade = "warm"
            dur = end - start
            span = source_span(dur, speed, ramp)
            room = sc["end"] - sc["start"] - 0.15
            if span > room:               # shot too short for this pace: slow it to fit
                f = room / span
                speed = speed * f
                ramp = {**ramp, "from": ramp["from"] * f, "to": ramp["to"] * f} if ramp else None
                span = room
            t_in = sc["start"] if show_slots else \
                round(pick_in(sc, span, motion, used.setdefault(sid, []), fps), 3)
            shot = {"id": f"s{len(shots) + 1:02d}", "start": round(start, 4), "end": round(end, 4),
                    "section": s["name"], "moment": sid, "clip": cat["source"], "in": t_in,
                    "fit": sc.get("fit", "crop"), "focus_x": focus_at(sc, t_in + span / 2), "focus_y": 0.5, "fx": fx}
            if ramp:
                shot["ramp"] = {k_: round(v, 3) for k_, v in ramp.items()}
            else:
                shot["speed"] = round(speed, 3)
            if zoom:
                shot["zoom"] = zoom
            if grade:
                shot["grade"] = grade
            for tx in s.get("text", []):          # {"beat": 0, "content": "...", "style": "lyric"}
                if abs(tx.get("beat", 0) - pos) < 1e-6:
                    shot["text"] = {"content": tx["content"], "style": tx.get("style", "lyric"),
                                    "pos": tx.get("pos", "center"), "in": tx.get("in", 0.0)}
            shots.append(shot)
            prev = sid
            pos += L
        t_beats += beats

    if cut.get("end_title"):
        shots[-1]["text"] = {"content": cut["end_title"], "style": "title", "pos": "upper", "in": 0.35}
    overlays = []
    for c in cut.get("captions", []):     # {"bar": 2.5, "beats": 6, "content": "...", "style": "whisper"}
        a = c["bar"] * bar
        overlays.append({"start": round(a, 4), "end": round(min(total, a + c.get("beats", 4) * beat), 4),
                         "content": c["content"], "style": c.get("style", "whisper"), "pos": c.get("pos", "lower")})

    if show_slots:
        print(f"== cut '{name}': {total:.2f}s, {len(shots)} shots, audio {len(audio)} piece(s): "
              + " + ".join(f"{a['from']:.2f}-{a['to']:.2f}" for a in audio))
        for nm, pace, bars, t0, n, cast in slot_report:
            print(f"  {nm:14} {pace:9} {bars:2d} bars @ {t0:6.2f}s  {n:3d} shots  cast {' '.join(cast)}")
        return None

    slug = plan["slug"]
    meta = {"title": f"{plan.get('title', slug)} ({name} cut)", "song": f"song/{slug}_{name}.wav",
            "song_start": 0.0, "song_end": round(total, 4), "fade_out": cut.get("fade_out", 0.0), "fps": 30,
            "width": 1080, "height": 1920, "default_grade": plan.get("grade", "teal_orange"),
            "safe_zone": {"top": 130, "bottom": 484, "left": 60, "right": 140},
            "audio_plan": {"source": plan["song"], "segments": audio, "gain_db": plan.get("gain_db", 1.0),
                           "delay": plan.get("audio_delay", 0.0)}}
    path = p_(f"edl/{slug}_{name}.json")
    with open(path, "w") as f:
        json.dump({"meta": meta, "shots": shots, "overlays": overlays}, f, indent=1, ensure_ascii=False)
        f.write("\n")
    n_sc = len({s["moment"] for s in shots})
    print(f"wrote edl/{slug}_{name}.json: {total:.2f}s, {len(shots)} shots from {n_sc} scenes")
    return path


def build_audio(edl_path):
    import soundfile as sf
    import make_audio
    edl = json.load(open(edl_path))
    meta = edl["meta"]
    buf, sr, total, stems = make_audio.build(meta["audio_plan"], ROOT)
    out = p_(meta["song"])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sf.write(out, buf, sr, subtype="PCM_24")
    print(f"wrote {meta['song']}: {total:.2f}s from {len(meta['audio_plan']['segments'])} piece(s)")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0], epilog=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("plan")
    ap.add_argument("--slots", action="store_true", help="print the grid and cast per section; write nothing")
    ap.add_argument("--audio", action="store_true", help="also build the spliced soundtrack(s)")
    ap.add_argument("--only", help="comma separated cut names")
    a = ap.parse_args()
    plan = json.load(open(p_(a.plan)))
    bm = json.load(open(p_(plan["beatmap"])))
    cat = json.load(open(p_(plan["catalog"])))
    src = p_(cat["source"])
    if not os.path.exists(src):
        sys.exit(f"missing {cat['source']}")
    _, fps, _, _ = probe(src)
    motion = None if a.slots else motion_curve(src)
    for name, cut in plan["cuts"].items():
        if a.only and name not in a.only.split(","):
            continue
        path = build_cut(plan, name, cut, bm, cat, motion, fps, a.slots)
        if path and a.audio:
            build_audio(path)


if __name__ == "__main__":
    main()
