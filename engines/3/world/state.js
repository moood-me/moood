// The scene's state: named values (spec.state holds where they start: "dawn": 0, "door": "shut" …) — the scene's
// parameters, the shared truth of what is so. The scene's scripts, its sequences, the game, widgets set them; the scene
// follows them (its places, its paintings, its light). They are kept by the scene's time (seconds: the steps, the
// director, a render's moments and a seek's steps go by the same); the keys changed are listed for the step — so
// only what reads a key is touched when it moves.
//   What takes time is the director's (play/director.js: a key moved `over` seconds, along a path, turned — an action,
// pausable, replaceable, saved): it drives the keys frame by frame (drive) after saying where they go (aim). Here: a
// value set at once (set), a new shot (cut: its values at once, what came before forgotten), what a number was a moment
// ago (was — what lags behind reads it: PAST seconds back, no further than the last cut).
//   A scene may describe its values (spec.states); then a key it lacks, or a value outside what it says, is said;
// without a description, a key set from outside that nothing in the scene uses is said once asked (unknown).
//   Changes are heard: emit('change', key, value, old) once as a value is set (moved: where it goes), emit('move', key,
// value, last) each frame while it moves. The frame drains the keys changed since the last (changed()).

import { empty } from '../base.js';

const PAST = 10;
const TYPES = ['number', 'boolean', 'string'];
// the engine's own values that a film moves (the camera's): 0 until set
const ENGINE = { camera_x: 0, camera_h: 0, camera_z: 0, camera_look: 0, camera_pitch: 0, camera_yaw: 0, camera_roll: 0 };
// (and what the camera rides: camera_on — set, the camera is elsewhere at once)
const CAMERA = new Set([...Object.keys(ENGINE).filter(k => k.startsWith('camera_')), 'camera_on']);
// what the operator is told to frame: set with no glide (camera_glide 0), the camera is there at once — a new shot
const FRAMING = new Set(['camera_target', 'camera_shot', 'camera_frame']);
const same = (a, b) => a === b || (typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b));

