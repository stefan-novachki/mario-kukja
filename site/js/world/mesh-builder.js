// Collects the house as plain triangle lists per (group, material), plus the pencil
// lines of the drawing. Pure data, no three.js: the browser turns it into meshes and
// Node tools can reuse it (exports, checks).
//
// Builder input uses plan coordinates: x along the street, y towards the garden,
// z = height. Output is converted to three.js / glTF world space: (x, z, -y).
//
// Groups: 'arch' (walls, floors: rise out of the sheet), 'items' (furniture: rise a beat
// later), 'site' (garden: rises with the furniture), 'top' (ceilings, roof, canopy: hidden while the
// walls rise, shown once the camera is down at eye level).

import { rng } from '../pencil.js';

const KIND = { arch: 0, items: 1, site: 2, top: 3, decor: 1 };   // decor: small and soft things, light baked per vertex
const AX = { x: 0, y: 1, z: 2 };
const Q = (v) => Math.round(v * 1000); // mm keys

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

// UV in metres at world scale, continuous across split faces.
function uvFor(p, n) {
  if (Math.abs(n[2]) > 0.7) return n[2] > 0 ? [p[0], p[1]] : [p[0], -p[1]];
  const right = cross([-n[0], -n[1], -n[2]], [0, 0, 1]);
  const l = Math.hypot(right[0], right[1]) || 1;
  return [(p[0] * right[0] + p[1] * right[1]) / l, p[2]];
}

export class MeshBuilder {
  constructor() {
    this.buckets = new Map();
    this.faces = [];  // axis-aligned faces for the crease (pencil line) analysis
    this.lines = [];  // explicit lines (round and tilted shapes)
    this.item = 0;    // furniture id written into every vertex (0 = architecture), for the framing check
    this.charts = []; // rectangles that can receive baked light
    this.grainX = false; // turn texture coordinates on horizontal faces so wood grain runs along x
  }

  bucket(group, mat) {
    const key = `${group}|${mat}`;
    if (!this.buckets.has(key)) this.buckets.set(key, { group, mat, pos: [], nrm: [], uv: [], info: [], item: [], uv2: null });
    return this.buckets.get(key);
  }

  // One triangle in plan coordinates with a given normal (flat shading).
  tri(group, mat, a, b, c, n, zone, uvs) {
    const B = this.bucket(group, mat);
    const pts = dot(cross(sub(b, a), sub(c, a)), n) < 0 ? [a, c, b] : [a, b, c];
    const uvl = uvs ? (pts[1] === c ? [uvs[0], uvs[2], uvs[1]] : uvs) : null;
    pts.forEach((p, i) => {
      B.pos.push(p[0], p[2], -p[1]);
      B.nrm.push(n[0], n[2], -n[1]);
      const uv = uvl ? uvl[i] : this.uv(p, n);
      B.uv.push(uv[0], uv[1]);
      B.info.push(zone, KIND[group]);
      B.item.push(this.item);
    });
  }

  uv(p, n) {
    const uv = uvFor(p, n);
    return this.grainX && Math.abs(n[2]) > 0.7 ? [uv[1], uv[0]] : uv;
  }

  // Smooth-shaded triangle (per-vertex normals), used for round shapes.
  triS(group, mat, pts, nrms, zone) {
    const B = this.bucket(group, mat);
    pts.forEach((p, i) => {
      const n = nrms[i];
      B.pos.push(p[0], p[2], -p[1]);
      B.nrm.push(n[0], n[2], -n[1]);
      const uv = this.uv(p, n);
      B.uv.push(uv[0], uv[1]);
      B.info.push(zone, KIND[group]);
      B.item.push(this.item);
    });
  }

  quad(group, mat, p0, p1, p2, p3, n, zone, uvs = null) {
    const B = this.bucket(group, mat), start = B.pos.length / 3;
    this.tri(group, mat, p0, p1, p2, n, zone, uvs && [uvs[0], uvs[1], uvs[2]]);
    this.tri(group, mat, p0, p2, p3, n, zone, uvs && [uvs[0], uvs[2], uvs[3]]);
    // a lightmap chart: this rectangle gets its own patch of the lightmap atlas
    const u = sub(p1, p0), v = sub(p3, p0);
    this.charts.push({ B, group, mat, start, count: 6, p0, u, v, uLen: Math.hypot(...u), vLen: Math.hypot(...v) });
  }

