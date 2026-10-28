// The land (5.6, 5.5; render/wgsl/land.js is its GPU side): the relief under the planes draped over it.
//   Heights: LAND.LEVELS nested levels of LAND.N × N points about an eye, the finest a cell of the land's own lattice
// (world/relief.js FINE — the points what stands on the land stands on), each next twice as coarse, as many as
// reach over the world. A level is tiles of LAND.TILE × TILE points, going round in its N × N as the eye moves; a
// tile — a NODE — is baked by the land function on the scene's thread, the coarsest level first, the nearest tile
// first: host.land a frame for each field — every one of the frame's field in a whole call. A tile is the same in
// every field (its level and its place say it): each field keeps the heights of the tiles it holds, and a field that
// lacks a tile another holds takes it — the kept heights written again, no call of the land function —, GIVEN a
// frame, before it bakes: a view ahead of a camera that stands where the frame's does has its field in a few frames,
// and two fields over the same land bake each tile once. A node's heights are the
// thread's data for a view, as pages are: they are baked under a cover too (RN4). A level tells the GPU the rect of
// its tiles that are there; what it lacks is read from the next; a field keeps how many tiles each of its levels
// lacks (what a shot's view that moves is judged by: its levels from the one it reads up — 2.3 step 4). A field
// keeps the least and the greatest height it
// has sampled: RENDER bounds what it draws and bakes by them (WT5: `relief.low` / `high` are of SCENE's field, which
// the levels reach past).
//   The shadow field: for each point, for each of up to two far lights, where the land's own rises put it in shadow —
// baked on the GPU by the `bake` pass, a tile a draw, host.field points a frame (every tile in a whole call; none
// under a cover: it is a pass of the world's); a tile is baked again when its heights were, or the light's way is
// another than the way the field was baked with — then the old bake stays readable until each tile is baked again,
// a round at a time (late, never wrong); with another LIGHT the old bake is nobody's and is not read.
//   A FIELD — heights, shadow and their uniform — is a view's (4.2: group 1, bindings 8–10): the frame's own (its
// mirrors' too), and one for every shot ahead while that shot lives — made with it, its nodes baked after the
// frame's, dropped with it. At a new shot the field nearest the new eye becomes the frame's. A world without land has
// the one empty field (1 × 1 textures, no levels) for every view.
//   Leaves: a quadtree over the world's square; a node of level j (LAND.LEAF cells of that level a side) is split
// while the eye is nearer than LAND.RHO of its sides. Where a leaf meets a coarser one the heights are the coarser
// level's by construction (render/wgsl/land.js e_reliefAt), so the mesh needs no stitching. Each draped quad is drawn
// over the leaves under it: a row of the leaves' table for each (quad, leaf) — the leaf's square and the quad's own
// mapping there, taken from place() (WT7) each frame — written to the GPU in a call that draws.
import { QUAD, FLAG, SHEET } from '../base.js';
import { FINE } from '../world/relief.js';
import { place } from '../world/place.js';
import { LAND } from './wgsl/land.js';
import { FORMATS } from './library.js';

// a draped quad's origin page is kept to every SNAP-th page under the eye's foot
const SNAP = 4;
const { N, TILE, LEVELS, LEAF, RHO } = LAND, TILES = N / TILE, SLOTS = TILES * TILES, ROOTS = 16;
// a tile's points; the most tiles a field takes from the others in a frame (a level's window: each a write of 4 KB)
const POINTS = TILE * TILE, GIVEN = SLOTS;
const mod = (a, b) => ((a % b) + b) % b;
// what a draped quad keeps of a frame (a row of numbers each): its row; its corner; the inverse of its mapping; its
// sheet's px; its bounds over the level; its origin page; its rows of the leaves (how many, the first)
const DRAPE = 17;

