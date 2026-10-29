// The A2 pencil sheet: plan + dimensions + notes + title block (the area schedule lives in the
// room cards and on the plan page). sheet: false → only the drawing itself, for the website.
// Returns an SVG string.
import { META, ROOMS, SITE, roomArea } from './plan-data.js';
import { Sketch } from './pencil.js';
import { textStrokes } from './lettering.js';
import { makeT, text, drawSite, drawWalls, drawOpenings, drawItems, drawLabels } from './sketch-plan.js';
import { len, area, size, M_PER_FT } from './units.js';

export const SHEET = { w: 594, h: 420 };
export const PLAN_T = { S: 10, ox: 118, oy: 322 }; // 1:100 → 10 mm per metre

const STYLES = {
  main: { color: '#2b2a29', w: 0.25, o: 0.85 },
  wall: { color: '#252423', w: 0.42, o: 0.92, filter: 'graphite' },
  wallInt: { color: '#2b2a29', w: 0.3, o: 0.88, filter: 'graphite' },
  poche: { color: '#2b2a29', w: 0.13, o: 0.72, filter: 'graphite' },
  thin: { color: '#2b2a29', w: 0.19, o: 0.8 },
  glass: { color: '#2b2a29', w: 0.13, o: 0.75 },
  arc: { color: '#2b2a29', w: 0.12, o: 0.55 },
  furn: { color: '#2e2d2c', w: 0.16, o: 0.6 },
  faint: { color: '#2e2d2c', w: 0.11, o: 0.42 },
  soft: { color: '#3a3936', w: 0.11, o: 0.28 },
  site: { color: '#33322f', w: 0.16, o: 0.5 },
  water: { color: '#39424b', w: 0.12, o: 0.38 },
  tree: { color: '#33322f', w: 0.15, o: 0.45, filter: 'graphite' },
  dim: { color: '#2b2a29', w: 0.12, o: 0.72 },
  text: { color: '#232221', w: 0.3, o: 0.9, filter: 'graphite' },
  textS: { color: '#2b2a29', w: 0.19, o: 0.82 },
  frame: { color: '#2b2a29', w: 0.32, o: 0.85, filter: 'graphite' },
};

function textRot(sk, str, x, y, sizeMm, rot, opts = {}) {
  const { lines } = textStrokes(str, 0, 0, sizeMm, opts);
  const c = Math.cos(rot), s = Math.sin(rot);
  sk.strokes(lines.map((l) => l.map(([u, v]) => [x + u * c - v * s, y + u * s + v * c])), { wobble: 0.025 });
}

// Chain of dimensions along x at plan-y = yAt (or along y at plan-x = xAt).
function chain(sk, T, pts, { axis = 'x', at, from, units }) {
  sk.pen('dim');
  const P = (u) => (axis === 'x' ? T.p(u, at) : T.p(at, u));
  const a = P(pts[0]), b = P(pts[pts.length - 1]);
  sk.line(a, b, { over: 2.2, wobble: 0.06 });
  for (const u of pts) {
    const p = P(u);
    // extension line from the building face
    const q = axis === 'x' ? T.p(u, from) : T.p(from, u);
    const dirx = Math.sign(p[0] - q[0]), diry = Math.sign(p[1] - q[1]);
    sk.pen('faint');
    sk.line([q[0] + dirx * 1.2, q[1] + diry * 1.2], [p[0] + dirx * 1.4, p[1] + diry * 1.4], { wobble: 0.03 });
    sk.pen('dim');
    sk.line([p[0] - 1.1, p[1] + 1.1], [p[0] + 1.1, p[1] - 1.1], { wobble: 0.02, lift: 0.02 });
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const m = (pts[i] + pts[i + 1]) / 2, d = pts[i + 1] - pts[i];
    const p = P(m);
    sk.pen('textS');
    if (axis === 'x') text(sk, len(d, units), p[0], p[1] - 1.1, 1.75, { align: 'middle' });
    else textRot(sk, len(d, units), p[0] - 1.1, p[1], 1.75, -Math.PI / 2, { align: 'middle' });
  }
}

