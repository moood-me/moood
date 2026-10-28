// Particles — the language's word made ready, and what the scene's thread keeps of them as the scene goes (WT5, 5.18).
//   A particles element ("particles": { kind, … }) is an emitter: snow round the eye, smoke out of a chimney's mouth,
// sparks off a hammer, dust kicked up by a landing. Its kind gives every field a value (PRESETS); what the spec gives
// overrides it. RENDER works each particle out on the GPU as a closed form of its number, the time and its emitter's
// history — so any moment is drawn the same without the frames before it. That history is kept here, on every step
// (unseen ones too) and saved with the scene: the emitter's ring (where it was, how fast it moved, how much it gave,
// how it was turned), its bursts, and the scene's wind log.
//   Vectors in the spec are [across, distance, elevation] (metres, metres a second); compiled and in the tables they
// are the world's (x across, y up, z = −distance).
//   The compiled numbers `p` (world.emitters.list[i].p) — the one list RENDER reads; every field always there:
//     kind                      the kind's name
//     around, count, reach, area   weather round the eye: how many in a volume `reach` metres each way; area
//                                  [across from, across to, distance from, distance to] | null
//     at                        the point it gives from (a ref of the language) | null: its own anchor
//     source [x, y, z]          half the size of what it is born over, each way
//     flat                      born on a plane (drops on glass)
//     rate, life [lo, hi], amount (number 0…1 | a state key), burst { on, count, over } | null
//     speed [lo, hi], direction [x, y, z] (unit), spread (degrees), gravity, drag, wind, gust, turbulence, swirl, inherit
//     size [start, end], spin (degrees a second), tumble, color [[r, g, b], [r, g, b]] (linear, start and end),
//     colors [[r, g, b], …] | null, opacity, fade [in, out], glow [start, end], blink, flicker
//     shape (dot | flake | streak | spark | puff | ring | drop | leaf | petal | painted), blend (over | add), streak,
//     soft, sheer, ground (pass | stop | splash | bounce), settle, bounce, frames, shadow
import { linearOf, framedPoint } from '../base.js';
import * as m34 from './m34.js';

// the scene's wind ([across, distance, strength]: world.look.wind) as air moving: strength 1 is this many metres a second
const WIND_MS = 2;
// an emitter's ring: its moments, the numbers of one — time, place x y z (world metres), velocity x y z, amount, turn
// (a quaternion x y z w); its bursts likewise (amount: how many)
export const RING = 256, MOMENT = 12, BURSTS = 6;
// the wind log: entries, and the numbers of one — time, the air's way gone by (x, z), the gusts' share (x, z), the
// wind blowing from then on (x, z)
export const WINDS = 256, WIND = 7;
const SHAPES = ['dot', 'flake', 'streak', 'spark', 'puff', 'ring', 'drop', 'leaf', 'petal', 'painted'];
const GROUND = ['pass', 'stop', 'splash', 'bounce'];
const BLENDS = ['over', 'add'];

