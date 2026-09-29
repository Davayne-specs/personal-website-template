// No. 2, chorus and verse 3 (lines 20-27): the snow-globe futures, winter, ice, chill, bed, yesterday.
import React from 'react';
import {C, FONT} from '../../../brand/tokens';
import {Pip} from '../../../characters/Pip';
import {Precious} from '../../../characters/Precious';
import {Stein, STEIN_PARTS} from '../../../characters/Stein';
import {clamp, ease, lerp, prog} from '../../../lib/ease';
import {Flat, Line, Shape, Txt} from '../../../lib/print';
import {rng} from '../../../lib/random';
import {chainAngle, Pose} from '../../../lib/rig';
import {SceneDef} from '../../../lib/scene';
import {circle, Clip, ellipse, FloatHearts, heart, Note, Pop, poly, rect, smooth, SmokePuff, Sparkle, Wash} from '../../../props/common';
import {Drift, House, Mug, Snow} from '../../../props/winter';

const W = {winter: true} as const;
const SIT: Pose = {thighL: 80, shinL: -80, thighR: -80, shinR: 80}; // front-on, knees apart
const blink = (f: number, every = 97, off = 0) => ((f + off) % every < 4 ? 1 : 0);

// A knitted mitten, fingers up, thumb to the right.
const Mitten: React.FC<{x: number; y: number; r: number; color: string; flip?: boolean}> = ({x, y, r, color, flip}) => (
  <g transform={`translate(${x},${y}) rotate(${r}) scale(${flip ? -1 : 1},1)`}>
    <Shape d="M40,-4C70,-28 98,-8 90,22C82,42 62,42 50,30Z" fill={color} line={5} />
    <Shape d="M-60,60C-72,0 -62,-84 -8,-92C42,-98 68,-52 64,0L60,60Z" fill={color} shade="M20,-100L80,-100L80,60L20,60Z" shadeInk="ht-ink-1" line={6} />
    <Shape d={rect(-68, 48, 136, 50, 14)} fill={C.white} line={5} />
    <Line d="M-44,56L-44,90M-14,56L-14,90M16,56L16,90M46,56L46,90" size={3} opacity={0.5} />
  </g>
);

