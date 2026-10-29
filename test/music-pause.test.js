// The play paused — its ⏸, the phone turned upright, an engine 3 scene standing (the page hidden, out of sight): the
// scene's music fades out, then its sound stands; going on, it sounds again and fades back in to the volume set
// (engines/1/music.js on a page of stand-ins: its AudioContext, the stage's Moood.onPause, a play's clock).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const CODE = readFileSync(new URL('../engines/1/music.js', import.meta.url), 'utf8');

// an AudioParam: set values and linear ramps, as the music's pause uses them
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

// a page with music.js on it: its stage's Moood (stage.js's `const Moood` — a binding of the page's scripts, not a
// property of globalThis), a play's clock (its timers stand while the play is paused; __mooodTimers: the browser's
// own); the time moved by hand
function page() {
  const pausing = [], timers = [];
  let ms = 0, ctx = null;
  class AudioContext {
    constructor() { ctx = this; this.state = 'suspended'; this.currentTime = 0; this.destination = {}; this.gains = []; }
    async resume() { this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
    createGain() { const g = { gain: new Param(this, 1), connect() {}, disconnect() {} }; this.gains.push(g); return g; }
  }
  const g = vm.createContext({
    AudioContext, console,
    __mooodTimers: {
      setTimeout: (fn, wait) => timers.push({ fn, at: ms + wait }),
      clearTimeout: id => { if (timers[id - 1]) timers[id - 1].fn = null; },
    },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    addEventListener() {}, removeEventListener() {},
    MooodI18n: { part: () => s => s }, MooodVolume: { get: () => 0.4, on() {} },
    pausing,
  });
  vm.runInContext('globalThis.window = globalThis; const Moood = { onPause: fn => { pausing.push(fn); } };', g);
  vm.runInContext(CODE, g);
  const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r)); };
  return {
    music: g.MooodMusic, settle,
    // an engine 3 scene stands or goes on (the stage's onPause, of every stage of the page)
    stands: on => pausing.forEach(fn => fn(on)),
    // the time going on: the sound's clock while it runs, the browser's timers
    async wait(seconds) {
      for (let i = 0; i < Math.round(seconds * 100); i++) {
        ms += 10;
        if (ctx.state === 'running') ctx.currentTime += 0.01;
        for (const t of timers) if (t.fn && t.at <= ms) { const fn = t.fn; t.fn = null; fn(); }
        await settle();
      }
    },
    get state() { return ctx?.state; },
    get level() { return ctx.gains[0].gain.value; }, // (the music's output: its first gain)
  };
}
async function playing() {
  const p = page();
  p.music.init({ track: async () => 'k', listen: () => new Promise(() => {}), silent: () => {} });
  await p.settle();
  await p.wait(1);
  return p;
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.02, `${a} is not ${b}`);

test('paused: the music fades out, then its sound stands; going on, it sounds and fades back in to the volume', async () => {
  const p = await playing();
  assert.equal(p.state, 'running'); near(p.level, 0.4);
  p.music.pause(true);
  await p.wait(0.4);
  assert.equal(p.state, 'running'); assert.ok(p.level > 0.1 && p.level < 0.3, `fading: ${p.level}`);
  await p.wait(0.6);
  assert.equal(p.state, 'suspended'); near(p.level, 0);
  p.music.pause(false);
  await p.settle();
  assert.equal(p.state, 'running');
  await p.wait(1);
  near(p.level, 0.4);
});

test('an engine 3 scene standing (the stage\'s Moood.onPause) holds the music the same way', async () => {
  const p = await playing();
  p.stands(true);
  await p.wait(1);
  assert.equal(p.state, 'suspended'); near(p.level, 0);
  p.stands(false);
  await p.wait(1);
  assert.equal(p.state, 'running'); near(p.level, 0.4);
});

test('going on while it fades out: its sound never stands, it fades back in from where it was', async () => {
  const p = await playing();
  p.music.pause(true);
  await p.wait(0.4);
  const was = p.level;
  p.music.pause(false);
  await p.wait(0.05);
  assert.ok(Math.abs(p.level - was) < 0.05, `from ${was}: ${p.level}`);
  await p.wait(1.5);
  assert.equal(p.state, 'running'); near(p.level, 0.4);
});

test('paused as the music begins: it begins standing, silent, and sounds as the play goes on', async () => {
  const p = page();
  p.music.init({ track: async () => 'k', listen: () => new Promise(() => {}), silent: () => {} });
  p.stands(true); // (as its context is asked to sound, before it does)
  await p.wait(1);
  assert.equal(p.state, 'suspended'); near(p.level, 0);
  p.stands(false);
  await p.wait(1);
  assert.equal(p.state, 'running'); near(p.level, 0.4);
});
