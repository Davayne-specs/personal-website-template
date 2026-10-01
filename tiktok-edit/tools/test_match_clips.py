#!/usr/bin/env python3
"""End-to-end test of tools/match_clips.py on a synthetic scenepack (no real HQ footage needed).

    python tools/test_match_clips.py [--work /scratch/dir] [--keep] [--preset ultrafast]

Builds a fake pack from the real previews in clips/v2: each planted preview is upscaled
into a 9:16 / 16:9 / 4:5 / 4K "HQ" frame as a centred window (zoom 1.0-1.2) over a blurred
fill, padded with other footage, re-timed to 24/25/30/50/60 fps, colour-graded and given
a random-looking name. One file holds two shots, one has only 0.3 s of tail, one starts
on the shot. Two extra synthetic previews test letterboxed (black bars) and pillarboxed
(blurred bars) preview windows. Decoys: heavy crops of previews, testsrc, noise. Four
previews have no HQ version. Then runs the matcher and asserts: right file, offset within
one HQ frame, unmatched previews reported, decoys unused, output clips start on the
preview's first frame with the right length and HQ resolution.
Exit 0 = all checks passed. Everything is written under --work (default: a temp dir),
which is deleted afterwards unless --keep.
"""
import argparse
import json
import math
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
TOOL = ROOT / "tools" / "match_clips.py"
SRC_PREVIEWS = ROOT / "clips" / "v2"
PW, PH = 148, 186          # preview window size

G1 = "eq=brightness=0.06:saturation=1.35:gamma=1.15"
G2 = "eq=contrast=1.2:brightness=-0.04:saturation=0.8:gamma=0.85"
G3 = "eq=gamma=1.3:saturation=1.5,colorbalance=rs=0.1:bs=-0.1"

# (file name, (W, H), fps, grade, segments, with_audio)
#   ("shot", P, zoom)        the preview as a centred window of the HQ frame (planted)
#   ("flip", P, seconds)     other footage: mirrored first 40% of P, held to length
#   ("tsrc", seconds) / ("noise", seconds)
#   ("cover", P)             P scaled to cover the whole frame (source for P19/P20)
#   ("crop", P, (x,y,w,h))   heavy crop of P (decoy)
PLAN = [
    ("LAMINE YAMAL 4K (1).mp4", (1080, 1920), 30, None, [("flip", "P02", 1.2), ("shot", "P01", 1.0), ("tsrc", 2.0)], False),
    ("lamine_yamal_scenepack_04.mov", (1080, 1920), 25, G1, [("tsrc", 0.6), ("shot", "P02", 1.1), ("flip", "P05", 1.5)], False),
    ("clip_7739.mp4", (1080, 1920), 60, G2, [("flip", "P07", 2.5), ("shot", "P04", 1.0), ("flip", "P10", 0.8)], False),
    ("yamal 4k uhd.mp4", (2160, 3840), 30, None, [("flip", "P01", 1.0), ("shot", "P05", 1.0), ("tsrc", 1.2)], False),
    ("IMG_2213.MOV", (1080, 1920), 50, None, [("tsrc", 0.5), ("shot", "P06", 1.2), ("flip", "P18", 3.0)], False),
    ("yamal_landscape_broadcast.mkv", (1920, 1080), 25, None, [("flip", "P04", 1.5), ("shot", "P07", 1.0), ("tsrc", 1.0)], False),
    ("scene 8.mp4", (1080, 1920), 24, G3, [("shot", "P08", 1.0), ("flip", "P13", 1.5)], False),
    ("yamal-10.mp4", (1080, 1920), 30, None, [("flip", "P11", 0.9), ("shot", "P10", 1.2), ("flip", "P16", 0.3)], False),
    ("Yamal_45.mp4", (1080, 1350), 30, None, [("flip", "P06", 0.7), ("shot", "P11", 1.0), ("tsrc", 0.7)], True),
    ("multi shots.mp4", (1080, 1920), 30, None, [("tsrc", 1.0), ("shot", "P13", 1.0), ("flip", "P08", 1.0),
                                                 ("shot", "P16", 1.0), ("tsrc", 1.0)], False),
    ("edit pack 15.mp4", (1080, 1920), 30, G1, [("flip", "P17", 0.8), ("shot", "P15", 1.1), ("tsrc", 1.4)], False),
    ("x9f2k.mp4", (1080, 1920), 25, None, [("tsrc", 1.6), ("shot", "P17", 1.0), ("flip", "P15", 1.0)], False),
    ("yamal interview.mp4", (1080, 1920), 60, G2, [("flip", "P05", 2.0), ("shot", "P18", 1.0), ("tsrc", 0.6)], False),
    ("wide_cam_19.mkv", (1920, 1080), 25, None, [("tsrc", 1.0), ("cover", "P09"), ("tsrc", 0.5)], False),
    ("sub/vertical_20.mp4", (1080, 1920), 50, None, [("tsrc", 1.0), ("cover", "P14"), ("tsrc", 0.5)], False),
    # decoys
    ("decoy_crop_03.mp4", (1080, 1920), 30, None, [("crop", "P03", (0.28, 0.25, 0.45, 0.45))], False),
    ("decoy_crop_07.mp4", (1080, 1920), 30, None, [("crop", "P07", (0.0, 0.0, 0.5, 0.5))], False),
    ("decoy_testsrc.mp4", (1080, 1920), 30, None, [("tsrc", 3.0)], False),
    ("decoy_noise.mp4", (1080, 1920), 30, None, [("noise", 3.0)], False),
]
DECOYS = {"decoy_crop_03.mp4", "decoy_crop_07.mp4", "decoy_testsrc.mp4", "decoy_noise.mp4"}
UNPLANTED = ["P03", "P09", "P12", "P14"]
# synthetic previews cut from an HQ file: (pid, source file, HQ start frame, preview frames, kind)
SYNTH = [("P19", "wide_cam_19.mkv", 25 + 8, 45, "black"),
         ("P20", "sub/vertical_20.mp4", 50 + 10, 30, "blur")]


