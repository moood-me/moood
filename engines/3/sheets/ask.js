// Which pages a view reads (SH10) — worked out on the scene's thread from where each quad's sheet lies in that view: no
// GPU, no read-back. For every quad the view may show: its sheet's rect placed in the view (world/place.js — the one
// mapping of every kind, the shader's twin), clipped to the view, the level the screen needs there (4.8, below), and
// the pages of that level under what is seen.
//   ONE descent serves every kind. A node is a page of some level of the sheet: its corners are taken to the view's
// clip space, the four-cornered piece is cut by the view's sides, and the level is worked out at the corners of what
// is left (the finest and the coarsest the screen needs of it). A page is named where the screen reads its level; the
// node's four quarters are gone down into where it needs a finer one.
//   A FLAT piece (a card, a plane, an insert, one block of a form, a turn of a backdrop) has its four corners placed
// once; its points are bilinear between them — exact for a flat piece — so a node costs no call of place. Its descent
// begins at the level where what is seen of it is a few pages, and a piece wholly in view at one level names that
// level's pages at once. A BACKDROP — a sky that does not go round — is a plane before the gaze (place.js
// backdropWay): its ways, not made units, are affine in the sheet's point, so each turn of the circle the view may
// see of it is a flat piece, cut out of the sheet by that turn's two sides where the sheet goes past them.
//   A CURVED kind — a plane draped on the land, a sky that goes round — is not its corners: a node reads NINE points
// of it (its corners, its sides' middles, its middle: its quarters' corners — the lattice of its level). Where a
// point of such a sheet is, and how it moves along the sheet's x and y, does not depend on the view: three calls of
// place (the point; a STEP along x; a STEP along y) give it, ONCE — the points are kept (below: the points of the
// curved quads), so however the camera moves, and whichever view asks, the land's own function is called for a
// point once while the quad's rows stand. A view takes a kept point into its clip space by arithmetic alone, and the
// level there follows from how the point moves (the chain rule — the same level the differences of three placed
// points give). The node's piece is cut by the view as a flat one's is; at a corner of what is left the level is
// the node's corner's own, and where the view's side cuts the piece — a point no lattice has: it moves with the
// camera — the point is worked out there and not kept; each of the other five points seen gives its own. So a
// camera that moves works out, of a curved quad, the points where its view's sides cross the nodes and the points
// of the land that come into view. A curved node none of whose points is seen, and whose points are not all
// beyond one side of the view, is looked BETWEEN: gone down into, and named at the finest level. Its descent
// begins at its sheet's top: the nodes above the pages named cost arithmetic alone.
//   The level (4.8): a = |dx|, b = |dy| — level-0 px of the sheet a screen px along the screen's x and y: of a flat
// piece by differences of its points a small step apart, of a curved one's point by how it moves there —, T the taps
// of the quad's kind (2 for a plane and a draped one, else 1):
// level = max(log2(min(a, b)), log2(max(a, b) / T)) + the view's bias (quarter levels: its pressure and its own
// `coarser`), clamped to the sheet's levels. A pixel at level λ reads the page of level ⌊λ + SHEET.SOFT⌋ (its half
// level, kept with it, carries it to the next; a level wholly coarser it reads magnified, 2^SOFT at the most). The
// levels named run from what the corners' pixels read to an eighth coarser than they say, and the view is taken two px
// wider: where the screen's own differences land a pixel on the other side of a whole level or of the view's edge,
// its page is named too — a pixel a little finer than its corners, past a whole level, reads the page named there a
// level coarser than its own (the table reads the finest there is above a page).
//   A form is asked by blocks of FORM.BLOCK cells of its grid, each a flat piece between its corner points (5.23). A
// quad read elsewhere than where it stands (FLAG.WHOLE: an own shader's sheets, a layer that drifts or wraps) is
// asked whole — every page of every level the view reads of it, from the finest it needs up (each level above is a
// quarter of the pages) —, never finer than the level at which its sheet has at most host.wholePages pages; an own
// shader's further sheets (world.own[k].quads) are asked with its base quad alone — a further sheet's row is no item
// of its own, listed or not —, one read whole at the levels the screen needs of that quad; one that lies as its base
// does (read where it stands and not whole, so its layer's pose is nothing to it; the base's kind and node; neither
// flipped nor bent by the wind; the base on no layer; no swap waiting on either; its sheet laid out as the base's)
// names the very pages the base's descent named, with no descent of its own. A sky that goes round is read where it
// stands: the one descent names its pages. A quad the wind bends (FLAG.WIND) is clipped to the view widened by its
// layer's greatest bend — the layer's wind strength × (the look's wind strength + WIND.FAST), metres of the POSED
// layer (the bend is added after the pose): in the sheet's units, that over the smaller of the pose's |scaleX| and
// |scaleY| —: a point of the sheet is asked where any point that near it is in view, so the strip the wind brings in
// was asked. Inserts are asked when the view says so: those whose quads the view's list has — open in THIS view (R
// lists an insert's quads exactly when its node is shown in it: the world's, or the shot's) — as the view's own;
// every other insert's quads from the world's rows, quietly (preparation: the cache serves them after every view's
// own pages and counts them in no pressure; the view does not wait for them). A
// quad waiting for its swap (SH2): in a shot's view (`ahead`) the swap's sheet alone; in the frame's views both —
// the sheet it shows till the swap lands, placed as it stands, and the swap's; a swap whose quad the view's list has
// not is asked by itself. A row a swap ENDS (handle −1: the shot's cut frees it) is not asked in a shot's view; the
// frame's views ignore that triple.
//   Each page's parent (coarse to fine) is the cache's to name (sheets/cache.js).
//   A PROBE (5.19: the view asked a quarter level finer, its names counted and nothing else) is asked as the view is,
// its own pages named as the probe's; it asks no closed insert (that is not in what it counts).
//   What is worked out, and what is named again (SH10). An ask goes by ITEMS: a quad row asked one way — one the view
// lists, an insert it does not (asked quietly), a swap whose quad it does not list — with the further sheets its own
// shader reads. What an item names depends on nothing another item names — only on the view and on its own rows —, so
// an item is worked out again only when something its pages are worked out from changed since the view's last ask,
// and is named again as it was then (the cache keeps what each named: `kept`) otherwise. What its pages are worked
// out from: of the view — its size, bias, weight, swaps and overrides (any of them another: every item is
// worked out, CHANGED.ALL), and what a quad of its kind reads of the camera (READS: the sky is a way, not a place —
// where the eye stands is nothing to it; an insert lies on the frame — the camera is nothing to it); of the world —
// its quad's row, its node's, its layer's (3.4's test against the tick of that last ask), the look where the wind
// bends it, and the same of every further sheet's row.
import { QUAD, FLAG, FORM, SHEET, WIND } from '../base.js';
import { place, backdropAt, backdropWay, turnOf } from '../world/place.js';
import { since, stampedAt } from '../world/tables.js';
import { pagesX, pagesY } from './page.js';

