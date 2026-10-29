// The camera: how the viewer moves through the scene (spec.camera's mode), how a film's operator frames what it is
// told to (camera_target, camera_shot, camera_frame, camera_glide), the camera_* keys over both, cuts and the cameras
// of shots made ready ahead — into RN5's Camera, which the renderer draws with (f.camera, f.toward, a shot's).
//   The lens: the frame's height is its focal length (a vertical field of 2·atan(0.5)), the eye's line at `horizon` on
// the frame; looking up and down (the gaze, camera_look, camera_pitch) shifts the lens, the camera never pitches —
// what stands stays upright; it turns about the vertical (yaw) and, camera_roll, about its axis (the picture tipped, a
// little closer to fill the frame). The frame is the SAFE rect (RN5): the stage's 4:3…21:9 as the canvas's shape has
// it, fitted whole in the middle of the canvas — where the story is framed, the viewer's limits and the controls are;
// its height is the focal length. The projection maps onto the whole canvas (`seen`) with that focal length and that
// principal point: clip ±1 are the canvas's edges, and all of it is projected, asked and drawn — the world goes on past
// the safe rect, never stretched. One projection: WebGPU clip space, depth reversed, the near plane at 0.1 m, the far
// at infinity.
//   A pose: { x (metres across), z (metres ahead), h (the eye's height, metres), look (screen heights the gaze is
// lowered), yaw (radians to the right) } — in the frame of what the camera rides (the scene's "camera".on, the film's
// camera_on: what that element carries is placed in — its anchor and its turn about the vertical, level; the eye's
// height over its face under it), else the world's (the start; the eye's height over the land under it, a water
// surface over that, a walk plane over those — never under the water). Where one may go, the operator and the camera_*
// keys all work in that frame; only the lens, and what asks the world (a ray, a target's point), pass
// between it and the world. Three of them: the viewer's own (target, and cam easing to it), the operator's (op.pose:
// the scene's start pose moved to frame a target — its h over the eye's level 0, not over what is under it: its glide
// goes level over a river between a quay and a bridge's road), and the one shown (shown: cam + the lean + the operator
// + the camera_* keys).
//   Viewer: drag — step aside and turn the head up and down (looking round: turn it about), keeping what was taken hold
// of under the finger (along a panorama, his way aside and camera_x together within its span; the scene's move of
// camera_x carries his way aside along — below, `carry`); the wheel and a pinch walk toward what is under the pointer
// (a ray: world.raycast — else a few steps ahead), stopping where it about fills the frame; keys (A D ← → aside, W S ↑
// ↓ ahead; looking round they turn, roaming they walk); the lean toward the pointer or as the phone is held; `follow` —
// the elements kept in view as one walks; a platformer — the hero run and jumped over the solids.
//   f.toward (RN4): where the camera will be host.ahead seconds on, along a path the engine knows — the viewer's ease
// to the target he set (and back after he lets go), his glide, his way aside carried by a move of camera_x, the
// operator's glide, the camera keys moved over time (the director's moves: world.moves.ahead) — as a Camera of its own,
// so its pages are asked while it travels. A target is taken where it is now (a walk is not foreseen), the operator's
// way round as it stands (no rays of its own). It is placed again only by scene time — every host.ahead / 2 —, and at
// once as it begins, at a new shot and when the set of the director's running camera moves changes: between, it stands.
// A picture's breath and lean and a platformer's run are no known path.
import { PASS } from '../base.js';
import { EYE, STAGE, NARROWEST, WIDEST, Z_FAR } from '../world/spec.js';
import { newCamera as cameraOf } from '../render/views.js';

const DEG = Math.PI / 180, TAU = 2 * Math.PI;
const NOT_STANDING = new Set(['sky', 'plane', 'insert', 'particles']);
// (what camera_target cannot frame: what is not in the world's space — a plane's point it can, framed as if a person stood there)
const UNFRAMED = new Set(['sky', 'insert', 'particles']);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// where the viewer may look and go: the gaze up and down (screen heights), back from the start (walking it is the
// start), along a panorama (what is this near), roaming (among what is within this of the start)
const LOOK_UP = -0.3, LOOK_DOWN = 0.2, WALK_BACK = -0.6 * EYE, TRACK = 40, ROOM = 30;
// near things fade in the last steps before the eye — from PASS.TO to PASS.FROM metres (base.js: the renderer fades
// by the same two) — and are not shot through nor stood in
// (the nearest a point is placed on the screen: nearer, it is passing the eye)
const NEAREST = 0.3 * PASS.TO + 0.7 * PASS.FROM;
// (the operator on its target: this near where it frames it — metres, screen heights, radians)
const FRAMED = 0.01;
const NEAR = 0.1;
// a picture's breath and lean (metres aside; screen heights up and down), the lean while walking
const SWAY = 0.033 * EYE, SWAY_LOOK = 0.011, LEAN = 0.047;
// the operator: shot sizes (the target's height in frame heights), its glide (seconds), the head's place in the frame
const SHOTS = { wide: 0.3, full: 0.8, medium: 1.6, close: 3.5 }, GLIDE = 1.5;
const HEAD = [[0, 0.5], [0.8, 0.18], [1.6, 0.3], [3.5, 0.38]];
const headAt = shot => {
  let i = 0;
  while (i < HEAD.length && HEAD[i][0] <= shot) i++;
  if (i >= HEAD.length) return HEAD[HEAD.length - 1][1];
  const p = HEAD[i - 1], q = HEAD[i];
  return p[1] + (q[1] - p[1]) * (shot - p[0]) / (q[0] - p[0]);
};
// a clear view (looking round): lines of sight to what of the target the frame holds, the ways round tried (bearings
// either side of a person's face, of the viewer's for a thing, then nearer), how much hidden is too much
const SIGHTS = 5, HIDDEN = 1 / SIGHTS, BEARING = Math.PI / 12, NEARER = [1, 0.8, 0.64, 0.5];
// a person the shot frames, seen from the camera: their points looked at (the head twice: a shot of a person is for
// it), how much of them hidden is said
const SEEN_POINTS = ['head', 'head', 'shoulder_r', 'shoulder_l', 'chest', 'hand_r', 'hand_l', 'hips', 'foot_r', 'foot_l'], HIDDEN_SAID = 1 / 3;
// the viewer over the operator: easing back once let go (seconds), never nearer than this share of the way to the target
const VIEWER_BACK = 0.8, VIEWER_NEAR = 0.5;
// the wheel's aim: kept while the pointer stays within AIM_PX and AIM_MS, by the display callbacks' timestamps
const AIM_PX = 6, AIM_MS = 400;
// a platformer: gravity, running speed, how far below the lowest ledge a fall goes back to the start (metres)
const G = 22, RUN = 5.5, FALL = 5;
export const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's', ' '];
const pose = () => ({ x: 0, z: 0, h: EYE, look: 0, yaw: 0 });
const copy = (to, from) => { to.x = from.x; to.z = from.z; to.h = from.h; to.look = from.look; to.yaw = from.yaw; return to; };
// (a pose's axes each step by name, not by a key: a keyed number is a new one each time)
const ease = (p, to, k) => { p.x += (to.x - p.x) * k; p.z += (to.z - p.z) * k; p.h += (to.h - p.h) * k; p.look += (to.look - p.look) * k; p.yaw += (to.yaw - p.yaw) * k; };
const still = v => { v.x = 0; v.z = 0; v.h = 0; v.look = 0; v.yaw = 0; };
const moves = v => Math.abs(v.x) > 1e-4 || Math.abs(v.z) > 1e-4 || Math.abs(v.h) > 1e-4 || Math.abs(v.look) > 1e-4 || Math.abs(v.yaw) > 1e-4;
const V3 = () => new Float64Array(3);
// (a panorama's span along its things, as it is worked out; how far back and ahead one may stand)
const SPAN = new Float64Array(2), ZR = new Float64Array(2);

// RN5's Camera, with what the camera's own module keeps beside it: pose (where it is in the world: x, z, h, look, yaw,
// roll) — in RN5's one shape of a camera (render/views.js)
export function newCamera() {
  const c = cameraOf(false);
  c.pose = { x: 0, z: 0, h: 0, look: 0, yaw: 0, roll: 0 };
  return c;
}
// where a point of the world is in the place from a Camera: [x, y (CSS px), its depth] into out; null behind the eye
// or faded as it is passed. rect: what the Camera's projection maps onto ({ x, y, w, h }, CSS px of the place) — the
// frame's, `toward`'s and a shot's: the whole canvas (`seen`)
export function project(cam, p, rect, out) {
  const R = cam.rot, dx = p[0] - cam.eye[0], dy = p[1] - cam.eye[1], dz = p[2] - cam.eye[2];
  const ex = R[0] * dx + R[3] * dy + R[6] * dz, ey = R[1] * dx + R[4] * dy + R[7] * dz, depth = -(R[2] * dx + R[5] * dy + R[8] * dz);
  if (depth < NEAREST) return null;
  const P = cam.proj;
  out[0] = rect.x + ((P[0] * ex - P[8] * depth) / depth + 1) / 2 * rect.w; out[1] = rect.y + (1 - (P[5] * ey - P[9] * depth) / depth) / 2 * rect.h; out[2] = depth;
  return out;
}
// … where a direction (a point at infinity: the sky's) is: [x, y, Infinity]; null behind the eye
function projectWay(cam, d, rect, out) {
  const R = cam.rot, ex = R[0] * d[0] + R[3] * d[1] + R[6] * d[2], ey = R[1] * d[0] + R[4] * d[1] + R[7] * d[2], depth = -(R[2] * d[0] + R[5] * d[1] + R[8] * d[2]);
  if (depth < 1e-6) return null;
  const P = cam.proj;
  out[0] = rect.x + ((P[0] * ex - P[8] * depth) / depth + 1) / 2 * rect.w; out[1] = rect.y + (1 - (P[5] * ey - P[9] * depth) / depth) / 2 * rect.h; out[2] = Infinity;
  return out;
}
// the ray from a Camera through a point of the place (CSS px): origin o, unit direction d
function rayOf(cam, x, y, rect, o, d) {
  const P = cam.proj, R = cam.rot, nx = 2 * (x - rect.x) / rect.w - 1, ny = 1 - 2 * (y - rect.y) / rect.h;
  const ex = (nx + P[8]) / P[0], ey = (ny + P[9]) / P[5], ez = -1;
  const wx = R[0] * ex + R[1] * ey + R[2] * ez, wy = R[3] * ex + R[4] * ey + R[5] * ez, wz = R[6] * ex + R[7] * ey + R[8] * ez, l = Math.hypot(wx, wy, wz);
  o[0] = cam.eye[0]; o[1] = cam.eye[1]; o[2] = cam.eye[2];
  d[0] = wx / l; d[1] = wy / l; d[2] = wz / l;
}

