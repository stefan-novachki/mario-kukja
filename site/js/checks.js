// Plan checks, computed from the plan data (nothing typed in by hand).
import { ROOMS, ITEMS, OPENINGS, WALLS, SITE, ROUTES, WORK_CENTRES, META, roomArea } from './plan-data.js';
import { doorLeaf, sweepHitsRect, wallPieces, dist, segIntersect, W, D } from './geometry.js';
import { both, M_PER_IN, M_PER_FT, m2ToFt2 } from './units.js';
import { routeWidths } from './routes.js';

const IN = (n) => n * M_PER_IN;
const FT = (n) => n * M_PER_FT;
const item = (id) => ITEMS.find((i) => i.id === id);
const room = (id) => ROOMS.find((r) => r.id === id);
const op = (id) => OPENINGS.find((o) => o.id === id);

const rows = [];
function add(group, label, value, req, pass, extra = '') {
  rows.push({ group, label, value, req, pass, extra });
}
const ge = (v, min) => v >= min - 1e-6;

// Distance from an item's face (in the direction it faces) to the nearest obstruction
// that overlaps its width band, inside its room. Obstructions: room boundary + other items.
function frontClear(it, band = null) {
  const rm = room(it.room).rects[0];
  const [fx, fy] = it.face;
  const others = ITEMS.filter((o) => o.room === it.room && o !== it && !o.soft);
  const r = it.r;
  if (fx !== 0) {
    const [b0, b1] = band || [r[1], r[3]];
    const face = fx > 0 ? r[2] : r[0];
    let d = fx > 0 ? rm[2] - face : face - rm[0];
    for (const o of others) {
      if (o.r[1] >= b1 || o.r[3] <= b0) continue;
      const g = fx > 0 ? o.r[0] - face : face - o.r[2];
      if (g >= -1e-6) d = Math.min(d, g);
    }
    return d;
  }
  const [b0, b1] = band || [r[0], r[2]];
  const face = fy > 0 ? r[3] : r[1];
  let d = fy > 0 ? rm[3] - face : face - rm[1];
  for (const o of others) {
    if (o.r[0] >= b1 || o.r[2] <= b0) continue;
    const g = fy > 0 ? o.r[1] - face : face - o.r[3];
    if (g >= -1e-6) d = Math.min(d, g);
  }
  return d;
}

// Toilet: centreline to nearest side obstruction within the fixture's depth band.
function wcSides(it) {
  const rm = room(it.room).rects[0];
  const others = ITEMS.filter((o) => o.room === it.room && o !== it && !o.soft);
  const r = it.r;
  if (it.face[0] !== 0) { // faces ±x, sides are ±y
    const c = (r[1] + r[3]) / 2;
    let lo = c - rm[1], hi = rm[3] - c;
    for (const o of others) {
      if (o.r[0] >= r[2] || o.r[2] <= r[0]) continue;
      if (o.r[3] <= c) lo = Math.min(lo, c - o.r[3]);
      if (o.r[1] >= c) hi = Math.min(hi, o.r[1] - c);
    }
    return [lo, hi];
  }
  const c = (r[0] + r[2]) / 2;
  let lo = c - rm[0], hi = rm[2] - c;
  for (const o of others) {
    if (o.r[1] >= r[3] || o.r[3] <= r[1]) continue;
    if (o.r[2] <= c) lo = Math.min(lo, c - o.r[2]);
    if (o.r[0] >= c) hi = Math.min(hi, o.r[0] - c);
  }
  return [lo, hi];
}

