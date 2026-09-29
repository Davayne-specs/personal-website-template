import React from 'react';
import {ink, serif} from '../brand/tokens';
import {ease, fade, prog} from '../lib/anim';
import {WriteOn, labelWidth} from './Draw';

type Anchor = 'start' | 'middle' | 'end';

/**
 * A small-caps plate label that writes itself in, line by line, then holds.
 * Times are in the scene's seconds.
 */
export const Label: React.FC<{
  id: string;
  t: number;
  t0: number;
  dur?: number;
  out?: [number, number];
  x: number;
  y: number;
  lines: string[];
  anchor?: Anchor;
  size?: number;
  spacing?: number;
  weight?: number;
  color?: string;
  lineGap?: number;
  smallCaps?: boolean;
  opacity?: number;
}> = ({
  id,
  t,
  t0,
  dur = 0.9,
  out,
  x,
  y,
  lines,
  anchor = 'start',
  size = 28,
  spacing = 1.6,
  weight = 500,
  color = ink.pencil,
  lineGap,
  smallCaps = true,
  opacity = 1,
}) => {
  const gap = lineGap ?? size * 1.22;
  const o = out ? 1 - prog(t, out[0], out[1]) : 1;
  if (o <= 0.001 || t < t0) return null;
  const per = dur / lines.length;
  return (
    <g opacity={o * opacity}>
      {lines.map((line, i) => {
        const w = labelWidth(line, size, spacing);
        const bx = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
        const ly = y + i * gap;
        const p = prog(t, t0 + i * per, t0 + (i + 1) * per, ease.inOutSine);
        return (
          <WriteOn key={i} id={`${id}-${i}`} p={p} x={bx} y={ly - size} w={w} h={size * 1.4}>
            <text
              x={x}
              y={ly}
              fontFamily={serif}
              fontSize={size}
              fontWeight={weight}
              letterSpacing={spacing}
              textAnchor={anchor}
              fill={color}
              style={smallCaps ? {fontVariantCaps: 'all-small-caps'} : undefined}
            >
              {line}
            </text>
          </WriteOn>
        );
      })}
    </g>
  );
};

/** A plain fade for text that should simply settle into the paper. */
export const FadeText: React.FC<{
  t: number;
  t0: number;
  t1?: number;
  out?: [number, number];
  x: number;
  y: number;
  children: React.ReactNode;
  size?: number;
  anchor?: Anchor;
  color?: string;
  weight?: number;
  smallCaps?: boolean;
  spacing?: number;
}> = ({t, t0, t1, out, x, y, children, size = 20, anchor = 'start', color = ink.muted, weight = 400, smallCaps, spacing}) => {
  const o = fade(t, t0, t1 ?? t0 + 0.6, out?.[0], out?.[1]);
  if (o <= 0.001) return null;
  return (
    <text x={x} y={y} fontFamily={serif} fontSize={size} fill={color} fontWeight={weight}
      textAnchor={anchor} opacity={o} letterSpacing={spacing}
      style={smallCaps ? {fontVariantCaps: 'all-small-caps'} : undefined}>
      {children}
    </text>
  );
};
