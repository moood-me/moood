// A person's motion player: what they do, mixed — the act now and the one it goes over from (BLEND seconds), a loop's
// seam crossfaded, the gait under them as they go — always at the rate Kimodo made it: never faster, never slower. A
// gait carries them at its own pace (root motion: its stride over its loop's time, on their legs); a walk is as fast as
// its gait goes, another pace is another gait (`gaits`, blended by speed, each at its own rate), and a place moved at
// a pace no gait has is said (a warning) — not hidden by a gait played faster. Over the motion: the feet on the land and
// on what is walked on (a two-bone reach), the body laid along a slope under what touches it, off the floor between
// where it touched and where it touches next; a seat's floor under the feet; the waist and the head turned to what
// they look at; the hands and the feet to what they reach for. Once a frame, into a pose {R, T} (rig.js).
// Kimodo's motions hold each joint's turn in the person's space (global); made ready once (prepared) they are local
// turns, mixed as locals, posed once.
//   prepared(motion) → a motion made ready (its frames as local turns, where it faces, its way, its loops, its touches)
//     — some 10 ms a motion: the casts' and the engine's own are made ready at the people's build (people.js), none
//     in a tick
//   new Player({rig, fit, rest, motions, does, gait, gaits, turn, warn}) → {update(…), P, points, startOf, durationOf, speedOf,
//     save(), restore(data), like(player) — this one as that one is now: PP5}
// An update makes nothing (5.16): a number handed to a function or back by one is made on the heap each time, so
// what an update works out stays in arrays made once (the pose's, the player's, TJ and NUM below) and its functions
// take arrays and whole numbers. What is made, is made where the state changes: a new act, a hand told another thing.
import { J, AT, read, ASSETS, loadSoma, rigOf, bindLocals, pose as fk, poseOf, dir } from './rig.js';

const BLEND = 0.35;       // seconds one thing done goes over into the next
const TURN = 4.5;         // radians a second they turn at most
const LOOKING = 0.12;     // seconds the head takes to follow the eyes to a new point (most of the way)
const HEAD_TURN = 1.22, WAIST_TURN = 0.87; // radians a head turns round from the chest (70°); the waist and the chest, more (50°)
const LOOK_FLAT = [0.2, 0.5]; // the level share of the way to what is looked at over which the turn toward it comes in
const REACHING = 0.5;     // seconds a hand takes from what it held to the next thing it reaches for
const STEPS = [0.05, 0.23]; // the speed between standing and walking: shares of their slowest gait's pace
const PACE = 0.25;        // how far from every gait's pace a place may go (a share of it) before it is said
const BOX = [-0.75, -1.25, 0.75, 0.12];  // the box, heights of them round their feet
// the points the box keeps round, each with the room it leaves round it (heights): a hand's for what it holds
const ROOM = [['head', 0.12], ['hand_r', 0.38], ['hand_l', 0.38], ['foot_r', 0.12], ['foot_l', 0.12]];
// what of them touches the floor when that joint is this low (metres, a man's 1.76 m: an ankle standing, a knee
// kneeling, the pelvis sitting, a wrist on the floor, the head or the chest lying) — and which of them are the feet
const TOUCH = [['LeftFoot', 0.12], ['RightFoot', 0.12], ['LeftToeBase', 0.06], ['RightToeBase', 0.06], ['LeftShin', 0.14], ['RightShin', 0.14],
  ['Hips', 0.2], ['LeftHand', 0.1], ['RightHand', 0.1], ['Head', 0.16], ['Chest', 0.2]];
// (as numbers gone through each frame: each one's joint, how low, whether it is a foot)
const TOUCH_J = Int32Array.from(TOUCH, ([n]) => AT[n]), TOUCH_LOW = Float64Array.from(TOUCH, ([, h]) => h), TOUCH_FOOT = Uint8Array.from(TOUCH, ([n]) => (/Foot|Toe/.test(n) ? 1 : 0));
const SIDES = ['Left', 'Right'];
const LEG = SIDES.map(s => [AT[`${s}Leg`], AT[`${s}Shin`], AT[`${s}Foot`]]), ARM = SIDES.map(s => [AT[`${s}Arm`], AT[`${s}ForeArm`], AT[`${s}Hand`]]);
// (an elbow: its joint — where another's hand takes an arm above the wrist; a shoulder: where the wrist of a hand laid on it is — out from the neck by the shoulder's thickness and a little
// below its top, so the hand lies over it; behind them: the nape — where hands round their neck meet; the back — where
// arms round them hold, between the shoulder blades; a man's, as far behind the joint as the body is thick there)
export const POINTS = { head: 'Head', hand_r: 'RightHand', hand_l: 'LeftHand', hands: ['RightHand', 'LeftHand'], chest: 'Chest', hips: 'Hips', foot_r: 'RightFoot', foot_l: 'LeftFoot', feet: ['LeftToeBase', 'RightToeBase'],
  elbow_r: 'RightForeArm', elbow_l: 'LeftForeArm',
  shoulder_r: { joint: 'RightArm', from: 'Neck1', out: 0.08, up: -0.07 }, shoulder_l: { joint: 'LeftArm', from: 'Neck1', out: 0.08, up: -0.07 },
  nape: { joint: 'Neck1', back: 0.06 }, back: { joint: 'Spine2', back: 0.13 } };

// A point of theirs as its numbers (made once: what a point says in words — POINTS, a part's {joint, off, rise} —
// is read here, not each update): what it is — a joint; the middle of two; off a joint along its own axes ([side,
// up, forward] metres of a man's 1.76 m) and `rise` straight up; behind a joint; out from a joint, away from another
// —, its joints (a, b) and its numbers (n)
const JOINT = 0, MIDDLE = 1, OFF = 2, BEHIND = 3, OUT = 4, NONE = new Float64Array(0);
export function pointOf(jn) {
  if (typeof jn === 'string') return { kind: JOINT, a: AT[jn], b: 0, n: NONE };
  if (Array.isArray(jn)) return { kind: MIDDLE, a: AT[jn[0]], b: AT[jn[1]], n: NONE };
  if (jn.off) return { kind: OFF, a: AT[jn.joint], b: 0, n: Float64Array.of(jn.off[0], jn.off[1], jn.off[2], jn.rise ?? 0) };
  if (jn.back) return { kind: BEHIND, a: AT[jn.joint], b: 0, n: Float64Array.of(jn.back) };
  return { kind: OUT, a: AT[jn.joint], b: AT[jn.from], n: Float64Array.of(jn.out, jn.up) };
}

// (what was asked for not yet seen: anything is new to it)
const UNSEEN = {};
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

// ── the engine's own motions (../1/people/<name>.json, made by Kimodo: engine 1's folder holds the data) ──
const LIBRARY = { stand: 'stands', walk: 'walks' };
// (by name, once read: every one of them, whatever the casts have — a state key may name any of them later)
export const library = {};

// SOMA's skeleton at rest (the one rig of a thread), its pelvis at rest (where a frame's pelvis faces is its turn over
// this) and the engine's own motions: read once a thread, before anyone is made (a reading that failed is forgotten:
// the next scene asks again) → the rig
let soma = null, rest = null, loaded = null;
export function loadPlayer() {
  if (loaded) return loaded;
  const motions = Object.keys(LIBRARY).map(name => read(new URL(`people/${name}.json`, ASSETS), 'text').then(text => { library[name] = JSON.parse(text); }));
  const asked = loaded = Promise.all([loadSoma(), ...motions]).then(([s]) => { soma = rigOf(s); rest = bindLocals(soma); return soma; });
  asked.catch(() => { if (loaded === asked) loaded = null; });
  return asked;
}

// ── a motion made ready ────────────────────────────────────────────────
// Its frames' local turns and the pelvis's place; where it faces each frame (the pelvis's forward, levelled; lying, the
// way along the body) and its way over the floor, both smoothed over a second (what is left: the sway of its steps);
// its best loop — the stretch whose last frame is most like its first, the way gone set aside (a walk's two steps, a
// breath) — and, walked in, the stretch where it goes.
const ready = new WeakMap();
// (asked every update for what is played: the making is a function of its own — made, a motion is only found here)
export function prepared(m) { return ready.get(m) ?? made(m); }
function made(m) {
  const bytes = b64 => { const s = atob(b64), out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; };
  const n = m.n, q = new Int16Array(bytes(m.q).buffer), pos = new Int16Array(bytes(m.p ?? m.p0).buffer), step = m.p ? J : 1;
  const root = new Float32Array(n * 3);
  for (let f = 0; f < n; f++) for (let k = 0; k < 3; k++) root[f * 3 + k] = pos[f * step * 3 + k] / 1000;
  const L = localsOf(q, n), heading = headingOf(L, n);
  const half = Math.round(m.fps / 2), avg = (a, f, k = 1, o = 0) => {
    let s = 0, c = 0;
    for (let g = Math.max(0, f - half); g <= Math.min(n - 1, f + half); g++) { s += a[g * k + o]; c++; }
    return s / c;
  };
  const way = Float32Array.from({ length: n }, (_, f) => avg(heading, f));
  const path = Float32Array.from({ length: n * 2 }, (_, i) => avg(root, i >> 1, 3, (i & 1) * 2));
  const M = { n, fps: m.fps, L, root, heading, way, path, loop: null, walk: null, touch: new WeakMap() };
  M.loop = loopOf(M);
  // (walked in — a gait — the stretch where it goes: a sidestep standing still a moment before it sets off loops on
  // its steps, not on the standing; one whose best loop goes, on that)
  M.walk = M.loop.stride / ((M.loop.b - M.loop.a) / M.fps) >= 0.15 ? M.loop : loopOf(M, true);
  ready.set(m, M);
  return M;
}

