// Engine 3's scene thread (a module worker): a scene with "engine": 3 runs here — the loop, the pacer, the ONE step
// (director, state, the world's tables, animates, people's poses, the camera, the lights), the asks of the artist, the
// renderer's frame, the one message a tick to the page (1.2). page.js is its page side; the messages are 3.1's.
// It never runs paint code (the artist does), never rasters, never reads pixels back, never waits on a timer: slicing
// is turn(); pipelines, pages, makes and builds are promises and messages.
//   The sequences of section 2 are here: the tick (2.1), the opening of a scene (2.2), the settle that draws a whole
// frame (2.5), jobs apart — a scene's build, a seek or `to`, a restore: at most one, a newer replacing the running one
// at its next turn —, pause (2.6), a render's moments (2.7: mounted with a virtual clock there is no loop and no
// pacer), the device lost (2.8), a scene replaced (2.9: the one before living on beside the one being made, till that
// is whole), the stage's veil (2.10).
//   What goes wrong (PG7): an error the page shows in the scene's place begins `renderer: ` — a mount that failed
// (with `mounted`), the fault of the scene shown (on a later message: an exception of a tick, a frame held with
// nothing coming), the engine's own failure (`failed`). Everything else is an error of the scene and never begins so:
// what the GPU layer and the renderer tell through host.error is `engine: …`.
import '../1/clock.js';
import '../1/frames.js';
import { turn, STEP, DT_MOST, WAITS_EVERY, FLAG } from './base.js';
import { createGpu } from './gpu/gpu.js';
import { createSheets } from './sheets/cache.js';
import { layouts as sheetsLayouts } from './sheets/upload.js';
import { CHANGED } from './sheets/ask.js';
import { layouts as peopleLayouts } from './people/person.wgsl.js';
import { layouts as renderLayouts } from './render/library.js';
import { createRenderer } from './render/renderer.js';
import { createPeople } from './people/people.js';
import './world/world.wgsl.js';
import { compile } from './world/spec.js';
import { kit } from './world/kit.js';
import { createState } from './world/state.js';
import { createWorld } from './world/world.js';
import { landOf } from './world/relief.js';
import { createLook, createLights } from './world/light.js';
import { createEmitters } from './world/emitters.js';
import { createCamera, newCamera, KEYS } from './play/camera.js';
import { createDirector } from './play/director.js';
import { createShots } from './play/shots.js';
import { createStepper } from './play/step.js';
import { createPace } from './play/pace.js';
import { createMessages } from './play/messages.js';
import { createInspect } from './play/inspect.js';

const G = globalThis;
const messages = createMessages(m => postMessage(m));
const { post, warn, report } = messages;
addEventListener('error', e => report('thread', e.message || e.error || e));
addEventListener('unhandledrejection', e => report('thread', e.reason?.message || e.reason));

// ── the stage ──
// host: PG1's fields and the tier's row (4.9); warn, error, lost and failed are the other areas' way back here — error:
// an error of the scene (an uncaptured GPU error, a shader that does not compile, a page a painter could not raster),
// told as `engine: …`; lost: the device is (2.8); failed: the engine itself failed (a painter's thread died: SH5);
// view — the part of the place's width the page leaves seen, [left, right] 0…1 (PG4 `setView`: the page's layout —
// kept here, every camera made takes it); ts — the last display callback's timestamp (the camera times the viewer's
// gestures by it)
const host = { w: 1, h: 1, dpr: 1, pw: 1, ph: 1, view: [0, 1], budget: 1920 * 1080, tier: 'normal', phone: false, cores: 4, flags: {}, overlay: null, clock: null, real: false, speech: false, ts: 0, warn, error: err => report('engine', err), lost: null, failed: null };
// every number that depends on the device (4.9), by where the page says the device lands
const TIER = {
  computer: { normal: { cache: 29, wholePages: 32, shadow: 2048, busy: 4, pages: 8, ahead: 0.5 }, weak: { cache: 22, wholePages: 22, shadow: 2048, busy: 4, pages: 8, ahead: 0.5 } },
  phone: { normal: { cache: 13, wholePages: 15, shadow: 1024, busy: 2, pages: 4, ahead: 1 }, weak: { cache: 9, wholePages: 8, shadow: 1024, busy: 2, pages: 4, ahead: 1 } },
};
let gpu = null, sheets = null, R = null, pace = null, stand = null;
// the scene shown: { C, world, state, camera, director, lookOf, shots, artist, spec, modules, inspect, f — its frame
// record (RN4) —, stepper, selected, offered, seen — a frame of it has been drawn —, zero — its opening's moment,
// still — the camera a moment was last drawn from, or null —, instant — the instant mode is on in it —, fault — the
// error it stopped with, or null }
let S = null;
// (a render's virtual clock: no loop, no pacer; dead: the mount failed, the device is lost or the engine failed —
// nothing more is done)
let clockGiven = false, dead = false;

// ── arrivals: a page from a painter, a make's answer, a people's build ended (2.5) ──
let wake = null;
const arrived = () => { const w = wake; wake = null; if (w) w(); };
const arrival = () => new Promise(resolve => { wake = resolve; });

// ── jobs apart ──
// Work that takes more than a task. The thread has at most one: a newer one replaces the running one at its next
// turn (check() throws REPLACED there; the replaced call is replied { replaced: true }) and begins once that one has
// unwound. The loop asks for no frames while one runs — but a scene's build beside a scene still shown (2.9): that
// one is drawn on, living.
const REPLACED = { replaced: true };
let running = null;
const check = job => { if (job.replaced || dead) throw REPLACED; };
// a job ended from outside (a newer one, the device lost, the engine failed): it throws at its next wake — woken now;
// job.stop — its own: what it waits on that no arrival ends is ended there (a show's artist); job.ended — resolved
// then, for what a job waits on that is no arrival (a scene being made whole beside the one drawn, the veil)
function replace(job) { job.replaced = true; job.stop?.(); job.end(); arrived(); }
// (what a job waits on, or its end — then it throws as at any wake)
const until = async (job, promise) => { const value = await Promise.race([promise, job.ended]); check(job); return value; };
async function apart(work, { drawing = false } = {}) {
  const job = { replaced: false, done: null, drawing, stop: null, ended: null, end: null }, before = running;
  let finish;
  job.done = new Promise(resolve => { finish = resolve; });
  job.ended = new Promise(resolve => { job.end = resolve; });
  running = job;
  if (before) { replace(before); await before.done; }
  try {
    check(job);
    // (a drawing job — a show beside a scene still shown — has that scene drawn on: the job before it may have
    // stopped the loop)
    if (drawing) reloop(); else unloop();
    return await work(job);
  } catch (err) {
    if (err === REPLACED) return REPLACED;
    throw err;
  } finally {
    finish();
    // (what is waited for told as the job ends — before its answer: a show's build, a job apart, are over as they are
    // answered, not with the next frame — PG8)
    if (running === job) { running = null; waitsNow(heldBefore); reloop(); }
  }
}

