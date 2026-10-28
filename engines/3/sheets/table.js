// The sheets' page table — what a shader reads to find a page (the chunk `sheets`: one read, its place worked out by
// arithmetic), kept here on a GP2 table (a storage buffer and its mirror). Nothing of the cache is decided here:
// sheets/cache.js says which pages are there.
//   Rows of two words. The first rows are the handles': two rows a handle — (where its block begins — 0: none —, its
// width px at level 0), (its height, its meta: levels | the bits its pages at level 0 take across << 5, down << 10 |
// whether it wraps across << 15, down << 16). Then the sheets' blocks: an entry for every page of every level; a
// level wider than 2^WINDOW pages either way has a window — an entry for each page modulo the window, so a sheet may be
// of any size (kilometres at the finest level). An entry's first word says where its page is read (wordOf): the cell
// of the finest page there at or above it, and that page's level — worked out here as pages come and go (`resolved`),
// never looked for by a shader —; EMPTY and the level: nothing is painted there; SOLID, the level and a colour: that
// page is one opaque colour all over its cell (its border too), read as that colour; 0: nothing of it is there. Its second
// word says which page a window's entry is for (Block.tag; 0 elsewhere): given to the page asked for there, kept
// against whoever asks for another page of it later in the same cycle (the views are asked in the order of service: the
// frame's take theirs first — so at a cut the frame's view has its entries in the cycle of the cut); a page whose
// entry is another's is read from the finest level the block holds whole.
//   The buffer is written in runs: the rows changed are kept as stretches and sent each with one write (GP2's mark and
// flush, once a stretch) — a page come in a far block does not send the megabytes between.
import { SHEET } from '../base.js';
import { log2ceil, pagesX, pagesY } from './page.js';

const { PAGE, TOP, WINDOW, SLOTS_SIDE } = SHEET;
// (TAIL: how many levels of one page a sheet has at the most — from its top, no larger than TOP px, down to the first
// of two pages; MOST: the rows a storage buffer may bind by the core limits, 128 MiB)
export const TABLE = Object.freeze({ HANDLES: 65536, SOLID: 2 ** 24, EMPTY: 2 ** 23, THERE: 2 ** 22, TAIL: log2ceil(PAGE / TOP) + 1, STRIDE: 8, MOST: 2 ** 24 });
const { SOLID, EMPTY, THERE, TAIL } = TABLE, HANDLE_ROWS = 2 * TABLE.HANDLES, PER_LAYER = SLOTS_SIDE * SLOTS_SIDE;
// (stretches of changed rows nearer than this are sent as one)
const NEAR = 256;

// A page's key: its sheet and level (sheet | level << 16), its place (i, j — offset by 2^30, unsigned) — hashed
export function pageHash(x, y, z) {
  let h = Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca77);
  h ^= h >>> 15;
  h ^= Math.imul(z, 0xc2b2ae3d);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 16;
  return h >>> 0;
}
export const keyX = (id, L) => id | (L << 16), keyY = i => (i + (1 << 30)) >>> 0;

// A sheet's block of the table (sheets/cache.js: a sheet is one): from its layout (lay: page.js layOf). bx, by — how
// many bits its pages at level 0 take across and down; whole — the finest level every page of which has an entry of
// its own (the levels under it a window each); at — where the block begins, span — how long it is: the levels of one
// page first (TAIL at the most), then the others held whole, a level of 2^e entries from 2^e on, then the windows,
// each as large as the widest. The shader finds an entry by the same steps (sheetEntry), from bx, by and `at` alone.
export class Block {
  constructor(id, lay) {
    this.id = id; this.lay = lay; this.levels = lay.levels;
    this.bx = log2ceil(Math.ceil(lay.W0 / PAGE)); this.by = log2ceil(Math.ceil(lay.H0 / PAGE));
    this.whole = Math.max(Math.max(this.bx, this.by) - WINDOW, 0);
    this.windows = TAIL - 2 + (2 << (Math.max(this.bx - this.whole, 0) + Math.max(this.by - this.whole, 0)));
    this.window = WINDOW + Math.min(this.bx, this.by, WINDOW);
    this.at = 0; this.span = this.windows + this.whole * 2 ** this.window;
  }
  // (whether level L's entries are a window of it)
  windowed(L) { return L < this.whole; }
  // (how many bits a page's place in level L's block takes, across and down)
  bitsX(L) { return Math.min(Math.max(this.bx - L, 0), WINDOW); }
  bitsY(L) { return Math.min(Math.max(this.by - L, 0), WINDOW); }
  // where level L's block begins in the table
  level(L) {
    if (L < this.whole) return this.at + this.windows + L * 2 ** this.window;
    const e = this.bitsX(L) + this.bitsY(L);
    return this.at + (e === 0 ? L - Math.max(this.bx, this.by) : TAIL - 2 + (1 << e));
  }
  // page (L, i, j)'s entry of the table; what a window's entry is checked by — which of the pages that share it
  entry(L, i, j) { const b = this.bitsX(L); return this.level(L) + ((i & ((1 << b) - 1)) | (j & ((1 << this.bitsY(L)) - 1)) << b); }
  tag(L, i, j) { return (((i >> this.bitsX(L)) & 0xffff) | ((j >> this.bitsY(L)) & 0xffff) << 16) >>> 0; }
  // a handle's meta (the shader's)
  get meta() { return (this.levels | this.bx << 5 | this.by << 10 | (this.lay.wrap[0] ? 1 << 15 : 0) | (this.lay.wrap[1] ? 1 << 16 : 0)) >>> 0; }
}

