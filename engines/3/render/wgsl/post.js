// The engine's own pictures and what is laid over the paintings (4.4): a mirror's overlay and the smear of a rough
// mirror's image, the lights' glows, the people's blob map, the light in the air (and over the sky), the bloom, the
// light gathered for the bounce, and the canvas pass — the frame's one full-screen pass after the main ones: bounce,
// the people's lines (from `ids`), bloom, tone map, grade, edge smoothing (five taps of `main`, tone-mapped), grain,
// the stage's veil, dither. The canvas is written display-encoded.
import { chunk } from '../../gpu/wgsl.js';
import { GLOW, SHADOW } from '../../base.js';
import { AIR } from './frame.js';
import { SKY_LIGHTS } from './light.js';

// the canvas pass's uniform (render/post.js writes it)
export const CANVAS = Object.freeze({ BYTES: 128, STAGE: 0, SIZE: 16, NEAR: 24, VEIL: 28, EXPOSURE: 32, BLOOM: 36, BOUNCE: 40, TINT_A: 44, TINT: 48, SAT: 60, AMBIENT: 64, VIG: 76,
  GRAIN: 80, LINES: 84, SCALE: 88, TICK: 92, UNPROJECT: 96, HAZE: 112 });
// a mirror's overlay's uniform (render/mirrors.js writes it)
export const MIRROR = Object.freeze({ BYTES: 160, VP: 0, PLANE: 64, PARAMS: 80, AXIS: 96, AT: 112, WAVE: 128, PACE: 144 });
// a ripple's four waves: how many times a second each goes by at `pace` 1 (the longest, 2.6 m, first; each next
// 0.55 of the one before) — f32 values, written into the overlay as they are, so that render/mirrors.js shifts their
// phases by the very numbers the overlay goes by
export const RIPPLE_HZ = Object.freeze([0, 1, 2, 3].map(i => Math.fround((1.1 + 0.4 * i) / Math.sqrt(2.6 * 0.55 ** i * 6))));
// A ripple's pace moved from `from` to `to` at the scene's second t: each wave's phase shift (shift: four, each 0…1;
// changed in place) so that where it is in its cycle — fract(its hz · pace · t + its shift), the overlay's
// arithmetic — goes on from where it was, not jumping. The products are the overlay's own f32 ones
export function ripplePaced(shift, t, from, to) {
  const a = Math.fround(from), b = Math.fround(to);
  for (let i = 0; i < 4; i++) {
    const s = shift[i] + (Math.fround(RIPPLE_HZ[i] * a) - Math.fround(RIPPLE_HZ[i] * b)) * t;
    shift[i] = s - Math.floor(s);
  }
}
// the smear's uniform of a rough mirror's image (render/mirrors.js writes it)
export const READY = Object.freeze({ BYTES: 32 });
// a light's halo in the air: a row (render/lights.js writes them) — three vec4f
export const HALO = Object.freeze({ BYTES: 48 });
// a beam in the haze (render.beam): the samples along a pixel's stretch of it (each pair one read of its shadow
// maps); the nearest to its light its spread grows to (metres: about its lantern — where BEAM_FIELD of its reach is
// nearer, there, as on what it lights); its lit haze's depth a metre, × hazeGlow / the haze's reach (the haze's own
// is 1 / its reach: the haze lit by a beam glows BEAM_DEPTH times what it scatters by its reach alone — the medium's
// gain, as the lamps' halos have theirs); how much more the haze scatters it forward than back (HG's g); the most a
// beam adds to a pixel, a channel — far past any white, only so that two beams over the scene stay a number in
// `main` (rg11b10ufloat: 65 024 at the most; past it a pixel is no number, and the canvas pass drops it)
const BEAM_TAPS = 4, BEAM_DEPTH = 12, BEAM_NEAR = 6, BEAM_FORWARD = 0.35, BEAM_MOST = 16384;

// A mirror at X (a point of its plane, where the pixel sees it): its image there — ONE read of it —, as strong as it
// says, for as much of the mirror as is painted there; small waves (ripple: in its metres, those finer than a pixel
// left out) tip it, read that much aside; they go by `pace` times as fast as at 1, each from its phase shift (a pace
// that moved: render/mirrors.js keeps them going on from where they were). The image's alpha is how much of a mirror
// image there is (5.7): a plane lays image.rgba · strength · paint over its own painting — where nothing is mirrored
// its paint shows as painted. A pane of glass: the room before it, added — it shows on the dark, hardly on the light
// (its strength comes times how dark it is beyond the glass: render/mirrors.js). The image is of what the mirror covers of the frame and its
// margin: the used part of its texture; a rough mirror's is read smeared (`render.mirror.ready`).
chunk('render.mirror', ({ mode }) => /* wgsl */ `
struct e_Mirror {
  vp: mat4x4f,         // the world less the origin → the image's rect, as it was drawn
  plane: vec4f,        // the mirror's plane (n toward the eye, d)
  params: vec4f,       // strength, ripple, rough, 1: there is an image now
  axis: vec4f,         // the way the plane's normal goes across the image (x, y: a unit of its px); how far a frame's height is across its rect (z, w)
  at: vec4f,           // the used part of the image's texture (x, y, w, h: shares of it)
  wave: vec4f,         // the ripple's four waves' phase shifts (0…1)
  pace: vec4f,         // how fast the ripple goes (x: 1 as RIPPLE_HZ say)
}
@group(2) @binding(0) var<uniform> e_mirror: e_Mirror;
@group(2) @binding(1) var e_image: texture_2d<f32>;
fn e_rippleAxis(k: i32) -> vec3f {
  let n = e_mirror.plane.xyz;
  var up = vec3f(1.0, 0.0, 0.0);
  if (abs(n.y) < 0.9) { up = vec3f(0.0, 1.0, 0.0); }
  let t = normalize(cross(n, up));
  if (k == 0) { return t; }
  return cross(n, t);
}
@fragment fn e_fragment(in: e_Out) -> @location(0) vec4f {
  let dx = dpdx(in.at);
  let dy = dpdy(in.at);
  let on = vec2f(dot(in.world, e_rippleAxis(0)), dot(in.world, e_rippleAxis(1)));
  let fine = length(abs(dpdx(on)) + abs(dpdy(on)));
  let p = e_sheetRead(e_sheetFrom(e_SheetCarry(in.sa, in.sb)), in.page, e_readAt(in), dx, dy, e_taps(in.info.x)).a * e_amount(in);
  if (e_mirror.params.w < 0.5 || p < 1.0 / 512.0) { discard; }
  let c = e_mirror.vp * vec4f(in.world, 1.0);
  var q = c.xy / c.w * vec2f(0.5, -0.5) + 0.5;
  if (e_mirror.params.y > 0.0) {
    // (the waves where they are in the world: its own place, not the render origin's)
    let W = in.world + e_frame.e_origin;
    let at = vec2f(dot(W, e_rippleAxis(0)), dot(W, e_rippleAxis(1)));
    var tilt = vec2f(0.0);
    let hz = vec4f(${RIPPLE_HZ.join(', ')}) * e_mirror.pace.x;
    for (var i = 0; i < 4; i++) {
      let fi = f32(i);
      let l = 2.6 * pow(0.55, fi);
      let ang = 0.7 + 0.6 * fi;
      let dir = vec2f(cos(ang), sin(ang));
      tilt += dir * cos(6.2832 * (fract(dot(dir, at) / l) - (cycle(hz[i]) + e_mirror.wave[i]))) * (1.0 - smoothstep(0.25, 0.5, fine / l));
    }
    q += (vec2f(e_mirror.axis.y, -e_mirror.axis.x) * tilt.x * 0.4 + e_mirror.axis.xy * tilt.y) * e_mirror.params.y * 0.012 * e_mirror.axis.zw;
  }
  // (past its image's edge — it was drawn for where the mirror was then — its edge: half a texel inside the used part)
  let texel = 0.5 / vec2f(textureDimensions(e_image));
  let image = textureSampleLevel(e_image, e_linear, clamp(e_mirror.at.xy + q * e_mirror.at.zw, e_mirror.at.xy + texel, e_mirror.at.xy + e_mirror.at.zw - texel), 0.0);
  let much = e_mirror.params.x * p;
${mode === 'glass' ? /* wgsl */ `  return vec4f(min(image.rgb * much, vec3f(1.0)), 0.0);
` : /* wgsl */ `  return vec4f(e_dithered(image.rgb * much, in.position.xy), image.a * much);
`}}
`);

