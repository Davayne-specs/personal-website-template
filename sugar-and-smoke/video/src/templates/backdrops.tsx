// Backdrops for the template kit: a paper-cut sky for the time of day, then a road, a street,
// a room, a shore or a field. Everything stands on FLOOR; the horizon sits above it.
import React from 'react';
import {C, Ground} from '../brand/tokens';
import {Flat, Line, Shape} from '../lib/print';
import {rng} from '../lib/random';
import {circle, ellipse, rect, smooth} from '../lib/shapes';
import {Moon, Stars} from '../props/common';
import {Streetlight} from '../props/winter';

export type TimeOfDay = 'day' | 'dawn' | 'dusk' | 'night';
export type BgName = 'plain' | 'sky' | 'road' | 'street' | 'room' | 'shore' | 'field';
export const FLOOR = 1320;
export const HORIZON = 1150;

export const groundFor: Record<TimeOfDay, Ground> = {day: 'cotton', dawn: 'blush', dusk: 'dusk', night: 'night'};
export const isNight = (t: TimeOfDay) => t === 'night' || t === 'dusk';

// Three paper bands per sky, top to horizon.
const SKY: Record<TimeOfDay, {bands: [string, string, string]; glow: number}> = {
  day: {bands: ['#A9CFE4', '#C4DEEC', '#E3F0F6'], glow: 0},
  dawn: {bands: ['#8E7DA6', '#D9A3B5', '#F6C29A'], glow: 0.9},
  dusk: {bands: ['#2F2A48', '#5B4468', '#8E5E86'], glow: 0.5},
  night: {bands: ['#1B1626', '#231D33', '#2E2743'], glow: 0},
};
const GROUND: Record<TimeOfDay, string> = {day: '#E3DCCB', dawn: '#E8CFC0', dusk: '#3B3752', night: '#221E31'};
const ROAD: Record<TimeOfDay, string> = {day: '#6C6F7C', dawn: '#6F6478', dusk: '#2E2A40', night: '#1C1828'};
const WALL: Record<TimeOfDay, string> = {day: '#F3E6D6', dawn: '#F2D8CF', dusk: '#3A3550', night: '#2A2438'};
const WATER: Record<TimeOfDay, string> = {day: '#8ED3C9', dawn: '#D5B6B6', dusk: '#4C4A6E', night: '#2F2C4A'};

export const Sky: React.FC<{time: TimeOfDay; f: number; horizon?: number}> = ({time, f, horizon = HORIZON}) => {
  const P = SKY[time];
  return (
    <>
      <Flat d={rect(-100, -100, 1280, horizon + 100)} fill={P.bands[0]} />
      <Flat d={rect(-100, horizon * 0.4, 1280, horizon * 0.6)} fill={P.bands[1]} />
      <Flat d={rect(-100, horizon * 0.72, 1280, horizon * 0.28)} fill={P.bands[2]} />
      {P.glow > 0 && <Flat d={ellipse(540, horizon, 900, 300)} fill="url(#glow-amber)" opacity={P.glow} />}
      {time === 'night' && <Stars f={f} n={26} seed={31} y0={80} y1={horizon - 240} />}
      {time === 'night' && <Moon x={820} y={360} r={80} />}
      {time === 'dusk' && <Stars f={f} n={9} seed={32} y0={80} y1={420} />}
    </>
  );
};

const GroundPlane: React.FC<{time: TimeOfDay}> = ({time}) => <Shape d={rect(-100, HORIZON, 1280, 1100)} fill={GROUND[time]} line={5} shadow={false} />;

