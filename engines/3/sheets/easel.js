// The easel (SH8): what an element's paint code is given, in the artist's thread — the canvas `g` (a Recorder:
// sheets/recorder.js) and `e` —, and what a painting made is (SH6 'made').
//   The paint code — the body of function (g, e) — paints what the element is now, from the state it is given, in its
// own units (Canvas 2D: x right, y down, origin at its anchor; a plane seen from above, origin at its middle; the sky
// and an insert in stage heights). It never reads time and sees only its easel (LG3): the state (each key it reads
// noted: the painting is made again when one changes), e.spot, the kit, the lib, the anim tools. As it paints it says
// what it has: points (e.at), lights (e.light), parts standing at their own depths (e.part), layers moved on the GPU
// (e.layer), notes (e.debug) — and, for a thing with roundness, a form (e.form: 5.23).
//   A form: e.form(fn[, { closed, ground }]) — fn(u, v) → [x, y, z] in the element's own metres, u and v running 0…1
// across its painting. The easel samples it on the engine's grid, FORM.SIDE points a side (row by row in v), refuses a
// result that is not three numbers and a grid of no area (the make fails, as where the code throws), and gives the
// recording its `ground` — the colour under the paint, taken opaque, a mid grey if none is given —, laid under the
// finished painting where it is rastered: the sheet is opaque whatever the code paints or erases. An element with a
// form has one painting: what else it may not have the scene's thread says (world/world.js), with the element.
//   A painting made: { rec, form: { points, closed } | null, parts: [{ dx, dz, box, rec }], layers: [{ name, opts,
// rec }], lights: [{ x, y, r, color, strength, name | null, part, layer }], points: [[name | null, { x, y, part,
// layer }]], notes: [{ value, at: { x, y, part, layer } | null }], reads: [key], seen: [[key, json]], errors,
// warnings } — x, y in the painting's units; part / layer: the index in parts / layers the thing was painted in, −1 the
// base. The recordings are live (Recording): the artist sends them.
//   A layer that drifts wraps round: its box is laid to a whole number of level-0 px along the way it drifts — widened
// by the remainder (SH7) —, and that box is the layer's (`opts.box`: the quad's rect and the recording's).
//   A painting whose code threw — the element's, a part's, a layer's —, whose form was refused (a result that is not
// three numbers, a grid of no area, a second form, a form in a part or a layer: 5.23), or that has no code to run, is
// no painting: `rec` is null, with no form, part or layer (`errors` say why): the scene's thread takes nothing from it
// and what the element had stays (SH6, 2.4). A mistake that leaves the painting whole (e.light given no numbers, a
// part's box that is none) is an error beside a real recording.
import { FORM, SHEET } from '../base.js';
import { STAGE } from '../world/spec.js';
import { Recorder } from './recorder.js';
import { px0 } from './page.js';

// a seeded random 0…1 (the same sequence each painting: seeded by the element's id)
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const GROUND = '#808080';

