export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const inv = (a: number, b: number, x: number) => (b === a ? 0 : (x - a) / (b - a));

// Blend two #RRGGBB colours.
export const mixColor = (a: string, b: string, t: number) => {
  const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${ca.map((v, i) => Math.round(lerp(v, cb[i], clamp(t))).toString(16).padStart(2, '0')).join('')}`;
};

// A colour ramp: [[frame, '#RRGGBB'], ...] blended linearly between keys.
export const colorKeys = (f: number, ks: [number, string][]) => {
  if (f <= ks[0][0]) return ks[0][1];
  for (let i = 0; i < ks.length - 1; i++) {
    const [f0, c0] = ks[i];
    const [f1, c1] = ks[i + 1];
    if (f <= f1) return mixColor(c0, c1, (f - f0) / Math.max(1, f1 - f0));
  }
  return ks[ks.length - 1][1];
};

export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inCubic: (t: number) => t * t * t,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number) => {
    const c1 = 1.4;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
};

export type Easing = (t: number) => number;

// 0..1 progress of `f` through [start, start + dur].
export const prog = (f: number, start: number, dur: number, e: Easing = ease.linear) =>
  e(clamp(inv(start, start + dur, f)));

// Piecewise keyframes: [[frame, value], ...]; eased per segment.
export const keys = (f: number, ks: [number, number][], e: Easing = ease.inOutCubic) => {
  if (f <= ks[0][0]) return ks[0][1];
  for (let i = 0; i < ks.length - 1; i++) {
    const [f0, v0] = ks[i];
    const [f1, v1] = ks[i + 1];
    if (f <= f1) return lerp(v0, v1, e(clamp(inv(f0, f1, f))));
  }
  return ks[ks.length - 1][1];
};

// Damped swing: starts at amp, oscillates and settles (used by swing tags, dangling things).
export const swing = (f: number, amp: number, period = 22, decay = 18) =>
  f < 0 ? amp : amp * Math.exp(-f / decay) * Math.cos((2 * Math.PI * f) / period);

// A quick drop-and-settle used when a cut-out lands on the page.
export const land = (f: number, start: number, dur = 10) => {
  const t = clamp(inv(start, start + dur, f));
  return ease.outBack(t);
};
