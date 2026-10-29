// Walls, openings, floors, ceilings, skylights and roofs, generated from the plan data.
// Three volumes of different heights and finishes (timber, white render, anthracite), a grey
// concrete plinth, the standing-seam metal fascia of the front block and the recessed porch.
import { WALLS, OPENINGS, SKYLIGHTS, ROOMS, VOLUMES, ACCENTS, SITE } from '../plan-data.js';
import { isH, overlap, doorLeaf } from '../geometry.js';
import { Z, zoneAt, roomAt, ceilingOf, volumeOf, inBuilding, SPLIT_Y } from './zones.js';
import { MeshBuilder } from './mesh-builder.js';

export const LV = {
  ground: -0.02,     // paving around the house, flush with the floor
  lawn: -0.15,
  plinth: 0.22,      // top of the grey concrete plinth band
};

export const FLOOR = {
  hall: 'oakFloor', kid: 'oakFloor', master: 'oakFloor', ensuite: 'stoneTile', guest: 'oakFloor', bath: 'stoneTile',
  wc: 'stoneTile', pantry: 'oakFloor', ldk: 'oakFloor', garage: 'concrete',
};

const GLASS_IN = 0.12;   // frame plane, measured in from the outside face
const isExt = (w) => w.t === 'ext';
const sidesOf = (w) => (isH(w.r) ? { s: 0, c: 1, faceAxis: 'y', endAxis: 'x' } : { s: 1, c: 0, faceAxis: 'x', endAxis: 'y' });
const EPS = 1e-6;
const volOf = (w) => VOLUMES[w.vol];

function roomsBeside(w) {
  const h = isH(w.r), out = [];
  for (let s = w.r[h ? 0 : 1] + 0.05; s < w.r[h ? 2 : 3]; s += 0.25) {
    for (const off of [-0.06, 0.06]) {
      const p = h ? [s, (off < 0 ? w.r[1] : w.r[3]) + off] : [(off < 0 ? w.r[0] : w.r[2]) + off, s];
      const r = roomAt(p[0], p[1]);
      if (r) out.push(r);
    }
  }
  return [...new Set(out)];
}

export function wallTop(w) {
  if (w.t === 'ext' || w.t === 'vol') return volOf(w).top;
  return Math.max(2.7, ...roomsBeside(w).map(ceilingOf));
}

// lowest roof over a point inside a building (wall cores, the porch)
function roofAt(x, y) {
  const vs = Object.values(VOLUMES).filter((v) => x >= v.r[0] - EPS && x <= v.r[2] + EPS && y >= v.r[1] - EPS && y <= v.r[3] + EPS);
  return vs.length ? Math.min(...vs.map((v) => v.roof)) : 0;
}

// Exterior finish of wall w at position s along it and height z.
function finishOf(w, s, z) {
  const v = volOf(w);
  if (z < LV.plinth - 1e-4 && w.vol !== 'garage') return 'plinth';
  if (v.fascia && z > v.fascia[0] - 1e-4) return 'metal';
  const band = (w.fins || []).find((f) => s >= f.s[0] - 1e-4 && s <= f.s[1] + 1e-4);
  return band ? band.m : w.fin || v.fin;
}
// finish of a parapet's inside face (above the roof)
const parapetOf = (w) => (volOf(w).fin === 'render' ? 'render' : 'metal');

// What a face of wall w sees at plan point p: 'out' (garden, street, porch), 'room', or 'core'.
function sideKind(p) {
  const room = roomAt(p[0], p[1]);
  if (room) return { kind: 'room', room };
  return inBuilding(p[0], p[1]) ? { kind: 'core' } : { kind: 'out' };
}

