// Furniture & fixture symbols in pencil. Paper rect pr = [X0, Y0, X1, Y1] (mm, y down).
// dir = facing direction on paper (y already flipped).

const mid = (a, b) => (a + b) / 2;

function backSide(pr, dir) {
  // returns the edge opposite to the facing direction: [p, q]
  const [X0, Y0, X1, Y1] = pr;
  if (dir[1] > 0) return [[X0, Y0], [X1, Y0]];
  if (dir[1] < 0) return [[X0, Y1], [X1, Y1]];
  if (dir[0] > 0) return [[X0, Y0], [X0, Y1]];
  return [[X1, Y0], [X1, Y1]];
}

function inset(pr, d) { return [pr[0] + d, pr[1] + d, pr[2] - d, pr[3] - d]; }

export function drawSymbol(sk, kind, pr, dir, it, S) {
  const [X0, Y0, X1, Y1] = pr;
  const w = X1 - X0, h = Y1 - Y0;
  const cx = mid(X0, X1), cy = mid(Y0, Y1);
  const o = { wobble: 0.08, lift: 0.08, over: 0.4 };
  switch (kind) {
    case 'car': {
      sk.pen('faint');
      sk.rrect(X0, Y0, X1, Y1, 4, { wobble: 0.15 });
      sk.rrect(X0 + 1.6, Y0 + h * 0.28, X1 - 1.6, Y0 + h * 0.62, 2);
      sk.line([X0 + 2, Y0 + h * 0.3], [X1 - 2, Y0 + h * 0.3], o);
      break;
    }
    case 'shelf': {
      sk.pen('furn'); sk.rect(X0, Y0, X1, Y1, o);
      const n = Math.max(2, Math.round(Math.max(w, h) / 6));
      for (let i = 1; i < n; i++) {
        if (w > h) sk.line([X0 + (w * i) / n, Y0], [X0 + (w * i) / n, Y1], { wobble: 0.03 });
        else sk.line([X0, Y0 + (h * i) / n], [X1, Y0 + (h * i) / n], { wobble: 0.03 });
      }
      break;
    }
    case 'tank': sk.pen('furn'); sk.rect(X0, Y0, X1, Y1, o); sk.circle(cx, cy, Math.min(w, h) * 0.4); break;
    case 'equipment': sk.pen('furn'); sk.rect(X0, Y0, X1, Y1, o); sk.line([X0, Y0], [X1, Y1], o); sk.line([X1, Y0], [X0, Y1], o); break;
    case 'laundry': {
      sk.pen('furn'); sk.rect(X0, Y0, X1, Y1, o);
      const s = h / 3;
      sk.circle(cx, Y0 + s * 0.5, w * 0.32); sk.circle(cx, Y0 + s * 1.5, w * 0.32);
      sk.rrect(X0 + w * 0.15, Y0 + s * 2.15, X1 - w * 0.15, Y1 - s * 0.15, 1);
      break;
    }
    case 'tall': {
      sk.pen('furn'); sk.rect(X0, Y0, X1, Y1, o);
      const cols = Math.max(1, Math.round(Math.max(w, h) / (0.6 * S)));
      for (let i = 0; i < cols; i++) {
        if (w > h) { const a = X0 + (w * i) / cols, b = X0 + (w * (i + 1)) / cols; sk.line([a, Y0], [b, Y1], { wobble: 0.03 }); sk.line([b, Y0], [a, Y1], { wobble: 0.03 }); if (i) sk.line([a, Y0], [a, Y1], { wobble: 0.02 }); }
        else { const a = Y0 + (h * i) / cols, b = Y0 + (h * (i + 1)) / cols; sk.line([X0, a], [X1, b], { wobble: 0.03 }); sk.line([X0, b], [X1, a], { wobble: 0.03 }); if (i) sk.line([X0, a], [X1, a], { wobble: 0.02 }); }
      }
      break;
    }
    case 'fridge': sk.pen('furn'); sk.rect(X0, Y0, X1, Y1, o); sk.line([X0, Y0], [X1, Y1], o); break;
    case 'media': sk.pen('furn'); sk.rect(X0, Y0, X1, Y1, o); sk.line([X0 + w * 0.2, cy], [X1 - w * 0.2, cy], { wobble: 0.04 }); break;
    case 'bbq': sk.pen('furn'); sk.rect(X0, Y0, X1, Y1, o); sk.rrect(X0 + 1, cy - 2.6, X1 - 1, cy + 2.6, 0.8); break;
    case 'desk': case 'sideboard': case 'bench': case 'nightstand': {
      sk.pen('furn'); sk.rect(X0, Y0, X1, Y1, o);
      if (kind === 'nightstand') { sk.circle(cx, cy, Math.min(w, h) * 0.25); }
      if (kind === 'bench') sk.line([X0 + 0.6, cy], [X1 - 0.6, cy], { wobble: 0.04 });
      break;
    }
    case 'counter': {
      sk.pen('furn'); sk.rect(X0, Y0, X1, Y1, o);
      break;
    }
    case 'cooktop': {
      sk.pen('furn');
      const r = Math.min(w, h) * 0.2;
      sk.circle(X0 + w * 0.27, Y0 + h * 0.3, r); sk.circle(X0 + w * 0.73, Y0 + h * 0.3, r * 0.85);
      sk.circle(X0 + w * 0.27, Y0 + h * 0.72, r * 0.85); sk.circle(X0 + w * 0.73, Y0 + h * 0.72, r);
      break;
    }
    case 'island': {
      sk.pen('furn'); sk.rect(X0, Y0, X1, Y1, { ...o, over: 0.8 });
      if (it.overhang) {
        const ov = it.overhang[2] * S;
        sk.pen('faint'); sk.dashed([X0, Y0 + ov], [X1, Y0 + ov], { dash: 0.9, gap: 0.7 });
      }
      break;
    }
    case 'sink': sk.pen('furn'); sk.rrect(X0, Y0, X1, Y1, 1.2); sk.circle(cx, cy, 0.35); break;
    case 'stool': case 'stable': case 'pouf': sk.pen('furn'); sk.circle(cx, cy, Math.min(w, h) / 2); break;
    case 'firebowl': sk.pen('furn'); sk.circle(cx, cy, Math.min(w, h) / 2); sk.circle(cx, cy, Math.min(w, h) * 0.3); break;
    case 'table': sk.pen('furn'); sk.rect(X0, Y0, X1, Y1, { ...o, over: 0.6 }); break;
    case 'chair': {
      sk.pen('furn'); sk.rrect(X0, Y0, X1, Y1, 0.8);
      const [p, q] = backSide(pr, dir);
      const k = 0.18;
      sk.line([p[0] + (q[0] - p[0]) * 0.1 + dir[0] * k * w, p[1] + (q[1] - p[1]) * 0.1 + dir[1] * k * h], [q[0] - (q[0] - p[0]) * 0.1 + dir[0] * k * w, q[1] - (q[1] - p[1]) * 0.1 + dir[1] * k * h], { wobble: 0.03 });
      break;
    }
    case 'armchair': case 'sofa': case 'lounger': {
      sk.pen('furn');
      sk.rrect(X0, Y0, X1, Y1, kind === 'lounger' ? 1.2 : 1.6);
      if (kind === 'lounger') {
        // backrest at the head (opposite the facing direction)
        const L = dir[1] !== 0 ? h : w;
        if (dir[1] > 0) sk.line([X0 + 0.5, Y0 + L * 0.3], [X1 - 0.5, Y0 + L * 0.3], o);
        else if (dir[1] < 0) sk.line([X0 + 0.5, Y1 - L * 0.3], [X1 - 0.5, Y1 - L * 0.3], o);
        break;
      }
      const bd = kind === 'sofa' ? 0.22 : 0.2;
      const d = dir[0] !== 0 && dir[1] !== 0 ? [0, dir[1]] : dir;
      // back cushion line
      if (d[1] > 0) sk.rrect(X0 + 0.6, Y0 + 0.6, X1 - 0.6, Y0 + h * bd + 0.6, 0.8);
      else if (d[1] < 0) sk.rrect(X0 + 0.6, Y1 - h * bd - 0.6, X1 - 0.6, Y1 - 0.6, 0.8);
      else if (d[0] > 0) sk.rrect(X0 + 0.6, Y0 + 0.6, X0 + w * bd + 0.6, Y1 - 0.6, 0.8);
      else sk.rrect(X1 - w * bd - 0.6, Y0 + 0.6, X1 - 0.6, Y1 - 0.6, 0.8);
      if (kind === 'sofa') {
        const n = 3;
        for (let i = 1; i < n; i++) {
          if (d[1] !== 0) sk.line([X0 + (w * i) / n, d[1] > 0 ? Y0 + h * bd + 0.8 : Y0 + 0.8], [X0 + (w * i) / n, d[1] > 0 ? Y1 - 0.8 : Y1 - h * bd - 0.8], { wobble: 0.03 });
        }
      }
      break;
    }
    case 'ctable': sk.pen('furn'); sk.rrect(X0, Y0, X1, Y1, 0.8); break;
    case 'rug': {
      sk.pen('faint'); sk.rect(X0, Y0, X1, Y1, { wobble: 0.12, over: 0 });
      sk.rect(X0 + 0.9, Y0 + 0.9, X1 - 0.9, Y1 - 0.9, { wobble: 0.1, over: 0 });
      break;
    }
    case 'wardrobe': {
      sk.pen('furn'); sk.rect(X0, Y0, X1, Y1, o);
      // hanging rail + hangers
      const along = w > h;
      sk.pen('faint');
      if (along) {
        sk.dashed([X0 + 0.8, cy], [X1 - 0.8, cy], { dash: 1.4, gap: 0.6 });
        for (let x = X0 + 1.5; x < X1 - 1; x += 1.6) sk.line([x - 0.5, cy - 2.2], [x + 0.5, cy + 2.2], { wobble: 0.02 });
      } else {
        sk.dashed([cx, Y0 + 0.8], [cx, Y1 - 0.8], { dash: 1.4, gap: 0.6 });
        for (let y = Y0 + 1.5; y < Y1 - 1; y += 1.6) sk.line([cx - 2.2, y - 0.5], [cx + 2.2, y + 0.5], { wobble: 0.02 });
      }
      if (!it.open) {
        sk.pen('furn');
        const n = Math.max(1, Math.round(Math.max(w, h) / 6));
        for (let i = 1; i < n; i++) {
          if (along) sk.line([X0 + (w * i) / n, dir[1] < 0 ? Y1 - 0.8 : Y0 + 0.8], [X0 + (w * i) / n, dir[1] < 0 ? Y1 : Y0], { wobble: 0.02 });
        }
      }
      break;
    }
    case 'wc': {
      sk.pen('furn');
      // cistern against the wall (back), bowl towards dir
      const d = dir;
      if (d[0] !== 0) {
        const cw = w * 0.28;
        const bx0 = d[0] < 0 ? X1 - cw : X0;
        sk.rect(bx0, Y0, bx0 + cw, Y1, { wobble: 0.04, over: 0.2 });
        const ex = d[0] < 0 ? X0 + (w - cw) / 2 : X0 + cw + (w - cw) / 2;
        sk.ellipse(ex, cy, (w - cw) / 2 + 0.2, h * 0.42);
      } else {
        const ch = h * 0.28;
        const by0 = d[1] < 0 ? Y1 - ch : Y0;
        sk.rect(X0, by0, X1, by0 + ch, { wobble: 0.04, over: 0.2 });
        const ey = d[1] < 0 ? Y0 + (h - ch) / 2 : Y0 + ch + (h - ch) / 2;
        sk.ellipse(cx, ey, w * 0.42, (h - ch) / 2 + 0.2);
      }
      break;
    }
    case 'basin': sk.pen('furn'); sk.rrect(X0, Y0, X1, Y1, 0.8); sk.ellipse(cx, cy, w * 0.32, h * 0.3); break;
    case 'vanity': {
      sk.pen('furn'); sk.rect(X0, Y0, X1, Y1, o);
      const n = it.basins || 1;
      for (let i = 0; i < n; i++) {
        if (w > h) sk.ellipse(X0 + (w * (i + 0.5)) / n, cy, Math.min(w / n, 6) * 0.32, h * 0.3);
        else sk.ellipse(cx, Y0 + (h * (i + 0.5)) / n, w * 0.3, Math.min(h / n, 6) * 0.32);
      }
      break;
    }
    case 'shower': {
      sk.pen('furn'); sk.rect(X0, Y0, X1, Y1, { wobble: 0.05, over: 0 });
      sk.pen('faint');
      if (it.walkin) {
        // linear drain along the back wall + floor fall hatching
        sk.line([X0 + 1.5, Y0 + 1.2], [X1 - 1.5, Y0 + 1.2], { wobble: 0.02 });
        sk.line([X0 + 1.5, Y0 + 1.7], [X1 - 1.5, Y0 + 1.7], { wobble: 0.02 });
      } else {
        sk.line([X0 + 0.6, Y0 + 0.6], [X1 - 0.6, Y1 - 0.6], { wobble: 0.03 });
        sk.line([X1 - 0.6, Y0 + 0.6], [X0 + 0.6, Y1 - 0.6], { wobble: 0.03 });
      }
      break;
    }
    case 'bed': {
      sk.pen('furn'); sk.rect(X0, Y0, X1, Y1, { ...o, over: 0.5 });
      // head on the side opposite to dir
      const d = dir;
      if (d[1] !== 0) {
        const head = d[1] > 0 ? Y0 : Y1, s = d[1] > 0 ? 1 : -1;
        sk.line([X0, head + s * 1.0], [X1, head + s * 1.0], { wobble: 0.03 });
        const pw = (w - 1.6) / 2;
        sk.rrect(X0 + 0.6, Math.min(head + s * 1.6, head + s * 4.6), X0 + 0.6 + pw, Math.max(head + s * 1.6, head + s * 4.6), 1.1);
        sk.rrect(X1 - 0.6 - pw, Math.min(head + s * 1.6, head + s * 4.6), X1 - 0.6, Math.max(head + s * 1.6, head + s * 4.6), 1.1);
        const fold = head + s * h * 0.42;
        sk.line([X0, fold], [X1, fold], { wobble: 0.05 });
        sk.line([X0, fold], [X0 + w * 0.12, fold + s * h * 0.12], { wobble: 0.03 });
      } else {
        const head = d[0] > 0 ? X0 : X1, s = d[0] > 0 ? 1 : -1;
        sk.line([head + s * 1.0, Y0], [head + s * 1.0, Y1], { wobble: 0.03 });
        sk.rrect(Math.min(head + s * 1.6, head + s * 4.6), Y0 + 0.8, Math.max(head + s * 1.6, head + s * 4.6), Y1 - 0.8, 1.1);
        const fold = head + s * w * 0.42;
        sk.line([fold, Y0], [fold, Y1], { wobble: 0.05 });
        sk.line([fold, Y1], [fold + s * w * 0.12, Y1 - h * 0.15], { wobble: 0.03 });
      }
      break;
    }
    default: sk.pen('furn'); sk.rect(X0, Y0, X1, Y1, o);
  }
}

export function drawGlass(sk, lines, T) {
  sk.pen('thin');
  for (const [x0, y0, x1, y1] of lines) {
    const a = T.p(x0, y0), b = T.p(x1, y1);
    sk.line2(a, b, { wobble: 0.02, lift: 0.04 });
  }
}

export { inset };
