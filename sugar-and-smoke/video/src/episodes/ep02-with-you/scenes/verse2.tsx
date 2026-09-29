// No. 2, verse 2 (lines 8-19): tomorrow?, sorry, red eyes, the shout inside, the jar of light, give me life.
import React from 'react';
import {C, FONT} from '../../../brand/tokens';
import {Pip} from '../../../characters/Pip';
import {Precious, PRECIOUS_PARTS} from '../../../characters/Precious';
import {Stein, STEIN_PARTS} from '../../../characters/Stein';
import {clamp, ease, lerp} from '../../../lib/ease';
import {Flat, Line, Shape, Txt} from '../../../lib/print';
import {rng} from '../../../lib/random';
import {chainAngle, Pose, worldPoint} from '../../../lib/rig';
import {SceneDef} from '../../../lib/scene';
import {circle, Clip, ellipse, FloatHearts, heart, Note, rect, smooth, SmokePuff, Sparkle, Wash} from '../../../props/common';
import {Drift, Snow} from '../../../props/winter';

const W = {winter: true} as const;
const blink = (f: number, every = 97, off = 0) => ((f + off) % every < 4 ? 1 : 0);

// A glass jar of warm light.
export const Jar: React.FC<{f: number; s?: number; open?: number}> = ({f, s = 1, open = 0}) => {
  const r = rng(15);
  return (
    <g transform={`scale(${s})`}>
      <Flat d={circle(0, 0, 200)} fill="url(#glow-amber)" opacity={0.85} />
      <Shape d="M-70,-80C-80,-40 -84,60 -64,90C-30,110 30,110 64,90C84,60 80,-40 70,-80Z" fill={C.amber} opacity={0.35} line={5} />
      {Array.from({length: 9}, (_, i) => {
        const a = f / 9 + i * 0.7;
        return <Flat key={i} d={circle(Math.cos(a) * (30 + r() * 24), Math.sin(a * 1.3) * 50 + 10, 7 + r() * 6)} fill={C.goldHi} />;
      })}
      <Shape d={rect(-60, -110 - open * 40, 120, 34, 8)} fill={C.gold} pattern="foil" line={4} />
      <Line d="M-50,-60C-56,-10 -54,40 -40,70" size={5} color={C.white} opacity={0.7} />
    </g>
  );
};

