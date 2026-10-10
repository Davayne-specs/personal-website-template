// The template kit. A scene is a recipe (backdrop, time of day, who is in it, what they do and
// hold, a few features, a note or a big word) instead of hand-written code; an episode's
// storyboard.json carries one recipe per line and this file turns them into scenes.
import React from 'react';
import {C, FONT, isDark} from '../brand/tokens';
import {clamp, ease, lerp, prog} from '../lib/ease';
import {Camera} from '../lib/frame';
import {Flat, Line, Shape, Txt} from '../lib/print';
import {rng} from '../lib/random';
import {SceneDef, SceneProps} from '../lib/scene';
import {useTimeline} from '../lib/timeline';
import {Bubble, circle, Clip, Confetti, ellipse, FloatHearts, heart, Note, Pop, rect, smooth, SmokePuff, Sparkle, Stars, Wash} from '../props/common';
import {ContactShadows, placeSubjects, Recipe, Subject, Subjects} from './actors';
import {ClownNose, Clock, Door, Fireworks, Jeep, MoneyRain, Ringing, Speakers, Table, Troops} from './party';
import {Backdrop, BgName, FLOOR, groundFor, HORIZON, isNight, TimeOfDay} from './backdrops';

export type Meta = {artist: string; title: string; number: number};
export type {Recipe} from './actors';

// ---------------------------------------------------------------- features (world coordinates)
export type FeatureProps = {r: Recipe; p: SceneProps; s: Subject; time: TimeOfDay};
type Feature = {layer: 'back' | 'front'; draw: React.FC<FeatureProps>};

const Sun: React.FC<FeatureProps> = ({r, p}) => {
  const [a, b] = Array.isArray(r.sun) ? r.sun : [r.sun ?? 0.3, r.sun ?? 0.3];
  const t = lerp(a, b, prog(p.f, 0, p.dur, ease.inOutSine));
  const y = HORIZON + 70 - t * 820;
  return (
    <Clip d={rect(-100, -100, 1280, HORIZON + 100)}>
      <Flat d={circle(540, y, 420)} fill="url(#glow-amber)" opacity={0.8} />
      {Array.from({length: 8}, (_, k) => {
        const ang = ((k * 45 + p.f * 0.4) * Math.PI) / 180;
        return <Line key={k} d={`M${540 + Math.cos(ang) * 165},${y + Math.sin(ang) * 165}L${540 + Math.cos(ang) * 230},${y + Math.sin(ang) * 230}`} size={6} color={C.goldHi} opacity={0.8} />;
      })}
      <Shape d={circle(540, y, 130)} fill={C.goldHi} shade={circle(565, y + 22, 120)} shadeInk="ht-gold-1" line={6} shadow={false} />
    </Clip>
  );
};

const Calendar: React.FC<FeatureProps> = ({r, p}) => {
  const [cx, cy, cs] = r.calendarAt ?? [540, 760, 1];
  const flip = Math.floor(p.f / 24);
  const inPage = p.f % 24;
  const day = r.calendarDay ?? 23;
  return (
    <g transform={`translate(${cx},${cy}) scale(${cs})`}>
      <Line d="M0,-480L0,-400" size={5} />
      <Shape d={circle(0, -480, 12)} fill={C.gold} line={4} />
      <Shape d={rect(-320, -400, 640, 780, 10)} fill={C.white} line={7} />
      <Shape d={rect(-320, -400, 640, 140, 10)} fill={C.hotpink} line={7} />
      <Txt x={0} y={-308} size={66} font={FONT.lyric} weight={800} color={C.white}>
        {['ONE DAY', 'SOON', 'ONE DAY', 'SOMEDAY'][flip % 4]}
      </Txt>
      {Array.from({length: 35}, (_, i) => {
        const x = -300 + (i % 7) * 88;
        const y = -232 + Math.floor(i / 7) * 118;
        return (
          <g key={i}>
            <Shape d={rect(x, y, 80, 106, 4)} fill={C.cotton} line={3} shadow={false} />
            {i + 1 === day && (
              <>
                <Shape d={circle(x + 40, y + 53, 46)} fill="none" line={7} lineColor={C.hotpink} />
                <Shape d={heart(x + 40, y + 56, 20)} fill={C.hotpink} line={3} />
              </>
            )}
          </g>
        );
      })}
      {inPage > 17 && <Shape d={`M-320,${-260 + (inPage - 17) * 70}L320,${-260 + (inPage - 17) * 50}L320,-260L-320,-260Z`} fill={C.white} line={5} />}
    </g>
  );
};

