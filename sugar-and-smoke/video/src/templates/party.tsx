// Features added for No. 4 ("Troops"): the call, the clock, money, the troops, the sound system,
// a dinner table, a jeep, fireworks, a closed door and a clown nose flung away.
import React from 'react';
import {C, FONT} from '../brand/tokens';
import {clamp, ease} from '../lib/ease';
import {Flat, Line, Shape, Txt} from '../lib/print';
import {rng} from '../lib/random';
import {circle, ellipse, FloatHearts, heart, Phone, rect, star4} from '../props/common';
import {FLOOR, isNight} from './backdrops';
import type {FeatureProps} from './scene';

export const Ringing: React.FC<FeatureProps> = ({p}) => {
  const buzz = Math.sin(p.f * 2.2) * 3 * (Math.floor(p.f / 18) % 2 ? 1 : 0.2);
  const x = 790;
  const y = 600;
  return (
    <g transform={`translate(${x},${y}) rotate(${8 + buzz})`}>
      {[0, 1, 2].map((k) => {
        const r = 230 + k * 50 + 20 * p.beat;
        return <Line key={k} d={`M${-r * 0.6},${-r * 0.8}A${r},${r} 0 0 1 ${r * 0.6},${-r * 0.8}`} size={6} color={C.hotpink} opacity={0.7 - k * 0.2} />;
      })}
      <g transform="scale(0.62)">
        <Phone w={420} h={820} screen={C.blush}>
          <Shape d={circle(0, -190, 90)} fill={C.candy} line={5} />
          <Shape d={heart(0, -186, 46)} fill={C.hotpink} line={4} />
          <Txt x={0} y={-40} size={52} font={FONT.lyric} weight={800} color={C.ink}>
            pretty girl
          </Txt>
          <Txt x={0} y={20} size={34} font={FONT.tag} weight={700} color={C.ash}>
            calling...
          </Txt>
          <Shape d={circle(-90, 230, 48)} fill={C.pressure} line={4} />
          <Shape d={circle(90, 230, 48 + 6 * p.beat)} fill={C.teal} line={4} />
        </Phone>
      </g>
    </g>
  );
};

export const Clock: React.FC<FeatureProps> = ({p}) => {
  const x = 820;
  const y = 430;
  const m = ((p.f * 6) * Math.PI) / 180;
  const h = ((p.f * 0.5 + 120) * Math.PI) / 180;
  const ink = C.ink;
  return (
    <>
      <Shape d={circle(x, y, 120)} fill={C.white} shade={circle(x + 30, y + 24, 112)} shadeInk="ht-ink-1" line={7} />
      {Array.from({length: 12}, (_, k) => {
        const a = (k / 12) * Math.PI * 2;
        return <Line key={k} d={`M${x + Math.cos(a) * 96},${y + Math.sin(a) * 96}L${x + Math.cos(a) * (k % 3 ? 104 : 86)},${y + Math.sin(a) * (k % 3 ? 104 : 86)}`} size={k % 3 ? 4 : 7} color={ink} />;
      })}
      <Line d={`M${x},${y}L${x + Math.sin(m) * 84},${y - Math.cos(m) * 84}`} size={7} color={ink} />
      <Line d={`M${x},${y}L${x + Math.sin(h) * 54},${y - Math.cos(h) * 54}`} size={10} color={ink} />
      <Shape d={circle(x, y, 10)} fill={C.hotpink} line={3} />
    </>
  );
};

export const MoneyRain: React.FC<FeatureProps> = ({p}) => {
  const r = rng(47);
  return (
    <>
      {Array.from({length: 16}, (_, i) => {
        const x0 = 60 + r() * 960;
        const v = 5 + r() * 4;
        const ph = r() * 1400;
        const y = ((ph + p.f * v) % 1500) - 160;
        const x = x0 + Math.sin(p.f / 9 + i) * 40;
        const rot = Math.sin(p.f / 7 + i * 2) * 50;
        const flip = Math.cos(p.f / 6 + i);
        return (
          <g key={i} transform={`translate(${x},${y}) rotate(${rot}) scale(${flip},1)`}>
            <Shape d={rect(-48, -24, 96, 48, 5)} fill="#9CCB9A" line={3.5} />
            <Shape d={ellipse(0, 0, 13, 17)} fill="none" line={3} lineColor={C.teal} />
            <Line d="M-36,-14L-24,-14M24,14L36,14" size={3} color={C.teal} />
          </g>
        );
      })}
    </>
  );
};

