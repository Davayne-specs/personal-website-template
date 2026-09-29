// Pip: the penguin from the "With You" cover. Faces right; ~300px tall at scale 1.
import React from 'react';
import {C} from '../brand/tokens';
import {Flat, Line, Only, Shape} from '../lib/print';
import {Part, Place, Pose, renderRig} from '../lib/rig';
import {circle, ellipse, heart, smooth} from '../lib/shapes';

export type PipFace = {eyes?: 'dot' | 'happy' | 'closed' | 'x' | 'wide' | 'shades'; blush?: number; beakOpen?: number};
type Params = {face: PipFace; scarf: boolean; holdR?: React.ReactNode; tint?: string; scarfColor: string};

const BODY = smooth([[0, -150], [70, -124], [102, -30], [96, 62], [62, 122], [0, 140], [-62, 122], [-98, 62], [-104, -30], [-72, -124]], true, 0.55);
const BELLY = smooth([[26, -70], [74, -36], [88, 40], [66, 112], [18, 132], [-28, 112], [-44, 40], [-26, -30]], true, 0.6);
const FLIPPER = 'M0,0C-26,40 -34,110 -14,158C4,126 22,64 12,0Z';
const FOOT = 'M-24,0C-30,14 -34,26 -40,30L40,30C34,22 26,12 22,0Z';

const PARTS: Part<Params>[] = [
  {id: 'flipperL', parent: 'body', at: [-78, -56], z: 1, draw: ({tint}) => <Shape d={FLIPPER} fill={tint ?? C.ink} line={4} />},
  {id: 'footL', parent: 'body', at: [-34, 128], z: 2, draw: () => <Shape d={FOOT} fill={C.amber} line={4} />},
  {id: 'footR', parent: 'body', at: [38, 128], z: 2, draw: () => <Shape d={FOOT} fill={C.amber} line={4} />},
  {
    id: 'body',
    at: [0, 0],
    z: 5,
    draw: ({tint}) => (
      <>
        <Shape d={BODY} fill={tint ?? C.ink} line={5} lineColor={C.ink} />
        <Shape d={BELLY} fill={C.white} shade="M30,-80L120,-80L120,150L30,150Z" shadeInk="ht-ink-1" line={3.5} />
        <Flat d="M22,-66C44,-70 64,-58 72,-40C54,-50 36,-54 22,-50Z" fill={C.amber} opacity={0.9} />
      </>
    ),
  },
  {
    id: 'head',
    parent: 'body',
    at: [12, -118],
    z: 8,
    draw: ({face, scarf, tint, scarfColor}) => {
      const eyes = face.eyes ?? 'dot';
      const bo = face.beakOpen ?? 0;
      return (
        <>
          <Shape d={circle(4, -36, 72)} fill={tint ?? C.ink} line={5} lineColor={C.ink} />
          <Shape d={ellipse(34, -50, 26, 22)} fill={C.white} line={3} />
          <Shape d={`M66,${-34 - 4 * bo}L122,-24L66,${-12 + 6 * bo}Z`} fill={C.amber} line={4} />
          {bo > 0.1 && <Flat d="M70,-24L110,-22L70,-18Z" fill="#3A1E2B" />}
          <Only plate="key">
            {eyes === 'dot' || eyes === 'wide' ? (
              <>
                <path d={circle(40, -50, eyes === 'wide' ? 11 : 8)} fill={C.ink} />
                <path d={circle(37, -54, 3)} fill={C.white} />
              </>
            ) : null}
          </Only>
          {eyes === 'happy' && <Line d="M28,-48C34,-60 46,-60 52,-48" size={5} color={C.ink} />}
          {eyes === 'closed' && <Line d="M28,-50C34,-44 46,-44 52,-50" size={5} color={C.ink} />}
          {eyes === 'x' && <Line d="M30,-60L50,-40M50,-60L30,-40" size={5} color={C.ink} />}
          {eyes === 'shades' && (
            <>
              <Shape d="M14,-66L66,-66C68,-50 60,-38 44,-38C28,-38 16,-48 14,-66Z" fill={C.ink} line={3.5} lineColor={C.ink} />
              <Line d="M-20,-62L14,-64" size={4} color={C.ink} />
              <Flat d="M26,-60L40,-60L30,-48Z" fill={C.white} opacity={0.7} />
            </>
          )}
          {(face.blush ?? 0) > 0 && <Flat d={circle(46, -24, 14)} fill="url(#ht-pink-3)" opacity={face.blush} />}
          {scarf && (
            <>
              <Shape d="M-62,20C-30,40 30,44 64,22L60,46C28,66 -30,62 -64,42Z" fill={scarfColor} line={4} />
              <Shape d="M-44,40L-60,110L-30,106L-22,46Z" fill={scarfColor} line={4} />
              <Line d="M-50,60L-32,58M-54,82L-36,80" size={4} color={C.white} />
            </>
          )}
        </>
      );
    },
  },
  {
    id: 'flipperR',
    parent: 'body',
    at: [70, -52],
    z: 10,
    draw: ({holdR, tint}) => (
      <>
        <Shape d={FLIPPER} fill={tint ?? C.ink} line={4} lineColor={C.ink} />
        {holdR}
      </>
    ),
  },
];

export const Pip: React.FC<{place: Place; pose?: Pose; face?: PipFace; scarf?: boolean; scarfColor?: string; holdR?: React.ReactNode; tint?: string}> = ({
  place,
  pose = {},
  face = {},
  scarf = true,
  scarfColor = C.hotpink,
  holdR,
  tint,
}) => <>{renderRig(PARTS, pose, place, {face, scarf, holdR, tint, scarfColor})}</>;

// A waddle: body rocks, feet take turns lifting.
export const waddle = (f: number, period = 18, amp = 1): Pose => {
  const s = Math.sin((f / period) * Math.PI * 2);
  return {body: 7 * s * amp, footL: Math.max(0, s) * -24 * amp, footR: Math.max(0, -s) * 24 * amp, flipperL: 10 + 8 * s * amp, flipperR: -10 + 8 * s * amp, head: -3 * s * amp};
};

export const Pebble: React.FC<{x?: number; y?: number; s?: number}> = ({x = 0, y = 0, s = 1}) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <Shape d={smooth([[-24, 4], [-18, -14], [4, -20], [24, -8], [22, 12], [0, 20], [-18, 16]], true, 0.6)} fill={C.smoke} shade="M0,-30L40,-30L40,30L0,30Z" shadeInk="ht-ink-2" line={4} />
    <Line d="M-10,-8C-4,-12 4,-12 8,-8" size={3} color={C.white} opacity={0.8} />
  </g>
);

export const PipHeart: React.FC<{x: number; y: number; s: number}> = ({x, y, s}) => <Shape d={heart(x, y, s)} fill={C.hotpink} line={3.5} />;
