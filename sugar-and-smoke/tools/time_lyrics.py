"""Time every lyric line (and word) of a song from its audio.

    python3 tools/time_lyrics.py episodes/ep02-with-you path/to/song.mp3

Steps
  1. decode the song (ffmpeg) and isolate the vocal with UVR MDX-Net (sherpa-onnx)
  2. transcribe the vocal with word timestamps (NVIDIA Parakeet TDT 0.6B via sherpa-onnx)
  3. align the recognised words to <episode>/lyrics.json with dynamic programming
  4. write <episode>/timing.json (per line + per word) and <episode>/audio-features.json
     (per-frame vocal level for lip-sync, low-band onsets, beat times), and the raw
     recognised words to tools/.work/<episode>/heard.txt for checking by ear

Needs: pip install sherpa-onnx librosa soundfile numpy imageio-ffmpeg
Models are downloaded once into tools/.work/models from the sherpa-onnx GitHub releases.
Lines the recogniser cannot hear (sung melismas, ad-libs) are set by hand in
<episode>/manual.json: {"<line index>": {"span": [start, end], "words": [t0, t1, ...]}}.
"""
import json
import re
import subprocess
import sys
import tarfile
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path

import librosa
import numpy as np
import sherpa_onnx
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "episodes" / "ep01-give-me-life"  # replaced by the episode given on the command line
WORK = Path(__file__).resolve().parent / ".work"
MODELS = WORK / "models"
FPS = 30
REL = "https://github.com/k2-fsa/sherpa-onnx/releases/download"
UVR = MODELS / "UVR-MDX-NET-Voc_FT.onnx"
PARAKEET = MODELS / "sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8"

MANUAL: dict = {}  # loaded from <episode>/manual.json


def fetch():
    MODELS.mkdir(parents=True, exist_ok=True)
    if not UVR.exists():
        urllib.request.urlretrieve(f"{REL}/source-separation-models/UVR-MDX-NET-Voc_FT.onnx", UVR)
    if not PARAKEET.exists():
        tar = MODELS / "parakeet.tar.bz2"
        urllib.request.urlretrieve(f"{REL}/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8.tar.bz2", tar)
        with tarfile.open(tar) as t:
            t.extractall(MODELS)
        tar.unlink()


def decode(song):
    import imageio_ffmpeg

    wav = WORK / "song.wav"
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-i", str(song), "-ar", "44100", str(wav)], check=True)
    return wav


def separate(wav):
    out = WORK / "vocal.wav"
    if out.exists():
        return out
    cfg = sherpa_onnx.OfflineSourceSeparationConfig(
        model=sherpa_onnx.OfflineSourceSeparationModelConfig(
            uvr=sherpa_onnx.OfflineSourceSeparationUvrModelConfig(model=str(UVR)), num_threads=4
        )
    )
    sep = sherpa_onnx.OfflineSourceSeparation(cfg)
    y, sr = sf.read(wav, dtype="float32", always_2d=True)
    res = sep.process(sample_rate=sr, samples=np.ascontiguousarray(y.T))
    vocal = np.stack([np.asarray(ch.data) for ch in res.stems[0].data], axis=1)
    sf.write(out, vocal, res.sample_rate)
    return out


def transcribe(vocal):
    d = str(PARAKEET) + "/"
    rec = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=d + "encoder.int8.onnx", decoder=d + "decoder.int8.onnx", joiner=d + "joiner.int8.onnx",
        tokens=d + "tokens.txt", num_threads=4, sample_rate=16000, feature_dim=80,
        decoding_method="greedy_search", model_type="nemo_transducer",
    )
    y, sr = sf.read(vocal, dtype="float32")
    y = y.mean(axis=1) if y.ndim == 2 else y
    y16 = librosa.resample(y, orig_sr=sr, target_sr=16000)
    hop = 320
    rms = librosa.feature.rms(y=y16, frame_length=640, hop_length=hop)[0]
    active = rms > max(0.01, np.percentile(rms, 30))
    times = np.arange(len(rms)) * hop / 16000
    # cut the vocal into phrases at gaps >= 0.35 s, merge close ones, cap at ~25 s
    segs, start, last = [], None, None
    for t, a in zip(times, active):
        if a:
            start = t if start is None else start
            last = t
        elif start is not None and t - last >= 0.35:
            segs.append([start, last + 0.05])
            start = None
    if start is not None:
        segs.append([start, times[-1]])
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < 0.6 and s[1] - merged[-1][0] < 22:
            merged[-1][1] = s[1]
        else:
            merged.append(list(s))
    words = []
    for a, b in merged:
        n = int(np.ceil((b - a) / 25))
        for k in range(n):
            s0, s1 = a + (b - a) * k / n, a + (b - a) * (k + 1) / n
            pa, pb = max(0, s0 - 0.25), min(len(y16) / 16000, s1 + 0.25)
            st = rec.create_stream()
            st.accept_waveform(16000, y16[int(pa * 16000):int(pb * 16000)])
            rec.decode_stream(st)
            cur = None
            for tok, ts in zip(st.result.tokens, st.result.timestamps):
                if tok.startswith(" ") or cur is None:
                    if cur:
                        words.append(cur)
                    cur = {"w": tok.strip(), "t": pa + ts}
                else:
                    cur["w"] += tok
            if cur:
                words.append(cur)
    return words


def norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower().replace("*", "u")).replace("'", "")


def align(words, lyrics):
    words = [dict(w, n=norm(w["w"])) for w in words if norm(w["w"])]
    for i, w in enumerate(words):
        nxt = words[i + 1]["t"] if i + 1 < len(words) else w["t"] + 0.5
        w["e"] = min(nxt, w["t"] + 0.6)
    lines, lw = [], []
    for sec in lyrics:
        for text in sec["lines"]:
            li = len(lines)
            lines.append({"section": sec["section"], "text": text})
            lw += [{"n": norm(x), "line": li} for x in text.split() if norm(x)]
    sim = lambda a, b: 1.0 if a == b else SequenceMatcher(None, a, b).ratio()
    n, m, gap = len(lw), len(words), -0.45
    S = np.zeros((n + 1, m + 1))
    P = np.zeros((n + 1, m + 1), dtype=np.int8)
    S[:, 0] = np.arange(n + 1) * gap
    S[0, :] = np.arange(m + 1) * gap
    P[1:, 0], P[0, 1:] = 1, 2
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            s = sim(lw[i - 1]["n"], words[j - 1]["n"])
            best, p = S[i - 1, j - 1] + ((2 * s - 1) if s >= 0.5 else -1.0), 0
            if S[i - 1, j] + gap > best:
                best, p = S[i - 1, j] + gap, 1
            if S[i, j - 1] + gap > best:
                best, p = S[i, j - 1] + gap, 2
            S[i, j], P[i, j] = best, p
    match, i, j = {}, n, m
    while i > 0 and j > 0:
        if P[i, j] == 0:
            if sim(lw[i - 1]["n"], words[j - 1]["n"]) >= 0.5:
                match[i - 1] = j - 1
            i, j = i - 1, j - 1
        elif P[i, j] == 1:
            i -= 1
        else:
            j -= 1
    for li, ln in enumerate(lines):
        idx = [k for k in range(n) if lw[k]["line"] == li]
        ms = [(k, match[k]) for k in idx if k in match]
        if ms:
            (k0, j0), (k1, j1) = ms[0], ms[-1]
            ln["start"] = round(words[j0]["t"] - 0.28 * (k0 - idx[0]), 2)
            ln["end"] = round(words[j1]["e"] + 0.28 * (idx[-1] - k1), 2)
    return lines, words


def fill_gaps(lines):
    """Lines nothing was matched to (and no manual span) share the gap between their neighbours."""
    for i, ln in enumerate(lines):
        if "span" in MANUAL.get(i, {}):
            ln["start"], ln["end"] = MANUAL[i]["span"]
    i = 0
    while i < len(lines):
        if "start" in lines[i]:
            i += 1
            continue
        j = i
        while j < len(lines) and "start" not in lines[j]:
            j += 1
        a = lines[i - 1]["end"] + 0.1 if i > 0 else 0.0
        b = lines[j]["start"] - 0.1 if j < len(lines) else a + 2.5 * (j - i)
        n = [max(1, len(lines[k]["text"].split())) for k in range(i, j)]
        t = a
        for k, c in zip(range(i, j), n):
            span = (b - a) * c / sum(n)
            lines[k]["start"], lines[k]["end"] = round(t, 2), round(t + span * 0.9, 2)
            t += span
        i = j