// The troops: a row of friends in caps behind him, saluting, bobbing on the beat.
export const Troops: React.FC<FeatureProps> = ({p, time}) => {
  const xs = [70, 200, 330, 750, 880, 1010];
  const lit = isNight(time);
  const fill = lit ? '#4E5770' : C.slate;
  return (
    <>
      {xs.map((x, i) => {
        const s = 0.5 + (i % 2) * 0.04;
        const bob = 6 * p.beat * (i % 2 ? 1 : 0.6);
        const salute = p.f > 4 + i * 2;
        return (
          <g key={i} transform={`translate(${x},${FLOOR - 40 + bob}) scale(${s})`}>
            <Shape d={circle(0, -330, 44)} fill={fill} line={4} />
            <Shape d="M-50,-356C-52,-400 52,-400 50,-356Z" fill="#3E4A3C" line={4} />
            <Shape d="M-46,-360L60,-356L66,-346L-46,-350Z" fill={C.ink} line={3} />
            <Shape d={rect(-62, -284, 124, 220, 40)} fill={fill} line={4} />
            <Shape d={rect(-50, -70, 42, 90, 14)} fill={fill} line={4} />
            <Shape d={rect(8, -70, 42, 90, 14)} fill={fill} line={4} />
            <Line d={salute ? 'M54,-260L96,-310L40,-350' : 'M54,-260L70,-120'} size={24} color={fill} />
            <Line d="M-54,-260L-70,-120" size={24} color={fill} />
          </g>
        );
      })}
    </>
  );
};

export const Speakers: React.FC<FeatureProps> = ({p}) => (
  <>
    {[110, 970].map((x, i) => (
      <g key={i}>
        {[0, 1].map((k) => {
          const y = FLOOR - 230 - k * 230;
          const pump = 1 + 0.08 * p.beat;
          return (
            <g key={k}>
              <Shape d={rect(x - 110, y, 220, 220, 12)} fill={C.ink} shade={rect(x + 40, y, 70, 220)} shadeInk="ht-cotton-1" line={5} lineColor={C.ash} />
              <Shape d={circle(x, y + 118, 72 * pump)} fill="#3A3150" line={5} lineColor={C.gold} />
              <Shape d={circle(x, y + 118, 26 * pump)} fill={C.gold} line={3} />
              <Shape d={circle(x, y + 30, 16)} fill="#3A3150" line={3} lineColor={C.gold} />
            </g>
          );
        })}
      </g>
    ))}
  </>
);

// A dinner table in front of whoever sits at it.
export const Table: React.FC<FeatureProps> = ({p}) => {
  const top = FLOOR - 250;
  const flick = 1 + 0.15 * Math.sin(p.f / 2.3);
  return (
    <>
      <Flat d={circle(600, top - 110, 180)} fill="url(#glow-amber)" opacity={0.7} />
      <Shape d={`M330,${top}L870,${top}L900,${FLOOR + 40}L300,${FLOOR + 40}Z`} fill={C.white} shade={`M640,${top}L870,${top}L900,${FLOOR + 40}L640,${FLOOR + 40}Z`} shadeInk="ht-ink-1" line={6} />
      <Line d={`M300,${FLOOR - 10}Q450,${FLOOR + 20} 600,${FLOOR - 10}Q750,${FLOOR + 20} 900,${FLOOR - 10}`} size={8} color={C.candy} />
      <Shape d={ellipse(470, top - 6, 70, 18)} fill={C.white} line={4} />
      <Shape d={`M430,${top - 10}C436,${top - 44} 504,${top - 44} 510,${top - 10}Z`} fill={C.amber} line={3.5} />
      <Shape d={ellipse(730, top - 6, 70, 18)} fill={C.white} line={4} />
      <Shape d={`M690,${top - 10}C696,${top - 44} 764,${top - 44} 770,${top - 10}Z`} fill={C.amber} line={3.5} />
      <Shape d={rect(588, top - 110, 24, 104, 6)} fill={C.cotton} line={4} />
      <Shape d={`M600,${top - 112 - 40 * flick}C${590},${top - 130} ${588},${top - 116} 600,${top - 110}C${612},${top - 116} ${610},${top - 130} 600,${top - 112 - 40 * flick}Z`} fill={C.amber} line={3} />
    </>
  );
};

// A jeep in profile driving right; whoever sits in it shows above the doors.
export const Jeep: React.FC<FeatureProps> = ({p}) => {
  const bounce = Math.sin(p.f / 3) * 3;
  const spin = p.f * 14;
  const wheel = (x: number) => (
    <g transform={`translate(${x},${FLOOR - 20}) rotate(${spin})`}>
      <Shape d={circle(0, 0, 86)} fill={C.ink} line={5} lineColor={C.ash} />
      <Shape d={circle(0, 0, 40)} fill={C.smoke} line={4} />
      <Line d="M-30,0L30,0M0,-30L0,30" size={5} color={C.ash} />
    </g>
  );
  return (
    <>
      <g transform={`translate(0,${bounce})`}>
        <Shape d={`M120,${FLOOR - 250}L930,${FLOOR - 250}L980,${FLOOR - 160}L990,${FLOOR - 60}L100,${FLOOR - 60}L90,${FLOOR - 200}Z`} fill="#4E6B4A" shade={`M120,${FLOOR - 150}L990,${FLOOR - 150}L990,${FLOOR - 60}L100,${FLOOR - 60}Z`} shadeInk="ht-ink-2" line={7} />
        <Line d={`M700,${FLOOR - 250}L760,${FLOOR - 470}L790,${FLOOR - 470}`} size={9} color={C.ink} />
        <Line d={`M140,${FLOOR - 250}L150,${FLOOR - 420}L210,${FLOOR - 420}`} size={9} color={C.ink} />
        <Shape d={rect(940, FLOOR - 220, 50, 40, 8)} fill={C.goldHi} line={4} />
        <Line d={`M480,${FLOOR - 230}L480,${FLOOR - 80}`} size={4} opacity={0.5} />
        <Shape d={rect(560, FLOOR - 190, 60, 14, 6)} fill={C.ash} line={3} />
        <Shape d={rect(250, FLOOR - 190, 60, 14, 6)} fill={C.ash} line={3} />
      </g>
      {wheel(270)}
      {wheel(820)}
      {[0, 1, 2].map((k) => (
        <Line key={k} d={`M${40 - k * 10},${FLOOR - 140 + k * 40}L${-60 - k * 30},${FLOOR - 140 + k * 40}`} size={5} opacity={0.6} />
      ))}
    </>
  );
};

