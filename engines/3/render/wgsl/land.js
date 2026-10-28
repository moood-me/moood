// The land on the GPU (render/land.js lays it out): the relief's heights about an eye, nested — LAND.N × N points a
// level, the finest a cell of the land's own lattice (world/relief.js FINE: the points what stands on the land
// stands on), each next twice as coarse —, the land's own shadow of the far lights baked from them, and the leaves
// the draped quads are drawn over.
//   A FIELD is a view's (4.2, group 1 bindings 8–10: e_land, e_landHeights, e_landShadow — 1 × 1 textures and no
// levels in a world without land): so e_reliefAt and the land's shadow are there for every program drawn through a
// view — the land, what is draped on it, and every lit point of quads and people (5.5). The levels' text (LEVELS) is
// part of the chunk `frame`, which declares those bindings, and of the bake's module, which has them in its own group.
//   e_reliefAt(xz) — what SCENE's chunk lifts a draped quad's point by (WT6): the land's height at a place of the
// world less the origin, from the level as coarse as the place is far from the eye — level λ = log2(distance / R0),
// the two levels about it mixed. A leaf of level j lies no nearer than R0 · 2^j (render/land.js splits a node nearer
// than that), so wherever a leaf meets a coarser one the heights are the coarser level's, which are straight along
// that leaf's edges: no crack, with no stitching and no morph of the mesh. Two triangles a cell, as world/relief.js
// stands people on them.
//   The levels lie one under another in one texture, each going round in its own N × N (a level moved keeps what it
// held); a level's row tells which of its points are there: a rect of them (its first point's place less the origin,
// its texel, how many each way), and a rect of those whose shadow is baked. What a level does not hold yet is read
// from the next.
//   The land's shadow (5.5): for each point of each level, for each of up to two far lights, the height under which
// its column lies in the shadow of the land and how far off that rise is (its edge is as soft as the light's angle
// times that). Baked by the `bake` pass, a tile of points a draw. Read by e_landShade — wherever something is lit.
//   A leaf's row (group 2 `land`, binding 0): a — its corner (x, z less the origin), its side, its level; b — the
// draped quad's uv at that corner, and its painting's px there from the quad's origin page; c — how the uv changes a
// metre along x and along z; d — the sheet's size, px. The inverse of SCENE's mapping is not written here:
// render/land.js takes it from place() itself, each frame.
import { chunk } from '../../gpu/wgsl.js';

export const LAND = Object.freeze({ N: 192, TILE: 32, LEVELS: 16, LEAF: 16, RHO: 2, LEVEL_BYTES: 48, BYTES: 816, EYE: 768, LIGHTS: 784, ANGLE: 800, LEAF_BYTES: 64, MARCH: 96 });
const N = LAND.N;

// the levels of a field: its uniform's shape and the heights read from it. The names e_land and e_landHeights are the
// including module's to bind
export const LEVELS = /* wgsl */ `
struct e_LandLevel { a: vec4f, b: vec4i, c: vec4i }
struct e_Land {
  level: array<e_LandLevel, ${LAND.LEVELS}>,
  eye: vec4f,          // the eye the levels are about (x, z less the origin), R0 — the finest level's reach —, how many levels
  lights: vec4i,       // the lit set's rows of the far lights whose shadow is baked (x, y; −1: none)
  angle: vec4f,        // each one's angle in the sky (its tangent: how soft its shadow's edge grows with the distance)
}
fn e_landTexel(k: u32, V: e_LandLevel, i: vec2i) -> vec2i {
  let t = (V.b.xy + i) % vec2i(${N});
  return vec2i(t.x, t.y + i32(k) * ${N});
}
// whether level k holds xz (g: where on its grid)
fn e_landHolds(V: e_LandLevel, xz: vec2f) -> bool {
  let g = (xz - V.a.xy) / V.a.z;
  return V.b.z > 1 && V.b.w > 1 && g.x >= 0.0 && g.y >= 0.0 && g.x <= f32(V.b.z - 1) && g.y <= f32(V.b.w - 1);
}
fn e_landHeight(k: u32, xz: vec2f) -> f32 {
  let V = e_land.level[k];
  let g = (xz - V.a.xy) / V.a.z;
  let i = clamp(vec2i(floor(g)), vec2i(0), V.b.zw - vec2i(2));
  let f = clamp(g - vec2f(i), vec2f(0.0), vec2f(1.0));
  let h00 = textureLoad(e_landHeights, e_landTexel(k, V, i), 0).r;
  let h10 = textureLoad(e_landHeights, e_landTexel(k, V, i + vec2i(1, 0)), 0).r;
  let h01 = textureLoad(e_landHeights, e_landTexel(k, V, i + vec2i(0, 1)), 0).r;
  let h11 = textureLoad(e_landHeights, e_landTexel(k, V, i + vec2i(1, 1)), 0).r;
  if (f.x + f.y <= 1.0) { return h00 + f.x * (h10 - h00) + f.y * (h01 - h00); }
  return h11 + (1.0 - f.x) * (h01 - h11) + (1.0 - f.y) * (h10 - h11);
}
// the height at xz from the finest level from k on that holds it: (the height, that level; −1: none holds it)
fn e_landFrom(k: u32, xz: vec2f) -> vec2f {
  let count = u32(e_land.eye.w);
  for (var j = k; j < ${LAND.LEVELS}u; j++) {
    if (j >= count) { break; }
    if (e_landHolds(e_land.level[j], xz)) { return vec2f(e_landHeight(j, xz), f32(j)); }
  }
  return vec2f(0.0, -1.0);
}
`;