// Split a vertical span [za, zb] of a face into material bands.
// ctx: { w, s (position along the wall), p (probe point), interior accent material or null }
function faceBands(ctx, za, zb) {
  const { w, s, p } = ctx;
  const sk = sideKind(p);
  const v = volOf(w);
  const cuts = new Set([za, zb]);
  const add = (z) => { if (z > za + 1e-4 && z < zb - 1e-4) cuts.add(z); };
  let pick;
  if (sk.kind === 'out') {
    add(LV.plinth); if (v.fascia) add(v.fascia[0]);
    pick = (z) => finishOf(w, s, z);
  } else if (sk.kind === 'room') {
    const ceil = ceilingOf(sk.room), roof = volumeOf(sk.room).roof;
    add(ceil); add(roof);
    pick = (z) => (z < ceil ? ctx.accent || 'plaster' : z < roof ? 'plaster' : w.t === 'int' ? 'plaster' : z > v.roof - 1e-4 && w.t === 'ext' ? parapetOf(w) : finishOf(w, s, z));
  } else {
    const roof = roofAt(p[0], p[1]);
    add(roof); if (v.fascia) add(v.fascia[0]);
    pick = (z) => (z < roof ? 'plaster' : finishOf(w, s, z));
  }
  const ts = [...cuts].sort((a, b) => a - b), out = [];
  for (let i = 0; i < ts.length - 1; i++) out.push([ts[i], ts[i + 1], pick((ts[i] + ts[i + 1]) / 2)]);
  return out;
}

function accentAt(axis, sign, c, u) {
  const a = ACCENTS.find((q) => q.axis === axis && q.sign === sign && Math.abs(q.c - c) < 1e-4 && u >= q.u[0] - 1e-4 && u <= q.u[1] + 1e-4);
  return a ? a.m : null;
}

function openingSpan(o) {
  return [o.sill ?? 0, o.head];
}

// Which cross-side of an external wall faces outside: -1 (low) or +1 (high).
function outsideSide(w) {
  const { c } = sidesOf(w);
  const mid = isH(w.r) ? (w.r[0] + w.r[2]) / 2 : (w.r[1] + w.r[3]) / 2;
  const P = (v) => (isH(w.r) ? [mid, v] : [v, mid]);
  const lo = sideKind(P(w.r[c] - 0.05)), hi = sideKind(P(w.r[c + 2] + 0.05));
  if (lo.kind === 'out' && hi.kind !== 'out') return -1;
  if (hi.kind === 'out' && lo.kind !== 'out') return 1;
  return lo.kind === 'out' ? -1 : 1;
}

const roomBoundaries = (axis) => {
  const k = axis === 'x' ? [0, 2] : [1, 3];
  const set = new Set();
  for (const room of ROOMS) for (const r of room.rects) { set.add(r[k[0]]); set.add(r[k[1]]); }
  for (const v of Object.values(VOLUMES)) { set.add(v.r[k[0]]); set.add(v.r[k[1]]); }
  for (const w of WALLS) for (const f of w.fins || []) { set.add(f.s[0]); set.add(f.s[1]); }
  for (const a of ACCENTS) if (a.axis !== axis) { set.add(a.u[0]); set.add(a.u[1]); }
  if (axis === 'y') set.add(SPLIT_Y);
  return [...set];
};

