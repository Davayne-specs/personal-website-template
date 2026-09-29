// The riso print model. A scene is printed three times, once per plate:
//   shadow - every cut-out's silhouette, offset as a hard sticker shadow
//   ghost  - flat colour of every cut-out, offset by the registration error;
//            it only peeks out where nothing covers it, like a mis-registered pass
//   key    - the finished drawing in paint order: fills, halftones, brush ink, text
// Primitives below read the current plate and draw only their part.
import React, {createContext, useContext, useId} from 'react';
import {staticFile} from 'remotion';
import {C} from '../brand/tokens';
import {brush} from './brush';

export type Plate = 'shadow' | 'ghost' | 'key';

export type Print = {
  plate: Plate;
  boil: number; // current boil seed
  line: string; // key-line colour (ink, or cotton on night stock)
  frame: number;
};

export const PrintCtx = createContext<Print>({plate: 'key', boil: 0, line: C.ink, frame: 0});
export const usePrint = () => useContext(PrintCtx);

const cleanId = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '');

export type HT = `ht-${'ink' | 'pink' | 'teal' | 'gold' | 'red' | 'cotton' | 'candy' | 'aqua' | 'smoke' | 'ice' | 'amber' | 'slate'}-${1 | 2 | 3 | 4}`;

const PATTERN_GHOST: Record<string, string> = {foil: C.gold, smokefill: C.smoke};

export type ShapeProps = {
  d: string;
  fill?: string; // flat fill colour, or 'none'
  pattern?: string; // fill with url(#pattern) instead (foil, halftones, smoke)
  shade?: string; // region filled with halftone dots, clipped to the shape
  shadeInk?: HT;
  line?: number | false; // brush width; false = no key line
  outline?: string; // draw the key line along this path instead of `d` (e.g. only a limb's sides)
  lineColor?: string;
  shadow?: boolean; // cast a sticker shadow (default true)
  ghost?: boolean; // print on the ghost plate (default true)
  opacity?: number;
  jitter?: number;
  dotted?: boolean; // dotted outline (the Absence state)
  sheen?: boolean; // foil sheen sweep overlay
  evenodd?: boolean;
  step?: number;
};

export const Shape: React.FC<ShapeProps> = (p) => {
  const pr = usePrint();
  const id = cleanId(useId());
  const rule = p.evenodd ? 'evenodd' : 'nonzero';
  const hasFill = p.fill !== 'none' || !!p.pattern;
  if (pr.plate === 'shadow') {
    if (p.shadow === false || !hasFill) return null;
    return <path d={p.d} fill={C.ink} fillRule={rule} opacity={p.opacity} />;
  }
  if (pr.plate === 'ghost') {
    if (p.ghost === false || !hasFill) return null;
    const g = p.pattern ? PATTERN_GHOST[p.pattern] ?? p.fill ?? C.white : p.fill ?? C.white;
    return <path d={p.d} fill={g} fillRule={rule} opacity={p.opacity} />;
  }
  const fillValue = p.pattern ? `url(#${p.pattern})` : p.fill ?? C.white;
  let ink: React.ReactNode = null;
  if (p.line !== false) {
    const od = p.outline ?? p.d;
    ink = p.dotted ? (
      <path d={od} fill="none" stroke={p.lineColor ?? C.ash} strokeWidth={(p.line ?? 7) * 0.9} strokeDasharray="0.1 15" strokeLinecap="round" />
    ) : (
      <path d={brush(od, {size: p.line ?? 7, seed: pr.boil, jitter: p.jitter, step: p.step})} fill={p.lineColor ?? pr.line} />
    );
  }
  return (
    <g opacity={p.opacity}>
      {hasFill ? <path d={p.d} fill={fillValue} fillRule={rule} /> : null}
      {p.shade ? (
        <>
          <clipPath id={`c${id}`}>
            <path d={p.d} fillRule={rule} />
          </clipPath>
          <path d={p.shade} fill={`url(#${p.shadeInk ?? 'ht-ink-2'})`} clipPath={`url(#c${id})`} />
        </>
      ) : null}
      {p.sheen ? <path d={p.d} fill="url(#sheen)" fillRule={rule} /> : null}
      {ink}
    </g>
  );
};

