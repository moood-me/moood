// RENDER's shared WGSL: what every program of the frame may include.
//   `render.common` — colour conversions, hashes and value noise (the same on every GPU), the time. The names an
// element's own shader is given (LG2) are these: PI, cycle, hash2, hash3, hashU, noise1, noise2, noise3, wobble,
// wobble2, luma, srgbToLinear, wrap. Every other module-scope name RENDER declares in any module begins `e_` (an
// author's name may not: 4.1 "Names in WGSL") — the names 4.1 and 4.2 give are written so too: e_Frame, e_View,
// e_frame, e_view, e_lights, e_lightGrid, e_panes, e_linear, e_shadowStatic, e_shadowMovers, e_shadowSampler,
// e_shadows, e_blob, e_air, e_masks, e_land, e_landHeights, e_landShadow, and the three functions SCENE's chunk calls
// — e_reliefAt, e_insertOf, e_insertOpen.
//   `frame` — the uniforms e_Frame (group 0 binding 0) and e_View (group 1 binding 0) with the shared fields at the
// offsets 4.1 writes, RENDER's own fields after them; the rest of `frame`'s bindings that are RENDER's (e_lights,
// e_lightGrid, e_panes, e_linear) and all of group 1 — the view's land field among it (render/wgsl/land.js: its
// levels' text is part of this chunk).
//   `render.motion` — what moves without repainting: a layer's wind, its flicker, its shimmer — from the time and
// where the thing stands, the same at any moment for the same time.
//   The time. e_frame.time is the scene's seconds wrapped at TIME.WRAP (what an own shader reads as u_time: a float
// holds it to a millisecond). What the engine moves by time reads the epoch — whole TIME.STEPs of the clock, as (their
// count less its low 12 bits, its low 12 bits) — and e_frame.e_since, the seconds since it: cycle(k), where in its
// cycle something going k times a second is, exact at any hour of the clock; time's noise loops (its lattice wraps at
// TIME.LOOP), so its argument is kept within the loop by cycle as well.
// This module touches nothing of a browser: the whole-set check imports it in node.
import { chunk } from '../../gpu/wgsl.js';
import { INSERTS, LIGHT, SHADOW, VIEW, WIND } from '../../base.js';
import { LEVELS } from './land.js';

export const TIME = Object.freeze({ STEP: 256, LOOP: 256, WRAP: 16384 });
// the Frame uniform: its size, and where RENDER's own fields lie (bytes) — render/renderer.js writes them
export const FRAME = Object.freeze({
  BYTES: 544, TIME: 0, TICK: 4, PULSE: 8, SKY: 12, EPOCH: 16, SINCE: 24, INSIDE: 28, AMBIENT: 32, HAZE_REACH: 44, HAZE: 48, LIGHT_N: 60,
  WIND: 64, FAR_N: 76, ORIGIN: 80, THROUGH_N: 92, GRID: 96, GAZE: 112, HAZE_GLOW: 124, SHAFTS: 128, SPOT_N: 132,
  AIR_VP: 144, AIR_IN: 208, IRIS: 224, OPEN: 480,
});
// the View uniform; its flags beside VIEW.MIRROR (bit 0): a light's view (nothing fades by the eye in it, nothing sways)
export const VIEWU = Object.freeze({ BYTES: 208, PROJ: 0, ROT: 64, EYE: 112, YAW: 124, SIZE: 128, BIAS: 136, FLAGS: 140, MIRROR: 144, FADE: 160, LIGHT: 176, STAGE: 192, CAST: 2 });
// the lit lights' rows (80 bytes: five vec4f) and, after them in the same buffer, the rows of the planes of panes
export const LIT = Object.freeze({ BYTES: 80, PLANES: 16, PLANE0: LIGHT.LIT });
// the grid over the lit set: cells a side; a cell's words (how many, then their rows)
export const GRID = Object.freeze({ SIDE: 32, WORDS: 1 + LIGHT.CELL });
// the shadows' uniform: a slot 48 bytes, a view 80; six views a slot
export const SHADOWS = Object.freeze({ SLOT: 48, VIEW: 80, VIEWS: 6, VIEW0: 48 * SHADOW.LIGHTS, BLOB: 48 * SHADOW.LIGHTS + 80 * 6 * SHADOW.LIGHTS, BYTES: 48 * SHADOW.LIGHTS + 80 * 6 * SHADOW.LIGHTS + 32 });
// the air's volume: cells across and down, depths, how those lie in its texture, where its depths turn from even to
// ever farther apart (m)
export const AIR = Object.freeze({ W: 64, H: 36, S: 24, TX: 6, TY: 4, Z0: 1 });

