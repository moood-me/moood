// How people are drawn on the GPU: what of a person's draw is PEOPLE's (contracts PP9, PP10) — the kinds of a
// figure of shapes, each a vertex text and a surface text and its vertex buffers; the two bind groups of theirs; and,
// for the whole-set check, a draw of every person pipeline with small buffers. RENDER's library writes the mains
// round these texts (the world's point, the light, the haze, the ids), and makes the pipelines. Nothing here is a
// browser's as it is imported: the check reads this module in node (BD4).
//
// A figure's vertices are in the person's own space — the root's (metres, y up, facing +z) — and are moved there:
//   skin  — skinned by up to four rows of the person's bones (rig.js: a joint's skinning matrix, a slot of what
//           follows no one joint);
//   tubes — a limb, a lock, a scarf's end: one tube laid along its chain's points (rows of the same table: where each
//           point is now and a hint of its section's turn), its corners rounded; on a faceted figure each of its
//           faces lit flat — the normal a face's first vertex gives is the face's (PP9's flat pair);
//   cloth — skin's text, drawn from both sides: what hangs of a garment (skinned to its controls: cloth.js) and what
//           is moved point by point (rings of a cast's own: its places written each frame, skinned to the row that
//           turns nothing);
//   face  — skin's text with the expressions' morphs over it (rows of the people's morphs table).
// What differs between two looks is buffers and the person's uniform, never text.
//
// Group 2 `people`: 0 `personBones` (storage: 48 bytes a row — three rows of a 3 × 4 matrix), 1 `personMorphs`
// (storage: 32 bytes a row — a place's and a normal's change). Group 3 `person`: 0 `person` (uniform, a dynamic
// offset: PERSON.BLOCK bytes a person).
//
// The texts declare, by these names: `PersonIn` (a kind's vertex: its @locations match the kind's buffers),
// `PersonCarry` (what the vertex stage hands the surface: locations 8 and 9), the groups above, and
//   fn personVertex(v: PersonIn) -> PersonPoint   — position and normal in the root's space, and the carry
//   fn personFacing(p: PersonPoint, r0: vec4f, r1: vec4f, r2: vec4f) -> PersonCarry
//                                                  — the point's carry with how it faces the eye in it: the main
//                                                    calls it with the three rows of the person's node (the root:
//                                                    the person's uniform holds no copy of it) and hands THAT
//                                                    carry on to the surface
//   fn personSurface(c: PersonCarry) -> Surface   — in the kind's `surface`
//   fn personNode() -> u32, fn personSlot() -> u32, fn personInside() -> f32, fn personGlow() -> f32
//   fn personLines() -> vec2u                      — the lines' width (eighths of a CSS px) and kind, for the ids
// `PersonPoint { position: vec3f, normal: vec3f, carry: PersonCarry }` and `Surface { albedo, emissive, ink: vec3f,
// rim, facet: f32, part: u32 }` are the mains' (RENDER's): these texts fill them by their members' names. They read
// `e_frame.pulse`, `e_view.eye`, `e_view.rot`, `e_view.proj`, `e_view.flags` (4.1: another area's names are written
// with `e_`). Every other name here begins `person` / `Person`.
import { FLAG, PULSE, VIEW } from '../base.js';

// the most chain points a tube has (a limb: four; a finger: five; a lock of hair, a scarf: as many as it is drawn by)
export const TUBE_POINTS = 8;
// the most colours a person has (a figure's parts: each colour and tone it is drawn in)
export const COLOURS = 64;
// the most expressions a face goes between besides its rest
export const MOODS = 12;
export const BONE_BYTES = 48, MORPH_BYTES = 32;
// the person's uniform: its fields' places (bytes), its size, and the block a person takes of the buffer (a dynamic
// offset is a multiple of 256)
export const PERSON = Object.freeze({ INK: 0, NODE: 16, SLOT: 20, BONES: 24, MORPHS: 28, MARKS: 32, LINES: 36, FLAGS: 40, MOODS: 44, MOOD: 48,
  PALETTE: 96, BYTES: 96 + COLOURS * 16, BLOCK: 1280, FACETS: 1, INSIDE: 2 });
// how a colour of the palette is painted (its fourth number): its colour lit; a silhouette's ink, its colour coming
// through as the light on it grows, rimmed; its colour unlit (it glows)
export const PAINTED = Object.freeze({ COLOUR: 0, RIM: 1, GLOW: 2 });

