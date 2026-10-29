// The whole house as plain data: meshes per (group, material), pencil lines, door leaves,
// and the placements of the Poly Haven models (styling and trees).
import { MeshBuilder } from './mesh-builder.js';
import { buildArchitecture, doorLeaves, buildLeaf, rectMinus } from './build-arch.js';
import { buildSite } from './build-site.js';
import { furnish } from './furnish.js';
import { buildFixtures } from './lighting.js';
import { buildDecor, treePlacements } from './build-decor.js';
import { packLightmaps } from './lightmap-pack.js';

export function buildWorld() {
  const mb = new MeshBuilder();
  buildArchitecture(mb);
  buildSite(mb);
  furnish(mb, rectMinus);
  buildFixtures(mb);
  const decorModels = buildDecor(mb);
  const leaves = doorLeaves().map((d) => ({ d, mb: buildLeaf(d) }));
  const lightmaps = packLightmaps([mb, ...leaves.map((l) => l.mb)]);
  const world = mb.finish();
  world.doors = leaves.map(({ d, mb: lb }) => ({ ...d, geo: lb.finish() }));
  world.lightmaps = lightmaps;
  world.models = { decor: decorModels, trees: treePlacements() };
  return world;
}