// A road running to the horizon; `scroll` moves the dashes toward us (walking).
export const Road: React.FC<{time: TimeOfDay; f: number; scroll?: number}> = ({time, f, scroll = 0}) => (
  <>
    <Sky time={time} f={f} />
    <GroundPlane time={time} />
    <Shape d={`M470,${HORIZON}L610,${HORIZON}L1320,2000L-240,2000Z`} fill={ROAD[time]} line={6} shadow={false} />
    {Array.from({length: 9}, (_, k) => {
      const t = (k / 9 + ((scroll / 700) % 1) + 1) % 1;
      const u = t * t;
      const y = HORIZON + 8 + (2000 - HORIZON) * u;
      const w = 6 + 70 * u;
      const h = 14 + 150 * u;
      return <Flat key={k} d={rect(540 - w / 2, y, w, h)} fill={C.goldHi} opacity={0.6 + 0.4 * u} />;
    })}
  </>
);

const BUILDINGS = (() => {
  const r = rng(77);
  const out: {x: number; w: number; h: number; c: string; wins: boolean[]}[] = [];
  let x = 0;
  for (let i = 0; i < 9; i++) {
    const w = 170 + r() * 140;
    const h = 320 + r() * 330;
    out.push({x, w, h, c: ['#4A5566', '#505B6D', '#3F4A5A'][i % 3], wins: Array.from({length: 6}, () => r() < 0.6)});
    x += w + 16;
  }
  return {list: out, span: x};
})();

// A row of flat buildings along a pavement; `scroll` slides them left.
export const Street: React.FC<{time: TimeOfDay; f: number; scroll?: number}> = ({time, f, scroll = 0}) => {
  const lit = isNight(time);
  const off = ((scroll % BUILDINGS.span) + BUILDINGS.span) % BUILDINGS.span;
  return (
    <>
      <Sky time={time} f={f} />
      {[-BUILDINGS.span, 0].map((base) =>
        BUILDINGS.list.map((b, i) => {
          const x = b.x - off + base;
          if (x + b.w < -120 || x > 1200) return null;
          const top = HORIZON - b.h;
          return (
            <g key={`${base}${i}`}>
              <Shape d={rect(x, top, b.w, b.h)} fill={b.c} shade={rect(x + b.w * 0.6, top, b.w * 0.4, b.h)} shadeInk="ht-ink-2" line={5} shadow={false} />
              {b.wins.map((on, k) => {
                const wx = x + 26 + (k % 2) * (b.w / 2);
                const wy = top + 40 + Math.floor(k / 2) * 96;
                if (wy + 60 > HORIZON - 30) return null;
                return (
                  <g key={k}>
                    {lit && on && <Flat d={circle(wx + 24, wy + 30, 60)} fill="url(#glow-amber)" opacity={0.45 + 0.1 * Math.sin(f / 9 + k + i)} />}
                    <Shape d={rect(wx, wy, 48, 60, 4)} fill={lit && on ? C.amber : lit ? '#2C3442' : '#DCE3EA'} line={3.5} shadow={false} />
                  </g>
                );
              })}
            </g>
          );
        })
      )}
      <Shape d={rect(-100, HORIZON, 1280, FLOOR - HORIZON)} fill={lit ? '#4A4660' : '#CFCBC0'} line={5} shadow={false} />
      <Shape d={rect(-100, FLOOR, 1280, 800)} fill={GROUND[time]} line={5} shadow={false} />
      <Streetlight x={150} y={FLOOR + 10} h={640} on={lit ? 1 : 0} />
      <Streetlight x={940} y={FLOOR + 10} h={640} on={lit ? 1 : 0} />
    </>
  );
};

// A wall with a window onto the sky, and a floor.
export const Room: React.FC<{time: TimeOfDay; f: number}> = ({time, f}) => (
  <>
    <Flat d={rect(-100, -100, 1280, FLOOR + 100)} fill={WALL[time]} />
    <Flat d={rect(-100, 980, 1280, FLOOR - 980)} fill={WALL[time]} />
    <Shape d={rect(600, 300, 380, 480, 10)} fill="#2C3548" line={7} />
    <g transform="translate(600,300) scale(0.352,0.4167)">
      <Sky time={time} f={f} horizon={1150} />
    </g>
    <Line d="M790,300L790,780M600,540L980,540" size={6} />
    <Shape d={rect(570, 780, 440, 30, 8)} fill={isNight(time) ? '#4A4660' : C.white} line={5} />
    <Line d={`M-100,${FLOOR - 24}L1180,${FLOOR - 24}`} size={4} opacity={0.5} />
    <Shape d={rect(-100, FLOOR, 1280, 800)} fill={isNight(time) ? '#3A3550' : '#E6D6C2'} line={5} shadow={false} />
  </>
);

