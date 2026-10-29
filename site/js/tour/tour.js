// Scroll → smoothed progress → camera, walls rising, rooms turning real, ceilings lifting off
// when the camera is above them, cards.
import * as THREE from 'three';
import { buildPath, stopWindows, GLIDE } from './path.js';
import { SK } from '../three/sketch-shader.js';
import { Z, ZONES, NZ, zoneRadius, FOOTPRINT } from '../world/zones.js';
import { PLAN_T } from '../sketch.js';
import { ROOMS } from '../plan-data.js';

const DEG = Math.PI / 180;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const EXTERIOR = new Set([Z.front, Z.garden, Z.roof, Z.sky, 0]);
// rooms without a photo stop → the room they turn real with (the one they open off / share a wall with)
const NEIGHBOUR = { wc: 'hall', bath: 'hall', pantry: 'ldk' };
const FOV = 52;

export function createTour(view) {
  const { camera, groups, doors, setDusk, setExposure } = view;
  let path, wins, trig, origin;
  let s = 0, target = 0, settle = false, forceWave = null, lastStop = null, ev = 1;
  const real = new Float32Array(NZ);

  // frame the plan exactly like the overlay drawing does; frame = paper rect in mm (1:100)
  // k = px per paper mm (as the overlay drawing); rot: portrait screens show the plan turned 90°
  function layout(vw, vh, [fx, fy, fw, fh] = [0, 0, 594, 420], k = Math.min(vw / fw, vh / fh), rot = false) {
    const visH = vh / k / 10;                       // metres of plan visible vertically
    const cx = (fx + fw / 2 - PLAN_T.ox) / PLAN_T.S, cy = (PLAN_T.oy - (fy + fh / 2)) / PLAN_T.S;
    path = buildPath({ p: [cx, cy, visH / (2 * Math.tan((FOV * DEG) / 2))], fov: FOV, yaw: rot ? -90 * DEG : 0 });
    wins = stopWindows(path);
    triggers();
  }

  // When does each zone become real, and from where does the change spread?
  function triggers() {
    trig = new Array(NZ).fill(Infinity);
    origin = new Array(NZ).fill(null);
    for (const r of path.reveals) for (const name of r.zones) {
      const z = Z[name];
      if (r.s < trig[z]) { trig[z] = r.s; origin[z] = r.origin; }
    }
    trig[0] = trig[Z.front]; origin[0] = origin[Z.front];
    // rooms the tour does not stop in turn real with their neighbour, in the same wave (it starts
    // at the same point and runs on into them), so nothing is left as a drawing later on
    for (const [room, with_] of Object.entries(NEIGHBOUR)) {
      const z = Z[room], n = Z[with_];
      if (trig[z] === Infinity && trig[n] !== Infinity) { trig[z] = trig[n]; origin[z] = origin[n]; }
    }
    // anything else turns real when the dusk begins (seen from above at the end)
    for (let z = 1; z < NZ; z++) {
      if (trig[z] !== Infinity) continue;
      const room = ROOMS.find((r) => r.id === ZONES[z]);
      const r = room ? room.rects[0] : FOOTPRINT;
      trig[z] = path.dusk[0]; origin[z] = [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2];
    }
    for (let z = 0; z < NZ; z++) {
      SK.uOrigin.value[z].set(origin[z][0], origin[z][1]);
      SK.uRad.value[z] = EXTERIOR.has(z) ? 48 : zoneRadius(ZONES[z], origin[z]);
    }
  }

  const stopById = (id) => wins.find((v) => v.id === id);
  function stopAt(id) { const w = stopById(id); return w ? w.s0 + (w.s1 - w.s0) * 0.6 : 0; }
  // the view from above a room (end of the turn, before the descent) and halfway down
  function aboveOf(id) {
    const w = stopById(id);
    const g = path.segs.filter((q) => q.kind === 'descend' && q.s0 + q.len <= w.s0 + 1e-6).pop();
    return g ? g.s0 - 0.05 : w.s0;                 // just before the room starts turning real
  }
  function descentOf(id) {
    const w = stopById(id);
    const g = path.segs.filter((q) => q.kind === 'descend' && q.s0 + q.len <= w.s0 + 1e-6).pop();
    return g ? g.s0 + g.len * 0.55 : w.s0;
  }

  // aspect = the picture's own shape; full = the screen's (when the notes take a side, the picture
  // keeps the same horizontal field of view, so the room's composition stays whole)
  function frame(dt, aspect, full = aspect) {
    s += (target - s) * (settle ? 1 : 1 - Math.exp(-dt * 2.6));
    if (Math.abs(target - s) < 1e-4) s = target;
    const smp = path.sample(s);
    ev = settle ? smp.ev : ev + (smp.ev - ev) * (1 - Math.exp(-dt * 1.2));   // eye adaptation
    setExposure(ev);
    const [x, y, z] = smp.p;
    camera.position.set(x, z, -y);
    camera.rotation.set(smp.pitch, smp.yaw, 0, 'YXZ');
    // eye level: keep at least ~64° across on narrow (portrait) screens
    const need = (2 * Math.atan(Math.tan(32 * DEG) / full)) / DEG;
    const fovFull = THREE.MathUtils.lerp(smp.fov, Math.min(80, Math.max(smp.fov, need)), smooth(4, 2, z));
    camera.aspect = aspect;
    camera.fov = (2 * Math.atan((Math.tan((fovFull * DEG) / 2) * full) / aspect)) / DEG;
    camera.updateProjectionMatrix();

    SK.uRiseA.value = smooth(1.0, 8.5, s);
    SK.uRiseF.value = smooth(2.6, 10.0, s);

    for (let i = 0; i < NZ; i++) {
      const goal = s >= trig[i] ? 1 : 0;
      const dur = EXTERIOR.has(i) ? 3.2 : 1.8;
      real[i] = settle ? goal : real[i] + Math.max(-dt / dur, Math.min(dt / dur, goal - real[i]));
      SK.uReal.value[i] = real[i] * real[i] * (3 - 2 * real[i]);
    }
    if (forceWave) SK.uReal.value[forceWave.z] = forceWave.v;

    let d1 = path.marks[0][1];
    for (let i = 0; i < path.marks.length - 1; i++) {
      const [s0, v0] = path.marks[i], [s1, v1] = path.marks[i + 1];
      if (s >= s0) d1 = v0 + (v1 - v0) * smooth(s0, s1, s);
    }
    doors.D1.set(d1);
    const dk = smooth(path.dusk[0], path.dusk[1], s);
    setDusk(dk);
    // roof, ceilings and canopy: lifted off while the camera is above them (and at dusk)
    SK.uCut.value = Math.max(smooth(2.6, 3.4, z), smooth(0.35, 0.95, dk));

    const win = wins.find((v) => s >= v.show && s <= v.s1 + 0.3);
    const stop = win ? win.id : null;
    const changed = stop !== lastStop;
    lastStop = stop;
    return { s, z, stop, changed, overlay: 1 - smooth(0.05, 0.7, s), above: z > GLIDE - 0.5 };
  }

  return {
    layout, frame, stopAt, aboveOf, descentOf,
    get total() { return path.total; },
    set target(v) { target = Math.min(path.total, Math.max(0, v)); },
    jump(v) { target = s = Math.min(path.total, Math.max(0, v)); },
    settle(on) { settle = on; },
    wave(zoneName, v) { forceWave = { z: Z[zoneName], v }; },
    trigOf: (name) => trig[Z[name]],
    get path() { return path; },
  };
}
