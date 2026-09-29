// Jointed cut-out rigs. A character is a list of parts; each part hangs from
// its parent at `at`, rotates about its own origin, and draws itself in local
// coordinates. Parts are drawn in z order after world transforms are solved.
import React from 'react';

type M = [number, number, number, number, number, number]; // a b c d e f

const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const T = (x: number, y: number): M => [1, 0, 0, 1, x, y];
const R = (deg: number): M => {
  const r = (deg * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
};
const S = (sx: number, sy: number): M => [sx, 0, 0, sy, 0, 0];

export type Part<P> = {
  id: string;
  parent?: string;
  at: [number, number];
  z: number;
  draw: (p: P) => React.ReactNode;
};

export type Pose = Record<string, number>;

export type Place = {
  x: number;
  y: number;
  scale?: number;
  flip?: boolean; // face the other way
  rotate?: number;
  squash?: number; // vertical squash (1 = none); keeps feet planted
};

export function renderRig<P>(parts: Part<P>[], pose: Pose, place: Place, params: P, key = 'rig') {
  const s = place.scale ?? 1;
  const sq = place.squash ?? 1;
  const root: M = mul(mul(mul(T(place.x, place.y), S((place.flip ? -1 : 1) * s * (2 - sq), s * sq)), R(place.rotate ?? 0)), [1, 0, 0, 1, 0, 0]);
  const world = new Map<string, M>();
  const byId = new Map(parts.map((p) => [p.id, p]));
  const solve = (id: string): M => {
    const hit = world.get(id);
    if (hit) return hit;
    const p = byId.get(id)!;
    const parent = p.parent ? solve(p.parent) : root;
    const m = mul(mul(parent, T(p.at[0], p.at[1])), R(pose[id] ?? 0));
    world.set(id, m);
    return m;
  };
  parts.forEach((p) => solve(p.id));
  const sorted = [...parts].sort((a, b) => a.z - b.z);
  return (
    <g key={key}>
      {sorted.map((p) => {
        const m = world.get(p.id)!;
        return (
          <g key={p.id} transform={`matrix(${m.map((v) => +v.toFixed(4)).join(' ')})`}>
            {p.draw(params)}
          </g>
        );
      })}
    </g>
  );
}

// Where a point in a part's local coordinates lands in the scene (for attaching props).
export function worldPoint<P>(parts: Part<P>[], pose: Pose, place: Place, id: string, local: [number, number] = [0, 0]): [number, number] {
  const s = place.scale ?? 1;
  const sq = place.squash ?? 1;
  const byId = new Map(parts.map((p) => [p.id, p]));
  const chain: Part<P>[] = [];
  let cur: Part<P> | undefined = byId.get(id);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parent ? byId.get(cur.parent) : undefined;
  }
  let m: M = mul(mul(T(place.x, place.y), S((place.flip ? -1 : 1) * s * (2 - sq), s * sq)), R(place.rotate ?? 0));
  chain.forEach((p) => {
    m = mul(mul(m, T(p.at[0], p.at[1])), R(pose[p.id] ?? 0));
  });
  return [m[0] * local[0] + m[2] * local[1] + m[4], m[1] * local[0] + m[3] * local[1] + m[5]];
}

// Sum of joint angles from the root to a part (to keep a held prop upright: rotate by minus this).
export function chainAngle<P>(parts: Part<P>[], pose: Pose, id: string): number {
  const byId = new Map(parts.map((p) => [p.id, p]));
  let a = 0;
  let cur: Part<P> | undefined = byId.get(id);
  while (cur) {
    a += pose[cur.id] ?? 0;
    cur = cur.parent ? byId.get(cur.parent) : undefined;
  }
  return a;
}

// Two-bone reach: the angles for `upper` and `lower` that put the end part's grip point on a
// target in scene coordinates. `bend` picks which way the elbow folds. Ignores squash.
export function reach<P>(
  parts: Part<P>[],
  pose: Pose,
  place: Place,
  upper: string,
  lower: string,
  end: string,
  target: [number, number],
  bend: 1 | -1 = 1,
  grip: [number, number] = [0, 30]
): Pose {
  const s = place.scale ?? 1;
  const byId = new Map(parts.map((p) => [p.id, p]));
  const lo = byId.get(lower)!;
  const en = byId.get(end)!;
  const L1 = Math.hypot(lo.at[0], lo.at[1]) * s;
  const L2 = Math.hypot(en.at[0] + grip[0], en.at[1] + grip[1]) * s;
  const [ox, oy] = worldPoint(parts, pose, place, upper);
  // direction to the target, back in the rig's own (unflipped, unrotated) frame
  const wx = (target[0] - ox) * (place.flip ? -1 : 1);
  const wy = target[1] - oy;
  const r = (-(place.rotate ?? 0) * Math.PI) / 180;
  const lx = wx * Math.cos(r) - wy * Math.sin(r);
  const ly = wx * Math.sin(r) + wy * Math.cos(r);
  const d = Math.min(L1 + L2 - 0.01, Math.max(Math.abs(L1 - L2) + 0.01, Math.hypot(lx, ly)));
  const aim = Math.atan2(-lx, ly); // a bone at angle a points along (-sin a, cos a)
  const a1 = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
  const a2 = Math.acos((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2));
  const deg = 180 / Math.PI;
  const parent = byId.get(upper)!.parent;
  return {
    [upper]: (aim + bend * a1) * deg - (parent ? chainAngle(parts, pose, parent) : 0),
    [lower]: -bend * (Math.PI - a2) * deg,
  };
}

// Blend poses: a + (b - a) * t for every joint.
export const mixPose = (a: Pose, b: Pose, t: number): Pose => {
  const out: Pose = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.forEach((k) => {
    out[k] = (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * t;
  });
  return out;
};

export const addPose = (...ps: Pose[]): Pose => {
  const out: Pose = {};
  ps.forEach((p) => Object.entries(p).forEach(([k, v]) => (out[k] = (out[k] ?? 0) + v)));
  return out;
};

// Pose timeline: [[frame, pose], ...] eased between keys.
export const poseAt = (f: number, ks: [number, Pose][], e: (t: number) => number = (t) => t * t * (3 - 2 * t)): Pose => {
  if (f <= ks[0][0]) return ks[0][1];
  for (let i = 0; i < ks.length - 1; i++) {
    const [f0, p0] = ks[i];
    const [f1, p1] = ks[i + 1];
    if (f <= f1) return mixPose(p0, p1, e((f - f0) / Math.max(1, f1 - f0)));
  }
  return ks[ks.length - 1][1];
};

// Walk / run cycle offsets for a biped rig (thigh/shin/upper-arm/forearm names shared by the cast).
export const walkCycle = (f: number, period = 34, amp = 1): Pose => {
  const ph = (f / period) * Math.PI * 2;
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  return {
    thighL: 22 * s * amp,
    thighR: -22 * s * amp,
    shinL: (-14 - 14 * Math.max(0, -c)) * amp,
    shinR: (-14 - 14 * Math.max(0, c)) * amp,
    uarmL: -16 * s * amp,
    uarmR: 16 * s * amp,
    farmL: -10 * amp,
    farmR: 10 * amp,
    torso: 2 * Math.sin(ph * 2) * amp,
  };
};

export const bob = (f: number, period = 34, amp = 6) => -Math.abs(Math.sin((f / period) * Math.PI * 2)) * amp;
