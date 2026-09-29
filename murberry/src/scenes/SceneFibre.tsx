import React from 'react';
import {AbsoluteFill} from 'remotion';
import {paper} from '../brand/tokens';
import {DrawPath} from '../components/Draw';
import {Label} from '../components/Label';
import {Canvas, Sheet} from '../components/Paper';
import {Tear} from '../components/Tear';
import {clamp01, ease, lerp, prog, rand} from '../lib/anim';
import {SceneMachine} from './SceneMachine';

// Cross-bridge strokes: slow, repeated, one ATP spent per pull.
export const STROKE_T0 = 6.3;
export const STROKE_LEN = 1.5;
export const STROKES = 6;
const DELTA = 7; // px each pull slides the actin toward the middle

const phaseOf = (t: number) => {
  const i = Math.floor((t - STROKE_T0) / STROKE_LEN);
  if (i < 0 || i >= STROKES) return {i: -1, w: 0};
  return {i, w: (t - STROKE_T0 - i * STROKE_LEN) / STROKE_LEN};
};

/** Head angle offset in degrees: reach back, grip, power stroke, release. */
const headAngle = (w: number) => {
  if (w < 0.35) return lerp(0, -14, ease.inOutSine(w / 0.35));
  if (w < 0.45) return -14;
  if (w < 0.8) return lerp(-14, 18, ease.inOutSine((w - 0.45) / 0.35));
  return lerp(18, 0, ease.inOutSine((w - 0.8) / 0.2));
};

const slide = (t: number) => {
  let s = 0;
  for (let i = 0; i < STROKES; i++) {
    const a = STROKE_T0 + i * STROKE_LEN + 0.45 * STROKE_LEN;
    s += DELTA * prog(t, a, a + 0.35 * STROKE_LEN, ease.inOutSine);
  }
  // The muscle lets go again at the end of the beat.
  return s * (1 - prog(t, 15.6, 16.6, ease.inOutSine));
};

const ROWS = [884, 956, 1028, 1100];
const LEFT_X = [320, 352, 384, 416, 448, 480];
const RIGHT_X = [600, 632, 664, 696, 728, 760];

const Beads: React.FC<{x: number; y: number; w: number}> = ({x, y, w}) => (
  <rect x={x} y={y} width={w} height={18} fill="url(#s4a-beads)" />
);

const zig = (x: number) => {
  let d = `M ${x + 20} 822`;
  for (let i = 1; i <= 17; i++) d += ` L ${x + (i % 2 ? 0 : 20)} ${822 + i * 20}`;
  return d;
};

const Sarcomere: React.FC<{t: number}> = ({t}) => {
  const s = slide(t);
  const {w} = phaseOf(t);
  const heads = (side: 'L' | 'R') =>
    ROWS.flatMap((y, r) =>
      (side === 'L' ? LEFT_X : RIGHT_X).flatMap((x, k) => {
        const jitter = (rand(r * 13 + k * 7 + (side === 'L' ? 1 : 2)) - 0.5) * 0.08;
        const a = headAngle(clamp01(w + jitter));
        const sx = side === 'L' ? -1 : 1;
        // Upper heads rotate toward the middle on the pull, lower heads mirror.
        return [
          <path key={`${side}${r}${k}u`} d={`M ${x} ${y} l ${9 * sx} -11`} transform={`rotate(${-sx * a} ${x} ${y})`} />,
          <path key={`${side}${r}${k}d`} d={`M ${x} ${y + 14} l ${9 * sx} 11`} transform={`rotate(${sx * a} ${x} ${y + 14})`} />,
        ];
      }),
    );
  const pullGlow = w > 0.45 && w < 0.8 ? 1 : 0.55;
  return (
    <g>
      <g transform={`translate(${s} 0)`}>
        {ROWS.map((y) => (
          <Beads key={y} x={150} y={y - 38} w={320} />
        ))}
        <Beads x={150} y={1134} w={320} />
        <path d={zig(140)} fill="none" stroke="#2A2420" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g transform={`translate(${-s} 0)`}>
        {ROWS.map((y) => (
          <Beads key={y} x={610} y={y - 38} w={320} />
        ))}
        <Beads x={610} y={1134} w={320} />
        <path d={zig(920)} fill="none" stroke="#2A2420" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g fill="none" stroke="#2A2420" strokeWidth={4.5} strokeLinecap="round" opacity={0.85}>
        {heads('L')}
        {heads('R')}
      </g>
      <g fill={paper.ochre} stroke="#2A2420" strokeWidth={1.6}>
        {ROWS.map((y) => (
          <rect key={y} x="300" y={y} width="480" height="14" rx="7" />
        ))}
      </g>
      <path d="M 540 836 L 540 1170" fill="none" stroke="#2A2420" strokeWidth={1.4} strokeDasharray="6 6" opacity={0.6} />
      <g fill="none" stroke="#2A2420" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" opacity={pullGlow}>
        <path d="M 404 922 C 404 906 420 900 436 904" />
        <path d="M 426 896 L 438 904 L 426 912" />
        <path d="M 676 922 C 676 906 660 900 644 904" />
        <path d="M 654 896 L 642 904 L 654 912" />
      </g>
    </g>
  );
};

