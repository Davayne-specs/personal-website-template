"""Cut sheet: Lamine Yamal × "Spot Valley Road 50" (Success Farm / Mbastein).

An emo / alt-rock song about being watched, called, haunted ("you've seen the
demons already"), waking up screaming, fighting alone, then "I feel amazing".
The edit borrows the visual language of emo, punk and experimental video:

  camcorder (vhs + rec HUD)  — DIY tour-tape intimacy for the verses
  photocopy zine (xerox, freeze, ransom-note lyrics) — punk flyers on the hooks
  strobe / invert / glitch / stutter — panic, demons, "it's all repeater"
  echo trails, light leaks, typewriter lyrics — the whispered bridge
  beat-locked zoom pulses, zoom blur, whips, red flashes — the drop
  delayed triptychs and 2x2 grids — repetition, faces, the "demons"

Every look is tied to a lyric or a change in the music; nothing is decoration.

Row: R(at, clip, hit=seconds into the clip, **EDL keys). `at` is the song
position ("bar.beat[.tenths]" or "@seconds"); a shot lasts until the next row.
"""
from grid import Grid

PROJECT = {
    "title": "Lamine Yamal — Spot Valley Road 50",
    "beatmap": "analysis/beatmap_spot_valley.json",
    "moments": "research/moments_spot_valley.json",
    "source": "song/spot_valley_road.mp3",
    "stems": {"vocals": "song/stems/spot_valley_road/vocals.wav",
              "instrumental": "song/stems/spot_valley_road/instrumental.wav"},
    "gain_db": 1.5,                     # -15.5 → ~-14 LUFS for TikTok
    "clips_dir": "clips/v2",            # → clips/v2_hq after tools/match_clips.py
    "default_grade": "none",
    "docs": {"clips": None, "shotlist": "SHOTLIST_spot_valley.md"},
    "meta": {"rec_date": "OCT 26 2026"},
}
G = Grid(PROJECT["beatmap"])
B, BEAT = G.B, G.beat


def beat_pos(bar, beat):
    return G.ph + bar * G.bar + (beat - 1) * BEAT


# ~2:00 edit: every section of the song, minus repeats
PLANS = {
    "spot_valley": [
        {"label": "cold open 'Yo— let's go'", "from": round(beat_pos(2, 3), 4), "to": B(4)},
        {"label": "verse 'What do you know / calling my name' → 'secret / pain'",
         "from": B(9), "to": B(17), "vocals_to": 34.83},
        {"label": "'figured it out' → breakdown → 'demons already' → 'Don't you run from me'",
         "from": B(23), "to": B(38), "vocals_to": 77.70},
        {"label": "'I wanna call police' → build → bridge → drop → 'just not there'",
         "from": B(44), "to": B(67), "mute_vocals": [[B(44) - 0.05, 90.20]]},
        {"label": "'Cold sweat ×3' → 'I feel amazing' → calm → finale",
         "from": B(70), "to": G.duration, "mute_vocals": [[B(70) - 0.05, 142.30]]},
    ],
}


def R(at, m, hit=0.0, **kw):
    return {"at": at, "m": m, "hit_offset": hit, **kw}


# ---- reusable looks ---------------------------------------------------------
PULSE = {"every": "beat", "amount": 0.055, "decay": 7}      # zoom bounce on every beat
PULSE_SOFT = {"every": "beat", "amount": 0.03, "decay": 6}
PULSE_HALF = {"every": "half", "amount": 0.04, "decay": 9}
SNAP = {"from": 1.18, "to": 1.0, "ease": "snap"}            # punch in, settle
PUSH = {"from": 1.0, "to": 1.12}
SLOW_PUSH = {"from": 1.0, "to": 1.2}
CAM = ["vhs", "rec"]                                         # camcorder tape
HIT = ["zoom_blur", "flash_in", "shake"]
BOOM = ["zoom_blur", "flash_red", "shake_hard"]


def ransom(content, at=None, pos="center", until=None):
    t = {"content": content, "style": "ransom", "pos": pos}
    if at:
        t["at"] = at
    if until:
        t["until"] = until
    return t


def typed(content, at=None, pos="lower", until=None):
    t = {"content": content, "style": "typewriter", "pos": pos}
    if at:
        t["at"] = at
    if until:
        t["until"] = until
    return t


