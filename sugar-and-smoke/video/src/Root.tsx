import React from 'react';
import {Composition, Still} from 'remotion';
import {FPS, H, W} from './brand/tokens';
import {loadBrandFonts} from './brand/fonts';
import {EpisodeView} from './Episode';
import {EP01} from './episodes/ep01-give-me-life';
import {EP02} from './episodes/ep02-with-you';
import {EpisodeDef, timelineOf} from './lib/episode';
import {CAST_H, CAST_W, CastSheet} from './sheets/CastSheet';
import {WallView} from './WallCut';

loadBrandFonts();

const EPISODES: EpisodeDef[] = [EP01, EP02];

// Composition components take only serialisable props, so each episode gets its own pair.
const vertical = (ep: EpisodeDef): React.FC<{audio?: boolean}> => ({audio = true}) => <EpisodeView ep={ep} audio={audio} />;
const wall = (ep: EpisodeDef): React.FC<{audio?: boolean}> => ({audio = true}) => <WallView ep={ep} audio={audio} />;

const COMPS = EPISODES.map((ep) => ({ep, V: vertical(ep), Wl: wall(ep), frames: timelineOf(ep).TOTAL_FRAMES}));

export const Root: React.FC = () => (
  <>
    {COMPS.map(({ep, V, Wl, frames}) => (
      <React.Fragment key={ep.id}>
        <Composition id={ep.id} component={V} durationInFrames={frames} fps={FPS} width={W} height={H} defaultProps={{audio: true}} />
        <Composition id={`${ep.id}Wall`} component={Wl} durationInFrames={frames} fps={FPS} width={1920} height={1080} defaultProps={{audio: true}} />
      </React.Fragment>
    ))}
    <Still id="CastSheet" component={CastSheet} width={CAST_W} height={CAST_H} />
  </>
);
