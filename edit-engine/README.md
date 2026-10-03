# Edit engine

Beat-synced fast-cut videos: your short clips cut to the song, Spanish caption on top, English translation right under it. Edit two text files and re-run. Nothing to re-prompt.

Needs only `ffmpeg` + Python 3 (no pip installs).

```bash
python3 edit-engine/edit.py init my-song          # scaffold
# put song.mp3 in my-song/, clips in my-song/clips/, write my-song/lyrics.txt
python3 edit-engine/edit.py beats my-song/project.json --write   # auto BPM + first beat
python3 edit-engine/edit.py build my-song/project.json --preview # half-res, fast
python3 edit-engine/edit.py build my-song/project.json           # final 1080x1920
```

## Iterating cheaply
- `--range 20-45` renders only that part of the song.
- `--seed 7` rerolls which clips land where.
- Cut segments are cached in `.cache/`: changing lyrics, caption style or audio re-renders in seconds.
- Beat detection can land on half/double time; if cuts feel off, set `bpm`/`offset` by hand.

## lyrics.txt
```
0:02   Nací en la calle | I was born in the street
0:06-0:09 Cada cicatriz tiene su historia | Every scar has its story
Y aún así sigo en pie | And still I'm standing     <- no time: follows previous line
```
Spanish `|` English. Times are seconds or `m:ss.s`; end time is optional (defaults to next line).

## project.json knobs
| key | what it does |
|---|---|
| `pace` | `[{from: seconds, beats: n}]`: cut length in beats from that time on. Slow verse → `4`, hook → `1`, drop → `0.5` |
| `look` | `contrast`, `saturation` (lower = grittier), `grain`, `vignette`, `shake` (px), `flash` (white hit on cuts), `zoom` |
| `caption` | `font`, `es_size`, `en_size`, `es_color`, `en_color`, `outline`, `margin_v` (distance from bottom), `upper`, `pop` |
| `scenes` | `true` to pick clip starts at scene changes in long source videos (slower first run) |
| `start`/`end` | audio window in seconds |

Want a heavier font (Anton, Bebas Neue)? Drop the `.ttf` in `my-song/fonts/` and set `caption.font` to its name.