function northArrow(sk, cx, cy) {
  // north points up the sheet (to the garden)
  sk.pen('thin'); sk.circle(cx, cy, 9);
  sk.pen('wall');
  sk.poly([[cx - 3.2, cy + 6], [cx, cy - 10.5], [cx + 3.2, cy + 6], [cx, cy + 3.5], [cx - 3.2, cy + 6]], { wobble: 0.05 });
  sk.pen('poche'); sk.hatch(cx - 2.8, cy - 6, cx, cy + 3.5, { gap: 0.4, angle: 20 });
  sk.pen('text'); text(sk, 'N', cx, cy - 12.5, 3.4, { align: 'middle' });
}

function sunArrow(sk, cx, cy) {
  // evening sun from the west (sheet left), along the driveway into the corner glazing
  sk.pen('thin'); sk.circle(cx, cy - 1, 3.2);
  for (let a = 0; a < 6.28; a += 0.785) sk.line([cx + Math.cos(a) * 4.6, cy - 1 + Math.sin(a) * 4.6], [cx + Math.cos(a) * 6.4, cy - 1 + Math.sin(a) * 6.4], { wobble: 0.02 });
  sk.pen('faint'); sk.arc(cx - 2, cy + 26, 30, -Math.PI * 0.85, -Math.PI * 0.18, { seg: 30 });
  sk.pen('dim'); sk.line([cx + 3, cy + 8], [cx + 3, cy + 22], { wobble: 0.03 });
  sk.line([cx + 3, cy + 22], [cx + 1.2, cy + 18.6], { wobble: 0.02 }); sk.line([cx + 3, cy + 22], [cx + 4.8, cy + 18.6], { wobble: 0.02 });
}

function scaleBar(sk, x, y, units, ts = 1.8) {
  sk.pen('thin');
  const S = PLAN_T.S;
  if (units === 'imperial') {
    const ft = M_PER_FT * S; // mm per foot
    const ticks = [0, 4, 8, 16];
    sk.line([x, y], [x + 16 * ft, y], { wobble: 0.03, over: 0.5 }); sk.line([x, y + 1.6], [x + 16 * ft, y + 1.6], { wobble: 0.03 });
    for (let i = 0; i < 16; i += 4) if ((i / 4) % 2 === 0) { sk.pen('poche'); sk.hatch(x + i * ft, y, x + (i + 4) * ft, y + 1.6, { gap: 0.35 }); sk.pen('thin'); }
    for (const t of ticks) { sk.line([x + t * ft, y - 0.8], [x + t * ft, y + 2.4], { wobble: 0.02 }); sk.pen('textS'); text(sk, `${t}`, x + t * ft, y - 1.6, ts, { align: 'middle' }); sk.pen('thin'); }
    sk.pen('textS'); text(sk, 'FT', x + 16 * ft + 3, y + 1.8, ts);
  } else {
    const ticks = [0, 1, 2, 3, 4, 5];
    sk.line([x, y], [x + 5 * S, y], { wobble: 0.03, over: 0.5 }); sk.line([x, y + 1.6], [x + 5 * S, y + 1.6], { wobble: 0.03 });
    for (let i = 0; i < 5; i += 2) { sk.pen('poche'); sk.hatch(x + i * S, y, x + (i + 1) * S, y + 1.6, { gap: 0.35 }); }
    sk.pen('thin');
    for (const t of ticks) { sk.line([x + t * S, y - 0.8], [x + t * S, y + 2.4], { wobble: 0.02 }); sk.pen('textS'); text(sk, `${t}`, x + t * S, y - 1.6, ts, { align: 'middle' }); sk.pen('thin'); }
    sk.pen('textS'); text(sk, 'M', x + 5 * S + 3, y + 1.8, ts);
  }
}

export function scheduleRows() {
  const order = ['ldk', 'master', 'ensuite', 'guest', 'kid', 'bath', 'wc', 'hall', 'pantry', 'garage'];
  const rows = order.map((id) => { const rm = ROOMS.find((r) => r.id === id); const r0 = rm.rects[0]; return { id, name: rm.name, w: r0[2] - r0[0], d: r0[3] - r0[1], area: roomArea(rm), living: id !== 'garage', size: id !== 'hall' }; });
  const ar = (r) => (r[2] - r[0]) * (r[3] - r[1]);
  return { rows, living: rows.filter((r) => r.living).reduce((a, r) => a + r.area, 0), terrace: ar(SITE.terrace), pergola: ar(SITE.pergola.r) };
}

