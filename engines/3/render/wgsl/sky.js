// The sky past what it paints (render/sky.js, decisions S7): one triangle over the view, at the far plane, tested
// against the solid depth like the sky's sheets and drawn before them. The base is the first shown sky element's
// painting — its quad's row is e_frame.e_skyBase (RENDER draws this only while there is one, and in the frame's view
// only while something past the painting is in it); its vertex stage reads that row (a fragment stage does not see
// the world's tables: 4.2) and hands on what the pixels need, flat. A pixel's way: the view's lens undone (its
// projection's own numbers — a mirror's, cut to its picture, too), turned back into the world; its point of the sky
// by e_skyAt (SCENE's chunk `world`, the same arithmetic as place.js skyAt). Inside the painting's rect — less a
// pixel or two, where its own sheets lie over this — nothing: the sheets draw what is painted, at their level. Past
// it, the painting's edge there: its top row on up, its bottom row on down; across, round the turn (2π — looking round
// the circle, looking ahead the backdrop's turn, which the view's yaw carries) from its right end into its left,
// eased between them. Carried softly: read at the level the pixel needs at the edge — so it meets the sheet there
// without a seam — and ever coarser away from it (the footprint grows with the distance past the edge: CARRY), from
// whatever of those pages the cache has (nothing is asked for it: the sheet's own descent asks the edge's pages it
// shows; the top is always there).
//   options.own: the element's own shader (render/own.js; a variant asked at the world's build — `sky-base:own:<n>`):
// what is carried on is what its text makes of the painting at the edge, its `layer()` read as coarse as the pixel
// is there, its emission added, as its sheets draw it; away from the edge it is the mean of two of its points along
// the edge, apart as far as the pixel is past it — what the text draws small there (a star, its twinkle) is spread,
// not drawn out into a streak.
// This module touches nothing of a browser: the whole-set check imports it in node.
import { chunk } from '../../gpu/wgsl.js';
import { SHEET } from '../../base.js';

// how the footprint grows past the edge (level-0 px a pixel, per level-0 px of distance); how far apart the two
// points of an own shader go at most (stage heights)
export const CARRY = Object.freeze({ SOFT: 0.5, SPREAD: 0.25 });

