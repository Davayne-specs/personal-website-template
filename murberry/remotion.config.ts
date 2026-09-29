import fs from 'node:fs';
import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
Config.setCodec('h264');
Config.setCrf(18);
Config.setPixelFormat('yuv420p');

// Use a locally installed headless Chromium when one is present, so renders
// don't need to download a browser. Override with REMOTION_BROWSER.
const localShell =
  process.env.REMOTION_BROWSER ??
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (fs.existsSync(localShell)) {
  Config.setBrowserExecutable(localShell);
}
