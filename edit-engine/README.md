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

## Syncing lyrics exactly (do this once per song)
```bash
python3 edit-engine/edit.py tap my-song/project.json
```
It plays the song; press **Enter the moment each line starts**. It writes exact times into `lyrics.txt`. Made a mistake? `tap project.json --from-line 12` redoes from line 12 on. Whole thing slightly early/late? `shift project.json -0.2` moves every line 0.2s earlier (use `+` for later). If you skip lines with `s`, they're spread automatically between the lines around them.

## lyrics.txt
```
0:02   Nací en la calle | I was born in the street
0:06-0:09 Cada cicatriz tiene su historia | Every scar has its story
Y aún así sigo en pie | And still I'm standing     <- no time: follows previous line
```
Spanish `|` English. Lines without a time share the gap between the timed lines around them (longer lines get more time), so even just timing a few lines gets you close. Set `vocals_end` in project.json to when the last lyric ends. Times are seconds or `m:ss.s`; end time is optional (defaults to next line).

## project.json knobs
| key | what it does |
|---|---|
| `pace` | `[{from: seconds, beats: n}]`: cut length in beats from that time on. Slow verse → `4`, hook → `1`, drop → `0.5` |
| `look` | `contrast`, `saturation` (lower = grittier), `grain`, `vignette`, `shake` (px), `flash` (white hit on cuts), `zoom` |
| `caption` | `font`, `es_size`, `en_size`, `es_color`, `en_color`, `outline`, `margin_v` (distance from bottom), `upper`, `pop` |
| `look.bw` / `look.slowmo` | chance (0-1) that a cut is black & white / half-speed, for variety |
| `caption.lead` | captions appear this many seconds before the line is sung (default 0.08) |
| `scenes` | `true` to pick clip starts at scene changes in long source videos (slower first run) |
| `start`/`end` | audio window in seconds |

Want a heavier font (Anton, Bebas Neue)? Drop the `.ttf` in `my-song/fonts/` and set `caption.font` to its name.

## Clip variety
Cuts are spread across every clip (least-used first, never the same clip twice in a row, and fresh footage inside a clip before reusing any). More clips = more variety; `--seed N` rerolls.
