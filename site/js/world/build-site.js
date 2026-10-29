// Ground, hard landscaping, fences and gates, the pergola, the street and the neighbour's house.
import { SITE } from '../plan-data.js';
import { wallOutline } from '../geometry.js';
import { Z, zoneAt, inBuilding, FOOTPRINTS } from './zones.js';
import { LV, rectMinus } from './build-arch.js';

const G = LV.ground, LAWN = LV.lawn;

// Hard surfaces at ground level. Non-overlapping rectangles.
export function hardscape() {
  const list = [
    { m: 'driveway', r: SITE.driveway },
    { m: 'pavers', r: SITE.porch },
    ...rectMinus(SITE.apron, [SITE.porch]).map((r) => ({ m: 'pavers', r })),
    { m: 'pavers', r: SITE.terrace },
    { m: 'pavers', r: SITE.patio },
    { m: 'pavers', r: [9.5, -7.3, 10.6, -6.2] },               // from the garden gate to the kerb
  ];
  return list;
}

// fence bays between posts: [x0, y0, x1, y1] in plan, along a line
function bays(a, b, step = 2.4) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / step)), out = [];
  for (let i = 0; i < n; i++) out.push([a.map((v, k) => v + ((b[k] - v) * i) / n), a.map((v, k) => v + ((b[k] - v) * (i + 1)) / n)]);
  return out;
}

export function hedges() { return []; }

