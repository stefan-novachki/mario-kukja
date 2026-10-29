// GPU-compressed textures (KTX2 / Basis Universal) with local npm packages only (ktx2-encoder is
// the Basis encoder compiled to WebAssembly; @gltf-transform rewrites the models). Nothing is
// installed on the system. Only files whose source changed are encoded again.
//
//   node tools/compress.mjs [textures] [lightmaps] [models]      (default: all three)
//
// textures   site/textures/<set>/<map>[-light].jpg|png → .ktx2 next to it
//            colour + roughness: ETC1S (≈ JPEG size, 4–8× less GPU memory)
//            relief (normal) maps: UASTC + RDO + zstd on desktop (clean under the raking sun),
//            ETC1S on phones (a fifth of the download, half the GPU memory)
// lightmaps  site/lightmaps/*.png → .ktx2, UASTC + RDO + zstd (smooth gradients, no mipmaps)
// models     site/models/*.glb (Blender export, JPEG/PNG inside) → textures inside become KTX2;
//            the originals move to site/compare/models/ for the hidden comparison mode
//
// Writes site/compressed.json: every source file, its KTX2 file, both sizes and the pixel size.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const SELF = fileURLToPath(import.meta.url);
const OPT = {
  colour: { isUASTC: false, qualityLevel: 160, compressionLevel: 2, generateMipmap: true, isSetKTX2SRGBTransferFunc: true },
  linear: { isUASTC: false, qualityLevel: 160, compressionLevel: 2, generateMipmap: true, isSetKTX2SRGBTransferFunc: false, isPerceptual: false },
  normal: { isUASTC: true, isNormalMap: true, needSupercompression: true, enableRDO: true, rdoQualityLevel: 3, generateMipmap: true, isSetKTX2SRGBTransferFunc: false },
  lightmap: { isUASTC: true, needSupercompression: true, enableRDO: true, rdoQualityLevel: 2, generateMipmap: false, isSetKTX2SRGBTransferFunc: false },
  normalSmall: { isUASTC: false, isNormalMap: true, qualityLevel: 255, compressionLevel: 2, generateMipmap: true, isSetKTX2SRGBTransferFunc: false },
};

function decode(buf) {
  buf = Buffer.from(buf);
  if (buf[0] === 0x89) { const p = PNG.sync.read(buf); return { width: p.width, height: p.height, data: new Uint8Array(p.data.buffer, p.data.byteOffset, p.data.length) }; }
  const im = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 });
  return { width: im.width, height: im.height, data: im.data };
}
const imageDecoder = async (b) => decode(b);

// ------------------------------------------------------------------ worker: one job at a time
if (!isMainThread) {
  const quiet = (fn) => async (...a) => {          // the encoder prints a line per mip level
    const log = console.log; console.log = () => {};
    try { return await fn(...a); } finally { console.log = log; }
  };
  const { encodeToKTX2 } = await import('ktx2-encoder');
  const encode = quiet(encodeToKTX2);
  parentPort.on('message', async (job) => {
    try {
      if (job.type === 'image') {
        const src = fs.readFileSync(job.src);
        const out = await encode(new Uint8Array(src), { ...OPT[job.opt], isYFlip: !!job.flip, imageDecoder });
        fs.writeFileSync(job.dst, out);
        const { width, height } = decode(src);
        parentPort.postMessage({ ok: true, job, bytes: out.byteLength, src: src.length, width, height });
      } else {
        parentPort.postMessage({ ok: true, job, ...(await quiet(model)(job)) });
      }
    } catch (e) {
      parentPort.postMessage({ ok: false, job, error: String(e && e.stack || e) });
    }
  });
}

async function model(job) {
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS, KHRDracoMeshCompression } = await import('@gltf-transform/extensions');
  const { ktx2 } = await import('ktx2-encoder/gltf-transform');
  const draco3d = (await import('draco3dgltf')).default;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule(),
  });
  const doc = await io.read(job.src);
  const images = doc.getRoot().listTextures().map((t) => {
    const s = t.getSize() || [0, 0];
    return { name: t.getName() || t.getURI(), mime: t.getMimeType(), bytes: t.getImage()?.byteLength || 0, width: s[0], height: s[1] };
  });
  await doc.transform(
    ktx2({ ...OPT.colour, imageDecoder, slots: /^(baseColorTexture|emissiveTexture)$/ }),
    ktx2({ ...OPT.normalSmall, imageDecoder, slots: /^normalTexture$/ }),
    ktx2({ ...OPT.linear, imageDecoder }),
  );
  doc.getRoot().listExtensionsUsed().find((e) => e.extensionName === KHRDracoMeshCompression.EXTENSION_NAME)
    ?.setEncoderOptions({ quantizationBits: { POSITION: 16, NORMAL: 10, COLOR: 10, TEX_COORD: 16, GENERIC: 12 } });
  fs.writeFileSync(job.dst, await io.writeBinary(doc));
  const tex = doc.getRoot().listTextures().map((t) => ({ mime: t.getMimeType(), bytes: t.getImage()?.byteLength || 0 }));
  return { bytes: fs.statSync(job.dst).size, src: fs.statSync(job.src).size, images, ktx2Bytes: tex.reduce((a, t) => a + t.bytes, 0) };
}

