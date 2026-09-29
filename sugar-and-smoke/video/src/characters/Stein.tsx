// Stein: the narrator, mbastein's paper stand-in (an original design, not a likeness).
// Also drives Smoke, the other man: same build drawn in grey watercolour smoke.
import React from 'react';
import {C} from '../brand/tokens';
import {Flat, Line, Only, Shape} from '../lib/print';
import {Part, Place, Pose, renderRig} from '../lib/rig';
import {capsule, circle, ellipse, heart, mirror, rect} from '../lib/shapes';
import {drawFace, Face} from './face';

const TEAL_D = '#155F5C';
const JOG = '#3B3350';

export type SteinStyle = {
  ghost?: boolean; // Smoke: grey watercolour, dotted outline, faceless
  hood?: boolean; // hood up
  bandage?: boolean;
  crown?: boolean;
  chain?: boolean;
  winter?: boolean; // beanie and scarf (No. 2)
  pyjamas?: boolean;
  aged?: boolean; // grey hair (the far future)
};

type Params = {face: Face; style: SteinStyle; holdL?: React.ReactNode; holdR?: React.ReactNode; opacity: number};

const PELVIS = 'M-96,-34C-102,10 -100,48 -90,74L90,74C100,48 102,10 96,-34Z';
const HOODIE =
  'M-104,44C-112,-40 -124,-170 -114,-236C-106,-282 -66,-300 -30,-304L30,-304C66,-300 106,-282 114,-236C124,-170 112,-40 104,44C40,58 -40,58 -104,44Z';
const HOODIE_SH = 'M52,-300C100,-290 122,-240 124,-170C126,-80 114,0 104,44C90,50 76,52 64,54C84,-40 86,-200 52,-300Z';
const HOOD = 'M-82,18C-104,-30 -72,-82 0,-84C72,-82 104,-30 82,18C50,0 -50,0 -82,18Z';
const HOOD_UP = 'M-104,-10C-118,-120 -80,-296 0,-298C80,-296 118,-120 104,-10C60,-40 -60,-40 -104,-10Z';
const NECK = 'M-26,10L-25,-48L25,-48L26,10Z';
const HEAD = 'M-84,-156C-86,-226 -50,-256 0,-256C50,-256 86,-226 84,-156C82,-98 58,-50 0,-44C-58,-50 -82,-98 -84,-156Z';
const HEAD_SH = 'M40,-252C80,-236 92,-190 84,-150C80,-100 60,-60 20,-46C60,-90 70,-180 40,-252Z';
const EAR_L = 'M-80,-172C-106,-178 -110,-126 -80,-122Z';
const HAIR = 'M-87,-158C-95,-238 -54,-272 0,-272C54,-272 95,-238 87,-158C80,-198 62,-218 0,-220C-62,-218 -80,-198 -87,-158Z';
const STUBBLE = 'M-60,-104C-54,-62 -22,-48 0,-48C22,-48 54,-62 60,-104C44,-78 -44,-78 -60,-104Z';
const HAND = 'M-26,-4C-32,26 -26,58 0,62C20,60 28,44 28,34C40,32 46,14 30,6L26,-4Z';
const SHOE = 'M28,-10C32,18 28,40 8,46L-54,46C-74,46 -78,28 -64,18C-50,8 -32,2 -26,-10Z';
const SOLE = 'M-72,34L30,34L28,48C0,54 -50,54 -70,48Z';

const fillOf = (s: SteinStyle, c: string) => (s.ghost ? undefined : c);
const pat = (s: SteinStyle) => (s.ghost ? 'smokefill' : undefined);
const top = (s: SteinStyle) => (s.pyjamas ? C.blush : C.teal);
const bottoms = (s: SteinStyle) => (s.pyjamas ? C.blush : JOG);

const cut = (s: SteinStyle, d: string, fill: string, extra: Partial<React.ComponentProps<typeof Shape>> = {}) => (
  <Shape
    d={d}
    fill={fillOf(s, fill)}
    pattern={pat(s)}
    dotted={s.ghost}
    lineColor={s.ghost ? C.ash : undefined}
    {...(s.ghost ? {} : extra)}
  />
);

