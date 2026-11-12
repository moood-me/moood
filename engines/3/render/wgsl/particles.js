// Particles on the GPU (5.18; render/particles.js lays them out): each particle a closed form of the time, its number
// and its emitter's history — where the emitter was, how it was turned and how much it gave when the particle was
// born (its ring), its bursts, the wind it has been carried by since (the wind log) —, worked out in the vertex stage
// of the draw that shows it: no simulation, no state on the GPU, any moment drawn the same however it was reached.
// The model is main's (its evaluation pass, now in the vertex stage): born from its emitter's place in a cone, flown
// under gravity, drag, the wind and its gusts and a swirl of curl noise, landing on the ground (stopping, splashing,
// bouncing); weather round the eye a volume about it, wrapped, falling.
//   Group 2 `particles`: 0 the emitters (a row each: PT below), 1 the histories (vec4f rows: the wind log, then each
// emitter's ring and bursts), 2 the sprites (an array: the engine's four lumps — a puff is one of them, by its number
// —, then a layer a frame of every emitter that paints its own), 3 the scene's depth — read by what is `soft` (it
// fades into what stands behind it), in the pass that does not write it.
//   A particle is four points of a strip, and an instance. An emitter is a draw — draw(4, its particles, 8 · its row
// + 4 · its order, its first particle of the scene's): the vertex has its emitter in vertex_index >> 3, the draw's
// order in the bit under it (1: its oldest particles are drawn first, 0: its youngest — whichever end of its plume
// lies farther along the view's gaze, so what blends is laid far to near with no sort; weather and a cast draw: as
// they are numbered) and its corner in the two bits under that; its instance_index less the emitter's first is its
// place in the draw. The histories' first row: (the wind log's entries, —, —, —).
//   A thick emitter (its `shadow` above 0: smoke, a cloud of dust) shades itself: the light reaches a
// puff through as much of its plume as lies between it and the strongest far light — from the side toward that light
// none, from the far side all; `sheer` lets the light behind a particle through (render.light).
//   One flight a vertex (5.21: nothing here is a loop of the heavy part): when a particle lands is found from its fall
// alone — gravity and drag, a closed form —, its swirl is worked out once, where it is; where it was a moment ago
// (a streak's other end) is taken from how fast it goes there.
//   Times on the GPU are seconds since the frame's epoch (render/wgsl/frame.js): the rings are written so.
import { chunk } from '../../gpu/wgsl.js';
import { LIGHT } from '../../base.js';

export const RINGS = Object.freeze({ MOMENT: 3, BURST: 4, WIND: 2, HEAD: 1 });
// (SPRITE: a sprite's side, px; PUFFS: the lumps — the sprites' first layers)
export const PT = Object.freeze({ BYTES: 384, SHAPES: { dot: 0, flake: 1, streak: 2, spark: 3, puff: 4, ring: 5, drop: 6, leaf: 7, petal: 8, painted: 9 }, GROUND: { pass: 0, stop: 1, splash: 2, bounce: 3 }, MIN_PX: 1.5, EXPOSURE: 1 / 60, SMEAR: 0.03, SPRITE: 256, PUFFS: 4 });
const S = PT.SHAPES;

