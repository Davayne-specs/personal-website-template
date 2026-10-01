#!/usr/bin/env python3
"""Download the footage listed in research/youtube_links.json.

    python tools/fetch_clips.py                  # every clip
    python tools/fetch_clips.py --only c02,n18   # just these
    python tools/fetch_clips.py --dry-run        # show what would happen

For each clip, `url` is tried first, then each of `alternates`, until one works.
  - `at` null: downloads the whole video to sources/<id>.mp4, so you can find
    the moment, put its second in `at`, and run again.
  - `at` set (second of the key action in that video): writes clips/<id>.mp4,
    8 s long with the key action at 3.0 s. It is cut from sources/ when the whole
    video is there, otherwise only [at-3, at+5] of the link that sources_used.json
    records for the clip (or of `url`) is downloaded.
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
import time
from datetime import date

import yt_dlp
from yt_dlp.utils import DownloadError, download_range_func

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRE, POST = 3.0, 5.0     # seconds kept before / after the key action
NETWORK_BLOCKED = ("Tunnel connection failed", "Unable to connect to proxy")
BOT_CHECK = "confirm you\u2019re not a bot"
BOT_WAIT = 60            # seconds to back off before retrying a bot-check refusal once


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
        # yt-dlp's own lookup can land on an older, unsupported node; hand it the one on PATH
        "js_runtimes": {"deno": {}, "node": {"path": shutil.which("node")} if shutil.which("node") else {}},
        "logger": QuietLog(),
        # pace requests: YouTube answers rapid-fire requests from servers with a sign-in wall
        "sleep_interval_requests": 1,
        "sleep_interval": 3,
        "max_sleep_interval": 8,
    }
    if section:
        opts["download_ranges"] = download_range_func(None, [section])
        opts["force_keyframes_at_cuts"] = True    # cut on the exact second, not the nearest keyframe
    return opts


def download(url, out_base, max_height, section=None):
    """Download to out_base.<ext>; return (info, path)."""
    try:
        with yt_dlp.YoutubeDL(ydl_opts(out_base, max_height, section)) as ydl:
            info = ydl.extract_info(url, download=True)
    except DownloadError as e:
        if BOT_CHECK not in str(e):
            raise
        print(f"        YouTube asked for a sign-in; waiting {BOT_WAIT}s and trying once more", flush=True)
        time.sleep(BOT_WAIT)
        with yt_dlp.YoutubeDL(ydl_opts(out_base, max_height, section)) as ydl:
            info = ydl.extract_info(url, download=True)
    folder, stem = os.path.split(out_base)
    files = [f for f in os.listdir(folder) if f.startswith(stem + ".") and not f.endswith(".part")]
    if not files:
        raise DownloadError("download finished but no file was written")
    return info, os.path.join(folder, sorted(files, key=len)[0])


def normalize(src, dst, length, start=0.0):
    """Re-encode src[start:start+length] to H.264/AAC MP4 (frame-accurate seek)."""
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.3f}", "-i", src, "-t", f"{length:.3f}",
                    "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", dst], check=True)


def probe_duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", path], capture_output=True, text=True).stdout
    return float(out.strip() or 0)


def short_error(e):
    msg = str(e).strip().splitlines()[-1] if str(e).strip() else type(e).__name__
    return msg.removeprefix("ERROR: ").split("; please report")[0]


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
    clips = all_clips = json.load(open(args.links))["clips"]
    if args.only:
        want = set(args.only.split(","))
        clips = [c for c in clips if c["id"] in want]
        if missing := want - {c["id"] for c in clips}:
            sys.exit(f"not in {args.links}: {', '.join(sorted(missing))}")

    clip_dir, src_dir = os.path.join(ROOT, "clips"), os.path.join(ROOT, "sources")
    log_path = os.path.join(ROOT, "research", "sources_used.json")
    log = json.load(open(log_path)) if os.path.exists(log_path) else {}

    def record(cid, entry):
        log[cid] = entry
        with open(log_path, "w") as f:
            json.dump(dict(sorted(log.items())), f, indent=1, ensure_ascii=False)
            f.write("\n")

    def local_source(cid, url):
        """A whole video already in sources/ that this clip's `at` refers to."""
        for sid in (cid, log.get(cid, {}).get("same_as")):
            if sid and os.path.exists(os.path.join(src_dir, f"{sid}.mp4")):
                return sid
        for o in all_clips:     # another clip whose saved video came from the same link
            if log.get(o["id"], {}).get("url") == url and os.path.exists(os.path.join(src_dir, f"{o['id']}.mp4")):
                return o["id"]
        return None

    os.makedirs(clip_dir, exist_ok=True)
    os.makedirs(src_dir, exist_ok=True)

    done_urls = {}            # url -> clip id, so a video shared by two clips downloads once
    counts = {"ok": 0, "skipped": 0, "failed": 0}
    failed = []
    for c in clips:
        cid, at = c["id"], c.get("at")
        urls = [u for u in [c.get("url")] + c.get("alternates", []) if u]
        if not urls:
            print(f"  {cid:5} no url ({c.get('note', 'skipped')})")
            counts["skipped"] += 1
            continue
        section = at is not None and not args.full
        dst = os.path.join(clip_dir, f"{cid}.mp4") if section else os.path.join(src_dir, f"{cid}.mp4")
        if os.path.exists(dst) and not args.force:
            print(f"  {cid:5} exists  {os.path.relpath(dst, ROOT)}")
            counts["skipped"] += 1
            continue
        if not section and urls[0] in done_urls:
            print(f"  {cid:5} same video as {done_urls[urls[0]]}, not downloaded again")
            if not args.dry_run:
                record(cid, {**log.get(done_urls[urls[0]], {}), "same_as": done_urls[urls[0]]})
            counts["skipped"] += 1
            continue

        start = max(at - PRE, 0.0) if section else None
        local = local_source(cid, urls[0]) if section else None
        if section:
            urls = [log.get(cid, {}).get("url") or urls[0]]     # `at` belongs to one particular video
        if local:
            what = f"{start:.1f}-{at + POST:.1f}s of sources/{local}.mp4 -> clips/{cid}.mp4"
        elif section:
            what = f"{start:.1f}-{at + POST:.1f}s -> clips/{cid}.mp4"
        else:
            what = f"full video -> sources/{cid}.mp4" + (f"  (+{len(urls) - 1} alternates)" if len(urls) > 1 else "")
        print(f"  {cid:5} {'' if local else urls[0]}  {what}", flush=True)
        if args.dry_run:
            if not section:
                done_urls[urls[0]] = cid
            continue

        tmp = tempfile.mkdtemp(prefix=f"fetch_{cid}_", dir=src_dir)
        try:
            if local:
                src_log = log.get(local, {})
                used = src_log.get("url")
                info = {k: src_log.get(v) for k, v in (("title", "title"), ("channel", "channel"),
                        ("channel_url", "channel_url"), ("upload_date", "upload_date"), ("duration", "source_duration"))}
                normalize(os.path.join(src_dir, f"{local}.mp4"), dst, (at + POST) - start, start)
            else:
                for n, used in enumerate(urls):
                    if n:
                        print(f"        trying alternate {n}: {used}", flush=True)
                    try:
                        info, got = download(used, os.path.join(tmp, cid), args.max_height,
                                             (start, at + POST) if section else None)
                        break
                    except DownloadError as e:
                        if any(s in str(e) for s in NETWORK_BLOCKED) or n == len(urls) - 1:
                            raise
                        print(f"        failed: {short_error(e)}")
                        shutil.rmtree(tmp, ignore_errors=True)
                        os.makedirs(tmp)
            if section:
                if not local:
                    normalize(got, dst, (at + POST) - start)
                if at < PRE:
                    print(f"        key action at {at:.2f}s in this clip (source starts too soon): "
                          f"set \"hit\": {at:.2f} for {cid} in research/moments.json")
            else:
                shutil.move(got, dst)
                done_urls[urls[0]] = done_urls[used] = cid
            dur = probe_duration(dst)
            print(f"        ok  {dur:.2f}s  \"{info.get('title', '')}\" ({info.get('channel') or info.get('uploader')})")
            record(cid, {"url": used, "title": info.get("title"), "channel": info.get("channel") or info.get("uploader"),
                         "channel_url": info.get("channel_url") or info.get("uploader_url"),
                         "upload_date": info.get("upload_date"), "source_duration": info.get("duration"),
                         "at": at if section else None, "file": os.path.relpath(dst, ROOT),
                         "downloaded": date.today().isoformat()})
            counts["ok"] += 1
        except (DownloadError, subprocess.CalledProcessError) as e:
            print(f"        FAILED  {short_error(e)}")
            if any(s in str(e) for s in NETWORK_BLOCKED):
                sys.exit("\nThe network is blocking this site (proxy refused the connection). "
                         "Allow youtube.com, youtu.be and googlevideo.com, or run this on your own computer.")
            counts["failed"] += 1
            failed.append(cid)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    if args.dry_run:
        return
    print(f"\n{counts['ok']} done, {counts['skipped']} skipped, {counts['failed']} failed"
          + (f": {', '.join(failed)} (add working links to research/youtube_links.json)" if failed else ""))


if __name__ == "__main__":
    main()
