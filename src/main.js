import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { MOON_DIRECTION, TEMPLE_MODEL, MIX } from './config.js';
import { createSky } from './world/sky.js';
import { createWater } from './world/water.js';
import { createLandscape, zShore, heightAt } from './world/landscape.js';
import { createTemple } from './world/temple.js';
import { createAtmosphere } from './world/atmosphere.js';
import { loadTempleModel } from './world/model.js';
import { Soundscape } from './audio/soundscape.js';
import './style.css';

// ── Renderer, scene, camera ─────────────────────────────────
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#0d1828', 0.0085);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 4000);
const fitFov = () => (camera.fov = camera.aspect < 1 ? 70 : 48); // wider view on portrait phones
fitFov();
camera.updateProjectionMatrix();
camera.position.set(0, 9, 95);

const moonDir = new THREE.Vector3(...MOON_DIRECTION).normalize();

// ── World ───────────────────────────────────────────────────
const sky = createSky(moonDir);
const water = createWater(moonDir);
const land = createLandscape();
const temple = createTemple();
const atmos = createAtmosphere(land.cherries);
scene.add(sky.group, water.mesh, land.group, temple.group, atmos.group);

scene.add(new THREE.HemisphereLight('#3a4f78', '#0b0f14', 0.55));
const moonLight = new THREE.DirectionalLight('#9db4e0', 0.9);
moonLight.position.copy(moonDir).multiplyScalar(100);
scene.add(moonLight);

// Your own model (public/models/temple.glb), if present
loadTempleModel().then((model) => {
  if (!model) return;
  scene.add(model);
  if (TEMPLE_MODEL.hideBuiltInHall) temple.hall.visible = false;
  model.traverse((o) => o.isMesh && clickables.push(o));
});

// ── Post-processing: bloom makes lanterns and the moon glow ──
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.55, 0.8);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ── Camera controls ─────────────────────────────────────────
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 5, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;
controls.minDistance = 12;
controls.maxDistance = 110;
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = 1.5;
controls.minAzimuthAngle = -1.35;
controls.maxAzimuthAngle = 1.35;
controls.rotateSpeed = 0.5;
controls.zoomSpeed = 0.7;
controls.autoRotateSpeed = 0.25;
controls.enabled = false;
let lastInteract = performance.now();
controls.addEventListener('start', () => {
  lastInteract = performance.now();
  controls.autoRotate = false;
  intro = null;
});

// ── Sound ───────────────────────────────────────────────────
const trees = land.trees;
const nearestTree = (x, z) => trees.reduce((a, b) => (Math.hypot(b.x - x, b.z - z) < Math.hypot(a.x - x, a.z - z) ? b : a));
const treePos = (t) => new THREE.Vector3(t.x, t.y + 4, t.z);
const shorePt = (x, dz = 0, dy = 0.2) => {
  const z = zShore(x) + dz;
  return new THREE.Vector3(x, Math.max(heightAt(x, z), 0) + dy, z);
};
const sound = new Soundscape(camera, scene, {
  bell: temple.bellWorld,
  hall: temple.hallCenter,
  chimes: temple.chimePositions,
  lapping: [
    new THREE.Vector3(-15, 0.2, 11), new THREE.Vector3(15, 0.2, 11),
    new THREE.Vector3(-15, 0.2, -11), new THREE.Vector3(15, 0.2, -11),
    shorePt(-30, 1), shorePt(32, 1), new THREE.Vector3(0, 0.2, 30),
  ],
  trees: [treePos(nearestTree(-30, -35)), treePos(nearestTree(30, -35))],
  crickets: [-55, -38, -22, -9, 8, 21, 37, 54].map((x) => shorePt(x, -4, 0.4)),
  frogs: [-40, -14, 19, 46].map((x) => shorePt(x, 1.2, 0.1)),
  owls: [treePos(nearestTree(-70, -70)), treePos(nearestTree(60, -75))],
});
sound.onBellStrike = (vel) => temple.strikeBell(vel);
sound.onBell = (vel) => {
  temple.onBellSound(vel);
  atmos.ripple(temple.bellWorld, { color: '#ffb46a', size: 70, duration: 7, rings: 3 });
};

