import React from 'react';
import {paper} from '../brand/tokens';
import {DrawPath} from '../components/Draw';
import {Label} from '../components/Label';
import {Canvas, Sheet} from '../components/Paper';
import {clamp01, ease, fade, lerp, prog} from '../lib/anim';
import {Pt, alongPolyline, pt} from '../lib/geom';

const Hex: React.FC<{x: number; y: number; o?: number; s?: number}> = ({x, y, o = 1, s = 1}) => (
  <polygon
    points={[
      [0, -7],
      [12, -14],
      [24, -7],
      [24, 7],
      [12, 14],
      [0, 7],
    ]
      .map(([a, b]) => `${x - 12 * s + a * s},${y + b * s}`)
      .join(' ')}
    fill={paper.sand}
    stroke="#2A2420"
    strokeWidth={1.8}
    strokeLinejoin="round"
    opacity={o}
  />
);

const SITES = [260, 540, 820];
const VESICLES = [pt(300, 1100), pt(600, 1150), pt(900, 1080)];
export const CARRIER_AT = [3.9, 4.25, 4.6]; // vesicles start rising (scene s)
const RISE = 1.5;

const glucosePath = (x: number, k: number): Pt[] => [
  pt(x + 14, 452),
  pt(x + 4, 560),
  pt(x, 700),
  pt(x, 830),
  pt(x, 872),
  pt(x, 930),
  pt(x + (k % 2 ? 36 : -30), 1040),
  pt(x + (k % 2 ? 60 : -52), 1190),
];

// Red cells drifting along the capillary.
const CELLS = [
  {x: 180, y: 320, r: 0},
  {x: 350, y: 410, r: -14},
  {x: 540, y: 310, r: 10},
  {x: 720, y: 420, r: 0},
  {x: 900, y: 320, r: -8},
  {x: 1080, y: 400, r: 6},
];
const BLOOD_SUGAR = [
  {x: 272, y: 443},
  {x: 440, y: 307},
  {x: 622, y: 437},
  {x: 802, y: 307},
  {x: 978, y: 427},
  {x: 1150, y: 360},
];

