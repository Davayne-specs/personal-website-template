# Lamine Yamal TikTok edits

Two edits live here:

- **Spot Valley Road 50** (Success Farm / Mbastein): a 2:00 emo/punk edit, cut from the
  18 shots of a Lamine Yamal scenepack preview. See [the section below](#spot-valley-road-50).
- **I Feel It Coming** (Mbastein): the Ballon d'Or case edit (story 1:13, short 0:30).

# I Feel It Coming (Mbastein)

A beat-synced TikTok edit that argues Lamine Yamal's 2026 Ballon d'Or case
(ceremony: Mon 26 Oct 2026, London Palladium), cut to Mbastein's "I Feel It Coming".

Two cuts share one shot language:

| Cut | Length | Audio | For |
|-----|--------|-------|-----|
| **story** | 73.5 s | drop-out → verse → chorus → bridge → build → climax | the main post: over 60 s (Creator Rewards eligible), tells the whole arc |
| **short** | 30.7 s | drop-out → 2 bars of goals → build → climax | reach: 14 bars, loops cleanly |

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
| `render.py` | EDL → 1080x1920 MP4 (see `EDL_SCHEMA.md`) |
| `song/`, `clips/`, `out/` | local media, never committed |

# Spot Valley Road 50

A 2:00 cut covering every section of the song, with the repeats trimmed. The looks
come from emo, punk and experimental video, and each one is tied to a lyric or a change
in the music:

| Edit | Song | Look |
|------|------|------|
| 0:00 | "Yo— let's go" | photocopied freeze of LAMINE YAMAL 19, ransom-note hook *THEY KEEP CALLING HIS NAME*, then the tape starts rolling |
| 0:03 | "What do you know / you calling my name" | camcorder (VHS + ● REC HUD), zoom bouncing on every beat, ransom-note lyrics |
| 0:09 | "You must got a secret / you must know my pain" | colour, step-printed runs, a cut a beat; his smile photocopied for *secret*, the anthem face letterboxed for *PAIN* |
| 0:19 | "Oh, you figured it out" | the goals: zoom-blur strike, stuttered net, delayed triptych celebration |
| 0:29 | "Don't run, child / it's all repeater" | breakdown: letterbox, trails, reverse; the clap stuttered and stacked three times on *repeater* |
| 0:33 | "You've seen the demons already" | strobe, glitch, a photocopied 2x2 wall of faces |
| 0:50 | "I wanna call police / someone who knows me" | back on the camcorder; Pedri, the coach, the bench — people who know him |
| 0:58 | "Wake up screaming / I'm fighting everyone" | cuts double every bar into a half-beat strobe flurry… |
| 1:06 | "No one is there" + the whispered bridge | …then alone in the tunnel: one slow shot a bar, echo trails, light leaks, typewriter lyrics |
| 1:20 | "I gotta fight — FOR ME!" | the silence frozen and creeping in, then the drop: red flash, zoom blur, heavy shake |
| 1:22 | "It's just not fair / it hurts ever so bad" | the loudest section: beat-locked zoom pulses, goal triptych, step-printed runs, the scream on a strobe |
| 1:36 | "Cold sweat, cold sweat, cold—" | a photocopied face on every "cold" |
| 1:45 | "I feel amazing / calm out" | warmth at last: light leaks, glow, his smile and the bench laugh; then the tape rewinds |
| 1:52 | instrumental finale | everything on the grid, ending on the same photocopied name it opened with (it loops) |

## Real quality: swap in the 4K scenepack

The footage in `clips/v2/` was cut from a YouTube **preview** of the "Lamine Yamal
scenepack 4K 2026 (made by Timo)": each shot is only 148×186 pixels. Rendering locally
gives a clean 1080×1920 encode, but it can't add detail that isn't in the source. For real
quality, download the full pack (the link is in that video's first comment), then:

```bash
python tools/match_clips.py /path/to/the/scenepack     # finds each P## in the pack → clips/v2_hq/
# check out/match_report.md and out/match_contact.jpg, then in tools/cuts_spot_valley.py set
#   "clips_dir": "clips/v2_hq"
python tools/build_edl.py cuts_spot_valley
python render.py edl/spot_valley.json                  # → out/spot_valley.mp4, 1080x1920
```

The matcher lines each 4K clip up to the preview's first frame, so every cut, hit and effect
stays exactly where it is. Shots it can't find stay on the preview version.
On a synthetic test pack (renamed files, mixed resolutions and frame rates, colour shifts,
decoys) it found 15 of 16 planted shots at the exact frame, ignored every decoy, and
reported the unplanted shots as missing instead of guessing (~21 s of matching per minute of
4K footage). The one miss was a 9:16 clip shown pillarboxed over a blurred copy of itself,
a framing this preview doesn't use.

## Render it yourself

```bash
cp "Success Farm - Spot Valley Road 50.mp3" song/spot_valley_road.mp3
python tools/make_audio.py edl/spot_valley.json   # or use the song/edit_spot_valley.wav you were sent
python render.py edl/spot_valley.json --check
python render.py edl/spot_valley.json             # full quality
```

The soundtrack splices need the vocal/instrumental stems
(`python tools/analyze_song.py song/spot_valley_road.mp3 analysis/raw_spot_valley_road.json --models <models>`);
without them, use the `edit_spot_valley.wav` file you were sent.

To change the edit, edit `tools/cuts_spot_valley.py` and run
`python tools/build_edl.py cuts_spot_valley`. Every shot is listed in
[`SHOTLIST_spot_valley.md`](SHOTLIST_spot_valley.md).