def glitch_word(content, at=None, pos="center"):
    t = {"content": content, "style": "glitchtext", "pos": pos}
    if at:
        t["at"] = at
    return t


def stamp(content, at=None, pos="upper"):
    t = {"content": content, "style": "stamp", "pos": pos}
    if at:
        t["at"] = at
    return t


# ---- cold open: "Yo— … let's go" (silence, then the beat) -------------------
OPEN = [
    # frame 0: a photocopied freeze of the name on his back — and the hook
    R("2.3", "P14", hit=1.0, freeze={"at": 0.0}, fx=["xerox", "grain"], zoom={"from": 1.12, "to": 1.18}),
    # "let's go": the tape starts rolling, the camera pulls back off the name
    R("3.1", "P14", hit=0.5, speed=0.6, fx=CAM + ["flash_in"], zoom={"from": 1.25, "to": 1.0, "ease": "in_out"}),
]
OPEN_TEXT = [
    {"start": "2.3", "end": "4.1", "content": "THEY KEEP CALLING HIS NAME", "style": "ransom", "pos": "center"},
]

# ---- verse 1a: "What do you know / you calling my name" — the camcorder tape
VERSE_A = [
    R("9.1", "P01", fx=CAM + ["zoom_blur", "flash_in"], pulse=PULSE_SOFT, zoom=PUSH,
      text=ransom("WHAT DO YOU KNOW", at="@19.20", pos="upper")),
    R("9.3", "P03", hit=0.2, fx=CAM, pulse=PULSE_SOFT),
    R("10.1", "P04", hit=0.1, speed=0.8, fx=CAM, pulse=PULSE_SOFT),
    R("10.3", "P13", hit=0.2, fx=CAM, pulse=PULSE_SOFT),
    # "I hear you calling my name": the crowd, then he turns around
    R("11.1", "P05", hit=0.1, fx=CAM + ["flash_in"], pulse=PULSE,
      text=ransom("CALLING MY NAME", at="@22.58", pos="upper")),
    R("11.3", "P05", hit=0.7, fx=CAM, pulse=PULSE),
    R("11.4", "P17", hit=0.3, fx=CAM + ["whip_in"]),
]

# ---- verse 1b: the energy jumps — colour, step-printed runs, one cut a beat --
VERSE_B = [
    R("12.1", "P06", fx=["zoom_blur", "flash_in", "shake", "step"], pulse=PULSE, zoom=SNAP),
    R("12.2", "P06", hit=0.6, fx=["step"], pulse=PULSE),
    R("12.3", "P09", fx=["step", "whip_in"], pulse=PULSE),
    R("12.4", "P09", hit=0.8, fx=["step"], pulse=PULSE),
    # "You must got a secret": his smile, photocopied and frozen
    R("13.1", "P02", hit=0.4, freeze={"at": 0.0}, fx=["xerox", "invert_flash"], zoom=PUSH,
      text=ransom("YOU MUST GOT A SECRET", at="@27.15")),
    R("13.3", "P13", hit=0.4, fx=["echo"], speed=0.7),
    R("13.4", "P11", fx=["glitch"]),
    R("14.1", "P10", hit=0.2, fx=["step", "shake"], pulse=PULSE),
    R("14.3", "P10", hit=1.85, fx=["invert_flash"], pulse=PULSE),
    R("14.4", "P08", hit=0.3, fx=["whip_in"], pulse=PULSE),
    # "You must know my pain": the anthem face, letterboxed, then trails
    R("15.1", "P04", hit=0.3, freeze={"at": 0.0}, fx=["xerox", "letterbox"], zoom=SLOW_PUSH,
      text=stamp("PAIN", at="@31.40")),
    R("15.3", "P04", hit=0.3, speed=0.5, fx=["echo", "letterbox"], grade="cold"),
    R("16.1", "P11", hit=0.4, fx=["glitch", "rgb_split"]),
    R("16.2", "P15", fx=["whip_in"]),
    R("16.3", "P05", hit=0.2, fx=["strobe"], pulse=PULSE),
    R("16.4", "P05", hit=0.8, fx=["flash_red", "shake_hard"]),      # "Yeah!"
]

