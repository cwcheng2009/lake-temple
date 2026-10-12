import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { fbm } from '../util.js';

// Lake surface with real-time reflections.
// The ripple normal map is generated here, so no image file is needed.
export function createWater(moonDir) {
  const water = new Water(new THREE.PlaneGeometry(3000, 3000), {
    textureWidth: 1024,
    textureHeight: 1024,
    waterNormals: makeNormalMap(256),
    sunDirection: moonDir.clone().normalize(),
    sunColor: 0x9fb4d8,
    waterColor: 0x02070d,
    distortionScale: 0.9,
    alpha: 1,
    fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  water.material.uniforms.size.value = 3.2;
  water.userData.action = 'water';

  return {
    mesh: water,
    update(t) {
      water.material.uniforms.time.value = t * 0.35;
    },
  };
}

function makeNormalMap(size) {
  const P = 8; // noise period in cells, so the texture tiles seamlessly
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) h[y * size + x] = fbm((x / size) * P, (y / size) * P, 5, P);
  const data = new Uint8Array(size * size * 4);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  const k = 6.0;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * k;
      const dy = (at(x, y + 1) - at(x, y - 1)) * k;
      const n = new THREE.Vector3(-dx, -dy, 1).normalize();
      const i = (y * size + x) * 4;
      data[i] = (n.x * 0.5 + 0.5) * 255;
      data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