  // Axis-aligned rectangle. axis = normal axis ('x' | 'y' | 'z'), sign = ±1, c = position on that axis.
  // 'z' faces: u = x range, v = y range. 'x' faces: u = y, v = z. 'y' faces: u = x, v = z.
  // picture = true: texture coordinates 0..1 across the face, upright as seen from the front (art).
  rect(group, mat, axis, sign, c, [u0, u1], [v0, v1], zone, { lines = true, picture = false } = {}) {
    if (u1 - u0 < 1e-4 || v1 - v0 < 1e-4) return;
    const P = axis === 'z' ? (u, v) => [u, v, c] : axis === 'x' ? (u, v) => [c, u, v] : (u, v) => [u, c, v];
    const n = [0, 0, 0]; n[AX[axis]] = sign;
    const mirror = (axis === 'y' && sign > 0) || (axis === 'x' && sign < 0);
    const uvs = picture ? (mirror ? [[1, 0], [0, 0], [0, 1], [1, 1]] : [[0, 0], [1, 0], [1, 1], [0, 1]]) : null;
    this.quad(group, mat, P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1), n, zone, uvs);
    // plane info: coplanar touching rectangles share one lightmap patch (no seams)
    Object.assign(this.charts[this.charts.length - 1], { plane: `${axis}${sign}${Q(c)}`, axis, pu: [u0, u1], pv: [v0, v1] });
    this.faces.push({ group, axis, sign, c, u: [u0, u1], v: [v0, v1], zone, lines });
  }

  // Axis-aligned box [x0,y0,z0,x1,y1,z1]; skip = list of faces to leave out, e.g. ['z-'].
  box(group, mat, [x0, y0, z0, x1, y1, z1], zone, { skip = [], lines = true } = {}) {
    const s = new Set(skip);
    if (!s.has('z+')) this.rect(group, mat, 'z', 1, z1, [x0, x1], [y0, y1], zone, { lines });
    if (!s.has('z-')) this.rect(group, mat, 'z', -1, z0, [x0, x1], [y0, y1], zone, { lines });
    if (!s.has('x-')) this.rect(group, mat, 'x', -1, x0, [y0, y1], [z0, z1], zone, { lines });
    if (!s.has('x+')) this.rect(group, mat, 'x', 1, x1, [y0, y1], [z0, z1], zone, { lines });
    if (!s.has('y-')) this.rect(group, mat, 'y', -1, y0, [x0, x1], [z0, z1], zone, { lines });
    if (!s.has('y+')) this.rect(group, mat, 'y', 1, y1, [x0, x1], [z0, z1], zone, { lines });
  }

  // Box with an arbitrary orthonormal frame: centre c, half sizes h, axes [ax, ay, az].
  obox(group, mat, c, h, axes, zone, { lines = true } = {}) {
    const corner = (sx, sy, sz) => [0, 1, 2].map((k) => c[k] + axes[0][k] * h[0] * sx + axes[1][k] * h[1] * sy + axes[2][k] * h[2] * sz);
    const faces = [
      [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1], axes[0]],
      [[-1, 1, -1], [-1, -1, -1], [-1, -1, 1], [-1, 1, 1], axes[0].map((v) => -v)],
      [[1, 1, -1], [-1, 1, -1], [-1, 1, 1], [1, 1, 1], axes[1]],
      [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], axes[1].map((v) => -v)],
      [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1], axes[2]],
      [[-1, 1, -1], [1, 1, -1], [1, -1, -1], [-1, -1, -1], axes[2].map((v) => -v)],
    ];
    for (const [a, b, d, e, n] of faces) this.quad(group, mat, corner(...a), corner(...b), corner(...d), corner(...e), n, zone);
    if (!lines) return;
    for (const [sa, sb] of [[[-1, -1, -1], [1, -1, -1]], [[-1, 1, -1], [1, 1, -1]], [[-1, -1, 1], [1, -1, 1]], [[-1, 1, 1], [1, 1, 1]],
      [[-1, -1, -1], [-1, 1, -1]], [[1, -1, -1], [1, 1, -1]], [[-1, -1, 1], [-1, 1, 1]], [[1, -1, 1], [1, 1, 1]],
      [[-1, -1, -1], [-1, -1, 1]], [[1, -1, -1], [1, -1, 1]], [[-1, 1, -1], [-1, 1, 1]], [[1, 1, -1], [1, 1, 1]]]) {
      this.line(group, corner(...sa), corner(...sb), zone, zone);
    }
  }

  // Vertical cylinder (smooth sides, flat caps) with pencil circles at both ends.
  cylinder(group, mat, cx, cy, r, z0, z1, zone, { seg = 24, caps = [true, true], lines = true } = {}) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const n0 = [Math.cos(a0), Math.sin(a0), 0], n1 = [Math.cos(a1), Math.sin(a1), 0];
      const b0 = [cx + n0[0] * r, cy + n0[1] * r, z0], b1 = [cx + n1[0] * r, cy + n1[1] * r, z0];
      const t0 = [b0[0], b0[1], z1], t1 = [b1[0], b1[1], z1];
      this.triS(group, mat, [b0, b1, t1], [n0, n1, n1], zone);
      this.triS(group, mat, [b0, t1, t0], [n0, n1, n0], zone);
      if (caps[1]) this.tri(group, mat, [cx, cy, z1], t0, t1, [0, 0, 1], zone);
      if (caps[0]) this.tri(group, mat, [cx, cy, z0], b1, b0, [0, 0, -1], zone);
      if (lines) {
        this.line(group, t0, t1, zone, zone);
        if (z0 > 0.01) this.line(group, b0, b1, zone, zone);
      }
    }
  }

  // Soft box (cushions, mattresses, towels): rounded edges of radius r, faces bulging by
  // `bulge` in the middle; centre c, half sizes h, local axes [ax, ay, az] (default plan axes).
  // Smooth normals, about one vertex every `step` metres, so baked vertex light has detail.
  rbox(group, mat, c, h, zone, { r = 0.04, bulge = 0, axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], step = 0.14, lines = false, skip = [] } = {}) {
    r = Math.min(r, h[0] * 0.98, h[1] * 0.98, h[2] * 0.98);
    const inner = h.map((v) => v - r);
    const e = Math.max(1, Math.min(3, Math.round(r / 0.016)));   // segments per rounded edge
    const coords = (k) => {                         // grid along one axis: rounded band, flat middle, band
      const m = Math.max(1, Math.ceil((2 * inner[k]) / step)), out = [];
      for (let i = 0; i <= e; i++) out.push(-h[k] + (r * i) / e);
      for (let i = 1; i < m; i++) out.push(-inner[k] + (2 * inner[k] * i) / m);
      for (let i = 0; i <= e; i++) out.push(inner[k] + (r * i) / e);
      return out;
    };
    const C = [coords(0), coords(1), coords(2)];
    const place = (s) => {                          // point on the box surface → rounded, bulged
      const q = s.map((v, k) => Math.max(-inner[k], Math.min(inner[k], v)));
      const d = s.map((v, k) => v - q[k]);
      const l = Math.hypot(...d) || 1;
      const nl = d.map((v) => v / l);
      let p = q.map((v, k) => v + nl[k] * r);
      if (bulge) {
        let w = 1;
        for (let k = 0; k < 3; k++) if (Math.abs(nl[k]) < 0.999) w *= Math.max(0, 1 - (q[k] / (inner[k] || 1)) ** 2);
        p = p.map((v, k) => v + nl[k] * bulge * w);
      }
      return p;
    };
    const world = (p) => [0, 1, 2].map((k) => c[k] + axes[0][k] * p[0] + axes[1][k] * p[1] + axes[2][k] * p[2]);
    for (const [k, sgn] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
      if (skip.includes(`${'xyz'[k]}${sgn > 0 ? '+' : '-'}`)) continue;
      const a = (k + 1) % 3, b = (k + 2) % 3;
      const S = (i, j) => { const s = [0, 0, 0]; s[k] = sgn * h[k]; s[a] = C[a][i]; s[b] = C[b][j]; return s; };
      const P = [], N = [];
      for (let i = 0; i < C[a].length; i++) {
        P.push([]); N.push([]);
        for (let j = 0; j < C[b].length; j++) {
          const s = S(i, j), p = place(s);
          // normal from neighbouring points on the same surface
          const e = 1e-3, sa = [...s], sb = [...s];
          sa[a] += e; sb[b] += e;
          const da = sub(place(sa), p), db = sub(place(sb), p);
          let n = cross(da, db);
          if (dot(n, s.map((v, q) => (q === k ? sgn : 0))) < 0) n = n.map((v) => -v);
          const nl = Math.hypot(...n) || 1;
          P[i].push(world(p));
          N[i].push(world(n.map((v) => v / nl)).map((v, q) => v - c[q]));
        }
      }
      for (let i = 0; i < C[a].length - 1; i++) for (let j = 0; j < C[b].length - 1; j++) {
        const t = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
        const nn = t.map(([x, y]) => N[x][y]);
        for (const ids of [[0, 1, 2], [0, 2, 3]]) {
          const pts = ids.map((x) => P[t[x][0]][t[x][1]]), ns = ids.map((x) => nn[x]);
          const g = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
          if (dot(g, [0, 1, 2].map((q) => ns[0][q] + ns[1][q] + ns[2][q])) < 0) { pts.reverse(); ns.reverse(); }   // face outwards
          this.triS(group, mat, pts, ns, zone);
        }
      }
    }
    if (lines) {
      const hh = h.map((v) => v * 0.98);
      for (const [p, q] of [[[-1, -1, 1], [1, -1, 1]], [[1, -1, 1], [1, 1, 1]], [[1, 1, 1], [-1, 1, 1]], [[-1, 1, 1], [-1, -1, 1]]]) {
        this.line(group, world(p.map((v, k) => v * hh[k])), world(q.map((v, k) => v * hh[k])), zone, zone);
      }
    }
  }

  // Turned shape (bowls, cups, vases, plates, fruit): profile = [[radius, z], ...] from bottom up.
  lathe(group, mat, cx, cy, z0, profile, zone, { seg = 20, lines = false } = {}) {
    const ring = (i, a) => [cx + Math.cos(a) * profile[i][0], cy + Math.sin(a) * profile[i][0], z0 + profile[i][1]];
    const nrm = (i, a) => {
      const p0 = profile[Math.max(0, i - 1)], p1 = profile[Math.min(profile.length - 1, i + 1)];
      const dr = p1[0] - p0[0], dz = p1[1] - p0[1], l = Math.hypot(dr, dz) || 1;
      return [Math.cos(a) * (dz / l), Math.sin(a) * (dz / l), -dr / l];
    };
    for (let s = 0; s < seg; s++) {
      const a0 = (s / seg) * Math.PI * 2, a1 = ((s + 1) / seg) * Math.PI * 2;
      for (let i = 0; i < profile.length - 1; i++) {
        const p = [ring(i, a0), ring(i, a1), ring(i + 1, a1), ring(i + 1, a0)];
        const n = [nrm(i, a0), nrm(i, a1), nrm(i + 1, a1), nrm(i + 1, a0)];
        this.triS(group, mat, [p[0], p[1], p[2]], [n[0], n[1], n[2]], zone);
        this.triS(group, mat, [p[0], p[2], p[3]], [n[0], n[2], n[3]], zone);
      }
      if (lines) this.line(group, ring(profile.length - 1, a0), ring(profile.length - 1, a1), zone, zone);
    }
  }

  line(group, a, b, za, zb = za) { this.lines.push({ group, a, b, za, zb }); }

  // Pencil lines from the axis-aligned faces: draw an edge where faces meet at an angle
  // or where a face ends; skip seams between coplanar faces. Lines that exist only
  // because of the 'top' group (ceilings, roof) go to the 'top' group.
  creaseLines() {
    const groups = new Map();
    const add = (dir, fixed, a, b, f) => {
      const key = dir + fixed.map(Q).join(',');
      if (!groups.has(key)) groups.set(key, { dir, fixed, list: [] });
      groups.get(key).list.push({ a: Math.min(a, b), b: Math.max(a, b), n: f.axis + f.sign, zone: f.zone, group: f.group });
    };
    for (const f of this.faces) {
      if (!f.lines) continue;
      const [u0, u1] = f.u, [v0, v1] = f.v, c = f.c;
      if (f.axis === 'z') {
        add('x', [v0, c], u0, u1, f); add('x', [v1, c], u0, u1, f);
        add('y', [u0, c], v0, v1, f); add('y', [u1, c], v0, v1, f);
      } else if (f.axis === 'x') {
        add('y', [c, v0], u0, u1, f); add('y', [c, v1], u0, u1, f);
        add('z', [c, u0], v0, v1, f); add('z', [c, u1], v0, v1, f);
      } else {
        add('x', [c, v0], u0, u1, f); add('x', [c, v1], u0, u1, f);
        add('z', [u0, c], v0, v1, f); add('z', [u1, c], v0, v1, f);
      }
    }
    const out = [];
    const decide = (cover) => {
      if (!cover.length) return null;
      const normals = new Set(cover.map((e) => e.n));
      if (cover.length > 1 && normals.size === 1) return null;
      const a = cover[0];
      const b = cover.find((e) => e.n !== a.n) || cover[cover.length - 1];
      const grp = cover.some((e) => e.group === 'arch') ? 'arch' : cover.some((e) => e.group === 'items') ? 'items' : cover.some((e) => e.group === 'site') ? 'site' : 'top';
      return { za: a.zone, zb: b.zone, group: grp };
    };
    for (const { dir, fixed, list } of groups.values()) {
      const ts = [...new Set(list.flatMap((e) => [Q(e.a), Q(e.b)]))].sort((p, q) => p - q).map((t) => t / 1000);
      let cur = null;
      const flush = () => { if (cur) out.push(cur); cur = null; };
      for (let i = 0; i < ts.length - 1; i++) {
        const t0 = ts[i], t1 = ts[i + 1];
        if (t1 - t0 < 1e-4) continue;
        const cover = list.filter((e) => e.a <= t0 + 1e-4 && e.b >= t1 - 1e-4);
        const base = decide(cover.filter((e) => e.group !== 'top'));
        let d = base;
        if (!d) { d = decide(cover); if (d) d.group = 'top'; }
        if (!d) { flush(); continue; }
        if (cur && cur.group === d.group && cur.za === d.za && cur.zb === d.zb && Math.abs(cur.t1 - t0) < 1e-4) cur.t1 = t1;
        else { flush(); cur = { ...d, dir, fixed, t0, t1 }; }
      }
      flush();
    }
    return out.map((s) => {
      const P = (t) => (s.dir === 'x' ? [t, s.fixed[0], s.fixed[1]] : s.dir === 'y' ? [s.fixed[0], t, s.fixed[1]] : [s.fixed[0], s.fixed[1], t]);
      return { group: s.group, a: P(s.t0), b: P(s.t1), za: s.za, zb: s.zb };
    });
  }

  finish() {
    const meshes = [...this.buckets.values()].map((B) => ({
      group: B.group, mat: B.mat,
      position: new Float32Array(B.pos), normal: new Float32Array(B.nrm), uv: new Float32Array(B.uv), info: new Float32Array(B.info), item: new Float32Array(B.item),
      uv2: B.uv2 ? new Float32Array(B.uv2) : null,
    }));
    // Pencil strokes: each edge overshoots its corners a little and long edges get a
    // second, lighter pass that wanders slightly, like a hand-drawn perspective.
    const rand = rng(7);
    const lines = {};
    const stroke = (L, a, b, za, zb, alpha, jitter) => {
      const d = sub(b, a), len = Math.hypot(...d) || 1, u = d.map((v) => v / len);
      const o0 = 0.02 + rand() * 0.07, o1 = 0.02 + rand() * 0.07;
      const j = () => (rand() - 0.5) * jitter;
      const A = [a[0] - u[0] * o0 + j(), a[1] - u[1] * o0 + j(), a[2] - u[2] * o0 + j()];
      const B = [b[0] + u[0] * o1 + j(), b[1] + u[1] * o1 + j(), b[2] + u[2] * o1 + j()];
      const s = rand();
      for (const p of [A, B]) {
        L.pos.push(p[0], p[2], -p[1]);
        L.zones.push(za, zb);
        L.seed.push(s, alpha);
      }
    };
    for (const l of [...this.creaseLines(), ...this.lines]) {
      const L = (lines[l.group] ||= { pos: [], zones: [], seed: [] });
      stroke(L, l.a, l.b, l.za, l.zb, 1, 0.006);
      if (Math.hypot(...sub(l.b, l.a)) > 0.9) stroke(L, l.a, l.b, l.za, l.zb, 0.4, 0.03);
    }
    for (const g of Object.keys(lines)) {
      const L = lines[g];
      lines[g] = { position: new Float32Array(L.pos), zones: new Float32Array(L.zones), seed: new Float32Array(L.seed) };
    }
    return { meshes, lines };
  }
}
