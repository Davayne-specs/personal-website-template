"""
Murberry Ep 1 sound design, synthesized from scratch (no samples, nothing to
license). Reads cue times from src/ep01/timeline.json and writes
public/audio/ep01-mix.wav (48 kHz, stereo, 16-bit).

    pip install numpy scipy
    python3 scripts/make_audio.py

Layers, per the brand sheet:
  - deep paper fold: a paper crinkle slowed down and lowered in pitch, with
    a breath of low air under it
  - paper slide, tear, soft myosin ticks, faint breath on each rep
  - warm pad (D sus2, warming toward D major in the mind beat), barely there
  - low hum that rises as the muscles turn red and fades in the mind beat
"""

import json
import os

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, 'src', 'ep01', 'timeline.json')))
DUR = float(TL['duration'])
N = int(SR * DUR)
rng = np.random.default_rng(1966)


def db(x):
    return 10 ** (x / 20)


def bandpass(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype='bandpass', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def lowpass(x, f, order=2):
    sos = signal.butter(order, f, btype='lowpass', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def highpass(x, f, order=2):
    sos = signal.butter(order, f, btype='highpass', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def env_adsr(n, a, d, s_level, r):
    """Piecewise envelope over n samples; a, d, r as fractions of n."""
    e = np.zeros(n)
    ia, idd, ir = int(a * n), int(d * n), int(r * n)
    isus = max(0, n - ia - idd - ir)
    seg = [
        np.linspace(0, 1, ia, endpoint=False) ** 1.5,
        np.linspace(1, s_level, idd, endpoint=False),
        np.full(isus, s_level),
        np.linspace(s_level, 0, ir) ** 1.3,
    ]
    cat = np.concatenate(seg)[:n]
    e[: len(cat)] = cat
    return e


def stretch(x, factor):
    """Slow down by `factor` (also lowers pitch by the same factor)."""
    n_out = int(len(x) * factor)
    return signal.resample(x, n_out)


def reverb_ir(seconds=1.4, damp=2400):
    n = int(SR * seconds)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t * 4.2)
    ir = lowpass(ir, damp)
    ir[0] = 0
    return ir / np.sqrt(np.sum(ir ** 2))


IR = reverb_ir()


def with_room(x, wet=0.25):
    tail = signal.fftconvolve(x, IR)
    dry = np.concatenate([x, np.zeros(len(tail) - len(x))])
    return dry * (1 - wet) + tail * wet


def crinkle(seconds, density, lo, hi, shape):
    """Paper crinkle: many short noise grains whose rate follows `shape`."""
    n = int(SR * seconds)
    out = np.zeros(n)
    t = 0.0
    while t < seconds:
        p = shape(t / seconds)
        rate = max(1.0, density * p)
        t += rng.exponential(1.0 / rate)
        if t >= seconds:
            break
        g_len = int(SR * rng.uniform(0.002, 0.014))
        g = rng.standard_normal(g_len) * np.hanning(g_len) * rng.uniform(0.2, 1.0) * (0.3 + 0.7 * p)
        i = int(t * SR)
        out[i : i + g_len] += g[: max(0, min(g_len, n - i))]
    return bandpass(out, lo, hi, 2)


def deep_fold(scale=1.0, stretch_by=2.2, seconds=0.7):
    shape = lambda u: np.clip(np.sin(np.pi * min(1, u * 1.15)) ** 0.8, 0, 1)
    cr = crinkle(seconds, 900, 700, 7000, shape)
    cr = stretch(cr, stretch_by)
    n = len(cr)
    air = lowpass(rng.standard_normal(n), 380, 2)
    air *= env_adsr(n, 0.42, 0.18, 0.55, 0.4)
    thump_n = int(SR * 0.5)
    tt = np.arange(thump_n) / SR
    thump = np.sin(2 * np.pi * 62 * tt) * np.exp(-tt * 9) * 0.5
    x = cr / (np.max(np.abs(cr)) + 1e-9) * 0.55 + air / (np.max(np.abs(air)) + 1e-9) * 0.75
    start = int(n * 0.78)
    x[start : start + thump_n] += thump[: max(0, min(thump_n, n - start))]
    x = lowpass(x, 5200)
    x = with_room(x, 0.3)
    return x / (np.max(np.abs(x)) + 1e-9) * scale


def tear_sound(scale=1.0):
    shape = lambda u: (np.sin(np.pi * u) ** 0.6) * (0.6 + 0.4 * np.sin(18 * u) ** 2)
    rip = crinkle(1.0, 2400, 1400, 9000, shape)
    rip = stretch(rip, 1.55)
    rip = rip / (np.max(np.abs(rip)) + 1e-9) * 0.5
    fold = deep_fold(1.0, 2.6, 0.75)
    n = max(len(rip), len(fold))
    x = np.zeros(n)
    x[: len(fold)] += fold * 0.85
    x[: len(rip)] += rip
    return x / (np.max(np.abs(x)) + 1e-9) * scale


def slide_sound(seconds=0.85, scale=1.0):
    n = int(SR * seconds)
    noise = rng.standard_normal(n)
    # Filter sweep downward across the slide.
    out = np.zeros(n)
    block = 1024
    for i in range(0, n, block):
        u = i / n
        fc = 2400 - 1300 * u
        out[i : i + block] = bandpass(noise[i : i + block], fc * 0.55, fc * 1.6, 1)
    out = lowpass(out, 5000)
    out *= env_adsr(n, 0.2, 0.1, 0.8, 0.45)
    tap_n = int(SR * 0.08)
    tt = np.arange(tap_n) / SR
    tap = lowpass(rng.standard_normal(tap_n), 900) * np.exp(-tt * 60) * 0.6
    i = int(n * 0.86)
    out[i : i + tap_n] += tap[: max(0, min(tap_n, n - i))]
    out = with_room(out, 0.2)
    return out / (np.max(np.abs(out)) + 1e-9) * scale


def tick_sound(scale=1.0):
    n = int(SR * 0.12)
    tt = np.arange(n) / SR
    click = highpass(rng.standard_normal(n), 2000) * np.exp(-tt * 900) * 0.6
    wood = (np.sin(2 * np.pi * 1350 * tt) * np.exp(-tt * 70) * 0.5
            + np.sin(2 * np.pi * 680 * tt) * np.exp(-tt * 45) * 0.35)
    x = with_room(click + wood, 0.15)
    return x / (np.max(np.abs(x)) + 1e-9) * scale


def breath_sound(seconds, kind, scale=1.0):
    n = int(SR * seconds)
    noise = rng.standard_normal(n)
    if kind == 'in':
        x = bandpass(noise, 450, 2600, 2)
        e = env_adsr(n, 0.6, 0.1, 0.8, 0.3)
    else:
        x = bandpass(noise, 260, 1800, 2)
        e = env_adsr(n, 0.12, 0.25, 0.6, 0.63)
    x = lowpass(x * e, 3200)
    return x / (np.max(np.abs(x)) + 1e-9) * scale


def place(buf, x, t, gain=1.0, pan=0.0):
    """Mix mono x into stereo buf at time t (s), equal-power pan -1..1."""
    i = int(t * SR)
    if i >= len(buf):
        return
    x = x[: len(buf) - i]
    left = np.cos((pan + 1) * np.pi / 4)
    right = np.sin((pan + 1) * np.pi / 4)
    buf[i : i + len(x), 0] += x * gain * left
    buf[i : i + len(x), 1] += x * gain * right


def smooth_curve(points, t):
    """Piecewise-linear curve through (time, value) points, eased."""
    ts = np.array([p[0] for p in points])
    vs = np.array([p[1] for p in points])
    v = np.interp(t, ts, vs)
    return v


def pad(buf):
    t = np.arange(N) / SR
    # D sus2 voicing; F#3 warms it into D major for the mind beat and the end.
    voices = [
        (73.42, 0.9, -0.3),
        (110.0, 0.55, 0.35),
        (146.83, 0.42, -0.15),
        (164.81, 0.24, 0.45),
        (220.0, 0.16, -0.45),
    ]
    level = smooth_curve(
        [(0, 0), (0.4, 0), (3.5, 1), (140, 1), (146.5, 0.8), (148.6, 0.45), (TL['sound']['padEnd'], 0), (DUR, 0)], t)
    warmth = smooth_curve([(0, 0), (95, 0), (99, 1), (140, 1), (144, 0.8), (DUR, 0.8)], t)
    sus = smooth_curve([(0, 1), (145.5, 1), (148.0, 0), (DUR, 0)], t)
    out = np.zeros((N, 2))
    # Each voice gets its own small detune, so the copies drift against each
    # other slowly and never beat together (a shared detune pulses the bed).
    detunes = [(-0.043, 0.061), (-0.071, 0.037), (-0.052, 0.083), (-0.029, 0.047), (-0.064, 0.058)]
    for k, (f, a, p) in enumerate(voices):
        lfo = 0.8 + 0.2 * np.sin(2 * np.pi * (0.031 + 0.013 * k) * t + k * 1.7)
        amp = a * lfo * (sus if f == 164.81 else 1.0)
        dl, dr = detunes[k]
        for det, pp in ((dl, p - 0.25), (dr, p + 0.25), (0.0, p)):
            ph = 2 * np.pi * (f + det) * t + rng.uniform(0, 2 * np.pi)
            wave = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.05 * np.sin(3 * ph)
            left = np.cos((np.clip(pp, -1, 1) + 1) * np.pi / 4)
            right = np.sin((np.clip(pp, -1, 1) + 1) * np.pi / 4)
            out[:, 0] += wave * amp * left
            out[:, 1] += wave * amp * right
    # F#3 and a high A for warmth.
    for f, a, p in ((185.0, 0.26, 0.2), (293.66, 0.07, -0.2)):
        lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.027 * t + f)
        wave = np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) + 0.12 * np.sin(4 * np.pi * f * t)
        out[:, 0] += wave * a * lfo * warmth * np.cos((p + 1) * np.pi / 4)
        out[:, 1] += wave * a * lfo * warmth * np.sin((p + 1) * np.pi / 4)
    cutoff_env = lowpass(out[:, 0], 950), lowpass(out[:, 1], 950)
    out = np.stack(cutoff_env, axis=1)
    out /= np.max(np.abs(out)) + 1e-9
    buf += out * (level[:, None]) * db(-23)