export const Fireworks: React.FC<FeatureProps> = ({p}) => {
  const colors = [C.goldHi, C.hotpink, C.aqua, C.candy, C.amber];
  return (
    <>
      {Array.from({length: 5}, (_, i) => {
        const t0 = 2 + i * 13;
        if (p.f < t0) return null;
        const cycle = Math.floor((p.f - t0) / 60);
        const age = (p.f - t0) % 60;
        const r = rng(91 + i * 7 + cycle * 31);
        const x = 140 + r() * 800;
        const y = 180 + r() * 420;
        const c = colors[(i + cycle) % colors.length];
        const k = ease.outCubic(clamp(age / 22));
        const fade = 1 - clamp((age - 16) / 24);
        if (fade <= 0) return null;
        return (
          <g key={i} opacity={fade}>
            <Flat d={circle(x, y, 170 * k)} fill="url(#glow-gold)" opacity={0.35} />
            {Array.from({length: 14}, (_, j) => {
              const a = (j / 14) * Math.PI * 2;
              const r0 = 30 + 120 * k;
              const r1 = 60 + 170 * k;
              return <Line key={j} d={`M${x + Math.cos(a) * r0},${y + Math.sin(a) * r0 + age * 0.6}L${x + Math.cos(a) * r1},${y + Math.sin(a) * r1 + age * 1.1}`} size={6} color={c} />;
            })}
            <Flat d={star4(x, y, 26 * (1 - k) + 8)} fill={C.white} />
          </g>
        );
      })}
    </>
  );
};

// A closed door, a heart on the handle, light and hearts slipping out underneath.
export const Door: React.FC<FeatureProps> = ({p}) => {
  const x = 540;
  const swing = Math.sin(p.f / 10) * 6;
  return (
    <>
      <Shape d={rect(x - 250, FLOOR - 860, 500, 880, 8)} fill={C.hotpink} line={7} />
      <Shape d={rect(x - 210, FLOOR - 820, 420, 830, 6)} fill={C.teal} shade={rect(x + 60, FLOOR - 820, 150, 830)} shadeInk="ht-ink-2" line={6} />
      <Shape d={rect(x - 160, FLOOR - 770, 320, 280, 10)} fill="none" line={4} />
      <Shape d={rect(x - 160, FLOOR - 440, 320, 360, 10)} fill="none" line={4} />
      <Shape d={circle(x + 150, FLOOR - 420, 20)} fill={C.gold} line={4} />
      <Flat d={rect(x - 210, FLOOR + 2, 420, 14)} fill={C.goldHi} opacity={0.9} />
      <Flat d={ellipse(x, FLOOR + 30, 300, 40)} fill="url(#glow-amber)" opacity={0.8} />
      <g transform={`translate(${x + 150},${FLOOR - 400}) rotate(${swing})`}>
        <Line d="M0,0L-40,80M0,0L40,80" size={4} />
        <Shape d={rect(-90, 80, 180, 120, 12)} fill={C.white} line={5} />
        <Shape d={heart(0, 120, 26)} fill={C.hotpink} line={3.5} />
        <Txt x={0} y={182} size={22} font={FONT.tag} weight={700} color={C.ink}>
          DO NOT DISTURB
        </Txt>
      </g>
      <FloatHearts f={p.f} x={x} y={FLOOR - 20} n={7} seed={17} spread={360} color={C.hotpink} />
    </>
  );
};

// A clown nose and wig, flung off into the sky.
export const ClownNose: React.FC<FeatureProps> = ({p, s}) => {
  const t = clamp((p.f - 6) / 26);
  const x = s.head[0] + 60 + 520 * t;
  const y = s.head[1] - 40 - 620 * t + 520 * t * t;
  return (
    <g transform={`translate(${x},${y}) rotate(${t * 540}) scale(${1 - 0.4 * t})`}>
      {[[-46, -10, C.candy], [0, -40, C.aqua], [46, -10, C.goldHi]].map(([dx, dy, c], i) => (
        <Shape key={i} d={circle(dx as number, dy as number, 40)} fill={c as string} line={4} />
      ))}
      <Shape d={circle(0, 50, 34)} fill={C.pressure} line={5} />
      <Flat d={circle(-10, 40, 9)} fill={C.white} opacity={0.8} />
    </g>
  );
};