export function buildArchitecture(mb = new MeshBuilder()) {
  const tops = new Map(WALLS.map((w) => [w.id, wallTop(w)]));
  const pt = (w, s, c) => (isH(w.r) ? [s, c] : [c, s]);

  for (const w of WALLS) {
    const { s, c, faceAxis, endAxis } = sidesOf(w);
    const s0 = w.r[s], s1 = w.r[s + 2], t0 = w.r[c], t1 = w.r[c + 2];
    const top = tops.get(w.id);
    const ops = OPENINGS.filter((o) => overlap(o.r, w.r));
    const outSide = isExt(w) ? outsideSide(w) : 0;

    // ---- the two long faces
    for (const side of [-1, 1]) {
      const cc = side < 0 ? t0 : t1;
      const covers = WALLS.filter((q) => q !== w && Math.abs((side < 0 ? q.r[c + 2] : q.r[c]) - cc) < 1e-6 && q.r[s] < s1 - EPS && q.r[s + 2] > s0 + EPS)
        .map((q) => ({ a: Math.max(q.r[s], s0), b: Math.min(q.r[s + 2], s1), top: tops.get(q.id) }));
      const cuts = new Set([s0, s1, ...covers.flatMap((v) => [v.a, v.b]), ...ops.flatMap((o) => [o.r[s], o.r[s + 2]]),
        ...roomBoundaries(s === 0 ? 'x' : 'y').filter((v) => v > s0 && v < s1)]);
      const ts = [...cuts].sort((a, b) => a - b);
      for (let i = 0; i < ts.length - 1; i++) {
        const a = ts[i], b = ts[i + 1];
        if (b - a < 1e-4) continue;
        const m = (a + b) / 2;
        const cov = covers.filter((v) => v.a <= m && v.b >= m);
        const probe = pt(w, m, cc + side * 0.06);
        const outside = sideKind(probe).kind === 'out';
        let z0 = outside ? LV.ground : 0;
        if (cov.length) z0 = Math.max(...cov.map((v) => v.top));
        if (z0 >= top - 1e-4) continue;
        const zone = zoneAt(...probe) || (outside ? zoneAt(...pt(w, m, cc + side * 0.6)) : Z.roof);
        const op = ops.find((o) => o.r[s] <= m && o.r[s + 2] >= m);
        const spans = [];
        if (op) {
          const [sill, head] = openingSpan(op);
          if (sill > z0) spans.push([z0, sill]);
          spans.push([Math.max(z0, head), top]);
        } else spans.push([z0, top]);
        const ctx = { w, s: m, p: probe, accent: accentAt(faceAxis, side, cc, m) };
        for (const [za, zb] of spans) {
          if (zb - za < 1e-4) continue;
          for (const [ba, bb, mat] of faceBands(ctx, za, zb)) mb.rect('arch', mat, faceAxis, side, cc, [a, b], [ba, bb], zone || Z.roof);
        }
      }
    }

    // ---- the two ends
    for (const side of [-1, 1]) {
      const se = side < 0 ? s0 : s1;
      const probe = pt(w, se + side * 0.01, (t0 + t1) / 2);
      const q = WALLS.find((v) => v !== w && probe[0] > v.r[0] && probe[0] < v.r[2] && probe[1] > v.r[1] && probe[1] < v.r[3]);
      const op = OPENINGS.find((o) => probe[0] > o.r[0] && probe[0] < o.r[2] && probe[1] > o.r[1] && probe[1] < o.r[3]);
      if (op) continue;                          // the jamb of an opening is built with the opening
      const outside = sideKind(pt(w, se + side * 0.06, (t0 + t1) / 2)).kind === 'out';
      const z0 = q ? tops.get(q.id) : outside ? LV.ground : 0;
      if (z0 >= top - 1e-4) continue;
      const p6 = pt(w, se + side * 0.06, (t0 + t1) / 2);
      const zone = zoneAt(...p6);
      const ctx = { w, s: se, p: p6, accent: null };
      for (const [ba, bb, mat] of faceBands(ctx, z0, top)) mb.rect('arch', mat, endAxis, side, se, [t0, t1], [ba, bb], zone || Z.roof);
    }

    // ---- top of the wall (coping on the parapets)
    const tz = isExt(w) || w.t === 'vol' ? Z.roof : zoneAt(...pt(w, (s0 + s1) / 2, t0 - 0.06)) || zoneAt(...pt(w, (s0 + s1) / 2, t1 + 0.06));
    const [x0, y0, x1, y1] = w.r;
    mb.rect('arch', isExt(w) || w.t === 'vol' ? 'coping' : 'plaster', 'z', 1, top, [x0, x1], [y0, y1], tz);

    // ---- openings: reveals, sills, heads, thresholds, frames and glass
    for (const o of ops) buildOpening(mb, w, o, outSide);
  }

  buildFloors(mb);
  buildCeilingsAndRoofs(mb);
  buildFascia(mb);
  return mb;
}

