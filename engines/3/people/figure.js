// A figure on the GPU. What the people of one device share — the bones' table and the morphs' (GP2), the buffer of
// the persons' uniforms, the two bind groups (person.wgsl.js) — and the models: a look's model (shapes.js) with its
// vertex buffers, made once and held by everyone who looks so, in this scene and in the one shown after it (the same
// scene shown again finds its people's models: 2.9). A person wearing a model takes a block of the bones' rows and has
// their own of what is moved point by point.
//   storeOf(gpu) → the store: { bones, morphs, persons, group(), person() }
//   modelOf(store, look, cast, make) → a held model G (made if nobody holds one — make() → the look's model,
//     shapes.js's: a slice of work, never in a tick; G.asked: the parts asked of it and not made yet — people.js's);
//     letGo(store, G); partOf(store, G, name, made) → a part they come to have with them (made: the model's
//     part(name), or null — there is none), with its buffers
//   worn(store, G) → a wearing W of it: { G, I (shapes.js: a person's own), bones (their first row), carried, draws };
//     carry(store, W, names) — the parts they have with them now (all made); taken(store, W) — back
//   upload(store, W) → whether anything of theirs changed on the GPU: their rows against the table's (marked where
//     another), what was moved point by point
//   block(store) / unblock(store, at) — a person's block of the uniforms; header(store, at) / palette(store, at) —
//     written from the mirror
import { J } from './rig.js';
import { verticesOf, normalsInto } from './shapes.js';
import { PERSON, PAINTED, BONE_BYTES, MORPH_BYTES, COLOURS } from './person.wgsl.js';

const KINDS = { skin: 0, tubes: 1, cloth: 2, face: 3 };
const stores = new WeakMap();
// each cast (a scene's module: the same module, the same object) by a number of its own, for as long as it is
const casts = new WeakMap();
let castCount = 0;
const castOf = c => { let n = casts.get(c); if (n === undefined) casts.set(c, n = ++castCount); return n; };

// rows of a table taken and given back. free: the stretches given back, in the table's order, no two touching. Taken:
// from the first of them that is long enough (what is left of it stays free); else from the end (the table grown to
// hold it — at a build, never in a tick). Given back: joined with the free stretches it touches
const pool = table => ({ table, used: 0, free: [] });
function take(P, n) {
  const i = P.free.findIndex(f => f.n >= n);
  if (i >= 0) {
    const f = P.free[i], at = f.at;
    if (f.n === n) P.free.splice(i, 1); else { f.at += n; f.n -= n; }
    return at;
  }
  if (P.used + n > P.table.capacity) P.table.grow(Math.max(P.table.capacity * 2, P.used + n));
  const at = P.used;
  P.used += n;
  return at;
}
function give(P, at, n) {
  if (n <= 0) return;
  const free = P.free;
  let i = 0;
  while (i < free.length && free[i].at < at) i++;
  const before = free[i - 1], after = free[i];
  if (before && before.at + before.n === at) {
    before.n += n;
    if (after && at + n === after.at) { before.n += after.n; free.splice(i, 1); }
  } else if (after && at + n === after.at) { after.at = at; after.n += n; } else free.splice(i, 0, { at, n });
}