// (each a function of its own: a long loop is compiled while it runs, before what comes after it has ever run — which
// would be thrown back at its first run, a motion at a time)
// each joint's turn under its parent's, of every frame: the parent's global, undone
function localsOf(q, n) {
  const L = new Float32Array(n * J * 4), parent = soma.parent;
  for (let f = 0; f < n; f++) for (let j = 0; j < J; j++) {
    const o = (f * J + j) * 4, p = parent[j];
    let x = q[o] / 32767, y = q[o + 1] / 32767, z = q[o + 2] / 32767, w = q[o + 3] / 32767;
    if (p >= 0) {
      const a = (f * J + p) * 4, ax = -q[a] / 32767, ay = -q[a + 1] / 32767, az = -q[a + 2] / 32767, aw = q[a + 3] / 32767;
      const nx = aw * x + ax * w + ay * z - az * y, ny = aw * y - ax * z + ay * w + az * x, nz = aw * z + ax * y - ay * x + az * w, nw = aw * w - ax * x - ay * y - az * z;
      x = nx; y = ny; z = nz; w = nw;
    }
    const l = 1 / (Math.sqrt(x * x + y * y + z * z + w * w) || 1);
    L[o] = x * l; L[o + 1] = y * l; L[o + 2] = z * l; L[o + 3] = w * l;
  }
  return L;
}
// where each frame faces (unwrapped). Lying, the pelvis's forward points up or down and says nothing of where they
// face: its up — the way to the head — takes over as it does, face down, and against it on the back: where the feet
// are — so a body pitched any way faces where it faced standing
function headingOf(L, n) {
  const b = soma.bind, rx = -b[0], ry = -b[1], rz = -b[2], rw = b[3], heading = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    const x0 = L[f * J * 4], y0 = L[f * J * 4 + 1], z0 = L[f * J * 4 + 2], w0 = L[f * J * 4 + 3];
    const x = w0 * rx + x0 * rw + y0 * rz - z0 * ry, y = w0 * ry - x0 * rz + y0 * rw + z0 * rx, z = w0 * rz + x0 * ry - y0 * rx + z0 * rw, w = w0 * rw - x0 * rx - y0 * ry - z0 * rz;
    // forward (0, 0, 1) and up (0, 1, 0) turned
    const dx = 2 * (x * z + y * w), dy = 2 * (y * z - x * w), dz = 1 - 2 * (x * x + y * y);
    const ux = 2 * (x * y - z * w), uz = 2 * (y * z + x * w);
    heading[f] = Math.atan2(dx - dy * ux, dz - dy * uz);
  }
  for (let f = 1; f < n; f++) heading[f] = heading[f - 1] + wrap(heading[f] - heading[f - 1]);
  return heading;
}

// a frame's pelvis turned its way off (the loop's: as it faces then), into out
function levelled(M, f, out) {
  const s = Math.sin(-M.way[f] / 2), c = Math.cos(-M.way[f] / 2), o = f * J * 4, L = M.L;
  const x = L[o], y = L[o + 1], z = L[o + 2], w = L[o + 3];
  out[0] = c * x + s * z; out[1] = c * y + s * w; out[2] = c * z - s * x; out[3] = c * w - s * y;
}

// the stretch [a, b] of a motion that loops best (0.7 s to 2.6 s long, out of its first and last quarter-second): its
// frames on the spot most alike at both ends — and the way it goes in that time (metres; a gait's stride), and which
// way that is from where it faces (radians: 0 forwards, π a walk backwards)
function loopOf(M, going = false) {
  const best = bestLoop(M, going);
  if (!best) return { a: 0, b: M.n - 1, stride: 0, aside: 0 };
  const dx = M.path[best.b * 2] - M.path[best.a * 2], dz = M.path[best.b * 2 + 1] - M.path[best.a * 2 + 1], stride = Math.sqrt(dx * dx + dz * dz);
  const aside = stride > 0.05 ? wrap(Math.atan2(dx, dz) - (M.way[best.a] + M.way[best.b]) / 2) : 0;
  return { a: best.a, b: best.b, stride, aside };
}
// (the search a function of its own, as made's loops are; the way gone weighed in every time and taken only for a
// gait: a way first taken late is no code the compiler has never seen run) → { a, b, cost } | null
function bestLoop(M, going) {
  const { n, fps, L, root } = M, ra = new Float32Array(4), rb = new Float32Array(4);
  const lo = Math.round(0.7 * fps), hi = Math.round(2.6 * fps), edge = Math.round(0.25 * fps);
  let best = null;
  for (let a = edge; a + lo < n - edge; a += 2) {
    levelled(M, a, ra);
    for (let b = a + lo; b <= Math.min(n - 1 - edge, a + hi); b++) {
      levelled(M, b, rb);
      let cost = Math.abs(root[a * 3 + 1] - root[b * 3 + 1]) * 20 + 1 - Math.abs(ra[0] * rb[0] + ra[1] * rb[1] + ra[2] * rb[2] + ra[3] * rb[3]);
      for (let j = 1; j < J; j++) {
        const oa = (a * J + j) * 4, ob = (b * J + j) * 4;
        cost += 1 - Math.abs(L[oa] * L[ob] + L[oa + 1] * L[ob + 1] + L[oa + 2] * L[ob + 2] + L[oa + 3] * L[ob + 3]);
      }
      cost -= (b - a) / fps * 0.002;  // (of two alike, the longer: whole cycles, not half of one)
      const gx = M.path[b * 2] - M.path[a * 2], gz = M.path[b * 2 + 1] - M.path[a * 2 + 1], gone = 1.5 * Math.sqrt(gx * gx + gz * gz) / ((b - a) / fps);
      cost -= going ? gone : 0;
      if (!best || cost < best.cost) best = { a, b, cost };
    }
  }
  return best;
}

// how high motion m has the pelvis at frame NUM[0] (between two frames: between theirs) — into NUM[0]
function hipsAt(m) {
  const f = NUM[0], e = m.n - 1, a = Math.floor(f), b = Math.min(e, a + 1);
  NUM[0] = m.root[a * 3 + 1] + (m.root[b * 3 + 1] - m.root[a * 3 + 1]) * (f - a);
}

// What carries them, as the player takes it (k.frame, 13 numbers): its axes — x, up, ahead (z), each of length 1 —,
// its anchor, and its turn about the vertical (radians added to their own facing: its +z levelled). Whole: a deck
// that heels, a back that tips, carries them with it as it goes and turns — none of it their own way.
// (an element's carry frame — its world matrix C, a turn and one scale — into F)
export function carrierFrame(C, F) {
  const s = Math.sqrt(C[0] * C[0] + C[1] * C[1] + C[2] * C[2]) || 1;
  for (let i = 0; i < 9; i++) F[i] = C[i] / s;
  F[9] = C[9]; F[10] = C[10]; F[11] = C[11]; F[12] = Math.atan2(C[6], -C[8]) - Math.PI;
  return F;
}
// (one turned `facing` about the vertical at x, y, z — another's arms — into F)
export function turnedFrame(x, y, z, facing, F) {
  const c = Math.cos(facing), s = Math.sin(facing);
  F[0] = c; F[1] = 0; F[2] = s; F[3] = 0; F[4] = 1; F[5] = 0; F[6] = -s; F[7] = 0; F[8] = c;
  F[9] = x; F[10] = y; F[11] = z; F[12] = facing;
  return F;
}

// a point of the world (p: x, y, z) in what carries them (F: carrierFrame's; null: the world) — along its axes, so
// that only their own place in it moves it — into out
function within(F, p, out) {
  if (!F) { out[0] = p[0]; out[1] = p[1]; out[2] = p[2]; return out; }
  const dx = p[0] - F[9], dy = p[1] - F[10], dz = p[2] - F[11];
  out[0] = dx * F[0] + dy * F[1] + dz * F[2]; out[1] = dx * F[3] + dy * F[4] + dz * F[5]; out[2] = dx * F[6] + dy * F[7] + dz * F[8];
  return out;
}

// (numbers handed from one function to the next of the player's each frame — through these, not as arguments: a number
// that goes as one is made anew, unless it is a small integer. TJ: what turnJoints turns by; NUM: one number handed
// to a function, or back by one)
const TJ = new Float64Array(10), NUM = new Float64Array(1);
// (update's and gaitsAt's numbers a branch leaves: the frame's turn, dt, how much they step, how they are turned and
// want to face; the paces below and above the speed; lay's: how far a lying body is raised)
const UN = new Float64Array(7);

