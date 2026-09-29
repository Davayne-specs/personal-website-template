import React from 'react';
import {paper} from '../brand/tokens';
import {DrawPath} from '../components/Draw';
import {Label} from '../components/Label';
import {MuscleState} from '../components/Muscle';
import {Canvas, HatchDefs, Sheet} from '../components/Paper';
import {ZOOM23_CENTER, ZOOM23_MAX, zoom23} from '../ep01/timeline';
import {ease, lerp, prog} from '../lib/anim';
import * as A from './machineArt';
import {MusclePlate} from './MusclePlate';

// Muscles are named in script order.
const NAMED_AT = {pec: 3.0, deltoid: 6.0, triceps: 9.2, serratus: 12.2};
export const LOAD_AT = 19.0;
const LABELS_OUT: [number, number] = [26.6, 27.4];
export const PUSH = {t0: 27.6, t1: 29.8, k: 3, cx: 612, cy: 1146};

const Leader: React.FC<{id: string; t: number; t0: number; which: keyof typeof A.LEADERS}> = ({id, t, t0, which}) => {
  const L = A.LEADERS[which];
  const p = prog(t, t0, t0 + 0.55, ease.inOutSine);
  return (
    <g>
      <DrawPath d={L.d} p={p} width={1.5} opacity={0.85} />
      <circle cx={L.dot[0]} cy={L.dot[1]} r={4.5} fill="#2A2420" opacity={0.85 * prog(t, t0 + 0.45, t0 + 0.6)} />
      <Label id={id} t={t} t0={t0 + 0.35} dur={0.8} x={L.label[0]} y={L.label[1]} lines={[L.text]} />
    </g>
  );
};

