// Markdown tables for MEASUREMENTS.md from bake/measure.json (tools/measure.mjs, the comparison
// mode in headless Chrome) and site/compressed.json (tools/compress.mjs).
//   node tools/measure-report.mjs > bake/measure-tables.md
import fs from 'node:fs';
import path from 'node:path';

const M = JSON.parse(fs.readFileSync('bake/measure.json', 'utf8'));
const C = JSON.parse(fs.readFileSync('site/compressed.json', 'utf8'));
const decor = JSON.parse(fs.readFileSync('site/models/decor.json', 'utf8'));
const f2 = (v) => (v == null ? '–' : v.toFixed(2));
const f1 = (v) => (v == null ? '–' : v.toFixed(1));
const CAT = ['textures', 'lightmaps', 'models'];
const sum = (o, keys = CAT) => keys.reduce((a, k) => a + (o[k] || 0), 0);
const out = [];
const p = (s = '') => out.push(s);

// ---- which files each version loads
function files(tier) {
  const L = tier === 'light';
  const tex = Object.entries(C).filter(([k, e]) => e.kind === 'texture' && k.includes('-light') === L);
  const lm = Object.entries(C).filter(([k, e]) => e.kind === 'lightmap' && k.includes('-1k') === L);
  const names = [...Object.values(decor).map((v) => (L ? v.light : v.file)), L ? 'trees-light.glb' : 'trees.glb'];
  const mod = names.map((n) => [`compare/models/${n}`, C[`compare/models/${n}`]]).filter(([, e]) => e);
  return { tex, lm, mod };
}
// GPU bytes of one image: format → bytes per pixel, mipmaps add a third
const gpu = (w, h, bpp, mips) => w * h * bpp * (mips ? 4 / 3 : 1);
function memory(tier) {
  const { tex, lm, mod } = files(tier);
  const r = { jpg: {}, desk: {}, phone: {} };
  const add = (cat, k, v) => { r[k][cat] = (r[k][cat] || 0) + v / 1e6; };
  for (const [k, e] of tex) {
    const alpha = k.endsWith('.png');
    add('textures', 'jpg', gpu(e.width, e.height, 4, true));
    add('textures', 'desk', gpu(e.width, e.height, 1, true));
    add('textures', 'phone', gpu(e.width, e.height, e.mode === 'UASTC' || alpha ? 1 : 0.5, true));
  }
  for (const [, e] of lm) {
    add('lightmaps', 'jpg', gpu(e.width, e.height, 4, false));
    add('lightmaps', 'desk', gpu(e.width, e.height, 1, false));
    add('lightmaps', 'phone', gpu(e.width, e.height, 1, false));
  }
  for (const [, e] of mod) for (const im of e.images) {
    const alpha = im.mime === 'image/png';
    add('models', 'jpg', gpu(im.width, im.height, 4, true));
    add('models', 'desk', gpu(im.width, im.height, 1, true));
    add('models', 'phone', gpu(im.width, im.height, alpha ? 1 : 0.5, true));
  }
  return r;
}
function download(tier) {
  const { tex, lm, mod } = files(tier);
  const s = (list, k) => list.reduce((a, [, e]) => a + e[k], 0) / 1e6;
  return { jpg: { textures: s(tex, 'bytes'), lightmaps: s(lm, 'bytes'), models: s(mod, 'bytes') },
    ktx2: { textures: s(tex, 'ktx2Bytes'), lightmaps: s(lm, 'ktx2Bytes'), models: s(mod, 'ktx2Bytes') } };
}