function buildOpening(mb, w, o, outSide) {
  const { s, c, endAxis } = sidesOf(w);
  const a = o.r[s], b = o.r[s + 2], t0 = w.r[c], t1 = w.r[c + 2];
  const [sill, head] = openingSpan(o);
  const ext = outSide !== 0;
  const H = isH(w.r);
  const zRect = (group, mat, sign, z, [sa, sb], [ca, cb], zone) =>
    mb.rect(group, mat, 'z', sign, z, H ? [sa, sb] : [ca, cb], H ? [ca, cb] : [sa, sb], zone);
  const pt = (sv, cv) => (H ? [sv, cv] : [cv, sv]);
  const mid = (a + b) / 2;
  const outFin = finishOf(w, mid, 1.2);
  const revealOut = outFin === 'render' ? 'render' : 'metal';     // grey window surrounds on timber and anthracite

  let parts;
  if (ext) {
    const outFace = outSide < 0 ? t0 : t1, inFace = outSide < 0 ? t1 : t0;
    const depth = o.kind === 'door' ? Math.abs(inFace - outFace) : o.kind === 'garage' ? 0.08 : o.kind === 'opening' ? Math.abs(inFace - outFace) : GLASS_IN;
    const cg = outFace - outSide * depth;
    const inSide = sideKind(pt(mid, inFace - outSide * 0.06));
    const zIn = zoneAt(...pt(mid, inFace - outSide * 0.06));
    const zOut = zoneAt(...pt(mid, outFace + outSide * 0.06));
    parts = [{ r: [Math.min(outFace, cg), Math.max(outFace, cg)], zone: zOut, out: true }];
    if (Math.abs(cg - inFace) > 1e-4) parts.push({ r: [Math.min(cg, inFace), Math.max(cg, inFace)], zone: zIn, out: inSide.kind === 'out' });
    o._plane = cg;
  } else {
    const hingeSide = o.hinge ? (Math.abs(o.hinge[c] - t0) < 1e-6 ? -1 : 1) : -1;
    const zA = zoneAt(...pt(mid, (hingeSide < 0 ? t0 : t1) + hingeSide * 0.06)) || zoneAt(...pt(mid, t0 - 0.06));
    parts = [{ r: [t0, t1], zone: zA, out: false }];
  }

  for (const p of parts) {
    if (p.r[1] - p.r[0] < 1e-4) continue;
    const wallMat = p.out ? revealOut : 'plaster';
    mb.rect('arch', wallMat, endAxis, 1, a, p.r, [sill, head], p.zone);
    mb.rect('arch', wallMat, endAxis, -1, b, p.r, [sill, head], p.zone);
    zRect('arch', wallMat, -1, head, [a, b], p.r, p.zone);
    if (sill > 0.02) {
      const sm = p.out ? 'coping' : sill <= 0.7 ? 'oak' : 'plaster';
      zRect('arch', sm, 1, sill, [a, b], p.r, p.zone);
    } else {
      const room = roomAt(...pt(mid, (p.r[0] + p.r[1]) / 2 + 0.2)) || roomAt(...pt(mid, (p.r[0] + p.r[1]) / 2 - 0.2));
      const fm = p.out ? 'paving' : (o.hinge ? FLOOR[roomAt(...pt(mid, o.hinge[c] + (o.swing[c] || 0) * 0.3))] : null) || FLOOR[room] || 'oakFloor';
      zRect('arch', fm, 1, Math.max(0, sill), [a, b], p.r, p.zone);
    }
  }

  if (o.kind === 'window' || o.kind === 'slider') buildGlazing(mb, w, o, outSide, parts);
  if (o.kind === 'garage') {
    const cg = o._plane, z = parts[0].zone;
    mb.rect('arch', 'garageDoor', H ? 'y' : 'x', outSide, cg, [a, b], [0, head], z);
    mb.rect('arch', 'frame', H ? 'y' : 'x', -outSide, cg - outSide * 0.04, [a, b], [0, head], parts[parts.length - 1].zone);
    for (let k = 1; k < 4; k++) {                      // the sectional door's panel joints
      const zz = (head * k) / 4;
      mb.line('arch', H ? [a, cg + outSide * 0.002, zz] : [cg + outSide * 0.002, a, zz], H ? [b, cg + outSide * 0.002, zz] : [cg + outSide * 0.002, b, zz], z, z);
      const r = H ? [a, Math.min(cg, cg + outSide * 0.012), zz - 0.006, b, Math.max(cg, cg + outSide * 0.012), zz + 0.006] : [Math.min(cg, cg + outSide * 0.012), a, zz - 0.006, Math.max(cg, cg + outSide * 0.012), b, zz + 0.006];
      mb.box('arch', 'frame', r, z, { lines: false });
    }
  }
}