// A rough mirror's image smeared, once, after its pass (5.7): along the way the plane's face goes across the image,
// over S = 0.6 · rough of a frame's height — a smear in two steps over the used part of the image. `step`
// (the image → `mirror step`): nine equal taps over ONE spacing of the next step's taps, so those read no gaps (the
// image has no levels). `ready` (`mirror step` → the image's `mirror ready`, what its overlays read): nine taps over
// S weighted exp(−60 u²), colour and alpha together; what shines brighter than white drawn out along the whole
// stretch — the path of light under a lamp, the sun, the moon. Every tap is kept half a texel inside the used part.
chunk('render.mirror.ready', ({ what }) => /* wgsl */ `
struct e_Ready {
  axis: vec4f,         // the way the plane's normal goes across the image (x, y: a unit of its px); S, px of the image
  used: vec4f,         // the used part of the texture, px (x, y); 1 / the texture's side
}
@group(0) @binding(0) var<uniform> e_ready: e_Ready;
@group(0) @binding(1) var e_src: texture_2d<f32>;
@group(0) @binding(2) var e_linear: sampler;
// the source, px aside of a pixel along the axis
fn e_aside(at: vec2f, px: f32) -> vec4f {
  return textureSampleLevel(e_src, e_linear, clamp(at + e_ready.axis.xy * px, vec2f(0.5), e_ready.used.xy - 0.5) * e_ready.used.z, 0.0);
}
@fragment fn e_fragment(in: e_Full) -> @location(0) vec4f {
  let at = in.position.xy;
${what === 'step' ? /* wgsl */ `
  var sum = vec4f(0.0);
  for (var i = 0; i < 9; i++) { sum += e_aside(at, (f32(i) / 8.0 - 0.5) * e_ready.axis.z / 8.0); }
  return sum / 9.0;
` : /* wgsl */ `
  let c = e_aside(at, 0.0);
  var soft = vec4f(0.0);
  var bright = vec3f(0.0);
  var here = vec3f(0.0);
  for (var i = 0; i < 9; i++) {
    let u = f32(i) / 8.0 - 0.5;
    let t = e_aside(at, u * e_ready.axis.z);
    let b = t.rgb * smoothstep(0.9, 2.0, max(t.r, max(t.g, t.b)));
    soft += t * exp(-60.0 * u * u);
    bright += b;
    if (i == 4) { here = b; }
  }
  return vec4f(soft.rgb / max(soft.a, 1e-3) * c.a + max(vec3f(0.0), 3.0 * bright / 9.0 - here), c.a);
`}}
`);

// Light on what glows: a light's glow — a sprite facing the eye, emissive (linear HDR: what is brighter than white
// blooms), depth tested, added. Bright in its middle, 0.4 at a quarter of its radius, none at its edge; flickering as
// its light does — a steady light's glow is steady at GLOW.STEADY (the mean of the shimmer: a still scene
// stays still) —; dimmed by the haze between. A row an instance: a — its place less the origin, its radius; b — its
// colour, how much (below 0: with a bright middle); c — its flicker, its seed, 1 for a sky's glow: a — its way and its
// radius a unit along it, a point at infinity (behind all that stands, unhazed: the sky's own paint is its air).
chunk('render.glow', /* wgsl */ `
struct e_GlowIn { @location(0) a: vec4f, @location(1) b: vec4f, @location(2) c: vec4f }
struct e_GlowOut { @builtin(position) position: vec4f, @location(0) q: vec2f, @location(1) @interpolate(flat) colour: vec4f, @location(2) @interpolate(flat) straight: f32 }
@vertex fn e_vertex(@builtin(vertex_index) i: u32, g: e_GlowIn) -> e_GlowOut {
  var o: e_GlowOut;
  o.q = vec2f(f32(i & 1u), f32(i >> 1u));
  let away = g.c.z > 0.5;
  var e = e_view.rot * select(g.a.xyz - e_view.eye, g.a.xyz, away);
  let hazed = select(exp(-length(e) / e_frame.e_hazeReach), 1.0, away);
  e = vec3f(e.xy + (o.q - 0.5) * vec2f(2.0, -2.0) * g.a.w, e.z);
  o.position = e_view.proj * vec4f(e, select(1.0, 0.0, away));
  var f = ${GLOW.STEADY};
  if (g.c.x > 0.0) { f = e_flickerOf(g.c.x, g.c.y); }
  o.colour = vec4f(g.b.rgb * hazed, g.b.w * f);
  o.straight = g.c.w;
  return o;
}
@fragment fn e_fragment(in: e_GlowOut) -> @location(0) vec4f {
  let r = length(in.q - 0.5) * 2.0;
  if (r >= 1.0) { discard; }
  var p = mix(0.4, 0.0, (r - 0.25) / 0.75);
  if (r < 0.25) { p = mix(1.0, 0.4, r / 0.25); }
  // (c.w 1, "linear": straight from its middle to its rim as the eye sees it — p is what the display shows, ^2.2 its
  // linear light: a canvas's radial gradient, its alpha linear; brighter than ~0.5 linear in the middle, it blooms)
  if (in.straight > 0.5) { p = 1.0 - r; }
  var c = in.colour.rgb * pow(p * abs(in.colour.a), 2.2);
  if (in.colour.a < 0.0) { c *= 1.0 + 6.0 * (1.0 - smoothstep(0.0, 0.2, r)); }
  return vec4f(c, 0.0);
}
`);

