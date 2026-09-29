// The Gauge: the hook's pressure meter. value 0..1 sweeps the needle from -130deg to +130deg.
import React from 'react';
import {C} from '../brand/tokens';
import {Line, Shape, Txt} from '../lib/print';
import {arc, circle, poly} from '../lib/shapes';

export const Gauge: React.FC<{x: number; y: number; r: number; value: number; shake?: number; opacity?: number; label?: boolean}> = ({
  x,
  y,
  r,
  value,
  shake = 0,
  opacity = 1,
  label = true,
}) => {
  const a = -130 + 260 * Math.max(0, Math.min(1.08, value)) + shake;
  const rad = ((a - 90) * Math.PI) / 180;
  const ticks = Array.from({length: 11}, (_, i) => {
    const t = ((-130 + i * 26 - 90) * Math.PI) / 180;
    return `M${(Math.cos(t) * r * 0.72).toFixed(1)},${(Math.sin(t) * r * 0.72).toFixed(1)}L${(Math.cos(t) * r * 0.86).toFixed(1)},${(Math.sin(t) * r * 0.86).toFixed(1)}`;
  }).join('');
  // red zone: last third of the sweep
  const redA0 = -130 + 260 * 0.66 - 90;
  const redA1 = 130 - 90;
  const red = (() => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 20; i++) {
      const t = ((redA0 + ((redA1 - redA0) * i) / 20) * Math.PI) / 180;
      pts.push([Math.cos(t) * r * 0.92, Math.sin(t) * r * 0.92]);
    }
    for (let i = 20; i >= 0; i--) {
      const t = ((redA0 + ((redA1 - redA0) * i) / 20) * Math.PI) / 180;
      pts.push([Math.cos(t) * r * 0.7, Math.sin(t) * r * 0.7]);
    }
    return poly(pts);
  })();
  return (
    <g transform={`translate(${x},${y})`} opacity={opacity}>
      <Shape d={circle(0, 0, r * 1.08)} fill={C.gold} pattern="foil" line={6} />
      <Shape d={circle(0, 0, r)} fill={C.white} line={5} />
      <Shape d={red} fill={C.pressure} shade={red} shadeInk="ht-ink-3" line={3} shadow={false} />
      <Line d={ticks} size={5} />
      <Line d={arc(0, 0, r * 0.92, -220, 40, 30)} size={3} opacity={0.5} />
      {label && (
        <Txt x={0} y={r * 0.46} size={r * 0.2} font="Space Mono" weight={700}>
          PRESSURE
        </Txt>
      )}
      <Shape
        d={`M${(Math.cos(rad) * r * 0.8).toFixed(1)},${(Math.sin(rad) * r * 0.8).toFixed(1)}L${(Math.cos(rad + Math.PI / 2) * r * 0.06).toFixed(1)},${(Math.sin(rad + Math.PI / 2) * r * 0.06).toFixed(1)}L${(Math.cos(rad - Math.PI / 2) * r * 0.06).toFixed(1)},${(Math.sin(rad - Math.PI / 2) * r * 0.06).toFixed(1)}Z`}
        fill={C.ink}
        line={3}
      />
      <Shape d={circle(0, 0, r * 0.1)} fill={C.gold} pattern="foil" line={4} />
    </g>
  );
};
