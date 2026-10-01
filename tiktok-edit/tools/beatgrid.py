#!/usr/bin/env python3
"""Beat grid for a song: tempo, beat phase, bar lines, energy per bar, proposed sections.

    python tools/beatgrid.py song/<slug>_full.wav --out analysis/<slug>_beatmap.json
    python tools/beatgrid.py song/x.mp3 --out analysis/x.json --bpm 112        # force the tempo
    python tools/beatgrid.py song/x.mp3 --out analysis/x.json --downbeat 2     # force which beat is "1"

Assumes a constant tempo (true for Suno tracks and most pop/rap). Prints a bar
table so the edit can be planned from it. Bar k starts at first_downbeat + k * bar.

How it works: spectral-flux onsets -> tempo by autocorrelation -> tempo and phase
refined by fitting a comb to the onsets across the whole song -> the bar line is the
beat phase (of 4) where the harmony changes most -> 4-bar phrases labelled by loudness.
Check the printout against your ears/lyrics: a downbeat off by 1-2 beats is the usual
failure, fixed with --downbeat.
"""
import argparse
import json
import subprocess

import numpy as np

SR = 22050
HOP = 256                      # 11.6 ms


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def stft_mag(x, n=2048):
    pad = np.pad(x, (n // 2, n // 2))
    frames = np.lib.stride_tricks.sliding_window_view(pad, n)[::HOP]
    return np.abs(np.fft.rfft(frames * np.hanning(n), axis=1)).astype(np.float32)


def flux(S, lo=0, hi=None):
    L = np.log1p(S[:, lo:hi])
    f = np.maximum(np.diff(L, axis=0, prepend=L[:1]), 0).sum(1)
    f = f - np.convolve(f, np.ones(32) / 32, mode="same")        # remove slow drift
    return np.maximum(f, 0) / (f.std() or 1)


def comb_score(env, period, phase):
    """Mean onset strength sampled at phase + k*period (frames, linear interpolation)."""
    t = np.arange(phase, len(env) - 1, period)
    i = t.astype(int)
    w = t - i
    return float(((1 - w) * env[i] + w * env[i + 1]).mean())


def tempo(env, fps, bpm=None, lo=70, hi=180):
    if bpm:
        return 60 * fps / bpm
    ac = np.correlate(env, env, mode="full")[len(env) - 1:]
    lags = np.arange(len(ac))
    ok = (lags >= 60 * fps / hi) & (lags <= 60 * fps / lo)
    lag = lags[ok][np.argmax(ac[ok])]
    bpm0 = 60 * fps / lag
    while bpm0 < 85:          # prefer the 85-170 octave, where edit tempos live
        bpm0 *= 2
    while bpm0 > 170:
        bpm0 /= 2
    return 60 * fps / bpm0


def refine(x, beat, phase, fixed_tempo=False):
    """Fine tempo/phase: short-window flux (23 ms window, 1.45 ms hop) fitted across the whole song.

    The coarse pass uses a long window for robust tempo; its peaks smear the attack. Here a
    512-sample window puts the flux peak on the transient, which is where cuts must land.
    """
    n, hop = 512, 32
    pad = np.pad(x, (n // 2, n // 2))
    frames = np.lib.stride_tricks.sliding_window_view(pad, n)[::hop]
    S = np.abs(np.fft.rfft(frames * np.hanning(n), axis=1)).astype(np.float32)
    env = flux(S)
    fps = SR / hop
    best = (-1.0, beat, phase)
    betas = [beat] if fixed_tempo else beat * (1 + np.linspace(-0.001, 0.001, 41))
    for b in betas:
        for ph in phase + np.arange(-0.03, 0.03, 0.001):
            sc = comb_score(env, b * fps, (ph % b) * fps)
            if sc > best[0]:
                best = (sc, b, ph % b)
    return float(best[1]), float(best[2])


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("song")
    ap.add_argument("--out", required=True)
    ap.add_argument("--bpm", type=float, help="force the tempo")
    ap.add_argument("--downbeat", type=int, choices=range(4), help="force which of the 4 beat phases is beat 1")
    args = ap.parse_args()

    x = load(args.song)
    dur = len(x) / SR
    S = stft_mag(x)
    fps = SR / HOP
    freqs = np.fft.rfftfreq(2048, 1 / SR)
    env = flux(S)
    low = flux(S, 0, int(np.searchsorted(freqs, 150)))

    # tempo + phase: coarse from autocorrelation, then a fine comb fit over the whole song
    p0 = tempo(env, fps, args.bpm)
    best = (-1, p0, 0.0)
    periods = [p0] if args.bpm else np.linspace(p0 * 0.99, p0 * 1.01, 81)
    for P in periods:
        for ph in np.arange(0, P, 0.5):
            sc = comb_score(env + 0.5 * low, P, ph)
            if sc > best[0]:
                best = (sc, P, ph)
    _, P, ph = best
    for ph2 in np.arange(ph - 0.5, ph + 0.5, 0.05):                 # sub-frame phase
        if ph2 >= 0 and (sc := comb_score(env + 0.5 * low, P, ph2)) > best[0]:
            best = (sc, P, ph2)
    _, P, ph = best
    beat, first_beat = refine(x, P / fps, ph / fps, fixed_tempo=bool(args.bpm))
    beats = np.arange(first_beat, dur, beat)

    # bar line: the beat phase where the spectrum (harmony) changes most
    chroma_like = np.log1p(S[:, :int(np.searchsorted(freqs, 2000))])
    def spec_at(t0, t1):
        a, b = int(t0 * fps), max(int(t1 * fps), int(t0 * fps) + 1)
        return chroma_like[a:b].mean(0)
    nov = []
    for t in beats[1:-1]:
        u, v = spec_at(t - beat / 2, t), spec_at(t, t + beat / 2)
        nov.append(1 - float(u @ v / (np.linalg.norm(u) * np.linalg.norm(v) + 1e-9)))
    nov = np.r_[0, nov, 0]
    scores = [float(nov[o::4].mean()) for o in range(4)]
    off = args.downbeat if args.downbeat is not None else int(np.argmax(scores))
    first_downbeat = float(beats[off])
    bar = 4 * beat
    n_bars = int((dur - first_downbeat) // bar)

    rms = lambda a, b: 20 * np.log10(np.sqrt(np.mean(x[int(a * SR):int(b * SR)] ** 2)) + 1e-9)
    bar_db = [round(float(rms(first_downbeat + k * bar, first_downbeat + (k + 1) * bar)), 1) for k in range(n_bars)]
    phrases = []
    for k in range(0, n_bars, 4):
        e = float(np.mean(bar_db[k:k + 4]))
        phrases.append({"bar": k, "bars": min(4, n_bars - k), "db": round(e, 1)})
    q1, q2 = np.percentile([p["db"] for p in phrases], [33, 70]) if phrases else (0, 0)
    for p in phrases:
        p["level"] = "low" if p["db"] < q1 else ("high" if p["db"] >= q2 else "mid")
    sections = []
    for p in phrases:
        if sections and sections[-1]["level"] == p["level"]:
            sections[-1]["bars"] += p["bars"]
        else:
            sections.append({"bar": p["bar"], "bars": p["bars"], "level": p["level"]})
    for s in sections:
        s["start"] = round(first_downbeat + s["bar"] * bar, 3)
        s["end"] = round(first_downbeat + (s["bar"] + s["bars"]) * bar, 3)

    out = {"song": args.song, "duration": round(dur, 3), "bpm": round(60 / beat, 3), "beat": round(beat, 5),
           "bar": round(bar, 5), "first_beat": round(first_beat, 4), "first_downbeat": round(first_downbeat, 4),
           "downbeat_phase_scores": [round(s, 4) for s in scores], "bars": n_bars, "bar_db": bar_db,
           "phrases": phrases, "sections": sections,
           "note": "Constant tempo. Bar k starts at first_downbeat + k*bar. Sections are a loudness-based "
                   "proposal (low/mid/high per 4-bar phrase); rename them (intro, verse, chorus, drop...) when planning."}
    with open(args.out, "w") as f:
        json.dump(out, f, indent=1)
        f.write("\n")

    print(f"{args.song}: {dur:.2f}s  {60 / beat:.3f} BPM  beat {beat:.4f}s  bar {bar:.4f}s")
    print(f"first beat {first_beat:.3f}s, bar line on beat phase {off} -> first downbeat {first_downbeat:.3f}s "
          f"(phase scores {', '.join(f'{s:.3f}' for s in scores)})")
    print(f"{n_bars} bars. Proposed sections (4-bar phrases by loudness):")
    for s in sections:
        print(f"  bars {s['bar']:3d}-{s['bar'] + s['bars'] - 1:3d}  {s['start']:7.2f}-{s['end']:7.2f}s  {s['level']}")
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