const text = ({ cast = false, waves, ring, bursts }) => /* wgsl */ `
struct e_Emitter {
  kind: vec4f,       // 1: weather round the eye; 1: it glows or adds (drawn unlit); how many particles it has; its seed
  rate: vec4f,       // a second; how many of its particles are its stream's; how many a burst; 1: born on a plane (flat)
  life: vec4f,       // lo, hi; a burst is spread over; how much of the emitter's speed it keeps
  dir: vec4f,        // its way (unit, its own frame), the cosine of its cone
  source: vec4f,     // half the size of what it is born over; how much light it stops (shadow)
  speed: vec4f,      // lo, hi
  force: vec4f,      // gravity, drag, wind, gust
  turb: vec4f,       // turbulence, swirl (metres across), sheer (how much of the light behind it comes through), 1: inside
  size: vec4f,       // start, end, spin (radians a second), 1: tumbles
  colour0: vec4f,    // start (linear), opacity
  colour1: vec4f,    // end, how many colours its palette has (0: start → end)
  glow: vec4f,       // start, end; fade in, fade out (shares of its life)
  ground: vec4f,     // 0 pass, 1 stop, 2 splash, 3 bounce; settle (seconds); bounce; soft (metres)
  fx: vec4f,         // streak (seconds of its way), blink, flicker, the ground's height there (less the origin)
  sprite: vec4f,     // its sprites (a painted one's frames; a puff's: the lumps), the first of them (a layer), a frame's aspect, shape
  palette: array<vec4f, 4>,
  volume: vec4f,     // weather: half its volume each way; 1: within an area
  area: vec4f,       // across from, to; distance from, to (the world's own)
  ring: vec4f,       // its ring's first row of the histories, its moments kept, its oldest moment's place in the ring, how many laps its stream has gone
  phase: vec4f,      // where its stream is in its lap; its bursts' first row; —; 1: it may have anything in the air
  drift: vec4f,      // weather: its drift's share of the wind's origin (x, z); its first particle of the scene's
}
@group(2) @binding(0) var<storage, read> e_emitters: array<e_Emitter>;
@group(2) @binding(1) var<storage, read> e_rings: array<vec4f>;
@group(2) @binding(2) var e_sprites: texture_2d_array<f32>;
@group(2) @binding(3) var e_depth: texture_depth_2d;

fn e_rnd(seed: u32, k: u32) -> f32 { return hashU(seed ^ (k * 0x9e3779b9u + 0x632be5abu)); }
fn e_loopHash3(v: vec3u) -> f32 { let c = v & vec3u(255u); return hashU(c.x * 1973u + c.y * 9277u + c.z * 26699u + 7u); }
// value noise over a loop with its gradient (x: −1…1; yzw: its slope)
fn e_noiseD(p: vec3f) -> vec4f {
  let i = floor(p);
  let f = p - i;
  let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  let du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  let q = vec3u(vec3i(i));
  let a = e_loopHash3(q);
  let b = e_loopHash3(q + vec3u(1u, 0u, 0u));
  let c = e_loopHash3(q + vec3u(0u, 1u, 0u));
  let d = e_loopHash3(q + vec3u(1u, 1u, 0u));
  let e = e_loopHash3(q + vec3u(0u, 0u, 1u));
  let f1 = e_loopHash3(q + vec3u(1u, 0u, 1u));
  let g = e_loopHash3(q + vec3u(0u, 1u, 1u));
  let h = e_loopHash3(q + vec3u(1u, 1u, 1u));
  let k1 = b - a; let k2 = c - a; let k3 = e - a; let k4 = a - b - c + d; let k5 = a - c - e + g; let k6 = a - b - e + f1;
  let k7 = -a + b + c - d + e - f1 - g + h;
  let v = a + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z;
  let grad = du * vec3f(k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z, k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x, k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y);
  return vec4f(2.0 * v - 1.0, 2.0 * grad);
}
// a swirl without sources: the curl of three such fields, two octaves, drifting slowly
fn e_curl(at: vec3f) -> vec3f {
  var p = at - 256.0 * floor(at / 256.0) + 256.0 * vec3f(0.0, cycle(-0.07 / 256.0), cycle(0.05 / 256.0));
  var c = vec3f(0.0);
  var k = 1.0;
  for (var o = 0; o < 2; o++) {
    let a = e_noiseD(p).yzw;
    let b = e_noiseD(p + vec3f(31.4, 17.9, 7.3)).yzw;
    let d = e_noiseD(p + vec3f(-11.2, 43.1, 23.7)).yzw;
    c += k * vec3f(d.y - b.z, a.z - d.x, b.x - a.y);
    p = p * 2.0 + 5.1;
    k *= 0.5;
  }
  return c * 0.3;
}
// the gusts: how much stronger than the wind it blows s seconds after the epoch, and their integral (world/emitters.js)
fn e_gustAt(s: f32) -> f32 { return ${waves.map(([a, w, f]) => `${a.toFixed(4)} * sin(6.2831853 * e_cycleAt(${(w / 2 / Math.PI).toFixed(8)}, s) + ${f.toFixed(4)})`).join(' + ')}; }
fn e_gustsTo(s: f32) -> f32 { return -(${waves.map(([a, w, f]) => `${(a / w).toFixed(6)} * cos(6.2831853 * e_cycleAt(${(w / 2 / Math.PI).toFixed(8)}, s) + ${f.toFixed(4)})`).join(' + ')}); }
// the wind gone by at s — (the air's way x z, the gusts' share x z) — read off the log: its entry at or before s
var<private> e_windN: i32;
fn e_windLog(k: i32, part: i32) -> vec4f { return e_rings[u32(1 + k * ${RINGS.WIND} + part)]; }
fn e_windAt(s: f32) -> vec4f {
  let n = max(e_windN, 1);
  var lo = 0;
  var hi = n - 1;
  if (s >= e_windLog(hi, 0).x) { lo = hi; }
  else if (s > e_windLog(0, 0).x) {
    for (var it = 0; it < 9; it++) {
      if (hi - lo <= 1) { break; }
      let m = (lo + hi) / 2;
      if (e_windLog(m, 0).x <= s) { lo = m; } else { hi = m; }
    }
  }
  let a = e_windLog(lo, 0);
  let b = e_windLog(lo, 1);
  let dt = s - a.x;
  let dg = e_gustsTo(s) - e_gustsTo(a.x);
  return vec4f(a.y + b.y * dt, a.z + b.z * dt, a.w + b.y * dg, b.x + b.z * dg);
}
var<private> e_airNow: vec4f;
var<private> e_E: e_Emitter;

// the emitter s seconds after the epoch: between its ring's two moments about s
struct e_Moment { at: vec3f, amount: f32, vel: vec3f, q: vec4f }
fn e_ringAt(k: i32, part: u32) -> vec4f {
  let i = (i32(e_E.ring.z) + k) % ${ring};
  return e_rings[u32(e_E.ring.x) + u32(i) * ${RINGS.MOMENT}u + part];
}
fn e_momentAt(s: f32) -> e_Moment {
  let n = max(i32(e_E.ring.y), 1);
  var lo = 0;
  var hi = n - 1;
  let a0 = e_ringAt(0, 0u);
  if (s <= a0.w || n == 1) { let b = e_ringAt(0, 1u); return e_Moment(a0.xyz, b.x, b.yzw, e_ringAt(0, 2u)); }
  if (s >= e_ringAt(hi, 0u).w) { lo = hi; }
  else {
    for (var it = 0; it < 9; it++) {
      if (hi - lo <= 1) { break; }
      let m = (lo + hi) / 2;
      if (e_ringAt(m, 0u).w <= s) { lo = m; } else { hi = m; }
    }
  }
  let up = min(lo + 1, n - 1);
  let pa = e_ringAt(lo, 0u);
  let pb = e_ringAt(up, 0u);
  let ba = e_ringAt(lo, 1u);
  let bb = e_ringAt(up, 1u);
  var f = 0.0;
  if (pb.w > pa.w) { f = clamp((s - pa.w) / (pb.w - pa.w), 0.0, 1.0); }
  let qa = e_ringAt(lo, 2u);
  var qb = e_ringAt(up, 2u);
  if (dot(qa, qb) < 0.0) { qb = -qb; }
  return e_Moment(mix(pa.xyz, pb.xyz, f), mix(ba.x, bb.x, f), mix(ba.yzw, bb.yzw, f), normalize(mix(qa, qb, f)));
}
fn e_turned(q: vec4f, v: vec3f) -> vec3f { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }

// (at, axis: where its emitter was when it was born, and the emitter's middle way then — its direction at its middle
// speed: the axis of a plume, what is inside a column of smoke)
struct e_Born { p0: vec3f, v0: vec3f, s: f32, life: f32, wind: vec4f, seed: u32, face: vec3f, at: vec3f, axis: vec3f, alive: bool }
fn e_cone(d: vec3f, c: f32, r1: f32, r2: f32) -> vec3f {
  let z = mix(1.0, c, r1);
  let s = sqrt(max(0.0, 1.0 - z * z));
  let a = 2.0 * PI * r2;
  var t = vec3f(1.0, 0.0, 0.0);
  if (abs(d.y) < 0.99) { t = normalize(cross(d, vec3f(0.0, 1.0, 0.0))); }
  return t * s * cos(a) + cross(d, t) * s * sin(a) + d * z;
}
// A particle born as b, age a: how far its fall alone has taken it — gravity and drag, in closed form (e_lag: how
// much of its age it has caught up with the air by)
fn e_lag(a: f32) -> f32 {
  if (e_E.force.y > 1e-4) { return (1.0 - exp(-e_E.force.y * a)) / e_E.force.y; }
  return a;
}
fn e_fallen(b: e_Born, a: f32) -> vec3f {
  let f = e_E.force;
  let G = vec3f(0.0, -f.x, 0.0);
  if (f.y > 1e-4) { return (b.v0 - G / f.y) * e_lag(a) + G / f.y * a; }
  return b.v0 * a + 0.5 * G * a * a;
}
// … and with the wind gone by since its birth (less what it has not yet caught up with): how far it is from where it
// was born, but for its swirl
fn e_carried(b: e_Born, a: f32, windNow: vec4f) -> vec3f {
  let f = e_E.force;
  let w = windNow - b.wind;
  let over = f.z * ((w.xy + f.w * w.zw) - e_airNow.xy * (1.0 + f.w * e_airNow.w) * e_lag(a));
  return e_fallen(b, a) + vec3f(over.x, 0.0, over.y);
}
// where it is, age a: carried, the swirl (as strong as \`swirl\`) growing on it; what is born on a plane stays in it
fn e_flown(b: e_Born, a: f32, windNow: vec4f, swirl: f32) -> vec3f {
  var D = e_carried(b, a, windNow);
  if (swirl > 0.0) { D += swirl * (1.0 - exp(-1.5 * a)) * e_curl((b.p0 + D + e_frame.e_origin) / e_E.turb.y); }
  if (e_E.rate.w > 0.5) { D -= b.face * dot(D, b.face); D += b.face * 0.01; }
  return b.p0 + D;
}
// how fast it goes, age a: its fall's speed and the air's as far as it has caught up with it
fn e_velocity(b: e_Born, a: f32) -> vec3f {
  let f = e_E.force;
  let G = vec3f(0.0, -f.x, 0.0);
  var v = b.v0 + G * a;
  var caught = 0.0;
  if (f.y > 1e-4) { v = G / f.y + (b.v0 - G / f.y) * exp(-f.y * a); caught = 1.0 - exp(-f.y * a); }
  let air = f.z * e_airNow.xy * (1.0 + f.w * e_airNow.w) * caught;
  return v + vec3f(air.x, 0.0, air.y);
}
// … and where it is with the ground under it: its place, how long ago it landed (−1: flying), how fast it goes. When
// it lands is its fall's alone (the swirl does not sink it), so e_flown — the swirl — is worked out once
struct e_Placed { at: vec3f, landed: f32, vel: vec3f }
fn e_placed(b: e_Born, a: f32, windNow: vec4f) -> e_Placed {
  let floor_ = e_E.fx.w;
  let grounded = e_E.ground.x > 0.5 && b.p0.y >= floor_;
  if (!grounded || b.p0.y + e_fallen(b, a).y >= floor_) {
    var P = e_flown(b, a, windNow, e_E.turb.x);
    if (grounded) { P.y = max(P.y, floor_); }
    return e_Placed(P, -1.0, e_velocity(b, a));
  }
  var lo = 0.0;
  var hi = a;
  for (var i = 0; i < 10; i++) {
    let m = 0.5 * (lo + hi);
    if (b.p0.y + e_fallen(b, m).y >= floor_) { lo = m; } else { hi = m; }
  }
  if (e_E.ground.x > 2.5) {
    // (it bounces: on from where it landed, its fall turned up)
    var L = b.p0 + e_carried(b, hi, windNow);
    L.y = floor_;
    let v = e_velocity(b, hi);
    var c = b;
    c.p0 = L + vec3f(0.0, 0.002, 0.0);
    c.v0 = vec3f(v.x * 0.6, -v.y * e_E.ground.z, v.z * 0.6);
    c.wind = windNow - vec4f(e_airNow.xy, e_airNow.xy * e_airNow.w) * (a - hi);
    var Q = e_flown(c, a - hi, windNow, e_E.turb.x);
    Q.y = max(Q.y, floor_);
    return e_Placed(Q, -1.0, e_velocity(c, a - hi));
  }
  var L = e_flown(b, hi, windNow, e_E.turb.x);
  L.y = floor_;
  return e_Placed(L, a - hi, vec3f(0.0));
}
// particle j of the emitter at t: how it was born — of its stream (its place in the lap gives when), or of a burst
fn e_bornOf(j: i32, t: f32) -> e_Born {
  var b: e_Born;
  b.alive = false;
  let nc = i32(e_E.rate.y);
  let base = u32(e_E.kind.w);
  var at: vec3f;
  var vel: vec3f;
  var q: vec4f;
  if (j < nc) {
    let x = e_E.phase.x - f32(j);
    let back = floor(x / f32(nc));
    b.s = t - (x - back * f32(nc)) / e_E.rate.x;
    b.seed = e_bits(u32(j) * 7919u + u32((i32(e_E.ring.w) + i32(back)) & 4095) * 104729u + base);
    b.life = mix(e_E.life.x, e_E.life.y, e_rnd(b.seed, 0u));
    let m = e_momentAt(b.s);
    if (e_rnd(b.seed, 1u) >= m.amount) { return b; }
    at = m.at; vel = m.vel; q = m.q;
  } else {
    let count = max(i32(e_E.rate.z), 1);
    let k = (j - nc) / count;
    let i = j - nc - k * count;
    if (k >= ${bursts}) { return b; }
    let row = u32(e_E.phase.y) + u32(k) * ${RINGS.BURST}u;
    let r0 = e_rings[row];
    let r1 = e_rings[row + 1u];
    if (r0.w < -1e20 || f32(i) >= r1.x) { return b; }
    b.seed = e_bits(u32(j) * 7919u + bitcast<u32>(e_rings[row + 3u].x) * 31u + base);
    b.s = r0.w + e_E.life.z * e_rnd(b.seed, 1u);
    b.life = mix(e_E.life.x, e_E.life.y, e_rnd(b.seed, 0u));
    at = r0.xyz; vel = r1.yzw; q = e_rings[row + 2u];
  }
  b.wind = e_windAt(b.s);
  b.face = e_turned(q, vec3f(0.0, 0.0, 1.0));
  b.at = at;
  b.axis = e_turned(q, e_E.dir.xyz) * mix(e_E.speed.x, e_E.speed.y, 0.5) + vel * e_E.life.w;
  b.p0 = at + e_turned(q, e_E.source.xyz * (vec3f(e_rnd(b.seed, 2u), e_rnd(b.seed, 3u), e_rnd(b.seed, 4u)) * 2.0 - 1.0));
  b.v0 = e_turned(q, e_cone(e_E.dir.xyz, e_E.dir.w, e_rnd(b.seed, 5u), e_rnd(b.seed, 6u))) * mix(e_E.speed.x, e_E.speed.y, e_rnd(b.seed, 7u)) + vel * e_E.life.w;
  var settle = 0.0;
  if (e_E.ground.x > 0.5 && e_E.ground.x < 2.5) { settle = e_E.ground.y; }
  b.alive = t >= b.s && t - b.s < b.life + settle;
  return b;
}

// a particle worked out: where it is and was a moment ago, its size, its colour as it is lit (premultiplied), its
// turn, its sprite's frame, how squeezed it is tumbling, its splash (−1: none)
struct e_Particle { at: vec3f, size: f32, prev: vec3f, splash: f32, colour: vec4f, look: vec3f, alive: bool }
fn e_particle(j: i32) -> e_Particle {
  var o: e_Particle;
  o.alive = false;
  let t = e_frame.e_since;
  let windNow = e_windAt(t);
  let last = e_windLog(max(e_windN, 1) - 1, 1);
  e_airNow = vec4f(last.yz, 0.0, e_gustAt(t));
  let now = e_airNow;
  let force = e_E.force;
  let shutter = e_E.fx.x;
  let weather = e_E.kind.x > 0.5;
  var P: vec3f;
  var prev: vec3f;
  var x = 0.5;
  var alpha = e_E.colour0.w;
  var splash = -1.0;
  var age = t;
  var seed: u32;
  // (a thick one: where it is from its plume's axis — how deep in the plume it is toward the light)
  var across = vec3f(0.0);
  if (weather) {
    seed = e_bits(u32(j) * 7919u + u32(e_E.kind.w));
    let H = e_E.volume.xyz;
    let B = 2.0 * H;
    let fall = mix(e_E.speed.x, e_E.speed.y, e_rnd(seed, 3u));
    let airs = force.z * (windNow.xy + force.w * windNow.zw) + e_E.drift.xy;
    let q = vec3f(e_rnd(seed, 0u), e_rnd(seed, 1u), e_rnd(seed, 2u)) * B + vec3f(wrap(airs.x, B.x), -B.y * cycle(fall / B.y), wrap(airs.y, B.z)) - (e_frame.e_origin - B * floor(e_frame.e_origin / B));
    let C = e_view.eye + vec3f(0.0, 0.35 * H.y, 0.0);
    P = C + (q - C + H - B * floor((q - C + H) / B)) - H;
    let came = t - (C.y + H.y - P.y) / fall;
    let windThen = windNow - vec4f(now.xy, now.xy * now.w) * shutter;
    let airThen = force.z * (windThen.xy + force.w * windThen.zw) + e_E.drift.xy;
    prev = P - vec3f(airs.x - airThen.x, -fall * shutter, airs.y - airThen.y);
    if (e_E.turb.x > 0.0) {
      // (a flake's own flutter, and the swirl where it is)
      let fr = 0.6 + 0.9 * e_rnd(seed, 17u);
      let fa = 0.25 * e_E.turb.x * (0.5 + e_rnd(seed, 18u));
      let ph = e_rnd(seed, 19u);
      let a0 = 2.0 * PI * (e_cycleAt(fr, t) + ph);
      let a1 = 2.0 * PI * (e_cycleAt(fr, t - shutter) + ph);
      let s0 = e_E.turb.x * e_curl((P + e_frame.e_origin) / e_E.turb.y);
      P += s0 + fa * vec3f(cos(a0), 0.4 * sin(2.0 * a0), sin(a0));
      prev += s0 + fa * vec3f(cos(a1), 0.4 * sin(2.0 * a1), sin(a1));
    }
    let v = vec3f(force.z * now.x * (1.0 + force.w * now.w), -fall, force.z * now.y * (1.0 + force.w * now.w));
    let e3 = 1.0 - abs(P - C) / H;
    alpha *= mix(0.55, 1.0, e_rnd(seed, 16u)) * smoothstep(0.0, 0.12, min(e3.x, min(e3.y, e3.z))) * clamp((e_momentAt(came).amount - e_rnd(seed, 4u)) * 30.0, 0.0, 1.0);
    if (e_E.volume.w > 0.5) {
      let W = P + e_frame.e_origin;
      alpha *= smoothstep(0.0, 0.5, min(min(W.x - e_E.area.x, e_E.area.y - W.x), min(-W.z - e_E.area.z, e_E.area.w + W.z)));
    }
    if (e_E.ground.x > 0.5 && P.y < e_E.fx.w) {
      // (landed: lying where it came down, fading — or its splash)
      let ago = (e_E.fx.w - P.y) / fall;
      if (ago >= e_E.ground.y) { return o; }
      P = vec3f(P.x - v.x * ago, e_E.fx.w, P.z - v.z * ago);
      prev = P;
      if (e_E.ground.x > 1.5) { splash = ago / e_E.ground.y; } else { alpha *= 1.0 - ago / e_E.ground.y; }
      age = t - ago;
    }
    if (alpha <= 0.002) { return o; }
  } else {
    let b = e_bornOf(j, t);
    if (!b.alive) { return o; }
    seed = b.seed;
    age = t - b.s;
    let placed = e_placed(b, age, windNow);
    P = placed.at;
${cast ? '' : /* wgsl */ `    if (e_E.source.w > 0.0) {
      var c = b;
      c.p0 = b.at;
      c.v0 = b.axis;
      across = P - e_flown(c, age, windNow, 0.0);
    }
