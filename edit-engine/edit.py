#!/usr/bin/env python3
"""Cut engine: beat-synced fast-cut videos with Spanish captions + English below.

    edit.py init  DIR                  scaffold a project
    edit.py beats PROJECT [--write]    detect BPM + first-beat offset from the audio
    edit.py build PROJECT [--preview] [--range A-B] [--seed N] [--out FILE]

Everything is driven by project.json + lyrics.txt, so changing the look,
pacing or captions never needs a rewrite. Needs only ffmpeg/ffprobe + Python 3.
Cut segments are cached, so tweaking captions/audio re-renders in seconds.
"""
import argparse, array, glob, hashlib, json, math, os, random, re, shutil
import subprocess, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO_EXT = {".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi"}

DEFAULTS = {
    "audio": "song.mp3", "clips": ["clips"], "lyrics": "lyrics.txt",
    "out": "out/video.mp4", "size": [1080, 1920], "fps": 30,
    "bpm": 92, "offset": 0.0, "start": 0, "end": None, "seed": 1,
    "scenes": False,               # scan long sources for scene changes (slow)
    "line_beats": 4,               # default length of a lyric line without a timestamp
    "pace": [{"from": 0, "beats": 2}],
    "look": {"contrast": 1.18, "saturation": 0.72, "grain": 16, "vignette": True,
             "shake": 10, "flash": 0.3, "zoom": 0.12},
    "caption": {"font": "Liberation Sans", "es_size": 112, "en_size": 64,
                "es_color": "#FFFFFF", "en_color": "#F2C94C", "outline": 6,
                "margin_v": 420, "upper": True, "pop": True},
    "loudnorm": True, "fade_out": 1.0,
}

def merge(base, over):
    out = dict(base)
    for k, v in over.items():
        out[k] = merge(base[k], v) if isinstance(v, dict) and isinstance(base.get(k), dict) else v
    return out

def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode:
        sys.exit(f"ffmpeg failed:\n{' '.join(cmd)}\n{r.stderr[-1500:]}")
    return r

def probe_dur(path):
    r = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", path])
    return float(r.stdout.strip())

def load_project(path):
    path = os.path.abspath(path)
    with open(path) as f:
        spec = merge(DEFAULTS, json.load(f))
    spec["_dir"] = os.path.dirname(path)
    return spec

def rel(spec, p):
    return p if os.path.isabs(p) else os.path.join(spec["_dir"], p)

