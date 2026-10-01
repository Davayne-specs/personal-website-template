"""Musical time for one song: bars, beats and lyric lookups from its beat map."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Grid:
    def __init__(self, beatmap):
        self.path = beatmap
        bm = json.load(open(os.path.join(ROOT, beatmap)))
        self.bm = bm
        self.ph, self.bar, self.beat = bm["first_downbeat"], bm["bar"], bm["beat"]
        self.duration = bm["duration"]

    def B(self, k):
        """Start of bar k (song seconds)."""
        return round(self.ph + k * self.bar, 4)

    def pos(self, spec):
        """'14.3.5' → song seconds (bar 14, beat 3, + half a beat); '@92.07' → 92.07."""
        if str(spec).startswith("@"):
            return float(spec[1:])
        parts = [float(p) for p in str(spec).split(".")]
        bar, beat = parts[0], parts[1] if len(parts) > 1 else 1
        frac = parts[2] / 10 if len(parts) > 2 else 0
        return self.ph + bar * self.bar + (beat - 1 + frac) * self.beat

    def section_at(self, t):
        for sec in self.bm.get("sections", []):
            if sec["start"] - 1e-3 <= t < sec["end"] - 1e-3:
                return sec["name"]
        return ""

    def lyric_at(self, t):
        for ly in self.bm.get("lyrics", []):
            if ly["start"] <= t < ly["end"]:
                return ly["text"]
        return ""
