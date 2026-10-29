// Flames in the fire bowl: three crossed cards with a flickering flame drawn in the shader
// (no texture), added on top of the scene. They appear when the garden turns real.
import * as THREE from 'three';
import { SK } from './sketch-shader.js';
import { NZ } from '../world/zones.js';

export function makeFire(pos, zone) {
  const geo = new THREE.BufferGeometry();
  const P = [], UV = [], W = 0.62, H = 0.72;
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI) / 3, dx = Math.cos(a) * W / 2, dz = Math.sin(a) * W / 2;
    const q = [[-dx, 0, -dz], [dx, 0, dz], [dx, H, dz], [-dx, H, -dz]];
    for (const i of [0, 1, 2, 0, 2, 3]) { P.push(...q[i]); UV.push(i === 0 || i === 3 ? 0 : 1, i < 2 ? 0 : 1); }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uReal: SK.uReal },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      #define NZ ${NZ}
      uniform float uTime;
      uniform float uReal[NZ];
      varying vec2 vUv;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y); }
      void main() {
        vec2 uv = vUv;
        float q = n(vec2(uv.x * 4.0, uv.y * 3.0 - uTime * 2.1)) * 0.6 + n(vec2(uv.x * 9.0 + 3.0, uv.y * 6.0 - uTime * 3.4)) * 0.4;
        float width = (1.0 - uv.y) * 0.34 + 0.02;
        float d = abs(uv.x - 0.5 + (q - 0.5) * 0.22 * uv.y);
        float f = smoothstep(width, width * 0.25, d) * smoothstep(0.95, 0.15, uv.y + q * 0.42) * smoothstep(0.0, 0.06, uv.y);
        vec3 col = mix(vec3(1.0, 0.32, 0.05), vec3(1.0, 0.84, 0.48), smoothstep(0.25, 0.85, f));
        float a = f * clamp(uReal[${'ZONE'}], 0.0, 1.0);
        if (a < 0.01) discard;
        gl_FragColor = vec4(col * a * 1.5, a);
      }`.replace('ZONE', String(zone)),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  mesh.renderOrder = 4;
  mesh.userData = { mat: 'fire', group: 'site' };
  return { mesh, tick(t) { mat.uniforms.uTime.value = t; mesh.scale.y = 0.94 + 0.06 * Math.sin(t * 7.3) * Math.sin(t * 3.1); } };
}
