// The tour as a calm film: one camera movement at a time, the same speed for the same scroll
// distance, every movement starting and stopping softly. Pure maths, shared by the page and by
// tools/check-path.mjs.
//
// Rhythm per room: glide over the house (ceilings off, the room still a drawing) → turn towards
// the room's best sight line → descend into it while it turns real → one eye-level photo stop →
// rise out again. One walk: from the street through the garden gate, over the stepping stones,
// through the front door and into the hall with its long view to the garden.

const EYE = 1.6;
export const GLIDE = 10.5;                       // height of the glides over the house
export const SPEED = {
  move: 1.35,      // metres per scroll unit (up to glide height; above it the speed grows with
                   // the height, so the picture moves at the same rate)
  turn: 32,        // degrees per scroll unit
  ramp: 1.0,       // scroll units to start and to stop (eased)
  stop: 4.5,       // scroll units the camera holds still at a photo stop
};
const DEG = Math.PI / 180;

export const STOPS = {
  front: { name: 'Front door', size: { label: 'House', wd: [11.9, 15.4] }, area: { label: 'Living area', rooms: 'living' }, swatches: ['cedar', 'render', 'metal'] },
  hall: { name: 'Entrance hall', room: 'hall', swatches: ['oakFloor', 'oak', 'plaster'] },
  kid: { name: "Kid's bedroom", room: 'kid', swatches: ['oakFloor', 'linen', 'rug'] },
  master: { name: 'Master bedroom', room: 'master', area: { label: 'Suite', rooms: ['master', 'ensuite'] }, swatches: ['oakFloor', 'linen', 'walnut'] },
  ensuite: { name: 'En-suite', room: 'ensuite', swatches: ['showerTile', 'marble', 'walnut'] },
  guest: { name: 'Bedroom 2', room: 'guest', swatches: ['oakFloor', 'linen', 'walnut'] },
  ldk: { name: 'Living · Dining · Kitchen', room: 'ldk', swatches: ['oakFloor', 'navy', 'walnut'] },
  terrace: { name: 'Garden and pergola', size: { label: 'Terrace', wd: [11.1, 2.8] }, area: { label: 'Pergola', wd: [4.6, 3.9] }, swatches: ['pavers', 'cedarBeam', 'lawn'] },
};

// Each room's photo: where the eye stands and what it looks at (its strongest sight line),
// the exposure for that room, and which zones turn real on the way down.
export const SHOTS = {
  front: { eye: [-0.5, -13.0], look: [5.5, 1.0, 1.9], ev: 1.05, reveal: ['front', 'roof', 'sky'] },
  hall: { eye: [6.9, 4.1], look: [6.84, 14.5, 1.45], ev: 1.3 },
  kid: { eye: [5.05, 4.2], look: [2.4, 1.0, 0.95], ev: 1.3, reveal: ['kid'] },
  master: { eye: [8.4, 3.35], look: [11.2, 1.9, 0.95], ev: 1.25, reveal: ['master'] },
  ensuite: { eye: [10.85, 5.45], look: [10.0, 7.2, 0.95], ev: 1.35, reveal: ['ensuite'] },
  guest: { eye: [5.0, 5.98], look: [2.5, 8.4, 0.95], ev: 1.25, reveal: ['guest'] },
  ldk: { eye: [2.2, 10.7], look: [9.0, 14.2, 1.05], ev: 1.3, reveal: ['ldk'] },
  terrace: { eye: [9.4, 21.2], look: [2.6, 15.6, 1.5], ev: 1.0, reveal: ['garden', 'garage'] },
};

