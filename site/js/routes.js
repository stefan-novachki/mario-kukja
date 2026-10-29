// Walking routes through the furnished rooms: the narrowest clear width along the
// best path between two points, with the furniture in place and with walls only.
// Grid + distance to the nearest obstacle + widest-path search (maximin Dijkstra).
import { ITEMS, OPENINGS, SITE, ROOMS, PLANTS } from './plan-data.js';
import { wallPieces, doorLeaf } from './geometry.js';

const CELL = 0.04;
const BOX = [-0.6, -1.2, 12.5, 16.0];
const NX = Math.ceil((BOX[2] - BOX[0]) / CELL), NY = Math.ceil((BOX[3] - BOX[1]) / CELL);

// Openings you can walk through; windows stay solid. Sliders: only the open panels.
export function walkableGaps() {
  const gaps = [];
  for (const o of OPENINGS) {
    if (['door', 'opening', 'pocket', 'garage'].includes(o.kind)) gaps.push({ id: o.id, r: o.r });
    if (o.kind === 'slider' && o.slide) {
      const H = o.r[2] - o.r[0] > o.r[3] - o.r[1];
      const a = H ? o.r[0] : o.r[1], pw = ((H ? o.r[2] : o.r[3]) - a) / o.panels;
      for (const [i] of o.slide) {
        const s0 = a + i * pw, s1 = s0 + pw;
        gaps.push({ id: o.id, r: H ? [s0, o.r[1], s1, o.r[3]] : [o.r[0], s0, o.r[2], s1] });
      }
    }
  }
  return gaps;
}

export function obstacles(withFurniture) {
  const gaps = walkableGaps();
  const solid = [...wallPieces(undefined, gaps).map((p) => p.r)];
  // open door leaves (thin)
  for (const o of OPENINGS.filter((q) => q.kind === 'door')) {
    const { hinge, open } = doorLeaf(o);
    solid.push([Math.min(hinge[0], open[0]) - 0.02, Math.min(hinge[1], open[1]) - 0.02, Math.max(hinge[0], open[0]) + 0.02, Math.max(hinge[1], open[1]) + 0.02]);
  }
  if (withFurniture) {
    for (const it of ITEMS) {
      if (it.soft) continue;
      if (it.kind === 'shower') { for (const [x0, y0, x1, y1] of it.glass || []) solid.push([x0 - 0.01, y0 - 0.01, x1 + 0.01, y1 + 0.01]); continue; }
      solid.push(it.r);
    }
    for (const it of SITE.outdoor) solid.push(it.r);
    for (const p of PLANTS) solid.push([p.at[0] - p.r, p.at[1] - p.r, p.at[0] + p.r, p.at[1] + p.r]);
    for (const p of SITE.planters) solid.push(p);
    for (const [x, y] of SITE.pergola.posts) solid.push([x - 0.08, y - 0.08, x + 0.08, y + 0.08]);
  }
  return solid;
}

function distanceField(solid) {
  const d = new Float32Array(NX * NY);
  for (let j = 0; j < NY; j++) {
    const y = BOX[1] + (j + 0.5) * CELL;
    for (let i = 0; i < NX; i++) {
      const x = BOX[0] + (i + 0.5) * CELL;
      let m = 9;
      for (const r of solid) {
        const dx = Math.max(r[0] - x, 0, x - r[2]), dy = Math.max(r[1] - y, 0, y - r[3]);
        const v = dx === 0 && dy === 0 ? 0 : Math.hypot(dx, dy);
        if (v < m) { m = v; if (m === 0) break; }
      }
      d[j * NX + i] = m;
    }
  }
  return d;
}

// Widest path: maximise the smallest clearance met on the way.
function widest(d, a, b) {
  const idx = ([x, y]) => Math.round((y - BOX[1]) / CELL - 0.5) * NX + Math.round((x - BOX[0]) / CELL - 0.5);
  const s = idx(a), t = idx(b);
  const best = new Float32Array(NX * NY).fill(-1);
  const from = new Int32Array(NX * NY).fill(-1);
  const heap = [];
  const push = (v, k) => { heap.push([v, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] >= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] > heap[m][0]) m = l; if (r < heap.length && heap[r][0] > heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  best[s] = d[s]; push(d[s], s);
  while (heap.length) {
    const [v, k] = pop();
    if (k === t) {
      let m = Infinity, at = k;
      for (let q = k; q >= 0; q = from[q]) if (d[q] < m) { m = d[q]; at = q; }
      return { w: v, at: [BOX[0] + ((at % NX) + 0.5) * CELL, BOX[1] + (((at / NX) | 0) + 0.5) * CELL] };
    }
    if (v < best[k]) continue;
    const i = k % NX, j = (k / NX) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NY) continue;
      const nk = nj * NX + ni;
      const nv = Math.min(v, d[nk]);
      if (nv > best[nk]) { best[nk] = nv; from[nk] = k; push(nv, nk); }
    }
  }
  return { w: 0, at: a };
}

// End points sit in the door openings (or in open floor next to the target).
// Each route may only use the listed rooms (and the openings between them).
export const ROUTE_CHECKS = [
  ['Entrance: front door → living pavilion', [6.52, 1.15], [6.8, 9.75], ['hall']],
  ['Living: hall opening → garden slider', [6.8, 9.75], [5.8, 15.25], ['ldk']],
  ['Living: hall opening → in front of the sofa', [6.8, 9.75], [2.6, 11.3], ['ldk']],
  ['Kitchen: hall opening → between island and kitchen wall', [6.8, 9.75], [10.25, 11.8], ['ldk']],
  ["Kid's room: door → desk", [5.84, 4.25], [3.45, 2.0], ['kid']],
  ['Master: door → window corner', [7.76, 3.33], [8.5, 1.95], ['master']],
  ['Master: door → en-suite door', [7.76, 3.33], [11.0, 4.9], ['master']],
  ['En-suite: door → walk-in shower', [11.0, 4.9], [10.0, 7.4], ['ensuite']],
  ['Bedroom 2: door → window', [5.84, 5.68], [1.75, 7.2], ['guest']],
  ['Bathroom: door → shower', [7.76, 5.53], [8.4, 7.5], ['bath']],
]

function restrict(d, via) {
  const rects = ROOMS.filter((r) => via.includes(r.id)).flatMap((r) => r.rects);
  const near = (g) => rects.some((r) => g[0] <= r[2] + 0.02 && g[2] >= r[0] - 0.02 && g[1] <= r[3] + 0.02 && g[3] >= r[1] - 0.02);
  const allowed = [...rects, ...walkableGaps().map((g) => g.r).filter(near)];
  const out = new Float32Array(d.length);
  for (let j = 0; j < NY; j++) {
    const y = BOX[1] + (j + 0.5) * CELL;
    for (let i = 0; i < NX; i++) {
      const x = BOX[0] + (i + 0.5) * CELL;
      if (allowed.some((r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3])) out[j * NX + i] = d[j * NX + i];
    }
  }
  return out;
}

let cache = null;
export function routeWidths() {
  if (cache) return cache;
  const df = distanceField(obstacles(true));
  const dw = distanceField(obstacles(false));
  cache = ROUTE_CHECKS.map(([label, a, b, via]) => {
    const f = widest(restrict(df, via), a, b), w = widest(restrict(dw, via), a, b);
    return { label, furnished: 2 * f.w, walls: 2 * w.w, at: f.at };
  });
  return cache;
}