// ── Clicking things in the scene ────────────────────────────
const clickables = [...temple.clickables, water.mesh];
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function hit(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObjects(clickables, false)[0];
}
let downAt = null;
canvas.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || !entered) return;
  const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
  downAt = null;
  if (moved > 6) return;
  const h = hit(e);
  if (!h) return;
  const action = h.object.userData.action;
  if (action === 'bell') sound.strikeBell(1);
  else if (action === 'lantern') {
    sound.ringAt(h.point);
  } else if (action === 'hall') sound.swellChant();
  else if (action === 'water') {
    sound.dropAt(h.point);
    atmos.ripple(h.point, { size: 8, duration: 3.2 });
  }
});
let hoverCheck = 0;
canvas.addEventListener('pointermove', (e) => {
  if (!entered || performance.now() - hoverCheck < 80) return;
  hoverCheck = performance.now();
  const h = hit(e);
  const a = h && h.object.userData.action;
  canvas.style.cursor = a && a !== 'water' ? 'pointer' : '';
});

// ── UI ──────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
let entered = false;
let intro = null;

$('enter').addEventListener('click', async () => {
  $('intro').classList.add('gone');
  document.body.classList.add('entered');
  entered = true;
  lastInteract = performance.now();
  controls.enabled = true;
  intro = { from: camera.position.clone(), to: new THREE.Vector3(28, 12, 46), t: 0, dur: 7 };
  await sound.start();
  setTimeout(() => $('hint').classList.add('gone'), 14000);
});

$('mute').addEventListener('click', () => toggleMute());
function toggleMute() {
  sound.setMuted(!sound.muted);
  $('mute').textContent = sound.muted ? 'Sound off' : 'Sound on';
  $('mute').setAttribute('aria-pressed', String(!sound.muted));
}
$('mixToggle').addEventListener('click', () => $('mixer').classList.toggle('open'));

const LABELS = { lake: 'Lake water', wind: 'Wind', chimes: 'Wind chimes', creatures: 'Crickets & frogs', owl: 'Owl', bell: 'Temple bell', chant: 'Chant', reverb: 'Reverb' };
for (const key of Object.keys(MIX)) {
  const row = document.createElement('label');
  row.className = 'mixrow';
  row.innerHTML = `<span>${LABELS[key]}</span><input type="range" min="0" max="1" step="0.01" value="${MIX[key]}">`;
  row.querySelector('input').addEventListener('input', (e) => sound.setVolume(key, +e.target.value));
  $('mixRows').append(row);
}

addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'm' || e.key === 'M') toggleMute();
  if ((e.key === 'b' || e.key === 'B') && entered) sound.strikeBell(1);
  if (e.key === 'h' || e.key === 'H') document.body.classList.toggle('clean');
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  fitFov();
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ── Main loop ───────────────────────────────────────────────
const clock = new THREE.Clock();
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
function frame() {
  requestAnimationFrame(frame);
  if (!innerWidth || !innerHeight) return; // hidden or zero-size window
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (!entered) {
    // slow drift behind the title screen
    camera.position.set(Math.sin(t * 0.05) * 12, 11 + Math.sin(t * 0.1), 95);
    camera.lookAt(controls.target);
  } else if (intro) {
    intro.t += dt / intro.dur;
    const k = ease(Math.min(intro.t, 1));
    camera.position.lerpVectors(intro.from, intro.to, k);
    camera.position.y += Math.sin(k * Math.PI) * 6;
    camera.lookAt(controls.target);
    if (intro.t >= 1) intro = null;
  } else {
    if (performance.now() - lastInteract > 20000) controls.autoRotate = true;
    const az = controls.getAzimuthalAngle();
    if (az > controls.maxAzimuthAngle - 0.02) controls.autoRotateSpeed = Math.abs(controls.autoRotateSpeed);
    if (az < controls.minAzimuthAngle + 0.02) controls.autoRotateSpeed = -Math.abs(controls.autoRotateSpeed);
    controls.update();
    const floor = Math.max(heightAt(camera.position.x, camera.position.z), 0) + 1.5;
    if (camera.position.y < floor) camera.position.y = floor;
  }

  const wind = sound.started ? sound.gust() : 0.5;
  sky.update(t);
  water.update(t);
  atmos.update(dt, t, wind);
  const pulse = temple.update(dt, t, sound.chantLevel());
  bloom.strength = 0.8 + pulse * 0.35;

  composer.render();
}
frame();