const COMMON = /* wgsl */ `
const PI = 3.14159265;
fn srgbToLinear(c: vec3f) -> vec3f { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3f(2.4)), step(vec3f(0.04045), c)); }
fn e_encode(c: vec3f) -> vec3f { let k = max(c, vec3f(0.0)); return mix(k * 12.92, 1.055 * pow(k, vec3f(1.0 / 2.4)) - 0.055, step(vec3f(0.0031308), k)); }
fn luma(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }
fn wrap(x: f32, y: f32) -> f32 { return x - y * floor(x / y); }

// (integer hashes, exact on every GPU)
fn e_bits(v: u32) -> u32 { var x = v; x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u; return x; }
fn hashU(x: u32) -> f32 { return f32(e_bits(x)) / 4294967295.0; }
fn hash2(p: vec2f) -> f32 { let q = vec2u(vec2i(floor(p))); return hashU(q.x * 1973u + q.y * 9277u + 26699u); }
fn hash3(p: vec3f) -> f32 { let q = vec3u(vec3i(floor(p))); return hashU(q.x * 1973u + q.y * 9277u + q.z * 26699u + 7u); }

// value noise, 0…1, smooth (quintic): over a line, a plane, space
fn noise1(x: f32) -> f32 {
  let i = floor(x);
  let f = x - i;
  let k = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(hashU(u32(i32(i))), hashU(u32(i32(i) + 1)), k);
}
fn noise2(p: vec2f) -> f32 {
  let i = floor(p);
  let f = p - i;
  let k = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash2(i), hash2(i + vec2f(1.0, 0.0)), k.x), mix(hash2(i + vec2f(0.0, 1.0)), hash2(i + vec2f(1.0, 1.0)), k.x), k.y);
}
fn noise3(p: vec3f) -> f32 {
  let i = floor(p);
  let f = p - i;
  let k = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(mix(hash3(i), hash3(i + vec3f(1.0, 0.0, 0.0)), k.x), mix(hash3(i + vec3f(0.0, 1.0, 0.0)), hash3(i + vec3f(1.0, 1.0, 0.0)), k.x), k.y),
             mix(mix(hash3(i + vec3f(0.0, 0.0, 1.0)), hash3(i + vec3f(1.0, 0.0, 1.0)), k.x), mix(hash3(i + vec3f(0.0, 1.0, 1.0)), hash3(i + vec3f(1.0, 1.0, 1.0)), k.x), k.y), k.z);
}
// two octaves of it, −1…1: a gust, a flicker, a shimmer
fn wobble(x: f32) -> f32 { return (noise1(x) * 0.67 + noise1(x * 2.13 + 17.0) * 0.33) * 2.0 - 1.0; }
fn wobble2(p: vec2f) -> vec2f { return vec2f(noise2(p), noise2(p + vec2f(31.7, 11.3))) * 2.0 - 1.0; }

// the time: fract(k · (the epoch + s)) — s seconds after the epoch; cycle(k): now
fn e_cycleAt(k: f32, s: f32) -> f32 {
  let a = k * ${TIME.STEP}.0;
  let ah = bitcast<f32>(bitcast<u32>(a) & 0xFFFFF000u);
  let al = a - ah;
  return fract(fract(ah * e_frame.e_epoch.x) + fract(ah * e_frame.e_epoch.y) + fract(al * e_frame.e_epoch.x) + fract(al * e_frame.e_epoch.y) + fract(k * s));
}
fn cycle(k: f32) -> f32 { return e_cycleAt(k, e_frame.e_since); }
// value noise over a loop (its lattice wraps at TIME.LOOP), 0…1: over a line, a plane
fn e_loopNoise(x: f32) -> f32 {
  let i = floor(x);
  let f = x - i;
  let k = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  let c = u32(i32(i));
  return mix(hashU(c & ${TIME.LOOP - 1}u), hashU((c + 1u) & ${TIME.LOOP - 1}u), k);
}
fn e_loopHash(v: vec2u) -> f32 { let c = v & vec2u(${TIME.LOOP - 1}u); return hashU(c.x * 1973u + c.y * 9277u + 26699u); }
fn e_loopNoise2(p: vec2f) -> f32 {
  let i = floor(p);
  let f = p - i;
  let k = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  let c = vec2u(vec2i(i));
  return mix(mix(e_loopHash(c), e_loopHash(c + vec2u(1u, 0u)), k.x), mix(e_loopHash(c + vec2u(0u, 1u)), e_loopHash(c + vec2u(1u, 1u)), k.x), k.y);
}
// where time's noise is for what goes k times a second (seed: its own place along it)
fn e_timeAt(k: f32, seed: f32) -> f32 { return ${TIME.LOOP}.0 * cycle(k / ${TIME.LOOP}.0) + wrap(seed, ${TIME.LOOP}.0); }
fn e_timeAt2(k: vec2f, seed: vec2f) -> vec2f { return vec2f(e_timeAt(k.x, seed.x), e_timeAt(k.y, seed.y)); }
// time's wobble: two octaves of its noise, −1…1
fn e_timeWobble(k: f32, seed: f32) -> f32 { return (e_loopNoise(e_timeAt(k, seed)) * 0.67 + e_loopNoise(e_timeAt(2.13 * k, seed + 17.0)) * 0.33) * 2.0 - 1.0; }
fn e_loopWobble2(p: vec2f) -> vec2f { return vec2f(e_loopNoise2(p), e_loopNoise2(p + vec2f(31.7, 11.3))) * 2.0 - 1.0; }
// a light's flicker (amount 0…1, its seed): how strong it shines now, 1 − amount / 2 … 1
fn e_flickerOf(amount: f32, seed: f32) -> f32 { return 1.0 - 0.5 * amount * (e_loopNoise(e_timeAt(7.0, seed)) * 0.6 + e_loopNoise(e_timeAt(17.0, seed * 3.1)) * 0.4); }
// what is no number — NaN, Infinity (an own shader's division by nothing) — as nothing, told by its bits
fn e_notNumber(x: f32) -> bool { return (bitcast<u32>(x) & 0x7f800000u) == 0x7f800000u; }
fn e_finite3(c: vec3f) -> vec3f { if (e_notNumber(c.x) || e_notNumber(c.y) || e_notNumber(c.z)) { return vec3f(0.0); } return c; }
fn e_finite4(c: vec4f) -> vec4f { if (e_notNumber(c.x) || e_notNumber(c.y) || e_notNumber(c.z) || e_notNumber(c.w)) { return vec4f(0.0); } return c; }
// the main target keeps few bits a channel (rg11b10ufloat): written dithered by a step of those — a noise of the
// pixel's place, no texture read
fn e_dithered(c: vec3f, at: vec2f) -> vec3f {
  let n = fract(52.9829189 * fract(dot(at, vec2f(0.06711056, 0.00583715)))) - 0.5;
  return c * (1.0 + n * vec3f(${1 / 64}, ${1 / 64}, ${1 / 32}));
}
`;

