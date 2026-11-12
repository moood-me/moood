// A painted quad of the world — a card, a layer of one, a plane, a form, a sheet of the sky, an insert — drawn
// instanced: slot 0 the corners of every shape (render/quads.js: one buffer, a shape an index range), slot 1 the
// order (4.1: a row an instance — the quad's row, its shape, its origin page, its edge-on fade, and for the SCREEN
// shape the four corners of a part of its `piece`). The mapping of every kind is SCENE's chunk `world` (e_quadPoint,
// e_quadWorld, e_quadNormal, e_insertThere); the sheet is SHEETS' chunk `sheets`.
//   Its painting is read in px from its origin page (SH14): `at` is worked out at the vertices and interpolated — a
// quad's own corner is its origin; one drawn by the SCREEN shape (5.12: a flat quad the view's sides cut) has its
// points laid over a part of the piece of it the view sees — between the part's four corners as the view sees them,
// evenly on the screen: each corner comes as (x, y, 1) / w, so the mix of the four, divided, is a point of the
// quad's own plane — metres from its origin page's corner (the page under the eye's foot, for a sheet too wide for a
// float), small numbers near the eye. Every point is on the quad and in the view; along a side two parts share both
// mix the same two corners by the same number, and have the same points. Every read of a sheet passes the taps of
// its quad's kind (4.8): the ask named the pages of that level.
//   Its light is worked out at its vertices (render.light e_lightOn) and given to its fragment as what its painting is
// multiplied by and what is added: a fragment of what blends reads its painting and nothing else (its clip's mask if
// clipped). A RECEIVER that is solid leaves the key lights, the light all round (the people near take of it: the
// blob) and the air to its pixels (5.5, 5.17).
//   Passed close by, what stands upright fades (5.17): in the frame's view — not in a mirror's, not in a light's — a
// card's alpha is multiplied by how far before the eye the point is along the gaze, from PASS.FROM (nothing) to
// PASS.TO (all of it) — the distance carried from its vertices, bounded at the pixel; render/quads.js draws such a
// card, while a point of it is that near, as a mixed sheet at most: its `cut` drops what fades, its `edge` blends it.
//   In a mirror that fades with height (5.7) a thing is THERE less the higher it stands over the mirror: the factor
// multiplies how much of it there is (its alpha — colour, coverage and an own shader's emission together); what is
// solid writes it as its colour's alpha, which a mirror's image keeps (how much of a mirror image there is): a fog
// toward the mirror's own paint, the overlay's. What is solid stays opaque in the image — what stands behind it, the
// sky too, is hidden by it as in the frame —; the sky is all there, where nothing mirrored stands before it.
//   Modes (options.mode): 'solid' (colour and ids 0; options.cut — a mixed sheet's opaque paint, or an own shader's
// where its painting is opaque, as it shades it: a pixel whose alpha — less as the eye passes it close by — is under
// SHEET.OPAQUE is dropped and lays no depth), 'blend' (a fully transparent pixel dropped —
// where its page is empty, known from one reading of the table before any read of the cache, or its alpha is 0; a
// mixed sheet's `edge` is this program under the strict depth test: the position is invariant, so it agrees with
// `cut` to the bit), 'multiply' (a layer that multiplies what is behind: unlit), 'sky' and 'insert' (unlit, on the
// stage; an insert, over everything, also writes the insert's mark into the ids where it paints — no one's lines
// through it, nor along its edge), 'cast' (a light's view: depth where it is opaque enough — drawn from where it rests:
// no wind, drift or shimmer), 'mask' (its coverage into the channels of the cutter sets it is of: nothing dropped, blended `max`),
// 'mirror' and 'glass' (what a plane mirrors, what a pane shows of the room: laid over the painting —
// render/mirrors.js), 'mark' (what blends in the frame's view, again: where its paint is opaque — a solid's `cut`'s
// test, after its alpha's amount — the ids of what is behind it cleared, as a solid's are, the colour not written;
// so no one's lines are drawn through a painting that hides them — unlit).
// options.own: an element's own shader (render/own.js) — its text's chunk is in the module, `shade` is called.
// options.land: the vertex stage of what is draped on the land (render/wgsl/land.js) instead of this one.
import { chunk } from '../../gpu/wgsl.js';
import { CAST, OWN, PASS, SHEET } from '../../base.js';

