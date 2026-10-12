import * as THREE from 'three';
import { rng } from '../util.js';
import { addBlossoms } from './landscape.js';

// The temple, built from simple shapes so the project works before you have a model.
// Platform, bell pavilion, bridge and torii stay even when you load your own model;
// only `hall` is hidden (see TEMPLE_MODEL.hideBuiltInHall in config.js).
export function createTemple() {
  const group = new THREE.Group();
  const hall = new THREE.Group();
  group.add(hall);
  const clickables = [];
  const lanterns = [];
  const chimePositions = [];

  const mat = {
    stone: new THREE.MeshStandardMaterial({ color: '#4b4e54', roughness: 0.95 }),
    stoneDark: new THREE.MeshStandardMaterial({ color: '#34373c', roughness: 1 }),
    red: new THREE.MeshStandardMaterial({ color: '#8c2617', roughness: 0.65 }),
    wood: new THREE.MeshStandardMaterial({ color: '#3a271b', roughness: 0.85 }),
    deck: new THREE.MeshStandardMaterial({ color: '#2e2219', roughness: 0.9 }),
    black: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.6 }),
    roof: new THREE.MeshStandardMaterial({ color: '#47505c', roughness: 0.5, metalness: 0.25, side: THREE.DoubleSide, bumpMap: tileTexture(), bumpScale: 2 }),
    shoji: shojiMaterial(1.0),
    shojiUpper: shojiMaterial(0.55),
    lantern: new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ff8a2a', emissiveIntensity: 3.5, roughness: 0.6 }),
    bronze: new THREE.MeshStandardMaterial({ color: '#5a6a55', metalness: 0.85, roughness: 0.38 }),
  };

  const box = (w, h, d, m, x, y, z, parent = group) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    parent.add(b);
    return b;
  };
  const cyl = (r, h, m, x, y, z, parent = group, seg = 12) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
    c.position.set(x, y, z);
    parent.add(c);
    return c;
  };

  // ── Stone platform rising out of the lake (top at y = 1.2)
  box(30, 2.4, 22, mat.stone, 0, 0, 0);
  box(30.6, 0.25, 22.6, mat.stoneDark, 0, 1.15, 0);
  for (let i = 0; i < 5; i++) box(9, 0.3, 0.7, mat.stone, 0, 1.2 - 0.3 * (i + 1) + 0.15 - 0.3, 11.35 + 0.7 * i);

  // ── Main hall
  const HZ = -2; // hall centre (z)
  box(18, 0.3, 13, mat.deck, 0, 1.35, HZ, hall);
  const walls = box(12, 4, 8, mat.shoji, 0, 3.5, HZ, hall);
  walls.userData.action = 'hall';
  clickables.push(walls);
  for (const x of [-8, -4, 0, 4, 8])
    for (const z of [HZ - 5.8, HZ + 5.8]) cyl(0.3, 4.6, mat.red, x, 3.8, z, hall);
  for (const x of [-8, 8]) cyl(0.3, 4.6, mat.red, x, 3.8, HZ, hall);
  for (const z of [HZ - 5.8, HZ + 5.8]) box(16.8, 0.5, 0.4, mat.red, 0, 5.85, z, hall);
  for (const x of [-8, 8]) box(0.4, 0.5, 11.8, mat.red, x, 5.85, HZ, hall);
  // railing around the veranda
  for (const z of [HZ - 6.3, HZ + 6.3]) {
    for (const sx of [-1, 1]) box(6.2, 0.12, 0.12, mat.red, sx * 5.8, 2.2, z, hall);
  }

  const lowerRoof = makeRoof(21.5, 15.5, 2.4, 1.1, mat.roof);
  lowerRoof.position.set(0, 6.1, HZ);
  hall.add(lowerRoof);
  box(10, 3, 6.5, mat.shojiUpper, 0, 8.0, HZ, hall);
  for (const x of [-5, 5]) for (const z of [HZ - 3.25, HZ + 3.25]) cyl(0.22, 3, mat.red, x, 8.0, z, hall);
  const upperRoof = makeRoof(15, 10.5, 3.3, 1.2, mat.roof);
  upperRoof.position.set(0, 9.5, HZ);
  hall.add(upperRoof);
  box(5, 0.55, 0.6, mat.black, 0, 12.9, HZ, hall); // ridge
  for (const sx of [-1, 1]) {
    const shibi = box(0.5, 1.2, 0.5, mat.black, sx * 2.6, 13.3, HZ, hall);
    shibi.rotation.z = -sx * 0.35;
  }

  // Hanging lanterns along the front eave
  for (const x of [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5]) {
    const l = hangingLantern(mat);
    l.position.set(x, 6.0, HZ + 6.6);
    hall.add(l);
    lanterns.push(l.userData.glow);
    clickables.push(l.userData.glow);
  }
  // Wind chimes hang from the four corners of the lower roof
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const p = new THREE.Vector3(sx * 10.2, 6.6, HZ + sz * 7.2);
      chimePositions.push(p);
      const ch = new THREE.Group();
      ch.position.copy(p);
      for (let k = 0; k < 5; k++) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5 + k * 0.08, 6), mat.bronze);
        t.position.set(Math.cos(k * 1.26) * 0.12, -0.6 - k * 0.04, Math.sin(k * 1.26) * 0.12);
        ch.add(t);
      }
      hall.add(ch);
    }

  // Stone lanterns (tōrō) at the front steps
  for (const sx of [-1, 1]) {
    const t = stoneLantern(mat);
    t.position.set(sx * 6.5, 1.2, 9.2);
    group.add(t);
    lanterns.push(t.userData.glow);
    clickables.push(t.userData.glow);
  }

  // ── Bell pavilion (shōrō)
  const BX = 11, BZ = 5;
  for (const x of [-1.7, 1.7]) for (const z of [-1.7, 1.7]) cyl(0.2, 4.2, mat.red, BX + x, 3.3, BZ + z);
  box(4.0, 0.35, 0.35, mat.red, BX, 5.25, BZ);
  const bellRoof = makeRoof(6, 6, 1.9, 0.7, mat.roof);
  bellRoof.position.set(BX, 5.4, BZ);
  group.add(bellRoof);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), mat.black);
  finial.position.set(BX, 7.35, BZ);
  group.add(finial);

  const bellPivot = new THREE.Group();
  bellPivot.position.set(BX, 5.1, BZ);
  group.add(bellPivot);
  const profile = [
    [0.0, 0], [0.32, 0], [0.42, -0.15], [0.66, -0.25], [0.78, -0.5], [0.8, -1.4], [0.86, -1.75], [0.94, -1.9], [0.86, -1.92], [0.76, -1.8],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const bell = new THREE.Mesh(new THREE.LatheGeometry(profile, 40), mat.bronze);
  bell.material.side = THREE.DoubleSide;
  bell.userData.action = 'bell';
  bellPivot.add(bell);
  for (let k = 0; k < 4; k++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.81, 0.025, 6, 40), mat.bronze);
    band.rotation.x = Math.PI / 2;
    band.position.y = -0.55 - k * 0.3;
    bellPivot.add(band);
  }
  clickables.push(bell);

  const strikerPivot = new THREE.Group();
  strikerPivot.position.set(BX - 1.95, 5.1, BZ);
  group.add(strikerPivot);
  const striker = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 2.0, 10), mat.wood);
  striker.rotation.z = Math.PI / 2;
  striker.position.set(-0.4, -1.25, 0);
  strikerPivot.add(striker);
  for (const dx of [-1, 0.3]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.25, 4), mat.wood);
    rope.position.set(dx, -0.62, 0);
    strikerPivot.add(rope);
  }
  striker.userData.action = 'bell';
  clickables.push(striker);

  // ── Cherry tree on the platform's left
  const r = rng(9);
  const blobs = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ emissive: '#4a1a2c', emissiveIntensity: 0.6, roughness: 0.9, flatShading: true }),
    7
  );
  const treeSpot = { x: -11.5, y: 1.2, z: 5.5, s: 1.0, rot: 0.4 };
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 3.8, 7), mat.wood);
  trunk.position.set(treeSpot.x, 1.2 + 1.9, treeSpot.z);
  group.add(trunk);
  addBlossoms(blobs, 0, treeSpot, r, new THREE.Matrix4(), new THREE.Quaternion(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Color());
  group.add(blobs);

  // ── Bridge to the shore (arched)
  const bridge = new THREE.Group();
  const z0 = -11, z1 = -33, N = 14;
  for (let i = 0; i < N; i++) {
    const a = i / N, b = (i + 1) / N;
    const za = z0 + (z1 - z0) * a, zb = z0 + (z1 - z0) * b;
    const ya = 1.25 + Math.sin(a * Math.PI) * 1.1 - a * 0.3, yb = 1.25 + Math.sin(b * Math.PI) * 1.1 - b * 0.3;
    const len = Math.hypot(zb - za, yb - ya);
    const plank = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, len + 0.05), mat.deck);
    plank.position.set(0, (ya + yb) / 2, (za + zb) / 2);
    plank.rotation.x = Math.atan2(yb - ya, za - zb);
    bridge.add(plank);
    for (const sx of [-1.55, 1.55]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 6), mat.red);
      post.position.set(sx, ya + 0.5, za);
      bridge.add(post);
      if (i % 2 === 0) {
        const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, ya + 2.5, 6), mat.wood);
        pile.position.set(sx, (ya - 2.5) / 2, za);
        bridge.add(pile);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, len + 0.05), mat.red);
      rail.position.set(sx, (ya + yb) / 2 + 1.0, (za + zb) / 2);
      rail.rotation.x = plank.rotation.x;
      bridge.add(rail);
    }
  }
  group.add(bridge);

  // ── Torii gate standing in the water
  const torii = new THREE.Group();
  torii.position.set(0, 0, 30);
  for (const sx of [-5, 5]) {
    const p = cyl(0.5, 11, mat.red, sx, 4.3, 0, torii, 16);
    p.geometry = new THREE.CylinderGeometry(0.42, 0.55, 11, 16);
    cyl(0.62, 0.8, mat.black, sx, -0.6, 0, torii, 16);
  }
  box(12.4, 0.5, 0.45, mat.red, 0, 7.6, 0, torii); // nuki
  const kasagi = new THREE.BoxGeometry(15, 0.7, 1.1, 60, 1, 1);
  const kp = kasagi.attributes.position;
  for (let i = 0; i < kp.count; i++) kp.setY(i, kp.getY(i) + 0.75 * Math.pow(Math.abs(kp.getX(i)) / 7.5, 3.5));
  kasagi.computeVertexNormals();
  const kas = new THREE.Mesh(kasagi, mat.black);
  kas.position.y = 9.85;
  torii.add(kas);
  box(13.6, 0.5, 0.9, mat.red, 0, 9.3, 0, torii); // shimaki
  box(0.9, 1.3, 0.3, mat.black, 0, 8.4, 0.05, torii); // name plaque
  group.add(torii);

  // Warm lights (kept few for performance)
  const hallLight = new THREE.PointLight('#ffa65a', 60, 40, 1.6);
  hallLight.position.set(0, 4, HZ + 7.5);
  group.add(hallLight);
  const sideLights = [-1, 1].map((sx) => {
    const L = new THREE.PointLight('#ff9a4a', 14, 18, 1.6);
    L.position.set(sx * 6.5, 2.6, 9.2);
    group.add(L);
    return L;
  });
  const bellLight = new THREE.PointLight('#ffb070', 8, 14, 1.6);
  bellLight.position.set(BX, 4.5, BZ + 3);
  group.add(bellLight);

  // ── Animation state
  let bellSwing = 0, bellVel = 0, strikerSwing = 0, strikerVel = 0, pulse = 0;
  const bellWorld = new THREE.Vector3(BX, 4.2, BZ);

  return {
    group,
    hall,
    clickables,
    chimePositions,
    bellWorld,
    hallCenter: new THREE.Vector3(0, 3.5, HZ),
    strikeBell(vel = 1) {
      strikerVel = -2.2 * vel;
    },
    onBellSound(vel = 1) {
      bellVel += 0.12 * vel;
      pulse = Math.min(1.5, pulse + vel);
    },
    update(dt, t, chantLevel = 0) {
      // striker: spring back to rest
      strikerVel += (-strikerSwing * 18 - strikerVel * 2.5) * dt;
      strikerSwing += strikerVel * dt;
      strikerPivot.rotation.z = strikerSwing * 0.35;
      bellVel += (-bellSwing * 9 - bellVel * 0.6) * dt;
      bellSwing += bellVel * dt;
      bellPivot.rotation.x = bellSwing * 0.25;
      pulse *= Math.exp(-dt * 0.5);

      const flick = (i) => 0.85 + 0.15 * Math.sin(t * 7.3 + i * 2.1) * Math.sin(t * 3.1 + i);
      lanterns.forEach((m, i) => (m.material.emissiveIntensity = 2.4 * flick(i) * (1 + pulse * 0.7)));
      mat.shoji.emissiveIntensity = 0.42 + chantLevel * 1.2 + pulse * 0.25;
      mat.shojiUpper.emissiveIntensity = 0.28 + chantLevel * 0.8 + pulse * 0.2;
      hallLight.intensity = 30 * (0.9 + 0.1 * flick(0)) * (1 + pulse * 0.6);
      sideLights.forEach((L, i) => (L.intensity = 14 * flick(i + 3) * (1 + pulse * 0.6)));
      bellLight.intensity = 8 * (1 + pulse * 2);
      return pulse;
    },
  };
}