// every program drawn through a view (layout `view`): the land of that view's field — its height, its own shadow
chunk('render.relief', /* wgsl */ `
fn e_reliefAt(xz: vec2f) -> f32 {
  let top = max(e_land.eye.w - 1.0, 0.0);
  let lam = clamp(log2(max(length(xz - e_land.eye.xy), 1e-6) / e_land.eye.z), 0.0, top);
  let k = u32(floor(lam));
  let A = e_landFrom(k, xz);
  if (A.y < 0.0) { return 0.0; }
  let t = lam - floor(lam);
  if (A.y > f32(k) || t <= 0.0) { return A.x; }
  let B = e_landFrom(k + 1u, xz);
  if (B.y < 0.0) { return A.x; }
  return mix(A.x, B.x, t);
}
// how much of light i the land's own rises let reach P: the finest level about P whose shadow is baked
fn e_landShade(i: u32, P: vec3f) -> f32 {
  var slot = -1;
  if (e_land.lights.x == i32(i)) { slot = 0; } else if (e_land.lights.y == i32(i)) { slot = 1; }
  if (slot < 0) { return 1.0; }
  let count = u32(e_land.eye.w);
  let nearest = u32(clamp(floor(log2(max(length(P.xz - e_land.eye.xy), 1e-6) / e_land.eye.z)), 0.0, 15.0));
  for (var k = nearest; k < ${LAND.LEVELS}u; k++) {
    if (k >= count) { break; }
    let V = e_land.level[k];
    let g = (P.xz - V.a.xy) / V.a.z - vec2f(V.c.xy);
    if (V.c.z < 2 || V.c.w < 2 || g.x < 0.0 || g.y < 0.0 || g.x > f32(V.c.z - 1) || g.y > f32(V.c.w - 1)) { continue; }
    let j = clamp(vec2i(floor(g)), vec2i(0), V.c.zw - vec2i(2));
    let f = clamp(g - vec2f(j), vec2f(0.0), vec2f(1.0));
    let o = V.c.xy + j;
    let t = mix(mix(textureLoad(e_landShadow, e_landTexel(k, V, o), 0), textureLoad(e_landShadow, e_landTexel(k, V, o + vec2i(1, 0)), 0), f.x),
                mix(textureLoad(e_landShadow, e_landTexel(k, V, o + vec2i(0, 1)), 0), textureLoad(e_landShadow, e_landTexel(k, V, o + vec2i(1, 1)), 0), f.x), f.y);
    var v = t.xy;
    var angle = e_land.angle.x;
    if (slot == 1) { v = t.zw; angle = e_land.angle.y; }
    let w = max(0.5 * V.a.z, angle * v.y);
    return smoothstep(-w, w, P.y + e_frame.e_origin.y - v.x + 0.5 * V.a.z);
  }
  return 1.0;
}
`);

// every program drawn through `viewCast` or the air's group (no field is bound there): nothing is draped in it, and
// the land shades nothing
chunk('render.relief.none', /* wgsl */ `
fn e_reliefAt(xz: vec2f) -> f32 { return 0.0; }
fn e_landShade(i: u32, P: vec3f) -> f32 { return 1.0; }
`);

