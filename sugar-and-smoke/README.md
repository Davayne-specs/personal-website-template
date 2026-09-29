# Sugar & Smoke — mbastein's animated lyric films

Every line of a song becomes one riso-printed, gold-foiled scene, cut to the beat.
The series bible (look, palette, states, cast, formula, rules) lives in the
**Sugar & Smoke — Series Bible** doc; its second tab holds the Episode 1 storyboard.

**Episode 1: "give me life"** (3:17, 59 lyric lines → 59 scenes + a title card).

## What's here

| Path | What it is |
| --- | --- |
| `data/lyrics.json` | The lyric sheet, by section |
| `data/timing.json` | Start/end of every line and the time of every word, from the vocal |
| `data/audio-features.json` | Per-frame vocal level (lip-sync), low-band onsets, beat times |
| `data/storyboard.json` | One scene per line: swing-tag name, state, move, what happens |
| `tools/time_lyrics.py` | Rebuilds `timing.json` + `audio-features.json` from the song |
| `tools/make_textures.py` | Rebuilds the riso grain, watercolour washes, smoke, foil and stamp textures |
| `video/` | The Remotion project that animates and renders the episode |

Inside `video/src`:

| Path | What it is |
| --- | --- |
| `brand/tokens.ts` | Palette, stocks, registration offsets and tag stocks as code |
| `lib/print.tsx`, `lib/frame.tsx` | The riso print model: sticker-shadow, ghost and key plates |
| `lib/brush.ts` | Brush-ink line: any SVG path becomes a thick-to-thin boiling stroke |
| `lib/rig.tsx` | Jointed cut-out rigs, poses, walk cycles |
| `characters/` | Stein, Precious, Smoke, Biscuit, the Ring, the Gauge |
| `scenes/` | One component per lyric line (`verse1`, `verse2`, `hook1`, `hook2`, `pressure`, `outro`) |
| `overlay/` | Lyric strip, swing tags, PRECIOUS/PRESSURE stamps, the Gauge, transitions |
| `Episode.tsx` | Puts the scenes on the song's timeline (9:16 master) |
| `WallCut.tsx` | 16:9 cut: the print pinned to a cotton wall beside its catalogue entry |

## Render it

The song is not in the repo (it is unreleased and this repository is public).
Put it at `video/public/audio/give-me-life.mp3`, then:

```bash
cd sugar-and-smoke/video
npm install
npx remotion studio src/index.ts          # scrub the episode in the browser
npx remotion render src/index.ts GiveMeLife out/give-me-life-9x16.mp4 --codec=h264 --crf=18          # 1080x1920
npx remotion render src/index.ts GiveMeLifeWall out/give-me-life-16x9-wall.mp4 --codec=h264 --crf=18  # 1920x1080 wall cut
npx remotion still src/index.ts CastSheet out/cast.png
python3 ../tools/contact_sheet.py out/give-me-life-9x16.mp4 out/storyboard.png            # a frame from every scene
```

Render without the song with `--props='{"audio":false}'`.

## Re-time a new song

```bash
pip install sherpa-onnx librosa soundfile numpy imageio-ffmpeg pillow scipy
python3 tools/time_lyrics.py path/to/song.mp3   # isolates the vocal, transcribes it, aligns it to data/lyrics.json
```

Lines the recogniser cannot hear (sung melismas, ad-libs) are set by hand in `MANUAL`
at the top of `tools/time_lyrics.py`. Scenes land 0.15 s before each line's first word.
