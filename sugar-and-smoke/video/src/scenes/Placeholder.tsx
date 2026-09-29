import React from 'react';
import {C, FONT} from '../brand/tokens';
import {Stein, STEIN_POSES} from '../characters/Stein';
import {Txt} from '../lib/print';
import {SceneDef} from './types';

export const Placeholder: SceneDef = {
  ground: 'cotton',
  render: (p) => (
    <>
      <Txt x={540} y={400} size={90} font={FONT.stamp} color={C.ink}>
        {p.slot.tag.toUpperCase()}
      </Txt>
      <Stein place={{x: 540, y: 1000, scale: 0.7}} pose={STEIN_POSES.stand} face={{mouth: p.mouth}} />
    </>
  ),
};