// ── the loop ──
let frameRequest = 0, fresh = true, lastRun = 0, heldBefore = false, paused = false;
// (the loop stopped: a fade going on is where it goes at once — no frame would show it —, and what waits on the
// loop's frames — a scene made beside this one — is woken to go on by itself)
function unloop() {
  if (!frameRequest) return;
  cancelAnimationFrame(frameRequest); frameRequest = 0;
  if (veil.done) veilAt(veil.to);
  arrived();
}
// (a frame asked: only with a scene to show, a loop of its own, nothing standing in its way; its callback is fresh)
function reloop() {
  if (frameRequest || clockGiven || dead || paused || !S || S.instant || S.fault || (running && !running.drawing)) return;
  fresh = true;
  frameRequest = requestAnimationFrame(tick);
}
// ── the veil (2.10): the stage's black over the picture — the page's and the game's, never a scene's: no state, in no
// still. at: its level; a fade from `from` to `to` over `over` seconds of the frames drawn (`gone` so far; ts: the
// display timestamp it was last moved at, −1 none — a fresh callback moves it no time); done: the fade's answer — a
// fade is going on while it is there (never judged by the level: an eased level may round to `to` a callback before the
// fade's time is up). The thread is the one that knows where it is: each level it comes to is told to the page (`veil`,
// PG15). lift: the seconds a switch through black (2.9) takes the veil off over — at the first frame drawn after it, of
// whichever scene is shown then (a newer show switched before it does not leave it black); 0: none, or a fade of the
// page's took it over ──
const veil = { at: 0, from: 0, to: 0, over: 0, gone: 0, ts: -1, done: null, lift: 0 };
// → a promise, resolved when the veil is at `level` — at once where no frames are drawn to show it going (no loop: no
// scene, paused, the instant mode, a fault, a job apart, a render) —, or as a newer fade takes over
function veilTo(level, seconds) {
  level = Math.min(1, Math.max(0, Number(level) || 0)); seconds = Math.max(0, Number(seconds) || 0);
  const was = veil.done;
  veil.done = null;
  was?.();
  veil.from = veil.at; veil.to = level; veil.over = seconds; veil.gone = 0; veil.ts = -1;
  if (!(seconds > 0) || veil.at === level || !frameRequest) { veilAt(level); return Promise.resolve(null); }
  return new Promise(resolve => { veil.done = () => resolve(null); });
}
// (the veil come to `level`: the fade answered, the page told)
function veilAt(level) {
  veil.at = veil.from = veil.to = level;
  const done = veil.done;
  veil.done = null;
  done?.();
  post({ t: 'veil', level });
}
// a callback's share of the fade going on (ts: its display timestamp), as the step's time goes: at most DT_MOST a
// callback. It stands while a frame is held (nothing is drawn: it goes on from what was last seen), and one that lifts
// the veil waits while a cut waits: the veil comes off the picture the cut goes to, never off the one the story leaves
function veilStep(ts) {
  if (!veil.done) return;
  if (heldBefore || (veil.to < veil.from && S.director.held)) { veil.ts = ts; return; }
  if (veil.ts >= 0) veil.gone += Math.min((ts - veil.ts) / 1000, DT_MOST);
  veil.ts = ts;
  const u = Math.min(1, veil.gone / veil.over);
  if (u >= 1) { veilAt(veil.to); return; }
  veil.at = veil.from + (veil.to - veil.from) * u * u * (3 - 2 * u);
}

