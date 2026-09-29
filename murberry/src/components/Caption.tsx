import React from 'react';
import {ink, paper, serif, shadowCss, type} from '../brand/tokens';
import {clamp01, ease} from '../lib/anim';
import {Grain} from './Paper';

export type Cue = {start: number; end: number; text: string; style?: 'caption' | 'signoff'};

const IN = 0.28;
const OUT = 0.2;
const GAP_KEEP = 1.5; // shorter gaps keep the plate up, only the words change
const PLATE_FADE = 0.45;

/** Opacity of the caption plate itself at time t. */
const plateOpacity = (t: number, cues: Cue[]) => {
  let best = 0;
  cues.forEach((c, i) => {
    const prev = cues[i - 1];
    const next = cues[i + 1];
    const joinPrev = prev && c.start - prev.end < GAP_KEEP;
    const joinNext = next && next.start - c.end < GAP_KEEP;
    const a = joinPrev ? prev.end : c.start - 0.1;
    const b = joinNext ? next.start : c.end + 0.15;
    let o = 0;
    if (t >= a && t <= b) o = 1;
    else if (!joinPrev && t < a && t > a - PLATE_FADE) o = ease.inOutSine(1 - (a - t) / PLATE_FADE);
    else if (!joinNext && t > b && t < b + PLATE_FADE) o = ease.inOutSine(1 - (t - b) / PLATE_FADE);
    best = Math.max(best, o);
  });
  return best;
};

/**
 * Burned-in narration on a sand caption plate. Words fade in and out with
 * the paper and never pop; the plate stays up across short pauses.
 */
export const Captions: React.FC<{t: number; cues: Cue[]}> = ({t, cues}) => {
  const po = plateOpacity(t, cues);
  if (po <= 0.001) return null;
  // Across a short pause the words hold until the next line arrives.
  const idx = cues.findIndex((c, i) => {
    const next = cues[i + 1];
    const end = next && next.start - c.end < GAP_KEEP ? next.start : c.end;
    return t >= c.start && t < end;
  });
  const cue = idx >= 0 ? cues[idx] : undefined;
  const nextCue = idx >= 0 ? cues[idx + 1] : undefined;
  const cueEnd = cue && nextCue && nextCue.start - cue.end < GAP_KEEP ? nextCue.start : cue?.end ?? 0;
  let to = 0;
  let rise = 0;
  if (cue) {
    const fin = clamp01((t - cue.start) / IN);
    const fout = clamp01((cueEnd - t) / OUT);
    to = Math.min(ease.inOutSine(fin), ease.inOutSine(fout));
    rise = (1 - ease.outCubic(fin)) * 8;
  }
  const signoff = cue?.style === 'signoff';
  const ty = signoff ? type.beatTitle : type.caption;
  return (
    <div
      style={{
        position: 'absolute',
        left: 64,
        top: 1560,
        width: 952,
        height: 200,
        boxSizing: 'border-box',
        padding: '32px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        background: paper.sand,
        borderRadius: 6,
        boxShadow: shadowCss.sheet,
        opacity: po,
        overflow: 'hidden',
        isolation: 'isolate',
      }}
    >
      <div
        style={{
          fontFamily: serif,
          fontSize: ty.fontSize,
          lineHeight: ty.lineHeight,
          fontWeight: ty.fontWeight,
          color: ink.pencil,
          opacity: to,
          transform: `translateY(${rise}px)`,
          whiteSpace: 'pre-line',
        }}
      >
        {cue?.text ?? ''}
      </div>
      <Grain opacity={0.7} />
    </div>
  );
};
