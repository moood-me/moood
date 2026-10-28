// The ONE step function (rule 7; 2.1 step 6): it moves the scene through time, seen or unseen — a viewer's tick, a
// seek's and a render's steps — always in this order:
//   a. the director: actions, sequences, the showcase's beats; a cut sets its values now and gives a new shot number;
//   b. the keys changed → world.frame: answered makes taken (only on a seen step), swaps whose pages are there written
//      into quads.sheet, nodes placed, what reads a changed key marked to paint; the look, when a key of it moved;
//   c. the animates of the elements people read this step (what they are on, look at, reach for);
//   d. people.frame (where a hand is now); each person's root copied into their node's row;
//   e. the other animates — of elements whose node is shown (5.16) —, the emitters' histories, the camera, the render
//      origin, the sky's animates (what the sky sees of the world is seen from where the eye is now), the lights' rows;
//      the shots cut to in this step end;
//   f. on a seen step: the world's GPU tables flushed. Then the world's tick moves on (3.4).
// One of the elements of (c) that reads where a person is goes round in a circle: it reads them as they were the step
// before (said: world/element.js).
//   show() is 2.1 step 7: the marked elements asked of the artist, the live shots' share, the frame record f filled
// (RN4). On an unseen step nothing is asked of the artist, nothing taken, nothing written to the GPU.
//   A frame drawn with no step before it — a resize while paused, a `still` — is unstepped() then
// show(): still a reading of the tables (3.4).
import { DT_MOST } from '../base.js';

// S: the scene — { world, state, camera, director, lookOf, shots }; f: the frame record (RN4), the thread's one
// object; env: { sync(keys) — the step's changed keys, for the page (play/messages.js); parts — the stand's detail
// run alone (ST2 `step`): ONE object { director, world, animates, people, camera, lights }, each step's ms by part
// written into it; null — no clock is read in a step }
export function createStepper(S, f, env) {
  const { world, state, camera, director, lookOf, shots } = S, T = world.tables;
  const animated = world.elements.filter(el => el.spec.animated && el.kind !== 'sky'), skyAnimated = world.elements.filter(el => el.spec.animated && el.kind === 'sky');
  const root = new Float64Array(12), none = new Set(), noKeys = [], parts = env.parts;
  let keys = noKeys, yawWas = NaN, since = 0;
  // (the detail run: the time since the last reading is that part's)
  const spent = () => { const now = performance.now(), ms = now - since; since = now; return ms; };
  const stepper = {
    // the scene's time (seconds)
    t: 0,
    // the furthest moment the scene's time has reached (a render tells what happens past it: 2.5)
    reached: 0,
    // what the step before did, for the stand: keys changed
    keys: 0,
    // dt: seconds (a seen step's: at most DT_MOST — a stall is not caught up); seen: its result is drawn
    step(dt, seen) {
      if (seen && dt > DT_MOST) dt = DT_MOST;
      const t = stepper.t += dt;
      state.time = t;
      if (parts) since = performance.now();
      // a
      director.step(t, dt);
      const shot = camera.counted();
      if (shot !== f.shot) { f.shot = shot; f.whole = true; }
      if (parts) parts.director = spent();
      // b
      keys = state.changed();
      stepper.keys = keys.length;
      env.sync(keys);
      world.frame(keys, seen, f.whole);
      let lookChanged = false;
      for (let i = 0; i < keys.length; i++) if (lookOf.keys.has(keys[i])) { lookChanged = true; break; }
      if (lookChanged) lookOf.update(state.value);
      if (parts) parts.world = spent();
      // c
      const people = world.people, before = people ? people.reads(state.now) : none, shown = T.nodes.shown;
      if (before.size) {
        world.beforePeople = true;
        for (let i = 0; i < animated.length; i++) { const el = animated[i]; if (shown[el.node] && before.has(el.id)) el.ctx.animate(t, dt); }
        world.beforePeople = false;
      }
      if (parts) parts.animates = spent();
      // d
      if (people) {
        // (while a cut waits, those the story moves stand with it — their pose held; the others live on: 2.4)
        people.frame(t, state.now, state.shots, director.stands);
        for (let i = 0; i < world.persons.length; i++) { const el = world.persons[i]; if (people.root(el.id, root)) world.rooted(el, root); }
      }
      if (parts) parts.people = spent();
      // e
      for (let i = 0; i < animated.length; i++) { const el = animated[i]; if (shown[el.node] && !before.has(el.id)) el.ctx.animate(t, dt); }
      if (parts) parts.animates += spent();
      world.emitters.frame(t, dt);
      if (parts) parts.world += spent();
      camera.step(t, dt, f.whole);
      world.rebase(world.eye);
      if (parts) parts.camera = spent();
      for (let i = 0; i < skyAnimated.length; i++) skyAnimated[i].ctx.animate(t, dt);
      if (parts) parts.animates += spent();
      const yawed = world.yaw !== yawWas;
      yawWas = world.yaw;
      world.lit.frame(keys, yawed, lookChanged);
      if (parts) parts.lights = spent();
      shots.stepped();
      const shotNow = camera.counted();
      if (shotNow !== f.shot) { f.shot = shotNow; f.whole = true; }
      // f
      if (seen) world.flush();
      world.stepped();
      if (parts) parts.world += spent();
      if (t > stepper.reached) stepper.reached = t;
    },
    // before a frame drawn with no step: the rows marked since the last step (a selection, an offer) go to the GPU and
    // the tick moves on — the tables are shown to a reader (3.4, 2.6 step 3)
    unstepped() { world.flush(); world.stepped(); },
    // 2.1 step 7 (a seen tick's): makes asked, the shots' share, the frame record filled
    show(dt) {
      world.asks(); shots.step(keys); keys = noKeys;
      f.t = stepper.t; f.dt = dt;
      f.wait = world.waiting() || (world.people ? world.people.building() : false);
      f.camera = camera.camera; f.toward = camera.toward; f.rect = camera.rect; f.seen = camera.seen; f.stage = camera.stage;
      f.over = world.over; f.overN = f.whole ? 0 : world.overN;
      f.ahead = shots.ahead; f.moving = camera.moving;
    },
  };
  return stepper;
}