// The shapes of the one corner buffer, by their number in the order row's `shape` (its low byte): four points; a
// column the wind bends; the even grids of 4, 8, 16 and 32 cells a side (a form's four strides are these). SCREEN — a
// bit beside a grid's number: the grid is laid over a part of the piece of the quad the view sees (the row's
// `piece`). Land: the leaf's row from bit 8. The sky: the turn of a backdrop the row draws, from bit 8 (signed:
// render/quads.js)
export const SHAPE = Object.freeze({ FLAT: 0, COLUMN: 1, MID: 2, FORM8: 3, FINE: 4, FORM32: 5, SCREEN: 128 });
// an own shader's uniform (group 2, layout `own`: e_Own below), bytes
export const OWN_BYTES = 4 * OWN.VALUES + 3 * 16 * OWN.SHEETS;

chunk('render.quad.io', /* wgsl */ `
struct e_In {
  @location(0) corner: vec2f,
  @location(1) quad: u32,
  @location(2) shape: u32,
  @location(3) page: vec2i,
  @location(4) edge: f32,
  @location(5) piece0: vec3f,                    // the SCREEN shape's part (4.1): its four corners, round it
  @location(6) piece1: vec3f,
  @location(7) piece2: vec3f,
  @location(8) piece3: vec3f,
}
struct e_Out {
  @builtin(position) @invariant position: vec4f,
  @location(0) at: vec2f,                        // its painting here: px at level 0 from its origin page
  @location(1) uvA: vec4f,                       // uv over its rect; how much of it there is; how far it is past the eye's close pass (0 gone … 1 whole: not bounded)
  @location(2) world: vec3f,                     // the world less the origin (the sky: its way; an insert: the stage)
  @location(3) tint: vec4f,                      // what its painting is multiplied by; how much of the air before it is clear
  @location(4) veil: vec3f,                      // what is added as much as there is of it (a solid receiver: what its pixels' light is multiplied by)
  @location(5) normal: vec3f,
  @location(6) own: vec2f,                       // the point of its painting, its units (an own shader's \`at\`)
  @location(7) @interpolate(flat) info: vec4u,   // its flags, the receivers it is, its insert's row, its clip (WT2)
  @location(8) @interpolate(flat) sa: vec4u,     // its sheet (e_SheetCarry)
  @location(9) sb: vec4f,
  @location(10) @interpolate(flat) page: vec2i,
  @location(11) @interpolate(flat) fx: vec4f,    // its drift (px a second), its shimmer (px aside, px across a wave)
  @location(12) @interpolate(flat) more: vec4f,  // its seed, whether inside, whether it faces a way, its own glow
  @location(13) @interpolate(flat) px: vec2f,    // its sheet's size, px
  @location(14) @interpolate(flat) sheer: f32,   // how much of the light behind it comes through (WT2)
}
const e_SHAPE_SCREEN = ${SHAPE.SCREEN}u;
// a sheet's px a unit at level 0 (SHEETS lays every sheet so: SH7), and so a quad's sheet's size, px
const e_PPU = ${SHEET.MAX_PPM}.0;
fn e_sheetPx(q: e_Quad) -> vec2f { return (q.rect.zw - q.rect.xy) * e_PPU; }
// the taps a sheet of a quad of these flags is read with (4.8)
fn e_taps(flags: u32) -> f32 {
  let kind = flags & e_QUAD_KIND;
  if (kind == e_QUAD_PLANE || kind == e_QUAD_DRAPE) { return 2.0; }
  return 1.0;
}
`);

