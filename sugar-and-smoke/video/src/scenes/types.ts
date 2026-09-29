import React from 'react';
import {Ground} from '../brand/tokens';
import {Camera} from '../lib/frame';
import {Slot} from '../lib/timeline';

export type SceneProps = {
  f: number; // frame since the scene began
  dur: number; // scene length in frames
  abs: number; // absolute frame in the episode
  slot: Slot;
  w: (i: number) => number; // local frame at which word i is sung (last word if out of range)
  beat: number; // beat pulse now, 1 on the beat decaying to 0
  beatN: number; // beats since the song began
  mouth: number; // lip-sync opening from the isolated vocal, 0..1
};

export type SceneDef = {
  ground: Ground;
  under?: (p: SceneProps) => React.ReactNode; // full-bleed prints behind the camera (washes)
  camera?: (p: SceneProps) => Camera;
  render: (p: SceneProps) => React.ReactNode;
};
