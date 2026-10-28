// What the scene's thread tells the page (3.1): what went wrong, riding on the next message; the state's events
// gathered into `changes`, `moves` and `save` (PG5, PG6 — there is no message a change); the one `frame` message a tick,
// each field only when it changed (PG5); the points the page follows, projected here with the very camera and rect the
// frame is drawn with — the frame record's f.camera, f.rect (PG9, IN1, IN4); what is waited for (PG8).
//   The same-frame rule (IN4): a tick whose frame was held sends nothing that places things — no frame, camera, hero,
// selected, points; they go with the tick that draws (or idles).
//   Nothing is made for a tick (5.16): the lists the events are gathered in are the ones posted — a message is copied
// as it is sent — and are emptied after it; what the frame message carries are objects kept here, written field by
// field where they changed.
import { empty } from '../base.js';

const SAYINGS = 256, RECENT = 32;
// two small flat objects (or null) with the same fields — compared field by field: nothing made a tick
function same(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  for (const k in a) if (a[k] !== b[k]) return false;
  return true;
}

// send(message): postMessage
export function createMessages(send) {
  // ── what goes wrong: the scene's, said to the page with the next message ──
  // Each said once while a scene is shown — once by its words, its numbers aside (a warning naming a distance or a
  // count that changes is one warning, said as it first came); at most SAYINGS of them a show (past it: said once that
  // more went unsaid). Kept only till the next message takes them, and the last RECENT of each for ?debug's overlay
  const wrong = { errors: [], warnings: [], recentErrors: [], recentWarnings: [], said: new Set(), over: false };
  function say(text, list, recent) {
    const key = text.replace(/\d+(\.\d+)?(e[-+]?\d+)?/g, '#');
    if (wrong.said.has(key)) return;
    if (wrong.said.size >= SAYINGS) {
      if (!wrong.over) { wrong.over = true; wrong.warnings.push(`more than ${SAYINGS} different things went wrong — the rest not said`); }
      return;
    }
    wrong.said.add(key);
    list.push(text);
    recent.push(text);
    if (recent.length > RECENT) recent.shift();
  }
  const warn = text => say(String(text), wrong.warnings, wrong.recentWarnings);
  const report = (who, err) => say(`${who}: ${err?.message || err}`, wrong.errors, wrong.recentErrors);
  // (an error the page shows in the scene's place starts with `renderer: ` (PG7): with `mounted` — the mount failed;
  // on a later message — the fault of the scene shown; with `failed` — the engine itself failed. It is not a scene's
  // saying, and is never kept from being said twice. What host.error tells is an error of the scene: `engine: …`)
  const fatal = err => wrong.errors.push(`renderer: ${err?.message || err}`);
  // (after `lost` or `failed` the thread posts nothing more)
  let ended = false;
  function post(m) {
    if (ended) return;
    // (the state's events go before an action's, an event's, a line's — PG6)
    if (m.t === 'action' || m.t === 'event' || m.t === 'say' || m.t === 'unsay' || m.t === 'reply') state();
    if (!wrong.errors.length && !wrong.warnings.length) { send(m); return; }
    const errors = wrong.errors.splice(0), warnings = wrong.warnings.splice(0);
    send({ ...m, ...(errors.length ? { errors } : {}), ...(warnings.length ? { warnings } : {}) });
  }

  // ── the state's events ──
  // changes: 'change' events in order (null: gone); moves: each key once, its value now — every key whose value is
  // another without a 'change' saying so (a key driven; one a restore or a start put elsewhere), so the
  // page's values are the scene's; kept: what the game keeps
  // (told: each key's record — the batch (`batch`: one more after each post of the lists) in which a 'change' told of
  // it, and the one in which it is among `moves`, with its place there: nothing cleared, nothing made a tick)
  const changes = [], moves = [], told = new Map();
  let kept = null, keeping = false, quiet = false, batch = 1;
  const toldOf = key => { let r = told.get(key); if (!r) told.set(key, r = { noted: 0, moved: 0, at: 0 }); return r; };
  const quietKeys = new Set();
  const events = {
    // the game keeps what the scene saves (start.save)
    keeps(on) { keeping = !!on; if (!on) kept = null; },
    // a job apart: the page hears nothing of its steps — the keys it changed are told, as they are then, when it ends
    // (value, target: the state's — a key's value, and where it is going: what the game keeps of it)
    quiet(on, value, target) {
      if (!on && quiet) {
        for (const k of quietKeys) { changes.push(k, value(k) ?? null); if (keeping) (kept ||= {})[k] = target(k) ?? null; }
        quietKeys.clear();
      }
      quiet = !!on;
    },
    change(key, value, target) {
      if (quiet) { quietKeys.add(key); return; }
      toldOf(key).noted = batch;
      changes.push(key, value ?? null);
      if (keeping) (kept ||= {})[key] = target ?? null;
    },
    move(key, value) {
      if (quiet) { quietKeys.add(key); return; }
      const r = toldOf(key);
      if (r.moved !== batch) { r.moved = batch; r.at = moves.length; moves.push(key, value ?? null); } else moves[r.at + 1] = value ?? null;
    },
    // a step's changed keys (the state's own list): those no event of this tick told of are told as they are now
    sync(keys, value) {
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (quiet) { quietKeys.add(k); continue; }
        const r = toldOf(k);
        if (r.noted !== batch && r.moved !== batch) { r.moved = batch; r.at = moves.length; moves.push(k, value(k) ?? null); }
      }
    },
  };
  // the three fields onto a message — the lists themselves: posted as they are → whether there were any; and, once
  // the message is posted (or was not: nothing to tell), the lists emptied for the next batch
  function stateInto(m) {
    m.changes = changes.length ? changes : undefined;
    m.moves = moves.length ? moves : undefined;
    m.save = kept ?? undefined;
    return changes.length > 0 || moves.length > 0 || kept !== null;
  }
  function stateSent() { empty(changes); empty(moves); kept = null; batch++; }
  // PG6: the state's events as a message of their own — before another message, or when no tick runs
  const stateMessage = { t: 'state', changes: undefined, moves: undefined, save: undefined };
  function state() { if ((changes.length || moves.length || kept) && !quiet && stateInto(stateMessage)) { post(stateMessage); stateSent(); } }

  // ── the points the page follows (PG9) ──
  // a slot: its ref, lift and over; the same slot for the same arguments — found among the slots' kept records by
  // the arguments themselves (a ref that is a name: the same name; one that is numbers — [across, distance,
  // elevation], { on, at } —: the same numbers); slots live as long as the thread
  const slots = [];
  let points = new Float32Array(0), sent = new Float32Array(0), fresh = false;
  const sameRef = (a, b) => {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!sameRef(a[i], b[i])) return false; return true; }
    let n = 0;
    for (const k in a) { if (!(k in b) || !sameRef(a[k], b[k])) return false; n++; }
    for (const k in b) n--;
    return n === 0;
  };
  function track(ref, lift = 0, over = false) {
    lift = Number(lift) || 0; over = !!over;
    let slot = -1;
    for (let i = 0; i < slots.length; i++) if (slots[i].lift === lift && slots[i].over === over && sameRef(slots[i].ref, ref)) { slot = i; break; }
    if (slot < 0) {
      slot = slots.length;
      slots.push({ ref, lift, over });
      const grown = new Float32Array(3 * slots.length).fill(NaN); grown.set(points); points = grown;
      const was = new Float32Array(3 * slots.length).fill(NaN); was.set(sent); sent = was;
      fresh = true;
    }
    return slot;
  }
  // every slot now: [x, y, depth] — CSS px and metres; x NaN: not there or behind the eye; depth Infinity: the sky's;
  // 0: an insert's → whether any is other than was sent
  const P = new Float64Array(3), xy = [0, 0, 0];
  function pointsNow(S) {
    const { world, camera } = S, f = S.f, rect = f.rect, yaw = f.camera.yaw;
    let changed = fresh;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i], where = world.pointFor(s.ref, P, yaw, s.over);
      let x = NaN, y = NaN, depth = NaN;
      if (where === 1) { P[1] += s.lift; if (camera.project(P, xy, f.camera)) { x = xy[0]; y = xy[1]; depth = xy[2]; } }
      else if (where === 2) { if (camera.projectWay(P, xy, f.camera)) { x = xy[0]; y = xy[1]; depth = Infinity; } }
      else if (where === 3) { x = rect.x + rect.w / 2 + P[0] * rect.h; y = rect.y + P[1] * rect.h; depth = 0; }
      const o = 3 * i;
      points[o] = x; points[o + 1] = y; points[o + 2] = depth;
      if (!Object.is(points[o], sent[o]) || !Object.is(points[o + 1], sent[o + 1]) || !Object.is(points[o + 2], sent[o + 2])) changed = true;
    }
    return changed;
  }

  // ── the frame message (PG5) ──
  // (what was told last — hero, selected, showcase: undefined not yet, null none, else the object kept for it)
  const was = { frame: { x: NaN, y: 0, w: 0, h: 0 }, camera: { x: NaN, z: 0, h: 0, look: 0, yaw: 0, roll: 0 }, hero: undefined, fixed: undefined, selected: undefined, showcase: undefined, beats: undefined };
  const heroWas = { across: 0, elevation: 0, ground: false }, selectedWas = { path: '', x: 0, y: 0, w: 0, h: 0 }, showcaseWas = { at: 0, length: 0, known: false, playing: false, ended: false, beat: -1 };
  // (a flat object of what is told taken into the one kept for it: its fields, one by one)
  const taken = (to, from) => { for (const k in to) to[k] = from[k]; return to; };
  const m = { t: 'frame', frame: undefined, camera: undefined, hero: undefined, fixed: undefined, selected: undefined, showcase: undefined, beats: undefined, points: undefined, changes: undefined, moves: undefined, save: undefined };
  const heroAt = {};
  // (the next frame message carries every field: after a mount, after a scene is shown)
  function all() { was.frame.x = NaN; was.camera.x = NaN; was.hero = undefined; was.fixed = undefined; was.selected = undefined; was.showcase = undefined; was.beats = undefined; fresh = true; sent.fill(NaN); }
  // After a tick: S — the scene, with its frame record S.f as R.frame was just given it: what places things is of
  // f.camera and f.rect, the very objects that frame was drawn with (IN4 — a still's camera too); placed — the
  // tick's frame was drawn or idle (not held: what places things goes); selected: { path, x, y, w, h } | null. One
  // message, if anything in it changed
  function frame(S, placed, selected) {
    const { camera, director } = S;
    let any = stateInto(m);
    m.frame = m.camera = m.hero = m.fixed = m.selected = m.points = m.showcase = m.beats = undefined;
    if (placed) {
      const r = S.f.rect, f = was.frame, pose = S.f.camera.pose;
      if (!(f.x === r.x && f.y === r.y && f.w === r.w && f.h === r.h)) { f.x = r.x; f.y = r.y; f.w = r.w; f.h = r.h; m.frame = f; any = true; }
      const c = was.camera;
      if (!(c.x === pose.x && c.z === pose.z && c.h === pose.h && c.look === pose.look && c.yaw === pose.yaw && c.roll === pose.roll)) { c.x = pose.x; c.z = pose.z; c.h = pose.h; c.look = pose.look; c.yaw = pose.yaw; c.roll = pose.roll; m.camera = c; any = true; }
      const hero = camera.hero(heroAt);
      if (!same(hero, was.hero)) { was.hero = hero ? taken(heroWas, hero) : null; m.hero = was.hero; any = true; }
      const fixed = camera.fixed();
      if (fixed !== was.fixed) { was.fixed = fixed; m.fixed = fixed; any = true; }
      if (!same(selected, was.selected)) { was.selected = selected ? taken(selectedWas, selected) : null; m.selected = was.selected; any = true; }
      if (pointsNow(S)) { sent.set(points); fresh = false; m.points = points; any = true; }
    }
    const beats = director.showcase.beats;
    // (told when a film is loaded, and — null — when one that was is let go)
    if (beats !== was.beats) { if (beats || was.beats) { m.beats = beats; any = true; } was.beats = beats; }
    const sc = director.showcase.info;
    if (!same(sc, was.showcase)) { was.showcase = sc ? taken(showcaseWas, sc) : null; m.showcase = was.showcase; any = true; }
    if (any) post(m);
    stateSent();
  }

  // ── what is waited for (PG8) ──
  // (told when it is another than was told: its fields compared — pipelines: [made, asked])
  const waitsWas = { none: true, building: undefined, pipelinesMade: -1, pipelinesAsked: -1, pages: undefined, land: undefined, shadows: undefined, apart: undefined, shot: undefined, story: undefined, held: undefined };
  function waits(W) {
    const none = !W, p = W?.pipelines, made = p ? p[0] : -1, asked = p ? p[1] : -1;
    if (none === waitsWas.none && (none || (W.building === waitsWas.building && made === waitsWas.pipelinesMade && asked === waitsWas.pipelinesAsked && W.pages === waitsWas.pages && W.land === waitsWas.land && W.shadows === waitsWas.shadows && W.apart === waitsWas.apart && W.shot === waitsWas.shot && W.story === waitsWas.story && W.held === waitsWas.held))) return;
    waitsWas.none = none; waitsWas.building = W?.building; waitsWas.pipelinesMade = made; waitsWas.pipelinesAsked = asked; waitsWas.pages = W?.pages; waitsWas.land = W?.land; waitsWas.shadows = W?.shadows; waitsWas.apart = W?.apart; waitsWas.shot = W?.shot; waitsWas.story = W?.story; waitsWas.held = W?.held;
    post({ t: 'waits', waits: W ?? null });
  }
  return {
    post, warn, report, fatal, wrong, events, state, track, frame, all, waits,
    // a scene is shown: what was said of the one before may be said again
    shown() { wrong.said.clear(); wrong.over = false; all(); },
    // the device is lost: the one last message — with what went wrong and was not told yet —, then nothing more (PG14)
    lost(saved, reason) { state(); post({ t: 'lost', saved, reason }); ended = true; },
    // the engine itself failed after the mount (a painter's thread died: SH5): `failed` with its `renderer: ` error,
    // then nothing more (PG7 b)
    failed(err) { fatal(err); post({ t: 'failed' }); ended = true; },
  };
}