// ------------------------------------------------------------------ geometry helpers
const sub = (a, b) => a.map((v, i) => v - b[i]);
const lerp = (a, b, t) => a + (b - a) * t;
const lerpV = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
function lookAt(p, f) {   // yaw 0 looks along +y (to the garden); positive yaw turns towards -x
  const [dx, dy, dz] = sub(f, p);
  return [Math.atan2(-dx, dy), Math.atan2(dz, Math.hypot(dx, dy))];
}
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// metres → scroll units; above glide height the same scroll moves the camera further. Returns
// the total and a table to place the camera by travelled scroll (constant pace all along).
function travel(a, b, slow = 1) {
  const n = 128, tab = [0];
  let u = 0;
  for (let i = 0; i < n; i++) {
    const p = lerpV(a, b, (i + 0.5) / n), d = Math.hypot(...sub(b, a)) / n;
    u += d / (SPEED.move * Math.max(1, p[2] / GLIDE) * slow);
    tab.push(u);
  }
  const at = (f) => {             // fraction of scroll travelled → fraction of the line
    const t = f * u;
    let i = 1;
    while (i < n && tab[i] < t) i++;
    return (i - 1 + (t - tab[i - 1]) / (tab[i] - tab[i - 1] || 1)) / n;
  };
  return { u, at };
}
// soft start and stop: accelerate for `ramp` units, cruise, decelerate for `ramp` units. A move that
// covers u units of distance at cruising speed takes u + ramp units of scroll, so every move cruises at
// exactly the same speed, short or long.
function ease(u, len) {
  const r = Math.min(0.5, SPEED.ramp / len), vmax = 1 / (1 - r);
  if (u < r) return (vmax * u * u) / (2 * r);
  if (u > 1 - r) return 1 - (vmax * (1 - u) * (1 - u)) / (2 * r);
  return vmax * (r / 2 + (u - r));
}

// Centripetal Catmull-Rom between p1 and p2 (for the two walks).
function catmull(p0, p1, p2, p3, t) {
  const tj = (ti, a, b) => ti + Math.pow(Math.hypot(...sub(b, a)) || 1e-4, 0.5);
  const t0 = 0, t1 = tj(t0, p0, p1), t2 = tj(t1, p1, p2), t3 = tj(t2, p2, p3);
  const u = t1 + (t2 - t1) * t;
  const L = (a, b, ta, tb) => a.map((v, k) => ((tb - u) / (tb - ta)) * v + ((u - ta) / (tb - ta)) * b[k]);
  const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
  return L(L(A1, A2, t0, t2), L(A2, A3, t1, t3), t1, t2);
}

