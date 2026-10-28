// Shadows (5.5, LG11): which lights cast is the engine's choice, so scenes keep their shadows unedited — at most
// SHADOW.LIGHTS at once, chosen each frame among the lights that shine and light the view: first those a caster's
// `shadow.light` names, then the far lights and those through panes — in the spec's order —, then the others (the
// lamps, the windows, the beams) by worth to the casters in the view (how much of each one's light reaches what casts
// there — a beam's only within its cone). A slot changes hands only when its light stops shining, lighting the view or
// reaching its casters, or another is worth SHADOW.HOLD times
// more; two lamps change ranks only by that ratio too — no clock. A slot that passed to another light, or to another
// rank, casts nothing until its cells have been drawn for it. At a new shot the choice is made anew (everything is
// drawn again anyway) — which is what a shot ahead was asked by.
//   The maps: two atlases of depth (reversed) read through one comparison sampler — `shadowStatic` (side host.shadow)
// and `shadowMovers` (half). Views: a far light — 2 cascades; a point light — the faces its casters are in, up to 6 (a
// beam's: of those, the faces its cone meets — turning it draws a face only as it first comes into the cone);
// a window — 1. A cell is looked at again (culled) when a row of the world or its own light's row was stamped since
// it was last looked at — another light's change is none of its matter.
// A view's cell is the same share of both atlases, by the light's rank among the four: rank 0 — a cascade or a window
// 1/2, a face 1/4; rank 1 — 1/4, 1/8; ranks 2–3 — 1/8, 1/16.
//   Static cells: redrawn whole when the light moved, the placement changed (a cascade's is snapped to a quarter of
// its radius), or a static caster in it changed (its node's, quad's or layer's stamp; its sheet's `sheets.stamp`; its
// own shader's values) — host.cells a frame, the first ranks first; a waiting cell keeps its content and the
// placement it was drawn with (late, never wrong). In a whole frame every cell due is drawn. Every "changed since" is
// 3.4's test (render/quads.js `since`): a stamp at or after the tick of the call that drew, looked or began the shot.
//   Movers: people; and a quad whose node or layer row was stamped, in a tick that was not a cut's, since the shot
// began — from then to the end of that shot. ONE placement a view for both atlases: a movers' cell is drawn with the
// placement its static cell was last drawn with, and the movers' atlas is cleared and redrawn on a frame in which a
// mover changed, a static cell was drawn, a slot's light or rank changed, or particles that cast are in the air. A
// quad that only sways is not a mover: its shadow is drawn from where it rests.
//   Which caster casts in which light is SCENE's (world.castsIn; a person: world.personCastsIn).
// Per map of a light: its strength is the strongest of its casters' (strength × (1 − sheer): WT2), its receivers the
// union of its casters' `onto` — worked out where a cell's view is culled and kept with the cell. People cast as their
// spec says: none with `shadow: false`, else by their shadow's strength (0.5 unless said), light and receivers (the
// ground unless said), into the movers' maps, one by one. Particles that cast are in the movers' maps of the far
// lights: such a map stops all of its light where they are (their strength is in their coverage) and falls on the
// ground.
//   A light's views read sheets SHADOW.COARSER quarter levels coarser (SH10): a shadow needs a sheet's shape.
//   People ground by the blob map: their capsules' footprints from above, about the people near the eye.
import { LIGHT, RECV, SHADOW, empty } from '../base.js';
import { SHADOWS, VIEWU } from './wgsl/frame.js';
import { since, placedAt, stampedAt } from '../world/tables.js';
import { createView, newCamera, copyCamera, sameCamera, lookRot, perspective, orthographic, viewProj, sees } from './views.js';

const CASCADE = [16, 96], THROW = 300, FACES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], UPS = [[0, 1, 0], [0, 1, 0], [0, 0, 1], [0, 0, 1], [0, 1, 0], [0, 1, 0]];
const ACROSS = [1, 0, 0], UP = [0, 1, 0];
// how far a face's corner is from its middle (radians: a 90° view)
const CORNER = Math.acos(1 / Math.sqrt(3));
const BLOB = 512, BLOB_REACH = 24, BLOB_LEAST = 4, CAPSULES = 512;
// a person's shadow, where their spec says nothing of it: its strength; what it falls on — the ground (RECV.GROUND,
// WT2), which particles' shadows fall on too
const PERSON_STRENGTH = 0.5;
// a rank's region of the atlas (its top, as a share) and its cells' sides: a cascade's or a window's, a face's
const RANK = [[0, 1 / 2, 1 / 4], [0.5, 1 / 4, 1 / 8], [0.75, 1 / 8, 1 / 16], [0.875, 1 / 8, 1 / 16]];
// a light's kind as the maps have it: 0 a far light's cascades (through panes too), 1 a point's faces, 2 a window's view
const kindOf = k => (k < LIGHT.POINT ? 0 : k === LIGHT.POINT ? 1 : 2);
const VIEWS = [2, 6, 1];