// A brush stroke with no fill (creases, pockets, doodles, motion lines).
export const Line: React.FC<{
  d: string;
  size?: number;
  color?: string;
  jitter?: number;
  opacity?: number;
  taper?: number;
  thin?: number;
}> = ({d, size = 6, color, jitter, opacity, taper, thin}) => {
  const pr = usePrint();
  if (pr.plate !== 'key') return null;
  return <path d={brush(d, {size, seed: pr.boil, jitter, taper, thin})} fill={color ?? pr.line} opacity={opacity} />;
};

// Render children on one plate only.
export const Only: React.FC<{plate: Plate; children: React.ReactNode}> = ({plate, children}) => {
  const pr = usePrint();
  return pr.plate === plate ? <>{children}</> : null;
};

// A flat area of colour with no shadow or key line (glows, spots, halftone patches).
export const Flat: React.FC<{d: string; fill: string; opacity?: number; evenodd?: boolean; blend?: string}> = ({
  d,
  fill,
  opacity,
  evenodd,
  blend,
}) => {
  const pr = usePrint();
  if (pr.plate !== 'key') return null;
  return (
    <path
      d={d}
      fill={fill}
      opacity={opacity}
      fillRule={evenodd ? 'evenodd' : 'nonzero'}
      style={blend ? {mixBlendMode: blend as React.CSSProperties['mixBlendMode']} : undefined}
    />
  );
};

// Texture image (washes, smoke) printed in paint order.
export const Tex: React.FC<{
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity?: number;
  rotate?: number;
  blend?: string;
  shadow?: boolean;
  flip?: boolean;
}> = ({src, x, y, w, h, opacity = 1, rotate = 0, blend = 'multiply', shadow = false, flip = false}) => {
  const pr = usePrint();
  if (pr.plate === 'ghost') return null;
  if (pr.plate === 'shadow' && !shadow) return null;
  const tf = [
    rotate ? `rotate(${rotate} ${x + w / 2} ${y + h / 2})` : '',
    flip ? `translate(${2 * x + w},0) scale(-1,1)` : '',
  ].join(' ');
  return (
    <image
      href={staticFile(`tex/${src}`)}
      x={x}
      y={y}
      width={w}
      height={h}
      opacity={opacity}
      preserveAspectRatio="none"
      transform={tf.trim() || undefined}
      style={pr.plate === 'key' && blend !== 'normal' ? {mixBlendMode: blend as React.CSSProperties['mixBlendMode']} : undefined}
    />
  );
};

type TxtProps = {
  x: number;
  y: number;
  children: React.ReactNode;
  size?: number;
  font?: string;
  weight?: number;
  color?: string;
  anchor?: 'start' | 'middle' | 'end';
  rotate?: number;
  opacity?: number;
  spacing?: number;
  style?: React.CSSProperties;
  stroke?: string;
  strokeWidth?: number;
};

// Text in ink on the key plate.
export const Txt: React.FC<TxtProps> = ({
  x,
  y,
  children,
  size = 40,
  font = 'Caveat',
  weight = 700,
  color,
  anchor = 'middle',
  rotate = 0,
  opacity,
  spacing,
  style,
  stroke,
  strokeWidth,
}) => {
  const pr = usePrint();
  if (pr.plate !== 'key') return null;
  return (
    <text
      stroke={stroke}
      strokeWidth={strokeWidth}
      paintOrder="stroke"
      strokeLinejoin="round"
      x={x}
      y={y}
      fontFamily={font}
      fontSize={size}
      fontWeight={weight}
      fill={color ?? pr.line}
      textAnchor={anchor}
      opacity={opacity}
      letterSpacing={spacing}
      transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
      style={style}
    >
      {children}
    </text>
  );
};