// whether anything a wait of world W's is on its way — the one place every wait that judges itself stuck asks (a held
// frame, a cut waiting for its shot, a scene made beside the one shown): a page asked of a painter or arrived and not
// placed yet, a make asked of the artist (or about to be), a people's build, the world's build, and R's own work —
// pipelines being made, the land baked by its ration (R.working)
const inFlight = W => sheets.flying > 0 || sheets.arrived > 0 || W.flying > 0 || W.waiting() || (W.people ? W.people.building() : false) || !!W.building || R.working();
// RN12: a frame held with nothing coming is an engine fault — said in the scene's place, never a wait sign for ever
const fault = () => new Error(`the frame cannot be finished and nothing more is on its way — still waiting for ${R.missing().join(', ') || 'nothing it can name'}`);
// the fault of the scene shown (PG7 c): its loop stops, `seen` is rejected, its words — `renderer: …` — ride on a
// message; the thread lives, and the next show takes them away
function faulted(err) {
  S.fault = err;
  unloop();
  for (const waiter of S.seenWaiters.splice(0)) waiter.reject(err);
  messages.fatal(err);
  messages.waits(null);
  post({ t: 'state' });
}
// what is waited for, told to the page (PG8): non-null ONLY while the picture stands (held: the tick's R.frame
// returned 0 — told as `held`, which the page's sign and its pause of
// voices and music read: 2.4, 2.9), a scene is being built, a job apart runs, or the story waits on a shot being made
// ready (`shot`: the picture goes on, the scene's code stands on an until that asks a shot's `ready`, or — `story` —
// the whole story stands on a cut that waits: the director's `awaiting`, `held`) — a frame that was drawn tells none
// otherwise, whatever pages it still lacks. The renderer's part (R.waits(): of the call just made — the frame's own
// lacks) is read where the picture stands, a job apart runs or a scene is built with nothing drawn beside it; a scene
// built beside a living one counts what its opening view lacks; a wait on a shot alone, that shot's: the pages its
// views still lack (its entry's `pages`: RN4) and its land, if it lacks some (`land`); the pipelines being made always
const waitsOf = { building: undefined, pipelines: undefined, pages: undefined, land: undefined, shadows: undefined, apart: undefined, shot: undefined, story: undefined, held: undefined };
function waitsNow(held) {
  const building = !!pending, isApart = !!running && !running.drawing, beside = pending ? pending.beside : null;
  const frames = held || isApart || (building && !beside);
  const awaited = S ? S.director.awaiting : null;
  if (!frames && !building && !awaited) { messages.waits(null); return null; }
  const r = frames ? R.waits() : null;
  waitsOf.building = building || undefined; waitsOf.pipelines = r ? r.pipelines : R.pipelines();
  waitsOf.pages = r ? r.pages : beside ? (beside.view.lacking > 0 ? beside.view.lacking : undefined) : awaited ? awaited.w.pages || undefined : undefined;
  waitsOf.land = r ? r.land : awaited && awaited.w.land > 0 ? true : undefined; waitsOf.shadows = r?.shadows; waitsOf.apart = isApart || undefined;
  waitsOf.shot = awaited ? true : undefined; waitsOf.story = S && S.director.held ? true : undefined; waitsOf.held = held || undefined;
  messages.waits(waitsOf);
  return waitsOf;
}
// the stand's row (ST2), and the P panel's window — both from the display's timestamps and the counters. opened: on
// the tick an insert's opening begins, the seconds since its key left 0, else −1 (world.opened — RN4). ready,
// readyBias: on the tick whose step makes a cut to a live shot (the row its shot number changes on), whether that shot
// was ready (1, 0) and its bias — else −1 (the scene keeps how many such cuts its rows have told: `cutsTold`); step: the
// detail run's — the step's parts (parts: ONE object, ms; −1 where the callback made no step), else null; tick: the
// detail run's — the callback's own parts (ticked: ONE object, ms; −1 where the callback did not run that part), else
// null
const row = { at: 0, ran: false, state: 1, every: 1, late: false, lateBy: 0, js: 0, cost: -1, submitted: -1, shot: 0, moving: false, makes: 0, keys: 0, placed: 0, opened: -1, story: false, ready: -1, readyBias: -1, counters: null, lacks: null, cycle: null, step: null, tick: null, wide: null, wideNames: null, times: null };
const parts = { director: -1, world: -1, animates: -1, people: -1, camera: -1, lights: -1 };
const ticked = { pace: -1, step: -1, show: -1, render: -1, after: -1 };
// (the detail run: the time since the last reading is that part's)
let since = 0;
function spent() { const at = performance.now(), ms = at - since; since = at; return ms; }
const perf = { on: false, since: 0, ticks: 0, ran: 0, drawn: 0, held: 0, idle: 0, worst: 0 };
// what its frames were, told to the page now and then (frames.js)
const frames = MooodFrames(post, 3);
const selected = { path: '', x: 0, y: 0, w: 0, h: 0 }, selBox = [0, 0, 0, 0];
// an element as the page names it: `objects[i]`, i its place in spec.objects (its `path` — not its index: WT9)
const pathOf = el => `objects[${el.path}]`;
// the selection's box as the frame's camera sees it (f.camera: the very one the frame was drawn with — IN4)
function selectedNow() {
  const el = S.selected, box = el && S.inspect.boxOf(el, selBox, S.f.camera);
  if (!box) return null;
  selected.path = pathOf(el); selected.x = box[0]; selected.y = box[1]; selected.w = box[2]; selected.h = box[3];
  return selected;
}
// after a frame of S was given to the renderer: what follows from its outcome (0 held, 1 idle, 2 drawn)
function drawn(outcome) {
  const f = S.f;
  if (outcome === 2) {
    f.whole = false;
    if (!S.seen) {
      S.seen = true; stand?.mark('drawn'); S.camera.looked();
    }
    // (a switch through black: the veil off from the first frame drawn after it, over the same seconds — 2.9)
    if (veil.lift > 0) { const over = veil.lift; veil.lift = 0; veilTo(0, over); }
    // (those who asked for a frame seen: told — the list emptied as it is gone through, nothing made of it)
    while (S.seenWaiters.length) S.seenWaiters.shift().resolve();
  }
  if (host.flags.debug != null && host.overlay && outcome !== 0) S.inspect.overlay(host.flags.debug || null, S.stepper.t, messages.wrong.recentErrors, messages.wrong.recentWarnings);
}
// what follows a frame of S given to the renderer in a viewer's thread — a tick's, a resize's while paused (2.1 steps
// 8h–9): whether the picture is held from now on; a frame held with nothing coming is the fault (RN12 — not beside
// a job apart: a scene still shown while the next is built); the one message, if anything in it changed — nothing
// that places things on a held frame; what is waited for
function framed(outcome) {
  heldBefore = outcome === 0;
  drawn(outcome);
  if (outcome === 0 && !running && !inFlight(S.world)) throw fault();
  storyNow();
  messages.frame(S, outcome !== 0, outcome !== 0 ? selectedNow() : null);
  waitsNow(outcome === 0);
  // (a scene made beside this one, its view asked in this frame: its job judges it now)
  if (pending?.beside?.armed) arrived();
}
// a cut that waits for its shot (2.4) with nothing on its way for WAITS_EVERY frames running — what its shot lacks
// (its pages, its land's tiles, its paintings and people's looks) and its bias the same, nothing in flight (inFlight)
// — is an engine fault, as a held frame with nothing coming is: a story never stands silent for ever
const storyWas = { pages: -1, land: -1, bias: -1, painted: false, idle: 0 };
function storyNow() {
  const shot = S.director.held ? S.director.awaiting : null;
  if (!shot) { storyWas.idle = 0; return; }
  const w = shot.w, moved = w.pages !== storyWas.pages || w.land !== storyWas.land || w.bias !== storyWas.bias || shot.painted !== storyWas.painted;
  storyWas.pages = w.pages; storyWas.land = w.land; storyWas.bias = w.bias; storyWas.painted = shot.painted;
  if (moved || inFlight(S.world)) { storyWas.idle = 0; return; }
  if (++storyWas.idle >= WAITS_EVERY) throw new Error(`a cut waits for its shot and nothing more is on its way — the shot still lacks ${w.pages} pages, ${w.land} tiles of its land${shot.painted ? '' : ', paintings or the looks of its people'}`);
}
// A scene made beside the one shown (2.9), once R made what it needs: whole → true — the artist's answers all taken,
// its opening view's last ask lacking nothing. Its view is asked in the frames of the scene shown while that one's loop
// runs (and each such frame wakes this), else in cycles of its own here; nothing on its way — after its own cycle, or
// for WAITS_EVERY frames running with neither what it lacks nor its bias moving — is the fault of a switch that cannot
// come (an engine fault: its share of the cache — SH13 — and the bias's end make every view whole)
function judged(B) {
  const v = B.view;
  if (v.lacking === 0 && sheets.whole(B.world)) return true;
  if (v.lacking < 0) return false;
  const moved = v.lacking !== B.lacking || v.bias !== B.bias, coming = inFlight(B.world);
  B.lacking = v.lacking; B.bias = v.bias;
  if (frameRequest ? moved || coming || ++B.idle < WAITS_EVERY : coming) { if (moved || coming) B.idle = 0; return false; }
  throw new Error(`the scene cannot be finished beside the one shown and nothing more is on its way — its first view still lacks ${v.lacking} pages`);
}
// 2.1: a display callback
function tick(ts) {
  frameRequest = requestAnimationFrame(tick);
  const began = stand ? performance.now() : 0;
  const detail = row.tick !== null;
  if (detail) {
    parts.director = parts.world = parts.animates = parts.people = parts.camera = parts.lights = -1;
    ticked.pace = ticked.step = ticked.show = ticked.render = ticked.after = -1;
  }
  host.ts = ts;
  const wasFresh = fresh;
  fresh = false;
  if (wasFresh) veil.ts = -1;
  if (detail) since = performance.now();
  const ran = pace.run(ts, wasFresh);
  if (detail) ticked.pace = spent();
  let outcome = 1, makes = 0, keys = 0, placed = 0, opened = -1;
  if (perf.on) { perf.ticks++; if (!perf.since) perf.since = ts; }
  if (ran) {
    const f = S.f;
    // (time never runs while the picture is held: a scene's first frame, the frame after a held one — rule 8)
    const dt = wasFresh || heldBefore || !S.seen ? 0 : Math.min((ts - lastRun) / 1000, DT_MOST);
    if (perf.on && !wasFresh && ts - lastRun > perf.worst) perf.worst = ts - lastRun;
    const gap = wasFresh ? -1 : ts - lastRun;
    lastRun = ts;
    try {
      // (the artist's thread failed: nothing it was asked will come — the scene's fault)
      if (S.world.broken) throw S.world.broken;
      S.stepper.step(dt, true);
      if (detail) ticked.step = spent();
      S.stepper.show(dt);
      if (detail) ticked.show = spent();
      veilStep(ts);
      f.veil = veil.at;
      // (a scene made beside this one: its opening view asked after this frame's own — 2.9)
      f.next = pending?.beside ? pending.beside.view : null;
      const whole = f.whole;
      outcome = R.frame(f);
      if (detail) ticked.render = spent();
      // (RN8: the pages placed are that call's)
      placed = R.counters.placed;
      pace.frame(ts, outcome, whole);
      makes = S.world.took; keys = S.stepper.keys; opened = S.world.opened;
      framed(outcome);
      // (what people saw of it — frames.js: drawn, idle, held; a frame the pacer counts lost)
      frames.frame(outcome, gap, pace.late);
      if (detail) ticked.after = spent();
    } catch (err) { faulted(err); }
    if (perf.on) {
      perf.ran++; if (outcome === 2) perf.drawn++; else if (outcome === 0) perf.held++; else perf.idle++;
      if (ts - perf.since > 1000) {
        post({ t: 'perf', text: S.inspect.perf(perf, (ts - perf.since) / 1000, `${host.pw}×${host.ph}`, pace.every, pace.period, R.counters, gpu.memory(), sheets.stats()) });
        perf.since = ts; perf.ticks = perf.ran = perf.drawn = perf.held = perf.idle = 0; perf.worst = 0;
      }
    }
  }
  frames.tick(ts);
  if (stand) {
    row.at = ts + performance.timeOrigin; row.ran = ran; row.state = ran ? outcome : 1; row.every = pace.every; row.late = pace.late;
    row.cost = pace.takeCost(); row.submitted = pace.takeSubmitted(); row.lateBy = pace.lateBy; row.shot = S.f.shot; row.moving = S.f.moving; row.makes = makes; row.keys = keys;
    row.placed = placed; row.opened = opened; row.story = S.director.held;
    // (a cut to a live shot made in this callback's step, or asked since the step before — a page's call, a script
    // going on after a step: its values are set in this one, so this row is the cut's own; a callback the pacer skipped
    // makes no step and tells none)
    const cut = S.shots.cut;
    if (ran && cut.n !== S.cutsTold) { S.cutsTold = cut.n; row.ready = cut.ready ? 1 : 0; row.readyBias = cut.bias; } else { row.ready = -1; row.readyBias = -1; }
    row.counters = R.counters; row.lacks = R.lacks; row.cycle = sheets.cycle; row.times = R.timing;
    if (detail) row.wide = R.wide;
    row.js = performance.now() - began;
    stand.tick(row);
  }
}