// ------------------------------------------------------------------ main: list the jobs, run a pool
if (isMainThread) {
  const want = process.argv.slice(2);
  const on = (k) => !want.length || want.includes(k);
  const MANI = 'site/compressed.json';
  const manifest = fs.existsSync(MANI) ? JSON.parse(fs.readFileSync(MANI, 'utf8')) : {};
  const rel = (p) => path.relative('site', p).split(path.sep).join('/');
  const newer = (a, b) => !fs.existsSync(b) || fs.statSync(a).mtimeMs > fs.statSync(b).mtimeMs;
  const jobs = [];

  if (on('textures')) {
    for (const set of fs.readdirSync('site/textures')) {
      const dir = path.join('site/textures', set);
      if (!fs.statSync(dir).isDirectory() || set === 'swatches') continue;
      for (const f of fs.readdirSync(dir)) {
        const m = f.match(/^(diff|nor|rough)(-light)?\.(jpg|png)$/);
        if (!m) continue;
        const src = path.join(dir, f), dst = src.replace(/\.(jpg|png)$/, '.ktx2');
        jobs.push({ type: 'image', src, dst, opt: m[1] === 'diff' ? 'colour' : m[1] === 'nor' ? (m[2] ? 'normalSmall' : 'normal') : 'linear', flip: true, kind: 'texture' });
      }
    }
  }
  if (on('lightmaps')) {
    for (const f of fs.readdirSync('site/lightmaps')) {
      if (!f.endsWith('.png')) continue;
      const src = path.join('site/lightmaps', f);
      jobs.push({ type: 'image', src, dst: src.replace(/\.png$/, '.ktx2'), opt: 'lightmap', flip: false, kind: 'lightmap' });
    }
  }
  if (on('models')) {
    fs.mkdirSync('site/compare/models', { recursive: true });
    for (const f of fs.readdirSync('site/models')) {
      if (!f.endsWith('.glb')) continue;
      const out = path.join('site/models', f), orig = path.join('site/compare/models', f);
      // a fresh Blender export lands in site/models: keep it as the uncompressed original
      const fresh = !manifest[rel(orig)] || manifest[rel(orig)].ktx2Mtime !== Math.round(fs.statSync(out).mtimeMs);
      if (fresh) fs.copyFileSync(out, orig);
      jobs.push({ type: 'model', src: orig, dst: out, kind: 'model', force: fresh });
    }
    for (const f of fs.readdirSync('site/compare/models')) if (!fs.existsSync(path.join('site/models', f))) fs.rmSync(path.join('site/compare/models', f));
  }

  const todo = jobs.filter((j) => j.force || newer(j.src, j.dst) || !manifest[rel(j.src)]);
  const keep = new Set(jobs.map((j) => rel(j.src)));
  for (const k of Object.keys(manifest)) if (!keep.has(k) && want.some((w) => manifest[k].kind.startsWith(w.slice(0, -1)))) delete manifest[k];
  console.log(`${jobs.length} files, ${todo.length} to encode`);
  // big jobs first so the pool finishes together
  todo.sort((a, b) => fs.statSync(b.src).size * (b.opt === 'normal' || b.opt === 'lightmap' ? 6 : 1) - fs.statSync(a.src).size * (a.opt === 'normal' || a.opt === 'lightmap' ? 6 : 1));
  const N = Math.max(1, Math.min(todo.length, Math.floor(os.cpus().length * 0.75)));
  const t0 = Date.now();
  let failed = 0, done = 0;
  await Promise.all(Array.from({ length: N }, () => new Promise((resolve) => {
    if (!todo.length) return resolve();
    const w = new Worker(SELF);
    const next = () => { const j = todo.shift(); if (j) w.postMessage(j); else w.terminate().then(resolve); };
    w.on('message', (r) => {
      done++;
      if (!r.ok) { failed++; console.log(`FAILED ${r.job.src}\n${r.error}`); return next(); }
      const e = { kind: r.job.kind, ktx2: rel(r.job.dst), bytes: r.src, ktx2Bytes: r.bytes };
      if (r.job.type === 'image') Object.assign(e, { width: r.width, height: r.height, mode: OPT[r.job.opt].isUASTC ? 'UASTC' : 'ETC1S', mips: OPT[r.job.opt].generateMipmap });
      else Object.assign(e, { images: r.images, texBytesKtx2: r.ktx2Bytes, ktx2Mtime: Math.round(fs.statSync(r.job.dst).mtimeMs) });
      manifest[rel(r.job.src)] = e;
      console.log(`${String(done).padStart(3)}  ${rel(r.job.src).padEnd(40)} ${(r.src / 1e6).toFixed(2)} MB → ${(r.bytes / 1e6).toFixed(2)} MB`);
      next();
    });
    w.on('error', (e) => { failed++; console.log('worker error', e); resolve(); });
    next();
  })));
  fs.writeFileSync(MANI, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 1));
  const sum = (kind, k) => Object.values(manifest).filter((e) => e.kind === kind).reduce((a, e) => a + e[k], 0) / 1e6;
  for (const kind of ['texture', 'lightmap', 'model']) console.log(`${kind}s: ${sum(kind, 'bytes').toFixed(2)} MB → ${sum(kind, 'ktx2Bytes').toFixed(2)} MB`);
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)} s, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
