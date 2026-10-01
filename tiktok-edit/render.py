#!/usr/bin/env python3
"""
render.py: turn an Edit Decision List (EDL) JSON into a vertical TikTok video.

    python render.py edl/<name>.json [--out out/<name>.mp4] [--preview] [--only s03,s07]
                     [--placeholders-only] [--check] [--jobs 4] [--contact-sheet]
                     [--force] [--font path.ttf] [--squeeze 0.8] [--no-cache] [--verbose]

Pipeline
  1. load the EDL (JSON; // and /* */ comments and trailing commas are tolerated)
  2. validate it (gaps/overlaps on the frame grid, song range, clips, in-point + span)
  3. render every shot to its own segment with an EXACT frame count
         frames = round(end*fps) - round(start*fps)
     in parallel, cached in out/.cache/ (key = shot JSON + overlays + clip mtime + settings
     + this file's hash)
  4. concat the segments (concat demuxer, stream copy; identical encode params)
  5. mux the song trimmed to [song_start, song_end] with the fade-out

The format is specified in EDL_SCHEMA.md. Small optional extensions (all ignored by the
schema's required fields):
  meta.font / meta.font_body   heavy title font / body font (path relative to the project)
  meta.accent, text.accent     "#RRGGBB" accent: kicker pill colour and stat-number colour
  zoom.ease                    "in_out" (default) | "linear" | "in" | "out"
  text may also be a list of text objects (several captions in one shot)

Fonts: --font, then meta.font, then the best .ttf/.otf in fonts/, then system fonts
(DejaVu Sans Bold, horizontally squeezed to read as a heavy condensed face).
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import hashlib
import json
import math
import os
import re
import shlex
import shutil
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

try:
    import numpy as np
    from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont
except ImportError as _e:  # pragma: no cover
    sys.exit(f"render.py needs numpy and Pillow ({_e}). Install with: pip install numpy pillow")

ROOT = Path(__file__).resolve().parent
ENGINE_VERSION = "1.0"
SOURCE_HASH = hashlib.sha1(Path(__file__).read_bytes()).hexdigest()[:12]
REF_W, REF_H = 1080, 1920          # all pixel constants below are defined at this size

FX_NAMES = ["flash_in", "flash_out", "shake", "bw", "rgb_split", "glow", "vignette",
            "grain", "fade_in", "fade_out", "dip_white"]
GRADE_NAMES = ["teal_orange", "warm", "cold", "bw", "blaugrana", "gold", "none"]
STYLES = ["lyric", "stat", "title", "kicker", "quote"]
POSITIONS = ["upper", "center", "lower"]
FITS = ["crop", "blurfill"]
EASES = ["in_out", "linear", "in", "out"]

SHOT_KEYS = {"id", "start", "end", "section", "moment", "clip", "in", "speed", "ramp",
             "focus_x", "focus_y", "fit", "zoom", "fx", "grade", "text", "placeholder"}
NOTE_KEYS = {"note", "notes", "comment", "comments", "lyric", "lyrics", "beat", "beats",
             "why", "desc", "description", "source", "url"}
META_KEYS = {"title", "song", "song_start", "song_end", "fade_out", "fps", "width", "height",
             "default_grade", "safe_zone", "font", "font_body", "accent", "bpm", "notes", "note",
             "artist", "version", "author"}
TEXT_KEYS = {"content", "style", "pos", "in", "out", "accent"}
OVERLAY_KEYS = {"start", "end", "content", "style", "pos", "accent"}

DEFAULT_SAFE = {"top": 160, "bottom": 420, "right": 140}
DEFAULT_ACCENT = (165, 0, 68)        # Barça garnet
GOLD_STOPS = [(0.0, (255, 236, 160)), (0.45, (248, 196, 46)), (1.0, (196, 128, 8))]

SYSTEM_HEAVY = ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
                "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf"]
SYSTEM_BODY = ["/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
               "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
               "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf"]
SYSTEM_REGULAR = ["/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
                  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                  "/usr/share/fonts/truetype/freefont/FreeSans.ttf"]


class EDLError(Exception):
    pass


class RenderError(Exception):
    pass


# --------------------------------------------------------------------------- small helpers

def fr(t: float, fps: float) -> int:
    """seconds -> frame index on the global grid (round half up, float-noise tolerant)"""
    return int(math.floor(t * fps + 0.5 + 1e-7))


def clamp(v, lo, hi):
    return lo if v < lo else hi if v > hi else v


def even(v: float) -> int:
    return int(round(v / 2.0)) * 2


def num(v: float) -> str:
    """compact float for filter expressions"""
    s = f"{v:.6f}".rstrip("0").rstrip(".")
    return s if s not in ("", "-0") else "0"


def hex_rgb(s, default=None):
    if not isinstance(s, str):
        return default
    h = s.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if not re.fullmatch(r"[0-9a-fA-F]{6}", h):
        return default
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3))


def tc(t: float) -> str:
    m, s = divmod(max(t, 0.0), 60)
    return f"{int(m):02d}:{s:05.2f}"


def is_num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def rel(p: Path) -> str:
    try:
        return str(p.relative_to(ROOT))
    except ValueError:
        return str(p)


def stderr_tail(b: bytes, n: int = 25) -> str:
    lines = b.decode("utf-8", "replace").strip().splitlines()
    return "\n".join("    " + ln for ln in lines[-n:])


def run(cmd, what: str, verbose: bool = False) -> subprocess.CompletedProcess:
    if verbose:
        print("  $ " + " ".join(shlex.quote(str(c)) for c in cmd), flush=True)
    p = subprocess.run([str(c) for c in cmd], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode != 0:
        raise RenderError(
            f"{what} failed (exit code {p.returncode}).\n"
            f"  command: {' '.join(shlex.quote(str(c)) for c in cmd)}\n"
            f"  --- ffmpeg stderr (last lines) ---\n{stderr_tail(p.stderr)}")
    return p


_FFMPEG_MAJOR = None


def ffmpeg_major() -> int:
    global _FFMPEG_MAJOR
    if _FFMPEG_MAJOR is None:
        try:
            out = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True).stdout
            m = re.search(r"ffmpeg version n?(\d+)", out)
            _FFMPEG_MAJOR = int(m.group(1)) if m else 6
        except OSError:
            _FFMPEG_MAJOR = 6
    return _FFMPEG_MAJOR


def graph_script_args(path: Path):
    return ["-/filter_complex", str(path)] if ffmpeg_major() >= 7 else ["-filter_complex_script", str(path)]


# --------------------------------------------------------------------------- JSON (with comments)

def load_jsonc(path: Path):
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as e:
        raise EDLError(f"cannot read EDL {path}: {e}")
    out, i, n, in_str = [], 0, len(text), False
    while i < n:                                     # pass 1: strip comments (keep newlines)
        c = text[i]
        if in_str:
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(text[i + 1])
                i += 2
                continue
            if c == '"':
                in_str = False
            i += 1
            continue
        if c == '"':
            in_str = True
        elif c == "/" and text.startswith("//", i):
            j = text.find("\n", i)
            i = n if j < 0 else j
            continue
        elif c == "/" and text.startswith("/*", i):
            j = text.find("*/", i + 2)
            if j < 0:
                raise EDLError(f"{path}: unterminated /* comment")
            out.append(re.sub(r"[^\n]", " ", text[i:j + 2]))
            i = j + 2
            continue
        out.append(c)
        i += 1
    s = "".join(out)
    out, i, n, in_str = [], 0, len(s), False        # pass 2: drop trailing commas
    while i < n:
        c = s[i]
        if in_str:
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(s[i + 1])
                i += 2
                continue
            if c == '"':
                in_str = False
        elif c == '"':
            in_str = True
            out.append(c)
        elif c == ",":
            j = i + 1
            while j < n and s[j] in " \t\r\n":
                j += 1
            if j >= n or s[j] not in "}]":
                out.append(c)
        else:
            out.append(c)
        i += 1
    try:
        return json.loads("".join(out))
    except json.JSONDecodeError as e:
        lines = text.splitlines()
        ctx = lines[e.lineno - 1] if 0 < e.lineno <= len(lines) else ""
        raise EDLError(f"{path}: invalid JSON at line {e.lineno}, column {e.colno}: {e.msg}\n"
                       f"    {ctx}\n    {' ' * max(e.colno - 1, 0)}^")


# --------------------------------------------------------------------------- probing

_PROBE: dict = {}
_PROBE_LOCK = threading.Lock()


def probe_media(path: Path) -> dict:
    key = str(path)
    with _PROBE_LOCK:
        if key in _PROBE:
            return _PROBE[key]
    p = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format",
                        "-show_streams", str(path)], capture_output=True)
    if p.returncode != 0:
        raise EDLError(f"ffprobe cannot read {path}:\n{stderr_tail(p.stderr, 6)}")
    info = json.loads(p.stdout or b"{}")
    fmt = info.get("format", {})
    res = {"duration": float(fmt.get("duration") or 0.0), "video": None, "audio": None}
    for s in info.get("streams", []):
        if s.get("codec_type") == "video" and not s.get("disposition", {}).get("attached_pic") \
                and res["video"] is None:
            w, h = int(s.get("width") or 0), int(s.get("height") or 0)
            sar = 1.0
            m = re.fullmatch(r"(\d+):(\d+)", s.get("sample_aspect_ratio") or "")
            if m and int(m.group(1)) > 0 and int(m.group(2)) > 0:
                sar = int(m.group(1)) / int(m.group(2))
            rot = 0
            for sd in s.get("side_data_list", []) or []:
                if "rotation" in sd:
                    rot = int(round(float(sd["rotation"])))
            if "rotate" in (s.get("tags") or {}):
                rot = int(float(s["tags"]["rotate"]))
            rot %= 360
            if rot in (90, 270):
                w, h, sar = h, w, 1.0 / sar
            fps = 0.0
            for key_ in ("avg_frame_rate", "r_frame_rate"):
                m = re.fullmatch(r"(\d+)/(\d+)", s.get(key_) or "")
                if m and int(m.group(2)) > 0 and int(m.group(1)) > 0:
                    fps = int(m.group(1)) / int(m.group(2))
                    break
            dur = float(s.get("duration") or 0.0) or res["duration"]
            res["video"] = {"w": w, "h": h, "sar": sar, "rot": rot, "fps": fps, "duration": dur,
                            "field_order": s.get("field_order", "progressive"),
                            "pix_fmt": s.get("pix_fmt", "")}
        elif s.get("codec_type") == "audio" and res["audio"] is None:
            res["audio"] = {"duration": float(s.get("duration") or 0.0) or res["duration"],
                            "sample_rate": int(s.get("sample_rate") or 0),
                            "channels": int(s.get("channels") or 0)}
    with _PROBE_LOCK:
        _PROBE[key] = res
    return res


def count_frames(path: Path) -> int:
    p = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets",
                        "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", str(path)],
                       capture_output=True, text=True)
    try:
        return int(p.stdout.strip().split(",")[0])
    except ValueError:
        return -1


# --------------------------------------------------------------------------- data model

@dataclass
class Issue:
    level: str          # ERROR | WARN
    where: str
    msg: str
    code: str = ""


@dataclass
class TextItem:
    content: str
    style: str
    pos: str
    a: int              # first frame (local to the shot)
    b: int              # end frame, exclusive
    fade_in: bool
    fade_out: bool
    accent: tuple | None
    src: str


@dataclass
class Shot:
    idx: int
    id: str
    raw: dict
    start: float
    end: float
    f0: int = 0
    f1: int = 0
    section: str = ""
    clip_rel: str | None = None
    clip: Path | None = None
    clip_exists: bool = False
    clip_info: dict | None = None
    inp: float = 0.0
    speed: float = 1.0
    ramp: dict | None = None
    focus_x: float = 0.5
    focus_y: float = 0.5
    fit: str = "crop"
    z0: float = 1.0
    z1: float = 1.0
    ease: str = "in_out"
    fx: list = field(default_factory=list)
    grade: str = "none"
    text_raw: list = field(default_factory=list)
    placeholder: dict = field(default_factory=dict)
    texts: list = field(default_factory=list)

    @property
    def N(self) -> int:
        return self.f1 - self.f0


@dataclass
class EDL:
    path: Path
    meta: dict
    shots: list
    overlays: list
    song: Path
    song_start: float
    song_end: float
    fade_out: float
    fps: float
    width: int
    height: int
    default_grade: str
    safe: dict
    accent: tuple
    title: str

    @property
    def length(self) -> float:
        return self.song_end - self.song_start


def resolve_path(p: str, edl_path: Path) -> Path:
    q = Path(os.path.expanduser(p))
    if q.is_absolute():
        return q
    cand = ROOT / q
    if cand.exists():
        return cand
    alt = edl_path.parent / q
    return alt if alt.exists() else cand


def source_span(shot: Shot, fps: float) -> float:
    D = shot.N / fps
    if shot.ramp:
        a = shot.ramp["at"]
        return D * a * shot.ramp["from"] + D * (1 - a) * shot.ramp["to"]
    return D * shot.speed


# --------------------------------------------------------------------------- load + validate

def load_edl(edl_path: Path, issues: list) -> EDL:
    data = load_jsonc(edl_path)
    if not isinstance(data, dict):
        raise EDLError(f"{edl_path}: top level must be an object with 'meta' and 'shots'")
    meta = data.get("meta")
    if not isinstance(meta, dict):
        raise EDLError(f"{edl_path}: missing 'meta' object")
    shots_raw = data.get("shots")
    if not isinstance(shots_raw, list) or not shots_raw:
        raise EDLError(f"{edl_path}: 'shots' must be a non-empty list")

    def E(where, msg, code=""):
        issues.append(Issue("ERROR", where, msg, code))

    def W(where, msg, code=""):
        issues.append(Issue("WARN", where, msg, code))

    for k in meta:
        if k not in META_KEYS and not k.startswith("_"):
            W("meta", f"unknown key '{k}' (ignored)")
    for k in data:
        if k not in ("meta", "shots", "overlays") and not k.startswith("_"):
            W("edl", f"unknown top-level key '{k}' (ignored)")

    if not isinstance(meta.get("song"), str):
        raise EDLError("meta.song is required (path to the song, relative to the project root)")
    song = resolve_path(meta["song"], edl_path)
    fps = meta.get("fps", 30)
    if not is_num(fps) or fps <= 0 or fps > 120:
        raise EDLError(f"meta.fps must be a positive number, got {fps!r}")
    for key in ("song_start", "song_end"):
        if not is_num(meta.get(key)):
            raise EDLError(f"meta.{key} is required and must be a number (seconds)")
    song_start, song_end = float(meta["song_start"]), float(meta["song_end"])
    if song_start < 0 or song_end <= song_start:
        raise EDLError(f"meta.song_start/song_end invalid: {song_start} .. {song_end}")
    fade_out = meta.get("fade_out", 0.0)
    if not is_num(fade_out) or fade_out < 0:
        E("meta", f"fade_out must be >= 0 (got {fade_out!r}); using 0")
        fade_out = 0.0
    if fade_out > song_end - song_start:
        E("meta", f"fade_out {fade_out}s is longer than the edit ({song_end - song_start:.3f}s)")
    width, height = meta.get("width", 1080), meta.get("height", 1920)
    if not (isinstance(width, int) and isinstance(height, int) and width > 0 and height > 0
            and width % 2 == 0 and height % 2 == 0):
        raise EDLError(f"meta.width/height must be positive even integers (got {width}x{height})")
    dg = meta.get("default_grade", "none")
    if dg not in GRADE_NAMES:
        E("meta", f"unknown default_grade '{dg}' (valid: {', '.join(GRADE_NAMES)})")
        dg = "none"
    safe = dict(DEFAULT_SAFE)
    if meta.get("safe_zone") is not None:
        sz = meta["safe_zone"]
        if not isinstance(sz, dict):
            E("meta", "safe_zone must be an object {top, bottom, right}")
        else:
            for k_, v in sz.items():
                if k_ not in ("top", "bottom", "right", "left"):
                    W("meta", f"unknown safe_zone key '{k_}'")
                elif not is_num(v) or v < 0:
                    E("meta", f"safe_zone.{k_} must be a number >= 0")
                else:
                    safe[k_] = float(v)
    accent = hex_rgb(meta.get("accent"), DEFAULT_ACCENT) if meta.get("accent") else DEFAULT_ACCENT

    edl = EDL(path=edl_path, meta=meta, shots=[], overlays=[], song=song, song_start=song_start,
              song_end=song_end, fade_out=float(fade_out), fps=float(fps), width=width,
              height=height, default_grade=dg, safe=safe, accent=accent,
              title=str(meta.get("title") or edl_path.stem))

    # --- shots
    seen = set()
    for i, s in enumerate(shots_raw):
        where = f"shot[{i}]"
        if not isinstance(s, dict):
            E(where, "shot must be an object")
            continue
        sid = s.get("id")
        if not isinstance(sid, str) or not sid.strip():
            sid = f"#{i + 1}"
            E(where, "missing 'id'")
        where = sid
        if sid in seen:
            E(where, f"duplicate shot id '{sid}'")
        seen.add(sid)
        for k_ in s:
            if k_ not in SHOT_KEYS and k_ not in NOTE_KEYS and not k_.startswith("_"):
                W(where, f"unknown key '{k_}' (typo? ignored)")
        if not is_num(s.get("start")) or not is_num(s.get("end")):
            E(where, "start and end are required numbers (seconds on the output timeline)")
            continue
        sh = Shot(idx=i, id=sid, raw=s, start=float(s["start"]), end=float(s["end"]))
        sh.f0, sh.f1 = fr(sh.start, fps), fr(sh.end, fps)
        if sh.end <= sh.start:
            E(where, f"end ({sh.end}) must be after start ({sh.start})")
        elif sh.N < 1:
            E(where, f"shot is shorter than one frame at {fps} fps ({sh.end - sh.start:.4f}s)")
        sh.section = str(s.get("section") or "")
        # clip
        clip = s.get("clip")
        if clip not in (None, ""):
            if not isinstance(clip, str):
                E(where, "clip must be a string path")
            else:
                sh.clip_rel = clip
                sh.clip = resolve_path(clip, edl_path)
                sh.clip_exists = sh.clip.is_file()
        inp = s.get("in", 0.0)
        if inp is None:
            inp = 0.0
        if not is_num(inp) or inp < 0:
            E(where, f"in must be a number >= 0 (got {inp!r})")
            inp = 0.0
        sh.inp = float(inp)
        sp = s.get("speed", 1.0)
        if sp is None:
            sp = 1.0
        if not is_num(sp) or sp <= 0:
            E(where, f"speed must be > 0 (got {sp!r})")
            sp = 1.0
        sh.speed = float(sp)
        rp = s.get("ramp")
        if rp is not None:
            if not isinstance(rp, dict):
                E(where, "ramp must be an object {from, to, at}")
            else:
                rf, rt, ra = rp.get("from", sh.speed), rp.get("to"), rp.get("at", 0.5)
                if not (is_num(rf) and rf > 0 and is_num(rt) and rt > 0):
                    E(where, "ramp.from and ramp.to must be numbers > 0")
                elif not (is_num(ra) and 0 < ra < 1):
                    E(where, "ramp.at must be a fraction strictly between 0 and 1")
                else:
                    sh.ramp = {"from": float(rf), "to": float(rt), "at": float(ra)}
                    if "speed" in s and abs(sh.speed - 1.0) > 1e-9:
                        W(where, "both speed and ramp given; ramp wins")
        for key in ("focus_x", "focus_y"):
            v = s.get(key, 0.5)
            if v is None:
                v = 0.5
            if not is_num(v) or not 0 <= v <= 1:
                E(where, f"{key} must be between 0 and 1 (got {v!r})")
                v = clamp(float(v), 0, 1) if is_num(v) else 0.5
            setattr(sh, key, float(v))
        fit = s.get("fit", "crop") or "crop"
        if fit not in FITS:
            E(where, f"unknown fit '{fit}' (valid: crop, blurfill)")
            fit = "crop"
        sh.fit = fit
        zm = s.get("zoom")
        if zm is not None:
            if is_num(zm):
                zm = {"from": zm, "to": zm}
            if not isinstance(zm, dict):
                E(where, "zoom must be an object {from, to}")
            else:
                z0, z1 = zm.get("from", 1.0), zm.get("to", zm.get("from", 1.0))
                if not (is_num(z0) and is_num(z1) and z0 > 0 and z1 > 0):
                    E(where, "zoom.from/to must be numbers > 0")
                else:
                    if z0 < 1 or z1 < 1:
                        W(where, f"zoom below 1.0 is not possible without showing borders; "
                                 f"clamped to 1.0 (from {z0}, to {z1})")
                    if max(z0, z1) > 4:
                        W(where, f"zoom {max(z0, z1)} is extreme (soft image)")
                    sh.z0, sh.z1 = max(1.0, float(z0)), max(1.0, float(z1))
                ease = zm.get("ease", "in_out")
                if ease not in EASES:
                    E(where, f"unknown zoom.ease '{ease}' (valid: {', '.join(EASES)})")
                else:
                    sh.ease = ease
        fx = s.get("fx") or []
        if isinstance(fx, str):
            fx = [fx]
        if not isinstance(fx, list):
            E(where, "fx must be a list of names")
            fx = []
        for f_ in fx:
            if f_ not in FX_NAMES:
                E(where, f"unknown fx '{f_}' (valid: {', '.join(FX_NAMES)})")
        sh.fx = [f_ for f_ in dict.fromkeys(fx) if f_ in FX_NAMES]
        g = s.get("grade") or dg
        if g not in GRADE_NAMES:
            E(where, f"unknown grade '{g}' (valid: {', '.join(GRADE_NAMES)})")
            g = dg
        sh.grade = g
        txt = s.get("text")
        if txt is not None:
            items = txt if isinstance(txt, list) else [txt]
            for t_ in items:
                if not isinstance(t_, dict):
                    E(where, "text must be an object {content, style, pos, in, out}")
                    continue
                for k_ in t_:
                    if k_ not in TEXT_KEYS and not k_.startswith("_"):
                        W(where, f"unknown text key '{k_}'")
                sh.text_raw.append(t_)
        ph = s.get("placeholder") or {}
        if not isinstance(ph, dict):
            E(where, "placeholder must be an object {title, sub, hint, color}")
            ph = {}
        if ph.get("color") is not None and hex_rgb(ph.get("color")) is None:
            W(where, f"placeholder.color '{ph.get('color')}' is not #RRGGBB; using default")
        sh.placeholder = ph
        edl.shots.append(sh)

    # --- overlays
    ovs = data.get("overlays") or []
    if not isinstance(ovs, list):
        E("overlays", "overlays must be a list")
        ovs = []
    for j, o in enumerate(ovs):
        where = f"overlay[{j}]"
        if not isinstance(o, dict):
            E(where, "overlay must be an object")
            continue
        for k_ in o:
            if k_ not in OVERLAY_KEYS and not k_.startswith("_"):
                W(where, f"unknown key '{k_}'")
        if not is_num(o.get("start")) or not is_num(o.get("end")) or o["end"] <= o["start"]:
            E(where, "overlay needs numeric start < end (seconds on the output timeline)")
            continue
        edl.overlays.append(o)
    return edl


def validate_text(where, t: dict, dur: float, issues: list, kind="text"):
    ok = True
    content = t.get("content")
    if not isinstance(content, str) or not content.strip():
        issues.append(Issue("WARN", where, f"{kind} has empty content (skipped)"))
        return False
    st = t.get("style", "lyric")
    if st not in STYLES:
        issues.append(Issue("ERROR", where, f"unknown {kind} style '{st}' (valid: {', '.join(STYLES)})"))
        ok = False
    ps = t.get("pos", "center")
    if ps not in POSITIONS:
        issues.append(Issue("ERROR", where, f"unknown {kind} pos '{ps}' (valid: {', '.join(POSITIONS)})"))
        ok = False
    if t.get("accent") is not None and hex_rgb(t.get("accent")) is None:
        issues.append(Issue("WARN", where, f"{kind} accent '{t.get('accent')}' is not #RRGGBB"))
    if kind == "text":
        a = t.get("in", 0.0) or 0.0
        b = t.get("out")
        if not is_num(a) or a < 0:
            issues.append(Issue("ERROR", where, f"text.in must be >= 0 (got {a!r})"))
            ok = False
        elif a >= dur - 1e-6:
            issues.append(Issue("ERROR", where, f"text.in ({a}) is not inside the shot ({dur:.3f}s)"))
            ok = False
        if b is not None:
            if not is_num(b):
                issues.append(Issue("ERROR", where, f"text.out must be a number or null (got {b!r})"))
                ok = False
            elif is_num(a) and b <= a:
                issues.append(Issue("ERROR", where, f"text.out ({b}) must be after text.in ({a})"))
                ok = False
            elif b > dur + 0.5 / 30:
                issues.append(Issue("WARN", where, f"text.out ({b}) is past the shot end ({dur:.3f}s); clamped"))
    return ok


def validate(edl: EDL, issues: list, placeholders_only: bool = False, probe_clips: bool = True):
    fps = edl.fps
    L = edl.length
    LF = fr(L, fps)

    def E(where, msg, code=""):
        issues.append(Issue("ERROR", where, msg, code))

    def W(where, msg, code=""):
        issues.append(Issue("WARN", where, msg, code))

    # song
    if not edl.song.is_file():
        E("meta", f"song not found: {edl.song}", "song")
    else:
        try:
            info = probe_media(edl.song)
            sd = (info["audio"] or {}).get("duration") or info["duration"]
            if info["audio"] is None:
                E("meta", f"song has no audio stream: {edl.song}", "song")
            elif edl.song_end > sd + 0.05:
                E("meta", f"song_end {edl.song_end:.3f}s is past the end of the song ({sd:.3f}s)", "song")
        except EDLError as e:
            E("meta", str(e), "song")

    # timeline continuity on the frame grid
    shots = sorted(edl.shots, key=lambda s: (s.start, s.end))
    if [s.id for s in shots] != [s.id for s in edl.shots]:
        W("shots", "shots are not in chronological order in the file (rendered by start time)")
    edl.shots = shots
    if shots:
        if shots[0].f0 != 0:
            E(shots[0].id, f"gap at the start: first shot starts at {shots[0].start:.3f}s "
                           f"({shots[0].f0} frames) instead of 0", "gap")
        for a, b in zip(shots, shots[1:]):
            if b.f0 > a.f1:
                E(b.id, f"gap of {(b.f0 - a.f1) / fps:.3f}s ({b.f0 - a.f1} frames) between "
                        f"{a.id} (ends {a.end:.3f}) and {b.id} (starts {b.start:.3f})", "gap")
            elif b.f0 < a.f1:
                E(b.id, f"overlap of {(a.f1 - b.f0) / fps:.3f}s ({a.f1 - b.f0} frames): {b.id} starts "
                        f"{b.start:.3f} before {a.id} ends {a.end:.3f}", "overlap")
        last = shots[-1]
        for s in shots:
            if s.f1 > LF:
                E(s.id, f"shot ends at {s.end:.3f}s, past song_end (edit length "
                        f"{L:.3f}s = song_end {edl.song_end} - song_start {edl.song_start})", "past_end")
        if last.f1 < LF:
            E(last.id, f"gap at the end: last shot ends at {last.end:.3f}s but the edit is {L:.3f}s long "
                       f"(song_end - song_start); extend the last shot or lower song_end", "gap")

    # per-shot details
    for s in shots:
        dur = s.N / fps
        if s.text_raw:
            good = []
            for t_ in s.text_raw:
                if validate_text(s.id, t_, max(dur, 1e-6), issues):
                    good.append(t_)
            s.text_raw = good
        if s.clip_rel is None:
            continue
        if not s.clip_exists:
            continue                      # reported as a missing clip (placeholder), not an error
        if not probe_clips:
            continue
        try:
            info = probe_media(s.clip)
        except EDLError as e:
            E(s.id, str(e), "clip_bad")
            continue
        if info["video"] is None:
            E(s.id, f"clip has no video stream: {s.clip_rel}", "clip_bad")
            continue
        s.clip_info = info["video"]
        cd = info["video"]["duration"] or info["duration"]
        span = source_span(s, fps)
        tol = 1.0 / max(info["video"]["fps"] or fps, 1.0)
        if s.inp >= cd:
            E(s.id, f"in-point {s.inp:.3f}s is past the end of {s.clip_rel} ({cd:.3f}s)", "clip_short")
        elif s.inp + span > cd + tol:
            E(s.id, f"in {s.inp:.3f}s + source span {span:.3f}s = {s.inp + span:.3f}s is past the end of "
                    f"{s.clip_rel} ({cd:.3f}s) by {s.inp + span - cd:.3f}s "
                    f"(--force holds the last frame)", "clip_short")
        v = info["video"]
        if v["w"] < 16 or v["h"] < 16:
            E(s.id, f"clip resolution {v['w']}x{v['h']} is too small", "clip_bad")

    # overlays inside the edit
    for j, o in enumerate(edl.overlays):
        where = f"overlay[{j}]"
        validate_text(where, o, L, issues, kind="overlay")
        if o["start"] < 0 or fr(o["end"], fps) > LF:
            W(where, f"overlay {o['start']}-{o['end']}s extends outside the edit (0-{L:.3f}s); clipped")
        if fr(o["end"], fps) <= fr(o["start"], fps):
            W(where, "overlay is shorter than one frame (skipped)")

    # same position, same time -> collision warning
    for s in shots:
        uses = {}
        for t_ in s.text_raw:
            uses.setdefault(t_.get("pos", "center"), []).append("text")
        for j, o in enumerate(edl.overlays):
            if fr(o["start"], fps) < s.f1 and fr(o["end"], fps) > s.f0:
                uses.setdefault(o.get("pos", "center"), []).append(f"overlay[{j}]")
        for pos, who in uses.items():
            if len(who) > 1:
                W(s.id, f"{' and '.join(who)} share pos '{pos}' at the same time (they will overlap)")


def attach_texts(edl: EDL):
    """resolve shot text + global overlays into per-shot TextItems (frame-exact, local frames)"""
    fps = edl.fps
    for s in edl.shots:
        s.texts = []
        N = s.N
        for t_ in s.text_raw:
            a = fr(float(t_.get("in", 0.0) or 0.0), fps)
            b = N if t_.get("out") is None else fr(float(t_["out"]), fps)
            a, b = clamp(a, 0, N), clamp(b, 0, N)
            if b <= a:
                continue
            s.texts.append(TextItem(content=t_["content"], style=t_.get("style", "lyric"),
                                    pos=t_.get("pos", "center"), a=a, b=b, fade_in=a > 0,
                                    fade_out=b < N, accent=hex_rgb(t_.get("accent")), src="text"))
        for j, o in enumerate(edl.overlays):
            if o.get("style", "kicker") not in STYLES or o.get("pos", "upper") not in POSITIONS:
                continue
            if not isinstance(o.get("content"), str) or not o["content"].strip():
                continue
            o0, o1 = fr(o["start"], fps), fr(o["end"], fps)
            if o0 >= s.f1 or o1 <= s.f0 or o1 <= o0:
                continue
            a, b = max(o0, s.f0) - s.f0, min(o1, s.f1) - s.f0
            s.texts.append(TextItem(content=o["content"], style=o.get("style", "kicker"),
                                    pos=o.get("pos", "upper"), a=a, b=b,
                                    fade_in=o0 > s.f0, fade_out=o1 < s.f1,
                                    accent=hex_rgb(o.get("accent")), src=f"overlay[{j}]"))


# --------------------------------------------------------------------------- render settings + fonts

FONT_HEAVY_WORDS = {"black": 4, "heavy": 4, "extrabold": 3, "ultra": 3, "bold": 2, "condensed": 2,
                    "compressed": 2, "narrow": 1, "anton": 4, "bebas": 3, "oswald": 3, "impact": 4,
                    "league": 2, "gothic": 1, "display": 1}
FONT_BAD_WORDS = {"italic": -6, "oblique": -6, "light": -4, "thin": -5, "mono": -3}


def _font_score(p: Path) -> int:
    n = p.stem.lower().replace("-", "").replace("_", "")
    return sum(v for k, v in FONT_HEAVY_WORDS.items() if k in n) + \
        sum(v for k, v in FONT_BAD_WORDS.items() if k in n)


def _first_existing(paths):
    for p in paths:
        if Path(p).is_file():
            return str(p)
    return None


@dataclass
class Fonts:
    heavy: str
    body: str
    regular: str
    squeeze: float

    def describe(self) -> str:
        return (f"heavy={Path(self.heavy).name} (squeeze {self.squeeze:.2f}), body={Path(self.body).name}")


def pick_fonts(edl: EDL, cli_font: str | None, cli_squeeze: float | None) -> Fonts:
    heavy = body = None
    user_dir = sorted([p for p in (ROOT / "fonts").glob("*") if p.suffix.lower() in (".ttf", ".otf", ".ttc")])
    if cli_font:
        p = Path(cli_font).expanduser()
        if not p.is_file():
            p = ROOT / cli_font
        if not p.is_file():
            raise EDLError(f"--font {cli_font}: file not found")
        heavy = str(p)
    elif edl.meta.get("font"):
        p = resolve_path(str(edl.meta["font"]), edl.path)
        if not p.is_file():
            raise EDLError(f"meta.font {edl.meta['font']}: file not found")
        heavy = str(p)
    elif user_dir:
        heavy = str(max(user_dir, key=lambda p: (_font_score(p), -len(p.name))))
    if edl.meta.get("font_body"):
        p = resolve_path(str(edl.meta["font_body"]), edl.path)
        if not p.is_file():
            raise EDLError(f"meta.font_body {edl.meta['font_body']}: file not found")
        body = str(p)
    elif user_dir:
        rest = [p for p in user_dir if str(p) != heavy]
        if rest:
            body = str(max(rest, key=lambda p: (_font_score(p) - 2 * ("condensed" in p.stem.lower()), 0)))
    heavy = heavy or _first_existing(SYSTEM_HEAVY)
    body = body or _first_existing(SYSTEM_BODY) or heavy
    regular = _first_existing(SYSTEM_REGULAR) or body
    if not heavy:
        raise EDLError("no usable font found: put a .ttf into fonts/ or pass --font")
    for f_ in (heavy, body, regular):
        try:
            ImageFont.truetype(f_, 40)
        except OSError as e:
            raise EDLError(f"cannot load font {f_}: {e}")
    if cli_squeeze:
        squeeze = clamp(float(cli_squeeze), 0.5, 1.0)
    else:   # make wide faces read as heavy-condensed; leave already-narrow faces alone
        f_ = ImageFont.truetype(heavy, 100)
        ratio = f_.getlength("HAMBURGEFONTSIV") / (15 * 100)
        squeeze = round(clamp(0.6 / ratio, 0.76, 1.0), 3)
    return Fonts(heavy=heavy, body=body, regular=regular, squeeze=squeeze)


@dataclass
class Settings:
    W: int
    H: int
    fps: float
    k: float
    ky: float
    preview: bool
    placeholders_only: bool
    force: bool
    preset: str
    crf: int
    abitrate: str
    interp: str
    scale_flags: str
    safe_top: float
    safe_bottom: float
    safe_right: float
    fonts: Fonts
    accent: tuple
    verbose: bool = False

    @property
    def maxw(self) -> float:
        return self.W - 2 * (self.safe_right + 16 * self.k)

    def key(self) -> dict:
        return {"W": self.W, "H": self.H, "fps": self.fps, "preview": self.preview,
                "ph": self.placeholders_only, "force": self.force, "preset": self.preset,
                "crf": self.crf, "safe": [self.safe_top, self.safe_bottom, self.safe_right],
                "fonts": [(f_, os.path.getmtime(f_)) for f_ in
                          (self.fonts.heavy, self.fonts.body, self.fonts.regular)],
                "squeeze": self.fonts.squeeze, "accent": self.accent}


def make_settings(edl: EDL, args, fonts: Fonts) -> Settings:
    W, H = edl.width, edl.height
    if args.preview:
        W, H = even(W / 2), even(H / 2)
    k, ky = W / REF_W, H / REF_H
    return Settings(W=W, H=H, fps=edl.fps, k=k, ky=ky, preview=args.preview,
                    placeholders_only=args.placeholders_only, force=args.force,
                    preset="ultrafast" if args.preview else "slow",
                    crf=23 if args.preview else 17, abitrate="192k" if args.preview else "320k",
                    interp="linear" if args.preview else "cubic",
                    scale_flags="bilinear" if args.preview else "lanczos",
                    safe_top=edl.safe["top"] * ky, safe_bottom=edl.safe["bottom"] * ky,
                    safe_right=edl.safe["right"] * k, fonts=fonts, accent=edl.accent,
                    verbose=args.verbose)


# --------------------------------------------------------------------------- text rendering (Pillow)

_TLS = threading.local()


def font(path: str, size: float) -> ImageFont.FreeTypeFont:
    cache = getattr(_TLS, "fonts", None)
    if cache is None:
        cache = _TLS.fonts = {}
    key = (path, max(4, int(round(size))))
    if key not in cache:
        cache[key] = ImageFont.truetype(path, key[1])
    return cache[key]


def balanced_wrap(words, maxc):
    n = len(words)
    lens = [len(w) for w in words]
    best = [math.inf] * (n + 1)
    best[n] = 0.0
    nxt = [n] * (n + 1)
    for i in range(n - 1, -1, -1):
        L = -1
        for j in range(i, n):
            L += lens[j] + 1
            if L > maxc and j > i:
                break
            cost = (maxc - L) ** 2 if L <= maxc else 0.0
            if cost + best[j + 1] < best[i]:
                best[i], nxt[i] = cost + best[j + 1], j + 1
    lines, i = [], 0
    while i < n:
        lines.append(" ".join(words[i:nxt[i]]))
        i = nxt[i]
    return lines


def wrap_text(text: str, maxc: int):
    out = []
    for para in text.replace("\\n", "\n").split("\n"):
        words = para.split()
        out.extend(balanced_wrap(words, maxc) if words else [""])
    return out


def line_mask(text, fnt, tracking_px=0.0, squeeze=1.0, shear=0.0):
    asc, desc = fnt.getmetrics()
    size = fnt.size
    pad = int(size * 0.3) + 4
    if tracking_px:
        adv = sum(fnt.getlength(text[i:i + 2]) - fnt.getlength(text[i + 1:i + 2]) for i in range(len(text)))
        adv += tracking_px * max(len(text) - 1, 0)
    else:
        adv = fnt.getlength(text)
    w = int(math.ceil(adv)) + 2 * pad + int(abs(shear) * (asc + desc))
    h = asc + desc + 2 * pad
    img = Image.new("L", (max(w, 1), h), 0)
    d = ImageDraw.Draw(img)
    base = pad + asc
    if tracking_px:
        x = float(pad)
        for i, ch in enumerate(text):
            d.text((x, base), ch, font=fnt, fill=255, anchor="ls")
            nx = text[i + 1:i + 2]
            x += fnt.getlength(ch + nx) - fnt.getlength(nx) + tracking_px
    else:
        d.text((pad, base), text, font=fnt, fill=255, anchor="ls")
    if shear:
        img = img.transform(img.size, Image.AFFINE, (1, shear, -shear * base, 0, 1, 0),
                            resample=Image.BICUBIC)
    if squeeze != 1.0:
        img = img.resize((max(1, int(round(img.width * squeeze))), img.height), Image.LANCZOS)
    return img


def text_block(lines, fnt, tracking_em=0.0, squeeze=1.0, lh=1.0, shear=0.0):
    """tight 'L' mask of centred lines"""
    size = fnt.size
    masks = []
    for ln in lines:
        m = line_mask(ln, fnt, tracking_em * size, squeeze, shear) if ln else None
        if m is not None:
            bb = m.getbbox()
            m = m.crop((bb[0], 0, bb[2], m.height)) if bb else None
        masks.append(m)
    real = [m for m in masks if m is not None]
    if not real:
        return Image.new("L", (1, 1), 0)
    width = max(m.width for m in real)
    mh = max(m.height for m in real)
    adv = size * lh
    H = int(math.ceil(mh + adv * (len(lines) - 1)))
    block = Image.new("L", (width, H), 0)
    for i, m in enumerate(masks):
        if m is None:
            continue
        x, y = (width - m.width) // 2, int(round(i * adv))
        region = block.crop((x, y, x + m.width, y + m.height))
        block.paste(ImageChops.lighter(region, m), (x, y))
    bb = block.getbbox()
    return block.crop(bb) if bb else block


def fit_block(lines, path, size, maxw, maxh, **kw):
    """render, shrinking the font until the block fits maxw x maxh"""
    for _ in range(8):
        m = text_block(lines, font(path, size), **kw)
        if m.width <= maxw and m.height <= maxh:
            return m, size
        size *= min(maxw / max(m.width, 1), maxh / max(m.height, 1)) * 0.985
    return m, size


def solid(mask, rgb, alpha=1.0):
    img = Image.new("RGBA", mask.size, tuple(rgb) + (255,))
    img.putalpha(mask if alpha >= 1 else mask.point(lambda v: int(v * alpha)))
    return img


def vgradient(mask, stops):
    h, w = mask.height, mask.width
    ys = np.linspace(0, 1, max(h, 2))[:h]
    pos = np.array([s[0] for s in stops])
    cols = np.array([s[1] for s in stops], dtype=np.float32)
    rgb = np.stack([np.interp(ys, pos, cols[:, c]) for c in range(3)], axis=1)
    arr = np.broadcast_to(rgb[:, None, :], (h, w, 3)).astype(np.uint8)
    img = Image.fromarray(np.ascontiguousarray(arr), "RGB").convert("RGBA")
    img.putalpha(mask)
    return img


def with_shadow(fill: Image.Image, k: float, soft=(10, 5, 0.55), tight=(2.5, 2, 0.45)):
    pad = int(math.ceil((soft[0] * 3 + soft[1]) * k)) + 3
    w, h = fill.size
    size = (w + 2 * pad, h + 2 * pad)
    alpha = fill.getchannel("A")
    total = Image.new("L", size, 0)
    for blur, off, a in (soft, tight):
        if a <= 0:
            continue
        layer = Image.new("L", size, 0)
        layer.paste(alpha, (pad, pad + int(round(off * k))))
        layer = layer.filter(ImageFilter.GaussianBlur(max(blur * k, 0.5))).point(lambda v, a=a: int(v * a))
        total = ImageChops.lighter(total, layer)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.putalpha(total)
    out.alpha_composite(fill, (pad, pad))
    return out, pad


def stack(parts, gap_list):
    """vertically stack RGBA images (centred) with gaps between them"""
    w = max(p.width for p in parts)
    h = sum(p.height for p in parts) + sum(gap_list)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    y = 0
    for i, p in enumerate(parts):
        out.alpha_composite(p, ((w - p.width) // 2, y))
        y += p.height + (gap_list[i] if i < len(gap_list) else 0)
    return out


def luma(rgb):
    return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255


def render_caption(item: TextItem, S: Settings):
    """-> (RGBA image incl. shadow padding, ink width, ink height, pad)"""
    k, F = S.k, S.fonts
    maxw = S.maxw
    maxh = (S.H - S.safe_top - S.safe_bottom) * 0.85
    content = item.content.strip()
    accent = item.accent or S.accent
    st = item.style
    if st == "lyric":
        lines = wrap_text(content.upper(), 14)
        m, _ = fit_block(lines, F.heavy, 112 * k, maxw, maxh, squeeze=F.squeeze, lh=0.96)
        fill = solid(m, (255, 255, 255))
        img, pad = with_shadow(fill, k)
    elif st == "title":
        lines = wrap_text(content.upper(), 11)
        m, _ = fit_block(lines, F.heavy, 162 * k, maxw, maxh, squeeze=F.squeeze, lh=0.9,
                         tracking_em=-0.025)
        fill = solid(m, (255, 255, 255))
        img, pad = with_shadow(fill, k, soft=(14, 6, 0.6), tight=(3, 2.5, 0.5))
    elif st == "stat":
        parts = [p.strip() for p in content.replace("\\n", "\n").split("\n") if p.strip()]
        if len(parts) == 1:
            toks = parts[0].split()
            if len(toks) > 1 and any(ch.isdigit() for ch in toks[0]):
                parts = [toks[0], " ".join(toks[1:])]
        nm, nsize = fit_block([parts[0].upper()], F.heavy, 240 * k, maxw, maxh * 0.6,
                              squeeze=F.squeeze, lh=1.0, tracking_em=-0.01)
        if item.accent:
            stops = [(0.0, mix(accent, (255, 255, 255), 0.45)), (0.5, accent), (1.0, mix(accent, (0, 0, 0), 0.3))]
        else:
            stops = GOLD_STOPS
        pieces = [vgradient(nm, stops)]
        gaps = []
        if len(parts) > 1:
            label_lines = []
            for p in parts[1:]:
                label_lines.extend(wrap_text(p.upper(), 24))
            lm, _ = fit_block(label_lines, F.body, 46 * k, maxw, maxh * 0.3, tracking_em=0.14, lh=1.25)
            rule_w, rule_h = int(round(110 * k)), max(2, int(round(7 * k)))
            rule = Image.new("RGBA", (rule_w, rule_h), (0, 0, 0, 0))
            ImageDraw.Draw(rule).rounded_rectangle((0, 0, rule_w - 1, rule_h - 1), radius=rule_h // 2,
                                                   fill=stops[1][1] + (255,))
            pieces += [rule, solid(lm, (255, 255, 255))]
            gaps = [int(round(nsize * 0.11)), int(round(nsize * 0.10))]
        fill = stack(pieces, gaps)
        img, pad = with_shadow(fill, k, soft=(12, 6, 0.6), tight=(3, 2, 0.45))
    elif st == "kicker":
        lines = [ln.upper() for ln in content.replace("\\n", "\n").split("\n")]
        size = 40 * k
        px, py = 0.8, 0.5
        m, size = fit_block(lines, F.body, size, maxw - 2 * px * size, maxh, tracking_em=0.12, lh=1.3)
        pw, ph_ = int(round(m.width + 2 * px * size)), int(round(m.height + 2 * py * size))
        r = ph_ // 2 if len(lines) == 1 else int(round(0.35 * size))
        box = Image.new("RGBA", (pw, ph_), (0, 0, 0, 0))
        ImageDraw.Draw(box).rounded_rectangle((0, 0, pw - 1, ph_ - 1), radius=r, fill=tuple(accent) + (255,))
        tcol = (17, 17, 17) if luma(accent) > 0.62 else (255, 255, 255)
        box.alpha_composite(solid(m, tcol), ((pw - m.width) // 2, (ph_ - m.height) // 2))
        img, pad = with_shadow(box, k, soft=(10, 4, 0.35), tight=(0, 0, 0))
    else:  # quote
        txt = content
        if txt[:1] not in "\"“'«":
            txt = "“" + txt + "”"
        lines = wrap_text(txt, 24)
        m, _ = fit_block(lines, F.body, 62 * k, maxw, maxh, lh=1.22, shear=0.2)
        fill = solid(m, (255, 255, 255))
        img, pad = with_shadow(fill, k, soft=(9, 4, 0.6), tight=(2, 1.5, 0.5))
    return img, img.width - 2 * pad, img.height - 2 * pad, pad


def place_box(w, h, pos, S: Settings):
    top, bot = S.safe_top, S.H - S.safe_bottom
    x = (S.W - w) / 2
    if pos == "upper":
        y = top + 0.045 * S.H
    elif pos == "lower":
        y = bot - 0.03 * S.H - h
    else:
        y = (top + bot) / 2 - h / 2
    y = clamp(y, top, max(top, bot - h))
    return int(round(x)), int(round(y))


# --------------------------------------------------------------------------- placeholder card

def placeholder_assets(shot: Shot, S: Settings, edl: EDL, outdir: Path, missing: bool):
    W, H, k, F = S.W, S.H, S.k, S.fonts
    ph = shot.placeholder or {}
    c = hex_rgb(ph.get("color"), None) or (51, 65, 85)
    title = str(ph.get("title") or shot.raw.get("moment") or (Path(shot.clip_rel).stem if shot.clip_rel else shot.id))
    sub = str(ph.get("sub") or "")
    hint = str(ph.get("hint") or "")

    # --- background: diagonal gradient + glow + stripes + vignette + dither noise
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    xn, yn = xx / W, yy / H
    t = np.clip(0.3 * xn + 0.7 * yn, 0, 1)[..., None]
    light = np.array(mix(c, (255, 255, 255), 0.16), np.float32)
    dark = np.array(mix(c, (0, 0, 0), 0.62), np.float32)
    img = light * (1 - t) + dark * t
    r = np.sqrt(((xn - 0.5) * W / H) ** 2 + (yn - 0.33) ** 2) / 0.62
    glow = (np.clip(1 - r, 0, 1) ** 2 * 0.28)[..., None]
    img = img + (255 - img) * glow
    period = 72 * k
    stripes = (((xx + yy) / period) % 1.0 < 0.3).astype(np.float32)[..., None]
    img = img + stripes * 7.0
    rv = np.sqrt((xn - 0.5) ** 2 + (yn - 0.5) ** 2) / 0.71
    img = img * (1 - 0.38 * np.clip(rv - 0.45, 0, 1)[..., None] / 0.55)
    seed = int(hashlib.md5(shot.id.encode()).hexdigest()[:8], 16)
    img = img + np.random.default_rng(seed).normal(0, 2.0, (H, W, 1)).astype(np.float32)
    card = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    del yy, xx, xn, yn, t, img, r, glow, stripes, rv

    # big faint shot id at the bottom (inside the TikTok UI band, away from captions)
    wm = text_block([shot.id.upper()], font(F.heavy, 300 * k), squeeze=F.squeeze)
    if wm.width > W * 0.9:
        wm = wm.resize((int(W * 0.9), int(wm.height * W * 0.9 / wm.width)), Image.LANCZOS)
    card.alpha_composite(solid(wm, (255, 255, 255), 0.10), ((W - wm.width) // 2, int(H - 0.035 * H - wm.height)))

    # --- title block, placed where the shot's captions are not
    used = {t_.pos for t_ in shot.texts}
    region = next((p for p in ("center", "upper", "lower") if p not in used), "center")
    maxw = S.maxw
    parts, gaps = [], []
    tm, tsize = fit_block(wrap_text(title.upper(), 13), F.heavy, 100 * k, maxw, 0.3 * H,
                          squeeze=F.squeeze, lh=0.95)
    tm_img, tpad = with_shadow(solid(tm, (255, 255, 255)), k, soft=(10, 5, 0.45), tight=(2, 2, 0.35))
    parts.append(tm_img)
    if sub:
        sm, ssize = fit_block(wrap_text(sub, 30), F.body, 40 * k, maxw, 0.12 * H, lh=1.25)
        gaps.append(int(round(0.28 * tsize)) - tpad)
        parts.append(solid(sm, (255, 255, 255), 0.92))
    if hint:
        hm, hsize = fit_block(wrap_text(hint, 40), F.regular, 29 * k, maxw - 40 * k, 0.15 * H, lh=1.3)
        bw_, bh_ = int(hm.width + 40 * k), int(hm.height + 28 * k)
        box = Image.new("RGBA", (bw_, bh_), (0, 0, 0, 0))
        ImageDraw.Draw(box).rounded_rectangle((0, 0, bw_ - 1, bh_ - 1), radius=int(14 * k), fill=(0, 0, 0, 80))
        box.alpha_composite(solid(hm, (255, 255, 255), 0.85), ((bw_ - hm.width) // 2, (bh_ - hm.height) // 2))
        gaps.append(int(round(34 * k)))
        parts.append(box)
    block = stack(parts, gaps)
    top, bot = S.safe_top, H - S.safe_bottom
    if region == "upper":
        y = top + 0.13 * H
    elif region == "lower":
        y = bot - 0.03 * H - block.height
    else:
        y = (top + bot) / 2 - block.height / 2
    y = clamp(y, top, max(top, bot - block.height))
    card.alpha_composite(block, ((W - block.width) // 2, int(round(y))))
    card_path = outdir / "card.png"
    card.convert("RGB").save(card_path, compress_level=1)

    # --- chrome (static, never zoomed/shaken): progress track + corner label + tag
    chrome = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(chrome)
    bar_h = max(4, int(round(10 * k)))
    d.rectangle((0, 0, W, bar_h - 1), fill=(0, 0, 0, 110))
    l1 = f"{shot.id.upper()}" + (f"  ·  {shot.section.upper()}" if shot.section else "")
    l2 = f"{tc(shot.f0 / S.fps)} → {tc(shot.f1 / S.fps)}   {shot.N}f"
    f1_, f2_ = font(F.body, 30 * k), font(F.regular, 24 * k)
    w1, w2 = f1_.getlength(l1), f2_.getlength(l2)
    padx, pady = 18 * k, 12 * k
    bx, by = 36 * k, S.safe_top + 22 * k
    bw_ = max(w1, w2) + 2 * padx
    bh_ = 30 * k + 8 * k + 24 * k + 2 * pady + 6 * k
    d.rounded_rectangle((bx, by, bx + bw_, by + bh_), radius=int(12 * k), fill=(0, 0, 0, 120))
    d.text((bx + padx, by + pady), l1, font=f1_, fill=(255, 255, 255, 255))
    d.text((bx + padx, by + pady + 38 * k), l2, font=f2_, fill=(255, 255, 255, 215))
    tag = "NO CLIP" if missing else "ANIMATIC"
    tf = font(F.body, 22 * k)
    tw = tf.getlength(tag) + 2 * 12 * k
    ty = by + bh_ + 10 * k
    tagcol = (255, 176, 32, 235) if missing else (255, 255, 255, 215)
    d.rounded_rectangle((bx, ty, bx + tw, ty + 34 * k), radius=int(17 * k), fill=tagcol)
    d.text((bx + 12 * k, ty + 17 * k), tag, font=tf, fill=(17, 17, 17, 255), anchor="lm")
    chrome_path = outdir / "chrome.png"
    chrome.save(chrome_path, compress_level=1)
    return card_path, chrome_path, bar_h


# --------------------------------------------------------------------------- filtergraph pieces

GRADES = {
    "none": {},
    "teal_orange": {"eq": "contrast=1.07:saturation=1.16",
                    "cb": "rs=-0.09:gs=-0.01:bs=0.11:rm=0.04:gm=0.0:bm=-0.04:rh=0.09:gh=0.02:bh=-0.09",
                    "curves": "all='0/0 0.25/0.22 0.75/0.79 1/1'"},
    "warm": {"eq": "contrast=1.04:saturation=1.10",
             "cb": "rs=0.04:gs=0.01:bs=-0.06:rm=0.08:gm=0.02:bm=-0.08:rh=0.06:gh=0.02:bh=-0.06"},
    "cold": {"eq": "contrast=1.06:saturation=0.86",
             "cb": "rs=-0.06:gs=0.0:bs=0.09:rm=-0.06:gm=0.0:bm=0.08:rh=-0.03:gh=0.0:bh=0.05",
             "curves": "b='0/0.04 1/1'"},
    "bw": {"eq": "saturation=0:contrast=1.12",
           "curves": "all='0/0 0.25/0.19 0.75/0.83 1/1'"},
    "blaugrana": {"eq": "contrast=1.08:saturation=1.14",
                  "cb": "rs=-0.05:gs=-0.03:bs=0.17:rm=0.09:gm=-0.05:bm=0.04:rh=0.12:gh=-0.04:bh=-0.02",
                  "curves": "all='0/0 0.25/0.22 0.75/0.78 1/1'"},
    "gold": {"eq": "contrast=1.06:saturation=1.08:brightness=0.02",
             "cb": "rs=0.05:gs=0.02:bs=-0.10:rm=0.10:gm=0.05:bm=-0.11:rh=0.08:gh=0.05:bh=-0.10",
             "curves": "all='0/0.02 0.5/0.52 1/1'"},
}


def ease_expr(p: str, ease: str) -> str:
    if ease == "linear":
        return p
    if ease == "in":
        return f"({p}*{p})"
    if ease == "out":
        return f"(1-(1-{p})*(1-{p}))"
    return f"({p}*{p}*(3-2*{p}))"


def perspective_filter(S: Settings, N: int, src, crop, zfun, fx_, fy_, shake: bool,
                       enable_until: float | None = None) -> str:
    """Sub-pixel smooth zoom / shake on a frame that already is S.W x S.H.

    src  = (Wd, Hd, bw, bh): source display size and its z=1 9:16 window size
    crop = (xm, ym, wm, hm): the static window (source px) that was scaled to S.W x S.H
    zfun(p, n) -> expression for the absolute zoom (relative to the z=1 window)
    """
    Wd, Hd, bw, bh = src
    xm, ym, wm, hm = crop
    sx, sy = S.W / wm, S.H / hm
    pre = ["st(0,in-1)", f"st(8,clip(ld(0)/{max(N - 1, 1)},0,1))", f"st(1,{zfun('ld(8)', 'ld(0)')})",
           f"st(2,{num(bw)}/ld(1))", f"st(3,{num(bh)}/ld(1))",
           f"st(4,(clip({num(fx_ * Wd)},ld(2)/2,{num(Wd)}-ld(2)/2)-{num(xm)})*{sx:.8f})",
           f"st(5,(clip({num(fy_ * Hd)},ld(3)/2,{num(Hd)}-ld(3)/2)-{num(ym)})*{sy:.8f})",
           f"st(2,min(ld(2)*{sx / 2:.8f},{num(S.W / 2)}))", f"st(3,min(ld(3)*{sy / 2:.8f},{num(S.H / 2)}))",
           f"st(4,clip(ld(4),ld(2),{num(S.W)}-ld(2)))", f"st(5,clip(ld(5),ld(3),{num(S.H)}-ld(3)))"]
    if shake:
        sf = max(1, int(round(0.35 * S.fps)))
        pre += [f"st(6,pow(max(0,1-ld(0)/{sf}),2))",
                "st(2,ld(2)/(1+0.09*ld(6)))", "st(3,ld(3)/(1+0.09*ld(6)))",
                "st(4,ld(4)+ld(2)*0.048*ld(6)*(0.65*sin(ld(0)*2.39+1.1)+0.35*sin(ld(0)*5.13+0.4)))",
                "st(5,ld(5)+ld(3)*0.032*ld(6)*(0.6*sin(ld(0)*3.17+2.3)+0.4*sin(ld(0)*6.71+0.9)))",
                "st(7,0.012*ld(6)*sin(ld(0)*2.77+0.7))"]
    P = ";".join(pre)
    opts = []
    for i, (a, b) in enumerate([(-1, -1), (1, -1), (-1, 1), (1, 1)]):
        A = "+" if a > 0 else "-"
        B = "+" if b > 0 else "-"
        if shake:
            X = f"ld(4){A}ld(2)*cos(ld(7)){'-' if b > 0 else '+'}ld(3)*sin(ld(7))"
            Y = f"ld(5){A}ld(2)*sin(ld(7)){B}ld(3)*cos(ld(7))"
        else:
            X, Y = f"ld(4){A}ld(2)", f"ld(5){B}ld(3)"
        opts += [f"x{i}='{P};{X}'", f"y{i}='{P};{Y}'"]
    f_ = "perspective=" + ":".join(opts) + f":interpolation={S.interp}:eval=frame"
    if enable_until is not None:
        f_ += f":enable='lt(t,{num(enable_until)})'"
    return f_


def window(z, Wd, Hd, bw, bh, fx_, fy_):
    w, h = bw / z, bh / z
    cx = clamp(fx_ * Wd, w / 2, Wd - w / 2)
    cy = clamp(fy_ * Hd, h / 2, Hd - h / 2)
    return cx - w / 2, cy - h / 2, w, h


def int_window(x, y, w, h, Wd, Hd):
    w2, h2 = min(even(w), Wd), min(even(h), Hd)
    x2 = clamp(even(x), 0, Wd - w2)
    y2 = clamp(even(y), 0, Hd - h2)
    return x2, y2, w2, h2


@dataclass
class Job:
    shot: Shot
    key: str
    seg: Path
    placeholder: bool
    missing: bool


def shot_key(shot: Shot, S: Settings, edl: EDL, placeholder: bool) -> str:
    clip_sig = None
    if shot.clip is not None and shot.clip_exists and not placeholder:
        st = shot.clip.stat()
        clip_sig = [str(shot.clip.resolve()), st.st_mtime_ns, st.st_size]
    material = {"engine": ENGINE_VERSION, "src": SOURCE_HASH, "shot": shot.raw, "f0": shot.f0,
                "N": shot.N, "grade": shot.grade, "placeholder": placeholder, "clip": clip_sig,
                "texts": [t.__dict__ for t in shot.texts], "settings": S.key()}
    return hashlib.sha256(json.dumps(material, sort_keys=True, default=str).encode()).hexdigest()[:20]


def build_shot(job: Job, S: Settings, edl: EDL, tmp: Path):
    """returns (ffmpeg input args, filtergraph text, output label)"""
    shot, N, fps = job.shot, job.shot.N, S.fps
    W, H, k = S.W, S.H, S.k
    FPS = num(fps)
    inputs, stm = [], []
    fx = set(shot.fx)

    def add_input(args):
        inputs.extend(args)
        return add_input.n_inc()
    counter = {"n": 0}

    def n_inc():
        counter["n"] += 1
        return counter["n"] - 1
    add_input.n_inc = n_inc

    def still(path):          # decode a PNG once and loop it in-graph at the output rate
        i = add_input(["-i", str(path)])
        return f"[{i}:v]loop=loop=-1:size=1:start=0,setpts=N/({FPS}*TB)"

    chrome = None
    if job.placeholder:
        card, chrome, bar_h = placeholder_assets(shot, S, edl, tmp, job.missing)
        zf = (lambda p, n: f"(1+0.045*{p})*(1+0.03*exp(-{num(9 / fps)}*{n}))")
        stm.append(f"{still(card)},format=gbrp,"
                   + perspective_filter(S, N, (W, H, W, H), (0, 0, W, H), zf, 0.5, 0.5, "shake" in fx)
                   + "[geo]")
        grade = {}
    else:
        v = shot.clip_info or probe_media(shot.clip)["video"]
        span = source_span(shot, fps)
        i = add_input(["-ss", f"{shot.inp:.6f}", "-t", f"{span + 0.5:.6f}", "-an", "-sn", "-dn",
                       "-i", str(shot.clip)])
        pre = []
        if v["field_order"] in ("tt", "bb", "tb", "bt"):
            pre.append("bwdif=mode=send_field:parity=auto:deint=all")
        Wd, Hd = v["w"], v["h"]
        if abs(v["sar"] - 1.0) > 0.01:
            pre.append("scale=trunc(iw*sar/2)*2:ih,setsar=1")
            Wd = int(v["w"] * v["sar"]) // 2 * 2
        if shot.ramp:
            rf, rt, ra = shot.ramp["from"], shot.ramp["to"], shot.ramp["at"]
            d1 = ra * N / fps
            s1 = d1 * rf
            T = "(PTS-STARTPTS)*TB"
            pts = (f"setpts='if(lt({T},{num(s1)}),(PTS-STARTPTS)/{num(rf)},"
                   f"({num(d1)}+({T}-{num(s1)})/{num(rt)})/TB)'")
        elif abs(shot.speed - 1.0) > 1e-9:
            pts = f"setpts=(PTS-STARTPTS)/{num(shot.speed)}"
        else:
            pts = "setpts=PTS-STARTPTS"
        timing = [pts, f"fps={FPS}", "tpad=stop=-1:stop_mode=clone"]
        A = W / H
        zmin, zmax = min(shot.z0, shot.z1), max(shot.z0, shot.z1)
        animated = abs(shot.z1 - shot.z0) > 1e-6
        shake = "shake" in fx
        sf = max(1, int(round(0.35 * fps)))
        if shot.fit == "crop":
            bw = Hd * A if Wd / Hd > A else Wd
            bh = Hd if Wd / Hd > A else Wd / A
            xm, ym, wm, hm = int_window(*window(zmin, Wd, Hd, bw, bh, shot.focus_x, shot.focus_y), Wd, Hd)
            chain = list(pre)
            if (xm, ym, wm, hm) != (0, 0, Wd, Hd):
                chain.append(f"crop={wm}:{hm}:{xm}:{ym}")
            chain += timing + [f"scale={W}:{H}:flags={S.scale_flags}", "setsar=1"]
            if W / wm > 1.3 and not S.preview:
                chain.append("unsharp=5:5:0.45:5:5:0")
            src, crop = (Wd, Hd, bw, bh), (xm, ym, wm, hm)
            fxy = (shot.focus_x, shot.focus_y)
        else:   # blurfill
            if Wd / Hd >= A:
                fw, fh = W, max(2, even(W * Hd / Wd))
            else:
                fw, fh = max(2, even(H * Wd / Hd)), H
            bgw, bgh = even(W / 4), even(H / 4)
            if Wd / Hd > bgw / bgh:
                cw, ch = even(bgh * Wd / Hd), bgh
            else:
                cw, ch = bgw, even(bgw * Hd / Wd)
            cx = int(clamp(shot.focus_x * cw - bgw / 2, 0, cw - bgw))
            cy = int(clamp(shot.focus_y * ch - bgh / 2, 0, ch - bgh))
            sig = num(max(2.0, 10 * k))
            head = f"[{i}:v]" + ",".join(pre + timing) + ",split=2[fg0][bg0]"
            stm.append(head)
            stm.append(f"[bg0]scale={cw}:{ch}:flags=bilinear,crop={bgw}:{bgh}:{cx}:{cy},gblur=sigma={sig},"
                       f"eq=brightness=-0.10:saturation=1.15,scale={W}:{H}:flags=bicubic,setsar=1[bg1]")
            stm.append(f"[fg0]scale={fw}:{fh}:flags={S.scale_flags},setsar=1[fg1]")
            stm.append(f"[bg1][fg1]overlay=x={(W - fw) // 2}:y={(H - fh) // 2}[comp]")
            Wd2, Hd2 = W, H
            xm, ym, wm, hm = int_window(*window(zmin, Wd2, Hd2, W, H, shot.focus_x, shot.focus_y), Wd2, Hd2)
            chain = []
            if zmin > 1.0 + 1e-6:
                chain += [f"crop={wm}:{hm}:{xm}:{ym}", f"scale={W}:{H}:flags={S.scale_flags}", "setsar=1"]
            src, crop = (W, H, W, H), (xm, ym, wm, hm)
            fxy = (shot.focus_x, shot.focus_y)
        if animated:
            z0, z1 = shot.z0, shot.z1
            zf = (lambda p, n, z0=z0, z1=z1, e=shot.ease: f"({num(z0)}+{num(z1 - z0)}*{ease_expr(p, e)})")
            chain.append(perspective_filter(S, N, src, crop, zf, fxy[0], fxy[1], shake))
        elif shake:
            zf = (lambda p, n, z=zmin: num(z))
            chain.append(perspective_filter(S, N, src, crop, zf, fxy[0], fxy[1], True,
                                            enable_until=(sf + 0.5) / fps))
        if shot.fit == "crop":
            stm.append(f"[{i}:v]" + ",".join(chain) + "[geo]")
        else:
            stm.append("[comp]" + (",".join(chain) if chain else "null") + "[geo]")
        grade = GRADES.get(shot.grade, {})

    # --- grade + per-pixel looks (RGB working space)
    post = []
    if grade.get("eq"):
        post.append(f"eq={grade['eq']}")
    post.append("format=gbrp")
    if grade.get("cb"):
        post.append(f"colorbalance={grade['cb']}")
    if grade.get("curves"):
        post.append(f"curves={grade['curves']}")
    if "bw" in fx:
        post.append("colorchannelmixer=rr=0.299:rg=0.587:rb=0.114:gr=0.299:gg=0.587:gb=0.114:"
                    "br=0.299:bg=0.587:bb=0.114")
        post.append("curves=all='0/0 0.25/0.21 0.75/0.81 1/1'")
    cur = "geo"
    stm.append(f"[{cur}]" + ",".join(post) + "[g0]")
    cur = "g0"
    if "glow" in fx:
        gs = num(max(2.0, 7 * k))
        stm.append(f"[{cur}]split=2[ga][gb]")
        stm.append(f"[gb]scale={even(W / 4)}:{even(H / 4)}:flags=bilinear,curves=all='0/0 0.55/0.08 1/1',"
                   f"gblur=sigma={gs},scale={W}:{H}:flags=bilinear[gc]")
        stm.append("[ga][gc]blend=all_mode=screen:all_opacity=0.65[g1]")
        cur = "g1"
    look = []
    if "rgb_split" in fx:
        s_ = max(1, int(round(9 * k)))
        v_ = max(1, int(round(2 * k)))
        look.append(f"rgbashift=rh=-{s_}:rv=-{v_}:bh={s_}:bv={v_}")
    if "vignette" in fx:
        look.append("vignette=angle=PI/4.2")
    if look:
        stm.append(f"[{cur}]" + ",".join(look) + "[g2]")
        cur = "g2"

    # --- captions / overlays
    for ti, item in enumerate(shot.texts):
        img, iw, ih, pad = render_caption(item, S)
        p = tmp / f"text{ti}.png"
        img.save(p, compress_level=1)
        x, y = place_box(iw, ih, item.pos, S)
        x, y = x - pad, y - pad
        lbl = f"t{ti}"
        f4 = 4.0 / fps
        fades = ["format=rgba"]
        if item.fade_in:
            fades.append(f"fade=t=in:st={num((item.a - 1) / fps)}:d={num(f4)}:alpha=1")
        if item.fade_out:
            fades.append(f"fade=t=out:st={num((item.b - 4) / fps)}:d={num(f4)}:alpha=1")
        stm.append(f"{still(p)}," + ",".join(fades) + f"[{lbl}]")
        en = f"gte(t,{num((item.a - 0.5) / fps)})*lt(t,{num((item.b - 0.5) / fps)})"
        stm.append(f"[{cur}][{lbl}]overlay=x={x}:y={y}:format=gbrp:enable='{en}'[o{ti}]")
        cur = f"o{ti}"

    # --- to output colourspace, grain, fades / flashes (frame exact)
    tail = ["scale=out_color_matrix=bt709:out_range=tv", "format=yuv420p"]
    if "grain" in fx:
        tail.append("noise=c0s=11:c0f=t+u")
    nf = max(1, int(round(0.4 * fps)))
    if "fade_in" in fx:
        tail.append(f"fade=t=in:s=0:n={min(nf, N)}")
    if "fade_out" in fx:
        n_ = min(nf, max(N - 1, 1))
        tail.append(f"fade=t=out:s={max(N - 1 - n_, 0)}:n={n_}")
    if "flash_in" in fx:
        tail.append(f"fade=t=in:s=0:n={min(3, N)}:color=white")
    if "flash_out" in fx:
        n_ = min(3, max(N - 1, 1))
        tail.append(f"fade=t=out:s={max(N - 1 - n_, 0)}:n={n_}:color=white")
    if "dip_white" in fx:
        n_ = min(max(1, int(round(0.25 * fps))), max(N - 1, 1))
        tail.append(f"fade=t=out:s={max(N - 1 - n_, 0)}:n={n_}:color=white")
    stm.append(f"[{cur}]" + ",".join(tail) + "[y0]")
    cur = "y0"
    if chrome is not None:
        stm.append(f"{still(chrome)},format=rgba[chr]")
        stm.append(f"[{cur}][chr]overlay=0:0[y1]")
        stm.append(f"color=c=white:s={W}x{bar_h}:r={FPS}[pb]")
        stm.append(f"[y1][pb]overlay=x='-w+w*min(1,(t*{FPS}+1)/{N})':y=0:eval=frame[y2]")
        cur = "y2"
    stm.append(f"[{cur}]setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[vout]")
    return inputs, ";\n".join(stm) + "\n", "vout"


def venc_args(S: Settings):
    return ["-c:v", "libx264", "-preset", S.preset, "-crf", str(S.crf), "-pix_fmt", "yuv420p",
            "-profile:v", "high", "-colorspace", "bt709", "-color_primaries", "bt709",
            "-color_trc", "bt709", "-color_range", "tv"]


def render_segment(job: Job, S: Settings, edl: EDL, cache: Path) -> float:
    t0 = time.time()
    tmp = cache / "tmp" / f"{job.shot.id}_{job.key}"
    if tmp.exists():
        shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True, exist_ok=True)
    inputs, graph, out = build_shot(job, S, edl, tmp)
    gpath = tmp / "graph.txt"
    gpath.write_text(graph)
    part = job.seg.with_name(job.seg.stem + ".part.mp4")
    cmd = (["ffmpeg", "-hide_banner", "-nostdin", "-y", "-loglevel", "error"] + inputs
           + graph_script_args(gpath)
           + ["-map", f"[{out}]", "-frames:v", str(job.shot.N), "-r", num(S.fps), "-an"]
           + venc_args(S) + [str(part)])
    try:
        run(cmd, f"render of shot {job.shot.id}", S.verbose)
    except RenderError as e:
        raise RenderError(f"{e}\n  filtergraph kept at: {gpath}")
    got = count_frames(part)
    if got != job.shot.N:
        raise RenderError(f"shot {job.shot.id}: segment has {got} frames, expected {job.shot.N} "
                          f"(filtergraph: {gpath})")
    os.replace(part, job.seg)
    shutil.rmtree(tmp, ignore_errors=True)
    return time.time() - t0


# --------------------------------------------------------------------------- concat + mux

def mux(edl: EDL, S: Settings, jobs: list, out: Path, cache: Path, subset: bool):
    lst = cache / "tmp" / f"concat_{os.getpid()}_{int(time.time() * 1000)}.txt"
    lst.parent.mkdir(parents=True, exist_ok=True)
    lst.write_text("".join("file '" + str(j.seg).replace("'", "'\\''") + "'\n" for j in jobs))
    fps = S.fps
    if not subset:
        ss, se = edl.song_start, edl.song_end
        af = [f"atrim=start={num(ss)}:end={num(se)}", "asetpts=PTS-STARTPTS"]
        if ss > 0:
            af.append("afade=t=in:d=0.015")
        if edl.fade_out > 0:
            af.append(f"afade=t=out:st={num(edl.length - edl.fade_out)}:d={num(edl.fade_out)}")
        afilter = "[1:a]" + ",".join(af) + "[aout]"
    else:   # selected shots: the matching song slices, back to back
        parts = []
        for n_, j in enumerate(jobs):
            a = edl.song_start + j.shot.f0 / fps
            b = edl.song_start + j.shot.f1 / fps
            parts.append(f"[1:a]atrim=start={num(a)}:end={num(b)},asetpts=PTS-STARTPTS[a{n_}]")
        afilter = ";".join(parts) + ";" + "".join(f"[a{n_}]" for n_ in range(len(jobs))) + \
            f"concat=n={len(jobs)}:v=0:a=1[aout]"
    out.parent.mkdir(parents=True, exist_ok=True)
    part = out.with_name(out.stem + ".part" + out.suffix)
    cmd = ["ffmpeg", "-hide_banner", "-nostdin", "-y", "-loglevel", "error",
           "-f", "concat", "-safe", "0", "-i", str(lst), "-i", str(edl.song),
           "-filter_complex", afilter, "-map", "0:v:0", "-map", "[aout]", "-c:v", "copy",
           "-c:a", "aac", "-b:a", S.abitrate, "-ar", "48000", "-ac", "2",
           "-metadata", f"title={edl.title}", "-movflags", "+faststart", str(part)]
    try:
        run(cmd, "concat + audio mux", S.verbose)
    finally:
        lst.unlink(missing_ok=True)
    os.replace(part, out)


def verify_output(out: Path, S: Settings, frames_expected: int, length: float):
    p = subprocess.run(["ffprobe", "-v", "error", "-count_packets", "-print_format", "json",
                        "-show_streams", "-show_format", str(out)], capture_output=True, text=True)
    info = json.loads(p.stdout or "{}")
    v = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), None)
    a = next((s for s in info.get("streams", []) if s.get("codec_type") == "audio"), None)
    problems = []
    if not v:
        raise RenderError(f"{out}: no video stream in output")
    nb = int(v.get("nb_read_packets") or -1)
    rate = v.get("r_frame_rate", "?")
    vd = float(v.get("duration") or 0)
    ad = float(a.get("duration") or 0) if a else 0.0
    if (int(v["width"]), int(v["height"])) != (S.W, S.H):
        problems.append(f"size {v['width']}x{v['height']} != {S.W}x{S.H}")
    m = re.fullmatch(r"(\d+)/(\d+)", rate)
    if not m or abs(int(m.group(1)) / int(m.group(2)) - S.fps) > 1e-3:
        problems.append(f"frame rate {rate} != {S.fps}")
    if nb != frames_expected:
        problems.append(f"{nb} video frames != {frames_expected} expected")
    if a is None:
        problems.append("no audio stream")
    elif abs(ad - length) > 1.0 / S.fps + 1e-3:
        problems.append(f"audio {ad:.3f}s vs expected {length:.3f}s")
    if abs(vd - frames_expected / S.fps) > 1.0 / S.fps + 1e-3:
        problems.append(f"video {vd:.3f}s vs expected {frames_expected / S.fps:.3f}s")
    summary = (f"{v['width']}x{v['height']} @ {rate} fps, {nb} frames, video {vd:.3f}s, "
               f"audio {ad:.3f}s")
    return summary, problems


# --------------------------------------------------------------------------- contact sheet

def contact_sheet(edl: EDL, S: Settings, jobs: list, out_path: Path):
    n = len(jobs)
    tw = 270 if n <= 24 else 216
    th = int(round(tw * S.H / S.W))
    cols = n if n <= 5 else 5 if n <= 10 else 6 if n <= 36 else 8
    rows = math.ceil(n / cols)
    gut, lab, head = 14, 66, 64
    sheet = Image.new("RGB", (gut + cols * (tw + gut), head + rows * (th + lab + gut) + gut), (16, 16, 20))
    d = ImageDraw.Draw(sheet)
    F = S.fonts
    fh, fb, fr_ = font(F.body, 26), font(F.body, 16), font(F.regular, 13)
    d.text((gut, 18), edl.title, font=fh, fill=(255, 255, 255))
    d.text((gut + fh.getlength(edl.title) + 20, 26),
           f"{len(edl.shots)} shots · {edl.length:.2f}s · {S.W}x{S.H} @ {num(S.fps)} fps"
           f"{' · preview' if S.preview else ''}{' · placeholders only' if S.placeholders_only else ''}"
           f"  — red lines = safe zone", font=fb, fill=(170, 170, 180))

    def grab(job):
        mid = job.shot.N // 2
        p = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{(mid + 0.25) / S.fps:.4f}", "-i", str(job.seg),
                            "-frames:v", "1", "-vf", f"scale={tw}:{th}:flags=area", "-f", "rawvideo",
                            "-pix_fmt", "rgb24", "-"], capture_output=True)
        if p.returncode != 0 or len(p.stdout) < tw * th * 3:
            return Image.new("RGB", (tw, th), (60, 0, 0))
        return Image.frombytes("RGB", (tw, th), p.stdout[:tw * th * 3])

    with cf.ThreadPoolExecutor(4) as ex:
        thumbs = list(ex.map(grab, jobs))
    for idx, (job, im) in enumerate(zip(jobs, thumbs)):
        r_, c_ = divmod(idx, cols)
        x = gut + c_ * (tw + gut)
        y = head + r_ * (th + lab + gut)
        ov = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
        od = ImageDraw.Draw(ov)
        st_, sb_, sr_ = S.safe_top * th / S.H, th - S.safe_bottom * th / S.H, tw - S.safe_right * tw / S.W
        for yy in range(0, tw, 8):
            od.line((yy, st_, yy + 4, st_), fill=(255, 60, 60, 200))
            od.line((yy, sb_, yy + 4, sb_), fill=(255, 60, 60, 200))
        for yy in range(0, th, 8):
            od.line((sr_, yy, sr_, yy + 4), fill=(255, 60, 60, 200))
        im = Image.alpha_composite(im.convert("RGBA"), ov).convert("RGB")
        sheet.paste(im, (x, y))
        sh = job.shot
        t_mid = (sh.f0 + sh.N // 2) / S.fps
        l1 = f"{sh.id}  {tc(sh.f0 / S.fps)}"
        d.text((x, y + th + 6), l1, font=fb, fill=(255, 255, 255))
        if job.placeholder:
            tag = "PLACEHOLDER"
            tw_ = fr_.getlength(tag) + 10
            d.rounded_rectangle((x + tw - tw_, y + th + 6, x + tw, y + th + 24), radius=5,
                                fill=(255, 176, 32))
            d.text((x + tw - tw_ + 5, y + th + 15), tag, font=fr_, fill=(0, 0, 0), anchor="lm")
        l2 = f"{sh.N}f · mid {t_mid:.2f}s · {sh.section or '-'}"
        geo = sh.fit + (f" z{num(sh.z0)}→{num(sh.z1)}" if (sh.z0, sh.z1) != (1.0, 1.0) else "")
        sp = (f"ramp {num(sh.ramp['from'])}→{num(sh.ramp['to'])}" if sh.ramp else
              (f"x{num(sh.speed)}" if sh.speed != 1 else ""))
        l3 = " · ".join(p_ for p_ in [geo, sh.grade, sp] if p_)
        l4 = ", ".join(sh.fx) or "no fx"
        d.text((x, y + th + 26), l2, font=fr_, fill=(190, 190, 200))
        d.text((x, y + th + 40), l3[:44], font=fr_, fill=(150, 150, 165))
        d.text((x, y + th + 53), l4[:44], font=fr_, fill=(150, 150, 165))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, quality=88)


# --------------------------------------------------------------------------- reporting

def print_issues(issues):
    errs = [i for i in issues if i.level == "ERROR"]
    warns = [i for i in issues if i.level == "WARN"]
    for i in errs + warns:
        print(f"  {i.level:<5} {i.where:<10} {i.msg}")
    return errs, warns


def print_check(edl: EDL, issues: list):
    fps = edl.fps
    print(f"EDL   {rel(edl.path)}  — \"{edl.title}\"")
    sd = ""
    if edl.song.is_file():
        try:
            sd = f" ({probe_media(edl.song)['duration']:.2f}s)"
        except EDLError:
            pass
    print(f"Song  {rel(edl.song)}{sd}   range {edl.song_start:.3f} → {edl.song_end:.3f} "
          f"= {edl.length:.3f}s   fade-out {edl.fade_out:.2f}s")
    print(f"Grid  {num(fps)} fps → {fr(edl.length, fps)} frames   {edl.width}x{edl.height}   "
          f"safe zone top {num(edl.safe['top'])} / bottom {num(edl.safe['bottom'])} / right {num(edl.safe['right'])}")
    print()
    hdr = f"  {'id':<7}{'start':>8}{'end':>8}{'dur':>7}{'frm':>5}  {'clip':<34}{'status'}"
    print(hdr)
    print("  " + "-" * (len(hdr) + 6))
    for s in edl.shots:
        if s.clip_rel is None:
            status = "placeholder (no clip set)"
        elif not s.clip_exists:
            status = "MISSING → placeholder"
        elif s.clip_info:
            v = s.clip_info
            span = source_span(s, fps)
            status = (f"ok  in {s.inp:.2f}+{span:.2f}s of {v['duration']:.2f}s  "
                      f"{v['w']}x{v['h']}@{v['fps']:.4g}")
        else:
            status = "?"
        clip = (s.clip_rel or "-")
        if len(clip) > 33:
            clip = "…" + clip[-32:]
        print(f"  {s.id:<7}{s.start:>8.3f}{s.end:>8.3f}{s.end - s.start:>7.3f}{s.N:>5}  {clip:<34}{status}")
    missing = [s for s in edl.shots if s.clip_rel is None or not s.clip_exists]
    print()
    if missing:
        print(f"MISSING CLIPS ({len(missing)}) — these render as placeholder cards:")
        w_clip = min(max(len(s.clip_rel or "-") for s in missing), 34)
        w_title = min(max(len(str(s.placeholder.get("title") or "")) for s in missing), 34)
        print(f"  {'id':<7}{'clip':<{w_clip + 2}}{'title':<{w_title + 2}}hint")
        for s in missing:
            clip = s.clip_rel or "-"
            if len(clip) > w_clip:
                clip = "…" + clip[-(w_clip - 1):]
            title = str(s.placeholder.get("title") or "")[:w_title]
            print(f"  {s.id:<7}{clip:<{w_clip + 2}}{title:<{w_title + 2}}{s.placeholder.get('hint') or ''}")
        print()
    else:
        print("All clips present.\n")
    errs = [i for i in issues if i.level == "ERROR"]
    warns = [i for i in issues if i.level == "WARN"]
    if issues:
        print("ISSUES:")
        print_issues(issues)
        print()
    print(f"Result: {'FAILED' if errs else 'OK'} — {len(errs)} error(s), {len(warns)} warning(s)")
    return 1 if errs else 0


# --------------------------------------------------------------------------- main

def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Render an EDL JSON into a vertical TikTok video.",
                                 formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    ap.add_argument("edl", help="EDL JSON file (e.g. edl/main.json)")
    ap.add_argument("--out", help="output .mp4 (default out/<name>[_animatic][_preview].mp4)")
    ap.add_argument("--preview", action="store_true", help="540x960, ultrafast preset, for quick iteration")
    ap.add_argument("--only", help="comma separated shot ids to render (e.g. s03,s07)")
    ap.add_argument("--placeholders-only", action="store_true",
                    help="ignore clip files and render every shot as its placeholder card (animatic)")
    ap.add_argument("--check", action="store_true", help="validate the EDL and list missing clips, then exit")
    ap.add_argument("--jobs", type=int, default=min(4, os.cpu_count() or 2), help="parallel shot renders")
    ap.add_argument("--contact-sheet", action="store_true", help="also write <out>_contact.jpg")
    ap.add_argument("--force", action="store_true",
                    help="render even if a clip is too short for its span (holds the last frame)")
    ap.add_argument("--font", help="heavy title font (.ttf/.otf); default: best font in fonts/, else system")
    ap.add_argument("--squeeze", type=float, help="horizontal squeeze for the heavy font (0.5-1.0)")
    ap.add_argument("--no-cache", action="store_true", help="re-render every segment")
    ap.add_argument("--verbose", "-v", action="store_true", help="print ffmpeg commands")
    args = ap.parse_args(argv)

    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            print(f"error: {tool} not found on PATH", file=sys.stderr)
            return 2
    edl_path = Path(args.edl).expanduser()
    if not edl_path.is_file() and (ROOT / args.edl).is_file():
        edl_path = ROOT / args.edl
    if not edl_path.is_file():
        print(f"error: EDL not found: {args.edl}", file=sys.stderr)
        return 2
    edl_path = edl_path.resolve()

    issues: list = []
    try:
        edl = load_edl(edl_path, issues)
        validate(edl, issues, placeholders_only=args.placeholders_only)
    except EDLError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    attach_texts(edl)

    if args.check:
        return print_check(edl, issues)

    if args.placeholders_only:      # clip problems don't matter for the animatic
        issues = [i for i in issues if i.code not in ("clip_short", "clip_bad")]
    if args.force:
        for i in issues:
            if i.code == "clip_short":
                i.level = "WARN"
    errs = [i for i in issues if i.level == "ERROR"]
    if issues:
        print("Validation:")
        print_issues(issues)
    if errs:
        print(f"\nerror: {len(errs)} validation error(s); fix the EDL (run with --check for the full report)",
              file=sys.stderr)
        return 1

    try:
        fonts = pick_fonts(edl, args.font, args.squeeze)
    except EDLError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    S = make_settings(edl, args, fonts)

    shots = edl.shots
    subset = False
    if args.only:
        want = [x.strip() for x in args.only.split(",") if x.strip()]
        ids = {s.id for s in edl.shots}
        unknown = [w for w in want if w not in ids]
        if unknown:
            print(f"error: --only: unknown shot id(s): {', '.join(unknown)}", file=sys.stderr)
            return 2
        shots = [s for s in edl.shots if s.id in want]
        subset = True

    name = edl_path.stem
    suffix = ("_animatic" if args.placeholders_only else "") + \
        (("_only-" + "-".join(s.id for s in shots))[:60] if subset else "") + \
        ("_preview" if args.preview else "")
    out = Path(args.out).expanduser().resolve() if args.out else ROOT / "out" / f"{name}{suffix}.mp4"
    cache = ROOT / "out" / ".cache"
    cache.mkdir(parents=True, exist_ok=True)

    jobs = []
    for s in shots:
        missing = s.clip is None or not s.clip_exists
        ph = args.placeholders_only or missing
        key = shot_key(s, S, edl, ph)
        jobs.append(Job(shot=s, key=key, seg=cache / f"{s.id}_{key}.mp4", placeholder=ph, missing=missing))

    total_frames = sum(j.shot.N for j in jobs)
    print(f"\nRendering \"{edl.title}\" → {rel(out)}")
    print(f"  {len(jobs)} shot(s), {total_frames} frames ({total_frames / S.fps:.2f}s) at "
          f"{S.W}x{S.H} @ {num(S.fps)} fps, preset {S.preset} crf {S.crf}, {args.jobs} job(s)")
    print(f"  fonts: {fonts.describe()}")
    t_start = time.time()
    todo = []
    for j in jobs:
        if j.seg.exists() and not args.no_cache and count_frames(j.seg) == j.shot.N:
            continue
        todo.append(j)
    if len(todo) < len(jobs):
        print(f"  {len(jobs) - len(todo)} segment(s) reused from cache")
    done = 0
    lock = threading.Lock()

    def work(j):
        nonlocal done
        dt = render_segment(j, S, edl, cache)
        with lock:
            done += 1
            what = "placeholder" if j.placeholder else rel(j.shot.clip)
            print(f"  [{done:>3}/{len(todo)}] {j.shot.id:<7} {j.shot.N:>4}f  {dt:6.1f}s  {what}", flush=True)
        return dt

    failed = None
    with cf.ThreadPoolExecutor(max(1, args.jobs)) as ex:
        futs = {ex.submit(work, j): j for j in sorted(todo, key=lambda j: -j.shot.N)}
        for f_ in cf.as_completed(futs):
            try:
                f_.result()
            except (RenderError, EDLError, OSError) as e:
                if failed is None:
                    failed = e
                    for g in futs:
                        g.cancel()
    if failed:
        print(f"\nerror: {failed}", file=sys.stderr)
        return 1
    t_seg = time.time() - t_start
    try:
        mux(edl, S, jobs, out, cache, subset)
        summary, problems = verify_output(out, S, total_frames,
                                          total_frames / S.fps if subset else edl.length)
    except RenderError as e:
        print(f"\nerror: {e}", file=sys.stderr)
        return 1
    t_all = time.time() - t_start
    secs = total_frames / S.fps
    print(f"\nDone in {t_all:.1f}s (segments {t_seg:.1f}s) — {t_all / secs:.2f}s per output second")
    print(f"  {rel(out)}  ({out.stat().st_size / 1e6:.1f} MB)  {summary}")
    if problems:
        print("  VERIFY FAILED: " + "; ".join(problems), file=sys.stderr)
        return 1
    print("  verified: size, fps, frame count and audio/video durations match the EDL")
    if args.contact_sheet:
        cs = out.with_name(out.stem + "_contact.jpg")
        contact_sheet(edl, S, jobs, cs)
        print(f"  contact sheet: {rel(cs)}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\ninterrupted", file=sys.stderr)
        sys.exit(130)
