// Views (RN5, SH10, 4.1): a camera something is drawn or asked through this tick — the frame's, a shot's ahead, the
// pose the camera moves to, a mirror's, a light's. A view is SHEETS' View (what `sheets.ask` takes: R keeps one object
// a view while the view exists) with RENDER's own part under `e`: its frustum, and — for a view something is drawn
// through — its uniform (group 1 binding 0) and its lists.
//   Of a View's fields `bias`, `drawn` and `entered` are SHEETS' (written in `ask`: R copies `drawn` — the bias the
// view is drawn at — into the uniform and writes none of them); `fresh` R's: true where a view begins — as it is made,
// and the frame's at a new shot — until its next ask.
//   `changed` (SH10: what of the view itself is another than at its last ask) is worked out the same way for every
// view, where it is asked (render/renderer.js): from what `e` keeps of its last ask — its camera (`was`), its size.
// A view that is only asked is culled again only when what a cull reads changed — its camera, its size, how far the
// land goes up and down (a draped quad's sphere), the look (the wind's bound of a quad's sphere), or a row of the
// world that is its matter (render/quads.js `changes`): `e` keeps those of its last cull too (`seen`, the size, the
// land's reach, the look's stamp) and, of the last call it was looked at in, the rows' stamp and the tick.
//   What is asked of a view's frustum — sees, ahead, pxAt, clip, covers — are functions of this module that take the
// view's `e`, ONE each for every view: a function made anew with each view is another function to the engine at
// every place it is called from, is not worked into the caller, and its fraction handed back is made on the heap
// (5.16) — with thirty views of shots ahead, at every quad of every cull. (`e.sees` alone is also the view's own: what
// PEOPLE's draw is handed.)
//   A Camera (RN5): eye (world metres, doubles), rot (world → eye, column-major; the eye looks down −z, +y up), proj
// (eye → clip, column-major, depth reversed: near → 1, far → 0; a perspective's far plane at infinity), yaw, ortho.
// `proj` maps onto the view's own rectangle: the frame's, `toward`'s and a shot's onto the whole canvas (the safe rect
// inside it is `stage`: where an insert lies — the view's own, f.stage). R makes its own for mirrors and lights in the
// same form.
//   A mirror's camera is the eye mirrored about the plane, its near plane laid MIRROR.OVER over the mirror (an
// oblique projection: what is behind the mirror — and what lies level with it — is clipped by the clip volume itself:
// no clip distances, no discard), its picture cut to what the mirror covers of the frame and its margin
// (cropCamera); its winding is turned (people's mirrored pipelines; quads have no face).
import { MIRROR } from '../base.js';
import { VIEWU } from './wgsl/frame.js';
import { viewLists } from './quads.js';

