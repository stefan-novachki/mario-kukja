// Kukja Mario — scroll walkthrough. Opens on the pencil sheet; scrolling lifts the walls.
import { createScene, sheetTexture } from './three/scene.js';
import { sheetCanvas, sheetSVG, SHEET_BOX, DETAIL_BOX } from './three/sheet-texture.js';
import { SK } from './three/sketch-shader.js';
import { createTour } from './tour/tour.js';
import { cardHTML, lettering } from './tour/cards.js';
import { cardPlace } from './tour/card-places.js';
import { renderLegend, scheduleRows } from './sketch.js';
import { area } from './units.js';
import { loadTextures } from './three/textures.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
if (params.get('compare') === '1') performance.setResourceTimingBufferSize(4000);   // count every file
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

function autoTier() {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 900;
  return (coarse && small) || (navigator.deviceMemory || 8) <= 4 ? 'light' : 'desktop';
}
let units = params.get('u') || store.get('units') || 'metric';
const tier = params.get('tier') || store.get('tier') || autoTier();
const PX = 56; // scroll pixels per scroll unit (≈ per metre the camera moves)

// ---- 1. the drawing, straight away: the plan large, cropped to the house (1:100, paper mm)
const sheetEl = $('sheet'), opening = $('opening');
const CROP = [44, 76, 200, 318];               // plan x -7.4…12.6 m, y -9.6…24.6 m: street, gardens, house, garage
const sheetFrame = () => CROP;
const portrait = () => false;   // this plan is taller than wide: it stands upright on phones too (no turning)
// paper mm → screen px: large, with room for the title above and the legend below
function planScale() {
  const [, , fw, fh] = sheetFrame();
  return portrait() ? Math.min((innerWidth * 0.92) / fh, (innerHeight - 300) / fw) : Math.min((innerWidth * 0.84) / fw, (innerHeight - 230) / fh);
}
function placeSheet() {
  const [, , fw, fh] = sheetFrame(), rot = portrait();
  const k = planScale();
  opening.classList.toggle('rot', rot);
  opening.style.setProperty('--sw', `${fw * k}px`);                  // the drawing itself
  opening.style.setProperty('--sh', `${fh * k}px`);
  opening.style.setProperty('--pw', `${(rot ? fh : fw) * k}px`);     // as it stands on screen
  opening.style.setProperty('--ph', `${(rot ? fw : fh) * k}px`);
  opening.style.setProperty('--k', `${k}px`);
  opening.classList.toggle('small', k < 3);
  const svg = sheetEl.querySelector('svg');
  if (svg) { svg.setAttribute('viewBox', sheetFrame().join(' ')); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet'); }
}
function drawOverlay() {
  sheetEl.innerHTML = sheetSVG(units, null, null, { withPaper: false }).svg;
  $('olegend').innerHTML = renderLegend({ units });
  const sch = scheduleRows();
  $('osub').innerHTML = `Ground floor plan · ${area(sch.living, units)} living<span class="wide"> · garage, pergola and garden</span>`;
  placeSheet();
}
$('otitle').innerHTML = lettering('Kukja Mario', innerWidth < 640 ? 22 : 30);
drawOverlay();
$('brand').innerHTML = lettering('Kukja Mario', 15);

// ---- 2. the house in 3D
const view = createScene($('gl'), tier);
const tour = createTour(view);
if (params.get('debug') === '1' || navigator.webdriver) window.__villa = { view, tour };   // dev tools and headless checks
function resize() {
  view.resize(innerWidth, innerHeight);
  tour.layout(innerWidth, innerHeight, sheetFrame(), planScale(), portrait());
  $('track').style.height = `${Math.round(tour.total * PX + innerHeight)}px`;
  placeSheet();
}
resize();
addEventListener('resize', resize);

SK.uSheetBox.value.set(...SHEET_BOX);
SK.uDetailBox.value.set(...DETAIL_BOX);
async function loadSheets() {
  const big = tier === 'light' ? 2048 : 3072, det = tier === 'light' ? 2048 : 4096;
  const [full, detail] = await Promise.all([sheetCanvas(units, { px: big }), sheetCanvas(units, { px: det, box: DETAIL_BOX })]);
  const old = [SK.uSheet.value, SK.uDetail.value];
  SK.uSheet.value = sheetTexture(full, view.renderer);
  SK.uDetail.value = sheetTexture(detail, view.renderer);
  old.forEach((t) => t && t.dispose());
}

// ---- 3. units and quality switches
const card = $('card');
let currentStop = null;
function pressed(sel, attr, val) { document.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === val))); }
function setUnits(u) {
  units = u;
  store.set('units', u);
  pressed('.units button', 'u', u);
  drawOverlay();
  if (currentStop) renderCard();
  loadSheets();
}
document.querySelectorAll('.units button').forEach((b) => b.addEventListener('click', () => setUnits(b.dataset.u)));
pressed('.units button', 'u', units);
pressed('.tier button', 'tier', tier);
document.querySelectorAll('.tier button').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.tier === tier) return;
  store.set('tier', b.dataset.tier);
  const q = new URLSearchParams(location.search); q.delete('tier');
  location.search = q.toString();
}));

