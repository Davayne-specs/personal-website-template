# Hand-off: the user's 4K render on Windows

Give the user these steps with `<slug>` and the cut names filled in (copy-paste ready). They
run them in Command Prompt or PowerShell. Keep it this short; the first-time setup only once.

## First time only

```
winget install Python.Python.3.12
winget install Gyan.FFmpeg
winget install Git.Git
```
Close and reopen Command Prompt, then:
```
git clone https://github.com/Davayne-specs/personal-website-template.git
cd personal-website-template
pip install numpy pillow soundfile
```
(If `winget` is missing: install Python from python.org with "Add python.exe to PATH" ticked.)

## Every new edit

```
cd personal-website-template
git pull
git checkout <branch Claude pushed to>
cd tiktok-edit
```

1. Put the files in place (they are not in git):
   - the **4K copy of the scene pack** -> `tiktok-edit\sources\<slug>.mp4` (exactly this name)
   - the soundtrack(s) Claude sent -> `tiktok-edit\song\<slug>_<cut>.wav`
2. Check the 4K file is the same video the edit was planned on:
   ```
   python tools/scenes.py verify sources/<slug>.mp4 --catalog research/<slug>_scenes.json
   ```
   "OK" -> carry on. "shifted by X s" -> run the trim command it prints, then verify again.
   "MISMATCH" -> it's a different upload; send Claude the low-quality copy of *this* file.
3. Render (a few minutes each; 4K sources take longer than the preview did):
   ```
   python render.py edl/<slug>_short.json --contact-sheet
   python render.py edl/<slug>_main.json --contact-sheet
   ```
   The videos land in `tiktok-edit\out\<slug>_short.mp4` and `<slug>_main.mp4`, with a
   contact sheet image next to each.

## If something goes wrong

| message | fix |
|---------|-----|
| `'python' is not recognized` | use `py` instead of `python`, or reinstall Python with "Add to PATH" |
| `ffmpeg not found` / render fails at once | reopen Command Prompt after installing FFmpeg; `ffmpeg -version` must work |
| `song not found` | the wav isn't in `tiktok-edit\song\` under the exact name |
| missing clip / grey title cards in the video | the pack isn't at `sources\<slug>.mp4` |
| `render of shot sNN failed` | run `python render.py edl/<file>.json --only sNN --jobs 1 -v` and send Claude the output |
| it looks out of sync | send Claude the cut name; it can check with `tools/qa.py sync` |

## Posting notes

- Footage from broadcasts is copyrighted: platforms may mute or remove it. Keep the edit
  transformed (crop, grade, text), post privately first to see if it's flagged.
- Suno songs: monetising needs the track to have been made on a paid Suno plan; distributing
  it (e.g. a distributor or SoundOn) credits the TikTok sound to the artist.
- Scene-pack channels usually ask for credit in the caption.
