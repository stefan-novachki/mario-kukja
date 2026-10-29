// Camera checks: the walk keeps clear of walls and furniture, never faces a bare wall, and moves
// calmly — a speed limit, a turn-rate limit, one movement at a time, soft starts and stops, and
// no back-and-forth.   node tools/check-path.mjs
import { buildPath, stopWindows, SPEED, GLIDE } from '../site/js/tour/path.js';
import { obstacles, walkableGaps } from '../site/js/routes.js';
import { wallPieces } from '../site/js/geometry.js';
import { ITEMS, OPENINGS, SITE } from '../site/js/plan-data.js';
import { hedges } from '../site/js/world/build-site.js';

// the opening as on a 1600 × 900 screen (the start height depends on the screen)
const path = buildPath({ p: [2.6, 7.5, 30.0], fov: 52, yaw: 0 });
const solid = [...obstacles(true), ...hedges().map((h) => h.r), ...SITE.trees.map(([x, y]) => [x - 0.3, y - 0.3, x + 0.3, y + 0.3])];
const seeThrough = [...walkableGaps(), ...OPENINGS.filter((o) => o.kind === 'window' && (o.sill ?? 0) < 1.2)];
const view = [...wallPieces(undefined, seeThrough).map((p) => p.r), ...ITEMS.filter((i) => (i.h ?? 0) >= 1.7).map((i) => i.r)];
const distRect = (x, y, r) => Math.hypot(Math.max(r[0] - x, 0, x - r[2]), Math.max(r[1] - y, 0, y - r[3]));
function ray(x, y, dx, dy, rects, max = 12) {
  for (let t = 0; t < max; t += 0.02) {
    const px = x + dx * t, py = y + dy * t;
    if (rects.some((r) => px > r[0] && px < r[2] && py > r[1] && py < r[3])) return t;
  }
  return max;
}
const DEG = 180 / Math.PI;
const wins = stopWindows(path);
const ds = 0.01;
let prev = path.sample(0), prevV = 0;
const worst = { clear: { v: 9 }, view: { v: 99 }, stopView: { v: 99 }, speed: { v: 0 }, turn: { v: 0 }, combo: { v: 0 }, accel: { v: 0 }, edge: { v: 0 } };
const moves = [];             // continuous movements between rests
let cur = null;
for (let s = ds; s <= path.total + 1e-9; s += ds) {
  const q = path.sample(s), [x, y, z] = q.p;
  const dp = q.p.map((v, i) => v - prev.p[i]);
  const hor = Math.hypot(dp[0], dp[1]), ver = Math.abs(dp[2]);
  const v = Math.hypot(hor, ver) / ds / Math.max(1, Math.min(z, prev.p[2]) / GLIDE);   // m per unit, height-scaled
  const dyaw = (Math.atan2(Math.sin(q.yaw - prev.yaw), Math.cos(q.yaw - prev.yaw)) * DEG) / ds, dpitch = ((q.pitch - prev.pitch) * DEG) / ds;
  const w = Math.max(Math.abs(dyaw), Math.abs(dpitch));
  if (v > worst.speed.v) worst.speed = { v, s, p: q.p };
  if (w > worst.turn.v) worst.turn = { v: w, s, p: q.p };
  const acc = Math.abs(v - prevV) / ds;
  if (acc > worst.accel.v) worst.accel = { v: acc, s, p: q.p };
  // one movement at a time: translating and turning together is allowed only for the crane
  // (straight up or down while looking at one point: pitch only) and for the eye-level walk
  const moving = v > 0.02 * SPEED.move, turning = w > 0.3;
  if (moving && turning) {
    const crane = hor / ds < 0.02 && Math.abs(dyaw) < 0.3;
    const walk = z < 2.3 && ver / ds < 0.02;
    if (!crane && !walk && w > worst.combo.v) worst.combo = { v: w, s, p: q.p };
  }
  if (moving || turning) {
    if (!cur) cur = { s0: s, dx: 0, dy: 0, dz: 0, yaw: new Set(), pitch: new Set() };
    cur.dx += dp[0]; cur.dy += dp[1]; cur.dz += dp[2];
    if (Math.abs(dyaw) > 0.3) cur.yaw.add(Math.sign(dyaw));
    if (Math.abs(dpitch) > 0.3) cur.pitch.add(Math.sign(dpitch));
  } else if (cur) { cur.s1 = s; moves.push(cur); cur = null; }
  if (z < 2.3) {
    const c = Math.min(...solid.map((r) => distRect(x, y, r)));
    if (c < worst.clear.v) worst.clear = { v: c, s, p: q.p };
    const fv = ray(x, y, -Math.sin(q.yaw), Math.cos(q.yaw), view);
    const stop = wins.find((wn) => s >= wn.s0 && s <= wn.s1);
    if (stop) { if (fv < worst.stopView.v) worst.stopView = { v: fv, s, p: q.p, id: stop.id }; }
    else if (moving && fv < worst.view.v) worst.view = { v: fv, s, p: q.p };
  }
  prev = q; prevV = v;
}
if (cur) { cur.s1 = path.total; moves.push(cur); }
// soft starts and stops: every segment begins and ends at rest
for (const g of path.segs) for (const e of [g.s0 + 0.005, g.s0 + g.len - 0.005]) {
  const a = path.sample(e - 0.005), b = path.sample(e + 0.005);
  const v = Math.hypot(...b.p.map((t, i) => t - a.p[i])) / 0.01 / Math.max(1, a.p[2] / GLIDE);
  if (v > worst.edge.v) worst.edge = { v, s: e, p: a.p };
}
// back-and-forth: a movement never turns one way and then the other; horizontal moves never
// reverse; no going down and straight back up without a photo stop in between
const wobble = moves.filter((m) => m.yaw.size > 1 || m.pitch.size > 1);
let reverse = { v: 0 };
const hmoves = moves.filter((m) => Math.hypot(m.dx, m.dy) > 0.5);
const across = [];          // turn-backs across a photo stop (allowed: you leave a room the way you came)
for (let i = 1; i < hmoves.length; i++) {
  const a = hmoves[i - 1], b = hmoves[i];
  if (wins.some((wn) => wn.s0 >= a.s1 - 0.05 && wn.s1 <= b.s0 + 0.05)) {
    const c = (a.dx * b.dx + a.dy * b.dy) / (Math.hypot(a.dx, a.dy) * Math.hypot(b.dx, b.dy));
    across.push(Math.round(Math.acos(Math.max(-1, Math.min(1, c))) * DEG));
    continue;
  }
  const c = (a.dx * b.dx + a.dy * b.dy) / (Math.hypot(a.dx, a.dy) * Math.hypot(b.dx, b.dy));
  const ang = Math.acos(Math.max(-1, Math.min(1, c))) * DEG;
  if (ang > reverse.v) reverse = { v: ang, s: b.s0 };
}
let bounce = 0;
for (let i = 1; i < moves.length; i++) {
  const a = moves[i - 1], b = moves[i];
  if (a.dz < -1 && b.dz > 1 && !wins.some((wn) => wn.s0 >= a.s1 - 0.05 && wn.s1 <= b.s0 + 0.05)) bounce++;
}

