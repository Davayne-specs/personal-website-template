# Edit-craft and sourcing brief: "I Feel It Coming" Lamine Yamal TikTok edit

Prepared 2026-10-01. Ceremony: Mon 26 Oct 2026, London Palladium, 20:00 UK time (21:00 Spain).

**How to read this file**
- `[S]` means the claim comes from a source listed at the bottom.
- `[C]` means a craft recommendation or starting value from standard editing practice. It is not from a single source. Treat it as a tunable default.
- **Evidence limits.** In this environment WebFetch was egress-blocked for every domain I tried: youtube, tiktok, cadenus, fluxnote, creamate, checksafe.zone, tiktok support and legal. All findings therefore come from WebSearch result summaries only. No YouTube or TikTok page was opened.
- Every YouTube URL in section 3 is **unverified**: title and URL come from search results, but nobody has opened it.
- Many "how to go viral" guides are SEO blogs. Their numbers are directional, not measured truth.

---

## 0. Cheat sheet (the numbers to put in code)

| Item | Value |
|---|---|
| Canvas | 1080x1920, 9:16 |
| Safe rect for ALL text and key faces | **x 60-940, y 130-1436** (880 x 1306 px). That means top 130, bottom 484, left 60, right 140. |
| Lighter alternative (some guides) | top 108, bottom 320, left 60, right 120, giving a 900x1492 rect. Do not rely on it for captions. |
| Length | **Master 30.0 s = 14 bars at 112 BPM**. Allowed range 21-34 s. Hard cap 38 s. |
| Beat (112 BPM) | 0.5357 s. Half-beat 0.2679 s. Quarter-beat 0.1339 s. Bar 2.1429 s. |
| Half-time pulse (56 BPM) | 1.0714 s. |
| Cut density | Hype/chorus 1 cut per beat (1.9 cuts/s) with half-beat fills. Bridge 1 cut per 2 beats to 1 per bar (0.5-0.9 cuts/s). Outro decelerates. |
| Whole 30 s cut | About 45-55 cuts, about 1.5-1.8 cuts/s average. |
| Hook | A visual event in frames 0-12, a text line of 6 words or fewer, and the first "hey" within 0.3 s. |
| Export | H.264 High, 1080x1920, 60 fps if the sources are 50/60p, otherwise 30 fps. 12 Mbps CBR/VBR, AAC 256 kbps. Use BT.709. |
| Upload | Enable "Allow high-quality uploads", use Wi-Fi, and post a private test first. |
| Post timing | Teaser Sun 11 Oct. Main edit Thu 22 Oct at 18:00-19:30 CET. Countdown Sat 24 Oct. Ceremony night: pre-rendered WIN, KOPA and LOSS variants. |
| Sound | Submit to SoundOn or a distributor **this week**. Fallback is "original sound". |

---

## 1. What makes football edits (and Yamal edits) travel on TikTok, 2025-26

### 1.1 Formats in circulation
- Velocity/hype edit `[S]`:
  - Speed ramps synced to beat drops, with a freeze-frame hook on the build-up.
  - Typically 15-30 s, 2-4 cuts/s `[C]`.
  - CapCut velocity templates are the on-ramp. Alight Motion or After Effects are used for finer shake, glow and grade.
- "Mila-style" Yamal phonk edit `[S]`:
  - Reverse-phonk audio, After Effects/CapCut transitions, heavy colour correction (CC).
  - Phonk-driven cuts.
  - Yamal-specific scenepacks are often labelled "CC / Twixtor / Topaz" for exactly this style.
- Emotional "journey" or story edit `[S]`:
  - Slow, cinematic, human moments.
  - The TikTok #footballemotions space and "some football moments become part of your story" copy.
  - The edit trend was still active as of 14 Sep 2026.
- Stat-overlay "case" or debate edit `[S]`:
  - GOAT debates, rankings and what-ifs reliably drive comments.
  - Strong opinion plus timely upload is rewarded.
  - Ballon d'Or "case for X" videos with stat overlays already exist for Yamal.
- Before/after (childhood to now) `[S]`:
  - "Evolution: then and now" Yamal clips exist.
  - The 2007 UNICEF baby photo with Messi went viral in 2024.
- Personality/off-pitch virality `[S]`:
  - The Copa del Rey "Shake Body" dance clip passed 180M views and 16M likes.
  - Lesson: off-pitch humanity travels, not only skill clips.
  - World Cup final coverage also highlighted brother Keyne "stealing the show".
- **Recommended hybrid for this project** `[C]`: an emotional case edit.
  - Hype chorus, then an emotional bridge, then 3-5 stat cards, then a loopable ending.
  - Sprinkle one before/after match-cut and one personality beat.

### 1.2 Length
- Platform data `[S]`:
  - TikTok Creator Center is quoted as favouring 21-34 s.
  - A 6M-video analysis shows engagement peaking for 15-30 s.
  - A common benchmark is 21 s at about 30 cuts/min, which is one cut every 1.9 s.
  - Viral completion bar is quoted as about 70%.
  - About 65% of viewers leave in the first 3 s.
- **Master cut: 30.0 s = 14 bars** `[C]`. This is exact at 112 BPM and keeps completion high.
- Also render:
  - An 8-10 s teaser/loop cut for seeding.
  - Optionally a 45-55 s "full" cut for YouTube Shorts or Reels. Do NOT use this as the TikTok master.

### 1.3 Beat and frame math (112 BPM, half-time 56 BPM)

| Unit | Seconds | Frames @30 | Frames @60 |
|---|---|---|---|
| 1/4 beat | 0.1339 | 4.02 | 8.04 |
| 1/2 beat | 0.2679 | 8.04 | 16.07 |
| 1 beat | 0.5357 | 16.07 | 32.14 |
| 1 bar (4 beats) | 2.1429 | 64.29 | 128.57 |
| Half-time beat | 1.0714 | 32.14 | 64.29 |
| 2 bars | 4.2857 | 128.6 | 257.1 |
| 4 bars | 8.5714 | 257.1 | 514.3 |
| 14 bars | 30.000 | 900 | 1800 |

