// People in a scene: an element with "person" is someone standing in it — a figure of shapes (shapes.js) whose root
// is their row of the world's nodes, moved by motions Kimodo made (player.js), lit by the scene's light as all of it
// is. Who they are and how they move is the world's: its cast (a module the element names — its data: the motions,
// the characters, the styles…) over what the engine has. How they move is the scene's state — where they stand (the
// element's place, as any element's), and keys of their own: <id>_do, _turn, _look, _reach, _with, _wear, _gait, _steps,
// _on, _here, _still, _mood, _reflected (people.md).
//   Twice a tick (contracts PP1–PP11). Once every step, seen or unseen, SCENE calls frame: the player of everyone
// here is moved and they are posed — placed upright where SCENE's placing has them (or where they are held), their
// points, box, sphere and capsules made, the same arrays every step; nothing of the GPU. Who is not here costs nothing
// a step (their player stands; what they wear and have with them is still built in the background) and comes back as
// a new shot sets them. Once in every drawn frame
// RENDER calls show: who of those here is in a view gets their bones (the joints' rows, the tubes' chains, the cloth's
// step — at rest when they were not shown the frame before, across a new shot, after LATE of their own time), written
// once; a look put on or parts taken since their last step are posed there first.
//   A look is a model (shapes.js, held in figure.js: shared by everyone who looks so); what they wear (<id>_wear) and
// have with them (<id>_with) is built in the background, a slice a task, never in a tick — the old figure drawn till
// the new is whole; a shot made ready ahead has its looks and parts built and held (prepare).
//   createPeople(persons, { cast, anchor, ground, inside, point, frame, moves, placed, gpu, lib, built, warn }) → People (PP1):
//     reads(values), frame(t, values, shot, stands — (id) → whether they stand with the story: a cut waits, 2.4), root(id, out), settle(id), prepare(values), unprepare(values), ended(),
//     building(), point(id, name, out), pointFor(values, id, name, out), box(id, out), height(id), pick(origin, way),
//     mark(id, bits), startOf(…),
//     durationOf(…), speedOf(…), list, save(), restore(data), dispose(), show(seen), shown(), version(id), sphere(id, out),
//     capsules(id), reflected(id), draw(pass, kind, inView, id, mirrored, counters), inks
//   persons — [{ id, index, node, o, inside }] (inside: marked so — in a room wherever they stand); cast — the scene's
//   modules (a person's `person.cast` names one);
//   anchor(id, out, values?) — where SCENE's placing puts that person now (world metres: their place keys, through
//   what carries them), read every step — never their node's row, which holds their root; with `values`: where it
//   would put them under those values (a cut to them: pointFor); ground(id, p) → the height of
//   what that person stands on under p (x, _, z); inside(by, p) — whether one standing at p, carried by element `by`
//   (null: none), is in a room (what carries them, or the walk plane under them, is `inside`); point(ref, out, get?) — a point of the world ([x, y, z]); frame(id,
//   out, get?) — what an element carries is placed in (12 numbers, as a node's row: its axes and its anchor) — both now,
//   or as `get` (key → value) would have things (pointFor: the values over the state); moves(id) — the state keys
//   that move an element (its place's and those of what carries it); placed(id) — whether that person was put where
//   they are at once this step (a key of their place, or of what carries them, set, not moved): SCENE's, every one
//   always given; lib — the renderer's library of pipelines (lib.person); built() — called whenever a build in the
//   background ends
import { turn, empty, framedPoint, LATE, FLAG } from '../base.js';
import { AT } from './rig.js';
import { Player, POINTS, pointOf, loadPlayer, library, prepared, carrierFrame, turnedFrame } from './player.js';
import * as wardrobe from './wardrobe.js';
import { PERSON, PERSON_KINDS } from './person.wgsl.js';
import { createModel } from './shapes.js';
import { storeOf, modelOf, letGo, partOf, worn, taken, carry, upload, block, unblock, header, palette, coloured, linear } from './figure.js';

const SEATED = 0.14;   // how high a pelvis sits over a seat (metres, a man's 1.76 m)
const ROOM = 0.6;      // how far past their joints what they wear and hold may go (metres, a man's)
const REACHED = 0.97;  // how much of an arm's length a hand held in another's is out at most (the elbow a little bent)
const SLOTS = 255;     // the most people a scene's ids tell apart
const CARRIED = 4;     // how many deep one carried by another is followed when posed ahead (pointFor)
// the capsules round them: from a joint to a joint, how thick (metres, a man's) — what is picked, what the camera keeps
// clear, what casts their contact shadow
const LIMBS = [['Hips', 'Spine2', 0.17], ['Spine2', 'Neck1', 0.2], ['Neck1', 'Head', 0.07], ['Head', 'HeadEnd', 0.11], ...['Left', 'Right'].flatMap(s => [
  [`${s}Arm`, `${s}ForeArm`, 0.06], [`${s}ForeArm`, `${s}Hand`, 0.05], [`${s}Leg`, `${s}Shin`, 0.08], [`${s}Shin`, `${s}Foot`, 0.06], [`${s}Foot`, `${s}ToeBase`, 0.05]])]
  .map(([a, b, r]) => [AT[a], AT[b], r]);
const REACHES = ['r', 'l', 'foot_r', 'foot_l'];
// (the keys of theirs that say how they stand and move: values that name one of them — or a key of their place —
// touch them: pointFor)
const TOLD = ['do', 'turn', 'on', 'here', 'still', 'gait', 'steps', 'look', 'reach'];
// (their points' names and what each is — as its numbers: player.js's pointOf —, gone through each step)
const POINT_NAMES = Object.keys(POINTS), POINT_SPECS = POINT_NAMES.map(n => pointOf(POINTS[n]));
// (what they have with them not yet seen: anything is new to it)
const UNSEEN = {};
// (no cast: the engine's own tables — one object, so that everyone without a cast shares their models)
const NO_CAST = Object.freeze({});
// (a place given as numbers: [across, distance] or [across, distance, elevation])
const numbers = v => { if (v.length < 2) return false; for (let i = 0; i < v.length; i++) if (!Number.isFinite(v[i])) return false; return true; };
// (what they wear as a key: `wear`'s fields as text, '' none; what they have with them as names)
const wearKey = wear => (wear && typeof wear === 'object' ? JSON.stringify(wear) : '');
const withNames = w => (Array.isArray(w) ? w.filter(n => typeof n === 'string') : typeof w === 'string' && w ? [w] : []);
// a cast's own failing — its tables, the draws of its parts, run as a look's model or a part is made: the author's to
// hear of (the look, the part not made). Anything else thrown in a build is the engine's fault: the look, the part is
// not made all the same, and the fault is thrown on
class Miscast extends Error {}
const casts = make => { try { return make(); } catch (err) { throw new Miscast(err?.message || String(err)); } };

// what a world's cast reaches of the figures of shapes, as it always did: MooodShapes — their vectors (V), our tables
// (a cast's part drawing ours: MooodShapes.PARTS.scarf.draw(F))
const { look: shapesLook, tablesOf, bodyOf, V, STYLES, CHARACTERS, GARMENTS, HAIR, HATS, FACES, PARTS, PAINTS, GROUNDS, ARMS, LEGS, BODY } = wardrobe;
globalThis.MooodShapes ??= Object.freeze({ look: shapesLook, tablesOf, bodyOf, V, STYLES, CHARACTERS, GARMENTS, HAIR, HATS, FACES, PARTS, PAINTS, GROUNDS, ARMS, LEGS, BODY });