const FRAME_WGSL = /* wgsl */ `
struct e_Frame {
  time: f32, tick: u32, pulse: f32, e_skyBase: u32,  // …; the sky's base quad (render/sky.js; 0xffffffff: none)
  e_epoch: vec2f, e_since: f32, e_inside: f32,        // the epoch, the seconds since it; the share of the far light and the ambient that comes inside
  e_ambient: vec3f, e_hazeReach: f32,                 // the light all round (linear); the haze's reach, metres
  e_haze: vec3f, e_lightN: u32,                       // the haze's colour (linear); the lit set's rows
  e_wind: vec3f, e_farN: u32,                         // the wind's way over the level (x, z, unit) and its strength; the far lights (the first rows)
  e_origin: vec3f, e_throughN: u32,                   // the render origin; the lights through panes (the rows after the far ones)
  e_grid: vec4f,                                      // the lights' grid: its corner (x, z less the origin), 1 / a cell's side, its cells a side
  e_gaze: vec3f, e_hazeGlow: f32,                     // the frame's own gaze (unit): what faces no way of its own is lit by it; how much the haze glows round a lamp
  e_shafts: f32, e_spotN: u32,                       // how strong the shafts of the far light are in the air; the beams (the rows after the through lights)
  e_airVP: mat4x4f,                                   // the air's volume: the frame's view of the world less the origin
  e_airIn: vec4f,                                     //   whether there is any, 1 / AIR.Z0, 1 / log2(1 + Z / Z0)
  e_iris: array<vec4f, ${INSERTS.MOST}>,              // every insert's iris (x, y, rx, ry: stage heights), by its row
  e_open: array<vec4f, ${INSERTS.MOST / 4}>,          // … and how far each is open
}
struct e_View {
  proj: mat4x4f, rot: mat3x3f, eye: vec3f, yaw: f32, size: vec2f, sheetBias: f32, flags: u32,
  e_mirror: vec4f,     // a mirror's view: its plane (n toward the eye's side, d) in the world less the origin
  e_fade: vec4f,       //   x: its fade (metres; 0: never)
  e_light: vec4f,      // a light's view: the way toward its light (w 0) or its place (w 1)
  e_stage: vec4f,      // the frame's view: the safe rect in its clip space — its middle across, its top, a stage height across and down (an insert is laid over it)
}
// a lit light's row: a — where it is (a point's place, a window's middle; less the origin) or the way toward it (far),
// its kind; b — its colour (linear), its strength now; c — its reach, flicker, seed, whether it lights only what is
// inside; d, e — a window's two half sides (d.w: 1 before its face); a through-light's d: its first plane's row, how
// many; a beam's d: the way it points (unit), the cosine of its edge, e.x: the cosine where its edge begins. A plane
// of panes' row (from row ${LIT.PLANE0}): a — when a point is past it (xyz · P + w > 0); b, c — where the way to the light from P meets it, in cells of its mask; d — its mask's rect in \`panes\` (x, y, w, h: px)
struct e_Light { a: vec4f, b: vec4f, c: vec4f, d: vec4f, e: vec4f }
struct e_ShadowSlot { light: i32, kind: u32, views: u32, e_spare: u32, stop: vec4f, onto: vec4u }
struct e_ShadowView { vp: mat4x4f, cell: vec4f }
struct e_Shadows {
  slot: array<e_ShadowSlot, ${SHADOW.LIGHTS}>,
  view: array<e_ShadowView, ${SHADOW.LIGHTS * SHADOWS.VIEWS}>,
  blob: vec4f,         // the blob map: its corner (x, z less the origin), 1 / its side, its floor
  texel: vec4f,        // 1 / the static atlas's side, 1 / the movers'
}
@group(0) @binding(0) var<uniform> e_frame: e_Frame;
@group(0) @binding(7) var<storage, read> e_lights: array<e_Light>;
@group(0) @binding(8) var<storage, read> e_lightGrid: array<u32>;
@group(0) @binding(9) var e_panes: texture_2d<f32>;
@group(0) @binding(10) var e_linear: sampler;
@group(1) @binding(0) var<uniform> e_view: e_View;
@group(1) @binding(1) var e_shadowStatic: texture_depth_2d;
@group(1) @binding(2) var e_shadowMovers: texture_depth_2d;
@group(1) @binding(3) var e_shadowSampler: sampler_comparison;
@group(1) @binding(4) var<uniform> e_shadows: e_Shadows;
@group(1) @binding(5) var e_blob: texture_2d<f32>;
@group(1) @binding(6) var e_air: texture_2d<f32>;
@group(1) @binding(7) var e_masks: texture_2d<f32>;
@group(1) @binding(8) var<uniform> e_land: e_Land;
@group(1) @binding(9) var e_landHeights: texture_2d<f32>;
@group(1) @binding(10) var e_landShadow: texture_2d<f32>;
${LEVELS}
const e_VIEW_MIRROR = ${VIEW.MIRROR}u;
const e_VIEW_CAST = ${VIEWU.CAST}u;
fn e_insertOf(i: u32) -> vec4f { return e_frame.e_iris[min(i, ${INSERTS.MOST - 1}u)]; }
fn e_insertOpen(i: u32) -> f32 { let k = min(i, ${INSERTS.MOST - 1}u); return e_frame.e_open[k >> 2u][k & 3u]; }
// a point of the world less the origin → the view's clip space; a way (a point at infinity)
fn e_clip(P: vec3f) -> vec4f { return e_view.proj * vec4f(e_view.rot * (P - e_view.eye), 1.0); }
fn e_clipWay(d: vec3f) -> vec4f { return e_view.proj * vec4f(e_view.rot * d, 0.0); }
// how far before the eye a point is, along its gaze
fn e_ahead(P: vec3f) -> f32 { return -(e_view.rot * (P - e_view.eye)).z; }
`;