- **Never** hard-code 16 frames per beat. The drift is 0.07 frame per beat, which is about 4 frames over 30 s.
- Compute `cut_frame = round((t0 + k * 60/BPM) * fps)`.
- Suno audio is not grid-locked. Detect real onsets and beats (for example librosa `beat_track` and `onset_detect`) and snap cuts to detected times. Verify the actual BPM and `t0` first.
- Place the visual impact frame (boot on ball, dribble touch, shirt flap) on the beat, or 0 to 2 frames early at 30 fps. This compensates for perceived audio latency `[C]`.

### 1.4 Cut density per section type `[C]`, anchored to `[S]` pacing (1.5-3 s per shot for general TikTok; football velocity edits run faster)

| Section | Shot length | Cuts/s | Notes |
|---|---|---|---|
| Hook (0-1.5 s) | 3 visual events: freeze, punch-in, flash | n/a | Events are not necessarily cuts. |
| Intro chant ("hey... I feel it coming") | 2 beats (1.07 s) | 0.93 | Last bar tightens to 1 per beat. Build tension. |
| Chorus "Rain on me" (hype) | 1 beat (0.536 s) | 1.87 | Add 1/2-beat fills (0.268 s, 3.7 cuts/s) on the last beat of bars 2 and 4. At most 3 consecutive fills. Average about 2.2 cuts/s. |
| Pre-drop / final-chorus lift | 1 beat, then 1/4-beat flurry (0.134 s = 4 frames @30) for at most 1 beat | peak 7.5 | Flurry only directly before the climax hit. |
| Bridge "Settle down, my child" (emotional) | 1 bar (2.14 s) or 2 beats (1.07 s) | 0.47-0.93 | Slow-mo 25-50%. Dissolves or dip-to-white of 6-12 frames. No shake. Fewer flashes. |
| Outro ("I feel it coming" x N) | 1 beat, then 2 beats, then 1 bar | falling | Decelerate to a final hold of 1.5-2.0 s on an iconic frame plus end text. |

Example 30 s map (14 bars) `[C]`. Re-time it to the actual song structure, because section order and lengths come from the real Suno track.

| Bars | Time (s) | Content | Approx. cuts |
|---|---|---|---|
| 1-2 | 0.00-4.29 | Hook then intro chant | 6 |
| 3-6 | 4.29-12.86 | Chorus A (hype) | 20 |
| 7-10 | 12.86-21.43 | Bridge (emotional, slow-mo) | 5-8 |
| 11-13 | 21.43-27.86 | Climax chorus with stat cards | 16-18 |
| 14 | 27.86-30.00 | Outro hold or loop | 2 |

That totals about 50 cuts.

### 1.5 Hook (first 1-2 s)
- Facts `[S]`:
  - About 65% of viewers leave in the first 3 s.
  - A freeze-frame with a quick zoom-in is a widely used visual hook in football edits.
- Recipe `[C]`:
  - Frame 0 is already a strong still, because it may be used as the cover.
  - Open on Yamal mid-action, not on black. No logo and no fade-in.
  - Place the first vocal "hey" at 0.0-0.3 s. Trim any dead air from the song's head.
  - Frames 6-12: freeze for 2-4 frames, punch-in 100% to 112%, 3-frame white flash.
  - Hook text of 6 words or fewer, upper-centre (about y 300-700), all caps.
  - Hook text pops at frame 3-6 with scale 0.85 to 1.08 to 1.00 over 6 frames.
  - Set a custom cover frame.
- First-frame hook-line options:
  - `HE'S 19. LOOK WHAT HE DID.`
  - `THE BALLON D'OR CASE: LAMINE YAMAL`
  - `OCT 26. REMEMBER THIS.`
  - `19. WORLD CHAMPION. ONLY ONE ASKED.`
  - `YOUNGEST EVER? I FEEL IT COMING.`
  - `KANE OR YAMAL? WATCH FIRST.`
  - `I FEEL IT COMING.` (quiet and song-led, works best with the loop trick in 1.10)
- A/B the hook with two teasers before the main post (see section 5).

### 1.6 Transition and motion recipes (frames at 30 fps; double them at 60 fps) `[C]`

| Effect | Spec |
|---|---|
| Flash | White overlay: 0 to 0.85 to 0 opacity over 3-6 frames, peak on the beat frame. Use on hype cuts, not every cut (about 1 in 3). |
| Zoom punch | Scale 100% to 108-115% over 4-6 frames with ease-out, settle back over 10-14 frames. Pair with a 1-2 frame shake. |
| Shake | Decaying random offset: 8-12 frames, amplitude 12-30 px at 1080 wide (1-3%), rotation +/-0.5-1.5 deg, add motion blur. Hit moments only. |
| Whip | 4-6 frame horizontal directional blur, offset 540-1080 px, hides the cut. |
| Speed ramp | 100% down to 15-25% over 6-10 frames before the key action, hold 0.4-1.0 s, back up to 150-300% over 6-8 frames after impact. |
| Freeze | 2-4 frames plus zoom and flash. Hook and pre-drop. |
| RGB split/glitch | 2-3 frames, max once per section. |
| Dissolve/dip-to-white | 6-12 frames. Bridge only. |

- Source guidance `[S]`: curve-speed ramps slow to 10-20% before the key moment, then accelerate to normal or above. Align ramp points with beat drops.
- A 60 fps source or optical-flow interpolation (Twixtor, Topaz or equivalent) is needed for clean slow-mo.
- Reframing math:
  - A 16:9 4K source (3840x2160) cropped to 9:16 is a 1215x2160 window.
  - That window holds 1080x1920 with 1.125x of free punch-in before any upscaling.
  - A 1080p source cropped to 9:16 is only 608x1080 and needs about 1.78x upscaling. It will look soft.
  - Prefer 4K sources, and use a keyframed tracking crop that follows Yamal.

### 1.7 Slow-mo usage
- Hype sections: slow-mo only as 15-25% ramp bottoms around the key action (above).
- Bridge: 25-50% speed on faces and celebrations, 2-4 s holds, no speed ramps.
- A slow-mo hold of 0.4-1.0 s on a single iconic touch is the usual emotional peak.
- Always use optical flow or 60 fps sources. Never use plain frame-blend on 25-30 fps clips.

