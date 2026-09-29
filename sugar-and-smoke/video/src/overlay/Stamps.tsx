// Rubber stamps that land on the exact word: PRECIOUS in gold foil, PRESSURE in red.
import React from 'react';
import {staticFile} from 'remotion';
import {C, FONT} from '../brand/tokens';
import {clamp, ease} from '../lib/ease';
import {hash} from '../lib/random';
import {HITS, SLOTS, slotIndexAt} from '../lib/timeline';

export const stampPlacement = (n: number) => {
  const h = hash(`stamp${n}`);
  return {
    x: 540 + ((h % 1000) / 1000 - 0.5) * 300,
    y: 470 + (((h >> 10) % 1000) / 1000 - 0.5) * 140,
    rot: -13 + ((h >> 20) % 1000) / 1000 * 22,
  };
};

const Stamp: React.FC<{kind: 'precious' | 'pressure'; x: number; y: number; rot: number; t: number; fade: number; id: string}> = ({
  kind,
  x,
  y,
  rot,
  t,
  fade,
  id,
}) => {
  // t: frames since impact (negative = still coming down)
  const down = clamp((t + 4) / 4);
  const scale = t < 0 ? 1.5 - 0.5 * ease.inQuad(down) : 1 + 0.035 * Math.exp(-t / 2) * Math.cos(t * 1.8);
  const alpha = (t < 0 ? 0.25 + 0.75 * down : 1) * (1 - fade);
  const word = kind === 'precious' ? 'PRECIOUS' : 'PRESSURE';
  const ink = kind === 'precious' ? 'url(#stampfoil)' : C.pressure;
  const ghost = kind === 'precious' ? C.goldLo : C.hotpink;
  const w = 640;
  const h = 200;
  return (
    <g transform={`translate(${x},${y}) rotate(${rot}) scale(${scale})`} opacity={alpha}>
      <defs>
        <mask id={`m${id}`} maskUnits="userSpaceOnUse" x={-w / 2 - 30} y={-h / 2 - 30} width={w + 60} height={h + 60}>
          <image href={staticFile('tex/stamp-mask.png')} x={-w / 2 - 30} y={-h / 2 - 30} width={w + 60} height={h + 60} preserveAspectRatio="none" />
        </mask>
      </defs>
      <g mask={`url(#m${id})`}>
        <g transform="translate(6,6)" opacity={0.9}>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={22} fill="none" stroke={ghost} strokeWidth={12} />
          <text x={0} y={52} textAnchor="middle" fontFamily={FONT.stamp} fontSize={150} letterSpacing={6} fill={ghost}>
            {word}
          </text>
        </g>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={22} fill="none" stroke={ink} strokeWidth={12} />
        <text x={0} y={52} textAnchor="middle" fontFamily={FONT.stamp} fontSize={150} letterSpacing={6} fill={ink}>
          {word}
        </text>
      </g>
    </g>
  );
};

const HIT_END = HITS.map((h) => SLOTS[slotIndexAt(h.frame)].to);

export const Stamps: React.FC<{frame: number}> = ({frame}) => {
  const hits = HITS.map((h, i) => ({...h, end: HIT_END[i]})).filter((h) => h.frame - 4 <= frame && frame < h.end + 7);
  if (!hits.length) return null;
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
      <defs>
        <pattern id="stampfoil" width={300} height={300} patternUnits="userSpaceOnUse">
          <image href={staticFile('tex/foil.png')} width={300} height={300} />
        </pattern>
      </defs>
      {hits.map((h) => {
        const p = stampPlacement(h.n);
        const fade = clamp((frame - h.end) / 6);
        return <Stamp key={h.frame} id={`s${h.frame}`} kind={h.kind} x={p.x} y={p.y} rot={p.rot} t={frame - h.frame} fade={fade} />;
      })}
    </svg>
  );
};
