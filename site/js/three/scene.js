// three.js scene: the house from the plan data, pencil lines, sky, sun, doors.
import * as THREE from 'three';
import { buildWorld } from '../world/build-world.js';
import { material } from './materials.js';
import { SK, lineMaterial, skyMaterial, disp } from './sketch-shader.js';
import { Z } from '../world/zones.js';
import { LAMPS, kelvinRGB } from '../world/lighting.js';
import { openBakedDecor } from './decor.js';
import { loadTexture } from './ktx2.js';
import { makeFire } from './fire.js';
import { SITE } from '../plan-data.js';
import { CLOSED_DOORS } from '../world/build-arch.js';

const NO_CAST = new Set(['lawn', 'paving', 'gravel', 'asphalt', 'concrete', 'water', 'glass', 'rug', 'poolTile']);
const RISE = { arch: 'uRiseA', items: 'uRiseF', site: 'uRiseF', top: 'uRiseA', decor: 'uRiseF' };

export const P2W = (x, y, z = 0) => new THREE.Vector3(x, z, -y);

function geometryOf(m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2));
  g.setAttribute('aInfo', new THREE.BufferAttribute(m.info, 2));
  if (m.item) g.setAttribute('aItem', new THREE.BufferAttribute(m.item, 1));
  // lightmap uv + atlas (0 architecture, 1 furniture, 2 garden; -1 = not baked)
  const n = m.position.length / 3, lm = new Float32Array(n * 3);
  const atlas = { arch: 0, top: 0, items: 1, site: 2 }[m.group] ?? -1;
  for (let i = 0; i < n; i++) {
    const u = m.uv2 ? m.uv2[i * 2] : -1, v = m.uv2 ? m.uv2[i * 2 + 1] : -1;
    lm[i * 3] = u; lm[i * 3 + 1] = v; lm[i * 3 + 2] = u >= 0 ? atlas : -1;
  }
  g.setAttribute('aLm', new THREE.BufferAttribute(lm, 3));
  return g;
}

function linesOf(l, riseKey, opts) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(l.position, 3));
  g.setAttribute('aZones', new THREE.BufferAttribute(l.zones, 2));
  g.setAttribute('aSeed', new THREE.BufferAttribute(l.seed, 2));
  const ls = new THREE.LineSegments(g, lineMaterial(riseKey, opts));
  ls.frustumCulled = false;
  ls.renderOrder = 2;
  return ls;
}

