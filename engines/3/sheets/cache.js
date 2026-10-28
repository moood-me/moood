// The sheets (SH0–SH14): every painting of the worlds the thread shows — a display list each (sheets/recorder.js) — as
// pages in one cache texture, found by the shaders through one page table (sheets/table.js), painted by the painters
// (sheets/painters.js) only where and as finely as the views need them (sheets/ask.js).
//   A sheet is a recording laid over its rect (sheets/page.js: its levels, its pages); its handle is its number — in
// the quads' rows and the table's first rows. Sheets whose lists are the same, laid the same, are one sheet: add()
// gives the handle there is and counts who holds it. A recording never changes: a painting made anew is another sheet.
// A recording given to add() is the sheets' to end (SH1): the images it carries are closed when the sheet's last
// holder releases it, and each painter closes its copies when it is told to drop the sheet.
//   The cache: a 2D array texture, never grown — host.cache layers of SLOTS_SIDE² slots, each slot a 4 × 4 grid of
// units; a page as large as a page takes a slot, a smaller one (a level's edge, a top) a cell of 1 or 2 units either
// way, slots holding cells of one shape. The array has two levels: each page lies with its own half level beside it.
// A page's cell is taken when the page is asked of a painter — never when it arrives: where things lie in the cache
// follows from what was asked, in the order it was asked, so a render's frame is the same on every run.
//   A sheet's top — its coarsest level, one small page — is asked the moment the sheet is added and stays as long as the
// sheet does: what is not there is read from the finest of its own above it, so no sheet is ever missing. A page nothing
// is painted in (no draw of the recording reaches its cell: Recording.touches) is never painted and takes no cell: the
// table says so (an empty page), and so does a page a painter found empty. Nor is a page of one opaque colour all over
// its cell (Recording.uniform, page.js pageSolid: a rect filled over it and nothing drawn after, or a ground with
// nothing over it): the table gives that colour — as a blank page it waits for nothing and counts nothing. A page found blank when an ask first names
// it is told to the table, and to its sheet's `solid`, in the next place — the cycle's first step, before the cull —,
// so no list made this frame is wrong about it (SH13): till then a pixel there reads the page above it.
//   A cycle (one R.frame, or one of the thread's own rounds while a scene is built): place — the pages that arrived go
// into the cache; then rounds of { ask each view, in the order of service; weigh }; then request — what is named and
// not there goes to the painters. A page is named for the round it was asked in; the last round of a cycle is what
// the cycle named (SH3).
//   Coarse to fine (SH10). Every page a view names as its own is named after its parent — the page a level coarser
// under it (none where that is the sheet's top, which stays) —, as its own too: so the coarser level is in the cache
// before and while the finer comes, cells are taken for it first and it is asked of the painters first, and a page
// missing is read from its parent, a level soft. The parents of the pages named, not theirs in turn. Not in a whole
// call: a held frame shows nothing until all of it is there, so a parent would serve nothing there — it waits only
// for the pages it shows.
//   Room (5.19). weigh() serves the views in the order they were asked, and counts before it takes. N: the units a
// view's own pages take — the pages it was the first to name this round as its own, parents in, tops apart (a top has
// its cell); a page a painter found empty counts as the cell it was painted in, so the count is the same before a page
// arrives and after; only a page no draw of its recording reaches counts nothing. C: what the views served before it
// left of the cache — its units less the tops' and theirs. N over C: the view's pressure — quarter levels, the View's
// `bias` with its own `coarser` — rises by ⌈4 · log4(N / C)⌉, a level at the most a weigh and never more than a level
// above the bias it is drawn at, and no cell is taken: nothing is let go for a bias that is not the one asked next.
// N within C: its pages that have no cell are given cells — free ones, then those of pages no view named this round
// (the least lately named first), then the closed inserts' of this round, then those of views
// served after it; where the count fits and the cells' shapes do not, the cells just taken are given back and the
// pressure rises by what it got in place of C. It falls back a quarter level — only from the bias it is drawn at —
// where its PROBE (the view asked a quarter level finer: its names a kind of their own, NAMED.PROBE, counted and
// nothing else — no round, no cell, no request; they keep their records) counts, as N would be counted there, at
// most BIAS.FALL of C, and its pages at most BIAS.FALL of the whole slots left for it (empty, or holding no top and
// no page of a view served before it: a count that fits can still fail on the cells' shapes). What a view names does
// not grow as its bias coarsens, so a fall to names within FALL · C is not risen from, nor a rise from names over C
// fallen back past: the band between is the hysteresis. A probe works its items out at most one a tick, and each
// once every host.ahead / 2 (s, host.ts) — never on the tick `toward`'s camera moved, nor where its view's own ask
// worked out no item: then it names again what it named —; in a call with every painter at work (a whole call)
// every round; it is asked only where a fall is otherwise due. weigh() keeps the new pressure to itself: the
// View's `bias` is written only where the view is asked (ask), so no frame is drawn at a bias nothing was asked at
// (SH12); a view that begins (the View's `fresh`: R's) starts at no pressure. The bias a view is DRAWN at (`drawn`) is
// its bias from the ask in which every page it names is placed, its bias at once in a whole call: a switch is drawn
// only once its pages are there (a rise names the parents kept, a fall the pages its shown ones are the parents of).
// In a whole call (its place was given Infinity; R repeats the rounds until weigh() returns false) a round ends at the
// first view whose pressure moves — those served after it are weighed when it stands — and cells are taken only at a
// bias that stands. Convergence: the first view's C is what the tops leave, whatever the other views do: every rise
// ends over the bias whose names fit (or at the bias's end), every fall at a bias whose names fit, and the band keeps
// a fall from bringing a rise back; then the next view's; and weigh() returns false. Nothing in it reads when a page
// arrived. At the bias's end — or a level above the bias drawn, where it may rise no further yet — a view over the
// room has what fits; its other pages are not waited for (they are read from the coarser levels there are) — by that
// view, nor by a view served after it that names one of them too: a page is the view's that named it first in the
// round, and has no cell while that view is denied it — weigh() says so (true) the round it first denies a page, so
// the asks made again do not count it. In a call that is not whole the views are weighed once and request sends
// what the asks named and got cells for, whatever weigh() then decided: the new bias serves the next tick.
//   Preparation (5.19's order of service): the closed inserts' pages (NAMED.QUIET) are in no view's count and given
// cells after every view's own, only free ones or those of pages nobody names this round — and a cell holding one is
// let go before any view's own.
//   No scan of the cache for a page (SH13). What a page costs does not grow with the cache: the free cell of a shape
// and the cell or slot to let go are the tops of heaps kept — each shape's free cells; its taken cells, and its slots,
// by how lately their pages were wanted, moved as a round names a page, as a cell is taken and as it is let go —,
// and the whole slots left for a view are counted from them. The choice is the very one a look through every slot
// in their order made: of what is alike, the first by its slot.
//   The painters' rate is their own, not the tick's (SH12): request() orders the pages to ask and keeps the list;
// a painter that answers is given the next page of it at once, in the task that hears the answer. Nothing is made for
// a page or a cycle but the message a painter is sent (it crosses a thread). While a film plays pages are placed by
// count (host.pages a tick), so the painters are not fed past that: with PILE ticks' worth of pages arrived and not
// placed a painter that answers is given nothing — the next request feeds it — and what waits to be placed stays a
// few megabytes. A whole call places all there is: there the painters are never held.
import { SHEET, BIAS, FLAG, INSERTS, empty } from '../base.js';
import { layOf, pageShape, pageBlank, pageSolid, topSize, cellInside, pagesX, pagesY, shapeW, shapeH, shapeUnits, POS, MASK, FULL, SHAPES, KIND } from './page.js';
import { Block, createTable, pageHash, keyX, keyY, oneColour, TABLE } from './table.js';
import { createAsk, NAMED, CHANGED, ASKED } from './ask.js';
import { createUpload } from './upload.js';

const { UNIT, SLOT, SLOTS_SIDE, LAYER } = SHEET, PER_LAYER = SLOTS_SIDE * SLOTS_SIDE;
// a page's state (bits): its pixels are in its cell; nothing is painted in it; it is asked of a painter and what came
// of that is not placed yet (till then its record is not let go: SH11); it stays (a top); nothing is painted in it by
// its painter's answer (not by its recording: it was painted, in a cell, and counts as that cell); it is blank and the
// table is not told yet (the next place tells it); it was let go for room while a view named it (placed again, it is
// the cache's thrash: SH13 `again`); it is of one colour (with BLANK: never painted, its colour in the table)
const PAINTED = 1, BLANK = 2, FLYING = 4, PIN = 8, FOUND = 16, DUE = 32, LOST = 64, SOLID = 128;
// (jobs in flight a painter; tops to a job; the ticks' worth of pages that may have arrived and wait to be placed
// while a film plays; whom a cell is taken for besides a view: a top — before every view —, a closed insert's page —
// after them all)
const IN_FLIGHT = 2, TOPS = 16, PILE = 4, FOR_TOP = -1, FOR_QUIET = 1 << 29;
const UNITS = Float64Array.from({ length: SHAPES }, (_, s) => shapeUnits(s));
// whose a view is (SH13 `cycle`): the frame's own — the frame's (asked first), its mirrors' and its shadow views' (they
// ask no inserts) —; `toward`'s (no shot's, and it asks inserts: asked like a shot's view, after the frame's own); a
// shot's (`ahead`). k: its place in the order of service
const OWNED = 0, TOWARD = 1, SHOT = 2;
const whose = (view, k) => (view.ahead ? SHOT : k > 0 && view.inserts ? TOWARD : OWNED);