def sh(cmd):
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode != 0:
        raise RuntimeError(f"command failed: {' '.join(map(str, cmd))[:300]}\n{r.stderr.decode()[-1500:]}")
    return r


def nframes(path):
    r = sh(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries",
            "stream=nb_read_packets,width,height", "-of", "json", str(path)])
    s = json.loads(r.stdout)["streams"][0]
    return int(s["nb_read_packets"]), int(s["width"]), int(s["height"])


def window(W, H, z):
    a = PW / PH
    if W / H > a:
        wh, ww = H / z, a * H / z
    else:
        ww, wh = W / z, W / (a * z)
    ww, wh = int(round(ww / 2)) * 2, int(round(wh / 2)) * 2
    return ww, wh, (W - ww) // 2, (H - wh) // 2


def build_hq(spec, prev_dir, pack, K):
    name, (W, H), F, grade, segs, audio = spec
    out = pack / name
    out.parent.mkdir(parents=True, exist_ok=True)
    ins, chains, labs, gt = [], [], [], {}
    total = 0
    tail = f"fps={F},setpts=N/{F}/TB,tpad=stop=-1:stop_mode=clone,trim=end_frame={{n}},setpts=N/{F}/TB,format=yuv420p,setsar=1"
    cover = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}"
    for i, seg in enumerate(segs):
        kind, lab = seg[0], f"s{i}"
        ii = len(ins)
        if kind in ("tsrc", "noise"):
            n = int(round(seg[1] * F))
            src = f"testsrc2=s={W}x{H}:r={F}" if kind == "tsrc" else f"color=c=0x707070:s={W}x{H}:r={F}"
            ins.append(["-f", "lavfi", "-t", f"{seg[1] + 1:.2f}", "-i", src])
            pre = "noise=alls=90:allf=t+u," if kind == "noise" else ""
            chains.append(f"[{ii}:v]{pre}trim=end_frame={n},setpts=N/{F}/TB,format=yuv420p,setsar=1[{lab}]")
        else:
            pid = seg[1]
            ins.append(["-i", str(prev_dir / f"{pid}.mp4")])
            if kind == "shot":
                n = int(math.floor(K[pid] * F / 30 + 0.5))
                ww, wh, x, y = window(W, H, seg[2])
                chains.append(f"[{ii}:v]split[{lab}a][{lab}b];[{lab}a]{cover},boxblur=24:2[{lab}g];"
                              f"[{lab}b]scale={ww}:{wh}:flags=lanczos[{lab}f];[{lab}g][{lab}f]overlay={x}:{y},"
                              + tail.format(n=n) + f"[{lab}]")
                gt[pid] = dict(file=name, frame=total, fps=F, rect=(x / W, y / H, ww / W, wh / H), size=(W, H))
            elif kind == "flip":
                n = int(round(seg[2] * F))
                chains.append(f"[{ii}:v]trim=end_frame={max(2, int(0.4 * K[pid]))},setpts=PTS-STARTPTS,hflip,{cover},"
                              + tail.format(n=n) + f"[{lab}]")
            elif kind == "cover":
                n = int(round(K[pid] * F / 30))
                chains.append(f"[{ii}:v]{cover}," + tail.format(n=n) + f"[{lab}]")
            elif kind == "crop":
                n = int(round(K[pid] * F / 30))
                x, y, w, h = seg[2]
                chains.append(f"[{ii}:v]crop=iw*{w}:ih*{h}:iw*{x}:ih*{y},{cover}," + tail.format(n=n) + f"[{lab}]")
        labs.append(f"[{lab}]")
        total += n
    fc = ";".join(chains) + f";{''.join(labs)}concat=n={len(labs)}:v=1:a=0[cat];[cat]{grade or 'null'}[v]"
    cmd = ["ffmpeg", "-y", "-v", "error", "-nostdin"]
    for a in ins:
        cmd += a
    if audio:
        cmd += ["-f", "lavfi", "-t", f"{total / F:.3f}", "-i", "sine=frequency=440:sample_rate=48000"]
    cmd += ["-filter_complex", fc, "-map", "[v]"]
    if audio:
        cmd += ["-map", f"{len(ins)}:a", "-c:a", "aac", "-b:a", "96k"]
    cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(F), str(out)]
    sh(cmd)
    return gt, total