const DECLARED = /* wgsl */`
struct PersonBone { r0: vec4f, r1: vec4f, r2: vec4f }
struct PersonMorph { p: vec4f, n: vec4f }
struct Person {
  ink: vec4f,                                 // a silhouette's colour (linear)
  node: u32, slot: u32,                       // their row of the nodes; their slot of the ids and the inks
  bones: u32, morphs: u32,                    // their first row of the bones; their face's first row of the morphs
  marks: u32, lines: u32,                     // the highlight's bits (IN3); the lines' width | kind << 8
  flags: u32, moods: u32,                     // 1 faceted, 2 in a room; how many morphs a vertex of the face has
  mood: array<vec4f, ${MOODS / 4}>,           // how much of each expression the face shows now
  palette: array<vec4f, ${COLOURS}>,          // their colours (linear) and how each is painted
}
@group(2) @binding(0) var<storage, read> personBones: array<PersonBone>;
@group(2) @binding(1) var<storage, read> personMorphs: array<PersonMorph>;
@group(3) @binding(0) var<uniform> person: Person;

struct PersonCarry {
  @location(8) @interpolate(flat) paint: vec2u,   // the colour's number; 1 — lit smoothly on a faceted figure
  @location(9) facing: f32,                       // how the surface faces the eye there (its normal on the way to it)
}

fn personNode() -> u32 { return person.node; }
fn personSlot() -> u32 { return person.slot; }
fn personLines() -> vec2u { return vec2u(person.lines & 255u, person.lines >> 8u); }
fn personInside() -> f32 { return f32((person.flags >> 1u) & 1u); }
// (a faceted figure's vertex lit flat: any but one marked smooth — its rounded face)
fn personFlat(paint: vec4u) -> bool { return (person.flags & ${PERSON.FACETS}u) != 0u && paint.y == 0u; }
// the highlight: an offered person breathes brighter, a selected one is steadily brighter — not in a mirror (IN3)
fn personGlow() -> f32 {
  var glow = 1.0;
  if ((e_view.flags & ${VIEW.MIRROR}u) != 0u) { return glow; }
  if ((person.marks & ${FLAG.OFFERED}u) != 0u) { glow *= e_frame.pulse; }
  if ((person.marks & ${FLAG.SELECTED}u) != 0u) { glow *= ${(1 + PULSE.DEPTH).toFixed(4)}; }
  return glow;
}
// a point of theirs (the root's space) — its carry with how it faces the eye in it: its normal on the way to the eye,
// along the eye's own axis where the view has no perspective. r0, r1, r2: the root's 3 × 4, rows — their own space
// into the world less the origin: their row of the nodes, which the main reads and gives (PP9)
fn personFacing(p: PersonPoint, r0: vec4f, r1: vec4f, r2: vec4f) -> PersonCarry {
  let q = vec4f(p.position, 1.0);
  let at = vec3f(dot(r0, q), dot(r1, q), dot(r2, q));
  let turned = vec3f(dot(r0.xyz, p.normal), dot(r1.xyz, p.normal), dot(r2.xyz, p.normal));
  var way = vec3f(e_view.rot[0].z, e_view.rot[1].z, e_view.rot[2].z);
  if (e_view.proj[3].w < 0.5) { way = e_view.eye - at; }
  var c = p.carry;
  c.facing = dot(turned, way) / max(length(turned) * length(way), 1e-6);
  return c;
}
`;

// skinned: the rows mixed, the place taken through them, the normal by their cofactor (right for an egg stretched by
// its axes, as for a turn)
const SKINNED = /* wgsl */`
fn personMixed(j: vec4u, w: vec4f) -> PersonBone {
  let a = personBones[person.bones + j.x];
  let b = personBones[person.bones + j.y];
  let c = personBones[person.bones + j.z];
  let d = personBones[person.bones + j.w];
  return PersonBone(a.r0 * w.x + b.r0 * w.y + c.r0 * w.z + d.r0 * w.w, a.r1 * w.x + b.r1 * w.y + c.r1 * w.z + d.r1 * w.w,
    a.r2 * w.x + b.r2 * w.y + c.r2 * w.z + d.r2 * w.w);
}
fn personPlaced(m: PersonBone, p: vec3f) -> vec3f { let q = vec4f(p, 1.0); return vec3f(dot(m.r0, q), dot(m.r1, q), dot(m.r2, q)); }
fn personTurned(m: PersonBone, n: vec3f) -> vec3f {
  let t = vec3f(dot(cross(m.r1.xyz, m.r2.xyz), n), dot(cross(m.r2.xyz, m.r0.xyz), n), dot(cross(m.r0.xyz, m.r1.xyz), n));
  return t / max(length(t), 1e-6);
}
`;
const skinned = face => /* wgsl */`${DECLARED}${SKINNED}
struct PersonIn {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) joints: vec4u,
  @location(3) weights: vec4f,
  @location(4) paint: vec4u,${face ? `
  @location(5) morph: u32,` : ''}
}
fn personVertex(v: PersonIn) -> PersonPoint {
  var p = v.position;
  var n = v.normal;${face ? `
  // (the face's expression: each one's change of this vertex, as much as the face shows of it now)
  let first = person.morphs + v.morph * person.moods;
  for (var e = 0u; e < ${MOODS}u; e++) {
    if (e >= person.moods) { break; }
    let much = person.mood[e >> 2u][e & 3u];
    if (much > 0.0) { let m = personMorphs[first + e]; p += m.p.xyz * much; n += m.n.xyz * much; }
  }` : ''}
  let m = personMixed(v.joints, v.weights);
  var o: PersonPoint;
  o.position = personPlaced(m, p);
  o.normal = personTurned(m, n);
  // (how it faces the eye: personFacing's, with their root)
  o.carry = PersonCarry(v.paint.xy, 0.0);
  return o;
}
`;

