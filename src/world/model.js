import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { TEMPLE_MODEL } from '../config.js';

// Loads public/models/temple.glb if it exists, scales it to fit, and places it on the platform.
// Resolves to the model, or to null when there is no file (then the built-in temple stays).
export function loadTempleModel(onProgress) {
  const draco = new DRACOLoader().setDecoderPath('draco/');
  const loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);

  return new Promise((resolve) => {
    loader.load(
      TEMPLE_MODEL.url,
      (gltf) => {
        const model = gltf.scene;
        model.rotation.y = THREE.MathUtils.degToRad(TEMPLE_MODEL.rotationY);
        model.updateMatrixWorld(true);

        // Scale so the widest horizontal side matches TEMPLE_MODEL.size, then sit it on the ground
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const scale = TEMPLE_MODEL.size / Math.max(size.x, size.z);
        model.scale.setScalar(scale);
        model.updateMatrixWorld(true);
        box.setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const [px, py, pz] = TEMPLE_MODEL.position;
        model.position.x += px - center.x;
        model.position.z += pz - center.z;
        model.position.y += py - box.min.y;

        model.traverse((o) => {
          if (o.isMesh) {
            o.userData.action = 'hall';
            // AI-generated models often ship very shiny materials; tone them down for night lighting
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) if (m && 'roughness' in m) m.roughness = Math.max(m.roughness, 0.6);
          }
        });
        console.info('[temple] loaded', TEMPLE_MODEL.url, 'scale', scale.toFixed(3));
        resolve(model);
      },
      (e) => onProgress && e.total && onProgress(e.loaded / e.total),
      () => {
        console.info('[temple] no model at', TEMPLE_MODEL.url, '— using the built-in temple');
        resolve(null);
      }
    );
  });
}
