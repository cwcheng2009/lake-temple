import * as THREE from 'three';
import { rng, glowTexture } from '../util.js';
import { zShore, heightAt } from './landscape.js';

// Fireflies, drifting mist, falling petals and click ripples on the water.
export function createAtmosphere(cherries) {
  const group = new THREE.Group();
  const r = rng(77);
  const PR = Math.min(devicePixelRatio, 2);

  // ── Fireflies
  const FN = 180;
  const fp = new Float32Array(FN * 3), fs = new Float32Array(FN);
  for (let i = 0; i < FN; i++) {
    const x = (r() - 0.5) * 120;
    const z = zShore(x) + (r() - 0.7) * 26;
    fp.set([x, Math.max(heightAt(x, z), 0) + 0.6 + r() * 3.5, z], i * 3);
    fs[i] = r() * 100;
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  fg.setAttribute('aSeed', new THREE.BufferAttribute(fs, 1));
  const fireflyMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPR: { value: PR } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime, uPR;
      varying float vA;
      void main() {
        vec3 p = position;
        float t = uTime * 0.3 + aSeed;
        p += vec3(sin(t * 1.3) * 1.6, sin(t * 0.9 + aSeed) * 0.7, cos(t * 1.1) * 1.6);
        float blink = sin(uTime * (0.8 + fract(aSeed * 7.0)) + aSeed * 3.0);
        vA = pow(max(blink, 0.0), 3.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = 22.0 * uPR / -mv.z * 10.0 * (0.4 + 0.6 * vA);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float core = smoothstep(0.12, 0.0, d), halo = smoothstep(0.5, 0.0, d) * 0.35;
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.45) * (core * 3.0 + halo) * vA, 1.0);
      }`,
  });
  group.add(new THREE.Points(fg, fireflyMat));

  // ── Mist banks drifting low over the water
  const mistTex = glowTexture(THREE, 128, [[0, 'rgba(170,190,220,0.5)'], [1, 'rgba(170,190,220,0)']]);
  const mists = [];
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: 0.12 + r() * 0.1, fog: true }));
    s.position.set((r() - 0.5) * 220, 0.8 + r() * 2.5, -30 + r() * 70);
    s.scale.set(40 + r() * 40, 7 + r() * 6, 1);
    s.userData.speed = 0.25 + r() * 0.5;
    mists.push(s);
    group.add(s);
  }

  // ── Petals falling from the cherry trees
  const spots = [...cherries];
  spots.push({ x: -11.5, y: 1.2, z: 5.5, s: 1 });
  const PN = 500;
  const pp = new Float32Array(PN * 3), ps = new Float32Array(PN);
  for (let i = 0; i < PN; i++) {
    const t = spots[Math.floor(r() * spots.length)];
    pp.set([t.x + (r() - 0.5) * 5, t.y + 6 * t.s, t.z + (r() - 0.5) * 5], i * 3);
    ps[i] = r();
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  pg.setAttribute('aSeed', new THREE.BufferAttribute(ps, 1));
  const petalMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uPR: { value: PR }, uWind: { value: 0.5 } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime, uPR, uWind;
      varying float vA;
      void main() {
        float life = fract(uTime * (0.035 + aSeed * 0.03) + aSeed);
        vec3 p = position;
        p.y -= life * 7.5;
        p.x += life * (2.0 + uWind * 6.0) + sin(uTime * 2.0 + aSeed * 40.0) * 0.4;
        p.z += cos(uTime * 1.7 + aSeed * 30.0) * 0.4;
        vA = smoothstep(0.0, 0.1, life) * smoothstep(1.0, 0.8, life);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = 5.0 * uPR / -mv.z * 10.0;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c * vec2(1.0, 1.8));
        if (d > 0.5) discard;
        gl_FragColor = vec4(vec3(0.95, 0.68, 0.78), vA * 0.9);
      }`,
  });
  group.add(new THREE.Points(pg, petalMat));

  // ── Ripples (rings that spread over the water)
  const ringGeo = new THREE.RingGeometry(0.92, 1, 96).rotateX(-Math.PI / 2);
  const thinRingGeo = new THREE.RingGeometry(0.985, 1, 160).rotateX(-Math.PI / 2);
  const ripples = [];
  function ripple(pos, { color = '#bcd4ff', size = 6, duration = 3, rings = 3 } = {}) {
    for (let k = 0; k < rings; k++) {
      const m = new THREE.Mesh(
        size > 20 ? thinRingGeo : ringGeo,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: true })
      );
      m.position.set(pos.x, 0.05, pos.z);
      m.userData = { t: -k * 0.35, size, duration, peak: size > 20 ? 0.35 : 0.9 };
      group.add(m);
      ripples.push(m);
    }
  }

  return {
    group,
    ripple,
    update(dt, t, wind = 0.5) {
      fireflyMat.uniforms.uTime.value = t;
      petalMat.uniforms.uTime.value = t;
      petalMat.uniforms.uWind.value = wind;
      for (const s of mists) {
        s.position.x += s.userData.speed * dt * (0.4 + wind);
        if (s.position.x > 120) s.position.x = -120;
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const m = ripples[i], u = m.userData;
        u.t += dt;
        const a = u.t / u.duration;
        if (a >= 1) {
          group.remove(m);
          m.material.dispose();
          ripples.splice(i, 1);
          continue;
        }
        if (a < 0) continue;
        m.scale.setScalar(0.2 + a * u.size);
        m.material.opacity = Math.sin(a * Math.PI) * (1 - a) * u.peak;
      }
    },
  };
}
