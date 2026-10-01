---
name: scenepack-edit
description: Plan and build a beat-synced vertical edit (TikTok / Reels / Shorts) from a song and a scene pack. The user sends the song and a LOW-quality copy of the scene pack; Claude maps the beat, re-arranges and splices the song to fit the edit, breaks the pack into shots, casts them to the music with effects and captions, renders previews and checks sync and framing, then hands over the edit and soundtrack so the user renders the 4K version on their own PC with render.py. Use this whenever someone sends a song together with footage, a scene pack, scenepack, twixtor pack or clips and wants an edit, a fan edit, "cut this to the beat", "make the song fit the edit", "edit this to my song", a TikTok/Reel/Short of a player or artist, or follows up on one (recut, new song, new pack, shorter version, 4K export, "it's out of sync") — even if they never say EDL, skill or render.py.
---

# Scene-pack edit: song + low-res pack in, 4K-ready edit out

The split of work that this skill is built around:

- **The user** sends the full song (wav/mp3), a low-quality copy of the scene pack (a 360p download is fine), the length(s) they want, and anything that must be in it (a moment, a caption, lyrics). Later they drop the **4K copy of the same pack** into the project on their Windows PC and run two commands.
- **Claude** does everything between: beat map, song re-arrangement, shot breakdown, casting, effects, captions, previews, checks, and the hand-off. The low-quality copy is only for planning; every decision is stored as times (seconds) that hold for the 4K file too, which `tools/scenes.py verify` proves before the user renders.

## The toolkit

Everything lives in the repo **Davayne-specs/personal-website-template**, folder `tiktok-edit/`. If the session does not have it, add it (`add_repo`) and clone it; develop on the session's branch. Python 3 with `numpy pillow soundfile` and `ffmpeg` on PATH; `pip install "opencv-python-headless<5"` adds face hints to the track sheets (optional).

| Tool | What it does |
|------|--------------|
| `tools/beatgrid.py` | song -> beat map: BPM, beat phase, bar lines, loudness per bar, proposed sections |
| `tools/scenes.py split / tracks / verify` | pack -> shots + contact sheets; position strips for crops; check the 4K copy matches |
| `tools/plan_edit.py` | plan file -> spliced soundtrack(s) + EDL(s) with cast, in-points, effects, captions |
| `render.py` | EDL -> 1080x1920 MP4 (`--preview` for fast 540x960, `--contact-sheet` for review) |
| `tools/qa.py sync / grid / crops` | beats vs cuts per section (suggests nudges); tempo drift; crop check sheet |
| `tools/make_audio.py` | the splicer `plan_edit.py --audio` calls (stems optional) |

One **slug** per song (lowercase, no spaces, e.g. `yamal2`), and every file is named with it, inside `tiktok-edit/`:

```
song/<slug>_full.wav        the user's track          sources/<slug>.mp4           the pack (low-res now, 4K later)
analysis/<slug>_beatmap.json                           research/<slug>_scenes.json  shot catalogue
plans/<slug>.json           the edit plan             edl/<slug>_<cut>.json        what render.py reads
song/<slug>_<cut>.wav       spliced soundtrack        out/<slug>_<cut>.mp4         renders (+ _contact.jpg)
```

Media (`song/`, `sources/`, `out/`, any wav/mp4) is git-ignored and never committed; plans, catalogues, beat maps and EDLs are. `plans/yamaldemo.json` is a complete worked example on the Lamine Yamal pack.

## Workflow

### 0. Intake

