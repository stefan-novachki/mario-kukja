// Hidden comparison mode: index.html?compare=1  (add &tier=light for the phone version, &tex=jpg
// for JPEG / PNG textures instead of KTX2). Open it on any device; it shows its own numbers.
//
// 1. Light: GPU time per frame at three stops with the baked light, with a live sun + sky +
//    shadow map, and with the 59 lamps live as well (WebGL2 timer query; where the GPU has no
//    timer, e.g. most phones, render + readPixels wall time, which includes the CPU side).
// 2. Textures: what was downloaded (Resource Timing) and what sits in GPU memory (counted from
//    the formats actually uploaded: KTX2 → BC7 / ASTC / ETC blocks, JPEG / PNG → RGBA8 + mipmaps).
// Each run is kept in sessionStorage, so after the KTX2 and the JPEG runs both show side by side.
// Also prints one line "COMPARE {...}" for tools/measure.mjs.
import { textureBytes, useKtx2 } from '../three/ktx2.js';
import { SK } from '../three/sketch-shader.js';

const STOPS = ['ldk', 'terrace', 'master'];
const MODES = [['baked', 'Baked light'], ['live', 'Live sun + shadows'], ['lamps', 'Live + 59 lamps']];

async function gpuTimes(view, frames) {
  const gl = view.renderer.getContext();
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const px = new Uint8Array(4), out = [], pending = [];
  const tick = () => new Promise((r) => requestAnimationFrame(() => r()));
  for (let i = 0; i < frames; i++) {
    let q = null;
    const t0 = performance.now();
    if (ext) { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); }
    view.render();
    if (ext) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push({ q, i }); }
    else { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); if (i >= 15) out.push(performance.now() - t0); }
    await tick();
    for (let k = pending.length - 1; k >= 0; k--) {
      const { q: pq, i: pi } = pending[k];
      if (gl.getQueryParameter(pq, gl.QUERY_RESULT_AVAILABLE)) {
        if (pi >= 15 && !gl.getParameter(ext.GPU_DISJOINT_EXT)) out.push(gl.getQueryParameter(pq, gl.QUERY_RESULT) / 1e6);
        gl.deleteQuery(pq);
        pending.splice(k, 1);
      }
    }
  }
  const s = [...out].sort((a, b) => a - b);
  return { ms: s.length ? Math.round(s[s.length >> 1] * 100) / 100 : null, method: ext ? 'timer' : 'readPixels', n: s.length };
}

function downloads() {
  const sum = {}, files = {};
  for (const e of performance.getEntriesByType('resource')) {
    const p = new URL(e.name).pathname;
    const k = /\/textures\//.test(p) ? 'textures' : /\/lightmaps\//.test(p) ? 'lightmaps' : /\/models\/|\/compare\/models\//.test(p) ? 'models'
      : /\/vendor\//.test(p) ? 'three.js' : /\.(js|css|html|json)$/.test(p) ? 'site code' : 'other';
    sum[k] = (sum[k] || 0) + (e.encodedBodySize || e.transferSize || 0);
    files[k] = (files[k] || 0) + 1;
  }
  return { mb: Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, Math.round(v / 1e4) / 100])), files };
}

function gpuMemory(view) {
  const seen = new Map();
  const add = (t) => { if (t && t.isTexture && !t.isRenderTargetTexture) seen.set(t.source.uuid, t); };
  view.scene.traverse((o) => {
    for (const m of [].concat(o.material || [])) for (const v of Object.values(m)) add(v);
  });
  for (const u of Object.values(SK)) if (u && u.value && u.value.isTexture) add(u.value);
  const by = {}, fmt = {};
  for (const t of seen.values()) {
    const src = t.userData.src || '';
    const k = src.startsWith('textures/') ? 'textures' : src.startsWith('lightmaps/') ? 'lightmaps' : /models\//.test(src) ? 'models' : 'drawing, art, sky';
    by[k] = (by[k] || 0) + textureBytes(t);
    const f = t.isCompressedTexture ? `compressed ${t.format}` : 'RGBA8';
    fmt[f] = (fmt[f] || 0) + 1;
  }
  return { mb: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, Math.round(v / 1e4) / 100])), count: seen.size, formats: fmt };
}

function gpuName(gl) {
  const e = gl.getExtension('WEBGL_debug_renderer_info');
  return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
}

