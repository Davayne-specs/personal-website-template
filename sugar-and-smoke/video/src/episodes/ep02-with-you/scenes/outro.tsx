// No. 2, outro (lines 41-52) and the epilogue: rooftops at night, the ring in the stars,
// the shared song, "I do", all the hands, a snowball, and two sets of footprints.
import React from 'react';
import {C, FONT} from '../../../brand/tokens';
import {Pebble, Pip, PipHeart, waddle} from '../../../characters/Pip';
import {Precious, PRECIOUS_PARTS} from '../../../characters/Precious';
import {Ring} from '../../../characters/Ring';
import {Stein, STEIN_PARTS} from '../../../characters/Stein';
import {clamp, ease, lerp, prog} from '../../../lib/ease';
import {Flat, Line, Shape, Txt} from '../../../lib/print';
import {rng} from '../../../lib/random';
import {Pose, reach, worldPoint} from '../../../lib/rig';
import {SceneDef} from '../../../lib/scene';
import {circle, Clip, ellipse, FloatHearts, Hand, heart, Moon, Note, Pop, rect, smooth, SmokePuff, Sparkle, star4, Stars, Wash} from '../../../props/common';
import {Drift, Footprints, House, Snow, Streetlight} from '../../../props/winter';
import {Glow} from './verse1';

const W = {winter: true} as const;
const SIT: Pose = {thighL: 80, shinL: -80, thighR: -80, shinR: 80}; // front-on, knees apart
const blink = (f: number, every = 97, off = 0) => ((f + off) % every < 4 ? 1 : 0);

// Far-off roofs along a line, a few windows still lit.
const Skyline: React.FC<{y: number; seed: number; f: number}> = ({y, seed, f}) => {
  const r = rng(seed);
  const out: React.ReactNode[] = [];
  let x = -60;
  for (let i = 0; x < 1140; i++) {
    const w = 120 + r() * 120;
    const h = 80 + r() * 110;
    const lit = [r() < 0.7, r() < 0.5];
    out.push(
      <g key={i}>
        <Shape d={`M${x},${y}L${x},${y - h}L${x + w / 2},${y - h - 50}L${x + w},${y - h}L${x + w},${y}Z`} fill="#2F3748" line={4} shadow={false} />
        {lit.map((on, k) => (on ? <Flat key={k} d={rect(x + 22 + k * (w / 2), y - h + 28, 24, 30)} fill={C.amber} opacity={0.7 + 0.3 * Math.sin(f / 13 + i + k)} /> : null))}
      </g>
    );
    x += w + 12;
  }
  return <>{out}</>;
};

// A roof seen straight on: snowy ridge at y, shingles below, optional chimney.
const Roof: React.FC<{y: number; f: number; chimney?: number; x0?: number; x1?: number}> = ({y, f, chimney, x0 = -60, x1 = 1140}) => {
  const r = rng(Math.round(y));
  const pts: [number, number][] = [];
  for (let x = x0; x <= x1; x += 90) pts.push([x, y - 18 - r() * 16]);
  const snow = `${smooth(pts, false, 0.6)}L${x1},${y + 26}C${lerp(x0, x1, 0.66)},${y + 40} ${lerp(x0, x1, 0.33)},${y + 20} ${x0},${y + 30}Z`;
  const scallops = (yy: number, k: number) => {
    let d = `M${x0 - (k % 2) * 40},${yy}`;
    for (let x = x0 - (k % 2) * 40; x < x1; x += 80) d += `Q${x + 40},${yy + 34} ${x + 80},${yy}`;
    return d;
  };
  return (
    <>
      {chimney !== undefined && (
        <>
          {[0, 1, 2].map((k) => (
            <SmokePuff key={k} x={chimney + Math.sin(f / 11 + k) * 16 + k * 12} y={y - 240 - k * 70 - ((f * 0.8) % 70)} s={120 + k * 40} o={0.45 - k * 0.1} v={((k % 4) + 1) as 1 | 2 | 3 | 4} />
          ))}
          <Shape d={rect(chimney - 45, y - 180, 90, 210)} fill="#8E4A4A" shade={rect(chimney + 10, y - 180, 35, 210)} shadeInk="ht-ink-2" line={6} />
          <Shape d={`M${chimney - 56},${y - 176}C${chimney - 30},${y - 204} ${chimney + 30},${y - 204} ${chimney + 56},${y - 176}L${chimney + 50},${y - 158}L${chimney - 50},${y - 158}Z`} fill={C.white} line={5} />
        </>
      )}
      <Shape d={`M${x0},${y}L${x1},${y}L${x1},2000L${x0},2000Z`} fill="#3A4252" line={6} shadow={false} />
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <Line key={k} d={scallops(y + 70 + k * 72, k)} size={3.5} opacity={0.45} />
      ))}
      <Shape d={snow} fill={C.white} line={5} />
    </>
  );
};

// A drawn music note that floats up and fades.
const MusicNote: React.FC<{x: number; y: number; s?: number; c?: string; o?: number; double?: boolean}> = ({x, y, s = 1, c = C.candy, o = 1, double}) => (
  <g transform={`translate(${x},${y}) scale(${s}) rotate(-12)`} opacity={o}>
    <Shape d={ellipse(-10, 30, 22, 16)} fill={c} line={4} />
    <Line d="M10,28L10,-50" size={6} />
    {double ? (
      <>
        <Shape d={ellipse(50, 20, 22, 16)} fill={c} line={4} />
        <Line d="M70,18L70,-60" size={6} />
        <Line d="M10,-50L70,-60" size={11} />
      </>
    ) : (
      <Line d="M10,-50C32,-40 42,-22 34,-4" size={6} />
    )}
  </g>
);