// A tube along its chain: straight, each corner rounded (a curve from a third of the shorter segment before it to as
// far after), a section at each place along it turned as the points' hints are. The chain: a row of the person's
// bones — (how many points, how flat its section, how square) — then a row a point: where it is now, its hint.
// A faceted figure's: each face's triangles begin with a vertex that begins no other face's (shapes.js), and that
// vertex gives the face's normal — the section's at the angle of the face's middle; a face of an end: tipped from that
// to the tube's way as far as the end's point is out
const TUBES = /* wgsl */`${DECLARED}
struct PersonIn {
  @location(0) tube: vec4f,    // its chain's row; where along it; the angle round it; its half-width there
  @location(1) shape: vec3f,   // how its width changes along it; an end's point: −1 the first, 1 the last; how far out
  @location(2) paint: vec4u,   // the colour's number; 1 — lit smoothly on a faceted figure; how many faces go round it
}
struct PersonChain { p: array<vec3f, ${TUBE_POINTS}>, h: array<vec3f, ${TUBE_POINTS}>, len: array<f32, ${TUBE_POINTS}>, rnd: array<f32, ${TUBE_POINTS}>, count: i32 }
fn personWay(c: ptr<function, PersonChain>, s: i32) -> vec3f { return ((*c).p[s + 1] - (*c).p[s]) / (*c).len[s]; }
fn personCorner(c: ptr<function, PersonChain>, j: i32, t: f32) -> vec3f {
  let a = (*c).p[j] - personWay(c, j - 1) * (*c).rnd[j];
  let b = (*c).p[j] + personWay(c, j) * (*c).rnd[j];
  return a * (1.0 - t) * (1.0 - t) + (*c).p[j] * 2.0 * (1.0 - t) * t + b * t * t;
}
fn personAlong(c: ptr<function, PersonChain>, w: f32) -> vec3f {
  let s = clamp(i32(floor(w)), 0, (*c).count - 2);
  let d = (w - f32(s)) * (*c).len[s];
  if (d < (*c).rnd[s]) { return personCorner(c, s, 0.5 + 0.5 * d / (*c).rnd[s]); }
  if ((*c).len[s] - d < (*c).rnd[s + 1]) { return personCorner(c, s + 1, 0.5 - 0.5 * ((*c).len[s] - d) / (*c).rnd[s + 1]); }
  return (*c).p[s] + personWay(c, s) * d;
}
fn personUnit(v: vec3f) -> vec3f { return v / max(length(v), 1e-9); }
fn personVertex(v: PersonIn) -> PersonPoint {
  var c: PersonChain;
  let row = person.bones + u32(v.tube.x + 0.5);
  let head = personBones[row].r0;
  c.count = clamp(i32(head.x + 0.5), 2, ${TUBE_POINTS});
  for (var i = 0; i < ${TUBE_POINTS}; i++) {
    if (i >= c.count) { break; }
    let point = personBones[row + 1u + u32(i)];
    c.p[i] = point.r0.xyz;
    c.h[i] = point.r1.xyz;
  }
  for (var i = 0; i < ${TUBE_POINTS - 1}; i++) {
    if (i + 1 >= c.count) { break; }
    c.len[i] = max(length(c.p[i + 1] - c.p[i]), 1e-6);
  }
  // (the ends' corners are not rounded: theirs stay 0)
  for (var i = 1; i < ${TUBE_POINTS - 1}; i++) {
    if (i + 1 >= c.count) { break; }
    c.rnd[i] = min(c.len[i - 1], c.len[i]) / 3.0;
  }
  let w = v.tube.y;
  let r = v.tube.w;
  let end = f32(c.count - 1);
  let t = personUnit(personAlong(&c, min(end, w + 0.01)) - personAlong(&c, max(0.0, w - 0.01)));
  let s = clamp(i32(floor(w)), 0, c.count - 2);
  let hint = mix(c.h[s], c.h[s + 1], clamp(w - f32(s), 0.0, 1.0));
  var e1 = hint - t * dot(hint, t);
  if (dot(e1, e1) < 1e-8) {
    if (abs(t.y) < 0.9) { e1 = cross(t, vec3f(0.0, 1.0, 0.0)); } else { e1 = cross(t, vec3f(1.0, 0.0, 0.0)); }
  }
  e1 = personUnit(e1);
  let e2 = cross(t, e1);
  let depth = head.y;
  let k = 2.0 / max(head.z, 1.0);
  // (the section's normal — a superellipse's — at the vertex's angle; lit flat: at the angle of its face's middle)
  let faced = personFlat(v.paint);
  var facing = v.tube.z;
  if (faced) { facing += ${Math.PI.toFixed(6)} / f32(max(v.paint.z, 3u)); }
  let fc = cos(facing);
  let fs = sin(facing);
  let outward = personUnit(e1 * (sign(fc) * pow(abs(fc), 2.0 - k) / max(r, 1e-6)) + e2 * (sign(fs) * pow(abs(fs), 2.0 - k) / max(r * depth, 1e-6)));
  var o: PersonPoint;
  if (v.shape.y != 0.0) {
    // (an end's point: out along the tube by as much of its last section's width as it says; lit flat, a face of
    // the end — from the section's edge to that point: tipped as much from the section's normal to the tube's way)
    let way = t * sign(v.shape.y);
    o.position = personAlong(&c, w) + way * r * v.shape.z;
    o.normal = way;
    if (faced) { o.normal = personUnit(outward * v.shape.z + way); }
  } else {
    let cs = cos(v.tube.z);
    let sn = sin(v.tube.z);
    o.position = personAlong(&c, w) + e1 * (r * sign(cs) * pow(abs(cs), k)) + e2 * (r * depth * sign(sn) * pow(abs(sn), k));
    // (tipped by how its width changes along it)
    o.normal = personUnit(outward - t * v.shape.x / c.len[s]);
  }
  // (how it faces the eye: personFacing's, with their root)
  o.carry = PersonCarry(v.paint.xy, 0.0);
  return o;
}
`;

