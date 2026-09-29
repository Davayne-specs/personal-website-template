// Hook, precious half (part one): No. 23-31. Gold foil, cuts on the downbeat, PRECIOUS stamps.
import React from 'react';
import {C, FONT} from '../brand/tokens';
import {Precious, PRECIOUS_PARTS, PRECIOUS_POSES} from '../characters/Precious';
import {Ring} from '../characters/Ring';
import {Stein, STEIN_PARTS, STEIN_POSES} from '../characters/Stein';
import {clamp, ease, keys, lerp, prog} from '../lib/ease';
import {Flat, Line, Shape, Txt} from '../lib/print';
import {rng} from '../lib/random';
import {addPose, chainAngle, Pose, poseAt, walkCycle, worldPoint} from '../lib/rig';
import {Bubble, circle, ellipse, Floor, heart, Note, Pop, rect, smooth, SmokePuff, Sparkle, Wash} from '../props/common';
import {SceneDef} from './types';

const blink = (f: number, every = 97, off = 0) => ((f + off) % every < 4 ? 1 : 0);

const Rays: React.FC<{x: number; y: number; r0: number; r1: number; n?: number; rot?: number; o?: number; color?: string}> = ({
  x,
  y,
  r0,
  r1,
  n = 24,
  rot = 0,
  o = 1,
  color = C.gold,
}) => (
  <g opacity={o}>
    <Line
      d={Array.from({length: n}, (_, i) => {
        const a = (i / n) * Math.PI * 2 + (rot * Math.PI) / 180;
        return `M${(x + Math.cos(a) * r0).toFixed(1)},${(y + Math.sin(a) * r0).toFixed(1)}L${(x + Math.cos(a) * r1).toFixed(1)},${(y + Math.sin(a) * r1).toFixed(1)}`;
      }).join('')}
      size={9}
      color={color}
      thin={0.2}
    />
  </g>
);