const NoteStream: React.FC<{f: number; x: number; y: number; seed: number; n?: number}> = ({f, x, y, seed, n = 7}) => {
  const r = rng(seed);
  return (
    <>
      {Array.from({length: n}, (_, i) => {
        const t0 = i * 6 + r() * 4;
        const t = f - t0;
        const life = 44;
        const dx = (r() - 0.5) * 160;
        const c = [C.candy, C.aqua, C.goldHi][i % 3];
        if (t < 0 || t > life) return null;
        return <MusicNote key={i} x={x + dx + Math.sin(t / 6 + i) * 18} y={y - t * 6} s={0.8 + 0.3 * ease.outBack(clamp(t / 8))} c={c} o={1 - clamp((t - life + 12) / 12)} double={i % 2 === 1} />;
      })}
    </>
  );
};

// A flat hand seen from above, fingers to the right. Mirror with flip.
const FlatHand: React.FC<{x: number; y: number; skin: string; sleeve: string; flip?: boolean; rot?: number; s?: number; ring?: number}> = ({x, y, skin, sleeve, flip, rot = 0, s = 1, ring}) => (
  <g transform={`translate(${x},${y}) rotate(${rot}) scale(${flip ? -s : s},${s})`}>
    <Shape d={rect(-700, -96, 560, 192, 30)} fill={sleeve} line={7} />
    <Shape d={rect(-160, -104, 44, 208, 16)} fill={C.white} line={6} />
    {[-54, -18, 18, 54].map((fy, i) => (
      <Shape key={i} d={rect(-10, fy - 17, [150, 176, 168, 136][i], 34, 17)} fill={skin} line={5} />
    ))}
    <Shape d="M-120,-80C-124,-40 -124,40 -110,80L20,80C40,40 40,-40 20,-80Z" fill={skin} shade="M-120,20L40,20L40,80L-120,80Z" shadeInk="ht-ink-1" line={6} />
    <Shape d="M-40,-78C-10,-110 40,-130 80,-120C96,-114 92,-96 76,-92C40,-84 10,-70 0,-60Z" fill={skin} line={5} />
    {ring !== undefined && <Ring x={60} y={18} r={30} spin={10} tilt={-80} glint={ring} glow={ring * 0.8} />}
  </g>
);

