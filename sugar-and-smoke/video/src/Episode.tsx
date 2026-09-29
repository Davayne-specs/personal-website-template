// Sugar & Smoke No. 1 - "give me life" (mbastein). One scene per lyric line.
import React from 'react';
import {AbsoluteFill, Audio, Img, staticFile, useCurrentFrame} from 'remotion';
import {C} from './brand/tokens';
import {clamp} from './lib/ease';
import {PrintFrame} from './lib/frame';
import {SLOTS, slotIndexAt} from './lib/timeline';
import {Caption} from './overlay/Caption';
import {GaugeOverlay} from './overlay/GaugeOverlay';
import {Stamps} from './overlay/Stamps';
import {SwingTag} from './overlay/SwingTag';
import {Roller, SmokeWipe} from './overlay/Transitions';
import {SceneView} from './SceneView';

const ROLL = 16; // print-roll length in frames
const WIPE = 18; // smoke-wipe length in frames

export const Episode: React.FC<{audio?: boolean}> = ({audio = true}) => {
  const frame = useCurrentFrame();
  const i = slotIndexAt(frame);
  const cur = SLOTS[i];
  const prev = i > 0 ? SLOTS[i - 1] : null;
  const next = i + 1 < SLOTS.length ? SLOTS[i + 1] : null;

  const layers: React.ReactNode[] = [];
  const tagSlot = cur;
  // print roll: the next print starts rolling in before its line lands
  const rollStart = (s: typeof cur) => (s.n === 1 ? 0 : s.from - ROLL + 4);
  const rollP = (s: typeof cur) => clamp((frame - rollStart(s)) / (s.n === 1 ? 20 : ROLL));
  if (next && next.move === 'Print roll' && frame >= rollStart(next)) {
    const p = rollP(next);
    layers.push(<SceneView key={`s${cur.n}`} slot={cur} frame={frame} />);
    layers.push(<SceneView key={`s${next.n}`} slot={next} frame={frame} clip={p * 1920} />);
    layers.push(<Roller key="roller" y={p * 1920} />);
  } else if (cur.move === 'Print roll' && rollP(cur) < 1) {
    const p = rollP(cur);
    if (prev) layers.push(<SceneView key={`s${prev.n}`} slot={prev} frame={frame} />);
    else layers.push(<div key="blank" style={{position: 'absolute', inset: 0, background: C.cotton}} />);
    layers.push(<SceneView key={`s${cur.n}`} slot={cur} frame={frame} clip={p * 1920} />);
    layers.push(<Roller key="roller" y={p * 1920} />);
  } else {
    layers.push(<SceneView key={`s${cur.n}`} slot={cur} frame={frame} />);
  }

  // smoke wipe centred on the boundary it belongs to
  let wipe: React.ReactNode = null;
  const wipeFor = (s: typeof cur | null) => s && s.move === 'Smoke wipe' && Math.abs(frame - s.from) <= WIPE / 2;
  if (wipeFor(cur)) wipe = <SmokeWipe p={(frame - (cur.from - WIPE / 2)) / WIPE} seed={cur.n} />;
  else if (wipeFor(next)) wipe = <SmokeWipe p={(frame - (next!.from - WIPE / 2)) / WIPE} seed={next!.n} />;

  return (
    <AbsoluteFill style={{background: C.cotton}}>
      {audio && <Audio src={staticFile('audio/give-me-life.mp3')} />}
      {layers}
      {wipe}
      <GaugeOverlay frame={frame} />
      <Stamps frame={frame} />
      <PrintFrame frame={frame} ground="none" reg={[2, -1.5]} boilStep={3}>
        <SwingTag slot={tagSlot} frame={frame} />
      </PrintFrame>
      <Caption slot={tagSlot} frame={frame} />
      <Img
        src={staticFile('tex/grain.png')}
        style={{position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: 'multiply', opacity: 0.85}}
      />
    </AbsoluteFill>
  );
};