// ── unseen steps, and the settle (2.5) ──
// silent: the page hears nothing of what the scene does — no event, line or action (the director's `simulating`); the
// keys changed meanwhile are told, as they are then, when it ends
const silent = on => { S.director.simulating = on; messages.events.quiet(on, S.state.value, S.state.targetOf); };
// steps of STEP until the scene's time is `to` (the last shorter) — or till until() —, one a task: nothing drawn,
// nothing asked of the artist; a render's virtual clock is run by the same span — in whole milliseconds (the clock
// ends a run at one), what is left of a step carried to the next (scene.clockLeft). What they tell (2.5): nothing in a
// viewer's thread (a seek is silent); in a thread mounted with a clock — where unseen steps are the only way time
// moves — a step that takes the scene's time past the furthest moment it has reached tells what a seen step does,
// and a replay of time already reached tells nothing
async function advance(job, to, until = null) {
  const scene = S, stepper = scene.stepper;
  let n = 0;
  // (what was set going just before — a sequence's code, run in a microtask — begins before the first step)
  await turn(); check(job);
  while (stepper.t < to - 1e-9 && !(until && until())) {
    const dt = Math.min(STEP, to - stepper.t);
    silent(!(clockGiven && stepper.t + dt > stepper.reached + 1e-9));
    stepper.step(dt, false);
    if (clockGiven) {
      const ms = scene.clockLeft + dt * 1000, whole = Math.floor(ms);
      scene.clockLeft = ms - whole;
      await G.__mooodTime.run(whole);
    }
    await turn(); check(job);
    if (++n % WAITS_EVERY === 0) waitsNow(false);
  }
}
// the one waiting loop of the engine: a whole frame of the scene as it is, drawn. step: with a step of no time before
// each try (false: `still` — this very moment as another camera, `from`, sees it: a frame with no step). What goes
// wrong in it is the fault of the scene shown (PG7 c): told in its place before the call is rejected
async function settle(job, step = true, from = null) {
  const f = S.f;
  try {
    for (;;) {
      if (S.world.broken) throw S.world.broken;
      if (step) S.stepper.step(0, true); else S.stepper.unstepped();
      S.stepper.show(0);
      // (a still has no veil: a scene's moment as it is)
      f.veil = from ? 0 : veil.at; f.next = null;
      if (from) { f.camera = from; f.toward = null; }
      const s = R.frame(f);
      drawn(s);
      if (s === 2) break;
      if (!inFlight(S.world)) throw fault();
      waitsNow(true);
      await arrival(); check(job);
    }
    // (the picture is not held any more: a `seen` asked now does not wait for a frame an idle tick never gives)
    heldBefore = false;
    messages.frame(S, true, selectedNow());
    messages.waits(null);
    await gpu.done();
  } catch (err) {
    if (err !== REPLACED) faulted(err);
    throw err;
  }
}
// the next frame a new shot, whole (an unseen jump, a restore, a scene shown)
function newShot() { S.camera.newShot(); S.f.shot = S.camera.counted(); S.f.whole = true; S.still = null; }
// a job that leaves the scene at another moment: silent but for what a render's steps past the reached moment tell
// (advance); then the moment is drawn whole (2.5 step 3) — a viewer's seek and a render's moment are the same code
async function jump(job, work) {
  silent(true);
  try { await work(); } finally { silent(false); }
  S.lookOf.update(S.state.value);
  S.world.lit.all();
  newShot();
  await settle(job);
}