// Opening legend: north arrow, scale bar, drawing name, in paper millimetres (1:100).
export function renderLegend({ units = 'metric' } = {}) {
  const sk = new Sketch(5);
  northArrow(sk, 11, 13);
  scaleBar(sk, 40, 14, units, 2.4);
  sk.pen('textS'); text(sk, 'SCALE 1:100', 40, 24, 2.4, { tracking: 1.2 });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 30">${sk.toSVG(STYLES)}</svg>`;
}

function titleBlock(sk, x, y, w, h, units) {
  sk.pen('frame'); sk.rect(x, y, x + w, y + h, { over: 1.2, wobble: 0.1 });
  const row = (yy) => { sk.pen('thin'); sk.line([x, yy], [x + w, yy], { wobble: 0.06 }); };
  sk.pen('text'); text(sk, META.project, x + 5, y + 13, 6.2, { tracking: 2.2 });
  sk.pen('textS'); text(sk, META.subtitle.toUpperCase(), x + 5, y + 20.5, 1.9);
  row(y + 26);
  sk.pen('text'); text(sk, META.drawing.toUpperCase(), x + 5, y + 34, 3.4, { tracking: 1.3 });
  sk.pen('textS'); text(sk, units === 'imperial' ? 'FEET-INCHES. CLEAR ROOM SIZES.' : 'METRES. CLEAR ROOM SIZES.', x + 5, y + 40.5, 1.8);
  row(y + 45);
  const cols = [['SCALE', META.scale], ['DATE', META.date], ['DRAWN', META.drawnBy], ['SHEET', META.sheet], ['REV', META.rev]];
  const cw = w / cols.length;
  cols.forEach(([k, v], i) => {
    const cx = x + i * cw;
    if (i) { sk.pen('thin'); sk.line([cx, y + 45], [cx, y + h], { wobble: 0.04 }); }
    sk.pen('textS'); text(sk, k, cx + 3, y + 50.5, 1.5);
    sk.pen('text'); text(sk, v, cx + 3, y + 58.5, 2.4);
  });
}

function notes(sk, x, y, units) {
  sk.pen('text'); text(sk, 'NOTES', x, y, 2.6, { tracking: 1.4 });
  sk.pen('thin'); sk.line([x, y + 2.2], [x + 186, y + 2.2], { wobble: 0.1, over: 1 });
  const c = units === 'imperial' ? ["8'-10\"", "9'-10\""] : ['2.70', '3.00'];
  const lines = [
    `CEILINGS ${c[0]} FRONT BLOCK, ${c[1]} WHITE BLOCK AND LIVING`,
    units === 'imperial' ? 'WALLS: EXT 12" · BETWEEN VOLUMES 12" · INT 5"' : 'WALLS: EXT 300 · BETWEEN VOLUMES 300 · INT 120',
    'FACADE: TIMBER CLADDING, WHITE RENDER, ANTHRACITE',
    'DASHED: ROOF LIGHTS, PERGOLA, HIGH WINDOWS',
    'GARDEN FACES NORTH · EVENING SUN FROM THE DRIVE',
  ];
  sk.pen('textS');
  lines.forEach((l, i) => text(sk, l, x, y + 8 + i * 5.2, 1.75));
}

