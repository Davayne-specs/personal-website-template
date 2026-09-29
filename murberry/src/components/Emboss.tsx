import React from 'react';
import {emboss, serif} from '../brand/tokens';
import {clamp01} from '../lib/anim';

/**
 * The Murberry wordmark, blind-embossed: never printed in ink, only seen as
 * the light catches its upper and lower edges. `depth` 0..1 is how strongly
 * the light shows it; `sweep` 0..1 moves a glint across the letters.
 */
export const Emboss: React.FC<{
  id: string;
  x: number;
  y: number;
  depth: number;
  sweep?: number;
  paperColor: string;
  anchor?: 'start' | 'middle';
  size?: number;
}> = ({id, x, y, depth, sweep = -1, paperColor, anchor = 'start', size = 120}) => {
  const k = clamp01(depth);
  const w = size * 4.3;
  const bx = anchor === 'start' ? x : x - w / 2;
  const gx = bx - 120 + (w + 240) * sweep;
  const common = {
    fontFamily: serif,
    fontSize: size,
    fontWeight: 500,
    letterSpacing: 1,
    textAnchor: anchor,
  } as const;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-glint`} gradientUnits="userSpaceOnUse" x1={gx - 110} y1="0" x2={gx + 110} y2="0">
          <stop offset="0" stopColor="#000" />
          <stop offset="0.5" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id={`${id}-m`} maskUnits="userSpaceOnUse" x={bx - 200} y={y - size * 1.2} width={w + 400} height={size * 1.8}>
          <rect x={bx - 200} y={y - size * 1.2} width={w + 400} height={size * 1.8} fill={`url(#${id}-glint)`} />
        </mask>
      </defs>
      <text {...common} x={x - 2} y={y - 2} fill={emboss.highlight} opacity={k} >Murberry</text>
      {sweep >= 0 && sweep <= 1 ? (
        <text {...common} x={x - 2} y={y - 2} fill="rgba(255,250,236,0.9)" opacity={k} mask={`url(#${id}-m)`}>
          Murberry
        </text>
      ) : null}
      <text {...common} x={x + 2} y={y + 2} fill={emboss.shadow} opacity={k}>Murberry</text>
      <text {...common} x={x} y={y} fill={paperColor}>Murberry</text>
    </g>
  );
};
