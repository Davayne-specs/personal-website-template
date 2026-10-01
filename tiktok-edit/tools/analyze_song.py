#!/usr/bin/env python3
"""Map a song for editing: beat grid, bars, energy, sections, vocal phrases.

    python tools/analyze_song.py song/spot_valley_road.mp3 analysis/raw_spot_valley_road.json \
        [--models /path/to/models]

Prints a bar-by-bar chart (energy, vocal and instrumental level) to read the
song's shape. With --models (holding UVR-MDX-NET-Voc_FT.onnx and
sherpa-onnx-whisper-small.en/, from the k2-fsa/sherpa-onnx GitHub releases) it
also separates vocals/instrumental into song/stems/<name>/ and transcribes each
vocal phrase, so lyric lines can be timed to the beat.
"""
import argparse
import json
import os
import warnings

import librosa
import numpy as np
import soundfile as sf

warnings.filterwarnings("ignore")


def fit_grid(y, sr, hop=128):
    """Constant-tempo beat grid: (period, phase) maximising onset strength."""
    oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    ot = librosa.times_like(oenv, sr=sr, hop_length=hop)
    dur = len(y) / sr
    best = None
    for start_bpm in (70, 90, 110, 130, 150):
        _, b = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=hop,
                                       start_bpm=start_bpm, units="time", tightness=300)
        if len(b) < 8:
            continue
        n = np.arange(len(b))
        per, ph = np.polyfit(n, b, 1)
        keep = np.abs(b - (per * n + ph)) < 0.05
        per, ph = np.polyfit(n[keep], b[keep], 1)
        grid = (ph % per) + per * np.arange(int(dur / per) + 1)
        score = np.interp(grid, ot, oenv).mean()
        if best is None or score > best[0]:
            best = (score, per, ph % per)
    _, per, ph = best
    # refine
    best = None
    for p in np.arange(ph - 0.05, ph + 0.05, 0.002):
        for q in np.arange(per * 0.997, per * 1.003, per * 0.0002):
            g = (p % q) + q * np.arange(int(dur / q) + 1)
            s = np.interp(g, ot, oenv).sum()
            if best is None or s > best[0]:
                best = (s, p % q, q)
    return best[2], best[1]


def downbeat_phase(y, sr, grid):
    """Which beat (0-3) carries the kick: low-band percussive energy per beat slot."""
    _, yp = librosa.effects.hpss(y)
    S = np.abs(librosa.stft(yp, hop_length=128))
    f = librosa.fft_frequencies(sr=sr)
    low = librosa.amplitude_to_db(S[(f > 30) & (f < 140)].sum(0) + 1e-6)
    t = librosa.times_like(low, sr=sr, hop_length=128)
    lb = np.interp(grid + 0.01, t, low)
    scores = [lb[k::4].mean() for k in range(4)]
    return int(np.argmax(scores)), scores


def separate(path, models, out_dir):
    import sherpa_onnx as so
    y, sr = librosa.load(path, sr=44100, mono=False)
    cfg = so.OfflineSourceSeparationConfig(model=so.OfflineSourceSeparationModelConfig(
        uvr=so.OfflineSourceSeparationUvrModelConfig(model=os.path.join(models, "UVR-MDX-NET-Voc_FT.onnx")),
        num_threads=os.cpu_count() or 4))
    out = so.OfflineSourceSeparation(cfg).process(sample_rate=sr, samples=np.ascontiguousarray(y.astype(np.float32)))
    os.makedirs(out_dir, exist_ok=True)
    paths = {}
    for name, st in zip(("vocals", "instrumental"), out.stems):
        p = os.path.join(out_dir, f"{name}.wav")
        sf.write(p, np.array(st.data).T, out.sample_rate)
        paths[name] = p
    return paths


