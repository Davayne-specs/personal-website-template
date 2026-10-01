#!/usr/bin/env python3
"""
render.py: turn an Edit Decision List (EDL) JSON into a vertical TikTok video.

    python render.py edl/<name>.json [--out out/<name>.mp4] [--preview] [--only s03,s07]
                     [--placeholders-only] [--check] [--jobs 4] [--contact-sheet]
                     [--force] [--font path.ttf] [--squeeze 0.8] [--no-cache] [--verbose]
                     [--max-rate 12]

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
  zoom.ease                    "in_out" (default) | "linear" | "in" | "out" | "snap"
  text may also be a list of text objects (several captions in one shot)

Punk / emo / experimental pack (all optional, see EDL_SCHEMA.md):
  fx      vhs rec xerox posterize invert invert_flash strobe stutter reverse echo glitch step
          light_leak letterbox whip_in whip_out shake_hard flash_red flash_black freeze zoom_blur
  keys    pulse (beat zoom bounce), layout/panels (split2 | triptych | grid4), strobe/stutter/
          glitch/step/freeze/posterize settings, meta.rec_date
  styles  ransom typewriter glitchtext stamp
Time effects (freeze/reverse/stutter/step) remap frames with shuffleframes, so segment frame
counts stay exact; procedural looks (glitch, VHS tracking, light leaks) are deterministic maps
generated per shot (seeded from the shot id) and fed to ffmpeg as rawvideo, so caching holds.

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
from fractions import Fraction
from pathlib import Path

try:
    import numpy as np
    from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont
except ImportError as _e:  # pragma: no cover
    sys.exit(f"render.py needs numpy and Pillow ({_e}). Install with: pip install numpy pillow")

ROOT = Path(__file__).resolve().parent
ENGINE_VERSION = "1.1"
SOURCE_HASH = hashlib.sha1(Path(__file__).read_bytes()).hexdigest()[:12]
REF_W, REF_H = 1080, 1920          # all pixel constants below are defined at this size

FX_NAMES = ["flash_in", "flash_out", "shake", "bw", "rgb_split", "glow", "vignette",
            "grain", "fade_in", "fade_out", "dip_white",
            # punk / emo / experimental pack
            "vhs", "rec", "xerox", "posterize", "invert", "invert_flash", "strobe", "stutter",
            "reverse", "echo", "glitch", "step", "light_leak", "letterbox", "whip_in", "whip_out",
            "shake_hard", "flash_red", "flash_black", "freeze", "zoom_blur"]
TIME_FX = ["freeze", "reverse", "stutter", "step"]        # frame remaps, applied in this order
SHOT_ONLY_FX = {"rec"}                                    # not allowed inside a layout panel
GEOM_FX = {"shake", "shake_hard"}                         # camera moves (inside the view / panel)
FX_CFG = {   # shot (or panel) keys that configure an fx; giving the key also switches the fx on
    "strobe": {"every": 2, "mode": "invert"},
    "stutter": {"len": 0.134, "repeats": 3},
    "glitch": {"whole": False, "amount": 0.7},
    "step": {"fps": 12},
    "freeze": {"at": 0.0},
    "posterize": {"levels": 4},
}
STROBE_MODES = ["invert", "black", "white"]
GRADE_NAMES = ["teal_orange", "warm", "cold", "bw", "blaugrana", "gold", "none"]
STYLES = ["lyric", "stat", "title", "kicker", "quote", "whisper",
          "ransom", "typewriter", "glitchtext", "stamp"]
ANIMATED_STYLES = {"typewriter", "glitchtext"}            # rendered as one PNG per frame
POSITIONS = ["upper", "center", "lower"]
FITS = ["crop", "blurfill"]
EASES = ["in_out", "linear", "in", "out", "snap"]
LAYOUTS = {"split2": 2, "triptych": 3, "grid4": 4}
PULSE_KEYS = {"every", "amount", "phase", "decay", "anchor"}
DEFAULT_REC_DATE = "OCT 26 2026"

SHOT_KEYS = {"id", "start", "end", "section", "moment", "clip", "in", "speed", "ramp",
             "focus_x", "focus_y", "fit", "zoom", "fx", "grade", "text", "placeholder",
             "pulse", "layout", "layout_bg", "layout_gap", "panels"} | set(FX_CFG)
PANEL_KEYS = {"clip", "in", "speed", "delay", "grade", "fx", "focus_x", "focus_y", "fit", "zoom",
              "pulse"} | set(FX_CFG)
NOTE_KEYS = {"note", "notes", "comment", "comments", "lyric", "lyrics", "beat", "beats",
             "why", "desc", "description", "source", "url"}
META_KEYS = {"title", "song", "song_start", "song_end", "fade_out", "fps", "width", "height",
             "default_grade", "safe_zone", "font", "font_body", "accent", "bpm", "notes", "note",
             "artist", "version", "author", "audio_plan", "rec_date"}
TEXT_KEYS = {"content", "style", "pos", "in", "out", "accent", "cps"}
OVERLAY_KEYS = {"start", "end", "content", "style", "pos", "accent", "cps"}

DEFAULT_SAFE = {"top": 160, "bottom": 420, "right": 140}
DEFAULT_ACCENT = (165, 0, 68)        # Barça garnet
INK_RED = (209, 16, 26)              # punk red: flash_red, ransom boxes, stamp ink
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
_SF = "/usr/share/fonts/truetype/"
SYSTEM_TYPEWRITER = [_SF + "freefont/FreeMonoBold.ttf", _SF + "liberation/LiberationMono-Bold.ttf",
                     _SF + "dejavu/DejaVuSansMono-Bold.ttf"]
SYSTEM_OSD = [_SF + "dejavu/DejaVuSansMono-Bold.ttf", _SF + "liberation/LiberationMono-Bold.ttf",
              _SF + "freefont/FreeMonoBold.ttf"]
# ransom-note letters: (path, weight) — serif/sans/mono, bold/regular, the odd italic
RANSOM_FONTS = [(_SF + "dejavu/DejaVuSans-Bold.ttf", 3), (_SF + "dejavu/DejaVuSerif-Bold.ttf", 3),
                (_SF + "liberation/LiberationSerif-Bold.ttf", 3), (_SF + "freefont/FreeSerifBold.ttf", 2),
                (_SF + "liberation/LiberationSans-Bold.ttf", 2), (_SF + "freefont/FreeSansBold.ttf", 2),
                (_SF + "dejavu/DejaVuSansMono-Bold.ttf", 2), (_SF + "freefont/FreeMonoBold.ttf", 2),
                (_SF + "liberation/LiberationMono-Bold.ttf", 1), (_SF + "dejavu/DejaVuSerif.ttf", 1),
                (_SF + "liberation/LiberationSerif-Regular.ttf", 1), (_SF + "freefont/FreeSerif.ttf", 1),
                (_SF + "liberation/LiberationSans-Regular.ttf", 1),
                (_SF + "freefont/FreeSerifBoldItalic.ttf", 1),
                (_SF + "liberation/LiberationSerif-BoldItalic.ttf", 1),
                ("/usr/share/fonts/opentype/tlwg/Loma-Bold.otf", 1)]


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


def is_int(v) -> bool:
    return is_num(v) and float(v).is_integer()


def odd(v: float, lo: int = 3, hi: int = 23) -> int:
    """odd integer kernel size in [lo, hi]"""
    i = int(round(v))
    i += 1 - i % 2
    return int(clamp(i, lo, hi))


def seed_of(*parts) -> int:
    """deterministic 32-bit seed from strings (shot id, content, ...)"""
    return int(hashlib.md5("|".join(str(p) for p in parts).encode()).hexdigest()[:8], 16)


def sat_matrix(s: float) -> str:
    """colorchannelmixer that scales saturation by s (Rec.601 luma), usable on gbrp"""
    L = (0.299, 0.587, 0.114)
    m = [[L[j] * (1 - s) + (s if i == j else 0) for j in range(3)] for i in range(3)]
    names = ["rr", "rg", "rb", "gr", "gg", "gb", "br", "bg", "bb"]
    return "colorchannelmixer=" + ":".join(f"{n}={m[i // 3][i % 3]:.4f}" for i, n in enumerate(names))


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


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def is_image(path) -> bool:
    """Still photos are valid clips: they are looped for the whole shot."""
    return Path(path).suffix.lower() in IMAGE_EXTS


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
    cps: float | None = None       # typewriter: characters per second (None = spread over the text)
    ta: int | None = None          # the whole text's first/end frame relative to this shot's frame 0
    tb: int | None = None          # (an overlay may start in an earlier shot): drives animated styles


@dataclass
class View:
    """One moving picture: the whole frame of a plain shot, or one panel of a layout."""
    where: str
    clip_rel: str | None = None
    clip: Path | None = None
    clip_exists: bool = False
    clip_info: dict | None = None
    inp: float = 0.0
    speed: float = 1.0
    ramp: dict | None = None
    delay: float = 0.0             # panel lag behind the shot timeline (s)
    focus_x: float = 0.5
    focus_y: float = 0.5
    fit: str = "crop"
    z0: float = 1.0
    z1: float = 1.0
    ease: str = "in_out"
    pulse: dict | None = None
    fx: list = field(default_factory=list)
    cfg: dict = field(default_factory=dict)
    grade: str = "none"
    seed: int = 0

    @property
    def usable(self) -> bool:
        return self.clip is not None and self.clip_exists


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
    pulse: dict | None = None
    cfg: dict = field(default_factory=dict)       # fx settings (strobe, stutter, glitch, ...)
    layout: str | None = None
    layout_bg: tuple = (0, 0, 0)
    layout_gap: float = 14.0
    panels: list = field(default_factory=list)    # View per panel when layout is set

    @property
    def N(self) -> int:
        return self.f1 - self.f0

    def views(self) -> list:
        return self.panels if self.layout else [shot_view(self)]

    def all_missing(self) -> bool:
        return not any(v.usable for v in self.views())


def shot_view(s: Shot) -> View:
    """the single full-frame view of a plain (non-layout) shot"""
    return View(where=s.id, clip_rel=s.clip_rel, clip=s.clip, clip_exists=s.clip_exists,
                clip_info=s.clip_info, inp=s.inp, speed=s.speed, ramp=s.ramp, focus_x=s.focus_x,
                focus_y=s.focus_y, fit=s.fit, z0=s.z0, z1=s.z1, ease=s.ease, pulse=s.pulse,
                fx=list(s.fx), cfg=dict(s.cfg), grade=s.grade, seed=seed_of(s.id))


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


def src_time(v, tau: float, D: float) -> float:
    """source seconds consumed after `tau` output seconds of a view/shot lasting D seconds"""
    if v.ramp:
        rf, rt, a = v.ramp["from"], v.ramp["to"], v.ramp["at"]
        d1 = a * D
        return tau * rf if tau <= d1 else d1 * rf + (tau - d1) * rt
    return tau * v.speed


def out_time(v, s: float, D: float) -> float:
    """inverse of src_time: output seconds at which source second `s` (after the in-point) shows"""
    if v.ramp:
        rf, rt, a = v.ramp["from"], v.ramp["to"], v.ramp["at"]
        d1 = a * D
        return s / rf if s <= d1 * rf else d1 + (s - d1 * rf) / rt
    return s / v.speed


def time_map(v, N: int, fps: float):
    """frame remap of the time fx -> (seq, M): output frame j shows frame seq[j] of the view's
    speed-applied timeline; M frames of that timeline are decoded (>= N). seq is None when the
    view plays straight through."""
    fx, cfg = set(v.fx), v.cfg
    if not fx.intersection(TIME_FX):
        return None, N
    D = N / fps
    seq = list(range(N))
    if "freeze" in fx:
        at = (cfg.get("freeze") or FX_CFG["freeze"])["at"]
        seq = [max(0, int(math.floor(out_time(v, at, D) * fps + 1e-6)))] * N
    if "reverse" in fx:
        seq = seq[::-1]
    if "stutter" in fx:
        c = cfg.get("stutter") or FX_CFG["stutter"]
        L = max(1, fr(c["len"], fps))
        seq = (seq[:L] * int(c["repeats"]) + seq[L:])[:N]
    if "step" in fx:
        sf = float((cfg.get("step") or FX_CFG["step"])["fps"])
        if sf < fps:
            seq = [seq[min(N - 1, int(math.floor(math.floor(j * sf / fps + 1e-9) * fps / sf + 1e-6)))]
                   for j in range(N)]
    if seq == list(range(N)):
        return None, N
    return seq, max(N, max(seq) + 1)


# --------------------------------------------------------------------------- load + validate

def parse_zoom(zm, where, E, W):
    """zoom {from, to, ease} -> (z0, z1, ease) or None"""
    if zm is None:
        return None
    if is_num(zm):
        zm = {"from": zm, "to": zm}
    if not isinstance(zm, dict):
        E(where, "zoom must be an object {from, to}")
        return None
    z0_, z1_, ease_ = 1.0, 1.0, "in_out"
    z0, z1 = zm.get("from", 1.0), zm.get("to", zm.get("from", 1.0))
    if not (is_num(z0) and is_num(z1) and z0 > 0 and z1 > 0):
        E(where, "zoom.from/to must be numbers > 0")
    else:
        if z0 < 1 or z1 < 1:
            W(where, f"zoom below 1.0 is not possible without showing borders; "
                     f"clamped to 1.0 (from {z0}, to {z1})")
        if max(z0, z1) > 4:
            W(where, f"zoom {max(z0, z1)} is extreme (soft image)")
        z0_, z1_ = max(1.0, float(z0)), max(1.0, float(z1))
    ease = zm.get("ease", "in_out")
    if ease not in EASES:
        E(where, f"unknown zoom.ease '{ease}' (valid: {', '.join(EASES)})")
    else:
        ease_ = ease
    return z0_, z1_, ease_


def parse_fx(fx, where, E) -> list:
    fx = fx or []
    if isinstance(fx, str):
        fx = [fx]
    if not isinstance(fx, list):
        E(where, "fx must be a list of names")
        fx = []
    for f_ in fx:
        if f_ not in FX_NAMES:
            E(where, f"unknown fx '{f_}' (valid: {', '.join(FX_NAMES)})")
    return [f_ for f_ in dict.fromkeys(fx) if f_ in FX_NAMES]


def parse_pulse(p, where, E, W, fps):
    """pulse {every, amount, phase, decay, anchor} -> normalised dict or None"""
    if p is None or p is False:
        return None
    if not isinstance(p, dict):
        E(where, "pulse must be an object {every, amount, phase, decay}")
        return None
    for k_ in p:
        if k_ not in PULSE_KEYS and not k_.startswith("_"):
            W(where, f"unknown pulse key '{k_}' (valid: {', '.join(sorted(PULSE_KEYS))})")
    out = {"every": None, "amount": 0.06, "phase": 0.0, "decay": 7.0, "anchor": "shot"}
    out.update({k_: v_ for k_, v_ in p.items() if k_ in PULSE_KEYS})
    ok = True
    if not (is_num(out["every"]) and out["every"] > 0):
        E(where, f"pulse.every (seconds between beats, e.g. 60/bpm) must be a number > 0 "
                 f"(got {out['every']!r})")
        ok = False
    elif out["every"] < 2.0 / fps:
        W(where, f"pulse.every {out['every']}s is shorter than two frames (it will flicker)")
    if not (is_num(out["amount"]) and 0 < out["amount"] <= 0.5):
        E(where, f"pulse.amount must be in (0, 0.5] — 0.06 = +6 % scale (got {out['amount']!r})")
        ok = False
    if not is_num(out["phase"]):
        E(where, f"pulse.phase must be a number of seconds (got {out['phase']!r})")
        ok = False
    if not (is_num(out["decay"]) and out["decay"] > 0):
        E(where, f"pulse.decay must be > 0 (got {out['decay']!r}; 7 = back to rest in ~0.4 s)")
        ok = False
    if out["anchor"] not in ("shot", "edit"):
        E(where, f"pulse.anchor must be 'shot' or 'edit' (got {out['anchor']!r})")
        ok = False
    if not ok:
        return None
    return {k_: (float(v_) if is_num(v_) else v_) for k_, v_ in out.items()}


def parse_cfg(src: dict, fx: list, where, E, W, fps) -> dict:
    """settings of strobe/stutter/glitch/step/freeze/posterize (merged with defaults).
    A settings key without the fx name in `fx` switches the fx on (fx is appended in place)."""
    cfg = {}
    for name, dflt in FX_CFG.items():
        val = src.get(name)
        if val is None or val is False:
            if name in fx:
                cfg[name] = dict(dflt)
            continue
        if val is True:
            val = {}
        if not isinstance(val, dict):
            E(where, f"'{name}' must be an object like {json.dumps(dflt)}")
            continue
        for k_ in val:
            if k_ not in dflt and not k_.startswith("_"):
                W(where, f"unknown {name} key '{k_}' (valid: {', '.join(dflt)})")
        c = dict(dflt)
        c.update({k_: v_ for k_, v_ in val.items() if k_ in dflt})
        bad = []
        if name == "strobe":
            if not (is_int(c["every"]) and c["every"] >= 1):
                bad.append(f"strobe.every must be a whole number of frames >= 1 (got {c['every']!r})")
            if c["mode"] not in STROBE_MODES:
                bad.append(f"strobe.mode must be one of {', '.join(STROBE_MODES)} (got {c['mode']!r})")
        elif name == "stutter":
            if not (is_num(c["len"]) and c["len"] > 0):
                bad.append(f"stutter.len must be seconds > 0 (got {c['len']!r})")
            elif fr(c["len"], fps) < 1:
                bad.append(f"stutter.len {c['len']}s is shorter than one frame at {num(fps)} fps")
            if not (is_int(c["repeats"]) and 2 <= c["repeats"] <= 64):
                bad.append(f"stutter.repeats must be a whole number 2..64 (got {c['repeats']!r})")
        elif name == "glitch":
            if not isinstance(c["whole"], bool):
                bad.append(f"glitch.whole must be true or false (got {c['whole']!r})")
            if not (is_num(c["amount"]) and 0 <= c["amount"] <= 1):
                bad.append(f"glitch.amount must be between 0 and 1 (got {c['amount']!r})")
        elif name == "step":
            if not (is_num(c["fps"]) and c["fps"] > 0):
                bad.append(f"step.fps must be > 0 (got {c['fps']!r})")
            elif c["fps"] >= fps:
                W(where, f"step.fps {c['fps']} >= meta.fps {num(fps)}: no visible judder")
        elif name == "freeze":
            if not (is_num(c["at"]) and c["at"] >= 0):
                bad.append(f"freeze.at must be seconds >= 0 into the source span (got {c['at']!r})")
        elif name == "posterize":
            if not (is_int(c["levels"]) and 2 <= c["levels"] <= 8):
                bad.append(f"posterize.levels must be a whole number 2..8 (got {c['levels']!r})")
        for b in bad:
            E(where, b)
        if not bad:
            cfg[name] = {k_: (int(v_) if k_ in ("every", "repeats", "levels") else v_) for k_, v_ in c.items()}
            if name not in fx:
                fx.append(name)
    return cfg


def parse_layout(s: dict, sh, edl_path: Path, where, E, W, fps):
    """layout / layout_bg / layout_gap / panels -> sh.panels (one View per panel)"""
    lay = s.get("layout")
    if lay not in LAYOUTS:
        E(where, f"unknown layout '{lay}' (valid: {', '.join(LAYOUTS)})")
        return
    n = LAYOUTS[lay]
    sh.layout = lay
    if s.get("layout_bg") is not None:
        c = hex_rgb(s.get("layout_bg"))
        if c is None:
            E(where, f"layout_bg '{s.get('layout_bg')}' must be '#RRGGBB'")
        else:
            sh.layout_bg = c
    if s.get("layout_gap") is not None:
        g = s["layout_gap"]
        if not is_num(g) or not 0 <= g <= 200:
            E(where, f"layout_gap must be px at 1080 wide, 0..200 (got {g!r})")
        else:
            sh.layout_gap = float(g)
    raw = s.get("panels")
    if raw is None:                    # the classic delayed stack: same clip, 0.1 s apart
        raw = [{"delay": round(0.1 * j, 3)} for j in range(n)]
    elif not isinstance(raw, list) or len(raw) != n:
        got = len(raw) if isinstance(raw, list) else type(raw).__name__
        E(where, f"layout '{lay}' needs exactly {n} panels (got {got})")
        return
    shot_time_fx = [f_ for f_ in sh.fx if f_ in TIME_FX]
    for j, p in enumerate(raw):
        pw = f"{sh.id}/p{j + 1}"
        v = View(where=pw, clip_rel=sh.clip_rel, clip=sh.clip, clip_exists=sh.clip_exists,
                 inp=sh.inp, speed=sh.speed, ramp=sh.ramp, focus_x=sh.focus_x, focus_y=sh.focus_y,
                 fit=sh.fit, z0=sh.z0, z1=sh.z1, ease=sh.ease, pulse=sh.pulse,
                 seed=seed_of(sh.id, "panel", j))
        if not isinstance(p, dict):
            E(pw, "panel must be an object {clip, in, speed, delay, grade, fx, focus_x, ...}")
            p = {}
        for k_ in p:
            if k_ not in PANEL_KEYS and k_ not in NOTE_KEYS and not k_.startswith("_"):
                W(pw, f"unknown panel key '{k_}' (typo? ignored)")
        clip = p.get("clip")
        if clip not in (None, ""):
            if not isinstance(clip, str):
                E(pw, "clip must be a string path")
            else:
                v.clip_rel, v.clip = clip, resolve_path(clip, edl_path)
                v.clip_exists = v.clip.is_file()
        if p.get("in") is not None:
            if not is_num(p["in"]) or p["in"] < 0:
                E(pw, f"in must be a number >= 0 (got {p['in']!r})")
            else:
                v.inp = float(p["in"])
        if p.get("speed") is not None:
            if not is_num(p["speed"]) or p["speed"] <= 0:
                E(pw, f"speed must be > 0 (got {p['speed']!r})")
            else:
                v.speed, v.ramp = float(p["speed"]), None
        if p.get("delay") is not None:
            if not is_num(p["delay"]) or not 0 <= p["delay"] <= 10:
                E(pw, f"delay must be seconds between 0 and 10 (got {p['delay']!r})")
            else:
                v.delay = float(p["delay"])
        for key in ("focus_x", "focus_y"):
            if p.get(key) is not None:
                if not is_num(p[key]) or not 0 <= p[key] <= 1:
                    E(pw, f"{key} must be between 0 and 1 (got {p[key]!r})")
                else:
                    setattr(v, key, float(p[key]))
        if p.get("fit") is not None:
            if p["fit"] not in FITS:
                E(pw, f"unknown fit '{p['fit']}' (valid: crop, blurfill)")
            else:
                v.fit = p["fit"]
        zr = parse_zoom(p.get("zoom"), pw, E, W)
        if zr:
            v.z0, v.z1, v.ease = zr
        if "pulse" in p:
            v.pulse = parse_pulse(p["pulse"], pw, E, W, fps)
        g = p.get("grade") or "none"
        if g not in GRADE_NAMES:
            E(pw, f"unknown grade '{g}' (valid: {', '.join(GRADE_NAMES)})")
            g = "none"
        v.grade = g
        fx = parse_fx(p.get("fx"), pw, E)
        for f_ in [f_ for f_ in fx if f_ in SHOT_ONLY_FX]:
            E(pw, f"fx '{f_}' is shot-level only (it overlays the whole frame); put it in the shot's fx")
            fx.remove(f_)
        fx += [f_ for f_ in shot_time_fx if f_ not in fx]       # time fx of the shot drive every panel
        cfg = {k_: v_ for k_, v_ in sh.cfg.items()}
        cfg.update(parse_cfg(p, fx, pw, E, W, fps))
        v.fx, v.cfg = fx, cfg
        sh.panels.append(v)


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
        zr = parse_zoom(s.get("zoom"), where, E, W)
        if zr:
            sh.z0, sh.z1, sh.ease = zr
        sh.fx = parse_fx(s.get("fx"), where, E)
        g = s.get("grade") or dg
        if g not in GRADE_NAMES:
            E(where, f"unknown grade '{g}' (valid: {', '.join(GRADE_NAMES)})")
            g = dg
        sh.grade = g
        sh.pulse = parse_pulse(s.get("pulse"), where, E, W, fps)
        sh.cfg = parse_cfg(s, sh.fx, where, E, W, fps)
        dur = max(sh.N, 1) / fps
        if sh.cfg.get("stutter") and sh.cfg["stutter"]["len"] >= dur - 0.5 / fps:
            E(where, f"stutter.len {sh.cfg['stutter']['len']}s must be shorter than the shot ({dur:.3f}s)")
        if s.get("layout") is not None:
            parse_layout(s, sh, edl_path, where, E, W, fps)
        else:
            for k_ in ("panels", "layout_bg", "layout_gap"):
                if s.get(k_) is not None:
                    W(where, f"'{k_}' given without 'layout' (ignored)")
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


def validate_text(where, t: dict, dur: float, issues: list, kind="text", fps: float = 30.0):
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
    if t.get("cps") is not None:
        if not is_num(t["cps"]) or not 0 < t["cps"] <= 200:
            issues.append(Issue("ERROR", where, f"{kind}.cps must be characters per second in (0, 200] "
                                                f"(got {t['cps']!r})"))
            ok = False
        elif st != "typewriter":
            issues.append(Issue("WARN", where, f"{kind}.cps only affects style 'typewriter' (ignored)"))
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
            elif b > dur + 0.5 / fps:
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
                if validate_text(s.id, t_, max(dur, 1e-6), issues, fps=fps):
                    good.append(t_)
            s.text_raw = good
        for vw in (s.panels if s.layout else [s]):
            wid = vw.where if s.layout else s.id
            if s.layout and "stutter" in vw.fx and vw.cfg.get("stutter") and \
                    vw.cfg["stutter"]["len"] >= dur - 0.5 / fps:
                E(wid, f"stutter.len {vw.cfg['stutter']['len']}s must be shorter than the shot ({dur:.3f}s)")
            if vw.clip_rel is None or not vw.clip_exists:
                continue                  # reported as a missing clip (placeholder), not an error
            if not probe_clips:
                continue
            try:
                info = probe_media(vw.clip)
            except EDLError as e:
                E(wid, str(e), "clip_bad")
                continue
            if info["video"] is None:
                E(wid, f"clip has no video stream: {vw.clip_rel}", "clip_bad")
                continue
            vw.clip_info = info["video"]
            cd = float("inf") if is_image(vw.clip) else (info["video"]["duration"] or info["duration"])
            seq, _ = time_map(vw, s.N, fps)
            used = s.N if seq is None else max(seq) + 1          # frames of the view really shown
            span = src_time(vw, used / fps, dur)
            tol = 1.0 / max(info["video"]["fps"] or fps, 1.0)
            delay = getattr(vw, "delay", 0.0)
            lag = delay * (vw.ramp["from"] if vw.ramp else vw.speed)
            end = vw.inp - lag + span
            what = f"in {vw.inp:.3f}s" + (f" - delay {lag:.3f}s" if lag else "")
            if vw.inp >= cd:
                E(wid, f"in-point {vw.inp:.3f}s is past the end of {vw.clip_rel} ({cd:.3f}s)", "clip_short")
            elif end > cd + tol:
                E(wid, f"{what} + source span {span:.3f}s = {end:.3f}s is past the end of "
                       f"{vw.clip_rel} ({cd:.3f}s) by {end - cd:.3f}s "
                       f"(--force holds the last frame)", "clip_short")
            v = info["video"]
            if v["w"] < 16 or v["h"] < 16:
                E(wid, f"clip resolution {v['w']}x{v['h']} is too small", "clip_bad")

    # overlays inside the edit
    for j, o in enumerate(edl.overlays):
        where = f"overlay[{j}]"
        validate_text(where, o, L, issues, kind="overlay", fps=fps)
        if o["start"] < 0 or fr(o["end"], fps) > LF:
            W(where, f"overlay {o['start']}-{o['end']}s extends outside the edit (0-{L:.3f}s); clipped")
        if fr(o["end"], fps) <= fr(o["start"], fps):
            W(where, "overlay is shorter than one frame (skipped)")

    # same position at the same moment -> collision warning (intervals in global frames)
    seen_pairs = set()
    for s in shots:
        items = []
        for t_ in s.text_raw:
            a = s.f0 + fr(float(t_.get("in", 0.0) or 0.0), fps)
            b = s.f1 if t_.get("out") is None else min(s.f1, s.f0 + fr(float(t_["out"]), fps))
            items.append((f"{s.id} text", t_.get("pos", "center"), a, b))
        for j, o in enumerate(edl.overlays):
            a, b = max(fr(o["start"], fps), s.f0), min(fr(o["end"], fps), s.f1)
            if a < b:
                items.append((f"overlay[{j}]", o.get("pos", "upper"), a, b))
        for x in range(len(items)):
            for y in range(x + 1, len(items)):
                n1, p1, a1, b1 = items[x]
                n2, p2, a2, b2 = items[y]
                if p1 == p2 and a1 < b2 and a2 < b1 and (n1, n2) not in seen_pairs:
                    seen_pairs.add((n1, n2))
                    W(s.id, f"{n1} and {n2} share pos '{p1}' at the same time (they will overlap)")


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
                                    fade_out=b < N, accent=hex_rgb(t_.get("accent")), src="text",
                                    cps=t_.get("cps"), ta=a, tb=b))
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
                                    accent=hex_rgb(o.get("accent")), src=f"overlay[{j}]",
                                    cps=o.get("cps"), ta=o0 - s.f0, tb=o1 - s.f0))


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
    max_rate: float                # video bitrate cap in Mbps (0 = uncapped crf)
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
                "crf": self.crf, "max_rate": self.max_rate,
                "safe": [self.safe_top, self.safe_bottom, self.safe_right],
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
                    max_rate=0.0 if args.preview else max(0.0, args.max_rate),
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
    elif st == "whisper":   # soft sung lyric for slow sections: as written, light, letter-spaced
        lines = wrap_text(content, 24)
        m, _ = fit_block(lines, F.regular, 66 * k, maxw, maxh, tracking_em=0.05, lh=1.25)
        fill = solid(m, (255, 255, 255))
        img, pad = with_shadow(fill, k, soft=(12, 4, 0.7), tight=(2, 1.5, 0.45))
    elif st == "ransom":    # punk ransom note: every letter cut from a different page
        block = ransom_block(content, S, maxw, maxh)
        img, pad = with_shadow(block, k, soft=(11, 7, 0.62), tight=(2.5, 3, 0.5))
    elif st == "stamp":     # rubber stamp: distressed red ink in a rough frame, rotated
        block = stamp_block(content, S, item.accent or INK_RED, maxw, maxh)
        img, pad = with_shadow(block, k, soft=(8, 3, 0.35), tight=(0, 0, 0))
    else:  # quote
        txt = content
        if txt[:1] not in "\"“'«":
            txt = "“" + txt + "”"
        lines = wrap_text(txt, 24)
        m, _ = fit_block(lines, F.body, 62 * k, maxw, maxh, lh=1.22, shear=0.2)
        fill = solid(m, (255, 255, 255))
        img, pad = with_shadow(fill, k, soft=(9, 4, 0.6), tight=(2, 1.5, 0.5))
    return img, img.width - 2 * pad, img.height - 2 * pad, pad


# ---- punk text styles -------------------------------------------------------------------

import random as _random   # noqa: E402  (per-letter choices; seeded, so deterministic)

RANSOM_PAPERS = [("white", (247, 245, 238), 0.27), ("news", (239, 230, 207), 0.25),
                 ("black", (22, 21, 20), 0.2), ("red", INK_RED, 0.16), ("none", None, 0.12)]


def _wchoice(rng, items, weights):
    return rng.choices(items, weights=weights, k=1)[0]


def ransom_tile(ch: str, size: float, rng, fonts, k: float) -> Image.Image:
    """one cut-out letter: random face/size/paper/ink, irregular paper edge, rotated +-7 deg"""
    path = _wchoice(rng, [f_[0] for f_ in fonts], [f_[1] for f_ in fonts])
    s = size * rng.uniform(0.85, 1.2)
    paper_name, paper, _ = _wchoice(rng, RANSOM_PAPERS, [p_[2] for p_ in RANSOM_PAPERS])
    r_ink, r_rot, r_px, r_py = rng.random(), rng.uniform(-7, 7), rng.uniform(0.1, 0.2), rng.uniform(0.07, 0.15)
    jit = [rng.uniform(0, 0.07) for _ in range(8)]
    tex_seed = rng.randrange(1 << 30)
    if paper_name == "white":
        ink = (16, 16, 16) if r_ink < 0.74 else INK_RED
    elif paper_name == "news":
        ink = (20, 18, 16) if r_ink < 0.85 else INK_RED
    elif paper_name == "black":
        ink = (250, 248, 240)
    elif paper_name == "red":
        ink = (255, 255, 255) if r_ink < 0.6 else (14, 14, 14)
    else:
        ink = (255, 255, 255)
    fnt = font(path, s)
    x0, y0, x1, y1 = fnt.getbbox(ch, anchor="ls")
    gw, gh = max(x1 - x0, int(0.18 * s)), max(y1 - y0, int(0.18 * s))
    px, py = int(round(r_px * s)), int(round(r_py * s))
    tw, th = gw + 2 * px, gh + 2 * py
    img = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if paper is not None:
        J = [j_ * s for j_ in jit]
        poly = [(J[0], J[1]), (tw - 1 - J[2], J[3]), (tw - 1 - J[4], th - 1 - J[5]), (J[6], th - 1 - J[7])]
        pm = Image.new("L", (tw, th), 0)
        ImageDraw.Draw(pm).polygon(poly, fill=255)
        grain = np.random.default_rng(tex_seed).normal(0, 7 if paper_name != "black" else 4, (th, tw, 1))
        base = np.array(paper, np.float32)[None, None, :] + grain
        if paper_name == "news":           # faint printed lines of the page it was cut from
            base -= (((np.arange(th) // max(2, int(3 * k))) % 4 == 0) * 10.0)[:, None, None]
        tile = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
        tile.putalpha(pm)
        img.alpha_composite(tile)
        d.text((px - x0, py - y0), ch, font=fnt, fill=ink + (255,), anchor="ls")
    else:       # letter cut straight out of a poster: white with a dark edge so it reads on footage
        d.text((px - x0, py - y0), ch, font=fnt, fill=ink + (255,), anchor="ls",
               stroke_width=max(1, int(round(0.045 * s))), stroke_fill=(10, 10, 10, 255))
    return img.rotate(r_rot, resample=Image.BICUBIC, expand=True)


def ransom_block(content: str, S: Settings, maxw: float, maxh: float) -> Image.Image:
    """case kept as written; words never split; letters seeded from the content"""
    k = S.k
    fonts = [(p_, w_) for p_, w_ in RANSOM_FONTS if Path(p_).is_file()] or [(S.fonts.heavy, 1)]
    seed = seed_of("ransom", content)
    lines = wrap_text(content, 11)
    size = 100 * k
    block = None
    for _ in range(8):
        rows, idx = [], 0
        for li, ln in enumerate(lines):
            tiles = []
            for ch in ln:
                rng = _random.Random(seed * 1000003 + idx)
                idx += 1
                if ch.isspace():
                    tiles.append(None)
                    continue
                tiles.append((ransom_tile(ch, size, rng, fonts, k),
                              rng.uniform(-0.07, 0.03) * size, rng.uniform(-0.07, 0.07) * size))
            if not tiles:
                rows.append(Image.new("RGBA", (1, int(size * 0.6)), (0, 0, 0, 0)))
                continue
            gap = 0.32 * size
            wsum, hmax = 0.0, 1
            for t_ in tiles:
                if t_ is None:
                    wsum += gap
                else:
                    wsum += t_[0].width + t_[1]
                    hmax = max(hmax, t_[0].height)
            jy = int(0.08 * size) + 2
            row = Image.new("RGBA", (int(math.ceil(wsum)) + 4, hmax + 2 * jy), (0, 0, 0, 0))
            x = 2.0
            for t_ in tiles:
                if t_ is None:
                    x += gap
                    continue
                im, dx, dy = t_
                row.alpha_composite(im, (int(round(x)), int(round((row.height - im.height) / 2 + dy))))
                x += im.width + dx
            bb = row.getbbox()
            rows.append(row.crop(bb) if bb else row)
        block = stack(rows, [int(0.02 * size)] * (len(rows) - 1))
        if block.width <= maxw and block.height <= maxh:
            break
        size *= min(maxw / block.width, maxh / block.height) * 0.98
    return block


def stamp_block(content: str, S: Settings, ink, maxw: float, maxh: float) -> Image.Image:
    """heavy caps in a rough double frame, ink eroded by noise, rotated -6 deg"""
    k, F = S.k, S.fonts
    lines = wrap_text(content.upper(), 12)
    m, size = fit_block(lines, F.heavy, 118 * k, maxw * 0.78, maxh * 0.55, squeeze=F.squeeze, lh=0.96,
                        tracking_em=0.035)
    pad, bw = int(0.3 * size), max(3, int(round(0.085 * size)))
    marg = int(0.08 * size) + 2
    Wb, Hb = m.width + 2 * (pad + bw) + 2 * marg, m.height + 2 * (pad + bw) + 2 * marg
    rng = np.random.default_rng(seed_of("stamp", content))
    mask = Image.new("L", (Wb, Hb), 0)
    d = ImageDraw.Draw(mask)

    def rough_rect(x0, y0, x1, y1, width):
        j = lambda: float(rng.uniform(-0.25, 0.25) * width)        # noqa: E731
        pts = [(x0 + j(), y0 + j()), (x1 + j(), y0 + j()), (x1 + j(), y1 + j()), (x0 + j(), y1 + j())]
        d.line(pts + [pts[0]], fill=255, width=width, joint="curve")

    rough_rect(marg + bw / 2, marg + bw / 2, Wb - marg - bw / 2, Hb - marg - bw / 2, bw)
    inner = int(round(bw * 1.9))
    rough_rect(marg + inner + bw / 2, marg + inner + bw / 2, Wb - marg - inner - bw / 2,
               Hb - marg - inner - bw / 2, max(1, int(round(bw * 0.38))))
    tx, ty = marg + bw + pad, marg + bw + pad
    region = mask.crop((tx, ty, tx + m.width, ty + m.height))
    mask.paste(ImageChops.lighter(region, m), (tx, ty))
    a = np.asarray(mask.filter(ImageFilter.GaussianBlur(max(0.8, 1.6 * k))), np.float32) / 255.0
    h_, w_ = a.shape
    edge = rng.random((h_, w_)).astype(np.float32)
    edge = np.asarray(Image.fromarray((edge * 255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(max(0.6, 1.1 * k))), np.float32) / 255.0
    a = np.clip((a - 0.5 + 0.9 * (edge - 0.5)) * 7 + 0.5, 0, 1)            # ragged, inky edges
    lo = rng.random((max(2, h_ // 22), max(2, w_ // 22))).astype(np.float32)
    lo = np.asarray(Image.fromarray((lo * 255).astype(np.uint8)).resize((w_, h_), Image.BICUBIC),
                    np.float32) / 255.0
    cover = np.clip(0.45 + 0.95 * lo, 0.3, 1.0)                             # uneven ink load
    holes = (rng.random((h_, w_)) > 0.94).astype(np.float32)
    holes = np.asarray(Image.fromarray((holes * 255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(max(0.6, 1.2 * k))), np.float32) / 255.0
    a = a * cover * np.clip(1 - 2.2 * holes, 0, 1) * 0.94
    img = Image.new("RGBA", (w_, h_), tuple(ink) + (255,))
    img.putalpha(Image.fromarray((a * 255).astype(np.uint8), "L"))
    img = img.rotate(6, resample=Image.BICUBIC, expand=True)    # PIL: positive = counter-clockwise
    bb = img.getbbox()
    return img.crop(bb) if bb else img


def typewriter_frames(item: TextItem, S: Settings, fps: float):
    """-> ({local frame: RGBA}, ink w, ink h, pad). Monospace, as written, typed out with a
    blinking underscore cursor; the reveal spans the first 80 % of the text's time (or runs at
    item.cps), so the finished line holds for a beat."""
    k = S.k
    path = _first_existing(SYSTEM_TYPEWRITER) or S.fonts.regular
    lines = wrap_text(item.content.strip(), 20)
    maxw, maxh = S.maxw, (S.H - S.safe_top - S.safe_bottom) * 0.85
    size = 68 * k
    for _ in range(8):
        fnt = font(path, size)
        adv = fnt.getlength("M")
        lh = size * 1.3
        bw = adv * (max(len(ln) for ln in lines) + 1)
        bh = lh * (len(lines) - 1) + size * 1.15
        if bw <= maxw and bh <= maxh:
            break
        size *= min(maxw / bw, maxh / bh) * 0.98
    asc = fnt.getmetrics()[0]
    rng = _random.Random(seed_of("typewriter", item.content))
    chars = []             # (char, x, baseline y, dy jitter, alpha)
    for li, ln in enumerate(lines):
        for ci, ch in enumerate(ln):
            chars.append((ch, ci * adv, asc + li * lh, rng.uniform(-1.3, 1.3) * k, int(rng.uniform(205, 255))))
    total = len(chars)
    cw, ch_ = int(math.ceil(bw)) + 2, int(math.ceil(bh)) + 2
    ta = item.ta if item.ta is not None else item.a
    tb = item.tb if item.tb is not None else item.b
    span = max(1, int(round(0.8 * (tb - ta))))
    blink = max(2, int(round(0.27 * fps)))
    cache, frames = {}, {}
    done_at = None
    for j in range(item.a, item.b):
        rel = j - ta
        if item.cps:
            c = min(total, int(math.floor(rel / fps * item.cps + 1e-9)) + 1)
        else:
            c = min(total, int(math.ceil((rel + 1) * total / span - 1e-9)))
        if c >= total and done_at is None:
            done_at = rel
        cur_on = c < total or ((rel - done_at) // blink) % 2 == 1
        key = (c, cur_on)
        if key not in cache:
            img = Image.new("RGBA", (cw, ch_), (0, 0, 0, 0))
            d = ImageDraw.Draw(img)
            for ch, x, y, dy, al in chars[:c]:
                if not ch.isspace():
                    d.text((x, y + dy), ch, font=fnt, fill=(246, 244, 236, al), anchor="ls")
            if cur_on:
                if c == 0:
                    cx, cy = 0.0, asc
                else:
                    _, x, y, _, _ = chars[c - 1]
                    cx, cy = x + adv, y
                d.text((cx, cy), "_", font=fnt, fill=(246, 244, 236, 255), anchor="ls")
            cache[key] = with_shadow(img, k, soft=(10, 4, 0.8), tight=(2, 1.5, 0.55))[0]
        frames[j] = cache[key]
    pad = with_shadow(Image.new("RGBA", (cw, ch_)), k, soft=(10, 4, 0.8), tight=(2, 1.5, 0.55))[1]
    return frames, cw, ch_, pad


def glitchtext_frames(item: TextItem, S: Settings, fps: float):
    """-> ({local frame: RGBA}, ink w, ink h, pad). Huge heavy caps, red/cyan split copies and
    horizontally torn slices; violent for the first ~8 frames, then a calmer twitching hold."""
    k, F = S.k, S.fonts
    maxw, maxh = S.maxw, (S.H - S.safe_top - S.safe_bottom) * 0.85
    lines = wrap_text(item.content.strip().upper(), 9)
    m, size = fit_block(lines, F.heavy, 236 * k, maxw * 0.84, maxh * 0.5, squeeze=F.squeeze, lh=0.9,
                        tracking_em=-0.01)
    mx, my = int(0.08 * m.width + 0.06 * size) + 2, int(0.04 * size) + 2
    cw, ch_ = m.width + 2 * mx, m.height + 2 * my
    base = np.zeros((ch_, cw), np.float32)
    base[my:my + m.height, mx:mx + m.width] = np.asarray(m, np.float32) / 255.0
    red, cyan = np.array([255, 28, 56], np.float32), np.array([0, 226, 255], np.float32)
    seed = seed_of("glitchtext", item.content)
    ta = item.ta if item.ta is not None else item.a

    def compose(state: int, g: float):
        rng = np.random.default_rng(seed + state * 7919)
        dx = int(round((0.022 + 0.035 * g) * size * rng.uniform(0.7, 1.2)))
        dy = int(round(0.01 * size * rng.uniform(-1, 1)))
        mr = np.roll(np.roll(base, dx, axis=1), dy, axis=0)
        mc = np.roll(np.roll(base, -dx, axis=1), -dy, axis=0)
        col = np.clip(mr[..., None] * red + mc[..., None] * cyan, 0, 255)       # premultiplied
        al = np.maximum(mr, mc)
        col = col * (1 - base[..., None]) + 255.0 * base[..., None]
        al = np.maximum(al, base)
        rgba = np.concatenate([col, al[..., None] * 255.0], axis=2)
        for _ in range(2 + int(g > 0.5) + int(rng.random() < g)):              # torn slices
            hh = max(2, int(rng.uniform(0.05, 0.16) * m.height))
            y0 = int(rng.uniform(my, my + m.height - hh))
            sh = int(rng.choice([-1, 1]) * rng.uniform(0.025, 0.06 + 0.05 * g) * m.width)
            band = np.roll(rgba[y0:y0 + hh], sh, axis=1)
            if sh > 0:
                band[:, :sh] = 0
            elif sh < 0:
                band[:, sh:] = 0
            rgba[y0:y0 + hh] = band
        a = np.maximum(rgba[..., 3:4] / 255.0, 1e-6)
        out = np.concatenate([np.clip(rgba[..., :3] / a, 0, 255), rgba[..., 3:4]], axis=2)
        img = Image.fromarray(out.astype(np.uint8), "RGBA")
        return with_shadow(img, k, soft=(12, 6, 0.55), tight=(2.5, 2, 0.4))[0]

    cache, frames = {}, {}
    twitch = max(4, int(round(0.55 * fps)))
    for j in range(item.a, item.b):
        rel = j - ta
        if rel < 8:
            key, g = rel // 2, 1.0 - 0.08 * rel
        elif rel % twitch in (0, 1):
            key, g = 100 + rel // twitch, 0.75
        else:
            key, g = 99, 0.25
        if key not in cache:
            cache[key] = compose(key, g)
        frames[j] = cache[key]
    pad = with_shadow(Image.new("RGBA", (cw, ch_)), k, soft=(12, 6, 0.55), tight=(2.5, 2, 0.4))[1]
    return frames, cw, ch_, pad


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

def placeholder_assets(shot: Shot, S: Settings, edl: EDL, outdir: Path, missing: bool,
                       avoid_rects=()):
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

    # --- chrome (static, never zoomed/shaken): progress track + corner label + tag
    chrome = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(chrome)
    bar_h = max(4, int(round(10 * k)))
    d.rectangle((0, 0, W, bar_h - 1), fill=(0, 0, 0, 110))
    # one compact row in the top UI band (above the safe zone, where captions never go)
    tag = "NO CLIP" if missing else "ANIMATIC"
    l1 = f"{shot.id.upper()}" + (f" · {shot.section.upper()}" if shot.section else "")
    l2 = f"{tc(shot.f0 / S.fps)} → {tc(shot.f1 / S.fps)} · {shot.N}f"
    fs = 26 * k
    for _ in range(4):
        f1_, f2_, tf = font(F.body, fs), font(F.regular, fs * 0.9), font(F.body, fs * 0.8)
        padx, gap = 16 * k, 14 * k
        w1, w2, wt = f1_.getlength(l1), f2_.getlength(l2), tf.getlength(tag) + 2 * 11 * k
        total = padx + w1 + gap + w2 + padx + gap + wt
        if total <= W - 72 * k:
            break
        fs *= (W - 72 * k) / total
    bh_ = fs * 1.75
    bx, by = 36 * k, bar_h + max(12 * k, (S.safe_top - bar_h - bh_) / 2)
    bw_ = padx + w1 + gap + w2 + padx
    cy = by + bh_ / 2
    d.rounded_rectangle((bx, by, bx + bw_, by + bh_), radius=int(bh_ / 2), fill=(0, 0, 0, 125))
    d.text((bx + padx, cy), l1, font=f1_, fill=(255, 255, 255, 255), anchor="lm")
    d.text((bx + padx + w1 + gap, cy), l2, font=f2_, fill=(255, 255, 255, 210), anchor="lm")
    tx = bx + bw_ + gap
    th_ = fs * 1.3
    tagcol = (255, 176, 32, 235) if missing else (255, 255, 255, 215)
    d.rounded_rectangle((tx, cy - th_ / 2, tx + wt, cy + th_ / 2), radius=int(th_ / 2), fill=tagcol)
    d.text((tx + wt / 2, cy), tag, font=tf, fill=(17, 17, 17, 255), anchor="mm")
    label_rect = (bx, by, tx + wt - bx, bh_)

    # --- title block: placed where it collides with no caption (and not the corner label)
    def build_block(sc):
        maxw = S.maxw
        parts, gaps = [], []
        tm, tsize = fit_block(wrap_text(title.upper(), 13), F.heavy, 100 * k * sc, maxw, 0.3 * H,
                              squeeze=F.squeeze, lh=0.95)
        tm_img, tpad = with_shadow(solid(tm, (255, 255, 255)), k, soft=(10, 5, 0.45), tight=(2, 2, 0.35))
        parts.append(tm_img)
        if sub:
            sm, _ = fit_block(wrap_text(sub, 30), F.body, 40 * k * sc, maxw, 0.12 * H, lh=1.25)
            gaps.append(int(round(0.28 * tsize)) - tpad)
            parts.append(solid(sm, (255, 255, 255), 0.92))
        if hint:
            hm, _ = fit_block(wrap_text(hint, 40), F.regular, 29 * k * max(sc, 0.85), maxw - 40 * k,
                              0.15 * H, lh=1.3)
            bw2, bh2 = int(hm.width + 40 * k), int(hm.height + 28 * k)
            box = Image.new("RGBA", (bw2, bh2), (0, 0, 0, 0))
            ImageDraw.Draw(box).rounded_rectangle((0, 0, bw2 - 1, bh2 - 1), radius=int(14 * k),
                                                  fill=(0, 0, 0, 80))
            box.alpha_composite(solid(hm, (255, 255, 255), 0.85), ((bw2 - hm.width) // 2, (bh2 - hm.height) // 2))
            gaps.append(int(round(34 * k * sc)))
            parts.append(box)
        inner = stack(parts, gaps)
        # a translucent slate panel so the card info never reads as one of the edit's captions
        px_, py_ = int(30 * k), int(26 * k)
        pw, ph2 = min(int(W - 2 * 36 * k), inner.width - 2 * tpad + 2 * px_), inner.height - tpad + 2 * py_
        pw = max(pw, inner.width - 2 * tpad)
        panel = Image.new("RGBA", (pw + 2 * tpad, ph2 + 2 * tpad), (0, 0, 0, 0))
        ImageDraw.Draw(panel).rounded_rectangle((tpad, tpad, tpad + pw - 1, tpad + ph2 - 1), radius=int(26 * k),
                                                fill=(0, 0, 0, 70), outline=(255, 255, 255, 70),
                                                width=max(1, int(round(2 * k))))
        panel.alpha_composite(inner, ((panel.width - inner.width) // 2, py_))
        return panel, tpad

    top, bot = S.safe_top, H - S.safe_bottom
    margin = 30 * k
    avoid = [label_rect] + [(x - margin, y - margin, w + 2 * margin, h + 2 * margin) for x, y, w, h in avoid_rects]

    def overlap(r1, r2):
        ox = min(r1[0] + r1[2], r2[0] + r2[2]) - max(r1[0], r2[0])
        oy = min(r1[1] + r1[3], r2[1] + r2[3]) - max(r1[1], r2[1])
        return max(ox, 0) * max(oy, 0)

    best = None
    for sc in (1.0, 0.85, 0.72, 0.6):
        block, tpad = build_block(sc)
        bxw, bxh = block.width - 2 * tpad, block.height - 2 * tpad    # panel box (without shadow pad)
        x0 = (W - bxw) / 2
        y_lo, y_hi = top + 8 * k, max(top + 8 * k, bot - 0.02 * H - bxh)
        centre = (top + bot) / 2
        cands = sorted(set([y_lo, y_hi, clamp(centre - bxh / 2, y_lo, y_hi)]
                           + [y_lo + i * 6 * k for i in range(int((y_hi - y_lo) / (6 * k)) + 1)]))
        for yy in cands:
            ov = sum(overlap((x0, yy, bxw, bxh), r) for r in avoid)
            cost = ov * 100 + abs(yy + bxh / 2 - centre)
            if best is None or cost < best[0]:
                best = (cost, ov, block, tpad, yy)
        if best[1] == 0:
            break
    _, _, block, tpad, yy = best
    card.alpha_composite(block, ((W - block.width) // 2, int(round(yy - tpad))))
    card_path = outdir / "card.png"
    card.convert("RGB").save(card_path, compress_level=1)
    chrome_path = outdir / "chrome.png"
    chrome.save(chrome_path, compress_level=1)
    return card_path, chrome_path, bar_h


# --------------------------------------------------------------------------- filtergraph pieces

GRADES = {
    "none": {},
    "teal_orange": {"eq": "contrast=1.08:saturation=1.15",
                    "cb": "rs=-0.13:gs=0.01:bs=0.15:rm=0.05:gm=-0.01:bm=-0.05:rh=0.10:gh=0.03:bh=-0.11",
                    "curves": "all='0/0 0.25/0.21 0.75/0.80 1/1'"},
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
    "gold": {"eq": "contrast=1.06:saturation=1.05:brightness=0.02",
             "cb": "rs=0.07:gs=0.01:bs=-0.10:rm=0.13:gm=0.03:bm=-0.13:rh=0.10:gh=0.05:bh=-0.13",
             "curves": "all='0/0.02 0.5/0.53 1/1'"},
}


def ease_expr(p: str, ease: str) -> str:
    if ease == "linear":
        return p
    if ease == "in":
        return f"({p}*{p})"
    if ease == "out":
        return f"(1-(1-{p})*(1-{p}))"
    if ease == "snap":          # punch that settles: ~55 % of the move in the first tenth, then glides
        return f"((1-exp(-8*{p}))/{1 - math.exp(-8):.8f})"
    return f"({p}*{p}*(3-2*{p}))"


def pulse_mul(pulse: dict | None, fps: float, t_shot0: float, n: str = "ld(0)") -> str:
    """beat zoom bounce as a multiplier expression of the frame index `n`: jumps to 1+amount on
    the frame nearest each beat (phase + k*every), then decays exponentially."""
    if not pulse:
        return "1"
    off = (t_shot0 if pulse.get("anchor") == "edit" else 0.0) - pulse["phase"]
    h = 0.5 / fps
    d = f"max(0,mod({n}/{num(fps)}+{num(off + h)},{num(pulse['every'])})-{num(h)})"
    return f"(1+{num(pulse['amount'])}*exp(-{num(pulse['decay'])}*{d}))"


# camera shakes: seconds, extra zoom (hides borders), x / y amplitude (of the half window),
# rotation (rad), and the per-frame phase speeds of the sine mix (high = more random jumps)
SHAKES = {"shake": (0.35, 0.09, 0.048, 0.032, 0.012, (2.39, 5.13, 3.17, 6.71, 2.77)),
          "shake_hard": (0.55, 0.17, 0.095, 0.07, 0.034, (3.91, 7.37, 4.83, 8.29, 5.53))}
WHIP_FRAMES = 4


def whip_offset(whip, N: int, ow: float) -> str | None:
    """horizontal content shift (output px) of whip_in (slides in from the right) / whip_out
    (leaves to the left), as an expression of ld(0); None when there is no whip"""
    parts = []
    if "whip_in" in whip:
        parts.append(f"if(lt(ld(0),{WHIP_FRAMES}),{num(0.42 * ow)}*pow(({WHIP_FRAMES}-ld(0))/{WHIP_FRAMES},2),0)")
    if "whip_out" in whip:
        s0 = max(N - WHIP_FRAMES, 0)
        parts.append(f"if(gte(ld(0),{s0}),-{num(0.42 * ow)}*pow((ld(0)-{s0 - 1})/{WHIP_FRAMES},2),0)")
    return "+".join(parts) if parts else None


def perspective_filter(S: Settings, N: int, src, crop, zfun, fx_, fy_, shake=None,
                       enable_until: float | None = None, whip=(), size=None, enable: str | None = None) -> str:
    """Sub-pixel smooth zoom / shake / whip slide on a frame that already is the output size.

    src  = (Wd, Hd, bw, bh): source display size and its z=1 window size
    crop = (xm, ym, wm, hm): the static window (source px) that was scaled to the output size
    zfun(p, n) -> expression for the absolute zoom (relative to the z=1 window)
    shake: None | True | "shake" | "shake_hard";  whip: names among whip_in / whip_out
    size: (ow, oh) output size (default S.W x S.H)
    """
    Wd, Hd, bw, bh = src
    xm, ym, wm, hm = crop
    OW, OH = size or (S.W, S.H)
    sx, sy = OW / wm, OH / hm
    pre = ["st(0,in-1)", f"st(8,clip(ld(0)/{max(N - 1, 1)},0,1))", f"st(1,{zfun('ld(8)', 'ld(0)')})",
           f"st(2,{num(bw)}/ld(1))", f"st(3,{num(bh)}/ld(1))",
           f"st(4,(clip({num(fx_ * Wd)},ld(2)/2,{num(Wd)}-ld(2)/2)-{num(xm)})*{sx:.8f})",
           f"st(5,(clip({num(fy_ * Hd)},ld(3)/2,{num(Hd)}-ld(3)/2)-{num(ym)})*{sy:.8f})",
           f"st(2,min(ld(2)*{sx / 2:.8f},{num(OW / 2)}))", f"st(3,min(ld(3)*{sy / 2:.8f},{num(OH / 2)}))",
           f"st(4,clip(ld(4),ld(2),{num(OW)}-ld(2)))", f"st(5,clip(ld(5),ld(3),{num(OH)}-ld(3)))"]
    if shake is True:
        shake = "shake"
    if shake:
        secs, zm, ax, ay, rot, w = SHAKES[shake]
        sf = max(1, int(round(secs * S.fps)))
        pw_ = 2 if shake == "shake" else 1.4
        pre += [f"st(6,pow(max(0,1-ld(0)/{sf}),{pw_}))",
                f"st(2,ld(2)/(1+{zm}*ld(6)))", f"st(3,ld(3)/(1+{zm}*ld(6)))",
                f"st(4,ld(4)+ld(2)*{ax}*ld(6)*(0.65*sin(ld(0)*{w[0]}+1.1)+0.35*sin(ld(0)*{w[1]}+0.4)))",
                f"st(5,ld(5)+ld(3)*{ay}*ld(6)*(0.6*sin(ld(0)*{w[2]}+2.3)+0.4*sin(ld(0)*{w[3]}+0.9)))",
                f"st(7,{rot}*ld(6)*sin(ld(0)*{w[4]}+0.7))"]
    wo = whip_offset(whip, N, OW)
    if wo:
        pre.append(f"st(4,ld(4)-({wo}))")
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
    if enable is not None:
        f_ += f":enable='{enable}'"
    elif enable_until is not None:
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


# --------------------------------------------------------------------------- punk pack: procedural maps

# Procedural looks are generated per shot with numpy from a seed (shot id / panel), written as
# rawvideo / PNG into the shot's temp dir and fed to ffmpeg, so a re-render is bit-identical.
MAP_LINES = 480                 # VHS displacement map: one row per "tape line" (4 px at 1920 high)
GLITCH_ROWS, GLITCH_COLS = 240, 32
LEAK_W, LEAK_H = 72, 128        # light leaks: tiny, smooth -> upscaled bicubic
NOISE_W, NOISE_H = 136, 240     # VHS tracking noise / dropouts (soft once upscaled)
GLITCH_BURST = [1.0, 0.92, 0.78, 0.6, 0.42, 0.25]


def gbrp_bytes(rgb: np.ndarray) -> bytes:
    """(frames, 3 [R,G,B], h, w) -> rawvideo bytes in ffmpeg gbrp plane order (G, B, R)"""
    return np.ascontiguousarray(np.clip(rgb, 0, 255).astype(np.uint8)[:, [1, 2, 0]]).tobytes()


def glitch_schedule(seed: int, N: int, cfg: dict):
    """-> list of (state id, intensity) per frame. A burst on the first frames; with whole=true,
    hits of 1-3 held frames all through the shot, denser and harder with `amount`."""
    amt = float(cfg.get("amount", 0.7))
    mag = 0.35 + 0.65 * amt
    rng = np.random.default_rng(seed)
    sched = [(-1, 0.0)] * N
    for j in range(min(N, len(GLITCH_BURST))):
        sched[j] = (j, GLITCH_BURST[j] * mag)
    if cfg.get("whole"):
        j, sid = len(GLITCH_BURST), 100
        while j < N:
            j += int(rng.integers(1, 3 + int(round(7 * (1 - amt)))))     # clean frames
            ln, g = int(rng.integers(1, 4)), float(rng.uniform(0.45, 1.0)) * mag
            for q in range(j, min(N, j + ln)):
                sched[q] = (sid, g)
            sid += 1
            j += ln
    return sched


def glitch_map(seed: int, g: float, k: float) -> np.ndarray:
    """one frame of horizontal displacement (3 [R,G,B], rows, cols) as 128 +/- px: torn slices with
    a red/blue split inside, macroblock bands, and a whole-frame RGB jitter. Values are designed at
    1080 px wide and scaled by k."""
    rng = np.random.default_rng(seed)
    R, C = GLITCH_ROWS, GLITCH_COLS
    dx = np.zeros((3, R, C), np.float32)
    if g > 0:
        for _ in range(1 + int(round(g * rng.uniform(3, 7)))):               # torn slices
            h = int(rng.integers(1, 3 + int(12 * g)))
            y0 = int(rng.integers(0, R - h))
            dx[:, y0:y0 + h] += rng.choice([-1, 1]) * rng.uniform(16, 28 + 95 * g)
            cs = rng.uniform(4, 6 + 16 * g)
            dx[0, y0:y0 + h] += cs
            dx[2, y0:y0 + h] -= cs
        if rng.random() < 0.3 + 0.6 * g:                                    # macroblock bands
            for _ in range(1 + int(g > 0.6)):
                h = int(rng.integers(2, 8))
                y0 = int(rng.integers(0, R - h))
                c = 0
                while c < C:
                    w_ = int(rng.integers(2, 6))
                    if rng.random() < 0.6:
                        dx[:, y0:y0 + h, c:c + w_] += rng.uniform(-75, 75) * g
                    c += w_
        j = rng.uniform(2, 3 + 9 * g)                                       # RGB jitter
        dx[0] += j
        dx[2] -= j
    return np.clip(np.round(dx * k), -127, 127) + 128


def vhs_maps(seed: int, N: int, k: float):
    """-> (xmap (N, 3, MAP_LINES, 2), noise RGBA (N, NOISE_H, NOISE_W, 4)). Line wobble, head-switching
    skew at the bottom, dropouts, and (on about 60 % of shots) a tracking band that rolls up."""
    rng = np.random.default_rng(seed)
    L = MAP_LINES
    y = (np.arange(L) + 0.5) / L
    dx = np.zeros((N, L), np.float32)
    hs = max(2, int(L * 0.022))
    for n in range(N):
        dx[n] = 1.4 * np.sin(2 * np.pi * 2.3 * y + rng.uniform(0, 2 * np.pi)) + rng.normal(0, 0.5, L)
        dx[n, L - hs:] += np.linspace(8, 55, hs) + rng.normal(0, 4, hs)
    noise = np.zeros((N, NOISE_H, NOISE_W, 4), np.float32)
    ny = (np.arange(NOISE_H) + 0.5) / NOISE_H
    for n in range(N):                                                         # dropouts
        for _ in range(int(rng.poisson(0.6))):
            r, x0 = int(rng.integers(0, NOISE_H)), int(rng.integers(0, NOISE_W - 4))
            ln = int(rng.integers(3, 16))
            noise[n, r, x0:x0 + ln] = (255, 255, 255, rng.uniform(0.35, 0.8))
    if N >= 8 and rng.random() < 0.6:                                           # tracking band
        dur = int(min(N, rng.integers(10, 23)))
        start = int(rng.integers(0, N - dur + 1))
        y0, y1, hb = rng.uniform(0.8, 1.1), rng.uniform(-0.15, 0.4), rng.uniform(0.05, 0.09)
        sign = rng.choice([-1, 1])
        for q in range(dur):
            n = start + q
            cy = y0 + (y1 - y0) * q / max(dur - 1, 1)
            env = math.sin(math.pi * (q + 0.5) / dur) ** 0.5
            prof = np.clip(1 - np.abs(y - cy) / (hb / 2), 0, 1) ** 0.7
            dx[n] += prof * env * (rng.normal(0, 20, L) + sign * 26)
            nprof = np.clip(1 - np.abs(ny - cy) / (hb / 2), 0, 1)
            streak = (rng.random((NOISE_H, NOISE_W)) < 0.22 * nprof[:, None]).astype(np.float32)
            streak = np.maximum(streak, np.roll(streak, 1, axis=1))                # horizontal dashes
            a = np.clip(streak * rng.uniform(0.35, 0.9, (NOISE_H, 1)) + 0.10 * nprof[:, None], 0, 1) * env
            noise[n, ..., 3] = np.maximum(noise[n, ..., 3], a)
            noise[n, ..., :3] = np.where((a > 0)[..., None], 245.0, noise[n, ..., :3])
    xm = np.clip(np.round(dx * k), -127, 127) + 128
    xmap = np.repeat(np.repeat(xm[:, None, :, None], 3, axis=1), 2, axis=3)
    noise[..., 3] *= 255.0
    return xmap, np.clip(noise, 0, 255).astype(np.uint8)


LEAK_COLORS = [(255, 118, 36), (255, 64, 28), (255, 168, 72), (236, 52, 96), (255, 196, 120)]


def leak_frames(seed: int, N: int, fps: float) -> np.ndarray:
    """(N, LEAK_H, LEAK_W, 3) warm light leaks: 2-3 soft, vertically stretched blobs with a hot core
    that sit on one edge and drift in, breathing; plus an edge wash. Screen-blended (black = none)."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:LEAK_H, 0:LEAK_W].astype(np.float32)
    X, Y = (xx + 0.5) / LEAK_W, (yy + 0.5) / LEAK_W            # units of frame width (Y: 0..1.78)
    side = rng.choice([-1, 1])
    blobs = []
    for b in range(int(rng.integers(2, 4))):
        s = side if b < 2 or rng.random() < 0.5 else -side
        cx = 0.5 + s * rng.uniform(0.38, 0.62)
        cy = rng.uniform(0.15, 1.6) if b else rng.uniform(0.3, 1.2)
        vx = -s * rng.uniform(0.05, 0.16)                    # drifts inwards (frame widths / s)
        vy = rng.uniform(-0.15, 0.15)
        rx = rng.uniform(0.2, 0.36)
        ry = rx * rng.uniform(1.5, 2.6)
        col = np.array(LEAK_COLORS[int(rng.integers(0, len(LEAK_COLORS)))] if b else LEAK_COLORS[0],
                       np.float32) / 255
        inten = rng.uniform(0.8, 1.1) * (1.0 if b == 0 else 0.7)
        blobs.append((cx, cy, vx, vy, rx, ry, col, inten, rng.uniform(0.25, 0.7), rng.uniform(0, 6.3)))
    wash_col = np.array(LEAK_COLORS[1], np.float32) / 255
    wash = (np.clip(1 - (X if side < 0 else 1 - X) / 0.5, 0, 1) ** 1.6)[..., None] * wash_col
    hot = np.array([1.0, 0.86, 0.62], np.float32)
    out = np.zeros((N, LEAK_H, LEAK_W, 3), np.float32)
    for n in range(N):
        t = n / fps
        acc = 0.45 * wash * (0.8 + 0.2 * math.sin(1.7 * t))
        for i, (cx, cy, vx, vy, rx, ry, col, inten, fq, ph) in enumerate(blobs):
            px = cx + vx * t                     # keep leaks on the edges, off the subject's face
            px = 0.5 + math.copysign(max(abs(px - 0.5), 0.3), cx - 0.5)
            e = np.exp(-(((X - px) / rx) ** 2) - (((Y - cy - vy * t) / ry) ** 2))
            amp = inten * (0.72 + 0.28 * math.sin(2 * math.pi * fq * t + ph))
            acc = acc + (amp * e)[..., None] * col
            if i == 0:                                   # film-burn core
                acc = acc + (0.4 * amp * e ** 3)[..., None] * hot
        acc = acc * (1 + 0.06 * rng.standard_normal())
        out[n] = 255 * (1 - np.exp(-1.5 * acc))
    return np.clip(out, 0, 255).astype(np.uint8)