// room cards: the name and a small "+" in a corner chosen per room (never over the best view);
// "+" opens the designer's notes, and the choice stays for the next rooms
let cardOpen = params.get('card') === 'open';
function placeCard() { if (currentStop) card.dataset.at = cardPlace(currentStop, innerWidth / innerHeight); }
function renderCard() {
  card.innerHTML = cardHTML(currentStop, units);
  const btn = card.querySelector('.card-more'), notes = card.querySelector('.card-notes');
  const apply = () => { btn.setAttribute('aria-expanded', String(cardOpen)); notes.hidden = !cardOpen; card.classList.toggle('open', cardOpen); };
  btn.addEventListener('click', () => { cardOpen = !cardOpen; apply(); });
  // phone: one page at a time, the dots show which and jump on a tap
  const dots = [...card.querySelectorAll('.card-dots button')];
  const page = () => Math.round(notes.scrollLeft / Math.max(1, notes.clientWidth));
  notes.addEventListener('scroll', () => dots.forEach((d, i) => d.classList.toggle('on', i === page())), { passive: true });
  dots.forEach((d, i) => d.addEventListener('click', () => notes.scrollTo({ left: i * notes.clientWidth, behavior: 'smooth' })));
  apply();
  if (params.get('page')) requestAnimationFrame(() => { notes.scrollLeft = Number(params.get('page')) * notes.clientWidth; });   // stills: &page=1…3
  placeCard();
}
function showStop(id) {
  if (id) {
    currentStop = id;
    renderCard();
    card.hidden = false;
    requestAnimationFrame(() => card.classList.add('on'));
  } else { card.classList.remove('on'); currentStop = null; }
}
addEventListener('resize', placeCard);

// ---- 4. scroll drives the walk
addEventListener('scroll', () => { tour.target = (window.scrollY || document.documentElement.scrollTop) / PX; }, { passive: true });

// ---- 5. run
const [, baked, decor] = await Promise.all([loadSheets(), params.get('bake') === '0' ? false : view.loadLightmaps(tier), view.loadDecor(tier)]);
document.body.dataset.baked = baked ? '1' : '0';
document.body.dataset.decor = decor ? '1' : '0';

// styling per room: load a room's file about one room ahead of the camera (when the previous
// room's descent begins), so a phone never loads the whole house at once
const AHEAD = 40;                                    // scroll units: roughly one room of the tour
function zoneNeed(name) {
  const t = tour.trigOf(name);
  return Number.isFinite(t) ? t - AHEAD : 0;
}
function loadZonesUpTo(s) {
  return Promise.all(view.decorZones().filter((z) => zoneNeed(z) <= s).map((z) => view.loadDecorZone(z)));
}
// material textures stream in behind the drawing; stills and checks wait for all of them
const textures = params.get('tex') === '0' ? Promise.resolve(0) : loadTextures(view.renderer, tier);
if (params.get('at') !== null || params.get('audit') || params.get('measure')) await textures;
$('status').style.opacity = 0;

if (params.get('audit') === '1') {
  await loadZonesUpTo(Infinity);
  const { auditView, coverage } = await import('./tour/audit.js');
  const out = {};
  tour.settle(true);
  document.body.classList.add('shot');
  for (const id of ['front', 'hall', 'kid', 'master', 'ensuite', 'guest', 'ldk', 'terrace', 'end']) {
    tour.jump(id === 'end' ? tour.total : tour.stopAt(id));
    tour.frame(0.016, innerWidth / innerHeight);
    tour.frame(0.016, innerWidth / innerHeight);
    view.render();
    const a = auditView(view);
    if (id !== 'end') {
      // the room card in every corner, closed and open: how much of the photo would it hide?
      a.cards = {};
      currentStop = id;
      for (const corner of ['tl', 'tr', 'bl', 'br']) {
        a.cards[corner] = {};
        for (const open of [false, true]) {
          cardOpen = open;
          renderCard();
          card.dataset.at = corner;
          card.hidden = false;
          card.classList.add('on');
          a.cards[corner][open ? 'open' : 'closed'] = coverage(a, card.getBoundingClientRect(), innerWidth, innerHeight);
        }
      }
      a.place = cardPlace(id, innerWidth / innerHeight);
      card.hidden = true;
    }
    out[id] = a;
  }
  cardOpen = false;
  tour.settle(false);
  console.log('AUDIT ' + JSON.stringify(out));
  document.title = 'audit done';
}