// What each kind is, as a starting point. around: weather filling the air round the eye (count in a volume reach
// metres each way, falling speed m/s); else an emitter: rate a second, life seconds, speed m/s along direction within
// spread degrees. size [start, end] metres across; color [start, end] (or colors: one of them each); glow: emissive
// (× its colour, HDR: blooms); fade [in, out] shares of its life; shadow: how much of the far lights' light it stops.
// What rises (gravity below 0) goes on rising once its push is spent at −gravity / drag m/s.
const PRESETS = {
  snow: { around: true, count: 14000, reach: 14, speed: [0.6, 1.3], wind: 1, gust: 0.4, turbulence: 0.35, swirl: 2.5, size: [0.018, 0.018], color: '#ffffff', opacity: 0.85, shape: 'flake', ground: 'stop', settle: 1.5, sheer: 0.3, soft: 0.05 },
  blizzard: { around: true, count: 30000, reach: 12, speed: [1.2, 2.6], wind: 2.5, gust: 0.6, turbulence: 0.6, swirl: 3, size: [0.012, 0.012], color: '#f2f5ff', opacity: 0.8, shape: 'flake', ground: 'stop', settle: 0.4, sheer: 0.3, soft: 0.05 },
  rain: { around: true, count: 9000, reach: 10, speed: [7, 9.5], wind: 0.6, gust: 0.3, size: [0.006, 0.006], color: '#c8d4e2', opacity: 0.32, shape: 'streak', streak: 0.03, ground: 'splash', settle: 0.12, sheer: 0.5, soft: 0.05 },
  drops: { flat: true, rate: 1.5, life: [3, 8], source: [1, 0, 1], speed: [0, 0.02], direction: [0, 0, -1], spread: 10, gravity: 0.08, drag: 2, wind: 0, turbulence: 0.01, swirl: 0.05, size: [0.008, 0.008], color: '#dfe9f6', opacity: 0.7, shape: 'drop', streak: 0.4, soft: 0 },
  sparks: { rate: 0, life: [0.4, 1.1], speed: [2, 5.5], direction: [0, 0, 1], spread: 65, gravity: 9.8, drag: 0.8, wind: 0.1, size: [0.012, 0.005], color: ['#fff1c0', '#ff5a10'], glow: [7, 2], shape: 'spark', streak: 0.035, blend: 'add', ground: 'bounce', bounce: 0.35, burst: { count: 40, over: 0.04 } },
  embers: { rate: 5, life: [2, 4.5], source: [0.2, 0.2, 0], speed: [0.3, 1], direction: [0, 0, 1], spread: 25, gravity: -0.5, drag: 1.2, wind: 0.5, turbulence: 0.35, swirl: 0.6, size: [0.012, 0.004], color: ['#ffb050', '#ff3010'], glow: [4, 0.6], flicker: 0.6, shape: 'dot', blend: 'add' },
  fire: { rate: 40, life: [0.35, 0.9], source: [0.3, 0.3, 0.05], speed: [0.3, 0.8], direction: [0, 0, 1], spread: 15, gravity: -2.5, drag: 2, wind: 0.3, turbulence: 0.12, swirl: 0.25, size: [0.28, 0.08], spin: 60, color: ['#ffd27a', '#ff3c0c'], glow: [3, 0.6], fade: [0.15, 0.45], shape: 'puff', blend: 'add', soft: 0.15 },
  smoke: { rate: 8, life: [6, 9], source: [0.15, 0.15, 0], speed: [0.5, 0.9], direction: [0, 0, 1], spread: 10, gravity: -0.45, drag: 0.4, wind: 0.5, gust: 0.4, turbulence: 0.45, swirl: 1.5, size: [0.35, 3], spin: 12, color: '#b4b8c0', opacity: 0.4, fade: [0.03, 0.6], shape: 'puff', sheer: 0.6, soft: 0.6, shadow: 0.6 },
  puff: { rate: 0, life: [1.2, 2.4], source: [0.3, 0.3, 0], speed: [0.4, 1.2], direction: [0, 0, 0.25], spread: 85, gravity: 0.05, drag: 2.5, wind: 0.3, turbulence: 0.08, swirl: 0.4, size: [0.15, 0.7], spin: 20, color: '#b9a88c', opacity: 0.45, fade: [0.05, 0.7], shape: 'puff', sheer: 0.4, soft: 0.25, shadow: 0.4, burst: { count: 24, over: 0.06 } },
  dust: { rate: 12, life: [8, 14], source: [3, 3, 2], speed: [0.02, 0.08], spread: 180, gravity: 0, drag: 0.5, wind: 0.15, turbulence: 0.3, swirl: 1.2, size: [0.004, 0.004], color: '#fff4dc', opacity: 0.55, fade: [0.2, 0.3], shape: 'dot', sheer: 0.8 },
  splashes: { rate: 0, life: [0.3, 0.7], source: [0.1, 0.1, 0], speed: [1.2, 3], direction: [0, 0, 1], spread: 35, gravity: 9.8, drag: 0.3, size: [0.02, 0.01], color: '#dfe8f0', opacity: 0.7, shape: 'streak', streak: 0.02, ground: 'stop', settle: 0.05, sheer: 0.5, burst: { count: 30, over: 0.05 } },
  fireflies: { rate: 5, life: [6, 12], source: [6, 6, 2], speed: [0.05, 0.2], spread: 180, gravity: 0, drag: 0.5, turbulence: 0.6, swirl: 1.2, size: [0.03, 0.03], color: '#d8ff8a', glow: [3, 3], blink: 0.8, fade: [0.1, 0.1], shape: 'dot', blend: 'add' },
  petals: { rate: 4, life: [4, 7], source: [4, 4, 1], speed: [0, 0.2], spread: 180, gravity: 0.6, drag: 1.2, wind: 1, gust: 0.5, turbulence: 0.4, swirl: 1.5, size: [0.035, 0.035], spin: 90, tumble: true, colors: ['#ffd6e0', '#ffc2d1', '#fff0f4'], opacity: 0.95, shape: 'petal', ground: 'stop', settle: 3, sheer: 0.5 },
  leaves: { rate: 3, life: [4, 8], source: [4, 4, 1.5], speed: [0, 0.2], spread: 180, gravity: 0.9, drag: 1.1, wind: 1, gust: 0.5, turbulence: 0.5, swirl: 1.8, size: [0.06, 0.06], spin: 120, tumble: true, colors: ['#c8782a', '#a8461e', '#d8a83a', '#7a8a2a'], opacity: 1, shape: 'leaf', ground: 'stop', settle: 4, sheer: 0.4 },
  bubbles: { rate: 4, life: [2, 4], source: [0.3, 0.3, 0], speed: [0.1, 0.3], direction: [0, 0, 1], spread: 20, gravity: -0.4, drag: 1.5, turbulence: 0.05, swirl: 0.2, size: [0.02, 0.035], color: '#e8f4ff', opacity: 0.6, shape: 'ring' },
};
const PARTICLE_KINDS = Object.keys(PRESETS);
// what every field is when neither the kind nor the spec says
const BASE = {
  around: false, area: null, at: null, source: [0, 0, 0], flat: false, rate: 10, count: 0, reach: 12, life: [1, 2], amount: 1, burst: null,
  speed: [0.5, 1], direction: [0, 0, 1], spread: 20, gravity: 0, drag: 0.5, wind: 0, gust: 0, turbulence: 0, swirl: 1, inherit: 0.3,
  size: [0.05, 0.05], spin: 0, tumble: false, color: '#ffffff', colors: null, opacity: 1, fade: [0.1, 0.2], glow: [0, 0], blink: 0, flicker: 0,
  shape: 'dot', blend: 'over', streak: 0, soft: 0.1, sheer: 0.3, ground: 'pass', settle: 0.5, bounce: 0.3, frames: 1, shadow: 0,
};
// the closed list of a particles object's words (LG13)
const PARTICLE_FIELDS = Object.freeze(Object.keys(BASE).concat('kind'));
const num = v => typeof v === 'number' && Number.isFinite(v);
const wrap = (x, b) => x - Math.floor(x / b) * b;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The spec's `particles` made ready (checked, its kind's values under it) — or null (said). painted: the element
// paints its sprite (its code).
export function compileParticles(spec, who, warn, painted) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec) || !PRESETS[spec.kind]) {
    warn(`${who}: "particles" is { "kind": ${PARTICLE_KINDS.join(' | ')}, … }`);
    return null;
  }
  const given = {};
  for (const k of Object.keys(spec)) { if (PARTICLE_FIELDS.includes(k)) given[k] = spec[k]; else warn(`${who}: particles: "${k}" is not one of its words (${PARTICLE_FIELDS.join(', ')})`); }
  const preset = { ...BASE, ...PRESETS[spec.kind] }, p = { ...preset, ...given };
  const bad = (k, what) => { warn(`${who}: particles: "${k}" is ${what}`); p[k] = preset[k]; };
  const pair = (k, lo = -Infinity) => {
    const v = p[k];
    if (num(v) && v >= lo) p[k] = [v, v];
    else if (!(Array.isArray(v) && v.length === 2 && v.every(x => num(x) && x >= lo))) { bad(k, `a number or [start, end]${lo > -Infinity ? ` (${lo}…)` : ''}`); if (num(p[k])) p[k] = [p[k], p[k]]; } else p[k] = v.slice();
  };
  const vec = (k, unit) => {
    if (!(Array.isArray(p[k]) && p[k].length === 3 && p[k].every(num))) bad(k, '[across, distance, elevation]');
    // (the world's: x across, y up, z = −distance)
    const v = p[k], out = [v[0], v[2], -v[1]];
    if (unit) { const l = Math.hypot(out[0], out[1], out[2]); if (l < 1e-6) { out[0] = 0; out[1] = 1; out[2] = 0; } else { out[0] /= l; out[1] /= l; out[2] /= l; } }
    p[k] = out;
  };
  for (const k of ['life', 'speed', 'size', 'glow']) pair(k, 0);
  pair('fade', 0);
  p.fade = p.fade.map(v => clamp(v, 0, 1));
  for (const k of ['rate', 'count', 'reach', 'gravity', 'drag', 'wind', 'gust', 'turbulence', 'swirl', 'inherit', 'spin', 'opacity', 'blink', 'flicker', 'streak', 'soft', 'sheer', 'settle', 'bounce', 'spread', 'frames', 'shadow']) {
    if (!num(p[k])) bad(k, 'a number');
  }
  for (const k of ['rate', 'count', 'reach', 'drag', 'wind', 'gust', 'turbulence', 'inherit', 'opacity', 'blink', 'flicker', 'streak', 'soft', 'sheer', 'settle', 'bounce']) if (p[k] < 0) bad(k, 'not below 0');
  p.swirl = Math.max(0.01, p.swirl);
  for (const k of ['opacity', 'blink', 'flicker', 'sheer', 'bounce', 'inherit', 'shadow']) p[k] = clamp(p[k], 0, 1);
  p.spread = clamp(p.spread, 0, 180);
  p.frames = Math.max(1, Math.round(p.frames));
  p.around = !!p.around; p.flat = !!p.flat; p.tumble = !!p.tumble;
  vec('source'); vec('direction', true);
  // (the source's size → half of it each way)
  p.source = p.source.map(v => Math.abs(v) / 2);
  // colours: [start, end] or one; or a palette to pick from
  const cs = Array.isArray(p.color) ? p.color : [p.color, p.color];
  if (cs.length !== 2 || !cs.every(linearOf)) { bad('color', '"#rrggbb" or [start, end]'); p.color = [[1, 1, 1], [1, 1, 1]]; } else p.color = cs.map(linearOf);
  if (p.colors != null) {
    if (!Array.isArray(p.colors) || !p.colors.length || p.colors.length > 4 || !p.colors.every(linearOf)) { warn(`${who}: particles: "colors" is a list of 1…4 "#rrggbb" — each particle one of them`); p.colors = null; }
    else p.colors = p.colors.map(linearOf);
  }
  if (!SHAPES.includes(p.shape)) bad('shape', SHAPES.join(' | '));
  if (p.shape === 'painted' && !painted) { warn(`${who}: particles: "shape" "painted" — its code paints the sprite; it has none`); p.shape = 'dot'; }
  if (painted && p.shape !== 'painted') p.shape = 'painted';
  if (!BLENDS.includes(p.blend)) bad('blend', BLENDS.join(' | '));
  if (!GROUND.includes(p.ground)) bad('ground', GROUND.join(' | '));
  if (p.area != null && !(Array.isArray(p.area) && p.area.length === 4 && p.area.every(num))) bad('area', '[across from, across to, distance from, distance to] — where weather round the eye is');
  if (p.at != null && typeof p.at !== 'string' && !(Array.isArray(p.at) && p.at.length === 3 && p.at.every(num)) && !framedPoint(p.at)) bad('at', 'a point: "id#name", a person\'s "keeper#hand_r", [across, distance, elevation], or {"on": id, "at": [across, distance, elevation]} (in that element\'s own frame)');
  if (!(num(p.amount) || typeof p.amount === 'string')) bad('amount', 'a number 0…1 or a state key');
  if (num(p.amount)) p.amount = clamp(p.amount, 0, 1);
  // bursts: { on: a key whose every change (to a value not false, 0, null) sets one off, count, over: seconds it is spread over }
  if (p.burst != null) {
    const b = p.burst === true ? {} : p.burst;
    const base = PRESETS[spec.kind].burst || { count: 20, over: 0.05 };
    if (typeof b !== 'object' || Array.isArray(b) || (b.on != null && typeof b.on !== 'string') || (b.count != null && !(num(b.count) && b.count >= 1)) || (b.over != null && !(num(b.over) && b.over >= 0))) {
      warn(`${who}: particles: "burst" is { "on": state key, "count", "over" (seconds) } — or its animate's e.burst()`);
      p.burst = null;
    } else p.burst = { on: b.on ?? null, count: Math.round(b.count ?? base.count), over: b.over ?? base.over };
  }
  // weather round the eye is falling, nothing else
  if (p.around) {
    if (!(p.count >= 1)) { warn(`${who}: particles: weather round the eye has a "count" (how many in the air round it)`); p.count = 1000; }
    if (p.at != null || spec.rate != null || spec.burst != null) warn(`${who}: particles: weather round the eye ("around") has no "at", "rate" or "burst" — it fills the air (its "count", "reach", "area")`);
    p.burst = null; p.rate = 0; p.at = null;
    p.reach = Math.max(2, p.reach);
    if (p.ground === 'bounce') bad('ground', 'pass, stop or splash for weather');
  } else if (!(p.rate > 0) && !p.burst) warn(`${who}: particles: it gives none — a "rate" (a second) or a "burst"`);
  p.kind = spec.kind;
  return p;
}