export function renderSheet({ units = 'metric', seed = 11, withPaper = true, sheet = true } = {}) {
  const sk = new Sketch(seed);
  const T = makeT(PLAN_T.S, PLAN_T.ox, PLAN_T.oy);
  // sheet frame
  if (sheet) {
    sk.pen('frame'); sk.rect(10, 10, SHEET.w - 10, SHEET.h - 10, { over: 2, wobble: 0.2 });
    sk.pen('thin'); sk.line([372, 10], [372, SHEET.h - 10], { over: 1.5, wobble: 0.2 });
  }

  drawSite(sk, T);
  drawItems(sk, T);
  drawWalls(sk, T);
  drawOpenings(sk, T);
  const skL = new Sketch(seed + 1);
  const knock = drawLabels(skL, T, units);

  // site labels
  const lab = (s, x, y, size = 1.9, opts = { align: 'middle', tracking: 1.3 }) => { const [px, py] = T.p(x, y); text(sk, s, px, py, size, opts); };
  sk.pen('textS');
  lab('TERRACE', 3.0, 17.4, 2.0);
  lab('PERGOLA', 2.0, 22.75, 1.8);
  lab('GARDEN', 6.5, 21.0, 2.4);
  lab('DRIVEWAY', -3.3, 4.0, 1.8, { align: 'middle', tracking: 1.3 });
  lab('STREET', 3.0, -11.4, 2.4, { align: 'middle', tracking: 3 });
  lab('ENTRANCE', 10.05, -8.6, 1.6);
  lab('NEIGHBOUR', 17.4, 8.0, 1.8);
  const [ex, ey] = T.p(10.05, -7.8);
  sk.pen('dim'); sk.line([ex, ey], [ex, ey - 30], { wobble: 0.05 });
  sk.line([ex, ey - 30], [ex - 1.6, ey - 26.6], { wobble: 0.02 }); sk.line([ex, ey - 30], [ex + 1.6, ey - 26.6], { wobble: 0.02 });

  // dimension chains
  chain(sk, T, [1.6, 5.84, 7.76, 11.9], { axis: 'x', at: -0.55, from: 0, units });
  chain(sk, T, [0, 11.9], { axis: 'x', at: 16.6, from: 15.4, units });
  chain(sk, T, [0, 4.9, 9.75, 15.4], { axis: 'y', at: 12.9, from: 11.9, units });
  chain(sk, T, [0, 15.4], { axis: 'y', at: 13.9, from: 12.9, units });

  // right column
  if (sheet) {
    northArrow(sk, 392, 40);
    sunArrow(sk, 424, 28);
    sk.pen('textS'); text(sk, 'EVENING SUN', 440, 33, 1.7); text(sk, 'FROM THE WEST', 440, 37.5, 1.7);
    sk.pen('textS'); text(sk, 'NORTH', 386, 56, 1.6);
    notes(sk, 380, 76, units);
    scaleBar(sk, 384, 114, units);
    sk.pen('textS'); text(sk, 'SCALE 1:100', 384 + 65, 116, 1.8);
    titleBlock(sk, 380, SHEET.h - 82, 194, 66, units);
  }

  const body = sk.toSVG(STYLES) + knock.map(([x0, y0, x1, y1]) => `<rect x="${x0.toFixed(2)}" y="${y0.toFixed(2)}" width="${(x1 - x0).toFixed(2)}" height="${(y1 - y0).toFixed(2)}" rx="1.2" fill="#f2eee5" fill-opacity="0.9"/>`).join('') + skL.toSVG(STYLES);
  const defs = `<defs>
    <filter id="graphite" x="-2%" y="-2%" width="104%" height="104%">
      <feTurbulence type="fractalNoise" baseFrequency="1.9" numOctaves="2" seed="4" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.55" result="m"/>
      <feComposite in="SourceGraphic" in2="m" operator="in"/>
    </filter>
    <filter id="paper" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="4" seed="9"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.36  0 0 0 0 0.33  0 0 0 0 0.28  0 0 0 0.075 0"/>
    </filter>
    <radialGradient id="vig" cx="50%" cy="48%" r="75%">
      <stop offset="60%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#5a4a30" stop-opacity="0.10"/>
    </radialGradient>
  </defs>`;
  const paper = withPaper ? `<rect width="${SHEET.w}" height="${SHEET.h}" fill="#f2eee5"/><rect width="${SHEET.w}" height="${SHEET.h}" filter="url(#paper)"/><rect width="${SHEET.w}" height="${SHEET.h}" fill="url(#vig)"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SHEET.w} ${SHEET.h}" width="${SHEET.w}mm" height="${SHEET.h}mm">${defs}${paper}<g>${body}</g></svg>`;
}