`}
    // (where it was a moment ago: back along how it goes — no further than since it was born)
    prev = P - placed.vel * min(shutter, age);
    if (placed.landed >= 0.0) {
      if (placed.landed >= e_E.ground.y) { return o; }
      if (e_E.ground.x > 1.5) { splash = placed.landed / e_E.ground.y; } else { alpha *= 1.0 - placed.landed / e_E.ground.y; }
      age -= placed.landed;
    }
    if (placed.landed < 0.0 && age >= b.life) { return o; }
    x = clamp(age / b.life, 0.0, 1.0);
    alpha *= smoothstep(0.0, max(e_E.glow.z, 1e-4), x) * (1.0 - smoothstep(1.0 - max(e_E.glow.w, 1e-4), 1.0, x));
  }
  let r8 = e_rnd(seed, 8u);
  let grown = mix(e_E.size.x, e_E.size.y, x);
  var size = grown * mix(0.8, 1.2, r8);
  if (weather) { size = grown * (0.45 + 1.3 * r8 * r8); }
  var colour = mix(e_E.colour0.rgb, e_E.colour1.rgb, x);
  if (e_E.colour1.w > 0.5) { colour = e_E.palette[min(u32(e_rnd(seed, 9u) * e_E.colour1.w), u32(e_E.colour1.w) - 1u)].rgb; }
  let shape = i32(e_E.sprite.w + 0.5);
  if (shape == ${S.puff} && e_E.kind.y < 0.5) {
    // (a puff of smoke thins as it grows: what it is made of is spread over more)
    if (grown > e_E.size.x && e_E.size.x > 0.0) { alpha *= e_E.size.x / grown; }
    colour *= mix(0.82, 1.08, e_rnd(seed, 20u));
  }
  let g = mix(e_E.glow.x, e_E.glow.y, x);
  var flicker = 1.0;
  if (e_E.fx.z > 0.0) { flicker = e_flickerOf(e_E.fx.z, f32(seed & 1023u)); }
  if (e_E.fx.y > 0.0) { alpha *= mix(1.0, pow(0.5 + 0.5 * sin(2.0 * PI * cycle(1.6 / (2.0 * PI)) + e_rnd(seed, 10u) * 40.0), 3.0), e_E.fx.y); }
  let spin = e_E.size.z * (e_rnd(seed, 12u) * 2.0 - 1.0);
  let tw = 1.0 + 2.0 * e_rnd(seed, 13u);
  var turned = spin * age;
  var tumbled = tw * age;
  if (weather) { turned = 2.0 * PI * e_cycleAt(spin / (2.0 * PI), age); tumbled = 2.0 * PI * e_cycleAt(tw / (2.0 * PI), age); }
  var tumble = 1.0;
  if (e_E.size.w > 0.5) { tumble = 0.2 + 0.8 * abs(cos(tumbled + e_rnd(seed, 14u) * 6.0)); }
  var rgb = colour;
  if (g > 0.0) { rgb = colour * g; }
${cast ? '' : /* wgsl */ `  if (e_E.kind.y < 0.5) {
    // (a thick one shades itself: the light comes through as much of its plume as lies toward the strongest far light)
    var through = 1.0;
    if (e_E.source.w > 0.0 && !weather) {
      var way = vec3f(0.0);
      var best = 0.0;
      for (var i = 0u; i < ${LIGHT.FAR_MOST}u; i++) {
        if (i >= e_frame.e_farN) { break; }
        let F = e_lights[i];
        if (F.b.w > best) { best = F.b.w; way = F.a.xyz; }
      }
      var deep = 0.5;
      if (best > 0.0) { deep = clamp(0.5 - 0.5 * dot(across, way) / max(0.5 * size, length(across)), 0.0, 1.0); }
      through = mix(1.0, exp(-3.0 * e_E.source.w * deep), 0.85);
    }
    // (lit as what faces no way, where it is — at its vertices: 5.5 —, what is behind it showing through as its sheer says)
    let L = e_lightOn(P, normalize(e_view.eye - P), 0.0, e_E.turb.w, 0u, false, 1.0, e_E.turb.z);
    rgb = colour * (L.base * through + g);
  }