// ---------------------------------------------------------------- No. 20 & 21: the snow globe
const Globe = (later: boolean): SceneDef => ({
  ground: 'dusk',
  render: (p) => {
    const {f} = p;
    const wob = Math.sin(f / 3) * 5 * Math.exp(-f / 20);
    const cx = 540;
    const cy = 820;
    const R = 300;
    const sphere = circle(cx, cy, R);
    return (
      <>
        <Snow f={f} n={30} seed={20} speed={0.4} />
        <Flat d={circle(cx, cy, R + 160)} fill="url(#glow-amber)" opacity={0.45} />
        <g transform={`rotate(${wob} ${cx} ${cy + R})`}>
          <Shape d={sphere} fill="#DCE8F0" line={8} />
          <Clip d={sphere}>
            <Flat d={rect(cx - R, cy - R, 2 * R, 2 * R)} fill={later ? '#FBE8C8' : '#C9DCEA'} />
            <Drift y={cy + 150} seed={later ? 22 : 21} />
            {!later ? (
              <>
                <Shape d={rect(cx + 60, cy - 200, 40, 70)} fill="#3A4252" line={5} />
                <House x={cx - 150} y={cy + 150} w={300} h={210} body="#4A5566" lit={1} seed={4} />
                {[0, 1, 2].map((k) => (
                  <SmokePuff key={k} x={cx + 90 + k * 10 + Math.sin(f / 9 + k) * 10} y={cy - 230 - k * 50 - ((f * 1.2) % 50)} s={90 + k * 30} o={0.8 - k * 0.2} v={((k % 4) + 1) as 1 | 2 | 3 | 4} />
                ))}
              </>
            ) : (
              <>
                <Line d={`M${cx - 170},${cy - 290}L${cx - 150},${cy - 20}M${cx + 170},${cy - 290}L${cx + 150},${cy - 20}`} size={5} />
                <g transform={`rotate(${Math.sin(f / 16) * 4} ${cx} ${cy - 290})`}>
                  <Shape d={rect(cx - 190, cy - 30, 380, 40, 10)} fill={C.goldLo} line={6} />
                  <Stein place={{x: cx - 75, y: cy - 60, scale: 0.32}} pose={{...SIT, uarmR: -30, farmR: -40}} style={{aged: true, winter: true}} face={{smile: 0.9, eyes: 'happy'}} />
                  <Precious place={{x: cx + 80, y: cy - 58, scale: 0.32}} pose={{...SIT, uarmL: 30, farmL: 40}} style={{aged: true, winter: true}} face={{smile: 0.9, eyes: 'happy'}} />
                </g>
                <Pip place={{x: cx - 150, y: cy + 160, scale: 0.28}} pose={{head: -8}} face={{eyes: 'happy'}} />
                <Pip place={{x: cx + 150, y: cy + 160, scale: 0.26, flip: true}} scarfColor={C.aqua} face={{eyes: 'happy'}} />
              </>
            )}
            <Snow f={f * 2} n={40} seed={later ? 24 : 23} speed={0.6} y0={cy - R} y1={cy + R} />
          </Clip>
          <Line d={`M${cx - 200},${cy - 200}C${cx - 150},${cy - 260} ${cx - 60},${cy - 290} ${cx + 10},${cy - 290}`} size={9} color={C.white} opacity={0.8} />
          <Shape d={`M${cx - 250},${cy + R - 60}L${cx + 250},${cy + R - 60}L${cx + 300},${cy + R + 100}L${cx - 300},${cy + R + 100}Z`} fill={C.gold} pattern="foil" sheen line={7} />
          <Txt x={cx} y={cy + R + 50} size={36} font={FONT.tag} weight={700}>
            {later ? 'SOMEDAY' : 'SOON'}
          </Txt>
        </g>
        {/* his mitten and hers, holding it between them */}
        <Mitten x={cx - 318} y={cy + R + 40} r={14} color={C.hotpink} />
        <Mitten x={cx + 318} y={cy + R + 40} r={-14} color={C.teal} flip />
      </>
    );
  },
});
export const S20 = Globe(false);
export const S21 = Globe(true);

