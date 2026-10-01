#!/usr/bin/env python3
"""Director: turns cut sheets into EDLs (plus shot lists) for every edit project.

    python tools/build_edl.py                    # all projects
    python tools/build_edl.py cuts_spot_valley   # one project (module name in tools/)
    python tools/make_audio.py edl/spot_valley.json
    python render.py edl/spot_valley.json

A project is a module in tools/ (cuts.py = "I Feel It Coming",
cuts_spot_valley.py = "Spot Valley Road 50") that defines PROJECT, PLANS and
SHEETS. Shots are placed in musical time ("bar.beat" on the ORIGINAL song,
e.g. "14.1" is bar 14 beat 1, "14.3.5" is halfway through beat 3, "@92.07" is a
raw song second) and converted to the edit timeline through the audio plan, so
cuts always land on the grid.

Each moment in the project's catalogue has a `hit`: the second inside its clip
that the shot's in-points are measured from. A row's `hit` offset (seconds, or
a named offset in the cut sheet) and `hit_beat` (land that instant this many
beats into the shot) set the in-point. If a clip is too short for the shot,
the in-point is pulled earlier, then the speed is lowered, and a note printed.
"""
import importlib
import json
import math
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from grid import Grid  # noqa: E402

PROJECTS = ["cuts", "cuts_spot_valley"]
FPS = 30

# cut-sheet keys the director consumes; every other row key goes into the EDL as-is
DIRECTOR_KEYS = {"at", "m", "hit_offset", "hit_beat", "sync", "section", "text", "speed",
                 "focus_x", "focus_y", "fit", "fx", "panels"}

_durations = {}


def clip_duration(path):
    full = os.path.join(ROOT, path)
    if not os.path.exists(full) or path.endswith((".jpg", ".jpeg", ".png", ".webp")):
        return None
    if path not in _durations:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                              "-of", "csv=p=0", full], capture_output=True, text=True).stdout
        _durations[path] = float(out.strip() or 0)
    return _durations[path]


def source_span(row, dur, speed):
    """Seconds of source a shot consumes (mirrors render.py's rules, conservatively)."""
    if "freeze" in row:
        return 1.0 / FPS
    if "ramp" in row:
        r = row["ramp"]
        span = dur * (r["at"] * r["from"] + (1 - r["at"]) * r["to"])
    else:
        span = dur * speed
    st = row.get("stutter")
    if st:
        span -= (st.get("repeats", 3) - 1) * st.get("len", 0.134)
    return max(span, 1.0 / FPS)


def fit_in(where, clip, t_in, row, dur, speed):
    """Pull the in-point earlier (then slow down) so the shot never runs past the clip."""
    cd = clip_duration(clip)
    if cd is None:
        return round(t_in, 3), speed, None
    span = source_span(row, dur, speed)
    limit = cd - 1.5 / FPS
    note = None
    if t_in + span > limit:
        new_in = max(0.0, limit - span)
        note = f"{where}: in {t_in:.2f}→{new_in:.2f}s to fit {clip} ({cd:.2f}s)"
        t_in = new_in
        if span > limit and "ramp" not in row and "freeze" not in row:
            new_speed = round(max(0.1, speed * limit / span), 3)
            note += f", speed {speed}→{new_speed}"
            speed = new_speed
    return round(t_in, 3), speed, note