// The people's blob map: a quad about each capsule's footprint on the level, dark by how near the ground it is (a
// foot's: all; a chest's: next to none), soft toward its edge; the darkest kept (the target's blending). A row a
// capsule: a — one end less the origin, its radius; b — the other end, its person's feet (their height).
chunk('render.blob', /* wgsl */ `
struct e_BlobAt { at: vec4f }
@group(0) @binding(0) var<uniform> e_blobAt: e_BlobAt;
struct e_BlobIn { @location(0) a: vec4f, @location(1) b: vec4f }
struct e_BlobOut { @builtin(position) position: vec4f, @location(0) at: vec2f, @location(1) @interpolate(flat) seg: vec4f, @location(2) @interpolate(flat) k: vec2f }
@vertex fn e_vertex(@builtin(vertex_index) i: u32, c: e_BlobIn) -> e_BlobOut {
  let q = vec2f(f32(i & 1u), f32(i >> 1u));
  let up = max(min(c.a.y, c.b.y) - c.a.w - c.b.w, 0.0);
  let R = 1.5 * c.a.w + 0.5 * up + 0.1;
  let dark = c.a.w / (c.a.w + up);
  var o: e_BlobOut;
  o.at = mix(min(c.a.xz, c.b.xz) - R, max(c.a.xz, c.b.xz) + R, q);
  o.seg = vec4f(c.a.xz, c.b.xz);
  o.k = vec2f(R, dark * dark);
  let uv = (o.at - e_blobAt.at.xy) * e_blobAt.at.z;
  o.position = vec4f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
  return o;
}
@fragment fn e_fragment(in: e_BlobOut) -> @location(0) vec4f {
  let ba = in.seg.zw - in.seg.xy;
  let pa = in.at - in.seg.xy;
  let d = length(pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0));
  let f = clamp(1.0 - d / in.k.x, 0.0, 1.0);
  return vec4f(in.k.y * f * f * (3.0 - 2.0 * f), 0.0, 0.0, 1.0);
}
`);

// a cell of a shadow atlas emptied (the viewport its cell): the farthest depth over all of it
chunk('render.clear', /* wgsl */ `
@vertex fn e_vertex(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  return vec4f(f32(i32(i & 1u) * 4 - 1), f32(i32(i >> 1u) * 4 - 1), 0.0, 1.0);
}
`);

// a full-screen pass's vertex: one triangle over the target; uv from its top-left
chunk('render.full', /* wgsl */ `
struct e_Full { @builtin(position) position: vec4f, @location(0) uv: vec2f }
@vertex fn e_vertex(@builtin(vertex_index) i: u32) -> e_Full {
  let p = vec2f(f32(i32(i & 1u) * 4 - 1), f32(i32(i >> 1u) * 4 - 1));
  return e_Full(vec4f(p, 0.0, 1.0), vec2f(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5));
}
`);

