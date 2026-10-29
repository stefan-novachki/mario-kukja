// Furniture and fixtures as clean modern shapes at the sizes given in the plan.
// Milestone 2 = honest massing in the palette; materials and styling come later.
import { ITEMS, ROOMS, SITE } from '../plan-data.js';
import { Z, zoneAt, ceilingOf } from './zones.js';
import { LAMPS } from './lighting.js';

const EPS = 0.02;
// upholstery by room: navy in the living room (as in the renders), linen in the bedrooms
const fabricOf = (it) => (!it.room ? 'navyOut' : it.room === 'ldk' ? 'navy' : 'linen');

// Front direction of an item: given, or away from the wall it stands against.
export function frontOf(it) {
  if (it.face) return it.face[0] !== 0 && it.face[1] !== 0 ? [Math.sign(it.face[0]), 0] : it.face;
  const room = ROOMS.find((r) => r.id === it.room);
  const [x0, y0, x1, y1] = it.r;
  const cands = [];
  for (const rr of room ? room.rects : []) {
    if (Math.abs(x0 - rr[0]) < EPS) cands.push([[1, 0], y1 - y0]);
    if (Math.abs(x1 - rr[2]) < EPS) cands.push([[-1, 0], y1 - y0]);
    if (Math.abs(y0 - rr[1]) < EPS) cands.push([[0, 1], x1 - x0]);
    if (Math.abs(y1 - rr[3]) < EPS) cands.push([[0, -1], x1 - x0]);
  }
  cands.sort((a, b) => b[1] - a[1]);
  return cands.length ? cands[0][0] : [0, 1];
}

// Local frame: u across (right of a person facing the front), v from back (0) to front (D), z up.
export function frame(it, f = frontOf(it)) {
  const [x0, y0, x1, y1] = it.r;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const alongX = f[0] !== 0;
  const D = alongX ? x1 - x0 : y1 - y0, W = alongX ? y1 - y0 : x1 - x0;
  const right = [f[1], -f[0]];
  const bx = cx - (f[0] * D) / 2, by = cy - (f[1] * D) / 2;
  const P = (u, v) => [bx + right[0] * u + f[0] * v, by + right[1] * u + f[1] * v];
  return { W, D, f, P };
}

export function makeKit(mb, it, group = 'items') {
  const fr = frame(it);
  const zone = it.room ? Z[it.room] : zoneAt((it.r[0] + it.r[2]) / 2, (it.r[1] + it.r[3]) / 2);
  const B = (u0, v0, z0, u1, v1, z1, mat, opts) => {
    const a = fr.P(u0, v0), b = fr.P(u1, v1);
    mb.box(group, mat, [Math.min(a[0], b[0]), Math.min(a[1], b[1]), z0, Math.max(a[0], b[0]), Math.max(a[1], b[1]), z1], zone, opts);
  };
  const C = (u, v, r, z0, z1, mat, opts) => { const p = fr.P(u, v); mb.cylinder(group, mat, p[0], p[1], r, z0, z1, zone, opts); };
  // Box tilted about the local u axis (for backrests): from (v, z) at the bottom, rising at angle a.
  const T = (u0, u1, v, z, len, thick, a, mat) => {
    const f = fr.f, right = [f[1], -f[0]];
    const dir = [f[0] * -Math.cos(a), f[1] * -Math.cos(a), Math.sin(a)]; // leans back towards v = 0
    const nrm = [f[0] * Math.sin(a), f[1] * Math.sin(a), Math.cos(a)];
    const p = fr.P((u0 + u1) / 2, v);
    const c = [p[0] + dir[0] * len / 2 + nrm[0] * thick / 2, p[1] + dir[1] * len / 2 + nrm[1] * thick / 2, z + dir[2] * len / 2 + nrm[2] * thick / 2];
    mb.obox(group, mat, c, [(u1 - u0) / 2, len / 2, thick / 2], [[right[0], right[1], 0], dir, nrm], zone);
  };
  // Soft box (upholstery, bedding) in the vertex-lit 'decor' group: local (u, v, z) ranges,
  // tilt = lean back in degrees (top towards v = 0), rot = turn about z in degrees.
  const S = (u0, v0, z0, u1, v1, z1, mat, { tilt = 0, rot = 0, ...opts } = {}) => {
    const f = fr.f, right = [f[1], -f[0], 0], fwd = [f[0], f[1], 0];
    const t = (tilt * Math.PI) / 180, q = (rot * Math.PI) / 180;
    const R = right.map((v, k) => v * Math.cos(q) + fwd[k] * Math.sin(q));
    const F0 = fwd.map((v, k) => v * Math.cos(q) - right[k] * Math.sin(q));
    const F = F0.map((v, k) => v * Math.cos(t) + [0, 0, 1][k] * Math.sin(t));
    const U = [0, 0, 1].map((v, k) => v * Math.cos(t) - F0[k] * Math.sin(t));
    const p = fr.P((u0 + u1) / 2, (v0 + v1) / 2);
    mb.rbox('decor', mat, [p[0], p[1], (z0 + z1) / 2], [(u1 - u0) / 2, (v1 - v0) / 2, (z1 - z0) / 2], zone, { axes: [R, F, U], ...opts });
  };
  return { ...fr, zone, B, C, T, S };
}

