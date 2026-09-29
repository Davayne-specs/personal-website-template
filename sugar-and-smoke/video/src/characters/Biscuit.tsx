// Biscuit: Stein's dog. Seen in profile, facing right. ~320px long at scale 1.
import React from 'react';
import {C} from '../brand/tokens';
import {Line, Only, Shape} from '../lib/print';
import {Part, Place, Pose, renderRig} from '../lib/rig';
import {circle, ellipse, smooth} from '../lib/shapes';

type Params = {tongue: boolean; eyes: 'open' | 'happy'};

const BODY = smooth([[-120, -40], [-60, -70], [40, -72], [110, -48], [124, 0], [96, 34], [0, 40], [-100, 34], [-132, 0]]);
const BODY_SH = 'M-140,0L140,0L140,60L-140,60Z';
const HEAD = smooth([[-40, -40], [0, -64], [44, -52], [66, -22], [104, -10], [110, 16], [80, 30], [30, 34], [-20, 26], [-46, 0]]);

const legPart = (id: string, x: number, z: number): Part<Params> => ({
  id,
  parent: 'body',
  at: [x, 18],
  z,
  draw: () => <Shape d="M-18,-6L-15,70C-15,86 -8,92 8,92L24,92C36,92 36,76 24,72L15,70L18,-6Z" fill={C.white} />,
});

const PARTS: Part<Params>[] = [
  legPart('legBL', -84, 1),
  legPart('legFL', 70, 1),
  {id: 'body', at: [0, 0], z: 5, draw: () => <Shape d={BODY} fill={C.white} shade={BODY_SH} shadeInk="ht-ink-1" />},
  legPart('legBR', -104, 6),
  legPart('legFR', 50, 6),
  {
    id: 'tail',
    parent: 'body',
    at: [-124, -26],
    z: 4,
    draw: () => <Shape d="M0,6C-30,0 -50,-30 -44,-64C-40,-70 -32,-68 -30,-60C-30,-34 -16,-14 4,-10Z" fill={C.white} />,
  },
  {
    id: 'head',
    parent: 'body',
    at: [96, -52],
    z: 8,
    draw: ({tongue, eyes}) => (
      <g transform="translate(0,-34)">
        <Shape d={HEAD} fill={C.white} />
        <Shape d="M-10,-50C-40,-60 -56,-20 -40,24C-30,30 -20,20 -18,6C-16,-16 -8,-36 -10,-50Z" fill={C.teal} />
        <Only plate="key">
          <path d={ellipse(104, -2, 10, 8)} fill={C.ink} />
          {eyes === 'open' ? <path d={ellipse(40, -24, 6, 8)} fill={C.ink} /> : null}
        </Only>
        {eyes === 'happy' && <Line d="M30,-22C36,-32 46,-32 52,-22" size={5} />}
        <Line d="M104,8C100,22 86,26 74,22" size={4} />
        {tongue && <Shape d="M84,22C84,44 98,50 104,34L100,20Z" fill={C.hotpink} line={3.5} />}
        {/* collar and gold swing tag */}
        <Shape d="M-30,6C-10,24 20,30 40,30L38,44C14,44 -14,36 -36,18Z" fill={C.hotpink} line={3.5} />
        <Shape d={`${circle(18, 58, 12)}`} fill={C.gold} pattern="foil" line={3} sheen />
      </g>
    ),
  },
];

export const Biscuit: React.FC<{place: Place; pose?: Pose; tongue?: boolean; eyes?: 'open' | 'happy'}> = ({
  place,
  pose = {},
  tongue = true,
  eyes = 'open',
}) => <>{renderRig(PARTS, pose, place, {tongue, eyes})}</>;

export const trot = (f: number, period = 16): Pose => {
  const s = Math.sin((f / period) * Math.PI * 2);
  return {legFL: 24 * s, legBR: 24 * s, legFR: -24 * s, legBL: -24 * s, tail: 14 * Math.sin((f / 6) * Math.PI), head: 4 * s};
};