// a frame of motion M as played on the spot (its way and its turn taken out: 'loop' — its smoothed way at that very
// frame; 'once' — where it ends: done once, it leaves them where they are, facing as they face), into Q (local turns)
// and R (the pelvis), weighted with what they hold (nlerp) — the frame and the weight: U [u, w]
function frameOf(M, U, mode, Q, R) {
  const u = U[0], w = U[1], f = Math.max(0, Math.min(M.n - 1, u)), a = Math.floor(f), b = Math.min(M.n - 1, a + 1), t = f - a, L = M.L, e = M.n - 1, F = FO;
  // (both ways worked out, one taken: a mode first played late is not code the compiler has never seen run)
  const loop = mode === 'loop', wy = M.way[a] * (1 - t) + M.way[b] * t, wx = M.path[a * 2] * (1 - t) + M.path[b * 2] * t, wz = M.path[a * 2 + 1] * (1 - t) + M.path[b * 2 + 1] * t;
  const ey = M.heading[e], ex = M.root[e * 3], ez = M.root[e * 3 + 2];
  F[0] = loop ? wy : ey; F[1] = loop ? wx : ex; F[2] = loop ? wz : ez;
  const yaw = F[0], ys = Math.sin(-yaw / 2), yc = Math.cos(-yaw / 2), ox = F[1], oz = F[2];
  // (whole: nothing held to mix with — w ≥ 1; else k of what is held)
  const whole = !(w < 1), k = 1 - w;
  for (let j = 0; j < J; j++) {
    const ia = (a * J + j) * 4, ib = (b * J + j) * 4, sg = t * (L[ia] * L[ib] + L[ia + 1] * L[ib + 1] + L[ia + 2] * L[ib + 2] + L[ia + 3] * L[ib + 3] < 0 ? -1 : 1);
    F[3] = L[ia] * (1 - t) + L[ib] * sg; F[4] = L[ia + 1] * (1 - t) + L[ib + 1] * sg; F[5] = L[ia + 2] * (1 - t) + L[ib + 2] * sg; F[6] = L[ia + 3] * (1 - t) + L[ib + 3] * sg;
    // (the pelvis: its way turned off)
    if (j === 0) { const x = F[3], y = F[4], z = F[5], q = F[6]; F[3] = yc * x + ys * z; F[4] = yc * y + ys * q; F[5] = yc * z - ys * x; F[6] = yc * q - ys * y; }
    const x = F[3], y = F[4], z = F[5], q = F[6], l = Math.sqrt(x * x + y * y + z * z + q * q) || 1, o = j * 4;
    if (whole) { Q[o] = x / l; Q[o + 1] = y / l; Q[o + 2] = z / l; Q[o + 3] = q / l; continue; }
    const s = w * (Q[o] * x + Q[o + 1] * y + Q[o + 2] * z + Q[o + 3] * q < 0 ? -1 : 1) / l;
    const nx = Q[o] * k + s * x, ny = Q[o + 1] * k + s * y, nz = Q[o + 2] * k + s * z, nw = Q[o + 3] * k + s * q, L2 = Math.sqrt(nx * nx + ny * ny + nz * nz + nw * nw) || 1;
    Q[o] = nx / L2; Q[o + 1] = ny / L2; Q[o + 2] = nz / L2; Q[o + 3] = nw / L2;
  }
  const px = M.root[a * 3] * (1 - t) + M.root[b * 3] * t - ox, py = M.root[a * 3 + 1] * (1 - t) + M.root[b * 3 + 1] * t, pz = M.root[a * 3 + 2] * (1 - t) + M.root[b * 3 + 2] * t - oz;
  // (the pelvis's place turned as its turn was: (0, sin, 0, cos) of −yaw about the vertical)
  const c2 = Math.cos(-yaw), s2 = Math.sin(-yaw), rx = c2 * px + s2 * pz, rz = -s2 * px + c2 * pz;
  if (whole) { R[0] = rx; R[1] = py; R[2] = rz; } else { R[0] = R[0] * k + rx * w; R[1] = R[1] * k + py * w; R[2] = R[2] * k + rz * w; }
}
// (frameOf's: its turn and its way off — yaw, ox, oz —, then a joint's turn as it is mixed: numbers a branch leaves
// are kept in an array — 5.16)
const FO = new Float64Array(7);

// a motion looped: at u frames from its loop's start (U: [u, w]), its seam crossfaded (the last quarter-second into the
// first)
const LU = new Float64Array(2);
function looped(M, U, Q, R, Lp) {
  const w = U[1], a = Lp.a, P = Lp.b - a, f = ((U[0] % P) + P) % P, x = Math.min(P / 3, M.fps * 0.25);
  LU[0] = a + f; LU[1] = w;
  frameOf(M, LU, 'loop', Q, R);
  if (f > P - x) { const u = (f - (P - x)) / x; LU[0] = a + f - P; LU[1] = w * (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u)); frameOf(M, LU, 'loop', Q, R); }
}

// ── turning the posed skeleton ─────────────────────────────────────────
const tq = new Float64Array(9);
// the joints js turned about point c, as much (w) of the turn taking direction a to b as is asked — TJ: [c, a, b, w]
function turnJoints(P, js) {
  const A = TJ, cx = A[0], cy = A[1], cz = A[2], w = A[9];
  let ax = A[3], ay = A[4], az = A[5], bx = A[6], by = A[7], bz = A[8], l = Math.sqrt(ax * ax + ay * ay + az * az) || 1; ax /= l; ay /= l; az /= l;
  l = Math.sqrt(bx * bx + by * by + bz * bz) || 1; bx /= l; by /= l; bz /= l;
  let x = ay * bz - az * by, y = az * bx - ax * bz, z = ax * by - ay * bx, q = 1 + ax * bx + ay * by + az * bz;
  if (Math.sqrt(x * x + y * y + z * z) < 1e-7) return;
  l = Math.sqrt(x * x + y * y + z * z + q * q); x /= l; y /= l; z /= l; q /= l;
  if (w < 1) { x *= w; y *= w; z *= w; q = 1 - w + q * w; l = Math.sqrt(x * x + y * y + z * z + q * q); x /= l; y /= l; z /= l; q /= l; }
  tq[0] = 1 - 2 * (y * y + z * z); tq[1] = 2 * (x * y - z * q); tq[2] = 2 * (x * z + y * q);
  tq[3] = 2 * (x * y + z * q); tq[4] = 1 - 2 * (x * x + z * z); tq[5] = 2 * (y * z - x * q);
  tq[6] = 2 * (x * z - y * q); tq[7] = 2 * (y * z + x * q); tq[8] = 1 - 2 * (x * x + y * y);
  const T = P.T, R = P.R;
  for (let i = 0; i < js.length; i++) {
    const k = js[i], o = k * 3, px = T[o] - cx, py = T[o + 1] - cy, pz = T[o + 2] - cz;
    T[o] = cx + tq[0] * px + tq[1] * py + tq[2] * pz; T[o + 1] = cy + tq[3] * px + tq[4] * py + tq[5] * pz; T[o + 2] = cz + tq[6] * px + tq[7] * py + tq[8] * pz;
    const r = k * 9;
    for (let c = 0; c < 3; c++) {
      const m0 = R[r + c], m1 = R[r + 3 + c], m2 = R[r + 6 + c];
      R[r + c] = tq[0] * m0 + tq[1] * m1 + tq[2] * m2; R[r + 3 + c] = tq[3] * m0 + tq[4] * m1 + tq[5] * m2; R[r + 6 + c] = tq[6] * m0 + tq[7] * m1 + tq[8] * m2;
    }
  }
}

// ── a person's player ─────────────────────────────────────────────────

export class Player {
  // rig, fit — their skeleton and its bones (rig.js); motions — the cast's (name → Kimodo's motion); does — what they do
  // when nothing is said; gait — how they walk; gaits — the gaits of other paces they go at (blended by speed, the
  // gait among them); turn — degrees they face at first; warn(text) — said once each
  constructor({ rig, fit, motions = {}, does = 'stand', gait = 'walk', gaits = null, turn = 180, warn }) {
    // (size: their height against Kimodo's man — what touches the floor at what height, on their legs)
    this.rig = rig; this.fit = fit; this.size = 1; this.motions = motions; this.warn = warn;
    this.P = poseOf();
    const named = name => (typeof name === 'string' && (motions[name] || LIBRARY[name]) ? name : null);
    this.named = named;
    if (!named(does)) warn(`"does": "${does}" — no such motion in its cast`);
    this.standName = named(does) ?? 'stand';
    this.gaitName = named(gait) ?? 'walk'; this.gaitRef = undefined; this.gait = this.gaitName;
    this.gaits = Array.isArray(gaits) ? gaits.filter(named) : null;
    this.turn0 = (turn * Math.PI) / 180;
    // facing: where they face in the world; own: in what carries them (its turn taken off — the world's: the same), by:
    // what that is (its id; null: the world)
    this.facing = this.turn0; this.own = this.turn0; this.by = undefined;
    // the act now and the one it goes over from — {name, loop, going, from, at (seconds), key}
    this.act = null; this.before = null; this.beforeEnd = 0; this.doRef = undefined;
    // going: where they were last (metres, in what carries them), when, how fast (m/s, smoothed); each gait under them — its
    // phase (cycles), its weight now and what it goes to; how much the gait gives way now to a motion done as they go
    this.go = { x: 0, z: 0, t: NaN, on: false, speed: 0, give: 0, slow: 0, steps: 0 };
    // (spare: the gaits' records not under them now — taken again by the next gait that comes in: none made as they go)
    this.under = []; this.spare = []; this.single = [null];
    // looking at, reaching for (points of the world, metres), each with how much of it there is now
    this.aim = { look: new Float64Array(3), lookTo: new Float64Array(3), has: false, to: false, lookW: 0,
      limbs: ['r', 'l', 'foot_r', 'foot_l'].map(h => ({ h, at: new Float64Array(3), from: new Float64Array(3), on: false, w: 0, ref: undefined, refKey: null, t0: 0, over: false })) };
    this.at = new Float64Array(3);   // where they stand (world metres: x across, y up, z = −distance)
    this.lat = new Float64Array(3);  // … in what carries them (its anchor's place and turn taken off)
    this.ground = null; this.held = false; this.dt = 0; this.seat = NaN; this.wasHeld = false; this.landing = null;
    // (numbers kept as numbers — none yet: NaN — so that each frame's are written where they are, not made anew)
    this.now = NaN; this.stopped = 0; this.clockT = 0; this.shot = undefined; this.posed = false;
    // what is mixed, posed: local turns, the pelvis
    this.Q = new Float32Array(J * 4); this.root = new Float32Array(3);
    // the arms as the motion has them, before they reach — where a hand held in another's meets it (length: the
    // arm's, one number in an array — a number kept in a field of its own is made anew where the field is read)
    this.arms = [0, 1].map(() => ({ hand: new Float64Array(3), shoulder: new Float64Array(3), length: new Float64Array(1) }));
    // (scratch: a reach's end kept as it was turned; a slope's points; a frame posed alone, off the floor)
    this.kept = new Float32Array(J * 9); this.pts = new Float64Array(TOUCH.length * 4); this.alone = poseOf(); this.lq = new Float32Array(J * 4); this.lr = new Float32Array(3);
    this.v = new Float64Array(12);
    // (a point of the world the land is asked under — x, the height, z — and the land under them now)
    this.q = new Float64Array(3); this.base = 0;
    // (a goal, a point handed on; a frame and its weight)
    this.u = new Float64Array(3); this.fu = new Float64Array(2);
    this.lie = { up: new Float64Array(3), t: new Float64Array(3), feet: false, lift: new Float64Array(2) };
    this.lie2 = { up: new Float64Array(3), t: new Float64Array(3), feet: false, lift: new Float64Array(2) };
  }

