// Kid: a child cut-out (Ashaka in No. 3). Front view, origin at the feet, ~420px tall at scale 1.
import React from 'react';
import {C} from '../brand/tokens';
import {Flat, Line, Shape} from '../lib/print';
import {Part, Place, Pose, renderRig} from '../lib/rig';
import {capsule, circle, rect} from '../lib/shapes';
import {drawFace, Face} from './face';

const SKIN = '#7E4F38';
type Params = {face: Face; dress: string; holdL?: React.ReactNode; holdR?: React.ReactNode};

const leg = (side: 'L' | 'R'): Part<Params> => ({
  id: `leg${side}`,
  parent: 'body',
  at: [side === 'L' ? -24 : 24, -6],
  z: 2,
  draw: () => (
    <>
      <Shape d={capsule(118, 40, 34)} fill={SKIN} />
      <Shape d={rect(-27, 112, 54, 28, 11)} fill={C.hotpink} line={3.5} />
      <Line d="M-16,126L16,126" size={3} color={C.white} />
    </>
  ),
});

const arm = (side: 'L' | 'R'): Part<Params> => ({
  id: `arm${side}`,
  parent: 'body',
  at: [side === 'L' ? -48 : 48, -126],
  z: 9,
  draw: ({dress, holdL, holdR}) => (
    <>
      <Shape d={capsule(92, 28, 24)} fill={SKIN} />
      <Shape d={rect(-21, -8, 42, 32, 10)} fill={dress} line={3.5} />
      <Shape d={circle(0, 96, 15)} fill={SKIN} line={3.5} />
      <g transform="translate(0,96)">{side === 'L' ? holdL : holdR}</g>
    </>
  ),
});

export const KID_PARTS: Part<Params>[] = [
  leg('L'),
  leg('R'),
  {
    id: 'body',
    at: [0, -150],
    z: 5,
    draw: ({dress}) => (
      <>
        <Shape d="M-40,-138C-40,-150 40,-150 40,-138L76,16C40,26 -40,26 -76,16Z" fill={dress} shade="M18,-150L90,-150L90,30L18,30Z" shadeInk="ht-ink-1" line={5} />
        <Line d="M-30,-96C-10,-86 10,-86 30,-96" size={3.5} color={C.white} />
        <Line d="M-60,-6C-20,2 20,2 60,-6" size={3} opacity={0.5} />
        <Shape d="M-22,-140C-10,-124 10,-124 22,-140Z" fill={SKIN} />
      </>
    ),
  },
  arm('L'),
  arm('R'),
  {
    id: 'head',
    parent: 'body',
    at: [0, -134],
    z: 8,
    draw: ({face}) => (
      <>
        <Shape d={circle(-54, -98, 30)} fill={C.ink} line={4} />
        <Shape d={circle(54, -98, 30)} fill={C.ink} line={4} />
        <Shape d={circle(0, -62, 60)} fill={SKIN} shade={circle(16, -56, 54)} shadeInk="ht-ink-2" />
        <Shape d="M-60,-74C-62,-128 62,-128 60,-74C40,-98 -40,-98 -60,-74Z" fill={C.ink} line={4} />
        <Flat d={circle(-42, -78, 8)} fill={C.hotpink} />
        <Flat d={circle(42, -78, 8)} fill={C.hotpink} />
        {drawFace({smile: 0.6, ...face}, {eyeX: 22, eyeY: -70, browY: -92, noseY: -52, mouthY: -34, width: 110})}
      </>
    ),
  },
];

export const Kid: React.FC<{place: Place; pose?: Pose; face?: Face; dress?: string; holdL?: React.ReactNode; holdR?: React.ReactNode}> = ({
  place,
  pose = {},
  face = {},
  dress = C.aqua,
  holdL,
  holdR,
}) => <>{renderRig(KID_PARTS, pose, place, {face, dress, holdL, holdR}, 'kid')}</>;

// A quick walk: legs scissor, arms swing the other way.
export const kidWalk = (f: number, period = 22, amp = 1): Pose => {
  const s = Math.sin((f / period) * Math.PI * 2);
  return {legL: 22 * s * amp, legR: -22 * s * amp, armL: -14 * s * amp, armR: 14 * s * amp, body: 2 * Math.sin((f / period) * Math.PI * 4) * amp};
};

export const KID_POSES: Record<string, Pose> = {
  stand: {},
  wave: {armR: -150},
  armsUp: {armL: 150, armR: -150},
  point: {armR: -100},
  hold: {armR: -70, armL: 10},
  hug: {armL: 50, armR: -50},
};
