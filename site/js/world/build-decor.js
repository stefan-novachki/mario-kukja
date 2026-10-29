// Styling: the things that make the rooms look lived in. Books, ceramics, cushions, throws,
// towels, clothes, plants and our own abstract art, each placed on a real surface of the
// furniture it belongs to (local frame of the piece: u across, v from back to front, z up).
// Code-built pieces go into the 'decor' group (light baked per vertex in Blender); art
// canvases are flat, so they join the lightmapped 'items'. Poly Haven models are returned as
// placements: Blender puts them into the bake and the website loads them from models/decor.glb.
import { ITEMS, SITE, PLANTS } from '../plan-data.js';
import { makeKit } from './furnish.js';
import { Z, zoneAt } from './zones.js';
import { LV } from './build-arch.js';
import { rng } from '../pencil.js';

const DEG = Math.PI / 180;
const byId = (id) => ITEMS.find((i) => i.id === id) || SITE.outdoor.find((i) => i.id === id);
export const DECOR_CODE = 199;                       // item code for styling in the framing check

// turned profiles [radius, height] from the bottom up
const P = {
  bowl: (r, h) => [[0, 0], [r * 0.5, 0], [r * 0.8, h * 0.15], [r * 0.97, h * 0.6], [r, h], [r - 0.006, h], [r * 0.93, h * 0.62], [r * 0.75, h * 0.22], [0, h * 0.16]],
  jar: (r, h) => [[0, 0], [r, 0], [r, h * 0.86], [r * 0.8, h * 0.94], [r * 0.82, h], [0, h]],
  vase: (r, h) => [[0, 0], [r * 0.7, 0], [r, h * 0.35], [r * 0.85, h * 0.78], [r * 0.42, h * 0.92], [r * 0.48, h], [r * 0.4, h], [r * 0.34, h * 0.9], [0, h * 0.9]],
  cup: (r, h) => [[0, 0], [r * 0.82, 0], [r, h * 0.85], [r, h], [r - 0.004, h], [r * 0.8, 0.008], [0, 0.008]],
  plate: (r) => [[0, 0], [r * 0.7, 0], [r, 0.018], [r - 0.004, 0.021], [r * 0.68, 0.007], [0, 0.007]],
  bottle: (r, h) => [[0, 0], [r, 0], [r, h * 0.62], [r * 0.38, h * 0.78], [r * 0.32, h], [0, h]],
  candle: (r, h) => [[0, 0], [r, 0], [r, h], [0, h]],
  ball: (r, k = 1) => Array.from({ length: 11 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 10; return [Math.max(0, Math.cos(a) * r), (r + Math.sin(a) * r) * k]; }),
};
const BOOKS = ['book1', 'book2', 'book3', 'book4', 'book5', 'book6', 'book7', 'book8', 'book9'];
const SHELF_LEVELS = [0.105, 0.485, 0.865, 1.245, 1.625, 2.005];   // board tops of the shelf units (furnish.js)

