// Song timing -> frames, per episode. Each episode's data (made by tools/time_lyrics.py)
// is turned into scene slots, stamp hits and beat/vocal helpers.
import {createContext, useContext} from 'react';
import {FPS, StateName} from '../brand/tokens';

export type Word = {w: string; t: number};
export type LineT = {i: number; section: string; text: string; start: number; end: number; words: Word[]};
export type Story = {n: number; tag: string; state: string; move: string; scene: string};
export type Features = {fps: number; frames: number; vocal: number[]; mix: number[]; low: number[]; tempo: number; beats: number[]};

export const LEAD = 0.15; // scenes land this long before the vocal

export type Move = 'Print roll' | 'Smoke wipe' | 'Registration snap' | 'Stamp cut';

// A stamp that lands on every sung word matching `re`.
export type StampKind = {
  kind: string;
  re: RegExp;
  word: string; // what the stamp says
  ink: string; // colour, or 'foil'
  ghost: string; // off-register second pass
  sheen?: boolean; // foil sheen sweeps across gold things on this word
};

export type EpisodeData = {
  timing: LineT[];
  story: Story[];
  features: Features;
  titleAfterLine?: number; // title card (slot 0) in the gap after this line
  titleAtStart?: boolean; // ...or before the first line
  endCard?: boolean; // slot -1 after the last line, in the instrumental tail
  stamps: StampKind[];
};

export type Slot = {
  n: number; // line number 1..N, 0 = title, -1 = end card
  from: number; // first frame
  to: number; // first frame of the next slot
  line?: LineT;
  tag: string;
  state: StateName;
  move: Move;
};

export type Hit = {frame: number; kind: string; n: number};

const toState = (s: string): StateName =>
  (['Memory', 'Absence', 'Precious', 'Pressure', 'Release', 'Present'].includes(s) ? s : 'Present') as StateName;

export const buildTimeline = (d: EpisodeData) => {
  const LINES = d.timing;
  const STORY = d.story;
  const AF = d.features;
  const TOTAL_FRAMES = AF.frames;

  const byN = new Map(STORY.map((s) => [s.n, s]));
  const starts: {n: number; from: number}[] = [];
  if (d.titleAtStart) starts.push({n: 0, from: 0});
  LINES.forEach((ln, k) => {
    const n = k + 1;
    const from = n === 1 && !d.titleAtStart ? 0 : Math.round((ln.start - LEAD) * FPS);
    starts.push({n, from});
    if (d.titleAfterLine === n) starts.push({n: 0, from: Math.round((ln.end + 0.05) * FPS)});
  });
  if (d.endCard) {
    const last = LINES[LINES.length - 1];
    starts.push({n: -1, from: Math.round((last.end + 0.35) * FPS)});
  }
  const SLOTS: Slot[] = starts.map((s, i) => {
    const st = byN.get(s.n);
    if (!st) throw new Error(`storyboard has no entry for slot ${s.n}`);
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

  const slotIndexAt = (frame: number) => {
    let lo = 0;
    let hi = SLOTS.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (SLOTS[mid].from <= frame) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  const BEAT_FRAMES = AF.beats.map((b) => b * FPS);
  const lastBeat = (frame: number) => {
    let lo = 0;
    let hi = BEAT_FRAMES.length - 1;
    if (frame < BEAT_FRAMES[0]) return -1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (BEAT_FRAMES[mid] <= frame) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  // 1 right on a beat, decaying over ~6 frames.
  const beatPulse = (frame: number, decay = 5) => {
    const k = lastBeat(frame);
    return k < 0 ? 0 : Math.exp(-(frame - BEAT_FRAMES[k]) / decay);
  };
  const beatIndex = (frame: number) => lastBeat(frame) + 1;

  const vocalAt = (frame: number) => AF.vocal[Math.max(0, Math.min(AF.vocal.length - 1, Math.round(frame)))] ?? 0;
  const lowAt = (frame: number) => AF.low[Math.max(0, Math.min(AF.low.length - 1, Math.round(frame)))] ?? 0;
  // Smoothed vocal level for lip-sync (short attack, slower release).
  const mouthAt = (frame: number) => {
    let m = 0;
    for (let k = 0; k < 4; k++) m = Math.max(m, vocalAt(frame - k) * (1 - k * 0.22));
    return Math.max(0, Math.min(1, (m - 0.12) * 1.5));
  };

  const HITS: Hit[] = LINES.flatMap((ln, k) =>
    ln.words.flatMap((w) => {
      const s = d.stamps.find((st) => st.re.test(w.w));
      return s ? [{frame: Math.round(w.t * FPS), kind: s.kind, n: k + 1}] : [];
    })
  );
  const HIT_END = HITS.map((h) => SLOTS[slotIndexAt(h.frame)].to);

  return {LINES, STORY, AF, TOTAL_FRAMES, SLOTS, HITS, HIT_END, STAMPS: d.stamps, slotIndexAt, beatPulse, beatIndex, vocalAt, lowAt, mouthAt};
};

export type Timeline = ReturnType<typeof buildTimeline>;

export const TimelineCtx = createContext<Timeline | null>(null);
export const useTimeline = () => {
  const t = useContext(TimelineCtx);
  if (!t) throw new Error('useTimeline() outside an episode');
  return t;
};
