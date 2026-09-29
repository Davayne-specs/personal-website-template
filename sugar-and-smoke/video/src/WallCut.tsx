// 16:9 "wall cut": the vertical print pinned to a cotton wall, with the catalogue
// entry for the current scene beside it (number, tag, state, what happens, the line).
import React from 'react';
import {AbsoluteFill, Audio, Img, staticFile, useCurrentFrame} from 'remotion';
import {C, FONT, FPS, TAG_STOCK} from './brand/tokens';
import {clamp, ease} from './lib/ease';
import {SLOTS, slotIndexAt, STORY} from './lib/timeline';
import {Episode} from './Episode';

const S = 1000 / 1920; // print height 1000px on a 1080px-tall wall
const PW = 1080 * S;
const PX = (1920 - PW) / 2;
const PY = 40;

export const WallCut: React.FC<{audio?: boolean}> = ({audio = true}) => {
  const frame = useCurrentFrame();
  const slot = SLOTS[slotIndexAt(frame)];
  const story = STORY.find((s) => s.n === slot.n)!;
  const tIn = ease.outCubic(clamp((frame - slot.from) / 8));
  const stock = TAG_STOCK[slot.state];
  const words = slot.line?.words ?? [];
  return (
    <AbsoluteFill style={{background: C.cotton}}>
      {audio && <Audio src={staticFile('audio/give-me-life.mp3')} />}
      <Img src={staticFile('tex/wash-pink-1.png')} style={{position: 'absolute', left: -260, top: -180, width: 1000, height: 1000, opacity: 0.35, mixBlendMode: 'multiply'}} />
      <Img src={staticFile('tex/wash-aqua-1.png')} style={{position: 'absolute', left: 1240, top: 300, width: 900, height: 900, opacity: 0.35, mixBlendMode: 'multiply'}} />

      {/* left: the series and the line being sung */}
      <div style={{position: 'absolute', left: 80, top: 90, width: 560}}>
        <div style={{fontFamily: FONT.lyric, fontWeight: 800, fontSize: 84, letterSpacing: -2, color: C.gold, WebkitTextStroke: `2px ${C.goldLo}`, textShadow: `5px 4px 0 ${C.hotpink}`}}>mbastein</div>
        <div style={{fontFamily: FONT.lyric, fontWeight: 700, fontSize: 40, color: C.ink, marginTop: 4}}>give me life</div>
        <div style={{fontFamily: FONT.tag, fontWeight: 700, fontSize: 18, letterSpacing: 3, color: C.ink, marginTop: 10}}>SUGAR &amp; SMOKE · NO. 1</div>
      </div>
      <div style={{position: 'absolute', left: 80, top: 470, width: 560, opacity: tIn, transform: `translateY(${(1 - tIn) * 20}px)`}}>
        <div style={{fontFamily: FONT.lyric, fontWeight: 800, fontSize: words.length > 7 ? 50 : 60, lineHeight: 1.12, color: C.ink}}>
          {words.map((w, k) => {
            const on = clamp((frame - Math.round(w.t * FPS) + 2) / 3);
            return (
              <span key={k} style={{opacity: 0.22 + 0.78 * on, marginRight: '0.24em', display: 'inline-block'}}>
                {w.w}
              </span>
            );
          })}
        </div>
      </div>

      {/* centre: the print, taped to the wall */}
      <div style={{position: 'absolute', left: PX + 12, top: PY + 14, width: PW, height: 1000, background: 'rgba(35,27,46,0.18)'}} />
      <div style={{position: 'absolute', left: PX, top: PY, width: PW, height: 1000, overflow: 'hidden'}}>
        <div style={{width: 1080, height: 1920, transform: `scale(${S})`, transformOrigin: 'top left'}}>
          <Episode audio={false} />
        </div>
      </div>
      <div style={{position: 'absolute', left: PX + PW / 2 - 70, top: PY - 18, width: 140, height: 40, background: C.candy, opacity: 0.85, transform: 'rotate(-3deg)'}} />

      {/* right: the catalogue entry */}
      <div style={{position: 'absolute', left: PX + PW + 70, top: 110, width: 520, opacity: tIn}}>
        <div style={{display: 'inline-block', background: stock.bg, color: stock.fg, fontFamily: FONT.tag, fontWeight: 700, fontSize: 22, padding: '8px 16px', border: `3px solid ${C.ink}`}}>
          {slot.n === 0 ? 'No. 00' : `No. ${String(slot.n).padStart(2, '0')}`} · {slot.state.toUpperCase()}
        </div>
        <div style={{fontFamily: FONT.lyric, fontWeight: 800, fontSize: 58, lineHeight: 1.05, color: C.ink, marginTop: 22}}>{story.tag}</div>
        <div style={{fontFamily: FONT.tag, fontSize: 21, lineHeight: 1.5, color: C.ink, marginTop: 22}}>{story.scene}</div>
      </div>

      <Img src={staticFile('tex/grain.png')} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: 'multiply', opacity: 0.6, objectFit: 'cover'}} />
    </AbsoluteFill>
  );
};