export function createLand(gpu, host, lib) {
  const B = GPUBufferUsage, T = GPUTextureUsage;
  let world = null, height = null, K = 0, current = null, shot = -1;
  // the fields of the shots ahead: each shot's entry of f.ahead, its field
  const shots = [], theirs = [];
  let leafCap = 1024, leafData = new Float32Array(leafCap * 16), leaves = gpu.buffer('leaves', leafCap * LAND.LEAF_BYTES, B.STORAGE | B.COPY_DST), leafN = 0, bind = null, bindOf = null;
  let drapes = new Float64Array(DRAPE * 64), drapeN = 0, drapeOf = new Int32Array(0), bakes = [];
  // the shadow's tiles to bake in this call (level, x, z each); the far lights now (their rows of the world, their ways)
  let due = new Int32Array(3 * 64), dueN = 0;
  const ways = new Float32Array(8), lit = new Int32Array(2);
  const P = [new Float64Array(3), new Float64Array(3), new Float64Array(3)], stack = new Int32Array(4 * 4096), range = [0, 0], bakeData = new Float32Array(16);
  // (a tile's write: where to, from where in the field's kept heights, how large — the same three objects each time)
  const tileTo = { texture: null, origin: [0, 0] }, tileFrom = { offset: 0, bytesPerRow: TILE * 4 }, tileSize = [TILE, TILE];
  const bakePipe = lib.get('bake');
  // (lacks: how many tiles the frame's field still lacks — its nodes, and, with a far light, its shadow's)
  const Ld = { whole: true, lacks: 0, group: 0, bind: null, bakeDue: false, waiting: false, field: null, tall: 0 };
  // a tile's shadow: none; baked for the field's lights as they are; baked for another way of them (read until it is
  // baked again)
  const BARE = 0, BAKED = 1, OLD = 2;

  function makeField(size, levels) {
    const F = {
      heights: gpu.texture('land heights', { size, format: FORMATS.HEIGHTS, usage: T.TEXTURE_BINDING | T.COPY_DST }),
      shadow: gpu.texture('land shadow', { size, format: FORMATS.LAND_SHADOW, usage: T.TEXTURE_BINDING | T.RENDER_ATTACHMENT }),
      uniform: gpu.buffer('land', LAND.BYTES, B.UNIFORM | B.COPY_DST), data: new ArrayBuffer(LAND.BYTES), sent: new Uint32Array(LAND.BYTES / 4), written: false,
      // a level: its window's first tile; for each slot the tile it holds, its shadow (BARE, BAKED, OLD), the least
      // and the greatest of its heights; the rects (tiles) of what is there and of what is shadowed
      levels: Array.from({ length: levels }, () => ({ wx: 0, wz: 0, tx: new Int32Array(SLOTS), tz: new Int32Array(SLOTS), has: new Uint8Array(SLOTS), shade: new Uint8Array(SLOTS), low: new Float64Array(SLOTS), high: new Float64Array(SLOTS), have: new Int32Array(4), lit: new Int32Array(4) })),
      // the heights of the tiles it holds, as its texture has them: a level after a level, a slot after a slot
      kept: new Float32Array(levels * SLOTS * POINTS),
      // the eye it is about; whether a window of it moved as it was last placed; whether every tile of every window
      // is there, and how many each level lacks; the far lights its shadow is baked with; the least and the greatest
      // height sampled for it
      eye: new Float64Array(2), entered: false, whole: false, lack: new Int32Array(levels), ways: new Float32Array(8), lit: new Int32Array(2).fill(-1), low: Infinity, high: -Infinity,
    };
    F.f32 = new Float32Array(F.data); F.i32 = new Int32Array(F.data); F.u32 = new Uint32Array(F.data);
    F.hv = F.heights.createView(); F.sv = F.shadow.createView();
    return F;
  }
  const dropField = F => { gpu.drop(F.heights); gpu.drop(F.shadow); gpu.drop(F.uniform); };
  // the field of every view of a world without land: no levels, no light
  const none = makeField([1, 1], 0);
  none.i32[LAND.LIGHTS / 4] = -1; none.i32[LAND.LIGHTS / 4 + 1] = -1;
  gpu.write(none.uniform, 0, none.data);
  Ld.field = none;

  const slotOf = (tx, tz) => mod(tz, TILES) * TILES + mod(tx, TILES);
  const holds = (V, tx, tz) => { const s = slotOf(tx, tz); return V.has[s] === 1 && V.tx[s] === tx && V.tz[s] === tz; };
  const shaded = (V, tx, tz) => holds(V, tx, tz) && V.shade[slotOf(tx, tz)] !== BARE;
  // whether `ok` holds of every tile of a row (z; x from a to b) or of a column (x; z from a to b) of a level
  const rowOk = (V, ok, z, a, b) => { for (let x = a; x < b; x++) if (!ok(V, x, z)) return false; return true; };
  const colOk = (V, ok, x, a, b) => { for (let z = a; z < b; z++) if (!ok(V, x, z)) return false; return true; };
  // the largest rect of tiles about the window's middle that `ok` holds of every tile → out (x0, z0, x1, z1; empty: x1 = x0)
  function rectOf(V, ok, out) {
    let x0 = V.wx + TILES / 2 - 1, z0 = V.wz + TILES / 2 - 1, x1 = x0 + 2, z1 = z0 + 2;
    for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) if (!ok(V, x, z)) { out[0] = out[2] = V.wx; out[1] = out[3] = V.wz; return; }
    for (let grew = true; grew;) {
      grew = false;
      if (x0 > V.wx && colOk(V, ok, x0 - 1, z0, z1)) { x0--; grew = true; }
      if (x1 < V.wx + TILES && colOk(V, ok, x1, z0, z1)) { x1++; grew = true; }
      if (z0 > V.wz && rowOk(V, ok, z0 - 1, x0, x1)) { z0--; grew = true; }
      if (z1 < V.wz + TILES && rowOk(V, ok, z1, x0, x1)) { z1++; grew = true; }
    }
    out[0] = x0; out[1] = z0; out[2] = x1; out[3] = z1;
  }

  // a field placed about an eye: each level's window (F.entered: a window is another than it was — tiles enter it)
  function placeField(F, ex, ez) {
    F.eye[0] = ex; F.eye[1] = ez;
    F.entered = false;
    for (let k = 0; k < K; k++) {
      const V = F.levels[k], ts = TILE * FINE * 2 ** k, wx = Math.floor(ex / ts + 0.5) - TILES / 2, wz = Math.floor(ez / ts + 0.5) - TILES / 2;
      if (wx !== V.wx || wz !== V.wz) { V.wx = wx; V.wz = wz; F.entered = true; }
    }
  }
  // a tile's heights in a field's kept ones (level k, slot s) are the tile (tx, tz)'s from now: written to its
  // texture, the field's least and greatest height widened by them, its shadow to be baked
  function holdNode(F, k, s, tx, tz) {
    const V = F.levels[k];
    tileTo.texture = F.heights; tileTo.origin[0] = (s % TILES) * TILE; tileTo.origin[1] = k * N + Math.floor(s / TILES) * TILE;
    tileFrom.offset = (k * SLOTS + s) * POINTS * 4;
    gpu.queue.writeTexture(tileTo, F.kept, tileFrom, tileSize);
    if (V.low[s] < F.low) F.low = V.low[s];
    if (V.high[s] > F.high) F.high = V.high[s];
    V.tx[s] = tx; V.tz[s] = tz; V.has[s] = 1; V.shade[s] = BARE;
  }
  // the field other than F that holds a tile of level k — the frame's, a shot's ahead —, or null
  function holderOf(F, k, tx, tz) {
    if (current !== F && holds(current.levels[k], tx, tz)) return current;
    for (let i = 0; i < theirs.length; i++) if (theirs[i] !== F && holds(theirs[i].levels[k], tx, tz)) return theirs[i];
    return null;
  }
  // the tiles a field lacks that another field holds, taken — `most` at the most, the coarsest level first: the kept
  // heights copied, no call of the land function
  function takeNodes(F, most) {
    for (let k = K - 1; k >= 0 && most > 0; k--) {
      const V = F.levels[k];
      for (let z = V.wz; z < V.wz + TILES && most > 0; z++) for (let x = V.wx; x < V.wx + TILES && most > 0; x++) {
        if (holds(V, x, z)) continue;
        const G = holderOf(F, k, x, z);
        if (!G) continue;
        const s = slotOf(x, z), at = (k * SLOTS + s) * POINTS, mine = F.kept, its = G.kept;
        for (let i = at; i < at + POINTS; i++) mine[i] = its[i];
        V.low[s] = G.levels[k].low[s]; V.high[s] = G.levels[k].high[s];
        holdNode(F, k, s, x, z);
        most--;
      }
    }
  }
  // the next tile a field lacks — the coarsest level first, the nearest the eye — baked; → false: it lacks none
  function bakeNode(F) {
    for (let k = K - 1; k >= 0; k--) {
      const V = F.levels[k], c = FINE * 2 ** k, ts = TILE * c;
      let best = -1, bx = 0, bz = 0, near = Infinity;
      for (let z = V.wz; z < V.wz + TILES; z++) for (let x = V.wx; x < V.wx + TILES; x++) {
        if (holds(V, x, z)) continue;
        const d = Math.sqrt(((x + 0.5) * ts - F.eye[0]) ** 2 + ((z + 0.5) * ts - F.eye[1]) ** 2);
        if (d < near) { near = d; best = slotOf(x, z); bx = x; bz = z; }
      }
      if (best < 0) continue;
      const at = (k * SLOTS + best) * POINTS, kept = F.kept;
      let low = Infinity, high = -Infinity;
      for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) {
        const y = height((bx * TILE + i) * c, -(bz * TILE + j) * c);
        kept[at + j * TILE + i] = y;
        if (y < low) low = y;
        if (y > high) high = y;
      }
      V.low[best] = low; V.high[best] = high;
      holdNode(F, k, best, bx, bz);
      return true;
    }
    return false;
  }
  // a field's uniform: each level's rects, the eye its levels are about, the lights its shadow is of — written where
  // it changed
  function writeField(F, O, lights) {
    const f = F.f32, i = F.i32;
    F.whole = true;
    for (let k = 0; k < K; k++) {
      const V = F.levels[k], c = FINE * 2 ** k, o = k * 12;
      rectOf(V, holds, V.have); rectOf(V, shaded, V.lit);
      let lack = 0;
      for (let z = V.wz; z < V.wz + TILES; z++) for (let x = V.wx; x < V.wx + TILES; x++) if (!holds(V, x, z)) lack++;
      F.lack[k] = lack;
      if (lack) F.whole = false;
      f[o] = V.have[0] * TILE * c - O[0]; f[o + 1] = V.have[1] * TILE * c - O[2]; f[o + 2] = c; f[o + 3] = 0;
      i[o + 4] = mod(V.have[0], TILES) * TILE; i[o + 5] = mod(V.have[1], TILES) * TILE; i[o + 6] = (V.have[2] - V.have[0]) * TILE; i[o + 7] = (V.have[3] - V.have[1]) * TILE;
      const none_ = V.lit[2] === V.lit[0] || V.lit[0] < V.have[0] || V.lit[1] < V.have[1];
      i[o + 8] = none_ ? 0 : (V.lit[0] - V.have[0]) * TILE; i[o + 9] = none_ ? 0 : (V.lit[1] - V.have[1]) * TILE;
      i[o + 10] = none_ ? 0 : (V.lit[2] - V.lit[0]) * TILE; i[o + 11] = none_ ? 0 : (V.lit[3] - V.lit[1]) * TILE;
    }
    const e = LAND.EYE / 4;
    f[e] = F.eye[0] - O[0]; f[e + 1] = F.eye[1] - O[2]; f[e + 2] = RHO * LEAF * FINE; f[e + 3] = K;
    i[e + 4] = F.lit[0] >= 0 ? lights.rowOf[F.lit[0]] : -1; i[e + 5] = F.lit[1] >= 0 ? lights.rowOf[F.lit[1]] : -1; i[e + 6] = -1; i[e + 7] = -1;
    // (the lights' discs: half a degree of sky — how soft the land's shadow grows with the distance of what casts it)
    f[e + 8] = 0.0087; f[e + 9] = 0.0087;
    let same = F.written;
    for (let k = 0; same && k < F.u32.length; k++) if (F.u32[k] !== F.sent[k]) same = false;
    if (same) return;
    F.sent.set(F.u32); F.written = true;
    gpu.write(F.uniform, 0, F.data);
  }
  // how many of the tiles a field holds have not their shadow baked for the field's lights as they are
  function unbaked(F) {
    let n = 0;
    for (let k = 0; k < K; k++) {
      const V = F.levels[k];
      for (let z = V.wz; z < V.wz + TILES; z++) for (let x = V.wx; x < V.wx + TILES; x++) if (holds(V, x, z) && V.shade[slotOf(x, z)] !== BAKED) n++;
    }
    return n;
  }
  // The shadow of a field against the far lights now (n of them: `lit`, `ways`). Another light: the bake is nobody's —
  // every tile's shadow anew, none read meanwhile. The same lights another way: a round begins — every tile is to be
  // baked again for that way, and is read as it is until then; a round that is under way is finished first (the way
  // may turn every frame: the field follows it a round late, never half one way and for ever) — but in a call that
  // bakes everything (all), which begins it at once
  function relit(F, n, all) {
    let other = false, turned = false;
    for (let k = 0; k < 2; k++) {
      if (F.lit[k] !== (k < n ? lit[k] : -1)) other = true;
      if (k < n) for (let a = 0; a < 3; a++) if (Math.abs(F.ways[4 * k + a] - ways[4 * k + a]) > 1e-4) turned = true;
    }
    if (other) {
      for (let k = 0; k < 2; k++) F.lit[k] = k < n ? lit[k] : -1;
      F.ways.set(ways);
      for (let k = 0; k < F.levels.length; k++) F.levels[k].shade.fill(BARE);
    } else if (turned && (all || !unbaked(F))) {
      F.ways.set(ways);
      for (let k = 0; k < F.levels.length; k++) { const V = F.levels[k]; for (let s = 0; s < SLOTS; s++) if (V.shade[s] === BAKED) V.shade[s] = OLD; }
    }
  }

  const fieldOf = A => theirs[shots.indexOf(A)];
  // a shot's field let go — its place among the shots closed up
  function forget(k) {
    for (let j = k; j + 1 < shots.length; j++) { shots[j] = shots[j + 1]; theirs[j] = theirs[j + 1]; }
    shots.pop(); theirs.pop();
  }

  // a world's land. What the world before had is let go: its fields, the bake's uniforms
  Ld.build = w => {
    if (current) dropField(current);
    for (const F of theirs) dropField(F);
    for (const b of bakes) gpu.drop(b.buffer);
    shots.length = 0; theirs.length = 0; bakes = []; current = null; drapeN = 0; leafN = 0; dueN = 0; shot = -1;
    world = w; height = null; K = 0;
    Ld.bind = null; Ld.group = 0; Ld.field = none; Ld.whole = true; Ld.lacks = 0; Ld.bakeDue = false; Ld.waiting = false; Ld.tall = 0;
    if (!w.relief) return;
    height = w.relief.height;
    const b = w.bounds, extent = Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2], 50) + 100;
    K = Math.min(LEVELS, Math.max(6, Math.ceil(Math.log2(extent / (LEAF * FINE))) + 2));
    current = makeField([N, N * LEVELS], LEVELS);
    Ld.field = current;
  };

  // The frame's part. f: RN4's record; lights: the lit set; hidden: nothing of the world is drawn (a solid insert
  // covers the stage) — no tile of the shadow is baked then: the nodes are, as always; all: a whole call's work —
  // every node of the frame's field, every tile of its shadow (f.whole; the call in which a cover lifts). → Ld.whole:
  // the land has what the frame's view draws; Ld.field: the frame's; Ld.bakeDue: tiles of its shadow are to be baked
  // in this call; Ld.waiting: something is still to be baked; Ld.tall: how far up and down the land goes
  Ld.frame = (f, lights, hidden, all) => {
    if (!current) return;
    const O = world.origin, eye = f.camera.eye, Lt = world.lights;
    // at a new shot: the field nearest the new eye is the frame's
    if (f.shot !== shot) {
      shot = f.shot;
      let best = -1, near = Math.sqrt((current.eye[0] - eye[0]) ** 2 + (current.eye[1] - eye[2]) ** 2);
      for (let k = 0; k < theirs.length; k++) { const F = theirs[k], d = Math.sqrt((F.eye[0] - eye[0]) ** 2 + (F.eye[1] - eye[2]) ** 2); if (d < near) { near = d; best = k; } }
      if (best >= 0) { dropField(current); current = theirs[best]; forget(best); }
    }
    // a field for every shot ahead; those of shots that ended are dropped
    for (let k = shots.length - 1; k >= 0; k--) if (f.ahead.indexOf(shots[k]) < 0) { dropField(theirs[k]); forget(k); }
    placeField(current, eye[0], eye[2]);
    for (let a = 0; a < f.ahead.length; a++) {
      const A = f.ahead[a];
      if (shots.indexOf(A) < 0) { shots.push(A); theirs.push(makeField([N, N * LEVELS], LEVELS)); }
      placeField(fieldOf(A), A.camera.eye[0], A.camera.eye[2]);
    }
    // the far lights whose shadow is baked: the first two that shine
    let n = 0;
    for (let i = 0; i < Lt.n && n < 2; i++) if (Lt.kind[i] === 0 && Lt.strength[i] > 0 && lights.rowOf[i] >= 0) {
      lit[n] = i; ways[4 * n] = Lt.way[3 * i]; ways[4 * n + 1] = Lt.way[3 * i + 1]; ways[4 * n + 2] = Lt.way[3 * i + 2]; ways[4 * n + 3] = 1;
      n++;
    }
    for (let k = n; k < 2; k++) { lit[k] = -1; ways[4 * k] = ways[4 * k + 1] = ways[4 * k + 2] = ways[4 * k + 3] = 0; }
    relit(current, n, all);
    // nodes: each field takes what another holds (so what one has just baked no other bakes), then bakes by a ration
    // of its own — the frame's every one in a whole call's work
    takeNodes(current, all ? Infinity : GIVEN);
    for (let left = all ? Infinity : host.land; left > 0 && bakeNode(current); left--);
    for (let a = 0; a < f.ahead.length; a++) {
      const F = fieldOf(f.ahead[a]);
      takeNodes(F, GIVEN);
      for (let left = host.land; left > 0 && bakeNode(F); left--);
    }
    // how far up and down the land goes: by every height sampled, of every field
    let low = current.low, high = current.high;
    for (let k = 0; k < theirs.length; k++) { const F = theirs[k]; if (F.low < low) low = F.low; if (F.high > high) high = F.high; }
    Ld.tall = high > low ? high - low : 0;
    dueN = 0;
    if (!hidden && n) {
      // the shadow's tiles due — of the frame's field (a field ahead's are baked when it is the frame's: in the whole
      // frame of its cut)
      let tiles = all ? Infinity : Math.max(1, Math.floor(host.field / (TILE * TILE)));
      for (let k = K - 1; k >= 0 && tiles > 0; k--) {
        const V = current.levels[k];
        for (let z = V.wz; z < V.wz + TILES && tiles > 0; z++) for (let x = V.wx; x < V.wx + TILES && tiles > 0; x++) {
          if (!holds(V, x, z) || V.shade[slotOf(x, z)] === BAKED) continue;
          if (3 * dueN === due.length) { const more = new Int32Array(2 * due.length); more.set(due); due = more; }
          due[3 * dueN] = k; due[3 * dueN + 1] = x; due[3 * dueN + 2] = z; dueN++;
          V.shade[slotOf(x, z)] = BAKED; tiles--;
        }
      }
    }
    Ld.bakeDue = dueN > 0;
    writeField(current, O, lights);
    for (let a = 0; a < f.ahead.length; a++) writeField(fieldOf(f.ahead[a]), O, lights);
    // (the land has what the frame's view draws: every node, and — with a far light — every tile's shadow as the
    // light stands)
    const dark = n ? unbaked(current) : 0, shadowed = !dark;
    let nodes = 0;
    for (let k = 0; k < K; k++) nodes += current.lack[k];
    Ld.lacks = nodes + dark;
    Ld.whole = current.whole && shadowed;
    // (rationed work waiting: a node not yet baked — the frame's field's, a shot's ahead —, a tile of the shadow —
    // which under a cover is not work waiting: RN4)
    Ld.waiting = !current.whole || (!hidden && !shadowed);
    for (let a = 0; a < f.ahead.length; a++) if (!fieldOf(f.ahead[a]).whole) Ld.waiting = true;
    Ld.field = current;
    leavesOf(eye, O);
    if (bindOf !== leaves) { bindOf = leaves; bind = gpu.bind('land', [{ binding: 0, resource: { buffer: leaves } }]); }
    Ld.bind = bind;
  };
  // How many tiles of a shot's field are lacking at its levels from `level` up (a world without land: none): a view
  // that stands needs every level (level 0); one that moves, its levels from the one it reads. Whether tiles entered
  // its field in this call (a window of it moved). Whether it has its coarsest level whole
  Ld.aheadLack = (A, level) => {
    if (!current) return 0;
    const F = fieldOf(A);
    let n = 0;
    for (let k = Math.min(level, K - 1); k < K; k++) n += F.lack[k];
    return n;
  };
  Ld.aheadEntered = A => !!current && fieldOf(A).entered;
  Ld.aheadCoarsest = A => !current || fieldOf(A).lack[K - 1] === 0;
  // whether the land's own shadow falls on the scene now (it varies across what is lit: render/quads.js)
  Ld.shades = () => !!current && lit[0] >= 0;

  // the bake pass's draws: each tile due marched for both lights (render/wgsl/land.js); its target the frame's
  // field's shadow, kept (load → store), a viewport a tile
  Ld.bakeTarget = () => current.sv;
  Ld.bake = pass => {
    const F = current, O = world.origin;
    pass.setPipeline(bakePipe);
    for (let t = 0; t < dueN; t++) {
      const k = due[3 * t], x = due[3 * t + 1], z = due[3 * t + 2], c = FINE * 2 ** k, s = slotOf(x, z), tx = (s % TILES) * TILE, ty = k * N + Math.floor(s / TILES) * TILE;
      let b = bakes[t];
      if (!b) b = bakes[t] = { buffer: gpu.buffer('bake', 64, B.UNIFORM | B.COPY_DST), field: null, group: null };
      if (b.field !== F) { b.field = F; b.group = gpu.bind('bake', [{ binding: 0, resource: { buffer: F.uniform } }, { binding: 1, resource: F.hv }, { binding: 2, resource: { buffer: b.buffer } }]); }
      bakeData[0] = x * TILE * c - O[0]; bakeData[1] = z * TILE * c - O[2]; bakeData[2] = c; bakeData[3] = k;
      bakeData[4] = tx; bakeData[5] = ty; bakeData[6] = F.high; bakeData[7] = 0;
      bakeData.set(F.ways, 8);
      gpu.write(b.buffer, 0, bakeData);
      pass.setBindGroup(0, b.group);
      pass.setViewport(tx, ty, TILE, TILE, 0, 1);
      pass.setScissorRect(tx, ty, TILE, TILE);
      pass.draw(3);
    }
    dueN = 0;
    Ld.bakeDue = false;
  };

  // the leaves under each draped quad shown → rows of the leaves' table (kept here; Ld.write sends them)
  function leavesOf(eye, O) {
    // (the leaves' middle height: of the heights sampled for the frame's field — none yet: the level)
    const Q = world.quads, some = current.high >= current.low, low = some ? current.low : 0, high = some ? current.high : 0;
    drapeN = 0; leafN = 0;
    if (drapeOf.length < Q.cap) drapeOf = new Int32Array(Q.cap);
    for (let q = 0; q < Q.n; q++) {
      drapeOf[q] = -1;
      if (Q.kind[q] !== QUAD.DRAPE || !(Q.flags[q] & FLAG.SHOWN) || Q.flags[q] & FLAG.CUT_ONLY || Q.sheet[q] < 0 || !world.nodes.shown[Q.node[q]]) continue;
      // (its mapping, from SCENE's: the corners of its rect placed — uv to the level is affine)
      const R = Q.rect, r = 4 * q, l = R[r], t = R[r + 1], wd = R[r + 2] - l, hd = R[r + 3] - t;
      for (let k = 0; k < 3; k++) { P[k][0] = k === 1 ? l + wd : l; P[k][1] = k === 2 ? t + hd : t; P[k][2] = 0; place(world, q, P[k]); }
      const ux = P[1][0] - P[0][0], uz = P[1][2] - P[0][2], vx = P[2][0] - P[0][0], vz = P[2][2] - P[0][2], det = ux * vz - uz * vx;
      if (Math.abs(det) < 1e-12) continue;
      if (DRAPE * (drapeN + 1) > drapes.length) { const more = new Float64Array(2 * drapes.length); more.set(drapes); drapes = more; }
      const D = drapes, d = DRAPE * drapeN, ax = P[0][0], az = P[0][2], ix = vz / det, iz = -vx / det, jx = -uz / det, jz = ux / det, pw = wd * SHEET.MAX_PPM, ph = hd * SHEET.MAX_PPM;
      D[d] = q; D[d + 1] = ax; D[d + 2] = az; D[d + 3] = ix; D[d + 4] = iz; D[d + 5] = jx; D[d + 6] = jz; D[d + 7] = pw; D[d + 8] = ph;
      D[d + 9] = Math.min(ax, ax + ux, ax + vx, ax + ux + vx); D[d + 10] = Math.max(ax, ax + ux, ax + vx, ax + ux + vx);
      D[d + 11] = Math.min(az, az + uz, az + vz, az + uz + vz); D[d + 12] = Math.max(az, az + uz, az + vz, az + uz + vz);
      // (its origin page: the page under the eye's foot on it, every SNAP-th)
      const eu = Math.min(1, Math.max(0, (eye[0] - ax) * ix + (eye[2] - az) * iz)), ev = Math.min(1, Math.max(0, (eye[0] - ax) * jx + (eye[2] - az) * jz));
      D[d + 13] = Math.round(eu * pw / SHEET.PAGE / SNAP) * SNAP; D[d + 14] = Math.round(ev * ph / SHEET.PAGE / SNAP) * SNAP;
      drapeOf[q] = drapeN++;
    }
    if (!drapeN) return;
    // the tree: the world's square as root nodes of the top level — no more than ROOTS each way, those about the eye;
    // a node nearer the eye than RHO of its sides split
    const top = K - 2, size0 = LEAF * FINE * 2 ** top, b = world.bounds, ex = Math.floor(eye[0] / size0), ez = Math.floor(eye[2] / size0);
    const rx0 = Math.max(Math.floor(Math.min(b.min[0], eye[0]) / size0), ex - ROOTS / 2), rx1 = Math.min(Math.floor(Math.max(b.max[0], eye[0]) / size0), ex + ROOTS / 2 - 1);
    const rz0 = Math.max(Math.floor(Math.min(b.min[2], eye[2]) / size0), ez - ROOTS / 2), rz1 = Math.min(Math.floor(Math.max(b.max[2], eye[2]) / size0), ez + ROOTS / 2 - 1);
    for (let n = 0; n < drapeN; n++) {
      const D = drapes, d = DRAPE * n, first = leafN;
      let sp = 0;
      for (let z = rz0; z <= rz1; z++) for (let x = rx0; x <= rx1; x++) { stack[sp++] = top; stack[sp++] = x; stack[sp++] = z; }
      while (sp > 0) {
        const z = stack[--sp], x = stack[--sp], j = stack[--sp], s = LEAF * FINE * 2 ** j, x0 = x * s, z0 = z * s;
        if (x0 > D[d + 10] || x0 + s < D[d + 9] || z0 > D[d + 12] || z0 + s < D[d + 11]) continue;
        const dx = Math.max(x0 - eye[0], 0, eye[0] - x0 - s), dz = Math.max(z0 - eye[2], 0, eye[2] - z0 - s);
        if (j > 0 && Math.sqrt(dx ** 2 + dz ** 2) < RHO * s && sp + 12 <= stack.length) {
          for (let c = 0; c < 4; c++) { stack[sp++] = j - 1; stack[sp++] = 2 * x + (c & 1); stack[sp++] = 2 * z + (c >> 1); }
          continue;
        }
        if (leafN === leafCap) {
          leafCap *= 2;
          const more = new Float32Array(leafCap * 16); more.set(leafData); leafData = more;
          gpu.drop(leaves); leaves = gpu.buffer('leaves', leafCap * LAND.LEAF_BYTES, B.STORAGE | B.COPY_DST);
        }
        const o = 16 * leafN++, u0 = (x0 - D[d + 1]) * D[d + 3] + (z0 - D[d + 2]) * D[d + 4], v0 = (x0 - D[d + 1]) * D[d + 5] + (z0 - D[d + 2]) * D[d + 6];
        leafData[o] = x0 - O[0]; leafData[o + 1] = z0 - O[2]; leafData[o + 2] = s; leafData[o + 3] = j;
        leafData[o + 4] = u0; leafData[o + 5] = v0; leafData[o + 6] = u0 * D[d + 7] - D[d + 13] * SHEET.PAGE; leafData[o + 7] = v0 * D[d + 8] - D[d + 14] * SHEET.PAGE;
        leafData[o + 8] = D[d + 3]; leafData[o + 9] = D[d + 5]; leafData[o + 10] = D[d + 4]; leafData[o + 11] = D[d + 6];
        leafData[o + 12] = D[d + 7]; leafData[o + 13] = D[d + 8]; leafData[o + 14] = n; leafData[o + 15] = 0.5 * (low + high);
      }
      D[d + 15] = leafN - first; D[d + 16] = first;
    }
  }
  // the leaves' rows to the GPU — in a call that draws
  Ld.write = () => { if (leafN) gpu.write(leaves, 0, leafData, 0, 16 * leafN); };
  // a draped quad's rows of the leaves (first, count); a row's sphere (the world's); a row's quad's origin page → out
  Ld.rowsOf = q => { const n = q < drapeOf.length ? drapeOf[q] : -1; range[0] = n < 0 ? 0 : drapes[DRAPE * n + 16]; range[1] = n < 0 ? 0 : drapes[DRAPE * n + 15]; return range; };
  Ld.sphere = (row, out) => {
    const o = 16 * row, s = leafData[o + 2], O = world.origin;
    out[0] = leafData[o] + O[0] + 0.5 * s; out[1] = leafData[o + 15]; out[2] = leafData[o + 1] + O[2] + 0.5 * s; out[3] = Math.sqrt((0.7072 * s) ** 2 + (0.5 * Ld.tall) ** 2) + 1;
    return out;
  };
  Ld.page = (row, out) => { const d = DRAPE * leafData[16 * row + 14]; out[0] = drapes[d + 13]; out[1] = drapes[d + 14]; };
  return Ld;
}
