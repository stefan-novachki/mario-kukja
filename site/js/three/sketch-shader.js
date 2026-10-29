// The "drawing until you walk in" look. Every surface knows its zone; a wave that
// starts at the doorway turns the pencil drawing into the real material.
import * as THREE from 'three';
import { NZ, Z } from '../world/zones.js';

// Display-space colour (no conversion): these are used after tone mapping.
export const disp = (hex) => new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace);

export const SK = {
  uReal: { value: new Float32Array(NZ) },
  uOrigin: { value: Array.from({ length: NZ }, () => new THREE.Vector2()) },
  uRad: { value: new Float32Array(NZ).fill(20) },
  uRiseA: { value: 1 },
  uRiseF: { value: 1 },
  uCut: { value: 0 },
  // baked light (Blender): three atlases, RGB = sqrt(day / max), A = sqrt(lamps / max)
  uBaked: { value: 0 },
  uLm0: { value: null }, uLm1: { value: null }, uLm2: { value: null },
  uLmMax: { value: 6.0 },
  uDay: { value: 1.0 },
  uDayTint: { value: new THREE.Color(1, 1, 1) },
  uLamp: { value: 0.7 },
  uLampOut: { value: 0.0 },
  uLampFront: { value: 0.9 },
  uLampColor: { value: new THREE.Color(1.0, 0.72, 0.45) },
  uSunW: { value: new THREE.Vector3(0, 0.2, -1).normalize() },   // towards the sun, world space
  uIndoor: { value: new THREE.Color(0.32, 0.3, 0.27) },
  uSheet: { value: null },
  uDetail: { value: null },
  uSheetBox: { value: new THREE.Vector4(-5.2, -15.4, 54.2, 26.6) },
  uDetailBox: { value: new THREE.Vector4(0, 0, 1, 1) },
  uPaper: { value: disp('#f2eee5') },
  uDesk: { value: disp('#e7e1d5') },
  uInk: { value: disp('#2e2c2a') },
  uDrawLight: { value: new THREE.Vector3(-0.45, 0.78, 0.43).normalize() },
  uFogColor: { value: disp('#e9d3b6') },
  uFog: { value: new THREE.Vector2(70, 260) },
};

const COMMON = /* glsl */`
#define NZ ${NZ}
uniform float uReal[NZ];
uniform vec2 uOrigin[NZ];
uniform float uRad[NZ];
uniform sampler2D uSheet;
uniform sampler2D uDetail;
uniform vec4 uSheetBox;
uniform vec4 uDetailBox;
uniform vec3 uPaper;
uniform vec3 uDesk;
uniform vec3 uInk;
uniform vec3 uDrawLight;
uniform vec3 uFogColor;
uniform vec2 uFog;

float skHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float skNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(skHash(i), skHash(i + vec2(1.0, 0.0)), u.x), mix(skHash(i + vec2(0.0, 1.0)), skHash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// 1 = still a drawing, 0 = real. The wave grows from the doorway with a ragged pencil edge.
float sketchMask(vec3 wp, float zone) {
  int zi = int(zone + 0.5);
  float r = uReal[zi];
  if (r <= 0.0) return 1.0;
  if (r >= 1.0) return 0.0;
  vec2 pp = vec2(wp.x, -wp.z);
  float d = distance(pp, uOrigin[zi]) + wp.y * 0.25;
  float n = skNoise(pp * 1.3 + wp.y * 0.7) * 0.8 + skNoise(pp * 5.0 - wp.y * 2.0) * 0.4;
  float front = r * (uRad[zi] + 2.2) - 0.6;
  return smoothstep(front - 0.4, front + 0.05, d + n);
}

vec3 sheetAt(vec2 pp) {
  vec2 du = (pp - uDetailBox.xy) / (uDetailBox.zw - uDetailBox.xy);
  vec2 su = (pp - uSheetBox.xy) / (uSheetBox.zw - uSheetBox.xy);
  vec3 dc = texture2D(uDetail, clamp(du, 0.0, 1.0)).rgb;
  vec3 sc = texture2D(uSheet, clamp(su, 0.0, 1.0)).rgb;
  float inD = step(0.0, du.x) * step(0.0, du.y) * step(du.x, 1.0) * step(du.y, 1.0);
  float inS = step(0.0, su.x) * step(0.0, su.y) * step(su.x, 1.0) * step(su.y, 1.0);
  return mix(mix(uDesk, sc, inS), dc, inD);
}

float hatchLines(vec2 q, float shade, float dens) {
  float t = (q.x + q.y) * dens;
  float w = fwidth(t);
  float dl = min(fract(t), 1.0 - fract(t));
  float hw = mix(0.035, 0.17, clamp(shade, 0.0, 1.0));
  float a = 1.0 - smoothstep(hw - w, hw + w, dl);
  a *= 1.0 - smoothstep(0.22, 0.55, w);
  a *= 0.55 + 0.45 * skNoise(q * vec2(29.0, 33.0));
  return a * step(0.06, shade);
}

// kind: 0 architecture, 1 furniture, 2 garden. Up-facing architecture and ground show the
// plan drawing; furniture tops show it only while they are still flat on the sheet.
vec3 sketchColor(vec3 wp, vec3 wn, float kind, float riseF) {
  vec2 pp = vec2(wp.x, -wp.z);
  vec3 sheet = sheetAt(pp);
  float l = dot(wn, uDrawLight);
  float shade = wn.y < -0.5 ? 0.0 : clamp(0.5 - l * 0.9, 0.0, 1.0);
  vec2 q = abs(wn.y) > 0.5 ? wp.xz : (abs(wn.x) > abs(wn.z) ? vec2(wp.z, wp.y) : vec2(wp.x, wp.y));
  float h1 = hatchLines(q, shade, 9.0);
  float h2 = hatchLines(vec2(q.x, -q.y), shade - 0.45, 9.0);
  float h = max(h1, h2 * step(0.7, shade));
  vec3 col = mix(uPaper * (1.0 - shade * 0.06 - step(wn.y, -0.5) * 0.035), uInk, h * 0.3);
  float onSheet = step(0.5, wn.y);
  if (kind > 0.5 && kind < 1.5) onSheet *= 1.0 - smoothstep(0.05, 0.6, riseF);
  col = mix(col, sheet, onSheet);
  col *= 1.0 - 0.045 * skNoise(gl_FragCoord.xy * 0.8);
  return col;
}
`;

