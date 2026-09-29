import React from 'react';
import {Composition, Still} from 'remotion';
import {FPS, H, W} from './brand/tokens';
import {loadBrandFonts} from './brand/fonts';
import {Episode} from './Episode';
import {TOTAL_FRAMES} from './lib/timeline';
import {CAST_H, CAST_W, CastSheet} from './sheets/CastSheet';
import {WallCut} from './WallCut';

loadBrandFonts();

export const Root: React.FC = () => (
  <>
    <Composition id="GiveMeLife" component={Episode} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} defaultProps={{audio: true}} />
    <Composition id="GiveMeLifeWall" component={WallCut} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} defaultProps={{audio: true}} />
    <Still id="CastSheet" component={CastSheet} width={CAST_W} height={CAST_H} />
  </>
);
