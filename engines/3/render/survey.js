// What the stand's detail run counts beside R.timing's ms (ST2 `wide`): where inside the asks and the culls a frame's time
// goes — by the kind of quad an ask works out, by why a view was asked anew or culled anew, and which elements have rows
// stamped. Made by the renderer, written only while R.detailed(true): off, nothing here is called but the asks' own
// counts (sheets/ask.js: one add each). ONE array, rewritten in place at each R.frame call, named by `names`.
//   Asks, in four slots (the frame's views · the mirrors' · the shadow cells' · `toward`'s and the shots ahead's): the
// ask's numbers by kind of quad (ask.js: KINDS × METRICS, the cache's bookkeeping of the names after them, then the
// items: asked, and worked out again by cause — ITEMS); the views asked, of them those every item of which was worked
// out (`whole`), and by which cause — the first the code tests, in this order: `swaps` (the view's swaps or overrides
// changed), `size` (its size), then the cache's own: `bias` (its pressure moved) and `cache` (the sheets are
// others, a cycle missed, a whole call begun or ended, its world, its weight); and, of every view asked, whether its
// eye had moved (`eye moved`) and its turn or its lens (`turned`).
//   Culls, in four slots (the stages `cull`, `cull mirrors`, `cull shadows`, `cull ahead`): calls (views culled),
// `tested` (quads looked at: the world's, a call), `listed` (quads a view then lists), `skipped` (a view that is only
// asked, whose cull was not needed), and why a cull was made — the first the test of `listed()` (renderer.js) finds, in
// its order: `extra` (the shot's overrides), `rows` (a row of the world was stamped), `tall` (the land's reach), `look`,
// `size`, `camera`; `nothing`: none of them held — a cull the test would have skipped (the frame's, the mirrors' and the
// shadow cells' views are culled in every call, with no test: this counts what a test would find).
//   Elements (`stamped`): of the quads the frame's view lists, in every call, those stamped since its last ask, by element
// — in calls where its camera stood and where it moved apart —: the calls in which any quad of it was stamped, the quads
// stamped, by which table's row (the quad's, its node's, its layer's), and for a node or layer stamp how far the numbers
// moved (the greatest change in the tick that stamped it: under 1e-9, 1e-6, 1e-4, 1e-2, or more). And, of all the world's
// quads (a view lists some): those stamped since — a person's node left out, as the stamp a cull is judged by —, the calls
// and the quads (`world calls`, `world quads`) — and the nodes stamped of the element's own (a node no quad stands on:
// one that only carries; those of no element are counted apart), what a cull's test of the rows reads as well. And which
// element holds the newest row of those (`stamps.rows`: the greatest stamp of the nodes but a person's, the quads, the
// layers — what moves a cull's `rows` test): the calls in which it does (`newest calls`); apart, by table and not of any
// element, and the calls in which that greatest stamp rose.
import { KINDS, METRICS, ITEMS, SLOTS, SLOT_STRIDE, CHANGED } from '../sheets/ask.js';

const SLOT = ['frame', 'mirrors', 'shadows', 'ahead'], CAUSE = ['swaps', 'size', 'bias', 'cache'];
const CULL = ['calls', 'tested', 'listed', 'skipped', 'nothing', 'extra', 'rows', 'tall', 'look', 'size', 'camera'];
const VIEW = ['asked', 'whole', ...CAUSE, 'eye moved', 'turned'];
const ELEMENT = ['calls', 'quads', 'by quad', 'by node', 'by layer', 'moved <1e-9', 'moved <1e-6', 'moved <1e-4', 'moved <1e-2', 'moved more', 'world calls', 'world quads', 'world nodes', 'newest calls'];
const ASKS = SLOTS * SLOT_STRIDE, VIEWS = SLOTS * VIEW.length;
const BOUNDS = [1e-9, 1e-6, 1e-4, 1e-2];

