// Zones decide what turns from drawing into reality, and when.
// Every surface and every pencil line carries a zone index.
import { ROOMS, VOLUMES, SITE } from '../plan-data.js';

export const SPLIT_Y = 9.6;                    // outside: street side (front) vs garden side
export const FOOTPRINTS = Object.values(VOLUMES).map((v) => v.r);   // outer faces of the walls
export const FOOTPRINT = [0, 0, 11.9, 15.4];   // the house's bounding box

export const ZONES = ['none', ...ROOMS.map((r) => r.id), 'front', 'garden', 'roof', 'sky'];
export const Z = Object.fromEntries(ZONES.map((z, i) => [z, i]));
export const NZ = ZONES.length;

const EPS = 1e-6;
const inside = (r, x, y) => x >= r[0] - EPS && x <= r[2] + EPS && y >= r[1] - EPS && y <= r[3] + EPS;
const inOpen = (r, x, y) => x > r[0] + EPS && x < r[2] - EPS && y > r[1] + EPS && y < r[3] - EPS;

// inside a building's walls (the recessed porch is outside, under the roof)
export function inBuilding(x, y) {
  if (inOpen(SITE.porch, x, y)) return false;
  return FOOTPRINTS.some((r) => inside(r, x, y));
}

export function roomAt(x, y) {
  for (const room of ROOMS) for (const r of room.rects) if (inside(r, x, y)) return room.id;
  return null;
}

// Zone index of a plan point. Points inside wall thickness return 0 ('none').
export function zoneAt(x, y) {
  const room = roomAt(x, y);
  if (room) return Z[room];
  if (inBuilding(x, y)) return 0;
  return y < SPLIT_Y ? Z.front : Z.garden;
}

export const volumeOf = (roomId) => VOLUMES[ROOMS.find((r) => r.id === roomId)?.vol] || VOLUMES.front;
export function ceilingOf(roomId) {
  return volumeOf(roomId).ceiling;
}

// Farthest distance from a point to the zone's area (for the reveal wave radius).
export function zoneRadius(zoneName, [ox, oy]) {
  const room = ROOMS.find((r) => r.id === zoneName);
  const rects = room ? room.rects : [[-40, -40, 70, 60]];
  let m = 0;
  for (const [x0, y0, x1, y1] of rects) for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) m = Math.max(m, Math.hypot(x - ox, y - oy));
  return m;
}