const leg = (side: 'L' | 'R'): Part<Params>[] => {
  const sx = side === 'L' ? -1 : 1;
  return [
    {
      id: `thigh${side}`,
      parent: 'pelvis',
      at: [sx * 50, 40],
      z: 3,
      draw: ({style}) => (
        <>
          {cut(style, capsule(190, 86, 74), bottoms(style), {shade: side === 'R' ? 'M10,-40L60,-40L60,200L10,200Z' : undefined, shadeInk: 'ht-ink-1'})}
          {!style.ghost && <Line d={`M${sx * 8},40C${sx * 12},90 ${sx * 8},140 ${sx * 2},176`} size={3} opacity={0.6} />}
        </>
      ),
    },
    {
      id: `shin${side}`,
      parent: `thigh${side}`,
      at: [0, 188],
      z: 2,
      draw: ({style}) => (
        <>
          {cut(style, capsule(172, 74, 62), bottoms(style))}
          {!style.ghost && <Shape d={rect(-33, 150, 66, 24, 9)} fill="#2A2338" line={3.5} />}
        </>
      ),
    },
    {
      id: `foot${side}`,
      parent: `shin${side}`,
      at: [0, 168],
      z: 4,
      draw: ({style}) => {
        const shoe = side === 'L' ? SHOE : mirror(SHOE);
        const sole = side === 'L' ? SOLE : mirror(SOLE);
        return (
          <>
            {cut(style, shoe, C.white)}
            {!style.ghost && (
              <>
                <Shape d={sole} fill={C.candy} line={3.5} />
                <Line d={side === 'L' ? 'M-30,6L-12,18M-42,14L-24,26' : 'M30,6L12,18M42,14L24,26'} size={4.5} color={C.hotpink} />
              </>
            )}
          </>
        );
      },
    },
  ];
};

const arm = (side: 'L' | 'R'): Part<Params>[] => {
  const sx = side === 'L' ? -1 : 1;
  return [
    {
      id: `uarm${side}`,
      parent: 'torso',
      at: [sx * 106, -264],
      z: 10,
      draw: ({style}) => cut(style, capsule(152, 68, 60), top(style), {shade: side === 'R' ? 'M8,-40L50,-40L50,190L8,190Z' : undefined, shadeInk: 'ht-ink-1'}),
    },
    {
      id: `farm${side}`,
      parent: `uarm${side}`,
      at: [0, 150],
      z: 11,
      draw: ({style}) => (
        <>
          {cut(style, capsule(138, 60, 54), top(style))}
          {!style.ghost && <Shape d={rect(-29, 110, 58, 26, 10)} fill={style.pyjamas ? C.hotpink : TEAL_D} line={3.5} />}
        </>
      ),
    },
    {
      id: `hand${side}`,
      parent: `farm${side}`,
      at: [0, 134],
      z: 12,
      draw: ({style, holdL, holdR}) => (
        <>
          {cut(style, side === 'L' ? HAND : mirror(HAND), C.steinSkin)}
          {side === 'L' ? holdL : holdR}
        </>
      ),
    },
  ];
};