export async function createPeople(persons, { cast, anchor, ground, inside, point, frame, moves, placed, gpu, lib, built, warn }) {
  const soma = await loadPlayer();
  const S = storeOf(gpu), list = [], byId = new Map();
  // the outline's table: each person's ink (linear rgb; the fourth spare), by their slot (PP11)
  const inkData = new Float32Array(256 * 4), inks = gpu.buffer('inks', inkData.byteLength, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
  gpu.write(inks, 0, inkData);
  let gone = false;

  // ── what is built in the background: one piece of work a task (a look's model, a part's), in the order asked. A
  // job counts as done whatever it threw (2.4): everyone is brought on and SCENE told all the same. A job that throws
  // is the engine's fault: it ends this run, unhandled — the thread reports it — and the jobs left go on in a run of
  // their own ──
  const jobs = [];
  let working = false;
  const work = async () => {
    if (working) return;
    working = true;
    try {
      while (jobs.length && !gone) {
        await turn();
        if (gone) break;
        try { jobs.shift()(); } finally {
          for (let i = 0; i < list.length; i++) advance(list[i]);
          built();
        }
      }
    } finally {
      working = false;
      if (jobs.length && !gone) work();
    }
  };
  // a person's look for what they wear over their own (`wear`'s fields: a foot bare, a hat off; a whole other look, the
  // boy years later) — a figure of shapes: a person as a body is not built in engine 3
  const lookOf = (H, wear) => {
    const L = { ...H.L0, ...(wear || {}) };
    if (L.kind != null && L.kind !== 'shapes') H.warn(`"kind": "${L.kind}" — a person as a body is not built in engine 3: drawn as a figure of shapes`);
    return shapesLook(L, H.cast);
  };
  // (a look made: its model held, the person's own of it, their rows — the cast's own run in it thrown as a Miscast)
  const made = (H, E) => {
    const look = casts(() => lookOf(H, E.wear));
    E.W = worn(S, modelOf(S, look, H.cast === NO_CAST ? null : H.cast, () => casts(() => createModel(look, { rig: soma, warn: H.warn }))));
  };
  // their look for a `wear` (by its key), asked for the first time it is named: built in the background
  const entryOf = (H, key, wear) => {
    let E = H.looks.get(key);
    if (!E) {
      H.looks.set(key, E = { key, wear, W: null, holds: 0, dead: false, failed: false });
      jobs.push(() => {
        if (E.dead) return;
        // (a look that cannot be made has failed, whoever's fault: the cast's is said, the engine's thrown on)
        try { made(H, E); } catch (err) { E.failed = true; if (!(err instanceof Miscast)) throw err; H.warn(`"wear": ${err.message}`); }
      });
      work();
    }
    return E;
  };
  // (a look nobody wears, wants or holds — or one that failed: let go — its rows, its model's hold; dead from now on:
  // a shot that still holds it lets nothing go again, and a look made anew by its key is another entry)
  const dropped = (H, E) => {
    E.dead = true;
    if (H.looks.get(E.key) === E) H.looks.delete(E.key);
    if (E.W) { taken(S, E.W); letGo(S, E.W.G); E.W = null; }
  };
  // whether a look's model has every one of these parts made — those it has not are asked for (each once)
  const partsReady = (E, names) => {
    const G = E.W.G;
    let all = true;
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      if (G.parts.has(name)) continue;
      all = false;
      if (!G.asked.has(name)) ask(G, name);
    }
    return all;
  };
  // (a part of a model asked of the background — a function of its own: partsReady, asked every tick a shot is made
  // ready in, makes nothing)
  const ask = (G, name) => {
    G.asked.add(name);
    jobs.push(() => {
      G.asked.delete(name);
      if (G.holds <= 0 || G.parts.has(name)) return;
      // (a part that cannot be made is none, not asked again, whoever's fault: the cast's — its drawing — is said, the
      // engine's thrown on)
      try { partOf(S, G, name, casts(() => G.model.part(name))); } catch (err) {
        partOf(S, G, name, null);
        if (!(err instanceof Miscast)) throw err;
        warn(`people: "with": "${name}": ${err.message}`);
      }
    });
    work();
  };
  // dressed: in a look made, whole
  const dress = (H, E) => {
    const was = H.entry, M = E.W.G.model;
    H.entry = E; H.dressed = E.key;
    H.player.rig = soma; H.player.fit = M.fit; H.player.size = M.height / 1.76;
    H.own = M.look.parts ? [...M.look.parts] : [];
    H.carrying = true; H.painted = -1; H.inked = false; H.live = false; H.unposed = true; H.version++;
    if (was && was !== E && !was.holds) dropped(H, was);
  };
  // the parts they have with them now, taken (all made): their meshes, their points
  const take = H => {
    const W = H.entry.W, pts = W.G.model.partPoints([...H.own, ...H.with]);
    H.carrying = false; H.unposed = true;
    carry(S, W, H.with);
    for (const n of H.partNames) if (!(n in pts) && !POINTS[n]) delete H.points[n];
    H.partNames = Object.keys(pts); H.partMarks = H.partNames.map(n => pts[n].mark ?? null); H.partSpecs = H.partNames.map(n => (pts[n].mark === undefined ? pointOf(pts[n]) : null));
    for (const n of H.partNames) H.points[n] ??= new Float64Array(3);
    H.version++;
  };
  // what they are to wear and have with them, as far as it is made: a new look put on once it and the parts they
  // have with them are whole (the old figure drawn till then); else the parts taken once all are made
  const advance = H => {
    if (H.want !== H.dressed) {
      const E = H.looks.get(H.want);
      if (E?.failed) { dropped(H, E); H.want = H.dressed; }
      else if (E?.W && partsReady(E, H.with)) dress(H, E);
      else return;
    }
    if (H.carrying && partsReady(H.entry, H.with)) take(H);
  };

  // ("id#name" read once: the id, the name — null if there is no #)
  const refs = new Map();
  const refOf = v => {
    let r = refs.get(v);
    if (!r) { const hash = v.indexOf('#'); refs.set(v, r = { id: hash < 0 ? v : v.slice(0, hash), name: hash < 0 ? null : v.slice(hash + 1) }); }
    return r;
  };
  // (the point an `on` names — "mother#hands", {at, up}, "cart#bed" — or null: a seat, on their feet)
  const onAt = on => (typeof on === 'string' ? on : on && typeof on === 'object' && typeof on.at === 'string' ? on.at : null);
  // (the element a point is read from — an element's point, one in an element's own frame — not a person's: null)
  const owner = ref => (framedPoint(ref) ? (byId.has(ref.on) ? null : ref.on) : typeof ref === 'string' && ref && !byId.has(refOf(ref).id) ? refOf(ref).id : null);

  // (all of theirs let go: their looks — the rows, the models' holds —, their blocks, the inks)
  const dispose = () => {
    gone = true;
    empty(jobs);
    for (const H of list) {
      for (const E of [...H.looks.values()]) dropped(H, E);
      unblock(S, H.block);
    }
    gpu.drop(inks);
  };

  // ── everyone made: their figure, a slice each (one that cannot be made fails the build: what was made is let go) ──
  const making = async () => {
    for (const person of persons) {
      const o = person.o, id = String(person.id), p = o.person && typeof o.person === 'object' ? o.person : {};
      if (list.length >= SLOTS) { warn(`${id}: more than ${SLOTS} people — not drawn`); continue; }
      const c = p.cast == null ? NO_CAST : cast[p.cast];
      if (p.cast != null && !c) warn(`${id}: "cast": no module ${p.cast} among the scene's modules`);
      const said = new Set();
      const H = { id, index: person.index, node: person.node, o, p, cast: c ?? NO_CAST, marked: !!person.inside, inside: !!person.inside, slot: list.length + 1, block: block(S),
        made: `${p.cast == null ? '' : p.cast}\n${JSON.stringify(o.person)}`, shot: undefined,
        warn: text => { if (!said.has(text)) { said.add(text); warn(`${o.name || id}: ${text}`); } },
        keys: Object.fromEntries(['do', 'turn', 'look', 'reach', 'with', 'wear', 'gait', 'steps', 'on', 'here', 'still', 'mood', 'reflected'].map(k => [k, `${id}_${k}`])),
        // (the keys that touch how they stand: theirs, their place's, and those that move what they stand "on"; the acts
        // made for the shots that frame them posed ahead, by what each has them do — pointFor)
        told: [...TOLD.map(k => `${id}_${k}`), ...(o.place && typeof o.place === 'object' ? Object.values(o.place).filter(v => typeof v === 'string') : []), ...(o.on != null ? moves(String(o.on)) : [])], cutActs: new Map(),
        // what the player is told each step (the same object)
        k: { do: null, turn: null, look: null, reach: { r: null, l: null, foot_r: null, foot_l: null }, refs: { r: null, l: null, foot_r: null, foot_l: null },
          gait: null, steps: true, held: false, floor: null, still: false, by: null, frame: null, placed: false },
        aims: { look: new Float64Array(3), r: new Float64Array(3), l: new Float64Array(3), foot_r: new Float64Array(3), foot_l: new Float64Array(3) },
        place: new Float64Array(3), at: new Float64Array(4), W: new Float64Array(12), held: { at: '', up: 0, seat: null, in: null, by: null, thing: null }, frame: new Float64Array(13), carrier: new Float64Array(12),
        points: {}, partNames: [], partMarks: [], partSpecs: [], box: new Float32Array(4), sphere: new Float64Array(4), capsules: { n: LIMBS.length, data: new Float64Array(7 * LIMBS.length) },
        hands: { r: `${id}#hand_r`, l: `${id}#hand_l` }, onRef: UNSEEN, carried: false, ground: null, read: [UNSEEN, UNSEEN, UNSEEN],
        // their looks by what they wear (each: its key, its `wear`, the wearing once made, who holds it ready); the one
        // they are dressed in, the one they are to wear; the parts of their look, those they have with them, whether
        // those are still to be taken
        looks: new Map(), entry: null, dressed: null, want: '', wearRef: undefined, L0: null, own: [], with: [], withRef: UNSEEN, carrying: true,
        // here: in the scene now; shown: in a view at the last show; live: shown at the last show, a step ago at the most
        // (else what swings is at rest, their cloth put on); steps: frames since their last show; cut: set as a cut sets
        // them since their last show (their cloth put on at rest there); unposed: a look put on or parts taken since
        // their last step (posed at their next show, if no step comes before it)
        // reflected: drawn in mirrors (<id>_reflected not false), as the last step read it
        here: true, reflected: true, shown: false, live: false, resting: true, steps: 0, shownAt: 0, cut: false, unposed: true, byShown: undefined, floor: -1e9,
        // version: one more whenever what is drawn of them changed (PP8); showed: the one their last show saw
        version: 0, showed: -1, marks: 0, painted: -1, inked: false };
      // (what they stand on — the land, a bridge, a deck that heels under them: SCENE's, where they are)
      H.ground = q => { q[1] = ground(id, q); };
      H.L0 = { ...(H.cast.characters?.[p.who] ?? {}), ...(p.look || {}) };
      H.player = new Player({ rig: soma, fit: null, motions: H.cast.motions ?? {}, does: p.does ?? H.cast.does ?? 'stand', gait: p.gait ?? H.cast.gait ?? 'walk',
        gaits: p.gaits ?? H.cast.gaits ?? null, turn: p.turn ?? 180, warn: H.warn });
      H.arms = H.player.arms;
      for (const n of POINT_NAMES) H.points[n] = new Float64Array(3);
      const E = { key: '', wear: null, W: null, holds: 0, dead: false, failed: false };
      H.looks.set('', E);
      list.push(H); byId.set(id, H);
      // (a cast's fault in their first look fails the show — there is no older figure to keep —, said with whose)
      try { made(H, E); } catch (err) { throw err instanceof Miscast ? new Error(`${o.name || id}: "look": ${err.message}`) : err; }
      dress(H, E);
      await turn();
    }
    // their motions made ready (some 10 ms each: what a tick must never do the first time one is done) — the casts',
    // and the engine's own, every one (a state key may name any of them later); a slice each
    {
      const motions = new Set(Object.values(library));
      for (const H of list) for (const n in H.cast.motions ?? {}) motions.add(H.cast.motions[n]);
      for (const m of motions) { prepared(m); await turn(); }
    }
  };
  try { await making(); } catch (err) { dispose(); throw err; }

  // ── what they aim at ─────────────────────────────────────────────────
  // a point of the world (world metres) a person looks at or reaches for: an element's id (a person's head; an element's
  // point), "id#name" (a point it names), [across, distance, elevation], or {on: id, at: [across, distance, elevation]}
  // (in that element's own frame, going and turning with it; in a person's — theirs too —: where they stand, turned as
  // they face) — into out; false if there is none (yet). get: as those values would have the world's things (a person
  // posed ahead: pointFor; none — now)
  const aim = (v, who, out, get) => {
    if (Array.isArray(v) || (v && typeof v === 'object')) {
      // (in the frame of one not here, or not posed yet — before their first step: nowhere, nothing to say)
      if (framedPoint(v) && byId.has(v.on)) { const P = byId.get(v.on); if (!P.here || !P.player.posed) return false; }
      if (point(v, out, get)) return true;
      who.warn(framedPoint(v) ? `aims at a point on "${v.on}" — there is no such element or person` : 'aims at [across, distance, elevation] (metres), or {"on": id, "at": [across, distance, elevation]}');
      return false;
    }
    if (typeof v !== 'string' || !v) return false;
    const { id, name: named } = refOf(v), name = named ?? 'head', P = byId.get(id);
    if (P) {
      // (not here, or not posed yet — before their first step — none of their points is anywhere: nothing to say)
      if (!P.here || !P.player.posed) return false;
      const q = P.points[name];
      // (a point of a part they are still to take: there once it is made and they are posed with it)
      if (!q && (P.carrying || P.want !== P.dressed)) return false;
      if (!q) { who.warn(`${id} has no point "${name}" (${Object.keys(POINTS).join(', ')} — and those of the parts they have with them now: a part put away takes its points with it)`); return false; }
      out[0] = q[0]; out[1] = q[1]; out[2] = q[2];
      return true;
    }
    return point(v, out, get);
  };
  // Hand in hand: a hand reaching for another's hand ("guide#hand_r") that reaches back for it ("led#hand_l") — the two
  // meet between, where each one's motion has it: halfway, or, where one of them cannot reach so far, the nearest to it
  // that both arms reach — the hands raised to each other; false if it is not so
  const meet = new Float64Array(6);
  // (the point nearest p that an arm (A) reaches — into meet at o)
  const within = (A, p, o) => {
    const dx = p[0] - A.shoulder[0], dy = p[1] - A.shoulder[1], dz = p[2] - A.shoulder[2], l = Math.sqrt(dx * dx + dy * dy + dz * dz), r = REACHED * A.length[0], k = l <= r ? 1 : r / l;
    meet[o] = A.shoulder[0] + dx * k; meet[o + 1] = A.shoulder[1] + dy * k; meet[o + 2] = A.shoulder[2] + dz * k;
  };
  const handInHand = (H, h, ref, read, out) => {
    if ((h !== 'r' && h !== 'l') || typeof ref !== 'string') return false;
    const { id, name } = refOf(ref), other = byId.get(id);
    if (!other || !other.here || (name !== 'hand_r' && name !== 'hand_l')) return false;
    const back = read(other.keys.reach);
    if (!back || back[name === 'hand_r' ? 'r' : 'l'] !== H.hands[h]) return false;
    const A = H.arms[h === 'r' ? 0 : 1], B = other.player.arms[name === 'hand_r' ? 0 : 1];
    if (!A.length[0] || !B.length[0]) return false;
    // (from halfway, brought each time to what both arms reach: the mean of the nearest points within each one's reach —
    // the same for both of them, whichever asks)
    for (let c = 0; c < 3; c++) out[c] = (A.hand[c] + B.hand[c]) / 2;
    for (let i = 0; i < 24; i++) { within(A, out, 0); within(B, out, 3); for (let c = 0; c < 3; c++) out[c] = (meet[c] + meet[3 + c]) / 2; }
    return true;
  };
  // a person on another's arms ("mother#hands" — a point of the other's, the hands by default; or {at, up}: that much
  // higher — lower, below 0 — than it), sat on a seat (a point of the world — [across, distance, elevation], over the
  // land there as every such point: the hips over it as high as a pelvis sits; {on, at}: one in an element's own frame
  // — a seat in a carriage), or on a thing (an element's point: their floor there, their hips over it): into H.held;
  // false if on their feet
  const heldBy = (H, on) => {
    const h = H.held;
    h.seat = null; h.in = null; h.by = null; h.thing = null;
    if (typeof on === 'string' && on) { h.at = on; h.up = 0; }
    else if (Array.isArray(on)) { if (!(numbers(on))) return false; h.seat = on; }
    else if (framedPoint(on)) {
      // (a person carries no one in their own frame: on their arms — a point of theirs — is how)
      if (byId.has(on.on)) { H.warn(`"_on": {"on": "${on.on}", …} — a person carries no one in their frame: on their arms is "${on.on}#hands" (or {"at": "${on.on}#hands", "up": …})`); return false; }
      h.seat = on.at; h.in = on;
    }
    else if (on && typeof on === 'object' && typeof on.at === 'string') { h.at = on.at; h.up = Number(on.up) || 0; }
    else return false;
    if (!h.seat) { const who = refOf(h.at).id; h.by = byId.get(who) ?? null; h.thing = h.by ? null : who; }
    return true;
  };
  // where they stand (into H.at): on another's arms, their hips at the point; sat on a seat, their hips over it as high
  // as a pelvis sits; on a thing, their floor at its point and their hips over it (as they were posed last). get: as
  // those values would have the world (pointFor) — on the arms of one posed ahead (byThen): at that one's point then
  const hold = (H, q, get) => {
    const P = H.player, h = H.held, hips = H.points.hips, tall = H.entry.W.G.model.height;
    const ox = P.posed ? hips[0] - P.at[0] : 0, oy = P.posed ? hips[1] - P.at[1] : 0.5 * tall, oz = P.posed ? hips[2] - P.at[2] : 0;
    if (h.seat) {
      if (!point(h.in ?? h.seat, q, get)) return false;
      H.at[0] = q[0] - ox; H.at[1] = q[1] + SEATED * tall / 1.76 - oy; H.at[2] = q[2] - oz;
      return true;
    }
    if (h.by && h.by === byThen.H) { q[0] = byThen.point[0]; q[1] = byThen.point[1]; q[2] = byThen.point[2]; }
    else if (h.by) {
      if (!h.by.here || !h.by.player.posed) return false;
      const pt = h.by.points[refOf(h.at).name ?? 'hands'];
      if (!pt) return false;
      q[0] = pt[0]; q[1] = pt[1]; q[2] = pt[2];
    } else if (!aim(h.at, H, q, get)) return false;
    H.at[0] = q[0] - ox; H.at[1] = q[1] + h.up - (h.by ? oy : 0); H.at[2] = q[2] - oz;
    return true;
  };

  // ── each step ────────────────────────────────────────────────────────
  const q = new Float64Array(3), u3 = new Float64Array(3), bound = new Float64Array(6);
  // the state as it is now (frame's values) and the moment, and as a cut to `over` would have it (pointFor): a key's
  // value — two functions made once
  // (stands: who stands with the story while a cut waits — the director's `stands`, given with each frame: 2.4)
  let nowValues = null, over = null, moment = 0, stands = null;
  const nowRead = key => nowValues[key];
  const aheadRead = key => (key in over ? over[key] ?? undefined : nowValues[key]);
  // What the state says of a person, as their player takes it (H.k) — where they stand (H.at: their place, or where
  // they are held), what they do, how they are turned, what they look at and reach for, what carries them. H: the
  // person — or the people's own record of one posed ahead (pointFor: nothing of the person written); read: a key's
  // value; ahead: the values their place is asked with (none: the state's). → the land under them (null: none)
  const told = (H, read, ahead) => {
    const k = H.k, keys = H.keys, o = H.o, get = ahead ? aheadRead : undefined;
    // (their place: where SCENE's placing puts them this step — their anchor; one SCENE has no place for stays where
    // it last had them — or, below, where they are held)
    anchor(H.id, H.place, ahead);
    H.at[0] = H.place[0]; H.at[1] = H.place[1]; H.at[2] = H.place[2];
    H.here = read(keys.here) !== false;
    k.do = read(keys.do); k.gait = read(keys.gait); k.still = !!read(keys.still) || (!ahead && stands !== null && stands(H.id));
    const turned = read(keys.turn);
    k.turn = typeof turned === 'number' ? turned : null;
    k.steps = read(keys.steps);
    // (what they look at and reach for: points of the world)
    k.look = aim(read(keys.look), H, H.aims.look, get) ? H.aims.look : null;
    const reach = read(keys.reach), aims = reach && typeof reach === 'object' ? reach : null;
    for (let i = 0; i < REACHES.length; i++) {
      const h = REACHES[i], r = aims?.[h];
      k.refs[h] = r ?? null;
      k.reach[h] = r != null && (handInHand(H, h, r, read, H.aims[h]) || aim(r, H, H.aims[h], get)) ? H.aims[h] : null;
    }
    k.held = heldBy(H, read(keys.on)) && hold(H, q, get);
    // What carries them — the frame their place, their way gone and their turn are in: on another's arms, the one who
    // holds them (their turn from the way that one faces: 0 the same way, 180 facing them); on a thing, on a seat in an
    // element's frame, or standing on an element ("on" — a carriage, a deck), that one (their turn within its turn, as
    // anything on it turns: its own turn 180, the start's way, is theirs as it says); none: the world. It moving and
    // turning walks no one — only their own place in it does
    const h = H.held, F = H.frame;
    k.by = null; k.frame = null;
    if (k.held && h.by) {
      // (one posed ahead: where they are then, how they face)
      if (h.by === byThen.H) turnedFrame(byThen.at[0], byThen.at[1], byThen.at[2], byThen.facing, F);
      else { const B = h.by.player; turnedFrame(B.at[0], B.at[1], B.at[2], B.facing, F); }
      k.turn ??= 0; k.by = h.by.id; k.frame = F;
    } else {
      // (its frame — as a node's row: its axes and its anchor — as the player takes it: the same, its axes of length 1,
      // and its turn about the vertical, its +z levelled — a deck heeling carries them with it, none of it their steps)
      const by = k.held && h.thing ? h.thing : k.held && h.in ? h.in.on : o.on ?? null, C = H.carrier;
      if (by != null && frame(by, C, get)) { carrierFrame(C, F); k.by = by; k.frame = F; }
    }
    // (held: no steps, not on the land — sat on a seat, the floor under it: their own elevation, their place's)
    if (k.held) {
      k.steps = false;
      const pe = o.place?.elevation, pv = typeof pe === 'string' ? read(pe) : null;
      k.floor = h.seat ? (typeof pv === 'number' ? pv : o.elevation ?? 0) : null;
    } else k.floor = null;
    return k.held && !h.seat ? null : H.ground;
  };
  const step = (H, t, values, shot) => {
    // (not here — frame's H.here: nothing of them worked out, their player not moved; they come back as a new shot sets
    // them, from the state as it is then — what they do, where they stand, how they face —, their clock gone on)
    if (!H.here) { H.shot = NaN; H.player.shot = NaN; return; }
    const P = H.player, k = H.k, keys = H.keys, h = H.held, W = H.entry.W, M = W.G.model, I = W.I;
    const land = told(H, nowRead);
    // (a face's expression: at rest when none)
    const mood = values[keys.mood];
    I.expression = typeof mood === 'string' ? mood : null;
    // (in mirrors or not: a change is a change of what is drawn of them — the mirrors that see them drawn again)
    const reflected = values[keys.reflected] !== false;
    if (reflected !== H.reflected) { H.reflected = reflected; H.version++; }
    const cut = shot !== H.shot, was = P.clockT;
    // (put where they are at once this step — their place, or what carries them, set: no way walked)
    k.placed = placed(H.id);
    H.at[3] = t;
    P.update(H.at, k, land, shot);
    // (in a room: marked so, else as where they stand now is — carried by another, as that one is: stepped before them)
    const bearer = k.by != null ? byId.get(k.by) : null;
    H.inside = H.marked || (bearer ? bearer.inside : inside(k.by, H.at));
    H.shot = shot;
    if (cut) H.cut = true;
    // (upright where they stand, turned as they face: π − facing about the vertical — their +z the way they face)
    const e = H.W, c = Math.cos(Math.PI - P.facing), si = Math.sin(Math.PI - P.facing);
    e[0] = c; e[1] = 0; e[2] = -si; e[3] = 0; e[4] = 1; e[5] = 0; e[6] = si; e[7] = 0; e[8] = c; e[9] = H.at[0]; e[10] = H.at[1]; e[11] = H.at[2];
    // (the floor their cloth lies on, in their own space: the land under them — sat on a seat, the floor under it; on a
    // thing, their floor at its point; on another's arms, none)
    H.floor = land ? P.base + (k.held ? k.floor : 0) - H.at[1] : k.held && h.thing ? 0 : -1e9;
    // what of them follows more than one joint, placed (what swings at rest across a cut, and when they were not shown)
    where[4] = Math.max(0, P.clockT - was);
    M.pose(I, P.P, where, cut || H.resting, W.carried);
    H.unposed = false;
    // their points, box, sphere, capsules — as they are now
    for (let i = 0; i < POINT_SPECS.length; i++) P.point(POINT_SPECS[i], H.points[POINT_NAMES[i]]);
    for (let i = 0; i < H.partNames.length; i++) {
      const m = H.partMarks[i];
      // (a point a part marks where it draws it: where it is now, in their own space)
      if (m) { M.mark(m, I, P.P, u3); P.world(u3, 0, H.points[H.partNames[i]]); } else P.point(H.partSpecs[i], H.points[H.partNames[i]]);
    }
    P.box(H.box);
    const T = P.P.T, kk = M.height / 1.76;
    // (their sphere: round their joints now, with room for what hangs and what is in their hands — what the views keep
    // or leave)
    // (the bounds kept in an array as they grow: a number a loop carries and changes now and then is made on the heap
    // by the browser's first optimising compiler — 5.16)
    const B = bound;
    B[0] = B[1] = B[2] = Infinity; B[3] = B[4] = B[5] = -Infinity;
    for (let j = 0; j < T.length; j += 3) {
      B[0] = Math.min(B[0], T[j]); B[1] = Math.min(B[1], T[j + 1]); B[2] = Math.min(B[2], T[j + 2]);
      B[3] = Math.max(B[3], T[j]); B[4] = Math.max(B[4], T[j + 1]); B[5] = Math.max(B[5], T[j + 2]);
    }
    const x0 = B[0], y0 = B[1], z0 = B[2], x1 = B[3], y1 = B[4], z1 = B[5];
    u3[0] = (x0 + x1) / 2; u3[1] = (y0 + y1) / 2; u3[2] = (z0 + z1) / 2;
    P.world(u3, 0, H.sphere);
    H.sphere[3] = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0) + (z1 - z0) * (z1 - z0)) / 2 + ROOM * kk;
    const caps = H.capsules.data;
    for (let i = 0; i < LIMBS.length; i++) {
      P.world(T, LIMBS[i][0] * 3, caps, i * 7);
      P.world(T, LIMBS[i][1] * 3, caps, i * 7 + 3);
      caps[i * 7 + 6] = LIMBS[i][2] * kk;
    }
  };

  // ── picking: a ray against their capsules (the author's selection: IN6) ──
  const hit = { id: '', at: new Float64Array(3) };
  // (where along the ray it comes nearest a capsule's axis, if within its thickness: the ray's t, else Infinity)
  const capsuleHit = (o, d, C, i) => {
    const ax = C[i], ay = C[i + 1], az = C[i + 2], sx = C[i + 3] - ax, sy = C[i + 4] - ay, sz = C[i + 5] - az, r = C[i + 6];
    const wx = o[0] - ax, wy = o[1] - ay, wz = o[2] - az;
    const b = d[0] * sx + d[1] * sy + d[2] * sz, c = sx * sx + sy * sy + sz * sz, dd = d[0] * wx + d[1] * wy + d[2] * wz, e = sx * wx + sy * wy + sz * wz, den = c - b * b;
    // (the axis's nearest point to the ray, kept on the axis; the ray's nearest to that)
    const u = Math.max(0, Math.min(1, den > 1e-9 ? (e - b * dd) / den : e / (c || 1))), s = Math.max(0, b * u - dd);
    const px = o[0] + d[0] * s - (ax + sx * u), py = o[1] + d[1] * s - (ay + sy * u), pz = o[2] + d[2] * s - (az + sz * u);
    return px * px + py * py + pz * pz <= r * r ? s : Infinity;
  };

  // ── a shown frame: a person's uniform, written where it is another ──
  const head = new ArrayBuffer(PERSON.PALETTE), hf = new Float32Array(head), hu = new Uint32Array(head);
  const uniform = (H, W) => {
    const G = W.G, M = G.model, base = H.block * PERSON.BLOCK / 4, u = S.persons.u32, face = W.I.face;
    // (their colours and their ink: when they are dressed, and when a part made brought colours)
    const painted = H.painted !== M.palette.length;
    if (painted) { coloured(S, H.block, M); palette(S, H.block); H.painted = M.palette.length; }
    for (let i = PERSON.INK / 4; i < PERSON.NODE / 4; i++) hu[i] = u[base + i];
    hu[PERSON.NODE / 4] = H.node; hu[PERSON.SLOT / 4] = H.slot; hu[PERSON.BONES / 4] = W.bones; hu[PERSON.MORPHS / 4] = G.morphs;
    hu[PERSON.MARKS / 4] = H.marks; hu[PERSON.LINES / 4] = (Math.round(M.lines.width * 8) & 255) | (((M.lines.tint ? 1 : 0) | 2 | 4) << 8);
    hu[PERSON.FLAGS / 4] = (M.facets ? PERSON.FACETS : 0) | (H.inside ? PERSON.INSIDE : 0); hu[PERSON.MOODS / 4] = G.moods;
    for (let e = 0, at = PERSON.MOOD / 4; at < PERSON.PALETTE / 4; e++, at++) hf[at] = face && e < G.moods ? face.now[e + 1] : 0;
    let changed = painted;
    for (let i = 0; i < hu.length; i++) if (u[base + i] !== hu[i]) { u[base + i] = hu[i]; changed = true; }
    if (changed) header(S, H.block);
    return changed;
  };

  // (those of a draw in its view; a person's block as the dynamic offset; what a shot ahead holds, by its values)
  // (those of a new shot, set again once all are where it has them)
  const drawn = [], offset = [0], holds = new Map(), readSet = new Set(), recut = [];
  // (how many the last show showed: shown())
  let shownN = 0;
  // what a model's pose and bones are told in numbers (shapes.js: a number handed to a function is made on the heap,
  // these are written where they are): [x, y, z, turn — where they stand and how they are turned in what carries
  // them; dt — their own seconds since the step (the shown frame) before; floor — its height in their own space;
  // now — their clock]
  const where = new Float64Array(7);
  // The people's own player and record, on which a person is posed as a cut would set them (pointFor): one for all —
  // made as each person in turn is, never touching theirs — and saying nothing: what is wrong with a shot's values
  // is said when its cut sets the person (a point of a part the cut brings is not there before it)
  const unsaid = () => {};
  const ahead = { id: '', keys: null, o: null, hands: null, warn: unsaid, ground: null, entry: null, points: null, arms: null, here: true,
    player: new Player({ rig: soma, fit: null, warn: unsaid }),
    k: { do: null, turn: null, look: null, reach: { r: null, l: null, foot_r: null, foot_l: null }, refs: { r: null, l: null, foot_r: null, foot_l: null },
      gait: null, steps: true, held: false, floor: null, still: false, by: null, frame: null, placed: false },
    aims: { look: new Float64Array(3), r: new Float64Array(3), l: new Float64Array(3), foot_r: new Float64Array(3), foot_l: new Float64Array(3) },
    place: new Float64Array(3), at: new Float64Array(4), held: { at: '', up: 0, seat: null, in: null, by: null, thing: null }, frame: new Float64Array(13), carrier: new Float64Array(12) };
  const touched = (H, values) => { for (let i = 0; i < H.told.length; i++) if (H.told[i] in values) return true; return false; };
  // (what a value of `_on` has carry them: the person whose arms they are on, the element they sit or stand on, by its
  // id — or null: on their feet, or on a seat of the world)
  const carrierOf = on => { const at = onAt(on); return at != null ? refOf(at).id : framedPoint(on) ? on.on : null; };
  // whether `values` move person H — their keys, their place's, those of what they stand "on" (touched) — or what their
  // `_on`, as the values have it, puts them on: an element those values move, another person they move so (depth: how
  // many carried by another deep — a chain of people carrying people ends)
  const movedBy = (H, values, depth) => {
    if (touched(H, values)) return true;
    const id = carrierOf(H.keys.on in values ? values[H.keys.on] : nowValues[H.keys.on]);
    if (id == null) return false;
    const B = byId.get(id);
    if (B) return B !== H && depth < CARRIED && movedBy(B, values, depth + 1);
    const keys = moves(id);
    for (let i = 0; i < keys.length; i++) if (keys[i] in values) return true;
    return false;
  };
  // the one carrying the person being posed ahead on their arms, posed ahead before them (posedAhead): who — null:
  // none —, where they stand and how they face then, the point of theirs that holds them
  const byThen = { H: null, at: new Float64Array(4), facing: 0, point: new Float64Array(3) };
  // H posed on the people's own player as a cut to `values` will set them (pointFor) — its point `name` into out, their
  // root into root (if given) → false: not here under them, or no such point
  function posedAhead(H, values, name, out, root, depth) {
    // (on the arms of one the values move: that one posed so first — where they stand, how they face, their point)
    byThen.H = null;
    const at = onAt(H.keys.on in values ? values[H.keys.on] : nowValues[H.keys.on]), B = at != null ? byId.get(refOf(at).id) : null;
    if (B && B !== H && depth < CARRIED && movedBy(B, values, depth + 1)) {
      if (!posedAhead(B, values, refOf(at).name ?? 'hands', byThen.point, byThen.at, depth + 1)) return false;
      byThen.H = B; byThen.facing = ahead.player.facing;
    }
    const A = ahead, Q = A.player, k = A.k;
    A.id = H.id; A.keys = H.keys; A.o = H.o; A.hands = H.hands; A.ground = H.ground; A.entry = H.entry; A.points = H.points; A.arms = H.arms;
    Q.like(H.player);
    over = values;
    const land = told(A, aheadRead, values);
    over = null;
    byThen.H = null;
    if (!A.here) return false;
    // (what the values have them do, other than what they do: begun now — its act made once a shot, by what it says)
    const t = moment - Q.stopped;
    if (k.do !== Q.doRef || !Q.act) {
      let act = H.cutActs.get(k.do);
      if (!act) H.cutActs.set(k.do, act = Q.actOf(k.do, t));
      act.at = t;
      Q.doRef = k.do; Q.begin(act, t);
    }
    // (what each hand is told to reach for: under a cut none goes over from another)
    for (let i = 0; i < REACHES.length; i++) Q.aim.limbs[i].ref = k.reach[REACHES[i]] ? k.refs[REACHES[i]] : undefined;
    A.at[3] = moment;
    Q.update(A.at, k, land, 0);
    if (root) { root[0] = A.at[0]; root[1] = A.at[1]; root[2] = A.at[2]; root[3] = Q.facing; }
    const own = POINT_NAMES.indexOf(name);
    if (own >= 0) { Q.point(POINT_SPECS[own], out); return true; }
    const i = H.partNames.indexOf(name);
    if (i < 0) return false;
    const m = H.partMarks[i], W = H.entry.W;
    // (a point a part marks where it draws it: where it is on that pose, in their own space)
    if (m) { W.G.model.mark(m, W.I, Q.P, u3); Q.world(u3, 0, out); } else Q.point(H.partSpecs[i], out);
    return true;
  }
  // (whether a ref — a `look`'s, a `reach`'s — names a person: one of their points, or a point in their frame)
  const personal = v => (typeof v === 'string' && !!v && byId.has(refOf(v).id)) || (framedPoint(v) && byId.has(v.on));
  // (whether they read where a person is: on another's arms, looking at one, reaching for one)
  const readsPeople = (H, values) => {
    if (H.carried || personal(values[H.keys.look])) return true;
    const reach = values[H.keys.reach];
    if (reach && typeof reach === 'object') for (let i = 0; i < REACHES.length; i++) if (personal(reach[REACHES[i]])) return true;
    return false;
  };

  return {
    // (the persons, in their order: what SCENE gave of each, and their slot of the ids)
    list: list.map(H => ({ id: H.id, index: H.index, node: H.node, slot: H.slot })),
    // the outline's table (PP11)
    inks,

    // the elements whose points people read now — what they stand or sit on (their `on`: a saddle, a cart), look at,
    // reach for (an element's point, not another person's) — by id: animated before them each step (PP2). The same Set,
    // made again only when someone's `on`, `look` or `reach` is another object
    reads(values) {
      let same = true;
      for (let i = 0; i < list.length; i++) {
        const H = list[i], on = values[H.keys.on], look = values[H.keys.look], reach = values[H.keys.reach];
        if (on === H.read[0] && look === H.read[1] && reach === H.read[2]) continue;
        H.read[0] = on; H.read[1] = look; H.read[2] = reach; same = false;
      }
      if (same) return readSet;
      readSet.clear();
      const thing = ref => { const id = owner(ref); if (id != null) readSet.add(id); };
      for (let i = 0; i < list.length; i++) {
        const [on, look, reach] = list[i].read;
        thing(framedPoint(on) ? on : onAt(on));
        thing(look);
        if (reach && typeof reach === 'object') for (let h = 0; h < REACHES.length; h++) thing(reach[REACHES[h]]);
      }
      return readSet;
    },

    // every step (PP3): what they wear and have with them (asked of the background where it is not made); then
    // everyone moved — those on another's arms after the one who holds them
    frame(t, values, shot, standing = null) {
      nowValues = values; moment = t; stands = standing;
      for (let i = 0; i < list.length; i++) {
        const H = list[i], wear = values[H.keys.wear], w = values[H.keys.with];
        if (wear !== H.wearRef) {
          H.wearRef = wear;
          const key = wearKey(wear);
          if (key !== H.want) {
            const was = H.looks.get(H.want);
            H.want = key;
            entryOf(H, key, wear);
            // (the look they were to wear and never did: let go, unless a shot holds it)
            if (was && was !== H.entry && !was.holds) dropped(H, was);
          }
        }
        if (w !== H.withRef) { H.withRef = w; H.with = withNames(w); H.carrying = true; }
        if (H.carrying || H.want !== H.dressed) advance(H);
        const on = values[H.keys.on];
        if (on !== H.onRef) { H.onRef = on; const at = onAt(on); H.carried = !!at && byId.has(refOf(at).id); }
        // (what swings is at rest unless they were shown the frame before)
        H.resting = !H.live || H.steps > 0;
        H.steps++;
        // (in the scene now: who is not is not stepped — step)
        H.here = values[H.keys.here] !== false;
      }
      // (a new shot — theirs alone, set at once: settle — is whole at once: once all are where it has them, those of it
      // who read where a person is are set again, looking at and reaching for the points as they are in it — another's
      // head, a part just taken)
      empty(recut);
      for (let i = 0; i < list.length; i++) if (list[i].here && list[i].shot !== shot && readsPeople(list[i], values)) recut.push(list[i]);
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < list.length; i++) if (list[i].carried === !!pass) step(list[i], t, values, shot);
      for (let i = 0; i < recut.length; i++) { recut[i].shot = NaN; recut[i].player.shot = NaN; }
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < recut.length; i++) if (recut[i].carried === !!pass) step(recut[i], t, values, shot);
    },
    // their root's world matrix (3 × 4, as a node's row) — false while they are not here, or not posed yet
    root(id, out) {
      const H = byId.get(String(id));
      if (!H || !H.here || !H.player.posed) return false;
      for (let i = 0; i < 12; i++) out[i] = H.W[i];
      return true;
    },
    // (one person set at once as their keys have them — as a cut sets everyone, at their next step: the pose, what
    // swings and the cloth at rest — an action of theirs finished at once)
    settle(id) { const H = byId.get(String(id)); if (H) { H.shot = NaN; H.player.shot = NaN; } },

    // a shot made ready ahead (PP4): the looks and the parts its values name, built and held — true once all are
    prepare(values) {
      let held = holds.get(values);
      if (!held) {
        holds.set(values, held = []);
        for (let i = 0; i < list.length; i++) {
          const H = list[i], wears = H.keys.wear in values, has = H.keys.with in values;
          if (!wears && !has) continue;
          const wear = wears ? values[H.keys.wear] : H.wearRef, E = entryOf(H, wearKey(wear), wear);
          E.holds++;
          held.push({ H, E, names: has ? withNames(values[H.keys.with]) : null });
        }
      }
      let all = true;
      for (let i = 0; i < held.length; i++) {
        const { H, E, names } = held[i];
        if (E.failed) continue;
        if (!E.W || !partsReady(E, names ?? H.with)) all = false;
      }
      return all;
    },
    unprepare(values) {
      const held = holds.get(values);
      if (!held) return;
      holds.delete(values);
      for (const { H, E } of held) if (--E.holds <= 0 && !E.dead && E !== H.entry && E.key !== H.want) dropped(H, E);
    },
    // a shot ended (cut to, or cancelled): the acts made to pose people as a cut would are let go (pointFor: those of
    // a shot that still lives are made again as it next asks)
    ended() { for (let i = 0; i < list.length; i++) list[i].cutActs.clear(); },
    building: () => working || jobs.length > 0,

    // ── reads of a person (PP5) ──
    point(id, name, out) {
      const H = byId.get(String(id)), p = H && H.here && H.player.posed ? H.points[name ?? 'head'] : null;
      if (!p) return false;
      out[0] = p[0]; out[1] = p[1]; out[2] = p[2];
      return true;
    },
    // the same point for the person posed as a cut to `values` will set them (PP5; SCENE asks it for the target of a
    // live shot's camera): their place by SCENE's placing under those values, what carries them where it is under them
    // (an element's frame, a seat in it, the one whose arms they are on — posed so first), their turn, what they do at
    // its beginning, held or seated as the values say — on the people's own player, set as theirs is now and told a new
    // shot, as the cut's step will tell theirs: nothing of the person is touched, nothing made a call. root: where their
    // root stands then and which way they face (into it, 4 numbers: x, y, z, their facing — radians, as a player's). → false: the values move nothing of them (none of their keys, their place's,
    // nor of what carries them — SCENE then takes them as they are now), they are not here under them, or they have no
    // such point
    pointFor(values, id, name, out, root) {
      const H = byId.get(String(id));
      if (!H || !nowValues || !movedBy(H, values, 0)) return false;
      return posedAhead(H, values, name ?? 'head', out, root, 0);
    },
    // (their box — false while they are not here, or not posed yet)
    box(id, out) {
      const H = byId.get(String(id));
      if (!H || !H.here || !H.player.posed) return false;
      out[0] = H.box[0]; out[1] = H.box[1]; out[2] = H.box[2]; out[3] = H.box[3];
      return true;
    },
    // how tall they are (metres: their figure's, as they are dressed now)
    height: id => byId.get(String(id))?.entry.W.G.model.height ?? null,
    pick(origin, way) {
      let near = Infinity, who = null;
      for (let i = 0; i < list.length; i++) {
        const H = list[i];
        if (!H.here || !H.player.posed) continue;
        for (let c = 0; c < H.capsules.n; c++) { const s = capsuleHit(origin, way, H.capsules.data, c * 7); if (s < near) { near = s; who = H; } }
      }
      if (!who) return null;
      hit.id = who.id; hit.at[0] = origin[0] + way[0] * near; hit.at[1] = origin[1] + way[1] * near; hit.at[2] = origin[2] + way[2] * near;
      return hit;
    },
    // the highlight's bits for them — FLAG.OFFERED, FLAG.SELECTED: a field of their uniform (IN3)
    mark(id, bits) { const H = byId.get(String(id)); if (H) H.marks = bits >>> 0; },
    startOf: (id, motion, turned) => byId.get(String(id))?.player.startOf(motion, turned) ?? null,
    // how long a motion done once takes them (seconds), or a turn ({turn: degrees}) at their pace
    durationOf(id, motion) {
      const P = byId.get(String(id))?.player;
      return !P ? null : motion && typeof motion === 'object' ? P.turnTime(Number(motion.turn) || 0) : P.durationOf(motion);
    },
    speedOf: (id, gait) => byId.get(String(id))?.player.speedOf(gait) ?? null,

    // everyone as data — what they do, where, how they face (a moment saved: a seek, a game restored) — and back to it:
    // each who is the same person as saved (their `person` as it was; a scene changed since may have changed them —
    // they start afresh). No cloth, nothing that swings, no face: figures come up at rest in the pose (PP6)
    save: () => Object.fromEntries(list.map(H => [H.id, { made: H.made, player: H.player.save(), shot: H.shot }])),
    restore(data) {
      for (const H of list) {
        const d = data?.[H.id];
        if (!d || d.made !== H.made) continue;
        H.player.restore(d.player); H.shot = d.shot;
        H.onRef = UNSEEN; H.live = false;
      }
    },
    dispose() { holds.clear(); dispose(); },

    // ── RENDER's (PP7–PP10) ──
    // once in every drawn frame, after the views are placed: who is shown — in a view, a view ahead, a mirror, a
    // shadow's — and for them their bones, their cloth's step, their uniform; the bones' one write. → whether anyone
    // became shown or hidden, or what is drawn of anyone shown is another than at their last show (their version:
    // a part put away between two shows counts)
    show(seen) {
      let any = false;
      shownN = 0;
      for (let i = 0; i < list.length; i++) {
        const H = list[i], P = H.player, now = H.here && P.posed && seen(H.sphere);
        if (now !== H.shown) { H.shown = now; H.version++; any = true; }
        if (!now) { H.live = false; continue; }
        shownN++;
        const W = H.entry.W, own = Math.max(0, P.clockT - H.shownAt);
        // (a look put on, parts taken since their last step — a frame drawn with no step between: posed as they stand
        // before they are shown, what swings as it was — at rest if the look is new on them)
        if (H.unposed) { where[4] = 0; W.G.model.pose(W.I, P.P, where, !H.live, W.carried); H.unposed = false; }
        // (brought up at rest in the pose: first shown, set as a cut sets them since their last show — a new shot, a
        // settle —, after more than one step since their last show, carried by another thing now, or LATE of their own
        // time unseen)
        const fresh = !H.live || H.steps > 1 || H.cut || H.byShown !== P.by || own > LATE;
        where[0] = P.lat[0]; where[1] = P.lat[1]; where[2] = P.lat[2]; where[3] = P.own; where[4] = own; where[5] = H.floor; where[6] = P.clockT;
        W.G.model.bones(W.I, P.P, where, fresh);
        let changed = upload(S, W);
        if (uniform(H, W)) changed = true;
        if (!H.inked) {
          const M = W.G.model, at = H.slot * 4;
          inkData[at] = linear(M.ink[0]); inkData[at + 1] = linear(M.ink[1]); inkData[at + 2] = linear(M.ink[2]);
          gpu.write(inks, at * 4, inkData, at, 4);
          H.inked = true; changed = true;
        }
        if (changed) H.version++;
        if (H.version !== H.showed) { H.showed = H.version; any = true; }
        // (an offered person breathes: the picture changes while they are in it, though nothing of theirs did)
        if (H.marks & FLAG.OFFERED) any = true;
        H.live = true; H.steps = 0; H.shownAt = P.clockT; H.cut = false; H.byShown = P.by;
      }
      S.bones.table.flush();
      return any;
    },
    // how many the last show showed — here and in a view (the frame's, a mirror's, a light's): those drawn (PP7)
    shown: () => shownN,
    // one more whenever what is drawn of them changed (PP8)
    version: id => byId.get(String(id))?.version ?? 0,
    sphere(id, out) {
      const H = byId.get(String(id));
      if (!H || !H.here || !H.player.posed) return false;
      out[0] = H.sphere[0]; out[1] = H.sphere[1]; out[2] = H.sphere[2]; out[3] = H.sphere[3];
      return true;
    },
    capsules: id => byId.get(String(id))?.capsules ?? null,
    // whether that person is drawn in mirrors (<id>_reflected not false)
    reflected: id => byId.get(String(id))?.reflected ?? true,
    // inside RENDER's pass, its groups 0 and 1 set (PP10; kind: 'main' | 'depth' — people are in no mask): those shown
    // whose sphere is in this view (inView) — or the one named —, kind by kind: the kind's pipeline for the pass
    // (`mirrored`: a mirror's view, the winding turned; who is not reflected is not drawn in it),
    // the people's group, each one's uniform, their meshes — each draw and its triangles added to RENDER's counters
    // (RN8). → whether anyone was drawn
    draw(pass, kind, inView, id, mirrored, counters) {
      const only = id == null ? null : String(id);
      empty(drawn);
      for (let i = 0; i < list.length; i++) { const H = list[i]; if (H.shown && (only === null || H.id === only) && (!mirrored || H.reflected) && inView(H.sphere)) drawn.push(H); }
      if (!drawn.length) return false;
      pass.setBindGroup(2, S.group());
      const one = S.person();
      for (let k = 0; k < PERSON_KINDS.length; k++) {
        let set = false;
        for (let i = 0; i < drawn.length; i++) {
          const H = drawn[i], draws = H.entry.W.draws[k];
          if (!draws.length) continue;
          if (!set) { pass.setPipeline(lib.person(PERSON_KINDS[k].name, kind, mirrored)); set = true; }
          offset[0] = H.block * PERSON.BLOCK;
          pass.setBindGroup(3, one, offset);
          for (let d = 0; d < draws.length; d++) {
            const D = draws[d];
            for (let b = 0; b < D.buffers.length; b++) pass.setVertexBuffer(b, D.buffers[b]);
            pass.setIndexBuffer(D.index, 'uint32');
            pass.drawIndexed(D.count);
            counters.draws++; counters.triangles += D.count / 3;
          }
        }
      }
      return true;
    },
  };
}