// kit: world/kit.js's (its keys); emit(type, key, value, old): what is heard; say(text): a warning, once
export function createState({ kit, emit, say }) {
  // now: the values as they are this moment (mutated in place — read it, never keep it); target: where each is going
  const now = {}, target = {};
  let version = 0, t = 0, cutAt = 0, shots = 0, views = 0;
  // each number's recent values: key → a ring of [time, value] pairs (PAST seconds), for was()
  const past = new Map();
  // the keys changed since the frame last drained them, each once (two lists by turns: one read while the other fills)
  let changedList = [], spareList = [];
  const changedAt = new Map();
  let drains = 0;
  // (each key's batch it was last set at once in — a value set, a cut — not moved. A move after it in the same batch
  // (a walk begun in the step it was put somewhere) leaves it: the jump was made all the same, and the move goes on
  // from where it put the key)
  const jumpedAt = new Map();
  let states = null, own = kit.keys(null), declared = new Set(), used = new Set(), strangers = new Map();

  function touch(key) {
    version++;
    if (changedAt.get(key) !== drains) { changedAt.set(key, drains); changedList.push(key); }
  }
  const valueOf = key => (key in now ? now[key] : ENGINE[key]);
  // (a number's history: a ring of times and values, oldest first, as long as PAST seconds of frames need — grown as
  // they do, never made anew each frame)
  function remember(key, value) {
    if (typeof value !== 'number') { past.delete(key); return; }
    let h = past.get(key);
    if (!h) past.set(key, h = { t: new Float64Array(16), v: new Float64Array(16), head: 0, n: 0 });
    let cap = h.t.length;
    if (h.n) { const last = (h.head + h.n - 1) % cap; if (h.t[last] === t) { h.v[last] = value; return; } }
    // (what is older than PAST goes — but the one just before it: what it was then)
    while (h.n > 1 && h.t[(h.head + 1) % cap] < t - PAST) { h.head = (h.head + 1) % cap; h.n--; }
    if (h.n === cap) {
      const T = new Float64Array(cap * 2), W = new Float64Array(cap * 2);
      for (let i = 0; i < h.n; i++) { T[i] = h.t[(h.head + i) % cap]; W[i] = h.v[(h.head + i) % cap]; }
      h.t = T; h.v = W; h.head = 0; cap *= 2;
    }
    const i = (h.head + h.n) % cap;
    h.t[i] = t; h.v[i] = value; h.n++;
  }
  // what a number was `ago` seconds ago — no further back than the last cut; between two moments, as at the earlier
  function was(key, ago = 0) {
    const at = Math.max(cutAt, t - ago), h = past.get(key);
    if (!h || !h.n || ago <= 0) return valueOf(key);
    const cap = h.t.length;
    if (h.t[h.head] > at) return h.v[h.head];
    let lo = 0, hi = h.n - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (h.t[(h.head + m) % cap] <= at) lo = m; else hi = m - 1; }
    return h.v[(h.head + lo) % cap];
  }
  // how fast a number moves now (units a second): from its sample at or before 50 ms ago (no further back than the last
  // cut) to now, over the time truly between them
  function speed(key) {
    const h = past.get(key), a = valueOf(key);
    if (!h || h.n < 2 || typeof a !== 'number') return 0;
    const cap = h.t.length, at = Math.max(cutAt, t - 0.05);
    if (h.t[h.head] > at) return 0;
    let lo = 0, hi = h.n - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (h.t[(h.head + m) % cap] <= at) lo = m; else hi = m - 1; }
    const i = (h.head + lo) % cap, dt = t - h.t[i];
    return dt > 1e-9 ? (a - h.v[i]) / dt : 0;
  }

  // ── the scene's description of its values ──
  function wrong(k, d, v) {
    if (v === null) return null;
    const show = JSON.stringify(v);
    if (Array.isArray(d.values)) return d.values.some(x => JSON.stringify(x) === show) ? null : `state "${k}": ${show} is not one of ${d.values.map(x => JSON.stringify(x)).join(', ')}`;
    const type = Array.isArray(d.range) ? 'number' : d.type;
    if (type && typeof v !== type) return `state "${k}": ${show} — a ${type} expected`;
    if (Array.isArray(d.range) && (v < d.range[0] || v > d.range[1])) return `state "${k}": ${show} is outside its range [${d.range.join(', ')}]`;
    return null;
  }
  function describe(spec) {
    const st = spec?.states;
    if (st == null) return null;
    if (typeof st !== 'object' || Array.isArray(st)) { say('states: { key: {range | values | type, smooth, means} } expected'); return null; }
    for (const [k, d] of Object.entries(st)) {
      if (!d || typeof d !== 'object' || Array.isArray(d)) { say(`states.${k}: an object expected`); continue; }
      if (d.range !== undefined && !(Array.isArray(d.range) && d.range.length === 2 && d.range.every(Number.isFinite) && d.range[0] < d.range[1])) say(`states.${k}: "range" is [min, max]`);
      if (d.values !== undefined && !(Array.isArray(d.values) && d.values.length)) say(`states.${k}: "values" is the list of what it can be`);
      if (d.type !== undefined && !TYPES.includes(d.type)) say(`states.${k}: "type" is one of ${TYPES.join(', ')}`);
      if ('start' in d) say(`states.${k}: where a value starts is the scene's "state" ("state": {"${k}": …}), not its description`);
    }
    return st;
  }
  function check(key, value) {
    if (!states) return;
    const d = states[key] && typeof states[key] === 'object' ? states[key] : own.get(key);
    if (!d) { say(`state "${key}": not one of the scene's states`); return; }
    const w = wrong(key, d, value);
    if (w) say(w);
  }
  // a key set from outside (who: the game, a widget, a render's --set): kept, if nothing in the scene knows it, to be said
  // later if nothing uses it by then (unknown)
  function outside(key, who = 'a widget', start = true) {
    key = String(key);
    if (states || (start && declared.has(key)) || own.has(key) || strangers.has(key)) return;
    strangers.set(key, who);
  }

  // a value set at once (null removes it). told: false — heard later (a cut tells its own once all is set). → the change
  // ({ key, value, old }) or null
  function set(key, value, { told = true } = {}) {
    key = String(key);
    if (value === undefined) value = null;
    check(key, value);
    const old = valueOf(key), changed = !same(old, value);
    if (changed && (CAMERA.has(key) || (FRAMING.has(key) && valueOf('camera_glide') === 0))) views++;
    if (value === null) { delete now[key]; delete target[key]; } else now[key] = target[key] = value;
    remember(key, value);
    if (changed) jumpedAt.set(key, drains);
    if (changed) { touch(key); if (told) emit('change', key, value, old); }
    return changed ? { key, value, old } : null;
  }
  // a number about to be driven to `value` (the director's move): where it goes, heard once
  function aim(key, value) {
    key = String(key);
    check(key, value);
    const old = valueOf(key);
    target[key] = value;
    if (!same(old, value)) emit('change', key, value, old);
  }
  // a number where what drives it has it this frame: heard as moving
  function drive(key, value) {
    const old = valueOf(key);
    if (old === value) return;
    now[key] = value;
    remember(key, value);
    touch(key);
    emit('move', key, value, old);
  }
  // a new shot: the values at once, what came before forgotten; heard once all is set
  function cut(changes = {}) {
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('cut: an object of values expected');
    cutAt = t; shots++; views++;
    const told = [];
    for (const k in changes) { const c = set(k, changes[k], { told: false }); if (c) told.push(c); }
    for (const c of told) emit('change', c.key, c.value, c.old);
  }
  // the keys changed since the last call (the array is reused: read it before the next)
  function changed() {
    const out = changedList;
    changedList = spareList;
    spareList = out;
    empty(changedList);
    drains++;
    return out;
  }

  return {
    now, CAMERA,
    get version() { return version; },
    get time() { return t; }, set time(v) { t = v; },
    get cutAt() { return cutAt; }, get shots() { return shots; }, get views() { return views; },
    get states() { return states; },
    get: key => { used.add(String(key)); return valueOf(key); },
    value: valueOf, was, speed, set, aim, drive, cut, changed, check, outside,
    // whether a key of the batch drained last was set at once (a teleport, a cut) rather than moved
    jumped: key => jumpedAt.get(key) === drains - 1,
    use: key => used.add(String(key)),
    // what the game keeps of a value: where it is going
    targetOf: key => (key in target ? target[key] : valueOf(key)),
    // (re)started: the spec's starting values, `state` over them (what the game kept) — a cut
    start(spec, state = {}) {
      own = kit.keys(spec);
      states = describe(spec);
      for (const k in state) check(k, state[k]);
      for (const k of Object.keys(now)) { delete now[k]; touch(k); }
      for (const k of Object.keys(target)) delete target[k];
      past.clear();
      Object.assign(now, spec?.state && typeof spec.state === 'object' ? spec.state : {}, state);
      Object.assign(target, now);
      for (const k in now) touch(k);
      declared = new Set(Object.keys(now)); used = new Set(); strangers = new Map();
      // (a new shot)
      cutAt = t; shots++; views++;
    },
    // what a key set from outside that nothing used, said
    unknown: () => [...strangers].filter(([k]) => !used.has(k))
      .map(([k, who]) => `${who} sets "${k}": not in the scene's "state", and nothing in it read it — a mistyped key?`),
    // ── saved and restored (the director's save): the values, as data; restored as a cut (was reaches back no further) ──
    save: () => ({ values: structuredClone(now), targets: structuredClone(target), shots, views }),
    restore(data, at) {
      t = at;
      for (const k of Object.keys(now)) { delete now[k]; touch(k); }
      for (const k of Object.keys(target)) delete target[k];
      Object.assign(now, structuredClone(data.values));
      Object.assign(target, structuredClone(data.targets));
      for (const k in now) touch(k);
      past.clear();
      shots = data.shots; views = data.views; cutAt = at;
    },
  };
}
