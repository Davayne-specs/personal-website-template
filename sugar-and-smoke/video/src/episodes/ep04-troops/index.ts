// Sugar & Smoke No. 4 - "Troops" (mbastein). Template kit, with the motion upgrade: three-quarter walks,
// beat-locked dancing, breathing idles.
import {C} from '../../brand/tokens';
import {EpisodeDef} from '../../lib/episode';
import {Features, LineT, Story} from '../../lib/timeline';
import {Recipe, scenesFrom} from '../../templates/scene';
import timing from '../../../../episodes/ep04-troops/timing.json';
import story from '../../../../episodes/ep04-troops/storyboard.json';
import features from '../../../../episodes/ep04-troops/audio-features.json';

const META = {artist: 'mbastein', title: 'Troops', number: 4};

export const EP04: EpisodeDef = {
  id: 'Troops',
  number: 4,
  title: 'Troops',
  audio: 'audio/troops.mp3',
  data: {
    timing: timing as LineT[],
    story: story as Story[],
    features: features as Features,
    titleAtStart: true,
    endCard: true,
    stamps: [
      {kind: 'general', re: /^general/i, word: 'GENERAL', ink: 'foil', ghost: C.goldLo, sheen: true},
      {kind: 'east', re: /^east/i, word: 'EAST SIDE', ink: C.hotpink, ghost: C.candy},
      {kind: 'whine', re: /^whine/i, word: 'WHINE', ink: C.teal, ghost: C.aqua},
    ],
  },
  scenes: scenesFrom(story as (Story & {t?: Recipe})[], META, 300),
  theme: {strip: C.candy, washA: 'pink', washB: 'gold'},
};
