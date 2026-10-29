// Try a stop framing: node tools/try-cam.mjs <stop> "x,y,lookX,lookY,lookZ[,fov]" [out.png]
// Prints the framing numbers (wall, largest empty wall patch, ceiling, glass, furniture) and saves a screenshot.
import path from 'node:path';
import { withPage } from './cdp.mjs';
const [, , stop, cam, out = `${process.env.TEMP || '.'}/try-${stop}.png`] = process.argv;
const r = await withPage(`index.html?at=${stop}&cam=${cam}&audit=here`, { w: 1600, h: 900, screenshot: path.resolve(out) });
const line = r.logs.find((l) => l.startsWith('AUDIT '));
if (!line) { console.log(r.logs.join('\n')); process.exit(1); }
const a = JSON.parse(line.slice(6)).here;
const top = Object.entries(a.items).slice(0, 6).map(([k, v]) => `${k} ${v}%`).join(', ');
console.log(`${stop} [${cam}] wall ${a.share.wall || 0}% (one-wall patch ${a.wallBlob}%) · door ${a.share.door || 0}% · ceiling ${a.share.ceiling || 0}% · floor ${a.share.floor || 0}% · glass ${a.share.glass || 0}% · ${top}`);
console.log(out);
