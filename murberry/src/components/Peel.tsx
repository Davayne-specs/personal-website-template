import React from 'react';
import {AbsoluteFill} from 'remotion';
import {H, W, paper} from '../brand/tokens';
import {clamp, clamp01} from '../lib/anim';
import {
  Pt,
  add,
  clipHalfPlane,
  dot,
  len,
  mul,
  norm,
  polyCss,
  polyPath,
  pt,
  reflect,
  sub,
} from '../lib/geom';
import {grainUrl} from './Paper';

const PAGE: Pt[] = [pt(0, 0), pt(W, 0), pt(W, H), pt(0, H)];

/** Flap outline with its free edges bowed outward, so the fold reads as a curl. */
const flapPath = (poly: Pt[], n: Pt, s: number, bow: number) => {
  if (poly.length < 3) return '';
  const c = mul(poly.reduce((a, p) => add(a, p), pt(0, 0)), 1 / poly.length);
  const f = (p: Pt) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  let d = `M ${f(poly[0])}`;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const onFold = Math.abs(dot(a, n) - s) < 0.6 && Math.abs(dot(b, n) - s) < 0.6;
    if (onFold || bow === 0) {
      d += ` L ${f(b)}`;
      continue;
    }
    const e = sub(b, a);
    const mid = mul(add(a, b), 0.5);
    let perp = norm(pt(-e.y, e.x));
    if (dot(perp, sub(mid, c)) < 0) perp = mul(perp, -1);
    const ctrl = add(mid, mul(perp, bow * len(e)));
    d += ` Q ${f(ctrl)} ${f(b)}`;
  }
  return d + ' Z';
};

/** The segment of the fold line that lies on the page. */
const foldSegment = (kept: Pt[], n: Pt, s: number) =>
  kept.filter((p) => Math.abs(dot(p, n) - s) < 0.6);

export type PeelProps = {
  id: string;
  /** 0 = sheet flat, 1 = sheet fully peeled away. */
  progress: number;
  /** Direction from the page toward the corner or edge that lifts first. */
  dir: [number, number];
  /** Colour of the sheet's back face. */
  back?: string;
  under?: React.ReactNode;
  children: React.ReactNode;
  bow?: number;
};

/**
 * A sheet curling back along a straight fold that sweeps across the page.
 * The part past the fold flips over and lies on the sheet, showing its back;
 * whatever is beneath shows through where it lifted. Run it backwards to
 * lay a sheet down, or to unroll one over a scene.
 */
export const Peel: React.FC<PeelProps> = ({
  id,
  progress,
  dir,
  back = paper.ochreBack,
  under,
  children,
  bow = 0.035,
}) => {
  const q = clamp01(progress);
  if (q <= 0.0005) return <AbsoluteFill>{children}</AbsoluteFill>;

  const n = norm(pt(dir[0], dir[1]));
  const proj = PAGE.map((p) => dot(p, n));
  const pmax = Math.max(...proj);
  const pmin = Math.min(...proj);
  const s = pmax - q * (pmax - pmin);
  const kept = clipHalfPlane(PAGE, n, s, true);
  const lifted = clipHalfPlane(PAGE, n, s, false);
  const flap = lifted.map((p) => reflect(p, n, s));
  const depth = pmax - s;
  const onLine = mul(n, s);
  const band = clamp(depth * 0.55, 0, 90);
  const shadowZone = clipHalfPlane(lifted, n, s + band, true);
  const seg = foldSegment(kept, n, s);
  const back2 = sub(onLine, mul(n, Math.max(depth, 1)));

  return (
    <AbsoluteFill>
      <AbsoluteFill>{under}</AbsoluteFill>
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <defs>
          <linearGradient id={`${id}-sh`} gradientUnits="userSpaceOnUse"
            x1={onLine.x} y1={onLine.y} x2={onLine.x + n.x * Math.max(band, 1)} y2={onLine.y + n.y * Math.max(band, 1)}>
            <stop offset="0" stopColor="#2A2420" stopOpacity="0.38" />
            <stop offset="1" stopColor="#2A2420" stopOpacity="0" />
          </linearGradient>
        </defs>
        {shadowZone.length > 2 ? <path d={polyPath(shadowZone)} fill={`url(#${id}-sh)`} /> : null}
      </svg>
      {kept.length > 2 ? (
        <AbsoluteFill style={{clipPath: polyCss(kept)}}>{children}</AbsoluteFill>
      ) : null}
      {flap.length > 2 ? (
        <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
          <defs>
            <linearGradient id={`${id}-fl`} gradientUnits="userSpaceOnUse"
              x1={onLine.x} y1={onLine.y} x2={back2.x} y2={back2.y}>
              <stop offset="0" stopColor="#FFF8E6" stopOpacity="0.55" />
              <stop offset="0.07" stopColor="#FFF8E6" stopOpacity="0.2" />
              <stop offset="0.3" stopColor="#FFF8E6" stopOpacity="0" />
              <stop offset="1" stopColor="#2A2420" stopOpacity="0.14" />
            </linearGradient>
            <pattern id={`${id}-gr`} width="512" height="512" patternUnits="userSpaceOnUse">
              <image href={grainUrl()} width="512" height="512" />
            </pattern>
          </defs>
          <g style={{filter: 'drop-shadow(0 8px 10px rgba(42,36,32,0.28))'}}>
            <path d={flapPath(flap, n, s, bow)} fill={back} />
          </g>
          <path d={flapPath(flap, n, s, bow)} fill={`url(#${id}-gr)`} opacity={0.85} style={{mixBlendMode: 'soft-light'}} />
          <path d={flapPath(flap, n, s, bow)} fill={`url(#${id}-fl)`} />
          <path d={flapPath(flap, n, s, bow)} fill="none" stroke="#2A2420" strokeWidth={1.2} opacity={0.3} />
          {seg.length === 2 ? (
            <line x1={seg[0].x} y1={seg[0].y} x2={seg[1].x} y2={seg[1].y}
              stroke="rgba(255,246,226,0.6)" strokeWidth={3} />
          ) : null}
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};

/** A sheet sliding in over the scene beneath, with a shadow at its leading edge. */
export const Slide: React.FC<{
  progress: number;
  from?: 'right' | 'left' | 'bottom' | 'top';
  under: React.ReactNode;
  children: React.ReactNode;
}> = ({progress, from = 'right', under, children}) => {
  const q = clamp01(progress);
  if (q >= 0.9995) return <AbsoluteFill>{children}</AbsoluteFill>;
  const off = 1 - q;
  const tx = from === 'right' ? W * off : from === 'left' ? -W * off : 0;
  const ty = from === 'bottom' ? H * off : from === 'top' ? -H * off : 0;
  const px = -tx * 0.12;
  const py = -ty * 0.12;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{transform: `translate(${px}px, ${py}px)`}}>
        {under}
        <AbsoluteFill style={{background: '#2A2420', opacity: 0.12 * q}} />
      </AbsoluteFill>
      <AbsoluteFill style={{transform: `translate(${tx}px, ${ty}px)`, boxShadow: '0 12px 30px rgba(42,36,32,0.35)'}}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
