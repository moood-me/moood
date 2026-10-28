// The scene's renderer on three.js (three.js: the global THREE): the world as it is. Everything stands once where it
// stands in the world — eye heights, X to the right, Y up, Z ahead, as engine.js has it — its painting (engine.js's
// Canvas 2D code) on it as a texture; the camera is a matrix. Moving the camera costs the CPU nothing: the GPU lays
// it all in perspective, hides what is behind by the depth buffer, hazes it by its distance, lights it by where it
// is. Each frame the CPU only moves what moves, repaints what is live (its code reads the time or the state), and
// picks the tiles a plane is seen by (finer where it is near).
//   What stands (an element, a part of one) is a card — a quad of its painting, upright facing the start, turned its
//   own way (facing, tilt), or facing the eye (looking around; a film's camera turned ahead). A plane lies as it
//   lies, painted in tiles finer near the eye; one draped over the relief is the land: a mesh of it, its patches as
//   fine as each is seen. The sky is round the eye, at infinity. Light: as engine.js's light says (lookOf, sources)
//   — laid on each thing where it is and as it faces; the grade (tint, saturation, brightness, vignette, grain, a
//   cut's fade, the camera tipped) is a pass over the frame.
const MooodWorld = (() => {
  const I = Moood.internals;
  const T3 = THREE;

  // ── shaders ─────────────────────────────────────────────────────────────
  // The haze (aerial perspective): air between the eye and a thing tints it toward hazeColor, h(D) = 1 − e^(−D/reach).
  // What stands was painted as seen from the start, Zp away — its haze in its colours already: seen D away, that is
  // taken out and the air's now put in (painted for Zp: k = (1 − h(D))/(1 − h(Zp)), b = h(D) − h(Zp)·k); beyond Z_FAR
  // it holds Z_FAR's haze and as much of the rest as of the way to it. A plane is painted without haze (Zp 0). reach0:
  // the scene's own air, as its painting holds it; reach: the air now (its look).
  const HAZE = `
  uniform float u_reach, u_reach0;
  uniform vec3 u_fog;
  vec4 hazed(vec4 c, float Zp, float D) {
    float Zc = min(Zp, ${I.Z_FAR.toFixed(1)}), d = Zp > 0.0 ? D * Zc / Zp : D;
    float h0 = Zp > 0.0 ? min(0.85, 1.0 - exp(-Zc / u_reach0)) : 0.0, h1 = 1.0 - exp(-max(0.0, d) / u_reach);
    float k = min(3.0, (1.0 - h1) / (1.0 - h0)), b = h1 - h0 * k;
    // (painted colours don't always hold the haze we assume: never darkened more than 40%)
    c.rgb = clamp(c.rgb * k + u_fog * b * c.a, c.rgb * 0.6, vec3(c.a));
    return c;
  }`;
  // A lit scene's light at world point P (lookOf: lit): the ambient, the sources far off (the sun, the moon) by how
  // what is there faces them, and the point sources (u_li: one lighting only what is inside — daylight at a window)
  // by how far they are. What faces a way (a plane, a card turned by `facing`; the land as it slopes: N, has 1) is lit
  // by how it is turned to each — toward the eye: seen from behind, its side we see; a card facing no way of its own
  // (has 0) by the far ones evenly and by a point source as something rounded turned to the eye (a figure before a
  // lamp is a silhouette). inside: lit by what comes in (u_in of the light outside). A window's light (a daylight
  // `of` a window: engine.js windowOf) comes in at all of it — from the point of it nearest P, only before its face; a
  // light far off coming in through panes (`through`) reaches what sees it through one (engine.js throughAt), and
  // that only. What lets light through (`translucent`: sheer) is lit from behind too, that much.
  const FAR = 4, LIGHTS = 8, WINS = 4, TL = 2, PANES = 4, PV = 8;
  // the camera's depth: from NEAR_Z to FAR_Z eye heights (what is farther — a mountain range kilometres off — is drawn
  // all the same: within it)
  const NEAR_Z = '0.05', FAR_Z = '2e5';
  const LIGHT = `
  uniform float u_lit, u_litk;
  uniform vec3 u_amb, u_amb0;
  uniform float u_in;
  uniform int u_dn, u_n;
  uniform vec3 u_dd[${FAR}], u_dc[${FAR}];
  uniform vec4 u_lp[${LIGHTS}];
  uniform vec3 u_lc[${LIGHTS}];
  uniform float u_li[${LIGHTS}];
  #ifdef WINDOWS
  // the windows: each its middle and its light's reach, half its sides (b.w: which way a × b faces the room), colour
  uniform int u_nw;
  uniform vec4 u_wp[${WINS}], u_wa[${WINS}], u_wb[${WINS}];
  uniform vec3 u_wc[${WINS}];
  #endif
  #ifdef THROUGH
  // the lights far off through panes: toward each, its colour, how soft its edge; the panes — whose light, a corner,
  // its axes and normal, how many corners and they in its axes
  uniform int u_tn, u_pn;
  uniform vec3 u_td[${TL}], u_tc[${TL}];
  uniform float u_ts[${TL}];
  uniform int u_pl[${PANES}], u_pk[${PANES}];
  uniform vec3 u_qo[${PANES}], u_qu[${PANES}], u_qv[${PANES}], u_qnr[${PANES}];
  uniform vec2 u_pp[${PANES * PV}];
  #endif
  float facing(vec3 n, vec3 v) { return clamp((dot(n, v) + 0.5) / 1.5, 0.0, 1.0); }
  float rounded(vec3 P, vec3 v) { return mix(0.3, 1.0, smoothstep(-0.45, 0.5, dot(normalize(cameraPosition - P), v))); }
  #ifdef THROUGH
  // (how much of light i through panes reaches P: 1 where the way to it goes through one, 0 where it meets none,
  // softly between; before them all — outside — all of it)
  float throughAt(int i, vec3 P, float inside) {
    float best = 0.0;
    bool past = inside > 0.5;
    vec3 d = u_td[i];
    for (int w = 0; w < ${PANES}; w++) {
      if (w >= u_pn) break;
      if (u_pl[w] != i) continue;
      float nd = dot(u_qnr[w], d);
      if (abs(nd) < 1e-6) continue;
      float t = dot(u_qnr[w], u_qo[w] - P) / nd;
      if (t <= 0.0) continue;
      past = true;
      vec3 h = P + d * t - u_qo[w];
      vec2 q = vec2(dot(h, u_qu[w]), dot(h, u_qv[w]));
      bool within = false;
      float dist = 1e9;
      for (int k = 0; k < ${PV}; k++) {
        if (k >= u_pk[w]) break;
        vec2 a = u_pp[w * ${PV} + (k == 0 ? u_pk[w] - 1 : k - 1)], b = u_pp[w * ${PV} + k], e = b - a;
        if ((b.y > q.y) != (a.y > q.y) && q.x < a.x + e.x * (q.y - a.y) / e.y) within = !within;
        dist = min(dist, length(q - a - e * clamp(dot(q - a, e) / max(dot(e, e), 1e-12), 0.0, 1.0)));
      }
      float u = clamp(0.5 + (within ? dist : -dist) / u_ts[i], 0.0, 1.0);
      best = max(best, u * u * (3.0 - 2.0 * u));
    }
    return past ? best : 1.0;
  }
  #endif
  // (light from v on what faces N — and, letting it through (sheer: V, the way it faces, toward the eye), from behind
  // it too)
  float from(vec3 P, vec3 N, float has, vec3 v, float sheer, vec3 V) {
    return mix(rounded(P, v), facing(N, v), has) + (sheer > 0.0 ? sheer * clamp(-dot(V, v), 0.0, 1.0) : 0.0);
  }
  vec3 lightAt(vec3 P, float inside, vec3 N, float has, float sheer) {
    if (has > 0.0 && dot(N, cameraPosition - P) < 0.0) N = -N;
    vec3 V = sheer > 0.0 ? normalize(mix(normalize(cameraPosition - P), N, has)) : N;
    vec3 far = u_amb0;
    for (int i = 0; i < ${FAR}; i++) { if (i >= u_dn) break; far += u_dc[i] * facing(N, u_dd[i]); }
    vec3 L = mix(u_amb, far, has) * mix(1.0, u_in, inside);
    // (what lets light through: the far ones from behind it too — the way it faces, or the eye's)
    if (sheer > 0.0) for (int i = 0; i < ${FAR}; i++) { if (i >= u_dn) break; L += u_dc[i] * sheer * clamp(-dot(V, u_dd[i]), 0.0, 1.0) * mix(1.0, u_in, inside); }
    #ifdef THROUGH
    for (int i = 0; i < ${TL}; i++) {
      if (i >= u_tn) break;
      float k = throughAt(i, P, inside);
      if (k <= 0.0) continue;
      L += u_tc[i] * k * (mix(1.0 - 0.7 * clamp(u_td[i].z / 0.3, 0.0, 1.0), facing(N, u_td[i]), has) + sheer * clamp(-dot(V, u_td[i]), 0.0, 1.0));
    }
    #endif
    #ifdef WINDOWS
    if (inside > 0.5) for (int j = 0; j < ${WINS}; j++) {
      if (j >= u_nw) break;
      vec3 a = u_wa[j].xyz, b = u_wb[j].xyz, e = P - u_wp[j].xyz;
      float front = dot(e, normalize(cross(a, b)) * u_wb[j].w);
      if (front <= 0.0) continue;
      vec3 d = a * clamp(dot(e, a) / dot(a, a), -1.0, 1.0) + b * clamp(dot(e, b) / dot(b, b), -1.0, 1.0) - e;
      float l = max(length(d), 1e-4), x = l / u_wp[j].w;
      if (x >= 1.0) continue;
      L += u_wc[j] * u_litk * (1.0 - x * x) * (1.0 - x * x) * front / l * from(P, N, has, d / l, sheer, V);
    }
    #endif
    for (int i = 0; i < ${LIGHTS}; i++) {
      if (i >= u_n) break;
      if (u_li[i] > 0.5 && inside < 0.5) continue;
      vec3 d = u_lp[i].xyz - P;
      float x = length(d) / u_lp[i].w;
      if (x >= 1.0) continue;
      float f = (1.0 - x * x) * (1.0 - x * x);
      L += u_lc[i] * u_litk * f * from(P, N, has, d / max(length(d), 1e-4), sheer, V);
    }
    return L;
  }
  // A plane's pool of light (\`lit\`: where the scene is not lit — a lamp's spot on the floor, a fire's glow): the
  // point sources on its face's side (N) by how far they are
  vec3 poolAt(vec3 P, vec3 N) {
    if (dot(N, cameraPosition - P) < 0.0) N = -N;
    vec3 L = vec3(0.0);
    for (int i = 0; i < ${LIGHTS}; i++) {
      if (i >= u_n) break;
      vec3 d = u_lp[i].xyz - P;
      float x = length(d) / u_lp[i].w;
      if (x >= 1.0 || dot(d, N) < -0.03) continue;
      L += u_lc[i] * (1.0 - x * x) * (1.0 - x * x);
    }
    return L;
  }`;
  // A reflecting plane's mirror is the scene drawn again from the eye mirrored in the plane (mirrors): what is on the
  // eye's side of it only (u_clip: the plane, n·P + d ≥ 0 kept; when not mirroring, all), each point writing beside its
  // colour how high above the plane it is (eye heights) and how many px of the frame that is where it is seen — what
  // the mirror is faded and blurred by (MIRROR_FS) — and how much of it shines (what glows, a light's glow: what a rough
  // mirror draws a path of; not what is merely light, a bright sky). In the frame what is written beside the colour is the light in it
  // no shadow darkens (shadowsLaid, post): what a mirror, a pane gives back, what glows — light that does not fall
  // there; a painting laid over it covers it as much as it covers what is behind
  const CLIP = `
  uniform vec4 u_clip, u_clip2;
  uniform vec2 u_res;
  layout(location = 1) out vec4 o_h;
  layout(location = 2) out vec4 o_a;
  // (how high above the mirror — below: less than 0; and in a mirror seen in another, behind that one: less than 0)
  float above(vec3 P) { return dot(u_clip2.xyz, P) + u_clip2.w < 0.0 ? -1.0 : dot(u_clip.xyz, P) + u_clip.w; }
  bool mirroring() { return u_clip.xyz != vec3(0.0); }
  vec4 beside(vec4 c, float h, float D, bool glows) { return mirroring() ? vec4(h, h * u_res.y / max(D, 1e-3), glows ? 1.0 : 0.0, 1.0) * c.a : glows ? c : vec4(0.0, 0.0, 0.0, c.a); }`;
  // A quad of a painting in the world: its corner (0, 0) u_o, its sides u_a (across: the painting's x) and u_b (down:
  // its y), the part of the painting u_uv laid on it (u0, v0, u1, v1). A card standing on the ground has its foot's row
  // (u_foot, v): what it paints below its foot (a shadow at its feet, feet painted a little low) lies on the ground
  // toward the eye — as deep as the ground it covers (u_gp: a point of that ground, w 1 — there is one; u_gn its
  // normal), so the floor in front does not cut it. (a_q: the quad's points, u across, v down; v 0.5 — the foot's row.)
  // (a corner exactly in the eye's plane — a plane's near edge where the eye stands — has w 0: put a hair behind it,
  // where clipping takes it as it should; some software rasterizers lay such a triangle's depth wrong)
  const EYE_PLANE = `vec4 seen(vec4 e) { if (abs(e.z) < 1e-4) e.z = 1e-4; return e; }`;
  const QUAD_VS = `
  in vec2 a_q;
  uniform mat4 projectionMatrix, viewMatrix;
  uniform vec3 cameraPosition;
  uniform vec3 u_o, u_a, u_b;
  uniform vec4 u_uv, u_gp, u_gn;
  uniform float u_foot;
  out vec2 v_uv; out vec3 v_w; out float v_d, v_below, v_v;
  ${EYE_PLANE}
  void main() {
    float v = a_q.y == 0.5 ? u_foot : a_q.y;
    v_v = v;
    vec3 P = u_o + u_a * a_q.x + u_b * v;
    v_uv = mix(u_uv.xy, u_uv.zw, vec2(a_q.x, v));
    v_w = P;
    vec4 e = seen(viewMatrix * vec4(P, 1.0));
    v_d = -e.z;
    v_below = a_q.y == 1.0 && u_gp.w > 0.0 ? 1.0 : 0.0;
    gl_Position = projectionMatrix * e;
    if (v_below > 0.0) {
      vec3 r = P - cameraPosition;
      float k = dot(u_gn.xyz, r);
      if (k < -1e-6) {
        vec4 g = projectionMatrix * (viewMatrix * vec4(cameraPosition + r * (dot(u_gn.xyz, u_gp.xyz - cameraPosition) / k), 1.0));
        gl_Position.z = g.z / g.w * gl_Position.w;
      }
    }
  }`;
  // ... its painting, hazed, lit (a lit scene; not what glows), as much of it as u_alpha (a card fading as it is
  // passed close by, or seen edge on). u_zp: the distance it was painted for (0: without haze); u_way: the way it
  // faces (w 1), or none (w 0: a card facing the eye); u_inside — `inside`; u_unlit — the light does not darken it.
  const PAINT_FS = `
  precision highp float;
  uniform vec3 cameraPosition;
  uniform sampler2D u_tex;
  uniform float u_alpha, u_alpha2, u_zp, u_inside, u_unlit, u_pool, u_cut, u_sheer;
  uniform vec4 u_way;
  uniform vec2 u_canvas;
  uniform sampler2D u_cutby;
  ${HAZE}
  ${LIGHT}
  ${CLIP}
  in vec2 v_uv; in vec3 v_w; in float v_d, v_below, v_v;
  layout(location = 0) out vec4 o;
  void main() {
    float h = above(v_w);
    if (h < 0.0) discard;
    vec4 c = texture(u_tex, v_uv) * (u_alpha2 < 0.0 ? u_alpha : mix(u_alpha, u_alpha2, v_v));
    // (seen only within what others paint now, u_cut 1 — or out of it, 2: clip)
    if (u_cut > 0.0) { float m = texture(u_cutby, gl_FragCoord.xy / u_canvas).a; c *= u_cut > 1.5 ? 1.0 - m : m; }
    if (c.a <= 0.002) discard;
    bool lit = u_lit > 0.0 && u_unlit < 0.5;
    o_a = lit ? c : vec4(0.0, 0.0, 0.0, c.a);
    c = hazed(c, u_zp, v_d);
    if (lit) c.rgb *= lightAt(v_w, u_inside, u_way.xyz, u_way.w, u_sheer);
    if (u_pool > 0.0) c.rgb += (c.rgb + 0.12 * c.a) * poolAt(v_w, u_way.xyz) * u_pool;
    o = c;
    o_h = beside(c, h, v_d, u_unlit > 0.5);
  }`;
  // ... laying its depth where it is nearly opaque (not below its foot: that lies on the ground, laying none) — a
  // soft edge, a glow, a veil lays none: what is drawn after it and stands behind it is hidden there
  const DEPTH_FS = `
  precision highp float;
  uniform sampler2D u_tex;
  uniform float u_alpha;
  ${CLIP}
  in vec2 v_uv; in vec3 v_w; in float v_d, v_below;
  layout(location = 0) out vec4 o;
  void main() {
    if (v_below > 0.0 || above(v_w) < 0.0 || texture(u_tex, v_uv).a * u_alpha < 0.5) discard;
    o = vec4(0.0); o_h = vec4(0.0);
  }`;
  // A person (people.js): their picture drawn as the camera sees them, and beside it how they face and how far they
  // are at each pixel (u_aux: n·a, depth·a — eye heights along the gaze): laid on their card, but each point of them as
  // deep as it is (the depth buffer: an arm before a post, the post before the other arm), hazed and lit (a lit scene)
  // there as it faces. Without the facing and depth (a GPU that can't draw them): the card's.
  const PERSON_FS = `
  precision highp float;
  uniform mat4 projectionMatrix;
  uniform vec3 cameraPosition;
  uniform sampler2D u_tex, u_aux;
  uniform float u_alpha, u_zp, u_inside, u_aux_on;
  ${HAZE}
  ${LIGHT}
  ${CLIP}
  in vec2 v_uv; in vec3 v_w; in float v_d, v_below;
  layout(location = 0) out vec4 o;
  void main() {
    vec4 p = texture(u_tex, v_uv), x = u_aux_on > 0.0 ? texture(u_aux, v_uv) : vec4(0.0);
    vec4 c = p * u_alpha;
    if (c.a <= 0.002) discard;
    o_a = u_lit > 0.0 ? c : vec4(0.0, 0.0, 0.0, c.a);
    float D = u_aux_on > 0.0 && p.a > 0.004 ? x.a / p.a : v_d;
    // (the point of them under this pixel: on the ray to the card's, D along the gaze)
    vec3 P = cameraPosition + (v_w - cameraPosition) * (D / max(v_d, 1e-4));
    float h = above(P);
    if (h < 0.0) discard;
    gl_FragDepth = ((projectionMatrix[2][2] * -D + projectionMatrix[3][2]) / D) * 0.5 + 0.5;
    c = hazed(c, u_zp, D);
    if (u_lit > 0.0) {
      // (what of them glows — a lamp's glass in a hand: no surface's facing, (1, 1, 1), longer than any — keeps its own
      // colour, no light laid on it)
      vec3 n = u_aux_on > 0.0 && p.a > 0.004 ? x.rgb / p.a : vec3(0.0);
      float has = smoothstep(0.3, 0.8, length(n)), glow = smoothstep(1.05, 1.6, length(n));
      c.rgb = mix(c.rgb * lightAt(P, u_inside, has > 0.0 ? normalize(n) : vec3(0.0, 1.0, 0.0), has, 0.0), c.rgb, glow);
    }
    o = c;
    o_h = beside(c, h, D, false);
  }`;
  const PERSON_DEPTH_FS = `
  precision highp float;
  uniform mat4 projectionMatrix;
  uniform vec3 cameraPosition;
  uniform sampler2D u_tex, u_aux;
  uniform float u_alpha, u_aux_on;
  ${CLIP}
  in vec2 v_uv; in vec3 v_w; in float v_d, v_below;
  layout(location = 0) out vec4 o;
  void main() {
    vec4 p = texture(u_tex, v_uv);
    if (p.a * u_alpha < 0.5) discard;
    float D = u_aux_on > 0.0 ? texture(u_aux, v_uv).a / p.a : v_d;
    if (above(cameraPosition + (v_w - cameraPosition) * (D / max(v_d, 1e-4))) < 0.0) discard;
    gl_FragDepth = ((projectionMatrix[2][2] * -D + projectionMatrix[3][2]) / D) * 0.5 + 0.5;
    o = vec4(0.0); o_h = vec4(0.0);
  }`;
  // (a node's heights: its LAND_N + 1 points a side and one more round them — what its normals at its edges read)
  const LAND_N = 16, LAND_TS = LAND_N + 3, SLOTS = Math.floor(1024 / LAND_TS);
  // The land (the relief, chunked LOD: landDraws): a node of it drawn as a grid of LAND_N cells over its square (a_node:
  // its corner x, z, its size, eye heights; its edges beside a coarser node, bits: −x, +x, −z, +z) — each point (a_g)
  // where the relief puts it, the heights read from the atlas (u_heights; a_tile: the square the node's heights are
  // of, their slot), every other point of an edge beside a coarser node on that one's line (no crack); its normal
  // from the heights about it. Its heights changing (finer ones come, or it is a new node, split from one coarser) go
  // from those it was drawn by (a_from: their square, their slot) to its own over LAND_MORPH seconds — a_m: how far
  // (its inside, then each edge: −x, +x, −z, +z — an edge goes as the node beside it does, or is there at once: the
  // two drawn alike, no crack). And each plane draped over it its
  // painting laid there by where each point of it is on the plane (its middle u_pc, its axes u_pr across, u_pu toward
  // its far edge, its size u_ps): every draped plane the same surface, the later laid over the earlier — a field, a road
  // on it, a bank — none showing through another. A tile of the plane takes its part u_rect of it (f0, g0, f1, g1 — 0…1
  // of the plane), its painting's part u_uv laid there.
  const LAND_VS = `
  in vec2 a_g;
  in vec4 a_node, a_tile, a_from, a_me;
  in float a_mi;
  uniform mat4 projectionMatrix, viewMatrix;
  uniform highp sampler2D u_heights;
  uniform vec4 u_uv, u_rect;
  uniform vec3 u_pc, u_pr, u_pu;
  uniform vec2 u_ps;
  out vec2 v_uv, v_fg; out vec3 v_w, v_n; out float v_d, v_below, v_v;
  ${EYE_PLANE}
  float at(ivec2 o, int x, int y) { return texelFetch(u_heights, o + ivec2(clamp(x, -1, ${LAND_N + 1}) + 1, clamp(y, -1, ${LAND_N + 1}) + 1), 0).r; }
  // (the height at world x, z by tile t: its points about it, between them as the cells' triangles lie)
  float heightIn(vec4 t, vec2 w) {
    int slot = int(t.w + 0.5);
    ivec2 o = ivec2(slot % ${SLOTS}, slot / ${SLOTS}) * ${LAND_TS};
    vec2 p = clamp((w - t.xy) / t.z * ${LAND_N}.0, -1.0, ${LAND_N + 1}.0);
    ivec2 i = ivec2(min(floor(p), vec2(${LAND_N}.0)));
    vec2 f = p - vec2(i);
    float h00 = at(o, i.x, i.y), h10 = at(o, i.x + 1, i.y), h01 = at(o, i.x, i.y + 1), h11 = at(o, i.x + 1, i.y + 1);
    return f.x + f.y <= 1.0 ? h00 + (h10 - h00) * f.x + (h01 - h00) * f.y : h11 + (h01 - h11) * (1.0 - f.x) + (h10 - h11) * (1.0 - f.y);
  }
  // ... as the node shows it now: m of the way from the heights it was drawn by to its own
  float morph;
  float heightAt(vec2 w) { return morph >= 1.0 ? heightIn(a_tile, w) : mix(heightIn(a_from, w), heightIn(a_tile, w), morph); }
  void main() {
    float c = a_node.z / ${LAND_N}.0;
    vec2 w = a_node.xy + a_g * c;
    int gx = int(a_g.x + 0.5), gy = int(a_g.y + 0.5), edges = int(a_node.w + 0.5);
    morph = a_mi;
    if (gx == 0) morph = max(morph, a_me.x);
    if (gx == ${LAND_N}) morph = max(morph, a_me.y);
    if (gy == 0) morph = max(morph, a_me.z);
    if (gy == ${LAND_N}) morph = max(morph, a_me.w);
    float h = heightAt(w);
    if ((gy & 1) == 1 && (((edges & 1) != 0 && gx == 0) || ((edges & 2) != 0 && gx == ${LAND_N}))) h = 0.5 * (heightAt(w - vec2(0.0, c)) + heightAt(w + vec2(0.0, c)));
    if ((gx & 1) == 1 && (((edges & 4) != 0 && gy == 0) || ((edges & 8) != 0 && gy == ${LAND_N}))) h = 0.5 * (heightAt(w - vec2(c, 0.0)) + heightAt(w + vec2(c, 0.0)));
    vec3 P = vec3(w.x, h, w.y);
    v_n = normalize(vec3(heightAt(w - vec2(c, 0.0)) - heightAt(w + vec2(c, 0.0)), 2.0 * c, heightAt(w - vec2(0.0, c)) - heightAt(w + vec2(0.0, c))));
    vec3 d = P - u_pc;
    v_fg = vec2((dot(d, u_pr) + u_ps.x * 0.5) / u_ps.x, (u_ps.y * 0.5 - dot(d, u_pu)) / u_ps.y);
    v_uv = mix(u_uv.xy, u_uv.zw, (v_fg - u_rect.xy) / (u_rect.zw - u_rect.xy));
    v_w = P; v_below = 0.0; v_v = v_fg.y;
    vec4 e = seen(viewMatrix * vec4(P, 1.0));
    v_d = -e.z;
    gl_Position = projectionMatrix * e;
  }`;
  // (what is off the tile, not drawn; nor what is sheer — steeper than 80°: a cliff's face is a card's)
  const OFF_TILE = `
  uniform vec4 u_rect;
  in vec2 v_fg;
  void main() {
    if (v_fg.x < u_rect.x || v_fg.y < u_rect.y || v_fg.x >= u_rect.z || v_fg.y >= u_rect.w || normalize(v_n).y < 0.17) discard;`;
  const LAND_FS = PAINT_FS.replace('in vec2 v_uv; in vec3 v_w; in float v_d, v_below, v_v;', 'in vec2 v_uv; in vec3 v_w, v_n; in float v_d, v_below, v_v;')
    .replace('lightAt(v_w, u_inside, u_way.xyz, u_way.w, u_sheer)', 'lightAt(v_w, u_inside, normalize(v_n), 1.0, 0.0)').replace('poolAt(v_w, u_way.xyz)', 'poolAt(v_w, normalize(v_n))')
    .replace('\n  void main() {', OFF_TILE);
  const LAND_DEPTH_FS = DEPTH_FS.replace('in vec2 v_uv; in vec3 v_w;', 'in vec2 v_uv; in vec3 v_w, v_n;').replace('\n  void main() {', OFF_TILE);
  // Light in the air and on what glows (e.light's glows, a source's halo, the haze lit round a lamp): a sprite facing
  // the eye at world point u_at, u_size across (eye heights), its colour × alpha added
  const GLOW_VS = `
  in vec2 a_q;
  uniform mat4 projectionMatrix, viewMatrix;
  uniform vec3 u_spot;
  uniform float u_size;
  out vec2 v_q;
  void main() {
    v_q = a_q;
    vec4 e = viewMatrix * vec4(u_spot, 1.0);
    e.xy += (a_q - 0.5) * vec2(1.0, -1.0) * u_size;
    gl_Position = projectionMatrix * e;
  }`;
  const GLOW_FS = `
  precision highp float;
  uniform sampler2D u_tex;
  uniform vec3 u_col, u_spot;
  uniform float u_alpha;
  ${CLIP}
  in vec2 v_q;
  layout(location = 0) out vec4 o;
  void main() {
    if (above(u_spot) < 0.0) discard;
    o = vec4(texture(u_tex, v_q).rgb * u_col * u_alpha, 0.0); o_h = mirroring() ? vec4(0.0, 0.0, max(o.r, max(o.g, o.b)), 0.0) : o; o_a = vec4(0.0);
  }`;
  // What is fixed to the frame — the sky round the eye, an insert, a glow of the sky — laid in the frame's pixels
  // (a_q 0…1 over u_rect: x, y, w, h — y down from the frame's top; v_px: the frame's px there), the canvas u_canvas
  // with the frame at u_at in it
  const FRAME_VS = `
  in vec2 a_q;
  uniform vec4 u_rect;
  uniform vec2 u_canvas, u_at;
  out vec2 v_q, v_px;
  void main() {
    v_q = a_q; v_px = u_rect.xy + a_q * u_rect.zw;
    vec2 p = u_at + v_px;
    gl_Position = vec4(p.x / u_canvas.x * 2.0 - 1.0, 1.0 - p.y / u_canvas.y * 2.0, 0.0, 1.0);
  }`;
  // The sky (a sky element's painting, u_r: where it is painted, px of the frame as the start sees it): what each
  // pixel of the frame looks at. Ahead it is a backdrop seen from the front — the gaze lowered (u_look, px) moving it
  // up; a film's camera turned (u_pan, px: a screen height a radian) carries it round the eye, its right edge going on
  // into its left behind (u_wrap: the circle, px). Looking around (u_round) it is the full circle: a column of the
  // frame shows the bearing it looks at (u_yaw).
  const SKY_FS = `
  precision highp float;
  uniform sampler2D u_tex;
  uniform vec4 u_r;
  uniform vec2 u_res;
  uniform float u_look, u_pan, u_wrap, u_round, u_yaw, u_alpha, u_flip, u_hz;
  uniform vec2 u_canvas, u_at;
  uniform mat4 u_unproj;
  uniform vec3 u_eye;
  in vec2 v_q, v_px;
  layout(location = 0) out vec4 o;
  layout(location = 1) out vec4 o_h;
  layout(location = 2) out vec4 o_a;
  vec4 at(float x, float y) { return texture(u_tex, vec2((x - u_r.x) / u_r.z, (y - u_r.y) / u_r.w)); }
  void main() {
    vec2 p = v_px;
    float y = p.y + u_look, x;
    if (u_flip > 0.0) {
      // (in a mirror — level, upright, one seen in another: the way this pixel looks, from the eye mirrored (u_eye,
      // u_unproj), at its bearing and height as the start sees the sky — the gaze turned u_yaw, carried u_pan)
      vec2 c = u_at + p;
      vec4 q = u_unproj * vec4(c.x / u_canvas.x * 2.0 - 1.0, 1.0 - c.y / u_canvas.y * 2.0, 1.0, 1.0);
      vec3 d = q.xyz / q.w - u_eye;
      float b = atan(d.x, d.z), r = b - u_yaw, fwd = length(d.xz) * cos(r);
      if (u_round > 0.0) { x = u_r.x + mod(b / 6.2831853 + 0.5, 1.0) * u_r.z; y = u_hz - u_res.y * d.y / max(length(d.xz), 1e-6); }
      else { if (fwd <= 1e-4) discard; x = u_res.x * 0.5 + u_res.y * tan(r) + u_pan; y = u_hz - u_res.y * d.y / fwd; }
    } else if (u_round > 0.0) x = u_r.x + mod((u_yaw + atan((p.x - u_res.x * 0.5) / u_res.y)) / 6.2831853 + 0.5, 1.0) * u_r.z;
    else x = p.x + u_pan;
    if (y < u_r.y || y > u_r.y + u_r.w) discard;
    vec4 c;
    if (u_round > 0.0 || u_pan == 0.0) c = at(clamp(x, u_r.x + 0.5, u_r.x + u_r.z - 0.5), y);
    else {
      float s = mod(x - u_r.x, u_wrap), back = u_wrap - u_r.z;
      if (s <= u_r.z || back <= 0.0) c = at(u_r.x + min(s, u_r.z - 0.5), y);
      else { float f = (s - u_r.z) / back; c = mix(at(u_r.x + u_r.z - 0.5, y), at(u_r.x + 0.5, y), f); }
    }
    o = c * u_alpha;
    // (in a mirror: far above it — and as many px from where it meets it as it is from the horizon; in the frame its
    // light, no shadow on it)
    o_h = u_flip > 0.0 ? vec4(1e4, abs(u_hz - y), 0.0, 1.0) * o.a : o; o_a = vec4(0.0, 0.0, 0.0, o.a);
  }`;
  // A reflecting plane's mirror laid on it, over its painting, as its tiles are drawn: the mirror (u_mc, u_mh: the
  // colour and how high above the plane each point is, how many px — at half the canvas, with mip levels) where its
  // painting is (u_tex), u_strength of it, fading out over u_fade above the plane, blurred the more the farther above
  // it (u_blur per px from where it meets the plane). Where nothing is mirrored, the height round about. Rough
  // (u_rough): read along a stretch the way its face points across the frame (u_axis) — its colours smeared a little,
  // what is near white in it (a lamp, the moon, the sun) drawn along the whole stretch: a long path of light. Ripple
  // (u_ripple): small waves going over it (in its own metres — from its middle u_pc along its axes u_pr, u_pu — so they
  // lie in perspective; those finer than a pixel left out) tip it, the mirror read that much aside.
  const MIRROR_FS = `
  precision highp float;
  uniform vec3 cameraPosition;
  uniform sampler2D u_tex, u_mc, u_mh;
  uniform vec2 u_canvas, u_axis;
  uniform vec3 u_pc, u_pr, u_pu;
  uniform vec4 u_way;
  uniform float u_alpha, u_strength, u_fade, u_blur, u_rough, u_ripple, u_t, u_h, u_mpool;
  ${LIGHT}
  ${CLIP}
  in vec2 v_uv; in vec3 v_w; in float v_d, v_below;
  layout(location = 0) out vec4 o;
  const int TAPS = 16;
  void main() {
    vec2 q = gl_FragCoord.xy / u_canvas;
    if (u_ripple > 0.0) {
      vec2 P = vec2(dot(v_w - u_pc, u_pr), dot(v_w - u_pc, u_pu)) * ${I.EYE.toFixed(2)}, tilt = vec2(0.0);
      float px = length(fwidth(P));
      for (int i = 0; i < 4; i++) {
        float fi = float(i), l = 2.6 * pow(0.55, fi), a = 0.7 + 0.6 * fi;
        vec2 dir = vec2(cos(a), sin(a));
        tilt += dir * cos(dot(dir, P) * 6.2832 / l - u_t * (1.1 + 0.4 * fi) * 6.2832 / sqrt(l * 6.0)) * (1.0 - smoothstep(0.25, 0.5, px / l));
      }
      q += (vec2(u_axis.y, -u_axis.x) * tilt.x * 0.4 + u_axis * tilt.y) * u_ripple * 0.012 * u_h / u_canvas;
    }
    vec4 hc = textureLod(u_mh, q, 0.0), hb = textureLod(u_mh, q, 5.0);
    vec2 hd = hc.a > 0.5 ? hc.rg / hc.a : hb.rg / max(hb.a, 1e-4);
    float lod = min(6.0, log2(max(1.0, u_blur * hd.y)));
    vec2 d = exp2(lod) * 0.5 / u_canvas;
    vec4 c = vec4(0.0);
    for (int i = 0; i < 4; i++) c += textureLod(u_mc, q + d * vec2(i == 0 || i == 3 ? -1.0 : 1.0, i < 2 ? -1.0 : 1.0), lod);
    c *= 0.25;
    vec3 L = c.rgb;
    if (u_rough > 0.0) {
      float span = u_rough * 0.6 * u_h, lr = max(lod, log2(max(1.0, span / float(TAPS))));
      vec4 soft = vec4(0.0); vec3 bright = vec3(0.0), here = vec3(0.0);
      for (int i = 0; i < TAPS; i++) {
        float u = (float(i) + 0.5) / float(TAPS) - 0.5, w = exp(-u * u * 60.0);
        vec2 at = q + u_axis * span * u / u_canvas;
        vec4 m = textureLod(u_mc, at, lr), mh = textureLod(u_mh, at, lr);
        vec3 b = m.rgb * clamp(mh.b / max(mh.a, 1e-3), 0.0, 1.0);
        soft += m * w; bright += b;
        if (i == TAPS / 2) here = b;
      }
      L = soft.rgb / max(soft.a, 1e-3) * c.a + max(vec3(0.0), 3.0 * bright / float(TAPS) - here);
    }
    vec4 p = texture(u_tex, v_uv);
    float f = u_fade > 0.0 ? 1.0 - smoothstep(0.0, u_fade, hd.x) : 1.0, k = u_strength * f * p.a * u_alpha;
    o = vec4(L * k, c.a * k);
    // (seen in another mirror: how high above that one it lies; in the frame: the light it gives back)
    float h = above(v_w);
    o_h = mirroring() ? vec4(h, h * u_res.y / max(v_d, 1e-3), 0.0, 1.0) * o.a : o; o_a = vec4(0.0, 0.0, 0.0, o.a);
    // (its pool of light — \`lit\` — over the mirror, as it lies on the painting)
    if (u_mpool > 0.0) o.rgb += (p.rgb + 0.12 * p.a) * poolAt(v_w, u_way.xyz) * u_mpool * u_alpha;
  }`;
  // A shadow (shadows): the caster's painting, black, laid where it falls (on a floor, on a wall, on the land) — its
  // triangles where they lie in the world (a_pos), each corner's place on the caster (a_uv) and on what it falls on
  // (a_uv2), how much of each of the lights it is cast from reaches there (a_g: engine.js reachShare, of shadowLights —
  // up to three) and how blurred (a_blur: the penumbra, of the caster's painting); how dark: in a lit scene the light's
  // share of all there (u_src: which of them it is; those lights as strong as they are now, u_str; the ambient, u_amb),
  // else as much of full light as reaches — mixed by how lit the scene is (u_lit) —, times the shadow's strength (u_k) —
  // worked out as it is drawn, so a light dimming, the
  // dawn coming, changes no triangle; only where what it falls
  // on is painted (u_mask), and not where something stands before it (the frame's depth, u_depth). The caster's
  // painting over a disc as wide as the penumbra (a spiral of taps), each read from its level as coarse as the taps
  // lie apart: a wide penumbra — a long shadow on a slope the light grazes — is the painting blurred, not picked in
  // streaks. The shadows of one light into one mask, each taking the most of its own and those laid there (MAX)
  const SHADOW_VS = `
  in vec3 a_pos;
  in vec2 a_uv, a_uv2, a_blur;
  in vec3 a_g;
  uniform mat4 projectionMatrix, viewMatrix;
  uniform vec3 u_str, u_src;
  uniform float u_amb, u_lit, u_k;
  out vec2 v_uv, v_uv2, v_blur; out float v_a, v_d;
  ${EYE_PLANE}
  void main() {
    vec3 r = a_g * u_str;
    float I = dot(r, u_src), all = u_amb + r.x + r.y + r.z;
    v_a = u_k * ((1.0 - u_lit) * min(1.0, I) + u_lit * I / (all != 0.0 ? all : 1.0));
    v_uv = a_uv; v_uv2 = a_uv2; v_blur = a_blur;
    vec4 e = seen(viewMatrix * vec4(a_pos, 1.0));
    v_d = -e.z;
    gl_Position = projectionMatrix * e;
  }`;
  const SHADOW_FS = `
  precision highp float;
  uniform sampler2D u_tex, u_mask, u_depth;
  uniform vec2 u_canvas;
  in vec2 v_uv, v_uv2, v_blur; in float v_a, v_d;
  out vec4 o;
  void main() {
    float inside = step(0.0, v_uv2.x) * step(v_uv2.x, 1.0) * step(0.0, v_uv2.y) * step(v_uv2.y, 1.0);
    float m = texture(u_mask, v_uv2).a * inside * v_a;
    if (m <= 0.0) discard;
    // (how far what is drawn there is: something nearer stands before the shadow)
    float z = texture(u_depth, gl_FragCoord.xy / u_canvas).r * 2.0 - 1.0, D = 2.0 * ${NEAR_Z} * ${FAR_Z} / (${FAR_Z} + ${NEAR_Z} - z * (${FAR_Z} - ${NEAR_Z}));
    // (and nothing in front of it: a shadow lies on what is drawn there — not across the air before it, a long strip of
    // a low sun's penumbra spanning a rise)
    if (v_d > D * 1.004 + 0.01 || v_d < D * 0.98 - 0.02) discard;
    vec2 sz = vec2(textureSize(u_tex, 0));
    float lod = max(0.0, log2(max(v_blur.x * sz.x, v_blur.y * sz.y) / 4.0)), a = 0.0;
    for (int i = 0; i < 16; i++) {
      float f = (float(i) + 0.5) / 16.0, t = float(i) * 2.39996;
      // (past the caster's painting — its penumbra reaches there — it is clear)
      vec2 p = v_uv + vec2(cos(t), sin(t)) * sqrt(f) * v_blur;
      a += textureLod(u_tex, p, lod).a * step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0);
    }
    o = vec4(0.0, 0.0, 0.0, a / 16.0 * m);
  }`;
  // ... and what each pixel keeps of the light falling there darkened by a light's mask
  const SHADE_FS = `
  precision highp float;
  uniform sampler2D u_tex;
  uniform vec2 u_canvas;
  out vec4 o;
  void main() { o = vec4(0.0, 0.0, 0.0, texture(u_tex, gl_FragCoord.xy / u_canvas).a); }`;
  // A pane of glass (`glass`): where its element paints (u_tex) the room before it mirrored in it (the mirror pass,
  // u_mc, u_mh), blurred the more the farther what is mirrored is from the glass (u_blur), screened over what is seen
  // through it (it shows on the dark, hardly on the light); u_strength — the pane's, times how dark it is beyond
  const GLASS_FS = `
  precision highp float;
  uniform sampler2D u_tex, u_mc, u_mh;
  uniform vec2 u_canvas;
  uniform float u_alpha, u_strength, u_blur;
  in vec2 v_uv; in vec3 v_w; in float v_d, v_below;
  layout(location = 0) out vec4 o;
  layout(location = 1) out vec4 o_h;
  layout(location = 2) out vec4 o_a;
  void main() {
    vec2 q = gl_FragCoord.xy / u_canvas;
    vec4 hc = textureLod(u_mh, q, 0.0), hb = textureLod(u_mh, q, 5.0);
    vec2 hd = hc.a > 0.5 ? hc.rg / hc.a : hb.rg / max(hb.a, 1e-4);
    float lod = clamp(log2(max(1.0, u_blur * hd.y)), 0.0, 6.0);
    vec2 d = exp2(lod) * 0.5 / u_canvas;
    vec4 c = vec4(0.0);
    for (int i = 0; i < 4; i++) c += textureLod(u_mc, q + d * vec2(i == 0 || i == 3 ? -1.0 : 1.0, i < 2 ? -1.0 : 1.0), lod);
    float k = u_strength * texture(u_tex, v_uv).a * u_alpha;
    o = vec4(c.rgb * 0.25 * k, 0.0); o_h = o; o_a = vec4(0.0);
  }`;
  const INSERT_FS = `
  precision highp float;
  uniform sampler2D u_tex;
  in vec2 v_q, v_px;
  layout(location = 0) out vec4 o;
  layout(location = 1) out vec4 o_h;
  layout(location = 2) out vec4 o_a;
  void main() { o = texture(u_tex, v_q); o_h = o; o_a = vec4(0.0, 0.0, 0.0, o.a); }`;
  // A lit scene's light bounced (light.bounce): what is lit gives back light to what is about it. Its pass (BOUNCE_FS, a
  // BOUNCE_K-th of the canvas each way, its mip levels made): the frame as it is lit — the shadows laid (u_given,
  // u_kept) — where the scene's light falls on something (u_albedo: what it falls on, its colour), and how near that is
  // (1 / its depth: a street far beyond a window gives nothing to the room's wall)
  const LINEAR_D = `float linearD(float z) { z = z * 2.0 - 1.0; return 2.0 * ${NEAR_Z} * ${FAR_Z} / (${FAR_Z} + ${NEAR_Z} - z * (${FAR_Z} - ${NEAR_Z})); }`;
  const SHADED = `vec3 shaded(vec2 uv) { vec3 s = texture(u_scene, uv).rgb; if (u_shaded > 0.0) { vec3 g = texture(u_given, uv).rgb; s = g + (s - g) * texture(u_kept, uv).rgb; } return s; }`;
  const BOUNCE_FS = `
  precision highp float;
  uniform sampler2D u_scene, u_given, u_kept, u_albedo, u_depth;
  uniform float u_shaded;
  in vec2 v_uv;
  layout(location = 0) out vec4 o;
  layout(location = 1) out vec4 o_n;
  ${LINEAR_D}
  ${SHADED}
  void main() {
    float w = step(0.002, texture(u_albedo, v_uv).a) * texture(u_albedo, v_uv).a;
    o = vec4(shaded(v_uv) * w, w);
    o_n = vec4(w / max(linearD(texture(u_depth, v_uv).r), 1.0), 0.0, 0.0, w);
  }`;
  const BOUNCE_VS = `
  in vec2 a_q;
  out vec2 v_uv;
  void main() { v_uv = a_q; gl_Position = vec4(a_q * 2.0 - 1.0, 0.0, 1.0); }`;
  // The grade, over the frame drawn (u_scene): soft-light tint, saturation and brightness, vignette, film grain fresh
  // every frame, a cut's fade to a colour; around the frame the scene goes on, dimming toward the canvas's edges
  const POST_VS = `
  in vec2 a_q;
  void main() { gl_Position = vec4(a_q * 2.0 - 1.0, 0.0, 1.0); }`;
  const POST_FS = `
  precision highp float;
  uniform sampler2D u_scene, u_given, u_kept, u_albedo, u_depth, u_bt, u_bn;
  uniform vec2 u_res, u_from, u_canvas, u_brad;
  uniform vec3 u_tint, u_fadeCol;
  uniform float u_tintA, u_vig, u_grain, u_seed, u_fade, u_bright, u_sat, u_shaded, u_bounce, u_blod;
  ${LINEAR_D}
  ${SHADED}
  // (the light about a point, from what is lit about as far as it is — within half again, fading out by four times
  // nearer or farther; none where nothing lit is)
  vec3 around(vec2 uv, float D) {
    vec4 sum = vec4(0.0);
    float near = 0.0;
    for (int i = 0; i < 4; i++) {
      vec2 p = uv + vec2(cos(float(i) * 1.5708 + 0.7854), sin(float(i) * 1.5708 + 0.7854)) * u_brad * 0.6;
      sum += textureLod(u_bt, p, u_blod); near += textureLod(u_bn, p, u_blod).r;
    }
    float k = sum.a > 1e-3 ? clamp((2.0 - abs(log2(near / sum.a * max(D, 1.0)))) / 1.4, 0.0, 1.0) : 0.0;
    return sum.a > 1e-3 ? sum.rgb / sum.a * k : vec3(0.0);
  }
  out vec4 o;
  float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  vec3 softLight(vec3 b, vec3 s) {
    vec3 d = mix(((16.0 * b - 12.0) * b + 4.0) * b, sqrt(b), step(0.25, b));
    return mix(b - (1.0 - 2.0 * s) * b * (1.0 - b), b + (2.0 * s - 1.0) * (d - b), step(0.5, s));
  }
  void main() {
    vec2 uv = gl_FragCoord.xy / u_canvas;
    vec4 s = texture(u_scene, uv);
    // (the shadows: as much of the light falling here as is kept — what glows, what a mirror gives back, as it is)
    s.rgb = shaded(uv);
    // (the light bounced: what the scene lights is filled as far as what is about it is lighter — a cloth in a lamp's
    // shadow, a wall turned from the sun — that much of its own colour)
    if (u_bounce > 0.0) { vec4 a = texture(u_albedo, uv); if (a.a > 0.002) s.rgb += a.rgb * u_bounce * max(around(uv, linearD(texture(u_depth, uv).r)) - s.rgb, vec3(0.0)); }
    vec2 sp = gl_FragCoord.xy - u_from;
    vec3 c = clamp(s.rgb, 0.0, 1.0);
    c = mix(c, softLight(c, u_tint), u_tintA);
    c = mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, u_sat) * u_bright;
    float r0 = min(u_res.x, u_res.y) * 0.35, r1 = length(u_res) * 0.6;
    c *= 1.0 - u_vig * clamp((length(sp - u_res * 0.5) - r0) / (r1 - r0), 0.0, 1.0);
    vec2 out_ = max(max(-sp, sp - u_res), 0.0);
    c *= 1.0 - 0.45 * smoothstep(0.0, 0.5, length(out_) / u_res.y);
    float n = hash(sp + u_seed);
    vec3 ov = mix(2.0 * c * n, 1.0 - 2.0 * (1.0 - c) * (1.0 - n), step(0.5, c));
    o = vec4(mix(mix(c, ov, u_grain), u_fadeCol, u_fade), 1.0);
  }`;

  // ── geometry ────────────────────────────────────────────────────────────
  // a quad (two triangles over a_q 0…1); a card's — three rows: its top, its foot (v 0.5), its bottom
  const quadOf = rows => {
    const q = [], idx = [];
    rows.forEach(v => q.push(0, v, 1, v));
    for (let i = 0; i + 1 < rows.length; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 3, 2 * i, 2 * i + 3, 2 * i + 2);
    const g = new T3.BufferGeometry();
    g.setAttribute('a_q', new T3.Float32BufferAttribute(q, 2));
    g.setIndex(idx);
    return g;
  };
  const QUAD = quadOf([0, 1]), CARD = quadOf([0, 0.5, 1]);

  // ── colours, small sprites ──────────────────────────────────────────────
  const col = c => (typeof c === 'string' ? (c.startsWith('#') ? I.rgb(c) : c).split(',').map(v => Number(v) / 255) : c);
  const WHITE = [1, 1, 1], DOT = col('255,245,220');
  const ID = [1, 0, 0, 1, 0, 0];
  const mul = I.mul;
  const around = (px, py, r, sx, sy, tx = 0, ty = 0) => {
    const c = Math.cos(r), s = Math.sin(r), a = c * sx, b = s * sx, cc = -s * sy, d = c * sy;
    return [a, b, cc, d, px - a * px - cc * py + tx, py - b * px - d * py + ty];
  };
  const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const intersect = (a, b) => {
    const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y), w = Math.min(a.x + a.w, b.x + b.w) - x, h = Math.min(a.y + a.h, b.y + b.h) - y;
    return w > 0 && h > 0 ? { x, y, w, h } : null;
  };
  const covers = (r, v) => r.x <= v.x + 0.5 && r.y <= v.y + 0.5 && r.x + r.w >= v.x + v.w - 0.5 && r.y + r.h >= v.y + v.h - 0.5;

  function create(canvas) {
    let renderer;
    try {
      renderer = new T3.WebGLRenderer({ canvas, antialias: false, alpha: false, depth: true, stencil: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
    } catch { return null; }
    const gl = renderer.getContext();
    if (!(gl instanceof WebGL2RenderingContext)) { renderer.dispose(); return null; }
    renderer.autoClear = false;
    renderer.sortObjects = true;
    renderer.outputColorSpace = T3.LinearSRGBColorSpace;
    const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    // the frame is drawn into a target and graded into the canvas: in 16-bit floats where the GPU can (light beyond
    // white keeps its colour through the grade), else bytes
    const HDR = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');

    // ── textures ──────────────────────────────────────────────────────────
    // a painting (a canvas) as a texture: premultiplied, its colours as painted, mipmapped (a plane far off, a card
    // seen small, aslant), filtered aslant as much as the GPU can
    function textureOf(canvas, mips = true) {
      const t = new T3.CanvasTexture(canvas);
      t.premultiplyAlpha = true; t.colorSpace = T3.NoColorSpace; t.flipY = false;
      t.generateMipmaps = mips; t.minFilter = mips ? T3.LinearMipmapLinearFilter : T3.LinearFilter; t.magFilter = T3.LinearFilter;
      t.anisotropy = mips ? ANISO : 1;
      t.wrapS = t.wrapT = T3.ClampToEdgeWrapping;
      return t;
    }
    // a canvas painted anew (the same size: the texture uploaded again; another size: a texture of its own) — with its
    // mipmaps, or none (mips false: what is painted every frame, as sharp as it is seen: a chain made anew each frame
    // would cost more than it gives)
    function reupload(holder, canvas, mips = true) {
      const t = holder.tex;
      if (t && t.image === canvas && t.image.width === holder.w && t.image.height === holder.h && holder.mips === mips) { t.needsUpdate = true; return; }
      if (t) t.dispose();
      holder.tex = textureOf(canvas, mips);
      holder.w = canvas.width; holder.h = canvas.height; holder.mips = mips;
    }
    const paint = (w, h, fn) => { const c = I.layer(w, h); fn(c.getContext('2d'), c.width, c.height); return c; };
    const SPRITE = { glow: textureOf(I.glowSprite('255,255,255')) };

    // ── the uniforms all share ────────────────────────────────────────────
    const U = {
      u_reach: { value: 220 }, u_reach0: { value: 220 }, u_fog: { value: new T3.Vector3(0.5, 0.5, 0.5) },
      u_lit: { value: 0 }, u_litk: { value: 0 }, u_amb: { value: new T3.Vector3(1, 1, 1) }, u_amb0: { value: new T3.Vector3(1, 1, 1) }, u_in: { value: 1 },
      u_dn: { value: 0 }, u_n: { value: 0 },
      u_dd: { value: Array.from({ length: FAR }, () => new T3.Vector3()) }, u_dc: { value: Array.from({ length: FAR }, () => new T3.Vector3()) },
      u_lp: { value: Array.from({ length: LIGHTS }, () => new T3.Vector4()) }, u_lc: { value: Array.from({ length: LIGHTS }, () => new T3.Vector3()) },
      u_li: { value: new Float32Array(LIGHTS) },
      u_nw: { value: 0 }, u_wp: { value: Array.from({ length: WINS }, () => new T3.Vector4()) }, u_wa: { value: Array.from({ length: WINS }, () => new T3.Vector4()) },
      u_wb: { value: Array.from({ length: WINS }, () => new T3.Vector4()) }, u_wc: { value: Array.from({ length: WINS }, () => new T3.Vector3()) },
      u_tn: { value: 0 }, u_pn: { value: 0 }, u_td: { value: Array.from({ length: TL }, () => new T3.Vector3()) }, u_tc: { value: Array.from({ length: TL }, () => new T3.Vector3()) },
      u_ts: { value: new Float32Array(TL) }, u_pl: { value: new Int32Array(PANES) }, u_pk: { value: new Int32Array(PANES) },
      u_qo: { value: Array.from({ length: PANES }, () => new T3.Vector3()) }, u_qu: { value: Array.from({ length: PANES }, () => new T3.Vector3()) },
      u_qv: { value: Array.from({ length: PANES }, () => new T3.Vector3()) }, u_qnr: { value: Array.from({ length: PANES }, () => new T3.Vector3()) },
      u_pp: { value: Array.from({ length: PANES * PV }, () => new T3.Vector2()) },
      u_canvas: { value: new T3.Vector2(1, 1) }, u_at: { value: new T3.Vector2() }, u_res: { value: new T3.Vector2(1, 1) },
      u_clip: { value: new T3.Vector4(0, 0, 0, 1) }, u_clip2: { value: new T3.Vector4(0, 0, 0, 1) },
    };
    const premul = { blending: T3.CustomBlending, blendSrc: T3.OneFactor, blendDst: T3.OneMinusSrcAlphaFactor, blendEquation: T3.AddEquation };
    const additive = { blending: T3.CustomBlending, blendSrc: T3.OneFactor, blendDst: T3.OneFactor, blendEquation: T3.AddEquation };
    const raw = (vs, fs, uniforms, opts) => new T3.RawShaderMaterial({ glslVersion: T3.GLSL3, vertexShader: vs, fragmentShader: fs, uniforms: { ...U, ...uniforms }, defines: { ...KINDS }, side: T3.DoubleSide, transparent: true, depthWrite: false, ...opts });
    // (what light the scene has that most have not — a window's, a daylight `of` one; one far off through panes,
    // `through`: LIGHT carries it only then — a program without it uploads none of it)
    let KINDS = {};
    // Materials are shared — one for each way of drawing — and each thing's own uniforms (its texture, where it is)
    // bound to its material just before it is drawn: the values it holds put in, the material told to upload them
    // (hundreds of things — a forest's trees, its stones — are hundreds of draws of a few programs)
    const MATS = new Map();
    const shared = (key, make) => { const k = `${key}|${Object.keys(KINDS)}`; return MATS.get(k) || MATS.set(k, make()).get(k); };
    const bound = (mesh, own) => {
      mesh.onBeforeRender = (r, sc, cam, geom, mat) => { const u = mat.uniforms; for (const k in own) if (u[k]) u[k].value = own[k].value; mat.uniformsNeedUpdate = true; };
      mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.visible = false;
      return mesh;
    };
    // what is drawn by the depth buffer (`depth`): 'solid' — hidden where it stands behind what is drawn already,
    // laying its own where it is nearly opaque (lays); 'over' — laying its own, hidden by none (put before or behind
    // others by the spec: behind, inFront). (Its colour tested a little nearer than it is: what lies on what is drawn
    // already — a stream on the meadow, feet on a floor — is not lost to the two a hair apart.)
    // Every card lays its depth where it is nearly opaque, whatever the order: what is drawn after it and stands behind
    // it is hidden there, and a shadow behind it too.
    const QUAD_OWN = () => ({
      u_tex: { value: null }, u_o: { value: new T3.Vector3() }, u_a: { value: new T3.Vector3() }, u_b: { value: new T3.Vector3() },
      u_uv: { value: new T3.Vector4(0, 0, 1, 1) }, u_gp: { value: new T3.Vector4() }, u_gn: { value: new T3.Vector4(0, 1, 0, 0) }, u_foot: { value: 1 },
      u_alpha: { value: 1 }, u_zp: { value: 0 }, u_way: { value: new T3.Vector4() }, u_inside: { value: 0 }, u_unlit: { value: 0 }, u_pool: { value: 0 },
      u_aux: { value: null }, u_aux_on: { value: 0 }, u_alpha2: { value: -1 }, u_cut: { value: 0 }, u_cutby: { value: null }, u_sheer: { value: 0 },
    });
    const SHADERS = { quad: [QUAD_VS, PAINT_FS, DEPTH_FS], land: [LAND_VS, LAND_FS, LAND_DEPTH_FS], person: [QUAD_VS, PERSON_FS, PERSON_DEPTH_FS] };
    // a draped plane's tile on the land: its plane and its part of it (LAND_VS)
    const LAND_OWN = () => ({ ...QUAD_OWN(), u_rect: { value: new T3.Vector4(0, 0, 1, 1) }, u_pc: { value: new T3.Vector3() }, u_pr: { value: new T3.Vector3() }, u_pu: { value: new T3.Vector3() }, u_ps: { value: new T3.Vector2(1, 1) },
      u_heights: { value: null } });
    const OWN = { quad: QUAD_OWN, land: LAND_OWN, person: QUAD_OWN };
    // a reflecting plane's own: its mirror's textures, how it lays it (mirrorOf), where it lies (for its ripples)
    const MIRROR_OWN = () => ({
      u_mc: { value: null }, u_mh: { value: null }, u_axis: { value: new T3.Vector2(0, 1) }, u_pc: { value: new T3.Vector3() }, u_pr: { value: new T3.Vector3() }, u_pu: { value: new T3.Vector3() },
      u_strength: { value: 0 }, u_fade: { value: 0 }, u_blur: { value: 0 }, u_rough: { value: 0 }, u_ripple: { value: 0 }, u_t: { value: 0 }, u_h: { value: 1 }, u_mpool: { value: 0 },
    });
    function paintMaterial(kind, depth, lay) {
      return shared(`${kind} ${depth} ${lay}`, () => {
        const [vs, fs, dfs] = SHADERS[kind], tested = depth === 'solid';
        // (depth null: by no depth — a reflected copy over the water, laid as it is)
        if (depth == null) return raw(vs, fs, OWN[kind](), { ...premul, depthTest: false });
        return lay ? raw(vs, dfs, OWN[kind](), { colorWrite: false, depthWrite: true, depthTest: true, depthFunc: tested ? T3.LessEqualDepth : T3.AlwaysDepth, blending: T3.NoBlending })
          : raw(vs, fs, OWN[kind](), { ...premul, depthTest: true, depthWrite: kind === 'land', depthFunc: tested ? T3.LessEqualDepth : T3.AlwaysDepth, polygonOffset: tested && kind !== 'land', polygonOffsetFactor: 0, polygonOffsetUnits: -64 });
      });
    }
    // (the land lays its depth as it is drawn: it hides itself — a near bank before the far one, whatever is drawn
    // first — and is opaque; what of a draped painting is not there is not drawn at all. Not drawn nearer than it is:
    // what lies on it level — ice on the street — is drawn over it; the planes draped on it, all of the same mesh, are
    // as deep as each other)
    // a painted thing in the world (a card, a plane's tile, a patch of the land): its meshes — its colour, and the
    // depth it lays (lays) — and its own uniforms
    function paintMeshes(kind, geom, depth, lays, flags) {
      const own = OWN[kind]();
      own.u_inside.value = flags.inside ? 1 : 0; own.u_unlit.value = flags.unlit ? 1 : 0; own.u_sheer.value = flags.sheer || 0;
      const m = bound(new T3.Mesh(geom, paintMaterial(kind, depth, false)), own), d = lays ? bound(new T3.Mesh(geom, paintMaterial(kind, depth, true)), own) : null;
      return { m, d, u: own };
    }

    // ── the camera ────────────────────────────────────────────────────────
    // engine.js's eye (cam: x, z, h — eye heights; yaw; y — the gaze lowered, screen heights: a shifted lens; the
    // horizon yh): a point (X, Y, Z) is seen at x = W/2 + H·x'/z', y = (yh − cam.y)·H + H·(h − Y)/z' (x', z' — turned by
    // the yaw) — the view and projection matrices of that, in the canvas (the frame at OX, OY in it), tipped as a
    // film's camera is (camera_roll: the picture turned about the frame's middle, brought closer to fill it)
    const camera = new T3.Camera();
    camera.matrixAutoUpdate = false; camera.matrixWorldAutoUpdate = false;
    const NEAR = Number(NEAR_Z), FAR_D = Number(FAR_Z);
    function aim(cam, S) {
      const c = Math.cos(cam.yaw || 0), s = Math.sin(cam.yaw || 0), h = cam.h ?? 1, { W, H, OX, OY, CW, CH } = S;
      // (the eye's frame in the world: right, up, back — the view looks along −back; the world's axes are a mirror
      // of three.js's own, X right, Y up, Z ahead: set here, not by three.js, which would take the mirror out)
      camera.matrixWorld.set(c, 0, -s, cam.x, 0, 1, 0, h, -s, 0, -c, cam.z, 0, 0, 0, 1);
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      const cx = OX + W / 2, cy = OY + (S.yh - cam.y) * H, A = -(FAR_D + NEAR) / (FAR_D - NEAR), B = -2 * FAR_D * NEAR / (FAR_D - NEAR);
      const P = new T3.Matrix4().set(2 * H / CW, 0, 1 - 2 * cx / CW, 0, 0, 2 * H / CH, 2 * cy / CH - 1, 0, 0, 0, A, B, 0, 0, -1, 0);
      // (tipped: frame px as drawn → as seen, m, in clip space — x_c, y_c, w: frame px × w = a·x_c + b·w)
      const rl = I.rollOf(cam.roll, W, H, CW, CH);
      if (rl) {
        const [m0, m1, m2, m3, e, f] = rl.m, a1 = CW / 2, b1 = CW / 2 - OX, a2 = -CH / 2, b2 = CH / 2 - OY;
        P.premultiply(new T3.Matrix4().set(m0, m2 * a2 / a1, 0, (m0 * b1 + m2 * b2 + e - b1) / a1, m1 * a1 / a2, m3, 0, (m1 * b1 + m3 * b2 + f - b2) / a2, 0, 0, 1, 0, 0, 0, 0, 1));
      }
      camera.projectionMatrix.copy(P);
      camera.projectionMatrixInverse.copy(P).invert();
      frustum.setFromProjectionMatrix(new T3.Matrix4().multiplyMatrices(P, camera.matrixWorldInverse));
    }
    const frustum = new T3.Frustum();

    // ── the scene's things ────────────────────────────────────────────────
    const scene = new T3.Scene();
    scene.matrixWorldAutoUpdate = false;
    // (a painting no larger a side than a texture can be here: 8192, less where the GPU takes less — a phone's 4096)
    const MAX_SIDE = Math.min(8192, renderer.capabilities.maxTextureSize), PLANE_TEX = 2048, LEVEL = 1.5;
    const levelFor = s => (s <= 1.05 ? 0 : Math.min(7, Math.ceil(Math.log(s) / Math.log(LEVEL) - 1e-6)));
    // (a scale in steps of LEVEL, up from it: as sharp as it is seen, or a little sharper)
    const stepUp = s => Math.pow(LEVEL, Math.ceil(Math.log(Math.max(s, 1e-3)) / Math.log(LEVEL) - 1e-6));
    // A painting as it is first painted: as the start sees it (a stage px a canvas px), but no more than BASE_PX px
    // (a cliff close by, a wall: its close-ups paint what is seen of it as sharp as it is seen); a part of one (a tree
    // of a forest, a stone) no more than PART_PX
    const BASE_PX = 4e6, PART_PX = 2.5e5;
    const firstScale = (r, most) => Math.min(1, MAX_SIDE / r.w, MAX_SIDE / r.h, Math.sqrt(most / (r.w * r.h)));
    // The paintings are painted for a stage PH px tall: as tall as the frame is on the screen (not as the frame is
    // drawn — the resolution the frame rate allows changes nothing painted), in steps of √2: a window resized a little
    // repaints nothing
    const paintHeight = H => Math.round(2 ** (Math.round(Math.log2(Math.max(64, H)) * 2) / 2));

    // Paints an element's region (bx, by, bw, bh — px of the stage) into a canvas at scale k (canvas px a stage
    // px). Its light rects and cones are painted in; its glows are sprites (they flicker). And the parts it paints
    // (e.part), each to be painted on its own. With `whole` (its box) while the scene is checked: painted with a
    // margin, looked at there for paint cut off by its box, the margin cleared. → { canvas, lights, parts, region, cut }
    const CUT_MARGIN = 2, EDGES = ['left', 'top', 'right'];
    const checked = o => I.CHECK.on && (o.kind === 'custom' || !o.kind) && !o.sky && !o.ground && !o.plane && !o.insert;
    function paintObject(S, o, bx, by, bw, bh, k, t = 0, into = null, whole = null) {
      if (whole && checked(o)) k = Math.min(k, (MAX_SIDE - 2 * CUT_MARGIN) / bw, (MAX_SIDE - 2 * CUT_MARGIN) / bh);
      const m = whole && checked(o) ? CUT_MARGIN / k : 0;
      if (m) { bx -= m; by -= m; bw += 2 * m; bh += 2 * m; }
      const lights = [], parts = [];
      const draw = g => {
        g.setTransform(k, 0, 0, k, -bx * k, -by * k);
        I.drawObject(g, o, o._sw || S.SW, S.PH, t, lights, parts);
        if (o.insert) I.iris(g, o, S.SW, S.PH, I.opening(o), lights);
        for (const l of lights) {
          if (l.rect) { g.fillStyle = `rgba(${l.col},${Math.min(1, l.a * 2.2)})`; g.fillRect(...l.rect); }
          if (l.cone) {
            const gr = g.createLinearGradient(0, l.y, 0, l.cone.y);
            gr.addColorStop(0, `rgba(${l.col},${l.a * 0.35})`); gr.addColorStop(1, `rgba(${l.col},0)`);
            g.fillStyle = gr; g.globalCompositeOperation = 'lighter';
            g.beginPath(); g.moveTo(l.x - l.dot, l.y); g.lineTo(l.x + l.dot, l.y); g.lineTo(l.x + l.cone.w, l.cone.y); g.lineTo(l.x - l.cone.w, l.cone.y); g.fill();
            g.globalCompositeOperation = 'source-over';
          }
        }
      };
      // (no side past MAX_SIDE, whatever the region and its margin come to)
      if (Math.round(Math.max(bw, bh) * k) > MAX_SIDE) k = MAX_SIDE / Math.max(bw, bh);
      const w = Math.min(MAX_SIDE, Math.max(1, Math.round(bw * k))), h = Math.min(MAX_SIDE, Math.max(1, Math.round(bh * k)));
      const canvas = into || I.layer(w, h);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const g = canvas.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
      draw(g);
      const region = { x: bx, y: by, w: bw, h: bh };
      return { canvas, lights, parts, region, cut: m ? cutOf(canvas, region, whole, m) : null };
    }
    // the canvas painted over region r with a margin m round the part to be seen: the edges of it that are its box's
    // and are painted past → [left, top, right] or null; the margin cleared (the picture as unchecked)
    function cutOf(canvas, r, whole, m) {
      const g = canvas.getContext('2d'), w = canvas.width, h = canvas.height, M = Math.round(m * w / r.w);
      const hit = (x, y, sw, sh) => { const d = g.getImageData(x, y, sw, sh).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return n >= 3; };
      const at = [Math.abs(r.x + m - whole.x) < 1, Math.abs(r.y + m - whole.y) < 1, Math.abs(r.x + r.w - m - whole.x - whole.w) < 1];
      const cut = w > 2 * M + 8 && h > 2 * M + 8 ? [at[0] && hit(0, M, 1, h - 2 * M), at[1] && hit(M, 0, w - 2 * M, 1), at[2] && hit(w - 1, M, 1, h - 2 * M)] : [];
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, M, h); g.clearRect(w - M, 0, M, h); g.clearRect(0, 0, w, M); g.clearRect(0, h - M, w, M);
      return cut.some(Boolean) ? cut : null;
    }
    const lightsOf = (list, o) => list.map(l => ({ x: l.x, y: l.y, r: l.r, c: col(l.col), a: l.a, dot: l.dot, flicker: l.flicker, id: l.id, fire: o?.kind === 'campfire' }));

    // A live element (engine.js READS): one whose code read the time is repainted every frame; one that read only the
    // state (or the light on it), when a key it read changes — or when it is seen at a scale its painting would blur.
    // `redraw`: only the keys it names, whatever else it reads.
    const timedOf = (o, frames) => o.redraw == null && (frames > 1 || !!I.READS.get(o)?.time);
    const liveOf = (o, frames) => {
      const read = I.READS.get(o) || {}, timed = timedOf(o, frames);
      return timed || read.state || read.lights || o.redraw != null ? { canvas: I.layer(1, 1), holder: {}, stateOnly: !timed, frames, lights: [] } : null;
    };
    // (the pixels a repaint takes: what is on screen is painted only where it is seen, as sharp as it is seen — no more
    // than the frame's px, 1.3 of them; those painted every frame (timed), all of them together no more than LIVE_FRAME
    // frames' px: each of them less sharp alike when they ask more — by what they asked the frame before, S.liveK)
    const LIVE_AWAY = 0.05, LIVE_FRAME = 1.5;
    const liveScale = (S, r, seen, timed = false) => {
      const k = Math.min(seen, MAX_SIDE / r.w, MAX_SIDE / r.h, Math.sqrt(1.3 * S.CW * S.CH / (r.w * r.h)));
      if (!timed) return k;
      S.liveAsk += r.w * r.h * k * k;
      return k * S.liveK;
    };
    // painted at another state (or light), at a scale it would blur at, or not over all of `need`
    function stale(ob, k, need, frameNo) {
      const live = ob.live, f = live.k ? k / live.k : 0, sharp = f > 0.83 && f < 1.2 && live.r && covers(live.r, need);
      if (live.frame === frameNo && sharp) return false;
      if (!live.stateOnly) return true;
      if (!sharp) return true;
      if (ob.o.redraw != null) return live.snap !== I.redrawOf(ob.o);
      if (live.ver !== I.STATE.ver) { if (I.moved(live.read)) return true; live.ver = I.STATE.ver; }
      return live.readsLights && live.src !== I.SOURCES.ver;
    }
    function repaint(S, ob, k, t, r, seen = true) {
      const whole = { x: ob.bx, y: ob.by, w: ob.bw, h: ob.bh }, look = seen && !(t - ob.cutAt < 1) && r.w * k >= 16 && r.h * k >= 16 && checked(ob.o);
      const t0 = I.PERF.on ? I.clock() : 0;
      const p = paintObject(S, ob.o, r.x, r.y, r.w, r.h, k, t, ob.live.canvas, look ? whole : null);
      if (look) { ob.cutAt = t; ob.cut = p.cut; }
      const live = ob.live;
      live.r = p.region; live.box = boxOf(ob); live.frame = S.frameNo;
      if (p.parts.length || ob.parts) { ob.parts ||= []; paintParts(S, ob, p.parts); }
      reupload(live.holder, p.canvas, live.stateOnly);
      if (I.PERF.on) I.PERF.add(ob.o, I.clock() - t0, true);
      live.ver = I.STATE.ver; live.k = k; live.src = I.SOURCES.ver; live.snap = I.redrawOf(ob.o); live.read = I.READS.get(ob.o);
      live.stateOnly = !timedOf(ob.o, live.frames); live.readsLights = !!live.read?.lights;
      I.PERF.repainted(ob.o);
      live.lights = lightsOf(p.lights, ob.o);
    }

    // ── build: what the scene has, made once ──────────────────────────────
    // W × H: the frame; out = { x, y, cw, ch }: where it starts in the canvas, and the canvas (px)
    function build(spec, W, H, prev, out) {
      // (the frame's height on the screen, in device px up to 1.5 a CSS px — whatever resolution it is drawn at now)
      const PH = paintHeight(H * out.css[1] / Math.max(1, out.ch) * Math.min(1.5, out.dpr)), same = prev && prev.spec === spec && prev.PH === PH;
      const S = same ? prev : { spec, PH, SW: I.STAGE * PH, things: [], textures: new Set() };
      if (prev && !same) drop(prev);
      Object.assign(S, { W, H, OX: out.x, OY: out.y, CW: out.cw, CH: out.ch, out });
      renderer.setPixelRatio(1);
      renderer.setSize(S.CW, S.CH, false);
      S.target?.depthTexture?.dispose(); S.target?.dispose(); S.mask?.dispose(); S.kept?.dispose();
      // (a scene with shadows: beside the frame the light in it no shadow darkens, and what each pixel keeps of the light
      // falling there — the shadows laid)
      const shadowed = I.shadowsOf(spec).length > 0, light = spec.light && typeof spec.light === 'object' ? spec.light : {};
      const lit = light.ambient != null || Object.values(light.looks || {}).some(l => l?.ambient != null);
      S.target = new T3.WebGLRenderTarget(S.CW, S.CH, { count: lit ? 3 : shadowed ? 2 : 1, type: HDR ? T3.HalfFloatType : T3.UnsignedByteType, depthBuffer: true, stencilBuffer: false, depthTexture: new T3.DepthTexture(S.CW, S.CH, T3.UnsignedIntType), minFilter: T3.LinearFilter, magFilter: T3.LinearFilter, generateMipmaps: false });
      S.mask = shadowed ? new T3.WebGLRenderTarget(S.CW, S.CH, { depthBuffer: false, stencilBuffer: false, generateMipmaps: false }) : null;
      S.kept = shadowed ? new T3.WebGLRenderTarget(S.CW, S.CH, { depthBuffer: false, stencilBuffer: false, generateMipmaps: false }) : null;
      S.lim = I.limits(spec, W, H);
      const lights = Array.isArray(spec.lights) ? spec.lights : [];
      KINDS = { ...(lights.some(l => l?.daylight && l.of != null) && { WINDOWS: '' }), ...(lights.some(l => l?.through != null) && { THROUGH: '' }) };
      if (same) return S;
      const dz = I.depths(spec), ROUND = I.camSetup(spec).round;
      Object.assign(S, { dz, yh: dz.yh, round: ROUND, frameNo: 0, rules: I.orderRules(spec), byId: new Map(), shadowed: I.shadowsOf(spec).length > 0, mirrorPlanes: [], pools: (spec.objects || []).some(o => o.plane && o.lit) });
      S.reach0 = typeof spec.light?.haze === 'number' ? I.hazeReach(spec.light.haze) : 220;
      for (const o0 of spec.objects || []) {
        const ob = o0.insert ? insertOf(S, o0) : o0.plane ? planeOf(S, o0) : o0.sky ? skyOf(S, o0) : cardOf(S, o0);
        if (!ob) continue;
        S.things.push(ob);
        if (o0.id != null) S.byId.set(o0.id, ob);
      }
      const ids = new Set(S.things.filter(ob => !ob.insert).map(ob => ob.o.id).filter(id => id != null));
      for (const ob of S.things) if (!ob.insert) ob.clip = I.clipOf(ob.spec, ids);
      // (what others are cut by is laid, if unseen, all the same — hidden, drawn into their masks)
      S.cutters = new Set(S.things.flatMap(ob => ob.clip?.ids || []).map(String));
      for (const ob of S.things) if (ob.unseen && ob.kind === 'card' && S.cutters.has(String(ob.o.id))) meshesOf(S, ob, CARD);
      S.mirrorPlanes = S.things.filter(ob => ob.kind === 'plane' && ob.plane.mirror && !ob.unseen).map(ob => ob.plane);
      S.shadows = I.shadowsOf(spec).map(sh => ({ ...sh, ob: S.byId.get(sh.id), onto: sh.onto.map(id => (id === 'ground' ? id : S.byId.get(id))) })).filter(sh => sh.ob && sh.onto.every(Boolean));
      return S;
    }
    function drop(S) {
      for (const ob of S.things) dropThing(ob);
      for (const tx of S.textures) tx.dispose();
      S.target?.depthTexture?.dispose(); S.target?.dispose(); S.mask?.dispose(); S.kept?.dispose(); S.bounce?.dispose();
      for (const M of S.cutMasks?.values() || []) M.dispose();
      S.land?.atlas.dispose();
      for (const sh of S.shadows || []) for (const G of sh.grids?.values() || []) if (G.mesh) { shadowScene.remove(G.mesh); G.mesh.geometry.dispose(); }
      scene.clear();
      glows = [];
    }
    function dropThing(ob) {
      for (const x of [ob.mesh, ob.depthMesh, ob.copy?.m]) if (x) { scene.remove(x); if (ob.kind === 'sky' || ob.kind === 'insert') x.material.dispose(); }
      for (const h of [ob.live?.holder, ob.base, ...(ob.detail ? [ob.detail] : [])]) h?.tex?.dispose();
      for (const p of ob.parts || []) dropThing(p);
      if (ob.tiles) for (const T of ob.tiles.values()) dropTile(T);
      for (const q of ob.meshes?.values() || []) for (const x of [q.m, q.d, q.mirror]) if (x) scene.remove(x);
      for (const R of [ob.mirrorT, ...(ob.seenT?.values() || [])]) R?.dispose();
    }
    // the region a thing's painting covers (its box), and its painting at build: { holder, region }
    function painted(S, ob, k) {
      const r0 = paintObject(S, ob.o, ob.bx, ob.by, ob.bw, ob.bh, k, 0, null, { x: ob.bx, y: ob.by, w: ob.bw, h: ob.bh });
      ob.base = {}; reupload(ob.base, r0.canvas); ob.baseRegion = r0.region; ob.baseBox = boxOf(ob); ob.cut = r0.cut;
      ob.lights = lightsOf(r0.lights, ob.o);
      return r0;
    }
    // a card: an element standing in the scene (or a part of one)
    function cardOf(S, o0) {
      const n = S.dz.now(o0), o = { ...n.o };
      const ob = { kind: 'card', o, spec: o0, unseen: !!o0.unseen, from: S.dz.moves(o0) ? o0 : null, glass: I.glassOf(o0),
        person: o0.person && I.PEOPLE.has(String(o0.id)) ? { person: I.PEOPLE.get(String(o0.id)), frame: -1, shown: null } : null };
      place(S, ob, n);
      const r0 = painted(S, ob, firstScale({ w: ob.bw, h: ob.bh }, BASE_PX));
      // (what its code read as it was painted: ob.o, as placed)
      ob.live = (o.kind === 'custom' || !o.kind) ? liveOf(ob.o, o.frames) : null;
      if (r0.parts.length) { ob.parts = []; paintParts(S, ob, r0.parts); }
      // (a pane of glass shows only what it mirrors: not its painting)
      if (ob.glass && !ob.unseen) {
        ob.u = Object.assign(QUAD_OWN(), MIRROR_OWN());
        ob.mesh = bound(new T3.Mesh(CARD, shared('glass', () => raw(QUAD_VS, GLASS_FS, { ...QUAD_OWN(), ...MIRROR_OWN() }, { blending: T3.CustomBlending, blendSrc: T3.OneMinusDstColorFactor, blendDst: T3.OneFactor, depthTest: true, depthFunc: T3.LessEqualDepth, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -64 }))), ob.u);
        scene.add(ob.mesh);
      } else if (ob.person && !ob.unseen) {
        const q = paintMeshes('person', CARD, 'solid', true, { inside: !!ob.spec.inside, unlit: false });
        ob.mesh = q.m; ob.depthMesh = q.d; ob.u = q.u;
        scene.add(q.m); scene.add(q.d);
      } else if (!ob.unseen) meshesOf(S, ob, CARD);
      if (o0.reflect && !ob.unseen && ob.mesh && !ob.person) {
        const q = paintMeshes('quad', CARD, null, false, { inside: !!o0.inside, unlit: !!o0.glows });
        ob.copy = q; scene.add(q.m);
      }
      return ob;
    }
    // where a card is now (n: depths().now of it): its anchor on the stage, its box, where it stands in the world, its turn
    function place(S, ob, n) {
      const o = { ...n.o, _sw: ob.o?._sw };
      Object.assign(ob, { o, Z: n.Z, at: n.at, x: o.x * S.SW, y: o.y * S.PH, s: Math.max(2, o.size * S.PH), turn: !o.sky ? I.turnOf(o) : null }, I.objectBox(o, S.SW, S.PH));
    }
    function meshesOf(S, ob, geom) {
      const ruled = (S.ruled ??= new Set(S.rules.flat().map(String))).has(String(ob.o.id));
      const q = paintMeshes('quad', geom, ruled ? 'over' : 'solid', true, { inside: !!ob.spec.inside, unlit: !!ob.o.glows, sheer: I.translucentOf(ob.spec) });
      ob.mesh = q.m; ob.depthMesh = q.d; ob.u = q.u;
      scene.add(q.m); if (q.d) scene.add(q.d);
    }
    // a plane: its painting (PLANE_TEX px on its long side; a live one 1024), laid by tiles finer where it is seen
    // closer (planeTiles' scheme: level L 2^L times finer than the whole); a draped one is the land — a mesh of it,
    // in patches as its tiles are
    function planeOf(S, o0) {
      const plane = I.planeOf(o0, S.dz), E = I.EYE, w = plane.w * E, d = plane.d * E;
      const o = { ...o0, sky: true, plane: true, _plane: plane };
      const k = PLANE_TEX / (Math.max(w, d) * S.PH), bx = -w / 2 * S.PH, by = -d / 2 * S.PH, bw = w * S.PH, bh = d * S.PH;
      const ob = { kind: 'plane', o, spec: o0, plane, Z: plane.far, bx, by, bw, bh, k, unseen: !!o0.unseen, tiles: new Map(), meshes: new Map() };
      if (!plane.travel) { const r0 = paintObject(S, o, bx, by, bw, bh, k, 0); ob.base = {}; reupload(ob.base, r0.canvas); ob.lights = lightsOf(r0.lights, o); }
      else ob.lights = [];
      ob.live = liveOf(o, 0);
      if (plane.drape) {
        // (how low and high the land under it goes: what a patch of it is looked for in view by)
        const world = I.onPlane(plane), N = 48;
        let lo = Infinity, hi = -Infinity;
        for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const y = world(i / N, j / N)[1]; lo = Math.min(lo, y); hi = Math.max(hi, y); }
        ob.landLow = lo - 0.5; ob.landHigh = hi + 0.5;
      }
      return ob;
    }
    // a sky element: its painting round the eye — ahead as wide as the widest frame, looking around the full circle
    function skyOf(S, o0) {
      const n = S.dz.now(o0), o = { ...n.o, _sw: S.round ? I.TAU * S.PH : S.SW };
      const box = S.round ? { bx: 0, by: -0.35 * S.PH, bw: I.TAU * S.PH, bh: 1.6 * S.PH } : I.objectBox(o, S.SW, S.PH);
      const ob = { kind: 'sky', o, spec: o0, Z: Infinity, ...box, unseen: !!o0.unseen };
      painted(S, ob, Math.min(1, MAX_SIDE / ob.bw, MAX_SIDE / ob.bh));
      ob.live = (o.kind === 'custom' || !o.kind) ? liveOf(o, o.frames) : null;
      if (!ob.unseen) {
        ob.u = { u_tex: { value: null }, u_r: { value: new T3.Vector4() }, u_look: { value: 0 }, u_pan: { value: 0 }, u_wrap: { value: 0 }, u_round: { value: S.round ? 1 : 0 }, u_yaw: { value: 0 }, u_alpha: { value: 1 }, u_rect: { value: new T3.Vector4() }, u_flip: { value: 0 }, u_hz: { value: 0 }, u_unproj: { value: new T3.Matrix4() }, u_eye: { value: new T3.Vector3() } };
        ob.mesh = new T3.Mesh(QUAD, raw(FRAME_VS, SKY_FS, ob.u, { ...premul, depthTest: false }));
        ob.mesh.frustumCulled = false;
        scene.add(ob.mesh);
      }
      return ob;
    }
    // an insert: a shot of its own over the scene, fixed to the frame — repainted while open as the state changes
    // (the iris its key opens), and every frame if it reads the time
    function insertOf(S, o0) {
      const o = { ...o0, _yh: S.dz.yh }, ob = { kind: 'insert', insert: true, o, spec: o0, ...I.objectBox(o, S.SW, S.PH), frames: [], period: o.period || 2 };
      ob.live = { canvas: I.layer(1, 1), holder: {}, stateOnly: true, frames: 0, lights: [] };
      ob.u = { u_tex: { value: null }, u_rect: { value: new T3.Vector4() } };
      ob.mesh = new T3.Mesh(QUAD, raw(FRAME_VS, INSERT_FS, ob.u, { ...premul, depthTest: false }));
      ob.mesh.frustumCulled = false; ob.mesh.visible = false;
      scene.add(ob.mesh);
      return ob;
    }

    // ── parts (e.part) ────────────────────────────────────────────────────
    // A part stands at its own depth, in a texture of its own, a card among the rest. Painted when their element is.
    function paintParts(S, ob, recs) {
      const list = ob.parts;
      for (const gone of list.splice(recs.length)) dropThing(gone);
      recs.forEach((rec, i) => {
        const part = list[i] ||= { kind: 'part', owner: ob, o: ob.o, spec: ob.spec, canvas: I.layer(1, 1), holder: {}, lights: [] };
        part.rec = rec;
        placePart(S, part);
        const r = { x: part.bx, y: part.by, w: part.bw, h: part.bh };
        paintPart(S, part, r, firstScale(r, PART_PX), part.canvas);
        part.detail?.tex.dispose(); part.detail = null;
        reupload(part.holder, part.canvas);
        part.region = r; part.box0 = boxOf(part);
        if (!part.mesh && !ob.unseen) meshesOf(S, part, CARD);
      });
    }
    function placePart(S, part) {
      const n = S.dz.part(part.owner.spec, part.rec.dx, part.rec.dz, part.rec.box), o = n.o;
      Object.assign(part, { o, Z: n.Z, at: n.at, x: o.x * S.SW, y: o.y * S.PH, s: Math.max(2, o.size * S.PH), turn: I.turnOf(o) }, I.objectBox(o, S.SW, S.PH));
    }
    function paintPart(S, part, r, k, c) {
      const w = Math.max(1, Math.round(r.w * k)), h = Math.max(1, Math.round(r.h * k));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      const g = c.getContext('2d'), lights = [], [ax, ay, ppm] = I.anchorOf(part.o, S.SW, S.PH);
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
      g.setTransform(k, 0, 0, k, -r.x * k, -r.y * k);
      part.rec.paint(g, ax, ay, ppm, lights);
      part.lights = lightsOf(lights, null);
      return c;
    }

    // ── a card in the world ───────────────────────────────────────────────
    // The painting's px (x, y) on the stage → the world: from its anchor A (where it stands, Zp: the distance it is
    // painted for, k = Zp/PH eye heights a px) along its right R and up U — upright facing the start; turned its own
    // way (turnOf: axesOf); facing the eye (billboard: looking around, a film's camera turned ahead) across the gaze.
    // m: what moves the painting on the stage before (sway, bob, a platformer's hero)
    const UP = [0, 1, 0], RIGHT = [1, 0, 0];
    function cardFrame(S, ob, cam) {
      const A = ob.at, billboard = !ob.turn && (S.round || (cam.pan && !ob.o.sky));
      const { r, u } = ob.turn ? I.axesOf(ob.turn) : { r: billboard ? [Math.cos(cam.yaw || 0), 0, -Math.sin(cam.yaw || 0)] : RIGHT, u: UP };
      return { A, R: r, U: u, k: A.Zp / S.PH };
    }
    const worldAt = (F, ob, m, px, py) => {
      const [x, y] = m === ID ? [px, py] : apply(m, px, py), a = (x - ob.x) * F.k, b = (y - ob.y) * F.k;
      return [F.A.X + F.R[0] * a - F.U[0] * b, F.A.Y + F.R[1] * a - F.U[1] * b, F.A.Z + F.R[2] * a - F.U[2] * b];
    };
    // lays a card's quad: its painting's region r of its box, at alpha a
    function layCard(S, ob, cam, tex, r, m, a) {
      const F = cardFrame(S, ob, cam), u = ob.u, o0 = worldAt(F, ob, m, r.x, r.y), o1 = worldAt(F, ob, m, r.x + r.w, r.y), o2 = worldAt(F, ob, m, r.x, r.y + r.h);
      u.u_tex.value = tex; u.u_alpha.value = a;
      u.u_o.value.set(...o0); u.u_a.value.set(o1[0] - o0[0], o1[1] - o0[1], o1[2] - o0[2]); u.u_b.value.set(o2[0] - o0[0], o2[1] - o0[1], o2[2] - o0[2]);
      u.u_uv.value.set(0, 0, 1, 1);
      u.u_zp.value = ob.o.sky ? 0 : ob.at.Zp;
      const n = ob.turn ? I.axesOf(ob.turn).n : null;
      u.u_way.value.set(...(n || [0, 0, 0]), n ? 1 : 0);
      // (standing on the ground — not raised off it, its painting not turned on the stage — what it paints below its
      // foot lies on the ground toward the eye: as deep as the ground there; raised, all of it as deep as it stands)
      const at = ob.o._at, foot = (ob.y - r.y) / r.h, raised = at && at.elevation - at.ground > 0.01;
      if (!raised && !ob.turn && m[1] === 0 && m[2] === 0 && foot > 0 && foot < 1 && r.y + r.h > ob.y + 0.5) {
        const G = [ob.at.X, ob.at.Y, ob.at.Z], nG = I.groundNormal(G[0], G[2]);
        u.u_foot.value = foot; u.u_gp.value.set(...G, 1); u.u_gn.value.set(...nG, 0);
      } else { u.u_foot.value = 0.5; u.u_gp.value.set(0, 0, 0, 0); }
      // (where it lies in the world: what a mirror's pass is drawn by — what it does not see, not drawn)
      const box = ob.box ||= new T3.Box3();
      box.makeEmpty();
      for (const q of [o0, o1, o2]) box.expandByPoint(v3a.set(...q));
      box.expandByPoint(v3a.set(o1[0] + o2[0] - o0[0], o1[1] + o2[1] - o0[1], o1[2] + o2[2] - o0[2]));
      if (u.u_gp.value.w) box.expandByPoint(v3a.set(u.u_gp.value.x, u.u_gp.value.y, u.u_gp.value.z));
      for (const x of [ob.mesh, ob.depthMesh]) if (x) x.userData.box = box;
      return F;
    }
    // what of a card is seen from the camera, and how finely: { scale — the most frame px a painted px comes to in
    // view, v — the region of its box seen (a cell of a grid over it round what is in view) }, or null: none of it
    const SEEN_GRID = 6;
    function cardSeen(S, ob, cam, m = ID) {
      const F = cardFrame(S, ob, cam), G = ob.turn ? SEEN_GRID : 1, dx = ob.bw / G, dy = ob.bh / G, at = [];
      for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) at.push(I.project(cam, ...worldAt(F, ob, m, ob.bx + dx * i, ob.by + dy * j), S.W, S.H, S.yh));
      let scale = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, D = Infinity;
      const VX0 = -S.OX, VY0 = -S.OY, VX1 = S.CW - S.OX, VY1 = S.CH - S.OY;
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
        const q = [at[j * (G + 1) + i], at[j * (G + 1) + i + 1], at[(j + 1) * (G + 1) + i + 1], at[(j + 1) * (G + 1) + i]];
        if (!q.every(Boolean)) continue;
        const xs = q.map(p => p[0]), ys = q.map(p => p[1]);
        if (Math.max(...xs) < VX0 || Math.min(...xs) > VX1 || Math.max(...ys) < VY0 || Math.min(...ys) > VY1) continue;
        scale = Math.max(scale, Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) / dx, Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]) / dy);
        // (a card facing the eye — upright on the frame — the part of it in the frame; one turned, the cells of it there)
        let [u0, u1, v0, v1] = [0, 1, 0, 1];
        if (G === 1 && Math.abs(q[1][1] - q[0][1]) < 1e-6 && Math.abs(q[3][0] - q[0][0]) < 1e-6) {
          const sx = q[1][0] - q[0][0], sy = q[3][1] - q[0][1], cut = (a, b) => [Math.max(0, Math.min(a, b)), Math.min(1, Math.max(a, b))];
          if (sx) [u0, u1] = cut((VX0 - q[0][0]) / sx, (VX1 - q[0][0]) / sx);
          if (sy) [v0, v1] = cut((VY0 - q[0][1]) / sy, (VY1 - q[0][1]) / sy);
        }
        x0 = Math.min(x0, ob.bx + dx * (i + u0)); x1 = Math.max(x1, ob.bx + dx * (i + u1)); y0 = Math.min(y0, ob.by + dy * (j + v0)); y1 = Math.max(y1, ob.by + dy * (j + v1));
        for (const p of q) D = Math.min(D, p[2]);
      }
      return scale > 0 ? { scale, v: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, D } : null;
    }
    // the texture a card is shown with now and the region of its box it holds: its live painting (repainted when
    // due), else its painting — the sharp close-up when that covers what is seen of it
    function shownTexture(S, ob, seen, t) {
      const whole = { x: ob.bx, y: ob.by, w: ob.bw, h: ob.bh };
      if (ob.live) {
        const view = seen?.v, sv = view ? intersect(whole, view) : null;
        if (sv) {
          // (close up only what is on screen is painted, as sharp as it is seen — in steps, with a margin: a small
          // move of the camera does not repaint it)
          const mg = ob.live.stateOnly ? 0.15 : 0.05;
          const r = intersect(whole, { x: sv.x - sv.w * mg, y: sv.y - sv.h * mg, w: sv.w * (1 + 2 * mg), h: sv.h * (1 + 2 * mg) });
          const timed = !ob.live.stateOnly, k = liveScale(S, r, Math.max(LIVE_AWAY, timed ? seen.scale : stepUp(seen.scale)), timed);
          if (stale(ob, k, sv, S.frameNo)) repaint(S, ob, k, t, r);
        } else {
          const k = Math.min(LIVE_AWAY, liveScale(S, whole, 1));
          if (stale(ob, k, whole, S.frameNo)) repaint(S, ob, k, t, whole, false);
        }
        return { tex: ob.live.holder.tex, r: here(ob, ob.live.r, ob.live.box), lights: lightsHere(ob, ob.live.lights, ob.live.box) };
      }
      const det = ob.detail, dr = det && here(ob, det.region, det.box), on = det && seen && intersect(whole, seen.v);
      if (det && seen && (!on || covers(dr, on))) return { tex: det.tex, r: dr, lights: ob.lights };
      return { tex: ob.base.tex, r: here(ob, ob.baseRegion, ob.baseBox), lights: ob.lights };
    }
    // A painting's region as it lies now: painted while its box was \`box\`, laid over its box where it is now — what
    // moves (its place, what carries it) takes its painting along; and its lights with it
    const boxOf = ob => ({ x: ob.bx, y: ob.by, w: ob.bw, h: ob.bh });
    function here(ob, r, box) {
      if (!box || (box.x === ob.bx && box.y === ob.by && box.w === ob.bw)) return r;
      const k = ob.bw / box.w;
      return { x: ob.bx + (r.x - box.x) * k, y: ob.by + (r.y - box.y) * k, w: r.w * k, h: r.h * k };
    }
    function lightsHere(ob, lights, box) {
      if (!box || (box.x === ob.bx && box.y === ob.by && box.w === ob.bw)) return lights;
      const k = ob.bw / box.w;
      return lights.map(l => ({ ...l, x: ob.bx + (l.x - box.x) * k, y: ob.by + (l.y - box.y) * k, r: l.r * k, dot: l.dot && l.dot * k }));
    }
    // A person as they are seen now: drawn in 3D (people.js) into a texture of theirs, once a frame, as sharp as they are
    // seen — the part of their card on screen (and round it), in the card's own px, so it is laid as any card's painting
    // is; how they face and how far each point of them is beside it. (A scene that lays no light itself: its sources at
    // their chest, strongest first, and the planes casting their shadows between — and the light all round them.)
    function personTexture(S, ob, cam, seen, t) {
      const P = ob.person;
      if (P.frame === S.frameNo) return P.shown;
      const F = cardFrame(S, ob, cam), a = I.project(cam, ob.at.X, ob.at.Y, ob.at.Z, S.W, S.H, S.yh);
      const whole = { x: ob.bx, y: ob.by, w: ob.bw, h: ob.bh }, sv = a && intersect(whole, seen.v);
      if (!sv) return shownTexture(S, ob, null, t);
      // (the card on the frame: its painting's px → the frame's, as the card lies across the gaze)
      const s = S.H / a[2] * F.k, m = [s, 0, 0, s, a[0] - s * ob.x, a[1] - s * ob.y];
      const r = intersect(whole, { x: sv.x - sv.w * 0.02, y: sv.y - sv.h * 0.02, w: sv.w * 1.04, h: sv.h * 1.04 });
      const chest = !S.lit && P.person.point('chest'), look = S.look;
      const planesOf = l => S.shadows.filter(sh => sh.ob?.kind === 'plane' && !sh.ob.unseen && (sh.light == null || sh.light === l.id)).map(({ ob: { plane: q }, strength }) => ({
        c: [q.Xc, q.Y, q.Zc].map(v => v * I.EYE), a: q.ax.r.map(v => v * q.w / 2 * I.EYE), b: q.ax.u.map(v => v * q.d / 2 * I.EYE), k: strength }));
      const sources = chest && I.lightsAt(chest.map(c => c / I.EYE), !!ob.spec.inside).slice(0, 2).map(l => ({ dir: [l.x, -l.y, -l.z], col: col(l.color).map(c => c * l.strength),
        at: l.distance == null ? null : chest.map((c, i) => c + [l.x, -l.y, -l.z][i] * l.distance), planes: planesOf(l) }));
      const ambient = chest && (look.ambientColor || [255, 255, 255]).map(c => c / 255 * look.people);
      const k = liveScale(S, r, s, true);
      const d = MooodPeople.draw(gl, P.person, { m, r, k, cam, W: S.W, H: S.H, yh: S.yh, at: ob.o._at, lit: !!S.lit, dpr: S.CW / Math.max(1, S.out.css[0]), sources, ambient, paint: S.PH });
      // (people.js draws with the context itself: three.js told its state is not what it kept)
      renderer.resetState();
      if (P.glTex !== d.tex) { P.tex?.dispose(); P.tex = new T3.ExternalTexture(d.tex); P.glTex = d.tex; }
      if (P.glAux !== d.aux) { P.aux?.dispose(); P.aux = d.aux ? new T3.ExternalTexture(d.aux) : null; P.glAux = d.aux; }
      P.frame = S.frameNo;
      return (P.shown = { tex: P.tex, aux: P.aux, r: d.r, lights: [] });
    }
    // a part's: its painting, or its close-up where that covers what is seen of it
    function partTexture(ob, seen) {
      const r = here(ob, ob.region, ob.box0), det = ob.detail, dr = det && here(ob, det.region, det.box), on = seen && intersect(r, seen.v);
      return det && seen && (!on || covers(dr, on)) ? { tex: det.tex, r: dr, lights: lightsHere(ob, ob.lights, ob.box0) } : { tex: ob.holder.tex, r, lights: lightsHere(ob, ob.lights, ob.box0) };
    }
    // Close-ups: a card seen finer than painted is painted again at the level it is seen at, only what of it is on
    // screen (with a margin) — a few a frame, nearest first
    const DETAIL_BUDGET = 3e6;
    // ... those that show most wrong first: as much of the screen as they cover, by how much sharper than now they are seen
    function refineCards(S, cam, whole) {
      let budget = whole ? Infinity : DETAIL_BUDGET;
      const asked = [];
      for (const ob of S.order) {
        if (ob.kind !== 'card' && ob.kind !== 'part') continue;
        if (ob.live || ob.unseen || !ob.seen) continue;
        const k = Math.pow(LEVEL, levelFor(ob.seen.scale));
        if (k <= 1) { if (ob.detail) { ob.detail.tex.dispose(); ob.detail = null; } continue; }
        const box = { x: ob.bx, y: ob.by, w: ob.bw, h: ob.bh }, need = intersect(box, ob.seen.v);
        if (!need || (ob.detail && ob.detail.k >= k && covers(ob.detail.region, need))) continue;
        asked.push({ ob, k, wrong: need.w * need.h * ob.seen.scale ** 2 * (1 - (ob.detail && covers(ob.detail.region, need) ? ob.detail.k : 1) / k) });
      }
      for (const { ob, k } of asked.sort((a, b) => b.wrong - a.wrong)) {
        if (whole && performance.now() > S.deadline) return;
        const box = { x: ob.bx, y: ob.by, w: ob.bw, h: ob.bh };
        const v = ob.seen.v, r = intersect(box, { x: v.x - v.w * 0.15, y: v.y - v.h * 0.15, w: v.w * 1.3, h: v.h * 1.3 });
        const kk = Math.min(k, MAX_SIDE / r.w, MAX_SIDE / r.h), cost = r.w * r.h * kk * kk;
        if (cost > budget && budget < DETAIL_BUDGET) return;
        budget -= cost;
        const canvas = ob.kind === 'part' ? paintPart(S, ob, r, kk, I.layer(1, 1)) : paintObject(S, ob.o, r.x, r.y, r.w, r.h, kk, 0).canvas;
        ob.detail?.tex.dispose();
        ob.detail = { tex: textureOf(canvas), k, region: r, box: boxOf(ob) };
      }
    }

    // ── planes ────────────────────────────────────────────────────────────
    // A plane's tiles (engine.js planeTile: level L, i, j — its part f0…f1, g0…g1 of the painting), the ones seen:
    // the whole while it is seen no finer than painted; each part finer as the eye comes near it — by how near it is
    // in the world, and only those in view (the frustum). A travelling plane (planeShift) is shown by tiles of level 1
    // and finer only, where its painting lies on it now.
    const PLANE_LEVELS = 8, TILES_PER_FRAME = 4, MAX_TILES = 96;
    const baseOf = ob => (ob.live ? Math.min(ob.k, 1024 / Math.max(ob.bw, ob.bh)) : ob.k) * Math.max(ob.bw, ob.bh);
    const tileKey = (L, i, j) => `${L}:${i}:${j}`;
    const box3 = new T3.Box3(), v3a = new T3.Vector3(), v3b = new T3.Vector3();
    function tilesSeen(S, ob, views) {
      const P = ob.plane, world = I.onPlane(P), base = baseOf(ob), long = Math.max(P.w, P.d), [sf, sg] = I.planeShift(P), out = [];
      const on = t => { const f0 = Math.max(0, t.f0 - sf), g0 = Math.max(0, t.g0 - sg), f1 = Math.min(1, t.f1 - sf), g1 = Math.min(1, t.g1 - sg); return f1 > f0 && g1 > g0 ? [f0, g0, f1, g1] : null; };
      // (its box in the world, and how near the nearest view that sees it comes — the land's as high and low as it
      // rises there)
      const near = at => {
        const [f0, g0, f1, g1] = at;
        box3.makeEmpty();
        for (const [f, g] of [[f0, g0], [f1, g0], [f1, g1], [f0, g1]]) box3.expandByPoint(v3a.set(...world(f, g)));
        if (P.drape) { box3.min.y = Math.min(box3.min.y, ob.landLow); box3.max.y = Math.max(box3.max.y, ob.landHigh); }
        return Math.min(...views.map(v => nearIn(v, box3)));
      };
      const visit = t => {
        const at = on(t), z = at ? near(at) : Infinity;
        if (z === Infinity) return;
        if ((t.L || !P.travel) && (t.L >= PLANE_LEVELS || S.H / Math.max(z, 0.06) <= 1.3 * base * 2 ** t.L / long * (S.H / S.PH))) { out.push({ ...t, at, z }); return; }
        if (t.L) { for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) visit(I.planeTile(P, base, t.L + 1, 2 * t.i + a, 2 * t.j + b)); return; }
        const s = I.planeTile(P, base, 1, 1, 1);
        for (let i = Math.floor(sf / s.f0); i * s.f0 < 1 + sf; i++) for (let j = Math.floor(sg / s.g0); j * s.g0 < 1 + sg; j++) visit(I.planeTile(P, base, 1, i, j));
      };
      visit({ L: 0, i: 0, j: 0, f0: sf, g0: sg, f1: 1 + sf, g1: 1 + sg });
      return out;
    }
    function paintTile(S, ob, t) {
      const k = (ob.live ? Math.min(ob.k, 1024 / Math.max(ob.bw, ob.bh)) : ob.k) * 2 ** t.L, pad = 1 / k;
      const r = { x: ob.bx + t.f0 * ob.bw - pad, y: ob.by + t.g0 * ob.bh - pad, w: (t.f1 - t.f0) * ob.bw + 2 * pad, h: (t.g1 - t.g0) * ob.bh + 2 * pad };
      const T = { tex: textureOf(paintObject(S, ob.o, r.x, r.y, r.w, r.h, k, 0).canvas), used: S.frameNo, f0: (r.x - ob.bx) / ob.bw, g0: (r.y - ob.by) / ob.bh, f1: (r.x + r.w - ob.bx) / ob.bw, g1: (r.y + r.h - ob.by) / ob.bh };
      ob.tiles.set(tileKey(t.L, t.i, t.j), T);
      return T;
    }
    const dropTile = T => T.tex.dispose();
    // the tile a part of the plane is drawn from: its own if painted, else the finest over it, else the whole
    function tileFor(S, ob, t) {
      for (let L = t.L, i = t.i, j = t.j; L > 0; L--, i >>= 1, j >>= 1) {
        const T = ob.tiles.get(tileKey(L, i, j)) || (L === 1 && ob.plane.travel ? paintTile(S, ob, I.planeTile(ob.plane, baseOf(ob), L, i, j)) : null);
        if (T) { T.used = S.frameNo; return T; }
      }
      const tex = ob.live ? ob.live.holder.tex : ob.base?.tex;
      return tex ? { tex, f0: 0, g0: 0, f1: 1, g1: 1 } : null;
    }
    // each frame: the missing tiles of what is seen — and of the views ahead (where the camera is heading, scene.prepare)
    // — painted, those that show most wrong on the screen first (as big there as it is, over how far — drawn till then by
    // a coarser one: the coarser of them first), a few a frame (all of the frame's for a view made whole, till its
    // deadline); the least recently used past MAX_TILES let go
    function refinePlanes(S, ahead, whole) {
      const todo = new Map();
      for (const views of [null, ...(whole ? [] : ahead)]) for (const ob of S.things) {
        // (one repainted every frame has no tiles: they would be of a moment gone)
        if (ob.kind !== 'plane' || ob.unseen || !ob.seenTiles || (ob.live && !ob.live.stateOnly)) continue;
        const long = Math.max(ob.plane.w, ob.plane.d);
        for (const t of views ? tilesSeen(S, ob, views) : ob.seenTiles) for (let L = t.L, i = t.i, j = t.j; L > 0; L--, i >>= 1, j >>= 1) {
          const key = tileKey(L, i, j), T = ob.tiles.get(key);
          if (T) { T.used = S.frameNo; break; }
          const id = `${ob.o.id}|${key}`, wrong = (views ? 0.5 : 1) * (long / 2 ** L / Math.max(t.z ?? 1, 0.06)) ** 2;
          if (!(todo.get(id)?.wrong >= wrong)) todo.set(id, { ob, t: I.planeTile(ob.plane, baseOf(ob), L, i, j), wrong });
        }
      }
      let budget = whole ? Infinity : TILES_PER_FRAME;
      for (const { ob, t } of [...todo.values()].sort((a, b) => b.wrong - a.wrong)) {
        if (budget-- <= 0 || (whole && performance.now() > S.deadline)) break;
        if (!ob.tiles.has(tileKey(t.L, t.i, t.j))) paintTile(S, ob, t);
      }
      const all = S.things.flatMap(ob => (ob.tiles ? [...ob.tiles].map(([key, T]) => ({ ob, key, T })) : []));
      if (all.length > MAX_TILES) {
        all.sort((a, b) => a.T.used - b.T.used);
        for (const { ob, key, T } of all.slice(0, all.length - MAX_TILES)) { if (T.used === S.frameNo) break; dropTile(T); ob.tiles.delete(key); }
      }
    }
    // the meshes a plane is drawn by now: one a tile seen (kept by the tile's place, made when first needed)
    function tileMesh(S, ob, key, at) {
      let q = ob.meshes.get(key);
      if (!q) {
        q = paintMeshes('quad', QUAD, ob.ruled ? 'over' : 'solid', true, { inside: !!ob.spec.inside, unlit: !!ob.o.glows, sheer: I.translucentOf(ob.spec) });
        if (ob.plane.mirror) {
          // (its mirror: the tile's own, and the mirror's, over its painting)
          q.mu = Object.assign(q.u, MIRROR_OWN());
          q.mirror = bound(new T3.Mesh(QUAD, shared('mirror', () => raw(QUAD_VS, MIRROR_FS, { ...QUAD_OWN(), ...MIRROR_OWN() }, { ...premul, depthTest: true, depthFunc: T3.LessEqualDepth, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -64 }))), q.u);
          scene.add(q.mirror);
        }
        scene.add(q.m); if (q.d) scene.add(q.d);
        ob.meshes.set(key, q);
      }
      q.used = S.layNo;
      return q;
    }
    function layPlane(S, ob, cam, t, order) {
      const P = ob.plane, world = I.onPlane(P), [sf, sg] = I.planeShift(P);
      // (a live plane — its code reads the time or the state: repainted whole when due, its tiles let go with the old)
      if (ob.live && !P.travel) {
        const whole = { x: ob.bx, y: ob.by, w: ob.bw, h: ob.bh }, k = Math.min(ob.k, 1024 / Math.max(ob.bw, ob.bh));
        if (stale(ob, k, whole, S.frameNo)) { repaint(S, ob, k, t, whole); for (const T of ob.tiles.values()) dropTile(T); ob.tiles.clear(); }
      }
      let tiles = ob.seenTiles = tilesSeen(S, ob, S.views);
      // (out of view: laid whole all the same, hidden — a mirror may see it: the floor behind the eye in a pane)
      const away = !tiles.length && !P.travel;
      // (repainted every frame — its code reads the time: whole, no tiles of a moment gone; a draped one by its patches,
      // each from the whole)
      if (away || (ob.live && !ob.live.stateOnly && !P.drape)) tiles = [{ L: 0, i: 0, j: 0, f0: 0, g0: 0, f1: 1, g1: 1, at: [0, 0, 1, 1] }];
      ob.ruled ??= (S.ruled ??= new Set(S.rules.flat().map(String))).has(String(ob.o.id));
      const n = P.ax.n;
      for (const t of tiles) {
        const T = tileFor(S, ob, t);
        if (!T) continue;
        // (where this tile's painting lies in the texture it is drawn from: its own, or the part of a coarser one)
        const [a0, b0, a1, b1] = t.at, fw = (f1, f0) => f1 - f0, A = [(a0 + sf - T.f0) / fw(T.f1, T.f0), (b0 + sg - T.g0) / fw(T.g1, T.g0), (a1 + sf - T.f0) / fw(T.f1, T.f0), (b1 + sg - T.g0) / fw(T.g1, T.g0)];
        if (P.drape) { layDrape(S, ob, t, T, A, order, away); continue; }
        const key = tileKey(t.L, t.i, t.j), q = tileMesh(S, ob, key, t.at), u = q.u;
        u.u_tex.value = T.tex; u.u_uv.value.set(...A); u.u_alpha.value = 1; u.u_zp.value = 0;
        // (a pool on a mirror is laid over the mirror: the mirror's own)
        u.u_pool.value = q.mirror ? 0 : P.pool * (1 - S.lit); if (q.mu) q.mu.u_mpool.value = P.pool * (1 - S.lit);
        const c0 = world(a0, b0), c1 = world(a1, b0), c2 = world(a0, b1);
        const box = q.box ||= new T3.Box3();
        box.makeEmpty();
        for (const c of [c0, c1, c2, world(a1, b1)]) box.expandByPoint(v3a.set(...c));
        for (const x of [q.m, q.d]) if (x) x.userData.box = box;
        u.u_o.value.set(...c0); u.u_a.value.set(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]); u.u_b.value.set(c2[0] - c0[0], c2[1] - c0[1], c2[2] - c0[2]);
        u.u_way.value.set(n[0], n[1], n[2], 1); u.u_gp.value.w = 0;
        q.m.renderOrder = order; if (q.d) q.d.renderOrder = order + 0.5;
        if (away) { q.m.visible = false; S.offView.push(q.m); if (q.d) { q.d.visible = false; S.offView.push(q.d); } continue; }
        q.m.visible = true; if (q.d) q.d.visible = true;
        if (q.mirror) { q.mirror.visible = !!ob.mirrored; q.mirror.renderOrder = order + 0.25; }
      }
      // (the tiles not seen now: hidden; their meshes let go after a while)
      for (const [key, q] of ob.meshes) if (q.used !== S.layNo) {
        for (const x of [q.m, q.d, q.mirror]) if (x) x.visible = false;
        if (S.layNo - q.used > 120) { for (const x of [q.m, q.d, q.mirror]) if (x) scene.remove(x); ob.meshes.delete(key); }
      }
      if (ob.mirrored) mirrorUniforms(S, ob, cam);
    }
    // ── mirrors ──────────────────────────────────────────────────────────
    // Each reflecting plane in view (`reflect`, level or tilted): what is before its face drawn from the eye mirrored
    // in its plane — the same scene, cut at the plane (u_clip) — into the plane's mirror target at half the canvas's
    // size (the colour, how high above the plane; mip levels for the blur), before the frame: laid on the plane as its
    // tiles are drawn (MIRROR_FS). Not itself, nor what is fixed to the frame (inserts); the sky seen below the horizon.
    const mirrorMatrix = new T3.Matrix4(), mirrorView = new T3.Matrix4();
    // what mirrors the scene now — the reflecting planes, the panes of glass — each by its plane through Q, its face n
    // toward the eye
    function mirrorsOf(S, cam) {
      const eye = [cam.x, cam.h ?? 1, cam.z], out = [];
      for (const ob of S.things) {
        if (ob.kind === 'plane' && !ob.unseen && ob.plane.mirror && !ob.plane.drape) {
          const P = ob.plane, Q = [P.Xc, P.Y, P.Zc];
          out.push({ ob, Q, n: facingEye(P.ax.n, Q, eye) });
        } else if (ob.glass && ob.mesh) {
          // a pane of glass: its plane — turned its own way as it is turned; looking around, across the line to it; else
          // across the gaze
          const G = ob.at, Q = [G.X, G.Y, G.Z], raw0 = ob.turn ? I.axesOf(ob.turn).n : S.round ? [G.X - cam.x, 0, G.Z - cam.z] : [0, 0, 1];
          const len = Math.hypot(...raw0);
          if (len < 1e-6) continue;
          const n = facingEye(raw0.map(v => v / len), Q, eye);
          if ((eye[0] - Q[0]) * n[0] + (eye[1] - Q[1]) * n[1] + (eye[2] - Q[2]) * n[2] >= 0.02) out.push({ ob, Q, n, glass: true });
        }
      }
      return out;
    }
    // the world in a plane's mirror (through Q, facing n): the matrix that mirrors it
    function mirrorIn(Q, n) {
      const d = -(n[0] * Q[0] + n[1] * Q[1] + n[2] * Q[2]);
      return mirrorMatrix.set(1 - 2 * n[0] * n[0], -2 * n[0] * n[1], -2 * n[0] * n[2], -2 * d * n[0], -2 * n[1] * n[0], 1 - 2 * n[1] * n[1], -2 * n[1] * n[2], -2 * d * n[1], -2 * n[2] * n[0], -2 * n[2] * n[1], 1 - 2 * n[2] * n[2], -2 * d * n[2], 0, 0, 0, 1);
    }
    // The views the world is seen in now: the eye's, and the eye's mirrored in each mirror in view — only what is
    // before its face, and only through the mirror (the part of the frame it covers). What any of them sees is laid
    // (a plane's tiles, the land's patches), each as fine as the nearest of them sees it.
    const toClip = new T3.Matrix4(), squeeze = new T3.Matrix4();
    function viewsOf(S, cam) {
      const eye = [cam.x, cam.h ?? 1, cam.z], views = [{ frustum, eye }];
      toClip.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      for (const { ob, Q, n } of S.mirrors) {
        let corners;
        if (ob.kind === 'plane') { const world = I.onPlane(ob.plane); corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([f, g]) => world(f, g)); }
        else { const F = cardFrame(S, ob, cam); corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([i, j]) => worldAt(F, ob, ID, ob.bx + ob.bw * i, ob.by + ob.bh * j)); }
        const r = onFrame(corners);
        if (!r) continue;
        // (the projection squeezed to the mirror's rectangle of the frame: what it maps there fills the clip space)
        const [x0, y0, x1, y1] = r, sx = 2 / (x1 - x0), sy = 2 / (y1 - y0);
        squeeze.set(sx, 0, 0, -sx * (x0 + x1) / 2, 0, sy, 0, -sy * (y0 + y1) / 2, 0, 0, 1, 0, 0, 0, 0, 1).multiply(camera.projectionMatrix);
        const M = mirrorIn(Q, n), f = new T3.Frustum().setFromProjectionMatrix(squeeze.multiply(mirrorView.multiplyMatrices(camera.matrixWorldInverse, M)));
        const e = v3a.set(...eye).applyMatrix4(M);
        views.push({ ob, rect: r, frustum: f, eye: [e.x, e.y, e.z], face: [...n, -(n[0] * Q[0] + n[1] * Q[1] + n[2] * Q[2])], squeeze: squeeze.clone().multiply(new T3.Matrix4().copy(camera.projectionMatrix).invert()), M: M.clone() });
      }
      // (and a mirror seen in another — from the eye mirrored in that one, then in it: what that pass draws, mirrors)
      for (const A of views.slice(1)) {
        if (A.ob.kind !== 'plane') continue;
        for (const { ob, Q, n } of S.mirrors) {
          if (ob === A.ob || ob.kind !== 'plane') continue;
          const world = I.onPlane(ob.plane);
          box3.makeEmpty();
          for (const [f, g] of [[0, 0], [1, 0], [1, 1], [0, 1]]) box3.expandByPoint(v3a.set(...world(f, g)));
          if (nearIn(A, box3) === Infinity) continue;
          // (its face toward the eye mirrored in that one: what is before it there is what it mirrors)
          const nb = facingEye(n, Q, A.eye), MB = mirrorIn(Q, nb).clone(), E = v3a.set(...A.eye).applyMatrix4(MB).toArray();
          const f = new T3.Frustum().setFromProjectionMatrix(new T3.Matrix4().multiplyMatrices(A.squeeze, camera.projectionMatrix).multiply(mirrorView.multiplyMatrices(camera.matrixWorldInverse, A.M).multiply(MB)));
          views.push({ pair: [A.ob, ob], frustum: f, eye: E, face: [...nb, -(nb[0] * Q[0] + nb[1] * Q[1] + nb[2] * Q[2])] });
        }
      }
      return views;
    }
    // where a polygon of the world lies on the frame: its rectangle in clip space (x0, y0, x1, y1, within −1…1) — the
    // part of it before the eye — or null: none of it is seen
    const clipPt = new T3.Vector4();
    function onFrame(corners) {
      const q = corners.map(c => clipPt.set(c[0], c[1], c[2], 1).applyMatrix4(toClip).toArray());
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const add = p => { x0 = Math.min(x0, p[0] / p[3]); x1 = Math.max(x1, p[0] / p[3]); y0 = Math.min(y0, p[1] / p[3]); y1 = Math.max(y1, p[1] / p[3]); };
      // (its edges cut where they pass behind the eye: w as small as the near plane's)
      const W0 = 1e-3;
      q.forEach((a, i) => {
        const b = q[(i + 1) % q.length];
        if (a[3] > W0) add(a);
        if ((a[3] > W0) !== (b[3] > W0)) { const t = (W0 - a[3]) / (b[3] - a[3]); add(a.map((v, k) => v + (b[k] - v) * t)); }
      });
      x0 = Math.max(x0, -1); y0 = Math.max(y0, -1); x1 = Math.min(x1, 1); y1 = Math.min(y1, 1);
      return x1 > x0 && y1 > y0 ? [x0, y0, x1, y1] : null;
    }
    // how near a view sees a box (Infinity: it does not — out of its frustum, or behind its mirror)
    const corner = new T3.Vector3();
    function nearIn(v, box) {
      if (!v.frustum.intersectsBox(box)) return Infinity;
      // (the box's corner farthest before the mirror's face: behind it, the box is too)
      const n = v.face;
      if (n && n[0] * (n[0] > 0 ? box.max.x : box.min.x) + n[1] * (n[1] > 0 ? box.max.y : box.min.y) + n[2] * (n[2] > 0 ? box.max.z : box.min.z) + n[3] <= 0) return Infinity;
      return box.distanceToPoint(corner.set(...v.eye));
    }
    function mirrors(S, cam) {
      for (const ob of S.things) ob.mirrored = null;
      const planes = S.mirrors.filter(M => !M.glass && M.ob.seenTiles?.length), eye = [cam.x, cam.h ?? 1, cam.z], own = ob => [...ob.meshes.values()].flatMap(q => [q.m, q.d, q.mirror]);
      // A mirror seen in another (B in A: a floor's in a wall's): what it mirrors as that one shows it — drawn from the eye
      // mirrored in A, then in B, once a pair (no deeper)
      const seenIn = new Map();
      for (const A of planes) {
        const view = S.views.find(v => v.ob === A.ob);
        if (!view) continue;
        const MA = mirrorIn(A.Q, A.n).clone(), E = v3a.set(...eye).applyMatrix4(MA).toArray();
        for (const B of planes) {
          if (B === A) continue;
          const world = I.onPlane(B.ob.plane);
          box3.makeEmpty();
          for (const [f, g] of [[0, 0], [1, 0], [1, 1], [0, 1]]) box3.expandByPoint(v3a.set(...world(f, g)));
          if (nearIn(view, box3) === Infinity) continue;
          const R = (B.ob.seenT ||= new Map()).get(A.ob) || B.ob.seenT.set(A.ob, mirrorTarget(S)).get(A.ob);
          const view0 = camera.matrixWorldInverse.clone(), world0 = camera.matrixWorld.clone();
          camera.matrixWorldInverse.multiply(MA); camera.matrixWorld.copy(camera.matrixWorldInverse).invert();
          reflected(S, B.ob, B.Q, facingEye(B.ob.plane.ax.n, B.Q, E), [...own(B.ob), ...own(A.ob)], false, { R, nested: A });
          camera.matrixWorldInverse.copy(view0); camera.matrixWorld.copy(world0);
          (seenIn.get(A.ob) || seenIn.set(A.ob, new Map()).get(A.ob)).set(B.ob, R);
        }
      }
      for (const { ob, Q, n, glass } of S.mirrors) {
        if (!glass && ob.seenTiles?.length) {
          const R = reflected(S, ob, Q, n, own(ob), false, { seenIn: seenIn.get(ob) });
          // (the way across the frame its face points where it is seen: what a rough mirror is stretched along)
          const a = I.project(cam, ...Q, S.W, S.H, S.yh), b = I.project(cam, Q[0] + 0.1 * n[0], Q[1] + 0.1 * n[1], Q[2] + 0.1 * n[2], S.W, S.H, S.yh), len = a && b && Math.hypot(b[0] - a[0], b[1] - a[1]);
          ob.mirrored = { R, axis: len > 1e-6 ? [(b[0] - a[0]) / len, (a[1] - b[1]) / len] : [0, 1] };
          for (const q of ob.meshes.values()) if (q.used === S.layNo && q.mirror) q.mirror.visible = true;
        } else if (glass && ob.mesh.visible) {
          ob.mirrored = { R: reflected(S, ob, Q, n, [ob.mesh], true) };
        }
      }
    }
    // a plane's normal toward the eye (what is on the eye's side of it is mirrored in it)
    const facingEye = (n, Q, eye) => ((eye[0] - Q[0]) * n[0] + (eye[1] - Q[1]) * n[1] + (eye[2] - Q[2]) * n[2] < 0 ? n.map(v => -v) : n);
    // The scene drawn from the eye mirrored in the plane through Q facing n (toward the eye) into ob's mirror target:
    // all but `hide` (its own meshes), what is fixed to the frame and other mirrors — a pane of glass (glass) also not
    // the sky, the land, nor other panes: it shows the room before it
    const MIRROR_OVER = 0.01;
    function reflected(S, ob, Q, n, hide, glass, { R = ob.mirrorT ??= mirrorTarget(S), nested = null, seenIn = null } = {}) {
      const d = -(n[0] * Q[0] + n[1] * Q[1] + n[2] * Q[2]);
      if (R.width !== S.CW || R.height !== S.CH) R.setSize(S.CW, S.CH);
      // (the eye mirrored: the view of the world reflected in the plane)
      const view = camera.matrixWorldInverse.clone(), world = camera.matrixWorld.clone();
      camera.matrixWorldInverse.copy(mirrorView.multiplyMatrices(view, mirrorIn(Q, n)));
      camera.matrixWorld.copy(camera.matrixWorldInverse).invert();
      // (what is before its face — higher than it by a hair at least: not what lies level with it, the street the ice
      // lies on, a rug on a polished floor)
      U.u_clip.value.set(n[0], n[1], n[2], d - MIRROR_OVER);
      // (seen in another mirror: only what is before that one too)
      if (nested) U.u_clip2.value.set(...nested.n, -(nested.n[0] * nested.Q[0] + nested.n[1] * nested.Q[1] + nested.n[2] * nested.Q[2]));
      const out = new Set(hide);
      // (what lays a mirror or glass on what is drawn is not drawn into one: it has no height to say)
      for (const o2 of S.things) {
        if (o2.insert || o2.glass || o2.clip) out.add(o2.mesh);
        if (o2.clip) for (const part of o2.parts || []) out.add(part.mesh);
        for (const q of o2.meshes?.values() || []) out.add(q.mirror);
        if ((glass && o2.kind === 'sky') || (glass && o2.plane?.drape)) { out.add(o2.mesh); for (const q of o2.meshes?.values() || []) { out.add(q.m); out.add(q.d); } }
      }
      // (a mirror seen in it: what it mirrors as this one shows it — laid on it here, its own after)
      const bound = [];
      for (const [o2, R2] of seenIn || []) for (const q of o2.meshes.values()) if (q.mirror && q.used === S.layNo) {
        out.delete(q.mirror); bound.push([q, q.mirror.visible, q.mu.u_mc.value, q.mu.u_mh.value]);
        q.mirror.visible = true; q.mu.u_mc.value = R2.textures[0]; q.mu.u_mh.value = R2.textures[1];
      }
      const hidden = [];
      for (const x of out) if (x?.visible) { x.visible = false; hidden.push(x); }
      for (const x of S.offView) if (!out.has(x)) { x.visible = true; hidden.push([x]); }
      // (what the mirror does not see — out of the part of the frame it covers, behind it — not drawn)
      const sees = !nested && S.views.find(v => v.ob === ob);
      if (sees) for (const x of scene.children) if (x.visible && x.userData.box && nearIn(sees, x.userData.box) === Infinity) { x.visible = false; hidden.push(x); }
      // (the sky: as the eye mirrored sees it — its gaze turned as the mirror turns it)
      const unproj = new T3.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert(), eyeM = v3a.setFromMatrixPosition(camera.matrixWorld).clone();
      const f = v3b.set(0, 0, -1).transformDirection(camera.matrixWorld), yawM = Math.atan2(f.x, f.z), sky = [];
      for (const o2 of S.things) if (o2.kind === 'sky' && o2.u) {
        const u = o2.u;
        sky.push([u, u.u_yaw.value, u.u_pan.value]);
        u.u_flip.value = 1; u.u_unproj.value.copy(unproj); u.u_eye.value.copy(eyeM); u.u_yaw.value = yawM; u.u_pan.value = yawM * S.H;
      }
      renderer.setRenderTarget(R);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, false);
      // (only the part of the frame it covers — and round it as far as a rough or rippled one reads aside — drawn)
      if (sees) {
        const M = ob.plane?.mirror, m = 0.05 + 2 * (M ? M.rough * 0.6 + M.ripple * 0.02 : 0.02) * S.H / S.CH, mx = m * S.CH / S.CW, [x0, y0, x1, y1] = sees.rect;
        const px = v => Math.max(0, Math.min(1, (v + 1) / 2)), X0 = px(x0 - mx) * R.width, Y0 = px(y0 - m) * R.height;
        renderer.setScissor(X0, Y0, px(x1 + mx) * R.width - X0, px(y1 + m) * R.height - Y0);
        renderer.setScissorTest(true);
      }
      renderer.render(scene, camera);
      renderer.setScissorTest(false);
      for (const x of hidden) if (Array.isArray(x)) x[0].visible = false; else x.visible = true;
      for (const [q, was, mc, mh] of bound) { q.mirror.visible = was; q.mu.u_mc.value = mc; q.mu.u_mh.value = mh; }
      for (const [u, yaw, pan] of sky) { u.u_flip.value = 0; u.u_yaw.value = yaw; u.u_pan.value = pan; }
      U.u_clip.value.set(0, 0, 0, 1); U.u_clip2.value.set(0, 0, 0, 1);
      camera.matrixWorldInverse.copy(view); camera.matrixWorld.copy(world);
      return R;
    }
    // a mirror's target: its colour and how high above the plane each point is (16-bit floats), mip levels made
    function mirrorTarget(S) {
      const R = new T3.WebGLRenderTarget(S.CW, S.CH, { count: 2, depthBuffer: true, generateMipmaps: true, minFilter: T3.LinearMipmapLinearFilter, magFilter: T3.LinearFilter, type: T3.UnsignedByteType });
      R.textures[1].type = T3.HalfFloatType;
      return R;
    }
    // the mirror laid on the plane's tiles: their meshes' own (the same for them all)
    function mirrorUniforms(S, ob, cam) {
      const P = ob.plane, M = P.mirror, R = ob.mirrored.R;
      for (const q of ob.meshes.values()) {
        if (!q.mirror) continue;
        const u = q.mu;
        u.u_mc.value = R.textures[0]; u.u_mh.value = R.textures[1];
        u.u_strength.value = M.strength; u.u_fade.value = M.fade; u.u_blur.value = M.blur; u.u_rough.value = M.rough; u.u_ripple.value = M.ripple;
        u.u_t.value = S.t; u.u_h.value = S.H; u.u_axis.value.set(...ob.mirrored.axis);
        u.u_pc.value.set(P.Xc, P.Y, P.Zc); u.u_pr.value.set(...P.ax.r); u.u_pu.value.set(...P.ax.u);
      }
    }

    // ── the land ──────────────────────────────────────────────────────────
    // The land (chunked LOD): the relief under the planes draped over it, a quadtree of square nodes over all of them.
    // Each node's heights are worked out once (the relief's code, LAND_N + 1 points a side) into an atlas the GPU reads
    // them from — with how far the relief strays from the node's grid between its points (its error) — the coarse ones
    // first, a few a frame; one not yet there is drawn from the finest of its own that is. Each frame the nodes are
    // chosen as any of the views sees them: a node is split while its error is more than LAND_ERR of how far it is, or
    // its cells more than LAND_SEEN of it (a bank, a crest, a riverbed get nodes as fine as they need; a plain, as it
    // is seen) — nowhere finer than LAND_FINEST — and none more than a level coarser than one beside it (balanced). Each
    // drawn as one grid of LAND_N cells, its edge beside a coarser one laid on that one's line: no crack. Every draped plane is laid on
    // the same nodes, the same points (LAND_VS): the later over the earlier, as deep as each other. What is sheer — a
    // cliff's face, the relief jumping — the land does not draw (LAND_FS): a card for the cliff's face stands there.
    const LAND_SEEN = 0.04, LAND_ERR = 0.002, LAND_FINEST = 0.06, ATLAS = SLOTS * LAND_TS, BAKE_MS = 4, LAND_MORPH = 0.4, LAND_KEEP = 1.5;
    // a grid of LAND_N cells (its points a_g: 0…LAND_N), two triangles a cell
    const GRID = (() => {
      const n = LAND_N, g = [], idx = [];
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) g.push(i, j);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i; idx.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2); }
      const geom = new T3.BufferGeometry();
      geom.setAttribute('a_g', new T3.Float32BufferAttribute(g, 2));
      geom.setIndex(idx);
      return geom;
    })();
    // The land of a scene: its square over the draped planes, its levels, its nodes' heights (the atlas: a slot each,
    // the least recently used let go when it is full — never the root)
    function landOf(S) {
      if (S.land) return S.land;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const ob of S.things) if (ob.kind === 'plane' && ob.plane.drape) {
        const P = ob.plane;
        for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const q = P.on(u * P.w / 2, v * P.d / 2); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[2]); z1 = Math.max(z1, q[2]); }
      }
      const side = Math.max(x1 - x0, z1 - z0) * 1.001 + 1e-3;
      const atlas = new T3.DataTexture(new Float32Array(ATLAS * ATLAS), ATLAS, ATLAS, T3.RedFormat, T3.FloatType);
      atlas.minFilter = atlas.magFilter = T3.NearestFilter; atlas.generateMipmaps = false; atlas.needsUpdate = true;
      const L = S.land = { X0: x0, Z0: z0, side, levels: Math.max(0, Math.ceil(Math.log2(side / LAND_N / LAND_FINEST))), atlas, tiles: new Map(), free: Array.from({ length: SLOTS * SLOTS }, (_, i) => SLOTS * SLOTS - 1 - i), draws: [], layNo: -1, want: [], ahead: [], drawn: new Map(), morphs: new Map(), split: new Set() };
      bakeTile(S, 0, 0, 0);
      return L;
    }
    // a node's heights: the relief at its (LAND_N + 1)² points and a ring round them, into a slot of the atlas; and its error — how far the
    // relief strays from the grid between them (at the middles of its cells' sides and diagonals)
    const tileData = new Float32Array(LAND_TS ** 2);
    function bakeTile(S, l, i, j) {
      const L = S.land;
      if (!L.free.length) {
        // (the least recently used, but not the root, let go)
        let old = null;
        for (const [k, T] of L.tiles) if (T.l > 0 && (!old || T.used < old[1].used)) old = [k, T];
        L.tiles.delete(old[0]); L.free.push(old[1].slot);
      }
      const s = L.side / 2 ** l, x0 = L.X0 + i * s, z0 = L.Z0 + j * s, c = s / LAND_N, n = LAND_TS;
      const Y = (a, b) => I.groundAt((x0 + a * c) * I.EYE, (z0 + b * c) * I.EYE) / I.EYE;
      let lo = Infinity, hi = -Infinity, err = 0;
      for (let b = -1; b <= LAND_N + 1; b++) for (let a = -1; a <= LAND_N + 1; a++) tileData[(b + 1) * n + a + 1] = Y(a, b);
      const h = (a, b) => tileData[(b + 1) * n + a + 1];
      for (let b = 0; b <= LAND_N; b++) for (let a = 0; a <= LAND_N; a++) { lo = Math.min(lo, h(a, b)); hi = Math.max(hi, h(a, b)); }
      const off = (y, m) => { err = Math.max(err, Math.abs(y - m)); lo = Math.min(lo, y); hi = Math.max(hi, y); };
      for (let b = 0; b <= LAND_N; b++) for (let a = 0; a < LAND_N; a++) off(Y(a + 0.5, b), (h(a, b) + h(a + 1, b)) / 2);
      for (let b = 0; b < LAND_N; b++) for (let a = 0; a <= LAND_N; a++) off(Y(a, b + 0.5), (h(a, b) + h(a, b + 1)) / 2);
      for (let b = 0; b < LAND_N; b++) for (let a = 0; a < LAND_N; a++) off(Y(a + 0.5, b + 0.5), (h(a + 1, b) + h(a, b + 1)) / 2);
      const slot = L.free.pop(), src = new T3.DataTexture(tileData, n, n, T3.RedFormat, T3.FloatType);
      renderer.copyTextureToTexture(src, L.atlas, null, v2a.set((slot % SLOTS) * n, Math.floor(slot / SLOTS) * n));
      const T = { l, slot, lo, hi, err, used: S.layNo };
      L.tiles.set(tileKey(l, i, j), T);
      return T;
    }
    const v2a = new T3.Vector2();
    // the heights a node is drawn from: its own, or the finest of its own baked so far (its own asked for, into `want`)
    function tileOf(S, l, i, j, want) {
      const L = S.land;
      for (let k = l; k >= 0; k--, i >>= 1, j >>= 1) {
        const T = L.tiles.get(tileKey(k, i, j));
        if (T) { T.used = S.layNo; return { T, l: k, i, j }; }
        if (k === l) want.push([l, i, j]);
      }
      return null;
    }
    // The nodes the land is drawn by for `views`: a node split while its own heights are in, and it strays or its cells
    // are coarse for how near it is (one split already — `keep`, the last laying out's —, till it is well within that,
    // LAND_KEEP: not split and joined again as the eye moves on a hair). Heights asked for into `want`, each with how
    // much the ones it is drawn by now are off as the eye sees it — how far from the relief, how coarse, over how far it
    // is: what shows most wrong on the screen is baked first. → { leaves, split, at }
    function landNodes(S, views, want, keep) {
      const L = S.land, leaves = new Map(), split = new Set();
      const at = (l, i, j) => {
        const H = tileOf(S, l, i, j, want), s = L.side / 2 ** l, x0 = L.X0 + i * s, z0 = L.Z0 + j * s;
        const box = new T3.Box3(new T3.Vector3(x0, H.T.lo - 0.01, z0), new T3.Vector3(x0 + s, H.T.hi + 0.01, z0 + s));
        const d = Math.min(...views.map(v => nearIn(v, box)));
        if (H.l !== l) want[want.length - 1].push((H.T.err + s / LAND_N) / Math.max(d, 1e-3));
        return { l, i, j, H, box, d };
      };
      const visit = (l, i, j) => {
        const f = at(l, i, j), key = tileKey(l, i, j);
        if (f.d === Infinity) return;
        const c = L.side / 2 ** l / LAND_N, D = Math.max(f.d, 1e-3) / (keep.has(key) ? LAND_KEEP : 1);
        if (f.H.l === l && l < L.levels && (f.H.T.err > LAND_ERR * D || c > LAND_SEEN * D)) { split.add(key); for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) visit(l + 1, 2 * i + a, 2 * j + b); return; }
        leaves.set(key, f);
      };
      visit(0, 0, 0);
      return { leaves, split, at };
    }
    // The nodes drawn this laying out (once for all the draped planes): { box, node (x0, z0, size, its edges stitched to coarser ones),
    // its heights (the tile's x0, z0, size, slot), those it was drawn by and how far it has gone from them to its own (LAND_VS) }
    function landDraws(S) {
      const L = landOf(S);
      if (L.layNo === S.layNo) return L.draws;
      L.layNo = S.layNo; L.draws = []; L.want = [];
      const { leaves, split, at } = landNodes(S, S.views, L.want, L.split);
      L.split = split;
      // (what is beside a node across an edge: the node covering that side, if one as coarse or coarser is drawn)
      const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      const beside = (f, dx, dy) => {
        const ni = f.i + dx, nj = f.j + dy;
        if (ni < 0 || nj < 0 || ni >= 2 ** f.l || nj >= 2 ** f.l) return null;
        for (let k = f.l; k >= 0; k--) { const g = leaves.get(tileKey(k, ni >> (f.l - k), nj >> (f.l - k))); if (g) return g; }
        return null;
      };
      // (balanced: none more than one level coarser than one beside it — such a one split)
      for (let again = true, n = 0; again && n < L.levels; n++) {
        again = false;
        for (const f of [...leaves.values()]) for (const [dx, dy] of DIRS) {
          const g = beside(f, dx, dy);
          if (!g || g.l >= f.l - 1 || !leaves.delete(tileKey(g.l, g.i, g.j))) continue;
          for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) { const h = at(g.l + 1, 2 * g.i + a, 2 * g.j + b); if (h.d < Infinity) leaves.set(tileKey(h.l, h.i, h.j), h); }
          again = true;
        }
      }
      // (where each one's heights go from: those it was drawn by — or, new, those its parent was — when they are not its
      // own now; how far it has gone, kept till it is there; the heights it goes from kept in the atlas meanwhile)
      const now = performance.now() / 1000, drawn = new Map(), m = new Map();
      for (const [key, f] of leaves) {
        const ts = L.side / 2 ** f.H.l, tile = [L.X0 + f.H.i * ts, L.Z0 + f.H.j * ts, ts, f.H.T.slot], from = tileKey(f.H.l, f.H.i, f.H.j);
        const was = L.drawn.get(key) ?? L.drawn.get(tileKey(f.l - 1, f.i >> 1, f.j >> 1));
        let mo = L.morphs.get(key);
        if (was && was.from !== from && mo?.to !== from) L.morphs.set(key, mo = { tile: was.tile, from: was.from, to: from, t0: now });
        const T = mo && L.tiles.get(mo.from);
        let k = mo && T ? Math.min(1, (now - mo.t0) / LAND_MORPH) : 1;
        if (k < 1) T.used = S.layNo; else { L.morphs.delete(key); k = 1; }
        m.set(key, k);
        drawn.set(key, { tile, from });
        f.tile = tile; f.was = k < 1 ? mo.tile : tile;
      }
      L.drawn = drawn;
      for (const key of L.morphs.keys()) if (!leaves.has(key)) L.morphs.delete(key);
      // (each edge beside a coarser one — as its heights are: the finest it has — stitched to it; an edge goes from the
      // heights it was drawn by as the node beside it does, the further of the two — beside a coarser node or a finer
      // one (stitched to it), at once: the two drawn alike)
      for (const [key, f] of leaves) {
        let edges = 0;
        const me = DIRS.map(([dx, dy], k) => {
          const g = beside(f, dx, dy);
          if (g && g.H.l < f.H.l) edges |= 1 << k;
          if (!g) return f.i + dx < 0 || f.j + dy < 0 || f.i + dx >= 2 ** f.l || f.j + dy >= 2 ** f.l ? m.get(key) : 1;
          return g.l === f.l ? Math.max(m.get(key), m.get(tileKey(g.l, g.i, g.j)) ?? 1) : 1;
        });
        const s = L.side / 2 ** f.l;
        L.draws.push({ box: f.box, node: [L.X0 + f.i * s, L.Z0 + f.j * s, s, edges], tile: f.tile, from: f.was, mi: m.get(key), me });
      }
      return L.draws;
    }
    // the heights asked for — the frame's, then a view's ahead (scene.prepare) —, those that show most wrong on the screen
    // first (landNodes), as many as BAKE_MS lets (all of the frame's for a view made whole, till its deadline)
    function bakeLand(S, whole) {
      const L = S.land;
      if (!L) return;
      const t0 = performance.now(), byWrong = (a, b) => (b[3] ?? 0) - (a[3] ?? 0);
      for (const [l, i, j] of [...L.want.sort(byWrong), ...(whole ? [] : L.ahead.sort(byWrong))]) {
        if (whole ? performance.now() > S.deadline : performance.now() - t0 > BAKE_MS) break;
        if (!L.tiles.has(tileKey(l, i, j))) bakeTile(S, l, i, j);
      }
      L.want = []; L.ahead = [];
    }
    // a patch's mesh's geometry: the grid, as many times as there are nodes (room for `cap` of them — three.js keeps
    // the room a geometry's instances were first drawn with: more, a geometry anew)
    function landGeometry(cap) {
      const geom = new T3.InstancedBufferGeometry();
      geom.setIndex(GRID.index); geom.setAttribute('a_g', GRID.getAttribute('a_g'));
      for (const name of ['a_node', 'a_tile', 'a_from', 'a_me']) geom.setAttribute(name, new T3.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(T3.DynamicDrawUsage));
      geom.setAttribute('a_mi', new T3.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(T3.DynamicDrawUsage));
      geom.cap = cap;
      return geom;
    }
    // a draped plane's tile drawn on the land: the nodes under it, one draw
    function layDrape(S, ob, t, T, A, order, away) {
      const P = ob.plane, draws = landDraws(S), [f0, g0, f1, g1] = t.at, L = S.land;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const [f, g] of [[f0, g0], [f1, g0], [f1, g1], [f0, g1]]) { const q = P.on(-P.w / 2 + P.w * f, -P.d / 2 + P.d * g); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[2]); z1 = Math.max(z1, q[2]); }
      // (its part of the plane — to its edges, where it is the plane's: nothing left out between)
      const rect = [f0, g0, f1 >= 1 ? 1.001 : f1, g1 >= 1 ? 1.001 : g1];
      const under = draws.filter(d => d.box.max.x >= x0 && d.box.min.x <= x1 && d.box.max.z >= z0 && d.box.min.z <= z1);
      if (!under.length) return;
      const key = tileKey(t.L, t.i, t.j);
      let q = ob.meshes.get(key);
      if (!q) {
        q = paintMeshes('land', landGeometry(Math.max(16, under.length * 2)), ob.ruled ? 'over' : 'solid', false, { inside: !!ob.spec.inside, unlit: !!ob.o.glows });
        q.m.userData.box = new T3.Box3();
        scene.add(q.m);
        ob.meshes.set(key, q);
      }
      if (under.length > q.m.geometry.cap) { q.m.geometry.dispose(); q.m.geometry = landGeometry(under.length * 2); }
      const geom = q.m.geometry, box = q.m.userData.box.makeEmpty(), [na, ta, fa, ea, ma] = ['a_node', 'a_tile', 'a_from', 'a_me', 'a_mi'].map(n => geom.getAttribute(n));
      geom.instanceCount = under.length;
      under.forEach((d, k) => { na.array.set(d.node, 4 * k); ta.array.set(d.tile, 4 * k); fa.array.set(d.from, 4 * k); ea.array.set(d.me, 4 * k); ma.array[k] = d.mi; box.union(d.box); });
      na.needsUpdate = ta.needsUpdate = fa.needsUpdate = ea.needsUpdate = ma.needsUpdate = true;
      q.used = S.layNo;
      const u = q.u;
      u.u_tex.value = T.tex; u.u_uv.value.set(...A); u.u_rect.value.set(...rect); u.u_alpha.value = 1; u.u_zp.value = 0; u.u_pool.value = P.pool * (1 - S.lit);
      u.u_pc.value.set(P.Xc, P.Y, P.Zc); u.u_pr.value.set(...P.ax.r); u.u_pu.value.set(...P.ax.u); u.u_ps.value.set(P.w, P.d);
      u.u_heights.value = L.atlas;
      q.m.renderOrder = order;
      if (away) { q.m.visible = false; S.offView.push(q.m); }
      else q.m.visible = true;
    }

    // ── shadows ───────────────────────────────────────────────────────────
    // A shadow (engine.js shadowsOf: an element or a plane casting its painting from a light onto what it names — the
    // ground, a plane, an upright element): its caster's painting laid on what it falls on as a grid of cells, each
    // corner where the ray from the light through it meets that — laid whole on each it names: where another is met
    // first (a floor behind a wall's foot), what stands before it hides it (the frame's depth), and the light is kept
    // from it there anyway (a light's shadows are one: MAX) — blurred as much as the light's size (`soft`, a window's:
    // softOf) spreads its edge there, sharp at the contact, softer away, reaching past the caster too. Its triangles are made where they lie in the world and kept while the caster, its light and what it
    // falls on stay as they are; the camera only lays them on the frame (SHADOW_VS). Each light's shadows into one mask,
    // then the frame darkened by it — not in a mirror. Its cells about SH_CELL across (eye heights) — a hand's few, a
    // house's SH_GRID at most.
    const SH_GRID = [12, 20], SH_CELL = 0.15, SH_DEPTH = 3;
    const shadowScene = new T3.Scene();
    shadowScene.matrixWorldAutoUpdate = false;
    const WHITE_TEX = textureOf(paint(2, 2, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 2, 2); }), false);
    const SHADOW_OWN = () => ({ u_tex: { value: null }, u_mask: { value: null }, u_depth: { value: null }, u_str: { value: new T3.Vector3() }, u_src: { value: new T3.Vector3() }, u_amb: { value: 0 }, u_lit: { value: 0 }, u_k: { value: 0 } });
    const shadowMaterial = () => shared('shadow', () => raw(SHADOW_VS, SHADOW_FS, SHADOW_OWN(), { blending: T3.CustomBlending, blendEquation: T3.MaxEquation, blendSrc: T3.OneFactor, blendDst: T3.OneFactor, depthTest: false }));
    const shade = (() => {
      const u = { u_tex: { value: null } }, m = new T3.Mesh(QUAD, raw(POST_VS, SHADE_FS, u, { blending: T3.CustomBlending, blendSrc: T3.ZeroFactor, blendDst: T3.OneMinusSrcAlphaFactor, blendSrcAlpha: T3.ZeroFactor, blendDstAlpha: T3.OneFactor, depthTest: false }));
      m.frustumCulled = false;
      const pass = new T3.Scene();
      pass.add(m);
      return Object.assign(mask => { u.u_tex.value = mask; renderer.render(pass, camera); }, { pass });
    })();
    // what a shadow falls on, as a plane of the world: a point q of it, its normal n, its painting now (the shadow
    // shows only where it is painted) and where a world point is on that painting — or null (a card that turns to face
    // the eye). The ground: none — where each ray meets it, the land as it rises and falls (engine.js groundHit)
    function receiver(S, R, cam) {
      if (R === 'ground') return { q: [], n: [], tex: WHITE_TEX, uv: () => [0.5, 0.5], hit: I.groundHit };
      if (R.kind === 'plane') {
        const P = R.plane, tex = R.live ? R.live.holder.tex : R.base?.tex;
        if (!tex) return null;
        const { r: a, u: b, n } = P.ax, along = (Q, e) => (Q[0] - P.Xc) * e[0] + (Q[1] - P.Y) * e[1] + (Q[2] - P.Zc) * e[2];
        return { q: [P.Xc, P.Y, P.Zc], n, tex, uv: Q => [(along(Q, a) + P.w / 2) / P.w, (P.d / 2 - along(Q, b)) / P.d], hit: P.drape ? I.groundHit : null };
      }
      if (R.shown?.frame !== S.frameNo || (S.round && !R.turn)) return null;
      const { tex, r } = R.shown, F = cardFrame(S, R, cam), A = F.A, n = R.turn ? I.axesOf(R.turn).n : [0, 0, -1];
      const along = (Q, e) => (Q[0] - A.X) * e[0] + (Q[1] - A.Y) * e[1] + (Q[2] - A.Z) * e[2];
      return { q: [A.X, A.Y, A.Z], n, tex, uv: Q => [(R.x + along(Q, F.R) / F.k - r.x) / r.w, (R.y - along(Q, F.U) / F.k - r.y) / r.h], key: [A.Zp, R.x, R.y, r.x, r.y, r.w, r.h] };
    }
    // what casts a shadow — an element, a part of one, a plane: { tex: its painting this frame, at: where it stands,
    // world(f, g): the point (f, g) of that painting (0…1 across, down) in the world, size: its painting's width and
    // height in the world, key: what its place in the world goes by }
    function caster(S, ob, cam, t) {
      if (ob.kind === 'plane') {
        const P = ob.plane, tex = ob.live ? ob.live.holder.tex : ob.base?.tex;
        return tex ? { tex, at: { X: P.Xc, Y: P.Y, Z: P.Zc }, world: I.onPlane(P), size: [P.w, P.d], key: [P.Xc, P.Y, P.Zc, P.turn.yaw, P.turn.lean] } : null;
      }
      const shown = ob.shown?.frame === S.frameNo ? ob.shown : ob.kind === 'part' ? partTexture(ob, null) : shownTexture(S, ob, null, t);
      if (!shown?.tex) return null;
      const { tex, r } = shown, F = cardFrame(S, ob, cam), A = F.A, billboard = !ob.turn && (S.round || (cam.pan && !ob.o.sky));
      return { tex, at: A, world: (f, g) => worldAt(F, ob, ID, r.x + r.w * f, r.y + r.h * g), size: [r.w * F.k, r.h * F.k], key: [A.X, A.Y, A.Z, A.Zp, ob.x, ob.y, ob.turn?.yaw, ob.turn?.lean, billboard ? cam.yaw : 0, r.x, r.y, r.w, r.h] };
    }
    // whether what a shadow falls on is in a room
    const insideOf = R => R !== 'ground' && !!R.spec?.inside;
    // where a ray of light from src through world point C meets receiver q — on the land, where it meets the land — [point, t], or null
    const hitOf = (q, C, src) => (q.hit ? q.hit(C, src.at, src.dir) : I.rayHit(q, C, src.at, src.dir));
    // a shadow's cells in the world, as triangles (12 numbers a corner: X Y Z where its ray meets what it falls on, its
    // u v on the caster, on the receiver, how blurred u v, how much of each of its lights reaches there) — a cell with a corner whose ray meets it not split
    // (the shadow ends where it does); one wholly past an edge of what it falls on left out. The penumbra past the
    // caster: a strip along each edge of its painting as wide as the blur at that edge's corners, a patch at each corner
    function shadowCells(S, sh, R, cs, src, pl, all, land) {
      const { world } = cs, [wk, hk] = cs.size, out = [], soft = I.softOf(sh, src), inside = insideOf(R);
      const GC = I.clamp(Math.ceil(wk / SH_CELL), 2, SH_GRID[0]), GR = I.clamp(Math.ceil(hk / SH_CELL), 2, SH_GRID[1]);
      const met = new Map(), FG = 2 ** SH_DEPTH, corner = (f, g) => {
        const k = Math.round(f * GC * FG) * 1e5 + Math.round(g * GR * FG);
        if (!met.has(k)) met.set(k, cornerAt(f, g, k));
        return met.get(k);
      };
      const cornerAt = (f, g, k) => {
        const C = world(f, g), meet = q => { if (!q.hit) return hitOf(q, C, src); if (!land.has(k)) land.set(k, hitOf(q, C, src)); return land.get(k); };
        const h = meet(pl);
        if (!h) return null;
        const b = src.dir ? soft * h[1] : soft * (h[1] - 1) / h[1];
        return [...h[0], f, g, ...pl.uv(h[0]), b / wk, b / hk, ...[0, 1, 2].map(k => (all[k] ? I.reachShare(all[k], h[0], inside) : 0))];
      };
      const cell = (f0, g0, f1, g1, depth) => {
        const c = [corner(f0, g0), corner(f1, g0), corner(f1, g1), corner(f0, g1)], ok = c.filter(Boolean).length;
        if (ok === 0) return;
        if (ok < 4) {
          if (depth >= SH_DEPTH) return;
          const fm = (f0 + f1) / 2, gm = (g0 + g1) / 2;
          cell(f0, g0, fm, gm, depth + 1); cell(fm, g0, f1, gm, depth + 1); cell(f0, gm, fm, g1, depth + 1); cell(fm, gm, f1, g1, depth + 1);
          return;
        }
        if (c.every(q => q[5] < 0) || c.every(q => q[5] > 1) || c.every(q => q[6] < 0) || c.every(q => q[6] > 1)) return;
        for (const k of [0, 1, 2, 0, 2, 3]) out.push(...c[k]);
      };
      for (let gi = 0; gi < GR; gi++) for (let fi = 0; fi < GC; fi++) cell(fi / GC, gi / GR, (fi + 1) / GC, (gi + 1) / GR, 0);
      // (the penumbra past it: off each edge as far as the blur there — on the caster's painting, at most the caster
      // again — its corners found anew, off the grid)
      const lay = c => {
        if (!c.every(Boolean) || c.every(q => q[5] < 0) || c.every(q => q[5] > 1) || c.every(q => q[6] < 0) || c.every(q => q[6] > 1)) return;
        for (const k of [0, 1, 2, 0, 2, 3]) out.push(...c[k]);
      };
      const off = (q, df, dg) => q && cornerAt(q[3] + df * Math.min(1, q[7]), q[4] + dg * Math.min(1, q[8]), `${q[3]} ${q[4]} ${df} ${dg}`);
      for (let i = 0; i < GC; i++) for (const [g, dg] of [[0, -1], [1, 1]]) { const a = corner(i / GC, g), b = corner((i + 1) / GC, g); lay([a, b, off(b, 0, dg), off(a, 0, dg)]); }
      for (let j = 0; j < GR; j++) for (const [f, df] of [[0, -1], [1, 1]]) { const a = corner(f, j / GR), b = corner(f, (j + 1) / GR); lay([a, b, off(b, df, 0), off(a, df, 0)]); }
      for (const [f, g, df, dg] of [[0, 0, -1, -1], [1, 0, 1, -1], [1, 1, 1, 1], [0, 1, -1, 1]]) { const q = corner(f, g); lay([q, off(q, df, 0), off(q, df, dg), off(q, 0, dg)]); }
      return new Float32Array(out);
    }
    // the triangles as a mesh of the shadows' scene
    function shadowMesh(verts) {
      const g = new T3.BufferGeometry(), b = new T3.InterleavedBuffer(verts, 12);
      for (const [name, size, at] of [['a_pos', 3, 0], ['a_uv', 2, 3], ['a_uv2', 2, 5], ['a_blur', 2, 7], ['a_g', 3, 9]]) g.setAttribute(name, new T3.InterleavedBufferAttribute(b, size, at));
      // (no `position` of three.js's own: how many corners, said)
      g.setDrawRange(0, verts.length / 12);
      const own = SHADOW_OWN(), m = bound(new T3.Mesh(g, shadowMaterial()), own);
      m.own = own;
      shadowScene.add(m);
      return m;
    }
    // The scene's shadows, laid once all is drawn: each light's — every caster's (an element, its parts) on every
    // receiver it names, one taking the most of its own and what is laid there — into the mask, then the frame
    // darkened by it (the lights' one after another: the shadows of two lights are each as dark as its share).
    // Their triangles made for one new, and anew at once for one whose caster or what it falls on moved; for one only
    // its light moved (the sun rising, a torch carried) the longest kept first, as many as SH_MS lets — the rest a
    // frame or a few behind it (a frame drawn whole: all)
    const SH_MS = 6;
    function shadowsLaid(S, cam, t, whole) {
      S.shaded = false;
      if (!S.shadows.length) return;
      const byLight = new Map();
      for (const sh of S.shadows) {
        const casters = [sh.ob, ...(sh.ob.parts || [])].map((c, i) => [caster(S, c, cam, t), i - 1]);
        for (const R of sh.onto) for (const [cs, i] of casters) {
          const pl = cs && receiver(S, R, cam);
          if (!pl) continue;
          const all = I.shadowLights(S.sources, sh, cs.at);
          for (const src of all) {
            if (!byLight.has(src)) byLight.set(src, []);
            byLight.get(src).push(shadowJob(S, { sh, R, cs, pl, all, src, slot: `${R === 'ground' ? R : R.o.id} ${i} ${src.id}`, rays: `${i} ${src.id}` }));
          }
        }
      }
      const jobs = [...byLight.values()].flat(), t0 = performance.now();
      for (const job of jobs) if (job.redo === 'now') shadowMade(S, job);
      for (const job of jobs.filter(j => j.redo === 'light').sort((a, b) => a.G.made - b.G.made)) {
        if (!whole && performance.now() - t0 > SH_MS) break;
        shadowMade(S, job);
      }
      for (const m of shadowScene.children) m.visible = false;
      if (!byLight.size) return;
      S.shaded = true;
      renderer.setRenderTarget(S.kept);
      renderer.setClearColor(0xffffff, 1);
      renderer.clear(true, false, false);
      for (const [src, jobs] of byLight) {
        for (const job of jobs) shadowShown(S, job, src);
        renderer.setRenderTarget(S.mask);
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, false, false);
        renderer.render(shadowScene, camera);
        renderer.setRenderTarget(S.kept);
        shade(S.mask.texture);
        for (const m of shadowScene.children) m.visible = false;
      }
    }
    // one caster's shadow from a light on one receiver: its triangles kept (G) and what they go by — the caster and what
    // it falls on; the light's place (its rays) and what the shares of its lights go by: a point's place and reach, a
    // window's, the way one far off comes in through panes (one far off shining on all alike: nothing) — and so whether
    // they are made anew (redo): 'now' (new, or the caster or what it falls on moved), 'light' (its lights moved), null
    const placeOf = q => [q.id, ...(q.at || (q.through ? q.dir : [])), q.reach, ...(q.win ? [...q.win.c, ...q.win.a, ...q.win.b] : [])];
    function shadowJob(S, job) {
      const { sh, cs, pl, all, src, slot } = job, grids = sh.grids ||= new Map();
      job.ck = [...cs.key, ...pl.q, ...pl.n, ...(pl.key || [])].join();
      job.lk = [...(src.at || src.dir), ...all.flatMap(placeOf)].join();
      job.G = grids.get(slot) || grids.set(slot, { ck: null, lk: null, mesh: null, ids: [], made: -1 }).get(slot);
      job.redo = job.G.ck !== job.ck ? 'now' : job.G.lk !== job.lk ? 'light' : null;
      return job;
    }
    // its triangles made
    function shadowMade(S, { sh, R, cs, pl, all, src, rays, G, ck, lk }) {
      // (where the rays from this caster's grid meet the land, kept while it and the light stay)
      const rk = [...cs.key, ...(src.at || src.dir)].join(), by = sh.rays ||= new Map();
      if (by.get(rays)?.key !== rk) by.set(rays, { key: rk, land: new Map() });
      if (G.mesh) { shadowScene.remove(G.mesh); G.mesh.geometry.dispose(); }
      const verts = shadowCells(S, sh, R, cs, src, pl, all, by.get(rays).land);
      Object.assign(G, { ck, lk, mesh: verts.length ? shadowMesh(verts) : null, ids: all.map(q => q.id), made: S.frameNo });
    }
    // ... and shown, as dark as its lights make it now (those it was made for, by their ids: one kept from before a
    // light rose over another)
    function shadowShown(S, { sh, R, cs, pl, src, G }) {
      if (!G.mesh) return;
      const own = G.mesh.own, now = id => S.sources.find(q => q.id === id);
      own.u_tex.value = cs.tex; own.u_mask.value = pl.tex; own.u_depth.value = S.target.depthTexture;
      own.u_str.value.set(...[0, 1, 2].map(k => (G.ids[k] != null ? now(G.ids[k])?.strength ?? 0 : 0))); own.u_src.value.set(...[0, 1, 2].map(k => +(G.ids[k] === src.id)));
      own.u_amb.value = insideOf(R) ? S.ambientIn : S.ambient; own.u_lit.value = S.lit; own.u_k.value = sh.strength;
      G.mesh.visible = true;
    }

    // ── glows: the light on what glows, in the air ────────────────────────
    const GLOW_OWN = () => ({ u_tex: { value: SPRITE.glow }, u_spot: { value: new T3.Vector3() }, u_size: { value: 1 }, u_col: { value: new T3.Vector3(1, 1, 1) }, u_alpha: { value: 1 } });
    function glowMesh() {
      const u = GLOW_OWN(), m = bound(new T3.Mesh(QUAD, shared('glow', () => raw(GLOW_VS, GLOW_FS, GLOW_OWN(), { ...additive, depthTest: false }))), u);
      scene.add(m);
      return { mesh: m, u };
    }
    // a pool of glow sprites, handed out each frame in turn
    let glows = [];
    let glowsUsed = 0;
    function glow(tex, at, size, c, a, order) {
      if (a <= 0.002 || !(size > 0)) return;
      const g = glows[glowsUsed] ||= glowMesh();
      glowsUsed++;
      g.u.u_tex.value = tex; g.u.u_spot.value.set(...at); g.u.u_size.value = size; g.u.u_col.value.set(...c); g.u.u_alpha.value = a;
      g.mesh.visible = true; g.mesh.renderOrder = order;
    }
    const flickerOf = (lt, x, y, t) => (lt.fire ? 0.8 + 0.2 * Math.sin(t * 11)
      : lt.flicker != null ? 1 - lt.flicker * 0.5 * (0.5 + 0.5 * Math.sin(t * 9 + lt.x) * Math.sin(t * 5.3 + lt.y))
        : 0.9 + 0.1 * Math.sin(t * 7 + x) * Math.sin(t * 3.1 + y));
    // where a thing's light (in its painting's stage px) is in the world, and how far it reaches: { at, reach }, or
    // null (the sky's: on the frame)
    function lightPlace(S, ob, l) {
      if (ob.kind === 'plane') return { at: ob.plane.on(l.x / S.PH / I.EYE, l.y / S.PH / I.EYE), reach: 2 * l.r / S.PH / I.EYE };
      if (ob.kind === 'sky' || !ob.at) return null;
      const k = ob.at.Zp / S.PH;
      return { at: [ob.at.X + (l.x - ob.x) * k, ob.at.Y - (l.y - ob.y) * k, ob.at.Z], reach: 2 * l.r * k };
    }
    // a part's lights are fractions of its box (paintPart: in px of it)
    function sourcesOf(S, spec) {
      const from = [];
      for (const ob of S.things) {
        if (ob.insert) continue;
        for (const l of ob.live?.r ? ob.live.lights : ob.lights || []) {
          const q = lightPlace(S, ob, l);
          if (q) from.push({ id: l.id ?? String(ob.o.id ?? ob.o.kind), owner: String(ob.o.id), ...q, rgb: l.c.map(v => v * 255), strength: l.a, sprite: { lt: l, x: ob.x, y: ob.y } });
        }
        for (const part of ob.parts || []) {
          const k = part.at.Zp / S.PH;
          for (const l of part.lights) from.push({ id: l.id ?? String(ob.o.id), owner: String(ob.o.id), at: [part.at.X + (l.x - part.x) * k, part.at.Y - (l.y - part.y) * k, part.at.Z], reach: 2 * l.r * k, rgb: l.c.map(v => v * 255), strength: l.a, sprite: { lt: l, x: part.x, y: part.y } });
        }
      }
      return I.sourcesNow(spec, S.dz, from);
    }
    // the scene's light for this frame (LIGHT): the ambient outside and inside, the far sources, and the LIGHTS point
    // sources lighting most of what is seen from here — the strongest by how near the camera their reach comes — as they
    // shine (the lit scene lays them as much as it is lit: u_litk; a plane's pool where it is not)
    function lightUniforms(S, look, cam, t) {
      const amb = I.ambientOf(look, S.sources), amb0 = I.ambientOf(look, []), fars = S.sources.filter(s => s.dir && !s.through && s.strength > 0.002).slice(0, FAR);
      const points = S.sources.filter(s => !s.dir && !s.win && s.strength > 0.002);
      const weight = s => s.strength * s.reach / Math.max(s.reach, Math.hypot(s.at[0] - cam.x, s.at[1] - (cam.h ?? 1), s.at[2] - cam.z));
      points.sort((a, b) => weight(b) - weight(a)).length = Math.min(points.length, LIGHTS);
      U.u_amb.value.set(...amb); U.u_amb0.value.set(...amb0); U.u_in.value = look.inside;
      U.u_dn.value = fars.length;
      fars.forEach((s, i) => { U.u_dd.value[i].set(...s.dir); U.u_dc.value[i].set(...s.rgb.map(v => v / 255 * s.strength * look.lit)); });
      U.u_n.value = points.length;
      points.forEach((s, i) => {
        const f = s.sprite ? flickerOf(s.sprite.lt, s.sprite.x, s.sprite.y, t) : I.flickerNow(s, t);
        U.u_lp.value[i].set(...s.at, s.reach);
        U.u_lc.value[i].set(...s.rgb.map(v => v / 255 * s.strength * f));
        U.u_li.value[i] = s.inside ? 1 : 0;
      });
      // the windows' own light (a daylight coming in at all of one): which way a × b looks — into the room
      const wins = S.sources.filter(s => s.win && s.strength > 0.002).slice(0, WINS);
      U.u_nw.value = wins.length;
      wins.forEach((s, j) => {
        const { c, a, b, n } = s.win, x = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        U.u_wp.value[j].set(...c, s.reach); U.u_wa.value[j].set(...a, 0); U.u_wb.value[j].set(...b, x[0] * n[0] + x[1] * n[1] + x[2] * n[2] < 0 ? -1 : 1);
        U.u_wc.value[j].set(...s.rgb.map(v => v / 255 * s.strength * I.flickerNow(s, t)));
      });
      // the lights far off that come in through panes (engine.js panesOf) — each pane's corners in its plane
      const thr = S.sources.filter(s => s.through && s.strength > 0.002).slice(0, TL), panes = thr.flatMap((s, i) => s.through.map(W => ({ W, i }))).slice(0, PANES);
      U.u_tn.value = thr.length; U.u_pn.value = panes.length;
      thr.forEach((s, i) => { U.u_td.value[i].set(...s.dir); U.u_tc.value[i].set(...s.rgb.map(v => v / 255 * s.strength * look.lit)); U.u_ts.value[i] = s.soft; });
      panes.forEach(({ W, i }, w) => {
        U.u_pl.value[w] = i; U.u_pk.value[w] = Math.min(PV, W.pts.length);
        U.u_qo.value[w].set(...W.o); U.u_qu.value[w].set(...W.u); U.u_qv.value[w].set(...W.v); U.u_qnr.value[w].set(...W.n);
        W.pts.slice(0, PV).forEach((q, k) => U.u_pp.value[w * PV + k].set(...q));
      });
    }

    // ── a frame ───────────────────────────────────────────────────────────
    // what moves through the world (its place, what carries it) put where the state has it now — its painting's
    // anchor, its box, where it stands, its turn; a plane its place and turn anew (the same plane)
    function placeMoving(S) {
      for (const ob of S.things) {
        if (ob.kind === 'plane') {
          if (!S.dz.moves(ob.spec)) continue;
          const P = I.planeOf(ob.spec, S.dz), key = `${P.Xc}|${P.Y}|${P.Zc}|${P.turn.yaw}|${P.turn.lean}`;
          if (key !== ob.placed) { ob.placed = key; Object.assign(ob.plane, P); ob.Z = P.far; }
          continue;
        }
        if (!ob.from) continue;
        const n = S.dz.now(ob.from), key = `${n.o.x}|${n.o.y}|${n.o.size}|${n.o.facing}|${n.o.tilt}|${n.at.X}|${n.at.Y}|${n.at.Z}`;
        if (key === ob.placed) continue;
        ob.placed = key; ob.moved = S.frameNo;
        const was = { bx: ob.bx, by: ob.by, bw: ob.bw };
        place(S, ob, n);
        const k = ob.bw / was.bw;
        if (!ob.live && ob.lights) ob.lights = ob.lights.map(l => ({ ...l, x: ob.bx + (l.x - was.bx) * k, y: ob.by + (l.y - was.by) * k, r: l.r * k, dot: l.dot && l.dot * k }));
      }
    }
    // the gentle motion an element's spec asks for (sway: degrees about its foot; bob: metres up and down) — and a
    // platformer's hero, moved and turned from where it is painted: what moves its painting on the stage
    function motionOf(ob, cam, t) {
      const { o, x, y, s } = ob;
      let m = ID;
      if ((o.kind === 'custom' || !o.kind) && (o.sway || o.bob)) {
        const ppm = s / (o.height || 2);
        m = around(x, y, Math.sin(t * 0.9 + x) * (o.sway || 0) * Math.PI / 180, 1, 1, 0, Math.sin(t * 1.1 + x) * (o.bob || 0) * ppm);
      }
      if (cam.hero && o.id === cam.hero.id) m = mul(I.heroMatrix(cam.hero, x, s / (o.height || 2)), m);
      return m;
    }
    // the order things are drawn in, far to near — ahead by the depth each stands at (Z: as from the start), looking
    // around by how far each is from the eye (a card turned its own way, a plane by its farthest reach) — and as the
    // spec says (behind, inFront); the light in the air among them, each at its depth
    function orderOf(S, cam) {
      const items = [];
      for (const ob of S.things) {
        // (an unseen element only where others are cut by it: laid, never shown)
        if (ob.insert || (ob.unseen && !S.cutters.has(String(ob.o.id)))) continue;
        if (ob.kind === 'sky') { items.push({ ob, d: Infinity, sky: true }); continue; }
        if (S.round) {
          if (ob.kind === 'plane') { const P = ob.plane; items.push({ ob, d: Math.hypot(P.Xc - cam.x, P.Zc - cam.z) + Math.max(P.w, P.d) / 2 }); }
          else items.push({ ob, d: Math.hypot(ob.at.X - cam.x, ob.at.Z - cam.z) + (ob.turn ? ob.bw / 2 * ob.at.Zp / S.PH : 0) });
        } else items.push({ ob, d: ob.kind === 'card' && ob.turn ? reachOf(S, ob) : ob.Z });
        for (const part of ob.parts || []) items.push({ ob: part, d: S.round ? Math.hypot(part.at.X - cam.x, part.at.Z - cam.z) : part.Z });
      }
      const far = it => (it.sky ? Infinity : S.round ? it.d : Math.min(it.d, I.Z_FAR));
      items.sort((a, b) => (far(b) - far(a)) || (b.d - a.d) || 0);
      const idOf = it => (it.ob.kind === 'part' ? it.ob.owner.o.id : it.ob.o.id) ?? null;
      return I.arrange(items, S.rules, idOf);
    }
    // a card turned its own way by its farthest reach (what stands before it — a roof over a gable — drawn after it)
    function reachOf(S, ob) {
      const F = cardFrame(S, ob, { yaw: 0 });
      return Math.max(...[[ob.bx, ob.by], [ob.bx + ob.bw, ob.by], [ob.bx, ob.by + ob.bh], [ob.bx + ob.bw, ob.by + ob.bh]].map(([x, y]) => worldAt(F, ob, ID, x, y)[2]));
    }

    // All a view needs, made before it is shown (a scene's first frame, a frame drawn whole; a new shot's, the frame before
    // it shown meanwhile — till SHOT_WAIT, then the rest as the frames go): the land's heights down to the finest it asks
    // for — a level more each time it is laid out —, its nodes as they are (nothing blended in), every tile and close-up
    // painted as sharp as it is seen — those that show most wrong first
    const SHOT_WAIT = 500;
    function readied(S, cam, t, look, deadline = Infinity) {
      S.deadline = deadline;
      layout(S, cam, t, look);
      for (let n = 0; S.land?.want.length && n <= S.land.levels && performance.now() < deadline; n++) { bakeLand(S, true); layout(S, cam, t, look); }
      if (performance.now() < deadline) S.land?.morphs.clear();
      refinePlanes(S, [], true); refineCards(S, cam, true);
    }
    // what the frame leaves to the views ahead (cams: where the camera is heading, where scene.prepare says it will be) —
    // their land's heights and their planes' tiles, the frame's own first; each view as its eye would see it
    function aheadViews(S, cams) {
      const out = [];
      for (const c of cams) { aim(c, S); out.push([{ frustum: frustum.clone(), eye: [c.x, c.h ?? 1, c.z] }]); }
      return out;
    }
    function frame(S, spec, cam, t, dt, settled, goal, whole, ahead = []) {
      S.frameNo++;
      S.liveK = whole ? 1 : Math.min(1, Math.sqrt(LIVE_FRAME * S.CW * S.CH / Math.max(1, S.liveAsk ?? 0))); S.liveAsk = 0;
      placeMoving(S);
      for (const ob of S.things) if (ob.parts && ob.live) {
        // (an element painting parts painted first when due — its parts with it — then its parts put where they are)
        const seen = cardSeen(S, ob, cam);
        shownTexture(S, ob, seen, t);
      }
      // (the parts of what moved: where they are now — what was repainted put its parts anew)
      for (const ob of S.things) if (ob.parts && ob.moved === S.frameNo) for (const part of ob.parts) placePart(S, part);
      const look = S.look = I.lookOf(spec);
      U.u_reach.value = look.hazeReach; U.u_reach0.value = S.reach0; U.u_fog.value.set(...look.hazeColor.map(v => v / 255));
      S.lit = look.lit; U.u_lit.value = S.lit > 0 ? 1 : 0; U.u_litk.value = S.lit;
      S.sources = sourcesOf(S, spec);
      if (S.lit || S.pools) lightUniforms(S, look, cam, t);
      aim(cam, S);
      S.mirrors = mirrorsOf(S, cam); S.views = viewsOf(S, cam);
      S.camKey = `${cam.x},${cam.y},${cam.z},${cam.h},${cam.yaw},${cam.pan},${cam.roll},${S.W},${S.H},${S.OX},${S.OY}`;
      U.u_canvas.value.set(S.CW, S.CH); U.u_at.value.set(S.OX, S.OY); U.u_res.value.set(S.W, S.H);
      // (a frame drawn whole — one a render takes —, and the first of a new shot (the camera elsewhere at once: scenestate.js
      // views): all its view needs made first — a shot's, till SHOT_WAIT —, then laid out again)
      const shot = I.STATE.views !== S.view && S.warm === true;
      S.view = I.STATE.views;
      if (whole) readied(S, cam, t, look);
      else if (shot) readied(S, cam, t, look, performance.now() + SHOT_WAIT);
      layout(S, cam, t, look);
      S.t = t;
      S.ambient = I.ambientOf(look, S.sources).reduce((a, b) => a + b) / 3;
      cuts(S);
      // (a scene's first frame: what it draws laid out, then its programs compiled off the page's thread —
      // KHR_parallel_shader_compile — and drawn once they are, the canvas as it was till then; a frame drawn whole
      // waits for nothing)
      if (S.warm !== true && !whole) {
        // (all its view needs made first: it is first seen as it will stand — then what draws it compiled)
        if (!S.warm) { readied(S, cam, t, look); S.warm = Promise.all([scene, ...passesOf(S)].map(sc => renderer.compileAsync(sc, camera))).then(() => { S.warm = true; }); }
        return;
      }
      mirrors(S, cam);
      for (const ob of S.things) if (ob.glass && ob.mesh) ob.mesh.visible &&= !!ob.mirrored;
      // drawn: the scene into its target, then graded into the canvas
      renderer.setRenderTarget(S.target);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, false);
      renderer.render(scene, camera);
      S.ambientIn = I.ambientOf(look, S.sources, true).reduce((a, b) => a + b) / 3;
      shadowsLaid(S, cam, t, whole);
      post(S, look, t);
      const views = aheadViews(S, [...(goal && goal !== cam ? [goal] : []), ...ahead]);
      aim(cam, S);
      if (S.land) for (const v of views) landNodes(S, v, S.land.ahead, new Set());
      refinePlanes(S, views, false);
      refineCards(S, cam, false);
      bakeLand(S, false);
    }
    // everything where it is seen now, in the order it is drawn — far to near, the light in the air among it — with
    // the glows its lights make
    function layout(S, cam, t, look) {
      // (S.layNo: this laying out — a frame drawn whole is laid out twice: the tiles of the first not shown)
      glowsUsed = 0; S.offView = []; S.layNo = (S.layNo || 0) + 1;
      const order = S.order = [];
      const items = orderOf(S, cam), halos = I.airOf(S.sources, look, h => (S.round ? Math.hypot(h.at[0] - cam.x, h.at[2] - cam.z) : h.at[2]));
      let n = 0;
      for (const it of items) {
        while (halos.length && !it.sky && halos[0].Z >= (S.round ? it.d : Math.min(it.d, I.Z_FAR))) halo(S, halos.shift(), cam, t, n++ * 4);
        const ob = it.ob;
        order.push(ob);
        const at = n++ * 4;
        if (ob.kind === 'sky') laySky(S, ob, cam, t, at);
        else if (ob.kind === 'plane') { layPlane(S, ob, cam, t, at); planeGlows(S, ob, cam, t, at + 2); }
        else layThing(S, ob, cam, t, at);
      }
      for (const h of halos) halo(S, h, cam, t, n++ * 4);
      for (const ob of S.things) if (ob.insert) layInsert(S, ob, t, n++ * 4);
      for (let i = glowsUsed; i < glows.length; i++) glows[i].mesh.visible = false;
    }
    // a card (an element, a part of one) as seen now: its painting, where it stands, how much of it (faded as it is
    // passed close by, or seen edge on), its glows
    function layThing(S, ob, cam, t, order) {
      const mesh = ob.mesh;
      if (!mesh) return;
      if (ob.unseen) { layUnseen(S, ob, cam, t, order); return; }
      const m = ob.kind === 'part' ? ID : motionOf(ob, cam, t), key = `${S.camKey}|${ob.placed}|${m === ID ? '' : m}`;
      if (ob.seenKey !== key) { ob.seenKey = key; ob.seen = cardSeen(S, ob, cam, m); }
      const seen = ob.seen;
      if (!seen || I.away(ob.spec)) {
        mesh.visible = false; if (ob.depthMesh) ob.depthMesh.visible = false;
        // (out of view — behind the eye: laid all the same, hidden — a mirror, a pane may see it; not one away)
        const sh = ob.kind === 'part' ? partTexture(ob, null) : shownTexture(S, ob, null, t);
        if (!I.away(ob.spec) && sh.tex && !ob.glass) {
          layCard(S, ob, cam, sh.tex, sh.r, m, 1);
          mesh.renderOrder = order; S.offView.push(mesh);
          if (ob.depthMesh) { ob.depthMesh.renderOrder = order + 0.5; S.offView.push(ob.depthMesh); }
        }
        return;
      }
      const fade = I.nearFade(seen.D);
      const { tex, r, lights, aux } = ob.kind === 'part' ? partTexture(ob, seen) : ob.person ? personTexture(S, ob, cam, seen, t) : shownTexture(S, ob, seen, t);
      if (!tex || fade <= 0) { mesh.visible = false; if (ob.depthMesh) ob.depthMesh.visible = false; return; }
      if (ob.cut) cutShown(S, ob, seen);
      // (seen edge on, a turned card is a sliver as thin as its corners say: thinner than a pixel or two it fades away)
      let a = fade;
      if (ob.turn) a *= edgeOn(S, ob, cam, r);
      layCard(S, ob, cam, tex, r, m, a);
      ob.shown = { tex, r, frame: S.frameNo };
      if (ob.person) { ob.u.u_aux.value = aux; ob.u.u_aux_on.value = aux ? 1 : 0; }
      if (ob.copy) layCopy(S, ob, a, order);
      if (ob.glass) {
        const u = ob.u, R = ob.mirrorT;
        u.u_strength.value = ob.glass.strength * (1 - S.lit * Math.min(1, S.ambient ?? 1)); u.u_blur.value = ob.glass.blur;
        if (R) { u.u_mc.value = R.textures[0]; u.u_mh.value = R.textures[1]; }
      }
      mesh.visible = a > 0; mesh.renderOrder = order;
      if (ob.depthMesh) { ob.depthMesh.visible = a > 0; ob.depthMesh.renderOrder = order + 0.5; }
      const F = cardFrame(S, ob, cam);
      for (const lt of lights) {
        const [lx, ly] = m === ID ? [lt.x, lt.y] : apply(m, lt.x, lt.y), p = worldAt(F, ob, ID, lx, ly), on = I.glowOn(lt.id);
        glow(SPRITE.glow, p, 2 * lt.r * F.k, lt.c, lt.a * 0.6 * flickerOf(lt, ob.x, ob.y, t) * fade * on, order + 1);
        if (lt.dot) glow(SPRITE.glow, p, 6 * lt.dot * F.k, DOT, 0.9 * fade * on, order + 1);
      }
    }
    // A card with `reflect` (on water — not over a reflecting plane: that mirrors it): a faint copy of it below, mirrored
    // about the ground under its foot, fading away from it
    function layCopy(S, ob, a, order) {
      const u = ob.copy.u, v = ob.u, gy = ob.at.Y - ((ob.o._at?.elevation ?? 0) - (ob.o._at?.ground ?? 0)) / I.EYE;
      if (I.overMirror(S.mirrorPlanes, ob.at)) { ob.copy.m.visible = false; return; }
      const flip = (q, w) => q.set(q.x, w ? 2 * gy - q.y : -q.y, q.z);
      for (const k in v) if (u[k] && k !== 'u_o' && k !== 'u_a' && k !== 'u_b') u[k].value = v[k].value;
      u.u_o.value.copy(v.u_o.value); flip(u.u_o.value, true); u.u_a.value.copy(v.u_a.value); flip(u.u_a.value, false); u.u_b.value.copy(v.u_b.value); flip(u.u_b.value, false);
      u.u_alpha.value = 0.08 * a; u.u_alpha2.value = 0.3 * a; u.u_gp.value.w = 0; u.u_foot.value = 0.5;
      ob.copy.m.visible = a > 0; ob.copy.m.renderOrder = order + 0.75;
    }
    // an unseen element others are cut by: laid as it is seen, never shown (its mask)
    function layUnseen(S, ob, cam, t, order) {
      const seen = ob.seen = cardSeen(S, ob, cam, ID), sh = shownTexture(S, ob, seen, t);
      ob.mesh.visible = false; if (ob.depthMesh) ob.depthMesh.visible = false;
      if (!seen || !sh.tex) return;
      layCard(S, ob, cam, sh.tex, sh.r, ID, I.nearFade(seen.D));
      ob.mesh.renderOrder = order;
      ob.shown = { tex: sh.tex, r: sh.r, frame: S.frameNo };
    }
    // Clip: an element seen only within what others paint now (or out of it) — the others drawn into a mask of the
    // frame first (once a frame for all cut by the same ones), as they stand in it; what is cut reads it where it is
    function cuts(S) {
      const masks = new Map();
      for (const ob of S.things) {
        if (!ob.clip || !ob.mesh) continue;
        const key = ob.clip.ids.join('\n');
        if (!masks.has(key)) {
          const M = (S.cutMasks ||= new Map()).get(key) || S.cutMasks.set(key, new T3.WebGLRenderTarget(S.CW, S.CH, { depthBuffer: false, generateMipmaps: false })).get(key);
          if (M.width !== S.CW || M.height !== S.CH) M.setSize(S.CW, S.CH);
          const ids = new Set(ob.clip.ids.map(String)), shown = [];
          for (const x of scene.children) if (x.visible) { x.visible = false; shown.push(x); }
          for (const o2 of S.things) if (ids.has(String(o2.o?.id)) && o2.mesh && o2.shown?.frame === S.frameNo) o2.mesh.visible = true;
          for (const o2 of S.things) if (ids.has(String(o2.o?.id))) for (const part of o2.parts || []) if (part.mesh && part.shown?.frame === S.frameNo) part.mesh.visible = true;
          renderer.setRenderTarget(M);
          renderer.setClearColor(0x000000, 0);
          renderer.clear(true, false, false);
          renderer.render(scene, camera);
          for (const o2 of S.things) if (ids.has(String(o2.o?.id))) { if (o2.mesh) o2.mesh.visible = false; for (const part of o2.parts || []) if (part.mesh) part.mesh.visible = false; }
          for (const x of shown) x.visible = true;
          masks.set(key, M.texture);
        }
        ob.u.u_cut.value = ob.clip.inside ? 1 : 2; ob.u.u_cutby.value = masks.get(key);
        for (const part of ob.parts || []) if (part.u) { part.u.u_cut.value = ob.u.u_cut.value; part.u.u_cutby.value = masks.get(key); }
      }
    }
    function edgeOn(S, ob, cam, r) {
      const F = cardFrame(S, ob, cam), q = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]].map(([x, y]) => I.project(cam, ...worldAt(F, ob, ID, x, y), S.W, S.H, S.yh));
      if (!q.every(Boolean)) return 1;
      const area = Math.abs(q.reduce((s, c, i) => { const d = q[(i + 1) % 4]; return s + c[0] * d[1] - d[0] * c[1]; }, 0)) / 2;
      const side = Math.max(...q.map((c, i) => Math.hypot(q[(i + 1) % 4][0] - c[0], q[(i + 1) % 4][1] - c[1])));
      return Math.min(1, Math.max(0, (area / Math.max(side, 1e-6) - 0.5) / 2));
    }
    // the edges an element's painting is cut off at by its box, in the frame now: said
    function cutShown(S, ob, seen) {
      const v = seen.v, b = { x: ob.bx, y: ob.by, w: ob.bw, h: ob.bh }, shown = [v.x <= b.x + 1, v.y <= b.y + 1, v.x + v.w >= b.x + b.w - 1];
      ob.cut.forEach((c, i) => { if (c && shown[i]) I.warn(`${ob.o.name || ob.o.id}: its painting is cut off by its box at the ${EDGES[i]} edge, in the frame — widen its "box"`); });
    }
    // a plane's glows (its e.light), where they lie
    function planeGlows(S, ob, cam, t, order) {
      if (ob.plane.travel) return;
      for (const lt of ob.live?.r ? ob.live.lights : ob.lights) {
        const q = lightPlace(S, ob, lt), on = I.glowOn(lt.id);
        glow(SPRITE.glow, q.at, q.reach, lt.c, lt.a * 0.6 * flickerOf(lt, 0, 0, t) * on, order);
        if (lt.dot) glow(SPRITE.glow, q.at, 3 * lt.dot / lt.r * q.reach, DOT, 0.9 * on, order);
      }
    }
    // the light in the air: a source's halo (`glow`), or the haze lit round a point source (hazeGlow)
    function halo(S, { h, fog }, cam, t, order) {
      const D = I.project(cam, ...h.at, S.W, S.H, S.yh)?.[2];
      if (!D) return;
      const c = h.rgb.map(v => v / 255);
      if (fog) { glow(SPRITE.glow, h.at, 2 * h.reach, c, I.airGlow(S.look, h, D, t), order); return; }
      const a = Math.min(1, h.strength) * I.flickerNow(h, t);
      glow(SPRITE.glow, h.at, 2 * h.halo, c, 0.6 * a, order);
      glow(SPRITE.glow, h.at, 0.5 * h.halo, DOT, 0.8 * a, order);
    }
    // a sky element: its painting round the eye (live: repainted when due — painted whole, it is seen whole), and its
    // glows (the sun's) on the frame where it paints them
    function laySky(S, ob, cam, t, order) {
      let tex = ob.base.tex, r = ob.baseRegion, lights = ob.lights;
      if (ob.live) {
        const whole = { x: ob.bx, y: ob.by, w: ob.bw, h: ob.bh }, k = liveScale(S, whole, S.H / S.PH, !ob.live.stateOnly);
        if (stale(ob, k, whole, S.frameNo)) repaint(S, ob, k, t, whole);
        tex = ob.live.holder.tex; r = ob.live.r; lights = ob.live.lights;
      }
      const u = ob.u, s = S.H / S.PH, pan = (cam.pan || 0) * S.H;
      u.u_tex.value = tex;
      // (where its painting is on the frame as the start sees it: the stage centred in the frame)
      u.u_r.value.set(r.x * s + (S.round ? 0 : (S.W - S.SW * s) / 2), r.y * s, r.w * s, r.h * s);
      u.u_look.value = cam.y * S.H; u.u_pan.value = pan; u.u_wrap.value = I.TAU * S.H; u.u_yaw.value = cam.yaw || 0; u.u_hz.value = S.yh * S.H;
      u.u_rect.value.set(-S.OX, -S.OY, S.CW, S.CH);
      ob.mesh.renderOrder = order;
      // its glows: far off, where the start's eye sees them painted
      for (const lt of lights) {
        const on = I.glowOn(lt.id), at = skyPoint(S, lt.x * s + (S.round ? 0 : (S.W - S.SW * s) / 2), lt.y * s);
        glow(SPRITE.glow, at.p, 2 * lt.r * s * at.k, lt.c, lt.a * 0.6 * flickerOf(lt, 0, 0, t) * on, order + 1);
        if (lt.dot) glow(SPRITE.glow, at.p, 6 * lt.dot * s * at.k, DOT, 0.9 * on, order + 1);
      }
    }
    // a point of the sky (frame px as the start sees it — looking around, its column of the full circle) as a point
    // far off in the world (SKY_D eye heights along the start's view of it), and how many eye heights a px is there
    const SKY_D = 1e4;
    function skyPoint(S, x, y) {
      const up = (S.yh * S.H - y) / S.H, dir = S.round ? (b => [Math.sin(b), up, Math.cos(b)])(x / S.H - Math.PI) : [(x - S.W / 2) / S.H, up, 1];
      const k = SKY_D / Math.hypot(dir[0], dir[2]);
      return { p: [dir[0] * k, 1 + dir[1] * k, dir[2] * k], k: k / S.H };
    }
    function layInsert(S, ob, t, order) {
      const open = I.opening(ob.o);
      ob.mesh.visible = open >= 0.002;
      if (!ob.mesh.visible) return;
      const whole = { x: ob.bx, y: ob.by, w: ob.bw, h: ob.bh }, k = liveScale(S, whole, S.H / S.PH, !ob.live.stateOnly);
      if (stale(ob, k, whole, S.frameNo)) repaint(S, ob, k, t, whole);
      const s = S.H / S.PH, r = ob.live.r;
      ob.u.u_tex.value = ob.live.holder.tex;
      ob.u.u_rect.value.set(r.x * s + (S.W - S.SW * s) / 2, r.y * s, r.w * s, r.h * s);
      ob.mesh.renderOrder = order;
    }
    // A lit scene's bounced light's pass (BOUNCE_FS) into S.bounce: how much it bounces now (0: none — not lit, none set)
    const BOUNCE_K = 4;
    const bouncePass = (() => {
      const u = { u_scene: { value: null }, u_given: { value: null }, u_kept: { value: null }, u_albedo: { value: null }, u_depth: { value: null }, u_shaded: { value: 0 } };
      const m = new T3.Mesh(QUAD, new T3.RawShaderMaterial({ glslVersion: T3.GLSL3, vertexShader: BOUNCE_VS, fragmentShader: BOUNCE_FS, uniforms: u, depthTest: false, depthWrite: false, blending: T3.NoBlending }));
      m.frustumCulled = false;
      const pass = new T3.Scene();
      pass.add(m);
      return { u, pass };
    })();
    function bounced(S, lt) {
      const bounce = S.target.textures.length > 2 && lt.bounce > 0 ? lt.bounce * lt.lit : 0;
      if (!bounce) return 0;
      const bw = Math.ceil(S.CW / BOUNCE_K), bh = Math.ceil(S.CH / BOUNCE_K);
      if (S.bounce?.width !== bw || S.bounce?.height !== bh) {
        S.bounce?.dispose();
        S.bounce = new T3.WebGLRenderTarget(bw, bh, { count: 2, type: T3.HalfFloatType, depthBuffer: false, generateMipmaps: true, minFilter: T3.LinearMipmapLinearFilter, magFilter: T3.LinearFilter });
      }
      const u = bouncePass.u;
      u.u_scene.value = S.target.textures[0]; u.u_albedo.value = S.target.textures[2]; u.u_depth.value = S.target.depthTexture;
      u.u_shaded.value = S.shaded ? 1 : 0; u.u_given.value = S.target.textures[1]; u.u_kept.value = S.kept?.texture ?? null;
      renderer.setRenderTarget(S.bounce);
      renderer.render(bouncePass.pass, camera);
      return bounce;
    }
    // the grade into the canvas
    const post = (() => {
      const u = { u_scene: { value: null }, u_given: { value: null }, u_kept: { value: null }, u_shaded: { value: 0 }, u_albedo: { value: null }, u_depth: { value: null }, u_bt: { value: null }, u_bn: { value: null }, u_bounce: { value: 0 }, u_blod: { value: 0 }, u_brad: { value: new T3.Vector2() }, u_from: { value: new T3.Vector2() }, u_tint: { value: new T3.Vector3(1, 1, 1) }, u_fadeCol: { value: new T3.Vector3() }, u_tintA: { value: 0 }, u_vig: { value: 0 }, u_grain: { value: 0 }, u_seed: { value: 0 }, u_fade: { value: 0 }, u_bright: { value: 1 }, u_sat: { value: 1 } };
      const m = new T3.Mesh(QUAD, raw(POST_VS, POST_FS, u, { depthTest: false, transparent: false, blending: T3.NoBlending }));
      m.frustumCulled = false;
      const pass = new T3.Scene();
      pass.add(m);
      return Object.assign((S, lt, t) => {
        u.u_scene.value = S.target.textures[0];
        u.u_shaded.value = S.shaded ? 1 : 0;
        if (S.shaded) { u.u_given.value = S.target.textures[1]; u.u_kept.value = S.kept.texture; }
        const bounce = bounced(S, lt);
        u.u_bounce.value = bounce;
        if (bounce) {
          // (read about a point as far as a seventh of the frame's height, at the level that blurs it so)
          const R = S.H / 7;
          u.u_albedo.value = S.target.textures[2]; u.u_depth.value = S.target.depthTexture;
          u.u_bt.value = S.bounce.textures[0]; u.u_bn.value = S.bounce.textures[1];
          u.u_blod.value = Math.max(0, Math.log2(R / BOUNCE_K)); u.u_brad.value.set(R / S.CW, R / S.CH);
        }
        u.u_tint.value.set(...(lt.tint ? lt.tint.map(v => v / 255) : WHITE)); u.u_tintA.value = lt.tint ? I.clamp(lt.tintStrength, 0, 0.5) : 0;
        u.u_vig.value = 0.75 * I.clamp(lt.vignette, 0, 1); u.u_grain.value = 0.1 * I.clamp(lt.grain, 0, 1);
        u.u_bright.value = Math.max(0, lt.brightness); u.u_sat.value = Math.max(0, lt.saturation); u.u_seed.value = Math.floor(Math.random() * 4096);
        const sv = I.STATE.values;
        u.u_fade.value = typeof sv.fade === 'number' ? I.clamp(sv.fade, 0, 1) : 0;
        u.u_fadeCol.value.set(...(typeof sv.fade_color === 'string' ? col(sv.fade_color) : [0, 0, 0]));
        u.u_from.value.set(S.OX, S.CH - S.OY - S.H);
        renderer.setRenderTarget(null);
        renderer.render(pass, camera);
      }, { pass });
    })();

    // A frame unseen (engine.js: stage.draw(false)): nothing painted, nothing drawn
    function tick(S) { S.frameNo++; }

    // the passes a frame of S goes through besides its scene (their programs compiled with its before it is first drawn):
    // its shadows' (one of them for their program) and their laying, the light bounced, the grade
    const shadowWarm = new T3.Scene();
    function passesOf(S) {
      shadowWarm.clear();
      if (S.shadows.length) shadowWarm.add(new T3.Mesh(QUAD, shadowMaterial()));
      return [...(S.shadows.length ? [shadowWarm, shade.pass] : []), ...(S.target.textures.length > 2 ? [bouncePass.pass] : []), post.pass];
    }
    // what the scene drawn is still waiting for before it is (its programs: frame) — a promise, or null
    const warming = S => (!S || S.warm === true ? null : S.warm || new Promise(r => requestAnimationFrame(r)));
    return { name: 'three', fpsIdle: 60, pixelBudget: Infinity, resMax: 2, build, frame, tick, warming };
  }

  return { create };
})();