# ---- "Oh, you figured it out": the goals ------------------------------------
FIGURED = [
    R("23.1", "P07", hit=0.1, fx=HIT, ramp={"from": 1.0, "to": 0.4, "at": 0.25}, zoom=SNAP),
    R("23.3", "P07", hit=1.6, fx=["invert_flash"], stutter={"len": 0.134, "repeats": 3},
      text=glitch_word("FIGURED IT OUT", at="@47.15")),
    R("24.1", "P08", hit=0.2, layout="triptych", fx=["flash_in"]),
    R("24.3", "P12", fx=["whip_in"], pulse=PULSE),
    R("24.4", "P16", hit=0.3, pulse=PULSE),
    # "Yeah, thank god you figured it out"
    R("25.1", "P10", hit=0.3, fx=["step", "zoom_blur"], pulse=PULSE),
    R("25.3", "P10", hit=1.85, fx=["invert_flash", "shake"]),
    R("25.4", "P05", hit=0.2, pulse=PULSE),
    R("26.1", "P13", hit=0.3, pulse=PULSE),
    R("26.2", "P16", hit=0.4, pulse=PULSE),
    R("26.3", "P02", hit=0.6, freeze={"at": 0.0}, fx=["posterize", "flash_in"], zoom=PUSH),   # "Oh"
    R("27.1", "P09", hit=0.2, fx=["step"], pulse=PULSE),
    R("27.3", "P09", hit=1.0, fx=["step"], pulse=PULSE),
    R("27.4", "P17", hit=0.1, fx=["whip_in"]),
]

# ---- breakdown: "Don't run, child / Come for you, beater / It's all repeater…"
BREAKDOWN = [
    R("28.1", "P17", speed=0.5, fx=["letterbox", "echo"], grade="bw", zoom=PUSH,
      text=typed("don't run, child", at="@56.60")),
    R("29.1", "P01", hit=1.8, speed=0.6, fx=["reverse", "letterbox", "vhs"], grade="bw",
      text=typed("come for you, beater", at="@59.03")),
    # "It's all repeater" — literally: the clap, stuttered, then stacked three times
    R("30.1", "P05", fx=["strobe"], stutter={"len": 0.1, "repeats": 4}),
    R("30.3", "P05", hit=0.3, layout="triptych", panels=[{"delay": 0.0}, {"delay": 0.12}, {"delay": 0.24}]),
    # "You've seen the demons already"
    R("31.1", "P04", fx=["strobe", "glitch"], grade="bw", zoom=SLOW_PUSH,
      text=ransom("YOU'VE SEEN THE DEMONS ALREADY", at="@63.00")),
    R("31.3", "P11", fx=["glitch", "invert"], glitch={"whole": True, "amount": 0.6}),
]

# ---- chorus: "You've seen the demons already" ×2, "Don't you run from me" ----
CHORUS = [
    R("32.1", "P06", fx=CAM, pulse=PULSE),
    R("32.3", "P09", hit=0.4, fx=["step"], pulse=PULSE),
    R("32.4", "P11", fx=["glitch"]),
    # the faces — a photocopied 2x2 wall of them on "the demons"
    R("33.1", "P04", layout="grid4", fx=["xerox"],
      panels=[{"m": "P04", "hit": 0.2}, {"m": "P13", "hit": 0.3}, {"m": "P17", "hit": 0.2}, {"m": "P02", "hit": 0.5}],
      text=ransom("DEMONS", at="@67.60")),
    R("34.1", "P10", hit=0.3, fx=["step"], pulse=PULSE),
    R("34.3", "P10", hit=1.85, fx=["invert_flash", "shake"]),
    R("34.4", "P07", hit=0.1, fx=["zoom_blur"]),
    R("35.1", "P04", hit=0.5, fx=["strobe"], grade="bw", pulse=PULSE,
      text=ransom("ALREADY", at="@72.60")),
    R("35.3", "P11", hit=0.6, fx=["glitch"], glitch={"whole": True, "amount": 0.4}),
    R("36.1", "P03", hit=0.2, speed=0.6, fx=["echo"], grade="cold"),
    R("36.3", "P01", hit=0.6, speed=0.6, fx=["echo"], grade="cold"),
    # "Don't you run from me" — he walks backwards into the frame
    R("37.1", "P17", fx=["reverse", "whip_in"], speed=0.6, zoom=PUSH,
      text=typed("don't you run from me", at="@75.04")),
]