`}
  var a = alpha;
  if (e_E.kind.y > 0.5) { a = 0.0; }
  o.at = P; o.size = size; o.prev = prev; o.splash = splash;
  o.colour = vec4f(rgb * flicker * alpha, a);
  o.look = vec3f(e_rnd(seed, 11u) * 2.0 * PI + turned, floor(e_rnd(seed, 15u) * e_E.sprite.x), tumble);
  o.alive = true;
  return o;
}

struct e_PartOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) colour: vec4f,
  @location(2) fx: vec4f,                        // its streak's length, its splash, how far before the eye, its soft (metres)
  @location(3) air: vec4f,
  @location(4) @interpolate(flat) info: vec4f,   // its shape, its sprites' first layer, which of them it is
}
fn e_gone() -> e_PartOut { var o: e_PartOut; o.position = vec4f(0.0, 0.0, -1.0, 1.0); return o; }
@vertex fn e_vertex(@builtin(vertex_index) vertex: u32, @builtin(instance_index) instance: u32) -> e_PartOut {
  // (the histories' first row: how many entries the wind log has; the draw's emitter and the corner: the vertex's index)
  e_windN = i32(e_rings[0].x);
  e_E = e_emitters[vertex >> 3u];
  if (e_E.phase.w < 0.5) { return e_gone(); }
  let corner = vertex & 3u;
  let q = vec2f(f32(corner & 1u), f32(corner >> 1u));
  let k = instance - u32(e_E.drift.z);
  var j = i32(k);
${cast ? '' : /* wgsl */ `  if (e_E.kind.x < 0.5) {
    // (the draw's order: its stream from its oldest particle on, or from its youngest back; its bursts likewise)
    let nc = i32(e_E.rate.y);
    let newest = min(nc - 1, i32(floor(e_E.phase.x)));
    if ((vertex & 4u) != 0u) {
      if (j < nc) { j = (newest + 1 + j) % nc; }
    } else if (j < nc) {
      j = (newest - j + nc) % nc;
    } else {
      j = i32(e_E.kind.z) - 1 - (j - nc);
    }
  }