### 1.8 Colour grade
- 2026 sports guidance `[S]`: slightly deeper shadows, warm highlights, controlled contrast, moderate saturation, soft film-style tones. Teal-orange is a mainstream cinematic look, and a soft "glow" is popular for emotional pieces.
- Recommended grade, applied with ONE LUT or one node chain over every clip so mixed sources match `[C]`:
  - Hype sections: contrast +10-20%, saturation +10-15%, shadows toward teal, highlights and skin warm, bloom 10-20%.
  - Bridge: saturation 75-85%, lifted blacks, warm skin, glow/bloom 20-30%, grain 8-15%, vignette 10-20%.
  - Keep Barca blaugrana and Spain red/gold slightly boosted. Use one accent colour only.
  - Use BT.709 and avoid clipped highlights, because TikTok re-encodes aggressively.

### 1.9 Text and caption style
- Sizes `[S]` plus `[C]`:
  - Caption guides suggest 55-75 pt at 1080x1920. Use this as the floor.
  - Hook text: 96-140 px.
  - Stat numbers: 160-220 px.
  - Labels: 56-72 px.
  - Never go below 48 px.
- Type look:
  - Hype/hook/stats: bold condensed sans in ALL CAPS (Anton, Bebas Neue, Oswald, League Gothic) or Montserrat ExtraBold for numbers.
  - Bridge/lyrics: sentence or lower case, lighter weight or a refined serif italic, tracking +20-40, small, centred, fade in and out.
  - White with a 3-6 px black stroke or soft shadow is the most universally readable `[S]`. All caps adds urgency, but long all-caps blocks are harder to read.
- Placement:
  - All text inside the safe rect.
  - Hook and top line at y 300-700.
  - Stat card number at y 420-760 with the label under it.
  - Lyrics at about y 900-1250, so they stay above the 1436 limit.
  - Keep line width at 880 px or less.
- Stat cards `[C]`:
  - One number plus a 2-4 word label.
  - On screen 0.7-1.1 s (21-33 frames @30).
  - Pop in on a beat: scale 0.85 to 1.08 to 1.0 over 6 frames, and hold.
  - Maximum 3-5 cards in the whole edit.
- Captions and on-screen text raise watch time (12-40%, SEO-blog figures) `[S]`.

### 1.10 Ending and loop tricks
- Rewatch, completion, shares and saves are the dominant 2026 ranking signals `[S]`. Loops are the cheapest rewatch lever.
- Technique `[S]` plus `[C]`:
  - Make the last frame visually match the first: same framing, same position, same text style.
  - End the audio on the same note or phrase the track starts on.
  - Hard-cut on a beat. Avoid a long reverb tail that exposes the loop point.
  - Hold the final frame for at most 1.0-1.5 s.
- Lyric loop idea (optional, check the stems):
  - Cut the final audio on `I feel it...` (before "coming") and start the video on a flash-cut `COMING.` with the downbeat.
  - If that does not fit the vocal, end on a clean "hey" that flows into the intro's "hey".
- Payoff delay: save the number or claim for the last 1.5-2 s. For example, reveal `YOUNGEST EVER?` at about 90% of runtime so viewers stay to the end.
- Debate close: a final card `KANE OR YAMAL?` in the safe area, upper-centre.

### 1.11 Fact bank for stat cards (verify each number before it appears on screen)
- Sources conflict in places (see the assists note below). Check ballondor.com, FBref or Transfermarkt before you render.
- Treat any claim that Yamal "has won" the 2026 Ballon d'Or as **false**. One search result (zonalsports.com "Exclusive") says so, but the ceremony has not happened and it looks unreliable. Never state a result before 26 Oct.
- Season context `[S]`:
  - 2025-26 La Liga: 16 goals and 11 assists (some outlets say 12), La Liga Player of the Season, Barcelona champions.
  - Champions League 2025-26: 6 goals and 4 assists in 10 matches.
  - Copa del Rey: 2 goals and 2 assists.
  - Hat-trick vs Villarreal on 28 Feb 2026 (4-1).
  - World Cup 2026 (July): Spain beat Argentina 1-0 after extra time, Ferran Torres scored. Yamal had 1 goal and a tournament-leading 35 completed dribbles. At 19 years 6 days he became the youngest player to win both the World Cup and the Euros.
  - 2025 Ballon d'Or runner-up. Kopa Trophy winner in 2024 and 2025, and a 2026 Kopa nominee.
  - September 2026: youngest to 50 Barcelona goals (19y 49d, Messi was 21y 120d). Youngest to 100 Barcelona goal contributions (19y 58d). Three braces in the first five La Liga games.
  - Spain 3-2 England at Wembley on 26 Sep 2026. Yamal scored inside two minutes, England's earliest goal conceded at Wembley in about 70 years.
- Race context (29 Sep 2026) `[S]`: Kane is the favourite (best about 5/4, shorter at some books). Yamal is the main challenger (best about 2/1). Do not imply he is the favourite.

---

## 2. TikTok technical specs

### 2.1 Video
- Resolution: **1080x1920, 9:16** `[S]`. TikTok's player is built for 1080p and will downscale 4K anyway.
  - 4K upload is allowed but gains nothing visible and files are 3-4x larger.
  - Edit in 4K if you like (for the free punch-in room in 1.6), but deliver 1080x1920.
- Frame rate `[S]`: accepted range is 23-60 fps. 30 fps is standard and "preferred". 60 fps looks smoother for fast sport and slow-mo.
  - Choice `[C]`: use 60 fps if most clips are native 50/60p (UK/EU broadcast is 50p, US World Cup feeds are 59.94). Otherwise use 30 fps.
  - Conform mixed-rate sources with proper frame-rate conversion, not duplicate frames.
