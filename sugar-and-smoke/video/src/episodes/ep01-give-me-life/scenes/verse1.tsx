// Verse 1, part one: No. 01-11 and the title. Memory: off-register pastel, smoke wipes.
import React from 'react';
import {C, FONT} from '../../../brand/tokens';
import {Biscuit, trot} from '../../../characters/Biscuit';
import {Precious, PRECIOUS_POSES} from '../../../characters/Precious';
import {Ring} from '../../../characters/Ring';
import {chainAngle, walkCycle, worldPoint, addPose, poseAt, Pose} from '../../../lib/rig';
import {Stein, STEIN_PARTS, STEIN_POSES} from '../../../characters/Stein';
import {clamp, ease, keys, lerp, prog, swing} from '../../../lib/ease';
import {Flat, Line, Shape, Txt} from '../../../lib/print';
import {rng} from '../../../lib/random';
import {
  Arrow,
  Bubble,
  circle,
  Clip,
  ellipse,
  Floor,
  FloatHearts,
  heart,
  MotionLines,
  Moon,
  Note,
  Palm,
  Phone,
  Polaroid,
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

// A little polaroid of her (used in several scenes).
export const MiniPolaroid: React.FC<{w?: number; smile?: number}> = ({w = 170, smile = 0.8}) => (
  <Polaroid w={w} h={w * 1.2} photo={C.blush}>
    <Precious place={{x: 0, y: w * 0.62, scale: w / 560}} pose={PRECIOUS_POSES.stand} face={{smile}} />
  </Polaroid>
);

// ---------------------------------------------------------------- No. 01
export const S01: SceneDef = {
  ground: 'blush',
  under: () => (
    <>
      <Wash kind="pink" x={360} y={640} s={1500} o={0.7} />
      <Wash kind="aqua" x={800} y={1320} s={1250} o={0.55} v={2} />
    </>
  ),
  camera: (p) => ({zoom: 1 + 0.07 * prog(p.f, 0, p.dur, ease.inOutSine), y: 20 * prog(p.f, 0, p.dur)}),
  render: (p) => {
    const {f} = p;
    const dev = clamp((f - 8) / 70);
    const smile = keys(f, [[0, 0.05], [p.w(3) - 4, 0.1], [p.w(3) + 10, 0.95]]);
    const a = -4 + swing(f, 7, 64, 60) + 1.2 * Math.sin(f / 40);
    const glint = clamp((f - p.w(4)) / 6) * (1 - clamp((f - p.w(4) - 30) / 20));
    const capT = clamp((f - p.w(4) - 14) / 22);
    return (
      <>
        <Line d="M-60,300C300,370 780,370 1140,300" size={4.5} />
        <g transform={`translate(540,352) rotate(${a})`}>
          <g transform="translate(0,420)">
            <Polaroid w={620} h={760} photo={C.mint}>
              <g opacity={dev}>
                <Wash kind="pink" x={-60} y={-80} s={700} o={0.75} />
                <Precious
                  place={{x: 0, y: 420, scale: 0.95}}
                  pose={{...PRECIOUS_POSES.stand, head: 3 * Math.sin(f / 30)}}
                  face={{smile, blink: blink(f, 83), blush: 0.5 + 0.4 * glint, look: [0.1, 0]}}
                />
              </g>
              <Flat d={rect(-300, -340, 600, 600)} fill={C.cotton} opacity={(1 - dev) * 0.85} />
            </Polaroid>
            <Sparkle x={150} y={-150} r={70 * glint} o={glint} />
            <Sparkle x={-170} y={40} r={36 * glint} o={glint} />
            <g opacity={capT}>
              <Note x={-40} y={330} size={64} rot={-3}>
                her smile
              </Note>
              <Shape d={heart(150, 312, 22 * ease.outBack(capT))} fill={C.hotpink} line={3.5} />
            </g>
          </g>
          <Shape d={rect(-20, -40, 40, 84, 8)} fill={C.teal} line={5} />
          <Line d="M-8,-30L-8,36" size={3} />
        </g>
        <FloatHearts f={f} x={540} y={520} n={6} seed={11} start={p.w(4)} spread={420} />
        <SmokePuff x={120 + f * 0.4} y={1640} s={520} o={0.35} v={3} />
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 02
export const S02: SceneDef = {
  ground: 'night',
  camera: (p) => ({zoom: 1.02 + 0.03 * prog(p.f, 0, p.dur, ease.inOutSine), x: -10 * prog(p.f, 0, p.dur)}),
  render: (p) => {
    const {f} = p;
    const win = rect(600, 230, 380, 470, 12);
    const pose: Pose = {...STEIN_POSES.sit, ...STEIN_POSES.holdFront, torso: -3, head: 9};
    const place = {x: 560, y: 1150, scale: 0.72};
    const handR = worldPoint(STEIN_PARTS, pose, place, 'handR', [0, 40]);
    const heartT = f - p.w(0);
    const hy = handR[1] - 120 - Math.max(0, heartT) * 2.6;
    const hs = 40 + clamp(heartT / 40) * 50;
    const popT = f - p.w(4);
    return (
      <>
        {/* window with the moon */}
        <Shape d={win} fill="#3A3150" line={7} />
        <Clip d={win}>
          <Moon x={840} y={390} r={80} />
          <Stars f={f} n={9} seed={5} y0={250} y1={680} />
        </Clip>
        <Line d="M790,230L790,700M600,465L980,465" size={6} />
        <Shape d="M570,700L1010,700L1000,730L580,730Z" fill={C.white} line={5} />
        {/* lamp */}
        <Flat d={circle(170, 760, 260)} fill="url(#glow-gold)" opacity={0.55} />
        <Shape d="M90,700L250,700L220,600L120,600Z" fill={C.goldHi} line={5} />
        <Shape d="M160,700L180,700L180,880L160,880Z" fill={C.goldLo} line={4} />
        <Shape d={rect(60, 880, 240, 460, 8)} fill={C.teal} line={6} />
        <Line d="M60,1000L300,1000M60,1140L300,1140" size={4} />
        {/* bed */}
        <Shape d={rect(250, 820, 60, 540, 14)} fill={C.hotpink} line={6} />
        <Shape d="M300,1120C500,1100 800,1100 1000,1120L1010,1330L300,1330Z" fill={C.white} line={6} />
        <Shape d="M420,1110C560,1080 820,1080 1010,1110L1010,1250C800,1230 600,1240 430,1260Z" fill={C.candy} shade="M430,1180L1010,1180L1010,1260L430,1260Z" shadeInk="ht-pink-2" line={6} />
        <Shape d="M300,1050C360,1000 440,1010 470,1060C450,1110 360,1120 300,1100Z" fill={C.white} line={5} />
        <Stein
          place={place}
          pose={pose}
          face={{smile: 0.25 + 0.3 * clamp(heartT / 30), look: [0, 0.9], blink: blink(f, 71), brow: 0.2, browTilt: 0.6}}
          holdR={
            <g transform={`rotate(${-chainAngle(STEIN_PARTS, pose, 'handR')}) translate(-60,30)`}>
              <MiniPolaroid w={150} smile={0.9} />
            </g>
          }
        />
        {heartT > 0 && popT < 6 && (
          <Line d={heart(handR[0] - 60, hy, hs)} size={7} color={C.candy} />
        )}
        {popT >= 0 && <FloatHearts f={popT} x={handR[0] - 60} y={handR[1] - 330} n={7} seed={22} spread={260} />}
        {popT >= 0 && popT < 12 && <Sparkle x={handR[0] - 60} y={handR[1] - 330} r={60 * (1 - popT / 12)} />}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 03
export const S03: SceneDef = {
  ground: 'blush',
  under: () => <Wash kind="pink" x={540} y={900} s={1700} o={0.55} />,
  camera: (p) => {
    const h = keys(p.f, [[0, 0], [10, 60], [44, 560], [80, 650], [105, 670]]);
    return {y: h * 0.8};
  },
  render: (p) => {
    const {f} = p;
    const h = keys(f, [[0, 0], [10, 60], [44, 560], [80, 650], [105, 670]]);
    const sheetH = 26;
    const n = Math.floor(h / sheetH);
    const cols = [C.white, C.candy, C.mint, C.goldHi, C.aqua];
    const up = f >= p.w(4);
    const pose = up
      ? poseAt(f - p.w(4), [[0, {...STEIN_POSES.stand, uarmL: 20, uarmR: -20}], [8, STEIN_POSES.armsUp]])
      : {...STEIN_POSES.stand, uarmL: 34, uarmR: -34, farmL: -20, farmR: 20};
    const top = 1420 - n * sheetH;
    return (
      <>
        {/* clouds passing */}
        {[0, 1, 2].map((i) => (
          <Shape key={i} d={smooth([[0, 0], [60, -50], [150, -40], [210, 10], [150, 40], [40, 40]].map(([x, y]) => [x + 80 + i * 330, y + 700 - i * 520] as [number, number]))} fill={C.white} shade={rect(40 + i * 330, 720 - i * 520, 300, 60)} shadeInk="ht-pink-1" line={5} />
        ))}
        {/* ruler on the wall */}
        <Shape d={rect(880, -900, 90, 2320)} fill={C.goldHi} line={5} />
        {Array.from({length: 40}, (_, i) => (
          <Line key={i} d={`M880,${1400 - i * 60}L${i % 2 ? 912 : 936},${1400 - i * 60}`} size={4} />
        ))}
        {Array.from({length: 20}, (_, i) => (
          <Txt key={`n${i}`} x={945} y={1410 - i * 120} size={30} font={FONT.tag} anchor="start">
            {i}
          </Txt>
        ))}
        <Floor y={1420} fill={C.candy} />
        {Array.from({length: n}, (_, i) => (
          <Shape key={i} d={rect(330 + ((i * 37) % 23) - 11, 1420 - (i + 1) * sheetH, 420, sheetH + 2, 3)} fill={cols[i % cols.length]} line={4} shadow={i === n - 1} />
        ))}
        <Stein place={{x: 540, y: top - 436, scale: 0.8}} pose={pose} face={{smile: up ? 1 : 0.5, mouth: p.mouth, eyes: up ? 'happy' : 'dot', brow: up ? 0.8 : 0.3}} />
        {up && (
          <>
            <Pop f={f} at={p.w(4)} x={360} y={top - 700}>
              <Sparkle x={360} y={top - 700} r={46} />
            </Pop>
            <Pop f={f} at={p.w(4) + 4} x={740} y={top - 820}>
              <Sparkle x={740} y={top - 820} r={34} />
            </Pop>
          </>
        )}
        <Arrow d={`M200,${1100 - h * 0.6}L200,${860 - h * 0.6}`} head={[200, 860 - h * 0.6, -90]} size={7} />
        <Note x={200} y={1170 - h * 0.6} size={50}>
          up
        </Note>
      </>
    );
  },
};

// ---------------------------------------------------------------- Title (instrumental)
export const Title: SceneDef = {
  ground: 'cotton',
  under: () => (
    <>
      <Wash kind="pink" x={300} y={640} s={1300} o={0.6} />
      <Wash kind="aqua" x={820} y={1260} s={1250} o={0.55} />
    </>
  ),
  render: (p) => {
    const {f} = p;
    const s = ease.outBack(clamp(f / 14));
    const ghost = 10 + 36 * (1 - ease.outCubic(clamp(f / 12)));
    const typed = 'give me life'.slice(0, Math.floor(clamp((f - 22) / 34) * 12));
    const rx = -150 + (f / p.dur) * 1400;
    return (
      <>
        <g transform={`translate(540,860) scale(${s}) translate(-540,-860)`}>
          <Txt x={540 + ghost} y={860 + ghost * 0.7} size={200} font={FONT.lyric} weight={800} color={C.hotpink} spacing={-6} opacity={0.9}>
            mbastein
          </Txt>
          <Txt x={540} y={860} size={200} font={FONT.lyric} weight={800} color="url(#foil)" spacing={-6} stroke={C.goldLo} strokeWidth={5}>
            mbastein
          </Txt>
        </g>
        <Txt x={540} y={1010} size={96} font={FONT.lyric} weight={700}>
          {typed}
        </Txt>
        <Txt x={540} y={1110} size={30} font={FONT.tag} weight={700} spacing={4} opacity={clamp((f - 50) / 12)}>
          SUGAR &amp; SMOKE · NO. 1
        </Txt>
        <Ring x={rx} y={1330 - Math.abs(Math.sin(f / 7)) * 24} r={70} tilt={f * 9} glint={0.6 + 0.4 * Math.sin(f / 4)} />
        {[1, 2, 3].map((k) => (
          <Sparkle key={k} x={rx - k * 90} y={1300 - (k % 2) * 40} r={16 + 6 * Math.sin(f / 3 + k)} o={Math.max(0, 1 - k * 0.28)} />
        ))}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 04
export const S04: SceneDef = {
  ground: 'blush',
  under: () => <Wash kind="aqua" x={780} y={700} s={1200} o={0.45} />,
  render: (p) => {
    const {f} = p;
    const release = p.w(2); // "think"
    const shut = release + 14;
    const reopen = p.w(8);
    const open = f < release + 4 ? 1 : f < reopen ? 1 - ease.outCubic(clamp((f - release - 4) / 10)) : 0.55 * ease.outBack(clamp((f - reopen) / 14));
    const pose: Pose = poseAt(f, [
      [0, {...STEIN_POSES.stand, uarmR: -70, farmR: -70, head: 5}],
      [release - 6, {...STEIN_POSES.stand, uarmR: -58, farmR: -30}],
      [shut, {...STEIN_POSES.stand, uarmR: -84, farmR: -8}],
      [shut + 12, {uarmL: 42, farmL: -118, uarmR: -42, farmR: 118, head: -6, torso: -3}],
    ]);
    const place = {x: 320, y: 930, scale: 0.84};
    const handR = worldPoint(STEIN_PARTS, pose, place, 'handR', [0, 40]);
    const holding = f < release;
    const dropT = clamp((f - release) / 8);
    const px = lerp(handR[0], 800, dropT);
    const py = lerp(handR[1], 1060, ease.inQuad(dropT));
    const lookBack = f >= reopen + 6;
    const smug = f > shut + 6 && !lookBack;
    return (
      <>
        <Floor y={1360} fill={C.candy} />
        {/* nightstand */}
        <Shape d={rect(640, 980, 330, 400, 10)} fill={C.white} line={6} />
        <Shape d={rect(655, 1020 + open * 60, 300, 50 * open + 1)} fill="#3A3150" line={false} shadow={false} />
        {!holding && open > 0.2 && f < reopen && (
          <g transform={`translate(${px},${py}) rotate(${-10 + dropT * 18})`}>
            <MiniPolaroid w={120} />
          </g>
        )}
        {f >= reopen && (
          <>
            <Flat d={ellipse(805, 1030, 200, 90)} fill="url(#glow-pink)" opacity={open} />
            <FloatHearts f={f - reopen} x={805} y={1010} n={5} seed={4} spread={200} />
          </>
        )}
        <Shape d={rect(650, 1020 + open * 60, 310, 130, 8)} fill={C.teal} line={6} />
        <Shape d={rect(775, 1070 + open * 60, 60, 22, 10)} fill={C.goldHi} line={4} />
        <Shape d={rect(650, 1170, 310, 180, 8)} fill={C.teal} line={6} />
        <Shape d={rect(775, 1245, 60, 22, 10)} fill={C.goldHi} line={4} />
        {holding && (
          <g transform={`translate(${handR[0]},${handR[1] - 70}) rotate(-8)`}>
            <MiniPolaroid w={130} />
          </g>
        )}
        {!holding && f < release + 8 && (
          <g transform={`translate(${px},${py}) rotate(${-10 + dropT * 18})`}>
            <MiniPolaroid w={120} />
          </g>
        )}
        <Stein
          place={place}
          pose={pose}
          face={{
            mouth: p.mouth * 0.8,
            eyes: smug ? 'happy' : 'dot',
            smile: smug ? 0.6 : 0.2,
            look: lookBack ? [1, 0] : holding ? [0.6, -0.4] : [0, 0],
            brow: lookBack ? 0.9 : 0.2,
            turn: lookBack ? 0.5 : smug ? -0.4 : 0.2,
          }}
        />
        {smug && f < reopen && <Note x={560} y={560} size={60} rot={-6}>not thinking about it.</Note>}
        {lookBack && <Note x={560} y={600} size={80} rot={6} color={C.hotpink}>...</Note>}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 05
export const S05: SceneDef = {
  ground: 'mint',
  camera: (p) => ({zoom: 1 + 0.04 * prog(p.f, 0, p.dur), rotate: -2}),
  render: (p) => {
    const {f} = p;
    const never = p.w(5);
    const failed = p.w(8);
    const ringing = f < never;
    const status = f < never ? 'calling...' : f < failed ? 'no answer' : 'call failed';
    const arcs = [];
    for (let k = 0; k < 8; k++) {
      const born = k * 16;
      const age = f - born;
      if (age < 0 || age > 36 || born > never) continue;
      const r = 60 + age * 7;
      const smoky = age > 12;
      arcs.push(
        <Shape
          key={k}
          d={`M${540 - r},${400 - r * 0.2}Q540,${400 - r * 1.1} ${540 + r},${400 - r * 0.2}`}
          fill="none"
          line={smoky ? 7 : 8}
          dotted={smoky}
          opacity={1 - age / 36}
        />
      );
    }
    const grey = clamp((f - never) / 10);
    return (
      <>
        {arcs}
        {[0, 1, 2].map((k) => (
          <Shape key={k} d={`M790,${1020 + k * 86}C830,${1000 + k * 86} 860,${1030 + k * 86} 846,${1070 + k * 86}C830,${1090 + k * 86} 800,${1086 + k * 86} 780,${1070 + k * 86}Z`} fill={C.steinSkin} line={5} />
        ))}
        <g transform="translate(540,960) scale(1.22)">
          <Phone w={420} h={820} screen={C.white}>
            <Flat d={rect(-200, -340, 400, 680)} fill={C.mint} opacity={0.5} />
            <Txt x={0} y={-230} size={34} font={FONT.tag} weight={700} color={f < never ? C.ink : C.ash}>
              {status}
            </Txt>
            <Shape d={circle(0, -60, 110)} fill={grey > 0.5 ? C.smoke : C.candy} line={5} />
            <Shape d={heart(0, -64, 56)} fill={grey > 0.5 ? C.white : C.hotpink} line={4} opacity={1 - grey * 0.5} />
            {grey > 0 && <Flat d={circle(0, -60, 110)} fill="url(#ht-smoke-2)" opacity={grey} />}
            <Txt x={0} y={110} size={60} font={FONT.lyric} weight={800} color={grey > 0.5 ? C.ash : C.ink}>
              Precious
            </Txt>
            <Shape d={circle(0, 270, 50)} fill={ringing ? C.pressure : C.smoke} line={5} />
            <Line d="M-22,262C-10,250 10,250 22,262" size={7} color={C.white} />
          </Phone>
        </g>
        {/* Stein's hand holding the phone: thumb over the left edge */}
        <g transform="translate(250,1290) rotate(-12)">
          <Shape d="M-60,-60C-40,-110 30,-120 60,-80C70,-40 64,20 40,60L10,80C-30,60 -70,20 -60,-60Z" fill={C.steinSkin} shade="M20,-120L80,-120L80,90L20,90Z" shadeInk="ht-ink-2" />
          <Shape d="M-40,40C0,20 60,40 90,80L110,330L-140,330L-120,110Z" fill={C.steinSkin} />
          <Shape d="M-170,200L150,200L170,460L-170,460Z" fill={C.teal} line={6} />
          <Line d="M-20,-60C0,-80 30,-78 40,-54" size={4} />
        </g>
        {!ringing && <SmokePuff x={540 + (f - never) * 2} y={380 - (f - never) * 1.5} s={420 + (f - never) * 4} o={0.8 * (1 - clamp((f - never) / 60))} v={2} />}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 06
export const S06: SceneDef = {
  ground: 'cotton',
  render: (p) => {
    const {f} = p;
    const b1 = lerp(250, 1350, ease.inCubic(clamp((f - 4) / 42)));
    const b2 = lerp(560, 1450, ease.inCubic(clamp(f / 38)));
    return (
      <>
        <Shape d={rect(-40, 1240, 1160, 700)} fill={C.candy} line={5} shadow={false} />
        <Shape d={rect(360, 420, 360, 440, 4)} fill={C.white} dotted line={7} shadow={false} />
        <Flat d={circle(540, 400, 9)} fill={C.ink} />
        <Line d="M430,420L540,400L650,420" size={3} opacity={0.5} />
        <Note x={540} y={680} size={60} color={C.ash}>
          (moved)
        </Note>
        {[{x: b2, y: 1030, w: 300, h: 250}, {x: b1, y: 1090, w: 380, h: 300}].map((b, i) => (
          <g key={i} transform={`translate(${b.x},${b.y}) rotate(${Math.sin((f + i * 9) / 3) * 1.5})`}>
            <Shape d={rect(-b.w / 2, -b.h / 2, b.w, b.h, 6)} fill={C.release} shade={rect(b.w * 0.1, -b.h / 2, b.w, b.h)} shadeInk="ht-gold-2" line={6} />
            <Shape d={rect(-b.w / 2, -b.h / 2 - 2, b.w, 40)} fill={C.candy} line={4} />
            <Txt x={0} y={30} size={44} font={FONT.hand} rotate={-4}>
              {i === 1 ? 'fragile' : 'her things'}
            </Txt>
            <SmokePuff x={-b.w / 2 - 120} y={b.h / 2 - 40} s={320} o={0.55} v={((i + 1) as 1 | 2)} />
          </g>
        ))}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 07
export const S07: SceneDef = {
  ground: 'night',
  render: (p) => {
    const {f} = p;
    const odd = p.beatN % 2 === 1;
    const b = p.beat;
    const dance: Pose = odd
      ? {uarmL: 150, farmL: 30, uarmR: -40, farmR: 110, pelvis: 6, torso: -8, head: -6}
      : {uarmR: -150, farmR: -30, uarmL: 40, farmL: -110, pelvis: -6, torso: 8, head: 6};
    const r = rng(7);
    const spots = Array.from({length: 11}, (_, i) => {
      const ph = r() * 6.28;
      const x = 540 + Math.cos(f / 22 + ph) * (300 + r() * 200);
      const y = 900 + Math.sin(f / 17 + ph * 1.3) * (500 + r() * 200);
      return <Flat key={i} d={ellipse(x, y, 60 + r() * 50, 40 + r() * 30)} fill={[C.candy, C.aqua, C.goldHi][i % 3]} opacity={0.5} />;
    });
    const tiles = [];
    for (let row = -3; row <= 3; row++) {
      for (let col = -4; col <= 4; col++) {
        const x = col * 34 + ((f * 3) % 34);
        const y = row * 34;
        if (x * x + y * y > 118 * 118) continue;
        tiles.push(<Flat key={`${row}:${col}`} d={rect(540 + x - 15, 330 + y - 15, 30, 30, 3)} fill={[C.white, C.aqua, C.candy, C.goldHi][(row + col + 40) % 4]} />);
      }
    }
    return (
      <>
        {spots}
        <Line d="M540,0L540,210" size={4} />
        <Shape d={circle(540, 330, 122)} fill="#4B4162" line={6} />
        {tiles}
        <Line d={`M418,330L662,330M540,208C480,260 480,400 540,452M540,208C600,260 600,400 540,452`} size={3} />
        <Floor y={1390} fill="#3A3150" />
        <Precious place={{x: 560, y: 1080 - b * 14, scale: 0.8}} pose={dance} face={{smile: 0.9, eyes: 'happy', mouth: 0.2 + 0.3 * b}} />
        <g transform={`translate(190,1340) rotate(${f * 6})`}>
          <Shape d={ellipse(0, 0, 120, 120)} fill="#171221" line={5} />
          <Shape d={ellipse(0, 0, 40, 40)} fill={C.candy} line={4} />
          <Line d="M-90,-30C-60,-80 0,-100 40,-94" size={3} color={C.cotton} opacity={0.6} />
        </g>
        {[0, 1, 2].map((i) => {
          const t = (f + i * 22) % 66;
          return <Txt key={i} x={220 + i * 40 + Math.sin(t / 6) * 20} y={1180 - t * 7} size={64} font={FONT.lyric} color={[C.candy, C.aqua, C.goldHi][i]} opacity={1 - t / 66}>♪</Txt>;
        })}
      </>
    );
  },
};

// A plain, simplified California outline in a 600x900 box.
const CA: [number, number][] = [
  [30, 0], [300, 0], [300, 330], [600, 690], [592, 770], [560, 900], [340, 890], [290, 820], [230, 780], [150, 700], [110, 600], [70, 470], [36, 380], [8, 290], [0, 170], [14, 80],
];

// ---------------------------------------------------------------- No. 08
export const S08: SceneDef = {
  ground: 'mint',
  render: (p) => {
    const {f} = p;
    const unfold = ease.outCubic(clamp(f / 14));
    const mw = 700 * (0.34 + 0.66 * unfold);
    const mapX = 540 - mw / 2;
    const scaleX = mw / 700;
    const pinT = p.w(4);
    const route = smooth([[150, 300], [180, 450], [230, 600], [300, 760], [380, 840]], false);
    const routeP = clamp((f - 6) / (pinT - 6));
    const ca = CA.map(([x, y]) => [x * 0.9 + 60, y * 0.9 + 60] as [number, number]);
    return (
      <>
        <g transform={`translate(${mapX},470) scale(${scaleX},1)`}>
          <Shape d={rect(0, 0, 700, 940, 6)} fill={C.white} line={6} />
          <Clip d={rect(0, 0, 700, 940)}>
            <Flat d={rect(0, 0, 700, 940)} fill={C.aqua} opacity={0.75} />
            <Shape d={smooth(ca, true, 0.3)} fill={C.release} shade={rect(400, 0, 400, 940)} shadeInk="ht-gold-1" line={5} />
            <Txt x={520} y={120} size={34} font={FONT.tag} weight={700} rotate={-6}>
              CALIF.
            </Txt>
          </Clip>
          {/* fold creases */}
          <Line d="M233,0L233,940M466,0L466,940" size={3} opacity={0.4} />
          {unfold < 1 && <Flat d={rect(233, 0, 233, 940)} fill="url(#ht-ink-2)" opacity={1 - unfold} />}
        </g>
        {unfold > 0.9 && (
          <g transform="translate(250,470)">
            <Clip d={rect(-10, -10, 700 * routeP + 40, 960)}>
              <Shape d={route} fill="none" dotted line={9} lineColor={C.hotpink} />
            </Clip>
            <Shape d={circle(150, 300, 12)} fill={C.ink} line={3} />
            <Txt x={150} y={270} size={40} font={FONT.hand}>
              you
            </Txt>
            {f >= pinT && (
              <g transform={`translate(380,${840 - 120 * (1 - ease.outBack(clamp((f - pinT) / 8)))})`}>
                <Shape d="M0,0C-30,-40 -44,-70 -44,-96C-44,-124 -22,-144 0,-144C22,-144 44,-124 44,-96C44,-70 30,-40 0,0Z" fill={C.gold} pattern="foil" sheen line={5} />
                <Shape d={circle(0, -98, 16)} fill={C.white} line={3} />
              </g>
            )}
            {f >= pinT + 6 && (
              <>
                <Pop f={f} at={pinT + 6} x={300} y={900}>
                  <Palm x={300} y={900} s={0.34} sway={Math.sin(f / 10) * 5} />
                </Pop>
                <Pop f={f} at={pinT + 10} x={470} y={880}>
                  <Palm x={470} y={880} s={0.28} sway={Math.sin(f / 9 + 1) * 5} />
                </Pop>
              </>
            )}
          </g>
        )}
        <Pop f={f} at={pinT + 4} x={880} y={330}>
          <Shape d={circle(880, 330, 70)} fill={C.goldHi} line={5} />
          <Line d={Array.from({length: 12}, (_, i) => { const a = (i / 12) * Math.PI * 2; return `M${880 + Math.cos(a) * 90},${330 + Math.sin(a) * 90}L${880 + Math.cos(a) * 124},${330 + Math.sin(a) * 124}`; }).join('')} size={6} color={C.gold} />
        </Pop>
        {f >= pinT + 8 && (
          <>
            <Note x={330} y={400} size={70} rot={-6} color={C.hotpink}>
              SoCal
            </Note>
            <Arrow d="M420,420C520,470 560,560 600,640" head={[600, 640, 60]} size={6} color={C.hotpink} />
          </>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 09
export const S09: SceneDef = {
  ground: 'cotton',
  camera: (p) => ({zoom: 1.02 + 0.05 * prog(p.f, 0, p.dur), rotate: 2}),
  render: (p) => {
    const {f} = p;
    const man = p.w(5);
    const knew = p.w(7);
    const scroll = keys(f, [[0, 420], [man - 6, 0]], ease.outCubic);
    const drift = Math.sin(f / 12) * 12;
    return (
      <>
        <g transform="translate(540,900) scale(1.18)">
          <Phone w={440} h={860} screen={C.white}>
            <g transform={`translate(0,${-scroll})`}>
              {/* the post above */}
              <Flat d={rect(-200, -820, 400, 380, 12)} fill={C.aqua} opacity={0.6} />
              <Flat d={rect(-200, -380, 400, 60, 8)} fill={C.smoke} opacity={0.5} />
              {/* the photo */}
              <Clip d={rect(-198, -300, 396, 520, 14)}>
                <Flat d={rect(-200, -300, 400, 260)} fill={C.candy} />
                <Flat d={rect(-200, -120, 400, 120)} fill={C.goldHi} />
                <Shape d={circle(80, -110, 60)} fill={C.gold} line={4} />
                <Shape d="M-200,-20C-100,-40 100,-10 200,-30L200,220L-200,220Z" fill={C.aqua} shade="M-200,60L200,60L200,220L-200,220Z" shadeInk="ht-teal-1" line={4} />
                <Shape d="M-200,120C-80,100 100,110 200,100L200,220L-200,220Z" fill={C.release} line={4} />
                <Palm x={-150} y={170} s={0.36} sway={Math.sin(f / 9) * 5} />
                <Precious place={{x: -10, y: 120, scale: 0.26}} pose={{...PRECIOUS_POSES.stand, uarmR: -30}} face={{smile: 0.9}} />
                <Smoke_ x={90 + drift} y={120} />
              </Clip>
              <Shape d={heart(-160, 260, 22)} fill={f > man ? C.hotpink : C.white} line={4} />
              <Line d="M-120,262L120,262" size={4} opacity={0.35} />
            </g>
          </Phone>
        </g>
        {/* thumb */}
        <g transform={`translate(820,${1360 - Math.min(0, scroll * 0)}) rotate(-24)`}>
          <Shape d="M-60,0C-70,-120 -40,-200 10,-210C60,-212 80,-160 70,-60L60,200L-70,200Z" fill={C.steinSkin} shade="M20,-220L90,-220L90,200L20,200Z" shadeInk="ht-ink-2" />
          <Shape d="M-30,-180C-20,-206 30,-208 40,-176C30,-160 -20,-160 -30,-180Z" fill="#9C6A52" line={3} />
        </g>
        {f >= knew && (
          <>
            <Pop f={f} at={knew} x={200} y={420}>
              <Note x={200} y={440} size={150} rot={-10} color={C.pressure}>
                !!
              </Note>
            </Pop>
            <Note x={250} y={560} size={48} rot={-6}>
              knew it.
            </Note>
          </>
        )}
      </>
    );
  },
};

// Tiny Smoke for inside photos (import-cycle free).
import {Smoke} from '../../../characters/Stein';
const Smoke_: React.FC<{x: number; y: number}> = ({x, y}) => <Smoke place={{x, y, scale: 0.25}} pose={{uarmR: -120, farmR: -40, uarmL: 10}} />;

// ---------------------------------------------------------------- No. 10
export const S10: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="aqua" x={540} y={1000} s={1500} o={0.35} />,
  render: (p) => {
    const {f} = p;
    const diff = p.w(8);
    const walking = f < diff - 4;
    const x = walking ? lerp(180, 600, clamp(f / (diff - 4))) : 600;
    const hopT = clamp((f - 30) / 12);
    const hop = Math.sin(Math.PI * hopT) * 50;
    const pose: Pose = walking ? addPose(STEIN_POSES.stand, walkCycle(f, 20, 1.1)) : {...STEIN_POSES.stand, uarmR: -24, farmR: -100, head: -4};
    const peelX = lerp(1100, 560, ease.outCubic(clamp((f - 8) / 18)));
    return (
      <>
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(${170 + i * 250},860)`}>
            <Shape d={circle(0, 0, 60)} fill={C.smoke} dotted line={7} />
            <Shape d={rect(-80, 70, 160, 330, 50)} fill={C.smoke} dotted line={7} />
            <Shape d={rect(-60, 390, 50, 190, 20)} fill={C.smoke} dotted line={7} />
            <Shape d={rect(10, 390, 50, 190, 20)} fill={C.smoke} dotted line={7} />
          </g>
        ))}
        <Floor y={1400} fill={C.mint} />
        <g transform={`translate(${peelX},1382) rotate(${-8 + Math.sin(f / 4) * 3})`}>
          <Shape d="M-70,10C-60,-30 -20,-40 0,-10C20,-40 60,-30 70,10C40,0 20,4 0,14C-20,4 -40,0 -70,10Z" fill={C.goldHi} shade="M0,-40L80,-40L80,20L0,20Z" shadeInk="ht-gold-2" line={5} />
          <Shape d="M-10,-6C-8,-40 8,-40 10,-6Z" fill={C.goldHi} line={4} />
        </g>
        <Stein
          place={{x, y: 960 - hop, scale: 0.8}}
          pose={pose}
          face={{mouth: p.mouth, smile: walking ? 0.5 : 0.85, turn: walking ? 0.5 : 0, eyes: 'dot', brow: walking ? 0.1 : 0.6, browTilt: walking ? 0 : -0.5, look: walking ? [1, 0] : [0, 0]}}
        />
        {!walking && (
          <>
            <Pop f={f} at={diff} x={820} y={520}>
              <Sparkle x={820} y={520} r={50} />
            </Pop>
            <Note x={840} y={660} size={56} rot={8}>
              different.
            </Note>
          </>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 11
export const S11: SceneDef = {
  ground: 'mint',
  render: (p) => {
    const {f} = p;
    const piss = p.w(7);
    const stop = piss - 10;
    const scroll = f < stop ? f * 9 : stop * 9;
    const dogX = f < stop ? lerp(560, 690, clamp(f / stop)) : 690;
    const lift = f >= stop ? ease.outBack(clamp((f - stop) / 8)) : 0;
    const laugh = f >= piss;
    const run = walkCycle(f, 14, 1.5);
    return (
      <>
        {/* buildings scroll past */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const x = ((i * 300 - scroll * 0.5) % 1800 + 1800) % 1800 - 300;
          const h = 420 + ((i * 137) % 260);
          return (
            <g key={i}>
              <Shape d={rect(x, 1200 - h, 240, h, 4)} fill={[C.candy, C.white, C.aqua][i % 3]} line={5} />
              {Array.from({length: 6}, (_, k) => (
                <Shape key={k} d={rect(x + 30 + (k % 2) * 100, 1200 - h + 40 + Math.floor(k / 2) * 110, 70, 70, 4)} fill={k % 3 ? C.white : C.goldHi} line={3.5} shadow={false} />
              ))}
            </g>
          );
        })}
        <Shape d={rect(-40, 1200, 1160, 220)} fill={C.white} line={5} shadow={false} />
        <Line d="M-40,1420L1120,1420" size={6} />
        {Array.from({length: 8}, (_, k) => (
          <Line key={k} d={`M${((k * 180 - scroll) % 1440 + 1440) % 1440 - 180},1200L${((k * 180 - scroll) % 1440 + 1440) % 1440 - 200},1420`} size={3} opacity={0.4} />
        ))}
        {/* hydrant */}
        <g transform={`translate(${880 + (f < stop ? 1200 - scroll * 1.0 : 1200 - stop * 9) - 1200 + (f < stop ? 0 : 0)},1340)`}>
          <Shape d="M-44,40L-40,-80C-40,-120 40,-120 40,-80L44,40Z" fill={C.hotpink} shade="M10,-120L60,-120L60,40L10,40Z" shadeInk="ht-ink-2" line={6} />
          <Shape d={rect(-60, -70, 120, 30, 10)} fill={C.hotpink} line={5} />
          <Shape d={rect(-56, 30, 112, 26, 8)} fill={C.hotpink} line={5} />
          <Shape d={circle(0, -124, 18)} fill={C.gold} line={4} />
        </g>
        {lift > 0.5 && f < piss + 30 && (
          <Shape d="M770,1270C810,1250 840,1270 850,1320" fill="none" dotted line={9} lineColor={C.teal} />
        )}
        <Biscuit
          place={{x: dogX, y: 1290 - (f < stop ? Math.abs(Math.sin(f / 5)) * 10 : 0), scale: 0.62}}
          pose={f < stop ? trot(f, 10) : {legBR: -70 * lift, legBL: 8, tail: 20 * Math.sin(f / 3), head: -6}}
          eyes={lift > 0.5 ? 'happy' : 'open'}
        />
        <Stein
          place={{x: 300, y: 960 - Math.abs(Math.sin((f / 14) * Math.PI)) * 18, scale: 0.72, rotate: f < stop ? 6 : 0}}
          pose={f < stop ? addPose(STEIN_POSES.stand, run, {farmL: -60, farmR: 60}) : {...STEIN_POSES.stand, uarmR: -20, farmR: -120, torso: -6}}
          face={{mouth: laugh ? 0.7 : p.mouth, eyes: laugh ? 'happy' : 'dot', smile: 0.9, turn: 0.4}}
        />
        {f < stop && <MotionLines x={150} y={700} n={3} len={120} />}
        {laugh && (
          <Note x={380} y={560} size={64} rot={-8} color={C.hotpink}>
            ha!
          </Note>
        )}
      </>
    );
  },
};

export const VERSE1: Record<number, SceneDef> = {1: S01, 2: S02, 3: S03, 0: Title, 4: S04, 5: S05, 6: S06, 7: S07, 8: S08, 9: S09, 10: S10, 11: S11};

// keep unused helpers referenced for tree-shaking clarity
void Bubble;
void rng;
