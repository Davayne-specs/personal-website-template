// Song timing -> frames. Data comes from ../../data (made by tools/ from the isolated vocal).
import timing from '../../../data/timing.json';
import story from '../../../data/storyboard.json';
import features from '../../../data/audio-features.json';
import {FPS, StateName} from '../brand/tokens';

export type Word = {w: string; t: number};
export type LineT = {i: number; section: string; text: string; start: number; end: number; words: Word[]};
export type Story = {n: number; tag: string; state: string; move: string; scene: string};

export const LINES = timing as LineT[];
export const STORY = story as Story[];
export const AF = features as {fps: number; frames: number; vocal: number[]; mix: number[]; low: number[]; tempo: number; beats: number[]};

export const TOTAL_FRAMES = AF.frames; // 5904 = 196.8 s
export const LEAD = 0.15; // scenes land this long before the vocal

export type Move = 'Print roll' | 'Smoke wipe' | 'Registration snap' | 'Stamp cut';

export type Slot = {
  n: number; // line number 1..59, 0 = title
  from: number; // first frame
  to: number; // first frame of the next slot
  line?: LineT;
  tag: string;
  state: StateName;
  move: Move;
};

const toState = (s: string): StateName =>
  (['Memory', 'Absence', 'Precious', 'Pressure', 'Release', 'Present'].includes(s) ? s : 'Present') as StateName;

const buildSlots = (): Slot[] => {
  const byN = new Map(STORY.map((s) => [s.n, s]));
  const starts: {n: number; from: number}[] = [];
  LINES.forEach((ln, k) => {
    const n = k + 1;
    const from = n === 1 ? 0 : Math.round((ln.start - LEAD) * FPS);
    starts.push({n, from});
    if (n === 3) {
      // the instrumental break after line 3 carries the title
      starts.push({n: 0, from: Math.round((ln.end + 0.05) * FPS)});
    }
  });
  return starts.map((s, i) => {
    const st = byN.get(s.n)!;
    return {
      n: s.n,
      from: s.from,
      to: i + 1 < starts.length ? starts[i + 1].from : TOTAL_FRAMES,
      line: s.n > 0 ? LINES[s.n - 1] : undefined,
      tag: st.tag,
      state: toState(st.state),
      move: st.move as Move,
    };
  });
};

export const SLOTS = buildSlots();

export const slotIndexAt = (frame: number) => {
  let lo = 0;
  let hi = SLOTS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (SLOTS[mid].from <= frame) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};

export const BEAT_FRAMES = AF.beats.map((b) => b * FPS);

// 1 right on a beat, decaying over ~6 frames.
export const beatPulse = (frame: number, decay = 5) => {
  let lo = 0;
  let hi = BEAT_FRAMES.length - 1;
  if (frame < BEAT_FRAMES[0]) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (BEAT_FRAMES[mid] <= frame) lo = mid;
    else hi = mid - 1;
  }
  return Math.exp(-(frame - BEAT_FRAMES[lo]) / decay);
};

// Beat index (for alternating poses on the beat).
export const beatIndex = (frame: number) => {
  let k = 0;
  while (k < BEAT_FRAMES.length && BEAT_FRAMES[k] <= frame) k++;
  return k;
};

export const vocalAt = (frame: number) => AF.vocal[Math.max(0, Math.min(AF.vocal.length - 1, Math.round(frame)))] ?? 0;
export const lowAt = (frame: number) => AF.low[Math.max(0, Math.min(AF.low.length - 1, Math.round(frame)))] ?? 0;

// Smoothed vocal level for lip-sync (short attack, slower release).
export const mouthAt = (frame: number) => {
  let m = 0;
  for (let k = 0; k < 4; k++) m = Math.max(m, vocalAt(frame - k) * (1 - k * 0.22));
  return Math.max(0, Math.min(1, (m - 0.12) * 1.5));
};

// Absolute frame of every "precious" / "pressure" word (for stamps and foil sheen).
export type Hit = {frame: number; kind: 'precious' | 'pressure'; n: number};
export const HITS: Hit[] = LINES.flatMap((ln, k) =>
  ln.words
    .filter((w) => /^precious/i.test(w.w) || /^pressure/i.test(w.w))
    .map((w) => ({frame: Math.round(w.t * FPS), kind: (/^precious/i.test(w.w) ? 'precious' : 'pressure') as Hit['kind'], n: k + 1}))
);
