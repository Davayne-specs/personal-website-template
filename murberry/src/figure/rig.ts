import {Pt, angleOf, len, pt, rotAbout, solveIK, sub} from '../lib/geom';

export const SHOULDER = pt(318, 700);
export const ELBOW = pt(500, 716);
export const WRIST = pt(647, 712);
export const L1 = len(sub(ELBOW, SHOULDER));
export const L2 = len(sub(WRIST, ELBOW));
const A1 = angleOf(sub(ELBOW, SHOULDER));
const A2 = angleOf(sub(WRIST, ELBOW));

export type ArmPose = {upper: string; fore: string; S: Pt; E: Pt; W: Pt};

/** Arm transforms for a shoulder at S reaching a wrist target T. */
export const armPose = (S: Pt, T: Pt, side = 1): ArmPose => {
  const {E, W} = solveIK(S, T, L1, L2, side);
  const phi1 = angleOf(sub(E, S)) - A1;
  const phi2 = angleOf(sub(W, E)) - A2;
  return {
    upper: `translate(${(S.x - SHOULDER.x).toFixed(3)} ${(S.y - SHOULDER.y).toFixed(3)}) rotate(${phi1.toFixed(3)} ${SHOULDER.x} ${SHOULDER.y})`,
    fore: `translate(${(E.x - ELBOW.x).toFixed(3)} ${(E.y - ELBOW.y).toFixed(3)}) rotate(${phi2.toFixed(3)} ${ELBOW.x} ${ELBOW.y})`,
    S,
    E,
    W,
  };
};

// Wall push-up: body pivots at the heel; the palm stays on the wall.
export const WALL_PIVOT = pt(320, 1440);
export const WALL_REST = 16; // degrees of lean in the storyboard (arms straight)
export const WALL_TARGET = rotAbout(rotAbout(WRIST, -10, SHOULDER), WALL_REST, WALL_PIVOT);

export const wallPose = (lean: number) => {
  const S = rotAbout(SHOULDER, lean, WALL_PIVOT);
  return {body: `rotate(${lean.toFixed(3)} ${WALL_PIVOT.x} ${WALL_PIVOT.y})`, arm: armPose(S, WALL_TARGET, 1)};
};

// Floor push-up: body pivots at the toes; the hand stays on the floor.
export const FLOOR_PIVOT = pt(446, 1482);
export const FLOOR_REST = 72.7;
export const FLOOR_TARGET = rotAbout(rotAbout(WRIST, 17.3, SHOULDER), FLOOR_REST, FLOOR_PIVOT);

export const floorPose = (angle: number) => {
  const S = rotAbout(SHOULDER, angle, FLOOR_PIVOT);
  return {body: `rotate(${angle.toFixed(3)} ${FLOOR_PIVOT.x} ${FLOOR_PIVOT.y})`, arm: armPose(S, FLOOR_TARGET, 1)};
};
