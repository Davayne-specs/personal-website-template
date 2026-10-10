// The people in a template scene: who they are, where they stand, how they move.
// A recipe names up to two actors; this file solves their poses for a frame and draws them.
import React from 'react';
import {C, FONT} from '../brand/tokens';
import {Face} from '../characters/face';
import {Kid, KID_PARTS, KID_POSES, kidWalk} from '../characters/Kid';
import {Precious, PRECIOUS_PARTS} from '../characters/Precious';
import {Stein, STEIN_PARTS, STEIN_POSES} from '../characters/Stein';
import {clamp, lerp} from '../lib/ease';
import {WashKind} from '../lib/episode';
import {add, approach, dance, DanceKind, glance, idle, Motion, run, scaleMotion, settle, STRIDE, strut, walk} from '../lib/motion';
import {Flat, Line, Shape, Txt} from '../lib/print';
import {chainAngle, Part, Place, Pose, worldPoint} from '../lib/rig';
import {SceneProps} from '../lib/scene';
import {ellipse, heart, Polaroid, rect} from '../props/common';
import {BgName, FLOOR, TimeOfDay} from './backdrops';

export type ActorKind = 'stein' | 'precious' | 'kid';
export type Action = 'idle' | 'walk' | 'run' | 'strut' | 'approach' | 'sway' | 'nod' | 'dance';
type Arms = 'up' | 'hips' | 'pump';

// One actor's part of a recipe. The top-level recipe fields describe the first actor;
// `her` describes Precious when `who` is 'pair'.
export type ActorRecipe = {
  x?: number;
  scale?: number;
  flip?: boolean;
  pose?: string;
  face?: string;
  action?: Action;
  dance?: DanceKind;
  arms?: Arms;
  travel?: [number, number];
  hold?: string;
  style?: Record<string, boolean>;
  facing?: 'left' | 'right' | 'front'; // turn to three-quarters (or square on) whatever they are doing
};

export type Recipe = ActorRecipe & {
  bg?: BgName;
  time?: TimeOfDay;
  wash?: WashKind | WashKind[];
  who?: 'stein' | 'kid' | 'precious' | 'pair' | 'both' | 'none';
  her?: ActorRecipe;
  // the kid's part when `who` is 'both' (No. 3)
  kidX?: number;
  kidScale?: number;
  kidPose?: string;
  kidFace?: string;
  kidTravel?: [number, number];
  kidHold?: string;
  feature?: string[];
  sun?: number | [number, number];
  calendarDay?: number;
  calendarAt?: [number, number, number];
  lampAt?: number;
  boxes?: string[];
  sign?: string;
  note?: string;
  noteAt?: number;
  noteXY?: [number, number];
  noteSize?: number;
  noteColor?: string;
  big?: string;
  bigAt?: number;
  bigY?: number;
  echo?: string;
  zoom?: 'wide' | 'mid' | 'close';
  scroll?: number; // background scroll in px a frame (driving, walking in place)
};

export const POSES: Record<string, Pose> = {
  stand: STEIN_POSES.stand,
  hum: {...STEIN_POSES.stand, head: 10},
  lookUp: {...STEIN_POSES.stand, head: -8},
  chestHand: STEIN_POSES.chestHand,
  armsUp: STEIN_POSES.armsUp,
  point: STEIN_POSES.pointR,
  shrug: STEIN_POSES.shrug,
  sit: {thighL: 80, shinL: -80, thighR: -80, shinR: 80, uarmL: 24, farmL: -40, uarmR: -24, farmR: 40},
  kneel: STEIN_POSES.kneel,
  pray: {...STEIN_POSES.kneel, uarmL: -24, farmL: -100, uarmR: 24, farmR: 100, head: 12},
  salute: {uarmL: 8, farmL: -6, uarmR: -110, farmR: -135, head: -2},
  wave: {uarmL: 8, farmL: -6, uarmR: -150, farmR: -30},
  carry: {uarmL: -30, farmL: -100, uarmR: 30, farmR: 100},
  hold: {uarmR: -50, farmR: -70, uarmL: 10, farmL: -8},
  drink: {uarmR: -30, farmR: -140, uarmL: 10, farmL: -8, head: -6},
  hug: {uarmL: 40, farmL: -70, uarmR: -40, farmR: 70},
  crossed: {uarmL: 30, farmL: -128, uarmR: -30, farmR: 128, head: -4},
  hips: {uarmL: 40, farmL: -120, uarmR: -40, farmR: 120},
  phone: {uarmR: 26, farmR: 148, uarmL: 10, farmL: -8, head: 6},
  beckon: {uarmR: -70, farmR: -60, uarmL: 10, farmL: -8},
  flex: {uarmL: 90, farmL: 110, uarmR: -90, farmR: -110, head: -4},
  stop: {uarmR: -88, farmR: -12, uarmL: 10, farmL: -8},
  offer: {uarmR: -46, farmR: -40, uarmL: 10, farmL: -8},
};

