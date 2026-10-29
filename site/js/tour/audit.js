// Framing check for the stops: render each stop once into a small ID image and measure
// what the "photo" contains — bare wall, ceiling, floor, glass (garden view), furniture by
// name — plus the largest single patch of bare wall. Used by tools/audit-stops.mjs.
import * as THREE from 'three';
import { itemByCode } from '../world/furnish.js';

// category written into the green channel
// 11–14 = bare wall, one value per wall direction (so each wall plane is measured on its own)
const CAT = ['sky', 'wall', 'floor', 'ceiling', 'glass', 'metal', 'door', 'furniture', 'outside', 'other', 'water', 'wall', 'wall', 'wall', 'wall'];
const MAT_CLASS = { glass: 1, frame: 2, door: 3, smokedOak: 3, water: 4 };

function auditMaterial(cls) {
  return new THREE.ShaderMaterial({
    uniforms: { uClass: { value: cls } },
    vertexShader: /* glsl */`
      attribute vec2 aInfo;
      attribute float aItem;
      varying vec3 vN; varying vec2 vInfo; varying float vItem; varying float vY;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal); vInfo = aInfo; vItem = aItem;
        vec4 wp = modelMatrix * vec4(position, 1.0); vY = wp.y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform float uClass;
      varying vec3 vN; varying vec2 vInfo; varying float vItem; varying float vY;
      void main() {
        float c;
        if (uClass > 3.5) c = 10.0;
        else if (uClass > 0.5 && uClass < 1.5) c = 4.0;
        else if (vItem > 0.5) c = 7.0;
        else if (uClass > 1.5 && uClass < 2.5) c = 5.0;
        else if (uClass > 2.5) c = 6.0;
        else if (vInfo.y > 1.5 && vInfo.y < 2.5) c = 8.0;
        else if (abs(vN.y) < 0.5) c = abs(vN.x) > abs(vN.z) ? (vN.x > 0.0 ? 11.0 : 12.0) : (vN.z > 0.0 ? 13.0 : 14.0);
        else if (vN.y > 0.5) c = vY < 0.05 ? 2.0 : 9.0;
        else c = 3.0;
        gl_FragColor = vec4(vItem / 255.0, c / 255.0, 0.0, 1.0);
      }`,
    side: THREE.FrontSide,
  });
}

// Largest 4-connected region of category k, as a share of the frame.
function largestBlob(cat, w, h, k) {
  const seen = new Uint8Array(w * h);
  let best = 0;
  const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || cat[i] !== k) continue;
    let n = 0;
    stack.push(i); seen[i] = 1;
    while (stack.length) {
      const j = stack.pop(); n++;
      const x = j % w, y = (j / w) | 0;
      for (const q of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1]) {
        if (q >= 0 && !seen[q] && cat[q] === k) { seen[q] = 1; stack.push(q); }
      }
    }
    best = Math.max(best, n);
  }
  return best / (w * h);
}

export function auditView(view, w = 320, h = 180) {
  const { renderer, scene, camera, sky } = view;
  const rt = new THREE.WebGLRenderTarget(w, h);
  const swapped = [];
  const mats = new Map();
  scene.traverse((o) => {
    if (o.isLineSegments) { swapped.push([o, 'visible', o.visible]); o.visible = false; }
    if (o.isMesh && o !== sky) {
      const cls = MAT_CLASS[o.userData.mat] || 0;
      if (!mats.has(cls)) mats.set(cls, auditMaterial(cls));
      swapped.push([o, 'material', o.material]);
      o.material = mats.get(cls);
    }
  });
  const keepSky = sky.visible; sky.visible = false;
  const keepClear = renderer.getClearColor(new THREE.Color()).clone(), keepAlpha = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 1);
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  const buf = new Uint8Array(w * h * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
  renderer.setRenderTarget(null);
  renderer.setClearColor(keepClear, keepAlpha);
  sky.visible = keepSky;
  for (const [o, k, v] of swapped) o[k] = v;
  rt.dispose();
  mats.forEach((m) => m.dispose());

  const n = w * h, cat = new Uint8Array(n), share = {}, items = {};
  for (let i = 0; i < n; i++) {
    const c = buf[i * 4 + 1]; cat[i] = c;
    share[CAT[c] || 'other'] = (share[CAT[c] || 'other'] || 0) + 1 / n;
    const id = buf[i * 4];
    if (id) { const it = itemByCode(id); const key = it ? it.id : `#${id}`; items[key] = (items[key] || 0) + 1 / n; }
  }
  // how much each pixel matters to the photo (for placing the room card): furniture and styling
  // most, the garden through the glass next, bare wall, floor, ceiling and sky least
  const W = [0.08, 0.08, 0.15, 0.04, 0.7, 0.3, 0.2, 1.0, 0.4, 0.3, 0.8, 0.08, 0.08, 0.08, 0.08];
  const imp = new Float32Array(n);
  for (let i = 0; i < n; i++) imp[i] = buf[i * 4] ? 1.0 : W[cat[i]] ?? 0.3;
  const round = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v >= 0.002).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v * 1000) / 10]));
  const blob = Math.max(...[11, 12, 13, 14].map((k) => largestBlob(cat, w, h, k)));
  const res = { share: round(share), items: round(items), wallBlob: Math.round(blob * 1000) / 10 };
  Object.defineProperty(res, 'imp', { value: { imp, w, h }, enumerable: false });
  return res;
}

// share (%) of the photo's important content hidden under a screen rectangle (CSS px)
export function coverage(a, r, vw, vh) {
  const { imp, w, h } = a.imp;
  let all = 0, under = 0;
  const x0 = Math.floor((r.left / vw) * w), x1 = Math.ceil((r.right / vw) * w);
  const y0 = Math.floor((r.top / vh) * h), y1 = Math.ceil((r.bottom / vh) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = imp[(h - 1 - y) * w + x];            // pixels are read bottom-up
    all += v;
    if (x >= x0 && x < x1 && y >= y0 && y < y1) under += v;
  }
  return Math.round((under / (all || 1)) * 1000) / 10;
}
