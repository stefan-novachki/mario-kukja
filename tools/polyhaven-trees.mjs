// Proposed Poly Haven tree downloads (milestone 4), only the public file index is read.
// node tools/polyhaven-trees.mjs > bake/ASSETS-PROPOSED-TREES.md
const MOD = [
  ['tree_small_02', 'garden and street trees (4.6 m, slender trunk, airy crown)'],
  ['island_tree_02', 'low wide tree for the far garden corners (3.4 m high, 8.5 m spread)'],
];
const MB = (b) => (b / 1e6).toFixed(1);
const get = async (u) => (await fetch(u)).json();
let total = 0;
const rows = [];
for (const [id, use] of MOD) {
  const f = await get(`https://api.polyhaven.com/files/${id}`);
  const g = f.gltf['1k'].gltf;
  rows.push(`| ${id}.gltf | ${use} | ${g.url} | ${MB(g.size)} MB |`);
  total += g.size;
  for (const [name, x] of Object.entries(g.include || {})) {
    rows.push(`| ${id} — ${name.split('/').pop()} | | ${x.url} | ${MB(x.size)} MB |`);
    total += x.size;
  }
}
console.log('| File | Used for | URL | Size |\n|---|---|---|---|\n' + rows.join('\n'));
console.log(`\nTotal: ${MB(total)} MB, all CC0 (https://polyhaven.com/license). Source files only: the website gets reduced trees (a few MB).`);