// ---------------------------------------------------------------- No. 22 - winter
export const S22: SceneDef = {
  ground: 'frost',
  under: () => (
    <>
      <Wash kind="ice" x={80} y={200} s={900} o={0.6} />
      <Wash kind="ice" x={1000} y={1500} s={900} o={0.6} />
    </>
  ),
  render: (p) => {
    const {f} = p;
    const jit = Math.sin(f * 2.1) * 4;
    const level = lerp(0.72, 0.06, prog(f, 0, p.dur - 10, ease.inOutCubic));
    return (
      <>
        <Snow f={f} n={90} seed={25} speed={2.2} wind={1.6} big />
        <Drift y={1300} seed={26} />
        <Stein place={{x: 390 + jit, y: 1000, scale: 0.78}} pose={{uarmL: 40, farmL: -120, uarmR: -40, farmR: 120, head: 4}} style={W} face={{eyes: 'dot', mouth: f % 6 < 3 ? 0.25 : 0.1, smile: -0.3, brow: 0.4, browTilt: 0.8}} />
        <Pip place={{x: 690 - jit, y: 1270, scale: 0.6}} pose={{flipperL: 30, flipperR: -30, head: 6}} face={{eyes: 'closed'}} />
        {[0, 1].map((k) => (
          <Line key={k} d={`M${330 + k * 120 + jit},${560 - k * 20}L${320 + k * 120 + jit},${520 - k * 20}`} size={5} color={C.iceInk} />
        ))}
        {/* thermometer */}
        <g transform="translate(900,640)">
          <Shape d={rect(-40, -300, 80, 560, 40)} fill={C.white} line={6} />
          <Shape d={circle(0, 300, 70)} fill={level < 0.3 ? C.iceInk : C.pressure} line={6} />
          <Shape d={rect(-18, 260 - 520 * level, 36, 520 * level + 40, 10)} fill={level < 0.3 ? C.iceInk : C.pressure} line={3} />
          {Array.from({length: 9}, (_, k) => <Line key={k} d={`M40,${-260 + k * 60}L64,${-260 + k * 60}`} size={4} />)}
        </g>
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 23 - ice
export const S23: SceneDef = {
  ground: 'frost',
  under: () => <Wash kind="ice" x={540} y={900} s={1500} o={0.45} />,
  render: (p) => {
    const {f} = p;
    const look = Math.sin(f / 7);
    const px = lerp(1250, -200, clamp((f - 30) / 70));
    return (
      <>
        <Shape d={rect(-40, 1270, 1160, 700)} fill="#D6E7F1" line={6} shadow={false} />
        <Line d="M-40,1330L300,1320M500,1340L1120,1330" size={3} color={C.iceInk} opacity={0.6} />
        <Stein place={{x: 540, y: 960, scale: 0.8}} pose={{uarmL: 20, uarmR: -20, farmL: -10, farmR: 10}} style={W} face={{eyes: 'wide', look: [look, 0], smile: -0.2, mouth: 0}} />
        {/* the block of ice */}
        <Shape d={poly([[250, 380], [830, 360], [860, 1300], [220, 1320]])} fill={C.ice} opacity={0.55} line={8} lineColor={C.iceInk} />
        <Line d="M290,430L380,420M300,470L340,466M760,1200L820,1190" size={8} color={C.white} opacity={0.9} />
        <Line d="M700,420L660,520L700,600L650,700" size={4} color={C.white} opacity={0.8} />
        <Flat d="M260,400L320,398L280,1300L240,1300Z" fill={C.white} opacity={0.35} />
        {/* Pip belly-slides past */}
        {f > 30 && f < 110 && (
          <>
            <Pip place={{x: px, y: 1212, scale: 0.6, rotate: 82, flip: true}} pose={{flipperL: -40, flipperR: 40, head: -20}} face={{eyes: 'happy'}} />
            <Line d={`M${px + 130},1236L${px + 270},1236M${px + 150},1262L${px + 250},1262`} size={5} color={C.iceInk} />
          </>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 24 - chill
const Fire: React.FC<{x: number; y: number; f: number; flare?: number}> = ({x, y, f, flare = 0}) => (
  <>
    <Flat d={circle(x, y - 60, 260 * (1 + flare * 0.5))} fill="url(#glow-amber)" opacity={0.7 + 0.2 * Math.sin(f / 2)} />
    {[0, 1, 2].map((k) => {
      const h = (110 + 30 * Math.sin(f / 2 + k * 2)) * (1 + flare * 0.9);
      const xx = x + (k - 1) * 50;
      return <Shape key={k} d={`M${xx - 40},${y}C${xx - 50},${y - h * 0.5} ${xx - 10},${y - h * 0.7} ${xx},${y - h}C${xx + 10},${y - h * 0.7} ${xx + 50},${y - h * 0.5} ${xx + 40},${y}Z`} fill={k === 1 ? C.amber : C.pressure} line={4} />;
    })}
  </>
);

const Fireplace: React.FC<{x: number; y: number; f: number; flare?: number}> = ({x, y, f, flare = 0}) => (
  <>
    <Shape d={rect(x - 200, y - 380, 400, 380)} fill={C.candy} shade={rect(x + 60, y - 380, 140, 380)} shadeInk="ht-pink-2" line={7} />
    <Shape d={rect(x - 240, y - 420, 480, 50, 8)} fill={C.white} line={6} />
    <Shape d={`M${x - 120},${y}L${x - 120},${y - 200}C${x - 120},${y - 280} ${x + 120},${y - 280} ${x + 120},${y - 200}L${x + 120},${y}Z`} fill="#2C2238" line={6} />
    <Fire x={x} y={y - 20} f={f} flare={flare} />
  </>
);

export const S24: SceneDef = {
  ground: 'cotton',
  render: (p) => {
    const {f} = p;
    const drop = ease.outBack(clamp(f / 12));
    const pose: Pose = {thighL: 80, shinL: -80, thighR: 76, shinR: -76, uarmL: 40, farmL: -60, uarmR: 24, farmR: 118, torso: -6};
    const cocoa = (
      <g transform={`rotate(${-chainAngle(STEIN_PARTS, pose, 'handR')}) translate(4,26)`}>
        <Mug x={0} y={0} f={f} s={0.72} />
      </g>
    );
    return (
      <>
        <Shape d={rect(70, 380, 330, 400, 10)} fill="#2C3548" line={7} />
        <Clip d={rect(70, 380, 330, 400)}>
          <Snow f={f} n={20} seed={27} speed={0.7} y0={360} y1={800} />
        </Clip>
        <Line d="M235,380L235,780M70,580L400,580" size={6} />
        <Fireplace x={860} y={1180} f={f} />
        <Shape d={rect(-40, 1180, 1160, 800)} fill={C.release} line={6} shadow={false} />
        {/* sofa */}
        <Shape d={rect(30, 900, 620, 160, 40)} fill={C.hotpink} line={7} />
        <Stein place={{x: 330, y: lerp(800, 985, drop), scale: 0.62}} pose={pose} style={W} face={{eyes: 'happy', smile: 0.9, mouth: p.mouth * 0.5}} holdR={cocoa} />
        <Shape d={rect(10, 1030, 660, 170, 40)} fill={C.hotpink} line={7} />
        <Shape d="M150,1000C230,980 450,990 530,1010L550,1150L140,1150Z" fill={C.candy} shade="M140,1080L550,1080L550,1150L140,1150Z" shadeInk="ht-pink-2" line={6} />
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 25 & 26: the bed
const Bed = (tent: boolean): SceneDef => ({
  ground: 'dusk',
  render: (p) => {
    const {f} = p;
    const ok = p.w(5);
    const lift = tent ? ease.inOutCubic(clamp((f - 10) / 26)) : 0;
    const top = lerp(1060, 700, lift);
    const gig = (k: number) => (tent ? lift * (34 + 12 * Math.sin(f / 2.6 + k * 1.7)) : 0);
    const edge: [number, number][] = [
      [40, top + 40],
      [190, top - 50 * lift],
      [320, top - 100 * lift - gig(0)],
      [540, top - 70 * lift],
      [760, top - 100 * lift - gig(1)],
      [890, top - 50 * lift],
      [1040, top + 40],
    ];
    const quilt = `${smooth(edge, false, 0.5)}L1040,1480L40,1480Z`;
    return (
      <>
        <Shape d={rect(620, 260, 360, 380, 10)} fill="#2C3548" line={7} />
        <Clip d={rect(620, 260, 360, 380)}>
          <Flat d={circle(880, 360, 46)} fill={C.goldHi} />
          <Snow f={f} n={16} seed={28} speed={0.5} y0={240} y1={660} />
        </Clip>
        <Shape d={rect(60, 620, 960, 360, 30)} fill={C.teal} line={7} />
        <Shape d="M120,900C200,840 420,840 500,900C480,960 180,970 120,950Z" fill={C.white} line={6} />
        <Shape d="M580,900C660,840 880,840 960,900C940,960 640,970 580,950Z" fill={C.white} line={6} />
        {!tent || lift < 0.95 ? (
          <>
            <Stein place={{x: 320, y: 1280, scale: 0.7}} pose={{uarmR: -20, farmR: -60}} style={{chain: false, pyjamas: true}} face={{smile: 0.8, look: [0.3, 0.5], blink: blink(f, 50)}} />
            <Precious place={{x: 760, y: 1290, scale: 0.7}} pose={{uarmL: 20, farmL: 60}} face={{smile: 0.9, look: [-0.3, 0.5], blink: blink(f, 60, 20)}} />
            <Flat d={ellipse(540, 900, 380, 140)} fill="url(#glow-ice)" opacity={0.5} />
          </>
        ) : null}
        <Shape d={quilt} fill={C.candy} shade={`M40,${top + 140}L1040,${top + 140}L1040,1480L40,1480Z`} shadeInk="ht-pink-2" line={7} />
        {[0, 1, 2, 3].map((k) => (
          <Line key={k} d={`M${160 + k * 240},${top + 60 - (tent ? 60 * lift : 0)}L${160 + k * 240},1480`} size={3.5} opacity={0.5} />
        ))}
        {!tent && (
          <>
            <Shape d="M420,1060L660,1060L700,1180L380,1180Z" fill="#3A4252" line={6} />
            <Flat d={rect(430, 1064, 220, 8)} fill={C.ice} opacity={0.9} />
            <Flat d={heart(540, 1122, 22)} fill={C.ice} opacity={0.85} />
            <Shape d={rect(360, 1176, 360, 18, 6)} fill={C.smoke} line={4} />
            <Shape d={ellipse(540, 1250, 90, 34)} fill={C.white} line={5} />
            {[0, 1, 2, 3, 4].map((k) => <Shape key={k} d={circle(490 + k * 25, 1232 - (k % 2) * 10, 14)} fill={C.goldHi} line={3} />)}
          </>
        )}
        {tent && lift > 0.5 && <Flat d={ellipse(540, top + 140, 300, 120)} fill="url(#glow-ice)" opacity={0.6} />}
        {tent && lift > 0.8 && <FloatHearts f={f - 36} x={540} y={top - 40} n={6} seed={26} spread={240} color={C.hotpink} />}
        {tent && f >= ok && (
          <Pop f={f} at={ok} x={860} y={560}>
            <Note x={860} y={580} size={90} rot={8} color={C.white}>
              okay.
            </Note>
          </Pop>
        )}
      </>
    );
  },
});
export const S25 = Bed(false);
export const S26 = Bed(true);

// ---------------------------------------------------------------- No. 27 - yesterday
export const S27: SceneDef = {
  ground: 'cotton',
  render: (p) => {
    const {f} = p;
    const tear = clamp((f - 2) / 7);
    const crumple = clamp((f - 10) / 7);
    const toss = clamp((f - 18) / 12);
    const px = lerp(lerp(540, 600, tear), 800, ease.inQuad(toss));
    const py = lerp(lerp(640, 700, tear), 1080, ease.inQuad(toss)) - Math.sin(toss * Math.PI) * 200;
    const sc = lerp(1, 0.25, ease.inOutCubic(crumple));
    const r = rng(27);
    const ball = smooth(Array.from({length: 10}, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      const rr = 150 * (0.8 + r() * 0.4);
      return [Math.cos(a) * rr, Math.sin(a) * rr] as [number, number];
    }), true, 0.3);
    return (
      <>
        <Fireplace x={800} y={1300} f={f} flare={toss >= 1 ? Math.exp(-(f - 30) / 10) : 0} />
        {/* the calendar block, one page gone */}
        <Shape d={rect(360, 420, 360, 460, 8)} fill={C.white} line={6} />
        <Shape d={rect(360, 420, 360, 90, 8)} fill={C.hotpink} line={6} />
        <Txt x={540} y={740} size={70} font={FONT.lyric} weight={800}>
          today
        </Txt>
        {toss < 1 && (
          <g transform={`translate(${px},${py}) rotate(${tear * 16 + toss * 200}) scale(${sc})`}>
            {crumple < 0.6 ? (
              <>
                <Shape d={rect(-180, -140, 360, 300, 8)} fill={C.white} line={6} />
                <Txt x={0} y={30} size={56} font={FONT.lyric} weight={800}>
                  yesterday
                </Txt>
              </>
            ) : (
              <>
                <Shape d={ball} fill={C.white} line={7} />
                <Line d="M-60,-40L20,10M-20,60L50,-30M-80,30L-20,-10" size={5} opacity={0.6} />
              </>
            )}
          </g>
        )}
        {toss >= 1 && Array.from({length: 10}, (_, k) => <Sparkle key={k} x={800 + (k - 4.5) * (30 + (f - 30) * 5)} y={1040 - (f - 30) * (8 + (k % 3) * 4) - (k % 4) * 20} r={30 - (k % 4) * 4} o={1 - clamp((f - 46) / 10)} color={k % 2 ? C.goldHi : C.amber} />)}
        <Note x={300} y={1080} size={60} rot={-6}>
          forget it.
        </Note>
      </>
    );
  },
};

export const CHORUS: Record<number, SceneDef> = {20: S20, 21: S21, 22: S22, 23: S23, 24: S24, 25: S25, 26: S26, 27: S27};
