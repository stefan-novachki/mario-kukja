// Framing check for every stop, like an interior photographer's checklist: the room's main
// feature and the garden view are in the picture, no large empty wall fills the frame, and the
// room card — closed or open — hides little of what matters, on a desktop and on a phone.
// node tools/audit-stops.mjs [--json]
import { withPage } from './cdp.mjs';

// minimum share of the frame (%) for the things each photo is about
const NEEDS = {
  front: { door: 1 },
  hall: { items: { dtable: 0.5 }, glass: 3 },        // the axis through to the garden
  ldk: { items: { island: 3 }, glass: 8 },
  terrace: { glass: 5 },
  kid: { items: { kbed: 5, kdesk: 1.5 }, glass: 5 },
  master: { items: { mbed: 10 }, glass: 3 },
  ensuite: { items: { eshower: 8 } },
  guest: { items: { gbed: 10 }, glass: 3 },
  end: {},
};
const INTERIOR = new Set(['hall', 'ldk', 'master', 'ensuite', 'kid', 'guest']);
const MAX_WALL_PATCH = 25;   // largest bare area of any one wall, % of the frame
const PATCH_EXCEPTION = { ensuite: 32 };  // seen through the doorway: the door surround frames the shot
const MAX_CEILING = 24;
const MAX_DOOR = 12;          // an open door leaf must not block the picture

const MAX_CARD = 3;   // % of the photo's important content the closed card may hide (the open one makes room)

async function audit(w, h) {
  const r = await withPage('index.html?audit=1', { w, h, timeout: 180000, waitFor: "document.title === 'audit done'" });
  const line = r.logs.find((l) => l.startsWith('AUDIT '));
  if (!line) { console.log('no audit output'); console.log(r.logs.slice(0, 8).join(' | ')); process.exit(1); }
  return JSON.parse(line.slice(6));
}
const res = await audit(1600, 900);
const phone = await audit(390, 844);
if (process.argv.includes('--json')) console.log(JSON.stringify(res, null, 1));
let fails = 0;
for (const [id, a] of Object.entries(res)) {
  const need = NEEDS[id] || {};
  const probs = [];
  for (const [k, min] of Object.entries(need)) {
    if (k === 'items') for (const [it, mi] of Object.entries(min)) { if ((a.items[it] || 0) < mi) probs.push(`${it} ${a.items[it] || 0}% < ${mi}%`); }
    else if ((a.share[k] || 0) < min) probs.push(`${k} ${a.share[k] || 0}% < ${min}%`);
  }
  if (INTERIOR.has(id)) {
    const maxPatch = PATCH_EXCEPTION[id] ?? MAX_WALL_PATCH;
    if (a.wallBlob > maxPatch) probs.push(`empty wall patch ${a.wallBlob}% > ${maxPatch}%`);
    if ((a.share.ceiling || 0) > MAX_CEILING) probs.push(`ceiling ${a.share.ceiling}% > ${MAX_CEILING}%`);
    if ((a.share.door || 0) > MAX_DOOR) probs.push(`door leaf ${a.share.door}% > ${MAX_DOOR}%`);
  }
  // the room card, on a desktop and on a phone
  const cardNotes = [];
  for (const [label, au] of [['desktop', a], ['phone', phone[id]]]) {
    if (!au?.cards) continue;
    const c = au.cards[au.place];
    if (c.closed > MAX_CARD) probs.push(`${label} card (${au.place}) hides ${c.closed}%`);
    cardNotes.push(`${label} card ${au.place} hides ${c.closed}%`);
  }
  if (probs.length) fails++;
  const top = Object.entries(a.items).slice(0, 4).map(([k, v]) => `${k} ${v}%`).join(', ');
  console.log(`${probs.length ? 'FAIL' : 'PASS'}  ${id.padEnd(8)} wall ${String(a.share.wall || 0).padStart(4)}% (largest patch ${a.wallBlob}%) · ceiling ${a.share.ceiling || 0}% · glass ${a.share.glass || 0}% · ${top}${cardNotes.length ? ' · ' + cardNotes.join(' · ') : ''}${probs.length ? '  ← ' + probs.join('; ') : ''}`);
}
console.log(`${Object.keys(res).length - fails}/${Object.keys(res).length} stops framed`);
