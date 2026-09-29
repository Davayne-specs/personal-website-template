// Verse 1, part two: No. 12-22. The man, the talk, and the snap into register.
import React from 'react';
import {C, FONT} from '../brand/tokens';
import {Precious, PRECIOUS_PARTS, PRECIOUS_POSES} from '../characters/Precious';
import {Ring} from '../characters/Ring';
import {Smoke, Stein, STEIN_PARTS, STEIN_POSES} from '../characters/Stein';
import {clamp, ease, keys, lerp, prog, swing} from '../lib/ease';
import {Flat, Line, Shape, Txt} from '../lib/print';
import {rng} from '../lib/random';
import {addPose, chainAngle, Pose, poseAt, walkCycle, worldPoint} from '../lib/rig';
import {
  Arrow,
  Bubble,
  circle,
  Clip,
  ellipse,
  Floor,
  FloatHearts,
  heart,
  Note,
  Palm,
  Phone,
  Polaroid,
  Pop,
  rect,
  smooth,
  SmokePuff,
  Sparkle,
  star4,
  Wash,
} from '../props/common';
import {SceneDef} from './types';

const blink = (f: number, every = 97, off = 0) => ((f + off) % every < 4 ? 1 : 0);

const Gear: React.FC<{x: number; y: number; r: number; teeth?: number; rot: number; fill: string}> = ({x, y, r, teeth = 10, rot, fill}) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2 + (rot * Math.PI) / 180;
    const rr = i % 4 < 2 ? r : r * 0.8;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  const d = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('') + 'Z';
  return (
    <>
      <Shape d={`${d}${circle(x, y, r * 0.28)}`} evenodd fill={fill} line={5} />
    </>
  );
};

// ---------------------------------------------------------------- No. 12
const WINDOWS = 'M390,1086C420,1030 470,1012 540,1012L570,1012L570,1086ZM600,1012L690,1014C740,1018 770,1050 790,1086L600,1086Z';
const Lowrider: React.FC<{f: number; hood: number; tilt: number; lift: number; driver?: React.ReactNode}> = ({f, hood, tilt, lift, driver}) => {
  const wheel = (x: number) => (
    <g transform={`translate(${x},0)`}>
      <Shape d={circle(0, 0, 70)} fill={C.ink} line={5} />
      <Shape d={`${circle(0, 0, 50)}${circle(0, 0, 30)}`} evenodd fill={C.white} line={3} />
      <Shape d={circle(0, 0, 30)} fill={C.gold} pattern="foil" line={3} sheen />
      <Line d={Array.from({length: 6}, (_, i) => { const a = (i / 6) * Math.PI * 2 + f / 3; return `M0,0L${(Math.cos(a) * 28).toFixed(1)},${(Math.sin(a) * 28).toFixed(1)}`; }).join('')} size={3} />
    </g>
  );
  return (
    <>
      <g transform="translate(0,1250)">
        {wheel(250)}
        {wheel(820)}
      </g>
      <g transform={`translate(540,${1180 - lift}) rotate(${tilt}) translate(-540,-1180)`}>
        {/* body */}
        <Shape
          d="M60,1180C60,1120 90,1100 150,1096L330,1090C380,1010 460,990 560,990L700,992C760,996 800,1040 830,1090L1000,1100C1040,1104 1050,1140 1046,1180L1040,1236L70,1236Z"
          fill={C.teal}
          shade="M60,1180L1060,1180L1060,1240L60,1240Z"
          shadeInk="ht-ink-2"
          line={7}
        />
        <Shape d={WINDOWS} fill={C.aqua} line={5} />
        <Clip d={WINDOWS}>{driver}</Clip>
        <Flat d={WINDOWS} fill={C.white} opacity={0.18} />
        <Line d="M430,1070L470,1030M470,1076L500,1044M640,1070L670,1036" size={4} color={C.white} opacity={0.7} />
        <Line d="M90,1150L1030,1150" size={6} color={C.gold} />
        <Shape d={rect(1010, 1130, 40, 30, 8)} fill={C.goldHi} line={4} />
        <Shape d={rect(56, 1130, 36, 30, 8)} fill={C.pressure} line={4} />
        {/* the hood pops up at the front */}
        <g transform={`translate(830,1092) rotate(${-hood * 58})`}>
          {hood > 0.05 && <Shape d="M0,0L200,8L200,30L0,20Z" fill="#17625F" line={5} />}
        </g>
        {hood > 0.05 && (
          <>
            <Shape d="M840,1096L1030,1104L1030,1140L840,1136Z" fill="#171221" line={4} shadow={false} />
          </>
        )}
      </g>
    </>
  );
};

