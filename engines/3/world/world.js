// The world: the compiled spec (world/spec.js) as tables (world/tables.js, WT1–WT10) — a node for every element (for
// every copy of a copied one, every part), placed where its anchor is (its `at`, its `place` keys, the land under it),
// turned as it is, carried by what it stands `on`; a block of quads for its sheets; its layers' rows — and what is
// asked of where things are: points, the ground, rays. Nothing here paints: an element's painting is asked of the
// artist (SH6 'make') and its answer taken ('made') — its recording given to SHEETS, its sheet put on its quads when
// its pages are there (a swap, SH2).
//   Coordinates: metres — x across (to the right of the start's line of sight), y up, z = −distance. A node's own
// axes: +x its painting's right, +y its painting's up (−y of the painting: Canvas's y is down), +z where its face
// looks. So a painting's point (x, y) is the node's (x, −y, 0) — world/place.js is that mapping for every kind.
//   An element's quads (WT8 quadsOf → [first, count]) are a block of rows side by side: for each copy, one quad a
// sheet — the base painting, then its parts, then its layers (row = first + copy · sheets + sheet). A painting anew
// with the same parts and layers swaps sheets on those rows. One with other parts or layers takes a NEW block, its
// rows shown with no sheet (−1: not drawn) and named by the swaps that carry their sheets, so a view asks their
// pages; when the swap lands the old block is freed (a shot's swaps name those rows too, as ended: SH2). A shape and
// its painting never change apart.
//   Nothing is worked out per tick for what does not move: a key changed marks what reads it (its place → its node
// and what it carries; its painting → asked anew), and only those are touched (frame()).
import { QUAD, FLAG, FORM, OWN, ORIGIN, RECV, MAKES_AHEAD, empty, framedPoint } from '../base.js';
import { STAGE, EYE, PACE_MOST } from './spec.js';
import { createTables, packNode, packQuad, packLayer, drain, NODE_BYTES, QUAD_BYTES, LAYER_BYTES } from './tables.js';
import * as m34 from './m34.js';
import { place, posed, skyWay, skyAt, IRIS_ALL } from './place.js';
import { surfaceOf, reliefOf } from './relief.js';
import { createSpace } from './space.js';
import { animateContext } from './element.js';
import { namesLight } from './light.js';
import { Recording } from '../sheets/recorder.js';

const DEG = Math.PI / 180, TAU = 2 * Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
// a plane's carry frame: what stands on a plane stands on its face — the start's up its normal, the start's ahead its
// far edge (a quarter turn about x)
const PLANE_CARRY = Float64Array.of(1, 0, 0, 0, 0, 1, 0, -1, 0, 0, 0, 0);
// what nothing stands on (spec.js: "on")
const NOT_CARRYING = new Set(['sky', 'insert', 'person']);
// a number of the state by its key (`get`: key → value), or null (no key, not a number)
const val = (get, k) => { if (typeof k !== 'string') return null; const v = get(k); return typeof v === 'number' && Number.isFinite(v) ? v : null; };
const sameValue = (a, b) => a === b || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
// the forms' texture: forms across a row of it (WT10)
const FORMS_ACROSS = 31, FORM_W = 2 * FORM.SIDE, FORM_POINTS = FORM.SIDE * FORM.SIDE;
// a plane no farther than this from the level of the ground (metres), not tilted, lies on the ground
const GROUND_LEVEL = 0.2;

