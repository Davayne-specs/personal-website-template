// Render a list of stills from one bundle: node scripts/stills.mjs <scale> <seconds...>
// Frames land in out/frames/t<seconds>.png.
import path from 'node:path';
import fs from 'node:fs';
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';

const [scaleArg, ...times] = process.argv.slice(2);
const scale = Number(scaleArg ?? 0.5);
const shell = process.env.REMOTION_BROWSER ?? '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const browser = await openBrowser('chrome', fs.existsSync(shell) ? {browserExecutable: shell} : {});
const inputProps = {withAudio: false, offset: 0};
const composition = await selectComposition({serveUrl, id: 'Ep01', puppeteerInstance: browser, inputProps});
fs.mkdirSync('out/frames', {recursive: true});
for (const s of times) {
  const frame = Math.round(Number(s) * composition.fps);
  const output = `out/frames/t${s}.png`;
  await renderStill({composition, serveUrl, output, frame, scale, puppeteerInstance: browser, inputProps, imageFormat: 'png'});
  console.log(output);
}
await browser.close({silent: true});
