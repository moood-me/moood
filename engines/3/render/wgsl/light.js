// The scene's light at a point, the shadows that fall there and the air before it (5.5; render/lights.js and
// render/shadows.js lay them out for the GPU). The model is main's — it is part of the look: what faces a way (a
// plane, a card turned its own way, a form, a person's skin: N, has 1) is lit by how it is turned to each light,
// wrapped (a light at its side still lights it half); what faces no way of its own (an upright card that faces the
// eye: has 0) is lit by the far lights evenly — less by those beyond what is seen — and by a near one as something
// rounded turned to the eye. A point light reaches as (1 − x²)² of its reach — a beam only within its cone, its edge
// fading from the cosine where it begins to the cosine of the edge; a window from the point of it nearest,
// only before its face; a far light coming in through panes reaches what sees it through one, its edge soft; what is
// `inside` keeps the share of the far light and the ambient that comes in. What lets light through (a quad's `sheer`:
// a sail, leaves, paper; an emitter's for its particles) is lit from behind too: every light, far or near, adds to
// how it is faced sheer · max(0, −(the way to the eye) · (the way to the light)). In linear light: each light's
// colour is
// linear; each term's own amount (its strength, its falloff, how it faces) is the painted engine's, taken to linear
// (e_lin) term by term.
//   WHERE it is worked out: where a thing's vertices are — never in a fragment of what blends. What is opaque and
// takes shadows (a receiver) leaves the SHADOW.KEYS first casting lights to its pixels, which work those lights out
// whole (e_keys): a lamp's pool on a floor is sharp.
//   Lights: the lit set (render/lights.js), a row each — far lights first, then those through panes, then the beams,
// then points and windows, found through a grid over the level (cells across x and z: each its count, then its rows).
//   Shadows (5.5): two atlases of depth (reversed), read through one comparison sampler — the hardware's 2 × 2 —,
// two compare reads a casting light (what stands, what moves). A slot is a casting light: its row of the lit set
// (−1: it casts nothing now), its kind (0 a far light's two cascades, 1 a point's faces, 2 a window's one view),
// what each of its two maps stops of the light (the strongest of its casters) and the receivers they fall on (the
// union of its casters'); a view: its matrix (the world less the origin → its clip space), its cell of the atlases
// (x, y, side: shares of the atlas's side — the same in both) and the metres a texel of it spans (a far light's; a
// metre away, a point's and a window's).
//   The air (5.18): the haze between the eye and a thing D away tints it toward the haze's colour, 1 − e^(−D/reach);
// the light in it (render/air.js: shafts, the lamps' glow) is a small volume of the frame's view read by whatever is
// hazed, where it stands — two filtered reads of a small texture and a mix. Not in a mirror's view nor a light's.
//   e_landShade(i, P) — how much of light i the land's own rises let reach P — is the land's (render/wgsl/land.js: the
// view's field; 1 in a program drawn through no view's group).
//   The normal is taken as it is given: what is seen from both its sides (a quad) is turned to the eye by its caller
// (e_faced) — a person's is not (PP9).
// options.shadows: whether the program reads the shadow maps at all (a plain quad's does not).
import { chunk } from '../../gpu/wgsl.js';
import { LIGHT, SHADOW } from '../../base.js';
import { AIR, GRID, LIT, SHADOWS } from './frame.js';

// the far lights and the lights through panes the lit set holds at the most (the air's shafts' bound); with the
// beams, the rows before the grid's (the light's loop's bound with a cell's)
export const SKY_LIGHTS = LIGHT.FAR_MOST + LIGHT.THROUGH_MOST;
const LEADING = SKY_LIGHTS + LIGHT.SPOT_MOST;
// a beam's light thins with the square of the distance, as a real beam's — spread over a cross-section that grows —:
// it is as strong as its strength says at this share of its reach (what it lights nearer is lit no more than that; its
// light in the air nearer grows on, to post.js BEAM_NEAR — render.beam)
export const BEAM_FIELD = 0.1;
// how much of the light all round the people standing near take (the blob map)
const AO = 0.75;