/** Beat 4b, 1:22-1:35. At the edge of a muscle cell: carriers rise, sugar passes in without insulin. */
export const SceneGlucose: React.FC<{t: number}> = ({t}) => {
  const flow = t * 22;
  const wrap = (x: number) => ((((x - 40) % 1100) + 1100) % 1100) + 40;
  const passing = SITES.flatMap((x, k) =>
    [0, 1, 2].map((m) => ({x, k, m, t0: CARRIER_AT[k] + RISE + 0.5 + m * 2.4 + k * 0.35})),
  );
  const leaving = (i: number) => {
    // Sugar in the blood thins out as it passes into the cell.
    const first = passing.filter((q) => q.m === 0)[i % 3];
    return i < 3 && first ? 1 - prog(t, first.t0 + 2.6, first.t0 + 3.2) : 1;
  };

  return (
    <Sheet color={paper.burnt}>
      <Canvas>
        <defs>
          <pattern id="s4b-bilayer" width="14" height="44" patternUnits="userSpaceOnUse" patternTransform="translate(0 850)">
            <circle cx="7" cy="6" r="5" fill={paper.sand} stroke="#2A2420" strokeWidth="1" />
            <circle cx="7" cy="38" r="5" fill={paper.sand} stroke="#2A2420" strokeWidth="1" />
            <path d="M 5 11 L 5 20 M 9 11 L 9 20 M 5 24 L 5 33 M 9 24 L 9 33" stroke="#2A2420" strokeWidth="1" />
          </pattern>
          <pattern id="s4b-fibril" width="24" height="16" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="12" height="16" fill="#2A2420" opacity=".12" />
          </pattern>
          <clipPath id="s4b-vessel">
            <rect x="64" y="236" width="952" height="238" />
          </clipPath>
        </defs>
        <rect x="64" y="120" width="952" height="1270" rx="2" fill={paper.clay} style={{filter: 'drop-shadow(0 8px 10px rgba(42,36,32,0.3))'}} />
        <rect x="64" y="240" width="952" height="230" fill={paper.clayLight} />
        <g clipPath="url(#s4b-vessel)">
          <g stroke="#2A2420" strokeWidth={1.8}>
            {CELLS.map((c, i) => {
              const x = wrap(c.x + flow);
              return (
                <g key={i} transform={`rotate(${c.r} ${x} ${c.y})`}>
                  <ellipse cx={x} cy={c.y} rx="42" ry="22" fill="#C15545" />
                  <ellipse cx={x} cy={c.y} rx="18" ry="8" fill="#D77B6C" stroke="none" />
                </g>
              );
            })}
          </g>
          {BLOOD_SUGAR.map((g, i) => (
            <Hex key={i} x={wrap(g.x + flow * 1.15)} y={g.y} o={leaving(i)} />
          ))}
        </g>
        <g fill="none" stroke="#2A2420" strokeWidth={2.4} strokeLinecap="round">
          <path d="M 64 240 C 200 232 340 248 480 240 C 620 232 760 248 1016 240" />
          <path d="M 64 470 C 200 478 340 462 480 470 C 620 478 760 462 1016 470" />
        </g>
        <rect x="64" y="850" width="952" height="44" fill="url(#s4b-bilayer)" />
        {SITES.map((x, k) => {
          const arrive = CARRIER_AT[k] + RISE;
          const c = prog(t, arrive - 0.15, arrive + 0.35, ease.outCubic);
          if (c <= 0) return null;
          return (
            <g key={x} opacity={c} transform={`translate(0 ${(1 - c) * 26})`}>
              <rect x={x - 28} y="836" width="20" height="72" rx="8" fill={paper.ochre} stroke="#2A2420" strokeWidth={1.8} />
              <rect x={x + 8} y="836" width="20" height="72" rx="8" fill={paper.ochre} stroke="#2A2420" strokeWidth={1.8} />
              <rect x={x - 8} y="840" width="16" height="64" fill={paper.clay} />
            </g>
          );
        })}
        {VESICLES.map((v, k) => {
          const p = prog(t, CARRIER_AT[k], CARRIER_AT[k] + RISE, ease.inOutSine);
          const x = lerp(v.x, SITES[k], p);
          const y = lerp(v.y, 944, p);
          const o = fade(t, 0.8, 1.4, CARRIER_AT[k] + RISE - 0.2, CARRIER_AT[k] + RISE + 0.25);
          const arrow = prog(t, CARRIER_AT[k] - 0.6, CARRIER_AT[k] - 0.1) * (1 - prog(t, CARRIER_AT[k] + 0.3, CARRIER_AT[k] + 0.8));
          return (
            <g key={k}>
              <g opacity={o} stroke="#2A2420" strokeWidth={1.8}>
                <circle cx={x} cy={y} r="36" fill={paper.clayLight} />
                <circle cx={x} cy={y} r="28" fill="none" strokeWidth={1} />
                <rect x={x - 14} y={y - 46} width="12" height="26" rx="5" fill={paper.ochre} />
                <rect x={x + 2} y={y - 46} width="12" height="26" rx="5" fill={paper.ochre} />
              </g>
              <g opacity={arrow} fill="none" stroke="#2A2420" strokeWidth={2} strokeLinecap="round">
                <path d={`M ${v.x} ${v.y - 48} L ${v.x} ${v.y - 130} M ${v.x - 10} ${v.y - 118} L ${v.x} ${v.y - 132} L ${v.x + 10} ${v.y - 118}`} />
              </g>
            </g>
          );
        })}
        {passing.map((q, i) => {
          const f = clamp01((t - q.t0) / 2.6);
          if (t < q.t0 || f >= 1) return null;
          const p = alongPolyline(glucosePath(q.x, q.k + q.m), ease.inOutSine(f));
          const o = Math.min(1, f * 8) * (1 - prog(f, 0.85, 1));
          return <Hex key={i} x={p.x} y={p.y} o={o} />;
        })}
        <rect x="64" y="1230" width="952" height="130" fill="url(#s4b-fibril)" />
        <g fill="none" stroke="#2A2420" strokeWidth={1.2} opacity={0.5}>
          <path d="M 64 1230 L 1016 1230 M 64 1262 L 1016 1262 M 64 1294 L 1016 1294 M 64 1326 L 1016 1326 M 64 1358 L 1016 1358" />
        </g>
        <DrawPath d="M 640 580 L 556 640" p={prog(t, 2.0, 2.4)} width={1.4} opacity={0.85} />
        <DrawPath d="M 700 776 L 800 840" p={prog(t, 5.8, 6.2)} width={1.4} opacity={0.85} />
        <DrawPath d="M 300 1188 L 300 1140" p={prog(t, 6.5, 6.8)} width={1.4} opacity={0.85 * (1 - prog(t, 7.2, 7.8))} />
        <Label id="s4b-title" t={t} t0={0.6} dur={0.8} x={984} y={190} anchor="end" lines={['into the cell']} size={44} spacing={3} />
        <Label id="s4b-blood" t={t} t0={1.2} dur={0.5} x={96} y={276} lines={['blood']} />
        <Label id="s4b-glu" t={t} t0={2.2} dur={0.6} x={646} y={584} lines={['glucose']} />
        <Label id="s4b-cell" t={t} t0={2.8} dur={0.7} x={96} y={946} lines={['muscle cell']} />
        <Label id="s4b-glut" t={t} t0={6.0} dur={0.8} x={470} y={770} lines={['glut4 carrier']} />
        <Label id="s4b-note" t={t} t0={6.6} dur={1.4} x={96} y={1210} size={24} spacing={1.4}
          lines={['working muscle sends more carriers to the surface']} />
      </Canvas>
    </Sheet>
  );
};