export const S12: SceneDef = {
  ground: 'mint',
  render: (p) => {
    const {f} = p;
    const upT = p.w(3);
    const downT = p.w(5);
    const noT = p.w(6);
    const beatHop = p.beat;
    const odd = p.beatN % 2 === 1;
    const lift = f >= upT && f < downT ? 90 * ease.outBack(clamp((f - upT) / 6)) : f >= downT && f < noT ? -18 : 40 * beatHop;
    const tilt = f < upT ? (odd ? -6 : 6) * beatHop : f >= noT ? 0 : 0;
    const hood = clamp((f - noT) / 8);
    return (
      <>
        <Flat d={circle(540, 900, 330)} fill="url(#glow-gold)" opacity={0.8} />
        <Shape d={circle(540, 900, 230)} fill={C.goldHi} line={6} />
        {[0, 1, 2].map((k) => (
          <Line key={k} d={`M${330 + k * 20},${930 + k * 44}L${750 - k * 20},${930 + k * 44}`} size={10} color={C.candy} />
        ))}
        <Palm x={130} y={1320} s={0.9} sway={Math.sin(f / 12) * 4} />
        <Palm x={960} y={1320} s={0.75} sway={Math.sin(f / 10 + 1) * 4} />
        <Shape d={rect(-40, 1310, 1160, 200)} fill={C.white} line={5} shadow={false} />
        <Line d="M-40,1400L1120,1400" size={4} opacity={0.4} />
        <Lowrider
          f={f}
          hood={hood}
          tilt={tilt}
          lift={lift}
          driver={<Stein place={{x: 560, y: 1330, scale: 0.46}} pose={STEIN_POSES.stand} face={{mouth: p.mouth, smile: 0.8, turn: 0.5, look: [1, 0]}} />}
        />
        <Shape d={ellipse(540, 1330, 520 - lift, 26)} fill={C.ink} opacity={0.15} line={false} shadow={false} ghost={false} />
        {f >= upT && f < downT && <Note x={250} y={760} size={80} rot={-8}>up</Note>}
        {f >= downT && f < noT && <Note x={880} y={1480 - 400} size={70} rot={8}>down</Note>}
        {hood > 0.5 && (
          <>
            <Note x={760} y={760} size={64} rot={-6} color={C.hotpink}>
              no pistons
            </Note>
            <Arrow d="M820,790C880,850 910,930 930,1040" head={[930, 1040, 70]} size={6} color={C.hotpink} />
          </>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 13
export const S13: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="aqua" x={540} y={560} s={1300} o={0.45} v={2} />,
  render: (p) => {
    const {f} = p;
    const know = p.w(7);
    const get = p.w(8);
    const on = f >= know;
    const pose: Pose = on
      ? poseAt(f - know, [[0, {uarmR: -20, farmR: 150, uarmL: 8}], [6, {uarmR: -150, farmR: -20, uarmL: 10}]])
      : {uarmR: -20, farmR: 150, uarmL: 8, farmL: -6, head: -5};
    const spin = f * (on ? 9 : 5);
    const bub = ease.outBack(clamp(f / 10));
    return (
      <>
        {/* thought bubble */}
        <g transform={`translate(540,560) scale(${bub}) translate(-540,-560)`}>
          <Shape d={smooth([[240, 600], [230, 470], [330, 360], [470, 330], [620, 320], [760, 360], [850, 460], [840, 600], [760, 700], [600, 730], [420, 720], [300, 690]], true, 0.8)} fill={C.white} line={7} />
          <Shape d={circle(420, 800, 34)} fill={C.white} line={5} />
          <Shape d={circle(470, 870, 20)} fill={C.white} line={4} />
          {!on && (
            <>
              <Gear x={440} y={520} r={90} rot={spin} fill={C.teal} />
              <Gear x={600} y={470} r={62} rot={-spin * 1.4 + 12} fill={C.candy} />
              <Gear x={640} y={610} r={70} rot={-spin * 1.2} fill={C.goldHi} />
            </>
          )}
          {on && (
            <g transform={`translate(540,520) scale(${ease.outBack(clamp((f - know) / 7))})`}>
              <Flat d={circle(0, 0, 230)} fill="url(#glow-gold)" />
              <Shape d="M-70,-10C-70,-90 70,-90 70,-10C70,30 40,50 36,90L-36,90C-40,50 -70,30 -70,-10Z" fill={C.goldHi} sheen line={6} />
              <Shape d={rect(-40, 90, 80, 50, 8)} fill={C.smoke} line={5} />
              <Line d="M-26,110L26,110M-26,126L26,126" size={3} />
              <Line d="M-20,40L-10,-10L0,30L10,-10L20,40" size={4} color={C.goldLo} />
              <Line d={Array.from({length: 8}, (_, i) => { const a = (i / 8) * Math.PI * 2; return `M${(Math.cos(a) * 110).toFixed(1)},${(Math.sin(a) * 110 - 10).toFixed(1)}L${(Math.cos(a) * 150).toFixed(1)},${(Math.sin(a) * 150 - 10).toFixed(1)}`; }).join('')} size={7} color={C.gold} />
            </g>
          )}
        </g>
        <Stein
          place={{x: 540, y: 1560, scale: 1.12}}
          pose={pose}
          face={{mouth: p.mouth, eyes: on ? 'wide' : 'dot', look: on ? [0, -0.6] : [0.5, -1], smile: on ? 0.9 : 0.1, brow: on ? 1 : 0.4, browTilt: on ? 0 : 0.5}}
        />
        {f >= get && <Note x={860} y={900} size={70} rot={10} color={C.hotpink}>get it.</Note>}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 14
export const S14: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="aqua" x={700} y={900} s={1300} o={0.35} />,
  render: (p) => {
    const {f} = p;
    const x = lerp(1180, 520, clamp(f / (p.dur * 0.9)));
    const walk = walkCycle(f, 22, 0.9);
    const q = p.w(8);
    return (
      <>
        <Floor y={1360} fill={C.mint} />
        <SmokePuff x={x + 420} y={1100} s={600} o={0.5} v={1} />
        <Smoke place={{x: x + 170, y: 930, scale: 0.72, flip: true}} pose={addPose({uarmL: -30, farmL: -80}, walk)} />
        <Precious place={{x, y: 950, scale: 0.72, flip: true}} pose={addPose({...PRECIOUS_POSES.stand, uarmR: -40, farmR: -60}, walk)} face={{smile: 0.8, turn: 0.4}} />
        {/* the corner Stein peeks round */}
        <Shape d={rect(-60, 200, 300, 1300)} fill={C.teal} line={7} />
        {Array.from({length: 18}, (_, k) => (
          <Line key={k} d={`M${k % 2 ? 20 : 90},${260 + k * 64}L${k % 2 ? 150 : 220},${260 + k * 64}`} size={3} opacity={0.35} />
        ))}
        <Clip d={rect(236, 0, 900, 1500)}>
          <Stein place={{x: 250, y: 1000, scale: 0.86, rotate: 10}} pose={{uarmR: -40, farmR: -40}} face={{look: [1, 0], turn: 0.7, brow: 0.9, browTilt: -0.6, smile: -0.1, blink: blink(f, 60)}} />
        </Clip>
        <Shape d="M230,760C270,740 300,760 300,790C300,820 270,830 240,820Z" fill={C.steinSkin} line={5} />
        {f >= q - 6 && (
          <Pop f={f} at={q - 6} x={380} y={420}>
            <Note x={380} y={470} size={170} rot={10} color={C.hotpink}>
              ?
            </Note>
          </Pop>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 15
const PIECE =
  'M-120,-120L-30,-120C-40,-160 -10,-190 20,-180C50,-170 56,-140 30,-120L120,-120L120,-30C160,-40 190,-10 180,20C170,50 140,56 120,30L120,120L-120,120Z';

export const S15: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="pink" x={600} y={700} s={1200} o={0.35} />,
  render: (p) => {
    const {f} = p;
    const pick = p.w(1);
    const comb = p.w(9);
    const click = clamp((f - comb + 8) / 8);
    const gap = 150 * (1 - ease.inCubic(click));
    const liftT = clamp((f - pick) / 12);
    const handY = 1500 - 360 * ease.outCubic(liftT) + (f < pick ? 400 * (1 - clamp(f / pick)) : 0);
    return (
      <>
        <Floor y={1330} fill={C.mint} />
        <g transform={`translate(${420 - gap},640) rotate(${-4 + click * 4})`}>
          <Shape d={PIECE} fill={C.hotpink} shade="M40,-200L200,-200L200,140L40,140Z" shadeInk="ht-ink-2" line={7} />
          <Shape d={heart(-10, 0, 56)} fill={C.candy} line={5} />
        </g>
        <g transform={`translate(${660 + gap},640) rotate(${6 - click * 6})`}>
          <Shape d="M-120,-120L120,-120L120,120L-120,120L-120,30C-100,56 -70,50 -60,20C-50,-10 -80,-40 -120,-30Z" fill="url(#smokefill)" pattern="smokefill" dotted line={8} />
          <Shape d="M-70,-20L70,-20L60,20C40,30 20,24 10,4L-10,4C-20,24 -40,30 -60,20Z" fill={C.ink} line={4} />
        </g>
        {click >= 1 && f < comb + 14 && <Sparkle x={540} y={640} r={90 * (1 - (f - comb) / 14)} />}
        {/* Stein's piece, picked up off the floor */}
        <g transform={`translate(560,${Math.min(1270, handY - 140)}) rotate(${-20 + liftT * 20}) scale(0.7)`}>
          <Shape d={PIECE} fill={C.teal} line={8} />
          <Shape d={`${ellipse(0, 10, 34, 40)}${ellipse(0, 10, 18, 24)}`} evenodd fill={C.gold} pattern="foil" line={4} />
        </g>
        <g transform={`translate(600,${handY})`}>
          <Shape d="M-70,0C-80,-60 -40,-90 10,-86C60,-80 80,-40 70,10L60,300L-80,300Z" fill={C.steinSkin} shade="M20,-90L90,-90L90,300L20,300Z" shadeInk="ht-ink-2" />
          <Shape d="M-110,120L110,120L120,400L-120,400Z" fill={C.teal} line={6} />
        </g>
        {click >= 1 && <Note x={540} y={330} size={64} rot={-4}>click.</Note>}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 16
const Snap: React.FC<{kind: number; w?: number}> = ({kind, w = 250}) => {
  const inner = (
    <>
      {kind === 0 && (
        <>
          <Flat d={rect(-200, -200, 400, 400)} fill={C.aqua} />
          <Shape d="M-60,40L-30,-40L0,40Z" fill={C.goldHi} line={4} />
          <Shape d={circle(-30, -50, 34)} fill={C.candy} line={4} />
          <Shape d="M10,40L40,-40L70,40Z" fill={C.goldHi} line={4} />
          <Shape d={circle(40, -50, 34)} fill={C.aqua} line={4} />
          <Shape d={heart(5, -110, 18)} fill={C.hotpink} line={3} />
        </>
      )}
      {kind === 1 && (
        <>
          <Flat d={rect(-200, -200, 400, 400)} fill="#3A3150" />
          <Shape d={circle(60, -70, 30)} fill={C.goldHi} line={3} />
          <Shape d={rect(-200, 40, 400, 200)} fill={C.teal} line={4} />
          <Shape d={circle(-30, 10, 18)} fill={C.steinSkin} line={3} />
          <Shape d={circle(20, 10, 20)} fill={C.ink} line={3} />
        </>
      )}
      {kind === 2 && (
        <>
          <Flat d={rect(-200, -200, 400, 400)} fill={C.candy} />
          <Shape d="M-110,40C-110,0 -80,-20 -40,-24L20,-60L70,-24C110,-20 120,10 116,40Z" fill={C.teal} line={4} />
          <Shape d={circle(-60, 44, 18)} fill={C.ink} line={3} />
          <Shape d={circle(70, 44, 18)} fill={C.ink} line={3} />
          <Shape d={heart(10, -90, 22)} fill={C.hotpink} line={3} />
        </>
      )}
      {kind === 3 && (
        <>
          <Flat d={rect(-200, -200, 400, 400)} fill={C.release} />
          <Line d={heart(0, 0, 60)} size={6} color={C.goldLo} />
          <Txt x={0} y={100} size={30} font={FONT.hand}>
            S + P
          </Txt>
        </>
      )}
    </>
  );
  return (
    <Polaroid w={w} h={w * 1.18} photo={C.white}>
      <g transform={`scale(${w / 330})`}>{inner}</g>
    </Polaroid>
  );
};

export const S16: SceneDef = {
  ground: 'blush',
  under: () => <Wash kind="pink" x={540} y={900} s={1600} o={0.5} v={2} />,
  render: (p) => {
    const {f} = p;
    const turn = clamp((f - 40) / 14);
    const page = f < 47 ? 0 : 1;
    const sx = Math.cos(turn * Math.PI);
    const labels = [['ice cream', 'the roof'], ['the car', 'the sand']][page];
    return (
      <>
        {/* album spread */}
        <Shape d="M90,520L540,560L990,520L990,1320L540,1360L90,1320Z" fill={C.teal} line={7} />
        <Shape d="M110,540L530,578L530,1330L110,1300Z" fill={C.white} line={5} />
        <Shape d="M550,578L970,540L970,1300L550,1330Z" fill={C.white} line={5} />
        <Line d="M540,560L540,1360" size={6} />
        {[0, 1].map((side) => (
          <g key={side} transform={`translate(${side ? 760 : 320},940) rotate(${side ? 4 : -5})`}>
            <Snap kind={page * 2 + side} w={300} />
            <Txt x={0} y={240} size={46} font={FONT.hand}>
              {labels[side]}
            </Txt>
          </g>
        ))}
        {turn > 0 && turn < 1 && (
          <g transform={`translate(540,0) scale(${sx},1) translate(-540,0)`}>
            <Shape d="M550,578L970,540L970,1300L550,1330Z" fill={sx > 0 ? C.white : C.candy} line={5} />
            <Flat d="M550,578L970,540L970,1300L550,1330Z" fill="url(#ht-ink-1)" opacity={1 - Math.abs(sx)} />
          </g>
        )}
        <Note x={540} y={430} size={70} rot={-3}>
          the times.
        </Note>
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 17
export const S17: SceneDef = {
  ground: 'mint',
  under: () => <Wash kind="pink" x={260} y={400} s={1100} o={0.45} />,
  render: (p) => {
    const {f} = p;
    const x = lerp(-120, 1180, clamp(f / p.dur));
    const r = rng(17);
    const back = Array.from({length: 9}, (_, i) => ({x: i * 130 - 20 - f * 0.6, h: 420 + r() * 300, c: [C.aqua, C.white, C.candy][i % 3]}));
    const front = [
      {x: -20, w: 330, h: 330},
      {x: 330, w: 260, h: 420},
      {x: 610, w: 300, h: 300},
      {x: 930, w: 260, h: 380},
    ];
    const roofAt = (px: number) => {
      const b = front.find((q) => px >= q.x && px <= q.x + q.w);
      return 1420 - (b ? b.h : 400);
    };
    const run = walkCycle(f, 13, 1.4);
    const feet = roofAt(x);
    const hop = Math.abs(Math.sin((f / 13) * Math.PI)) * 22;
    return (
      <>
        {back.map((b, i) => (
          <Shape key={i} d={rect(b.x, 1420 - b.h - 200, 120, b.h + 200, 3)} fill={b.c} line={4} opacity={0.8} />
        ))}
        {front.map((b, i) => (
          <g key={i}>
            <Shape d={rect(b.x, 1420 - b.h, b.w, b.h + 400, 4)} fill={[C.white, C.candy, C.aqua, C.white][i]} line={6} />
            {Array.from({length: 8}, (_, k) => (
              <Shape key={k} d={rect(b.x + 30 + (k % 3) * (b.w / 3.3), 1420 - b.h + 50 + Math.floor(k / 3) * 120, b.w / 5, 70, 4)} fill={(k + i) % 3 ? C.white : C.goldHi} line={3.5} shadow={false} />
            ))}
          </g>
        ))}
        <Precious
          place={{x, y: feet - 256 - hop, scale: 0.62}}
          pose={addPose({uarmR: -160, farmR: -10, uarmL: 20, farmL: -20}, {thighL: run.thighL, thighR: run.thighR, shinL: run.shinL, shinR: run.shinR, torso: 6})}
          face={{smile: 0.9, turn: 0.5, eyes: 'happy'}}
          holdR={
            <g transform="rotate(170) translate(0,-150)">
              <Flat d={circle(0, 0, 150)} fill="url(#glow-pink)" />
              <Shape d={circle(0, 0, 82)} fill={C.aqua} shade="M10,-90L100,-90L100,90L10,90Z" shadeInk="ht-teal-2" line={6} />
              <Shape d="M-60,-20C-30,-50 10,-30 20,-60C40,-40 60,-10 50,20C20,10 0,40 -30,30C-50,20 -70,10 -60,-20Z" fill={C.candy} line={4} />
              <Shape d="M-120,10C-60,-30 60,-30 120,10C60,40 -60,40 -120,10Z" fill="none" line={6} lineColor={C.gold} />
            </g>
          }
        />
        <Note x={800} y={330} size={60} rot={-4}>
          her own world
        </Note>
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 18 & 19: the thread
const Thread: React.FC<{a: [number, number]; b: [number, number]; sag: number; f: number; pulse?: number}> = ({a, b, sag, f, pulse = 0}) => {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2 + sag;
  const d = `M${a[0]},${a[1]}Q${mx},${my} ${b[0]},${b[1]}`;
  const t = pulse;
  const px = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * mx + t * t * b[0];
  const py = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * my + t * t * b[1];
  return (
    <>
      <Line d={d} size={6} color={C.hotpink} />
      <Shape d={heart(px, py, 20 + 4 * Math.sin(f / 3))} fill={C.hotpink} line={3.5} />
    </>
  );
};

export const S18: SceneDef = {
  ground: 'blush',
  under: () => (
    <>
      <Wash kind="pink" x={260} y={900} s={1000} o={0.5} />
      <Wash kind="aqua" x={820} y={900} s={1000} o={0.45} />
    </>
  ),
  render: (p) => {
    const {f} = p;
    const feel = p.w(4);
    const sp = {x: 270, y: 930, scale: 0.76};
    const pp = {x: 810, y: 950, scale: 0.76, flip: true};
    const sPose = {...STEIN_POSES.chestHand};
    const pPose: Pose = f >= feel ? {uarmR: 20, farmR: 120, uarmL: 10, farmL: -8} : PRECIOUS_POSES.stand;
    const a = worldPoint(STEIN_PARTS, sPose, sp, 'torso', [10, -200]);
    const b = worldPoint(PRECIOUS_PARTS, pPose, pp, 'torso', [0, -190]);
    const pulse = (Math.sin(f / 12) + 1) / 2;
    return (
      <>
        <Line d="M540,120L540,1440" size={5} opacity={0.5} />
        <Flat d={rect(500, 120, 40, 1320)} fill="url(#ht-ink-1)" opacity={0.5} />
        <Stein place={sp} pose={sPose} face={{mouth: p.mouth, smile: 0.5, turn: 0.4, look: [1, 0], blink: blink(f, 80)}} />
        <Precious place={pp} pose={pPose} face={{smile: f >= feel ? 0.8 : 0.4, turn: 0.4, look: [1, 0], blink: blink(f, 70, 20)}} />
        <Thread a={a} b={b} sag={90 - 40 * Math.sin(f / 16)} f={f} pulse={pulse} />
        {f >= feel && <FloatHearts f={f - feel} x={540} y={700} n={4} seed={18} spread={200} />}
      </>
    );
  },
};

export const S19: SceneDef = {
  ground: 'blush',
  under: () => <Wash kind="gold" x={420} y={800} s={1100} o={0.5} />,
  camera: (p) => ({zoom: 1.04 + 0.05 * prog(p.f, 0, p.dur)}),
  render: (p) => {
    const {f} = p;
    const want = p.w(4);
    const reach = ease.inOutCubic(clamp(f / want));
    const pp = {x: 830, y: 1070, scale: 0.8, flip: true};
    const pose: Pose = {uarmR: lerp(-10, -86, reach), farmR: lerp(10, -8, reach), uarmL: 8, farmL: -6, torso: -4 * reach};
    const tip = worldPoint(PRECIOUS_PARTS, pose, pp, 'handR', [0, 50]);
    const ringX = 390;
    const ringY = 700 + Math.sin(f / 10) * 14;
    const chest = worldPoint(PRECIOUS_PARTS, pose, pp, 'torso', [0, -190]);
    const spark = f >= want ? clamp((f - want) / 5) * (1 - clamp((f - want - 20) / 12)) : 0;
    return (
      <>
        <Line d={`M-40,${chest[1] + 60}Q300,${chest[1] + 10} ${chest[0]},${chest[1]}`} size={6} color={C.hotpink} />
        <Ring x={ringX} y={ringY} r={96} spin={f * 4} glow={0.7} glint={0.5 + 0.5 * Math.sin(f / 5)} />
        <Precious place={pp} pose={pose} face={{smile: 0.6, turn: 0.5, look: [1, -0.3], eyes: f >= want ? 'wide' : 'dot'}} />
        {spark > 0 && <Sparkle x={(tip[0] + ringX + 90) / 2} y={(tip[1] + ringY) / 2} r={60 * spark} />}
        <Note x={560} y={420} size={60} rot={-5}>
          almost.
        </Note>
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 20
export const S20: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="aqua" x={540} y={960} s={1400} o={0.3} />,
  render: (p) => {
    const {f} = p;
    const cx = 540;
    const cy = 1040;
    const bubbles = Array.from({length: 7}, (_, i) => {
      const a = (i / 7) * Math.PI * 2 + f / 16;
      const x = cx + Math.cos(a) * 380;
      const y = cy + Math.sin(a) * 150 + 120;
      const front = Math.sin(a) > 0;
      const legs = Math.sin(f / 2 + i) * 14;
      const bubble = (
        <g key={i} transform={`translate(${x},${y - 200})`}>
          <Line d={`M-20,40L${-30 + legs},96M0,44L${legs * -0.6},100M20,40L${30 - legs},96`} size={5} />
          <Bubble x={0} y={0} w={180} h={110} tail={[30, 60]} fill={i % 3 === 0 ? C.smoke : C.white} dotted={i % 3 === 0}>
            <Line d="M-50,-10C-40,-24 -30,4 -20,-10C-10,-24 0,4 10,-10C20,-24 30,4 40,-10M-44,20C-34,6 -24,34 -14,20C-4,6 6,34 16,20" size={4.5} />
          </Bubble>
        </g>
      );
      return {front, bubble, y};
    });
    return (
      <>
        <Floor y={1380} fill={C.mint} />
        {bubbles.filter((b) => !b.front).map((b) => b.bubble)}
        <Stein
          place={{x: cx, y: 940, scale: 0.82}}
          pose={{uarmL: 42, farmL: -118, uarmR: -42, farmR: 118}}
          face={{look: [Math.cos(f / 16 + 1.5), 0], smile: -0.2, brow: -0.3, browTilt: 0.4, blink: blink(f, 50)}}
        />
        {bubbles.filter((b) => b.front).map((b) => b.bubble)}
        <Txt x={540} y={440} size={52} font={FONT.hand} rotate={-4}>
          bla bla bla
        </Txt>
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 21
export const S21: SceneDef = {
  ground: 'mint',
  render: (p) => {
    const {f} = p;
    const never = p.w(6);
    const t = clamp(f / (never + 6));
    const px = lerp(330, 760, t);
    const py = 640 - Math.sin(t * Math.PI * 2) * 120;
    const dissolve = clamp((f - never) / 10);
    const sPose = {uarmR: -30, farmR: -110, uarmL: 8, farmL: -6};
    const sp = {x: 800, y: 1010, scale: 0.72};
    const hand = worldPoint(STEIN_PARTS, sPose, sp, 'handR', [0, 30]);
    return (
      <>
        <Floor y={1380} fill={C.white} />
        <SmokePuff x={260} y={900} s={640} o={0.6} v={4} />
        <Smoke place={{x: 250, y: 1000, scale: 0.7}} pose={{uarmR: -40, farmR: -60, uarmL: 10}} />
        <Bubble x={300} y={430} w={300} h={200} tail={[-10, 150]} fill={C.white} dotted>
          <g transform={`translate(300,425) rotate(${Math.sin(f) * 8})`}>
            <Shape d={rect(-40, -70, 80, 140, 16)} fill={C.ink} line={4} />
            <Shape d={rect(-30, -54, 60, 100, 8)} fill={C.aqua} line={2.5} shadow={false} />
          </g>
          <Line d="M240,380Q220,420 240,460M360,380Q380,420 360,460" size={4} />
        </Bubble>
        <Stein
          place={sp}
          pose={sPose}
          face={{look: [-0.2, 0.5], brow: 0.6, browTilt: 0.5, smile: -0.3, turn: -0.2}}
          holdR={
            <g transform={`rotate(${-chainAngle(STEIN_PARTS, sPose, 'handR')}) translate(-40,-40) scale(0.36)`}>
              <Phone w={420} h={820} screen={C.white}>
                <Txt x={0} y={-60} size={100} font={FONT.lyric} weight={800}>
                  0
                </Txt>
                <Txt x={0} y={40} size={46} font={FONT.tag} weight={700}>
                  missed
                </Txt>
                <Txt x={0} y={100} size={46} font={FONT.tag} weight={700}>
                  calls
                </Txt>
              </Phone>
            </g>
          }
        />
        {/* the message that never lands */}
        <g transform={`translate(${px},${py}) rotate(${Math.cos(t * Math.PI * 2) * -30})`} opacity={1 - dissolve}>
          <Shape d="M-60,0L60,-30L10,10Z" fill={C.white} line={4} />
          <Shape d="M-60,0L10,10L0,40Z" fill={C.candy} line={4} />
        </g>
        {f >= never && <SmokePuff x={px} y={py} s={300 + dissolve * 200} o={0.9 * (1 - clamp((f - never - 20) / 20))} v={3} />}
        {f >= never && <Note x={560} y={300} size={60} rot={-4} color={C.ash}>never got it.</Note>}
        <Flat d={circle(hand[0], hand[1], 1)} fill="none" />
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 22 - the snap
export const S22: SceneDef = {
  ground: 'cotton',
  camera: (p) => ({zoom: 1 + 0.06 * ease.outCubic(clamp(p.f / p.dur))}),
  render: (p) => {
    const {f} = p;
    const open = ease.outCubic(clamp(f / 16));
    const w = 40 + open * 280;
    const r = rng(22);
    const edgeL: [number, number][] = [];
    const edgeR: [number, number][] = [];
    for (let y = -40; y <= 1960; y += 60) {
      edgeL.push([540 - w / 2 - r() * 24, y]);
      edgeR.push([540 + w / 2 + r() * 24, y]);
    }
    const tear = `M${edgeL.map(([x, y]) => `${x.toFixed(1)},${y}`).join('L')}L${[...edgeR].reverse().map(([x, y]) => `${x.toFixed(1)},${y}`).join('L')}Z`;
    return (
      <>
        <Shape d={tear} fill={C.gold} pattern="foil" sheen line={6} shadow={false} />
        <Flat d={rect(540 - w / 2, 0, w, 1920)} fill="url(#glow-gold)" opacity={0.6} />
        {[0, 1, 2, 3].map((i) => (
          <Sparkle key={i} x={540 + (i % 2 ? 1 : -1) * (40 + i * 20)} y={300 + i * 330 + Math.sin(f / 4 + i) * 20} r={(18 + i * 6) * open} />
        ))}
        <Stein
          place={{x: 540, y: 1500, scale: 1.25}}
          pose={{uarmL: 30, farmL: -120, uarmR: -30, farmR: 120, head: -4}}
          face={{mouth: p.mouth, smile: 0.9, brow: 0.7, browTilt: -0.4, look: [0, 0], eyes: 'dot'}}
        />
        <Txt x={540} y={430} size={260} font={FONT.stamp} color={C.ink} opacity={open} spacing={10}>
          AYY
        </Txt>
      </>
    );
  },
};

export const VERSE2: Record<number, SceneDef> = {12: S12, 13: S13, 14: S14, 15: S15, 16: S16, 17: S17, 18: S18, 19: S19, 20: S20, 21: S21, 22: S22};

void Polaroid;
void swing;
void keys;
void star4;
