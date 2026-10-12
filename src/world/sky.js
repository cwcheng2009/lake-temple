import * as THREE from 'three';
import { glowTexture, rng } from '../util.js';

// Night sky: gradient dome, twinkling stars, a moon, and distant mountain ridges.
export function createSky(moonDir) {
  const group = new THREE.Group();

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenith: { value: new THREE.Color('#02040b') },
        uHorizon: { value: new THREE.Color('#13213a') },
        uGlow: { value: new THREE.Color('#2c4466') },
        uMoon: { value: moonDir.clone() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenith, uHorizon, uGlow, uMoon;
        varying vec3 vDir;
        void main() {
          float h = max(vDir.y, 0.0);
          vec3 col = mix(uHorizon, uZenith, pow(h, 0.45));
          float m = max(dot(normalize(vDir), normalize(uMoon)), 0.0);
          col += uGlow * (pow(m, 24.0) * 0.9 + pow(m, 4.0) * 0.25);
          if (vDir.y < 0.0) col = uHorizon * 0.8;
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  dome.renderOrder = -10;
  group.add(dome);

  // Stars
  const r = rng(7);
  const N = 2200;
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  const size = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = r(), v = 0.04 + Math.pow(r(), 0.8) * 0.96;
    const th = u * Math.PI * 2, y = v, rr = Math.sqrt(1 - y * y);
    pos.set([Math.cos(th) * rr * 1300, y * 1300, Math.sin(th) * rr * 1300], i * 3);
    seed[i] = r() * 100;
    size[i] = 0.6 + Math.pow(r(), 6) * 2.6;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  sg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const starMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPR: { value: Math.min(devicePixelRatio, 2) } },
    vertexShader: /* glsl */ `
      attribute float aSeed, aSize;
      uniform float uTime, uPR;
      varying float vA;
      void main() {
        vA = 0.55 + 0.45 * sin(uTime * (0.6 + fract(aSeed) * 1.8) + aSeed);
        vA *= smoothstep(0.0, 260.0, position.y);
        gl_PointSize = aSize * uPR * 1.6;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a * vA, 1.0);
      }`,
  });
  const stars = new THREE.Points(sg, starMat);
  stars.renderOrder = -9;
  group.add(stars);

  // Moon: a bright disc plus a wide soft halo
  const moonPos = moonDir.clone().normalize().multiplyScalar(1100);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(THREE, 256, [[0, 'rgba(160,190,255,0.55)'], [0.25, 'rgba(120,150,220,0.18)'], [1, 'rgba(80,110,180,0)']]),
      fog: false, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true,
    })
  );
  halo.position.copy(moonPos);
  halo.scale.setScalar(520);
  group.add(halo);
  const moon = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(THREE, 256, [[0, '#fffdf4'], [0.42, '#f3f0e2'], [0.47, 'rgba(240,240,230,0.25)'], [0.55, 'rgba(240,240,230,0)']]),
      fog: false, depthWrite: false, transparent: true,
    })
  );
  moon.material.color.setScalar(2.2);
  moon.position.copy(moonPos);
  moon.scale.setScalar(70);
  group.add(moon);

  // Mountain ridges, back to front
  const ridges = [
    { z: -720, h: 210, color: '#16243b', seed: 3, rough: 0.0016 },
    { z: -560, h: 150, color: '#101b2e', seed: 5, rough: 0.0024 },
    { z: -430, h: 95, color: '#0b1424', seed: 11, rough: 0.0035 },
  ];
  for (const rd of ridges) group.add(makeRidge(rd));

  return {
    group,
    update(t) {
      starMat.uniforms.uTime.value = t;
    },
  };
}

function makeRidge({ z, h, color, seed, rough }) {
  const r = rng(seed);
  const shape = new THREE.Shape();
  const W = 2600;
  shape.moveTo(-W / 2, -40);
  const ph = [r() * 10, r() * 10, r() * 10];
  for (let i = 0; i <= 260; i++) {
    const x = -W / 2 + (W * i) / 260;
    const y =
      h * (0.55 + 0.3 * Math.sin(x * rough * 2.1 + ph[0]) + 0.18 * Math.sin(x * rough * 5.3 + ph[1]) + 0.06 * Math.sin(x * rough * 17 + ph[2])) *
      (0.6 + 0.4 * Math.cos((x / W) * Math.PI));
    shape.lineTo(x, Math.max(4, y));
  }
  shape.lineTo(W / 2, -40);
  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({ color, fog: false })
  );
  mesh.position.set(0, -2, z);
  return mesh;
}
