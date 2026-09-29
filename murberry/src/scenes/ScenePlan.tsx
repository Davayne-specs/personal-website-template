import React from 'react';
import {ink, paper, serif} from '../brand/tokens';
import {DrawPath} from '../components/Draw';
import {FadeText, Label} from '../components/Label';
import {Canvas, HatchDefs, Sheet} from '../components/Paper';
import * as P from '../figure/paths';
import {ease, fade, prog} from '../lib/anim';

const ARM_CLOSED =
  'M 292 690 C 296 648 330 638 362 648 C 402 660 452 668 500 674 C 540 680 600 684 646 690 L 648 734 C 604 742 556 756 510 760 C 470 762 430 782 394 778 C 366 774 346 764 336 754 C 318 738 298 716 292 690 Z';
const COUNTER_FOOT =
  'M 296 1418 C 288 1436 283 1458 286 1470 C 288 1480 298 1482 312 1482 L 438 1482 C 452 1482 458 1474 452 1467 C 440 1458 402 1450 376 1447 C 370 1446 360 1446 356 1448 L 326 1424 Z';
const COUNTER_HAND =
  'M 958 929 C 980 938 1004 948 1024 956 C 1040 962 1054 968 1062 971 C 1066 973 1064 974 1060 974 L 952 974 C 946 973 941 970 939 968 Z';

const mini = {fill: 'none', stroke: '#2A2420', strokeWidth: 6, strokeLinejoin: 'round', strokeLinecap: 'round'} as const;

const MiniWall: React.FC = () => (
  <g transform="translate(69.3 495.4) scale(0.3)" {...mini}>
    <line x1="869" y1="520" x2="869" y2="1482" />
    <line x1="200" y1="1482" x2="869" y2="1482" />
    <g transform="rotate(16 320 1440)">
      <path fill={paper.skin} d={P.BODY} />
      <path fill={paper.skinLight} transform="rotate(-10 318 700)" d={ARM_CLOSED} />
    </g>
    <path fill={paper.skin} d={P.FOOT_WALL} />
    <path fill={paper.skinLight} d={P.WALL_HAND} />
  </g>
);

const MiniCounter: React.FC = () => (
  <g transform="translate(366 495.4) scale(0.3)" {...mini}>
    <rect x="930" y="974" width="150" height="508" fill={paper.sand} />
    <line x1="200" y1="1482" x2="930" y2="1482" />
    <g transform="rotate(27.8 320 1440)">
      <path fill={paper.skin} d={P.BODY} />
      <path fill={paper.skinLight} d={ARM_CLOSED} />
    </g>
    <path fill={paper.skin} d={COUNTER_FOOT} />
    <path fill={paper.skinLight} d={COUNTER_HAND} />
  </g>
);

const MiniFloor: React.FC = () => (
  <g transform="translate(597.3 495.4) scale(0.3)" {...mini}>
    <line x1="380" y1="1482" x2="1400" y2="1482" />
    <g transform="rotate(72.7 446 1482)">
      <path fill={paper.skin} d={P.BODY} />
      <path fill={paper.skin} d={P.FOOT_STAND} />
      <path fill={paper.skinLight} transform="rotate(17.3 318 700)" d={ARM_CLOSED} />
    </g>
    <path fill={paper.skinLight} d={P.FLOOR_HAND} />
  </g>
);

const Col: React.FC<{t: number; t0: number; x: number; big: string; small: string; id: string}> = ({t, t0, x, big, small, id}) => (
  <g>
    <Label id={`${id}-n`} t={t} t0={t0} dur={0.5} x={x} y={362} anchor="middle" lines={[big]} size={64} spacing={0} smallCaps={false} />
    <Label id={`${id}-l`} t={t} t0={t0 + 0.3} dur={0.6} x={x} y={414} anchor="middle" lines={[small]} />
  </g>
);

const SEG = 952 / 12;