// what the vertex stages of a quad and of the land share: the layer's motion and the light, once the point is known
const lit = ({ mode, receiver }) => /* wgsl */ `
struct e_Posed { p: vec3f, alpha: f32, bright: f32, fx: vec4f }
fn e_posed(q: e_Quad, kind: u32, point: vec3f, px: vec2f) -> e_Posed {
  var o: e_Posed;
  o.p = point; o.alpha = 1.0; o.bright = 1.0; o.fx = vec4f(0.0);
  if (q.layer == e_QUAD_NONE) { return o; }
  let Y = e_layers[q.layer];
  o.alpha = Y.pose1.y;
  o.bright = Y.pose1.z;
${mode === 'cast' ? '' : /* wgsl */ `  if ((q.flags & e_QUAD_WIND) != 0u && kind != e_QUAD_FORM) {
    // (its pivot where its pose puts it — the point bent is the posed one: a pose turns and scales about the pivot,
    // then moves both)
    var pivot = vec3f(Y.opts0.x + Y.pose0.x, -(Y.opts0.y + Y.pose0.y), Y.opts1.w);
    var W = vec3f(pivot.x, 0.0, pivot.y);
    var right = vec3f(1.0, 0.0, 0.0);
    if (kind != e_QUAD_SKY && kind != e_QUAD_INSERT) {
      if ((q.flags & e_QUAD_FLIP) != 0u) { pivot.x = -pivot.x; }
      W = e_quadWorld(q, pivot, e_view.yaw) + e_frame.e_origin;
      right = e_quadWorld(q, pivot + vec3f(1.0, 0.0, 0.0), e_view.yaw) - e_quadWorld(q, pivot, e_view.yaw);
    }
    o.p.x += e_windBend(point.xy, pivot.xy, Y.opts0.z, Y.pose1.w, W, right, q.seed, Y.opts0.w, Y.opts1.x);
  }
`}  if ((q.flags & e_QUAD_FLICKER) != 0u) { o.bright *= e_flickered(Y.opts1.y, 6.0, q.seed); }
  let size = q.rect.zw - q.rect.xy;
  let side = min(px.x, px.y);
  o.fx = vec4f(Y.opts2.xy * px / size, Y.opts1.z * 0.01 * side, 0.08 * side);
  return o;
}
// the rest of a vertex, its point of the world known: where it is drawn, how it is lit, what its fragment needs
fn e_shaded(in: e_In, q: e_Quad, kind: u32, P: vec3f, N: vec3f, uv: vec2f, at: vec2f, px: vec2f, posed: e_Posed) -> e_Out {
  var o: e_Out;
  let staged = kind == e_QUAD_SKY || kind == e_QUAD_INSERT;
  var alpha = posed.alpha * in.edge;
  var near = 1.0;
  if (kind == e_QUAD_SKY) {
    o.position = e_clipWay(P);
    o.position.z = 0.0;
  } else if (kind == e_QUAD_INSERT) {
    // (an insert: laid over the safe rect, the view's e_stage — frame heights from its middle across and from its top
    // down; before everything)
    o.position = vec4f(e_view.e_stage.x + P.x * e_view.e_stage.z, e_view.e_stage.y - P.y * e_view.e_stage.w, 1.0, 1.0);
  } else {
    o.position = e_clip(P);
    // (passed close by, what stands upright fades away — in the frame's view alone; its fragment bounds it: e_amount)
    if ((kind == e_QUAD_CARD || kind == e_QUAD_FACING) && (e_view.flags & (e_VIEW_MIRROR | e_VIEW_CAST)) == 0u) { near = (e_ahead(P) - ${PASS.FROM}) / ${PASS.TO - PASS.FROM}; }
  }
  // how much of it is there, in a mirror that fades with height (5.7) — the sky is all there: the fade is the
  // elements', toward the mirror's own paint
  var there = 1.0;
${mode === 'cast' || mode === 'mask' ? '' : /* wgsl */ `  if ((e_view.flags & e_VIEW_MIRROR) != 0u && e_view.e_fade.x > 0.0 && !staged) {
    there = 1.0 - smoothstep(0.0, e_view.e_fade.x, dot(e_view.e_mirror.xyz, P) + e_view.e_mirror.w);
  }
