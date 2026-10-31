// The quads of a view: culled, ordered, laid out as runs (2.1 step 8e, 5.17, 4.1) — on the scene's thread, from the
// world's tables alone.
//   Shapes (5.12): one vertex buffer holds the corners of every shape, one index buffer their triangles; a shape is an
// index range. How many points a quad is drawn with goes by what it covers of the view, not by its metres. FLAT 4
// points — nothing varies across it; COLUMN 2 × 17 — the wind bends it; with something varying across it (a lamp, a
// window light, a through-light's panes, the land's shadow, the haze — across a quad larger than its reach / 64 —,
// the air, people's blob near) the coarsest of the even grids of 4, 8, 16 and 32 cells a side (MID, FORM8, FINE,
// FORM32) at which a cell is under LIT.CELL px of the view. A flat quad — a card, one that faces the eye, a plane —
// wholly in view has that grid over its own rect, by what its placed corners span there. One that the view's sides
// cut is drawn by the SCREEN shape: the same grids laid over the part of the VIEW it is seen in — the PIECE: its
// placed corners cut by the view's sides, a polygon of three to nine corners —, each point a point of the quad
// itself; 4 cells a side when nothing varies across it or the list reads no light (a light's view, the masks); of
// such a quad nothing of which is in the view no row is written. The piece is cut a little wider than the view
// (PIECE.WIDER of it each side, and from half the near plane's distance: the GPU cuts the rest): a point's place is
// only as exact as a float carries the quad's rect — millimetres on a sea 130 km wide —, and no gap may open at the
// frame's edge. It is drawn as a fan of four-cornered parts from its first corner (one to four; an odd corner left
// over is a part whose last two corners are one), a row of the order each, all with one grid: a part's points lie
// between its four corners as the view sees them — evenly on the screen —, so every point is on the quad, the parts
// cover the piece and nothing else, and two parts have the very same points along the side they share (nothing is
// clamped onto an edge, nothing dropped at the pixel). A leaf of the land and a sheet of the sky: FINE; a form: the
// coarsest of its four strides at which a cell is under FORM.CELL px.
//   A sheet of a sky that does not go round — a BACKDROP (world/place.js) — is seen of each of its points in the turn
// of the circle nearest the gaze: where it reaches into more turns than one (a sky painted a whole turn round), a
// cell of its grid with corners in two turns would be drawn across the view between them. So it is drawn by a row
// for each turn it reaches into (its posed corners' turns, as far as the wind may bend it — as SHEETS asks its pages:
// sheets/ask.js), the turn in the shape's word from bit 8: the vertex stage lays every point of the row in that turn,
// and the fragment keeps only what lies within the turn's sides (render/wgsl/quad.js e_amount) — the next turn's row
// draws on from there.
//   The order (4.1): a vertex buffer stepped per instance, 68 bytes a row — the quad's row, the shape (SCREEN: bit 7;
// a leaf's row from bit 8), the origin page (SH14: (0, 0) under 2^20 px a side, else the page under the eye's foot),
// `edge` (the edge-on fade), `piece` (four vec3f: the corners of a part of the SCREEN shape, round it — each
// (x, y, 1) / w: where the corner is on the quad's sheet, metres from its origin page's corner, and 1, over the
// view's w there; worked out here in doubles from `place` at its corners, each corner's three numbers once, so two
// parts give a corner they share the same bits; unread for other shapes). A run is one drawIndexed: it breaks where
// the pipeline, the shape or the family's group changes.
//   Pipelines are numbers (5.16): at build(world) every pipeline a list can ask is found once — by the list's kind,
// whether the view is a mirror's (the mirror's own set: 4.5), whether the quad is a receiver, its flags' case, and
// for each own slot its three — and a run carries the number.
//   Lists of a drawn view (5.17). A PLANE of a node is its quads of one lift (a layer's `depth`). SOLID — the first
// quad drawn of a plane that paints (one whose painting paints nothing at all and that has no own shader is not its
// first: an empty base leaves the plane to its first painted layer), when its sheet is wholly opaque (SH13) and it
// has no layer alpha below 1, no blend mode, no own shader, no order rule (its own, or another's that names its
// element) and is not clipped; a form always, by its nearest point: near to far. With every one of those conditions but a MIXED sheet (opaque paint and holes or soft
// edges) the quad is drawn twice: among the solids by `cut` — its opaque pixels, with their depth — and among what
// blends by `edge` — the same triangles under the strict depth test, so only its other pixels blend. In the frame's
// view a card with a point nearer the eye than PASS.TO fades as the eye passes it (render/wgsl/quad.js): what fades is
// no opaque paint, so such a card is at most a mixed sheet — its `cut` lays the depth of its opaque paint where it does
// not fade. BLENDED — every other quad, far to near, by its plane's depth along the gaze: a
// quad that faces the eye by its node's origin, a card turned its own way and a plane by the farthest of its four
// placed corners (the farthest of all the quads of that plane), a layer as much nearer as its `depth` says; at one
// key by their rows (an element's layers in their order); `behind` / `inFront` put an element's quads just behind
// the farthest, or just before the nearest, of the elements named. Among them, in the frame's view, the lights'
// glows and the emitters' particles, each by how far it is (weather last). The sky's sheets in their own order; the
// inserts in theirs. After a quad that mirrors, its overlay — when its mirror is placed. MARKS — in the frame's view
// of a world with people, a quad drawn wholly among what blends (not a mixed sheet's `edge`: its `cut` laid that), not
// draped, that does not add or multiply, whose layer is wholly there and whose painting has opaque paint (or an own
// shader), and that may hide one of them (over what they cover of the view, nearer than the farthest of them): laid
// again by the mark, its opaque paint clearing the ids behind it (no one's lines through it).
//   A pane of glass (FLAG.GLASS) is never drawn itself (WT2): its painting is its overlay's mask. It gives no entry
// to any list of any view but its overlay's, in the frame's — sorted by where its plane stands, as any quad's —; it
// is no plane's first quad (it lays no depth, and leaves the plane to what is drawn), casts nothing, cuts nothing; it is in
// the frame's and a shot's `list` (its pages are asked: the overlay reads its alpha) and in no mirror's or light's.
// A pane's own image holds the room alone (5.7): no sky, nothing draped on the land; a plane's that says `sky: false`,
// no sky.
//   A view's `list` (SH10) is every quad the view may show, drawn or not: what its asks name — in the order of
// their rows. A shot's view leaves out the rows its swaps end (SH2: the triple (quad, −1, −1)); the frame's views
// ignore such a triple. A view whose camera stands need not be culled again for rows that are not its matter:
// `changes` tells whether a row stamped since its last cull is one — a quad that comes into its list or leaves it,
// or, where its lists are drawn (their order is by where each quad stands), any quad of its list.
//   A quad's sphere holds what the wind may bend it by (SH10's bound) and, draped, the land's heights RENDER sampled;
// its four placed corners are kept with it, under the same stamp.
import { QUAD, FLAG, FORM, LIT, PASS, SHEET, WIND } from '../base.js';
import { place, backdropAt, turnOf } from '../world/place.js';
import { since, stampedAt } from '../world/tables.js';
import { SHAPE } from './wgsl/quad.js';
import { sees, ahead, pxAt, clip, covers } from './views.js';

const ROW = 68, WORDS = 17;
// a sheet this many px a side has its origin page under the eye's foot (SH14)
const FAR_PX = 2 ** 20;
// the steps of colour the main target keeps a channel (render/wgsl/frame.js e_dithered)
const HAZE_STEP = 64;
// how many shapes there are; R.counters.shapes has a number for each and, after them, one for the SCREEN shape
export const SHAPES = 6;

// Whether a quad moves by itself — its picture is another with the time alone: the wind, a drift, a shimmer, a flicker,
// the highlight's breath, an own shader that reads the time (own: render/own.js). The one test of it in render/: the
// frame is not idle with such a quad in view, a mirror's image is drawn again with one in it
const MOVES = FLAG.WIND | FLAG.DRIFT | FLAG.SHIMMER | FLAG.FLICKER | FLAG.OFFERED;
export const movesItself = (world, own, q) => (world.quads.flags[q] & MOVES) !== 0 || (world.quads.own[q] !== 0 && own.timed(world.quads.own[q] - 1));

