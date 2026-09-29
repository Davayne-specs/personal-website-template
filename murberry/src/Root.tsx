import React from 'react';
import {Composition} from 'remotion';
import {FPS, H, W} from './brand/tokens';
import {loadFonts} from './brand/fonts';
import {timeline} from './ep01/timeline';
import {Episode} from './Episode';

loadFonts();

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Ep01"
      component={Episode}
      durationInFrames={Math.round(timeline.duration * FPS)}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={{withAudio: true, offset: 0}}
    />
    {timeline.scenes.map((s) => (
      <Composition
        key={s.id}
        id={`Ep01-${s.id}`}
        component={Episode}
        durationInFrames={Math.round((s.end - s.start + 1) * FPS)}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{withAudio: false, offset: Math.max(0, s.start - 0.5)}}
      />
    ))}
  </>
);
