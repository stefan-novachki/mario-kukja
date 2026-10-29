// Draws the house itself: walls (poché), openings, fixtures, furniture, site, room labels.
import { WALLS, OPENINGS, ITEMS, ROOMS, SKYLIGHTS, SITE, roomArea } from './plan-data.js';
import { wallPieces, wallOutline, doorLeaf, isH } from './geometry.js';
import { drawSymbol, drawGlass } from './sketch-symbols.js';
import { textStrokes } from './lettering.js';
import { area, size } from './units.js';

export function makeT(S, ox, oy) {
  return {
    S, ox, oy,
    p: (x, y) => [ox + x * S, oy - y * S],
    r: ([x0, y0, x1, y1]) => [ox + x0 * S, oy - y1 * S, ox + x1 * S, oy - y0 * S],
  };
}

export function text(sk, str, x, y, sizeMm, opts = {}) {
  const { lines, width } = textStrokes(str, x, y, sizeMm, opts);
  sk.strokes(lines, { wobble: 0.025 });
  return width;
}

export function drawSite(sk, T) {
  const { S } = T;
  // fences on the property line: plinth and slats, the two gates drawn open-ended
  sk.pen('site');
  for (const f of SITE.fences) { const a = T.p(...f.a), b = T.p(...f.b); sk.line2(a, b, { wobble: 0.15, over: 0.6 }); }
  sk.pen('thin');
  for (const g of SITE.gates) { const a = T.p(...g.a), b = T.p(...g.b); sk.dashed([a[0], a[1] - 0.6], [b[0], b[1] - 0.6], { dash: 1.2, gap: 0.8 }); }
  // street edge
  sk.pen('site');
  sk.line(T.p(SITE.plot[0] - 3, SITE.street), T.p(SITE.plot[2] + 3, SITE.street), { wobble: 0.3, over: 3 });
  sk.line(T.p(SITE.plot[0] - 3, SITE.street - 0.2), T.p(SITE.plot[2] + 3, SITE.street - 0.2), { wobble: 0.3, over: 3 });
  // driveway slabs
  const dr = T.r(SITE.driveway);
  sk.pen('soft'); sk.rect(...dr, { wobble: 0.15, over: 1.2 });
  for (let y = dr[1] + 12; y < dr[3]; y += 12) sk.line([dr[0], y], [dr[2], y], { wobble: 0.05 });
  sk.line([(dr[0] + dr[2]) / 2, dr[1]], [(dr[0] + dr[2]) / 2, dr[3]], { wobble: 0.08 });
  // paving: apron, porch, terrace, patio (600 x 1200 slabs)
  for (const pv of [SITE.apron, SITE.terrace, SITE.patio]) {
    const r = T.r(pv);
    sk.pen('site'); sk.rect(...r, { wobble: 0.12, over: 1.2 });
    sk.pen('soft');
    for (let y = r[3] - 6; y > r[1] + 0.5; y -= 6) sk.line([r[0], y], [r[2], y], { wobble: 0.04, lift: 0.05 });
  }
  for (const st of SITE.stones) { sk.pen('furn'); sk.rect(...T.r(st), { wobble: 0.05, over: 0.3 }); }
  // the angled concrete wall at the drive and its light post
  sk.pen('wall'); sk.line2(T.p(...SITE.wedge.a), T.p(...SITE.wedge.b), { wobble: 0.05, over: 0.2 });
  { const [cx, cy] = T.p(...SITE.post); sk.pen('wall'); sk.rect(cx - 0.6, cy - 0.6, cx + 0.6, cy + 0.6, { wobble: 0.02 }); }
  // pergola: overhead, dashed, with its two posts
  sk.pen('thin'); sk.dashedRect(...T.r(SITE.pergola.r), { dash: 2.4, gap: 1.2 });
  for (let y = SITE.pergola.r[1] - 0.15; y <= SITE.pergola.r[3] + 0.16; y += 0.48) sk.pen('faint'), sk.dashed(T.p(SITE.pergola.r[0], y), T.p(SITE.pergola.r[2] + 0.35, y), { dash: 0.8, gap: 0.8 });
  for (const [x, y] of SITE.pergola.posts) {
    const [cx, cy] = T.p(x, y);
    sk.pen('wall'); sk.rect(cx - 0.75, cy - 0.75, cx + 0.75, cy + 0.75, { wobble: 0.02, over: 0.2 });
    sk.hatch(cx - 0.75, cy - 0.75, cx + 0.75, cy + 0.75, { gap: 0.3 });
  }
  // the neighbour's house: outline and ridge only
  { const n = T.r(SITE.neighbour.r); sk.pen('faint'); sk.rect(...n, { wobble: 0.15, over: 1 }); sk.dashed([(n[0] + n[2]) / 2, n[1]], [(n[0] + n[2]) / 2, n[3]], { dash: 2, gap: 1.2 }); }
  // outdoor furniture
  for (const it of SITE.outdoor) drawSymbol(sk, it.kind, T.r(it.r), it.face ? [Math.sign(it.face[0]), -Math.sign(it.face[1])] : [0, 1], it, S);
  for (const r of SITE.beds) { sk.pen('soft'); sk.rect(...T.r(r), { wobble: 0.08, over: 0.3 }); scribble(sk, T.r(r)); }
  // trees: loose canopy scribble with trunk dot
  for (const [x, y, rad] of SITE.trees) tree(sk, ...T.p(x, y), rad * S);
  // lawn tufts
  sk.pen('soft');
  const lawnPts = [[-0.8, 3.0], [-0.6, 12.0], [2.5, -4.5], [6.0, -5.0], [11.0, -2.0], [-4.0, 25.6], [2.0, 24.5], [8.0, 20.0], [11.5, 13.0], [6.0, 19.0], [-5.8, 4.0], [-5.8, 12.0]];
  for (const [x, y] of lawnPts) tuft(sk, ...T.p(x, y));
}