export async function runCompare({ view, tour, tier, frames = 120, panel }) {
  const gl = view.renderer.getContext();
  const say = (t) => { if (panel) panel.querySelector('.st').textContent = t; };
  const light = {};
  for (const stop of STOPS) {
    tour.jump(tour.stopAt(stop));
    tour.frame(0.016, innerWidth / innerHeight);
    tour.frame(0.016, innerWidth / innerHeight);
    light[stop] = {};
    for (const [mode, label] of MODES) {
      say(`${label} · ${stop} …`);
      view.setLight(mode);
      light[stop][mode] = await gpuTimes(view, frames);
    }
    view.setLight('baked');
  }
  const r = {
    tier, tex: useKtx2 ? 'KTX2' : 'JPEG/PNG', gpu: gpuName(gl), canvas: [gl.drawingBufferWidth, gl.drawingBufferHeight],
    shadowMap: view.sun.shadow.mapSize.x, light, download: downloads(), memory: gpuMemory(view), when: new Date().toISOString(),
  };
  try { sessionStorage.setItem(`compare|${tier}|${r.tex}`, JSON.stringify(r)); } catch { /* private mode */ }
  console.log('COMPARE ' + JSON.stringify(r));
  if (panel) show(panel, r);
  return r;
}

const f2 = (v) => (v == null ? '–' : v.toFixed(2));
function show(panel, r) {
  let other = null;
  try { other = JSON.parse(sessionStorage.getItem(`compare|${r.tier}|${r.tex === 'KTX2' ? 'JPEG/PNG' : 'KTX2'}`)); } catch { /* none */ }
  const [k, j] = r.tex === 'KTX2' ? [r, other] : [other, r];
  const rows = (pick) => ['textures', 'lightmaps', 'models'].map((c) => `<tr><td>${c}</td><td>${f2(j && pick(j)[c])}</td><td>${f2(k && pick(k)[c])}</td></tr>`).join('');
  const tot = (x, pick) => (x ? f2(['textures', 'lightmaps', 'models'].reduce((a, c) => a + (pick(x)[c] || 0), 0)) : '–');
  const method = r.light[STOPS[0]].baked.method === 'timer' ? 'GPU timer query' : 'render + readPixels (no GPU timer here)';
  const flip = new URLSearchParams(location.search);
  if (r.tex === 'KTX2') flip.set('tex', 'jpg'); else flip.delete('tex');
  panel.innerHTML = `
    <b>Comparison · ${r.tier} version</b><span class="st"></span>
    <p>${r.gpu}<br>${r.canvas.join(' × ')} px · shadow map ${r.shadowMap}²</p>
    <table><tr><th>GPU ms / frame</th>${MODES.map(([, l]) => `<th>${l}</th>`).join('')}</tr>
      ${STOPS.map((s) => `<tr><td>${s}</td>${MODES.map(([m]) => `<td>${f2(r.light[s][m].ms)}</td>`).join('')}</tr>`).join('')}</table>
    <p class="note">${method}, median of ${r.light[STOPS[0]].baked.n} frames</p>
    <table><tr><th>Download MB</th><th>JPEG / PNG</th><th>KTX2</th></tr>${rows((x) => x.download.mb)}
      <tr class="t"><td>total</td><td>${tot(j, (x) => x.download.mb)}</td><td>${tot(k, (x) => x.download.mb)}</td></tr></table>
    <table><tr><th>GPU memory MB</th><th>JPEG / PNG</th><th>KTX2</th></tr>${rows((x) => x.memory.mb)}
      <tr class="t"><td>total</td><td>${tot(j, (x) => x.memory.mb)}</td><td>${tot(k, (x) => x.memory.mb)}</td></tr></table>
    <p><a href="?${flip}">${other ? 'Run again' : 'Now run'} with ${r.tex === 'KTX2' ? 'JPEG / PNG' : 'KTX2'} textures →</a></p>`;
}

export function comparePanel() {
  const el = document.createElement('div');
  el.id = 'compare';
  el.innerHTML = '<b>Comparison</b><span class="st">loading every room …</span>';
  const css = document.createElement('style');
  css.textContent = `#compare{position:fixed;left:12px;bottom:12px;z-index:50;max-width:min(560px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;
    background:rgba(250,248,244,.96);color:#222;font:12px/1.4 system-ui,sans-serif;padding:12px 14px;border-radius:8px;box-shadow:0 4px 18px rgba(0,0,0,.18)}
    #compare b{display:block;font-size:13px;margin-bottom:4px}#compare .st{color:#8a6d3b}#compare p{margin:6px 0}#compare .note{color:#777}
    #compare table{border-collapse:collapse;margin:8px 0;width:100%}#compare td,#compare th{padding:2px 6px;text-align:right;border-bottom:1px solid #e4dfd6}
    #compare td:first-child,#compare th:first-child{text-align:left}#compare tr.t td{font-weight:600}#compare a{color:#5b4a2a}`;
  document.head.append(css);
  document.body.append(el);
  return el;
}