// A figure of shapes' surface under the scene's light: each part's colour; a silhouette its ink, its colours coming
// through as the light on it grows (the mains' formula, PP9), rimmed where it turns from the eye; a colour that glows
// its own, unlit. A faceted figure's faces are lit flat — but what is marked soft (its rounded face)
const SURFACE = /* wgsl */`
fn personSurface(c: PersonCarry) -> Surface {
  let colour = person.palette[min(c.paint.x, ${COLOURS - 1}u)];
  let how = u32(colour.w + 0.5);
  var s: Surface;
  s.albedo = colour.rgb;
  s.emissive = vec3f(0.0);
  s.ink = colour.rgb;
  s.rim = 0.0;
  if (how == ${PAINTED.RIM}u) {
    s.ink = person.ink.rgb;
    s.rim = smoothstep(0.62, 0.86, 1.0 - abs(c.facing));
  } else if (how == ${PAINTED.GLOW}u) {
    s.albedo = vec3f(0.0);
    s.ink = vec3f(0.0);
    s.emissive = colour.rgb;
  }
  s.facet = 0.0;
  if ((person.flags & ${PERSON.FACETS}u) != 0u && c.paint.y == 0u) { s.facet = 1.0; }
  s.part = c.paint.x;
  return s;
}
`;

// what PersonCarry holds, as data: a main cannot keep a structure inside its stage's output (WGSL has no nested
// structures there), so it declares these members in its own and makes the carry of them — PersonCarry(…), in this
// order
export const PERSON_CARRY = Object.freeze([
  Object.freeze({ name: 'paint', type: 'vec2u', location: 8, flat: true }),
  Object.freeze({ name: 'facing', type: 'f32', location: 9, flat: false }),
]);

