# Lamine Yamal — "I Feel It Coming" (Mbastein)

A beat-synced TikTok edit that argues Lamine Yamal's 2026 Ballon d'Or case
(ceremony: Mon 26 Oct 2026, London Palladium), cut to Mbastein's "I Feel It Coming".

Two cuts share one shot language:

| Cut | Length | Audio | For |
|-----|--------|-------|-----|
| **story** | 73.5 s | drop-out → verse → chorus → bridge → build → climax | the main post: over 60 s (Creator Rewards eligible), tells the whole arc |
| **short** | 30.7 s | drop-out → 2 bars of goals → build → climax | reach: 14 bars, loops cleanly |

## Next song

The workflow is a Claude skill: `.claude/skills/scenepack-edit/SKILL.md` (send Claude the song and
a low-quality copy of the scene pack; it plans, splices the song and previews; you render the 4K
version here). The generic tools it drives:

```bash
python tools/beatgrid.py song/<slug>_full.wav --out analysis/<slug>_beatmap.json   # beat map
python tools/scenes.py split sources/<slug>.mp4 --catalog research/<slug>_scenes.json --sheets out/<slug>_sheets
python tools/plan_edit.py plans/<slug>.json --audio                                # EDLs + soundtracks
python tools/qa.py sync edl/<slug>_short.json                                      # beats vs cuts
python tools/scenes.py verify sources/<slug>.mp4 --catalog research/<slug>_scenes.json   # 4K copy matches?
python render.py edl/<slug>_short.json --contact-sheet                             # final render
```

`plans/yamaldemo.json` is a worked example on the Yamal pack.

## Scene-pack edit (current)

The footage plan below was dropped: the clips could not be downloaded. Instead,
`tools/scenepack_edl.py` cuts one uploaded scene pack (`sources/scenepack.mp4`,
640x360, not committed) to the song, reusing the beat-grid timing, effects and
sung lyric captions of the story and short cuts:

```bash
python tools/scenepack_edl.py                   # edl/sp_story.json + edl/sp_short.json
python render.py edl/sp_story.json --contact-sheet   # out/sp_story.mp4 (73.5 s)
python render.py edl/sp_short.json --contact-sheet   # out/sp_short.mp4 (30.7 s)
```

- `research/scenepack.json`: the pack's 46 shots (split at detected cuts), each
  with a mood (arrival, close-up, action, celebration, sad), and either a crop
  position for Yamal (`focus_x`, or `focus_track` when he moves) or `blurfill`
  for wide dribbles, where a 9:16 crop would lose the ball.
- `CAST` in `tools/scenepack_edl.py` says which shot goes in each section:
  arrivals and close-ups in the intro, dribbles as the verse tightens,
  celebrations on the chorus hooks, the dejected shots in the black-and-white
  drop and the bridge (matched line by line to the lyrics), the best moments one
  per beat in the climax, and the 304 sign on the end card.
- In-points follow the footage's motion; the Twixtor source is never slowed
  below 1x, and is sped to 1.5x or ramped 2x→1x in the chorus and climax.

## The story, mapped to the song

| Edit time | Song section (lyric) | What we see |
|-----------|----------------------|-------------|
| 0:00 | drop-out — *"Yeah, it's so damn close"* | Ballon d'Or 2025: **2ND IN 2025.** Yamal applauding Dembélé, the Kopa grin, the stare |
| 0:04 | verse — *"Hey, I feel it coming"* ×4 | the 2025-26 season goal by goal; cuts tighten from every 2 beats to every half-beat |
| 0:17 | chorus — *"Rain on me"* | confetti on the World Cup, the scissor-kick **in the hail**, LaLiga champions; skills on *"Don't tell me stop"* |
| 0:32 | drop-out — *"Fighting my whole life, I'm still defeated"* | black and white: out of the Champions League to Atlético, the hamstring at Celta |
| 0:34 | bridge — *"Settle down, babe / my child"* | the 2007 photo of Messi bathing baby Lamine → his brother Keyne running into his arms at the World Cup final |
| 0:39 | *"You worry too much"* | the hamstring, two months out, back off the bench |
| 0:41 | *"You try to fight the whole crowd"* | Sevilla's boos and his "more… more" |
| 0:43 | *"Just run at your pace"* | a slow-motion solo run |
| 0:45 | *"Don't think about them"* | "I won't beg for anything" |
| 0:48 | *"They're running at the stars in the sky…"* | Messi's embrace at the final whistle |
| 0:50 | *"…they can catch them"* | hands on the World Cup |
| 0:51 | break — *"Hey, I feel it coming"* | the case, as cards: **WORLD CHAMPION AT 19 · LALIGA CHAMPION, PLAYER OF THE SEASON** |
| 0:56 | climax | one cut per beat: the best goals, **24 GOALS · 17 ASSISTS**, **FIRST TEENAGER EVER: EUROS + WORLD CUP**, trophies, 304 |
| 1:11 | *"Hey, I feel it coming"* | back to the golden ball: **26.10 · LONDON** (loops into the first frame) |