// the corners and triangles of every shape, and each one's index range and points (by SHAPE's numbers)
export function shapes() {
  const corners = [], indices = [], ranges = [];
  const even = (cols, rows) => {
    const base = corners.length / 2, first = indices.length;
    for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) corners.push(c / cols, r / rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const a = base + r * (cols + 1) + c, b = a + cols + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return { first, count: indices.length - first, points: (cols + 1) * (rows + 1) };
  };
  ranges[SHAPE.FLAT] = even(1, 1);
  ranges[SHAPE.COLUMN] = even(1, 16);
  ranges[SHAPE.MID] = even(4, 4);
  ranges[SHAPE.FORM8] = even(8, 8);
  ranges[SHAPE.FINE] = even(16, 16);
  ranges[SHAPE.FORM32] = even(32, 32);
  return { corners: new Float32Array(corners), indices: new Uint32Array(indices), ranges };
}
// the coarsest grid at which a cell is under `cell` px of a span of the view — SPAN[0] (least: no coarser than this
// shape; the span in an array: a fraction handed to a function is made on the heap — 5.16)
const SPAN = new Float64Array(1);
const gridOf = (cell, least) => { const span = SPAN[0]; return span < cell ? least : span < 4 * cell ? Math.max(least, SHAPE.MID) : span < 8 * cell ? Math.max(least, SHAPE.FORM8) : span < 16 * cell ? SHAPE.FINE : SHAPE.FORM32; };

// a stable merge sort of the first n of idx by key[idx] (ascending), with a scratch of its size: nothing is allocated
function sort(idx, n, key, scratch) {
  for (let width = 1; width < n; width *= 2) {
    for (let lo = 0; lo < n; lo += 2 * width) {
      const mid = Math.min(lo + width, n), hi = Math.min(lo + 2 * width, n);
      let a = lo, b = mid, o = lo;
      while (a < mid && b < hi) scratch[o++] = key[idx[b]] < key[idx[a]] ? idx[b++] : idx[a++];
      while (a < mid) scratch[o++] = idx[a++];
      while (b < hi) scratch[o++] = idx[b++];
    }
    for (let i = 0; i < n; i++) idx[i] = scratch[i];
  }
}

// the lists of a view: entries (a quad's row — or GLOW, EMITTER — with what else: `extra`) with their keys, and the
// runs they make. kind: which pipelines its quads are drawn by (a number: LIST)
const LIST = Object.freeze({ SOLID: 0, BLEND: 1, SKY: 2, INSERT: 3, CAST: 4, MASK: 5, MARK: 6 });
function listOf(kind) { return { kind, n: 0, quad: new Int32Array(256), extra: new Int32Array(256), key: new Float64Array(256), idx: new Int32Array(256), scratch: new Int32Array(256), runs: new Int32Array(5 * 64), runsN: 0 }; }
const grown = (a, cap) => { const b = new a.constructor(cap); b.set(a); return b; };
function push(L, quad, extra, key) {
  if (L.n === L.quad.length) {
    const cap = L.n * 2;
    L.quad = grown(L.quad, cap); L.extra = grown(L.extra, cap); L.key = grown(L.key, cap); L.idx = new Int32Array(cap); L.scratch = new Int32Array(cap);
  }
  L.quad[L.n] = quad; L.extra[L.n] = extra; L.key[L.n] = key; L.n++;
}
export function viewLists() {
  const lists = { solid: listOf(LIST.SOLID), blend: listOf(LIST.BLEND), sky: listOf(LIST.SKY), inserts: listOf(LIST.INSERT), cast: listOf(LIST.CAST), movers: listOf(LIST.CAST), mask: listOf(LIST.MASK), marks: listOf(LIST.MARK) };
  // (all of them, to be emptied by number)
  lists.all = [lists.solid, lists.blend, lists.sky, lists.inserts, lists.cast, lists.movers, lists.mask, lists.marks];
  return lists;
}
// an entry's `extra` when it is a quad: 0 the quad itself; OVERLAY its mirror's overlay; CUT, EDGE — a mixed sheet's
// opaque paint, its other pixels; a leaf of the land: LEAF | its row. An entry that is no quad: GLOW — `extra` a row
// of the glows; EMITTER — `extra` an emitter
const OVERLAY = 1, CUT = 2, EDGE = 4, LEAF = 1 << 30, GLOW = -1, EMITTER = -2;
// no run begun yet in a list: no shape's number, no sprite's
const NO_SHAPE = -3;
// the rows of the order one entry may take: the parts of a piece of nine corners (a sky quad: its turns — as many as
// its posed sheet reaches into, these at the least)
const PARTS = 4;
// how far past its corners' turns a backdrop's turns are looked for (stage heights: a float's error in the shader)
const TURN_SLACK = 1e-3;
// the piece of a quad the SCREEN shape draws: how much wider than the view it is cut, each side (clip units: the view
// is 2 wide); the share of the near plane's distance it is cut from
const PIECE = Object.freeze({ WIDER: 0.125, NEAR: 0.5 });
// The pipelines of the quads by number: P.<which> for the main passes' set, P.SET + that for a mirror's own; a
// receiver's variant is the next after its plain one (a mirror's set has none: there both are the plain); then those
// only the frame's passes, a light's view and the masks have
const P = Object.freeze({ SOLID: 0, CUT: 2, BLEND: 4, EDGE: 6, MULTIPLY: 8, SKY: 9, LAND_SOLID: 10, LAND_BLEND: 11, SET: 12, INSERT: 24, MASK: 25, CAST: 26, PLANE: 27, GLASS: 28, MARK: 29, N: 30 });
// … and an own slot's, OWN_P.N a slot: its blend, cut and edge for the main passes, the same + OWN_P.SET for a
// mirror's; a light view's; the mark's
const OWN_P = Object.freeze({ BLEND: 0, CUT: 1, EDGE: 2, SET: 3, CAST: 6, MARK: 7, N: 8 });

