import React from 'react';
import {paper} from '../brand/tokens';
import {DrawPath} from '../components/Draw';
import {FadeText, Label} from '../components/Label';
import {Canvas, HatchDefs, Sheet} from '../components/Paper';
import {Arm, Contact, FigureBody, WallFoot, WallHand} from '../figure/Figure';
import {wallPose} from '../figure/rig';
import {ease, lerp, prog, pulse} from '../lib/anim';
import {wallLean} from './SceneWall';

const MIND_REPS = [
  {kind: 'in', a: 2.0, b: 4.2},
  {kind: 'out', a: 4.2, b: 6.4},
  {kind: 'in', a: 7.2, b: 9.4},
  {kind: 'out', a: 9.4, b: 11.6},
] as const;

// The day-line: six rows of eleven days, snaking down the page.
const ROW_Y = [900, 990, 1080, 1170, 1260, 1350];
const ARC = Math.PI * 45;
const dayPos = (n: number) => {
  const r = Math.floor((n - 1) / 11);
  const i = (n - 1) % 11;
  const x = r % 2 === 0 ? 120 + 84 * i : 960 - 84 * i;
  return {x, y: ROW_Y[r], s: r * (840 + ARC) + 84 * i};
};
const MISSED = 23;
const DRAWN_TO = 40;
const SOLID =
  'M 120 900 L 960 900 A 45 45 0 0 1 960 990 L 120 990 A 45 45 0 0 0 120 1080 L 960 1080 A 45 45 0 0 1 960 1170 L 456 1170';
const SOLID_LEN = dayPos(DRAWN_TO).s;
const DOTTED =
  'M 456 1170 L 120 1170 A 45 45 0 0 0 120 1260 L 960 1260 A 45 45 0 0 1 960 1350 L 120 1350';
const LINE_T: [number, number] = [4.5, 13.5];

