import * as THREE from 'three';
import { rng, fbm, smoothstep } from '../util.js';

// The shoreline curves toward the viewer on both sides, wrapping the lake.
const UP = new THREE.Vector3(0, 1, 0);

export const zShore = (x) => -27 + Math.pow(x / 70, 2) * 26;

// Ground height (metres) at any point. Water level is 0.
export function heightAt(x, z) {
  const d = zShore(x) - z; // > 0 means inland
  let h = -2.2 + 3.2 * smoothstep(-7, 7, d);
  h += 0.7 * (fbm(x * 0.05 + 3, z * 0.05, 3) - 0.5) * smoothstep(-2, 6, d);
  h += 26 * smoothstep(18, 110, d) * fbm(x * 0.012 + 10, z * 0.012, 4);
  return h;
}

export function createLandscape() {
  const group = new THREE.Group();
  const r = rng(42);

  // Ground
  const geo = new THREE.PlaneGeometry(700, 360, 280, 144);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -80);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const moss = new THREE.Color('#1d2a1f'), dark = new THREE.Color('#141c18'), sand = new THREE.Color('#3b3a33'), mud = new THREE.Color('#151413');
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const y = heightAt(x, z);
    p.setY(i, y);
    const n = fbm(x * 0.08, z * 0.08, 3);
    c.copy(moss).lerp(dark, n);
    if (y < 0.6) c.copy(sand).lerp(mud, smoothstep(0.6, -0.8, y));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  group.add(ground);

  // Trees: pines and cherry trees scattered along the shore (instanced for speed)
  const trees = [];
  for (let i = 0; i < 160 && trees.length < 95; i++) {
    const x = (r() - 0.5) * 300;
    const d = 4 + Math.pow(r(), 1.4) * 60;
    const z = zShore(x) - d;
    if (Math.abs(x) < 5 && d < 14) continue; // keep the bridge landing clear
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 5)) continue;
    const cherry = d < 22 && r() < 0.42;
    trees.push({ x, z, y: heightAt(x, z), cherry, s: 0.8 + r() * 0.6, rot: r() * Math.PI * 2 });
  }

  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const coneGeo = new THREE.ConeGeometry(1, 1, 7);
  const blobGeo = new THREE.IcosahedronGeometry(1, 1);

  const pines = trees.filter((t) => !t.cherry);
  const cherries = trees.filter((t) => t.cherry);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#2a1d16', roughness: 1 }), trees.length);
  const cones = new THREE.InstancedMesh(coneGeo, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), pines.length * 4);
  const blobs = new THREE.InstancedMesh(
    blobGeo,
    new THREE.MeshStandardMaterial({ emissive: '#4a1a2c', emissiveIntensity: 0.6, roughness: 0.9, flatShading: true }),
    cherries.length * 7 + 7
  );

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), col = new THREE.Color();
  let ti = 0, ci = 0, bi = 0;
  for (const t of trees) {
    const trunkH = t.cherry ? 3.2 * t.s : 4 * t.s;
    m.compose(v.set(t.x, t.y - 0.2, t.z), q.identity(), s.set(t.s, trunkH, t.s));
    trunks.setMatrixAt(ti++, m);
    if (!t.cherry) {
      for (let k = 0; k < 4; k++) {
        const w = (3.2 - k * 0.65) * t.s, hh = 3.2 * t.s;
        m.compose(v.set(t.x, t.y + 2.2 * t.s + k * 1.9 * t.s + hh / 2, t.z), q.setFromAxisAngle(UP, t.rot + k), s.set(w, hh, w));
        cones.setMatrixAt(ci, m);
        cones.setColorAt(ci++, col.set('#16261d').offsetHSL(0, 0, (r() - 0.5) * 0.04));
      }
    } else {
      addBlossoms(blobs, bi, t, r, m, q, s, v, col);
      bi += 7;
    }
  }
  trunks.count = ti;
  cones.count = ci;
  blobs.count = bi;
  group.add(trunks, cones, blobs);

  // Rocks along the waterline
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.95, flatShading: true }), 90);
  for (let i = 0; i < 90; i++) {
    const x = (r() - 0.5) * 240;
    const z = zShore(x) + (r() - 0.6) * 6;
    if (Math.abs(x) < 5) continue;
    const sc = 0.5 + Math.pow(r(), 2) * 2.2;
    m.compose(v.set(x, heightAt(x, z) + sc * 0.2, z), q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)), s.set(sc * 1.3, sc * 0.7, sc));
    rocks.setMatrixAt(i, m);
  }
  group.add(rocks);

  return { group, trees, cherries, blobs, addBlossoms };
}

// Cherry tree crown: 7 pink blobs (shared with the tree on the temple platform)
export function addBlossoms(blobs, start, t, r, m, q, s, v, col) {
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + t.rot;
    const rad = k === 0 ? 0 : 1.6 * t.s;
    const sc = (k === 0 ? 2.0 : 1.4 + r() * 0.5) * t.s;
    m.compose(
      v.set(t.x + Math.cos(a) * rad, t.y + 3.6 * t.s + (k === 0 ? 1.2 : r() * 1.2) * t.s, t.z + Math.sin(a) * rad),
      q.identity(),
      s.set(sc, sc * 0.75, sc)
    );
    blobs.setMatrixAt(start + k, m);
    blobs.setColorAt(start + k, col.set('#e3a3bd').offsetHSL((r() - 0.5) * 0.03, 0, (r() - 0.5) * 0.08));
  }
}
