export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type Ease = (t: number) => number;

export const ease = {
  linear: ((t) => t) as Ease,
  inOutSine: ((t) => -(Math.cos(Math.PI * t) - 1) / 2) as Ease,
  inSine: ((t) => 1 - Math.cos((t * Math.PI) / 2)) as Ease,
  outSine: ((t) => Math.sin((t * Math.PI) / 2)) as Ease,
  inOutCubic: ((t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) as Ease,
  outCubic: ((t) => 1 - Math.pow(1 - t, 3)) as Ease,
  inCubic: ((t) => t * t * t) as Ease,
  inOutQuad: ((t) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2) as Ease,
};

/** Eased 0..1 progress of t through [t0, t1]. */
export const prog = (t: number, t0: number, t1: number, e: Ease = ease.inOutSine) =>
  e(clamp01((t - t0) / (t1 - t0)));

/** Fade in over [in0, in1], hold, fade out over [out0, out1]. */
export const fade = (
  t: number,
  in0: number,
  in1: number,
  out0 = Infinity,
  out1 = Infinity,
) => {
  const a = prog(t, in0, in1);
  return Number.isFinite(out0) && Number.isFinite(out1) ? Math.min(a, 1 - prog(t, out0, out1)) : a;
};

/** Smooth back-and-forth 0..1..0 over [t0, t1]. */
export const pulse = (t: number, t0: number, t1: number) => {
  const p = clamp01((t - t0) / (t1 - t0));
  return Math.sin(Math.PI * p);
};

/** Deterministic pseudo-random in [0, 1) from an integer seed. */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Mix two #rrggbb colours. */
export const mixHex = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const m = (s: number) => Math.round(lerp(ch(pa, s), ch(pb, s), clamp01(t)));
  return `rgb(${m(16)},${m(8)},${m(0)})`;
};
