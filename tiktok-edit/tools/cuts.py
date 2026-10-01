"""Cut sheets for the two edits, in musical time on the ORIGINAL song.

Row: R(at, moment, **options)
  at          "bar.beat[.tenths]" where the shot starts (it ends where the next row starts)
  moment      id in research/moments.json → clips/<id>.mp4
  hit         "hit"   = key action lands on the cut (default)
              "build" = show the lead-up (1.2 s before the key action)
              "net"   = just after (0.5 s)
              "cele"  = the celebration (1.8 s after)
  hit_beat    land the key action this many beats into the shot instead of on the cut
  speed, ramp, zoom, fx, grade, focus_x, fit, text — passed through to the EDL

Lyric times come from analysis/beatmap.json (song seconds, written "@84.08").
"""

OFFSETS = {"hit": 0.0, "build": -1.2, "net": 0.5, "cele": 1.8}


def R(at, m, hit="hit", **kw):
    row = {"at": at, "m": m, "hit_offset": OFFSETS[hit] if isinstance(hit, str) else hit}
    row.update(kw)
    return row


def lyric(content, at, until=None):
    t = {"content": content, "style": "lyric", "pos": "center", "at": at}
    if until:
        t["until"] = until
    return t


def card(content):
    return {"content": content, "style": "stat", "pos": "upper", "in": 0.0}


def soft(content, start, end):
    """Lower-case bridge lyric as a global overlay (spans cuts)."""
    return {"start": start, "end": end, "content": content, "style": "quote", "pos": "lower"}


PUNCH = {"from": 1.0, "to": 1.14}
SLOW_PUSH = {"from": 1.02, "to": 1.12}
HIT = ["flash_in", "shake"]

# ---------------------------------------------------------------------------
# ACT 1 — "it's so damn close": runner-up in 2025 (drop-out, bars 6–7)
HOOK = [
    R("6.1", "b02", fx=["flash_in"], zoom={"from": 1.0, "to": 1.22}, grade="gold",
      text={"content": "2ND IN 2025.", "style": "title", "pos": "upper", "in": 0.0}),
    R("6.3", "n08", grade="bw", zoom=SLOW_PUSH, speed=0.6),
    R("7.1", "n07", grade="gold", zoom=SLOW_PUSH, speed=0.7,
      text=lyric("so damn close", "@15.66")),
    R("7.3", "b01", fx=["dip_white"], zoom={"from": 1.0, "to": 1.25}, speed=0.6),
]

# the season, goal by goal — the kick returns on 8.1; cuts tighten each bar
BUILD = [
    R("8.1", "c18", fx=HIT, zoom=PUNCH),
    R("8.3", "c13"),
    R("9.1", "c07", fx=["flash_in"]),
    R("9.3", "c10"),
    R("10.1", "c15", fx=["flash_in"]),
    R("10.3", "c16", hit="build"),
    R("11.1", "c20", fx=["flash_in"]),
    R("11.3", "c12"),
    R("12.1", "c17", fx=["shake"]),
    R("12.2", "c17", hit="cele"),
    R("12.3", "c08", fx=["shake"]),
    R("12.4", "c08", hit="net"),
    R("13.1", "n19", fx=["shake"]),
    R("13.2", "n22"),
    R("13.3", "c07", hit="cele"),
    R("13.3.5", "c10", hit="cele"),
    R("13.4", "c15", hit="cele"),
    R("13.4.5", "c16", fx=["dip_white"]),
]

