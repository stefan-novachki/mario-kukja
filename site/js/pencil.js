// Pencil primitives: every line is drawn by "hand" — slight wobble, overshoot at the ends,
// pressure that varies along the stroke. Output is grouped SVG path data per pen.

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n) => (Math.round(n * 100) / 100).toString();

export class Sketch {
  constructor(seed = 7) {
    this.r = rng(seed);
    this.groups = new Map(); // pen -> array of path strings
    this.cur = 'main';
  }

  pen(name) { this.cur = name; return this; }

  _push(d) {
    if (!this.groups.has(this.cur)) this.groups.set(this.cur, []);
    this.groups.get(this.cur).push(d);
  }

  rand(a, b) { return a + (b - a) * this.r(); }

  // A single hand-drawn segment. wobble = max sideways drift (paper units).
  line([x0, y0], [x1, y1], { over = 0, wobble = 0.18, step = 4, lift = 0.15 } = {}) {
    const dx = x1 - x0, dy = y1 - y0;
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) return;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const o0 = over ? this.rand(over * 0.3, over) : 0;
    const o1 = over ? this.rand(over * 0.3, over) : 0;
    const sx = x0 - ux * o0 + nx * this.rand(-lift, lift);
    const sy = y0 - uy * o0 + ny * this.rand(-lift, lift);
    const ex = x1 + ux * o1 + nx * this.rand(-lift, lift);
    const ey = y1 + uy * o1 + ny * this.rand(-lift, lift);
    const n = Math.max(2, Math.ceil((L + o0 + o1) / step));
    const p1 = this.r() * 6.28, p2 = this.r() * 6.28;
    const f1 = this.rand(0.4, 0.9), f2 = this.rand(1.3, 2.4);
    const amp = wobble * Math.min(1, 0.35 + L / 40);
    let d = `M${f(sx)} ${f(sy)}`;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const w = amp * (0.65 * Math.sin(6.283 * f1 * t + p1) + 0.35 * Math.sin(6.283 * f2 * t + p2)) * Math.sin(Math.PI * t);
      d += `L${f(sx + (ex - sx) * t + nx * w)} ${f(sy + (ey - sy) * t + ny * w)}`;
    }
    this._push(d);
  }

  // Two passes, the architect's way of going over an important line.
  line2(a, b, o = {}) {
    this.line(a, b, o);
    this.line(a, b, { ...o, lift: (o.lift ?? 0.15) * 1.6, over: (o.over ?? 0) * 0.7 });
  }

  poly(pts, { closed = false, wobble = 0.12, step = 2.5 } = {}) {
    if (pts.length < 2) return;
    const p1 = this.r() * 6.28, f1 = this.rand(0.5, 1.2);
    let d = '';
    const all = closed ? [...pts, pts[0]] : pts;
    let acc = 0;
    for (let i = 0; i < all.length; i++) {
      const [x, y] = all[i];
      if (i > 0) acc += Math.hypot(x - all[i - 1][0], y - all[i - 1][1]);
      const w = wobble * Math.sin(acc / step * f1 + p1);
      d += `${i ? 'L' : 'M'}${f(x + w)} ${f(y - w * 0.6)}`;
    }
    this._push(d);
  }

  rect(x0, y0, x1, y1, o = {}) {
    this.line([x0, y0], [x1, y0], o);
    this.line([x1, y0], [x1, y1], o);
    this.line([x1, y1], [x0, y1], o);
    this.line([x0, y1], [x0, y0], o);
  }

  // Rounded rectangle as one continuous loose stroke (furniture).
  rrect(x0, y0, x1, y1, rad = 0.6, o = {}) {
    const r = Math.min(rad, (x1 - x0) / 2, (y1 - y0) / 2);
    const pts = [];
    const corner = (cx, cy, a0) => {
      for (let i = 0; i <= 4; i++) {
        const a = a0 + (Math.PI / 2) * (i / 4);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    };
    corner(x1 - r, y0 + r, -Math.PI / 2);
    corner(x1 - r, y1 - r, 0);
    corner(x0 + r, y1 - r, Math.PI / 2);
    corner(x0 + r, y0 + r, Math.PI);
    this.poly(pts, { closed: true, wobble: o.wobble ?? 0.1 });
  }

  arc(cx, cy, rad, a0, a1, { wobble = 0.1, seg = 24 } = {}) {
    const pts = [];
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (a1 - a0) * (i / seg);
      const rr = rad * (1 + this.rand(-0.006, 0.006));
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    this.poly(pts, { wobble });
  }

  circle(cx, cy, rad, o = {}) {
    const start = this.r() * 6.28;
    this.arc(cx, cy, rad, start, start + Math.PI * 2 + 0.25, { seg: Math.max(10, Math.round(rad * 4)), ...o });
  }

  ellipse(cx, cy, rx, ry, o = {}) {
    const pts = [];
    const n = 20, s = this.r() * 6.28;
    for (let i = 0; i <= n + 1; i++) {
      const a = s + (Math.PI * 2 * i) / n;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    this.poly(pts, { wobble: o.wobble ?? 0.06 });
  }

  // Diagonal hatching clipped to a rectangle (poché, water, paving).
  hatch(x0, y0, x1, y1, { gap = 0.7, angle = 45, wobble = 0.05, jitter = 0.15 } = {}) {
    const a = (angle * Math.PI) / 180;
    const ux = Math.cos(a), uy = Math.sin(a); // hatch direction
    const nx = -uy, ny = ux;
    const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const ds = corners.map(([x, y]) => x * nx + y * ny);
    const dmin = Math.min(...ds), dmax = Math.max(...ds);
    for (let d = dmin + gap * this.rand(0.2, 0.8); d < dmax; d += gap * this.rand(0.85, 1.15)) {
      // intersect line {p : p·n = d} with the rect
      const pts = [];
      const edges = [[corners[0], corners[1]], [corners[1], corners[2]], [corners[2], corners[3]], [corners[3], corners[0]]];
      for (const [[ax, ay], [bx, by]] of edges) {
        const da = ax * nx + ay * ny - d, db = bx * nx + by * ny - d;
        if ((da <= 0 && db > 0) || (da > 0 && db <= 0)) {
          const t = da / (da - db);
          pts.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
        }
      }
      if (pts.length >= 2) {
        const j = jitter * gap;
        this.line([pts[0][0] + this.rand(-j, j) * ux, pts[0][1] + this.rand(-j, j) * uy], pts[1], { wobble, lift: 0.04, step: 6 });
      }
    }
  }

  dashed(a, b, { dash = 1.2, gap = 0.9, ...o } = {}) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
    for (let s = 0; s < L; s += dash + gap) {
      const e = Math.min(L, s + dash * this.rand(0.8, 1.2));
      this.line([a[0] + ux * s, a[1] + uy * s], [a[0] + ux * e, a[1] + uy * e], { wobble: 0.03, lift: 0.05, ...o });
    }
  }

  dashedRect(x0, y0, x1, y1, o = {}) {
    this.dashed([x0, y0], [x1, y0], o); this.dashed([x1, y0], [x1, y1], o);
    this.dashed([x1, y1], [x0, y1], o); this.dashed([x0, y1], [x0, y0], o);
  }

  strokes(lines, o = {}) {
    for (const l of lines) {
      if (l.length === 2) this.line(l[0], l[1], { wobble: 0.04, lift: 0.03, step: 3, ...o });
      else this.poly(l, { wobble: 0.03, ...o });
    }
  }

  toSVG(styles) {
    let out = '';
    for (const [pen, paths] of this.groups) {
      const s = styles[pen] || styles.main;
      out += `<path d="${paths.join('')}" fill="none" stroke="${s.color}" stroke-width="${s.w}" stroke-opacity="${s.o}" stroke-linecap="round" stroke-linejoin="round"${s.filter ? ` filter="url(#${s.filter})"` : ''}/>`;
    }
    return out;
  }
}
