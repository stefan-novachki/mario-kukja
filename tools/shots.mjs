// Milestone screenshots in one go: node tools/shots.mjs <prefix> [name ...]
// The tour: the opening, each room from above, the descent, the photo stops (cards closed and
// open), the dusk finale, phone views and the plan page with the area schedule.
import path from 'node:path';
import { withPage } from './cdp.mjs';

const SHOTS = [
  ['opening', 'index.html?at=0'],
  ['front', 'index.html?at=front'],
  ['hall', 'index.html?at=hall'],
  ['kid', 'index.html?at=kid'],
  ['master', 'index.html?at=master'],
  ['ensuite', 'index.html?at=ensuite'],
  ['guest', 'index.html?at=guest'],
  ['ldk', 'index.html?at=ldk'],
  ['ldk-notes-open', 'index.html?at=ldk&card=open'],
  ['ldk-from-above', 'index.html?at=ldk-above'],
  ['terrace', 'index.html?at=terrace'],
  ['dusk-finale', 'index.html?at=end'],
  ['phone-opening', 'index.html?at=0&tier=light', 390, 844],
  ['phone-ldk-notes', 'index.html?at=ldk&tier=light&card=open', 390, 844],
  ['plan-page', 'plan.html', 1400, 1000],
];

const [, , prefix = '06', ...only] = process.argv;
let n = 0;
for (const [name, url, w = 1600, h = 900] of SHOTS) {
  n++;
  if (only.length && !only.includes(name)) continue;
  const out = path.resolve('screenshots', `${prefix}-${String(n).padStart(2, '0')}-${name}.png`);
  const r = await withPage(url, { w, h, screenshot: out });
  const errs = r.logs.filter((l) => /EXCEPTION|error/i.test(l));
  console.log(r.ok ? 'ok ' : 'NOT READY', path.basename(out), `${(r.ms / 1000).toFixed(1)} s`, errs.slice(0, 2).join(' | '));
}