/** ATP: the third phosphate breaks off on every pull, and is made again. */
const Atp: React.FC<{t: number}> = ({t}) => {
  const {i, w} = phaseOf(t);
  const off = i >= 0 ? prog(w, 0.45, 0.8, ease.outCubic) : 0;
  const back = i >= 0 ? prog(w, 0.86, 1, ease.inOutSine) : 0;
  const detached = off * (1 - back);
  const burst = i >= 0 ? Math.sin(Math.PI * clamp01((w - 0.45) / 0.3)) : 0;
  const px = lerp(434, 470, off);
  const py = lerp(1446, 1414, off);
  return (
    <g stroke="#2A2420" strokeWidth={2} strokeLinejoin="round">
      <polygon points="182,1418 204,1405 226,1418 226,1444 204,1457 182,1444" fill={paper.sand} />
      <polygon points="226,1418 250,1410 262,1431 250,1452 226,1444" fill={paper.sand} />
      <polygon points="276,1440 300,1428 322,1440 316,1466 284,1466" fill={paper.sand} />
      <line x1="262" y1="1431" x2="278" y2="1440" />
      <line x1="322" y1="1446" x2="340" y2="1446" />
      <circle cx="354" cy="1446" r="14" fill={paper.sand} />
      <line x1="368" y1="1446" x2="380" y2="1446" />
      <circle cx="394" cy="1446" r="14" fill={paper.sand} />
      <line x1="408" y1="1446" x2="420" y2="1446" opacity={1 - detached} />
      <g opacity={1 - off * 0.85 + back * 0.85}>
        <circle cx={i >= 0 && back > 0 ? 434 : px} cy={i >= 0 && back > 0 ? 1446 : py} r="14" fill={paper.sand} />
        <text x={i >= 0 && back > 0 ? 434 : px} y={(i >= 0 && back > 0 ? 1446 : py) + 6} fontFamily="EB Garamond, serif" fontSize={16}
          fontWeight={500} fill="#2A2420" stroke="none" textAnchor="middle">P</text>
      </g>
      {off > 0 && back === 0 ? (
        <g opacity={1 - off * 0.85}>
          <circle cx={px} cy={py} r="14" fill={paper.sand} />
          <text x={px} y={py + 6} fontFamily="EB Garamond, serif" fontSize={16} fontWeight={500} fill="#2A2420" stroke="none" textAnchor="middle">P</text>
        </g>
      ) : null}
      <path fill="none" strokeWidth={1.8} strokeLinecap="round" opacity={burst}
        d="M 414 1440 L 422 1436 M 416 1452 L 426 1454 M 420 1428 L 426 1420" />
      <g fontFamily="EB Garamond, serif" fontSize={16} fontWeight={500} fill="#2A2420" stroke="none" textAnchor="middle">
        <text x="354" y="1452">P</text>
        <text x="394" y="1452">P</text>
      </g>
    </g>
  );
};