// The light in the air (5.18): a small volume of the frame's view — AIR.W × AIR.H cells across the frame, AIR.S
// depths, laid out as tiles of one texture — each cell the light the air scatters toward the eye from the eye to
// that depth. Two small passes of the name \`air\`, so the work is one stretch a cell, whatever its depth:
//   the steps — each cell the light of its OWN stretch of its ray (from the depth before its own to its own): the far
//   lights' shafts (the look's shafts: scattered forward more than back, as much as reaches the stretch's middle —
//   through panes, past what the shadow maps hold), drawn by one triangle; and every lamp's halo (the look's hazeGlow:
//   the light's falloff × a bright core integrated along the stretch in closed form), a quad a lamp a depth, added —
//   every light of the world that shines in the view, in the lit set or not (5.5);
//   the sum — each cell its own stretch and all those before it: what the frame reads (render.light e_airLight).
chunk('render.air.ray', /* wgsl */ `
// how far along the gaze the volume's depth w (0…1 of its depths) is
fn e_depthAt(w: f32) -> f32 { return ${AIR.Z0}.0 * (exp2(w / e_frame.e_airIn.z) - 1.0); }
// a cell of the volume, from a pixel of its texture: its ray from the eye (dir: the world's; cosT: how much of it is
// along the gaze), and its own stretch of the ray (t0 … t1, metres)
struct e_AirCell { dir: vec3f, t0: f32, t1: f32 }
fn e_airCell(at: vec2f) -> e_AirCell {
  let p = vec2i(at);
  let tile = p / vec2i(${AIR.W}, ${AIR.H});
  let k = f32(tile.y * ${AIR.TX} + tile.x);
  let uv = (vec2f(p - tile * vec2i(${AIR.W}, ${AIR.H})) + 0.5) / vec2f(${AIR.W}.0, ${AIR.H}.0);
  let dirV = normalize(vec3f((uv.x * 2.0 - 1.0 + e_view.proj[2][0]) / e_view.proj[0][0], (1.0 - uv.y * 2.0 + e_view.proj[2][1]) / e_view.proj[1][1], -1.0));
  let cosT = max(-dirV.z, 1e-3);
  var c: e_AirCell;
  c.dir = normalize(transpose(e_view.rot) * dirV);
  c.t0 = e_depthAt(max(k - 0.5, 0.0) / ${AIR.S}.0) / cosT;
  c.t1 = e_depthAt((k + 0.5) / ${AIR.S}.0) / cosT;
  return c;
}
`);
chunk('render.air', /* wgsl */ `
// how much of a far light the air scatters toward the eye looking at the angle whose cosine to the light is c
fn e_phase(c: f32) -> f32 { return 0.25 * (1.0 - 0.27 * 0.27) / pow(1.0 + 0.27 * 0.27 - 2.0 * 0.27 * c, 1.5); }
// what of far light i reaches P past what the maps hold
fn e_shaft(i: u32, P: vec3f) -> f32 {
  var k = 1.0;
  for (var s = 0u; s < ${SHADOW.LIGHTS}u; s++) { if (e_shadows.slot[s].light == i32(i)) { k = e_shadowAt(s, P, vec3f(0.0), 0xffffffffu); } }
  return k;
}
@fragment fn e_fragment(in: e_Full) -> @location(0) vec4f {
  let cell = e_airCell(in.position.xy);
  let P = e_view.eye + cell.dir * 0.5 * (cell.t0 + cell.t1);
  let share = exp(-cell.t0 / e_frame.e_hazeReach) - exp(-cell.t1 / e_frame.e_hazeReach);
  let sky = e_frame.e_farN + e_frame.e_throughN;
  var L = vec3f(0.0);
  for (var i = 0u; i < ${SKY_LIGHTS}u; i++) {
    if (i >= sky) { break; }
    let F = e_lights[i];
    if (F.b.w > 0.0) {
      var vis = e_shaft(i, P);
      if (i >= e_frame.e_farN) { vis *= e_through(F, P, 0.0); }
      L += F.b.rgb * e_lin(F.b.w) * e_frame.e_shafts * e_phase(dot(cell.dir, F.a.xyz)) * vis * share;
    }
  }
  return vec4f(L, 1.0);
}
`);
// A lamp's halo: a row an instance (a — its place less the origin, its reach; b — its colour, its strength; c — its
// flicker, its seed), six points a depth: over what its reach covers of that depth's tile, where its reach meets that
// depth's stretch at all.
chunk('render.air.halo', /* wgsl */ `
// the share of a point light's glow (reach R) in the air along a ray passing h away (h2 = h²), over [s0, s1] of it
const e_CORE = 0.1;
fn e_airlight(h2: f32, R: f32, s0: f32, s1: f32) -> f32 {
  let R2 = R * R;
  let R4 = R2 * R2;
  let k2 = e_CORE * e_CORE * R2;
  let H2 = k2 + h2;
  let H = sqrt(H2);
  let c0 = (1.0 + e_CORE * e_CORE) * (1.0 + e_CORE * e_CORE);
  let c1 = -2.0 * (1.0 - h2 / R2) / R2 - H2 / R4;
  let I = (s1 * s1 * s1 - s0 * s0 * s0) / (3.0 * R4) + c1 * (s1 - s0) + c0 / H * (atan(s1 / H) - atan(s0 / H));
  let K = sqrt(k2);
  let I0 = 2.0 / (3.0 * R) + 2.0 * R * (-2.0 / R2 - k2 / R4) + 2.0 * c0 / K * atan(R / K);
  return max(I, 0.0) / I0;
}
struct e_HaloIn { @location(0) a: vec4f, @location(1) b: vec4f, @location(2) c: vec4f }
struct e_HaloOut { @builtin(position) position: vec4f, @location(0) @interpolate(flat) a: vec4f, @location(1) @interpolate(flat) colour: vec3f }
@vertex fn e_vertex(@builtin(vertex_index) i: u32, g: e_HaloIn) -> e_HaloOut {
  var o: e_HaloOut;
  o.a = g.a;
  let reach = e_frame.e_hazeReach;
  o.colour = g.b.rgb * e_lin(min(1.0, e_frame.e_hazeGlow * 3.0 * g.a.w / reach * min(1.0, g.b.w) * e_flickerOf(g.c.x, g.c.y)));
  let k = i / 6u;
  let corner = vec2f(f32((0x1cu >> (i % 6u)) & 1u), f32((0x32u >> (i % 6u)) & 1u));
  // (the lamp in the eye's space; the depths its reach spans against this tile's stretch)
  let e = e_view.rot * (g.a.xyz - e_view.eye);
  let d = -e.z;
  let R = g.a.w;
  let d0 = e_depthAt(max(f32(k) - 0.5, 0.0) / ${AIR.S}.0);
  let d1 = e_depthAt((f32(k) + 0.5) / ${AIR.S}.0);
  if (d + R <= d0 || d - R >= d1 || d + R <= 0.0) { o.position = vec4f(0.0, 0.0, -1.0, 1.0); return o; }
  // (what its reach covers of the frame: all of it where the eye is within its reach)
  var lo = vec2f(-1.0);
  var hi = vec2f(1.0);
  if (d - R > 0.05) {
    let mid = vec2f(e_view.proj[0][0] * e.x, e_view.proj[1][1] * e.y) / d - vec2f(e_view.proj[2][0], e_view.proj[2][1]);
    let wide = R * vec2f(e_view.proj[0][0], e_view.proj[1][1]) * (1.0 + length(e.xy) / d) / (d - R);
    lo = max(mid - wide, vec2f(-1.0));
    hi = min(mid + wide, vec2f(1.0));
  }
  let ndc = mix(lo, hi, corner);
  let tile = vec2f(f32(k % ${AIR.TX}u), f32(k / ${AIR.TX}u));
  let uv = (tile + vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5)) / vec2f(${AIR.TX}.0, ${AIR.TY}.0);
  o.position = vec4f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
  return o;
}
@fragment fn e_fragment(in: e_HaloOut) -> @location(0) vec4f {
  let cell = e_airCell(in.position.xy);
  let R = in.a.w;
  let toL = in.a.xyz - e_view.eye;
  let tc = dot(toL, cell.dir);
  let h2 = max(dot(toL, toL) - tc * tc, 0.0);
  let half_ = sqrt(max(R * R - h2, 0.0));
  let s0 = max(cell.t0 - tc, -half_);
  let s1 = min(cell.t1 - tc, half_);
  var L = vec3f(0.0);
  if (s1 > s0) { L = in.colour * e_airlight(h2, R, s0, s1) * exp(-(tc + 0.5 * (s0 + s1)) / e_frame.e_hazeReach); }
  return vec4f(L, 0.0);
}
`);
// A beam in the haze (5.18), worked out per pixel where it is seen: an instance a beam of the lit set (its row: the
// first after the through lights, and on), drawn in `main-blend` after what blends as the box about its cone within
// its reach — 36 points, only its faces that look away from the eye drawn (a face toward the eye is dropped whole in
// the vertex stage, judged at its middle: the face behind it has the pixel, so every pixel of the box is drawn once;
// with the eye inside the box every face is behind it) — so its cost is the beam's own part of the screen, as sharp
// as the screen, with no volume's cells. A pixel meets its ray with the cone
// (within its edge, before the light, within its reach, short of what the scene shows there — the solid depth) and
// gathers the light its lit haze sends toward the eye on that stretch, BEAM_TAPS samples at fixed even places along
// it (no noise: a still frame shows no grain), as light through a glowing medium: each sample gives its source — the
// light there as it lights what it falls on, its strength carried whole (its colour × e_lin(its strength × its
// falloff) × e_beamSpread: (BEAM_FIELD of its reach / its distance)², growing no nearer than BEAM_NEAR or BEAM_FIELD
// of its reach, whichever is nearer — never less than what it lights there — × e^(−its distance / the haze's
// reach): dimmed on its way out as on what it lights) × how the haze scatters it toward the eye (e_beamPhase,
// Henyey–Greenstein normalised: 1 on average, at most (1 + g) / (1 − g)² toward the lamp) × what its shadow maps let
// through (one read a pair of samples) × the haze before it — times 1 − e^(−its depth), and what is beyond is dimmed
// by e^(−its depth). The lit haze's depth: the cone's edge × hazeGlow × BEAM_DEPTH / the haze's reach, a metre — so
// crossing a beam takes in its chord: its brightness aside goes as its strength × its chord, as a real beam's:
// brightest by its light, thinning as 1 / distance (its light 1 / distance², its chord × distance), never as an omni
// lamp's. A pixel never shows more than the brightest source on its stretch, nor more than BEAM_MOST; a thicker haze
// glows more. Group 2: the scene's depth (`beam`).
chunk('render.beam', /* wgsl */ `
@group(2) @binding(0) var e_sceneDepth: texture_depth_2d;
// how much of a beam the haze scatters toward the eye looking at the angle whose cosine to the way toward its light
// is c (Henyey–Greenstein, g = BEAM_FORWARD, normalised to 1 over all ways)
fn e_beamPhase(c: f32) -> f32 {
  let g = ${BEAM_FORWARD};
  return (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * c, 1.5);
}
struct e_BeamOut {
  @builtin(position) position: vec4f, @location(0) world: vec3f, @location(1) @interpolate(flat) row: u32,
  @location(2) @interpolate(flat) slot: i32, @location(3) @interpolate(flat) colour: vec3f,
  // (the lit haze's depth a metre of the ray where its edge is whole; its strength now)
  @location(4) @interpolate(flat) thick: f32, @location(5) @interpolate(flat) power: f32,
}
@vertex fn e_vertex(@builtin(vertex_index) i: u32, @builtin(instance_index) b: u32) -> e_BeamOut {
  // (the box's corners: bit 0 across, bit 1 up, bit 2 along the beam; its faces two triangles each)
  var corners = array<u32, 36>(0u, 2u, 4u, 2u, 6u, 4u, 1u, 3u, 5u, 3u, 7u, 5u, 0u, 1u, 4u, 1u, 5u, 4u,
    2u, 3u, 6u, 3u, 7u, 6u, 0u, 1u, 2u, 1u, 3u, 2u, 4u, 5u, 6u, 5u, 7u, 6u);
  var o: e_BeamOut;
  o.row = e_frame.e_farN + e_frame.e_throughN + b;
  let L = e_lights[o.row];
  o.colour = L.b.rgb;
  o.power = L.b.w * e_flickerOf(L.c.y, L.c.z);
  let D = L.d.xyz;
  var up = vec3f(0.0, 1.0, 0.0);
  if (abs(D.y) > 0.9) { up = vec3f(1.0, 0.0, 0.0); }
  let U = normalize(cross(D, up));
  let V = cross(U, D);
  // (within its reach: along its way from the light to the reach, sideways the reach × the sine of its edge)
  let R = L.c.x;
  let r = R * sqrt(max(1.0 - L.d.w * L.d.w, 0.0));
  let k = corners[i];
  let at = vec3f(f32(k & 1u), f32((k >> 1u) & 1u), f32((k >> 2u) & 1u));
  o.world = L.a.xyz + D * (R * at.z) + (U * (2.0 * at.x - 1.0) + V * (2.0 * at.y - 1.0)) * r;
  // (its face's outward way and middle: a face toward the eye — or edge-on — dropped, all six of its points alike)
  let f = i / 6u;
  var n = -U;
  var h = r;
  if (f == 1u) { n = U; } else if (f == 2u) { n = -V; } else if (f == 3u) { n = V; } else if (f == 4u) { n = -D; h = 0.5 * R; } else if (f == 5u) { n = D; h = 0.5 * R; }
  if (dot(n, L.a.xyz + D * (0.5 * R) + n * h - e_view.eye) <= 0.0) { o.position = vec4f(0.0, 0.0, -1.0, 1.0); return o; }
  // (the slot it casts in, if any; the lit haze's depth a metre)
  o.slot = -1;
  for (var s = 0; s < ${SHADOW.LIGHTS}; s++) { if (e_shadows.slot[s].light == i32(o.row)) { o.slot = s; } }
  o.thick = e_frame.e_hazeGlow * ${BEAM_DEPTH}.0 / e_frame.e_hazeReach;
  o.position = e_clip(o.world);
  return o;
}
@fragment fn e_fragment(in: e_BeamOut) -> @location(0) vec4f {
  let L = e_lights[in.row];
  let R = L.c.x;
  let D = L.d.xyz;
  let c = L.d.w;
  let dir = normalize(in.world - e_view.eye);
  // how far along the ray the scene is: its depth there, met by the ray's own (clip z and w go evenly with t)
  let z = textureLoad(e_sceneDepth, vec2i(in.position.xy), 0);
  let a = e_view.proj * vec4f(e_view.rot * dir, 0.0);
  let bz = e_view.proj * vec4f(0.0, 0.0, 0.0, 1.0);
  var hi = 1e9;
  if (z > 0.0) {
    let den = a.z - z * a.w;
    if (abs(den) > 1e-12) { let t = (z * bz.w - bz.z) / den; if (t > 0.0) { hi = t; } }
  }
  var lo = 0.0;
  // (from the light: the eye less it)
  let o = e_view.eye - L.a.xyz;
  // within the light's reach
  let tc = -dot(o, dir);
  let half_ = sqrt(max(R * R - (dot(o, o) - tc * tc), 0.0));
  lo = max(lo, tc - half_);
  hi = min(hi, tc + half_);
  // before the light: (X − light) · D ≥ 0
  let p0 = dot(o, D);
  let p1 = dot(dir, D);
  if (abs(p1) > 1e-6) {
    if (p1 > 0.0) { lo = max(lo, -p0 / p1); } else { hi = min(hi, -p0 / p1); }
  } else if (p0 < 0.0) { hi = lo; }
  // within its edge: ((X − light) · D)² ≥ c² |X − light|² — a t² + 2 bh t + q ≥ 0; before the light it is one stretch
  // of the ray (that side of the cone is convex): between the roots, or past the root on the side the ray goes on
  // into the beam
  let qa = p1 * p1 - c * c;
  let bh = p1 * p0 - c * c * dot(dir, o);
  let q = p0 * p0 - c * c * dot(o, o);
  if (abs(qa) < 1e-6) {
    if (abs(bh) > 1e-9) {
      if (bh > 0.0) { lo = max(lo, -0.5 * q / bh); } else { hi = min(hi, -0.5 * q / bh); }
    } else if (q < 0.0) { hi = lo; }
  } else {
    let disc = bh * bh - qa * q;
    if (disc < 0.0) {
      if (qa < 0.0) { hi = lo; }
    } else {
      // (the roots in the form that loses nothing where qa is small — a ray nearly along the cone's side: s / qa and
      // q / s; both 0 where s is)
      let s = -bh - select(-1.0, 1.0, bh >= 0.0) * sqrt(disc);
      var r0 = 0.0;
      var r1 = 0.0;
      if (abs(s) > 1e-12) { r0 = s / qa; r1 = q / s; }
      if (qa < 0.0) { lo = max(lo, min(r0, r1)); hi = min(hi, max(r0, r1)); }
      else if (p1 > 0.0) { lo = max(lo, max(r0, r1)); }
      else { hi = min(hi, min(r0, r1)); }
    }
  }
  if (hi <= lo) { discard; }
  // (a sample's share of the stretch)
  let step = (hi - lo) / ${BEAM_TAPS}.0;
  // (its spread grows no more than to BEAM_NEAR, nor less than to what it lights: e_term's min 1)
  let most = max(1.0, e_beamSpread(${BEAM_NEAR}.0, R));
  var sum = 0.0;
  var through = 1.0;
  var shade = 1.0;
  for (var n = 0; n < ${BEAM_TAPS}; n++) {
    let t = lo + (f32(n) + 0.5) * step;
    let X = e_view.eye + dir * t;
    // (its shadow maps, read once a pair of samples — between the two)
    if (in.slot >= 0 && (n & 1) == 0) { shade = e_shadowAt(u32(in.slot), X + dir * (0.5 * step), vec3f(0.0), 0xffffffffu); }
    let v = X - L.a.xyz;
    let l = max(length(v), 1e-4);
    let w = v / l;
    let x = min(l / max(R, 1e-4), 1.0);
    let depth = in.thick * e_beamEdge(L, w) * step;
    let source = e_lin(in.power * (1.0 - x * x) * (1.0 - x * x)) * min(e_beamSpread(l, R), most) * e_beamPhase(dot(dir, -w)) * shade * exp(-(t + l) / e_frame.e_hazeReach);
    let kept = exp(-depth);
    sum += through * source * (1.0 - kept);
    through *= kept;
  }
  return vec4f(min(in.colour * sum, vec3f(${BEAM_MOST}.0)), 0.0);
}
`);
// The air's light over the sky (5.18): one triangle at the far plane, after the sky's sheets — where nothing stands
// before the sky (tested against the solid depth) the volume's whole depth is added: its last tile at the pixel
chunk('render.air.sky', /* wgsl */ `
@fragment fn e_fragment(in: e_Full) -> @location(0) vec4f {
  let at = clamp(in.uv * vec2f(${AIR.W}.0, ${AIR.H}.0), vec2f(0.5), vec2f(${AIR.W - 0.5}, ${AIR.H - 0.5}));
  let tile = vec2f(${(AIR.S - 1) % AIR.TX}.0, ${Math.floor((AIR.S - 1) / AIR.TX)}.0) * vec2f(${AIR.W}.0, ${AIR.H}.0);
  return vec4f(textureSampleLevel(e_air, e_linear, (tile + at) / vec2f(${AIR.W * AIR.TX}.0, ${AIR.H * AIR.TY}.0), 0.0).rgb, 0.0);
}
`);
// the sum: a cell's own stretch and those of the same place of every depth before it
chunk('render.air.sum', /* wgsl */ `
@group(0) @binding(0) var e_steps: texture_2d<f32>;
@fragment fn e_fragment(in: e_Full) -> @location(0) vec4f {
  let p = vec2i(in.position.xy);
  let tile = p / vec2i(${AIR.W}, ${AIR.H});
  let last = tile.y * ${AIR.TX} + tile.x;
  let within = p - tile * vec2i(${AIR.W}, ${AIR.H});
  var L = vec3f(0.0);
  for (var k = 0; k < ${AIR.S}; k++) {
    if (k > last) { break; }
    L += textureLoad(e_steps, vec2i(k % ${AIR.TX}, k / ${AIR.TX}) * vec2i(${AIR.W}, ${AIR.H}) + within, 0).rgb;
  }
  return vec4f(L, 1.0);
}
`);