// a layer's options checked (the language's): { pivot: [x, y], wind: { strength, gust, scale }, drift: [x, y], flicker,
// shimmer, blend, depth, box } — an unknown one, or one that is not what it should be, said and left out; so is
// "blend": "screen", which engine 3 has not built (LG7)
const LAYER_OPTS = ['pivot', 'wind', 'drift', 'flicker', 'shimmer', 'blend', 'depth', 'box'];
function layerOpts(opts, warn) {
  const o = opts && typeof opts === 'object' ? opts : {}, out = {};
  const nums = (v, n) => Array.isArray(v) && v.length === n && v.every(Number.isFinite);
  if (o.pivot != null) { if (nums(o.pivot, 2)) out.pivot = o.pivot.slice(); else warn('layer: "pivot" is [x, y] (its units)'); }
  // wind: how far its free end bends (0…1), toward which end it is free (the pivot's opposite), how gusty
  if (o.wind != null) {
    const w = typeof o.wind === 'number' ? { strength: o.wind } : o.wind;
    if (w && Number.isFinite(w.strength)) out.wind = { strength: w.strength, gust: Number.isFinite(w.gust) ? w.gust : 0.5, scale: Number.isFinite(w.scale) ? w.scale : 1 };
    else warn('layer: "wind" is a strength (0…1) or { strength, gust, scale }');
  }
  // drift: scrolled, wrapping, [x, y] its units a second
  if (o.drift != null) { if (nums(o.drift, 2)) out.drift = o.drift.slice(); else warn('layer: "drift" is [x, y] (its units a second)'); }
  for (const k of ['flicker', 'shimmer']) if (o[k] != null) { if (Number.isFinite(o[k])) out[k] = o[k]; else warn(`layer: "${k}" is 0…1`); }
  if (o.blend != null) {
    if (['normal', 'add', 'multiply'].includes(o.blend)) out.blend = o.blend;
    else if (o.blend === 'screen') warn('layer: "blend": "screen" is not built in engine 3 — drawn as normal');
    else warn('layer: "blend" is normal, add or multiply');
  }
  if (o.depth != null) { if (Number.isFinite(o.depth)) out.depth = o.depth; else warn('layer: "depth" is metres before the card (+) or behind it (−)'); }
  if (o.box != null) { if (nums(o.box, 4) && o.box[2] > o.box[0] && o.box[3] > o.box[1]) out.box = o.box.slice(); else warn('layer: "box" is [left, top, right, bottom] (its units)'); }
  for (const k of Object.keys(o)) if (!LAYER_OPTS.includes(k)) warn(`layer: "${k}" is not one of its options (${LAYER_OPTS.join(', ')})`);
  return out;
}
// (what a note carries, as it can be sent to another thread)
const sendable = v => { try { return structuredClone(v); } catch { return String(v); } };

