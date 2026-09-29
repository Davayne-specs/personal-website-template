// Brush-ink line: any SVG path becomes a filled, thick-to-thin brush stroke.
// Points are sampled along the path, nudged by smooth noise (the "boil"),
// given varying pressure, and outlined with perfect-freehand.
import {getStroke} from 'perfect-freehand';
import {svgPathProperties} from 'svg-path-properties';
import {hash, noise1} from './random';

export type BrushOpts = {
  size?: number; // nominal stroke width in px
  seed?: number; // boil seed: change it to redraw the line
  jitter?: number; // how far points wander (px)
  step?: number; // sampling distance along the path (px)
  thin?: number; // perfect-freehand thinning (0 = even, 1 = very pressure-sensitive)
  taper?: number; // taper length at open ends (px)
};

const cache = new Map<string, string>();
const MAX_CACHE = 30000;

const subpaths = (d: string) => d.match(/M[^M]*/g) ?? [];

const outline = (pts: number[][]) => {
  const n = pts.length;
  if (n < 3) return '';
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}Q`;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    d += `${f(x0)},${f(y0)} ${f((x0 + x1) / 2)},${f((y0 + y1) / 2)} `;
  }
  return d + 'Z';
};

export const brush = (d: string, o: BrushOpts = {}): string => {
  const size = o.size ?? 7;
  const seed = o.seed ?? 0;
  const jitter = o.jitter ?? 1.3;
  const step = o.step ?? 7;
  const thin = o.thin ?? 0.55;
  const key = `${d}|${size}|${seed}|${jitter}|${step}|${thin}|${o.taper ?? ''}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const out: string[] = [];
  subpaths(d).forEach((sub, si) => {
    let props: InstanceType<typeof svgPathProperties>;
    try {
      props = new svgPathProperties(sub);
    } catch {
      return;
    }
    const len = props.getTotalLength();
    if (!(len > 0.5)) return;
    const closed = /[zZ]\s*$/.test(sub.trim());
    const n = Math.max(4, Math.ceil(len / step));
    const extra = closed ? Math.max(2, Math.ceil(n * 0.07)) : 0;
    const s = hash(`${seed}:${si}:${sub.length}:${sub.slice(0, 24)}`);
    const pts: number[][] = [];
    for (let i = 0; i <= n + extra; i++) {
      const at = closed ? ((i / n) * len) % len : Math.min(len, (i / n) * len);
      const p = props.getPointAtLength(at);
      const jx = noise1(s, i * 0.33) * jitter;
      const jy = noise1(s + 7, i * 0.33) * jitter;
      const pressure = 0.52 + 0.3 * noise1(s + 13, i * 0.16);
      pts.push([p.x + jx, p.y + jy, pressure]);
    }
    const taper = o.taper ?? size * 2.5;
    const stroke = getStroke(pts, {
      size,
      thinning: thin,
      smoothing: 0.6,
      streamline: 0.2,
      simulatePressure: false,
      last: true,
      start: {taper: closed ? size * 0.8 : taper, cap: true},
      end: {taper: closed ? size * 1.6 : taper, cap: true},
    });
    out.push(outline(stroke));
  });
  const res = out.join('');
  if (cache.size > MAX_CACHE) cache.clear();
  cache.set(key, res);
  return res;
};
