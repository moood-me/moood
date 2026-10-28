// The director: the scene driven by events, not by seconds (backlog §7a, §7b). The scene says what it can do; whoever
// drives it — the game (MooodState on the page), the scene's own scripts, its showcase — says what and when.
//   An action is everything that takes time: a person walking, going to do something, doing it, turning; a key moved
// `over` seconds, turned, along a path; the camera framing someone; a light fading; a line said. It is an object (the
// command pattern): awaitable (`await a` → 'done', 'cancelled' or 'replaced'), with events (a.ending(1): a second
// before it ends, once its length is known — a line's when its voice says), cancel(), pause() / resume() (the process
// stops, not time: a walk paused stands, a motion paused holds its pose), its length known (duration) or estimated.
// Each actor has its own track — a person's body, a person's voice, a key, the camera: a new action on a track replaces
// the one there, going on smoothly from wherever it is (a walk from where they stand, a key from its value and speed);
// {queue: true} waits its turn instead. What an action does as its own steps (a go: walk, turn, the motion) runs on its
// track under it.
//   A sequence is code — coroutines: scene.sequence(async s => { await s.person('vakula').walk(…); await s.say('vakula',
// …); await s.wait(0.6); … }) — branching as it likes, waiting on what happens: s.until(a key, a condition, an action),
// s.event(a signal), s.all / s.any. Cancelled, every wait in it throws (Cancelled: the coroutine unwinds, its finally
// blocks run) and what it started stops; paused, what it started pauses and its waits stand still.
//   Events (scene.on): 'change' and 'move' of keys, 'action' ({ id, actor, verb, ev: started | ending | done | cancelled
// | replaced | paused | resumed, remaining }), 'arrived' (a walk's end), 'line' (start, heard — its length known —,
// end), 'cut', 'signal', 'tell'. The page hears those of the actions it started, and arrived, line, cut, signal, tell.
//   Saved at any moment as data — the state's values, the running actions (what is left of them), what each element's
// animate keeps (e.mem), the camera's poses, the people's players, chance — and restored (as a cut). Sequences are code,
// not data: restoring stops them — the film too (a film is begun again and sought to where it was by the thread: a
// seek's checkpoint, a restart's `start.showcase`).
//   The showcase (spec.showcase) — the scene's own small scenario, its beats, its bar — is play/showcase.js, made here
// (director.showcase): it is a sequence of this director's, and its checkpoints are this director's saves.
//   Shots (LG4) are play/shots.js: scene.shot(values) → { ready, cut(), cancel() } — no seconds; a cut to a ready shot
// (or where nothing is being played) sets its values at once. **A cut whose shot is not ready waits** (2.4, the
// owner's decision of 2026-10-22): the director keeps it — and a shot made for its values where none lives — and the
// whole story stands: no action, sequence, wait or film beat goes on, its time (`t`, scene.time, the film's bar)
// stands while the world's runs on (the thread's step: animates, people, the camera — the picture lives). What the
// story asks meanwhile — an action begun, a value set, another cut, a signal, a tell — is kept in order (`later`; an
// action is made at once, awaitable, and begins only then) and done right after the cut, in the step its shot is
// ready; what it reads meanwhile is the state as it is. An action reads the state as it BEGINS (a move's start, a
// turn's short way round, a path's first point), so what waited reads the state after the cut.
//   People's motion is never played faster or slower than recorded: a walk without a speed goes at its gait's own pace
// (people.speedOf), a motion done once takes as long as it does (people.durationOf).
//   At once: an action finished now (a.finish()) leaves what its natural end would — the key where it was going, the
// place a walk ends at, the pose a motion done once ends in (its people set there, as a cut sets them), the turn, the
// camera on what it frames; a line unsaid (heard as begun and ended); a pause over. A sequence finished so does all it
// does at once, its code going on through it (an event still waits for its signal; an until, for its condition — tried
// as things finish). The instant mode (a game jumping to a moment: its step's code run up to it, then shown once)
// is all of it at once — what runs as it begins, what begins while it lasts; the clock stands meanwhile (the thread),
// so what goes by the clock — scene.every, scene.after — goes on from where it stood. Exact and deterministic: no
// time, no chance taken that playing would not take.
import { createShowcase } from './showcase.js';