function buildGlazing(mb, w, o, outSide, parts) {
  const { s, c } = sidesOf(w);
  const H = isH(w.r);
  const a = o.r[s], b = o.r[s + 2];
  const [sill, head] = openingSpan(o);
  const cg = o._plane;
  const zIn = parts[parts.length - 1].zone;
  const F = 0.05; // visible frame width
  const fbox = (sa, sb, ca, cb, za, zb, mat = 'frame', zone = zIn) => {
    const r = H ? [sa, ca, za, sb, cb, zb] : [ca, sa, za, cb, sb, zb];
    mb.box('arch', mat, r, zone);
  };
  const glass = (sa, sb, cc, za, zb, zone = zIn) => {
    mb.rect('arch', 'glass', H ? 'y' : 'x', 1, cc, [sa, sb], [za, zb], zone, { lines: false });
    mb.rect('arch', 'glass', H ? 'y' : 'x', -1, cc, [sa, sb], [za, zb], zone, { lines: false });
  };
  const c0 = cg + outSide * 0.035, c1 = cg - outSide * 0.035;
  const cl = Math.min(c0, c1), ch = Math.max(c0, c1);
  fbox(a, a + F, cl, ch, sill, head);
  fbox(b - F, b, cl, ch, sill, head);
  fbox(a, b, cl, ch, head - F, head);
  if (o.kind === 'window') {
    fbox(a, b, cl, ch, sill, sill + F);
    const n = (o.mullions || 0) + 1, pw = (b - a) / n;
    for (let i = 1; i < n; i++) fbox(a + i * pw - F * 0.7, a + i * pw + F * 0.7, cl, ch, sill, head);
    glass(a + F, b - F, cg, sill + F, head - F);
    return;
  }
  // slider: flush floor track, panels in two tracks
  fbox(a, b, cl, ch, -0.005, 0.012);
  const n = o.panels;
  const pw = (b - a - 2 * F) / n;
  const moving = new Map((o.slide || []).map(([i, j]) => [i, j]));
  for (let i = 0; i < n; i++) {
    const at = moving.has(i) ? moving.get(i) : i;
    const pa = a + F + at * pw, pb = pa + pw;
    const track = moving.has(i) ? -outSide : outSide;
    const pc = cg + track * 0.024;
    const pl = pc - 0.02, ph = pc + 0.02;
    fbox(pa, pa + F, pl, ph, 0.012, head - F);
    fbox(pb - F, pb, pl, ph, 0.012, head - F);
    fbox(pa + F, pb - F, pl, ph, 0.012, 0.012 + F * 1.4);
    fbox(pa + F, pb - F, pl, ph, head - F * 2, head - F);
    glass(pa + F, pb - F, pc, 0.012 + F * 1.4, head - F * 2);
  }
}

// -------------------------------------------------------------- floors
function buildFloors(mb) {
  for (const room of ROOMS) {
    for (const [x0, y0, x1, y1] of room.rects) mb.rect('arch', FLOOR[room.id], 'z', 1, 0, [x0, x1], [y0, y1], Z[room.id]);
  }
}

// rect minus holes → list of rects (grid split)
export function rectMinus(r, holes) {
  const hs = holes.filter((h) => overlap(h, r));
  if (!hs.length) return [r];
  const xs = [...new Set([r[0], r[2], ...hs.flatMap((h) => [Math.max(r[0], h[0]), Math.min(r[2], h[2])])])].sort((a, b) => a - b);
  const ys = [...new Set([r[1], r[3], ...hs.flatMap((h) => [Math.max(r[1], h[1]), Math.min(r[3], h[3])])])].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < xs.length - 1; i++) {
    let start = null;
    for (let j = 0; j < ys.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
      const free = !hs.some((h) => cx > h[0] && cx < h[2] && cy > h[1] && cy < h[3]);
      if (free && start === null) start = ys[j];
      if (!free && start !== null) { out.push([xs[i], start, xs[i + 1], ys[j]]); start = null; }
    }
    if (start !== null) out.push([xs[i], start, xs[i + 1], ys[ys.length - 1]]);
  }
  return out;
}