  // a motion's frames (the cast's, else the engine's)
  body(name) { return this.motions[name] ?? library[name]; }
  M(name) { return prepared(this.body(name)); }

  // where motion `name`, done once facing `turn` (degrees) at its end, begins: {across, distance, turn} from its end
  // (on their legs) — null if they have no such motion
  startOf(name, turn) {
    const b = this.named(name) && this.body(name);
    if (!b) return null;
    const m = prepared(b), e = m.n - 1, y = -m.heading[e], k = this.fit.kr;
    const dx = m.root[0] - m.root[e * 3], dz = m.root[2] - m.root[e * 3 + 2], vx = (Math.cos(y) * dx + Math.sin(y) * dz) * k, vz = (-Math.sin(y) * dx + Math.cos(y) * dz) * k;
    const f = (turn * Math.PI) / 180, c = Math.cos(f), s = Math.sin(f);
    // (Kimodo's heading turns to their left, their facing to their right: begun as far right of the end as it turns left)
    return { across: -vx * c + vz * s, distance: vx * s + vz * c, turn: turn + ((m.heading[e] - m.heading[0]) * 180) / Math.PI };
  }
  // how long motion `name` done once takes (seconds, as Kimodo made it) — null if they have no such motion
  durationOf(name) { const b = this.named(name) && this.body(name); return b ? (b.n - 1) / b.fps : null; }
  // how fast a gait carries them (m/s: its stride on their legs over its loop's time) — null if they have no such gait
  speedOf(name = this.gaitName) {
    if (!(this.named(name) && this.body(name))) return null;
    this.pace(name);
    return NUM[0];
  }
  // (a gait of theirs: how fast it carries them — into NUM[0])
  pace(name) {
    const m = this.M(name), w = m.walk;
    NUM[0] = (w.stride * this.fit.kr) / ((w.b - w.a) / m.fps);
  }

  // how long a turn of `degrees` takes them, at their own pace (as update turns them: TURN radians a second, slower
  // over the last of it)
  turnTime(degrees) {
    const a = Math.abs(wrap((degrees * Math.PI) / 180));
    return (Math.max(0, a - 0.75) + Math.log((Math.min(a, 0.75) + 0.25) / 0.25)) / TURN;
  }

  // what they are doing, as data (a moment saved: a seek, a game restored) — and back to it
  save() {
    const act = A => A && { ...A, where: A.where && [...A.where], shift: A.shift && [...A.shift] }, A = this.aim;
    return { act: act(this.act), before: act(this.before), beforeEnd: this.beforeEnd, gait: this.gait, go: { ...this.go }, under: this.under.map(g => ({ ...g })),
      facing: this.facing, own: this.own, by: this.by, lat: [...this.lat], stopped: this.stopped, now: this.now, clockT: this.clockT, shot: this.shot, posed: this.posed, wasHeld: this.wasHeld, at: [...this.at],
      landing: this.landing && { u: this.landing.u, t: [...this.landing.t] },
      aim: { look: [...A.look], lookTo: [...A.lookTo], has: A.has, to: A.to, lookW: A.lookW,
        limbs: A.limbs.map(L => ({ at: [...L.at], from: [...L.from], on: L.on, w: L.w, refKey: L.refKey, t0: L.t0, over: L.over })) } };
  }
  restore(d) {
    const act = A => A && { ...A, where: A.where && [...A.where], shift: A.shift && [...A.shift] };
    this.act = act(d.act); this.before = act(d.before); this.beforeEnd = d.beforeEnd; this.doRef = UNSEEN; this.gaitRef = UNSEEN; this.gait = d.gait;
    // (none of a number — NaN — kept as data comes back null)
    Object.assign(this.go, d.go); if (d.go.t == null) this.go.t = NaN; this.under = d.under.map(g => ({ ...g }));
    Object.assign(this, { facing: d.facing, own: d.own, by: d.by, stopped: d.stopped, now: d.now ?? NaN, clockT: d.clockT, shot: d.shot, posed: d.posed, wasHeld: d.wasHeld });
    this.at.set(d.at); this.lat.set(d.lat);
    this.landing = d.landing && this.act && { act: this.act, u: d.landing.u, t: [...d.landing.t] };
    const A = this.aim;
    A.look.set(d.aim.look); A.lookTo.set(d.aim.lookTo); Object.assign(A, { has: d.aim.has, to: d.aim.to, lookW: d.aim.lookW });
    A.limbs.forEach((L, i) => { const s = d.aim.limbs[i]; L.at.set(s.at); L.from.set(s.from); Object.assign(L, { on: s.on, w: s.w, refKey: s.refKey, t0: s.t0, over: s.over, ref: undefined }); });
  }

  // This player as another is now (PP5: the people's own player, on which a person is posed as a cut will set them —
  // nothing of `from` is touched, nothing made): who they are — their bones, their motions, their gaits — and what a
  // cut does not set anew: what they do and since when, their clock, where they are and how they face in what carries
  // them, what they look at and reach for. What a cut sets anew — the gaits under them, the act gone over from — is
  // left to update(), told a new shot. What it warns of stays its own (the people's own player says nothing)
  like(from) {
    this.rig = from.rig; this.fit = from.fit; this.size = from.size; this.motions = from.motions; this.named = from.named;
    this.standName = from.standName; this.gaitName = from.gaitName; this.gaits = from.gaits; this.turn0 = from.turn0;
    this.gaitRef = from.gaitRef; this.gait = from.gait; this.doRef = from.doRef; this.act = from.act; this.before = null; this.beforeEnd = from.beforeEnd;
    this.facing = from.facing; this.own = from.own; this.by = from.by;
    const g = this.go, f = from.go;
    // (where they were is no way gone, across a cut)
    g.x = f.x; g.z = f.z; g.t = f.t; g.on = false; g.speed = f.speed; g.give = f.give; g.slow = f.slow; g.steps = f.steps;
    this.at.set(from.at); this.lat.set(from.lat);
    this.now = from.now; this.stopped = from.stopped; this.clockT = from.clockT; this.posed = from.posed; this.wasHeld = from.wasHeld; this.landing = from.landing;
    const A = this.aim, B = from.aim;
    A.look.set(B.look); A.lookTo.set(B.lookTo); A.has = B.has; A.to = B.to; A.lookW = B.lookW;
    for (let i = 0; i < A.limbs.length; i++) {
      const L = A.limbs[i], M = B.limbs[i];
      L.at.set(M.at); L.from.set(M.from); L.on = M.on; L.w = M.w; L.ref = M.ref; L.refKey = M.refKey; L.t0 = M.t0; L.over = M.over;
    }
    // (a new shot at its next update, whatever number it is told)
    this.shot = NaN;
  }

  actOf(v, t) {
    const d = typeof v === 'string' ? { motion: v } : v && typeof v === 'object' ? v : { motion: this.standName };
    const name = this.named(d.motion) ?? (d.motion != null && d.motion !== this.standName ? (this.warn(`"${d.motion}" — no such motion in its cast`), this.standName) : this.standName);
    const loop = d.loop ?? name === this.standName;
    return { name, loop, going: !loop && d.going === true, from: Number(d.from) || 0, at: t, key: JSON.stringify(d), where: null, shift: null };
  }
  // (a motion done once: still being played — as they go: playing)
  played(A) { const m = this.M(A.name); return (A.from + this.clockT - A.at) * m.fps < m.n - 1; }
  playing(A) { return !!A && A.going && this.played(A); }
  // (what A has them do now — its frame on their clock — as much as fu[1] says)
  actPose(A) {
    const m = this.M(A.name), U = this.fu;
    U[0] = (A.from + this.clockT - A.at) * m.fps;
    if (A.loop) looped(m, U, this.Q, this.root, m.loop); else frameOf(m, U, A.going ? 'loop' : 'once', this.Q, this.root);
  }