export function createScene(canvas, tier) {
  const light = tier === 'light';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !light, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, light ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 1500);
  camera.rotation.order = 'YXZ';

  // ---- the house
  const world = buildWorld();
  const groups = {};
  for (const name of ['arch', 'items', 'site', 'top', 'decor']) { groups[name] = new THREE.Group(); groups[name].name = name; scene.add(groups[name]); }
  for (const m of world.meshes) {
    const mesh = new THREE.Mesh(geometryOf(m), material(m.mat));
    mesh.userData = { mat: m.mat, group: m.group };
    mesh.castShadow = !NO_CAST.has(m.mat);
    mesh.receiveShadow = m.mat !== 'glass';
    if (m.mat === 'glass' || m.mat === 'water') mesh.renderOrder = 3;
    groups[m.group].add(mesh);
  }
  for (const [g, l] of Object.entries(world.lines)) groups[g].add(linesOf(l, RISE[g], { cut: g === 'top' }));

  // ---- doors turn around their hinge
  const doors = {};
  for (const d of world.doors) {
    const pivot = new THREE.Group();
    pivot.position.copy(P2W(d.hinge[0], d.hinge[1], 0));
    for (const m of d.geo.meshes) {
      const mesh = new THREE.Mesh(geometryOf(m), material(m.mat));
      mesh.userData = { mat: m.mat, group: 'arch', door: d.id };
      mesh.castShadow = true; mesh.receiveShadow = true;
      pivot.add(mesh);
    }
    for (const l of Object.values(d.geo.lines)) pivot.add(linesOf(l, 'uRiseA'));
    groups.arch.add(pivot);
    const set = (t) => { pivot.rotation.y = d.closedAngle + d.turn * (Math.PI / 2) * t; };
    doors[d.id] = { ...d, pivot, set };
    set(CLOSED_DOORS.includes(d.id) ? 0 : 1);
  }

  // ---- fire in the fire bowl (live, not baked)
  const fireIt = SITE.outdoor.find((o) => o.kind === 'firebowl');
  const fire = fireIt ? makeFire(P2W((fireIt.r[0] + fireIt.r[2]) / 2, (fireIt.r[1] + fireIt.r[3]) / 2, 0.32), Z.garden) : null;
  if (fire) groups.site.add(fire.mesh);

  // ---- sky, sun, ambient
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), skyMaterial(Z.sky));
  sky.frustumCulled = false; sky.renderOrder = -10;
  scene.add(sky);

  const sunPlan = new THREE.Vector2(-1.0, -0.12).normalize();    // low evening sun from the west, along the drive
  const elev = THREE.MathUtils.degToRad(13);
  const sunDir = new THREE.Vector3(sunPlan.x * Math.cos(elev), Math.sin(elev), -sunPlan.y * Math.cos(elev)).normalize();
  sky.material.uniforms.uSunDir.value.copy(sunDir);
  SK.uSunW.value.copy(sunDir);

  const hemi = new THREE.HemisphereLight('#dfe5ec', '#d9d2c6', 2.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffc792', 3.4);
  const target = P2W(3.0, 9.0, 0);
  sun.target.position.copy(target);
  sun.position.copy(target).addScaledVector(sunDir, 80);
  sun.castShadow = true;
  const sz = light ? 1024 : 4096;
  sun.shadow.mapSize.set(sz, sz);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 20, far: 160 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target);

  // reflections: the real sky, rendered once into an environment map
  const pmrem = new THREE.PMREMGenerator(renderer);
  function bakeEnvironment() {
    const keep = SK.uReal.value[Z.sky];
    SK.uReal.value[Z.sky] = 1;
    const envScene = new THREE.Scene();
    const s2 = new THREE.Mesh(sky.geometry, sky.material);
    envScene.add(s2);
    const rt = pmrem.fromScene(envScene, 0.02);
    SK.uReal.value[Z.sky] = keep;
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.55;
  }
  bakeEnvironment();

  // ---- dusk: the sun sets, the sky deepens
  const golden = { sun: new THREE.Color('#ffc792'), hemiSky: new THREE.Color('#dfe5ec'), hemiGround: new THREE.Color('#d9d2c6') };
  const dusk = { sun: new THREE.Color('#ff9466'), hemiSky: new THREE.Color('#7d8aa8'), hemiGround: new THREE.Color('#6b5a50') };
  const skyGold = { z: disp('#6c8db6'), h: disp('#f4cf9f') }, skyDusk = { z: disp('#3d4a6e'), h: disp('#e2a07c') };
  let duskExposure = 1, stopExposure = 1;
  function setExposure(v) { stopExposure = v; renderer.toneMappingExposure = duskExposure * stopExposure; }
  function setDusk(t) {
    sun.color.copy(golden.sun).lerp(dusk.sun, t);
    sun.intensity = THREE.MathUtils.lerp(3.4, 0.7, t);
    hemi.color.copy(golden.hemiSky).lerp(dusk.hemiSky, t);
    hemi.groundColor.copy(golden.hemiGround).lerp(dusk.hemiGround, t);
    hemi.intensity = THREE.MathUtils.lerp(2.0, 1.15, t);
    const u = sky.material.uniforms;
    u.uZenith.value.copy(skyGold.z).lerp(skyDusk.z, t);
    u.uHorizon.value.copy(skyGold.h).lerp(skyDusk.h, t);
    u.uDusk.value = t;
    SK.uFogColor.value.copy(disp('#e9d3b6')).lerp(disp('#c99a82'), t);
    // baked light: the sun fades into blue dusk, the lamps come up
    SK.uDay.value = THREE.MathUtils.lerp(1.0, 0.16, t);
    SK.uDayTint.value.setRGB(THREE.MathUtils.lerp(1, 0.55, t), THREE.MathUtils.lerp(1, 0.68, t), THREE.MathUtils.lerp(1, 1.0, t));
    SK.uLamp.value = THREE.MathUtils.lerp(0.55, 1.4, t);
    SK.uLampOut.value = THREE.MathUtils.smoothstep(t, 0.25, 0.9) * 1.6;
    material('glow').emissiveIntensity = THREE.MathUtils.lerp(1.2, 2.6, t);
    material('glowOut').emissiveIntensity = THREE.MathUtils.smoothstep(t, 0.25, 0.9) * 2.4;
    SK.uLampFront.value = THREE.MathUtils.lerp(0.9, 1.6, t);
    material('glowFront').emissiveIntensity = THREE.MathUtils.lerp(1.4, 2.4, t);
    material('shade').emissiveIntensity = THREE.MathUtils.lerp(0.2, 0.55, t);
    material('water').emissive.setRGB(0.0, 0.16, 0.2).multiplyScalar(t * 2.5);
    scene.environmentIntensity = THREE.MathUtils.lerp(0.55, 0.25, t);
    duskExposure = THREE.MathUtils.lerp(1.0, 1.3, t);
    renderer.toneMappingExposure = duskExposure * stopExposure;
  }

  let size = [1, 1], inset = { l: 0, r: 0, t: 0, b: 0 };
  function resize(w, h) {
    size = [w, h];
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  // the open room notes take a side (or a strip on a phone): the picture moves over to make room
  const PAPER = new THREE.Color('#e7e1d5');
  function setInset(i) { inset = i; }
  const viewAspect = () => Math.max(0.2, (size[0] - inset.l - inset.r) / Math.max(1, size[1] - inset.t - inset.b));

  const t0 = performance.now();
  function render() {
    sky.position.copy(camera.position);
    const t = (performance.now() - t0) / 1000;
    const w = material('water').normalMap;
    if (w && w.image && w.image.width > 1) w.offset.set(t * 0.011, t * 0.007);   // the pool surface drifts slowly
    if (fire) fire.tick(t);
    const busy = inset.l + inset.r + inset.t + inset.b > 0.5;
    if (busy) {
      renderer.setScissorTest(false);
      renderer.setClearColor(PAPER, 1);
      renderer.clear();
      const [w, h] = size;
      const x = inset.l, y = inset.b, vw = w - inset.l - inset.r, vh = h - inset.t - inset.b;
      renderer.setViewport(x, y, vw, vh);
      renderer.setScissor(x, y, vw, vh);
      renderer.setScissorTest(true);
    }
    renderer.render(scene, camera);
    if (busy) { renderer.setScissorTest(false); renderer.setViewport(0, 0, size[0], size[1]); }
  }

  // Baked light from Blender. Without it the house falls back to the realtime sun and sky.
  async function loadLightmaps(tier) {
    const suffix = tier === 'light' ? '-1k' : '';
    const load = async (name) => { const t = await loadTexture(renderer, `lightmaps/${name}${suffix}.png`); if (!t) throw new Error(`lightmaps/${name}`); return t; };
    try {
      const [a, i, s2] = await Promise.all([load('arch'), load('items'), load('site')]);
      for (const t of [a, i, s2]) {
        if (!t.isCompressedTexture) t.flipY = false;
        t.colorSpace = THREE.NoColorSpace;
        t.generateMipmaps = false;
        t.minFilter = THREE.LinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.needsUpdate = true;
      }
      SK.uLm0.value = a; SK.uLm1.value = i; SK.uLm2.value = s2;
      SK.uBaked.value = 1;
      sun.visible = false;
      hemi.visible = false;
      renderer.shadowMap.enabled = false;
      return true;
    } catch (e) {
      console.warn('no baked light, using the realtime sun', e);
      return false;
    }
  }

  // Styling and trees with light baked per vertex (models/*.glb from the Blender bake), one file
  // per room, loaded a room ahead of the camera. Without a bake the code-built styling shows.
  let baked = null;
  async function loadDecor(tier) {
    baked = await openBakedDecor(tier, renderer);
    if (!baked) return false;
    for (const o of groups.decor.children) if (o.isMesh) o.visible = false;
    for (const m of await baked.trees) { m.castShadow = true; m.receiveShadow = true; groups.site.add(m); }
    return true;
  }
  const zonesIn = new Set();
  function loadDecorZone(name) {
    if (!baked || !baked.zones.includes(name) || zonesIn.has(name)) return Promise.resolve();
    zonesIn.add(name);
    return baked.zone(name).then((ms) => { for (const m of ms) { m.castShadow = true; m.receiveShadow = true; groups.decor.add(m); } });
  }
  const decorZones = () => (baked ? baked.zones : []);

  // For the measurement only: the same lamps as live lights (what you would need without baking).
  function addLiveLamps() {
    return LAMPS.map((l) => {
      const c = kelvinRGB(l.k);
      const p = new THREE.PointLight(new THREE.Color(c[0], c[1], c[2]), l.w * 0.6, 9, 2);
      p.position.copy(P2W(l.x, l.y, l.z - 0.05));
      scene.add(p);
      return p;
    });
  }

  // comparison mode (?compare=1): 'baked' lightmaps, 'live' sun + sky + shadow map, 'lamps' = live + every lamp
  let liveLamps = null;
  function setLight(mode) {
    const live = mode !== 'baked' || SK.uLm0.value == null;
    SK.uBaked.value = live ? 0 : 1;
    sun.visible = live;
    hemi.visible = live;
    renderer.shadowMap.enabled = live;
    renderer.shadowMap.needsUpdate = true;
    if (mode === 'lamps' && !liveLamps) liveLamps = addLiveLamps();
    if (liveLamps) for (const p of liveLamps) p.visible = mode === 'lamps';
  }

  return { renderer, scene, camera, groups, doors, sky, sun, setDusk, setExposure, resize, render, setInset, viewAspect, world, loadLightmaps, loadDecor, loadDecorZone, decorZones, addLiveLamps, setLight };
}

// Turn an SVG string into a texture for the "drawing" surfaces.
export function sheetTexture(canvas, renderer) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}
