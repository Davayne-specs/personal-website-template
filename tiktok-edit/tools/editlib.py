"""Shared helpers for the scene-pack edit tools (scenes.py, plan_edit.py, scenepack_edl.py, qa.py)."""
import json
import subprocess

import numpy as np

ACTIVE = {"action", "celebration"}       # in-point follows the motion peak; other kinds sit mid-shot


def probe(path):
    """(duration s, fps, width, height) of a video's first video stream."""
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height,r_frame_rate:format=duration", "-of", "json", path],
                         capture_output=True, text=True, check=True).stdout
    j = json.loads(out)
    st = j["streams"][0]
    num, den = (int(x) for x in st["r_frame_rate"].split("/"))
    return float(j["format"]["duration"]), num / den, st["width"], st["height"]


def gray_frames(path, w=64, h=36):
    """Every frame of the video, downscaled to w x h grey (float32, shape [n, h*w])."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={w}:{h},format=gray",
                          "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h * w).astype(np.float32)


def motion_curve(path, frames=None):
    """Mean absolute frame-to-frame change (64x36 grey), lightly smoothed; one value per source frame."""
    fr = gray_frames(path) if frames is None else frames
    d = np.r_[0.0, np.abs(np.diff(fr, axis=0)).mean(1)]
    return np.convolve(d, np.ones(5) / 5, mode="same")


def detect_cuts(path, min_gap_s=0.2):
    """Hard cuts in a video: returns (fps, n_frames, [(start_frame, end_frame), ...])."""
    _, fps, _, _ = probe(path)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", "scale=64:36,format=rgb24",
                          "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, 36, 64, 3).astype(np.float32)
    n = len(fr)
    d = np.r_[0.0, np.abs(np.diff(fr.mean(3), axis=0)).mean((1, 2))]
    hist = np.array([np.concatenate([np.histogram(f[..., c], 16, (0, 256))[0] for c in range(3)]) for f in fr],
                    dtype=float)
    hist /= hist.sum(1, keepdims=True)
    hd = np.r_[0.0, np.abs(np.diff(hist, axis=0)).sum(1)]
    half = max(1, int(fps / 2))
    med = np.array([np.median(d[max(0, i - half):i + half]) for i in range(n)])
    cut = (d > np.maximum(25, 4 * med)) | (hd > 0.6)
    gap = max(1, int(round(min_gap_s * fps)))
    bounds = [0]
    for i in range(1, n):
        if cut[i] and i - bounds[-1] >= gap:
            bounds.append(i)
    bounds.append(n)
    return fps, n, list(zip(bounds[:-1], bounds[1:]))


def source_span(dur, speed, ramp):
    """Seconds of source a shot of `dur` output seconds consumes (matches render.py)."""
    if ramp:
        return dur * ramp["at"] * ramp["from"] + dur * (1 - ramp["at"]) * ramp["to"]
    return dur * speed


def pick_in(sc, span, motion, used, fps=30.0):
    """Source in-point for a window of `span` s inside scene `sc`.

    Action / celebration shots take the busiest stretch; calmer kinds sit mid-shot.
    `used` collects windows already taken from this scene so reuses prefer fresh footage.
    """
    a, b = int(sc["start"] * fps) + 2, int(sc["end"] * fps) - 2
    w = int(round(span * fps))
    starts = np.arange(a, max(a, b - w) + 1)
    if sc.get("kind") in ACTIVE:
        score = np.array([motion[s:s + w].mean() for s in starts])
        score = score / (score.max() or 1)
    else:
        mid = (a + b) / 2
        score = 1 - np.abs(starts + w / 2 - mid) / max(b - a, 1)
    for ua, ub in used:
        overlap = np.clip(np.minimum(starts + w, ub) - np.maximum(starts, ua), 0, None) / max(w, 1)
        score = score - 1.5 * overlap
    s = int(starts[int(np.argmax(score))])
    used.append((s, s + w))
    return s / fps


def focus_at(sc, t):
    """Subject's horizontal position (0..1) at source time t: steady focus_x or interpolated focus_track."""
    if "focus_track" in sc:
        ts, xs = zip(*sc["focus_track"])
        return round(float(np.interp(t, ts, xs)), 3)
    return sc.get("focus_x", 0.5)
