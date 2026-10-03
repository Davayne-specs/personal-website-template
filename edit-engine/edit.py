#!/usr/bin/env python3
"""Cut engine: beat-synced fast-cut videos with Spanish captions + English below.

    edit.py init  DIR                  scaffold a project
    edit.py beats PROJECT [--write]    detect BPM + first-beat offset from the audio
    edit.py tap   PROJECT [--from-line N]   play the song, press Enter as each lyric starts -> exact timing
    edit.py shift PROJECT -0.2         nudge every lyric time earlier/later
    edit.py build PROJECT [--preview] [--look bright|gritty] [--4k] [--range A-B] [--seed N] [--out FILE]

Everything is driven by project.json + lyrics.txt, so changing the look,
pacing or captions never needs a rewrite. Needs only ffmpeg/ffprobe + Python 3.
Cut segments are cached, so tweaking captions/audio re-renders in seconds.
"""
import argparse, array, glob, hashlib, json, math, os, random, re, shutil
import subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
FFMPEG, FFPROBE = "ffmpeg", "ffprobe"
THREADS = max(1, (os.cpu_count() or 2) - 2)   # leave the computer some room
VIDEO_EXT = {".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi"}

DEFAULTS = {
    "audio": "song.mp3", "clips": ["clips"], "lyrics": "lyrics.txt",
    "out": "out/video.mp4", "size": [1080, 1920], "fps": 30,
    "bpm": 92, "offset": 0.0, "start": 0, "end": None, "seed": 1,
    "vocals_end": None,            # where the last lyric ends (s); default = song end - 4s
    "scenes": False,               # scan long sources for scene changes (slow)
    "line_beats": 4,               # default length of a lyric line without a timestamp
    "pace": [{"from": 0, "beats": 2}],
    "look": {"contrast": 1.18, "saturation": 0.72, "grain": 16, "vignette": True,
             "shake": 10, "flash": 0.3, "zoom": 0.12,
             "bw": 0.10, "slowmo": 0.06,    # bw/slowmo = chance a cut is B&W / half-speed
             "brightness": 0.0, "gamma": 1.0, "warm": 0.0, "glow": 0.0, "sharpen": 0.0},
    "caption": {"font": "Liberation Sans", "es_size": 112, "en_size": 64,
                "es_color": "#FFFFFF", "en_color": "#F2C94C", "outline": 6,
                "margin_v": 420, "upper": True, "pop": True,
                "lead": 0.08, "max_line": 6},
    "loudnorm": True, "fade_out": 1.0,
}