// the vertex buffers: a skinned mesh's — where each vertex is and how it faces (written again each frame for what is
// moved point by point), then what never changes of it; a tube's — one
const MOVED = { arrayStride: 24, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }] };
const HELD = [{ shaderLocation: 2, offset: 0, format: 'uint16x4' }, { shaderLocation: 3, offset: 8, format: 'unorm8x4' }, { shaderLocation: 4, offset: 12, format: 'uint8x4' }];
const SKIN_BUFFERS = [MOVED, { arrayStride: 16, attributes: HELD }];
const FACE_BUFFERS = [MOVED, { arrayStride: 20, attributes: [...HELD, { shaderLocation: 5, offset: 16, format: 'uint32' }] }];
const TUBE_BUFFERS = [{ arrayStride: 32, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x4' }, { shaderLocation: 1, offset: 16, format: 'float32x3' },
  { shaderLocation: 2, offset: 28, format: 'uint8x4' }] }];

// the kinds of a figure of shapes (PP9): a closed list
export const PERSON_KINDS = Object.freeze([
  Object.freeze({ name: 'skin', vertex: skinned(false), surface: SURFACE, buffers: SKIN_BUFFERS, twoSided: false }),
  Object.freeze({ name: 'tubes', vertex: TUBES, surface: SURFACE, buffers: TUBE_BUFFERS, twoSided: false }),
  Object.freeze({ name: 'cloth', vertex: skinned(false), surface: SURFACE, buffers: SKIN_BUFFERS, twoSided: true }),
  Object.freeze({ name: 'face', vertex: skinned(true), surface: SURFACE, buffers: FACE_BUFFERS, twoSided: false }),
]);

// the people's two layouts (GP7): called by SCENE at the mount, before the renderer is made, and by the check
export function layouts(gpu) {
  const VERTEX = GPUShaderStage.VERTEX, FRAGMENT = GPUShaderStage.FRAGMENT;
  gpu.layout('people', [
    { binding: 0, visibility: VERTEX, buffer: { type: 'read-only-storage' } },
    { binding: 1, visibility: VERTEX, buffer: { type: 'read-only-storage' } },
  ]);
  gpu.layout('person', [
    { binding: 0, visibility: VERTEX | FRAGMENT, buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: PERSON.BYTES } },
  ]);
}

// For the whole-set check only (PP10, RN2's lib.exercise): every person pipeline of `kind` ('main' | 'depth') — the
// mains with the winding turned (`mirrored`: a mirror's pass — its own set, of its image's targets) or not — bound
// and drawn once into the pass given — small buffers of its own making, kept with the gpu; no built person, no
// People. The pass has its groups 0 and 1 set.
const exercised = new WeakMap();
export function exercisePeople(gpu, lib, pass, kind, mirrored) {
  let made = exercised.get(gpu);
  if (!made) {
    const bones = gpu.table('bones', { stride: BONE_BYTES, capacity: 1 + TUBE_POINTS }), morphs = gpu.table('morphs', { stride: MORPH_BYTES, capacity: MOODS });
    // (row 0: a chain of two points, round — its first at nothing, its second along x: a tube has somewhere to lie)
    bones.f32.set([2, 1, 2, 0], 0);
    bones.f32.set([1, 0, 0, 0, 0, 1, 0, 0], 24);
    bones.mark(0, bones.capacity); bones.flush();
    const uniform = gpu.buffer('persons', PERSON.BLOCK, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    const index = gpu.buffer('person indices', 12, GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST);
    gpu.write(index, 0, new Uint32Array([0, 1, 2]));
    made = {
      people: gpu.bind('people', [{ binding: 0, resource: { buffer: bones.buffer } }, { binding: 1, resource: { buffer: morphs.buffer } }]),
      person: gpu.bind('person', [{ binding: 0, resource: { buffer: uniform, offset: 0, size: PERSON.BYTES } }]),
      index,
      // (three vertices of nothing a kind: a triangle of no size — the draw is what is exercised)
      vertices: PERSON_KINDS.map(K => K.buffers.map((B, i) => gpu.buffer(`person ${K.name} ${i}`, B.arrayStride * 3, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST))),
    };
    exercised.set(gpu, made);
  }
  pass.setBindGroup(2, made.people);
  pass.setBindGroup(3, made.person, [0]);
  pass.setIndexBuffer(made.index, 'uint32');
  PERSON_KINDS.forEach((K, k) => {
    made.vertices[k].forEach((buffer, i) => pass.setVertexBuffer(i, buffer));
    pass.setPipeline(lib.person(K.name, kind, mirrored));
    pass.drawIndexed(3);
  });
}