const { PAGE, MAX_PPM, SOFT } = SHEET;
// what a page is named as: the view's own; kept for it, not waited for (a closed insert); a probe's (counted, nothing
// else: 5.19)
export const NAMED = Object.freeze({ OWN: 0, QUIET: 1, PROBE: 2 });
// what of a view is another than at its last ask (SH10 `changed`, bits): where its eye stands; how it is turned and
// what its lens is (the camera's turn, its projection); anything else an ask reads of it
export const CHANGED = Object.freeze({ EYE: 1, TURN: 2, ALL: 4 });
// … and which of them the pages of a quad are worked out from, by its kind
const READS = Uint8Array.from({ length: QUAD.KIND }, (_, kind) => (kind === QUAD.SKY ? CHANGED.TURN : kind === QUAD.INSERT ? 0 : CHANGED.EYE | CHANGED.TURN));
// how an item is asked: its quad is in the view's list; an insert that is not (quietly); a swap whose quad is not
export const ASKED = Object.freeze({ LISTED: 0, QUIET: 1, ALONE: 2 });
const { LISTED, QUIET, ALONE } = ASKED;
// (the slack of a level, coarser; the view's guard, px; the step of the differences, a sheet's units; a curved
// quad's samples a side when it is asked whole; what a row a swap ends is marked with among the view's swaps — no
// handle is that large)
const SLACK = 0.125, GUARD = 2, STEP = 1 / 512, GRID = 8, ENDS = 0x7fffffff;
const BLOCKS = (FORM.SIDE - 1) / FORM.BLOCK, TAU = 2 * Math.PI;
// the points of the curved quads kept: a table's entries (a power of two), how many of them it is filled to, and
// the numbers of a point (where it is, how it moves a unit along the sheet's x, along its y: three each)
const POINTS = 1 << 15, FILLED = POINTS / 2, POINT = 9;
// The stand's (ST2 `ask …`): what an ask costs, by the kind of quad it works out — the sky, a plane draped on the land, a
// flat quad (a card, a plane, an insert), a form, a quad read whole — in the slot the renderer set (the frame's views,
// the mirrors', the shadow cells', the shots ahead's): ms (only while measuring: a clock read at each quad), quads
// worked out, nodes visited, calls of place, names (name() calls: a page twice named counts twice — the distinct pages
// are `sheets.cycle.named`); after the kinds, the cache's bookkeeping of the names (ms, names kept); and the items:
// asked, and of them worked out again by the first cause found — all of the view's were (`whole`), the camera moved in what its kind reads (`camera`), a row
// of it was stamped (`stamped`), the view had not asked it so (`new`). Plain counts are made always: one add each.
export const KINDS = Object.freeze(['sky', 'draped', 'flat', 'form', 'whole']), METRICS = Object.freeze(['ms', 'quads', 'nodes', 'places', 'names']);
export const ITEMS = Object.freeze(['asked', 'whole', 'camera', 'stamped', 'new']);
const BOOKED = KINDS.length * METRICS.length, ITEM = BOOKED + 2;
export const SLOTS = 4, SLOT_STRIDE = ITEM + ITEMS.length;
// The numbers of an ask, by their place in ONE array (5.16): a number kept in a variable of the ask, handed to one
// of its functions or handed back by one is made on the heap each time — and these are worked out for every corner
// of every page looked at. So a function here takes whole numbers alone and finds the others in the array:
//   PX, PY — the point of the sheet a function is given (placed, at, levelAt, point); LV — a level's answer;
//   X0 … Y1 — the rect a function is given (corners, span, piece, nine); XM, YM — a curved node's middle;
//   LO, HI — the finest and the coarsest level the screen needs over the piece looked at; WLO, WHI — the same two of
//     a sheet read whole, over all its pieces; BLO, BHI — the same two of an own shader's base quad, lent to its
//     further sheets;
//   EX0 … EY1 — the flat piece now: its rect (its corners are K);
//   J11 … J22 — how a point of the sheet moves on the screen: px along the screen's x and y a unit of the sheet's x
//     (J11, J21) and of its y (J12, J22) — what `leveled` takes;
//   SA, SX, SY — a backdrop: how far aside of the gaze the sheet's point (x, y) is: SA + SX · x + SY · y; SLO, SHI —
//     the turn now: its two sides, as far aside;
//   L0, T0 — the sheet's corner; RL … RB — its rect (the sheet's units: the layout's); BEND — how far the wind may
//     bend the quad (the sheet's units; 0: not bent);
//   YAW, VW, VH, BIAS — the view's yaw, its size, its bias (levels); GX, GY — how far past the view's sides a point
//     may be and count as seen: the guard.
const PX = 0, PY = 1, LV = 2, X0 = 3, Y0 = 4, X1 = 5, Y1 = 6, LO = 7, HI = 8, EX0 = 9, EY0 = 10, EX1 = 11, EY1 = 12;
const L0 = 13, T0 = 14, RL = 15, RT = 16, RR = 17, RB = 18, BEND = 19, YAW = 20, VW = 21, VH = 22, BIAS = 23, GX = 24, GY = 25;
const XM = 26, YM = 27, WLO = 28, WHI = 29, J11 = 30, J21 = 31, J12 = 32, J22 = 33, SA = 34, SX = 35, SY = 36, SLO = 37, SHI = 38, BLO = 39, BHI = 40, NUMBERS = 41;