// (a view that asks no insert: no safe rect)
const NO_STAGE = new Float64Array(4);
// (one shape for every camera, RENDER's and the camera module's — `pose`: that module's own, null here: where cameras
// of two shapes pass, their fractions are made on the heap where they are read — 5.16)
export function newCamera(ortho = false) { return { eye: new Float64Array(3), rot: new Float32Array(9), proj: new Float32Array(16), yaw: 0, ortho, pose: null }; }
export function copyCamera(a, out) { out.eye.set(a.eye); out.rot.set(a.rot); out.proj.set(a.proj); out.yaw = a.yaw; out.ortho = a.ortho; return out; }
// whether two cameras stand at one place; … are turned one way and have one lens (the turn, the projection)
export function sameEye(a, b) {
  for (let k = 0; k < 3; k++) if (a.eye[k] !== b.eye[k]) return false;
  return true;
}
export function sameTurn(a, b) {
  if (a.yaw !== b.yaw || a.ortho !== b.ortho) return false;
  for (let k = 0; k < 9; k++) if (a.rot[k] !== b.rot[k]) return false;
  for (let k = 0; k < 16; k++) if (a.proj[k] !== b.proj[k]) return false;
  return true;
}
export const sameCamera = (a, b) => sameEye(a, b) && sameTurn(a, b);
// world → eye for an eye that looks along `way` (unit) with `up` about up: column-major
export function lookRot(way, up, rot) {
  let rx = way[1] * up[2] - way[2] * up[1], ry = way[2] * up[0] - way[0] * up[2], rz = way[0] * up[1] - way[1] * up[0];
  const rl = Math.sqrt(rx ** 2 + ry ** 2 + rz ** 2) || 1;
  rx /= rl; ry /= rl; rz /= rl;
  const ux = ry * way[2] - rz * way[1], uy = rz * way[0] - rx * way[2], uz = rx * way[1] - ry * way[0];
  // (rows: right, up, −way)
  rot[0] = rx; rot[3] = ry; rot[6] = rz;
  rot[1] = ux; rot[4] = uy; rot[7] = uz;
  rot[2] = -way[0]; rot[5] = -way[1]; rot[8] = -way[2];
  return rot;
}
// a perspective whose half height a metre away is `tan`, depth reversed, the far plane at infinity
export function perspective(tan, aspect, near, proj) {
  proj.fill(0);
  proj[0] = 1 / (tan * aspect); proj[5] = 1 / tan; proj[11] = -1; proj[14] = near;
  return proj;
}
// an orthographic box about the eye's axis: half its width and height, its depths from near to far, reversed
export function orthographic(halfW, halfH, near, far, proj) {
  proj.fill(0);
  proj[0] = 1 / halfW; proj[5] = 1 / halfH; proj[10] = 1 / (far - near); proj[14] = far / (far - near); proj[15] = 1;
  return proj;
}
// the camera of the eye mirrored about the plane (nx, ny, nz, d: n · P + d = 0, n toward the eye's side)
export function mirrorCamera(camera, plane, out) {
  const nx = plane[0], ny = plane[1], nz = plane[2], d = plane[3], e = camera.eye, k = 2 * (nx * e[0] + ny * e[1] + nz * e[2] + d), R = camera.rot, M = out.rot;
  out.eye[0] = e[0] - k * nx; out.eye[1] = e[1] - k * ny; out.eye[2] = e[2] - k * nz;
  // (rot · (I − 2 n nᵀ))
  for (let r = 0; r < 3; r++) {
    const dot = R[r] * nx + R[3 + r] * ny + R[6 + r] * nz;
    M[r] = R[r] - 2 * dot * nx; M[3 + r] = R[3 + r] - 2 * dot * ny; M[6 + r] = R[6 + r] - 2 * dot * nz;
  }
  out.proj.set(camera.proj); out.yaw = camera.yaw; out.ortho = camera.ortho;
  // the plane MIRROR.OVER over the mirror (on the eye's side of it: what lies level with a mirror is not in it), in
  // the mirrored eye's space; the depth's row laid on it: z' = w − s · (C · P), at the plane the nearest
  const cx = M[0] * nx + M[3] * ny + M[6] * nz, cy = M[1] * nx + M[4] * ny + M[7] * nz, cz = M[2] * nx + M[5] * ny + M[8] * nz;
  const cw = nx * out.eye[0] + ny * out.eye[1] + nz * out.eye[2] + d - MIRROR.OVER;
  // (s: so small that the farthest corner of the picture — of a lens off its middle too — keeps a depth above 0)
  const p = out.proj, ax = (1 + Math.abs(p[8])) / p[0], ay = (1 + Math.abs(p[9])) / p[5], s = 0.9 / Math.sqrt(1 + ax * ax + ay * ay);
  p[2] = -s * cx; p[6] = -s * cy; p[10] = -1 - s * cz; p[14] = -s * cw;
  return out;
}
// a camera's picture cut to a part of it — clip x from x0 to x1, y from y0 to y1 become −1 … 1 (its depths as they are)
export function cropCamera(camera, x0, y0, x1, y1) {
  const p = camera.proj, sx = 2 / (x1 - x0), sy = 2 / (y1 - y0), cx = 0.5 * (x0 + x1), cy = 0.5 * (y0 + y1);
  for (let c = 0; c < 4; c++) { p[4 * c] = (p[4 * c] - cx * p[4 * c + 3]) * sx; p[4 * c + 1] = (p[4 * c + 1] - cy * p[4 * c + 3]) * sy; }
  return camera;
}