export const STEIN_PARTS: Part<Params>[] = [
  {
    id: 'pelvis',
    at: [0, 0],
    z: 5,
    draw: ({style}) => cut(style, PELVIS, bottoms(style)),
  },
  ...leg('L'),
  ...leg('R'),
  {
    id: 'torso',
    parent: 'pelvis',
    at: [0, -24],
    z: 6,
    draw: ({style}) =>
      style.ghost ? (
        <>
          {cut(style, HOODIE, C.smoke)}
          {/* palm-print collar: the only solid thing about him */}
          <Shape d="M-70,-300C-60,-250 -30,-236 0,-236C30,-236 60,-250 70,-300L40,-304C30,-270 -30,-270 -40,-304Z" fill={C.aqua} line={3.5} />
          <Line d="M-50,-290L-40,-270M-30,-296L-20,-262M20,-262L30,-296M40,-270L50,-290" size={4} color={C.teal} />
        </>
      ) : style.pyjamas ? (
        <>
          {/* heart-print pyjama top */}
          <Shape d={HOODIE} fill={C.blush} shade={HOODIE_SH} shadeInk="ht-pink-2" />
          {[[-60, -200], [20, -150], [-30, -80], [60, -230], [50, -40], [-70, -10]].map(([x, y], i) => (
            <Flat key={i} d={heart(x, y, 16)} fill={C.hotpink} />
          ))}
          <Line d="M-40,-300L0,-250L40,-300M0,-250L0,30" size={4} />
        </>
      ) : (
        <>
          <Shape d={HOODIE} fill={C.teal} shade={HOODIE_SH} shadeInk="ht-ink-2" />
          <Line d="M-100,24C-40,36 40,36 100,24" size={3.5} />
          <Line d="M-64,6L-50,-80C-20,-88 20,-88 50,-80L64,6" size={4} />
          <Line d="M-18,-296L-22,-236" size={5} color={C.white} />
          <Line d="M18,-296L22,-232" size={5} color={C.white} />
          <Only plate="key">
            <path d={circle(-22, -232, 5)} fill={C.white} />
            <path d={circle(22, -228, 5)} fill={C.white} />
          </Only>
        </>
      ),
  },
  {
    id: 'hood',
    parent: 'torso',
    at: [0, -300],
    z: 7,
    draw: ({style}) => (style.hood || style.pyjamas ? null : cut(style, HOOD, TEAL_D)),
  },
  {
    id: 'head',
    parent: 'torso',
    at: [0, -302],
    z: 20,
    draw: ({style, face}) => {
      if (style.ghost) {
        return (
          <>
            {cut(style, NECK, C.smoke)}
            {cut(style, HEAD, C.smoke)}
            {drawFace({...face, eyes: 'shades', mouth: 0, smile: 0.1}, {eyeX: 32, eyeY: -150, browY: -1000, noseY: -1000, mouthY: -1000, width: 170})}
          </>
        );
      }
      return (
        <>
          <Shape d={NECK} fill={C.steinSkin} />
          <Shape d={EAR_L} fill={C.steinSkin} />
          <Shape d={mirror(EAR_L)} fill={C.steinSkin} />
          <Shape d={HEAD} fill={C.steinSkin} shade={HEAD_SH} shadeInk="ht-ink-2" />
          <Flat d={STUBBLE} fill={style.aged ? 'url(#ht-cotton-2)' : 'url(#ht-ink-1)'} />
          <Shape d={HAIR} fill={style.aged ? '#C9CDD2' : C.ink} line={4} />
          {drawFace({...face, blush: face.blush}, {eyeX: 33, eyeY: -150, browY: -182, noseY: -116, mouthY: -86, width: 170})}
          {style.chain !== false && (
            <>
              {/* chain + ring pendant sit on the hoodie, drawn with the head so they stay on top */}
              <Line d="M-46,6C-30,52 30,52 46,6" size={4.5} color={C.gold} />
              <Shape d={`${ellipse(0, 58, 13, 15)}${ellipse(0, 58, 7.5, 9.5)}`} evenodd fill={C.gold} line={3} sheen />
            </>
          )}
          {style.hood && <Shape d={HOOD_UP} fill={C.teal} evenodd={false} line={6} />}
          {style.crown && (
            <Shape d="M-74,-250L-66,-330L-34,-290L0,-344L34,-290L66,-330L74,-250Z" fill={C.gold} pattern="foil" sheen line={5} />
          )}
          {style.winter && (
            <>
              <Shape d="M-92,-176C-96,-250 -56,-292 0,-292C56,-292 96,-250 92,-176Z" fill={C.hotpink} shade="M30,-300L100,-300L100,-170L30,-170Z" shadeInk="ht-ink-2" line={6} />
              <Shape d="M-96,-196L96,-196L98,-160L-98,-160Z" fill={C.candy} line={5} />
              <Line d="M-60,-196L-58,-162M-20,-196L-20,-160M20,-196L20,-160M60,-196L58,-162" size={3} opacity={0.6} />
              <Shape d={circle(0, -300, 26)} fill={C.white} line={5} />
              <Shape d="M-62,4C-30,26 30,26 62,4L66,34C30,60 -30,60 -66,34Z" fill={C.candy} line={5} />
              <Shape d="M30,34L46,120L74,112L58,30Z" fill={C.candy} line={5} />
              <Line d="M38,60L62,56M44,86L66,82" size={4} color={C.hotpink} />
            </>
          )}
          {style.bandage && (
            <>
              <Shape d="M-88,-214C-40,-240 40,-240 88,-214L88,-190C40,-214 -40,-214 -88,-190Z" fill={C.white} line={4} />
              <Line d="M40,-222L56,-200M52,-226L66,-204" size={3.5} color={C.pressure} />
            </>
          )}
        </>
      );
    },
  },
  ...arm('L'),
  ...arm('R'),
];

export type SteinProps = {
  place: Place;
  pose?: Pose;
  face?: Face;
  style?: SteinStyle;
  holdL?: React.ReactNode;
  holdR?: React.ReactNode;
  opacity?: number;
};

export const Stein: React.FC<SteinProps> = ({place, pose = {}, face = {}, style = {}, holdL, holdR, opacity = 1}) => (
  <g opacity={opacity}>{renderRig(STEIN_PARTS, pose, place, {face, style, holdL, holdR, opacity})}</g>
);

// Smoke, the other man: Stein's build, drawn in smoke, a little taller, never a face.
export const Smoke: React.FC<Omit<SteinProps, 'style'> & {thin?: number}> = ({place, pose = {}, face = {}, opacity = 1, thin = 0}) => (
  <g opacity={opacity * (1 - thin)}>
    {renderRig(STEIN_PARTS, pose, {...place, scale: (place.scale ?? 1) * 1.06}, {face, style: {ghost: true}, opacity})}
  </g>
);

// Handy poses (degrees per joint).
export const STEIN_POSES = {
  stand: {uarmL: 8, uarmR: -8, farmL: -6, farmR: 6},
  handsOut: {uarmL: 38, farmL: -70, uarmR: -38, farmR: 70},
  shrug: {uarmL: 30, farmL: -100, uarmR: -30, farmR: 100, head: -4},
  pointR: {uarmR: -100, farmR: -6, uarmL: 10, farmL: -10},
  armsUp: {uarmL: 150, farmL: 20, uarmR: -150, farmR: -20},
  holdFront: {uarmL: -20, farmL: -95, uarmR: 20, farmR: 95},
  chestHand: {uarmR: 20, farmR: 120, uarmL: 8, farmL: -6},
  thumbsUp: {uarmR: -40, farmR: -110},
  sit: {thighL: 80, shinL: -80, thighR: 76, shinR: -76},
  kneel: {thighL: 85, shinL: -5, thighR: -10, shinR: 100},
};