// A draped quad over a leaf: the leaf's grid of the land's own places; each point's uv on the quad from the leaf's
// row, kept within the quad's rect (what lies past it is drawn on its edge: nothing); the point itself and its lift
// are SCENE's (e_quadPoint, e_quadWorld); its face by the land's heights about it.
chunk('render.land', /* wgsl */ `
struct e_Leaf { a: vec4f, b: vec4f, c: vec4f, d: vec4f }
@group(2) @binding(0) var<storage, read> e_leaves: array<e_Leaf>;

@vertex fn e_vertex(in: e_In) -> e_Out {
  let q = e_quadOf(in.quad);
  let leaf = e_leaves[in.shape >> 8u];
  let d = in.corner * leaf.a.z;
  let raw = leaf.b.xy + d.x * leaf.c.xy + d.y * leaf.c.zw;
  let uv = clamp(raw, vec2f(0.0), vec2f(1.0));
  let at = leaf.b.zw + (d.x * leaf.c.xy + d.y * leaf.c.zw - (raw - uv)) * leaf.d.xy;
  let posed = e_posed(q, e_QUAD_DRAPE, e_quadPoint(q, uv), leaf.d.xy);
  let P = e_quadWorld(q, posed.p, e_view.yaw);
  // (its face: the land's rise a step along x and along z — a step as wide as the land is coarse there)
  let e = max(0.05, 0.03 * length(P.xz - e_land.eye.xy));
  let h = e_reliefAt(P.xz);
  let N = normalize(vec3f(h - e_reliefAt(P.xz + vec2f(e, 0.0)), e, h - e_reliefAt(P.xz + vec2f(0.0, e))));
  return e_shaded(in, q, e_QUAD_DRAPE, P, N, uv, at, leaf.d.xy, posed);
}
`);

// The bake of the land's shadow (the \`bake\` pass): a tile of one level's points a draw — each point's column marched
// toward each of the two lights over the heights (a step as long as the cell where it is, and no shorter than a
// tenth of the way gone: what is far shades as softly as it is far), the highest the land rises over the light's
// way down to it, till nothing higher could be met (the land's highest). Written: (that height, how far off the
// rise is along the light's way) for each light. The march leaves a level's window once and never comes back into it
// (the windows are nested about one eye), so the level read only grows coarser along it: one loop, no search a step.
chunk('render.land.bake', /* wgsl */ `
${LEVELS}
struct e_Bake {
  at: vec4f,           // the tile's first point (x, z less the origin), its cell, its level
  rect: vec4f,         // that point's texel (x, y); the land's highest; —
  way: array<vec4f, 2>,   // the way toward each light (w: 1 — there is one)
}
@group(0) @binding(0) var<uniform> e_land: e_Land;
@group(0) @binding(1) var e_landHeights: texture_2d<f32>;
@group(0) @binding(2) var<uniform> e_bake: e_Bake;
@vertex fn e_vertex(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  return vec4f(f32(i32(i & 1u) * 4 - 1), f32(i32(i >> 1u) * 4 - 1), 0.0, 1.0);
}
fn e_rise(xz: vec2f, k: u32, cell0: f32, way: vec4f) -> vec2f {
  let here = e_landFrom(k, xz).x;
  let hl = length(way.xz);
  if (way.w < 0.5 || hl < 1e-4) { return vec2f(here, 0.0); }
  let dir = way.xz / hl;
  let slope = way.y / hl;
  let count = u32(e_land.eye.w);
  var s = cell0;
  var top = -1e9;
  var at = 0.0;
  var j = k;
  for (var n = 0; n < ${LAND.MARCH + LAND.LEVELS}; n++) {
    if (j >= count) { break; }
    let p = xz + dir * s;
    // (past this level's window: the next, at the same place)
    if (!e_landHolds(e_land.level[j], p)) { j += 1u; continue; }
    let c = e_landHeight(j, p) - slope * s;
    if (c > top) { top = c; at = s; }
    if (e_bake.rect.z - slope * s < top) { break; }
    s += max(0.75 * e_land.level[j].a.z, 0.1 * s);
  }
  return vec2f(top, at / hl);
}
@fragment fn e_fragment(@builtin(position) p: vec4f) -> @location(0) vec4f {
  let xz = e_bake.at.xy + (floor(p.xy) - e_bake.rect.xy) * e_bake.at.z;
  let k = u32(e_bake.at.w);
  return vec4f(e_rise(xz, k, e_bake.at.z, e_bake.way[0]), e_rise(xz, k, e_bake.at.z, e_bake.way[1]));
}
`);
