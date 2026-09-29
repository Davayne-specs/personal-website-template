// The Gauge rides the top-right corner through the pressure half of the hook,
// kicks on every "pressure" and bursts into confetti at the throw.
import React from 'react';
import {C} from '../brand/tokens';
import {Gauge} from '../characters/Gauge';
import {clamp, ease} from '../lib/ease';
import {PrintFrame} from '../lib/frame';
import {Shape} from '../lib/print';
import {rng} from '../lib/random';
import {beatPulse, HITS, SLOTS} from '../lib/timeline';

const START = SLOTS.find((s) => s.n === 40)!.from + 10;
const BURST = HITS.find((h) => h.n === 56 && h.kind === 'pressure')!.frame;
const PRESSURE_HITS = HITS.filter((h) => h.kind === 'pressure').map((h) => h.frame);
const GX = 912;
const GY = 300;
const GR = 104;

export const gaugeValue = (frame: number) => {
  const ramp = 0.14 + 0.72 * Math.pow(clamp((frame - START) / (BURST - START)), 1.15);
  const kick = PRESSURE_HITS.reduce((a, h) => (frame >= h - 1 ? a + 0.12 * Math.exp(-(frame - h) / 9) : a), 0);
  return ramp + kick + 0.02 * beatPulse(frame);
};

const CONFETTI_COLORS = [C.gold, C.hotpink, C.pressure, C.aqua, C.candy, C.white, C.teal];

export const Confetti: React.FC<{t: number; x: number; y: number; n?: number; seed?: number; spread?: number; floor?: number}> = ({
  t,
  x,
  y,
  n = 26,
  seed = 7,
  spread = 1,
  floor = 1800,
}) => {
  const r = rng(seed);
  const bits = Array.from({length: n}, (_, i) => {
    const a = r() * Math.PI * 2;
    const v = (8 + r() * 18) * spread;
    const vx = Math.cos(a) * v;
    const vy = Math.sin(a) * v - 10 * spread;
    const px = x + vx * t;
    const py = Math.min(floor, y + vy * t + 0.55 * t * t);
    const rot = (r() * 360 + t * (r() * 20 - 10)) % 360;
    const w = 14 + r() * 18;
    const h = 8 + r() * 10;
    const col = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    return (
      <g key={i} transform={`translate(${px.toFixed(1)},${py.toFixed(1)}) rotate(${rot.toFixed(1)})`}>
        <Shape d={`M${-w / 2},${-h / 2}L${w / 2},${-h / 2}L${w / 2},${h / 2}L${-w / 2},${h / 2}Z`} fill={col} line={2.5} />
      </g>
    );
  });
  return <>{bits}</>;
};

export const GaugeOverlay: React.FC<{frame: number}> = ({frame}) => {
  if (frame < START || frame > BURST + 40) return null;
  const drop = ease.outBack(clamp((frame - START) / 10));
  const y = -200 + (GY + 200) * drop;
  const pre = clamp((frame - (BURST - 6)) / 6);
  const burst = frame >= BURST;
  return (
    <PrintFrame frame={frame} ground="none" reg={[3, -2]} boilStep={2}>
      {!burst ? (
        <g transform={`translate(${GX},${y}) scale(${1 + 0.18 * pre}) translate(${-GX},${-y})`}>
          <Gauge x={GX + (pre > 0 ? Math.sin(frame * 3) * 6 * pre : 0)} y={y} r={GR} value={gaugeValue(frame)} shake={pre * 8 * Math.sin(frame * 2.3)} />
        </g>
      ) : (
        <Confetti t={frame - BURST} x={GX} y={GY} n={30} seed={56} spread={1.2} />
      )}
    </PrintFrame>
  );
};
