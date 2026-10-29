// Download the approved Poly Haven lists (bake/ASSETS-PROPOSED.md, bake/ASSETS-PROPOSED-TREES.md)
// into assets-src/polyhaven/ (source files, not part of the website).
// node tools/polyhaven-download.mjs
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'assets-src/polyhaven';
const lists = ['bake/ASSETS-PROPOSED.md', 'bake/ASSETS-PROPOSED-TREES.md'];
const jobs = [];
const models = new Set();
for (const f of lists) {
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const url = /https:\/\/dl\.polyhaven\.org\/\S+/.exec(line)?.[0];
    if (!url) continue;
    const m = /\/(Textures|Models)\/(?:jpg|gltf)\/\dk\/([^/]+)\//.exec(url);
    if (!m) continue;
    if (m[1] === 'Models') { models.add(m[2]); continue; }
    jobs.push({ url, to: path.join(OUT, 'textures', m[2], url.split('/').pop()) });
  }
}
for (const id of models) {
  const f = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
  const g = f.gltf['1k'].gltf;
  jobs.push({ url: g.url, to: path.join(OUT, 'models', id, g.url.split('/').pop()), size: g.size });
  for (const [rel, x] of Object.entries(g.include || {})) jobs.push({ url: x.url, to: path.join(OUT, 'models', id, rel), size: x.size });
}
let done = 0, bytes = 0;
async function get(j) {
  if (fs.existsSync(j.to) && (!j.size || fs.statSync(j.to).size === j.size)) { done++; return; }
  fs.mkdirSync(path.dirname(j.to), { recursive: true });
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(j.url);
      if (!r.ok) throw new Error(`${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(j.to, buf);
      bytes += buf.length; done++;
      return;
    } catch (e) { if (t === 2) console.log('FAILED', j.url, e.message); }
  }
}
const queue = [...jobs];
await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await get(queue.shift()); }));
console.log(`${done}/${jobs.length} files, ${(bytes / 1e6).toFixed(1)} MB downloaded into ${OUT}`);
