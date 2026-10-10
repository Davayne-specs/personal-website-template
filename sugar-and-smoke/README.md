# Sugar & Smoke — mbastein's animated lyric films

Every line of a song becomes one riso-printed, gold-foiled scene, cut to the beat.
The series bible (look, palette, states, cast, formula, rules) lives in the
**Sugar & Smoke — Series Bible** doc; its other tabs hold each episode's storyboard.

| No. | Song | Length | Scenes |
| --- | --- | --- | --- |
| 1 | "give me life" | 3:17 | 59 lyric lines → 59 scenes + a title card |
| 2 | "With You" | 2:59 | 52 lyric lines → 52 scenes + a snowy-street intro and a 29 s epilogue |
| 3 | "One Day" | 3:17 | 48 lyric lines → 48 scenes from the template kit, plus a title and a 26 s epilogue |
| 4 | "Troops" | 3:31 | 93 lyric lines → 93 template scenes with the motion upgrade, plus a title and a 19 s outro |

## What's here

| Path | What it is |
| --- | --- |
| `episodes/<ep>/lyrics.json` | The lyric sheet, by section |
| `episodes/<ep>/timing.json` | Start/end of every line and the time of every word, from the vocal |
| `episodes/<ep>/audio-features.json` | Per-frame vocal level (lip-sync), low-band onsets, beat times |
| `episodes/<ep>/storyboard.json` | One scene per line, in screen order: swing-tag name, state, move, what happens |
| `episodes/<ep>/manual.json` | Hand timings for lines the recogniser can't hear |
| `tools/time_lyrics.py` | Rebuilds an episode's `timing.json` + `audio-features.json` from the song |
| `tools/make_textures.py` | Rebuilds the riso grain, watercolour washes, smoke, foil and stamp textures |
| `tools/contact_sheet.py` | One labelled frame from every scene of a rendered episode |
| `video/` | The Remotion project that animates and renders the episodes |

Inside `video/src`:

| Path | What it is |
| --- | --- |
| `brand/tokens.ts` | Palette, stocks, registration offsets and tag stocks as code |
| `lib/print.tsx`, `lib/frame.tsx` | The riso print model: sticker-shadow, ghost and key plates |
| `lib/brush.ts` | Brush-ink line: any SVG path becomes a thick-to-thin boiling stroke |
| `lib/rig.tsx` | Jointed cut-out rigs, poses, walk cycles, two-bone reach |
| `lib/timeline.ts`, `lib/episode.ts` | An episode's data on the song's timeline: slots, stamp hits, beats, lip-sync |
| `characters/` | Stein, Precious, Smoke, Biscuit, Pip, the Ring, the Gauge |
| `props/` | Shared props (`common`) and No. 2's winter set (`winter`: snow, drifts, houses, streetlights) |
| `episodes/<ep>/` | Each episode's definition (`index.ts`: stamps, theme, title placement) and, for hand-drawn episodes, its `scenes/` |
| `templates/` | The template kit: backdrops, poses, faces, held props and features that turn a recipe into a scene |
| `overlay/` | Lyric strip, swing tags, stamps, transitions |
| `Episode.tsx` | Puts any episode's scenes on its song's timeline (9:16 master) |
| `WallCut.tsx` | 16:9 cut: the print pinned to a cotton wall beside its catalogue entry |

## Render it

The songs are not in the repo (they are unreleased and this repository is public).
Put them at `video/public/audio/give-me-life.mp3` and `video/public/audio/with-you.mp3`, then:

```bash
cd sugar-and-smoke/video
npm install
npx remotion studio src/index.ts          # scrub the episodes in the browser
npm run render:ep1                         # out/give-me-life-9x16.mp4, 1080x1920
npm run render:ep2                         # out/with-you-9x16.mp4, 1080x1920
npm run render:ep3                         # out/one-day-9x16.mp4, 1080x1920
npx remotion render src/index.ts WithYouWall out/with-you-16x9-wall.mp4 --codec=h264 --crf=18   # 1920x1080 wall cut
npx remotion still src/index.ts CastSheet out/cast.png
python3 ../tools/contact_sheet.py ../episodes/ep02-with-you out/with-you-9x16.mp4 out/with-you-storyboard.png
```

Compositions: `GiveMeLife`, `WithYou`, `OneDay` (each with a `...Wall` 16:9 cut) and the `CastSheet` still.
Render without the song with `--props='{"audio":false}'`.

## Time a song

```bash
pip install sherpa-onnx librosa soundfile numpy imageio-ffmpeg pillow scipy
python3 tools/time_lyrics.py episodes/ep02-with-you path/to/with-you.mp3
```

It isolates the vocal, transcribes it with word timestamps, and aligns the words to the
episode's `lyrics.json`. Lines the recogniser cannot hear (sung melismas, whispers, ad-libs)
are set by hand in the episode's `manual.json`; anything still unmatched shares out the gap
between its neighbours. Scenes land 0.15 s before each line's first word.

## Add an episode (the cheap way)

Nos. 3 and 4 were made without writing a scene: every line is a recipe in its `storyboard.json`,
and `video/src/templates/` turns recipes into scenes. A recipe sets:

- **Where:** a backdrop (`road`, `street`, `room`, `shore`, `field`, `sky`, `yard`, `plain`), a time of day
  (`day`, `dawn`, `dusk`, `night`), washes, and a zoom (`wide`, `mid`, `close`).
- **Who:** `stein`, `precious`, `kid`, `pair` (Stein and Precious; her part goes under `her`), `both`
  (Stein and the kid) or `none`, with x, scale, `style` (e.g. `{"cap": true}`) and `facing`.
- **What they do:** a pose (`stand`, `point`, `crossed`, `hips`, `phone`, `beckon`, `flex`, `offer`,
  `hug`, `sit`, `salute`, `armsUp`, …), a face (`joy`, `steel`, `cool`, `sly`, `smitten`, `attitude`, …),
  an action and something held (`phone`, `rose`, `money`, `plate`, `program`, `bag`, `polaroid`, …).
  Actions are `idle` (breathing), `walk`, `run`, `strut`, `approach`, `sway`, `nod`, or `dance` with
  `dance` = `bounce`, `whine`, `twoStep`, `wave`, `lean`. With a `travel` [from, to], walkers turn
  three-quarters and their steps match the ground covered; on a `street` they walk in place while the
  street slides by at the speed of their feet.
- **Features:** `sun`, `stars`, `calendar`, `confetti`, `hearts`, `rain`, `thread`, `sign`, `map`, `split`,
  `bed`, `lamp`, `smoke`, `spotlight`, `light`, `bubbleQ`, `chairs`, `shoe`, `notes`, `phone`, `clock`,
  `money`, `troops`, `speakers`, `table`, `jeep`, `fireworks`, `door`, `clown`.
- **Words:** a hand-written `note` on a sung word, a big foil `big` word, or an `echo` word that pops on
  every sung onset. `n: 0` is the title card and `n: -1` the end card.

1. Make `episodes/epNN-name/` with `lyrics.json` and the recipe `storyboard.json`, then time the song.
2. Copy `video/src/episodes/ep03-one-day/index.ts`, point it at the new folder, name the stamps.
3. Add it to `EPISODES` in `video/src/Root.tsx` and render.

Hand-drawn scenes (as in No. 1 and No. 2) still work: give the episode a `scenes/` folder and
pass its map as `scenes` instead of `scenesFrom(...)`; the two can be mixed for a few hero scenes.