# ---------------------------------------------------------------- beats
def detect_beats(audio, lo=70, hi=160):
    """Energy-flux onset curve -> (bpm, first-beat offset). Pure stdlib."""
    sr, hop = 11025, 256
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", audio, "-ac", "1", "-ar", str(sr),
                          "-f", "s16le", "-"], capture_output=True).stdout
    pcm = array.array("h"); pcm.frombytes(raw[: len(raw) // 2 * 2])
    env = [math.log1p(sum(abs(x) for x in pcm[i:i + hop]) / hop) for i in range(0, len(pcm) - hop, hop)]
    flux = [max(0.0, env[i] - env[i - 1]) for i in range(1, len(env))]
    fr = hop / sr
    best = (-1, 0, 0)
    bpm = float(lo)
    while bpm <= hi:
        p = 60 / bpm / fr
        for ph in range(int(p)):
            n = int((len(flux) - ph) / p)
            s = sum(flux[int(ph + k * p)] for k in range(n)) / max(n, 1)
            if s > best[0]: best = (s, bpm, ph * fr)
        bpm += 0.5
    return best[1], best[2]

# ---------------------------------------------------------------- lyrics
TS = r"(?:\d+:)?\d+(?:\.\d+)?"
def secs(s):
    parts = [float(x) for x in s.split(":")]
    return sum(p * 60 ** i for i, p in enumerate(reversed(parts)))

def parse_lyrics(path, spec):
    """'0:12.5 Spanish | English' or '0:12.5-0:15 ...'; untimed lines follow the previous one."""
    beat = 60 / spec["bpm"]; lines = []; cursor = spec["start"]
    for raw in open(path, encoding="utf-8"):
        raw = raw.strip()
        if not raw or raw.startswith("#"): continue
        m = re.match(rf"^\[?({TS})(?:\s*-\s*({TS}))?\]?\s+(.*)$", raw)
        s, e, text = (secs(m[1]), secs(m[2]) if m[2] else None, m[3]) if m else (cursor, None, raw)
        es, _, en = (x.strip() for x in text.partition("|"))
        lines.append({"s": s, "e": e, "es": es, "en": en})
        cursor = s + spec["line_beats"] * beat
    for i, l in enumerate(lines):
        if l["e"] is None:
            nxt = lines[i + 1]["s"] if i + 1 < len(lines) else None
            cap = l["s"] + min(6, spec["line_beats"] * beat)
            l["e"] = min(nxt - 0.04, cap) if nxt else cap
    return lines

def ass_color(hexs):
    h = hexs.lstrip("#"); return f"&H00{h[4:6]}{h[2:4]}{h[0:2]}"

def write_ass(path, lines, spec, t0, t1, scale):
    c = spec["caption"]; W, H = spec["size"]
    def ts(t):
        t = max(0, t); return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"
    es_sz, en_sz = int(c["es_size"] * scale), int(c["en_size"] * scale)
    out = [f"[Script Info]\nScriptType: v4.00+\nPlayResX: {W}\nPlayResY: {H}\nWrapStyle: 0\n",
           "[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,"
           "Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,"
           "MarginL,MarginR,MarginV,Encoding",
           f"Style: Default,{c['font']},{es_sz},{ass_color(c['es_color'])},&H000000FF,&H00000000,&H80000000,"
           f"-1,0,0,0,100,100,1,0,1,{c['outline'] * scale:.1f},2,2,{int(60 * scale)},{int(60 * scale)},"
           f"{int(c['margin_v'] * scale)},1\n",
           "[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text"]
    clean = lambda s: s.replace("{", "(").replace("}", ")")
    for l in lines:
        if l["e"] <= t0 or l["s"] >= t1: continue
        es = clean(l["es"]).upper() if c["upper"] else clean(l["es"])
        pop = r"\fscx115\fscy115\t(0,110,\fscx100\fscy100)" if c["pop"] else ""
        en = f"\\N{{\\fs{en_sz}\\c{ass_color(c['en_color'])}\\i1\\bord{max(1, c['outline'] * scale * .7):.1f}}}{clean(l['en'])}" if l["en"] else ""
        out.append(f"Dialogue: 0,{ts(max(l['s'], t0) - t0)},{ts(min(l['e'], t1) - t0)},Default,,0,0,0,,"
                   f"{{\\fad(40,60){pop}}}{es}{en}")
    open(path, "w", encoding="utf-8").write("\n".join(out) + "\n")

# ---------------------------------------------------------------- cutting
def pace_at(spec, t):
    cur = 2
    for p in sorted(spec["pace"], key=lambda p: p["from"]):
        if t >= p["from"]: cur = p["beats"]
    return cur

def plan_cuts(spec, t0, t1):
    beat = 60 / spec["bpm"]; off = spec["offset"]
    k = math.ceil((t0 - off) / beat - 1e-6)
    bounds = [t0]; t = off + k * beat
    while t < t1 - 0.15:
        if t > bounds[-1] + 0.12: bounds.append(t)
        t += pace_at(spec, t) * beat
    bounds.append(t1)
    return list(zip(bounds, bounds[1:]))

def collect_clips(spec):
    files = []
    for item in spec["clips"]:
        p = rel(spec, item)
        if os.path.isdir(p):
            files += [os.path.join(p, f) for f in sorted(os.listdir(p)) if os.path.splitext(f)[1].lower() in VIDEO_EXT]
        else:
            files += sorted(glob.glob(p))
    if not files: sys.exit("No clips found - drop videos in the clips/ folder.")
    return files

def scene_starts(path, cache_dir):
    key = hashlib.md5(f"{path}{os.path.getmtime(path)}".encode()).hexdigest()
    cf = os.path.join(cache_dir, f"scenes_{key}.json")
    if os.path.exists(cf): return json.load(open(cf))
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-an", "-vf", "select='gt(scene,0.35)',showinfo",
                        "-f", "null", "-"], capture_output=True, text=True)
    pts = [0.0] + [float(x) for x in re.findall(r"pts_time:([\d.]+)", r.stderr)]
    json.dump(pts, open(cf, "w")); return pts

