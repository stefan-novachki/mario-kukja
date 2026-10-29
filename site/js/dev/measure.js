// GPU cost of one frame, measured with WebGL2 timer queries (EXT_disjoint_timer_query_webgl2).
// index.html?measure=1&at=ldk[&bake=0] → console line "MEASURE {...}"
export async function measureFrames(view, frames = 160) {
  const gl = view.renderer.getContext();
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const pending = [], gpu = [], cpu = [];
  const raf = () => { gl.flush(); return new Promise((r) => setTimeout(r, 16)); };   // timers also run in headless Chrome
  for (let i = 0; i < frames; i++) {
    let q = null;
    if (ext) { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); }
    const t0 = performance.now();
    view.render();
    cpu.push(performance.now() - t0);
    if (ext) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push({ q, i }); }
    await raf();
    for (let k = pending.length - 1; k >= 0; k--) {
      const { q: pq, i: pi } = pending[k];
      if (gl.getQueryParameter(pq, gl.QUERY_RESULT_AVAILABLE) && !gl.getParameter(ext.GPU_DISJOINT_EXT)) {
        if (pi >= 20) gpu.push(gl.getQueryParameter(pq, gl.QUERY_RESULT) / 1e6);
        gl.deleteQuery(pq);
        pending.splice(k, 1);
      }
    }
  }
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? Math.round(b[b.length >> 1] * 100) / 100 : null; };
  const info = view.renderer.info;
  return { gpuMs: med(gpu), samples: gpu.length, cpuMs: med(cpu.slice(20)), calls: info.render.calls, triangles: info.render.triangles,
    shadowMap: view.renderer.shadowMap.enabled, size: [gl.drawingBufferWidth, gl.drawingBufferHeight], timer: !!ext };
}