def hum(buf):
    t = np.arange(N) / SR
    h = TL['sound']['hum']
    level = smooth_curve([(0, 0), (h['rise'][0], 0), (h['rise'][1], 1), (h['fadeOut'][0], 1), (h['fadeOut'][1], 0), (DUR, 0)], t)
    trem = 0.85 + 0.15 * np.sin(2 * np.pi * 0.19 * t)
    wave = (np.sin(2 * np.pi * 55 * t) + np.sin(2 * np.pi * 55.35 * t) * 0.3
            + 0.6 * np.sin(2 * np.pi * 110 * t) + 0.32 * np.sin(2 * np.pi * 165.2 * t)
            + 0.12 * np.sin(2 * np.pi * 220.4 * t))
    wave = lowpass(wave, 400)
    wave /= np.max(np.abs(wave)) + 1e-9
    buf[:, 0] += wave * level * trem * db(-25)
    buf[:, 1] += wave * level * trem * db(-25)


def main():
    buf = np.zeros((N, 2))
    s = TL['sound']
    pad(buf)
    hum(buf)
    for i, t0 in enumerate(s['folds']):
        place(buf, deep_fold(1.0, 2.2 + 0.15 * (i % 3)), t0, db(-11), pan=0.12 * ((i % 3) - 1))
    for t0 in s['softFolds']:
        place(buf, deep_fold(1.0, 1.7, 0.45), t0, db(-20), pan=0.35)
    for t0 in s['tears']:
        place(buf, tear_sound(), t0, db(-10))
    for i, t0 in enumerate(s['slides']):
        place(buf, slide_sound(0.8 + 0.1 * (i % 2)), t0, db(-19), pan=0.25 if i % 2 else -0.15)
    for i, t0 in enumerate(s['ticks']):
        place(buf, tick_sound(), t0, db(-23), pan=-0.1 + 0.04 * i)
    for b in s['breaths']:
        place(buf, breath_sound(b['end'] - b['start'], b['kind']), b['start'], db(-31))

    # Gentle master: soft knee, then normalise the peak to -1 dBFS.
    peak = np.max(np.abs(buf))
    buf = buf / (peak + 1e-9) * 0.98
    buf = np.tanh(buf * 1.2) / np.tanh(1.2)
    buf *= db(-1) / (np.max(np.abs(buf)) + 1e-9)
    # Silence after the pad resolves.
    end = int(SR * (s['padEnd'] + 0.25))
    fade = int(SR * 0.2)
    buf[end - fade : end] *= np.linspace(1, 0, fade)[:, None]
    buf[end:] = 0

    os.makedirs(os.path.join(ROOT, 'public', 'audio'), exist_ok=True)
    path = os.path.join(ROOT, 'public', 'audio', 'ep01-mix.wav')
    wavfile.write(path, SR, (buf * 32767).astype(np.int16))
    rms = 20 * np.log10(np.sqrt(np.mean(buf ** 2)) + 1e-12)
    print(f'wrote {path}  {DUR:.1f}s  rms {rms:.1f} dBFS')


if __name__ == '__main__':
    main()