// Hip roof with concave slopes and upturned corners — the typical East Asian silhouette.
function makeRoof(W, D, H, lift, material, segs = 72) {
  const g = new THREE.PlaneGeometry(W, D, segs, segs);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  const hw = W / 2, hd = D / 2, ridge = Math.max(0, (W - D) / 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const s = Math.min(1, Math.max(Math.abs(z) / hd, Math.max(0, Math.abs(x) - ridge) / hd));
    let y = H * Math.pow(1 - s, 1.7);
    const cx = Math.abs(x) / hw, cz = Math.abs(z) / hd;
    y += lift * Math.pow(cx * cz, 3) + lift * 0.18 * Math.pow(s, 3);
    p.setY(i, y);
  }
  g.computeVertexNormals();
  const roof = new THREE.Mesh(g, material);
  // thin dark fascia so the eaves read as solid
  const edge = new THREE.Mesh(g.clone(), new THREE.MeshStandardMaterial({ color: '#15181c', roughness: 0.9, side: THREE.DoubleSide }));
  edge.position.y = -0.22;
  edge.scale.set(0.995, 1, 0.995);
  const grp = new THREE.Group();
  grp.add(roof, edge);
  return grp;
}

function hangingLantern(mat) {
  const g = new THREE.Group();
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 4), mat.black);
  cord.position.y = -0.35;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), mat.lantern.clone());
  body.scale.set(1, 1.35, 1);
  body.position.y = -1.15;
  body.userData.action = 'lantern';
  const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 12), mat.black);
  capT.position.y = -0.68;
  const capB = capT.clone();
  capB.position.y = -1.62;
  g.add(cord, body, capT, capB);
  g.userData.glow = body;
  return g;
}