def xerox_dust(seed: int, W: int, H: int, k: float) -> Image.Image:
    """static photocopy dirt for one shot: toner specks, white dropouts, a drum streak or two,
    a dark copier edge and faint paper texture (RGBA, composited over the copy)."""
    rng = np.random.default_rng(seed)
    img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(img)
    for _ in range(int(320 * W * H / (1080 * 1920) + 60)):                   # toner specks
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        r = max(0.6, rng.gamma(1.6, 0.9) * k * 1.6)
        d.ellipse((x - r, y - r * rng.uniform(0.6, 1.0), x + r, y + r), fill=int(rng.uniform(140, 255)))
    a = np.asarray(img, np.float32) / 255
    wimg = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(wimg)
    for _ in range(int(140 * W * H / (1080 * 1920) + 20)):                   # toner dropouts
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        r = max(0.6, rng.gamma(1.4, 0.8) * k * 1.5)
        d.ellipse((x - r, y - r, x + r, y + r), fill=int(rng.uniform(120, 230)))
    white = np.asarray(wimg, np.float32) / 255
    xs = np.arange(W, dtype=np.float32)
    for _ in range(int(rng.integers(1, 3))):                                 # drum streaks
        x0, wd = rng.uniform(0.08, 0.92) * W, max(1.0, rng.uniform(1.5, 4.5) * k)
        prof = np.exp(-(((xs - x0) / wd) ** 2)) * rng.uniform(0.12, 0.3)
        a = np.maximum(a, prof[None, :] * (0.7 + 0.3 * rng.random((H, 1)).astype(np.float32)))
    edge = np.zeros(W, np.float32)
    ew = 0.035 * W
    if rng.random() < 0.7:
        edge = np.maximum(edge, np.clip(1 - xs / ew, 0, 1) ** 1.5 * rng.uniform(0.35, 0.7))
    if rng.random() < 0.7:
        edge = np.maximum(edge, np.clip(1 - (W - 1 - xs) / ew, 0, 1) ** 1.5 * rng.uniform(0.35, 0.7))
    a = np.maximum(a, edge[None, :])
    small = rng.normal(0, 1, (H // 4 + 1, W // 4 + 1)).astype(np.float32)        # paper texture
    tex = np.asarray(Image.fromarray(((small * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8))
                     .resize((W, H), Image.BILINEAR), np.float32) / 255
    a = np.maximum(a, (tex - 0.5).clip(0, None) * 0.12)
    rgb = np.where(white[..., None] > a[..., None], 238.0, 18.0) * np.ones((1, 1, 3), np.float32)
    alpha = np.maximum(a, white * 0.85)
    out = np.concatenate([rgb, alpha[..., None] * 255], axis=2)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")


def scanlines(W: int, H: int, strength: float = 0.16) -> Image.Image:
    """faint horizontal tape lines (MAP_LINES per frame height), soft so they don't alias"""
    ph = ((np.arange(H, dtype=np.float32) + 0.5) * MAP_LINES / H) % 1.0
    a = strength * (0.5 - 0.5 * np.cos(2 * np.pi * ph))
    arr = np.zeros((H, W, 4), np.uint8)
    arr[..., 3] = (a * 255).astype(np.uint8)[:, None]
    return Image.fromarray(arr, "RGBA")


def osd_text(d: ImageDraw.ImageDraw, xy, text, fnt, anchor="la", fill=(255, 255, 255, 255)):
    d.text(xy, text, font=fnt, fill=fill, anchor=anchor)


def osd_glow(layer: Image.Image, k: float) -> Image.Image:
    """camcorder OSD finish: soft dark halo (legible on white) + slight white bloom + crisp glyphs"""
    a = layer.getchannel("A")
    halo = Image.new("RGBA", layer.size, (0, 0, 0, 0))     # dark rim: legible on paper-white too
    rim = a.filter(ImageFilter.MaxFilter(odd(5 * k, 3, 9))).filter(ImageFilter.GaussianBlur(max(1.0, 2.2 * k)))
    halo.putalpha(rim.point(lambda v: int(v * 0.62)))
    bloom = Image.new("RGBA", layer.size, (255, 255, 255, 0))
    bloom.putalpha(a.filter(ImageFilter.GaussianBlur(max(1.0, 7 * k))).point(lambda v: int(v * 0.35)))
    out = Image.alpha_composite(halo, bloom)
    return Image.alpha_composite(out, layer)


def rec_hud(S: Settings, edl: EDL, f0: int, N: int, tmp: Path):
    """camcorder HUD inside the safe zone. -> (top strip PNG pattern, its y, bottom PNG, its y).
    Top strip (one PNG per frame): blinking red dot + REC at the left, battery + running timecode
    HH:MM:SS:FF of the edit time at the right. Bottom: meta.rec_date, at the left."""
    W, k, fps = S.W, S.k, S.fps
    path = _first_existing(SYSTEM_OSD) or S.fonts.body
    fnt = font(path, 58 * k)
    fsm = font(path, 50 * k)
    left = max(edl.safe.get("left", 60) * k, 48 * k)
    right = W - S.safe_right - 10 * k
    sh = int(round(110 * k))
    y_top = int(round(S.safe_top - 12 * k))
    cy = sh / 2
    ifps = max(1, int(round(fps)))
    blink = max(1, int(round(0.6 * fps)))
    static = Image.new("RGBA", (W, sh), (0, 0, 0, 0))
    d = ImageDraw.Draw(static)
    r = 16 * k
    rec_x = left + 2 * r + 16 * k
    osd_text(d, (rec_x, cy), "REC", fnt, anchor="lm")
    bw_, bh_ = 64 * k, 32 * k                                             # battery
    bx1 = right
    bx0 = bx1 - bw_
    tc_w = fsm.getlength("00:00:00:00")
    bx0 -= tc_w + 26 * k
    bx1 = bx0 + bw_
    lw = max(2, int(round(3 * k)))
    d.rectangle((bx0, cy - bh_ / 2, bx1, cy + bh_ / 2), outline=(255, 255, 255, 255), width=lw)
    d.rectangle((bx1, cy - bh_ / 5, bx1 + 5 * k, cy + bh_ / 5), fill=(255, 255, 255, 255))
    cell = (bw_ - 2 * lw - 4 * 3 * k) / 3
    for c in range(2):                                                    # 2 of 3 bars left
        x0 = bx0 + lw + 3 * k + c * (cell + 3 * k)
        d.rectangle((x0, cy - bh_ / 2 + lw + 3 * k, x0 + cell, cy + bh_ / 2 - lw - 3 * k),
                    fill=(255, 255, 255, 255))
    tc_x = right
    pattern = tmp / "hud_%05d.png"
    for n in range(N):
        g = f0 + n
        lay = static.copy()
        dd = ImageDraw.Draw(lay)
        if (g % ifps) < blink:
            dd.ellipse((left, cy - r, left + 2 * r, cy + r), fill=(235, 22, 22, 255))
        s_ = g // ifps
        tc_ = f"{s_ // 3600:02d}:{s_ // 60 % 60:02d}:{s_ % 60:02d}:{g % ifps:02d}"
        osd_text(dd, (tc_x, cy), tc_, fsm, anchor="rm")
        osd_glow(lay, k).save(tmp / f"hud_{n:05d}.png", compress_level=1)
    date = str(edl.meta.get("rec_date") or DEFAULT_REC_DATE).upper()
    bot = Image.new("RGBA", (W, sh), (0, 0, 0, 0))
    osd_text(ImageDraw.Draw(bot), (left, cy), date, fsm, anchor="lm")
    bpath = tmp / "hud_bottom.png"
    osd_glow(bot, k).save(bpath, compress_level=1)
    # date centred 26 px above the safe-zone floor: below any "lower" caption (those end 3 % of H higher)
    y_bot = int(round(S.H - S.safe_bottom - 26 * k - sh / 2))
    return pattern, y_top, bpath, y_bot


@dataclass
class Job:
    shot: Shot
    key: str
    seg: Path
    placeholder: bool
    missing: bool


def shot_key(shot: Shot, S: Settings, edl: EDL, placeholder: bool) -> str:
    clip_sig = None
    if not placeholder:
        clip_sig = []
        for v in shot.views():
            if v.clip is not None and v.clip_exists:
                st = v.clip.stat()
                clip_sig.append([str(v.clip.resolve()), st.st_mtime_ns, st.st_size])
    material = {"engine": ENGINE_VERSION, "src": SOURCE_HASH, "shot": shot.raw, "f0": shot.f0,
                "N": shot.N, "grade": shot.grade, "placeholder": placeholder, "clip": clip_sig,
                "texts": [t.__dict__ for t in shot.texts], "settings": S.key(),
                "rec_date": edl.meta.get("rec_date"), "fps": edl.fps}
    return hashlib.sha256(json.dumps(material, sort_keys=True, default=str).encode()).hexdigest()[:20]


class Graph:
    """filtergraph under construction: ffmpeg inputs + statements + unique labels"""

    def __init__(self, S: Settings, N: int, tmp: Path):
        self.S, self.N, self.tmp = S, N, tmp
        self.inputs, self.stm = [], []
        self.n_in = self.n_lab = 0
        _fr = Fraction(S.fps).limit_denominator(1001)
        self.tb = f"{_fr.denominator}/{_fr.numerator}"          # exact 1/fps timebase
        self.FPS = num(S.fps)

    def input(self, args) -> int:
        self.inputs.extend(str(a) for a in args)
        self.n_in += 1
        return self.n_in - 1

    def lab(self, base="v") -> str:
        self.n_lab += 1
        return f"{base}{self.n_lab}"

    def add(self, s: str):
        self.stm.append(s)

    def chain(self, cur: str, filters, base="v") -> str:
        filters = [f_ for f_ in filters if f_]
        if not filters:
            return cur
        out = self.lab(base)
        self.add(f"[{cur}]" + ",".join(filters) + f"[{out}]")
        return out

    def still(self, path, main=False) -> str:
        """decode a PNG once and loop it in-graph at the output rate"""
        i = self.input(["-i", path])
        return (f"[{i}:v]loop=loop=-1:size=1:start=0,settb={self.tb},setpts=N"
                + (f",trim=end_frame={self.N}" if main else ""))

    def seq(self, pattern, start_frame: int = 0) -> str:
        """PNG sequence (frame 0 shows at shot frame `start_frame`)"""
        i = self.input(["-framerate", self.FPS, "-start_number", "0", "-i", pattern])
        return f"[{i}:v]settb={self.tb},setpts=N+{start_frame}"

    def raw(self, path, pix_fmt: str, w: int, h: int) -> str:
        i = self.input(["-f", "rawvideo", "-pix_fmt", pix_fmt, "-s", f"{w}x{h}", "-framerate", self.FPS,
                        "-i", path])
        return f"[{i}:v]settb={self.tb},setpts=N"


def view_geometry(g: Graph, v: View, N: int, vw: int, vh: int, S: Settings, geom: set) -> str:
    """decode + time (speed/ramp/delay, freeze/reverse/stutter/step) + fit/crop + zoom/pulse/shake/whip
    for one view -> label of a vw x vh stream (exactly N frames)"""
    fps, k = S.fps, S.k
    FPS = num(fps)
    v_info = v.clip_info or probe_media(v.clip)["video"]
    seq, M = time_map(v, N, fps)
    D = N / fps
    still_img = is_image(v.clip)
    rf = v.ramp["from"] if v.ramp else v.speed
    lag = v.delay * rf
    start = 0.0 if still_img else v.inp - lag
    ss = max(0.0, start)
    pre_s = ss - start                                    # head not in the source: padded by fps
    src_end = lag + src_time(v, max(M / fps - v.delay, 0.0), D)
    dur = max(src_end - pre_s, 1.0 / fps) + 0.5
    if still_img:
        i = g.input(["-loop", "1", "-framerate", FPS, "-t", f"{dur:.6f}", "-i", v.clip])
    else:
        i = g.input(["-ss", f"{ss:.6f}", "-t", f"{dur:.6f}", "-an", "-sn", "-dn", "-i", v.clip])
    pre = []
    if v_info["field_order"] in ("tt", "bb", "tb", "bt"):
        pre.append("bwdif=mode=send_field:parity=auto:deint=all")
    Wd, Hd = v_info["w"], v_info["h"]
    if abs(v_info["sar"] - 1.0) > 0.01:
        pre.append("scale=trunc(iw*sar/2)*2:ih,setsar=1")
        Wd = int(v_info["w"] * v_info["sar"]) // 2 * 2
    T = f"((PTS-STARTPTS)*TB+{num(pre_s)})"
    if v.ramp:
        rt, d1 = v.ramp["to"], v.ramp["at"] * D
        s1 = lag + d1 * rf
        pts = f"setpts='if(lt({T},{num(s1)}),{T}/{num(rf)},{num(v.delay + d1)}+({T}-{num(s1)})/{num(rt)})/TB'"
    elif abs(v.speed - 1.0) > 1e-9 or pre_s > 0:
        pts = f"setpts='{T}/{num(v.speed)}/TB'"
    else:
        pts = "setpts=PTS-STARTPTS"
    timing = [pts, f"fps={FPS}:start_time=0", "tpad=stop=-1:stop_mode=clone", f"trim=end_frame={M}"]
    if seq is not None:
        timing += ["shuffleframes=" + " ".join(str(x) for x in seq + [-1] * (M - N)),
                   f"settb={g.tb}", "setpts=N"]
    A = vw / vh
    pz = pulse_mul(v.pulse, fps, 0.0, "ld(0)")
    zmin = min(v.z0, v.z1)
    animated = abs(v.z1 - v.z0) > 1e-6 or v.pulse is not None
    shake = "shake_hard" if "shake_hard" in geom else "shake" if "shake" in geom else None
    whip = [f_ for f_ in ("whip_in", "whip_out") if f_ in geom]
    if v.fit == "crop":
        bw = Hd * A if Wd / Hd > A else Wd
        bh = Hd if Wd / Hd > A else Wd / A
        xm, ym, wm, hm = int_window(*window(zmin, Wd, Hd, bw, bh, v.focus_x, v.focus_y), Wd, Hd)
        chain = list(pre)
        if (xm, ym, wm, hm) != (0, 0, Wd, Hd):
            chain.append(f"crop={wm}:{hm}:{xm}:{ym}")
        chain += timing + [f"scale={vw}:{vh}:flags={S.scale_flags}", "setsar=1"]
        if vw / wm > 1.3 and not S.preview:          # upscaled footage: lanczos + a light unsharp
            chain.append("unsharp=5:5:0.45:5:5:0")
        src, crop = (Wd, Hd, bw, bh), (xm, ym, wm, hm)
        head = f"[{i}:v]"
    else:   # blurfill
        if Wd / Hd >= A:
            fw, fh = vw, max(2, even(vw * Hd / Wd))
        else:
            fw, fh = max(2, even(vh * Wd / Hd)), vh
        bgw, bgh = max(2, even(vw / 4)), max(2, even(vh / 4))
        if Wd / Hd > bgw / bgh:
            cw, ch = even(bgh * Wd / Hd), bgh
        else:
            cw, ch = bgw, even(bgw * Hd / Wd)
        cx = int(clamp(v.focus_x * cw - bgw / 2, 0, cw - bgw))
        cy = int(clamp(v.focus_y * ch - bgh / 2, 0, ch - bgh))
        sig = num(max(2.0, 10 * k))
        fg0, bg0, bg1, fg1, comp = g.lab("fg"), g.lab("bg"), g.lab("bg"), g.lab("fg"), g.lab("comp")
        g.add(f"[{i}:v]" + ",".join(pre + timing) + f",split=2[{fg0}][{bg0}]")
        g.add(f"[{bg0}]scale={cw}:{ch}:flags=bilinear,crop={bgw}:{bgh}:{cx}:{cy},gblur=sigma={sig},"
              f"eq=brightness=-0.10:saturation=1.15,scale={vw}:{vh}:flags=bicubic,setsar=1[{bg1}]")
        sharpen = ",unsharp=5:5:0.45:5:5:0" if fw / Wd > 1.3 and not S.preview else ""
        g.add(f"[{fg0}]scale={fw}:{fh}:flags={S.scale_flags},setsar=1{sharpen}[{fg1}]")
        g.add(f"[{bg1}][{fg1}]overlay=x={(vw - fw) // 2}:y={(vh - fh) // 2}[{comp}]")
        xm, ym, wm, hm = int_window(*window(zmin, vw, vh, vw, vh, v.focus_x, v.focus_y), vw, vh)
        chain = []
        if zmin > 1.0 + 1e-6:
            chain += [f"crop={wm}:{hm}:{xm}:{ym}", f"scale={vw}:{vh}:flags={S.scale_flags}", "setsar=1"]
        src, crop = (vw, vh, vw, vh), (xm, ym, wm, hm)
        head = f"[{comp}]"
    if animated:
        z0, z1 = v.z0, v.z1
        zf = (lambda p, n, z0=z0, z1=z1, e=v.ease: f"({num(z0)}+{num(z1 - z0)}*{ease_expr(p, e)})*{pz}")
        chain.append(perspective_filter(S, N, src, crop, zf, v.focus_x, v.focus_y, shake, whip=whip,
                                        size=(vw, vh)))
    elif shake or whip:
        zf = (lambda p, n, z=zmin: num(z))
        chain.append(perspective_filter(S, N, src, crop, zf, v.focus_x, v.focus_y, shake, whip=whip,
                                        size=(vw, vh), enable=geom_window(shake, whip, N, fps)))
    out = g.lab("geo")
    g.add(head + (",".join(chain) if chain else "null") + f"[{out}]")
    return out


def geom_window(shake, whip, N: int, fps: float) -> str | None:
    """timeline enable (in t) covering the frames a camera move touches. Only for moves that start
    on frame 0: perspective's frame counter (`in`) does not advance while it is disabled, so a
    whip_out at the end needs the filter on for the whole shot (None)."""
    if "whip_out" in whip:
        return None
    parts = []
    if shake:
        parts.append(f"lt(t,{num((int(round(SHAKES[shake][0] * fps)) + 0.5) / fps)})")
    if "whip_in" in whip:
        parts.append(f"lt(t,{num((WHIP_FRAMES - 0.5) / fps)})")
    return "+".join(parts) if parts else None


def frames_enable(frames, fps: float) -> str:
    """enable expression true exactly on the given local frame numbers"""
    return "+".join(f"between(t,{num((n - 0.5) / fps)},{num((n + 0.5) / fps)})" for n in frames) or "0"


def zoom_persp(S: Settings, w: int, h: int, zexpr: str) -> str:
    """centre zoom by zexpr (expression of n = frame index) via perspective"""
    P = f"st(0,in-1);st(1,{zexpr});st(2,{num(w / 2)}/ld(1));st(3,{num(h / 2)}/ld(1))"
    cx, cy = num(w / 2), num(h / 2)
    xs = [f"{cx}-ld(2)", f"{cx}+ld(2)", f"{cx}-ld(2)", f"{cx}+ld(2)"]
    ys = [f"{cy}-ld(3)", f"{cy}-ld(3)", f"{cy}+ld(3)", f"{cy}+ld(3)"]
    return "perspective=" + ":".join(f"x{i}='{P};{xs[i]}':y{i}='{P};{ys[i]}'" for i in range(4)) + \
        f":interpolation={S.interp}:eval=frame"


def apply_looks(g: Graph, cur: str, fx: set, cfg: dict, grade_name: str, w: int, h: int, seed: int,
                S: Settings, N: int, tmp: Path, tag: str, hud=None, yuv_in=True) -> str:
    """grade + per-pixel looks (gbrp out). Order: camera blurs, grade, bw, echo, xerox / posterize, glow,
    light leaks, rgb split, vignette, invert, glitch, VHS picture, REC HUD, VHS tape wear, strobe /
    invert flash, letterbox."""
    fps, k = S.fps, S.k
    grade = GRADES.get(grade_name, {})
    post = []
    if grade.get("eq"):
        if not yuv_in:
            post.append("format=yuv444p")
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
    cur = g.chain(cur, post, "g")

    # camera blurs on the opening / closing frames
    if "zoom_blur" in fx and N > 1:                 # radial punch: progressively scaled copies, 4 frames
        nz = min(4, N)
        a, b = g.lab("zb"), g.lab("zb")
        g.add(f"[{cur}]split=2[{a}][{b}]")
        copies = [0.0, 0.035, 0.07, 0.105, 0.14, 0.18]
        labs = [g.lab("zc") for _ in copies]
        g.add(f"[{b}]trim=end_frame={nz},split={len(copies)}" + "".join(f"[{x}]" for x in labs))
        outs = []
        for s_, l_ in zip(copies, labs):
            if s_ == 0:
                outs.append(l_)
                continue
            o = g.lab("zp")
            g.add(f"[{l_}]" + zoom_persp(S, w, h, f"1+{s_}*pow(max(0,1-ld(0)/{nz}),1.3)") + f"[{o}]")
            outs.append(o)
        m = g.lab("zm")
        g.add("".join(f"[{x}]" for x in outs) + f"mix=inputs={len(outs)}:weights='3 2 2 1.6 1.3 1',"
              f"gblur=sigma={num(max(0.8, 1.5 * k))}[{m}]")
        cur2 = g.lab("g")
        g.add(f"[{a}][{m}]overlay=0:0:format=gbrp:eof_action=pass[{cur2}]")
        cur = cur2
    whip_blur = []
    if "whip_in" in fx:
        for n in range(min(WHIP_FRAMES, N)):
            sig = 0.42 * w * ((WHIP_FRAMES - n) / WHIP_FRAMES) ** 2 * 0.11 + 1
            whip_blur.append(f"gblur=sigma={num(sig)}:sigmaV=0:enable='{frames_enable([n], fps)}'")
    if "whip_out" in fx:
        s0 = max(N - WHIP_FRAMES, 0)
        for n in range(s0, N):
            sig = 0.42 * w * ((n - s0 + 1) / WHIP_FRAMES) ** 2 * 0.11 + 1
            whip_blur.append(f"gblur=sigma={num(sig)}:sigmaV=0:enable='{frames_enable([n], fps)}'")
    cur = g.chain(cur, whip_blur, "g")

    if "echo" in fx:                                 # ghost trails: decaying frame echoes + soft bloom
        cur = g.chain(cur, ["tmix=frames=7:weights='10 6 4.2 3 2.2 1.6 1.2'"], "g")
    if "xerox" in fx:
        cur = xerox_chain(g, cur, w, h, seed, S, tmp, tag)
    if "posterize" in fx:
        L = int((cfg.get("posterize") or FX_CFG["posterize"])["levels"])
        e = f"'min(255,floor(val*{L}/256)*255/{L - 1})'"
        cur = g.chain(cur, [f"gblur=sigma={num(max(0.8, 2.2 * k))}", "format=yuv444p",
                            "eq=saturation=1.45:contrast=1.12", "format=gbrp",
                            f"lutrgb=r={e}:g={e}:b={e}"], "g")
    if "glow" in fx:
        gs = num(max(2.0, 7 * k))
        a, b, c, o = g.lab("ga"), g.lab("gb"), g.lab("gc"), g.lab("g")
        g.add(f"[{cur}]split=2[{a}][{b}]")
        g.add(f"[{b}]scale={even(w / 4)}:{even(h / 4)}:flags=bilinear,curves=all='0/0 0.55/0.08 1/1',"
              f"gblur=sigma={gs},scale={w}:{h}:flags=bilinear[{c}]")
        g.add(f"[{a}][{c}]blend=all_mode=screen:all_opacity=0.65[{o}]")
        cur = o
    if "light_leak" in fx:
        lp = tmp / f"leak_{tag}.raw"
        arr = leak_frames(seed_of(seed, "leak"), N, fps)
        lp.write_bytes(arr.tobytes())
        lk, o = g.lab("lk"), g.lab("g")
        g.add(g.raw(lp, "rgb24", LEAK_W, LEAK_H) + f",scale={w}:{h}:flags=bicubic,format=gbrp[{lk}]")
        g.add(f"[{cur}][{lk}]blend=all_mode=screen:shortest=0:repeatlast=1[{o}]")
        cur = o
    look = []
    if "rgb_split" in fx:
        s_ = max(1, int(round(9 * k)))
        v_ = max(1, int(round(2 * k)))
        look.append(f"rgbashift=rh=-{s_}:rv=-{v_}:bh={s_}:bv={v_}")
    if "vignette" in fx:
        look.append("vignette=angle=PI/5.2")
    if "invert" in fx:
        look.append("negate")
    cur = g.chain(cur, look, "g")
    if "glitch" in fx:
        cur = glitch_chain(g, cur, w, h, seed, cfg.get("glitch") or FX_CFG["glitch"], S, N, tmp, tag)
    if "vhs" in fx:
        cur = vhs_color(g, cur, k)
    if hud is not None:                 # REC HUD: over the tape picture, under the tape transport wear
        pattern, y_top, bpath, y_bot = hud
        a, b, o1, o2 = g.lab("hud"), g.lab("hud"), g.lab("g"), g.lab("g")
        g.add(g.seq(pattern, 0) + f",format=rgba[{a}]")
        g.add(g.still(bpath) + f",format=rgba[{b}]")
        g.add(f"[{cur}][{a}]overlay=0:{y_top}:format=gbrp:eof_action=pass[{o1}]")
        g.add(f"[{o1}][{b}]overlay=0:{y_bot}:format=gbrp[{o2}]")
        cur = o2
    if "vhs" in fx:
        cur = vhs_tape(g, cur, w, h, seed, S, N, tmp, tag)
    late = []
    if "strobe" in fx:
        c = cfg.get("strobe") or FX_CFG["strobe"]
        ev = int(c["every"])
        hits = [n for n in range(N) if n % ev == ev - 1]
        if hits:
            en = frames_enable(hits, fps) if len(hits) < 40 else f"eq(mod(n,{ev}),{ev - 1})"
            if c["mode"] == "invert":
                late.append(f"negate=enable='{en}'")
            else:
                vv = 0 if c["mode"] == "black" else 255
                late.append(f"lutrgb=r={vv}:g={vv}:b={vv}:enable='{en}'")
    if "invert_flash" in fx:
        late.append(f"negate=enable='lt(t,{num(1.5 / fps)})'")
    if "letterbox" in fx:            # matte bars, kept black over strobe/invert: 55 % -> 107 % -> 100 %
        bh_ = 0.14 * h
        for n, fr_ in ((0, 0.55), (1, 1.07)):
            if n < N:
                hh = int(round(bh_ * fr_))
                en = frames_enable([n], fps)
                late += [f"drawbox=x=0:y=0:w={w}:h={hh}:c=black:t=fill:enable='{en}'",
                         f"drawbox=x=0:y={h - hh}:w={w}:h={hh}:c=black:t=fill:enable='{en}'"]
        hh = int(round(bh_))
        late += [f"drawbox=x=0:y=0:w={w}:h={hh}:c=black:t=fill:enable='gte(t,{num(1.5 / fps)})'",
                 f"drawbox=x=0:y={h - hh}:w={w}:h={hh}:c=black:t=fill:enable='gte(t,{num(1.5 / fps)})'"]
    return g.chain(cur, late, "g")


def xerox_chain(g: Graph, cur: str, w: int, h: int, seed: int, S: Settings, tmp: Path, tag: str) -> str:
    """photocopy: normalised grey with local contrast (so faces survive), toner-dithered hard threshold,
    soft ink edges, off-white paper + per-shot dirt. The threshold stage runs at a fixed working size
    (540 wide), so toner grain has the same scale in preview and full renders."""
    k = S.k
    lo, hi = 88, 148
    ws = min(1.0, 540 / w)
    xw, xh = max(2, even(w * ws)), max(2, even(h * ws))
    kw = k * ws                                   # px scale of the working size
    # mono stage in yuv444p with chroma pinned to 128 (noise has no gray support, and an auto-inserted
    # gray->gbrp conversion would put the toner noise on one colour plane)
    a, b, bb, o = g.lab("xa"), g.lab("xb"), g.lab("xb"), g.lab("x")
    g.add(f"[{cur}]" + (f"scale={xw}:{xh}:flags=area," if ws < 1 else "")
          + "normalize=blackpt=black:whitept=white:smoothing=6:independence=0:strength=0.85,"
          f"format=gray,format=yuv444p,lutyuv=y='pow(val/255,0.8)*255':u=128:v=128,split=2[{a}][{b}]")
    g.add(f"[{b}]gblur=sigma={num(max(8.0, 48 * kw))}:planes=1[{bb}]")
    chain = ["mix=inputs=2:weights='2.5 -1.5':scale=1",               # unsharp mask = local contrast
             f"gblur=sigma={num(max(0.6, 1.3 * kw))}:planes=1",
             "noise=c0s=34:c0f=t+u", f"lutyuv=y='clip((val-{lo})*255/{hi - lo},0,255)':u=128:v=128"]
    if ws < 1:
        chain.append(f"scale={w}:{h}:flags=bicubic")
    chain += [f"gblur=sigma={num(max(0.5, 0.9 * k))}:planes=1", "lutyuv=y='clip((val-40)*255/175,0,255)'",
              "format=gbrp",
              "colorlevels=romin=0.075:gomin=0.07:bomin=0.07:romax=0.95:gomax=0.93:bomax=0.865"]
    g.add(f"[{a}][{bb}]" + ",".join(chain) + f"[{o}]")
    dp = tmp / f"xerox_{tag}.png"
    xerox_dust(seed_of(seed, "xerox"), w, h, k).save(dp, compress_level=1)
    d, o2 = g.lab("xd"), g.lab("x")
    g.add(g.still(dp) + f",format=rgba[{d}]")
    g.add(f"[{o}][{d}]overlay=0:0:format=gbrp[{o2}]")
    return o2


def glitch_chain(g: Graph, cur: str, w: int, h: int, seed: int, cfg: dict, S: Settings, N: int,
                 tmp: Path, tag: str) -> str:
    sched = glitch_schedule(seed_of(seed, "glitch"), N, cfg)
    last = max([n for n, (_, gg) in enumerate(sched) if gg > 0] or [-1])
    if last < 0:
        return cur
    nf = last + 1
    frames, cache = [], {}
    for n in range(nf):
        sid, gg = sched[n]
        key = (sid, round(gg, 4))
        if key not in cache:
            cache[key] = glitch_map(seed_of(seed, "gmap", sid), gg, S.k)
        frames.append(cache[key])
    mp = tmp / f"glitch_{tag}.raw"
    mp.write_bytes(gbrp_bytes(np.stack(frames)))
    xm, ym, o = g.lab("gx"), g.lab("gy"), g.lab("g")
    g.add(g.raw(mp, "gbrp", GLITCH_COLS, GLITCH_ROWS) + f",scale={w}:{h}:flags=neighbor[{xm}]")
    g.add(f"color=c=0x808080:s={w}x{h}:r={g.FPS},format=gbrp,trim=end_frame=1[{ym}]")
    en = "" if cfg.get("whole") else f":enable='lt(t,{num((nf - 0.5) / S.fps)})'"
    g.add(f"[{cur}][{xm}][{ym}]displace=edge=wrap{en}[{o}]")
    return o


def vhs_color(g: Graph, cur: str, k: float) -> str:
    """camcorder tape, picture part: chroma offset + horizontal chroma smear, soft luma with a little
    edge ringing, lifted blacks, warm-magenta cast at 0.85 saturation, luma/chroma noise"""
    cs = max(1, int(round(8 * k)))
    return g.chain(cur, [
        "format=yuv444p", f"chromashift=cbh={cs}:crh=-{max(1, int(round(5 * k)))}:edge=smear",
        f"gblur=sigma={num(max(2.5, 14 * k))}:sigmaV={num(max(0.3, 0.7 * k))}:planes=6",
        f"gblur=sigma={num(max(0.7, 2.0 * k))}:sigmaV={num(max(0.3, 0.6 * k))}:planes=1",
        "unsharp=7:3:0.8:3:3:0",
        "eq=saturation=0.85:contrast=0.92:brightness=0.02",
        "noise=c0s=10:c0f=t:c1s=6:c1f=t:c2s=6:c2f=t",
        "format=gbrp",
        "colorbalance=rs=0.05:gs=-0.025:bs=0.045:rm=0.07:gm=-0.04:bm=0.025:rh=0.03:gh=0.0:bh=-0.03",
        "curves=all='0/0.06 0.5/0.52 1/0.93'"], "vh")


def vhs_tape(g: Graph, cur: str, w: int, h: int, seed: int, S: Settings, N: int, tmp: Path, tag: str) -> str:
    """camcorder tape, transport part: line wobble, head-switching skew, dropouts, rolling tracking
    band (seeded per shot / panel) and scanlines"""
    xmap, noise = vhs_maps(seed_of(seed, "vhs"), N, S.k)
    mp, np_ = tmp / f"vhsmap_{tag}.raw", tmp / f"vhsnoise_{tag}.raw"
    mp.write_bytes(gbrp_bytes(xmap))
    np_.write_bytes(noise.tobytes())
    xm, ym, o = g.lab("vx"), g.lab("vy"), g.lab("vh")
    g.add(g.raw(mp, "gbrp", 2, MAP_LINES) + f",scale={w}:{h}:flags=neighbor[{xm}]")
    g.add(f"color=c=0x808080:s={w}x{h}:r={g.FPS},format=gbrp,trim=end_frame=1[{ym}]")
    g.add(f"[{cur}][{xm}][{ym}]displace=edge=smear[{o}]")
    nz, o2 = g.lab("vn"), g.lab("vh")
    g.add(g.raw(np_, "rgba", NOISE_W, NOISE_H) + f",scale={w}:{h}:flags=bilinear[{nz}]")
    g.add(f"[{o}][{nz}]overlay=0:0:format=gbrp:eof_action=pass[{o2}]")
    sp = tmp / f"scan_{tag}.png"
    scanlines(w, h, 0.22).save(sp, compress_level=1)
    sl, o3 = g.lab("vs"), g.lab("vh")
    g.add(g.still(sp) + f",format=rgba[{sl}]")
    g.add(f"[{o2}][{sl}]overlay=0:0:format=gbrp[{o3}]")
    return o3


def layout_rects(layout: str, W: int, H: int, gap: int):
    rows, cols = {"split2": (2, 1), "triptych": (3, 1), "grid4": (2, 2)}[layout]
    def cuts(total, n):
        avail = total - gap * (n - 1)
        edges = [int(round(avail * j / n / 2)) * 2 for j in range(n + 1)]
        return [(edges[j] + gap * j, edges[j + 1] - edges[j]) for j in range(n)]
    out = []
    for (y, hh) in cuts(H, rows):
        for (x, ww) in cuts(W, cols):
            out.append((x, y, ww, hh))
    return out


def missing_panel_card(v: View, S: Settings, w: int, h: int, color, tmp: Path, j: int) -> Path:
    img = Image.new("RGB", (w, h), mix(color, (0, 0, 0), 0.45))
    d = ImageDraw.Draw(img)
    f1 = font(S.fonts.body, max(12, 34 * S.k))
    d.text((w / 2, h / 2), f"P{j + 1} · NO CLIP", font=f1, fill=(255, 255, 255), anchor="mm")
    if v.clip_rel:
        d.text((w / 2, h / 2 + 44 * S.k), v.clip_rel, font=font(S.fonts.regular, max(10, 24 * S.k)),
               fill=(255, 255, 255), anchor="mm")
    p = tmp / f"panel{j}.png"
    img.save(p, compress_level=1)
    return p


def build_shot(job: Job, S: Settings, edl: EDL, tmp: Path):
    """returns (ffmpeg input args, filtergraph text, output label)"""
    shot, N, fps = job.shot, job.shot.N, S.fps
    W, H, k = S.W, S.H, S.k
    g = Graph(S, N, tmp)
    fx = set(shot.fx)

    caps = []                 # captions first: placeholder cards lay out around them
    for ti, item in enumerate(shot.texts):
        if item.style in ANIMATED_STYLES:
            fn = typewriter_frames if item.style == "typewriter" else glitchtext_frames
            frames, iw, ih, pad = fn(item, S, fps)
            done = {}
            for q, j in enumerate(range(item.a, item.b)):
                p = tmp / f"text{ti}_{q:05d}.png"
                img = frames[j]
                if id(img) in done:
                    try:
                        os.link(done[id(img)], p)
                    except OSError:
                        shutil.copyfile(done[id(img)], p)
                else:
                    img.save(p, compress_level=1)
                    done[id(img)] = p
            p = tmp / f"text{ti}_%05d.png"
        else:
            img, iw, ih, pad = render_caption(item, S)
            p = tmp / f"text{ti}.png"
            img.save(p, compress_level=1)
        x, y = place_box(iw, ih, item.pos, S)
        caps.append((item, p, x, y, iw, ih, pad))

    chrome = None
    shot_seed = seed_of(shot.id)
    geom = fx & (GEOM_FX | {"whip_in", "whip_out"})
    hud = rec_hud(S, edl, shot.f0, N, tmp) if "rec" in fx else None
    if job.placeholder:
        card, chrome, bar_h = placeholder_assets(shot, S, edl, tmp, job.missing,
                                                 [(c[2], c[3], c[4], c[5]) for c in caps])
        pz = pulse_mul(shot.pulse, fps, shot.f0 / fps, "ld(0)")
        zf = (lambda p, n: f"(1+0.045*{p})*(1+0.03*exp(-{num(9 / fps)}*{n}))*{pz}")
        shake = "shake_hard" if "shake_hard" in fx else "shake" if "shake" in fx else None
        whip = [f_ for f_ in ("whip_in", "whip_out") if f_ in fx]
        cur = g.lab("geo")
        g.add(f"{g.still(card, main=True)},format=gbrp,"
              + perspective_filter(S, N, (W, H, W, H), (0, 0, W, H), zf, 0.5, 0.5, shake, whip=whip)
              + f"[{cur}]")
        cur = apply_looks(g, cur, fx - set(TIME_FX), shot.cfg, "none", W, H, shot_seed, S, N, tmp, "s",
                          hud=hud, yuv_in=False)
    elif shot.layout:
        gap = int(round(shot.layout_gap * k / 2)) * 2 if shot.layout_gap > 0 else 0
        bgc = "0x%02x%02x%02x" % tuple(shot.layout_bg)
        cur = g.lab("bgl")
        g.add(f"color=c={bgc}:s={W}x{H}:r={g.FPS},format=gbrp,trim=end_frame={N}[{cur}]")
        ph_col = hex_rgb((shot.placeholder or {}).get("color"), None) or (51, 65, 85)
        for j, (v, (x, y, pw, ph)) in enumerate(zip(shot.panels, layout_rects(shot.layout, W, H, gap))):
            if v.usable:
                pg = view_geometry(g, v, N, pw, ph, S, set(v.fx) & (GEOM_FX | {"whip_in", "whip_out"}))
                pl = apply_looks(g, pg, set(v.fx) - set(TIME_FX), v.cfg, v.grade, pw, ph,
                                 v.seed, S, N, tmp, f"p{j}")
            else:
                pl = g.lab("pc")
                g.add(g.still(missing_panel_card(v, S, pw, ph, ph_col, tmp, j), main=True)
                      + f",format=gbrp[{pl}]")
            o = g.lab("lay")
            g.add(f"[{cur}][{pl}]overlay={x}:{y}:format=gbrp[{o}]")
            cur = o
        if geom:                                       # shot-level camera moves shake the whole layout
            shake = "shake_hard" if "shake_hard" in fx else "shake" if "shake" in fx else None
            whip = [f_ for f_ in ("whip_in", "whip_out") if f_ in fx]
            cur = g.chain(cur, [perspective_filter(S, N, (W, H, W, H), (0, 0, W, H), lambda p, n: "1",
                                                   0.5, 0.5, shake, whip=whip,
                                                   enable=geom_window(shake, whip, N, fps))], "geo")
        cur = apply_looks(g, cur, fx - set(TIME_FX), shot.cfg, shot.grade, W, H, shot_seed, S, N, tmp, "s",
                          hud=hud, yuv_in=False)
    else:
        v = shot_view(shot)
        cur = view_geometry(g, v, N, W, H, S, geom)
        cur = apply_looks(g, cur, fx - set(TIME_FX), shot.cfg, shot.grade, W, H, shot_seed, S, N, tmp, "s",
                          hud=hud)

    # --- captions / overlays
    for ti, (item, p, x, y, iw, ih, pad) in enumerate(caps):
        x, y = x - pad, y - pad
        lbl = g.lab("t")
        f4 = 4.0 / fps
        fades = ["format=rgba"]
        animated = item.style in ANIMATED_STYLES
        if item.fade_in and not animated:
            fades.append(f"fade=t=in:st={num((item.a - 1) / fps)}:d={num(f4)}:alpha=1")
        if item.fade_out:
            fades.append(f"fade=t=out:st={num((item.b - 4) / fps)}:d={num(f4)}:alpha=1")
        o = g.lab("o")
        if animated:
            g.add(g.seq(p, item.a) + "," + ",".join(fades) + f"[{lbl}]")
            g.add(f"[{cur}][{lbl}]overlay=x={x}:y={y}:format=gbrp:eof_action=pass[{o}]")
        else:
            g.add(f"{g.still(p)}," + ",".join(fades) + f"[{lbl}]")
            en = f"gte(t,{num((item.a - 0.5) / fps)})*lt(t,{num((item.b - 0.5) / fps)})"
            g.add(f"[{cur}][{lbl}]overlay=x={x}:y={y}:format=gbrp:enable='{en}'[{o}]")
        cur = o

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
    if "flash_black" in fx:
        tail.append(f"fade=t=in:s=0:n={min(3, N)}")
    if "flash_in" in fx:
        tail.append(f"fade=t=in:s=0:n={min(3, N)}:color=white")
    if "flash_red" in fx:
        tail.append(f"fade=t=in:s=0:n={min(4, N)}:color=0x%02x%02x%02x" % INK_RED)
    if "flash_out" in fx:
        n_ = min(3, max(N - 1, 1))
        tail.append(f"fade=t=out:s={max(N - 1 - n_, 0)}:n={n_}:color=white")
    if "dip_white" in fx:
        n_ = min(max(1, int(round(0.25 * fps))), max(N - 1, 1))
        tail.append(f"fade=t=out:s={max(N - 1 - n_, 0)}:n={n_}:color=white")
    cur = g.chain(cur, tail, "y")
    if chrome is not None:
        c1, o1, pb, o2 = g.lab("chr"), g.lab("y"), g.lab("pb"), g.lab("y")
        g.add(f"{g.still(chrome)},format=rgba[{c1}]")
        g.add(f"[{cur}][{c1}]overlay=0:0[{o1}]")
        g.add(f"color=c=white:s={W}x{bar_h}:r={g.FPS}[{pb}]")
        g.add(f"[{o1}][{pb}]overlay=x='-w+w*min(1,(t*{g.FPS}+1)/{N})':y=0:eval=frame[{o2}]")
        cur = o2
    g.add(f"[{cur}]setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[vout]")
    return g.inputs, ";\n".join(g.stm) + "\n", "vout"


def venc_args(S: Settings):
    cap = ["-maxrate", f"{S.max_rate:g}M", "-bufsize", f"{2 * S.max_rate:g}M"] if S.max_rate else []
    return ["-c:v", "libx264", "-preset", S.preset, "-crf", str(S.crf), *cap, "-pix_fmt", "yuv420p",
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


def prune_cache(cache: Path, days: float = 14.0):
    """drop cached segments nobody used for `days` and stale temp dirs (old renders, old engine)"""
    now = time.time()
    for f_ in cache.glob("*.mp4"):
        try:
            if now - f_.stat().st_mtime > days * 86400 or f_.name.endswith(".part.mp4") and \
                    now - f_.stat().st_mtime > 3600:
                f_.unlink()
        except OSError:
            pass
    tmp = cache / "tmp"
    if tmp.is_dir():
        for d in tmp.iterdir():
            try:
                if now - d.stat().st_mtime > 86400:
                    shutil.rmtree(d, ignore_errors=True) if d.is_dir() else d.unlink()
            except OSError:
                pass


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
    subtitle = (f"{len(edl.shots)} shots · {edl.length:.2f}s · {S.W}x{S.H} @ {num(S.fps)} fps"
                f"{' · preview' if S.preview else ''}{' · placeholders only' if S.placeholders_only else ''}"
                f"  — red lines = safe zone")
    d.text((gut, 18), edl.title, font=fh, fill=(255, 255, 255))
    if gut + fh.getlength(edl.title) + 20 + fb.getlength(subtitle) < sheet.width - gut:
        d.text((gut + fh.getlength(edl.title) + 20, 26), subtitle, font=fb, fill=(170, 170, 180))
    else:
        d.text((gut, 46), subtitle, font=fr_, fill=(170, 170, 180))

    def grab(job):
        mid = job.shot.N // 2
        p = subprocess.run(["ffmpeg", "-v", "error", "-i", str(job.seg), "-frames:v", "1",
                            "-vf", f"select=eq(n\\,{mid}),scale={tw}:{th}:flags=area", "-f", "rawvideo",
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

def print_issues(issues, order=None):
    order = order or {}
    key = lambda i: (order.get(i.where, -1 if i.where in ("meta", "edl", "shots") else 10 ** 6), i.where)
    errs = sorted([i for i in issues if i.level == "ERROR"], key=key)
    warns = sorted([i for i in issues if i.level == "WARN"], key=key)
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
        if s.layout:
            miss = [v for v in s.panels if not v.usable]
            status = f"{s.layout}: {len(s.panels) - len(miss)}/{len(s.panels)} panel clips ok" + \
                (" (rest → placeholder panels)" if miss and len(miss) < len(s.panels) else
                 " → placeholder" if miss else "")
        elif s.clip_rel is None:
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
        print(f"  {s.id:<7}{s.start:>8.3f}{s.end:>8.3f}{s.end - s.start:>7.3f}{s.N:>5}  {clip:<34} {status}")
    missing = [s for s in edl.shots if (s.all_missing() if s.layout else s.clip_rel is None or not s.clip_exists)]
    panel_missing = [v for s in edl.shots if s.layout and not s.all_missing() for v in s.panels if not v.usable]
    print()
    if panel_missing:
        print(f"MISSING PANEL CLIPS ({len(panel_missing)}) — these panels render as flat cards:")
        for v in panel_missing:
            print(f"  {v.where:<10}{v.clip_rel or '-'}")
        print()
    if missing:
        print(f"MISSING CLIPS ({len(missing)}) — these render as placeholder cards:")
        w_clip = max(4, min(max(len(s.clip_rel or "-") for s in missing), 34))
        w_title = max(5, min(max(len(str(s.placeholder.get("title") or "")) for s in missing), 34))
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
        print_issues(issues, {sh.id: n for n, sh in enumerate(edl.shots)})
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
    ap.add_argument("--max-rate", type=float, default=12.0,
                    help="full renders: cap the video bitrate in Mbps so the file fits TikTok's in-app "
                         "upload (default 12; 0 = no cap)")
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
        print_issues(issues, {sh.id: n for n, sh in enumerate(edl.shots)})
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
        missing = s.all_missing() if s.layout else (s.clip is None or not s.clip_exists)
        ph = args.placeholders_only or missing
        key = shot_key(s, S, edl, ph)
        jobs.append(Job(shot=s, key=key, seg=cache / f"{s.id}_{key}.mp4", placeholder=ph, missing=missing))

    total_frames = sum(j.shot.N for j in jobs)
    print(f"\nRendering \"{edl.title}\" → {rel(out)}")
    print(f"  {len(jobs)} shot(s), {total_frames} frames ({total_frames / S.fps:.2f}s) at "
          f"{S.W}x{S.H} @ {num(S.fps)} fps, preset {S.preset} crf {S.crf}"
          f"{f', max {S.max_rate:g} Mbps' if S.max_rate else ''}, {args.jobs} job(s)")
    print(f"  fonts: {fonts.describe()}")
    t_start = time.time()
    prune_cache(cache)
    todo = []
    for j in jobs:
        if j.seg.exists() and not args.no_cache and count_frames(j.seg) == j.shot.N:
            os.utime(j.seg)                       # keep recently used segments out of the prune
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
            what = "placeholder card" if j.placeholder else \
                (f"{j.shot.layout} " if j.shot.layout else "") + \
                " ".join(dict.fromkeys(v.clip.name for v in j.shot.views() if v.usable))
            print(f"  [{done:>3}/{len(todo)}] {j.shot.id:<7} {j.shot.N:>4}f  {dt:6.1f}s  {what}", flush=True)
        return dt

    failed = None
    with cf.ThreadPoolExecutor(max(1, args.jobs)) as ex:
        futs = {ex.submit(work, j): j for j in sorted(todo, key=lambda j: -j.shot.N)}
        for f_ in cf.as_completed(futs):
            if f_.cancelled():
                continue
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
        (cache / "tmp").rmdir()
    except OSError:
        pass
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