export const FACES: Record<string, Face> = {
  calm: {smile: 0.3},
  sad: {smile: -0.5, brow: 0.2, browTilt: 0.9, look: [0, 0.4]},
  hope: {smile: 0.5, eyes: 'wide', look: [0, -0.7], brow: 0.5},
  joy: {smile: 1, eyes: 'happy'},
  tired: {smile: -0.2, brow: -0.2, browTilt: 0.5, look: [0, 0.5]},
  steel: {smile: 0, brow: -0.4, browTilt: -0.6},
  closed: {smile: 0.3, eyes: 'closed'},
  doubt: {smile: -0.2, browTilt: 0.7, look: [0.6, -0.3]},
  shout: {smile: 0.6, mouth: 0.8, brow: 0.6},
  grin: {smile: 0.9, blush: 0.3},
  cool: {smile: 0.4, eyes: 'shades'},
  sly: {smile: 0.7, brow: 0.5, browTilt: -0.5, eyes: 'wink'},
  attitude: {smile: -0.1, brow: 0.6, browTilt: -0.8, look: [0.5, 0]},
  smitten: {smile: 0.9, eyes: 'heart', blush: 0.6},
  blush: {smile: 0.8, blush: 0.8},
};

const blink = (f: number, every = 90, off = 0) => ((f + off) % every < 4 ? 1 : 0);

