# Edit Decision List (EDL) schema

`render.py` turns one EDL JSON file into a vertical TikTok video. Times are in
seconds. Shot `start`/`end` are on the **output timeline** (0 = first frame of
the edit), which maps to the song at `meta.song_start + t`.

```jsonc
{
  "meta": {
    "title": "Lamine Yamal — I Feel It Coming",
    "song": "song/song.mp3",        // path relative to the EDL's project root
    "song_start": 0.0,              // where in the song the edit begins
    "song_end": 60.0,               // where it ends (audio is trimmed + faded)
    "fade_out": 1.2,                // audio fade-out length at the end
    "fps": 30,
    "width": 1080,
    "height": 1920,
    "default_grade": "teal_orange",
    "safe_zone": { "top": 160, "bottom": 420, "right": 140 }   // TikTok UI margins (px at 1080x1920)
  },
  "shots": [
    {
      "id": "s01",
      "start": 0.00,
      "end": 1.07,
      "section": "intro",                  // informational
      "moment": "m03",                     // id into research/moments.json (informational)
      "clip": "clips/m03.mp4",             // missing file => placeholder card is rendered
      "in": 12.4,                          // source in-point (s)
      "speed": 1.0,                        // 0.5 = half-speed slow-mo; source span = (end-start)*speed
      "ramp": { "from": 1.0, "to": 0.35, "at": 0.55 },   // optional: speed changes from→to at fraction `at` of the shot
      "focus_x": 0.5,                      // 0..1 horizontal crop centre for 16:9 → 9:16
      "focus_y": 0.5,                      // 0..1 vertical centre (used when zoomed)
      "fit": "crop",                       // "crop" (fill frame) | "blurfill" (fit width over blurred copy)
      "zoom": { "from": 1.0, "to": 1.12 }, // scale over the shot (punch-in / Ken Burns)
      "fx": ["flash_in", "shake"],         // see list below
      "grade": "teal_orange",              // overrides meta.default_grade
      "text": {
        "content": "I FEEL IT COMING",
        "style": "lyric",                  // lyric | stat | title | kicker | quote | whisper
        "pos": "center",                   // upper | center | lower (all respect safe_zone)
        "in": 0.0,                         // seconds into the shot the text appears
        "out": null                        // seconds into the shot it disappears (null = shot end)
      },
      "placeholder": {                     // used when `clip` is missing (animatic preview)
        "title": "EL CLÁSICO SOLO GOAL",
        "sub": "LaLiga · Bernabéu · 2025-26",
        "hint": "Search: 'FC Barcelona highlights ...'",
        "color": "#a50044"
      }
    }
  ],
  "overlays": [                            // optional global text on absolute timeline times
    { "start": 0.0, "end": 3.0, "content": "BALLON D'OR 2026", "style": "kicker", "pos": "upper" }
  ]
}
```

## fx

| name        | effect                                                        |
|-------------|---------------------------------------------------------------|
| `flash_in`  | white flash on the first ~3 frames, fading out                |
| `flash_out` | white flash on the last ~3 frames                             |
| `shake`     | camera-shake jitter for the first ~0.35s (beat hit)           |
| `bw`        | black and white                                               |
| `rgb_split` | chromatic aberration (RGB channel offset)                     |
| `glow`      | soft bloom                                                    |
| `vignette`  | darkened edges                                                |
| `grain`     | film grain                                                    |
| `fade_in`   | fade from black over ~0.4s                                    |
| `fade_out`  | fade to black over ~0.4s                                      |
| `dip_white` | fade to white over the last ~0.25s (into a drop)              |

## text styles

| style     | look                                                              |
|-----------|-------------------------------------------------------------------|
| `lyric`   | big bold ALL CAPS, for hype lines                                 |
| `whisper` | as written, light weight, letter-spaced — soft lyrics in slow parts |
| `stat`    | big number line + small label line (split with `\n`), gold accent |
| `title`   | very large, tight                                                 |
| `kicker`  | small caps label in a pill                                        |
| `quote`   | italic, in quotation marks                                        |

## grades

`teal_orange`, `warm`, `cold`, `bw`, `blaugrana` (red/blue tint), `gold` (trophy
moments), `none`.