export function buildDecor(mb) {
  const models = [];
  const R = rng(42);
  const pick = (a) => a[Math.floor(R() * a.length) % a.length];

  function kit(id) {
    const it = byId(id);
    const k = makeKit(mb, it, 'decor');
    const right = [k.f[1], -k.f[0]];
    const yaw0 = Math.atan2(right[1], right[0]);    // model +x → the piece's right, model +y → its front
    k.it = it;
    // Poly Haven model at local (u, v, z); rot turns it (degrees), tilt leans its top back
    k.M = (model, u, v, z, rot = 0, { scale = 1, mat = null, tilt = 0 } = {}) => {
      const p = k.P(u, v);
      models.push({ model, at: [p[0], p[1], z], yaw: yaw0 + rot * DEG, tilt: tilt * DEG, scale, mat, zone: k.zone });
    };
    k.L = (u, v, z, profile, mat, opts) => { const p = k.P(u, v); mb.lathe('decor', mat, p[0], p[1], z, profile, k.zone, opts); };
    return k;
  }

  // upright books between u0 and u1, spines a little behind the front edge
  function books(k, u0, u1, z, { vFront = k.D - 0.025, hmax = 0.3, hmin = 0.19, gapEnd = false } = {}) {
    let u = u0;
    const end = gapEnd ? u1 - 0.03 : u1;
    while (u < end) {
      const t = 0.014 + R() * 0.032, h = hmin + R() * (hmax - hmin), d = Math.min(vFront - 0.02, 0.14 + R() * 0.08);
      if (u + t > end) break;
      k.B(u, vFront - d, z, u + t, vFront, z + h, pick(BOOKS));
      u += t + 0.0012;
    }
  }
  // books lying flat, the largest at the bottom, each a few degrees off square
  function stack(k, u, v, z, n, { w = 0.27, d = 0.2, big = false } = {}) {
    let zz = z;
    for (let i = 0; i < n; i++) {
      const s = 1 - i * 0.07, t = (big ? 0.025 : 0.018) + R() * 0.02;
      const ww = w * s * (0.9 + R() * 0.15), dd = d * s * (0.9 + R() * 0.15);
      box(k, u, v, zz, ww, dd, t, pick(BOOKS), (R() - 0.5) * 12);
      zz += t;
    }
    return zz;
  }
  // plain box in the piece's frame, centred at (u, v), bottom at z, turned rot degrees, leaning back tilt degrees
  function box(k, u, v, z, w, d, h, mat, rot = 0, tilt = 0) {
    const f = [k.f[0], k.f[1], 0], r = [k.f[1], -k.f[0], 0], q = rot * DEG, t = tilt * DEG;
    const X = r.map((a, i) => a * Math.cos(q) + f[i] * Math.sin(q));
    const Y0 = f.map((a, i) => a * Math.cos(q) - r[i] * Math.sin(q));
    const Y = Y0.map((a, i) => a * Math.cos(t) + [0, 0, 1][i] * Math.sin(t));
    const Zx = [0, 0, 1].map((a, i) => a * Math.cos(t) - Y0[i] * Math.sin(t));
    const p = k.P(u, v);
    const c = [0, 1, 2].map((i) => [p[0], p[1], z][i] + Zx[i] * (h / 2));
    mb.obox('decor', mat, c, [w / 2, d / 2, h / 2], [X, Y, Zx], k.zone, { lines: false });
  }
  // own abstract art on a wall face: canvas (lightmapped) in a thin floating oak frame
  function art(mat, axis, sign, c, [a0, a1], [z0, z1], zone, frame = 'oak') {
    const keep = mb.item;
    mb.item = DECOR_CODE;
    const d = 0.03, out = c + sign * d;
    const box = (ua, ub, za, zb, ca, cb, m, opts) => mb.box('items', m, axis === 'y' ? [ua, Math.min(ca, cb), za, ub, Math.max(ca, cb), zb] : [Math.min(ca, cb), ua, za, Math.max(ca, cb), ub, zb], zone, opts);
    box(a0, a1, z0, z1, c, out, 'paper', { skip: [`${axis}${sign > 0 ? '+' : '-'}`] });
    mb.rect('items', mat, axis, sign, out, [a0, a1], [z0, z1], zone, { picture: true, lines: false });
    const g = 0.008, w = 0.016, fo = c + sign * 0.042;
    box(a0 - g - w, a0 - g, z0 - g - w, z1 + g + w, c, fo, frame);
    box(a1 + g, a1 + g + w, z0 - g - w, z1 + g + w, c, fo, frame);
    box(a0 - g, a1 + g, z0 - g - w, z0 - g, c, fo, frame);
    box(a0 - g, a1 + g, z1 + g, z1 + g + w, c, fo, frame);
    mb.item = keep;
  }
  // small framed picture leaning on a shelf: local u range, back against v0
  function leaning(k, u0, u1, z, h, v0, mat) {
    box(k, (u0 + u1) / 2, v0 + 0.01 + Math.sin(8 * DEG) * h / 2, z, u1 - u0, 0.02, h, mat, 0, 8);
  }

  // ------------------------------------------------------------ living · dining · kitchen
  {
    const k = kit('island');                         // long along y; u = across (x), v = along (y)
    k.M('wooden_bowl_01:a', -0.15, 1.6, 0.92, 20);
    for (const [u, v] of [[-0.2, 1.57], [-0.1, 1.62], [-0.17, 1.67], [-0.08, 1.53], [-0.13, 1.6]]) k.L(u, v, 0.935 + (u === -0.13 ? 0.045 : 0), P.ball(0.034, 1.1), 'lemon', { seg: 14 });
    k.M('ceramic_vase_03:a', -0.25, 0.35, 0.92, 15, { scale: 0.7 });
  }
  {
    const k = kit('kback');                          // back counter, faces the island; hob in the middle
    k.S(-1.08, 0.06, 0.92, -0.72, 0.085, 1.38, 'oak', { r: 0.006, tilt: 9 });
    k.S(-0.98, 0.095, 0.92, -0.7, 0.115, 1.26, 'walnut', { r: 0.006, tilt: 9 });
    k.L(-0.58, 0.16, 0.92, P.jar(0.06, 0.15), 'stoneware');
    for (const [du, dv, h] of [[-0.015, 0.0, 0.3], [0.012, 0.01, 0.33], [0.0, -0.012, 0.28]]) k.L(-0.58 + du, 0.16 + dv, 1.05, P.candle(0.007, h), 'oak', { seg: 6 });
    k.L(0.62, 0.12, 0.92, P.bottle(0.032, 0.28), 'stonewareDark', { seg: 16 });
    k.L(0.78, 0.13, 0.92, P.jar(0.065, 0.2), 'stoneware');
    k.M('potted_plant_04:a', 1.0, 0.16, 0.92, 30);
  }
  {
    const k = kit('dtable');                         // dining table, long along x
    k.S(-0.8, k.D / 2 - 0.19, 0.75, 0.8, k.D / 2 + 0.19, 0.754, 'linenOat', { r: 0.002 });   // linen runner
    k.M('ceramic_vase_01:a', -0.1, k.D / 2, 0.754, 0);
    k.L(0.35, k.D / 2 + 0.02, 0.754, P.bowl(0.12, 0.07), 'stonewareDark');
    k.L(-0.48, k.D / 2 - 0.04, 0.754, P.candle(0.035, 0.12), 'paper', { seg: 16 });
  }
  {
    const k = kit('sofa');                           // the long piece of the L, faces the room; corner at u = +W/2
    k.M('throw_pillows_01:1', 1.55, 0.42, 0.5, 200, { mat: 'linenOat', tilt: 0 });
    k.M('throw_pillows_01:2', 1.05, 0.43, 0.5, -11, { mat: 'linenTerracotta', tilt: 14 });
    k.M('throw_pillows_01:2', -1.5, 0.42, 0.5, -7, { mat: 'linenOat', tilt: 16 });
    k.S(-0.9, 0.5, 0.51, -0.35, 0.95, 0.55, 'linenCharcoal', { r: 0.02, rot: -6, bulge: 0.005 });   // folded throw
  }
  { const k = kit('sofa2'); k.M('throw_pillows_01:2', 1.0, 0.42, 0.5, -9, { mat: 'linenSage', tilt: 15 }); }
  {
    const k = kit('ctable');                         // light wood coffee table, top 0.40
    const top = stack(k, -0.25, k.D / 2, 0.4, 3, { w: 0.32, d: 0.25, big: true });
    k.L(-0.22, k.D / 2 + 0.02, top, P.candle(0.04, 0.09), 'stoneware', { seg: 16 });
    k.L(0.25, k.D / 2, 0.4, P.bowl(0.13, 0.075), 'stonewareDark');
  }
  { const k = kit('lchair2'); k.M('throw_pillows_01:2', 0, 0.3, 0.46, -15, { mat: 'linenOat', tilt: 14, scale: 0.9 }); }
  {
    const k = kit('tv');                             // media unit under the television, top 0.45
    stack(k, -0.85, 0.22, 0.45, 3, { w: 0.3, d: 0.24, big: true });
    k.L(0.85, 0.2, 0.45, P.vase(0.07, 0.26), 'stoneware');
    k.L(1.0, 0.24, 0.45, P.bowl(0.08, 0.05), 'stonewareDark');
  }
  art('art1', 'y', 1, 9.9, [4.75, 5.55], [1.05, 2.05], Z.ldk);                // beside the hall opening

  // ------------------------------------------------------------ hall
  {
    const k = kit('hbench');                         // oak bench against the bathroom wall, faces the hall
    k.M('ceramic_vase_01:a', 0.3, 0.2, 0.45, 0);
    stack(k, -0.2, 0.2, 0.45, 2, { w: 0.3, d: 0.23, big: true });
  }
  art('art4', 'x', -1, 7.7, [6.25, 7.15], [1.05, 1.75], Z.hall);              // above the bench
  art('art6', 'x', 1, 5.9, [6.6, 7.4], [1.15, 1.95], Z.hall, 'frame');       // opposite, on bedroom 2's wall
  art('art3', 'x', -1, 7.7, [1.6, 2.6], [1.15, 1.8], Z.hall);                 // by the front door

  // ------------------------------------------------------------ kid's bedroom
  { const k = kit('kbed'); k.M('throw_pillows_01:1', 0.0, 0.42, 0.52, 215, { mat: 'linenTerracotta', tilt: 2, scale: 0.9 }); }
  { const k = kit('kns'); stack(k, 0, 0.15, 0.5, 2, { w: 0.2, d: 0.13 }); }
  {
    const k = kit('kdesk');                          // under the front window
    k.S(0.04, 0.2, 0.74, 0.32, 0.42, 0.752, 'paper', { r: 0.003, rot: 6 });
    k.L(0.38, 0.12, 0.74, P.cup(0.035, 0.1), 'linenMustard');
    for (const [du, dv, h, m] of [[-0.01, 0, 0.17, 'book3'], [0.012, 0.008, 0.16, 'book2'], [0, -0.01, 0.18, 'book7']]) k.L(0.38 + du, 0.12 + dv, 0.74, P.candle(0.004, h), m, { seg: 6 });
    stack(k, -0.45, 0.2, 0.74, 2, { w: 0.24, d: 0.18 });
  }
  {
    const k = kit('kbooks');                         // low shelf, 2 bays, 3 levels + top
    const L = SHELF_LEVELS, w = k.W / 2;
    const a0 = -k.W / 2 + 0.03, b0 = -w + w - 0.02, a1 = 0.02, b1 = k.W / 2 - 0.03;
    k.S(a0 + 0.02, 0.03, L[0], b0 - 0.02, k.D - 0.02, L[0] + 0.3, 'linenOat', { r: 0.02 });
    k.S(a1 + 0.02, 0.03, L[0], b1 - 0.02, k.D - 0.02, L[0] + 0.3, 'linenSage', { r: 0.02 });
    books(k, a0, b0, L[1], { hmin: 0.2, hmax: 0.3 }); books(k, a1, a1 + 0.35, L[1]); k.L(b1 - 0.15, 0.18, L[1], P.ball(0.08), 'linenMustard');
    stack(k, a0 + 0.2, 0.18, L[2], 3); books(k, a1, b1, L[2], { hmax: 0.26 });
    leaning(k, a0 + 0.1, a0 + 0.5, 1.2, 0.35, 0.03, 'art7');
    k.L(b1 - 0.2, 0.18, 1.2, P.vase(0.05, 0.16), 'stoneware');
  }
  art('art5', 'x', 1, 1.9, [3.0, 3.8], [1.05, 1.6], Z.kid);                   // above the bed

  // ------------------------------------------------------------ master bedroom
  {
    const k = kit('mbed');                           // head on the neighbour-side wall
    k.M('throw_pillows_01:1', -0.36, 0.46, 0.52, 215, { mat: 'linenOat', tilt: 4 });
    k.M('throw_pillows_01:2', 0.36, 0.47, 0.52, -15, { mat: 'linenSage', tilt: 18 });
    k.M('throw_pillows_01:2', 0.02, 0.62, 0.52, -15, { mat: 'navy', tilt: 12, scale: 0.8 });
  }
  { const k = kit('mns1'); stack(k, -0.05, 0.2, 0.5, 2, { w: 0.24, d: 0.17 }); k.L(0.12, 0.33, 0.5, P.cup(0.035, 0.1), 'stoneware'); }
  { const k = kit('mns2'); stack(k, 0.05, 0.2, 0.5, 3, { w: 0.22, d: 0.16 }); k.M('calathea_orbifolia_01:d', -0.1, 0.3, 0.5, 0); }
  { const k = kit('mbench'); k.S(-0.5, 0.05, 0.45, -0.05, 0.36, 0.49, 'linenCharcoal', { r: 0.015, rot: 3 }); stack(k, 0.3, k.D / 2, 0.45, 2, { w: 0.3, d: 0.24, big: true }); }
  { const k = kit('mchair'); k.M('throw_pillows_01:2', 0, 0.28, 0.46, -15, { mat: 'linenSage', tilt: 14, scale: 0.85 }); }
  art('art2', 'x', -1, 11.6, [1.65, 2.85], [1.3, 2.05], Z.master);           // above the bed

  // ------------------------------------------------------------ en-suite and bathroom
  {
    const z = Z.ensuite, x0 = 11.02, y0 = 7.25;        // teak stool in the walk-in shower
    for (const [dx, dy] of [[0, 0], [0.4, 0], [0, 0.28], [0.4, 0.28]]) mb.box('decor', 'teak', [x0 + dx, y0 + dy, 0, x0 + dx + 0.035, y0 + dy + 0.035, 0.42], z);
    for (let i = 0; i < 5; i++) mb.box('decor', 'teak', [x0 - 0.01, y0 - 0.01 + i * 0.066, 0.42, x0 + 0.445, y0 + 0.045 + i * 0.066, 0.445], z);
    const xr = 11.6 - 0.05;                           // towel ladder by the door
    for (const y of [5.2, 5.6]) mb.cylinder('decor', 'frame', xr, y, 0.011, 0.25, 1.55, z, { lines: false, seg: 10 });
    for (const zz of [0.55, 0.9, 1.25]) mb.box('decor', 'frame', [xr - 0.011, 5.2, zz, xr + 0.011, 5.6, zz + 0.02], z, { lines: false });
    mb.rbox('decor', 'towel', [xr, 5.4, 1.08], [0.035, 0.18, 0.2], z, { r: 0.03, bulge: 0.01 });
    const k = kit('evan');
    k.M('potted_plant_04:a', 0.36, 0.12, 0.84, 0);
    k.L(-0.38, 0.1, 0.84, P.bottle(0.03, 0.17), 'stonewareDark', { seg: 16 });
    k.L(-0.3, 0.08, 0.84, P.bottle(0.026, 0.14), 'stoneware', { seg: 16 });
  }
  {
    const k = kit('bvan');
    k.L(0.3, 0.08, 0.84, P.cup(0.035, 0.1), 'stoneware');
    k.L(0.36, 0.12, 0.84, P.bottle(0.026, 0.15), 'linenSage', { seg: 16 });
    k.S(-0.38, 0.1, 0.84, -0.2, 0.4, 0.88, 'towel', { r: 0.015, bulge: 0.004 });
  }

  // ------------------------------------------------------------ bedroom 2
  {
    const k = kit('gbed');
    k.M('throw_pillows_01:1', -0.36, 0.46, 0.52, 215, { mat: 'linenSage', tilt: 4 });
    k.M('throw_pillows_01:2', 0.36, 0.47, 0.52, -15, { mat: 'linenOat', tilt: 18 });
  }
  { const k = kit('gns1'); stack(k, 0, 0.2, 0.5, 2, { w: 0.22, d: 0.16 }); }
  { const k = kit('gns2'); k.L(-0.1, 0.25, 0.5, P.cup(0.035, 0.1), 'stonewareDark'); }
  {
    const k = kit('gside');                          // walnut sideboard on the hall wall
    k.L(-0.6, 0.24, 0.75, P.bowl(0.09, 0.06), 'stonewareDark');
    stack(k, -0.05, 0.22, 0.75, 3, { w: 0.3, d: 0.24, big: true });
    k.M('ceramic_vase_03:a', 0.3, 0.2, 0.75, 0);
  }
  { const k = kit('gchair'); k.M('throw_pillows_01:2', 0, 0.28, 0.46, -15, { mat: 'linenTerracotta', tilt: 14, scale: 0.85 }); }
  art('art8', 'x', -1, 5.78, [6.85, 7.95], [1.15, 1.95], Z.guest);            // above the sideboard

  // ------------------------------------------------------------ guest WC and pantry
  { const k = kit('bas1'); k.L(0.14, 0.08, 0.85, P.bottle(0.028, 0.15), 'stonewareDark', { seg: 16 }); }
  art('art7', 'y', 1, 8.07, [8.0, 8.55], [1.25, 1.8], Z.wc, 'frame');
  {
    const k = kit('pshelf2');                         // jars, bottles and bowls on the pantry shelves
    const L = SHELF_LEVELS;
    for (const [li, list] of [[1, [[-0.6, 'jar'], [-0.4, 'jar'], [0.1, 'bottle'], [0.3, 'bottle'], [0.55, 'jar']]], [2, [[-0.55, 'bowl'], [-0.2, 'jar'], [0.4, 'jar']]], [3, [[-0.5, 'jar'], [0.0, 'bottle'], [0.5, 'bowl']]]]) {
      for (const [u, kind] of list) k.L(u, 0.2, L[li], kind === 'jar' ? P.jar(0.06, 0.18) : kind === 'bottle' ? P.bottle(0.035, 0.28) : P.bowl(0.1, 0.07), R() < 0.5 ? 'stoneware' : 'stonewareDark', { seg: 14 });
    }
  }

  // ------------------------------------------------------------ garden: the outdoor table and the pergola lounge
  { const k = kit('otable'); k.L(0, k.D / 2, 0.75, P.bowl(0.16, 0.08), 'stoneware'); k.M('potted_plant_04:a', 0.55, k.D / 2, 0.75, 20); }
  { const k = kit('osofa'); k.M('throw_pillows_01:2', -0.8, 0.42, 0.5, -9, { mat: 'linenOat', tilt: 15 }); k.M('throw_pillows_01:2', 0.8, 0.42, 0.5, 9, { mat: 'linenTerracotta', tilt: 15 }); }
  { const k = kit('octable'); k.L(0, k.D / 2, 0.36, P.bowl(0.12, 0.07), 'stonewareDark'); }

  // planting: perennials (shrub_01) and low shrubs (shrub_04) in the beds and the two planters,
  // a jittered grid so the drifts look grown, not lined up. Phones get one plant in three.
  {
    const ground = LV.lawn + 0.03;
    const SH1 = ['a', 'b', 'c', 'e', 'f', 'g', 'h', 'i'];
    let n = 0;
    const plant = (x, y, z, zone) => {
      const low = R() < 0.45;
      const model = low ? 'shrub_04:a' : `shrub_01:${pick(SH1)}`;
      const scale = low ? 1.3 + R() * 0.4 : 1.7 + R() * 0.7;      // grown plants: perennials ≈ 0.2–0.9 m, shrubs 0.3–0.4 m
      models.push({ model, at: [x, y, z], yaw: R() * Math.PI * 2, tilt: 0, scale, mat: null, zone, tier: n++ % 3 ? 'desktop' : 'all' });
    };
    const trunks = SITE.trees.map(([x, y]) => [x, y]);
    for (const [x0, y0, x1, y1] of SITE.beds) {
      const zone = zoneAt((x0 + x1) / 2, (y0 + y1) / 2), sp = 0.6;
      let row = 0;
      for (let y = y0 + sp * 0.45; y < y1 - 0.1; y += sp * 0.82, row++) {
        for (let x = x0 + sp * (row % 2 ? 0.75 : 0.4); x < x1 - 0.1; x += sp) {
          const px = x + (R() - 0.5) * sp * 0.5, py = y + (R() - 0.5) * sp * 0.4;
          if (px < x0 + 0.15 || px > x1 - 0.15 || py < y0 + 0.15 || py > y1 - 0.15) continue;
          if (trunks.some(([tx, ty]) => Math.hypot(px - tx, py - ty) < 0.55)) continue;
          plant(px, py, ground, zone);
        }
      }
    }
  }

  // plants on the floor (plan-data PLANTS)
  for (const p of PLANTS) models.push({ model: p.model, at: [p.at[0], p.at[1], 0], yaw: p.turn * DEG, tilt: 0, scale: 1, mat: null, zone: Z[p.room] });
  return models;
}

// The garden and street trees: Poly Haven models (reduced in tools/blender/prep-trees.py).
export function treePlacements() {
  return SITE.trees.map(([x, y, , model, rot, scale]) => ({ model, at: [x, y, -0.21], yaw: rot * DEG, tilt: 0, scale, mat: null, zone: zoneAt(x, y) }));
}