const ShoeClose: React.FC<FeatureProps> = ({p}) => {
  const gap = 10 + 9 * Math.sin(p.f / 4);
  return (
    <g transform="translate(540,960) scale(2.2)">
      <g transform={`rotate(${-gap} 150 0)`}>
        <Shape d="M-130,0L150,0L148,22C40,34 -60,34 -130,22Z" fill={C.candy} line={5} />
      </g>
      <Shape d="M-120,0C-124,-70 -60,-112 -10,-102C30,-94 60,-62 110,-52C140,-46 150,-20 150,0Z" fill={C.white} shade="M40,-120L160,-120L160,10L40,10Z" shadeInk="ht-ink-1" line={6} />
      <Line d="M-26,-74L-6,-44M-48,-62L-28,-32M-70,-48L-50,-20" size={4} color={C.hotpink} />
      <Line d="M-96,-16C-60,-30 -20,-30 20,-20" size={3.5} opacity={0.5} />
    </g>
  );
};

const Chairs: React.FC<FeatureProps> = ({s}) => (
  <>
    {[130, 310, 490, 670, s.x].map((x, i) => {
      const seat = i === 4 ? s.y + 74 * s.scale : FLOOR - 156;
      return (
        <g key={i}>
          <Shape d={rect(x - 64, seat - 150, 128, 150, 14)} fill="#3A4252" line={5} />
          <Line d={`M${x - 30},${seat - 120}L${x - 30},${seat - 20}M${x},${seat - 120}L${x},${seat - 20}M${x + 30},${seat - 120}L${x + 30},${seat - 20}`} size={3.5} color={C.cotton} opacity={0.4} />
          <Shape d={rect(x - 70, seat, 140, 18, 6)} fill="#505B6D" line={5} />
          <Line d={`M${x - 58},${seat + 18}L${x - 62},${FLOOR}M${x + 58},${seat + 18}L${x + 62},${FLOOR}`} size={6} color="#2C3442" />
        </g>
      );
    })}
  </>
);

const Spotlight: React.FC<FeatureProps> = ({s, time}) => (
  <>
    <Flat d={`M${s.x - 60},-100L${s.x + 60},-100L${s.x + 330},${FLOOR + 30}L${s.x - 330},${FLOOR + 30}Z`} fill={C.goldHi} opacity={isNight(time) ? 0.3 : 0.4} />
    <Flat d={ellipse(s.x, FLOOR + 10, 330, 60)} fill={C.goldHi} opacity={0.5} />
    <Flat d={circle(s.head[0], s.head[1], 300)} fill="url(#glow-gold)" opacity={0.5} />
  </>
);

const SoftLight: React.FC<FeatureProps> = ({s}) => (
  <>
    <Flat d={`M${s.x - 140},-100L${s.x + 140},-100L${s.x + 440},${FLOOR + 30}L${s.x - 440},${FLOOR + 30}Z`} fill={C.goldHi} opacity={0.22} />
    <Flat d={circle(s.head[0], s.head[1] - 60, 360)} fill="url(#glow-gold)" opacity={0.6} />
  </>
);

const Rain: React.FC<FeatureProps> = ({p}) => (
  <>
    {Array.from({length: 70}, (_, i) => {
      const x = 20 + ((i * 97) % 1040);
      const y = ((p.f * 16 + i * 53) % 1500) + 60;
      return <Line key={i} d={`M${x},${y}L${x - 6},${y + 44}`} size={4} color={C.iceInk} opacity={0.55} />;
    })}
  </>
);

