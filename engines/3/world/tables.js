// The world's tables (WT1–WT4, WT10): nodes, quads, layers, lights, forms — flat typed arrays indexed by row, owned and
// written by the scene's thread; RENDER, SHEETS and PEOPLE read them and never write.
//   Rows. A row is taken with add…() and given back with free…(); a row freed is reused by a later add. `n` is one
// past the highest row ever taken: a reader walks 0 … n − 1 and a freed row is inert by its values (a node not shown, a
// quad with no flags, a light that does not shine).
//   Growth. The arrays double when a table is full — at an add(), which happens only when a scene is built or a
// painting is taken, never in a tick that only moves things. Growing replaces the arrays: a reader takes them from the
// table each tick and keeps none across ticks.
//   Stamps. tables.tick is the number of the step: it moves on at the END of every step (world.js), so a row written
// after a step, in a message's task, carries a tick no reader has seen. tables.step is the step being made, or the one
// made last (what was marked "this step" is asked by it after the step too). A row's stamp is the tick at which a
// DIFFERENT value was last written to it: every setter compares first, so writing what is already there costs the
// comparison and nothing after it (an animate that sets the same numbers every frame keeps no still scene drawing).
//   The GPU. A row that was stamped is also listed as changed (each once) until world.js sends it (flush, on seen
// steps); packNode / packQuad / packLayer lay a row out as 4.1 writes it.
import { QUAD } from '../base.js';

const grown = (a, cap, per = 1) => { const b = new a.constructor(cap * per); b.set(a); return b; };

// "Changed since" (3.4): rows written in step N carry N, and a call made after it reads world.tick N + 1 — so a reader
// that keeps the tick T of a call of its own sees as changed since exactly the rows stamped at or after T. The one
// test of a stamp against a tick, for every reader.
export const since = (stamp, T) => stamp >= T;
// the last tick a quad's place was stamped at (its node's row, its layer's); … anything of it (its own row too)
export function placedAt(world, q) { const layer = world.quads.layer[q]; return Math.max(world.nodes.stamp[world.quads.node[q]], layer >= 0 ? world.layers.stamp[layer] : 0); }
export const stampedAt = (world, q) => Math.max(world.quads.stamp[q], placedAt(world, q));

// the rows changed since the last flush, each once
function changes(cap) {
  return { rows: new Int32Array(cap), flag: new Uint8Array(cap), n: 0 };
}
function touch(c, row) { if (!c.flag[row]) { c.flag[row] = 1; c.rows[c.n++] = row; } }
function growChanges(c, cap) { c.rows = grown(c.rows, cap); c.flag = grown(c.flag, cap); }

