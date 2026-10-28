// An element's animate — the body of function (e) — and the `e` it is given (the painting's `e` is the easel's, in the
// artist: SH8). It runs every step while its element's node is shown (5.16), cheaply, and paints nothing: it moves the
// layers (e.layer(name).rotate = …), sets its shader's uniforms (e.uniform), dims its glows (e.glow), sets its
// particles off (e.burst), marks the points that move (e.at), reads time (e.t), the state as it is now, what was a
// moment ago (e.was, e.speed), where other things are (e.point, e.where), and keeps what it needs from step to step in
// e.mem (saved and restored with the scene). What it writes goes into the world's tables: writing the value already
// there changes nothing (WT3).
import { STAGE } from './spec.js';

// a layer's pose by name: its place in a row of world.layers.pose (the eighth number, `length`, is the world's: WT3)
const POSE = Object.freeze({ x: 0, y: 1, rotate: 2, scaleX: 3, scaleY: 4, alpha: 5, brightness: 6 });
const POSE_KEYS = ['x', 'y', 'rotate', 'scaleX', 'scaleY', 'alpha', 'brightness'];

// el: world.js's runtime element. env: { state, world, kit (the world's modules and the forms' constructors), lib, anim,
// warn(text), error(err), debug — notes are kept (?debug) } → { animate(t, dt) }
export function animateContext(el, env) {
  const { state, world } = env, E = el.spec, T = world.tables;
  const warnOnce = text => env.warn(`${E.who}: ${text}`);
  const t0 = { t: 0, dt: 0 };
  // (a number animate gives the engine — a uniform, a layer's pose, a glow's strength — that is no number (NaN,
  // Infinity): not taken, the last kept; said once for each thing it was given for)
  const notNumbers = new Set();
  const notNumber = (what, v) => { if (!notNumbers.has(what)) { notNumbers.add(what); warnOnce(`animate: ${what} given ${v}, not a number — not taken (the last kept)`); } };
  // a layer by name: its row found again only when the element's sheets are other ones (el.version). Reading a
  // property of a layer the element does not have gives 0 (the scenes test a layer's presence so). Until the element
  // has a painting it has no layers yet: a write is dropped, nothing said — and the same while a painting is being made
  // again for a state that came (a ship's other yards): its layers are those of the state before, the next step's are right
  const handles = new Map();
  const current = () => el.isPainted && !el.toPaint && !el.job;
  const handleOf = name => {
    let h = handles.get(name);
    if (h) return h;
    let slot = null, seen = -1;
    const L = () => { if (seen !== el.version) { seen = el.version; slot = el.byLayer.get(name) ?? null; } return slot; };
    const set = (k, v) => {
      const s = L();
      if (!s) { if (current()) warnOnce(`animate: there is no layer "${name}" (its painting's e.layer)`); }
      else if (!Number.isFinite(+v)) notNumber(`layer "${name}" ${POSE_KEYS[k]}`, v);
      else if (T.setPose(s.layer, k, +v) && k === POSE.alpha) world.layerShown(el, s);
    };
    const get = k => { const s = L(); return s ? T.layers.pose[8 * s.layer + k] : 0; };
    h = {
      get x() { return get(POSE.x); }, set x(v) { set(POSE.x, v); },
      get y() { return get(POSE.y); }, set y(v) { set(POSE.y, v); },
      get rotate() { return get(POSE.rotate); }, set rotate(v) { set(POSE.rotate, v); },
      get scaleX() { return get(POSE.scaleX); }, set scaleX(v) { set(POSE.scaleX, v); },
      get scaleY() { return get(POSE.scaleY); }, set scaleY(v) { set(POSE.scaleY, v); },
      get scale() { return get(POSE.scaleX); }, set scale(v) { set(POSE.scaleX, v); set(POSE.scaleY, v); },
      get alpha() { return get(POSE.alpha); }, set alpha(v) { set(POSE.alpha, v); },
      get brightness() { return get(POSE.brightness); }, set brightness(v) { set(POSE.brightness, v); },
    };
    handles.set(name, h);
    return h;
  };
  const pointOut = [0, 0], whereOut = { across: 0, distance: 0, elevation: 0 }, v3 = new Float64Array(3);
  // (people read a point of it — stand or sit on it, look at it, reach for it: it is moved before them this step — and
  // it reads a person's point: a circle; that point is where they were the step before — said, as it lags behind them)
  const ahead = ref => {
    if (!world.beforePeople || typeof ref !== 'string') return;
    if (world.byId.get(world.refOf(ref).id)?.kind === 'person') warnOnce(`animate: people read a point of it (their "on", "look" or "reach"), so it is moved before them — and it reads "${ref}": that is where they were the step before`);
  };
  const names = E.shader ? new Map(E.shader.names.map((n, i) => [n, i])) : new Map();
  const e = {
    id: E.id,
    // the stage's width in its heights (the sky's: the full circle looking round)
    aspect: E.kind === 'sky' && world.C.camera.round ? 2 * Math.PI : STAGE,
    // what the screen shows now, stage heights: { safe, seen } (world.view — read-only)
    get view() { return world.view; },
    get t() { return t0.t; }, get dt() { return t0.dt; },
    // seconds since the last cut (the scene's start, scene.cut): what keeps its own motion starts afresh after it
    get cut() { return t0.t - state.cutAt; },
    state: state.now,
    was: (key, ago) => state.was(String(key), ago),
    speed: key => state.speed(String(key)),
    // what it keeps from step to step (a spring, a phase): saved and restored with the scene
    mem: el.mem,
    layer: handleOf,
    uniform(name, value) {
      const i = names.get(name);
      if (i === undefined) warnOnce(`animate: "${name}" is not one of its shader's uniforms (${[...names.keys()].join(', ') || 'none'})`);
      else if (!Number.isFinite(+value)) notNumber(`uniform "${name}"`, value);
      else world.uniform(el, i, +value);
    },
    // particles: a burst set off where it is now (its "burst": count, or as many as said)
    burst(count) {
      if (!E.particles?.burst) warnOnce('animate: e.burst sets off the bursts of a particles element that has a "burst"');
      else world.emitters.burst(el, count);
    },
    // its own glow (e.light by name; null: the unnamed one) this much of its strength this step
    glow(name, k) {
      const i = el.glowIndex.get(name == null ? null : String(name));
      // (till it has a painting it has no glows yet, nor while it is painted again: dropped, nothing said)
      if (i === undefined) { if (current()) warnOnce(`animate: e.glow(${JSON.stringify(name)}) — it paints no such glow (e.light, ${name == null ? 'unnamed' : 'by that name'})`); return; }
      if (!Number.isFinite(+k)) { notNumber(`e.glow(${JSON.stringify(name)})`, k); return; }
      if (el.glowK[i] !== +k) { el.glowK[i] = +k; world.glowed(el); }
    },
    // a point that moves (this step's): marked from what animate knows — the camera, the lines and the page follow it
    at(x, y, name) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const k = name == null ? null : String(name), p = el.marked.get(k);
      if (p) { p.x = x; p.y = y; p.tick = T.step; } else el.marked.set(k, { x, y, part: -1, layer: -1, tick: T.step });
    },
    // where a point of the world is in its painting now ([x, y], its units; null if none) — the array is reused
    point(ref) {
      ahead(ref);
      if (!world.pointOf(ref, v3)) return null;
      return world.toPainting(el, v3, pointOut) ? pointOut : null;
    },
    // … and in the world ({ across, distance, elevation over the land there }, metres; null if none) — the object is
    // reused
    where(ref) {
      ahead(ref);
      if (!world.pointOf(ref, v3)) return null;
      whereOut.across = v3[0]; whereOut.distance = -v3[2]; whereOut.elevation = v3[1] - world.groundAt(v3[0], -v3[2]);
      return whereOut;
    },
    get spot() { return el.spot; },
    get hero() { return world.hero?.id === E.id ? world.hero : null; },
    anim: env.anim, kit: env.kit, lib: env.lib,
    debug(value, x, y) { if (env.debug) el.animNotes.push({ value, at: Number.isFinite(x) && Number.isFinite(y) ? { x, y, part: -1, layer: -1 } : null }); },
    warn: warnOnce,
  };
  return {
    animate(t, dt) {
      t0.t = t; t0.dt = dt;
      if (el.animNotes.length) el.animNotes.length = 0;
      const fn = E.animate;
      if (!fn) return;
      try { fn(e); } catch (err) { env.error(err); }
    },
  };
}