function scribble(sk, [X0, Y0, X1, Y1]) {
  sk.pen('soft');
  for (let i = 0; i < 6; i++) {
    const cx = X0 + sk.rand(1.5, X1 - X0 - 1.5), cy = Y0 + sk.rand(1.5, Y1 - Y0 - 1.5);
    sk.circle(cx, cy, sk.rand(0.8, 1.6));
  }
}

function tree(sk, cx, cy, R) {
  // scalloped canopy, drawn twice with a slight offset, plus a few branch strokes
  for (let pass = 0; pass < 2; pass++) {
    sk.pen(pass ? 'soft' : 'tree');
    const pts = [];
    const lobes = Math.round(9 + R / 3), s0 = sk.rand(0, 6.28);
    const n = lobes * 6;
    for (let i = 0; i <= n + 3; i++) {
      const a = s0 + (i / n) * Math.PI * 2;
      const rr = R * (0.9 + 0.1 * Math.abs(Math.sin((a - s0) * lobes / 2)) + sk.rand(-0.02, 0.02)) * (pass ? 0.96 : 1);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    sk.poly(pts, { wobble: 0.08 });
  }
  sk.pen('soft');
  for (let i = 0; i < 4; i++) {
    const a = sk.rand(0, 6.28);
    sk.line([cx, cy], [cx + Math.cos(a) * R * sk.rand(0.4, 0.7), cy + Math.sin(a) * R * sk.rand(0.4, 0.7)], { wobble: 0.1 });
  }
  sk.pen('furn'); sk.circle(cx, cy, 0.45);
}

function tuft(sk, x, y) {
  for (let i = -2; i <= 2; i++) sk.line([x + i * 0.5, y], [x + i * 0.9, y - sk.rand(1.2, 2)], { wobble: 0.02, lift: 0.02 });
}

export function drawWalls(sk, T) {
  const pieces = wallPieces();
  for (const p of pieces) {
    const r = T.r(p.r);
    if (p.t === 'ext' || p.t === 'party') { sk.pen('poche'); sk.hatch(...r, { gap: 0.55, angle: 45 }); }
    else { sk.pen('poche'); sk.hatch(...r, { gap: 0.32, angle: 45, jitter: 0.05 }); }
  }
  const edges = wallOutline(pieces);
  for (const e of edges) {
    sk.pen(e.t === 'int' ? 'wallInt' : 'wall');
    const a = T.p(...e.a), b = T.p(...e.b);
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const over = L > 8 ? 1.4 : 0.5;
    if (e.t === 'int') sk.line(a, b, { over, wobble: 0.12 });
    else sk.line2(a, b, { over, wobble: 0.16 });
  }
}

export function drawOpenings(sk, T) {
  const { S } = T;
  for (const o of OPENINGS) {
    const r = T.r(o.r);
    const h = isH(o.r);
    const [X0, Y0, X1, Y1] = r;
    if (o.kind === 'door') {
      const { hinge, open, closed, width } = doorLeaf(o);
      const H = T.p(...hinge), Op = T.p(...open), Cl = T.p(...closed);
      sk.pen('wall'); sk.line(H, Op, { wobble: 0.03, over: 0 });
      // second leaf edge (door thickness)
      const t = 0.45, ux = (Op[0] - H[0]) / (width * S), uy = (Op[1] - H[1]) / (width * S);
      const nx = (Cl[0] - H[0]) / (width * S), ny = (Cl[1] - H[1]) / (width * S);
      sk.pen('thin'); sk.line([H[0] + nx * t, H[1] + ny * t], [Op[0] + nx * t, Op[1] + ny * t], { wobble: 0.02 });
      const a0 = Math.atan2(Cl[1] - H[1], Cl[0] - H[0]);
      let a1 = Math.atan2(Op[1] - H[1], Op[0] - H[0]);
      let da = a1 - a0;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      sk.pen('arc'); sk.arc(H[0], H[1], width * S, a0, a0 + da, { wobble: 0.04, seg: 20 });
    } else if (o.kind === 'pocket') {
      const L = (h ? o.r[2] - o.r[0] : o.r[3] - o.r[1]) * S;
      sk.pen('thin');
      if (h) { const y = (Y0 + Y1) / 2; sk.line([X0, y], [X1, y], { wobble: 0.02 }); sk.dashed([X0 - L, y], [X0, y], { dash: 0.8, gap: 0.6 }); }
      else { const x = (X0 + X1) / 2; sk.line([x, Y0], [x, Y1], { wobble: 0.02 }); sk.dashed([x, Y1], [x, Y1 + L], { dash: 0.8, gap: 0.6 }); }
    } else if (o.kind === 'garage') {
      sk.pen('thin');
      // overhead door track, drawn inside the garage
      sk.dashed([X0, Y0 - 0.8], [X1, Y0 - 0.8], { dash: 1.6, gap: 0.9 });
      sk.dashed([X0, Y0 - 2.4], [X1, Y0 - 2.4], { dash: 1.6, gap: 0.9 });
    } else if (o.kind === 'window' || o.kind === 'slider') {
      sk.pen('thin');
      if (h) {
        sk.line([X0, Y0], [X1, Y0], { wobble: 0.04 }); sk.line([X0, Y1], [X1, Y1], { wobble: 0.04 });
        if (o.kind === 'window') {
          const y = (Y0 + Y1) / 2;
          sk.pen('glass'); sk.line([X0, y - 0.35], [X1, y - 0.35], { wobble: 0.02 }); sk.line([X0, y + 0.35], [X1, y + 0.35], { wobble: 0.02 });
          if (o.sill >= 1.5) { const yi = o.r[1] < 4 ? Y0 - 1.2 : Y1 + 1.2; sk.pen('faint'); sk.dashed([X0, yi], [X1, yi], { dash: 0.8, gap: 0.6 }); }
        } else {
          const n = o.panels, pw = (X1 - X0) / n;
          sk.pen('glass');
          for (let i = 0; i < n; i++) {
            const y = (Y0 + Y1) / 2 + (i % 2 ? 0.55 : -0.55);
            sk.line([X0 + pw * i - (i ? 1.2 : 0), y], [X0 + pw * (i + 1) + (i < n - 1 ? 1.2 : 0), y], { wobble: 0.02 });
          }
        }
      } else {
        sk.line([X0, Y0], [X0, Y1], { wobble: 0.04 }); sk.line([X1, Y0], [X1, Y1], { wobble: 0.04 });
        const x = (X0 + X1) / 2;
        sk.pen('glass'); sk.line([x - 0.35, Y0], [x - 0.35, Y1], { wobble: 0.02 }); sk.line([x + 0.35, Y0], [x + 0.35, Y1], { wobble: 0.02 });
        if (o.sill >= 1.5) { const xi = o.r[0] > 13 ? X0 - 1.2 : X1 + 1.2; sk.pen('faint'); sk.dashed([xi, Y0], [xi, Y1], { dash: 0.8, gap: 0.6 }); }
      }
    }
  }
  sk.pen('faint');
  for (const s of SKYLIGHTS) { const r = T.r(s.r); sk.dashedRect(...r, { dash: 1, gap: 0.8 }); sk.dashed([r[0], r[1]], [r[2], r[3]], { dash: 1, gap: 0.8 }); }
}

export function drawItems(sk, T) {
  for (const it of ITEMS) {
    const dir = it.face ? [Math.sign(it.face[0]), -Math.sign(it.face[1])] : [0, 1];
    drawSymbol(sk, it.kind, T.r(it.r), dir, it, T.S);
    if (it.glass) drawGlass(sk, it.glass.map(([x0, y0, x1, y1]) => [x0, y0, x1, y1]), T);
  }
  // small appliance letters
  const tag = (s, x, y) => { sk.pen('textS'); text(sk, s, ...T.p(x, y), 1.5, { align: 'middle' }); };
  tag('F', 11.27, 10.33); tag('O', 11.27, 10.98); tag('TV', 3.1, 10.15); tag('BBQ', 3.57, 20.4);
}

// Room labels go on their own sketch so a light paper "knockout" can sit between
// the furniture and the lettering. Returns the knockout rectangles (paper mm).
export function drawLabels(sk, T, units) {
  const knock = [];
  for (const rm of ROOMS) {
    const [cx, cy] = T.p(...rm.label);
    const cap = rm.main ? 2.3 : rm.small ? 1.45 : 1.9;
    const tracking = rm.main ? 1.3 : 1.0;
    const name = rm.name.toUpperCase();
    const r0 = rm.rects[0];
    const roomW = (r0[2] - r0[0]) * T.S;
    let names = [name];
    if (rm.wrap || textStrokes(name, 0, 0, cap, { tracking }).width > roomW * 0.82) names = splitTwo(name);
    const ic = Math.max(1.25, cap * 0.6);
    const a = area(roomArea(rm), units);
    const info = rm.small || rm.id === 'gallery' ? a : `${size(r0[2] - r0[0], r0[3] - r0[1], units).replace(' m', '')}  ·  ${a}`;
    const H = (names.length - 1) * cap * 1.55 + cap + ic * 2.0;
    let y = cy - H / 2 + cap;
    let maxW = 0;
    const firstBase = y;
    sk.pen(rm.main ? 'text' : 'textS');
    for (const n of names) { maxW = Math.max(maxW, text(sk, n, cx, y, cap, { align: 'middle', tracking })); y += cap * 1.55; }
    y += ic * 2.0 - cap * 1.55;
    sk.pen('textS');
    maxW = Math.max(maxW, text(sk, info, cx, y, ic, { align: 'middle' }));
    if (rm.main) {
      const w = textStrokes(names[0], 0, 0, cap, { tracking }).width;
      sk.pen('thin'); sk.line([cx - w / 2 - 0.6, firstBase + 1.0], [cx + w / 2 + 0.6, firstBase + 1.0], { wobble: 0.12, over: 0.6 });
    }
    knock.push([cx - maxW / 2 - 0.9, cy - H / 2 - 0.9, cx + maxW / 2 + 0.9, cy + H / 2 + 0.7]);
  }
  return knock;
}

function splitTwo(s) {
  const parts = s.split(' ');
  if (parts.length < 2) return [s];
  let best = 1, bd = 1e9;
  for (let i = 1; i < parts.length; i++) {
    const d = Math.abs(parts.slice(0, i).join(' ').length - parts.slice(i).join(' ').length);
    if (d < bd) { bd = d; best = i; }
  }
  return [parts.slice(0, best).join(' '), parts.slice(best).join(' ')];
}