const MOTION = /* wgsl */ `
// A layer bent by the wind about its pivot (the node's plane, metres): sideways along its painting, more toward its
// free end (s: 0 at the pivot … 1 at its farthest point, reach away), as much as amount metres there; gusting by
// noise over the world (W: where its pivot stands, the world's own place; scale: how big the gusts are) so
// neighbours sway together — gust: how much —, the wind's way pressing it over, a flutter of its own on top (seed).
// right: its painting's x in the world (how much the wind's way is across it). → how far along its x it is moved
fn e_windBend(p: vec2f, pivot: vec2f, amount: f32, reach: f32, W: vec3f, right: vec3f, seed: f32, gust: f32, scale: f32) -> f32 {
  let s = clamp(length(p - pivot) / max(reach, 1e-3), 0.0, 1.0);
  let across = dot(e_frame.e_wind.xy, normalize(right.xz + vec2f(1e-6)));
  let at = W.xz * 0.08 / max(scale, 1e-3);
  let slow = e_loopNoise2(at - ${TIME.LOOP}.0 * floor(at / ${TIME.LOOP}.0) - e_timeAt2(e_frame.e_wind.xy * 0.5, vec2f(0.0)));
  let fast = e_timeWobble(1.7, dot(W.xz, e_frame.e_wind.xy) * 0.9 + seed);
  let g = across * mix(1.0, slow, gust) * e_frame.e_wind.z + ${WIND.FAST} * fast * mix(1.0, 0.5 + 0.5 * slow, gust);
  return amount * g * s * s;
}
// its brightness flickering (amount 0…1, speed: changes a second)
fn e_flickered(amount: f32, speed: f32, seed: f32) -> f32 { return 1.0 - amount * (0.5 + 0.5 * e_timeWobble(speed, seed)); }
// where its painting is read (px), shimmering (heat over a fire, a sheet of water): amount px aside, over waves
// scale px across — how far aside at p
fn e_shimmerOf(p: vec2f, amount: f32, scale: f32, seed: f32) -> vec2f { return amount * e_loopWobble2(e_timeAt2(vec2f(0.7, 1.3), p / max(scale, 1e-3) + seed)); }
`;

chunk('render.common', COMMON);
chunk('frame', FRAME_WGSL);
chunk('render.motion', MOTION);