export function createSurvey(asking) {
  const names = [];
  for (const s of SLOT) {
    for (const k of KINDS) for (const m of METRICS) names.push(`ask ${s} ${k} ${m}`);
    names.push(`ask ${s} names ms`, `ask ${s} names kept`);
    for (const i of ITEMS) names.push(`ask ${s} items ${i}`);
  }
  for (const s of SLOT) for (const v of VIEW) names.push(`view ${s} ${v}`);
  for (const s of SLOT) for (const c of CULL) names.push(`cull ${s} ${c}`);
  const wide = new Float64Array(names.length);
  let on = false, elements = null, ids = null, marks = null, worldMarks = null, newestMarks = null, owner = null, layerOwner = new Int32Array(0), lastTop = 0;
  // (calls with the frame's camera standing, moving)
  // (calls with the frame's camera standing, moving; nodes stamped of no element; newest rows: nodes, quads, layers, of no element; the greatest stamp rose)
  const calls = new Float64Array(8);
  const S = {
    names, wide, ELEMENT, ids: () => ids,
    get on() { return on; },
    detailed(yes) { on = !!yes; asking.measure(on); },
    // an R.frame call begins
    begin() { if (on) { wide.fill(0); asking.stats.fill(0); } },
    // a view of `slot` asked: why every item of it was worked out (the cache's: asking.why; R's cause of its own
    // `changed`: 1 swaps, 2 size), and what of its camera moved (`changed`'s bits)
    asked(slot, cause, changed) {
      const o = ASKS + slot * VIEW.length, why = asking.why;
      wide[o]++;
      if (why) { wide[o + 1]++; wide[o + 2 + (why === 1 ? cause - 1 : why === 3 ? 2 : 3)]++; }
      if (changed & CHANGED.EYE) wide[o + 2 + CAUSE.length]++;
      if (changed & CHANGED.TURN) wide[o + 3 + CAUSE.length]++;
    },
    // a view culled (or skipped) in `slot`: `why` (0 nothing … 6 camera, by CULL's order after `skipped`; −1 skipped), the quads tested and listed
    culled(slot, why, tested, listed) {
      const o = ASKS + VIEWS + slot * CULL.length;
      if (why < 0) { wide[o + 3]++; return; }
      wide[o]++; wide[o + 1] += tested; wide[o + 2] += listed; wide[o + 4 + why]++;
    },
    // the numbers of the asks (ask.js's), copied into the array → it
    collect() { wide.set(asking.stats, 0); return wide; },
    // the world built
    build(world) {
      if (!on) return;
      ids = world.elements.map(el => el.id);
      elements = new Float64Array(2 * ids.length * ELEMENT.length);
      marks = new Int32Array(ids.length); worldMarks = new Int32Array(ids.length); newestMarks = new Int32Array(ids.length);
      // (the element each node is of: its own, its copies', its parts')
      owner = new Int32Array(world.nodes.cap).fill(-1);
      world.elements.forEach((el, i) => { for (const n of el.nodes) owner[n] = i; for (const p of el.partSlots) for (const n of p.nodes ?? []) owner[n] = i; });
      calls.fill(0);
      world.tables.measure(true);
    },
    // the quads the frame's view lists, stamped since its last ask (`since`): by element
    stamps(world, view, moving, persons) {
      if (!elements) return;
      const Q = world.quads, N = world.nodes, Ly = world.layers, D = world.tables.delta, tick = view.e.tick, base = moving ? ids.length * ELEMENT.length : 0;
      calls[moving ? 1 : 0]++;
      const call = calls[0] + calls[1];
      for (let n = 0; n < view.n; n++) {
        const q = view.list[n], node = Q.node[q], layer = Q.layer[q];
        const sq = Q.stamp[q] >= tick, sn = N.stamp[node] >= tick, sl = layer >= 0 && Ly.stamp[layer] >= tick;
        if (!(sq || sn || sl)) continue;
        const el = Q.el[q], o = base + el * ELEMENT.length;
        if (marks[el] !== call) { marks[el] = call; elements[o]++; }
        elements[o + 1]++;
        if (sq) elements[o + 2]++;
        if (sn) elements[o + 3]++;
        if (sl) elements[o + 4]++;
        if (sn || sl) {
          const d = Math.max(sn && node < D.node.length ? D.node[node] : 0, sl && layer < D.layer.length ? D.layer[layer] : 0);
          let b = 0;
          while (b < BOUNDS.length && d >= BOUNDS[b]) b++;
          elements[o + 5 + b]++;
        }
      }
      for (let q = 0; q < Q.n; q++) {
        const node = Q.node[q], layer = Q.layer[q];
        if (!(Q.stamp[q] >= tick || (!persons[node] && N.stamp[node] >= tick) || (layer >= 0 && Ly.stamp[layer] >= tick))) continue;
        const el = Q.el[q], o = base + el * ELEMENT.length;
        if (worldMarks[el] !== call) { worldMarks[el] = call; elements[o + 10]++; }
        elements[o + 11]++;
      }
      if (layerOwner.length < Ly.cap) layerOwner = new Int32Array(Ly.cap).fill(-1);
      for (let q = 0; q < Q.n; q++) if (Q.layer[q] >= 0) layerOwner[Q.layer[q]] = Q.el[q];
      // (the newest rows)
      let top = 0;
      for (let i = 0; i < N.n; i++) if (!persons[i] && N.stamp[i] > top) top = N.stamp[i];
      for (let q = 0; q < Q.n; q++) if (Q.stamp[q] > top) top = Q.stamp[q];
      for (let i = 0; i < Ly.n; i++) if (Ly.stamp[i] > top) top = Ly.stamp[i];
      if (top > lastTop) calls[7]++;
      lastTop = top;
      const newest = el => { if (el < 0) { calls[6]++; return; } if (newestMarks[el] !== call) { newestMarks[el] = call; elements[base + el * ELEMENT.length + 13]++; } };
      for (let i = 0; i < N.n; i++) if (!persons[i] && N.stamp[i] === top) { calls[3]++; newest(i < owner.length ? owner[i] : -1); }
      for (let q = 0; q < Q.n; q++) if (Q.stamp[q] === top) { calls[4]++; newest(Q.el[q]); }
      for (let i = 0; i < Ly.n; i++) if (Ly.stamp[i] === top) { calls[5]++; newest(layerOwner[i]); }
      for (let i = 0; i < N.n; i++) {
        if (persons[i] || !(N.stamp[i] >= tick)) continue;
        if (i >= owner.length || owner[i] < 0) calls[2]++; else elements[base + owner[i] * ELEMENT.length + 12]++;
      }
    },
    // the elements' numbers so far, as a copy: [standing | moving] × elements × ELEMENT, and the calls of each
    take() { return elements ? { ids, fields: ELEMENT, calls: Array.from(calls), counts: elements.slice() } : null; },
  };
  return S;
}
