// Styling and trees with their light baked per vertex in Blender (tools/blender/bake.py).
// Styling comes as one file per room (models/decor.json lists them; phones get lighter files
// where there are any), loaded one room ahead of the camera. Trees: models/trees[-light].glb.
// Each vertex gets its zone (drawing → real wave) and the furniture it belongs to (framing
// check); COLOR_0 holds the baked light, encoded like the lightmaps.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { material, modelMaterial, PALETTE } from './materials.js';
import { zoneAt } from '../world/zones.js';
import { ITEMS } from '../plan-data.js';
import { itemCode } from '../world/furnish.js';
import { DECOR_CODE } from '../world/build-decor.js';
import { ktx2Loader, useKtx2 } from './ktx2.js';

const draco = new DRACOLoader().setDecoderPath(new URL('../../vendor/three/examples/jsm/libs/draco/gltf/', import.meta.url).href);
const loader = new GLTFLoader().setDRACOLoader(draco);
export const gltfLoader = loader;

function prepare(mesh, kind, url) {
  mesh.updateWorldMatrix(true, false);
  const g = mesh.geometry;
  g.applyMatrix4(mesh.matrixWorld);
  const pos = g.attributes.position, n = pos.count;
  const info = new Float32Array(n * 2), item = new Float32Array(n), lm = new Float32Array(n * 3).fill(-1);
  const boxes = kind === 1 ? ITEMS.map((it) => [it.r, (it.h ?? 1.2) + 0.5, itemCode(it)]) : [];
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = -pos.getZ(i), z = pos.getY(i);
    info[i * 2] = zoneAt(x, y);
    info[i * 2 + 1] = kind;
    let code = kind === 1 ? DECOR_CODE : 0;
    for (const [r, h, c] of boxes) if (x > r[0] - 0.03 && x < r[2] + 0.03 && y > r[1] - 0.03 && y < r[3] + 0.03 && z < h) { code = c; break; }
    item[i] = code;
  }
  g.setAttribute('aInfo', new THREE.BufferAttribute(info, 2));
  g.setAttribute('aItem', new THREE.BufferAttribute(item, 1));
  g.setAttribute('aLm', new THREE.BufferAttribute(lm, 3));
  const col = g.getAttribute('color');
  if (col) { g.setAttribute('aVL', col); g.deleteAttribute('color'); }
  else g.setAttribute('aVL', new THREE.BufferAttribute(new Float32Array(n * 4).fill(0.3), 4));
  const src = mesh.material;
  for (const v of Object.values(src)) if (v && v.isTexture) v.userData.src = url;
  const name = src.name.replace(/\.\d+$/, '');
  const own = PALETTE[name];
  const leaf = /lea(f|ves)/i.test(src.name) || src.alphaTest > 0 || src.transparent;
  const m = own ? material(name, { vlight: true }) : modelMaterial(src, { leaf });
  const out = new THREE.Mesh(g, m);
  out.userData = { mat: m.name, group: kind === 1 ? 'decor' : 'tree', baked: true };
  return out;
}

async function load(url, kind) {
  const gltf = await loader.loadAsync(url);
  const meshes = [];
  gltf.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
  return meshes.map((m) => prepare(m, kind, url));
}

// → { zones: [names], zone(name) → Promise<meshes>, trees: Promise<meshes> } or null without a bake
export async function openBakedDecor(tier, renderer) {
  loader.setKTX2Loader(ktx2Loader(renderer));
  const dir = useKtx2 ? 'models' : 'compare/models';      // ?tex=jpg: the originals with JPEG / PNG inside
  let list;
  try { list = await (await fetch('models/decor.json')).json(); } catch { return null; }
  const asked = new Map();
  return {
    zones: Object.keys(list),
    bytesFor: (name) => list[name],
    zone(name) {
      if (!asked.has(name)) asked.set(name, load(`${dir}/${list[name][tier === 'light' ? 'light' : 'file']}`, 1).catch(() => []));
      return asked.get(name);
    },
    trees: load(`${dir}/trees${tier === 'light' ? '-light' : ''}.glb`, 2).catch(() => []),
  };
}