for (const tier of ['desktop', 'light']) {
  const k = M[`${tier} KTX2`], j = M[`${tier} JPEG/PNG`];
  if (!k || k.error) { p(`(${tier}: no measurement)`); continue; }
  const d = download(tier), m = memory(tier);
  p(`### ${tier === 'desktop' ? 'Desktop (Full)' : 'Light (phones)'} — ${k.canvas.join(' × ')} px, ${k.gpu}`);
  p();
  p('**Download** (MB; the whole tour, every room loaded)');
  p();
  p('| | JPEG / PNG | KTX2 | measured in the browser: JPEG / PNG → KTX2 |');
  p('|---|---|---|---|');
  for (const c of CAT) p(`| ${c} | ${f2(d.jpg[c])} | ${f2(d.ktx2[c])} | ${f2(j && j.download.mb[c])} → ${f2(k.download.mb[c])} |`);
  p(`| **textures + lightmaps + models** | **${f2(sum(d.jpg))}** | **${f2(sum(d.ktx2))}** | ${f2(j && sum(j.download.mb))} → ${f2(sum(k.download.mb))} |`);
  p(`| three.js + decoders, site code | | | ${f2((k.download.mb['three.js'] || 0) + (k.download.mb['site code'] || 0))} |`);
  p();
  p('**GPU memory** (MB)');
  p();
  p('| | JPEG / PNG (RGBA8) | KTX2 on this PC (measured) | KTX2 on a phone (ASTC / ETC, computed) |');
  p('|---|---|---|---|');
  for (const c of CAT) p(`| ${c} | ${f1(j && j.memory.mb[c])} | ${f1(k.memory.mb[c])} | ${f1(m.phone[c])} |`);
  p(`| **total** | **${f1(j && sum(j.memory.mb))}** | **${f1(sum(k.memory.mb))}** | **${f1(sum(m.phone))}** |`);
  p(`| drawing sheets, art, sky (canvas textures, same in both) | ${f1(j && j.memory.mb['drawing, art, sky'])} | ${f1(k.memory.mb['drawing, art, sky'])} | |`);
  p();
  p(`(computed from the files: JPEG / PNG ${f1(sum(m.jpg))} MB, KTX2 on a desktop GPU ${f1(sum(m.desk))} MB.) Formats uploaded here: ${Object.entries(k.memory.formats).map(([a, b]) => `${b} × ${a}`).join(', ')}.`);
  p();
  p(`**GPU time per frame** (ms, median of ${k.light.ldk.baked.n} frames, ${k.light.ldk.baked.method === 'timer' ? 'WebGL2 timer query' : 'render + readPixels'}; shadow map ${k.shadowMap}²)`);
  p();
  p('| Stop | Baked light | Live sun + sky + shadows | Live + 59 lamps | with JPEG / PNG textures: baked |');
  p('|---|---|---|---|---|');
  for (const s of Object.keys(k.light)) p(`| ${s} | **${f2(k.light[s].baked.ms)}** | ${f2(k.light[s].live.ms)} | ${f2(k.light[s].lamps.ms)} | ${f2(j && j.light[s].baked.ms)} |`);
  p();
}
// styling per room, in tour order: what each room's file costs (KTX2 inside), desktop and phone
const ORDER = ['front', 'hall', 'wc', 'office', 'ldk', 'master', 'dressing', 'ensuite', 'kid', 'kidbath', 'garden'];
const size = (f) => (C[`compare/models/${f}`] ? C[`compare/models/${f}`].ktx2Bytes / 1e6 : 0);
p('**Styling, loaded room by room** (MB, KTX2; each file is fetched about one room before the tour gets there)');
p();
p('| Room file | Desktop | Light |');
p('|---|---|---|');
let td = 0, tl = 0;
for (const z of [...ORDER.filter((z) => decor[z]), ...Object.keys(decor).filter((z) => !ORDER.includes(z))]) {
  const d = size(decor[z].file), l = size(decor[z].light); td += d; tl += l;
  p(`| ${z} | ${f2(d)} | ${f2(l)} |`);
}
p(`| trees (loaded at the start) | ${f2(size('trees.glb'))} | ${f2(size('trees-light.glb'))} |`);
p(`| **total** | **${f2(td + size('trees.glb'))}** | **${f2(tl + size('trees-light.glb'))}** |`);
p();
// raw sources
const src = (dir) => { let b = 0; const walk = (d) => { for (const f of fs.readdirSync(d)) { const q = path.join(d, f); const st = fs.statSync(q); if (st.isDirectory()) walk(q); else b += st.size; } }; if (fs.existsSync(dir)) walk(dir); return b / 1e6; };
p(`Raw sources: Poly Haven originals ${f1(src('assets-src/polyhaven'))} MB (assets-src/), bake output before compression: lightmaps ${f2(Object.values(C).filter((e) => e.kind === 'lightmap').reduce((a, e) => a + e.bytes, 0) / 1e6)} MB, models ${f2(Object.values(C).filter((e) => e.kind === 'model').reduce((a, e) => a + e.bytes, 0) / 1e6)} MB.`);
console.log(out.join('\n'));
