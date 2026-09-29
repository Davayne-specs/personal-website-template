// Scene changes: smoke wipe and the print roller.
import React from 'react';
import {Img, staticFile} from 'remotion';
import {C} from '../brand/tokens';
import {clamp} from '../lib/ease';
import {hash} from '../lib/random';

// p: 0..1 across the wipe window; the scene swaps under full cover at p = 0.5.
export const SmokeWipe: React.FC<{p: number; seed: number}> = ({p, seed}) => {
  const cover = Math.sin(Math.PI * clamp(p));
  const dir = hash(seed) % 2 === 0 ? 1 : -1;
  const puffs = [0, 1, 2, 3, 4, 5].map((i) => {
    const h = hash(`${seed}:${i}`);
    const y = -200 + i * 360 + ((h % 100) - 50);
    const x0 = dir > 0 ? -1300 : 1300;
    const x = x0 + dir * (p * 1700 + ((h >> 8) % 200));
    const s = 1200 + cover * 700;
    return (
      <Img
        key={i}
        src={staticFile(`tex/smoke-${(i % 4) + 1}.png`)}
        style={{
          position: 'absolute',
          left: x + 540 - s / 2,
          top: y,
          width: s,
          height: s * 0.76,
          opacity: Math.min(1, cover * 1.4),
          transform: `rotate(${(h % 30) - 15}deg) scaleX(${dir})`,
        }}
      />
    );
  });
  return (
    <>
      <div style={{position: 'absolute', inset: 0, background: '#D9DEDE', opacity: Math.pow(cover, 2.2) * 0.96}} />
      {puffs}
    </>
  );
};

// The riso drum: the new print is revealed above a moving roller edge at y.
export const Roller: React.FC<{y: number}> = ({y}) => (
  <div style={{position: 'absolute', left: 0, right: 0, top: y - 10, height: 60, pointerEvents: 'none'}}>
    <div style={{position: 'absolute', left: 0, right: 0, top: 10, height: 34, background: 'linear-gradient(rgba(35,27,46,0.28), rgba(35,27,46,0))'}} />
    <div style={{position: 'absolute', left: 0, right: 0, top: 4, height: 8, background: C.ink, opacity: 0.85}} />
  </div>
);
