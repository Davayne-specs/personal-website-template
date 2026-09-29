import React from 'react';
import {AbsoluteFill} from 'remotion';
import {FPS, REGISTRATION} from './brand/tokens';
import {clamp, ease} from './lib/ease';
import {useEpisode} from './lib/episode';
import {PrintFrame} from './lib/frame';
import {Placeholder} from './lib/Placeholder';
import {SceneProps} from './lib/scene';
import {Slot, Timeline} from './lib/timeline';

const sheenAt = (tl: Timeline, frame: number, slot: Slot) => {
  const shiny = new Set(tl.STAMPS.filter((s) => s.sheen).map((s) => s.kind));
  const hit = tl.HITS.find((h) => shiny.has(h.kind) && frame >= h.frame - 3 && frame <= h.frame + 14);
  if (hit) return ((frame - (hit.frame - 3)) / 17) * 1.4 - 0.2;
  const f = frame - slot.from;
  if ((slot.state === 'Precious' || slot.state === 'Release') && f >= 0 && f <= 18) return (f / 18) * 1.4 - 0.2;
  // a slow idle sweep every ~3 seconds so foil never goes flat
  const idle = (frame % 96) / 30;
  return idle <= 1.2 ? idle * 1.2 - 0.2 : -1;
};

export const SceneView: React.FC<{slot: Slot; frame: number; clip?: number}> = ({slot, frame, clip}) => {
  const {ep, tl} = useEpisode();
  const def = ep.scenes[slot.n] ?? Placeholder;
  const f = frame - slot.from;
  const words = slot.line?.words ?? [];
  const p: SceneProps = {
    f,
    dur: slot.to - slot.from,
    abs: frame,
    slot,
    w: (i: number) => (words.length ? Math.round(words[Math.max(0, Math.min(words.length - 1, i))].t * FPS) - slot.from : 0),
    beat: tl.beatPulse(frame),
    beatN: tl.beatIndex(frame),
    mouth: tl.mouthAt(frame),
  };
  const base = REGISTRATION[slot.state];
  const drift = slot.state === 'Memory' ? [Math.sin(f / 19) * 3, Math.cos(f / 23) * 2.5] : [0, 0];
  const snap = slot.move === 'Registration snap' ? 1 - ease.outCubic(clamp(f / 9)) : 0;
  const reg: [number, number] = [base[0] + drift[0] + 46 * snap, base[1] + drift[1] - 34 * snap];
  const cam = def.camera?.(p) ?? {};
  const hook = slot.state === 'Precious' || slot.state === 'Pressure';
  const push = hook ? 0.016 * p.beat : 0;
  const camera = {...cam, zoom: (cam.zoom ?? 1) * (1 + push + 0.035 * snap)};
  return (
    <AbsoluteFill style={clip !== undefined ? {clipPath: `inset(0 0 ${Math.max(0, 1920 - clip)}px 0)`} : undefined}>
      <PrintFrame frame={frame} ground={def.ground} reg={reg} boilStep={hook ? 2 : 3} sheen={sheenAt(tl, frame, slot)} camera={camera} under={def.under?.(p)}>
        {def.render(p)}
      </PrintFrame>
    </AbsoluteFill>
  );
};