// A page of one opaque colour as cellOf tells it (it has no cell): its colour's three bytes as the cache keeps them
// (sRGB-encoded; red the low byte) under −2
export const oneColour = rgb => -3 - rgb;
// An entry's word for a page of level L in cell `cell` (−2: nothing is painted in it; under −2: oneColour) — the chunk
// `sheets` takes it apart: the cell's unit in its slot (4 bits), its slot in its layer (3 across, 3 down), its layer
// (7), the level (5), THERE, EMPTY, SOLID; of a page of one colour, in place of its cell the colour's low 17 bits and
// above SOLID its 7 others
function wordOf(cell, L) {
  if (cell < -2) { const rgb = -3 - cell; return (SOLID | THERE | L << 17 | (rgb & 0x1ffff) | (rgb >>> 17) << 25) >>> 0; }
  if (cell < 0) return (EMPTY | THERE | L << 17) >>> 0;
  const slot = cell >> 4, inLayer = slot % PER_LAYER;
  return (THERE | L << 17 | Math.floor(slot / PER_LAYER) << 10 | Math.floor(inLayer / SLOTS_SIDE) << 7 | (inLayer % SLOTS_SIDE) << 4 | (cell & 15)) >>> 0;
}
const levelOf = word => (word >>> 17) & 31;

