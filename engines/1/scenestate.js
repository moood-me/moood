// The scene's state and its scripts — the scene's own mechanics, knowing nothing of the game
// played on it. The state is a set of values (spec.state holds where they start: "time": "20:00",
// "dawn": 0, "girl": "waiting" …) — the scene's parameters. Whatever changes them, the scene reacts:
//   scripts — spec.script and any element's `script`: JS run in the page (a clock that ticks, a
//     ship that passes at 00:50, someone walking to where the state says);
//   the game — whatever runs on the scene sets them (its agents, its master): the page passes them on;
//   widgets — MooodState is global: get / set / on.
// The painting code reads the current values as e.state and is repainted when they change. A
// number may be set to move there over some seconds, along an easing curve (kit.js: smooth by
// default — it starts and stops gently; linear, in, out, back, spring, anticipate…). A value set
// is heard once, where it is set to (on('change')); a value moving there is heard each frame as it
// moves (on('move')). What a value was a moment ago stays known for a while (was): what lags
// behind — a coat's tail, hair, a head that follows — reads it. A cut (scene.cut) is a new shot:
// its values set at once and what came before it forgotten — was() reaches back no further, and
// what has inertia (the camera, a module's springs: e.cut) starts afresh. The scene's start is a
// cut too. A script may tell that something happened (scene.tell): the game decides what it means.
// A scene may describe its values (spec.states: each key's range or values, whether it moves
// smoothly, what it means) — for the game and the agents that turn them; then a
// key it doesn't describe, or a value outside what it says, is said (window.__mooodWarnings).
// A scene may be taken to where a game has got to in it (catchUp(then): what the game did since it showed it — the
// values it set, the seconds it waited, what it waited to be told — in order), all of it worked out without time
// before the scene is first seen: on one clock, the game's and the scene's — each value set at once where it goes, a
// path at its end, the scripts' rows, timers and every-s at their seconds, a motion done once as far as it got; what
// was still to come then comes in its own time after. Nothing is told the game meanwhile.
const MooodState = (() => {
  let stage = null, tell = null, save = null, t0 = performance.now();
  let values = {}, cur = {}, tweens = new Map(), listeners = [], timers = [], raf = 0, pending = {}, flushTimer = 0;
  // worked out without time (catchUp): the seconds gone so far, the timers waiting for theirs (an every-s: again each
  // time), what the scripts told, when each motion done once was begun — or null
  let rush = null;
  // the scripts' every-s now: [{seconds, fn}] — gone through by a catch-up too; and when the scripts have run
  let ticking = [], started = Promise.resolve();
  // each number's recent moves, to say what it was a moment ago: key → [{start, end, from, to, curve}]
  // (a jump: start = end); kept for PAST seconds
  const PAST = 10;
  // the engine's own values (engine.js, world.js: the camera a film moves, its fade): 0 until set
  const ENGINE = { camera_x: 0, camera_h: 0, camera_z: 0, camera_look: 0, camera_pitch: 0, camera_yaw: 0, camera_roll: 0, fade: 0 };
  let past = new Map();
  // the last cut (performance.now()): the scene's start or scene.cut; shots — how many scene.cuts
  // there have been (the scene's start is not one: the viewer keeps where they looked from); views — how many times
  // the camera has been elsewhere at once: a cut, or a camera's value set without `over` (a new shot — the engine makes
  // all it shows before it is shown)
  let cutAt = t0, shots = 0, views = 0;
  const CAMERA = new Set(Object.keys(ENGINE).filter(k => k.startsWith('camera_')));
  const report = (who, err) => (globalThis.__mooodErrors ||= []).push(`script ${who}: ${err && err.message || err}`);
  // the scene's description of its values (spec.states), when it has one; what is wrong with what is
  // set, said once each
  let states = null;
  const said = new Set();
  const say = msg => { if (said.has(msg)) return; said.add(msg); (globalThis.__mooodWarnings ||= []).push(msg); };
  // the keys the engine itself reads for the scene, each with what it takes (kit.js: keys — the
  // camera's and fade, an insert's, a place's, a redraw's, the light's looks, a light's on): every
  // scene's, described or not
  let own = MooodKit.keys(null);
  const TYPES = ['number', 'boolean', 'string'];
  // what is wrong with value v for the description d of key k, or null
  function wrong(k, d, v) {
    if (v === null) return null;
    const show = JSON.stringify(v);
    if (Array.isArray(d.values)) return d.values.some(x => JSON.stringify(x) === show) ? null : `state "${k}": ${show} is not one of ${d.values.map(x => JSON.stringify(x)).join(', ')}`;
    const type = Array.isArray(d.range) ? 'number' : d.type;
    if (type && typeof v !== type) return `state "${k}": ${show} — a ${type} expected`;
    if (Array.isArray(d.range) && (v < d.range[0] || v > d.range[1])) return `state "${k}": ${show} is outside its range [${d.range.join(', ')}]`;
    return null;
  }
  // spec.states as it is given: { key: {range: [min, max] | values: [...] | type, smooth, means} } (where
  // a value starts is the scene's `state`)
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
    states = st;
    for (const [k, v] of Object.entries(spec.state && typeof spec.state === 'object' ? spec.state : {})) check(k, v);
    return st;
  }
  // a value set: said if the scene's states don't have its key, or it is outside what they say (an
  // engine's key: what the engine takes, unless the states describe it)
  function check(key, value) {
    if (!states) return;
    const d = states[key] && typeof states[key] === 'object' ? states[key] : own.get(key);
    if (!d) { say(`state "${key}": not one of the scene's states`); return; }
    const w = wrong(key, d, value);
    if (w) say(w);
  }
  // A scene without states (above): the keys it knows are its starting state's (declared), the
  // engine's (own), those its scripts use (set, play, get, on, scene.state.x) or a widget reads, and
  // those its painting reads (the stage's: its elements' code, its modules — as they are painted). A
  // key set from outside it (who: the game, a widget, a direction, a render's --set) that none of
  // them knows is kept (strangers); unknown() says those that nothing has used by the time it is
  // asked — a render asks once its frames are taken, so a key read late, or only by what is painted
  // later, is not mistaken for a mistyped one. (A scene with states says a key they lack as it is
  // set: check.)
  let declared = new Set(), used = new Set(), strangers = new Map();
  function outside(key, who = 'a widget', start = true) {
    key = String(key);
    if (states || (start && declared.has(key)) || own.has(key) || strangers.has(key)) return;
    strangers.set(key, who);
  }
  function unknown() {
    const read = stage?.read?.() || new Set();
    return [...strangers].filter(([k]) => !used.has(k) && !read.has(k))
      .map(([k, who]) => `${who} sets "${k}": not in the scene's "state", and nothing in it read it — a mistyped key?`);
  }

  // where a move is at `now` (a move along a path: where its path is, `way` 0…1 of it)
  const along = (m, now) => {
    if (now >= m.end) return m.to;
    if (now <= m.start) return m.from;
    const u = m.curve((now - m.start) / (m.end - m.start));
    return m.way ? m.way(u) : m.from + (m.to - m.from) * u;
  };
  // what a number was `ago` seconds ago (as it is now if it hasn't moved since) — no further back
  // than the last cut: before it, it was as the cut found it
  function was(key, ago = 0) {
    const now = performance.now(), at = Math.max(cutAt, now - ago * 1000), moves = past.get(key);
    if (!moves || !moves.length) return cur[key];
    for (let i = moves.length - 1; i >= 0; i--) if (moves[i].start <= at) return along(moves[i], at);
    return moves[0].from;
  }
  function remember(key, move) {
    const moves = past.get(key) || [], gone = move.start - PAST * 1000;
    while (moves.length > 1 && moves[1].end < gone) moves.shift();
    moves.push(move);
    past.set(key, moves);
  }

  function publish() { cur = { ...values }; for (const [k, tw] of tweens) cur[k] = along(tw, performance.now()); stage?.setState(cur, was, sample, cutAt, shots, views); }
  // the moving values, where they are now (the stage asks as it paints a frame): each heard moving
  // from where it was last seen
  function sample() {
    if (!tweens.size) return;
    const now = performance.now(), before = cur, moving = [...tweens.keys()];
    for (const [k, tw] of tweens) if (now >= tw.end) tweens.delete(k);
    publish();
    for (const k of moving) if (cur[k] !== before[k]) emit('move', k, cur[k], before[k], k);
  }
  function tick() {
    raf = 0;
    sample();
    if (tweens.size) raf = requestAnimationFrame(tick);
  }
  function emit(ev, key, ...args) {
    for (const l of listeners.slice()) {
      if (l.ev !== ev || (l.key != null && l.key !== key)) continue;
      try { l.fn(...args); } catch (err) { report(l.who, err); }
    }
  }
  // changes go to the game's keeping (if it keeps them), a few at a time
  function keep(changes) {
    if (!save) return;
    Object.assign(pending, changes);
    clearTimeout(flushTimer);
    flushTimer = setTimeout(() => { const body = pending; pending = {}; save(body); }, 500);
  }
  // set a value; a number with `over` seconds moves there along `ease` (a curve's name, or u → u);
  // null removes it. kept: false — the game set it and keeps it itself
  // (told: false — the change not told yet; set says whether it changed, and its old value, for the one telling it)
  function set(key, value, over = 0, ease = 'smooth', { kept = true, told = true } = {}) {
    key = String(key);
    check(key, value === undefined ? null : value);
    const old = key in cur ? cur[key] : key in values ? values[key] : ENGINE[key];
    if (value === undefined) value = null;
    const now = performance.now();
    if (rush) { over = 0; if (value && typeof value === 'object' && value.motion && !value.loop) rush.motions.set(key, rush.at); }
    if (typeof value === 'number' && typeof old === 'number' && over > 0 && value !== old) {
      const move = { start: now, end: now + over * 1000, from: old, to: value, curve: MooodKit.anim.easeOf(ease) };
      tweens.set(key, move);
      remember(key, move);
      if (!raf) raf = requestAnimationFrame(tick);
    } else {
      tweens.delete(key);
      if (typeof value === 'number') remember(key, { start: now, end: now, from: typeof old === 'number' ? old : value, to: value, curve: MooodKit.anim.ease.linear });
    }
    const changed = JSON.stringify(old) !== JSON.stringify(value);
    if (changed && CAMERA.has(key) && !tweens.has(key)) views++;
    if (value === null) delete values[key]; else values[key] = value;
    publish();
    if (kept) keep({ [key]: value });
    if (changed && told) emit('change', key, value, old, key);
    return changed ? { key, value, old } : null;
  }
  // a cut: a new shot — the values in `changes` set at once (the camera elsewhere, people already
  // where they got to), the moves of what it names stopped, and the history before it forgotten; what
  // listens to their changes is told once all of them are set (it finds the shot whole, not half made)
  function cut(changes = {}) {
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('cut: an object of values expected');
    cutAt = performance.now(); shots++; views++;
    const told = Object.entries(changes).map(([k, v]) => set(k, v, 0, 'smooth', { told: false })).filter(Boolean);
    publish();
    for (const c of told) emit('change', c.key, c.value, c.old, c.key);
  }
  // several numbers moved together through points, as one movement: keys ['cart_a', 'cart_d'], points
  // [[a, d], …] (from where they are now); over `over` seconds or at `speed` (their units a second,
  // along the way), along `ease` — so it slows nowhere but where the curve says (a path cut into
  // set()s stops at every corner). Returns its seconds.
  function path(keys, points, { over = 0, speed = 0, ease = 'smooth' } = {}) {
    keys = keys.map(String);
    for (const [i, k] of keys.entries()) for (const p of points) check(k, Number(p[i]) || 0);
    const from = keys.map(k => Number(k in cur ? cur[k] : k in values ? values[k] : ENGINE[k]) || 0);
    const pts = [from, ...points.map(p => keys.map((_, i) => Number(p[i]) || 0))], to = pts[pts.length - 1];
    const ends = [0];
    for (let i = 1; i < pts.length; i++) ends.push(ends[i - 1] + Math.hypot(...pts[i].map((v, j) => v - pts[i - 1][j])));
    const length = ends[ends.length - 1], seconds = over > 0 ? over : speed > 0 ? length / speed : 0;
    if (!(seconds > 0 && length > 0) || rush) { keys.forEach((k, i) => set(k, to[i])); return rush ? seconds : 0; }
    const at = (u, j) => {
      const d = u * length;
      let i = 1;
      while (i < ends.length - 1 && ends[i] < d) i++;
      const f = (d - ends[i - 1]) / ((ends[i] - ends[i - 1]) || 1);
      return pts[i - 1][j] + (pts[i][j] - pts[i - 1][j]) * f;
    };
    const now = performance.now(), curve = MooodKit.anim.easeOf(ease), old = keys.map(k => cur[k]);
    keys.forEach((k, j) => {
      const move = { start: now, end: now + seconds * 1000, from: from[j], to: to[j], curve, way: u => at(u, j) };
      tweens.set(k, move);
      remember(k, move);
      values[k] = to[j];
    });
    if (!raf) raf = requestAnimationFrame(tick);
    publish();
    keep(Object.fromEntries(keys.map((k, j) => [k, to[j]])));
    keys.forEach((k, j) => { if (old[j] !== to[j]) emit('change', k, to[j], old[j], k); });
    return seconds;
  }
  // an angle in degrees, turned the short way round (from 170 to −170 is 20°, not 340°)
  function turn(key, degrees, over = 0, ease = 'smooth') {
    const old = Number(key in cur ? cur[key] : values[key]) || 0;
    set(key, old + ((((degrees - old) % 360) + 540) % 360 - 180), over, ease);
  }

  // A person of the scene shown (an element with "person": people.js), by their id — what a script does with them,
  // their keys set: do(motion, {loop, from, going}) — what they do; walk(points, {speed, steps}) — along points [[across,
  // distance]…] (metres; their place's keys moved, at `speed` m/s — 1.3 by default; they face the way they go, and stay
  // so; steps: false — moved as they are, no steps: sliding down a bank): its seconds; go(motion, {to | from: [across,
  // distance], turn, speed}) — a motion done once that ends at `to` (or begins at `from`) facing `turn` at its end: they
  // walk to where it begins, turn as it begins, and do it (its seconds till it begins); turn(degrees, over?) — where
  // they face standing; look(at) — what they look at (an id, "id#point", [across, distance, elevation]; null — ahead);
  // reach({r, l, foot_r, foot_l}) — what their hands and feet reach for (the same; null — back); with(parts) — which of
  // their parts they have with them; wear(fields) — their look's fields over it now ({barefoot: 'right'}; null — as
  // it is); gait(motion) — how they walk now (null — the cast's); on(point) — on another's arms ("mother#hands", or
  // {at, up}: that much higher; null — on their feet again); here(yes) — in the scene now or not (false: gone, not come
  // yet — not seen); still(on) — stopped in time (held as they are), or going on; startOf(motion, turn) — where a
  // motion done once begins, from where it ends; mood(expression) — a body's face; talk(on)
  let shown = null, acts = 0;
  function personOf(id, use, who, after) {
    const o = (shown?.objects || []).find(x => x && x.person && String(x.id) === id), k = n => `${id}_${n}`;
    if (!o) { say(`${who}: scene.person('${id}') — no person of that id in the scene`); return null; }
    const place = o.place || {};
    // where they stand now: their place's keys — those not set yet, the element's own across and distance (set so, for a
    // walk to go from there)
    const placed = () => [place.across, place.distance].map((key, i) => {
      if (typeof key !== 'string') return Number(i ? o.distance : o.across) || 0;
      if (!(key in cur) && !(key in values)) set(key, Number(i ? o.distance : o.across) || 0);
      return Number(key in cur ? cur[key] : values[key]) || 0;
    });
    return {
      do: (motion, opts = {}) => { use(k('do')); set(k('do'), { ...opts, motion, n: ++acts }); },
      walk(points, { speed = 1.3, steps = true } = {}) {
        if (typeof place.across !== 'string' || typeof place.distance !== 'string') { say(`${who}: ${id} walks by their "place": its across and distance are state keys`); return 0; }
        const pts = points.map(p => [Number(p[0]) || 0, Number(p[1]) || 0]), from = placed();
        const [a, b] = pts.length > 1 ? pts.slice(-2) : [from, pts[0]];
        if (b && Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-3) { use(k('turn')); set(k('turn'), Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI); }
        use([place.across, place.distance]);
        const seconds = path([place.across, place.distance], pts, { speed, ease: 'linear' });
        if (!steps) { use(k('steps')); set(k('steps'), false); after(seconds, () => set(k('steps'), true)); }
        return seconds;
      },
      go(motion, { to, from: begin, turn: end = 180, speed = 1.3 } = {}) {
        if (!Array.isArray(to) && !Array.isArray(begin)) { say(`${who}: ${id}.go(motion, {to | from: [across, distance], turn}) — where the motion ends, or begins`); return 0; }
        const off = stage?.startOf?.(id, motion, end);
        if (!off) { say(`${who}: ${id}.go — "${motion}": no such motion of theirs (yet)`); return 0; }
        const start = begin ?? [to[0] + off.across, to[1] + off.distance], stop = to ?? [begin[0] - off.across, begin[1] - off.distance];
        const here = placed(), gone = Math.hypot(start[0] - here[0], start[1] - here[1]);
        const seconds = gone > 0.03 ? this.walk([start], { speed }) : 0;
        // (turned as it begins: a turn of their own first, if they face otherwise)
        const turned = Math.abs(((((off.turn - (Number(cur[k('turn')]) || 0)) % 360) + 540) % 360) - 180) > 5, wait = turned ? 0.6 : 0;
        use(k('turn'), k('do'), place.across, place.distance);
        if (turned) after(seconds, () => turn(k('turn'), off.turn, wait));
        after(seconds + wait, () => { set(place.across, stop[0]); set(place.distance, stop[1]); set(k('turn'), end); set(k('do'), { motion, loop: false, n: ++acts }); });
        return seconds + wait;
      },
      turn: (degrees, over, ease) => { use(k('turn')); turn(k('turn'), degrees, over, ease); },
      // where their motion done once, ending facing `turn`, begins — from where it ends ({across, distance, turn}; null
      // while it is not here)
      startOf: (motion, end = 180) => stage?.startOf?.(id, motion, end) ?? null,
      look: at => { use(k('look')); set(k('look'), at ?? null); },
      reach: hands => { use(k('reach')); set(k('reach'), hands ?? null); },
      with: parts => { use(k('with')); set(k('with'), parts ?? null); },
      wear: fields => { use(k('wear')); set(k('wear'), fields ?? null); },
      gait: motion => { use(k('gait')); set(k('gait'), motion ?? null); },
      on: point => { use(k('on')); set(k('on'), point ?? null); },
      here: (yes = true) => { use(k('here')); set(k('here'), !!yes); },
      still: (on = true) => { use(k('still')); set(k('still'), !!on); },
      mood: expression => { use(k('mood')); set(k('mood'), expression); },
      talk: (on = true) => { use(k('talk')); set(k('talk'), on ? 1 : 0); },
    };
  }

  // the API a script gets: for the scene (id null) or for one element
  function api(who, id, element, shared) {
    const own = fn => (...a) => { try { fn(...a); } catch (err) { report(who, err); } };
    const use = (...keys) => { for (const k of keys.flat()) used.add(String(k)); };
    const after = (seconds, fn) => {
      if (rush) { rush.queue.push({ at: rush.at + Math.max(0, seconds), n: rush.n++, fn: own(fn), mine: true }); return; }
      const h = setTimeout(own(fn), Math.max(0, seconds) * 1000); timers.push(() => clearTimeout(h));
    };
    return {
      id, element,
      anim: MooodKit.anim, kit: shared.kit, lib: shared.lib,
      // the ground's height there (metres; spec.relief — 0 without one)
      ground: (across, distance) => (shared.ground ? shared.ground(across, distance) : 0),
      // (scene.state.x: x is a key the scene uses)
      get state() { return new Proxy(cur, { get: (o, k) => { if (typeof k === 'string') used.add(k); return o[k]; } }); },
      get time() { return (performance.now() - t0) / 1000; },   // seconds since the scene opened
      get: key => { use(key); return cur[key]; },
      set: (key, value, over, ease) => { use(key); set(key, value, over, ease); },
      cut: changes => { use(Object.keys(changes || {})); cut(changes); },
      turn: (key, degrees, over, ease) => { use(key); turn(key, degrees, over, ease); },
      path: (keys, points, opts) => { use(keys); return path(keys, points, opts); },
      was: (key, ago) => { use(key); return was(key, ago); },
      person: pid => personOf(String(pid), use, who, after),
      // a platformer's hero now: { across, elevation (metres), ground } — or null
      hero: () => stage?.hero?.() ?? null,
      // something happened in the scene (about one of its elements, if `about`): the game hears it
      tell: (text, about = null) => { if (rush) rush.told.push(String(text)); else tell?.(String(text), about); },
      // something wrong but not an error — a name it does not know — said once, in the scene's errors
      warn: text => say(`${who}: ${text}`),
      every(seconds, fn) {
        const tick = { seconds: Math.max(0.05, seconds), fn: own(fn) };
        ticking.push(tick);
        // (while worked out without time: on its clock — in time once it is done)
        if (rush) { rush.queue.push({ at: rush.at + tick.seconds, n: rush.n++, fn: tick.fn, every: tick.seconds }); rush.ticks.push(tick); } else tickOn(tick);
      },
      after,
      // a timeline: rows [at, key, value, over?, ease?] — or [at, fn] — where `at` is the second it
      // starts (from now), or '+s': s seconds after the row before it ends ('+0': as it ends); a
      // key in degrees turned the short way: [at, key, {turn: degrees}, over?, ease?]; numbers
      // moved together through points (path, above): [at, [keys], {path: points}, over, ease?];
      // a cut (above): [at, 'cut', {values}].
      // Returns when the last row ends (seconds from now). The camera it puts elsewhere at once (a cut, a camera's value
      // set without `over`) is made ready meanwhile (prepare).
      play(rows) {
        let end = 0, last = 0;
        const jumps = new Map();
        for (const row of rows) {
          const [at, a, b, over = 0, ease] = row;
          const start = typeof at === 'string' && at.startsWith('+') ? last + Number(at.slice(1)) : Number(at);
          if (typeof a !== 'function') use(a === 'cut' ? Object.keys(b || {}) : a);
          if (typeof a === 'function') after(start, a);
          else if (a === 'cut') after(start, () => cut(b));
          else if (Array.isArray(a) && b && typeof b === 'object' && Array.isArray(b.path)) after(start, () => path(a, b.path, { over, ease }));
          else if (b && typeof b === 'object' && 'turn' in b) after(start, () => turn(a, b.turn, over, ease));
          else after(start, () => set(a, b, over, ease));
          last = start + (typeof a === 'function' ? 0 : over);
          end = Math.max(end, last);
          const cam = a === 'cut' ? Object.entries(b || {}).filter(([k]) => CAMERA.has(k)) : CAMERA.has(a) && !(over > 0) && typeof b !== 'object' ? [[a, b]] : [];
          if (cam.length) jumps.set(start, { ...jumps.get(start), ...Object.fromEntries(cam) });
        }
        if (!rush) for (const [start, values] of jumps) stage?.prepare?.(values, start);
        return end;
      },
      // the camera will be as `values` say (its keys: camera_x, camera_z, camera_yaw…) in about `seconds`: what it will
      // see made ready meanwhile, with what the frames leave — that new shot is shown at once, made
      prepare: (values, seconds = 3) => { if (!rush) stage?.prepare?.(values, seconds); },
      // on('change', fn(value, old, key)) · on('change', key, fn) — a value set (with `over`: where it
      // goes, once); on('move', [key,] fn(value, last, key)) — a value moving, each frame (set with
      // `over`, path), till it stops; on('load', fn(state))
      on(ev, a, b) {
        const fn = typeof a === 'function' ? a : b, key = typeof a === 'function' ? null : String(a);
        if (key != null) use(key);
        listeners.push({ ev, key, fn, who });
      },
    };
  }

  // (re)starts the scene: its starting values, `state` on top (what the game kept), then the
  // scripts — once what they share (the world's modules, the scene's lib) is here. opts: stage;
  // modules — where the spec's modules come from (kit.js: {world, refs} or {texts});
  // tell(text, about) — what the scripts tell; save(changes) — the game keeps the values the scene
  // changes (none: they live as long as the page); jump — the game will take it to where it has got to (catchUp): its
  // scripts' time stands still till then
  let run = 0;
  function start(spec, state = {}, opts = {}) {
    stop();
    rush = opts.jump ? { at: 0, n: 0, queue: [], told: [], ticks: [], motions: new Map() } : null;
    stage = opts.stage || stage;
    tell = opts.tell || null;
    save = opts.save || null;
    own = MooodKit.keys(spec); said.clear(); shown = spec;
    states = describe(spec);
    for (const [k, v] of Object.entries(state)) check(k, v);
    values = { ...(spec?.state && typeof spec.state === 'object' ? spec.state : {}), ...state };
    declared = new Set(Object.keys(values)); used = new Set(); strangers = new Map();
    past = new Map();
    t0 = cutAt = performance.now();
    publish();
    emit('load', null, cur);
    const mine = ++run;
    const go = shared => {
      if (mine !== run) return; // started again meanwhile
      const exec = (code, who, id, element) => {
        if (typeof code !== 'string' || !code.trim()) return;
        try { MooodI18n.bind(shared.tr, 'scene', code)(api(who, id, element, shared)); } catch (err) { report(who, err); }
      };
      exec(spec?.script, 'scene', null, null);
      for (const o of spec?.objects || []) exec(o.script, o.name || o.id, o.id || null, o);
    };
    const shared = MooodKit.shared(spec, opts.modules);
    if (shared instanceof Promise) started = shared.then(go); else { go(shared); started = Promise.resolve(); }
  }
  // what the game did since it showed the scene, without time (above): then — [[key, value] | ['cut', {values}] |
  // ['wait', seconds] | ['heard', text, seconds?], …] — once the scripts have run and the stage has what the scene
  // needs (its people: where a motion begins is theirs). The values at once; a wait — the clock on as far, what falls
  // due meanwhile done at its second; heard — on till the scene tells it (or nothing waits, or the game would have
  // waited no longer: seconds, 180 if not said). Then the motions done once,
  // as far as they got (from: the seconds since); what was due later, in its own time from now on
  async function catchUp(then) {
    const mine = run;
    await started;
    await stage?.ready?.();
    if (mine !== run || !Array.isArray(then)) return;
    // (started without a jump: its every-s on the clock from now)
    if (!rush) {
      rush = { at: 0, n: 0, queue: [], told: [], ticks: [], motions: new Map() };
      for (const t of ticking) rush.queue.push({ at: t.seconds, n: rush.n++, fn: t.fn, every: t.seconds });
    }
    const next = () => rush.queue.reduce((a, b) => (!a || b.at < a.at || (b.at === a.at && b.n < a.n) ? b : a), null);
    const due = q => {
      rush.queue.splice(rush.queue.indexOf(q), 1);
      rush.at = q.at;
      if (q.every) rush.queue.push({ ...q, at: q.at + q.every, n: rush.n++ });
      q.fn();
    };
    const until = at => { for (let q; (q = next()) && q.at <= at;) due(q); rush.at = Math.max(rush.at, at); };
    try {
      for (const change of then) {
        const [what, v] = change;
        if (what === 'cut') cut(v);
        else if (what === 'wait') until(rush.at + Math.max(0, Number(v) || 0));
        else if (what === 'heard') {
          const end = rush.at + (Number(change[2]) || 180);
          for (let q; !rush.told.includes(v) && rush.queue.some(x => !x.every) && (q = next()).at <= end;) due(q);
          rush.told = rush.told.filter(x => x !== v);
        } else set(what, v, 0, 'smooth', { kept: false });
      }
      for (const [key, at] of rush.motions) {
        const m = values[key];
        if (m && typeof m === 'object' && m.motion && !m.loop) values[key] = { ...m, from: (Number(m.from) || 0) + rush.at - at };
      }
    } finally {
      const later = rush.queue.filter(q => q.mine), now = rush.at, ticks = rush.ticks;
      rush = null;
      for (const q of later) { const h = setTimeout(q.fn, (q.at - now) * 1000); timers.push(() => clearTimeout(h)); }
      ticks.forEach(tickOn);
    }
    cutAt = performance.now(); shots++; views++;
    publish();
  }
  function tickOn(tick) { const h = setInterval(tick.fn, tick.seconds * 1000); timers.push(() => clearInterval(h)); }
  function stop() {
    for (const off of timers) off();
    // the scripts' listeners go; widgets' stay (a widget lives on while its html is the same)
    timers = []; ticking = []; listeners = listeners.filter(l => l.who === 'widget'); tweens.clear();
    cancelAnimationFrame(raf); raf = 0;
  }

  // set from outside the scene (above) — by `who` (default: a widget, which has MooodState as it is): a
  // key it does not know is said
  return {
    start, stop, was, catchUp,
    set: (key, value, over, ease, opts = {}) => { outside(key, opts.who); set(key, value, over, ease, opts); },
    cut: (changes, { who } = {}) => { for (const k of Object.keys(changes || {})) outside(k, who); cut(changes); },
    turn: (key, degrees, over, ease) => { outside(key); turn(key, degrees, over, ease); },
    path: (keys, points, opts) => { keys.forEach(k => outside(k)); return path(keys, points, opts); },
    // the camera will be as `values` say in about `seconds` (a game about to move it): made ready meanwhile
    prepare: (values, seconds = 3) => stage?.prepare?.(values, seconds),
    // keys put into the starting state from outside (a render's --state, over the spec's): kept as
    // strangers (above) unless the scene knows them
    check: (keys, who) => keys.forEach(k => outside(k, who, false)),
    // the keys set from outside that nothing in the scene has used so far: what is said of each
    unknown,
    // the shown scene's description of its values (spec.states), or null
    get states() { return states; },
    get: key => { used.add(String(key)); return cur[key]; },
    all: () => cur,
    on: (ev, a, b) => api('widget', null, null, { kit: {}, lib: {} }).on(ev, a, b),
  };
})();