def word_times(lines, words):
    fill_gaps(lines)
    out = []
    for i, ln in enumerate(lines):
        man = MANUAL.get(i, {})
        a, b = ln["start"], ln["end"]
        lw = ln["text"].split()
        cand = [w for w in words if a - 0.3 <= w["t"] <= b + 0.1]
        times, ci = [None] * len(lw), 0
        for k, w in enumerate(lw):
            nw = norm(w)
            for j in range(ci, min(ci + 4, len(cand))):
                cn = cand[j]["n"]
                if nw and cn and (nw == cn or nw.startswith(cn) or cn.startswith(nw) or (len(nw) > 3 and nw[:3] == cn[:3])):
                    times[k], ci = cand[j]["t"], j + 1
                    break
        if times[0] is None:
            times[0] = a
        known = [(k, t) for k, t in enumerate(times) if t is not None]
        for k in range(len(lw)):
            if times[k] is None:
                prev = max([q for q, _ in known if q < k], default=None)
                nxt = min([q for q, _ in known if q > k], default=None)
                if prev is not None and nxt is not None:
                    times[k] = times[prev] + (times[nxt] - times[prev]) * (k - prev) / (nxt - prev)
                elif prev is not None:
                    times[k] = min(b - 0.1, times[prev] + 0.25 * (k - prev))
        for k in range(1, len(times)):
            times[k] = max(times[k], times[k - 1] + 0.05)
        if "words" in man:
            times = list(man["words"])
        if "first" in man:
            times[0] = man["first"]
        out.append({"i": i, "section": ln["section"], "text": ln["text"], "start": round(a, 2), "end": round(b, 2),
                    "words": [{"w": w, "t": round(t, 2)} for w, t in zip(lw, times)]})
    for i in range(len(out) - 1):
        if out[i]["end"] > out[i + 1]["start"]:
            out[i]["end"] = round(out[i + 1]["start"] - 0.02, 2)
    return out


def features(wav, vocal):
    voc, sr = sf.read(vocal, dtype="float32")
    mix, _ = sf.read(wav, dtype="float32")
    voc, mix = voc.mean(axis=1), mix.mean(axis=1)
    n = int(np.ceil(len(mix) / sr * FPS))
    hop = sr // FPS

    def env(x):
        v = np.array([np.sqrt(np.mean(x[k * hop:(k + 1) * hop] ** 2)) if k * hop < len(x) else 0 for k in range(n)])
        return np.clip(v / (np.percentile(v, 98) + 1e-9), 0, 1)

    y22 = librosa.resample(mix, orig_sr=sr, target_sr=22050)
    tempo, beats = librosa.beat.beat_track(y=librosa.load(str(wav), sr=22050, mono=True)[0], sr=22050, units="time")
    low = librosa.onset.onset_strength(y=y22, sr=22050, hop_length=735, fmax=200, n_mels=32)[:n]
    low = np.clip(low / (np.percentile(low, 99) + 1e-9), 0, 1)
    return {"fps": FPS, "frames": n, "vocal": [round(float(x), 3) for x in env(voc)], "mix": [round(float(x), 3) for x in env(mix)],
            "low": [round(float(x), 3) for x in low], "tempo": float(np.atleast_1d(tempo)[0]), "beats": [round(float(b), 3) for b in beats]}


if __name__ == "__main__":
    DATA = Path(sys.argv[1]).resolve()
    song = Path(sys.argv[2])
    WORK = Path(__file__).resolve().parent / ".work" / DATA.name
    WORK.mkdir(parents=True, exist_ok=True)
    man = DATA / "manual.json"
    MANUAL = {int(k): v for k, v in json.load(open(man)).items()} if man.exists() else {}
    fetch()
    wav = decode(song)
    vocal = separate(wav)
    words = transcribe(vocal)
    with open(WORK / "heard.txt", "w") as fh:
        fh.write(" ".join(f"{w['w']}@{w['t']:.2f}" for w in words))
    lines, words = align(words, json.load(open(DATA / "lyrics.json")))
    timing = word_times(lines, words)
    json.dump(timing, open(DATA / "timing.json", "w"), indent=1)
    json.dump(features(wav, vocal), open(DATA / "audio-features.json", "w"))
    for t in timing:
        print(f"{t['i'] + 1:2d} {t['start']:7.2f} {t['end']:7.2f}  {t['text']}")
