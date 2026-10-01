#!/usr/bin/env python3
"""Download the footage listed in research/youtube_links.json.

    python tools/fetch_clips.py                  # every clip
    python tools/fetch_clips.py --only c02,n18   # just these
    python tools/fetch_clips.py --dry-run        # show what would happen

For each clip:
  - `at` set (second of the key action in the source video): downloads only
    [at-3, at+5] and writes clips/<id>.mp4, 8 s long with the key action at 3.0 s.
  - `at` null: downloads the whole video to sources/<id>.mp4, so you can find
    the moment, put its second in `at`, and run again.
Existing files are skipped (--force redoes them). Every download is logged
(title, channel, upload date) in research/sources_used.json.

Needs ffmpeg and `pip install "yt-dlp[default]"` (the [default] extra brings
yt-dlp-ejs, which YouTube now requires), plus deno or Node.js on PATH.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import date

import yt_dlp
from yt_dlp.utils import DownloadError, download_range_func

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRE, POST = 3.0, 5.0     # seconds kept before / after the key action
NETWORK_BLOCKED = ("Tunnel connection failed", "Unable to connect to proxy")


class QuietLog:
    """Keep yt-dlp's warnings; drop its error lines, which main() reports once."""
    def debug(self, msg): pass
    def info(self, msg): pass
    def warning(self, msg): print(f"        {msg}")
    def error(self, msg): pass


def ydl_opts(out_base, max_height, section=None):
    opts = {
        "format": f"bv*[height<={max_height}]+ba/b[height<={max_height}]/bv*+ba/b",
        "merge_output_format": "mp4",
        "outtmpl": out_base + ".%(ext)s",
        "noplaylist": True,
        "quiet": True,
        "noprogress": True,
        "js_runtimes": {"deno": {}, "node": {}},
        "logger": QuietLog(),
    }
    if section:
        opts["download_ranges"] = download_range_func(None, [section])
        opts["force_keyframes_at_cuts"] = True    # cut on the exact second, not the nearest keyframe
    return opts


def download(url, out_base, max_height, section=None):
    """Download to out_base.<ext>; return (info, path)."""
    with yt_dlp.YoutubeDL(ydl_opts(out_base, max_height, section)) as ydl:
        info = ydl.extract_info(url, download=True)
    folder, stem = os.path.split(out_base)
    files = [f for f in os.listdir(folder) if f.startswith(stem + ".") and not f.endswith(".part")]
    if not files:
        raise DownloadError("download finished but no file was written")
    return info, os.path.join(folder, sorted(files, key=len)[0])


def normalize(src, dst, length):
    """Re-encode to H.264/AAC MP4, exactly `length` seconds."""
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-t", f"{length:.3f}",
                    "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", dst], check=True)


def probe_duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", path], capture_output=True, text=True).stdout
    return float(out.strip() or 0)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--links", default=os.path.join(ROOT, "research", "youtube_links.json"))
    ap.add_argument("--only", help="comma separated clip ids")
    ap.add_argument("--max-height", type=int, default=1080, help="best quality up to this height (default 1080)")
    ap.add_argument("--full", action="store_true", help="download whole videos even when `at` is set")
    ap.add_argument("--force", action="store_true", help="redo clips that already exist")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found on PATH")
    clips = json.load(open(args.links))["clips"]
    if args.only:
        want = set(args.only.split(","))
        clips = [c for c in clips if c["id"] in want]
        if missing := want - {c["id"] for c in clips}:
            sys.exit(f"not in {args.links}: {', '.join(sorted(missing))}")

    clip_dir, src_dir = os.path.join(ROOT, "clips"), os.path.join(ROOT, "sources")
    log_path = os.path.join(ROOT, "research", "sources_used.json")
    log = json.load(open(log_path)) if os.path.exists(log_path) else {}
    os.makedirs(clip_dir, exist_ok=True)
    os.makedirs(src_dir, exist_ok=True)

    done_urls = {}            # url -> sources/ path, so a video shared by two clips downloads once
    counts = {"ok": 0, "skipped": 0, "failed": 0}
    failed = []
    for c in clips:
        cid, url, at = c["id"], c.get("url"), c.get("at")
        if not url:
            print(f"  {cid:5} no url ({c.get('note', 'skipped')})")
            counts["skipped"] += 1
            continue
        section = at is not None and not args.full
        dst = os.path.join(clip_dir, f"{cid}.mp4") if section else os.path.join(src_dir, f"{cid}.mp4")
        if os.path.exists(dst) and not args.force:
            print(f"  {cid:5} exists  {os.path.relpath(dst, ROOT)}")
            counts["skipped"] += 1
            continue
        if not section and url in done_urls:
            print(f"  {cid:5} same video as {done_urls[url]}, not downloaded again")
            log[cid] = {**log.get(done_urls[url], {}), "same_as": done_urls[url]}
            counts["skipped"] += 1
            continue
        start = max(at - PRE, 0.0) if section else None
        what = f"{start:.1f}-{at + POST:.1f}s -> clips/{cid}.mp4" if section else f"full video -> sources/{cid}.mp4"
        print(f"  {cid:5} {url}  {what}", flush=True)
        if args.dry_run:
            if not section:
                done_urls[url] = cid
            continue

        tmp =tempfile.mkdtemp(prefix=f"fetch_{cid}_", dir=src_dir)
        try:
            info, got = download(url, os.path.join(tmp, cid), args.max_height,
                                 (start, at + POST) if section else None)
            if section:
                normalize(got, dst, (at + POST) - start)
                if at < PRE:
                    print(f"        key action at {at:.2f}s in this clip (source starts too soon): "
                          f"set \"hit\": {at:.2f} for {cid} in research/moments.json")
            else:
                shutil.move(got, dst)
                done_urls[url] = cid
            dur = probe_duration(dst)
            print(f"        ok  {dur:.2f}s  \"{info.get('title', '')}\" ({info.get('channel') or info.get('uploader')})")
            log[cid] = {"url": url, "title": info.get("title"), "channel": info.get("channel") or info.get("uploader"),
                        "channel_url": info.get("channel_url") or info.get("uploader_url"),
                        "upload_date": info.get("upload_date"), "source_duration": info.get("duration"),
                        "at": at if section else None, "file": os.path.relpath(dst, ROOT),
                        "downloaded": date.today().isoformat()}
            counts["ok"] += 1
        except (DownloadError, subprocess.CalledProcessError) as e:
            msg = str(e).strip().splitlines()[-1] if str(e).strip() else type(e).__name__
            msg = msg.removeprefix("ERROR: ").split("; please report")[0]
            print(f"        FAILED  {msg}")
            if any(s in str(e) for s in NETWORK_BLOCKED):
                sys.exit("\nThe network is blocking this site (proxy refused the connection). "
                         "Allow youtube.com, youtu.be and googlevideo.com, or run this on your own computer.")
            counts["failed"] += 1
            failed.append(cid)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
            if not args.dry_run:
                with open(log_path, "w") as f:
                    json.dump(dict(sorted(log.items())), f, indent=1, ensure_ascii=False)
                    f.write("\n")

    if args.dry_run:
        return
    print(f"\n{counts['ok']} downloaded, {counts['skipped']} skipped, {counts['failed']} failed"
          + (f": {', '.join(failed)} (replace their links in research/youtube_links.json)" if failed else ""))


if __name__ == "__main__":
    main()
