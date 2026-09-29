// A still of the whole cast for the bible and for checking the rigs.
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {C, FONT} from '../brand/tokens';
import {Biscuit} from '../characters/Biscuit';
import {Gauge} from '../characters/Gauge';
import {Pip} from '../characters/Pip';
import {Precious, PRECIOUS_POSES} from '../characters/Precious';
import {Ring} from '../characters/Ring';
import {Smoke, Stein, STEIN_POSES} from '../characters/Stein';
import {PrintFrame} from '../lib/frame';
import {Tex, Txt} from '../lib/print';

export const CAST_W = 2400;
export const CAST_H = 1350;

const Label: React.FC<{x: number; y: number; name: string; role: string}> = ({x, y, name, role}) => (
  <>
    <Txt x={x} y={y} size={54} font={FONT.lyric} weight={800}>
      {name}
    </Txt>
    <Txt x={x} y={y + 40} size={24} font={FONT.tag} weight={400}>
      {role}
    </Txt>
  </>
);

export const CastSheet: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: C.cotton}}>
      <PrintFrame
        frame={frame}
        ground="cotton"
        width={CAST_W}
        height={CAST_H}
        reg={[4, -3]}
        sheen={0.45}
        under={
          <>
            <Tex src="wash-pink-1.png" x={-150} y={-120} w={1100} h={1100} opacity={0.55} />
            <Tex src="wash-aqua-1.png" x={1500} y={300} w={1100} h={1100} opacity={0.5} />
          </>
        }
      >
        <Stein place={{x: 330, y: 700, scale: 0.78}} pose={STEIN_POSES.stand} face={{smile: 0.5}} />
        <Precious place={{x: 780, y: 720, scale: 0.8}} pose={PRECIOUS_POSES.hipHand} face={{smile: 0.7}} style={{glow: 0.6}} />
        <Smoke place={{x: 1220, y: 700, scale: 0.78}} pose={{uarmL: 14, uarmR: -24, farmR: -30}} />
        <Biscuit place={{x: 1600, y: 1030, scale: 0.9}} />
        <Ring x={1700} y={420} r={120} spin={30} glint={0.9} glow={0.5} />
        <Gauge x={2120} y={620} r={170} value={0.72} />
        <Pip place={{x: 2150, y: 1050, scale: 0.5}} pose={{flipperR: -40, head: -6}} face={{eyes: 'happy'}} />
        <Tex src="smoke-1.png" x={1020} y={120} w={420} h={320} opacity={0.8} />
        <Label x={330} y={1200} name="Stein" role="the narrator" />
        <Label x={780} y={1200} name="Precious" role="the you" />
        <Label x={1220} y={1200} name="Smoke" role="the other man" />
        <Label x={1600} y={1200} name="Biscuit" role="the dog" />
        <Label x={1700} y={640} name="The Ring" role="the precious" />
        <Label x={2120} y={880} name="The Gauge" role="the pressure" />
        <Label x={2150} y={1200} name="Pip" role="the penguin (No. 2)" />
        <Txt x={120} y={110} size={84} font={FONT.stamp} weight={400} anchor="start" color={C.ink}>
          SUGAR &amp; SMOKE — THE CAST
        </Txt>
      </PrintFrame>
      <Img src={staticFile('tex/grain.png')} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: 'multiply', opacity: 0.8}} />
    </AbsoluteFill>
  );
};
