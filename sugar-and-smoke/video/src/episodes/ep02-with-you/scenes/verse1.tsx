// No. 2, intro and verse 1 (lines 1-7): the snowy street, the little bits of light, the map back north.
import React from 'react';
import {C, FONT} from '../../../brand/tokens';
import {Pip, waddle} from '../../../characters/Pip';
import {Stein, STEIN_PARTS, STEIN_POSES} from '../../../characters/Stein';
import {clamp, ease, lerp, prog} from '../../../lib/ease';
import {Flat, Line, Shape, Txt} from '../../../lib/print';
import {rng} from '../../../lib/random';
import {Pose, worldPoint} from '../../../lib/rig';
import {SceneDef} from '../../../lib/scene';
import {Arrow, circle, Clip, ellipse, heart, Note, Pop, rect, smooth, Wash} from '../../../props/common';
import {Drift, Footprints, House, Snow, Streetlight} from '../../../props/winter';

const W = {winter: true} as const;
const blink = (f: number, every = 97, off = 0) => ((f + off) % every < 4 ? 1 : 0);

// A little bit of warm light, held in a mitten.
export const Glow: React.FC<{x: number; y: number; s?: number; f: number}> = ({x, y, s = 1, f}) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <Flat d={circle(0, 0, 110)} fill="url(#glow-amber)" opacity={0.75 + 0.2 * Math.sin(f / 6)} />
    <Shape d={heart(0, 4, 30)} fill={C.amber} line={4} />
    <Flat d={circle(-8, -6, 7)} fill={C.white} opacity={0.8} />
  </g>
);

const BareTree: React.FC<{x: number; y: number; s?: number}> = ({x, y, s = 1}) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <Line d="M0,0L0,-420M0,-200L-90,-330M0,-260L80,-400M0,-340L-40,-440M-60,-300L-120,-340M50,-360L110,-380" size={9} color="#2C3442" />
    <Line d="M-90,-330L-110,-360M80,-400L96,-440M-40,-440L-30,-470" size={5} color="#2C3442" />
    <Flat d="M-100,-336C-90,-344 -80,-340 -76,-332ZM70,-404C80,-410 92,-406 96,-398Z" fill={C.white} />
  </g>
);