- Codec and audio `[S]`: H.264 in MP4. AAC audio at 44.1 kHz (48 kHz is also accepted).
- Bitrate `[S]`: 8-12 Mbps at 1080p30, 12-16 Mbps at 1080p60.
- File size `[S]`: about 72 MB (Android) and 287.6 MB (iOS) in-app. The web uploader accepts up to 4 GB.
- Upload tips `[S]`:
  - Turn on "Allow high-quality uploads" (Post, then More options; or Profile, Settings and privacy, Content preferences). The app sometimes resets it, so check before posting.
  - Upload over Wi-Fi.
  - Upload from your own edited master, never from a re-downloaded TikTok or Reel.
- Example encode `[C]`:
  ```
  ffmpeg -i master.mov -c:v libx264 -profile:v high -pix_fmt yuv420p \
    -b:v 12M -maxrate 16M -bufsize 24M -r 60 \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
    -c:a aac -b:a 256k -ar 48000 -movflags +faststart out.mp4
  ```
  Use `-r 30 -b:v 10M` for the 30 fps variant.
- Loudness `[C]`: target about -14 LUFS integrated, true peak -1 dBTP or lower. Keep the vocal intelligible on phone speakers.

### 2.2 UI safe zones at 1080x1920
Two sets of numbers circulate. The first is from an SEO-guide template citing TikTok's own downloadable files. The second is more permissive. **Use the first set for all captions.**

| Edge | Conservative (use) | Lighter alternative |
|---|---|---|
| Top | **130 px** (Following/For You tabs, search) | 108 px |
| Bottom | **484 px** (username, caption, sound title, progress bar) | 320 px |
| Left | **44 px** (use 60 for margin) | 60 px |
| Right | **140 px** (avatar, like, comment, save, share) | 120 px |
| Safe rect | x 44-940, y 130-1436 (896 x 1306). **Code to x 60-940, y 130-1436.** | 900 x 1492 |

- The bottom boundary rises as the caption gets longer, so 484 px is a minimum `[S]`. Keep the post caption to 2 lines.
- The right-hand button stack sits mostly in the lower half of the frame `[C]`. I could not verify exact y-ranges, so keep the full 140 px margin for any text.
- Put important faces, text and stat cards in the safe rect. Backgrounds and action may bleed to the edges.
- Download TikTok's current safe-zone overlay from Ads Manager or use a PNG overlay (e.g. safearea.video). Check the render in an overlay before export. TikTok updated its templates in mid-2025.

---

## 3. Clip sourcing (for the user to gather on their own machine)

### 3.1 Principles
- "Scenepacks" are creator-made packs of 4K or 4K60 clips, often upscaled with Topaz, colour-corrected (CC) and sometimes made "Twixtor-ready" for speed ramps. They are shared on YouTube, with Drive or Mega links in the description, and on TikTok.
- Scenepack uploads are almost always re-cuts of broadcast footage. "Free" and "no watermark" do not mean "licensed". The licence chain is unclear, and that matters for the takedown risk in section 4.
- Download advice, at the generic level: save only clips you are allowed to use, such as downloads the pack creator offers in the description. Check each pack's description for the date, resolution and fps. No DRM-circumvention.
- For this edit, mix:
  - Official club, federation, league and event uploads. Lowest takedown risk, but also not a free licence.
  - A small share of scenepack footage.
  - Your own graphics, stat cards and typography. These are the transformative part.

### 3.2 Specific Yamal scenepack / clip videos (all **unverified**, title and URL taken from search results, not opened)
Upload-age claims in search snippets ("X days ago") are from an unknown snapshot, so check the live page.

| Title | URL | Note |
|---|---|---|
| Lamine Yamal SCENEPACK 4K | https://www.youtube.com/watch?v=X7QB6Pg2MT4 | Recent per snippet (unverified) |
| Lamine Yamal Spain 2026 Free Clips - 4K Scenepack | https://www.youtube.com/watch?v=eT5seBKsaTk | Spain 2026 |
| Lamine Yamal Spain 2026 Free Clips - 4K Scenepack (second upload) | https://www.youtube.com/watch?v=SxljbVY5Wig | Same title, may be a re-upload |
| Lamine Yamal 2026 - 4K Scenepack - Free Clips + No Watermark | https://www.youtube.com/watch?v=WvDukCejiAU | |
| Lamine Yamal 2026 - 4K Free Clips - Best Scene Pack - No Watermark | https://www.youtube.com/watch?v=fbaYXwo3-Ys | |
| LAMINE YAMAL 4K - FREE CLIPS FOR EDITS | https://www.youtube.com/watch?v=POBFskSE9v8 | Goals, skills, dribbles |
| Lamine Yamal Celebration World Cup 2026 4k Clips For Edits Upscaled + Prem Ae Cc | https://www.youtube.com/watch?v=H5fd2XXRXHI | Useful for the WC celebration beats |
| Lamine Yamal 4K Best Free Clips For Edits (Upscaled) | https://www.youtube.com/watch?v=0DVjB-Ihhzw | |
| Lamine Yamal 4K Best Free Clips For Edits | https://www.youtube.com/watch?v=zowHYnW2Gmk | Said to be Prime Video sourced (unverified) |
| Lamine Yamal 2026 Ultimate Scenepack / RARE CLIPS - SCENEPACK 4K (TOPAZ + 4k CC Ae) #part1 | https://www.youtube.com/watch?v=8HoovzG9LNE | "Rare clips" style |
| Lamine Yamal Ultimate Scenepack / RARE CLIPS - SCENEPACK 4K | https://www.youtube.com/watch?v=SYqVnv-oSAg | |
| Lamine Yamal 2024/25 / RARE CLIPS - SCENEPACK 4K (No CC only TOPAZ) | https://www.youtube.com/watch?v=YozOL_XmUQo | Older season |
| Lamine Yamal Spain Euro 2024 / RARE CLIPS - SCENEPACK 4K (With AE CC and TOPAZ) | https://www.youtube.com/watch?v=NjrXUAbmG6A | Euro 2024 |
| FREE Lamine Yamal CC Twixtor Clips For Edits | https://www.youtube.com/watch?v=6CP11cVZcRI | Twixtor-ready, 4K60 per snippet |
| Lamine Yamal 4k Free Clips - Clips for edits - Upscaled - Best Scene Pack - No Watermark | https://www.youtube.com/watch?v=8v0twvYr1fY | Also https://www.youtube.com/watch?v=eeRMIS1lE_w |
| RARE Lamine Yamal Clips for Editing | https://www.youtube.com/watch?v=Nq3RNmtUiCM | |
| Lamine Yamal 4K | https://www.youtube.com/watch?v=SGes3oHiqRU | |
| Lamine Yamal 2026 | https://www.youtube.com/watch?v=t9S69QvhMY8 | |
| Lamine Yamal - Skills, Goals & Assists (Ultimate 4K Edits) (playlist) | https://www.youtube.com/playlist?list=PLsMBYrO-1tpAlUKBOpgKl9AGZTRIaZMfW | |