  // all they do now, mixed (at their own clock's now)
  sample() {
    const Q = this.Q, R = this.root, U = this.fu, t = this.clockT;
    if (!this.act) { Q.set(rest); R[0] = 0; R[1] = 0.93; R[2] = 0; return; }
    U[1] = 1;
    this.actPose(this.act);
    const B = this.before;
    if (B && t < this.beforeEnd) {
      const u = (t - this.act.at) / BLEND, w = 1 - (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
      U[1] = w;
      this.actPose(B);
      if (B.shift) for (let k = 0; k < 3; k++) R[k] += B.shift[k] * w;
    }
    // the gaits under them, each at its own rate, as much as they walk (giving way to a motion done as they go)
    const gv = this.go.give, give = 1 - (gv <= 0 ? 0 : gv >= 1 ? 1 : gv * gv * (3 - 2 * gv));
    for (let i = 0; i < this.under.length; i++) {
      const g = this.under[i];
      if (g.w * give <= 0.001) continue;
      const m = this.M(g.name);
      U[0] = g.phase * (m.walk.b - m.walk.a); U[1] = g.w * give;
      looped(m, U, Q, R, m.walk);
    }
  }

  // (a point of the person's own space — p's at i — in the world, into out at o; and back)
  world(p, i, out, o = 0) {
    const c = Math.cos(this.facing), s = Math.sin(this.facing), x = p[i], y = p[i + 1], z = p[i + 2];
    out[o] = this.at[0] - c * x + s * z; out[o + 1] = this.at[1] + y; out[o + 2] = this.at[2] - s * x - c * z;
    return out;
  }
  local(p, i, out, o = 0) {
    const c = Math.cos(this.facing), s = Math.sin(this.facing), dx = p[i] - this.at[0], dz = p[i + 2] - this.at[2];
    out[o] = -c * dx - s * dz; out[o + 1] = p[i + 1] - this.at[1]; out[o + 2] = s * dx - c * dz;
    return out;
  }
  // the land under a point of their own space (p's at i: its x and z), above the land under them — into q[1]
  rel(p, i) {
    const q = this.world(p, i, this.q);
    this.ground(q);
    q[1] -= this.base;
  }

  // The moment: at — where they stand (world metres) and the moment now (seconds): [x, y, z, now]; k — what the state says of them now: {do, turn
  // (degrees, in what carries them), look: [x, y, z] | null, reach: {r, l, foot_r, foot_l} each [x, y, z] | null, refs:
  // what each reach names (a hand going over from one to another), gait, steps, held, floor, still, by: what carries
  // them (an id; null: nothing), frame: its axes, anchor and turn (carrierFrame's 13 numbers; null: the world's), placed: put where they are at once this step (no way walked)}. Carried, they go and
  // turn with it: their way gone and their turn are in it — a deck
  // under way, a carriage at speed, a ship turning walks no one; only their own place in it does. ground(p) — the land under them
  // (p: a point of the world, x and z, its height put in p[1]), null on another's arms; shot — the state's shots: in a
  // new one they are already where it has them, doing what it says, facing as they are turned, looking and reaching at
  // what they do — nothing gone over from before; here — whether they are in the scene now: one who is not keeps
  // their state (what they do, where they are, how they face, their clock) and is not posed
  update(at, k, ground, shot, here = true) {
    const ax = at[0], ay = at[1], az = at[2], now = at[3];
    // (where they stand in what carries them: its whole frame taken off — its place, turn, tilt — their own place there)
    // (N: numbers a branch leaves — kept in an array, not made by the merge of two ways: 5.16)
    const F = k.frame, N = UN, lo = within(F, at, this.u), lx = lo[0], ly = lo[1], lz = lo[2];
    if (F) N[0] = F[12]; else N[0] = 0;
    const yaw = N[0];
    // (carried by another now — or by none, or by something at last: where they were, and how they faced, in it; set
    // on it or let down from it, they are put where they are — no way walked: their way gone begins anew there)
    const by = k.by ?? null;
    if (by !== this.by) {
      this.by = by;
      if (this.posed) within(F, this.at, this.lat);
      this.own = this.facing - yaw;
      this.go.on = false;
    }
    this.ground = ground; this.held = !!k.held;
    if (this.held && typeof k.floor === 'number') this.seat = k.floor; else this.seat = NaN;
    if (ground) { const q = this.q; q[0] = ax; q[2] = az; ground(q); this.base = q[1]; }
    // (their own time: it stands while they are still — the pose of that moment held, no breath — and goes on from
    // there when they are let go)
    if (k.still && this.now === this.now) this.stopped += now - this.now;
    this.now = now;
    const t = now - this.stopped, cut = shot !== this.shot, go = this.go;
    this.clockT = t; this.shot = shot;
    // (how they walk now: a gait of theirs; a new one goes over from the one before)
    if (k.gait !== this.gaitRef) {
      this.gaitRef = k.gait;
      this.gait = k.gait != null ? this.named(k.gait) ?? (this.warn(`"gait": "${k.gait}" — no such motion in its cast`), this.gaitName) : this.gaitName;
    }
    const gait = this.gait;
    // (a new act: over from what was being done)
    if (k.do !== this.doRef || !this.act) { this.doRef = k.do; this.begin(this.actOf(k.do, t), t); }
    // (a new shot: where they were before it is no way gone — how fast they go, they go on at; put somewhere at once —
    // their place, or what carries them, set, not moved: no way walked either)
    if (cut) { this.before = null; go.on = false; while (this.under.length) this.spare.push(this.under.pop()); }
    else if (k.placed) go.on = false;
    // going: the way gone since the last moment, as fast as that
    if (go.t !== go.t) N[1] = 0; else N[1] = Math.max(0, t - go.t);
    const dt = N[1];
    let way = null;
    if (go.on && dt > 0) {
      const dx = lx - go.x, dz = lz - go.z, d = Math.sqrt(dx * dx + dz * dz);
      go.speed += (d / dt - go.speed) * Math.min(1, dt / 0.15);
      if (d > 1e-4) way = Math.atan2(dx, -dz);
    }
    go.t = t; go.x = lx; go.z = lz; go.on = true;
    // (the gait gives way to a motion done as they go while it is played, and comes back as it ends)
    const playing = this.playing(this.act);
    if (cut) go.give = playing ? 1 : 0; else go.give += Math.max(-(1 / BLEND) * dt, Math.min((1 / BLEND) * dt, (playing ? 1 : 0) - go.give));
    // (moved without steps — sliding, carried — they are moved as they are)
    this.paceOf(gait);
    const pace = NUM[0], su = (go.speed / pace - STEPS[0]) / (STEPS[1] - STEPS[0]);
    if (k.steps === false || !pace || su <= 0) N[2] = 0; else if (su >= 1) N[2] = 1; else N[2] = su * su * (3 - 2 * su);
    const steps = N[2];
    go.steps = steps; this.dt = dt;
    this.gaitsAt(gait, cut, k.steps === false);
    // facing: the way they go while they go (as their gait faces it: a walk backwards, away from it), else where they
    // are turned — and in a motion done once, its end's at once (the motion turns them itself, from where it began);
    // both in what carries them, turned with it
    if (typeof k.turn === 'number') N[3] = (k.turn * Math.PI) / 180; else N[3] = this.turn0;
    const turned = N[3];
    const aside = this.M(gait).walk.aside;
    // (the gait's way aside is to their left, their facing to their right; a motion done once turns them while it is
    // played — held at its end, they turn as they would)
    if (way != null && steps > 0.05) N[4] = way + aside; else N[4] = turned;
    const want = N[4], d = Math.atan2(Math.sin(want - this.own), Math.cos(want - this.own));
    if (cut || (this.act && !this.act.loop && steps < 0.05 && this.played(this.act))) this.own = turned;
    else this.own += Math.sign(d) * Math.min(Math.abs(d), TURN * dt * Math.min(1, 0.25 + Math.abs(d)));
    this.facing = this.own + yaw;
    const B = this.before;
    if (B?.where) {
      const dx = B.where[0] - lx, dz = B.where[1] - lz, c = Math.cos(this.own), s = Math.sin(this.own), kr = this.fit.kr || 1;
      // (in the motion's own metres: the skeleton takes the pelvis's place as long as their legs make it)
      B.shift = [(-c * dx - s * dz) / kr, 0, (s * dx - c * dz) / kr]; B.where = null;
    }
    this.aims(k, cut);
    // (let down from a seat or another's arms into a motion done once: from where they were held — in their own space,
    // in what carries them)
    if (!cut && this.wasHeld && !k.held && this.posed && this.act && !this.act.loop) {
      const dx = this.lat[0] - lx, dy = this.lat[1] - ly, dz = this.lat[2] - lz, c = Math.cos(this.own), s = Math.sin(this.own);
      this.landing = { act: this.act, u: (this.act.from + t - this.act.at) * this.M(this.act.name).fps, t: [-c * dx - s * dz, dy, s * dx - c * dz] };
    } else if (this.landing && this.landing.act !== this.act) this.landing = null;
    this.wasHeld = !!k.held;
    this.at[0] = ax; this.at[1] = ay; this.at[2] = az; this.lat[0] = lx; this.lat[1] = ly; this.lat[2] = lz;
    if (!here) return;
    this.sample();
    fk(this.rig, this.fit, this.Q, this.root, this.P);
    this.after();
    this.posed = true;
  }

  // a new act — `next`, begun at t (their own clock) — over from what was being done; the same as is being done: on
  // with that
  begin(next, t) {
    if (this.act && next.key === this.act.key) return;
    const go = this.go;
    this.before = this.act; this.beforeEnd = t + BLEND; this.act = next;
    // (a motion done once begins where it takes them from: their place is its end's now, which is no step taken —
    // and what they did before goes over into it from where it was done; one done as they go is played on the spot)
    if (!next.loop && !next.going) { if (this.before && go.on) this.before.where = [go.x, go.z]; go.on = false; go.speed = 0; }
  }

  // The gaits under them now: the gait — or, with gaits of other paces, the two whose paces the speed is between, by
  // how near it is to each — as much as they walk; each at its own rate (its phase in cycles of its loop going on by
  // time, never by the way gone); a gait just taken comes in at the phase of the one it takes over from
  // (as fast as they go, as much as they step, over the moment since the last: go's, dt)
  gaitsAt(gait, cut, slide) {
    const steps = this.go.steps, speed = this.go.speed, dt = this.dt, set = this.gaits?.includes(gait) ? this.gaits : (this.single[0] = gait, this.single), under = this.under;
    let lead = null;
    for (let i = 0; i < under.length; i++) { const g = under[i]; g.to = 0; if (!lead || g.w > lead.w) lead = g; }
    // (the paces: each gait's own on their legs)
    // (V: the paces below and above the speed, found — kept in an array as the loop goes)
    const V = UN;
    let lo = null, hi = null;
    V[5] = 0; V[6] = 0;
    for (let i = 0; i < set.length; i++) {
      const name = set[i];
      this.pace(name);
      const v = NUM[0];
      if (v <= speed && (!lo || v > V[5])) { lo = name; V[5] = v; }
      if (v >= speed && (!hi || v < V[6])) { hi = name; V[6] = v; }
    }
    const vlo = V[5], vhi = V[6];
    if (lo && hi && vhi - vlo > 1e-6) { this.gaitTo(lo, lead).to = steps * (vhi - speed) / (vhi - vlo); this.gaitTo(hi, lead).to = steps * (speed - vlo) / (vhi - vlo); }
    else if (lo || hi) this.gaitTo(lo ?? hi, lead).to = steps;
    for (let i = under.length - 1; i >= 0; i--) {
      const g = under[i];
      if (cut) g.w = g.to; else g.w += Math.max(-(1 / BLEND) * dt, Math.min((1 / BLEND) * dt, g.to - g.w));
      g.phase += dt / g.period;
      // (gone: its record spare, those after it one place down)
      if (g.w <= 0 && g.to <= 0) { for (let k = i + 1; k < under.length; k++) under[k - 1] = under[k]; under.pop(); this.spare.push(g); }
    }
    // (a place going at a pace no gait of theirs has, a while: said — steps false, or a gait of that pace)
    const one = lo && hi && vhi - vlo > 1e-6 ? null : lo ?? hi, pace = one === lo ? vlo : vhi;
    const off = one && steps > 0.9 && !slide && Math.abs(speed - pace) > PACE * pace, was = this.go.slow;
    this.go.slow = off ? was + dt : 0;
    if (was <= 0.5 && this.go.slow > 0.5) this.warn(`moved ${speed > pace ? 'faster' : 'slower'} than its gait "${one}" goes (${pace.toFixed(2)} m/s on these legs): "steps": false, or a gait of that pace`);
  }
  // (the slowest pace of the gaits they go at: the gait's, or the slowest of `gaits` — into NUM[0])
  paceOf(gait) {
    const set = this.gaits?.includes(gait) ? this.gaits : null;
    this.pace(gait);
    let v = NUM[0];
    if (set) for (let i = 0; i < set.length; i++) { this.pace(set[i]); if (NUM[0] < v) v = NUM[0]; }
    NUM[0] = v;
  }
  // (the gait `name` under them, whose weight the caller says where it goes to — new, at the phase of the one it
  // takes over from)
  gaitTo(name, lead) {
    let g = null;
    for (let i = 0; i < this.under.length; i++) if (this.under[i].name === name) g = this.under[i];
    if (!g) {
      const m = this.M(name);
      g = this.spare.pop() ?? { name: '', phase: 0, w: 0, to: 0, period: 0 };
      g.name = name; g.phase = lead ? lead.phase % 1 : 0; g.w = 0; g.to = 0; g.period = (m.walk.b - m.walk.a) / m.fps;
      this.under.push(g);
    }
    return g;
  }

  // what they look at and reach for, coming and going
  aims(k, cut) {
    const A = this.aim, t = this.clockT, dt = this.dt;
    // (the eyes go to a new point at once, the head after them in a moment — a nod, a glance from one to another)
    if (k.look) { A.lookTo[0] = k.look[0]; A.lookTo[1] = k.look[1]; A.lookTo[2] = k.look[2]; A.to = true; }
    if (cut) A.lookW = k.look ? 1 : 0; else A.lookW += Math.max(-2.2 * dt, Math.min(2.2 * dt, (k.look ? 1 : 0) - A.lookW));
    if (A.to) {
      if (cut || !A.has || A.lookW < 0.01) A.look.set(A.lookTo);
      else { const u = Math.min(1, dt / LOOKING); for (let c = 0; c < 3; c++) A.look[c] += (A.lookTo[c] - A.look[c]) * u; }
      A.has = true;
    }
    // (a hand on one thing, told to another — off the lid onto a friend's hand — goes over to it from where it was, in
    // a moment; not at once)
    for (let i = 0; i < A.limbs.length; i++) {
      const L = A.limbs[i], g = k.reach?.[L.h], ref = g ? k.refs?.[L.h] : undefined;
      if (g) {
        if (ref !== L.ref) {
          const key = JSON.stringify(ref ?? null);
          if (!cut && L.on && L.w > 0.01 && L.refKey != null && key !== L.refKey) { L.from.set(L.at); L.t0 = t; L.over = true; }
          L.ref = ref; L.refKey = key;
        }
      }
      if (cut || !g) L.over = false;
      const u = L.over ? (t - L.t0) / REACHING : 1;
      if (u >= 1) L.over = false;
      if (g) {
        if (L.over) { const s = u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u); for (let c = 0; c < 3; c++) L.at[c] = L.from[c] + (g[c] - L.from[c]) * s; }
        else { L.at[0] = g[0]; L.at[1] = g[1]; L.at[2] = g[2]; }
        L.on = true;
      }
      if (cut) L.w = g ? 1 : 0; else L.w += Math.max(-2.5 * dt, Math.min(2.5 * dt, (g ? 1 : 0) - L.w));
    }
  }