# ---- "I wanna call police / someone who knows me" — back on the camcorder ----
CALL = [
    R("44.1", "P18", speed=0.7, fx=CAM, pulse=PULSE_SOFT,
      text=typed("i wanna call police", at="@90.24")),
    R("45.1", "P15", fx=CAM + ["whip_in"], pulse=PULSE_SOFT),
    R("45.3", "P12", fx=CAM, pulse=PULSE_SOFT),
    R("46.1", "P18", hit=0.6, freeze={"at": 0.0}, fx=["xerox", "rec"], zoom=PUSH,
      text=typed("i wanna call someone who knows me", at="@94.46")),
    R("47.1", "P16", fx=CAM + ["light_leak"], pulse=PULSE_SOFT),
    R("47.3", "P12", hit=0.1, fx=CAM + ["light_leak"], pulse=PULSE_SOFT),
]

# ---- build: "Wake up in the nighttime screaming / I'm fighting everyone" ------
# cut density doubles each bar; then everything stops on "No one is there"
BUILD = [
    R("48.1", "P04", hit=0.1, fx=["zoom_blur", "shake"], grade="cold", zoom=SNAP),
    R("48.3", "P04", hit=0.6, freeze={"at": 0.0}, fx=["invert", "xerox"],
      text=stamp("SCREAMING", at="@99.40")),
    R("49.1", "P09", fx=["step"], pulse=PULSE),
    R("49.2", "P06", hit=0.3, fx=["step"], pulse=PULSE),
    R("49.3", "P09", hit=0.7, fx=["step"], pulse=PULSE),
    R("49.4", "P06", hit=1.0, fx=["step"], pulse=PULSE),
    R("50.1", "P09", hit=1.2, fx=["strobe"], pulse=PULSE,
      text=glitch_word("FIGHTING EVERYONE", at="@101.50")),
    R("50.2", "P10", hit=0.4, pulse=PULSE),
    R("50.3", "P11", fx=["glitch"]),
    R("50.4", "P07", hit=0.15, fx=["shake"]),
    R("51.1", "P05", hit=0.2, fx=["shake_hard", "flash_in"], pulse=PULSE),
    R("51.2", "P08", hit=0.3, pulse=PULSE),
    R("51.3", "P10", hit=1.2, pulse=PULSE),
    R("51.4", "P06", hit=0.8, pulse=PULSE),
    R("52.1", "P09", hit=0.5, fx=["strobe"]),
    R("52.1.5", "P11", hit=0.2, fx=["glitch"]),
    R("52.2", "P07", hit=0.2, fx=["invert_flash"]),
    R("52.2.5", "P06", hit=1.2, fx=["strobe"]),
    R("52.3", "P10", hit=1.3, fx=["glitch"]),
    R("52.3.5", "P05", hit=0.5, fx=["invert_flash"]),
    R("52.4", "P09", hit=1.4, fx=["strobe"]),
    R("52.4.5", "P11", hit=0.8, fx=["glitch", "flash_black"]),
    # "No one is there" — alone in the tunnel
    R("53.1", "P01", speed=0.45, fx=["echo", "letterbox", "grain"], grade="bw", zoom=PUSH,
      text=typed("no one is there", at="@106.40")),
]

# ---- bridge (half-time whisper): one slow shot a bar, trails and light ------
BRIDGE = [
    R("54.1", "P13", speed=0.45, fx=["echo", "light_leak", "grain"], grade="cold", zoom=PUSH),
    R("55.1", "P04", speed=0.45, fx=["echo", "light_leak"], grade="cold", zoom=PUSH,
      text=typed("don't understand for me", at="@111.51")),
    R("56.1", "P17", speed=0.45, fx=["echo", "grain"], grade="cold", zoom=PUSH,
      text=typed("i gotta fight", at="@115.12")),
    R("57.1", "P14", speed=0.45, fx=["echo", "light_leak"], zoom=PUSH),
    R("58.1", "P03", hit=0.3, speed=0.45, fx=["echo", "grain"], grade="cold", zoom=PUSH),
    # the silence before the drop: frozen, letterboxed, creeping in
    R("59.1", "P04", hit=0.5, freeze={"at": 0.0}, fx=["xerox", "letterbox"], zoom={"from": 1.0, "to": 1.35},
      text=typed("i gotta fight", at="@119.64")),
    R("59.4", "P04", hit=0.5, freeze={"at": 0.0}, fx=["invert", "glitch"], glitch={"whole": True, "amount": 0.8},
      zoom={"from": 1.35, "to": 1.5}, text=glitch_word("FOR ME!", at="@121.14")),
]

