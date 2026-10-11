// The whole cast crowding into one selfie, 9:16 for TikTok. Stein holds the phone (his arm runs
// out of frame toward us); everyone looks into the lens and smiles.
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {C, FONT} from '../brand/tokens';
import {Biscuit} from '../characters/Biscuit';
import {Gauge} from '../characters/Gauge';
import {Kid} from '../characters/Kid';
import {Pip} from '../characters/Pip';
import {Precious} from '../characters/Precious';
import {Ring} from '../characters/Ring';
import {Smoke, Stein, STEIN_PARTS} from '../characters/Stein';
import {PrintFrame} from '../lib/frame';
import {Flat, Line, Shape, Txt} from '../lib/print';
import {Pose, worldPoint} from '../lib/rig';
import {circle, Confetti, rect, Sparkle, Wash} from '../props/common';
import {Yard} from '../templates/backdrops';

// Two raised fingers, drawn in a hand's own frame (fingers point along +y, away from the wrist).
const Peace: React.FC<{skin: string}> = ({skin}) => (
  <>
    <g transform="translate(-8,30) rotate(12)">
      <Shape d={rect(-9, 0, 18, 72, 9)} fill={skin} line={4} />
    </g>
    <g transform="translate(10,30) rotate(-12)">
      <Shape d={rect(-9, 0, 18, 72, 9)} fill={skin} line={4} />
    </g>
  </>
);

const SMOKE_POSE: Pose = {uarmL: 168, farmL: 16, uarmR: -18, farmR: 8, head: -10, torso: -6};
const SMOKE_PLACE = {x: 930, y: 1300, scale: 1.2};

export const CastSelfie: React.FC<{pov?: boolean}> = ({pov = false}) => {
  const frame = useCurrentFrame();
  const grin = worldPoint(STEIN_PARTS, SMOKE_POSE, {...SMOKE_PLACE, scale: SMOKE_PLACE.scale * 1.06}, 'head', [0, -92]);
  return (
    <AbsoluteFill style={{background: C.cotton}}>
      <PrintFrame
        frame={frame}
        ground="blush"
        reg={[2, -1.5]}
        sheen={0.4}
        under={
          <>
            <Wash kind="pink" x={260} y={420} s={1300} o={0.4} />
            <Wash kind="gold" x={860} y={1500} s={1300} o={0.4} />
          </>
        }
      >
        <Yard time="dawn" f={frame + 40} beat={0.6} />
        <Flat d={circle(860, 330, 360)} fill="url(#glow-amber)" opacity={0.7} />

        {/* back row: the Ring floating, the Gauge grinning, Smoke photobombing */}
        <Ring x={230} y={400} r={130} spin={28} tilt={-18} glint={1} glow={0.9} />
        <Sparkle x={330} y={290} r={46} />
        <g transform="translate(850,330) rotate(8)">
          <Gauge x={0} y={0} r={140} value={1} label={false} />
          <Line d="M-56,48C-26,86 26,86 56,48" size={9} color={C.ink} />
          <Shape d={circle(-44, 10, 11)} fill={C.ink} line={false} />
          <Shape d={circle(44, 10, 11)} fill={C.ink} line={false} />
        </g>
        <Smoke place={SMOKE_PLACE} pose={SMOKE_POSE} holdL={<Peace skin={C.smoke} />} />
        <Line d={`M${grin[0] - 40},${grin[1]}C${grin[0] - 16},${grin[1] + 26} ${grin[0] + 16},${grin[1] + 26} ${grin[0] + 40},${grin[1]}`} size={7} color={C.ash} />

        {/* Stein holds the phone: his left arm runs out of frame toward us; his right arm round her */}
        <Stein
          place={{x: 360, y: 1830, scale: 1.7}}
          pose={{uarmL: 58, farmL: -14, uarmR: -96, farmR: -28, head: 7, torso: 3}}
          style={{cap: true}}
          face={{smile: 1, eyes: 'happy', mouth: 0.35, blush: 0.3}}
        />
        <Precious
          place={{x: 720, y: 1780, scale: 1.52}}
          pose={{uarmR: -145, farmR: -45, uarmL: 14, farmL: -10, head: -9, torso: -3}}
          face={{smile: 1, eyes: 'wink', blush: 0.6, mouth: 0.25}}
          holdR={<Peace skin="#8E5C3F" />}
        />

        {/* front row: Ashaka hugging Pip, Biscuit squeezing in from the corner */}
        <Kid place={{x: 540, y: 2010, scale: 1.6}} pose={{armL: -34, armR: 34, head: 6}} face={{smile: 1, eyes: 'happy', mouth: 0.4}} dress={C.aqua} />
        <Pip place={{x: 540, y: 1700, scale: 0.6}} pose={{flipperL: 70, flipperR: -70, head: -6}} face={{eyes: 'happy', beakOpen: 0.5, blush: 0.8}} />
        <Biscuit place={{x: 1010, y: 1760, scale: 1.35, flip: true, rotate: -8}} tongue eyes="happy" />

        <Confetti t={22} x={540} y={300} n={34} seed={44} spread={1.3} floor={2200} />
        {[[120, 900], [980, 860], [700, 260], [180, 1240]].map(([x, y], i) => (
          <Sparkle key={i} x={x} y={y} r={30 + (i % 2) * 14} />
        ))}

        {pov && (
          <g transform="rotate(-3 540 180)">
            <Shape d={rect(60, 118, 960, 124, 26)} fill={C.white} line={6} />
            <Txt x={540} y={198} size={54} font={FONT.lyric} weight={800} color={C.ink}>
              pov: the whole cast says cheese
            </Txt>
          </g>
        )}
      </PrintFrame>
      <Img src={staticFile('tex/grain.png')} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: 'multiply', opacity: 0.8}} />
    </AbsoluteFill>
  );
};
