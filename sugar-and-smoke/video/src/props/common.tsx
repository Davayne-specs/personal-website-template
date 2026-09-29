// Shared props and little helpers for scenes.
import React, {useId} from 'react';
import {C, FONT} from '../brand/tokens';
import {clamp, ease} from '../lib/ease';
import {Flat, Line, Only, Shape, Tex, Txt, usePrint} from '../lib/print';
import {rng} from '../lib/random';
import {circle, ellipse, heart, poly, rect, smooth, star4} from '../lib/shapes';

// Clip children to a path on every plate.
export const Clip: React.FC<{d: string; evenodd?: boolean; children: React.ReactNode}> = ({d, evenodd, children}) => {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const pr = usePrint();
  return (
    <>
      <clipPath id={`k${id}${pr.plate}`}>
        <path d={d} clipRule={evenodd ? 'evenodd' : undefined} />
      </clipPath>
      <g clipPath={`url(#k${id}${pr.plate})`}>{children}</g>
    </>
  );
};

// Scale-in pop about a point.
export const Pop: React.FC<{f: number; at: number; x: number; y: number; dur?: number; children: React.ReactNode; from?: number}> = ({
  f,
  at,
  x,
  y,
  dur = 9,
  children,
  from = 0,
}) => {
  const t = clamp((f - at) / dur);
  if (t <= 0 && from === 0) return null;
  const s = from + (1 - from) * ease.outBack(t);
  return <g transform={`translate(${x},${y}) scale(${s}) translate(${-x},${-y})`}>{children}</g>;
};

export const Place: React.FC<{x?: number; y?: number; r?: number; s?: number; sx?: number; sy?: number; o?: number; children: React.ReactNode}> = ({
  x = 0,
  y = 0,
  r = 0,
  s = 1,
  sx,
  sy,
  o,
  children,
}) => (
  <g transform={`translate(${x},${y}) rotate(${r}) scale(${sx ?? s},${sy ?? s})`} opacity={o}>
    {children}
  </g>
);

export const Sparkle: React.FC<{x: number; y: number; r: number; o?: number; color?: string}> = ({x, y, r, o = 1, color = '#FFF4CC'}) => (
  <>
    <Shape d={star4(x, y, r)} fill={color} line={Math.max(2.5, r * 0.08)} opacity={o} shadow={false} />
  </>
);

export const FloatHearts: React.FC<{f: number; x: number; y: number; n?: number; seed?: number; color?: string; start?: number; spread?: number}> = ({
  f,
  x,
  y,
  n = 5,
  seed = 1,
  color = C.candy,
  start = 0,
  spread = 160,
}) => {
  const r = rng(seed);
  return (
    <>
      {Array.from({length: n}, (_, i) => {
        const t0 = start + i * 7 + r() * 6;
        const t = f - t0;
        if (t < 0) return null;
        const life = 50;
        const k = clamp(t / life);
        const hx = x + (r() - 0.5) * spread + Math.sin(t / 7 + i) * 14;
        const hy = y - t * (3 + r() * 2);
        const s = 14 + r() * 18;
        return <Shape key={i} d={heart(hx, hy, s * ease.outBack(clamp(t / 8)))} fill={color} line={3.5} opacity={1 - k} />;
      })}
    </>
  );
};

export const Polaroid: React.FC<{w?: number; h?: number; photo?: string; caption?: React.ReactNode; children?: React.ReactNode}> = ({
  w = 600,
  h = 720,
  photo = C.mint,
  caption,
  children,
}) => {
  const m = w * 0.07;
  const ph = w - 2 * m;
  const photoRect = rect(-w / 2 + m, -h / 2 + m, ph, ph);
  return (
    <>
      <Shape d={rect(-w / 2, -h / 2, w, h, 6)} fill={C.white} line={6} />
      <Shape d={photoRect} fill={photo} line={4} shadow={false} />
      <Clip d={photoRect}>{children}</Clip>
      {caption}
    </>
  );
};

export const Phone: React.FC<{w?: number; h?: number; screen?: string; children?: React.ReactNode}> = ({w = 420, h = 820, screen = C.mint, children}) => {
  const s = rect(-w / 2 + 22, -h / 2 + 70, w - 44, h - 140, 18);
  return (
    <>
      <Shape d={rect(-w / 2, -h / 2, w, h, 56)} fill={C.ink} line={6} />
      <Shape d={s} fill={screen} line={3} shadow={false} />
      <Clip d={s}>{children}</Clip>
      <Shape d={rect(-40, -h / 2 + 30, 80, 14, 7)} fill="#3A3150" line={false} shadow={false} />
    </>
  );
};

