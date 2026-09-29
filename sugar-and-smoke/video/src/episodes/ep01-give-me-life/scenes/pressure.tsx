// Hook, pressure half: No. 40-56. Red, squash and swell, the Gauge climbs, PRESSURE stamps.
import React from 'react';
import {C, FONT} from '../../../brand/tokens';
import {Biscuit} from '../../../characters/Biscuit';
import {Precious, PRECIOUS_PARTS, PRECIOUS_POSES} from '../../../characters/Precious';
import {Ring} from '../../../characters/Ring';
import {Smoke, Stein, STEIN_PARTS, STEIN_POSES} from '../../../characters/Stein';
import {clamp, ease, keys, lerp, prog} from '../../../lib/ease';
import {Flat, Line, Shape, Txt} from '../../../lib/print';
import {rng} from '../../../lib/random';
import {addPose, chainAngle, Pose, walkCycle, worldPoint} from '../../../lib/rig';
import {
  Bubble,
  circle,
  ellipse,
  Floor,
  FloatHearts,
  heart,
  Hand,
  Moon,
  MotionLines,
  Note,
  poly,
  Pop,
  rect,
  smooth,
  SmokePuff,
  Sparkle,
  Stars,
  Wash,
} from '../../../props/common';
import {SceneDef} from '../../../lib/scene';

const blink = (f: number, every = 97, off = 0) => ((f + off) % every < 4 ? 1 : 0);
const hitIn = (p: {w: (i: number) => number; slot: {line?: {words: {w: string}[]}}}) => {
  const words = p.slot.line?.words ?? [];
  const k = words.findIndex((w) => /^pressur/i.test(w.w));
  return k >= 0 ? p.w(k) : 9999;
};

// A giant pointing hand from the top of the frame.
const GiantHand: React.FC<{x: number; y: number; rot?: number}> = ({x, y, rot = 90}) => (
  <g transform={`translate(${x},${y}) rotate(${rot})`}>
    <Shape d="M-900,-120L-80,-110L-80,110L-900,120Z" fill={C.smoke} line={7} />
    <g transform="scale(1.6)">
      <Hand point skin="#9C6A52" />
    </g>
  </g>
);

