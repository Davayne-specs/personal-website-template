import React from 'react';
import {clamp01} from '../lib/anim';

type Common = {
  d: string;
  p: number; // 0..1 how much is drawn
  stroke?: string;
  width?: number;
  opacity?: number;
  reverse?: boolean;
  dash?: string; // for dashed pencil lines (revealed with a mask)
  id?: string; // required when dash is set
  cap?: 'round' | 'butt';
  transform?: string;
};

/**
 * A pencil stroke that draws itself. Solid lines use a normalised dash;
 * dashed lines are revealed through a mask so their own dashes survive.
 */
export const DrawPath: React.FC<Common> = ({
  d,
  p,
  stroke = '#2A2420',
  width = 2.6,
  opacity = 1,
  reverse = false,
  dash,
  id,
  cap = 'round',
  transform,
}) => {
  const q = clamp01(p);
  if (q <= 0.0005) return null;
  const done = q >= 0.999;
  const offset = reverse ? q - 1 : 1 - q;
  if (dash) {
    if (done) {
      return (
        <path d={d} fill="none" stroke={stroke} strokeWidth={width} strokeDasharray={dash}
          strokeLinecap={cap} strokeLinejoin="round" opacity={opacity} transform={transform} />
      );
    }
    const mid = `${id}-m`;
    return (
      <g transform={transform}>
        <mask id={mid} maskUnits="userSpaceOnUse" x="-4000" y="-4000" width="10000" height="10000">
          <path d={d} fill="none" stroke="#fff" strokeWidth={width + 8} pathLength={1}
            strokeDasharray="1 1" strokeDashoffset={offset} strokeLinecap="butt" />
        </mask>
        <path d={d} fill="none" stroke={stroke} strokeWidth={width} strokeDasharray={dash}
          strokeLinecap={cap} strokeLinejoin="round" opacity={opacity} mask={`url(#${mid})`} />
      </g>
    );
  }
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap={cap}
      strokeLinejoin="round"
      opacity={opacity}
      transform={transform}
      pathLength={done ? undefined : 1}
      strokeDasharray={done ? undefined : '1 1'}
      strokeDashoffset={done ? undefined : offset}
    />
  );
};

/**
 * Reveals its children left to right, like ink being written in, through a
 * soft-edged mask over the box [x, x + w] x [y, y + h].
 */
export const WriteOn: React.FC<{
  id: string;
  p: number;
  x: number;
  y: number;
  w: number;
  h: number;
  children: React.ReactNode;
  opacity?: number;
}> = ({id, p, x, y, w, h, children, opacity = 1}) => {
  const q = clamp01(p);
  if (q <= 0.0005) return null;
  if (q >= 0.999) return <g opacity={opacity}>{children}</g>;
  const soft = 40;
  const edge = x - soft + (w + soft * 2) * q;
  return (
    <g opacity={opacity}>
      <defs>
        <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1={edge - soft} y1="0" x2={edge} y2="0">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id={`${id}-w`} maskUnits="userSpaceOnUse" x={x - 60} y={y - 40} width={w + 120} height={h + 80}>
          <rect x={x - 60} y={y - 40} width={w + 120} height={h + 80} fill={`url(#${id}-g)`} />
        </mask>
      </defs>
      <g mask={`url(#${id}-w)`}>{children}</g>
    </g>
  );
};

/** Estimated width of a small-caps plate label, for WriteOn boxes. */
export const labelWidth = (text: string, size = 28, spacing = 1.6) =>
  text.length * (size * 0.5 + spacing) + 12;
