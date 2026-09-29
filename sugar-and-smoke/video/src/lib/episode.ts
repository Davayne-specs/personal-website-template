// An episode: its song, timing data, scenes, stamps and accent theme.
import React, {createContext, useContext} from 'react';
import {SceneDef} from './scene';
import {buildTimeline, EpisodeData, Timeline} from './timeline';

export type WashKind = 'pink' | 'aqua' | 'gold' | 'ice' | 'slate' | 'amber';

export type Theme = {
  strip: string; // lyric strip stock
  washA: WashKind; // accent washes (wall cut background, title)
  washB: WashKind;
};

export type EpisodeDef = {
  id: string; // composition id
  number: number;
  title: string;
  audio: string; // file under public/
  data: EpisodeData;
  scenes: Record<number, SceneDef>;
  theme: Theme;
  Overlay?: React.FC<{frame: number}>; // episode-only overlay (No. 1: the Gauge)
};

const cache = new WeakMap<EpisodeDef, Timeline>();
export const timelineOf = (ep: EpisodeDef) => {
  let t = cache.get(ep);
  if (!t) {
    t = buildTimeline(ep.data);
    cache.set(ep, t);
  }
  return t;
};

export const EpisodeCtx = createContext<{ep: EpisodeDef; tl: Timeline} | null>(null);
export const useEpisode = () => {
  const e = useContext(EpisodeCtx);
  if (!e) throw new Error('useEpisode() outside an episode');
  return e;
};
