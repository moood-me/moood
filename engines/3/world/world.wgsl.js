// The chunk `world` (WT6): the world's tables on the GPU and the mapping of every kind of quad for the vertex stage —
// the same arithmetic as world/place.js, by the same author. It declares the bindings of `frame` that are SCENE's
// (4.1, 4.2: nodes, quads, layers — vertex stage —, forms) and the structs Node, Quad, Layer; it reads `frame.pulse`
// and `view.flags` by name (RENDER's chunk `frame` declares those uniforms) and calls, by the names WT6 gives them,
// what other areas provide: reliefAt (RENDER's land field of the view — a draped quad), insertOf and insertOpen
// (RENDER's Frame — an insert's iris).
//   Names (4.1): an author's shader is assembled into one module with this chunk, and every name that does not begin
// `e_` or `u_` is the author's — so every module-scope name here is WRITTEN with `e_` before the name the contract
// gives it (e_Quad, e_quadOf, e_nodes, e_QUAD_CARD …; the other areas' likewise: e_reliefAt, e_frame, e_view). Struct
// members are written as given.
//   A quad's row (4.1, 96 bytes): `sheer` — its element's `translucent`: how much of the light from behind it comes
// through (5.5), three words spare after it; `casts` is WT2's `cast` (a reserved word of WGSL); `clip` — bits 0–1 the cutter set a
// CLIPPED quad is clipped by, bit 2 it is seen outside its cutters, bits 4–7 the cutter sets it is a cutter of.
//   What quadWorld returns, by the quad's kind (as place.js):
//     CARD, PLANE, DRAPE, FORM   the world point, less the render origin (DRAPE: lifted by reliefAt at its xz —
//                                the land's height in metres as the land function gives it)
//     FACING                     the same, the quad turned about its node's vertical by the view's yaw
//     SKY                        the unit direction toward that point of the sky: a point at infinity (w = 0)
//     INSERT                     (x − STAGE / 2, y, 0): frame heights to the right of the frame's middle and down
//                                from its top — the insert's pipeline lays it over the frame's rect
//   A sky quad's node row is not a matrix: its r0 is the sky's map (the horizon on the stage, the stage's width in
// its heights — 2π looking round —, 1 looking round or 0); skyMap gives it, skyWay and skyAt take it, so a fragment
// stage (which does not see `nodes`) is handed it by its vertex stage.
// This module touches nothing of a browser: the whole-set check imports it in node.
import { chunk } from '../gpu/wgsl.js';
import { QUAD, FLAG, FORM, PULSE, VIEW } from '../base.js';
import { STAGE } from './spec.js';

const f = v => (Number.isInteger(v) ? `${v}.0` : `${v}`);

