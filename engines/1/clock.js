// The time in a render: a virtual clock, standing still till the renderer moves it — MooodClock(start), run before any
// of the code it times: on the page (a renderer's: page.addInitScript) and in the scene's thread (thread.js, as the
// page's stage says). What that code reads as the time (performance.now — ms since it was opened; Date — `start`
// then) and what it waits on (setTimeout, setInterval, requestAnimationFrame — a display frame every 16 ms,
// requestIdleCallback) go by it only: the same moment, the same state. __mooodTime.run(ms) moves it on: each timer due
// by then fires in turn at its own moment (by when it is due, then by when it was set) and, before the next, the
// promises settle — a message through a MessageChannel, not a setTimeout(0), which the browser holds for 4 ms once
// nested. A timer that throws is the code's error (as in a browser), the rest go on. __mooodClock: the real clock —
// what painting costs is timed by; __mooodTimers: the browser's own setTimeout, clearTimeout, requestAnimationFrame,
// cancelAnimationFrame — what waits by the display and not by this clock (an engine 3 scene's side of the stage). Chance is the same every time too (Math.random seeded: the engine's grain, rain,
// sparks): the same moment, the same frame.
//   MooodClock(start, { real: true }) — a play's clock: it goes with the real time by itself (chance as chance is),
// and stands while the play is paused — __mooodTime.pause(true | false): the game's timers, its scene's painting
// and film, what waits on them, all stand.
globalThis.MooodClock = (start, { real: going = false } = {}) => {
  const G = globalThis, real = performance.now.bind(performance), NativeDate = Date;
  const nativeTimeout = setTimeout.bind(G), nativeFrame = G.requestAnimationFrame?.bind(G);
  G.__mooodClock = real;
  G.__mooodTimers = { setTimeout: nativeTimeout, clearTimeout: clearTimeout.bind(G), requestAnimationFrame: nativeFrame, cancelAnimationFrame: G.cancelAnimationFrame?.bind(G) };
  let now = 0, ticking = false, ids = 0;
  const timers = new Map();
  const add = (fn, delay, args, every) => {
    delay = Math.max(0, Number(delay) || 0);
    if (delay > 2 ** 31 - 1) delay = 1;
    // (one set for 0 ms by a timer firing fires a moment later: a timer setting itself again goes on with time)
    const id = ++ids;
    timers.set(id, { id, fn, args, at: Math.ceil(now + (delay || (ticking ? 1 : 0))), every: every && Math.max(1, delay) });
    return id;
  };
  const clear = id => { timers.delete(id); };
  // the timer due first by `end`, or none
  const first = end => {
    let f = null;
    for (const q of timers.values()) if (q.at <= end && (!f || q.at < f.at || (q.at === f.at && q.id < f.id))) f = q;
    return f;
  };
  const port = new MessageChannel();
  let settled = null;
  port.port1.onmessage = () => settled();
  const settle = () => new Promise(r => { settled = r; port.port2.postMessage(0); });

  G.setTimeout = (fn, delay, ...args) => add(fn, delay, args, false);
  G.setInterval = (fn, delay, ...args) => add(fn, delay, args, true);
  G.clearTimeout = G.clearInterval = clear;
  G.requestAnimationFrame = fn => add(() => fn(now), 16 - now % 16, [], false);
  G.cancelAnimationFrame = clear;
  G.requestIdleCallback = (fn, opts) => add(() => fn({ didTimeout: false, timeRemaining: () => 0 }), Math.min(opts?.timeout || Infinity, timers.size ? 50 : 0), [], false);
  G.cancelIdleCallback = clear;
  performance.now = () => now;
  function VirtualDate(...a) {
    if (!new.target) return new NativeDate(start + now).toString();
    return a.length ? new NativeDate(...a) : new NativeDate(start + now);
  }
  VirtualDate.prototype = NativeDate.prototype;
  VirtualDate.now = () => start + now;
  VirtualDate.parse = NativeDate.parse;
  VirtualDate.UTC = NativeDate.UTC;
  G.Date = VirtualDate;
  let seed = 1;
  if (!going) Math.random = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  G.__mooodTime = {
    async run(ms) {
      const end = Math.ceil(now + ms);
      for (let q; (q = first(end));) {
        now = q.at;
        if (q.every) q.at += q.every; else timers.delete(q.id);
        ticking = true;
        try { q.fn(...q.args); } catch (err) { reportError(err); }
        ticking = false;
        await settle();
      }
      now = end;
    },
  };
  if (!going) return;
  // a play's: moved on by the real time, a frame at a time (the page's frames; the thread's, or every 16 ms), unless paused
  let paused = false, last = real(), running = false;
  G.__mooodTime.real = true;
  G.__mooodTime.pause = on => { paused = !!on; last = real(); };
  const tick = async () => {
    (nativeFrame || (f => nativeTimeout(f, 16)))(tick);
    const t = real(), dt = t - last;
    last = t;
    if (paused || running) return;
    running = true;
    try { await G.__mooodTime.run(Math.min(dt, 250)); } finally { running = false; }
  };
  tick();
};