// A heap of numbers (cells, slots) by their keys — the least at its top, list[0] —, with where each is in it kept (at:
// −1 in none): one is put in, taken out, or moved as its key changes, without being looked for. keys, at: arrays by
// the numbers themselves (several heaps may share them: a number is in one of those at a time)
function heapOf(keys, at, room) { return { list: new Int32Array(Math.max(1, room)), n: 0, keys, at }; }
function heapUp(h, i) {
  const { list, keys, at } = h, id = list[i], key = keys[id];
  while (i > 0) {
    const p = (i - 1) >> 1, q = list[p];
    if (keys[q] <= key) break;
    list[i] = q; at[q] = i; i = p;
  }
  list[i] = id; at[id] = i;
}
function heapDown(h, i) {
  const { list, keys, at } = h, n = h.n, id = list[i], key = keys[id];
  for (;;) {
    let c = 2 * i + 1;
    if (c >= n) break;
    if (c + 1 < n && keys[list[c + 1]] < keys[list[c]]) c++;
    if (keys[list[c]] >= key) break;
    list[i] = list[c]; at[list[i]] = i; i = c;
  }
  list[i] = id; at[id] = i;
}
function heapPush(h, id) {
  if (h.n === h.list.length) { const grown = new Int32Array(h.n * 2); grown.set(h.list); h.list = grown; }
  h.list[h.n] = id;
  heapUp(h, h.n++);
}
function heapOut(h, id) {
  const i = h.at[id], last = h.list[--h.n];
  h.at[id] = -1;
  if (i < h.n) { h.list[i] = last; heapUp(h, i); heapDown(h, h.at[last]); }
}
function heapMoved(h, id) { heapUp(h, h.at[id]); heapDown(h, h.at[id]); }

// A sheet: its block of the table (table.js Block), its recording, how many hold it, its pages' records, its top's,
// what its paint is so far (SH13), its top's mask (SH4), the pages the round now and the cycle that ended last named
class Sheet extends Block {
  constructor(id, key, rec, lay, wholePages) {
    super(id, lay);
    this.key = key; this.rec = rec; this.refs = 1; this.recs = []; this.top = -1; this.dead = false;
    this.stamp = 0; this.hole = false; this.opaque = false; this.mask = null; this.mw = 0; this.mh = 0;
    this.cur = []; this.curRound = -1; this.last = []; this.lastCycle = -1;
    // the finest level at which it has at most host.wholePages pages (a sheet read whole is asked no finer)
    this.wholeL = 0;
    while (pagesX(lay, this.wholeL) * pagesY(lay, this.wholeL) > wholePages) this.wholeL++;
  }
}

