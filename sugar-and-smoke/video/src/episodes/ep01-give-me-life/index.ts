// Sugar & Smoke No. 1 - "give me life" (mbastein).
import {C} from '../../brand/tokens';
import {EpisodeDef} from '../../lib/episode';
import {Features, LineT, Story} from '../../lib/timeline';
import timing from '../../../../episodes/ep01-give-me-life/timing.json';
import story from '../../../../episodes/ep01-give-me-life/storyboard.json';
import features from '../../../../episodes/ep01-give-me-life/audio-features.json';
import {GaugeOverlay} from './GaugeOverlay';
import {HOOK1} from './scenes/hook1';
import {HOOK2} from './scenes/hook2';
import {OUTRO} from './scenes/outro';
import {PRESSURE} from './scenes/pressure';
import {VERSE1} from './scenes/verse1';
import {VERSE2} from './scenes/verse2';

export const EP01: EpisodeDef = {
  id: 'GiveMeLife',
  number: 1,
  title: 'give me life',
  audio: 'audio/give-me-life.mp3',
  data: {
    timing: timing as LineT[],
    story: story as Story[],
    features: features as Features,
    titleAfterLine: 3,
    stamps: [
      {kind: 'precious', re: /^precious/i, word: 'PRECIOUS', ink: 'foil', ghost: C.goldLo, sheen: true},
      {kind: 'pressure', re: /^pressure/i, word: 'PRESSURE', ink: C.pressure, ghost: C.hotpink},
    ],
  },
  scenes: {...VERSE1, ...VERSE2, ...HOOK1, ...HOOK2, ...PRESSURE, ...OUTRO},
  theme: {strip: C.candy, washA: 'pink', washB: 'aqua'},
  Overlay: GaugeOverlay,
};