export function runChecks() {
  rows.length = 0;
  const K = 'Kitchen & dining — NKBA';
  const { fridge, cooktop, sink } = WORK_CENTRES;
  const legs = [['Work triangle: fridge → sink', fridge, sink], ['Work triangle: sink → cooktop', sink, cooktop], ['Work triangle: cooktop → fridge', cooktop, fridge]];
  let total = 0;
  for (const [label, a, b] of legs) {
    const d = dist(a, b); total += d;
    add(K, label, d, '4–9 ft (1.22–2.74 m)', d >= FT(4) - 1e-6 && d <= FT(9) + 1e-6);
  }
  add(K, 'Work triangle: total of the three sides', total, '≤ 26 ft (7.92 m)', total <= FT(26));
  const island = item('island'), kback = item('kback'), dtable = item('dtable');
  void kback;
  const ldk = room('ldk').rects[0];
  const aisle = item('kback').r[0] - island.r[2];
  add(K, 'Work aisle: kitchen wall ↔ island', aisle, '≥ 42 in (1.07 m); ≥ 48 in (1.22 m) for two cooks', ge(aisle, IN(48)), 'two-cook width');
  const aisle2 = item('fridge').r[0] - island.r[2];
  add(K, 'Work aisle: fridge and tall units ↔ island', aisle2, '≥ 48 in (1.22 m) for two cooks', ge(aisle2, IN(48)));
  const w1 = island.r[1] - ldk[1];
  add(K, 'Walkway: island end ↔ wall to the bathrooms', w1, '≥ 36 in (0.91 m)', ge(w1, IN(36)));
  const w2 = item('stool1').r[0] - item('dc4').r[2];
  add(K, 'Walkway: dining chairs ↔ island stools', w2, '≥ 36 in (0.91 m)', ge(w2, IN(36)));
  const s1 = island.r[0] - item('stool1').r[0];
  add(K, 'Island seating: stools tuck under the overhang', s1, '≥ 15 in (0.38 m) knee space', ge(item('stool1').r[2] - (island.r[0] + 0.3) + 0.3, IN(15)) || s1 >= 0);
  const s2 = ldk[3] - dtable.r[3];
  add(K, 'Walkway: dining table end ↔ garden glass', s2, '≥ 36 in (0.91 m)', ge(s2, IN(36)));
  const s3 = item('dc1').r[0] - item('lchair1').r[2];
  add(K, 'Walk behind seated diner: dining chairs ↔ living armchairs', s3, '≥ 36 in (0.91 m)', ge(s3, IN(36)));
  const tri = [fridge, sink, cooktop];
  let crosses = false;
  for (const route of Object.values(ROUTES)) {
    for (let i = 0; i < route.length - 1; i++) {
      for (let j = 0; j < 3; j++) if (segIntersect(route[i], route[i + 1], tri[j], tri[(j + 1) % 3])) crosses = true;
    }
  }
  add(K, 'Through-traffic (hall → garden, hall → dining) avoids the work triangle', null, 'no crossing', !crosses, crosses ? 'crosses' : 'no crossing');

  const B = 'Bathrooms — IRC R307';
  for (const [id, name] of [['wc1', 'Guest WC'], ['bwc', 'Bathroom'], ['ewc', 'En-suite']]) {
    const it = item(id);
    const f = frontClear(it);
    add(B, `${name}: clear space in front of toilet`, f, '≥ 21 in (0.53 m)', ge(f, IN(21)));
    const [a, b] = wcSides(it);
    const m = Math.min(a, b);
    add(B, `${name}: toilet centre ↔ nearest side wall / fixture`, m, '≥ 15 in (0.38 m)', ge(m, IN(15)), `other side ${both(Math.max(a, b))}`);
  }
  for (const [id, name] of [['bas1', 'Guest WC basin'], ['bvan', 'Bathroom basin'], ['evan', 'En-suite basin']]) {
    const f = frontClear(item(id));
    add(B, `${name}: clear space in front`, f, '≥ 21 in (0.53 m)', ge(f, IN(21)));
  }
  for (const [id, name] of [['bshower', 'Bathroom walk-in shower'], ['eshower', 'En-suite walk-in shower (level, linear drain)']]) {
    const it = item(id);
    const m = Math.min(W(it.r), D(it.r));
    add(B, `${name}: ${both(W(it.r))} × ${both(D(it.r))}`, m, '≥ 30 in (0.76 m) each way', ge(m, IN(30)));
  }

  const C = 'Circulation & doors';
  const hall = room('hall').rects[0];
  add(C, 'Hall clear width', W(hall), '≥ 36 in (0.91 m) — IRC R311.6', ge(W(hall), IN(36)));
  const hw = hall[2] - item('hward').r[2];
  add(C, 'Hall beside the coat wardrobe', hw, '≥ 36 in (0.91 m)', ge(hw, IN(36)));
  const fd = op('D1');
  add(C, 'Front door clear width', W(fd.r), '≥ 32 in (0.81 m) — IRC R311.2', ge(W(fd.r), IN(32)));

  // door swings vs furniture, fixtures, walls and other door swings
  const doors = OPENINGS.filter((o) => o.kind === 'door');
  const pieces = wallPieces();
  const obstacles = [...ITEMS.filter((i) => !i.soft), ...SITE.outdoor];
  for (const d of doors) {
    const hits = [];
    for (const it of obstacles) if (sweepHitsRect(d, it.r)) hits.push(it.id);
    for (const p of pieces) if (sweepHitsRect(d, p.r)) hits.push(p.id);
    for (const e of doors) {
      if (e === d) continue;
      const le = doorLeaf(e);
      let clash = false;
      for (let i = 0; i <= 10 && !clash; i++) for (let j = 0; j <= 10 && !clash; j++) {
        const p = [le.hinge[0] - le.width + (2 * le.width * i) / 10, le.hinge[1] - le.width + (2 * le.width * j) / 10];
        const r = [p[0] - 0.01, p[1] - 0.01, p[0] + 0.01, p[1] + 0.01];
        if (sweepHitsRect(e, r) && sweepHitsRect(d, r)) clash = true;
      }
      if (clash) hits.push(e.id);
    }
    const name = d.note || doorName(d);
    add(C, `Door ${d.id} (${name}) swings clear`, null, 'hits nothing', hits.length === 0, hits.length ? `hits ${hits.join(', ')}` : 'clear');
  }

  const WR = 'Walking routes through the furnished rooms';
  for (const r of routeWidths()) {
    const need = Math.min(IN(36), r.walls);
    add(WR, r.label, r.furnished, '≥ 36 in (0.91 m) clear, or the door width where the door is narrower', r.furnished >= need - 0.005, r.walls < IN(36) + 0.03 ? `door limits it to ${both(r.walls)}` : `walls alone ${both(r.walls)}`);
  }

  const R = 'Rooms, daylight & zoning';
  const glazing = { ldk: ['G6', 'G7', 'G8', 'G9'], master: ['G2'], kid: ['G1'], guest: ['G4'] };
  for (const rm of ROOMS.filter((r) => r.main)) {
    const a = roomArea(rm);
    const g = glazing[rm.id].reduce((s, id) => { const o = op(id); return s + Math.max(W(o.r), D(o.r)) * (o.head - (o.sill || 0)); }, 0);
    add(R, `${rm.name}: daylight (glazing ÷ floor area)`, null, '≥ 8 % — IRC R303.1', g / a >= 0.08, `${Math.round((g / a) * 100)} %`);
    const minDim = Math.min(...rm.rects.slice(0, 1).map((r) => Math.min(W(r), D(r))));
    add(R, `${rm.name}: ${a.toFixed(1)} m² / ${Math.round(m2ToFt2(a))} ft², narrowest side`, minDim, '≥ 7 ft (2.13 m), ≥ 70 ft² (6.5 m²) — IRC R304', ge(minDim, FT(7)) && a >= 6.5);
  }
  add(R, 'Clear ceiling height (front block 2.70 m, white block and living 3.00 m)', META.ceiling, '≥ 7 ft (2.13 m) — IRC R305', ge(META.ceiling, FT(7)));
  for (const [id, rid] of [['G1', "Kid's bedroom"], ['G2', 'Master bedroom'], ['G4', 'Bedroom 2']]) {
    const o = op(id);
    const w = Math.max(W(o.r), D(o.r)) / ((o.mullions || 0) + 1), h = o.head - o.sill;
    const clear = w * h;
    add(R, `${rid}: emergency escape opening (opening sash)`, null, '≥ 5.7 ft² (0.53 m²), sill ≤ 44 in — IRC R310', clear >= 0.53 && (o.sill || 0) <= IN(44), `${clear.toFixed(2)} m² / ${Math.round(m2ToFt2(clear))} ft², sill ${both(o.sill)}`);
  }
  const g = room('garage').rects[0];
  add(R, `Garage ${both(W(g))} × ${both(D(g))}, door ${both(W(op('D9').r))}`, Math.min(W(g), D(g)), '≥ 3.0 m wide, ≥ 5.5 m deep for one car', ge(W(g), 3.0) && ge(D(g), 5.5));
  const living = ROOMS.filter((r) => r.id !== 'garage').reduce((s, r) => s + roomArea(r), 0);
  add(R, 'Net living area (all rooms, excluding the garage)', null, 'three bedrooms, about 130 m² (1,400 ft²)', living > 110 && living < 160, `${living.toFixed(1)} m² / ${Math.round(m2ToFt2(living))} ft²`);

  const I = 'Furniture fit';
  const mb = item('mbed').r, mr = room('master').rects[0];
  add(I, 'Master bed: free side ↔ nearest obstruction (front wall / wardrobe)', Math.min(mb[1] - mr[1], item('mward').r[1] - mb[3]), '≥ 24 in (0.61 m)', ge(Math.min(mb[1] - mr[1], item('mward').r[1] - mb[3]), IN(24)));
  add(I, 'Master: bench ↔ wardrobe front', item('mward').r[1] - item('mbench').r[3], '≥ 36 in (0.91 m)', ge(item('mward').r[1] - item('mbench').r[3], IN(36)));
  const gb = item('gbed').r;
  add(I, 'Bedroom 2: foot of the bed ↔ wardrobe front', gb[1] - item('gward').r[3], '≥ 36 in (0.91 m)', ge(gb[1] - item('gward').r[3], IN(36)));
  const kb = item('kbed').r;
  add(I, "Kid's room: bed ↔ wardrobe", item('kward').r[0] - kb[2], '≥ 36 in (0.91 m)', ge(item('kward').r[0] - kb[2], IN(36)));
  const car = item('car1').r;
  add(I, 'Garage: space beside the car to open doors', Math.min(car[0] - g[0], g[2] - car[2]), '≥ 0.6 m (24 in)', ge(Math.min(car[0] - g[0], g[2] - car[2]), 0.6));
  return rows.slice();
}

function doorName(d) {
  const names = { D2: "kid's room", D3: 'master bedroom', D4: 'en-suite', D5: 'bedroom 2', D6: 'bathroom', D7: 'guest WC', D8: 'pantry', D10: 'garage side door' };
  return names[d.id] || d.id;
}
