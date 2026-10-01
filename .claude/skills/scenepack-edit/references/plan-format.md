# Plan file format (`plans/<slug>.json`)

`tools/plan_edit.py` turns one plan into one EDL and one spliced soundtrack per cut. All paths
are relative to `tiktok-edit/`.

## Top level

| key | required | meaning |
|-----|----------|---------|
| `slug` | yes | names the outputs: `edl/<slug>_<cut>.json`, `song/<slug>_<cut>.wav` |
| `title` | no | shown on contact sheets; `(<cut> cut)` is appended |
| `song` | yes | the full track, e.g. `song/<slug>_full.wav` (mp3 works) |
| `beatmap` | yes | from `tools/beatgrid.py` |
| `catalog` | yes | from `tools/scenes.py split`, filled in; its `source` is the pack video |
| `grade` | no | default colour grade (`teal_orange`; also `warm`, `cold`, `bw`, `blaugrana`, `gold`, `none`) |
| `gain_db` | no | soundtrack gain, default 1.0 (the Suno masters sat around -15 LUFS) |
| `audio_delay` | no | shift the whole soundtrack later (s); prefer per-segment `nudge` |
| `cuts` | yes | `{ "<cut name>": cut, ... }`, e.g. `short`, `main` |

## A cut

| key | meaning |
|-----|---------|
| `segments` | list, played in order and spliced on bar lines (see below) |
| `captions` | sung lines as overlays: `{"bar": 16.5, "beats": 2, "content": "settle down, babe", "style": "whisper", "pos": "lower"}`; `bar` is the position **in the edit** (bars from its start, fractions allowed) |
| `end_title` | big title on the last shot, e.g. the player's name |
| `fade_out` | audio fade at the end in seconds (default 0: cuts that loop shouldn't fade) |

## A segment

| key | meaning |
|-----|---------|
| `name` | unique within the cut; also the EDL `section` (used by `qa.py sync`) |
| `from_bar`, `bars` | which bars of the **song** (beat map numbering, bar 0 = first downbeat) |
| `pace` | `calm`, `verse`, `build`, `drop`, `breakdown`, `bridge`, `end` (see edit-grammar.md) |
| `pattern` | optional: beats per shot, must sum to `bars * 4`, e.g. `[2, 2, 1, 1, 0.5, 0.5, 1]` |
| `cast` | optional: scene ids, one per shot in order; shorter lists are filled by auto-cast |
| `text` | optional: shot captions, `{"beat": 0, "content": "RAIN ON ME", "style": "lyric", "pos": "center", "in": 0.0}`; `beat` = beat within the segment where the shot starts |
| `nudge` | optional: seconds to shift this segment's piece of song (negative = take it earlier in the song, so its beats land later in the edit). Use the value `qa.py sync` suggests. |

Contiguous segments (one ends on the bar the next starts, same nudge) are merged into a
single piece of audio, so they play with no splice.

## Where the cuts land

Shot boundaries fall on the beat grid of the edit: shot start = (beats so far) x beat length,
starting at 0 = the first segment's bar line. Because every segment starts on a bar line in the
song, the song's beats stay on that grid across splices. `qa.py sync` measures it.

## Auto-cast

Shots a segment doesn't name are chosen from the catalogue by mood, taking the pace's moods
in turn (drop: celebration, action, celebration...) and the least-used shot of that mood, never
the same shot twice in a row. Use it for the bulk; name the shots that carry meaning (the
drop's first downbeat, lyric lines, the end card).

## Example (from `plans/yamaldemo.json`, the short cut)

```json
{
 "slug": "yamaldemo",
 "title": "Lamine Yamal — I Feel It Coming (plan demo)",
 "song": "song/edit_story.wav",
 "beatmap": "analysis/yamaldemo_beatmap.json",
 "catalog": "research/scenepack.json",
 "cuts": {
  "short": {
   "segments": [
    {"name": "intro",  "from_bar": 0,  "bars": 2, "pace": "calm",  "cast": ["S01", "S13"],
     "text": [{"beat": 4, "content": "so damn close", "style": "lyric"}]},
    {"name": "verse",  "from_bar": 2,  "bars": 2, "pace": "verse"},
    {"name": "build",  "from_bar": 24, "bars": 2, "pace": "build", "cast": ["S40", "S31", "S14"], "nudge": -0.06},
    {"name": "climax", "from_bar": 26, "bars": 7, "pace": "drop",  "cast": ["S21", "S16", "S09"], "nudge": -0.06},
    {"name": "end",    "from_bar": 33, "bars": 1, "pace": "end",   "cast": ["S44"], "nudge": -0.06}
   ],
   "end_title": "LAMINE YAMAL"
  }
 }
}
```

14 bars at 112 BPM = 30.0 s: an intro, a short verse, then the song jumps forward to the
build and climax, and ends on the 304 sign. `--slots` shows 4 + 5 + 6 + 27 + 1 = 43 shots.

## The catalogue (`research/<slug>_scenes.json`)

```json
{
 "source": "sources/<slug>.mp4", "fps": 30.0, "size": [640, 360], "duration": 164.49,
 "slowmo_source": true,
 "scenes": {
  "S01": {"start": 4.9, "end": 8.2, "kind": "arrival", "fit": "crop", "focus_x": 0.51, "desc": "tunnel walk-in"},
  "S05": {"start": 17.6, "end": 20.6, "kind": "action", "fit": "blurfill", "desc": "dribble v Newcastle"},
  "S08": {"start": 27.13, "end": 30.2, "kind": "closeup", "fit": "crop",
          "focus_track": [[27.2, 0.45], [30.1, 0.59]], "desc": "by the goal net, walks right"},
  "S00": {"start": 0.0, "end": 4.9, "kind": "skip", "desc": "channel title card"}
 }
}
```

`start`/`end` come from `scenes.py split`; shorten `end` (or raise `start`) to keep the planner
away from unusable frames.
