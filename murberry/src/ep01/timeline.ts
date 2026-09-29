import data from './timeline.json';
import {Cue} from '../components/Caption';
import {ease, prog} from '../lib/anim';

export type SceneId =
  | 'fold'
  | 'floor'
  | 'wall'
  | 'machine'
  | 'fibre'
  | 'glucose'
  | 'mind'
  | 'plan'
  | 'signoff';

export type Transition = {
  from: SceneId;
  to: SceneId;
  kind: 'peel' | 'slide' | 'laydown';
  t0: number;
  t1: number;
  dir?: [number, number];
  back?: 'sand' | 'ochre' | 'clay';
};

export const timeline = data as unknown as {
  fps: number;
  duration: number;
  scenes: {id: SceneId; start: number; end: number}[];
  transitions: Transition[];
  captions: Cue[];
  sound: Record<string, unknown>;
};

export const sceneStart = (id: SceneId) => timeline.scenes.find((s) => s.id === id)!.start;
export const sceneEnd = (id: SceneId) => timeline.scenes.find((s) => s.id === id)!.end;

// The zoom from the wall push-up into the muscle layer. The camera pushes in
// on the shoulder across the fold, 1x -> 2.88x, which is where the muscle
// plate sits in the storyboard.
export const ZOOM23_CENTER = {x: 587.7, y: 700.4};
export const ZOOM23_MAX = 2.88;
export const zoom23 = (T: number) => 1 + (ZOOM23_MAX - 1) * prog(T, 33.9, 36.7, ease.inOutCubic);
