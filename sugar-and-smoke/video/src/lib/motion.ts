// Motion for the jointed rigs (Stein and Precious share joint names): gaits keyed like a hand-drawn
// walk (contact, down, passing, up), beat-locked dances, and an idle that breathes and shifts weight.
// Every function returns a pose plus a vertical offset in rig units (multiply by the rig's scale).
import {clamp, ease, lerp} from './ease';
import {noise1} from './random';
import {mixPose, Pose} from './rig';

export type Motion = {pose: Pose; dy: number; dx: number};

// Periodic Catmull-Rom through evenly spaced keys; phase 0..1 wraps.
const loop = (keys: number[], phase: number) => {
  const n = keys.length;
  const t = ((((phase % 1) + 1) % 1) * n);
  const i = Math.floor(t);
  const u = t - i;
  const p0 = keys[(i - 1 + n) % n];
  const p1 = keys[i % n];
  const p2 = keys[(i + 1) % n];
  const p3 = keys[(i + 2) % n];
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
};

// Eight keys per stride for the LEFT leg, starting at its heel strike in front.
// Thigh: negative swings forward. Shin: positive folds the foot back. Foot: offsets on top of keeping the sole level.
const GAITS = {
  walk: {
    thigh: [-24, -17, -2, 13, 21, 10, -10, -22],
    shin: [2, 14, 4, 6, 16, 46, 48, 18],
    toe: [-8, 0, 0, 4, 16, 10, 0, -4],
    bob: 9,
    lean: 3,
    arm: 20,
    elbow: [8, 16],
  },
  run: {
    thigh: [-40, -26, 2, 30, 42, 24, -12, -38],
    shin: [12, 32, 24, 30, 58, 100, 104, 52],
    toe: [-6, 0, 4, 10, 22, 12, 0, -6],
    bob: 20,
    lean: 10,
    arm: 38,
    elbow: [70, 22],
  },
};

// Stride length of one full cycle (two steps), in rig units, for the walk at amplitude 1.
export const STRIDE = {walk: 600, run: 960};

const gait = (kind: 'walk' | 'run', phase: number, amp: number): Motion => {
  const G = GAITS[kind];
  const leg = (ph: number) => {
    const thigh = loop(G.thigh, ph) * amp;
    const shin = loop(G.shin, ph) * amp;
    return {thigh, shin, foot: -(thigh + shin) + loop(G.toe, ph) * amp};
  };
  const L = leg(phase);
  const R = leg(phase + 0.5);
  const swing = Math.cos(2 * Math.PI * phase);
  const lag = Math.cos(2 * Math.PI * (phase - 0.07));
  const [e0, e1] = G.elbow;
  const torso = G.lean * amp + 1.5 * Math.sin(4 * Math.PI * phase) * amp;
  return {
    pose: {
      thighL: L.thigh,
      shinL: L.shin,
      footL: L.foot,
      thighR: R.thigh,
      shinR: R.shin,
      footR: R.foot,
      uarmL: G.arm * swing * amp,
      farmL: -(e0 + e1 * Math.max(0, -lag)) * amp,
      uarmR: -G.arm * swing * amp,
      farmR: -(e0 + e1 * Math.max(0, lag)) * amp,
      torso,
      head: -torso * 0.8 + 1.2 * Math.sin(4 * Math.PI * phase + 1),
    },
    // lowest just after each heel strike, highest as the free leg passes
    dy: G.bob * amp * Math.cos(4 * Math.PI * (phase - 0.125)),
    dx: 0,
  };
};

export const walk = (phase: number, amp = 1) => gait('walk', phase, amp);
export const run = (phase: number, amp = 1) => gait('run', phase, amp);

// A model's walk: the walk with shoulders back, a hip sway and a flick of the wrist.
export const strut = (phase: number, amp = 1): Motion => {
  const m = gait('walk', phase, amp);
  const sway = Math.sin(2 * Math.PI * phase);
  return {
    ...m,
    pose: {
      ...m.pose,
      pelvis: 4 * sway * amp,
      torso: -1 - 5 * sway * amp,
      head: -3 + 3 * sway * amp,
      uarmL: (m.pose.uarmL ?? 0) * 0.7 + 8,
      uarmR: (m.pose.uarmR ?? 0) * 0.7 - 8,
      farmL: -24 - 10 * Math.max(0, -sway),
      farmR: -24 - 10 * Math.max(0, sway),
    },
  };
};

// Seen straight on, walking toward us: the same gait, small, with the hips rocking.
export const approach = (phase: number, amp = 0.45): Motion => {
  const m = gait('walk', phase, amp);
  const rock = Math.sin(2 * Math.PI * phase);
  return {...m, pose: {...m.pose, pelvis: 2.5 * rock, torso: -3 * rock, head: 1.5 * rock}, dy: m.dy * 1.4};
};

export type DanceKind = 'bounce' | 'whine' | 'twoStep' | 'wave' | 'lean';