// Water to the horizon and a strip of sand.
export const Shore: React.FC<{time: TimeOfDay; f: number}> = ({time, f}) => (
  <>
    <Sky time={time} f={f} />
    <Shape d={rect(-100, HORIZON, 1280, FLOOR - 40 - HORIZON)} fill={WATER[time]} line={5} shadow={false} />
    {Array.from({length: 7}, (_, k) => {
      const y = HORIZON + 20 + k * 22;
      const x0 = ((f * (1.2 + k * 0.3) + k * 140) % 300) - 300;
      return <Line key={k} d={`M${x0},${y}C${x0 + 60},${y - 8} ${x0 + 120},${y + 8} ${x0 + 180},${y}M${x0 + 420},${y + 6}C${x0 + 480},${y - 2} ${x0 + 540},${y + 14} ${x0 + 600},${y + 6}M${x0 + 820},${y - 2}C${x0 + 880},${y - 10} ${x0 + 940},${y + 6} ${x0 + 1000},${y - 2}`} size={4} color={C.white} opacity={0.7} />;
    })}
    <Shape d={`M-100,${FLOOR - 40}C300,${FLOOR - 60} 700,${FLOOR - 20} 1180,${FLOOR - 44}L1180,2100L-100,2100Z`} fill={time === 'day' || time === 'dawn' ? C.release : '#4A4466'} line={5} shadow={false} />
  </>
);

// Rolling grass with a few flowers.
export const Field: React.FC<{time: TimeOfDay; f: number}> = ({time, f}) => {
  const r = rng(41);
  const pts: [number, number][] = [[-120, HORIZON + 40]];
  for (let x = -80; x <= 1200; x += 120) pts.push([x, HORIZON + 10 - r() * 50]);
  return (
    <>
      <Sky time={time} f={f} />
      <Shape d={`${smooth(pts, false, 0.6)}L1240,2100L-120,2100Z`} fill={isNight(time) ? '#2E3A3C' : C.mint} shade={`M-120,${FLOOR}L1240,${FLOOR}L1240,2100L-120,2100Z`} shadeInk="ht-teal-1" line={5} shadow={false} />
      {Array.from({length: 9}, (_, i) => {
        const x = 60 + i * 125 + r() * 40;
        const y = FLOOR + 60 + r() * 220;
        const c = [C.candy, C.hotpink, C.goldHi, C.white][i % 4];
        return (
          <g key={i} transform={`translate(${x},${y}) rotate(${Math.sin(f / 14 + i) * 4})`}>
            <Line d="M0,0L0,-56" size={5} color={C.teal} />
            {[0, 1, 2, 3, 4].map((k) => {
              const a = (k / 5) * Math.PI * 2;
              return <Shape key={k} d={ellipse(Math.cos(a) * 16, -70 + Math.sin(a) * 16, 13, 9)} fill={c} line={3} />;
            })}
            <Shape d={circle(0, -70, 8)} fill={C.gold} line={2.5} />
          </g>
        );
      })}
    </>
  );
};

export const Backdrop: React.FC<{bg: BgName; time: TimeOfDay; f: number; scroll?: number}> = ({bg, time, f, scroll}) => {
  switch (bg) {
    case 'sky':
      return (
        <>
          <Sky time={time} f={f} />
          <GroundPlane time={time} />
        </>
      );
    case 'road':
      return <Road time={time} f={f} scroll={scroll} />;
    case 'street':
      return <Street time={time} f={f} scroll={scroll} />;
    case 'room':
      return <Room time={time} f={f} />;
    case 'shore':
      return <Shore time={time} f={f} />;
    case 'field':
      return <Field time={time} f={f} />;
    default:
      return null;
  }
};