const Thread: React.FC<FeatureProps> = ({s, p}) => {
  if (!s.kid) return null;
  const a = s.handR;
  const b = s.kid.hand;
  const mid: [number, number] = [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + 120 + Math.sin(p.f / 9) * 10];
  const d = `M${a[0]},${a[1]}Q${mid[0]},${mid[1]} ${b[0]},${b[1]}`;
  const at = (t: number): [number, number] => [lerp(lerp(a[0], mid[0], t), lerp(mid[0], b[0], t), t), lerp(lerp(a[1], mid[1], t), lerp(mid[1], b[1], t), t)];
  return (
    <>
      <Line d={d} size={5} color={C.hotpink} />
      {[0.25, 0.5, 0.75].map((t, i) => {
        const [x, y] = at(t);
        return <Shape key={i} d={heart(x, y + 6, 18 + 4 * Math.sin(p.f / 5 + i))} fill={C.hotpink} line={3} />;
      })}
    </>
  );
};

const Sign: React.FC<FeatureProps> = ({r}) => (
  <g transform={`translate(860,${FLOOR})`}>
    <Shape d={rect(-12, -520, 24, 520)} fill={C.goldLo} line={5} />
    <Shape d="M-150,-540L90,-540L150,-470L90,-400L-150,-400Z" fill={C.white} line={6} />
    <Txt x={-36} y={-452} size={54} font={FONT.lyric} weight={800} color={C.ink}>
      {r.sign ?? 'HOME'}
    </Txt>
  </g>
);

const MapRoute: React.FC<FeatureProps> = ({p}) => {
  const r = rng(35);
  const land = smooth(Array.from({length: 12}, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const rr = 250 + r() * 90;
    return [Math.cos(a) * rr * 1.1, Math.sin(a) * rr * 0.9] as [number, number];
  }), true, 0.5);
  const route: [number, number][] = [[-230, 180], [-180, 60], [-60, 20], [40, -60], [150, -120], [220, -190]];
  const t = clamp(p.f / (p.dur - 8));
  const n = Math.max(1, Math.round(t * (route.length - 1)));
  return (
    <g transform="translate(540,840) rotate(-3)">
      <Shape d={rect(-360, -320, 720, 640, 8)} fill={C.white} line={6} />
      <Line d="M-120,-320L-120,320M120,-320L120,320" size={3} opacity={0.3} />
      <Shape d={land} fill={C.release} line={5} shadow={false} />
      <Shape d={smooth(route.slice(0, n + 1), false)} fill="none" dotted line={9} lineColor={C.hotpink} />
      <Shape d={heart(route[0][0], route[0][1], 30)} fill={C.hotpink} line={4} />
      <Shape d={heart(route[5][0], route[5][1] - 10, 30 + (t >= 1 ? 8 * Math.sin(p.f / 4) : 0))} fill={C.aqua} line={4} />
      <Txt x={route[0][0]} y={route[0][1] + 66} size={34} font={FONT.hand} color={C.ink}>
        me
      </Txt>
      <Txt x={route[5][0]} y={route[5][1] - 54} size={34} font={FONT.hand} color={C.ink}>
        you
      </Txt>
    </g>
  );
};

const Split: React.FC<FeatureProps> = ({p}) => (
  <>
    <Flat d={rect(-100, -100, 640, 2100)} fill={C.night} opacity={0.78} />
    <Clip d={rect(-100, -100, 640, 1200)}>
      <Stars f={p.f} n={14} seed={38} y0={100} y1={900} />
    </Clip>
    <Txt x={270} y={520} size={70} font={FONT.hand} weight={700} rotate={-6} color={C.cotton}>
      wrong
    </Txt>
    <Txt x={810} y={520} size={70} font={FONT.hand} weight={700} rotate={6} color={C.ink}>
      right
    </Txt>
  </>
);