// world (world/world.js), state (world/state.js), host: { w, h (the place's CSS px), view — [left, right]: the part of
// the place's width the page leaves seen (its layout: PG4 setView) —, ts — the last display callback's timestamp (ms):
// the viewer's gestures are timed by it —, warn }
export function createCamera(world, state, host) {
  const C = world.C, s = C.camera, yh = C.yh, M = world.tables.nodes;
  const now = () => host.ts;
  // ── what it rides ──
  // the frame the poses are in: { id (the element ridden, or null), x, y, z (its anchor: metres across, up, ahead), turn
  // (radians to the right — going on from where it was: a carrier turning all the way round turns the camera on, no
  // jump at half a turn), c, s (its cosine and sine), gx, gz (its face's slope: metres up a metre of the world's x, of
  // the world's z) } — `here` as the state has it (each step), `there` as a camera made ready will have it; F — the one
  // worked in now
  const frameNow = () => ({ id: null, x: 0, y: 0, z: 0, turn: 0, c: 1, s: 0, gx: 0, gz: 0 });
  const here = frameNow(), there = frameNow(), carriedBy = new Float64Array(12);
  let F = here;
  function ride(get, f) {
    let id = s.mode === 'platform' ? null : get('camera_on') ?? s.on, ok = false;
    if (id === false) id = null;
    if (id != null && !(ok = world.frameOf(id, carriedBy, get))) { host.warn(`camera_on: ${JSON.stringify(id)} — the element the camera rides (one standing in the scene: not the sky, an insert or a person), or false: none`); id = null; }
    f.id = id;
    if (!ok) { f.x = 0; f.y = 0; f.z = 0; f.turn = 0; f.c = 1; f.s = 0; f.gx = 0; f.gz = 0; return f; }
    const m = carriedBy;
    // (its turn about the vertical: its carry frame's +z, levelled — π: toward the start)
    f.x = m[9]; f.y = m[10]; f.z = -m[11]; f.turn = Math.atan2(m[6], -m[8]) - Math.PI; f.turn += TAU * Math.round((here.turn - f.turn) / TAU); f.c = Math.cos(f.turn); f.s = Math.sin(f.turn);
    // (its face, unless it stands too steep to stand on: then level)
    const steep = Math.abs(m[4]) <= 0.2;
    f.gx = steep ? 0 : -m[3] / m[4]; f.gz = steep ? 0 : -m[5] / m[4];
    return f;
  }
  // a point of the frame (x across, h up, z ahead) in the world (into out); a point of the world in the frame (into
  // out: x, y — its height, z — ahead)
  const toWorld = (x, h, z, out) => { out[0] = F.x + x * F.c + z * F.s; out[1] = F.y + h; out[2] = -(F.z + z * F.c - x * F.s); return out; };
  const toFrame = (p, out) => { const dx = p[0] - F.x, dz = -p[2] - F.z, y = p[1] - F.y; out[0] = dx * F.c - dz * F.s; out[2] = dx * F.s + dz * F.c; out[1] = y; return out; };
  // what is under the eye at (x, z) of the frame, over the frame's own level: the face of what it rides; else what the
  // eye stays over — the land, a water surface over it, a walk plane over those (world.standAt) —, over the land and
  // the water at the start. surface: the same without the walk planes (what a target is raised over: below)
  const slope = (x, z) => F.gx * (x * F.c + z * F.s) - F.gz * (z * F.c - x * F.s);
  const floor = (x, z) => (F.id != null ? slope(x, z) : world.standAt(x, z) - world.surfaceAt(0, 0));
  const surface = (x, z) => (F.id != null ? slope(x, z) : world.surfaceAt(x, z) - world.surfaceAt(0, 0));
  // how high a target's base (its root, its anchor: frame metres) is over the land or the water at its own (x, z) —
  // riding, over the face of what is ridden — on a deck, a carrier, a boat: what its operator stands as high over the
  // land or the water under itself (0: standing on it)
  const raised = T => Math.max(0, T.base - (F.id != null ? slope(T.X, T.Z) : world.surfaceAt(T.X, T.Z)));
  const anchor = (el, out) => { const o = 12 * el.node; out[0] = M.m[o + 9]; out[1] = M.m[o + 10]; out[2] = M.m[o + 11]; return out; };

  // ── where one may go ──
  const lim = { aspect: STAGE, reach: null, view: [0, 1], level: null };
  const W = V3(), limits = new Map();
  // what stands round the camera in the frame it is in (riding: what its carrier carries; else all the scene), as it
  // first is there: { things, zMax (how far ahead one walks), room (roaming: [left, right, back, front]) }
  function limitsOf() {
    let L = limits.get(F.id);
    if (L) return L;
    const things = [];
    for (const el of F.id != null ? world.byId.get(F.id).below : world.elements) {
      if (NOT_STANDING.has(el.kind)) continue;
      // (where it stands in the world: what is carried, through what carries it)
      toFrame(anchor(el, W), W);
      things.push({ x: W[0] + (el.box[0] + el.box[2]) / 2, z: W[2] });
    }
    const real = things.filter(t => t.z < Z_FAR * 0.99), around = real.length ? real : things;
    const far = around.length ? Math.max(...around.map(t => t.z)) : EYE;
    L = { things: around, zMax: clamp(far - 1.1 * EYE, EYE, 100 * EYE), room: null };
    if (s.mode === 'roam') {
      if (s.area) { const [l, r, b, f] = s.area; L.room = [-l, r, -b, f]; }
      else {
        const at = around.filter(t => Math.hypot(t.x, t.z) <= ROOM), xs = [0, ...at.map(t => t.x)], zs = [0, ...at.map(t => t.z)];
        L.room = [Math.min(0, Math.min(...xs) + 1), Math.max(0, Math.max(...xs) - 1), Math.min(0, Math.min(...zs) + 1), Math.max(0, Math.max(...zs) - 1)];
      }
    }
    limits.set(F.id, L);
    return L;
  }
  // how far back and ahead (the frame's z) one may stand, not looking round: a panorama from its start on; walking, from
  // the start (else a little behind it) — within the scene's area when it gives one —, as far as what stands in it, or
  // as far as `reach`: where the wheel has walked up to past that (null: nowhere)
  function zRange(reach, out) {
    const zf = Math.max(limitsOf().zMax, reach ?? -Infinity);
    if (s.mode === 'panorama') { out[0] = 0; out[1] = zf; }
    else if (s.area) { out[0] = -s.area[2]; out[1] = s.area[3]; }
    else { out[0] = s.mode === 'walk' ? 0 : WALK_BACK; out[1] = zf; }
    return out;
  }
  // (get: the state the camera keys are read from — as now, or as f.toward has them)
  function limit(c, get = state.value) {
    const L = limitsOf();
    if (s.round) {
      c.look = clamp(c.look, s.look - 0.6, s.look + 0.6);
      if (s.turn) c.yaw = clamp(c.yaw, -s.turn, s.turn);
      if (L.room) { c.x = clamp(c.x, L.room[0], L.room[1]); c.z = clamp(c.z, L.room[2], L.room[3]); } else { c.x = 0; c.z = 0; }
      return;
    }
    if (s.sway) { c.x = clamp(c.x, -SWAY, SWAY); c.z = 0; c.look = clamp(c.look, s.look - SWAY_LOOK, s.look + SWAY_LOOK); return; }
    if (s.mode === 'platform') { c.z = 0; c.look = clamp(c.look, s.look - 0.8, s.look + 0.15); if (lim.level) c.x = clamp(c.x, lim.level[0], lim.level[1]); return; }
    if (s.mode === 'panorama') {
      zRange(lim.reach, ZR);
      c.z = clamp(c.z, ZR[0], ZR[1]);
      c.look = clamp(c.look, s.look + LOOK_UP / 2, s.look + LOOK_DOWN / 2);
      // (the span, kept in an array as the loop widens it: 5.16)
      const span = SPAN;
      if (s.span) { span[0] = s.span[0]; span[1] = s.span[1]; }
      else { span[0] = 0; span[1] = 0; for (let i = 0; i < L.things.length; i++) { const t = L.things[i]; if (t.z <= TRACK) { span[0] = Math.min(span[0], t.x); span[1] = Math.max(span[1], t.x); } } }
      // (his way aside keeps where the view is — it and camera_x together — within the span; camera_x is the scene's
      // word, never held: outside the span, he may only come back toward it — his own place, 0, is always his. A
      // camera_x the film's turn swings round (camera_yaw, the operator's) is taken here as plain x)
      const cx = Number(get('camera_x')) || 0;
      c.x = clamp(c.x, Math.min(0, span[0] - cx), Math.max(0, span[1] - cx));
      return;
    }
    c.look = clamp(c.look, s.look + LOOK_UP, s.look + LOOK_DOWN);
    // where one may stand: what is seen from the back of the bounds — a triangle as wide as the frame (walking toward
    // anything seen never leaves it), within the scene's area when it gives one; walking, the start is the back
    zRange(lim.reach, ZR);
    const zb = ZR[0], lo = s.area ? -s.area[0] : -Infinity, hi = s.area ? s.area[1] : Infinity;
    c.z = clamp(c.z, zb, ZR[1]);
    const hw = Math.max(0, c.z - zb) * lim.aspect / 2;
    c.x = clamp(c.x, Math.max(lo, -hw), Math.min(hi, hw));
  }

  // What is laid wrong for the scene's own camera as it starts (said once, when the scene's first frame is drawn — its
  // paintings are taken then): the ground ending short of the horizon — the sky showing through under it, a light
  // strip — where nothing covers that strip. Seen as the camera sees it: rays from its eye through the strip (rows
  // between the ground's far edge and the horizon, columns across the widest safe frame — where the story is laid out
  // —, then on across what a very wide screen shows round it: WIDE_SCREEN) against what is painted there. Said once, the
  // frame's first; past the frame it is said as what such a screen sees (the world is built, not the frame: LG18).
  // (Not looking round, not on a land: there the land goes on.)
  const STRIP_ROWS = [0.2, 0.5, 0.8], STRIP_COLUMNS = 24, WIDE_SCREEN = 32 / 9;
  function lookOver() {
    if (s.round || world.relief || world.elements.some(el => el.flags.drape)) return;
    // (the eye as it starts and the way it looks, in the world)
    const cx = Number(state.value('camera_x')) || 0, cz = Number(state.value('camera_z')) || 0;
    const o = toWorld(cx, s.h + (Number(state.value('camera_h')) || 0) + floor(cx, cz), cz, V3());
    const ax = Math.sin(F.turn), az = -Math.cos(F.turn), c = V3(), Mm = M.m;
    let far = 0, drop = 0, ground = null;
    for (const el of world.elements) {
      if (el.kind !== 'plane' || el.flags.unseen || ((el.copies ? el.copies[0].tilt : null) ?? el.spec.plane.tilt) || Math.abs(el.spot.elevation) >= 0.2) continue;
      // (its far edge: the farthest of its corners ahead of the eye — and how far under the eye it lies)
      const [l, t, r, b] = el.box, n = 12 * el.node;
      for (const [x, y] of [[l, t], [r, t], [r, b], [l, b]]) {
        c[0] = Mm[n] * x - Mm[n + 3] * y + Mm[n + 9]; c[1] = Mm[n + 1] * x - Mm[n + 4] * y + Mm[n + 10]; c[2] = Mm[n + 2] * x - Mm[n + 5] * y + Mm[n + 11];
        const d = (c[0] - o[0]) * ax + (c[2] - o[2]) * az;
        if (d > far) { far = d; drop = o[1] - c[1]; ground = el; }
      }
    }
    if (!ground) return;
    // (where its far edge is on the frame, below the eye's line: frame heights)
    const edge = drop / far;
    if (edge * 1000 <= 2) return;
    const d = V3(), ct = Math.cos(F.turn), sn = Math.sin(F.turn), name = ground.spec.name || ground.id || 'the ground';
    // (whether nothing of the world is painted under the horizon at x — frame heights right of the middle — on row v)
    const open = (x, v) => {
      const y = -edge * v, l = Math.hypot(x, y, 1);
      // (the eye's own way (x, y, −1) turned to the right by the frame's turn)
      d[0] = (x * ct + sn) / l; d[1] = y / l; d[2] = (x * sn - ct) / l;
      return !world.raycast(o, d, Infinity, null, F.turn, false, false);
    };
    const said = `the sky's painting is seen there below its horizon: if it paints the land beyond there (seen through a window, an opening), that is what is seen; if not, a light strip — lay the ground farther, or what stands far off down over its edge`;
    for (const [half, from] of [[WIDEST / 2, 0], [WIDE_SCREEN / 2, WIDEST / 2]]) {
      for (const v of STRIP_ROWS) {
        for (let i = 0; i < STRIP_COLUMNS; i++) {
          const u = (i + 0.5) / STRIP_COLUMNS, x = Math.sign(u - 0.5) * (from + (half - from) * Math.abs(2 * u - 1));
          if (!open(x, v)) continue;
          if (!from) host.warn(`${name}: the ground ends ${Math.round(far)} m away, and past its edge, under the horizon, nothing of the world is painted where the camera looks as it starts (${u < 1 / 3 ? 'its left' : u < 2 / 3 ? 'its middle' : 'its right'}, the widest frame's) — ${said}`);
          else host.warn(`${name}: the ground ends ${Math.round(far)} m away, and past its edge, under the horizon, nothing of the world is painted where a screen wider than the frame looks as the scene starts (past the frame's ${x < 0 ? 'left' : 'right'}) — ${said}`);
          return;
        }
      }
    }
  }

  // ── the frame in the canvas ──
  // rect: the safe rect — the canvas's shape held to 4:3…21:9, fitted whole (never cropped) in its middle; seen: the
  // whole canvas, what the projection maps onto; stage: the safe rect in the canvas's clip space (where an insert is
  // laid: its middle across, its top, a stage height across and down); world.view: both in stage heights (e.view,
  // scene.view — read-only, changed only here: a resize repaints nothing)
  const rect = { x: 0, y: 0, w: 1, h: 1 }, seen = { x: 0, y: 0, w: 1, h: 1 }, stage = new Float64Array(4);
  function frameBox() {
    const cw = Math.max(1, host.w), ch = Math.max(1, host.h), a = clamp(cw / ch, NARROWEST, WIDEST);
    const w = Math.min(cw, ch * a), h = w / a;
    rect.x = (cw - w) / 2; rect.y = (ch - h) / 2; rect.w = w; rect.h = h;
    seen.w = cw; seen.h = ch;
    stage[0] = 2 * (rect.x + w / 2) / cw - 1; stage[1] = 1 - 2 * rect.y / ch; stage[2] = 2 * h / cw; stage[3] = 2 * h / ch;
    const V = world.view;
    V.safe[0] = (STAGE - a) / 2; V.safe[1] = 0; V.safe[2] = (STAGE + a) / 2; V.safe[3] = 1;
    V.seen[0] = STAGE / 2 - cw / (2 * h); V.seen[1] = -rect.y / h; V.seen[2] = STAGE / 2 + cw / (2 * h); V.seen[3] = (ch - rect.y) / h;
    lim.aspect = w / h;
    lim.view[0] = clamp((host.view[0] * host.w - rect.x) / w, 0, 1); lim.view[1] = clamp((host.view[1] * host.w - rect.x) / w, 0, 1);
  }

  // ── the poses ──
  const start = () => { const p = pose(); p.look = s.look; p.h = s.h; return p; };
  const target = start(), cam = start(), shown = start(), own = start(), off = pose(), going = start();
  // (the roll: a field — a closure's number is a new one each time)
  const tilt = { roll: 0 };
  const leanAt = { x: 0, y: 0 }, leaned = { x: 0, y: 0 };
  const keys = new Set(), pointers = new Map();
  let pinch = null, grab = null, glide = null, lastMove = 0, aimAt = -Infinity;
  // the wheel's aim (pick's, and the pointer it was taken at; on: whether there is one) — and what a grab picks
  const aim = { Z: 0, x: 0, Y: 0, cy: 0, stop: 0, px: 0, py: 0, on: false }, grabbed = { Z: 0, x: 0, Y: 0, cy: 0, stop: 0 };

  // ── the operator ──
  // its pose, how fast it moves, the target's point a step ago (at; tracked: whether it has one) and how fast it goes;
  // the shot's way round (looking round); end — where it is going now (the pose it frames from, or the scene's own it
  // steps back to)
  const makeOp = () => ({ pose: null, vel: pose(), cut: -1, on: null, fresh: false, id: null, at: V3(), tracked: false, v: V3(), view: null, D: null, gap: 0, aimed: pose(), end: pose(), lead: { x: 0, z: 0, vx: 0, vz: 0 }, known: true });
  const op = makeOp();
  // A cut by a shot made ready (2.3 step 6): the scene's operator goes on from that shot's — its pose, its way round,
  // what it frames —, in place of being made fresh, so the new shot's first frame is seen by the camera the shot's views
  // were asked from. The shot counted its target's point as the cut sets it — a person posed as that cut will set
  // them (PP5 pointFor), a thing carried with its node (targetOf) —, so the operator handed over is already on its
  // goal: nothing eases after the cut, at any camera_glide. `handed`: the operator of the shot the last cut was by
  // (null: a plain cut — made fresh), taken as the camera next steps
  let handed = null;
  function take(o) {
    op.pose = o.pose ? copy(op.pose || pose(), o.pose) : null;
    copy(op.vel, o.vel);
    op.on = o.on; op.id = o.id; op.fresh = o.fresh; op.known = o.known;
    op.view = o.view;
    if (op.view) { op.view.cut = state.cutAt; op.view.paintings = world.paintings; }
    op.cut = state.cutAt; op.tracked = false; op.v.fill(0);
  }
  const glideOf = get => { const g = get('camera_glide'); return typeof g === 'number' && g >= 0 ? g : GLIDE; };
  const shotOf = v => {
    if (v == null) return SHOTS.full;
    if (typeof v === 'number' && v > 0) return v;
    if (SHOTS[v]) return SHOTS[v];
    host.warn(`camera_shot: ${JSON.stringify(v)} — one of ${Object.keys(SHOTS).join(', ')}, or how many times the frame's height the target is tall`);
    return SHOTS.full;
  };
  const frameX = [0, null];
  const frameOf = v => {
    if (v == null) return null;
    if (typeof v === 'number') { frameX[0] = v; return frameX; }
    if (Array.isArray(v) && v.length === 2 && v.every(k => typeof k === 'number')) return v;
    host.warn(`camera_frame: ${JSON.stringify(v)} — [x, y] (fractions of the frame) or x`);
    return null;
  };
  // the target's point (metres, in the frame the camera is in; base — where its anchor stands, as high) and its height:
  // its marked point (e.at; 'id#name' — the one it names), else its box's middle; `get`: the state as the camera is to
  // see it (a shot made ready — readyGet, its values in readyValues: where they will put it — a person: posed as a cut
  // to them will set them, PEOPLE's answer, standing where their root is then — riding, where what carries them is
  // then —; a person those values move nothing of, nor anything that carries them: as they are now; a thing: its point
  // of now carried with its node)
  const P = V3(), Mt = new Float64Array(12), rootThen = new Float64Array(4), box4 = new Float32Array(4), midP = { x: 0, y: 0, part: -1, layer: -1 };
  // (face: a person's — the bearing a lens looks along to see their face, from before them (radians, the frame's, as
  // the operator's bearings); null: a thing)
  const tgt = { X: 0, Y: 0, Z: 0, base: 0, tall: 2, marked: false, known: false, el: null, face: null };
  // (a point it names that it does not mark now: the camera holds where it framed it)
  const HOLD = { hold: true };
  function targetOf(ref, get) {
    const R = world.refOf(ref), id = R.id, named = R.name !== null;
    const el = world.byId.get(id);
    if (!el) { host.warn(`camera_target: there is no element "${ref}"`); return null; }
    if (UNFRAMED.has(el.kind)) { host.warn(`camera_target: "${ref}" is not in the scene's space (the sky, an insert, particles)`); return null; }
    let marked = false, posed = false;
    if (el.kind === 'person') {
      // (not here — as `get` has them: nothing of them is anywhere to frame)
      if (get(`${id}_here`) === false) { host.warn(`camera_target: "${ref}" is not here (${id}_here is false) — nothing to frame`); return null; }
      posed = get !== state.value && !!world.people && world.people.pointFor(readyValues, id, R.name ?? 'head', P, rootThen);
      if (posed) marked = true;
      else if (!world.pointOf(R.head, P)) { if (named) return HOLD; anchor(el, P); P[1] += 1.6; } else marked = true;
      // (as tall as they are — not their box: that has room round them for what they hold and raise)
      tgt.tall = world.people?.height(id) ?? EYE;
    } else {
      const m = world.markOf(el, R.name);
      if (named && !m) return HOLD;
      if (m) { world.pointOf(ref, P); marked = true; }
      else { midP.x = (el.box[0] + el.box[2]) / 2; midP.y = (el.box[1] + el.box[3]) / 2; world.sheetPoint(el, R.copy, midP, world.yaw, P); }
      // (a plane has no height: what is framed at its point is as tall as one standing there)
      tgt.tall = el.kind === 'plane' ? EYE : el.spec.height;
    }
    // (where its values would put it: a person posed there — where their root is then; a thing: the point moved with
    // its node)
    let baseY = M.m[12 * el.nodes[R.copy] + 10];
    if (posed) baseY = rootThen[1];
    else if (get !== state.value && el.kind !== 'person' && !el.copies) baseY = world.carriedWith(el, P, get, Mt)[10];
    // (a plane's point: what stands there stands on it)
    if (el.kind === 'plane') baseY = P[1];
    // (which way a person faces — posed by the values: as they will; else their root's +z now —, in the frame)
    let face = null;
    if (el.kind === 'person') {
      const o = 12 * el.node, wx = posed ? Math.sin(rootThen[3]) : M.m[o + 6], wd = posed ? Math.cos(rootThen[3]) : -M.m[o + 8];
      if (wx || wd) face = Math.atan2(-(wx * F.c - wd * F.s), -(wx * F.s + wd * F.c));
    }
    toFrame(P, P);
    tgt.X = P[0]; tgt.Y = P[1]; tgt.Z = P[2]; tgt.base = baseY - F.y; tgt.marked = marked; tgt.el = el; tgt.face = face;
    tgt.known = el.kind === 'person' || el.isPainted || !el.spec.paints;
    return tgt;
  }
  // what stands between: skip — the target, what carries it and what it carries (the line of sight is not stopped by
  // them); between(o, p, yaw) — what a line of sight from o to p (world points) meets first, past where things fade
  // before the eye and short of p, but those (world.raycast: by the paintings themselves — a quad over its recording's
  // extent, nothing of the cache, SH4; a veil — a layer that adds or multiplies, a painting whose densest draw, times
  // its layer's alpha, covers less than CAST.ALPHA, as mist — is seen through —, a form by its sphere, a person by
  // their capsules, the land): its hit, or null. The operator's way round and the target hidden see alike.
  // yaw: how what faces the eye is turned for it (null: as for an eye looking along the line). The same on every run
  const skip = new Set(), Cv = V3(), Tv = V3(), Dv = V3(), Ov = V3();
  function skipOf(el) {
    skip.clear();
    for (const p of world.chain(el)) skip.add(p);
    for (const b of el.below) skip.add(b);
  }
  function between(o, p, yaw) {
    Dv[0] = p[0] - o[0]; Dv[1] = p[1] - o[1]; Dv[2] = p[2] - o[2];
    const L = Math.hypot(Dv[0], Dv[1], Dv[2]);
    if (L <= PASS.FROM + 0.01) return null;
    Dv[0] /= L; Dv[1] /= L; Dv[2] /= L;
    Ov[0] = o[0] + Dv[0] * PASS.FROM; Ov[1] = o[1] + Dv[1] * PASS.FROM; Ov[2] = o[2] + Dv[2] * PASS.FROM;
    return world.raycast(Ov, Dv, L - PASS.FROM - 0.01, skip, yaw ?? Math.atan2(Dv[0], -Dv[2]));
  }
  // the operator's eye framing a target from (ux, uz) of the frame: its height over the start's level — the eye's height
  // over what is under it, raised as high as what the target stands on is over the land or the water under the target
  // (up: a deck, the back it rides, a boat) — over the land or the water under the camera; over what is under it, at
  // least (a walk plane it stands on too) —, and, closer than full height (near), up to the target's point Y
  function eyeFor(ux, uz, up, Y, near) {
    const under = floor(ux, uz), lift = Math.max(0, surface(ux, uz) + up - under);
    return under + s.h + lift + (Y - under - s.h - lift) * near;
  }
  // the operator's way round for this shot (looking round): { turn — radians round the target from the bearing toward
  // it from where the viewer is, near — the share of its distance }, by lines of sight (between) from the eye as high
  // as it will be there (eyeFor; dh: what the viewer's height and camera_h add). A person is filmed from before their
  // face: the ways round are tried from the bearing their face looks along (T.face), a thing's from the viewer's
  function clearView(T, X, Z, D, c, up, near0, dh) {
    const el = T.el;
    skipOf(el);
    // what of it the frame holds: its height (its box round its anchor, y down; a plane's point: as tall as one standing
    // there), within a frame's height there round its point
    const box = (el.kind === 'person' && world.people?.box(el.id, box4) && box4) || el.box, base = T.base, plane = el.kind === 'plane';
    const lo = Math.max(plane ? base : base - box[3], T.Y - D / 2), hi = Math.min(plane ? base + T.tall : base - box[1], T.Y + D / 2);
    const bearing = Math.atan2(X - c.x, Z - c.z), room = limitsOf().room;
    const from = T.face == null ? 0 : ((((T.face - bearing) % TAU) + 3 * Math.PI) % TAU) - Math.PI;
    let best = null;
    for (const near of NEARER) for (let i = 0; i <= 12; i++) for (const sgn of i ? [1, -1] : [1]) {
      const turn = from + sgn * i * BEARING, a = bearing + turn, Dk = Math.max(PASS.TO, D * near);
      const cx = X - Dk * Math.sin(a), cz = Z - Dk * Math.cos(a);
      if (room && (cx < room[0] || cx > room[1] || cz < room[2] || cz > room[3])) continue;
      const h = eyeFor(cx, cz, up, T.Y, near0) + dh;
      let hidden = 0;
      for (let k = 0; k < SIGHTS; k++) {
        toWorld(cx, h, cz, Cv);
        toWorld(X, lo + (hi - lo) * (k + 0.5) / SIGHTS, Z, Tv);
        if (between(Cv, Tv, null)) hidden++;
        // (already too hidden, and no less than the best way so far: the rest of its lines not cast)
        if (hidden > HIDDEN * SIGHTS && best && hidden >= best.hidden * SIGHTS) break;
      }
      hidden /= SIGHTS;
      if (hidden <= HIDDEN) return { turn, near };
      if (!best || hidden < best.hidden) best = { turn, near, hidden };
    }
    return best && best.hidden < 1 ? best : { turn: 0, near: 1 };
  }
  // where the operator would stand for target `id` now (into o.aimed; o.lead — how far ahead it aims, how fast the target
  // goes); c — the camera as the viewer has it (over the start's ground: what is under the camera is added after).
  // false: nothing to frame; 'hold': where it was framing (a point not marked now). whole: the shot's first frame is
  // not drawn yet (f.whole; a camera made ready: always). rays: its way round may be chosen anew (false — f.toward's:
  // the target where it is now, the way round as it stands)
  const startPose = start();
  function framing(o, id, c, dt, get, whole, rays = true) {
    const T = targetOf(id, rays ? get : state.value);
    if (T === HOLD) return o.pose ? 'hold' : false;
    if (!T) return false;
    if (o.tracked && dt > 0) {
      const k = 1 - Math.exp(-dt / 0.3);
      o.v[0] += ((T.X - o.at[0]) / dt - o.v[0]) * k; o.v[1] += ((T.Y - o.at[1]) / dt - o.v[1]) * k; o.v[2] += ((T.Z - o.at[2]) / dt - o.v[2]) * k;
    }
    o.tracked = true;
    o.at[0] = T.X; o.at[1] = T.Y; o.at[2] = T.Z;
    const w = 5 / Math.max(0.1, glideOf(get)), ahead = 2 / w;
    const X = T.X + o.v[0] * ahead, Z = T.Z + o.v[2] * ahead, shot = shotOf(get('camera_shot'));
    const D = Math.max(PASS.TO, T.tall / shot), A = rect.w / rect.h;
    o.D = D;
    const yaw = s.round ? Math.atan2(X - c.x, Z - c.z) : 0;
    const across = o.v[0] * Math.cos(yaw) - o.v[2] * Math.sin(yaw), fr = frameOf(get('camera_frame'));
    const fx = fr?.[0] ?? 0.5 - 0.1 * clamp(across / 1.4, -1, 1), fy = fr?.[1] ?? (T.marked ? headAt(shot) : 0.5);
    const offA = Math.atan((fx - 0.5) * A), near = clamp((shot - SHOTS.full) / (SHOTS.medium - SHOTS.full), 0, 1), up = raised(T);
    o.lead.x = o.v[0] * ahead; o.lead.z = o.v[2] * ahead; o.lead.vx = o.v[0]; o.lead.vz = o.v[2];
    const p = o.aimed;
    // where it stands, then how high (eyeFor) — as an operator does
    let Dk = D, a = 0;
    if (s.round) {
      // (chosen as the shot begins — a cut, another target, another size — and kept for it; anew till the target is
      // painted, and — while the shot's first frame is not drawn yet — whenever a painting is taken: what stands in
      // the way is known by its painting (SH4). Chosen anew before that frame, the operator is there at once)
      const v = o.view, again = !!v && whole && v.paintings !== world.paintings;
      if (rays && (!v || v.cut !== state.cutAt || v.id !== id || v.shot !== shot || !v.known || again)) {
        const asked = (Number(get('camera_x')) || 0) || (Number(get('camera_z')) || 0) || (Number(get('camera_h')) || 0) || (Number(get('camera_yaw')) || 0);
        const w2 = o.view ||= { cut: 0, id: null, shot: 0, known: false, paintings: 0, turn: 0, near: 1 };
        w2.cut = state.cutAt; w2.id = id; w2.shot = shot; w2.known = T.known; w2.paintings = world.paintings;
        if (asked) { w2.turn = 0; w2.near = 1; } else { const cv = clearView(T, X, Z, D, c, up, near, c.h - s.h + (Number(get('camera_h')) || 0)); w2.turn = cv.turn; w2.near = cv.near; }
        if (again) o.fresh = true;
      }
      a = yaw + (o.view ? o.view.turn : 0); Dk = Math.max(PASS.TO, D * (o.view ? o.view.near : 1));
      o.D = Dk;
      p.x = X - Dk * Math.sin(a); p.z = Z - Dk * Math.cos(a);
    } else { p.x = X - (fx - 0.5) * A * D; p.z = Z - D; }
    // (its height over the start's level, not over what is under it: gliding there, the eye goes as straight in height
    // as in place — over a river between the quay and a bridge's road it stays level, not down to the water: filmed)
    const ux = s.round ? p.x : c.x - startPose.x + p.x, uz = s.round ? p.z : c.z - startPose.z + p.z;
    const ph = eyeFor(ux, uz, up, T.Y, near);
    const h = c.h + ph - s.h + (Number(get('camera_h')) || 0);
    p.h = ph;
    if (s.round) { p.look = yh + (h - T.Y) / (Dk * Math.cos(offA)) - fy; p.yaw = a - offA; } else { p.look = yh + (h - T.Y) / D - fy; p.yaw = 0; }
    o.known = T.known;
    return true;
  }
  // the film over a pose: c — the camera as the viewer has it — with the operator's pose p (null: none) and the
  // camera_* keys → the roll (radians). turned: the viewer's own turn of the head (it turns the view, not the offsets)
  function filmed(c, p, turned, get) {
    if (p) {
      if (s.round) { c.x = p.x; c.z = p.z; } else { c.x += p.x - startPose.x; c.z += p.z - startPose.z; }
      // (its height is over the start's level — never under the land or the water where it is —, the viewer's over
      // what is under the eye: what is under it here is taken off, the step adds it back where the eye ends up)
      c.h += Math.max(p.h, surface(c.x, c.z)) - startPose.h - floor(c.x, c.z);
      c.look += p.look - startPose.look; c.yaw += p.yaw - startPose.yaw;
    }
    // (camera_x to its right, camera_z ahead — as the film turns it, the operator's way included; the viewer looking
    // aside swings no offset round)
    const fy = c.yaw - turned, cx = Number(get('camera_x')) || 0, cz = Number(get('camera_z')) || 0, cy = Math.cos(fy), sy = Math.sin(fy);
    c.x += cx * cy + cz * sy; c.z += cz * cy - cx * sy;
    c.h += Number(get('camera_h')) || 0; c.look += Number(get('camera_look')) || 0;
    c.look -= Math.tan(clamp(Number(get('camera_pitch')) || 0, -75, 75) * DEG);
    c.yaw += (Number(get('camera_yaw')) || 0) * DEG;
    return (Number(get('camera_roll')) || 0) * DEG;
  }
  // the operator's step: c — the camera as the viewer has it — becomes the film's (o: the operator; get: the state;
  // whole: the shot's first frame is not drawn yet)
  const ownPose = pose();
  function directed(o, c, dt, get, whole) {
    const id = get('camera_target');
    const turned = c.yaw - startPose.yaw;
    o.D = null;
    // (riding something else: a shot begun anew, in that frame)
    if (o.on !== F.id) { o.on = F.id; o.cut = -1; o.view = null; }
    if (o.cut !== state.cutAt) { o.cut = state.cutAt; o.fresh = true; o.tracked = false; o.v.fill(0); }
    if (id !== o.id) { o.id = id; o.tracked = false; o.v.fill(0); }
    const aimed = id != null && s.mode !== 'platform' && !!framing(o, String(id), c, dt, get, whole);
    copy(ownPose, startPose);
    if (s.round) { ownPose.x = c.x; ownPose.z = c.z; }
    // (the scene's own camera: the eye's height over what is under the viewer, over the start's level as the operator's)
    ownPose.h += floor(c.x, c.z);
    const goal = aimed ? o.aimed : ownPose;
    copy(o.end, goal);
    if (aimed || o.pose) {
      // just after a cut, there at once; else along a critically damped spring (exact for any step): it sets off and
      // settles without overshoot
      const g = glideOf(get), snap = o.fresh || g < 0.01;
      if (snap || !o.pose) {
        o.pose = copy(o.pose || pose(), snap ? goal : ownPose);
        still(o.vel);
        // (at a moving target: as if following it all along — on it, moving with it)
        if (snap && aimed) { o.pose.x -= o.lead.x; o.pose.z -= o.lead.z; o.vel.x = o.lead.vx; o.vel.z = o.lead.vz; }
      }
      if (!snap) {
        const w = 5 / g, e = Math.exp(-w * dt);
        if (s.round) goal.yaw = o.pose.yaw + ((((goal.yaw - o.pose.yaw) % TAU) + 3 * Math.PI) % TAU - Math.PI);
        const q = o.pose, u = o.vel;
        let d = q.x - goal.x, k = (u.x + w * d) * dt; u.x = (u.x - w * k) * e; q.x = goal.x + (d + k) * e;
        d = q.z - goal.z; k = (u.z + w * d) * dt; u.z = (u.z - w * k) * e; q.z = goal.z + (d + k) * e;
        d = q.h - goal.h; k = (u.h + w * d) * dt; u.h = (u.h - w * k) * e; q.h = goal.h + (d + k) * e;
        d = q.look - goal.look; k = (u.look + w * d) * dt; u.look = (u.look - w * k) * e; q.look = goal.look + (d + k) * e;
        d = q.yaw - goal.yaw; k = (u.yaw + w * d) * dt; u.yaw = (u.yaw - w * k) * e; q.yaw = goal.yaw + (d + k) * e;
        copy(o.end, goal);
      }
      const p = o.pose;
      // (how far it is from where it frames the target — following one that moves, it keeps on it)
      o.gap = Math.max(Math.abs(p.x - goal.x), Math.abs(p.z - goal.z), Math.abs(p.h - goal.h), Math.abs(p.look - goal.look), Math.abs(p.yaw - goal.yaw));
      // settled back on the scene's own camera: the operator steps away
      if (!aimed && o.gap < 1e-4 && !moves(o.vel)) o.pose = null;
    }
    if (o.fresh) o.fresh = id != null && !o.known;
    return filmed(c, o.pose, turned, get);
  }
  const operating = () => !!op.pose && moves(op.vel);

  // ── the target hidden ──
  // A person a shot frames (camera_target) whom something nearer to the lens hides by more than a third — another
  // person, what is painted (not a veil), a form, the land — is said to the author, with the scene's time, who and what hides them:
  // ahead the operator steps round nothing (the language: the author chooses the camera), looking round its way round
  // may find no clear view. Once a shot (its cut, its target, its size): as its framing first settles (`framed`), the
  // viewer's own camera at rest and nothing shown waiting for its painting — lines of sight (between) from the camera
  // shown to those of SEEN_POINTS the safe frame holds. Approximate: points, not the figure's outline; a quad stops a
  // line over its recording's extent (an open lattice or a thin rail as a whole rectangle of it), a veil not at all
  // (mist, smoke, light added: world.raycast — veils laid over one another each by itself), a form by its sphere,
  // a person by their capsules; a moved layer is judged where it rests; what comes in the way later in the shot is not
  // seen. (sighted: the shot last looked at, and whether it has been)
  const sighted = { cut: -1, id: null, shot: null, done: true }, seenP = V3(), sightAt = V3(), hiders = new Array(SEEN_POINTS.length).fill(null), LAND = {};
  // (the viewer moving the camera, or off the scene's own — what is shown is not the film's framing)
  const aside = () => pointers.size > 0 || keys.size > 0 || !!glide
    || (!s.sway && Math.abs(cam.look - startPose.look) + Math.abs(cam.yaw - startPose.yaw) + (s.round ? 0 : Math.abs(cam.x - startPose.x) + Math.abs(cam.z - startPose.z) + Math.abs(cam.h - startPose.h)) > 0.01);
  const called = e => (e === LAND ? 'the land' : `"${e.id}"${e.spec.name ? ` (${e.spec.name})` : ''}`);
  function hiddenTarget(t) {
    const id = op.id, w = sighted, shotKey = state.value('camera_shot') ?? null;
    if (!op.pose || !(op.D > 0) || id == null) return;
    if (w.cut !== state.cutAt || w.id !== id || w.shot !== shotKey) { w.cut = state.cutAt; w.id = id; w.shot = shotKey; w.done = false; }
    if (w.done || op.gap >= FRAMED || aside() || world.waiting() || world.people?.building()) return;
    w.done = true;
    // (the target as this step's framing found it)
    const el = tgt.el;
    if (!el || el.kind !== 'person' || !world.people) return;
    skipOf(el);
    let all = 0, hid = 0;
    for (let i = 0; i < SEEN_POINTS.length; i++) {
      hiders[i] = null;
      if (!world.people.point(el.id, SEEN_POINTS[i], seenP) || !project(camera, seenP, seen, sightAt)) continue;
      if (sightAt[0] < rect.x || sightAt[0] > rect.x + rect.w || sightAt[1] < rect.y || sightAt[1] > rect.y + rect.h) continue;
      all++;
      const h = between(camera.eye, seenP, world.yaw);
      if (h) { hid++; hiders[i] = h.el || LAND; }
    }
    if (!all || hid <= HIDDEN_SAID * all) return;
    // (what hides most of them)
    let most = null, mostN = 0, others = false;
    for (let i = 0; i < hiders.length; i++) {
      if (!hiders[i]) continue;
      let n = 0;
      for (let j = 0; j < hiders.length; j++) if (hiders[j] === hiders[i]) n++;
      if (n > mostN) { most = hiders[i]; mostN = n; }
    }
    for (let i = 0; i < hiders.length; i++) if (hiders[i] && hiders[i] !== most) others = true;
    host.warn(`at ${t.toFixed(1)} s, camera_target "${id}"${el.spec.name ? ` (${el.spec.name})` : ''} is hidden from the camera by more than a third — behind ${called(most)}${others ? ' and more' : ''}: ${s.round ? 'no way round it tried (within the area) sees them clear' : 'the operator does not step round what is in the way'} — choose the camera yourself (camera_x, camera_z, camera_h, camera_yaw, camera_frame), or move what is in the way`);
  }

  // ── the Camera of a pose (in the frame worked in now: F) ──
  function lens(camera, p, r) {
    // (out of the frame it rides in: where it is in the world, its yaw there)
    const yaw = p.yaw + F.turn, at = toWorld(p.x, p.h, p.z, camera.eye);
    // world → eye: turned to the right by yaw, tipped to the right by roll (the horizon rising to the right)
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cr = Math.cos(r), sr = Math.sin(r), R = camera.rot;
    R[0] = cr * cy; R[1] = sr * cy; R[2] = -sy; R[3] = -sr; R[4] = cr; R[5] = 0; R[6] = cr * sy; R[7] = sr * sy; R[8] = cy;
    // the focal length: the safe rect's height — tipped, that much longer that what is laid out for it still fills it
    let f = rect.h;
    if (r) { const c = Math.abs(Math.cos(r)), sn = Math.abs(Math.sin(r)), a = rect.w / 2, b = rect.h / 2; f *= Math.max((a * c + b * sn) / a, (a * sn + b * c) / b); }
    // eye → clip, onto the whole canvas (RN5: clip ±1 are its edges) — the principal point the safe rect's: in its
    // middle across (the canvas's: the rect is in the middle), on the eye's line (with the gaze) down; WebGPU's, depth
    // reversed (the near plane → 1, infinity → 0)
    const Pm = camera.proj;
    Pm.fill(0);
    Pm[0] = 2 * f / seen.w; Pm[5] = 2 * f / seen.h; Pm[9] = 2 * (rect.y + (yh - p.look) * rect.h) / seen.h - 1; Pm[11] = -1; Pm[14] = NEAR;
    // (its yaw: what faces the eye turns by it, the sky's backdrop is carried by it; its pose in the world)
    camera.yaw = yaw;
    const w = camera.pose;
    w.x = at[0]; w.z = -at[2]; w.h = at[1]; w.look = p.look; w.yaw = yaw; w.roll = r;
  }
  const camera = newCamera(), toward = newCamera();

  // ── a point on the canvas ──
  // a point of the canvas (CSS px) in the safe rect's (px from its corner — outside it too —, as drawn: the roll undone
  // about the lens's centre)
  const local = (x, y, out) => {
    let u = x - rect.x, v = y - rect.y;
    if (tilt.roll) {
      const cx = rect.w / 2, cy = (yh - shown.look) * rect.h, c = Math.cos(tilt.roll), sn = Math.sin(tilt.roll), dx = u - cx, dy = v - cy;
      u = cx + c * dx - sn * dy; v = cy + sn * dx + c * dy;
    }
    out.x = u; out.y = v;
    return out;
  };

  // ── the viewer's gestures ──
  const lp = { x: 0, y: 0 }, ro = V3(), rd = V3(), met = V3();
  // what is under the pointer, from the camera shown: where to walk to — into out { Z, x, Y, cy, stop } (metres, in the
  // frame the camera is in; Y — its height, undefined: not one to keep under the pointer; cy — the frame's fraction
  // down; stop — how near its point the walk stops: where the element about fills the frame — unless it already fills
  // it from here (as tall as it is far, or taller: a wall, a board, a big sheet), when it is walked up to —, never
  // nearer than a step, nor than where the gaze, as far up as it goes, still holds the point where the pointer is)
  function pick(px, py, out) {
    local(px, py, lp);
    rayOf(camera, px, py, seen, ro, rd);
    const h = world.raycast(ro, rd, 400);
    const v = shown;
    out.cy = lp.y / rect.h;
    if (h) {
      toFrame(h.point, met);
      const Y = met[1];
      const up = s.look + LOOK_UP, sight = Y > v.h ? (Y - v.h) / Math.max(0.05, yh - out.cy - up) : 0;
      const tall = h.el ? (h.el.kind === 'person' ? 1.7 : h.el.spec.height) : 0, fills = tall >= met[2] - v.z;
      out.Z = met[2]; out.x = met[0]; out.Y = h.el ? Y : undefined;
      out.stop = h.el ? Math.max(1.1 * EYE, fills ? 0 : 1.15 * tall, sight) : 1.2 * EYE;
      return out;
    }
    // (the sky: a few steps ahead)
    out.Z = v.z + 6 * EYE; out.x = v.x; out.Y = undefined; out.stop = 1.2 * EYE;
    return out;
  }
  function walkToward(factor, px, py) {
    const t = now();
    if (!aim.on || t - aimAt > AIM_MS || Math.hypot(px - aim.px, py - aim.py) > AIM_PX) { pick(px, py, aim); aim.px = px; aim.py = py; aim.on = true; }
    aimAt = t;
    const v = shown, d0 = aim.Z - v.z;
    if (d0 <= 0.05 * EYE) return;
    // each notch covers a share of the way left (the approach slows by itself), up to the stop; back, as far as one may
    // stand — what you walked up to may lie past where walking goes: you may stand there
    const want = aim.Z - (factor > 1 ? Math.max(Math.min(d0, aim.stop), d0 / factor) : d0 / factor) - off.z;
    const reach = want > limitsOf().zMax ? Math.max(lim.reach ?? 0, want) : null;
    zRange(reach, ZR);
    const z = clamp(want, ZR[0], ZR[1]), d = aim.Z - z - off.z;
    // a notch that walks nowhere (at the stop; at the back, stepping back) leaves the view as it is — not re-aimed
    if (Math.abs(d - d0) < 1e-3 * EYE) return;
    // along the line from the point through the eye, as far as the notch walked: the point stays under the pointer
    lim.reach = reach;
    target.z = z;
    target.x = aim.x - (aim.x - v.x) * d / d0 - off.x;
    if (aim.Y !== undefined) target.look = yh - aim.cy + (v.h - aim.Y) / Math.max(0.05 * EYE, d) - off.look;
    limit(target);
  }
  function grabAt(px, py) {
    local(px, py, lp);
    if (s.round) { grab = { round: true, cx: lp.x, cy: lp.y, yaw: target.yaw, look: target.look }; return; }
    const D = clamp(pick(px, py, grabbed).Z - shown.z, 0.4 * EYE, 60 * EYE);
    grab = { x: shown.x + (lp.x - rect.w / 2) / rect.h * D, D, cy: lp.y, look: target.look };
  }
  function dragTo(px, py) {
    local(px, py, lp);
    const x0 = target.x, y0 = target.look, t = now(), dt = Math.max(8, t - lastMove) / 1000, k = Math.min(1, dt * 20);
    glide ||= { vx: 0, vy: 0, vyaw: 0 };
    if (grab.round) {
      const yaw0 = target.yaw;
      target.yaw = grab.yaw - (Math.atan((lp.x - rect.w / 2) / rect.h) - Math.atan((grab.cx - rect.w / 2) / rect.h));
      target.look = grab.look - (lp.y - grab.cy) / rect.h;
      limit(target);
      glide.vyaw += ((target.yaw - yaw0) / dt - glide.vyaw) * k;
    } else {
      target.x = grab.x - (lp.x - rect.w / 2) / rect.h * grab.D - off.x;
      target.look = grab.look - (lp.y - grab.cy) / rect.h;
      limit(target);
      glide.vx += ((target.x - x0) / dt - glide.vx) * k;
      glide.vy += ((target.look - y0) / dt - glide.vy) * k;
    }
    lastMove = t;
  }
  const stepTo = (ang, d) => { target.x += Math.sin(ang) * d; target.z += Math.cos(ang) * d; limit(target); };
  // (a picture: the viewer's moves are not the scene's — its keys stay the page's)
  const fixed = () => s.sway > 0;
  const roam = () => s.mode === 'roam';

  // ── a platformer ──
  let plat = null;
  function platformOf() {
    const el = s.hero && world.byId.get(s.hero);
    if (!el) return null;
    const solids = world.elements.filter(e => e.spec.solid && e !== el).map(e => {
      anchor(e, W);
      const h = e.spec.height, b = e.spec.o.box ? e.box : [-0.8 * h, 0, 0.8 * h, 0], y = W[1];
      return { x0: W[0] + b[0], x1: W[0] + b[2], y0: y, y1: y + h };
    });
    anchor(el, W);
    const x = W[0], y = W[1];
    return {
      el, distance: -W[2], x0: x, y0: y, x, y, floor: y, vx: 0, vy: 0, ground: false, air: 0, jumped: false, dir: 1,
      w: el.spec.width, h: el.spec.height, solids, jumpV: Math.sqrt(2 * G * clamp(s.jump, 0.5, 8)),
      level: [Math.min(x, ...solids.map(r => r.x0)), Math.max(x, ...solids.map(r => r.x1))], bottom: Math.min(y, ...solids.map(r => r.y1)),
    };
  }
  const ctl = { left: false, right: false, jump: false }, hero = { id: null, vx: 0, vy: 0, ground: true };
  function controls() {
    const c = ctl;
    c.left = keys.has('ArrowLeft') || keys.has('a'); c.right = keys.has('ArrowRight') || keys.has('d'); c.jump = keys.has(' ') || keys.has('w') || keys.has('ArrowUp');
    pointers.forEach(held);
    return c;
  }
  // (a finger held on a third of the frame: left, jump, right — one function, made once)
  function held(p) { const f = local(p.x, p.y, lp).x / rect.w; if (f < 1 / 3) ctl.left = true; else if (f > 2 / 3) ctl.right = true; else ctl.jump = true; }
  function stepHero(p, dt) {
    const c = controls(), want = (c.right ? 1 : 0) - (c.left ? 1 : 0), hw = p.w / 2;
    p.vx += (want * RUN - p.vx) * Math.min(1, dt * (p.ground ? 14 : 5));
    if (want) p.dir = want;
    p.air = p.ground ? 0 : p.air + dt;
    // one jump a press; a moment after running off an edge still counts
    if (c.jump && !p.jumped && p.air < 0.1) { p.vy = p.jumpV; p.jumped = true; p.air = 1; }
    if (!c.jump) p.jumped = false;
    p.vy = Math.max(p.vy - G * dt, -30);
    p.x += p.vx * dt;
    for (let i = 0; i < p.solids.length; i++) {
      const r = p.solids[i];
      if (p.y >= r.y1 - 0.01 || p.y + p.h <= r.y0 + 0.01 || p.x + hw <= r.x0 || p.x - hw >= r.x1) continue;
      if (p.vx > 0) p.x = r.x0 - hw; else if (p.vx < 0) p.x = r.x1 + hw;
      p.vx = 0;
    }
    const y0 = p.y;
    p.y += p.vy * dt; p.ground = false;
    for (let i = 0; i < p.solids.length; i++) {
      const r = p.solids[i];
      if (p.x + hw <= r.x0 || p.x - hw >= r.x1) continue;
      if (p.vy <= 0 && y0 >= r.y1 - 0.01 && p.y < r.y1) { p.y = r.y1; p.vy = 0; p.ground = true; }
      else if (p.vy > 0 && y0 + p.h <= r.y0 + 0.01 && p.y + p.h > r.y0) { p.y = r.y0 - p.h; p.vy = 0; }
    }
    if (p.y < p.bottom - FALL) { p.x = p.x0; p.y = p.y0; p.floor = p.y0; p.vx = 0; p.vy = 0; }
    if (p.ground) p.floor = p.y;
    hero.id = p.el.id; hero.vx = p.vx; hero.vy = p.vy; hero.ground = p.ground;
    world.hero = hero;
    world.moveHero(p.el, p.x - p.x0, p.y - p.y0, p.dir < 0);
    // the camera: the hero a little behind the middle, the way it runs; up and down with what it stands on
    target.x = p.x + p.dir * 1.2;
    target.look = s.look - 0.8 * (p.floor - p.y0) / Math.max(EYE, p.distance);
    limit(target);
  }

  // ── following ──
  const seenAt = [0, 0, 0], fv = V3(), probe = newCamera(), seenSpan = new Float64Array(4);
  function keepInView() {
    const ids = s.follow;
    if (!ids.length || pointers.size || keys.size || glide || op.pose) return;
    // (as the viewer's own camera would show them)
    lens(probe, target, 0);
    const L = rect.x + (lim.view[0] + 0.1) * rect.w, R = rect.x + (lim.view[1] - 0.1) * rect.w;
    // (the first seen, how deep; the least and the most across: kept in an array as the loop goes — 5.16)
    const B = seenSpan;
    let seen = false;
    B[2] = Infinity; B[3] = -Infinity;
    for (let i = 0; i < ids.length; i++) {
      if (!world.pointOf(ids[i], fv) || !project(probe, fv, seen, seenAt)) continue;
      if (!seen) { seen = true; B[0] = seenAt[0]; B[1] = seenAt[2]; }
      B[2] = Math.min(B[2], seenAt[0]); B[3] = Math.max(B[3], seenAt[0]);
    }
    const first = B[0], depth = B[1], lo = B[2], hi = B[3];
    if (!seen || (lo >= L && hi <= R)) return;
    const at = hi - lo <= R - L ? (lo + hi) / 2 : first;
    target.x += (at - (L + R) / 2) * depth / rect.h;
  }
  // the viewer over the operator: a look aside, easing back once let go; a cut — or the camera riding something else —
  // takes them back to the start
  let viewerShot = state.shots, rode = null;
  function overTarget(dt) {
    if ((viewerShot !== state.shots || rode !== F.id) && s.mode !== 'platform') { viewerShot = state.shots; rode = F.id; copy(target, startPose); copy(cam, target); }
    if (!op.pose || !(op.D > 0)) return;
    if (!s.round) target.z = Math.min(target.z, startPose.z + Math.min(VIEWER_NEAR * op.D, op.D - PASS.TO));
    if (!backs()) return;
    back(target, 1 - Math.exp(-dt / VIEWER_BACK));
  }
  // whether the viewer's look aside eases back now (let go, the operator framing); a pose eased back by k
  const backs = () => !!op.pose && op.D > 0 && !(fixed() || pointers.size || keys.size || glide || now() - aimAt < 600);
  function back(p, k) {
    p.look += (startPose.look - p.look) * k; p.yaw += (startPose.yaw - p.yaw) * k;
    if (!s.round) { p.x += (startPose.x - p.x) * k; p.z += (startPose.z - p.z) * k; p.h += (startPose.h - p.h) * k; }
  }

  // ── a panorama the scene brings along ──
  // The scene's move of camera_x (scene.move — a path of it carries nothing) brings the sky from where it is shown to
  // where it says: the viewer's way aside (the target's x, and the camera's easing to it) goes, each step, the same
  // share of what is left of it as camera_x goes of what is left of its own way — the sky shown keeps to the move's
  // curve and ends where the move ends (a move to where camera_x already is: by its time); his glide stops. Under a
  // finger, what it holds stays under it: his way aside takes back what camera_x moves. camera_x set at once leaves his
  // way aside as it is, as far as the span lets it. A camera_x outside an explicit span — a move's end, a value set —
  // is said once. (lastX: camera_x a step ago; bringing — the move of it then)
  let lastX = Number(state.value('camera_x')) || 0, bringing = null, spanSaid = false;
  function within(v) {
    if (spanSaid || !s.span || (v >= s.span[0] && v <= s.span[1])) return;
    spanSaid = true;
    host.warn(`camera_x: ${v} — outside the panorama's span [${s.span[0]}, ${s.span[1]}]: the view goes there all the same, and the viewer may only come back toward the span — let the span cover every camera_x the scene sets`);
  }
  if (s.mode === 'panorama') within(lastX);
  // c: a pose, its way aside carried as camera_x goes from x0 to x1 along move a — d seconds of the `left` it had
  // (a move replacing one, from its speed, may make k less than 0: held at 0)
  function carry(c, a, x0, x1, d, left) {
    if (pointers.size) { c.x -= x1 - x0; return; }
    const to = a.args.to, k = a.paused ? 0 : Math.abs(to - x0) > 1e-6 ? clamp((x1 - x0) / (to - x0), 0, 1) : left > d ? d / left : 1;
    c.x -= (c.x - startPose.x) * k;
  }

  // ── a camera as values would have it (a shot made ready; a moment drawn as another camera sees it) ──
  // (the state as that camera is to see it: its values over the film's, there at once — alone, the camera_* keys only
  // those it names, the others as they start)
  const scratchPose = pose();
  let readyValues = null, readyAlone = false;
  const readyGet = k => (k in readyValues ? readyValues[k] : k === 'camera_glide' ? 0 : readyAlone && k.startsWith('camera_') ? null : state.value(k));
  // a Camera as `values` would have it, there at once — from the start's pose, as a cut takes the viewer there (its
  // operator o: its own, its way round kept for its shot; a passing one, made anew); alone — a camera of its own (a
  // render's view that names its target): none of the film's camera_* keys under its values
  function cameraFor(values, out, o = null, alone = false) {
    readyValues = values; readyAlone = alone;
    o ||= makeOp();
    o.pose = null; o.cut = state.cutAt; o.fresh = true; o.id = null; o.tracked = false; o.v.fill(0);
    // (in the frame of what it will ride, where its values put that)
    F = ride(readyGet, there);
    const c = copy(scratchPose, startPose);
    const r = directed(o, c, 0, readyGet, true);
    if (s.mode !== 'platform') c.h += floor(c.x, c.z);
    lens(out, c, r);
    F = here;
    return out;
  }

  // ── the step ──
  let shot = 0, views = state.views, moving = false, hasToward = false, looked = false;
  // (a pose leaned as the pointer leans the viewer — leanX: metres aside this step; one function, made once)
  let leanX = 0;
  function withLean(c) { if (s.round) { c.x += leanX * Math.cos(cam.yaw); c.z -= leanX * Math.sin(cam.yaw); } else c.x += leanX; c.look += leaned.y * LEAN / 3; }
  ride(state.value, here);
  rode = here.id;
  limitsOf();
  frameBox();
  function reset() { copy(target, startPose); if (s.mode === 'platform' && plat) target.x = plat.x; }
  plat = s.mode === 'platform' ? platformOf() : null;
  if (plat) lim.level = plat.level;
  reset(); copy(cam, target);
  // (the camera as it starts, till its first step)
  lens(camera, cam, 0);
  // a new shot: a cut, a camera's key set without `over` — the frame of it is whole before it is shown. Counted
  // right after the director's step (a cut gives its number at once: 2.1 step 6a) and again as the camera steps
  function counted() { if (state.views !== views) { views = state.views; shot++; } return shot; }
  // whole: this step's frame is its shot's first, not drawn yet (f.whole)
  function step(t, dt, whole) {
    ride(state.value, here);
    if (plat) stepHero(plat, dt);
    else if (s.round) {
      const turn = dt * 1.4, step_ = dt * 2 * EYE;
      if (keys.has('ArrowLeft')) target.yaw -= turn;
      if (keys.has('ArrowRight')) target.yaw += turn;
      if (roam()) {
        if (keys.has('w') || keys.has('ArrowUp')) stepTo(target.yaw, step_ * 1.5);
        if (keys.has('s') || keys.has('ArrowDown')) stepTo(target.yaw, -step_ * 1.5);
        if (keys.has('a')) stepTo(target.yaw - Math.PI / 2, step_);
        if (keys.has('d')) stepTo(target.yaw + Math.PI / 2, step_);
      } else {
        if (keys.has('a')) target.yaw -= turn;
        if (keys.has('d')) target.yaw += turn;
        if (keys.has('w') || keys.has('ArrowUp')) target.look -= dt * 0.6;
        if (keys.has('s') || keys.has('ArrowDown')) target.look += dt * 0.6;
      }
    } else if (!s.sway) {
      const step_ = dt * 2 * EYE;
      if (keys.has('ArrowLeft') || keys.has('a')) target.x -= step_;
      if (keys.has('ArrowRight') || keys.has('d')) target.x += step_;
      if (keys.has('ArrowUp') || keys.has('w')) target.z += step_ * 1.8;
      if (keys.has('ArrowDown') || keys.has('s')) target.z -= step_ * 1.8;
    }
    const bx = Number(state.value('camera_x')) || 0;
    if (s.mode === 'panorama') {
      // (a move of camera_x running, or just ended this step)
      const m = world.moves.moveOf('camera_x'), a = m ?? (bringing?.status === 'done' ? bringing : null);
      // (set at once: his way aside where the span lets it — the camera there with it, no slide after the whole frame)
      if (m && m !== bringing) within(m.args.to); else if (!a && bx !== lastX) { within(bx); limit(target); limit(cam); }
      if (a) { glide = null; carry(target, a, lastX, bx, dt, a.duration - a.elapsed + dt); carry(cam, a, lastX, bx, dt, a.duration - a.elapsed + dt); }
      bringing = m;
    }
    lastX = bx;
    if (s.sway) {
      // a picture breathes and leans toward the pointer
      const b = 0.25;
      target.x = (leanAt.x + b * Math.sin(t * 0.31)) * SWAY / (1 + b);
      target.look = s.look + (leanAt.y + b * Math.sin(t * 0.19 + 1)) * SWAY_LOOK / (1 + b);
    }
    keepInView();
    limit(target);
    overTarget(dt);
    if (glide && pointers.size === 0) {
      target.x += glide.vx * dt; target.look += glide.vy * dt; target.yaw += glide.vyaw * dt;
      limit(target);
      const f = Math.exp(-dt * 4);
      glide.vx *= f; glide.vy *= f; glide.vyaw *= f;
      if (Math.abs(glide.vx) + Math.abs(glide.vy) + Math.abs(glide.vyaw) < 0.005) glide = null;
    }
    // the camera eases toward the target: quickly under the finger, more softly for the wheel and keys
    const k = 1 - Math.exp(-dt * (pointers.size === 1 || glide ? 18 : 6));
    const was = Math.abs(target.x - cam.x) + Math.abs(target.look - cam.look) + Math.abs(target.z - cam.z) + Math.abs(target.h - cam.h) + Math.abs(target.yaw - cam.yaw);
    ease(cam, target, k);
    // the lean (toward the pointer, or as the phone is held — not a picture's: it breathes so already)
    const kl = 1 - Math.exp(-dt * 3);
    leaned.x += ((s.sway ? 0 : leanAt.x) - leaned.x) * kl; leaned.y += ((s.sway ? 0 : leanAt.y) - leaned.y) * kl;
    leanX = leaned.x * LEAN * EYE;
    copy(shown, cam);
    withLean(shown);
    copy(own, shown);
    if (handed) { take(handed); handed = null; }
    tilt.roll = directed(op, shown, dt, state.value, whole);
    // the eyes go over what is under them — the land, the deck it rides: as high over it under the camera (where the
    // operator has it too) as at the start — as a camera made ready has it (cameraFor)
    if (!plat) shown.h += floor(shown.x, shown.z);
    off.x = shown.x - own.x; off.z = shown.z - own.z; off.h = shown.h - own.h; off.look = shown.look - own.look; off.yaw = shown.yaw - own.yaw;
    lens(camera, shown, tilt.roll);
    world.yaw = camera.yaw;
    world.eye[0] = camera.eye[0]; world.eye[1] = camera.eye[1]; world.eye[2] = camera.eye[2];
    hiddenTarget(t);
    counted();
    // where it will be host.ahead seconds on, when it is on a path the engine knows: placed again by scene time, at
    // once as it begins and at a new shot
    // (a picture's breath and lean, and a platformer's run, are no known path; its operator and its keys moved are)
    const known = (!s.sway && !plat && (was > 0.001 || !!glide)) || (!!op.pose && op.gap > FRAMED) || world.moves.cameraMoving > 0;
    if (known && (!hasToward || shot !== placedShot || t < placedAt || t - placedAt >= host.ahead / 2)) {
      placedAt = t; placedShot = shot;
      ahead(host.ahead);
    }
    hasToward = known;
    const heroMoves = !!plat && (Math.abs(plat.vx) > 0.01 || !plat.ground);
    moving = keys.size > 0 || pointers.size > 0 || !!glide || operating() || was > 0.001 || heroMoves || !!s.sway;
  }

  // ── where the camera will be h seconds on (f.toward) ──
  // the keys as the director's moves will have them then (its one object, rewritten by world.moves.ahead), else as now
  let keysAhead = null, placedAt = 0, placedShot = -1;
  const aheadGet = k => { const A = keysAhead; for (let i = 0; i < A.n; i++) if (A.keys[i] === k) return A.values[i]; return state.value(k); };
  const targetAhead = start(), opAhead = makeOp(), poseAhead = pose();
  // → toward: in the frame of what it will ride, the viewer's pose h on (his ease to his target — going on as the glide
  // carries it, or back —, the lean as it is), the operator's glide h on to where it frames the target from now, and
  // the camera keys h on
  function ahead(h) {
    keysAhead = world.moves.ahead(h);
    F = ride(aheadGet, there);
    copy(targetAhead, target);
    const a = s.mode === 'panorama' ? world.moves.moveOf('camera_x') : null, x0 = Number(state.value('camera_x')) || 0, x1 = Number(aheadGet('camera_x')) || 0;
    if (a) { carry(targetAhead, a, x0, x1, h, a.duration - a.elapsed); limit(targetAhead, aheadGet); }
    if (glide && pointers.size === 0) {
      const g = (1 - Math.exp(-4 * h)) / 4;
      targetAhead.x += glide.vx * g; targetAhead.look += glide.vy * g; targetAhead.yaw += glide.vyaw * g;
      limit(targetAhead, aheadGet);
    } else if (backs()) back(targetAhead, 1 - Math.exp(-h / VIEWER_BACK));
    copy(going, cam);
    if (a) carry(going, a, x0, x1, h, a.duration - a.elapsed);
    ease(going, targetAhead, 1 - Math.exp(-h * (pointers.size === 1 || glide ? 18 : 6)));
    withLean(going);
    const r = filmed(going, operatorAhead(h, going), going.yaw - startPose.yaw, aheadGet);
    going.h += floor(going.x, going.z);
    lens(toward, going, r);
    F = here;
  }
  // the operator's pose h on (null: none): from where it is, along its glide — the same spring as the step's, exact
  // for any span — to where it frames the target as it is now, with the camera keys h on
  function operatorAhead(h, c) {
    if (!op.pose) return null;
    const id = aheadGet('camera_target'), o = opAhead;
    o.view = op.view; o.v.set(op.v); o.tracked = false; copy(o.aimed, op.aimed);
    const aimed = id != null && s.mode !== 'platform' && !!framing(o, String(id), c, 0, aheadGet, false, false);
    copy(ownPose, startPose);
    if (s.round) { ownPose.x = c.x; ownPose.z = c.z; }
    // (the scene's own camera: the eye's height over what is under the viewer, over the start's level as the operator's)
    ownPose.h += floor(c.x, c.z);
    const goal = aimed ? o.aimed : ownPose, q = copy(poseAhead, op.pose), u = op.vel, g = glideOf(aheadGet);
    if (g < 0.01) return copy(q, goal);
    const w = 5 / g, e = Math.exp(-w * h);
    if (s.round) goal.yaw = q.yaw + ((((goal.yaw - q.yaw) % TAU) + 3 * Math.PI) % TAU - Math.PI);
    let d = q.x - goal.x; q.x = goal.x + (d + (u.x + w * d) * h) * e;
    d = q.z - goal.z; q.z = goal.z + (d + (u.z + w * d) * h) * e;
    d = q.h - goal.h; q.h = goal.h + (d + (u.h + w * d) * h) * e;
    d = q.look - goal.look; q.look = goal.look + (d + (u.look + w * d) * h) * e;
    d = q.yaw - goal.yaw; q.yaw = goal.yaw + (d + (u.yaw + w * d) * h) * e;
    return q;
  }

  // ── the page's input (the thread passes it on: CSS px of the place) ──
  const input = {
    pointerdown(e) {
      pointers.set(e.pointerId, { x: e.x, y: e.y });
      glide = null; lastMove = now();
      if (pointers.size === 1 && !fixed() && !plat) grabAt(e.x, e.y);
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) }; }
    },
    pointermove(e) {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.x; p.y = e.y;
      if (fixed() || plat) return; // (a platformer's fingers held are its controls)
      if (pointers.size === 1) { if (grab) dragTo(e.x, e.y); }
      else if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()], dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (roam()) stepTo(target.yaw, Math.log(dist / pinch.dist) * 3 * EYE);
        else if (!s.round) walkToward(dist / pinch.dist, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pinch.dist = dist;
      }
    },
    pointerup(e) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      grab = null;
      // glide only if the finger was still moving when it let go
      if (glide && (pointers.size > 0 || now() - lastMove > 80)) glide = null;
    },
    wheel(e) {
      glide = null;
      if (fixed() || plat) return;
      if (s.round) { if (roam()) { local(e.x, e.y, lp); stepTo(target.yaw + Math.atan((lp.x - rect.w / 2) / rect.h), -e.deltaY * 0.004 * EYE); } return; }
      // a panorama: a sideways swipe (a touchpad's) carries you along
      if (s.mode === 'panorama' && Math.abs(e.deltaX) > Math.abs(e.deltaY)) { target.x += e.deltaX * 0.006 * EYE; limit(target); return; }
      walkToward(Math.exp(-e.deltaY * 0.0015), e.x, e.y);
    },
    lean(e) { leanAt.x = clamp(e.x, -1, 1); leanAt.y = clamp(e.y, -1, 1); },
    keydown(e) {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === '0') { reset(); return; }
      if (KEYS.includes(k) && !fixed()) keys.add(k);
    },
    keyup(e) { keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key); },
    blur() { keys.clear(); },
  };
  input.pointercancel = input.pointerup;

  return {
    camera, rect, seen, stage, input, step, counted, cameraFor, makeOp,
    // (this step's: where it will be host.ahead seconds on, or null; whether it moved)
    get toward() { return hasToward ? toward : null; },
    get moving() { return moving; },
    project: (p, out, from = camera) => project(from, p, seen, out),
    projectWay: (d, out, from = camera) => projectWay(from, d, seen, out),
    rayAt: (x, y, o, d) => rayOf(camera, x, y, seen, o, d),
    // the place's size, or the part of it the page leaves seen (host.view), is another
    size() { frameBox(); limit(target); },
    reset() { reset(); copy(cam, target); },
    // the scene's first frame is drawn: what is laid wrong for its camera as it starts is said (once)
    looked() { if (!looked) { looked = true; lookOver(); } },
    setup: s,
    fixed,
    // the operator on what it frames (within a centimetre — on a target that moves, as it keeps up), or not framing
    framed: () => !op.pose || op.gap < FRAMED,
    // the operator on what it frames at once (a framing finished at once): there, as after a cut
    settle() { op.fresh = true; },
    // a cut is being made: by a shot made ready (o: its operator, as cameraFor left it) or plainly (null)
    cutBy(o) { handed = o; },
    hero: (out = {}) => { if (!plat) return null; out.across = plat.x; out.elevation = plat.y; out.ground = plat.ground; return out; },
    // what the camera is now (inspect, each frame to the page): the pose shown, in the world, and its roll (into out)
    pose: (out = {}) => Object.assign(out, camera.pose),
    // ── saved and restored (the director's save): the viewer's and the operator's poses, in the frame it rides in ──
    save: () => ({ mode: s.mode, h: s.h, look: s.look, on: s.on, target: { ...target }, cam: { ...cam }, op: op.pose ? { pose: { ...op.pose }, vel: { ...op.vel }, id: op.id } : null, plat: plat && { x: plat.x, y: plat.y, vx: plat.vx, vy: plat.vy, floor: plat.floor, dir: plat.dir } }),
    restore(d) {
      // (the viewer's and the operator's poses: of a camera of the same kind — another one starts where it starts)
      // (no cut is being made any more: the operator is this camera's own)
      handed = null;
      // (camera_x as the state restored has it: what a move of it restored goes on from)
      lastX = Number(state.value('camera_x')) || 0; bringing = null;
      if (d.mode !== s.mode || d.h !== s.h || d.look !== s.look || d.on !== s.on) { views = state.views; viewerShot = state.shots; return; }
      // (riding what the state restored says: the shot goes on, on it)
      rode = op.on = ride(state.value, here).id;
      copy(target, d.target); copy(cam, d.cam);
      limit(target);
      op.pose = d.op ? copy(pose(), d.op.pose) : null;
      if (d.op) { Object.assign(op.vel, d.op.vel); op.id = d.op.id; }
      op.cut = state.cutAt; op.fresh = false; op.tracked = false; op.v.fill(0); op.view = null;
      if (plat && d.plat) Object.assign(plat, d.plat);
      views = state.views; viewerShot = state.shots;
    },
    // the next frame a new shot (a moment sought, restored, a scene shown: whole before it is shown)
    newShot() { shot++; },
  };
}
