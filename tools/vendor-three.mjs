// Copy the parts of three.js the site uses from node_modules into site/vendor/three (so the site
// loads nothing from a CDN). Follows the relative imports of each module.
//   node tools/vendor-three.mjs
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'node_modules/three', OUT = 'site/vendor/three';
const entry = ['build/three.module.js', 'examples/jsm/loaders/GLTFLoader.js', 'examples/jsm/loaders/DRACOLoader.js', 'examples/jsm/loaders/KTX2Loader.js'];
const extra = ['examples/jsm/libs/draco/gltf/draco_decoder.js', 'examples/jsm/libs/draco/gltf/draco_decoder.wasm', 'examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js',
  'examples/jsm/libs/basis/basis_transcoder.js', 'examples/jsm/libs/basis/basis_transcoder.wasm', 'LICENSE'];
const seen = new Set();
function copy(rel) {
  if (seen.has(rel)) return;
  seen.add(rel);
  const from = path.join(SRC, rel), to = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  if (!rel.endsWith('.js')) return;
  const src = fs.readFileSync(from, 'utf8');
  for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]/g)) copy(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1])));
}
fs.rmSync(OUT, { recursive: true, force: true });
for (const e of [...entry, ...extra]) copy(e);
let bytes = 0;
for (const r of seen) bytes += fs.statSync(path.join(OUT, r)).size;
console.log(`${seen.size} files, ${(bytes / 1e6).toFixed(2)} MB → ${OUT}`);
console.log([...seen].join('\n'));
