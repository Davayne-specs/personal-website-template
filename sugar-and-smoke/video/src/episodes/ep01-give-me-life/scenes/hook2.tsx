// Hook, precious half (part two): No. 32-39.
import React from 'react';
import {svgPathProperties} from 'svg-path-properties';
import {C, FONT} from '../../../brand/tokens';
import {Precious, PRECIOUS_PARTS, PRECIOUS_POSES} from '../../../characters/Precious';
import {Ring} from '../../../characters/Ring';
import {clamp, ease, keys, lerp, prog} from '../../../lib/ease';
import {Flat, Line, Shape, Txt} from '../../../lib/print';
import {rng} from '../../../lib/random';
import {Pose, worldPoint} from '../../../lib/rig';
import {circle, Clip, ellipse, FloatHearts, Floor, heart, Note, Pop, poly, rect, Sparkle, Stars, Wash} from '../../../props/common';
import {S28, ThroneScene} from './hook1';
import {SceneDef} from '../../../lib/scene';

const blink = (f: number, every = 97, off = 0) => ((f + off) % every < 4 ? 1 : 0);

// ---------------------------------------------------------------- No. 32 - spinning like a coin
export const S32: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="gold" x={540} y={980} s={1300} o={0.5} />,
  camera: (p) => ({zoom: 1.08 - 0.06 * prog(p.f, 0, p.dur, ease.outCubic)}),
  render: (p) => {
    const {f} = p;
    const t = clamp(f / (p.dur - 8));
    const spin = 1600 * ease.outCubic(t);
    const wobble = t > 0.7 ? (t - 0.7) / 0.3 : 0;
    const lying = ease.inCubic(clamp((t - 0.8) / 0.2));
    const ry = 1 - 0.72 * lying;
    const hit = p.w(4);
    const g = f >= hit - 2 ? 1 - clamp((f - hit) / 24) : 0.2;
    return (
      <>
        {/* the table top */}
        <Shape d="M-60,1120C300,1080 800,1080 1140,1120L1140,1500L-60,1500Z" fill={C.white} line={6} shadow={false} />
        <Flat d={ellipse(540, 1130 + 10 * lying, 210 + 60 * lying, 26 + 30 * lying)} fill={C.ink} opacity={0.14} />
        <g transform={`translate(540,${920 + 160 * lying}) scale(1,${ry}) rotate(${wobble * 14 * Math.sin(f * 1.3)}) translate(-540,-${920 + 160 * lying})`}>
          <Ring x={540} y={920 + 160 * lying} r={210} spin={spin} tilt={0} band={0.24} glint={g} glow={0.3} />
        </g>
        {f < p.dur * 0.7 && (
          <>
            <Line d="M300,800C260,860 260,960 300,1020" size={6} opacity={0.6} />
            <Line d="M780,800C820,860 820,960 780,1020" size={6} opacity={0.6} />
          </>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 33 - life's breath
const Dandelion: React.FC<{x: number; y: number; left: number}> = ({x, y, left}) => {
  const n = 18;
  return (
    <>
      {Array.from({length: Math.round(n * left)}, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const ex = x + Math.cos(a) * 92;
        const ey = y + Math.sin(a) * 92;
        return (
          <g key={i}>
            <Line d={`M${x},${y}L${ex},${ey}`} size={3} />
            <Shape d={circle(ex, ey, 13)} fill={C.white} line={3} />
          </g>
        );
      })}
      <Shape d={circle(x, y, 16)} fill={C.goldLo} line={3} />
    </>
  );
};

export const S33: SceneDef = {
  ground: 'blush',
  under: () => <Wash kind="aqua" x={780} y={620} s={1200} o={0.5} />,
  render: (p) => {
    const {f} = p;
    const blow = p.w(1);
    const pose: Pose = {uarmR: -26, farmR: 136, uarmL: 10, farmL: -8, head: 6};
    const pp = {x: 400, y: 1330, scale: 1.18};
    const hand = worldPoint(PRECIOUS_PARTS, pose, pp, 'handR', [0, 30]);
    const dx = hand[0] + 210;
    const dy = hand[1] - 170;
    const left = 1 - clamp((f - blow) / 20);
    const r = rng(33);
    const seeds = Array.from({length: 18}, (_, i) => {
      const t = f - blow - i * 0.8;
      if (t < 0) return null;
      const sx = dx + t * (9 + r() * 7) + Math.sin(t / 4 + i) * 10;
      const sy = dy - t * (4 + r() * 6) + Math.cos(t / 5 + i) * 8;
      const gold = t > 14;
      return gold ? (
        <Sparkle key={i} x={sx} y={sy} r={12 + 8 * Math.sin(t / 3 + i)} o={1 - clamp((t - 40) / 20)} />
      ) : (
        <g key={i}>
          <Line d={`M${sx},${sy}L${sx - 16},${sy + 22}`} size={3} />
          <Shape d={circle(sx, sy, 12)} fill={C.white} line={3} />
        </g>
      );
    });
    return (
      <>
        <Precious
          place={pp}
          pose={pose}
          face={{smile: f < blow ? 0.5 : 0.2, mouth: f >= blow && f < blow + 22 ? 0.25 : 0, eyes: f >= blow ? 'closed' : 'dot', look: [1, -0.2], turn: 0.3}}
        />
        <Line d={`M${hand[0]},${hand[1]}Q${hand[0] + 90},${hand[1] - 40} ${dx},${dy + 60}`} size={6} color={C.teal} />
        <Dandelion x={dx} y={dy} left={left} />
        {seeds}
        {f >= blow && (
          <Line d={`M${hand[0] - 40},${hand[1] - 260}C${hand[0]},${hand[1] - 280} ${hand[0] + 40},${hand[1] - 250} ${hand[0] + 70},${hand[1] - 260}`} size={4} opacity={0.5 * left} />
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 34 - no heart
const HEART_D = heart(540, 900, 320);
const heartProps = new svgPathProperties(HEART_D);

export const S34: SceneDef = {
  ground: 'night',
  render: (p) => {
    const {f} = p;
    const cutEnd = 42;
    const cut = clamp(f / cutEnd);
    const len = heartProps.getTotalLength();
    const pt = heartProps.getPointAtLength(len * cut);
    const pt2 = heartProps.getPointAtLength(Math.min(len, len * cut + 4));
    const ang = (Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180) / Math.PI;
    const fall = clamp((f - cutEnd) / 14);
    const drop = clamp((f - cutEnd - 10) / 12);
    const fillT = clamp((f - cutEnd - 20) / 10);
    const snip = Math.abs(Math.sin(f / 2)) * 14;
    return (
      <>
        <Stars f={f} n={16} seed={34} y0={100} y1={1700} />
        {/* the page with a heart being cut out of it */}
        <Shape d={`${rect(90, 380, 900, 1060, 8)}${fall > 0 ? HEART_D : ''}`} evenodd fill={C.candy} shade={rect(560, 380, 460, 1060)} shadeInk="ht-pink-2" line={7} />
        {fall > 0 && fillT > 0 && <Shape d={HEART_D} fill={C.gold} pattern="foil" sheen line={6} opacity={fillT} />}
        {fall === 0 && <Shape d={HEART_D} fill="none" dotted line={9} lineColor={C.ink} />}
        {fall > 0 && fall < 1 && (
          <g transform={`translate(0,${fall * 900}) rotate(${fall * 30} 540 900)`} opacity={1 - fall}>
            <Shape d={HEART_D} fill={C.hotpink} line={6} />
          </g>
        )}
        {drop > 0 && drop < 1 && <Ring x={540} y={lerp(-200, 900, ease.inQuad(drop))} r={120} spin={drop * 300} glint={0.6} />}
        {fillT > 0 && <Flat d={circle(540, 900, 460)} fill="url(#glow-gold)" opacity={fillT * 0.6} />}
        {cut < 1 && (
          <g transform={`translate(${pt.x},${pt.y}) rotate(${ang})`}>
            <g transform={`rotate(${-snip / 2})`}>
              <Shape d="M0,0L120,-10L130,0L120,6Z" fill={C.white} line={4} />
              <Shape d={`${circle(-60, -30, 30)}${circle(-60, -30, 16)}`} evenodd fill={C.gold} line={4} />
              <Line d="M-36,-18L0,0" size={8} color={C.gold} />
            </g>
            <g transform={`rotate(${snip / 2})`}>
              <Shape d="M0,0L120,10L130,0L120,-6Z" fill={C.white} line={4} />
              <Shape d={`${circle(-60, 30, 30)}${circle(-60, 30, 16)}`} evenodd fill={C.gold} line={4} />
              <Line d="M-36,18L0,0" size={8} color={C.gold} />
            </g>
          </g>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 35 - origami diamond
const K0: [number, number][] = [[-220, -220], [0, -220], [220, -220], [220, 220], [0, 220], [-220, 220]];
const K1: [number, number][] = [[-240, -40], [0, -40], [240, -40], [120, 120], [0, 250], [-120, 120]];
const K2: [number, number][] = [[-250, -70], [-110, -200], [110, -200], [250, -70], [0, 270], [0, 270]];
const mixPts = (a: [number, number][], b: [number, number][], t: number) => a.map(([x, y], i) => [lerp(x, b[i][0], t), lerp(y, b[i][1], t)] as [number, number]);

export const S35: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="gold" x={540} y={900} s={1400} o={0.5} />,
  render: (p) => {
    const {f} = p;
    const t1 = ease.inOutCubic(clamp((f - 6) / 16));
    const t2 = ease.inOutCubic(clamp((f - 26) / 16));
    const pts = t2 > 0 ? mixPts(K1, K2, t2) : mixPts(K0, K1, t1);
    const gold = clamp((f - 40) / 10);
    const spin = Math.sin(f / 14) * 8;
    const cx = 540;
    const cy = 880;
    const P = pts.map(([x, y]) => [x + cx, y + cy] as [number, number]);
    const facets = t2 > 0.6 ? `M${P[0][0]},${P[0][1]}L${P[3][0]},${P[3][1]}M${P[1][0]},${P[1][1]}L${P[4][0]},${P[4][1]}M${P[2][0]},${P[2][1]}L${P[4][0]},${P[4][1]}M${cx - 60},${cy - 200}L${cx - 110},${cy - 70}L${cx},${cy + 270}M${cx + 60},${cy - 200}L${cx + 110},${cy - 70}` : `M${cx},${cy - 220}L${cx},${cy + 220}`;
    return (
      <>
        <g transform={`rotate(${spin} ${cx} ${cy})`}>
          <Flat d={circle(cx, cy, 440)} fill="url(#glow-gold)" opacity={gold * 0.8} />
          <Shape d={poly(P)} fill={gold > 0.5 ? C.gold : C.candy} pattern={gold > 0.5 ? 'foil' : undefined} sheen={gold > 0.5} shade={poly([[cx, cy - 300], [cx + 300, cy - 300], [cx + 300, cy + 300], [cx, cy + 300]])} shadeInk={gold > 0.5 ? 'ht-gold-2' : 'ht-pink-2'} line={7} />
          <Line d={facets} size={4.5} opacity={0.8} />
        </g>
        {gold > 0.5 && [0, 1, 2, 3].map((i) => <Sparkle key={i} x={cx + [-280, 260, -200, 300][i]} y={cy + [-260, -200, 240, 180][i]} r={24 + 10 * Math.sin(f / 3 + i)} />)}
        {f < 26 && (
          <Note x={cx + 250} y={cy - 280} size={50} rot={8}>
            fold...
          </Note>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 36 - so cute
export const S36: SceneDef = {
  ground: 'blush',
  under: () => <Wash kind="pink" x={540} y={820} s={1500} o={0.6} v={2} />,
  render: (p) => {
    const {f} = p;
    const damn = p.w(2);
    const wink = f >= damn && f < damn + 24;
    const blushT = clamp((f - damn) / 8);
    return (
      <>
        <Precious
          place={{x: 540, y: 1830, scale: 1.72}}
          pose={{head: 6 * Math.sin(f / 12), uarmL: 10, uarmR: -10}}
          face={{eyes: wink ? 'wink' : 'dot', smile: 0.9, blush: 0.4 + 0.6 * blushT, blink: blink(f, 60)}}
        />
        <FloatHearts f={f - damn} x={540} y={700} n={8} seed={36} spread={700} color={C.hotpink} />
        {f >= damn && (
          <Pop f={f} at={damn} x={880} y={1000}>
            <Note x={880} y={1020} size={80} rot={10} color={C.hotpink}>
              damn.
            </Note>
          </Pop>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 37 - royalty
export const S37: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="gold" x={540} y={800} s={1500} o={0.55} />,
  render: (p) => {
    const {f} = p;
    const land = p.w(4);
    const crownY = f < land ? lerp(-300, 0, ease.inQuad(clamp(f / land))) : 0;
    const odd = p.beatN % 2 === 1;
    const dance: Pose = odd
      ? {uarmL: 130, farmL: 40, uarmR: -30, farmR: 120, pelvis: 7, torso: -7, head: -5}
      : {uarmR: -130, farmR: -40, uarmL: 30, farmL: -120, pelvis: -7, torso: 7, head: 5};
    const pp = {x: 540, y: 1000 - p.beat * 12, scale: 0.84};
    const head = worldPoint(PRECIOUS_PARTS, dance, pp, 'head', [0, -330]);
    return (
      <>
        <Flat d={circle(540, 760, 560)} fill="url(#glow-gold)" opacity={0.5 + 0.4 * p.beat} />
        <Floor y={1390} fill={C.release} />
        <Precious place={pp} pose={dance} face={{smile: 1, eyes: 'happy', mouth: 0.25}} style={{glow: 0.4}} />
        {f < land && (
          <g transform={`translate(${head[0]},${head[1] + crownY - 20})`}>
            <Shape d="M-70,0L-60,-70L-30,-34L0,-84L30,-34L60,-70L70,0Z" fill={C.gold} pattern="foil" sheen line={5} />
          </g>
        )}
        {f >= land && (
          <>
            <Precious place={pp} pose={dance} face={{smile: 1, eyes: 'happy', mouth: 0.25}} style={{glow: 0.4, crown: true}} />
            {f < land + 10 && <Sparkle x={head[0]} y={head[1] - 80} r={60 * (1 - (f - land) / 10)} />}
          </>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 38 - no ring (yet)
const BigHand: React.FC<{skin: string}> = ({skin}) => (
  <>
    <Shape d="M-160,120C-170,20 -150,-60 -110,-90L110,-90C150,-60 170,20 160,120C150,260 80,330 0,330C-80,330 -150,260 -160,120Z" fill={skin} shade="M40,-100L180,-100L180,340L40,340Z" shadeInk="ht-ink-2" line={7} />
    {[
      [-120, -80, -300, -10],
      [-45, -90, -380, -2],
      [35, -90, -360, 3],
      [110, -80, -280, 10],
    ].map(([x, y, len, rot], i) => (
      <g key={i} transform={`translate(${x},${y}) rotate(${rot})`}>
        <Shape d={`M-34,40L-32,${len + 34}C-32,${len - 4} 32,${len - 4} 32,${len + 34}L34,40Z`} fill={skin} line={6} />
        <Line d={`M-20,${len * 0.45}L20,${len * 0.45}`} size={3} opacity={0.5} />
        <Shape d={`M-22,${len + 36}C-22,${len + 14} 22,${len + 14} 22,${len + 36}Z`} fill={C.aqua} line={3} />
      </g>
    ))}
    <g transform="translate(150,110) rotate(50)">
      <Shape d="M-36,0L-34,-190C-34,-230 34,-230 34,-190L36,0Z" fill={skin} line={6} />
    </g>
    <Shape d={rect(-190, 300, 380, 300)} fill={C.hotpink} line={7} />
  </>
);

export const S38: SceneDef = {
  ground: 'blush',
  under: () => <Wash kind="aqua" x={760} y={1200} s={1100} o={0.5} />,
  render: (p) => {
    const {f} = p;
    const openT = p.w(1);
    const lid = ease.outBack(clamp((f - openT) / 8));
    const yet = p.w(3);
    return (
      <>
        <g transform="translate(360,1060) rotate(-8) scale(1.1)">
          <BigHand skin={C.preciousSkin} />
          <Shape d={ellipse(35, -210, 70, 34)} fill="none" dotted line={8} lineColor={C.ash} />
        </g>
        {/* ring box */}
        <g transform="translate(790,1120)">
          <Shape d={rect(-150, -40, 300, 160, 20)} fill={C.hotpink} shade={rect(40, -40, 120, 160)} shadeInk="ht-ink-2" line={7} />
          <Shape d={rect(-120, -34, 240, 60, 14)} fill="#3A1E2B" line={4} />
          <Flat d={ellipse(0, -8, 50, 16)} fill="#1A0E14" />
          <g transform={`translate(0,-40) rotate(${-110 * lid}) translate(0,40)`}>
            <Shape d="M-150,-40L150,-40L150,-110C150,-130 130,-140 110,-140L-110,-140C-130,-140 -150,-130 -150,-110Z" fill={C.hotpink} line={7} />
          </g>
        </g>
        {f >= openT + 6 && (
          <Note x={800} y={880} size={64} rot={-6} color={C.ash}>
            (empty)
          </Note>
        )}
        {f >= yet && (
          <Pop f={f} at={yet} x={820} y={1400}>
            <Note x={820} y={1400} size={96} rot={-8} color={C.hotpink}>
              (yet)
            </Note>
          </Pop>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 39 - the lady of rings
export const S39 = ThroneScene('precious');

export const HOOK2: Record<number, SceneDef> = {32: S32, 33: S33, 34: S34, 35: S35, 36: S36, 37: S37, 38: S38, 39: S39};

void S28;
void keys;
void Clip;
void PRECIOUS_POSES;
void Txt;
void FONT;
