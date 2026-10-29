// Room cards. Closed: the room name in pencil lettering and a small "+". Open: the interior
// designer's notes — style, materials (real samples), light, key pieces, size and area.
import { ROOMS, roomArea } from '../plan-data.js';
import { textStrokes } from '../lettering.js';
import { size, area } from '../units.js';
import { PALETTE } from '../three/palette.js';
import { STOPS } from './path.js';
import { NOTES, noteText } from './notes.js';
import { scheduleRows } from '../sketch.js';

export const SWATCH_NAMES = {
  oak: 'Light oak', oakFloor: 'Light oak', walnut: 'Smoked walnut', smokedOak: 'Smoked oak', travertine: 'Travertine', paving: 'Travertine paving',
  marble: 'White quartz', plaster: 'Lime plaster', render: 'White render', frame: 'Black steel', linen: 'Linen', rug: 'Wool',
  cedar: 'Timber cladding', metal: 'Standing-seam metal', anthracite: 'Anthracite render', navy: 'Navy wool', pavers: 'Pale concrete paving',
  cedarBeam: 'Cedar pergola', lawn: 'Lawn', showerTile: 'Grey porcelain', paintBlack: 'Black paint', lacquer: 'White lacquer',
};

export function lettering(str, size = 20) {
  const { lines, width } = textStrokes(str.toUpperCase(), 0, size, size, { tracking: 1.15, slant: 0.06 });
  const d = lines.map((l) => 'M' + l.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join('L')).join('');
  const pad = size * 0.2;
  return `<svg viewBox="${-pad} ${-pad} ${width + 2 * pad} ${size * 1.25 + 2 * pad}" width="${width + 2 * pad}" height="${size * 1.25 + 2 * pad}" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="${(size * 0.075).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

const roomById = (id) => ROOMS.find((r) => r.id === id);
const W = (r) => r[2] - r[0], D = (r) => r[3] - r[1];

function facts(stop, units) {
  const out = [];
  const room = stop.room && roomById(stop.room);
  if (stop.size) out.push([stop.size.label, size(stop.size.wd[0], stop.size.wd[1], units)]);
  else if (room) { const r = room.rects[0]; out.push(['Size', size(W(r), D(r), units)]); }
  if (room) out.push(['Area', area(roomArea(room), units)]);
  if (stop.area?.wd) out.push([stop.area.label, size(stop.area.wd[0], stop.area.wd[1], units)]);
  else if (stop.area) {
    const ids = stop.area.rooms === 'living' ? ROOMS.filter((r) => r.id !== 'garage').map((r) => r.id) : stop.area.rooms;
    out.push([stop.area.label, area(ids.reduce((s, id) => s + roomArea(roomById(id)), 0), units)]);
  }
  return out;
}

// the house card carries the area summary that used to sit beside the plan
function houseAreas(units) {
  const s = scheduleRows();
  const g = s.rows.find((r) => r.id === 'garage');
  return [['Garage', area(g.area, units)], ['Terrace', area(s.terrace, units)], ['Pergola', area(s.pergola, units)]];
}

export function cardHTML(id, units) {
  const stop = STOPS[id], n = NOTES[id];
  const rows = [...facts(stop, units), ...(id === 'front' ? houseAreas(units) : [])].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  const chip = (m) => `--c:${PALETTE[m].color}${PALETTE[m].tex ? `;background-image:url(textures/swatches/${m}.jpg)` : ''}`;
  const sw = stop.swatches.map((m) => `<li><span class="chip" style="${chip(m)}"></span>${SWATCH_NAMES[m] || m}</li>`).join('');
  const t = (s) => noteText(s, units);
  return `<div class="card-head"><h2 class="card-title" aria-label="${stop.name}">${lettering(stop.name, 17)}</h2>`
    + `<button type="button" class="card-more" aria-expanded="false" aria-controls="card-notes" aria-label="Designer's notes for the ${stop.name.toLowerCase()}"><span aria-hidden="true"></span></button></div>`
    + `<div class="card-notes" id="card-notes" hidden>`          // pages: stacked on a desktop, swiped on a phone
    + `<div class="page"><dl class="card-facts">${rows}</dl><p class="note"><b>Style</b>${t(n.style)}</p></div>`
    + `<div class="page note"><b>Materials</b><ul class="card-swatches">${sw}</ul></div>`
    + `<div class="page"><p class="note"><b>Light</b>${t(n.light)}</p></div>`
    + `<div class="page"><p class="note"><b>Key pieces</b>${t(n.pieces)}</p></div>`
    + `</div>`
    + `<div class="card-dots" aria-hidden="true">${['Size and style', 'Materials', 'Light', 'Key pieces'].map((l, i) => `<button type="button" tabindex="-1" title="${l}"${i ? '' : ' class="on"'}></button>`).join('')}</div>`;
}
