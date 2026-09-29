// Sugar & Smoke brand tokens. Values mirror the series bible's Palette section.

export const W = 1080;
export const H = 1920;
export const FPS = 30;

export const C = {
  // paper stocks
  cotton: '#FBF3EA',
  blush: '#F6D5E0',
  mint: '#D2ECE7',
  night: '#241D31',
  // inks
  ink: '#231B2E',
  candy: '#F2A5C0',
  hotpink: '#E8488A',
  aqua: '#8ED3C9',
  teal: '#1E7F7C',
  smoke: '#B3BCBD',
  ash: '#626A6D',
  gold: '#C9A15A',
  goldHi: '#F6E1A6',
  goldLo: '#7E5E27',
  pressure: '#C92F42',
  release: '#EFDDA6',
  // character stocks (not spot inks)
  steinSkin: '#6A4330',
  preciousSkin: '#8E5C3F',
  jogger: '#2F2740',
  white: '#FFFCF6',
  // No. 2 accents, from the "With You" cover
  frost: '#E8EEF2',
  dusk: '#222A38',
  ice: '#A9CFE4',
  iceInk: '#4E8FB9',
  slate: '#5A5E6D',
  amber: '#E8B566',
} as const;

export type Ground = 'cotton' | 'blush' | 'mint' | 'night' | 'frost' | 'dusk';
export const isDark = (g: string) => g === 'night' || g === 'dusk';
export type StateName = 'Memory' | 'Absence' | 'Precious' | 'Pressure' | 'Release' | 'Present';

// Sticker shadow: ink at 18%, 8px right, 10px down, no blur.
export const STICKER = {dx: 8, dy: 10, opacity: 0.18};

export const FONT = {
  stamp: 'Anton',
  lyric: 'Bricolage Grotesque',
  tag: 'Space Mono',
  hand: 'Caveat',
};

// How far the fill plate sits off the key line, per state (px at 1080 wide).
export const REGISTRATION: Record<StateName, [number, number]> = {
  Memory: [10, -7],
  Absence: [6, -4],
  Present: [2.5, -1.5],
  Precious: [2, -1.5],
  Pressure: [3.5, -2],
  Release: [0, 0],
};

export const TAG_STOCK: Record<StateName, {bg: string; fg: string}> = {
  Memory: {bg: C.blush, fg: C.ink},
  Absence: {bg: '#DCE2E2', fg: C.ink},
  Present: {bg: C.white, fg: C.ink},
  Precious: {bg: C.goldHi, fg: C.ink},
  Pressure: {bg: C.pressure, fg: C.white},
  Release: {bg: C.release, fg: C.ink},
};
