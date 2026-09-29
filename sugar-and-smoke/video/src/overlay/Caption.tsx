// The lyric strip: a torn candy strip; each word prints in ink as it is sung.
import React from 'react';
import {C, FONT, FPS} from '../brand/tokens';
import {clamp, ease} from '../lib/ease';
import {hash, rng} from '../lib/random';
import {useEpisode} from '../lib/episode';
import {Slot} from '../lib/timeline';

const torn = (seed: number) => {
  const r = rng(seed);
  const top: string[] = [];
  const bot: string[] = [];
  for (let i = 0; i <= 24; i++) {
    const x = (i / 24) * 100;
    top.push(`${x.toFixed(1)}% ${(r() * 7).toFixed(1)}px`);
    bot.push(`${(100 - x).toFixed(1)}% calc(100% - ${(r() * 7).toFixed(1)}px)`);
  }
  return `polygon(${[...top, ...bot].join(',')})`;
};

export const Caption: React.FC<{slot: Slot; frame: number}> = ({slot, frame}) => {
  const {ep, tl} = useEpisode();
  if (!slot.line) return null;
  const words = slot.line.words;
  const tIn = clamp((frame - slot.from) / 7);
  const seed = hash(`cap${slot.n}`);
  const rot = ((seed % 100) / 100 - 0.5) * 2.4;
  const long = slot.line.text.length > 34;
  return (
    <div
      style={{
        position: 'absolute',
        left: 80,
        right: 80,
        top: 1452,
        display: 'flex',
        justifyContent: 'center',
        opacity: tIn,
        transform: `translateY(${(1 - ease.outCubic(tIn)) * 36}px) rotate(${rot}deg)`,
      }}
    >
      <div
        style={{
          position: 'relative',
          background: ep.theme.strip,
          clipPath: torn(seed),
          padding: long ? '24px 36px 28px' : '26px 44px 30px',
          maxWidth: 900,
          textAlign: 'center',
          boxShadow: 'none',
        }}
      >
        <div
          style={{
            fontFamily: FONT.lyric,
            fontWeight: 800,
            fontSize: long ? 52 : 60,
            lineHeight: 1.1,
            letterSpacing: -0.5,
            color: C.ink,
          }}
        >
          {words.map((w, k) => {
            const wf = Math.round(w.t * FPS);
            const on = clamp((frame - wf + 2) / 3);
            const st = tl.STAMPS.find((k) => k.re.test(w.w));
            const hot = st ? (st.ink === 'foil' ? C.gold : st.ink) : null;
            return (
              <span
                key={k}
                style={{
                  opacity: 0.24 + 0.76 * on,
                  display: 'inline-block',
                  transform: `translateY(${(1 - on) * 3}px)`,
                  marginRight: '0.26em',
                  textDecoration: hot && on > 0.5 ? `underline 7px ${hot}` : 'none',
                  textUnderlineOffset: 8,
                  textDecorationSkipInk: 'none',
                }}
              >
                {w.w}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