// how high the volume of weather round the eye is, each way from its middle (metres)
export const fallHeight = p => 0.6 * p.reach;
// how long an emitter's particles live at most (weather: its fall through its volume)
export const lifeOf = p => (p.around ? 2 * fallHeight(p) / Math.max(0.05, p.speed[0]) : p.life[1] + (p.ground === 'stop' || p.ground === 'splash' ? p.settle : 0));
// how many of an emitter's particles are alive at the most (LG12: the scene's cap is PARTICLES.MAX)
export const mostOf = p => (p.around ? p.count : Math.ceil(p.rate * lifeOf(p)) + (p.burst ? p.burst.count * BURSTS : 0));
// the gusts: how much stronger (or calmer) than the wind it blows at t, −0.6…0.6 of it — the same sum of slow waves
// for all (RENDER's WGSL the same: GUST_WAVES); gustsTo: their integral from 0 to t, closed
export const GUST_WAVES = Object.freeze([[0.3, 0.37, 1.3], [0.18, 0.91, 0.4], [0.12, 2.3, 2.1]]);
const G = GUST_WAVES;
const gustAt = t => G[0][0] * Math.sin(G[0][1] * t + G[0][2]) + G[1][0] * Math.sin(G[1][1] * t + G[1][2]) + G[2][0] * Math.sin(G[2][1] * t + G[2][2]);
const gustsTo = t => -(G[0][0] / G[0][1] * Math.cos(G[0][1] * t + G[0][2]) + G[1][0] / G[1][1] * Math.cos(G[1][1] * t + G[1][2]) + G[2][0] / G[2][1] * Math.cos(G[2][1] * t + G[2][2]));
// (a moment before being put somewhere at once: what was born between the two is so few it is none)
const JUMP = 2e-3;
const WIND_SPACING = 1 / 30;
const hash = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