// ---------------------------------------------------------------- Intro: the cover comes alive
export const Intro: SceneDef = {
  ground: 'dusk',
  camera: (p) => ({zoom: 1 + 0.08 * prog(p.f, 300, p.dur - 300, ease.inOutSine), y: -40 * prog(p.f, 300, p.dur - 300, ease.inOutSine)}),
  render: (p) => {
    const {f} = p;
    const walkEnd = 330;
    const px = lerp(-80, 620, clamp(f / walkEnd));
    const walking = f < walkEnd;
    const lookDown = f > walkEnd + 20;
    const title = clamp((f - 150) / 16);
    const typed = 'With You'.slice(0, Math.floor(clamp((f - 190) / 30) * 8));
    const small = clamp((f - 240) / 14);
    const fadeTitle = 1 - clamp((f - 470) / 30);
    const lit = (k: number) => clamp((f - 60 - k * 40) / 10);
    return (
      <>
        <Snow f={f} n={70} seed={1} speed={0.5} />
        <Flat d={circle(880, 250, 56)} fill={C.goldHi} opacity={0.85} />
        <Flat d={circle(880, 250, 170)} fill="url(#glow-cotton)" opacity={0.35} />
        <House x={-60} y={1330} w={460} h={330} lit={lit(0)} seed={2} />
        <House x={460} y={1310} w={380} h={300} body="#505B6D" lit={lit(1)} seed={5} />
        <BareTree x={930} y={1330} s={1.05} />
        <Streetlight x={400} y={1380} h={640} on={clamp((f - 20) / 12)} />
        <Drift y={1350} seed={4} />
        <Footprints x0={-40} y0={1500} x1={1120} y1={1540} n={16} s={1.1} o={0.7} />
        <Pip
          place={{x: px, y: 1420 - (walking ? Math.abs(Math.sin((f / 18) * Math.PI)) * 6 : 0), scale: 0.95}}
          pose={walking ? waddle(f, 18) : {head: lookDown ? 22 : 0, body: lookDown ? 8 : 0, flipperL: 8, flipperR: -8}}
          face={{eyes: blink(f, 70) ? 'closed' : 'dot'}}
        />
        <Snow f={f} n={24} seed={2} speed={0.9} big />
        <g opacity={fadeTitle}>
          <g transform={`translate(540,470) scale(${0.85 + 0.15 * ease.outBack(title)}) translate(-540,-470)`} opacity={title}>
            <Txt x={550} y={478} size={170} font={FONT.lyric} weight={800} color={C.hotpink} spacing={-5} opacity={0.9}>
              mbastein
            </Txt>
            <Txt x={540} y={470} size={170} font={FONT.lyric} weight={800} color="url(#foil)" spacing={-5} stroke={C.goldLo} strokeWidth={5}>
              mbastein
            </Txt>
          </g>
          <Txt x={540} y={600} size={104} font={FONT.lyric} weight={700} color={C.white}>
            {typed}
          </Txt>
          <Txt x={540} y={680} size={30} font={FONT.tag} weight={700} spacing={4} color={C.ice} opacity={small}>
            SUGAR &amp; SMOKE · NO. 2
          </Txt>
        </g>
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 01
export const S01: SceneDef = {
  ground: 'frost',
  under: () => <Wash kind="amber" x={540} y={900} s={1400} o={0.3} />,
  render: (p) => {
    const {f} = p;
    const r = rng(201);
    const folk = [150, 360, 780, 960].map((x, i) => ({x, h: 0.46 + r() * 0.1, i}));
    const pose: Pose = {...STEIN_POSES.stand, uarmR: -60, farmR: -90, uarmL: 10};
    const place = {x: 560, y: 1000, scale: 0.72};
    const hand = worldPoint(STEIN_PARTS, pose, place, 'handR', [0, 40]);
    return (
      <>
        <Snow f={f} n={50} seed={3} speed={0.6} color={C.white} />
        {folk.map(({x, h, i}) => (
          <g key={i} transform={`translate(${x},${1230}) scale(${h * 2})`}>
            <Shape d={circle(0, -300, 40)} fill={C.slate} line={4} />
            <Shape d={rect(-56, -260, 112, 200, 36)} fill={C.slate} line={4} />
            <Shape d={rect(-44, -70, 36, 80, 12)} fill={C.slate} line={4} />
            <Shape d={rect(8, -70, 36, 80, 12)} fill={C.slate} line={4} />
            <Glow x={56} y={-190} s={0.6} f={f + i * 7} />
          </g>
        ))}
        <Drift y={1250} seed={5} />
        <Stein place={place} pose={pose} style={W} face={{mouth: p.mouth, smile: 0.7, look: [0.6, -0.6]}} />
        <Glow x={hand[0]} y={hand[1] - 60} s={1.1} f={f} />
        <Pip place={{x: 820, y: 1260, scale: 0.6}} pose={{flipperR: -60, head: -8}} face={{eyes: 'happy'}} holdR={<g transform="rotate(60) translate(10,150)"><Glow x={0} y={0} s={0.4} f={f + 3} /></g>} />
        <Note x={540} y={420} size={60} rot={-4}>
          a little bit
        </Note>
      </>
    );
  },
};

// A simplified California, as in No. 1.
const CA: [number, number][] = [[30, 0], [300, 0], [300, 330], [600, 690], [592, 770], [560, 900], [340, 890], [290, 820], [230, 780], [150, 700], [110, 600], [70, 470], [36, 380], [8, 290], [0, 170], [14, 80]];

// ---------------------------------------------------------------- No. 02
export const S02: SceneDef = {
  ground: 'frost',
  render: (p) => {
    const {f} = p;
    const route = [[380, 840], [300, 760], [230, 600], [180, 450], [150, 300], [140, 120], [180, -40]] as [number, number][];
    const t = clamp(f / (p.dur - 6));
    const upto = Math.max(1, Math.floor(t * (route.length - 1)) + 1);
    const pts = route.slice(0, upto + 1);
    const k = t * (route.length - 1) - Math.floor(t * (route.length - 1));
    const a = route[Math.min(upto - 1, route.length - 1)];
    const b = route[Math.min(upto, route.length - 1)];
    const car: [number, number] = [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
    const ca = CA.map(([x, y]) => [x * 0.9 + 60, y * 0.9 + 60] as [number, number]);
    return (
      <>
        <g transform="translate(190,520)">
          <Shape d={rect(0, 0, 700, 940, 6)} fill={C.white} line={6} />
          <Clip d={rect(0, 0, 700, 940)}>
            <Flat d={rect(0, 0, 700, 940)} fill={C.ice} opacity={0.8} />
            <Shape d={smooth(ca, true, 0.3)} fill={C.release} line={5} />
            <Flat d={rect(0, 0, 700, 230)} fill={C.white} opacity={0.6} />
          </Clip>
          <Line d="M233,0L233,940M466,0L466,940" size={3} opacity={0.4} />
          <Shape d={smooth(pts, false)} fill="none" dotted line={9} lineColor={C.hotpink} />
          <Shape d={circle(380, 840, 12)} fill={C.gold} line={3} />
          <Txt x={420} y={880} size={40} font={FONT.hand}>
            SoCal
          </Txt>
          <g transform={`translate(${car[0]},${car[1]}) rotate(-70)`}>
            <Shape d="M-40,10L-34,-14C-24,-26 20,-26 30,-12L40,10Z" fill={C.teal} line={4} />
            <Shape d={circle(-22, 12, 9)} fill={C.ink} line={2.5} />
            <Shape d={circle(22, 12, 9)} fill={C.ink} line={2.5} />
          </g>
        </g>
        <Pop f={f} at={p.dur - 14} x={360} y={430}>
          <Shape d={`M360,480L330,420L390,420Z`} fill={C.iceInk} line={4} />
          <Line d="M360,380L360,440M334,396L386,424M334,424L386,396" size={6} color={C.iceInk} />
        </Pop>
        <Note x={700} y={400} size={62} rot={-4}>
          back up north
        </Note>
        <Arrow d="M560,440C520,470 460,480 420,470" head={[420, 470, 190]} size={6} />
        <Snow f={f} n={30} seed={6} speed={0.7} />
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 03
export const S03: SceneDef = {
  ground: 'frost',
  camera: (p) => {
    const dive = prog(p.f, p.w(5) - 4, 16, ease.inOutCubic);
    return {zoom: 1 + dive * 0.25};
  },
  render: (p) => {
    const {f} = p;
    const snap = p.w(3);
    const shut = f >= snap;
    const eyeT = clamp((f - p.w(5) + 2) / 10);
    return (
      <>
        {eyeT < 1 && (
          <g opacity={1 - eyeT}>
            <Shape d={rect(250, 980, 580, 190, 10)} fill={C.release} shade={rect(560, 980, 280, 190)} shadeInk="ht-gold-1" line={6} />
            <Line d="M300,1040L780,1040M300,1110L780,1110" size={3} opacity={0.4} />
            {/* trigger plate with the bait */}
            <Shape d={rect(600, 1030, 120, 90, 8)} fill={C.smoke} line={4} />
            <Shape d={heart(660, 1070, 42)} fill={C.hotpink} line={5} />
            {/* spring and hinge */}
            <Line d="M520,1010L520,1150" size={8} color={C.ash} />
            {[0, 1, 2, 3].map((k) => (
              <Shape key={k} d={ellipse(520, 1030 + k * 30, 16, 12)} fill="none" line={4} lineColor={C.ash} />
            ))}
            {/* the bar: lies open to the left, then whips over to the right */}
            {(() => {
              const th = shut ? Math.PI * (1 - ease.outBack(clamp((f - snap) / 5))) : Math.PI;
              const end = 520 + 250 * Math.cos(th);
              return <Line d={`M520,1000L${end},1000L${end},1160L520,1160`} size={8} color={C.ash} />;
            })()}
            {shut && f < snap + 12 && (
              <>
                <Line d="M400,860L360,800M540,840L540,770M680,860L720,800" size={7} />
                <Note x={540} y={740} size={90} rot={-6}>
                  snap!
                </Note>
              </>
            )}
          </g>
        )}
        {eyeT > 0 && (
          <g opacity={eyeT}>
            <Shape d="M60,960C260,720 820,720 1020,960C820,1200 260,1200 60,960Z" fill={C.white} line={9} />
            <Clip d="M60,960C260,720 820,720 1020,960C820,1200 260,1200 60,960Z">
              <Shape d={circle(540, 960, 210)} fill="#6B4331" shade={circle(600, 1000, 200)} shadeInk="ht-ink-2" line={6} />
              <Shape d={circle(540, 960, 110)} fill={C.ink} line={4} />
              <Stein place={{x: 540, y: 1010, scale: 0.13}} pose={{uarmR: -120, farmR: -20}} style={W} face={{smile: 0.8}} />
              <Flat d={ellipse(470, 890, 40, 26)} fill={C.white} opacity={0.85} />
            </Clip>
            <Line d="M80,930C280,700 800,700 1000,930" size={7} />
            {[0, 1, 2, 3, 4, 5].map((k) => (
              <Line key={k} d={`M${200 + k * 136},${790 - Math.sin((k / 5) * Math.PI) * 70}L${190 + k * 136},${720 - Math.sin((k / 5) * Math.PI) * 80}`} size={6} />
            ))}
          </g>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 04
export const S04: SceneDef = {
  ground: 'cotton',
  render: (p) => {
    const {f} = p;
    const wake = p.w(7);
    const up = f >= wake;
    const shake = up ? 0 : Math.sin(f * 2.2) * 6;
    return (
      <>
        {/* frosted window */}
        <Shape d={rect(560, 260, 420, 520, 10)} fill={C.ice} line={7} />
        <Flat d={rect(560, 260, 420, 520)} fill="url(#ht-cotton-2)" opacity={0.7} />
        <Line d="M770,260L770,780M560,520L980,520" size={6} />
        <Wash kind="ice" x={770} y={520} s={600} o={0.5} />
        <Shape d={rect(530, 780, 480, 30, 8)} fill={C.white} line={5} />
        {/* alarm clock on the sill */}
        <g transform={`translate(${720 + shake},700) rotate(${shake})`}>
          <Shape d={circle(0, 0, 70)} fill={C.hotpink} line={6} />
          <Shape d={circle(0, 0, 52)} fill={C.white} line={4} />
          <Line d="M0,0L0,-36M0,0L26,10" size={5} />
          <Shape d={circle(-52, -60, 22)} fill={C.gold} line={4} />
          <Shape d={circle(52, -60, 22)} fill={C.gold} line={4} />
          <Line d="M-40,62L-54,84M40,62L54,84" size={6} />
          {!up && <Line d="M-110,-40L-140,-60M-110,0L-146,0M110,-40L140,-60M110,0L146,0" size={5} />}
        </g>
        {/* bed */}
        <Shape d={rect(40, 1000, 1000, 380, 20)} fill={C.teal} line={7} />
        <Shape d="M100,960C220,900 400,900 470,960C450,1020 240,1030 100,1010Z" fill={C.white} line={6} />
        <Stein place={{x: 700, y: 1085, scale: 0.8, rotate: -80}} pose={{uarmL: 0, uarmR: 0}} style={{chain: false}} face={{eyes: up ? 'wide' : 'closed', smile: up ? 0.1 : 0.4, mouth: up ? 0.3 : 0, look: [0, 0]}} />
        <Shape d="M40,1060C300,1020 700,1030 1040,1050L1040,1380L40,1380Z" fill={C.candy} shade="M40,1200L1040,1200L1040,1380L40,1380Z" shadeInk="ht-pink-2" line={7} />
        {up && (
          <Pop f={f} at={wake} x={200} y={700}>
            <Note x={220} y={740} size={100} rot={-10} color={C.hotpink}>
              !
            </Note>
          </Pop>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 05
export const S05: SceneDef = {
  ground: 'dusk',
  render: (p) => {
    const {f} = p;
    return (
      <>
        <Snow f={f} n={60} seed={7} speed={0.6} />
        <Shape d={rect(80, 520, 920, 820)} fill="#4A5566" shade={rect(700, 520, 300, 820)} shadeInk="ht-ink-2" line={7} />
        {/* the warm window: their room */}
        <Flat d={circle(700, 820, 300)} fill="url(#glow-amber)" opacity={0.8} />
        <Shape d={rect(520, 640, 380, 330, 8)} fill={C.amber} line={7} />
        <Clip d={rect(520, 640, 380, 330)}>
          <Shape d={rect(560, 850, 300, 90, 20)} fill={C.hotpink} line={5} />
          <Shape d={rect(560, 800, 70, 90, 16)} fill={C.hotpink} line={5} />
          <Shape d={rect(790, 800, 70, 90, 16)} fill={C.hotpink} line={5} />
          <Shape d={heart(710, 740, 30)} fill={C.candy} line={4} />
          <Shape d={rect(600, 700, 60, 70, 4)} fill={C.white} line={4} />
        </Clip>
        <Line d="M710,640L710,970M520,805L900,805" size={6} />
        <Shape d={rect(160, 800, 220, 540, 8)} fill={C.teal} line={7} />
        <Shape d={circle(340, 1080, 14)} fill={C.gold} line={4} />
        <Drift y={1320} seed={8} />
        <Stein place={{x: 300, y: 1060, scale: 0.72, flip: true}} pose={{uarmL: 40, farmL: -60, uarmR: -10}} style={W} face={{turn: -0.5, look: [1, 0], smile: 0.3, blink: blink(f, 60)}} />
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 06
export const S06: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="ice" x={540} y={900} s={1400} o={0.35} />,
  render: (p) => {
    const {f} = p;
    const flip = Math.floor(f / 18);
    const inPage = f % 18;
    const cells = Math.min(35, Math.floor(inPage * 2.2) + (flip > 0 ? 0 : 0));
    return (
      <>
        <Line d="M540,300L540,380" size={5} />
        <Shape d={circle(540, 300, 12)} fill={C.gold} line={4} />
        <Shape d={rect(200, 380, 680, 820, 10)} fill={C.white} line={7} />
        <Shape d={rect(200, 380, 680, 150, 10)} fill={C.hotpink} line={7} />
        <Txt x={540} y={480} size={64} font={FONT.lyric} weight={800} color={C.white}>
          {['DECEMBER', 'JANUARY', 'FEBRUARY', 'MARCH'][flip % 4]}
        </Txt>
        {Array.from({length: 35}, (_, i) => {
          const cx = 230 + (i % 7) * 90;
          const cy = 560 + Math.floor(i / 7) * 124;
          return (
            <g key={i}>
              <Shape d={rect(cx, cy, 80, 110, 4)} fill={C.cotton} line={3} shadow={false} />
              {i < cells && <Shape d={heart(cx + 40, cy + 58, 24)} fill={C.hotpink} line={3} />}
            </g>
          );
        })}
        {inPage > 13 && <Shape d={`M200,${380 + (inPage - 13) * 60}L880,${380 + (inPage - 13) * 40}L880,380L200,380Z`} fill={C.white} line={5} />}
        <Note x={540} y={1300} size={60} rot={-3}>
          every day
        </Note>
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 07
export const S07: SceneDef = {
  ground: 'frost',
  under: () => <Wash kind="amber" x={540} y={800} s={1300} o={0.35} />,
  render: (p) => {
    const {f} = p;
    const ok = p.w(5);
    return (
      <>
        <Snow f={f} n={50} seed={9} speed={0.6} />
        <Drift y={1300} seed={10} />
        <Stein place={{x: 470, y: 960, scale: 0.84, rotate: -3}} pose={{uarmR: -20, farmR: 150, uarmL: 36, farmL: -110, head: -6}} style={W} face={{mouth: p.mouth, smile: 0.9, brow: 0.8, browTilt: -0.6}} />
        <Pip place={{x: 850, y: 1250, scale: 0.62}} pose={{flipperR: -120, head: -10, body: -4}} face={{eyes: 'happy'}} />
        {f >= ok && (
          <Pop f={f} at={ok} x={820} y={620}>
            <Note x={820} y={650} size={96} rot={8} color={C.hotpink}>
              okay.
            </Note>
          </Pop>
        )}
      </>
    );
  },
};

export const VERSE1: Record<number, SceneDef> = {0: Intro, 1: S01, 2: S02, 3: S03, 4: S04, 5: S05, 6: S06, 7: S07};