// ── a scene shown (2.2, 2.9) ──
// the scene's scripts (spec.script, each element's): run with `scene` (the director's API), anew each time the scene
// is shown, started or restored — written to go on from the state (anew: what ran stops first)
function runScripts(N, anew = true) {
  const { C, director } = N;
  if (anew) director.stop();
  const exec = (code, who, element) => {
    if (typeof code !== 'string' || !code.trim()) return;
    try { globalThis.MooodI18n.bind(director.tr, 'scene', code)(director.api(who, element)); } catch (err) { report(`script ${who}`, err); }
  };
  exec(C.script, 'scene', null);
  for (const E of C.elements) exec(E.o.script, E.who, E.o);
  director.emit('load', null, N.state.now);
}
// the film started from its beginning, playing (once a scene shown: asked again, it plays on)
function startShowcase(N) {
  if (N.showcased) return;
  N.showcased = true;
  const sc = N.director.showcase;
  if (!sc.load(N.C.showcase, N.director.api('showcase', null, true))) return;
  sc.playing = true;
  sc.begin();
}
// the opening's view (2.2 step 5): the camera after the first cut, every quad there is so far — asked while the
// scene is still being built, so its pages are rastered meanwhile. beside: another scene is shown (2.9) — while its loop
// runs, the view is asked in each of its frames, after the frame's own (f.next: one cycle, the living picture's pages
// keep their cells, the view has its share — SH13; at weight 0.5, as a shot's view — `ahead`); while it does not (paused,
// hidden, covered, the instant mode, its fault) — and with no scene shown — in cycles of its own here. → { view,
// taken(answered) — what the build calls at every wake; answered: answers of the artist were taken in it: the view
// worked out anew; cycle() — a whole cycle for it, where no frame asks it (SH12, as a call with f.whole makes it:
// asks and weigh until the pressure stands, then the request); a page's arrival alone is only placed — no view is
// asked again for it: the painter that sent it was given the next page of the list that cycle ordered as it answered
// (SH12), so the painters go on between the artist's answers, and after its last one, till the list is done }. Its
// last ask's lack is written on it (`lacking`: R's in a frame, the cycle's here; −1: not asked yet)
function openingView(N, beside) {
  const view = { world: N.world, camera: N.camera.camera, width: 1, height: 1, stage: N.camera.stage, weight: beside ? 0.5 : 1, coarser: 0, inserts: true, list: new Int32Array(0), n: 0, over: null, overN: 0, ahead: beside, next: beside, nodes: null, nodeOf: null, nodesN: 0, changed: CHANGED.ALL, bias: 0, drawn: 0, entered: 0, fresh: true, lacking: -1, _: undefined };
  // what this view's last ask was of: the camera's pose and the view's size (none yet: asked false)
  let asked = false;
  const was = new Float64Array(8), now = new Float64Array(8);
  // (a cycle of its own: where no frame of a scene shown asks it)
  const cycle = () => {
    sheets.place(Infinity);
    if (!asked) return;
    // (the rounds after the first name again what the first named: nothing changed between them)
    do { view.lacking = sheets.ask(view); view.changed = 0; } while (sheets.weigh());
    sheets.request();
  };
  const taken = answered => {
    if (answered) prepare();
    if (!beside || !frameRequest) cycle();
  };
  const prepare = () => {
    const W = N.world, Q = W.quads, shown = W.nodes.shown;
    // (the camera after the first cut as the paintings taken so far have it — the operator's way round is chosen by
    // them, SH4: its step, of no time)
    N.camera.step(N.stepper.t, 0, true);
    // (the whole canvas in buffer px — RN5: the buffer is RN3's, floor(pw · k) × floor(ph · k))
    const k = Math.min(1, Math.sqrt(host.budget / (host.pw * host.ph)));
    view.width = Math.max(1, Math.floor(host.pw * k)); view.height = Math.max(1, Math.floor(host.ph * k));
    const pose = view.camera.pose;
    now[0] = pose.x; now[1] = pose.z; now[2] = pose.h; now[3] = pose.look; now[4] = pose.yaw; now[5] = pose.roll; now[6] = view.width; now[7] = view.height;
    let changed = !asked;
    for (let i = 0; i < 8; i++) if (now[i] !== was[i]) { was[i] = now[i]; changed = true; }
    if (view.list.length < Q.n) view.list = new Int32Array(Q.cap);
    let n = 0;
    for (let i = 0; i < Q.n; i++) if ((Q.flags[i] & FLAG.SHOWN) && Q.sheet[i] >= 0 && shown[Q.node[i]]) view.list[n++] = i;
    // (the camera or the size another: all of it worked out; else SHEETS works out the quads that are new to the list
    // and those whose rows were stamped — SH10; kept till the view is next asked)
    view.n = n; if (changed) view.changed = CHANGED.ALL;
    asked = true;
  };
  return { view, taken, cycle };
}
// the scene being built (its world is told to the page's wait sign), and the last show's outcome
let pending = null, showing = Promise.resolve(), broken = null;
async function show(job, spec, modules, start) {
  start = start || {};
  stand?.mark('shown');
  // 2.9 step 1: the scene shown before goes on as it would, beside the one being made
  const old = S;
  // (the scene before is drawn by the loop, living: the new one is made beside it, its opening view asked in that one's
  // frames; else — none, its fault, the instant mode, a render — nothing is drawn)
  const beside = !!old && !clockGiven;
  messages.shown();
  // (tag: the page's name for this show — every event, action and line of its director carries it, so the page knows
  // whose it is while two scenes live; later: what it tells, kept till it is shown — its state, its events, lines and
  // actions: the page has the scene shown till the switch; veiled: it drew the veil to black before its switch)
  const N = { spec, modules, world: null, artist: null, director: null, seen: false, showcased: false, instant: false, fault: null, selected: null, offered: new Set(), still: null, seenWaiters: [], prepared: new Map(), zero: null, cutsTold: 0, tag: start.tag ?? null, beside: null, later: [], veiled: false };
  pending = N;
  const told = m => { m.scene = N.tag; if (N.later) N.later.push(m); else post(m); };
  // (replaced — by a newer show, the device lost: its artist is ended at once, and what waits on the artist with it)
  job.stop = () => { N.artist?.terminate(); N.world?.fail(REPLACED); };
  const fade = Math.max(0, Number(start.fade) || 0);
  let resume = null, made = null;
  try {
    // 2.2 step 4: a new artist, told the scene at once (it makes its copy of the scene's code — the spec compiled, the
    // kit, the modules, the land — while this thread builds the world and the people); the spec compiled; the world's
    // closed set of pipelines asked now
    N.artist = new Worker(new URL('./sheets/artist.js', import.meta.url), { type: 'module' });
    N.artist.postMessage({ t: 'show', spec, modules });
    const C = N.C = compile(spec, warn, kit.words(modules));
    R.prepare(C.has);
    const shared = await kit.shared(spec, modules); check(job);
    for (const e of shared.errors) report('scene', e);
    const state = N.state = createState({
      kit, say: warn,
      // the state's events: heard by the scene's scripts (the director's listeners) and — of the scene shown — the page
      emit(type, key, value, old_) {
        N.director?.emit(type, key, value, old_, key);
        // (of the scene shown alone: the page holds its state — one being made tells its own as it is shown: 2.9)
        if (N !== S) return;
        if (type === 'change') messages.events.change(key, value, state.targetOf(key)); else messages.events.move(key, value);
      },
    });
    // the state it opens with: its start; a scene whose film was going begins so, its film begun and (below) sought to
    // where it was — the film `start.showcase` names ({ at, playing }: the restart after a loss, 2.8): the film is code,
    // it cannot be taken up over the state it had reached
    resume = C.showcase && start.showcase && typeof start.showcase === 'object' ? start.showcase : null;
    state.start(spec, start.values || {});
    const world = N.world = createWorld(C, {
      state, shared, height: landOf(C, shared, warn), sheets, gpu, artist: { post: m => N.artist.postMessage(m) }, arrived, warn, report, debug: host.flags.debug != null,
    });
    N.artist.onmessage = e => world.heard(e.data);
    N.artist.onerror = e => world.fail(new Error(`the artist's thread failed: ${e.message || 'it did not start'}`));
    const lookOf = N.lookOf = createLook(C.light, C.lights, world.tables, warn);
    world.look = lookOf.update(state.value);
    if (world.persons.length) {
      world.people = await createPeople(world.persons.map(el => ({ id: el.id, index: el.index, node: el.node, o: el.o, inside: el.flags.inside })), {
        cast: shared.kits, anchor: world.anchor, ground: world.groundFor, inside: world.insideAt, point: world.pointOf, frame: world.frameOf, moves: world.movedBy, placed: world.placedNow, gpu, lib: R.lib, built: arrived, warn,
      });
      check(job);
    }
    stand?.mark('people');
    const camera = N.camera = createCamera(world, state, host);
    world.lit = createLights(world, state.value, warn);
    world.lit.all();
    world.emitters = createEmitters(world, state);
    // (played: a viewer is shown its frames — its first drawn, no job apart but a show beside it, not the instant mode)
    const shots = N.shots = createShots({ world, camera, state, host, playing: () => !clockGiven && S === N && N.seen && (!running || running.drawing) && !N.instant });
    const director = N.director = createDirector({ state, world, camera, shots, anim: shared.anim, kit: shared.kits, lib: shared.lib, tr: shared.tr, speech: host.speech, warn, report, post: told });
    // (what the camera foresees and an insert's opening runs by: the director's moves — RN4)
    world.moves = director;
    N.inspect = createInspect(world, camera, state, host);
    const f = N.f = { t: 0, dt: 0, shot: 0, whole: true, wait: false, camera: camera.camera, toward: null, rect: camera.rect, seen: camera.seen, stage: camera.stage, over: world.over, overN: 0, ahead: shots.ahead, moving: false, veil: 0, next: null };
    // (parts: the detail run's — each step's parts timed into the stand's one object; else no clock is read in a step)
    const stepper = N.stepper = createStepper(N, f, { sync: keys => { if (N === S) messages.events.sync(keys, state.value); }, parts: row.step });
    // (a render's clock: the part of a millisecond its unseen steps have not run yet — advance)
    N.clockLeft = 0;
    // the opening's state, before anything is painted: restored or started; the scripts and the film started; ONE
    // unseen step — the first beat's cut happens in it, with the people there. The opening is not simulated: what its
    // scripts and that step tell — events, lines, actions — goes to the page as on any step (2.2 step 4); only a state
    // restored is brought up silently
    director.simulating = !!start.restore;
    if (start.restore) { director.restore(start.restore); stepper.t = director.time; runScripts(N, false); }
    else { director.open(); runScripts(N); }
    if (start.showcase || resume) startShowcase(N);
    await turn(); check(job);
    stepper.step(0, false);
    director.simulating = false;
    N.zero = director.save();
    // a jump (2.2 step 4: start.then — where a game has got to in the scene), before anything is painted: the instant
    // mode, silent; each value and cut in order, the sequences going on between them; then one more unseen step
    if (start.then?.length) {
      director.simulating = true; director.instant = true;
      for (const [what, value] of start.then) {
        if (what === 'cut') { for (const k in value || {}) state.outside(k, 'the game'); director.cut(value || {}); }
        else if (what !== 'wait' && what !== 'heard') { state.outside(what, 'the game'); director.act(null, 'state', 'set', [what, value, {}]); }
        await turn(); check(job);
      }
      director.instant = false;
      stepper.step(0, false);
      director.simulating = false;
    }
    // then the artist is told that state
    world.told();
    // 2.2 step 5: the world built; the first frame's pages rastered meanwhile — beside the scene drawn, in its frames
    // (2.9); what is waited for told to the page — after each answer taken, and once before R.build
    const opening = openingView(N, beside);
    if (beside) N.beside = { view: opening.view, world, armed: false, idle: 0, lacking: -2, bias: -1 };
    waitsNow(false);
    // (the stand's mark: the artist's last answer of the build taken — a world that paints nothing has none to wait for)
    await world.build(answered => { opening.taken(answered); waitsNow(false); if (!world.flying) stand?.mark('painted'); }, arrival, () => check(job));
    stand?.mark('painted');
    // (its kept points made now, not in a frame that asks it: 5.16)
    sheets.asking.keep(world);
    waitsNow(false);
    // 2.2 step 6: what R makes for the world (RN2) — its pipelines, its sprites; nothing switched yet
    made = await R.build(world);
    check(job);
    stand?.mark('pipelines');
    // 2.9 step 3: beside a scene shown — whole first: its opening view, asked in that scene's frames or in cycles of its
    // own, lacking nothing; woken by each such frame and each arrival
    if (N.beside) {
      const B = N.beside;
      B.armed = true;
      for (;;) {
        if (!frameRequest) opening.cycle();
        if (judged(B)) break;
        await until(job, arrival());
      }
      B.armed = false;
      stand?.mark('whole');
    }
    // (through black: the veil drawn over the scene before, living under it)
    if (fade > 0) { N.veiled = true; await until(job, veilTo(1, fade)); }
  } catch (err) {
    // 2.9 step 4: a build that fails, a switch that cannot come, a show replaced: what was made let go — the scene
    // shown before stays, living; a veil this show drew lifted again
    job.stop = null;
    if (made) R.drop(made);
    N.artist?.terminate();
    N.director?.stop();
    N.world?.people?.dispose();
    N.world?.dispose();
    if (pending === N) pending = null;
    if (N.veiled) veilTo(0, fade);
    messages.waits(null);
    // (what failed is the reply's; a scene still shown and going on is the scene — only none shown refuses what is
    // asked with it)
    if (err !== REPLACED) broken = !old ? err : null;
    throw err;
  }
  // 2.9 step 3 — the switch, in one task, nothing that can throw or be replaced in between: R draws the new world, the
  // new scene is the one shown — a `seen` asked of the scene before and not answered yet is this one's to answer
  // (PG4) —, what it kept to tell is told, and the scene before is let go
  job.stop = null;
  R.use(made);
  // (what the scene before told and the page has not heard yet goes first: it is of that scene)
  messages.state();
  S = N; pending = null; broken = null;
  if (old) {
    N.seenWaiters.push(...old.seenWaiters.splice(0));
    old.director.stop(); old.shots.clear(); old.artist.terminate(); old.world.stop();
    old.world.people?.dispose(); old.world.dispose();
  }
  // the page told the switch — the state of the scene shown now, all of it (PG16) —, then what the scene kept to tell
  messages.events.keeps(!!start.save);
  post({ t: 'switched', scene: N.tag, show: start.show ?? null, values: { ...N.state.now } });
  const kept = N.later;
  N.later = null;
  for (const m of kept) post(m);
  if (fade > 0) veil.lift = fade;
  messages.all();
  stand?.mark('built');
  pace?.shown();
  newShot();
  // (a scene whose film was going — a restart's: sought to where it was — 2.5; no frames meanwhile. What
  // follows the switch can no longer undo it: a seek that fails or is replaced leaves the new scene shown)
  if (resume) {
    if (resume.at > 0) { job.drawing = false; unloop(); await seek(job, resume.at, resume.playing); }
    else N.director.showcase.playing = resume.playing;
  }
  return true;
}