const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// what a wait in a cancelled sequence throws (the coroutine unwinds; its runner hears it as the sequence's end)
class Cancelled extends Error { constructor() { super('cancelled'); this.name = 'Cancelled'; } }
// a person's turn on the spot, as long as a person takes (seconds a degree, at least that): the body turns at its pace
const TURN = 0.6 / 90, TURN_LEAST = 0.4, TURNED = 5;
// a line read, not heard: as long as it is read (the bubble's own time, the page's)
const reading = text => Math.max(2.5, 1.5 + 0.06 * String(text).length);
// a cubic from p0 (going v0 units a second) to p1 (at rest) over T seconds: a move replaced on the fly
const hermite = (p0, v0, p1, T, u) => { const u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * T * v0 + (-2 * u3 + 3 * u2) * p1; };
// the short way round from a to b (degrees)
const shortTurn = (a, b) => a + ((((b - a) % 360) + 540) % 360 - 180);
// an action's id — one count for the thread: the page answers a line by it (`said`) while two scenes' directors live (a
// scene being shown, the one shown before), and an id names one action
let ids = 0;
// chance, seeded (its state a number, saved with the scene)
const step32 = s => (s + 0x6d2b79f5) | 0;
const out32 = s => { let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// env: { state, world, camera, shots (play/shots.js), anim, kit (the world's modules and the forms' constructors), lib,
// speech (the page says lines aloud), warn(text), report(who, err), post(message) — to the page }
export function createDirector(env) {
  const { state, world, camera, anim, warn } = env;
  // (opened: the engine's time the scene opened at — scene.time is from it; seed: chance's, from its start)
  let t = 0, seed = 1, acts = 0, opened = 0;
  // the cut that waits for its shot — { values, shot, later: what the story asked meanwhile } — or null; lag: the
  // seconds the story has stood (its time is the world's less them: 2.4)
  let wait = null, lag = 0;
  // (a person's id → their body's track's name)
  const bodies = new Map();
  const running = [], tracks = new Map(), byId = new Map();
  const people = () => world.people;

  // ── events ──
  const listeners = [];
  // (three values at most — a key's value, the old one, the key; an event's data: nothing made to call them)
  function emit(type, key, a, b, c) {
    for (let i = 0; i < listeners.length; i++) {
      const l = listeners[i];
      if (l.type !== type || (l.key != null && l.key !== key)) continue;
      try { l.fn(a, b, c); } catch (err) { env.report(l.who, err); }
    }
  }
  // (to the page with `at` — the scene's seconds when it happened: PG7; not while it is brought up silently —
  // `simulating`: a seek's, a restore's unseen steps, 2.5)
  const PAGE = new Set(['arrived', 'line', 'cut', 'signal', 'tell']);
  function hear(type, data) {
    emit(type, data?.who ?? data?.name ?? null, data);
    if (PAGE.has(type) && !simulating) env.post({ t: 'event', type, data, at: t });
  }

  // ── actions ──
  class Action {
    constructor(actor, verb, args, owner, impl, track, page) {
      this.id = ++ids; this.actor = actor; this.verb = verb; this.args = args; this.owner = owner; this.impl = impl; this.track = track; this.page = page;
      // (later: made while a cut waits, begun after it — 1; 2: asked to queue on its track)
      this.status = 'running'; this.paused = false; this.queued = false; this.later = 0; this.elapsed = 0; this.started = t;
      // its length (seconds, once known), what it is estimated at meanwhile; whether it ends by itself as its length
      // runs out (a sequence ends as its code does; a line heard, as its voice)
      this.duration = null; this.estimate = null; this.timed = impl.timed !== false;
      this.waiters = []; this.endings = []; this.data = {}; this.from = null; this.toldEnding = false;
    }
    get remaining() { const d = this.duration ?? this.estimate; return d == null ? null : Math.max(0, d - this.elapsed); }
    get done() { return this.status !== 'running'; }
    then(ok, fail) {
      return new Promise((resolve, reject) => { if (this.done) settle(this, resolve, reject); else this.waiters.push(resolve, reject); }).then(ok, fail);
    }
    ending(seconds = 1) {
      return new Promise((resolve, reject) => {
        if (this.done || (this.duration != null && this.duration - this.elapsed <= seconds)) settle(this, resolve, reject);
        else this.endings.push(seconds, resolve, reject);
      });
    }
    cancel() { finish(this, 'cancelled'); }
    // done at once: as it would end (a sequence: all it does from now on too)
    finish() { hurried = 0; now(this, true); }
    pause() {
      if (this.done || this.paused) return;
      this.paused = true;
      // (not begun yet: paused as it begins)
      if (this.later) return;
      this.impl.pause?.(this);
      for (const a of running) if (a.owner === this) a.pause();
      tell(this, 'paused');
    }
    resume() {
      if (this.done || !this.paused) return;
      this.paused = false;
      this.impl.resume?.(this);
      for (const a of running) if (a.owner === this) a.resume();
      tell(this, 'resumed');
    }
  }
  const under = (a, o) => { for (let p = a.owner; p; p = p.owner) if (p === o) return true; return false; };
  const stopped = a => { for (let o = a.owner; o; o = o.owner) if (o.status === 'cancelled' || o.status === 'replaced') return true; return false; };
  // a waiter told: in a stopped sequence it throws (the coroutine unwinds), else it hears how the action ended
  function settle(a, resolve, reject) { if (stopped(a)) reject(new Cancelled()); else resolve(a.status); }
  function tell(a, ev) {
    const data = { id: a.id, actor: a.actor, verb: a.verb, ev, remaining: a.remaining };
    emit('action', a.actor, data);
    // (how one ends, the page hears even of what ended apart — a seek, a restore: its promise is kept)
    if (a.page != null && (!simulating || ev === 'done' || ev === 'cancelled' || ev === 'replaced')) env.post({ t: 'action', id: a.page, ev, remaining: data.remaining, duration: a.duration });
  }
  const trackOf = name => tracks.get(name) || tracks.set(name, { cur: null, queue: [] }).get(name);
  function finish(a, status) {
    if (a.done) return;
    a.status = status;
    if (!a.queued && !a.later) { if (status === 'done') a.impl.end?.(a); else a.impl.stop?.(a, status); }
    const i = running.indexOf(a);
    if (i >= 0) running.splice(i, 1);
    byId.delete(a.id);
    for (const k of a.data.driven || []) if (drivers.get(k) === a) drivers.delete(k);
    if (a.data.camera) cameraN--;
    // what it started stops with it (stopped: its walk stops; done: what it left goes on, its own now)
    for (const b of running.slice()) if (b.owner === a) { if (status === 'done') b.owner = null; else finish(b, 'cancelled'); }
    if (a.verb === 'sequence' || a.verb === 'go') for (let k = listeners.length - 1; k >= 0; k--) if (listeners[k].owner === a) listeners.splice(k, 1);
    // (the shots it made ready and did not cut to: not made ready any longer)
    if (a.data.shots) for (const p of a.data.shots) p.cancel();
    tell(a, status);
    const w = a.waiters, e = a.endings;
    a.waiters = []; a.endings = [];
    for (let k = 0; k < w.length; k += 2) settle(a, w[k], w[k + 1]);
    for (let k = 0; k < e.length; k += 3) settle(a, e[k + 1], e[k + 2]);
    // its track: the next in turn begins
    const tr = a.track && tracks.get(a.track);
    if (tr) {
      if (tr.cur === a) { tr.cur = null; const next = tr.queue.shift(); if (next) { tr.cur = next; next.queued = false; go(next); } }
      else { const q = tr.queue.indexOf(a); if (q >= 0) tr.queue.splice(q, 1); }
    }
    if (instantly && status === 'done' && a.impl !== untilIt) tryUntils();
  }
  function go(a) {
    running.push(a);
    a.started = t;
    tell(a, 'started');
    try { a.impl.start(a); } catch (err) { env.report(a.actor, err); finish(a, 'done'); return; }
    // (what it replaced is read as it begins — then let go: no chain of the dead kept)
    a.from = null;
    if (!a.done && a.timed && a.duration === 0) finish(a, 'done');
    if (!a.done && (atOnce(a) || a.soon)) now(a, a.soon === 'latch');
  }
  // ── at once ──
  // (the instant mode; a sequence finished — what it does at once; more than HURRIED at once in one go: a loop of
  // waits written by hand, which would never end — said, and the clock let go on)
  let instantly = false, hurried = 0, halted = false;
  const HURRIED = 10000;
  function atOnce(a) {
    if (halted) return false;
    if (instantly) return true;
    for (let o = a.owner; o; o = o.owner) if (o.instant) return true;
    return false;
  }
  // an action finished now, as it would end. latch: it was asked to (finish()) — a sequence then does all it does from
  // now on at once too (the instant mode does so while it lasts, by itself). A queued one: what is before it on its track
  // finished first — a sequence there ends as its code goes on: it is finished at once as it begins
  function now(a, latch = false) {
    if (a.done || a.impl.clock || a.impl === eventWait) return;
    // (not begun yet — a cut waits before it: finished at once as it begins)
    if (a.later) { a.soon = latch ? 'latch' : true; return; }
    if (a.impl === untilIt) { if (untilIt.test(a)) finish(a, 'done'); return; }
    if (a.verb === 'sequence' || a.verb === 'go') { if (latch) a.instant = true; for (const b of running.slice()) if (b.owner === a) now(b, latch); return; }
    if (++hurried > HURRIED) { halted = true; warn(`at once: more than ${HURRIED} actions finished in one go — a loop of waits written by hand never ends (scene.every repeats on the clock)`); return; }
    if (a.queued) {
      a.soon = latch ? 'latch' : true;
      const tr = tracks.get(a.track), before = tr ? [tr.cur, ...tr.queue] : [];
      for (let i = 0; i < before.length; i++) { const b = before[i]; if (b === a) break; if (b && !b.done) now(b, latch); }
      if (a.queued || a.done) return;
    }
    if (a.paused) a.resume();
    if (a.duration != null) { a.elapsed = a.duration; a.impl.step?.(a, 0); }
    a.impl.now?.(a);
    finish(a, 'done');
  }
  // (what waits for a condition: tried again as something finished at once)
  function tryUntils() {
    for (let i = 0; i < running.length; i++) { const b = running[i]; if (b.impl === untilIt && !b.done && untilIt.test(b)) { finish(b, 'done'); i = -1; } }
  }
  // an action begun on its track: replacing what is there (what waited after it too), or after it (queue); what an
  // action does as its own steps — under it on its track — begins beside it
  function begin(actor, verb, args, owner, impl, { track = null, queue = false, page = null } = {}) {
    // (begun by a sequence that has ended — its finally putting things right: the scene's own; a wait in it: thrown out)
    if (owner && owner.done) { if (impl.waits) throw new Cancelled(); owner = null; }
    const a = new Action(actor, verb, args, owner, impl, track, page);
    byId.set(a.id, a);
    // (asked while a cut waits: begun after it, in its turn — 2.4)
    if (wait) { a.later = queue ? 2 : 1; wait.later.push(a); return a; }
    started(a, queue);
    return a;
  }
  // an action made, begun: on its track, then going. One that waited behind a cut: its sequence stopped meanwhile — it
  // never begins; its sequence ended — it is the scene's own
  function started(a, queue) {
    let paused = false;
    // (cancelled while it waited: it never begins)
    if (a.done) return;
    if (a.later) {
      a.later = 0; paused = a.paused; a.paused = false;
      if (stopped(a)) { finish(a, 'cancelled'); return; }
      if (a.owner?.done) a.owner = null;
    }
    const track = a.track;
    if (track) {
      const tr = trackOf(track);
      if (tr.cur && !tr.cur.done && under(a, tr.cur)) a.track = null;
      else if (queue && tr.cur && !tr.cur.done) { a.queued = true; tr.queue.push(a); return; }
      else {
        for (const q of tr.queue.splice(0)) finish(q, 'cancelled');
        if (tr.cur && !tr.cur.done) { a.from = tr.cur; finish(tr.cur, 'replaced'); }
        tr.cur = a;
      }
    }
    go(a);
    // (begun in what is paused: paused with it — and one paused before it began)
    if ((paused || a.owner?.paused) && !a.done) a.pause();
  }
  // what drives each key now (a move, a path, a walk): one at a time — another taking it replaces it (a path over the
  // place a walk drives), a value set at once stops it
  const drivers = new Map();
  function takes(a, key) {
    const d = drivers.get(key);
    if (d && d !== a && !d.done && !under(a, d)) finish(d, 'replaced');
    drivers.set(key, a);
    (a.data.driven ||= []).push(key);
    // (a move of a camera key: counted while it runs — the camera is on a known path)
    if (!a.data.camera && key.startsWith('camera_')) { a.data.camera = true; cameraN++; }
  }
  function release(key) { const d = drivers.get(key); if (d && !d.done) finish(d, 'cancelled'); drivers.delete(key); }
  // what has no length (a key set, a look): an action done at once — awaitable all the same
  const instant = (actor, verb, owner, page, run) => begin(actor, verb, null, owner, { start(a) { run(); a.duration = 0; } }, { page });

  // ── keys over time ──
  // a number moved to `to` over `over` seconds along `ease` — from where it is and, moving already (its track's last
  // action replaced), as fast as it went, unless a curve is asked
  function moveKey(key, to, over, ease, owner, page, queue = false) {
    key = String(key);
    if (typeof to !== 'number' || !(over > 0)) return instant(key, 'set', owner, page, () => { release(key); state.set(key, to); });
    return begin(key, 'move', { to, over, ease: ease ?? null }, owner, keyMove, { track: `key:${key}`, page, queue });
  }
  const keyMove = {
    start(a) {
      // (from where the key is as it begins: a turn's goal the short way round from there; a key that is no number
      // then is set at once)
      const now = state.value(a.actor);
      if (a.args.turn != null) a.args.to = shortTurn(Number(now) || 0, a.args.turn);
      if (typeof now !== 'number') { release(a.actor); state.set(a.actor, a.args.to); a.data.set = true; a.duration = 0; return; }
      const from = Number(now), v0 = a.from && a.args.ease == null ? state.speed(a.actor) : 0;
      Object.assign(a.data, { from, v0, curve: anim.easeOf(a.args.ease ?? 'smooth') });
      a.duration = a.args.over;
      takes(a, a.actor);
      state.aim(a.actor, a.args.to);
    },
    step(a) { if (!a.data.set) state.drive(a.actor, moveAt(a, a.elapsed)); },
    end(a) { if (!a.data.set) state.drive(a.actor, a.args.to); },
    save: a => ({ key: a.actor, to: a.args.to, over: a.args.over, ease: a.args.ease, from: a.data.from, v0: a.data.v0 }),
    restore(d, elapsed) {
      const a = begin(d.key, 'move', { to: d.to, over: d.over, ease: d.ease }, null, { ...keyMove, start(x) { Object.assign(x.data, { from: d.from, v0: d.v0, curve: anim.easeOf(d.ease ?? 'smooth') }); x.duration = d.over; takes(x, d.key); } }, { track: `key:${d.key}` });
      a.elapsed = elapsed;
      return a;
    },
  };
  // a key's move's value `elapsed` seconds into it
  function moveAt(a, elapsed) {
    const u = clamp(elapsed / a.duration, 0, 1), d = a.data;
    return d.v0 ? hermite(d.from, d.v0, a.args.to, a.duration, u) : d.from + (a.args.to - d.from) * d.curve(u);
  }
  // an angle in degrees turned the short way round — from where it is as the turn begins
  function turnKey(key, degrees, over, ease, owner, page) {
    key = String(key);
    if (!(over > 0)) return instant(key, 'set', owner, page, () => { release(key); state.set(key, shortTurn(Number(state.value(key)) || 0, degrees)); });
    return begin(key, 'move', { to: NaN, turn: degrees, over, ease: ease ?? null }, owner, keyMove, { track: `key:${key}`, page });
  }
  // several numbers moved together through points, as one movement: over `over` seconds or at `speed`, along `ease` —
  // slowing nowhere but where its curve says. Its way is measured in metres, along the keys that place something in
  // metres (world.metres: across, distance, elevation, the camera's x, h, z) — speed is metres a second; the others (a
  // facing, a bearing, a turn, any number) follow along, adding nothing to its length. A path of no such keys is
  // measured in its own numbers (their units a second). A stretch that moves none of the keys it is measured along
  // (a turn on the spot within a walk) is passed at once — said: a turn on the spot is a turn of its own, over seconds
  function pathKeys(keys, points, { over = 0, speed = 0, ease = 'smooth' } = {}, owner, page) {
    keys = keys.map(String);
    return begin(keys.join(','), 'path', { keys, points, over, speed, ease }, owner, keyPath, { track: `keys:${keys.join(',')}`, page });
  }
  // a path's way from where its keys are as it begins — its args made what is saved (keys, pts, by, seconds, ease);
  // false: it has no length or no time, and its keys are set at once to its end
  function wayOf(a) {
    const { keys, points, over, speed, ease } = a.args;
    const pts = [keys.map(k => Number(state.value(k)) || 0), ...points.map(p => keys.map((_, i) => Number(p[i]) || 0))];
    const metric = keys.map(k => world.metres(k)), by = metric.some(Boolean) ? metric : keys.map(() => true);
    const ends = endsOf(pts, by), length = ends.at(-1), seconds = over > 0 ? over : speed > 0 ? length / speed : 0;
    if (!(seconds > 0 && length > 0)) { keys.forEach((k, i) => { release(k); state.set(k, pts[pts.length - 1][i]); }); return false; }
    for (let i = 1; i < pts.length; i++) {
      if (ends[i] === ends[i - 1] && pts[i].some((v, j) => v !== pts[i - 1][j])) {
        warn(`path [${keys.join(', ')}]: point ${i} moves only what follows along (${keys.filter((_, j) => !by[j]).join(', ')}) — passed at once, its way measured in metres; a turn on the spot is a turn of its own (scene.turn, over seconds)`);
        break;
      }
    }
    a.args = { keys, pts, by, seconds, ease };
    return true;
  }
  // (the running lengths of a way along the keys it is measured by — all of them, none said)
  const endsOf = (pts, by = null) => {
    const e = [0];
    for (let i = 1; i < pts.length; i++) {
      let s = 0;
      for (let j = 0; j < pts[i].length; j++) if (!by || by[j]) s += (pts[i][j] - pts[i - 1][j]) ** 2;
      e.push(e[i - 1] + Math.sqrt(s));
    }
    return e;
  };
  // where a way (points, their running lengths) is `d` along it, for its value j
  const along = (pts, ends, d, j) => {
    let i = 1;
    while (i < ends.length - 1 && ends[i] < d) i++;
    const f = (d - ends[i - 1]) / ((ends[i] - ends[i - 1]) || 1);
    return pts[i - 1][j] + (pts[i][j] - pts[i - 1][j]) * f;
  };
  const keyPath = {
    start(a) {
      if (!a.args.pts && !wayOf(a)) { a.data.set = true; a.duration = 0; return; }
      const { keys, pts, seconds, ease } = a.args;
      Object.assign(a.data, { ends: endsOf(pts, a.args.by), curve: anim.easeOf(ease) });
      a.duration = seconds;
      keys.forEach((k, j) => { takes(a, k); state.aim(k, pts[pts.length - 1][j]); });
    },
    step(a) {
      if (a.data.set) return;
      const { keys, pts } = a.args, { ends, curve } = a.data, d = curve(clamp(a.elapsed / a.duration, 0, 1)) * ends[ends.length - 1];
      for (let j = 0; j < keys.length; j++) state.drive(keys[j], along(pts, ends, d, j));
    },
    // (its keys' values `elapsed` seconds into it, into the ahead's object from its n-th: → the next n)
    ahead(a, elapsed, n) {
      const { keys, pts } = a.args, { ends, curve } = a.data, d = curve(clamp(elapsed / a.duration, 0, 1)) * ends[ends.length - 1];
      for (let j = 0; j < keys.length; j++) n = put(n, keys[j], along(pts, ends, d, j));
      return n;
    },
    end(a) { if (a.data.set) return; const { keys, pts } = a.args; for (let j = 0; j < keys.length; j++) state.drive(keys[j], pts[pts.length - 1][j]); },
    save: a => ({ ...a.args }),
    restore(d, elapsed) { const a = begin(d.keys.join(','), 'path', d, null, keyPath, { track: `keys:${d.keys.join(',')}` }); a.elapsed = elapsed; return a; },
  };

  // ── people ──
  const personOf = (id, who) => {
    const el = world.byId.get(String(id));
    if (!el || el.kind !== 'person') { warn(`${who}: person('${id}') — no person of that id in the scene`); return null; }
    return el;
  };
  // where they stand now: their place's keys (those not set yet: the element's own across and distance, set so)
  function standing(el) {
    const P = el.spec.place || {};
    return [P.across, P.distance].map((key, i) => {
      const own = i ? el.spec.at.distance : el.spec.at.across;
      if (typeof key !== 'string') return own;
      const v = state.value(key);
      if (typeof v !== 'number') { state.set(key, own); return own; }
      return v;
    });
  }
  // a walk along points [[across, distance] …] from where they stand, at `speed` m/s — without one, at their gait's own
  // pace (people.speedOf: its motion at its real rate carries them that far a second); facing the way they go
  const walking = {
    start(a) {
      const el = a.data.el, P = el.spec.place, pts = [standing(el), ...a.args.points], gait = a.args.gait;
      if (gait !== undefined) state.set(`${el.id}_gait`, gait);
      const pace = a.args.speed ?? people()?.speedOf(el.id, (gait ?? state.value(`${el.id}_gait`)) || undefined) ?? 1.3;
      const ends = endsOf(pts);
      Object.assign(a.data, { pts, ends, pace, keys: [P.across, P.distance] });
      a.duration = ends[ends.length - 1] / pace;
      // (facing the way they go, and staying so)
      const p = pts[pts.length - 2], q = pts[pts.length - 1];
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-3) state.set(`${el.id}_turn`, Math.atan2(q[0] - p[0], q[1] - p[1]) / DEG);
      if (a.args.steps === false) { a.data.stepsWere = state.value(`${el.id}_steps`); state.set(`${el.id}_steps`, false); }
      takes(a, P.across); takes(a, P.distance);
      state.aim(P.across, q[0]); state.aim(P.distance, q[1]);
    },
    step(a) {
      const { pts, ends, pace, keys } = a.data, d = Math.min(ends[ends.length - 1], a.elapsed * pace);
      state.drive(keys[0], along(pts, ends, d, 0)); state.drive(keys[1], along(pts, ends, d, 1));
    },
    end(a) {
      const { pts, keys, el } = a.data, q = pts[pts.length - 1];
      state.drive(keys[0], q[0]); state.drive(keys[1], q[1]);
      walking.stop(a);
      hear('arrived', { who: el.id });
    },
    stop(a) { if (a.args.steps === false) state.set(`${a.data.el.id}_steps`, a.data.stepsWere ?? null); },
    now: a => people()?.settle(a.data.el.id),
    // (what is left of the way, from where they are)
    save(a) {
      const { pts, ends, pace } = a.data, d = Math.min(ends[ends.length - 1], a.elapsed * pace);
      let i = 1;
      while (i < ends.length - 1 && ends[i] < d) i++;
      return { who: a.data.el.id, points: pts.slice(i), speed: pace, steps: a.args.steps };
    },
    restore: d => personVerbs(d.who, null, null)?.walk(d.points, { speed: d.speed, steps: d.steps }),
  };
  // what they do: a motion done once — as long as it is (people.durationOf) — or looped (a state: done at once)
  const doing = {
    start(a) {
      const el = a.data.el, { motion, loop, from, going } = a.args;
      state.set(`${el.id}_do`, { motion, loop, from, going, n: ++acts });
      if (loop) { a.duration = 0; return; }
      const d = people()?.durationOf(el.id, motion);
      if (d == null) { warn(`${el.id}: "${motion}": no such motion of theirs (yet) — its length taken as 2 s`); a.duration = 2; } else a.duration = Math.max(0, d - from);
    },
    // (paused: held in that very pose; on from it again)
    pause(a) { state.set(`${a.data.el.id}_still`, true); },
    resume(a) { state.set(`${a.data.el.id}_still`, false); },
    stop(a) { if (a.paused) state.set(`${a.data.el.id}_still`, false); },
    // (at once: held at its end, as it would be once done)
    now(a) {
      const { motion, from, going } = a.args;
      state.set(`${a.data.el.id}_do`, { motion, loop: false, from: from + a.duration, going, n: ++acts });
      people()?.settle(a.data.el.id);
    },
    save: a => (a.args.loop ? null : { who: a.data.el.id, motion: a.args.motion, from: a.args.from + a.elapsed, going: a.args.going }),
    restore: d => personVerbs(d.who, null, null)?.do(d.motion, { from: d.from, going: d.going }),
  };
  // a turn on the spot (where they face standing), as long as a person takes
  const turning = {
    start(a) {
      const key = `${a.data.el.id}_turn`, old = Number(state.value(key)) || 0, to = shortTurn(old, a.args.degrees);
      state.set(key, to);
      a.duration = a.args.left ?? people()?.durationOf(a.data.el.id, { turn: to - old }) ?? Math.max(TURN_LEAST, Math.abs(to - old) * TURN);
    },
    now: a => people()?.settle(a.data.el.id),
    save: a => ({ who: a.data.el.id, degrees: a.args.degrees, left: a.remaining }),
    restore: d => personVerbs(d.who, null, null)?.turn(d.degrees, { left: d.left }),
  };
  // a line said: shown and heard on the page (speech.js) as long as its voice — not heard, as long as it is read (or as
  // long as its voice was, once heard: voiced)
  const voiced = new Map();
  const saying = {
    timed: false,
    start(a) {
      const { who, text } = a.args;
      a.estimate = voiced.get(text) ?? reading(text);
      if (env.speech && !simulating && !atOnce(a)) { env.post({ t: 'say', id: a.id, who, text, opts: a.args.opts }); a.data.said = true; }
      else { a.duration = a.estimate; a.timed = true; }
      if (world.byId.get(who)?.kind === 'person') state.set(`${who}_talk`, 1);
      hear('line', { who, text, ev: 'start', duration: a.duration });
    },
    end(a) { saying.stop(a); hear('line', { who: a.args.who, text: a.args.text, ev: 'end' }); },
    stop(a, status) {
      if (world.byId.get(a.args.who)?.kind === 'person') state.set(`${a.args.who}_talk`, 0);
      // (on the page still: no more of it — replaced, cancelled, finished at once)
      if (a.data.said && status) env.post({ t: 'unsay', id: a.id });
    },
    // (finished at once: ended as said — off the page)
    now(a) { if (a.data.said) env.post({ t: 'unsay', id: a.id }); a.data.said = false; },
    // (a line half said is not said again)
    save: () => null,
  };
  // what the page says of a line (the page's speech): heard — its voice's length then (from now); unheard — not
  // voiced: as long as it is read from now; ended
  function said(id, ev, duration) {
    const a = byId.get(id);
    if (!a || a.verb !== 'say' || a.done) return;
    if (ev === 'heard' || ev === 'unheard') {
      const voiced_ = ev === 'heard' && typeof duration === 'number' && duration > 0;
      // (heard: its voice from now; unheard: as long as it is read from when it began — at once if that is past)
      a.duration = voiced_ ? a.elapsed + duration : Math.max(a.elapsed, a.estimate);
      if (voiced_) voiced.set(a.args.text, duration);
      // (unheard, it ends as its time runs out — off the page then; heard, as its voice ends — the page says so)
      if (!voiced_) a.timed = true;
      hear('line', { who: a.args.who, text: a.args.text, ev: 'heard', duration: a.duration });
    } else if (ev === 'end') { a.data.said = false; finish(a, 'done'); }
  }
  // (the line as written — the source language's — is said in the scene's: env.tr, the scene's translator)
  function say(who, text, opts, owner, page) {
    text = String(text ?? '').trim() && env.tr.said(String(who), String(text)).trim();
    if (!text) return instant(String(who), 'say', owner, page, () => {});
    return begin(String(who), 'say', { who: String(who), text, opts: opts || {} }, owner, saying, { track: `voice:${who}`, queue: !!opts?.queue, page });
  }
  // the verbs of a person (scene.person(id), s.person(id), act(id, verb, …))
  function personVerbs(id, owner, page, who = 'scene') {
    const el = personOf(id, who);
    if (!el) return null;
    const pid = el.id, track = `person:${pid}`, key = n => `${pid}_${n}`, P = el.spec.place;
    const set = (n, v) => instant(pid, n, owner, page, () => state.set(key(n), v));
    const body = (verb, args, impl, queue) => begin(pid, verb, args, owner, { ...impl, start(a) { a.data.el = el; impl.start(a); } }, { track, queue, page });
    const nothing = verb => instant(pid, verb, owner, page, () => {});
    const verbs = {
      walk(points, { speed, gait, steps = true, queue = false } = {}) {
        if (typeof P?.across !== 'string' || typeof P?.distance !== 'string') { warn(`${who}: ${pid} walks by their "place": its across and distance are state keys`); return nothing('walk'); }
        const pts = (Array.isArray(points?.[0]) ? points : [points]).map(p => [Number(p[0]) || 0, Number(p[1]) || 0]);
        return body('walk', { points: pts, speed, gait, steps }, walking, queue);
      },
      // a motion done once that ends at `to` (or begins at `from`) facing `turn` at its end: they walk to where it
      // begins, turn as it begins, and do it
      go(motion, { to, from, turn = 180, speed, queue = false, resume = null } = {}) {
        if (!Array.isArray(to) && !Array.isArray(from)) { warn(`${who}: ${pid}.go(motion, {to | from: [across, distance], turn}) — where the motion ends, or begins`); return nothing('go'); }
        if (typeof P?.across !== 'string' || typeof P?.distance !== 'string') { warn(`${who}: ${pid} goes by their "place": its across and distance are state keys`); return nothing('go'); }
        const off = people()?.startOf(pid, motion, turn);
        if (!off) { warn(`${who}: ${pid}.go — "${motion}": no such motion of theirs (yet)`); return nothing('go'); }
        const begins = from ?? [to[0] + off.across, to[1] + off.distance], ends = to ?? [from[0] - off.across, from[1] - off.distance];
        // (resume: a go restored where it was — { phase: walk | turn | do, data: that step's as saved })
        const r = resume;
        return sequence(async s => {
          const me = s.person(pid), here = standing(el);
          if (r?.phase === 'walk') await me.walk(r.data.points, { speed: r.data.speed });
          else if (!r && Math.hypot(begins[0] - here[0], begins[1] - here[1]) > 0.03) await me.walk([begins], { speed });
          if (r?.phase === 'turn') await me.turn(r.data.degrees, { left: r.data.left });
          else if (r?.phase !== 'do' && Math.abs(shortTurn(Number(state.value(key('turn'))) || 0, off.turn) - (Number(state.value(key('turn'))) || 0)) > TURNED) await me.turn(off.turn);
          // (the motion ends where they will stand, facing their turn: its place and turn are its end's)
          state.set(P.across, ends[0]); state.set(P.distance, ends[1]); state.set(key('turn'), turn);
          await me.do(motion, r?.phase === 'do' ? { from: r.data.from } : undefined);
        }, {
          owner, actor: pid, verb: 'go', args: { motion, to: ends, turn, speed }, track, queue, page,
          // (its length: the way at their pace, the turn, the motion — known as it begins)
          length: () => {
            const here = standing(el), pace = speed ?? people()?.speedOf(pid) ?? 1.3, d = people()?.durationOf(pid, motion) ?? 2;
            const turnFrom = Math.abs(shortTurn(Number(state.value(key('turn'))) || 0, off.turn) - (Number(state.value(key('turn'))) || 0));
            return Math.hypot(begins[0] - here[0], begins[1] - here[1]) / pace + (turnFrom > TURNED ? people()?.durationOf(pid, { turn: turnFrom }) ?? Math.max(TURN_LEAST, turnFrom * TURN) : 0) + d;
          },
          // (where it is: the step of it going now, as that step saves itself)
          save(a) {
            let step = null;
            for (let i = 0; i < running.length; i++) if (running[i].owner === a && running[i].impl.save && running[i].data.el) step = running[i];
            const phase = step?.verb, data = phase ? step.impl.save(step) : null;
            return { who: pid, motion, to: ends, turn, speed, resume: data ? { phase, data } : null };
          },
        });
      },
      do(motion, { loop = false, from = 0, going = false, queue = false } = {}) { return body('do', { motion, loop, from: Number(from) || 0, going }, doing, queue); },
      turn(degrees, { queue = false, left } = {}) { return body('turn', { degrees: Number(degrees) || 0, left }, turning, queue); },
      say: (text, opts = {}) => say(pid, text, opts, owner, page),
      look: at => set('look', at ?? null),
      reach: hands => set('reach', hands ?? null),
      with: parts => set('with', parts ?? null),
      wear: fields => set('wear', fields ?? null),
      gait: motion => set('gait', motion ?? null),
      on: point => set('on', point ?? null),
      here: (yes = true) => set('here', !!yes),
      still: (on = true) => set('still', !!on),
      mood: expression => set('mood', expression),
      talk: (on = true) => set('talk', on ? 1 : 0),
      // where a motion done once, ending facing `turn`, begins — from where it ends ({across, distance, turn}; null
      // while it is not known)
      startOf: (motion, turn = 180) => people()?.startOf(pid, motion, turn) ?? null,
    };
    return verbs;
  }

  // ── the camera ──
  // the operator told what to frame ({ target, shot, frame, glide }: camera_target …): done once it has settled
  const framingIt = {
    timed: false,
    start(a) {
      for (const k of ['target', 'shot', 'frame', 'glide']) if (k in a.args) state.set(`camera_${k}`, a.args[k] ?? null);
      const g = state.value('camera_glide');
      a.estimate = 1.4 * (typeof g === 'number' ? g : 1.5);
    },
    step(a) { if (a.elapsed > 0.05 && camera.framed()) finish(a, 'done'); },
    now: () => camera.settle(),
    // (restored, the operator is where it was: the keys are the state's)
    save: () => null,
  };
  // a shot to cut to, made ready now (2.3): its paintings made ahead, its view's pages asked, its people's looks
  // built — till it is cut to or cancelled; one made inside a sequence is cancelled with it (but one it has cut to:
  // play/shots.js). Its maker (2.3 step 1): the sequence — outside sequences the code itself (`code`: the API object
  // that code was given — the scene's script, an element's, the showcase's: each its own); next: the showcase's own
  // code made it — the film's next beat, asked as the frame is (2.3 step 4). ready: whether all of it is there (where
  // nothing is being played — an unseen step, the instant mode, a thread with no loop — true)
  function shot(values, owner, code, next) {
    const p = env.shots.make(values, owner ?? code, next);
    if (owner) (owner.data.shots ||= []).push(p);
    return {
      values,
      // (asked by an until that is being tried and told "no" of a shot that lives: the story waits on that shot)
      get ready() { const is = instantly || p.ready; if (!is && trying && !p.ended) trying.data.shot = p; return is; },
      cut() { cut(values, p); },
      cancel: () => p.cancel(),
    };
  }
  // a cut: its values at once (what drove its keys stops there); by a shot made ready (given, or a live one of these
  // very values), that shot's paintings are the scene's from this step and its camera the one the new shot starts from
  // — at once where its shot is ready or nothing is being played; else it waits (2.4): kept with the shot it waits for,
  // the story standing; one asked while another waits waits behind it
  function cut(values = {}, by = null) {
    if (wait) { wait.later.push(() => cut(values, by)); return; }
    const s = env.shots.waitFor(values, by);
    if (s) { wait = { values, shot: s, later: [] }; return; }
    made(values, by);
  }
  function made(values, by) {
    for (const k in values) release(k);
    env.shots.cutting(values, by);
    state.cut(values);
    hear('cut', values);
  }
  // the cut that waited made — by its shot — then what the story asked meanwhile, in order (a cut among it may wait
  // again: the rest waits behind that one)
  function flush() {
    const w = wait;
    wait = null;
    made(w.values, w.shot);
    for (let i = 0; i < w.later.length; i++) {
      if (wait) { for (let k = i; k < w.later.length; k++) wait.later.push(w.later[k]); return; }
      const x = w.later[i];
      if (x instanceof Action) started(x, x.later === 2); else x();
    }
  }
  // a waiting cut let go (a restore, the scripts stopped): what it kept never begins; a shot made for it let go
  function drop() {
    if (!wait) return;
    const w = wait;
    wait = null;
    if (w.shot.maker === 'cut') w.shot.cancel();
    for (const x of w.later) if (x instanceof Action) finish(x, 'cancelled');
  }

  // ── waiting ──
  const waiting = { waits: true, start(a) { a.duration = Math.max(0, Number(a.args.seconds) || 0); } };
  // (scene.every, scene.after: by the clock, never at once)
  const clockWait = { ...waiting, clock: true };
  // (trying: the until whose condition is being tried now. a.data.shot: the shot that lives whose `ready` it asked, as
  // it was last tried, and was told "no" (the last of them; null: none) — the story waits on a shot being made ready:
  // `awaiting`, 2.3 step 5)
  let trying = null;
  const untilIt = {
    timed: false, waits: true,
    start(a) { if (untilIt.test(a)) a.duration = 0, a.timed = true; },
    step(a) { if (untilIt.test(a)) finish(a, 'done'); },
    test(a) {
      const c = a.args.cond, was = trying;
      trying = a; a.data.shot = null;
      try { return typeof c === 'string' ? !!state.value(c) : typeof c === 'function' ? !!c() : c instanceof Action ? c.done : !!c; } catch (err) { env.report('until', err); return true; } finally { trying = was; }
    },
  };
  const signals = new Map();
  function signal(name, data) {
    if (wait) { wait.later.push(() => signal(name, data)); return; }
    name = String(name);
    hear('signal', { name, data });
    const ws = signals.get(name);
    if (!ws) return;
    signals.delete(name);
    for (const a of ws) { a.data.value = data; finish(a, 'done'); }
  }
  const eventWait = {
    timed: false, waits: true,
    start(a) { (signals.get(a.args.name) || signals.set(a.args.name, []).get(a.args.name)).push(a); },
    stop(a) { const ws = signals.get(a.args.name), i = ws ? ws.indexOf(a) : -1; if (i >= 0) ws.splice(i, 1); },
  };

  // ── sequences ──
  // async code fn(s) as an action: `s` — the scene's API, its actions this one's. opts: { name — one by that name
  // running is replaced; owner; and for a sequence standing for a verb (go): actor, verb, args, track, queue, page,
  // length() (known as it begins), save }
  function sequence(fn, opts = {}) {
    const { name = null, owner = null } = opts, who = `sequence${name ? ` ${name}` : ''}`;
    const impl = {
      timed: false,
      start(a) {
        if (opts.length) a.duration = opts.length();
        const s = context(a, who);
        Promise.resolve().then(() => fn(s)).then(() => finish(a, 'done'), err => {
          if (!(err instanceof Cancelled)) env.report(who, err);
          finish(a, 'done');
        });
      },
      save: opts.save,
    };
    return begin(opts.actor ?? (name ? `sequence:${name}` : 'sequence'), opts.verb ?? 'sequence', opts.args ?? null, owner, impl,
      { track: opts.track ?? (name ? `sequence:${name}` : null), queue: opts.queue, page: opts.page });
  }

  // ── the API: scripts' `scene`, sequences' `s` ──
  // owner: the sequence whose actions these are (null: a script's); film: the showcase's own — a shot it makes is the
  // film's next beat (2.3)
  function context(owner, who, element = null, film = false) {
    const used = new Proxy(state.now, { get: (v, k) => (typeof k === 'string' ? state.get(k) : v[k]) });
    const api = {
      id: element?.id ?? null, element: element ?? null, anim, kit: env.kit, lib: env.lib,
      get state() { return used; },
      // seconds of the engine's clock since the scene opened (was started)
      get time() { return t - opened; },
      // what the screen shows now, stage heights: { safe, seen } (world.view — read-only: no state key, nothing saved)
      get view() { return world.view; },
      get: key => state.get(key),
      set(key, value, over, ease) { return moveKey(key, value, over, ease, owner, null); },
      move(key, value, { over = 0, ease, queue = false } = {}) { return moveKey(key, value, over, ease, owner, null, queue); },
      turn(key, degrees, over, ease) { return turnKey(key, degrees, over, ease, owner, null); },
      path(keys, points, opts) { return pathKeys(keys, points, opts, owner, null); },
      cut(values) { cut(values); },
      was: (key, ago) => { state.use(key); return state.was(String(key), ago); },
      person: id => { return personVerbs(id, owner, null, who); },
      say: (id, text, opts) => { return say(id, text, opts, owner, null); },
      camera(opts = {}) { return begin('camera', 'frame', opts, owner, framingIt, { track: 'camera' }); },
      shot: values => { return shot(values, owner, api, film); },
      light(id) {
        const l = world.C.lights.find(x => x && String(x.id) === String(id));
        if (!l || typeof l.on !== 'string') { warn(`${who}: light('${id}') — a light of the scene whose "on" is a state key`); return { fade: () => instant(String(id), 'fade', owner, null, () => {}) }; }
        return { fade: (to, { over = 1, ease } = {}) => { return moveKey(l.on, to, over, ease, owner, null); } };
      },
      sequence(fn, opts = {}) { return sequence(fn, { name: opts.name ?? null, owner }); },
      every(seconds, fn) { return sequence(async s => { for (;;) { await begin('wait', 'wait', { seconds: Math.max(0.05, seconds) }, s.self, clockWait); fn(); } }, { owner }); },
      after(seconds, fn) { return sequence(async s => { await begin('wait', 'wait', { seconds }, s.self, clockWait); fn(); }, { owner }); },
      on(type, a, b) {
        const fn = typeof a === 'function' ? a : b, key = typeof a === 'function' ? null : String(a);
        if (key != null && (type === 'change' || type === 'move')) state.use(key);
        listeners.push({ type, key, fn, who, owner });
      },
      signal: (name, data) => signal(name, data),
      tell: (text, about = null) => { if (wait) wait.later.push(() => hear('tell', { text: String(text), about })); else hear('tell', { text: String(text), about }); },
      warn: text => warn(`${who}: ${text}`),
      ground: (across, distance) => world.groundAt(across, distance),
      hero: () => camera.hero(),
      random() { seed = step32(seed); return out32(seed); },
      startOf: (id, motion, turn = 180) => people()?.startOf(String(id), motion, turn) ?? null,
    };
    if (!owner) return api;
    // a sequence's own: waiting (each wait its own: paused with it, thrown out of when it is cancelled)
    return Object.assign(api, {
      wait(seconds) { return begin('wait', 'wait', { seconds }, owner, waiting); },
      until(cond) { return begin('until', 'until', { cond }, owner, untilIt); },
      event(name) { const a = begin('event', 'event', { name: String(name) }, owner, eventWait); return a.then(() => a.data.value); },
      all: (...list) => { return Promise.all(list.flat()); },
      // the first of them to end; { cancel: true } last — the others stop then
      any(...list) {
        const opts = list.length && !(list.at(-1) instanceof Action) && !Array.isArray(list.at(-1)) && typeof list.at(-1)?.then !== 'function' ? list.pop() : {};
        const acts_ = list.flat();
        return Promise.race(acts_).then(r => { if (opts.cancel) for (const x of acts_) if (x instanceof Action) x.cancel(); return r; });
      },
      get self() { return owner; },
    });
  }

  // ── the keys ahead (RN4 f.toward) ──
  // ONE object, rewritten by ahead(h): the keys the moves running now drive — a key moved `over` seconds, keys along a
  // path; not a walk, nor what an animate drives — and their values h seconds on, each move its own ease to its end
  // (where it ends sooner, its end); a sequence's later steps are not foreseen. cameraN: the moves of camera keys running
  const aheadOf = { n: 0, keys: [], values: new Float64Array(8) };
  let cameraN = 0;
  function put(n, key, value) {
    if (n === aheadOf.values.length) { const v = new Float64Array(2 * n); v.set(aheadOf.values); aheadOf.values = v; }
    aheadOf.keys[n] = key; aheadOf.values[n] = value;
    return n + 1;
  }
  function ahead(h) {
    let n = 0;
    for (let i = 0; i < running.length; i++) {
      const a = running[i];
      if (a.done || a.paused || a.duration == null) continue;
      const at = Math.min(a.elapsed + h, a.duration);
      if (a.verb === 'move') n = put(n, a.actor, moveAt(a, at));
      else if (a.verb === 'path') n = keyPath.ahead(a, at, n);
    }
    aheadOf.n = n;
    return aheadOf;
  }

  // ── the frame ──
  const list = [];
  function step(at, dt) {
    // (a cut waits: the story stands till its shot is ready — one cancelled meanwhile made again for its values; the
    // step its shot is ready the cut is made, then what waited behind it)
    if (wait) {
      if (wait.shot.ended) wait.shot = env.shots.make(wait.values, 'cut', true);
      if (wait.shot.ready) { t = at - lag; flush(); }
      if (wait) { lag += dt; t = at - lag; return; }
    }
    t = at - lag;
    // (emptied keeping its storage: a list emptied by its length is made anew at the next push)
    while (list.length) list.pop();
    for (let i = 0; i < running.length; i++) list.push(running[i]);
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.done || a.paused) continue;
      a.elapsed += dt;
      a.impl.step?.(a, dt);
      if (a.done || a.duration == null) continue;
      const left = a.duration - a.elapsed;
      if (a.timed && left <= 0) { finish(a, 'done'); continue; }
      // (what waits for it to be nearly done: each told once)
      const e = a.endings;
      for (let k = e.length - 3; k >= 0; k -= 3) if (left <= e[k]) { const ok = e[k + 1], fail = e[k + 2]; e.splice(k, 3); settle(a, ok, fail); }
      if (a.page != null && !a.toldEnding && left <= 1) { a.toldEnding = true; tell(a, 'ending'); }
    }
  }

  // ── saved and restored ──
  const IMPLS = { keyMove, keyPath, walking, doing, turning };
  const implOf = a => (a.verb === 'go' ? 'go' : Object.keys(IMPLS).find(k => a.impl.save === IMPLS[k].save) ?? null);
  function save() {
    const actions = [], kept = new Set();
    for (const a of running) {
      if (!a.impl.save) continue;
      let inside = false;
      for (let o = a.owner; o; o = o.owner) if (kept.has(o)) { inside = true; break; }
      if (inside) continue;
      const data = a.impl.save(a), impl = implOf(a);
      if (data && impl) { actions.push({ impl, elapsed: a.elapsed, data }); kept.add(a); }
    }
    const mem = {};
    for (const el of world.elements) if (el.id != null && Object.keys(el.mem).length) mem[el.id] = structuredClone(el.mem);
    // (a cut waiting is saved as made — its values: restored, the scene is past it; what waited behind it is code, as a
    // sequence is: the scripts started anew go on from the state)
    return { t, seed, acts, opened, state: state.save(), cut: wait ? { ...wait.values } : null, actions, mem, camera: camera.save(), people: people()?.save() ?? null, emitters: world.emitters?.save() ?? null };
  }
  function restore(d) {
    // (what runs stops — sequences are code, not data; the scripts' listeners go: the thread starts the scripts anew)
    drop();
    for (const a of running.slice()) finish(a, 'cancelled');
    for (const tr of tracks.values()) for (const q of tr.queue.splice(0)) finish(q, 'cancelled');
    signals.clear();
    listeners.length = 0;
    lag = 0;
    t = d.t; seed = d.seed; acts = d.acts; opened = d.opened ?? opened;
    // (the shots made ready for what was to come: not for this)
    env.shots.clear();
    state.restore(d.state, d.t); camera.restore(d.camera);
    // (saved while a cut waited: the cut made now, plainly — the thread draws the moment as a new shot)
    if (d.cut) { env.shots.cutting(d.cut, null); state.cut(d.cut); }
    if (d.emitters) world.emitters?.restore(d.emitters);
    for (const el of world.elements) { for (const k of Object.keys(el.mem)) delete el.mem[k]; if (d.mem[el.id]) Object.assign(el.mem, structuredClone(d.mem[el.id])); }
    if (d.people) people()?.restore(d.people);
    // (what was running goes on: a key's move from its time; a walk, a go, a motion, a turn from what was left of them)
    for (const x of d.actions) {
      if (x.impl === 'go') walkingGo(x.data);
      else if (x.impl === 'keyMove' || x.impl === 'keyPath') IMPLS[x.impl].restore(x.data, x.elapsed);
      else IMPLS[x.impl]?.restore(x.data);
    }
  }
  const walkingGo = d => personVerbs(d.who, null, null)?.go(d.motion, { to: d.to, turn: d.turn, speed: d.speed, resume: d.resume });

  let simulating = false;
  const showcase = createShowcase({ sequence, save, now: () => t, warn, report: env.report, tr: env.tr });
  return {
    get time() { return t; }, set time(v) { t = v; },
    step, save, restore, cut, signal, said, sequence,
    // the scene's translator (its scripts' code has it as `tr`)
    tr: env.tr,
    // RN4: the keys h seconds on (f.toward); how many moves of camera keys run
    ahead,
    get cameraMoving() { return cameraN; },
    // the move of a key running now — one `over` seconds (not a path, a walk or an animate) —, or null; its value
    // `elapsed` seconds into it (an insert's opening runs its key's move from when the insert is finished: RN4)
    moveOf(key) { const a = drivers.get(key); return a && !a.done && a.verb === 'move' ? a : null; },
    moveAt,
    emit,
    // the scene opened (started anew): its time from now, its chance from its start
    open() { opened = t; seed = 1; },
    // the API for a script (who: 'scene' or an element's name — or 'showcase', with film; element: its spec object)
    api: (who, element, film = false) => context(null, who, element, film),
    // all that runs stopped, the scripts' listeners gone (the scene shown again: its scripts start anew)
    stop() { drop(); for (const a of running.slice()) finish(a, 'cancelled'); for (const tr of tracks.values()) for (const q of tr.queue.splice(0)) finish(q, 'cancelled'); listeners.length = 0; signals.clear(); },
    // what the page asks (MooodState.act): actor — a person's id, 'camera', 'state', 'light:<id>'; page — its id for the
    // action, whose events it hears
    act(page, actor, verb, args = []) {
      try {
        if (actor === 'state') {
          if (verb === 'set') return moveKey(args[0], args[1], args[2]?.over ?? 0, args[2]?.ease, null, page);
          if (verb === 'move') return moveKey(args[0], args[1], args[2]?.over ?? 0, args[2]?.ease, null, page, !!args[2]?.queue);
          if (verb === 'turn') return turnKey(args[0], args[1], args[2]?.over ?? 0, args[2]?.ease, null, page);
          if (verb === 'path') return pathKeys(args[0], args[1], args[2], null, page);
        }
        if (actor === 'camera') {
          if (verb === 'frame') return begin('camera', 'frame', args[0] || {}, null, framingIt, { track: 'camera', page });
          if (verb === 'cut') return instant('camera', 'cut', null, page, () => cut(args[0]));
        }
        if (typeof actor === 'string' && actor.startsWith('light:') && verb === 'fade') {
          const l = world.C.lights.find(x => x && String(x.id) === actor.slice(6));
          if (typeof l?.on === 'string') return moveKey(l.on, args[0], args[1]?.over ?? 1, args[1]?.ease, null, page);
        }
        const p = world.byId.get(String(actor))?.kind === 'person' ? personVerbs(actor, null, page, 'the game') : null;
        if (p && typeof p[verb] === 'function' && verb !== 'startOf') return p[verb](...args);
        warn(`the game: act(${JSON.stringify(actor)}, ${JSON.stringify(verb)}) — no such action (a person's: walk, go, do, turn, say, look, reach, with, wear, gait, on, here, still, mood, talk; 'state': set, move, turn, path; 'camera': frame, cut; 'light:<id>': fade)`);
      } catch (err) { env.report('the game', err); }
      return instant(String(actor), String(verb), null, page, () => {});
    },
    // the page's hand on an action it started: cancel, pause, resume
    control(page, how) { for (const a of byId.values()) if (a.page === page && typeof a[how] === 'function') a[how](); },
    get simulating() { return simulating; }, set simulating(v) { simulating = v; },
    // a cut waits for its shot: the whole story stands (2.4)
    get held() { return wait !== null; },
    // whether a person stands with the story now: a cut waits and an action of the story is on their body (a walk, a
    // go, a motion done once, a turn) — their player's time stands, the pose held; one doing nothing timed lives on
    // (their idle breath, a loop): 2.4
    stands(id) {
      if (wait === null) return false;
      let key = bodies.get(id);
      if (key === undefined) bodies.set(id, key = `person:${id}`);
      const cur = tracks.get(key)?.cur;
      return !!cur && !cur.done;
    },
    // the shot the story waits on being made ready (play/shots.js's; null: none — 2.3 step 5; the page's wait sign:
    // PG8): that of an until that goes on — not paused — whose condition, as it was last tried, asked a live shot's
    // `ready` and was told "no" (of several such untils, the first's) — and before them a cut that waits (2.4)
    get awaiting() {
      if (wait) return wait.shot;
      for (let i = 0; i < running.length; i++) { const a = running[i]; if (a.impl === untilIt && !a.paused && a.data.shot) return a.data.shot; }
      return null;
    },
    // the instant mode: on — all that runs finished at once, and all begun while it lasts
    get instant() { return instantly; },
    set instant(v) {
      instantly = !!v; hurried = 0; halted = false;
      // (a cut waiting: made now, with what it kept)
      if (instantly && wait) flush();
      if (instantly) for (const a of running.slice()) if (!a.owner) now(a);
    },
    // the showcase (play/showcase.js)
    showcase,
  };
}