// the camera's view and projection as one matrix of the world less the origin (column-major, into out at o)
export function viewProj(camera, origin, out, o = 0) {
  const R = camera.rot, p = camera.proj, ex = camera.eye[0] - origin[0], ey = camera.eye[1] - origin[1], ez = camera.eye[2] - origin[2];
  // (the view: [R | −R · eye]; column c of the product is proj · (the view's column c))
  for (let c = 0; c < 4; c++) {
    const vx = c < 3 ? R[3 * c] : -(R[0] * ex + R[3] * ey + R[6] * ez), vy = c < 3 ? R[3 * c + 1] : -(R[1] * ex + R[4] * ey + R[7] * ez), vz = c < 3 ? R[3 * c + 2] : -(R[2] * ex + R[5] * ey + R[8] * ez), vw = c < 3 ? 0 : 1;
    for (let r = 0; r < 4; r++) out[o + 4 * c + r] = p[r] * vx + p[4 + r] * vy + p[8 + r] * vz + p[12 + r] * vw;
  }
  return out;
}

// the sides of a view's frustum, as rows of its projection summed: (the row, its sign) — left, right, bottom, top, near
const SIDES = [0, 1, 0, -1, 1, 1, 1, -1, 2, -1];

// whether a sphere (x, y, z, radius: the world's) meets the view (e: a view's `e`, placed)
export function sees(e, S) {
  const planes = e.planes, eye = e.eye, x = S[0] - eye[0], y = S[1] - eye[1], z = S[2] - eye[2];
  for (let k = 0; k < e.planesN; k++) if (planes[4 * k] * x + planes[4 * k + 1] * y + planes[4 * k + 2] * z + planes[4 * k + 3] < -S[3]) return false;
  return true;
}
// how far before the eye a point is, along its gaze → out[o] (no fraction is handed back: 5.16)
export function ahead(e, S, out, o) { const eye = e.eye, fwd = e.fwd; out[o] = (S[0] - eye[0]) * fwd[0] + (S[1] - eye[1]) * fwd[1] + (S[2] - eye[2]) * fwd[2]; }
// px a metre at the depth A[o] before the eye (taken as 0.1 m at the least) → A[o] (no fraction handed over or back: 5.16)
export function pxAt(e, A, o) { const depth = Math.max(A[o], 0.1); A[o] = e.ortho ? 0.5 * e.height / e.tan : 0.5 * e.height / (e.tan * Math.max(depth, 1e-3)); }
// a point of the world → the view's clip space: (x, y, z, w) into out at o
export function clip(e, P, out, o) {
  const R = e.rot, p = e.proj, eye = e.eye, x = P[0] - eye[0], y = P[1] - eye[1], z = P[2] - eye[2];
  const ex = R[0] * x + R[3] * y + R[6] * z, ey = R[1] * x + R[4] * y + R[7] * z, ez = R[2] * x + R[5] * y + R[8] * z;
  out[o] = p[0] * ex + p[4] * ey + p[8] * ez + p[12]; out[o + 1] = p[1] * ex + p[5] * ey + p[9] * ez + p[13];
  out[o + 2] = p[2] * ex + p[6] * ey + p[10] * ez + p[14]; out[o + 3] = p[3] * ex + p[7] * ey + p[11] * ez + p[15];
}
// What a sphere covers of the view → out (x0, y0, x1, y1: clip −1 … 1, kept within the view); false: nothing.
// Exact for a sphere wholly before the eye; the whole view for one the eye is in or beside
export function covers(e, S, out) {
  if (!sees(e, S)) return false;
  const R = e.rot, p = e.proj, eye = e.eye, x = S[0] - eye[0], y = S[1] - eye[1], z = S[2] - eye[2], r = S[3];
  const cx = R[0] * x + R[3] * y + R[6] * z, cy = R[1] * x + R[4] * y + R[7] * z, d = -(R[2] * x + R[5] * y + R[8] * z);
  out[0] = -1; out[1] = -1; out[2] = 1; out[3] = 1;
  if (e.ortho) {
    out[0] = Math.max(-1, p[0] * (cx - r) + p[12]); out[2] = Math.min(1, p[0] * (cx + r) + p[12]);
    out[1] = Math.max(-1, p[5] * (cy - r) + p[13]); out[3] = Math.min(1, p[5] * (cy + r) + p[13]);
  } else if (d > r + 0.1) {
    // (across, then up: the two rays from the eye that touch it, in the plane of the gaze and that way)
    const k = d * d - r * r, ax = r * Math.sqrt(cx * cx + k), ay = r * Math.sqrt(cy * cy + k);
    out[0] = Math.max(-1, p[0] * (cx * d - ax) / k - p[8]); out[2] = Math.min(1, p[0] * (cx * d + ax) / k - p[8]);
    out[1] = Math.max(-1, p[5] * (cy * d - ay) / k - p[9]); out[3] = Math.min(1, p[5] * (cy * d + ay) / k - p[9]);
  }
  return out[2] > out[0] && out[3] > out[1];
}