const f = (o, u = 'm') => `${o.v.toFixed(2)} ${u} at (${(o.p || [0, 0, 0]).map((v) => v.toFixed(2)).join(', ')})${o.id ? ' stop ' + o.id : ''}`;
const rows = [
  ['Camera keeps clear of walls and furniture (eye level)', worst.clear.v >= 0.35, '≥ 0.35 m', f(worst.clear)],
  ['Walking: free view ahead (never facing a bare wall)', worst.view.v >= 1.0, '≥ 1.0 m', f(worst.view)],
  ['Photo stops: free view ahead', worst.stopView.v >= 2.5, '≥ 2.5 m', f(worst.stopView)],
  ['Max speed per scroll unit (above glide height: relative to the height)', worst.speed.v <= SPEED.move * 1.02, `≤ ${SPEED.move} m`, f(worst.speed)],
  ['Max turn rate per scroll unit', worst.turn.v <= SPEED.turn * 1.02, `≤ ${SPEED.turn}°`, f(worst.turn, '°')],
  ['One movement at a time (no turning while gliding)', worst.combo.v < 0.31, '0° of turn', f(worst.combo, '°')],
  ['Soft starts and stops (speed where a movement begins or ends)', worst.edge.v <= 0.05 * SPEED.move, '≈ 0 m', f(worst.edge)],
  ['Gentle acceleration', worst.accel.v <= (2.05 * SPEED.move) / SPEED.ramp, `≤ ${((2 * SPEED.move) / SPEED.ramp).toFixed(2)} m per unit²`, f(worst.accel)],
  ['No back-and-forth: no turn reverses within a movement', wobble.length === 0, '0 movements', `${wobble.length} of ${moves.length} movements${wobble.length ? ' at s ' + wobble.map((m) => m.s0?.toFixed?.(1) ?? JSON.stringify(m).slice(0, 60)).join(', ') : ''}`],
  ['No back-and-forth: horizontal moves never turn back between two photo stops', reverse.v < 150, '< 150° between moves', `largest change ${reverse.v.toFixed(0)}° (across stops: ${across.join('°, ')}°)`],
  ['No back-and-forth: no down-and-up without a photo stop', bounce === 0, '0', `${bounce}`],
];
for (const [label, ok, req, val] of rows) console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} — ${val}  [${req}]`);
console.log(`path ${path.total.toFixed(1)} scroll units (${Math.round(path.total * 56)} px of scrolling), ${moves.length} movements, ${wins.length} stops: ${wins.map((w) => w.id).join(', ')}`);