const at = params.get('at');
if (at !== null) {
  document.body.classList.add('shot');
  tour.settle(params.get('settle') !== '0');
  // at=<stop> | <stop>-above (view from above) | <stop>-down (halfway down) | <zone>-in | end | <scroll units>
  const m = /^(\w+)-(in|above|down)$/.exec(at);
  const v = m ? (m[2] === 'in' ? tour.trigOf(m[1]) + 0.5 : m[2] === 'above' ? tour.aboveOf(m[1]) : tour.descentOf(m[1]))
    : at === 'end' ? tour.total : Number.isNaN(Number(at)) ? tour.stopAt(at) : Number(at);
  tour.jump(v);
  await loadZonesUpTo(v);
  if (params.get('scroll') === '1') scrollTo(0, v * PX);
  if (params.get('wave')) tour.wave(params.get('wz'), Number(params.get('wave')));
}

// dev: try a camera — &cam=x,y,lookX,lookY,lookZ[,fov] (plan metres, eye 1.6 m); &audit=here prints its framing
const cam = params.get('cam') ? params.get('cam').split(',').map(Number) : null;
function applyCam() {
  const [x, y, lx, ly, lz, fov] = cam;
  view.camera.position.set(x, 1.6, -y);
  view.camera.rotation.set(Math.atan2(lz - 1.6, Math.hypot(lx - x, ly - y)), Math.atan2(-(lx - x), ly - y), 0, 'YXZ');
  if (fov) { view.camera.fov = fov; view.camera.updateProjectionMatrix(); }
}
if (cam && params.get('audit') === 'here') {
  const { auditView } = await import('./tour/audit.js');
  tour.frame(0.016, innerWidth / innerHeight); applyCam(); view.render();
  console.log('AUDIT ' + JSON.stringify({ here: auditView(view) }));
}

if (params.get('measure') === '1') {
  const { measureFrames } = await import('./dev/measure.js');
  if (params.get('lamps') === '1') view.addLiveLamps();
  tour.frame(0.016, innerWidth / innerHeight);
  console.log('MEASURE ' + JSON.stringify({ at: params.get('at'), baked: document.body.dataset.baked === '1', ...(await measureFrames(view)) }));
  document.body.dataset.measured = '1';
}

// hidden comparison mode: baked vs live light, KTX2 vs JPEG (see js/dev/compare.js)
if (params.get('compare') === '1') {
  const { runCompare, comparePanel } = await import('./dev/compare.js');
  const panel = comparePanel();
  await Promise.all([textures, loadZonesUpTo(Infinity)]);
  document.body.classList.add('shot');
  tour.settle(true);
  await runCompare({ view, tour, tier, panel, frames: Number(params.get('frames')) || 120 });
  document.body.dataset.compared = '1';
}

let last = performance.now(), frames = 0, fpsN = 0, fpsT = 0, fps = 0;
const debug = params.get('debug') === '1';
if (debug) { $('status').style.opacity = 1; document.body.classList.remove('shot'); }
// the open notes take a side (desktop) or a strip (phone); the picture eases over to make room
const inset = { l: 0, r: 0, t: 0, b: 0 };
function insetGoal() {
  const g = { l: 0, r: 0, t: 0, b: 0 };
  if (!cardOpen || !currentStop || card.hidden || !card.classList.contains('on')) return g;
  const r = card.getBoundingClientRect(), gap = innerWidth < 640 ? 8 : 24;
  if (innerWidth < 640) { if (card.dataset.at[0] === 't') g.t = r.bottom + gap; else g.b = innerHeight - r.top + gap; }
  else if (card.dataset.at[1] === 'l') g.l = r.right + gap; else g.r = innerWidth - r.left + gap;
  return g;
}
function easeInset(dt, snap = false) {
  const g = insetGoal(), k = snap ? 1 : 1 - Math.exp(-dt * 5);
  for (const key of Object.keys(inset)) inset[key] += (g[key] - inset[key]) * k;
  view.setInset(inset);
  return view.viewAspect();
}

function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const st = tour.frame(dt, easeInset(dt, document.body.classList.contains('shot')), innerWidth / innerHeight);
  loadZonesUpTo(st.s);
  if (cam) { applyCam(); card.hidden = true; }
  opening.style.opacity = st.overlay;
  opening.style.visibility = st.overlay < 0.001 ? 'hidden' : 'visible';
  $('brand').style.opacity = 1 - st.overlay;
  $('hint').style.opacity = st.s < 0.3 ? 1 : 0;
  if (st.changed) showStop(st.stop);
  view.render();
  if (++frames === 10) document.body.dataset.ready = '1';
  if (debug) {
    fpsN++; fpsT += dt;
    if (fpsT > 0.5) { fps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; }
    const i = view.renderer.info;
    $('status').textContent = `${fps} fps · ${i.render.calls} draw calls · ${Math.round(i.render.triangles / 1000)}k triangles · ${i.memory.geometries} geometries · ${i.memory.textures} textures · s ${st.s.toFixed(1)}`;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