`}  let carry = e_sheetCarry(e_sheetOf(q.sheet));
  o.at = at;
  // (what is solid writes \`there\` as its colour's alpha and nothing else of its own alpha: it is wholly opaque)
  o.uvA = vec4f(uv, ${mode === 'solid' ? 'there' : 'alpha * there'}, near);
  o.world = P;
  o.normal = N;
  o.own = mix(q.rect.xy, q.rect.zw, uv);
  // (z: an insert's row; a sky's: 1 when it is a backdrop — cut at its turn's sides —, else 0)
  var aux = q.aux;
  if (kind == e_QUAD_SKY) { aux = select(0u, 1u, e_skyMap(q).z < 0.5); }
  o.info = vec4u(q.flags, q.recv, aux, q.clip);
  o.sa = carry.a;
  o.sb = carry.b;
  o.page = in.page;
  o.fx = posed.fx;
  o.px = px;
  o.sheer = q.sheer;
  var has = 1.0;
  if (kind == e_QUAD_FACING) { has = 0.0; }
  var inside = 0.0;
  if ((q.flags & e_QUAD_INSIDE) != 0u) { inside = 1.0; }
  o.more = vec4f(q.seed, inside, has, q.tint.a);
  o.tint = vec4f(1.0);
  o.veil = vec3f(0.0);
${mode === 'cast' || mode === 'mask' || mode === 'multiply' || mode === 'mark' ? '' : /* wgsl */ `
  // how bright it is now: its layer's, its flicker, its copy's tint, the highlight's breath (IN3)
  let k = q.tint.rgb * (posed.bright * e_quadGlow(q));
  if (staged) {
    o.tint = vec4f(k, 1.0);
  } else {
${receiver && mode === 'solid' ? /* wgsl */ `
    // (a solid receiver: its pixels add the light all round, the key lights and the air — what glows has its own
    // light and none of the scene's)
    if ((q.flags & e_QUAD_GLOWS) != 0u) {
      o.tint = vec4f(k * q.tint.a, 1.0);
    } else {
      let L = e_lightOn(P, e_faced(P, N, has), has, inside, q.recv, true, 0.0, q.sheer);
      o.tint = vec4f(L.base * k, 1.0);
      o.veil = k;
    }
` : /* wgsl */ `
    let a = e_airAt(P);
    var light = vec3f(q.tint.a);
    // (what glows: its own light, none of the scene's; the air before it as before anything)
    if ((q.flags & e_QUAD_GLOWS) == 0u) { light = e_lightOn(P, e_faced(P, N, has), has, inside, q.recv, false, e_blobAt(P), q.sheer).base; }
    o.tint = vec4f(light * k * (1.0 - a.a), 1.0 - a.a);
    o.veil = a.rgb;
`}  }
`}  return o;
}
`;