// What a hand carries, drawn wrist-local, kept upright by the caller.
export const HOLDS: Record<string, (holder: ActorKind) => React.ReactNode> = {
  polaroid: (holder) => (
    <g transform="translate(0,30) scale(0.7)">
      <Polaroid w={360} h={420} photo={C.release} caption={<Txt x={0} y={178} size={44} font={FONT.hand} color={C.ink}>{holder === 'kid' ? 'Dad' : 'Ashaka'}</Txt>}>
        {holder === 'kid' ? <Stein place={{x: 0, y: 30, scale: 0.3}} face={{smile: 0.8}} style={{chain: false}} /> : <Kid place={{x: 0, y: 112, scale: 0.62}} face={{smile: 1, eyes: 'happy'}} />}
      </Polaroid>
    </g>
  ),
  bottle: () => (
    <g transform="translate(0,34)">
      <Shape d={rect(-26, -80, 52, 150, 16)} fill={C.ice} opacity={0.95} line={4} />
      <Shape d={rect(-16, -100, 32, 26, 6)} fill={C.teal} line={3.5} />
      <Line d="M-12,-50L-12,30" size={4} color={C.white} />
    </g>
  ),
  shoes: () => (
    <g transform="translate(0,46)">
      <Line d="M0,0L-34,70M0,0L34,70" size={3.5} color={C.hotpink} />
      {[-34, 34].map((x, i) => (
        <g key={i} transform={`translate(${x},70) scale(${i ? -0.9 : 0.9})`}>
          <Shape d="M-44,10C-44,-20 -16,-40 10,-30L48,0L48,12L-44,12Z" fill={C.white} line={4} />
          <Shape d={rect(-46, 10, 96, 12, 4)} fill={C.candy} line={3} />
        </g>
      ))}
    </g>
  ),
  bag: () => (
    <g transform="translate(0,44)">
      <Shape d="M-16,0C-16,-20 16,-20 16,0" fill="none" line={5} />
      <Shape d={rect(-80, 0, 160, 96, 30)} fill={C.teal} shade={rect(20, 0, 60, 96)} shadeInk="ht-ink-2" line={5} />
      <Line d="M-50,20L-50,76M50,20L50,76" size={3.5} color={C.aqua} />
    </g>
  ),
  glow: () => (
    <g transform="translate(0,40)">
      <Flat d={ellipse(0, 0, 110, 110)} fill="url(#glow-amber)" opacity={0.85} />
      <Shape d={heart(0, 4, 30)} fill={C.amber} line={4} />
    </g>
  ),
  phone: () => (
    <g transform="translate(0,10) rotate(-8)">
      <Shape d={rect(-30, -60, 60, 112, 14)} fill={C.ink} line={4} />
      <Flat d={rect(-22, -48, 44, 84)} fill={C.aqua} />
      <Shape d={heart(0, -8, 14)} fill={C.hotpink} line={2.5} />
    </g>
  ),
  money: () => (
    <g transform="translate(0,40)">
      {[0, 1, 2, 3].map((k) => (
        <g key={k} transform={`rotate(${-24 + k * 16})`}>
          <Shape d={rect(-26, -96, 52, 100, 6)} fill="#9CCB9A" line={3.5} />
          <Shape d={ellipse(0, -46, 12, 18)} fill="none" line={3} lineColor={C.teal} />
        </g>
      ))}
    </g>
  ),
  program: () => (
    <g transform="translate(0,50)">
      <Shape d={rect(-80, -10, 160, 210, 10)} fill={C.goldLo} line={5} />
      <Shape d={rect(-66, 6, 132, 180, 4)} fill={C.white} line={3} />
      <Shape d={rect(-26, -18, 52, 22, 6)} fill={C.ash} line={3} />
      <Txt x={0} y={42} size={22} font={FONT.tag} weight={700} color={C.ink}>
        PROGRAM
      </Txt>
      {[0, 1, 2].map((k) => (
        <g key={k}>
          <Shape d={rect(-52, 64 + k * 40, 22, 22, 3)} fill="none" line={3} />
          <Line d={`M-50,${74 + k * 40}L-42,${84 + k * 40}L-28,${62 + k * 40}`} size={4} color={C.hotpink} />
          <Line d={`M-18,${76 + k * 40}L50,${76 + k * 40}`} size={3} opacity={0.6} />
        </g>
      ))}
    </g>
  ),
  plate: () => (
    <g transform="translate(0,30)">
      <Shape d={ellipse(0, 0, 90, 24)} fill={C.white} line={4} />
      <Shape d="M-56,-4C-50,-46 50,-46 56,-4Z" fill={C.amber} shade="M0,-50L60,-50L60,0L0,0Z" shadeInk="ht-gold-1" line={4} />
      <Line d="M-20,-50C-26,-70 -14,-80 -20,-100M14,-50C8,-70 20,-80 14,-100" size={4} opacity={0.5} />
    </g>
  ),
  rose: () => (
    <g transform="translate(0,20)">
      <Line d="M0,0L0,-140" size={6} color={C.teal} />
      <Shape d="M0,-60C-30,-70 -40,-50 -10,-50Z" fill={C.aqua} line={3} />
      <Shape d="M-30,-150C-34,-190 34,-190 30,-150C26,-126 -26,-126 -30,-150Z" fill={C.pressure} line={4} />
      <Line d="M-14,-160C-4,-176 10,-170 8,-154" size={3.5} />
    </g>
  ),
  boxes: () => null, // drawn in world space by the `boxes` feature
};

export type ActorState = {
  kind: ActorKind;
  x: number;
  y: number;
  scale: number;
  narrow: number;
  pose: Pose;
  place: Place;
  head: [number, number];
  hand: [number, number];
  lift: number; // how far the feet are off the floor, in px
  faceTurn: number;
  look?: [number, number];
  spec: ActorRecipe;
  faceName?: string;
  seed: number;
  sings: boolean;
};

export type Subject = {
  x: number;
  y: number;
  scale: number;
  pose: Pose;
  place: Place;
  head: [number, number];
  handR: [number, number];
  kid?: {x: number; y: number; scale: number; pose: Pose; place: Place; hand: [number, number]};
  actors: ActorState[];
};

const PARTS = {stein: STEIN_PARTS, precious: PRECIOUS_PARTS} as const;
const FEET = {stein: 402, precious: 408}; // pelvis to sole, rig units

