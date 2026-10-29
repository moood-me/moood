// The game's own sounds wait with the play as its music does (engines/1/volume.js: output, hold — told by
// play/runtime.js: the play paused, its scene standing or being made ready): held, each output fades out, then its
// AudioContext stands; going on, it runs again and fades back in to the "sounds" volume. A page of stand-ins: the
// contexts, the browser's own timers (__mooodTimers: a play's clock stands while it is paused), the time moved by hand.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const CODE = readFileSync(new URL('../engines/1/volume.js', import.meta.url), 'utf8');

// an AudioParam: set values and linear ramps, as the hold uses them
class Param {
  constructor(clock, v) { this.clock = clock; this.v = v; this.events = []; }
  at(t) {
    let v = this.v, from = 0;
    for (const e of this.events) {
      if (e.t > t) { if (e.ramp) v += (e.v - v) * (t - from) / (e.t - from); break; }
      v = e.v; from = e.t;
    }
    return v;
  }
  get value() { return this.at(this.clock.currentTime); }
  set value(v) { this.v = v; this.events = []; }
  cancelScheduledValues(t) { this.events = this.events.filter(e => e.t < t); }
  setValueAtTime(v, t) { this.events.push({ v, t }); }
  linearRampToValueAtTime(v, t) { this.events.push({ v, t, ramp: true }); }
  setTargetAtTime(v, t) { this.events.push({ v, t }); }
}

function page() {
  const timers = [], contexts = [], listeners = {};
  let ms = 0;
  class AudioContext {
    constructor() { this.state = 'suspended'; this.currentTime = 0; contexts.push(this); }
    async resume() { if (!page.untouched) this.state = 'running'; } // (untouched: the browser lets no sound begin yet)
    async suspend() { this.state = 'suspended'; }
    createGain() { return { gain: new Param(this, 1), connect() {}, disconnect() {} }; }
  }
  const g = vm.createContext({
    console,
    __mooodTimers: {
      setTimeout: (fn, wait) => timers.push({ fn, at: ms + wait }),
      clearTimeout: id => { if (timers[id - 1]) timers[id - 1].fn = null; },
    },
    localStorage: { getItem: () => null, setItem() {} },
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    MutationObserver: class { observe() {} },
    document: { readyState: 'complete', documentElement: {}, querySelectorAll: () => [], addEventListener() {} },
    MooodI18n: { part: () => s => s },
  });
  vm.runInContext('globalThis.window = globalThis;', g);
  vm.runInContext(`${CODE}\nglobalThis.MooodVolume = MooodVolume;`, g);
  const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r)); };
  return {
    volume: g.MooodVolume, settle,
    // a game's sounds: its context, through the "sounds" output
    sounds() { const ctx = new AudioContext(), out = g.MooodVolume.output(ctx); return { ctx, out }; },
    touch: () => (listeners.pointerdown || []).forEach(fn => fn({})),
    async wait(seconds) {
      for (let i = 0; i < Math.round(seconds * 100); i++) {
        ms += 10;
        for (const c of contexts) if (c.state === 'running') c.currentTime += 0.01;
        for (const t of timers) if (t.fn && t.at <= ms) { const fn = t.fn; t.fn = null; fn(); }
        await settle();
      }
    },
  };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.02, `${a} is not ${b}`);

test('held: the sounds fade out, then their clock stands; going on, they run and fade back in to the volume', async () => {
  const p = page(), s = p.sounds();
  await p.settle();
  assert.equal(s.ctx.state, 'running'); near(s.out.gain.value, 0.4);
  p.volume.hold(true);
  await p.wait(0.4);
  assert.equal(s.ctx.state, 'running'); assert.ok(s.out.gain.value > 0.1 && s.out.gain.value < 0.3, `fading: ${s.out.gain.value}`);
  await p.wait(0.6);
  assert.equal(s.ctx.state, 'suspended'); near(s.out.gain.value, 0);
  p.volume.hold(false);
  await p.settle();
  assert.equal(s.ctx.state, 'running');
  await p.wait(1);
  near(s.out.gain.value, 0.4);
});

test('going on while they fade out: their clock never stands, they fade back in from where they were', async () => {
  const p = page(), s = p.sounds();
  await p.settle();
  p.volume.hold(true);
  await p.wait(0.4);
  const was = s.out.gain.value;
  p.volume.hold(false);
  await p.wait(0.05);
  assert.ok(Math.abs(s.out.gain.value - was) < 0.05, `from ${was}: ${s.out.gain.value}`);
  await p.wait(1.5);
  assert.equal(s.ctx.state, 'running'); near(s.out.gain.value, 0.4);
});

test('sounds begun while held (a scene being made ready): silent, standing — and a touch does not start them', async () => {
  const p = page();
  p.volume.hold(true);
  const s = p.sounds();
  await p.settle();
  p.touch();
  await p.wait(1);
  assert.equal(s.ctx.state, 'suspended'); near(s.out.gain.value, 0);
  p.volume.hold(false);
  await p.wait(1);
  assert.equal(s.ctx.state, 'running'); near(s.out.gain.value, 0.4);
});

test('a context the browser held back is asked again at a touch', async () => {
  page.untouched = true;
  const p = page(), s = p.sounds();
  await p.settle();
  assert.equal(s.ctx.state, 'suspended');
  page.untouched = false; // (a touch: sound may begin)
  p.touch();
  await p.settle();
  assert.equal(s.ctx.state, 'running');
});