Copy the uploads into place (`song/<slug>_full.<ext>`, `sources/<slug>.mp4`) and `ffprobe` both. Confirm the lengths wanted; default to two cuts: **short** (~30 s, for reach and looping) and **main** (60-75 s; over 60 s qualifies for TikTok's Creator Rewards). Ask only what you cannot decide: e.g. which artist/player is the subject if the pack mixes people, or captions yes/no if lyrics weren't sent. Don't count on downloading anything from YouTube/TikTok in a cloud session: those sites are usually blocked or bot-checked, so ask for uploads.

### 1. Song -> beat map

```
python tools/beatgrid.py song/<slug>_full.wav --out analysis/<slug>_beatmap.json
python tools/qa.py grid analysis/<slug>_beatmap.json
```

`beatgrid` assumes a constant tempo (Suno and most pop/rap). `qa grid` checks the grid against the attacks in 8-bar windows: a gradual trend means the tempo is slightly off (rerun with the `--bpm` it suggests); one window jumping means that stretch is shifted (live or edited audio), so avoid it or give the segment that uses it a `nudge` later. If the bar line looks wrong (the "1" lands on a snare, choruses start mid-bar), force it with `--downbeat 0..3`.

Then name the sections. The printout proposes low/mid/high loudness per 4-bar phrase; turn that into intro / verse / pre / chorus / drop / bridge / outro, using the lyrics if the user sent them. Note where hooks and big hits start (bar numbers), because the edit is planned in bars.

### 2. Scene pack -> shot catalogue

```
python tools/scenes.py split sources/<slug>.mp4 --catalog research/<slug>_scenes.json --sheets out/<slug>_sheets
```

Look at every contact sheet (`Read` the jpgs). For each shot fill in `kind` (arrival, closeup, action, celebration, sad, or `skip` for channel title cards, subscribe banners, other people) and a short `desc`. Set `slowmo_source: true` for Twixtor / slow-motion packs. Check unusually long shots for missed cuts and split them by hand.

Framing, per shot: wide action where the ball and defenders matter -> `"fit": "blurfill"` (the whole 16:9 frame over a blurred copy). Everything else -> `"fit": "crop"` with the subject's horizontal position. Get positions from the strips, not by guessing:

```
python tools/scenes.py tracks sources/<slug>.mp4 --catalog research/<slug>_scenes.json --sheets out/<slug>_sheets
```

Each crop shot gets 5 timestamped frames with a tenths ruler (yellow tick = 0.5) and face boxes. Read the subject's centre: steady -> `"focus_x": 0.42`; moving -> `"focus_track": [[t, x], ...]` in source seconds. Face boxes are hints only: they miss profiles and hands over faces and fire on crowds. If the subject leaves the frame (too close, walks out), shorten that shot's `end` in the catalogue so it is never used.

### 3. The plan

Write `plans/<slug>.json`: which bars of the song each cut uses, the pace of each segment, the shots that must land on hooks and lyric lines, captions and the end title. Read **references/plan-format.md** for the format and **references/edit-grammar.md** for the craft (re-arranging the song, which pace for which section, casting by mood, effects, text). Iterate on the grid before building anything:

```
python tools/plan_edit.py plans/<slug>.json --slots
```

It prints every segment's length, start time, shot count and the cast (yours, plus auto-cast fill-ins by mood). Adjust segments, paces, `pattern`s and casts until the structure reads right.

### 4. Build, render, check

```
python tools/plan_edit.py plans/<slug>.json --audio        # EDLs + spliced soundtracks
python render.py edl/<slug>_<cut>.json --check
python render.py edl/<slug>_<cut>.json --preview --contact-sheet
python tools/qa.py sync edl/<slug>_<cut>.json
python tools/qa.py crops edl/<slug>_<cut>.json --video out/<slug>_<cut>_preview.mp4 --sheet out/<slug>_<cut>_crops.jpg
```

- **Sync**: aim for the attack -20..+40 ms after the cut in every section with a clear beat. When a section is flagged, add the suggested `nudge` to that segment (give contiguous segments the same nudge so they stay one unspliced piece), rebuild with `--audio`, re-check. Drum-less sections read fuzzy; judge those by the music, not the number.
- **Framing**: look at the contact sheet and the crop sheet. Any crop that misses the subject -> fix the catalogue (`focus_x` / `focus_track` / trimmed `end`) and rebuild. Repeats that feel samey -> change the cast.
- **Feel**: does the strongest moment hit the first downbeat of the drop? Do lyric captions land on matching footage? Does the end loop into the first frame?

Renders are cached per shot, so a rebuild only re-renders shots that changed. A full-resolution render from the low-res pack (`render.py edl/... --contact-sheet`, no `--preview`) shows the final look, softer than 4K will be.

### 5. Deliver

1. Send previews with `SendUserFile`. The limit is 30 MB per file, so encode copies (two-pass x264; bitrate ~ 24 MB x 8 / seconds, minus ~160 kbit/s audio): `ffmpeg -i out/X.mp4 -c:v libx264 -b:v <kbps>k -pass 1 -an -f null /dev/null && ffmpeg -i out/X.mp4 -c:v libx264 -b:v <kbps>k -pass 2 -c:a aac -b:a 160k -movflags +faststart out/X_share.mp4`.
2. Commit and push the plan, catalogue, beat map and EDLs (never media).
3. Send the spliced soundtrack(s) `song/<slug>_<cut>.wav` (each well under 30 MB): the user needs exactly these files, because the cuts are timed to them.
4. Give the user the 4K steps from **references/handoff-windows.md** with the slug and cut names filled in, so they can copy-paste them.

End with: where the previews are, what was decided (structure, standout moments), and anything they should decide (e.g. caption wording, which of two cuts to post).

## Things that went wrong before (and the fix)

- **Stutter**: Twixtor footage is already slow-motion; slowing it further repeats frames. `plan_edit` never goes below 1x on `slowmo_source` packs and uses 1.5x / ramps 2x->1x for energy.
- **Soft crops**: a 9:16 crop of 360p is a ~5x upscale. Previews look soft; the 4K render will not. Keep crop zooms modest (the planner caps punch-ins at 1.15).
- **Wrong 4K file**: a different upload of a pack can have a longer intro or different cuts. `scenes.py verify` catches it and, when everything is merely shifted, prints the exact trim command.
- **Renderer failures**: render a single shot with `--only sNN --jobs 1 -v` to see the ffmpeg error. Fixed already: zoom ending exactly on 1.0, errors hidden behind cancelled jobs, no fonts on Windows.
- **"Out of sync" reports**: run `qa.py sync` before arguing either way. The earlier song's beat map was hand-made and some sections landed ~70 ms late; `beatgrid` + `qa.py` exist so that doesn't recur.