const light = ({ shadows = true } = {}) => /* wgsl */ `
fn e_lin(k: f32) -> f32 { return pow(max(k, 0.0), 2.2); }
fn e_facing(n: vec3f, v: vec3f) -> f32 { return clamp((dot(n, v) + 0.5) / 1.5, 0.0, 1.0); }
fn e_rounded(P: vec3f, v: vec3f) -> f32 { return mix(0.3, 1.0, smoothstep(-0.45, 0.5, dot(normalize(e_view.eye - P), v))); }
// (a far light on what faces no way: less from beyond what is seen)
fn e_evenly(d: vec3f) -> f32 { return 1.0 - 0.7 * clamp(dot(d, e_frame.e_gaze) / 0.3, 0.0, 1.0); }
// a face seen from both its sides (a quad's: has > 0), turned to the eye
fn e_faced(P: vec3f, N: vec3f, has: f32) -> vec3f {
  if (has > 0.0 && dot(N, e_view.eye - P) < 0.0) { return -N; }
  return N;
}
// the light all round, as much of it as comes inside
fn e_around(inside: f32) -> vec3f { return e_frame.e_ambient * e_lin(mix(1.0, e_frame.e_inside, inside)); }

// the points and windows near P: its cell of the grid — (where its rows begin, how many); none off the grid
fn e_cell(P: vec3f) -> vec2u {
  let c = (P.xz - e_frame.e_grid.xy) * e_frame.e_grid.z;
  if (c.x < 0.0 || c.y < 0.0 || c.x >= e_frame.e_grid.w || c.y >= e_frame.e_grid.w) { return vec2u(0u, 0u); }
  let w = (u32(c.y) * ${GRID.SIDE}u + u32(c.x)) * ${GRID.WORDS}u;
  return vec2u(w + 1u, min(e_lightGrid[w], ${LIGHT.CELL}u));
}
// whether row i of the lit set is a beam's: the rows after the far and the through lights
fn e_isBeam(i: u32) -> bool {
  let first = e_frame.e_farN + e_frame.e_throughN;
  return i >= first && i < first + e_frame.e_spotN;
}
// how much of a beam's light goes the way \`along\` (unit, from the light): all of it within where its edge begins,
// none past its edge
fn e_beamEdge(L: e_Light, along: vec3f) -> f32 { return smoothstep(L.d.w, L.e.x, dot(along, L.d.xyz)); }
// how much of its light a beam (reach R) has l away, of its strength's: (BEAM_FIELD · R / l)²
fn e_beamSpread(l: f32, R: f32) -> f32 { let f = ${BEAM_FIELD} * R / max(l, 1e-4); return f * f; }
// how much of a light through panes reaches P: all of it before its panes (outside), what they let through past them
fn e_through(L: e_Light, P: vec3f, inside: f32) -> f32 {
  let first = ${LIT.PLANE0}u + u32(L.d.x);
  let count = u32(L.d.y);
  var deep = 0.0;
  var past = 0.0;
  if (inside > 0.5) { past = 1.0; }
  for (var g = 0u; g < ${LIT.PLANES}u; g++) {
    if (g >= count) { break; }
    let R = e_lights[first + g];
    let at = vec2f(dot(R.b.xyz, P) + R.b.w, dot(R.c.xyz, P) + R.c.w);
    let m = textureSampleLevel(e_panes, e_linear, (R.d.xy + clamp(at, vec2f(0.5), R.d.zw - 0.5)) / vec2f(textureDimensions(e_panes)), 0.0).r;
    var beyond = 0.0;
    if (dot(R.a.xyz, P) + R.a.w > 0.0) { beyond = 1.0; }
    deep = max(deep, m * beyond);
    past = max(past, beyond);
  }
  if (past > 0.5) { return deep; }
  return 1.0;
}
// how much of the light coming along \`way\` (toward the light) a thing at P that lets \`sheer\` of it through shows
// from behind
fn e_behind(P: vec3f, way: vec3f, sheer: f32) -> f32 {
  if (sheer <= 0.0) { return 0.0; }
  return sheer * max(0.0, -dot(normalize(e_view.eye - P), way));
}
// light i's term at P, before any shadow: its colour as much as comes there and as it is faced (sheer: how much of
// the light behind it comes through)
fn e_term(i: u32, P: vec3f, N: vec3f, has: f32, inside: f32, sheer: f32) -> vec3f {
  let L = e_lights[i];
  if (L.a.w < 1.5) {
    var k = mix(1.0, e_frame.e_inside, inside);
    if (L.a.w > 0.5) { k = e_through(L, P, inside); }
    return L.b.rgb * e_lin(L.b.w * k * (mix(e_evenly(L.a.xyz), e_facing(N, L.a.xyz), has) + e_behind(P, L.a.xyz, sheer)));
  }
  var d = L.a.xyz - P;
  var l = length(d);
  var g = 1.0;
  var reaches = L.c.w <= 0.5 || inside >= 0.5;
  if (L.a.w > 2.5) {
    // a window: from the point of it nearest P, before its face only
    let e = -d;
    let front = dot(e, normalize(cross(L.d.xyz, L.e.xyz))) * L.d.w;
    d = L.d.xyz * clamp(dot(e, L.d.xyz) / max(dot(L.d.xyz, L.d.xyz), 1e-8), -1.0, 1.0) + L.e.xyz * clamp(dot(e, L.e.xyz) / max(dot(L.e.xyz, L.e.xyz), 1e-8), -1.0, 1.0) - e;
    l = max(length(d), 1e-4);
    g = front / l;
    reaches = reaches && front > 0.0;
  }
  let x = l / max(L.c.x, 1e-4);
  if (!reaches || x >= 1.0) { return vec3f(0.0); }
  let way = d / max(l, 1e-4);
  let fall = L.b.w * e_flickerOf(L.c.y, L.c.z) * (1.0 - x * x) * (1.0 - x * x) * g;
  if (e_isBeam(i)) {
    // (a beam: within its cone; thinning with the square of the distance past BEAM_FIELD of its reach; what faces a way
    // takes it by the cosine, unwrapped — a beam along the ground lights it as thinly as it grazes it —; dimmed by
    // the haze between the light and P)
    let faced = mix(e_rounded(P, way), max(dot(N, way), 0.0), has) + e_behind(P, way, sheer);
    return L.b.rgb * e_lin(fall * faced) * min(1.0, e_beamSpread(l, L.c.x)) * e_beamEdge(L, -way) * exp(-l / e_frame.e_hazeReach);
  }
  return L.b.rgb * e_lin(fall * (mix(e_rounded(P, way), e_facing(N, way), has) + e_behind(P, way, sheer)));
}
${shadows ? /* wgsl */ `
// how much of slot s's light arrives at P (N: its face; recv: the receivers it is) past what its maps hold
fn e_shadowAt(s: u32, P: vec3f, N: vec3f, recv: u32) -> f32 {
  let S = e_shadows.slot[s];
  if (S.light < 0) { return 1.0; }
  var on = S.stop.xy;
  if ((S.onto.x & recv) == 0u) { on.x = 0.0; }
  if ((S.onto.y & recv) == 0u) { on.y = 0.0; }
  if (on.x + on.y <= 0.0) { return 1.0; }
  let L = e_lights[u32(S.light)];
  var v = s * ${SHADOWS.VIEWS}u;
  var toward = L.a.xyz;
  var far = 1.0;
  if (S.kind == 0u) {
    // (a far light: the first cascade whose square holds P)
    let c = e_shadows.view[v].vp * vec4f(P, 1.0);
    if (max(abs(c.x), abs(c.y)) > 0.94 * c.w || e_shadows.view[v].cell.z <= 0.0) { v += 1u; }
  } else {
    let e = P - L.a.xyz;
    far = length(e);
    toward = -e / max(far, 1e-6);
    if (S.kind == 1u) {
      // (a point: the face its way from the light is most along)
      let m = abs(e);
      if (m.x >= m.y && m.x >= m.z) { if (e.x <= 0.0) { v += 1u; } }
      else if (m.y >= m.z) { if (e.y > 0.0) { v += 2u; } else { v += 3u; } }
      else if (e.z > 0.0) { v += 4u; } else { v += 5u; }
    }
  }
  let V = e_shadows.view[v];
  if (V.cell.z <= 0.0) { return 1.0; }
  var n = N;
  if (dot(n, toward) < 0.0) { n = -n; }
  // (off its face toward the light by two texels of the map there: no shadow of itself)
  let q = V.vp * vec4f(P + n * (2.0 * V.cell.w * far), 1.0);
  if (q.w <= 0.0) { return 1.0; }
  let at = q.xyz / q.w;
  if (abs(at.x) >= 1.0 || abs(at.y) >= 1.0 || at.z <= 0.0 || at.z > 1.0) { return 1.0; }
  // (kept a texel of the coarser atlas within its cell: the 2 × 2 compare reads no neighbour's)
  let lo = V.cell.xy + vec2f(e_shadows.texel.y);
  let uv = clamp(V.cell.xy + (at.xy * vec2f(0.5, -0.5) + 0.5) * V.cell.z, lo, max(lo, V.cell.xy + vec2f(V.cell.z - e_shadows.texel.y)));
  var kept = 1.0;
  if (on.x > 0.0) { kept *= 1.0 - on.x * (1.0 - textureSampleCompareLevel(e_shadowStatic, e_shadowSampler, uv, at.z)); }
  if (on.y > 0.0) { kept *= 1.0 - on.y * (1.0 - textureSampleCompareLevel(e_shadowMovers, e_shadowSampler, uv, at.z)); }
  return kept;
}
// the key lights (the first SHADOW.KEYS casting ones) worked out whole where a receiver's pixel is
fn e_keys(P: vec3f, N: vec3f, has: f32, inside: f32, recv: u32, sheer: f32) -> vec3f {
  var L = vec3f(0.0);
  for (var s = 0u; s < ${SHADOW.KEYS}u; s++) {
    let i = e_shadows.slot[s].light;
    if (i >= 0) { L += e_term(u32(i), P, N, has, inside, sheer) * e_shadowAt(s, P, N, recv) * e_landShade(u32(i), P); }
  }
  return L;
}
` : ''}
// what the people standing near leave of the light all round P (1: all of it): the blob map there, as far as P is
// level with its floor. One read; from a vertex or a fragment
fn e_blobAt(P: vec3f) -> f32 {
  let uv = (P.xz - e_shadows.blob.xy) * e_shadows.blob.z;
  if (e_shadows.blob.z <= 0.0 || uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0) { return 1.0; }
  return 1.0 - ${AO} * textureSampleLevel(e_blob, e_linear, uv, 0.0).r * (1.0 - smoothstep(0.25, 0.9, abs(P.y - e_shadows.blob.w)));
}

// The light at P: base — all of it (the light all round and every light's term in its shadow); around — of it, the
// light all round without the sources' (a person's rim is the rest). keys: a receiver — the first SHADOW.KEYS
// casting lights are left to its pixels (e_keys). occlusion: what the people near leave of the light all round (0: a
// solid receiver's vertex — its pixels add the light all round themselves). sheer: how much of the light behind it
// comes through (0: none).
struct e_Lit { base: vec3f, around: vec3f }
fn e_lightOn(P: vec3f, N: vec3f, has: f32, inside: f32, recv: u32, keys: bool, occlusion: f32, sheer: f32) -> e_Lit {
  var o: e_Lit;
  o.around = e_around(inside) * occlusion;
  var L = o.around;
  let cell = e_cell(P);
  let sky = e_frame.e_farN + e_frame.e_throughN + e_frame.e_spotN;
  let all = sky + cell.y;
  for (var n = 0u; n < ${LEADING + LIGHT.CELL}u; n++) {
    if (n >= all) { break; }
    var i = n;
    if (n >= sky) { i = e_lightGrid[cell.x + n - sky]; }
    var shade = 1.0;
    var key = false;
${shadows ? /* wgsl */ `    for (var s = 0u; s < ${SHADOW.LIGHTS}u; s++) {
      if (e_shadows.slot[s].light == i32(i)) {
        if (keys && s < ${SHADOW.KEYS}u) { key = true; } else if (recv != 0u) { shade = e_shadowAt(s, P, N, recv); }
      }
    }
