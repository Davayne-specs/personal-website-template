import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

const faces: [string, string, string][] = [
  ['Anton', 'anton-latin-400-normal.woff2', '400'],
  ['Bricolage Grotesque', 'bricolage-grotesque-latin-500-normal.woff2', '500'],
  ['Bricolage Grotesque', 'bricolage-grotesque-latin-700-normal.woff2', '700'],
  ['Bricolage Grotesque', 'bricolage-grotesque-latin-800-normal.woff2', '800'],
  ['Space Mono', 'space-mono-latin-400-normal.woff2', '400'],
  ['Space Mono', 'space-mono-latin-700-normal.woff2', '700'],
  ['Caveat', 'caveat-latin-500-normal.woff2', '500'],
  ['Caveat', 'caveat-latin-700-normal.woff2', '700'],
];

let started = false;
export const loadBrandFonts = () => {
  if (started) return;
  started = true;
  for (const [family, file, weight] of faces) {
    loadFont({family, url: staticFile(`fonts/${file}`), weight, format: 'woff2'});
  }
};