def phrases(vocals_path, models):
    import sherpa_onnx as so
    d, sr0 = sf.read(vocals_path)
    m = librosa.resample(d.mean(1).astype(np.float32), orig_sr=sr0, target_sr=16000)
    sr, hop = 16000, 160
    db = 20 * np.log10(librosa.feature.rms(y=m, frame_length=480, hop_length=hop)[0] + 1e-9)
    t = np.arange(len(db)) * hop / sr
    act = db > np.percentile(db, 35) + 5
    segs, i = [], 0
    while i < len(act):
        if act[i]:
            j = i
            while j < len(act) and act[j]:
                j += 1
            segs.append([t[i], t[j - 1]])
            i = j
        else:
            i += 1
    merged = []
    for a, b in segs:
        if merged and a - merged[-1][1] < 0.25:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    merged = [s for s in merged if s[1] - s[0] > 0.15]
    md = os.path.join(models, "sherpa-onnx-whisper-small.en")
    rec = so.OfflineRecognizer.from_whisper(
        encoder=os.path.join(md, "small.en-encoder.int8.onnx"),
        decoder=os.path.join(md, "small.en-decoder.int8.onnx"),
        tokens=os.path.join(md, "small.en-tokens.txt"), num_threads=os.cpu_count() or 4)
    out = []
    for a, b in merged:
        st = rec.create_stream()
        st.accept_waveform(sr, m[int(max(0, a - 0.15) * sr):int((b + 0.15) * sr)])
        rec.decode_stream(st)
        out.append({"start": round(float(a), 3), "end": round(float(b), 3), "text": st.result.text.strip()})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("song")
    ap.add_argument("out")
    ap.add_argument("--models")
    args = ap.parse_args()

    y, sr = librosa.load(args.song, sr=22050, mono=True)
    dur = len(y) / sr
    per, ph = fit_grid(y, sr)
    grid = ph + per * np.arange(int((dur - ph) / per) + 1)
    k, scores = downbeat_phase(y, sr, grid)
    first_db = grid[k]
    bar = 4 * per
    if first_db > bar * 0.999:          # keep a bar 0 that starts at or before the music
        first_db -= bar * int(first_db / bar)
    nbars = int((dur - first_db) / bar) + 1

    rms = librosa.feature.rms(y=y, hop_length=512)[0]
    rt = librosa.times_like(rms, sr=sr, hop_length=512)

    def level(sig_rms, t_axis, a, b):
        m = (t_axis >= a) & (t_axis < b)
        return float(20 * np.log10(sig_rms[m].mean() + 1e-9)) if m.any() else -120.0

    res = {"song": os.path.basename(args.song), "duration": round(dur, 3), "bpm": round(60 / per, 3),
           "beat": round(per, 5), "bar": round(bar, 5), "first_downbeat": round(first_db, 4),
           "kick_scores_by_beat": [round(float(s), 2) for s in scores]}

    stems = None
    if args.models:
        name = os.path.splitext(os.path.basename(args.song))[0]
        stems = separate(args.song, args.models, os.path.join(os.path.dirname(args.song), "stems", name))
        res["stems"] = stems
        v, _ = librosa.load(stems["vocals"], sr=22050, mono=True)
        ins, _ = librosa.load(stems["instrumental"], sr=22050, mono=True)
        vr = librosa.feature.rms(y=v, hop_length=512)[0]
        ir = librosa.feature.rms(y=ins, hop_length=512)[0]

    bars = []
    for b in range(nbars + 1):
        a = first_db + b * bar
        if a >= dur:
            break
        row = {"bar": b, "start": round(a, 3), "db": round(level(rms, rt, a, a + bar), 1)}
        if stems:
            row["vocal_db"] = round(level(vr, rt, a, a + bar), 1)
            row["inst_db"] = round(level(ir, rt, a, a + bar), 1)
        bars.append(row)
    res["bars"] = bars

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    feat = np.vstack([librosa.util.normalize(chroma), librosa.util.normalize(mfcc)])
    res["novelty_bounds"] = [round(float(t), 2) for t in
                             librosa.frames_to_time(librosa.segment.agglomerative(feat, 14), sr=sr)]
    if stems:
        res["phrases"] = phrases(stems["vocals"], args.models)

    json.dump(res, open(args.out, "w"), indent=1)

    top = max(r["db"] for r in bars)
    print(f"{res['bpm']} BPM · beat {per:.4f}s · bar {bar:.4f}s · first downbeat {first_db:.3f}s · {dur:.1f}s")
    for r in bars:
        line = f"bar {r['bar']:3d} {r['start']:7.2f}s {'#' * max(0, int(40 + (r['db'] - top) * 2)):<40}"
        if stems:
            line += f" vox {r['vocal_db']:6.1f}  inst {r['inst_db']:6.1f}"
        print(line)
    for p in res.get("phrases", []):
        k_ = (p["start"] - first_db) / per
        print(f"{p['start']:7.2f}-{p['end']:7.2f} [{int(k_ // 4)}.{k_ % 4 + 1:.1f}] {p['text']}")


if __name__ == "__main__":
    main()