// ---------------------------------------------------------------- No. 23
export const S23: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="gold" x={720} y={760} s={1300} o={0.55} />,
  render: (p) => {
    const {f} = p;
    const cant = p.w(6);
    const shrug = f >= cant ? ease.outBack(clamp((f - cant) / 8)) : 0;
    const sPose: Pose = addPose(STEIN_POSES.handsOut, {uarmL: 8 * shrug, uarmR: -8 * shrug, head: 6 * shrug});
    const r = rng(23);
    const scraps = Array.from({length: 7}, (_, i) => {
      const t = (f + i * 13) % 60;
      const side = i % 2 ? 1 : -1;
      return (
        <g key={i} transform={`translate(${280 + side * 110 + Math.sin(t / 6 + i) * 20},${900 + t * 7}) rotate(${t * 6 + i * 40})`} opacity={1 - t / 60}>
          <Shape d={rect(-14, -9, 28 + r() * 10, 18, 2)} fill={C.white} line={3} />
        </g>
      );
    });
    return (
      <>
        <Floor y={1390} fill={C.release} />
        <Precious
          place={{x: 730, y: 1000, scale: 0.8}}
          pose={{...PRECIOUS_POSES.bothHips, pelvis: 3 * Math.sin(f / 10)}}
          face={{smile: 0.8, look: [-0.6, 0], blink: blink(f, 60)}}
          style={{glow: 0.6 + 0.4 * p.beat}}
        />
        {[0, 1, 2].map((i) => (
          <Sparkle key={i} x={620 + i * 120} y={420 + (i % 2) * 90} r={22 + 10 * Math.sin(f / 4 + i)} />
        ))}
        <Stein
          place={{x: 280, y: 1010, scale: 0.72}}
          pose={sPose}
          face={{mouth: p.mouth, look: f < cant ? [0, 1] : [1, -0.2], smile: 0.1, brow: 0.4, browTilt: 0.8, turn: 0.3}}
        />
        {scraps}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 24
const DOLL =
  'M-86,-118L-50,-128C-44,-148 -32,-160 -26,-174C-42,-188 -46,-220 -30,-238C-16,-256 16,-256 30,-238C46,-220 42,-188 26,-174C32,-160 44,-148 50,-128L86,-118L86,-94L46,-98L50,0L82,110L18,110L10,40L-10,40L-18,110L-82,110L-50,0L-46,-98L-86,-94Z';

export const S24: SceneDef = {
  ground: 'cotton',
  under: () => (
    <>
      <Wash kind="pink" x={260} y={1000} s={1000} o={0.45} />
      <Wash kind="aqua" x={840} y={1000} s={1000} o={0.4} />
    </>
  ),
  render: (p) => {
    const {f} = p;
    const exist = p.w(5);
    const inked = clamp((f - exist + 6) / 10);
    const n = 6;
    const me = 3;
    const dolls = Array.from({length: n}, (_, i) => {
      const x = 540 + (i - (n - 1) / 2) * 172;
      const dist = Math.abs(i - (n - 1) / 2);
      const open = ease.outBack(clamp((f - dist * 5) / 10));
      const look = i < me ? 1 : -1;
      const turned = clamp((f - exist - 4) / 6);
      if (i === me && inked > 0) {
        return (
          <g key={i}>
            <g opacity={1 - inked}>
              <Shape d={DOLL} fill={C.candy} line={6} />
            </g>
            <g opacity={inked}>
              <Stein place={{x: 0, y: -40, scale: 0.34}} pose={{uarmL: 70, farmL: 10, uarmR: -70, farmR: -10}} face={{smile: 0.7, mouth: p.mouth}} />
            </g>
          </g>
        );
      }
      return (
        <g key={i} transform={`translate(${x},1080) scale(${open},1)`}>
          <Shape d={DOLL} fill={i % 2 ? C.aqua : C.candy} line={6} />
          <Flat d={circle(-10 + look * 8 * turned, -214, 5)} fill={C.ink} />
          <Flat d={circle(10 + look * 8 * turned, -214, 5)} fill={C.ink} />
          <Line d={`M-10,-196Q0,${-188 + 4 * turned} 10,-196`} size={3.5} />
        </g>
      );
    });
    const meX = 540 + (me - (n - 1) / 2) * 172;
    return (
      <>
        <Floor y={1210} fill={C.release} />
        {dolls.map((d, i) => (i === me ? <g key={i} transform={`translate(${meX},1080)`}>{d}</g> : d))}
        {inked > 0.5 && (
          <>
            <Pop f={f} at={exist + 4} x={meX} y={760}>
              <Sparkle x={meX} y={760} r={40} />
            </Pop>
            <Note x={meX} y={690} size={56} rot={-6} color={C.hotpink}>
              me?
            </Note>
          </>
        )}
        <Note x={540} y={1370} size={52} rot={-2}>
          her friends, all in a row
        </Note>
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 25
export const S25: SceneDef = {
  ground: 'night',
  camera: (p) => ({x: -30 + 60 * prog(p.f, 0, p.dur), zoom: 1.02}),
  render: (p) => {
    const {f} = p;
    const cartX = lerp(360, 700, prog(f, 0, p.dur, ease.inOutSine));
    const bump = Math.abs(Math.sin(f / 5)) * 6;
    const talkS = p.w(3);
    const talkP = p.w(6);
    const r = rng(25);
    const rocks = Array.from({length: 14}, (_, i) => {
      const x = r() * 1200 - 60;
      const y = i < 7 ? r() * 420 + 60 : 1180 + r() * 300;
      const s = 90 + r() * 140;
      return <Shape key={i} d={smooth([[x - s, y], [x - s * 0.6, y - s * 0.7], [x + s * 0.3, y - s * 0.8], [x + s, y - s * 0.1], [x + s * 0.6, y + s * 0.6], [x - s * 0.5, y + s * 0.6]], true, 0.4)} fill={i % 2 ? '#4B4162' : '#3E3552'} line={5} shadow={false} />;
    });
    const veins = Array.from({length: 7}, (_, i) => {
      const x = 80 + i * 150 + r() * 60;
      const y = i % 2 ? 220 + r() * 200 : 1220 + r() * 200;
      return <Line key={i} d={`M${x},${y}L${x + 40},${y + 30}L${x + 70},${y + 10}L${x + 120},${y + 44}`} size={8} color={C.gold} />;
    });
    const glow = 0.7 + 0.3 * Math.sin(f / 5);
    const lanternSwing = Math.sin(f / 14) * 10;
    return (
      <>
        {rocks}
        {veins}
        {[0, 1, 2, 3, 4].map((i) => (
          <Flat key={i} d={circle(100 + i * 230, i % 2 ? 330 : 1300, 26 + (i % 3) * 10)} fill="url(#glow-gold)" opacity={glow} />
        ))}
        {/* timbers */}
        <Shape d={rect(40, 440, 60, 900)} fill={C.goldLo} line={5} />
        <Shape d={rect(980, 440, 60, 900)} fill={C.goldLo} line={5} />
        <Shape d={rect(20, 420, 1040, 60)} fill={C.goldLo} line={5} />
        {/* lantern */}
        <g transform={`translate(540,480) rotate(${lanternSwing})`}>
          <Line d="M0,0L0,90" size={4} />
          <Flat d={circle(0, 150, 260)} fill="url(#glow-gold)" opacity={0.75} />
          <Shape d="M-34,100L34,100L44,190L-44,190Z" fill={C.goldHi} line={5} />
          <Shape d={rect(-50, 186, 100, 18, 6)} fill={C.goldLo} line={4} />
        </g>
        {/* rails */}
        <Line d="M-40,1320L1120,1320M-40,1350L1120,1350" size={7} color={C.smoke} />
        {Array.from({length: 12}, (_, i) => (
          <Shape key={i} d={rect(-40 + i * 100, 1330, 60, 40, 4)} fill={C.goldLo} line={4} shadow={false} />
        ))}
        {/* riders */}
        <Stein place={{x: cartX - 90, y: 1100 - bump, scale: 0.56}} pose={{uarmR: -40, farmR: -80, uarmL: 10}} face={{mouth: p.mouth, smile: 0.8, turn: 0.4, look: [1, 0]}} />
        <Precious place={{x: cartX + 100, y: 1110 - bump, scale: 0.56, flip: true}} pose={{uarmR: 10, uarmL: 10}} face={{smile: 0.9, turn: 0.4, look: [1, 0], mouth: f > talkP ? 0.3 * (Math.sin(f / 2) + 1) / 2 : 0}} />
        {/* cart */}
        <g transform={`translate(${cartX},${1180 - bump})`}>
          <Shape d="M-230,-80L230,-80L200,110L-200,110Z" fill={C.teal} shade="M40,-80L240,-80L210,110L40,110Z" shadeInk="ht-ink-2" line={7} />
          <Line d="M-226,-50L226,-50" size={6} color={C.gold} />
          <Shape d={circle(-130, 130, 40)} fill={C.ink} line={5} />
          <Shape d={circle(130, 130, 40)} fill={C.ink} line={5} />
          <Shape d={circle(-130, 130, 14)} fill={C.gold} line={3} />
          <Shape d={circle(130, 130, 14)} fill={C.gold} line={3} />
        </g>
        {f >= talkS && (
          <Pop f={f} at={talkS} x={cartX - 150} y={640}>
            <Bubble x={cartX - 150} y={640} w={250} h={150} tail={[40, 120]}>
              {[0, 1, 2].map((k) => (
                <Shape key={k} d={circle(cartX - 210 + k * 60, 640, 20)} fill={C.gold} pattern="foil" line={3.5} />
              ))}
            </Bubble>
          </Pop>
        )}
        {f >= talkP && (
          <Pop f={f} at={talkP} x={cartX + 200} y={560}>
            <Bubble x={cartX + 200} y={560} w={230} h={140} tail={[-60, 120]}>
              <Shape d={heart(cartX + 200, 560, 34)} fill={C.hotpink} line={3.5} />
            </Bubble>
          </Pop>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 26
export const S26: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="gold" x={540} y={760} s={1400} o={0.45} />,
  render: (p) => {
    const {f} = p;
    const cmp = p.w(2);
    const tip = f < cmp - 6 ? 3 * Math.sin(f / 4) : lerp(0, 17, ease.outBack(clamp((f - cmp + 6) / 10)));
    const a = (tip * Math.PI) / 180;
    const cx = 540;
    const cy = 700;
    const L = 380;
    const lx = cx - Math.cos(a) * L;
    const ly = cy - Math.sin(a) * L;
    const rx = cx + Math.cos(a) * L;
    const ry = cy + Math.sin(a) * L;
    const panY = 330;
    const fly = f >= cmp ? clamp((f - cmp) / 20) : 0;
    const pan = (x: number, y: number) => (
      <>
        <Line d={`M${x},${y}L${x - 120},${y + panY}M${x},${y}L${x + 120},${y + panY}`} size={4} />
        <Shape d={`M${x - 170},${y + panY}C${x - 150},${y + panY + 90} ${x + 150},${y + panY + 90} ${x + 170},${y + panY}Z`} fill={C.gold} pattern="foil" sheen line={6} />
      </>
    );
    return (
      <>
        <Shape d={`M${cx - 30},${cy}L${cx + 30},${cy}L${cx + 70},1330L${cx - 70},1330Z`} fill={C.gold} pattern="foil" line={6} />
        <Shape d={rect(cx - 200, 1320, 400, 60, 12)} fill={C.goldLo} line={6} />
        {/* the heap: cars, chains, cash */}
        <g transform={`translate(${lx},${ly + panY - 6 - fly * 120}) rotate(${-fly * 20})`}>
          <Shape d="M-130,0L-120,-50C-100,-70 -40,-74 -10,-56L60,-54C90,-50 110,-30 110,0Z" fill={C.teal} line={5} />
          <Shape d={circle(-80, 0, 20)} fill={C.ink} line={3} />
          <Shape d={circle(60, 0, 20)} fill={C.ink} line={3} />
          <Shape d={rect(-40, -140, 110, 70, 6)} fill={C.aqua} line={5} />
          <Txt x={15} y={-92} size={44} font={FONT.lyric} weight={800}>
            $
          </Txt>
          {[0, 1, 2, 3].map((k) => (
            <Shape key={k} d={`${ellipse(-120 + k * 30, -110 - (k % 2) * 16, 18, 12)}${ellipse(-120 + k * 30, -110 - (k % 2) * 16, 9, 5)}`} evenodd fill={C.gold} line={3} />
          ))}
        </g>
        {pan(lx, ly)}
        {pan(rx, ry)}
        <Precious place={{x: rx, y: ry + panY - 118, scale: 0.28}} pose={PRECIOUS_POSES.bothHips} face={{smile: 1}} style={{glow: 1}} />
        {/* beam */}
        <g transform={`translate(${cx},${cy}) rotate(${tip})`}>
          <Shape d={rect(-L - 20, -18, 2 * L + 40, 36, 14)} fill={C.gold} pattern="foil" sheen line={6} />
        </g>
        <Shape d={circle(cx, cy, 34)} fill={C.goldHi} line={5} />
        {f >= cmp && (
          <Pop f={f} at={cmp} x={330} y={1480 - 260}>
            <Note x={300} y={1200} size={60} rot={-8}>
              no contest.
            </Note>
          </Pop>
        )}
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 27 - the cover, alive
export const S27: SceneDef = {
  ground: 'cotton',
  under: (p) => (
    <>
      <Wash kind="pink" x={320} y={520} s={1400} o={0.85} />
      <Wash kind="aqua" x={760} y={1150} s={1300} o={0.8} v={2} />
      <Wash kind="pink" x={260} y={1500} s={900} o={0.7} v={2} />
    </>
  ),
  camera: (p) => ({zoom: 1.02 + 0.06 * prog(p.f, 0, p.dur, ease.outCubic), rotate: -2 + 3 * prog(p.f, 0, p.dur)}),
  render: (p) => {
    const {f} = p;
    const hit = p.w(3);
    const g = f >= hit - 2 ? 1 - clamp((f - hit) / 30) : 0.3;
    return (
      <>
        <SmokePuff x={900 - f * 0.8} y={420} s={620} o={0.95} v={1} />
        <SmokePuff x={880 + f * 0.6} y={1330} s={760} o={0.95} v={3} flip />
        <Ring x={540} y={860} r={250} spin={24 + 10 * Math.sin(f / 20)} tilt={-24} band={0.26} glint={g} glow={0.4} />
        <SmokePuff x={120} y={1200} s={380} o={0.5} v={2} />
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 28 & 39 - the throne of rings
const Throne: React.FC<{x: number; y: number; s?: number}> = ({x, y, s = 1}) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <Shape d="M-190,-460C-190,-600 190,-600 190,-460L190,160L-190,160Z" fill={C.candy} shade="M60,-600L200,-600L200,160L60,160Z" shadeInk="ht-pink-2" line={8} />
    <Line d="M-150,-470C-150,-560 150,-560 150,-470" size={7} color={C.gold} />
    <Shape d={circle(0, -500, 34)} fill={C.gold} pattern="foil" sheen line={5} />
    <Shape d={rect(-240, 40, 480, 120, 20)} fill={C.hotpink} line={7} />
    <Shape d={rect(-270, -120, 70, 240, 20)} fill={C.gold} pattern="foil" line={6} />
    <Shape d={rect(200, -120, 70, 240, 20)} fill={C.gold} pattern="foil" line={6} />
    <Shape d={rect(-220, 160, 50, 200, 10)} fill={C.goldLo} line={5} />
    <Shape d={rect(170, 160, 50, 200, 10)} fill={C.goldLo} line={5} />
  </g>
);

const orbit = (f: number, n: number, cx: number, cy: number, rx: number, ry: number) =>
  Array.from({length: n}, (_, i) => {
    const a = f / 14 + (i / n) * Math.PI * 2;
    return {x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, front: Math.sin(a) > 0, k: 0.75 + 0.25 * Math.sin(a), spin: (f * 5 + i * 40) % 360, i};
  });

export const ThroneScene = (who: 'stein' | 'precious'): SceneDef => ({
  ground: 'cotton',
  under: () => <Wash kind="gold" x={540} y={820} s={1500} o={0.6} />,
  render: (p) => {
    const {f} = p;
    const rings = orbit(f, 7, 540, 830, 420, 140);
    const ring = (r: (typeof rings)[number]) => <Ring key={r.i} x={r.x} y={r.y} r={52 * r.k} spin={r.spin} tilt={-20} glint={r.front ? 0.5 : 0} />;
    const sit: Pose = {thighL: 80, shinL: -80, thighR: -80, shinR: 80, uarmL: 30, farmL: -60, uarmR: -30, farmR: 60};
    return (
      <>
        <Flat d={circle(540, 800, 520)} fill="url(#glow-gold)" opacity={0.5 + 0.3 * p.beat} />
        {rings.filter((r) => !r.front).map(ring)}
        <Throne x={540} y={1130} s={0.9} />
        {who === 'stein' ? (
          <Stein place={{x: 540, y: 1100, scale: 0.72}} pose={sit} style={{crown: true}} face={{mouth: p.mouth, smile: 0.9, brow: 0.6, browTilt: -0.3}} />
        ) : (
          <>
            <Precious place={{x: 540, y: 1100, scale: 0.72}} pose={{...sit, uarmR: -40, farmR: -100}} style={{crown: true, glow: 0.5}} face={{smile: 0.9, blink: blink(f, 50)}} />
            <Stein place={{x: 170, y: 1210, scale: 0.6}} pose={{...STEIN_POSES.kneel, uarmL: 20, farmL: -60, uarmR: -40, farmR: -80, head: 12, torso: 6}} face={{eyes: 'closed', smile: 0.6}} />
          </>
        )}
        {rings.filter((r) => r.front).map(ring)}
        <Floor y={1480} fill={C.release} />
      </>
    );
  },
});
export const S28 = ThroneScene('stein');

// ---------------------------------------------------------------- No. 29
export const S29: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="gold" x={720} y={900} s={1200} o={0.45} />,
  render: (p) => {
    const {f} = p;
    const pull = ease.inOutCubic(clamp(f / p.dur));
    const pose: Pose = {torso: 16, head: 10, uarmL: -40, farmL: -100, uarmR: 30, farmR: 100, thighL: 18, shinL: -10, thighR: -24, shinR: 20};
    const place = {x: lerp(360, 560, pull), y: 1010, scale: 0.8, rotate: 10};
    const hand = worldPoint(STEIN_PARTS, pose, place, 'handR', [0, 40]);
    const rx = hand[0] + 90 + 40 * Math.sin(f / 3);
    const ry = hand[1] - 30;
    return (
      <>
        <Floor y={1390} fill={C.release} />
        <Flat d={circle(rx, ry, 300)} fill="url(#glow-gold)" opacity={0.8} />
        {[0, 1, 2].map((k) => {
          const rr = 120 + ((f * 4 + k * 40) % 120);
          return <Line key={k} d={`M${rx + rr * 0.7},${ry - rr * 0.7}Q${rx + rr * 1.1},${ry} ${rx + rr * 0.7},${ry + rr * 0.7}`} size={6} color={C.gold} opacity={1 - ((f * 4 + k * 40) % 120) / 120} />;
        })}
        <Stein place={place} pose={pose} face={{eyes: 'wide', look: [1, 0], smile: 0.5, brow: 1, mouth: p.mouth * 0.7}} />
        <Ring x={rx} y={ry} r={110} spin={f * 7} tilt={-18} glint={0.7} glow={0.4} />
        <Line d={`M${place.x - 300},1180L${place.x - 180},1180M${place.x - 330},1240L${place.x - 200},1240`} size={6} />
        <Note x={300} y={560} size={70} rot={-8}>
          hooked.
        </Note>
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 30
const Flower: React.FC<{x: number; y: number; open: number; c: string}> = ({x, y, open, c}) => {
  if (open <= 0) return null;
  const petals = Array.from({length: 6}, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    const px = x + Math.cos(a) * 34 * open;
    const py = y - 90 + Math.sin(a) * 34 * open;
    return <Shape key={i} d={ellipse(px, py, 30 * open, 22 * open)} fill={c} line={4} />;
  });
  return (
    <>
      <Line d={`M${x},${y}Q${x - 10},${y - 50} ${x},${y - 90}`} size={6} color={C.teal} />
      {petals}
      <Shape d={circle(x, y - 90, 18 * open)} fill={C.goldHi} line={4} />
    </>
  );
};

export const S30: SceneDef = {
  ground: 'cotton',
  under: () => <Wash kind="pink" x={540} y={800} s={1500} o={0.5} />,
  render: (p) => {
    const {f} = p;
    const x = lerp(200, 820, clamp(f / p.dur));
    const walk = walkCycle(f, 30, 0.8);
    return (
      <>
        <Rays x={x} y={640} r0={330} r1={620} rot={f * 0.6} o={0.8} />
        <Floor y={1370} fill={C.release} />
        {[120, 260, 400, 540, 680, 820, 960].map((fx, i) => (
          <Flower key={i} x={fx} y={1380} open={ease.outBack(clamp((x - fx + 60) / 80))} c={[C.candy, C.hotpink, C.goldHi, C.aqua][i % 4]} />
        ))}
        <Precious
          place={{x, y: 990 - Math.abs(Math.sin((f / 30) * Math.PI)) * 8, scale: 0.82}}
          pose={addPose({...PRECIOUS_POSES.hipHand, uarmR: -20, farmR: 20, pelvis: 7 * Math.sin((f / 30) * Math.PI * 2)}, {thighL: walk.thighL, thighR: walk.thighR, shinL: walk.shinL, shinR: walk.shinR})}
          face={{smile: 0.9, turn: 0.3, eyes: p.beat > 0.8 ? 'happy' : 'dot', blink: blink(f, 45)}}
          style={{glow: 0.9}}
        />
      </>
    );
  },
};

// ---------------------------------------------------------------- No. 31
const ClapHands: React.FC<{x: number; y: number; rot: number; clap: number; skin: string}> = ({x, y, rot, clap, skin}) => (
  <g transform={`translate(${x},${y}) rotate(${rot})`}>
    <Shape d={rect(-60, 60, 120, 400)} fill={C.teal} line={6} />
    <g transform={`translate(${-24 - 30 * (1 - clap)},0) rotate(${-14 * (1 - clap)})`}>
      <Shape d="M-40,80C-50,20 -40,-60 -20,-80C0,-96 20,-80 22,-40L24,80Z" fill={skin} line={6} />
    </g>
    <g transform={`translate(${24 + 30 * (1 - clap)},0) rotate(${14 * (1 - clap)})`}>
      <Shape d="M40,80C50,20 40,-60 20,-80C0,-96 -20,-80 -22,-40L-24,80Z" fill={skin} line={6} />
    </g>
    {clap > 0.9 && <Line d="M-50,-120L-70,-150M0,-130L0,-170M50,-120L70,-150" size={6} />}
  </g>
);

export const S31: SceneDef = {
  ground: 'night',
  render: (p) => {
    const {f} = p;
    const clap = p.beat > 0.6 ? 1 : 0.2;
    const skins = [C.steinSkin, C.preciousSkin, '#A0705A', '#5A3A2A'];
    return (
      <>
        <Flat d="M380,-40L700,-40L920,1400L160,1400Z" fill={C.goldHi} opacity={0.35} />
        <Flat d={ellipse(540, 1380, 420, 70)} fill={C.goldHi} opacity={0.5} />
        <Precious place={{x: 540, y: 1000, scale: 0.8}} pose={f % 40 < 20 ? PRECIOUS_POSES.wave : {...PRECIOUS_POSES.wave, uarmR: -130, farmR: -50}} face={{smile: 1, eyes: 'happy'}} style={{glow: 0.6}} />
        {[
          [150, 760, 55],
          [140, 1180, 70],
          [930, 720, -55],
          [940, 1150, -70],
        ].map(([x, y, r], i) => (
          <g key={i} transform={`translate(${x},${y}) scale(0.78) translate(${-x},${-y})`}>
            <ClapHands x={x} y={y} rot={r} clap={i % 2 ? clap : p.beat > 0.5 ? 1 : 0.3} skin={skins[i % skins.length]} />
          </g>
        ))}
        <Txt x={540} y={430} size={46} font={FONT.hand} color={C.goldHi} rotate={-4}>
          give it up!
        </Txt>
      </>
    );
  },
};

export const HOOK1: Record<number, SceneDef> = {23: S23, 24: S24, 25: S25, 26: S26, 27: S27, 28: S28, 29: S29, 30: S30, 31: S31};

void chainAngle;
void keys;
void poseAt;
void PRECIOUS_PARTS;
