import React from 'react';
import {paper} from '../brand/tokens';
import {DrawPath} from '../components/Draw';
import {FadeText, Label} from '../components/Label';
import {Canvas, HatchDefs, Sheet} from '../components/Paper';
import {Arm, Contact, FigureBody} from '../figure/Figure';
import * as P from '../figure/paths';
import {FLOOR_REST, floorPose} from '../figure/rig';
import {ease, lerp, prog} from '../lib/anim';

const FLOOR_LOW = 79;
const toScreen = (p: {x: number; y: number}) => ({x: p.x * 0.86 - 244, y: p.y * 0.86 - 54.5});

/** Beat 2a, 0:08-0:17. The floor push-up: a heavy lift at this size. */
export const SceneFloor: React.FC<{t: number}> = ({t}) => {
  const down = prog(t, 1.6, 4.3, ease.inOutSine);
  const up = prog(t, 5.8, 8.0, ease.inOutSine);
  const angle = lerp(FLOOR_REST, FLOOR_LOW, down - up);
  const pose = floorPose(angle);
  const S = toScreen(pose.arm.S);
  const tipY = S.y - 75;
  const shaft = prog(t, 1.8, 2.7, ease.inOutSine);
  const push = 1 + 0.02 * prog(t, -0.5, 9.5, ease.linear);

  return (
    <Sheet color={paper.ochre}>
      <Canvas>
        <HatchDefs id="s2a" />
        <g transform={`translate(540 960) scale(${push}) translate(-540 -960)`}>
          <rect x="0" y="1220" width="1080" height="48" fill="url(#s2a-section)" opacity={0.2} />
          <line x1="0" y1="1220" x2="1080" y2="1220" stroke="#2A2420" strokeWidth={2.4} />
          <g transform="translate(-244 -54.5) scale(0.86)" style={{filter: 'drop-shadow(0 5px 6px rgba(42,36,32,0.16))'}}>
            <Contact cx={1190} cy={1485} rx={84} o={0.22} />
            <Contact cx={452} cy={1485} rx={44} ry={8} o={0.22} blur={5} />
            <Contact cx={930} cy={1486} rx={150} ry={10} o={0.12} blur={9} />
            <g transform={pose.body}>
              <path fill={paper.skin} d={P.FOOT_STAND} />
              <FigureBody uid="s2a" />
              <path d={P.FOOT_STAND_LINE} fill="none" stroke="#2A2420" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <Arm uid="s2a" pose={pose.arm} />
            <path fill={paper.skinLight} d={P.FLOOR_HAND} />
            <g fill="none" stroke="#2A2420" strokeLinecap="round" strokeLinejoin="round">
              <path strokeWidth={2.6} d={P.FLOOR_HAND_LINE} />
              <path strokeWidth={1.4} opacity={0.7} d={P.FLOOR_HAND_DETAIL} />
            </g>
          </g>
          <g transform={`translate(${S.x - 748} 0)`}>
            <DrawPath d={`M 748 610 L 748 ${tipY.toFixed(1)}`} p={shaft} width={3.2} />
            <DrawPath
              d={`M 730 ${(tipY - 26).toFixed(1)} L 748 ${tipY.toFixed(1)} L 766 ${(tipY - 26).toFixed(1)}`}
              p={prog(t, 2.6, 2.95)}
              width={3.2}
            />
            <DrawPath d="M 722 620 L 722 780" p={prog(t, 2.2, 3.0)} width={1.4} opacity={0.6} />
            <DrawPath d="M 774 620 L 774 780" p={prog(t, 2.3, 3.1)} width={1.4} opacity={0.6} />
          </g>
        </g>
        <Label id="s2a-t" t={t} t0={0.6} dur={0.8} x={64} y={172} lines={['floor push-up']} size={44} spacing={3} />
        <Label id="s2a-l" t={t} t0={2.5} dur={1.4} x={700} y={660} anchor="end" lineGap={36}
          lines={['your arms press', 'about two thirds', 'of your weight']} />
        <FadeText t={t} t0={4.0} x={700} y={772} anchor="end">
          Ebben et al. 2011 · Suprak et al. 2011
        </FadeText>
      </Canvas>
    </Sheet>
  );
};