class Project:
    def __init__(self, module_name):
        self.mod = importlib.import_module(module_name)
        p = self.mod.PROJECT
        self.p = p
        self.grid = Grid(p["beatmap"])
        self.moments = json.load(open(os.path.join(ROOT, p["moments"])))["moments"]
        self.notes = []

    def clip_path(self, mid):
        m = self.moments[mid]
        ext = "jpg" if m.get("kind") == "image" else "mp4"
        return f"{self.p.get('clips_dir', 'clips')}/{mid}.{ext}"

    def edit_time(self, t, plan, end=False):
        off = 0.0
        for s in plan:
            if s["from"] - 1e-3 <= t < s["to"] - 1e-3 or (end and abs(t - s["to"]) < 1e-3):
                return round(off + t - s["from"], 4) + 0.0   # no -0.0
            off += s["to"] - s["from"]
        raise ValueError(f"song time {t:.3f}s falls outside the audio plan")

    def lock_pulse(self, pulse, t_song):
        """'every': 'beat' | 'half' | 'bar' → seconds, phased so bounces land on the grid."""
        g = self.grid
        every = {"beat": g.beat, "half": g.beat / 2, "bar": g.bar}[pulse["every"]]
        k = (t_song - g.ph) / every
        phase = (math.ceil(k - 1e-6) - k) * every
        return {**pulse, "every": round(every, 5), "phase": round(pulse.get("phase", phase), 4)}

    def resolve_in(self, where, mid, row, dur, speed):
        m = self.moments[mid]
        clip = self.clip_path(mid)
        hit = m.get("hit", 0.0) + row.get("hit_offset", 0.0)
        lead = row.get("hit_beat", 0) * self.grid.beat
        t_in = max(0.0, hit - lead * speed)
        t_in, speed, note = fit_in(where, clip, t_in, row, dur, speed)
        if note:
            self.notes.append(note)
        return clip, t_in, speed

    def build(self, name, sheet, overlays, plan):
        g = self.grid
        total = round(sum(s["to"] - s["from"] for s in plan), 4)
        shots = []
        for i, row in enumerate(sheet):
            sid = f"s{i + 1:02d}"
            t0 = self.edit_time(g.pos(row["at"]), plan)
            t1 = self.edit_time(g.pos(sheet[i + 1]["at"]), plan) if i + 1 < len(sheet) else total
            if t1 <= t0:
                sys.exit(f"{name}: row {i} ({row['at']}) does not move forward in time")
            dur = t1 - t0
            m = self.moments[row["m"]]
            speed = row.get("speed", m.get("speed", 1.0))
            clip, t_in, speed = self.resolve_in(sid, row["m"], row, dur, speed)
            shot = {
                "id": sid,
                "start": t0,
                "end": round(t1, 4),
                "section": row.get("section", g.section_at(g.pos(row["at"]))),
                "moment": row["m"],
                "clip": clip,
                "in": t_in,
                "speed": speed,
                "focus_x": row.get("focus_x", m.get("focus_x", 0.5)),
                "focus_y": row.get("focus_y", m.get("focus_y", 0.5)),
                "fit": row.get("fit", m.get("fit", "crop")),
                "fx": row.get("fx", []),
                "placeholder": {"title": m["title"].upper(), "sub": m.get("sub", ""),
                                "hint": m.get("hint", ""), "color": m.get("color", "#1d2b53")},
            }
            for k, v in row.items():
                if k not in DIRECTOR_KEYS:
                    shot[k] = v
            if isinstance(shot.get("pulse", {}).get("every"), str):
                shot["pulse"] = self.lock_pulse(shot["pulse"], g.pos(row["at"]))
            if "panels" in row:
                panels = []
                for j, pnl in enumerate(row["panels"]):
                    pnl = dict(pnl)
                    if "m" in pnl:
                        pm = pnl.pop("m")
                        prow = {"hit_offset": pnl.pop("hit", 0.0)}
                        pspeed = pnl.get("speed", speed)
                        pnl["clip"], pnl["in"], pspeed = self.resolve_in(f"{sid}.p{j + 1}", pm, prow, dur, pspeed)
                        pnl["speed"] = pspeed
                        pnl.setdefault("focus_x", self.moments[pm].get("focus_x", 0.5))
                    panels.append(pnl)
                shot["panels"] = panels
            if "text" in row:
                texts = row["text"] if isinstance(row["text"], list) else [row["text"]]
                out = []
                for t in texts:
                    t = dict(t)
                    if "at" in t:       # song position → seconds into the shot
                        t["in"] = round(max(0.0, g.pos(t.pop("at")) - g.pos(row["at"])), 3)
                    if "until" in t:
                        t["out"] = round(g.pos(t.pop("until")) - g.pos(row["at"]), 3)
                    out.append(t)
                shot["text"] = out if len(out) > 1 else out[0]
            shots.append(shot)

        # every audio segment must open with a shot, so no shot spans a splice
        starts = {round(sh["start"], 3) for sh in shots}
        for seg_start in [0.0] + list(seg_ends(plan))[:-1]:
            if round(seg_start, 3) not in starts:
                sys.exit(f"{name}: no shot starts on the splice at {seg_start:.3f}s")

        ov = []
        for o in overlays:
            o = dict(o)
            if isinstance(o["start"], str):
                o["start"] = self.edit_time(g.pos(o["start"]), plan)
            if isinstance(o["end"], str):
                o["end"] = self.edit_time(g.pos(o["end"]), plan, end=True)
            ov.append(o)

        p = self.p
        meta = {
            "title": f"{p['title']} ({name} cut)" if len(self.mod.SHEETS) > 1 else p["title"],
            "song": f"song/edit_{name}.wav",
            "song_start": 0.0,
            "song_end": total,
            "fade_out": 0.0,
            "fps": FPS,
            "width": 1080,
            "height": 1920,
            "default_grade": p.get("default_grade", "teal_orange"),
            "safe_zone": {"top": 130, "bottom": 484, "left": 60, "right": 140},
            "audio_plan": {"source": p["source"], "stems": p.get("stems"), "segments": plan,
                           "gain_db": p.get("gain_db", 0.0)},
        }
        meta.update(p.get("meta", {}))
        return {"meta": meta, "shots": shots, "overlays": ov}

    def song_time(self, t_edit, plan):
        off = 0.0
        for s in plan:
            d = s["to"] - s["from"]
            if off <= t_edit < off + d:
                return s["from"] + t_edit - off
            off += d
        return None

    def write_clip_list(self, edls):
        path = self.p["docs"].get("clips")
        if not path:
            return
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
            m = self.moments[mid]
            lead = ""
            if m.get("sources"):
                f = m["sources"][0]
                lead = f"[{f['title'][:48]}]({f['url']})" if f["url"] else f["title"][:48]
            elif m.get("search"):
                lead = f"search: _{m['search']}_"
            trim = m.get("trim", "").replace("|", "/")
            L.append(f"| {i} | `{os.path.basename(self.clip_path(mid))}` | **{m['title']}** — {m.get('sub', '')} | "
                     f"{trim} | {', '.join(sorted(used[mid]))} | {lead} |")
        open(os.path.join(ROOT, path), "w").write("\n".join(L) + "\n")

    def write_shotlist(self, edls):
        g = self.grid
        S = [f"# Shot list — {self.p['title']}", "",
             "Every cut, generated from the EDL. Times are on the finished edit (mm:ss.ss).",
             "\"Clip @\" is the in-point inside the clip file. Use it to assemble the edit by hand",
             "in CapCut if you prefer; the soundtrack is `song/edit_<cut>.wav`",
             "(build it with `python tools/make_audio.py edl/<cut>.json`).", ""]
        for name, edl in edls.items():
            plan = edl["meta"]["audio_plan"]["segments"]
            S += [f"## {name} — {edl['meta']['song_end']:.1f} s, {len(edl['shots'])} shots", "",
                  "Audio: " + " + ".join(f"song {s['from']:.2f}–{s['to']:.2f} s" for s in plan), "",
                  "| Shot | Time | Len | Section | Clip | Clip @ | Speed | Lyric under it | On screen | Look |",
                  "|------|------|-----|---------|------|--------|-------|----------------|-----------|------|"]
            for sh in edl["shots"]:
                st = self.song_time((sh["start"] + sh["end"]) / 2, plan)
                texts = sh.get("text", [])
                texts = texts if isinstance(texts, list) else [texts]
                txt = " · ".join(t["content"].replace("\n", " / ") for t in texts)
                look = " ".join(sh["fx"])
                for k in ("layout", "freeze", "stutter", "strobe", "step", "pulse", "glitch"):
                    if k in sh:
                        look += f" {k}" if k != "layout" else f" [{sh['layout']}]"
                if sh.get("grade"):
                    look += f" ({sh['grade']})"
                S.append(f"| {sh['id']} | {mmss(sh['start'])} | {sh['end'] - sh['start']:.2f} | "
                         f"{sh.get('section', '')} | `{sh['moment']}` {self.moments[sh['moment']]['title']} | "
                         f"{sh['in']:.2f} | {sh['speed']}{' ramp' if 'ramp' in sh else ''} | "
                         f"{g.lyric_at(st) if st is not None else ''} | {txt} | {look.strip()} |")
            if edl["overlays"]:
                S += ["", "Text overlays:", ""]
                S += [f"- {mmss(o['start'])}–{mmss(o['end'])} · {o['style']} · \"{o['content']}\""
                      for o in edl["overlays"]]
            S.append("")
        open(os.path.join(ROOT, self.p["docs"]["shotlist"]), "w").write("\n".join(S) + "\n")

    def run(self):
        os.makedirs(os.path.join(ROOT, "edl"), exist_ok=True)
        edls = {}
        for name, (sheet, overlays) in self.mod.SHEETS.items():
            edl = edls[name] = self.build(name, sheet, overlays, self.mod.PLANS[name])
            path = os.path.join(ROOT, "edl", f"{name}.json")
            json.dump(edl, open(path, "w"), indent=1, ensure_ascii=False)
            n = len(edl["shots"])
            print(f"wrote {path}: {n} shots, {edl['meta']['song_end']:.2f}s, "
                  f"{n / edl['meta']['song_end']:.2f} cuts/s")
        self.write_clip_list(edls)
        self.write_shotlist(edls)
        print("wrote " + ", ".join(v for v in self.p["docs"].values() if v))
        for n in self.notes:
            print("  fit:", n)


def seg_ends(plan):
    off = 0.0
    for s in plan:
        off += s["to"] - s["from"]
        yield round(off, 4)


def mmss(t):
    return f"{int(t // 60)}:{t % 60:05.2f}"


def main():
    for name in sys.argv[1:] or PROJECTS:
        Project(name).run()


if __name__ == "__main__":
    main()