// Normalise a recipe into the people in it.
const specsOf = (r: Recipe): {kind: ActorKind; spec: ActorRecipe; sings: boolean}[] => {
  const top: ActorRecipe = {x: r.x, scale: r.scale, flip: r.flip, pose: r.pose, face: r.face, action: r.action, dance: r.dance, arms: r.arms, travel: r.travel, hold: r.hold, style: r.style, facing: r.facing};
  const kid: ActorRecipe = {x: r.kidX, scale: r.kidScale, pose: r.kidPose, face: r.kidFace, travel: r.kidTravel, hold: r.kidHold, action: r.kidTravel ? r.action : undefined};
  switch (r.who ?? 'stein') {
    case 'none':
      return [];
    case 'kid':
      return [{kind: 'kid', spec: {...kid, x: kid.x ?? r.x}, sings: false}];
    case 'precious':
      return [{kind: 'precious', spec: top, sings: false}];
    case 'both':
      return [
        {kind: 'stein', spec: {...top, x: top.x ?? 360}, sings: true},
        {kind: 'kid', spec: {...kid, x: kid.x ?? 740}, sings: false},
      ];
    case 'pair':
      return [
        {kind: 'stein', spec: {...top, x: top.x ?? 360}, sings: true},
        {kind: 'precious', spec: {action: r.action, dance: r.dance, arms: r.arms, ...r.her, x: r.her?.x ?? 720}, sings: false},
      ];
    default:
      return [{kind: 'stein', spec: top, sings: true}];
  }
};

const WALKS = new Set<Action>(['walk', 'run', 'strut']);
const dropFor = (pose: string | undefined, kind: 'stein' | 'precious') => (pose === 'sit' ? 281 : pose === 'kneel' || pose === 'pray' ? 410 : FEET[kind]);

const solveRig = (kind: 'stein' | 'precious', spec: ActorRecipe, r: Recipe, p: SceneProps, seed: number, partnerX: number | undefined): Omit<ActorState, 'spec' | 'seed' | 'sings' | 'faceName'> => {
  const scale = spec.scale ?? 0.8;
  const action = spec.action ?? 'idle';
  const dur = Math.max(1, p.dur - 4);
  const t = clamp(p.f / dur);
  let x = spec.x ?? 540;
  let narrow = 1;
  let flip = spec.flip;
  let faceTurn = 0;
  let profile = false;
  let motion: Motion = {pose: {}, dy: 0, dx: 0};
  const base = POSES[spec.pose ?? 'stand'] ?? POSES.stand;
  const holdArm: Pose = spec.hold ? {uarmR: base.uarmR ?? POSES.hold.uarmR, farmR: base.farmR ?? POSES.hold.farmR} : {};

  if (WALKS.has(action) && (spec.travel || r.bg === 'street')) {
    // Seen from three-quarters, walking the way they face; steps match the ground they cover.
    const dir = spec.travel ? Math.sign(spec.travel[1] - spec.travel[0]) || 1 : 1;
    narrow = 0.82;
    flip = dir < 0;
    faceTurn = 0.6;
    profile = true;
    const kindG = action === 'run' ? 'run' : 'walk';
    const stride = STRIDE[kindG] * scale * narrow;
    let period = action === 'run' ? 18 : 34;
    let amp = 1;
    if (spec.travel) {
      const speed = Math.abs(spec.travel[1] - spec.travel[0]) / dur;
      period = clamp(stride / Math.max(0.1, speed), action === 'run' ? 14 : 26, action === 'run' ? 26 : 60);
      amp = clamp((speed * period) / stride, 0.45, 1.15);
      x = lerp(spec.travel[0], spec.travel[1], t);
    }
    const phase = p.f / period + seed * 0.37;
    motion = action === 'run' ? run(phase, amp) : action === 'strut' ? strut(phase, amp) : walk(phase, amp);
    motion = add(motion, scaleMotion(idle(p.f, seed), 0.3));
  } else if (WALKS.has(action) || action === 'approach') {
    // No room to travel: walk toward us, growing a little as they come.
    const period = action === 'run' ? 20 : 32;
    motion = add(approach(p.f / period + seed * 0.37, action === 'run' ? 0.7 : 0.45), scaleMotion(idle(p.f, seed), 0.3));
    if (action === 'strut') motion.pose.pelvis = (motion.pose.pelvis ?? 0) * 2.2;
  } else if (action === 'dance') {
    const d = dance(spec.dance ?? 'bounce', p.beatPhase, p.beatN, spec.arms ?? (kind === 'precious' ? 'up' : 'pump'));
    const lead = clamp(p.f / 6);
    motion = add(scaleMotion(d, lead), scaleMotion(idle(p.f, seed), 0.4));
  } else {
    motion = idle(p.f, seed);
    if (action === 'sway') motion = add(motion, {pose: {torso: 3 * Math.sin(p.f / 12), head: -4 * Math.sin(p.f / 12), pelvis: 1.5 * Math.sin(p.f / 12)}, dy: 0, dx: 0});
    if (action === 'nod') motion = add(motion, {pose: {head: 6 * Math.sin(p.f / 5)}, dy: 0, dx: 0});
  }

  if (!profile && spec.facing) {
    narrow = spec.facing === 'front' ? 1 : 0.84;
    flip = spec.facing === 'left';
    faceTurn = spec.facing === 'front' ? 0 : 0.55;
  } else if (!profile && partnerX !== undefined && action !== 'dance') {
    // Facing a partner when standing together.
    const toward = partnerX > x ? 1 : -1;
    narrow = 0.94;
    faceTurn = 0.35;
    flip = toward < 0;
  }

  // Held gestures keep moving: a beckoning finger curls, a wave waves, a point jabs on the beat.
  const g = (spec.pose ?? 'stand') as string;
  if (!WALKS.has(action) && action !== 'dance') {
    const w = Math.sin(p.f / 4);
    const gest: Pose =
      g === 'beckon' ? {farmR: 22 * Math.max(0, w), uarmR: 4 * w}
      : g === 'wave' ? {uarmR: 10 * w, farmR: 24 * w}
      : g === 'point' ? {uarmR: -6 * p.beat, farmR: -4 * p.beat, torso: 2 * p.beat}
      : g === 'phone' ? {head: 4 * Math.sin(p.f / 13), torso: 1.5 * Math.sin(p.f / 13)}
      : g === 'flex' ? {uarmL: 6 * p.beat, uarmR: -6 * p.beat}
      : g === 'offer' ? {farmR: -6 * Math.sin(p.f / 9)}
      : {};
    motion = add(motion, {pose: gest, dy: 0, dx: 0});
  }
  const moving = WALKS.has(action) || action === 'approach';
  const dancing = action === 'dance';
  const target: Pose = moving ? {...holdArm} : base;
  const from: Pose = {...POSES.stand, head: 4};
  const settled = moving || dancing ? target : settle(p.f, target, from, 10);
  const pose: Pose = {...motion.pose};
  Object.entries(settled).forEach(([k, v]) => (pose[k] = (pose[k] ?? 0) + v));
  if (spec.hold && (moving || dancing)) {
    pose.uarmR = (holdArm.uarmR ?? -50) + (motion.pose.uarmR ?? 0) * 0.2;
    pose.farmR = (holdArm.farmR ?? -70) + (motion.pose.farmR ?? 0) * 0.2;
  }
  if (dancing && spec.pose && spec.pose !== 'stand') {
    // a named pose wins over the dance's arms
    ['uarmL', 'farmL', 'uarmR', 'farmR'].forEach((k) => (pose[k] = (base[k] ?? 0) + (pose[k] ?? 0) * 0.15));
  }

  const approachGrow = !profile && moving ? 1 + 0.08 * t : 1;
  const s = scale * approachGrow;
  const drop = dropFor(spec.pose, kind) * s;
  const y = FLOOR - drop + motion.dy * s;
  const place: Place = {x: x + motion.dx * s, y, scale: s, flip, narrow};
  const parts = PARTS[kind] as unknown as Part<unknown>[];
  return {
    kind,
    x: place.x,
    y,
    scale: s,
    narrow,
    pose,
    place,
    head: worldPoint(parts, pose, place, 'head', [0, -150]),
    hand: worldPoint(parts, pose, place, 'handR', [0, 40]),
    lift: Math.max(0, -motion.dy * s),
    faceTurn,
    look: profile ? [0.5, 0] : undefined,
  };
};