/** Beat 3, 0:35-1:05. The skin folds back: four muscles are named, then take the load. */
export const SceneMachine: React.FC<{t: number}> = ({t}) => {
  const T = 35 + t;
  const cam = zoom23(T) / ZOOM23_MAX;
  const push = prog(t, PUSH.t0, PUSH.t1, ease.inOutCubic);
  // A slow drift while the muscles are named, then the push toward the pec.
  const pk = lerp(1, PUSH.k, push) * lerp(1, 1.025, prog(t, 2, PUSH.t0, ease.inOutSine));
  // Under load each muscle turns quickly, one after another, so the green
  // never lingers in the muddy middle on its way to red.
  const loadOf = (k: number) => prog(t, LOAD_AT + k * 0.14, LOAD_AT + k * 0.14 + 0.7, ease.inOutSine);
  const loadP = loadOf(0);
  const breathe = loadP * 0.008 * Math.sin(((t - LOAD_AT) / 2.2) * Math.PI * 2);
  const st = (at: number, k: number): MuscleState => {
    const l = loadOf(k);
    return {
      draw: prog(t, at, at + 0.9, ease.inOutSine),
      named: prog(t, at + 0.45, at + 1.15),
      load: l,
      recover: 0,
      swell: 1 + 0.05 * prog(t, LOAD_AT + k * 0.14, LOAD_AT + k * 0.14 + 1.2, ease.inOutSine) + breathe * l,
    };
  };
  const anatomy = prog(t, 0.8, 2.2);
  const out = 1 - prog(t, LABELS_OUT[0], LABELS_OUT[1]);
  const inset = prog(t, 21.0, 21.9, ease.outCubic);

  return (
    <Sheet color={paper.clay}>
      <Canvas>
        <HatchDefs id="s3" />
        <defs>
          <linearGradient id="s3-fadeg" x1="0" y1="1100" x2="0" y2="1330" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </linearGradient>
          <mask id="s3-fade" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="6000" height="6000">
            <rect x="-2000" y="-2000" width="6000" height="3100" fill="#fff" />
            <rect x="-2000" y="1100" width="6000" height="230" fill="url(#s3-fadeg)" />
          </mask>
        </defs>
        <g transform={`translate(${PUSH.cx} ${PUSH.cy}) scale(${pk}) translate(${-PUSH.cx} ${-PUSH.cy})`}>
          <g mask="url(#s3-fade)">
            <g transform={`translate(${ZOOM23_CENTER.x} ${ZOOM23_CENTER.y}) scale(${cam}) translate(${-ZOOM23_CENTER.x} ${-ZOOM23_CENTER.y})`}>
              <MusclePlate
                uid="s3"
                anatomy={anatomy}
                lat={prog(t, 1.2, 2.4)}
                s={{
                  pec: st(NAMED_AT.pec, 0),
                  deltoid: st(NAMED_AT.deltoid, 1),
                  triceps: st(NAMED_AT.triceps, 2),
                  serratus: st(NAMED_AT.serratus, 3),
                }}
              />
            </g>
          </g>
          <g opacity={out}>
            <Leader id="s3-pec" t={t} t0={NAMED_AT.pec + 0.8} which="pec" />
            <Leader id="s3-del" t={t} t0={NAMED_AT.deltoid + 0.8} which="deltoid" />
            <Leader id="s3-tri" t={t} t0={NAMED_AT.triceps + 0.8} which="triceps" />
            <Leader id="s3-ser" t={t} t0={NAMED_AT.serratus + 1.0} which="serratus" />
            <g fill="none">
              <DrawPath d="M 244 546 A 72 72 0 0 1 352 560" p={prog(t, LOAD_AT + 0.8, LOAD_AT + 1.8, ease.inOutSine)} width={2} />
              <DrawPath d="M 340 548 L 352 560 L 336 566" p={prog(t, LOAD_AT + 1.7, LOAD_AT + 2.0)} width={2} />
              <DrawPath d="M 770 656 A 58 58 0 0 1 852 682" p={prog(t, LOAD_AT + 1.2, LOAD_AT + 2.2, ease.inOutSine)} width={2} />
              <DrawPath d="M 838 670 L 852 682 L 836 688" p={prog(t, LOAD_AT + 2.1, LOAD_AT + 2.4)} width={2} />
            </g>
            <Label id="s3-title" t={t} t0={1.4} dur={0.8} out={[17.0, 17.6]} x={1016} y={172} anchor="end"
              lines={['the machine']} size={44} spacing={3} />
            <Label id="s3-title2" t={t} t0={17.6} dur={0.8} x={1016} y={172} anchor="end"
              lines={['under load']} size={44} spacing={3} />
            {inset > 0 ? (
              <g transform={`translate(${(1 - inset) * 420} 0)`}>
                <rect x="736" y="1100" width="280" height="400" rx="6" fill={paper.sand}
                  style={{filter: 'drop-shadow(0 6px 7px rgba(42,36,32,0.22))'}} />
                <g transform="translate(687.2 950.8) scale(0.36)" fill="none" stroke="#2A2420" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="869" y1="470" x2="869" y2="1482" strokeWidth={4} />
                  <line x1="180" y1="1482" x2="869" y2="1482" strokeWidth={4} />
                  <g transform="rotate(16 320 1440)" strokeWidth={4} opacity={0.75}>
                    <path d={A.MINI_BODY} />
                    <g transform="rotate(-10 318 700)">
                      <path d={A.MINI_ARM} />
                    </g>
                  </g>
                  <path strokeWidth={5} opacity={0.75} d={A.MINI_FOOT} />
                  <rect x="423" y="517" width="376" height="462" strokeWidth={4} strokeDasharray="14 10" opacity={0.7} />
                  <DrawPath d={A.EFFORT_LINE} p={prog(t, 22.0, 24.2, ease.inOutSine)} stroke="#B8322A" width={12} />
                  <DrawPath d={A.EFFORT_HEAD} p={prog(t, 24.0, 24.4)} stroke="#B8322A" width={12} />
                </g>
              </g>
            ) : null}
            <Label id="s3-hcf" t={t} t0={22.6} dur={1.0} x={1016} y={1084} anchor="end" lines={['hands, core, feet']}
              size={24} spacing={1.4} />
          </g>
        </g>
      </Canvas>
    </Sheet>
  );
};