// sheetOf(handle) → the sheet (its lay, its levels, its wholeL) or null; name(sheet, L, i, j, as) — a page named (as:
// NAMED's — its weight follows from it: the view's own at the view's weight, a quiet one at 0.5: the cache's, so no
// fraction is handed about here) by the item now; begin(q, how) — an item begins: what is named from here on is its; kept(q, how) → whether the view
// asked that item so at its last ask — then it is named again as it was.
export function createAsk(sheetOf, name, begin, kept) {
  // the view now: clip = A · X + B for a point X of the world (A alone for a way, a point at infinity)
  const A = new Float64Array(12), B = new Float64Array(4), N = new Float64Array(NUMBERS);
  let world = null, ortho = false, ahead = false, extra = null;
  // the stand's: its numbers (SLOTS slots of SLOT_STRIDE), the slot now, the place of the quad's kind in it, whether the
  // clock is read, the last reading (live: a quad has been begun in this ask)
  const stats = new Float64Array(SLOTS * SLOT_STRIDE);
  let slotAt = 0, cur = 0, timed = false, read = 0, live = false;
  // of the view's last ask: its tick; what of the view is another now (CHANGED's bits); whether the view has swaps
  let T = 0, moved = 0, swaps = false;
  // (what the view has other than the world: all of it — its swaps too —, and without its swaps: where a quad that
  // waits for its swap stands now)
  let swapped = null, unswapped = null;
  const nodesOnly = { nodes: null, nodeOf: null, nodesN: 0, over: null, overN: 0 };
  // the quad now: its row, kind, sheet and its layout; its taps, its top level; whether it is curved (a draped plane,
  // a sky that goes round: its points are the kept ones); what its pages are named as
  let quad = 0, kind = 0, sheet = null, lay = null, taps = 1, top = 0, curved = false, as = 0;
  // (the view's safe rect in its clip space: where an insert lies — SH10 View.stage)
  let stage = null;
  // a flat piece's four corners in clip space ((x0, y0), (x1, y0), (x0, y1), (x1, y1)); whether it is a turn of a
  // backdrop that the sheet goes past (the view's sides and the turn's two cut it)
  const K = new Float64Array(16);
  let strip = false;
  const out = new Float64Array(3), P = new Float64Array(12), G = new Float64Array(4 * (BLOCKS + 1) * (BLOCKS + 1));
  // a curved node's nine points in the view — twelve numbers each: its clip point, and how that moves a unit along
  // the sheet's x and along its y — three a row, from the node's top; a backdrop's corners: how far aside, how far up
  const Q9 = new Float64Array(12 * 9), S8 = new Float64Array(8);
  // a node's corners, and the piece cut by the view: six numbers a corner (clip x, y, z, w; the sheet's x, y)
  const CN = new Float64Array(24), V1 = new Float64Array(6 * 16), V2 = new Float64Array(6 * 16);
  let cutAny = false;
  // the swaps of the view: a quad's row → its sheet's handle + 1 (0: none; below zero: asked; ENDS: a shot's view,
  // and the swap ends the row); the insert quads the view's list has (open in this view)
  let swapOf = new Int32Array(256), open = new Uint8Array(256);

  // the point (PX, PY) of the quad's sheet placed, into o[k … k + 3] (clip space) → whether it is there
  function placed(o, k) {
    stats[cur + 3]++;
    out[0] = N[PX]; out[1] = N[PY]; out[2] = N[YAW];
    const there = place(world, quad, out, extra);
    // (an insert lies on the safe rect — the view's `stage`: heights to the right of its middle and down from its top —
    // whatever its iris)
    if (kind === QUAD.INSERT) { o[k] = stage[0] + out[0] * stage[2]; o[k + 1] = stage[1] - out[1] * stage[3]; o[k + 2] = 0.5; o[k + 3] = 1; return true; }
    if (!there) return false;
    const X = out[0], Y = out[1], Z = out[2];
    if (kind === QUAD.SKY) for (let r = 0; r < 4; r++) o[k + r] = A[3 * r] * X + A[3 * r + 1] * Y + A[3 * r + 2] * Z;
    else for (let r = 0; r < 4; r++) o[k + r] = A[3 * r] * X + A[3 * r + 1] * Y + A[3 * r + 2] * Z + B[r];
    return true;
  }
  // … the same of the flat piece now: between its corners
  function at(o, k) {
    const u = (N[PX] - N[EX0]) / (N[EX1] - N[EX0]), v = (N[PY] - N[EY0]) / (N[EY1] - N[EY0]), w00 = (1 - u) * (1 - v), w10 = u * (1 - v), w01 = (1 - u) * v, w11 = u * v;
    for (let r = 0; r < 4; r++) o[k + r] = K[r] * w00 + K[4 + r] * w10 + K[8 + r] * w01 + K[12 + r] * w11;
  }

  // ── the points of the curved quads ──
  // A point is kept by its quad's row, the stamp of that quad's rows (3.4: rows stamped again are another quad's
  // worth of points) and the point itself — its x and y of the sheet, which every node works out the same way (node:
  // from the sheet's corner and whole numbers), so the corner two nodes share, and the middle of a node that is its
  // quarters' corner, are one point. A quad a view places elsewhere (a shot's overrides) has its points for that
  // ask alone: `stamp` below zero, another each time.
  //   Two tables, open addressing (an entry: row + 1 — 0: not taken — and stamp; x and y; the point's nine numbers):
  // the one being filled and the one before it. A point is looked for in the first, then in the second — found
  // there, it is moved over —, else worked out: three calls of place. When the first is filled to FILLED the second
  // is forgotten and they change places: a point in use is never worked out twice, one no view reads is let go a
  // turn later; nothing is scanned, nothing freed. Made when the first curved quad of a world is asked: a world
  // without land and with a backdrop has none. Each world asked has its own (a scene being made beside the one drawn
  // is asked in the same cycles: 2.9) — found by the world, let go with it.
  const pointsBy = new WeakMap();
  let points = null, stamp = 0, lone = 0, pv = null, po = 0;
  const bits = new Float64Array(2), words = new Uint32Array(bits.buffer), carried = new Float64Array(POINT);
  function pointsOf() {
    const table = () => ({ rows: new Int32Array(2 * POINTS), at: new Float64Array(2 * POINTS), v: new Float64Array(POINT * POINTS), n: 0 });
    return { now: table(), was: table() };
  }
  // (where (row, stamp, x, y) is in a table, or where it goes: → its entry; `found`)
  let found = false;
  function entry(t, h, x, y) {
    for (let e = h & (POINTS - 1); ; e = (e + 1) & (POINTS - 1)) {
      const row = t.rows[2 * e];
      if (row === 0) { found = false; return e; }
      if (row === quad + 1 && t.rows[2 * e + 1] === stamp && t.at[2 * e] === x && t.at[2 * e + 1] === y) { found = true; return e; }
    }
  }
  // the point (PX, PY) of the curved quad now → its nine numbers at po of pv
  function point() {
    const x = N[PX], y = N[PY];
    bits[0] = x; bits[1] = y;
    let h = Math.imul(words[0], 0x9e3779b1) ^ Math.imul(words[1], 0x85ebca6b) ^ Math.imul(words[2], 0xc2b2ae35) ^ Math.imul(words[3], 0x27d4eb2f) ^ Math.imul(quad + 1, 0x165667b1) ^ stamp;
    h ^= h >>> 15;
    let t = points.now, e = entry(t, h, x, y);
    if (found) { pv = t.v; po = POINT * e; return; }
    const was = points.was, e0 = entry(was, h, x, y), had = found;
    if (had) for (let k = 0; k < POINT; k++) carried[k] = was.v[POINT * e0 + k];
    // (the table being filled is full: the one before it forgotten, and filled from here on)
    if (t.n === FILLED) { points.now = was; points.was = t; t = was; t.rows.fill(0); t.n = 0; e = entry(t, h, x, y); }
    t.rows[2 * e] = quad + 1; t.rows[2 * e + 1] = stamp; t.at[2 * e] = x; t.at[2 * e + 1] = y; t.n++;
    pv = t.v; po = POINT * e;
    if (had) for (let k = 0; k < POINT; k++) pv[po + k] = carried[k]; else worked(pv, po);
  }
  // the point (PX, PY) of the curved quad now worked out — where it is, and where the points a STEP along the
  // sheet's x and y are: three calls of place — into the nine numbers at o of v
  function worked(v, o) {
    const x = N[PX], y = N[PY];
    stats[cur + 3] += 3;
    out[0] = x; out[1] = y; out[2] = N[YAW];
    place(world, quad, out, extra);
    const X = out[0], Y = out[1], Z = out[2];
    v[o] = X; v[o + 1] = Y; v[o + 2] = Z;
    out[0] = x + STEP; out[1] = y; out[2] = N[YAW];
    place(world, quad, out, extra);
    v[o + 3] = (out[0] - X) / STEP; v[o + 4] = (out[1] - Y) / STEP; v[o + 5] = (out[2] - Z) / STEP;
    out[0] = x; out[1] = y + STEP; out[2] = N[YAW];
    place(world, quad, out, extra);
    v[o + 6] = (out[0] - X) / STEP; v[o + 7] = (out[1] - Y) / STEP; v[o + 8] = (out[2] - Z) / STEP;
  }
  // the point found (pv, po) in the view: its clip point, and how that moves a unit along the sheet's x and its y —
  // twelve numbers at k of o (a way has no place: the eye's is nothing to it)
  function shown(o, k) {
    const sky = kind === QUAD.SKY;
    for (let r = 0; r < 4; r++) {
      const a = A[3 * r], b = A[3 * r + 1], c = A[3 * r + 2];
      o[k + r] = a * pv[po] + b * pv[po + 1] + c * pv[po + 2] + (sky ? 0 : B[r]);
      o[k + 4 + r] = a * pv[po + 3] + b * pv[po + 4] + c * pv[po + 5];
      o[k + 8 + r] = a * pv[po + 6] + b * pv[po + 7] + c * pv[po + 8];
    }
  }
  // (which of the view's sides a clip point is outside of, as bits: right, left, top, bottom, before the eye's plane)
  function outside(o, k) {
    const x = o[k], y = o[k + 1], w = o[k + 3], sx = N[GX], sy = N[GY];
    return (x > sx * w ? 1 : 0) | (x < -sx * w ? 2 : 0) | (y > sy * w ? 4 : 0) | (y < -sy * w ? 8 : 0) | (!ortho && o[k + 2] > w ? 16 : 0);
  }
  // the level the screen needs where a point of the sheet moves on it as J11 … J22 say (4.8) → LV
  function leveled() {
    const j11 = N[J11], j21 = N[J21], j12 = N[J12], j22 = N[J22];
    const det = Math.abs(j11 * j22 - j12 * j21);
    // (seen edge on: no pixel is finer than its top)
    if (!(det > 1e-12)) { N[LV] = Infinity; return; }
    const a = Math.sqrt(j22 * j22 + j21 * j21) / det * MAX_PPM, b = Math.sqrt(j12 * j12 + j11 * j11) / det * MAX_PPM;
    N[LV] = Math.max(Math.log2(Math.min(a, b)), Math.log2(Math.max(a, b) / taps)) + N[BIAS];
  }
  // … where a clip point and how it moves a unit along the sheet's x and y are the twelve numbers at k of o: the
  // screen's point is (x, y) / w, so it moves by (x′ · w − x · w′) / w² (the chain rule) → LV — NaN where the point
  // is not before the eye
  function sharp(o, k) {
    const x = o[k], y = o[k + 1], w = o[k + 3];
    if (!(w > 0)) { N[LV] = NaN; return; }
    const hw = N[VW] / 2 / (w * w), hh = N[VH] / 2 / (w * w);
    N[J11] = (o[k + 4] * w - x * o[k + 7]) * hw; N[J21] = (o[k + 5] * w - y * o[k + 7]) * hh;
    N[J12] = (o[k + 8] * w - x * o[k + 11]) * hw; N[J22] = (o[k + 9] * w - y * o[k + 11]) * hh;
    leveled();
  }
  // the level the screen needs of the sheet at (PX, PY) of the piece now → LV — NaN where it is not before the eye.
  // A flat piece: by its points a STEP along the sheet's x and y. A curved node (its rect X0 … Y1, its nine points
  // in Q9): at a corner of it the corner's own; elsewhere (where a side of the view cuts its piece) the point is
  // worked out there, for this once
  function levelAt() {
    const x = N[PX], y = N[PY];
    if (curved) {
      const c = x === N[X0] ? 0 : x === N[X1] ? 2 : -1, r = y === N[Y0] ? 0 : y === N[Y1] ? 2 : -1;
      if (c >= 0 && r >= 0) { sharp(Q9, 12 * (3 * r + c)); return; }
      worked(carried, 0);
      pv = carried; po = 0;
      shown(P, 0);
      sharp(P, 0);
      return;
    }
    at(P, 0);
    N[PX] = x + STEP; at(P, 4);
    N[PX] = x; N[PY] = y + STEP; at(P, 8);
    N[PY] = y;
    const w0 = P[3], w1 = P[7], w2 = P[11];
    if (!(w0 > 0 && w1 > 0 && w2 > 0)) { N[LV] = NaN; return; }
    const hw = N[VW] / 2, hh = N[VH] / 2, sx = P[0] / w0 * hw, sy = P[1] / w0 * hh;
    N[J11] = (P[4] / w1 * hw - sx) / STEP; N[J21] = (P[5] / w1 * hh - sy) / STEP; N[J12] = (P[8] / w2 * hw - sx) / STEP; N[J22] = (P[9] / w2 * hh - sy) / STEP;
    leveled();
  }
  // the level a pixel that asks N[k] (way −1) or a slack coarser (way 1) reads, within the sheet's levels
  function levelOf(k, way) {
    const v = N[k] + SOFT + (way > 0 ? SLACK : 0);
    return v >= top ? top : v > 0 ? Math.floor(v) : 0;
  }

  // the corners of the rect (X0 … Y1) of the flat piece now into CN, round it
  function corners() {
    const x0 = N[X0], y0 = N[Y0], x1 = N[X1], y1 = N[Y1];
    N[PX] = x0; N[PY] = y0; at(CN, 0);
    N[PX] = x1; at(CN, 6);
    N[PY] = y1; at(CN, 12);
    N[PX] = x0; at(CN, 18);
    CN[4] = x0; CN[5] = y0; CN[10] = x1; CN[11] = y0; CN[16] = x1; CN[17] = y1; CN[22] = x0; CN[23] = y1;
  }
  // The nine points of a curved node — the corners of its rect (X0 … Y1), its sides' middles and its middle (XM, YM)
  // — found among the points kept and taken into the view (Q9); its corners into CN, round it
  function nine() {
    const x0 = N[X0], y0 = N[Y0], x1 = N[X1], y1 = N[Y1], xm = N[XM], ym = N[YM];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      N[PX] = c === 0 ? x0 : c === 1 ? xm : x1; N[PY] = r === 0 ? y0 : r === 1 ? ym : y1;
      point();
      shown(Q9, 12 * (3 * r + c));
    }
    for (let k = 0; k < 4; k++) { CN[k] = Q9[k]; CN[6 + k] = Q9[24 + k]; CN[12 + k] = Q9[96 + k]; CN[18 + k] = Q9[72 + k]; }
    CN[4] = x0; CN[5] = y0; CN[10] = x1; CN[11] = y0; CN[16] = x1; CN[17] = y1; CN[22] = x0; CN[23] = y1;
  }
  // the piece of CN's four corners that the view sees — of a turn of a backdrop the sheet goes past (strip), what lies
  // between the turn's two sides too —, into V1 → its corners (0: none); cutAny: whether any of it was cut away
  function seen() {
    const sx = N[GX], sy = N[GY], sa = N[SA], sxx = N[SX], sxy = N[SY];
    let src = V1, dst = V2, n = 4;
    src.set(CN);
    cutAny = false;
    // (the sides: right, left, top, bottom; before the eye's plane; the turn's two)
    for (let p = 0; p < 7 && n; p++) {
      if (p === 4 ? ortho : p > 4 && !strip) continue;
      let m = 0;
      for (let a = 0; a < n; a++) {
        const ao = a * 6, bo = ((a + 1) % n) * 6;
        const da = p === 0 ? sx * src[ao + 3] - src[ao] : p === 1 ? sx * src[ao + 3] + src[ao] : p === 2 ? sy * src[ao + 3] - src[ao + 1] : p === 3 ? sy * src[ao + 3] + src[ao + 1] : p === 4 ? src[ao + 3] - src[ao + 2]
          : p === 5 ? sa + sxx * src[ao + 4] + sxy * src[ao + 5] - N[SLO] : N[SHI] - (sa + sxx * src[ao + 4] + sxy * src[ao + 5]);
        const db = p === 0 ? sx * src[bo + 3] - src[bo] : p === 1 ? sx * src[bo + 3] + src[bo] : p === 2 ? sy * src[bo + 3] - src[bo + 1] : p === 3 ? sy * src[bo + 3] + src[bo + 1] : p === 4 ? src[bo + 3] - src[bo + 2]
          : p === 5 ? sa + sxx * src[bo + 4] + sxy * src[bo + 5] - N[SLO] : N[SHI] - (sa + sxx * src[bo + 4] + sxy * src[bo + 5]);
        if (da >= 0) { for (let k = 0; k < 6; k++) dst[m * 6 + k] = src[ao + k]; m++; } else cutAny = true;
        if ((da >= 0) !== (db >= 0)) { const f = da / (da - db); for (let k = 0; k < 6; k++) dst[m * 6 + k] = src[ao + k] + (src[bo + k] - src[ao + k]) * f; m++; }
      }
      const was = src; src = dst; dst = was; n = m;
    }
    if (src !== V1) for (let k = 0; k < n * 6; k++) V1[k] = src[k];
    return n;
  }
  // (the finest and the coarsest level the screen needs over the piece seen — V1's n corners → LO, HI)
  function levels(n) {
    let lo = Infinity, hi = -Infinity;
    for (let v = 0; v < n; v++) {
      N[PX] = V1[v * 6 + 4]; N[PY] = V1[v * 6 + 5];
      levelAt();
      const s = N[LV];
      if (s === s) { if (s < lo) lo = s; if (s > hi) hi = s; }
    }
    N[LO] = lo; N[HI] = hi;
  }
  // the piece of CN's corners the view sees, and the levels the screen needs over it (LO, HI) → its corners (V1,
  // cutAny)
  function looked() {
    const n = seen();
    levels(n);
    return n;
  }
  // (a point of a curved quad in the view — the twelve numbers at k of Q9 — taken into the levels, if the view sees
  // it; → the sides it is outside of)
  function sample(k) {
    const o = outside(Q9, k);
    if (!o) {
      sharp(Q9, k);
      const s = N[LV];
      if (s === s) { if (s < N[LO]) N[LO] = s; if (s > N[HI]) N[HI] = s; }
    }
    return o;
  }

  // page (L, i, j) of the sheet now named, as the item names its pages — and kept, while an own shader's base quad is
  // asked whose further sheets may lie as it does (keeping: laidN pages, (L, i, j) each in laid)
  let keeping = false, laid = new Int32Array(3 * 256), laidN = 0;
  function page(L, i, j) {
    stats[cur + 4]++;
    name(sheet, L, i, j, as);
    if (!keeping) return;
    if (3 * laidN === laid.length) { const more = new Int32Array(2 * laid.length); more.set(laid); laid = more; }
    laid[3 * laidN] = L; laid[3 * laidN + 1] = i; laid[3 * laidN + 2] = j; laidN++;
  }
  // A node: page (L, i, j) of the sheet, as far as the quad's rect goes — and as much further each way as the wind
  // may bend it: any point that near the page in view, and the page is read
  function node(L, i, j) {
    stats[cur + 2]++;
    // (its sides from the sheet's corner and whole numbers: a side two nodes share, and a node's middle that is its
    // quarters' side, are the same number however they are come to — the points kept are found by them)
    const s = PAGE * 2 ** L / MAX_PPM, bend = N[BEND];
    let x0 = N[L0] + i * s, y0 = N[T0] + j * s, x1 = N[L0] + (i + 1) * s, y1 = N[T0] + (j + 1) * s;
    // (a curved node's middle: its quarters' side — or, of a node the sheet's edge cuts short, the middle of what
    // is left of it)
    const xm = x1 > N[RR] ? (x0 + N[RR]) / 2 : N[L0] + (2 * i + 1) * (s / 2), ym = y1 > N[RB] ? (y0 + N[RB]) / 2 : N[T0] + (2 * j + 1) * (s / 2);
    if (x0 < N[RL]) x0 = N[RL]; if (y0 < N[RT]) y0 = N[RT]; if (x1 > N[RR]) x1 = N[RR]; if (y1 > N[RB]) y1 = N[RB];
    if (!(x0 < x1 && y0 < y1)) return;
    x0 -= bend; y0 -= bend; x1 += bend; y1 += bend;
    N[X0] = x0; N[Y0] = y0; N[X1] = x1; N[Y1] = y1;
    if (curved) { N[XM] = xm; N[YM] = ym; nine(); } else corners();
    looked();
    // (between: nothing of a curved piece was found in view, and its points are not all before one side of the view
    // — the view looks between them: gone down into, and at the finest level named)
    let between = false;
    if (curved) {
      // (a curved piece is not its corners: its sides' middles and its middle too — all nine beyond one side of the
      // view: it is not seen)
      const off = outside(CN, 0) & outside(CN, 6) & outside(CN, 12) & outside(CN, 18) & sample(12) & sample(36) & sample(48) & sample(60) & sample(84);
      between = !(N[LO] <= N[HI]) && !off;
    }
    const has = N[LO] <= N[HI];
    if (!has && !between) return;
    // the page named where the view needs its level — or, looking between, at the finest —, gone down into where it
    // needs a finer one
    if (has ? levelOf(HI, 1) >= L && levelOf(LO, -1) <= L : L === 0) page(L, i, j);
    if (has ? levelOf(LO, -1) < L : L > 0) kids(L, i, j);
  }
  function kids(L, i, j) {
    const nx = pagesX(lay, L - 1), ny = pagesY(lay, L - 1);
    for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) if (2 * i + di < nx && 2 * j + dj < ny) node(L - 1, 2 * i + di, 2 * j + dj);
  }
  // (the pages of level L under the rect (X0 … Y1) of the sheet: its first and its last, across and down)
  let i0 = 0, i1 = 0, j0 = 0, j1 = 0;
  function span(L) {
    const s = PAGE * 2 ** L / MAX_PPM, nx = pagesX(lay, L), ny = pagesY(lay, L);
    i0 = Math.max(0, Math.floor((N[X0] - N[L0]) / s)); i1 = Math.min(nx - 1, Math.ceil((N[X1] - N[L0]) / s) - 1);
    j0 = Math.max(0, Math.floor((N[Y0] - N[T0]) / s)); j1 = Math.min(ny - 1, Math.ceil((N[Y1] - N[T0]) / s) - 1);
  }
  // A flat piece of the sheet — the rect (X0 … Y1), its corners in K — asked (seen as far as the wind may bend it:
  // its points go on past its rect as they lie between its corners)
  function piece() {
    const x0 = N[X0], y0 = N[Y0], x1 = N[X1], y1 = N[Y1], bend = N[BEND];
    N[EX0] = x0; N[EY0] = y0; N[EX1] = x1; N[EY1] = y1;
    N[X0] = x0 - bend; N[Y0] = y0 - bend; N[X1] = x1 + bend; N[Y1] = y1 + bend;
    corners();
    const n = looked();
    if (!n) return;
    const whole = !cutAny;
    if (!(N[LO] <= N[HI])) return;
    const fine = levelOf(LO, -1), coarse = levelOf(HI, 1);
    // (all of it in view at one level: that level's pages; where the view's side cuts the piece, the descent tells its
    // pages apart)
    if (whole && fine === coarse) {
      N[X0] = x0; N[Y0] = y0; N[X1] = x1; N[Y1] = y1;
      span(fine);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) page(fine, i, j);
      return;
    }
    // (where it is seen, in the sheet's units; from the level at which that is a few pages, down)
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (let v = 0; v < n; v++) { const x = V1[v * 6 + 4], y = V1[v * 6 + 5]; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    // (what is read: whatever lies as near what is seen as the wind bends)
    N[X0] = bx0 - bend; N[Y0] = by0 - bend; N[X1] = bx1 + bend; N[Y1] = by1 + bend;
    let L = coarse;
    for (span(L); L < top && (i1 - i0 > 1 || j1 - j0 > 1); span(L)) L++;
    const a0 = i0, a1 = i1, b0 = j0, b1 = j1;
    for (let j = b0; j <= b1; j++) for (let i = a0; i <= a1; i++) node(L, i, j);
  }
  // the quad's whole rect as a flat piece: its four corners placed → whether they are there
  function rectPlaced() {
    N[PX] = N[RL]; N[PY] = N[RT];
    if (!placed(K, 0)) return false;
    N[PX] = N[RR];
    if (!placed(K, 4)) return false;
    N[PX] = N[RL]; N[PY] = N[RB];
    if (!placed(K, 8)) return false;
    N[PX] = N[RR];
    return placed(K, 12);
  }
  function flat() {
    if (!rectPlaced()) return;
    N[X0] = N[RL]; N[Y0] = N[RT]; N[X1] = N[RR]; N[Y1] = N[RB];
    piece();
  }
  // A backdrop: each turn of the circle its sheet reaches into is a flat piece — its four corners the plane's ways
  // there (place.js backdropWay: not made units, so its points lie between them); where the sheet reaches into more
  // turns than one, a turn's piece is what lies between its two sides (seen: strip). wholly: the sheet is read whole
  // — each piece looked at for its levels; else asked
  function backdrop(wholly) {
    const rl = N[RL], rt = N[RT], rr = N[RR], rb = N[RB], yaw = N[YAW];
    // how far aside of the gaze and how far up its corners are; and so any point of it (it is laid by a pose: affine)
    stats[cur + 3] += 4;
    for (let c = 0; c < 4; c++) { out[0] = c & 1 ? rr : rl; out[1] = c & 2 ? rb : rt; out[2] = yaw; backdropAt(world, quad, out); S8[2 * c] = out[0]; S8[2 * c + 1] = out[1]; }
    N[SX] = (S8[2] - S8[0]) / (rr - rl); N[SY] = (S8[4] - S8[0]) / (rb - rt); N[SA] = S8[0] - N[SX] * rl - N[SY] * rt;
    // (the turns it reaches into, as far as the wind may bend it)
    const reach = N[BEND] * (Math.abs(N[SX]) + Math.abs(N[SY]));
    const n0 = turnOf(Math.min(S8[0], S8[2], S8[4], S8[6]) - reach), n1 = turnOf(Math.max(S8[0], S8[2], S8[4], S8[6]) + reach);
    strip = n1 > n0;
    for (let n = n0; n <= n1; n++) {
      for (let c = 0; c < 4; c++) {
        out[0] = S8[2 * c]; out[1] = S8[2 * c + 1]; out[2] = yaw;
        backdropWay(out, n);
        for (let r = 0; r < 4; r++) K[4 * c + r] = A[3 * r] * out[0] + A[3 * r + 1] * out[1] + A[3 * r + 2] * out[2];
      }
      N[SLO] = TAU * n - Math.PI; N[SHI] = TAU * n + Math.PI;
      if (wholly) wholePiece();
      else { N[X0] = rl; N[Y0] = rt; N[X1] = rr; N[Y1] = rb; piece(); }
    }
    strip = false;
  }
  // a form: its grid's blocks, each a flat piece between its corner points
  function form() {
    const side = BLOCKS + 1, rl = N[RL], rt = N[RT], w = N[RR] - rl, h = N[RB] - rt;
    for (let v = 0; v < side; v++) for (let u = 0; u < side; u++) {
      N[PX] = rl + w * u / BLOCKS; N[PY] = rt + h * v / BLOCKS;
      if (!placed(G, 4 * (v * side + u))) return;
    }
    for (let v = 0; v < BLOCKS; v++) {
      for (let u = 0; u < BLOCKS; u++) {
        const o = 4 * (v * side + u);
        for (let k = 0; k < 4; k++) { K[k] = G[o + k]; K[4 + k] = G[o + 4 + k]; K[8 + k] = G[o + 4 * side + k]; K[12 + k] = G[o + 4 * side + 4 + k]; }
        N[X0] = rl + w * u / BLOCKS; N[Y0] = rt + h * v / BLOCKS; N[X1] = rl + w * (u + 1) / BLOCKS; N[Y1] = rt + h * (v + 1) / BLOCKS;
        piece();
      }
    }
  }
  // (the flat piece now — its corners in K — looked at whole, as far as the wind may bend it: the levels the screen
  // needs of what is seen of it taken into the sheet's — WLO, WHI)
  function wholePiece() {
    const bend = N[BEND];
    N[EX0] = N[RL]; N[EY0] = N[RT]; N[EX1] = N[RR]; N[EY1] = N[RB];
    N[X0] = N[RL] - bend; N[Y0] = N[RT] - bend; N[X1] = N[RR] + bend; N[Y1] = N[RB] + bend;
    corners();
    looked();
    if (N[LO] < N[WLO]) N[WLO] = N[LO]; if (N[HI] > N[WHI]) N[WHI] = N[HI];
  }
  // the quad now looked at whole: the levels the screen needs of what is seen of it → WLO, WHI (none: not seen)
  function wholeLevels() {
    N[WLO] = Infinity; N[WHI] = -Infinity;
    if (curved) {
      // its points a GRID of them a side, each a kept one, taken into the levels where the view sees it
      const bend = N[BEND], x0 = N[RL] - bend, y0 = N[RT] - bend, x1 = N[RR] + bend, y1 = N[RB] + bend;
      N[LO] = Infinity; N[HI] = -Infinity;
      let off = 31;
      for (let v = 0; v <= GRID; v++) for (let u = 0; u <= GRID; u++) { N[PX] = x0 + (x1 - x0) * u / GRID; N[PY] = y0 + (y1 - y0) * v / GRID; point(); shown(Q9, 0); off &= sample(0); }
      N[WLO] = N[LO]; N[WHI] = N[HI];
      // (none of its points in view, and not all of them beyond one side of it: the view looks between them — its
      // sheet at the level it is read whole at)
      if (!(N[WLO] <= N[WHI])) { if (off) return; N[WLO] = N[WHI] = -Infinity; }
    } else if (kind === QUAD.SKY) backdrop(true);
    else if (rectPlaced()) wholePiece();
  }
  // a quad read elsewhere than where it stands: all of its sheet, at every level the screen needs (WLO, WHI: of what
  // is seen of it — or, of a further sheet of an own shader, of its base quad) — from the finest up: a pixel reads the
  // level it asks or the finest above it, never a finer one — and never finer than the level at which it has at most
  // host.wholePages pages
  function whole() {
    if (!(N[WLO] <= N[WHI])) return;
    N[LO] = N[WLO]; N[HI] = N[WHI];
    const fine = Math.max(levelOf(LO, -1), sheet.wholeL), coarse = Math.max(fine, levelOf(HI, 1));
    for (let L = fine; L <= coarse; L++) {
      const nx = pagesX(lay, L), ny = pagesY(lay, L);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) page(L, i, j);
    }
  }

  // sheet `handle` asked as quad row q's (how: what its pages are named as)
  function sheetAsked(q, handle, how) {
    if (handle < 0) return;
    sheet = sheetOf(handle);
    if (!sheet) return;
    const Q = world.quads, flags = Q.flags[q], layer = Q.layer[q];
    quad = q; kind = Q.kind[q]; lay = sheet.lay; top = sheet.levels - 1; as = how;
    if (timed) { const t = performance.now(); if (live) stats[cur] += t - read; read = t; live = true; }
    cur = slotAt + METRICS.length * (flags & FLAG.WHOLE ? 4 : kind === QUAD.FORM ? 3 : kind === QUAD.SKY ? 0 : kind === QUAD.DRAPE ? 1 : 2);
    stats[cur + 1]++;
    // (the sheet's corner and extent: the layout's, in doubles — the pages are laid from them)
    N[L0] = N[RL] = lay.l; N[T0] = N[RT] = lay.t; N[RR] = lay.r; N[RB] = lay.b;
    if (!(lay.l < lay.r && lay.t < lay.b)) return;
    taps = kind === QUAD.PLANE || kind === QUAD.DRAPE ? 2 : 1;
    curved = kind === QUAD.DRAPE || (kind === QUAD.SKY && world.sky.round);
    if (curved) {
      // (its points kept: by the stamp of its rows — or, where this view places its node elsewhere, for this ask alone)
      if (!points) { points = pointsOf(); pointsBy.set(world, points); }
      stamp = stampedAt(world, q);
      if (extra) for (let k = 0; k < extra.nodesN; k++) if (extra.nodeOf[k] === Q.node[q]) { stamp = -(++lone); break; }
    }
    // (the bound of the bend RENDER gives a layer in the wind — metres of the posed layer: so many of the sheet's
    // units where the pose scales it least; a layer scaled to nothing shows nothing; a form is not bent)
    N[BEND] = 0;
    if ((flags & FLAG.WIND) && layer >= 0 && kind !== QUAD.FORM) {
      const scale = Math.min(Math.abs(world.layers.pose[8 * layer + 3]), Math.abs(world.layers.pose[8 * layer + 4]));
      if (!(scale > 0)) return;
      N[BEND] = Math.abs(world.layers.opts[12 * layer + 2]) * (Math.max(0, world.look.wind[2]) + WIND.FAST) / scale;
    }
    // (read whole: at the levels of what is seen of it — a further sheet of an own shader at those lent it; the base
    // quad of such a shader is looked at whole too, whatever it is asked as, and lends what it is seen at)
    const wholly = (flags & FLAG.WHOLE) !== 0;
    if (wholly && lent) { N[WLO] = N[BLO]; N[WHI] = N[BHI]; }
    else if (wholly || lends) wholeLevels();
    if (lends) { if (N[WLO] < N[BLO]) N[BLO] = N[WLO]; if (N[WHI] > N[BHI]) N[BHI] = N[WHI]; }
    N[LO] = Infinity; N[HI] = -Infinity;
    if (wholly) whole();
    else if (kind === QUAD.FORM) form();
    else if (curved) node(top, 0, 0);
    else if (kind === QUAD.SKY) backdrop(false);
    else flat();
  }
  // quad row q of the world asked. One the view has a swap for (marked as asked: below zero): the swap's sheet — and,
  // in a view that is not a shot's, where the quad is shown (stands), the sheet it shows till the swap lands, placed
  // without the swap (a form's grid is the one it has now). One a shot's swap ends: nothing
  function one(q, how, stands) {
    const Q = world.quads, swap = swapOf[q];
    if (!swap) { sheetAsked(q, Q.sheet[q], how); return; }
    if (swap === ENDS) return;
    if (swap > 0) swapOf[q] = -swap;
    if (stands && !ahead) { extra = unswapped; sheetAsked(q, Q.sheet[q], how); extra = swapped; }
    sheetAsked(q, Math.abs(swap) - 1, how);
  }
  // … and, with it, the further sheets its own shader reads. The shader reads those at the points of its base
  // quad's pixels, wherever they lie in the world: one read whole is asked at the levels the screen needs of the base
  // quad (lent: BLO, BHI — of the quad as it stands, and as its swap has it), not of where its own rect would stand —
  // which may be nowhere in view (an atlas laid out beside the card); the base quad not seen, none of them is asked.
  // One that lies as the base does names the pages the base named (kept: laid … laidN, as page() names them)
  let lends = false, lent = false;
  function withOwn(q, how) {
    const slot = world.quads.own[q], rows = slot ? world.own[slot - 1]?.quads : null;
    if (!rows) { one(q, how, true); return; }
    N[BLO] = Infinity; N[BHI] = -Infinity;
    const same = plain(q);
    keeping = same; laidN = 0;
    lends = true; one(q, how, true); lends = false;
    keeping = false;
    if (!(N[BLO] <= N[BHI])) return;
    const counted = cur + 4;
    lent = true;
    for (let k = 1; k < rows.length; k++) {
      const r = rows[k];
      if (r < 0) continue;
      if (!same || !alike(r, q)) { one(r, how, true); continue; }
      const c = sheetOf(world.quads.sheet[r]);
      stats[counted] += laidN;
      for (let n = 0; n < laidN; n++) name(c, laid[3 * n], laid[3 * n + 1], laid[3 * n + 2], how);
    }
    lent = false;
  }
  // (whether an own shader's base quad q lies so that a further sheet may lie as it does: on no layer, read where it
  // stands, neither flipped nor bent by the wind, its sheet there, no swap waiting on it)
  function plain(q) {
    const Q = world.quads;
    return Q.layer[q] < 0 && !(Q.flags[q] & (FLAG.WHOLE | FLAG.FLIP | FLAG.WIND)) && Q.sheet[q] >= 0 && swapOf[q] === 0;
  }
  // (whether further sheet r lies as its base q does: read where it stands and not whole — its layer's pose is nothing
  // to it (world/place.js laid) —, neither flipped nor bent, no swap waiting on it, the base's kind and node, its sheet
  // laid out as the base's)
  function alike(r, q) {
    const Q = world.quads;
    if ((Q.flags[r] & (FLAG.READ | FLAG.WHOLE | FLAG.FLIP | FLAG.WIND)) !== FLAG.READ || swapOf[r] !== 0 || Q.kind[r] !== Q.kind[q] || Q.node[r] !== Q.node[q] || Q.sheet[r] < 0) return false;
    const a = sheetOf(Q.sheet[r]), b = sheetOf(Q.sheet[q]);
    if (!a || !b) return false;
    const la = a.lay, lb = b.lay;
    return la.l === lb.l && la.t === lb.t && la.r === lb.r && la.b === lb.b && la.W0 === lb.W0 && la.H0 === lb.H0;
  }
  // (whether quad row q is a further sheet of an own shader: asked with its base alone)
  function further(q) {
    const slot = world.quads.own[q], rows = slot ? world.own[slot - 1]?.quads : null;
    return rows !== null && rows !== undefined && rows[0] !== q;
  }

  // why the pages of quad row q are worked out again (0: nothing they are worked out from changed since the view's
  // last ask): 2 — the view moved in what a quad of its kind reads; 3 — its row, its node's or its layer's was
  // stamped, or the look, where the wind bends it (BEND)
  function stale(q) {
    const Q = world.quads;
    if (READS[Q.kind[q]] & moved) return 2;
    return since(stampedAt(world, q), T) || ((Q.flags[q] & FLAG.WIND) !== 0 && since(world.look.stamp, T)) ? 3 : 0;
  }
  // … an item's: its quad's, or those of a further sheet its own shader reads
  function due(q) {
    const why = stale(q), slot = world.quads.own[q], rows = !why && slot ? world.own[slot - 1]?.quads : null;
    if (rows && rows[0] === q) for (let k = 1; k < rows.length; k++) { const more = rows[k] >= 0 ? stale(rows[k]) : 0; if (more) return more; }
    return why;
  }
  // (an item named again: the swaps of its rows are asked ones — as its working out marks them)
  function reached(q) {
    if (swapOf[q] > 0 && swapOf[q] !== ENDS) swapOf[q] = -swapOf[q];
    const slot = world.quads.own[q], rows = slot ? world.own[slot - 1]?.quads : null;
    if (rows && rows[0] === q) for (let k = 1; k < rows.length; k++) { const r = rows[k]; if (r >= 0 && swapOf[r] > 0 && swapOf[r] !== ENDS) swapOf[r] = -swapOf[r]; }
  }
  // The item (q, how): → true — it is named again as at the view's last ask (nothing it is worked out from changed,
  // and the view asked it so then); false — it begins: it is to be worked out
  function again(q, how) {
    const why = moved & CHANGED.ALL ? 1 : due(q);
    stats[slotAt + ITEM]++;
    if (!why && kept(q, how)) { if (swaps) reached(q); return true; }
    stats[slotAt + ITEM + (why || 4)]++; ask.worked++;
    begin(q, how);
    return false;
  }

  // The pages `view` reads, named (SH10's View; its bias as it stands). changed: what of the view is another than at
  // its last ask (CHANGED's bits); tick: world.tick of that ask; own: what its own pages are named as — NAMED.OWN, or
  // NAMED.PROBE for a probe (no closed insert asked)
  function ask(view, changed, tick, own) {
    live = false; moved = changed; T = tick; swaps = view.overN > 0;
    const cam = view.camera, R = cam.rot, J = cam.proj, e = cam.eye;
    world = view.world; ortho = !!cam.ortho; ahead = !!view.ahead;
    // (the points kept are the view's world's)
    points = pointsBy.get(world) ?? null;
    N[YAW] = cam.yaw; N[VW] = view.width; N[VH] = view.height; N[BIAS] = (view.bias || 0) / 4;
    stage = view.stage;
    nodesOnly.nodes = view.nodes; nodesOnly.nodeOf = view.nodeOf; nodesOnly.nodesN = view.nodesN > 0 ? view.nodesN : 0;
    unswapped = nodesOnly.nodesN > 0 ? nodesOnly : null;
    extra = swapped = view.overN > 0 ? view : unswapped;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) A[3 * r + c] = J[r] * R[3 * c] + J[r + 4] * R[3 * c + 1] + J[r + 8] * R[3 * c + 2];
      B[r] = J[r + 12] - (A[3 * r] * e[0] + A[3 * r + 1] * e[1] + A[3 * r + 2] * e[2]);
    }
    N[GX] = 1 + 2 * GUARD / view.width; N[GY] = 1 + 2 * GUARD / view.height;
    const Q = world.quads, list = view.list, over = view.over, inserts = !!view.inserts;
    if (swapOf.length < Q.cap) { swapOf = new Int32Array(Q.cap); open = new Uint8Array(Q.cap); }
    // (a swap that ends its row — handle −1 — counts in a shot's view alone)
    for (let k = 0; k < view.overN; k++) { const h = over[3 * k + 1]; if (h >= 0) swapOf[over[3 * k]] = h + 1; else if (ahead) swapOf[over[3 * k]] = ENDS; }
    for (let n = 0; n < view.n; n++) {
      const q = list[n];
      if (Q.kind[q] === QUAD.INSERT) { if (!inserts) continue; open[q] = 1; }
      if (!further(q) && !again(q, LISTED)) withOwn(q, own);
    }
    if (inserts) {
      // (every other insert's quads, by the rows themselves — closed in this view: asked quietly, not by a probe; one
      // whose layer is not shown is not asked)
      if (own !== NAMED.PROBE) for (let q = 0; q < Q.n; q++) if (Q.kind[q] === QUAD.INSERT && (Q.flags[q] & FLAG.SHOWN) && !open[q] && !further(q) && !again(q, QUIET)) withOwn(q, NAMED.QUIET);
      for (let n = 0; n < view.n; n++) open[list[n]] = 0;
    }
    // (a swap whose quad the list did not have — the rows of a block its painting comes with, not drawn yet: its
    // sheet asked as any quad's, so its pages are there when it is put on; the quad itself shows nothing here)
    for (let k = 0; k < view.overN; k++) { const q = over[3 * k], swap = swapOf[q]; if (swap > 0 && swap !== ENDS && Q.kind[q] !== QUAD.INSERT && !again(q, ALONE)) one(q, own, false); }
    for (let k = 0; k < view.overN; k++) swapOf[over[3 * k]] = 0;
    world = null; extra = swapped = unswapped = null; nodesOnly.nodes = nodesOnly.nodeOf = null; sheet = null; lay = null;
    if (timed && live) stats[cur] += performance.now() - read;
  }
  // the items worked out so far, all the views' (RN8 `asked`: R counts a call's)
  ask.worked = 0;
  // a world's kept points made before it is asked (as it is built — never in a tick): a world with a curved quad
  ask.keep = w => {
    if (pointsBy.has(w)) return;
    const Q = w.quads;
    for (let q = 0; q < Q.n; q++) if (Q.kind[q] === QUAD.DRAPE || (Q.kind[q] === QUAD.SKY && w.sky.round)) { pointsBy.set(w, pointsOf()); return; }
  };
  // the stand's: its numbers; the slot now; the clock read (or not); the cache's bookkeeping of one view's names
  ask.stats = stats;
  ask.slot = k => { slotAt = k * SLOT_STRIDE; ask.slotNow = k; };
  ask.slotNow = 0;
  ask.measure = on => { timed = on; ask.timed = on; };
  ask.timed = false;
  ask.booked = (ms, names) => { stats[slotAt + BOOKED] += ms; stats[slotAt + BOOKED + 1] += names; };
  return ask;
}
