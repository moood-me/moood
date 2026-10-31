// The scene's light: its look (spec.light mixed toward its looks by the state — world.look, WT5) and its sources
// (spec.lights and the glows its elements paint, e.light — rows of world.lights, WT4; any number: LG10), made once per
// show and moved each step only where something moved: a light on an element that moved, in a person's hand, on a key
// that changed. Which of them light and which cast this frame is RENDER's (5.5). Metres, the world's coordinates
// (x across, y up, z = −distance), colours linear.
//   a point light — where it is (across, distance, elevation; a place's keys; a point it goes with, "at": a person's
//     "keeper#hand_r", an element's "cart#lamp", a copy's "cart:2#lamp"; an element's light it takes over, "of":
//     "lamp#wick" — every copy's —, "lamp:2#wick" — that copy's alone) — reaching `reach` metres;
//   far off — from [bearing, height] (degrees; place keys move it), or from where a sky element marks a point
//     ("moon#disc") — the same everywhere; through panes (`through`: window elements or polygons) only past them;
//   daylight at a window ("daylight", "of": the window) — the outside's ambient now (the sky seen through it: the
//     sun and the moon come in by the "inside" share or "through"), into the room only;
//   a beam — a point light (any of the three ways) with a "cone": it shines only within it, aimed by its bearing and
//     height (place keys of those names turn it), as wide and soft-edged as it says;
//   each as strong as its `on` key and the looks' `lights` say — never the flicker (the GPU's, by its seed).
// A row: kind, node (the node it hangs on: a painted light's, a window's; −1), at (a point light's and a window's
// place), way (toward a far light; a window's face; where a beam points), cone (a beam's cosines), colour, strength,
// reach, sprite (its painted glow's radius), glow, flicker, seed, flags (INSIDE: it lights only what is inside; GLOW: a glow of it is drawn;
// SKY: a sky's e.light — its `at` the way toward it, its sprite in stage heights, no reach: a glow at infinity), named, and — beside
// the contract — soft (a through-light's edge over a pane, metres) and lights.ids[row] (its id).
//   A glow's falloff (WT4 `falloff`): 1 — "linear", straight from its middle to its rim as the eye sees it (a canvas's
// radial gradient); 0 — the engine's own, bright in its middle. A spec light's "falloff", else its e.light's.
//   world.panes (WT5): the panes of the through-lights and the windows of the daylights, each a rectangle and an
// outline in a node's plane (x right, y down — a sheet's sense); beside the contract, panes.light[i] — the row of the
// light whose pane it is. A pane given as a polygon in the world has a node of its own (the polygon's plane).
import { LIGHT, linearOf } from '../base.js';
import { EYE, STAGE } from './spec.js';
import { skyWay } from './place.js';
import * as m34 from './m34.js';

const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = v => typeof v === 'number' && Number.isFinite(v);
// how far (metres) the air hides a thing to 1/e for a haze 0…1 — the language's "0 crystal clear … 1 thick fog": from
// BEND up 600 eye heights at 0, 25 at 1, evenly in the log (a light haze half a kilometre, a fog 40 m), below it on to
// clear air (CLEAR at 0), the log's slope kept at BEND
const HAZE_BEND = 0.25, HAZE_CLEAR = 60000, HAZE_K = Math.log(600 / 25);
// a beam's cone where it does not say: its full width (degrees), how soft its edge is (the share of its half-width
// that fades out); its width at the least and the most
const CONE_WIDTH = 30, CONE_SOFT = 0.25, CONE_LEAST = 1, CONE_MOST = 170;
const HAZE_AT_BEND = Math.log(600 * EYE) - HAZE_K * HAZE_BEND, HAZE_CURVE = (Math.log(HAZE_CLEAR) - HAZE_AT_BEND - HAZE_K * HAZE_BEND) / (HAZE_BEND * HAZE_BEND);
export const hazeReach = h => {
  const u = HAZE_BEND - clamp(h, 0, 1);
  return Math.exp(u <= 0 ? HAZE_AT_BEND + HAZE_K * u : HAZE_AT_BEND + HAZE_K * u + HAZE_CURVE * u * u);
};
const LOOK_NUM = { tintStrength: 0, vignette: 0.5, grain: 0.5, haze: Math.log(220 / 600) / Math.log(25 / 600), brightness: 1, saturation: 1, ambient: 1, hazeGlow: 0, shafts: 0, inside: 1, bounce: 0.5 };
const LOOK_COL = ['tint', 'hazeColor', 'ambientColor'], LOOK_NAMES = Object.keys(LOOK_NUM);
const hash = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
// Whether a caster's `shadow.light` (name) names the light of that id — by the light's id, or by the element whose
// light it is ("lamp" for "lamp#flame", for a copy's "lamp:3"). The ONE rule: `lights.named` is marked by it and
// world.castsIn answers by it (WT4)
export const namesLight = (name, id) => id != null && (id === name || String(id).split('#')[0].split(':')[0] === name);
const colourOf = (hex, where, warn) => { const c = linearOf(hex); if (!c) warn(`${where}: ${JSON.stringify(hex)} is not a colour ("#rrggbb")`); return c; };
const lerp3 = (a, b, w) => { a[0] += (b[0] - a[0]) * w; a[1] += (b[1] - a[1]) * w; a[2] += (b[2] - a[2]) * w; };
// the scene's wind as the spec gives it — [across, distance, strength] — in the world's coordinates ([x, z, strength])
function windOf(v, where, warn) {
  if (Array.isArray(v) && v.length === 3 && v.every(num) && v[2] >= 0) return [v[0], -v[1], v[2]];
  warn(`${where}: [across, distance, strength] — which way the wind goes over the level and how strong (0…)`);
  return null;
}