// Dances lock to the song: `beatPhase` 0..1 between beats, `beatN` counts beats.
export const dance = (kind: DanceKind, beatPhase: number, beatN: number, arms: 'up' | 'hips' | 'pump' = 'pump'): Motion => {
  // down on the beat, up between beats
  const down = 0.5 + 0.5 * Math.cos(2 * Math.PI * beatPhase);
  const two = ((beatN % 2) + beatPhase) / 2; // 0..1 over two beats
  const s2 = Math.sin(2 * Math.PI * two);
  const c2 = Math.cos(2 * Math.PI * two);
  const armsPose = (k: number): Pose =>
    arms === 'up'
      ? {uarmL: 145 + 10 * s2, farmL: 25 - 20 * s2, uarmR: -145 + 10 * s2, farmR: -25 - 20 * s2}
      : arms === 'hips'
        ? {uarmL: 40, farmL: -120, uarmR: -40, farmR: 120}
        : {uarmL: 22 + 12 * k, farmL: -78 - 22 * k, uarmR: -22 - 12 * k, farmR: 78 + 22 * k};
  switch (kind) {
    case 'whine': {
      // hips roll in a slow circle over two beats; the chest counters; knees stay soft
      return {
        pose: {thighL: 14, shinL: -24, thighR: -14, shinR: 24, pelvis: 7 * s2, torso: -11 * s2, head: 5 * s2, ...armsPose(down)},
        dy: 24 + 6 * down,
        dx: 22 * c2,
      };
    }
    case 'twoStep': {
      const liftL = Math.max(0, s2);
      const liftR = Math.max(0, -s2);
      return {
        pose: {thighL: 4 + 16 * liftL, shinL: -6 - 34 * liftL, thighR: -4 - 16 * liftR, shinR: 6 + 34 * liftR, torso: 4 * s2, head: -2 * s2, ...armsPose(Math.abs(s2))},
        dy: 8 * down,
        dx: 30 * s2,
      };
    }
    case 'wave': {
      return {
        pose: {thighL: 8 * down, shinL: -14 * down, thighR: -8 * down, shinR: 14 * down, uarmR: -150 + 14 * s2, farmR: -20 + 26 * s2, uarmL: 22, farmL: -80, head: 4 * down, torso: 2 * s2},
        dy: 12 * down,
        dx: 0,
      };
    }
    case 'lean': {
      // the cool lean: weight on one hip, a slow nod on the beat
      return {pose: {thighL: 6, shinL: -4, thighR: -2, shinR: 10, pelvis: -3, torso: 5, head: 4 * down - 2, uarmL: 30, farmL: -110, uarmR: -12, farmR: 14}, dy: 4 * down, dx: 0};
    }
    default: {
      // bounce: knees open on the beat, shoulders alternate, head nods
      const side = beatN % 2 ? 1 : -1;
      return {
        pose: {thighL: 10 * down, shinL: -18 * down, thighR: -10 * down, shinR: 18 * down, torso: 3 * side * down, head: 6 * down, ...armsPose(down)},
        dy: 14 * down,
        dx: 0,
      };
    }
  }
};

// Breathing and small weight shifts so a still figure never freezes; seed keeps two people out of step.
export const idle = (f: number, seed = 1): Motion => {
  const breath = Math.sin(f / 26 + seed);
  return {
    pose: {
      torso: 1.1 * breath + 1.2 * noise1(seed + 11, f / 70),
      head: 2.2 * noise1(seed + 12, f / 45) - 0.8 * breath,
      uarmL: 2 * noise1(seed + 13, f / 55),
      uarmR: -2 * noise1(seed + 14, f / 55),
      pelvis: 1.2 * noise1(seed + 15, f / 90),
    },
    dy: 1.6 * breath,
    dx: 0,
  };
};

// Ease into a pose with a small overshoot, as a body arrives rather than snaps.
export const settle = (f: number, target: Pose, from: Pose, dur = 10): Pose => mixPose(from, target, ease.outBack(clamp(f / dur)));

// Eyes that dart to a new spot every second or so, not drift.
export const glance = (f: number, seed = 1, aim: [number, number] = [0, 0]): [number, number] => {
  const step = Math.floor((f + seed * 17) / 34);
  return [clamp(aim[0] + 0.35 * noise1(seed + 21, step + 0.5), -1, 1), clamp(aim[1] + 0.25 * noise1(seed + 22, step + 0.5), -1, 1)];
};

export const add = (...ms: Motion[]): Motion => {
  const pose: Pose = {};
  ms.forEach((m) => Object.entries(m.pose).forEach(([k, v]) => (pose[k] = (pose[k] ?? 0) + v)));
  return {pose, dy: ms.reduce((a, m) => a + m.dy, 0), dx: ms.reduce((a, m) => a + m.dx, 0)};
};

export const scaleMotion = (m: Motion, k: number): Motion => {
  const pose: Pose = {};
  Object.entries(m.pose).forEach(([key, v]) => (pose[key] = v * k));
  return {pose, dy: m.dy * k, dx: m.dx * k};
};

export {lerp};