// gpu: GP2's maker of tables; cellOf(block, L, i, j) → the cell that page's pixels are in, −2: nothing is painted in
// it, under −2: it is one colour (oneColour), −1: it is not there (the cache's answer).
export function createTable(gpu, cellOf) {
  const T = gpu.table('sheetTable', { stride: TABLE.STRIDE, capacity: 2 * HANDLE_ROWS });
  // (stamp: the cycle a window's entry's page was last asked in; 0: never)
  let stamp = new Uint32Array(T.capacity);
  // the rows changed since they were last sent: stretches (first, one past the last), as they came; `all` — the
  // table was made anew (GP2 marked all of it)
  let dirty = new Float64Array(512), nDirty = 0, all = true;
  const touch = (from, to) => {
    if (all) return;
    // (the stretch before, if this one joins it: a level's rows come one after another)
    if (nDirty && from <= dirty[nDirty - 1] + NEAR && to >= dirty[nDirty - 2]) { if (from < dirty[nDirty - 2]) dirty[nDirty - 2] = from; if (to > dirty[nDirty - 1]) dirty[nDirty - 1] = to; return; }
    if (nDirty === dirty.length) { const wider = new Float64Array(dirty.length * 2); wider.set(dirty); dirty = wider; }
    dirty[nDirty++] = from; dirty[nDirty++] = to;
  };
  // what changed since it was last sent, sent — a write a stretch, those near each other as one
  const order = [];
  function flush() {
    if (all) { T.mark(0, T.capacity); T.flush(); all = false; nDirty = 0; return; }
    if (!nDirty) return;
    order.length = 0;
    for (let k = 0; k < nDirty; k += 2) order.push(k);
    order.sort((a, b) => dirty[a] - dirty[b]);
    let from = dirty[order[0]], to = dirty[order[0] + 1];
    for (let n = 1; n < order.length; n++) {
      const a = dirty[order[n]], b = dirty[order[n] + 1];
      if (a <= to + NEAR) { if (b > to) to = b; continue; }
      T.mark(from, to - from); T.flush();
      from = a; to = b;
    }
    T.mark(from, to - from); T.flush();
    nDirty = 0;
  }

  // ── the blocks ───────────────────────────────────────────────────────────
  // those free: runs of rows (where, how many), in their order
  const freeAt = [HANDLE_ROWS], freeLen = [T.capacity - HANDLE_ROWS];
  function free(at, span) {
    let k = 0;
    while (k < freeAt.length && freeAt[k] < at) k++;
    if (k > 0 && freeAt[k - 1] + freeLen[k - 1] === at) freeLen[--k] += span; else { freeAt.splice(k, 0, at); freeLen.splice(k, 0, span); }
    if (k + 1 < freeAt.length && freeAt[k] + freeLen[k] === freeAt[k + 1]) { freeLen[k] += freeLen[k + 1]; freeAt.splice(k + 1, 1); freeLen.splice(k + 1, 1); }
  }
  // sheet c given its block, nothing in it (c.at: where it begins) → false: no room, the table as long as it may be
  function block(c) {
    for (;;) {
      for (let k = 0; k < freeAt.length; k++) {
        if (freeLen[k] < c.span) continue;
        const at = freeAt[k], end = at + c.span;
        if (freeLen[k] === c.span) { freeAt.splice(k, 1); freeLen.splice(k, 1); } else { freeAt[k] = end; freeLen[k] -= c.span; }
        // (what the GPU has there is another sheet's)
        T.u32.fill(0, at * 2, end * 2); stamp.fill(0, at, end);
        touch(at, end);
        c.at = at;
        return true;
      }
      if (T.capacity >= TABLE.MOST) return false;
      const was = T.capacity, wider = Math.min(TABLE.MOST, Math.max(was * 2, was + c.span));
      T.grow(wider);
      const s = new Uint32Array(wider); s.set(stamp); stamp = s;
      all = true; nDirty = 0;
      free(was, wider - was);
    }
  }
  // a handle's sheet in the table (c: its block; null: none)
  function handle(h, c) {
    const u = T.u32, o = 4 * h;
    u[o] = c ? c.at : 0; u[o + 1] = c ? c.lay.W0 : 0; u[o + 2] = c ? c.lay.H0 : 0; u[o + 3] = c ? c.meta : 0;
    touch(2 * h, 2 * h + 2);
  }

  // ── what the entries say ─────────────────────────────────────────────────
  // what page (L, i, j) of sheet c is read from: its own word, or the finest of its own above it there (0: none)
  function reads(c, L, i, j) {
    for (; L < c.levels; L++, i >>= 1, j >>= 1) { const cell = cellOf(c, L, i, j); if (cell !== -1) return wordOf(cell, L); }
    return 0;
  }
  // Page (L, i, j) of sheet c has come (word: its own) or gone (word: what is above it — reads): its entry and those of
  // the pages under it that read it, or from above it, say so. Level by level down: the pages under it there — or the
  // whole of the level's block, where they are as many; an entry of a window only if it is for one of them now
  function resolved(c, L, i, j, word) {
    const u = T.u32;
    for (let l = L, d = 0; l >= 0; l--, d++) {
      const bx = c.bitsX(l), by = c.bitsY(l), base = c.level(l), win = c.windowed(l);
      const nx = d >= bx ? 1 << bx : 2 ** d, ny = d >= by ? 1 << by : 2 ** d, x0 = d >= bx ? 0 : i * 2 ** d, y0 = d >= by ? 0 : j * 2 ** d;
      const mx = (1 << bx) - 1, my = (1 << by) - 1, px = pagesX(c.lay, l), py = pagesY(c.lay, l);
      for (let v = 0; v < ny; v++) {
        const y = (y0 + v) & my;
        // (a level held whole: no further than its pages go)
        if (!win && y >= py) break;
        let lo = -1, hi = -1;
        for (let n = 0; n < nx; n++) {
          const x = (x0 + n) & mx, e = base + (x | y << bx), cur = u[e * 2];
          if (!win && x >= px) break;
          if (cur === word || (cur !== 0 && levelOf(cur) < L)) continue;
          if (win) {
            // (the page it is for: its place in the block, and above it what it is checked by)
            if (cur === 0) continue;
            const t = u[e * 2 + 1], oi = (t & 0xffff) * 2 ** bx + x, oj = (t >>> 16) * 2 ** by + y;
            if (Math.floor(oi / 2 ** d) !== i || Math.floor(oj / 2 ** d) !== j) continue;
          }
          u[e * 2] = word;
          if (lo < 0 || e < lo) lo = e; if (e > hi) hi = e;
        }
        if (lo >= 0) touch(lo, hi + 1);
      }
    }
  }
  // A window's entry for page (L, i, j): its own already (asked: in this cycle — kept); else given to it, unless the
  // page it is for was asked for earlier in this cycle (a view served before reads it), or nothing of this one is
  // there (an entry of nothing is no page's: read from the level held whole, which has nothing either)
  let cycle = 1;
  function own(c, L, i, j, asked) {
    const u = T.u32, e = c.entry(L, i, j), tag = c.tag(L, i, j);
    if (u[e * 2] !== 0 && u[e * 2 + 1] === tag) { if (asked) stamp[e] = cycle; return; }
    if (u[e * 2] !== 0 && stamp[e] === cycle) return;
    const word = reads(c, L, i, j);
    if (word === 0) return;
    u[e * 2] = word; u[e * 2 + 1] = tag; stamp[e] = asked ? cycle : 0;
    touch(e, e + 1);
  }

  return {
    table: T, block, handle, flush,
    // sheet c's block free again
    unblock(c) { free(c.at, c.span); c.at = 0; },
    // page (L, i, j) of sheet c there from now — in cell `cell`, or found empty (−2), or of one colour (oneColour)
    put(c, L, i, j, cell) {
      if (c.windowed(L)) own(c, L, i, j, false);
      resolved(c, L, i, j, wordOf(cell, L));
    },
    // … there no more (the cache says so already)
    take(c, L, i, j) { resolved(c, L, i, j, reads(c, L, i, j)); },
    // a cycle begun: its number, 1 the first (a window's entry asked for in it is kept till it ends)
    cycle(no) { cycle = no; },
    // a page of a window asked for: its entry its own
    asked(c, L, i, j) { own(c, L, i, j, true); },
  };
}
