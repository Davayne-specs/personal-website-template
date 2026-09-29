import React from 'react';
import {AbsoluteFill} from 'remotion';
import {paper} from '../brand/tokens';
import {Emboss} from '../components/Emboss';
import {MuscleState} from '../components/Muscle';
import {Canvas, HatchDefs, Sheet} from '../components/Paper';
import {Peel} from '../components/Peel';
import {ease, lerp, prog} from '../lib/anim';
import {MusclePlate} from './MusclePlate';

const UNROLL: [number, number] = [4.3, 7.8];

/** Beat 7, 2:20-2:30. The muscles fade from red to gold; the ochre sheet folds closed over them. */
export const SceneSignoff: React.FC<{t: number}> = ({t}) => {
  const st = (k: number): MuscleState => {
    const rec = prog(t, 1.1 + k * 0.25, 2.7 + k * 0.25, ease.inOutSine);
    return {draw: 1, named: 1, load: 1, recover: rec, swell: lerp(1.05, 1, rec)};
  };
  const close = 1 - prog(t, UNROLL[0], UNROLL[1], ease.inOutSine);
  const depth = t < 7.6 ? prog(t, 6.9, 7.6) : lerp(1, 0.3, prog(t, 8.4, 9.4));
  const sweep = t >= 7.1 && t <= 8.5 ? (t - 7.1) / 1.4 : -1;

  const plate = (
    <Sheet color={paper.clay}>
      <Canvas>
        <HatchDefs id="s7" />
        <defs>
          <linearGradient id="s7-fadeg" x1="0" y1="1100" x2="0" y2="1330" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </linearGradient>
          <mask id="s7-fade" maskUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1920">
            <rect x="0" y="0" width="1080" height="1920" fill="url(#s7-fadeg)" />
          </mask>
        </defs>
        <g mask="url(#s7-fade)">
          <MusclePlate uid="s7" s={{pec: st(0), deltoid: st(1), triceps: st(2), serratus: st(3)}} />
        </g>
      </Canvas>
    </Sheet>
  );

  return (
    <AbsoluteFill>
      <Peel id="s7-close" progress={close} dir={[0.08, 1]} under={plate}>
        <Sheet color={paper.ochre}>
          <Canvas>
            <Emboss id="s7-em" x={540} y={330} depth={depth} sweep={sweep} paperColor={paper.ochre} anchor="middle" />
          </Canvas>
        </Sheet>
      </Peel>
    </AbsoluteFill>
  );
};
