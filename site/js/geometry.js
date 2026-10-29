// Plan geometry helpers shared by the sketch, the checks and the 3D builder.
import { WALLS, OPENINGS } from './plan-data.js';

const EPS = 1e-6;
export const isH = (r) => r[2] - r[0] >= r[3] - r[1]; // wall runs along x

export function overlap(a, b) {
  return a[0] < b[2] - EPS && b[0] < a[2] - EPS && a[1] < b[3] - EPS && b[1] < a[3] - EPS;
}

// Wall rectangles with openings cut out. Each piece keeps its wall type.
export function wallPieces(walls = WALLS, openings = OPENINGS) {
  const out = [];
  for (const w of walls) {
    const h = isH(w.r);
    const cuts = openings.filter((o) => overlap(o.r, w.r)).map((o) => (h ? [o.r[0], o.r[2]] : [o.r[1], o.r[3]]));
    cuts.sort((a, b) => a[0] - b[0]);
    let s = h ? w.r[0] : w.r[1];
    const end = h ? w.r[2] : w.r[3];
    const push = (a, b) => {
      if (b - a < EPS) return;
      out.push({ id: w.id, t: w.t, r: h ? [a, w.r[1], b, w.r[3]] : [w.r[0], a, w.r[2], b] });
    };
    for (const [a, b] of cuts) { push(s, Math.max(s, a)); s = Math.max(s, b); }
    push(s, end);
  }
  return out;
}

// Subtract intervals from [a,b].
function subtract([a, b], cuts) {
  let segs = [[a, b]];
  for (const [c, d] of cuts) {
    const next = [];
    for (const [s, e] of segs) {
      if (d <= s + EPS || c >= e - EPS) { next.push([s, e]); continue; }
      if (c > s + EPS) next.push([s, c]);
      if (d < e - EPS) next.push([d, e]);
    }
    segs = next;
  }
  return segs;
}

// Visible outline edges of the union of wall pieces (shared boundaries removed).
export function wallOutline(pieces) {
  const edges = [];
  const near = (u, v) => Math.abs(u - v) < 1e-4;
  for (const p of pieces) {
    const [x0, y0, x1, y1] = p.r;
    // bottom (y0) & top (y1)
    for (const [y, other] of [[y0, (q) => near(q.r[3], y0)], [y1, (q) => near(q.r[1], y1)]]) {
      const cuts = pieces.filter((q) => q !== p && other(q)).map((q) => [q.r[0], q.r[2]]);
      for (const [a, b] of subtract([x0, x1], cuts)) edges.push({ a: [a, y], b: [b, y], t: p.t });
    }
    for (const [x, other] of [[x0, (q) => near(q.r[2], x0)], [x1, (q) => near(q.r[0], x1)]]) {
      const cuts = pieces.filter((q) => q !== p && other(q)).map((q) => [q.r[1], q.r[3]]);
      for (const [a, b] of subtract([y0, y1], cuts)) edges.push({ a: [x, a], b: [x, b], t: p.t });
    }
  }
  // merge collinear touching edges so the pencil draws one long stroke
  const key = (e) => (Math.abs(e.a[1] - e.b[1]) < EPS ? `h${e.a[1].toFixed(3)}` : `v${e.a[0].toFixed(3)}`);
  const groups = new Map();
  for (const e of edges) {
    const k = key(e);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  const merged = [];
  for (const [k, list] of groups) {
    const hz = k[0] === 'h';
    const iv = list.map((e) => (hz ? [Math.min(e.a[0], e.b[0]), Math.max(e.a[0], e.b[0]), e.t] : [Math.min(e.a[1], e.b[1]), Math.max(e.a[1], e.b[1]), e.t]));
    iv.sort((a, b) => a[0] - b[0]);
    const c = +k.slice(1);
    const local = [];
    let cur = null;
    for (const s of iv) {
      if (cur && s[0] <= cur[1] + 1e-4 && s[2] === cur[2]) cur[1] = Math.max(cur[1], s[1]);
      else { if (cur) local.push(cur); cur = [...s]; }
    }
    if (cur) local.push(cur);
    for (const m of local) merged.push({ a: hz ? [m[0], c] : [c, m[0]], b: hz ? [m[1], c] : [c, m[1]], t: m[2] });
  }
  return merged;
}

// Door leaf geometry at 90°: hinge, open-leaf end, closed-leaf end.
export function doorLeaf(o) {
  const [x0, y0, x1, y1] = o.r;
  const wallH = x1 - x0 > y1 - y0; // door in a wall that runs along x
  const width = wallH ? x1 - x0 : y1 - y0;
  const [hx, hy] = o.hinge;
  const open = [hx + o.swing[0] * width, hy + o.swing[1] * width];
  let closed;
  if (wallH) closed = [Math.abs(hx - x0) < 1e-6 ? x1 : x0, hy];
  else closed = [hx, Math.abs(hy - y0) < 1e-6 ? y1 : y0];
  return { hinge: [hx, hy], open, closed, width };
}

// Rectangle bounding the swept quarter circle (used to test collisions).
export function sweepContains(o, [px, py]) {
  const { hinge, open, closed, width } = doorLeaf(o);
  const vx = px - hinge[0], vy = py - hinge[1];
  const d = Math.hypot(vx, vy);
  if (d > width + 1e-6) return false;
  const ax = open[0] - hinge[0], ay = open[1] - hinge[1];
  const bx = closed[0] - hinge[0], by = closed[1] - hinge[1];
  // inside the quarter: positive projection on both leaf directions
  return vx * ax + vy * ay >= -1e-6 && vx * bx + vy * by >= -1e-6;
}

export function rectArea([x0, y0, x1, y1]) { return (x1 - x0) * (y1 - y0); }
export const W = (r) => r[2] - r[0];
export const D = (r) => r[3] - r[1];
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Does the swept quarter circle of door o intersect rect r? Sample densely.
export function sweepHitsRect(o, r) {
  const { hinge, width } = doorLeaf(o);
  const n = 28;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const p = [hinge[0] - width + (2 * width * i) / n, hinge[1] - width + (2 * width * j) / n];
      if (p[0] > r[0] + 0.005 && p[0] < r[2] - 0.005 && p[1] > r[1] + 0.005 && p[1] < r[3] - 0.005 && sweepContains(o, p)) return true;
    }
  }
  return false;
}

export function segIntersect(p1, p2, p3, p4) {
  const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
  if (Math.abs(d) < 1e-12) return false;
  const t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d;
  const u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
