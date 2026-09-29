// Deterministic randomness so every render is identical.

export const hash = (s: string | number): number => {
  const str = String(s);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Value at an integer lattice point, in [-1, 1].
const lattice = (seed: number, i: number) => {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(i, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967295) * 2 - 1;
};

// Smooth 1D value noise in [-1, 1].
export const noise1 = (seed: number, x: number) => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lattice(seed, i) * (1 - u) + lattice(seed, i + 1) * u;
};

export const pick = <T,>(seed: number, arr: readonly T[]): T => arr[hash(seed) % arr.length];