  // ── over the motion ──────────────────────────────────────────────────
  // The feet on the ground, the body turned at the waist to look further round than a head turns, the hands to what
  // they reach for, the head to what they look at
  after() {
    const P = this.P, T = P.T, rig = this.rig, v = this.v, A = this.aim;
    this.feet();
    // (looking further round than 70° — back over a shoulder: the waist and the chest turn the rest, up to 50° more,
    // the hips going on as the motion has them)
    const lw = A.lookW, w = lw <= 0 ? 0 : lw >= 1 ? 1 : lw * lw * (3 - 2 * lw);
    if (w > 0.002 && A.has) {
      this.lookYaw();
      const yaw = v[9], over = Math.sign(yaw) * Math.min(Math.max(0, Math.abs(yaw) - HEAD_TURN), WAIST_TURN) * w;
      const cx = v[3], cz = v[5];
      if (Math.abs(over) > 1e-3) for (let i = 0; i < WAIST_J.length; i++) {
        const j = WAIST_J[i], a = over * WAIST_SHARE[i];
        TJ[0] = T[j * 3]; TJ[1] = T[j * 3 + 1]; TJ[2] = T[j * 3 + 2]; TJ[3] = cx; TJ[4] = 0; TJ[5] = cz;
        TJ[6] = cx * Math.cos(a) + cz * Math.sin(a); TJ[7] = 0; TJ[8] = -cx * Math.sin(a) + cz * Math.cos(a); TJ[9] = 1;
        turnJoints(P, rig.below(j));
      }
    }
    for (let s = 0; s < 2; s++) {
      const a = ARM[s][0], b = ARM[s][1], c = ARM[s][2], arm = this.arms[1 - s];  // (arms: r, l — SIDES: Left, Right)
      this.world(T, c * 3, arm.hand);
      this.world(T, a * 3, arm.shoulder);
      const ux = T[a * 3] - T[b * 3], uy = T[a * 3 + 1] - T[b * 3 + 1], uz = T[a * 3 + 2] - T[b * 3 + 2], fx = T[b * 3] - T[c * 3], fy = T[b * 3 + 1] - T[c * 3 + 1], fz = T[b * 3 + 2] - T[c * 3 + 2];
      arm.length[0] = Math.sqrt(ux * ux + uy * uy + uz * uz) + Math.sqrt(fx * fx + fy * fy + fz * fz);
    }
    // the hands to what they reach for; a foot too — the leg's reach, the sole as it was turned
    for (let i = 0; i < A.limbs.length; i++) {
      const L = A.limbs[i], w2 = L.w <= 0 ? 0 : L.w >= 1 ? 1 : L.w * L.w * (3 - 2 * L.w);
      if (w2 < 0.002 || !L.on) continue;
      const chain = L.h === 'r' ? ARM[1] : L.h === 'l' ? ARM[0] : L.h === 'foot_r' ? LEG[1] : LEG[0], tip = chain[2];
      this.local(L.at, 0, v);
      for (let c = 0; c < 3; c++) v[c] = T[tip * 3 + c] + (v[c] - T[tip * 3 + c]) * w2;
      this.reach(chain, v, 0, L.h[0] === 'f');
    }
    // the head turned to it, no further than a head turns (70° round from the chest's forward, 40° up or down), the
    // neck taking part of it
    if (w > 0.002 && A.has) {
      this.lookYaw();
      const yaw = Math.max(-HEAD_TURN, Math.min(HEAD_TURN, v[9])), pitch = Math.max(-0.7, Math.min(0.7, Math.asin(Math.max(-1, Math.min(1, v[1])))));
      const cx = v[3], cz = v[5], lx = cx * Math.cos(yaw) + cz * Math.sin(yaw), lz = -cx * Math.sin(yaw) + cz * Math.cos(yaw);
      const gx = lx * Math.cos(pitch), gy = Math.sin(pitch), gz = lz * Math.cos(pitch), head = AT.Head;
      for (let n = 0; n < NECK_J.length; n++) {
        const i = NECK_J[n];
        dir(rig, P, head, 0, 0, 1, v, 6);
        TJ[0] = T[i * 3]; TJ[1] = T[i * 3 + 1]; TJ[2] = T[i * 3 + 2]; TJ[3] = v[6]; TJ[4] = v[7]; TJ[5] = v[8]; TJ[6] = gx; TJ[7] = gy; TJ[8] = gz; TJ[9] = w * NECK_SHARE[n];
        turnJoints(P, rig.below(i));
      }
    }
  }
  // how far round from the chest's forward the head is to turn to look at what it looks at (radians, + to their left)
  // — into v[9]; v[0…2]: the way to it from the head, v[3…5]: the chest's forward, levelled. What lies steeply below
  // or above the head (their own hands, the floor at their feet) has a level way that is short and turns with every
  // small move: the turn goes as far as that way is long (LOOK_FLAT) — none within 12° of the vertical, all of it
  // from 30° off it —, so they look down at it rather than round
  lookYaw() {
    const P = this.P, T = P.T, v = this.v, h = AT.Head * 3;
    this.local(this.aim.look, 0, v);
    let x = v[0] - T[h], y = v[1] - T[h + 1], z = v[2] - T[h + 2], l = Math.sqrt(x * x + y * y + z * z) || 1;
    v[0] = x / l; v[1] = y / l; v[2] = z / l;
    dir(this.rig, P, AT.Chest, 0, 0, 1, v, 3);
    l = Math.sqrt(v[3] * v[3] + v[5] * v[5]) || 1; v[3] /= l; v[4] = 0; v[5] /= l;
    const flat = Math.sqrt(v[0] * v[0] + v[2] * v[2]), u = Math.max(0, Math.min(1, (flat - LOOK_FLAT[0]) / (LOOK_FLAT[1] - LOOK_FLAT[0])));
    l = flat || 1; x = v[0] / l; z = v[2] / l;
    v[9] = Math.atan2(v[5] * x - v[3] * z, v[3] * x + v[5] * z) * u * u * (3 - 2 * u);
  }