// ------------------------------------------------------------------ the film, segment by segment
class Film {
  constructor(start) {
    this.segs = [];
    this.pose = start;          // { p, yaw, pitch, fov, ev }
    this.marks = [];            // front door: [s, 0 closed | 1 open]
    this.reveals = [];          // { s, zones, origin }
    this.stops = [];            // { id, show, s0, s1 }
    this.dusk = null;
  }
  get s() { return this.segs.reduce((a, g) => a + g.len, 0); }
  push(kind, len, at, extra = {}) {
    const s0 = this.s;
    this.segs.push({ kind, s0, len: Math.max(len, 0.01), at, ...extra });
    this.pose = { ...this.pose, ...at(1) };
    return s0;
  }
  hold(len, extra = {}) { const P = { ...this.pose }; return this.push('hold', len, () => P, extra); }
  // straight translation; orientation constant, or looking at a fixed point (crane)
  line(kind, to, { focus = null, slow = 1 } = {}) {
    const a = this.pose.p, b = to, o = { yaw: this.pose.yaw, pitch: this.pose.pitch };
    const tr = travel(a, b, slow);
    return this.push(kind, tr.u + SPEED.ramp, (f) => {
      const p = lerpV(a, b, tr.at(f));
      if (!focus) return { p, ...o };
      const [yaw, pitch] = lookAt(p, focus);
      return { p, yaw, pitch };
    });
  }
  turnTo(focus) {
    const [y1, p1] = lookAt(this.pose.p, focus);
    const y0 = this.pose.yaw, p0 = this.pose.pitch, dy = wrap(y1 - y0);
    const ang = Math.max(Math.abs(dy), Math.abs(p1 - p0)) / DEG;   // looking down, a yaw turn rotates the whole picture
    return this.push('turn', ang / SPEED.turn + SPEED.ramp, (f) => ({ yaw: y0 + dy * f, pitch: lerp(p0, p1, f) }));
  }
  // eye-level walk along a smooth curve; the gaze follows a look target per point
  walk(points, looks) {
    const pts = [this.pose.p, ...points.map(([x, y]) => [x, y, EYE])];
    const ang = [[this.pose.yaw, this.pose.pitch], ...points.map((q, i) => lookAt(pts[i + 1], looks[i]))];
    for (let i = 1; i < ang.length; i++) ang[i][0] = ang[i - 1][0] + wrap(ang[i][0] - ang[i - 1][0]);
    const P = (j) => pts[Math.min(pts.length - 1, Math.max(0, j))];
    const cur = (i, t) => catmull(i === 0 ? P(0).map((v, k) => 2 * v - P(1)[k]) : P(i - 1), P(i), P(i + 1), i + 2 >= pts.length ? P(i + 1).map((v, k) => 2 * v - P(i)[k]) : P(i + 2), t);
    // arc length table: rows [length so far, curve piece, t on the piece]
    const tab = [];
    let L = 0;
    const knotL = [0];
    for (let i = 0; i < pts.length - 1; i++) {
      for (let k = 0; k <= 40; k++) {
        if (k) L += Math.hypot(...sub(cur(i, k / 40), cur(i, (k - 1) / 40)));
        tab.push([L, i, k / 40]);
      }
      knotL.push(L);
    }
    const angAt = (l, c) => {         // monotone (no overshoot) between the points' gaze angles
      if (c === 1) { const t = l / (knotL[knotL.length - 1] || 1), sm = t * t * (3 - 2 * t); return lerp(ang[0][1], ang[ang.length - 1][1], sm); }
      let i = 0;
      while (i < knotL.length - 2 && l > knotL[i + 1]) i++;
      const t = Math.min(1, Math.max(0, (l - knotL[i]) / (knotL[i + 1] - knotL[i] || 1)));
      const sm = t * t * (3 - 2 * t);
      return lerp(ang[i][c], ang[i + 1][c], sm);
    };
    return this.push('walk', L / SPEED.move + SPEED.ramp, (f) => {
      const l = f * L;
      let j = tab.findIndex((r) => r[0] >= l - 1e-9);
      if (j <= 0) j = 1;
      if (tab[j][1] !== tab[j - 1][1]) j++;          // first row of the next piece: stay on one piece
      j = Math.min(j, tab.length - 1);
      const [la, ia, ta] = tab[j - 1], [lb, , tb] = tab[j];
      const p = cur(ia, Math.min(1, ta + (tb - ta) * ((l - la) / (lb - la || 1))));
      return { p, yaw: angAt(l, 0), pitch: angAt(l, 1) };
    });
  }
  // a room: rise out of the last one, glide over the house, turn to the sight line, descend
  room(id) {
    const sh = SHOTS[id];
    if (this.pose.p[2] < GLIDE - 0.01) this.line('rise', [...this.pose.p.slice(0, 2), GLIDE], { focus: this.focus });
    this.line('glide', [...sh.eye, GLIDE]);
    this.turnTo(sh.look);
    this.descendInto(id);
  }
  descendInto(id) {
    const sh = SHOTS[id];
    const s0 = this.line('descend', [...sh.eye, EYE], { focus: sh.look });
    const g = this.segs[this.segs.length - 1];
    if (sh.reveal) this.reveals.push({ s: s0, zones: sh.reveal, origin: sh.eye });
    this.photo(id, s0 + g.len * 0.45);
  }
  photo(id, show) {
    const sh = SHOTS[id];
    this.pose.ev = sh.ev;
    const s0 = this.hold(SPEED.stop, { ev: sh.ev, stop: id });
    this.stops.push({ id, show, s0, s1: s0 + SPEED.stop });
    this.focus = sh.look;
  }
}

