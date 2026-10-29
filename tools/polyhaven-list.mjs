// Proposed Poly Haven downloads (nothing is downloaded here, only the public file index is read).
// node tools/polyhaven-list.mjs > ASSETS-PROPOSED.md
const TEX = [
  ['oak_wood_planks', 'light oak floor (living rooms, bedrooms, office)', ['Diffuse', 'nor_gl', 'Rough']],
  ['oak_veneer_01', 'light oak joinery and furniture', ['Diffuse', 'nor_gl', 'Rough']],
  ['smoked_walnut_veneer', 'smoked walnut accents (kitchen, shelves, sideboard)', ['Diffuse', 'nor_gl', 'Rough']],
  ['marble_01', 'marble (island, vanity tops, splashback)', ['Diffuse', 'nor_gl', 'Rough']],
  ['white_plaster_02', 'interior lime plaster, walls and ceilings', ['Diffuse', 'nor_gl', 'Rough']],
  ['white_stucco', 'exterior lime render', ['Diffuse', 'nor_gl', 'Rough']],
  ['rough_linen', 'linen weave for sofa, chairs, bedding (colour from the palette)', ['nor_gl', 'Rough']],
  ['poly_wool_herringbone', 'wool rugs', ['Diffuse', 'nor_gl', 'Rough']],
  ['brushed_concrete', 'garage floor and driveway', ['Diffuse', 'nor_gl', 'Rough']],
  ['gravel', 'gravel strip along the facades', ['Diffuse', 'nor_gl', 'Rough']],
  ['leafy_grass', 'lawn (pool terrace milestone)', ['Diffuse', 'nor_gl', 'Rough']],
  ['interior_tiles', 'pool lining tiles, tinted sage (pool terrace milestone)', ['Diffuse', 'nor_gl', 'Rough']],
];
const MOD = [
  ['pachira_aquatica_01', 'large indoor plant, living room'],
  ['potted_plant_01', 'indoor plant'],
  ['potted_plant_04', 'indoor plant'],
  ['calathea_orbifolia_01', 'low plant for sideboard / desk'],
  ['ceramic_vase_01', 'vase'],
  ['ceramic_vase_03', 'vase'],
  ['book_encyclopedia_set_01', 'books for the shelves'],
  ['throw_pillows_01', 'cushions for sofa and bed'],
  ['wooden_bowl_01', 'bowl, kitchen island'],
  ['shrub_01', 'garden shrub (pool terrace milestone)'],
  ['shrub_04', 'garden shrub (pool terrace milestone)'],
];
const MB = (b) => (b / 1e6).toFixed(1);
const get = async (u) => (await fetch(u)).json();
let total = 0;
const rows = [];
for (const [id, use, maps] of TEX) {
  const f = await get(`https://api.polyhaven.com/files/${id}`);
  for (const m of maps) {
    const e = f[m]?.['2k']?.jpg;
    if (!e) continue;
    total += e.size;
    rows.push(`| ${id} — ${m} | ${use} | ${e.url} | ${MB(e.size)} MB |`);
  }
}
for (const [id, use] of MOD) {
  const f = await get(`https://api.polyhaven.com/files/${id}`);
  const g = f.gltf?.['1k']?.gltf;
  if (!g) { rows.push(`| ${id} | ${use} | (no 1k glTF) | — |`); continue; }
  let size = g.size;
  const inc = Object.values(g.include || {});
  for (const x of inc) size += x.size;
  total += size;
  rows.push(`| ${id} (glTF 1k + ${inc.length} files) | ${use} | ${g.url} | ${MB(size)} MB |`);
}
console.log('| File | Used for | URL | Size |\n|---|---|---|---|\n' + rows.join('\n'));
console.log(`\nTotal: ${MB(total)} MB, all CC0 (https://polyhaven.com/license).`);