## How to finish it

You need the footage; this environment couldn't download any (its network
policy blocks YouTube, TikTok and other video sites).

1. **Collect the clips** listed in [`CLIPS.md`](CLIPS.md) into `clips/`, named
   by id (`c02.mp4`, `n27.mp4`, `n01.jpg`, …). Trim each to ~8 s with the key
   action exactly **3.0 s** in (or set `hit` in `research/moments.json`).
   `tools/fetch_clips.py` does this from the YouTube links in
   `research/youtube_links.json` (needs ffmpeg, `pip install "yt-dlp[default]"`,
   and deno or Node.js):
   ```bash
   python tools/fetch_clips.py            # whole videos → sources/<id>.mp4
   # find each key action, put its second in "at" in research/youtube_links.json, then:
   python tools/fetch_clips.py            # 8 s around it → clips/<id>.mp4
   ```
   It logs the title and channel of everything it downloads in
   `research/sources_used.json`. `n01` is a photo: save it as `clips/n01.jpg` by hand.
2. **Render** (Python 3, ffmpeg, `pip install numpy pillow soundfile`):
   ```bash
   cp /path/to/Mbastein_-_I_feel_it_coming.mp3 song/song.mp3
   python tools/make_audio.py edl/story.json     # builds song/edit_story.wav
   python render.py edl/story.json --check        # what's missing
   python render.py edl/story.json --preview      # fast 540x960 draft
   python render.py edl/story.json                # final 1080x1920 → out/story.mp4
   ```
   Missing clips render as title cards, so you can render any time.
3. **Or edit by hand** in CapCut using [`SHOTLIST.md`](SHOTLIST.md) (every cut
   with timestamps, in-points, speed, text and effects) over `song/edit_story.wav`.

To change the edit, edit `tools/cuts.py` (shots in bar.beat time) and run
`python tools/build_edl.py` — it regenerates `edl/*.json`, `CLIPS.md` and `SHOTLIST.md`.

`tools/make_audio.py` uses the vocal/instrumental stems in `song/stems/` when
present, so splices are cut on the beat without chopping words. Without
stems it crossfades the full mix (still on the beat, but vocal tails at the
splices may clip).

## Before you post

- **Check every on-screen number** against FBref / Transfermarkt / ballondor.com.
  The research tools could only read search summaries, not the pages. Most
  uncertain: **24 GOALS · 17 ASSISTS** (club, all competitions, from per-competition
  splits LaLiga 16+11, UCL 6+4, Copa 2+2; some outlets give 12 LaLiga assists).
- **Don't use**: "Best Young Player" (Cubarsí won it), "scored vs France" (offside),
  "youngest Spanish World Cup scorer" (Gavi was younger), or any claim he has
  already won the 2026 award — the ceremony is 26 Oct.
- **Music rights**: the track is Suno-made. Commercial use and monetisation need
  it to have been generated on a paid Suno plan. Distribute it (e.g. via a
  distributor or SoundOn) so the TikTok sound is credited to Mbastein.
- **Footage**: broadcast clips are copyrighted; TikTok may mute or remove them.
  Use your own audio (you are), keep clips short and transformed (crop, grade,
  text), and post privately first to see if it's flagged. See
  `research/edit-craft.md` §4.
- **Timing** (from `research/edit-craft.md` §5): teaser Sun 11 Oct, main edit
  Thu 22 Oct 18:00–19:30 CET, El Clásico Sun 25 Oct, ceremony Mon 26 Oct 20:00 UK.

## Files

| Path | What |
|------|------|
| `analysis/beatmap.json` | 112.02 BPM grid, bars, sections, every lyric line timed (song seconds) |
| `research/` | club season, Spain + narrative, edit craft, and the merged clip catalogue |
| `tools/cuts.py` | the cut sheets (edit this) |
| `tools/build_edl.py` | turns cut sheets into EDLs + CLIPS.md + SHOTLIST.md |
| `tools/make_audio.py` | builds each cut's soundtrack from bar-aligned song pieces |
| `tools/fetch_clips.py` | downloads the footage in `research/youtube_links.json` |
| `render.py` | EDL → 1080x1920 MP4 (see `EDL_SCHEMA.md`) |
| `tools/scenepack_edl.py` | casts the scene pack into the story/short cut grid (this song) |
| `tools/beatgrid.py` | song -> beat map (tempo, bar lines, sections) |
| `tools/scenes.py` | scene pack -> shots, contact sheets, position strips; verifies a 4K copy |
| `tools/plan_edit.py` | plan file -> spliced soundtrack + EDL for any song |
| `tools/qa.py` | sync per section, tempo drift, crop check sheet |
| `tools/editlib.py` | helpers shared by the tools above |
| `plans/` | edit plans, one per song |
| `research/scenepack.json` | the scene pack's shots: times, mood, crop position |
| `song/`, `clips/`, `sources/`, `out/` | local media, never committed |