// roof surface of each volume: inside its parapet walls (wall cores and lower walls excluded)
export function roofRects() {
  const out = [];
  for (const [name, v] of Object.entries(VOLUMES)) {
    const own = WALLS.filter((w) => w.vol === name && w.t !== 'int').map((w) => w.r);
    const higher = Object.values(VOLUMES).filter((q) => q.top > v.top + 1e-4).map((q) => q.r);
    for (const r of rectMinus(v.r, [...own, ...higher])) out.push({ name, v, r });
  }
  return out;
}

// -------------------------------------------------------------- ceilings, skylights, roofs
function buildCeilingsAndRoofs(mb) {
  const holes = SKYLIGHTS.map((k) => k.r);
  for (const room of ROOMS) {
    const h = ceilingOf(room.id);
    for (const r of room.rects) for (const [x0, y0, x1, y1] of rectMinus(r, holes)) mb.rect('top', 'ceiling', 'z', -1, h, [x0, x1], [y0, y1], Z[room.id]);
  }
  const ups = [];
  for (const k of SKYLIGHTS) {
    const [x0, y0, x1, y1] = k.r;
    const room = roomAt((x0 + x1) / 2, (y0 + y1) / 2);
    const z = Z[room], h = ceilingOf(room), v = volumeOf(room), up = v.roof + 0.16;
    mb.rect('top', 'ceiling', 'x', 1, x0, [y0, y1], [h, up], z);
    mb.rect('top', 'ceiling', 'x', -1, x1, [y0, y1], [h, up], z);
    mb.rect('top', 'ceiling', 'y', 1, y0, [x0, x1], [h, up], z);
    mb.rect('top', 'ceiling', 'y', -1, y1, [x0, x1], [h, up], z);
    const u = 0.08;
    mb.rect('top', 'coping', 'x', -1, x0 - u, [y0 - u, y1 + u], [v.roof, up], Z.roof);
    mb.rect('top', 'coping', 'x', 1, x1 + u, [y0 - u, y1 + u], [v.roof, up], Z.roof);
    mb.rect('top', 'coping', 'y', -1, y0 - u, [x0 - u, x1 + u], [v.roof, up], Z.roof);
    mb.rect('top', 'coping', 'y', 1, y1 + u, [x0 - u, x1 + u], [v.roof, up], Z.roof);
    for (const [a, b] of [[[x0 - u, y0 - u], [x0, y1 + u]], [[x1, y0 - u], [x1 + u, y1 + u]], [[x0, y0 - u], [x1, y0]], [[x0, y1], [x1, y1 + u]]])
      mb.rect('top', 'coping', 'z', 1, up, [a[0], b[0]], [a[1], b[1]], Z.roof);
    mb.rect('top', 'glass', 'z', 1, up - 0.01, [x0, x1], [y0, y1], z, { lines: false });
    mb.rect('top', 'glass', 'z', -1, up - 0.01, [x0, x1], [y0, y1], z, { lines: false });
    ups.push([x0 - u, y0 - u, x1 + u, y1 + u]);
  }
  for (const { v, r } of roofRects()) for (const [x0, y0, x1, y1] of rectMinus(r, ups)) mb.rect('top', 'roof', 'z', 1, v.roof, [x0, x1], [y0, y1], Z.roof);
  // the porch soffit, anthracite like its walls
  const [px0, py0, px1, py1] = SITE.porch;
  mb.rect('top', 'anthracite', 'z', -1, VOLUMES.front.fascia[0], [px0, px1], [py0 + 0.3, py1], Z.front);
}