// The bloom's five small passes (4.4). `bright` — ¼ of the frame: four of its texels by sixteen of the frame's,
// averaged by their brightness (Karis), then a soft knee at 1: only light brighter than white blooms. `down` — a
// level a quarter the side of its source (¼ → 1⁄16 → 1⁄64): every texel of the source read once — four taps, each
// between four of the sixteen under the texel written. `up` — a coarser level added into the next finer (1⁄64 into
// 1⁄16, that into ¼): a tent of it, four taps half a texel aside. The ¼ then holds all three: the canvas reads it
// once. The light gathered for the bounce (1⁄16): the frame's colour about each place — brought down to white by its
// brightest channel, its hue kept: what is brighter is a light's own (the bloom's), never bounced, or one bright texel of
// 1⁄128 would light a square about it —, weighted by how near it is;
// `wide` — that to 1⁄128, a texel the mean of an 8 × 8 of it (16 bilinear taps, each a 2 × 2): the bounce reads this one.
chunk('render.small', ({ what }) => /* wgsl */ `
struct e_Small { stage: vec4f, size: vec4f }      // the picture's rect in the source, px; the source's size (x, y), the near plane (z)
@group(0) @binding(0) var<uniform> e_small: e_Small;
@group(0) @binding(1) var e_src: texture_2d<f32>;
@group(0) @binding(2) var e_srcDepth: texture_depth_2d;
@group(0) @binding(3) var e_linear: sampler;
fn e_srcRaw(uv: vec2f, d: vec2f) -> vec4f {
  // (uv over the picture's rect; d: px of the source aside)
  let px = clamp(e_small.stage.xy + uv * e_small.stage.zw + d, e_small.stage.xy + 0.5, e_small.stage.xy + e_small.stage.zw - 0.5);
  return textureSampleLevel(e_src, e_linear, px / e_small.size.xy, 0.0);
}
fn e_srcAt(uv: vec2f, d: vec2f) -> vec3f { return e_finite3(e_srcRaw(uv, d).rgb); }
fn e_notNumber(x: f32) -> bool { return (bitcast<u32>(x) & 0x7f800000u) == 0x7f800000u; }
fn e_finite3(c: vec3f) -> vec3f { if (e_notNumber(c.x) || e_notNumber(c.y) || e_notNumber(c.z)) { return vec3f(0.0); } return c; }
fn e_lum(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }
fn e_bright(c: vec3f) -> vec3f {
  let b = max(c.r, max(c.g, c.b));
  var s = clamp(b - 0.5, 0.0, 1.0);
  s = s * s / 2.0;
  return c * max(s, b - 1.0) / max(b, 1e-4);
}
@fragment fn e_fragment(in: e_Full) -> @location(0) vec4f {
${what === 'bright' ? /* wgsl */ `
  let a = e_srcAt(in.uv, vec2f(-1.0, -1.0));
  let b = e_srcAt(in.uv, vec2f(1.0, -1.0));
  let c = e_srcAt(in.uv, vec2f(-1.0, 1.0));
  let e = e_srcAt(in.uv, vec2f(1.0, 1.0));
  let w = 1.0 / (1.0 + vec4f(e_lum(a), e_lum(b), e_lum(c), e_lum(e)));
  return vec4f(e_bright((a * w.x + b * w.y + c * w.z + e * w.w) / (w.x + w.y + w.z + w.w)), 1.0);
` : ''}${what === 'down' ? /* wgsl */ `
  return vec4f((e_srcAt(in.uv, vec2f(-1.0, -1.0)) + e_srcAt(in.uv, vec2f(1.0, -1.0)) + e_srcAt(in.uv, vec2f(-1.0, 1.0)) + e_srcAt(in.uv, vec2f(1.0, 1.0))) * 0.25, 1.0);
` : ''}${what === 'up' ? /* wgsl */ `
  return vec4f((e_srcAt(in.uv, vec2f(-0.5, -0.5)) + e_srcAt(in.uv, vec2f(0.5, -0.5)) + e_srcAt(in.uv, vec2f(-0.5, 0.5)) + e_srcAt(in.uv, vec2f(0.5, 0.5))) * 0.25, 1.0);
` : ''}${what === 'gather' ? /* wgsl */ `
  var sum = vec4f(0.0);
  for (var j = 0; j < 4; j++) {
    for (var i = 0; i < 4; i++) {
      let d = (vec2f(f32(i), f32(j)) - 1.5) * 4.0;
      let px = clamp(e_small.stage.xy + in.uv * e_small.stage.zw + d, e_small.stage.xy + 0.5, e_small.stage.xy + e_small.stage.zw - 0.5);
      let z = textureLoad(e_srcDepth, vec2i(px), 0);
      var w = 0.0;
      // (nothing drawn there, or an insert: none of it)
      if (z > 0.0 && z < 1.0) { w = 1.0 / max(e_small.size.z / z, 1.7); }
      let c = e_srcAt(in.uv, d);
      sum += vec4f(c / max(1.0, max(c.r, max(c.g, c.b))) * w, w);
    }
  }
  return sum / 16.0;
` : ''}${what === 'wide' ? /* wgsl */ `
  var sum = vec4f(0.0);
  for (var j = 0; j < 4; j++) {
    for (var i = 0; i < 4; i++) { sum += e_srcRaw(in.uv, (vec2f(f32(i), f32(j)) - 1.5) * 2.0); }
  }
  return sum / 16.0;
` : ''}}
`);