`}  let p = e_particle(j);
  if (!p.alive) { return e_gone(); }
  let e = e_view.rot * (p.at - e_view.eye);
  let depth = -e.z;
  if (depth < 0.05) { return e_gone(); }
  var shape = i32(e_E.sprite.w + 0.5);
  var s = p.size;
  var cover = 1.0;
${cast ? '' : /* wgsl */ `  // (smaller than a pixel or two: drawn that wide, as much fainter; passed close by, gone)
  let pxm = e_view.proj[1][1] * 0.5 * e_view.size.y / depth;
  if (s * pxm < ${PT.MIN_PX.toFixed(1)}) { cover = s * pxm / ${PT.MIN_PX.toFixed(1)}; s = ${PT.MIN_PX.toFixed(1)} / pxm; }
  cover *= cover * clamp((depth - 0.2) / 0.4, 0.0, 1.0);
`}  var len = 0.0;
  var at: vec3f;
  var o: e_PartOut;
  if (p.splash >= 0.0 && e_E.ground.x > 1.5 && e_E.ground.x < 2.5) {
    // (its splash: a ring widening on the ground)
    shape = ${S.ring + 100};
    let w = s * (6.0 + 10.0 * p.splash);
    at = e_view.rot * (p.at + vec3f(0.0, 0.35 * w, 0.0) - e_view.eye) + vec3f((q - 0.5) * vec2f(w, 0.7 * w), 0.0);
    o.uv = (q - 0.5) * 2.0;
  } else if (shape == ${S.streak} || shape == ${S.spark} || shape == ${S.drop} || shape == ${S.dot} || shape == ${S.flake}) {
    // (drawn along its way over the last moment: a streak — a flake or a dot only as far as it moved against the eye)
    var b = e_view.rot * (p.prev - e_view.eye);
${cast ? '' : /* wgsl */ `    if (shape == ${S.dot} || shape == ${S.flake}) {
      if (b.z > 0.5 * e.z) { b = e + (b - e) * (-0.5 * e.z / max(b.z - e.z, 1e-6)); }
      let pe = e_view.proj * vec4f(e, 1.0);
      let pb = e_view.proj * vec4f(b, 1.0);
      let moved = length((pe.xy / pe.w - pb.xy / pb.w) * 0.5 * e_view.size);
      let most = ${PT.SMEAR.toFixed(3)} * e_view.size.y;
      if (moved > most) { b = e + (b - e) * (most / moved); }
    }