const BedBack: React.FC<FeatureProps> = ({s}) => (
  <>
    <Shape d={rect(s.x - 280, s.y - 420, 560, 320, 36)} fill={C.teal} shade={rect(s.x + 120, s.y - 420, 160, 320)} shadeInk="ht-ink-2" line={7} />
    <Shape d={`M${s.x - 250},${s.y - 40}C${s.x - 200},${s.y - 110} ${s.x - 60},${s.y - 110} ${s.x - 10},${s.y - 40}Z`} fill={C.white} line={5} />
  </>
);
const BedFront: React.FC<FeatureProps> = ({s}) => (
  <>
    <Shape d={rect(s.x - 320, s.y + 40, 640, 110, 24)} fill={C.white} line={6} />
    <Shape d={`M${s.x - 300},${s.y + 70}C${s.x - 120},${s.y + 20} ${s.x + 120},${s.y + 20} ${s.x + 300},${s.y + 70}L${s.x + 300},${FLOOR + 40}L${s.x - 300},${FLOOR + 40}Z`} fill={C.candy} shade={rect(s.x - 300, s.y + 150, 600, 300)} shadeInk="ht-pink-2" line={7} />
    {[0, 1, 2].map((k) => (
      <Line key={k} d={`M${s.x - 150 + k * 150},${s.y + 60}L${s.x - 150 + k * 150},${FLOOR + 40}`} size={3.5} opacity={0.4} />
    ))}
  </>
);

const Lamp: React.FC<FeatureProps> = ({r, p, s}) => {
  const at = r.lampAt === undefined ? -1 : p.w(r.lampAt);
  const on = p.f >= at;
  const x = s.x + 350;
  const k = at < 0 ? 1 : ease.outBack(clamp((p.f - at) / 6));
  return (
    <>
      <Shape d={rect(x - 70, FLOOR - 200, 140, 200, 10)} fill={C.goldLo} shade={rect(x + 20, FLOOR - 200, 50, 200)} shadeInk="ht-ink-2" line={5} />
      {on && <Flat d={circle(x, FLOOR - 320, 300 * k)} fill="url(#glow-amber)" opacity={0.95} />}
      <Line d={`M${x},${FLOOR - 200}L${x},${FLOOR - 300}`} size={7} color={C.goldLo} />
      <Shape d={`M${x - 50},${FLOOR - 300}L${x + 50},${FLOOR - 300}L${x + 80},${FLOOR - 400}L${x - 80},${FLOOR - 400}Z`} fill={on ? C.amber : '#5A5E6D'} line={5} />
      {on && at >= 0 && p.f < at + 12 && <Sparkle x={x + 90} y={FLOOR - 420} r={46 * (1 - (p.f - at) / 12)} />}
    </>
  );
};

const Smoke: React.FC<FeatureProps> = ({p, s}) => (
  <>
    {[0, 1, 2].map((k) => (
      <SmokePuff key={k} x={s.x - 340 - k * 120 + Math.sin(p.f / 13 + k) * 20} y={FLOOR - 200 - k * 160 - ((p.f * 1.5) % 160)} s={420 + k * 60} o={0.75 - k * 0.15} v={((k % 4) + 1) as 1 | 2 | 3 | 4} />
    ))}
  </>
);

const BubbleQ: React.FC<FeatureProps> = ({p, s}) => {
  const x = s.head[0] + 240;
  const y = s.head[1] - 260;
  return (
    <Pop f={p.f} at={6} x={x} y={y}>
      <Bubble x={x} y={y} w={300} h={240} tail={[-80, 150]} />
      <Txt x={x} y={y + 46} size={140} font={FONT.lyric} weight={800} color={C.hotpink}>
        ?
      </Txt>
    </Pop>
  );
};

const HumNotes: React.FC<FeatureProps> = ({p, s}) => {
  const r = rng(9);
  return (
    <>
      {Array.from({length: 6}, (_, i) => {
        const t0 = i * 9 + r() * 5;
        const t = (p.f - t0) % 54;
        if (p.f < t0 || t < 0) return null;
        const x = s.head[0] + 90 + (r() - 0.5) * 120 + Math.sin(t / 6 + i) * 16;
        const y = s.head[1] - 80 - t * 5;
        const c = [C.candy, C.aqua, C.goldHi][i % 3];
        return (
          <g key={i} transform={`translate(${x},${y}) rotate(-12) scale(${0.8 + 0.3 * ease.outBack(clamp(t / 8))})`} opacity={1 - clamp((t - 40) / 14)}>
            <Shape d={ellipse(-10, 30, 22, 16)} fill={c} line={4} />
            <Line d="M10,28L10,-50C32,-40 42,-22 34,-4" size={6} />
          </g>
        );
      })}
    </>
  );
};

