// Shared face drawing for Stein and Precious (head-local coords, face centre ~ (0, -150)).
import React from 'react';
import {C} from '../brand/tokens';
import {Flat, Line, Only, Shape} from '../lib/print';
import {circle, ellipse, heart} from '../lib/shapes';

export type Face = {
  blink?: number; // 0 open .. 1 closed
  mouth?: number; // 0 closed .. 1 wide open
  smile?: number; // -1 frown .. 1 grin
  brow?: number; // -1 cross/sad .. 1 raised
  browTilt?: number; // + = worried (inner ends up), - = cross (inner ends down)
  look?: [number, number]; // pupil offset, -1..1
  turn?: number; // head turn -1..1: features slide sideways
  eyes?: 'dot' | 'wide' | 'closed' | 'happy' | 'heart' | 'shades' | 'wink';
  blush?: number; // 0..1
  lashes?: boolean;
  lip?: string; // lip colour (Precious)
};

type Geo = {eyeX: number; eyeY: number; browY: number; noseY: number; mouthY: number; width: number};

export const drawFace = (fc: Face, g: Geo) => {
  const turn = fc.turn ?? 0;
  const fx = turn * g.width * 0.24;
  const blink = fc.blink ?? 0;
  const eyes = fc.eyes ?? 'dot';
  const brow = fc.brow ?? 0;
  const tilt = fc.browTilt ?? 0;
  const smile = fc.smile ?? 0.4;
  const mouth = Math.max(0, Math.min(1, fc.mouth ?? 0));
  const [lx, ly] = fc.look ?? [0, 0];
  const parts: React.ReactNode[] = [];

  // cheeks
  if ((fc.blush ?? 0) > 0.01) {
    [-1, 1].forEach((s) =>
      parts.push(
        <Flat key={`bl${s}`} d={circle(s * (g.eyeX + 12) + fx, g.eyeY + 34, 22)} fill="url(#ht-pink-3)" opacity={fc.blush} />
      )
    );
  }

  [-1, 1].forEach((s) => {
    const ex = s * g.eyeX + fx * (1 + s * turn * 0.25);
    const ey = g.eyeY;
    const k = `e${s}`;
    const winkThis = eyes === 'wink' && s === 1;
    if (eyes === 'shades') return;
    if (eyes === 'happy' || winkThis) {
      parts.push(<Line key={k} d={`M${ex - 13},${ey + 3}C${ex - 6},${ey - 10} ${ex + 6},${ey - 10} ${ex + 13},${ey + 3}`} size={6} />);
      return;
    }
    if (eyes === 'closed' || blink > 0.85) {
      parts.push(<Line key={k} d={`M${ex - 12},${ey}C${ex - 5},${ey + 7} ${ex + 5},${ey + 7} ${ex + 12},${ey}`} size={5.5} />);
      return;
    }
    if (eyes === 'heart') {
      parts.push(
        <Only key={k} plate="key">
          <path d={heart(ex, ey, 15)} fill={C.hotpink} />
        </Only>
      );
      return;
    }
    const rx = eyes === 'wide' ? 12 : 8.5;
    const ry = (eyes === 'wide' ? 15 : 11.5) * (1 - blink * 0.9);
    if (eyes === 'wide') {
      parts.push(<Shape key={`${k}w`} d={ellipse(ex, ey, rx + 6, ry + 6)} fill={C.white} line={3.5} shadow={false} />);
    }
    parts.push(
      <Only key={k} plate="key">
        <path d={ellipse(ex + lx * 4, ey + ly * 4, rx * (eyes === 'wide' ? 0.62 : 1), ry * (eyes === 'wide' ? 0.62 : 1))} fill={C.ink} />
        <path d={circle(ex + lx * 4 - 2.5, ey + ly * 4 - 4, 2.6)} fill={C.white} />
      </Only>
    );
    if (fc.lashes) {
      parts.push(<Line key={`${k}l`} d={`M${ex + s * 7},${ey - 9}L${ex + s * 17},${ey - 17}`} size={4} />);
    }
  });

  if (eyes === 'shades') {
    parts.push(
      <Only key="shades" plate="key">
        <path
          d={`M${-g.eyeX - 30 + fx},${g.eyeY - 14}L${g.eyeX + 30 + fx},${g.eyeY - 14}L${g.eyeX + 24 + fx},${g.eyeY + 14}C${g.eyeX + 10 + fx},${g.eyeY + 22} ${10 + fx},${g.eyeY + 16} ${6 + fx},${g.eyeY + 2}L${-6 + fx},${g.eyeY + 2}C${-10 + fx},${g.eyeY + 16} ${-g.eyeX - 10 + fx},${g.eyeY + 22} ${-g.eyeX - 24 + fx},${g.eyeY + 14}Z`}
          fill={C.ink}
        />
        <path d={`M${-g.eyeX - 14 + fx},${g.eyeY - 6}L${-g.eyeX + 2 + fx},${g.eyeY - 6}`} stroke={C.white} strokeWidth={3} opacity={0.7} />
      </Only>
    );
  }

  // brows
  [-1, 1].forEach((s) => {
    const bx = s * g.eyeX + fx;
    const by = g.browY - brow * 9;
    const inner = by + tilt * -7;
    const outer = by + tilt * 5;
    const x0 = bx - s * 15;
    const x1 = bx + s * 15;
    parts.push(<Line key={`b${s}`} d={`M${x0},${inner}Q${bx},${by - 5} ${x1},${outer}`} size={7} thin={0.4} />);
  });

  // nose
  parts.push(<Line key="n" d={`M${fx - 4},${g.noseY - 12}C${fx - 9},${g.noseY} ${fx - 3},${g.noseY + 6} ${fx + 8},${g.noseY + 3}`} size={4.5} />);

  // mouth
  const my = g.mouthY;
  if (mouth > 0.08) {
    const w = 17 + 7 * Math.abs(smile) + 4 * mouth;
    const h = 5 + 24 * mouth;
    const mp = `M${fx - w},${my - 2}C${fx - w},${my + h * 1.1} ${fx + w},${my + h * 1.1} ${fx + w},${my - 2}C${fx + w * 0.5},${my + 2 - smile * 5} ${fx - w * 0.5},${my + 2 - smile * 5} ${fx - w},${my - 2}Z`;
    parts.push(
      <Only key="m" plate="key">
        <path d={mp} fill="#3A1E2B" />
        <path d={ellipse(fx, my + h * 0.62, w * 0.55, h * 0.28)} fill={C.candy} />
        <path d={`M${fx - w * 0.8},${my + 1}L${fx + w * 0.8},${my + 1}L${fx + w * 0.7},${my + 5 + h * 0.12}L${fx - w * 0.7},${my + 5 + h * 0.12}Z`} fill={C.white} />
      </Only>
    );
    if (fc.lip) parts.push(<Line key="lip" d={`M${fx - w},${my - 2}C${fx - w * 0.3},${my - 7} ${fx + w * 0.3},${my - 7} ${fx + w},${my - 2}`} size={6} color={fc.lip} />);
  } else {
    const w = 20;
    const c = smile * 10;
    parts.push(
      <Line key="m" d={`M${fx - w},${my - c * 0.4}Q${fx},${my + c} ${fx + w},${my - c * 0.4}`} size={fc.lip ? 7 : 5.5} color={fc.lip} />
    );
  }
  return <>{parts}</>;
};
