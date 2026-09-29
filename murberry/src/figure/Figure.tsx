import React from 'react';
import {paper} from '../brand/tokens';
import {DrawPath} from '../components/Draw';
import {clamp01} from '../lib/anim';
import * as P from './paths';
import {ArmPose} from './rig';

/**
 * The figure's torso, head and legs in figure space. `draw` runs the pencil
 * outline from the head down; `fill` brings in the sand body, hatching and
 * hair; `details` brings in the face and body lines.
 */
export const FigureBody: React.FC<{
  uid: string;
  draw?: number;
  fill?: number;
  details?: number;
  width?: number;
}> = ({uid, draw = 1, fill = 1, details = 1, width = 2.6}) => {
  const f = clamp01(fill);
  const dt = clamp01(details);
  return (
    <g>
      {f > 0 ? (
        <g opacity={f}>
          <path fill={paper.skin} d={P.BODY} />
          <g fill={`url(#${uid}-hatch)`} opacity={0.6}>
            {P.BODY_HATCH.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          <path d={P.HAIR} fill={`url(#${uid}-hair)`} opacity={0.85} />
        </g>
      ) : null}
      <DrawPath d={P.OUTLINE_FRONT} p={draw} width={width} />
      <DrawPath d={P.OUTLINE_BACK} p={draw} width={width} reverse />
      {dt > 0 ? (
        <g opacity={dt}>
          <g opacity={0.8}>
            {P.DETAILS.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="#2A2420" strokeWidth={1.6} strokeLinecap="round" />
            ))}
          </g>
          <g opacity={0.45}>
            {P.FAINT.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="#2A2420" strokeWidth={1.3} strokeLinecap="round" />
            ))}
          </g>
        </g>
      ) : null}
    </g>
  );
};

const ELBOW_R = 44; // distance from the arm's axis to its outer edge at the elbow

/** Outer elbow: fills the gap a bend opens between the two segments and gives it a pencil edge. */
const ElbowCap: React.FC<{pose: ArmPose; width: number; fill: number}> = ({pose, width, fill}) => {
  const a1 = Math.atan2(pose.E.y - pose.S.y, pose.E.x - pose.S.x) + Math.PI / 2;
  const a2 = Math.atan2(pose.W.y - pose.E.y, pose.W.x - pose.E.x) + Math.PI / 2;
  // The rig always bends the forearm back toward the body (a left turn), so
  // the outer corner sits on the +90 degree side and sweeps from a1 down to a2.
  if (a1 - a2 < 0.02) return null;
  const at = (a: number) => `${(pose.E.x + ELBOW_R * Math.cos(a)).toFixed(2)} ${(pose.E.y + ELBOW_R * Math.sin(a)).toFixed(2)}`;
  const arc = `M ${at(a1)} A ${ELBOW_R} ${ELBOW_R} 0 0 0 ${at(a2)}`;
  return (
    <g>
      <path d={`M ${pose.E.x} ${pose.E.y} L ${at(a1)} A ${ELBOW_R} ${ELBOW_R} 0 0 0 ${at(a2)} Z`} fill={paper.skinLight} opacity={clamp01(fill)} />
      <path d={arc} fill="none" stroke="#2A2420" strokeWidth={width} strokeLinecap="round" />
    </g>
  );
};

// Tucks the forearm under the hand so a bent wrist leaves no notch.
const WRIST_CAP = 'M 636 689 L 658 691 Q 666 712 658 733 L 636 735 Z';
const WRIST_LINES = 'M 644 690 L 658 691 M 646 734 L 658 733';

/** Upper arm and forearm posed by the rig, drawn over the body. */
export const Arm: React.FC<{
  uid: string;
  pose: ArmPose;
  inner?: boolean;
  draw?: number;
  fill?: number;
  width?: number;
  wrist?: boolean;
}> = ({uid, pose, inner = true, draw = 1, fill = 1, width = 2.6, wrist = true}) => (
  <g>
    <g transform={pose.upper}>
      <g opacity={clamp01(fill)}>
        <path fill={paper.skinLight} d={P.UPPER_ARM} />
        <path fill={`url(#${uid}-hatch)`} opacity={0.6} d={P.UPPER_ARM_HATCH} />
      </g>
      <DrawPath d={P.UPPER_ARM_LINE} p={draw} width={width} />
      {inner ? <DrawPath d={P.UPPER_ARM_INNER} p={draw} width={1.6} opacity={0.8} /> : null}
    </g>
    {draw >= 0.999 ? <ElbowCap pose={pose} width={width} fill={fill} /> : null}
    <g transform={pose.fore}>
      <g opacity={clamp01(fill)}>
        {wrist ? <path fill={paper.skinLight} d={WRIST_CAP} /> : null}
        <path fill={paper.skinLight} d={P.FOREARM} />
        <path fill={`url(#${uid}-hatch)`} opacity={0.6} d={P.FOREARM_HATCH} />
      </g>
      <DrawPath d={P.FOREARM_LINE} p={draw} width={width} />
      {wrist && draw >= 0.999 ? <path d={WRIST_LINES} fill="none" stroke="#2A2420" strokeWidth={width} strokeLinecap="round" /> : null}
    </g>
  </g>
);

export const WallHand: React.FC<{draw?: number; fill?: number; width?: number}> = ({draw = 1, fill = 1, width = 2.6}) => (
  <g>
    <path fill={paper.skinLight} d={P.WALL_HAND} opacity={clamp01(fill)} />
    <DrawPath d={P.WALL_HAND_LINE} p={draw} width={width} />
    <DrawPath d={P.WALL_HAND_DETAIL} p={draw} width={1.4} opacity={0.7} />
  </g>
);

export const WallFoot: React.FC<{draw?: number; fill?: number; width?: number}> = ({draw = 1, fill = 1, width = 2.6}) => (
  <g>
    <path fill={paper.skin} d={P.FOOT_WALL} opacity={clamp01(fill)} />
    <DrawPath d={P.FOOT_WALL_LINE} p={draw} width={width} />
  </g>
);

/** Soft contact shadow under a foot or hand. */
export const Contact: React.FC<{cx: number; cy: number; rx: number; ry?: number; o?: number; blur?: number}> = ({
  cx,
  cy,
  rx,
  ry = 9,
  o = 0.2,
  blur = 6,
}) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#2A2420" opacity={o} style={{filter: `blur(${blur}px)`}} />;