const Boxes: React.FC<FeatureProps> = ({r, p, s}) => {
  const labels = r.boxes ?? ['rent', 'bills', 'regret'];
  const w = 220 * s.scale;
  const h = 110 * s.scale;
  const base = s.y - 60 * s.scale;
  const wob = Math.sin(p.f / 6) * 3;
  return (
    <g transform={`rotate(${wob} ${s.x} ${base})`}>
      {labels.map((lb, i) => (
        <g key={i} transform={`rotate(${(i - 1) * 4} ${s.x} ${base - i * h})`}>
          <Shape d={rect(s.x - w / 2, base - (i + 1) * h, w, h, 6)} fill={[C.release, C.candy, C.ice][i % 3]} shade={rect(s.x + w * 0.2, base - (i + 1) * h, w * 0.3, h)} shadeInk="ht-ink-1" line={5} />
          <Txt x={s.x} y={base - (i + 1) * h + h * 0.66} size={h * 0.46} font={FONT.hand} weight={700} color={C.ink}>
            {lb}
          </Txt>
        </g>
      ))}
    </g>
  );
};

const Seat: React.FC<FeatureProps> = ({s, time}) => (
  <Shape d={rect(s.x - 150, s.y + 74 * s.scale, 300, FLOOR - s.y - 74 * s.scale + 2, 8)} fill={isNight(time) ? '#4A4660' : '#CFCBC0'} line={5} />
);

const FEATURES: Record<string, Feature> = {
  sun: {layer: 'back', draw: Sun},
  stars: {layer: 'back', draw: ({p}) => <Stars f={p.f} n={30} seed={33} y0={80} y1={HORIZON - 200} />},
  calendar: {layer: 'back', draw: Calendar},
  shoe: {layer: 'back', draw: ShoeClose},
  chairs: {layer: 'back', draw: Chairs},
  spotlight: {layer: 'back', draw: Spotlight},
  light: {layer: 'back', draw: SoftLight},
  sign: {layer: 'back', draw: Sign},
  map: {layer: 'back', draw: MapRoute},
  bed: {layer: 'back', draw: BedBack},
  smoke: {layer: 'back', draw: Smoke},
  lamp: {layer: 'back', draw: Lamp},
  bedFront: {layer: 'front', draw: BedFront},
  rain: {layer: 'front', draw: Rain},
  thread: {layer: 'front', draw: Thread},
  split: {layer: 'front', draw: Split},
  bubbleQ: {layer: 'front', draw: BubbleQ},
  notes: {layer: 'front', draw: HumNotes},
  boxes: {layer: 'front', draw: Boxes},
  confetti: {layer: 'front', draw: ({p, s}) => <Confetti t={p.f} x={s.head[0]} y={s.head[1] - 200} n={30} seed={8} spread={1.1} floor={FLOOR + 20} />},
  phone: {layer: 'front', draw: Ringing},
  clock: {layer: 'back', draw: Clock},
  money: {layer: 'front', draw: MoneyRain},
  troops: {layer: 'back', draw: Troops},
  speakers: {layer: 'back', draw: Speakers},
  table: {layer: 'front', draw: Table},
  jeep: {layer: 'front', draw: Jeep},
  fireworks: {layer: 'back', draw: Fireworks},
  door: {layer: 'back', draw: Door},
  clown: {layer: 'front', draw: ClownNose},
  hearts: {layer: 'front', draw: ({p, s}) => <FloatHearts f={p.f} x={s.kid ? (s.x + s.kid.x) / 2 : s.head[0]} y={s.head[1] - 120} n={7} seed={5} spread={260} color={C.hotpink} />},
};

// Big foil word, popping in on a sung word.
const BigWord: React.FC<FeatureProps> = ({r, p}) => {
  const at = p.w(r.bigAt ?? 0);
  if (!r.big || p.f < at) return null;
  const k = ease.outBack(clamp((p.f - at) / 8));
  const size = Math.min(200, 940 / (0.56 * r.big.length));
  const y = r.bigY ?? 700;
  return (
    <g transform={`translate(540,${y}) scale(${k}) translate(-540,${-y})`}>
      <Txt x={548} y={y + 8} size={size} font={FONT.lyric} weight={800} color={C.hotpink} spacing={-4} opacity={0.9}>
        {r.big}
      </Txt>
      <Txt x={540} y={y} size={size} font={FONT.lyric} weight={800} color="url(#foil)" spacing={-4} stroke={C.goldLo} strokeWidth={5}>
        {r.big}
      </Txt>
    </g>
  );
};