// -------------------------------------------------------------- the front block's metal fascia
// A standing-seam band round the street side and both ends: 40 mm proud of the cladding, a
// seam every 420 mm, a capping over the parapet.
function buildFascia(mb) {
  const v = VOLUMES.front, [z0, z1] = v.fascia, [x0, y0, x1, y1] = v.r, d = 0.04, rib = 0.025, step = 0.42;
  const zone = Z.front;
  const band = (r) => mb.box('arch', 'metal', r, zone, { skip: ['z+'] });
  band([x0 - d, y0 - d, z0, x1 + d, y0, z1]);
  band([x0 - d, y0, z0, x0, y1, z1]);
  band([x1, y0, z0, x1 + d, y1, z1]);
  mb.box('arch', 'coping', [x0 - d - 0.01, y0 - d - 0.01, z1, x1 + d + 0.01, y0 + 0.32, z1 + 0.03], zone);
  mb.box('arch', 'coping', [x0 - d - 0.01, y0 + 0.32, z1, x0 + 0.32, y1, z1 + 0.03], zone);
  mb.box('arch', 'coping', [x1 - 0.32, y0 + 0.32, z1, x1 + d + 0.01, y1, z1 + 0.03], zone);
  for (let x = x0 + step / 2; x < x1 - 0.1; x += step) mb.box('arch', 'metal', [x - 0.01, y0 - d - rib, z0, x + 0.01, y0 - d, z1], zone, { lines: false });
  for (let y = y0 + step / 2; y < y1 - 0.1; y += step) {
    mb.box('arch', 'metal', [x0 - d - rib, y - 0.01, z0, x0 - d, y + 0.01, z1], zone, { lines: false });
    mb.box('arch', 'metal', [x1 + d, y - 0.01, z0, x1 + d + rib, y + 0.01, z1], zone, { lines: false });
  }
}

// -------------------------------------------------------------- doors (separate, they move)
export const CLOSED_DOORS = ['D1', 'D10', 'D8'];
export function doorLeaves() {
  return OPENINGS.filter((o) => o.kind === 'door').map((o) => {
    const { hinge, closed, width } = doorLeaf(o);
    const c = [closed[0] - hinge[0], closed[1] - hinge[1]].map((v) => v / width);
    const sw = o.swing;
    const turn = c[0] * sw[1] - c[1] * sw[0];
    const swingZone = zoneAt(hinge[0] + sw[0] * 0.3 + c[0] * width * 0.5, hinge[1] + sw[1] * 0.3 + c[1] * width * 0.5);
    const backZone = zoneAt(hinge[0] - sw[0] * 0.5 + c[0] * width * 0.5, hinge[1] - sw[1] * 0.5 + c[1] * width * 0.5);
    return {
      id: o.id, hinge, width: width - 0.006, height: o.head - 0.006, thick: o.id === 'D1' ? 0.07 : 0.045,
      closedAngle: Math.atan2(c[1], c[0]), openAngle: Math.atan2(sw[1], sw[0]), turn,
      mat: o.id === 'D1' ? 'oakDoor' : o.id === 'D10' ? 'garageDoor' : 'oak', zone: swingZone || Z.front, zoneBack: backZone || swingZone || Z.front,
      ext: o.id === 'D1' || o.id === 'D10',
    };
  });
}

// Leaf geometry in its own frame: hinge at the origin, leaf along +x, thickness away from the swing side.
export function buildLeaf(d) {
  const mb = new MeshBuilder();
  const y0 = d.turn > 0 ? -d.thick : 0, y1 = d.turn > 0 ? 0 : d.thick;
  const swingFace = d.turn > 0 ? 'y+' : 'y-';
  mb.box('arch', d.mat, [0.003, y0, 0.003, d.width, y1, d.height], d.zoneBack, { skip: [swingFace] });
  mb.rect('arch', d.mat, 'y', d.turn > 0 ? 1 : -1, 0, [0.003, d.width], [0.003, d.height], d.zone);
  // black pull handle on both faces; the front door gets a tall bar on the outside, like the renders
  const hx = d.width - 0.09;
  const [hz0, hz1] = d.id === 'D1' ? [0.45, 1.95] : [0.95, 1.25];
  const outFace = d.turn > 0 ? 'back' : 'front';
  mb.box('arch', 'frame', [hx, y0 - 0.06, d.id === 'D1' && outFace === 'back' ? hz0 : 0.95, hx + 0.025, y0, d.id === 'D1' && outFace === 'back' ? hz1 : 1.25], d.turn > 0 ? d.zoneBack : d.zone);
  mb.box('arch', 'frame', [hx, y1, d.id === 'D1' && outFace === 'front' ? hz0 : 0.95, hx + 0.025, y1 + 0.06, d.id === 'D1' && outFace === 'front' ? hz1 : 1.25], d.turn > 0 ? d.zone : d.zoneBack);
  return mb;
}
