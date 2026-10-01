#!/usr/bin/env python3
"""Find every low-res preview shot (clips/v2/P##.mp4) inside a downloaded HQ scenepack.

    python tools/match_clips.py /path/to/scenepack
    python tools/match_clips.py PACK [--previews clips/v2] [--out clips/v2_hq]
                                     [--report out/match_report.md] [--min-score 0.80] [--dry-run]

For each preview it finds the HQ file and the exact HQ frame shown in the preview's
first frame, then writes <out>/P##.mp4: HQ footage from that frame for the preview's
duration + 1.0 s of tail (libx264 crf 14, yuv420p, 30 fps, no audio, HQ resolution), so
in-points measured inside the previews stay valid. It also writes a markdown report, a
JSON copy of the results and a contact sheet (preview frame | HQ crop | full HQ frame).

How it matches
  1. Previews: decoded at native rate. Black or blurred letterbox bars are detected, and
     both "whole window" and "content inside the bars" are tried.
  2. Coarse pass: every HQ file is decoded once at 15 fps to a tiny grey proxy (cached in
     out/.match_cache, keyed by path+mtime+size). Candidate crops of the HQ frame with the
     preview's aspect (centred, zoom 1.0/1.1/1.2/1.35, small shifts, inside detected HQ
     black bars too) become 24x30 thumbnails, normalised to zero mean / unit variance
     (robust to grading). Each preview slides over each file; score = mean normalised
     cross-correlation (NCC) + 0.5 x NCC of frame differences (motion signature, which
     separates near-static shots). Up to 20 % of a preview may hang off either end of a file.
  3. Refine: the best few (file, crop, offset) per preview are re-decoded at native fps
     around the coarse offset; the crop is fine-tuned (scale/shift search) and the offset
     picked at single-frame accuracy. The reported score is the appearance NCC at 36x45;
     a preview is matched only if it reaches --min-score, otherwise it is reported as
     unmatched (never guessed).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent

VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi", ".mts", ".m2ts", ".ts",
              ".mpg", ".mpeg", ".wmv", ".flv", ".3gp", ".mxf"}
COARSE_FPS = 15.0      # common rate of the cached proxies
COARSE_SHORT = 72      # short side (px) of the cached proxy frames
COARSE_DIM = 720       # pixels per coarse thumbnail (24x30 for 4:5)
REFINE_SHORT = 144     # short side of frames decoded for refinement
REFINE_DIM = 1620      # pixels per refine thumbnail (36x45 for 4:5)
INNER = 0.03           # ignore this fraction at each edge (crop slop, player chrome)
MOTION_W = 0.5         # weight of the motion signature in the ranking score
PARTIAL = 0.2          # fraction of a preview allowed outside the HQ file
OUT_FPS = 30
TAIL = 1.0
CACHE_VERSION = 3


def log(*a):
    print(*a, flush=True)


def run(cmd):
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


# --------------------------------------------------------------------------- probing

def _ratio(s, default=0.0):
    try:
        if s is None or s in ("", "0/0", "N/A", "0:1"):
            return default
        s = str(s)
        if "/" in s or ":" in s:
            a, b = re.split("[/:]", s)
            return float(a) / float(b) if float(b) else default
        return float(s)
    except (ValueError, ZeroDivisionError):
        return default


def probe(path):
    """Video stream facts, or None if the file has no decodable video."""
    r = run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format",
             "-show_streams", str(path)])
    if r.returncode != 0:
        return None
    try:
        j = json.loads(r.stdout.decode("utf-8", "replace") or "{}")
    except ValueError:
        return None
    vids = [s for s in j.get("streams", []) if s.get("codec_type") == "video"]
    vi = st = None
    for i, s in enumerate(vids):
        if not (s.get("disposition") or {}).get("attached_pic"):
            vi, st = i, s
            break
    if st is None:
        return None
    W, H = int(st.get("width") or 0), int(st.get("height") or 0)
    if W <= 0 or H <= 0:
        return None
    rot = 0
    for sd in st.get("side_data_list") or []:
        if "rotation" in sd:
            rot = int(round(float(sd["rotation"])))
    if "rotate" in (st.get("tags") or {}):
        rot = int(_ratio(st["tags"]["rotate"]))
    sar = _ratio(st.get("sample_aspect_ratio"), 1.0) or 1.0
    dw, dh = W * sar, float(H)
    ow, oh = W, H
    if rot % 180:
        dw, dh, ow, oh = dh, dw, H, W
    fps = _ratio(st.get("avg_frame_rate")) or _ratio(st.get("r_frame_rate")) or 30.0
    fmt = j.get("format") or {}
    dur = _ratio(st.get("duration")) or _ratio(fmt.get("duration"))
    # timestamp of the first presented frame (what "offset 0" means)
    first = None
    r2 = run(["ffprobe", "-v", "error", "-select_streams", f"v:{vi}", "-read_intervals",
              "%+#8", "-show_entries", "frame=pts_time,best_effort_timestamp_time",
              "-of", "json", str(path)])
    try:
        ts = []
        for fr in json.loads(r2.stdout.decode("utf-8", "replace") or "{}").get("frames", []):
            for k in ("pts_time", "best_effort_timestamp_time"):
                if fr.get(k) not in (None, "N/A"):
                    ts.append(float(fr[k]))
                    break
        first = min(ts) if ts else None
    except ValueError:
        pass
    if first is None:
        first = _ratio(st.get("start_time"))
    return dict(path=str(path), vindex=vi, width=ow, height=oh, disp_w=dw, disp_h=dh,
                rotation=rot, fps=fps, duration=dur, codec=st.get("codec_name"),
                first_pts=first)


def proxy_size(info, short):
    a = info["disp_w"] / info["disp_h"]
    if a <= 1:
        return short, max(short, int(round(short / a)))
    return max(short, int(round(short * a))), short


# --------------------------------------------------------------------------- decoding

def _raw_frames(data, w, h, ch=1):
    n = len(data) // (w * h * ch)
    shape = (n, h, w) if ch == 1 else (n, h, w, ch)
    return np.frombuffer(data[: n * w * h * ch], np.uint8).reshape(shape)


def decode_preview(path, info, pix_fmt):
    w, h = info["width"], info["height"]
    r = run(["ffmpeg", "-v", "error", "-nostdin", "-i", str(path), "-map", f"0:v:{info['vindex']}",
             "-an", "-sn", "-dn", "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", pix_fmt, "-"])
    return _raw_frames(r.stdout, w, h, 3 if pix_fmt == "rgb24" else 1)


def cache_key(info):
    st = os.stat(info["path"])
    s = f"{os.path.realpath(info['path'])}|{st.st_mtime_ns}|{st.st_size}|v{CACHE_VERSION}|{COARSE_FPS}|{COARSE_SHORT}"
    return hashlib.sha1(s.encode()).hexdigest()[:24]


def coarse_proxy(info, cache_dir, threads):
    """HQ file -> uint8 (T, h, w) grey frames at COARSE_FPS. Cached. Returns (frames, cached?)."""
    key = cache_key(info)
    npz = cache_dir / f"{key}.npz" if cache_dir else None
    if npz is not None and npz.exists():
        try:
            with np.load(npz) as z:
                return z["frames"], True
        except Exception:
            pass
    w, h = proxy_size(info, COARSE_SHORT)
    frames = None
    for fast in (True, False):
        cmd = ["ffmpeg", "-v", "error", "-nostdin", "-threads", str(threads)]
        if fast:  # deblocking off: much faster decode, irrelevant at thumbnail size
            cmd += ["-skip_loop_filter", "all", "-flags2", "+fast"]
        cmd += ["-i", info["path"], "-map", f"0:v:{info['vindex']}", "-an", "-sn", "-dn",
                "-vf", f"fps={COARSE_FPS},scale={w}:{h}:flags=area,format=gray",
                "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "gray", "-"]
        frames = _raw_frames(run(cmd).stdout, w, h)
        if len(frames):
            break
    if frames is None or not len(frames):
        raise RuntimeError("no frames decoded")
    if npz is not None:
        cache_dir.mkdir(parents=True, exist_ok=True)
        tmp = npz.with_name(npz.stem + f".{os.getpid()}.tmp.npz")
        np.savez_compressed(tmp, frames=frames)
        os.replace(tmp, npz)
    return frames, False


def decode_window(info, t0, t1, short, threads=2):
    """Native-rate grey frames with pts in [t0, t1] (seconds after the first frame).
    Returns (frames uint8 (T,h,w), absolute pts array)."""
    w, h = proxy_size(info, short)
    F, fp = info["fps"], info["first_pts"]
    a, b = fp + t0 - 0.25 / F, fp + t1
    cmd = ["ffmpeg", "-nostdin", "-hide_banner", "-v", "info", "-threads", str(threads)]
    if t0 > 0.3:
        cmd += ["-ss", f"{t0 - 0.3:.6f}", "-noaccurate_seek"]
    cmd += ["-copyts", "-i", info["path"], "-map", f"0:v:{info['vindex']}", "-an", "-sn", "-dn",
            "-vf", f"trim=start={a:.6f}:end={b:.6f},showinfo,scale={w}:{h}:flags=area,format=gray",
            "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "gray", "-"]
    r = run(cmd)
    frames = _raw_frames(r.stdout, w, h)
    pts = np.array([float(x) for x in re.findall(rb"\bpts_time:\s*(-?[0-9.]+(?:e[-+]?\d+)?)", r.stderr)])
    n = min(len(frames), len(pts))
    return frames[:n], pts[:n]


def grab_rgb(info, pts_abs, box_h=400):
    """One full HQ frame (display aspect, box_h tall) as a PIL image, or None."""
    F, fp = info["fps"], info["first_pts"]
    h = box_h
    w = max(2, int(round(h * info["disp_w"] / info["disp_h"] / 2)) * 2)
    rel = pts_abs - fp
    cmd = ["ffmpeg", "-v", "error", "-nostdin"]
    if rel > 1.0:
        cmd += ["-ss", f"{rel - 1.0:.6f}", "-noaccurate_seek"]
    cmd += ["-copyts", "-i", info["path"], "-map", f"0:v:{info['vindex']}", "-an", "-sn", "-dn",
            "-vf", f"trim=start={pts_abs - 0.4 / F:.6f},scale={w}:{h}:flags=bicubic,format=rgb24",
            "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    fr = _raw_frames(run(cmd).stdout, w, h, 3)
    return Image.fromarray(fr[0]) if len(fr) else None


# --------------------------------------------------------------------------- thumbnails

def box_matrix(n_src, start, length, n_out):
    """Area-averaging resample matrix (n_out x span) for source interval [start, start+length)."""
    edges = start + np.arange(n_out + 1) * (length / n_out)
    i0 = int(np.clip(math.floor(edges[0]), 0, n_src - 1))
    i1 = int(np.clip(math.ceil(edges[-1]), i0 + 1, n_src))
    idx = np.arange(i0, i1)
    lo = np.maximum(edges[:-1, None], idx[None, :])
    hi = np.minimum(edges[1:, None], idx[None, :] + 1)
    M = np.clip(hi - lo, 0, None)
    s = M.sum(1)
    empty = s <= 1e-9
    if empty.any():  # outside the frame: nearest edge pixel
        c = np.clip(np.floor((edges[:-1] + edges[1:]) / 2).astype(int), i0, i1 - 1) - i0
        M[empty] = 0
        M[np.nonzero(empty)[0], c[empty]] = 1
        s = M.sum(1)
    return (M / s[:, None]).astype(np.float32), (i0, i1)


def thumb_size(aspect, dim):
    return max(6, int(round(math.sqrt(dim * aspect)))), max(6, int(round(math.sqrt(dim / aspect))))


def thumbs(frames, rect, th, tw, chunk=1024):
    """frames (T,h,w) -> (T, th*tw) float32 area-resampled from rect (x, y, w, h) in px,
    shrunk by INNER on every side."""
    x0, y0, rw, rh = rect
    x0, y0, rw, rh = x0 + INNER * rw, y0 + INNER * rh, rw * (1 - 2 * INNER), rh * (1 - 2 * INNER)
    My, (a, b) = box_matrix(frames.shape[1], y0, rh, th)
    Mx, (c, d) = box_matrix(frames.shape[2], x0, rw, tw)
    MxT = Mx.T.copy()
    out = np.empty((len(frames), th, tw), np.float32)
    for s in range(0, len(frames), chunk):
        sub = frames[s:s + chunk, a:b, c:d].astype(np.float32)
        out[s:s + chunk] = My @ (sub @ MxT)
    return out.reshape(len(frames), th * tw)


def znorm(x, floor=2.0):
    """Zero mean, unit variance per row; near-flat rows (black frames) become 0."""
    x = x - x.mean(1, keepdims=True)
    s = x.std(1, keepdims=True)
    return np.where(s > floor, x / np.maximum(s, 1e-6), 0).astype(np.float32)


def motion(Z, i0, i1, floor=0.05):
    """Normalised frame-difference vectors Z[i1]-Z[i0]; static pairs become 0."""
    if len(i0) == 0:
        return np.zeros((0, Z.shape[1]), np.float32)
    return znorm(Z[i1] - Z[i0], floor)


# --------------------------------------------------------------------------- geometry

def border_band(flags, frac_min):
    """Leading run length of True in flags, if it is at least frac_min of len(flags)."""
    n = 0
    for f in flags:
        if not f:
            break
        n += 1
    return n if n >= frac_min * len(flags) else 0


def detect_preview_content(gray):
    """Black or blurred letterbox/pillarbox bars in a preview. Returns (x,y,w,h) px or None."""
    g = gray.astype(np.float32)
    K, H, W = g.shape
    mean = g.mean(0)
    row_det = np.abs(np.diff(g, axis=2)).mean((0, 2))   # horizontal detail per row
    col_det = np.abs(np.diff(g, axis=1)).mean((0, 1))   # vertical detail per column
    rmean, cmean = mean.mean(1), mean.mean(0)
    ref_r = np.median(row_det[H // 4: 3 * H // 4]) + 1e-3
    ref_c = np.median(col_det[W // 4: 3 * W // 4]) + 1e-3
    rb = ((rmean < 24) & (row_det < 1.5)) | (row_det < 0.2 * ref_r)
    cb = ((cmean < 24) & (col_det < 1.5)) | (col_det < 0.2 * ref_c)
    # tolerate one transition row/column between bar and picture
    top, bot = border_band(rb, 0.03), border_band(rb[::-1], 0.03)
    left, right = border_band(cb, 0.03), border_band(cb[::-1], 0.03)
    if not (top and bot):
        top = bot = 0
    if not (left and right):
        left = right = 0
    if top + bot == 0 and left + right == 0:
        return None
    top, bot = (top + 1, bot + 1) if top else (0, 0)
    left, right = (left + 1, right + 1) if left else (0, 0)
    x, y, w, h = left, top, W - left - right, H - top - bot
    if w < 0.3 * W or h < 0.3 * H:
        return None
    return (float(x), float(y), float(w), float(h))


def hq_active(frames):
    """Black bars baked into an HQ file -> normalised active rect, or None."""
    T, h, w = frames.shape
    step = max(1, T // 60)
    mx = frames[::step].max(0).astype(np.float32)
    rows, cols = mx.max(1) < 28, mx.max(0) < 28
    top, bot = border_band(rows, 0.03), border_band(rows[::-1], 0.03)
    left, right = border_band(cols, 0.03), border_band(cols[::-1], 0.03)
    if top + bot + left + right == 0:
        return None
    x0, y0, x1, y1 = left, top, w - right, h - bot
    if x1 - x0 < 0.3 * w or y1 - y0 < 0.3 * h:
        return None
    return (x0 / w, y0 / h, (x1 - x0) / w, (y1 - y0) / h)


def crop_candidates(A, W, H, base=(0.0, 0.0, 1.0, 1.0)):
    """Normalised crop rects of aspect A (w/h, display px) inside base (normalised)."""
    bx, by, bw, bh = base
    BW, BH = bw * W, bh * H
    if BW / BH > A:
        cw, ch = A * BH, BH
    else:
        cw, ch = BW, BW / A
    out, seen = [], set()
    for z, shifts in ((1.0, (-1, 0, 1)), (1.1, (0,)), (1.2, (-1, 0, 1)), (1.35, (0,))):
        w_, h_ = cw / z, ch / z
        sx, sy = BW - w_, BH - h_
        for s in shifts:
            dx = dy = 0.0
            if s:
                if max(sx, sy) < 0.04 * max(W, H):
                    continue
                if sy >= sx:
                    dy = s * min(sy / 2, 0.07 * H)
                else:
                    dx = s * min(sx / 2, 0.07 * W)
            x0 = bx * W + (BW - w_) / 2 + dx
            y0 = by * H + (BH - h_) / 2 + dy
            r = (x0 / W, y0 / H, w_ / W, h_ / H)
            k = tuple(round(v, 3) for v in r)
            if k not in seen:
                seen.add(k)
                out.append((r, f"z{z:g}" + ("" if not s else ("+" if s > 0 else "-"))))
    return out


def diag_sum(S, c0, K, pad):
    """acc[j] = sum_k S[j - pad + k, c0 + k] (rows outside S count as 0)."""
    T = S.shape[0]
    L = T + 2 * pad - K + 1
    if L <= 0 or K <= 0:
        return None
    acc = np.zeros(L, np.float32)
    for k in range(K):
        r0 = k - pad
        lo, hi = max(0, -r0), min(L, T - r0)
        if hi > lo:
            acc[lo:hi] += S[r0 + lo: r0 + hi, c0 + k]
    return acc


# --------------------------------------------------------------------------- previews

class Preview:
    def __init__(self, path):
        self.path = Path(path)
        self.pid = self.path.stem
        self.info = probe(path)
        if self.info is None:
            raise RuntimeError(f"cannot read preview {path}")
        self.fps = self.info["fps"]
        self.gray = decode_preview(path, self.info, "gray")
        self.rgb = decode_preview(path, self.info, "rgb24")
        self.K = len(self.gray)
        if self.K < 4:
            raise RuntimeError(f"preview {path} has only {self.K} frames")
        self.dur = self.K / self.fps
        H, W = self.gray.shape[1:]
        self.hyps = [(0.0, 0.0, float(W), float(H))]
        lb = detect_preview_content(self.gray)
        if lb is not None:
            self.hyps.append(lb)


def build_groups(previews):
    """Coarse query matrices grouped by aspect ratio (each group shares HQ crops)."""
    groups = {}
    for pv in previews:
        for hi, rect in enumerate(pv.hyps):
            A = rect[2] / rect[3]
            key = int(round(math.log(A) * 40))
            g = groups.get(key)
            if g is None:
                tw, th = thumb_size(A, COARSE_DIM)
                g = groups[key] = dict(aspect=A, tw=tw, th=th, P=[], dP=[], segs=[], n=0, nd=0)
            Z = znorm(thumbs(pv.gray, rect, g["th"], g["tw"]))
            for phase in (0.0, 0.5):
                idx = np.rint((np.arange(int(pv.dur * COARSE_FPS) + 2) + phase) * pv.fps / COARSE_FPS).astype(int)
                idx = idx[idx < pv.K]
                if len(idx) < 4:
                    continue
                P, dP = Z[idx], motion(Z, idx[:-1], idx[1:])
                g["segs"].append(dict(q=(pv.pid, hi), phase=phase, c0=g["n"], c0d=g["nd"], K=len(P)))
                g["P"].append(P)
                g["dP"].append(dP)
                g["n"] += len(P)
                g["nd"] += len(dP)
    for g in groups.values():
        D = g["tw"] * g["th"]        # dot / D of two z-normalised vectors = Pearson NCC
        g["Q"] = np.ascontiguousarray(np.vstack(g["P"]).T / D)
        g["dQ"] = np.ascontiguousarray(np.vstack(g["dP"]).T / D)
    return list(groups.values())


def coarse_match(info, frames, groups):
    """Best (crop, offset) of every preview hypothesis inside one HQ file."""
    T, h, w = frames.shape
    if T < 4:
        return {}
    bases = [(0.0, 0.0, 1.0, 1.0)]
    act = hq_active(frames)
    if act is not None:
        bases.append(act)
    best = {}
    for g in groups:
        for base in bases:
            for rect, label in crop_candidates(g["aspect"], info["disp_w"], info["disp_h"], base):
                Z = znorm(thumbs(frames, (rect[0] * w, rect[1] * h, rect[2] * w, rect[3] * h), g["th"], g["tw"]))
                dZ = motion(Z, np.arange(T - 1), np.arange(1, T))
                S, Sd = Z @ g["Q"], dZ @ g["dQ"]
                for seg in g["segs"]:
                    K = seg["K"]
                    pad = int(math.ceil(PARTIAL * K))
                    app = diag_sum(S, seg["c0"], K, pad)
                    if app is None:
                        continue
                    mot = diag_sum(Sd, seg["c0d"], K - 1, pad)
                    app /= K
                    mot /= max(1, K - 1)
                    comb = app + MOTION_W * mot
                    j = int(np.argmax(comb))
                    cur = best.get(seg["q"])
                    if cur is not None and comb[j] <= cur["comb"]:
                        continue
                    # other near-equal peaks (static shots): refine looks there too
                    alts = []
                    for jj in np.argsort(-comb)[:40]:
                        if comb[jj] < comb[j] - 0.05:
                            break
                        if all(abs(jj - x) > 0.3 * COARSE_FPS for x in [j] + alts):
                            alts.append(int(jj))
                        if len(alts) >= 3:
                            break
                    tt = lambda x: (x - pad - seg["phase"]) / COARSE_FPS  # noqa: E731
                    best[seg["q"]] = dict(comb=float(comb[j]), app=float(app[j]), mot=float(mot[j]),
                                          rect=rect, label=label, t=tt(j), alts=[tt(x) for x in alts])
    return best


# --------------------------------------------------------------------------- refinement

def refine(pv, hyp, info, cand, threads=2):
    """Native-rate offset + crop refinement of one coarse candidate."""
    F, fpts = info["fps"], info["first_pts"]
    centers = [cand["t"]] + list(cand.get("alts", []))
    lo = max(0.0, min(centers) - 0.45)
    hi = max(centers) + pv.dur + 0.45
    if info.get("duration"):
        hi = min(hi, info["duration"] + 0.5)
    frames, pts = decode_window(info, lo, hi, REFINE_SHORT, threads)
    T2 = len(frames)
    if T2 < 2:
        return None
    h, w = frames.shape[1:]
    crect = pv.hyps[hyp]
    tw, th = thumb_size(crect[2] / crect[3], REFINE_DIM)
    D = tw * th
    P = znorm(thumbs(pv.gray, crect, th, tw))
    K = pv.K
    kk = np.arange(K)
    offs = np.rint(kk * F / pv.fps).astype(int)         # HQ frame shown in preview frame k
    dP = motion(P, kk[:-1], kk[1:])
    steps = offs[1:] - offs[:-1]
    rel = pts - fpts
    at_start = rel[0] < 0.5 / F
    m_lo = -int(math.ceil(PARTIAL * (offs[-1] + 1))) if at_start else 0
    ms = np.arange(m_lo, T2)
    mt = np.where(ms >= 0, rel[np.clip(ms, 0, None)], rel[0] + ms / F)
    near = np.min(np.abs(mt[:, None] - np.array(centers)[None, :]), 1) <= 0.42
    ms, mt = ms[near], mt[near]
    if not len(ms):
        return None

    def px(r):
        return (r[0] * w, r[1] * h, r[2] * w, r[3] * h)

    def score_all(rect):
        Z = znorm(thumbs(frames, px(rect), th, tw))
        G = Z @ (P.T / D)                                 # (T2, K) per-frame NCC
        idx = ms[:, None] + offs[None, :]
        valid = (idx >= 0) & (idx < T2)
        app = np.where(valid, G[np.clip(idx, 0, T2 - 1), kk[None, :]], 0).sum(1) / K
        mot = np.zeros(len(ms), np.float32)
        for s in np.unique(steps):
            if s <= 0 or s >= T2:
                continue
            ks = np.nonzero(steps == s)[0]
            Dz = motion(Z, np.arange(T2 - s), np.arange(s, T2))
            Gd = Dz @ (dP[ks].T / D)
            i0 = ms[:, None] + offs[ks][None, :]
            v = (i0 >= 0) & (i0 < T2 - s)
            mot += np.where(v, Gd[np.clip(i0, 0, T2 - s - 1), np.arange(len(ks))[None, :]], 0).sum(1)
        mot /= max(1, K - 1)
        return app, mot, valid.mean(1)

    def crop_search(rect, m):
        ks = np.unique(np.rint(np.linspace(0, K - 1, 8)).astype(int))
        ii = m + offs[ks]
        ok = (ii >= 0) & (ii < T2)
        ks, ii = ks[ok], ii[ok]
        if len(ks) < 2:
            return rect
        Fs, Ps = frames[ii], P[ks]

        def f(r):
            return float((znorm(thumbs(Fs, px(r), th, tw)) * Ps).sum() / (len(ks) * D))

        best_r, best_v = rect, f(rect)
        for ss, sd in ((0.08, 0.04), (0.04, 0.02), (0.02, 0.01)):
            x, y, rw, rh = best_r
            cx, cy = x + rw / 2, y + rh / 2
            for s in (1 - ss, 1.0, 1 + ss):
                for dx in (-sd, 0.0, sd):
                    for dy in (-sd, 0.0, sd):
                        nw, nh = rw * s, rh * s
                        r = (cx + dx * rw - nw / 2, cy + dy * rh - nh / 2, nw, nh)
                        if r[0] < -0.015 or r[1] < -0.015 or r[0] + nw > 1.015 or r[1] + nh > 1.015:
                            continue
                        v = f(r)
                        if v > best_v + 1e-4:
                            best_r, best_v = r, v
        return best_r

    app, mot, cov = score_all(cand["rect"])
    m1 = int(ms[int(np.argmax(app + MOTION_W * mot))])
    rect = crop_search(cand["rect"], m1)
    app, mot, cov = score_all(rect)
    comb = app + MOTION_W * mot
    b = int(np.argmax(comb))
    m = int(ms[b])
    pts_m = float(pts[m]) if m >= 0 else float(pts[0] + m / F)
    k_mid = K // 2
    i_mid = m + offs[k_mid]
    pts_mid = float(pts[i_mid]) if 0 <= i_mid < T2 else pts_m + k_mid / pv.fps
    return dict(file=info["path"], hyp=hyp, rect=[float(v) for v in rect], m=m, pts=pts_m,
                offset=pts_m - fpts, frame=int(round((pts_m - fpts) * F)), fps=F, app=float(app[b]), mot=float(mot[b]),
                comb=float(comb[b]), coverage=float(cov[b]), pts_mid=pts_mid, k_mid=k_mid,
                coarse=dict(t=cand["t"], comb=cand["comb"], label=cand["label"]))


# --------------------------------------------------------------------------- outputs

def write_clip(info, res, pv, out_path, preset):
    F, fpts = info["fps"], info["first_pts"]
    n_frames = int(round(pv.dur * OUT_FPS)) + int(round(TAIL * OUT_FPS))
    npad = 0
    start = res["pts"]
    if res["offset"] < -0.5 / F:          # preview starts before the HQ file: hold frame 0
        npad = int(round(-res["offset"] * OUT_FPS))
        start = fpts
    seek = (start - fpts) - 1.5
    vf = f"trim=start={start - 0.4 / F:.6f},setpts=PTS-STARTPTS,fps={OUT_FPS}"
    if npad:
        vf += f",tpad=start={npad}:start_mode=clone"
    vf += ",scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p"
    cmd = ["ffmpeg", "-y", "-v", "error", "-nostdin"]
    if seek > 0:
        cmd += ["-ss", f"{seek:.6f}", "-noaccurate_seek"]
    tmp = out_path.with_name(f".{out_path.stem}.tmp.mp4")
    cmd += ["-copyts", "-i", info["path"], "-map", f"0:v:{info['vindex']}", "-an", "-sn", "-dn",
            "-vf", vf, "-frames:v", str(n_frames), "-c:v", "libx264", "-crf", "14",
            "-preset", preset, "-pix_fmt", "yuv420p", "-fps_mode", "cfr", "-r", str(OUT_FPS),
            "-movflags", "+faststart", str(tmp)]
    r = run(cmd)
    if r.returncode != 0 or not tmp.exists():
        tmp.unlink(missing_ok=True)
        raise RuntimeError(r.stderr.decode("utf-8", "replace")[-400:])
    os.replace(tmp, out_path)
    q = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries",
             "stream=nb_read_packets,width,height", "-of", "json", str(out_path)])
    try:
        s = json.loads(q.stdout)["streams"][0]
        return int(s["nb_read_packets"]), int(s["width"]), int(s["height"])
    except (ValueError, KeyError, IndexError):
        return None, None, None


def _font(size):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
              "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def _fit(img, bw, bh):
    s = min(bw / img.width, bh / img.height)
    return img.resize((max(1, int(img.width * s)), max(1, int(img.height * s))), Image.LANCZOS)


def contact_sheet(rows, infos, path, cols=3):
    """rows: list of (Preview, result-or-None, matched). preview | HQ crop | full HQ frame."""
    BW, BH, FW = 168, 210, 210
    pad, head = 8, 44
    cw = BW * 2 + FW + pad * 4
    chh = head + BH + pad * 2
    n = len(rows)
    nr = max(1, math.ceil(n / cols))
    sheet = Image.new("RGB", (cols * cw, nr * chh + 34), (24, 24, 28))
    d = ImageDraw.Draw(sheet)
    f1, f2 = _font(15), _font(12)
    d.text((pad, 8), "preview frame  |  HQ crop at the same instant  |  full HQ frame (yellow = matched window)",
           fill=(200, 200, 200), font=f1)

    def grab(job):
        pv, res, ok = job
        if res is None:
            return None
        return grab_rgb(infos[res["file"]], res["pts_mid"])

    with ThreadPoolExecutor(4) as ex:
        frames = list(ex.map(grab, rows))
    for i, ((pv, res, ok), full) in enumerate(zip(rows, frames)):
        x0, y0 = (i % cols) * cw, 34 + (i // cols) * chh
        col = (120, 220, 120) if ok else (235, 90, 90)
        if res is None:
            l1, l2 = f"{pv.pid}  NO MATCH", "no candidate"
        else:
            name = Path(res["file"]).name
            name = name if len(name) <= 34 else name[:31] + "..."
            l1 = f"{pv.pid} -> {name}" if ok else f"{pv.pid}  NO MATCH (best: {name})"
            l2 = f"@ {res['offset']:.3f}s  score {res['app']:.3f}  motion {res['mot']:.2f}  {res['fps']:g}fps"
        d.text((x0 + pad, y0 + 4), l1, fill=col, font=f1)
        d.text((x0 + pad, y0 + 24), l2, fill=(190, 190, 190), font=f2)
        k = res["k_mid"] if res else pv.K // 2
        pim = _fit(Image.fromarray(pv.rgb[min(k, pv.K - 1)]), BW, BH)
        sheet.paste(pim, (x0 + pad, y0 + head))
        if full is not None:
            r = res["rect"]
            fw, fh = full.size
            box = (int(r[0] * fw), int(r[1] * fh), int((r[0] + r[2]) * fw), int((r[1] + r[3]) * fh))
            hq = full.crop(box)
            # the preview frame shows its content rect; show the HQ crop at the same geometry
            crect = pv.hyps[res["hyp"]]
            pw, ph = pv.gray.shape[2], pv.gray.shape[1]
            cim = _fit(hq, BW, BH) if res["hyp"] == 0 else _fit(hq, BW * crect[2] / pw, BH * crect[3] / ph)
            sheet.paste(cim, (x0 + pad * 2 + BW, y0 + head))
            fim = _fit(full, FW, BH)
            s = fim.width / fw
            sheet.paste(fim, (x0 + pad * 3 + BW * 2, y0 + head))
            d.rectangle([x0 + pad * 3 + BW * 2 + box[0] * s, y0 + head + box[1] * s,
                         x0 + pad * 3 + BW * 2 + box[2] * s - 1, y0 + head + box[3] * s - 1],
                        outline=(255, 220, 0), width=2)
            if not ok:
                d.line([x0 + pad * 2 + BW, y0 + head, x0 + pad * 2 + BW * 2, y0 + head + BH],
                       fill=(235, 90, 90), width=2)
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path, quality=88)


# --------------------------------------------------------------------------- main

def find_videos(folder):
    out = []
    for p in sorted(Path(folder).rglob("*")):
        if any(part.startswith(".") or part == "__MACOSX" for part in p.relative_to(folder).parts):
            continue
        if p.is_file() and p.suffix.lower() in VIDEO_EXTS:
            out.append(p)
    return out


def rel(p):
    try:
        return str(Path(p).resolve().relative_to(ROOT))
    except ValueError:
        return str(p)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0],
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pack", help="folder with the downloaded HQ scenepack (searched recursively)")
    ap.add_argument("--previews", default=str(ROOT / "clips" / "v2"))
    ap.add_argument("--out", default=str(ROOT / "clips" / "v2_hq"))
    ap.add_argument("--report", default=str(ROOT / "out" / "match_report.md"))
    ap.add_argument("--contact", help="contact sheet path (default: match_contact.jpg next to the report)")
    ap.add_argument("--min-score", type=float, default=0.80)
    ap.add_argument("--dry-run", action="store_true", help="match and report, but write no clips")
    ap.add_argument("--cache", default=str(ROOT / "out" / ".match_cache"))
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 4)
    ap.add_argument("--preset", default="slow", help="x264 preset for the HQ clips (default slow)")
    args = ap.parse_args(argv)

    pack, prev_dir = Path(args.pack), Path(args.previews)
    if not pack.is_dir():
        ap.error(f"scenepack folder not found: {pack}")
    if not prev_dir.is_dir():
        ap.error(f"previews folder not found: {prev_dir}")
    prev_files = [p for p in find_videos(prev_dir) if p.parent == prev_dir]
    named = [p for p in prev_files if re.match(r"^P\d+$", p.stem)]
    prev_files = named or prev_files
    if not prev_files:
        ap.error(f"no preview videos in {prev_dir}")
    out_dir, report = Path(args.out).resolve(), Path(args.report)
    hq_files = [p for p in find_videos(pack)
                if out_dir not in p.resolve().parents and p.resolve().parent != prev_dir.resolve()]
    if not hq_files:
        ap.error(f"no video files found in {pack}")
    contact = Path(args.contact) if args.contact else report.with_name("match_contact.jpg")
    cache_dir = Path(args.cache) if args.cache else None
    jobs = max(1, args.jobs)
    t_start = time.time()

    # ---- previews
    previews = []
    for p in prev_files:
        try:
            previews.append(Preview(p))
        except RuntimeError as e:
            log(f"! skipping preview: {e}")
    if not previews:
        ap.error("no readable previews")
    lb = [f"{pv.pid}{tuple(int(v) for v in pv.hyps[1])}" for pv in previews if len(pv.hyps) > 1]
    log(f"{len(previews)} previews from {rel(prev_dir)}"
        + (f"; letterbox/blur bars detected in {', '.join(lb)}" if lb else ""))
    groups = build_groups(previews)

    # ---- coarse pass over every HQ file
    log(f"{len(hq_files)} video files in {pack} -> coarse scan ({jobs} jobs)")
    infos, coarse, bad = {}, {}, []
    t0 = time.time()

    def scan(p):
        info = probe(p)
        if info is None:
            return p, None, None, "unreadable"
        try:
            frames, cached = coarse_proxy(info, cache_dir, threads=2)
        except RuntimeError as e:
            return p, info, None, str(e)
        return p, info, coarse_match(info, frames, groups), ("cached" if cached else "")

    done = 0
    with ThreadPoolExecutor(jobs) as ex:
        futs = [ex.submit(scan, p) for p in hq_files]
        for fut in as_completed(futs):
            p, info, res, note = fut.result()
            done += 1
            if res is None:
                bad.append((p, note))
                log(f"  [{done:3d}/{len(hq_files)}] {p.name}: SKIPPED ({note})")
                continue
            infos[str(p)] = info
            coarse[str(p)] = res
            top = max(res.items(), key=lambda kv: kv[1]["comb"], default=None)
            hint = f"best {top[0][0]} {top[1]['app']:.2f}" if top else ""
            log(f"  [{done:3d}/{len(hq_files)}] {p.name}: {info['width']}x{info['height']} "
                f"{info['fps']:.3g}fps {info['duration']:.1f}s {note:6s} {hint}")
    t_coarse = time.time() - t0
    hq_minutes = sum(i["duration"] for i in infos.values()) / 60.0

    # ---- refine top candidates of every preview at native fps
    t0 = time.time()
    tasks = []
    for pv in previews:
        cands = []
        for f, res in coarse.items():
            for hi in range(len(pv.hyps)):
                c = res.get((pv.pid, hi))
                if c is not None:
                    cands.append((c["comb"], f, hi, c))
        cands.sort(key=lambda x: -x[0])
        if cands:
            top = cands[0][0]
            for comb, f, hi, c in cands[:3]:
                if comb >= top - 0.3:
                    tasks.append((pv, hi, f, c))
    refined = {pv.pid: [] for pv in previews}
    with ThreadPoolExecutor(jobs) as ex:
        futs = {ex.submit(refine, pv, hi, infos[f], c): pv for pv, hi, f, c in tasks}
        for fut in as_completed(futs):
            try:
                r = fut.result()
            except Exception as e:  # keep going: one broken file must not kill the run
                log(f"! refine failed for {futs[fut].pid}: {e}")
                r = None
            if r is not None:
                refined[futs[fut].pid].append(r)
    t_refine = time.time() - t0

    # ---- decide
    results = {}
    for pv in previews:
        rs = sorted(refined[pv.pid], key=lambda r: -r["comb"])
        best = rs[0] if rs else None
        ok = best is not None and best["app"] >= args.min_score
        notes = []
        if best is not None:
            others = [r for r in rs[1:] if r["file"] != best["file"]]
            if ok and others and others[0]["app"] >= args.min_score and best["app"] - others[0]["app"] < 0.03:
                notes.append(f"ambiguous: {Path(others[0]['file']).name} scores {others[0]['app']:.3f}")
            if ok and best["coverage"] < 0.999:
                notes.append(f"only {best['coverage'] * 100:.0f}% of the preview lies inside the HQ file")
            if ok and best["hyp"] > 0:
                notes.append("matched the content inside the preview's letterbox bars")
        results[pv.pid] = dict(preview=rel(pv.path), duration=pv.dur, frames=pv.K, matched=ok,
                               best=best, notes=notes,
                               runner_up=next((dict(file=r["file"], app=r["app"]) for r in rs[1:]
                                               if best and r["file"] != best["file"]), None))

    # ---- write clips
    t0 = time.time()
    if not args.dry_run:
        out_dir.mkdir(parents=True, exist_ok=True)
    for pv in previews:
        R = results[pv.pid]
        if not R["matched"]:
            continue
        b = R["best"]
        info = infos[b["file"]]
        avail = info["duration"] - b["offset"] - pv.dur if info["duration"] else TAIL
        if avail < TAIL - 1.0 / OUT_FPS:
            R["notes"].append(f"only {max(0.0, avail):.2f}s of tail in the HQ file")
        if args.dry_run:
            continue
        outp = out_dir / f"{pv.pid}.mp4"
        try:
            n, w, h = write_clip(info, b, pv, outp, args.preset)
            R.update(out=rel(outp), out_frames=n, out_size=[w, h])
            log(f"  wrote {rel(outp)}: {w}x{h}, {n} frames")
        except RuntimeError as e:
            R["notes"].append(f"encode failed: {e}")
            log(f"! {pv.pid}: encode failed: {e}")
    t_write = time.time() - t0

    # ---- report
    used = {r["best"]["file"] for r in results.values() if r["matched"]}
    unused = [f for f in infos if f not in used]
    matched = [pid for pid, r in results.items() if r["matched"]]
    unmatched = [pid for pid, r in results.items() if not r["matched"]]
    t_total = time.time() - t_start
    analysis = t_coarse + t_refine
    timing = dict(hq_files=len(infos), hq_minutes=hq_minutes, coarse_s=t_coarse, refine_s=t_refine,
                  write_s=t_write, total_s=t_total,
                  analysis_s_per_hq_minute=analysis / hq_minutes if hq_minutes else None)

    def crop_desc(b):
        r = b["rect"]
        return f"{r[2] * 100:.0f}%x{r[3] * 100:.0f}% @ ({r[0] * 100:.0f}%,{r[1] * 100:.0f}%)"

    L = [f"# Scenepack match report", "",
         f"- Scenepack: `{pack}` ({len(infos)} readable video files, {hq_minutes:.1f} min)",
         f"- Previews: `{rel(prev_dir)}` ({len(previews)})  ·  min score {args.min_score:.2f}"
         + ("  ·  **dry run (no clips written)**" if args.dry_run else f"  ·  clips → `{rel(out_dir)}`"),
         f"- Matched **{len(matched)}/{len(previews)}**  ·  contact sheet: `{rel(contact)}`", "",
         "Offset = seconds from the HQ file's first frame to the frame shown in the preview's first "
         "frame (HQ frame index in brackets). Score = mean normalised cross-correlation of the "
         "grey thumbnails (1.0 = identical); motion = same on frame differences.", "",
         "| Preview | Dur | HQ file | Offset s [frame] | Score | Motion | Crop of HQ frame | HQ res @ fps | Output |",
         "|---|---|---|---|---|---|---|---|---|"]
    for pv in previews:
        R = results[pv.pid]
        b = R["best"]
        if not R["matched"]:
            continue
        info = infos[b["file"]]
        outc = (f"`{Path(R['out']).name}` {R.get('out_frames')} fr" if R.get("out") else "—")
        L.append(f"| {pv.pid} | {pv.dur:.2f}s | `{Path(b['file']).name}` | {b['offset']:.3f} [{b['frame']}] "
                 f"| {b['app']:.3f} | {b['mot']:.2f} | {crop_desc(b)} "
                 f"| {info['width']}x{info['height']} @ {info['fps']:.3g} | {outc} |")
    L += ["", f"## Unmatched previews ({len(unmatched)})", ""]
    if not unmatched:
        L.append("None.")
    for pid in unmatched:
        R = results[pid]
        b = R["best"]
        if b is None:
            L.append(f"- **{pid}** ({R['duration']:.2f}s): no candidate at all")
        else:
            L.append(f"- **{pid}** ({R['duration']:.2f}s): best guess `{Path(b['file']).name}` @ "
                     f"{b['offset']:.3f}s scored {b['app']:.3f} (< {args.min_score:.2f}) — not used")
    notes = [(pid, n) for pid, R in results.items() for n in R["notes"]]
    if notes:
        L += ["", "## Notes", ""] + [f"- {pid}: {n}" for pid, n in notes]
    L += ["", f"## Unused HQ files ({len(unused)})", ""]
    L += [f"- `{os.path.relpath(f, pack)}`" for f in sorted(unused)] or ["None."]
    if bad:
        L += ["", f"## Unreadable files ({len(bad)})", ""] + [f"- `{os.path.relpath(p, pack)}`: {n}" for p, n in bad]
    L += ["", "## Timing", "",
          f"- coarse scan {t_coarse:.1f}s, refine {t_refine:.1f}s, clip encode {t_write:.1f}s, total {t_total:.1f}s",
          f"- analysis speed: {timing['analysis_s_per_hq_minute'] or 0:.1f} s per HQ minute"
          " (a second run reuses the cached proxies)"]
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text("\n".join(L) + "\n")

    def jsonable(R):
        R = dict(R)
        if R["best"]:
            R["best"] = dict(R["best"], file_name=Path(R["best"]["file"]).name)
        return R
    report.with_suffix(".json").write_text(json.dumps(dict(
        pack=str(pack), min_score=args.min_score, dry_run=args.dry_run,
        previews={pid: jsonable(R) for pid, R in results.items()},
        unused=[str(f) for f in sorted(unused)], unreadable=[str(p) for p, _ in bad],
        hq={f: dict(width=i["width"], height=i["height"], fps=i["fps"], duration=i["duration"])
            for f, i in infos.items()},
        timing=timing), indent=1))
    try:
        contact_sheet([(pv, results[pv.pid]["best"], results[pv.pid]["matched"]) for pv in previews],
                      infos, contact)
    except Exception as e:  # the sheet is a convenience; never fail the run over it
        log(f"! contact sheet failed: {e}")

    # ---- summary
    log("")
    log(f"{'preview':8s} {'HQ file':40s} {'offset':>9s} {'score':>6s}")
    for pv in previews:
        R = results[pv.pid]
        b = R["best"]
        if R["matched"]:
            log(f"{pv.pid:8s} {Path(b['file']).name[:40]:40s} {b['offset']:9.3f} {b['app']:6.3f}"
                + ("  ! " + "; ".join(R["notes"]) if R["notes"] else ""))
        else:
            log(f"{pv.pid:8s} {'-- no match --':40s} {'':9s} {(b['app'] if b else 0):6.3f}")
    log("")
    log(f"matched {len(matched)}/{len(previews)}; unmatched: {', '.join(unmatched) or 'none'}; "
        f"unused HQ files: {len(unused)}/{len(infos)}")
    log(f"analysis {analysis:.1f}s for {hq_minutes:.2f} HQ min = "
        f"{(timing['analysis_s_per_hq_minute'] or 0):.1f} s per HQ minute; total {t_total:.1f}s")
    log(f"report: {rel(report)}   contact sheet: {rel(contact)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
