// A spec compiled for engine 3, once per show — in the scene's thread and, the same by index, in the artist (WT9):
// what each element is (its kind, where it stands, what it carries, how it is lit and seen), checked, its defaults
// filled, its code made into functions — so nothing on the tick's path asks the spec again. What is wrong is said
// (warn), once.
//   The words (LG13): WORDS holds the one closed list of the words of each kind of object of a spec; a word not in it
// is said once by whose it is and not taken. The words engine 3 accepts and does nothing for (LG5) are in the lists.
//   Units: metres; across to the right of the start's line of sight, distance ahead of it, elevation up. The world
// (world/world.js) puts these into its own (x = across, y = elevation, z = −distance).
import { compileParticles, mostOf, BURSTS } from './emitters.js';
import { INSERTS, OWN, PARTICLES, CLIP, linearOf } from '../base.js';

export const EYE = 1.7, STAGE = 16 / 9, NARROWEST = 4 / 3, WIDEST = 21 / 9;
// how near and far (metres) what is placed by its height on the stage ("y") may be
const Z_NEAR = 0.6 * EYE;
export const Z_FAR = 150 * EYE;
const MODES = ['picture', 'walk', 'panorama', 'overhead', 'around', 'roam', 'platform'];
const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = v => typeof v === 'number' && Number.isFinite(v);
const ids = v => (v === undefined ? [] : typeof v === 'string' ? [v] : Array.isArray(v) ? v : null);
const object = v => !!v && typeof v === 'object' && !Array.isArray(v);

const WORDS = Object.freeze({
  spec: ['engine', 'title', 'caption', 'captions', 'music', 'notes', 'widgets', 'horizon', 'camera', 'light', 'lights', 'modules', 'lib', 'relief', 'script', 'showcase', 'state', 'states', 'objects'],
  camera: ['mode', 'height', 'look', 'follow', 'span', 'turn', 'area', 'hero', 'jump', 'on'],
  light: ['ambient', 'ambientColor', 'tint', 'tintStrength', 'vignette', 'grain', 'haze', 'hazeColor', 'hazeGlow', 'brightness', 'saturation', 'inside', 'bounce', 'shafts', 'wind', 'looks'],
  look: ['ambient', 'ambientColor', 'tint', 'tintStrength', 'vignette', 'grain', 'haze', 'hazeColor', 'hazeGlow', 'brightness', 'saturation', 'inside', 'bounce', 'shafts', 'wind', 'lights'],
  // (`size`: accepted, does nothing in engine 3 — LG5)
  lights: ['id', 'on', 'place', 'color', 'strength', 'reach', 'flicker', 'glow', 'from', 'through', 'soft', 'size', 'daylight', 'of', 'at', 'across', 'distance', 'elevation', 'x', 'cone'],
  // (a beam's: where it points, how wide, how soft its edge — world/light.js reads them)
  cone: ['bearing', 'height', 'width', 'soft'],
  // (`lit` on a plane: accepted, does nothing in engine 3 — LG5)
  element: ['id', 'name', 'x', 'y', 'across', 'distance', 'elevation', 'bearing', 'facing', 'tilt', 'roll', 'rotation', 'plane', 'width', 'depth', 'height', 'box', 'code', 'animate', 'redraw', 'place', 'on', 'onLand', 'copies',
    'sky', 'insert', 'iris', 'person', 'particles', 'unseen', 'glows', 'inside', 'translucent', 'reflect', 'glass', 'lit', 'walk', 'water', 'drape', 'flicker', 'solid', 'seen', 'shadow', 'clip', 'behind', 'inFront',
    'shader', 'uniforms', 'script', 'color'],
  place: ['across', 'distance', 'elevation', 'x', 'facing', 'tilt', 'roll', 'rotation', 'bearing'],
  copy: ['across', 'distance', 'elevation', 'facing', 'tilt', 'roll', 'rotation', 'scale', 'flip', 'tint', 'glow', 'seed'],
  // (a caster's `soft`, a mirror's and a pane's `blur`: accepted, do nothing in engine 3 — LG5)
  shadow: ['light', 'onto', 'strength', 'soft'],
  reflect: ['strength', 'fade', 'blur', 'rough', 'ripple'],
  glass: ['strength', 'blur'],
  clip: ['inside', 'outside'],
});
// the words of `o` that are of its kind: those that are not are said and left out of what is returned
function known(o, kind, who, warn) {
  const list = WORDS[kind];
  let out = o;
  for (const k of Object.keys(o)) {
    if (list.includes(k)) continue;
    warn(`${who}: "${k}" is not a word of engine 3's language here — not taken`);
    if (out === o) out = { ...o };
    delete out[k];
  }
  return out;
}