TikTok discovery pages (also unverified):
- https://www.tiktok.com/discover/lamine-yamal-scenepack
- https://www.tiktok.com/discover/4k-lamine-yamal-scene-pack
- https://www.tiktok.com/discover/lamine-yamal-twixtor-scene-pack
- A TikTok channel called "TQ - Clips For Editing" is reported to post free Yamal packs.

### 3.3 Official sources to prefer
Channel handles and URLs below are plain names, not verified.
- **FC Barcelona**: official YouTube channel and TikTok. Match highlights and "Spectacular September" features.
- **LaLiga**: official YouTube channel plus TikTok `@laliga` (the `tiktok.com/@laliga` URL showed up in search). Videos hub: https://www.laliga.com/en-GB/videos. Full goals and assists compilations exist, for example "TODOS los GOLES y ASISTENCIAS de LAMINE YAMAL en LALIGA 2025/26" (unverified).
- **UEFA / UEFA Champions League**: official YouTube channel for UCL goals.
- **FIFA / FIFA World Cup**: official YouTube channel and the TikTok FIFA World Cup hub. TikTok became FIFA's "Preferred Platform", and a wider pool of creators is reported to be able to co-create using FIFA archival footage `[S]`. Check what the hub currently allows.
- **SEFUTBOL (Spanish national team)**: official channel for Spain content, including the Rocafonda-to-World-Cup feature (unverified).
- **Ballon d'Or official**: https://ballondor.com/players/lamine-yamal-278302 and TikTok `@ballondor` (https://www.tiktok.com/@ballondor), for official graphics, bios and context.
- Official uploads are generally licensed for viewing, not for reuse. Where TikTok offers Stitch, Duet or Remix on an official post, those native tools carry the least risk.

### 3.4 Footage wish-list for this edit `[C]`
- Chorus (hype): dribble sequences, close touches, goals, 4K60 if possible.
- Bridge (emotional): faces, post-match, World Cup final celebration, Cibeles, family moments, Keyne.
- Stat-card backing shots: slow, simple frames that give text room.
- Before/after: childhood and early footage, rights-sensitive. Use only licensed or official stills and clips.

---

## 4. Copyright and reach risks, and getting the song attributed