PRESETS = {
    "gritty": {},
    "bright": {"contrast": 1.06, "saturation": 1.35, "grain": 3, "vignette": False, "shake": 8,
               "flash": 0.35, "zoom": 0.10, "bw": 0.0, "slowmo": 0.08,
               "brightness": 0.07, "gamma": 1.12, "warm": 0.05, "glow": 0.22, "sharpen": 0.6},
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
    r = run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
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
    raw = subprocess.run([FFMPEG, "-v", "error", "-i", audio, "-ac", "1", "-ar", str(sr),
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
LINE_RE = re.compile(rf"^\[?({TS})(?:\s*-\s*({TS}))?\]?\s+(.*)$")
def secs(s):
    parts = [float(x) for x in s.split(":")]
    return sum(p * 60 ** i for i, p in enumerate(reversed(parts)))

def parse_lyrics(path, spec):
    """'0:12.5 Spanish | English' or '0:12.5-0:15 ...'.
    Untimed lines share the time between the timed lines around them, weighted by text length."""
    lines = []
    for raw in open(path, encoding="utf-8"):
        raw = raw.strip()
        if not raw or raw.startswith("#"): continue
        m = LINE_RE.match(raw)
        s_, e, text = (secs(m[1]), secs(m[2]) if m[2] else None, m[3]) if m else (None, None, raw)
        es, _, en = (x.strip() for x in text.partition("|"))
        lines.append({"s": s_, "e": e, "es": es, "en": en})
    if not lines: return lines
    if lines[0]["s"] is None: lines[0]["s"] = spec["start"]
    end = spec["vocals_end"] or max(lines[0]["s"] + 5, spec.get("_total", 0) - 4)
    anchors = [i for i, l in enumerate(lines) if l["s"] is not None] + [len(lines)]
    for a, b in zip(anchors, anchors[1:]):
        grp = lines[a:b]
        if len(grp) == 1: continue
        t0 = grp[0]["s"]; t1 = lines[b]["s"] if b < len(lines) else end
        if t1 <= t0: t1 = t0 + len(grp) * 3
        w = [len(l["es"]) + 8 for l in grp]; acc = 0
        for l, wi in zip(grp, w):
            l["s"] = t0 + (t1 - t0) * acc / sum(w); acc += wi
    mx = spec["caption"]["max_line"]
    for i, l in enumerate(lines):
        if l["e"] is None:
            nxt = lines[i + 1]["s"] if i + 1 < len(lines) else None
            l["e"] = min(nxt - 0.04, l["s"] + mx) if nxt else l["s"] + mx
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
        out.append(f"Dialogue: 0,{ts(max(l['s'] - c['lead'], t0) - t0)},{ts(min(l['e'], t1) - t0)},Default,,0,0,0,,"
                   f"{{\\fad(40,60){pop}}}{es}{en}")
    open(path, "w", encoding="utf-8").write("\n".join(out) + "\n")

# ---------------------------------------------------------------- cutting
def pace_at(spec, t):
    cur = 2
    for p in sorted(spec["pace"], key=lambda p: p["from"]):
        if t >= p["from"]: cur = p["beats"]
    return cur

def plan_cuts(spec, t0, t1):
    """Cut lengths in whole FRAMES (boundaries rounded on the frame grid, so errors never add up)."""
    fps = spec["fps"]; beat = 60 / spec["bpm"]; off = spec["offset"]
    k = math.ceil((t0 - off) / beat - 1e-6)
    bounds = [t0]; t = off + k * beat
    while t < t1 - 0.15:
        if t > bounds[-1] + 0.12: bounds.append(t)
        t += pace_at(spec, t) * beat
    bounds.append(t1)
    fb = [round((t - t0) * fps) for t in bounds]
    cuts, carry = [], 0
    for x, y in zip(fb, fb[1:]):
        n = y - x + carry
        if n < 2: carry = n; continue
        cuts.append(n); carry = 0
    if carry and cuts: cuts[-1] += carry
    return cuts

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
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", path, "-an", "-vf", "select='gt(scene,0.35)',showinfo",
                        "-f", "null", "-"], capture_output=True, text=True)
    pts = [0.0] + [float(x) for x in re.findall(r"pts_time:([\d.]+)", r.stderr)]
    json.dump(pts, open(cf, "w")); return pts

def assign_sources(spec, cuts, files, cache_dir, rng):
    """Spread cuts across ALL clips: least-used clip first, never the last few again,
    and inside a clip prefer footage not used yet."""
    fps, lk = spec["fps"], spec["look"]
    durs = {f: probe_dur(f) for f in files}
    scenes = {f: scene_starts(f, cache_dir) for f in files} if spec["scenes"] else {}
    used = {f: [] for f in files}; usage = {f: 0.0 for f in files}; recent, out = [], []
    k = min(len(files) - 1, max(1, len(files) // 2), 12)
    for n in cuts:
        d = n / fps
        rate = 0.5 if rng.random() < lk["slowmo"] else 1.0   # source seconds per output second
        need = d * rate
        pool = [f for f in files if f not in recent[-k:]] if k else files
        f = min(pool or files, key=lambda f: usage[f] / max(durs[f], 1) + rng.random() * 0.05)
        room = max(0.0, durs[f] - need)
        cands = [x for x in scenes.get(f, []) if x <= room] or [rng.uniform(0, room) for _ in range(14)]
        ov = lambda x: sum(max(0, min(x + need, e) - max(x, b)) for b, e in used[f])
        ss = min(cands, key=lambda x: (round(ov(x), 2), rng.random()))
        used[f].append((ss, ss + need)); usage[f] += need; recent.append(f)
        out.append((f, round(ss, 3), n, rate))
    return out

def cut_filter(spec, n, rate, W, H, rng, i):
    lk = spec["look"]; fps = spec["fps"]; d = n / fps; sc = W / 1080
    amp = lk["shake"] * sc
    z = 1.06 + rng.uniform(0, lk["zoom"]) + 2 * amp / W
    sw, sh = int(W * z) // 2 * 2, int(H * z) // 2 * 2
    x = f"(in_w-out_w)/2+{amp:.1f}*sin(t*{rng.uniform(20, 45):.1f})" if amp else "(in_w-out_w)/2"
    y = f"(in_h-out_h)/2+{amp:.1f}*cos(t*{rng.uniform(20, 45):.1f})" if amp else "(in_h-out_h)/2"
    bw = rng.random() < lk["bw"]
    flash = f"{lk['flash']}*max(0,1-t/0.09)" if lk["flash"] and i % 2 == 0 else "0"
    f = [f"setpts=PTS/{rate}" if rate != 1 else "null", f"fps={fps}",
         f"scale={sw}:{sh}:force_original_aspect_ratio=increase:flags=lanczos", f"crop={W}:{H}:'{x}':'{y}'", "setsar=1"]
    if lk["sharpen"]: f.append(f"unsharp=5:5:{lk['sharpen']}:5:5:0")
    f.append(f"eq=contrast={lk['contrast'] + (0.25 if bw else 0)}:saturation={0 if bw else lk['saturation']}"
             f":gamma={lk['gamma']}:brightness='{lk['brightness']}+{flash}':eval=frame")
    w = lk["warm"]
    if w: f.append(f"colorbalance=rm={w}:gm={w * 0.4:.3f}:bm={-w}:rh={w}:bh={-w * 0.8:.3f}")
    if lk["glow"]:
        f.append(f"split[a][b];[b]scale=iw/4:ih/4,gblur=sigma={5 * sc:.1f},scale={W}:{H}[g];"
                 f"[a][g]blend=all_mode=screen:all_opacity={lk['glow']}")
    if lk["grain"]: f.append(f"noise=alls={lk['grain']}:allf=t")
    if lk["vignette"]: f.append("vignette=PI/4")
    f.append(f"tpad=stop_mode=clone:stop_duration={d + 2:.3f}")
    return ",".join(f)

def render_cut(job):
    src, ss, n, vf, preset, crf, dest = job
    if os.path.exists(dest): return
    tmp = dest + ".part.mp4"
    run([FFMPEG, "-nostdin", "-threads", str(THREADS), "-y", "-v", "error", "-ss", str(ss), "-i", src, "-frames:v", str(n), "-an", "-vf", vf,
         "-c:v", "libx264", "-preset", preset, "-crf", str(crf), "-pix_fmt", "yuv420p", tmp])
    os.replace(tmp, dest)

def has_ass(exe):
    try:
        out = subprocess.run([exe, "-hide_banner", "-filters"], capture_output=True, text=True).stdout
    except OSError:
        return False
    return bool(re.search(r"\bass\b\s+V->V", out))

def check_ffmpeg():
    """Pick an ffmpeg that can draw captions (libass); Homebrew's plain one often can't."""
    global FFMPEG, FFPROBE
    cands = [os.environ.get("FFMPEG"), "ffmpeg", "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg",
             "/usr/local/opt/ffmpeg-full/bin/ffmpeg"]
    for exe in filter(None, cands):
        if has_ass(exe):
            FFMPEG = exe
            probe = os.path.join(os.path.dirname(exe), "ffprobe")
            FFPROBE = probe if os.path.exists(probe) else "ffprobe"
            return
    sys.exit("Your ffmpeg can't draw captions (no libass).\n"
             "Fix on Mac:  brew install ffmpeg-full\n"
             "then run this again (no new terminal needed).")

def build(spec, args):
    check_ffmpeg()
    W, H = spec["size"]
    preview = args.preview
    if args.look: spec["look"] = merge(DEFAULTS["look"], PRESETS[args.look])
    if args.fourk: W, H = 2160, 3840
    if preview: W, H = W // 2, H // 2
    scale = W / 1080
    cache = os.path.join(spec["_dir"], ".cache"); os.makedirs(cache, exist_ok=True)
    audio = rel(spec, spec["audio"])
    total = probe_dur(audio); spec["_total"] = total
    t0, t1 = spec["start"], min(spec["end"] or total, total)
    if args.range:
        a, b = args.range.split("-"); t0, t1 = secs(a), min(secs(b), total)
    seed = args.seed if args.seed is not None else spec["seed"]
    rng = random.Random(seed)
    cuts = plan_cuts(spec, t0, t1)
    files = collect_clips(spec)
    jobs = assign_sources(spec, cuts, files, cache, rng)
    preset, crf = ("ultrafast", 26) if preview else ("veryfast", 14)
    work = []
    for i, (src, ss, n, rate) in enumerate(jobs):
        vf = cut_filter(spec, n, rate, W, H, rng, i)
        key = hashlib.md5(f"{src}{os.path.getmtime(src)}{ss}{n}{vf}{preset}{crf}".encode()).hexdigest()
        work.append((src, ss, n, vf, preset, crf, os.path.join(cache, f"cut_{key}.mp4")))
    todo = sum(not os.path.exists(w[-1]) for w in work)
    print(f"{len(cuts)} cuts ({todo} to render, {len(cuts) - todo} cached) · "
          f"{spec['bpm']} BPM · {t1 - t0:.1f}s · seed {seed}")
    try: os.nice(10)                      # lower priority so the Mac stays responsive
    except (OSError, AttributeError): pass
    workers = args.workers or (1 if args.fourk else 2)
    with ThreadPoolExecutor(max_workers=workers) as ex:
        list(ex.map(render_cut, work))

    lst = os.path.join(cache, "concat.txt")
    open(lst, "w").write("".join(f"file '{w[-1]}'\n" for w in work))
    lyr = rel(spec, spec["lyrics"])
    lines = parse_lyrics(lyr, spec) if os.path.exists(lyr) else []
    ass = os.path.join(cache, "captions.ass")
    write_ass(ass, lines, spec, t0, t1, scale)

    out = args.out or rel(spec, spec["out"].replace(".mp4", "_preview.mp4") if preview else spec["out"])
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    dur = sum(cuts) / spec["fps"]
    af = [f"afade=t=out:st={max(0, dur - spec['fade_out']):.2f}:d={spec['fade_out']}"] if spec["fade_out"] else []
    if spec["loudnorm"]: af.insert(0, "loudnorm=I=-14:TP=-1.5")
    fonts = os.path.join(spec["_dir"], "fonts")
    vf = "ass=filename=captions.ass" + (":fontsdir=fonts" if os.path.isdir(fonts) else "")
    if os.path.isdir(fonts):
        shutil.copytree(fonts, os.path.join(cache, "fonts"), dirs_exist_ok=True)
    run([FFMPEG, "-nostdin", "-threads", str(THREADS), "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", "concat.txt",
         "-ss", f"{t0}", "-t", f"{dur:.3f}", "-i", audio, "-map", "0:v", "-map", "1:a",
         "-vf", vf, "-af", ",".join(af) or "anull", "-c:v", "libx264", "-preset", "veryfast" if preview else "medium",
         "-crf", "28" if preview else ("16" if args.fourk else "18"), "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
         "-shortest", "-movflags", "+faststart", os.path.abspath(out)], cwd=cache)
    print("wrote", out)

# ---------------------------------------------------------------- lyric timing tools
def fmt_t(t):
    t = max(0.0, t); return f"{int(t // 60)}:{t % 60:05.2f}"

def read_lyric_file(path):
    """-> (raw lines, {line index: (time or None, text)}) for the non-comment lines."""
    raw = open(path, encoding="utf-8").read().split("\n")
    items = {}
    for i, l in enumerate(raw):
        l = l.strip()
        if not l or l.startswith("#"): continue
        m = LINE_RE.match(l)
        items[i] = (secs(m[1]), m[3]) if m else (None, l)
    return raw, items

def write_lyric_file(path, raw, items):
    shutil.copy(path, path + ".bak")
    for i, (t, text) in items.items():
        raw[i] = f"{fmt_t(t)} {text}" if t is not None else text
    open(path, "w", encoding="utf-8").write("\n".join(raw))

def tap(spec, args):
    """Play the song; press Enter the moment each lyric line STARTS. Writes the times into lyrics.txt."""
    check_ffmpeg()
    path = rel(spec, spec["lyrics"]); audio = rel(spec, spec["audio"])
    raw, items = read_lyric_file(path)
    order = list(items); first = max(1, args.from_line) - 1
    if first >= len(order): sys.exit(f"Only {len(order)} lyric lines.")
    t_first = items[order[first]][0]
    start_at = args.from_time if args.from_time is not None else (max(0, t_first - 4) if t_first is not None else spec["start"])
    wav = os.path.join(spec["_dir"], ".cache"); os.makedirs(wav, exist_ok=True); wav = os.path.join(wav, "tap.wav")
    run([FFMPEG, "-nostdin", "-y", "-v", "error", "-ss", str(start_at), "-i", audio, "-ac", "2", wav])
    player = (["afplay", wav] if shutil.which("afplay") else
              [os.path.join(os.path.dirname(FFMPEG), "ffplay") if os.path.exists(os.path.join(os.path.dirname(FFMPEG), "ffplay")) else "ffplay",
               "-nodisp", "-autoexit", "-loglevel", "quiet", wav])
    print(f"\nTAP MODE - starting at {fmt_t(start_at)}, line {first + 1} of {len(order)}.\n"
          "Press ENTER right when each line STARTS being sung.\n"
          "  s + ENTER = skip a line (it gets spread automatically)    q + ENTER = save and quit\n")
    input("Ready? Press ENTER to start the music...")
    proc = None if args.no_play else subprocess.Popen(player, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    t_zero = time.monotonic()
    try:
        for n, i in enumerate(order[first:], first + 1):
            t, text = items[i]
            print(f"  [{n}/{len(order)}]  {text.split('|')[0].strip()}")
            ans = input("      > ").strip().lower()
            if ans == "q": break
            if ans == "s": items[i] = (None, text); continue
            items[i] = (round(start_at + time.monotonic() - t_zero - args.react, 2), text)
    finally:
        if proc: proc.terminate()
        write_lyric_file(path, raw, items)
        print(f"\nSaved {path}  (backup: lyrics.txt.bak). Now run build --preview.")

def shift(spec, args):
    path = rel(spec, spec["lyrics"]); raw, items = read_lyric_file(path)
    for i, (t, text) in items.items():
        if t is not None: items[i] = (t + args.seconds, text)
    write_lyric_file(path, raw, items)
    print(f"Moved every timed line {args.seconds:+.2f}s. (backup: lyrics.txt.bak)")

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
    r.add_argument("--look", choices=sorted(PRESETS), help="bright (blissful) or gritty; overrides project.json look")
    r.add_argument("--4k", dest="fourk", action="store_true", help="2160x3840 final (slow, ~4x the time)")
    r.add_argument("--workers", type=int, help="parallel renders (default 2, or 1 for 4K); lower = gentler on your Mac")
    r.add_argument("--out")
    t = sub.add_parser("tap", help="time the lyrics by tapping Enter while the song plays")
    t.add_argument("project"); t.add_argument("--from-line", type=int, default=1, help="redo from this line number")
    t.add_argument("--from-time", type=float, help="start playback at this second")
    t.add_argument("--react", type=float, default=0.15, help="your reaction delay in seconds, subtracted from each tap")
    t.add_argument("--no-play", action="store_true")
    sh = sub.add_parser("shift", help="move all lyric times, e.g. shift project.json -0.2")
    sh.add_argument("project"); sh.add_argument("seconds", type=float)
    a = ap.parse_args()
    if a.cmd == "init": return init(a.dir)
    spec = load_project(a.project)
    if a.cmd == "tap": return tap(spec, a)
    if a.cmd == "shift": return shift(spec, a)
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