const solveKid = (spec: ActorRecipe, r: Recipe, p: SceneProps, both: boolean): Omit<ActorState, 'spec' | 'seed' | 'sings' | 'faceName'> => {
  const ks = spec.scale ?? 0.78;
  const t = clamp(p.f / Math.max(1, p.dur - 4));
  const kx = spec.travel ? lerp(spec.travel[0], spec.travel[1], t) : spec.x ?? (both ? 740 : 540);
  const moving = !!spec.travel && (r.action === 'walk' || r.action === 'run');
  const stepT = r.action === 'run' ? 14 : 22;
  const kpose: Pose = {...(KID_POSES[spec.pose ?? 'stand'] ?? {})};
  const extra = moving ? kidWalk(p.f, stepT) : spec.pose === 'wave' ? {armR: 18 * Math.sin(p.f / 4)} : {body: 1.5 * Math.sin(p.f / 24), head: 2 * Math.sin(p.f / 31)};
  Object.entries(extra).forEach(([k, v]) => (kpose[k] = (kpose[k] ?? 0) + v));
  const lift = moving ? Math.abs(Math.sin((p.f / stepT) * Math.PI)) * 5 : 0;
  const place: Place = {x: kx, y: FLOOR - lift, scale: ks};
  return {
    kind: 'kid',
    x: kx,
    y: place.y,
    scale: ks,
    narrow: 1,
    pose: kpose,
    place,
    head: worldPoint(KID_PARTS, kpose, place, 'head', [0, -62]),
    hand: worldPoint(KID_PARTS, kpose, place, 'armR', [0, 96]),
    lift,
    faceTurn: 0,
  };
};