### 4.1 How TikTok treats match footage
- Broadcast footage: the production (camera angles, graphics, commentary) is owned by rights holders such as LaLiga, UEFA, FIFA and the broadcasters. The match itself is not copyrightable, but the broadcast recording is `[S]`.
- TikTok runs audio fingerprinting plus in-house scanning, and rights holders can file takedowns `[S]`. Outcomes include muting, removal, or an account ban for repeat infringement.
- Strikes `[S]` (third-party summaries of TikTok's policy, unverified against the official page): three copyright strikes within a 90-day window can lead to a permanent ban. Copyright and trademark strikes are counted separately. You can appeal in-app or file a DMCA counter-notice.
- TikTok announced stricter anti-piracy measures ahead of the 2026 World Cup `[S]`.
- "No copyright intended" disclaimers do not give any protection.

### 4.2 What actually lowers risk
- **Replace all broadcast audio with your own song.** Strip commentary and crowd audio entirely. Audio is the main automated trigger. The user owns the song (see 4.3), which removes the music-claim problem.
- Keep clips short: 0.3-1.1 s cuts, not full plays.
- Reframe 16:9 to 9:16. A tight punch-in naturally crops out broadcaster bugs and score graphics.
- Make it genuinely transformative: your own stat cards, typography, grading, lyrics, narrative and timing. This is also what makes the edit good.
- Prefer official or licensed sources where possible (section 3.3).
- Be honest about the limits `[S]`:
  - Mirroring, flipping or speed changes are not reliable protection.
  - Rights holders can file manual takedowns regardless.
  - Fair use is a legal defence, not a prevention.
  - Do not build the plan around evading detection.
- Practical safety net:
  - Post a private test first (visibility "Only me") to see whether TikTok mutes or flags anything.
  - Keep the master file, so you can re-edit or appeal fast.
  - Do not stake the whole campaign on one account-level post.

### 4.3 The song: rights check before distribution
- Suno commercial rights `[S]`:
  - Songs made on a **paid** Suno plan can be used commercially and distributed. Free-tier outputs do not carry commercial rights.
  - Confirm the track was generated while a paid plan was active.
- AI music on TikTok `[S]`:
  - Allowed.
  - TikTok's AI-label rule targets realistic people, scenes or voices that impersonate real people. Third-party summaries say original AI music generally does not need a label.
  - Distributors now include an AI-disclosure step. Answer it honestly.
- Avoid anything that imitates a real artist's voice. SoundOn now runs ACRCloud "Derivative Works Detection" plus pre- and post-distribution reviews, human review and photo ID `[S]`.

### 4.4 Getting the sound credited to the artist
- **Option A (recommended): distribute into TikTok's Commercial Music Library.**
  - Via **SoundOn** (TikTok's own distributor). Third-party sources quote 1-3 business days review. Pays 100% of royalties in year one, 90% after that. It verifies artists, and the artist profile appears under the sound page. You can also push to Spotify and Apple Music from it. Not exclusive.
  - Or via a distributor with a TikTok store (DistroKid, TuneCore, CD Baby). DistroKid says 1-2 days. Third-party sources say 1-3 weeks.
  - Official sounds show cover art, track title and artist name. "Original sound" does not.
- **Option B (fallback): post with the baked-in audio and let TikTok tag it "original sound".**
  - It is credited to the posting account. It is not in the library and not monetised.
  - It is fine for the teaser or if distribution is late.
- Prep list `[C]`: WAV or FLAC master, cover art 3000x3000, title "I Feel It Coming", artist name spelled exactly as **Mbastein** everywhere, ISRC (the distributor assigns one), writers and splits, AI disclosure, release date.
- **Submit this week.** 25 days remain until the ceremony and distribution lead times vary. Aim to have the official sound live by about 18 Oct.
- Workflow to test with a private post `[unverified]`:
  - Upload the edit with the music baked in. TikTok may auto-match it to the official track once it is in the library. If not, it will show "original sound".
  - Alternative: export without music and add the official sound in-app. That guarantees attribution but makes frame-accurate beat sync harder.
- Whitelist your own channels. If the distributor also registers the song with YouTube Content ID, add your own YouTube channel to the allow list.

---

## 5. Posting strategy around the Ballon d'Or

### 5.1 Calendar (kickoffs from search snippets, verify)
- Sat 10 Oct: Barcelona vs Getafe (18:30).
- Sat 17 Oct: Real Betis vs Barcelona (18:30).
- Tue 20 Oct: PSG vs Barcelona (Champions League, 21:00).
- **Sun 25 Oct: El Clasico, Barcelona vs Real Madrid, Camp Nou, 21:00 CET. This is the night before the ceremony.**
- **Mon 26 Oct: Ceremony, London Palladium, 20:00 UK (21:00 CET), about 2 hours, DAZN worldwide and ballondor.com.**
- UK clocks go back on Sun 25 Oct, so London is on GMT at the ceremony.
- One source says voting closed 28 Sep. The result is decided but not public. Do not claim anything.

### 5.2 Timing
- Best posting windows `[S]`: evenings 18:00-23:00 local, Friday and Saturday evenings strongest, Tuesday to Thursday evenings (18:00-20:00 CET) reliable. Post 30-60 minutes before the peak so early engagement is in place.
- Plan `[C]`:
  1. **Teaser A and B, Sun 11 Oct, 18:30 CET** (8-10 s, two different hook lines). Seeds the sound and tests the hook. Keep the better one.
  2. **Main edit: Thu 22 Oct, 18:00-19:30 CET** (12:00-13:30 ET, so it also lands at US lunchtime). This gives 4 days for the test-pool to expand before the Clasico and ceremony wave, and avoids drowning in match-night noise.
  3. **Countdown: Sat 24 Oct, 18:30 CET.** A 10-15 s cut of the climax with `2 DAYS` or `TOMORROW NIGHT` text.
  4. **Clasico night, Sun 25 Oct, post-match (about 23:30 CET):** a reaction cut only if Yamal delivers. Pre-edit a 10 s template to drop clips into.
  5. **Ceremony day, Mon 26 Oct, 18:00-19:30 UK:** a "tonight" version.
  6. **Reveal:** within 10-30 minutes of the Ballon d'Or announcement. Pre-render **three variants** so you can post fast:
     - WIN: "HISTORY. YOUNGEST EVER."
     - KOPA only: "THIRD KOPA. THE ERA IS HIS."
     - LOSS: "NOT THIS YEAR. NOT THE LAST."
     The Kopa Trophy is likely announced earlier in the night, so the Kopa variant may go out first.
  7. **Oct 27-29:** reply to comments with video replies, then a retrospective cut.
- If the sound is not yet in the library, use the original-sound version and post the same edit again once the official sound is live (as a new upload, not a delete).

### 5.3 Captions and hashtags
- Keep the caption to 1-2 lines so the bottom UI block stays near the 484 px minimum.
- Debate-driving caption ideas:
  - `19. World champion. La Liga's best. Kane or Yamal? Pick before Oct 26.`
  - `The case for Lamine Yamal. Tell me what I missed.`
  - `I feel it coming. Oct 26. #BallonDor`
  - `Youngest ever? One week to go.`
  - `Rain on me. Ballon d'Or night.`
- Pin a comment with a binary question (for example `Kane or Yamal?`). Reply to early comments within the first hour to lift comment depth `[S]`: shares, saves and meaningful comments outweigh likes.
- Hashtags (3-5) `[S]` plus `[C]`:
  - Broad: `#football` or `#footballtiktok`
  - Topic: `#BallonDor2026` or `#BallonDor` (#ballondor had about 790K posts at the time of search)
  - Player: `#LamineYamal`
  - Club/country: `#FCBarcelona`
  - Format: `#footballedit`
  - Own tag: `#IFeelItComing` and `#Mbastein`
  - Skip `#fyp`.
- Cover: custom frame, a clear face plus the hook text, inside the safe rect.

### 5.4 Hook line for the first frame
- Primary: **`THE BALLON D'OR CASE: LAMINE YAMAL`** (clear topic, search-friendly, no false claim).
- Strong alternates: `HE'S 19. LOOK WHAT HE DID.` or `OCT 26. REMEMBER THIS.`
- Post-ceremony variants must match the result. Never post a pre-result "WINNER" frame.

---

## Sources

**Safe zones and specs**
- [TikTok safe zone: the exact 2026 template in pixels, Cadenus](https://cadenus.io/resources/blog/tiktok-safe-zone/)
- [TikTok Safe Zone in 2026, Creamate](https://creamate.ai/en/blog/tiktok-safe-zone-guide)
- [TikTok Safe Area Overlay Guide, CheckSafe.Zone](https://checksafe.zone/articles/tiktok-safe-area-overlay-guide-2026)
- [Social Media Safe Zones: Full Guide (2026), Postplanify](https://postplanify.com/blog/social-media-safe-zones-2026-complete-guide)
- [TikTok Safe Zone Guide 2026, EZUGC](https://www.ezugc.ai/blog/tiktok-safe-zones-guide)
- [TikTok Video Ad Specs: The 2026 Safe Zone Guide, Recharm](https://www.recharm.com/blog/tiktok-video-ad-specs)
- [TikTok Video Specs for 2026, Puritano](https://www.puritano.com/post/tiktok-video-specs)
- [TikTok Video Sizes (2026), RecurPost](https://recurpost.com/tiktok-scheduler/tiktok-video-sizes/)
- [TikTok Upload Method 2026, ShortSync](https://www.shortsync.app/resources/tiktok-upload-method-high-quality)
- [TikTok Video Quality Settings (2026), ShortSync](https://www.shortsync.app/guides/tiktok-video-quality-settings)
- [Why TikTok Destroys Your Video Quality, TotalMedia](https://www.totalmedia.ai/en/resources/blog/fix-tiktok-video-compression-quality)

**Edit craft, formats, pacing**
- [Football Edit Ideas: 20 Viral Formats for 2026, Fluxnote](https://fluxnote.io/guides/football-edit-ideas-and-formats)
- [How to Make Football Edits, Fluxnote](https://fluxnote.io/guides/football-edits-guide)
- [Best Football Edit Apps 2026, Fluxnote](https://fluxnote.io/guides/best-football-edit-apps-2026)
- [Beat-Based Editing in CapCut, Cursa](https://cursa.app/en/page/beat-based-editing-in-capcut-syncing-cuts-transitions-and-motion-to-music)
- [CapCut Velocity Edit: Speed Curve and Beat Sync](https://capcutguide.com/capcut-velocity-edit/)
- [How To Create a Speed Ramp in CapCut, Filmora](https://filmora.wondershare.com/video-editing-tips/speed-ramp-capcut.html)
- [Short-Form Video Pacing: The Editing Rhythm Guide (2026), Shortzly](https://shortzly.com/blog/short-form-video-pacing-editing-guide)
- [How fast should I cut my video? CutScore](https://cutscore.io/blog/how-fast-should-i-cut-my-video)
- [Ideal TikTok Length and Format for Retention, OpusClip](https://www.opus.pro/blog/tiktok-length-format-retention-data)
- [Best TikTok Video Length in 2026, SocialRails](https://socialrails.com/blog/best-tiktok-video-length-maximum-engagement)
- [TikTok Caption and Subtitle Best Practices 2026, OpusClip](https://www.opus.pro/blog/tiktok-caption-subtitle-best-practices)
- [Best TikTok Caption Fonts 2026, Blitzcut](https://blitzcutai.com/blog/best-caption-fonts-tiktok)
- [Best Color Grading Techniques for Sports Footage](https://clippingmaski.blogspot.com/2026/07/best-color-grading-techniques-for.html)
- [TikTok Algorithm 2026: How to Win With Rewatches, Darkroom](https://www.darkroomagency.com/observatory/how-tiktok%E2%80%99s-algorithm-works-in-2026-and-15-tactics-to-go-viral)
- [What is the best way to create a seamless looping video on TikTok? Jeff Bullas](https://www.jeffbullas.com/thread/what-is-the-best-way-to-create-a-seamless-looping-video-on-tiktok/)
- [Freeze Football Edit, TikTok Discover](https://www.tiktok.com/discover/freeze-football-edit)
- [Lamine Yamal Viral Edits, TikTok](https://www.tiktok.com/en/trending/detail/lamine-yamal-viral-edits)
- [Lamine Yamal Edits Phonk, TikTok Discover](https://www.tiktok.com/discover/lamine-yamal-edits-phonk)
- [Football Edit Trend, TikTok Discover](https://www.tiktok.com/discover/football-edit-trend)
- [Shake Body (Wikipedia)](https://en.wikipedia.org/wiki/Shake_Body)
- [Lamine Yamal Childhood Skills, TikTok Discover](https://www.tiktok.com/discover/lamine-yamal-childhood-skills)

**Sourcing (unverified search-result links)**
- [Lamine Yamal SCENEPACK 4K](https://www.youtube.com/watch?v=X7QB6Pg2MT4)
- [Lamine Yamal Spain 2026 Free Clips 4K Scenepack](https://www.youtube.com/watch?v=eT5seBKsaTk)
- [Lamine Yamal 2026 4K Scenepack Free Clips + No Watermark](https://www.youtube.com/watch?v=WvDukCejiAU)
- [Lamine Yamal 2026 4K Free Clips Best Scene Pack](https://www.youtube.com/watch?v=fbaYXwo3-Ys)
- [LAMINE YAMAL 4K - FREE CLIPS FOR EDITS](https://www.youtube.com/watch?v=POBFskSE9v8)
- [Lamine Yamal Celebration World Cup 2026 4k Clips](https://www.youtube.com/watch?v=H5fd2XXRXHI)
- [Lamine Yamal 2026 Ultimate Scenepack #part1](https://www.youtube.com/watch?v=8HoovzG9LNE)
- [FREE Lamine Yamal CC Twixtor Clips For Edits](https://www.youtube.com/watch?v=6CP11cVZcRI)
- [Lamine Yamal Spain Euro 2024 Scenepack](https://www.youtube.com/watch?v=NjrXUAbmG6A)
- [Lamine Yamal Scenepack, TikTok Discover](https://www.tiktok.com/discover/lamine-yamal-scenepack)
- [TODOS los GOLES y ASISTENCIAS de LAMINE YAMAL en LALIGA 2025/26](https://www.youtube.com/watch?v=J0s6gT8OCJc&vl=en)
- [LaLiga videos](https://www.laliga.com/en-GB/videos)
- [Ballon d'Or: Lamine Yamal](https://ballondor.com/players/lamine-yamal-278302)
- [Ballon d'Or on TikTok](https://www.tiktok.com/@ballondor?lang=en)
- [TikTok and FIFA Preferred Platform agreement, TikTok Newsroom](https://newsroom.tiktok.com/tiktok-fifa-reach-preferred-platform-agreement?lang=en)
- [TikTok becomes FIFA's Preferred Platform, ContentGrip](https://www.contentgrip.com/tiktok-fifa-world-cup/)

**Copyright, sound and distribution**
- [TikTok Intellectual Property Policy](https://www.tiktok.com/legal/page/global/copyright-policy/en)
- [TikTok Support: Copyright](https://support.tiktok.com/en/safety-hc/account-and-user-safety/copyright)
- [TikTok Copyright Rules for Creators (2026), Soundstripe](https://www.soundstripe.com/blogs/tiktok-copyright)
- [Avoid TikTok Video Takedowns, Trademarkia](https://www.trademarkia.com/news/business/tiktok-copyright-video-takedown-rules-2025)
- [Football Edits Without Copyright Strikes (2026), Fluxnote](https://fluxnote.io/guides/how-to-make-football-edits-without-copyright)
- [How to Avoid a Copyright Strike on YouTube (2026), Soundstripe](https://www.soundstripe.com/blogs/how-to-avoid-copyright-strikes-on-youtube)
- [Content ID, Wikipedia](https://en.wikipedia.org/wiki/Content_ID)
- [SoundOn: the new platform for TikTok music marketing, TikTok Newsroom](https://newsroom.tiktok.com/en-gb/soundon-the-new-platform-for-tiktok-music-marketing-and-global-track-distribution)
- [SoundOn partners with ACRCloud Derivative Works Detection, TikTok Newsroom](https://newsroom.tiktok.com/soundon-partners-with-acrclouds-new-derivative-works-detection-service?lang=en)
- [TikTok's SoundOn is using ACRCloud, Music Ally](https://musically.com/2026/04/07/tiktoks-soundon-is-using-acrcloud-to-crack-down-on-music-fraud/)
- [Distributing Your Songs to TikTok, DistroKid](https://support.distrokid.com/hc/en-us/articles/360035074473-Distributing-Your-Songs-to-TikTok)
- [Get Music on TikTok: Use a Distributor, Dynamoi](https://dynamoi.com/learn/tiktok-music-promotion/how-do-i-get-my-music-on-tiktok)
- [SoundOn vs DistroKid for TikTok, Dynamoi](https://dynamoi.com/learn/tiktok-music-promotion/soundon-vs-distrokid-for-tiktok)
- [AI Music on TikTok: Allowed With Labeling Required, Dynamoi](https://dynamoi.com/learn/ai-music-distribution/is-ai-music-allowed-on-tiktok)
- [TikTok's AI Labeling Rules Explained, Storrito](https://storrito.com/resources/tiktoks-2026-ai-labeling-rules-and-what-they-signal-for-platform-governance/)
- [Can You Sell Suno AI Music? 2026 Commercial Rights Guide](https://terms.law/ai-output-rights/suno/)
- [Suno Spotify Distribution (2026), Dynamoi](https://dynamoi.com/learn/ai-music-distribution/how-to-distribute-suno-music)
- [How to find the official sound of your track on TikTok, Soundcamps](https://help.soundcamps.com/en/articles/6908378-how-to-find-the-official-sound-of-your-track-on-tiktok)

**Ballon d'Or, fixtures and facts**
- [When Is the 2026 Ballon d'Or Ceremony? Yahoo Sports](https://sports.yahoo.com/articles/2026-ballon-dor-ceremony-date-184303091.html)
- [Ballon d'Or 2026: Date, Nominees and How to Watch, GiveMeSport](https://www.givemesport.com/ballon-dor-2026-date-nominees-watch/)
- [When is the Ballon d'Or 2026 ceremony? Paddy Power](https://news.paddypower.com/football/2026/09/28/ballon-dor-2026-ceremony-date-start-time-nominees-how-to-watch/)
- [2026 Ballon d'Or, Wikipedia](https://en.wikipedia.org/wiki/2026_Ballon_d'Or)
- [Ballon d'Or 2026 nominees, ESPN](https://www.espn.com/soccer/story/_/id/49866841/ballon-dor-2026-nominees-harry-kane-kylian-mbappe-lead-30-man-shortlist)
- [Ballon d'Or 2026 Odds: Kane favourite, Oddschecker](https://www.oddschecker.com/insight/football/20260929-ballon-dor-2026-odds-harry-kane-favourite-ahead-of-lamine-yamal)
- [Ballon d'Or betting odds, Bookies.com](https://bookies.com/uk/news/ballon-dor-betting-odds-2026-harry-kane-clear-favourite-over-yamal-mbappe-29-september)
- [Camp Nou to Host First 2026-27 El Clasico on October 25, Yahoo Sports](https://sports.yahoo.com/articles/camp-nou-host-first-2026-160500903.html)
- [Barcelona vs Real Madrid 2026/27 El Clasico dates, Yahoo Sports](https://sports.yahoo.com/articles/barcelona-vs-real-madrid-2026-062000834.html)
- [Spain wins 2026 FIFA World Cup over Argentina, Fox Sports](https://www.foxsports.com/stories/soccer/world-cup-spain-wins-argentina-lamine-yamal-lionel-messi)
- [Every World Cup record Lamine Yamal set, World Soccer Talk](https://worldsoccertalk.com/world-cup/every-world-cup-record-lamine-yamal-set-during-spains-2026-winning-campaign/)
- [Lamine Yamal's 2025-26 record for FC Barcelona, Yahoo Sports](https://sports.yahoo.com/articles/lamine-yamals-2025-26-record-193800490.html)
- [Lamine Yamal, 2025/26 LaLiga player of the season, FC Barcelona](https://www.fcbarcelona.com/en/football/first-team/news/4514485/lamine-yamal-202526-laliga-player-of-the-season)
- [Lamine Yamal surpasses Messi as youngest to 50 Barcelona goals, World Soccer Talk](https://worldsoccertalk.com/news/lamine-yamal-surpasses-lionel-messi-to-become-barcelonas-youngest-player-to-reach-50-goals/)
- [Lamine Yamal sends bold Ballon d'Or message after Wembley, Yahoo Sports](https://sports.yahoo.com/articles/lamine-yamal-sends-bold-ballon-190000410.html)
- [Best time to post on TikTok in 2026, Influencer Marketing Hub](https://influencermarketinghub.com/best-times-to-post-on-tiktok/)
- [Best time to post on TikTok in Europe/Berlin (2026), Tabber](https://thetabber.com/blog/best-time-to-post-on-tiktok-europe-berlin)