// The look (WT5): spec.light mixed toward its looks, in the order listed, by their keys (0…1) — worked out again only
// when one of those keys moved (keys). look.lights: how much
// of each spec light's strength the looks leave it now, by its place in spec.lights. look.stamp: the tick it changed.
// light, lights: the compiled spec's (their words checked there); tables: for the tick.
export function createLook(light, lights, tables, warn) {
  const L = light;
  const base = {};
  for (const k of LOOK_NAMES) base[k] = num(L[k]) ? L[k] : LOOK_NUM[k];
  base.tint = L.tint ? colourOf(L.tint, 'light.tint', warn) : null;
  base.hazeColor = colourOf(L.hazeColor || '#808080', 'light.hazeColor', warn) || [0.2159, 0.2159, 0.2159];
  base.ambientColor = (L.ambientColor && colourOf(L.ambientColor, 'light.ambientColor', warn)) || [1, 1, 1];
  base.wind = (L.wind != null && windOf(L.wind, 'light.wind', warn)) || [1, 0, 0.5];
  // (how the grain is laid — a word, not mixed by the looks)
  const grainBlend = L.grainBlend == null || L.grainBlend === 'overlay' || L.grainBlend === 'normal' ? L.grainBlend || 'overlay'
    : (warn(`light.grainBlend: ${JSON.stringify(L.grainBlend)} — "overlay" or "normal"`), 'overlay');
  // (the vignette's shape — the light's alone, not mixed by the looks: where it begins, a share of the short side; where
  // it is full, of the long side — none: 0.6 of the diagonal —; how far down its middle is)
  const share = (k, most, none) => (L[k] == null ? none : num(L[k]) && L[k] >= 0 && L[k] <= most ? L[k] : (warn(`light.${k}: a number 0…${most}`), none));
  const vignetteInner = share('vignetteInner', 1, 0.35), vignetteOuter = share('vignetteOuter', 2, null), vignetteCentre = share('vignetteCentre', 1, 0.5);
  const lightIndex = new Map();
  lights.forEach((l, i) => { if (l && l.id != null && !lightIndex.has(String(l.id))) lightIndex.set(String(l.id), i); });
  const looks = [];
  for (const [key, look] of Object.entries(L.looks || {})) {
    const ls = look.lights && typeof look.lights === 'object' && !Array.isArray(look.lights) ? look.lights : look.lights == null ? {} : (warn(`light.looks.${key}.lights: { light id: how much of its strength (0…) }`), {});
    const lightsOf = [];
    for (const [id, k] of Object.entries(ls)) {
      if (!lightIndex.has(id) || !(num(k) && k >= 0)) warn(`light.looks.${key}.lights.${id}: ${lightIndex.has(id) ? 'how much of its strength, a number 0…' : 'there is no such light (spec.lights)'}`);
      else lightsOf.push(lightIndex.get(id), k);
    }
    const nums = [];
    for (const k of LOOK_NAMES) if (num(look[k])) nums.push(k, look[k]);
    const cols = { tint: null, hazeColor: null, ambientColor: null };
    for (const k of LOOK_COL) if (look[k]) cols[k] = colourOf(look[k], `light.looks.${key}.${k}`, warn);
    looks.push({ key, nums, cols, lights: lightsOf, wind: look.wind == null ? null : windOf(look.wind, `light.looks.${key}.wind`, warn) });
  }
  const now = {
    ambient: 1, ambientColor: [1, 1, 1], inside: 1, haze: 0, hazeColor: [0, 0, 0], hazeGlow: 0, brightness: 1, tint: null, tintStrength: 0, saturation: 1,
    vignette: 0, vignetteInner, vignetteOuter, vignetteCentre, grain: 0, grainBlend, bounce: 0.5, shafts: 0, wind: [1, 0, 0.5], stamp: 0,
    hazeReach: 0, lights: new Float64Array(lights.length).fill(1),
  };
  const tint = [0, 0, 0];
  return {
    look: now, keys: new Set(looks.map(l => l.key)), lightIndex,
    // the look as `value` (a key → its value now) has it
    update(value) {
      for (let i = 0; i < LOOK_NAMES.length; i++) now[LOOK_NAMES[i]] = base[LOOK_NAMES[i]];
      for (let i = 0; i < 3; i++) { now.wind[i] = base.wind[i]; now.ambientColor[i] = base.ambientColor[i]; now.hazeColor[i] = base.hazeColor[i]; }
      let tinted = base.tint ? (tint[0] = base.tint[0], tint[1] = base.tint[1], tint[2] = base.tint[2], tint) : null;
      now.lights.fill(1);
      for (let n = 0; n < looks.length; n++) {
        const lk = looks[n], w = clamp(Number(value(lk.key)) || 0, 0, 1);
        if (w <= 0) continue;
        for (let i = 0; i < lk.lights.length; i += 2) now.lights[lk.lights[i]] += (lk.lights[i + 1] - now.lights[lk.lights[i]]) * w;
        if (lk.wind) for (let i = 0; i < 3; i++) now.wind[i] += (lk.wind[i] - now.wind[i]) * w;
        for (let i = 0; i < lk.nums.length; i += 2) now[lk.nums[i]] += (lk.nums[i + 1] - now[lk.nums[i]]) * w;
        if (lk.cols.tint) { if (tinted) lerp3(tinted, lk.cols.tint, w); else { tint[0] = lk.cols.tint[0]; tint[1] = lk.cols.tint[1]; tint[2] = lk.cols.tint[2]; tinted = tint; } }
        if (lk.cols.hazeColor) lerp3(now.hazeColor, lk.cols.hazeColor, w);
        if (lk.cols.ambientColor) lerp3(now.ambientColor, lk.cols.ambientColor, w);
      }
      now.tint = tinted;
      now.hazeReach = hazeReach(now.haze);
      now.stamp = tables.tick;
      return now;
    },
  };
}