  // a limb (three joints: its root, its bend, its end) reaching for the goal in g (at o) — the root's bone turned, then
  // the bend's, in the plane the limb bends in now; what is below the end as it was turned (a sole, a hand) if `keep`
  reach(chain, g, o, keep) {
    const gx = g[o], gy = g[o + 1], gz = g[o + 2], a = chain[0], b = chain[1], c = chain[2], P = this.P, T = P.T, R = P.R, rig = this.rig, end = rig.below(c);
    if (keep) for (let i = 0; i < end.length; i++) for (let c = 0; c < 9; c++) this.kept[i * 9 + c] = R[end[i] * 9 + c];
    const rx = T[a * 3], ry = T[a * 3 + 1], rz = T[a * 3 + 2], bx = T[b * 3], by = T[b * 3 + 1], bz = T[b * 3 + 2];
    const ux = bx - rx, uy = by - ry, uz = bz - rz, ex = T[c * 3] - bx, ey = T[c * 3 + 1] - by, ez = T[c * 3 + 2] - bz;
    const la = Math.sqrt(ux * ux + uy * uy + uz * uz), lb = Math.sqrt(ex * ex + ey * ey + ez * ez);
    let dx = gx - rx, dy = gy - ry, dz = gz - rz, l = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const lc = Math.max(Math.abs(la - lb) + 1e-4, Math.min(l, la + lb - 1e-4));
    l ||= 1; dx /= l; dy /= l; dz /= l;
    const along = ux * dx + uy * dy + uz * dz;
    let px = ux - dx * along, py = uy - dy * along, pz = uz - dz * along;
    l = Math.sqrt(px * px + py * py + pz * pz);
    if (l > 1e-6) { px /= l; py /= l; pz /= l; } else { l = la || 1; px = ux / l; py = uy / l; pz = uz / l; }
    const ca = Math.max(-1, Math.min(1, (la * la + lc * lc - lb * lb) / (2 * la * lc))), sa = Math.sqrt(1 - ca * ca);
    const tx = dx * la * ca + px * la * sa, ty = dy * la * ca + py * la * sa, tz = dz * la * ca + pz * la * sa;
    TJ[0] = rx; TJ[1] = ry; TJ[2] = rz; TJ[3] = ux; TJ[4] = uy; TJ[5] = uz; TJ[6] = tx; TJ[7] = ty; TJ[8] = tz; TJ[9] = 1;
    turnJoints(P, rig.below(a));
    const b2x = T[b * 3], b2y = T[b * 3 + 1], b2z = T[b * 3 + 2];
    TJ[0] = b2x; TJ[1] = b2y; TJ[2] = b2z; TJ[3] = T[c * 3] - b2x; TJ[4] = T[c * 3 + 1] - b2y; TJ[5] = T[c * 3 + 2] - b2z; TJ[6] = gx - b2x; TJ[7] = gy - b2y; TJ[8] = gz - b2z; TJ[9] = 1;
    turnJoints(P, rig.below(b));
    if (keep) for (let i = 0; i < end.length; i++) for (let c = 0; c < 9; c++) R[end[i] * 9 + c] = this.kept[i * 9 + c];
  }

