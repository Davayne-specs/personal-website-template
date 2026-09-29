// Precious: the "you" of the song. Full figure, drawn confident and radiant.
import React from 'react';
import {C} from '../brand/tokens';
import {Flat, Line, Only, Shape} from '../lib/print';
import {Part, Place, Pose, renderRig} from '../lib/rig';
import {capsule, circle, curls, ellipse, mirror, smooth} from '../lib/shapes';
import {drawFace, Face} from './face';

const SKIN = C.preciousSkin;
const LIP = '#B8336C';

export type PreciousStyle = {
  crown?: boolean;
  gloves?: boolean; // pink boxing gloves (the throw)
  shades?: boolean; // heart sunglasses (Ring Pop)
  glow?: number; // gold rays behind her, 0..1
  winter?: boolean; // earmuffs and scarf (No. 2)
  aged?: boolean; // grey curls (the far future)
};

type Params = {face: Face; style: PreciousStyle; holdL?: React.ReactNode; holdR?: React.ReactNode};

const SKIRT =
  'M-96,-46C-130,-32 -158,18 -158,80C-158,142 -142,200 -124,252L124,252C142,200 158,142 158,80C158,18 130,-32 96,-46Z';
const SKIRT_SH = 'M70,-40C130,-20 158,40 158,90C158,150 142,206 124,252L84,252C116,170 118,40 70,-40Z';
const BODICE =
  'M-98,8C-104,-40 -110,-80 -118,-130C-128,-190 -124,-236 -104,-266C-84,-288 -54,-294 -30,-294L30,-294C54,-294 84,-288 104,-266C124,-236 128,-190 118,-130C110,-80 104,-40 98,8Z';
const BODICE_SH = 'M56,-292C100,-282 128,-236 120,-150C114,-90 104,-40 98,8L70,8C92,-80 96,-220 56,-292Z';
const NECKLINE = 'M-48,-4C-42,40 -20,58 0,58C20,58 42,40 48,-4Z';
const NECK = 'M-22,10L-21,-42L21,-42L22,10Z';
const FACE = 'M-78,-150C-80,-214 -46,-244 0,-244C46,-244 80,-214 78,-150C76,-96 52,-50 0,-44C-52,-50 -76,-96 -78,-150Z';
const FACE_SH = 'M36,-240C74,-224 84,-186 78,-146C74,-100 54,-62 20,-46C54,-90 64,-176 36,-240Z';
const HAND = 'M-22,-4C-27,24 -22,50 0,54C17,52 24,40 24,30C34,28 38,14 26,6L22,-4Z';
const FOOT = 'M22,-8C26,14 22,30 6,34L-44,34C-60,34 -62,20 -50,14C-38,8 -26,2 -20,-8Z';
const SLEEVE = 'M-32,-12C-38,16 -34,40 -28,50L28,50C34,40 38,16 32,-12C20,-30 -20,-30 -32,-12Z';

const leg = (side: 'L' | 'R'): Part<Params>[] => {
  const sx = side === 'L' ? -1 : 1;
  return [
    {id: `thigh${side}`, parent: 'pelvis', at: [sx * 60, 40], z: 2, draw: () => <Shape d={capsule(180, 96, 78)} fill={SKIN} />},
    {
      id: `shin${side}`,
      parent: `thigh${side}`,
      at: [0, 176],
      z: 1,
      draw: () => <Shape d={capsule(160, 76, 56)} fill={SKIN} shade={side === 'R' ? 'M8,-30L40,-30L40,170L8,170Z' : undefined} shadeInk="ht-ink-1" />,
    },
    {
      id: `foot${side}`,
      parent: `shin${side}`,
      at: [0, 158],
      z: 3,
      draw: () => (
        <>
          <Shape d={side === 'L' ? FOOT : mirror(FOOT)} fill={SKIN} />
          <Line d={side === 'L' ? 'M-36,12C-20,4 0,4 14,12M-8,-4L-12,24' : 'M36,12C20,4 0,4 -14,12M8,-4L12,24'} size={6} color={C.gold} />
          <Shape d={side === 'L' ? 'M-58,32L20,32L20,40L-58,40Z' : 'M58,32L-20,32L-20,40L58,40Z'} fill={C.gold} line={2.5} />
        </>
      ),
    },
  ];
};

