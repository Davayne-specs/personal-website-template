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
| `ransom`  | punk ransom note: every letter cut from a different font on paper scraps |
| `typewriter` | monospace, typed out letter by letter with a blinking cursor (`"cps"`: chars/second; default spreads over the text's time) |
| `glitchtext` | huge heavy text with RGB-split copies and displaced slices      |
| `stamp`   | red rubber stamp: rotated, distressed, in a rough box              |

## grades

`teal_orange`, `warm`, `cold`, `bw`, `blaugrana` (red/blue tint), `gold` (trophy
moments), `none`.

## Punk / emo / experimental pack

All optional. Old EDLs render exactly as before.

### More fx

| name | effect |
|------|--------|
| `vhs` | camcorder tape: chroma smear, scanlines, softness, noise, warm cast, rolling tracking band |
| `rec` | camcorder HUD: blinking ● REC, running timecode, date (`meta.rec_date`), battery |
| `xerox` | photocopy zine: grayscale, crushed contrast, toner speckle, paper-white highlights |
| `posterize` | 3–5 level colour reduction (`"posterize": {"levels": 4}`) |
| `invert` / `invert_flash` | negative for the whole shot / for the first 2 frames |
| `strobe` | alternate frames: `"strobe": {"every": 2, "mode": "invert" \| "black" \| "white"}` |
| `stutter` | re-trigger the opening: `"stutter": {"len": 0.134, "repeats": 3}` |
| `reverse` | play the source span backwards |
| `echo` | ghost trails (slow, dreamy) |
| `glitch` | slice displacement + RGB jitter + block bands; burst at the start, or `"glitch": {"whole": true, "amount": 0.7}` |
| `step` | step-printing judder: `"step": {"fps": 12}` |
| `light_leak` | drifting warm light leaks / film burn |
| `letterbox` | black bars that slam in over 3 frames |
| `whip_in` / `whip_out` | whip-pan blur + slide over the first / last 4 frames |
| `shake_hard` | heavy shake (for the drop) |
| `flash_red` / `flash_black` | red flash / hard black frame, fading in |
| `freeze` | hold one frame: `"freeze": {"at": 0.0}` (seconds into the source span) |
| `zoom_blur` | radial zoom-blur punch on the first frames |

Giving a settings key (`strobe`, `stutter`, `glitch`, `step`, `freeze`, `posterize`) also
switches that fx on.

### Zoom

- `"zoom": {"from": 1.18, "to": 1.0, "ease": "snap"}` — punch that settles (eases: `in_out`,
  `linear`, `in`, `out`, `snap`).
- `"pulse": {"every": 0.5053, "amount": 0.055, "phase": 0.0, "decay": 7}` — zoom bounce every
  `every` seconds starting `phase` seconds into the shot, decaying exponentially; multiplies with
  `zoom`. `"anchor": "edit"` measures phase from the start of the edit instead of the shot.
  In cut sheets, `"every": "beat" | "half" | "bar"` is resolved and phase-locked to the song's
  grid by `tools/build_edl.py`.

### Layouts

`"layout": "split2" | "triptych" | "grid4"` stacks 2 / 3 panels or a 2x2 grid on
`"layout_bg"` (default black) with `"layout_gap"` px gaps. `"panels"` is a list of
`{clip, in, speed, delay, grade, fx, focus_x}`; missing fields inherit from the shot. Without
`panels` every panel shows the shot's clip, delayed 0 / 0.1 / 0.2 s (the classic delayed
stack). Shot-level fx/grade/text apply to the composed frame. In cut sheets a panel may name a
moment instead: `{"m": "P07", "hit": 1.5}`.
