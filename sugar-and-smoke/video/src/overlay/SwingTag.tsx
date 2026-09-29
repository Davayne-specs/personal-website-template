// Each scene's swing tag: drops in on its string, swings to rest.
import React from 'react';
import {C, FONT, TAG_STOCK} from '../brand/tokens';
import {clamp, ease, swing} from '../lib/ease';
import {Line, Shape, Txt} from '../lib/print';
import {circle} from '../lib/shapes';
import {Slot} from '../lib/timeline';

// Tag body in its own coordinates; the eyelet sits at (30, 60).
const TAG = 'M28,0L322,0C330,0 334,4 334,12L334,108C334,116 330,120 322,120L28,120L0,60Z';

export const SwingTag: React.FC<{slot: Slot; frame: number}> = ({slot, frame}) => {
  const f = frame - slot.from;
  const drop = ease.outBack(clamp(f / 9));
  const out = clamp((frame - (slot.to - 3)) / 3);
  const ang = swing(f - 9, 11, 30, 20) - 4;
  const stock = TAG_STOCK[slot.state];
  const label = slot.n === 0 ? 'No. 00' : `No. ${String(slot.n).padStart(2, '0')}`;
  const name = slot.tag;
  const nameSize = Math.min(40, 262 / (0.56 * name.length));
  const L = 140;
  const py = 36 - (1 - drop) * 380;
  return (
    <g transform={`translate(96,${py}) rotate(${ang})`} opacity={1 - out}>
      <Line d={`M0,0C3,${L * 0.4} -2,${L * 0.7} 0,${L}`} size={3.4} color={C.ink} />
      <g transform={`translate(-30,${L - 60}) rotate(${-ang * 0.4} 30 60)`}>
        <Shape d={TAG} fill={stock.bg} line={5} />
        <Shape d={circle(30, 60, 11)} fill={C.cotton} line={3.5} shadow={false} ghost={false} />
        <Txt x={60} y={44} size={24} font={FONT.tag} weight={700} anchor="start" color={stock.fg}>
          {label}
        </Txt>
        <Txt x={60} y={94} size={nameSize} font={FONT.lyric} weight={800} anchor="start" color={stock.fg}>
          {name}
        </Txt>
      </g>
    </g>
  );
};