const vertex = /* wgsl */ `
@vertex fn e_vertex(in: e_In) -> e_Out {
  let q = e_quadOf(in.quad);
  let kind = q.flags & e_QUAD_KIND;
  let px = e_sheetPx(q);
  let size = q.rect.zw - q.rect.xy;
  var uv = in.corner;
  var at = vec2f(0.0);
  if ((in.shape & e_SHAPE_SCREEN) != 0u) {
    // (the SCREEN shape: the corner, between the part's four corners as the view sees them — along its first side and
    // its third, then between the two: a side it shares with the next part is mixed there as here —, is a point of
    // the quad's plane: metres from its origin page's corner; kept within its rect against the last bit of a float)
    let uv0 = vec2f(in.page) * ${SHEET.PAGE}.0 / px;
    let h = mix(mix(in.piece0, in.piece1, in.corner.x), mix(in.piece3, in.piece2, in.corner.x), in.corner.y);
    let d = clamp(h.xy / h.z, -uv0 * size, (vec2f(1.0) - uv0) * size);
    uv = uv0 + d / size;
    at = d * px / size;
  } else {
    at = uv * px - vec2f(in.page) * ${SHEET.PAGE}.0;
  }
  let posed = e_posed(q, kind, e_quadPoint(q, uv), px);
  // (a sheet of the sky: in the turn its row draws — every point of the grid in one turn, so no cell of it is torn
  // across the turn's back; its fragment keeps what the turn sees)
  var P: vec3f;
  if (kind == e_QUAD_SKY) { P = e_skyWayIn(vec2f(posed.p.x, -posed.p.y), e_skyMap(q), e_view.yaw, f32(bitcast<i32>(in.shape) >> 8u)); }
  else { P = e_quadWorld(q, posed.p, e_view.yaw); }
  return e_shaded(in, q, kind, P, e_quadNormal(q, uv, e_view.yaw), uv, at, px, posed);
}
`;

const fragment = ({ mode, receiver, own, cut }) => /* wgsl */ `
// where its painting is read: from its origin page, drifting, shimmering (in a light's view: where it rests)
fn e_readAt(in: e_Out) -> vec2f {
  var at = in.at;
${mode === 'cast' ? '' : /* wgsl */ `  if ((in.info.x & e_QUAD_DRIFT) != 0u) { at += in.px * vec2f(cycle(in.fx.x / in.px.x), cycle(in.fx.y / in.px.y)); }
  if ((in.info.x & e_QUAD_SHIMMER) != 0u) { at += e_shimmerOf(at + vec2f(in.page) * ${SHEET.PAGE}.0, in.fx.z, in.fx.w, in.more.x); }
`}  return at;
}
// how much of it there is here now, beside its paint: its own alpha — less as the eye passes it close by, as its
// height over a fading mirror says —, an insert's iris (SCENE's: at the posed point of the stage), a backdrop's turn
// (a row draws one turn of it: past that turn's sides, where the next turn's row draws, none — the way interpolated
// is the pixel's own: a point at infinity's way is its clip position's, undone), its clip's mask — its cutter set's
// channel, from inside its cutters or from outside them
fn e_amount(in: e_Out) -> f32 {
  var a = in.uvA.z * clamp(in.uvA.w, 0.0, 1.0);
  let kind = in.info.x & e_QUAD_KIND;
  if (kind == e_QUAD_INSERT) {
    var q: e_Quad;
    q.aux = in.info.z;
    if (!e_insertThere(q, in.world.xy + vec2f(0.5 * e_WORLD_STAGE, 0.0))) { a = 0.0; }
  }
  if (kind == e_QUAD_SKY && in.info.z != 0u && !e_backdropSees(in.world, e_view.yaw)) { a = 0.0; }
${mode === 'cast' || mode === 'mask' ? '' : /* wgsl */ `  if ((in.info.x & e_QUAD_CLIPPED) != 0u) {
    let k = textureLoad(e_masks, vec2i(in.position.xy), 0)[in.info.w & 3u];
    if ((in.info.w & 4u) != 0u) { a *= 1.0 - k; } else { a *= k; }
  }