// ---------------------------------------------------------------- No. 08
export const S08: SceneDef = {
  ground: 'dusk',
  render: (p) => {
    const {f} = p;
    const tom = p.w(4);
    const turn = clamp((f - tom + 8) / 10);
    const hand = f * 6;
    return (
      <>
        {/* window onto the snowy night */}
        <Shape d={rect(470, 330, 520, 700, 10)} fill="#2C3548" line={7} />
        <Clip d={rect(470, 330, 520, 700)}>
          <Flat d={circle(800, 470, 60)} fill={C.goldHi} opacity={0.9} />
          <Snow f={f} n={40} seed={11} speed={0.6} y0={300} y1={1060} />
          <Drift y={930} seed={12} />
        </Clip>
        <Line d="M730,330L730,1030M470,680L990,680" size={6} />
        {f >= tom - 4 && <Line d="M640,560C640,500 720,500 720,550C720,590 680,600 680,640M680,680L680,690" size={7} color={C.ice} opacity={clamp((f - tom + 4) / 8)} />}
        <Shape d={rect(440, 1030, 580, 40, 8)} fill="#3A4252" line={6} />
        {/* calendar */}
        <Shape d={rect(110, 380, 260, 300, 8)} fill={C.white} line={6} />
        <Shape d={rect(110, 380, 260, 70, 8)} fill={C.hotpink} line={6} />
        <Txt x={240} y={600} size={turn < 0.5 ? 58 : 50} font={FONT.lyric} weight={800} color={C.ink}>
          {turn < 0.5 ? 'today' : 'tomorrow'}
        </Txt>
        {turn > 0 && turn < 1 && (
          <Shape d={`M110,450L370,450L370,${450 + 230 * (1 - turn)}L110,${450 + 230 * (1 - turn)}Z`} fill={C.white} line={5} />
        )}
        {/* clock */}
        <Shape d={circle(240, 850, 90)} fill={C.white} line={6} />
        <Line d={`M240,850L${240 + Math.cos((hand * Math.PI) / 180) * 70},${850 + Math.sin((hand * Math.PI) / 180) * 70}M240,850L240,800`} size={6} color={C.ink} />
        <Pip place={{x: 600, y: 1260, scale: 0.9}} pose={{head: -12, body: -3, flipperL: 12, flipperR: -12}} face={{eyes: blink(f, 60) ? 'closed' : 'dot'}} />
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 09
export const S09: SceneDef = {
  ground: 'frost',
  render: (p) => {
    const {f} = p;
    const pose: Pose = {uarmR: -40, farmR: -70, uarmL: 40, farmL: -70, head: 8};
    const place = {x: 540, y: 1000, scale: 0.8};
    const hl = worldPoint(STEIN_PARTS, pose, place, 'handL', [0, 30]);
    const hr = worldPoint(STEIN_PARTS, pose, place, 'handR', [0, 30]);
    const head = worldPoint(STEIN_PARTS, pose, place, 'head', [0, -300]);
    return (
      <>
        <Drift y={1320} seed={13} />
        <Stein place={place} pose={pose} style={W} face={{smile: -0.5, brow: 0.2, browTilt: 0.9, look: [0, 0.6], mouth: p.mouth * 0.5}} />
        {/* wilted flower */}
        <Line d={`M${hr[0]},${hr[1]}C${hr[0] + 20},${hr[1] - 90} ${hr[0] + 80},${hr[1] - 110} ${hr[0] + 90},${hr[1] - 40}`} size={6} color={C.teal} />
        {[0, 1, 2, 3].map((k) => (
          <Shape key={k} d={ellipse(hr[0] + 90 + (k - 1.5) * 14, hr[1] - 20 + (k % 2) * 8, 12, 22)} fill={C.candy} line={3.5} />
        ))}
        {/* the note */}
        <g transform={`translate(${hl[0] - 60},${hl[1] - 40}) rotate(-8)`}>
          <Shape d={rect(-80, -60, 160, 110, 6)} fill={C.white} line={5} />
          <Txt x={0} y={10} size={46} font={FONT.hand}>
            sorry
          </Txt>
        </g>
        {/* his own little snow cloud */}
        <SmokePuff x={head[0]} y={head[1] - 100} s={420} o={0.95} v={2} />
        <Snow f={f} n={16} seed={14} speed={0.8} y0={head[1] - 60} y1={head[1] + 240} big />
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 10
export const S10: SceneDef = {
  ground: 'frost',
  under: () => <Wash kind="ice" x={540} y={900} s={1500} o={0.4} />,
  render: (p) => {
    const {f} = p;
    const pose: Pose = {head: 0};
    const place = {x: 540, y: 1860, scale: 1.95};
    const eyes = [-1, 1].map((s) => worldPoint(STEIN_PARTS, pose, place, 'head', [s * 33, -150]));
    const grow = clamp(f / (p.dur - 10));
    return (
      <>
        {eyes.map(([x, y], i) => (
          <Flat key={`r${i}`} d={ellipse(x, y + 4, 46, 36)} fill="url(#ht-red-3)" opacity={0.9} />
        ))}
        <Stein place={place} pose={pose} style={W} face={{eyes: 'dot', smile: -0.6, brow: 0.3, browTilt: 1, look: [0, 0.4]}} />
        {eyes.map(([x, y], i) => (
          <g key={`t${i}`}>
            <Flat d={ellipse(x, y + 4, 46, 36)} fill="url(#ht-red-2)" opacity={0.7} />
            {[0, 1, 2].map((k) => {
              const len = 24 + 50 * grow * (1 - k * 0.25);
              const tx = x - 20 + k * 20;
              const ty = y + 34;
              return <Shape key={k} d={`M${tx - 8},${ty}L${tx + 8},${ty}L${tx},${ty + len}Z`} fill={C.ice} line={3} />;
            })}
            <Shape d={`M${x + 30},${y + 40 + ((f * 5 + i * 30) % 120)}C${x + 20},${y + 60 + ((f * 5 + i * 30) % 120)} ${x + 40},${y + 60 + ((f * 5 + i * 30) % 120)} ${x + 30},${y + 40 + ((f * 5 + i * 30) % 120)}Z`} fill={C.ice} line={2.5} />
          </g>
        ))}
        <Note x={860} y={460} size={60} rot={8} color={C.pressure}>
          red.
        </Note>
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 11
export const S11: SceneDef = {
  ground: 'frost',
  render: (p) => {
    const {f} = p;
    const fall = ease.outBack(clamp(f / 10));
    const angel = Math.sin(f / 3) * 40;
    const lying = f >= 10;
    return (
      <>
        <Drift y={1100} seed={15} />
        {lying && <Shape d={smooth([[140, 1260], [240, 1120], [430, 1110], [560, 1140], [760, 1120], [900, 1180], [900, 1330], [760, 1400], [560, 1380], [320, 1410], [160, 1360]], true, 0.6)} fill="#DDE5EA" line={4} shadow={false} />}
        <Stein
          place={{x: lerp(540, 600, fall), y: lerp(1000, 1250, fall), scale: 0.72, rotate: -90 * fall}}
          pose={lying ? {uarmL: 90 + angel, uarmR: -90 - angel, thighL: -10 - angel / 4, thighR: 10 + angel / 4} : {uarmL: 60, uarmR: -60}}
          style={W}
          face={{eyes: lying ? 'x' : 'wide', smile: -0.2, mouth: lying ? 0.2 : 0.5}}
        />
        <Pip place={{x: 210, y: 1180, scale: 0.66}} pose={{flipperR: -70 + Math.sin(f / 2) * 16, head: 10, body: 6}} face={{eyes: 'wide'}} />
        <Note x={760} y={640} size={66} rot={-6}>
          (dramatic)
        </Note>
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 12 & 13: inside
const Inside = (again: boolean): SceneDef => ({
  ground: 'cotton',
  under: () => <Wash kind="ice" x={540} y={900} s={1300} o={0.35} />,
  render: (p) => {
    const {f} = p;
    const pose: Pose = {uarmL: 10, uarmR: -10, farmL: -6, farmR: 6};
    const place = {x: 540, y: 1040, scale: 0.95};
    const [cx, cy] = worldPoint(STEIN_PARTS, pose, place, 'torso', [0, -150]);
    const R = 125;
    const knock = again && Math.floor(f / 8) % 2 === 0;
    const bx = cx + Math.sin(f / 5) * 40;
    const by = cy - 20 + Math.cos(f / 4) * 30;
    return (
      <>
        <Stein place={place} pose={pose} style={W} face={{smile: 0, mouth: 0, look: [0, 0], blink: blink(f, 45)}} />
        <Shape d={circle(cx, cy, R)} fill={C.blush} line={7} />
        <Clip d={circle(cx, cy, R)}>
          <Line d={`M${cx - 110},${cy - 60}C${cx - 40},${cy - 90} ${cx + 40},${cy - 90} ${cx + 110},${cy - 60}M${cx - 115},${cy - 10}C${cx - 40},${cy - 40} ${cx + 40},${cy - 40} ${cx + 115},${cy - 10}M${cx - 110},${cy + 40}C${cx - 40},${cy + 10} ${cx + 40},${cy + 10} ${cx + 110},${cy + 40}`} size={6} color={C.candy} />
          <Stein place={{x: cx - 40, y: cy + 60, scale: 0.15}} pose={again ? {uarmR: knock ? -150 : -110, farmR: -20} : {uarmR: -80, farmR: -60, uarmL: 60, farmL: -40}} style={W} face={{mouth: 0.8, smile: 0.6, eyes: again ? 'dot' : 'closed'}} />
          {!again && (
            <g transform={`translate(${cx - 5},${cy + 8}) rotate(-12)`}>
              <Shape d="M0,-8L40,-24L40,24L0,8Z" fill={C.hotpink} line={3} />
            </g>
          )}
          {!again && [0, 1, 2].map((k) => <Line key={k} d={`M${cx + 50 + k * 18},${cy - 20 - k * 10}Q${cx + 62 + k * 18},${cy} ${cx + 50 + k * 18},${cy + 20 + k * 10}`} size={4} />)}
          {again && <Shape d={ellipse(bx, by, 50, 32)} fill={C.white} dotted line={6} />}
          <FloatHearts f={f} x={cx + 20} y={cy + 40} n={4} seed={again ? 13 : 12} spread={100} color={C.hotpink} />
        </Clip>
        {again && knock && <Note x={cx + 190} y={cy - 40} size={48} rot={10}>knock</Note>}
        <Note x={540} y={420} size={60} rot={-3}>
          {again ? '(still inside)' : 'inside, I said it'}
        </Note>
      </>
    );
  },
});
export const S12 = Inside(false);
export const S13 = Inside(true);

// ---------------------------------------------------------------- No. 14
export const S14: SceneDef = {
  ground: 'dusk',
  render: (p) => {
    const {f} = p;
    return (
      <>
        <Snow f={f} n={50} seed={16} speed={0.5} />
        <Shape d={rect(40, 300, 1000, 1100)} fill="#3A4252" line={7} />
        <Flat d="M330,1330L750,1330L960,1620L120,1620Z" fill={C.amber} opacity={0.35} />
        <Flat d={circle(540, 900, 420)} fill="url(#glow-amber)" opacity={0.9} />
        <Shape d={rect(300, 520, 480, 810, 8)} fill={C.amber} line={7} />
        <Shape d={rect(760, 520, 60, 810, 6)} fill={C.teal} line={6} />
        <Flat d={circle(700, 1040, 60)} fill="url(#glow-amber)" opacity={0.9} />
        <Precious place={{x: 540, y: 1000, scale: 0.8}} pose={{uarmL: 22, farmL: 30, uarmR: -22, farmR: -30}} style={{winter: true}} face={{smile: 0.9, brow: 0.6, browTilt: -0.3, look: [-0.4, 0], blink: blink(f, 70)}} />
        <Drift y={1330} seed={17} />
        <Pip place={{x: 130, y: 1400, scale: 0.55}} pose={{head: -6}} face={{eyes: 'wide'}} />
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 15
export const S15: SceneDef = {
  ground: 'dusk',
  render: (p) => {
    const {f} = p;
    const reveal = ease.outBack(clamp((f - p.w(0) + 4) / 12));
    const pose: Pose = {uarmR: lerp(-10, -60, reveal), farmR: lerp(-20, -60, reveal), uarmL: 12, farmL: -10};
    return (
      <>
        <Snow f={f} n={50} seed={17} speed={0.5} />
        <Drift y={1300} seed={18} />
        <Stein place={{x: 250, y: 1000, scale: 0.72}} pose={{uarmL: 40, farmL: -60, uarmR: -40, farmR: 60}} style={W} face={{eyes: reveal > 0.5 ? 'wide' : 'dot', smile: 0.6, look: [1, 0], turn: 0.4}} />
        <Precious
          place={{x: 780, y: 1000, scale: 0.76, flip: true}}
          pose={pose}
          style={{winter: true}}
          face={{smile: 0.9, look: [1, 0], turn: 0.3}}
          holdR={<g transform={`rotate(${-chainAngle(PRECIOUS_PARTS, pose, 'handR')}) translate(0,-80)`}><Jar f={f} s={0.7 * Math.max(0.2, reveal)} /></g>}
        />
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 16
export const S16: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="amber" x={540} y={700} s={1400} o={0.45} />,
  render: (p) => {
    const {f} = p;
    const on = f >= p.w(2);
    const place = {x: 540, y: 1180, scale: 0.8};
    const head = worldPoint(STEIN_PARTS, {}, place, 'head', [0, -300]);
    const bx = head[0];
    const by = head[1] - 140;
    const r = rng(16);
    return (
      <>
        <g transform="translate(860,1300)">
          <Jar f={f} s={0.6} open={1} />
        </g>
        {Array.from({length: 10}, (_, i) => {
          const t = ((f + i * 6) % 40) / 40;
          const x = lerp(860, bx, t) + Math.sin(t * 6 + i) * 30;
          const y = lerp(1220, by, t) - Math.sin(t * Math.PI) * 120;
          return <Flat key={i} d={circle(x, y, 8 + r() * 6)} fill={C.goldHi} opacity={1 - t * 0.3} />;
        })}
        <Stein place={place} pose={{uarmR: -150, farmR: -20}} style={W} face={{eyes: on ? 'wide' : 'dot', smile: on ? 0.9 : 0.4, look: [0, -1]}} />
        <g transform={`translate(${bx},${by}) scale(${on ? ease.outBack(clamp((f - p.w(2)) / 6)) : 0.8})`}>
          {on && <Flat d={circle(0, 0, 220)} fill="url(#glow-gold)" />}
          <Shape d="M-60,-10C-60,-80 60,-80 60,-10C60,26 34,44 30,78L-30,78C-34,44 -60,26 -60,-10Z" fill={on ? C.goldHi : C.white} sheen={on} line={6} />
          <Shape d={rect(-34, 78, 68, 40, 8)} fill={C.smoke} line={5} />
        </g>
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 17
export const S17: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="pink" x={540} y={900} s={1400} o={0.35} />,
  render: (p) => {
    const {f} = p;
    const alive = p.w(2);
    const x0 = 60;
    const x1 = 1020;
    const cursor = lerp(x0, x1, clamp(f / (p.dur - 4)));
    const pts: string[] = [];
    for (let x = x0; x <= cursor; x += 12) {
      const local = (x - x0) / (x1 - x0) * p.dur;
      const beating = local >= alive;
      const ph = ((x - x0) % 180) / 180;
      let y = 900;
      if (beating) {
        if (ph > 0.4 && ph < 0.46) y = 900 - (ph - 0.4) * 5000;
        else if (ph >= 0.46 && ph < 0.54) y = 600 + (ph - 0.46) * 7000;
        else if (ph >= 0.54 && ph < 0.6) y = 1160 - (ph - 0.54) * 4300;
      }
      pts.push(`${pts.length ? 'L' : 'M'}${x},${y.toFixed(0)}`);
    }
    const pulse = f >= alive ? p.beat : 0;
    return (
      <>
        <Shape d={rect(40, 640, 1000, 520, 12)} fill={C.white} line={6} />
        {Array.from({length: 11}, (_, k) => <Line key={k} d={`M${40 + k * 100},640L${40 + k * 100},1160`} size={2} color={C.candy} />)}
        {Array.from({length: 6}, (_, k) => <Line key={`h${k}`} d={`M40,${640 + k * 104}L1040,${640 + k * 104}`} size={2} color={C.candy} />)}
        {pts.length > 1 && <Line d={pts.join('')} size={8} color={C.pressure} />}
        <Shape d={heart(540, 470, 120 + 30 * pulse)} fill={C.hotpink} shade={heart(560, 480, 120)} shadeInk="ht-ink-2" line={7} />
        {f >= alive && <Note x={860} y={380} size={70} rot={8} color={C.pressure}>alive!</Note>}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 18
export const S18: SceneDef = {
  ground: 'cotton',
  under: () => (
    <>
      <Wash kind="pink" x={320} y={620} s={1200} o={0.5} />
      <Wash kind="aqua" x={800} y={1200} s={1200} o={0.45} />
    </>
  ),
  render: (p) => {
    const {f} = p;
    const txt = 'give me life';
    const shown = txt.slice(0, Math.max(1, Math.ceil(clamp(f / 30) * txt.length)));
    const r = rng(18);
    return (
      <>
        <Txt x={548} y={868} size={150} font={FONT.lyric} weight={800} color={C.hotpink} spacing={-4} opacity={0.9}>
          {shown}
        </Txt>
        <Txt x={540} y={860} size={150} font={FONT.lyric} weight={800} color="url(#foil)" spacing={-4} stroke={C.goldLo} strokeWidth={5}>
          {shown}
        </Txt>
        <Txt x={540} y={960} size={30} font={FONT.tag} weight={700} spacing={4}>
          (SEE NO. 1)
        </Txt>
        <Drift y={1260} seed={19} />
        {Array.from({length: 7}, (_, i) => {
          const x = 110 + i * 145;
          const t = clamp((f - 8 - i * 4) / 12);
          if (t <= 0) return null;
          const c = [C.candy, C.hotpink, C.goldHi, C.aqua][i % 4];
          return (
            <g key={i} transform={`translate(${x},${1290 - 60 * ease.outBack(t)})`}>
              <Line d="M0,40L0,-40" size={6} color={C.teal} />
              {[0, 1, 2, 3, 4].map((k) => {
                const a = (k / 5) * Math.PI * 2;
                return <Shape key={k} d={ellipse(Math.cos(a) * 20 * t, -50 + Math.sin(a) * 20 * t, 18 * t, 13 * t)} fill={c} line={3.5} />;
              })}
              <Shape d={circle(0, -50, 11 * t)} fill={C.gold} line={3} />
            </g>
          );
        })}
        <Snow f={f} n={20} seed={20} speed={0.5} />
        {r() > 2 && null}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 19
export const S19: SceneDef = {
  ground: 'frost',
  under: () => <Wash kind="amber" x={540} y={900} s={1400} o={0.35} />,
  render: (p) => {
    const {f} = p;
    const stopAt = 75;
    const a = (Math.min(f, stopAt) / 16) * Math.PI;
    const R = 170;
    const sx = 540 + Math.cos(a) * R;
    const px = 540 - Math.cos(a) * R;
    const depth = Math.sin(a);
    const done = f >= stopAt;
    const r = rng(19);
    const flakes = Array.from({length: 40}, (_, i) => {
      const ang = r() * Math.PI * 2 + f / 12;
      const rad = 200 + r() * 360 + Math.sin(f / 10 + i) * 30;
      const x = 540 + Math.cos(ang) * rad;
      const y = 960 + Math.sin(ang) * rad * 0.5;
      const gold = rad < 330;
      return gold ? <Flat key={i} d={circle(x, y, 7)} fill={C.goldHi} /> : <Flat key={i} d={circle(x, y, 6)} fill={C.white} />;
    });
    const steinEl = (
      <Stein key="s" place={{x: done ? 460 : sx, y: 1000, scale: 0.7 + 0.04 * depth}} pose={done ? {uarmR: -60, farmR: -40, uarmL: 20} : {uarmR: -80, farmR: 0, uarmL: 80, farmL: 0}} style={W} face={{smile: 1, eyes: 'happy', mouth: p.mouth * 0.6}} />
    );
    const precEl = (
      <Precious key="p" place={{x: done ? 640 : px, y: 1010, scale: 0.7 - 0.04 * depth, flip: true, rotate: done ? -10 : 0}} pose={done ? {uarmR: -120, farmR: -40, torso: -8} : {uarmR: -80, farmR: 0, uarmL: 80, farmL: 0}} style={{winter: true}} face={{smile: 1, eyes: 'happy'}} />
    );
    return (
      <>
        {flakes}
        <Drift y={1330} seed={21} />
        {depth >= 0 || done ? (
          <>
            {precEl}
            {steinEl}
          </>
        ) : (
          <>
            {steinEl}
            {precEl}
          </>
        )}
        {done && <FloatHearts f={f - stopAt} x={550} y={520} n={6} seed={19} spread={220} color={C.hotpink} />}
        {done && f < stopAt + 14 && <Sparkle x={550} y={560} r={70 * (1 - (f - stopAt) / 14)} />}
      </>
    );
  },
};

export const VERSE2: Record<number, SceneDef> = {8: S08, 9: S09, 10: S10, 11: S11, 12: S12, 13: S13, 14: S14, 15: S15, 16: S16, 17: S17, 18: S18, 19: S19};
