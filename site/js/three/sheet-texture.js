// Render the pencil sheet (or a crop of it) into a canvas for the 3D "drawing" surfaces.
import { renderSheet, SHEET, PLAN_T } from '../sketch.js';

// Plan-space rectangle covered by the whole sheet.
export const SHEET_BOX = [(0 - PLAN_T.ox) / PLAN_T.S, (PLAN_T.oy - SHEET.h) / PLAN_T.S, (SHEET.w - PLAN_T.ox) / PLAN_T.S, PLAN_T.oy / PLAN_T.S];
// Sharper crop around the house, terrace and pool (floors seen up close).
export const DETAIL_BOX = [-2.0, -2.0, 29.0, 21.0];

export function sheetSVG(units, box = null, px = null, { withPaper = true } = {}) {
  const svg = renderSheet({ units, sheet: false, withPaper });
  const S = PLAN_T.S;
  const vb = box ? [PLAN_T.ox + box[0] * S, PLAN_T.oy - box[3] * S, (box[2] - box[0]) * S, (box[3] - box[1]) * S] : [0, 0, SHEET.w, SHEET.h];
  const w = px || SHEET.w, h = px ? Math.round((px * vb[3]) / vb[2]) : SHEET.h;
  const attrs = px ? `width="${w}" height="${h}"` : '';
  return { svg: svg.replace(/viewBox="[^"]*" width="[^"]*" height="[^"]*"/, `viewBox="${vb.join(' ')}" ${attrs} preserveAspectRatio="xMidYMid meet"`), w, h };
}

export async function sheetCanvas(units, { px, box = null }) {
  const { svg, w, h } = sheetSVG(units, box, px);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f2eee5';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}