# ACT 2 — "Rain on me": trophies, skills, goals (chorus, bars 14–20)
CHORUS = [
    R("14.1", "n26", fx=HIT, grade="gold", zoom=PUNCH, text=lyric("RAIN ON ME", "@30.27", "14.3")),
    R("14.3", "n24w", grade="gold"),
    R("14.4", "c09", grade="gold"),
    # "Don't tell me stop, no"
    R("15.1", "k01", fx=["shake"]),
    R("15.2", "k02"),
    R("15.3", "k03", fx=["shake"]),
    R("15.4", "k04"),
    # "Rain on me" — the scissor-kick in the hail
    R("16.1", "c02", fx=HIT, hit_beat=0.5, ramp={"from": 1.0, "to": 0.3, "at": 0.2},
      text=lyric("RAIN ON ME", "@34.58", "16.3")),
    R("16.3", "c02", hit="cele"),
    R("16.4", "c17", hit="build"),
    # "I don't care 'bout cops, just"
    R("17.1", "k05", fx=["shake"]),
    R("17.2", "k06"),
    R("17.3", "k07", fx=["shake"]),
    R("17.4", "c16"),
    # "Rain on me" — champions
    R("18.1", "c14", fx=HIT, grade="gold", text=lyric("RAIN ON ME", "@38.86", "18.3")),
    R("18.3", "c01", fx=["shake"]),
    R("18.4", "c01", hit="net"),
    # "Bring it down, I need it" x2
    R("19.1", "c03", fx=["flash_in"], hit_beat=1, text=lyric("BRING IT DOWN", "@40.56", "19.3")),
    R("19.3", "c06", fx=["shake"]),
    R("19.4", "c06", hit="net"),
    R("20.1", "c08", hit="cele", fx=["flash_in"]),
    R("20.2", "c18", hit="net"),
    R("20.3", "c20", hit="cele"),
    R("20.4", "c04", fx=["flash_out"]),
    # drop-out: "Fighting my whole life, I'm still defeated"
    R("21.1", "c04d", grade="bw", speed=0.5, zoom=SLOW_PUSH, fx=["vignette"]),
    R("21.3", "c05", grade="bw", speed=0.5, zoom=SLOW_PUSH, fx=["vignette"]),
]

# ACT 3 — "Settle down, my child" (bridge, bars 38–45). Soft, slow, one cut per lyric.
BRIDGE = [
    R("38.1", "n01", grade="warm", zoom={"from": 1.0, "to": 1.18}, fx=["fade_in", "glow", "grain"]),
    R("39.1", "n27", grade="warm", speed=0.6, zoom=SLOW_PUSH, fx=["glow"]),
    R("40.1", "c05", grade="cold", speed=0.5, fx=["grain"]),
    R("40.3", "n17", grade="cold", speed=0.6),
    R("41.1", "n12", speed=0.6, fx=["grain"]),
    R("41.3", "b03", speed=0.6, grade="cold"),
    R("42.1", "c01", hit="build", speed=0.45, zoom=SLOW_PUSH, fx=["glow"]),
    R("42.4", "n30", speed=0.7),
    R("43.3", "n19", hit="cele", speed=0.6, grade="warm"),
    R("44.1", "n25", grade="warm", speed=0.5, zoom=SLOW_PUSH, fx=["glow"]),
    R("45.1", "n26", grade="gold", speed=0.4, zoom={"from": 1.0, "to": 1.2}, fx=["glow"]),
]
BRIDGE_LYRICS = [
    soft("settle down, babe", "@82.68", "39.1"),
    soft("settle down, my child", "@84.08", "@86.30"),
    soft("you worry too much", "@86.49", "@88.40"),
    soft("you try to fight the whole crowd", "@88.67", "@90.38"),
    soft("just run at your pace", "@90.43", "@91.95"),
    soft("don't think about them", "@92.07", "@94.90"),
    soft("they're running at the stars in the sky", "@95.14", "@97.38"),
    soft("they can catch them", "@97.40", "46.1"),
]

# ACT 4 — the case (break, bars 60–61): music drops, the cards land
BREAK = [
    R("60.1", "n24w", speed=0.5, grade="gold", text=card("WORLD CHAMPION\nAT 19")),
    R("60.3", "n26", hit="cele", speed=0.6, grade="gold"),
    R("61.1", "c14", speed=0.6, grade="gold", text=card("LALIGA CHAMPION\nPLAYER OF THE SEASON")),
    R("61.3", "k07", speed=0.8),
    R("61.4", "k01", hit="build"),
    R("61.4.5", "k02", fx=["dip_white"]),
]

