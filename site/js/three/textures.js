// Texture sets from Poly Haven (prepared by tools/prep-textures.py). Every textured material
// starts with flat 1-pixel stand-ins, so its shader never changes: the real maps are swapped
// in when they arrive, in the order the walk needs them. Until then the palette colour shows.
import * as THREE from 'three';
import { loadTexture } from './ktx2.js';

const ORDER = ['cedar', 'render', 'travertine', 'grass', 'concrete', 'oak', 'oakFloor', 'plaster', 'walnut', 'marble', 'linen', 'wool'];
const users = new Map();       // set → [{ m, p }]

function pixel(r, g, b) {
  const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
}
const STAND_IN = { map: pixel(255, 255, 255), normalMap: pixel(128, 128, 255), roughnessMap: pixel(255, 255, 255) };
const SLOT = { diff: 'map', nor: 'normalMap', rough: 'roughnessMap' };

// Called for every material with a texture set: give it the stand-ins now, or the real maps
// if its set is already in (materials made later, e.g. by a room's styling file loaded on the way).
export function registerTextured(m, p) {
  if (!p.tex) return;
  if (!users.has(p.tex)) users.set(p.tex, []);
  users.get(p.tex).push({ m, p });
  m.map = STAND_IN.map;
  m.normalMap = STAND_IN.normalMap;
  m.roughnessMap = STAND_IN.roughnessMap;
  m.normalScale.setScalar(p.nScale ?? 1);
  if (loaded.has(p.tex)) apply(m, p, loaded.get(p.tex));
  else if (ctx && !asked.has(p.tex)) loadSet(p.tex);          // a set nothing needed before
}

const loaded = new Map();      // set → { maps, info } once its files are in
const asked = new Map();       // set → Promise
let ctx = null;                // { manifest, aniso, suffix, renderer } once loading has begun

function apply(m, p, { maps, info }) {
  const rep = 1 / (p.size ?? info.size);
  for (const [k, tex] of Object.entries(maps)) {
    if (!tex) continue;
    const t = tex.clone();             // shares the image; own repeat per material
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rep, rep);
    if (p.rot) t.rotation = (p.rot * Math.PI) / 180;
    t.anisotropy = ctx.aniso;
    t.colorSpace = k === 'diff' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.needsUpdate = true;
    m[SLOT[k]] = t;
  }
  // keep the palette colour: texture × (colour / texture mean) averages to the colour
  if (maps.diff && info.mean) {
    const c = new THREE.Color(p.color);
    m.color.setRGB(c.r / info.mean[0], c.g / info.mean[1], c.b / info.mean[2]);
  }
  if (maps.rough && info.rough) m.roughness = Math.min(2.5, (p.roughness ?? 0.8) / info.rough);
}

function loadSet(set) {
  if (!asked.has(set)) {
    asked.set(set, (async () => {
      const info = ctx.manifest[set];
      if (!info) return 0;
      const ext = (k) => ((info.png || []).includes(k) ? 'png' : 'jpg');
      const maps = Object.fromEntries(await Promise.all(info.maps.map(async (k) => [k, await loadTexture(ctx.renderer, `textures/${set}/${k}${ctx.suffix}.${ext(k)}`)])));
      loaded.set(set, { maps, info });
      for (const { m, p } of users.get(set) || []) apply(m, p, loaded.get(set));
      return info.maps.length;
    })());
  }
  return asked.get(set);
}

export async function loadTextures(renderer, tier) {
  let manifest;
  try { manifest = await (await fetch('textures/textures.json')).json(); } catch { return 0; }
  ctx = { manifest, renderer, aniso: Math.min(renderer.capabilities.getMaxAnisotropy(), tier === 'light' ? 4 : 8), suffix: tier === 'light' ? '-light' : '' };
  let n = 0;
  const sets = [...ORDER.filter((s) => users.has(s)), ...[...users.keys()].filter((s) => !ORDER.includes(s))];
  for (const set of sets) n += await loadSet(set);
  return n;
}