export const placeSubjects = (r: Recipe, p: SceneProps): Subject => {
  const specs = specsOf(r);
  const xs = specs.map((sp) => sp.spec.x);
  const actors: ActorState[] = specs.map((sp, i) => {
    const partnerX = specs.length === 2 ? xs[1 - i] : undefined;
    const solved = sp.kind === 'kid' ? solveKid(sp.spec, r, p, specs.length === 2) : solveRig(sp.kind, sp.spec, r, p, i + 1, partnerX);
    return {...solved, spec: sp.spec, seed: i + 1, sings: sp.sings, faceName: sp.spec.face};
  });
  const lead = actors[0];
  const other = actors[1];
  if (!lead) {
    const place: Place = {x: 540, y: FLOOR - 320, scale: 0.8};
    return {x: 540, y: place.y, scale: 0.8, pose: {}, place, head: [540, 700], handR: [600, 1000], actors};
  }
  return {
    x: lead.x,
    y: lead.y,
    scale: lead.scale,
    pose: lead.pose,
    place: lead.place,
    head: lead.head,
    handR: lead.hand,
    kid: other ? {x: other.x, y: other.y, scale: other.scale, pose: other.pose, place: other.place, hand: other.hand} : undefined,
    actors,
  };
};

const faceFor = (a: ActorState, p: SceneProps, partner?: ActorState): Face => {
  const base = FACES[a.faceName ?? 'calm'] ?? FACES.calm;
  const aim: [number, number] = partner ? [partner.x > a.x !== !!a.place.flip ? 0.6 : -0.6, 0.1] : a.look ?? [0, 0];
  const look = base.look ?? glance(p.abs, a.seed, aim);
  const sing = a.sings ? p.mouth * 0.7 : 0;
  return {
    ...base,
    look,
    turn: a.faceTurn || base.turn,
    mouth: Math.max(base.mouth ?? 0, sing),
    blink: base.eyes ? 0 : blink(p.abs, 87 + a.seed * 13, a.seed * 29),
  };
};

// Soft shadows where the feet meet the floor; they shrink as the body leaves the ground.
export const ContactShadows: React.FC<{s: Subject}> = ({s}) => (
  <>
    {s.actors.map((a, i) => {
      const k = 1 - clamp(a.lift / 160);
      const w = (a.kind === 'kid' ? 70 : 120) * a.scale * (a.narrow < 1 ? 1.25 : 1);
      return <Flat key={i} d={ellipse(a.x, FLOOR + 6, w * (0.6 + 0.4 * k), 16 * a.scale + 4)} fill={C.ink} opacity={0.2 * k} />;
    })}
  </>
);

const holdFor = (a: ActorState) => {
  const name = a.spec.hold;
  if (!name || !HOLDS[name]) return undefined;
  const parts = (a.kind === 'kid' ? KID_PARTS : PARTS[a.kind]) as unknown as Part<unknown>[];
  const ang = chainAngle(parts, a.pose, a.kind === 'kid' ? 'armR' : 'handR');
  return <g transform={`rotate(${-ang})`}>{HOLDS[name](a.kind)}</g>;
};

export const Subjects: React.FC<{p: SceneProps; s: Subject}> = ({p, s}) => (
  <>
    {s.actors.map((a, i) => {
      const partner = s.actors[1 - i];
      const face = faceFor(a, p, s.actors.length === 2 ? partner : undefined);
      const style = {...(a.spec.style ?? {}), ...(a.narrow < 0.9 ? {profile: true} : {})};
      if (a.kind === 'kid') return <Kid key={i} place={a.place} pose={a.pose} face={face} holdR={holdFor(a)} />;
      if (a.kind === 'precious') return <Precious key={i} place={a.place} pose={a.pose} face={face} style={style} holdR={holdFor(a)} />;
      return <Stein key={i} place={a.place} pose={a.pose} face={face} style={{chain: false, ...style}} holdR={holdFor(a)} />;
    })}
  </>
);