chunk('world', /* wgsl */ `
struct e_Node { r0: vec4f, r1: vec4f, r2: vec4f }
struct e_Quad {
  node: u32, sheet: u32, layer: u32, flags: u32,
  recv: u32, casts: u32, own: u32, seed: f32,
  rect: vec4f,
  tint: vec4f,
  el: u32, form: u32, aux: u32, clip: u32,
  sheer: f32, spare0: u32, spare1: u32, spare2: u32,
}
struct e_Layer { pose0: vec4f, pose1: vec4f, opts0: vec4f, opts1: vec4f, opts2: vec4f }

@group(0) @binding(1) var<storage, read> e_nodes: array<e_Node>;
@group(0) @binding(2) var<storage, read> e_quads: array<e_Quad>;
@group(0) @binding(3) var<storage, read> e_layers: array<e_Layer>;
@group(0) @binding(11) var e_forms: texture_2d<f32>;

const e_QUAD_CARD = ${QUAD.CARD}u;
const e_QUAD_FACING = ${QUAD.FACING}u;
const e_QUAD_PLANE = ${QUAD.PLANE}u;
const e_QUAD_DRAPE = ${QUAD.DRAPE}u;
const e_QUAD_SKY = ${QUAD.SKY}u;
const e_QUAD_INSERT = ${QUAD.INSERT}u;
const e_QUAD_FORM = ${QUAD.FORM}u;
const e_QUAD_KIND = ${QUAD.KIND}u;
${Object.entries(FLAG).map(([k, v]) => `const e_QUAD_${k} = ${v}u;`).join('\n')}
const e_QUAD_NONE = 0xffffffffu;
const e_WORLD_STAGE = ${f(STAGE)};
const e_WORLD_TAU = 6.283185307179586;
const e_WORLD_BEHIND = 1.2626272556789118;
const e_FORM_SIDE = ${FORM.SIDE};
const e_FORM_CELLS = ${f(FORM.SIDE - 1)};
const e_FORMS_ACROSS = 31u;

fn e_quadOf(i: u32) -> e_Quad { return e_quads[i]; }
fn e_quadKind(q: e_Quad) -> u32 { return q.flags & e_QUAD_KIND; }

// the sky's map of a sky quad (its node row's r0: horizon, the stage's width, round)
fn e_skyMap(q: e_Quad) -> vec3f { return e_nodes[q.node].r0.xyz; }
// the direction toward the stage point at of the sky, for a view of that yaw — a backdrop's point in the turn
// nearest the gaze
fn e_skyWay(at: vec2f, map: vec3f, yaw: f32) -> vec3f {
  let o = at.x - 0.5 * e_WORLD_STAGE - yaw;
  return e_skyWayIn(at, map, yaw, floor(o / e_WORLD_TAU + 0.5));
}
// … a backdrop's point in the turn given (place.js backdropWay's turn; looking round there are no turns): the points
// of one turn lie as on one flat piece — a piece of a sheet drawn in one turn is never torn across the turn's back
// (render/quads.js draws a sky quad once for each turn it reaches into; its fragment keeps the turn's own)
fn e_skyWayIn(at: vec2f, map: vec3f, yaw: f32, turn: f32) -> vec3f {
  let up = map.x - at.y;
  if (map.z > 0.5) {
    let b = at.x - 0.5 * e_WORLD_TAU;
    return normalize(vec3f(sin(b), up, -cos(b)));
  }
  let o = at.x - 0.5 * e_WORLD_STAGE - yaw - e_WORLD_TAU * turn;
  let r = atan(o);
  let b = yaw + r;
  return normalize(vec3f(sin(b), up * cos(r), -cos(b)));
}
// whether a way looks at a backdrop within the turn about the gaze of that yaw (its point at most π aside of it — so
// within e_WORLD_BEHIND of the gaze, ahead): there a point of each turn is seen where its piece puts it, past it none
fn e_backdropSees(way: vec3f, yaw: f32) -> bool {
  let ahead = way.x * sin(yaw) - way.z * cos(yaw);
  let aside = way.x * cos(yaw) + way.z * sin(yaw);
  return ahead > 0.0 && abs(aside) <= 0.5 * e_WORLD_TAU * ahead;
}
// … and back: the stage point a way looks at (x unwrapped: it goes on round the circle)
fn e_skyAt(way: vec3f, map: vec3f, yaw: f32) -> vec2f {
  let flat = max(length(way.xz), 1e-6);
  let b = atan2(way.x, -way.z);
  let up = way.y / flat;
  let r = b - yaw - e_WORLD_TAU * floor((b - yaw + 0.5 * e_WORLD_TAU) / e_WORLD_TAU);
  if (map.z > 0.5) { return vec2f(yaw + r + 0.5 * e_WORLD_TAU, map.x - up); }
  let rc = min(abs(r), e_WORLD_BEHIND);
  return vec2f(0.5 * e_WORLD_STAGE + sign(r) * tan(rc) + yaw, map.x - up / cos(rc));
}

// a form's texel: its point (which = 0) or its normal (which = 1) at the grid's place nearest uv
fn e_formTexel(form: u32, uv: vec2f, which: u32) -> vec3f {
  let i = form - 1u;
  let g = vec2u(round(clamp(uv, vec2f(0.0), vec2f(1.0)) * e_FORM_CELLS));
  let at = vec2u(66u * (i % e_FORMS_ACROSS) + 33u * which + g.x, 33u * (i / e_FORMS_ACROSS) + g.y);
  return textureLoad(e_forms, at, 0).xyz;
}

// the point of the quad's sheet at uv (0…1 across its rect), in the sheet's units, after its layer's pose
fn e_quadSheet(q: e_Quad, uv: vec2f) -> vec2f {
  var p = mix(q.rect.xy, q.rect.zw, uv);
  if (q.layer != e_QUAD_NONE) {
    let L = e_layers[q.layer];
    let pivot = L.opts0.xy;
    let c = cos(L.pose0.z);
    let s = sin(L.pose0.z);
    let d = (p - pivot) * vec2f(L.pose0.w, L.pose1.x);
    p = pivot + vec2f(c * d.x - s * d.y, s * d.x + c * d.y) + L.pose0.xy;
  }
  return p;
}
// uv 0…1 across its rect → the point in the node's plane (x right, y up, z off its face), after the layer's pose;
// a form: its grid's point there; the sky and an insert: the sheet's point (x, −y, 0)
fn e_quadPoint(q: e_Quad, uv: vec2f) -> vec3f {
  let kind = q.flags & e_QUAD_KIND;
  if (kind == e_QUAD_FORM) {
    var g = e_formTexel(q.form, uv, 0u);
    if ((q.flags & e_QUAD_FLIP) != 0u) { g.x = -g.x; }
    return g;
  }
  var p = e_quadSheet(q, uv);
  var depth = 0.0;
  if (q.layer != e_QUAD_NONE) { depth = e_layers[q.layer].opts1.w; }
  if ((q.flags & e_QUAD_FLIP) != 0u && kind != e_QUAD_SKY && kind != e_QUAD_INSERT) { p.x = -p.x; }
  return vec3f(p.x, -p.y, depth);
}
// → the world less the origin; FACING turned by the view's yaw (the other kinds: above)
fn e_quadWorld(q: e_Quad, p: vec3f, yaw: f32) -> vec3f {
  let kind = q.flags & e_QUAD_KIND;
  let n = e_nodes[q.node];
  if (kind == e_QUAD_SKY) { return e_skyWay(vec2f(p.x, -p.y), n.r0.xyz, yaw); }
  if (kind == e_QUAD_INSERT) { return vec3f(p.x - 0.5 * e_WORLD_STAGE, -p.y, 0.0); }
  if (kind == e_QUAD_FACING) {
    let s = length(vec3f(n.r0.x, n.r1.x, n.r2.x));
    let c = cos(yaw);
    let sn = sin(yaw);
    return vec3f(n.r0.w + s * (p.x * c - p.z * sn), n.r1.w + s * p.y, n.r2.w + s * (p.x * sn + p.z * c));
  }
  let l = vec4f(p, 1.0);
  var w = vec3f(dot(n.r0, l), dot(n.r1, l), dot(n.r2, l));
  if (kind == e_QUAD_DRAPE) { w.y = w.y + e_reliefAt(w.xz); }
  return w;
}
// the surface's turn there (unit, the world's): constant for flat kinds, the grid's for a form
fn e_quadNormal(q: e_Quad, uv: vec2f, yaw: f32) -> vec3f {
  let kind = q.flags & e_QUAD_KIND;
  if (kind == e_QUAD_SKY || kind == e_QUAD_INSERT) { return vec3f(0.0, 0.0, 1.0); }
  if (kind == e_QUAD_FACING) { return vec3f(-sin(yaw), 0.0, cos(yaw)); }
  let n = e_nodes[q.node];
  if (kind == e_QUAD_FORM) {
    var g = e_formTexel(q.form, uv, 1u);
    if ((q.flags & e_QUAD_FLIP) != 0u) { g.x = -g.x; }
    return normalize(vec3f(dot(n.r0.xyz, g), dot(n.r1.xyz, g), dot(n.r2.xyz, g)));
  }
  return normalize(vec3f(n.r0.z, n.r1.z, n.r2.z));
}
// whether a point of an insert's sheet (stage heights) is inside its iris as far as it is open
fn e_insertThere(q: e_Quad, at: vec2f) -> bool {
  let iris = e_insertOf(q.aux);
  let open = e_insertOpen(q.aux);
  if (open <= 0.0) { return false; }
  let d = (at - iris.xy) / (iris.zw * open);
  return dot(d, d) < 1.0;
}
// 1, or the pulse of an offered thing, or the steady brightness of a selected one (IN3); 1 in a mirror's view
fn e_quadGlow(q: e_Quad) -> f32 {
  if ((e_view.flags & ${VIEW.MIRROR}u) != 0u) { return 1.0; }
  if ((q.flags & e_QUAD_SELECTED) != 0u) { return ${f(1 + PULSE.DEPTH)}; }
  if ((q.flags & e_QUAD_OFFERED) != 0u) { return e_frame.pulse; }
  return 1.0;
}
`);
