// No. 2, second chorus (lines 28-40): the claw machine, the boomerang, the call, cool and cooler,
// the gifts, the jack-in-the-box, spring arriving early, and a high five that turns day into night.
import React from 'react';
import {C, FONT} from '../../../brand/tokens';
import {Pip, waddle} from '../../../characters/Pip';
import {Precious, PRECIOUS_PARTS, PRECIOUS_POSES} from '../../../characters/Precious';
import {Stein, STEIN_PARTS, STEIN_POSES} from '../../../characters/Stein';
import {clamp, colorKeys, ease, keys, lerp, prog, swing} from '../../../lib/ease';
import {Flat, Line, Shape, Txt} from '../../../lib/print';
import {rng} from '../../../lib/random';
import {mixPose, Part, Pose, reach, worldPoint} from '../../../lib/rig';
import {SceneDef} from '../../../lib/scene';
import {Bubble, circle, Clip, Confetti, ellipse, FloatHearts, Hand, heart, Moon, Note, Pop, rect, smooth, Sparkle, star4, Stars, Wash} from '../../../props/common';
import {Drift, House, Snow, Streetlight} from '../../../props/winter';

const W = {winter: true} as const;
const blink = (f: number, every = 97, off = 0) => ((f + off) % every < 4 ? 1 : 0);

// Where a rig's head centre lands, so a figure can be framed by its face.
const headAt = <P,>(parts: Part<P>[], pose: Pose, scale: number) => worldPoint(parts, pose, {x: 0, y: 0, scale}, 'head', [0, -150]);

// A wrapped present. x = centre, y = bottom; lid 0..1 flips the lid off.
const Gift: React.FC<{x: number; y: number; w: number; h: number; body: string; ribbon: string; foil?: boolean; lid?: number; rot?: number}> = ({
  x,
  y,
  w,
  h,
  body,
  ribbon,
  foil,
  lid = 0,
  rot = 0,
}) => {
  const lh = Math.max(34, h * 0.16);
  const top = -h + lh * 0.6;
  return (
    <g transform={`translate(${x},${y}) rotate(${rot})`}>
      <Shape d={rect(-w / 2, top, w, h - lh * 0.6, 6)} fill={body} pattern={foil ? 'foil' : undefined} shade={rect(w * 0.2, -h, w * 0.3, h)} shadeInk="ht-ink-1" line={6} />
      <Shape d={rect(-w * 0.07, top, w * 0.14, h - lh * 0.6)} fill={ribbon} line={4} />
      {lid < 1 && (
        <g transform={`translate(${lid * w * 0.7},${-lid * h * 1.1}) rotate(${lid * 50})`}>
          <Shape d={rect(-w / 2 - 14, -h - lh * 0.4, w + 28, lh, 6)} fill={body} pattern={foil ? 'foil' : undefined} line={6} />
          <Shape d={rect(-w * 0.07, -h - lh * 0.4, w * 0.14, lh)} fill={ribbon} line={4} />
          <Shape d={`M0,${-h - lh * 0.4}C${-w * 0.34},${-h - lh * 2} ${-w * 0.4},${-h - lh * 0.1} 0,${-h - lh * 0.4}Z`} fill={ribbon} line={4} />
          <Shape d={`M0,${-h - lh * 0.4}C${w * 0.34},${-h - lh * 2} ${w * 0.4},${-h - lh * 0.1} 0,${-h - lh * 0.4}Z`} fill={ribbon} line={4} />
        </g>
      )}
    </g>
  );
};

// An arm reaching in from outside the frame, finger pointing at (x, y).
const ReachIn: React.FC<{x: number; y: number; from: [number, number]; skin: string; sleeve: string}> = ({x, y, from, skin, sleeve}) => {
  const ang = (Math.atan2(y - from[1], x - from[0]) * 180) / Math.PI;
  const len = Math.hypot(x - from[0], y - from[1]);
  const palm = len - 190;
  return (
    <g transform={`translate(${from[0]},${from[1]}) rotate(${ang - 90})`}>
      <Shape d={rect(-46, -60, 92, palm - 10, 30)} fill={sleeve} line={6} />
      <Shape d={rect(-52, palm - 92, 104, 44, 14)} fill={C.white} line={5} />
      <g transform={`translate(0,${palm}) rotate(90)`}>
        <Hand skin={skin} point />
      </g>
    </g>
  );
};

// A coil spring from (x, y0) up to (x, y1).
const Coil: React.FC<{x: number; y0: number; y1: number; n?: number; w?: number}> = ({x, y0, y1, n = 9, w = 52}) => {
  const pts = Array.from({length: n + 1}, (_, i) => `${i ? 'L' : 'M'}${x + (i === 0 || i === n ? 0 : i % 2 ? -w : w)},${lerp(y0, y1, i / n)}`);
  return <Line d={pts.join('')} size={8} color={C.ash} />;
};

// A little flower that pops up out of the ground.
const Flower: React.FC<{x: number; y: number; t: number; c: string; s?: number}> = ({x, y, t, c, s = 1}) => {
  if (t <= 0) return null;
  const k = ease.outBack(clamp(t));
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <Line d={`M0,0L0,${-70 * k}`} size={6} color={C.teal} />
      <Shape d={`M0,${-30 * k}C${-30 * k},${-40 * k} ${-40 * k},${-20 * k} ${-6 * k},${-16 * k}Z`} fill={C.aqua} line={3} />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return <Shape key={i} d={ellipse(Math.cos(a) * 22 * k, -84 * k + Math.sin(a) * 22 * k, 18 * k, 13 * k)} fill={c} line={3.5} />;
      })}
      <Shape d={circle(0, -84 * k, 11 * k)} fill={C.gold} line={3} />
    </g>
  );
};

const FLOWERS = (() => {
  const r = rng(370);
  return Array.from({length: 18}, (_, i) => ({
    x: 60 + r() * 960,
    y: 1180 + r() * 260,
    c: [C.candy, C.hotpink, C.goldHi, C.white, C.aqua][i % 5],
    s: 0.8 + r() * 0.5,
  }));
})();