// The scene's camera as the spec says it (metres): { mode, h (the eye's height), look (screen heights the gaze is
// lowered), follow, sway, span, round, turn (radians either way), area [left, right, back, front], hero, jump,
// on (the element it rides, or null) }
function cameraSetup(spec, warn) {
  const c = object(spec?.camera) ? known(spec.camera, 'camera', 'camera', warn) : {}, mode = MODES.includes(c.mode) ? c.mode : 'walk';
  const h = mode === 'overhead' ? clamp(num(c.height) ? c.height : 8, EYE, 60 * EYE) : EYE;
  const look = clamp(num(c.look) ? c.look : mode === 'overhead' ? 0.25 : 0, -0.3, 0.45);
  const round = mode === 'around' || mode === 'roam', hero = mode === 'platform' && typeof c.hero === 'string' ? c.hero : null;
  const follow = Array.isArray(c.follow) ? c.follow.filter(id => typeof id === 'string') : [];
  const span = mode === 'panorama' && Array.isArray(c.span) && c.span.length === 2 && c.span.every(num) ? [-Math.abs(c.span[0]), Math.abs(c.span[1])] : null;
  const turn = mode === 'around' && num(c.turn) && c.turn > 0 && c.turn < 180 ? c.turn * DEG : null;
  const area = ['roam', 'walk', 'overhead'].includes(mode) && Array.isArray(c.area) && c.area.length === 4 && c.area.every(num) ? c.area.map(Math.abs) : null;
  return { mode, h, look, follow: round || hero ? [] : follow, sway: mode === 'picture' ? 0.033 * EYE : 0, span, round, turn, area, hero, jump: num(c.jump) ? c.jump : 2.2, on: typeof c.on === 'string' ? c.on : null };
}

