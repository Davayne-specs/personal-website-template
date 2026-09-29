import React from 'react';
import {paper} from '../brand/tokens';
import {DrawPath} from '../components/Draw';
import {Label} from '../components/Label';
import {Canvas, HatchDefs, Sheet} from '../components/Paper';
import {ZOOM23_CENTER, zoom23} from '../ep01/timeline';
import {Arm, Contact, FigureBody, WallFoot, WallHand} from '../figure/Figure';
import {WALL_REST, wallPose} from '../figure/rig';
import {ease, lerp, prog} from '../lib/anim';

export const WALL_LOW = 21;

// Rep phases in scene seconds: lean in (breathe in), press away (breathe out).
export const WALL_REPS = [
  {kind: 'in', a: 10.4, b: 12.3},
  {kind: 'out', a: 12.3, b: 14.2},
  {kind: 'in', a: 14.2, b: 15.9},
  {kind: 'out', a: 15.9, b: 17.6},
] as const;

export type Rep = {readonly kind: 'in' | 'out'; readonly a: number; readonly b: number};

export const wallLean = (t: number, reps: readonly Rep[] = WALL_REPS, low = WALL_LOW) => {
  let lean = WALL_REST;
  for (const r of reps) {
    const p = prog(t, r.a, r.b, ease.inOutSine);
    if (t >= r.a) lean = r.kind === 'in' ? lerp(WALL_REST, low, p) : lerp(low, WALL_REST, p);
  }
  return lean;
};

// The straight-line cue, in body space: heel to just above the head.
const LINE_TOP = {x: 321.4, y: 425.3};
const LINE_BOT = {x: 296, y: 1432.3};
const tick = (p: {x: number; y: number}) => `M ${p.x - 12.5} ${p.y - 0.3} L ${p.x + 12.5} ${p.y + 0.3}`;

/** Beat 2b, 0:17-0:35. The wall push-up, cue by cue, then two slow reps. */
export const SceneWall: React.FC<{t: number}> = ({t}) => {
  const T = 17 + t;
  const z = zoom23(T);
  const lean = wallLean(t);
  const pose = wallPose(lean);
  const cuesOut = 1 - prog(t, 16.6, 17.4);
  const phase = WALL_REPS.find((r) => t >= r.a && t < r.b)?.kind;
  const inOn = phase === 'in' ? 1 : 0.38;
  const outOn = phase === 'out' ? 1 : 0.38;
  const arrows = prog(t, 10.0, 10.7) * cuesOut;

  return (
    <Sheet color={paper.ochre}>
      <Canvas>
        <HatchDefs id="s2b" />
        <g transform={`translate(${ZOOM23_CENTER.x} ${ZOOM23_CENTER.y}) scale(${z}) translate(${-ZOOM23_CENTER.x} ${-ZOOM23_CENTER.y})`}>
          <g transform="translate(-40 -60)">
            <rect x="869" y="-100" width="400" height="1582" fill={paper.sand} />
            <rect x="869" y="-100" width="400" height="1582" fill="url(#s2b-section)" opacity={0.18} />
            <rect x="869" y="-100" width="10" height="1582" fill="#2A2420" opacity={0.08} />
            <line x1="869" y1="-100" x2="869" y2="1482" stroke="#2A2420" strokeWidth={2.4} strokeLinecap="round" />
            <rect x="-100" y="1482" width="969" height="56" fill="url(#s2b-section)" opacity={0.2} />
            <line x1="-100" y1="1482" x2="869" y2="1482" stroke="#2A2420" strokeWidth={2.4} strokeLinecap="round" />
            <Contact cx={372} cy={1484} rx={118} />
            <g style={{filter: 'drop-shadow(0 5px 6px rgba(42,36,32,0.16))'}}>
              <g transform={pose.body}>
                <FigureBody uid="s2b" />
              </g>
              <Arm uid="s2b" pose={pose.arm} />
              <WallFoot />
              <WallHand />
            </g>
            <g transform={pose.body} opacity={cuesOut}>
              <DrawPath id="s2b-line" d={`M ${LINE_TOP.x} ${LINE_TOP.y} L ${LINE_BOT.x} ${LINE_BOT.y}`}
                p={prog(t, 8.0, 9.3, ease.inOutSine)} width={2} dash="12 9" opacity={0.85} />
              <DrawPath d={tick(LINE_TOP)} p={prog(t, 8.0, 8.3)} width={2} />
              <DrawPath d={tick(LINE_BOT)} p={prog(t, 9.1, 9.4)} width={2} />
            </g>
          </g>
          <g opacity={cuesOut} fill="none">
            <DrawPath d="M 862 690 A 36 36 0 1 1 861.9 689.5" p={prog(t, 5.2, 5.95, ease.inOutSine)} width={2} />
            <DrawPath d="M 900 452 C 890 540 860 610 846 656" p={prog(t, 5.7, 6.2)} width={1.4} opacity={0.8} />
            <DrawPath d="M 412 1318 L 412 1342" p={prog(t, 2.6, 2.8)} width={1.6} />
            <DrawPath d="M 829 1318 L 829 1342" p={prog(t, 2.6, 2.8)} width={1.6} />
            <DrawPath d="M 412 1330 L 829 1330" p={prog(t, 2.75, 3.6, ease.inOutSine)} width={1.6} />
            <DrawPath d="M 426 1322 L 412 1330 L 426 1338" p={prog(t, 2.8, 3.0)} width={1.6} />
            <DrawPath d="M 815 1322 L 829 1330 L 815 1338" p={prog(t, 3.45, 3.65)} width={1.6} />
          </g>
          <g opacity={arrows} fill="none">
            <g opacity={inOn}>
              <path d="M 64 234 L 118 234 M 104 225 L 118 234 L 104 243" stroke="#2A2420" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <g opacity={outOn}>
              <path d="M 64 288 L 118 288 M 78 279 L 64 288 L 78 297" stroke="#2A2420" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </g>
          <g opacity={cuesOut}>
            <Label id="s2b-t" t={t} t0={0.5} dur={0.8} x={64} y={172} lines={['wall push-up']} size={44} spacing={3} />
            <Label id="s2b-len" t={t} t0={3.2} dur={0.8} x={620} y={1306} anchor="middle" lines={["about an arm's length"]} />
            <Label id="s2b-hand" t={t} t0={5.95} dur={1.0} x={1016} y={408} anchor="end" lineGap={34}
              lines={['hands just below', 'the shoulders']} />
            <Label id="s2b-straight" t={t} t0={8.6} dur={1.0} x={530} y={400} anchor="end" lineGap={34}
              lines={['one straight line,', 'head to heel']} />
          </g>
          <g opacity={arrows}>
            <Label id="s2b-bi" t={t} t0={10.1} dur={0.8} x={136} y={244} lines={['breathe in, lean toward the wall']} opacity={inOn} />
            <Label id="s2b-bo" t={t} t0={10.3} dur={0.8} x={136} y={298} lines={['breathe out, press away']} opacity={outOn} />
          </g>
        </g>
      </Canvas>
    </Sheet>
  );
};