const legs4 = (k, inset, z1, s, mat) => {
  const { W, D, B } = k;
  for (const [u, v] of [[-W / 2 + inset, inset], [W / 2 - inset - s, inset], [-W / 2 + inset, D - inset - s], [W / 2 - inset - s, D - inset - s]]) B(u, v, 0, u + s, v + s, z1, mat);
};

const BUILD = {
  bed(k, it) {
    const { W, D, B } = k;
    B(-W / 2 + 0.08, 0.1, 0, W / 2 - 0.08, D - 0.08, 0.1, 'walnut');            // recessed plinth (shadow gap)
    B(-W / 2, 0.08, 0.1, W / 2, D, 0.3, 'oak');                                  // platform
    const { S } = k, kid = it.room === 'kid';
    S(-W / 2 + 0.03, 0.1, 0.3, W / 2 - 0.03, D - 0.03, 0.5, 'linenWhite', { r: 0.05 });                        // mattress
    S(-W / 2 - 0.015, 0.74, 0.47, W / 2 + 0.015, D + 0.015, 0.565, kid ? 'linenSage' : 'linenWhite', { r: 0.045, bulge: 0.012 });   // duvet, over the edges
    S(-W / 2 - 0.005, 0.68, 0.535, W / 2 + 0.005, 0.95, 0.6, kid ? 'linenSage' : 'linenWhite', { r: 0.03, bulge: 0.006 });          // turned-down top
    S(-W / 2 - 0.03, D - 0.62, 0.55, W / 2 + 0.03, D - 0.26, 0.6, kid ? 'linenMustard' : 'linenOat', { r: 0.022 });              // throw at the foot
    const n = W > 1.5 ? 2 : 1, pw = W > 1.5 ? 0.74 : 0.7;
    for (let i = 0; i < n; i++) { const u = -((n * pw + (n - 1) * 0.06) / 2) + i * (pw + 0.06); S(u, 0.1, 0.48, u + pw, 0.48, 0.66, 'linenWhite', { r: 0.07, bulge: 0.03, tilt: 22 }); }
    S(-W / 2 - 0.06, 0, 0.05, W / 2 + 0.06, 0.08, it.room === 'master' ? 1.1 : 0.95, 'linen', { r: 0.03, bulge: 0.004 });   // upholstered headboard
  },
  nightstand(k) { const { W, D, B } = k; B(-W / 2, 0.02, 0.16, W / 2, D, 0.5, 'walnut'); B(-W / 2 + 0.04, 0.06, 0, W / 2 - 0.04, D - 0.04, 0.16, 'frame'); },
  sofa(k, it) {
    const { W, D, B, S } = k;
    const fab = fabricOf(it);
    // an L: the corner seat of the long piece gets a back on its open end instead of an arm,
    // and the short piece leaves out the arm that meets it
    const arms = it.corner ? [-1] : it.id === 'sofa2' ? [1] : [-1, 1];
    B(-W / 2 + 0.06, 0.06, 0, W / 2 - 0.06, D - 0.06, 0.08, 'frame');
    S(-W / 2, 0, 0.08, W / 2, D, 0.38, fab, { r: 0.025 });                         // base
    S(-W / 2, 0, 0.36, W / 2, 0.2, 0.66, fab, { r: 0.05 });                         // back frame
    for (const sg of arms) S(sg < 0 ? -W / 2 : W / 2 - 0.2, 0.0, 0.36, sg < 0 ? -W / 2 + 0.2 : W / 2, D, 0.6, fab, { r: 0.06, bulge: 0.008 });
    if (it.corner) S(W / 2 - 0.2, 0.0, 0.36, W / 2, D, 0.66, fab, { r: 0.05 });   // the corner's side back
    const a0 = arms.includes(-1) ? 0.2 : 0.0, a1 = arms.includes(1) || it.corner ? 0.2 : 0.0;
    const n = Math.max(2, Math.round((W - a0 - a1) / 0.9)), sw = (W - a0 - a1) / n;
    for (let i = 0; i < n; i++) {
      const a = -W / 2 + a0 + i * sw;
      S(a + 0.004, 0.2, 0.38, a + sw - 0.004, D - 0.01, 0.52, fab, { r: 0.05, bulge: 0.014 });         // seat cushion
      S(a + 0.01, 0.215, 0.525, a + sw - 0.01, 0.405, 0.87, fab, { r: 0.07, bulge: 0.02, tilt: 10 });   // back cushion
    }
  },
  armchair(k, it) {
    const { W, D, S } = k;
    const fab = fabricOf(it);
    legs4(k, 0.05, 0.12, 0.04, it.room === 'ldk' ? 'birch' : it.room ? 'walnut' : 'teak');
    S(-W / 2, 0, 0.12, W / 2, D, 0.36, fab, { r: 0.025 });
    S(-W / 2, 0, 0.34, W / 2, 0.17, 0.78, fab, { r: 0.06, bulge: 0.01 });
    for (const sg of [-1, 1]) S(sg < 0 ? -W / 2 : W / 2 - 0.13, 0.0, 0.34, sg < 0 ? -W / 2 + 0.13 : W / 2, D, 0.58, fab, { r: 0.055 });
    S(-W / 2 + 0.135, 0.17, 0.35, W / 2 - 0.135, D - 0.01, 0.48, fab, { r: 0.045, bulge: 0.015 });
  },
  chair(k, it) {
    const { W, D, B } = k;
    if (it.room === 'kid') {                          // the kid's desk chair: oak frame, linen seat
      legs4(k, 0.02, 0.43, 0.035, 'oak');
      k.S(-W / 2 + 0.005, 0.0, 0.43, W / 2 - 0.005, D - 0.02, 0.475, 'linenSage', { r: 0.018, bulge: 0.006 });
      B(-W / 2, 0, 0.62, W / 2, 0.04, 0.82, 'oak');
      return;
    }
    // dining chairs as in the renders: a navy upholstered seat and tall back on light wood legs
    const fab = fabricOf(it);
    legs4(k, 0.03, 0.44, 0.032, it.room ? 'birch' : 'teak');
    k.S(-W / 2 + 0.005, 0.0, 0.42, W / 2 - 0.005, D - 0.01, 0.49, fab, { r: 0.02, bulge: 0.006 });
    k.S(-W / 2 + 0.01, 0.0, 0.47, W / 2 - 0.01, 0.06, 0.92, fab, { r: 0.022, tilt: 6 });
  },
  table(k, it) {
    const { W, D, B } = k;
    const out = !it.room;
    B(-W / 2, 0, 0.71, W / 2, D, 0.75, out ? 'anthracite' : 'birch');
    legs4(k, 0.06, 0.71, out ? 0.05 : 0.06, out ? 'frame' : 'birch');
  },
  ctable(k, it) {
    // a light wood block table on square legs (living room); a teak low table outside
    const { W, D, B } = k;
    const top = it.h || 0.36, mat = it.room ? 'birch' : 'teak';
    B(-W / 2, 0, top - 0.07, W / 2, D, top, mat);
    legs4(k, 0.0, top - 0.07, 0.08, mat);
  },
  stable(k) { const { C, W, D } = k; C(0, D / 2, Math.min(W, D) / 2, 0, 0.5, 'travertineSlab'); },
  stool(k) {
    // light wood legs with a foot rail, a round walnut seat (as in the renders)
    const { W, D, B, C } = k;
    for (const [u, v] of [[-0.13, 0.06], [0.105, 0.06], [-0.13, D - 0.085], [0.105, D - 0.085]]) B(u, v, 0, u + 0.025, v + 0.025, 0.64, 'birch');
    B(-0.14, 0.06, 0.26, 0.14, 0.085, 0.28, 'frame'); B(-0.14, D - 0.085, 0.26, 0.14, D - 0.06, 0.28, 'frame');
    C(0, D / 2, Math.min(W, D) / 2 - 0.005, 0.64, 0.69, 'walnut');
  },
  rug(k) { const { W, D, B } = k; B(-W / 2, 0, 0, W / 2, D, 0.012, 'rug'); },
  shelf(k, it) {
    const { W, D, B } = k;
    const h = it.h || 2.0;
    if (it.room === 'garage') { B(-W / 2, 0, 0, W / 2, D, h, 'concrete'); return; }
    const mat = it.room === 'pantry' ? 'lacquer' : it.room === 'kid' ? 'oak' : 'walnut', t = 0.025;
    B(-W / 2, 0, 0, W / 2, D, 0.08, 'frame');
    B(-W / 2, 0, 0.08, -W / 2 + t, D, h, mat);
    B(W / 2 - t, 0, 0.08, W / 2, D, h, mat);
    B(-W / 2 + t, 0, h - t, W / 2 - t, D, h, mat);
    B(-W / 2 + t, 0, 0.08, W / 2 - t, 0.012, h - t, mat);
    const bays = Math.max(1, Math.round(W / 0.8));
    for (let i = 1; i < bays; i++) { const u = -W / 2 + (i * W) / bays; B(u - t / 2, 0.012, 0.08, u + t / 2, D, h - t, mat); }
    for (let z = 0.08 + 0.38; z < h - 0.2; z += 0.38) B(-W / 2 + t, 0.012, z, W / 2 - t, D, z + t, mat);
    B(-W / 2 + t, 0.012, 0.08, W / 2 - t, D, 0.08 + t, mat);
  },
  wardrobe(k, it) {
    const { W, D, B } = k;
    const h = it.h || 2.4;
    if (it.open) {
      B(-W / 2, 0, 0, W / 2, D, 0.08, 'frame');
      for (const u of [-W / 2, W / 2 - 0.025]) B(u, 0, 0.08, u + 0.025, D, h, 'oak');
      const bays = Math.max(1, Math.round(W / 1.0));
      for (let i = 1; i < bays; i++) { const u = -W / 2 + (i * W) / bays; B(u - 0.012, 0, 0.08, u + 0.012, D, h, 'oak'); }
      B(-W / 2, 0, h - 0.025, W / 2, D, h, 'oak');
      B(-W / 2, 0, 1.95, W / 2, D, 1.975, 'oak');
      B(-W / 2, D / 2 - 0.01, 1.82, W / 2, D / 2 + 0.01, 1.84, 'frame');
      return;
    }
    B(-W / 2 + 0.03, 0, 0, W / 2 - 0.03, D - 0.05, 0.08, 'frame');
    B(-W / 2, 0, 0.08, W / 2, D, h, 'oak');
    const n = Math.max(1, Math.round(W / 0.55));
    for (let i = 1; i < n; i++) {
      const u = -W / 2 + (i * W) / n;
      const p0 = k.P(u, D + 0.001), p1 = k.P(u, D + 0.001);
      k.mbLine(p0, p1, 0.08, h);
    }
  },
  tall(k, it) {
    const { W, D, B } = k;
    const h = it.h || 2.4;
    const mat = it.room === 'ldk' ? 'lacquer' : 'walnut';
    B(-W / 2 + 0.03, 0, 0, W / 2 - 0.03, D - 0.06, 0.1, 'frame');
    B(-W / 2, 0, 0.1, W / 2, D, h, mat);
    const n = Math.max(1, Math.round(W / 0.6));
    for (let i = 1; i < n; i++) { const u = -W / 2 + (i * W) / n; k.mbLine(k.P(u, D + 0.001), k.P(u, D + 0.001), 0.1, h); }
  },
  counter(k) {
    // walnut base units, white quartz top and splashback, walnut wall cabinets with a light
    // under them, white panel up to the tall units' height (as in the renders)
    const { W, D, B } = k;
    B(-W / 2, 0, 0, W / 2, D - 0.07, 0.1, 'frame');
    B(-W / 2, 0, 0.1, W / 2, D, 0.88, 'walnut');
    B(-W / 2, 0, 0.88, W / 2, D + 0.02, 0.92, 'marble');
    B(-W / 2, 0, 0.92, W / 2, 0.02, 1.5, 'marble');                // splashback
    B(-W / 2, 0, 1.5, W / 2, 0.36, 2.22, 'walnut');                // wall cabinets
    B(-W / 2, 0, 2.22, W / 2, 0.36, 2.4, 'lacquer');                // bulkhead flush with the tall units
    const n = Math.max(1, Math.round(W / 0.6));
    for (let i = 1; i < n; i++) { const u = -W / 2 + (i * W) / n; k.mbLine(k.P(u, 0.361), k.P(u, 0.361), 1.5, 2.22); k.mbLine(k.P(u, D + 0.001), k.P(u, D + 0.001), 0.1, 0.88); }
  },
  fridge(k) {
    const { W, D, B } = k;
    B(-W / 2 + 0.01, 0, 0, W / 2 - 0.01, D, 1.86, 'steel');
    B(-W / 2, 0, 1.86, W / 2, D, 2.4, 'lacquer');                   // cabinet over it
    k.mbLine(k.P(0, D + 0.001), k.P(0, D + 0.001), 0.95, 1.86);
    k.mbLine(k.P(-W / 2, D + 0.001), k.P(W / 2, D + 0.001), 0.95, 0.95);
    for (const u of [-0.03, 0.02]) B(u, D, 1.0, u + 0.015, D + 0.04, 1.6, 'frame');
  },
  cooktop(k) { const { W, D, B } = k; B(-W / 2 + 0.03, 0.03, 0.92, W / 2 - 0.03, D - 0.03, 0.926, 'blackGlass'); },
  island(k, it) {
    const [x0, y0, x1, y1] = it.r;
    const [ox, oy, over] = it.overhang || [0, 1, 0.3];
    const body = x1 - x0 >= y1 - y0 ? [x0 + 0.06, y0, x1 - 0.06, y1] : [x0, y0 + 0.06, x1, y1 - 0.06];
    if (oy > 0) body[3] -= over; if (oy < 0) body[1] += over; if (ox > 0) body[2] -= over; if (ox < 0) body[0] += over;
    const z = k.zone, mb = k.mb;
    mb.box('items', 'frame', [body[0] + 0.07, body[1] + 0.07, 0, body[2] - 0.07, body[3] - 0.07, 0.1], z);
    mb.box('items', 'walnut', [body[0], body[1], 0.1, body[2], body[3], 0.86], z);
    if (x1 - x0 >= y1 - y0) {                                      // waterfall ends on the short sides
      mb.box('items', 'marble', [x0, y0, 0, x0 + 0.06, y1, 0.86], z);
      mb.box('items', 'marble', [x1 - 0.06, y0, 0, x1, y1, 0.86], z);
    } else {
      mb.box('items', 'marble', [x0, y0, 0, x1, y0 + 0.06, 0.86], z);
      mb.box('items', 'marble', [x0, y1 - 0.06, 0, x1, y1, 0.86], z);
    }
    const sink = ITEMS.find((s) => s.kind === 'sink' && s.r[0] >= x0 && s.r[2] <= x1 && s.r[1] >= y0 && s.r[3] <= y1);
    const holes = sink ? [sink.r] : [];
    const top = [x0, y0, x1, y1];
    const xs = [...new Set([x0, x1, ...holes.flatMap((h) => [h[0], h[2]])])].sort((a, b) => a - b);
    const ys = [...new Set([y0, y1, ...holes.flatMap((h) => [h[1], h[3]])])].sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
      if (holes.some((h) => cx > h[0] && cx < h[2] && cy > h[1] && cy < h[3])) continue;
      mb.rect('items', 'marble', 'z', 1, 0.92, [xs[i], xs[i + 1]], [ys[j], ys[j + 1]], z);
    }
    mb.rect('items', 'marble', 'y', -1, y0, [x0, x1], [0.86, 0.92], z); mb.rect('items', 'marble', 'y', 1, y1, [x0, x1], [0.86, 0.92], z);
    mb.rect('items', 'marble', 'x', -1, x0, [y0, y1], [0.86, 0.92], z); mb.rect('items', 'marble', 'x', 1, x1, [y0, y1], [0.86, 0.92], z);
    mb.rect('items', 'marble', 'z', -1, 0.86, [x0, x1], [y0, y1], z, { lines: false });
    if (sink) {
      const [a, b, c, d] = sink.r;
      mb.rect('items', 'steel', 'z', 1, 0.72, [a, c], [b, d], z);
      mb.rect('items', 'steel', 'x', 1, a, [b, d], [0.72, 0.92], z);
      mb.rect('items', 'steel', 'x', -1, c, [b, d], [0.72, 0.92], z);
      mb.rect('items', 'steel', 'y', 1, b, [a, c], [0.72, 0.92], z);
      mb.rect('items', 'steel', 'y', -1, d, [a, c], [0.72, 0.92], z);
      const alongY = d - b > c - a;
      const tx = alongY ? a - 0.05 : (a + c) / 2, ty = alongY ? (b + d) / 2 : d + 0.05;
      mb.cylinder('items', 'frame', tx, ty, 0.016, 0.92, 1.24, z);
      mb.box('items', 'frame', alongY ? [tx, ty - 0.012, 1.2, tx + 0.2, ty + 0.012, 1.225] : [tx - 0.012, ty - 0.2, 1.2, tx + 0.012, ty, 1.225], z);
    }
  },
  wc(k) {
    const { B } = k;
    B(-0.18, 0.0, 0.26, 0.18, 0.54, 0.4, 'ceramic');
    B(-0.18, 0.05, 0.4, 0.18, 0.545, 0.42, 'ceramic');
    B(-0.11, -0.005, 0.98, 0.11, 0.008, 1.12, 'frame');
  },
  basin(k) {
    const { W, D, B } = k;
    B(-W / 2, 0, 0.7, W / 2, D, 0.85, 'ceramic');
    B(-0.012, 0, 0.95, 0.012, 0.13, 0.975, 'frame');
    B(-W / 2 + 0.02, -0.002, 1.08, W / 2 - 0.02, 0.008, 1.78, 'mirror');
  },
  vanity(k, it) {
    const { W, D, B } = k;
    B(-W / 2, 0, 0.3, W / 2, D, 0.8, 'walnut');
    B(-W / 2, 0, 0.8, W / 2, D + 0.01, 0.84, 'marble');
    const n = it.basins || 1;
    for (let i = 0; i < n; i++) {
      const u = -W / 2 + ((i + 0.5) * W) / n;
      B(u - 0.21, D / 2 - 0.15, 0.84, u + 0.21, D / 2 + 0.17, 0.97, 'ceramic');
      B(u - 0.012, 0, 1.1, u + 0.012, D / 2 - 0.06, 1.125, 'frame');
    }
    B(-W / 2 + 0.04, -0.002, 1.12, W / 2 - 0.04, 0.01, 2.0, 'mirror');
  },
  shower(k, it) {
    const z = k.zone, mb = k.mb;
    const [x0, y0, x1, y1] = it.r;
    const room = ROOMS.find((r) => r.id === it.room).rects[0];
    const t = 0.012, top = ceilingOf(it.room);
    // large-format porcelain on the walls that bound the shower
    if (Math.abs(y0 - room[1]) < EPS) mb.box('items', 'showerTile', [x0, y0, 0, x1, y0 + t, top], z, { skip: ['y-'] });
    if (Math.abs(y1 - room[3]) < EPS) mb.box('items', 'showerTile', [x0, y1 - t, 0, x1, y1, top], z, { skip: ['y+'] });
    if (Math.abs(x0 - room[0]) < EPS) mb.box('items', 'showerTile', [x0, y0 + t, 0, x0 + t, y1, top], z, { skip: ['x-'] });
    if (Math.abs(x1 - room[2]) < EPS) mb.box('items', 'showerTile', [x1 - t, y0 + t, 0, x1, y1, top], z, { skip: ['x+'] });
    // linear drain along the back wall, rain head
    const drainY = Math.abs(y0 - room[1]) < EPS ? y0 + 0.08 : y1 - 0.12;
    mb.box('items', 'frame', [x0 + 0.1, drainY, 0, x1 - 0.1, drainY + 0.04, 0.003], z);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    mb.cylinder('items', 'frame', cx, cy - 0.15, 0.15, 2.3, 2.315, z);
    mb.cylinder('items', 'frame', cx, cy - 0.15, 0.012, 2.315, 2.8, z, { caps: [false, false] });
    for (const [gx0, gy0, gx1, gy1] of it.glass || []) {
      const gr = gx1 - gx0 > gy1 - gy0 ? [gx0, gy0 - 0.005, gx1, gy1 + 0.005] : [gx0 - 0.005, gy0, gx1 + 0.005, gy1];
      for (const sgn of [-1, 1]) {
        if (gr[2] - gr[0] > gr[3] - gr[1]) mb.rect('items', 'glass', 'y', sgn, sgn < 0 ? gr[1] : gr[3], [gr[0], gr[2]], [0, 2.0], z, { lines: false });
        else mb.rect('items', 'glass', 'x', sgn, sgn < 0 ? gr[0] : gr[2], [gr[1], gr[3]], [0, 2.0], z, { lines: false });
      }
      mb.box('items', 'frame', [gr[0], gr[1] - 0.005, 1.99, gr[2], gr[3] + 0.005, 2.01], z);
      const ln = (a, b) => mb.line('items', a, b, z, z);
      if (gr[2] - gr[0] > gr[3] - gr[1]) { ln([gr[0], gy0, 0], [gr[0], gy0, 2]); ln([gr[2], gy0, 0], [gr[2], gy0, 2]); }
      else { ln([gx0, gr[1], 0], [gx0, gr[1], 2]); ln([gx0, gr[3], 0], [gx0, gr[3], 2]); }
    }
  },
  desk(k) {
    const { W, D, B } = k;
    B(-W / 2, 0, 0.71, W / 2, D, 0.74, 'oak');
    B(-W / 2 + 0.03, 0.04, 0, -W / 2 + 0.06, D - 0.04, 0.71, 'frame');
    B(W / 2 - 0.06, 0.04, 0, W / 2 - 0.03, D - 0.04, 0.71, 'frame');
    B(-W / 2 + 0.06, 0.02, 0.6, W / 2 - 0.06, 0.05, 0.71, 'frame');
  },
  bench(k, it) {
    const { W, D, B } = k;
    if (it.room === 'master') { legs4(k, 0.04, 0.3, 0.04, 'walnut'); k.S(-W / 2, 0, 0.3, W / 2, D, 0.45, 'linen', { r: 0.04, bulge: 0.01 }); return; }
    B(-W / 2, 0, 0.0, -W / 2 + 0.04, D, 0.43, 'oak');
    B(W / 2 - 0.04, 0, 0.0, W / 2, D, 0.43, 'oak');
    B(-W / 2, 0, 0.41, W / 2, D, 0.45, 'oak');
  },
  sideboard(k, it) {
    const { W, D, B } = k;
    B(-W / 2 + 0.05, 0.04, 0, W / 2 - 0.05, D - 0.05, 0.1, 'frame');
    B(-W / 2, 0, 0.1, W / 2, D, it.h || 0.6, 'walnut');
  },
  lounger(k) {
    // low teak frame on black feet, a thick outdoor cushion, the back raised at 40° on a teak support
    const { W, D, B, T, S } = k;
    legs4(k, 0.08, 0.1, 0.05, 'frame');
    B(-W / 2, 0, 0.1, W / 2, D, 0.2, 'teak');
    S(-W / 2 + 0.02, 0.6, 0.19, W / 2 - 0.02, D - 0.02, 0.31, 'outdoorFabric', { r: 0.045, bulge: 0.012 });
    const a = (40 * Math.PI) / 180, L = 0.66, base = [0.6, 0.22];
    T(-W / 2 + 0.05, W / 2 - 0.05, base[0], base[1] - 0.02, L, 0.04, a, 'teak');
    const v = base[0] - Math.cos(a) * L / 2 + Math.sin(a) * 0.085, z = base[1] + Math.sin(a) * L / 2 + Math.cos(a) * 0.085;
    S(-W / 2 + 0.03, v - 0.045, z - L / 2, W / 2 - 0.03, v + 0.045, z + L / 2, 'outdoorFabric', { r: 0.04, bulge: 0.01, tilt: 50 });
  },
  firebowl(k) {
    // cast concrete bowl on a short foot, lava stones and embers inside (flames are added on the site)
    const { W, D } = k, R = Math.min(W, D) / 2, p = k.P(0, D / 2), z = k.zone;
    k.mb.lathe('decor', 'fireConcrete', p[0], p[1], 0, [[0, 0], [R * 0.42, 0], [R * 0.42, 0.24], [R * 0.6, 0.27], [R * 0.93, 0.4], [R, 0.45], [R - 0.035, 0.45], [R * 0.86, 0.38], [R * 0.5, 0.32], [0, 0.31]], z, { seg: 40 });
    for (let i = 0; i < 9; i++) {
      const a2 = i * 2.4, r2 = R * 0.12 + (i % 3) * R * 0.17;
      k.mb.lathe('decor', 'stonewareDark', p[0] + Math.cos(a2) * r2, p[1] + Math.sin(a2) * r2, 0.315, [[0, 0], [0.05, 0.01], [0.055, 0.04], [0, 0.06]], z, { seg: 7 });
    }
    k.mb.lathe('decor', 'fire', p[0], p[1], 0.33, [[0, 0], [R * 0.55, 0], [R * 0.4, 0.015], [0, 0.02]], z, { seg: 24 });
  },
  media(k) {
    // low walnut media unit, the television on the wall above it
    const { W, D, B } = k;
    B(-W / 2 + 0.04, 0.02, 0, W / 2 - 0.04, D - 0.04, 0.08, 'frame');
    B(-W / 2, 0, 0.08, W / 2, D, 0.45, 'walnut');
    const n = 3;
    for (let i = 1; i < n; i++) { const u = -W / 2 + (i * W) / n; k.mbLine(k.P(u, D + 0.001), k.P(u, D + 0.001), 0.08, 0.45); }
    B(-0.73, 0, 1.0, 0.73, 0.04, 1.83, 'blackGlass');
  },
  bbq(k) {
    // outdoor kitchen under the pergola: anthracite counter, steel grill hood, a teak top
    const { W, D, B } = k;
    B(-W / 2, 0, 0, W / 2, D, 0.86, 'anthracite');
    B(-W / 2 - 0.02, 0, 0.86, W / 2 + 0.02, D + 0.03, 0.9, 'teak');
    B(-0.38, 0.06, 0.9, 0.38, D - 0.06, 1.1, 'steel');
    k.C(0, D / 2, 0.012, 1.1, 1.13, 'frame');
    B(-0.36, D - 0.07, 1.0, 0.36, D - 0.05, 1.03, 'frame');
  },
  laundry(k) {
    const { W, D, B } = k;
    B(-W / 2, 0, 0, W / 2, D - 0.06, 0.1, 'frame');
    B(-W / 2, 0, 0.1, W / 2, D, 0.88, 'plaster');
    B(-W / 2, 0, 0.88, W / 2, D + 0.02, 0.92, 'oak');
    B(-W / 2, 0, 0.92, W / 2, 0.02, 1.5, 'travertineWall');
  },
  tank(k) { const { C, W, D } = k; C(0, D / 2, Math.min(W, D) / 2 - 0.02, 0, 1.8, 'ceramic'); },
  equipment(k) { const { W, D, B } = k; B(-W / 2, 0, 0, W / 2, D, 1.0, 'concrete'); },
  car(k) {
    const { W, D, B } = k;
    for (const v of [0.55, D - 1.2]) for (const u of [-W / 2 + 0.05, W / 2 - 0.27]) B(u, v, 0, u + 0.22, v + 0.66, 0.66, 'tyre');
    B(-W / 2 + 0.05, 0.08, 0.2, W / 2 - 0.05, D - 0.08, 0.78, 'car');
    B(-W / 2 + 0.18, D * 0.3, 0.78, W / 2 - 0.18, D * 0.74, 1.38, 'carGlass');
  },
};

// 1..99 = furniture inside, 101.. = outdoor furniture (used by the framing check)
export const itemCode = (it) => { const i = ITEMS.indexOf(it); return i >= 0 ? i + 1 : 101 + SITE.outdoor.indexOf(it); };
export const itemByCode = (c) => (c >= 200 ? { id: `lamp:${LAMPS[c - 200]?.id}` } : c === 199 ? { id: 'styling' } : c >= 101 ? SITE.outdoor[c - 101] : ITEMS[c - 1]);

export function furnish(mb, rectMinus) {
  const add = (it, group) => {
    const k = makeKit(mb, it, group);
    k.mb = mb;
    k.rectMinus = rectMinus;
    k.mbLine = (p0, p1, z0, z1) => mb.line(group, [p0[0], p0[1], z0], [p1[0], p1[1], z1], k.zone, k.zone);
    const fn = BUILD[it.kind];
    mb.item = itemCode(it);
    mb.grainX = it.r[2] - it.r[0] > it.r[3] - it.r[1];
    if (fn) fn(k, it);
    mb.item = 0;
    mb.grainX = false;
  };
  for (const it of ITEMS) add(it, 'items');
  for (const it of SITE.outdoor) add(it, 'items');
  return mb;
}