def assign_sources(spec, cuts, files, cache_dir, rng):
    bag, last, out = [], None, []
    durs = {f: probe_dur(f) for f in files}
    scenes = {f: scene_starts(f, cache_dir) for f in files} if spec["scenes"] else {}
    for (a, b) in cuts:
        d = b - a
        if not bag:
            bag = files[:]; rng.shuffle(bag)
            if bag[-1] == last and len(bag) > 1: bag[0], bag[-1] = bag[-1], bag[0]
        f = bag.pop(); last = f
        room = max(0.0, durs[f] - d)
        cands = [s for s in scenes.get(f, []) if s <= room]
        ss = rng.choice(cands) if cands else rng.uniform(0, room)
        out.append((f, round(ss, 3), d))
    return out

def cut_filter(spec, d, W, H, rng, i):
    lk = spec["look"]; fps = spec["fps"]
    z = 1.06 + rng.uniform(0, lk["zoom"]) + 2 * lk["shake"] / W
    sw, sh = int(W * z) // 2 * 2, int(H * z) // 2 * 2
    sh_amp = lk["shake"]
    x = f"(in_w-out_w)/2+{sh_amp}*sin(t*{rng.uniform(20, 45):.1f})" if sh_amp else "(in_w-out_w)/2"
    y = f"(in_h-out_h)/2+{sh_amp}*cos(t*{rng.uniform(20, 45):.1f})" if sh_amp else "(in_h-out_h)/2"
    bright = f"{lk['flash']}*max(0,1-t/0.09)" if lk["flash"] and i % 2 == 0 else "0"
    f = [f"fps={fps}", f"scale={sw}:{sh}:force_original_aspect_ratio=increase", f"crop={W}:{H}:'{x}':'{y}'",
         "setsar=1", f"eq=contrast={lk['contrast']}:saturation={lk['saturation']}:brightness='{bright}':eval=frame"]
    if lk["grain"]: f.append(f"noise=alls={lk['grain']}:allf=t")
    if lk["vignette"]: f.append("vignette=PI/4")
    f.append(f"tpad=stop_mode=clone:stop_duration={d:.3f}")
    return ",".join(f)

def render_cut(job):
    src, ss, d, vf, W, H, preset, crf, dest = job
    if os.path.exists(dest): return
    tmp = dest + ".part.mp4"
    run(["ffmpeg", "-y", "-v", "error", "-ss", str(ss), "-i", src, "-t", f"{d:.3f}", "-an", "-vf", vf,
         "-c:v", "libx264", "-preset", preset, "-crf", str(crf), "-pix_fmt", "yuv420p", tmp])
    os.replace(tmp, dest)