const GLOVE_PTS: [number, number][] = [[-34, -6], [-42, 30], [-32, 68], [0, 80], [32, 68], [46, 34], [40, 0], [20, -10]];
const glove = (sx: number) => (
  <>
    <Shape
      d={smooth(GLOVE_PTS.map(([x, y]) => [x * sx, y] as [number, number]))}
      fill={C.hotpink}
      shade={`M${10 * sx},-10L${50 * sx},-10L${50 * sx},80L${10 * sx},80Z`}
      shadeInk="ht-ink-2"
    />
    <Shape d={`M${-30 * sx},-8L${36 * sx},-8L${34 * sx},10L${-28 * sx},10Z`} fill={C.white} line={3.5} />
  </>
);

const arm = (side: 'L' | 'R'): Part<Params>[] => {
  const sx = side === 'L' ? -1 : 1;
  return [
    {
      id: `uarm${side}`,
      parent: 'torso',
      at: [sx * 102, -256],
      z: 10,
      draw: () => (
        <>
          <Shape d={capsule(140, 62, 52)} fill={SKIN} />
          <Shape d={SLEEVE} fill={C.hotpink} />
          <Line d="M-30,40L30,40" size={5} color={C.aqua} />
        </>
      ),
    },
    {
      id: `farm${side}`,
      parent: `uarm${side}`,
      at: [0, 138],
      z: 11,
      draw: () => (
        <>
          <Shape d={capsule(126, 52, 42)} fill={SKIN} />
          <Shape d={`${ellipse(0, 104, 26, 9)}`} fill={C.gold} line={3} sheen />
        </>
      ),
    },
    {
      id: `hand${side}`,
      parent: `farm${side}`,
      at: [0, 124],
      z: 12,
      draw: ({style, holdL, holdR}) => (
        <>
          {style.gloves ? glove(sx) : <Shape d={side === 'L' ? HAND : mirror(HAND)} fill={SKIN} />}
          {side === 'L' ? holdL : holdR}
        </>
      ),
    },
  ];
};

const RAYS = (n: number, r0: number, r1: number) =>
  Array.from({length: n}, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return `M${(Math.cos(a) * r0).toFixed(1)},${(Math.sin(a) * r0).toFixed(1)}L${(Math.cos(a) * r1).toFixed(1)},${(Math.sin(a) * r1).toFixed(1)}`;
  }).join('');