export const Bubble: React.FC<{x: number; y: number; w: number; h: number; tail?: [number, number]; fill?: string; dotted?: boolean; children?: React.ReactNode}> = ({
  x,
  y,
  w,
  h,
  tail = [-40, 90],
  fill = C.white,
  dotted,
  children,
}) => {
  const body = smooth(
    [
      [x - w / 2, y],
      [x - w * 0.42, y - h * 0.42],
      [x, y - h / 2],
      [x + w * 0.42, y - h * 0.42],
      [x + w / 2, y],
      [x + w * 0.42, y + h * 0.42],
      [x + 10, y + h / 2],
      [x + tail[0], y + tail[1]],
      [x - 20, y + h / 2],
      [x - w * 0.42, y + h * 0.42],
    ],
    true,
    0.55
  );
  return (
    <>
      <Shape d={body} fill={fill} line={5} dotted={dotted} />
      {children}
    </>
  );
};

export const Palm: React.FC<{x: number; y: number; s?: number; sway?: number}> = ({x, y, s = 1, sway = 0}) => {
  const leaf = (a: number, len: number) => {
    const r = (a * Math.PI) / 180;
    const ex = Math.cos(r) * len;
    const ey = Math.sin(r) * len;
    const nx = -Math.sin(r) * 34;
    const ny = Math.cos(r) * 34;
    return smooth([[0, 0], [ex * 0.5 + nx, ey * 0.5 + ny + 20], [ex, ey + 30], [ex * 0.5 - nx * 0.3, ey * 0.5 - ny * 0.3 + 6]], true, 0.6);
  };
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <Shape d="M-18,0C-10,-160 -4,-300 10,-420L30,-418C18,-300 16,-160 20,0Z" fill={C.goldLo} shade="M4,-420L40,-420L40,0L4,0Z" shadeInk="ht-ink-2" />
      <Line d="M-8,-60L18,-64M-6,-130L20,-134M-2,-200L24,-204M2,-270L26,-274M6,-340L28,-344" size={3.5} />
      <g transform={`translate(20,-420) rotate(${sway})`}>
        {[-160, -120, -70, -20, 20, -95].map((a, i) => (
          <Shape key={i} d={leaf(a, 190 + (i % 2) * 40)} fill={i % 2 ? C.teal : C.aqua} />
        ))}
        <Shape d={circle(-10, 14, 14)} fill={C.goldLo} line={3.5} />
        <Shape d={circle(12, 18, 13)} fill={C.goldLo} line={3.5} />
      </g>
    </g>
  );
};

export const Moon: React.FC<{x: number; y: number; r: number}> = ({x, y, r}) => (
  <>
    <Flat d={circle(x, y, r * 2.4)} fill="url(#glow-cotton)" opacity={0.5} />
    <Shape d={`M${x + r * 0.2},${y - r}A${r},${r} 0 1 0 ${x + r * 0.2},${y + r}A${r * 0.72},${r * 0.72} 0 1 1 ${x + r * 0.2},${y - r}Z`} fill={C.goldHi} line={5} />
  </>
);

export const Stars: React.FC<{f: number; n?: number; seed?: number; y0?: number; y1?: number}> = ({f, n = 14, seed = 3, y0 = 120, y1 = 900}) => {
  const r = rng(seed);
  return (
    <>
      {Array.from({length: n}, (_, i) => {
        const x = 60 + r() * 960;
        const y = y0 + r() * (y1 - y0);
        const tw = 0.55 + 0.45 * Math.sin(f / (6 + r() * 6) + i);
        return <Flat key={i} d={star4(x, y, (8 + r() * 12) * tw)} fill={C.goldHi} />;
      })}
    </>
  );
};

// A floor band across the bottom of the frame.
export const Floor: React.FC<{y: number; fill?: string; line?: boolean}> = ({y, fill = C.candy, line = true}) => (
  <Shape d={`M-200,${y}C300,${y - 10} 800,${y + 8} 1300,${y}L1300,2200L-200,2200Z`} fill={fill} line={line ? 5 : false} shadow={false} />
);

