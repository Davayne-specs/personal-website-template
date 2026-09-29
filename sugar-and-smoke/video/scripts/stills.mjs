// Render a list of frames as PNGs, plus a contact sheet.
// usage: node scripts/stills.mjs <outDir> <frame> [frame...]   (frames can be "slot:N:0.5" = 50% into scene N)
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync} from 'node:fs';
import path from 'node:path';

const [outDir, ...args] = process.argv.slice(2);
mkdirSync(outDir, {recursive: true});
const shell = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const serveUrl = process.env.BUNDLE ?? (await bundle({entryPoint: path.resolve('src/index.ts')}));
const browser = await openBrowser('chrome', {browserExecutable: existsSync(shell) ? shell : undefined});
const comp = await selectComposition({serveUrl, id: 'GiveMeLife', inputProps: {audio: false}, puppeteerInstance: browser});
const slots = JSON.parse(process.env.SLOTS ?? '[]');
const frames = args.map((a) => {
  if (!a.startsWith('slot:')) return Number(a);
  const [, n, frac] = a.split(':');
  const s = slots.find((x) => x.n === Number(n));
  return Math.round(s.from + (s.to - s.from) * Number(frac));
});
const files = [];
for (const frame of frames) {
  const output = path.join(outDir, `f${String(frame).padStart(5, '0')}.png`);
  await renderStill({composition: comp, serveUrl, output, frame, inputProps: {audio: false}, puppeteerInstance: browser, overwrite: true});
  files.push(output);
}
await browser.close({silent: true});
console.log(files.join('\n'));