` : ''}    if (!key) { L += e_term(i, P, N, has, inside, sheer) * shade * e_landShade(i, P); }
  }
  o.base = L;
  return o;
}

// the light in the air between the eye and P
fn e_airLight(P: vec3f) -> vec3f {
  if (e_frame.e_airIn.x <= 0.0 || (e_view.flags & (e_VIEW_MIRROR | e_VIEW_CAST)) != 0u) { return vec3f(0.0); }
  let c = e_frame.e_airVP * vec4f(P, 1.0);
  let at = clamp((c.xy / max(c.w, 1e-6) * vec2f(0.5, -0.5) + 0.5) * vec2f(${AIR.W}.0, ${AIR.H}.0), vec2f(0.5), vec2f(${AIR.W - 0.5}, ${AIR.H - 0.5}));
  // (its depth among the volume's: before the first of them, as much of that one's light as it is of the way there)
  let s = log2(1.0 + max(c.w, 0.0) * e_frame.e_airIn.y) * e_frame.e_airIn.z * ${AIR.S}.0 - 0.5;
  let s0 = clamp(floor(s), 0.0, ${AIR.S - 1}.0);
  let s1 = min(s0 + 1.0, ${AIR.S - 1}.0);
  let t0 = vec2f(s0 - ${AIR.TX}.0 * floor(s0 / ${AIR.TX}.0), floor(s0 / ${AIR.TX}.0));
  let t1 = vec2f(s1 - ${AIR.TX}.0 * floor(s1 / ${AIR.TX}.0), floor(s1 / ${AIR.TX}.0));
  let tile = vec2f(${AIR.W}.0, ${AIR.H}.0);
  let whole = 1.0 / vec2f(${AIR.W * AIR.TX}.0, ${AIR.H * AIR.TY}.0);
  return mix(textureSampleLevel(e_air, e_linear, (t0 * tile + at) * whole, 0.0).rgb, textureSampleLevel(e_air, e_linear, (t1 * tile + at) * whole, 0.0).rgb, clamp(s - s0, 0.0, 1.0)) * clamp(2.0 * s + 1.0, 0.0, 1.0);
}
// the air before P: its own light (premultiplied) — the haze's colour as much as there is of it, the light scattered
// in it — and how much of P it hides
fn e_airAt(P: vec3f) -> vec4f {
  let h = 1.0 - exp(-length(P - e_view.eye) / e_frame.e_hazeReach);
  return vec4f(e_frame.e_haze * h + e_airLight(P), h);
}
`;

chunk('render.light', light);