const HT_COLORS: Record<string, string> = {
  ink: C.ink,
  pink: C.hotpink,
  teal: C.teal,
  gold: C.goldLo,
  red: C.pressure,
  cotton: C.cotton,
  candy: C.candy,
  aqua: C.aqua,
  smoke: C.ash,
  ice: C.iceInk,
  amber: '#C98F35',
  slate: C.slate,
};
const HT_R = [0, 1.7, 2.5, 3.3, 4.3];

// Shared <defs>: halftone dot screens, gold foil, sheen, smoke fill, glows.
export const PrintDefs: React.FC<{sheen?: number}> = ({sheen = -1}) => {
  const s = sheen; // band centre across the object's bounding box; <0 or >1.2 = off
  const on = s >= -0.2 && s <= 1.2;
  return (
    <defs>
      {Object.entries(HT_COLORS).flatMap(([name, col]) =>
        [1, 2, 3, 4].map((k) => (
          <pattern key={`${name}${k}`} id={`ht-${name}-${k}`} width={11} height={11} patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
            <circle cx={5.5} cy={5.5} r={HT_R[k]} fill={col} />
          </pattern>
        ))
      )}
      <pattern id="foil" width={300} height={300} patternUnits="userSpaceOnUse">
        <image href={staticFile('tex/foil.png')} width={300} height={300} />
      </pattern>
      <pattern id="smokefill" width={700} height={532} patternUnits="userSpaceOnUse">
        <rect width={700} height={532} fill="#C6CCCD" />
        <image href={staticFile('tex/smoke-2.png')} x={-120} y={-80} width={940} height={715} preserveAspectRatio="none" />
      </pattern>
      <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
        <stop offset={Math.max(0, Math.min(1, s - 0.2))} stopColor="#FFF8DE" stopOpacity={0} />
        <stop offset={Math.max(0, Math.min(1, s))} stopColor="#FFF8DE" stopOpacity={on ? 0.9 : 0} />
        <stop offset={Math.max(0, Math.min(1, s + 0.2))} stopColor="#FFF8DE" stopOpacity={0} />
      </linearGradient>
      <radialGradient id="glow-gold">
        <stop offset="0" stopColor={C.goldHi} stopOpacity={0.95} />
        <stop offset="0.55" stopColor={C.gold} stopOpacity={0.35} />
        <stop offset="1" stopColor={C.gold} stopOpacity={0} />
      </radialGradient>
      <radialGradient id="glow-pink">
        <stop offset="0" stopColor={C.candy} stopOpacity={0.9} />
        <stop offset="1" stopColor={C.candy} stopOpacity={0} />
      </radialGradient>
      <radialGradient id="glow-cotton">
        <stop offset="0" stopColor={C.cotton} stopOpacity={0.85} />
        <stop offset="1" stopColor={C.cotton} stopOpacity={0} />
      </radialGradient>
      <radialGradient id="glow-amber">
        <stop offset="0" stopColor={C.amber} stopOpacity={0.85} />
        <stop offset="0.5" stopColor={C.amber} stopOpacity={0.3} />
        <stop offset="1" stopColor={C.amber} stopOpacity={0} />
      </radialGradient>
      <radialGradient id="glow-ice">
        <stop offset="0" stopColor={C.white} stopOpacity={0.9} />
        <stop offset="0.5" stopColor={C.ice} stopOpacity={0.4} />
        <stop offset="1" stopColor={C.ice} stopOpacity={0} />
      </radialGradient>
      <radialGradient id="glow-red">
        <stop offset="0" stopColor={C.pressure} stopOpacity={0.6} />
        <stop offset="1" stopColor={C.pressure} stopOpacity={0} />
      </radialGradient>
    </defs>
  );
};