def build_synth_preview(pid, src, start, n, kind, out):
    base = f"[0:v]trim=start_frame={start},setpts=PTS-STARTPTS,fps=30,trim=end_frame={n},setsar=1"
    if kind == "black":   # 16:9 HQ letterboxed inside the 4:5 preview window
        ch = int(round(PW * 9 / 16 / 2)) * 2
        fc = base + f",scale={PW}:{ch},pad={PW}:{PH}:0:{(PH - ch) // 2}:black[v]"
        content = (0, (PH - ch) // 2, PW, ch)
    else:                 # 9:16 HQ pillarboxed over a blurred copy of itself
        cw = int(round(PH * 9 / 16 / 2)) * 2
        fc = (base + f",split[a][b];[a]scale={PW}:{PH}:force_original_aspect_ratio=increase,crop={PW}:{PH},"
              f"boxblur=6:2[g];[b]scale={cw}:{PH}[f];[g][f]overlay={(PW - cw) // 2}:0[v]")
        content = ((PW - cw) // 2, 0, cw, PH)
    sh(["ffmpeg", "-y", "-v", "error", "-nostdin", "-i", str(src), "-filter_complex", fc, "-map", "[v]",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-r", "30", str(out)])
    return content


def first_frame_ncc(clip, rect_n, preview, content):
    """NCC between the output clip's first frame (GT window) and the preview's first frame."""
    def gray(path):
        _, w, h = nframes(path)
        r = sh(["ffmpeg", "-v", "error", "-i", str(path), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"])
        return np.frombuffer(r.stdout[: w * h], np.uint8).reshape(h, w).astype(np.float32)

    def thumb(img, x, y, w, h):
        sys.path.insert(0, str(ROOT / "tools"))
        import match_clips as mc
        t = mc.thumbs(img[None], (x, y, w, h), 45, 36)[0]
        t = t - t.mean()
        return t / (t.std() + 1e-6)

    a = gray(clip)
    H, W = a.shape
    ta = thumb(a, rect_n[0] * W, rect_n[1] * H, rect_n[2] * W, rect_n[3] * H)
    tb = thumb(gray(preview), *content)
    return float((ta * tb).mean())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", help="scratch dir (default: new temp dir)")
    ap.add_argument("--keep", action="store_true", help="keep the fake pack and outputs")
    ap.add_argument("--preset", default="ultrafast", help="x264 preset passed to the matcher")
    ap.add_argument("--jobs", type=int, default=None)
    args = ap.parse_args()
    work = Path(args.work) if args.work else Path(tempfile.mkdtemp(prefix="match_clips_test_"))
    work.mkdir(parents=True, exist_ok=True)
    pack, prev = work / "fakepack", work / "previews"
    for d in (pack, prev, work / "hq_out", work / "report"):
        shutil.rmtree(d, ignore_errors=True)
    prev.mkdir(parents=True)
    ok = True
    try:
        # ---- previews: the 18 real ones + 2 synthetic letterbox/pillarbox ones
        K = {}
        for p in sorted(SRC_PREVIEWS.glob("P*.mp4")):
            shutil.copy2(p, prev / p.name)
            K[p.stem] = nframes(p)[0]
        t0 = time.time()
        gt, contents = {}, {pid: (0, 0, PW, PH) for pid in K}
        totals = {}
        for spec in PLAN:
            g, totals[spec[0]] = build_hq(spec, prev, pack, K)
            gt.update(g)
        for pid, src, start, n, kind in SYNTH:
            info = next(s for s in PLAN if s[0] == src)
            contents[pid] = build_synth_preview(pid, pack / src, start, n, kind, prev / f"{pid}.mp4")
            K[pid] = nframes(prev / f"{pid}.mp4")[0]
            gt[pid] = dict(file=src, frame=start, fps=info[2], rect=(0, 0, 1, 1), size=info[1])
        print(f"built fake pack: {len(PLAN)} files, {len(gt)} planted previews in {time.time() - t0:.1f}s -> {pack}")

        # ---- run the matcher
        cmd = [sys.executable, str(TOOL), str(pack), "--previews", str(prev), "--out", str(work / "hq_out"),
               "--report", str(work / "report" / "match_report.md"), "--cache", str(work / "cache"),
               "--preset", args.preset]
        if args.jobs:
            cmd += ["--jobs", str(args.jobs)]
        t0 = time.time()
        r = subprocess.run(cmd)
        wall = time.time() - t0
        if r.returncode != 0:
            print(f"FAIL: matcher exited {r.returncode}")
            return 1
        res = json.loads((work / "report" / "match_report.json").read_text())
        P = res["previews"]

        # ---- checks
        fails = []
        print("\npreview  expected file                    gt offset  got offset  err(fr)  score  first-frame NCC")
        for pid in sorted(gt):
            g, R = gt[pid], P.get(pid)
            b = (R or {}).get("best") or {}
            exp_off = g["frame"] / g["fps"]
            line = f"{pid:8s} {g['file'][:32]:32s} {exp_off:9.3f}"
            if not R or not R["matched"]:
                fails.append(f"{pid}: not matched (best {b.get('file_name')} {b.get('app', 0):.3f})")
                print(line + "   NOT MATCHED")
                continue
            got = b["file_name"]
            err = (b["offset"] - exp_off) * g["fps"]
            if got != Path(g["file"]).name:
                fails.append(f"{pid}: matched {got}, expected {g['file']}")
            if abs(err) > 1.0 + 1e-6:
                fails.append(f"{pid}: offset error {err:+.2f} HQ frames")
            ncc = None
            if R.get("out"):
                outp = Path(R["out"]) if Path(R["out"]).is_absolute() else ROOT / R["out"]
                n, w, h = nframes(outp)
                if [w, h] != list(g["size"]):
                    fails.append(f"{pid}: output {w}x{h}, HQ is {g['size']}")
                tail = totals[g["file"]] / g["fps"] - exp_off - K[pid] / 30   # HQ seconds after the shot
                want = K[pid] + min(30, int(math.floor(tail * 30 + 1e-6)))
                if abs(n - want) > 2:
                    fails.append(f"{pid}: output has {n} frames, expected ~{want}")
                ncc = first_frame_ncc(outp, g["rect"], prev / f"{pid}.mp4", contents[pid])
                if ncc < 0.85:
                    fails.append(f"{pid}: output first frame does not look like the preview's (NCC {ncc:.2f})")
            else:
                fails.append(f"{pid}: no output clip written")
            print(line + f"  {b['offset']:10.3f}  {err:+6.2f}  {b['app']:.3f}  {ncc if ncc is None else round(ncc, 3)}"
                  + ("" if got == Path(g['file']).name else f"  WRONG FILE {got}"))
        for pid in UNPLANTED:
            R = P.get(pid)
            b = (R or {}).get("best") or {}
            print(f"{pid:8s} (no HQ version)  -> {'MATCHED ' + str(b.get('file_name')) if R and R['matched'] else 'unmatched'}"
                  f"  best score {b.get('app', 0):.3f}")
            if R and R["matched"]:
                fails.append(f"{pid}: has no HQ version but was matched to {b['file_name']}")
        unused = {Path(f).name for f in res["unused"]}
        for d in sorted(DECOYS):
            if d not in unused:
                fails.append(f"decoy {d} was assigned to a preview")
        print(f"decoys unused: {sorted(DECOYS & unused)}")
        contact = work / "report" / "match_contact.jpg"
        if not contact.exists():
            fails.append("contact sheet missing")
        t = res["timing"]
        print(f"\ntiming: {t['hq_minutes']:.2f} HQ min, coarse {t['coarse_s']:.1f}s + refine {t['refine_s']:.1f}s"
              f" = {t['analysis_s_per_hq_minute']:.1f} s per HQ minute; encode {t['write_s']:.1f}s; wall {wall:.1f}s")
        if fails:
            ok = False
            print("\nFAILED:\n  " + "\n  ".join(fails))
        else:
            print(f"\nALL CHECKS PASSED ({len(gt)} planted, {len(UNPLANTED)} unplanted, {len(DECOYS)} decoys)")
        print(f"report: {work / 'report' / 'match_report.md'}\ncontact sheet: {contact}")
    finally:
        if not args.keep:
            shutil.rmtree(work, ignore_errors=True)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