// ---------------------------------------------------------------- No. 28 - the claw machine
export const S28: SceneDef = {
  ground: 'blush',
  under: () => <Wash kind="pink" x={540} y={800} s={1500} o={0.35} />,
  render: (p) => {
    const {f} = p;
    const drop = p.w(4);
    const grab = p.w(5);
    const ok = p.w(7);
    const cx = keys(f, [[4, 330], [20, 600], [grab + 9, 600], [ok - 1, 330]]);
    const cy = keys(f, [[drop, 500], [grab, 820], [grab + 2, 820], [grab + 9, 500]]);
    const shut = f < grab ? 0 : f < ok ? clamp((f - grab) / 3) : 1 - clamp((f - ok) / 3);
    const held = f >= grab + 2 && f < ok;
    const fallT = f - ok;
    const prize: [number, number] = held ? [cx, cy + 92] : fallT >= 0 ? [330, Math.min(960, cy + 92 + fallT * fallT * 30)] : [600, 902];
    const out = fallT >= 3;
    const vx = keys(f, [[4, 0], [8, 1], [18, 1], [22, 0], [grab + 9, 0], [grab + 11, -1], [ok - 3, -1], [ok, 0]], ease.linear);
    const knob: [number, number] = [790 + vx * 26, 1030];
    const place = {x: 950, y: 1230, scale: 0.64};
    const base: Pose = {uarmR: 12, farmR: -6, head: -6};
    const pose: Pose = {...base, ...reach(STEIN_PARTS, base, place, 'uarmL', 'farmL', 'handL', knob, -1, [0, 20])};
    const r = rng(28);
    const pile = Array.from({length: 11}, (_, i) => ({x: 390 + i * 38 + r() * 10, y: 930 + (i % 2) * 34 + r() * 20, s: 46 + r() * 16, c: [C.aqua, C.candy, C.goldHi, C.teal, C.white][i % 5]}));
    const claw = (
      <>
        <Line d={`M${cx},400L${cx},${cy - 30}`} size={5} color={C.ash} />
        <Shape d={rect(cx - 34, cy - 40, 68, 44, 10)} fill={C.smoke} shade={rect(cx + 6, cy - 40, 30, 44)} shadeInk="ht-ink-2" line={5} />
        {[-1, 0, 1].map((k) => {
          const a = (k * (34 - 26 * shut) * Math.PI) / 180;
          const tx = cx + Math.sin(a) * 86 + k * 8;
          const ty = cy + Math.cos(a) * 86;
          return <Line key={k} d={`M${cx + k * 20},${cy}L${tx},${ty}L${tx - k * 20 - (k === 0 ? 14 : 0)},${ty + 18}`} size={7} color={C.ash} />;
        })}
      </>
    );
    return (
      <>
        {/* cabinet */}
        <Shape d={rect(120, 280, 750, 1200, 34)} fill={C.hotpink} shade={rect(700, 280, 170, 1200)} shadeInk="ht-ink-2" line={8} />
        <Shape d={rect(150, 210, 690, 120, 26)} fill={C.goldHi} line={7} />
        <Txt x={495} y={296} size={74} font={FONT.stamp} color={C.hotpink} spacing={4}>
          LOVE CLAW
        </Txt>
        {Array.from({length: 12}, (_, i) => (
          <Flat key={i} d={circle(180 + i * 57, 222, 7)} fill={(i + Math.floor(f / 4)) % 2 ? C.white : C.gold} />
        ))}
        {/* the glass */}
        <Shape d={rect(190, 380, 610, 640, 14)} fill="#3A2E4A" line={7} />
        <Clip d={rect(190, 380, 610, 640, 14)}>
          <Line d="M190,400L800,400" size={9} color={C.ash} />
          <Shape d={rect(206, 840, 160, 170, 6)} fill="none" line={5} lineColor={C.white} />
          <Flat d={rect(206, 840, 160, 170)} fill={C.white} opacity={0.15} />
          {pile.map((b, i) => (
            <Shape key={i} d={circle(b.x, b.y, b.s)} fill={b.c} shade={circle(b.x + 20, b.y + 16, b.s)} shadeInk="ht-ink-1" line={4} />
          ))}
          <Pip place={{x: 700, y: 960, scale: 0.3}} face={{eyes: 'happy'}} />
          {!out && <Shape d={heart(prize[0], prize[1], 64)} fill={C.hotpink} shade={heart(prize[0] + 16, prize[1] + 10, 60)} shadeInk="ht-ink-1" line={6} />}
          {claw}
          <Flat d="M230,380L330,380L200,640L190,560Z" fill={C.white} opacity={0.14} />
        </Clip>
        {/* controls and the prize door */}
        <Shape d={rect(160, 1030, 670, 140, 18)} fill={C.candy} line={6} />
        <Shape d={circle(650, 1090, 36)} fill={C.pressure} line={5} />
        <Shape d={rect(250, 1210, 180, 130, 12)} fill="#2C2238" line={6} />
        <Shape d={rect(250, 1210, 180, 34, 10)} fill={C.smoke} line={5} />
        <Line d={`M790,1100L${knob[0]},${knob[1]}`} size={9} color={C.ash} />
        <Shape d={ellipse(790, 1104, 44, 16)} fill={C.ink} line={4} />
        <Shape d={circle(knob[0], knob[1], 26)} fill={C.pressure} line={5} />
        <Stein place={place} pose={pose} style={W} face={{turn: -0.5, look: [-0.8, -0.8], eyes: f >= grab && f < grab + 8 ? 'wide' : 'dot', smile: f >= grab + 8 ? 0.9 : 0.3, mouth: p.mouth * 0.5, blink: blink(f, 50)}} />
        {out && (
          <Pop f={f} at={ok + 3} x={340} y={1250}>
            <Shape d={heart(340, 1240, 70)} fill={C.hotpink} shade={heart(356, 1250, 66)} shadeInk="ht-ink-1" line={6} />
            <Sparkle x={420} y={1170} r={36} />
          </Pop>
        )}
        {f >= grab && f < grab + 10 && <Sparkle x={cx + 70} y={cy + 40} r={40 * (1 - (f - grab) / 10)} />}
        {out && (
          <Pop f={f} at={ok + 2} x={600} y={1300}>
            <Note x={600} y={1300} size={72} rot={-6} color={C.white}>
              okay.
            </Note>
          </Pop>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 29 - the heart boomerang
export const S29: SceneDef = {
  ground: 'frost',
  under: () => <Wash kind="pink" x={760} y={700} s={1200} o={0.3} />,
  render: (p) => {
    const {f} = p;
    const throwAt = 8;
    const catchAt = 40;
    const t = clamp((f - throwAt) / (catchAt - throwAt));
    const place = {x: 250, y: 1030, scale: 0.7};
    const windup: Pose = {uarmR: 40, farmR: -80, uarmL: 20, farmL: -20, head: 4};
    const thrown: Pose = {uarmR: -130, farmR: -10, uarmL: 20, farmL: -20, head: -4};
    const catchP: Pose = {uarmR: -76, farmR: -50, uarmL: 16, farmL: -10, head: -2};
    const pose = f < throwAt ? mixPose(STEIN_POSES.stand, windup, ease.inOutCubic(clamp(f / throwAt))) : mixPose(thrown, catchP, clamp((f - throwAt - 8) / 12));
    const hand = worldPoint(STEIN_PARTS, catchP, place, 'handR', [0, 40]);
    const RX = 360;
    const RY = 250;
    const at = (a: number): [number, number] => [hand[0] + RX + RX * Math.cos(a), hand[1] + RY * Math.sin(a)];
    const a = Math.PI + ease.inOutSine(t) * Math.PI * 2;
    const [bx, by] = f < throwAt ? worldPoint(STEIN_PARTS, pose, place, 'handR', [0, 40]) : at(a);
    const trail = Array.from({length: 24}, (_, i) => at(Math.PI + (a - Math.PI) * (i / 23)));
    const caught = f >= catchAt;
    const duck = f > throwAt && Math.abs(bx - 690) < 110 && by > 1000 ? 0.82 : 1;
    const look = Math.max(-20, Math.min(20, (Math.atan2(by - 1150, bx - 690) * 180) / Math.PI / 4));
    return (
      <>
        <Shape d="M-60,1180C200,1080 420,1120 620,1150C820,1100 980,1090 1160,1150L1160,1400L-60,1400Z" fill={C.white} shade="M-60,1240L1160,1240L1160,1400L-60,1400Z" shadeInk="ht-ice-1" line={5} shadow={false} />
        {[120, 470, 900, 1010].map((x, i) => (
          <Shape key={i} d={`M${x},${1070 - (i % 2) * 30}L${x + 60},${1180}L${x - 60},${1180}Z`} fill={i % 2 ? C.teal : C.slate} line={5} />
        ))}
        <Drift y={1300} seed={29} />
        {f >= throwAt && !caught && <Shape d={smooth(trail, false)} fill="none" dotted line={8} lineColor={C.hotpink} />}
        <Stein place={place} pose={pose} style={W} face={{eyes: caught ? 'happy' : 'dot', smile: caught ? 1 : 0.6, look: [clamp((bx - 300) / 400, -1, 1), clamp((by - 700) / 400, -1, 1)], mouth: p.mouth * 0.5}} />
        <Pip place={{x: 690, y: 1250, scale: 0.6, squash: duck}} pose={{head: look, flipperL: duck < 1 ? 60 : 10, flipperR: duck < 1 ? -60 : -10}} face={{eyes: duck < 1 ? 'closed' : 'wide'}} />
        <g transform={`translate(${bx},${by}) rotate(${caught ? 0 : f * 38})`}>
          <Shape d={heart(0, 0, 56)} fill={C.hotpink} shade={heart(14, 10, 52)} shadeInk="ht-ink-1" line={6} />
          <Line d="M-26,-14C-14,-26 6,-24 14,-12" size={5} color={C.white} opacity={0.8} />
        </g>
        {caught && <FloatHearts f={f - catchAt} x={hand[0] + 20} y={hand[1] - 60} n={4} seed={29} spread={160} color={C.hotpink} />}
        {caught && (
          <Pop f={f} at={catchAt} x={720} y={560}>
            <Note x={720} y={560} size={70} rot={6}>
              comes right back
            </Note>
          </Pop>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 30 - the video call
export const S30: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="aqua" x={540} y={900} s={1500} o={0.35} />,
  render: (p) => {
    const {f} = p;
    const see = p.w(2);
    const now = p.w(4);
    const lean = 1 + 0.06 * prog(f, now - 4, 10, ease.outBack);
    const inT = ease.outBack(clamp(f / 10));
    const top = rect(60, 250, 960, 580, 28);
    const bot = rect(60, 870, 960, 580, 28);
    const wave = Math.sin(f / 3);
    const sPose: Pose = {uarmR: -118 + 10 * wave, farmR: -48 + 30 * wave, uarmL: 10, farmL: -8};
    const sScale = 0.8 * lean;
    const sHead = headAt(STEIN_PARTS, sPose, sScale);
    const pPose: Pose = {uarmR: -118 - 10 * wave, farmR: -48 - 30 * wave, uarmL: 14, farmL: -10};
    const pScale = 0.8 * lean;
    const pHead = headAt(PRECIOUS_PARTS, pPose, pScale);
    const clock = `00:${String(7 + Math.floor(f / 30)).padStart(2, '0')}`;
    const ui = (y: number) => (
      <>
        <Shape d={rect(760, y + 24, 220, 60, 30)} fill={C.ink} opacity={0.75} line={false} shadow={false} />
        <Flat d={circle(796, y + 54, 10)} fill={C.pressure} opacity={f % 30 < 18 ? 1 : 0.3} />
        <Txt x={890} y={y + 66} size={32} font={FONT.tag} color={C.white}>
          {clock}
        </Txt>
      </>
    );
    return (
      <g transform={`translate(540,850) scale(${0.92 + 0.08 * inT}) translate(-540,-850)`}>
        {/* him, out in the snow */}
        <Shape d={top} fill={C.frost} line={7} />
        <Clip d={top}>
          <Wash kind="ice" x={540} y={540} s={1100} o={0.5} />
          <Drift y={760} seed={30} />
          <Stein place={{x: 540 - sHead[0], y: 560 - sHead[1], scale: sScale}} pose={sPose} style={W} face={{smile: 1, mouth: p.mouth, look: [0, 0], blink: blink(f, 60)}} />
          <Snow f={f} n={34} seed={30} speed={0.6} y0={240} y1={840} big />
          {f >= see && <FloatHearts f={f - see} x={880} y={760} n={4} seed={31} spread={80} color={C.hotpink} />}
          {ui(250)}
        </Clip>
        {/* her, by the lamp */}
        <Shape d={bot} fill={C.release} line={7} />
        <Clip d={bot}>
          <Flat d={circle(210, 1040, 360)} fill="url(#glow-amber)" opacity={0.9} />
          <Line d="M210,1100L210,1460" size={9} color={C.goldLo} />
          <Shape d="M130,1100L290,1100L250,980L170,980Z" fill={C.candy} shade="M210,980L290,980L290,1100L210,1100Z" shadeInk="ht-pink-2" line={6} />
          <Line d="M60,900C300,960 700,960 1020,900" size={3} opacity={0.5} />
          {[0, 1, 2, 3, 4, 5, 6].map((k) => (
            <Shape key={k} d={heart(120 + k * 140, 934 + Math.sin(k) * 8, 16)} fill={k % 2 ? C.amber : C.hotpink} line={3} />
          ))}
          <Precious place={{x: 560 - pHead[0], y: 1170 - pHead[1], scale: pScale}} pose={pPose} style={{winter: false}} face={{smile: 1, look: [0, 0], blink: blink(f, 70, 30), blush: 0.5}} />
          {f >= see && <FloatHearts f={f - see - 4} x={880} y={1380} n={4} seed={32} spread={80} color={C.hotpink} />}
          {ui(870)}
        </Clip>
        {f >= now && (
          <Pop f={f} at={now} x={540} y={850}>
            <Shape d={rect(380, 818, 320, 64, 32)} fill={C.hotpink} line={5} />
            <Txt x={540} y={862} size={34} font={FONT.tag} color={C.white} spacing={2}>
              RIGHT NOW
            </Txt>
          </Pop>
        )}
      </g>
    );
  },
};

// ---------------------------------------------------------------- No. 31 - cool
export const S31: SceneDef = {
  ground: 'frost',
  under: () => <Wash kind="ice" x={540} y={900} s={1500} o={0.5} />,
  render: (p) => {
    const {f} = p;
    const cool = p.w(4);
    const place = {x: 560, y: 1010, scale: 0.8, rotate: -9};
    const pose: Pose = {uarmL: 64, farmL: -118, uarmR: -8, farmR: 20, thighL: -4, thighR: 24, shinR: -34, head: 8, torso: -2};
    const [hx, hy] = worldPoint(STEIN_PARTS, pose, place, 'head', [0, -170]);
    const cubes = [0, 1, 2, 3].map((i) => {
      const a = f / 14 + (i * Math.PI) / 2;
      return {x: hx + Math.cos(a) * 200, y: hy + Math.sin(a) * 54 - 20, front: Math.sin(a) > 0, rot: f * 3 + i * 40, i};
    });
    const cube = (c: (typeof cubes)[number]) => (
      <g key={c.i} transform={`translate(${c.x},${c.y}) rotate(${c.rot})`}>
        <Shape d={rect(-30, -30, 60, 60, 12)} fill={C.ice} shade={rect(6, -30, 24, 60)} shadeInk="ht-ice-2" line={5} lineColor={C.iceInk} />
        <Line d="M-18,-16L-6,-20" size={4} color={C.white} />
      </g>
    );
    const [ex, ey] = worldPoint(STEIN_PARTS, pose, place, 'head', [33, -150]);
    return (
      <>
        {cubes.filter((c) => !c.front).map(cube)}
        {/* the snowbank he's leaning on */}
        <Shape d="M-60,1330C-40,1060 60,930 200,900C300,880 360,960 380,1060C400,1160 420,1260 460,1330Z" fill={C.white} shade="M200,900L460,900L460,1330L200,1330Z" shadeInk="ht-ice-1" line={6} />
        <Drift y={1320} seed={31} />
        <Stein place={place} pose={pose} style={W} face={{eyes: 'shades', smile: 0.5, mouth: p.mouth * 0.4}} />
        <Pip place={{x: 860, y: 1250, scale: 0.62, rotate: 6}} pose={{flipperL: 50, flipperR: -40, head: -6}} face={{eyes: 'shades'}} />
        {cubes.filter((c) => c.front).map(cube)}
        {f >= cool && f < cool + 10 && <Sparkle x={ex + 30} y={ey - 10} r={46 * Math.sin((Math.PI * (f - cool)) / 10)} />}
        {f >= cool && (
          <Pop f={f} at={cool} x={320} y={560}>
            <Note x={300} y={560} size={96} rot={-8} color={C.iceInk}>
              cool.
            </Note>
          </Pop>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 32 - cooler
export const S32: SceneDef = {
  ground: 'frost',
  render: (p) => {
    const {f} = p;
    const cool = p.w(4);
    const tan = Math.tan((24 * Math.PI) / 180);
    const slopeY = (x: number) => 700 + tan * x;
    const x0 = 520;
    const whee = f >= cool;
    const legs: Pose = {thighL: -82, shinL: 12, thighR: -76, shinR: 8};
    const pose: Pose = whee ? {...legs, uarmL: 150, farmL: 20, uarmR: -150, farmR: -20} : {...legs, uarmL: -30, farmL: -70, uarmR: -40, farmR: -40};
    const bump = Math.sin(f / 2.2) * 3;
    const place = {x: x0 - 10, y: slopeY(x0) - 70 + bump, scale: 0.6, rotate: 24};
    const neck = worldPoint(PRECIOUS_PARTS, pose, place, 'torso', [0, -250]);
    const tail = Array.from({length: 6}, (_, i) => [neck[0] - i * 34 - 6, neck[1] - i * 6 + Math.sin(f / 1.6 - i) * 10 * (i / 5)] as [number, number]);
    const r = rng(32);
    return (
      <>
        {/* trees streaming past, up the hill */}
        {[0, 1, 2, 3].map((i) => {
          const x = ((i * 420 - f * 24) % 1680 + 1680) % 1680 - 250;
          const y = slopeY(x) - 20;
          return (
            <g key={i} transform={`translate(${x},${y})`}>
              <Shape d="M0,-300L90,-40L-90,-40Z" fill={i % 2 ? C.teal : C.slate} line={5} />
              <Shape d="M0,-300L50,-160C20,-150 -20,-150 -50,-160Z" fill={C.white} line={4} />
              <Shape d={rect(-14, -44, 28, 50)} fill={C.goldLo} line={4} />
            </g>
          );
        })}
        <Shape d={`M-100,${slopeY(-100)}L1180,${slopeY(1180)}L1180,1980L-100,1980Z`} fill={C.white} shade={`M-100,${slopeY(-100) + 60}L1180,${slopeY(1180) + 60}L1180,1980L-100,1980Z`} shadeInk="ht-ice-1" line={6} shadow={false} />
        {/* spray and speed */}
        {Array.from({length: 14}, (_, i) => {
          const life = (f * 3 + i * 9) % 40;
          const sx = x0 - 160 - life * 7 + r() * 30;
          return <Flat key={i} d={circle(sx, slopeY(sx) - 20 - life * 2 - r() * 30, 8 + r() * 10)} fill={C.white} opacity={1 - life / 40} />;
        })}
        {[0, 1, 2].map((k) => (
          <Line key={k} d={`M${x0 - 260 - k * 40},${slopeY(x0 - 260 - k * 40) - 110 - k * 40}L${x0 - 420 - k * 40},${slopeY(x0 - 420 - k * 40) - 110 - k * 40}`} size={5} opacity={0.6} />
        ))}
        {/* the sled */}
        <g transform={`translate(${x0},${slopeY(x0) - 8 + bump}) rotate(24)`}>
          <Shape d="M-170,-40L150,-40C200,-40 220,-80 196,-104C184,-116 170,-104 176,-92C184,-76 170,-66 150,-66L-170,-66Z" fill={C.pressure} line={6} />
          <Shape d={rect(-170, -40, 330, 26, 6)} fill={C.goldLo} line={5} />
        </g>
        <Line d={smooth(tail, false)} size={30} color={C.teal} />
        <Precious place={place} pose={pose} style={W} face={{eyes: 'shades', smile: 1, mouth: whee ? 0.7 : 0.3}} />
        {whee && (
          <Pop f={f} at={cool} x={780} y={500}>
            <Note x={780} y={500} size={96} rot={-10} color={C.hotpink}>
              cooler.
            </Note>
          </Pop>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 33 - choose
const GIFTS = [
  {x: 230, w: 210, h: 190, body: C.hotpink, ribbon: C.teal},
  {x: 520, w: 250, h: 250, body: C.teal, ribbon: C.candy},
  {x: 850, w: 320, h: 360, body: C.gold, ribbon: C.hotpink, foil: true},
];

export const S33: SceneDef = {
  ground: 'frost',
  under: () => <Wash kind="pink" x={540} y={900} s={1400} o={0.35} />,
  render: (p) => {
    const {f} = p;
    const tap = p.w(4);
    const hx = keys(f, [[4, 230], [18, 230], [28, 850], [40, 850], [48, 520], [52, 520], [56, 850], [tap - 2, 520]]);
    const hover = 20 * Math.sin(f / 5);
    const press = f >= tap ? Math.sin(clamp((f - tap) / 8) * Math.PI) : 0;
    const idx = GIFTS.reduce((best, g, i) => (Math.abs(g.x - hx) < Math.abs(GIFTS[best].x - hx) ? i : best), 0);
    const gy = (i: number) => 1300 - GIFTS[i].h - 60;
    return (
      <>
        <Drift y={1290} seed={33} />
        {GIFTS.map((g, i) => (
          <Gift key={i} {...g} y={1310} rot={i === idx && f >= tap ? Math.sin((f - tap) / 1.5) * 4 * (1 - clamp((f - tap) / 16)) : Math.sin(f / 6 + i) * 1.2} />
        ))}
        <ReachIn x={hx} y={gy(idx) - 10 + hover * (1 - press) + press * 50} from={[hx + 260, -120]} skin={C.preciousSkin} sleeve={C.hotpink} />
        {f >= tap && <Sparkle x={GIFTS[idx].x + 40} y={gy(idx) - 40} r={36 * (1 - clamp((f - tap) / 12))} />}
        <Note x={300} y={420} size={64} rot={-6}>
          eeny, meeny...
        </Note>
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 34 - something that could do
type ToolKind = 'whisk' | 'umbrella' | 'spoon' | 'heart';
const Tool: React.FC<{kind: ToolKind}> = ({kind}) => (
  <>
    <Shape d={rect(-10, -200, 20, 200, 8)} fill={C.smoke} shade={rect(0, -200, 10, 200)} shadeInk="ht-ink-2" line={4} />
    {kind === 'whisk' && (
      <>
        <Shape d={ellipse(0, -262, 34, 72)} fill="none" line={5} />
        <Shape d={ellipse(0, -262, 16, 72)} fill="none" line={5} />
      </>
    )}
    {kind === 'umbrella' && (
      <>
        <Shape d="M-96,-210C-96,-310 96,-310 96,-210Q72,-226 48,-210Q24,-226 0,-210Q-24,-226 -48,-210Q-72,-226 -96,-210Z" fill={C.candy} shade="M0,-320L100,-320L100,-200L0,-200Z" shadeInk="ht-pink-2" line={5} />
        <Line d="M0,-300L0,-326" size={5} />
      </>
    )}
    {kind === 'spoon' && <Shape d={ellipse(0, -244, 38, 54)} fill={C.smoke} shade={ellipse(14, -240, 30, 50)} shadeInk="ht-ink-2" line={5} />}
    {kind === 'heart' && <Shape d={heart(0, -250, 58)} fill={C.hotpink} shade={heart(14, -240, 54)} shadeInk="ht-ink-1" line={5} />}
  </>
);

export const S34: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="aqua" x={540} y={900} s={1400} o={0.45} />,
  render: (p) => {
    const {f} = p;
    const lid = clamp((f - 1) / 7);
    const rise = ease.outBack(clamp((f - 3) / 10));
    const y0 = lerp(1260, 960, rise);
    const tools: {kind: ToolKind; at: number; to: number}[] = [
      {kind: 'whisk', at: 9, to: -60},
      {kind: 'umbrella', at: p.w(1), to: -28},
      {kind: 'spoon', at: p.w(2), to: 4},
      {kind: 'heart', at: p.w(3), to: 36},
    ];
    const px = 440;
    return (
      <>
        <g transform={`translate(560,${y0}) scale(1.35) translate(-560,${-y0})`}>
        {tools.map((t, i) => {
          const k = ease.outBack(clamp((f - t.at) / 8));
          return (
            <g key={i} transform={`translate(${px},${y0}) rotate(${lerp(90, t.to, k)})`}>
              <Tool kind={t.kind} />
            </g>
          );
        })}
        <Shape d={rect(px - 48, y0 - 40, 430, 80, 40)} fill={C.hotpink} shade={rect(px - 48, y0 + 6, 430, 34)} shadeInk="ht-ink-1" line={7} />
        <Shape d={heart(px + 190, y0 + 4, 28)} fill={C.white} line={4} />
        <Shape d={circle(px, y0, 16)} fill={C.smoke} line={4} />
        </g>
        <Gift x={560} y={1360} w={320} h={280} body={C.teal} ribbon={C.candy} lid={lid} />
        {tools.map((t, i) =>
          f >= t.at && f < t.at + 8 ? <Sparkle key={i} x={560 + (px - 560 + Math.sin((t.to * Math.PI) / 180) * 290) * 1.35} y={y0 - Math.cos((t.to * Math.PI) / 180) * 290 * 1.35} r={36 * (1 - (f - t.at) / 8)} /> : null
        )}
        <Note x={760} y={400} size={62} rot={6}>
          (does it all)
        </Note>
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 35 - whatever you choose
export const S35: SceneDef = {
  ground: 'frost',
  under: () => <Wash kind="amber" x={640} y={800} s={1400} o={0.35} />,
  render: (p) => {
    const {f} = p;
    const pop = p.w(2);
    const lid = clamp((f - pop) / 8);
    const up = ease.outBack(clamp((f - pop - 1) / 10));
    const shake = f < pop && f > 8 ? Math.sin(f * 1.7) * 3 * clamp((f - 8) / 12) : 0;
    return (
      <>
        <Drift y={1320} seed={35} />
        <Precious
          place={{x: 230, y: 1030, scale: 0.66}}
          pose={f < pop ? {...PRECIOUS_POSES.reach, uarmR: -70} : PRECIOUS_POSES.mouthHand}
          style={W}
          face={{look: [1, 0], turn: 0.4, smile: f < pop ? 0.6 : 1, eyes: f < pop ? 'dot' : 'wide', mouth: f < pop ? 0 : 0.4, blush: f < pop ? 0 : 0.7}}
        />
        {f > pop && <Stein place={{x: 690, y: lerp(1500, 1000, up), scale: 0.66}} pose={STEIN_POSES.armsUp} style={W} face={{eyes: 'happy', smile: 1, mouth: 0.6}} />}
        <Gift x={690} y={1340} w={400} h={340} body={C.gold} ribbon={C.hotpink} foil lid={lid} rot={shake} />
        {f >= pop && <Confetti t={f - pop} x={690} y={1000} n={26} seed={35} spread={0.9} floor={1330} />}
        {f >= pop + 4 && (
          <Pop f={f} at={pop + 4} x={880} y={520}>
            <Note x={880} y={520} size={80} rot={8} color={C.hotpink}>
              ta-da!
            </Note>
          </Pop>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 36 & 37: the jack-in-the-box
const JACK = {x: 640, y: 1380, w: 380, h: 340};
const AXLE: [number, number] = [JACK.x - JACK.w / 2 + 50, JACK.y - 300];

const JackBox: React.FC<{lid?: number; shake?: number}> = ({lid = 0, shake = 0}) => {
  const {x, y, w, h} = JACK;
  return (
    <g transform={`rotate(${shake} ${x} ${y})`}>
      <Shape d={rect(x - w / 2, y - h, w, h, 10)} fill={C.hotpink} shade={rect(x + w * 0.2, y - h, w * 0.3, h)} shadeInk="ht-ink-2" line={7} />
      {[[-60, -250], [70, -150], [-10, -70], [120, -290]].map(([dx, dy], i) => (
        <Shape key={i} d={star4(x + dx, y + dy, 34)} fill={C.goldHi} line={4} />
      ))}
      <g transform={`rotate(${-120 * lid} ${x - w / 2} ${y - h})`}>
        <Shape d={rect(x - w / 2 - 12, y - h - 36, w + 24, 40, 8)} fill={C.candy} line={6} />
      </g>
    </g>
  );
};

export const S36: SceneDef = {
  ground: 'frost',
  under: () => <Wash kind="pink" x={640} y={900} s={1300} o={0.35} />,
  render: (p) => {
    const {f} = p;
    const a = (f / 24) * Math.PI * 2;
    const knob: [number, number] = [AXLE[0] + Math.cos(a) * 46, AXLE[1] + Math.sin(a) * 46];
    const place = {x: 350, y: 1100, scale: 0.74};
    const base: Pose = {uarmL: 14, farmL: -10, torso: 10, head: -4};
    const pose: Pose = {...base, ...reach(STEIN_PARTS, base, place, 'uarmR', 'farmR', 'handR', knob, 1, [0, 20])};
    const ticks = [6, 18, 30, 42];
    const shake = f > 44 ? Math.sin(f * 2.4) * 2.5 : 0;
    return (
      <>
        <Drift y={1320} seed={36} />
        <JackBox shake={shake} />
        <Stein place={place} pose={pose} style={W} face={{look: [1, 0.6], turn: 0.4, smile: 0.5, brow: 0.5, browTilt: -0.4, eyes: f > 44 ? 'wide' : 'dot'}} />
        <Shape d={circle(AXLE[0], AXLE[1], 22)} fill={C.gold} line={5} />
        <Line d={`M${AXLE[0]},${AXLE[1]}L${knob[0]},${knob[1]}`} size={12} color={C.goldLo} />
        <Shape d={rect(knob[0] - 12, knob[1] - 22, 24, 44, 10)} fill={C.white} line={4} />
        {ticks.map((t, i) =>
          f >= t ? (
            <Pop key={i} f={f} at={t} x={800} y={640 - i * 90}>
              <Note x={760 + (i % 2) * 110} y={680 - i * 90} size={48 + i * 10} rot={i % 2 ? 8 : -8} o={1 - clamp((f - t - 20) / 10) * (i < 3 ? 1 : 0)}>
                tick
              </Note>
            </Pop>
          ) : null
        )}
      </>
    );
  },
};

// Snow melting off a mint page from a point outward: children are the snow.
const Melt: React.FC<{cx: number; cy: number; r: number; children: React.ReactNode}> = ({cx, cy, r, children}) =>
  r <= 0 ? <>{children}</> : <Clip d={`M-200,-200L1280,-200L1280,2120L-200,2120Z${circle(cx, cy, r)}`} evenodd>{children}</Clip>;

export const S37: SceneDef = {
  ground: 'mint',
  under: () => <Wash kind="aqua" x={540} y={1100} s={1500} o={0.4} />,
  render: (p) => {
    const {f} = p;
    const pop = p.w(0);
    const spring = p.w(3);
    const t = f - pop;
    const ext = t < 0 ? 0 : 250 * (1 - swing(t, 1, 18, 11));
    const lidY = JACK.y - JACK.h;
    const scale = 0.56;
    const feet = lidY - ext;
    const r = ease.inOutCubic(clamp((f - spring + 8) / 22)) * 1500;
    const melt: [number, number] = [JACK.x, lidY];
    return (
      <>
        <Melt cx={melt[0]} cy={melt[1]} r={r}>
          <Flat d="M-200,-200L1280,-200L1280,2120L-200,2120Z" fill={C.frost} />
          <Wash kind="ice" x={540} y={900} s={1500} o={0.5} />
          <Drift y={1320} seed={36} />
        </Melt>
        {FLOWERS.map((fl, i) => (
          <Flower key={i} x={fl.x} y={fl.y} c={fl.c} s={fl.s} t={(r - Math.hypot(fl.x - melt[0], fl.y - melt[1])) / 90} />
        ))}
        <JackBox lid={t < 0 ? 0 : clamp(t / 4)} />
        {ext > 4 && <Coil x={JACK.x} y0={lidY} y1={feet + 6} />}
        <Stein place={{x: JACK.x, y: feet - 402 * scale, scale}} pose={STEIN_POSES.armsUp} style={W} face={{eyes: 'happy', smile: 1, mouth: Math.max(0.4, p.mouth)}} />
        {t >= 0 && t < 10 && <Sparkle x={JACK.x + 150} y={lidY - 80} r={60 * (1 - t / 10)} />}
        {t >= 0 && (
          <Pop f={f} at={pop} x={300} y={560}>
            <Note x={280} y={560} size={110} rot={-10} color={C.hotpink}>
              pop!
            </Note>
          </Pop>
        )}
        {f >= spring && (
          <Pop f={f} at={spring} x={820} y={420}>
            <Note x={820} y={420} size={80} rot={8} color={C.teal}>
              spring!
            </Note>
          </Pop>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 38 - boing
export const S38: SceneDef = {
  ground: 'mint',
  under: () => <Wash kind="aqua" x={540} y={1100} s={1500} o={0.4} />,
  render: (p) => {
    const {f} = p;
    const yeah = p.w(0);
    const floor = 1330;
    const scale = 0.56;
    const hisExt = 360 + 70 * Math.sin(f / 4.5);
    const herT = f - yeah;
    const herExt = herT < 0 ? 0 : 360 * (1 - swing(herT, 1, 18, 11)) - 70 * Math.sin(f / 4.5) * clamp(herT / 12);
    const box = (x: number, c: string) => (
      <>
        <Shape d={rect(x - 110, floor - 190, 220, 190, 10)} fill={c} shade={rect(x + 30, floor - 190, 80, 190)} shadeInk="ht-ink-2" line={6} />
        <Shape d={star4(x - 30, floor - 100, 30)} fill={C.goldHi} line={4} />
      </>
    );
    return (
      <>
        {FLOWERS.map((fl, i) => (
          <Flower key={i} x={fl.x} y={fl.y} c={fl.c} s={fl.s} t={1} />
        ))}
        <Coil x={320} y0={floor - 190} y1={floor - 190 - hisExt} n={8} w={44} />
        <Stein place={{x: 320, y: floor - 190 - hisExt - 402 * scale, scale}} pose={{...STEIN_POSES.armsUp, thighL: 10, thighR: -10}} style={W} face={{eyes: 'happy', smile: 1, mouth: 0.5}} />
        {herExt > 4 && <Coil x={770} y0={floor - 190} y1={floor - 190 - herExt} n={8} w={44} />}
        {herT >= 0 && <Precious place={{x: 770, y: floor - 190 - herExt - 408 * scale, scale}} pose={{uarmL: 150, farmL: 20, uarmR: -150, farmR: -20}} style={W} face={{eyes: 'happy', smile: 1, mouth: 0.5, blush: 0.6}} />}
        {box(320, C.hotpink)}
        {box(770, C.teal)}
        {herT >= 0 && <FloatHearts f={herT} x={545} y={700} n={6} seed={38} spread={260} color={C.hotpink} />}
        {herT >= 0 && (
          <Pop f={f} at={yeah} x={545} y={440}>
            <Note x={545} y={440} size={96} rot={-6} color={C.hotpink}>
              boing!
            </Note>
          </Pop>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 39 - whatever I think
const Thought: React.FC<{f: number; at: number; x: number; y: number; w: number; h: number; from: [number, number]; children: React.ReactNode}> = ({f, at, x, y, w, h, from, children}) => {
  if (f < at - 6) return null;
  const dots = [0.25, 0.5, 0.75].map((k, i) => ({x: lerp(from[0], x, k), y: lerp(from[1], y + h / 2, k), r: 10 + i * 7, on: f >= at - 6 + i * 2}));
  return (
    <>
      {dots.map((d, i) => (d.on ? <Shape key={i} d={circle(d.x, d.y, d.r)} fill={C.white} line={4} /> : null))}
      {f >= at && (
        <Pop f={f} at={at} x={x} y={y}>
          <Bubble x={x} y={y} w={w} h={h} tail={[0, 0]} />
          <Clip d={ellipse(x, y, w * 0.46, h * 0.44)}>{children}</Clip>
        </Pop>
      )}
    </>
  );
};

export const S39: SceneDef = {
  ground: 'mint',
  under: () => <Wash kind="aqua" x={540} y={1100} s={1500} o={0.35} />,
  render: (p) => {
    const {f} = p;
    const place = {x: 540, y: 1150, scale: 0.72};
    const pose: Pose = {uarmR: 24, farmR: 146, uarmL: 30, farmL: -100, head: -4};
    const [tx, ty] = worldPoint(STEIN_PARTS, pose, place, 'head', [0, -290]);
    const hop = Math.abs(Math.sin(f / 5));
    const flip = (f % 24) / 24;
    return (
      <>
        {FLOWERS.map((fl, i) => (
          <Flower key={i} x={fl.x} y={fl.y} c={fl.c} s={fl.s} t={1} />
        ))}
        <Stein place={place} pose={pose} style={W} face={{look: [0.4, -1], smile: 0.8, brow: 0.6, mouth: p.mouth * 0.4, blink: blink(f, 40)}} />
        {/* carrying her bags */}
        <Thought f={f} at={p.w(1)} x={280} y={650} w={420} h={330} from={[tx - 40, ty]}>
          <Precious place={{x: 360, y: 700 - hop * 6, scale: 0.2}} pose={{uarmR: -140, farmR: -20}} style={W} face={{smile: 1, eyes: 'happy'}} />
          <Stein place={{x: 200, y: 710, scale: 0.2}} pose={{uarmL: 40, farmL: -120, uarmR: -40, farmR: 120}} style={W} face={{smile: 1, eyes: 'happy'}} />
          {[0, 1, 2, 3].map((k) => (
            <Shape key={k} d={rect(150 + (k % 2) * 40, 600 - k * 38 - hop * 4, 70, 50, 6)} fill={[C.hotpink, C.teal, C.gold, C.candy][k]} line={3.5} />
          ))}
        </Thought>
        {/* flipping pancakes */}
        <Thought f={f} at={p.w(3)} x={800} y={470} w={420} h={320} from={[tx + 40, ty - 20]}>
          <Stein place={{x: 740, y: 540, scale: 0.2}} pose={{uarmR: -60, farmR: -30}} style={W} face={{smile: 1, mouth: 0.5}} />
          <Line d="M800,470L850,470" size={6} />
          <Shape d={ellipse(890, 472, 50, 14)} fill={C.ink} line={4} />
          <Shape d={heart(890, 470 - Math.sin(flip * Math.PI) * 120, 34)} fill={C.release} shade={heart(896, 476 - Math.sin(flip * Math.PI) * 120, 30)} shadeInk="ht-gold-1" line={4} />
        </Thought>
        {/* holding an umbrella over her */}
        <Thought f={f} at={p.w(4)} x={370} y={330} w={400} h={300} from={[tx - 20, ty - 40]}>
          <g transform="translate(40,30)">
          {Array.from({length: 10}, (_, i) => {
            const yy = 180 + ((f * 9 + i * 37) % 260);
            return <Line key={i} d={`M${160 + i * 36},${yy}L${152 + i * 36},${yy + 26}`} size={4} color={C.iceInk} />;
          })}
          <Shape d="M220,280C220,200 440,200 440,280Q412,268 385,280Q357,268 330,280Q302,268 275,280Q247,268 220,280Z" fill={C.candy} line={4} />
          <Line d="M330,280L322,360" size={5} />
          <Stein place={{x: 280, y: 400, scale: 0.18}} pose={{uarmR: -120, farmR: -40}} style={W} face={{smile: 1, eyes: 'happy'}} />
          <Precious place={{x: 380, y: 400, scale: 0.18}} style={W} face={{smile: 1, eyes: 'happy'}} />
          </g>
        </Thought>
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 40 - high five, then day turns to night
export const S40: SceneDef = {
  ground: 'mint',
  camera: (p) => ({zoom: 1.08 - 0.08 * prog(p.f, 20, p.dur - 20, ease.inOutSine), y: 30 * prog(p.f, 20, p.dur - 20, ease.inOutSine)}),
  render: (p) => {
    const {f} = p;
    const five = p.w(0);
    const sky = colorKeys(f, [[24, '#CFE9F2'], [60, '#F6C29A'], [82, '#EE9AB4'], [108, '#6A4E7A'], [136, C.dusk]]);
    const sunY = lerp(420, 1320, prog(f, 30, 76, ease.inQuad));
    const moonY = lerp(1320, 400, prog(f, 100, 50, ease.outCubic));
    const night = prog(f, 96, 40);
    const contact: [number, number] = [540, 660];
    const sPlace = {x: 380, y: 1060, scale: 0.72};
    const pPlace = {x: 700, y: 1060, scale: 0.72, flip: true};
    const sBase: Pose = {uarmL: 10, farmL: -8};
    const pBase: Pose = {uarmL: 10, farmL: -8};
    const sUp = {...sBase, ...reach(STEIN_PARTS, sBase, sPlace, 'uarmR', 'farmR', 'handR', contact, 1, [0, 40])};
    const pUp = {...pBase, ...reach(PRECIOUS_PARTS, pBase, pPlace, 'uarmR', 'farmR', 'handR', contact, 1, [0, 36])};
    const armT = f < five ? ease.inOutCubic(clamp((f + 4) / (five + 4))) : 1 - ease.inOutCubic(clamp((f - five - 8) / 14));
    const sPose = mixPose({...sBase, uarmR: -10, farmR: 10}, sUp, armT);
    const pPose = mixPose({...pBase, uarmR: -10, farmR: 10}, pUp, armT);
    const smack = f >= five && f < five + 12;
    const houses = [
      {x: -40, w: 300, h: 220, body: '#4A5566', seed: 3},
      {x: 300, w: 260, h: 250, body: '#505B6D', seed: 6},
      {x: 620, w: 300, h: 210, body: '#4A5566', seed: 8},
      {x: 940, w: 220, h: 240, body: '#505B6D', seed: 9},
    ];
    return (
      <>
        <Flat d="M-200,-200L1280,-200L1280,1330L-200,1330Z" fill={sky} />
        <g opacity={night}>
          <Stars f={f} n={22} seed={40} y0={160} y1={900} />
        </g>
        {sunY < 1320 && (
          <>
            <Flat d={circle(540, sunY, 300)} fill="url(#glow-amber)" opacity={0.8} />
            <Shape d={circle(540, sunY, 110)} fill={C.goldHi} line={6} />
          </>
        )}
        {f >= 100 && <Moon x={860} y={moonY} r={70} />}
        {houses.map((h, i) => (
          <House key={i} x={h.x} y={1330} w={h.w} h={h.h} body={h.body} lit={clamp((f - 112 - i * 6) / 8)} seed={h.seed} />
        ))}
        <Shape d="M-60,1330L1140,1330L1140,2000L-60,2000Z" fill={C.mint} shade="M-60,1400L1140,1400L1140,2000L-60,2000Z" shadeInk="ht-teal-1" line={6} shadow={false} />
        {FLOWERS.map((fl, i) => (
          <Flower key={i} x={fl.x} y={fl.y + 60} c={fl.c} s={fl.s * 0.8} t={1 - night * 0.5} />
        ))}
        <Flat d="M-200,1330L1280,1330L1280,2120L-200,2120Z" fill={C.dusk} opacity={0.45 * night} />
        <Streetlight x={80} y={1420} h={660} on={clamp((f - 128) / 6)} />
        <Streetlight x={1000} y={1420} h={660} on={clamp((f - 136) / 6)} />
        <Stein place={sPlace} pose={sPose} style={W} face={{eyes: f < five + 20 ? 'happy' : 'dot', smile: 1, look: f < five + 20 ? [1, -0.6] : [0.3, -0.5], turn: 0.3, mouth: p.mouth * 0.5, blink: blink(f, 70)}} />
        <Precious place={pPlace} pose={pPose} style={W} face={{eyes: f < five + 20 ? 'happy' : 'dot', smile: 1, look: f < five + 20 ? [1, -0.6] : [0.3, -0.5], turn: 0.3, blink: blink(f, 80, 20)}} />
        <Pip place={{x: lerp(-120, 540, prog(f, 40, 60)), y: 1330, scale: 0.5}} pose={f < 100 ? waddle(f, 16) : {head: -16, flipperL: 10, flipperR: -10}} face={{eyes: f > 150 ? 'wide' : 'dot'}} />
        {smack && (
          <>
            <Shape d={star4(contact[0], contact[1] - 10, 120 * ease.outBack(clamp((f - five) / 4)))} fill={C.goldHi} line={5} />
            <Note x={540} y={430} size={84} rot={-6} color={C.hotpink}>
              smack!
            </Note>
          </>
        )}
        {f > 146 && <Snow f={f - 146} n={10} seed={41} speed={0.4} y0={-40} y1={1500} big />}
      </>
    );
  },
};

export const CHORUS2: Record<number, SceneDef> = {28: S28, 29: S29, 30: S30, 31: S31, 32: S32, 33: S33, 34: S34, 35: S35, 36: S36, 37: S37, 38: S38, 39: S39, 40: S40};

