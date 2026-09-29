import React from 'react';
import {AbsoluteFill, staticFile} from 'remotion';
import {H, W} from '../brand/tokens';

export const grainUrl = () => staticFile('grain.png');

/** Soft-light paper grain, as in the storyboard. */
export const Grain: React.FC<{opacity?: number; offset?: number}> = ({
  opacity = 0.85,
  offset = 0,
}) => (
  <AbsoluteFill
    style={{
      backgroundImage: `url(${grainUrl()})`,
      backgroundSize: '512px 512px',
      backgroundPosition: `${offset}px ${offset * 0.6}px`,
      mixBlendMode: 'soft-light',
      opacity,
      pointerEvents: 'none',
    }}
  />
);

/** A full-frame sheet of paper stock with its own grain. */
export const Sheet: React.FC<{
  color: string;
  children?: React.ReactNode;
  grain?: boolean;
  grainOffset?: number;
  style?: React.CSSProperties;
}> = ({color, children, grain = true, grainOffset = 0, style}) => (
  <AbsoluteFill style={{background: color, isolation: 'isolate', overflow: 'hidden', ...style}}>
    {children}
    {grain ? <Grain offset={grainOffset} /> : null}
  </AbsoluteFill>
);

/** Full-frame SVG canvas in storyboard coordinates. */
export const Canvas: React.FC<{
  children?: React.ReactNode;
  style?: React.CSSProperties;
  width?: number;
  height?: number;
}> = ({children, style, width = W, height = H}) => (
  <svg
    width={width}
    height={height}
    viewBox={`0 0 ${width} ${height}`}
    style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', ...style}}
  >
    {children}
  </svg>
);

/** One soft overhead light: a faint falloff toward the lower corners. */
export const OverheadLight: React.FC<{strength?: number}> = ({strength = 1}) => (
  <AbsoluteFill
    style={{
      background:
        'radial-gradient(ellipse 120% 85% at 50% 18%, rgba(255,248,232,0.10) 0%, rgba(255,248,232,0) 45%, rgba(42,36,32,0.16) 100%)',
      mixBlendMode: 'multiply',
      opacity: strength,
      pointerEvents: 'none',
    }}
  />
);

/** Standard hatch patterns used across scenes, prefixed per SVG. */
export const HatchDefs: React.FC<{id: string}> = ({id}) => (
  <defs>
    <pattern id={`${id}-hatch`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
      <line x1="0" y1="0" x2="0" y2="8" stroke="#2A2420" strokeWidth="1.2" />
    </pattern>
    <pattern id={`${id}-hair`} width="4.5" height="4.5" patternUnits="userSpaceOnUse" patternTransform="rotate(-62)">
      <line x1="0" y1="0" x2="0" y2="4.5" stroke="#2A2420" strokeWidth="1.5" />
    </pattern>
    <pattern id={`${id}-section`} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="22" stroke="#2A2420" strokeWidth="1" />
    </pattern>
    <pattern id={`${id}-section14`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="14" stroke="#2A2420" strokeWidth="1" />
    </pattern>
    <pattern id={`${id}-open`} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
      <line x1="0" y1="0" x2="0" y2="10" stroke="#34501F" strokeWidth=".9" />
    </pattern>
    <pattern id={`${id}-x1`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="#5A1A12" strokeWidth=".9" />
    </pattern>
    <pattern id={`${id}-x2`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="#5A1A12" strokeWidth=".9" />
    </pattern>
    <pattern id={`${id}-lat`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(60)">
      <line x1="0" y1="0" x2="0" y2="7" stroke="#2A2420" strokeWidth=".6" />
    </pattern>
    <pattern id={`${id}-ink1`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)">
      <line x1="0" y1="0" x2="0" y2="7" stroke="#2A2420" strokeWidth="1.2" />
    </pattern>
    <pattern id={`${id}-ink2`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
      <line x1="0" y1="0" x2="0" y2="7" stroke="#2A2420" strokeWidth="1.2" />
    </pattern>
  </defs>
);