// The canvas pass. Its inputs (group 0, layout \`canvas\`): its uniform, the frame's colour, its depth, the ids, the
// bloom (its ¼: the sum of its levels), the light gathered, the people's inks, a sampler. The whole chain is worked
// out once a pixel;
// the edge smoothing reads five taps of \`main\`, each only tone-mapped, and adds what it changes of the middle one.
chunk('render.canvas', /* wgsl */ `
struct e_Canvas {
  stage: vec4f,                         // the picture's rect, px (all of the frame: RN5)
  size: vec2f, near: f32, veil: f32,   // the frame's size, px; the near plane; the stage's veil (2.10: black over all)
  exposure: f32, bloom: f32, bounce: f32, tintA: f32,
  tint: vec3f, sat: f32,                // the look's tint (display), its saturation
  ambient: vec3f, vig: f32,
  grain: f32, lines: f32, scale: f32, tick: f32,   // …; whether people are there; buffer px a CSS px
  unproject: vec4f,                     // a pixel → its way from the eye, a metre ahead: px · xy − zw (the lens's own middle in zw)
  haze: vec4f,                          // the haze's colour, 1 / its reach
}
@group(0) @binding(0) var<uniform> e_canvas: e_Canvas;
@group(0) @binding(1) var e_colour: texture_2d<f32>;
@group(0) @binding(2) var e_depth: texture_depth_2d;
@group(0) @binding(3) var e_ids: texture_2d<u32>;
@group(0) @binding(4) var e_bloom: texture_2d<f32>;
@group(0) @binding(5) var e_gather: texture_2d<f32>;
@group(0) @binding(6) var<uniform> e_inks: array<vec4f, 256>;
@group(0) @binding(7) var e_linear: sampler;
fn e_notNumber(x: f32) -> bool { return (bitcast<u32>(x) & 0x7f800000u) == 0x7f800000u; }
fn e_finite3(c: vec3f) -> vec3f { if (e_notNumber(c.x) || e_notNumber(c.y) || e_notNumber(c.z)) { return vec3f(0.0); } return c; }
fn e_encode(c: vec3f) -> vec3f { let k = max(c, vec3f(0.0)); return mix(k * 12.92, 1.055 * pow(k, vec3f(1.0 / 2.4)) - 0.055, step(vec3f(0.0031308), k)); }
// how far before the eye what a pixel shows is (reversed depth, the far plane at infinity); nothing there: far off
fn e_far(p: vec2i) -> f32 { return e_canvas.near / max(textureLoad(e_depth, p, 0), 1e-9); }
fn e_neutral(c: vec3f) -> vec3f {
  let peak = max(c.r, max(c.g, c.b));
  if (peak < 0.8) { return c; }
  let np = 1.0 - 0.04 / (peak + 0.2 - 0.8);
  let k = c * (np / peak);
  return mix(k, vec3f(np), 1.0 - 1.0 / (0.15 * (peak - np) + 1.0));
}
fn e_softLight(b: vec3f, s: vec3f) -> vec3f {
  let d = mix(((16.0 * b - 12.0) * b + 4.0) * b, sqrt(b), step(vec3f(0.25), b));
  return mix(b - (1.0 - 2.0 * s) * b * (1.0 - b), b + (2.0 * s - 1.0) * (d - b), step(vec3f(0.5), s));
}
// how much of a tap of the gather is about as far as a place D m off: its mean of 1 / distance (a) against the
// place's — all of it within ×1.4, none past ×2.8 nearer or farther
fn e_alike(a: f32, D: f32) -> f32 { return clamp(1.5 - abs(log2(max(a, 1e-9) * max(D, 1.7))), 0.0, 1.0); }
// the light bounced: the scene about a place of the frame, as much of it as is about as far as that place — the wide
// gather (a texel is an eighth of the frame's height) read smooth: a cubic B-spline of it, four bilinear taps — so a
// thing counts by its area and a bright texel lights a soft round about it, never a square of the texels. Read
// bilaterally: each tap counts as much as what it gathered is as far as the place (e_alike) — a ceiling is not lit by
// the window or the far wall beside it on the screen —, and the bounce is as strong as the share that is
fn e_around(uv: vec2f, D: f32) -> vec3f {
  let size = vec2f(textureDimensions(e_gather));
  let p = uv * size - 0.5;
  let i = floor(p);
  let f = p - i;
  let f2 = f * f;
  let f3 = f2 * f;
  let w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
  let w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  let w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
  let w3 = f3 / 6.0;
  let g0 = w0 + w1;
  let g1 = w2 + w3;
  let a = (i - 0.5 + w1 / g0) / size;
  let b = (i + 1.5 + w3 / g1) / size;
  let t0 = textureSampleLevel(e_gather, e_linear, a, 0.0);
  let t1 = textureSampleLevel(e_gather, e_linear, vec2f(b.x, a.y), 0.0);
  let t2 = textureSampleLevel(e_gather, e_linear, vec2f(a.x, b.y), 0.0);
  let t3 = textureSampleLevel(e_gather, e_linear, b, 0.0);
  let k = vec4f(g0.x * g0.y * e_alike(t0.a, D), g1.x * g0.y * e_alike(t1.a, D), g0.x * g1.y * e_alike(t2.a, D), g1.x * g1.y * e_alike(t3.a, D));
  let sum = k.x * t0 + k.y * t1 + k.z * t2 + k.w * t3;
  if (sum.a <= 1e-6) { return vec3f(0.0); }
  return sum.rgb / sum.a * (k.x + k.y + k.z + k.w);
}
// The people's lines (the ink look): from their ids — who is under each pixel, which part, how wide their lines and
// of what kind (1 tinted, 2 where colours meet, 4 round them) — a line where a person's edge is: round them, where
// one part is well in front of another, where their colours meet — on the nearer one's side, as wide as their style
// says in CSS px whatever the distance; in their ink, hazed where it is, or tinted
fn e_line(p: vec2i) -> vec4f {
  let a = textureLoad(e_ids, p, 0);
  if (a.r == 0u || a.b == 0u) { return vec4f(0.0); }
  let za = e_far(p);
  let w = f32(a.b) / 8.0 * e_canvas.scale;
  let wide = max(1, i32(w + 0.5));
  var rings = 1;
  if (wide > 1) { rings = 2; }
  var edge = false;
  let lo = vec2i(e_canvas.stage.xy);
  let hi = lo + vec2i(e_canvas.stage.zw);
  for (var ring = 0; ring < 2; ring++) {
    if (ring >= rings) { break; }
    var r = f32(wide);
    if (ring == 1) { r = f32((wide + 1) / 2); }
    for (var k = 0; k < 8; k++) {
      let ang = f32(k) * 0.7853982;
      let q = p + vec2i(floor(vec2f(cos(ang), sin(ang)) * r + 0.5));
      // (the frame's edge is no edge of theirs)
      if (q.x < lo.x || q.y < lo.y || q.x >= hi.x || q.y >= hi.y) { continue; }
      let b = textureLoad(e_ids, q, 0);
      // (an insert's mark — nothing of theirs there: no edge of theirs, as the frame's edge is none)
      if (b.r == 0u && (b.a & 8u) != 0u) { continue; }
      var cut = (a.a & 4u) != 0u;
      if (b.r != 0u) {
        let zb = e_far(q);
        if (b.r != a.r || abs(zb - za) > 0.06 + 0.02 * za) { cut = za < zb; } else { cut = (a.a & 2u) != 0u && a.g > b.g; }
      }
      edge = edge || cut;
    }
  }
  if (!edge) { return vec4f(0.0); }
  let cover = min(1.0, w / f32(wide));
  if ((a.a & 1u) != 0u) { return vec4f(0.0, 0.0, 0.0, 0.55 * cover); }
  // (their ink, hazed where the line is)
  let at = (vec2f(p) + 0.5) * e_canvas.unproject.xy - e_canvas.unproject.zw;
  let h = 1.0 - exp(-za * length(vec3f(at, 1.0)) * e_canvas.haze.w);
  return vec4f((e_inks[min(a.r, 255u)].rgb * (1.0 - h) + e_canvas.haze.rgb * h) * cover, cover);
}
// a place of the frame (px) kept within the picture
fn e_within(at: vec2f) -> vec2f { return clamp(at, e_canvas.stage.xy + 0.5, e_canvas.stage.xy + e_canvas.stage.zw - 0.5); }
// the scene's colour for the display: exposed, tone-mapped, encoded
fn e_toned(c: vec3f) -> vec3f { return e_encode(e_neutral(c * e_canvas.exposure)); }
// \`main\` at a place of the frame, only tone-mapped: a tap of the edge smoothing
fn e_tap(at: vec2f) -> vec3f { return e_toned(e_finite3(textureSampleLevel(e_colour, e_linear, e_within(at) / e_canvas.size, 0.0).rgb)); }
fn e_grey(c: vec3f) -> f32 { return dot(c, vec3f(0.299, 0.587, 0.114)); }
fn e_noise(p: vec2f, k: f32) -> f32 { return fract(52.9829189 * fract(dot(p + k * vec2f(5.588, 3.167), vec2f(0.06711056, 0.00583715)))); }
@fragment fn e_fragment(in: e_Full) -> @location(0) vec4f {
  let p = in.position.xy;
  let lo = e_canvas.stage.xy;
  let inside = e_within(p);
  let at = vec2i(inside);
  let over = (inside - lo) / e_canvas.stage.zw;
  // the scene here, once: bounce, the people's lines, bloom, tone map, grade
  let raw = e_finite3(textureSampleLevel(e_colour, e_linear, inside / e_canvas.size, 0.0).rgb);
  var c = raw;
  if (e_canvas.bounce > 0.0) {
    let z = textureLoad(e_depth, at, 0);
    if (z > 0.0 && z < 1.0) { c += min(c / max(e_canvas.ambient, vec3f(1e-4)), vec3f(1.0)) * e_canvas.bounce * max(e_around(over, e_canvas.near / z) - c, vec3f(0.0)); }
  }
  if (e_canvas.lines > 0.0) {
    let l = e_line(at);
    c = l.rgb + c * (1.0 - l.a);
  }
  c += textureSampleLevel(e_bloom, e_linear, over, 0.0).rgb * e_canvas.bloom;
  c = e_toned(c);
  c = mix(c, e_softLight(c, e_canvas.tint), e_canvas.tintA);
  c = mix(vec3f(e_grey(c)), c, e_canvas.sat);
  let res = e_canvas.stage.zw;
  let r0 = min(res.x, res.y) * 0.35;
  let r1 = length(res) * 0.6;
  c *= 1.0 - e_canvas.vig * clamp((length(inside - lo - res * 0.5) - r0) / (r1 - r0), 0.0, 1.0);
  // its edges smoothed: \`main\` at four points round the pixel — where an edge passes, along it; elsewhere a little
  // sharper. What that changes of the middle tap is added to the scene here
  let m = e_toned(raw);
  let nw = e_tap(p + vec2f(-0.5, -0.5));
  let ne = e_tap(p + vec2f(0.5, -0.5));
  let sw = e_tap(p + vec2f(-0.5, 0.5));
  let se = e_tap(p + vec2f(0.5, 0.5));
  let g = vec4f(e_grey(nw), e_grey(ne), e_grey(sw), e_grey(se));
  let gm = e_grey(m);
  let least = min(gm, min(min(g.x, g.y), min(g.z, g.w)));
  let most = max(gm, max(max(g.x, g.y), max(g.z, g.w)));
  // (the way along the edge; the pair of the four that lies along it)
  let across = vec2f((g.y + g.w) - (g.x + g.z), (g.z + g.w) - (g.x + g.y));
  let along = vec2f(-across.y, across.x) / max(length(across), 1e-5);
  let k = along.x * along.y + 0.5;
  let smoothed = mix(0.5 * (ne + sw), 0.5 * (nw + se), clamp(k, 0.0, 1.0));
  let plain = clamp(m + 0.6 * (m - 0.25 * (nw + ne + sw + se)), min(m, min(min(nw, ne), min(sw, se))), max(m, max(max(nw, ne), max(sw, se))));
  c = clamp(c + mix(plain, smoothed, smoothstep(0.04, 0.12, most - least)) - m, vec3f(0.0), vec3f(1.0));
  let n = e_noise(p, e_canvas.tick);
  let ov = mix(2.0 * c * n, 1.0 - 2.0 * (1.0 - c) * (1.0 - n), step(vec3f(0.5), c));
  c = mix(c, ov, e_canvas.grain) * (1.0 - e_canvas.veil);
  return vec4f(c + (e_noise(p, e_canvas.tick + 7.0) - 0.5) / 255.0, 1.0);
}
`);
