"""Draw a level-over-time strip and a spectrogram of the mix: audio_check.py in.wav out.png"""
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile
from PIL import Image, ImageDraw

sr, x = wavfile.read(sys.argv[1])
x = x.astype(np.float32) / 32768
mono = x.mean(axis=1)
W, H1, H2 = 1500, 220, 420
img = Image.new('RGB', (W, H1 + H2 + 30), 'white')
d = ImageDraw.Draw(img)
# Level strip (dBFS of 50 ms RMS), -60..0
hop = int(sr * 0.05)
rms = np.array([np.sqrt(np.mean(mono[i:i + hop] ** 2) + 1e-12) for i in range(0, len(mono) - hop, hop)])
lv = 20 * np.log10(rms)
xs = np.linspace(0, W - 1, len(lv))
pts = [(float(a), float(H1 - (max(-60, b) + 60) / 60 * H1)) for a, b in zip(xs, lv)]
for k in range(-60, 1, 12):
    y = H1 - (k + 60) / 60 * H1
    d.line([(0, y), (W, y)], fill=(225, 225, 225))
d.line(pts, fill=(40, 40, 40), width=1)
dur = len(mono) / sr
for s in range(0, int(dur) + 1, 5):
    xx = s / dur * W
    d.line([(xx, 0), (xx, H1)], fill=(200, 210, 240))
    d.text((xx + 2, 2), str(s), fill=(90, 90, 160))
# Spectrogram 20 Hz - 12 kHz, log frequency
f, t, S = signal.spectrogram(mono, sr, nperseg=4096, noverlap=2048)
S = 10 * np.log10(S + 1e-12)
fmin, fmax = 20, 12000
logf = np.logspace(np.log10(fmin), np.log10(fmax), H2)
rows = np.array([S[np.argmin(np.abs(f - ff))] for ff in logf])[::-1]
rows = np.clip((rows + 110) / 70, 0, 1)
cols = np.linspace(0, rows.shape[1] - 1, W).astype(int)
spec = (255 * (1 - rows[:, cols])).astype(np.uint8)
img.paste(Image.fromarray(spec).convert('RGB'), (0, H1 + 30))
for ff in (50, 100, 200, 500, 1000, 2000, 5000, 10000):
    y = H1 + 30 + H2 - (np.log10(ff) - np.log10(fmin)) / (np.log10(fmax) - np.log10(fmin)) * H2
    d.text((2, y - 6), f'{ff}', fill=(200, 60, 60))
img.save(sys.argv[2])
print('peak dBFS', 20 * np.log10(np.max(np.abs(x)) + 1e-12))