export function createTables() {
  const T = { tick: 1, step: 1 };

  // ── nodes (WT1) ──
  const nodes = T.nodes = { n: 0, cap: 64, m: new Float64Array(12 * 64), parent: new Int32Array(64).fill(-1), stamp: new Uint32Array(64), shown: new Uint8Array(64), free: [], changed: changes(64) };
  T.addNode = (parent = -1) => {
    let i = nodes.free.pop();
    if (i === undefined) {
      if (nodes.n === nodes.cap) {
        const cap = nodes.cap * 2;
        nodes.m = grown(nodes.m, cap, 12); nodes.parent = grown(nodes.parent, cap); nodes.stamp = grown(nodes.stamp, cap); nodes.shown = grown(nodes.shown, cap);
        growChanges(nodes.changed, cap); nodes.cap = cap;
      }
      i = nodes.n++;
    }
    const o = 12 * i;
    nodes.m.fill(0, o, o + 12); nodes.m[o] = nodes.m[o + 4] = nodes.m[o + 8] = 1;
    nodes.parent[i] = parent; nodes.shown[i] = 1; nodes.stamp[i] = T.tick;
    touch(nodes.changed, i);
    return i;
  };
  T.freeNode = i => { nodes.shown[i] = 0; nodes.parent[i] = -1; nodes.stamp[i] = T.tick; nodes.free.push(i); };
  // The stand's (ST2): how far the numbers of a row moved in the tick that stamped it — a node's twelve, a layer's pose and
  // options — T.delta = { node, layer } (the greatest change a row had in its last tick; kept only while measuring)
  let delta = null;
  T.delta = null;
  T.measure = on => { delta = T.delta = on ? { node: new Float64Array(nodes.cap), layer: new Float64Array(64) } : null; };
  function noted(which, i, d, again) {
    let a = delta[which];
    if (i >= a.length) { const b = new Float64Array(Math.max(a.length * 2, i + 1)); b.set(a); delta[which] = a = b; }
    a[i] = again ? Math.max(a[i], d) : d;
  }
  // a node's matrix from twelve numbers at `so` of `src` → whether it changed
  T.setNode = (i, src, so = 0) => {
    const m = nodes.m, o = 12 * i;
    let changed = false, d = 0;
    for (let k = 0; k < 12; k++) if (m[o + k] !== src[so + k]) { if (delta) d = Math.max(d, Math.abs(m[o + k] - src[so + k])); m[o + k] = src[so + k]; changed = true; }
    if (changed) { if (delta) noted('node', i, d, nodes.stamp[i] === T.tick); nodes.stamp[i] = T.tick; touch(nodes.changed, i); }
    return changed;
  };
  T.showNode = (i, shown) => { const v = shown ? 1 : 0; if (nodes.shown[i] !== v) { nodes.shown[i] = v; nodes.stamp[i] = T.tick; } };
  // (the render origin stepped: every row is sent again)
  T.allNodes = () => { for (let i = 0; i < nodes.n; i++) touch(nodes.changed, i); };

  // ── quads (WT2) ──
  const quads = T.quads = {
    n: 0, cap: 128,
    node: new Int32Array(128), sheet: new Int32Array(128), layer: new Int32Array(128), el: new Int32Array(128), form: new Int32Array(128), aux: new Int32Array(128),
    kind: new Uint8Array(128), flags: new Uint32Array(128), recv: new Uint32Array(128), cast: new Uint32Array(128), own: new Uint32Array(128), clip: new Uint32Array(128),
    rect: new Float32Array(4 * 128), tint: new Float32Array(4 * 128), seed: new Float32Array(128), sheer: new Float32Array(128), stamp: new Uint32Array(128),
    free: [], changed: changes(128),
  };
  const QUAD_ONE = ['node', 'sheet', 'layer', 'el', 'form', 'aux', 'kind', 'flags', 'recv', 'cast', 'own', 'clip', 'seed', 'sheer', 'stamp'];
  // an element's quads are a block of rows side by side (WT8: quadsOf → [first, count]): `count` rows taken together
  // — the first freed block that holds them (what is left of it stays free), else new rows at the end
  T.addQuads = count => {
    let first = -1;
    const free = quads.free;
    for (let k = 0; k < free.length; k += 2) {
      if (free[k + 1] < count) continue;
      first = free[k];
      if (free[k + 1] === count) free.splice(k, 2); else { free[k] += count; free[k + 1] -= count; }
      break;
    }
    if (first < 0) {
      if (quads.n + count > quads.cap) {
        let cap = quads.cap;
        while (quads.n + count > cap) cap *= 2;
        for (const k of QUAD_ONE) quads[k] = grown(quads[k], cap);
        quads.rect = grown(quads.rect, cap, 4); quads.tint = grown(quads.tint, cap, 4);
        growChanges(quads.changed, cap); quads.cap = cap;
      }
      first = quads.n; quads.n += count;
    }
    for (let i = first; i < first + count; i++) {
      quads.node[i] = 0; quads.sheet[i] = -1; quads.layer[i] = -1; quads.el[i] = 0; quads.form[i] = -1; quads.aux[i] = -1;
      quads.kind[i] = QUAD.CARD; quads.flags[i] = 0; quads.recv[i] = 0; quads.cast[i] = 0; quads.own[i] = 0; quads.clip[i] = 0; quads.seed[i] = 0; quads.sheer[i] = 0;
      quads.rect.fill(0, 4 * i, 4 * i + 4); quads.tint.fill(1, 4 * i, 4 * i + 4);
      quads.stamp[i] = T.tick; touch(quads.changed, i);
    }
    return first;
  };
  T.freeQuads = (first, count) => {
    if (!count) return;
    for (let i = first; i < first + count; i++) { quads.flags[i] = 0; quads.sheet[i] = -1; quads.form[i] = -1; quads.layer[i] = -1; quads.own[i] = 0; quads.clip[i] = 0; quads.stamp[i] = T.tick; touch(quads.changed, i); }
    quads.free.push(first, count);
  };
  // one number of a quad row (arr: one of the table's arrays)
  T.setQuad = (arr, i, v) => {
    if (arr[i] === v || (arr === quads.seed && arr[i] === Math.fround(v))) return false;
    arr[i] = v; quads.stamp[i] = T.tick; touch(quads.changed, i);
    return true;
  };
  T.setQuad4 = (arr, i, a, b, c, d) => {
    const o = 4 * i;
    if (arr[o] === Math.fround(a) && arr[o + 1] === Math.fround(b) && arr[o + 2] === Math.fround(c) && arr[o + 3] === Math.fround(d)) return false;
    arr[o] = a; arr[o + 1] = b; arr[o + 2] = c; arr[o + 3] = d; quads.stamp[i] = T.tick; touch(quads.changed, i);
    return true;
  };
  T.flagQuad = (i, bits, on) => T.setQuad(quads.flags, i, on ? (quads.flags[i] | bits) >>> 0 : (quads.flags[i] & ~bits) >>> 0);

  // ── layers (WT3): pose (x, y, rotate, scaleX, scaleY, alpha, brightness, length), opts (pivot x, pivot y, wind
  // strength, wind gust, wind scale, flicker, shimmer, depth, drift x, drift y, spare, spare) ──
  const layers = T.layers = { n: 0, cap: 64, pose: new Float32Array(8 * 64), opts: new Float32Array(12 * 64), stamp: new Uint32Array(64), free: [], changed: changes(64) };
  T.addLayer = () => {
    let i = layers.free.pop();
    if (i === undefined) {
      if (layers.n === layers.cap) {
        const cap = layers.cap * 2;
        layers.pose = grown(layers.pose, cap, 8); layers.opts = grown(layers.opts, cap, 12); layers.stamp = grown(layers.stamp, cap);
        growChanges(layers.changed, cap); layers.cap = cap;
      }
      i = layers.n++;
    }
    const p = 8 * i;
    layers.pose.fill(0, p, p + 8); layers.pose[p + 3] = layers.pose[p + 4] = layers.pose[p + 5] = layers.pose[p + 6] = 1;
    layers.opts.fill(0, 12 * i, 12 * i + 12);
    layers.stamp[i] = T.tick; touch(layers.changed, i);
    return i;
  };
  T.freeLayer = i => { layers.stamp[i] = T.tick; layers.free.push(i); };
  T.setPose = (i, k, v) => {
    const o = 8 * i + k;
    if (layers.pose[o] === Math.fround(v)) return false;
    if (delta) noted('layer', i, Math.abs(layers.pose[o] - v), layers.stamp[i] === T.tick);
    layers.pose[o] = v; layers.stamp[i] = T.tick; touch(layers.changed, i);
    return true;
  };
  T.setOpt = (i, k, v) => {
    const o = 12 * i + k;
    if (layers.opts[o] === Math.fround(v)) return false;
    if (delta) noted('layer', i, Math.abs(layers.opts[o] - v), layers.stamp[i] === T.tick);
    layers.opts[o] = v; layers.stamp[i] = T.tick; touch(layers.changed, i);
    return true;
  };

  // ── lights (WT4) — and, beside the contract's arrays: `soft` (a through-light's edge, metres), `ids` (each row's
  // id as the language names it: what a caster's shadow.light is matched against). `cone`: a beam's (cos of half its
  // width, cos of where its soft edge begins — that one above 0); (0, 0) for every other light ──
  const lights = T.lights = {
    n: 0, cap: 64, version: 0,
    kind: new Uint8Array(64), node: new Int32Array(64).fill(-1), at: new Float64Array(3 * 64), way: new Float32Array(3 * 64), colour: new Float32Array(3 * 64), cone: new Float32Array(2 * 64),
    strength: new Float32Array(64), reach: new Float32Array(64), sprite: new Float32Array(64), glow: new Float32Array(64), flicker: new Float32Array(64), seed: new Float32Array(64), soft: new Float32Array(64), falloff: new Uint8Array(64),
    flags: new Uint32Array(64), named: new Uint8Array(64), stamp: new Uint32Array(64), ids: [], free: [],
  };
  const LIGHT_ONE = ['kind', 'node', 'strength', 'reach', 'sprite', 'glow', 'flicker', 'seed', 'soft', 'falloff', 'flags', 'named', 'stamp'];
  T.addLight = () => {
    let i = lights.free.pop();
    if (i === undefined) {
      if (lights.n === lights.cap) {
        const cap = lights.cap * 2;
        for (const k of LIGHT_ONE) lights[k] = grown(lights[k], cap);
        lights.at = grown(lights.at, cap, 3); lights.way = grown(lights.way, cap, 3); lights.colour = grown(lights.colour, cap, 3); lights.cone = grown(lights.cone, cap, 2);
        lights.cap = cap;
      }
      i = lights.n++;
    }
    for (const k of LIGHT_ONE) lights[k][i] = 0;
    lights.node[i] = -1; lights.ids[i] = null;
    lights.at.fill(0, 3 * i, 3 * i + 3); lights.way.fill(0, 3 * i, 3 * i + 3); lights.way[3 * i + 1] = 1; lights.colour.fill(1, 3 * i, 3 * i + 3); lights.cone.fill(0, 2 * i, 2 * i + 2);
    lights.stamp[i] = T.tick; lights.version++;
    return i;
  };
  T.freeLight = i => { lights.strength[i] = 0; lights.reach[i] = 0; lights.flags[i] = 0; lights.cone[2 * i] = lights.cone[2 * i + 1] = 0; lights.named[i] = 0; lights.node[i] = -1; lights.ids[i] = null; lights.stamp[i] = T.tick; lights.version++; lights.free.push(i); };
  T.setLight = (arr, i, v) => {
    if (arr[i] === v || (arr instanceof Float32Array && arr[i] === Math.fround(v))) return false;
    arr[i] = v; lights.stamp[i] = T.tick;
    return true;
  };
  T.setLight3 = (arr, i, x, y, z) => {
    const o = 3 * i, f = arr instanceof Float32Array;
    if (f ? arr[o] === Math.fround(x) && arr[o + 1] === Math.fround(y) && arr[o + 2] === Math.fround(z) : arr[o] === x && arr[o + 1] === y && arr[o + 2] === z) return false;
    arr[o] = x; arr[o + 1] = y; arr[o + 2] = z; lights.stamp[i] = T.tick;
    return true;
  };

  // ── forms (WT10): a list of grids; a row freed is null and taken again ──
  const forms = T.forms = { n: 0, list: [], free: [], version: 0 };
  T.addForm = form => {
    let i = forms.free.pop();
    if (i === undefined) i = forms.n++;
    form.stamp = T.tick;
    forms.list[i] = form; forms.version++;
    return i;
  };
  T.freeForm = i => { forms.list[i] = null; forms.free.push(i); };

  return T;
}