export function storeOf(gpu) {
  let S = stores.get(gpu);
  if (S) return S;
  const persons = { buffer: null, bytes: null, f32: null, u32: null, capacity: 0, used: 0, free: [] };
  const sized = capacity => {
    const bytes = new ArrayBuffer(capacity * PERSON.BLOCK);
    if (persons.bytes) new Uint8Array(bytes).set(new Uint8Array(persons.bytes));
    if (persons.buffer) gpu.drop(persons.buffer);
    Object.assign(persons, { buffer: gpu.buffer('persons', bytes.byteLength, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST), bytes, f32: new Float32Array(bytes), u32: new Uint32Array(bytes), capacity });
    if (persons.used) gpu.write(persons.buffer, 0, bytes, 0, persons.used * PERSON.BLOCK);
    S.one = null;
  };
  S = { gpu, bones: pool(gpu.table('bones', { stride: BONE_BYTES, capacity: 2048 })), morphs: pool(gpu.table('morphs', { stride: MORPH_BYTES, capacity: 1024 })), persons, sized,
    models: new Map(), all: null, versions: [-1, -1], one: null,
    // group 2: the bones and the morphs (made again when either table was grown); group 3: a person's uniform
    group() {
      const b = S.bones.table, m = S.morphs.table;
      if (!S.all || S.versions[0] !== b.version || S.versions[1] !== m.version) {
        S.all = gpu.bind('people', [{ binding: 0, resource: { buffer: b.buffer } }, { binding: 1, resource: { buffer: m.buffer } }]);
        S.versions[0] = b.version; S.versions[1] = m.version;
      }
      return S.all;
    },
    person() { return (S.one ??= gpu.bind('person', [{ binding: 0, resource: { buffer: persons.buffer, offset: 0, size: PERSON.BYTES } }])); },
  };
  sized(32);
  stores.set(gpu, S);
  return S;
}

// a person's block of the uniforms (its number: its place is that many blocks in)
export function block(S) {
  const P = S.persons;
  if (P.free.length) return P.free.pop();
  if (P.used === P.capacity) S.sized(P.capacity * 2);
  return P.used++;
}
export function unblock(S, at) { S.persons.free.push(at); }
export const header = (S, at) => S.gpu.write(S.persons.buffer, at * PERSON.BLOCK, S.persons.bytes, at * PERSON.BLOCK, PERSON.PALETTE);
export const palette = (S, at) => S.gpu.write(S.persons.buffer, at * PERSON.BLOCK + PERSON.PALETTE, S.persons.bytes, at * PERSON.BLOCK + PERSON.PALETTE, COLOURS * 16);