`}  return a;
}
${mode === 'solid' ? /* wgsl */ `
struct e_Solid { @location(0) colour: vec4f, @location(1) ids: vec4u }
@fragment fn e_fragment(in: e_Out) -> e_Solid {
  let dx = dpdx(in.at);
  let dy = dpdy(in.at);
${own ? '  e_shadeBegin(dpdx(in.own), dpdy(in.own), e_taps(in.info.x), in.page, in.at);\n' : ''}  var c = e_sheetRead(e_sheetFrom(e_SheetCarry(in.sa, in.sb)), in.page, e_readAt(in), dx, dy, e_taps(in.info.x));
${cut ? /* wgsl */ `  // (as much of it as is there as the eye passes it close by: what fades is no opaque paint — its \`edge\`'s: 5.17)
  let passing = clamp(in.uvA.w, 0.0, 1.0);
` : ''}${own && cut ? /* wgsl */ `  // (an own shader's painting: only where the painting itself is opaque is it shaded here — what its shader paints
  // where the painting is see-through is its \`edge\`'s alone, never shaded twice)
  if (c.a * passing < ${SHEET.OPAQUE / 255}) { discard; }
` : ''}${own ? '  c = e_finite4(shade(c, in.own, in.uvA.xy));\n' : ''}${cut ? /* wgsl */ `  // (a mixed sheet — or an own shader's painting that has opaque paint, shaded —: only its opaque paint is laid here,
  // with its depth; the rest is blended by its \`edge\`: 5.17)
  if (c.a * passing < ${SHEET.OPAQUE / 255}) { discard; }
` : ''}  var o: e_Solid;
  // (how much of it there is — 1, but in a mirror that fades with height: the image's alpha keeps it)
  let there = in.uvA.z;
${receiver ? /* wgsl */ `
  // (the lights its vertices worked out; here the light all round, less what the people near take of it, and the key
  // lights whole; the air where it is)
  let pixels = e_around(in.more.y) * e_blobAt(in.world) + e_keys(in.world, e_faced(in.world, normalize(in.normal), in.more.z), in.more.z, in.more.y, in.info.y, in.sheer);
  let a = e_airAt(in.world);
  o.colour = vec4f(e_dithered(c.rgb * (in.tint.rgb + pixels * in.veil) * (1.0 - a.a) + a.rgb, in.position.xy) * there, there);
` : /* wgsl */ `
${own ? /* wgsl */ `  // (its shader's own light, as its blend adds it)
  o.colour = vec4f(e_dithered(c.rgb * in.tint.rgb + in.veil + e_finite3(emission) * (in.tint.a * in.more.w), in.position.xy) * there, there);
` : /* wgsl */ `  o.colour = vec4f(e_dithered(c.rgb * in.tint.rgb + in.veil, in.position.xy) * there, there);
`}`}  o.ids = vec4u(0u);
  return o;
}
` : ''}
${mode === 'blend' || mode === 'sky' || mode === 'insert' ? /* wgsl */ `
${mode === 'insert' ? 'struct e_Over { @location(0) colour: vec4f, @location(1) ids: vec4u }' : ''}
@fragment fn e_fragment(in: e_Out) -> ${mode === 'insert' ? 'e_Over' : '@location(0) vec4f'} {
  let dx = dpdx(in.at);
  let dy = dpdy(in.at);
${own ? '  e_shadeBegin(dpdx(in.own), dpdy(in.own), e_taps(in.info.x), in.page, in.at);\n' : ''}  let taps = e_taps(in.info.x);
  let s = e_sheetFrom(e_SheetCarry(in.sa, in.sb));
  let at = e_readAt(in);
  let amount = e_amount(in);
${own ? /* wgsl */ `
  // (drawn over its whole box: its shader may paint where its painting has none)
  let c = e_finite4(shade(e_sheetRead(s, in.page, at, dx, dy, taps), in.own, in.uvA.xy)) * amount;
  let glow = e_finite3(emission) * (amount * in.tint.a * in.more.w);
  if (c.a <= 0.0 && max(glow.r, max(glow.g, glow.b)) <= 0.0) { discard; }
` : /* wgsl */ `
  // (a fully transparent pixel is dropped: where its page is empty — from one reading of the table, before any read
  // of the cache — or nothing is painted)
  let h = e_sheetFind(s, in.page, at, e_sheetLevel(dx, dy, taps));
  if (amount <= 0.0 || e_sheetNone(h)) { discard; }
  let c = e_sheetTake(h, dx, dy, taps) * amount;
  let glow = vec3f(0.0);
  if (c.a <= 0.0) { discard; }
`}  var alpha = c.a;
  var rgb = c.rgb * in.tint.rgb + c.a * in.veil + glow;
  // (a layer that adds: its light over what is behind, none of that hidden)
  if ((in.info.x & e_QUAD_ADD) != 0u) { alpha = 0.0; rgb = c.rgb * in.tint.rgb + glow; }
${mode === 'insert' ? '  return e_Over(vec4f(e_dithered(rgb, in.position.xy), alpha), vec4u(0u, 0u, 0u, 8u));' : '  return vec4f(e_dithered(rgb, in.position.xy), alpha);'}
}
` : ''}
${mode === 'multiply' ? /* wgsl */ `
// what multiplies what is behind: its paint over white, as much as there is of it
@fragment fn e_fragment(in: e_Out) -> @location(0) vec4f {
  let dx = dpdx(in.at);
  let dy = dpdy(in.at);
  let taps = e_taps(in.info.x);
  let s = e_sheetFrom(e_SheetCarry(in.sa, in.sb));
  let at = e_readAt(in);
  let amount = e_amount(in);
  let h = e_sheetFind(s, in.page, at, e_sheetLevel(dx, dy, taps));
  if (amount <= 0.0 || e_sheetNone(h)) { discard; }
  let c = e_sheetTake(h, dx, dy, taps) * amount;
  if (c.a <= 0.0) { discard; }
  return vec4f(c.rgb + vec3f(1.0 - c.a), 1.0);
}
` : ''}
${mode === 'cast' ? /* wgsl */ `
@fragment fn e_fragment(in: e_Out) {
  let dx = dpdx(in.at);
  let dy = dpdy(in.at);
${own ? '  e_shadeBegin(dpdx(in.own), dpdy(in.own), e_taps(in.info.x), in.page, in.at);\n' : ''}  let taps = e_taps(in.info.x);
  var c = e_sheetRead(e_sheetFrom(e_SheetCarry(in.sa, in.sb)), in.page, e_readAt(in), dx, dy, taps);
${own ? '  c = e_finite4(shade(c, in.own, in.uvA.xy));\n' : ''}  if (c.a * e_amount(in) < ${CAST.ALPHA}) { discard; }
}
` : ''}
${mode === 'mark' ? /* wgsl */ `
struct e_Mark { @location(0) colour: vec4f, @location(1) ids: vec4u }
@fragment fn e_fragment(in: e_Out) -> e_Mark {
  let dx = dpdx(in.at);
  let dy = dpdy(in.at);
${own ? '  e_shadeBegin(dpdx(in.own), dpdy(in.own), e_taps(in.info.x), in.page, in.at);\n' : ''}  var c = e_sheetRead(e_sheetFrom(e_SheetCarry(in.sa, in.sb)), in.page, e_readAt(in), dx, dy, e_taps(in.info.x));
${own ? '  c = e_finite4(shade(c, in.own, in.uvA.xy));\n' : ''}  if (c.a * e_amount(in) < ${SHEET.OPAQUE / 255}) { discard; }
  return e_Mark(vec4f(0.0), vec4u(0u));
}
` : ''}
${mode === 'mask' ? /* wgsl */ `
// its coverage, into the channel of every cutter set it is of (its row's clip, bits 4–7); the target keeps the most
@fragment fn e_fragment(in: e_Out) -> @location(0) vec4f {
  let dx = dpdx(in.at);
  let dy = dpdy(in.at);
  let a = e_sheetRead(e_sheetFrom(e_SheetCarry(in.sa, in.sb)), in.page, e_readAt(in), dx, dy, e_taps(in.info.x)).a * e_amount(in);
  let sets = in.info.w >> 4u;
  return a * vec4f(f32(sets & 1u), f32((sets >> 1u) & 1u), f32((sets >> 2u) & 1u), f32((sets >> 3u) & 1u));
}
` : ''}
`;