export function createShadows(gpu, host, sheets, quads, lib) {
  const B = GPUBufferUsage, T = GPUTextureUsage, side = host.shadow;
  const depth = (name, s) => gpu.texture(name, { size: [s, s], format: 'depth32float', usage: T.RENDER_ATTACHMENT | T.TEXTURE_BINDING });
  const statics = depth('shadowStatic', side), movers = depth('shadowMovers', side / 2);
  const blob = gpu.texture('blob', { size: [BLOB, BLOB], format: 'r8unorm', usage: T.RENDER_ATTACHMENT | T.TEXTURE_BINDING });
  const uniform = gpu.buffer('shadows', SHADOWS.BYTES, B.UNIFORM | B.COPY_DST), data = new ArrayBuffer(SHADOWS.BYTES), f32 = new Float32Array(data), i32 = new Int32Array(data), u32 = new Uint32Array(data);
  const blobU = gpu.buffer('blob at', 16, B.UNIFORM | B.COPY_DST), blobGroup = gpu.bind('blob', [{ binding: 0, resource: { buffer: blobU } }]);
  const capsules = gpu.buffer('capsules', CAPSULES * 32, B.VERTEX | B.COPY_DST), capData = new Float32Array(CAPSULES * 8), blobTo = new Float32Array(4);
  // the four that cast, in the order of their ranks: each its light's row (−1: none), its views (a cell each: its
  // camera now — the placement asked —, the one its static cell was drawn with, the view its movers are drawn
  // through; what the casters its view holds stop and fall on — [what stands, what moves]), whether its cells have
  // been drawn for this light at this rank
  const cellOf = drawn => ({ view: createView(gpu, 'light', drawn), moves: drawn ? createView(gpu, 'light movers') : null, camera: newCamera(), drawn: newCamera(), placed: null,
    has: false, due: true, look: true, now: false, on: false, drawnTick: 0, lookedTick: 0, sig: -1, asked: 1, rect: new Float32Array(4), light: new Float32Array(4), texel: 0,
    // (a shot's cell: the light its view was last culled for — render/renderer.js)
    culledFor: -1,
    stop: [0, 0], onto: [0, 0] });
  const slotOf = drawn => ({ light: -1, kind: 0, rank: -1, worth: 0, cls: 0, ready: false, views: 0, stop: [0, 0], onto: [0, 0], cells: Array.from({ length: SHADOWS.VIEWS }, () => cellOf(drawn)) });
  const slots = Array.from({ length: SHADOW.LIGHTS }, () => slotOf(true));
  // (shotTick, lookedAt: world.tick of the call that began the shot, of the call that last looked at the movers)
  let world = null, people = null, casters = [], mover = new Uint8Array(0), shotTick = 0, lookedAt = 0, shot = -1, moversDue = true, smoke = false, versions = new Map(), blobDrawn = -1, blobSig = 0, capN = 0;
  const blobPipe = lib.get('blob');
  // scratch: the lights lit in a view; the casters seen in it (rows, spheres); the lights wanted and their worth
  let lit = new Uint8Array(0), seen = new Int32Array(0), spheres = new Float64Array(0), seenN = 0;
  const way = new Float64Array(3), S4 = new Float64Array(4), bounds = new Float64Array(6), light4 = new Float32Array(4), wanted = new Int32Array(SHADOW.LIGHTS), wantedWorth = new Float64Array(SHADOW.LIGHTS), at3 = new Int32Array(3);
  const X = { uniform, slots, viewsDue: [], cellsDue: false, moversDue: false, blobDue: false, casting: false, blobRect: null };
  const blobRect = new Float64Array(4), blobBits = new Uint32Array(blobTo.buffer);
  X.staticView = statics.createView(); X.moversView = movers.createView(); X.blobView = blob.createView();

  // a world's: the persons who cast (their `shadow` is not false), each with what their shadow says
  X.build = (w, p) => {
    world = w; people = w.people ? p : null; shot = -1; lookedAt = 0; versions = new Map(); moversDue = true; smoke = false; blobDrawn = -1;
    for (const s of slots) { s.light = -1; s.rank = -1; s.ready = false; for (const c of s.cells) c.view.e.anew(); }
    casters = [];
    if (people) for (const person of people.list) {
      const el = w.elements[person.index], sh = el.spec.shadow;
      if (sh !== false) casters.push({ id: person.id, index: person.index, strength: sh ? sh.strength : PERSON_STRENGTH, onto: el.cast || RECV.GROUND });
    }
  };
  // whether a quad moves (this shot): what the movers' map holds
  X.mover = q => mover[q] === 1;
  // whether a sphere is within a slot's light's reach (a far light reaches everything)
  const reached = (s, S) => {
    if (s.kind === 0) return true;
    const Lt = world.lights, i = s.light;
    return Math.sqrt((S[0] - Lt.at[3 * i]) ** 2 + (S[1] - Lt.at[3 * i + 1]) ** 2 + (S[2] - Lt.at[3 * i + 2]) ** 2) - S[3] < Lt.reach[i];
  };
  // whether a sphere is in a casting light's view (people shown for their shadows: PP7)
  X.sees = S => {
    for (let k = 0; k < slots.length; k++) {
      const s = slots[k];
      if (s.light < 0 || !reached(s, S)) continue;
      for (let v = 0; v < s.views; v++) { const c = s.cells[v]; if (sees(c.view.e, S) || (c.placed && sees(c.moves.e, S))) return true; }
    }
    return false;
  };

  // (a light's class among the casting: named by a caster; far off or through panes; the others — lamps, windows,
  // beams)
  const classOf = i => (world.lights.named[i] ? 3 : world.lights.kind[i] < LIGHT.POINT ? 2 : 1);
  // half the width of light i's cone (radians) — a beam's, WT4: a point with a cone —, or −1: it has none
  const halfOf = i => (world.lights.kind[i] === LIGHT.POINT && world.lights.cone[2 * i + 1] > 0 ? Math.acos(Math.min(1, world.lights.cone[2 * i])) : -1);
  // whether the sphere A[o…o+3] is within a beam's cone (light i, half its width `half`): the angle from its way to the
  // sphere's middle, less the sphere's own half-angle there, within it
  function inCone(i, half, A, o) {
    const Lt = world.lights, x = A[o] - Lt.at[3 * i], y = A[o + 1] - Lt.at[3 * i + 1], z = A[o + 2] - Lt.at[3 * i + 2], d = Math.sqrt(x * x + y * y + z * z);
    if (d <= A[o + 3]) return true;
    const c = (x * Lt.way[3 * i] + y * Lt.way[3 * i + 1] + z * Lt.way[3 * i + 2]) / d;
    return Math.acos(Math.max(-1, Math.min(1, c))) - Math.asin(A[o + 3] / d) < half;
  }
  // how much of light i reaches what casts in the view (the casters gathered: `seen`, `spheres`; the persons who cast)
  function worthOf(i, view) {
    const Lt = world.lights;
    if (Lt.kind[i] < LIGHT.POINT) return Lt.strength[i];
    const x = Lt.at[3 * i], y = Lt.at[3 * i + 1], z = Lt.at[3 * i + 2], r = Lt.reach[i], half = halfOf(i);
    let sum = 0;
    for (let k = 0; k < seenN; k++) {
      const o = 4 * k, t = Math.max(0, Math.sqrt((spheres[o] - x) ** 2 + (spheres[o + 1] - y) ** 2 + (spheres[o + 2] - z) ** 2) - spheres[o + 3]) / r;
      if (t < 1 && (half < 0 || inCone(i, half, spheres, o)) && world.castsIn(seen[k], i)) sum += (1 - t * t) * (1 - t * t);
    }
    for (let k = 0; k < casters.length; k++) {
      const person = casters[k];
      if (!world.personCastsIn(person.index, i) || !people.sphere(person.id, S4) || !sees(view.e, S4)) continue;
      const t = Math.max(0, Math.sqrt((S4[0] - x) ** 2 + (S4[1] - y) ** 2 + (S4[2] - z) ** 2) - S4[3]) / r;
      if (t < 1 && (half < 0 || inCone(i, half, S4, 0))) sum += (1 - t * t) * (1 - t * t);
    }
    return Lt.strength[i] * sum;
  }
  // whether face v of a point light i's views can hold anything it lights: every face of a lamp; a beam's, where its
  // cone meets the face's (90°: its corners acos(1/√3) from its middle)
  function faceLit(i, v) {
    const half = halfOf(i);
    if (half < 0 || half + CORNER >= Math.PI) return true;
    const Lt = world.lights, F = FACES[v];
    return F[0] * Lt.way[3 * i] + F[1] * Lt.way[3 * i + 1] + F[2] * Lt.way[3 * i + 2] > Math.cos(half + CORNER);
  }
  // The lights wanted for a view, the first SHADOW.LIGHTS of: those a caster names, the far and through lights — each
  // in the spec's order —, the others by worth. `lit`: the lights that light that view. ahead: a shot's entry, or
  // null. → how many (wanted, wantedWorth)
  function want(view, ahead) {
    const Lt = world.lights, Q = world.quads;
    if (seen.length < Q.cap) { seen = new Int32Array(Q.cap); spheres = new Float64Array(4 * Q.cap); }
    seenN = quads.casters(view, ahead, seen, spheres);
    let n = 0;
    for (let cls = 3; cls >= 2 && n < SHADOW.LIGHTS; cls--) for (let i = 0; i < Lt.n && n < SHADOW.LIGHTS; i++) {
      if (!lit[i] || !(Lt.strength[i] > 0) || classOf(i) !== cls) continue;
      wanted[n] = i; wantedWorth[n++] = worthOf(i, view);
    }
    const first = n;
    for (let i = 0; i < Lt.n; i++) {
      if (!lit[i] || !(Lt.strength[i] > 0) || classOf(i) !== 1) continue;
      const w = worthOf(i, view);
      if (!(w > 0)) continue;
      // (kept sorted, the most worth first)
      let at = n;
      while (at > first && wantedWorth[at - 1] < w) at--;
      if (at >= SHADOW.LIGHTS) continue;
      if (n < SHADOW.LIGHTS) n++;
      for (let k = n - 1; k > at; k--) { wanted[k] = wanted[k - 1]; wantedWorth[k] = wantedWorth[k - 1]; }
      wanted[at] = i; wantedWorth[at] = w;
    }
    return n;
  }
  // A slot's views placed for its light at a rank: each cell's camera, its share of the atlases, the metres a texel of
  // it spans, the way or place of its light. eye, gx, gz: the view's eye and its gaze over the level; from: the view
  // they are of — the frame's, a shot's: its swaps and its overrides are theirs (SH10)
  function placeCells(s, rank, eye, gx, gz, from) {
    const Lt = world.lights, i = s.light, R = RANK[rank], gl = Math.sqrt(gx ** 2 + gz ** 2) || 1;
    s.kind = kindOf(Lt.kind[i]);
    s.views = VIEWS[s.kind];
    const cellSide = s.kind === 1 ? R[2] : R[1], perRow = Math.round(1 / cellSide), px = Math.round(cellSide * side);
    for (let v = 0; v < s.views; v++) {
      const c = s.cells[v], cam = c.camera;
      c.rect[0] = (v % perRow) * cellSide; c.rect[1] = R[0] + Math.floor(v / perRow) * cellSide; c.rect[2] = cellSide;
      if (s.kind === 0) {
        // (a cascade: a square about a point before the eye, snapped to a quarter of its radius; from far up the light's way)
        const r = CASCADE[v], snap = r / 4;
        const cx = Math.round((eye[0] + gx / gl * r * 0.6) / snap) * snap, cy = Math.round(eye[1] / snap) * snap, cz = Math.round((eye[2] + gz / gl * r * 0.6) / snap) * snap;
        cam.eye[0] = cx + Lt.way[3 * i] * THROW; cam.eye[1] = cy + Lt.way[3 * i + 1] * THROW; cam.eye[2] = cz + Lt.way[3 * i + 2] * THROW;
        way[0] = -Lt.way[3 * i]; way[1] = -Lt.way[3 * i + 1]; way[2] = -Lt.way[3 * i + 2];
        lookRot(way, Math.abs(way[1]) > 0.99 ? ACROSS : UP, cam.rot);
        orthographic(r, r, 0.1, 2 * THROW, cam.proj);
        cam.ortho = true;
        c.texel = 2 * r / px;
        light4[0] = -way[0]; light4[1] = -way[1]; light4[2] = -way[2]; light4[3] = 0;
      } else {
        cam.eye[0] = Lt.at[3 * i]; cam.eye[1] = Lt.at[3 * i + 1]; cam.eye[2] = Lt.at[3 * i + 2];
        const tan = s.kind === 1 ? 1 : 2;
        if (s.kind === 1) { way[0] = FACES[v][0]; way[1] = FACES[v][1]; way[2] = FACES[v][2]; lookRot(way, UPS[v], cam.rot); }
        else { way[0] = Lt.way[3 * i]; way[1] = Lt.way[3 * i + 1]; way[2] = Lt.way[3 * i + 2]; lookRot(way, Math.abs(way[1]) > 0.99 ? ACROSS : UP, cam.rot); }
        perspective(tan, 1, 0.05, cam.proj);
        cam.ortho = false;
        c.texel = 2 * tan / px;
        light4[0] = cam.eye[0]; light4[1] = cam.eye[1]; light4[2] = cam.eye[2]; light4[3] = 1;
      }
      // (what faces the eye is turned to the view: the turn of an eye that looks along `way` — a card casts turned to
      // its light)
      cam.yaw = Math.atan2(way[0], -way[2]);
      const view = c.view;
      view.e.place(world, cam, px, px);
      view.weight = 0.5; view.coarser = SHADOW.COARSER; view.inserts = false;
      view.ahead = from.ahead; view.over = from.over; view.overN = from.overN;
      view.nodes = from.nodes; view.nodeOf = from.nodeOf; view.nodesN = from.nodesN;
      c.light.set(light4);
    }
  }
  // the lights that light the frame's view → lit
  function litOf(lights) {
    const n = world.lights.n;
    if (lit.length < world.lights.cap) lit = new Uint8Array(world.lights.cap);
    for (let i = 0; i < n; i++) lit[i] = lights.rowOf[i] >= 0 ? 1 : 0;
  }
  // whether slot a stands before slot b among the ranks: by class; lamps by worth, with the hold; the others as the
  // spec lists them
  const before = (a, b) => a.light >= 0 && (b.light < 0 || a.cls > b.cls || (a.cls === b.cls && (a.cls === 1 ? a.worth > SHADOW.HOLD * b.worth : a.light < b.light)));

  // The frame's part: the casting lights chosen, their views placed, what is to be looked at found. frame: the
  // frame's view; f: RN4's record; lights: the lit set; stamped: the last tick anything of the world that may stand
  // in a static cell was stamped at (its rows: no person's — people are movers —, no light's — a cell's own light is
  // its own matter)
  X.place = (frame, f, lights, stamped) => {
    const Lt = world.lights, Q = world.quads, eye = frame.e.eye;
    // movers of this shot: what was placed anew since the call that began it; the movers' map is due when one of
    // them changed since the call before this
    if (mover.length < Q.cap) { const m = new Uint8Array(Q.cap); m.set(mover); mover = m; }
    const fresh = f.shot !== shot, lookedBefore = lookedAt;
    lookedAt = world.tick;
    if (fresh) { shot = f.shot; shotTick = world.tick; mover.fill(0); moversDue = true; }
    for (let q = 0; q < Q.n; q++) {
      if (!Q.cast[q]) continue;
      if (!mover[q] && since(placedAt(world, q), shotTick)) { mover[q] = 1; moversDue = true; }
      if (mover[q] && since(stampedAt(world, q), lookedBefore)) moversDue = true;
    }
    litOf(lights);
    const n = want(frame, null);
    // at a new shot: the lights wanted, in their order — nothing is held (X.ahead chose the same for the shot's view)
    if (fresh) for (let k = 0; k < slots.length; k++) {
      const s = slots[k];
      s.light = k < n ? wanted[k] : -1; s.rank = -1;
      if (k < n) { s.cls = classOf(wanted[k]); s.worth = wantedWorth[k]; }
    }
    // else a slot keeps its light while it shines, lights the view and reaches its casters; one wanted takes a free
    // slot, or the slot of a light not wanted that it is of a higher class than — or, a lamp against a lamp, worth
    // SHADOW.HOLD times more than
    else for (let k = 0; k < slots.length; k++) {
      const s = slots[k];
      if (s.light < 0) continue;
      s.cls = classOf(s.light); s.worth = worthOf(s.light, frame);
      if (!(Lt.strength[s.light] > 0) || !lit[s.light] || (s.cls === 1 && !(s.worth > 0))) s.light = -1;
    }
    for (let k = 0; k < n && !fresh; k++) {
      const i = wanted[k], cls = classOf(i);
      let take = null, has = false;
      for (let a = 0; a < slots.length; a++) if (slots[a].light === i) has = true;
      if (has) continue;
      for (let a = 0; a < slots.length && !take; a++) if (slots[a].light < 0) take = slots[a];
      if (!take) for (let a = 0; a < slots.length; a++) {
        const s = slots[a];
        let held = false;
        for (let j = 0; j < n; j++) if (wanted[j] === s.light) held = true;
        if (!held && (cls > s.cls || (cls === 1 && s.cls === 1 && wantedWorth[k] > SHADOW.HOLD * s.worth)) && (!take || s.worth < take.worth)) take = s;
      }
      if (take) { take.light = i; take.cls = cls; take.worth = wantedWorth[k]; take.rank = -1; }
    }
    // their ranks — the first SHADOW.KEYS are what receivers' pixels read; a slot at another rank, or with another
    // light, has none of its cells
    for (let a = 1; a < slots.length; a++) for (let b = a; b > 0 && before(slots[b], slots[b - 1]); b--) { const s = slots[b]; slots[b] = slots[b - 1]; slots[b - 1] = s; }
    X.casting = false;
    const gx = -frame.camera.rot[2], gz = -frame.camera.rot[8];
    for (let rank = 0; rank < slots.length; rank++) {
      const s = slots[rank];
      if (s.light < 0) { s.views = 0; s.rank = -1; s.ready = false; for (let v = 0; v < s.cells.length; v++) { const c = s.cells[v]; c.on = false; c.placed = null; } continue; }
      if (s.rank !== rank) {
        s.rank = rank; s.ready = false; moversDue = true;
        for (let v = 0; v < s.cells.length; v++) { const c = s.cells[v]; c.has = false; c.due = true; c.asked = 1; c.placed = null; c.on = false; c.stop[0] = c.stop[1] = 0; c.onto[0] = c.onto[1] = 0; }
      }
      X.casting = true;
      placeCells(s, rank, eye, gx, gz, frame);
      for (let v = 0; v < SHADOWS.VIEWS; v++) {
        const c = s.cells[v];
        if (v >= s.views) { c.on = false; c.placed = null; continue; }
        if (s.kind !== 1) c.on = true;
        // (to be looked at: never drawn for this light, its placement another, the world's rows or its light's row
        // stamped since it was last looked at — X.stale, after its cull, says whether it is to be drawn again; a
        // beam's face its cone does not meet is not looked at: it holds nothing it lights. Whether its view is ASKED
        // anew is another matter, the same for every view: render/renderer.js)
        c.look = (s.kind !== 1 || faceLit(s.light, v)) && (!c.has || c.due || since(stamped, c.lookedTick) || since(Lt.stamp[s.light], c.lookedTick) || !sameCamera(c.camera, c.drawn));
        c.now = false;
      }
    }
  };
  // a point light's faces, after their culls: those its casters are in — the quads its view's cull found, the persons
  // who cast in it. list: the frame's slots, or a shot's (X.ahead)
  X.faces = list => {
    for (let k = 0; k < list.length; k++) {
      const s = list[k];
      if (s.light < 0 || s.kind !== 1) continue;
      for (let v = 0; v < s.views; v++) {
        const c = s.cells[v];
        if (!faceLit(s.light, v)) { c.on = false; continue; }
        c.on = c.view.n > 0;
        for (let a = 0; a < casters.length && !c.on; a++) { const person = casters[a]; if (world.personCastsIn(person.index, s.light) && people.sphere(person.id, S4) && reached(s, S4) && sees(c.view.e, S4)) c.on = true; }
      }
    }
  };

  // what a static cell holds, as a number: its casters' rows, their sheets' stamps, their own shaders' values
  X.signature = c => {
    const Q = world.quads, L = c.view.e.lists.cast;
    let sig = L.n;
    for (let k = 0; k < L.n; k++) {
      const q = L.quad[k];
      sig = (((sig * 31 + q) | 0) * 31 + sheets.stamp(Q.sheet[q])) | 0;
      if (Q.own[q]) sig = (sig * 31 + world.own[Q.own[q] - 1].stamp) | 0;
    }
    return sig;
  };
  // After its cull. What the casters its view holds stop and fall on (LG11) — what stands, what moves — is kept with
  // the cell: X.write reads these numbers and no list. → whether its static cell is to be drawn again: never drawn for
  // this light, its placement another, other casters, or one of them stamped since it was drawn
  X.stale = c => {
    const Q = world.quads, view = c.view, L = view.e.lists.cast;
    c.lookedTick = world.tick;
    c.stop[0] = c.stop[1] = 0; c.onto[0] = c.onto[1] = 0;
    for (let n = 0; n < view.n; n++) {
      const q = view.list[n], m = mover[q], stop = world.elements[Q.el[q]].spec.shadow.strength * (1 - Q.sheer[q]);
      if (stop > c.stop[m]) c.stop[m] = stop;
      c.onto[m] |= Q.cast[q];
    }
    if (!c.has || !sameCamera(c.camera, c.drawn) || X.signature(c) !== c.sig) { c.due = true; return true; }
    for (let k = 0; k < L.n; k++) if (since(stampedAt(world, L.quad[k]), c.drawnTick)) { c.due = true; return true; }
    c.due = false;
    return false;
  };
  // Whether a cell looked at stands as it was drawn — drawn for this light, not due, its placement and its casters'
  // paintings what they were: then, with no row of its matter stamped (render/quads.js changes), it needs no cull —
  // X.stood(c) says it was looked at so
  X.stands = c => c.has && !c.due && sameCamera(c.camera, c.drawn) && X.signature(c) === c.sig;
  X.stood = c => { c.lookedTick = world.tick; };
  // the views to ask this tick (SH10): a cell that is to be redrawn, or whose last ask was not 0 → X.viewsDue; and
  // whether any cell is to be redrawn → X.cellsDue. (Under a cover too: a cell due is drawn when the cover lifts, and
  // its pages are to be there)
  X.due = () => {
    empty(X.viewsDue);
    X.cellsDue = false;
    for (let k = 0; k < slots.length; k++) for (let v = 0; slots[k].light >= 0 && v < slots[k].views; v++) {
      const c = slots[k].cells[v];
      if (!c.on) continue;
      if (c.due) X.cellsDue = true;
      if (c.due || c.asked !== 0) X.viewsDue.push(c);
    }
  };
  // After the asks: the static cells drawn in this call — those due whose pages are there, host.cells of them (all:
  // every one) —; each cell's movers' view placed as its static cell is, or is about to be, drawn. → whether any
  // static cell is drawn
  X.ration = all => {
    let left = all ? Infinity : host.cells, any = false;
    for (let k = 0; k < slots.length; k++) {
      const s = slots[k];
      if (s.light < 0) continue;
      const px = Math.round((s.kind === 1 ? RANK[s.rank][2] : RANK[s.rank][1]) * side / 2);
      for (let v = 0; v < s.views; v++) {
        const c = s.cells[v];
        c.now = c.on && c.due && c.asked === 0 && left > 0;
        if (c.now) { left--; any = true; moversDue = true; }
        c.placed = !c.on ? null : c.now ? c.camera : c.has ? c.drawn : null;
        if (!c.placed) continue;
        c.moves.e.place(world, c.placed, px, px);
      }
    }
    return any;
  };
  // The people's part, after people.show: whoever of those who cast has another version than the movers' map was
  // drawn with; particles that cast in the air (stirring: they are drawn into the far lights' movers' maps, which
  // stop their light — X.write). → X.moversDue
  X.judge = stirring => {
    for (let k = 0; k < casters.length; k++) if (versions.get(casters[k].id) !== people.version(casters[k].id)) moversDue = true;
    smoke = stirring;
    if (stirring) moversDue = true;
    X.moversDue = moversDue && X.casting;
  };
  // a static cell drawn: kept as it was drawn
  X.drew = c => { c.has = true; c.due = false; c.now = false; copyCamera(c.camera, c.drawn); c.drawnTick = world.tick; c.sig = X.signature(c); };
  X.drewMovers = () => { moversDue = false; X.moversDue = false; for (let k = 0; k < casters.length; k++) versions.set(casters[k].id, people.version(casters[k].id)); };
  // the persons who cast in a slot's light, drawn into its movers' cell (PP10: one by one; counters: RENDER's tally)
  X.drawPeople = (pass, s, c, counters) => {
    let any = false;
    for (let k = 0; k < casters.length; k++) if (world.personCastsIn(casters[k].index, s.light) && people.draw(pass, 'depth', c.moves.e.sees, casters[k].id, false, counters)) any = true;
    return any;
  };

  // what each slot's maps stop and fall on (LG11): what its cells keep of the casters their views hold, the persons
  // who cast in it, and — a far light's — the particles that cast; a slot whose cells are all drawn for its light is
  // ready — and the uniform written
  X.write = (lights, O) => {
    f32.fill(0);
    for (let k = 0; k < slots.length; k++) {
      const s = slots[k], o = k * SHADOWS.SLOT / 4;
      let whole = s.light >= 0;
      s.stop[0] = s.stop[1] = 0; s.onto[0] = s.onto[1] = 0;
      for (let v = 0; v < s.views; v++) {
        const c = s.cells[v];
        if (!c.on) continue;
        if (!c.has) whole = false;
        for (let m = 0; m < 2; m++) { if (c.stop[m] > s.stop[m]) s.stop[m] = c.stop[m]; s.onto[m] |= c.onto[m]; }
        const vo = (SHADOWS.VIEW0 + (k * SHADOWS.VIEWS + v) * SHADOWS.VIEW) / 4;
        if (!c.has) continue;
        viewProj(c.drawn, O, f32, vo);
        f32[vo + 16] = c.rect[0]; f32[vo + 17] = c.rect[1]; f32[vo + 18] = c.rect[2]; f32[vo + 19] = c.texel;
      }
      for (let a = 0; s.light >= 0 && a < casters.length; a++) { const person = casters[a]; if (world.personCastsIn(person.index, s.light)) { if (person.strength > s.stop[1]) s.stop[1] = person.strength; s.onto[1] |= person.onto; } }
      // (particles that cast: in the movers' maps of the far lights, their strength in their coverage, onto the ground)
      if (s.light >= 0 && s.kind === 0 && smoke) { s.stop[1] = 1; s.onto[1] |= RECV.GROUND; }
      if (whole) s.ready = true;
      i32[o] = s.ready ? lights.rowOf[s.light] : -1; u32[o + 1] = s.kind; u32[o + 2] = s.views; u32[o + 3] = 0;
      f32[o + 4] = s.stop[0]; f32[o + 5] = s.stop[1];
      u32[o + 8] = s.onto[0] >>> 0; u32[o + 9] = s.onto[1] >>> 0;
    }
    const b = SHADOWS.BLOB / 4;
    f32[b] = blobTo[0] - O[0]; f32[b + 1] = blobTo[1] - O[2]; f32[b + 2] = blobTo[2]; f32[b + 3] = blobTo[3] - O[1];
    f32[b + 4] = 1 / side; f32[b + 5] = 2 / side;
    gpu.write(uniform, 0, data);
  };
  // a casting view's uniform (after its ask: SHEETS' bias of the cell's view is in both): a static cell's; its movers'
  X.writeView = (c, O) => c.view.e.write(O, VIEWU.CAST, null, 0, c.light, c.view.drawn);
  X.writeMoves = (c, O) => c.moves.e.write(O, VIEWU.CAST, null, 0, c.light, c.view.drawn);
  // the place of a view's cell in an atlas, px: (x, y, side) — the static atlas's, or (half) the movers'
  X.cellPx = (c, half) => { const k = half ? side / 2 : side; at3[0] = Math.round(c.rect[0] * k); at3[1] = Math.round(c.rect[1] * k); at3[2] = Math.round(c.rect[2] * k); return at3; };

  // A shot's shadow views (SH10, 2.3 step 4): the lights that would cast in its view, chosen anew — as the frame of
  // its cut chooses them —, their views placed with its swaps and overrides. state: what R keeps of the shot
  // ({ shadow }: made here); view: the shot's own; lights: the lit set. → state.shadow.slots, each { light, kind,
  // views, cells: [{ view, on }] } — `on`: the view is asked (a point light's faces: X.faces, after their culls)
  X.ahead = (state, view, ahead, lights) => {
    const S = state.shadow || (state.shadow = { slots: Array.from({ length: SHADOW.LIGHTS }, () => slotOf(false)) });
    if (lit.length < world.lights.cap) lit = new Uint8Array(world.lights.cap);
    lights.litIn(view, lit);
    const n = want(view, ahead), cam = view.camera;
    for (let k = 0; k < SHADOW.LIGHTS; k++) {
      const s = S.slots[k];
      s.light = k < n ? wanted[k] : -1;
      if (s.light < 0) { s.views = 0; continue; }
      placeCells(s, k, cam.eye, -cam.rot[2], -cam.rot[8], view);
      if (s.kind !== 1) for (let v = 0; v < s.views; v++) s.cells[v].on = true;
    }
    return S.slots;
  };

  // The blob map: the capsules of the people shown near the eye — after people.show. → X.blobDue: what would be drawn
  // — who, as they are, into which square of the level — is another than what was; X.blobRect: that square (the
  // world's), or null
  X.blobs = (frame, O) => {
    capN = 0;
    let sig = world.originStamp | 0;
    if (people) {
      // (the capsules' bounds, the lowest feet of all and of one person: kept in an array as the loops widen them —
      // 5.16)
      const eye = frame.e.eye, B = bounds;
      B[0] = Infinity; B[1] = Infinity; B[2] = -Infinity; B[3] = -Infinity; B[4] = Infinity;
      for (let k = 0; k < people.list.length; k++) {
        const p = people.list[k];
        if (!people.sphere(p.id, S4) || Math.sqrt((S4[0] - eye[0]) ** 2 + (S4[2] - eye[2]) ** 2) > BLOB_REACH) continue;
        const caps = people.capsules(p.id);
        if (!caps) continue;
        B[5] = Infinity;
        for (let c = 0; c < caps.n; c++) B[5] = Math.min(B[5], caps.data[7 * c + 1] - caps.data[7 * c + 6], caps.data[7 * c + 4] - caps.data[7 * c + 6]);
        const feet = B[5];
        for (let c = 0; c < caps.n && capN < CAPSULES; c++) {
          const d = caps.data, o = 7 * c, w = 8 * capN++;
          capData[w] = d[o] - O[0]; capData[w + 1] = d[o + 1] - feet; capData[w + 2] = d[o + 2] - O[2]; capData[w + 3] = d[o + 6];
          capData[w + 4] = d[o + 3] - O[0]; capData[w + 5] = d[o + 4] - feet; capData[w + 6] = d[o + 5] - O[2]; capData[w + 7] = 0;
          B[0] = Math.min(B[0], d[o], d[o + 3]); B[2] = Math.max(B[2], d[o], d[o + 3]); B[1] = Math.min(B[1], d[o + 2], d[o + 5]); B[3] = Math.max(B[3], d[o + 2], d[o + 5]);
        }
        B[4] = Math.min(B[4], feet);
        sig = (((sig * 31 + p.index) | 0) * 31 + people.version(p.id)) | 0;
      }
      const x0 = B[0], z0 = B[1], x1 = B[2], z1 = B[3], floor = B[4];
      if (capN) {
        const s = Math.max(BLOB_LEAST, x1 - x0 + 2, z1 - z0 + 2);
        blobTo[0] = 0.5 * (x0 + x1 - s); blobTo[1] = 0.5 * (z0 + z1 - s); blobTo[2] = 1 / s; blobTo[3] = floor;
        blobRect[0] = blobTo[0]; blobRect[1] = blobTo[1]; blobRect[2] = blobTo[0] + s; blobRect[3] = blobTo[1] + s;
      }
    }
    if (!capN) blobTo.fill(0);
    for (let k = 0; k < 4; k++) sig = (sig * 31 + blobBits[k]) | 0;
    blobSig = (sig * 31 + capN) | 0;
    X.blobDue = blobSig !== blobDrawn;
    X.blobRect = capN ? blobRect : null;
  };
  // the blob pass's draw (its target cleared by the pass): what it drew is kept as drawn
  X.drawBlob = (pass, O) => {
    blobDrawn = blobSig;
    if (!capN) return;
    light4[0] = blobTo[0] - O[0]; light4[1] = blobTo[1] - O[2]; light4[2] = blobTo[2]; light4[3] = 0;
    gpu.write(blobU, 0, light4);
    gpu.write(capsules, 0, capData, 0, 8 * capN);
    pass.setPipeline(blobPipe); pass.setBindGroup(0, blobGroup); pass.setVertexBuffer(0, capsules); pass.draw(4, capN);
  };
  return X;
}