// ── a mesh's buffers ───────────────────────────────────────────────────
const made = (gpu, name, data, usage) => { const b = gpu.buffer(name, data.byteLength, usage | GPUBufferUsage.COPY_DST); gpu.write(b, 0, data); return b; };
// (a vertex's weights as bytes that sum to 255: the largest takes what rounding left)
function weighed(w, o, out, at) {
  let sum = 0, most = 0;
  for (let k = 0; k < 4; k++) { const v = Math.max(0, Math.min(255, Math.round(w[o + k] * 255))); out[at + k] = v; sum += v; if (w[o + k] > w[o + most]) most = k; }
  out[at + most] = Math.max(0, Math.min(255, out[at + most] + 255 - sum));
}
// where each vertex is and how it faces, one after the other (a skinned mesh's first buffer)
function placed(p, n) {
  const out = new Float32Array(p.length * 2);
  for (let v = 0, c = p.length / 3; v < c; v++) { const a = v * 3, o = v * 6; out[o] = p[a]; out[o + 1] = p[a + 1]; out[o + 2] = p[a + 2]; out[o + 3] = n[a]; out[o + 4] = n[a + 1]; out[o + 5] = n[a + 2]; }
  return out;
}
// what never changes of a skinned vertex: its rows, their weights, its colour and whether it is lit smoothly — and a
// face's: its number among the face's (its morphs' rows)
function held(S, face) {
  const count = S.c.length, stride = face ? 20 : 16, bytes = new ArrayBuffer(count * stride), u16 = new Uint16Array(bytes), u8 = new Uint8Array(bytes), u32 = new Uint32Array(bytes);
  for (let v = 0; v < count; v++) {
    const o = v * stride;
    for (let k = 0; k < 4; k++) u16[o / 2 + k] = S.j[v * 4 + k];
    weighed(S.w, v * 4, u8, o + 8);
    u8[o + 12] = S.c[v]; u8[o + 13] = S.s[v] ? 1 : 0;
    if (face) u32[o / 4 + 4] = v;
  }
  return bytes;
}
const indexed = (gpu, name, i) => made(gpu, `${name} indices`, Uint32Array.from(i), GPUBufferUsage.INDEX);
// a skinned mesh (kind: 'skin' | 'cloth' | 'face'), or null where there is nothing of it. Its open solids' triangles
// (S.o) are a mesh of their own over the same vertices — `open`, of the kind cloth (skin's text, drawn from both
// sides, each side lit as it faces) —, so what is closed keeps its back faces culled; a face's are drawn with the
// face (its morphs have no kind drawn from both sides), cloth's with the rest of it (drawn from both sides already)
function skinMesh(gpu, name, S, kind) {
  if (!S) return null;
  const whole = kind === 'face' || kind === 'cloth', closed = whole ? S.i.concat(S.o) : S.i, open = whole ? [] : S.o;
  if (!closed.length && !open.length) return null;
  const buffers = [made(gpu, name, placed(S.p, S.n), GPUBufferUsage.VERTEX), made(gpu, `${name} held`, held(S, kind === 'face'), GPUBufferUsage.VERTEX)];
  return { kind: KINDS[kind], buffers, index: closed.length ? indexed(gpu, name, closed) : null, count: closed.length,
    open: open.length ? { kind: KINDS.cloth, buffers, index: indexed(gpu, `${name} open`, open), count: open.length } : null };
}
function tubeMesh(gpu, name, Tb) {
  if (!Tb.i.length) return null;
  const count = Tb.count, bytes = new ArrayBuffer(count * 32), f32 = new Float32Array(bytes), u8 = new Uint8Array(bytes);
  for (let v = 0; v < count; v++) {
    const o = v * 8;
    f32[o] = Tb.t[v * 4]; f32[o + 1] = Tb.t[v * 4 + 1]; f32[o + 2] = Tb.t[v * 4 + 2]; f32[o + 3] = Tb.t[v * 4 + 3];
    f32[o + 4] = Tb.t2[v * 3]; f32[o + 5] = Tb.t2[v * 3 + 1]; f32[o + 6] = Tb.t2[v * 3 + 2];
    u8[v * 32 + 28] = Tb.c[v]; u8[v * 32 + 29] = Tb.s[v] ? 1 : 0; u8[v * 32 + 30] = Tb.r[v];
  }
  return { kind: KINDS.tubes, buffers: [made(gpu, name, bytes, GPUBufferUsage.VERTEX)], index: indexed(gpu, name, Tb.i), count: Tb.i.length };
}
// what is moved point by point: skinned to the row that turns nothing; where its points are is each person's own.
// faces: the vertices it is drawn by (shapes.js verticesOf — a faceted style's faces flat: each triangle its own)
function movedMesh(gpu, name, D, flat) {
  if (!D.i.length) return null;
  const faces = verticesOf(D.i, 0, D.i.length, 0, D.c.length, flat, D.s), count = faces.from.length;
  const S = { c: Array.from(faces.from, v => D.c[v]), s: Array.from(faces.from, v => D.s[v]), j: new Uint16Array(count * 4), w: new Float32Array(count * 4) };
  for (let v = 0; v < count; v++) { S.j[v * 4] = J; S.w[v * 4] = 1; }
  return { kind: KINDS.cloth, set: D, faces, held: made(gpu, `${name} held`, held(S, false), GPUBufferUsage.VERTEX), index: indexed(gpu, name, faces.i), count: faces.i.length };
}
// (a model's meshes — its body's, a part's: W — { skin, tubes, dyn }, shapes.js's)
const meshesOf = (gpu, name, { skin, tubes, dyn }, flat) => ({ skin: skinMesh(gpu, `${name} skin`, skin, 'skin'), tubes: tubeMesh(gpu, `${name} tubes`, tubes), moved: movedMesh(gpu, `${name} moved`, dyn, flat) });
const dropped = (gpu, M) => { if (!M) return; for (const b of M.buffers ?? [M.held]) gpu.drop(b); if (M.index) gpu.drop(M.index); if (M.open) gpu.drop(M.open.index); };