export function createSheets(gpu, host) {
  const layers = host.cache, nSlots = layers * PER_LAYER;
  // (the tier's row, 4.9: an entry of the table names a layer in seven bits)
  if (!(layers >= 1 && layers <= 128)) throw new Error(`sheets: host.cache is ${layers} layers`);
  if (!(host.painters >= 1 && host.busy >= 1 && host.wholePages >= 1)) throw new Error(`sheets: host.painters, host.busy, host.wholePages are ${host.painters}, ${host.busy}, ${host.wholePages}`);
  const texture = gpu.texture('sheetCache', { size: [LAYER, LAYER, layers], format: 'rgba8unorm-srgb', mipLevelCount: 2, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT });
  // (the painted pages written into it on the GPU: their conversion and their half levels)
  const upload = createUpload(gpu, texture);
  const textureView = texture.createView({ dimension: '2d-array' });
  const counts = { placed: 0, sent: 0, evicted: 0, blank: 0, solid: 0, stale: 0, denied: 0, failed: 0, jobs: 0, again: 0 };
  // SH13 `cycle`: ONE object, rewritten by request — of the cycle that just ended: the pages sent, let go and denied
  // in it; the greatest pressure among the views asked; the greatest the frame's own views are drawn at (`drawn` less
  // `coarser`); the own pages placed again that were let go for room while named; the pages the frame's own views and
  // toward's named that no view named in the cycle before and that the painters must still paint (not there, not
  // known empty, not in flight: what the camera asks of the painters — going back over pages still in the cache adds
  // nothing); the units the frame's own views named of their own pages,
  // those of them that are there, those the largest closed insert named quietly, and the room they had (the cache's
  // units less the tops')
  const cycleOf = { sent: 0, evicted: 0, denied: 0, bias: 0, own: 0, again: 0, wanted: 0, named: 0, has: 0, insert: 0, room: 0 };
  let sentWas = 0, evictedWas = 0, deniedWas = 0, againWas = 0, namedNow = 0, hasNow = 0, roomNow = 0;
  // (the units each closed insert's quads named quietly, by its row)
  const quietly = new Float64Array(INSERTS.MOST);

  // ── the pages' records: every page that is named, asked, there, or known empty ──
  let cap = 4096, nRecs = 0;
  let rSheet = new Int32Array(cap).fill(-1), rL = new Uint8Array(cap), rI = new Int32Array(cap), rJ = new Int32Array(cap), rCell = new Int32Array(cap).fill(-1);
  let rState = new Uint8Array(cap), rShape = new Uint8Array(cap), rWant = new Int32Array(cap), rBy = new Int32Array(cap), rColour = new Int32Array(cap);
  let rWeight = new Float32Array(cap), rDeny = new Int32Array(cap), rSeen = new Int32Array(cap), rAt = new Int32Array(cap), rIn = new Int32Array(cap);
  // (rGen: one more each time a record's number is let go — the list of pages to ask knows its pages by it; rRank:
  // a page's place in that list as request orders it; rSince: the cycle in which the views began to name it — it was
  // named in every cycle since: a page that ENTERS what is asked has this cycle's; rQuiet, rProbe: the round a closed
  // insert, a probe last named it; rWanted: the cycle it was counted in `wanted`)
  let rGen = new Int32Array(cap), rRank = new Float64Array(cap), rSince = new Int32Array(cap), rQuiet = new Int32Array(cap), rProbe = new Int32Array(cap), rWanted = new Int32Array(cap);
  const recFree = [];
  const grown = (a, n, fill) => { const b = new a.constructor(n); if (fill !== undefined) b.fill(fill); b.set(a); return b; };
  function growRecs() {
    cap *= 2;
    rSheet = grown(rSheet, cap, -1); rL = grown(rL, cap); rI = grown(rI, cap); rJ = grown(rJ, cap); rCell = grown(rCell, cap, -1);
    rState = grown(rState, cap); rShape = grown(rShape, cap); rWant = grown(rWant, cap); rBy = grown(rBy, cap); rColour = grown(rColour, cap);
    rWeight = grown(rWeight, cap); rDeny = grown(rDeny, cap); rSeen = grown(rSeen, cap); rAt = grown(rAt, cap); rIn = grown(rIn, cap);
    rGen = grown(rGen, cap); rRank = grown(rRank, cap); rSince = grown(rSince, cap); rQuiet = grown(rQuiet, cap); rProbe = grown(rProbe, cap); rWanted = grown(rWanted, cap);
  }
  // their keys → their records: a hash table of four words an entry — (sheet | level << 16) + 1 (0: not taken),
  // i + 2^30, j + 2^30, the record — open addressing, linear probing; an entry let go by moving back those after it
  // that belong before it (no tombstones: every probe ends at the first empty entry)
  let HASH = 1 << 14, hash = new Uint32Array(HASH * 4);
  function find(x, y, z) {
    for (let e = pageHash(x, y, z) & (HASH - 1); ; e = (e + 1) & (HASH - 1)) {
      const o = e * 4;
      if (hash[o] === 0) return -1;
      if (hash[o] === x + 1 && hash[o + 1] === y && hash[o + 2] === z) return e;
    }
  }
  function enter(x, y, z, rec) {
    let e = pageHash(x, y, z) & (HASH - 1);
    while (hash[e * 4] !== 0) e = (e + 1) & (HASH - 1);
    const o = e * 4;
    hash[o] = x + 1; hash[o + 1] = y; hash[o + 2] = z; hash[o + 3] = rec;
  }
  function leave(e) {
    let hole = e;
    for (let n = 1; n < HASH; n++) {
      const f = (e + n) & (HASH - 1), o = f * 4;
      if (hash[o] === 0) break;
      const home = pageHash(hash[o] - 1, hash[o + 1], hash[o + 2]) & (HASH - 1);
      // (it may move into the hole if the hole lies on its way from its home to where it is)
      if (((f - home) & (HASH - 1)) >= ((f - hole) & (HASH - 1))) {
        const h = hole * 4;
        hash[h] = hash[o]; hash[h + 1] = hash[o + 1]; hash[h + 2] = hash[o + 2]; hash[h + 3] = hash[o + 3];
        hole = f;
      }
    }
    const h = hole * 4;
    hash[h] = hash[h + 1] = hash[h + 2] = hash[h + 3] = 0;
  }
  function growHash() {
    const was = hash;
    HASH *= 2; hash = new Uint32Array(HASH * 4);
    for (let o = 0; o < was.length; o += 4) if (was[o] !== 0) enter(was[o] - 1, was[o + 1], was[o + 2], was[o + 3]);
  }
  const recordAt = (c, L, i, j) => { const e = find(keyX(c.id, L), keyY(i), keyY(j)); return e < 0 ? -1 : hash[e * 4 + 3]; };
  // (a page's parent: the page a level coarser under it — its record, or −1: none known, or it is its sheet's top,
  // which stays — or the page is the top)
  const parentOf = rec => { const c = sheets[rSheet[rec]], L = rL[rec] + 1; return L >= c.levels - 1 ? -1 : recordAt(c, L, rI[rec] >> 1, rJ[rec] >> 1); };

  // ── the table ──
  const T = createTable(gpu, (c, L, i, j) => {
    const rec = recordAt(c, L, i, j);
    if (rec < 0) return -1;
    const st = rState[rec];
    return (st & (BLANK | DUE)) === BLANK ? (st & SOLID ? oneColour(rColour[rec]) : -2) : st & PAINTED ? rCell[rec] : -1;
  });

  // ── the cache: slots and cells ──
  // per slot: its units taken (bits), the shape of its cells (−1: none); per cell (slot × 16 + its first unit): the
  // record of the page it is for (−1: free)
  const occ = new Int32Array(nSlots), slotShape = new Int8Array(nSlots).fill(-1), cellRec = new Int32Array(nSlots * 16).fill(-1);
  const emptySlots = [];
  for (let s = nSlots - 1; s >= 0; s--) emptySlots.push(s);
  // the round and the cycle now; the last weigh's number; whether a round is being asked; the units the tops hold
  let round = 1, cycle = 1, weighNo = 0, asking = false, pinned = 0;

  // ── the order kept: what is taken and what is let go, found without looking through the cache (SH13) ──
  // The rule is the one a look through every slot, in their order, gave, kept as heaps (heapOf):
  //   a free cell of a shape — the first, by its slot and its place in it, of the slots of that shape (free[s]);
  //   a cell let go — of the cells of its shape, the one whose page was wanted least lately; a whole slot of another
  // shape, by the page in it that was wanted most lately; of the two the lesser; of any alike, the first by its slot
  // (and its place in it).
  // How lately a page was wanted: one nobody names this round — the round it was last named in; a closed insert's
  // page of this round after all of those; then the pages the views of this round named first, the last-served view's
  // first — the views from the 64th on alike. So, each shape: its taken cells that do not stay in one heap by (the
  // round last named, the cell) — old[s]: its top is the page of an older round to go first, and where its top is of
  // this round there is none —, and this round's in a heap a class, by the cell — a class: 0 the closed inserts', 1 +
  // k view k's (classes[s][class]; a cell's: cls, in the round clsRound). The slots the same way, by the page in each
  // that was wanted most lately (slotOld[sh], slotClasses[sh][class]: a slot's class is that of that page — the
  // first-served of the views that named a page of it, else the inserts'); a slot holding a top is in none.
  // A cell is moved in them when a round names its page, when it is taken and when it is let go — never looked for.
  const CELLS = nSlots * 16;
  const ids = new Float64Array(CELLS), oldKey = new Float64Array(CELLS), slotKey = new Float64Array(nSlots);
  for (let i = 0; i < CELLS; i++) ids[i] = i;
  // (where each is in its heaps: a cell in free[s] or old[s] — never both —, and in its class's; a slot likewise)
  const cellAt = new Int32Array(CELLS).fill(-1), clsAt = new Int32Array(CELLS).fill(-1), cls = new Int32Array(CELLS), clsRound = new Int32Array(CELLS);
  const slotAt = new Int32Array(nSlots).fill(-1), slotClsAt = new Int32Array(nSlots).fill(-1), slotCls = new Int32Array(nSlots), slotClsRound = new Int32Array(nSlots), slotPins = new Uint8Array(nSlots);
  const free = [], old = [], classes = [], slotOld = [], slotClasses = [];
  for (let s = 0; s < SHAPES; s++) {
    free.push(heapOf(ids, cellAt, nSlots * POS[s].length)); old.push(heapOf(oldKey, cellAt, nSlots * POS[s].length)); classes.push([]);
    slotOld.push(heapOf(slotKey, slotAt, nSlots)); slotClasses.push([]);
  }
  // (the slots holding a top: slotsLeft)
  let pinSlots = 0;
  const lastNamed = rec => Math.max(rWant[rec], rQuiet[rec]);
  // (the class of a page named this round: view k's — the view that named it first —, or the closed inserts'; −1: of
  // none)
  const classOf = rec => (rWant[rec] === round ? 1 + rBy[rec] : rQuiet[rec] === round ? 0 : -1);
  // (whether class a is wanted more lately than class b — b −1: of none)
  const before = (a, b) => b < 0 || (a >= 1 && (b < 1 || a < b));
  const classHeap = (list, c, at) => (list[c] ||= heapOf(ids, at, 64));
  // a taken cell that does not stay, into its shape's order; out of it; and moved in it as this round names its page
  function cellIn(cell, rec) {
    const s = rShape[rec], c = classOf(rec);
    if (s === FULL) return;
    oldKey[cell] = lastNamed(rec) * CELLS + cell;
    heapPush(old[s], cell);
    if (c >= 0) { cls[cell] = c; clsRound[cell] = round; heapPush(classHeap(classes[s], c, clsAt), cell); }
  }
  function cellOut(cell, rec) {
    const s = rShape[rec];
    if (s === FULL) return;
    heapOut(old[s], cell);
    if (clsRound[cell] === round) { heapOut(classes[s][cls[cell]], cell); clsRound[cell] = 0; }
  }
  // A slot (of shape sh) looked at anew — a cell of it taken or let go: the page in it wanted most lately among those
  // it has (its sixteen units at the most), its place in its shape's heaps — in none while it holds a top or nothing
  function slotNow(slot, sh) {
    const pos = POS[sh], base = slot * 16, was = slotClsRound[slot] === round ? slotCls[slot] : -1;
    let last = -1, c = -1;
    if (!slotPins[slot]) for (let n = 0; n < pos.length; n++) {
      const rec = cellRec[base + pos[n]];
      if (rec < 0) continue;
      const named = lastNamed(rec), k = classOf(rec);
      if (named > last) last = named;
      // (of this round's: a view's page before a closed insert's, the first-served view's first)
      if (k >= 0 && before(k, c)) c = k;
    }
    if (last < 0) { if (slotAt[slot] >= 0) heapOut(slotOld[sh], slot); c = -1; }
    else {
      const key = last * nSlots + slot;
      if (slotAt[slot] < 0) { slotKey[slot] = key; heapPush(slotOld[sh], slot); } else if (slotKey[slot] !== key) { slotKey[slot] = key; heapMoved(slotOld[sh], slot); }
    }
    if (c === was) return;
    if (was >= 0) heapOut(slotClasses[sh][was], slot);
    slotClsRound[slot] = c >= 0 ? round : 0;
    if (c >= 0) { slotCls[slot] = c; heapPush(classHeap(slotClasses[sh], c, slotClsAt), slot); }
  }
  // a page that has a cell was named by this round (its record says so already): its cell, and its slot, to where
  // that has them — a slot only ever to a class before the one it had
  function renamed(rec) {
    const cell = rCell[rec];
    if (cell < 0 || (rState[rec] & PIN)) return;
    const s = rShape[rec], slot = cell >> 4, c = classOf(rec);
    if (s !== FULL) {
      oldKey[cell] = round * CELLS + cell;
      heapMoved(old[s], cell);
      if (clsRound[cell] === round) heapOut(classes[s][cls[cell]], cell);
      cls[cell] = c; clsRound[cell] = round;
      heapPush(classHeap(classes[s], c, clsAt), cell);
    }
    if (slotPins[slot]) return;
    const key = round * nSlots + slot, was = slotClsRound[slot] === round ? slotCls[slot] : -1;
    if (slotKey[slot] !== key) { slotKey[slot] = key; heapMoved(slotOld[s], slot); }
    if (was >= 0 && !before(c, was)) return;
    if (was >= 0) heapOut(slotClasses[s][was], slot);
    slotCls[slot] = c; slotClsRound[slot] = round;
    heapPush(classHeap(slotClasses[s], c, slotClsAt), slot);
  }
  // (a round begins: no page is of it yet — the classes' heaps are empty; what they held is of an older round now)
  function unclassed() {
    for (let s = 0; s < SHAPES; s++) {
      for (let c = 0; c < classes[s].length; c++) if (classes[s][c]) classes[s][c].n = 0;
      for (let c = 0; c < slotClasses[s].length; c++) if (slotClasses[s][c]) slotClasses[s][c].n = 0;
    }
  }
  // What may be let go for whoever asks a cell of view `k` (FOR_TOP, FOR_QUIET), the first of it by how lately it was
  // wanted and, of what is alike, by its number: of a shape's `old` heap and its classes' (the cells', or the slots')
  // → it, or −1: none — how lately it was wanted in `chosen`. Not a page that stays (it is in no heap), not this view's
  // or one of a view served before it, nothing of this round for a closed insert's page.
  let chosen = 0;
  function first(olds, list, k, per) {
    if (!olds.n) return -1;
    const top = olds.list[0], named = Math.floor(olds.keys[top] / per);
    if (named < round) { chosen = named; return top; }
    if (k === FOR_QUIET) return -1;
    if (list[0] && list[0].n) { chosen = round - 0.5; return list[0].list[0]; }
    // (the views served after k, the last-served first: those from the 64th on alike — the first of them all)
    let best = -1;
    for (let v = list.length - 2; v >= 64 && v > k; v--) { const h = list[1 + v]; if (h && h.n && (best < 0 || h.list[0] < best)) best = h.list[0]; }
    if (best >= 0) { chosen = round - 0.25 - 0.2; return best; }
    for (let v = Math.min(63, list.length - 2); v > k; v--) { const h = list[1 + v]; if (h && h.n) { chosen = round - 0.25 - 0.2 * Math.min(1, v / 64); return h.list[0]; } }
    return -1;
  }
  // cell let go: its page gone from the cache — the table and its sheet told, if its pixels were there (and, if a view
  // names it this round, that it was let go for room)
  function drop(cell) {
    const rec = cellRec[cell], slot = cell >> 4, s = rShape[rec], stays = (rState[rec] & PIN) !== 0;
    if (!stays) cellOut(cell, rec);
    occ[slot] &= ~MASK[s][POS[s].indexOf(cell & 15)];
    cellRec[cell] = -1; rCell[rec] = -1;
    if (stays) { pinned -= UNITS[s]; if (--slotPins[slot] === 0) pinSlots--; }
    if (!occ[slot]) {
      // (the slot is empty: its free cells are no shape's any more)
      if (s !== FULL) { const pos = POS[s]; for (let n = 0; n < pos.length; n++) if (slot * 16 + pos[n] !== cell) heapOut(free[s], slot * 16 + pos[n]); }
      slotShape[slot] = -1; emptySlots.push(slot);
    } else heapPush(free[s], cell);
    slotNow(slot, s);
    if (!(rState[rec] & PAINTED)) return;
    rState[rec] &= ~PAINTED;
    if (rWant[rec] === round) rState[rec] |= LOST;
    const c = sheets[rSheet[rec]];
    T.take(c, rL[rec], rI[rec], rJ[rec]);
    c.stamp++;
  }
  // a cell of shape s for a page of view k (FOR_TOP, FOR_QUIET): a free one in a slot of its shape, or an
  // empty slot; else one let go — a cell of its shape, or a whole slot of another, the least lately wanted first → −1:
  // no room
  function allocate(s, k) {
    for (;;) {
      if (s !== FULL && free[s].n) { const cell = free[s].list[0]; heapOut(free[s], cell); return cell; }
      if (emptySlots.length) {
        const slot = emptySlots.pop(), pos = POS[s];
        slotShape[slot] = s;
        // (its first cell is the one taken; the others are its shape's free ones)
        for (let n = 1; n < pos.length; n++) heapPush(free[s], slot * 16 + pos[n]);
        return slot * 16 + pos[0];
      }
      let cell = -1, slot = -1, age = Infinity, at = -1;
      if (s !== FULL) { cell = first(old[s], classes[s], k, CELLS); if (cell >= 0) { age = chosen; at = cell >> 4; } }
      for (let sh = 0; sh < SHAPES; sh++) {
        if (sh === s && s !== FULL) continue;
        const q = first(slotOld[sh], slotClasses[sh], k, nSlots);
        if (q >= 0 && (chosen < age || (chosen === age && q < at))) { slot = q; cell = -1; age = chosen; at = q; }
      }
      if (slot >= 0) { const pos = POS[slotShape[slot]]; for (let n = 0; n < pos.length; n++) if (cellRec[slot * 16 + pos[n]] >= 0) { drop(slot * 16 + pos[n]); counts.evicted++; } }
      else if (cell >= 0) { drop(cell); counts.evicted++; }
      else return -1;
    }
  }
  function claim(cell, rec) {
    const s = rShape[rec], slot = cell >> 4;
    occ[slot] |= MASK[s][POS[s].indexOf(cell & 15)];
    cellRec[cell] = rec; rCell[rec] = cell;
    // (a top: it stays — its slot is none that can be let go whole)
    if (rState[rec] & PIN) { pinned += UNITS[s]; if (slotPins[slot]++ === 0) pinSlots++; } else cellIn(cell, rec);
    slotNow(slot, s);
  }
  // the whole slots left for view k: empty, or holding no top and no page of a view served before it (its own pages
  // of this round it may leave at another bias) — counted from what is kept: the slots but those holding a top and
  // those whose class is a view's served before it. While one of them holds no page of its own either, allocate
  // finds a cell of any shape; a cell taken costs one of them at the most
  function slotsLeft(k) {
    let slots = nSlots - pinSlots;
    for (let sh = 0; sh < SHAPES; sh++) { const list = slotClasses[sh]; for (let v = 0; v < k && 1 + v < list.length; v++) if (list[1 + v]) slots -= list[1 + v].n; }
    return slots;
  }

  // ── sheets ──
  const sheets = [], freeIds = [], byKey = new Map(), topsDue = [];
  let nSheets = 0, epoch = 0;
  const said = new Set();
  // (the records found blank or of one colour as they were made, for the next place to tell)
  const blanks = [];
  // page (L, i, j) of sheet c: its record, made if there is none — one no draw of the recording reaches is blank from
  // the first (never painted, never waited for), and so is one of one colour (SOLID, its colour kept), the table and
  // its sheet told by the next place
  function record(c, L, i, j) {
    const x = keyX(c.id, L), y = keyY(i), z = keyY(j), e = find(x, y, z);
    if (e >= 0) return hash[e * 4 + 3];
    let rec = recFree.pop();
    if (rec === undefined) { if (nRecs === cap) growRecs(); rec = nRecs++; }
    if ((nRecs - recFree.length) * 2 > HASH) growHash();
    enter(x, y, z, rec);
    rSheet[rec] = c.id; rL[rec] = L; rI[rec] = i; rJ[rec] = j; rCell[rec] = -1; rShape[rec] = pageShape(c.lay, L, i, j);
    rState[rec] = 0; rWant[rec] = 0; rQuiet[rec] = 0; rProbe[rec] = 0; rBy[rec] = 0; rWeight[rec] = 0; rDeny[rec] = 0; rSeen[rec] = 0; rSince[rec] = cycle; rWanted[rec] = 0;
    rIn[rec] = c.recs.length; c.recs.push(rec);
    if (pageBlank(c.rec, c.lay, L, i, j)) { rState[rec] = BLANK | DUE; blanks.push(rec); counts.blank++; }
    else {
      const colour = pageSolid(c.rec, c.lay, L, i, j);
      if (colour >= 0) { rState[rec] = BLANK | SOLID | DUE; rColour[rec] = colour; blanks.push(rec); counts.solid++; }
    }
    return rec;
  }
  // (nothing is painted in a page — or it is of one colour: the table told)
  function tell(c, rec) {
    rState[rec] &= ~DUE;
    T.put(c, rL[rec], rI[rec], rJ[rec], rState[rec] & SOLID ? oneColour(rColour[rec]) : -2);
  }
  // (its sheet told what paint a page told of has: none — a hole —, or one opaque colour all over; → whether what is
  // told of the sheet changed)
  function told(c, rec) {
    if (!(rState[rec] & SOLID)) { if (c.hole) return false; c.hole = true; return true; }
    if (rec === c.top) { const [mw, mh] = topSize(c.lay); c.mask = new Uint8Array(mw * mh).fill(1); c.mw = mw; c.mh = mh; }
    if (c.opaque) return false;
    c.opaque = true;
    return true;
  }
  function forget(c, rec) {
    if (rCell[rec] >= 0) drop(rCell[rec]);
    // (a blank page the table was told of: what is above it is read there again)
    if ((rState[rec] & (BLANK | DUE)) === BLANK) { rState[rec] = 0; if (!c.dead) T.take(c, rL[rec], rI[rec], rJ[rec]); }
    leave(find(keyX(c.id, rL[rec]), keyY(rI[rec]), keyY(rJ[rec])));
    const at = rIn[rec], lastRec = c.recs.pop();
    if (lastRec !== rec) { c.recs[at] = lastRec; rIn[lastRec] = at; }
    rSheet[rec] = -1; rState[rec] = 0; rGen[rec]++;
    recFree.push(rec);
  }
  const topThere = c => (rState[c.top] & (PAINTED | BLANK)) !== 0;
  const sheetOf = handle => sheets[handle] || null;

  function add(recording, opts) {
    if (!recording.wired) throw new Error('sheets.add: a recording made live from what the artist sent (Recording.fromWire)');
    const wrap = [!!opts?.wrap?.[0], !!opts?.wrap?.[1]], R = recording.rect;
    let key = `${recording.h1}:${recording.h2}:${recording.items.length}|${R[0]},${R[1]},${R[2]},${R[3]}|${+wrap[0]}${+wrap[1]}`;
    const had = byKey.get(key);
    if (had && had.rec.same(recording)) { had.refs++; return had.id; }
    // (another picture of the same hash: a sheet of its own, not shared)
    if (had) key = null;
    if (!freeIds.length && nSheets >= TABLE.HANDLES) throw new Error(`sheets: more than ${TABLE.HANDLES} sheets at once`);
    const id = freeIds.length ? freeIds.pop() : nSheets++, c = new Sheet(id, key, recording, layOf(R, wrap), host.wholePages);
    if (!T.block(c)) { freeIds.push(id); throw new Error('sheets: the page table is full'); }
    sheets[id] = c;
    T.handle(id, c);
    if (key) byKey.set(key, c);
    for (const P of painters) P.worker.postMessage({ t: 'set', id, rec: recording.wired, lay: c.lay });
    // its top: a cell that stays, its page asked with the next request — unless nothing is painted in it (said at
    // once: nothing has read the sheet yet)
    const top = c.top = record(c, c.levels - 1, 0, 0);
    rState[top] |= PIN;
    if (rState[top] & BLANK) { tell(c, top); told(c, top); }
    else {
      const cell = allocate(rShape[top], FOR_TOP);
      if (cell < 0) { release(id); throw new Error(`sheets: the cache (${layers} layers) has no room for the top of one more sheet`); }
      claim(cell, top);
      topsDue.push(c);
    }
    epoch++;
    return id;
  }
  function release(handle) {
    const c = sheets[handle];
    if (!c) throw new Error(`sheets.release: no sheet ${handle}`);
    if (--c.refs > 0) return;
    c.dead = true;
    while (c.recs.length) { const rec = c.recs[c.recs.length - 1]; rState[rec] &= ~PAINTED; forget(c, rec); }
    T.handle(handle, null);
    T.unblock(c);
    if (c.key && byKey.get(c.key) === c) byKey.delete(c.key);
    said.delete(c);
    sheets[handle] = null; freeIds.push(handle);
    for (const P of painters) P.worker.postMessage({ t: 'drop', id: handle });
    // (its recording is ended here: SH1)
    c.rec.close();
    epoch++;
  }

  // ── the painters ──
  // each is sent every sheet's recording once and asked for pages; what comes back waits — its record, its sheet, the
  // painter's page as it came, side by side in three lists — for the next place: its record still marked as asked
  // (FLYING) till then, so nothing lets the record go, or gives its number to another page, between the answer and its
  // placing. A painter that answers is given the next page there is to ask at once (feed: SH12). A painter's thread
  // that dies is the engine's own failure (host.failed: SH5) — its pages are never left in flight.
  const painters = [], arrivedRec = [], arrivedSheet = [], arrivedPage = [], arrivedFrom = [];
  // (a page that could not be painted is read as one nothing is painted in)
  const NOTHING = Object.freeze({ kind: KIND.EMPTY });
  // the jobs in flight: a record each, taken again when its job is answered (job 0: free) — its number, its pages'
  // records and their sheets; a picture's: how its promise ends. Found by the number: a handful at the most
  const flights = [];
  function flight() {
    for (let n = 0; n < flights.length; n++) if (!flights[n].job) return flights[n];
    const F = { job: 0, recs: [], sheets: [], resolve: null, reject: null };
    flights.push(F);
    return F;
  }
  // each painter's busy milliseconds (its own clock round each job — told only when the thread was mounted with the
  // stand: sheets.stats())
  const busyMs = [];
  let jobNo = 0, flying = 0, arrivedAt = 0, all = true;
  function heard(P, m) {
    let F = null;
    for (let n = 0; n < flights.length; n++) if (flights[n].job === m.job) { F = flights[n]; break; }
    if (!F) return;
    F.job = 0; P.busy--; counts.jobs++;
    if (m.ms !== undefined) busyMs[P.k] += m.ms;
    if (F.resolve) {
      const resolve = F.resolve, reject = F.reject;
      F.resolve = F.reject = null;
      if (m.error) reject(new Error(`a picture of a painting failed: ${m.error}`)); else resolve(m.pixels);
    } else {
      for (let n = 0; n < F.recs.length; n++) {
        const rec = F.recs[n], c = F.sheets[n], page = m.pages ? m.pages[n] : null;
        flying--;
        if (!c.dead) {
          arrivedRec.push(rec); arrivedSheet.push(c);
          if (page && !page.error) { arrivedPage.push(page); arrivedFrom.push(P); }
          else {
            // (a page that could not be painted: said once a sheet, and read as nothing painted — never waited for again)
            counts.failed++;
            if (!said.has(c)) { said.add(c); host.error(new Error(`a page of a painting failed: ${page ? page.error : m.error}`)); }
            arrivedPage.push(NOTHING); arrivedFrom.push(P);
          }
        }
        api.onArrive?.();
      }
      empty(F.recs); empty(F.sheets);
    }
    feed(P);
  }
  for (let k = 0; k < host.painters; k++) {
    // (back: the bytes of its pages written since the last place, given back at its end to be let go there — the list
    // kept, its message one a place)
    const P = { worker: new Worker(new URL('./painters.js', import.meta.url), { type: 'module' }), busy: 0, k, back: [], given: { t: 'back', buffers: null } };
    P.worker.onmessage = e => heard(P, e.data);
    P.worker.onerror = e => host.failed(new Error(`a painter's thread failed: ${e.message || 'it did not start'}`));
    // (measured by the stand: it reads its clock round each job — else it reads none)
    P.worker.postMessage({ t: 'start', stand: !!host.flags?.stand });
    painters.push(P); busyMs.push(0);
  }
  // (how many of the painters are at work now: all of them in a held frame and a build, host.busy of them else)
  const working = () => (all ? painters.length : Math.min(painters.length, host.busy));
  // (the least busy of the painters at work now with room for a job, or null)
  function painter() {
    let best = null;
    for (let k = working() - 1; k >= 0; k--) if (painters[k].busy < IN_FLIGHT && (!best || painters[k].busy <= best.busy)) best = painters[k];
    return best;
  }
  // (job F — its pages' records, all of one kind: tops, or one page — asked of painter P. The message is the one thing
  // made: it crosses a thread)
  function send(P, F) {
    const list = [];
    for (let n = 0; n < F.recs.length; n++) {
      const rec = F.recs[n], c = sheets[rSheet[rec]], s = rShape[rec];
      rState[rec] |= FLYING; flying++; counts.sent++;
      F.sheets.push(c);
      list.push({ id: c.id, L: rL[rec], i: rI[rec], j: rJ[rec], w: shapeW(s), h: shapeH(s), top: rec === c.top });
    }
    F.job = ++jobNo; P.busy++;
    P.worker.postMessage({ t: 'pages', job: F.job, list });
  }
  // What there is to ask (SH12): the tops due, then the list the last request ordered — due, the pages' records in
  // its order, each with its record's number of then (dueGen: a record let go since is another page's now), asked as
  // far as dueAt. Kept until the next cycle orders another.
  const due = [], dueGen = [];
  let dueAt = 0;
  // the tops due asked of painter P, many to a job → whether there were any
  function topsTo(P) {
    let n = 0;
    for (let k = 0; k < topsDue.length; k++) { const c = topsDue[k]; if (!c.dead && !(rState[c.top] & (PAINTED | BLANK | FLYING))) topsDue[n++] = c; }
    while (topsDue.length > n) topsDue.pop();
    if (!n) return false;
    const F = flight(), m = Math.min(TOPS, n);
    for (let k = 0; k < m; k++) F.recs.push(topsDue[k].top);
    for (let k = m; k < n; k++) topsDue[k - m] = topsDue[k];
    for (let k = 0; k < m; k++) topsDue.pop();
    send(P, F);
    return true;
  }
  // the next page of the list that is still to be asked — its record still that page's, a cell taken for it, not
  // there, not known empty, not asked — asked of painter P → whether there was one
  function pageTo(P) {
    while (dueAt < due.length) {
      const rec = due[dueAt], gen = dueGen[dueAt];
      dueAt++;
      if (rGen[rec] !== gen || rSheet[rec] < 0 || rCell[rec] < 0 || (rState[rec] & (PAINTED | BLANK | FLYING))) continue;
      const F = flight();
      F.recs.push(rec);
      send(P, F);
      return true;
    }
    return false;
  }
  // a painter that has answered goes on at once, if it is among those at work now: tops first, then the list's next
  // page — no tick between, no clock (the cells were taken by weigh: where each page lies is the cycle's decision).
  // Not while a film plays and PILE ticks' worth of pages wait to be placed: they could be placed no sooner
  function feed(P) {
    if (P.k >= working() || (!all && arrivedRec.length - arrivedAt >= PILE * host.pages)) return;
    while (P.busy < IN_FLIGHT && (topsTo(P) || pageTo(P)));
  }

  // ── a cycle ──
  // the views asked in the round now, in the order they were asked: the order of service
  const views = [], touched = [];
  // (the round each of the last cycles ended with: a record named since the one before the last is kept)
  let keep = 0, lastFinal = 0;
  // (in the round now: whether `toward`'s camera moved — its view was placed again —; whether a probe worked out its
  // items)
  let towardMoved = false, probed = false;
  function beginRound() {
    round++; asking = true;
    empty(views); empty(touched);
    unclassed();
    towardMoved = false; probed = false;
  }
  // What a view names, kept by ITEM (ask.js: a quad row asked one way — an item is worked out again only when what
  // its pages are worked out from changed, SH10). Of a view (its `_`): its items in the order they were asked — each
  // its quad row, how it was asked, and where its run begins among the pages SAID —, and of each page said its
  // record, what it was named as (the view's own before a quiet one: at the most it was said as) and
  // its weight, each once an item. From them `names`, `as`,
  // `weights`, `n` — the pages the view names, each once (a page two items say: where the first said it, as the most
  // it was said as, at its greatest weight): what the round, weigh and request read — the very list an ask of every
  // item gives.
  //   An ask goes through the view's items in their order (ask.js): one named again (kept) stays where it is while
  // every item before it stood too; at the first that is another than at the last ask — worked out again, or not the
  // item that was there — the items of the last ask from there on are moved aside (the TAIL: one for all the views,
  // found by their quad rows), and the view's are written on from there: one kept, copied from the tail; one worked
  // out, as ask.js names its pages.
  //   And of the view: its pressure, whether it was denied pages at its bias's end, the bias it is drawn at, the items
  // its last ask worked out, the stand's slot it was asked in, and its probe — when that last worked out its items
  // (host.ts) and what of the view changed since.
  let V = null, seenNo = 0;
  // (the weight of a page by what it is named as — NAMED's: the view's own at the weight of the view now asked, a
  // quiet one, a probe's)
  const weightOf = Float32Array.of(1, 0.5, 0);
  const viewOf = () => ({ names: new Int32Array(256), as: new Uint8Array(256), weights: new Float32Array(256), n: 0,
    quad: new Int32Array(64), how: new Uint8Array(64), from: new Int32Array(64), items: 0, rec: new Int32Array(256), saidAs: new Uint8Array(256), saidW: new Float32Array(256), said: 0,
    round: -1, epoch: -1, all: false, world: null, bias: NaN, weight: NaN, tick: 0, press: 0, k: 0, full: false,
    drawn: NaN, worked: 0, slot: 0, probe: null, probeAt: -Infinity, probeChanged: 0 });
  // a view's probe (5.19): a View of the cache's own — the view asked a quarter level finer, its fields the view's
  // (probe() sets them), its store `_` as a view's
  const probeOf = () => ({ world: null, camera: null, width: 1, height: 1, stage: null, weight: 1, coarser: 0, inserts: false, list: null, n: 0,
    over: null, overN: 0, ahead: false, nodes: null, nodeOf: null, nodesN: 0, bias: 0, _: viewOf() });
  // the tail: its items (their runs begin at `from`; one more: where the last ends), their pages; had: a quad row → 1 +
  // its item of the tail (0: none); stood: the items of the last ask that stand so far; apart: the tail is made
  const tail = { quad: new Int32Array(64), how: new Uint8Array(64), from: new Int32Array(65), items: 0, rec: new Int32Array(256), as: new Uint8Array(256), w: new Float32Array(256) };
  let had = new Int32Array(256), stood = 0, apart = false;
  function part() {
    const at = stood, n = V.items - at, first = at < V.items ? V.from[at] : V.said, m = V.said - first;
    if (tail.quad.length < n) { tail.quad = new Int32Array(2 * n); tail.how = new Uint8Array(2 * n); tail.from = new Int32Array(2 * n + 1); }
    if (tail.rec.length < m) { tail.rec = new Int32Array(2 * m); tail.as = new Uint8Array(2 * m); tail.w = new Float32Array(2 * m); }
    for (let k = 0; k < n; k++) { const q = V.quad[at + k]; tail.quad[k] = q; tail.how[k] = V.how[at + k]; tail.from[k] = V.from[at + k] - first; had[q] = k + 1; }
    for (let s = 0; s < m; s++) { tail.rec[s] = V.rec[first + s]; tail.as[s] = V.saidAs[first + s]; tail.w[s] = V.saidW[first + s]; }
    tail.from[n] = m; tail.items = n;
    V.items = at; V.said = first;
    apart = true;
  }
  // an item of the view begins, at the end of those it has
  function item(q, how) {
    if (V.items === V.quad.length) { V.quad = grown(V.quad, V.items * 2); V.how = grown(V.how, V.items * 2); V.from = grown(V.from, V.items * 2); }
    V.quad[V.items] = q; V.how[V.items] = how; V.from[V.items] = V.said; V.items++;
  }
  // (a page said by the item now: its record, what it is named as — its weight by that —; → where among the said)
  function say(rec, as) {
    if (V.said === V.rec.length) { V.rec = grown(V.rec, V.said * 2); V.saidAs = grown(V.saidAs, V.said * 2); V.saidW = grown(V.saidW, V.said * 2); }
    V.rec[V.said] = rec; V.saidAs[V.said] = as; V.saidW[V.said] = weightOf[as];
    return V.said++;
  }
  // ask.js's: whether the view asked the item (q, how) at its last ask — then it is named again as it was
  function kept(q, how) {
    if (!apart) {
      if (stood < V.items && V.quad[stood] === q && V.how[stood] === how) { stood++; return true; }
      part();
    }
    const k = had[q] - 1;
    if (k < 0 || tail.how[k] !== how) return false;
    item(q, how);
    for (let s = tail.from[k]; s < tail.from[k + 1]; s++) V.saidW[say(tail.rec[s], tail.as[s])] = tail.w[s];
    return true;
  }
  // … an item worked out begins: what is named from here on is its
  function begin(q, how) {
    if (!apart) part();
    item(q, how);
    seenNo++;
  }
  // … a page said by it — once an item: said again, it is what it was named as at the most
  function sayOnce(c, L, i, j, as) {
    const rec = record(c, L, i, j);
    if (rSeen[rec] === seenNo) {
      const s = rAt[rec];
      if (as < V.saidAs[s]) V.saidAs[s] = as;
      if (weightOf[as] > V.saidW[s]) V.saidW[s] = weightOf[as];
      return;
    }
    rSeen[rec] = seenNo;
    rAt[rec] = say(rec, as);
  }
  // … a page named by it: a page of the view's own (or of its probe's) after its parent, named as the same (coarse to
  // fine, SH10) — but in a whole call; the parent the item named last (four pages share one) not looked for again
  let upSheet = null, upL = 0, upI = 0, upJ = 0, upSeen = 0;
  function name(c, L, i, j, as) {
    if (!all && (as === NAMED.OWN || as === NAMED.PROBE) && L < c.levels - 2) {
      const pi = i >> 1, pj = j >> 1;
      if (upSeen !== seenNo || upSheet !== c || upL !== L + 1 || upI !== pi || upJ !== pj) { upSheet = c; upL = L + 1; upI = pi; upJ = pj; upSeen = seenNo; sayOnce(c, L + 1, pi, pj, as); }
    }
    sayOnce(c, L, i, j, as);
  }
  // the pages the view names, from what its items say
  function gather() {
    if (V.names.length < V.said) { V.names = new Int32Array(2 * V.said); V.as = new Uint8Array(2 * V.said); V.weights = new Float32Array(2 * V.said); }
    seenNo++;
    let n = 0;
    for (let s = 0; s < V.said; s++) {
      const rec = V.rec[s];
      if (rSeen[rec] === seenNo) {
        const o = rAt[rec];
        if (V.saidAs[s] < V.as[o]) V.as[o] = V.saidAs[s];
        if (V.saidW[s] > V.weights[o]) V.weights[o] = V.saidW[s];
        continue;
      }
      rSeen[rec] = seenNo; rAt[rec] = n;
      V.names[n] = rec; V.as[n] = V.saidAs[s]; V.weights[n] = V.saidW[s]; n++;
    }
    V.n = n;
  }
  const askView = createAsk(sheetOf, name, begin, kept);

  // The items of a view (its store: V) asked — every one worked out where what all of them are worked out from is
  // another: R says so of the view (changed: CHANGED.ALL), or its bias, its weight or its world is, or the sheets are
  // others (a handle may be another sheet's), or the view was not asked in the cycle before (the records of its pages
  // may be others' now), or the call is whole where the view's last ask was not, or the other way (a whole call names
  // no parents); else each where what it is worked out from changed (SH10) —, its pages gathered. own: what its own
  // pages are named as. → when the clock was read after the ask (the stand's: what the bookkeeping of its names costs
  // from there; 0: not measured)
  function items(view, changed, own) {
    // (askView.why: the first of these that held, for the stand — 1 the view's own `changed`, 2 the cache's (the
    // sheets, a cycle missed, a whole call begun or ended, the world, the weight), 3 its bias; 0: none)
    askView.why = changed & CHANGED.ALL ? 1 : V.epoch !== epoch || V.round < keep || V.all !== all ? 2 : V.bias !== view.bias ? 3 : V.world !== view.world || V.weight !== view.weight ? 2 : 0;
    if (askView.why) { V.items = 0; V.said = 0; V.n = 0; }
    if (had.length < view.world.quads.cap) had = new Int32Array(view.world.quads.cap);
    stood = 0; apart = false;
    askView(view, askView.why ? CHANGED.ALL : changed, V.tick, own);
    const booked = askView.timed ? performance.now() : 0;
    // (the items the last ask had after the last of this one are asked no more)
    if (!apart && stood < V.items) part();
    if (apart) {
      for (let k = 0; k < tail.items; k++) had[tail.quad[k]] = 0;
      gather();
    }
    V.epoch = epoch; V.all = all; V.bias = view.bias; V.world = view.world; V.weight = view.weight; V.tick = view.world.tick;
    return booked;
  }
  // (the sheet a page is of, of what the cycle names: SH3)
  function cur(rec) {
    const c = sheets[rSheet[rec]];
    if (c.curRound !== round) { c.curRound = round; empty(c.cur); touched.push(c); }
    c.cur.push(rec);
  }
  // (a view's own page not there and waited for — unless the view it is the page of this round, the one asking or one
  // served before it, is at its bias's end and was denied it by the last weigh: it has no cell, it will not come,
  // whoever names it)
  const waited = rec => !(rState[rec] & (PAINTED | BLANK)) && !(views[rBy[rec]]._.full && rDeny[rec] === weighNo);

  function ask(view) {
    if (!asking) beginRound();
    V = view._ ||= viewOf();
    const k = views.length, begins = view.fresh || V.round < 0;
    // (a view that begins — R says so: its pressure starts at 0, nothing kept of what the View showed before)
    if (view.fresh) { V.press = 0; V.full = false; view.fresh = false; }
    // its bias told — here alone: the pressure as the last weigh left it, and the view's own `coarser`
    view.bias = (view.coarser || 0) + V.press;
    weightOf[NAMED.OWN] = view.weight;
    const worked = askView.worked, booked = items(view, view.changed, NAMED.OWN);
    V.worked = askView.worked - worked; V.slot = askView.slotNow; V.probeChanged |= view.changed;
    if (view.changed && whose(view, k) === TOWARD) towardMoved = true;
    V.round = round; V.k = k;
    views.push(view);
    let missing = 0, entered = 0;
    for (let n = 0; n < V.n; n++) {
      const rec = V.names[n], as = V.as[n];
      // (named by this round: its cell, if it has one, to its place in the order kept — a page a view named already
      // this round as its own stays that view's)
      if (as === NAMED.QUIET) {
        if (rQuiet[rec] !== round) { rQuiet[rec] = round; if (rWant[rec] !== round) { renamed(rec); cur(rec); } }
        continue;
      }
      if (rWant[rec] !== round) {
        // (named by no view in the cycle before: it enters what is asked with this cycle)
        if (rWant[rec] < lastFinal) rSince[rec] = cycle;
        rWant[rec] = round; rBy[rec] = k; rWeight[rec] = V.weights[n];
        renamed(rec);
        if (rQuiet[rec] !== round) cur(rec);
        const c = sheets[rSheet[rec]];
        if (c.windowed(rL[rec])) T.asked(c, rL[rec], rI[rec], rJ[rec]);
      } else if (V.weights[n] > rWeight[rec]) rWeight[rec] = V.weights[n];
      // (not there, and waited for)
      if (waited(rec)) { missing++; if (rSince[rec] === cycle) entered++; }
    }
    // (of what it lacks, the pages that entered what is asked with this cycle — SH10 `entered`)
    view.entered = entered;
    // the bias it is drawn at: its bias from the ask in which all it names is there — at once where it begins and in a
    // whole call —, never more than a level under it (all of it worked out on every ask, the comparison too: what a
    // branch taken only now and then works out has no type feedback, and its optimized code is left each time it is
    // taken)
    const held = Math.max(V.drawn, view.bias - 4), there = missing === 0;
    V.drawn = begins || all || there ? view.bias : held;
    view.drawn = V.drawn;
    if (booked) askView.booked(performance.now() - booked, V.n);
    V = null;
    return missing;
  }

  // The probe of a view (5.19) for its weigh → whether what it names can be counted. It is the view asked a quarter
  // level finer than the view was asked, with no closed insert: its items worked out — in every round
  // where every painter is at work (a whole call); else at most one probe a round, each once every
  // host.ahead / 2, never in the round `toward`'s camera moved, nor where its view's own ask worked out none —, or
  // what it named named again; either way its records kept by it. A probe that is not asked and has nothing to name
  // again (new, of another bias, or its records perhaps others' now) counts nothing.
  function probe(view) {
    const S = view._, P = S.probe ||= probeOf(), PV = P._;
    P.world = view.world; P.camera = view.camera; P.width = view.width; P.height = view.height; P.stage = view.stage; P.weight = view.weight;
    P.coarser = view.coarser; P.inserts = view.inserts; P.list = view.list; P.n = view.n; P.over = view.over; P.overN = view.overN;
    P.ahead = view.ahead; P.nodes = view.nodes; P.nodeOf = view.nodeOf; P.nodesN = view.nodesN;
    P.bias = view.bias - 1;
    const stands = PV.epoch === epoch && PV.round >= keep && PV.world === P.world && PV.bias === P.bias;
    const work = all || (!(stands && S.worked === 0) && !probed && !towardMoved && host.ts - S.probeAt >= host.ahead * 500);
    if (!work && !stands) return false;
    V = PV;
    if (work) {
      if (!all) probed = true;
      const slot = askView.slotNow;
      askView.slot(S.slot);
      const booked = items(P, S.probeChanged, NAMED.PROBE);
      if (booked) askView.booked(performance.now() - booked, V.n);
      askView.slot(slot);
      S.probeChanged = 0; S.probeAt = host.ts;
    }
    for (let n = 0; n < V.n; n++) rProbe[V.names[n]] = round;
    V.round = round;
    V = null;
    return true;
  }
  // What the probe of view k counts — as N would be a quarter level finer: the pages a view served before it named
  // this round as its own left out, parents in, tops apart — within FALL of what is left for it, by the units and by
  // the whole slots
  function fits(k, left) {
    const P = views[k]._.probe._;
    let units = 0, pages = 0;
    for (let n = 0; n < P.n; n++) {
      const rec = P.names[n], st = rState[rec];
      if ((st & PIN) || (st & (BLANK | FOUND)) === BLANK || (rWant[rec] === round && rBy[rec] < k)) continue;
      units += UNITS[rShape[rec]]; pages++;
    }
    return units <= BIAS.FALL * left && pages <= BIAS.FALL * slotsLeft(k);
  }

  // The views of the round served in their order (the header's Room): each one's pages counted, its pressure worked
  // out, cells taken for it; then the closed inserts' pages → whether the asks are other ones now: a
  // pressure changed, or a view at its bias's end was denied a page its ask had counted
  const fresh = [];
  function weigh() {
    weighNo++;
    namedNow = 0; hasNow = 0; roomNow = nSlots * 16 - pinned;
    // (a scene being made beside the one shown — its opening view, `next`, asked after the frame's: 2.9 — has a share
    // kept for it: what it needs at its bias, at most half the room; the views served before it have the rest — so the
    // living picture keeps at least half and the switch always comes)
    let share = 0;
    for (let k = 0; k < views.length; k++) if (views[k].next) share += Math.min(needOf(k), roomNow / 2);
    let changed = false, moved = false, left = roomNow - share;
    for (let k = 0; k < views.length && !(all && moved); k++) {
      const view = views[k], S = view._, was = S.full;
      if (view.next) { const s = Math.min(needOf(k), roomNow / 2); left += s; share -= s; }
      // counted first: its own pages — those it was the first to name as its own, parents in, tops apart —, the units
      // they take, those that have cells and those that are there (a page found empty: as its cell)
      let need = 0, got = 0, there = 0;
      for (let n = 0; n < S.n; n++) {
        const rec = S.names[n], st = rState[rec];
        if (S.as[n] !== NAMED.OWN || rBy[rec] !== k || (st & PIN) || (st & (BLANK | FOUND)) === BLANK) continue;
        const u = UNITS[rShape[rec]];
        need += u;
        if (rCell[rec] >= 0 || (st & FOUND)) got += u;
        if (st & (PAINTED | FOUND)) there += u;
      }
      // (SH13 `cycle`: what the frame's own views named of their own, and what of it is in the cache)
      if (whose(view, k) === OWNED) { namedNow += need; hasNow += there; }
      // (how far it may rise: a level a weigh, and a level above the bias it is drawn at; there, as at the bias's end,
      // it has what fits)
      const most = Math.min(BIAS.MOST, S.press + 4, S.drawn - (view.coarser || 0) + 4), end = S.press >= most;
      let press = S.press, take = true;
      S.full = false;
      if (need > left && !end) {
        // over the room: coarser by as much as would fit it — nothing taken, nothing let go
        press = Math.min(most, press + Math.max(1, Math.ceil(2 * Math.log2(need / Math.max(left, 1)))));
        take = false;
      } else if (press > 0 && S.drawn === view.bias && probe(view) && fits(k, left)) {
        // a quarter level finer fits within FALL of the room — from the bias it is drawn at; in a whole call nothing is
        // taken at the bias it leaves
        press--;
        take = !all;
      }
      if (take) {
        let fit = true;
        empty(fresh);
        for (let n = 0; n < S.n; n++) {
          const rec = S.names[n];
          if (S.as[n] !== NAMED.OWN || rBy[rec] !== k || rCell[rec] >= 0 || (rState[rec] & BLANK)) continue;
          const cell = allocate(rShape[rec], k);
          if (cell < 0) { fit = false; break; }
          claim(cell, rec); fresh.push(rec); got += UNITS[rShape[rec]];
        }
        if (!fit && !end) {
          // the count fit and the cells' shapes did not: coarser by what it got — the cells just taken for it let go
          // (its pages will be others)
          press = Math.min(most, S.press + Math.max(1, Math.ceil(2 * Math.log2(need / Math.max(got, 1)))));
          for (let n = 0; n < fresh.length; n++) { const rec = fresh[n]; if (!(rState[rec] & FLYING)) { got -= UNITS[rShape[rec]]; drop(rCell[rec]); } }
        } else if (!fit) {
          // where it may rise no further: what fits is what it has — the rest is not waited for
          S.full = true;
          for (let n = 0; n < S.n; n++) {
            const rec = S.names[n];
            if (S.as[n] !== NAMED.OWN || rBy[rec] !== k || rCell[rec] >= 0 || (rState[rec] & BLANK)) continue;
            // (denied anew: the ask of this round counted it)
            if (!was || rDeny[rec] !== weighNo - 1) changed = true;
            rDeny[rec] = weighNo; counts.denied++;
          }
        }
      }
      if (press !== S.press) { S.press = press; moved = true; }
      left -= got;
    }
    // the closed inserts' pages, after every view's own (in a whole call: when every pressure stands)
    if (!(all && moved)) prepare();
    asking = false;
    return changed || moved;
  }
  // (the units view k's own pages take — those it was the first to name as its own, parents in, tops apart: as weigh
  // counts them)
  function needOf(k) {
    const S = views[k]._;
    let need = 0;
    for (let n = 0; n < S.n; n++) {
      const rec = S.names[n], st = rState[rec];
      if (S.as[n] !== NAMED.OWN || rBy[rec] !== k || (st & PIN) || (st & (BLANK | FOUND)) === BLANK) continue;
      need += UNITS[rShape[rec]];
    }
    return need;
  }
  // (cells for the pages the views name quietly and no view named as its own in this round; of a shape that found no
  // cell no more are looked for: nothing taken here frees one)
  function prepare() {
    let none = 0;
    for (let k = 0; k < views.length; k++) {
      const S = views[k]._;
      for (let n = 0; n < S.n; n++) {
        const rec = S.names[n], s = rShape[rec];
        if (S.as[n] !== NAMED.QUIET || rWant[rec] === round || rCell[rec] >= 0 || (rState[rec] & BLANK) || (none & (1 << s))) continue;
        const cell = allocate(s, FOR_QUIET);
        if (cell >= 0) claim(cell, rec); else none |= 1 << s;
      }
    }
  }

  // (how many levels coarser what is shown of a page now is than the page: up to the finest of its own above it there)
  function lacking(rec) {
    const c = sheets[rSheet[rec]], L = rL[rec];
    let i = rI[rec] >> 1, j = rJ[rec] >> 1;
    for (let l = L + 1; l < c.levels; l++, i >>= 1, j >>= 1) { const up = recordAt(c, l, i, j); if (up >= 0 && (rState[up] & (PAINTED | BLANK))) return l - L; }
    return c.levels - L;
  }
  // (the order of the list: by rank, the greater first; of two alike, the record's number)
  // (told in whole numbers: a fraction handed back to the sort is made on the heap at every comparison — 5.16)
  const byRank = (a, b) => (rRank[b] > rRank[a] ? 1 : rRank[b] < rRank[a] ? -1 : a - b);
  // (how far under its parent a view's own page is ranked: the parent always first)
  const UNDER = 2 ** -16;
  function request() {
    // tops first, many to a job
    for (let P = painter(); P && topsTo(P); P = painter());
    // then what the views named and is not there: their own pages by weight × the levels each lacks, a page's parent
    // always before it; then the closed inserts' pages — the list ordered anew, asked as far as the
    // painters at work have room, and on, as each answers (feed). Counted on the way (SH13 `cycle`): the greatest
    // pressure, the greatest bias the frame's own views are drawn at, the pages they and toward's want anew of the
    // painters
    empty(due); empty(dueGen); dueAt = 0; seenNo++;
    let most = 0, own = 0, wanted = 0;
    for (let k = 0; k < views.length; k++) {
      const view = views[k], S = view._, who = whose(view, k);
      if (S.press > most) most = S.press;
      if (who === OWNED && S.drawn - (view.coarser || 0) > own) own = S.drawn - (view.coarser || 0);
      for (let m = 0; m < S.n; m++) {
        const rec = S.names[m];
        if (who !== SHOT && S.as[m] === NAMED.OWN && rSince[rec] === cycle && rWanted[rec] !== cycle && !(rState[rec] & (PAINTED | BLANK | FLYING))) { rWanted[rec] = cycle; wanted++; }
        if (rSeen[rec] === seenNo || rCell[rec] < 0 || (rState[rec] & (PAINTED | BLANK | FLYING | PIN))) continue;
        rSeen[rec] = seenNo;
        const short = lacking(rec);
        if (rWant[rec] === round) {
          // (its parent, to be asked too, is ranked already: a view names a page's parent before it)
          const p = parentOf(rec);
          rRank[rec] = p >= 0 && rSeen[p] === seenNo && rWant[p] === round ? Math.min(rWeight[rec] * short, rRank[p] - UNDER) : rWeight[rec] * short;
        } else rRank[rec] = -1 / (1 + short);
        due.push(rec);
      }
    }
    due.sort(byRank);
    for (let k = 0; k < due.length; k++) dueGen.push(rGen[due[k]]);
    for (let P = painter(); P && pageTo(P); P = painter());
    // (SH13 `insert`: the units the largest closed insert named quietly in the frame's own views — by its quads' items)
    let insert = 0;
    for (let k = 0; k < views.length; k++) {
      const view = views[k], S = view._;
      if (!view.inserts || whose(view, k) !== OWNED) continue;
      const aux = view.world.quads.aux;
      quietly.fill(0);
      for (let t = 0; t < S.items; t++) {
        if (S.how[t] !== ASKED.QUIET) continue;
        const end = t + 1 < S.items ? S.from[t + 1] : S.said;
        let u = 0;
        for (let s = S.from[t]; s < end; s++) { const st = rState[S.rec[s]]; if (!(st & PIN) && (st & (BLANK | FOUND)) !== BLANK) u += UNITS[rShape[S.rec[s]]]; }
        quietly[aux[S.quad[t]]] += u;
      }
      for (let r = 0; r < quietly.length; r++) if (quietly[r] > insert) insert = quietly[r];
    }
    // the cycle ends: what it named of each sheet (SH3); the records nobody names any more let go — a probe's names
    // keep theirs
    for (let k = 0; k < touched.length; k++) { const c = touched[k], was = c.last; c.last = c.cur; c.cur = was; c.curRound = -1; c.lastCycle = cycle; }
    keep = lastFinal; lastFinal = round;
    for (let rec = 0; rec < nRecs; rec++) {
      if (rSheet[rec] < 0) continue;
      const st = rState[rec], named = lastNamed(rec);
      if (st & (PIN | FLYING)) continue;
      // (a cell taken for a page that nobody names now and was never painted)
      if (rCell[rec] >= 0 && !(st & PAINTED) && named < round) drop(rCell[rec]);
      if (named >= keep || rProbe[rec] >= keep || (st & PAINTED)) continue;
      forget(sheets[rSheet[rec]], rec);
    }
    T.flush();
    cycle++;
    T.cycle(cycle);
    // (SH13 `cycle`: this cycle's numbers — what was sent, let go, denied and placed again since the last one ended)
    cycleOf.sent = counts.sent - sentWas; cycleOf.evicted = counts.evicted - evictedWas; cycleOf.denied = counts.denied - deniedWas; cycleOf.again = counts.again - againWas;
    sentWas = counts.sent; evictedWas = counts.evicted; deniedWas = counts.denied; againWas = counts.again;
    cycleOf.bias = most; cycleOf.own = own; cycleOf.wanted = wanted; cycleOf.named = namedNow; cycleOf.has = hasNow; cycleOf.insert = insert; cycleOf.room = roomNow;
  }

  // (a page's painted part, for its upload)
  const inside = [0, 0, 0, 0];
  // up to `count` arrived pages into the cache (the page and its half level: sheets/upload.js), the table told and
  // sent; the bytes of every page that came are given back to the painter that made them, to be let go there (the
  // queue has copied them: SH11). A view's own page that was let go for room while named is counted as placed again
  // (SH13 `again`)
  function place(count) {
    all = count === Infinity;
    // first, the pages found blank or of one colour as they were named since the last place: the table told, and their
    // sheets — one that was wholly opaque till now is mixed from here; a page of one colour is as a page placed (its
    // sheet's stamp moves: SH13)
    for (let n = 0; n < blanks.length; n++) {
      const rec = blanks[n];
      if (rSheet[rec] < 0 || !(rState[rec] & DUE)) continue;
      const c = sheets[rSheet[rec]];
      tell(c, rec);
      if ((told(c, rec) && topThere(c)) || (rState[rec] & SOLID)) c.stamp++;
    }
    empty(blanks);
    let placed = 0;
    while (arrivedAt < arrivedRec.length && placed < count) {
      const rec = arrivedRec[arrivedAt], c = arrivedSheet[arrivedAt], page = arrivedPage[arrivedAt], from = arrivedFrom[arrivedAt];
      arrivedSheet[arrivedAt] = null; arrivedPage[arrivedAt] = null; arrivedFrom[arrivedAt++] = null;
      if (page.pixels) from.back.push(page.pixels.buffer);
      // (its sheet released meanwhile: its records are gone, this number may be another page's)
      if (c.dead) continue;
      rState[rec] &= ~FLYING;
      const cell = rCell[rec];
      // (let go since it was asked: its cell is another's)
      if (cell < 0) { counts.stale++; continue; }
      if (rState[rec] & LOST) { rState[rec] &= ~LOST; if (rWant[rec] >= lastFinal) counts.again++; }
      if (page.kind & KIND.EMPTY) {
        // nothing was painted in it after all: no cell, the table says so, and what read it from above reads nothing
        drop(cell);
        rState[rec] |= BLANK | FOUND;
        tell(c, rec);
        c.hole = true; c.stamp++; counts.blank++;
      } else {
        const slot = cell >> 4, u = cell & 15, inLayer = slot % PER_LAYER, s = rShape[rec], w = shapeW(s), h = shapeH(s);
        const x = (inLayer % SLOTS_SIDE) * SLOT + (u & 3) * UNIT, y = Math.floor(inLayer / SLOTS_SIDE) * SLOT + (u >> 2) * UNIT, z = Math.floor(slot / PER_LAYER);
        upload.place(page.pixels, x, y, z, w, h, cellInside(c.lay, rL[rec], rI[rec], rJ[rec], w, h, inside));
        rState[rec] |= PAINTED;
        T.put(c, rL[rec], rI[rec], rJ[rec], cell);
        if (!(page.kind & KIND.OPAQUE)) c.hole = true;
        if (page.kind & KIND.SOME) c.opaque = true;
        if (rec === c.top) { c.mask = page.mask; c.mw = page.mw; c.mh = page.mh; }
        c.stamp++;
      }
      counts.placed++; placed++;
    }
    // (all placed: the lists begun anew; never all — their head, long placed, let go: those after it moved down)
    if (arrivedAt === arrivedRec.length) { empty(arrivedRec); empty(arrivedSheet); empty(arrivedPage); empty(arrivedFrom); arrivedAt = 0; }
    else if (arrivedAt >= 256) {
      const left = arrivedRec.length - arrivedAt;
      for (let n = 0; n < left; n++) { arrivedRec[n] = arrivedRec[arrivedAt + n]; arrivedSheet[n] = arrivedSheet[arrivedAt + n]; arrivedPage[n] = arrivedPage[arrivedAt + n]; arrivedFrom[n] = arrivedFrom[arrivedAt + n]; }
      while (arrivedRec.length > left) { arrivedRec.pop(); arrivedSheet.pop(); arrivedPage.pop(); arrivedFrom.pop(); }
      arrivedAt = 0;
    }
    upload.flush();
    // (the bytes written, back to their painters to be let go there: one message each that has any)
    for (let k = 0; k < painters.length; k++) {
      const P = painters[k];
      if (!P.back.length) continue;
      P.given.buffers = P.back;
      P.worker.postMessage(P.given, P.back);
      P.given.buffers = null;
      empty(P.back);
    }
    T.flush();
    return placed;
  }

  const api = {
    add, release, ask, weigh, request, place,
    // SH13: the cycle that just ended (ONE object, rewritten by request)
    cycle: cycleOf,
    // the ask (ask.js): `worked` — the items worked out so far (RN8); the stand's — its numbers by kind of quad, `why`:
    // the first reason every item of the last view was worked out
    asking: askView,
    // SH3: of the pages the cycle that ended last named of that sheet, how many are not in the cache now (those a view
    // at its bias's end has no room for are not waited for); a sheet no ask of that cycle named: 1 while its top is
    // not there
    missing(handle) {
      const c = sheets[handle];
      if (!c) throw new Error(`sheets.missing: no sheet ${handle}`);
      if (c.lastCycle !== cycle - 1) return topThere(c) ? 0 : 1;
      let n = 0;
      for (let k = 0; k < c.last.length; k++) { const rec = c.last[k]; if (rSheet[rec] === c.id && !(rState[rec] & (PAINTED | BLANK)) && rDeny[rec] !== weighNo) n++; }
      return n;
    },
    // SH4: from the top's mask (1 where its alpha is above 160 of 255); 0 until the top is there
    coverage(handle, u, v) {
      const c = sheets[handle];
      if (!c || !c.mask || !(u >= 0 && u <= 1 && v >= 0 && v <= 1)) return 0;
      return c.mask[Math.min(c.mh - 1, Math.floor(v * c.mh)) * c.mw + Math.min(c.mw - 1, Math.floor(u * c.mw))];
    },
    // SH5
    onArrive: null,
    get flying() { return flying; },
    // the pages that arrived and wait to be placed (a call not whole places host.pages of them)
    get arrived() { return arrivedRec.length - arrivedAt; },
    // SH9: the whole list rastered by a painter into w × h (rgba8, premultiplied linear stored sRGB-encoded — as the
    // sheets' pages are —, rows top first)
    picture(recording, w, h) {
      if (!recording.wired) throw new Error('sheets.picture: a recording made live from what the artist sent (Recording.fromWire)');
      let P = painters[0];
      for (const Q of painters) if (Q.busy < P.busy) P = Q;
      return new Promise((resolve, reject) => {
        const F = flight();
        F.job = ++jobNo; F.resolve = resolve; F.reject = reject;
        P.busy++;
        P.worker.postMessage({ t: 'picture', job: F.job, rec: recording.wired, w, h });
      });
    },
    // SH13
    whole(world) {
      const Q = world.quads, shown = world.nodes.shown;
      for (let q = 0; q < Q.n; q++) {
        if (!(Q.flags[q] & FLAG.SHOWN) || !shown[Q.node[q]] || Q.sheet[q] < 0) continue;
        const c = sheets[Q.sheet[q]];
        if (!c || !topThere(c)) return false;
      }
      return true;
    },
    solid(handle) {
      const c = sheets[handle];
      if (!c || !topThere(c)) return 1;
      return !c.hole ? 2 : c.opaque ? 1 : 0;
    },
    // whether its recording paints nothing at all (known from the recording itself, before any page is there)
    blank(handle) { const c = sheets[handle]; return !!c && c.rec.empty; },
    stamp(handle) { const c = sheets[handle]; return c ? c.stamp : 0; },
    stats() {
      let used = 0, pages = 0, records = nRecs - recFree.length, most = 0;
      for (let s = 0; s < nSlots; s++) if (slotShape[s] >= 0) used++;
      for (let rec = 0; rec < nRecs; rec++) if (rSheet[rec] >= 0 && (rState[rec] & PAINTED)) pages++;
      for (const view of views) if (view._.press > most) most = view._.press;
      // (jobs — among the counts: the painters' jobs answered; busy: each painter's busy ms, by its own clock — the
      // one array, counted only when the thread was mounted with the stand)
      return { sheets: nSheets - freeIds.length, layers, slots: nSlots, used, pages, records, flying, arrived: arrivedRec.length - arrivedAt, rows: T.table.capacity, bias: most, painters: painters.length, busy: busyMs, ...counts };
    },
    // SH14: the sheets' part of the `frame` bind group (4.2: bindings 4, 5, 6) — made again when `table.version`
    // is another (the table grown)
    table: T.table,
    bindings() {
      return [
        { binding: 4, resource: { buffer: T.table.buffer } },
        { binding: 5, resource: textureView },
        { binding: 6, resource: gpu.sampler('sheetSampler') },
      ];
    },
  };
  return api;
}