# ---------------------------------------------------------------- build
def build(spec, args):
    W, H = spec["size"]; scale = 1.0
    preview = args.preview
    if preview: W, H, scale = W // 2, H // 2, 0.5
    cache = os.path.join(spec["_dir"], ".cache"); os.makedirs(cache, exist_ok=True)
    audio = rel(spec, spec["audio"])
    total = probe_dur(audio)
    t0, t1 = spec["start"], spec["end"] or total
    if args.range:
        a, b = args.range.split("-"); t0, t1 = secs(a), secs(b)
    seed = args.seed if args.seed is not None else spec["seed"]
    rng = random.Random(seed)
    cuts = plan_cuts(spec, t0, min(t1, total))
    files = collect_clips(spec)
    jobs = assign_sources(spec, cuts, files, cache, rng)
    preset, crf = ("ultrafast", 26) if preview else ("veryfast", 14)
    work = []
    for i, ((src, ss, d)) in enumerate(jobs):
        vf = cut_filter(spec, d, W, H, rng, i)
        key = hashlib.md5(f"{src}{os.path.getmtime(src)}{ss}{d}{vf}{preset}{crf}".encode()).hexdigest()
        work.append((src, ss, d, vf, W, H, preset, crf, os.path.join(cache, f"cut_{key}.mp4")))
    todo = sum(not os.path.exists(w[-1]) for w in work)
    print(f"{len(cuts)} cuts ({todo} to render, {len(cuts) - todo} cached) · "
          f"{spec['bpm']} BPM · {t1 - t0:.1f}s · seed {seed}")
    with ThreadPoolExecutor(max_workers=os.cpu_count() or 2) as ex:
        list(ex.map(render_cut, work))

    lst = os.path.join(cache, "concat.txt")
    open(lst, "w").write("".join(f"file '{w[-1]}'\n" for w in work))
    lyr = rel(spec, spec["lyrics"])
    lines = parse_lyrics(lyr, spec) if os.path.exists(lyr) else []
    ass = os.path.join(cache, "captions.ass")
    write_ass(ass, lines, spec, t0, t1, scale)

    out = args.out or rel(spec, spec["out"].replace(".mp4", "_preview.mp4") if preview else spec["out"])
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    dur = t1 - t0
    af = [f"afade=t=out:st={max(0, dur - spec['fade_out']):.2f}:d={spec['fade_out']}"] if spec["fade_out"] else []
    if spec["loudnorm"]: af.insert(0, "loudnorm=I=-14:TP=-1.5")
    fonts = os.path.join(spec["_dir"], "fonts")
    vf = "ass=filename=captions.ass" + (":fontsdir=fonts" if os.path.isdir(fonts) else "")
    if os.path.isdir(fonts):
        shutil.copytree(fonts, os.path.join(cache, "fonts"), dirs_exist_ok=True)
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", "concat.txt",
         "-ss", f"{t0}", "-t", f"{dur:.3f}", "-i", audio, "-map", "0:v", "-map", "1:a",
         "-vf", vf, "-af", ",".join(af) or "anull", "-c:v", "libx264", "-preset", "veryfast" if preview else "medium",
         "-crf", "28" if preview else "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
         "-shortest", "-movflags", "+faststart", os.path.abspath(out)], cwd=cache)
    print("wrote", out)

# ---------------------------------------------------------------- scaffold / cli
def init(d):
    os.makedirs(os.path.join(d, "clips"), exist_ok=True)
    for f in ("project.json", "lyrics.txt"):
        shutil.copy(os.path.join(HERE, "example", f), os.path.join(d, f))
    print(f"Project ready in {d}: add song.mp3 + clips/*.mp4, edit lyrics.txt, then:\n"
          f"  python3 {sys.argv[0]} beats {d}/project.json --write\n"
          f"  python3 {sys.argv[0]} build {d}/project.json --preview")

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init").add_argument("dir")
    b = sub.add_parser("beats"); b.add_argument("project"); b.add_argument("--write", action="store_true")
    r = sub.add_parser("build"); r.add_argument("project")
    r.add_argument("--preview", action="store_true", help="half-res fast render")
    r.add_argument("--range", help="only this audio window, e.g. 20-45 or 0:20-0:45")
    r.add_argument("--seed", type=int, help="reroll clip choices")
    r.add_argument("--out")
    a = ap.parse_args()
    if a.cmd == "init": return init(a.dir)
    spec = load_project(a.project)
    if a.cmd == "beats":
        bpm, off = detect_beats(rel(spec, spec["audio"]))
        print(f"bpm ≈ {bpm:.1f}  (if it feels double/half-time, use {bpm * 2:.1f} or {bpm / 2:.1f})  first beat ≈ {off:.2f}s")
        if a.write:
            p = os.path.abspath(a.project); j = json.load(open(p))
            j["bpm"], j["offset"] = round(bpm, 1), round(off, 3)
            json.dump(j, open(p, "w"), indent=2); print("saved to", p)
    else:
        build(spec, a)

if __name__ == "__main__":
    main()