// ── the rows as the GPU has them (4.1), little-endian; f32 and u32: the two views of a GP2 table's mirror ──
export const NODE_BYTES = 48, QUAD_BYTES = 96, LAYER_BYTES = 80;
// a node: the three rows of its 3 × 4 matrix, the translation in .w, the render origin subtracted
export function packNode(nodes, i, origin, f32) {
  const m = nodes.m, o = 12 * i, w = 12 * i;
  f32[w] = m[o]; f32[w + 1] = m[o + 3]; f32[w + 2] = m[o + 6]; f32[w + 3] = m[o + 9] - origin[0];
  f32[w + 4] = m[o + 1]; f32[w + 5] = m[o + 4]; f32[w + 6] = m[o + 7]; f32[w + 7] = m[o + 10] - origin[1];
  f32[w + 8] = m[o + 2]; f32[w + 9] = m[o + 5]; f32[w + 10] = m[o + 8]; f32[w + 11] = m[o + 11] - origin[2];
}
// (a quad: 4.1's row — `sheer` at 80, three words spare after it)
export function packQuad(quads, i, f32, u32) {
  const w = 24 * i;
  u32[w] = quads.node[i]; u32[w + 1] = quads.sheet[i] >>> 0; u32[w + 2] = quads.layer[i] >>> 0;
  u32[w + 3] = (quads.flags[i] & ~QUAD.KIND) | quads.kind[i];
  u32[w + 4] = quads.recv[i]; u32[w + 5] = quads.cast[i]; u32[w + 6] = quads.own[i];
  f32[w + 7] = quads.seed[i];
  f32[w + 8] = quads.rect[4 * i]; f32[w + 9] = quads.rect[4 * i + 1]; f32[w + 10] = quads.rect[4 * i + 2]; f32[w + 11] = quads.rect[4 * i + 3];
  f32[w + 12] = quads.tint[4 * i]; f32[w + 13] = quads.tint[4 * i + 1]; f32[w + 14] = quads.tint[4 * i + 2]; f32[w + 15] = quads.tint[4 * i + 3];
  u32[w + 16] = quads.el[i]; u32[w + 17] = quads.form[i] + 1; u32[w + 18] = quads.aux[i] >>> 0; u32[w + 19] = quads.clip[i];
  f32[w + 20] = quads.sheer[i]; u32[w + 21] = 0; u32[w + 22] = 0; u32[w + 23] = 0;
}
export function packLayer(layers, i, f32) {
  const w = 20 * i, p = 8 * i, q = 12 * i, P = layers.pose, O = layers.opts;
  f32[w] = P[p]; f32[w + 1] = P[p + 1]; f32[w + 2] = P[p + 2]; f32[w + 3] = P[p + 3];
  f32[w + 4] = P[p + 4]; f32[w + 5] = P[p + 5]; f32[w + 6] = P[p + 6]; f32[w + 7] = P[p + 7];
  f32[w + 8] = O[q]; f32[w + 9] = O[q + 1]; f32[w + 10] = O[q + 2]; f32[w + 11] = O[q + 3];
  f32[w + 12] = O[q + 4]; f32[w + 13] = O[q + 5]; f32[w + 14] = O[q + 6]; f32[w + 15] = O[q + 7];
  f32[w + 16] = O[q + 8]; f32[w + 17] = O[q + 9]; f32[w + 18] = 0; f32[w + 19] = 0;
}
// the changed rows of a table taken (each once): fn(row) for each, then none are changed
export function drain(table, fn) {
  const c = table.changed;
  for (let k = 0; k < c.n; k++) { const row = c.rows[k]; c.flag[row] = 0; fn(row); }
  c.n = 0;
}