/** Everything beneath the torn clay: the fibre, the sarcomere, ATP. */
const FibreLayer: React.FC<{t: number}> = ({t}) => {
  const fibreIn = prog(t, 1.3, 2.3, ease.outCubic);
  const plate = prog(t, 3.4, 4.4, ease.inOutCubic);
  const box = {x: 520, y: 468, w: 80, h: 112};
  const pw = lerp(box.w, 952, plate);
  const sc = pw / 952;
  const cx = lerp(box.x + box.w / 2, 540, plate);
  const cy = lerp(box.y + box.h / 2, 1045, plate);
  const atp = prog(t, 9.3, 10.3);
  return (
    <Sheet color={paper.burnt}>
      <Canvas>
        <defs>
          <pattern id="s4a-beads" width="12" height="18" patternUnits="userSpaceOnUse">
            <circle cx="6" cy="6" r="5" fill={paper.sand} stroke="#2A2420" strokeWidth="1" />
            <circle cx="0" cy="12" r="5" fill={paper.sand} stroke="#2A2420" strokeWidth="1" />
            <circle cx="12" cy="12" r="5" fill={paper.sand} stroke="#2A2420" strokeWidth="1" />
          </pattern>
          <clipPath id="s4a-fibre">
            <path d="M 190 440 L 940 440 C 952 470 936 500 950 530 C 962 560 944 590 940 610 L 190 610 Z" />
          </clipPath>
        </defs>
        {fibreIn > 0 ? (
          <g transform={`translate(${(1 - fibreIn) * 1000} 0)`}>
            <g style={{filter: 'drop-shadow(0 6px 7px rgba(42,36,32,0.25))'}}>
              <path fill={paper.clay} d="M 190 440 L 940 440 C 952 470 936 500 950 530 C 962 560 944 590 940 610 L 190 610 Z" />
            </g>
            <g clipPath="url(#s4a-fibre)" fill="#2A2420" opacity={0.22}>
              {Array.from({length: 31}, (_, k) => (
                <rect key={k} x={214 + k * 24} y="430" width="10" height="190" />
              ))}
            </g>
            <g fill="none" stroke="#2A2420" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M 190 440 L 940 440 C 952 470 936 500 950 530 C 962 560 944 590 940 610 L 190 610" />
              <ellipse cx="190" cy="525" rx="42" ry="85" fill={paper.clayLight} />
              <g strokeWidth={1.2} fill={paper.clay}>
                {[
                  [176, 470], [196, 470], [166, 492], [186, 492], [206, 492], [160, 514], [180, 514], [200, 514], [220, 514],
                  [160, 536], [180, 536], [200, 536], [220, 536], [166, 558], [186, 558], [206, 558], [176, 580], [196, 580],
                ].map(([x, y], k) => (
                  <circle key={k} cx={x} cy={y} r="8" />
                ))}
              </g>
              <ellipse cx="420" cy="452" rx="24" ry="8" fill="#A9774F" strokeWidth={1.4} />
              <ellipse cx="760" cy="598" rx="24" ry="8" fill="#A9774F" strokeWidth={1.4} />
            </g>
          </g>
        ) : null}
        <g fill="none" stroke="#2A2420">
          <DrawPath d="M 520 468 L 600 468 L 600 580 L 520 580 Z" p={prog(t, 2.8, 3.3)} width={2} />
          <DrawPath id="s4a-fan1" d="M 520 580 L 70 764" p={prog(t, 3.2, 3.7)} width={1.6} dash="8 6" opacity={0.85} />
          <DrawPath id="s4a-fan2" d="M 600 580 L 1010 764" p={prog(t, 3.2, 3.7)} width={1.6} dash="8 6" opacity={0.85} />
        </g>
        <g opacity={prog(t, 2.3, 2.9)}>
          <rect x="690" y="358" width="250" height="50" rx="4" fill={paper.sand} style={{filter: 'drop-shadow(0 4px 5px rgba(42,36,32,0.25))'}} />
        </g>
        <Label id="s4a-fl" t={t} t0={2.5} dur={0.8} x={815} y={392} anchor="middle" lines={['one muscle fibre']} />
        {plate > 0 ? (
          <g opacity={prog(t, 3.4, 3.8)}
            transform={`translate(${cx} ${cy}) scale(${sc}) translate(-540 -1045)`}>
            <rect x="64" y="760" width="952" height="570" rx="2" fill={paper.clay} style={{filter: 'drop-shadow(0 8px 10px rgba(42,36,32,0.3))'}} />
            <Sarcomere t={t} />
            <g fill="none" stroke="#2A2420" strokeLinecap="round" strokeLinejoin="round" opacity={prog(t, 4.4, 5.0)}>
              <path strokeWidth={3} d="M 270 812 L 420 812 M 404 802 L 420 812 L 404 822 M 810 812 L 660 812 M 676 802 L 660 812 L 676 822" />
            </g>
            <g fill="none" stroke="#2A2420" strokeWidth={1.4} opacity={0.85}>
              <DrawPath d="M 196 1234 L 228 1154" p={prog(t, 4.6, 5.0)} width={1.4} />
              <DrawPath d="M 578 1234 L 560 1116" p={prog(t, 5.2, 5.6)} width={1.4} />
            </g>
            <Label id="s4a-pull" t={t} t0={4.6} dur={0.5} x={540} y={822} anchor="middle" lines={['pull']} />
            <Label id="s4a-actin" t={t} t0={4.8} dur={0.6} x={104} y={1266} lines={['actin']} />
            <Label id="s4a-myo" t={t} t0={5.4} dur={0.6} x={520} y={1266} lines={['myosin']} />
            <Label id="s4a-sar" t={t} t0={6.0} dur={0.8} x={984} y={1266} anchor="end" lines={['one sarcomere']} size={24} spacing={1.4} />
          </g>
        ) : null}
        {atp > 0 ? (
          <g opacity={atp}>
            <Atp t={t} />
            <rect x="520" y="1404" width="496" height="84" rx="4" fill={paper.sand} style={{filter: 'drop-shadow(0 4px 5px rgba(42,36,32,0.25))'}} />
          </g>
        ) : null}
        <Label id="s4a-atp" t={t} t0={9.6} dur={1.1} x={544} y={1438} lineGap={34} lines={['atp: one is spent', 'for every pull']} />
      </Canvas>
    </Sheet>
  );
};

/** Beat 4a, 1:05-1:22. The clay tears back to burnt orange: fibre, filaments, the pull, ATP. */
export const SceneFibre: React.FC<{t: number}> = ({t}) => (
  <AbsoluteFill>
    <Tear id="s4a-tear" progress={prog(t, 0, 1.4, ease.linear)} y0={356} y1={262} seed={5}
      under={<FibreLayer t={t} />}>
      <SceneMachine t={30} />
    </Tear>
    <Canvas>
      <Label id="s4a-title" t={t} t0={1.3} dur={0.8} x={1016} y={226} anchor="end" lines={['the chemistry']} size={44} spacing={3} />
    </Canvas>
  </AbsoluteFill>
);
