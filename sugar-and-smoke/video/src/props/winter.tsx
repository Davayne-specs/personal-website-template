// Winter props for No. 2: falling snow, drifts, footprints, houses, streetlights.
import React from 'react';
import {C} from '../brand/tokens';
import {Flat, Line, Shape} from '../lib/print';
import {rng} from '../lib/random';
import {circle, ellipse, rect, smooth} from '../lib/shapes';

// Falling snow. Deterministic: every flake has its own lane, speed and sway.
export const Snow: React.FC<{f: number; n?: number; seed?: number; speed?: number; wind?: number; big?: boolean; o?: number; y0?: number; y1?: number; color?: string}> = ({
  f,
  n = 60,
  seed = 9,
  speed = 1,
  wind = 0,
  big = false,
  o = 0.95,
  y0 = -40,
  y1 = 1960,
  color = C.white,
}) => {
  const r = rng(seed);
  const span = y1 - y0;
  return (
    <>
      {Array.from({length: n}, (_, i) => {
        const x0 = r() * 1200 - 60;
        const v = (1.2 + r() * 2.6) * speed;
        const ph = r() * span;
        const sz = big ? 7 + r() * 9 : 3 + r() * 5;
        const y = y0 + ((ph + f * v * 2) % span);
        const x = ((x0 + Math.sin(f / (20 + r() * 20) + i) * 18 + wind * (y - y0) * 0.35) % 1200 + 1200) % 1200 - 60;
        return big ? (
          <Shape key={i} d={circle(x, y, sz)} fill={color} line={2.5} shadow={false} ghost={false} opacity={o} />
        ) : (
          <Flat key={i} d={circle(x, y, sz)} fill={color} opacity={o} />
        );
      })}
    </>
  );
};

// A bumpy snowbank across the frame from y down.
export const Drift: React.FC<{y: number; seed?: number; fill?: string; shade?: boolean}> = ({y, seed = 3, fill = C.white, shade = true}) => {
  const r = rng(seed);
  const pts: [number, number][] = [[-120, y + 30]];
  for (let x = -80; x <= 1200; x += 110) pts.push([x, y - r() * 36]);
  const d = `${smooth(pts, false, 0.6)}L1240,2100L-120,2100Z`;
  return <Shape d={d} fill={fill} shade={shade ? `M-120,${y + 40}L1240,${y + 40}L1240,${y + 140}L-120,${y + 140}Z` : undefined} shadeInk="ht-smoke-1" line={5} shadow={false} />;
};

// Footprint pairs along a straight run from (x0,y0) to (x1,y1).
export const Footprints: React.FC<{x0: number; y0: number; x1: number; y1: number; n?: number; upTo?: number; s?: number; o?: number}> = ({
  x0,
  y0,
  x1,
  y1,
  n = 9,
  upTo = 1,
  s = 1,
  o = 0.85,
}) => (
  <>
    {Array.from({length: n}, (_, i) => {
      const t = i / (n - 1);
      if (t > upTo) return null;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t + (i % 2 ? 12 : -12) * s;
      return <Flat key={i} d={`${ellipse(x, y, 16 * s, 9 * s)}`} fill={C.slate} opacity={o} />;
    })}
  </>
);

// A suburban house front with snow on the roof and warm windows.
export const House: React.FC<{x: number; y: number; w?: number; h?: number; body?: string; lit?: number; seed?: number}> = ({
  x,
  y,
  w = 420,
  h = 300,
  body = '#4A5566',
  lit = 1,
  seed = 1,
}) => {
  const r = rng(seed);
  const wins = [0, 1, 2].map((k) => ({wx: x + 40 + k * ((w - 120) / 2), on: r() < 0.8}));
  return (
    <>
      <Shape d={rect(x, y - h, w, h)} fill={body} shade={rect(x + w * 0.6, y - h, w * 0.4, h)} shadeInk="ht-ink-2" line={6} />
      <Shape d={`M${x - 30},${y - h}L${x + w / 2},${y - h - 170}L${x + w + 30},${y - h}Z`} fill="#3A4252" line={6} />
      <Shape d={`M${x - 36},${y - h + 4}C${x + w * 0.2},${y - h - 30} ${x + w * 0.8},${y - h - 30} ${x + w + 36},${y - h + 4}L${x + w + 30},${y - h - 16}L${x + w / 2},${y - h - 180}L${x - 30},${y - h - 16}Z`} fill={C.white} line={5} />
      {wins.map((wi, k) => (
        <g key={k}>
          {wi.on && lit > 0 && <Flat d={circle(wi.wx + 36, y - h + 110, 110)} fill="url(#glow-amber)" opacity={0.7 * lit} />}
          <Shape d={rect(wi.wx, y - h + 60, 72, 96, 4)} fill={wi.on && lit > 0.3 ? C.amber : '#2C3442'} line={5} />
          <Line d={`M${wi.wx + 36},${y - h + 60}L${wi.wx + 36},${y - h + 156}M${wi.wx},${y - h + 108}L${wi.wx + 72},${y - h + 108}`} size={3.5} />
        </g>
      ))}
      <Shape d={rect(x + w / 2 - 40, y - 130, 80, 130, 6)} fill={C.teal} line={5} />
    </>
  );
};

export const Streetlight: React.FC<{x: number; y: number; h?: number; on?: number}> = ({x, y, h = 700, on = 1}) => (
  <>
    {on > 0 && (
      <>
        <Flat d={`M${x - 30},${y - h + 40}L${x + 30},${y - h + 40}L${x + 220},${y}L${x - 220},${y}Z`} fill={C.amber} opacity={0.18 * on} />
        <Flat d={circle(x, y - h + 40, 160)} fill="url(#glow-amber)" opacity={0.8 * on} />
        <Flat d={ellipse(x, y, 220, 40)} fill={C.amber} opacity={0.25 * on} />
      </>
    )}
    <Shape d={rect(x - 9, y - h + 40, 18, h - 40)} fill="#2C3442" line={5} />
    <Shape d={`M${x - 50},${y - h + 40}L${x + 50},${y - h + 40}L${x + 30},${y - h - 10}L${x - 30},${y - h - 10}Z`} fill={on > 0.3 ? C.amber : '#2C3442'} line={5} />
    <Shape d={`M${x - 60},${y - h - 10}L${x + 60},${y - h - 10}L${x + 40},${y - h - 30}L${x - 40},${y - h - 30}Z`} fill={C.white} line={4} />
  </>
);

// A mug of cocoa with steam.
export const Mug: React.FC<{x: number; y: number; f: number; s?: number}> = ({x, y, f, s = 1}) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    {[0, 1].map((k) => (
      <Line key={k} d={`M${-16 + k * 28},-70C${-26 + k * 28},${-96 - (f % 20)} ${-6 + k * 28},${-110 - (f % 20)} ${-16 + k * 28},${-136 - (f % 20)}`} size={4} opacity={0.5} />
    ))}
    <Shape d="M-50,-60L50,-60L44,40C40,56 -40,56 -44,40Z" fill={C.hotpink} line={5} />
    <Shape d="M50,-40C84,-40 84,20 46,20" fill="none" line={7} />
    <Shape d={ellipse(0, -60, 50, 12)} fill="#6B4A36" line={4} />
    <Shape d={ellipse(-10, -62, 14, 6)} fill={C.white} line={2.5} />
  </g>
);