// start = the opening view straight down on the plan: { p: [x, y, height], fov }
export function buildPath(start = { p: [3.0, 8.5, 32], fov: 52, yaw: 0 }) {
  const y0 = start.yaw || 0;
  const film = new Film({ p: start.p, yaw: y0, pitch: -90 * DEG, fov: start.fov, ev: 1.0 });
  film.hold(10, { sheet: true });                          // the drawing turns 3D, walls rise
  // front door: down towards the street side, turn to the facade, descend to the path
  const fr = SHOTS.front;
  film.line('descend', [...fr.eye, GLIDE]);
  film.turnTo(fr.look);
  film.descendInto('front');
  film.marks.push([film.s - 0.5, 0]);
  // walk in: along the street to the garden gate, then over the stepping stones, through the
  // front door and into the hall (two walks: you pause at the gate)
  const porch = [6.8, 0.6, 1.6];
  film.walk([[2.5, -12.6], [6.5, -11.2], [9.4, -9.2], [10.05, -7.4]], [porch, porch, porch, porch]);
  const s0 = film.s;
  film.walk([[10.05, -6.0], [10.0, -5.0], [8.9, -3.2], [7.6, -1.6], [6.6, -0.4], [6.53, 1.15], [7.05, 2.2], SHOTS.hall.eye],
    [[7.6, 3.0, 1.6], [8.6, 4.0, 1.6], [7.8, 4.0, 1.6], [6.9, 4.0, 1.6], [6.35, 6.0, 1.6], [6.3, 8.0, 1.6], [6.9, 8.0, 1.6], SHOTS.hall.look]);
  const wl = film.segs[film.segs.length - 1].len;
  film.marks.push([s0 + wl * 0.3, 1]);                           // the door opens as you come up the stepping stones
  film.marks.push([s0 + wl * 0.85, 1]);
  film.marks.push([s0 + wl, 0]);                                 // and swings shut behind you in the hall
  film.reveals.push({ s: s0 + wl * 0.8, zones: ['hall'], origin: [6.8, 1.4] });
  film.photo('hall', film.s - 1);
  // rooms, never doubling back: the two front bedrooms, the en-suite, bedroom 2, the living
  // pavilion, and last out to the garden and the pergola, so the whole house is real by then
  film.room('kid');
  film.room('master');
  film.room('ensuite');
  film.room('guest');
  film.room('ldk');
  film.room('terrace');
  // finale: rise, glide out over the street corner, turn to the house, a slow rise into the dusk
  film.line('rise', [...film.pose.p.slice(0, 2), GLIDE], { focus: film.focus });
  film.line('glide', [-11.0, -12.5, GLIDE]);
  const house = [3.2, 9.0, 0];
  const d0 = film.turnTo(house);
  film.line('rise', [-11.0, -12.5, 21.0], { focus: house, slow: 0.5 });
  film.dusk = [d0, film.s];
  film.hold(4, { end: true });

  const segs = film.segs, total = film.s;
  const fovOf = () => start.fov;
  function sample(s) {
    s = Math.min(total, Math.max(0, s));
    let i = 0;
    while (i < segs.length - 1 && s >= segs[i].s0 + segs[i].len) i++;
    const g = segs[i];
    const u = Math.min(1, Math.max(0, (s - g.s0) / g.len));
    const f = g.kind === 'hold' ? 0 : ease(u, g.len);
    const prev = i > 0 ? segs[i - 1] : null;
    const base = { ...(prev ? prev.end : { p: start.p, yaw: y0, pitch: -90 * DEG }) };
    const q = { ...base, ...g.at(f) };
    let ev = 1.0;
    for (const st of film.stops) if (s >= st.show - 1.5 && s <= st.s1 + 1.5) ev = SHOTS[st.id].ev;
    return { p: q.p, yaw: q.yaw, pitch: q.pitch, fov: fovOf(s), ev, seg: i, kind: g.kind };
  }
  // each segment remembers its end pose (segments only state what they change)
  let pose = { p: start.p, yaw: y0, pitch: -90 * DEG };
  for (const g of segs) { pose = { ...pose, ...g.at(1) }; g.end = pose; }
  return { segs, total, sample, stops: film.stops, reveals: film.reveals, marks: film.marks.sort((a, b) => a[0] - b[0]), dusk: film.dusk, sheetEnd: segs[0].len };
}

// Card windows: shown from halfway down the descent until the camera leaves the photo stop.
export function stopWindows(path) {
  return path.stops.map((st) => ({ id: st.id, s0: st.s0, s1: st.s1, show: st.show }));
}