// The emitters' histories as the scene goes: world.emitters (WT5) — { n, list, wind, … }. frame(t, dt) on every step
// after the people move (what a hand holds is where the hand is now); saved and restored with the scene.
//   list[i]: { p, node, inside, ring, head, bursts, sprite, seed, stamp } as WT5 writes them — inside: its element
// is `inside` (lit by what lights the inside: RENDER reads it here, never through the element); head: where the next
// moment is written (the newest is the one before it, the ring going round); a moment not written yet has time
// −Infinity, a burst likewise — and, the thread's own beside them: el, n (moments kept), burstHead, amount (what it gives now),
// gave (when it last gave anything: what it gave may fly till `life` seconds after), life (lifeOf(p)), offset (weather
// round the eye: its drift's share of the wind's origin, metres x z, wrapped in its volume).
//   A moment is kept as anything of it changes (none while the emitter stands as it stood). Put somewhere at once (its
// place's key set, not moved; a cut) the ring breaks there: what was born before stays where it was, nothing is born
// along the way.
//   wind: the log, oldest first, windN entries of WIND numbers; an entry not written has time Infinity. From an
// entry's time on the air blows (Wx, Wz); (Dx, Dz) is the wind gone by till then and (Ex, Ez) the gusts' share (E
// grows by W × the gusts' closed integral). An entry a change of the wind, no closer than WIND_SPACING (the newest
// re-aimed meanwhile). windStamp: the tick it was last written.
export function createEmitters(world, state) {
  const T = world.tables;
  const list = [], els = world.elements.filter(el => el.kind === 'particles' && el.spec.particles);
  const wind = new Float32Array(WINDS * WIND).fill(Infinity);
  const E = { n: els.length, list, wind, windN: 0, windStamp: 0, air: { x: 0, z: 0, gust: 0 } };
  const v = new Float64Array(3), q = new Float64Array(4), s = new Float64Array(MOMENT);
  for (const el of els) {
    const p = el.spec.particles;
    // (what it hangs on: those whose being put somewhere at once puts it there — its point's element and what carries
    // that, else its own chain)
    const ref = typeof p.at === 'string' ? world.byId.get(world.refOf(p.at).id) : framedPoint(p.at) ? world.byId.get(p.at.on) : Array.isArray(p.at) ? null : el;
    const m = {
      p, node: el.node, inside: !!el.flags.inside, ring: new Float32Array(RING * MOMENT), head: 0, bursts: new Float32Array(BURSTS * MOMENT), sprite: null, seed: (hash(el.id ?? `#${el.index}`) % 1000) / 1000, stamp: 0,
      el, n: 0, burstHead: 0, amount: 0, gave: -Infinity, life: lifeOf(p), offset: new Float32Array(2),
      here: false, position: new Float64Array(3), velocity: new Float64Array(3), pending: 0,
      spacing: Math.max(1 / 240, lifeOf(p) / (RING - 16)), jumpAt: -Infinity, lastKey: undefined, prev: new Float64Array(MOMENT), prevT: -Infinity, lastAt: -Infinity,
      hangs: ref ? world.chain(ref) : [],
    };
    for (let i = 0; i < RING; i++) m.ring[i * MOMENT] = -Infinity;
    for (let i = 0; i < BURSTS; i++) m.bursts[i * MOMENT] = -Infinity;
    el.emitter = m;
    list.push(m);
  }
  let started = false, was = -Infinity;
  function push(m, moment) {
    m.ring.set(moment, m.head * MOMENT);
    m.head = (m.head + 1) % RING;
    if (m.n < RING) m.n++;
    m.lastAt = moment[0];
    m.stamp = T.tick;
  }
  const lastOf = m => ((m.head + RING - 1) % RING) * MOMENT;
  const same = (ring, o, moment) => { for (let k = 1; k < MOMENT; k++) if (Math.abs(ring[o + k] - moment[k]) > 1e-5 * Math.max(1, Math.abs(moment[k]))) return false; return true; };
  // the wind log's entry at time t blowing (wx, wz): a new one — or, closer than WIND_SPACING to the last, the last
  // re-aimed; D and E where the last one has them by t
  function blow(t, wx, wz) {
    const L = wind;
    if (E.windN) {
      const o = (E.windN - 1) * WIND;
      if (L[o + 5] === Math.fround(wx) && L[o + 6] === Math.fround(wz)) return;
      E.windStamp = T.tick;
      if (t - L[o] < WIND_SPACING && E.windN > 1) { L[o + 5] = wx; L[o + 6] = wz; return; }
      const dt = t - L[o], dg = gustsTo(t) - gustsTo(L[o]);
      const dx = L[o + 1] + L[o + 5] * dt, dz = L[o + 2] + L[o + 6] * dt, ex = L[o + 3] + L[o + 5] * dg, ez = L[o + 4] + L[o + 6] * dg;
      if (E.windN === WINDS) { L.copyWithin(0, WIND); E.windN--; }
      const i = E.windN++ * WIND;
      L[i] = t; L[i + 1] = dx; L[i + 2] = dz; L[i + 3] = ex; L[i + 4] = ez; L[i + 5] = wx; L[i + 6] = wz;
      // (gone far: the log and the weather's offsets moved on with the origin — the numbers kept small for floats)
      if (Math.abs(dx) > 1024 || Math.abs(dz) > 1024) rebase(dx, dz, ex, ez);
    } else {
      L[0] = t; L[1] = L[2] = L[3] = L[4] = 0; L[5] = wx; L[6] = wz;
      E.windN = 1; E.windStamp = T.tick;
    }
  }
  function rebase(dx, dz, ex, ez) {
    for (let k = 0; k < E.windN; k++) { const o = k * WIND; wind[o + 1] -= dx; wind[o + 2] -= dz; wind[o + 3] -= ex; wind[o + 4] -= ez; }
    for (const m of list) {
      const p = m.p;
      if (!p.around) continue;
      const r = 2 * p.reach;
      m.offset[0] = wrap(m.offset[0] + p.wind * (dx + p.gust * ex), r);
      m.offset[1] = wrap(m.offset[1] + p.wind * (dz + p.gust * ez), r);
      m.stamp = T.tick;
    }
  }
  function forget() {
    started = false;
    wind.fill(Infinity); E.windN = 0; E.windStamp = T.tick;
    for (const m of list) {
      for (let i = 0; i < RING; i++) m.ring[i * MOMENT] = -Infinity;
      for (let i = 0; i < BURSTS; i++) m.bursts[i * MOMENT] = -Infinity;
      m.n = 0; m.head = 0; m.burstHead = 0; m.prevT = -Infinity; m.jumpAt = -Infinity; m.lastAt = -Infinity; m.lastKey = undefined; m.gave = -Infinity; m.pending = 0;
      m.offset.fill(0); m.stamp = T.tick;
    }
  }
  E.frame = (t, dt) => {
    // (the time gone back — a seek: the history is of another time, forgotten; the scene goes on as if it had always
    // been as it is now)
    if (t < was) forget();
    was = t;
    const look = world.look, wl = Math.sqrt(look.wind[0] * look.wind[0] + look.wind[1] * look.wind[1]) || 1, ws = look.wind[2] * WIND_MS;
    E.air.x = look.wind[0] / wl * ws; E.air.z = look.wind[1] / wl * ws; E.air.gust = gustAt(t);
    blow(t, E.air.x, E.air.z);
    for (let i = 0; i < list.length; i++) {
      const m = list[i], p = m.p, el = m.el;
      // how much it gives now: its amount (a key's value), nothing while it is not shown or its point is not there
      const a = typeof p.amount === 'string' ? clamp(Number(state.value(p.amount)) || 0, 0, 1) : p.amount;
      let here = el.visible;
      if (p.at != null) {
        const where = world.pointFor(p.at, v);
        // (on a point of a painting that is still to come — WT5: nothing of it is written, its ring stays empty; its
        // first moment is the first step with the painting there, at its true place and amount — the scene's clock
        // still stands then. What its burst's key is meanwhile is no change of it)
        if (where === -1) {
          m.amount = 0; m.here = false; m.pending = 0;
          if (p.burst && p.burst.on != null) m.lastKey = state.value(p.burst.on);
          continue;
        }
        here = here && where === 1;
      } else { const M = T.nodes.m, o = 12 * el.node; v[0] = M[o + 9]; v[1] = M[o + 10]; v[2] = M[o + 11]; }
      m.amount = here ? a : 0;
      if (m.amount > 0 && (p.rate > 0 || p.around)) m.gave = t;
      // (put there at once: no way gone between, no speed)
      let jump = false;
      for (let k = 0; k < m.hangs.length; k++) if (m.hangs[k].jumpedAt === T.tick) { jump = true; break; }
      if (here) {
        if (started && dt > 0 && m.here && !jump) for (let k = 0; k < 3; k++) m.velocity[k] = (v[k] - m.position[k]) / dt; else m.velocity.fill(0);
        m.position.set(v);
      }
      m.here = here;
      m34.quaternion(T.nodes.m, 12 * el.node, q);
      s[0] = t; s[1] = m.position[0]; s[2] = m.position[1]; s[3] = m.position[2];
      s[4] = m.velocity[0]; s[5] = m.velocity[1]; s[6] = m.velocity[2]; s[7] = m.amount; s[8] = q[0]; s[9] = q[1]; s[10] = q[2]; s[11] = q[3];
      // the ring: a moment kept when anything changed — after a still stretch the moment before it too (what it was till
      // then); put there at once, what it was a moment before (nothing born between); no closer than its spacing (the
      // newest overwritten meanwhile)
      if (!m.n) push(m, s);
      else if (jump && started) { m.prev[0] = Math.max(m.prevT, t - JUMP); push(m, m.prev); push(m, s); m.jumpAt = t; }
      else if (!same(m.ring, lastOf(m), s)) {
        if (m.lastAt < m.prevT - 1e-6) { push(m, m.prev); push(m, s); }
        else if (t - m.lastAt >= m.spacing || m.n < 2 || m.lastAt === m.jumpAt) push(m, s);
        else { m.ring.set(s, lastOf(m)); m.lastAt = t; m.stamp = T.tick; }
      }
      m.prev.set(s); m.prevT = t;
      // bursts: a key that changed to something — a number up, true, a name (or its animate's e.burst)
      if (p.burst) {
        let n = m.pending;
        if (p.burst.on != null) {
          const k = state.value(p.burst.on), o = m.lastKey;
          if (started && k !== o && k != null && k !== false && (typeof k !== 'number' || (k > 0 && (typeof o !== 'number' || k > o)))) n += p.burst.count;
          m.lastKey = k;
        }
        m.pending = 0;
        if (n > 0 && here) {
          const j = m.burstHead * MOMENT;
          m.bursts.set(s, j);
          m.bursts[j + 7] = Math.min(n, p.burst.count);
          m.burstHead = (m.burstHead + 1) % BURSTS;
          m.gave = t + p.burst.over;
          m.stamp = T.tick;
        }
      }
    }
    started = true;
  };
  // whether anything an emitter gave may still be in the air at t
  E.alive = t => { for (let i = 0; i < list.length; i++) if (list[i].gave + list[i].life > t) return true; return false; };
  // its animate's e.burst(count): set off this step where it is — as many as its burst holds at most (said)
  E.burst = (el, count) => {
    const m = el.emitter;
    if (!m || !m.p.burst) return;
    const n = Math.max(1, Math.round(count ?? m.p.burst.count));
    if (n > m.p.burst.count) world.warn(`${el.who}: e.burst(${n}) — at most its "burst" "count" (${m.p.burst.count}) at once: give it that many`);
    m.pending += n;
  };
  // the emitters and the wind log as data, and back (the director's save) — each emitter's history by its element
  // (its id, else its place among the elements): a save of the scene as it was before a change (a game's, restored)
  // gives no emitter another's
  const SAVED = ['head', 'n', 'burstHead', 'amount', 'here', 'gave', 'jumpAt', 'lastKey', 'prevT', 'lastAt', 'pending'];
  const nameOf = m => m.el.id ?? `#${m.el.index}`;
  E.save = () => ({
    started, t: was, wind: wind.slice(), windN: E.windN,
    emitters: list.map(m => { const o = { el: nameOf(m), ring: m.ring.slice(), bursts: m.bursts.slice(), offset: m.offset.slice(), prev: m.prev.slice(), position: m.position.slice(), velocity: m.velocity.slice() }; for (const k of SAVED) o[k] = m[k]; return o; }),
  });
  E.restore = d => {
    started = d.started; was = d.t;
    wind.set(d.wind); E.windN = d.windN; E.windStamp = T.tick;
    const saved = new Map(d.emitters.map(o => [o.el, o]));
    list.forEach(m => {
      const o = saved.get(nameOf(m));
      if (!o) return;
      m.ring.set(o.ring); m.bursts.set(o.bursts); m.offset.set(o.offset); m.prev.set(o.prev); m.position.set(o.position); m.velocity.set(o.velocity);
      for (const k of SAVED) m[k] = o[k];
      m.stamp = T.tick;
    });
  };
  return E;
}