// The lights (WT4) and the panes (WT5), and what moves them. world: its tables, elements, byId, pointOf, sheetPoint,
// stagePoint, look, C; value(key); warn. → { all(), frame(keys, yawed, lookChanged), repainted(el) }
export function createLights(world, value, warn) {
  const T = world.tables, Lt = T.lights, C = world.C;
  // the panes, gathered as the lights are made
  const paneNode = [], paneRect = [], panePoly = [], paneOf = [], paneLight = [];
  function pane(light, node, pts) {
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (let k = 0; k < pts.length; k += 2) { l = Math.min(l, pts[k]); r = Math.max(r, pts[k]); t = Math.min(t, pts[k + 1]); b = Math.max(b, pts[k + 1]); }
    paneNode.push(node); paneRect.push(l, t, r, b); paneOf.push(panePoly.length / 2, pts.length / 2); panePoly.push(...pts); paneLight.push(light);
  }
  const boxPane = (light, el) => { const [l, t, r, b] = el.box; pane(light, el.node, [l, t, r, t, r, b, l, b]); };
  // a polygon of the world ([across, distance, elevation over the land] points) as a pane: a node in its plane
  function polygonPane(light, pts) {
    const P = pts.map(q => [q[0], q[2] + world.groundAt(q[0], q[1]), -q[1]]), o = P[0];
    const u = [P[1][0] - o[0], P[1][1] - o[1], P[1][2] - o[2]], ul = Math.hypot(u[0], u[1], u[2]) || 1;
    u[0] /= ul; u[1] /= ul; u[2] /= ul;
    const e = [P[2][0] - o[0], P[2][1] - o[1], P[2][2] - o[2]];
    const n = [u[1] * e[2] - u[2] * e[1], u[2] * e[0] - u[0] * e[2], u[0] * e[1] - u[1] * e[0]], nl = Math.hypot(n[0], n[1], n[2]) || 1;
    n[0] /= nl; n[1] /= nl; n[2] /= nl;
    const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    // (the node's axes: x = u, y = −v — a sheet's y goes down —, z across them)
    const node = T.addNode(-1), m = new Float64Array(12);
    m34.basis(u, [-v[0], -v[1], -v[2]], [-n[0], -n[1], -n[2]], o, m);
    T.setNode(node, m);
    const flat = [];
    for (const q of P) { const d = [q[0] - o[0], q[1] - o[1], q[2] - o[2]]; flat.push(d[0] * u[0] + d[1] * u[1] + d[2] * u[2], d[0] * v[0] + d[1] * v[1] + d[2] * v[2]); }
    pane(light, node, flat);
  }
  // a row made: its id, its kind
  function make(id, kind) {
    const row = T.addLight();
    Lt.kind[row] = kind; Lt.ids[row] = id; Lt.seed[row] = hash(id) % 1000; Lt.reach[row] = 8;
    return row;
  }
  const flagsOf = row => (Lt.sprite[row] > 0 || Lt.glow[row] > 0 ? LIGHT.GLOW : 0);
  // A beam's cone (WT4 `cone`, `way`): l.cone as the language says it — "bearing" (degrees: 0 the far side, 90 the
  // right), "height" (degrees above the level; below it, down), the place's keys of those names turning it (in
  // degrees, any number of turns); "width" (its full angle, degrees) and "soft" (the share of its half-width over
  // which its edge fades). → { outer, inner (the cosines), aim(row) — its way written as it points now } or null
  function coneOf(l, id) {
    if (l.cone == null) return null;
    const c = l.cone;
    if (!c || typeof c !== 'object' || Array.isArray(c)) { warn(`lights ${id}: "cone" is { "bearing", "height", "width", "soft" } — where it points (degrees), how wide (degrees) and how soft its edge (0…1)`); return null; }
    if (c.bearing != null && !num(c.bearing)) warn(`lights ${id}: cone "bearing" is degrees (0 the far side, 90 the right)`);
    if (c.height != null && !(num(c.height) && c.height >= -90 && c.height <= 90)) warn(`lights ${id}: cone "height" is degrees above the level (−90…90; below 0 it points down)`);
    if (c.width != null && !(num(c.width) && c.width >= CONE_LEAST && c.width <= CONE_MOST)) warn(`lights ${id}: cone "width" is its full angle, degrees (${CONE_LEAST}…${CONE_MOST})`);
    if (c.soft != null && !(num(c.soft) && c.soft >= 0 && c.soft <= 1)) warn(`lights ${id}: cone "soft" is how much of its edge fades (0…1)`);
    const bearing = num(c.bearing) ? c.bearing : 0, height = num(c.height) ? clamp(c.height, -90, 90) : 0;
    const half = 0.5 * DEG * (num(c.width) ? clamp(c.width, CONE_LEAST, CONE_MOST) : CONE_WIDTH), soft = num(c.soft) ? clamp(c.soft, 0, 1) : CONE_SOFT;
    const outer = Math.cos(half), inner = Math.min(1, Math.max(Math.cos(half * (1 - soft)), outer + 1e-5));
    const place = l.place && typeof l.place === 'object' ? l.place : {}, k = f => (typeof place[f] === 'string' && num(value(place[f])) ? value(place[f]) : null);
    return {
      outer, inner,
      aim(row) {
        const b = (k('bearing') ?? bearing) * DEG, h = (k('height') ?? height) * DEG;
        T.setLight3(Lt.way, row, Math.sin(b) * Math.cos(h), Math.sin(h), -Math.cos(b) * Math.cos(h));
      },
    };
  }
  const coned = (row, cone) => { Lt.cone[2 * row] = cone.outer; Lt.cone[2 * row + 1] = cone.inner; };
  // how each light is worked out now, and what makes it move: [{ row, update(), keys, elements, person, far, day, stale }]
  const rules = [], scratch = new Float64Array(3), way = new Float64Array(3), at2 = [0, 0];
  const onOf = (l, i) => () => (typeof l.on === 'string' ? clamp(Number(value(l.on)) || 0, 0, 1) : 1) * world.look.lights[i];
  const nodeAt = (node, out) => { const M = T.nodes.m, o = 12 * node; out[0] = M[o + 9]; out[1] = M[o + 10]; out[2] = M[o + 11]; return out; };
  // the lights the elements paint (e.light), each a point light at its element — by "id" or "id#name", a copy's by
  // "id:k" or "id:k#name" (taken before what names every copy); those the spec takes over (`of`) shine as it says
  const taken = new Map();
  // the light coming in at a window: the outside's ambient now — the sky seen through it (the far lights come in by
  // the look's "inside" share or through their panes, not again here) —, its strength the brightest
  const daylight = { colour: [1, 1, 1], strength: 1 }, amb = [0, 0, 0];
  function outside() {
    const look = world.look;
    for (let k = 0; k < 3; k++) amb[k] = look.ambientColor[k] * look.ambient;
    const top = Math.max(amb[0], amb[1], amb[2]);
    daylight.strength = top;
    for (let k = 0; k < 3; k++) daylight.colour[k] = top > 0 ? amb[k] / top : 1;
  }
  C.lights.forEach((l, i) => {
    if (!l) return;
    const id = l.id != null ? String(l.id) : `lights[${i}]`, on = onOf(l, i);
    // (null: not said — an element's light taken over flickers then as the element says)
    const flicker = l.flicker == null ? null : clamp(Number(l.flicker) || 0, 0, 1), keys = [l.on, ...Object.values(l.place && typeof l.place === 'object' ? l.place : {})].filter(k => typeof k === 'string');
    const day = l.daylight === true ? 1 : l.daylight == null || l.daylight === false ? 0 : num(l.daylight) && l.daylight >= 0 ? l.daylight : (warn(`lights ${id}: "daylight" is true or a strength (1)`), 0);
    const colour = l.color ? colourOf(l.color, `lights ${id}: color`, warn) : null, cone = coneOf(l, id);
    // (null: not said — an element's light taken over falls off as its e.light says)
    const falloff = l.falloff == null ? null : l.falloff === 'linear' ? 1 : (warn(`lights ${id}: "falloff" is "linear" or left out (its glow bright in its middle)`), null);
    // (a cone is a point light's: a far light, one through panes and a window's daylight have none)
    if (cone && (l.from != null || (day && l.of != null))) warn(`lights ${id}: "cone" is a point light's (a lamp, a lantern, an element's light) — not one far off or a window's daylight; not taken`);
    // (`size`: accepted, nothing — LG5)
    if (l.size != null && !(num(l.size) && l.size >= 0 && l.size <= 30)) warn(`lights ${id}: "size" is how wide it is in the sky, degrees (0…30) — accepted; it does nothing in engine 3`);
    // daylight at a window: its rectangle where the element is now
    if (day && l.of != null) {
      const el = world.byId.get(String(l.of));
      if (!el || ['sky', 'insert', 'person', 'particles'].includes(el.kind)) { warn(`lights ${id}: "daylight" "of" names the window it comes in at — an element of the scene standing in it (a card, a pane of glass, a plane), not ${JSON.stringify(l.of)}`); return; }
      const row = make(id, LIGHT.WINDOW), [bl, bt, br, bb] = el.box;
      Lt.node[row] = el.node; Lt.reach[row] = l.reach > 0 ? l.reach : 8; Lt.flicker[row] = flicker ?? 0; Lt.flags[row] = LIGHT.INSIDE;
      boxPane(row, el);
      rules.push({ row, keys, elements: [el], day: true, update() {
        // (its middle, and where its face looks: into the room)
        m34.point(T.nodes.m, 12 * el.node, (bl + br) / 2, -(bt + bb) / 2, 0, scratch);
        T.setLight3(Lt.at, row, scratch[0], scratch[1], scratch[2]);
        m34.direction(T.nodes.m, 12 * el.node, 0, 0, 1, way);
        const wl = Math.sqrt(way[0] * way[0] + way[1] * way[1] + way[2] * way[2]) || 1;
        T.setLight3(Lt.way, row, way[0] / wl, way[1] / wl, way[2] / wl);
        T.setLight(Lt.strength, row, day * on() * daylight.strength);
        T.setLight3(Lt.colour, row, daylight.colour[0], daylight.colour[1], daylight.colour[2]);
      } });
      return;
    }
    if (l.of != null) {
      const R = world.refOf(String(l.of)), of = world.byId.get(R.id), one = R.id !== String(l.of).split('#')[0];
      if (of && (of.kind === 'sky' || of.kind === 'insert')) { warn(`lights ${id}: "of" names a light standing in the scene — ${JSON.stringify(l.of)} is ${of.kind === 'sky' ? `the sky's: a light from it is far off, "from": ${JSON.stringify(l.of)}` : 'an insert\'s, over the frame'}`); return; }
      if (!of) warn(`lights ${id}: "of" names an element's light ("lamp", "lamp#wick", a copy's "lamp:2#wick") — there is no element ${JSON.stringify(R.id)}`);
      else if (one && (!of.copies || R.copy >= of.copies.length)) warn(`lights ${id}: "of" ${JSON.stringify(l.of)} names copy ${R.copy} of "${R.id}" — it has ${of.copies ? `${of.copies.length} (0…${of.copies.length - 1})` : 'no copies'}`);
      taken.set(String(l.of), { id, l, on, colour, flicker, falloff, keys, one, cone });
      return;
    }
    const strength = num(l.strength) ? l.strength : 1;
    if (l.from != null) {
      let aim = null, stale = null, elements = [], panes = null;
      if (Array.isArray(l.from)) {
        const pv = k => (typeof l.place?.[k] === 'string' && num(value(l.place[k])) ? value(l.place[k]) : null);
        aim = () => {
          const b = (pv('bearing') ?? (Number(l.from[0]) || 0)) * DEG, h = (pv('height') ?? (Number(l.from[1]) || 0)) * DEG;
          way[0] = Math.sin(b) * Math.cos(h); way[1] = Math.sin(h); way[2] = -Math.cos(b) * Math.cos(h);
          return true;
        };
      } else {
        const [el, name] = String(l.from).split('#'), sky = world.byId.get(el);
        if (!sky || sky.kind !== 'sky') { warn(`lights ${id}: "from" is [bearing, height] (degrees) or a point of a sky element ("moon", "moon#disc")`); return; }
        elements = [sky];
        // (a point it does not mark now: it does not shine). Aimed anew whenever the point is elsewhere than it was
        // aimed at — marked by its animate, in a layer its pose carries, the backdrop carried by the yaw
        const pt = name ?? null, was = { x: NaN, y: NaN, yaw: NaN, here: false }, round = !!C.camera.round;
        aim = () => {
          const here = world.stagePoint(sky, pt, at2);
          if (here) { way[0] = at2[0]; way[1] = at2[1]; way[2] = world.yaw; skyWay(way, world.sky); }
          was.here = here; was.x = at2[0]; was.y = at2[1]; was.yaw = world.yaw;
          return here;
        };
        stale = () => { const here = world.stagePoint(sky, pt, at2); return here !== was.here || (here && (at2[0] !== was.x || at2[1] !== was.y || (!round && world.yaw !== was.yaw))); };
      }
      if (l.through != null) {
        const polygon = p => Array.isArray(p) && p.length >= 3 && p.every(c => Array.isArray(c) && c.length === 3 && c.every(num));
        if (!Array.isArray(l.through) || !l.through.every(p => typeof p === 'string' || polygon(p))) warn(`lights ${id}: "through" is a list of panes, each a window element's id or a polygon of [across, distance, elevation] points (metres)`);
        else if (l.through.some(p => typeof p === 'string' && !world.byId.get(p))) warn(`lights ${id}: "through" names ${JSON.stringify(l.through.find(p => typeof p === 'string' && !world.byId.get(p)))} — an element of the scene standing in it, a window (a card, a pane of glass, a plane)`);
        else panes = l.through;
      }
      const row = make(id, panes ? LIGHT.THROUGH : LIGHT.FAR);
      if (colour) T.setLight3(Lt.colour, row, colour[0], colour[1], colour[2]);
      if (panes) {
        Lt.soft[row] = l.soft > 0 ? l.soft : 0.3;
        for (const p of panes) { if (typeof p === 'string') boxPane(row, world.byId.get(p)); else polygonPane(row, p); }
      }
      rules.push({ row, keys, elements, far: true, stale, update() {
        const shines = aim();
        if (shines) T.setLight3(Lt.way, row, way[0], way[1], way[2]);
        T.setLight(Lt.strength, row, shines ? strength * on() : 0);
      } });
      return;
    }
    const reach = l.reach > 0 ? l.reach : 8, glow = l.glow > 0 ? l.glow : 0;
    const point = () => { const row = make(id, LIGHT.POINT); if (colour) T.setLight3(Lt.colour, row, colour[0], colour[1], colour[2]); Lt.reach[row] = reach; Lt.flicker[row] = flicker ?? 0; Lt.glow[row] = glow; Lt.falloff[row] = falloff ?? 0; Lt.flags[row] = (day ? LIGHT.INSIDE : 0) | flagsOf(row); if (cone) coned(row, cone); return row; };
    const shine = (row, k) => { T.setLight(Lt.strength, row, strength * k * (day ? daylight.strength : 1)); if (day) T.setLight3(Lt.colour, row, daylight.colour[0], daylight.colour[1], daylight.colour[2]); };
    if (l.at != null) {
      // (a point it goes with: a person's — their hands unless one is named —, an element's, a copy's "id:k#name" —
      // world.pointOf resolves it: wherever it is now; nowhere while the person is away, nor while a painting that
      // marks it is not taken yet — taken, its element's rules run again: repainted)
      const ref = String(l.at), R = world.refOf(ref), p = world.byId.get(R.id);
      if (!p || ['sky', 'insert', 'particles'].includes(p.kind)) { warn(`lights ${id}: "at" is a point in the scene — a person's ("keeper#hand_r"), an element's ("cart#lamp", a copy's "cart:2#lamp") —, not ${JSON.stringify(ref)}`); return; }
      if (R.copy >= p.nodes.length) { warn(`lights ${id}: "at" ${JSON.stringify(ref)} names copy ${R.copy} of "${R.id}" — it has ${p.copies ? `${p.copies.length} (0…${p.copies.length - 1})` : 'no copies'}`); return; }
      const person = p.kind === 'person', name = person && R.name == null ? `${R.id}#hands` : ref, row = point();
      Lt.node[row] = p.nodes[R.copy];
      rules.push({ row, keys, person: person ? p : null, elements: person ? null : [p], posed: !person && !!p.spec.animated, day: !!day, update() {
        const here = world.pointOf(name, scratch);
        if (here) T.setLight3(Lt.at, row, scratch[0], scratch[1], scratch[2]);
        if (cone) cone.aim(row);
        shine(row, here ? on() : 0);
      } });
    } else {
      if (!(l.distance > 0) && typeof l.place?.distance !== 'string') { warn(`lights ${id}: a point light has a "distance" (metres); one far off has "from": [bearing, height]; one carried, "at": a point it goes with`); return; }
      const place = l.place && typeof l.place === 'object' ? l.place : {}, k = f => (typeof place[f] === 'string' && num(value(place[f])) ? value(place[f]) : null), row = point();
      rules.push({ row, keys, day: !!day, update() {
        const distance = k('distance') ?? l.distance, across = k('across') ?? (num(l.across) ? l.across : num(l.x) ? (l.x - 0.5) * STAGE * distance : 0);
        const elevation = (k('elevation') ?? (num(l.elevation) ? l.elevation : 0)) + world.groundAt(across, distance);
        T.setLight3(Lt.at, row, across, elevation, -distance);
        if (cone) cone.aim(row);
        shine(row, on());
      } });
    }
  });
  // the panes as WT5 has them
  world.panes = { n: paneNode.length, node: Int32Array.from(paneNode), rect: Float32Array.from(paneRect), poly: Float32Array.from(panePoly), polyOf: Int32Array.from(paneOf), light: Int32Array.from(paneLight), stamp: T.tick };

  // ── the elements' own lights (their paintings', e.light), as they are painted now — each the same row while the
  // painting has it where it had it (its sheet, its place among that sheet's lights, its name, its copy) ──
  const own = new Map(); // element → [rule]
  function ownRule(el, key, over, row, copy) {
    const r = {
      row, key, keys: over?.keys || [], elements: [el], posed: false, pl: null, strength: 0, glow: -1,
      update() {
        if (!world.sheetPoint(el, copy, r.pl, world.yaw, scratch)) nodeAt(el.nodes[copy], scratch);
        T.setLight3(Lt.at, row, scratch[0], scratch[1], scratch[2]);
        if (over?.cone) over.cone.aim(row);
        // (as much of it as its animate lets it glow now: e.glow; a copy's own share)
        T.setLight(Lt.strength, row, r.strength * (over ? over.on() : 1) * (el.visible ? 1 : 0) * (r.glow < 0 ? 1 : el.glowK[r.glow]) * (el.copies ? el.copies[copy].glow : 1));
      },
    };
    return r;
  }
  function lightsOf(el, was) {
    const list = [];
    // (an insert's glows are not lights in the world; the sky's are glows only, at infinity — LIGHT.SKY: its row's `at`
    // the way toward it, its sprite's radius in stage heights, no reach: it lights nothing — a light from the sky is far
    // off, "from" its point)
    if (el.kind === 'insert' || el.kind === 'particles') return list;
    const sky = el.kind === 'sky';
    const old = new Map();
    if (was) for (const r of was) old.set(r.key, r);
    for (let c = 0; c < el.nodes.length; c++) {
      for (let i = 0; i < el.lights.length; i++) {
        const pl = el.lights[i], key = `${pl.part}:${pl.layer}:${i}:${pl.name}:${c}`;
        const name = pl.name == null ? el.id : `${el.id}#${pl.name}`, mine = el.copies ? (pl.name == null ? `${el.id}:${c}` : `${el.id}:${c}#${pl.name}`) : null;
        const over = (mine && taken.get(mine)) || taken.get(name) || null;
        let r = old.get(key);
        if (r) old.delete(key);
        else { const id = over ? over.id : name; r = ownRule(el, key, over, make(el.copies && !over?.one ? `${id}:${c}` : id, LIGHT.POINT), c); Lt.node[r.row] = el.nodes[c]; if (over?.cone) coned(r.row, over.cone); }
        const row = r.row, col = (over?.colour) || colourOf(pl.color, `${el.who}: e.light`, warn) || [1, 1, 1], tint = el.copies ? el.copies[c].tint : null, scale = el.copies ? el.copies[c].scale : 1;
        r.pl = pl; r.posed = pl.layer >= 0 && el.spec.animated; r.glow = el.glowIndex.get(pl.name) ?? -1;
        T.setLight(Lt.sprite, row, pl.r * scale); T.setLight(Lt.flicker, row, over?.flicker ?? el.flags.flicker);
        T.setLight(Lt.reach, row, sky ? 0 : over?.l.reach > 0 ? over.l.reach : 2 * pl.r * scale);
        T.setLight3(Lt.colour, row, col[0] * (tint ? tint[0] : 1), col[1] * (tint ? tint[1] : 1), col[2] * (tint ? tint[2] : 1));
        T.setLight(Lt.flags, row, sky ? LIGHT.GLOW | LIGHT.SKY : (el.flags.inside ? LIGHT.INSIDE : 0) | LIGHT.GLOW);
        r.strength = num(over?.l.strength) ? over.l.strength : pl.strength;
        T.setLight(Lt.falloff, row, over?.falloff ?? (pl.falloff === 'linear' ? 1 : 0));
        list.push(r);
      }
    }
    for (const r of old.values()) T.freeLight(r.row);
    return list;
  }
  // which rules a key moves, an element moving moves, run every step (a person's hands, a posed layer's)
  // (ownRules: the elements' own lights' rules, every one — gone through when everything is worked out anew)
  const byKey = new Map(), byElement = new Map(), elementRules = [], always = [], ownRules = [], watched = rules.filter(r => r.stale);
  function index() {
    byKey.clear(); byElement.clear(); always.length = 0; elementRules.length = 0; ownRules.length = 0;
    for (const list of own.values()) for (const r of list) ownRules.push(r);
    const all = [...rules, ...ownRules];
    for (const r of all) {
      for (const k of r.keys) (byKey.get(k) || byKey.set(k, []).get(k)).push(r);
      if (r.person || r.posed) always.push(r);
      for (const el of r.elements || []) (byElement.get(el) || byElement.set(el, []).get(el)).push(r);
    }
    for (const [el, rs] of byElement) elementRules.push({ el, rs });
    // which rows a caster's shadow.light names
    const named = [];
    for (const el of world.elements) if (el.spec.shadow && el.spec.shadow.light != null && !named.includes(el.spec.shadow.light)) named.push(el.spec.shadow.light);
    for (let row = 0; row < Lt.n; row++) { const id = Lt.ids[row]; if (id != null) Lt.named[row] = named.some(name => namesLight(name, id)) ? 1 : 0; }
  }
  for (const el of world.elements) if (el.lights.length) own.set(el, lightsOf(el, null));
  index();
  let round = 0;
  const run = r => { if (r.ran !== round) { r.ran = round; r.update(); } };
  // everything anew: the daylight first (the look's ambient), then the lights
  function all() {
    round++;
    outside();
    for (let i = 0; i < rules.length; i++) run(rules[i]);
    for (let i = 0; i < ownRules.length; i++) run(ownRules[i]);
  }
  return {
    all,
    // an element painted anew (its painting taken): its lights made anew in place, and the spec's lights at a point
    // of it (its painting marks the point: where it is now — a far light from it follows by its own `stale`)
    repainted(el) {
      const was = own.get(el) || null, list = lightsOf(el, was);
      if (list.length) own.set(el, list); else own.delete(el);
      index();
      round++;
      for (const r of list) run(r);
      const at = byElement.get(el);
      if (at) for (const r of at) if (!r.far) run(r);
    },
    // the step: the keys changed; the elements moved or animated this step; yawed — the frame's yaw is another (what
    // faces the eye carries its lights round; the backdrop its far light); lookChanged — every light's share anew
    frame(keys, yawed, lookChanged) {
      if (lookChanged) { all(); return; }
      round++;
      for (let i = 0; i < keys.length; i++) { const rs = byKey.get(keys[i]); if (rs) for (let k = 0; k < rs.length; k++) run(rs[k]); }
      for (let i = 0; i < elementRules.length; i++) { const el = elementRules[i].el, rs = elementRules[i].rs; if (el.movedAt === T.tick || el.glowedAt === T.tick || (yawed && (el.flags.faceEye || (el.kind === 'sky' && !world.sky.round)))) for (let k = 0; k < rs.length; k++) run(rs[k]); }
      for (let i = 0; i < always.length; i++) run(always[i]);
      for (let i = 0; i < watched.length; i++) if (watched[i].ran !== round && watched[i].stale()) run(watched[i]);
    },
  };
}
