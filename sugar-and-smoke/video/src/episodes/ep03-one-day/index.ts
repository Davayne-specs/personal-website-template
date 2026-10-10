// Sugar & Smoke No. 3 - "One Day" (mbastein). Built from the template kit: every scene is a recipe in storyboard.json.
import {C} from '../../brand/tokens';
import {EpisodeDef} from '../../lib/episode';
import {Features, LineT, Story} from '../../lib/timeline';
import {Recipe, scenesFrom} from '../../templates/scene';
import timing from '../../../../episodes/ep03-one-day/timing.json';
import story from '../../../../episodes/ep03-one-day/storyboard.json';
import features from '../../../../episodes/ep03-one-day/audio-features.json';

const META = {artist: 'mbastein', title: 'One Day', number: 3};

export const EP03: EpisodeDef = {
  id: 'OneDay',
  number: 3,
  title: 'One Day',
  audio: 'audio/one-day.mp3',
  data: {
    timing: timing as LineT[],
    story: story as Story[],
    features: features as Features,
    titleAtStart: true,
    endCard: true,
    stamps: [
      {kind: 'ashaka', re: /^ashaka/i, word: 'ASHAKA', ink: 'foil', ghost: C.goldLo, sheen: true},
      {kind: 'celebrate', re: /^celebrate/i, word: 'CELEBRATE', ink: C.hotpink, ghost: C.candy},
      {kind: 'soldier', re: /^soldier/i, word: 'SOLDIER', ink: C.teal, ghost: C.aqua},
    ],
  },
  scenes: scenesFrom(story as (Story & {t?: Recipe})[], META, 480),
  theme: {strip: C.release, washA: 'gold', washB: 'amber'},
};
