// Lightmap atlases: every flat rectangle (wall, floor, ceiling, furniture face) gets its own
// patch in one of three atlases, sized by its real area. Blender bakes light into these
// patches; the website reads the same coordinates (second UV set, glTF convention: v down).
// Round shapes, glass, water, mirrors and glowing parts are not baked (uv2 = -1).

export const ATLASES = {
  arch: { size: 2048, groups: ['arch', 'top'] },
  items: { size: 2048, groups: ['items'] },
  site: { size: 2048, groups: ['site'] },
};
const SKIP = new Set(['glass', 'water', 'glow', 'glowOut', 'glowFront', 'shade', 'mirror', 'blackGlass']);
const SITE_BOUNDS = [-8.0, -8.0, 22.5, 27.5]; // the garden and the street edge get baked, the far ground does not
// (a chart is in bounds when its centre is)
const PAD = 2;                                 // texels of gutter around each patch

const atlasOf = (group) => Object.keys(ATLASES).find((k) => ATLASES[k].groups.includes(group));

function inBounds(c) {
  const cx = c.p0[0] + (c.u[0] + c.v[0]) / 2, cy = c.p0[1] + (c.u[1] + c.v[1]) / 2;
  const [x0, y0, x1, y1] = SITE_BOUNDS;
  return cx > x0 && cx < x1 && cy > y0 && cy < y1 && c.uLen < 40 && c.vLen < 40;
}

// Shelf packing at a given density (texels per metre). Returns placements or null.
function pack(charts, size, d) {
  const items = charts.map((c) => ({ c, w: Math.max(2, Math.round(c.uLen * d)), h: Math.max(2, Math.round(c.vLen * d)) }));
  items.forEach((it) => { if (it.h > it.w && it.h > size / 4) { it.rot = true; [it.w, it.h] = [it.h, it.w]; } });
  items.sort((a, b) => b.h - a.h || b.w - a.w);
  let x = 0, y = 0, row = 0;
  for (const it of items) {
    const W = it.w + 2 * PAD, H = it.h + 2 * PAD;
    if (W > size) return null;
    if (x + W > size) { x = 0; y += row; row = 0; }
    if (y + H > size) return null;
    it.x = x + PAD; it.y = y + PAD;
    x += W; row = Math.max(row, H);
  }
  return items;
}

// Coplanar rectangles that touch are merged into one patch (a "cluster").
function clusters(charts) {
  const out = [], byPlane = new Map();
  for (const c of charts) {
    if (!c.plane) { out.push({ charts: [c], uLen: c.uLen, vLen: c.vLen, single: true }); continue; }
    const k = `${c.group}|${c.plane}`;
    if (!byPlane.has(k)) byPlane.set(k, []);
    byPlane.get(k).push(c);
  }
  const E = 1e-4;
  for (const list of byPlane.values()) {
    const parent = list.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.pu[0] <= b.pu[1] + E && b.pu[0] <= a.pu[1] + E && a.pv[0] <= b.pv[1] + E && b.pv[0] <= a.pv[1] + E) parent[find(i)] = find(j);
    }
    const groups = new Map();
    list.forEach((c, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(c); });
    for (const cs of groups.values()) {
      const u0 = Math.min(...cs.map((c) => c.pu[0])), u1 = Math.max(...cs.map((c) => c.pu[1]));
      const v0 = Math.min(...cs.map((c) => c.pv[0])), v1 = Math.max(...cs.map((c) => c.pv[1]));
      const filled = cs.reduce((a, c) => a + (c.pu[1] - c.pu[0]) * (c.pv[1] - c.pv[0]), 0) / ((u1 - u0) * (v1 - v0) || 1);
      if (filled >= 0.4) out.push({ charts: cs, u0, v0, uLen: u1 - u0, vLen: v1 - v0, axis: cs[0].axis });
      // sparse groups (wall tops, parapet ring) would waste the atlas: keep their pieces apart
      else for (const c of cs) out.push({ charts: [c], u0: c.pu[0], v0: c.pv[0], uLen: c.pu[1] - c.pu[0], vLen: c.pv[1] - c.pv[0], axis: c.axis });
    }
  }
  return out;
}

// plane coordinates of a stored vertex (stored as x, z, -y)
function planeUV(B, vi, axis) {
  const x = B.pos[vi * 3], y = -B.pos[vi * 3 + 2], z = B.pos[vi * 3 + 1];
  return axis === 'z' ? [x, y] : axis === 'x' ? [y, z] : [x, z];
}

export function packLightmaps(builders) {
  const report = {};
  for (const b of builders) for (const B of b.buckets.values()) B.uv2 = new Array((B.pos.length / 3) * 2).fill(-1);
  for (const [name, A] of Object.entries(ATLASES)) {
    const charts = clusters(builders.flatMap((b) => b.charts).filter((c) => atlasOf(c.group) === name && !SKIP.has(c.mat) && (name !== 'site' || inBounds(c))));
    let lo = 1, hi = 200, best = null, bestD = 0;
    for (let i = 0; i < 18; i++) {                // densest packing that still fits
      const d = (lo + hi) / 2;
      const placed = pack(charts, A.size, d);
      if (placed) { best = placed; bestD = d; lo = d; } else hi = d;
    }
    for (const it of best) {
      const cl = it.c;
      for (const c of cl.charts) {
        const B = c.B;
        const uu = c.u, vv = c.v, u2 = c.uLen * c.uLen || 1, v2 = c.vLen * c.vLen || 1;
        for (let k = 0; k < c.count; k++) {
          const vi = c.start + k;
          let s, t;
          if (cl.single) {
            // back to plan coordinates: stored as (x, z, -y)
            const p = [B.pos[vi * 3], -B.pos[vi * 3 + 2], B.pos[vi * 3 + 1]];
            const rel = [p[0] - c.p0[0], p[1] - c.p0[1], p[2] - c.p0[2]];
            s = (rel[0] * uu[0] + rel[1] * uu[1] + rel[2] * uu[2]) / u2;
            t = (rel[0] * vv[0] + rel[1] * vv[1] + rel[2] * vv[2]) / v2;
          } else {
            const [pu, pv] = planeUV(B, vi, cl.axis);
            s = (pu - cl.u0) / (cl.uLen || 1);
            t = (pv - cl.v0) / (cl.vLen || 1);
          }
          if (it.rot) [s, t] = [t, s];
          B.uv2[vi * 2] = (it.x + s * it.w) / A.size;
          B.uv2[vi * 2 + 1] = (it.y + t * it.h) / A.size;
        }
      }
    }
    report[name] = { charts: charts.length, texelsPerMetre: Math.round(bestD * 10) / 10, size: A.size };
    Object.defineProperty(report[name], 'placements', { value: best.map((it) => [it.x, it.y, it.w, it.h]), enumerable: false });
  }
  return report;
}
