// Materials for the real side of each surface (the drawing side lives in sketch-shader.js).
// Variants: vlight = light baked per vertex (styling, trees), leaf = cut-out leaves.
import * as THREE from 'three';
import { sketchify } from './sketch-shader.js';
import { PALETTE } from './palette.js';
import { registerTextured } from './textures.js';
import { artTexture, isArt } from './art.js';

export { PALETTE };

const cache = new Map();
export function material(name, { vlight = false } = {}) {
  const key = `${name}${vlight ? '|vl' : ''}`;
  if (cache.has(key)) return cache.get(key);
  const p = PALETTE[name] || { color: '#ff00ff' };
  const glassy = !!p.transparent;
  const m = new THREE.MeshStandardMaterial({
    color: p.color, roughness: p.roughness ?? 0.8, metalness: p.metalness ?? 0,
    emissive: p.emissive ?? '#000000', emissiveIntensity: p.emissiveIntensity ?? 0,
    transparent: glassy, opacity: p.opacity ?? 1, depthWrite: !glassy,
    polygonOffset: !glassy, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
  registerTextured(m, p);
  if (isArt(name)) { m.map = artTexture(name); m.color.set('#ffffff'); }
  if (p.alpha) { m.alphaTest = 0.5; m.side = THREE.DoubleSide; }       // cut-out leaves
  sketchify(m, { glass: glassy, vlight, leaf: !!p.alpha });
  m.name = name;
  cache.set(key, m);
  return m;
}

// A Poly Haven model's own material (from its glTF), on the same drawing → real shader.
export function modelMaterial(src, { leaf = false } = {}) {
  const key = `ph|${src.name}|${leaf}`;
  if (cache.has(key)) return cache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color: src.color, map: src.map, normalMap: src.normalMap, roughnessMap: src.roughnessMap, metalnessMap: src.metalnessMap,
    roughness: Math.max(0.35, src.roughness), metalness: 0, side: leaf ? THREE.DoubleSide : THREE.FrontSide,
    alphaTest: leaf ? 0.5 : 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
  if (src.normalMap) m.normalScale.copy(src.normalScale);
  sketchify(m, { vlight: true, leaf });
  m.name = src.name;
  cache.set(key, m);
  return m;
}