// ---------------------------------------------------------------- No. 40
export const S40: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="pink" x={540} y={1100} s={1400} o={0.4} />,
  render: (p) => {
    const {f} = p;
    const press = p.w(3);
    const tip = keys(f, [[0, -700], [press - 4, 380], [press + 6, 470], [p.dur, 450]], ease.inOutCubic);
    const sq = f >= press ? 1 - 0.08 * ease.outCubic(clamp((f - press) / 6)) : 1;
    return (
      <>
        <Flat d={circle(540, 1200, 520)} fill="url(#glow-red)" opacity={0.3 + 0.3 * clamp((f - press) / 10)} />
        <Floor y={1380} fill={C.candy} />
        <Precious place={{x: 540, y: 1150, scale: 0.56, squash: sq}} pose={{uarmL: 40, farmL: -80, uarmR: -40, farmR: 80, head: -8}} face={{eyes: 'wide', look: [0, -1], smile: -0.3, brow: 0.6, browTilt: 0.7}} />
        <GiantHand x={560} y={tip - 170} rot={90} />
        {f >= press && [0, 1, 2].map((k) => <Line key={k} d={`M${420 + k * 120},${870 + (k % 2) * 30}L${400 + k * 120},${830 + (k % 2) * 30}`} size={6} color={C.pressure} />)}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 41
export const S41: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="pink" x={540} y={1100} s={1400} o={0.4} />,
  render: (p) => {
    const {f} = p;
    const up = p.w(4);
    const tip = f < up ? 470 + 20 * Math.sin(f / 3) : lerp(470, 180, ease.outBack(clamp((f - up) / 10)));
    const pose: Pose = {uarmL: 150, farmL: 30, uarmR: -150, farmR: -30, thighL: 16, shinL: -14, thighR: -16, shinR: 14};
    const sq = f < up ? 0.94 + 0.02 * Math.sin(f / 2) : 1;
    return (
      <>
        <Floor y={1380} fill={C.candy} />
        <Precious place={{x: 800, y: 1150, scale: 0.52}} pose={PRECIOUS_POSES.stand} face={{look: [-1, -0.5], smile: 0.4, eyes: f >= up ? 'happy' : 'dot'}} />
        <GiantHand x={520} y={tip - 170} rot={90} />
        <Stein place={{x: 480, y: 1000, scale: 0.78, squash: sq}} pose={pose} face={{mouth: p.mouth, brow: -0.6, browTilt: -0.8, smile: f >= up ? 0.8 : -0.2, eyes: 'dot'}} />
        {f >= up && (
          <Pop f={f} at={up} x={200} y={600}>
            <Note x={200} y={620} size={80} rot={-10} color={C.pressure}>
              up!
            </Note>
          </Pop>
        )}
      </>
    );
  },
};

// A hydraulic press head (ink block with red ram) at height y.
const PressHead: React.FC<{y: number; w?: number}> = ({y, w = 520}) => (
  <>
    <Shape d={rect(540 - 40, -400, 80, y + 400 - 90)} fill={C.smoke} shade={rect(540, -400, 50, y + 400)} shadeInk="ht-ink-2" line={6} />
    <Shape d={rect(540 - w / 2, y - 100, w, 100, 10)} fill={C.pressure} shade={rect(540, y - 100, w / 2, 100)} shadeInk="ht-ink-3" line={7} />
    <Line d={`M${540 - w / 2 + 30},${y - 70}L${540 + w / 2 - 30},${y - 70}`} size={4} color={C.white} opacity={0.6} />
  </>
);

// ---------------------------------------------------------------- No. 42
export const S42: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="pink" x={540} y={900} s={1500} o={0.35} />,
  render: (p) => {
    const {f} = p;
    const hit = hitIn(p);
    const onme = p.w(1);
    const push = f < hit ? ease.inOutCubic(clamp(f / hit)) : 1;
    const plate = lerp(520, 640, push) + (f >= hit ? 8 * Math.exp(-(f - hit) / 4) : 0);
    const sq = lerp(1, 0.88, push);
    const pose: Pose = {uarmL: 160, farmL: 20, uarmR: -160, farmR: -20, thighL: 24, shinL: -30, thighR: -24, shinR: 30};
    return (
      <>
        <Floor y={1390} fill={C.candy} />
        <PressHead y={plate} w={560} />
        <Stein place={{x: 540, y: 1000 + (1 - sq) * 200, scale: 0.8, squash: sq}} pose={pose} face={{mouth: p.mouth, brow: -0.8, browTilt: -0.9, smile: 0.3, eyes: 'dot'}} />
        {f >= onme && (
          <>
            <Note x={880} y={1080} size={70} rot={8} color={C.pressure}>
              on me.
            </Note>
            <Line d="M820,1100C760,1120 720,1080 700,1040" size={6} color={C.pressure} />
          </>
        )}
        {f >= hit && f < hit + 16 && (
          <>
            <Line d="M180,700L120,660M170,780L100,780M900,700L960,660M910,780L980,780" size={7} color={C.pressure} />
          </>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 43 & 44: the stretcher
const Stretcher: React.FC<{x: number; y: number; f: number; rider?: boolean; night?: boolean; mouth: number}> = ({x, y, f, rider = true, night, mouth}) => {
  const pose: Pose = {uarmR: 180, farmR: -60, uarmL: 10, farmL: -30, thighL: 0, thighR: 0};
  return (
    <g transform={`translate(${x},${y})`}>
      {[-230, 230].map((wx) => (
        <g key={wx}>
          <Line d={`M${wx},20L${wx},150`} size={6} />
          <Shape d={circle(wx, 170, 26)} fill={C.ink} line={4} />
          <Line d={`M${wx},170L${wx + 18 * Math.cos(f / 2)},${170 + 18 * Math.sin(f / 2)}`} size={4} color={C.white} />
        </g>
      ))}
      <Shape d={rect(-320, -10, 640, 40, 12)} fill={C.white} line={6} />
      <Shape d={rect(-340, 10, 680, 20, 8)} fill={C.smoke} line={5} />
      {/* Stein lies on it: feet to the left, head to the right */}
      <Stein place={{x: 40, y: -60, scale: 0.62, rotate: -90}} pose={pose} style={{bandage: true}} face={{eyes: 'happy', smile: 1, mouth: mouth * 0.6}} />
      <Shape d="M-300,-40C-150,-70 150,-70 260,-40L260,0L-300,0Z" fill={night ? C.candy : C.candy} shade="M-300,-60L260,-60L260,0L-300,0Z" shadeInk="ht-pink-2" line={6} />
      {rider && <Biscuit place={{x: -40, y: -150, scale: 0.46}} pose={{tail: 20 * Math.sin(f / 3), head: 6 * Math.sin(f / 5)}} eyes="happy" />}
    </g>
  );
};

export const S43: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="aqua" x={540} y={900} s={1500} o={0.35} />,
  render: (p) => {
    const {f} = p;
    const x = lerp(-300, 640, ease.outCubic(clamp(f / (p.dur * 0.8))));
    return (
      <>
        <Floor y={1330} fill={C.white} />
        {Array.from({length: 7}, (_, k) => (
          <Line key={k} d={`M${k * 170 - ((f * 12) % 170)},1330L${k * 170 - ((f * 12) % 170) + 60},1330`} size={5} opacity={0.4} />
        ))}
        <Stretcher x={x} y={1140} f={f} mouth={p.mouth} />
        <MotionLines x={x - 380} y={1060} n={4} len={160} />
        <Note x={760} y={560} size={70} rot={-6} color={C.pressure}>
          worth it.
        </Note>
      </>
    );
  },
};

export const S44: SceneDef = {
  ground: 'night',
  render: (p) => {
    const {f} = p;
    const x = lerp(360, 560, prog(f, 0, p.dur));
    const walk = walkCycle(f, 24, 0.7);
    return (
      <>
        <Moon x={820} y={330} r={90} />
        <Stars f={f} n={14} seed={44} y0={120} y1={800} />
        {[180, 900].map((lx, i) => (
          <g key={i}>
            <Flat d={ellipse(lx, 1330, 180, 50)} fill={C.goldHi} opacity={0.3} />
            <Flat d="M0,0" fill="none" />
            <Flat d={`M${lx - 40},560L${lx + 40},560L${lx + 200},1330L${lx - 200},1330Z`} fill={C.goldHi} opacity={0.12} />
            <Shape d={rect(lx - 10, 560, 20, 780)} fill="#4B4162" line={5} />
            <Shape d={`M${lx - 60},560L${lx + 60},560L${lx + 40},500L${lx - 40},500Z`} fill={C.goldHi} line={5} />
          </g>
        ))}
        <Floor y={1330} fill="#3A3150" />
        <Stretcher x={x} y={1150} f={f} rider={false} night mouth={0} />
        <Precious place={{x: x + 300, y: 960, scale: 0.6, flip: true}} pose={addPose({uarmR: -40, farmR: -20}, walk)} face={{smile: 0.8, turn: 0.4, look: [1, 0.3]}} />
        <Shape d={heart(x + 180, 820 - (f % 40), 18)} fill={C.hotpink} line={3.5} opacity={1 - (f % 40) / 40} />
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 45 - what you wanted
export const S45: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="pink" x={700} y={900} s={1400} o={0.35} />,
  render: (p) => {
    const {f} = p;
    const hit = hitIn(p);
    const y = f < hit ? keys(f, [[0, 300], [hit - 18, 420], [hit, 980]], ease.inQuad) : 980 - 120 * ease.outCubic(clamp((f - hit - 6) / 10));
    const diamond = f >= hit;
    return (
      <>
        <Floor y={1390} fill={C.candy} />
        <Shape d={rect(170, 1060, 520, 90, 10)} fill={C.smoke} shade={rect(430, 1060, 260, 90)} shadeInk="ht-ink-2" line={7} />
        <g transform="translate(-110,0)">
          <PressHead y={y} w={420} />
        </g>
        {!diamond ? (
          <Shape d={smooth([[360, 1060], [370, 990], [420, 960], [490, 975], [520, 1030], [500, 1060]], true, 0.6)} fill="#2E2638" line={6} />
        ) : (
          <g transform={`translate(430,1010) scale(${ease.outBack(clamp((f - hit) / 6))})`}>
            <Flat d={circle(0, 0, 140)} fill="url(#glow-gold)" />
            <Shape d="M-60,-20L-30,-50L30,-50L60,-20L0,50Z" fill={C.white} shade="M0,-60L70,-60L70,60L0,60Z" shadeInk="ht-aqua-2" line={5} />
            <Line d="M-60,-20L60,-20M-30,-50L-20,-20L0,50L20,-20L30,-50" size={3} />
            <Sparkle x={70} y={-60} r={26} />
          </g>
        )}
        <Precious place={{x: 860, y: 1020, scale: 0.66, flip: true}} pose={{uarmL: 42, farmL: -118, uarmR: -42, farmR: 118}} face={{smile: 0.9, brow: 0.5, browTilt: -0.4, look: [1, 0.3], blink: blink(f, 70)}} />
        {diamond && (
          <Note x={430} y={1260} size={50} rot={-4}>
            coal → diamond
          </Note>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 46 - slow dance
export const S46: SceneDef = {
  ground: 'night',
  render: (p) => {
    const {f} = p;
    const sway = Math.sin((f / 30) * Math.PI) * 4;
    const sp = {x: 450, y: 1000, scale: 0.8, rotate: sway};
    const pp = {x: 640, y: 1010, scale: 0.8, flip: true, rotate: -sway};
    return (
      <>
        <Flat d="M400,-40L680,-40L940,1400L140,1400Z" fill={C.candy} opacity={0.3} />
        <Flat d={ellipse(540, 1390, 380, 70)} fill={C.candy} opacity={0.5} />
        <Stein place={sp} pose={{uarmR: -30, farmR: -70, uarmL: 10, farmL: -20, head: 6}} face={{eyes: 'closed', smile: 0.7, turn: 0.5}} />
        <Precious place={pp} pose={{uarmR: -120, farmR: -40, uarmL: 10, head: 8}} face={{eyes: 'closed', smile: 0.8, turn: 0.5}} />
        <FloatHearts f={f} x={545} y={520} n={6} seed={46} spread={200} color={C.hotpink} />
        <Stars f={f} n={10} seed={46} y0={100} y1={700} />
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 47 - love, inflated
export const S47: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="pink" x={560} y={860} s={1500} o={0.45} />,
  render: (p) => {
    const {f} = p;
    const hit = hitIn(p);
    const pump = Math.sin((f / 14) * Math.PI * 2);
    const swell = 0.8 + 0.5 * clamp(f / hit) + (f >= hit ? 0.06 * Math.exp(-(f - hit) / 5) : 0);
    const dens = f < hit * 0.4 ? 'ht-pink-1' : f < hit * 0.8 ? 'ht-pink-2' : 'ht-pink-3';
    return (
      <>
        <Floor y={1400} fill={C.release} />
        {/* bellows */}
        <g transform={`translate(210,1180) rotate(${-10 + pump * 6})`}>
          <Shape d={`M-120,-60L60,${-30 - pump * 20}L60,${30 + pump * 20}L-120,60Z`} fill={C.hotpink} line={6} />
          {[0, 1, 2].map((k) => <Line key={k} d={`M${-90 + k * 50},${-50 + k * 3}L${-90 + k * 50},${50 - k * 3}`} size={4} />)}
          <Shape d={rect(-190, -18, 80, 36, 14)} fill={C.gold} line={5} />
          <Shape d="M60,-12L180,-6L180,6L60,12Z" fill={C.goldLo} line={4} />
        </g>
        {pump > 0.6 && <SmokePuff x={400} y={1150} s={160} o={0.6} v={2} />}
        <g transform={`translate(640,860) scale(${swell}) translate(-640,-860)`}>
          <Shape d={heart(640, 880, 250)} fill={C.candy} shade={heart(640, 880, 250)} shadeInk={dens as never} line={8} />
          <Line d="M540,760C560,720 600,700 630,710" size={8} color={C.white} opacity={0.8} />
        </g>
        <Line d={`M390,1170Q420,${1100} 480,1060`} size={6} color={C.hotpink} />
        {f >= hit && (
          <Pop f={f} at={hit} x={880} y={500}>
            <Note x={880} y={520} size={64} rot={8} color={C.pressure}>
              tight!
            </Note>
          </Pop>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 48 - do not touch
export const S48: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="gold" x={540} y={900} s={1300} o={0.4} />,
  render: (p) => {
    const {f} = p;
    const touch = p.w(4);
    const reach = ease.inOutCubic(clamp(f / touch));
    const fx = lerp(1300, 660, reach);
    const spark = f >= touch ? clamp((f - touch) / 4) * (1 - clamp((f - touch - 16) / 10)) : 0;
    return (
      <>
        <Floor y={1400} fill={C.release} />
        {/* pedestal */}
        <Shape d="M420,1400L660,1400L620,1000L460,1000Z" fill={C.white} shade="M540,1000L660,1000L660,1400L540,1400Z" shadeInk="ht-ink-1" line={7} />
        <Shape d={rect(400, 960, 280, 60, 12)} fill={C.gold} pattern="foil" line={6} />
        <Shape d={ellipse(540, 930, 120, 44)} fill={C.hotpink} line={6} />
        <Ring x={540} y={830} r={100} spin={20 + 10 * Math.sin(f / 10)} glint={0.6 + 0.4 * spark} glow={0.4} />
        {/* rope */}
        {[210, 870].map((x) => (
          <g key={x}>
            <Shape d={rect(x - 16, 1080, 32, 320, 10)} fill={C.gold} pattern="foil" line={5} />
            <Shape d={circle(x, 1080, 30)} fill={C.gold} pattern="foil" line={5} />
          </g>
        ))}
        <Line d="M230,1110C400,1210 680,1210 850,1110" size={16} color={C.pressure} />
        <g transform="translate(540,1250) rotate(-3)">
          <Shape d={rect(-120, -40, 240, 80, 6)} fill={C.white} line={5} />
          <Txt x={0} y={10} size={26} font={FONT.tag} weight={700}>
            DO NOT TOUCH
          </Txt>
        </g>
        {/* her fingertip, reaching in */}
        <g transform={`translate(${fx},790) rotate(180)`}>
          <Shape d="M-600,-50L-40,-44C0,-44 16,-20 16,0C16,20 0,44 -40,44L-600,50Z" fill={C.preciousSkin} shade="M-600,0L20,0L20,60L-600,60Z" shadeInk="ht-ink-2" line={6} />
          <Shape d="M-30,-30C-10,-30 4,-16 4,0C4,16 -10,30 -30,30Z" fill={C.aqua} line={3.5} />
          <Shape d="M-620,-80L-420,-80L-420,80L-620,80Z" fill={C.hotpink} line={6} />
        </g>
        {spark > 0 && (
          <>
            <Sparkle x={fx - 10} y={800} r={70 * spark} />
            <Line d={`M${fx - 40},740L${fx - 70},700M${fx - 40},860L${fx - 70},900M${fx - 60},800L${fx - 110},800`} size={6} color={C.pressure} />
          </>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 49 - Ring Pop
const RingPop: React.FC = () => (
  <>
    <Shape d={`${ellipse(0, 40, 46, 26)}${ellipse(0, 40, 30, 14)}`} evenodd fill={C.hotpink} line={5} />
    <Shape d="M-56,-10L-30,-60L30,-60L56,-10L0,40Z" fill={C.pressure} shade="M0,-70L70,-70L70,50L0,50Z" shadeInk="ht-ink-2" line={6} />
    <Line d="M-56,-10L56,-10M-30,-60L-12,-10L0,40L12,-10L30,-60" size={3} />
    <Line d="M-30,-44L-16,-24" size={5} color={C.white} />
  </>
);

export const S49: SceneDef = {
  ground: 'blush',
  under: () => <Wash kind="pink" x={540} y={820} s={1500} o={0.6} v={2} />,
  render: (p) => {
    const {f} = p;
    const pose: Pose = {uarmR: -24, farmR: 132, uarmL: 40, farmL: -120, head: 4 * Math.sin(f / 10)};
    const pp = {x: 540, y: 1420, scale: 1.05, rotate: 2 * Math.sin(f / 14)};
    return (
      <>
        <Precious
          place={pp}
          pose={pose}
          style={{shades: true}}
          face={{smile: 0.9, brow: 0.6, browTilt: -0.4}}
          holdR={
            <g transform={`rotate(${-chainAngle(PRECIOUS_PARTS, pose, 'handR')}) translate(40,-40) scale(1.2)`}>
              <RingPop />
            </g>
          }
        />
        <Note x={220} y={1000} size={80} rot={-10} color={C.hotpink}>
          baddie
        </Note>
        {[0, 1, 2].map((i) => (
          <Sparkle key={i} x={[820, 900, 760][i]} y={[760, 900, 1000][i]} r={18 + 8 * Math.sin(f / 3 + i)} />
        ))}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 50 - the lamp
export const S50: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="gold" x={540} y={1000} s={1300} o={0.45} />,
  render: (p) => {
    const {f} = p;
    const hit = hitIn(p);
    const rub = Math.sin(f / 3) * 60;
    const smoke = clamp((f - 10) / (hit - 10));
    const heartT = clamp((f - hit + 8) / 12);
    const puffs = Array.from({length: 7}, (_, i) => {
      const t = clamp(smoke * 1.4 - i * 0.12);
      if (t <= 0) return null;
      const x = 720 + i * 20 + Math.sin(i + f / 10) * 30;
      const y = 1000 - i * 90 * t;
      return <SmokePuff key={i} x={x} y={y} s={160 + i * 40} o={0.85 * (1 - heartT * 0.6)} v={((i % 4) + 1) as 1 | 2 | 3 | 4} />;
    });
    return (
      <>
        <Floor y={1400} fill={C.release} />
        <Shape d={rect(250, 1240, 580, 60, 12)} fill={C.teal} line={6} />
        {puffs}
        {heartT > 0 && (
          <g opacity={heartT}>
            <Flat d={heart(780, 500, 210 * heartT)} fill="url(#smokefill)" />
            <Shape d={heart(780, 500, 210 * heartT)} fill="none" dotted line={9} lineColor={C.ash} />
          </g>
        )}
        {/* the lamp */}
        <g transform="translate(540,1150)">
          <Shape d="M-200,40C-220,-40 -120,-90 0,-90C120,-90 180,-40 200,-10L330,-120L340,-100L230,40C150,90 -150,90 -200,40Z" fill={C.gold} pattern="foil" sheen line={7} />
          <Shape d="M-60,-90C-60,-150 60,-150 60,-90Z" fill={C.gold} pattern="foil" line={6} />
          <Shape d={circle(0, -160, 18)} fill={C.goldHi} line={4} />
          <Shape d="M-200,-10C-280,-40 -300,40 -220,50" fill="none" line={10} lineColor={C.goldLo} />
          <Shape d={rect(-120, 70, 240, 40, 12)} fill={C.goldLo} line={5} />
        </g>
        {/* her hands rubbing */}
        <g transform={`translate(${540 + rub},1020)`}>
          <Shape d="M-80,40C-90,-10 -60,-40 -20,-40L60,-40C90,-36 100,-10 90,20L70,50Z" fill={C.preciousSkin} line={6} />
          <Shape d={rect(-160, -10, 90, 60, 16)} fill={C.hotpink} line={5} />
        </g>
        <Line d={`M${400 + rub},950L${360 + rub},930M${680 + rub},950L${720 + rub},930`} size={5} />
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 51 - money, printed
const Bill: React.FC<{x: number; y: number; r: number}> = ({x, y, r}) => (
  <g transform={`translate(${x},${y}) rotate(${r})`}>
    <Shape d={rect(-80, -40, 160, 80, 6)} fill={C.aqua} shade={rect(0, -40, 80, 80)} shadeInk="ht-teal-1" line={4} />
    <Shape d={`${ellipse(0, 0, 22, 26)}${ellipse(0, 0, 12, 16)}`} evenodd fill={C.gold} line={3} />
    <Txt x={-56} y={-14} size={20} font={FONT.tag} weight={700}>
      $
    </Txt>
  </g>
);

export const S51: SceneDef = {
  ground: 'mint',
  render: (p) => {
    const {f} = p;
    const r = rng(51);
    const bills = Array.from({length: 16}, (_, i) => {
      const born = i * 5;
      const t = f - born;
      if (t < 0) return null;
      const land = 30;
      const k = clamp(t / land);
      const x = lerp(430, 700 + (i % 4) * 40, k) + Math.sin(t / 3 + i) * 20 * (1 - k);
      const y = lerp(860, 1320 - Math.floor(i / 4) * 30, k) - Math.sin(k * Math.PI) * 300;
      return <Bill key={i} x={x} y={y} r={(1 - k) * (r() * 360) + k * (r() * 10 - 5)} />;
    });
    return (
      <>
        <Floor y={1390} fill={C.white} />
        {/* the press */}
        <Shape d={rect(80, 820, 420, 520, 20)} fill={C.hotpink} shade={rect(290, 820, 210, 520)} shadeInk="ht-ink-2" line={7} />
        <g transform={`translate(290,900) rotate(${f * 12})`}>
          <Shape d={circle(0, 0, 120)} fill={C.white} line={6} />
          <Line d="M-110,0L110,0M0,-110L0,110" size={4} />
        </g>
        <Shape d={rect(440, 860, 120, 30, 8)} fill={C.smoke} line={4} />
        <Shape d={rect(120, 1100, 340, 60, 10)} fill={C.gold} pattern="foil" line={5} />
        <Txt x={290} y={1250} size={40} font={FONT.tag} weight={700}>
          RISO
        </Txt>
        {bills}
        <Stein place={{x: 880, y: 1010, scale: 0.66}} pose={{uarmL: 60, farmL: -70, uarmR: -60, farmR: 70}} face={{mouth: p.mouth, smile: 1, eyes: 'happy'}} />
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 52 - a ring in the hut
export const S52: SceneDef = {
  ground: 'blush',
  under: () => <Wash kind="aqua" x={700} y={1100} s={1200} o={0.4} />,
  render: (p) => {
    const {f} = p;
    const inT = clamp(f / 44);
    const x = lerp(140, 520, inT);
    const walk = walkCycle(f, 20, 1);
    const inside = f > 46;
    const glow = clamp((f - 46) / 10);
    const pose: Pose = addPose({uarmR: -60, farmR: -60}, inside ? {} : {thighL: walk.thighL, thighR: walk.thighR, shinL: walk.shinL, shinR: walk.shinR});
    return (
      <>
        <Floor y={1400} fill={C.mint} />
        {/* hut */}
        <Shape d={rect(420, 900, 460, 500, 6)} fill={C.candy} shade={rect(660, 900, 230, 500)} shadeInk="ht-pink-2" line={7} />
        <Shape d="M370,920L650,640L930,920Z" fill={C.teal} line={7} />
        <Shape d={rect(760, 690, 60, 150)} fill={C.hotpink} line={5} />
        <Shape d={rect(700, 1040, 130, 120, 6)} fill={glow > 0 ? C.goldHi : '#3A3150'} line={6} />
        {glow > 0 && <Flat d={circle(765, 1100, 200)} fill="url(#glow-gold)" opacity={glow} />}
        <Shape d={rect(470, 1160, 140, 240, 6)} fill={inside ? '#3A3150' : C.goldLo} line={6} />
        {!inside && (
          <Stein
            place={{x, y: 1000, scale: 0.62}}
            pose={pose}
            face={{mouth: p.mouth, smile: 0.8, turn: 0.5, look: [1, 0]}}
            holdR={<g transform={`rotate(${-chainAngle(STEIN_PARTS, pose, 'handR')}) translate(20,-10)`}><Ring x={0} y={0} r={40} spin={f * 6} glint={0.5} /></g>}
          />
        )}
        {inside && <FloatHearts f={f - 46} x={790} y={680} n={5} seed={52} spread={80} color={C.hotpink} />}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 53 - killer money
export const S53: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="aqua" x={540} y={900} s={1400} o={0.35} />,
  render: (p) => {
    const {f} = p;
    const stacks = [0, 1, 2, 3].map((k) => Math.floor(clamp((f - k * 10) / 60) * 9));
    const hand = (f * 24) % 360;
    return (
      <>
        {/* clock */}
        <Shape d={circle(300, 520, 150)} fill={C.white} line={7} />
        {Array.from({length: 12}, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <Line key={i} d={`M${300 + Math.cos(a) * 120},${520 + Math.sin(a) * 120}L${300 + Math.cos(a) * 138},${520 + Math.sin(a) * 138}`} size={4} />;
        })}
        <Line d={`M300,520L${300 + Math.cos((hand * Math.PI) / 180) * 110},${520 + Math.sin((hand * Math.PI) / 180) * 110}`} size={8} color={C.pressure} />
        <Line d={`M300,520L${300 + Math.cos((hand / 12) * (Math.PI / 180)) * 70},${520 + Math.sin((hand / 12) * (Math.PI / 180)) * 70}`} size={9} />
        {/* desk */}
        <Shape d={rect(80, 1180, 920, 60, 10)} fill={C.goldLo} line={7} />
        <Shape d={rect(120, 1240, 50, 180)} fill={C.goldLo} line={5} />
        <Shape d={rect(910, 1240, 50, 180)} fill={C.goldLo} line={5} />
        <Stein place={{x: 380, y: 1080, scale: 0.72}} pose={{uarmR: -40, farmR: -80, uarmL: 40, farmL: -80, thighL: 80, shinL: -80, thighR: 76, shinR: -76}} face={{mouth: p.mouth, brow: -0.5, browTilt: 0.6, smile: 0.2, look: [1, 0.4], blink: blink(f, 40)}} />
        {stacks.map((n, k) =>
          Array.from({length: n}, (_, j) => (
            <Shape key={`${k}:${j}`} d={rect(560 + k * 100, 1150 - j * 30, 90, 30, 4)} fill={j % 2 ? C.aqua : '#7FC8BE'} line={4} />
          ))
        )}
        {[0, 1].map((k) => (
          <Shape key={k} d={`M${470 + k * 30},${740 + ((f * 3 + k * 20) % 60)}C${460 + k * 30},${760 + ((f * 3 + k * 20) % 60)} ${480 + k * 30},${770 + ((f * 3 + k * 20) % 60)} ${470 + k * 30},${740 + ((f * 3 + k * 20) % 60)}Z`} fill={C.aqua} line={3} />
        ))}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 54 - run around
export const S54: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="pink" x={540} y={1000} s={1400} o={0.4} />,
  render: (p) => {
    const {f} = p;
    const a = f / 7;
    const px = 540 + Math.cos(a) * 330;
    const pz = Math.sin(a);
    const walk = walkCycle(f, 12, 1.3);
    const precious = (
      <Precious
        key="p"
        place={{x: px, y: 1030 + pz * 60, scale: 0.56 + 0.08 * pz, flip: Math.sin(a) < 0}}
        pose={addPose({uarmR: -60, farmR: -40, uarmL: 30}, walk)}
        face={{smile: 1, eyes: 'happy', turn: 0.5}}
      />
    );
    const dizzy = f > p.dur * 0.5;
    return (
      <>
        <Floor y={1400} fill={C.release} />
        <Shape d={ellipse(540, 1330, 360, 80)} fill="none" dotted line={8} lineColor={C.hotpink} />
        {pz < 0 && precious}
        <Stein place={{x: 540, y: 1000, scale: 0.7, flip: Math.cos(a) < 0}} pose={{uarmL: 30, farmL: -40, uarmR: -30, farmR: 40, head: 8 * Math.sin(f / 4)}} face={{eyes: dizzy ? 'closed' : 'dot', smile: 0.6, mouth: p.mouth, turn: Math.cos(a) * 0.6}} />
        {pz >= 0 && precious}
        {dizzy && [0, 1, 2].map((k) => (
          <Sparkle key={k} x={540 + Math.cos(f / 4 + k * 2.1) * 90} y={520 + Math.sin(f / 4 + k * 2.1) * 30} r={20} />
        ))}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 55 - a man, around
export const S55: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="aqua" x={700} y={900} s={1300} o={0.4} />,
  render: (p) => {
    const {f} = p;
    const man = p.w(4);
    const thin = clamp((f - man + 10) / 14);
    const inT = clamp((f - man) / 12);
    const sx = lerp(1250, 720, ease.outCubic(inT));
    return (
      <>
        <Floor y={1400} fill={C.mint} />
        {/* doorway */}
        <Shape d={`${rect(560, 620, 340, 780, 8)}${rect(600, 660, 260, 740)}`} evenodd fill={C.teal} line={7} />
        <Flat d={rect(600, 660, 260, 740)} fill={C.goldHi} opacity={0.35} />
        {thin < 1 && <Smoke place={{x: 730, y: 1040, scale: 0.62}} pose={{uarmL: 10, uarmR: -10}} thin={thin} />}
        {thin > 0 && thin < 1 && <SmokePuff x={730} y={900} s={400 + thin * 300} o={1 - thin} v={1} />}
        {inT > 0 && <Stein place={{x: sx, y: 1040, scale: 0.62}} pose={{uarmR: -30, farmR: -100, uarmL: 10}} face={{mouth: p.mouth, smile: 0.9, brow: 0.6, browTilt: -0.4, turn: -0.3}} />}
        <Precious place={{x: 260, y: 1040, scale: 0.62}} pose={PRECIOUS_POSES.hipHand} face={{smile: f >= man ? 0.9 : 0.5, look: [1, 0], turn: 0.4}} />
        <Bubble x={300} y={560} w={380} h={170} tail={[-20, 150]}>
          <Txt x={300} y={580} size={52} font={FONT.hand}>
            a man around...
          </Txt>
        </Bubble>
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 56 - the throw
export const S56: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="pink" x={540} y={900} s={1500} o={0.45} />,
  camera: (p) => {
    const land = hitIn(p);
    const shake = p.f >= land && p.f < land + 10 ? Math.sin(p.f * 5) * 14 * (1 - (p.f - land) / 10) : 0;
    return {x: shake, zoom: 1 + 0.05 * clamp((p.f - land) / 6) * (1 - clamp((p.f - land - 10) / 20))};
  },
  render: (p) => {
    const {f} = p;
    const land = hitIn(p);
    const grab = land - 60;
    const t = clamp((f - grab) / (land - grab));
    const flying = f >= grab && f < land;
    const k = ease.inOutSine(t);
    const sx = f < grab ? 700 : f < land ? lerp(700, 330, k) : 330;
    const sy = f < grab ? 1000 : f < land ? 1000 - Math.sin(k * Math.PI) * 560 : 1260;
    const rot = f < grab ? 0 : f < land ? -210 * k : -270;
    const pPose: Pose = f < grab ? {uarmL: 60, farmL: -100, uarmR: -60, farmR: 100} : {uarmR: -150, farmR: -20, uarmL: 120, farmL: 20, torso: -14};
    const octagon = poly(Array.from({length: 8}, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      return [540 + Math.cos(a) * 560, 1300 + Math.sin(a) * 190] as [number, number];
    }));
    const pow = f >= land ? ease.outBack(clamp((f - land) / 5)) * (1 - clamp((f - land - 24) / 10)) : 0;
    return (
      <>
        {/* the paper octagon */}
        <Shape d={octagon} fill={C.white} shade={octagon} shadeInk="ht-ink-1" line={7} />
        <Line d="M-20,760L1100,760M-20,820L1100,820" size={6} color={C.teal} />
        {[40, 300, 780, 1040].map((x) => (
          <Shape key={x} d={rect(x - 14, 700, 28, 460, 8)} fill={C.teal} line={5} />
        ))}
        <Precious place={{x: 520, y: 1040, scale: 0.7}} pose={pPose} style={{gloves: true}} face={{smile: 0.8, brow: -0.4, browTilt: -0.8, look: [-1, -0.3], turn: -0.3}} />
        <Stein place={{x: sx, y: sy, scale: 0.7, rotate: rot}} pose={flying ? {uarmL: 150, uarmR: -150, thighL: -20, thighR: 30} : f < grab ? {uarmR: -40, farmR: -100} : {uarmL: 120, uarmR: -120}} face={{eyes: flying ? 'wide' : f >= land ? 'happy' : 'dot', mouth: flying ? 0.7 : 0.3, smile: 0.6}} />
        {flying && <MotionLines x={sx + 120} y={sy - 60} n={3} len={140} dir={1} />}
        {pow > 0 && (
          <g transform={`translate(330,1150) scale(${pow})`}>
            <Shape d={poly(Array.from({length: 24}, (_, i) => { const a = (i / 24) * Math.PI * 2; const r = i % 2 ? 110 : 220; return [Math.cos(a) * r * 1.3, Math.sin(a) * r * 0.8] as [number, number]; }))} fill={C.goldHi} line={7} />
            <Txt x={0} y={30} size={110} font={FONT.stamp} color={C.pressure}>
              POW
            </Txt>
          </g>
        )}
      </>
    );
  },
};

export const PRESSURE: Record<number, SceneDef> = {
  40: S40,
  41: S41,
  42: S42,
  43: S43,
  44: S44,
  45: S45,
  46: S46,
  47: S47,
  48: S48,
  49: S49,
  50: S50,
  51: S51,
  52: S52,
  53: S53,
  54: S54,
  55: S55,
  56: S56,
};

void worldPoint;
void STEIN_POSES;
void Line;
void lerp;
