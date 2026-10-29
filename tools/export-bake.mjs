// Export the house for the light bake: bake/house.glb (same geometry and lightmap UVs as the
// website), bake/lamps.json (light sources), bake/atlases.json, bake/placements.json (Poly Haven
// styling and trees) and bake/palette.json (material colours for Blender).
// node tools/export-bake.mjs
import fs from 'node:fs';
import { buildWorld } from '../site/js/world/build-world.js';
import { CLOSED_DOORS } from '../site/js/world/build-arch.js';
import { LAMPS, kelvinRGB } from '../site/js/world/lighting.js';
import { ATLASES } from '../site/js/world/lightmap-pack.js';
import { PALETTE } from '../site/js/three/palette.js';
import { ZONES } from '../site/js/world/zones.js';

const toLin = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
};
const atlasOf = (group) => Object.keys(ATLASES).find((k) => ATLASES[k].groups.includes(group));

const world = buildWorld();
const bin = [];
let byteLen = 0;
const gltf = { asset: { version: '2.0', generator: 'kukja-mario export-bake' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [] };
const matIndex = new Map();

function accessor(arr, type, withMinMax = false) {
  const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  const pad = (4 - (byteLen % 4)) % 4;
  if (pad) { bin.push(Buffer.alloc(pad)); byteLen += pad; }
  gltf.bufferViews.push({ buffer: 0, byteOffset: byteLen, byteLength: buf.length });
  bin.push(buf); byteLen += buf.length;
  const comps = { VEC3: 3, VEC2: 2 }[type];
  const acc = { bufferView: gltf.bufferViews.length - 1, componentType: 5126, count: arr.length / comps, type };
  if (withMinMax) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < arr.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], arr[i + k]); max[k] = Math.max(max[k], arr[i + k]); }
    acc.min = min; acc.max = max;
  }
  gltf.accessors.push(acc);
  return gltf.accessors.length - 1;
}

function material(group, mat) {
  const key = `${group}|${mat}`;
  if (matIndex.has(key)) return matIndex.get(key);
  const p = PALETTE[mat] || { color: '#ff00ff' };
  const c = toLin(p.color);
  const m = { name: key, pbrMetallicRoughness: { baseColorFactor: [...c, p.transparent ? p.opacity : 1], metallicFactor: p.metalness ?? 0, roughnessFactor: p.roughness ?? 0.8 } };
  if (p.transparent) m.alphaMode = 'BLEND';
  gltf.materials.push(m);
  matIndex.set(key, gltf.materials.length - 1);
  return gltf.materials.length - 1;
}

function splitByZone(m) {
  const tris = m.position.length / 9, by = new Map();
  for (let t = 0; t < tris; t++) { const z = m.info[t * 6]; if (!by.has(z)) by.set(z, []); by.get(z).push(t); }
  const out = [];
  for (const [z, list] of by) {
    const pick = (arr, k) => { const o = new Float32Array(list.length * 3 * k); list.forEach((t, i) => o.set(arr.subarray(t * 3 * k, t * 3 * k + 3 * k), i * 3 * k)); return o; };
    out.push([z, { ...m, position: pick(m.position, 3), normal: pick(m.normal, 3), uv: pick(m.uv, 2), info: pick(m.info, 2), uv2: null }]);
  }
  return out;
}

function addMesh(m, name, node = {}) {
  const attributes = { POSITION: accessor(m.position, 'VEC3', true), NORMAL: accessor(m.normal, 'VEC3'), TEXCOORD_0: accessor(m.uv, 'VEC2') };
  if (m.uv2) attributes.TEXCOORD_1 = accessor(m.uv2, 'VEC2');
  gltf.meshes.push({ name, primitives: [{ attributes, material: material(m.group, m.mat), mode: 4 }] });
  gltf.nodes.push({ name, mesh: gltf.meshes.length - 1, ...node });
  gltf.scenes[0].nodes.push(gltf.nodes.length - 1);
}

// object names tell the bake script what to do: B|atlas|group|mat (bake into atlas),
// V|decor|mat (bake light per vertex) or N|group|mat (only casts shadows, bounces light)
for (const m of world.meshes) {
  const baked = m.uv2 && m.uv2.some((v) => v >= 0);
  if (m.group === 'decor') {                     // one mesh per room, so rooms can load one by one
    for (const [z, part] of splitByZone(m)) addMesh(part, `V|decor|${ZONES[z]}|${m.mat}`);
    continue;
  }
  addMesh(m, baked ? `B|${atlasOf(m.group)}|${m.group}|${m.mat}` : `N|${m.group}|${m.mat}`);
}
for (const d of world.doors) {
  const a = d.closedAngle + d.turn * (Math.PI / 2) * (CLOSED_DOORS.includes(d.id) ? 0 : 1);
  for (const m of d.geo.meshes) {
    const baked = m.uv2 && m.uv2.some((v) => v >= 0);
    addMesh(m, `${baked ? 'B|arch' : 'N'}|door${d.id}|${m.mat}`, { translation: [d.hinge[0], 0, -d.hinge[1]], rotation: [0, Math.sin(a / 2), 0, Math.cos(a / 2)] });
  }
}