// A word that pops on every sung onset in the scene (for ad-lib runs the sheet doesn't list).
const Echo: React.FC<{p: SceneProps; word: string}> = ({p, word}) => {
  const tl = useTimeline();
  let peak = 0;
  for (let f = p.slot.from; f <= p.slot.to; f++) peak = Math.max(peak, tl.mouthAt(f));
  const gate = peak * 0.45;
  const onsets: number[] = [];
  let quiet = 10;
  let last = -99;
  for (let f = p.slot.from; f <= p.abs; f++) {
    const m = tl.mouthAt(f);
    if (m < gate) quiet++;
    else {
      if (quiet >= 4 && f - last >= 10) {
        onsets.push(f);
        last = f;
      }
      quiet = 0;
    }
  }
  return (
    <>
      {onsets.map((o, i) => {
        const t = p.abs - o;
        if (t > 34) return null;
        const k = ease.outBack(clamp(t / 6));
        const x = 330 + (i % 3) * 230;
        const y = 470 - (i % 2) * 110 - t * 2;
        return (
          <g key={o} transform={`translate(${x},${y}) scale(${k}) rotate(${i % 2 ? 7 : -7})`} opacity={1 - clamp((t - 20) / 14)}>
            <Txt x={0} y={0} size={104} font={FONT.lyric} weight={800} color={C.hotpink} stroke={C.white} strokeWidth={8}>
              {word}
            </Txt>
          </g>
        );
      })}
    </>
  );
};

const NoteFeature: React.FC<FeatureProps> = ({r, p}) => {
  if (!r.note) return null;
  const at = p.w(r.noteAt ?? 0);
  const [x, y] = r.noteXY ?? [780, 520];
  return (
    <Pop f={p.f} at={at} x={x} y={y}>
      <Note x={x} y={y} size={r.noteSize ?? 64} rot={x < 540 ? -6 : 6} color={r.noteColor}>
        {r.note}
      </Note>
    </Pop>
  );
};

const cameraFor = (r: Recipe, s: Subject): Camera => {
  if (r.zoom === 'close') {
    const z = 1.8;
    return {zoom: z, x: -z * (s.head[0] - 540), y: 800 - 960 - z * (s.head[1] - 960)};
  }
  if (r.zoom === 'mid') {
    const z = 1.25;
    const cx = s.kid ? (s.x + s.kid.x) / 2 : s.x;
    const cy = s.y - 120 * s.scale;
    return {zoom: z, x: -z * (cx - 540) * 0.6, y: 880 - 960 - z * (cy - 960)};
  }
  return {};
};

const washes = (r: Recipe) => {
  const list = Array.isArray(r.wash) ? r.wash : r.wash ? [r.wash] : [];
  return list.map((w, i) => <Wash key={i} kind={w} x={i % 2 ? 820 : 300} y={i % 2 ? 1250 : 600} s={1300} o={0.45} />);
};

const body = (r: Recipe, p: SceneProps, time: TimeOfDay) => {
  const s = placeSubjects(r, p);
  const feats = (r.feature ?? []).map((n) => FEATURES[n]).filter(Boolean);
  if (r.hold === 'boxes') feats.push(FEATURES.boxes);
  if ((r.feature ?? []).includes('bed')) feats.push(FEATURES.bedFront);
  const has = (n: string) => (r.feature ?? []).includes(n);
  const seated = r.pose === 'sit' && r.who !== 'none' && !['chairs', 'bed', 'table', 'jeep'].some(has);
  const moving = r.action === 'walk' || r.action === 'run' || r.action === 'strut';
  // walking in place: the street slides past at exactly the speed of the feet
  const stepSpeed = (r.action === 'run' ? 960 / 18 : 600 / 34) * (r.scale ?? 0.8) * 0.82;
  const scroll = r.scroll !== undefined ? p.f * r.scroll : moving && !r.travel && r.bg === 'street' ? p.f * stepSpeed : 0;
  return (
    <>
      <Backdrop bg={r.bg ?? 'plain'} time={time} f={p.f} scroll={scroll} beat={p.beat} />
      {feats.filter((f) => f.layer === 'back').map((f, i) => <f.draw key={`b${i}`} r={r} p={p} s={s} time={time} />)}
      {seated && <Seat r={r} p={p} s={s} time={time} />}
      {!seated && !has('jeep') && <ContactShadows s={s} />}
      <Subjects p={p} s={s} />
      {feats.filter((f) => f.layer === 'front').map((f, i) => <f.draw key={`f${i}`} r={r} p={p} s={s} time={time} />)}
      <BigWord r={r} p={p} s={s} time={time} />
      {r.echo && <Echo p={p} word={r.echo} />}
      <NoteFeature r={r} p={p} s={s} time={time} />
    </>
  );
};

