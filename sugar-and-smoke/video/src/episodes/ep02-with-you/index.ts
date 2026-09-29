// Sugar & Smoke No. 2 - "With You" (mbastein). Winter night to spring and back to night.
import {C} from '../../brand/tokens';
import {EpisodeDef} from '../../lib/episode';
import {Features, LineT, Story} from '../../lib/timeline';
import timing from '../../../../episodes/ep02-with-you/timing.json';
import story from '../../../../episodes/ep02-with-you/storyboard.json';
import features from '../../../../episodes/ep02-with-you/audio-features.json';
import {SCENES} from './scenes';

export const EP02: EpisodeDef = {
  id: 'WithYou',
  number: 2,
  title: 'With You',
  audio: 'audio/with-you.mp3',
  data: {
    timing: timing as LineT[],
    story: story as Story[],
    features: features as Features,
    titleAtStart: true,
    endCard: true,
    stamps: [
      {kind: 'future', re: /^future/i, word: 'FUTURE', ink: 'foil', ghost: C.goldLo, sheen: true},
      {kind: 'cold', re: /^cold/i, word: 'COLD', ink: C.iceInk, ghost: C.slate},
      {kind: 'night', re: /^night/i, word: 'NIGHT', ink: C.amber, ghost: C.hotpink},
    ],
  },
  scenes: SCENES,
  theme: {strip: C.ice, washA: 'ice', washB: 'amber'},
};