# ---- the drop: "And it's just not fair / It hurts ever so bad / …not there" ---
DROP = [
    R("60.1", "P07", hit=0.1, fx=BOOM, ramp={"from": 1.0, "to": 0.35, "at": 0.2}, zoom=SNAP),
    R("60.3", "P07", hit=1.6, fx=["invert_flash"], stutter={"len": 0.1, "repeats": 3}, pulse=PULSE),
    R("60.4", "P08", hit=0.3, fx=["whip_in"], pulse=PULSE),
    R("61.1", "P10", hit=1.2, layout="triptych", fx=["glitch", "flash_in"],
      panels=[{"m": "P10", "hit": 1.2}, {"m": "P07", "hit": 1.5}, {"m": "P08", "hit": 0.4}],
      text=ransom("IT'S JUST NOT FAIR", at="@123.83")),
    R("61.3", "P05", hit=0.2, fx=["shake"], pulse=PULSE),
    R("61.4", "P09", hit=0.6, fx=["step"], pulse=PULSE),
    R("62.1", "P10", hit=0.3, fx=["step", "zoom_blur"], pulse=PULSE),
    R("62.2", "P10", hit=1.2, fx=["step"], pulse=PULSE),
    R("62.3", "P10", hit=1.85, fx=["invert_flash", "shake"]),
    R("62.4", "P16", hit=0.4, pulse=PULSE),
    # "It hurts ever so bad"
    R("63.1", "P04", hit=0.2, fx=["posterize", "flash_red", "shake"], zoom=SNAP,
      text=glitch_word("IT HURTS", at="@127.73")),
    R("63.3", "P11", hit=0.5, fx=["glitch"]),
    R("63.4", "P12", fx=["whip_in"], pulse=PULSE),
    R("64.1", "P06", hit=0.4, fx=["step"], pulse=PULSE),
    R("64.2", "P09", hit=0.9, fx=["step"], pulse=PULSE),
    R("64.3", "P06", hit=1.3, fx=["step"], pulse=PULSE),
    R("64.4", "P05", hit=0.5, fx=["strobe", "shake_hard"]),          # the scream
    R("65.1", "P08", hit=0.2, layout="triptych", fx=["flash_in"]),
    R("65.3", "P02", hit=0.3, freeze={"at": 0.0}, fx=["xerox"],
      text=ransom("NOT THERE", at="@133.20")),
    R("65.4", "P14", hit=0.9, pulse=PULSE),
    R("66.1", "P01", hit=0.4, fx=CAM, pulse=PULSE),
    R("66.3", "P17", hit=0.3, fx=CAM),
    R("66.4", "P15", hit=0.2, fx=CAM + ["whip_out"]),
]

# ---- "Cold sweat, cold sweat, cold— sweat calling" — a cut on every "cold" ---
COLD = [
    R("70.1", "P01", hit=0.8, fx=["vhs"], grade="cold", zoom=PUSH),
    R("@142.77", "P04", hit=0.4, freeze={"at": 0.0}, fx=["xerox", "flash_in"], zoom=SNAP,
      text=ransom("COLD SWEAT")),
    R("@143.78", "P13", hit=0.5, freeze={"at": 0.0}, fx=["xerox", "flash_in"], zoom=SNAP,
      text=ransom("COLD SWEAT")),
    R("@144.42", "P02", hit=0.7, freeze={"at": 0.0}, fx=["xerox", "invert_flash"], zoom=SNAP,
      text=ransom("COLD—")),
    R("@144.91", "P05", hit=0.3, fx=["shake_hard", "flash_in"], grade="cold", pulse=PULSE,
      text=glitch_word("SWEAT CALLING")),
    # "Nobody is calling"
    R("72.1", "P18", hit=0.4, fx=CAM, speed=0.7),
    R("72.3", "P17", hit=0.2, fx=["echo"], speed=0.6, grade="cold",
      text=typed("nobody is calling", at="@146.83")),
    # "No time wasting" — fast-forward
    R("73.1", "P09", speed=1.3, fx=["step"], pulse=PULSE_HALF,
      text=stamp("NO TIME WASTING", at="@148.81")),
    R("73.3", "P06", hit=0.4, speed=1.4, fx=["step"], pulse=PULSE_HALF),
    R("73.4", "P10", hit=0.8, speed=1.3, fx=["step"], pulse=PULSE_HALF),
]