export function buildSite(mb) {
  const hs = hardscape();
  for (const { m, r } of hs) mb.rect('site', m, 'z', 1, G, [r[0], r[2]], [r[1], r[3]], zoneAt((r[0] + r[2]) / 2, (r[1] + r[3]) / 2));

  // edges of the hard surfaces, down to the lawn (not against the buildings)
  const inHard = (x, y) => hs.some(({ r }) => x > r[0] && x < r[2] && y > r[1] && y < r[3]);
  for (const e of wallOutline(hs.map(({ r }) => ({ r, t: 'h' })))) {
    const mx = (e.a[0] + e.b[0]) / 2, my = (e.a[1] + e.b[1]) / 2;
    const horiz = Math.abs(e.a[1] - e.b[1]) < 1e-6;
    for (const s of [-1, 1]) {
      const px = horiz ? mx : mx + s * 0.03, py = horiz ? my + s * 0.03 : my;
      if (inHard(px, py)) continue;
      if (inBuilding(px, py) || py < -7.25) break;
      const zone = zoneAt(mx - (horiz ? 0 : s * 0.03), my - (horiz ? s * 0.03 : 0));
      if (horiz) mb.rect('site', 'pavers', 'y', s, my, [Math.min(e.a[0], e.b[0]), Math.max(e.a[0], e.b[0])], [LAWN - 0.05, G], zone);
      else mb.rect('site', 'pavers', 'x', s, mx, [Math.min(e.a[1], e.b[1]), Math.max(e.a[1], e.b[1])], [LAWN - 0.05, G], zone);
    }
  }

  // stepping stones across the front lawn, from the garden gate to the porch
  for (const [x0, y0, x1, y1] of SITE.stones) mb.box('site', 'pavers', [x0, y0, LAWN - 0.02, x1, y1, LAWN + 0.07], Z.front, { skip: ['z-'] });

  // lawn inside the plot (baked with the house's shadows), the verge, the far ground
  const near = SITE.plot;
  const holes = [...hs.map(({ r }) => r), ...FOOTPRINTS, ...SITE.beds, ...SITE.stones];
  for (const r of rectMinus(near, holes)) mb.rect('site', 'lawn', 'z', 1, LAWN, [r[0], r[2]], [r[1], r[3]], zoneAt((r[0] + r[2]) / 2, (r[1] + r[3]) / 2), { lines: false });
  const verge = [-40, -7.3, 60, -6.2], kerb = [-40, -7.5, 60, -7.3], street = [-40, -15, 60, -7.5], walk = [-40, -17, 60, -15];
  const area = [-40, -17, 60, 60];
  for (const r of rectMinus(verge, hs.map(({ r }) => r))) mb.rect('site', 'lawn', 'z', 1, LAWN, [r[0], r[2]], [r[1], r[3]], Z.front, { lines: false });
  for (const r of rectMinus(area, [near, verge, kerb, street, walk])) mb.rect('site', 'lawn', 'z', 1, LAWN, [r[0], r[2]], [r[1], r[3]], zoneAt((r[0] + r[2]) / 2, (r[1] + r[3]) / 2), { lines: false });
  mb.rect('site', 'driveway', 'z', 1, G, [SITE.driveway[0], SITE.driveway[2]], [-7.5, -7.4], Z.front, { lines: false });
  for (const r of rectMinus(kerb, [[SITE.driveway[0], -7.5, SITE.driveway[2], -7.3]])) mb.rect('site', 'concrete', 'z', 1, -0.04, [r[0], r[2]], [r[1], r[3]], Z.front, { lines: false });
  mb.rect('site', 'asphalt', 'z', 1, -0.17, [street[0], street[2]], [street[1], street[3]], Z.front, { lines: false });
  mb.rect('site', 'concrete', 'y', -1, -7.5, [street[0], street[2]], [-0.17, -0.04], Z.front);
  mb.rect('site', 'concrete', 'z', 1, -0.04, [walk[0], walk[2]], [walk[1], walk[3]], Z.front, { lines: false });
  mb.rect('site', 'concrete', 'y', 1, -15, [street[0], street[2]], [-0.17, -0.04], Z.front);
  for (const [r, zn] of [[[-200, -120, -40, 220], Z.front], [[60, -120, 230, 220], Z.front], [[-40, 60, 60, 220], Z.garden], [[-40, -120, 60, -17], Z.front]]) mb.rect('site', 'lawn', 'z', 1, LAWN, [r[0], r[2]], [r[1], r[3]], zn, { lines: false });

  // fences: white rendered plinth, anthracite posts and six horizontal slats
  const fenceBay = ([a, b], gate = false) => {
    const zone = zoneAt((a[0] + b[0]) / 2 + (a[0] === b[0] ? (a[0] < 0 ? 0.3 : -0.3) : 0), (a[1] + b[1]) / 2 + (a[1] === b[1] ? (a[1] < 0 ? 0.3 : -0.3) : 0));
    const H = Math.abs(a[1] - b[1]) < 1e-6;
    const R = (s0, s1, t, z0, z1) => (H ? [Math.min(s0, s1), a[1] - t, z0, Math.max(s0, s1), a[1] + t, z1] : [a[0] - t, Math.min(s0, s1), z0, a[0] + t, Math.max(s0, s1), z1]);
    const s0 = H ? a[0] : a[1], s1 = H ? b[0] : b[1];
    const street = H && a[1] < -6;                   // the street side is kept low, so the house shows over it
    const plinth = street ? 0.4 : 0.55, top = street ? 1.12 : 1.45;
    const base = gate ? 0.06 : plinth + 0.03;
    if (!gate) mb.box('site', 'render', R(s0, s1, 0.11, LAWN - 0.05, plinth), zone, { skip: ['z-'] });
    mb.box('site', 'fenceMetal', R(s0, s0 + Math.sign(s1 - s0) * 0.06, 0.035, gate ? G : plinth, top), zone);
    if (gate) mb.box('site', 'fenceMetal', R(s1 - Math.sign(s1 - s0) * 0.06, s1, 0.035, G, top), zone);
    const n = gate ? (street ? 7 : 9) : street ? 5 : 6, gap = (top - 0.03 - base) / n;
    for (let i = 0; i < n; i++) mb.box('site', 'fenceMetal', R(s0, s1, 0.015, base + i * gap + gap * 0.3, base + (i + 1) * gap), zone, { lines: i === n - 1 });
  };
  for (const f of SITE.fences) for (const bay of bays(f.a, f.b)) fenceBay(bay);
  for (const g of SITE.gates) for (const bay of bays(g.a, g.b, 1.9)) fenceBay(bay, true);

  // the low angled concrete wall between driveway and front lawn
  {
    const { a, b, h1 } = SITE.wedge, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ax = [dx / L, dy / L, 0];
    mb.obox('site', 'plinth', [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (LAWN + h1) / 2], [L / 2, 0.1, (h1 - LAWN) / 2], [ax, [-ax[1], ax[0], 0], [0, 0, 1]], Z.front);
  }

  // timber pergola against the garage: a ledger on the garage wall, two posts, rafters on top
  {
    const p = SITE.pergola, [x0, y0, x1, y1] = p.r, h = p.h, zone = Z.garden;
    for (const [x, y] of p.posts) mb.box('site', 'cedarBeam', [x - 0.075, y - 0.075, G, x + 0.075, y + 0.075, h], zone);
    mb.box('site', 'cedarBeam', [p.posts[0][0] - 0.06, y0 - 0.25, h - 0.24, p.posts[0][0] + 0.06, y1 + 0.25, h], zone);    // beam on the posts
    mb.box('site', 'cedarBeam', [x0, y0 - 0.25, h - 0.24, x0 + 0.08, y1 + 0.25, h], zone);                                   // ledger on the garage
    for (let y = y0 - 0.15; y <= y1 + 0.16; y += 0.48) mb.box('site', 'cedarBeam', [x0, y - 0.03, h, x1 + 0.35, y + 0.03, h + 0.2], zone);
  }

  // planted beds: bark mulch a little above the lawn, a thin black steel edge
  for (const [x0, y0, x1, y1] of SITE.beds) {
    const z = zoneAt((x0 + x1) / 2, (y0 + y1) / 2);
    mb.rect('site', 'mulch', 'z', 1, LAWN + 0.03, [x0, x1], [y0, y1], z, { lines: false });
    const e = 0.006, top = LAWN + 0.05;
    mb.box('site', 'frame', [x0 - e, y0 - e, LAWN - 0.02, x1 + e, y0 + e, top], z, { skip: ['z-'] });
    mb.box('site', 'frame', [x0 - e, y1 - e, LAWN - 0.02, x1 + e, y1 + e, top], z, { skip: ['z-'] });
    mb.box('site', 'frame', [x0 - e, y0 + e, LAWN - 0.02, x0 + e, y1 - e, top], z, { skip: ['z-'] });
    mb.box('site', 'frame', [x1 - e, y0 + e, LAWN - 0.02, x1 + e, y1 - e, top], z, { skip: ['z-'] });
  }

  // the neighbour's house: rendered walls under a grey metal gable roof (context only)
  {
    const { r: [x0, y0, x1, y1], eave, ridge } = SITE.neighbour, z = Z.front, o = 0.35, xm = (x0 + x1) / 2;
    mb.box('site', 'neighbourRender', [x0, y0, LAWN, x1, y1, eave], z, { skip: ['z-', 'z+'] });
    mb.box('site', 'plinth', [x0 - 0.02, y0 - 0.02, LAWN, x1 + 0.02, y1 + 0.02, 0.3], z, { skip: ['z-', 'z+'], lines: false });
    for (const [ya, yb, sg] of [[y0, y0, -1], [y1, y1, 1]]) {
      void yb;
      mb.tri('site', 'neighbourRender', [x0, ya, eave], [x1, ya, eave], [xm, ya, ridge], [0, sg, 0], z);
      mb.line('site', [x0, ya, eave], [xm, ya, ridge], z); mb.line('site', [x1, ya, eave], [xm, ya, ridge], z);
    }
    for (const sg of [-1, 1]) {
      const xe = sg < 0 ? x0 - o : x1 + o, ze = eave - o * (ridge - eave) / (xm - x0);
      const n = [sg * (ridge - eave), 0, xm - x0], l = Math.hypot(...n);
      mb.quad('site', 'metalRoof', [xe, y0 - o, ze], [xm, y0 - o, ridge], [xm, y1 + o, ridge], [xe, y1 + o, ze], n.map((v) => v / l), z);
      mb.quad('site', 'metalRoof', [xe, y0 - o, ze - 0.06], [xe, y1 + o, ze - 0.06], [xm, y1 + o, ridge - 0.06], [xm, y0 - o, ridge - 0.06], n.map((v) => -v / l), z);
      mb.line('site', [xe, y0 - o, ze], [xe, y1 + o, ze], z);
    }
    mb.line('site', [xm, y0 - o, ridge], [xm, y1 + o, ridge], z);
  }
  return mb;
}
