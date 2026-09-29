import {continueRender, delayRender, staticFile} from 'remotion';

// EB Garamond (SIL Open Font License, see public/fonts/OFL.txt).
const faces = [
  {weight: '400', style: 'normal', file: 'fonts/eb-garamond-latin-400-normal.woff2'},
  {weight: '500', style: 'normal', file: 'fonts/eb-garamond-latin-500-normal.woff2'},
  {weight: '400', style: 'italic', file: 'fonts/eb-garamond-latin-400-italic.woff2'},
  {weight: '500', style: 'italic', file: 'fonts/eb-garamond-latin-500-italic.woff2'},
];

let started = false;

export const loadFonts = () => {
  if (started || typeof document === 'undefined') return;
  started = true;
  const handle = delayRender('Loading EB Garamond');
  Promise.all(
    faces.map((f) =>
      new FontFace('EB Garamond', `url(${staticFile(f.file)}) format('woff2')`, {
        weight: f.weight,
        style: f.style,
      })
        .load()
        .then((face) => (document.fonts as unknown as {add: (f: FontFace) => void}).add(face)),
    ),
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error('Font load failed', err);
      continueRender(handle);
    });
};