# ---- "I feel amazing / like it's an amazing calm out" — warmth at last ------
CALM = [
    R("74.1", "P02", speed=0.5, fx=["light_leak", "glow"], grade="warm", zoom=PUSH),
    R("74.3", "P02", hit=0.6, speed=0.5, fx=["light_leak", "glow"], grade="warm", zoom=PUSH,
      text=typed("i feel amazing", at="@150.89")),
    R("75.1", "P16", speed=0.6, fx=["light_leak", "glow"], grade="warm"),
    R("75.3", "P18", speed=0.6, fx=["light_leak", "glow"], grade="warm"),
    R("76.1", "P13", speed=0.4, fx=["echo", "light_leak"], grade="warm", zoom=PUSH),
    # "Yo, that's crazy" — the tape rewinds through the highlights
    R("77.1", "P10", hit=2.1, speed=1.0, fx=["reverse", "vhs", "rec"]),
    R("77.3", "P07", hit=2.1, speed=1.0, fx=["reverse", "vhs", "rec"]),
]

# ---- finale: the instrumental blast — everything, on the grid --------------
FINALE = [
    R("78.1", "P07", hit=0.1, fx=BOOM, zoom=SNAP),
    R("78.2", "P07", hit=1.6, fx=["invert_flash"], stutter={"len": 0.1, "repeats": 3}),
    R("78.3", "P10", hit=1.2, fx=["shake"], pulse=PULSE),
    R("78.4", "P10", hit=1.85, fx=["invert_flash"]),
    R("79.1", "P05", layout="triptych", fx=["flash_in"],
      panels=[{"m": "P05", "hit": 0.2}, {"m": "P08", "hit": 0.3}, {"m": "P12", "hit": 0.0}]),
    R("79.3", "P09", hit=0.5, fx=["step"]),
    R("79.3.5", "P06", hit=0.9, fx=["step"]),
    R("79.4", "P11", hit=0.3, fx=["glitch"]),
    R("79.4.5", "P16", hit=0.5, fx=["invert_flash"]),
    R("80.1", "P02", layout="grid4", fx=["strobe"],
      panels=[{"m": "P02", "hit": 0.3}, {"m": "P13", "hit": 0.3}, {"m": "P18", "hit": 0.3}, {"m": "P04", "hit": 0.3}]),
    R("80.3", "P05", hit=0.6, fx=["shake_hard", "flash_red"], pulse=PULSE),
    R("80.4", "P08", hit=0.6, fx=["whip_in"], pulse=PULSE),
    R("81.1", "P10", hit=1.3, fx=["flash_in"]),
    R("81.1.5", "P07", hit=1.6, fx=["invert_flash"]),
    R("81.2", "P09", hit=1.2, fx=["glitch"]),
    R("81.2.5", "P06", hit=1.4, fx=["flash_in"]),
    # back to the photocopied name — the same frame the edit opened on, so it loops
    R("81.3", "P14", hit=1.0, freeze={"at": 0.0}, fx=["xerox", "grain", "flash_in"],
      zoom={"from": 1.25, "to": 1.12, "ease": "snap"},
      text=ransom("LAMINE YAMAL")),
]
FINALE_TEXT = [
    # spans two shots, so it's a global overlay
    {"start": "@153.90", "end": "77.1", "content": "like it's an amazing calm out", "style": "typewriter", "pos": "lower"},
    {"start": "81.3", "end": f"@{G.duration}", "content": "BALLON D'OR · 26.10.26", "style": "kicker", "pos": "lower"},
]

SHEETS = {
    "spot_valley": (OPEN + VERSE_A + VERSE_B + FIGURED + BREAKDOWN + CHORUS + CALL + BUILD
                    + BRIDGE + DROP + COLD + CALM + FINALE,
                    OPEN_TEXT + FINALE_TEXT),
}