/** Beat 5, 1:35-1:55. The figure small at the wall at night; the days add up; one is missed, and the line carries on. */
export const SceneMind: React.FC<{t: number}> = ({t}) => {
  const lp = prog(t, LINE_T[0], LINE_T[1], ease.inOutSine);
  const drawn = lp * SOLID_LEN;
  const pose = wallPose(wallLean(t, MIND_REPS, 20));
  const pull = lerp(1.12, 1, prog(t, -0.7, 2.6, ease.outCubic));
  const future = prog(t, 6.2, 7.8, ease.inOutSine);
  const missedAt = LINE_T[0] + (LINE_T[1] - LINE_T[0]) * (dayPos(MISSED).s / SOLID_LEN);
  const glow = pulse(t, 12.2, 13.6);
  const head = dayPos(DRAWN_TO);

  return (
    <Sheet color={paper.ochre}>
      <Canvas>
        <HatchDefs id="s5" />
        <g transform={`translate(540 760) scale(${pull}) translate(-540 -760)`}>
          <rect x="150" y="250" width="230" height="250" fill="#2A2420" style={{filter: 'drop-shadow(0 4px 5px rgba(42,36,32,0.25))'}} />
          <path d="M 318 300 A 34 34 0 1 0 330 360 A 26 26 0 1 1 318 300 Z" fill={paper.sand} />
          <g fill={paper.sand}>
            {[
              [200, 296, 2.5, 0],
              [246, 350, 2, 1.3],
              [184, 420, 2, 2.1],
              [352, 444, 2.5, 0.7],
            ].map(([x, y, r, ph], i) => (
              <circle key={i} cx={x} cy={y} r={r} opacity={0.55 + 0.3 * Math.sin(t * 1.3 + ph)} />
            ))}
          </g>
          <g stroke={paper.sand} strokeWidth={6}>
            <line x1="265" y1="250" x2="265" y2="500" />
            <line x1="150" y1="375" x2="380" y2="375" />
          </g>
          <rect x="150" y="250" width="230" height="250" fill="none" stroke="#2A2420" strokeWidth={3} />
          <rect x="136" y="500" width="258" height="14" fill={paper.sand} stroke="#2A2420" strokeWidth={2} />
          <rect x="780" y="160" width="300" height="580" fill={paper.sand} />
          <rect x="780" y="160" width="300" height="580" fill="url(#s5-section14)" opacity={0.16} />
          <line x1="780" y1="160" x2="780" y2="740" stroke="#2A2420" strokeWidth={2.4} />
          <line x1="64" y1="740" x2="780" y2="740" stroke="#2A2420" strokeWidth={2.4} />
          <rect x="64" y="740" width="716" height="30" fill="url(#s5-section14)" opacity={0.18} />
          <g transform="translate(415 117.6) scale(0.42)">
            <Contact cx={372} cy={1484} rx={118} ry={10} />
            <g style={{filter: 'drop-shadow(0 5px 6px rgba(42,36,32,0.16))'}}>
              <g transform={pose.body}>
                <FigureBody uid="s5" width={5} details={0.6} />
              </g>
              <Arm uid="s5" pose={pose.arm} width={5} inner={false} />
              <WallFoot width={5} />
              <WallHand width={5} />
            </g>
          </g>
        </g>
        <g opacity={future}>
          <path d={DOTTED} fill="none" stroke="#2A2420" strokeWidth={1.8} strokeDasharray="3 9" opacity={0.5} />
          <g fill="#2A2420" opacity={0.45}>
            {Array.from({length: 66 - DRAWN_TO}, (_, k) => DRAWN_TO + 1 + k)
              .filter((n) => n < 66)
              .map((n) => {
                const p = dayPos(n);
                return <circle key={n} cx={p.x} cy={p.y} r={3.5} />;
              })}
          </g>
          <circle cx="120" cy="1350" r="9" fill="none" stroke="#2A2420" strokeWidth={2} />
        </g>
        <DrawPath d={SOLID} p={lp} width={2.6} />
        <g fill="none" stroke="#2A2420" strokeWidth={2.6} strokeLinecap="round">
          {Array.from({length: DRAWN_TO}, (_, k) => k + 1)
            .filter((n) => n !== MISSED)
            .map((n) => {
              const p = dayPos(n);
              const tp = drawn > 0 ? Math.max(0, Math.min(1, (drawn - p.s + 6) / 30)) : 0;
              return tp > 0 ? <DrawPath key={n} d={`M ${p.x} ${p.y - 14} L ${p.x} ${p.y + 14}`} p={tp} width={2.6} /> : null;
            })}
        </g>
        {t > missedAt ? (
          <g>
            <circle cx="120" cy="1080" r={10 + glow * 5} fill="none" stroke="#2A2420" strokeWidth={1.2} opacity={glow * 0.6} />
            <circle cx="120" cy="1080" r="10" fill={paper.ochre} stroke="#2A2420" strokeWidth={2} opacity={prog(t, missedAt, missedAt + 0.3)} />
          </g>
        ) : null}
        {lp >= 1 ? (
          <circle cx={head.x} cy={head.y} r={4 + 1.5 * Math.sin(t * 2.4)} fill="#2A2420" opacity={0.55} />
        ) : null}
        <Label id="s5-title" t={t} t0={0.9} dur={0.8} x={64} y={172} lines={['the mind']} size={44} spacing={3} />
        <Label id="s5-d1" t={t} t0={4.3} dur={0.5} x={120} y={862} anchor="middle" lines={['day 1']} />
        <Label id="s5-miss" t={t} t0={12.3} dur={1.1} x={150} y={1130} size={24} spacing={1.4}
          lines={['a missed day. the line carries on.']} />
        <Label id="s5-66" t={t} t0={7.0} dur={1.2} x={150} y={1396} lines={['day 66: the median in one study']} />
        <FadeText t={t} t0={8.2} x={150} y={1430}>
          Lally et al., 2010 · some habits took far longer
        </FadeText>
      </Canvas>
    </Sheet>
  );
};
