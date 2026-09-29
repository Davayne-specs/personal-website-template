// Any Sugar & Smoke episode, 9:16: one scene per lyric line on the song's timeline.
import React from 'react';
import {AbsoluteFill, Audio, Img, staticFile, useCurrentFrame} from 'remotion';
import {C} from './brand/tokens';
import {clamp} from './lib/ease';
import {EpisodeCtx, EpisodeDef, timelineOf} from './lib/episode';
import {PrintFrame} from './lib/frame';
import {TimelineCtx} from './lib/timeline';
import {Caption} from './overlay/Caption';
import {Stamps} from './overlay/Stamps';
import {SwingTag} from './overlay/SwingTag';
import {Roller, SmokeWipe} from './overlay/Transitions';
import {SceneView} from './SceneView';

const ROLL = 16; // print-roll length in frames
const WIPE = 18; // smoke-wipe length in frames

const EpisodeBody: React.FC<{ep: EpisodeDef; audio: boolean}> = ({ep, audio}) => {
  const frame = useCurrentFrame();
  const tl = timelineOf(ep);
  const {SLOTS} = tl;
  const i = tl.slotIndexAt(frame);
  const cur = SLOTS[i];
  const prev = i > 0 ? SLOTS[i - 1] : null;
  const next = i + 1 < SLOTS.length ? SLOTS[i + 1] : null;

  const layers: React.ReactNode[] = [];
  const first = (s: typeof cur) => s === SLOTS[0];
  // print roll: the next print starts rolling in before its line lands
  const rollStart = (s: typeof cur) => (first(s) ? 0 : s.from - ROLL + 4);
  const rollP = (s: typeof cur) => clamp((frame - rollStart(s)) / (first(s) ? 20 : ROLL));
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
      {audio && <Audio src={staticFile(ep.audio)} />}
      {layers}
      {wipe}
      {ep.Overlay ? <ep.Overlay frame={frame} /> : null}
      <Stamps frame={frame} />
      <PrintFrame frame={frame} ground="none" reg={[2, -1.5]} boilStep={3}>
        <SwingTag slot={cur} frame={frame} />
      </PrintFrame>
      <Caption slot={cur} frame={frame} />
      <Img
        src={staticFile('tex/grain.png')}
        style={{position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: 'multiply', opacity: 0.85}}
      />
    </AbsoluteFill>
  );
};

// Provides the episode and its timeline to everything inside.
export const EpisodeScope: React.FC<{ep: EpisodeDef; children: React.ReactNode}> = ({ep, children}) => {
  const tl = timelineOf(ep);
  return (
    <EpisodeCtx.Provider value={{ep, tl}}>
      <TimelineCtx.Provider value={tl}>{children}</TimelineCtx.Provider>
    </EpisodeCtx.Provider>
  );
};

export const EpisodeView: React.FC<{ep: EpisodeDef; audio?: boolean}> = ({ep, audio = true}) => (
  <EpisodeScope ep={ep}>
    <EpisodeBody ep={ep} audio={audio} />
  </EpisodeScope>
);