export const sceneFrom = (r: Recipe): SceneDef => {
  const time = r.time ?? 'day';
  return {
    ground: groundFor[time],
    under: () => <>{washes(r)}</>,
    camera: (p) => cameraFor(r, placeSubjects(r, p)),
    render: (p) => body(r, p, time),
  };
};

const CardText: React.FC<{meta: Meta; y: number; dark: boolean; k: number}> = ({meta, y, dark, k}) => (
  <g transform={`translate(540,${y}) scale(${0.9 + 0.1 * ease.outBack(k)}) translate(-540,${-y})`} opacity={k}>
    <Txt x={550} y={y + 8} size={170} font={FONT.lyric} weight={800} color={C.hotpink} spacing={-5} opacity={0.9}>
      {meta.artist}
    </Txt>
    <Txt x={540} y={y} size={170} font={FONT.lyric} weight={800} color="url(#foil)" spacing={-5} stroke={C.goldLo} strokeWidth={5}>
      {meta.artist}
    </Txt>
    <Txt x={540} y={y + 130} size={104} font={FONT.lyric} weight={700} color={dark ? C.white : C.ink}>
      {meta.title}
    </Txt>
    <Txt x={540} y={y + 210} size={30} font={FONT.tag} weight={700} spacing={4} color={dark ? C.goldHi : C.goldLo}>
      SUGAR &amp; SMOKE · NO. {meta.number}
    </Txt>
  </g>
);

// The title card: the recipe's scene with the names printed over it.
export const titleScene = (r: Recipe, meta: Meta): SceneDef => {
  const base = sceneFrom(r);
  return {
    ...base,
    render: (p) => (
      <>
        {base.render(p)}
        <CardText meta={meta} y={470} dark={isDark(base.ground)} k={clamp((p.f - 8) / 14) * (1 - clamp((p.f - (p.dur - 18)) / 16))} />
      </>
    ),
  };
};

// The end card over the instrumental tail: the recipe plays, the card prints at `cardAt` frames,
// and the page folds shut at the end.
export const endScene = (r: Recipe, meta: Meta, cardAt: number): SceneDef => {
  const base = sceneFrom(r);
  return {
    ...base,
    render: (p) => {
      const card = clamp((p.f - cardAt) / 24);
      const fold = ease.inOutCubic(clamp((p.f - (p.dur - 28)) / 26));
      return (
        <g transform={`translate(0,960) scale(1,${1 - fold}) translate(0,-960)`}>
          {base.render(p)}
          {card > 0 && <Flat d={rect(-100, -100, 1280, 2120)} fill={C[base.ground]} opacity={0.55 * card} />}
          {card > 0 && <CardText meta={meta} y={760} dark={isDark(base.ground)} k={card} />}
        </g>
      );
    },
  };
};

// Scenes for a whole storyboard: n = 0 is the title, n = -1 the end card, the rest are lines.
export const scenesFrom = (story: {n: number; t?: Recipe}[], meta: Meta, cardAt = 480): Record<number, SceneDef> => {
  const out: Record<number, SceneDef> = {};
  story.forEach((s) => {
    const r = s.t ?? {};
    out[s.n] = s.n === 0 ? titleScene(r, meta) : s.n === -1 ? endScene(r, meta, cardAt) : sceneFrom(r);
  });
  return out;
};
