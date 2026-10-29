// Layered lighting: ambient (recessed downlights), task (pendants over the island, a linear
// light over the table, desk and bedside lamps, mirror lights, the strip under the wall
// cabinets) and accent (table and floor lamps, porch, garden, pergola and tree lights). One list drives the fixture
// shapes on the website and the light sources in the Blender bake.
// x, y = plan metres; z = height of the light source; w = power in watts (Blender units).
import { Z, zoneAt, roomAt, ceilingOf } from './zones.js';

const WARM = 2700, NEUTRAL = 3000;
const L = (id, kind, x, y, z, w, o = {}) => ({ id, kind, x, y, z, w, k: o.k ?? WARM, ...o });

export const LAMPS = [
  // living · dining · kitchen: two white dome pendants over the island (as in the renders), a linear
  // light over the table, downlights, a table lamp by the sofa, the strip under the wall cabinets
  L('isl1', 'dome', 9.1, 11.5, 1.75, 18), L('isl2', 'dome', 9.1, 12.5, 1.75, 18),
  L('dine', 'dome', 6.4, 13.25, 1.6, 22),
  L('sofa', 'table', 0.75, 10.95, 0.5, 14),
  L('kstrip', 'strip', 11.22, 12.4, 1.49, 16, { len: 2.2, along: 'y', dir: 'down', k: NEUTRAL }),
  ...[[2.6, 10.9], [2.6, 13.9], [5.2, 11.0], [5.0, 14.5], [10.3, 10.6], [10.3, 13.9], [7.9, 14.4]].map(([x, y], i) => L(`ldk${i}`, 'down', x, y, 3.0, 9)),
  // hall, WC, bathrooms, pantry
  L('hall1', 'down', 6.8, 2.2, 2.7, 9), L('hall2', 'down', 6.8, 4.6, 2.7, 8), L('hall3', 'down', 6.8, 8.7, 2.7, 8),
  L('porch', 'down', 6.8, 0.5, 2.75, 8),
  L('wc', 'down', 8.6, 8.4, 3.0, 7), L('wcmir', 'mirror', 9.38, 9.2, 1.86, 5, { len: 0.4, dir: 'W', along: 'y' }),
  L('bath', 'down', 8.6, 5.9, 3.0, 8), L('bmir', 'mirror', 9.38, 5.52, 2.0, 6, { len: 0.7, dir: 'W', along: 'y' }),
  L('ens1', 'down', 10.5, 5.6, 3.0, 8), L('ens2', 'down', 10.6, 7.35, 3.0, 8),
  L('emir', 'mirror', 9.54, 5.7, 2.0, 7, { len: 0.9, dir: 'E', along: 'y' }),
  L('pantry', 'down', 10.55, 8.85, 3.0, 6, { k: NEUTRAL }),
  // kid's bedroom
  L('kdrum', 'drum', 3.75, 2.5, 2.15, 22), L('kbedl', 'table', 3.18, 4.45, 0.5, 9), L('kdeskl', 'desklamp', 3.9, 0.48, 0.74, 7),
  // master bedroom
  L('mbl', 'globe', 11.36, 1.075, 1.15, 10), L('mbr', 'globe', 11.36, 3.425, 1.15, 10),
  L('mdn1', 'down', 9.0, 1.2, 2.7, 7), L('mdn2', 'down', 9.0, 3.6, 2.7, 7),
  L('mchairl', 'floor', 8.2, 1.45, 0, 10),
  // bedroom 2
  L('gbl', 'table', 2.17, 9.36, 0.5, 9), L('gbr', 'table', 4.52, 9.36, 0.5, 9),
  L('gdn1', 'down', 3.4, 6.6, 3.0, 8), L('gside', 'table', 5.55, 7.85, 0.75, 9),
  // garage
  L('gar1', 'down', -3.4, 20.6, 2.7, 26, { k: NEUTRAL }),
  // outside: porch wall lights, the post at the drive, the garage door, pergola and terrace
  L('door1', 'wall', 5.95, 0.95, 2.1, 6), L('door2', 'wall', 7.65, 0.95, 2.1, 6),
  L('post', 'post', -1.3, -5.7, 0.95, 6),
  L('garw', 'wall', -1.3, 17.55, 2.45, 6),
  L('perg1', 'down', 1.2, 20.2, 2.72, 7), L('perg2', 'down', 3.0, 20.2, 2.72, 7),
  L('ter1', 'wall', 2.4, 15.45, 2.75, 6, { dir: 'N' }), L('ter2', 'wall', 6.8, 15.45, 2.75, 6, { dir: 'N' }),
  L('bol1', 'bollard', 7.2, -1.2, 0.55, 3), L('bol2', 'bollard', 9.9, -5.5, 0.55, 3),
  // tree uplights: a wide wash into the crowns
  L('tree1', 'uplight', 8.9, 23.2, 0.05, 40), L('tree2', 'uplight', 4.45, -3.2, 0.05, 22), L('tree3', 'uplight', 11.4, -4.0, 0.05, 22),
];

