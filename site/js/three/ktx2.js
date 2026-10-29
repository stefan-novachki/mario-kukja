// GPU-compressed textures (KTX2, Basis Universal; made by tools/compress.mjs). The transcoder runs
// in workers and turns each file into a format this GPU reads directly: BC7 on desktops, ASTC or
// ETC on phones, so a texture takes 4–8× less GPU memory than a JPEG. site/compressed.json lists
// what has a KTX2 version; ?tex=jpg loads the JPEG / PNG originals instead (comparison mode).
import * as THREE from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

export const useKtx2 = new URLSearchParams(location.search).get('tex') !== 'jpg';
let ktx2 = null, list = null;
const imgLoader = new THREE.TextureLoader();

export function ktx2Loader(renderer) {
  if (!ktx2) ktx2 = new KTX2Loader().setTranscoderPath(new URL('../../vendor/three/examples/jsm/libs/basis/', import.meta.url).href).detectSupport(renderer);
  return ktx2;
}

export function compressedList() {
  if (!list) list = fetch('compressed.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return list;
}

// path of a JPEG / PNG under site/ → its texture (KTX2 when there is one), or null if missing
export async function loadTexture(renderer, path) {
  const entry = useKtx2 ? (await compressedList())[path] : null;
  const t = await new Promise((res) => {
    if (entry) ktx2Loader(renderer).load(entry.ktx2, res, undefined, () => imgLoader.load(path, res, undefined, () => res(null)));
    else imgLoader.load(path, res, undefined, () => res(null));
  });
  if (t) t.userData.src = path;
  return t;
}

// GPU memory of a texture: compressed → the transcoded blocks; images → RGBA8 (+ ⅓ for mipmaps)
export function textureBytes(t) {
  if (t.isCompressedTexture) return t.mipmaps.reduce((a, m) => a + m.data.byteLength, 0);
  const im = t.image;
  if (!im || !im.width) return 0;
  if (t.isDataTexture) return im.data ? im.data.byteLength : im.width * im.height * 4;
  const mips = t.generateMipmaps && t.minFilter !== THREE.LinearFilter && t.minFilter !== THREE.NearestFilter;
  return im.width * im.height * 4 * (mips ? 4 / 3 : 1);
}