// the showcase sought to `at` (its seconds; 2.5): a place behind the present moment — from the last checkpoint at or
// before it; a place ahead — on from where the film stands; unseen to it, then drawn whole
async function seek(job, at, playing = null) {
  const { director, stepper } = S, sc = director.showcase;
  if (!sc.beats) throw new Error('the showcase is sought once it is started (stage.showcase.start()) — this scene has no film going');
  at = Math.max(0, at);
  await jump(job, async () => {
    // (a seek moves the place, not the play state — also when it fails or a newer one replaces it: PG12)
    const was = playing ?? sc.playing;
    try {
      if (at < sc.at - 1e-9) {
        const c = sc.checkpoint(at);
        if (!c) throw new Error(`the showcase keeps no moment at or before ${at} s to go back to`);
        director.restore(c.data);
        stepper.t = director.time;
        runScripts(S, false);
        sc.playing = true;
        sc.from(c);
      }
      sc.playing = true;
      await advance(job, stepper.t + at - sc.at, () => sc.ended);
    } finally { sc.playing = was; }
  });
  return { ...sc.info, beats: sc.beats };
}

// ── selecting (IN6): what is at a point of the place, the selection, what is offered ──
const ro = new Float64Array(3), rd = new Float64Array(3);
const byPath = path => { const m = /^objects\[(\d+)\]$/.exec(path || ''); return m ? S?.world.elements.find(el => el.path === Number(m[1])) ?? null : null; };
function pick(x, y, allowed) {
  if (!S) return null;
  const { camera, world } = S, r = camera.rect;
  const only = allowed ? new Set(allowed) : null;
  const skip = only ? new Set(world.elements.filter(el => !only.has(pathOf(el)))) : null;
  camera.rayAt(x, y, ro, rd);
  // an insert over the frame first; then what stands in the world; then the sky
  let el = world.insertHit((x - r.x - r.w / 2) / r.h, (y - r.y) / r.h, skip);
  if (!el) { const h = world.pickRay(ro, rd, 1e5, skip, world.yaw, false); el = h ? h.el : world.skyHit(rd[0], rd[1], rd[2], world.yaw, skip); }
  return el ? { path: pathOf(el), background: background(el) } : null;
}
// what spans much of the frame (a lake, the far hills, a wall): picked on a second click (the page's select.js)
const covers = new Map();
function background(el) {
  if (!covers.has(el)) {
    const b = S.inspect.boxOf(el), r = S.camera.rect;
    covers.set(el, !!b && (Math.min(b[2], r.w) * Math.min(b[3], r.h)) / (r.w * r.h) > 0.25);
  }
  return covers.get(el);
}

