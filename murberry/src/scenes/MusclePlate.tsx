import React from 'react';
import {paper} from '../brand/tokens';
import {Muscle, MuscleState} from '../components/Muscle';
import * as A from './machineArt';

export type PlateStates = {pec: MuscleState; deltoid: MuscleState; triceps: MuscleState; serratus: MuscleState};

/**
 * The muscle layer under the skin: ghost outline of the figure, faint
 * bones and ribs, and the four push-up muscles. Drawn in plate space.
 */
export const MusclePlate: React.FC<{
  uid: string;
  s: PlateStates;
  ghost?: number;
  anatomy?: number;
  lat?: number;
}> = ({uid, s, ghost = 1, anatomy = 1, lat = 1}) => (
  <g transform={A.PLATE_TRANSFORM}>
    <g transform="translate(-575 -676) scale(1.8)" fill="none" stroke="#2A2420" strokeLinecap="round" strokeLinejoin="round" opacity={ghost}>
      <g transform="rotate(16 320 1440)">
        <path strokeWidth={0.7} strokeDasharray="3 4" opacity={0.6} d={A.GHOST_BODY} />
        <g strokeWidth={0.6} opacity={0.5}>
          {A.GHOST_FACE.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <g transform="rotate(-10 318 700)">
          <path strokeWidth={0.7} strokeDasharray="3 4" opacity={0.6} d={A.GHOST_ARM} />
        </g>
      </g>
    </g>
    <g fill="none" stroke="#2A2420" strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.8} opacity={0.38 * anatomy}>
      {A.ANATOMY.map((d, i) => (
        <path key={i} d={d} />
      ))}
      <path strokeDasharray="3 5" d={A.ANATOMY_DASHED} />
    </g>
    <g fill="none" stroke="#2A2420" strokeWidth={1.1} opacity={0.6 * anatomy}>
      <circle cx="365" cy="635" r="24" />
      <circle cx="688" cy="698" r="16" />
    </g>
    <g stroke="#2A2420" strokeLinejoin="round">
      <Muscle uid={uid} paths={[A.PEC]} center={A.CENTERS.pec} fibres={A.PEC_FIBRES} s={s.pec} />
      <Muscle uid={uid} paths={A.SERRATUS} center={A.CENTERS.serratus} s={s.serratus} />
      <g opacity={lat}>
        <path d={A.LAT} fill={paper.clay} stroke="#2A2420" strokeWidth={1.1} strokeOpacity={0.35} />
        <path d={A.LAT} fill={`url(#${uid}-lat)`} opacity={0.35} />
      </g>
      <Muscle
        uid={uid}
        paths={[A.TRICEPS]}
        center={A.CENTERS.triceps}
        fibres={A.TRICEPS_FIBRES}
        s={s.triceps}
        extra={<path d={A.TRICEPS_TENDON} fill="#E0C49E" stroke="#2A2420" strokeWidth={1.1} opacity={s.triceps.named} />}
      />
      <Muscle uid={uid} paths={[A.DELTOID]} center={A.CENTERS.deltoid} fibres={A.DELTOID_FIBRES} s={s.deltoid} />
    </g>
  </g>
);