export const PRECIOUS_PARTS: Part<Params>[] = [
  {
    id: 'rays',
    parent: 'torso',
    at: [0, -330],
    z: -5,
    draw: ({style}) =>
      (style.glow ?? 0) > 0.01 ? (
        <g opacity={style.glow}>
          <Only plate="key">
            <circle r={430} fill="url(#glow-gold)" />
          </Only>
          <Line d={RAYS(22, 250, 470)} size={9} color={C.gold} thin={0.2} />
        </g>
      ) : null,
  },
  {id: 'pelvis', at: [0, 0], z: 5, draw: () => <Shape d={SKIRT} fill={C.hotpink} shade={SKIRT_SH} shadeInk="ht-ink-2" />},
  ...leg('L'),
  ...leg('R'),
  {
    id: 'torso',
    parent: 'pelvis',
    at: [0, -40],
    z: 6,
    draw: () => (
      <>
        <Shape d={BODICE} fill={C.hotpink} shade={BODICE_SH} shadeInk="ht-ink-2" />
        <Shape d="M-100,-30L100,-30L101,-2L-101,-2Z" fill={C.aqua} line={3.5} />
        <Line d="M-76,-196C-56,-168 -22,-166 -6,-184" size={3.5} opacity={0.75} />
        <Line d="M6,-184C22,-166 56,-168 76,-196" size={3.5} opacity={0.75} />
      </>
    ),
  },
  {
    id: 'hairBack',
    parent: 'torso',
    at: [0, -292],
    z: 18,
    draw: ({style}) => <Shape d={curls(0, -168, 168, 150, 16, 5)} fill={style.aged ? '#C9CDD2' : C.ink} shade={circle(-70, -250, 90)} shadeInk={style.aged ? 'ht-smoke-1' : 'ht-candy-2'} line={5} />,
  },
  {
    id: 'head',
    parent: 'torso',
    at: [0, -292],
    z: 20,
    draw: ({face, style}) => (
      <>
        <Shape d={NECK} fill={SKIN} />
        <Shape d={NECKLINE} fill={SKIN} line={4} />
        <Line d="M-51,-4C-45,44 -20,64 0,64C20,64 45,44 51,-4" size={6} color={C.aqua} />
        <Shape d={FACE} fill={SKIN} shade={FACE_SH} shadeInk="ht-ink-2" />
        <Shape d={curls(0, -226, 90, 44, 12, 9)} fill={style.aged ? '#C9CDD2' : C.ink} line={4} />
        <Shape d={`${circle(-82, -118, 21)}${circle(-82, -118, 14)}`} evenodd fill={C.gold} line={3} sheen />
        <Shape d={`${circle(82, -118, 21)}${circle(82, -118, 14)}`} evenodd fill={C.gold} line={3} sheen />
        {drawFace({lashes: true, lip: LIP, blush: 0.35, ...face, eyes: style.shades ? 'shades' : face.eyes}, {eyeX: 30, eyeY: -146, browY: -178, noseY: -114, mouthY: -84, width: 160})}
        {style.shades && (
          <Only plate="key">
            <path d="M-62,-160C-76,-176 -60,-196 -44,-180C-28,-196 -12,-176 -26,-160L-44,-140Z" fill={C.hotpink} />
            <path d="M26,-160C12,-176 28,-196 44,-180C60,-196 76,-176 62,-160L44,-140Z" fill={C.hotpink} />
          </Only>
        )}
        {style.winter && (
          <>
            <Line d="M-96,-150C-96,-290 96,-290 96,-150" size={10} color={C.ink} />
            <Shape d={circle(-98, -142, 40)} fill={C.hotpink} shade={circle(-84, -130, 40)} shadeInk="ht-ink-2" line={5} />
            <Shape d={circle(98, -142, 40)} fill={C.hotpink} shade={circle(112, -130, 40)} shadeInk="ht-ink-2" line={5} />
            <Shape d="M-58,6C-28,28 28,28 58,6L62,36C28,62 -28,62 -62,36Z" fill={C.teal} line={5} />
            <Shape d="M-40,34L-54,120L-26,116L-16,34Z" fill={C.teal} line={5} />
          </>
        )}
        {style.crown && (
          <Shape d="M-70,-250L-60,-320L-30,-284L0,-334L30,-284L60,-320L70,-250Z" fill={C.gold} pattern="foil" sheen line={5} />
        )}
      </>
    ),
  },
  ...arm('L'),
  ...arm('R'),
];

export type PreciousProps = {
  place: Place;
  pose?: Pose;
  face?: Face;
  style?: PreciousStyle;
  holdL?: React.ReactNode;
  holdR?: React.ReactNode;
  opacity?: number;
};

export const Precious: React.FC<PreciousProps> = ({place, pose = {}, face = {}, style = {}, holdL, holdR, opacity = 1}) => (
  <g opacity={opacity}>{renderRig(PRECIOUS_PARTS, pose, place, {face, style, holdL, holdR})}</g>
);

export const PRECIOUS_POSES = {
  stand: {uarmL: 10, uarmR: -10, farmL: -8, farmR: 8},
  hipHand: {uarmL: 40, farmL: -120, uarmR: -12, farmR: 10},
  bothHips: {uarmL: 40, farmL: -120, uarmR: -40, farmR: 120},
  reach: {uarmR: -80, farmR: -10, uarmL: 10, farmL: -6},
  wave: {uarmR: -150, farmR: -30},
  mouthHand: {uarmR: -20, farmR: 150, uarmL: 10},
};

export const Glint: React.FC<{x: number; y: number; r: number; opacity?: number}> = ({x, y, r, opacity = 1}) => (
  <Flat d={`M${x},${y - r}Q${x + r * 0.16},${y - r * 0.16} ${x + r},${y}Q${x + r * 0.16},${y + r * 0.16} ${x},${y + r}Q${x - r * 0.16},${y + r * 0.16} ${x - r},${y}Q${x - r * 0.16},${y - r * 0.16} ${x},${y - r}Z`} fill={C.goldHi} opacity={opacity} />
);