// The spec compiled: { spec, yh (the eye's line on the frame, 0…1 from the top), camera, elements: [E], byId, light,
// lights, relief, lib, script, showcase, state, has }. E — an element as written, made ready (the same in both
// threads, by index: E.index IS its place in C.elements — WT9):
//   { index, path (its place in spec.objects: the `objects[i]` the page names it by), id, name, who, o (the spec
//     object), kind: card | plane | sky | insert | person | particles | unseen,
//     at: { across, distance, elevation, radial }, bearing, facing, tilt, roll, plane: { width, depth, rotation, tilt } | null,
//     place: { field: key } | null, on, height, box, copies: [{ across, distance, elevation, facing, roll (a card's), tilt,
//     rotation (a plane's), scale, flip, tint: [r, g, b], glow, seed }] | null, paints (it has paint code), code: fn(g, e) | null (made when first read:
//     the artist's), animate: fn(e) | null (likewise: the thread's), redraw: { key: step } | null, flags, shadow,
//     reflect, glass (a mirror's and a pane's numbers — a mirror's strength, rough, ripple may be state keys —, or null: WT11), clip: { inside, ids, set — its cutter set's
//     number } | null, cuts (bits: the cutter sets it is a cutter of — WT2), behind, inFront, insert: { key, iris |
//     null }, shader: { text, names, values } | null, particles, person, solid, width }
// C.has — what the world has, for the closed set of pipelines (RN2): nothing in it is guessed from a text.
// C.state — the spec's starting values.
export function compile(spec, warn, tr) {
  spec = object(spec) ? spec : {};
  known(spec, 'spec', 'the scene', warn);
  const yh = num(spec.horizon) ? clamp(spec.horizon, 0.05, 0.95) : 0.6;
  // (what is not in engine 3's language and a scene carried over may still have: said by what it is — LG6)
  const scriptSays = (text, who) => { if (typeof text === 'string' && /\b(scene|s)\.prepare\s*\(/.test(text)) warn(`${who}: scene.prepare is not in engine 3's language — a shot is made ready with scene.shot(values) and cut to with its cut()`); };
  scriptSays(spec.script, 'script'); scriptSays(spec.showcase, 'showcase');
  const camera = cameraSetup(spec, warn);
  // code made into functions when first read: the artist reads `code`, the thread `animate` — neither makes the other's
  const lazy = (E, name, text, args, who) => {
    let made = false, f = null;
    Object.defineProperty(E, name, { enumerable: true, get() {
      if (!made) { made = true; try { f = globalThis.MooodI18n.bind(tr, args, text); } catch (err) { warn(`${who}: ${err.message}`); f = null; } }
      return f;
    } });
  };
  const text = v => (typeof v === 'string' && v.trim() ? v : null);
  const objects = Array.isArray(spec.objects) ? spec.objects : [];
  const seen = new Set(), elements = [];
  objects.forEach((raw, path) => {
    // (an entry that is not an object makes no element: said)
    if (!object(raw)) { warn(`objects[${path}]: an object`); return; }
    const who = raw.name || raw.id || `objects[${path}]`, o = known(raw, 'element', who, warn);
    const id = o.id != null ? String(o.id) : null;
    if (id != null && seen.has(id)) warn(`${who}: the id "${id}" is another element's too — the later one is not found by it`);
    if (id != null && /[#@:^]/.test(id)) warn(`${who}: an id has no "#", "@", ":" or "^" — they name its points and copies`);
    if (id != null) seen.add(id);
    const kind = o.sky ? 'sky' : o.insert != null ? 'insert' : o.person ? 'person' : o.particles ? 'particles' : o.plane ? 'plane' : o.unseen && !o.code ? 'unseen' : 'card';
    const E = { index: elements.length, path, id, name: o.name ?? id, who, o, kind };
    // where its anchor is: x, y on the stage (seen from the start), across, distance, bearing — or, on another, metres
    // from that one's anchor along its axes
    const on = o.on != null ? String(o.on) : null;
    if (on != null && (o.x != null || o.y != null || o.bearing != null)) warn(`${who}: on "${on}" it stands by "across", "distance", "elevation" from its anchor — not "x", "y", "bearing"`);
    const ahead = o.bearing != null || (!num(o.across) && num(o.x));
    if (on == null && ahead && num(o.distance) && o.distance <= 0) warn(`${who}: "distance" ${o.distance} with ${o.bearing != null ? '"bearing"' : 'a stage "x"'} — how far ahead along it, above 0`);
    let distance = num(o.distance) && (o.distance > 0 || !ahead) ? o.distance : null;
    if (on != null) distance = num(o.distance) ? o.distance : 0;
    else if (distance == null) distance = kind === 'plane' ? 10 : num(o.y) ? (o.y > yh + 0.0125 ? clamp(EYE / (o.y - yh), Z_NEAR, Z_FAR) : Z_FAR) : Z_FAR;
    let across = num(o.across) ? o.across : 0;
    const radial = distance;
    E.bearing = on == null && num(o.bearing) && !o.sky ? o.bearing : null;
    if (E.bearing != null) { const b = E.bearing * DEG; across = distance * Math.sin(b); distance *= Math.cos(b); }
    else if (on == null && !num(o.across) && num(o.x)) across = (o.x - 0.5) * STAGE * distance;
    E.at = { across, distance, elevation: num(o.elevation) ? o.elevation : 0, radial: E.bearing != null ? radial : Math.sqrt(across * across + distance * distance) };
    E.on = on;
    // its turn: a card's facing, tilt and roll (degrees; null: it faces the eye), a plane's rotation and tilt
    const bad = k => o[k] != null && !num(o[k]) && warn(`${who}: "${k}" is degrees, a number`);
    bad('facing'); bad('tilt'); bad('roll'); bad('rotation');
    if (kind === 'plane') {
      if (o.facing != null || o.roll != null) warn(`${who}: a plane turns by "rotation" (and "tilt"), not "${o.facing != null ? 'facing' : 'roll'}"`);
      const tilt = num(o.tilt) ? o.tilt : 0;
      if (Math.abs((((tilt % 180) + 180) % 180) - 90) <= 10 && !o.reflect) warn(`${who}: a plane tilted ${tilt}° stands nearly upright — a wall, a door is a card ("facing", "tilt" from upright); a mirror on a wall is a plane ("reflect")`);
      E.plane = { width: Math.max(0.05, num(o.width) ? o.width : 4), depth: Math.max(0.05, num(o.depth) ? o.depth : 4), rotation: num(o.rotation) ? o.rotation : 0, tilt };
      E.facing = null; E.tilt = null; E.roll = null;
    } else {
      E.plane = null;
      E.facing = num(o.facing) ? o.facing : null;
      E.tilt = num(o.tilt) ? o.tilt : null;
      E.roll = num(o.roll) ? o.roll : null;
      if (E.tilt != null && Math.abs(E.tilt) > 90) warn(`${who}: "tilt" ${E.tilt}° lays it face down — a card leans from upright, −90…90; what lies flat is a plane`);
    }
    // what moves it: its place's keys
    if (o.place != null && (!object(o.place) || Object.entries(o.place).some(([k, v]) => !WORDS.place.includes(k) || typeof v !== 'string'))) {
      warn(`${who}: "place" is { ${WORDS.place.join(' | ')}: state key }`);
      E.place = null;
    } else E.place = o.place && Object.keys(o.place).length ? { ...o.place } : null;
    if (E.place?.x && on != null) warn(`${who}: on "${on}" its place moves "across", not "x"`);
    // its size: its height (metres), the box its painting fits in, round its anchor
    E.height = num(o.height) && o.height > 0 ? o.height : 2;
    const h = E.height;
    const box = Array.isArray(o.box) && o.box.length === 4 && o.box.every(num) && o.box[2] > o.box[0] && o.box[3] > o.box[1] ? o.box.slice() : null;
    if (o.box != null && !box) warn(`${who}: "box" is [left, top, right, bottom] ${kind === 'sky' ? 'stage heights' : 'metres round its anchor'}`);
    E.box = kind === 'plane' ? [-E.plane.width / 2, -E.plane.depth / 2, E.plane.width / 2, E.plane.depth / 2]
      : kind === 'sky' ? skyBox(box, camera.round, who, warn)
        : kind === 'insert' ? [(STAGE - WIDEST) / 2, 0, (STAGE + WIDEST) / 2, 1]
          // (a particle's sprite, painted round its middle: its frames side by side)
          : kind === 'particles' ? box || [-0.5, -0.5, 0.5, 0.5]
            : box || [-0.8 * h, -1.1 * h, 0.8 * h, 0.15 * h];
    if (kind === 'person' && (o.code || o.height || o.box)) warn(`${who}: a person has no code, height or box — their look is their size`);
    E.paints = kind !== 'person' && kind !== 'unseen' && !!text(o.code);
    if (E.paints) lazy(E, 'code', o.code, 'g,e', who); else E.code = null;
    if (text(o.animate)) lazy(E, 'animate', o.animate, 'e', `${who}: animate`); else E.animate = null;
    E.animated = !!text(o.animate);
    // what repaints it: the keys it reads (found as it paints) — or only these, once moved a step
    E.redraw = null;
    if (o.redraw != null) {
      const steps = Array.isArray(o.redraw) ? Object.fromEntries(o.redraw.map(k => [k, 0])) : object(o.redraw) ? o.redraw : null;
      if (!steps || Object.values(steps).some(v => !num(v) || v < 0)) warn(`${who}: "redraw" is [state keys] or { key: step }`);
      else E.redraw = steps;
    }
    // how it is lit and seen
    const unit = (k, d) => (o[k] == null ? d : num(o[k]) && o[k] >= 0 && o[k] <= 1 ? o[k] : (warn(`${who}: "${k}" is 0…1`), d));
    E.flags = {
      glows: !!o.glows, inside: !!o.inside, translucent: unit('translucent', 0), unseen: !!o.unseen,
      onLand: on == null && o.onLand !== false && kind !== 'sky' && kind !== 'insert' && kind !== 'plane',
      // a card facing the eye (no facing, tilt, roll — nor a place turning it): turned about the vertical to the view's
      // yaw, upright
      faceEye: (kind === 'card' || kind === 'unseen') && E.facing == null && E.tilt == null && E.roll == null && !E.place?.facing && !E.place?.tilt && !E.place?.roll,
      reflect: kind === 'plane' ? mirrorOf(o, who, warn) : null,
      glass: glassOf(o, who, warn, kind),
      walk: kind === 'plane' && !!o.walk, water: kind === 'plane' && !!o.water, drape: kind === 'plane' && !!o.drape,
      flicker: num(o.flicker) ? clamp(o.flicker, 0, 1) : 0.3,
      solid: !!o.solid,
      seen: seenOf(o, who, warn, kind),
    };
    // (a mirror's and a pane's numbers: what WT11 names of the compiled spec)
    E.reflect = E.flags.reflect; E.glass = E.flags.glass;
    if (o.reflect && kind !== 'plane') warn(`${who}: "reflect" is a plane's (a mirror, water, a polished floor)`);
    if (o.lit != null && kind !== 'plane') warn(`${who}: "lit" is a plane's word (accepted; it does nothing in engine 3)`);
    if (o.drape && kind !== 'plane') warn(`${who}: "drape" is a plane's`);
    if (o.water && kind !== 'plane') warn(`${who}: "water" is a plane's (a water surface lying level)`);
    // (what is seen only in mirrors casts no shadow in the world)
    if (E.flags.seen && !E.flags.seen.main) { if (o.shadow) warn(`${who}: it is seen only in mirrors — it casts no shadow in the world`); E.shadow = null; }
    else E.shadow = shadowOf(o, who, warn, kind);
    E.clip = clipOf(o, who, warn); E.cuts = 0;
    E.behind = ids(o.behind); E.inFront = ids(o.inFront);
    if (!E.behind || !E.inFront) { warn(`${who}: "behind", "inFront" are lists of element ids`); E.behind ||= []; E.inFront ||= []; }
    if (kind === 'insert') {
      if (typeof o.insert !== 'string') warn(`${who}: "insert" is the state key that opens it`);
      if (o.behind || o.inFront || o.clip) warn(`${who}: an insert is over the whole scene — "behind", "inFront" and "clip" are for what stands in it`);
      const iris = o.iris;
      // (iris null: from the middle of the frame to all of it — WT5)
      E.insert = { key: typeof o.insert === 'string' ? o.insert : null, iris: iris === undefined ? null : Array.isArray(iris) && iris.length === 4 && iris.every(num) && iris[2] > 0 && iris[3] > 0 ? iris.slice() : (warn(`${who}: "iris" is [x, y, rx, ry] (stage heights, radii above 0)`), null) };
    } else E.insert = null;
    // its own shader (LG2: WGSL — `fn shade(painted, at, uv) -> vec4f` and what it needs above it) and the uniforms
    // its animate sets
    E.shader = null;
    if (o.shader != null) {
      const u = o.uniforms == null ? {} : object(o.uniforms) && Object.values(o.uniforms).every(num) ? o.uniforms : null;
      if (typeof o.shader !== 'string' || !u) warn(`${who}: "shader" is WGSL (its \`fn shade\`), "uniforms" { name: default number }`);
      else if (kind === 'person' || kind === 'particles' || kind === 'unseen') warn(`${who}: "shader" is for what is painted — a card, a plane, the sky, an insert`);
      // (WT2 `own`: nothing draws an own shader over the land — said, not taken)
      else if (E.flags.drape && text(spec.relief)) warn(`${who}: "shader" — a plane draped on the land is drawn without a shader of its own in engine 3`);
      else {
        const names = Object.keys(u);
        if (/\b(vec[234]|float|void|mat[234])\s+\w+\s*\(/.test(o.shader) || /\buniform\s+\w+/.test(o.shader)) warn(`${who}: its shader reads as GLSL — engine 3's is WGSL (fn shade(painted: vec4f, at: vec2f, uv: vec2f) -> vec4f)`);
        if (names.length > OWN.VALUES) throw new Error(`${who}: ${names.length} uniforms — a shader has at most ${OWN.VALUES}`);
        for (const n of names) if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(n)) throw new Error(`${who}: uniform "${n}" — a name of letters, digits and "_" (in the shader it is u_${n})`);
        E.shader = { text: o.shader, names, values: names.map(n => u[n]), stands: standsOf(o.shader) };
      }
    }
    // particles: its kind's and its own fields (world/emitters.js); its code, if any, paints its sprite
    E.particles = kind === 'particles' ? compileParticles(o.particles, who, warn, E.paints) : null;
    E.person = kind === 'person' ? (object(o.person) ? o.person : {}) : null;
    if (kind === 'person' && id == null) warn(`${who}: a person needs an id — the keys of their state are named by it: they are not shown`);
    E.solid = !!o.solid; E.width = num(o.width) ? o.width : 0.6;
    if ((kind === 'sky' || kind === 'insert') && (on != null || E.place)) warn(`${who}: the sky and an insert stand nowhere — no "on", no "place"`);
    E.copies = copiesOf(o, E, who, warn);
    elements.push(E);
  });
  const byId = new Map();
  for (const E of elements) if (E.id != null && !byId.has(E.id)) byId.set(E.id, E);
  // what stands on what: a chain that names no element, the sky, an insert, a person, copies, or goes round in a
  // circle is said
  for (const E of elements) {
    if (E.on == null) continue;
    const up = byId.get(E.on);
    if (!up) { warn(`${E.who}: "on" names the element it stands on — there is no element ${JSON.stringify(E.on)}`); E.on = null; continue; }
    if (up.kind === 'sky' || up.kind === 'insert') { warn(`${E.who}: "on" ${JSON.stringify(E.on)} — the sky or an insert carries nothing`); E.on = null; continue; }
    if (up.kind === 'person') { warn(`${E.who}: "on" ${JSON.stringify(E.on)} — a person carries by their parts (a cast's) and others by "<id>_on", not "on"`); E.on = null; continue; }
    if (up.copies) { warn(`${E.who}: "on" ${JSON.stringify(E.on)} — nothing stands on an element of "copies"`); E.on = null; continue; }
    const chain = [E];
    for (let p = up; p; p = p.on != null ? byId.get(p.on) : null) {
      if (chain.includes(p)) { warn(`${E.who}: "on" goes round in a circle (${[...chain, p].map(q => q.id).join(' → ')})`); E.on = null; break; }
      chain.push(p);
    }
  }
  // what the camera rides: an element that carries (a platformer's rides its hero)
  if (camera.on != null) {
    const up = byId.get(camera.on);
    if (camera.mode === 'platform') { warn(`camera: "on" — a platformer's camera rides its hero`); camera.on = null; }
    else if (!up || ['sky', 'insert', 'person'].includes(up.kind) || up.copies) { warn(`camera: "on" ${JSON.stringify(camera.on)} — the element the camera rides: one standing in the scene (not the sky, an insert, a person or copies)`); camera.on = null; }
  }
  for (const E of elements) {
    const named = list => list.filter(id => {
      if (byId.has(id) && byId.get(id).kind !== 'insert' && id !== E.id) return true;
      warn(`${E.who}: names "${id}" — not another element standing in the scene`);
      return false;
    });
    E.behind = named(E.behind); E.inFront = named(E.inFront);
    if (E.clip) E.clip.ids = named(E.clip.ids);
    if (E.shadow) E.shadow.onto = E.shadow.onto.filter(id => id === 'ground' || (byId.has(id) && byId.get(id) !== E && !['sky', 'insert'].includes(byId.get(id).kind)) || (warn(`${E.who}: its shadow falls on ${JSON.stringify(id)} — 'ground', a plane or an upright element of the scene`), false));
  }
  // the cutter sets (WT2): each distinct list of a clip's ids one, numbered as they come — at most CLIP.SETS, a
  // channel of the masks each. A person is neither clipped nor a cutter; a plane draped on the land is not a cutter
  const sets = [];
  for (const E of elements) {
    const c = E.clip;
    if (!c) continue;
    if (E.kind === 'person') { warn(`${E.who}: "clip" — a person is not clipped in engine 3`); E.clip = null; continue; }
    c.ids = [...new Set(c.ids)].filter(id => {
      const cutter = byId.get(id);
      // (each said once, by the cutter)
      if (cutter.kind === 'person') { warn(`"clip": "${id}" is a person — not a cutter in engine 3`); return false; }
      if (cutter.flags.drape && text(spec.relief)) { warn(`"clip": "${id}" is a plane draped on the land — not a cutter in engine 3`); return false; }
      return true;
    }).sort();
    if (!c.ids.length) { E.clip = null; continue; }
    const key = JSON.stringify(c.ids);
    let set = sets.indexOf(key);
    if (set < 0) {
      if (sets.length === CLIP.SETS) { warn(`"clip": the scene names more than ${CLIP.SETS} different lists of cutters — what a further one clips is not clipped`); E.clip = null; continue; }
      set = sets.push(key) - 1;
    }
    c.set = set;
    for (const id of c.ids) byId.get(id).cuts |= 1 << set;
  }
  const inserts = elements.filter(E => E.kind === 'insert');
  if (inserts.length > INSERTS.MOST) throw new Error(`the scene has ${inserts.length} inserts — at most ${INSERTS.MOST}`);
  // the light and its looks: the words checked here, their values read by world/light.js
  const light = object(spec.light) ? known(spec.light, 'light', 'light', warn) : {};
  if (light.looks != null && !object(light.looks)) { warn('light.looks: an object'); delete light.looks; }
  if (light.looks) { const looks = {}; for (const [k, v] of Object.entries(light.looks)) { if (object(v)) looks[k] = known(v, 'look', `light.looks.${k}`, warn); else warn(`light.looks.${k}: an object of light fields`); } light.looks = looks; }
  const lights = (Array.isArray(spec.lights) ? spec.lights : []).map((l, i) => {
    if (!object(l)) { warn(`lights[${i}]: an object`); return null; }
    const who = `lights ${l.id ?? `[${i}]`}`, o = known(l, 'lights', who, warn);
    return object(o.cone) ? { ...o, cone: known(o.cone, 'cone', `${who}: cone`, warn) } : o;
  });
  // the particles' cap (LG12; WT5: applied and said here, nowhere else): more alive at the most than the cap — every
  // emitter gives that much less, so that the sum of mostOf over the emitters as they are then is at most the cap.
  // The room: mostOf rounds an emitter's rate up by less than one, and a burst keeps at least one a time
  const emitters = elements.filter(E => E.particles), most = emitters.reduce((s, E) => s + mostOf(E.particles), 0);
  if (most > PARTICLES.MAX) {
    const k = (PARTICLES.MAX - emitters.length * (1 + BURSTS)) / most;
    if (!(k > 0)) throw new Error(`particles: ${emitters.length} emitters — more than the scene's ${PARTICLES.MAX} particles can serve`);
    warn(`particles: ${most} alive at the most — over the scene's ${PARTICLES.MAX}: every emitter gives ${Math.round((1 - k) * 100)}% less`);
    for (const E of emitters) { const p = E.particles; p.count = Math.floor(p.count * k); p.rate *= k; if (p.burst) p.burst.count = Math.max(1, Math.floor(p.burst.count * k)); }
  }
  // what the world has (RN2). What only paint code tells — a layer blended "multiply", a light painted (e.light) — is
  // not here: its pipelines are in every world (4.5)
  const own = [];
  for (const E of elements) if (E.shader && !own.some(x => x.text === E.shader.text && x.names.join() === E.shader.names.join())) own.push({ text: E.shader.text, names: E.shader.names });
  const has = {
    relief: !!text(spec.relief), people: elements.some(E => E.kind === 'person'), emitters: emitters.length > 0,
    // (casters — RN2: an element with a shadow, a person not told to cast none, an emitter whose particles cast)
    casters: elements.some(E => E.shadow || (E.kind === 'person' && E.shadow !== false) || (E.particles && E.particles.shadow > 0)),
    reflects: elements.some(E => E.flags.reflect), glass: elements.some(E => E.flags.glass), clips: elements.some(E => E.clip),
    inserts: inserts.length > 0,
    // (a light with a cone — a point's: not one far off, nor a window's daylight, where world/light.js does not take
    // it —: its beam in the haze, the beam pipeline)
    beams: lights.some(l => l && object(l.cone) && l.from == null && !((l.daylight === true || (typeof l.daylight === 'number' && l.daylight > 0)) && l.of != null)),
    own,
    // (the sky's base — the first shown sky element's painting, carried on past it: render/sky.js — with that element's
    // own shader: the own texts of the sky's elements)
    skyOwn: own.filter(o => elements.some(E => E.kind === 'sky' && E.shader && E.shader.text === o.text && E.shader.names.join() === o.names.join())),
  };
  // (the scene's own fade is gone — a scene never fades itself; fades are the game's and the page's, the stage's veil:
  // a spec that still starts `fade` or `fade_color`, not describing it as a key of its own, is told so)
  for (const k of ['fade', 'fade_color']) {
    if (object(spec.state) && k in spec.state && !(object(spec.states) && k in spec.states)) warn(`state "${k}": not the engine's — a scene does not fade itself (fades are the game's: bespoke.fade, show and cut with a fade); a key of the scene's own only if its code reads it`);
  }
  return {
    spec, yh, camera, elements, byId, light, lights, has,
    relief: text(spec.relief), lib: text(spec.lib), script: text(spec.script), showcase: text(spec.showcase),
    state: object(spec.state) ? spec.state : {},
  };
}

// A sky element's box (stage heights): what it paints — by default the stage and its margins; the author's, as far as
// a whole turn across (more would only paint the same turn again) and SKY_UP … SKY_DOWN up and down. Past what it
// paints the first shown sky element is carried on softly (render/sky.js)
const SKY_MARGIN = 0.3, SKY_UP = -3, SKY_DOWN = 4;
function skyBox(box, round, who, warn) {
  if (!box) return [-SKY_MARGIN, -0.35, (round ? 2 * Math.PI : STAGE) + SKY_MARGIN, 1.25];
  const most = 2 * Math.PI + 2 * SKY_MARGIN;
  if (box[2] - box[0] > most || box[1] < SKY_UP || box[3] > SKY_DOWN) {
    warn(`${who}: a sky's "box" goes at most a whole turn across (${most.toFixed(2)} stage heights) and from ${SKY_UP} to ${SKY_DOWN} down — taken so far`);
    box = [box[0], Math.max(SKY_UP, box[1]), Math.min(box[2], box[0] + most), Math.min(SKY_DOWN, box[3])];
    if (box[3] <= box[1]) box[3] = box[1] + 1;
  }
  return box;
}

// Which of an own shader's paintings its text reads only where the quad stands (WT2) → Uint8Array(OWN.SHEETS), 1 for
// such a sheet: sheet k when every `layer(k, …)` in the text has exactly `at` as its second argument — the painting
// itself (0) also when the text never calls layer(0, …): `painted` is it, where the quad stands. A call whose first
// argument is not an integer literal may read any sheet: none stands. A text that declares an `at` of its own (`let
// at`, `var at`, `var<private> at`, `const at`, a parameter of that name of another function than shade) has made
// `at` another point: nothing it reads by it stands. A function of the text alone: the same text is the same answer
// (has.own's entries)
function standsOf(text) {
  const stands = new Uint8Array(OWN.SHEETS).fill(1), t = text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  // (the bracket that closes the one opened at i; the text's end if none does)
  const closing = i => { let depth = 0; for (; i < t.length; i++) { const ch = t[i]; if (ch === '(' || ch === '[') depth++; else if ((ch === ')' || ch === ']') && --depth === 0) return i; } return t.length; };
  // (what stands between two brackets, cut at its commas — those of no bracket inside it)
  const parts = (from, to) => { const out = []; let depth = 0, start = from; for (let i = from; i < to; i++) { const ch = t[i]; if (ch === '(' || ch === '[') depth++; else if (ch === ')' || ch === ']') depth--; else if (ch === ',' && !depth) { out.push(t.slice(start, i).trim()); start = i + 1; } } out.push(t.slice(start, to).trim()); return out; };
  let own = /\b(?:(?:let|const|var)\s+|var\s*<[^>]*>\s*)at\b/.test(t);
  for (const m of t.matchAll(/\bfn\s+(\w+)\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    if (m[1] !== 'shade' && parts(open + 1, closing(open)).some(p => /^at\s*:/.test(p))) own = true;
  }
  for (const m of t.matchAll(/(?<![\w.])layer\s*\(/g)) {
    const open = m.index + m[0].length - 1, args = parts(open + 1, closing(open));
    if (!/^\d+[iu]?$/.test(args[0])) return stands.fill(0);
    const k = parseInt(args[0], 10);
    if (k < OWN.SHEETS && (own || args.length !== 2 || args[1] !== 'at')) stands[k] = 0;
  }
  return stands;
}

// `copies` (LG1): the element stands at each of them — painted once, each a place, a turn, a size of its own
function copiesOf(o, E, who, warn) {
  if (o.copies == null) return null;
  const refuse = why => { warn(`${who}: "copies" — ${why}`); return null; };
  if (!Array.isArray(o.copies) || !o.copies.length || !o.copies.every(object)) return refuse('a list of { across, distance, elevation?, facing?, roll? (a card\'s) or rotation? (a plane\'s), tilt?, scale?, flip?, tint?, glow?, seed? }');
  if (E.kind !== 'card' && E.kind !== 'plane' && E.kind !== 'unseen') return refuse('for a card or a plane (not people, particles, the sky or an insert)');
  if (E.kind === 'plane' && (o.reflect || o.drape)) return refuse('not for a plane that mirrors or is draped on the land');
  if (E.flags.glass) return refuse('not for a pane of glass');
  if (E.place) { warn(`${who}: with "copies" each stands where its copy says — its "place" is not taken`); E.place = null; E.flags.faceEye = (E.kind === 'card' || E.kind === 'unseen') && E.facing == null && E.tilt == null && E.roll == null; }
  return o.copies.map((raw, k) => {
    const c = known(raw, 'copy', `${who}: copies[${k}]`, warn), n = (v, d) => (num(v) ? v : d);
    if (!num(c.across) || !num(c.distance)) warn(`${who}: copies[${k}]: "across" and "distance" (metres) say where it stands`);
    const tint = c.tint == null ? [1, 1, 1] : linearOf(c.tint) || (warn(`${who}: copies[${k}]: "tint" is a colour ("#rrggbb")`), [1, 1, 1]);
    if (c.scale != null && !(num(c.scale) && c.scale >= 0.25 && c.scale <= 4)) warn(`${who}: copies[${k}]: "scale" is 0.25…4`);
    // (a copy turns as its element does: a card's by its own "facing" and "roll", a plane's by its own "rotation" — each
    // with its own "tilt"; what it does not say, the element's)
    if (E.kind === 'plane' && (c.facing != null || c.roll != null)) warn(`${who}: copies[${k}]: a plane's copy turns by its own "rotation" — "${c.facing != null ? 'facing' : 'roll'}" is a card's: not taken`);
    if (E.kind !== 'plane' && c.rotation != null) warn(`${who}: copies[${k}]: a card's copy turns by its own "facing" — "rotation" is a plane's: not taken`);
    return {
      across: n(c.across, E.at.across), distance: n(c.distance, E.at.distance), elevation: n(c.elevation, E.at.elevation),
      facing: E.kind !== 'plane' && num(c.facing) ? c.facing : null, tilt: num(c.tilt) ? c.tilt : null, roll: E.kind !== 'plane' && num(c.roll) ? c.roll : null, rotation: E.kind === 'plane' && num(c.rotation) ? c.rotation : null,
      scale: clamp(n(c.scale, 1), 0.25, 4), flip: !!c.flip, tint, glow: Math.max(0, n(c.glow, 1)), seed: n(c.seed, k),
    };
  });
}
// `reflect` on a plane: { strength, fade (metres), rough, ripple } or null (`blur`: accepted, nothing — LG5);
// strength, rough and ripple each a number 0…1 or a state key (its value now: world.js el.mirror)
function mirrorOf(o, who, warn) {
  const r = o.reflect;
  if (!r) return null;
  const c = r === true ? {} : typeof r === 'number' ? { strength: r } : object(r) ? known(r, 'reflect', `${who}: reflect`, warn) : null;
  const keyed = v => v == null || (num(v) && v >= 0) || (typeof v === 'string' && v !== '');
  if (!c || [c.fade, c.blur].some(v => v != null && !(num(v) && v >= 0)) || ![c.strength, c.rough, c.ripple].every(keyed)) {
    warn(`${who}: "reflect" on a plane is true, a strength 0…1 or { "strength", "fade" (metres), "rough", "ripple" } — strength, rough and ripple each 0…1 or a state key`);
    return null;
  }
  const part = (v, none) => (typeof v === 'string' ? v : clamp(v ?? none, 0, 1));
  return { strength: part(c.strength, 0.35), fade: c.fade ?? 4, rough: part(c.rough, 0), ripple: part(c.ripple, 0) };
}
// `seen`: where it is seen — { main: in the view itself, mirrors: in reflections } — or null (everywhere).
// "reflection": only in mirrors (a ghost in the water, a figure in a looking-glass)
function seenOf(o, who, warn, kind) {
  const s = o.seen;
  if (s == null) return null;
  if (s !== 'reflection') { warn(`${who}: "seen" is "reflection" (only in mirrors) — "direct" and a list of mirrors are not built in engine 3`); return null; }
  if ((kind !== 'card' && kind !== 'plane') || o.unseen || o.drape || o.glass || (kind === 'plane' && o.reflect)) { warn(`${who}: "seen" is for what is painted standing in the scene — a card, a plane (not one draped on the land, nor a mirror, nor unseen)`); return null; }
  return { main: false, mirrors: true };
}
// `glass` on an upright element: { strength } or null (`blur`: accepted, nothing — LG5)
function glassOf(o, who, warn, kind) {
  const r = o.glass;
  if (r == null || r === false) return null;
  const c = r === true ? {} : typeof r === 'number' ? { strength: r } : object(r) ? known(r, 'glass', `${who}: glass`, warn) : null;
  if (!c || kind === 'plane' || kind === 'sky' || [c.strength, c.blur].some(v => v != null && !(num(v) && v >= 0))) { warn(`${who}: "glass" is on an upright element: true, a strength 0…1 or { "strength" }`); return null; }
  return { strength: clamp(c.strength ?? 0.25, 0, 1) };
}
// `shadow`: { light: id | null, onto: ['ground' | id], strength }, false (said: none — a person's, who casts one
// unless told so) or null (not said). `soft`: accepted, nothing — LG5
function shadowOf(o, who, warn, kind) {
  const sh = o.shadow;
  if (sh === false) return false;
  if (!sh) return null;
  const c = sh === true ? {} : object(sh) ? known(sh, 'shadow', `${who}: shadow`, warn) : null;
  if (!c || o.id == null || ['sky', 'insert', 'particles'].includes(kind) || o.drape) { warn(`${who}: "shadow" is true or { light, onto, strength } — on something standing in the scene or a plane (not the land), with an id`); return null; }
  if (o.unseen) { warn(`${who}: it is unseen — what is not seen casts no shadow`); return null; }
  const onto = c.onto == null ? ['ground'] : Array.isArray(c.onto) ? c.onto.map(String) : [String(c.onto)];
  return { light: c.light != null ? String(c.light) : null, onto, strength: clamp(Number(c.strength ?? 0.5) || 0, 0, 1) };
}
// `clip`: { inside: true | false, ids } or null (its cutter set is numbered once every element is known: compile)
function clipOf(o, who, warn) {
  const c = o.clip;
  if (c == null) return null;
  const side = object(c) ? ['inside', 'outside'].find(k => k in c) : null;
  const list = side && ids(c[side]);
  if (!list) { warn(`${who}: "clip" is {inside: ids} or {outside: ids}`); return null; }
  return list.length ? { inside: side === 'inside', ids: list } : null;
}
