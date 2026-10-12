import * as THREE from 'three';
import { MIX, BELL_INTERVAL } from '../config.js';

// Every sound here is synthesised live with the Web Audio API, so no audio files are needed.
// Each source sits at a 3D position: move the camera and you hear it move around you.
//
// Layers (mixer channels): lake, wind, chimes, creatures, owl, bell, chant (+ reverb amount)

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Soundscape {
  constructor(camera, scene, places) {
    this.camera = camera;
    this.scene = scene;
    this.places = places; // positions from the world (bell, chimes, shore, ...)
    this.layers = {};
    this.volume = { ...MIX };
    this.started = false;
    this.muted = false;
    this.onBell = null; // callback(vel) when the bell sound actually starts
  }

  async start() {
    if (this.started) return;
    this.started = true;
    const listener = (this.listener = new THREE.AudioListener());
    this.camera.add(listener);
    const ctx = (this.ctx = listener.context);
    await ctx.resume();

    // Master chain: listener → bus → (dry + reverb) → compressor → speakers
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.connect(ctx.destination);
    this.bus = ctx.createGain();
    listener.gain.disconnect();
    listener.gain.connect(this.bus);
    this.bus.connect(comp);
    const verb = ctx.createConvolver();
    verb.buffer = impulse(ctx, 4.5, 2.4);
    this.wet = ctx.createGain();
    this.wet.gain.value = this.volume.reverb;
    this.bus.connect(verb);
    verb.connect(this.wet);
    this.wet.connect(comp);

    this.noise = noiseBuffer(ctx, 6);
    const now = ctx.currentTime;

    this.#lake(now);
    this.#wind(now);
    this.#chimes(now);
    this.#creatures(now);
    this.#owl(now);
    this.#bell(now);
    this.#chant(now);

    // fade in
    listener.gain.gain.setValueAtTime(0, now);
    listener.gain.gain.linearRampToValueAtTime(1, now + 4);

    // Scheduler: plan events slightly ahead of time for sample-accurate timing
    this.timer = setInterval(() => this.#tick(), 120);
    this.#tick();
  }

  // ── Public controls ─────────────────────────────────────
  setVolume(layer, v) {
    this.volume[layer] = v;
    if (!this.started) return;
    if (layer === 'reverb') return this.wet.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
    for (const a of this.layers[layer] || []) a.setVolume(v);
  }
  setMuted(m) {
    this.muted = m;
    if (!this.started) return;
    this.listener.gain.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.25);
  }
  strikeBell(vel = 1) {
    if (this.started) this.bellStrike(this.ctx.currentTime + 0.32, vel);
  }
  ringAt(pos) {
    if (!this.started) return;
    const s = this.ringPool[(this.ringIdx = (this.ringIdx + 1) % this.ringPool.length)];
    s.pa.position.copy(pos);
    const t = this.ctx.currentTime + 0.02;
    const f = pick([784, 880, 1046.5, 1174.7, 1318.5, 1568]);
    chime(this.ctx, s.input, t, f, 0.5, 2.4);
    chime(this.ctx, s.input, t + 0.12, f * 1.5, 0.25, 2);
  }
  dropAt(pos) {
    if (!this.started) return;
    const s = this.dropPool[(this.dropIdx = (this.dropIdx + 1) % this.dropPool.length)];
    s.pa.position.copy(pos);
    const t = this.ctx.currentTime + 0.01;
    drop(this.ctx, s.input, t, rand(500, 800), 0.6);
    drop(this.ctx, s.input, t + rand(0.1, 0.2), rand(900, 1300), 0.25);
    this.#splash(s.input, t, 0.2);
  }
  swellChant() {
    if (this.started) this.chantPhrase(this.ctx.currentTime + 0.05, 1.4);
  }
  chantLevel() {
    if (!this.started) return 0;
    this.chantAnalyser.getFloatTimeDomainData(this.chantBuf);
    let s = 0;
    for (const v of this.chantBuf) s += v * v;
    return Math.min(1, Math.sqrt(s / this.chantBuf.length) * 6);
  }
  gust(t = this.ctx ? this.ctx.currentTime : performance.now() / 1000) {
    const g = 0.45 + 0.35 * Math.sin(t * 0.09) * Math.sin(t * 0.037 + 1.3) + 0.22 * Math.sin(t * 0.23 + 0.5) * Math.sin(t * 0.051);
    return Math.min(1, Math.max(0, g));
  }

  // ── Plumbing ────────────────────────────────────────────
  // Creates an input node that plays from `pos` (or everywhere if pos is null).
  #source(layer, pos, ref = 8, rolloff = 1) {
    const input = this.ctx.createGain();
    let a;
    if (pos) {
      a = new THREE.PositionalAudio(this.listener);
      a.panner.panningModel = 'HRTF';
      a.setDistanceModel('inverse');
      a.setRefDistance(ref);
      a.setRolloffFactor(rolloff);
      a.setMaxDistance(10000);
      a.position.copy(pos);
      this.scene.add(a);
    } else {
      a = new THREE.Audio(this.listener);
    }
    a.setNodeSource(input);
    a.setVolume(this.volume[layer]);
    (this.layers[layer] ||= []).push(a);
    return { input, pa: a };
  }
  #noiseSrc(t) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.start(t, rand(0, 5));
    return s;
  }
  #tick() {
    const now = this.ctx.currentTime;
    const until = now + 1.5;
    for (const fn of this.tasks) fn(now, until);
  }
  get tasks() {
    return (this._tasks ||= []);
  }

  // ── Lake: constant soft wash + lapping at the platform and shore ──
  #lake(t0) {
    const ctx = this.ctx;
    const wash = this.#source('lake', null);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 280;
    const g = ctx.createGain();
    g.gain.value = 0.16;
    this.#noiseSrc(t0).connect(lp).connect(g).connect(wash.input);

    const laps = this.places.lapping.map((pos) => {
      const s = this.#source('lake', pos, 6);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 600;
      f.Q.value = 0.8;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 140;
      const env = ctx.createGain();
      env.gain.value = 0.02;
      this.#noiseSrc(t0).connect(f).connect(hp).connect(env).connect(s.input);
      return { f, env, next: t0 + rand(0, 2) };
    });
    this.tasks.push((now, until) => {
      for (const L of laps) {
        if (L.next < now) L.next = now + 0.05;
        while (L.next < until) {
          const t = L.next;
          L.env.gain.setTargetAtTime(rand(0.25, 0.6), t, 0.1);
          L.env.gain.setTargetAtTime(0.02, t + rand(0.2, 0.45), rand(0.35, 0.7));
          L.f.frequency.setTargetAtTime(rand(380, 1100), t, 0.08);
          L.f.frequency.setTargetAtTime(300, t + 0.3, 0.4);
          L.next += rand(0.9, 3.0);
        }
      }
    });
    this.dropPool = [0, 1, 2, 3].map(() => this.#source('lake', new THREE.Vector3(), 6));
    this.dropIdx = 0;
  }
  #splash(dest, t, amp) {
    const ctx = this.ctx;
    const n = this.#noiseSrc(t);
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 2500;
    hp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.setTargetAtTime(0, t + 0.01, 0.06);
    n.connect(hp).connect(g).connect(dest);
    n.stop(t + 0.6);
  }

  // ── Wind: broad gusts everywhere, leaf rustle in the trees ──
  #wind(t0) {
    const ctx = this.ctx;
    const s = this.#source('wind', null);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0;
    const pan = ctx.createStereoPanner();
    this.#noiseSrc(t0).connect(bp).connect(g).connect(pan).connect(s.input);

    const rustles = this.places.trees.map((pos) => {
      const r = this.#source('wind', pos, 12);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2200;
      const rg = ctx.createGain();
      rg.gain.value = 0;
      this.#noiseSrc(t0).connect(hp).connect(rg).connect(r.input);
      return rg;
    });
    let next = t0;
    this.tasks.push((now, until) => {
      if (next < now) next = now;
      while (next < until) {
        const gu = this.gust(next);
        bp.frequency.setTargetAtTime(220 + gu * 650, next, 0.6);
        g.gain.setTargetAtTime(0.04 + gu * gu * 0.5, next, 0.6);
        pan.pan.setTargetAtTime(Math.sin(next * 0.13) * 0.6, next, 1);
        for (const rg of rustles) rg.gain.setTargetAtTime(Math.max(0, gu - 0.35) * 0.35 * rand(0.6, 1.4), next, 0.25);
        next += 0.5;
      }
    });
  }

  // ── Wind chimes at the roof corners; they ring more when the wind gusts ──
  #chimes(t0) {
    const srcs = this.places.chimes.map((pos) => this.#source('chimes', pos, 5));
    const scale = [1046.5, 1174.7, 1396.9, 1568, 1760, 2093, 2349.3];
    let next = t0 + 2;
    this.tasks.push((now, until) => {
      if (next < now) next = now;
      while (next < until) {
        const gu = this.gust(next);
        if (Math.random() < 0.015 + gu * gu * 0.2) {
          const s = pick(srcs);
          const n = 1 + Math.floor(Math.random() * (1 + gu * 4));
          let t = next;
          for (let i = 0; i < n; i++) {
            chime(this.ctx, s.input, t, pick(scale), rand(0.08, 0.2) * (0.5 + gu), rand(2.5, 4));
            t += rand(0.08, 0.45);
          }
        }
        next += 0.25;
      }
    });
    this.ringPool = [0, 1, 2].map(() => this.#source('chimes', new THREE.Vector3(), 6));
    this.ringIdx = 0;
  }

  // ── Crickets along the shore and frogs at the water's edge ──
  #creatures(t0) {
    const ctx = this.ctx;
    const crickets = this.places.crickets.map((pos, i) => {
      const s = this.#source('creatures', pos, 4);
      const o = ctx.createOscillator();
      o.frequency.value = rand(3900, 4900);
      const env = ctx.createGain();
      env.gain.value = 0;
      o.connect(env).connect(s.input);
      o.start(t0);
      return { env, next: t0 + rand(0, 2) + i * 0.1, period: rand(0.45, 0.85), pulses: 3 + (i % 3), amp: rand(0.05, 0.1) };
    });
    const frogs = this.places.frogs.map((pos) => {
      const s = this.#source('creatures', pos, 6);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const base = rand(85, 150);
      o.frequency.value = base;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = rand(450, 750);
      bp.Q.value = 3;
      const env = ctx.createGain();
      env.gain.value = 0;
      o.connect(bp).connect(env).connect(s.input);
      o.start(t0);
      return { o, env, base, next: t0 + rand(1, 6) };
    });
    this.tasks.push((now, until) => {
      for (const c of crickets) {
        if (c.next < now) c.next = now + 0.05;
        while (c.next < until) {
          let t = c.next;
          for (let p = 0; p < c.pulses; p++) {
            c.env.gain.setValueAtTime(0, t);
            c.env.gain.linearRampToValueAtTime(c.amp, t + 0.004);
            c.env.gain.setValueAtTime(c.amp, t + 0.013);
            c.env.gain.linearRampToValueAtTime(0, t + 0.018);
            t += 0.036;
          }
          c.next += c.period * rand(0.95, 1.05) + (Math.random() < 0.04 ? rand(2, 9) : 0);
        }
      }
      for (const f of frogs) {
        if (f.next < now) f.next = now + 0.05;
        while (f.next < until) {
          let t = f.next;
          const n = 1 + Math.floor(Math.random() * 3);
          for (let k = 0; k < n; k++) {
            f.o.frequency.setValueAtTime(f.base * 1.12, t);
            f.o.frequency.exponentialRampToValueAtTime(f.base * 0.88, t + 0.11);
            f.env.gain.setValueAtTime(0, t);
            f.env.gain.linearRampToValueAtTime(0.22, t + 0.015);
            f.env.gain.setTargetAtTime(0, t + 0.08, 0.02);
            t += 0.2;
          }
          f.next = t + rand(2.5, 9);
        }
      }
    });
  }

  // ── An owl somewhere in the trees, now and then ──
  #owl(t0) {
    const ctx = this.ctx;
    const owls = this.places.owls.map((pos) => {
      const s = this.#source('owl', pos, 18);
      const o = ctx.createOscillator();
      o.frequency.value = 360;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      const env = ctx.createGain();
      env.gain.value = 0;
      o.connect(lp).connect(env).connect(s.input);
      o.start(t0);
      return { o, env };
    });
    let next = t0 + rand(12, 25);
    this.tasks.push((now, until) => {
      if (next < now) next = now + 0.1;
      while (next < until) {
        const w = pick(owls);
        const f = rand(330, 390);
        const notes = [[0, 0.45], [0.95, 0.18], [1.25, 0.25], [1.9, 0.75]];
        for (const [dt, dur] of notes) {
          const t = next + dt;
          w.o.frequency.setValueAtTime(f * 1.04, t);
          w.o.frequency.linearRampToValueAtTime(f * 0.94, t + dur);
          w.env.gain.setValueAtTime(0, t);
          w.env.gain.linearRampToValueAtTime(0.32, t + 0.06);
          w.env.gain.setTargetAtTime(0, t + dur - 0.05, 0.05);
        }
        next += rand(25, 70);
      }
    });
  }

  // ── Temple bell (bonshō): long, beating, inharmonic partials ──
  #bell(t0) {
    const ctx = this.ctx;
    const s = this.#source('bell', this.places.bell, 30, 0.6);
    const partials = [
      [0.5, 0.5, 30], [1, 0.9, 24], [1.19, 0.4, 15], [1.51, 0.38, 12], [2.0, 0.3, 9],
      [2.51, 0.2, 6.5], [2.66, 0.16, 5], [3.01, 0.12, 4], [4.13, 0.08, 3], [5.42, 0.05, 2],
    ];
    this.bellStrike = (t, vel = 1) => {
      const f0 = 98;
      for (const [r, a, d] of partials) {
        for (const beat of [0, rand(0.35, 1.4)]) {
          const o = ctx.createOscillator();
          o.frequency.value = f0 * r + beat;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(a * vel * 0.12, t + 0.006);
          g.gain.setTargetAtTime(0, t + 0.01, d / 4.5);
          o.connect(g).connect(s.input);
          o.start(t);
          o.stop(t + d + 2);
        }
      }
      // wooden striker thump
      const n = this.#noiseSrc(t);
      const bp = ctx.createBiquadFilter();
      bp.type = 'lowpass';
      bp.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5 * vel, t);
      g.gain.setTargetAtTime(0, t + 0.005, 0.03);
      n.connect(bp).connect(g).connect(s.input);
      n.stop(t + 0.5);
      const delay = Math.max(0, (t - ctx.currentTime) * 1000);
      setTimeout(() => this.onBell && this.onBell(vel), delay);
      if (this.onBellStrike) setTimeout(() => this.onBellStrike(vel), Math.max(0, delay - 320));
    };
    let next = t0 + 6;
    this.tasks.push((now, until) => {
      if (next < now) next = now + 0.5;
      while (next < until) {
        this.bellStrike(next, rand(0.75, 1));
        next += rand(BELL_INTERVAL[0], BELL_INTERVAL[1]);
      }
    });
  }

  // ── Chant drone from inside the hall: slow "Om" phrases ──
  #chant(t0) {
    const ctx = this.ctx;
    const s = this.#source('chant', this.places.hall, 7);
    const mix = ctx.createGain();
    mix.gain.value = 0.25;
    for (const [f, type, lvl] of [[73.42, 'sawtooth', 1], [73.6, 'sawtooth', 0.8], [110, 'sawtooth', 0.35], [36.71, 'sine', 1.5]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = lvl;
      o.connect(g).connect(mix);
      o.start(t0);
    }
    const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter();
    for (const f of [f1, f2]) {
      f.type = 'bandpass';
      f.Q.value = 6;
    }
    f1.frequency.value = 570;
    f2.frequency.value = 840;
    const sum = ctx.createGain();
    mix.connect(f1).connect(sum);
    mix.connect(f2).connect(sum);
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 220;
    mix.connect(low).connect(sum);
    const env = ctx.createGain();
    env.gain.value = 0;
    sum.connect(env).connect(s.input);
    this.chantAnalyser = ctx.createAnalyser();
    this.chantAnalyser.fftSize = 512;
    this.chantBuf = new Float32Array(512);
    env.connect(this.chantAnalyser);

    let busyUntil = 0;
    this.chantPhrase = (t, amp = 1) => {
      if (t < busyUntil - 1) return;
      const hold = rand(4, 7);
      // "O" opening to "M" hum
      f1.frequency.setTargetAtTime(570, t, 0.3);
      f2.frequency.setTargetAtTime(840, t, 0.3);
      f1.frequency.setTargetAtTime(300, t + hold * 0.6, 0.8);
      f2.frequency.setTargetAtTime(700, t + hold * 0.6, 0.8);
      env.gain.cancelScheduledValues(t);
      env.gain.setTargetAtTime(0.5 * amp, t, 1.2);
      env.gain.setTargetAtTime(0, t + hold, 1.8);
      busyUntil = t + hold + 4;
    };
    let next = t0 + 3;
    this.tasks.push((now, until) => {
      if (next < now) next = now + 0.2;
      while (next < until) {
        this.chantPhrase(next, rand(0.7, 1));
        next = Math.max(next + rand(13, 22), busyUntil + rand(2, 6));
      }
    });
  }
}

// ── Small synth building blocks ────────────────────────────
function chime(ctx, dest, t, f, amp, decay) {
  for (const [r, a, d] of [[1, 1, 1], [2.76, 0.35, 0.45], [5.4, 0.12, 0.2], [8.93, 0.05, 0.1]]) {
    const o = ctx.createOscillator();
    o.frequency.value = f * r;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp * a, t + 0.003);
    g.gain.setTargetAtTime(0, t + 0.004, (decay * d) / 4);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + decay * d + 0.5);
  }
}

function drop(ctx, dest, t, f, amp) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.06);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + 0.004);
  g.gain.setTargetAtTime(0, t + 0.01, 0.03);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.4);
}

function noiseBuffer(ctx, seconds) {
  const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

// Synthetic reverb tail: decaying noise that darkens over time
function impulse(ctx, seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const x = i / len;
      const k = 0.6 - 0.55 * x; // more smoothing (darker) later in the tail
      lp += (Math.random() * 2 - 1 - lp) * k;
      d[i] = lp * Math.pow(1 - x, decay) * (i < ctx.sampleRate * 0.02 ? i / (ctx.sampleRate * 0.02) : 1);
    }
  }
  return b;
}
