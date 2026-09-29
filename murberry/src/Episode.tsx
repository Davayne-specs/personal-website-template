import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {paper} from './brand/tokens';
import {Captions} from './components/Caption';
import {OverheadLight} from './components/Paper';
import {Peel, Slide} from './components/Peel';
import {SceneId, timeline} from './ep01/timeline';
import {ease, prog} from './lib/anim';
import {SceneFold} from './scenes/SceneFold';
import {SceneFloor} from './scenes/SceneFloor';
import {SceneWall} from './scenes/SceneWall';
import {SceneMachine} from './scenes/SceneMachine';
import {SceneFibre} from './scenes/SceneFibre';
import {SceneGlucose} from './scenes/SceneGlucose';
import {SceneMind} from './scenes/SceneMind';
import {ScenePlan} from './scenes/ScenePlan';
import {SceneSignoff} from './scenes/SceneSignoff';

type SceneComp = React.FC<{t: number}>;

export const SCENES: Record<SceneId, SceneComp> = {
  fold: SceneFold,
  floor: SceneFloor,
  wall: SceneWall,
  machine: SceneMachine,
  fibre: SceneFibre,
  glucose: SceneGlucose,
  mind: SceneMind,
  plan: ScenePlan,
  signoff: SceneSignoff,
};

const backColor = (b?: string) =>
  b === 'sand' ? paper.sandBack : b === 'clay' ? paper.clayBack : paper.ochreBack;

/** Renders the scene (or the two scenes of a transition) at time T seconds. */
export const Stage: React.FC<{T: number}> = ({T}) => {
  const start = (id: SceneId) => timeline.scenes.find((s) => s.id === id)!.start;
  const render = (id: SceneId) => {
    const C = SCENES[id];
    return <C t={T - start(id)} />;
  };
  const tr = timeline.transitions.find((x) => T >= x.t0 && T < x.t1);
  if (tr) {
    const p = prog(T, tr.t0, tr.t1, tr.kind === 'slide' ? ease.inOutCubic : ease.inOutSine);
    if (tr.kind === 'peel') {
      return (
        <Peel id={`tr-${tr.from}`} progress={p} dir={tr.dir ?? [1, 1]} back={backColor(tr.back)} under={render(tr.to)}>
          {render(tr.from)}
        </Peel>
      );
    }
    if (tr.kind === 'laydown') {
      return (
        <Peel id={`tr-${tr.from}`} progress={1 - p} dir={tr.dir ?? [1, 1]} back={backColor(tr.back)} under={render(tr.from)}>
          {render(tr.to)}
        </Peel>
      );
    }
    return (
      <Slide progress={p} under={render(tr.from)}>
        {render(tr.to)}
      </Slide>
    );
  }
  const scene =
    timeline.scenes.find((s) => T >= s.start && T < s.end) ?? timeline.scenes[timeline.scenes.length - 1];
  return render(scene.id);
};

export const Episode: React.FC<{withAudio?: boolean; offset?: number}> = ({withAudio = true, offset = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const T = frame / fps + offset;
  const endFade = prog(T, 149.35, 150, ease.inOutSine);
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <Stage T={T} />
      <Captions t={T} cues={timeline.captions} />
      <OverheadLight />
      <AbsoluteFill style={{background: '#000', opacity: endFade}} />
      {withAudio && offset === 0 ? <Audio src={staticFile('audio/ep01-mix.wav')} /> : null}
    </AbsoluteFill>
  );
};