// A view. drawn: something is drawn through it — it has a uniform and lists; a view that is only asked (a shot's
// ahead, the pose the camera moves to) has neither
export function createView(gpu, kind, drawn = true) {
  const data = drawn ? new ArrayBuffer(VIEWU.BYTES) : null, f32 = drawn ? new Float32Array(data) : null, u32 = drawn ? new Uint32Array(data) : null;
  const planes = new Float64Array(24), eye = new Float64Array(3), fwd = new Float64Array(3);
  const e = {
    kind, buffer: drawn ? gpu.buffer(`view ${kind}`, VIEWU.BYTES, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST) : null, group: null, groupOf: null, groupWith: null, cast: null,
    lists: drawn ? viewLists() : null, eye, fwd,
    // its frustum as it was placed: the sides (their planes about the eye, how many), the camera's turn and lens
    // (kept by reference this tick), half its height a metre away, its height in px, whether it is orthographic (a
    // perspective has a fifth side that cuts what it shows: its near plane)
    planes, planesN: 0, rot: null, proj: null, tan: 1, height: 1, ortho: false,
    // of its last ask: its camera, its size, world.tick of that call (the stand's: what was stamped
    // since); of the last cull of a view that is only asked, what it was culled with: the camera, the size, the
    // land's reach, the look's stamp — and of the last call it was looked at in: the rows' stamp, world.tick
    was: newCamera(), wasW: 0, wasH: 0, tick: 0, seen: newCamera(), seenW: 0, seenH: 0, seenRows: -1, seenTick: 0, seenTall: -1, seenLook: -1,
    // (press: the cache's pressure its last ask was told — its bias less its own `coarser` then)
    press: 0,
    // a view of a world that is another: nothing is kept of its last ask, of its last cull
    anew() { e.tick = 0; e.wasW = 0; e.seenW = 0; e.press = 0; },
    // whether a sphere meets the view — the view's own, for PEOPLE's draw (everyone else: sees(e, S))
    sees: S => sees(e, S),
  };
  // (a side of the frustum, given in the eye's space, turned into the world about the eye)
  const add = (a, b, c, d) => {
    const l = Math.sqrt(a ** 2 + b ** 2 + c ** 2), R = e.rot;
    if (l < 1e-12) return;
    const o = 4 * e.planesN++;
    planes[o] = (R[0] * a + R[1] * b + R[2] * c) / l; planes[o + 1] = (R[3] * a + R[4] * b + R[5] * c) / l; planes[o + 2] = (R[6] * a + R[7] * b + R[8] * c) / l; planes[o + 3] = d / l;
  };
  // (`_cull`: R's, of a view culled in every call — there from the first, so every view has one shape; `stage`: the
  // safe rect in its clip space — a view that asks inserts is given f.stage)
  const view = { world: null, camera: null, width: 1, height: 1, stage: NO_STAGE, weight: 1, coarser: 0, inserts: false, list: new Int32Array(256), n: 0, over: null, overN: 0, ahead: false,
    nodes: null, nodeOf: null, nodesN: 0, changed: 0, bias: 0, drawn: 0, entered: 0, fresh: true, _: null, _cull: null, e };

  // the view placed: its camera (kept by reference this tick), its viewport's px; its frustum worked out
  e.place = (world, camera, width, h) => {
    view.world = world; view.camera = camera; view.width = width; view.height = h;
    const R = camera.rot, p = camera.proj;
    e.height = h; e.ortho = !!camera.ortho; e.rot = R; e.proj = p;
    eye.set(camera.eye);
    fwd[0] = -R[2]; fwd[1] = -R[5]; fwd[2] = -R[8];
    e.tan = 1 / p[5];
    // the planes, in the eye's space, as sums of the projection's rows: left, right, bottom, top, near (z ≤ w), and —
    // where the far plane is not at infinity — far (z ≥ 0); then turned into the world (about the eye)
    e.planesN = 0;
    for (let k = 0; k < SIDES.length; k += 2) {
      const i = SIDES[k], s = SIDES[k + 1];
      add(p[3] + s * p[i], p[7] + s * p[4 + i], p[11] + s * p[8 + i], p[15] + s * p[12 + i]);
    }
    if (e.ortho) add(p[2], p[6], p[10], p[14]);
  };
  // its uniform written (4.1): the camera less the origin, its viewport, its flags; RENDER's own after — a mirror's
  // plane and fade, a light's way or place, the frame's safe rect (stage: f.stage; none in another view); bias: the
  // bias SHEETS has the view its sheets were asked through drawn at (`drawn` — its own; a light's movers' view: its
  // static cell's)
  e.write = (origin, flags, mirror, fade, light, bias, stage = null) => {
    const c = view.camera;
    f32.set(c.proj, 0);
    for (let k = 0; k < 3; k++) { f32[16 + 4 * k] = c.rot[3 * k]; f32[17 + 4 * k] = c.rot[3 * k + 1]; f32[18 + 4 * k] = c.rot[3 * k + 2]; }
    f32[28] = c.eye[0] - origin[0]; f32[29] = c.eye[1] - origin[1]; f32[30] = c.eye[2] - origin[2]; f32[31] = c.yaw;
    f32[32] = view.width; f32[33] = view.height; f32[34] = bias; u32[35] = flags;
    for (let k = 0; k < 4; k++) { f32[36 + k] = mirror ? mirror[k] : 0; f32[44 + k] = light ? light[k] : 0; }
    // (a mirror's plane is told less the origin: its d moved by n · origin)
    if (mirror) f32[39] = mirror[3] + mirror[0] * origin[0] + mirror[1] * origin[1] + mirror[2] * origin[2];
    if (light && light[3] > 0.5) { f32[44] -= origin[0]; f32[45] -= origin[1]; f32[46] -= origin[2]; }
    f32[40] = fade; f32[41] = 0; f32[42] = 0; f32[43] = 0;
    for (let k = 0; k < 4; k++) f32[48 + k] = stage ? stage[k] : 0;
    gpu.write(e.buffer, 0, data);
  };
  e.drop = () => { if (drawn) gpu.drop(e.buffer); };
  return view;
}
