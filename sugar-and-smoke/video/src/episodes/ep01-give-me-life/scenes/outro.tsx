// Outro: No. 57-59. Release: pale gold, perfect register, the Ring is given.
import React from 'react';
import {C, FONT} from '../../../brand/tokens';
import {Precious, PRECIOUS_POSES} from '../../../characters/Precious';
import {Ring} from '../../../characters/Ring';
import {Stein, STEIN_PARTS, STEIN_POSES} from '../../../characters/Stein';
import {clamp, ease, lerp, prog} from '../../../lib/ease';
import {Flat, Shape, Txt} from '../../../lib/print';
import {chainAngle, Pose} from '../../../lib/rig';
import {circle, Confetti, ellipse, FloatHearts, heart, poly, rect, SmokePuff, Sparkle, Wash} from '../../../props/common';
import {SceneDef} from '../../../lib/scene';

// ---------------------------------------------------------------- No. 57
export const S57: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="gold" x={540} y={1000} s={1500} o={0.5} />,
  render: (p) => {
    const {f} = p;
    const octagon = poly(Array.from({length: 8}, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      return [540 + Math.cos(a) * 560, 1300 + Math.sin(a) * 190] as [number, number];
    }));
    return (
      <>
        <Shape d={octagon} fill={C.white} line={7} />
        <Confetti t={40 + f * 0.6} x={540} y={-200} n={34} seed={57} spread={0.8} floor={1290} />
        <Stein place={{x: 470, y: 1230, scale: 0.66, rotate: -90}} pose={{uarmR: 160, farmR: 20, uarmL: 20, thighL: 10, thighR: -10}} face={{eyes: 'happy', smile: 1, mouth: p.mouth * 0.6}} />
        <Precious place={{x: 760, y: 1030, scale: 0.66, flip: true}} pose={{uarmR: -50, farmR: 30, torso: 10, head: 10, uarmL: 10}} face={{smile: 0.9, look: [1, 0.6], turn: 0.3}} style={{gloves: true}} />
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 58
export const S58: SceneDef = {
  ground: 'cotton',
  under: () => (
    <>
      <Wash kind="gold" x={540} y={900} s={1500} o={0.55} />
      <Wash kind="pink" x={800} y={1300} s={900} o={0.4} />
    </>
  ),
  camera: (p) => ({zoom: 1 + 0.05 * prog(p.f, 0, p.dur, ease.inOutSine)}),
  render: (p) => {
    const {f} = p;
    const give = p.w(3);
    const lid = ease.outBack(clamp((f - 8) / 10));
    const pose: Pose = {...STEIN_POSES.kneel, uarmR: -70, farmR: -30, uarmL: 10, farmL: -20, head: -4};
    return (
      <>
        <Flat d={circle(560, 900, 520)} fill="url(#glow-gold)" opacity={0.6} />
        <Shape d={rect(-40, 1380, 1160, 600)} fill={C.release} line={5} shadow={false} />
        <Precious
          place={{x: 790, y: 1000, scale: 0.72, flip: true}}
          pose={f < give ? PRECIOUS_POSES.mouthHand : {uarmR: -20, farmR: 150, uarmL: 20, farmL: -150}}
          face={{eyes: f < give ? 'wide' : 'happy', smile: f < give ? 0.3 : 1, mouth: f < give ? 0.3 : 0, blush: 0.8}}
        />
        <Stein
          place={{x: 330, y: 1080, scale: 0.72}}
          pose={pose}
          face={{mouth: p.mouth, smile: 0.9, look: [1, -0.4], turn: 0.4}}
          holdR={
            <g transform={`rotate(${-chainAngle(STEIN_PARTS, pose, 'handR')}) translate(40,-20) scale(0.55)`}>
              <Shape d={rect(-150, -40, 300, 160, 20)} fill={C.hotpink} line={8} />
              <Shape d={rect(-120, -34, 240, 60, 14)} fill="#3A1E2B" line={5} />
              <g transform={`translate(0,-40) rotate(${-110 * lid}) translate(0,40)`}>
                <Shape d="M-150,-40L150,-40L150,-110C150,-130 130,-140 110,-140L-110,-140C-130,-140 -150,-130 -150,-110Z" fill={C.hotpink} line={8} />
              </g>
              <Ring x={0} y={-40} r={70} spin={10 * Math.sin(f / 8)} tilt={0} glint={0.8} glow={0.8} />
            </g>
          }
        />
        {f >= give && <FloatHearts f={f - give} x={620} y={620} n={6} seed={58} spread={300} color={C.hotpink} />}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 59 - given, and the end card
export const S59: SceneDef = {
  ground: 'cotton',
  under: () => (
    <>
      <Wash kind="pink" x={320} y={620} s={1300} o={0.55} />
      <Wash kind="aqua" x={800} y={1300} s={1200} o={0.5} />
    </>
  ),
  render: (p) => {
    const {f} = p;
    const give = p.w(2);
    const fold = clamp((f - (p.dur - 34)) / 12);
    const card = clamp((f - (p.dur - 24)) / 10);
    const pass = ease.inOutCubic(clamp((f - give + 10) / 16));
    const ringX = lerp(400, 690, pass);
    const ringY = 900 - Math.sin(pass * Math.PI) * 90;
    const clear = clamp(f / 40);
    return (
      <>
        {fold < 1 && (
          <g transform={`translate(0,${960 * fold}) scale(1,${1 - fold})`}>
            <SmokePuff x={200 - clear * 300} y={500} s={600} o={0.8 * (1 - clear)} v={1} />
            <SmokePuff x={880 + clear * 300} y={1300} s={700} o={0.8 * (1 - clear)} v={3} />
            {/* his hand, from the left */}
            <g transform="translate(250,980) rotate(-8)">
              <Shape d="M-400,-70L60,-70C110,-70 130,-40 130,0C130,40 110,70 60,70L-400,70Z" fill={C.steinSkin} shade="M-400,10L140,10L140,80L-400,80Z" shadeInk="ht-ink-2" line={7} />
              <Shape d={rect(-420, -100, 180, 200)} fill={C.teal} line={7} />
            </g>
            {/* her open hand, from the right */}
            <g transform="translate(820,980) rotate(8)">
              <Shape d="M400,-70L-40,-70C-110,-70 -150,-20 -150,10C-150,50 -110,80 -40,80L400,80Z" fill={C.preciousSkin} shade="M-150,20L400,20L400,90L-150,90Z" shadeInk="ht-ink-2" line={7} />
              <Shape d="M-130,-20C-170,-80 -120,-120 -80,-80L-40,-60Z" fill={C.preciousSkin} line={6} />
              <Shape d={rect(240, -110, 180, 220)} fill={C.hotpink} line={7} />
              <Shape d={`${ellipse(90, -70, 30, 12)}`} fill={C.gold} line={3} />
            </g>
            <Ring x={ringX} y={ringY} r={78} spin={pass * 360} tilt={-10} glint={0.9} glow={0.5 + 0.5 * pass} />
            {pass >= 1 && <Sparkle x={ringX + 60} y={ringY - 70} r={50 * (1 - clamp((f - give - 6) / 16))} />}
          </g>
        )}
        {card > 0 && (
          <g opacity={card} transform={`translate(540,900) scale(${0.9 + 0.1 * ease.outBack(card)}) translate(-540,-900)`}>
            <Txt x={548} y={868} size={190} font={FONT.lyric} weight={800} color={C.hotpink} spacing={-6} opacity={0.9}>
              mbastein
            </Txt>
            <Txt x={540} y={860} size={190} font={FONT.lyric} weight={800} color="url(#foil)" spacing={-6} stroke={C.goldLo} strokeWidth={5}>
              mbastein
            </Txt>
            <Txt x={540} y={1000} size={88} font={FONT.lyric} weight={700}>
              give me life
            </Txt>
            <Shape d={heart(540, 1120, 30)} fill={C.hotpink} line={4} />
          </g>
        )}
      </>
    );
  },
};

export const OUTRO: Record<number, SceneDef> = {57: S57, 58: S58, 59: S59};

void Txt;