// Approximate colour of a warm/neutral light (linear RGB, max 1).
export function kelvinRGB(k) {
  if (k < 2000) return [1.0, 0.5, 0.2];          // fire
  if (k >= 6000) return [0.85, 0.95, 1.0];
  if (k >= 3000) return [1.0, 0.78, 0.55];
  return [1.0, 0.7, 0.42];
}

// Fixture shapes. Glowing parts use the material 'glow' (lit on the website by the lamp
// level, invisible as a light source in the bake — the lamps do the lighting there).
export function buildFixtures(mb) {
  for (const [i, l] of LAMPS.entries()) {
    const zone = zoneAt(l.x, l.y) || Z.front;
    const outside = zone === Z.front || zone === Z.garden;
    mb.item = 200 + i;                     // fixtures count as furniture in the framing check
    // entrance lights are on already at golden hour, garden lights switch on at dusk
    const glow = (mat) => (mat === 'glow' && outside ? (zone === Z.front ? 'glowFront' : 'glowOut') : mat);
    const box = (r, mat, opts) => mb.box('items', glow(mat), r, zone, opts);
    const cyl = (cx, cy, r, z0, z1, mat, opts) => mb.cylinder('items', glow(mat), cx, cy, r, z0, z1, zone, opts);
    const { x, y, z } = l;
    const ceilH = roomAt(x, y) ? ceilingOf(roomAt(x, y)) : 2.7;
    switch (l.kind) {
      case 'pendant': {
        const ceil = ceilH;
        cyl(x, y, 0.005, z + 0.28, ceil, 'frame', { caps: [false, false], lines: false });
        cyl(x, y, 0.09, z + 0.02, z + 0.28, 'frame', { caps: [false, true], seg: 20 });
        cyl(x, y, 0.08, z, z + 0.02, 'glow', { caps: [true, false], seg: 20, lines: false });
        break;
      }
      case 'linear': {
        const h = l.len / 2;
        for (const dx of [-h + 0.1, h - 0.1]) cyl(x + dx, y, 0.003, z + 0.06, ceilH, 'frame', { caps: [false, false], lines: false });
        box([x - h, y - 0.035, z + 0.012, x + h, y + 0.035, z + 0.06], 'frame');
        box([x - h + 0.02, y - 0.025, z, x + h - 0.02, y + 0.025, z + 0.012], 'glow', { lines: false });
        break;
      }
      case 'dome': {
        const ceil = ceilH;
        cyl(x, y, 0.004, z + 0.2, ceil, 'frame', { caps: [false, false], lines: false });
        mb.lathe('items', 'ceramic', x, y, z, [[0.13, 0], [0.125, 0.04], [0.1, 0.12], [0.05, 0.18], [0.02, 0.2], [0, 0.2]], zone, { seg: 24 });
        cyl(x, y, 0.12, z + 0.002, z + 0.004, 'glow', { caps: [true, false], seg: 24, lines: false });
        break;
      }
      case 'post': {
        box([x - 0.05, y - 0.05, -0.15, x + 0.05, y + 0.05, z + 0.12], 'frame');
        box([x - 0.052, y - 0.052, z - 0.1, x + 0.052, y + 0.052, z + 0.02], 'glow', { lines: false });
        break;
      }
      case 'globe': {
        cyl(x, y, 0.004, z + 0.2, ceilH, 'frame', { caps: [false, false], lines: false });
        cyl(x, y, 0.09, z, z + 0.18, 'glow', { seg: 20 });
        break;
      }
      case 'drum': {
        cyl(x, y, 0.004, z + 0.22, ceilH, 'frame', { caps: [false, false], lines: false });
        cyl(x, y, 0.26, z, z + 0.22, 'shade', { caps: [false, false], seg: 32 });
        cyl(x, y, 0.24, z + 0.02, z + 0.021, 'glow', { caps: [true, false], seg: 32, lines: false });
        break;
      }
      case 'table': {
        cyl(x, y, 0.07, z, z + 0.3, 'ceramic', { seg: 18 });
        cyl(x, y, 0.16, z + 0.3, z + 0.52, 'shade', { caps: [false, false], seg: 24 });
        cyl(x, y, 0.15, z + 0.31, z + 0.311, 'glow', { caps: [true, false], seg: 24, lines: false });
        break;
      }
      case 'floor': {
        cyl(x, y, 0.15, 0, 0.025, 'frame', { seg: 20 });
        cyl(x, y, 0.012, 0.025, 1.3, 'frame', { caps: [false, false], lines: false });
        cyl(x, y, 0.21, 1.3, 1.6, 'shade', { caps: [false, false], seg: 28 });
        cyl(x, y, 0.2, 1.31, 1.311, 'glow', { caps: [true, false], seg: 28, lines: false });
        break;
      }
      case 'desklamp': {
        cyl(x, y, 0.07, z, z + 0.015, 'frame', { seg: 16 });
        box([x - 0.01, y - 0.01, z + 0.015, x + 0.01, y + 0.01, z + 0.42], 'frame');
        box([x - 0.04, y - 0.01, z + 0.38, x + 0.04, y + 0.2, z + 0.44], 'frame');
        box([x - 0.035, y + 0.06, z + 0.375, x + 0.035, y + 0.19, z + 0.38], 'glow', { lines: false });
        break;
      }
      case 'down': {
        cyl(x, y, 0.045, z - 0.004, z - 0.002, 'glow', { caps: [true, false], seg: 16, lines: false });
        break;
      }
      case 'strip': {
        const h = l.len / 2;
        const r = l.along === 'y' ? [x - 0.012, y - h, z - 0.006, x + 0.012, y + h, z] : [x - h, y - 0.012, z - 0.006, x + h, y + 0.012, z];
        box(r, 'glow', { lines: false });
        break;
      }
      case 'mirror': {
        const h = l.len / 2;
        const r = l.dir === 'E' ? [x, y - h, z - 0.015, x + 0.025, y + h, z + 0.015] : l.dir === 'W' ? [x - 0.025, y - h, z - 0.015, x, y + h, z + 0.015]
          : l.dir === 'N' ? [x - h, y, z - 0.015, x + h, y + 0.025, z + 0.015] : [x - h, y - 0.025, z - 0.015, x + h, y, z + 0.015];
        box(r, 'glow', { lines: false });
        break;
      }
      case 'wall': {
        box([x - 0.04, y - 0.04, z - 0.12, x + 0.04, y + 0.04, z + 0.12], 'frame');
        box([x - 0.03, y - 0.03, z - 0.122, x + 0.03, y + 0.03, z - 0.12], 'glow', { lines: false });
        break;
      }
      case 'bollard': {
        cyl(x, y, 0.06, -0.02, z + 0.05, 'frame', { seg: 16 });
        cyl(x, y, 0.061, z - 0.12, z - 0.02, 'glow', { caps: [false, false], seg: 16, lines: false });
        break;
      }
      case 'pool': {
        box([x - 0.12, y - 0.06, z - 0.06, x + 0.12, y - 0.055, z + 0.06], 'glow', { lines: false });
        break;
      }
      case 'uplight': {
        cyl(x, y, 0.07, -0.15, 0.02, 'frame', { seg: 16 });
        cyl(x, y, 0.05, 0.02, 0.021, 'glow', { caps: [true, false], seg: 16, lines: false });
        break;
      }
      default: break;
    }
  }
  mb.item = 0;
  return mb;
}