function stoneLantern(mat) {
  const g = new THREE.Group();
  const add = (geo, m, y) => {
    const o = new THREE.Mesh(geo, m);
    o.position.y = y;
    g.add(o);
    return o;
  };
  add(new THREE.CylinderGeometry(0.55, 0.65, 0.35, 8), mat.stone, 0.17);
  add(new THREE.CylinderGeometry(0.2, 0.25, 1.3, 8), mat.stone, 1.0);
  add(new THREE.CylinderGeometry(0.5, 0.4, 0.25, 6), mat.stone, 1.75);
  const glow = add(new THREE.BoxGeometry(0.55, 0.5, 0.55), mat.lantern.clone(), 2.12);
  glow.userData.action = 'lantern';
  add(new THREE.ConeGeometry(0.85, 0.6, 6), mat.stone, 2.68);
  add(new THREE.SphereGeometry(0.14, 8, 6), mat.stone, 3.05);
  g.userData.glow = glow;
  return g;
}

function tileTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 512, 64);
  for (let x = 0; x < 512; x += 8) {
    const grad = g.createLinearGradient(x, 0, x + 8, 0);
    grad.addColorStop(0, '#202020');
    grad.addColorStop(0.5, '#e0e0e0');
    grad.addColorStop(1, '#202020');
    g.fillStyle = grad;
    g.fillRect(x, 0, 8, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 1);
  return t;
}

function shojiMaterial(intensity) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f4dcae';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#2a1a10';
  g.lineWidth = 5;
  for (let i = 0; i <= 256; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
  }
  for (let i = 0; i <= 256; i += 48) {
    g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
  }
  g.lineWidth = 14;
  g.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  return new THREE.MeshStandardMaterial({ map: t, emissive: '#ff9440', emissiveMap: t, emissiveIntensity: intensity, roughness: 0.9 });
}