chunk('render.sky.base', ({ own }) => /* wgsl */ `
const e_SKY_PPU = ${SHEET.MAX_PPM}.0;
struct e_SkyBase {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,                        // over the view, from its top-left
  @location(1) @interpolate(flat) rect: vec4f,   // the base's rect (stage heights)
  @location(2) @interpolate(flat) map: vec3f,    // the sky's map (e_skyMap)
  @location(3) @interpolate(flat) sheet: vec4u,  // its sheet (e_SheetCarry)
  @location(4) @interpolate(flat) tint: vec4f,   // what its painting is multiplied by (its tint, the highlight's breath); its glow
}
@vertex fn e_vertex(@builtin(vertex_index) i: u32) -> e_SkyBase {
  let p = vec2f(f32(i32(i & 1u) * 4 - 1), f32(i32(i >> 1u) * 4 - 1));
  let q = e_quadOf(e_frame.e_skyBase);
  var o: e_SkyBase;
  o.position = vec4f(p, 0.0, 1.0);
  o.uv = vec2f(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  o.rect = q.rect;
  o.map = e_skyMap(q);
  o.sheet = e_sheetCarry(e_sheetOf(q.sheet)).a;
  o.tint = vec4f(q.tint.rgb * e_quadGlow(q), q.tint.a);
  return o;
}
// the painting at a point of it (px at level 0 from its corner) read at the level of a footprint of foot px — kept
// half a texel of that level inside it, so nothing past its edge is mixed in; premultiplied, unlit as its sheets
// are${own ? ', its own shader over it' : ''}
fn e_skyShown(in: e_SkyBase, s: e_Sheet, point: vec2f, foot: f32) -> vec4f {
  let dx = vec2f(foot, 0.0);
  let dy = vec2f(0.0, foot);
  let level = e_sheetLevel(dx, dy, 1.0);
  let half = 0.5 * exp2(clamp(ceil(level), 0.0, f32(s.info & 31u) - 1.0));
  let at = clamp(point, vec2f(half), max(vec2f(s.size) - vec2f(half), vec2f(half)));
  let c = e_sheetTake(e_sheetFind(s, vec2i(0), at, level), dx, dy, 1.0);
${own ? /* wgsl */ `  let r = in.rect;
  let p = r.xy + at / e_SKY_PPU;
  e_shadeBegin(dx / e_SKY_PPU, dy / e_SKY_PPU, 1.0, vec2i(0), at);
  let o = e_finite4(shade(c, p, (p - r.xy) / max(r.zw - r.xy, vec2f(1e-6))));
  return vec4f(o.rgb * in.tint.rgb + e_finite3(emission) * in.tint.a, o.a);` : '  return vec4f(c.rgb * in.tint.rgb, c.a);'}
}
// what is carried from the edge point \`at\` (px) to a pixel d px past it (screen: px a pixel there; along: the edge's
// way)
fn e_skyCarry(in: e_SkyBase, s: e_Sheet, at: vec2f, d: f32, screen: f32, along: vec2f) -> vec4f {
  let foot = max(screen, ${CARRY.SOFT} * d);
${own ? /* wgsl */ `  let apart = 0.5 * min(d, ${CARRY.SPREAD} * e_SKY_PPU);
  return 0.5 * (e_skyShown(in, s, at + along * apart, foot) + e_skyShown(in, s, at - along * apart, foot));` : '  return e_skyShown(in, s, at, foot);'}
}
@fragment fn e_fragment(in: e_SkyBase) -> @location(0) vec4f {
  let s = e_sheetFrom(e_SheetCarry(in.sheet, vec4f(0.0)));
  let P = e_view.proj;
  let ndc = vec2f(in.uv.x * 2.0 - 1.0, 1.0 - in.uv.y * 2.0);
  let eye = vec3f((ndc.x + P[2][0]) / P[0][0], (ndc.y + P[2][1]) / P[1][1], -1.0);
  let at = e_skyAt(normalize(transpose(e_view.rot) * eye), in.map, e_view.yaw);
  // (how far the sky moves a pixel here — stage heights; what lies within two of them of the rect's edge is under
  // its sheets)
  let w = fwidth(at);
  let px = max(max(w.x, w.y), 1e-6);
  // (the rect in stage heights; the point brought round into the turn that begins at its left)
  let r = in.rect;
  let x = r.x + wrap(at.x - r.x, e_WORLD_TAU);
  let across = (x > r.x + 2.0 * px && x < r.z - 2.0 * px) || (x + e_WORLD_TAU > r.x + 2.0 * px && x + e_WORLD_TAU < r.z - 2.0 * px);
  let under = across && at.y > r.y + 2.0 * px && at.y < r.w - 2.0 * px;
  // (with no branch before them — the own text is run in uniform control flow, as a quad runs it: what compiles there
  // compiles here): within its turn, the edge over or under the point (its right end, b at no weight); in the gap,
  // its right end and its left, eased between
  let screen = px * e_SKY_PPU;
  let y = (clamp(at.y, r.y, r.w) - r.y) * e_SKY_PPU;
  let dy = max(max(r.y - at.y, at.y - r.w), 0.0);
  let inTurn = x <= r.z;
  let gap = max(r.x + e_WORLD_TAU - r.z, 1e-6);
  let toRight = max(x - r.z, 0.0);
  let toLeft = r.x + e_WORLD_TAU - x;
  let k = select(smoothstep(0.0, 1.0, toRight / gap), 0.0, inTurn);
  let along = select(vec2f(0.0, 1.0), vec2f(1.0, 0.0), inTurn);
  let a = e_skyCarry(in, s, vec2f((min(x, r.z) - r.x) * e_SKY_PPU, y), length(vec2f(toRight, dy)) * e_SKY_PPU, screen, along);
  let b = e_skyCarry(in, s, vec2f(0.0, y), length(vec2f(toLeft, dy)) * e_SKY_PPU, screen, along);
  let c = mix(a, b, k);
  if (under) { discard; }
  return vec4f(e_dithered(c.rgb, in.position.xy), c.a);
}
`);
