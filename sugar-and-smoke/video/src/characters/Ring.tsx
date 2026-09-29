// The Ring: the single's cover ring as a character. A thick gold band that can
// turn in 3D (spin), tilt, glint and sheen.
import React from 'react';
import {C} from '../brand/tokens';
import {Flat, Line, Shape} from '../lib/print';
import {ellipse, star4} from '../lib/shapes';

export type RingProps = {
  x: number;
  y: number;
  r: number; // outer radius
  spin?: number; // degrees about the vertical axis (0 = face-on)
  tilt?: number; // in-plane rotation, degrees
  band?: number; // band width as a fraction of r
  glint?: number; // 0..1 sparkle
  glow?: number; // 0..1 halo
  opacity?: number;
  shadow?: boolean;
};

export const Ring: React.FC<RingProps> = ({x, y, r, spin = 0, tilt = -18, band = 0.24, glint = 0, glow = 0, opacity = 1, shadow = true}) => {
  const c = Math.cos((spin * Math.PI) / 180);
  const sx = Math.max(0.1, Math.abs(c));
  const inner = r * (1 - band);
  const depth = r * 0.22 * Math.sqrt(1 - sx * sx) + r * 0.1; // visible thickness of the band edge
  const outer = ellipse(0, 0, r * sx, r);
  const hole = ellipse(0, 0, inner * sx, inner);
  const edge = ellipse(depth * Math.sign(c || 1), 0, r * sx, r);
  return (
    <g transform={`translate(${x},${y}) rotate(${tilt})`} opacity={opacity}>
      {glow > 0.01 && <Flat d={ellipse(0, 0, r * 2.2, r * 2.2)} fill="url(#glow-gold)" opacity={glow} />}
      {/* the band's thickness: a darker copy offset behind */}
      <Shape d={`${edge}${ellipse(depth * Math.sign(c || 1), 0, inner * sx, inner)}`} evenodd fill={C.goldLo} pattern="foil" line={4} shadow={shadow} />
      <Shape d={`${outer}${hole}`} evenodd fill={C.gold} pattern="foil" line={5} sheen shadow={shadow} />
      <Line d={`M${-r * 0.62 * sx},${-r * 0.55}C${-r * 0.3 * sx},${-r * 0.86} ${r * 0.25 * sx},${-r * 0.88} ${r * 0.5 * sx},${-r * 0.7}`} size={Math.max(3, r * 0.06)} color={C.goldHi} />
      {glint > 0.01 && (
        <>
          <Flat d={star4(r * 0.55 * sx, -r * 0.62, r * 0.42 * glint)} fill="#FFF7DA" />
          <Flat d={star4(-r * 0.7 * sx, r * 0.4, r * 0.22 * glint)} fill="#FFF7DA" />
        </>
      )}
    </g>
  );
};