// ── what the page asks (PG4) ──
// the show asked last has ended (one asked meanwhile is waited for in its turn: what is asked of "the scene" is asked
// of the newest)
const shown = async () => { for (let was = null; was !== showing;) { was = showing; await was; } };
// of the scene being shown, once it is. A call that is a job apart (a seek, `to`, a restore, a still) then goes
// straight to apart(): it replaces the one running
const scene = async fn => { await shown(); return fn(); };
// … of the scene shown at once — what the page names by the spec it has (its selection, what is offered): a scene being
// made beside it is not it till the switch (2.9); with none shown yet, of the one being shown
const ofShown = fn => (S ? fn() : scene(fn));
const calls = {
  // what its frames were so far, told now (frames.js: the page is being left, or hidden)
  frames: () => frames.flush(),
  // the stage's veil (2.10, PG15): of no scene — at once, not behind a show
  fade: (level, seconds) => { veil.lift = 0; return veilTo(level, seconds); },
  // (start: what it opens with — the state, a film, a saved moment: PG4)
  show(spec, modules, start) {
    const job = apart(j => show(j, spec, modules, start), { drawing: !!S });
    showing = job.then(() => {}, () => {});
    return job;
  },
  ready: async () => { await shown(); if (broken) throw broken; },
  // the frame last asked drawn whole, and the GPU done with it — rejected with the scene's fault (PG7 c)
  async seen() {
    await shown();
    if (broken) throw broken;
    if (!S) return;
    if (S.fault) throw S.fault;
    if (clockGiven) return apart(job => { S.f.whole = true; return settle(job); });
    if (!S.seen || heldBefore || S.f.whole) await new Promise((resolve, reject) => { S.seenWaiters.push({ resolve, reject }); reloop(); });
    await gpu.done();
  },
  // one whole frame of this very moment from a camera whose keys are `view` over the scene's (no step; the scene's
  // own camera untouched) — one that names its target is a shot of its own
  still: view => scene(() => (S ? apart(async job => {
    newShot();
    const from = S.camera.cameraFor(view || {}, newCamera(), null, 'camera_target' in (view || {}));
    await settle(job, false, from);
    // (the film's next frame is its own again: a new shot; what is where is asked as that camera saw it)
    newShot();
    S.still = from;
  }) : null)),
  // (a moment drawn as another camera sees it, still: what is where as that one sees it)
  inspect: async () => { await shown(); const v = S?.still; return S && { t: Math.round(S.stepper.t * 1000) / 1000, camera: v ? { ...v.pose } : S.camera.pose(), frame: { ...S.camera.rect }, seen: { ...S.camera.seen }, elements: S.inspect.layout(v) }; },
  ground: (a, d) => S?.world.groundAt(a, d) ?? 0,
  resetCamera: () => S?.camera.reset(),
  // (the page's layout: the thread's — kept in host, taken by the camera of the scene shown, of one being built and
  // of every one made later)
  setView: (l, r) => { host.view[0] = l; host.view[1] = r; S?.camera.size(); pending?.camera?.size(); },
  // the state and the scene's scripts anew (asked apart from a show): this is its opening's moment from now on
  start: (spec, values, opts) => scene(() => {
    if (!S) return null;
    messages.events.keeps(!!opts?.save);
    S.showcased = false;
    S.director.showcase.stop();
    S.state.start(spec, values || {});
    S.director.open();
    runScripts(S);
    newShot();
    S.zero = S.director.save();
    return null;
  }),
  stop: () => scene(() => { S?.director.stop(); }),
  set: (key, value, over, ease, opts = {}) => scene(() => { if (!S) return; S.state.outside(key, opts.who); S.director.act(null, 'state', 'set', [key, value, { over, ease }]); }),
  cut: (values, opts = {}) => scene(() => { if (!S) return; for (const k in values || {}) S.state.outside(k, opts.who); S.director.cut(values || {}); }),
  turn: (key, degrees, over, ease) => scene(() => { if (!S) return; S.state.outside(key); S.director.act(null, 'state', 'turn', [key, degrees, { over, ease }]); }),
  path: (keys, points, opts) => scene(() => { if (!S) return 0; for (const k of keys) S.state.outside(k); return S.director.act(null, 'state', 'path', [keys, points, opts]).duration ?? 0; }),
  check: (keys, who) => scene(() => { if (S) keys.forEach(k => S.state.outside(k, who, false)); }),
  unknown: () => scene(() => S?.state.unknown() ?? []),
  // (every key that moves is told with the tick's message — PG5 `moves`; the page calls its own listeners)
  listen() {},
  // the director (MooodState.act …): page — the page's id of the action, whose events it hears
  act: (page, actor, verb, args) => scene(() => { if (!S) return false; S.director.act(page, actor, verb, args); return true; }),
  control: (page, how) => scene(() => S?.director.control(page, how)),
  signal: (name, data) => scene(() => S?.director.signal(name, data)),
  // (a line's id is the thread's: of the scene shown, or of the one being shown — its opening's lines are said)
  said(id, ev, duration) { pending?.director?.said(id, ev, duration); S?.director.said(id, ev, duration); },
  save: () => scene(() => S?.director.save() ?? null),
  restore: data => scene(() => (S && data ? apart(job => jump(job, async () => { S.director.restore(data); S.stepper.t = S.director.time; runScripts(S, false); })) : null)),
  // the instant mode (a game jumping to a moment of it) — the scene's: a scene shown starts without it. On — no
  // frames, the clock standing, every action finished as it begins; off — the scene as it is then, shown as a new
  // shot, whole
  instant: on => scene(() => {
    if (!S || !!on === S.instant) return null;
    S.instant = !!on;
    S.director.instant = S.instant;
    if (S.instant) { unloop(); return null; }
    return apart(job => jump(job, async () => { S.director.cut({}); }));
  }),
  // the showcase (PG12)
  showcase: (how, at) => scene(() => {
    if (!S) return null;
    const sc = S.director.showcase, info = () => (sc.info ? { ...sc.info, beats: sc.beats } : null);
    if (how === 'start') { startShowcase(S); return info(); }
    if (!sc.beats) return null;
    if (how === 'pause') { sc.playing = false; return info(); }
    if (how === 'play') { if (!sc.ended) { sc.playing = true; return info(); } return apart(job => seek(job, 0, true)); }
    if (how === 'seek') return apart(job => seek(job, Number(at) || 0));
    return info();
  }),
  // the scene's time moved to `seconds` (2.5): behind the present moment — from the last moment kept at or before
  // it: a beat's beginning of the film it plays, else its opening's (a film begun later than that had not begun);
  // then unseen on to it
  to: seconds => scene(() => (S ? apart(job => jump(job, async () => {
    const to = Math.max(0, Number(seconds) || 0), { director, stepper } = S;
    if (to < stepper.t - 1e-9) {
      const sc = director.showcase, c = S.showcased ? sc.checkpointBy(to) : null;
      director.restore(c ? c.data : S.zero); stepper.t = director.time; runScripts(S, false);
      if (c) sc.from(c); else if (S.showcased) { S.showcased = false; sc.stop(); }
    }
    await advance(job, to);
  })) : null)),
  // shots made ready by the page (PG11) — kept by their ids while they live
  prepare: values => scene(() => {
    if (!S) return null;
    for (const [was, shot] of S.prepared) if (shot.ended) S.prepared.delete(was);
    const id = ++prepares;
    S.prepared.set(id, S.shots.make(values || {}, 'page'));
    return id;
  }),
  unprepare: id => scene(() => { const s = S?.prepared.get(id); if (s) { s.cancel(); S.prepared.delete(id); } }),
  // selecting: the scene it is in, what is at a point of the place, the selection, what pulses
  pickSpec() { covers.clear(); },
  pick: (x, y, allowed) => pick(x, y, allowed),
  select: path => ofShown(() => {
    if (!S) return;
    if (S.selected) S.world.mark(S.selected, FLAG.SELECTED, false);
    S.selected = byPath(path);
    if (S.selected) S.world.mark(S.selected, FLAG.SELECTED, true);
  }),
  offer: paths => ofShown(() => {
    if (!S) return;
    const now = new Set();
    for (const p of paths || []) { const el = byPath(p); if (el) now.add(el); }
    for (const el of S.offered) if (!now.has(el)) S.world.mark(el, FLAG.OFFERED, false);
    for (const el of now) S.world.mark(el, FLAG.OFFERED, true);
    S.offered = now;
  }),
  // a point the page follows (PG9) → its slot
  track: (ref, lift, over) => messages.track(ref, lift, over),
  // 2.6
  pause(on) {
    on = !!on;
    if (on === paused) return;
    paused = on;
    if (paused) unloop(); else reloop();
  },
  waits: () => ({ waits: waitsNow(heldBefore), missing: R ? R.missing() : [] }),
  // the measuring stand (ST3)
  stand: (how, name) => (!stand ? null : how === 'start' ? (pace?.measure(true), stand.start(), true) : how === 'segment' ? (stand.segment(name, R.stamped()), true) : stand.take({ memory: gpu.memory(), gpu: gpu.info, stats: sheets.stats(), stamped: R.stamped() })),
};
let prepares = 0;