// ── a look's model, held ───────────────────────────────────────────────
export function modelOf(S, look, cast, make) {
  const key = `${cast ? castOf(cast) : 0}\n${JSON.stringify(look)}`;
  let G = S.models.get(key);
  if (!G) {
    const gpu = S.gpu, model = make();
    G = { key, model, holds: 0, asked: new Set(), body: meshesOf(gpu, 'person', model.body, model.facets), hung: skinMesh(gpu, 'person hung', model.hung, 'cloth'), face: null, morphs: 0, moods: 0, faced: 0, parts: new Map() };
    if (model.face) {
      // the face's morphs: a row an expression (but its rest) a vertex — how far it moves the vertex, how its normal
      const F = model.face, count = F.S.c.length, moods = F.names.length - 1, at = take(S.morphs, count * moods), T = S.morphs.table, f32 = T.f32;
      for (let v = 0; v < count; v++) for (let e = 0; e < moods; e++) {
        const o = (at + v * moods + e) * 8, m = F.morphs[e + 1];
        f32[o] = m.p[v * 3]; f32[o + 1] = m.p[v * 3 + 1]; f32[o + 2] = m.p[v * 3 + 2]; f32[o + 3] = 0;
        f32[o + 4] = m.n[v * 3]; f32[o + 5] = m.n[v * 3 + 1]; f32[o + 6] = m.n[v * 3 + 2]; f32[o + 7] = 0;
      }
      T.mark(at, count * moods); T.flush();
      G.face = skinMesh(gpu, 'person face', F.S, 'face'); G.morphs = at; G.moods = moods; G.faced = count * moods;
    }
    S.models.set(key, G);
  }
  G.holds++;
  return G;
}
export function letGo(S, G) {
  if (--G.holds > 0) return;
  const gpu = S.gpu;
  for (const M of [G.body, ...G.parts.values()]) if (M) { dropped(gpu, M.skin); dropped(gpu, M.tubes); dropped(gpu, M.moved); }
  dropped(gpu, G.hung); dropped(gpu, G.face);
  give(S.morphs, G.morphs, G.faced);
  S.models.delete(G.key);
}
// a part they come to have with them, kept: its buffers, of the model's part (W: G.model.part(name)'s); null — there
// is none
export function partOf(S, G, name, W) {
  const M = W && { ...meshesOf(S.gpu, `person ${name}`, W, G.model.facets), made: W };
  G.parts.set(name, M);
  return M;
}

// ── a person wearing a model ───────────────────────────────────────────
export function worn(S, G) {
  const W = { G, I: G.model.state(), bones: take(S.bones, G.model.rows), rows: G.model.rows, carried: [], moved: new Map(), draws: null, parts: [] };
  // (their rows as the state has them — the row that turns nothing among them — into the table: marked, written at
  // the next shown frame's one write — people.js's show)
  S.bones.table.f32.set(W.I.rows, W.bones * 12);
  S.bones.table.mark(W.bones, W.rows);
  listed(S, W);
  return W;
}
export function taken(S, W) {
  for (const M of W.moved.values()) S.gpu.drop(M.buffer);
  W.moved.clear();
  give(S.bones, W.bones, W.rows);
}
// the parts they have with them now (names of parts made: partOf)
export function carry(S, W, names) {
  W.parts.length = 0; W.carried.length = 0;
  for (const name of names) { const M = W.G.parts.get(name); if (M) { W.parts.push(M); W.carried.push(M.made); } }
  listed(S, W);
}
// (what is drawn of them, by kind: each a mesh's buffers, its indices, their count — their own buffer of what is moved
// point by point made the first time it is theirs)
function listed(S, W) {
  const draws = W.draws = [[], [], [], []], G = W.G;
  // (a skinned mesh: what is closed by its kind, what is open from both sides)
  const skinned = M => { if (M.count) draws[M.kind].push(M); if (M.open) draws[KINDS.cloth].push(M.open); };
  const add = M => {
    if (M.skin) skinned(M.skin);
    if (M.tubes) draws[M.tubes.kind].push(M.tubes);
    if (M.moved) {
      let own = W.moved.get(M.moved);
      if (!own) {
        const D = G.model.movedOf(W.I, M.moved.set), drawn = M.moved.faces.from.length, data = new Float32Array(drawn * 6);
        W.moved.set(M.moved, own = { mesh: M.moved, D, n: new Float32Array(drawn * 3), data, buffer: S.gpu.buffer('person moved', data.byteLength, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST) });
      }
      draws[KINDS.cloth].push({ kind: KINDS.cloth, buffers: [own.buffer, M.moved.held], index: M.moved.index, count: M.moved.count, own });
    }
  };
  add(G.body);
  if (G.hung) skinned(G.hung);
  if (G.face) skinned(G.face);
  for (const M of W.parts) add(M);
}

