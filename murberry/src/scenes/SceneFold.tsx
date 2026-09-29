import React from 'react';
import {AbsoluteFill} from 'remotion';
import {paper} from '../brand/tokens';
import {DrawPath} from '../components/Draw';
import {Emboss} from '../components/Emboss';
import {Canvas, HatchDefs, Sheet} from '../components/Paper';
import {Peel} from '../components/Peel';
import {FigureBody} from '../figure/Figure';
import * as P from '../figure/paths';
import {ease, lerp, prog} from '../lib/anim';

// Dog-ear from the storyboard: fold line (820, 0) -> (1080, 300).
const EAR_DIR: [number, number] = [300, -260];
const EAR = 0.09476;

const LEGS_DASHED =
  'M 444 1182 C 438 1198 414 1204 408 1214 C 406 1226 402 1238 394 1246 C 384 1320 372 1390 362 1432 M 296 1432 C 292 1400 288 1372 280 1344 C 266 1318 244 1292 248 1262 C 252 1240 266 1232 266 1216 C 262 1186 232 1150 220 1112';

/** Beat 1, 0:00-0:08. Black; an ochre sheet unfolds; the name catches the light; the figure draws itself. */
export const SceneFold: React.FC<{t: number}> = ({t}) => {
  const unfold = 0.56 * (1 - prog(t, 0.25, 1.75, ease.inOutSine));
  const scale =
    lerp(0.955, 1, prog(t, 0.15, 2.3, ease.outCubic)) * lerp(1, 1.025, prog(t, 2.3, 9, ease.linear));
  const dark = 1 - prog(t, 0.05, 1.4, ease.inOutSine);
  const ear = EAR * prog(t, 1.55, 2.65, ease.inOutSine);
  const depth = t < 2.6 ? prog(t, 1.95, 2.6) : lerp(1, 0.1, prog(t, 3.4, 4.6));
  const sweep = t >= 2.3 && t <= 3.6 ? (t - 2.3) / 1.3 : -1;

  const outline = prog(t, 2.4, 5.4, ease.inOutSine);
  const armDraw = prog(t, 3.1, 4.7, ease.inOutSine);
  const legsDashed = prog(t, 4.3, 5.7, ease.inOutSine);
  const details = prog(t, 3.3, 4.8);
  const fill = prog(t, 4.3, 5.9);
  const lowFill = prog(t, 4.8, 6.1);
  const contact = prog(t, 5.0, 6.3);

  return (
    <AbsoluteFill style={{background: '#000'}}>
      <AbsoluteFill style={{transform: `scale(${scale})`}}>
        <Peel id="s1-unfold" progress={unfold} dir={[0.12, 1]} under={<AbsoluteFill style={{background: '#000'}} />}>
          <Peel id="s1-ear" progress={ear} dir={EAR_DIR} under={<Sheet color={paper.burnt} />}>
            <Sheet color={paper.ochre}>
              <Canvas>
                <defs>
                  <linearGradient id="s1-fadeg" x1="0" y1="1170" x2="0" y2="1300" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#fff" />
                    <stop offset="1" stopColor="#000" />
                  </linearGradient>
                  <mask id="s1-fade" maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="1700">
                    <rect x="0" y="0" width="1200" height="1700" fill="url(#s1-fadeg)" />
                  </mask>
                  <clipPath id="s1-lower">
                    <rect x="0" y="1200" width="1200" height="400" />
                  </clipPath>
                </defs>
                <HatchDefs id="s1" />
                <Emboss id="s1-em" x={96} y={250} depth={depth} sweep={sweep} paperColor={paper.ochre} />
                <g transform="translate(142 -180) scale(1.1)" style={{filter: 'drop-shadow(0 5px 6px rgba(42,36,32,0.16))'}}>
                  <ellipse cx="370" cy="1484" rx="130" ry="10" fill="#2A2420" opacity={0.2 * contact} style={{filter: 'blur(6px)'}} />
                  <g fill={paper.skin} opacity={0.38 * lowFill}>
                    <path d={P.BODY} />
                    <path d={P.FOOT_STAND} />
                  </g>
                  <g clipPath="url(#s1-lower)" opacity={0.55}>
                    <DrawPath id="s1-legs" d={LEGS_DASHED} p={legsDashed} width={2.2} dash="2 10" />
                    <DrawPath id="s1-foot" d={P.FOOT_STAND_LINE} p={prog(t, 5.2, 6.0)} width={2.2} dash="2 10" />
                  </g>
                  <g mask="url(#s1-fade)">
                    <FigureBody uid="s1" draw={outline} fill={fill} details={details} />
                  </g>
                  <g transform="rotate(86 318 700)">
                    <g opacity={fill}>
                      <path fill={paper.skinLight} d={P.UPPER_ARM} />
                      <path fill="url(#s1-hatch)" opacity={0.6} d={P.UPPER_ARM_HATCH} />
                    </g>
                    <DrawPath d={P.UPPER_ARM_LINE} p={armDraw} />
                    <g transform="rotate(-6 500 716)">
                      <g opacity={fill}>
                        <path fill={paper.skinLight} d={P.FOREARM} />
                        <path fill="url(#s1-hatch)" opacity={0.6} d={P.FOREARM_HATCH} />
                        <path fill={paper.skinLight} d={P.FIST} />
                        <path fill={paper.skinLight} d={P.THUMB} />
                      </g>
                      <DrawPath d={P.FOREARM_FIST_LINE} p={prog(t, 3.6, 5.2, ease.inOutSine)} />
                      <DrawPath d={P.THUMB_LINE} p={prog(t, 4.6, 5.3)} width={2.2} />
                      {P.KNUCKLES.map((d, i) => (
                        <DrawPath key={i} d={d} p={prog(t, 4.9, 5.5)} width={1.5} opacity={0.8} />
                      ))}
                    </g>
                  </g>
                </g>
              </Canvas>
            </Sheet>
          </Peel>
        </Peel>
      </AbsoluteFill>
      <AbsoluteFill style={{background: '#000', opacity: dark}} />
    </AbsoluteFill>
  );
};
