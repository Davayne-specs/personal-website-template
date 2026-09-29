import {Config} from '@remotion/cli/config';

// Render with the headless shell that ships in this environment when present;
// elsewhere Remotion downloads its own.
import {existsSync} from 'node:fs';
const shell = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (existsSync(shell)) {
  Config.setBrowserExecutable(shell);
}
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setConcurrency(4);