`}    let way = e - b;
    let L = length(way);
    var dir = vec3f(0.0, 1.0, 0.0);
    if (L > 1e-5) { dir = way / L; }
    var side = vec3f(1.0, 0.0, 0.0);
    if (length(dir.xy) > 1e-3) { side = normalize(vec3f(-dir.y, dir.x, 0.0)); }
    let along = q.y * (L + s) - 0.5 * s;
    at = b + dir * along + side * (q.x - 0.5) * s;
    o.uv = vec2f((q.x - 0.5) * 2.0, along / (0.5 * s));
    len = L / (0.5 * s);
  } else {
    var c = (q - 0.5) * s * vec2f(p.look.z, 1.0);
    if (shape == ${S.painted}) { if (e_E.sprite.z >= 1.0) { c.y /= e_E.sprite.z; } else { c.x *= e_E.sprite.z; } }
    let cs = cos(p.look.x);
    let sn = sin(p.look.x);
    at = e + vec3f(cs * c.x - sn * c.y, sn * c.x + cs * c.y, 0.0);
    o.uv = (q - 0.5) * 2.0;
  }
  o.position = e_view.proj * vec4f(at, 1.0);
  if (shape == ${S.dot} || shape == ${S.flake}) { cover /= 1.0 + 0.64 * len; }
  o.colour = p.colour * cover;
  o.fx = vec4f(len, p.splash, depth, e_E.ground.w);
${cast ? /* wgsl */ `  o.air = vec4f(e_E.source.w, f32(k), 0.0, 0.0);
` : /* wgsl */ `  o.air = e_airAt(p.at);
`}  o.info = vec4f(f32(shape), e_E.sprite.y, p.look.y, 0.0);
  return o;
}

// how much of it there is at a point of its sprite (uv −1…1), by its shape; a puff, a painted one: its sprite
fn e_shape(in: e_PartOut) -> vec4f {
  let shape = i32(in.info.x + 0.5);
  let uv = in.uv;
  let r = length(uv);
  var a = 1.0;
  var k = vec3f(1.0);
  if (shape == ${S.dot} || shape == ${S.flake}) {
    let d = length(vec2f(uv.x, uv.y - clamp(uv.y, 0.0, in.fx.x)));
    if (shape == ${S.dot}) { a = exp(-4.5 * d * d) * (1.0 - smoothstep(0.75, 1.0, d)); } else { a = (1.0 - smoothstep(0.3, 1.0, d)) * 0.8 + 0.2 * exp(-12.0 * d * d); }
  } else if (shape == ${S.streak} || shape == ${S.spark} || shape == ${S.drop}) {
    let d = length(vec2f(uv.x, uv.y - clamp(uv.y, 0.0, in.fx.x)));
    var head = 1.0;
    if (in.fx.x > 0.0) { head = clamp(uv.y / in.fx.x, 0.0, 1.0); }
    a = exp(-3.0 * d * d) * (1.0 - smoothstep(0.8, 1.0, d));
    if (shape == ${S.spark}) { a *= mix(0.35, 1.0, head); k *= 1.0 + 2.0 * exp(-10.0 * d * d) * head; }
    else if (shape == ${S.drop}) {
      let hd = length(vec2f(uv.x, uv.y - in.fx.x));
      let g = vec2f(uv.x + 0.3, uv.y - in.fx.x - 0.35);
      a = max(0.25 * a * (1.0 - head * 0.5), 1.0 - smoothstep(0.75, 1.0, hd));
      k *= mix(1.6, 0.55, smoothstep(0.2, 0.9, hd)) + 2.0 * exp(-30.0 * dot(g, g));
    }
  } else if (shape == ${S.ring}) {
    let g = uv - vec2f(-0.35, 0.35);
    a = smoothstep(0.62, 0.82, r) * (1.0 - smoothstep(0.86, 1.0, r)) + 0.8 * exp(-40.0 * dot(g, g));
  } else if (shape == ${S.ring + 100}) {
    a = (1.0 - smoothstep(0.0, 0.25, abs(length(vec2f(uv.x, (uv.y + 1.0) * 1.2)) - mix(0.3, 0.95, in.fx.y)))) * step(0.0, uv.y + 0.95) * (1.0 - in.fx.y);
  } else if (shape == ${S.leaf} || shape == ${S.petal}) {
    // (a pointed oval, a vein down a leaf)
    var wide = 0.55;
    if (shape == ${S.petal}) { wide = 0.75; }
    let d = length(vec2f(uv.x / (wide * (1.0 - 0.6 * uv.y * uv.y)), uv.y));
    a = 1.0 - smoothstep(0.85, 1.0, d);
    if (shape == ${S.leaf}) { k *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.08, abs(uv.x))); }
  } else {
    // (a sprite — a puff's lump, or a frame of its own picture: a layer of the sprites, kept half a texel within it)
    let st = clamp(vec2f(uv.x * 0.5 + 0.5, 0.5 - uv.y * 0.5), vec2f(${0.5 / PT.SPRITE}), vec2f(${1 - 0.5 / PT.SPRITE}));
    let t = textureSampleLevel(e_sprites, e_linear, st, i32(in.info.y + in.info.z + 0.5), 0.0);
    return vec4f(t.rgb, t.a);
  }
  return vec4f(k * a, a);
}
${cast ? /* wgsl */ `
// into a light's map: where it is thick enough — as many of its pixels as it stops of the light (a pattern of its
// own, no two particles' the same)
@fragment fn e_fragment(in: e_PartOut) {
  let c = e_shape(in);
  let a = clamp(in.colour.a * c.a * in.air.x, 0.0, 1.0);
  if (a <= hash2(in.position.xy + in.air.y * 17.0)) { discard; }
}
` : /* wgsl */ `
@fragment fn e_fragment(in: e_PartOut) -> @location(0) vec4f {
  let k = e_shape(in);
  var c = vec4f(in.colour.rgb * k.rgb, in.colour.a * k.a);
  // (soft: fading into what stands behind it, by how far before that it is)
  if (in.fx.w > 0.0) {
    let behind = e_view.proj[3].z / max(textureLoad(e_depth, vec2i(in.position.xy), 0), 1e-9);
    let soft = clamp((behind - in.fx.z) / in.fx.w, 0.0, 1.0);
    c *= soft;
  }
  if (c.a <= 1.0 / 1024.0 && max(c.r, max(c.g, c.b)) <= 1.0 / 4096.0) { discard; }
  return vec4f(e_dithered(c.rgb * (1.0 - in.air.a) + in.air.rgb * c.a, in.position.xy), c.a);
}
`}
`;

chunk('render.particles', text);