// the page's input (PG3): the camera's (the viewer's moves); P — the panel of what the frames are
function input(ev) {
  if (ev.type === 'keydown' && ev.code === 'KeyP') {
    perf.on = !perf.on;
    if (perf.on) { perf.since = 0; perf.ticks = perf.ran = perf.drawn = perf.held = perf.idle = 0; perf.worst = 0; } else post({ t: 'perf', text: null });
    return;
  }
  stand?.input(ev.type);
  S?.camera.input[ev.type]?.(ev);
}
// the device is lost (2.8): the job apart ends, the loop stops, the one last message; nothing more is done
function lost(reason) {
  if (dead) return;
  let saved = null;
  try { saved = S ? S.director.save() : null; } catch (err) { report('the scene could not be saved as the device was lost', err); }
  dead = true;
  if (running) replace(running);
  unloop();
  messages.lost(saved, String(reason ?? ''));
}
// the engine itself failed after the mount (a painter's thread died: SH5): the job apart ends, the loop stops, the
// one last message — `failed`, with its `renderer: ` error —; nothing more is done (PG7 b)
function failed(err) {
  if (dead) return;
  dead = true;
  if (running) replace(running);
  unloop();
  messages.failed(err);
}

// ── the messages ──
// (what comes before the stage is mounted waits for it — in the order it came)
let mounted = null;
const mounting = new Promise(resolve => { mounted = resolve; });
async function mount(m) {
  // (a render's: the virtual clock, as the page's — before anything here starts to go by it)
  clockGiven = m.clock != null && !m.real;
  if (clockGiven) G.MooodClock(m.clock);
  const where = TIER[m.phone ? 'phone' : 'computer'][m.tier === 'weak' ? 'weak' : 'normal'];
  Object.assign(host, {
    w: m.w, h: m.h, dpr: m.dpr, pw: m.pw, ph: m.ph, budget: m.budget, tier: m.tier, phone: !!m.phone, cores: m.cores || 4, flags: m.flags || {}, overlay: m.overlay || null,
    clock: m.clock ?? null, real: !!m.real, speech: !!m.speech,
    ...where, painters: Math.max(1, Math.min(4, (m.cores || 4) - 3)), cells: 1, land: 1, field: 2048,
  });
  host.lost = lost; host.failed = failed;
  try {
    // (the stand: its row's `step` is the parts' one object in the detail run alone; the sheets' numbers asked of them
    // as they are when it asks)
    if (host.flags.stand) {
      stand = (await import('./stand.js')).createStand(performance.timeOrigin, host.flags.stand === 'detail', () => sheets.stats());
      if (host.flags.stand === 'detail') { row.step = parts; row.tick = ticked; }
    }
    gpu = await createGpu(m.canvas, host);
    sheetsLayouts(gpu);
    sheets = createSheets(gpu, host);
    sheets.onArrive = arrived;
    peopleLayouts(gpu); renderLayouts(gpu);
    R = await createRenderer(gpu, sheets, host);
    if (host.flags.stand === 'detail') { R.detailed(true); row.wideNames = R.wideNames; }
    if (!clockGiven) pace = createPace(gpu);
    stand?.mark('mounted');
  } catch (err) { messages.fatal(err); dead = true; }
  post({ t: 'mounted', keys: KEYS });
  mounted();
}
onmessage = async ({ data: m }) => {
  if (m.t === 'mount') { await mount(m); return; }
  await mounting;
  if (dead) { if (m.t === 'call') post({ t: 'reply', id: m.id, error: 'renderer: the scene cannot be shown' }); return; }
  if (m.t === 'size') {
    Object.assign(host, { w: m.w, h: m.h, dpr: m.dpr, pw: m.pw, ph: m.ph });
    R.resize();
    // (the camera of the scene shown, and of one being built: PG2)
    S?.camera.size(); pending?.camera?.size();
    // (paused: the scene as it stands — no step, but the rows marked since the last one flushed and the tick moved
    // on: 2.6 step 3 —, drawn at its new size in this very task: a resize is never idle; then what a tick has after
    // its frame)
    if (paused && S && !running && !S.instant && !S.fault) { try { S.stepper.unstepped(); S.stepper.show(0); S.f.veil = veil.at; S.f.next = pending?.beside ? pending.beside.view : null; framed(R.frame(S.f)); } catch (err) { faulted(err); } }
  } else if (m.t === 'in') { for (const ev of m.evs) input(ev); }
  else if (m.t === 'call') {
    try {
      const fn = calls[m.fn];
      if (!fn) throw new Error(`the scene's thread has no call '${m.fn}'`);
      const value = await fn(...(m.args || []));
      messages.state();
      post({ t: 'reply', id: m.id, value: value === REPLACED ? { replaced: true } : value });
    } catch (err) { post({ t: 'reply', id: m.id, error: String(err?.message || err) }); }
  }
};
