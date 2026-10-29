// Headless Chrome screenshot: node tools/shot.mjs <url-path> <out.png> <w> <h> [timeoutMs]
// Waits until the page is ready (all textures, lightmaps and baked styling loaded), prints its console.
import path from 'node:path';
import { withPage } from './cdp.mjs';
const [, , urlPath, out, w = '1600', h = '1200', timeout = '120000'] = process.argv;
const r = await withPage(urlPath, { w: +w, h: +h, timeout: +timeout, screenshot: path.resolve(out) });
console.log(r.ok ? 'ok' : 'NOT READY', `${(r.ms / 1000).toFixed(1)} s`, path.basename(out));
const msgs = r.logs.filter((l) => !/X4122|cannot be represented/.test(l));
if (msgs.length) console.log(msgs.slice(0, 12).map((l) => l.slice(0, 400)).join('\n'));
