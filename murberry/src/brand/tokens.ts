// Murberry brand tokens, copied from the Murberry design system
// (tokens.json) and the approved Ep 1 storyboard.

export const W = 1080;
export const H = 1920;
export const FPS = 30;

export const paper = {
  ochre: '#D6B066',
  sand: '#E8D5B5',
  clay: '#D6A884',
  burnt: '#B5541C',
  // Back faces and edges seen when a sheet curls or tears.
  ochreBack: '#E2C27F',
  sandBack: '#EFE3CC',
  clayBack: '#E3BC98',
  clayLight: '#E0B893',
  tornEdge: '#EAD9BC',
  skin: '#E8D5B5',
  skinLight: '#EEDFC4',
} as const;

export const ink = {
  pencil: '#2A2420',
  muted: '#4A3828',
} as const;

// Muscle states as the storyboard renders them on clay stock:
// named = muscle-named green at 50%, load = muscle-load red at 70%,
// recover = pale gold, always inside a pencil ring.
export const muscle = {
  named: '#9A9A5F',
  namedHatch: '#34501F',
  load: '#C15545',
  loadHatch: '#5A1A12',
  recover: '#E7C48A',
} as const;

export const shadowCss = {
  sheet: '0 6px 14px rgba(42,36,32,0.22)',
  lift: '0 12px 24px rgba(42,36,32,0.24)',
} as const;

export const emboss = {
  highlight: 'rgba(255,246,226,0.55)',
  shadow: 'rgba(58,46,36,0.35)',
} as const;

export const serif = '"EB Garamond", Georgia, "Times New Roman", serif';

export const type = {
  wordmark: {fontSize: 120, lineHeight: 0.95, fontWeight: 500},
  episodeTitle: {fontSize: 72, lineHeight: 1.0, fontWeight: 500},
  beatTitle: {fontSize: 44, lineHeight: 1.1, fontWeight: 500},
  caption: {fontSize: 46, lineHeight: 1.25, fontWeight: 400},
  plateLabel: {fontSize: 28, lineHeight: 1.2, fontWeight: 500},
  figureNote: {fontSize: 24, lineHeight: 1.3, fontWeight: 400},
  sourceLine: {fontSize: 20, lineHeight: 1.3, fontWeight: 400},
} as const;

export const space = {s1: 8, s2: 16, s4: 32, s8: 64} as const;
