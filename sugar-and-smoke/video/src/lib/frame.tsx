// PrintFrame: prints its children as three riso plates (sticker shadow, ghost, key)
// on a paper stock, through a camera.
import React from 'react';
import {C, Ground, STICKER} from '../brand/tokens';
import {PrintCtx, PrintDefs} from './print';

export type Camera = {x?: number; y?: number; zoom?: number; rotate?: number};

export const camTransform = (cam: Camera, w: number, h: number) => {
  const z = cam.zoom ?? 1;
  const cx = w / 2;
  const cy = h / 2;
  return `translate(${cx + (cam.x ?? 0)},${cy + (cam.y ?? 0)}) scale(${z}) rotate(${cam.rotate ?? 0}) translate(${-cx},${-cy})`;
};

export const PrintFrame: React.FC<{
  frame: number;
  ground: Ground | 'none';
  reg?: [number, number]; // ghost-plate offset from the key drawing
  boilStep?: number; // frames per boil drawing
  sheen?: number; // foil sheen band position (0..1 sweeps; <0 off)
  camera?: Camera;
  width?: number;
  height?: number;
  children: React.ReactNode;
  under?: React.ReactNode; // printed behind everything, outside the camera (e.g. full-bleed washes)
}> = ({frame, ground, reg = [2, -1.5], boilStep = 3, sheen = -1, camera = {}, width = 1080, height = 1920, children, under}) => {
  const boil = Math.floor(frame / boilStep) % 3;
  const line = ground === 'night' ? C.cotton : C.ink;
  const base = {boil, line, frame};
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{position: 'absolute', left: 0, top: 0}}>
      <PrintDefs sheen={sheen} />
      {ground !== 'none' && <rect width={width} height={height} fill={C[ground]} />}
      {under ? (
        <PrintCtx.Provider value={{...base, plate: 'key'}}>{under}</PrintCtx.Provider>
      ) : null}
      <g transform={camTransform(camera, width, height)}>
        <g transform={`translate(${reg[0] + STICKER.dx},${reg[1] + STICKER.dy})`} opacity={ground === 'night' ? 0.32 : STICKER.opacity}>
          <PrintCtx.Provider value={{...base, plate: 'shadow'}}>{children}</PrintCtx.Provider>
        </g>
        <g transform={`translate(${reg[0]},${reg[1]})`}>
          <PrintCtx.Provider value={{...base, plate: 'ghost'}}>{children}</PrintCtx.Provider>
        </g>
        <PrintCtx.Provider value={{...base, plate: 'key'}}>{children}</PrintCtx.Provider>
      </g>
    </svg>
  );
};