// ---------------------------------------------------------------- No. 41 - I'ma see you in the night
export const S41: SceneDef = {
  ground: 'dusk',
  render: (p) => {
    const {f} = p;
    return (
      <>
        <Stars f={f} n={20} seed={41} y0={180} y1={880} />
        <Flat d={circle(780, 470, 340)} fill="url(#glow-cotton)" opacity={0.45} />
        <Shape d={circle(780, 470, 170)} fill={C.goldHi} shade={circle(840, 510, 160)} shadeInk="ht-gold-1" line={6} />
        <Flat d={circle(730, 420, 28)} fill={C.gold} opacity={0.4} />
        <Flat d={circle(820, 530, 18)} fill={C.gold} opacity={0.4} />
        <Skyline y={1130} seed={41} f={f} />
        <Roof y={1130} f={f} chimney={890} />
        <Stein place={{x: 380, y: 1066, scale: 0.7}} pose={{...SIT, uarmL: 24, farmL: -40, uarmR: -30, farmR: 40, head: -4}} style={W} face={{look: [0.7, -0.8], turn: 0.3, smile: 0.7, mouth: p.mouth * 0.5, blink: blink(f, 60)}} />
        <Pip place={{x: 620, y: 1060, scale: 0.55}} pose={{head: -16, body: -4}} face={{eyes: blink(f, 50, 10) ? 'closed' : 'dot'}} />
        <Snow f={f} n={26} seed={42} speed={0.4} />
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 42 & 43: across the street
const Buildings: React.FC<{f: number}> = ({f}) => {
  const r = rng(42);
  const wins = (x0: number, y0: number, cols: number, rows: number) =>
    Array.from({length: cols * rows}, (_, i) => {
      const on = r() < 0.65;
      const x = x0 + (i % cols) * 120;
      const y = y0 + Math.floor(i / cols) * 150;
      return (
        <g key={`${x0}-${i}`}>
          {on && <Flat d={circle(x + 30, y + 40, 70)} fill="url(#glow-amber)" opacity={0.45 + 0.1 * Math.sin(f / 9 + i)} />}
          <Shape d={rect(x, y, 60, 84, 4)} fill={on ? C.amber : '#2C3442'} line={4} />
        </g>
      );
    });
  return (
    <>
      {/* the street between them, far below */}
      <Flat d={circle(540, 1500, 260)} fill="url(#glow-amber)" opacity={0.6} />
      <Shape d={rect(620, 820, 540, 1200)} fill="#505B6D" shade={rect(1000, 820, 160, 1200)} shadeInk="ht-ink-2" line={7} />
      {wins(680, 980, 4, 4)}
      <Shape d={rect(-80, 1160, 560, 900)} fill="#4A5566" shade={rect(360, 1160, 120, 900)} shadeInk="ht-ink-2" line={7} />
      {wins(-20, 1300, 4, 3)}
      <Drift y={1160} seed={43} />
      <Shape d="M600,828C700,800 900,800 1160,826L1160,860L600,860Z" fill={C.white} line={5} />
      <Shape d="M-80,1170C100,1140 300,1140 480,1166L480,1200L-80,1200Z" fill={C.white} line={5} />
    </>
  );
};

export const S42: SceneDef = {
  ground: 'dusk',
  render: (p) => {
    const {f} = p;
    const wave = Math.sin(f / 3.4);
    return (
      <>
        <Stars f={f} n={18} seed={43} y0={160} y1={760} />
        <Moon x={540} y={400} r={84} />
        <Buildings f={f} />
        <Precious place={{x: 880, y: 780, scale: 0.55}} pose={{...SIT, uarmL: -150 + 16 * wave, farmL: 20 + 20 * wave, uarmR: -20, farmR: 30}} style={W} face={{smile: 1, look: [-0.8, 0.3], turn: -0.3, blink: blink(f, 70), blush: 0.6}} />
        <Stein place={{x: 220, y: 1100, scale: 0.6}} pose={{...SIT, uarmR: -140 - 14 * wave, farmR: -20 - 20 * wave, uarmL: 20, farmL: -30}} style={W} face={{smile: 1, look: [0.8, -0.6], turn: 0.3, mouth: p.mouth * 0.5}} />
        <FloatHearts f={f - 20} x={540} y={900} n={6} seed={42} spread={220} color={C.hotpink} />
        <Snow f={f} n={24} seed={44} speed={0.4} />
      </>
    );
  },
};

const LIGHTS_A: [number, number] = [400, 1000];
const LIGHTS_B: [number, number] = [720, 690];
const alongLights = (t: number): [number, number] => [lerp(LIGHTS_A[0], LIGHTS_B[0], t), lerp(LIGHTS_A[1], LIGHTS_B[1], t) + 90 * 4 * t * (1 - t)];

export const S43: SceneDef = {
  ground: 'dusk',
  render: (p) => {
    const {f} = p;
    const t = 1 - ease.inOutSine(clamp((f - 12) / 70));
    const [lx, ly] = alongLights(t);
    const swingA = Math.sin(f / 5) * 8 * (t > 0 && t < 1 ? 1 : 0.3);
    const cord = Array.from({length: 21}, (_, i) => alongLights(i / 20));
    const landed = f >= 82;
    return (
      <>
        <Stars f={f} n={18} seed={43} y0={160} y1={760} />
        <Moon x={540} y={400} r={84} />
        <Buildings f={f} />
        <Shape d={rect(LIGHTS_A[0] - 30, LIGHTS_A[1], 60, 170)} fill="#8E4A4A" line={5} />
        <Shape d={rect(LIGHTS_B[0] - 30, LIGHTS_B[1], 60, 140)} fill="#8E4A4A" line={5} />
        <Line d={smooth(cord, false)} size={4} />
        {cord.slice(1, -1).map(([x, y], i) => {
          const c = [C.amber, C.hotpink, C.aqua][i % 3];
          const on = 0.75 + 0.25 * Math.sin(f / 4 + i * 1.7);
          return (
            <g key={i}>
              <Flat d={circle(x, y + 22, 44)} fill="url(#glow-amber)" opacity={0.5 * on} />
              <Shape d={ellipse(x, y + 22, 11, 16)} fill={c} line={3} opacity={on} />
            </g>
          );
        })}
        <Precious place={{x: 900, y: 780, scale: 0.55}} pose={{...SIT, uarmL: -100, farmL: -20, uarmR: -20, farmR: 30}} style={W} face={{smile: 1, look: [-0.8, 0.5], turn: -0.3, blush: 0.5}} />
        <Stein place={{x: 200, y: 1100, scale: 0.6}} pose={landed ? {...SIT, uarmR: -60, farmR: -60, uarmL: 20, farmL: -30} : {...SIT, uarmR: -30, farmR: -80, uarmL: 20, farmL: -30}} style={W} face={{smile: 1, look: [0.8, -0.6], turn: 0.3, eyes: landed ? 'happy' : 'wide'}} />
        {/* Pip on a candy-cane hook */}
        <g transform={`rotate(${swingA} ${lx} ${ly})`}>
          <Line d={`M${lx - 14},${ly + 6}C${lx - 16},${ly - 22} ${lx + 16},${ly - 22} ${lx + 14},${ly + 6}L${lx},${ly + 60}`} size={7} color={C.hotpink} />
          <Pip place={{x: lx, y: ly + 150, scale: 0.42}} pose={{flipperL: 170, flipperR: -170, footL: -20, footR: 20}} face={{eyes: landed ? 'happy' : 'wide', beakOpen: landed ? 0 : 0.6}} />
        </g>
        {f > 12 && !landed && [0, 1, 2].map((k) => <Line key={k} d={`M${lx + 60 + k * 30},${ly + 40 + k * 26}L${lx + 130 + k * 30},${ly + 10 + k * 26}`} size={4} opacity={0.6} />)}
        <Snow f={f} n={24} seed={45} speed={0.4} />
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 44 - the ring in the stars
export const S44: SceneDef = {
  ground: 'night',
  render: (p) => {
    const {f} = p;
    const ringAt = p.w(5);
    const r = rng(44);
    const cx = 540;
    const cy = 700;
    const pts = Array.from({length: 12}, (_, i) => {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const rr = 290 + (r() - 0.5) * 40;
      return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as [number, number];
    });
    const drawn = clamp((f - 4) / 34) * 12;
    const ring = ease.outBack(clamp((f - ringAt + 2) / 10));
    const moon = 1 - clamp((f - ringAt + 8) / 8);
    return (
      <>
        <Stars f={f} n={30} seed={44} y0={140} y1={1180} />
        {pts.map(([x, y], i) => {
          const [nx, ny] = pts[(i + 1) % 12];
          const k = clamp(drawn - i);
          return k > 0 ? <Line key={`l${i}`} d={`M${x},${y}L${lerp(x, nx, k)},${lerp(y, ny, k)}`} size={4} color={C.candy} opacity={0.8} /> : null;
        })}
        {pts.map(([x, y], i) => (
          <Flat key={`s${i}`} d={star4(x, y, 18 + 8 * Math.sin(f / 5 + i))} fill={C.goldHi} />
        ))}
        {moon > 0 && (
          <g opacity={moon}>
            <Moon x={cx + 20} y={cy} r={110} />
          </g>
        )}
        {ring > 0 && <Ring x={cx} y={cy} r={150 * ring} spin={f * 3} tilt={-16} glint={0.6 + 0.4 * Math.sin(f / 4)} glow={0.9} />}
        {f >= p.w(6) && <Sparkle x={cx + 130} y={cy - 130} r={60 * (1 - clamp((f - p.w(6)) / 12))} />}
        {/* the two of them, small, on the roof below */}
        <Roof y={1300} f={f} />
        <Stein place={{x: 430, y: 1250, scale: 0.4}} pose={{...SIT, uarmR: -30, farmR: 20}} style={W} face={{look: [0.2, -1], smile: 0.8}} />
        <Precious place={{x: 640, y: 1252, scale: 0.4}} pose={{...SIT, uarmL: 30, farmL: -20}} style={W} face={{look: [-0.2, -1], smile: 0.8}} />
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 45 - black as he
export const S45: SceneDef = {
  ground: 'dusk',
  render: (p) => {
    const {f} = p;
    const rollY = lerp(-120, 2080, ease.inOutCubic(clamp(f / 22)));
    const words = [0, 1, 2, 3, 4, 5].map((i) => p.w(i));
    const r = rng(45);
    const stars = Array.from({length: 26}, (_, i) => ({x: 80 + r() * 920, y: 200 + r() * 1150, s: 14 + r() * 22, at: i < 6 ? words[i] : words[5] + (i - 5) * 1.2}));
    return (
      <>
        {/* the night before the ink */}
        <Stars f={f} n={14} seed={41} y0={180} y1={880} />
        <Moon x={780} y={470} r={120} />
        <Skyline y={1330} seed={45} f={f} />
        {/* ink laid down behind the drum */}
        <Flat d={`M-100,-100L1180,-100L1180,${rollY}L-100,${rollY}Z`} fill="#0E0B13" />
        {stars.map((s, i) =>
          f >= s.at ? (
            <Pop key={i} f={f} at={s.at} x={s.x} y={s.y} dur={6}>
              <Flat d={star4(s.x, s.y, s.s * (0.8 + 0.2 * Math.sin(f / 4 + i)))} fill={i < 6 ? C.goldHi : C.white} />
            </Pop>
          ) : null
        )}
        {/* the riso drum */}
        {rollY < 2060 && (
          <>
            <Line d={`M-20,${rollY - 40}L200,${rollY - 260}M1100,${rollY - 40}L880,${rollY - 260}`} size={10} color={C.ash} />
            <Shape d={rect(160, rollY - 290, 760, 50, 25)} fill={C.hotpink} line={6} />
            <Shape d={rect(-40, rollY - 70, 1160, 120, 60)} fill={C.ink} shade={rect(-40, rollY + 10, 1160, 40)} shadeInk="ht-cotton-1" line={6} lineColor={C.ash} />
            <Line d={`M40,${rollY - 40}L1040,${rollY - 40}`} size={6} color={C.ash} opacity={0.8} />
          </>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 46 - cold as the ice cube
const GLASS = 'M330,620L380,1300C390,1350 690,1350 700,1300L750,620Z';
export const S46: SceneDef = {
  ground: 'frost',
  under: () => <Wash kind="ice" x={540} y={900} s={1500} o={0.5} />,
  render: (p) => {
    const {f} = p;
    const hit = p.w(0);
    const fall = clamp(f / hit);
    const cubeY = f < hit ? lerp(150, 800, ease.inQuad(fall)) : 820 + Math.sin((f - hit) / 3) * 10 * Math.exp(-(f - hit) / 14);
    const frost = ease.outCubic(clamp((f - hit - 2) / 40));
    const top = 1350 - frost * 720;
    const r = rng(46);
    const zig = Array.from({length: 13}, (_, i) => `${i ? 'L' : 'M'}${300 + i * 40},${top - (i % 2 ? 26 : 0) - r() * 14}`).join('');
    return (
      <>
        <Shape d={GLASS} fill={C.ice} opacity={0.35} line={7} lineColor={C.iceInk} />
        <Clip d={GLASS}>
          <Flat d={rect(300, 840, 480, 520)} fill={C.amber} opacity={0.55} />
          <Line d="M300,840C400,830 600,850 780,838" size={5} color={C.goldLo} />
          {Array.from({length: 7}, (_, i) => (
            <Flat key={i} d={circle(400 + i * 45, 1280 - ((f * (2 + (i % 3)) + i * 40) % 420), 6 + (i % 3) * 2)} fill={C.white} opacity={0.7} />
          ))}
          <g transform={`translate(540,${cubeY}) rotate(${fall * 30 + Math.sin(f / 5) * 4})`}>
            <Shape d={rect(-80, -80, 160, 160, 26)} fill={C.ice} shade={rect(10, -80, 70, 160)} shadeInk="ht-ice-2" line={6} lineColor={C.iceInk} />
            <Line d="M-50,-50L-10,-60M-56,-30L-40,-34" size={6} color={C.white} />
          </g>
          {frost > 0 && (
            <>
              <Flat d={`${zig}L780,1400L300,1400Z`} fill={C.white} opacity={0.8} />
              <Flat d={`${zig}L780,1400L300,1400Z`} fill="url(#ht-ice-2)" opacity={0.7} />
            </>
          )}
        </Clip>
        {f < hit && (
          <g transform={`translate(540,${cubeY}) rotate(${fall * 30})`}>
            <Shape d={rect(-80, -80, 160, 160, 26)} fill={C.ice} shade={rect(10, -80, 70, 160)} shadeInk="ht-ice-2" line={6} lineColor={C.iceInk} />
            <Line d="M-50,-50L-10,-60M-56,-30L-40,-34" size={6} color={C.white} />
          </g>
        )}
        <Line d="M360,660L400,1260" size={9} color={C.white} opacity={0.7} />
        {f >= hit &&
          Array.from({length: 9}, (_, i) => {
            const t = f - hit;
            const a = -Math.PI / 2 + (i - 4) * 0.28;
            const v = 16 + (i % 3) * 5;
            const x = 540 + Math.cos(a) * v * t;
            const y = 800 + Math.sin(a) * v * t + 0.9 * t * t;
            return t < 18 ? <Shape key={i} d={circle(x, y, 10 - (i % 3) * 2)} fill={C.amber} line={3} opacity={1 - t / 18} /> : null;
          })}
        {f >= hit && (
          <Pop f={f} at={hit} x={800} y={560}>
            <Note x={820} y={560} size={90} rot={10} color={C.iceInk}>
              clink!
            </Note>
          </Pop>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 47 - she shares her song
export const S47: SceneDef = {
  ground: 'dusk',
  render: (p) => {
    const {f} = p;
    const offer = p.w(1);
    const take = p.w(2);
    const worn = p.w(4);
    const sPlace = {x: 330, y: 1066, scale: 0.66};
    const pPlace = {x: 740, y: 1066, scale: 0.66};
    const pPose: Pose = {...SIT, uarmL: lerp(10, 66, ease.inOutCubic(clamp((f - 2) / (offer - 2)))), farmL: lerp(-10, -30, clamp((f - 2) / offer)), uarmR: 30, farmR: 110};
    const pHand = worldPoint(PRECIOUS_PARTS, pPose, pPlace, 'handL', [0, 34]);
    const sBase: Pose = {...SIT, uarmL: 20, farmL: -30, head: 4};
    const ear = worldPoint(STEIN_PARTS, sBase, sPlace, 'head', [84, -150]);
    const k = ease.inOutCubic(clamp((f - take) / (worn - take)));
    const bud: [number, number] = f < take ? pHand : [lerp(pHand[0], ear[0], k), lerp(pHand[1], ear[1], k)];
    const reachT = ease.inOutCubic(clamp((f - offer) / (take - offer)));
    const sArm = reach(STEIN_PARTS, sBase, sPlace, 'uarmR', 'farmR', 'handR', f < take ? [lerp(sPlace.x + 120, pHand[0], reachT), lerp(sPlace.y - 60, pHand[1], reachT)] : bud, 1, [0, 30]);
    const sPose: Pose = f >= worn + 6 ? {...sBase, uarmR: -20, farmR: 30, head: 4 + 5 * Math.sin(f / 4)} : {...sBase, ...sArm};
    const herEar = worldPoint(PRECIOUS_PARTS, pPose, pPlace, 'head', [-74, -150]);
    const phone: [number, number] = [pPlace.x + 30, pPlace.y + 20];
    const fork: [number, number] = [phone[0] - 40, phone[1] - 120];
    return (
      <>
        <Stars f={f} n={20} seed={47} y0={180} y1={880} />
        <Moon x={540} y={420} r={100} />
        <Skyline y={1130} seed={47} f={f} />
        <Roof y={1130} f={f} />
        <Stein place={sPlace} pose={sPose} style={W} face={{look: f < worn ? [1, 0.2] : [0, 0], turn: f < worn ? 0.3 : 0, smile: 0.9, eyes: f >= worn + 6 ? 'happy' : 'dot', blink: blink(f, 60)}} />
        <Precious place={pPlace} pose={{...pPose, head: -4 + (f >= worn ? 5 * Math.sin(f / 4 + 1) : 0)}} style={W} face={{look: [-1, 0.2], turn: -0.3, smile: 1, blush: 0.5, blink: blink(f, 70, 20)}} />
        {/* the phone in her lap, one cord to her ear, one to his */}
        <Line d={`M${phone[0]},${phone[1]}C${phone[0] - 10},${phone[1] - 60} ${fork[0] + 20},${fork[1] + 40} ${fork[0]},${fork[1]}`} size={4} color={C.white} />
        <Line d={`M${fork[0]},${fork[1]}C${fork[0] + 10},${fork[1] - 80} ${herEar[0] - 30},${herEar[1] + 80} ${herEar[0]},${herEar[1]}`} size={4} color={C.white} />
        <Line d={`M${fork[0]},${fork[1]}C${fork[0] - 60},${fork[1] + 90} ${bud[0] + 60},${bud[1] + 90} ${bud[0]},${bud[1]}`} size={4} color={C.white} />
        <Shape d={rect(phone[0] - 34, phone[1] - 50, 68, 110, 14)} fill={C.hotpink} line={5} />
        <Flat d={rect(phone[0] - 24, phone[1] - 38, 48, 80)} fill={C.aqua} />
        <Shape d={circle(herEar[0], herEar[1], 14)} fill={C.white} line={4} />
        <Shape d={circle(bud[0], bud[1], 14)} fill={C.white} line={4} />
        {f >= worn && <NoteStream f={f - worn} x={540} y={820} seed={47} />}
        <Snow f={f} n={20} seed={48} speed={0.4} />
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 48 - me too
export const S48: SceneDef = {
  ground: 'dusk',
  render: (p) => {
    const {f} = p;
    const too = p.w(3);
    const nod = 6 * Math.sin(f / 4.2);
    const place = {x: 420, y: 1560, scale: 1.4};
    const pose: Pose = {head: nod, uarmL: 10, uarmR: -10};
    const ear = worldPoint(STEIN_PARTS, pose, place, 'head', [86, -150]);
    return (
      <>
        <Stars f={f} n={16} seed={48} y0={160} y1={700} />
        <Flat d={circle(420, 900, 520)} fill="url(#glow-amber)" opacity={0.25} />
        <Stein place={place} pose={pose} style={W} face={{eyes: 'happy', smile: 1, mouth: p.mouth * 0.4}} />
        <Shape d={circle(ear[0], ear[1], 18)} fill={C.white} line={4} />
        <Line d={`M${ear[0]},${ear[1]}C${ear[0] + 60},${ear[1] + 120} ${ear[0] + 200},${ear[1] + 260} ${ear[0] + 360},${ear[1] + 420}`} size={4} color={C.white} />
        <NoteStream f={f + 20} x={760} y={900} seed={48} n={8} />
        {f >= too && (
          <Pop f={f} at={too} x={800} y={500}>
            <Note x={800} y={520} size={120} rot={-8} color={C.candy}>
              me too
            </Note>
            <Line d="M650,560C720,586 840,584 950,556" size={6} color={C.candy} />
            <Shape d={heart(990, 440, 40)} fill={C.hotpink} line={4} />
          </Pop>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 49 - I do
export const S49: SceneDef = {
  ground: 'cotton',
  under: () => (
    <>
      <Wash kind="pink" x={320} y={620} s={1300} o={0.55} />
      <Wash kind="gold" x={800} y={1250} s={1200} o={0.45} />
    </>
  ),
  render: (p) => {
    const {f} = p;
    const land = p.w(3);
    const inT = ease.outCubic(clamp(f / 16));
    const on = ease.inOutCubic(clamp((f - land + 8) / 10));
    const hx = lerp(-300, 330, inT) + 140 * on;
    const hy = lerp(820, 880, on);
    const px = lerp(1400, 700, inT);
    return (
      <>
        <Flat d={circle(560, 960, 500)} fill="url(#glow-gold)" opacity={0.5} />
        <FlatHand x={px} y={1000} skin={C.preciousSkin} sleeve={C.hotpink} flip rot={-6} ring={0.6 + 0.4 * Math.sin(f / 5)} />
        <FlatHand x={hx} y={hy} skin={C.steinSkin} sleeve={C.teal} rot={8 - 6 * on} />
        {f >= land && <Sparkle x={620} y={880} r={70 * (1 - clamp((f - land) / 14))} />}
        {f >= land && <FloatHearts f={f - land} x={600} y={760} n={6} seed={49} spread={320} color={C.hotpink} />}
        {f >= land && (
          <Pop f={f} at={land} x={540} y={520}>
            <Note x={540} y={520} size={130} rot={-5} color={C.hotpink}>
              I do.
            </Note>
          </Pop>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 50 - you want to touch
export const S50: SceneDef = {
  ground: 'night',
  render: (p) => {
    const {f} = p;
    const touch = p.w(3);
    const k = ease.inOutSine(clamp(f / touch));
    const hx = lerp(-320, 150, k);
    const px = lerp(1400, 930, k);
    const tipL: [number, number] = [hx + 1.6 * 222, 890];
    const tipR: [number, number] = [px - 1.6 * 222, 890];
    const sparked = f >= touch;
    const r = rng(50 + Math.floor(f / 2));
    const bolt = Array.from({length: 6}, (_, i) => `${i ? 'L' : 'M'}${lerp(tipL[0], tipR[0], i / 5)},${890 + (i && i < 5 ? (r() - 0.5) * 50 : 0)}`).join('');
    return (
      <>
        <Stars f={f} n={26} seed={50} y0={140} y1={1300} />
        {sparked && <Flat d={circle(540, 890, 320)} fill="url(#glow-gold)" opacity={0.9 * (0.8 + 0.2 * Math.sin(f))} />}
        <g transform={`translate(${hx},960) scale(1.6)`}>
          <Shape d={rect(-560, -60, 500, 140, 30)} fill={C.teal} line={6} />
          <Hand skin={C.steinSkin} point />
        </g>
        <g transform={`translate(${px},960) scale(-1.6,1.6)`}>
          <Shape d={rect(-560, -60, 500, 140, 30)} fill={C.hotpink} line={6} />
          <Hand skin={C.preciousSkin} point />
        </g>
        {sparked && (
          <>
            <Line d={bolt} size={9} color={C.goldHi} />
            <Sparkle x={540} y={890} r={90 * (0.7 + 0.3 * Math.sin(f / 1.5))} />
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const a = (i / 6) * Math.PI * 2 + f / 6;
              const d = 60 + (f - touch) * 9;
              return <Flat key={i} d={star4(540 + Math.cos(a) * d, 890 + Math.sin(a) * d, 14)} fill={C.goldHi} opacity={1 - clamp((f - touch) / 24)} />;
            })}
          </>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 51 - all the hands
const Neighbour: React.FC<{x: number; y: number; s: number; raise: number; f: number; i: number}> = ({x, y, s, raise, f, i}) => {
  const hand: [number, number] = [lerp(64, 96, raise), lerp(-110, -440, ease.outBack(raise))];
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <Shape d={circle(0, -300, 42)} fill={C.slate} line={4} />
      <Shape d={rect(-58, -258, 116, 206, 38)} fill={C.slate} line={4} />
      <Shape d={rect(-46, -64, 38, 84, 12)} fill={C.slate} line={4} />
      <Shape d={rect(8, -64, 38, 84, 12)} fill={C.slate} line={4} />
      <Line d={`M40,-230L${hand[0]},${hand[1]}`} size={22} color={C.slate} />
      <Glow x={hand[0]} y={hand[1] - 30} s={0.7 + 0.25 * raise} f={f + i * 7} />
    </g>
  );
};

export const S51: SceneDef = {
  ground: 'dusk',
  render: (p) => {
    const {f} = p;
    const hands = p.w(2);
    const r = rng(51);
    const folk = [80, 230, 890, 1010, 160, 960, 380, 700].map((x, i) => ({x, y: 1250 + (i >= 4 ? 90 : 0), s: (i >= 4 ? 0.55 : 0.46) + r() * 0.08, at: 6 + i * 2.4, i}));
    const bright = f >= hands ? 1 + 0.3 * Math.exp(-(f - hands) / 8) : 1;
    const sPose: Pose = {uarmR: lerp(-10, -160, ease.outBack(clamp((f - 10) / 8))), farmR: -10, uarmL: 10, farmL: -8};
    const pPose: Pose = {uarmL: lerp(10, 160, ease.outBack(clamp((f - 12) / 8))), farmL: 10, uarmR: -10, farmR: 8};
    const sPlace = {x: 450, y: 1060, scale: 0.66};
    const pPlace = {x: 640, y: 1060, scale: 0.66};
    const sHand = worldPoint(STEIN_PARTS, sPose, sPlace, 'handR', [0, 40]);
    const pHand = worldPoint(PRECIOUS_PARTS, pPose, pPlace, 'handL', [0, 36]);
    return (
      <>
        <Stars f={f} n={18} seed={51} y0={160} y1={700} />
        <House x={-40} y={1180} w={400} h={280} lit={1} seed={51} />
        <House x={380} y={1160} w={340} h={250} body="#505B6D" lit={1} seed={52} />
        <House x={740} y={1180} w={380} h={290} lit={1} seed={53} />
        <Streetlight x={60} y={1320} h={640} on={1} />
        <Drift y={1230} seed={51} />
        {folk.slice(0, 4).map((n) => (
          <Neighbour key={n.i} x={n.x} y={n.y} s={n.s} raise={clamp((f - n.at) / 8)} f={f} i={n.i} />
        ))}
        <Stein place={sPlace} pose={sPose} style={W} face={{smile: 1, look: [0.3, -0.8], mouth: p.mouth * 0.5}} />
        <Precious place={pPlace} pose={pPose} style={W} face={{smile: 1, look: [-0.3, -0.8], blush: 0.4}} />
        <Glow x={sHand[0]} y={sHand[1] - 40} s={1.1 * bright} f={f} />
        <Glow x={pHand[0]} y={pHand[1] - 40} s={1.1 * bright} f={f + 11} />
        {folk.slice(4).map((n) => (
          <Neighbour key={n.i} x={n.x} y={n.y} s={n.s} raise={clamp((f - n.at) / 8)} f={f} i={n.i} />
        ))}
        {f >= hands && [0, 1, 2, 3].map((i) => <Sparkle key={i} x={200 + i * 230} y={560 + (i % 2) * 90} r={36 * (1 - clamp((f - hands - i * 2) / 14))} />)}
        <Snow f={f} n={30} seed={52} speed={0.4} />
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 52 - splat
export const S52: SceneDef = {
  ground: 'frost',
  under: () => <Wash kind="pink" x={540} y={800} s={1400} o={0.3} />,
  render: (p) => {
    const {f} = p;
    const hit = p.w(0);
    const place = {x: 520, y: 1240, scale: 1.05};
    const hitDone = f >= hit;
    const pose: Pose = hitDone ? {uarmL: 70, farmL: -40, uarmR: -70, farmR: 40, head: 6 * Math.sin((f - hit) / 2) * Math.exp(-(f - hit) / 10)} : {uarmL: 10, uarmR: -10};
    const [fx, fy] = worldPoint(STEIN_PARTS, pose, place, 'head', [0, -150]);
    const t = clamp(f / hit);
    const bx = lerp(1180, fx, t);
    const by = lerp(420, fy, t) - Math.sin(t * Math.PI) * 120;
    const r = rng(52);
    const splat = smooth(Array.from({length: 14}, (_, i) => {
      const a = (i / 14) * Math.PI * 2;
      const rr = i % 2 ? 70 + r() * 20 : 110 + r() * 40;
      return [fx + Math.cos(a) * rr, fy + Math.sin(a) * rr * 0.9] as [number, number];
    }), true, 0.35);
    const shake = hitDone ? Math.sin(f * 2.1) * 6 : 0;
    const burst = Array.from({length: 18}, (_, i) => {
      const a = (i / 18) * Math.PI * 2;
      const rr = i % 2 ? 170 : 230;
      return `${i ? 'L' : 'M'}${300 + Math.cos(a) * rr * 1.25},${470 + Math.sin(a) * rr * 0.75}`;
    }).join('');
    return (
      <>
        <Drift y={1330} seed={53} />
        <Stein place={place} pose={pose} style={W} face={{eyes: hitDone ? 'x' : 'dot', smile: hitDone ? -0.2 : 0.6, mouth: hitDone ? 0.5 : 0.2}} />
        {!hitDone && (
          <>
            <Shape d={circle(bx, by, 46)} fill={C.white} shade={circle(bx + 14, by + 12, 40)} shadeInk="ht-ice-1" line={6} />
            {[0, 1, 2].map((k) => (
              <Line key={k} d={`M${bx + 70 + k * 20},${by - 30 + k * 30}L${bx + 170 + k * 20},${by - 60 + k * 30}`} size={5} />
            ))}
          </>
        )}
        {hitDone && (
          <>
            <Shape d={splat} fill={C.white} shade={circle(fx + 40, fy + 30, 90)} shadeInk="ht-ice-1" line={6} />
            {[0, 1, 2].map((k) => {
              const a = (f - hit) / 5 + (k * Math.PI * 2) / 3;
              return <Shape key={k} d={star4(fx + Math.cos(a) * 170, fy - 170 + Math.sin(a) * 40, 26)} fill={C.goldHi} line={4} />;
            })}
            <g transform={`translate(${shake},0)`}>
              <Shape d={`${burst}Z`} fill={C.hotpink} line={7} />
              <Txt x={300} y={500} size={96} font={FONT.stamp} color={C.white} spacing={2}>
                #@$%&!
              </Txt>
            </g>
          </>
        )}
        <Pip place={{x: 900, y: 1300, scale: 0.6}} pose={hitDone ? {flipperR: -150, head: -6} : {flipperR: -60, head: -6}} face={{eyes: hitDone ? 'happy' : 'dot', beakOpen: hitDone ? 0.8 : 0}} />
      </>
    );
  },
};

// ---------------------------------------------------------------- Epilogue - two sets of footprints, then Fin.
const EP = {arrive: 60, stop: 240, offer: 300, accept: 370, go: 430, gone: 620, tilt: 610, tiltEnd: 720, card: 720, fold: 800};
const TILT = 1500;
// Close on the street for the penguins, then tip up to the stars.
const epCam = (f: number) => {
  const t = prog(f, EP.tilt, EP.tiltEnd - EP.tilt, ease.inOutCubic);
  return {y: lerp(-110, TILT, t), zoom: lerp(1.3, 1, t)};
};

export const Epilogue: SceneDef = {
  ground: 'dusk',
  camera: (p) => epCam(p.f),
  render: (p) => {
    const {f} = p;
    const cam = epCam(f);
    const camY = cam.y;
    // the part of the scene the camera can see, so the fold never shows what's off the page
    const view = rect(-40, 960 - (960 + camY) / cam.zoom - 20, 1160, 1920 / cam.zoom + 40);
    const floor = 1420;
    const s = 0.8;
    const pipIn = prog(f, EP.arrive, EP.stop - EP.arrive, ease.linear);
    const walk = prog(f, EP.go, EP.gone - EP.go, ease.linear);
    const pipX = f < EP.go ? lerp(-150, 480, pipIn) : lerp(480, 1300, walk);
    const herX = f < EP.go ? 700 : lerp(650, 1470, walk);
    const walking = (f >= EP.arrive && f < EP.stop) || (f >= EP.go && f < EP.gone);
    const shy = f >= EP.stop && f < EP.offer;
    const offering = f >= EP.offer && f < EP.accept + 20;
    const hers = f >= EP.accept;
    const pipPose: Pose = walking ? waddle(f, 16) : offering && !hers ? {flipperR: -96, head: 4} : shy ? {head: 22, body: 4, footL: Math.sin(f / 5) * -10} : {head: -2};
    const herPose: Pose = walking ? waddle(f + 8, 16) : f >= EP.accept - 10 && f < EP.accept + 30 ? {flipperR: -90, head: 2} : {head: f < EP.arrive + 40 ? Math.sin(f / 20) * 10 : 0};
    const pebble = (
      <g transform={`translate(-4,150) rotate(${-((pipPose.body ?? 0) + (pipPose.flipperR ?? 0))})`}>
        <Pebble s={1.3} />
      </g>
    );
    const herPebble = (
      <g transform={`translate(-4,150) rotate(${-((herPose.body ?? 0) + (herPose.flipperR ?? 0))})`}>
        <Pebble s={1.3} />
      </g>
    );
    const bob = (x: number) => (walking ? -Math.abs(Math.sin((x / 16) * Math.PI)) * 6 : 0);
    const blushT = clamp((f - EP.stop) / 20);
    const card = clamp((f - EP.card) / 24);
    const fold = ease.inOutCubic(clamp((f - EP.fold) / 26));
    const cy = 960 - camY; // screen centre in scene coordinates
    return (
      <g transform={`translate(0,${cy}) scale(1,${1 - fold}) translate(0,${-cy})`}>
        <Clip d={view}>
        {/* the sky above, waiting for the tilt */}
        <Stars f={f} n={40} seed={60} y0={-1500} y1={500} />
        <Stars f={f + 20} n={20} seed={61} y0={-1400} y1={-200} />
        <Moon x={820} y={-980} r={110} />
        {f > EP.tiltEnd - 40 && f < EP.tiltEnd + 20 && (
          <Line d={`M${900 - (f - EP.tiltEnd + 40) * 14},${-1300 + (f - EP.tiltEnd + 40) * 6}L${980 - (f - EP.tiltEnd + 40) * 14},${-1334 + (f - EP.tiltEnd + 40) * 6}`} size={6} color={C.goldHi} opacity={0.9} />
        )}
        {/* the street */}
        <House x={-80} y={1250} w={420} h={300} lit={1} seed={61} />
        <House x={900} y={1230} w={360} h={280} body="#505B6D" lit={1} seed={62} />
        <Flat d={circle(420, 960, 200)} fill="url(#glow-amber)" opacity={0.25} />
        <Drift y={1300} seed={60} />
        <Streetlight x={700} y={1470} h={760} on={1} />
        <Footprints x0={-150} y0={floor + 16} x1={f < EP.go ? pipX : 480} y1={floor + 16} n={Math.max(2, Math.round(((f < EP.go ? pipX : 480) + 150) / 60))} s={0.9} />
        {f >= EP.go && (
          <>
            <Footprints x0={480} y0={floor + 6} x1={pipX} y1={floor + 6} n={Math.max(2, Math.round((pipX - 480) / 60))} s={0.9} />
            <Footprints x0={650} y0={floor + 44} x1={herX} y1={floor + 44} n={Math.max(2, Math.round((herX - 650) / 60))} s={0.9} />
          </>
        )}
        <Pip place={{x: herX, y: floor - 158 * s + 10 + bob(f + 8), scale: s, flip: f < EP.go}} pose={herPose} scarfColor={C.aqua} face={{eyes: f >= EP.accept + 4 && f < EP.go ? 'happy' : blink(f, 80, 30) ? 'closed' : 'dot', blush: hers ? 0.9 : 0}} holdR={hers && f < EP.accept + 30 ? herPebble : undefined} />
        <Pip place={{x: pipX, y: floor - 158 * s + bob(f), scale: s}} pose={pipPose} face={{eyes: shy ? 'closed' : f >= EP.accept + 4 && f < EP.go ? 'happy' : blink(f, 70) ? 'closed' : 'dot', blush: blushT * 0.9}} holdR={offering && !hers ? pebble : undefined} />
        {f >= EP.offer + 10 && f < EP.go && <PipHeart x={590} y={lerp(1120, 1040, clamp((f - EP.offer - 10) / 40))} s={30 + 6 * Math.sin(f / 5)} />}
        {f >= EP.accept && f < EP.go + 60 && <FloatHearts f={f - EP.accept} x={600} y={1100} n={5} seed={63} spread={180} color={C.hotpink} />}
        <Snow f={f} n={90} seed={60} speed={0.35} y0={-1600} y1={1960} />
        {/* the end card, printed over the stars */}
        {card > 0 && (
          <g opacity={card} transform={`translate(540,${cy - 60}) scale(${0.9 + 0.1 * ease.outBack(card)}) translate(-540,${-(cy - 60)})`}>
            <Txt x={550} y={cy - 92} size={170} font={FONT.lyric} weight={800} color={C.hotpink} spacing={-5} opacity={0.9}>
              mbastein
            </Txt>
            <Txt x={540} y={cy - 100} size={170} font={FONT.lyric} weight={800} color="url(#foil)" spacing={-5} stroke={C.goldLo} strokeWidth={5}>
              mbastein
            </Txt>
            <Txt x={540} y={cy + 30} size={104} font={FONT.lyric} weight={700} color={C.white}>
              With You
            </Txt>
            <Txt x={540} y={cy + 110} size={30} font={FONT.tag} weight={700} spacing={4} color={C.ice}>
              SUGAR &amp; SMOKE · NO. 2
            </Txt>
            <g transform={`translate(0,${cy + 190})`}>
              <Pebble x={500} y={0} s={1.2} />
              <Shape d={heart(590, 0, 30)} fill={C.hotpink} line={4} />
            </g>
          </g>
        )}
        </Clip>
      </g>
    );
  },
};

export const OUTRO: Record<number, SceneDef> = {41: S41, 42: S42, 43: S43, 44: S44, 45: S45, 46: S46, 47: S47, 48: S48, 49: S49, 50: S50, 51: S51, 52: S52, [-1]: Epilogue};