// Patch a MeshStandardMaterial: rise out of the sheet, then pencil ↔ real per zone.
// vlight: light baked per vertex (attribute aVL, same encoding as the lightmaps) instead of a
// lightmap patch; leaf: thin leaves that glow when the low sun is behind them.
export function sketchify(mat, { glass = false, vlight = false, leaf = false } = {}) {
  mat.onBeforeCompile = (sh) => {
    const head = (vlight ? '#define VLIGHT\n' : '') + (leaf ? '#define LEAF\n' : '');
    sh.vertexShader = head + sh.vertexShader;
    sh.fragmentShader = head + sh.fragmentShader;
    for (const k of Object.keys(SK)) sh.uniforms[k] = SK[k];
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 aInfo;
attribute vec3 aLm;
varying vec2 vInfo;
varying vec3 vLm;
#ifdef VLIGHT
attribute vec4 aVL;
varying vec4 vVL;
#endif
varying vec3 vWP;
varying vec3 vWN;
uniform float uRiseA;
uniform float uRiseF;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vInfo = aInfo;
vLm = aLm;
#ifdef VLIGHT
vVL = aVL;
#endif
float rise = (aInfo.y < 0.5 || aInfo.y > 2.5) ? uRiseA : uRiseF;
transformed.y *= max(rise, 0.0004);`)
      .replace('#include <project_vertex>', `#include <project_vertex>
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vInfo;
varying vec3 vLm;
varying vec3 vWP;
varying vec3 vWN;
#ifdef VLIGHT
varying vec4 vVL;
#endif
uniform float uRiseF;
uniform float uCut;
uniform float uBaked;
uniform sampler2D uLm0, uLm1, uLm2;
uniform float uLmMax, uDay, uLamp, uLampOut, uLampFront;
uniform vec3 uDayTint, uLampColor, uIndoor, uSunW;
${COMMON}`)
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
#if defined( RE_IndirectDiffuse )
if (uBaked > 0.5) {
  #ifdef VLIGHT
  bool hasLight = true;
  #else
  bool hasLight = vLm.z > -0.5;
  #endif
  if (hasLight) {
    #ifdef VLIGHT
    vec4 lt = vVL;
    #else
    vec4 lt = vLm.z < 0.5 ? textureLod(uLm0, vLm.xy, 0.0) : (vLm.z < 1.5 ? textureLod(uLm1, vLm.xy, 0.0) : textureLod(uLm2, vLm.xy, 0.0));
    #endif
    vec3 day = lt.rgb * lt.rgb * uLmMax;
    float lamp = lt.a * lt.a * uLmMax;
    bool indoor = vInfo.x > 0.5 && vInfo.x < ${NZ - 5}.5;              // zones 1..14 are rooms
    float lampLevel = indoor ? uLamp : (vInfo.x > ${NZ - 4.5} && vInfo.x < ${NZ - 3.5} ? uLampFront : uLampOut);   // zone 15 = street side
    // the garage: no daylight to speak of, so its work light is on
    if (abs(vInfo.x - ${Z.garage}.0) < 0.5) lampLevel = max(lampLevel, 6.0);
    // the lightmap has no direction: let the low sun rake across the relief (planks, weave, stone)
    float relief = 1.0;
    #ifdef USE_NORMALMAP
    vec3 sunV = normalize((viewMatrix * vec4(uSunW, 0.0)).xyz);
    relief = clamp(1.0 + (dot(normal, sunV) - dot(nonPerturbedNormal, sunV)) * 2.4, 0.5, 1.7);
    #endif
    vec3 L = day * uDayTint * uDay * relief + uLampColor * lamp * lampLevel;
    #ifdef LEAF
    // leaves let the low sun through: looking towards the sun, the lit ones glow
    float back = pow(max(dot(normalize(vWP - cameraPosition), uSunW), 0.0), 5.0);
    L += day * uDayTint * uDay * back * 0.9;
    #endif
    irradiance += L * PI;                       // baked light replaces sun, sky and shadows
    iblIrradiance = vec3(0.0);
    #if defined( RE_IndirectSpecular )
    radiance *= clamp(dot(L, vec3(0.3, 0.55, 0.15)) * 0.9, 0.04, 1.0);   // no bright sky reflections in dark corners
    #endif
  } else if (vInfo.x > 0.5 && vInfo.x < ${NZ - 5}.5) {   // zones 1..14 are rooms
    irradiance += (uIndoor * uDay + uLampColor * 0.12 * uLamp) * PI;     // small round things indoors
    iblIrradiance = vec3(0.0);
    #if defined( RE_IndirectSpecular )
    radiance *= 0.3;
    #endif
  }
}
#endif`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
{
  // finale: roof, ceilings and canopy dissolve away like a drawing lifted off the model
  if (vInfo.y > 2.5 && uCut > 0.0) {
    float n = skNoise(vWP.xz * 0.9) * 0.6 + skNoise(vWP.xz * 4.0) * 0.4;
    if (n < uCut * 1.15 - 0.05) discard;
  }
  float m = sketchMask(vWP, vInfo.x);
  vec3 real = gl_FragColor.rgb;
  float fd = distance(vWP, cameraPosition);
  real = mix(real, uFogColor, smoothstep(uFog.x, uFog.y, fd) * 0.85);
  vec3 sk = sketchColor(vWP, normalize(vWN), vInfo.y, uRiseF);
  float edge = 1.0 - abs(m * 2.0 - 1.0);
  vec3 c = mix(real, sk, m);
  gl_FragColor.rgb = mix(c, uInk, edge * 0.18);
  ${glass ? 'gl_FragColor.a = mix(gl_FragColor.a, 0.1, m);' : ''}
}`);
  };
  mat.customProgramCacheKey = () => `sk${glass ? '-glass' : ''}${vlight ? '-vl' : ''}${leaf ? '-leaf' : ''}`;
  return mat;
}

export function lineMaterial(riseKey, { cut = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...SK, uRise: riseKey === 'none' ? { value: 1 } : SK[riseKey], uAlpha: { value: 0.62 }, uCutOn: { value: cut ? 1 : 0 } },
    vertexShader: /* glsl */`
      attribute vec2 aZones;
      attribute vec2 aSeed;
      uniform float uRise;
      varying vec3 vWP;
      varying vec2 vZ;
      varying vec2 vSeed;
      void main() {
        vec3 p = position;
        p.y *= max(uRise, 0.0004);
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWP = wp.xyz; vZ = aZones; vSeed = aSeed;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      ${COMMON}
      uniform float uAlpha;
      uniform float uRise;
      uniform float uCut;
      uniform float uCutOn;
      varying vec3 vWP;
      varying vec2 vZ;
      varying vec2 vSeed;
      void main() {
        if (uCutOn > 0.5 && uCut > 0.0 && skNoise(vWP.xz * 0.9) * 0.6 + skNoise(vWP.xz * 4.0) * 0.4 < uCut * 1.15 - 0.05) discard;
        float vis = max(sketchMask(vWP, vZ.x), sketchMask(vWP, vZ.y));
        float dist = distance(vWP, cameraPosition);
        float a = vis * uAlpha * vSeed.y * (0.62 + 0.38 * skNoise(vWP.xz * 21.0 + vWP.y * 17.0 + vSeed.x * 40.0));
        a *= clamp(1.3 - dist / 60.0, 0.35, 1.0) * clamp(uRise * 5.0, 0.0, 1.0);
        if (a < 0.01) discard;
        gl_FragColor = vec4(uInk, a);
      }`,
    transparent: true,
    depthWrite: false,
  });
}

// Sky dome: paper while the drawing lasts, golden-hour gradient when real.
export function skyMaterial(skyZone) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uReal: SK.uReal, uDesk: SK.uDesk,
      uZenith: { value: disp('#7f9bb8') }, uHorizon: { value: disp('#f0cfa4') },
      uGlow: { value: disp('#ffd49a') }, uSunDir: { value: new THREE.Vector3(0, 0.2, -1).normalize() },
      uDusk: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      #define NZ ${NZ}
      uniform float uReal[NZ];
      uniform vec3 uDesk, uZenith, uHorizon, uGlow, uSunDir;
      uniform float uDusk;
      varying vec3 vDir;
      float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h1(i), h1(i + vec2(1.0, 0.0)), u.x), mix(h1(i + vec2(0.0, 1.0)), h1(i + vec2(1.0, 1.0)), u.x), u.y); }
      float fbm(vec2 p) { float a = 0.5, t = 0.0; for (int i = 0; i < 5; i++) { t += a * n2(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return t; }
      // A golden-hour sky: deep zenith, warm haze low on the sun side, a cooler rosy band opposite,
      // a soft halo round the sun, thin high cloud lit from the sun side, a hazy tree line far off.
      void main() {
        vec3 d = normalize(vDir), sun = normalize(uSunDir);
        float h = d.y, e = max(h, 0.0);
        vec2 dh = normalize(d.xz + 1e-5), sh = normalize(sun.xz);
        float side = clamp(dot(dh, sh) * 0.5 + 0.5, 0.0, 1.0);   // clamped: pow() of a hair below 0 is NaN on some GPUs
        vec3 opp = mix(vec3(0.86, 0.81, 0.81), vec3(0.60, 0.49, 0.57), uDusk);
        vec3 hor = mix(opp, uHorizon, pow(side, 1.6));
        vec3 mid = mix(mix(vec3(0.68, 0.76, 0.86), vec3(0.45, 0.44, 0.56), uDusk), hor, 0.22);
        vec3 sky = mix(hor, mid, smoothstep(0.0, 0.22, e));
        sky = mix(sky, uZenith, smoothstep(0.14, 0.88, e));
        sky = mix(sky, hor, exp(-e * 24.0) * 0.55);
        float cs = max(dot(d, sun), 0.0);
        sky += uGlow * (smoothstep(0.99955, 0.9998, cs) * 6.0 * (1.0 - uDusk) + pow(cs, 280.0) * 0.85 + pow(cs, 14.0) * 0.3 + pow(cs, 3.0) * 0.1 * (1.0 - e));
        if (h > 0.0) {
          vec2 uv = d.xz / (h + 0.18) * 0.9;
          float c = fbm(uv * vec2(0.8, 2.8) + vec2(3.0, 0.0));
          c = smoothstep(0.52, 0.82, c) * smoothstep(0.02, 0.22, h) * (1.0 - smoothstep(0.55, 0.9, h)) * 0.5;
          vec3 lit = mix(vec3(1.0, 0.87, 0.72), vec3(0.98, 0.62, 0.46), uDusk);
          vec3 shade = mix(vec3(0.82, 0.82, 0.87), vec3(0.48, 0.44, 0.55), uDusk);
          sky = mix(sky, mix(shade, lit, pow(side, 1.3)), c);
        }
        float tl = 0.005 + 0.012 * n2(dh * 7.0) + 0.006 * n2(dh * 31.0 + 5.0) + 0.003 * n2(dh * 110.0 + 9.0);
        vec3 trees = mix(hor, mix(vec3(0.38, 0.42, 0.38), vec3(0.21, 0.23, 0.27), uDusk), 0.48);
        sky = mix(sky, trees, (1.0 - smoothstep(tl - 0.0015, tl + 0.0015, h)) * step(-0.06, h));
        sky = mix(sky, mix(trees, vec3(0.46, 0.46, 0.41), 0.4), smoothstep(-0.005, -0.08, h));
        float r = clamp(uReal[${'SKYZ'}], 0.0, 1.0);
        gl_FragColor = vec4(mix(uDesk, sky, r), 1.0);
      }`.replace('SKYZ', String(skyZone)),
    side: THREE.BackSide,
    depthWrite: false,
  });
}
