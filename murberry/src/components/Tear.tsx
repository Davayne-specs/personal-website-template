import React from 'react';
import {AbsoluteFill} from 'remotion';
import {H, W, paper} from '../brand/tokens';
import {clamp01, ease, lerp, prog, rand} from '../lib/anim';
import {Pt, polyCss, polyPath, pt} from '../lib/geom';
import {DrawPath} from './Draw';

/** Jagged tear line across the page, from y0 at the left to y1 at the right. */
export const tearLine = (y0: number, y1: number, seed = 3, steps = 28): Pt[] =>
  Array.from({length: steps + 1}, (_, i) => {
    const x = (i / steps) * W;
    const base = lerp(y0, y1, i / steps);
    const j = (i % 2 ? -1 : 1) * (6 + 7 * rand(seed + i * 1.7));
    return pt(x, base + j);
  });

const above = (line: Pt[], dy: number): Pt[] => [
  pt(-40, -40),
  pt(W + 40, -40),
  ...[...line].reverse().map((p) => pt(p.x, p.y + dy)),
];
const below = (line: Pt[], dy: number): Pt[] => [
  ...line.map((p) => pt(p.x, p.y + dy)),
  pt(W + 40, H + 40),
  pt(-40, H + 40),
];

/**
 * The top sheet tears along a ragged line; the lower piece is pulled down
 * and away, leaving a torn strip with a pale fibrous edge and a shadow.
 */
export const Tear: React.FC<{
  id: string;
  progress: number;
  y0: number;
  y1: number;
  seed?: number;
  under: React.ReactNode;
  children: React.ReactNode;
  edge?: string;
}> = ({id, progress, y0, y1, seed = 3, under, children, edge = paper.tornEdge}) => {
  const q = clamp01(progress);
  const line = tearLine(y0, y1, seed);
  const crack = prog(q, 0, 0.32, ease.inOutSine);
  const fall = prog(q, 0.26, 1, ease.inCubic);
  const d = 'M ' + line.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ');
  const lowerGone = fall >= 0.999;

  return (
    <AbsoluteFill>
      <AbsoluteFill>{under}</AbsoluteFill>
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <path d={polyPath(above(line, 12))} fill="#2A2420" opacity={0.28 * Math.min(1, fall * 3)}
          style={{filter: 'blur(8px)'}} />
        <path d={polyPath(above(line, 6))} fill={edge} />
      </svg>
      <AbsoluteFill style={{clipPath: polyCss(above(line, 0))}}>{children}</AbsoluteFill>
      {lowerGone ? null : (
        <AbsoluteFill
          style={{
            transformOrigin: '0px 0px',
            transform: `translate(${fall * 60}px, ${fall * H * 0.95}px) rotate(${fall * 7}deg)`,
            filter: `drop-shadow(0 ${6 + fall * 18}px ${8 + fall * 16}px rgba(42,36,32,${0.2 + fall * 0.2}))`,
          }}
        >
          <AbsoluteFill style={{clipPath: polyCss(below(line, 0))}}>
            {children}
            <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
              <path d={polyPath([...line, ...[...line].reverse().map((p) => pt(p.x, p.y + 5))])}
                fill={edge} opacity={Math.min(1, fall * 4)} />
            </svg>
          </AbsoluteFill>
        </AbsoluteFill>
      )}
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <g opacity={1 - Math.min(1, fall * 2.5)}>
          <DrawPath d={d} p={crack} stroke={edge} width={3.2} />
          <DrawPath d={d} p={crack} stroke="#2A2420" width={1} opacity={0.35}
            transform="translate(0 2.5)" />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