  // On uneven ground (a relief, what is walked on) they touch the land where the motion touches its floor. Standing,
  // walking — the feet alone: the pelvis lowered as far as the lower foot's ground is below where the motion stands
  // (the whole of them with it), the other leg bent at the knee till its foot is on its own ground (a two-bone reach),
  // each foot as it was turned. Sitting, kneeling, lying, leaning on a hand — the body as it is, laid along the land
  // under what touches it (the slope through those points, held level where they are close together) and raised till
  // none of them is in it. Off the floor (a leap): from how they lay where they last touched it to how they lie where
  // they touch it next.
  feet() {
    const P = this.P, T = P.T, land = !this.held && this.ground;
    if (this.seat === this.seat) this.floored();
    const now = land && this.laid(T, this.lie), off = land && !now && this.act && !this.act.loop && this.between(this.act);
    if (now) {
      this.lay(this.lie);
      if (this.lie.feet) for (let i = 0; i < 2; i++) {
        const lift = this.lie.lift[i], f = LEG[i][2];
        const g = this.u;
        g[0] = T[f * 3]; g[1] = T[f * 3 + 1] + lift; g[2] = T[f * 3 + 2];
        if (lift >= 0.003) this.reach(LEG[i], g, 0, true);
      }
    } else if (off) this.lay(off);
    // (let down from a seat or another's arms into a motion done once: where they were held, left as it goes)
    const L = this.landing;
    let k = 0;
    if (L && L.act === this.act) { this.landed(this.act); k = 1 - NUM[0]; }
    if (k > 0.001) {
      const lie = this.lie2;
      lie.up[0] = 0; lie.up[1] = 1; lie.up[2] = 0; lie.t[0] = L.t[0] * k; lie.t[1] = L.t[1] * k; lie.t[2] = L.t[2] * k;
      this.lay(lie);
    }
  }
  // Sat on a seat: the feet the motion has on its floor set on the floor under the seat, as far as the legs reach with
  // the knee still bent — a low seat, the knees up; a seat a little high, the feet down to the floor; a high one (a
  // barrel, a child on a stool it can't reach the floor from), the legs hang as the motion has them
  floored() {
    const T = this.P.T;
    for (let i = 0; i < 2; i++) {
      const hp = LEG[i][0], kn = LEG[i][1], f = LEG[i][2], px = T[f * 3], py = T[f * 3 + 1], pz = T[f * 3 + 2];
      if (py >= 0.12 * this.size) continue;
      const q = this.world(T, f * 3, this.q);
      if (this.ground) this.ground(q);
      const gy = py + (this.ground ? q[1] : 0) + this.seat - this.at[1];
      const tx = T[hp * 3] - T[kn * 3], ty = T[hp * 3 + 1] - T[kn * 3 + 1], tz = T[hp * 3 + 2] - T[kn * 3 + 2], sx = T[kn * 3] - px, sy = T[kn * 3 + 1] - py, sz = T[kn * 3 + 2] - pz;
      const lh = Math.sqrt(tx * tx + ty * ty + tz * tz) + Math.sqrt(sx * sx + sy * sy + sz * sz), dx = T[hp * 3] - px, dy = T[hp * 3 + 1] - gy, dz = T[hp * 3 + 2] - pz;
      const g = this.u;
      g[0] = px; g[1] = gy; g[2] = pz;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 0.9 * lh) this.reach(LEG[i], g, 0, true);
    }
  }
  // how far a motion done once has gone from its first pose to its last (0…1): by the hips' height, when it rises or
  // sinks (off a high seat onto the feet), else by its time — from where it was when they were let down; into NUM[0]
  landed(A) {
    const m = this.M(A.name), e = m.n - 1, u = Math.max(0, Math.min(e, (A.from + this.clockT - A.at) * m.fps)), u0 = Math.min(this.landing.u, e);
    NUM[0] = u0; hipsAt(m);
    const y0 = NUM[0];
    NUM[0] = e; hipsAt(m);
    const y1 = NUM[0];
    NUM[0] = u; hipsAt(m);
    const s = Math.abs(y1 - y0) > 0.05 ? (NUM[0] - y0) / (y1 - y0) : (u - u0) / Math.max(1, e - u0);
    NUM[0] = s <= 0 ? 0 : s >= 1 ? 1 : s * s * (3 - 2 * s);
  }
  // how they lie on the land as joints T are now: into lie {up, t} — turned (the floor's up to the
  // land's) about their origin, then moved by t; feet: each foot's lift above the lower one (standing) — false:
  // nothing of them on the floor
  laid(T, lie) {
    const pts = this.pts, h = this.size;
    let n = 0, feet = true;
    for (let i = 0; i < TOUCH_J.length; i++) {
      const j = TOUCH_J[i];
      if (T[j * 3 + 1] < TOUCH_LOW[i] * h) { pts[n * 4] = T[j * 3]; pts[n * 4 + 1] = T[j * 3 + 1]; pts[n * 4 + 2] = T[j * 3 + 2]; n++; feet &&= TOUCH_FOOT[i] === 1; }
    }
    if (!n) return false;
    if (feet) {
      this.rel(T, LEG[0][2] * 3);
      const r0 = this.q[1];
      this.rel(T, LEG[1][2] * 3);
      const r1 = this.q[1], drop = Math.min(r0, r1);
      lie.up[0] = 0; lie.up[1] = 1; lie.up[2] = 0; lie.t[0] = 0; lie.t[1] = drop; lie.t[2] = 0;
      lie.feet = true; lie.lift[0] = r0 - drop; lie.lift[1] = r1 - drop;
      return lie;
    }
    // (the slope through what touches: y = a + bx·x + bz·z, least squares, each slope held toward level by as much as
    // the points are not spread its way)
    let n0 = 0, sx = 0, sz = 0, sxx = 0, szz = 0, sxz = 0, sy = 0, sxy = 0, szy = 0;
    const k = 0.04 * h * h;
    for (let i = 0; i < n; i++) {
      this.rel(pts, i * 4);
      const x = pts[i * 4], z = pts[i * 4 + 2], r = (pts[i * 4 + 3] = this.q[1]);
      n0++; sx += x; sz += z; sxx += x * x; szz += z * z; sxz += x * z; sy += r; sxy += x * r; szy += z * r;
    }
    // (Cramer's: A = [[n0, sx, sz], [sx, sxx + k, sxz], [sz, sxz, szz + k]], b = [sy, sxy, szy])
    const a11 = sxx + k, a22 = szz + k;
    const det = n0 * (a11 * a22 - sxz * sxz) - sx * (sx * a22 - sxz * sz) + sz * (sx * sxz - a11 * sz) || 1e-12;
    const bx = (n0 * (sxy * a22 - sxz * szy) - sy * (sx * a22 - sxz * sz) + sz * (sx * szy - sxy * sz)) / det;
    const bz = (n0 * (a11 * szy - sxy * sxz) - sx * (sx * szy - sxy * sz) + sy * (sx * sxz - a11 * sz)) / det;
    let ux = -bx, uy = 1, uz = -bz;
    const l = Math.sqrt(ux * ux + uy * uy + uz * uz); ux /= l; uy /= l; uz /= l;
    // (raised till none of them is below the land, each as high over it as it is over the floor: the turn taking up to
    // the land's — about the axis up × u — applied to each point)
    const cs = uy, ax = uz, az = -ux, al = Math.sqrt(ax * ax + az * az), s = al, kx = al > 1e-9 ? ax / al : 1, kz = al > 1e-9 ? az / al : 0;
    const N = UN;
    N[0] = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = pts[i * 4], y = pts[i * 4 + 1], z = pts[i * 4 + 2], d = kx * x + kz * z;
      // (Rodrigues about (kx, 0, kz))
      const rx = x * cs + (-kz * y) * s + kx * d * (1 - cs), ry = y * cs + (kz * x - kx * z) * s, rz = z * cs + (kx * y) * s + kz * d * (1 - cs);
      const u = this.u;
      u[0] = rx; u[2] = rz;
      this.rel(u, 0);
      N[0] = Math.max(N[0], this.q[1] + y - ry);
    }
    const rise = N[0];
    lie.up[0] = ux; lie.up[1] = uy; lie.up[2] = uz; lie.t[0] = 0; lie.t[1] = rise; lie.t[2] = 0; lie.feet = false;
    return lie;
  }
  // the skeleton laid so: turned about its origin, moved
  lay({ up, t }) {
    const P = this.P, T = P.T;
    if (up[1] < 0.99999) { TJ[0] = 0; TJ[1] = 0; TJ[2] = 0; TJ[3] = 0; TJ[4] = 1; TJ[5] = 0; TJ[6] = up[0]; TJ[7] = up[1]; TJ[8] = up[2]; TJ[9] = 1; turnJoints(P, ALL); }
    for (let i = 0; i < J; i++) { T[i * 3] += t[0]; T[i * 3 + 1] += t[1]; T[i * 3 + 2] += t[2]; }
  }
  // off the floor in a motion done once: how they lie, between where they last touched it and where they touch it next
  // (which frames touch: found once a motion and bones; those frames posed alone, once each); null if they don't,
  // before or after
  between(A) {
    const m = this.M(A.name), u = (A.from + this.clockT - A.at) * m.fps, touch = this.touches(m);
    let a = Math.min(m.n - 1, Math.floor(u)), b = Math.max(0, Math.ceil(u + 1e-6));
    while (a >= 0 && !touch.at[a]) a--;
    while (b < m.n && !touch.at[b]) b++;
    const la = a >= 0 && this.laid(this.frameT(m, touch, a), this.lie), lb = b < m.n && this.laid(this.frameT(m, touch, b), this.lie2);
    if (!la || !lb) return la || lb || null;
    const w = (u - a) / (b - a || 1), up = la.up, t = la.t;
    for (let c = 0; c < 3; c++) { up[c] = up[c] * (1 - w) + lb.up[c] * w; t[c] = t[c] * (1 - w) + lb.t[c] * w; }
    const l = Math.sqrt(up[0] * up[0] + up[1] * up[1] + up[2] * up[2]) || 1; up[0] /= l; up[1] /= l; up[2] /= l;
    la.feet = false;
    return la;
  }
  // the frames of a motion done once that touch the floor, on these bones
  touches(m) {
    let got = m.touch.get(this.fit);
    if (got) return got;
    const at = new Uint8Array(m.n), h = this.size;
    for (let f = 0; f < m.n; f++) {
      this.fu[0] = f; this.fu[1] = 1;
      frameOf(m, this.fu, 'once', this.lq, this.lr);
      fk(this.rig, this.fit, this.lq, this.lr, this.alone);
      for (let i = 0; i < TOUCH_J.length; i++) if (this.alone.T[TOUCH_J[i] * 3 + 1] < TOUCH_LOW[i] * h) { at[f] = 1; break; }
    }
    m.touch.set(this.fit, got = { at, frames: new Map() });
    return got;
  }
  frameT(m, touch, f) {
    let T = touch.frames.get(f);
    if (!T) {
      this.fu[0] = f; this.fu[1] = 1;
      frameOf(m, this.fu, 'once', this.lq, this.lr);
      fk(this.rig, this.fit, this.lq, this.lr, this.alone);
      touch.frames.set(f, T = this.alone.T.slice());
    }
    return T;
  }

  // ── their points ─────────────────────────────────────────────────────
  // one of their points (pointOf's) in the world, into out
  point(p, out) {
    const P = this.P, T = P.T, v = this.v, u = this.u, k = this.size, n = p.n, j = p.a;
    if (p.kind === JOINT) return this.world(T, j * 3, out);
    if (p.kind === MIDDLE) {
      const b = p.b;
      for (let c = 0; c < 3; c++) u[c] = (T[j * 3 + c] + T[b * 3 + c]) / 2;
      return this.world(u, 0, out);
    }
    const x = T[j * 3], y = T[j * 3 + 1], z = T[j * 3 + 2];
    if (p.kind === OFF) {
      dir(this.rig, P, j, 1, 0, 0, v, 0); dir(this.rig, P, j, 0, 1, 0, v, 3); dir(this.rig, P, j, 0, 0, 1, v, 6);
      u[0] = x + (v[0] * n[0] + v[3] * n[1] + v[6] * n[2]) * k; u[1] = y + (v[1] * n[0] + v[4] * n[1] + v[7] * n[2] + n[3]) * k; u[2] = z + (v[2] * n[0] + v[5] * n[1] + v[8] * n[2]) * k;
      return this.world(u, 0, out);
    }
    if (p.kind === BEHIND) {
      dir(this.rig, P, AT.Chest, 0, 0, 1, v, 0);
      const l = Math.sqrt(v[0] * v[0] + v[2] * v[2]) || 1;
      u[0] = x - v[0] / l * n[0] * k; u[1] = y; u[2] = z - v[2] / l * n[0] * k;
      return this.world(u, 0, out);
    }
    const f = p.b, ox = x - T[f * 3], oz = z - T[f * 3 + 2], l = Math.sqrt(ox * ox + oz * oz) || 1;
    u[0] = x + ox / l * n[0] * k; u[1] = y + n[1] * k; u[2] = z + oz / l * n[0] * k;
    return this.world(u, 0, out);
  }
  // their box, metres round their feet (y down): as wide and as tall as they are now — an arm up with a torch over the
  // head, lying full length, a lunge — with room round the hands for what is in them (a quarter-height at a time, so
  // it changes seldom), into out
  box(out) {
    const T = this.P.T, height = this.size * 1.76;
    out[0] = BOX[0]; out[1] = BOX[1]; out[2] = BOX[2]; out[3] = BOX[3];
    if (this.posed) for (let i = 0; i < ROOM_J.length; i++) {
      // (in their own space: the point's way out from the feet, its height — a quarter at a time)
      const jn = ROOM_J[i], room = ROOM_R[i], x = T[jn * 3], y = T[jn * 3 + 1], z = T[jn * 3 + 2];
      const r = Math.ceil((Math.sqrt(x * x + z * z) / height + room) * 4) / 4;
      out[0] = Math.min(out[0], -r); out[2] = Math.max(out[2], r);
      out[1] = Math.min(out[1], -Math.ceil((y / height + room) * 4) / 4); out[3] = Math.max(out[3], Math.ceil((room - y / height) * 4) / 4);
    }
    for (let i = 0; i < 4; i++) out[i] *= height;
    return out;
  }
}

const ALL = Int32Array.from({ length: J }, (_, i) => i);
// (the joints the waist and the neck turn by, each its share; those the box keeps round, each its room)
const WAIST_J = Int32Array.of(AT.Spine1, AT.Spine2, AT.Chest), WAIST_SHARE = Float64Array.of(0.3, 0.3, 0.4);
const NECK_J = Int32Array.of(AT.Neck1, AT.Neck2, AT.Head), NECK_SHARE = Float64Array.of(0.3, 0.43, 1);
const ROOM_J = Int32Array.from(ROOM, ([n]) => AT[POINTS[n]]), ROOM_R = Float64Array.from(ROOM, ([, r]) => r);