// their rows against the table's: each number that is another written there, the rows from the first such to the
// last marked (the one write of their bones is the table's flush: people.js) — and what was moved point by point,
// its normals worked out, written. → whether anything changed
export function upload(S, W) {
  const T = S.bones.table, f32 = T.f32, at = W.bones * 12, own = W.I.rows, n = W.rows * 12;
  let lo = -1, hi = -1;
  for (let i = 0; i < n; i++) if (f32[at + i] !== own[i]) { f32[at + i] = own[i]; if (lo < 0) lo = i; hi = i; }
  if (lo >= 0) { const first = Math.floor(lo / 12); T.mark(W.bones + first, Math.floor(hi / 12) - first + 1); }
  let changed = lo >= 0;
  const list = W.draws[KINDS.cloth];
  for (let i = 0; i < list.length; i++) {
    const theirs = list[i].own;
    if (!theirs || !theirs.D.moved) continue;
    theirs.D.moved = false;
    const { from } = theirs.mesh.faces, p = theirs.D.p, n = normalsInto(p, 0, theirs.mesh.faces, theirs.n), data = theirs.data;
    for (let v = 0; v < from.length; v++) { const a = from[v] * 3, o = v * 6; data[o] = p[a]; data[o + 1] = p[a + 1]; data[o + 2] = p[a + 2]; data[o + 3] = n[v * 3]; data[o + 4] = n[v * 3 + 1]; data[o + 5] = n[v * 3 + 2]; }
    S.gpu.write(theirs.buffer, 0, data);
    changed = true;
  }
  return changed;
}

// a colour as the GPU takes it: linear
const linear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
// a person's colours into their block of the uniforms' mirror (at: the block's first float): each colour of the model
// and how it is painted (person.wgsl.js) — a silhouette's ink in place of its colours, but those that glow (tone 2)
// and those in colours on it (tone 3); a rimmed silhouette's colours rimmed; the ink
export function coloured(S, at, model) {
  const f32 = S.persons.f32, P = at * PERSON.BLOCK / 4, ink = model.ink.map(linear), o0 = P + PERSON.PALETTE / 4;
  f32[P + PERSON.INK / 4] = ink[0]; f32[P + PERSON.INK / 4 + 1] = ink[1]; f32[P + PERSON.INK / 4 + 2] = ink[2]; f32[P + PERSON.INK / 4 + 3] = 1;
  for (let i = 0; i < COLOURS; i++) {
    const c = model.palette[i], o = o0 + i * 4;
    if (!c) { f32[o] = f32[o + 1] = f32[o + 2] = f32[o + 3] = 0; continue; }
    const tone = Math.round(c[3]), paint = tone === 3 ? 'lit' : model.paint, glows = tone === 2, dark = paint === 'silhouette' && !glows;
    f32[o] = dark ? ink[0] : linear(c[0]); f32[o + 1] = dark ? ink[1] : linear(c[1]); f32[o + 2] = dark ? ink[2] : linear(c[2]);
    f32[o + 3] = glows ? PAINTED.GLOW : paint === 'rim' ? PAINTED.RIM : PAINTED.COLOUR;
  }
}
export { linear };