// An element's own shader round its text (LG2): what the author's text is given by these names — layer(k, at),
// emission, at_dx, at_dy, u_time and a u_<name> for each of its uniforms — and the engine's part, e_…: its paintings'
// table (group 2, layout \`own\`: its uniforms' values; for each of its OWN.SHEETS paintings the sheet's handle,
// whether there is one, which ways it wraps (1 across, 2 down) and whether the text reads it only where the quad
// stands (WT2, WT5 \`stands\`); its rect in the painting's units; how its corner lies from the painting's own: whole
// pages (x, y) and the rest in px).
//   A sheet that stands is read from the quad's own origin page — the fragment's own \`at\`, moved by that sheet's
// corner against the painting's: as exact on a sheet of any width as the painting itself (SH14). Any other is read
// from its own corner, at the point the text gives.
const ownText = ({ own }) => /* wgsl */ `
struct e_Own {
  values: array<vec4f, ${OWN.VALUES / 4}>,
  sheets: array<vec4u, ${OWN.SHEETS}>,
  rects: array<vec4f, ${OWN.SHEETS}>,
  lies: array<vec4f, ${OWN.SHEETS}>,
}
@group(2) @binding(0) var<uniform> e_own: e_Own;
var<private> e_ownTaps: f32;
var<private> e_ownPage: vec2i;
var<private> e_ownAt: vec2f;
var<private> emission: vec3f;
var<private> at_dx: vec2f;
var<private> at_dy: vec2f;
var<private> u_time: f32;
${own.names.map(name => `var<private> u_${name}: f32;`).join('\n')}
// painting k (0 its own, 1… its layers) at a point of the painting, its units — outside its rect nothing, but along
// a way the painting wraps: there it is read round
fn layer(k: i32, at: vec2f) -> vec4f {
  if (k < 0 || k >= ${OWN.SHEETS}) { return vec4f(0.0); }
  let h = e_own.sheets[k];
  let r = e_own.rects[k];
  if (h.y == 0u) { return vec4f(0.0); }
  if ((h.z & 1u) == 0u && (at.x < r.x || at.x > r.z)) { return vec4f(0.0); }
  if ((h.z & 2u) == 0u && (at.y < r.y || at.y > r.w)) { return vec4f(0.0); }
  if (h.w != 0u) {
    // (read where the quad stands: the point given is the fragment's own)
    let l = e_own.lies[k];
    return e_sheetRead(e_sheetOf(h.x), e_ownPage + vec2i(l.xy), e_ownAt + l.zw, at_dx * e_PPU, at_dy * e_PPU, e_ownTaps);
  }
  return e_sheetRead(e_sheetOf(h.x), vec2i(0), (at - r.xy) * e_PPU, at_dx * e_PPU, at_dy * e_PPU, e_ownTaps);
}
// before \`shade\` is called: the pixel's footprint on the painting (taken first thing in the fragment's main), the
// taps of its quad's kind, its own place on its painting (its origin page, px from it), the time, its uniforms as
// its animate set them
fn e_shadeBegin(dx: vec2f, dy: vec2f, taps: f32, page: vec2i, at: vec2f) {
  at_dx = dx;
  at_dy = dy;
  e_ownTaps = taps;
  e_ownPage = page;
  e_ownAt = at;
  emission = vec3f(0.0);
  u_time = e_frame.time;
${own.names.map((name, i) => `  u_${name} = e_own.values[${i >> 2}][${i & 3}];`).join('\n')}
}
`;

chunk('render.quad.lit', lit);
chunk('render.quad.vertex', vertex);
chunk('render.quad.fragment', fragment);
chunk('render.own', ownText);
