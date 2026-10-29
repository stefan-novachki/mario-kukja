// Numbers for MEASUREMENTS.md from the hidden comparison mode (index.html?compare=1):
// desktop (1600 × 900) and the light version at a phone's pixel count (390 × 844 at 1.5×),
// each with KTX2 and with JPEG / PNG textures.   node tools/measure.mjs [frames] [desktop|light]
import fs from 'node:fs';
import { withPage } from './cdp.mjs';
const [, , frames = '120', only] = process.argv;
const runs = [
  ['desktop', 'KTX2', 'tier=desktop', 1600, 900, 1], ['desktop', 'JPEG/PNG', 'tier=desktop&tex=jpg', 1600, 900, 1],
  ['light', 'KTX2', 'tier=light', 390, 844, 1.5], ['light', 'JPEG/PNG', 'tier=light&tex=jpg', 390, 844, 1.5],
].filter((r) => !only || r[0] === only);
const out = {};
for (const [tier, tex, q, w, h, dpr] of runs) {
  const r = await withPage(`index.html?compare=1&frames=${frames}&${q}`, { w, h, dpr, timeout: 600000, waitFor: "document.body.dataset.compared === '1'", settle: 0,
    screenshot: `screenshots/06-compare-${tier === 'light' ? 'phone' : tier}-${tex === 'KTX2' ? 'ktx2' : 'jpg'}.png` });
  const line = r.logs.find((l) => l.startsWith('COMPARE '));
  out[`${tier} ${tex}`] = line ? JSON.parse(line.slice(8)) : { error: r.logs.filter((l) => /error|fail/i.test(l)).slice(0, 5) };
  const x = out[`${tier} ${tex}`];
  console.log(tier, tex, x.error ? x.error : `${x.canvas.join('x')} light ${JSON.stringify(x.light.ldk)} download ${JSON.stringify(x.download.mb)} memory ${JSON.stringify(x.memory.mb)} ${JSON.stringify(x.memory.formats)}`);
}
fs.writeFileSync(`bake/measure${only ? '-' + only : ''}.json`, JSON.stringify(out, null, 1));