export const Hand: React.FC<{skin?: string; point?: boolean}> = ({skin = C.steinSkin, point}) =>
  point ? (
    <Shape
      d="M-60,-40C-70,20 -60,70 -20,80L40,80C70,78 80,60 70,40L60,20C80,10 80,-10 60,-20L200,-26C230,-28 230,-60 200,-62L40,-66C10,-70 -40,-70 -60,-40Z"
      fill={skin}
    />
  ) : (
    <Shape d="M-60,-40C-72,20 -60,78 -10,86C40,90 70,70 72,30C90,20 96,-10 72,-20L60,-60C40,-80 -40,-78 -60,-40Z" fill={skin} />
  );

export const Note: React.FC<{x: number; y: number; children: React.ReactNode; size?: number; rot?: number; color?: string; o?: number}> = ({
  x,
  y,
  children,
  size = 54,
  rot = -4,
  color,
  o,
}) => (
  <Txt x={x} y={y} size={size} font={FONT.hand} weight={700} rotate={rot} color={color} opacity={o}>
    {children}
  </Txt>
);

export const Arrow: React.FC<{d: string; size?: number; color?: string; head?: [number, number, number]}> = ({d, size = 6, color, head}) => (
  <>
    <Line d={d} size={size} color={color} />
    {head && (
      <Line
        d={`M${head[0] - 26 * Math.cos(((head[2] - 30) * Math.PI) / 180)},${head[1] - 26 * Math.sin(((head[2] - 30) * Math.PI) / 180)}L${head[0]},${head[1]}L${head[0] - 26 * Math.cos(((head[2] + 30) * Math.PI) / 180)},${head[1] - 26 * Math.sin(((head[2] + 30) * Math.PI) / 180)}`}
        size={size}
        color={color}
      />
    )}
  </>
);

export const Wash: React.FC<{kind: 'pink' | 'aqua' | 'gold' | 'ice' | 'slate' | 'amber'; x: number; y: number; s: number; o?: number; v?: 1 | 2; r?: number}> = ({kind, x, y, s, o = 0.8, v = 1, r = 0}) => (
  <Tex src={`wash-${kind}-${kind === 'pink' || kind === 'aqua' ? v : 1}.png`} x={x - s / 2} y={y - s / 2} w={s} h={s} opacity={o} rotate={r} />
);

export const SmokePuff: React.FC<{x: number; y: number; s: number; o?: number; v?: 1 | 2 | 3 | 4; r?: number; flip?: boolean}> = ({
  x,
  y,
  s,
  o = 0.9,
  v = 1,
  r = 0,
  flip,
}) => <Tex src={`smoke-${v}.png`} x={x - s / 2} y={y - s * 0.38} w={s} h={s * 0.76} opacity={o} rotate={r} blend="normal" flip={flip} />;

export const MotionLines: React.FC<{x: number; y: number; n?: number; len?: number; dir?: 1 | -1; gap?: number; o?: number}> = ({
  x,
  y,
  n = 3,
  len = 110,
  dir = -1,
  gap = 34,
  o = 1,
}) => (
  <>
    {Array.from({length: n}, (_, i) => (
      <Line key={i} d={`M${x},${y + i * gap}L${x + dir * (len - i * 18)},${y + i * gap}`} size={5} opacity={o} />
    ))}
  </>
);

// A burst of paper confetti under gravity; t = frames since the burst.
const CONFETTI_COLORS = [C.gold, C.hotpink, C.pressure, C.aqua, C.candy, C.white, C.teal];

export const Confetti: React.FC<{t: number; x: number; y: number; n?: number; seed?: number; spread?: number; floor?: number}> = ({
  t,
  x,
  y,
  n = 26,
  seed = 7,
  spread = 1,
  floor = 1800,
}) => {
  const r = rng(seed);
  const bits = Array.from({length: n}, (_, i) => {
    const a = r() * Math.PI * 2;
    const v = (8 + r() * 18) * spread;
    const vx = Math.cos(a) * v;
    const vy = Math.sin(a) * v - 10 * spread;
    const px = x + vx * t;
    const py = Math.min(floor, y + vy * t + 0.55 * t * t);
    const rot = (r() * 360 + t * (r() * 20 - 10)) % 360;
    const w = 14 + r() * 18;
    const h = 8 + r() * 10;
    const col = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    return (
      <g key={i} transform={`translate(${px.toFixed(1)},${py.toFixed(1)}) rotate(${rot.toFixed(1)})`}>
        <Shape d={`M${-w / 2},${-h / 2}L${w / 2},${-h / 2}L${w / 2},${h / 2}L${-w / 2},${h / 2}Z`} fill={col} line={2.5} />
      </g>
    );
  });
  return <>{bits}</>;
};

export {circle, ellipse, heart, poly, rect, smooth, star4, Only};
