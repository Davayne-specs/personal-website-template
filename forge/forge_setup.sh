#!/usr/bin/env bash
# forge-argument setup for macOS. Safe to re-run. Usage: bash forge_setup.sh
set -u
P="$HOME/forge-argument"
mkdir -p "$P"/{input,work,out,assets}
cd "$P" || exit 1
PASS=(); FAIL=()
ok(){ PASS+=("$1"); }; bad(){ FAIL+=("$1"); }
log(){ printf '%s\n' "$@" >> STATE.md; }
finish(){
  echo; echo "===== CHECKLIST ====="
  for x in "${PASS[@]:-}"; do [ -n "$x" ] && echo "PASS  $x"; done
  for x in "${FAIL[@]:-}"; do [ -n "$x" ] && echo "FAIL  $x"; done
  exit "${1:-0}"
}

# --- STATE.md (header only created if file is new; rule: read before append)
if [ ! -f STATE.md ]; then
cat > STATE.md <<'EOF'
We are making a ~60-second vertical TikTok video (1080x1920, 30fps) that animates one chunk of a real TikTok live battle between creators. The source is a ~4:45 screen recording (split-screen: two creators on camera, a third speaker off-camera, voice only). The speech is Jamaican Patois mixed with English. Pipeline: transcribe with word timestamps -> pick a 60s chunk -> label speakers (A and B on camera, C off-camera) -> design 2 exaggerated hand-drawn cartoon characters, shoulders up -> build a layered 2D rig with mouth shapes and expressions -> generate a director timeline (emotions, reactions, shot changes, captions) from the transcript plus audio energy -> render frames -> calm quiet bleeps over curse words -> captions -> export mp4. Style notes: flat color with thick, slightly wobbly hand-inked outlines; simple pale backgrounds that burst into saturated color once at a peak; wide shot to tight close-ups; top title text; silhouette crowd with phones; matching first and last frame so it loops. Rules: no face tracking of the real people; every step must read STATE.md first and append what it did and what files it created when it finishes. Time budget: 7 hours total.

---

## Log

### Step 0 — Setup
- Created: `input/`, `work/`, `out/`, `assets/`, `STATE.md`
EOF
else
  cat STATE.md >/dev/null
  log "" "### Setup re-run $(date '+%Y-%m-%d %H:%M')"
fi
ok "structure + STATE.md"

# --- 1. machine
MACOS=$(sw_vers -productVersion 2>/dev/null || echo "NOT macOS ($(uname -s))")
ARCH=$(uname -m)
PYV=$(python3 --version 2>&1)
GITV=$(git --version 2>&1)
PIPV=$(python3 -m pip --version 2>&1 | head -1)
echo "macOS: $MACOS | arch: $ARCH | $PYV | $GITV | $PIPV"
[ "$(uname -s)" = Darwin ] && ok "macOS $MACOS" || bad "not running on macOS"
command -v python3 >/dev/null && ok "$PYV" || { bad "python3 missing"; finish 1; }
command -v git >/dev/null && ok "$GITV" || bad "git missing (run: xcode-select --install)"

if ! command -v ffmpeg >/dev/null || ! command -v ffprobe >/dev/null; then
  if command -v brew >/dev/null; then brew install ffmpeg || true
  else
    bad "Homebrew is NOT installed and ffmpeg is missing. Install Homebrew from https://brew.sh then re-run."
    log "- BLOCKED: ffmpeg missing and Homebrew missing. Stopped."
    finish 1
  fi
fi
command -v ffmpeg >/dev/null && ok "ffmpeg: $(ffmpeg -version | head -1)" || { bad "ffmpeg install failed"; finish 1; }

# cairosvg needs the native cairo library on macOS
if command -v brew >/dev/null; then brew list cairo >/dev/null 2>&1 || brew install cairo pkg-config || true; fi
[ -d /opt/homebrew/lib ] && export DYLD_FALLBACK_LIBRARY_PATH="/opt/homebrew/lib:${DYLD_FALLBACK_LIBRARY_PATH:-}"

# --- 2. venv + packages
if [ "$ARCH" = arm64 ]; then STT=mlx-whisper; STTMOD=mlx_whisper; else STT=faster-whisper; STTMOD=faster_whisper; fi
[ -d .venv ] || python3 -m venv .venv
./.venv/bin/pip install --quiet --upgrade pip
if ./.venv/bin/pip install --quiet numpy soundfile librosa pillow cairosvg tqdm "$STT"; then
  ok "venv + packages (numpy soundfile librosa pillow cairosvg tqdm $STT)"
else bad "pip install failed"; fi
log "- Machine: macOS $MACOS, $ARCH; $PYV; $GITV; $PIPV; $(ffmpeg -version | head -1)" \
    "- Created: .venv with numpy soundfile librosa pillow cairosvg tqdm $STT"

# --- 3. input video
shopt -s nullglob nocaseglob
VIDS=(input/*.mp4 input/*.mov input/*.m4v input/*.mkv input/*.webm input/*.avi)
shopt -u nullglob nocaseglob
if [ "${#VIDS[@]}" -ne 1 ]; then
  bad "input/: found ${#VIDS[@]} video files (need exactly 1). Stopping."
  log "" "### Step 3 — BLOCKED" "- input/ has ${#VIDS[@]} video files: ${VIDS[*]:-none}. Stopped."
  finish 1
fi
V="${VIDS[0]}"
DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$V")
RES=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$V")
FPS=$(ffprobe -v error -select_streams v:0 -show_entries stream=avg_frame_rate -of default=nw=1:nk=1 "$V")
SR=$(ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of default=nw=1:nk=1 "$V")
echo "video=$V duration=${DUR}s res=$RES fps=$FPS audio=${SR}Hz"
log "" "### Step 3 — Input video" "- File: $V" "- Duration: ${DUR}s | Resolution: $RES | FPS: $FPS | Audio sample rate: ${SR} Hz"
[ -n "$DUR" ] && [ -n "$SR" ] && ok "ffprobe: ${DUR}s, $RES, $FPS fps, ${SR} Hz" || { bad "ffprobe incomplete (no audio stream?)"; finish 1; }

# --- 4. audio
ffmpeg -y -v error -i "$V" -vn -ac 1 -ar 16000 work/full_audio.wav \
 && ffmpeg -y -v error -i "$V" -vn -ac 2 -ar 44100 work/full_audio_hq.wav \
 && ok "work/full_audio.wav (mono 16k) + work/full_audio_hq.wav (stereo 44.1k)" || bad "audio extraction failed"
log "" "### Step 4 — Audio" "- Created: work/full_audio.wav (mono 16 kHz), work/full_audio_hq.wav (stereo 44.1 kHz)"

# --- 5. import tests (10 s limit each)
for m in numpy soundfile librosa PIL cairosvg tqdm "$STTMOD"; do
  if ./.venv/bin/python - "$m" <<'PY'
import subprocess, sys
m = sys.argv[1]
try:
    subprocess.run([sys.executable, "-c", f"import {m}"], check=True, timeout=10, capture_output=True)
except Exception as e:
    sys.stderr.write(str(getattr(e, "stderr", e))[-300:]); sys.exit(1)
PY
  then ok "import $m"; else bad "import $m"; fi
done
log "" "### Step 5 — Import tests" "- PASS: ${#PASS[@]} items, FAIL: ${#FAIL[@]} items (see terminal checklist)"
finish $([ "${#FAIL[@]}" -eq 0 ] && echo 0 || echo 1)
