// Our own abstract art, painted in code: calm compositions in the house palette (sand, oat,
// ochre, terracotta, sage, charcoal) with a canvas grain. One picture per art material.
import * as THREE from 'three';
import { rng } from '../pencil.js';

const C = { ground: '#efe9de', oat: '#d9cbb2', sand: '#cdb894', ochre: '#c49a52', terra: '#b26f4f', sage: '#97a08a', char: '#34322f', clay: '#d6b49c', stone: '#a8a197', mist: '#e3ddd2' };

function grain(g, w, h, R, amt = 0.06) {
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const x = (i / 4) % w, y = Math.floor(i / 4 / w);
    const weave = ((x & 1) ^ (y & 1)) * 0.5 + 0.5;
    const n = (R() - 0.5) * amt * 255 + (weave - 0.75) * amt * 60;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

// soft-edged painted shape: several translucent passes, slightly offset, like brushed paint
function daub(g, R, draw, colour, passes = 6, jitter = 3, alpha = 0.22) {
  g.fillStyle = colour;
  for (let i = 0; i < passes; i++) {
    g.save();
    g.globalAlpha = alpha;
    g.translate((R() - 0.5) * jitter, (R() - 0.5) * jitter);
    g.beginPath(); draw(); g.fill();
    g.restore();
  }
}

const PAINT = {
  // above the sofa: a low ochre sun over sand and a single charcoal line
  art1(g, w, h, R) {
    g.fillStyle = C.ground; g.fillRect(0, 0, w, h);
    daub(g, R, () => g.rect(0, h * 0.62, w, h * 0.38), C.oat, 5, 4, 0.3);
    daub(g, R, () => g.arc(w * 0.62, h * 0.62, h * 0.3, Math.PI, 0), C.ochre, 7, 5, 0.25);
    daub(g, R, () => g.arc(w * 0.27, h * 0.78, h * 0.06, 0, Math.PI * 2), C.terra, 6, 3, 0.25);
    g.strokeStyle = C.char; g.lineWidth = h * 0.012; g.globalAlpha = 0.85;
    g.beginPath(); g.moveTo(w * 0.08, h * 0.62); g.bezierCurveTo(w * 0.35, h * 0.6, w * 0.6, h * 0.64, w * 0.92, h * 0.61); g.stroke();
    g.globalAlpha = 1;
  },
  // master bedroom: tall stacked stones
  art2(g, w, h, R) {
    g.fillStyle = C.mist; g.fillRect(0, 0, w, h);
    const stones = [[0.5, 0.78, 0.3, 0.12, C.stone], [0.47, 0.6, 0.22, 0.09, C.clay], [0.53, 0.45, 0.17, 0.08, C.sage], [0.49, 0.32, 0.11, 0.06, C.char]];
    for (const [x, y, rx, ry, c] of stones) daub(g, R, () => g.ellipse(w * x, h * y, w * rx, h * ry, (R() - 0.5) * 0.15, 0, Math.PI * 2), c, 7, 4, 0.24);
  },
  // gallery: wide vertical bands, sage and sand
  art3(g, w, h, R) {
    g.fillStyle = C.ground; g.fillRect(0, 0, w, h);
    daub(g, R, () => g.rect(w * 0.12, h * 0.1, w * 0.34, h * 0.8), C.sage, 6, 6, 0.22);
    daub(g, R, () => g.rect(w * 0.5, h * 0.22, w * 0.36, h * 0.68), C.sand, 6, 6, 0.22);
    daub(g, R, () => g.rect(w * 0.5, h * 0.1, w * 0.36, h * 0.1), C.terra, 5, 4, 0.2);
  },
  // hall: horizon of three soft fields
  art4(g, w, h, R) {
    g.fillStyle = C.ground; g.fillRect(0, 0, w, h);
    daub(g, R, () => g.rect(w * 0.08, h * 0.12, w * 0.84, h * 0.34), C.clay, 6, 6, 0.2);
    daub(g, R, () => g.rect(w * 0.08, h * 0.5, w * 0.84, h * 0.14), C.terra, 6, 5, 0.2);
    daub(g, R, () => g.rect(w * 0.08, h * 0.68, w * 0.84, h * 0.2), C.oat, 6, 5, 0.22);
  },
  // kid's room: a playful sun, a hill and a little house shape, in the same quiet colours
  art5(g, w, h, R) {
    g.fillStyle = C.mist; g.fillRect(0, 0, w, h);
    daub(g, R, () => g.arc(w * 0.72, h * 0.3, h * 0.16, 0, Math.PI * 2), C.ochre, 6, 4, 0.26);
    daub(g, R, () => g.ellipse(w * 0.4, h * 1.0, w * 0.55, h * 0.42, 0, Math.PI, 0), C.sage, 6, 5, 0.26);
    daub(g, R, () => { g.moveTo(w * 0.2, h * 0.62); g.lineTo(w * 0.3, h * 0.5); g.lineTo(w * 0.4, h * 0.62); g.closePath(); }, C.terra, 6, 3, 0.3);
    daub(g, R, () => g.rect(w * 0.22, h * 0.62, w * 0.16, h * 0.14), C.oat, 6, 3, 0.35);
  },
  // gallery and shelves: one gestural charcoal stroke
  art6(g, w, h, R) {
    g.fillStyle = C.ground; g.fillRect(0, 0, w, h);
    g.strokeStyle = C.char; g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      g.globalAlpha = 0.16; g.lineWidth = w * (0.07 - i * 0.004);
      g.beginPath(); g.moveTo(w * (0.25 + (R() - 0.5) * 0.02), h * 0.8);
      g.bezierCurveTo(w * 0.15, h * 0.35, w * 0.75, h * 0.55, w * (0.7 + (R() - 0.5) * 0.02), h * 0.18); g.stroke();
    }
    g.globalAlpha = 1;
  },
  // gallery and WC: grid of four small squares
  art7(g, w, h, R) {
    g.fillStyle = C.ground; g.fillRect(0, 0, w, h);
    const cols = [C.terra, C.sand, C.sage, C.oat];
    for (let i = 0; i < 4; i++) {
      const x = w * (0.2 + (i % 2) * 0.33), y = h * (0.22 + Math.floor(i / 2) * 0.3);
      daub(g, R, () => g.rect(x, y, w * 0.27, w * 0.27), cols[i], 6, 3, 0.25);
    }
  },
  // office: a sage disc resting on a sand line, a fine charcoal rule above
  art8(g, w, h, R) {
    g.fillStyle = C.mist; g.fillRect(0, 0, w, h);
    daub(g, R, () => g.rect(w * 0.1, h * 0.7, w * 0.8, h * 0.08), C.sand, 6, 4, 0.25);
    daub(g, R, () => g.arc(w * 0.42, h * 0.5, h * 0.2, 0, Math.PI * 2), C.sage, 7, 4, 0.24);
    daub(g, R, () => g.arc(w * 0.66, h * 0.62, h * 0.08, 0, Math.PI * 2), C.terra, 6, 3, 0.25);
    g.strokeStyle = C.char; g.lineWidth = h * 0.008; g.globalAlpha = 0.8;
    g.beginPath(); g.moveTo(w * 0.18, h * 0.2); g.lineTo(w * 0.82, h * 0.2); g.stroke();
    g.globalAlpha = 1;
  },
};

// height / width of each picture as hung (build-decor.js)
const ASPECT = { art1: 0.625, art2: 1.2, art3: 1.28, art4: 0.75, art5: 0.74, art6: 1.33, art7: 1.28, art8: 0.78 };
const cache = new Map();
export function artTexture(name) {
  if (cache.has(name)) return cache.get(name);
  const w = 512, h = Math.round(512 * (ASPECT[name] || 1));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const R = rng(name.charCodeAt(3) * 17 + 3);
  (PAINT[name] || PAINT.art4)(g, w, h, R);
  grain(g, w, h, R);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(name, t);
  return t;
}
export const isArt = (name) => /^art\d$/.test(name);
