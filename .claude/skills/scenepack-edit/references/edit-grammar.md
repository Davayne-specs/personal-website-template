# Edit grammar: how these edits are put together

Distilled from the Lamine Yamal / "I Feel It Coming" edit the user signed off. Treat it as
defaults with reasons, not rules: a different song or pack can want something else.

## Contents
1. Shape of the two cuts
2. Re-arranging the song to fit
3. Pace by section
4. Casting by mood
5. Effects, grades, speed
6. Text
7. Framing (crop vs blurfill)

## 1. Shape of the two cuts

- **Short (25-35 s)**: hook in the first second (an arrival or a stare, flash-in), a short verse,
  a 2-bar build, the drop by ~10-13 s, end card. Built to loop: the last shot should flow back
  into the first, so don't fade the audio.
- **Main (60-75 s)**: the whole arc. Intro, verse that tightens, chorus/drop, a breakdown or
  bridge for contrast (the emotional low point, black and white), build, climax, end card.
  Over 60 s qualifies for TikTok Creator Rewards.
- The single strongest clip (the knee slide, the stunner, the trophy) goes on the **first
  downbeat of the drop**. The second-strongest closes the climax or is the end card.

## 2. Re-arranging the song to fit

The song is cut into bar ranges and re-joined (`segments`). Good splices are inaudible:

- Cut on **phrase** boundaries (multiples of 4 or 8 bars from a section start), not just any
  bar line. A splice from the end of one phrase into the start of another sounds intended.
- Keep words whole. If the lyrics are known, check a segment doesn't start or end mid-line;
  a vocal pickup before a bar line gets clipped. Move the boundary a phrase earlier or later.
  With stems (`song/stems/vocals.wav` + `instrumental.wav` in the plan's audio plan),
  `make_audio.py` can let a word ring across a splice (see its docstring).
- Jumping forward is fine (intro -> pre-chorus -> drop); jumping **back** to an earlier, calmer
  section after the drop usually deflates the edit unless it's the deliberate breakdown.
- Prefer contiguous runs: the planner merges back-to-back segments into one unspliced piece.
- End on a bar line where the next bar would be the song's downbeat feel, so the loop lands.
- After building, `qa.py sync` per section; nudge the pieces that land early/late.

Typical short at ~110-130 BPM: `intro 2 bars + verse 2 + build 2 + drop 7 + end 1` = 14 bars.

## 3. Pace by section

| pace | grid (beats per shot) | effects | use for |
|------|-----------------------|---------|---------|
| `calm` | 2 | slow push-in, cold grade | intros, quiet verses, a lift after the bridge |
| `verse` | 2 for the first 2/3, then 1, then 1/2 for the last 1/12 | flash on alternate bar lines, shake on snares when cuts are short | verses that should build |
| `build` | 2,2,2... then 1, then 1/2,1/2 (2 bars: 2,2,2,1,1/2,1/2) | white dip into the drop | pre-chorus, risers, "break / build" |
| `drop` | per 2 bars: 2,1,1 then 1,1,1,1/2,1/2 (~4 cuts a bar) | flash on every bar line, shake on beats 2 and 4, speed ramp on the first shot, warm grade on celebrations | chorus, drop, climax |
| `breakdown` | 2 | black and white, vignette | drop-outs, the low point |
| `bridge` | 4,4, then 2s, then 4 | glow / grain alternating, cold | bridges, slow emotional lines |
| `end` | one held shot | flash, glow, gold, title, zoom out | the last bar(s) |

At slower tempos (<90 BPM) halve the density (`pattern` with longer shots); at faster tempos
(>140 BPM) the drop's half-beat doubles get frantic: use `pattern` with 1s and 2s.

## 4. Casting by mood

Catalogue kinds: `arrival` (tunnels, bus, walkouts), `closeup` (faces, warm-ups),
`action` (dribbles, skills, goals), `celebration`, `sad` (dejected, injury, arguing), `skip`.

- **Intro**: arrivals and close-ups. Mood before motion.
- **Verse**: close-ups first, action as the cuts tighten (the auto-cast does this naturally).
- **Build**: arrivals and walkouts again, rising: tunnel, bus, line-up.
- **Drop / climax**: alternate celebration and action so every beat changes energy. Best
  moments on downbeats and lyric hooks. Repeat the best shots in the climax, but different
  parts of them (the in-point picker prefers unused stretches).
- **Breakdown / bridge**: match the lyric line literally where you can. It's the part viewers
  remember: "you try to fight the whole crowd" over fingers-in-ears at the stands, "settle
  down" over him sitting by the corner flag, "they can catch them" into a smile.
- **End card**: the iconic gesture (the 304 sign), name title, hold.

In-points are chosen automatically: action and celebration shots take their busiest stretch,
calmer ones the middle. To force a moment, edit `in` in the EDL after building (it's
overwritten on the next build), or trim the scene in the catalogue.

## 5. Effects, grades, speed

- `flash_in` on bar lines (the 1), `shake` on the snare beats (2 and 4), `dip_white` on the
  last shot into a drop or build, `glow`/`grain` in slow sections, `vignette` with black and white.
  `rgb_split` is loud: one or two hits per edit at most.
- Grades: `teal_orange` default, `warm` celebrations, `cold` intro/bridge, `bw` breakdown,
  `gold` end card. A whole-edit look is a plan-level `grade`.
- Speed: Twixtor / slow-mo packs never below 1x (repeated frames stutter); 1.5x reads close to
  real time; ramps 2x -> 1x land a hit. Real-time footage stays 1x, with a gentle ramp to 0.7x
  on the drop's first shot.

## 6. Text

- Only sung lines and a name. `lyric` style (big caps) for hooks on the drop, `whisper`
  (light, lower third) for soft lines in the bridge.
- No stats or claims unless the user supplies and stands behind them (the first project had
  to drop an unverifiable "24 goals" card).
- Keep text inside the safe zone (the renderer does; don't override `pos` to fight it).

## 7. Framing (crop vs blurfill)

- `crop` (full-screen 9:16 window centred on `focus_x`) for faces, celebrations, walk-ins:
  anything where the person is the picture.
- `blurfill` (whole 16:9 frame over a blurred copy) for wide action where the ball, the
  defender and the space matter. A 9:16 crop of a dribble loses all three.
- Moving subjects get a `focus_track`; the crop is fixed per shot at the subject's position in
  the middle of the shot's source window, so very long shots of a moving subject may still
  drift: prefer shorter shots there.
