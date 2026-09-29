// The Gauge rides the top-right corner through the pressure half of the hook,
// kicks on every "pressure" and bursts into confetti at the throw.
import React from 'react';
import {Gauge} from '../../characters/Gauge';
import {clamp, ease} from '../../lib/ease';
import {PrintFrame} from '../../lib/frame';
import {Timeline, useTimeline} from '../../lib/timeline';
import {Confetti} from '../../props/common';

const marks = (tl: Timeline) => ({
  START: tl.SLOTS.find((s) => s.n === 40)!.from + 10,
  BURST: tl.HITS.find((h) => h.n === 56 && h.kind === 'pressure')!.frame,
  PRESSURE_HITS: tl.HITS.filter((h) => h.kind === 'pressure').map((h) => h.frame),
});
const GX = 912;
const GY = 300;
const GR = 104;

export const gaugeValue = (tl: Timeline, frame: number) => {
  const {START, BURST, PRESSURE_HITS} = marks(tl);
  const ramp = 0.14 + 0.72 * Math.pow(clamp((frame - START) / (BURST - START)), 1.15);
  const kick = PRESSURE_HITS.reduce((a, h) => (frame >= h - 1 ? a + 0.12 * Math.exp(-(frame - h) / 9) : a), 0);
  return ramp + kick + 0.02 * tl.beatPulse(frame);
};

export const GaugeOverlay: React.FC<{frame: number}> = ({frame}) => {
  const tl = useTimeline();
  const {START, BURST} = marks(tl);
  if (frame < START || frame > BURST + 40) return null;
  const drop = ease.outBack(clamp((frame - START) / 10));
  const y = -200 + (GY + 200) * drop;
  const pre = clamp((frame - (BURST - 6)) / 6);
  const burst = frame >= BURST;
  return (
    <PrintFrame frame={frame} ground="none" reg={[3, -2]} boilStep={2}>
      {!burst ? (
        <g transform={`translate(${GX},${y}) scale(${1 + 0.18 * pre}) translate(${-GX},${-y})`}>
          <Gauge x={GX + (pre > 0 ? Math.sin(frame * 3) * 6 * pre : 0)} y={y} r={GR} value={gaugeValue(tl, frame)} shake={pre * 8 * Math.sin(frame * 2.3)} />
        </g>
      ) : (
        <Confetti t={frame - BURST} x={GX} y={GY} n={30} seed={56} spread={1.2} />
      )}
    </PrintFrame>
  );
};
