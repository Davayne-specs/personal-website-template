// Path builders. Everything returns absolute-command SVG path strings.

const f = (v: number) => +v.toFixed(2);
const K = 0.5523;

export const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${f(cx - rx)},${f(cy)}` +
  `C${f(cx - rx)},${f(cy - ry * K)} ${f(cx - rx * K)},${f(cy - ry)} ${f(cx)},${f(cy - ry)}` +
  `C${f(cx + rx * K)},${f(cy - ry)} ${f(cx + rx)},${f(cy - ry * K)} ${f(cx + rx)},${f(cy)}` +
  `C${f(cx + rx)},${f(cy + ry * K)} ${f(cx + rx * K)},${f(cy + ry)} ${f(cx)},${f(cy + ry)}` +
  `C${f(cx - rx * K)},${f(cy + ry)} ${f(cx - rx)},${f(cy + ry * K)} ${f(cx - rx)},${f(cy)}Z`;

export const circle = (cx: number, cy: number, r: number) => ellipse(cx, cy, r, r);

export const rect = (x: number, y: number, w: number, h: number, r = 0) => {
  if (r <= 0) return `M${f(x)},${f(y)}L${f(x + w)},${f(y)}L${f(x + w)},${f(y + h)}L${f(x)},${f(y + h)}Z`;
  const q = Math.min(r, w / 2, h / 2);
  return (
    `M${f(x + q)},${f(y)}L${f(x + w - q)},${f(y)}Q${f(x + w)},${f(y)} ${f(x + w)},${f(y + q)}` +
    `L${f(x + w)},${f(y + h - q)}Q${f(x + w)},${f(y + h)} ${f(x + w - q)},${f(y + h)}` +
    `L${f(x + q)},${f(y + h)}Q${f(x)},${f(y + h)} ${f(x)},${f(y + h - q)}` +
    `L${f(x)},${f(y + q)}Q${f(x)},${f(y)} ${f(x + q)},${f(y)}Z`
  );
};

export const poly = (pts: [number, number][], closed = true) =>
  pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)},${f(y)}`).join('') + (closed ? 'Z' : '');

// Catmull-Rom through points, as cubic Beziers. Good for organic outlines.
export const smooth = (pts: [number, number][], closed = true, tension = 0.5) => {
  const n = pts.length;
  if (n < 2) return '';
  const get = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const t = tension / 3;
    const c1x = p1[0] + (p2[0] - p0[0]) * t;
    const c1y = p1[1] + (p2[1] - p0[1]) * t;
    const c2x = p2[0] - (p3[0] - p1[0]) * t;
    const c2y = p2[1] - (p3[1] - p1[1]) * t;
    d += `C${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + (closed ? 'Z' : '');
};

// A limb from its pivot (0,0) straight down to (0,len); widths at top and bottom, round ends.
export const capsule = (len: number, w0: number, w1: number) => {
  const a = w0 / 2;
  const b = w1 / 2;
  return (
    `M${f(-a)},0L${f(-b)},${f(len)}` +
    `C${f(-b)},${f(len + b * 1.3)} ${f(b)},${f(len + b * 1.3)} ${f(b)},${f(len)}` +
    `L${f(a)},0C${f(a)},${f(-a * 1.3)} ${f(-a)},${f(-a * 1.3)} ${f(-a)},0Z`
  );
};

export const line = (pts: [number, number][]) => poly(pts, false);

export const arc = (cx: number, cy: number, r: number, a0: number, a1: number, steps = 24) => {
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return smooth(pts, false);
};

export const star4 = (cx: number, cy: number, r: number, waist = 0.18) => {
  const w = r * waist;
  return (
    `M${f(cx)},${f(cy - r)}Q${f(cx + w)},${f(cy - w)} ${f(cx + r)},${f(cy)}` +
    `Q${f(cx + w)},${f(cy + w)} ${f(cx)},${f(cy + r)}Q${f(cx - w)},${f(cy + w)} ${f(cx - r)},${f(cy)}` +
    `Q${f(cx - w)},${f(cy - w)} ${f(cx)},${f(cy - r)}Z`
  );
};

export const heart = (cx: number, cy: number, s: number) =>
  `M${f(cx)},${f(cy + s * 0.9)}` +
  `C${f(cx - s * 1.2)},${f(cy + s * 0.1)} ${f(cx - s * 1.1)},${f(cy - s * 0.9)} ${f(cx - s * 0.5)},${f(cy - s * 0.85)}` +
  `C${f(cx - s * 0.15)},${f(cy - s * 0.82)} ${f(cx)},${f(cy - s * 0.55)} ${f(cx)},${f(cy - s * 0.4)}` +
  `C${f(cx)},${f(cy - s * 0.55)} ${f(cx + s * 0.15)},${f(cy - s * 0.82)} ${f(cx + s * 0.5)},${f(cy - s * 0.85)}` +
  `C${f(cx + s * 1.1)},${f(cy - s * 0.9)} ${f(cx + s * 1.2)},${f(cy + s * 0.1)} ${f(cx)},${f(cy + s * 0.9)}Z`;

// Puffy cloud outline: bumps around an ellipse.
export const cloud = (cx: number, cy: number, rx: number, ry: number, bumps = 9, seed = 1) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < bumps * 2; i++) {
    const a = (i / (bumps * 2)) * Math.PI * 2;
    const out = i % 2 === 0 ? 1.08 + 0.08 * Math.sin(seed * 3.1 + i * 1.7) : 0.9;
    pts.push([cx + Math.cos(a) * rx * out, cy + Math.sin(a) * ry * out]);
  }
  return smooth(pts, true, 0.9);
};

// Scalloped curly-hair mass: many small lobes around an ellipse.
export const curls = (cx: number, cy: number, rx: number, ry: number, lobes = 18, seed = 3) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < lobes * 3; i++) {
    const a = (i / (lobes * 3)) * Math.PI * 2;
    const k = i % 3;
    const out = k === 1 ? 1.07 + 0.04 * Math.sin(seed + i) : k === 0 ? 0.97 : 1.0;
    pts.push([cx + Math.cos(a) * rx * out, cy + Math.sin(a) * ry * out]);
  }
  return smooth(pts, true, 0.7);
};

export const translate = (d: string, dx: number, dy: number) =>
  d.replace(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g, (_, x, y) => `${f(+x + dx)},${f(+y + dy)}`);

export const scalePath = (d: string, sx: number, sy = sx) =>
  d.replace(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g, (_, x, y) => `${f(+x * sx)},${f(+y * sy)}`);

// Mirror a path horizontally about x = 0.
export const mirror = (d: string) => scalePath(d, -1, 1);