# climax (bars 62–68): one cut per beat, half-beats in the last bar
CLIMAX = [
    R("62.1", "c02", fx=HIT, hit_beat=0.5, ramp={"from": 1.0, "to": 0.3, "at": 0.2}),
    R("62.3", "c01", fx=["shake"]),
    R("62.4", "c01", hit="cele"),
    R("63.1", "c06", fx=["flash_in"], hit_beat=1),
    R("63.3", "c18", fx=["shake"]),
    R("63.4", "c08", fx=["shake"]),
    R("64.1", "c03", fx=["flash_in"], hit_beat=1, text=card("24 GOALS · 17 ASSISTS\nBARÇA 2025-26")),
    R("64.3", "c07", fx=["shake"]),
    R("64.4", "c15", fx=["shake"]),
    R("65.1", "n18", fx=HIT, hit_beat=0.5),
    R("65.3", "n22", fx=["shake"]),
    R("65.4", "n19", fx=["shake"]),
    R("66.1", "n05", fx=["flash_in"], grade="gold", text=card("FIRST TEENAGER EVER\nEUROS + WORLD CUP")),
    R("66.2", "n26", grade="gold"),
    R("66.3", "n24", fx=["shake"]),
    R("66.4", "n24w", grade="gold"),
    R("67.1", "n26", hit="cele", fx=["flash_in"], grade="gold"),
    R("67.2", "c09", grade="gold"),
    R("67.3", "c14", grade="gold"),
    R("67.4", "n03"),
    R("68.1", "k03", fx=["shake"]),
    R("68.1.5", "k05"),
    R("68.2", "c10", fx=["shake"]),
    R("68.2.5", "c17"),
    R("68.3", "c16", fx=["shake"]),
    R("68.3.5", "c20"),
    R("68.4", "c12", fx=["shake"]),
    R("68.4.5", "k06", fx=["dip_white"]),
]

# the last "Hey, I feel it coming" — back to the trophy (matches the first frame, so it loops)
ENDING = [
    R("69.1", "b02", grade="gold", zoom={"from": 1.22, "to": 1.0}, fx=["flash_in", "glow"],
      text={"content": "26.10 · LONDON", "style": "title", "pos": "upper", "in": 0.4}),
]
ENDING_OVERLAYS = [
    {"start": "@148.23", "end": "@150.84", "content": "BALLON D'OR 2026", "style": "kicker", "pos": "lower"},
]

STORY = HOOK + BUILD + CHORUS + BRIDGE + BREAK + CLIMAX + ENDING
STORY_OVERLAYS = [
    {"start": "6.1", "end": "8.1", "content": "BALLON D'OR 2026", "style": "kicker", "pos": "lower"},
    soft("fighting my whole life, i'm still defeated", "@44.62", "22.1"),
] + BRIDGE_LYRICS + ENDING_OVERLAYS

# 30-second cut: drop-out → two bars of goals → the case → climax
SHORT_BUILD = [
    R("8.1", "c13", fx=HIT, zoom=PUNCH),
    R("8.3", "c04"),
    R("8.4", "c12", hit="net"),
    R("9.1", "c18", fx=HIT, hit="build"),
    R("9.3", "c17", hit="cele"),
    R("9.4", "k04", fx=["dip_white"]),
]

SHORT = HOOK + SHORT_BUILD + BREAK + CLIMAX + ENDING
SHORT_OVERLAYS = [
    {"start": "6.1", "end": "8.1", "content": "BALLON D'OR 2026", "style": "kicker", "pos": "lower"},
] + ENDING_OVERLAYS

SHEETS = {"story": (STORY, STORY_OVERLAYS), "short": (SHORT, SHORT_OVERLAYS)}