// C: the compiled spec. env: { state, shared (kit.shared's: anim, lib, kits), height (the land function, or null),
// sheets, gpu, artist: { post(message) } — the scene's artist —, arrived() — an answer of the artist's came (the
// thread's arrival()) —, warn(text), report(who, err), debug — notes kept }
export function createWorld(C, env) {
  const { state, sheets, gpu, warn } = env;
  const T = createTables();
  const elements = [], byId = new Map();
  const world = {
    C, tables: T, nodes: T.nodes, quads: T.quads, layers: T.layers, lights: T.lights, forms: T.forms,
    elements, byId, warn, look: null, relief: null, emitters: null, people: null, panes: null, lit: null,
    own: [], inserts: [],
    // the director's moves (play/director.js: moveOf, moveAt, ahead — the thread sets it); on a seen step an insert's
    // opening begins in, the seconds since its key left 0, else −1 (openings)
    moves: null, opened: -1,
    bounds: { min: new Float64Array(3), max: new Float64Array(3) }, origin: new Float64Array(3), originStamp: 0,
    // the sky's map: the horizon on the stage; whether the camera looks round
    sky: { yh: C.yh, round: !!C.camera.round },
    // the frame's yaw (radians, to the right): the turn of what faces the eye; where the eye is (the camera sets both
    // as it steps)
    yaw: 0, eye: Float64Array.of(0, EYE, 0),
    // a platformer's hero now ({ id, vx, vy, ground } — the camera's), or null
    hero: null,
    // what the screen shows, in stage heights ([left, top, right, bottom]: x 0…STAGE the stage, y 0…1 its height —
    // e.view, scene.view): safe — the frame the story is laid out for (4:3…21:9), seen — the whole canvas round it.
    // The camera writes them as the canvas is sized; nothing is repainted for them, nothing saved
    view: { safe: [0, 0, STAGE, 1], seen: [0, 0, STAGE, 1] },
    // while the elements whose points people read are animated, before the people (play/step.js)
    beforePeople: false,
    // the frame's own swaps (SH2): triples (quad, handle, form)
    over: new Int32Array(96), overN: 0,
    // what this tick did, for the stand: makes taken, makes in flight now
    took: 0, flying: 0, disposed: false,
    // how many paintings the elements have taken so far (the camera chooses a shot's way round again by it: SH4)
    paintings: 0,
    // building: its first paintings are being made (build); broken: the artist's thread failed — the error
    building: false, broken: null,
    // the tick (3.4: it moves on at the end of every step), and the step being made or made last
    get tick() { return T.tick; },
    get step() { return T.step; },
  };

  // ── the elements ──
  // the shadow receivers (WT2): bit 0 is THE GROUND — the word 'ground' of a caster's `onto`, never an element's id
  // (which planes are the ground: below, once what stands on what is known); the further bits, the elements some
  // caster's `onto` names
  const recvBit = new Map([['ground', RECV.GROUND]]);
  for (const E of C.elements) if (E.shadow) for (const id of E.shadow.onto) if (!recvBit.has(id)) {
    if (recvBit.size >= 32) throw new Error(`${E.who}: its shadow falls on "${id}" — a scene has at most 31 things besides the ground that shadows are named onto`);
    recvBit.set(id, 2 ** recvBit.size);
  }
  for (const E of C.elements) {
    const n = E.copies ? E.copies.length : 1;
    const el = {
      index: E.index, path: E.path, id: E.id, kind: E.kind, spec: E, o: E.o, who: E.who, flags: E.flags, box: E.box, copies: E.copies,
      node: -1, nodes: new Int32Array(n), faces: new Uint8Array(n), local: new Float64Array(12 * n),
      parent: null, kids: [], below: [], riders: [], leans: false,
      // a mirror's strength, rough, ripple and pace as they are now (its keys' values: mirrorNow) and the tick they changed
      mirror: E.reflect ? { strength: 0, rough: 0, ripple: 0, pace: 1, stamp: 0 } : null,
      visible: !E.flags.unseen && E.kind !== 'unseen', open: 0, insertRow: -1, ownFirst: -1, uniforms: null,
      // an insert's: the scene's time its key left 0 and its opening began (−1: not), its key's move then (RN4)
      leftAt: -1, openedAt: -1, move: null,
      // its sheets as they are shown: the block of its quads, a slot a sheet, the sheets' handles, where each
      // painting drew ink (its recording's extent, or null) and how much one draw of it covers at most (its dense —
      // both the camera's rays': world/space.js), its form's row
      first: 0, count: 0, slots: [], handles: [], extents: [], denses: [], form: -1, byLayer: new Map(), partSlots: [], layerSlots: [], version: 0, radius: 0,
      recv: (E.id != null && E.id !== 'ground' && recvBit.get(E.id)) || 0, cast: 0, seed: hash(E.id ?? `#${E.index}`) % 1000,
      // what its painting has, as the one shown: its points, its lights, its notes, the keys it read
      painted: new Map(), marked: new Map(), lights: [], notes: [], animNotes: [], reads: new Set(), isPainted: false,
      // (its glows by name, e.glow: an index each into glowK, how much of each its animate lets glow now)
      glowIndex: new Map(), glowK: new Float64Array(0), glowedAt: -1,
      mem: {}, emitter: null, ctx: null, redrawn: new Map(), offset: null, flip: false,
      // (this tick's marks; the make in flight (its job) and the painting waiting for its pages)
      dirty: false, toPaint: false, why: null, job: 0, pending: null, marks: 0, movedAt: -1, paintedAt: -1, jumpedAt: -1, repaints: 0, paintMs: 0,
      spot: { across: 0, distance: 0, elevation: 0, ground: 0 },
    };
    if (E.shadow) for (const id of E.shadow.onto) el.cast |= recvBit.get(id);
    for (let c = 0; c < n; c++) {
      const cp = E.copies ? E.copies[c] : null;
      el.faces[c] = (E.kind === 'card' || E.kind === 'unseen') && (cp ? cp.facing == null && cp.tilt == null && cp.roll == null && E.facing == null && E.tilt == null && E.roll == null : E.flags.faceEye) ? 1 : 0;
    }
    elements.push(el);
    if (E.id != null && !byId.has(E.id)) byId.set(E.id, el);
  }
  // what stands on what (people stand on it upright: their nodes are the world's, placed through the chain)
  for (const el of elements) el.parent = el.spec.on != null ? byId.get(el.spec.on) ?? null : null;
  for (const el of elements) {
    if (el.parent && el.kind !== 'person') el.parent.kids.push(el);
    // (and a card facing the eye on something that tilts: it leans with it, its face toward the start — but the one the
    // scene's camera rides: the start's eye stands on it, there is no way toward it; it stands as placed on what carries
    // it, facing the way that one faces, as on what does not tilt)
    let tilts = false;
    for (let p = el.parent; p; p = p.parent) {
      p.below.push(el); if (el.kind === 'person') p.riders.push(el);
      tilts ||= !!((p.spec.plane ? p.spec.plane.tilt : p.spec.tilt || p.spec.roll) || p.spec.place?.tilt || p.spec.place?.roll);
    }
    if (el.faces[0] && tilts && !el.copies && byId.get(C.camera.on) !== el) { el.leans = true; el.faces[0] = 0; el.flags = { ...el.flags, faceEye: false }; }
  }
  // THE GROUND — what a caster's default `onto` and people's shadows fall on: a plane draped on the land, a plane
  // people walk on or are carried by (someone stands `on` it), a plane lying level on the ground
  for (const el of elements) {
    if (el.kind !== 'plane') continue;
    const E = el.spec, level = !el.parent && !E.plane.tilt && !(E.copies && E.copies.some(c => c.tilt)) && !E.place?.tilt && !E.place?.elevation && Math.abs(E.at.elevation) < GROUND_LEVEL;
    if ((E.flags.drape && env.height) || E.flags.walk || el.riders.some(p => p.parent === el) || level) el.recv |= RECV.GROUND;
  }
  const depthOf = el => { let d = 0; for (let p = el.parent; p; p = p.parent) d++; return d; };
  const ordered = [...elements].sort((a, b) => (a.kind === 'person') - (b.kind === 'person') || depthOf(a) - depthOf(b));
  for (const el of ordered) {
    const up = el.parent && el.kind !== 'person' ? el.parent.node : -1;
    for (let c = 0; c < el.nodes.length; c++) el.nodes[c] = T.addNode(up);
    el.node = el.nodes[0];
  }
  // (the persons: those that have an id — PEOPLE names a person, and the keys of their state, by it: one without is
  // not shown, as the spec's warning says)
  const persons = world.persons = elements.filter(el => el.kind === 'person' && el.id != null);
  // the inserts (WT5), the own shaders (one entry a copy of an element that has one: its values are the element's;
  // stands — which of its sheets its text reads only where the quad stands: the compiled spec's, WT2)
  for (const el of elements) {
    if (el.kind === 'insert') { el.insertRow = world.inserts.length; world.inserts.push({ el: el.index, key: el.spec.insert.key, open: 0, iris: el.spec.insert.iris, making: false, stamp: T.tick }); }
    if (el.spec.shader) {
      el.ownFirst = world.own.length;
      el.uniforms = Float32Array.from(el.spec.shader.values);
      for (let c = 0; c < el.nodes.length; c++) world.own.push({ text: el.spec.shader.text, names: el.spec.shader.names, values: el.uniforms, quads: new Int32Array(OWN.SHEETS).fill(-1), stands: el.spec.shader.stands, stamp: T.tick });
    }
  }
  // a sky quad's node row is the sky's map, not a matrix (world.wgsl.js skyMap)
  const skyRow = Float64Array.of(C.yh, 0, 0, C.camera.round ? TAU : STAGE, 1, 0, C.camera.round ? 1 : 0, 0, 1, 0, 0, 0);

  // ── the land ──
  const height = env.height, land = height ? surfaceOf(height) : null, foot = new Float64Array(3);
  const walks = elements.filter(el => el.kind === 'plane' && el.flags.walk), waters = elements.filter(el => el.kind === 'plane' && el.flags.water);
  world.groundAt = (across, distance) => (height ? height(across, distance) : 0);
  // a point of the world (p: x, y, z) lifted by the land there — what is draped (WT7): the numbers stay in the array
  // (place.js: none is handed over or back but to the land's own function)
  world.lift = p => { if (height) height.lift(p); };
  // a point of the world (p: x, y, z) raised onto each plane of `planes` (those that say `walk`, unless named) lying
  // higher than it there → the plane it was raised onto last (the highest), else null
  function onPlanes(p, planes = walks) {
    const M = T.nodes.m, x = p[0], z = p[2];
    let on = null;
    for (let w = 0; w < planes.length; w++) {
      const el = planes[w], m = 12 * el.node, nx = M[m + 6], ny = M[m + 7], nz = M[m + 8];
      if (Math.abs(ny) < 0.2) continue;
      const ox = M[m + 9], oy = M[m + 10], oz = M[m + 11], y = oy - (nx * (x - ox) + nz * (z - oz)) / ny;
      const dx = x - ox, dy = y - oy, dz = z - oz;
      const u = dx * M[m] + dy * M[m + 1] + dz * M[m + 2], v = dx * M[m + 3] + dy * M[m + 4] + dz * M[m + 5];
      if (Math.abs(u) <= el.box[2] && Math.abs(v) <= el.box[3] && y > p[1]) { p[1] = y; on = el; }
    }
    return on;
  }
  // the height people stand on: the land at its finest (relief.js surfaceOf — their anchors and their feet on one
  // surface), or a plane that says `walk` lying higher over it there
  world.footing = (across, distance) => {
    foot[0] = across; foot[2] = -distance;
    if (land) land(foot); else foot[1] = 0;
    onPlanes(foot);
    return foot[1];
  };
  // what the viewer's eye stays over (the camera, play/camera.js — metres, the world's y): `surfaceAt` — the land (as
  // groundAt has it) or a plane that says `water` lying higher over it there; `standAt` — that, or a plane that says
  // `walk` lying higher still (a deck, a bridge). Asked a few times a frame: a pass over those planes, nothing made
  const eyeAt = new Float64Array(3);
  world.surfaceAt = (across, distance) => {
    eyeAt[0] = across; eyeAt[1] = world.groundAt(across, distance); eyeAt[2] = -distance;
    onPlanes(eyeAt, waters);
    return eyeAt[1];
  };
  world.standAt = (across, distance) => {
    world.surfaceAt(across, distance);
    onPlanes(eyeAt);
    return eyeAt[1];
  };
  // PP1 `anchor`: where SCENE's placing puts person `id` now — their place's keys, through what carries them — into
  // out (the world's x, y, z) → false: no such person. PEOPLE reads it every step; it is not in the nodes' table —
  // a person's row there holds their root (WT1). With `values`: where the placing would put them under those values
  // over the state (a cut to them — PP5 pointFor), nothing touched
  const anchorLocal = new Float64Array(12), anchorCarry = new Float64Array(12), anchorThen = new Float64Array(12);
  let anchorValues = null;
  const anchorGet = k => (k in anchorValues ? anchorValues[k] ?? undefined : state.value(k));
  function anchorOf(el, out) {
    const L = localOf(el, 0, state.value, anchorLocal, 0, el.spot);
    if (el.parent) return m34.point(carryOf(el.parent, anchorCarry), 0, L[9], L[10], L[11], out);
    out[0] = L[9]; out[1] = L[10]; out[2] = L[11];
    return out;
  }
  world.anchor = (id, out, values) => {
    const el = byId.get(id);
    if (!el || el.kind !== 'person') return false;
    if (!values) { anchorOf(el, out); return true; }
    anchorValues = values;
    world.matrixWith(el, anchorGet, anchorThen);
    anchorValues = null;
    out[0] = anchorThen[9]; out[1] = anchorThen[10]; out[2] = anchorThen[11];
    return true;
  };
  // what person `id` stands on under p (the world's x, _, z — people's feet, each step) → metres: what carries them
  // (a deck heeling: its face through their anchor), else the land as people stand on it, or a walk plane over it
  const carried = new Float64Array(12), gp = new Float64Array(3);
  world.groundFor = (id, p) => {
    const el = byId.get(id), x = p[0], z = p[2];
    if (el?.parent) {
      carryOf(el.parent, carried);
      const nx = carried[3], ny = carried[4], nz = carried[5];
      if (Math.abs(ny) > 0.2) { anchorOf(el, gp); return gp[1] - (nx * (x - gp[0]) + nz * (z - gp[2])) / ny; }
    }
    gp[0] = x; gp[2] = z;
    if (land) land(gp); else gp[1] = 0;
    onPlanes(gp);
    return gp[1];
  };
  // PP1 `inside`: whether a person standing at p (the world's x, _, z), carried by element `by` (an id; null: none),
  // is in a room — what carries them is `inside`, or the `walk` plane they stand on there is (a person marked `inside`
  // is PEOPLE's: always)
  const ip = new Float64Array(3);
  world.insideAt = (by, p) => {
    if (by != null && byId.get(by)?.flags.inside) return true;
    ip[0] = p[0]; ip[2] = p[2];
    if (land) land(ip); else ip[1] = 0;
    return !!onPlanes(ip)?.flags.inside;
  };

  // ── where each is ──
  // the world matrix of what el carries (its carry frame) → out (12)
  function carryOf(el, out) {
    m34.copy(T.nodes.m, 12 * el.node, out);
    return el.kind === 'plane' ? m34.multiply(out, 0, PLANE_CARRY, 0, out) : out;
  }
  // the local matrix of el's copy c where `get` (key → value) puts it, into out at oo (its parent's carry frame, or
  // the world's); where it stands into `sp`
  const A = new Float64Array(12), B = new Float64Array(12), P3 = new Float64Array(3);
  function localOf(el, c, get, out, oo, sp) {
    const E = el.spec, Pl = E.place, cp = el.copies ? el.copies[c] : null;
    let across = E.at.across, distance = E.at.distance, elevation = E.at.elevation, scale = 1;
    if (cp) { across = cp.across; distance = cp.distance; elevation = cp.elevation; scale = cp.scale; }
    else if (Pl) {
      elevation = val(get, Pl.elevation) ?? elevation;
      // (by a bearing — the place's, or its own: its distance is how far along it, the place's or its own)
      const b = val(get, Pl.bearing) ?? E.bearing;
      if (b != null) {
        const d = val(get, Pl.distance) ?? E.at.radial;
        across = d * Math.sin(b * DEG); distance = d * Math.cos(b * DEG);
      } else {
        distance = val(get, Pl.distance) ?? distance;
        if (val(get, Pl.across) != null) across = val(get, Pl.across);
        else if (val(get, Pl.x) != null) across = (val(get, Pl.x) - 0.5) * STAGE * distance;
      }
    }
    if (el.offset) { across += el.offset.x; elevation += el.offset.y; }
    sp.across = across; sp.distance = distance; sp.elevation = elevation; sp.ground = 0;
    if (!el.parent && E.kind !== 'sky' && E.kind !== 'insert') {
      // (on the land: what stands on it; people on the planes they walk on too)
      const g = E.kind === 'person' ? world.footing(across, distance) : E.flags.onLand && height ? height(across, distance) : 0;
      sp.ground = g;
      elevation += g;
    }
    if (E.kind === 'sky') { for (let i = 0; i < 12; i++) out[oo + i] = skyRow[i]; return out; }
    if (E.kind === 'insert') return m34.identity(out, oo);
    if (E.kind === 'plane') {
      // (a copy: its own rotation and tilt, else the plane's)
      const rot = (cp ? cp.rotation : val(get, Pl?.rotation)) ?? E.plane.rotation, tilt = (cp ? cp.tilt : val(get, Pl?.tilt)) ?? E.plane.tilt;
      return m34.compose(across, elevation, -distance, (tilt - 90) * DEG, rot * DEG, 0, scale, out, oo);
    }
    if (E.kind !== 'person' && !el.faces[c] && !el.leans) {
      // (roll: turned in its own face, its right edge rising — before its tilt and its facing)
      const facing = (cp ? cp.facing : val(get, Pl?.facing)) ?? E.facing ?? 180, tilt = (cp ? cp.tilt : val(get, Pl?.tilt)) ?? E.tilt ?? 0,
        roll = (cp ? cp.roll : val(get, Pl?.roll)) ?? E.roll ?? 0;
      return m34.compose(across, elevation, -distance, -tilt * DEG, (180 - facing) * DEG, roll * DEG, scale, out, oo);
    }
    return m34.compose(across, elevation, -distance, 0, 0, 0, scale, out, oo);
  }
  // el's world matrix (copy 0) as `get` would have things — through the chain, nothing touched → out (12)
  const passing = { across: 0, distance: 0, elevation: 0, ground: 0 }, C1 = new Float64Array(12), C2 = new Float64Array(12);
  function carryWith(el, get, out) {
    if (el.parent && el.kind !== 'person') { carryWith(el.parent, get, out); localOf(el, 0, get, C1, 0, passing); m34.multiply(out, 0, C1, 0, out); }
    else localOf(el, 0, get, out, 0, passing);
    return el.kind === 'plane' ? m34.multiply(out, 0, PLANE_CARRY, 0, out) : out;
  }
  world.matrixWith = (el, get, out) => {
    if (el.kind === 'person' && el.parent) { carryWith(el.parent, get, C2); localOf(el, 0, get, C1, 0, passing); m34.point(C2, 0, C1[9], C1[10], C1[11], P3); return m34.translation(P3[0], P3[1], P3[2], out); }
    if (!el.parent || el.kind === 'person') return localOf(el, 0, get, out, 0, passing);
    carryWith(el.parent, get, C2);
    localOf(el, 0, get, C1, 0, passing);
    return m34.multiply(C2, 0, C1, 0, out);
  };
  // what moves el when it moves: itself and what carries it
  world.chain = el => { const out = []; for (let p = el; p; p = p.parent) out.push(p); return out; };
  // a card facing the eye on something tilted: up as that one's face, its face toward the start (the scene's camera
  // riding something: where it starts on that) — its local matrix turned so
  // (L at lo: its local matrix, as localOf made it; get: the state it is placed by — where the start is on what the
  // camera rides)
  const startAt = new Float64Array(12), UP = new Float64Array(3), AT = new Float64Array(3), FACE = new Float64Array(3), RIGHT = new Float64Array(3);
  function lean(L, lo, parentCarry, get) {
    let sx = 0, sy = 0, sz = 0;
    if (C.camera.on != null && world.frameOf(C.camera.on, startAt, get)) { sx = startAt[9]; sy = startAt[10]; sz = startAt[11]; }
    const ul = Math.sqrt(parentCarry[3] * parentCarry[3] + parentCarry[4] * parentCarry[4] + parentCarry[5] * parentCarry[5]) || 1;
    UP[0] = parentCarry[3] / ul; UP[1] = parentCarry[4] / ul; UP[2] = parentCarry[5] / ul;                 // up: what carries it, its up
    m34.point(parentCarry, 0, L[lo + 9], L[lo + 10], L[lo + 11], AT);                                     // where it is
    FACE[0] = sx - AT[0]; FACE[1] = sy + EYE - AT[1]; FACE[2] = sz - AT[2];                               // toward the start's eye
    const d = FACE[0] * UP[0] + FACE[1] * UP[1] + FACE[2] * UP[2];
    FACE[0] -= d * UP[0]; FACE[1] -= d * UP[1]; FACE[2] -= d * UP[2];                                     // … levelled in its plane: its face
    const fl = Math.sqrt(FACE[0] * FACE[0] + FACE[1] * FACE[1] + FACE[2] * FACE[2]);
    if (fl < 1e-6) { FACE[0] = 0; FACE[1] = 0; FACE[2] = 1; } else { FACE[0] /= fl; FACE[1] /= fl; FACE[2] /= fl; }
    RIGHT[0] = UP[1] * FACE[2] - UP[2] * FACE[1]; RIGHT[1] = UP[2] * FACE[0] - UP[0] * FACE[2]; RIGHT[2] = UP[0] * FACE[1] - UP[1] * FACE[0];   // its right
    m34.basis(RIGHT, UP, FACE, AT, A);
    m34.invert(parentCarry, 0, B);
    m34.multiply(B, 0, A, 0, L, lo);
  }
  // el's copy c placed as `get` (key → value) has things, under what carries it (up: that one's carry frame, or the
  // identity): its local matrix into L at lo — where it stands into sp —, its world matrix → out. The ONE placing:
  // the world's own (placeTree) and a shot's overrides (shotStep) both go through it — a card that leans leans in both
  function placeOf(el, c, get, up, L, lo, sp, out) {
    localOf(el, c, get, L, lo, sp);
    if (el.kind === 'person' && el.parent) { m34.point(up, 0, L[lo + 9], L[lo + 10], L[lo + 11], P3); return m34.translation(P3[0], P3[1], P3[2], out); }
    if (el.leans) lean(L, lo, up, get);
    return el.kind === 'sky' ? m34.copy(L, lo, out) : m34.multiply(up, 0, L, lo, out);
  }
  // el placed: each copy's node, its parts' nodes, then all it carries. A person, once the people are there, is not
  // placed here: PEOPLE takes their anchor (world.anchor) and gives their root, which goes into their row (rooted)
  const WM = new Float64Array(12), PC = new Float64Array(12), PL = new Float64Array(12), ID = m34.identity(new Float64Array(12));
  // anyMoved: a node moved, was shown or hidden, or a block was taken in the step being made (a shot's overrides are
  // looked at again: shotStep); boundsDue: … since world.bounds was last worked out — in unseen steps too (flush)
  let anyMoved = true, boundsDue = true;
  const changed = () => { anyMoved = true; boundsDue = true; };
  function placed(el, moved) { if (moved && el.movedAt !== T.tick) { el.movedAt = T.tick; changed(); } }
  function placeTree(el) {
    if (el.kind === 'person' && world.people) return;
    const up = el.parent ? carryOf(el.parent, PC) : ID;
    let moved = false;
    for (let c = 0; c < el.nodes.length; c++) {
      placeOf(el, c, state.value, up, el.local, 12 * c, c === 0 ? el.spot : passing, WM);
      if (T.setNode(el.nodes[c], WM)) moved = true;
    }
    if (el.partSlots.length && placeParts(el, el.partSlots, up)) moved = true;
    if (el.pending?.block) placeParts(el, el.pending.block.partSlots, up);
    for (let s = 0; s < shots.length; s++) { const t = shots[s].takes.get(el); if (t?.block) placeParts(el, t.block.partSlots, up); }
    placed(el, moved);
    for (let i = 0; i < el.kids.length; i++) placeTree(el.kids[i]);
    for (let i = 0; i < el.riders.length; i++) if (el.riders[i].parent === el) placeTree(el.riders[i]);
  }
  // a part of el (e.part): standing dx to the right and dz farther than its anchor — along its own turn (a plane's:
  // in its face, toward its far edge), or (it faces the eye) along what carries it, on the land there. Its local
  // matrix beside its element's copy c (the element's local matrix: L at o) → out
  function partLocal(el, p, c, L, o, out) {
    if (el.kind === 'plane') { m34.translation(p.dx, p.dz, 0, A); return m34.multiply(L, o, A, 0, out); }
    if (!el.faces[c]) { m34.translation(p.dx, 0, -p.dz, A); return m34.multiply(L, o, A, 0, out); }
    // (on the land there, as high over it as the element is over the land under it)
    const s = m34.scaleOf(L, o), across = L[o + 9] + p.dx * s, z = L[o + 11] - p.dz * s;
    const y = el.parent || !(el.flags.onLand && height) ? L[o + 10] : L[o + 10] - height(L[o + 9], -L[o + 11]) + height(across, -z);
    return m34.compose(across, y, z, 0, 0, 0, s, out);
  }
  function placeParts(el, parts, up) {
    let moved = false;
    for (let k = 0; k < parts.length; k++) {
      const p = parts[k];
      for (let c = 0; c < el.nodes.length; c++) {
        partLocal(el, p, c, el.local, 12 * c, PL);
        m34.multiply(up, 0, PL, 0, WM);
        if (T.setNode(p.nodes[c], WM)) moved = true;
      }
    }
    return moved;
  }

  // ── an element's sheets: its slots, its block of quads ──
  // the slots a painting has: the base (a form: another kind of quad), its parts, its layers — each named by what
  // makes its rows what they are (a part's place and box, a layer's name and options)
  function slotsOf(el, made) {
    const slots = [{ key: made?.form ? 'form' : 'base', kind: 'base', i: -1, box: el.box, opts: null, name: null, dx: 0, dz: 0 }];
    if (!made) return slots;
    made.parts.forEach((p, i) => slots.push({ key: `p${i}|${p.dx}|${p.dz}|${p.box.join()}`, kind: 'part', i, box: p.box, opts: null, name: null, dx: p.dx, dz: p.dz }));
    made.layers.forEach((l, i) => slots.push({ key: `l${l.name}|${JSON.stringify(l.opts)}`, kind: 'layer', i, box: l.opts.box || el.box, opts: l.opts, name: l.name, dx: 0, dz: 0 }));
    return slots;
  }
  const sameSlots = (a, b) => a.length === b.length && a.every((s, i) => s.key === b[i].key);
  function kindOf(el, slot, c) {
    if (el.kind === 'sky') return QUAD.SKY;
    if (el.kind === 'insert') return QUAD.INSERT;
    if (slot.key === 'form') return QUAD.FORM;
    // (draped on the land: only in a world that has a land function — else it is a plane as it lies)
    if (el.kind === 'plane') return el.flags.drape && height ? QUAD.DRAPE : QUAD.PLANE;
    return el.faces[c] ? QUAD.FACING : QUAD.CARD;
  }
  function flagsOf(el, slot, c) {
    const f = el.flags, o = slot.opts;
    // (an unseen element is never drawn — but one that cuts a clip is listed for the masks alone: CUT_ONLY; WT2)
    let bits = !f.unseen ? FLAG.SHOWN : el.spec.cuts !== 0 ? FLAG.SHOWN | FLAG.CUT_ONLY : 0;
    if (f.glows) bits |= FLAG.GLOWS;
    if (f.inside) bits |= FLAG.INSIDE;
    if (f.seen && !f.seen.main) bits |= FLAG.REFLECTED_ONLY;
    if (f.reflect) bits |= FLAG.REFLECTS;
    if (f.glass) bits |= FLAG.GLASS;
    if (el.spec.clip) bits |= FLAG.CLIPPED;
    if (slot.kind === 'part') bits |= FLAG.PART;
    if (o) {
      if (o.wind) bits |= FLAG.WIND;
      if (o.drift) bits |= FLAG.DRIFT | FLAG.WHOLE | (o.drift[0] ? FLAG.WRAP_X : 0) | (o.drift[1] ? FLAG.WRAP_Y : 0);
      if (o.shimmer) bits |= FLAG.SHIMMER;
      if (o.flicker) bits |= FLAG.FLICKER;
      if (o.blend === 'add') bits |= FLAG.ADD;
      if (o.blend === 'multiply') bits |= FLAG.MULTIPLY;
    }
    // (an own shader's sheets — slot.own: 0 its painting, 1… its layers as layer(k) names them: one its text reads
    // only where the quad stands is asked as any card's; one it reads at another point, whole — WT2; its layers are
    // read by it, not drawn by themselves)
    if (el.spec.shader && slot.kind !== 'part') bits |= (el.spec.shader.stands[slot.own] ? 0 : FLAG.WHOLE) | (slot.kind === 'layer' ? FLAG.READ : 0);
    if ((el.copies ? el.copies[c].flip : false) !== el.flip) bits |= FLAG.FLIP;
    return bits;
  }
  // a block of quads for el's slots: every row written but its sheet (−1) → { first, count, slots, partSlots,
  // layerSlots, byLayer }; a part's nodes — shown as its element's node is — and a layer's row made — a layer of the
  // same name and options as one el has keeps that one's row (its pose goes on): the row is then the element's
  // block's (slot.ownLayer false here) until this block is the element's (freeBlock)
  function buildBlock(el, slots) {
    const Q = T.quads, S = slots.length, n = el.nodes.length, first = T.addQuads(n * S);
    // (WT2 `clip`: the cutter set it is clipped by, bit 2 — seen outside its cutters; bits 4–7 the sets it cuts)
    const clip = ((el.spec.clip ? el.spec.clip.set | (el.spec.clip.inside ? 0 : 4) : 0) | (el.spec.cuts << 4)) >>> 0;
    const block = { first, count: n * S, slots, partSlots: [], layerSlots: [], byLayer: new Map() };
    slots.forEach((slot, s) => {
      slot.s = s; slot.layer = -1; slot.nodes = null; slot.ownLayer = false; slot.shown = true;
      slot.own = slot.kind === 'layer' ? block.layerSlots.length + 1 : slot.kind === 'part' ? -1 : 0;
      // (WT2 `cast`: a layer that adds or multiplies — light, a stain — is not matter: it casts nothing)
      const cast = slot.opts && (slot.opts.blend === 'add' || slot.opts.blend === 'multiply') ? 0 : el.cast;
      if (slot.kind === 'part') {
        slot.nodes = new Int32Array(n);
        for (let c = 0; c < n; c++) { slot.nodes[c] = T.addNode(T.nodes.parent[el.nodes[c]]); T.showNode(slot.nodes[c], T.nodes.shown[el.nodes[c]]); }
        block.partSlots.push(slot);
      } else if (slot.kind === 'layer') {
        const was = el.byLayer.get(slot.name);
        if (was && was.key === slot.key) slot.layer = was.layer;
        else {
          slot.layer = T.addLayer(); slot.ownLayer = true;
          const o = slot.opts, L = slot.layer;
          T.setOpt(L, 0, o.pivot ? o.pivot[0] : 0); T.setOpt(L, 1, o.pivot ? o.pivot[1] : 0);
          T.setOpt(L, 2, o.wind ? o.wind.strength : 0); T.setOpt(L, 3, o.wind ? o.wind.gust : 0); T.setOpt(L, 4, o.wind ? o.wind.scale : 1);
          T.setOpt(L, 5, o.flicker || 0); T.setOpt(L, 6, o.shimmer || 0); T.setOpt(L, 7, o.depth || 0);
          T.setOpt(L, 8, o.drift ? o.drift[0] : 0); T.setOpt(L, 9, o.drift ? o.drift[1] : 0);
          // (its `length` — the reach of its bend in the wind: from its pivot to the farthest corner of its box, WT3)
          const px = o.pivot ? o.pivot[0] : 0, py = o.pivot ? o.pivot[1] : 0, b = slot.box;
          T.setPose(L, 7, Math.hypot(Math.max(Math.abs(b[0] - px), Math.abs(b[2] - px)), Math.max(Math.abs(b[1] - py), Math.abs(b[3] - py))));
        }
        slot.shown = T.layers.pose[8 * slot.layer + 5] !== 0;
        block.layerSlots.push(slot); block.byLayer.set(slot.name, slot);
      }
      for (let c = 0; c < n; c++) {
        const i = first + c * S + s, cp = el.copies ? el.copies[c] : null;
        Q.node[i] = slot.nodes ? slot.nodes[c] : el.nodes[c];
        Q.el[i] = el.index; Q.kind[i] = kindOf(el, slot, c); Q.flags[i] = slot.shown ? flagsOf(el, slot, c) : flagsOf(el, slot, c) & ~FLAG.SHOWN;
        Q.layer[i] = slot.layer; Q.recv[i] = el.recv; Q.cast[i] = cast; Q.clip[i] = clip; Q.aux[i] = el.insertRow;
        Q.own[i] = el.ownFirst >= 0 && slot.kind !== 'part' ? el.ownFirst + c + 1 : 0;
        Q.sheer[i] = el.flags.translucent;
        Q.rect.set(slot.box, 4 * i);
        if (cp) { Q.tint[4 * i] = cp.tint[0]; Q.tint[4 * i + 1] = cp.tint[1]; Q.tint[4 * i + 2] = cp.tint[2]; Q.tint[4 * i + 3] = cp.glow; Q.seed[i] = cp.seed; } else Q.seed[i] = el.seed;
      }
    });
    return block;
  }
  // a block let go: its rows, its parts' nodes — and a layer's row by ownership, once: the block that has the row as
  // its own frees it, unless the block kept (the element's from now on) shows the same row — then it is that one's
  function freeBlock(block, keep) {
    T.freeQuads(block.first, block.count);
    for (const slot of block.slots) {
      if (slot.nodes) for (const node of slot.nodes) T.freeNode(node);
      if (!slot.ownLayer) continue;
      slot.ownLayer = false;
      const kept = keep ? keep.byLayer.get(slot.name) : null;
      if (kept && kept.layer === slot.layer) kept.ownLayer = true; else T.freeLayer(slot.layer);
    }
  }
  function adopt(el, block) {
    el.first = block.first; el.count = block.count; el.slots = block.slots; el.partSlots = block.partSlots; el.layerSlots = block.layerSlots; el.byLayer = block.byLayer;
    el.version++;
    // (offered, selected: the bits as they are now — a block made before they changed has them so)
    for (let i = block.first; i < block.first + block.count; i++) T.setQuad(T.quads.flags, i, ((T.quads.flags[i] & ~(FLAG.OFFERED | FLAG.SELECTED)) | el.marks) >>> 0);
    // how far from its node its quads may reach (rays, the bounds; a form's: its grid's — applyTake)
    let r = 0;
    for (const slot of block.slots) { const b = slot.box, reach = Math.hypot(Math.max(Math.abs(b[0]), Math.abs(b[2])), Math.max(Math.abs(b[1]), Math.abs(b[3]))) + Math.hypot(slot.dx, slot.dz); if (reach > r) r = reach; }
    el.radius = r;
    if (el.ownFirst >= 0) {
      const S = block.slots.length, sheetsOf = [block.slots[0], ...block.layerSlots];
      if (sheetsOf.length > OWN.SHEETS) env.report(el.who, new Error(`its shader can read its painting and ${OWN.SHEETS - 1} layers (layer(1…${OWN.SHEETS - 1})) — it paints ${block.layerSlots.length}: the rest are not seen`));
      for (let c = 0; c < el.nodes.length; c++) {
        const own = world.own[el.ownFirst + c];
        own.quads.fill(-1);
        for (let k = 0; k < Math.min(OWN.SHEETS, sheetsOf.length); k++) own.quads[k] = block.first + c * S + sheetsOf[k].s;
        own.stamp = T.tick;
      }
    }
  }
  world.quadsOf = el => [el.first, el.count];
  // WT4: whether a caster casts in the light of that row — it names no light, or names that one (light.js
  // namesLight: the very rule `lights.named` is marked by). The caster: a quad's element (castsIn), or a person, who
  // has no quad row, by their element's index (personCastsIn)
  // A light a caster carries (its own e.light, one taken over with "of", a person's lantern, a window's daylight: the
  // light's node is the caster's) is not shaded by it: a lamp in a lantern's glass, a beam from inside its tower. A
  // copy carries its own lights only — the next lamp post of a row shades this one's lamp: a quad's copy is its place
  // in its element's block (its parts' quads too, whose nodes are their own); a quad of a block not yet the element's,
  // by its node
  const names = (el, row) => {
    const shadow = el.spec.shadow, name = shadow ? shadow.light : null;
    return name == null || namesLight(name, T.lights.ids[row]);
  };
  world.castsIn = (quad, row) => {
    const el = elements[T.quads.el[quad]], node = T.lights.node[row];
    if (node >= 0) {
      const k = quad - el.first;
      if (!el.copies ? node === el.node : k >= 0 && k < el.count ? node === el.nodes[(k / el.slots.length) | 0] : node === T.quads.node[quad]) return false;
    }
    return names(el, row);
  };
  world.personCastsIn = (index, row) => elements[index].node !== T.lights.node[row] && names(elements[index], row);
  // IN3: the thing offered or selected — OFFERED / SELECTED on every quad of it (a person: people.mark); setting them
  // stamps the rows
  world.mark = (el, bits, on) => {
    const marks = on ? el.marks | bits : el.marks & ~bits;
    if (marks === el.marks) return;
    el.marks = marks;
    if (el.kind === 'person') { world.people?.mark(el.id, marks); return; }
    for (let i = el.first; i < el.first + el.count; i++) T.setQuad(T.quads.flags, i, ((T.quads.flags[i] & ~(FLAG.OFFERED | FLAG.SELECTED)) | marks) >>> 0);
  };
  // a layer's alpha is 0, or no longer: its quads not shown, or shown again (neither drawn nor asked meanwhile)
  world.layerShown = (el, slot) => {
    // (an unseen element that cuts a clip stays listed for the masks — as flagsOf has it; WT2)
    const on = T.layers.pose[8 * slot.layer + 5] !== 0 && (!el.flags.unseen || el.spec.cuts !== 0);
    if (slot.shown === on) return;
    slot.shown = on;
    for (let c = 0; c < el.nodes.length; c++) T.flagQuad(el.first + c * el.slots.length + slot.s, FLAG.SHOWN, on);
  };
  // its shader's uniform i set (the same values for every copy)
  world.uniform = (el, i, v) => {
    if (el.uniforms[i] === Math.fround(v)) return;
    el.uniforms[i] = v;
    for (let c = 0; c < el.nodes.length; c++) world.own[el.ownFirst + c].stamp = T.tick;
  };

  // ── forms (WT10) ──
  // the grid the artist sampled → a row's form: its points, its normals from neighbours (across the join where it is
  // closed), the sphere round it. The author's function answers in the element's own metres — x across, y up, z
  // toward its front — on a card and on a plane alike (5.23); the row holds the node's. A card's node is that frame; a
  // plane's lies in its face (x across, y away, z up): its points are carried through its carry frame — (x, y, z) →
  // (x, −z, y) —, and its normals, worked out of the points, with them
  function formOf(el, f) {
    const N = FORM.SIDE, pts = f.points, normals = new Float32Array(FORM_POINTS * 3), cu = f.closed & 1, cv = f.closed & 2;
    if (el.kind === 'plane') for (let k = 0; k < 3 * FORM_POINTS; k += 3) m34.point(PLANE_CARRY, 0, pts[k], pts[k + 1], pts[k + 2], pts, k);
    const at = (i, j) => 3 * (j * N + i);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      // (its neighbours either way; at an edge that is a join, the one across it — the last column is the first again)
      const i0 = i > 0 ? i - 1 : cu ? N - 2 : 0, i1 = i < N - 1 ? i + 1 : cu ? 1 : N - 1, j0 = j > 0 ? j - 1 : cv ? N - 2 : 0, j1 = j < N - 1 ? j + 1 : cv ? 1 : N - 1;
      const a = at(i0, j), b = at(i1, j), c = at(i, j0), d = at(i, j1);
      const ux = pts[b] - pts[a], uy = pts[b + 1] - pts[a + 1], uz = pts[b + 2] - pts[a + 2], vx = pts[d] - pts[c], vy = pts[d + 1] - pts[c + 1], vz = pts[d + 2] - pts[c + 2];
      // (u across the painting, v down it: v × u looks out of its painted side)
      let nx = vy * uz - vz * uy, ny = vz * ux - vx * uz, nz = vx * uy - vy * ux;
      const l = Math.hypot(nx, ny, nz);
      if (l < 1e-12) { nx = 0; ny = 0; nz = 1; } else { nx /= l; ny /= l; nz /= l; }
      const o = at(i, j);
      normals[o] = nx; normals[o + 1] = ny; normals[o + 2] = nz;
    }
    let cx = 0, cy = 0, cz = 0, r = 0;
    for (let k = 0; k < FORM_POINTS; k++) { cx += pts[3 * k] / FORM_POINTS; cy += pts[3 * k + 1] / FORM_POINTS; cz += pts[3 * k + 2] / FORM_POINTS; }
    for (let k = 0; k < FORM_POINTS; k++) r = Math.max(r, Math.hypot(pts[3 * k] - cx, pts[3 * k + 1] - cy, pts[3 * k + 2] - cz));
    return { el: el.index, points: pts, normals, closed: f.closed, sphere: Float32Array.of(cx, cy, cz, r), stamp: T.tick };
  }
  const closedOf = v => (typeof v === 'number' ? v & 3 : v === 'u' ? 1 : v === 'v' ? 2 : v === 'both' ? 3 : 0);
  // what an element with a form may not have (5.23, LG15): an error of the scene's build, said with the element
  function formRules(el, made) {
    const E = el.spec, no = [];
    if (made.layers.length) no.push('layers');
    if (made.parts.length) no.push('parts');
    if (E.shader) no.push('a shader');
    if (E.flags.translucent) no.push('"translucent"');
    if (E.flags.reflect) no.push('"reflect"');
    if (E.flags.glass) no.push('"glass"');
    if (E.clip) no.push('"clip"');
    if (el.kind !== 'card' && el.kind !== 'plane') no.push(`being ${el.kind === 'sky' ? 'the sky' : `an ${el.kind}`}`);
    if (E.flags.drape) no.push('"drape"');
    if (no.length) throw new Error(`${el.who}: an element with a form (e.form) has no ${no.join(', ')}`);
  }

  // ── points ──
  // el's point by name (null: the one it marks as itself — a head) as marked now: by its animate this step, else as painted
  world.markOf = (el, name) => {
    const m = el.marked.get(name);
    return m && m.tick === T.step ? m : el.painted.get(name) ?? null;
  };
  // a point p ({ x, y, part, layer }: the painting's units) of el's copy c in the world, for a view of that yaw → out;
  // through place() — the quad of the sheet it was painted in — so it follows a layer's pose, a form, the land under
  // a drape. An element with no quads (unseen: its animate marks it): through its node.
  world.sheetPoint = (el, c, p, yaw, out) => {
    const slot = p.layer >= 0 ? el.layerSlots[p.layer] : p.part >= 0 ? el.partSlots[p.part] : el.slots[0];
    if (el.count && slot) { out[0] = p.x; out[1] = p.y; out[2] = yaw; return place(world, el.first + c * el.slots.length + slot.s, out); }
    const M = T.nodes.m, o = 12 * el.nodes[c];
    // (a person's box, too, stands turned to the eye about their root)
    if (el.faces[c] || el.kind === 'person') { const s = el.kind === 'person' ? 1 : m34.scaleOf(M, o), cy = Math.cos(yaw), sy = Math.sin(yaw); out[0] = M[o + 9] + s * p.x * cy; out[1] = M[o + 10] - s * p.y; out[2] = M[o + 11] + s * p.x * sy; }
    else m34.point(M, o, p.x, -p.y, 0, out);
    return true;
  };
  // where a sky element (an insert) marks a point now — stage heights, into out (x, y): as its animate marks it this
  // step, else as painted (in a layer: where the layer's pose has it now) → false: it marks none
  world.stagePoint = (el, name, out) => {
    const p = world.markOf(el, name);
    if (!p) return false;
    const slot = p.layer >= 0 ? el.layerSlots[p.layer] : null;
    out[0] = p.x; out[1] = p.y;
    if (slot) posed(T.layers, slot.layer, out);
    return true;
  };
  // a reference read once: 'id', 'id@' (where it is pressed), 'id#name', a copy's 'id:k', 'id:k@', 'id:k#name' →
  // { id, copy, name, pressed, head }
  const refs = new Map();
  world.refOf = ref => {
    let r = refs.get(ref);
    if (!r) {
      const h = ref.indexOf('#'), pressed = h < 0 && ref.endsWith('@');
      let id = h >= 0 ? ref.slice(0, h) : pressed ? ref.slice(0, -1) : ref, copy = 0;
      const name = h < 0 ? null : ref.slice(h + 1), k = id.lastIndexOf(':');
      if (k > 0 && /^\d+$/.test(id.slice(k + 1)) && !byId.has(id)) { copy = Number(id.slice(k + 1)); id = id.slice(0, k); }
      r = { id, copy, name, pressed, head: name ? ref : `${id}#head` };
      refs.set(ref, r);
    }
    return r;
  };
  // A point by what names it (IN1) → where it is: 0 — there is none now; −1 — none YET: a point by its name of an
  // element that paints and has no painting (the names are its painting's: whether it marks this one is not known —
  // an emitter standing on it writes nothing till then, WT5); 1 — in the world (out: the point); 2 — on
  // the sky (out: the unit direction toward it); 3 — on the frame (an insert's: out = frame heights to the right of
  // the frame's middle, down from its top, 0), there only inside its iris as far as it is open. over: its top when it
  // marks no point of its own (its anchor its height up). The refs: PG9's, [across, distance, elevation] (the elevation
  // over the land there), {on: id, at: [across, distance, elevation]} (in that element's own frame, as "on" places; a
  // person's own frame: where they stand, turned as they face — their root, as an element's at that place and facing —,
  // none while they are not here).
  const mid = { x: 0, y: 0, part: -1, layer: -1 }, st = [0, 0];
  world.pointFor = (ref, out, yaw = world.yaw, over = false) => {
    if (framedPoint(ref)) {
      const el = byId.get(ref.on);
      if (!el) return 0;
      if (el.kind === 'person') { if (!world.people || !el.visible || !world.people.root(ref.on, carried)) return 0; }
      else if (NOT_CARRYING.has(el.kind)) return 0;
      else carryOf(el, carried);
      m34.point(carried, 0, ref.at[0], ref.at[2] ?? 0, -ref.at[1], out);
      return 1;
    }
    if (Array.isArray(ref)) {
      if (!(ref.length >= 2 && ref.every(Number.isFinite))) return 0;
      out[0] = ref[0]; out[1] = (ref[2] ?? 0) + world.groundAt(ref[0], ref[1]); out[2] = -ref[1];
      return 1;
    }
    if (typeof ref !== 'string' || !ref) return 0;
    const R = world.refOf(ref), el = byId.get(R.id);
    if (!el || R.copy >= el.nodes.length) return 0;
    if (el.kind === 'person') {
      if (!world.people || !el.visible) return 0;
      return world.people.point(R.id, R.name ?? 'head', out) ? 1 : 0;
    }
    if (el.kind === 'sky') {
      if (!el.visible || !world.stagePoint(el, R.name, st)) return 0;
      // (as it is drawn: the copy of the point round the circle that the view shows)
      out[0] = st[0]; out[1] = st[1]; out[2] = yaw;
      skyWay(out, world.sky);
      return 2;
    }
    if (el.kind === 'insert') {
      if (!el.visible) return 0;
      const I = world.inserts[el.insertRow], iris = I.iris || IRIS_ALL;
      if (!world.stagePoint(el, R.name, st)) { if (R.name != null) return 0; st[0] = iris[0]; st[1] = iris[1]; }
      const ix = (st[0] - iris[0]) / (iris[2] * I.open), iy = (st[1] - iris[1]) / (iris[3] * I.open);
      if (!(I.open > 0) || ix * ix + iy * iy >= 1) return 0;
      out[0] = st[0] - STAGE / 2; out[1] = st[1]; out[2] = 0;
      return 3;
    }
    const p = world.markOf(el, R.name);
    if (p) return world.sheetPoint(el, R.copy, p, yaw, out) ? 1 : 0;
    if (R.name != null) return el.spec.paints && !el.isPainted ? -1 : 0;
    if (R.pressed) { mid.x = (el.box[0] + el.box[2]) / 2; mid.y = (el.box[1] + el.box[3]) / 2; return world.sheetPoint(el, R.copy, mid, yaw, out) ? 1 : 0; }
    const M = T.nodes.m, o = 12 * el.nodes[R.copy];
    out[0] = M[o + 9]; out[1] = M[o + 10] + (over ? el.spec.height * m34.scaleOf(M, o) : 0); out[2] = M[o + 11];
    return 1;
  };
  // WT8: a point of the world by what names it → out; false: there is none in the world. get (key → value): as those
  // values would have things — a cut to a person posed ahead (PP1 `point`, PP5): a point in an element's frame by that
  // frame then, an element's point — its point of now — carried with its node there (world.carriedWith; a copy's, and
  // a person's — PEOPLE poses them —, as now; so a point in a person's frame)
  const carriedThen = new Float64Array(12);
  world.pointOf = (ref, out, get) => {
    if (get === undefined || get === state.value) return world.pointFor(ref, out) === 1;
    if (framedPoint(ref)) {
      const el = byId.get(ref.on);
      if (el && el.kind === 'person') return world.pointFor(ref, out) === 1;
      if (!el || NOT_CARRYING.has(el.kind)) return false;
      carryWith(el, get, carriedThen);
      m34.point(carriedThen, 0, ref.at[0], ref.at[2] ?? 0, -ref.at[1], out);
      return true;
    }
    if (world.pointFor(ref, out) !== 1) return false;
    if (typeof ref === 'string') { const el = byId.get(world.refOf(ref).id); if (el.kind !== 'person' && !el.copies) world.carriedWith(el, out, get, carriedThen); }
    return true;
  };
  // a point p of the world, where el's node has it now, moved as `get` would place el — its node's turn and place —
  // into p; → el's world matrix then (into M, 12)
  const nodeLocal = new Float64Array(3);
  world.carriedWith = (el, p, get, M) => {
    m34.inversePoint(T.nodes.m, 12 * el.node, p[0], p[1], p[2], nodeLocal);
    world.matrixWith(el, get, M);
    m34.point(M, 0, nodeLocal[0], nodeLocal[1], nodeLocal[2], p);
    return M;
  };
  // the state keys that move element `id` (PP1 `moves`): its place's and those of every element that carries it — the
  // same array for an element always (none: an empty one)
  const NONE = Object.freeze([]), moversOf = new Map();
  world.movedBy = id => {
    let keys = moversOf.get(id);
    if (keys) return keys;
    const el = byId.get(id);
    if (!el) return NONE;
    keys = [];
    for (let e = el; e; e = e.parent) if (e.spec.place && !e.copies) for (const f in e.spec.place) if (!keys.includes(e.spec.place[f])) keys.push(e.spec.place[f]);
    moversOf.set(id, keys);
    return keys;
  };
  // whether element `id` was put where it is at once this step — a key of its place, or of what carries it, set, not
  // moved (PP1 `placed`: a person put somewhere has walked no way)
  world.placedNow = id => byId.get(id)?.jumpedAt === T.tick;
  // a world point v in el's painting (its units, x right, y down) → out (x, y); false: none (edge on; an insert's —
  // it is over the frame, not in the world). The sky's: the stage point its painting shows the point at, seen from
  // the eye — x from its painting's left, 2π round
  world.toPainting = (el, v, out) => {
    if (el.kind === 'insert') return false;
    if (el.kind === 'sky') {
      skyAt(v[0] - world.eye[0], v[1] - world.eye[1], v[2] - world.eye[2], world.sky.yh, world.sky.round, world.yaw, out);
      const l = el.box[0];
      out[0] = l + (((out[0] - l) % TAU) + TAU) % TAU;
      return true;
    }
    const M = T.nodes.m, o = 12 * el.node;
    if (el.faces[0]) {
      const s = m34.scaleOf(M, o), dx = v[0] - M[o + 9], dz = v[2] - M[o + 11], cy = Math.cos(world.yaw), sy = Math.sin(world.yaw);
      out[0] = (dx * cy + dz * sy) / s; out[1] = -(v[1] - M[o + 10]) / s;
      return true;
    }
    m34.inversePoint(M, o, v[0], v[1], v[2], P3);
    out[0] = P3[0]; out[1] = -P3[1];
    return true;
  };
  // … as `get` would have things: a painting made ahead for a shot — one object, read at once
  const spotThen = { across: 0, distance: 0, elevation: 0, ground: 0 };
  world.spotAs = (el, get) => { localOf(el, 0, get, C1, 0, spotThen); return spotThen; };
  // what element `id` carries is placed in — people carried by it, the camera riding it: its carry frame's world
  // matrix (12 numbers: its axes and its anchor) into out — now, or as `get` (key → value) would have things (a camera
  // made ready for a cut) → true; false: nothing carries so
  world.frameOf = (id, out, get = state.value) => {
    const el = byId.get(id);
    if (!el || NOT_CARRYING.has(el.kind) || el.copies) return false;
    if (get === state.value) carryOf(el, out); else carryWith(el, get, out);
    return true;
  };

  // ── rays, the bounds ──
  // (raycast: the camera's questions — by the paintings' extents; pickRay: the author's selection — by the sheets'
  // masks: world/space.js, SH4)
  const space = createSpace(world, sheets);
  world.raycast = space.ray;
  world.pickRay = space.pick;
  world.skyHit = space.skyHit;
  world.insertHit = space.insertHit;

  // ── what reads which key ──
  const placeKeys = new Map(), paintKeys = new Map(), insertKeys = new Map(), hereKeys = new Map(), mirrorKeys = new Map();
  // (the keys that place something in metres — an element's or a person's across, distance, elevation; the camera's
  // x, h, z: what a path's speed is measured along — play/director.js)
  const METRE_FIELDS = ['across', 'distance', 'elevation'], metreKeys = new Set(['camera_x', 'camera_h', 'camera_z']);
  world.metres = key => metreKeys.has(key);
  // (a mirror's numbers that may be keys: each its key's value now, 0…1 (none: 0) — a pace 0…PACE_MOST (none: 1, the
  // ripple going as by itself) — render/mirrors.js reads them every frame)
  const MIRROR_KEYED = ['strength', 'rough', 'ripple', 'pace'];
  function mirrorNow(el) {
    const r = el.spec.reflect, M = el.mirror;
    for (const f of MIRROR_KEYED) {
      if (typeof r[f] !== 'string') { M[f] = r[f]; continue; }
      const raw = state.value(r[f]), v = Number(raw);
      M[f] = f === 'pace' ? (raw == null || Number.isNaN(v) ? 1 : clamp(v, 0, PACE_MOST)) : clamp(v || 0, 0, 1);
    }
    M.stamp = T.tick;
  }
  const put = (map, k, el) => { if (typeof k !== 'string') return; (map.get(k) || map.set(k, new Set()).get(k)).add(el); };
  for (const el of elements) {
    const E = el.spec;
    if (E.place) for (const f in E.place) { put(placeKeys, E.place[f], el); if (METRE_FIELDS.includes(f)) metreKeys.add(E.place[f]); }
    if (E.insert?.key) put(insertKeys, E.insert.key, el);
    if (E.kind === 'person' && E.id != null) put(hereKeys, `${E.id}_here`, el);
    if (E.redraw) for (const k in E.redraw) put(paintKeys, k, el);
    if (E.reflect) { for (const f of MIRROR_KEYED) put(mirrorKeys, E.reflect[f], el); mirrorNow(el); }
  }
  // (what a painting read, indexed as each is taken: its keys then; `redraw` — those alone)
  function indexReads(el, reads) {
    if (el.spec.redraw) return;
    for (const k of el.reads) if (!reads.has(k)) paintKeys.get(k)?.delete(el);
    for (const k of reads) put(paintKeys, k, el);
    el.reads = reads;
  }
  // a `redraw` key's value as its step quantizes it
  const stepped = (el, k) => { const v = state.value(k), s = el.spec.redraw[k]; return typeof v === 'number' && s > 0 ? Math.round(v / s) : JSON.stringify(v ?? null); };

  // ── the artist: makes asked, answers taken ──
  // the keys changed since the artist was last told, told in front of a make (SH6 'keys')
  // (making: the elements whose own make — not a shot's — is in flight)
  const untold = new Set(), jobs = new Map(), arrived = [], repaint = [], making = [];
  let jobN = 0, shotsFlying = 0;
  const unmaking = el => { const k = making.indexOf(el); if (k >= 0) making.splice(k, 1); };
  // the land's field, asked of the artist once (build): the promise's two ends. It is ended by the artist's answer,
  // by the artist's being no more (fail) or by the world's being let go (dispose) — never waited on for ever
  let landed = null, landFailed = null;
  function tellKeys() {
    if (!untold.size) return;
    const keys = [...untold], values = keys.map(k => state.value(k) ?? null);
    untold.clear();
    env.artist.post({ t: 'keys', keys, values });
  }
  function ask(el, shot) {
    tellKeys();
    const job = ++jobN, sp = shot ? world.spotAs(el, shot.get) : el.spot;
    jobs.set(job, { el, shot });
    world.flying++;
    if (shot) { shot.flying.set(el, job); shotsFlying++; } else {
      el.job = job; el.toPaint = false; making.push(el);
      if (el.spec.redraw) for (const k in el.spec.redraw) el.redrawn.set(k, stepped(el, k));
    }
    env.artist.post({ t: 'make', job, index: el.index, as: shot ? shot.values : null, spot: { across: sp.across, distance: sp.distance, elevation: sp.elevation, ground: sp.ground } });
  }
  // the artist is no more (its thread failed; the thread ended it with a show that was replaced): whatever waits on
  // it ends with that — the build throws it, and after the build the tick and the settle do (the thread: RN12)
  world.fail = err => { world.broken = err; landFailed?.(err); env.arrived(); };
  // the scene is stopped, its artist ended (2.9 step 1; its shots let go before): what was asked of the artist will
  // not come and nothing more is asked — the makes in flight and those waiting to be asked are forgotten, so nothing
  // of this world waits for a painting any more
  world.stop = () => {
    jobs.clear(); empty(arrived); world.flying = 0; world.took = 0; shotsFlying = 0;
    for (const el of making) el.job = 0;
    empty(making);
    for (const el of repaint) el.toPaint = false;
    empty(repaint);
    insertsMaking();
  };
  // WT5 `making` of every insert's row: a make of it waits to be asked or is in flight, or its painting waits as a
  // swap (RN4: R keeps closed an insert that opens while its painting is being made) — written, comparing, where
  // those change: as a step's world ends, as the makes are asked, at a build's round, as the scene is stopped
  function insertsMaking() {
    for (let i = 0; i < world.inserts.length; i++) {
      const I = world.inserts[i], el = elements[I.el], making = el.toPaint || el.job !== 0 || !!el.pending;
      if (I.making !== making) { I.making = making; I.stamp = T.tick; }
    }
  }
  // the artist's messages (the thread hands them here): a painting made, the land's field
  world.heard = m => {
    if (world.disposed) return;
    if (m.t === 'made') arrived.push(m);
    else if (m.t === 'landed') landed?.(m.field);
    env.arrived();
  };
  // a painting made → a take: { el, slots, handles (a sheet a slot), extents (where each sheet's recording drew ink,
  // or null: nothing), denses (how much one draw of each covers at most, 0…1), form (its row, −1), block (its own, when its parts or layers are other ones than the
  // element's; else null: its sheets go onto the element's rows), made, seen } — nothing of the element touched yet.
  // What it had added when something throws half way is let go
  function takeOf(el, made) {
    if (made.form) formRules(el, made);
    const slots = slotsOf(el, made), wires = [made.rec, ...made.parts.map(p => p.rec), ...made.layers.map(l => l.rec)], handles = [], extents = [], denses = [];
    let form = -1;
    try {
      wires.forEach((wire, s) => {
        const rec = Recording.fromWire(wire), o = slots[s].opts;
        extents.push(rec.empty ? null : rec.extent);
        denses.push(rec.dense);
        handles.push(sheets.add(rec, { wrap: [!!(o && o.drift && o.drift[0]), !!(o && o.drift && o.drift[1])] }));
      });
      if (made.form) form = T.addForm(formOf(el, { points: made.form.points, closed: closedOf(made.form.closed) }));
      const block = sameSlots(slots, el.slots) ? null : buildBlock(el, slots);
      // (a new block's parts stand where the element is now)
      if (block && block.partSlots.length) placeParts(el, block.partSlots, el.parent ? carryOf(el.parent, PC) : ID);
      return { el, slots, handles, extents, denses, form, block, made, seen: made.seen || [] };
    } catch (err) {
      for (const h of handles) sheets.release(h);
      if (form >= 0) T.freeForm(form);
      throw err;
    }
  }
  function dropTake(take) {
    for (const h of take.handles) sheets.release(h);
    if (take.form >= 0) T.freeForm(take.form);
    if (take.block) freeBlock(take.block, null);
  }
  // whether a take kept for later (a shot's) is still a painting of the element as its sheets are NOW (SH2): its
  // sheets go onto the element's rows — the same slots —, or it has a block of its own whose layers' rows, those it
  // took from the element, are still the element's
  const fits = (el, take) => (take.block ? take.block.layerSlots.every(s => s.ownLayer || el.byLayer.get(s.name)?.layer === s.layer) : sameSlots(take.slots, el.slots));
  // a take is the element's from now on: its sheets on its quads (a new block: the old one freed), what its painting
  // has — its points, its lights, its notes
  function applyTake(take) {
    const el = take.el, made = take.made, Q = T.quads;
    if (take.block) {
      const old = { first: el.first, count: el.count, slots: el.slots };
      adopt(el, take.block);
      if (old.count) freeBlock(old, take.block);
      // (the element's rows are other ones: what the live shots keep for it is looked at again — shotStep)
      for (const shot of shots) if (shot.takes.has(el)) shot.changed = true;
    }
    const S = el.slots.length;
    for (let s = 0; s < S; s++) for (let c = 0; c < el.nodes.length; c++) {
      const row = el.first + c * S + s;
      T.setQuad(Q.sheet, row, take.handles[s]);
      if (s === 0) T.setQuad(Q.form, row, take.form);
    }
    for (const h of el.handles) sheets.release(h);
    if (el.form >= 0) T.freeForm(el.form);
    el.handles = take.handles; el.extents = take.extents; el.denses = take.denses; el.form = take.form;
    world.paintings++;
    // (a form's reach is its grid's — the sphere round its points —, not its painting's box: rays, the bounds)
    if (el.form >= 0) { const s = T.forms.list[el.form].sphere; el.radius = Math.hypot(s[0], s[1], s[2]) + s[3]; }
    el.painted.clear();
    for (const [name, p] of made.points) el.painted.set(name, p);
    el.lights = made.lights; el.notes = made.notes || [];
    el.isPainted = true; el.paintedAt = T.tick; el.repaints++;
    // its glows by name (e.glow): an index each, their strengths kept as they were by name (new ones whole)
    const names = [];
    for (const l of el.lights) if (!names.includes(l.name)) names.push(l.name);
    const k = new Float64Array(names.length).fill(1), index = new Map();
    names.forEach((n, i) => { index.set(n, i); const w = el.glowIndex.get(n); if (w !== undefined) k[i] = el.glowK[w]; });
    el.glowIndex = index; el.glowK = k;
    // (a particle's sprite: the recording itself is RENDER's to picture — WT5)
    world.lit?.repainted(el);
    changed();
    // (what it painted past its box: said once — it is cut off there)
    const x = take.extents[0], b = el.box, tol = 0.02 * Math.max(b[2] - b[0], b[3] - b[1]);
    if (x && el.kind === 'card' && !made.form && (x[0] < b[0] - tol || x[1] < b[1] - tol || x[2] > b[2] + tol || x[3] > b[3] + tol)) warn(`${el.who}: it paints past its box [${b.join(', ')}] (to [${x.map(v => Math.round(v * 100) / 100).join(', ')}]) — what is past it is cut off: give it a "box"`);
  }
  // the answers that came, taken (a seen step's 6b). whole: the picture is held — a painting goes straight onto its
  // quads; else it waits as a swap for its pages — the first painting of an element that has none too (SH2)
  function takeArrived(whole) {
    for (let i = 0; i < arrived.length; i++) {
      const m = arrived[i], j = jobs.get(m.job);
      if (!j) continue;
      jobs.delete(m.job);
      world.flying--;
      const el = j.el;
      for (const e of m.errors || []) env.report(el.who, e);
      for (const w of m.warnings || []) warn(`${el.who}: ${w}`);
      if (j.shot) {
        shotsFlying--;
        if (j.shot.flying.get(el) !== m.job) continue;
        j.shot.flying.delete(el);
      } else if (el.job === m.job) { el.job = 0; unmaking(el); } else continue;
      world.took++;
      // (a particles element's code paints its sprite: no quads — RENDER pictures the recording, RN2. An empty or a
      // failed painting is no sprite: none of its particles is drawn — said with the element)
      if (el.kind === 'particles') {
        if (el.emitter && !j.shot) {
          const rec = m.rec ? Recording.fromWire(m.rec) : null;
          if (rec && rec.empty) warn(`${el.who}: its code painted nothing — its particles have no sprite: none of them is drawn`);
          el.emitter.sprite = rec && !rec.empty ? rec : null; el.emitter.stamp = T.tick; el.isPainted = true; indexReads(el, new Set(m.reads));
        }
        continue;
      }
      // (a painting whose code threw answers rec: null — its errors said above: no sheet, part, layer or form is
      // taken of it and what the element had stays, SH6. The keys it read are kept: one changing asks it again)
      let take = null;
      if (m.rec) { try { take = takeOf(el, m); } catch (err) { env.report(el.who, err); } }
      if (j.shot) {
        shotReads(j.shot, el, new Set(m.reads));
        if (take) { const was = j.shot.takes.get(el); if (was) dropTake(was); shotTake(j.shot, el, take); j.shot.changed = true; }
        continue;
      }
      indexReads(el, new Set(m.reads));
      if (!take) continue;
      if (el.pending) dropTake(el.pending);
      el.pending = null;
      if (whole) applyTake(take); else el.pending = take;
      swapsChanged = true;
    }
    empty(arrived);
  }
  // the frame's own swaps: of every painting waiting for its pages (SH2). A painting whose every sheet has its pages
  // is the element's now; in a whole frame all of them at once (the picture is held: there is no old sheet to keep)
  let swapsChanged = false;
  function swapsNow(whole) {
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i], take = el.pending;
      if (!take) continue;
      let there = whole;
      if (!there) { there = true; for (let k = 0; k < take.handles.length; k++) if (sheets.missing(take.handles[k]) !== 0) { there = false; break; } }
      if (there) { applyTake(take); el.pending = null; swapsChanged = true; }
    }
    if (!swapsChanged) return;
    swapsChanged = false;
    world.overN = 0;
    for (let i = 0; i < elements.length; i++) if (elements[i].pending) world.overN = swapsInto(elements[i], elements[i].pending, world, world.overN, false);
  }
  // (what was written into a shot's swaps or overrides was other than what stood there: its entry is stamped — RN4)
  let other = false;
  function swap(holder, n, quad, handle, form) {
    const a = holder.over, o = 3 * n;
    if (a[o] !== quad || a[o + 1] !== handle || a[o + 2] !== form) { a[o] = quad; a[o + 1] = handle; a[o + 2] = form; other = true; }
    return n + 1;
  }
  // a take's swaps — (quad, handle, form) for every sheet of every copy — written into holder.over from n → the new
  // n. ends (a shot's): a take with a block of its own also ENDS every row the element has now — (quad, −1, −1): the
  // rows its cut will free, which the shot's views leave out (SH2)
  function swapsInto(el, take, holder, n, ends) {
    const first = take.block ? take.block.first : el.first, S = take.handles.length, ended = ends && take.block ? el.count : 0;
    const need = 3 * (n + S * el.nodes.length + ended);
    if (holder.over.length < need) { const grown = new Int32Array(Math.max(need, holder.over.length * 2)); grown.set(holder.over); holder.over = grown; }
    for (let c = 0; c < el.nodes.length; c++) for (let s = 0; s < S; s++) n = swap(holder, n, first + c * S + s, take.handles[s], s === 0 ? take.form : -1);
    for (let i = 0; i < ended; i++) n = swap(holder, n, el.first + i, -1, -1);
    return n;
  }

  // ── shots made ready ahead (2.3): what their values paint and place ──
  // A shot's values may paint elements anew — a close-up's face, a ship's rig for another ship — and place others
  // elsewhere. world.shot(values) → the shot: its makes asked of the artist as the ticks go (at most MAKES_AHEAD in
  // flight for all shots), each answer its swaps; a painting of it is made again when a key it read that is not among
  // the shot's values changes. over / overN — its swaps; nodes / nodeOf / nodesN — the nodes its values place
  // elsewhere, with their matrices; hidden, shown — the node rows its values hide and show; stamp — the tick at which
  // any of these last became other than it was (RN4's f.ahead entry reads these very fields). painted: none of its
  // makes is left to ask or in flight.
  // (a shot's paintings and what each read — takes, reads: by the element; takeEls, readEls: the same elements in the
  // order they came, gone through each tick with no iterator made; the same for what its values open and show)
  const shots = [];
  const within = (list, el) => { const k = list.indexOf(el); if (k < 0) return; for (let i = k + 1; i < list.length; i++) list[i - 1] = list[i]; list.pop(); };
  const shotReads = (shot, el, keys) => { if (!shot.reads.has(el)) shot.readEls.push(el); shot.reads.set(el, keys); };
  const shotUnread = (shot, el) => { if (shot.reads.delete(el)) within(shot.readEls, el); };
  const shotTake = (shot, el, take) => { if (!shot.takes.has(el)) shot.takeEls.push(el); shot.takes.set(el, take); };
  const shotUntake = (shot, el) => { if (shot.takes.delete(el)) within(shot.takeEls, el); };
  world.shot = values => {
    const shot = {
      values: { ...values }, get: k => (k in values ? values[k] ?? undefined : state.value(k)),
      takes: new Map(), takeEls: [], flying: new Map(), reads: new Map(), readEls: [], todo: [], changed: true, painted: false,
      // (the inserts its values open or close, the people they bring or take away: each element, and whether it is
      // shown then)
      opens: [], brings: [],
      over: new Int32Array(48), overN: 0, nodes: new Float64Array(12 * 8), nodeOf: new Int32Array(8), nodesN: 0,
      hidden: new Int32Array(8), hiddenN: 0, shown: new Int32Array(8), shownN: 0, stamp: T.tick, moved: [], version: -1,
    };
    for (const k in values) {
      if (sameValue(state.value(k), values[k])) continue;
      paintKeys.get(k)?.forEach(el => { if (el.spec.paints && el.kind !== 'particles' && !shot.todo.includes(el)) shot.todo.push(el); });
    }
    // (what its values place elsewhere: those whose place reads a key of them, and all they carry)
    const moved = new Set();
    for (const k in values) placeKeys.get(k)?.forEach(el => { if (el.kind !== 'person') { moved.add(el); for (const b of el.below) if (b.kind !== 'person') moved.add(b); } });
    shot.moved = [...moved].sort((a, b) => depthOf(a) - depthOf(b));
    for (const k in values) {
      insertKeys.get(k)?.forEach(el => shot.opens.push({ el, shown: clamp(Number(values[k]) || 0, 0, 1) >= 0.002 }));
      hereKeys.get(k)?.forEach(el => shot.brings.push({ el, shown: values[k] !== false }));
    }
    shots.push(shot);
    return shot;
  };
  // (each written over what the step before left there, comparing: `other`)
  const override = (shot, node, m) => {
    if (m34.same(m, 0, T.nodes.m, 12 * node)) return;
    const k = shot.nodesN++;
    if (k === shot.nodeOf.length) { const a = new Float64Array(24 * k), b = new Int32Array(2 * k); a.set(shot.nodes); b.set(shot.nodeOf); shot.nodes = a; shot.nodeOf = b; }
    if (shot.nodeOf[k] !== node || !m34.same(m, 0, shot.nodes, 12 * k)) { shot.nodeOf[k] = node; shot.nodes.set(m, 12 * k); other = true; }
  };
  const listed = (shot, on, node) => {
    const k = on ? shot.shownN++ : shot.hiddenN++;
    let a = on ? shot.shown : shot.hidden;
    if (k === a.length) { const grown = new Int32Array(2 * k); grown.set(a); a = grown; if (on) shot.shown = a; else shot.hidden = a; }
    if (a[k] !== node) { a[k] = node; other = true; }
  };
  // an element the shot's values show or hide: every node of it — each copy's, its parts', and the parts of the
  // painting made for the shot — as shownIs shows and hides them
  const listedParts = (shot, on, parts) => { for (let k = 0; k < parts.length; k++) { const nodes = parts[k].nodes; for (let c = 0; c < nodes.length; c++) listed(shot, on, nodes[c]); } };
  const listedAll = (shot, on, el) => {
    for (let c = 0; c < el.nodes.length; c++) listed(shot, on, el.nodes[c]);
    listedParts(shot, on, el.partSlots);
    const own = shot.takes.get(el)?.block?.partSlots;
    if (own) listedParts(shot, on, own);
  };
  // (the parts of el's copy c — the element's, or a painting's own — where the shot's values place them: SP — what
  // carries it then —, SL — its local matrix then)
  const overrideParts = (shot, el, c, parts) => { for (let k = 0; k < parts.length; k++) override(shot, parts[k].nodes[c], m34.multiply(SP, 0, partLocal(el, parts[k], c, SL, 0, SM), 0, SM)); };
  // a seen tick's share of a shot: what a key changed made no longer its own; its makes asked; its overrides as the
  // state is now
  const SM = new Float64Array(12), SP = new Float64Array(12), SL = new Float64Array(12);
  world.shotStep = (shot, keys) => {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key in shot.values) continue;
      for (let n = shot.readEls.length - 1; n >= 0; n--) {
        const el = shot.readEls[n];
        if (!(el.spec.redraw ? key in el.spec.redraw : shot.reads.get(el).has(key))) continue;
        const t = shot.takes.get(el);
        if (t) { dropTake(t); shotUntake(shot, el); shot.changed = true; }
        shot.flying.delete(el); shotUnread(shot, el);
        if (!shot.todo.includes(el)) shot.todo.push(el);
      }
    }
    // its swaps, when its takes or the rows they go onto changed — each take checked against the element's sheets
    // as they are now: one that no longer fits is let go and its element asked again for the shot
    const takesChanged = shot.changed;
    other = false;
    if (takesChanged) {
      const was = shot.overN;
      shot.changed = false; shot.overN = 0;
      for (let n = 0; n < shot.takeEls.length; n++) {
        const el = shot.takeEls[n], t = shot.takes.get(el);
        if (fits(el, t)) { shot.overN = swapsInto(el, t, shot, shot.overN, true); continue; }
        dropTake(t); shotUntake(shot, el); shotUnread(shot, el); n--;
        if (!shot.todo.includes(el)) shot.todo.push(el);
      }
      if (shot.overN !== was) other = true;
    }
    while (shot.todo.length && shotsFlying < MAKES_AHEAD) ask(shot.todo.pop(), shot);
    shot.painted = !shot.todo.length && !shot.flying.size;
    if (shot.version !== state.version || anyMoved || takesChanged) {
      const nodesWas = shot.nodesN, hiddenWas = shot.hiddenN, shownWas = shot.shownN;
      shot.version = state.version;
      shot.nodesN = 0; shot.hiddenN = 0; shot.shownN = 0;
      // the nodes its values place elsewhere: every node of each element moved — each copy's (placed as the world
      // places it: placeOf), its parts', and the parts of the painting made for the shot (its take's own block)
      for (let n = 0; n < shot.moved.length; n++) {
        const el = shot.moved[n];
        if (el.parent) carryWith(el.parent, shot.get, SP); else m34.identity(SP);
        const own = shot.takes.get(el)?.block?.partSlots;
        for (let c = 0; c < el.nodes.length; c++) {
          override(shot, el.nodes[c], placeOf(el, c, shot.get, SP, SL, 0, passing, SM));
          overrideParts(shot, el, c, el.partSlots);
          if (own) overrideParts(shot, el, c, own);
        }
      }
      for (let n = 0; n < shot.opens.length; n++) { const o = shot.opens[n]; if (o.shown !== o.el.visible) listedAll(shot, o.shown, o.el); }
      for (let n = 0; n < shot.brings.length; n++) { const o = shot.brings[n]; if (o.shown !== o.el.visible) listedAll(shot, o.shown, o.el); }
      if (shot.nodesN !== nodesWas || shot.hiddenN !== hiddenWas || shot.shownN !== shownWas) other = true;
    }
    // (RN4 `stamp`: its swaps or its overrides are other than they were — R culls its views again)
    if (other) shot.stamp = T.tick;
  };
  // the scene is cut to this shot: at this step's frame() — once the keys the cut changed are marked — its paintings
  // are the elements' (those that are what the element paints now: every key each read as it was read), and those
  // elements are not asked to paint again
  let cutTo = null;
  world.shotCut = shot => { cutTo = shot; };
  function cutNow(shot) {
    for (let n = 0; n < shot.takeEls.length; n++) {
      const el = shot.takeEls[n], take = shot.takes.get(el);
      let still = true;
      for (let i = 0; i < take.seen.length; i++) if (JSON.stringify(state.value(take.seen[i][0]) ?? null) !== take.seen[i][1]) { still = false; break; }
      // (not what the element paints now, or no longer a painting of its sheets as they are: left to the shot's end)
      if (!still || !fits(el, take)) continue;
      shotUntake(shot, el); n--;
      if (el.pending) { dropTake(el.pending); el.pending = null; }
      indexReads(el, shot.reads.get(el) || new Set());
      applyTake(take);
      // (asked for the state before the cut meanwhile: that answer is not this painting's — not taken)
      el.toPaint = false; el.job = 0; unmaking(el);
      const k = repaint.indexOf(el);
      if (k >= 0) repaint.splice(k, 1);
      swapsChanged = true;
    }
  }
  // a shot ended (cut to, or cancelled): what it made and was not taken is let go
  world.shotEnd = shot => {
    const i = shots.indexOf(shot);
    if (i < 0) return;
    shots.splice(i, 1);
    for (const t of shot.takes.values()) dropTake(t);
    shot.takes.clear(); empty(shot.takeEls); shot.reads.clear(); empty(shot.readEls); shot.flying.clear(); shot.todo.length = 0; shot.overN = 0; shot.nodesN = 0; shot.hiddenN = 0; shot.shownN = 0;
    if (cutTo === shot) cutTo = null;
  };

  // ── the step ──
  // (lists, and marks on the elements, not sets: a set cleared, or shrunk as its entries go, makes its table anew)
  const dirty = [];
  const mark = el => { if (!el.dirty) { el.dirty = true; dirty.push(el); } };
  const markDirty = el => { mark(el); for (let i = 0; i < el.riders.length; i++) mark(el.riders[i]); };
  function placeDirty() {
    if (!dirty.length) return;
    // (a walk plane moved: who stands on it, with it)
    for (let i = 0; i < dirty.length; i++) if (dirty[i].flags.walk) for (let k = 0; k < persons.length; k++) if (!persons[k].parent) mark(persons[k]);
    for (let i = 0; i < dirty.length; i++) {
      const el = dirty[i];
      let top = true;
      for (let p = el.parent; p; p = p.parent) if (p.dirty) { top = false; break; }
      if (top) placeTree(el);
    }
    for (let i = 0; i < dirty.length; i++) dirty[i].dirty = false;
    empty(dirty);
  }
  // (what a key changed does to an element that reads it — the key in `key`: nothing made per tick)
  let key = null;
  const toPaint = el => { if (!el.toPaint && el.spec.paints && (!el.spec.redraw || el.redrawn.get(key) !== stepped(el, key))) { el.toPaint = true; el.why = key; if (!repaint.includes(el)) repaint.push(el); } };
  // (with its element: each copy's node, its parts' — and the parts of a painting of it that waits: its own, a shot's)
  const showParts = (parts, on) => { for (let k = 0; k < parts.length; k++) { const nodes = parts[k].nodes; for (let c = 0; c < nodes.length; c++) T.showNode(nodes[c], on); } };
  const shownIs = (el, on) => {
    if (el.visible === on) return;
    el.visible = on;
    for (let c = 0; c < el.nodes.length; c++) T.showNode(el.nodes[c], on);
    showParts(el.partSlots, on);
    if (el.pending?.block) showParts(el.pending.block.partSlots, on);
    for (let s = 0; s < shots.length; s++) { const t = shots[s].takes.get(el); if (t?.block) showParts(t.block.partSlots, on); }
    changed();
  };
  // (an insert's key: its quads listed — asked as the view's own — from the moment it leaves 0; what it shows of its
  // opening is openings')
  const opened = el => shownIs(el, clamp(Number(state.value(key)) || 0, 0, 1) >= 0.002);
  const here = el => shownIs(el, state.value(key) !== false);
  // (put somewhere at once — a place's key set, not moved — it and what it carries: what follows them does not glide
  // there: el.jumpedAt)
  const jumped = el => { el.jumpedAt = T.tick; for (let i = 0; i < el.below.length; i++) el.below[i].jumpedAt = T.tick; };
  // A step's world (2.1 step 6b): keys — those changed since the last step; seen — the step is drawn (answered makes
  // are taken, swaps whose pages are there written); whole — the picture is held (f.whole)
  world.frame = (keys, seen, whole) => {
    T.step = T.tick;
    world.took = 0;
    anyMoved = false;
    for (let i = 0; i < keys.length; i++) {
      key = keys[i];
      untold.add(key);
      placeKeys.get(key)?.forEach(markDirty);
      if (state.jumped(key)) placeKeys.get(key)?.forEach(jumped);
      paintKeys.get(key)?.forEach(toPaint);
      insertKeys.get(key)?.forEach(opened);
      hereKeys.get(key)?.forEach(here);
      mirrorKeys.get(key)?.forEach(mirrorNow);
    }
    placeDirty();
    if (cutTo) { cutNow(cutTo); cutTo = null; }
    if (seen) { if (arrived.length) takeArrived(whole); swapsNow(whole); }
    insertsMaking();
    openings(seen, whole);
  };
  // RN4: the opening each insert shows (WT5 `open`) — SCENE's, from its key once the insert is finished. While it is
  // `making`, or a page the frame's view named of its quads in the cycle before is not in the cache (sheets.missing:
  // one denied at a view's bias's end is not counted), it shows 0, its key above 0; then its opening begins — the
  // key's move as it was when the key left 0 (world.moves.moveOf) run from that moment, the smaller of it and the key
  // shown: it never pops in half open, and a key that turns back is followed at once; a key with no such move opens
  // as the key is. Closing never waits; on an unseen step and in a whole frame the opening is the key at once.
  // world.opened: on a seen step an opening begins in, the seconds since its key left 0 (the most of them; the stand's
  // `opened`, ST2), else −1
  function openings(seen, whole) {
    const t = state.time, Q = T.quads, at = !seen || whole;
    world.opened = -1;
    for (let i = 0; i < world.inserts.length; i++) {
      const I = world.inserts[i], el = elements[I.el], want = clamp(Number(state.value(I.key)) || 0, 0, 1);
      let open = want;
      if (want < 0.002) { el.leftAt = -1; el.openedAt = -1; el.move = null; }
      else {
        if (el.leftAt < 0) { el.leftAt = t; el.move = world.moves.moveOf(I.key); }
        if (el.openedAt < 0) {
          if (at || finished(el, I, Q)) { el.openedAt = t; if (!at) world.opened = Math.max(world.opened, t - el.leftAt); }
          else open = 0;
        }
        if (at) el.move = null;
        if (el.move && el.openedAt >= 0) {
          const run = t - el.openedAt;
          if (run >= el.move.duration) el.move = null; else open = Math.min(open, world.moves.moveAt(el.move, run));
        }
      }
      if (I.open !== open) { I.open = open; el.open = open; I.stamp = T.tick; }
    }
  }
  // (an insert finished: its painting on it — not being made, none waiting as a swap — and every page the frame's view
  // named of its quads shown in the cycle before in the cache)
  function finished(el, I, Q) {
    if (I.making) return false;
    for (let q = el.first; q < el.first + el.count; q++) {
      if (!(Q.flags[q] & FLAG.SHOWN)) continue;
      const h = Q.sheet[q];
      if (h < 0 || sheets.missing(h) > 0) return false;
    }
    return true;
  }
  // the marked elements asked of the artist: one make in flight an element (2.1 step 7)
  world.asks = () => {
    for (let i = repaint.length - 1; i >= 0; i--) {
      const el = repaint[i];
      if (el.job) continue;
      repaint.splice(i, 1);
      if (el.toPaint) ask(el, null);
    }
    insertsMaking();
  };
  // the step is made — or, with no step, the tables are about to be shown to a reader (a frame drawn as the scene
  // stands: play/step.js unstepped): the tick moves on (3.4) — a row written from now on, in a message's task (a
  // selection, an offer), carries a tick no reader has seen
  world.stepped = () => { T.tick++; };
  // whether a make of something SHOWN is in flight, or waits to be asked (f.wait's part of the world, RN4): of an
  // element whose node is shown and that has a quad shown — a whole frame does not wait for paintings of what is not
  const shownNow = el => {
    if (!T.nodes.shown[el.node]) return false;
    for (let i = el.first; i < el.first + el.count; i++) if (T.quads.flags[i] & FLAG.SHOWN) return true;
    return false;
  };
  world.waiting = () => {
    for (let i = 0; i < repaint.length; i++) if (repaint[i].toPaint && shownNow(repaint[i])) return true;
    for (let i = 0; i < making.length; i++) if (shownNow(making[i])) return true;
    return false;
  };
  // an element whose animate made its glows other than they were (e.glow): its lights worked out anew this step
  world.glowed = el => { el.glowedAt = T.tick; };
  // a platformer's hero moved from where it stands (metres) and turned back (the camera's): placed anew
  world.moveHero = (el, x, y, flip) => {
    el.offset ||= { x: 0, y: 0 };
    if (el.offset.x === x && el.offset.y === y && el.flip === flip) return;
    el.offset.x = x; el.offset.y = y;
    if (el.flip !== flip) { el.flip = flip; for (let s = 0; s < el.count; s++) T.flagQuad(el.first + s, FLAG.FLIP, flip); }
    markDirty(el);
    placeDirty();
  };
  // a person's root, as people have it (PP3): into their node's row
  world.rooted = (el, m) => { if (T.setNode(el.node, m)) { el.movedAt = T.tick; changed(); } };

  // ── the render origin, the GPU's tables ──
  const G = world.gpu = {
    nodes: gpu.table('nodes', { stride: NODE_BYTES, capacity: T.nodes.cap }),
    quads: gpu.table('quads', { stride: QUAD_BYTES, capacity: T.quads.cap }),
    layers: gpu.table('layers', { stride: LAYER_BYTES, capacity: T.layers.cap }),
    forms: null, formsRows: 0, formsVersion: 0,
  };
  const formStamps = [], texels = new Float32Array(FORM_W * FORM.SIDE * 4);
  function formsTexture(rows) {
    if (G.forms) gpu.drop(G.forms);
    G.forms = gpu.texture('forms', { size: [FORMS_ACROSS * FORM_W, FORM.SIDE * rows], format: 'rgba32float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    G.formsRows = rows; G.formsVersion++;
    formStamps.length = 0;
  }
  formsTexture(1);
  // the render origin kept within ORIGIN.REACH of the eye, moved in whole steps of ORIGIN.STEP: on a step of it, in
  // that same tick, every node row is written again
  world.rebase = eye => {
    const O = world.origin;
    if (Math.abs(eye[0] - O[0]) <= ORIGIN.REACH && Math.abs(eye[1] - O[1]) <= ORIGIN.REACH && Math.abs(eye[2] - O[2]) <= ORIGIN.REACH) return;
    for (let k = 0; k < 3; k++) O[k] = Math.round(eye[k] / ORIGIN.STEP) * ORIGIN.STEP;
    world.originStamp = T.tick;
    T.allNodes();
  };
  // world.bounds as the world stands now
  function bounds() { boundsDue = false; space.bounds(); }
  // the rows changed since the last flush, to the GPU (a seen step's 6f); the forms whose grid is another; the bounds,
  // when anything moved since they were worked out — in the unseen steps before this one too (WT5)
  // (a changed row laid out as the GPU has it and marked to be sent: three functions made once)
  const sendNode = i => { packNode(T.nodes, i, world.origin, G.nodes.f32); G.nodes.mark(i, 1); };
  const sendQuad = i => { packQuad(T.quads, i, G.quads.f32, G.quads.u32); G.quads.mark(i, 1); };
  const sendLayer = i => { packLayer(T.layers, i, G.layers.f32); G.layers.mark(i, 1); };
  world.flush = () => {
    if (boundsDue) bounds();
    // (a table grown at a make: the GPU's with it — GP2 grow keeps its rows and marks them all)
    if (G.nodes.capacity < T.nodes.cap) G.nodes.grow(T.nodes.cap);
    if (G.quads.capacity < T.quads.cap) G.quads.grow(T.quads.cap);
    if (G.layers.capacity < T.layers.cap) G.layers.grow(T.layers.cap);
    drain(T.nodes, sendNode); drain(T.quads, sendQuad); drain(T.layers, sendLayer);
    G.nodes.flush(); G.quads.flush(); G.layers.flush();
    const F = T.forms, rows = Math.max(1, Math.ceil(F.n / FORMS_ACROSS));
    if (rows > G.formsRows) formsTexture(rows);
    for (let i = 0; i < F.n; i++) {
      const f = F.list[i];
      if (!f || formStamps[i] === f.stamp) continue;
      formStamps[i] = f.stamp;
      // (a point's texel and, 33 to its right, its normal's)
      for (let j = 0; j < FORM.SIDE; j++) for (let k = 0; k < FORM.SIDE; k++) {
        const s = 3 * (j * FORM.SIDE + k), p = 4 * (j * FORM_W + k), q = p + 4 * FORM.SIDE;
        texels[p] = f.points[s]; texels[p + 1] = f.points[s + 1]; texels[p + 2] = f.points[s + 2]; texels[p + 3] = 1;
        texels[q] = f.normals[s]; texels[q + 1] = f.normals[s + 1]; texels[q + 2] = f.normals[s + 2]; texels[q + 3] = 0;
      }
      gpu.queue.writeTexture({ texture: G.forms, origin: [FORM_W * (i % FORMS_ACROSS), FORM.SIDE * Math.floor(i / FORMS_ACROSS)] }, texels, { bytesPerRow: FORM_W * 16 }, [FORM_W, FORM.SIDE]);
    }
  };

  // ── everything placed, as the scene is shown; then painted ──
  // the region of the land the scene is on ([across0, across1, distance0, distance1]): its planes and what stands on
  // the land, as they are placed now
  world.region = () => {
    let a0 = -20, a1 = 20, d0 = -10, d1 = 60;
    const M = T.nodes.m;
    for (const el of elements) {
      if (el.kind === 'sky' || el.kind === 'insert') continue;
      if (el.kind !== 'plane' && !el.flags.onLand && el.kind !== 'person') continue;
      const r = el.kind === 'plane' ? Math.hypot(el.box[2], el.box[3]) : 2;
      for (let c = 0; c < el.nodes.length; c++) { const o = 12 * el.nodes[c], x = M[o + 9], z = M[o + 11]; a0 = Math.min(a0, x - r); a1 = Math.max(a1, x + r); d0 = Math.min(d0, -z - r); d1 = Math.max(d1, -z + r); }
    }
    return [a0, a1, d0, d1];
  };
  for (const el of elements) {
    el.ctx = animateContext(el, { state, world, kit: env.shared.kits, lib: env.shared.lib, anim: env.shared.anim, warn, error: err => env.report(el.who, err), debug: !!env.debug });
    // (an insert's node shown as its key is above 0; its opening is the first step's: openings)
    if (el.insertRow >= 0) el.visible = clamp(Number(state.value(el.spec.insert.key)) || 0, 0, 1) >= 0.002;
    if (el.kind === 'person' && el.id != null) el.visible = state.value(`${el.id}_here`) !== false;
    // (a node not shown: a closed insert, a person not here — WT1; what is unseen stands and is animated all the same)
    for (let c = 0; c < el.nodes.length; c++) T.showNode(el.nodes[c], el.kind === 'insert' || el.kind === 'person' ? el.visible : true);
    // (what paints has its base quads from the start — no sheet yet: where it is can be asked before it is painted)
    if (el.spec.paints && el.kind !== 'particles') adopt(el, buildBlock(el, slotsOf(el, null)));
  }
  for (const el of ordered) if (!el.parent || el.kind === 'person') placeTree(el);
  bounds();
  // The world built (2.2 step 5): every element with paint code asked of the artist — for the state as it is —, the
  // answers taken as they come; the land's height field. taken(answered): called at every wake — answered: answers
  // were taken in it (the thread asks the opening's view then; a page's arrival alone is only placed).
  // wait(): the thread's arrival(); check(): the job's — it throws when the show was replaced, looked at at each wake.
  // The artist was told the scene and the state's keys before (the thread: SH6 'show', then told()).
  world.told = () => { for (const k in state.now) untold.add(k); tellKeys(); };
  world.build = async (taken, wait, check) => {
    world.building = true;
    let field = null;
    if (height) {
      field = new Promise((resolve, reject) => { landed = resolve; landFailed = reject; });
      // (a build that ends before it comes to the field — a newer show, the artist failing — leaves its end heard)
      field.catch(() => {});
      env.artist.post({ t: 'land', region: world.region() });
    }
    for (const el of elements) if (el.spec.paints) ask(el, null);
    while (world.flying) {
      if (!arrived.length && !world.broken) await wait();
      check();
      if (world.broken) throw world.broken;
      const answered = arrived.length > 0;
      // (each round of answers taken is a step of the tables: the tick moves on before they are shown to a reader — 3.4)
      if (answered) { takeArrived(true); swapsNow(true); insertsMaking(); T.tick++; }
      taken(answered);
    }
    if (field) {
      // (the promise itself: its answer may have come while the makes were taken)
      const got = await field.finally(check);
      if (!got) throw new Error('the land: the artist gave no height field for a scene that has a "relief"');
      world.relief = reliefOf(height, got, T.tick); changed();
    }
    bounds();
    world.building = false;
  };
  // the world let go (a scene replaced, 2.9): its sheets released; its tables on the GPU dropped
  world.dispose = () => {
    world.disposed = true;
    landFailed?.(new Error('the world was let go'));
    for (const shot of shots.slice()) world.shotEnd(shot);
    for (const el of elements) { if (el.pending) dropTake(el.pending); el.pending = null; for (const h of el.handles) sheets.release(h); el.handles = []; }
    gpu.drop(G.nodes.buffer); gpu.drop(G.quads.buffer); gpu.drop(G.layers.buffer); gpu.drop(G.forms);
  };
  return world;
}
