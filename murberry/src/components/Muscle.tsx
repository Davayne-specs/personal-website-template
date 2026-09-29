import React from 'react';
import {muscle as M} from '../brand/tokens';
import {clamp01, mixHex} from '../lib/anim';
import {DrawPath} from './Draw';

export type MuscleState = {
  draw: number; // outline drawing in
  named: number; // green fill + open hatch
  load: number; // red, cross-hatched, swollen
  recover: number; // pale gold inside a pencil ring
  swell: number; // extra scale (1 = none)
};

export const muscleFill = (s: MuscleState) => {
  const base = mixHex(M.named, M.load, s.load);
  const hex = (rgb: string) => {
    const m = rgb.match(/\d+/g)!.map(Number);
    return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join('');
  };
  return mixHex(hex(base), M.recover, s.recover);
};

/**
 * One named muscle. Colour never carries the state alone: under load the
 * muscle also swells and its open hatching tightens to cross-hatch.
 */
export const Muscle: React.FC<{
  uid: string;
  paths: string[];
  center: {x: number; y: number};
  fibres?: string;
  extra?: React.ReactNode;
  s: MuscleState;
  stroke?: number;
}> = ({uid, paths, center, fibres, extra, s, stroke = 1.1}) => {
  const named = clamp01(s.named);
  const load = clamp01(s.load);
  const rec = clamp01(s.recover);
  const fill = muscleFill(s);
  const k = s.swell;
  return (
    <g transform={`translate(${center.x} ${center.y}) scale(${k}) translate(${-center.x} ${-center.y})`}>
      {rec > 0 ? (
        <g opacity={rec * 0.28}>
          {paths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="#2A2420" strokeWidth={4.5} strokeLinejoin="round" />
          ))}
        </g>
      ) : null}
      {paths.map((d, i) => (
        <g key={i}>
          <path d={d} fill={fill} opacity={named} />
          <path d={d} fill={`url(#${uid}-open)`} opacity={0.7 * named * (1 - load) * (1 - rec)} />
          <path d={d} fill={`url(#${uid}-x1)`} opacity={0.7 * load * (1 - rec)} />
          <path d={d} fill={`url(#${uid}-x2)`} opacity={0.7 * load * (1 - rec)} />
          <DrawPath d={d} p={s.draw} width={stroke + rec * 0.3} cap="round" />
        </g>
      ))}
      {extra}
      {fibres ? (
        <path d={fibres} fill="none" stroke="#2A2420" strokeWidth={0.7}
          opacity={named * (0.6 - 0.35 * load) * (1 - 0.25 * rec)} />
      ) : null}
    </g>
  );
};