/** Beat 6, 1:55-2:20. This week's plan; the steps after; effort, not pounds; food as context. */
export const ScenePlan: React.FC<{t: number}> = ({t}) => {
  const card = prog(t, 0.6, 1.5, ease.outCubic);
  const soda = prog(t, 21.2, 22.3, ease.inOutSine);
  return (
    <Sheet color={paper.ochre}>
      <Canvas>
        <HatchDefs id="s6" />
        {card > 0 ? (
          <g transform={`translate(${(1 - card) * 1100} 0)`}>
            <rect x="64" y="220" width="952" height="280" rx="6" fill={paper.sand}
              style={{filter: 'drop-shadow(0 6px 7px rgba(42,36,32,0.22))'}} />
            <g stroke="#2A2420" strokeWidth={1.2} opacity={0.35 * prog(t, 1.4, 2.0)}>
              <line x1="302" y1="260" x2="302" y2="460" />
              <line x1="540" y1="260" x2="540" y2="460" />
              <line x1="778" y1="260" x2="778" y2="460" />
            </g>
            <Col id="s6-c1" t={t} t0={2.6} x={183} big="2–3" small="sets" />
            <Col id="s6-c2" t={t} t0={3.5} x={421} big="5–10" small="wall push-ups" />
            <Col id="s6-c3" t={t} t0={5.6} x={659} big="60 s" small="rest" />
            <Col id="s6-c4" t={t} t0={7.6} x={897} big="3" small="days" />
            <FadeText t={t} t0={8.3} x={897} y={448} anchor="middle" size={24} color={ink.pencil}>
              a day off between
            </FadeText>
          </g>
        ) : null}
        <g opacity={prog(t, 10.2, 10.9)}>
          <MiniWall />
        </g>
        <g opacity={0.42 * prog(t, 11.1, 11.7)}>
          <MiniCounter />
        </g>
        <g opacity={0.42 * prog(t, 11.9, 12.5)}>
          <MiniFloor />
        </g>
        <g fill="none">
          <DrawPath d="M 344 900 L 392 900 M 380 891 L 392 900 L 380 909" p={prog(t, 10.8, 11.2)} width={2} />
          <DrawPath d="M 668 900 L 708 900 M 696 891 L 708 900 L 696 909" p={prog(t, 11.6, 12.0)} width={2} />
        </g>
        <Label id="s6-now" t={t} t0={10.5} dur={0.7} x={200} y={1004} anchor="middle" lines={['now: the wall']} />
        <Label id="s6-then" t={t} t0={11.3} dur={0.7} x={540} y={1004} anchor="middle" lines={['then: a counter']} opacity={0.7} />
        <Label id="s6-when" t={t} t0={11.8} dur={0.8} x={540} y={1036} anchor="middle" lines={['when fifteen feel easy']}
          size={24} spacing={1.4} opacity={0.7} />
        <Label id="s6-later" t={t} t0={12.2} dur={0.7} x={880} y={1004} anchor="middle" lines={['later: the floor']} opacity={0.7} />
        <Label id="s6-eff" t={t} t0={17.0} dur={0.8} x={64} y={1112} lines={['effort, week one']} />
        <g opacity={prog(t, 18.0, 18.7)}>
          <rect x="64" y="1130" width={SEG} height="40" fill="url(#s6-ink1)" />
          <rect x="64" y="1130" width={SEG} height="40" fill="url(#s6-ink2)" />
        </g>
        <g fill="none">
          <DrawPath d="M 64 1130 L 1016 1130 L 1016 1170 L 64 1170 Z" p={prog(t, 17.2, 17.9, ease.inOutSine)} width={2} />
          <g opacity={0.5 * prog(t, 17.7, 18.1)} stroke="#2A2420" strokeWidth={1}>
            {Array.from({length: 11}, (_, k) => (
              <line key={k} x1={64 + SEG * (k + 1)} y1="1130" x2={64 + SEG * (k + 1)} y2="1170" />
            ))}
          </g>
        </g>
        <Label id="s6-kcal" t={t} t0={13.8} dur={1.0} x={64} y={1272} lines={['roughly 5–10 kcal per set']}
          size={44} spacing={0} smallCaps={false} />
        <FadeText t={t} t0={14.9} x={64} y={1306}>
          A range, not a promise · 2024 Adult Compendium of Physical Activities
        </FadeText>
        <g stroke="#2A2420" strokeLinejoin="round" strokeLinecap="round">
          <g opacity={soda}>
            <path fill={paper.sand} d="M 830 1256 L 950 1256 L 936 1400 L 844 1400 Z" strokeWidth={0} />
            <path fill={paper.sand} d="M 822 1240 L 958 1240 L 956 1256 L 824 1256 Z" strokeWidth={0} />
          </g>
          <DrawPath d="M 830 1256 L 950 1256 L 936 1400 L 844 1400 Z" p={soda} width={2.4} />
          <DrawPath d="M 822 1240 L 958 1240 L 956 1256 L 824 1256 Z" p={prog(t, 21.6, 22.3)} width={2.4} />
          <DrawPath d="M 904 1240 L 916 1206 L 944 1200" p={prog(t, 22.0, 22.4)} width={2.4} />
          <DrawPath d="M 838 1300 L 942 1300 M 842 1346 L 938 1346" p={prog(t, 22.1, 22.5)} width={1.4} opacity={0.6} />
          <DrawPath d="M 804 1414 L 986 1214" p={prog(t, 22.7, 23.2, ease.inOutSine)} width={4} />
        </g>
        <Label id="s6-sugar" t={t} t0={23.0} dur={0.8} x={890} y={1446} anchor="middle" lines={['especially sugar']}
          size={24} spacing={1.4} />
        <g opacity={fade(t, 0.8, 1.6)}>
          <text x="64" y="1476" fontFamily={serif} fontSize={22} fill={ink.muted}>Check with your doctor before starting.</text>
          <text x="64" y="1506" fontFamily={serif} fontSize={22} fill={ink.muted}>Stop if you feel chest pain, dizziness or joint pain.</text>
        </g>
        <Label id="s6-title" t={t} t0={0.4} dur={0.8} x={64} y={172} lines={['this week']} size={44} spacing={3} />
      </Canvas>
    </Sheet>
  );
};
