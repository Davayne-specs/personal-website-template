# Murberry

A calm, documentary-style series on warm paper. This folder is the Remotion
project that animates it. Episode 1 is **The Push-Up** (2:30, 9:16).

The series bible, the Ep 1 script with sources, the storyboard and the brand
sheet live in Claude Docs and Claude Design; this project follows them.

## Run it

```sh
npm install
pip install numpy scipy        # only for the sound
npm run audio                  # writes public/audio/ep01-mix.wav
npm run studio                 # scrub the episode in the browser
npm run preview                # half-size MP4 in out/
npm run render                 # 1080 x 1920 master in out/
```

Every scene also has its own composition (`Ep01-fold`, `Ep01-machine`, and so
on) for quick previews.

## How it is built

- `src/ep01/timeline.json`: the one source of timing. Scene boundaries,
  transitions, every caption, and every sound cue.
- `src/scenes/`: one component per beat, drawn from the storyboard frames
  (fold, floor, wall, machine, fibre, glucose, mind, plan, sign-off).
- `src/components/`: paper sheets and grain, the peel and tear transitions,
  pencil draw-on, captions, small-caps labels, the blind emboss, muscles
  with their named, load and recovery states.
- `src/figure/`: the figure's paths, traced from the storyboard, and a
  two-bone arm rig so the elbows bend during reps while the hands stay put.
- `scripts/make_audio.py`: the sound design, synthesized in code: deep paper
  fold, slide, tear, warm pad, low hum, myosin ticks and breath. No samples,
  so nothing to license.

## Credits

- EB Garamond, SIL Open Font License (`public/fonts/OFL.txt`).
- Paper grain from the approved storyboard.