// C: the compiled spec (world/spec.js: the same as the thread's, by index); shared: kit.shared's { anim, lib, kits };
// land: the land function (across, distance) → metres, or null; state: the artist's mirror of the state's keys; late:
// what the compiled spec says after it was compiled (the list its `warn` fills: an element's paint code is made into a
// function when it is first read — here —, and a text that is no function is said then).
// → make(index, as, spot): element `index` painted — as: a shot's values over the state, or null; spot: where it
// stands ({ across, distance, elevation, ground })
export function createEasel(C, shared, land, state, late) {
  return function make(index, as, spot) {
    const E = C.elements[index], errors = [], warnings = [], told = new Set(), reads = new Set();
    const warn = text => { text = String(text); if (!told.has(text)) { told.add(text); warnings.push(text); } };
    const fail = err => { errors.push(String(err?.message || err)); };
    // (threw: its code threw, its form was refused, or there was none to run — it is no painting)
    let threw = false;
    const refuse = why => { fail(why); threw = true; };
    const made = { rec: null, form: null, parts: [], layers: [], lights: [], points: [], notes: [], reads: null, seen: null, errors, warnings };
    if (!E) { fail(`there is no element ${index}`); made.reads = []; made.seen = []; return made; }
    const o = E.o, box = E.box;
    // the state as it is painted from: a shot's values over the mirror's; each key read noted
    const valueAs = k => (as && k in as ? as[k] ?? undefined : state[k]);
    const stateRead = new Proxy(state, {
      get: (v, k) => { if (typeof k !== 'string') return v[k]; reads.add(k); return valueAs(k); },
      has: (v, k) => { if (typeof k === 'string') reads.add(k); return as && k in as ? as[k] != null : k in v; },
      ownKeys: v => { const keys = as ? [...new Set([...Reflect.ownKeys(v), ...Object.keys(as)])].filter(k => !(k in as) || as[k] != null) : Reflect.ownKeys(v); for (const k of keys) if (typeof k === 'string') reads.add(k); return keys; },
      getOwnPropertyDescriptor: (v, k) => (as && k in as ? (as[k] != null ? { value: as[k], writable: true, enumerable: true, configurable: true } : undefined) : Reflect.getOwnPropertyDescriptor(v, k)),
      set: (v, k) => { warn(`a painting reads the state, it does not set it ("${String(k)}"): scripts and actions do`); return true; },
      deleteProperty: (v, k) => { warn(`a painting reads the state, it does not set it ("${String(k)}"): scripts and actions do`); return true; },
    });
    const recorder = rect => {
      const rec = new Recorder(rect, warn);
      rec.fillStyle = rec.strokeStyle = typeof o.color === 'string' ? o.color : '#000000';
      rec.lineCap = rec.lineJoin = 'round';
      return rec;
    };
    // what is being painted now: the element, one of its parts, one of its layers
    let cur = { rec: recorder(box), part: -1, layer: -1 };
    const base = cur, points = new Map(), rnd = seeded(hash(E.id ?? `#${E.index}`));
    // a point of what is painted now, in its painting's units (through what the code did to the canvas since)
    const mapped = (x, y, p) => { const m = cur.rec.m; p.x = m[0] * x + m[2] * y + m[4]; p.y = m[1] * x + m[3] * y + m[5]; return p; };
    const scaleNow = () => { const m = cur.rec.m; return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])); };
    const e = {
      id: E.id,
      rnd,
      // the stage's width in its heights (the sky's: the full circle looking round)
      aspect: E.kind === 'sky' && C.camera.round ? 2 * Math.PI : STAGE,
      get area() { return box.slice(); },
      get state() { return stateRead; },
      anim: shared.anim, kit: shared.kits, lib: shared.lib,
      ground: (across, distance) => (land ? land(across, distance) : 0),
      // where it stands (metres): across, distance, its elevation and the ground's under it — its place's keys read
      get spot() { if (E.place) for (const f in E.place) reads.add(E.place[f]); return { across: spot.across, distance: spot.distance, elevation: spot.elevation, ground: spot.ground }; },
      light(x, y, r, color = '#ffd08a', strength = 0.6, name) {
        if (![x, y, r].every(Number.isFinite)) { fail('e.light(x, y, radius, color, strength, name?): numbers'); return; }
        const p = mapped(x, y, { x: 0, y: 0 });
        made.lights.push({ x: p.x, y: p.y, r: r * scaleNow(), color: String(color), strength: Number(strength), name: name == null ? null : String(name), part: cur.part, layer: cur.layer });
      },
      at(x, y, name) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        points.set(name == null ? null : String(name), mapped(x, y, { x: 0, y: 0, part: cur.part, layer: cur.layer }));
      },
      part(dx, dz, paint, partBox) {
        if (cur !== base) { fail('e.part: a part is the element\'s, not of a part or a layer'); return; }
        if (!Number.isFinite(dx) || !Number.isFinite(dz) || typeof paint !== 'function') { fail('e.part(dx, dz, paint, box?): metres to the right, metres farther, a function painting it'); return; }
        if (partBox !== undefined && !(Array.isArray(partBox) && partBox.length === 4 && partBox.every(Number.isFinite) && partBox[2] > partBox[0] && partBox[3] > partBox[1])) { fail('e.part: box is [left, top, right, bottom], metres around its foot'); partBox = undefined; }
        const part = { dx, dz, box: partBox ? partBox.slice() : box.slice(), rec: null };
        made.parts.push(part);
        sub({ rec: recorder(part.box), part: made.parts.length - 1, layer: -1 }, paint, part);
      },
      layer(name, opts, paint) {
        if (typeof opts === 'function') { paint = opts; opts = {}; }
        if (cur !== base) { fail('e.layer: a layer is the element\'s, not of a part or another layer'); return; }
        if (typeof name !== 'string' || typeof paint !== 'function') { fail('e.layer(name, opts?, paint): a name, its motion, a function painting it'); return; }
        if (made.layers.some(l => l.name === name)) { warn(`e.layer: two layers named "${name}" — each layer its own name (animate finds it by it); the second is not painted`); return; }
        const layer = { name, opts: layerOpts(opts, warn), rec: null }, drift = layer.opts.drift;
        if (drift && (drift[0] || drift[1])) {
          // (it wraps the way it drifts: its box a whole number of level-0 px that way)
          const b = (layer.opts.box || box).slice();
          if (drift[0]) b[2] = b[0] + px0(b[2] - b[0]) / SHEET.MAX_PPM;
          if (drift[1]) b[3] = b[1] + px0(b[3] - b[1]) / SHEET.MAX_PPM;
          layer.opts.box = b;
        }
        made.layers.push(layer);
        sub({ rec: recorder(layer.opts.box || box), part: -1, layer: made.layers.length - 1 }, paint, layer);
      },
      form(fn, opts) {
        if (cur !== base) { refuse('e.form: a form is the element\'s own, not a part\'s or a layer\'s'); return; }
        if (made.form) { refuse('e.form: an element has one form'); return; }
        if (typeof fn !== 'function') { refuse('e.form(fn, { closed, ground }?): fn(u, v) → [x, y, z], metres'); return; }
        const N = FORM.SIDE, pts = new Float32Array(N * N * 3);
        for (let j = 0; j < N; j++) {
          for (let i = 0; i < N; i++) {
            const u = i / (N - 1), v = j / (N - 1), p = fn(u, v);
            if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || !Number.isFinite(p[2])) { refuse(`e.form: at (${u}, ${v}) its function returned ${JSON.stringify(p) ?? String(p)} — [x, y, z], three numbers of metres`); return; }
            const k = 3 * (j * N + i);
            pts[k] = p[0]; pts[k + 1] = p[1]; pts[k + 2] = p[2];
          }
        }
        // (its area: the cells' — each the parallelogram of its two sides from one corner)
        let area = 0;
        for (let j = 0; j < N - 1; j++) {
          for (let i = 0; i < N - 1; i++) {
            const a = 3 * (j * N + i), b = a + 3, c = a + 3 * N;
            const ux = pts[b] - pts[a], uy = pts[b + 1] - pts[a + 1], uz = pts[b + 2] - pts[a + 2], vx = pts[c] - pts[a], vy = pts[c + 1] - pts[a + 1], vz = pts[c + 2] - pts[a + 2];
            area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
          }
        }
        if (!(area > 1e-9)) { refuse('e.form: its function gives a grid of no area — a surface, (u, v) across it'); return; }
        const f = opts && typeof opts === 'object' ? opts : {};
        for (const k of Object.keys(f)) if (k !== 'closed' && k !== 'ground') warn(`e.form: "${k}" is not one of its options (closed, ground)`);
        let closed = 0;
        if (f.closed === 'u') closed = 1; else if (f.closed === 'v') closed = 2; else if (f.closed === 'both') closed = 3;
        else if (f.closed != null) warn('e.form: "closed" is "u", "v" or "both" — where the form meets itself');
        if (f.ground == null || !cur.rec.ground(f.ground)) {
          if (f.ground != null) warn('e.form: "ground" is a colour — the one under the paint');
          cur.rec.ground(GROUND);
        }
        made.form = { points: pts, closed };
      },
      debug(value, x, y) { made.notes.push({ value: sendable(value), at: Number.isFinite(x) && Number.isFinite(y) ? mapped(x, y, { x: 0, y: 0, part: cur.part, layer: cur.layer }) : null }); },
      warn,
      // (what is the frame's, not the painting's: said once, read as nothing)
      get t() { warn('a painting does not read time (e.t): motion is its animate\'s'); return 0; },
    };
    for (const k of ['point', 'where', 'was', 'speed']) {
      e[k] = () => { warn(`e.${k} is its animate's, not its painting's (a painting is static)`); return null; };
    }
    // what a part or a layer paints, into a recorder of its own, as what is painted now
    function sub(what, paint, into) {
      cur = what;
      try { paint(cur.rec, e); into.rec = cur.rec.end(); } catch (err) { fail(err); threw = true; }
      cur = base;
    }
    late.length = 0;
    const code = E.code;
    // (said by the spec with the element's name before it: the thread says whose it is)
    if (typeof code !== 'function') { fail(late.length ? late.map(text => (text.startsWith(`${E.who}: `) ? text.slice(E.who.length + 2) : text)).join('; ') : 'it has no paint code'); threw = true; }
    else { try { code(base.rec, e); } catch (err) { fail(err); threw = true; } }
    cur = base;
    if (threw) { made.form = null; made.parts = []; made.layers = []; } else made.rec = base.rec.end();
    made.points = [...points];
    made.reads = [...reads];
    made.seen = made.reads.map(k => [k, JSON.stringify(valueAs(k) ?? null)]);
    return made;
  };
}