const body = Buffer.concat(bin);
gltf.buffers.push({ byteLength: body.length });
let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const binPad = Buffer.concat([body, Buffer.alloc((4 - (body.length % 4)) % 4)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + json.length + 8 + binPad.length, 8);
const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
fs.mkdirSync('bake', { recursive: true });
fs.writeFileSync('bake/house.glb', Buffer.concat([header, ch(json.length, 0x4e4f534a), json, ch(binPad.length, 0x004e4942), binPad]));

// light sources in Blender coordinates (= plan metres, z up)
const lamps = LAMPS.map((l) => {
  const col = kelvinRGB(l.k);
  const base = { id: l.id, color: col, power: l.w };
  switch (l.kind) {
    case 'pendant': return { ...base, type: 'POINT', at: [l.x, l.y, l.z - 0.03], radius: 0.07 };
    case 'globe': return { ...base, type: 'POINT', at: [l.x, l.y, l.z + 0.09], radius: 0.08 };
    case 'drum': return { ...base, type: 'POINT', at: [l.x, l.y, l.z + 0.11], radius: 0.15 };
    case 'table': return { ...base, type: 'POINT', at: [l.x, l.y, l.z + 0.42], radius: 0.1 };
    case 'floor': return { ...base, type: 'POINT', at: [l.x, l.y, 1.45], radius: 0.12 };
    case 'wall': return { ...base, type: 'POINT', at: [l.x, l.y + (l.dir === 'N' ? 0.1 : -0.1), l.z - 0.1], radius: 0.05 };
    case 'dome': return { ...base, type: 'SPOT', at: [l.x, l.y, l.z + 0.05], aim: 'down', angle: 140, radius: 0.08 };
    case 'post': return { ...base, type: 'POINT', at: [l.x, l.y, l.z - 0.04], radius: 0.05 };
    case 'bollard': return { ...base, type: 'POINT', at: [l.x, l.y, l.z - 0.07], radius: 0.05 };
    case 'pool': return { ...base, type: 'POINT', at: [l.x, l.y, l.z], radius: 0.1 };
    case 'fire': return { ...base, type: 'POINT', at: [l.x, l.y, l.z], radius: 0.25 };
    case 'desklamp': return { ...base, type: 'SPOT', at: [l.x, l.y + 0.12, l.z + 0.36], aim: 'down', angle: 100, radius: 0.03 };
    case 'down': return { ...base, power: l.w * 2.5, type: 'SPOT', at: [l.x, l.y, l.z - 0.02], aim: 'down', angle: 90, radius: 0.04 };
    case 'uplight': return { ...base, type: 'SPOT', at: [l.x, l.y, 0.12], aim: 'up', angle: 85, radius: 0.04 };
    case 'linear': return { ...base, type: 'AREA', at: [l.x, l.y, l.z - 0.01], aim: 'down', size: [l.len, 0.05] };
    case 'strip': return { ...base, type: 'AREA', at: [l.x, l.y, l.z - 0.01], aim: 'down', size: l.along === 'y' ? [0.03, l.len] : [l.len, 0.03] };
    case 'mirror': return { ...base, type: 'AREA', at: [l.x, l.y, l.z], aim: { E: '+x', W: '-x', N: '+y', S: '-y' }[l.dir], size: [l.len, 0.03] };
    default: return null;
  }
}).filter(Boolean);
fs.writeFileSync('bake/lamps.json', JSON.stringify(lamps, null, 1));
fs.writeFileSync('bake/placements.json', JSON.stringify({ decor: world.models.decor.map((p) => ({ ...p, zoneName: ZONES[p.zone] })), trees: world.models.trees }, null, 1));
fs.writeFileSync('bake/palette.json', JSON.stringify(Object.fromEntries(Object.entries(PALETTE).map(([k, p]) => [k, { color: toLin(p.color), roughness: p.roughness ?? 0.8 }]))));
fs.writeFileSync('bake/charts.json', JSON.stringify(Object.fromEntries(Object.entries(world.lightmaps).map(([k, v]) => [k, v.placements]))));
fs.writeFileSync('bake/atlases.json', JSON.stringify(Object.fromEntries(Object.entries(world.lightmaps).map(([k, v]) => [k, v])), null, 1));
console.log(`bake/house.glb ${(fs.statSync('bake/house.glb').size / 1e6).toFixed(1)} MB, ${gltf.meshes.length} meshes, ${lamps.length} lamps, ${world.models.decor.length} styling models, ${world.models.trees.length} trees`, JSON.stringify(world.lightmaps));
