// The play paused — its ⏸, the phone turned upright, an engine 3 scene standing (the page hidden, out of sight): the
// scene's music fades out, then its sound stands; going on, it sounds again and fades back in to the volume set
// — and the page's other sounds (a game's own: volume.js output) with it, in the same fade (engines/1/music.js and
// volume.js on a page of stand-ins: their AudioContexts, the stage's Moood.onPause, a play's clock).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const CODE = readFileSync(new URL('../engines/1/music.js', import.meta.url), 'utf8');
const VOLUME = readFileSync(new URL('../engines/1/volume.js', import.meta.url), 'utf8');

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
  const pausing = [], timers = [], contexts = [];
  let ms = 0;
  class AudioContext {
    constructor() { contexts.push(this); this.state = 'suspended'; this.currentTime = 0; this.destination = {}; this.gains = []; }
    async resume() { this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
    createGain() { const g = { gain: new Param(this, 1), connect() {}, disconnect() {} }; this.gains.push(g); return g; }
  }
  const g = vm.createContext({
    AudioContext, AbortController, console,
    __mooodTimers: {
      setTimeout: (fn, wait) => timers.push({ fn, at: ms + wait }),
      clearTimeout: id => { if (timers[id - 1]) timers[id - 1].fn = null; },
    },
    // (the browser's timers too, on the same hand-moved time: a show's music pushed 200 ms after it)
    setTimeout: (fn, wait) => timers.push({ fn, at: ms + wait }),
    clearTimeout: id => { if (timers[id - 1]) timers[id - 1].fn = null; },
    setInterval: () => 0, clearInterval() {},
    addEventListener() {}, removeEventListener() {},
    MooodI18n: { part: () => s => s },
    localStorage: { getItem: () => null, setItem() {} },
    MutationObserver: class { observe() {} },
    document: { readyState: 'complete', documentElement: {}, querySelectorAll: () => [], addEventListener() {} },
    pausing,
  });
  vm.runInContext('globalThis.window = globalThis; const Moood = { onPause: fn => { pausing.push(fn); } };', g);
  vm.runInContext(`${VOLUME}\nglobalThis.MooodVolume = MooodVolume;`, g);
  vm.runInContext(CODE, g);
  const ctx = () => contexts[0]; // (the music's: made as it is begun)
  const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r)); };
  return {
    music: g.MooodMusic, settle,
    // an engine 3 scene stands or goes on (the stage's onPause, of every stage of the page)
    stands: on => pausing.forEach(fn => fn(on)),
    // the time going on: the sound's clock while it runs, the browser's timers
    async wait(seconds) {
      for (let i = 0; i < Math.round(seconds * 100); i++) {
        ms += 10;
        for (const c of contexts) if (c.state === 'running') c.currentTime += 0.01;
        for (const t of timers) if (t.fn && t.at <= ms) { const fn = t.fn; t.fn = null; fn(); }
        await settle();
      }
    },
    get state() { return ctx()?.state; },
    get level() { return ctx().gains[0].gain.value; }, // (the music's output: its first gain)
    deck: n => ctx().gains[n].gain.value, // (the n-th music heard: its deck's gain — the game's level, bespoke.music)
    // a game's sounds: its own context, through the "sounds" output
    sounds() { const c = new AudioContext(), out = g.MooodVolume.output(c); return { ctx: c, out }; },
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

test('the game\'s sounds wait with the music: one fade out, both standing, one fade back in', async () => {
  const p = await playing(), s = p.sounds();
  await p.settle();
  assert.equal(s.ctx.state, 'running'); near(s.out.gain.value, 0.4);
  p.music.pause(true);
  await p.wait(0.4);
  near(s.out.gain.value, p.level); assert.ok(p.level > 0.1 && p.level < 0.3, `fading: ${p.level}`);
  await p.wait(0.6);
  assert.equal(s.ctx.state, 'suspended'); assert.equal(p.state, 'suspended'); near(s.out.gain.value, 0);
  p.stands(false); // (going on: the stage's — an engine 3 scene — as the ⏸'s)
  await p.wait(0.4);
  assert.equal(s.ctx.state, 'running'); near(s.out.gain.value, p.level);
  await p.wait(0.6);
  near(s.out.gain.value, 0.4); near(p.level, 0.4);
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

// a game hushing the scene's music (bespoke.music → MooodMusic.level): the open scene's deck, under the volume and the
// pause; a show heard at 1 again
const A = { prompts: [{ text: 'a waltz', weight: 1 }] }, B = { prompts: [{ text: 'a clock', weight: 1 }] };
async function scored(before = () => {}) {
  const p = page();
  p.music.show(A);
  before(p);
  p.music.init({ track: async () => 'k', listen: () => new Promise(() => {}), silent: () => {} });
  await p.settle();
  await p.wait(1);
  return p;
}

test("the game's level: moved to 0 over the seconds said, the volume kept; 0 seconds — at once", async () => {
  const p = await scored();
  near(p.deck(1), 1);
  p.music.level(0, 1);
  await p.wait(0.5);
  near(p.deck(1), 0.5); near(p.level, 0.4);
  await p.wait(0.6);
  near(p.deck(1), 0); near(p.level, 0.4);
  p.music.level(1, 0);
  await p.wait(0.01);
  near(p.deck(1), 1);
});

test("without seconds, over the music's crossfade; out of range, kept within 0…1", async () => {
  const p = await scored();
  p.music.level(0);
  await p.wait(p.music.FADE / 2);
  near(p.deck(1), 0.5);
  await p.wait(p.music.FADE / 2 + 0.1);
  near(p.deck(1), 0);
  p.music.level(7, 0);
  await p.wait(0.01);
  near(p.deck(1), 1);
});

test('said before the music has begun: it comes in at that level', async () => {
  const p = await scored(p => p.music.level(0.25, 2));
  near(p.deck(1), 0.25);
});

test("a pause meanwhile holds the move where it is; going on, it goes on — and the pause's fade is its own", async () => {
  const p = await scored();
  p.music.level(0, 4);
  await p.wait(1);
  p.music.pause(true);
  await p.wait(1); // (the music's fade out, then its sound stands)
  assert.equal(p.state, 'suspended'); near(p.level, 0);
  const held = p.deck(1);
  assert.ok(held > 0.4 && held < 0.6, `moved on during the fade out only: ${held}`);
  await p.wait(2);
  near(p.deck(1), held);
  p.music.pause(false);
  await p.settle();
  await p.wait(2.5);
  near(p.deck(1), 0); near(p.level, 0.4);
});

test('the next scene shown is heard at 1: the same music comes back over the crossfade, another comes in at 1', async () => {
  const p = await scored();
  p.music.level(0, 0);
  await p.wait(0.1);
  p.music.show(A); // (the same music: going on)
  await p.wait(p.music.FADE + 0.3);
  near(p.deck(1), 1);
  p.music.level(0, 0);
  await p.wait(0.1);
  p.music.show(B); // (another: the hushed one fades out from where it is, the new one in to 1)
  await p.wait(p.music.FADE + 0.3);
  near(p.deck(1), 0); near(p.deck(2), 1);
});

test('silent in the next scene too: level(0, 0) after its show — its music comes in at 0', async () => {
  const p = await scored();
  p.music.show(B);
  p.music.level(0, 0); // (before the show's music is pushed)
  await p.wait(p.music.FADE + 0.3);
  near(p.deck(2), 0); near(p.deck(1), 0);
});