export function createQuads(gpu, lib, sheets) {
  const B = GPUBufferUsage;
  const shape = shapes();
  const corners = gpu.buffer('corners', shape.corners.byteLength, B.VERTEX | B.COPY_DST), index = gpu.buffer('shapes', shape.indices.byteLength, B.INDEX | B.COPY_DST);
  gpu.write(corners, 0, shape.corners); gpu.write(index, 0, shape.indices);
  // the order: its rows, written once in a call that draws
  let cap = 4096, bytes = new ArrayBuffer(cap * ROW), u32 = new Uint32Array(bytes), f32 = new Float32Array(bytes), i32 = new Int32Array(bytes), rows = 0;
  let order = gpu.buffer('order', cap * ROW, B.VERTEX | B.COPY_DST);
  // a world's: its quads' spheres (centre, radius — the world's metres) and placed corners, with the stamps they were
  // worked out at; its pipelines by number (pipes: the pipelines themselves; pipeAt: by P; ownAt: an own slot's, by
  // OWN_P); its families' groups by number; its elements' order rules;
  // whether it has casters
  let world = null, sphere = new Float64Array(0), corner = new Float64Array(0), stamped = new Uint32Array(0), castsAny = false;
  let pipes = [], ownAt = new Int32Array(0), groups = [], rules = null, ruled = new Uint8Array(0), culls = 0;
  const pipeAt = new Int32Array(P.N);
  // of a cull: an element's farthest and nearest keys; the planes met — each its (node, lift), its key (the farthest
  // of its quads), whether no quad of it has been drawn yet
  let elFar = new Float64Array(0), elNear = new Float64Array(0), elTick = new Uint32Array(0);
  let planes = new Float64Array(0), planeTick = new Uint32Array(0), planeKey = new Float64Array(0), planeFree = new Uint8Array(0);
  // the rows a shot's swaps end, marked for one view at a time (SH2)
  let endedAt = new Uint32Array(0), ends = 0;
  const lift1 = new Float32Array(1), liftBits = new Uint32Array(lift1.buffer);
  const O3 = new Float64Array(3), C = [new Float64Array(3), new Float64Array(3), new Float64Array(3), new Float64Array(3)], S4 = new Float64Array(4), R4 = new Float64Array(4), page = new Int32Array(2);
  // a flat quad in a view's clip space: its corners; the piece of it the view sees, cut side by side — six numbers a
  // corner: clip x, y, z, w and where it is on the sheet (metres from the origin page's corner); the piece's corners
  // as the order's rows carry them (three numbers each), and how many they are
  // (how far before a view's eye points are: ahead's answers; a sphere's radius as its corners widen it — a number a
  // loop carries is kept in an array: 5.16)
  const far = new Float64Array(4);
  const K4 = new Float64Array(16), cutA = new Float64Array(6 * 10), cutB = new Float64Array(6 * 10), cutD = new Float64Array(10), pieceAt = new Float32Array(3 * 10), BOX = new Float64Array(4);
  // (a quad in lay: its rect's sides — wide, tall —, the greater of them, and its edge-on fade: edgeOf's answer)
  const DIM = new Float64Array(4);
  // a sky quad's turns (first, last); a corner of it, placed
  const TURNS = new Int32Array(2), T3 = new Float64Array(3);
  let pieceN = 0;
  // what varies across a quad this frame: the light (a lamp, a window, panes, the land's shadow), the light in the
  // air, the haze (by its reach: across a quad HAZE_STEP times smaller than it the haze changes by less than a step
  // of the main target's colour), the people's blob (its square of the level: x0, z0, x1, z1 — the world's)
  const varies = { light: false, air: false, reach: Infinity, blob: false, at: new Float64Array(4) };
  // how far up and down the land goes, by the heights RENDER sampled (render/land.js): what a draped quad's sphere holds
  let tall = 0;
  // of the call, all its views together (RN8): quads that have an entry among what blends; draws, triangles; lit
  // points — and those by shape (by SHAPE's numbers; after them the SCREEN shape's, whatever its grid); the particles
  // of the emitters drawn
  const counters = { blended: 0, draws: 0, triangles: 0, lit: 0, shapes: new Int32Array(SHAPES + 1), particles: 0 };

  function build(w) {
    world = w; groups = [null];
    const has = w.C.has, mirrors = !!(has.reflects || has.glass);
    castsAny = !!has.casters;
    // every pipeline a list of this world can ask, found once: a run carries its number
    pipes = []; pipeAt.fill(-1);
    const add = key => pipes.push(lib.get(key)) - 1;
    const pair = (at, key, set) => { pipeAt[at] = add(key + set); pipeAt[at + 1] = !set && castsAny ? add(`${key}-recv`) : pipeAt[at]; };
    for (const set of mirrors ? ['', ':mirror'] : ['']) {
      const at = set ? P.SET : 0;
      pair(at + P.SOLID, 'solid', set); pair(at + P.CUT, 'cut', set); pair(at + P.BLEND, 'blend', set); pair(at + P.EDGE, 'edge', set);
      pipeAt[at + P.MULTIPLY] = add(`multiply${set}`); pipeAt[at + P.SKY] = add(`sky${set}`);
      if (has.relief) { pipeAt[at + P.LAND_SOLID] = add(`land-solid${set}`); pipeAt[at + P.LAND_BLEND] = add(`land-blend${set}`); }
    }
    if (has.inserts) pipeAt[P.INSERT] = add('insert');
    if (has.clips) pipeAt[P.MASK] = add('mask');
    if (castsAny) pipeAt[P.CAST] = add('cast');
    if (has.reflects) pipeAt[P.PLANE] = add('mirror-plane');
    if (has.glass) pipeAt[P.GLASS] = add('mirror-glass');
    if (has.people) pipeAt[P.MARK] = add('mark');
    ownAt = new Int32Array(OWN_P.N * w.own.length).fill(-1);
    w.own.forEach((o, slot) => {
      const n = lib.ownKey(o.text, o.names), at = OWN_P.N * slot;
      for (const set of mirrors ? ['', ':mirror'] : ['']) {
        const s = at + (set ? OWN_P.SET : 0);
        ownAt[s + OWN_P.BLEND] = add(`own:${n}${set}`); ownAt[s + OWN_P.CUT] = add(`own-cut:${n}${set}`); ownAt[s + OWN_P.EDGE] = add(`own-edge:${n}${set}`);
      }
      if (castsAny) ownAt[at + OWN_P.CAST] = add(`own-cast:${n}`);
      if (has.people) ownAt[at + OWN_P.MARK] = add(`own-mark:${n}`);
    });
    // (a world's rows begin as the last one's did: nothing of its spheres is kept)
    stamped.fill(0);
    rules = new Map(); ruled = new Uint8Array(w.elements.length);
    for (const el of w.elements) {
      const E = el.spec;
      if (!E.behind?.length && !E.inFront?.length) continue;
      const rule = { behind: (E.behind || []).map(id => w.byId.get(id)?.index ?? -1), inFront: (E.inFront || []).map(id => w.byId.get(id)?.index ?? -1) };
      rules.set(el.index, rule);
      // (what has a rule is drawn blended, and what it names too: 5.17)
      ruled[el.index] = 1;
      for (const t of rule.behind) if (t >= 0) ruled[t] = 1;
      for (const t of rule.inFront) if (t >= 0) ruled[t] = 1;
    }
  }
  // a family's group of this frame, by a number a run carries (0: none)
  function group(bindGroup) { groups.push(bindGroup); return groups.length - 1; }

  // the grid's row of a form quad in a view: a shot's view takes it from its swaps (WT10)
  function formOf(q, view) {
    if (view && view.ahead) for (let k = 0; k < view.overN; k++) if (view.over[3 * k] === q) return view.over[3 * k + 2];
    return world.quads.form[q];
  }
  // corner k of a quad's rect — (l, t), (r, t), (l, b), (r, b) — placed for a view of the yaw given in C[k][2] → C[k]
  // (the numbers go to place() in the array: none is handed over)
  function cornerAt(q, k, over) {
    const R = world.quads.rect, r = 4 * q, c = C[k];
    c[0] = k & 1 ? R[r + 2] : R[r]; c[1] = k & 2 ? R[r + 3] : R[r + 1];
    place(world, q, c, over);
  }
  // the most the wind may bend the posed quad q (it has a layer with wind) by, metres
  function bendOf(q) {
    const M = world.nodes.m, o = 12 * world.quads.node[q];
    return Math.abs(world.layers.opts[12 * world.quads.layer[q] + 2]) * (world.look.wind[2] + WIND.FAST) * Math.sqrt(M[o] ** 2 + M[o + 1] ** 2 + M[o + 2] ** 2);
  }
  // A quad's sphere, worked out again when its row, its node's or its layer's was stamped — its four placed corners
  // kept with it (what faces the eye: as it stands turned to no view). view: a view with a shot's overrides or swaps
  // (its nodes placed elsewhere, its forms): worked out for it, with its camera's turn, kept nowhere
  function sphereOf(q, view, out) {
    const Q = world.quads, node = Q.node[q], layer = Q.layer[q];
    const over = view && (view.nodesN > 0 || (view.ahead && view.overN > 0)) ? view : null;
    const kind = Q.kind[q], R = Q.rect, r = 4 * q, yaw = over ? over.camera.yaw : 0, windy = layer >= 0 && (Q.flags[q] & FLAG.WIND) !== 0 && kind !== QUAD.FORM;
    const stamp = Math.max(stampedAt(world, q), world.relief ? world.relief.stamp : 0, windy ? world.look.stamp : 0);
    // (what lies on the land: as far up and down as the land goes — added to what is kept: the land's heights come by
    // and by)
    const lift = kind === QUAD.DRAPE ? tall : 0;
    if (!over && stamped[q] === stamp + 1) { out[0] = sphere[4 * q]; out[1] = sphere[4 * q + 1]; out[2] = sphere[4 * q + 2]; out[3] = sphere[4 * q + 3] + lift; return out; }
    if (kind === QUAD.FORM) {
      // (the grid's sphere, its node's metres, taken into the world — about where its painting's middle is placed)
      const F = world.forms.list[formOf(q, over)], S = F ? F.sphere : null;
      O3[0] = 0.5 * (R[r] + R[r + 2]); O3[1] = 0.5 * (R[r + 1] + R[r + 3]); O3[2] = yaw;
      if (!S || !place(world, q, O3, over)) { out[3] = -1; return out; }
      let M = world.nodes.m, o = 12 * node;
      if (over) for (let k = 0; k < over.nodesN; k++) if (over.nodeOf[k] === node) { M = over.nodes; o = 12 * k; break; }
      const s = Math.sqrt(M[o] ** 2 + M[o + 1] ** 2 + M[o + 2] ** 2), x = Q.flags[q] & FLAG.FLIP ? -S[0] : S[0];
      out[0] = M[o] * x + M[o + 3] * S[1] + M[o + 6] * S[2] + M[o + 9]; out[1] = M[o + 1] * x + M[o + 4] * S[1] + M[o + 7] * S[2] + M[o + 10];
      out[2] = M[o + 2] * x + M[o + 5] * S[1] + M[o + 8] * S[2] + M[o + 11]; out[3] = S[3] * s;
    } else {
      for (let k = 0; k < 4; k++) { C[k][2] = yaw; cornerAt(q, k, over); }
      if (!over) for (let k = 0; k < 4; k++) { corner[12 * q + 3 * k] = C[k][0]; corner[12 * q + 3 * k + 1] = C[k][1]; corner[12 * q + 3 * k + 2] = C[k][2]; }
      for (let a = 0; a < 3; a++) out[a] = 0.25 * (C[0][a] + C[1][a] + C[2][a] + C[3][a]);
      // (what faces the eye is turned about its node's vertical by the view: kept, a sphere about that axis holds it
      // at any turn; for a shot's view it stands as that view turns it)
      if (kind === QUAD.FACING && !over) { const M = world.nodes.m, o = 12 * node; out[0] = M[o + 9]; out[2] = M[o + 11]; }
      far[0] = 0;
      for (let k = 0; k < 4; k++) far[0] = Math.max(far[0], Math.sqrt((C[k][0] - out[0]) ** 2 + (C[k][1] - out[1]) ** 2 + (C[k][2] - out[2]) ** 2));
      const rr = far[0];
      // (what the wind bends: wider by the bound of its bend — its layer's wind strength × (the look's wind + WIND.FAST),
      // the posed layer's metres, as its node scales them: SH10 asks its pages by the same)
      out[3] = rr + (windy ? bendOf(q) : 0);
    }
    if (!over) { sphere[4 * q] = out[0]; sphere[4 * q + 1] = out[1]; sphere[4 * q + 2] = out[2]; sphere[4 * q + 3] = out[3]; stamped[q] = stamp + 1; }
    out[3] += lift;
    return out;
  }
  // how near the eye the nearest point of an upright quad (a card, what faces the eye) comes along the gaze: a flat
  // quad's nearest is at a corner — its sphere only says it may be near (a wall as wide as a street always may)
  function nearest(q, view) {
    cornersOf(q, view);
    const windy = world.quads.layer[q] >= 0 && (world.quads.flags[q] & FLAG.WIND) !== 0;
    for (let k = 0; k < 4; k++) ahead(view.e, C[k], far, k);
    return Math.min(far[0], far[1], far[2], far[3]) - (windy ? bendOf(q) : 0);
  }
  // The four placed corners of a flat quad in a drawn view → C: (l, t), (r, t), (l, b), (r, b) of its rect. What
  // faces the eye is placed turned to this view; any other is as kept with its sphere
  function cornersOf(q, view) {
    const Q = world.quads;
    if (Q.kind[q] === QUAD.FACING) {
      for (let k = 0; k < 4; k++) { C[k][2] = view.camera.yaw; cornerAt(q, k, null); }
      return;
    }
    sphereOf(q, null, S4);
    for (let k = 0; k < 4; k++) { C[k][0] = corner[12 * q + 3 * k]; C[k][1] = corner[12 * q + 3 * k + 1]; C[k][2] = corner[12 * q + 3 * k + 2]; }
  }
  // room for the world's rows as they are now (its tables grow)
  function room() {
    const Q = world.quads, n = Q.cap, els = world.elements.length;
    if (sphere.length < 4 * n) { sphere = new Float64Array(4 * n); corner = new Float64Array(12 * n); stamped = new Uint32Array(n); endedAt = new Uint32Array(n); }
    if (elFar.length < els) { elFar = new Float64Array(els); elNear = new Float64Array(els); elTick = new Uint32Array(els); }
    let size = 64;
    while (size < 2 * n) size *= 2;
    if (planes.length < size) { planes = new Float64Array(size); planeTick = new Uint32Array(size); planeKey = new Float64Array(size); planeFree = new Uint8Array(size); }
  }
  // The frame begins: the order emptied, the families' groups forgotten. light, air: whether the light, the light in
  // the air vary across every quad this frame; reach: the haze's; blob: the people's blob map's square (x0, z0, x1,
  // z1 — the world's), or null; land: how far up and down the land goes (render/land.js Ld.tall)
  function begin(light, air, reach, blob, land) {
    rows = 0; groups.length = 1;
    varies.light = light; varies.air = air; varies.reach = reach; varies.blob = !!blob;
    if (blob) varies.at.set(blob);
    tall = land;
    counters.blended = 0; counters.draws = 0; counters.triangles = 0; counters.lit = 0; counters.particles = 0;
    counters.shapes.fill(0);
    room();
  }
  // the rows a shot's view leaves out — those its swaps end (SH2) — marked: then ended(q) answers for that view
  function mark(view) {
    ends++;
    if (view.ahead) for (let k = 0; k < view.overN; k++) if (view.over[3 * k + 1] < 0) endedAt[view.over[3 * k]] = ends;
  }
  const ended = q => endedAt[q] === ends;

  // whether a node is shown in a view (a shot's overrides: rows its values hide and show)
  function shownIn(node, ahead) {
    if (ahead) {
      for (let k = 0; k < ahead.hiddenN; k++) if (ahead.hidden[k] === node) return false;
      for (let k = 0; k < ahead.shownN; k++) if (ahead.shown[k] === node) return true;
    }
    return world.nodes.shown[node] !== 0;
  }
  // a plane — a node, a lift — in this cull → its place among the planes met (planeKey, planeFree there)
  function planeAt(node, lift) {
    // (−0 is 0)
    lift1[0] = lift + 0;
    const key = node * 4294967296 + liftBits[0], mask = planes.length - 1;
    let at = (Math.imul(node, 0x9e3779b1) ^ liftBits[0]) & mask;
    while (planeTick[at] === culls) { if (planes[at] === key) return at; at = (at + 1) & mask; }
    planeTick[at] = culls; planes[at] = key; planeKey[at] = -Infinity; planeFree[at] = 1;
    return at;
  }
  // how much of a card turned its own way is left, seen edge on: thinner than a pixel or two across the way it is
  // foreshortened, it fades out — into DIM[3]. DIM: its rect's sides (wide, tall)
  function edgeOf(e, q) {
    const wide = DIM[0], tall = DIM[1];
    sphereOf(q, null, S4);
    const M = world.nodes.m, o = 12 * world.quads.node[q];
    const xl = Math.sqrt(M[o] ** 2 + M[o + 1] ** 2 + M[o + 2] ** 2) || 1, yl = Math.sqrt(M[o + 3] ** 2 + M[o + 4] ** 2 + M[o + 5] ** 2) || 1, nl = Math.sqrt(M[o + 6] ** 2 + M[o + 7] ** 2 + M[o + 8] ** 2) || 1;
    let dx = S4[0] - e.eye[0], dy = S4[1] - e.eye[1], dz = S4[2] - e.eye[2];
    const dl = Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2) || 1;
    dx /= dl; dy /= dl; dz /= dl;
    // (the gaze in its plane: the way it is foreshortened along — how much of it is across its painting, how much up it)
    const facing = Math.abs(M[o + 6] * dx + M[o + 7] * dy + M[o + 8] * dz) / nl;
    const ax = Math.abs(M[o] * dx + M[o + 1] * dy + M[o + 2] * dz) / xl, ay = Math.abs(M[o + 3] * dx + M[o + 4] * dy + M[o + 5] * dz) / yl, al = Math.sqrt(ax ** 2 + ay ** 2);
    if (al < 1e-6) { DIM[3] = 1; return; }
    const extent = (wide * xl * ax + tall * yl * ay) / al;
    ahead(e, S4, far, 0);
    pxAt(e, far, 0);
    DIM[3] = Math.min(1, Math.max(0, (facing * extent * far[0] - 0.5) / 2));
  }
  // the page under the eye's foot on a quad — from place() at three of its corners (its mapping is SCENE's) → page
  // (x, y). DIM: its rect's sides
  function footOf(view, q) {
    const eye = view.e.eye, wide = DIM[0], tall = DIM[1];
    for (let k = 0; k < 3; k++) { C[k][2] = view.camera.yaw; cornerAt(q, k, null); }
    let uu = 0, vv = 0, du = 0, dv = 0;
    for (let a = 0; a < 3; a++) { const u = C[1][a] - C[0][a], v = C[2][a] - C[0][a], d = eye[a] - C[0][a]; uu += u * u; vv += v * v; du += d * u; dv += d * v; }
    page[0] = Math.round(Math.min(1, Math.max(0, du / (uu || 1))) * wide * SHEET.MAX_PPM / SHEET.PAGE);
    page[1] = Math.round(Math.min(1, Math.max(0, dv / (vv || 1))) * tall * SHEET.MAX_PPM / SHEET.PAGE);
  }
  // whether anything varies across a quad this frame (what its lit points are for). DIM[2]: its size
  function variesOn(q, flags) {
    const size = DIM[2];
    if (flags & FLAG.MULTIPLY) return false;
    if (varies.air || size * HAZE_STEP > varies.reach) return true;
    if (flags & FLAG.GLOWS) return false;
    if (varies.light) return true;
    if (!varies.blob) return false;
    sphereOf(q, null, S4);
    return S4[0] + S4[3] > varies.at[0] && S4[0] - S4[3] < varies.at[2] && S4[2] + S4[3] > varies.at[1] && S4[2] - S4[3] < varies.at[3];
  }
  // The shape a flat quad (a card, one that faces the eye, a plane) is drawn by in a view (5.12) → its number, or −1:
  // nothing of it is in the view. Wholly in view: the grid over its own rect, by what its placed corners span there
  // (v: something varies across it — else four points). Cut by a side of the view: the SCREEN shape — the piece seen:
  // its corners (round it, each with where it is on the sheet: metres from the quad's origin page's corner (px, py))
  // cut by the view's sides in turn; its corners then into pieceAt, pieceN of them — (x, y, 1) / w each —, and its
  // grid by its bounds in the view. In doubles; nothing allocated
  function flatShape(view, q, v, px, py) {
    const e = view.e, five = !e.ortho, R = world.quads.rect, r = 4 * q, wide = R[r + 2] - R[r], tall = R[r + 3] - R[r + 1];
    cornersOf(q, view);
    let whole = true;
    for (let k = 0; k < 4; k++) {
      clip(e, C[k], K4, 4 * k);
      const x = K4[4 * k], y = K4[4 * k + 1], cw = K4[4 * k + 3];
      if (x < -cw || x > cw || y < -cw || y > cw || (five && K4[4 * k + 2] > cw)) whole = false;
    }
    // (its bounds in the view, B: x0, y0, x1, y1 — numbers a loop widens, kept in an array: 5.16)
    const B = BOX;
    B[0] = Infinity; B[1] = Infinity; B[2] = -Infinity; B[3] = -Infinity;
    if (whole) {
      if (!v) return SHAPE.FLAT;
      for (let k = 0; k < 4; k++) { const x = K4[4 * k] / K4[4 * k + 3], y = K4[4 * k + 1] / K4[4 * k + 3]; if (x < B[0]) B[0] = x; if (x > B[2]) B[2] = x; if (y < B[1]) B[1] = y; if (y > B[3]) B[3] = y; }
      SPAN[0] = Math.max(0.5 * (B[2] - B[0]) * view.width, 0.5 * (B[3] - B[1]) * view.height);
      return gridOf(LIT.CELL, SHAPE.FLAT);
    }
    if (!wide || !tall) return -1;
    // the piece the view sees, a little wider (PIECE): its corners round it — (l, t), (r, t), (r, b), (l, b) — cut by
    // each side in turn (a corner on a side is kept, once)
    const ox = px * SHEET.PAGE / SHEET.MAX_PPM, oy = py * SHEET.PAGE / SHEET.MAX_PPM, G = 1 + PIECE.WIDER;
    let src = cutA, dst = cutB, n = 4;
    for (let k = 0; k < 4; k++) {
      const from = 4 * (k === 2 ? 3 : k === 3 ? 2 : k);
      for (let a = 0; a < 4; a++) src[6 * k + a] = K4[from + a];
      src[6 * k + 4] = (k === 1 || k === 2 ? wide : 0) - ox; src[6 * k + 5] = (k >= 2 ? tall : 0) - oy;
    }
    for (let side = 0, sides = five ? 5 : 4; side < sides && n; side++) {
      let m = 0;
      // (each corner's distance inside this side — into cutD)
      for (let a = 0; a < n; a++) {
        const ao = 6 * a;
        if (side === 0) cutD[a] = G * src[ao + 3] - src[ao]; else if (side === 1) cutD[a] = G * src[ao + 3] + src[ao];
        else if (side === 2) cutD[a] = G * src[ao + 3] - src[ao + 1]; else if (side === 3) cutD[a] = G * src[ao + 3] + src[ao + 1];
        else cutD[a] = src[ao + 3] - PIECE.NEAR * src[ao + 2];
      }
      for (let a = 0; a < n; a++) {
        const ao = 6 * a, bo = 6 * ((a + 1) % n), da = cutD[a], db = cutD[(a + 1) % n];
        if (da >= 0) { for (let k = 0; k < 6; k++) dst[6 * m + k] = src[ao + k]; m++; }
        if ((da > 0 && db < 0) || (da < 0 && db > 0)) { const f = da / (da - db); for (let k = 0; k < 6; k++) dst[6 * m + k] = src[ao + k] + (src[bo + k] - src[ao + k]) * f; m++; }
      }
      const was = src; src = dst; dst = was; n = m;
    }
    if (n < 3) return -1;
    for (let k = 0; k < n; k++) {
      // (every corner left is before the eye: the sides cut what is not. Its bounds: of the view itself)
      const o = 6 * k, iw = 1 / src[o + 3], x = Math.min(1, Math.max(-1, src[o] * iw)), y = Math.min(1, Math.max(-1, src[o + 1] * iw));
      if (x < B[0]) B[0] = x; if (x > B[2]) B[2] = x; if (y < B[1]) B[1] = y; if (y > B[3]) B[3] = y;
      // (on the sheet: within the quad's rect — the cut's own arithmetic may leave a corner a hair outside it)
      pieceAt[3 * k] = Math.min(wide - ox, Math.max(-ox, src[o + 4])) * iw; pieceAt[3 * k + 1] = Math.min(tall - oy, Math.max(-oy, src[o + 5])) * iw; pieceAt[3 * k + 2] = iw;
    }
    // (seen exactly edge on: nothing of it is seen)
    if (!(B[2] > B[0]) || !(B[3] > B[1])) return -1;
    pieceN = n;
    if (v) SPAN[0] = Math.max(0.5 * (B[2] - B[0]) * view.width, 0.5 * (B[3] - B[1]) * view.height); else SPAN[0] = 0;
    return SHAPE.SCREEN | gridOf(LIT.CELL, SHAPE.MID);
  }
  // The quads that cast and are seen in a view, whatever light they cast in (render/shadows.js: what a light is worth
  // to) → their rows into `into`, their spheres into `spheres` (four numbers each); → how many
  function casters(view, ahead, into, spheres) {
    const Q = world.quads, e = view.e;
    let n = 0;
    room();
    mark(view);
    for (let q = 0; q < Q.n; q++) {
      const kind = Q.kind[q], flags = Q.flags[q];
      if (!Q.cast[q] || !(flags & FLAG.SHOWN) || flags & (FLAG.GLASS | FLAG.CUT_ONLY) || kind === QUAD.SKY || kind === QUAD.INSERT || kind === QUAD.DRAPE || ended(q) || !shownIn(Q.node[q], ahead)) continue;
      sphereOf(q, view, S4);
      if (S4[3] < 0 || !sees(e, S4)) continue;
      spheres[4 * n] = S4[0]; spheres[4 * n + 1] = S4[1]; spheres[4 * n + 2] = S4[2]; spheres[4 * n + 3] = S4[3];
      into[n++] = q;
    }
    return n;
  }
  // (whether quad row q covers anything of a box of the view: clip x0, y0, x1, y1)
  function hides(q, view, box) {
    sphereOf(q, view, S4);
    return covers(view.e, S4, R4) && R4[0] < box[2] && R4[2] > box[0] && R4[1] < box[3] && R4[3] > box[1];
  }
  const inGroup = (mirror, el) => { for (let k = 0; k < mirror.membersN; k++) if (mirror.members[k] === el) return true; return false; };
  // Whether a view may show quad row q — the one test of it, a cull's and `changes`' (o: the cull's options; the
  // rows the view's swaps end are marked: mark). A quad that has a sphere: it into S4
  function admits(view, o, q) {
    const Q = world.quads, flags = Q.flags[q], kind = Q.kind[q], light = o.light ?? -1, mirror = o.mirror || null, glass = (flags & FLAG.GLASS) !== 0;
    if (!(flags & FLAG.SHOWN) || ended(q)) return false;
    if (flags & FLAG.REFLECTED_ONLY && !mirror) return false;
    if (!shownIn(Q.node[q], o.ahead)) return false;
    if (light >= 0 && (glass || !Q.cast[q] || kind === QUAD.SKY || kind === QUAD.INSERT || kind === QUAD.DRAPE || !world.castsIn(q, light))) return false;
    if (mirror) {
      if (glass || kind === QUAD.INSERT || inGroup(mirror, Q.el[q])) return false;
      if (kind === QUAD.SKY && !mirror.sky) return false;
      if (kind === QUAD.DRAPE && mirror.glass) return false;
    }
    if (kind === QUAD.INSERT) return !!view.inserts;
    if (kind === QUAD.SKY) return true;
    sphereOf(q, view, S4);
    return S4[3] >= 0 && sees(view.e, S4);
  }
  // (whether a view's list — rows in their order — has quad row q)
  function lists(view, q) {
    const list = view.list;
    let lo = 0, hi = view.n - 1;
    while (lo <= hi) { const mid = (lo + hi) >> 1, at = list[mid]; if (at === q) return true; if (at < q) lo = mid + 1; else hi = mid - 1; }
    return false;
  }
  // Whether the rows stamped since tick T (3.4) change what a cull of this view gives — its camera, its size and
  // its options being what they were at that cull (a quad the wind bends is as good as stamped when the look was:
  // its sphere holds the look's bound of its bend): a quad stamped since is in its list and may be shown no more, or
  // is not and may be now; drawn: its lists are drawn — any quad of its list stamped changes them (where it stands
  // is its place in their order; what moves leaves the list of what stands)
  function changes(view, o, T, drawn) {
    const Q = world.quads;
    room();
    mark(view);
    const windy = since(world.look.stamp, T);
    for (let q = 0; q < Q.n; q++) {
      if (!since(stampedAt(world, q), T) && !(windy && (Q.flags[q] & FLAG.WIND) !== 0)) continue;
      if (lists(view, q) ? drawn || !admits(view, o, q) : admits(view, o, q)) return true;
    }
    return false;
  }

  // The quads a view may show → view.list, view.n (SH10); with `draw`, its lists too. o: { draw; ahead (a shot's entry of f.ahead: the rows its values hide and show — its other overrides are the
  // view's own fields); mirror (a mirror's view — its group: what is seen only in mirrors is seen, its own planes —
  // its members — are not, nor any pane; a pane's: no sky, nothing draped); light (a light's
  // view: its row — only what casts in it, by world.castsIn); casts ('static' | 'movers': which of them the lists
  // take), mover (render/shadows.js: whether a quad moves); land, mirrors, own (the families: a leaf's rows, a quad's
  // overlay, an own slot's group); glows, particles (the frame's view: the sprites sorted among what blends); passes
  // (the frame's view: what stands upright fades as the eye passes it close by — it is drawn blended there); marks
  // (the frame's view, people in it: { box — what they cover of it, clip x0, y0, x1, y1 —, far — the farthest of them
  // before the eye }; what blends wholly and may hide one of them — over their box, nearer than the farthest — is laid
  // again in `marks` where its paint is opaque: render/wgsl/quad.js 'mark') }
  function cull(view, o) {
    const Q = world.quads, e = view.e, L = e.lists, draw = !!o.draw, light = o.light ?? -1, marks = pipeAt[P.MARK] >= 0 ? o.marks : null;
    let n = 0, blended = 0;
    culls++;
    mark(view);
    if (view.list.length < Q.n) view.list = new Int32Array(Q.cap);
    if (draw) for (let k = 0; k < L.all.length; k++) L.all[k].n = 0;
    for (let q = 0; q < Q.n; q++) {
      if (!admits(view, o, q)) continue;
      const flags = Q.flags[q], kind = Q.kind[q], el = Q.el[q], node = Q.node[q], glass = (flags & FLAG.GLASS) !== 0;
      let depth = 0, radius = 0;
      if (kind !== QUAD.INSERT && kind !== QUAD.SKY) { ahead(e, S4, far, 0); depth = far[0]; radius = S4[3]; }
      view.list[n++] = q;
      if (!draw || Q.sheet[q] < 0 || flags & FLAG.READ) continue;
      if (light >= 0) {
        // (what casts: what stands in the static map, what moves in the movers' — an unseen cutter casts nothing)
        if (flags & FLAG.CUT_ONLY) continue;
        const moves = o.mover(q);
        if (o.casts === 'movers' ? moves : !moves) push(moves ? L.movers : L.cast, q, 0, depth);
        continue;
      }
      // (a cutter of a clip: into the masks — a pane cuts nothing; an unseen cutter only there)
      if (Q.clip[q] & 0xf0 && !glass) push(L.mask, q, 0, depth);
      if (flags & FLAG.CUT_ONLY) continue;
      if (kind === QUAD.SKY) { push(L.sky, q, 0, q); continue; }
      if (kind === QUAD.INSERT) { push(L.inserts, q, 0, q); continue; }
      // (a form: by its nearest point — 5.23)
      if (kind === QUAD.FORM) { push(L.solid, q, 0, depth - radius); continue; }
      // its plane, and the plane's key: where its node stands before the eye — what faces the eye; the farthest of its
      // placed corners — a card turned its own way, a plane; as much nearer as its layer's depth says
      const layer = Q.layer[q], lift = layer < 0 ? 0 : world.layers.opts[12 * layer + 7], at = planeAt(node, lift);
      let key;
      if (kind === QUAD.FACING) { const M = world.nodes.m, a = 12 * node; O3[0] = M[a + 9]; O3[1] = M[a + 10]; O3[2] = M[a + 11]; ahead(e, O3, far, 0); key = far[0]; }
      else { cornersOf(q, view); for (let k = 0; k < 4; k++) ahead(e, C[k], far, k); key = Math.max(far[0], far[1], far[2], far[3]); }
      if (key - lift > planeKey[at]) planeKey[at] = key - lift;
      // (its overlay: only with its mirror placed this frame)
      const M = flags & (FLAG.REFLECTS | FLAG.GLASS) && o.mirrors ? o.mirrors.of(q) : null, over = !!M && M.group !== 0;
      // (a pane: its overlay alone, by its plane's key — the plane stays free for what is drawn)
      if (glass) { if (over) { push(L.blend, q, OVERLAY, at); blended++; } continue; }
      // (of a plane only the first quad drawn may lay depth: what is over it is drawn blended — the first that paints:
      // one that paints nothing at all, nor has an own shader to paint, leaves the plane free for its layers)
      const own = Q.own[q], first = planeFree[at] === 1, flat = kind === QUAD.PLANE || kind === QUAD.DRAPE;
      if (own || !sheets.blank(Q.sheet[q])) planeFree[at] = 0;
      // (… and what stands upright with a point nearer the eye than PASS.TO fades there — 5.17: its fading pixels are
      // not opaque paint, so it is a mixed sheet at most: its `cut` lays the depth of what is opaque and not fading — a
      // ceiling or a wall running past the eye hides what stands behind it from all that reads the depth —, its `edge`
      // blends the rest)
      const passed = !!o.passes && !flat && depth - radius < PASS.TO && nearest(q, view) < PASS.TO;
      // (its opaque paint: 2 all of it — solid —, 1 some of it — its `cut` and its `edge` —, 0 none that lays depth; an
      // own shader's painting with any is cut and edge as it shades it: its shader may paint where the painting has none)
      const opaque = first && !(flags & (FLAG.ADD | FLAG.MULTIPLY | FLAG.CLIPPED)) && !ruled[el] && (layer < 0 || world.layers.pose[8 * layer + 5] >= 1) ? (own || passed ? Math.min(1, sheets.solid(Q.sheet[q])) : sheets.solid(Q.sheet[q])) : 0;
      if (kind === QUAD.DRAPE) {
        // (draped on the land: whole by the land's two pipelines, over the leaves under it)
        const range = o.land.rowsOf(q), first_ = range[0], count = range[1];
        for (let k = 0; k < count; k++) if (sees(e, o.land.sphere(first_ + k, S4))) { if (opaque !== 2) push(L.blend, q, LEAF | (first_ + k), at); else { ahead(e, S4, far, 0); push(L.solid, q, LEAF | (first_ + k), far[0]); } }
      } else if (opaque === 2) push(L.solid, q, 0, depth);
      else if (opaque === 1) { push(L.solid, q, CUT, depth); push(L.blend, q, EDGE, at); }
      else {
        push(L.blend, q, 0, at);
        // (the frame's view, with people in it: laid again where its paint is opaque — the ids behind it cleared, as a
        // solid's; what adds or multiplies hides nothing, nor a layer not wholly there, nor a painting with no opaque
        // paint, nor what is behind them all or beside what they cover)
        if (marks && !(flags & (FLAG.ADD | FLAG.MULTIPLY)) && (layer < 0 || world.layers.pose[8 * layer + 5] >= 1) && (own || sheets.solid(Q.sheet[q]) > 0) && depth - radius < marks.far && hides(q, view, marks.box)) push(L.marks, q, 0, depth);
      }
      if (over) push(L.blend, q, OVERLAY, at);
      if (opaque !== 2 || over) blended++;
    }
    view.n = n;
    if (!draw) return;
    if (light >= 0) { lay(view, L.cast, false, o); lay(view, L.movers, false, o); return; }
    // what blends: each entry by its plane's key
    const Bl = L.blend;
    for (let i = 0; i < Bl.n; i++) Bl.key[i] = planeKey[Bl.key[i]];
    // (the order rules: an element's quads just behind the farthest, or just before the nearest, of those it names)
    if (rules.size) {
      for (let i = 0; i < Bl.n; i++) {
        const el = Q.el[Bl.quad[i]], key = Bl.key[i];
        if (elTick[el] !== culls) { elTick[el] = culls; elFar[el] = key; elNear[el] = key; }
        else { if (key > elFar[el]) elFar[el] = key; if (key < elNear[el]) elNear[el] = key; }
      }
      for (let i = 0; i < Bl.n; i++) {
        const rule = rules.get(Q.el[Bl.quad[i]]);
        if (!rule) continue;
        let key = Bl.key[i];
        for (let k = 0; k < rule.behind.length; k++) { const t = rule.behind[k]; if (t >= 0 && elTick[t] === culls) key = Math.max(key, elFar[t] + 1e-3); }
        for (let k = 0; k < rule.inFront.length; k++) { const t = rule.inFront[k]; if (t >= 0 && elTick[t] === culls) key = Math.min(key, elNear[t] - 1e-3); }
        Bl.key[i] = key;
      }
    }
    counters.blended += blended;
    // the frame's sprites among them: each light's glow, each emitter that has anything in the air
    if (o.glows) for (let i = 0; i < o.glows.glowN; i++) push(Bl, GLOW, i, o.glows.glowAhead[i]);
    if (o.particles) for (let k = 0; k < o.particles.n; k++) if (o.particles.flies(k)) push(Bl, EMITTER, k, o.particles.ahead[k]);
    lay(view, L.solid, false, o);
    lay(view, Bl, true, o);
    lay(view, L.sky, false, o);
    lay(view, L.inserts, false, o);
    lay(view, L.mask, false, o);
    lay(view, L.marks, false, o);
  }

  // a run begun in a list: its pipeline, its shape (or what sprite it is), its first row, its family's group
  let lastPipe = -1, lastShape = -1, lastGroup = -1, run = -1;
  function start(L, p, sh, first, g) {
    if (5 * (L.runsN + 1) > L.runs.length) { const more = new Int32Array(L.runs.length * 2); more.set(L.runs); L.runs = more; }
    run = 5 * L.runsN++;
    L.runs[run] = p; L.runs[run + 1] = sh; L.runs[run + 2] = first; L.runs[run + 3] = 0; L.runs[run + 4] = g;
    lastPipe = p; lastShape = sh; lastGroup = g;
  }
  // the turns of the circle a sky quad's sheet reaches into, seen by a view of that yaw → TURNS (first, last): looking
  // round there are none (0, 0); a backdrop's, its posed corners' (place.js backdropAt, turnOf), as far as the wind
  // may bend it (render/wgsl/frame.js e_windBend: its layer's strength × (|the look's wind| + WIND.FAST), the posed
  // sheet's units — so many aside)
  function turnsOf(q, yaw) {
    TURNS[0] = 0; TURNS[1] = 0;
    if (world.sky.round) return;
    const Q = world.quads, R = Q.rect, r = 4 * q, layer = Q.layer[q];
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < 4; k++) {
      T3[0] = k & 1 ? R[r + 2] : R[r]; T3[1] = k & 2 ? R[r + 3] : R[r + 1]; T3[2] = yaw;
      backdropAt(world, q, T3);
      if (T3[0] < lo) lo = T3[0];
      if (T3[0] > hi) hi = T3[0];
    }
    const reach = TURN_SLACK + (layer >= 0 && (Q.flags[q] & FLAG.WIND) ? Math.abs(world.layers.opts[12 * layer + 2]) * (Math.abs(world.look.wind[2]) + WIND.FAST) : 0);
    TURNS[0] = turnOf(lo - reach); TURNS[1] = turnOf(hi + reach);
  }
  // room in the order for so many rows more
  function roomFor(more) {
    if (rows + more <= cap) return;
    while (rows + more > cap) cap *= 2;
    const wider = new ArrayBuffer(cap * ROW);
    new Uint8Array(wider).set(new Uint8Array(bytes, 0, rows * ROW));
    bytes = wider; u32 = new Uint32Array(bytes); f32 = new Float32Array(bytes); i32 = new Int32Array(bytes);
    gpu.drop(order);
    order = gpu.buffer('order', cap * ROW, B.VERTEX | B.COPY_DST);
  }
  // a list's entries sorted (far to near, or near to far) and written as rows of the order; its runs
  function lay(view, L, farFirst, o) {
    const Q = world.quads, e = view.e, n = L.n, kindOf = L.kind, set = o.mirror ? P.SET : 0, lit = kindOf !== LIST.CAST && kindOf !== LIST.MASK && kindOf !== LIST.MARK;
    L.runsN = 0;
    if (!n) return;
    for (let i = 0; i < n; i++) { L.idx[i] = i; if (farFirst) L.key[i] = -L.key[i]; }
    sort(L.idx, n, L.key, L.scratch);
    // (room for every entry's rows: a quad drawn by the SCREEN shape has up to PARTS; a sky quad that reaches into
    // more turns than that makes room for the rest itself)
    roomFor(PARTS * n);
    lastPipe = -1; lastShape = NO_SHAPE; lastGroup = -1; run = -1;
    for (let i = 0; i < n; i++) {
      const at = L.idx[i], q = L.quad[at], extra = L.extra[at];
      if (q < 0) {
        // (a sprite: a run of the glows' rows that follow one another, or an emitter)
        if (run < 0 || q !== GLOW || lastShape !== GLOW || L.runs[run + 2] + L.runs[run + 3] !== extra) start(L, -1, q, extra, 0);
        L.runs[run + 3]++;
        continue;
      }
      const flags = Q.flags[q], kind = Q.kind[q], own = Q.own[q], recv = castsAny && Q.recv[q] !== 0 ? 1 : 0;
      let sh = SHAPE.FLAT, p, g = 0, px = 0, py = 0, bits = 0;
      DIM[3] = 1;
      if (extra & LEAF) {
        // (a leaf of the land under a draped quad: its row of the leaves in the shape's word)
        sh = SHAPE.FINE; bits = (extra & ~LEAF) << 8; g = o.land.group;
        p = pipeAt[set + (kindOf === LIST.SOLID ? P.LAND_SOLID : P.LAND_BLEND)];
        o.land.page(extra & ~LEAF, page);
        px = page[0]; py = page[1];
      } else {
        // (its sides and size in an array: what is asked of them is handed no fraction — 5.16)
        const R = Q.rect, r = 4 * q;
        DIM[0] = Math.abs(R[r + 2] - R[r]); DIM[1] = Math.abs(R[r + 3] - R[r + 1]); DIM[2] = Math.max(DIM[0], DIM[1]);
        const staged = kind === QUAD.SKY || kind === QUAD.INSERT;
        // (its origin page: the page under the eye's foot on it — any quad's whose sheet is too wide for a float)
        if (!staged && kind !== QUAD.FORM && DIM[2] * SHEET.MAX_PPM >= FAR_PX) { footOf(view, q); px = page[0]; py = page[1]; }
        if (kind === QUAD.FORM) {
          // (the coarsest stride at which a cell is under FORM.CELL px)
          sphereOf(q, null, S4);
          ahead(e, S4, far, 0);
          pxAt(e, far, 0);
          SPAN[0] = 2 * S4[3] * far[0];
          sh = gridOf(FORM.CELL, SHAPE.MID);
        } else if (kind === QUAD.SKY) sh = SHAPE.FINE;
        else if (kind === QUAD.INSERT) sh = SHAPE.FLAT;
        else if (flags & FLAG.WIND) sh = SHAPE.COLUMN;
        else {
          sh = flatShape(view, q, lit && variesOn(q, flags), px, py);
          // (nothing of it is in the view: no row)
          if (sh < 0) continue;
        }
        // (a card turned its own way, seen edge on: thinner than a pixel or two, it fades out)
        if (kind === QUAD.CARD && kindOf !== LIST.CAST) edgeOf(e, q);
        if (extra === OVERLAY) { p = pipeAt[flags & FLAG.GLASS ? P.GLASS : P.PLANE]; g = o.mirrors.of(q).group; }
        else if (kindOf === LIST.CAST) { p = own ? ownAt[OWN_P.N * (own - 1) + OWN_P.CAST] : pipeAt[P.CAST]; if (own) g = o.own.group(own - 1); }
        else if (kindOf === LIST.MASK) p = pipeAt[P.MASK];
        else if (kindOf === LIST.MARK) { p = own ? ownAt[OWN_P.N * (own - 1) + OWN_P.MARK] : pipeAt[P.MARK]; if (own) g = o.own.group(own - 1); }
        // (an own shader's: its blend, or — a painting with opaque paint — its cut and its edge)
        else if (own) { p = ownAt[OWN_P.N * (own - 1) + (set ? OWN_P.SET : 0) + (extra === CUT ? OWN_P.CUT : extra === EDGE ? OWN_P.EDGE : OWN_P.BLEND)]; g = o.own.group(own - 1); }
        else if (kindOf === LIST.SOLID) p = pipeAt[set + (extra === CUT ? P.CUT : P.SOLID) + recv];
        // (a layer that multiplies, of the sky or of an insert too: `multiply` places both and keeps an insert's iris)
        else if (flags & FLAG.MULTIPLY) p = pipeAt[set + P.MULTIPLY];
        else if (kindOf === LIST.SKY) p = pipeAt[set + P.SKY];
        else if (kindOf === LIST.INSERT) p = pipeAt[P.INSERT];
        else p = pipeAt[set + (extra === EDGE ? P.EDGE : P.BLEND) + recv];
      }
      if (p < 0) throw new Error('renderer: a quad whose pipeline was not asked for this world — an engine fault');
      // (a sky quad: a row a turn of the circle it reaches into — its turn in the shape's word)
      let parts = sh & SHAPE.SCREEN ? (pieceN - 1) >> 1 : 1, turn = 0;
      if (q >= 0 && !(extra & LEAF) && Q.kind[q] === QUAD.SKY) {
        turnsOf(q, view.camera.yaw);
        turn = TURNS[0]; parts = TURNS[1] - TURNS[0] + 1;
        if (parts > PARTS) roomFor(PARTS * (n - i) + parts);
      }
      if (p !== lastPipe || sh !== lastShape || g !== lastGroup) start(L, p, sh, rows, g);
      // (a row; the SCREEN shape: one a part of the piece — the fan from its first corner, two corners on at a time)
      for (let part = 0; part < parts; part++) {
        const w = rows * WORDS;
        u32[w] = q; u32[w + 1] = sh | bits | (turn + part) << 8; i32[w + 2] = px; i32[w + 3] = py; f32[w + 4] = DIM[3];
        if (sh & SHAPE.SCREEN) for (let c = 0; c < 4; c++) {
          const from = 3 * (c ? Math.min(2 * part + c, pieceN - 1) : 0);
          f32[w + 5 + 3 * c] = pieceAt[from]; f32[w + 6 + 3 * c] = pieceAt[from + 1]; f32[w + 7 + 3 * c] = pieceAt[from + 2];
        }
        L.runs[run + 3]++;
        rows++;
      }
    }
  }

  return {
    build, begin, cull, changes, casters, group, counters,
    // the order's rows to the GPU: once, when every view's lists are laid — in a call that draws
    flush() { if (rows) gpu.write(order, 0, bytes, 0, rows * ROW); },
    // A list's runs drawn (groups 0 and 1 set by the caller; group 2 is left `none`). sprites: who draws a run that
    // is no quads' — { glow(pass, first, count), emitter(pass, k) } (they set what they need; group 2 is theirs then)
    draw(pass, L, none, sprites) {
      if (!L.runsN) return;
      let bound = 0, mine = false;
      const lit = L.kind === LIST.SOLID || L.kind === LIST.BLEND;
      for (let k = 0; k < L.runsN; k++) {
        const r = 5 * k, sh = L.runs[r + 1], g = L.runs[r + 4], count = L.runs[r + 3];
        if (sh < 0) {
          if (sh === GLOW) sprites.glow(pass, L.runs[r + 2], count); else sprites.emitter(pass, L.runs[r + 2]);
          mine = false; bound = -1;
          continue;
        }
        const range = shape.ranges[sh & ~SHAPE.SCREEN];
        if (!mine) { pass.setVertexBuffer(0, corners); pass.setVertexBuffer(1, order); pass.setIndexBuffer(index, 'uint32'); mine = true; }
        pass.setPipeline(pipes[L.runs[r]]);
        if (g !== bound) { pass.setBindGroup(2, g ? groups[g] : none); bound = g; }
        pass.drawIndexed(range.count, count, range.first, 0, L.runs[r + 2]);
        counters.draws++; counters.triangles += range.count / 3 * count;
        if (lit) { counters.lit += range.points * count; counters.shapes[sh & SHAPE.SCREEN ? SHAPES : sh] += range.points * count; }
      }
      if (bound) pass.setBindGroup(2, none);
    },
  };
}
